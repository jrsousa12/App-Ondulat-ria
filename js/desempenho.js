import { esc, hojeLocal } from './utils.js';
import { nomeSubtema } from './conteudo.js';

/* Página "Meu desempenho": tudo é calculado a partir dos dados salvos no aparelho. */

const META_QUIZ = 80;
const PONTOS_GRAFICO = 12;

function pct(a, t) {
  return t ? Math.round((a / t) * 100) : 0;
}

function dataLocal(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

function dataCurta(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function nivelStatus(p) {
  if (p >= 80) return { cls: 'bom', rotulo: 'Domina', icone: '✓' };
  if (p >= 50) return { cls: 'medio', rotulo: 'Em progresso', icone: '~' };
  return { cls: 'fraco', rotulo: 'Revisar', icone: '!' };
}

/** Dias (data local) em que o aluno estudou: quizzes, questões, flashcards e diário. */
function diasDeEstudo(dados) {
  const dias = new Set();
  const add = iso => { const d = iso && dataLocal(iso); if (d) dias.add(d); };
  (dados.historico || []).forEach(h => add(h.em));
  Object.values(dados.questoes || {}).forEach(q => add(q.em));
  Object.values(dados.flashcards || {}).forEach(f => add(f.ultimaVez));
  Object.values(dados.trilhas || {}).forEach(t => { add(t.quiz?.em); add(t.concluidaEm); });
  (dados.diario || []).forEach(r => add(r.em || r.data || r.quando));
  return dias;
}

function sequenciaAtual(dias) {
  let seq = 0;
  const d = new Date();
  const hoje = dataLocal(d.toISOString());
  // Se ainda não estudou hoje, a sequência vale até ontem.
  if (!dias.has(hoje)) d.setDate(d.getDate() - 1);
  while (dias.has(dataLocal(d.toISOString()))) {
    seq++;
    d.setDate(d.getDate() - 1);
  }
  return seq;
}

function graficoEvolucao(historico) {
  const pts = historico.slice(-PONTOS_GRAFICO);
  if (!pts.length) {
    return '<p class="des-vazio">Faça o quiz de uma trilha para acompanhar sua evolução aqui.</p>';
  }
  const W = 320, H = 160, ml = 34, mr = 14, mt = 14, mb = 26;
  const iw = W - ml - mr, ih = H - mt - mb;
  const x = i => ml + (pts.length === 1 ? iw / 2 : (i * iw) / (pts.length - 1));
  const y = v => mt + ih - (v / 100) * ih;
  const valores = pts.map(h => pct(h.acertos, h.total));
  const grade = [0, 50, 100].map(v =>
    `<line class="des-grade" x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}"/><text class="des-eixo" x="${ml - 6}" y="${y(v) + 4}">${v}%</text>`
  ).join('');
  const linha = valores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const pontos = pts.map((h, i) => {
    const v = valores[i];
    const texto = `Trilha ${h.trilha} · ${h.acertos}/${h.total} (${v}%) · ${dataCurta(h.em)}`;
    return `<g class="des-ponto" tabindex="0" role="img" aria-label="${esc(texto)}" data-dica="${esc(texto)}" data-x="${x(i).toFixed(1)}" data-y="${y(v).toFixed(1)}">
      <circle class="des-alvo" cx="${x(i)}" cy="${y(v)}" r="14"/>
      <circle class="des-marca ${v >= META_QUIZ ? 'ok' : ''}" cx="${x(i)}" cy="${y(v)}" r="4.5"/>
    </g>`;
  }).join('');
  const ult = valores.length - 1;
  const rotuloUlt = `<text class="des-rotulo" x="${x(ult)}" y="${Math.max(10, y(valores[ult]) - 10)}">${valores[ult]}%</text>`;
  const linhas = pts.map((h, i) => `<tr><td>${dataCurta(h.em)}</td><td>Trilha ${esc(String(h.trilha))}</td><td>${h.acertos}/${h.total}</td><td>${valores[i]}%</td></tr>`).join('');

  return `
    <div class="des-grafico">
      <svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Notas dos últimos ${pts.length} quizzes">
        ${grade}
        <line class="des-meta" x1="${ml}" x2="${W - mr}" y1="${y(META_QUIZ)}" y2="${y(META_QUIZ)}"/>
        <text class="des-meta-rot" x="${ml + 4}" y="${y(META_QUIZ) - 5}">meta ${META_QUIZ}%</text>
        <path class="des-linha" d="${linha}"/>
        ${pontos}
        ${rotuloUlt}
      </svg>
      <div class="des-dica" role="status" hidden></div>
    </div>
    <details class="des-tabela">
      <summary>Ver como tabela</summary>
      <table><thead><tr><th>Data</th><th>Trilha</th><th>Acertos</th><th>Nota</th></tr></thead><tbody>${linhas}</tbody></table>
    </details>`;
}

function ligarDicasGrafico(raiz) {
  const caixa = raiz.querySelector('.des-grafico');
  if (!caixa) return;
  const dica = caixa.querySelector('.des-dica');
  const svg = caixa.querySelector('svg');
  const mostrar = g => {
    const r = svg.getBoundingClientRect();
    const escala = r.width / svg.viewBox.baseVal.width;
    dica.textContent = g.dataset.dica;
    dica.hidden = false;
    const px = parseFloat(g.dataset.x) * escala;
    const py = parseFloat(g.dataset.y) * escala;
    dica.style.left = `${Math.min(Math.max(px, 70), r.width - 70)}px`;
    dica.style.top = `${py}px`;
  };
  const esconder = () => { dica.hidden = true; };
  caixa.querySelectorAll('.des-ponto').forEach(g => {
    g.addEventListener('pointerenter', () => mostrar(g));
    g.addEventListener('focus', () => mostrar(g));
    g.addEventListener('click', () => mostrar(g));
    g.addEventListener('pointerleave', esconder);
    g.addEventListener('blur', esconder);
  });
}

export function renderDesempenho(dados, trilhas, { totalBadges = 0 } = {}) {
  const container = document.querySelector('#conteudo');
  const questoes = Object.values(dados.questoes || {});
  const historico = Array.isArray(dados.historico) ? dados.historico : [];
  const totT = questoes.reduce((s, q) => s + (q.tentativas || 0), 0);
  const totA = questoes.reduce((s, q) => s + (q.acertos || 0), 0);
  const aproveitamento = pct(totA, totT);
  const dominadas = questoes.filter(q => q.ultimoAcerto && q.acertos >= 2).length;
  const dias = diasDeEstudo(dados);
  const seq = sequenciaAtual(dias);

  /* Por conceito */
  const porSub = {};
  questoes.forEach(q => {
    const k = q.subtema || '';
    const e = porSub[k] || (porSub[k] = { t: 0, a: 0, trilha: q.trilha });
    e.t += q.tentativas || 0;
    e.a += q.acertos || 0;
  });
  const conceitos = Object.entries(porSub)
    .map(([k, e]) => ({ k, nome: nomeSubtema(k), p: pct(e.a, e.t), t: e.t, a: e.a, trilha: e.trilha }))
    .sort((a, b) => a.p - b.p || b.t - a.t);
  const conceitosHtml = conceitos.length
    ? conceitos.map(c => {
        const st = nivelStatus(c.p);
        return `<li class="des-conceito">
          <div class="des-conceito-topo">
            <span>${esc(c.nome)} <small>Trilha ${esc(String(c.trilha))}</small></span>
            <strong>${c.p}%</strong>
          </div>
          <div class="des-barra"><div class="${st.cls}" style="width:${Math.max(c.p, 2)}%"></div></div>
          <div class="des-conceito-rodape">
            <span class="des-status ${st.cls}"><b aria-hidden="true">${st.icone}</b>${st.rotulo}</span>
            <span>${c.a} de ${c.t} acertos</span>
          </div>
        </li>`;
      }).join('')
    : '<li class="des-vazio">Ao responder os quizzes, você verá aqui os conceitos que já domina e os que precisa revisar.</li>';

  /* Por trilha */
  const trilhasHtml = trilhas.map(t => {
    const d = dados.trilhas?.[t.id] || {};
    const liberada = t.id === '1' || dados.trilhas?.[String(+t.id - 1)]?.concluida === true;
    const comp = d.compreensao ? `${d.compreensao.acertos}/${d.compreensao.total}` : '—';
    const quizP = d.quiz ? Math.round(d.quiz.pct ?? pct(d.quiz.acertos, d.quiz.total)) : null;
    const tentativas = historico.filter(h => String(h.trilha) === t.id).length || d.tentativasQuiz || 0;
    let chip;
    if (d.concluida) chip = '<span class="badge-concluida">✓ Concluída</span>';
    else if (Object.keys(d).length) chip = '<span class="badge-andamento">Em andamento</span>';
    else if (!liberada) chip = '<span class="badge-bloqueada">🔒 Bloqueada</span>';
    else chip = '<span class="badge-andamento">Disponível</span>';
    if (!liberada) {
      return `<li class="des-trilha bloqueada">
        <div class="des-trilha-topo"><strong>${t.id}. ${esc(t.curto)}</strong>${chip}</div>
        <p class="des-legenda">Conclua a trilha anterior para liberar.</p>
      </li>`;
    }
    return `<li class="des-trilha">
      <div class="des-trilha-topo"><strong>${t.id}. ${esc(t.curto)}</strong>${chip}</div>
      <div class="des-barra des-barra-meta" aria-label="Melhor nota no quiz: ${quizP ?? 0}%">
        <div class="${quizP === null ? '' : nivelStatus(quizP).cls}" style="width:${quizP ?? 0}%"></div>
        <i style="left:${META_QUIZ}%" aria-hidden="true"></i>
      </div>
      <dl class="des-trilha-dados">
        <div><dt>Melhor quiz</dt><dd>${quizP === null ? '—' : quizP + '%'}</dd></div>
        <div><dt>Compreensão</dt><dd>${comp}</dd></div>
        <div><dt>Tentativas</dt><dd>${tentativas}</dd></div>
        <div><dt>Concluída em</dt><dd>${d.concluidaEm ? dataCurta(d.concluidaEm) : '—'}</dd></div>
      </dl>
    </li>`;
  }).join('');

  /* Flashcards */
  const cartoes = Object.values(dados.flashcards || {});
  const hoje = hojeLocal();
  const paraHoje = cartoes.filter(c => !c.proximaRevisao || c.proximaRevisao <= hoje).length;
  const consolidados = cartoes.filter(c => (c.intervalo || 0) >= 7).length;

  /* Próximos passos */
  const passos = [];
  const fraco = conceitos.find(c => c.p < 70 && c.t >= 2);
  if (fraco) passos.push({ href: `#trilha/${fraco.trilha}`, icone: '🎯', texto: `Revise <strong>${esc(fraco.nome)}</strong> na Trilha ${esc(String(fraco.trilha))} (${fraco.p}% de acertos).` });
  if (paraHoje > 0 && cartoes.length) passos.push({ href: '#praticar', icone: '🃏', texto: `Você tem <strong>${paraHoje}</strong> flashcard(s) para revisar hoje.` });
  const prox = trilhas.find(t => !dados.trilhas?.[t.id]?.concluida && (t.id === '1' || dados.trilhas?.[String(+t.id - 1)]?.concluida));
  if (prox) passos.push({ href: `#trilha/${prox.id}`, icone: '🚀', texto: `Siga para a <strong>Trilha ${prox.id}: ${esc(prox.titulo)}</strong>.` });
  if (!cartoes.length) passos.push({ href: '#praticar', icone: '🧠', texto: 'Experimente os <strong>flashcards</strong> para fixar os conceitos.' });
  const passosHtml = passos.slice(0, 3).map(p => `<li><a href="${p.href}" class="des-passo"><span aria-hidden="true">${p.icone}</span><span>${p.texto}</span></a></li>`).join('');

  container.innerHTML = `
    <section class="des-topo">
      <a href="#perfil" class="home-link">← Perfil</a>
      <h2>Meu desempenho</h2>
      <p>Tudo calculado com o que você fez neste aparelho.</p>
    </section>

    <ul class="des-kpis" aria-label="Resumo do desempenho">
      <li class="des-kpi-destaque"><strong>${totT ? aproveitamento + '%' : '—'}</strong><span>Aproveitamento nos quizzes</span></li>
      <li><strong>${questoes.length}</strong><span>Questões respondidas</span></li>
      <li><strong>${dominadas}</strong><span>Questões dominadas</span></li>
      <li><strong>${seq}</strong><span>${seq === 1 ? 'Dia seguido' : 'Dias seguidos'}</span></li>
      <li><strong>${dias.size}</strong><span>Dias de estudo</span></li>
    </ul>

    ${passosHtml ? `<section class="home-secao"><h3 class="des-h3">Próximos passos</h3><ul class="des-passos">${passosHtml}</ul></section>` : ''}

    <section class="home-secao card">
      <h3>Evolução nos quizzes</h3>
      ${graficoEvolucao(historico)}
    </section>

    <section class="home-secao card">
      <h3>Por conceito</h3>
      <p class="des-legenda">Do que precisa mais atenção para o que você já domina.</p>
      <ul class="des-conceitos">${conceitosHtml}</ul>
    </section>

    <section class="home-secao">
      <h3 class="des-h3">Por trilha</h3>
      <ul class="des-trilhas">${trilhasHtml}</ul>
    </section>

    <section class="home-secao card">
      <h3>Flashcards e atividades</h3>
      <ul class="des-mini">
        <li><strong>${cartoes.length}</strong><span>Cartões estudados</span></li>
        <li><strong>${paraHoje}</strong><span>Para revisar hoje</span></li>
        <li><strong>${consolidados}</strong><span>Consolidados</span></li>
        <li><strong>${(dados.diario || []).length}</strong><span>Registros no diário</span></li>
        <li><strong>${Object.keys(dados.atividadesAbertas || {}).length}</strong><span>Atividades abertas</span></li>
        <li><strong>${(dados.badges || []).length}<small>/${totalBadges}</small></strong><span>Conquistas</span></li>
      </ul>
      <p class="des-legenda">Questão dominada: acertou ao menos 2 vezes e a última resposta estava certa. Cartão consolidado: revisão marcada para daqui a 7 dias ou mais.</p>
    </section>
  `;
  ligarDicasGrafico(container);
}
