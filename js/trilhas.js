import { esc, shuffle, formatarDuracao } from './utils.js';
import { estaEmModoProfessor } from './modo-professor.js';

let cleanupAtual = null;
let trilhaToken = 0;

export function cleanupTrilha() {
  trilhaToken++;
  if (cleanupAtual) {
    try { cleanupAtual(); } catch (_) {}
    cleanupAtual = null;
  }
}

async function carregarJSON(caminho) {
  const res = await fetch(caminho, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${caminho}`);
  return res.json();
}

function calcularTempoEstimadoMs(secoes) {
  let palavras = 0;
  for (const s of secoes) {
    for (const p of s.texto) palavras += p.split(/\s+/).filter(Boolean).length;
  }
  const minutos = (palavras / 200) * 1.3;
  return Math.max(60_000, minutos * 60_000);
}

const TIPOS_AUTO = ['multipla_escolha', 'predicao', 'calculo_guiado', 'verdadeiro_falso', 'associacao', 'ordenacao'];
const LETRAS = ['a', 'b', 'c', 'd', 'e', 'f'];

function sortearQuestoes(banco, total) {
  const auto = banco.filter(q => TIPOS_AUTO.includes(q.tipo));
  const porDif = { facil: [], medio: [], desafio: [] };
  auto.forEach(q => porDif[q.dificuldade]?.push(q));
  Object.values(porDif).forEach(a => {
    const shuffled = shuffle(a);
    a.length = 0;
    a.push(...shuffled);
  });

  const quotas = {
    facil: Math.min(5, porDif.facil.length),
    medio: Math.min(4, porDif.medio.length),
    desafio: Math.min(1, porDif.desafio.length)
  };
  const escolhidas = [];
  for (const [dif, qtd] of Object.entries(quotas)) {
    escolhidas.push(...porDif[dif].slice(0, qtd));
  }
  if (escolhidas.length < total) {
    const usadas = new Set(escolhidas.map(q => q.id));
    const restantes = shuffle(auto.filter(q => !usadas.has(q.id)));
    while (escolhidas.length < total && restantes.length) escolhidas.push(restantes.pop());
  }
  return shuffle(escolhidas.slice(0, total));
}

/**
 * Embaralha alternativas e ajusta:
 * - `correta` para o novo índice
 * - `explicacao` para que referências "(a)", "(b)" etc. apontem para a nova posição
 * Também embaralha associação (colunaB) e ordenação (itens) para evitar triviais.
 */
function embaralharQuestao(q) {
  if (['multipla_escolha', 'predicao', 'calculo_guiado'].includes(q.tipo)) {
    const n = q.alternativas.length;
    const idx = q.alternativas.map((_, i) => i);
    const shuffled = shuffle(idx);
    // mapa[orig] = nova posição
    const mapa = {};
    shuffled.forEach((orig, nova) => { mapa[orig] = nova; });

    let explicacao = q.explicacao || '';
    explicacao = explicacao.replace(/\(([a-fA-F])\)/g, (match, letra) => {
      const origIdx = LETRAS.indexOf(letra.toLowerCase());
      if (origIdx < 0 || origIdx >= n) return match;
      const novaIdx = mapa[origIdx];
      return `(${LETRAS[novaIdx]})`;
    });

    return {
      ...q,
      alternativas: shuffled.map(i => q.alternativas[i]),
      correta: shuffled.indexOf(q.correta),
      explicacao
    };
  }

  if (q.tipo === 'associacao') {
    const idxB = q.colunaB.map((_, i) => i);
    const shuffledB = shuffle(idxB);
    const novaCorreta = q.correta.map(origIdx => shuffledB.indexOf(origIdx));
    return {
      ...q,
      colunaB: shuffledB.map(i => q.colunaB[i]),
      correta: novaCorreta
    };
  }

  if (q.tipo === 'ordenacao') {
    const idx = q.itens.map((_, i) => i);
    const shuffled = shuffle(idx);
    // Para cada item exibido (na posição nova i), qual é a posição correta (0-based)?
    const novaCorreta = shuffled.map(origIdx => q.correta.indexOf(q.itens[origIdx]));
    return {
      ...q,
      itens: shuffled.map(i => q.itens[i]),
      correta: novaCorreta
    };
  }

  return q;
}

const HISTORICO_MAX = 200;

/** Estatística por questão: tentativas, acertos, último resultado e data. Alimenta a página de desempenho. */
function registrarRespostaQuestao(dados, q, trilha, acertou) {
  if (!dados.questoes || typeof dados.questoes !== 'object') dados.questoes = {};
  const e = dados.questoes[q.id] || { trilha, subtema: q.subtema || '', tentativas: 0, acertos: 0 };
  e.tentativas++;
  if (acertou) e.acertos++;
  e.ultimoAcerto = acertou;
  e.em = new Date().toISOString();
  dados.questoes[q.id] = e;
}

function registrarTentativaQuiz(dados, { trilha, acertos, total, tentativa }) {
  if (!Array.isArray(dados.historico)) dados.historico = [];
  dados.historico.push({ trilha, acertos, total, tentativa, em: new Date().toISOString() });
  if (dados.historico.length > HISTORICO_MAX) dados.historico.splice(0, dados.historico.length - HISTORICO_MAX);
}

export async function renderTrilha(id, dados, salvarDados) {
  cleanupTrilha();
  const myToken = trilhaToken;

  const conteudo = document.querySelector('#conteudo');
  conteudo.innerHTML = '<section class="card"><p>Carregando…</p></section>';

  let trilha, banco;
  try {
    [trilha, banco] = await Promise.all([
      carregarJSON(`dados/trilha-${id}.json`),
      carregarJSON(`dados/questoes-trilha-${id}.json`)
    ]);
  } catch (e) {
    if (myToken !== trilhaToken) return;
    conteudo.innerHTML = `
      <section class="card">
        <h2 class="erro-carregamento">Não foi possível carregar a trilha</h2>
        <p>Verifique se você está rodando o app a partir de um servidor local
        (por exemplo, <code>python -m http.server</code>) — abrir o arquivo
        direto com <code>file://</code> bloqueia o carregamento dos dados.</p>
        <p style="color:var(--texto-fraco);font-size:0.9rem">Detalhe técnico: ${esc(e.message)}</p>
        <a href="#trilhas" class="btn btn-secundario">Voltar</a>
      </section>`;
    return;
  }

  if (myToken !== trilhaToken) return;

  const estado = {
    fase: 'leitura',
    tempoLeituraVisivelMs: 0,
    ultimaVisibilidadeMs: document.hidden ? null : Date.now(),
    chegouAoFim: false,
    tempoEstimadoMs: calcularTempoEstimadoMs(trilha.secoes),
    compreensaoRespostas: [],
    tentativasQuiz: (dados.trilhas?.[id]?.tentativasQuiz || 0) + 1,
    questoesQuiz: [],
    indiceQuestao: 0,
    respostasQuiz: [],
    inicioQuestaoMs: 0
  };

  let cleanupFaseAtual = null;
  const registrarCleanup = (fn) => {
    if (cleanupFaseAtual) { try { cleanupFaseAtual(); } catch (_) {} }
    cleanupFaseAtual = fn;
  };

  function pausarTimerLeitura() {
    if (estado.ultimaVisibilidadeMs !== null && estado.fase === 'leitura') {
      estado.tempoLeituraVisivelMs += Date.now() - estado.ultimaVisibilidadeMs;
      estado.ultimaVisibilidadeMs = null;
    }
  }
  function retomarTimerLeitura() {
    if (estado.fase === 'leitura' && estado.ultimaVisibilidadeMs === null) {
      estado.ultimaVisibilidadeMs = Date.now();
    }
  }

  const onVisibilidade = () => {
    if (document.hidden) {
      pausarTimerLeitura();
      if (estado.fase === 'quiz') {
        dados.flags = dados.flags || [];
        dados.flags.push({ tipo: 'troca_aba_quiz', quando: new Date().toISOString(), trilha: id });
        salvarDados();
      }
    } else {
      retomarTimerLeitura();
    }
  };
  document.addEventListener('visibilitychange', onVisibilidade);

  const onBeforeUnload = (e) => {
    if (estado.fase === 'quiz' || estado.fase === 'compreensao') {
      e.preventDefault();
      e.returnValue = 'Você tem certeza? Seu progresso na atividade atual pode ser perdido.';
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  cleanupAtual = () => {
    if (cleanupFaseAtual) { try { cleanupFaseAtual(); } catch (_) {} cleanupFaseAtual = null; }
    document.removeEventListener('visibilitychange', onVisibilidade);
    window.removeEventListener('beforeunload', onBeforeUnload);
    pausarTimerLeitura();
  };

  function renderLeitura() {
    estado.fase = 'leitura';
    estado.chegouAoFim = false;
    if (estado.ultimaVisibilidadeMs === null) estado.ultimaVisibilidadeMs = Date.now();

    const totalMin = (estado.tempoEstimadoMs / 60_000).toFixed(1);
    conteudo.innerHTML = `
      <div class="progresso-leitura" aria-hidden="true">
        <div class="progresso-leitura-fill" id="prog-leitura"></div>
      </div>
      <section class="card">
        <h2>${esc(trilha.titulo)}</h2>
        <p style="color:var(--texto-fraco)">${esc(trilha.subtitulo || '')}</p>
        <div class="meta-leitura">
          <span>⏱ Tempo estimado: ~${totalMin} min</span>
          <span>📖 ${trilha.secoes.length} seções</span>
        </div>
        <p>Leia com calma. Ao terminar, você responderá <strong>3 perguntas de compreensão</strong> e depois um <strong>quiz de 10 questões</strong>.</p>
      </section>
      ${trilha.secoes.map((s, i) => `
        <section class="card secao-leitura" data-secao="${esc(s.id)}">
          <h3>${i + 1}. ${esc(s.titulo)}</h3>
          ${s.texto.map(p => `<p>${esc(p)}</p>`).join('')}
        </section>
      `).join('')}
      <section class="card">
        <p id="msg-leitura" role="status" aria-live="polite" style="color:var(--texto-fraco)"></p>
        <div class="btn-grupo">
          <button class="btn" id="btn-ir-compreensao">Ir para as perguntas</button>
        </div>
      </section>
    `;

    const prog = document.getElementById('prog-leitura');
    const atualizarProg = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100;
      if (prog) prog.style.width = pct + '%';
      if (pct >= 95) {
        estado.chegouAoFim = true;
        atualizarMensagemLeitura();
      }
    };
    window.addEventListener('scroll', atualizarProg, { passive: true });
    setTimeout(atualizarProg, 100);

    const observer = new IntersectionObserver((entries) => { void entries; }, { threshold: 0.4 });
    conteudo.querySelectorAll('[data-secao]').forEach(el => observer.observe(el));

    function atualizarMensagemLeitura() {
      const msg = document.getElementById('msg-leitura');
      if (!msg) return;
      const decorrido = estado.tempoLeituraVisivelMs + (estado.ultimaVisibilidadeMs ? Date.now() - estado.ultimaVisibilidadeMs : 0);
      const minDecorrido = Math.floor(decorrido / 60_000);
      const minNecessario = Math.ceil((estado.tempoEstimadoMs * 0.6) / 60_000);
      if (estado.chegouAoFim && minDecorrido >= minNecessario) {
        msg.textContent = `✓ Leitura concluída em ${formatarDuracao(decorrido)}.`;
        msg.style.color = 'var(--sucesso)';
      } else if (!estado.chegouAoFim) {
        msg.textContent = 'Role até o fim do texto para continuar.';
        msg.style.color = 'var(--texto-fraco)';
      } else {
        msg.textContent = `Continue lendo mais um pouco (${minDecorrido}/${minNecessario} min).`;
        msg.style.color = 'var(--ambar)';
      }
    }

    const interval = setInterval(atualizarMensagemLeitura, 5000);
    atualizarMensagemLeitura();

    registrarCleanup(() => {
      window.removeEventListener('scroll', atualizarProg);
      observer.disconnect();
      clearInterval(interval);
    });

    document.getElementById('btn-ir-compreensao').addEventListener('click', () => {
      iniciarCompreensao();
    });
  }

  function iniciarCompreensao() {
    pausarTimerLeitura();
    estado.fase = 'compreensao';
    estado.compreensaoRespostas = [];
    renderCompreensao(0);
  }

  function renderCompreensao(indice) {
    registrarCleanup(() => {});
    const perguntas = trilha.perguntasCompreensao;
    if (indice >= perguntas.length) { finalizarCompreensao(); return; }
    const p = perguntas[indice];
    const total = perguntas.length;
    conteudo.innerHTML = `
      <section class="card">
        <div class="quiz-header">
          <span>Compreensão ${indice + 1} de ${total}</span>
        </div>
        <div class="quiz-progresso-barra"><div style="width:${(indice / total) * 100}%"></div></div>
        <h3>${esc(p.pergunta)}</h3>
        <div id="alternativas"></div>
        <div id="feedback-compreensao"></div>
      </section>
    `;
    const alts = document.getElementById('alternativas');
    p.alternativas.forEach((txt, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'alternativa';
      btn.textContent = txt;
      btn.addEventListener('click', () => responderCompreensao(indice, i));
      alts.appendChild(btn);
    });
  }

  function responderCompreensao(indice, escolha) {
    const p = trilha.perguntasCompreensao[indice];
    const acertou = escolha === p.correta;
    estado.compreensaoRespostas.push({ id: p.id, escolha, correta: p.correta, acertou });

    const botoes = document.querySelectorAll('#alternativas .alternativa');
    botoes.forEach((b, i) => {
      b.disabled = true;
      if (i === p.correta) b.classList.add('correta');
      else if (i === escolha) b.classList.add('incorreta');
    });

    const fb = document.getElementById('feedback-compreensao');
    fb.innerHTML = `
      <div class="feedback ${acertou ? 'ok' : 'erro'}">
        <strong>${acertou ? '✓ Correto!' : '✗ Não foi essa.'}</strong>
        <p style="margin-top:6px">${esc(p.explicacao)}</p>
      </div>
      <div class="btn-grupo">
        <button class="btn" id="btn-proxima-comp">${indice + 1 < trilha.perguntasCompreensao.length ? 'Próxima' : 'Continuar'}</button>
      </div>
    `;
    document.getElementById('btn-proxima-comp').addEventListener('click', () => {
      renderCompreensao(indice + 1);
    });
  }

  function finalizarCompreensao() {
    registrarCleanup(() => {});
    const acertos = estado.compreensaoRespostas.filter(r => r.acertou).length;
    const total = trilha.perguntasCompreensao.length;
    const passou = acertos >= Math.ceil(total * 2 / 3);

    if (!passou) {
      conteudo.innerHTML = `
        <section class="card resultado-hero">
          <span class="emoji">📖</span>
          <h2>Vamos revisar?</h2>
          <p>Você acertou <strong>${acertos} de ${total}</strong> perguntas de compreensão. Para seguir, precisamos de ao menos ${Math.ceil(total * 2 / 3)} acertos.</p>
          <p style="color:var(--texto-fraco)">Volte ao texto e leia com calma — as perguntas cobram os conceitos principais.</p>
          <div class="btn-grupo" style="justify-content:center">
            <button class="btn btn-secundario" id="btn-reler">Reler o texto</button>
          </div>
        </section>`;
      document.getElementById('btn-reler').addEventListener('click', () => {
        window.scrollTo(0, 0);
        renderLeitura();
      });
      return;
    }

    if (!dados.trilhas) dados.trilhas = {};
    if (!dados.trilhas[id]) dados.trilhas[id] = {};
    dados.trilhas[id].compreensao = { acertos, total };
    salvarDados();
    iniciarQuiz();
  }

  function iniciarQuiz() {
    estado.fase = 'quiz';
    estado.questoesQuiz = sortearQuestoes(banco.questoes, 10).map(embaralharQuestao);
    estado.indiceQuestao = 0;
    estado.respostasQuiz = [];
    estado.inicioQuestaoMs = Date.now();
    renderQuestao();
  }

  function renderQuestao() {
    registrarCleanup(() => {});
    if (estado.indiceQuestao >= estado.questoesQuiz.length) { finalizarQuiz(); return; }
    const q = estado.questoesQuiz[estado.indiceQuestao];
    const total = estado.questoesQuiz.length;
    const idx = estado.indiceQuestao;
    estado.inicioQuestaoMs = Date.now();

    const header = `
      <div class="quiz-header">
        <span>Questão ${idx + 1} de ${total}</span>
        <span style="color:var(--texto-fraco);font-size:0.85rem">${esc(q.subtema || '')}</span>
      </div>
      <div class="quiz-progresso-barra"><div style="width:${(idx / total) * 100}%"></div></div>
    `;

    let corpo = `<h3>${esc(q.enunciado)}</h3>`;

    if (['multipla_escolha', 'predicao', 'calculo_guiado', 'verdadeiro_falso'].includes(q.tipo)) {
      corpo += `<div id="alt-container"></div>`;
    } else if (q.tipo === 'associacao') {
      corpo += `<div id="assoc-container">
        ${q.colunaA.map((item, i) => `
          <div class="assoc-item">
            <label for="assoc-${i}">${esc(item)}</label>
            <select id="assoc-${i}" data-i="${i}">
              <option value="">— selecione —</option>
              ${q.colunaB.map((op, j) => `<option value="${j}">${esc(op)}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>
      <div class="btn-grupo"><button class="btn" id="btn-responder-assoc">Responder</button></div>`;
    } else if (q.tipo === 'ordenacao') {
      corpo += `<p style="color:var(--texto-fraco);font-size:0.95rem">Atribua a posição de cada item (1 = primeiro).</p>
        <div id="ord-container">
        ${q.itens.map((item, i) => `
          <div class="ord-item">
            <span>${esc(item)}</span>
            <select data-i="${i}" class="ord-select">
              ${q.itens.map((_, j) => `<option value="${j + 1}">${j + 1}º</option>`).join('')}
            </select>
          </div>`).join('')}
        </div>
        <div class="btn-grupo"><button class="btn" id="btn-responder-ord">Responder</button></div>`;
    } else {
      corpo += `<p>Formato não suportado.</p>`;
    }

    conteudo.innerHTML = `
      <section class="card">
        ${header}
        ${corpo}
        <div id="feedback-quiz"></div>
      </section>
    `;

    if (['multipla_escolha', 'predicao', 'calculo_guiado'].includes(q.tipo)) {
      const alts = document.getElementById('alt-container');
      q.alternativas.forEach((txt, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'alternativa';
        const letra = LETRAS[i].toUpperCase();
        b.innerHTML = `<strong>${letra})</strong> ${esc(txt)}`;
        b.addEventListener('click', () => responderQuiz('mc', i));
        alts.appendChild(b);
      });
    } else if (q.tipo === 'verdadeiro_falso') {
      const alts = document.getElementById('alt-container');
      [['Verdadeiro', true], ['Falso', false]].forEach(([txt, val]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'alternativa';
        b.textContent = txt;
        b.addEventListener('click', () => responderQuiz('vf', val));
        alts.appendChild(b);
      });
    } else if (q.tipo === 'associacao') {
      document.getElementById('btn-responder-assoc').addEventListener('click', () => {
        const selects = document.querySelectorAll('#assoc-container select');
        const resposta = Array.from(selects).map(s => s.value === '' ? -1 : parseInt(s.value, 10));
        if (resposta.some(v => v < 0)) { alert('Selecione uma opção para cada item.'); return; }
        responderQuiz('assoc', resposta);
      });
    } else if (q.tipo === 'ordenacao') {
      document.getElementById('btn-responder-ord').addEventListener('click', () => {
        const selects = document.querySelectorAll('#ord-container select');
        const ordem = Array.from(selects).map(s => parseInt(s.value, 10) - 1);
        if (new Set(ordem).size !== ordem.length) { alert('Cada item precisa de uma posição diferente.'); return; }
        responderQuiz('ord', ordem);
      });
    }
  }

  function verificarResposta(q, tipo, resposta) {
    if (tipo === 'mc') return resposta === q.correta;
    if (tipo === 'vf') return resposta === q.correta;
    if (tipo === 'assoc') {
      if (!Array.isArray(resposta) || resposta.length !== q.correta.length) return false;
      return resposta.every((v, i) => v === q.correta[i]);
    }
    if (tipo === 'ord') {
      if (!Array.isArray(resposta) || resposta.length !== q.itens.length) return false;
      return resposta.every((pos, i) => pos === q.correta[i]);
    }
    return false;
  }

  function responderQuiz(tipo, resposta) {
    const q = estado.questoesQuiz[estado.indiceQuestao];
    const acertou = verificarResposta(q, tipo, resposta);
    const tempoMs = Date.now() - estado.inicioQuestaoMs;
    estado.respostasQuiz.push({ id: q.id, acertou, tempoMs, tipo });
    registrarRespostaQuestao(dados, q, id, acertou);

    if (tempoMs < 4000) {
      dados.flags = dados.flags || [];
      dados.flags.push({ tipo: 'resposta_rapida', quando: new Date().toISOString(), questao: q.id, tempoMs });
      salvarDados();
    }

    document.querySelectorAll('.alternativa').forEach(b => b.disabled = true);
    document.querySelectorAll('#assoc-container select, #ord-container select').forEach(s => s.disabled = true);
    const btnR = document.getElementById('btn-responder-assoc') || document.getElementById('btn-responder-ord');
    if (btnR) btnR.disabled = true;

    if (tipo === 'mc') {
      document.querySelectorAll('#alt-container .alternativa').forEach((b, i) => {
        if (i === q.correta) b.classList.add('correta');
        else if (i === resposta) b.classList.add('incorreta');
      });
    } else if (tipo === 'vf') {
      const corretaIdx = q.correta ? 0 : 1;
      const escolhaIdx = resposta ? 0 : 1;
      document.querySelectorAll('#alt-container .alternativa').forEach((b, i) => {
        if (i === corretaIdx) b.classList.add('correta');
        else if (i === escolhaIdx) b.classList.add('incorreta');
      });
    }

    const primeiraTentativa = estado.tentativasQuiz === 1;
    const profMode = estaEmModoProfessor();
    const mostrarExplicacao = !primeiraTentativa || profMode || acertou;
    const explicacao = mostrarExplicacao
      ? `<p style="margin-top:6px">${esc(q.explicacao || '')}</p>`
      : `<p style="margin-top:6px;color:var(--texto-fraco)">Conceito a revisar: <strong>${esc(q.subtema || '')}</strong>. A explicação completa aparece no final do quiz.</p>`;

    const feedback = document.getElementById('feedback-quiz');
    feedback.innerHTML = `
      <div class="feedback ${acertou ? 'ok' : 'erro'}">
        <strong>${acertou ? '✓ Correto!' : '✗ Não foi essa.'}</strong>
        ${explicacao}
      </div>
      <div class="btn-grupo">
        <button class="btn" id="btn-proxima-q">${estado.indiceQuestao + 1 < estado.questoesQuiz.length ? 'Próxima' : 'Ver resultado'}</button>
      </div>
    `;
    document.getElementById('btn-proxima-q').addEventListener('click', () => {
      estado.indiceQuestao++;
      renderQuestao();
    });
  }

  function finalizarQuiz() {
    pausarTimerLeitura();
    estado.fase = 'resultado';
    registrarCleanup(() => {});

    const total = estado.questoesQuiz.length;
    const acertos = estado.respostasQuiz.filter(r => r.acertou).length;
    const pct = (acertos / total) * 100;
    const passou = acertos >= Math.ceil(total * 0.8);

    const multiplicador = estado.tentativasQuiz === 1 ? 1 : (estado.tentativasQuiz === 2 ? 0.5 : 0.25);
    const tempoMinimoLeitura = estado.tempoEstimadoMs * 0.3;
    const leuCompleto = estado.chegouAoFim && estado.tempoLeituraVisivelMs >= tempoMinimoLeitura;
    let xpBase = leuCompleto ? 20 : (estado.chegouAoFim ? 10 : 5);
    xpBase += estado.compreensaoRespostas.filter(r => r.acertou).length * 5;
    xpBase += acertos * 10;
    if (passou) xpBase += 20;
    const xpGanho = Math.round(xpBase * multiplicador);

    if (!dados.trilhas) dados.trilhas = {};
    if (!dados.trilhas[id]) dados.trilhas[id] = {};
    const t = dados.trilhas[id];

    // ⚠️ XP: só conta a MELHOR tentativa. Refazer pior não reduz; refazer melhor soma a diferença.
    const xpAnterior = t.xpTotalGanho || 0;
    const xpNovo = Math.max(xpAnterior, xpGanho);
    const xpDelta = xpNovo - xpAnterior;
    t.xpTotalGanho = xpNovo;

    t.tentativasQuiz = estado.tentativasQuiz;

    // Guarda o MELHOR quiz, não o último
    if (!t.quiz || xpGanho > (t.quiz.xpGanho || 0)) {
      t.quiz = { acertos, total, pct, passou, xpGanho, em: new Date().toISOString() };
    }

    // ⚠️ Uma vez concluída, nunca volta atrás
    if (passou) {
      t.concluida = true;
      t.concluidaEm = t.concluidaEm || new Date().toISOString();
    }

    dados.xp = (dados.xp || 0) + xpDelta;
    registrarTentativaQuiz(dados, { trilha: id, acertos, total, tentativa: estado.tentativasQuiz });
    salvarDados();

    const emoji = passou ? '🎉' : (t.concluida ? '💪' : '💡');
    const titulo = passou ? 'Trilha concluída!' : (t.concluida ? 'Boa tentativa!' : 'Quase lá!');
    const subtitulo = passou
      ? 'Você dominou os conceitos principais desta trilha.'
      : (t.concluida
          ? `Você já concluiu esta trilha antes. Esta tentativa deu ${acertos}/${total} — mas a conclusão anterior está preservada.`
          : `Você acertou ${acertos} de ${total}. Para concluir, precisamos de ${Math.ceil(total * 0.8)} acertos.`);

    const xpHtml = xpDelta > 0
      ? `<div class="resultado-xp">+${xpDelta} XP</div>`
      : `<div class="resultado-xp sem-ganho">0 XP nesta tentativa<br><small>Você já tinha ${xpAnterior} XP nesta trilha</small></div>`;

    const revisaoHtml = estado.questoesQuiz.map((q, i) => {
      const r = estado.respostasQuiz[i];
      return `
        <div class="revisao-item ${r.acertou ? 'ok' : 'erro'}">
          <div class="topo-revisao">
            <span>${r.acertou ? '✓' : '✗'} Questão ${i + 1} · ${esc(q.subtema || '')}</span>
            <span>${formatarDuracao(r.tempoMs)}</span>
          </div>
          <p style="font-size:0.95rem">${esc(q.enunciado)}</p>
          <p style="margin-top:8px;font-size:0.95rem;color:var(--texto-fraco)"><strong>Explicação:</strong> ${esc(q.explicacao || '')}</p>
        </div>`;
    }).join('');

    conteudo.innerHTML = `
      <section class="card resultado-hero">
        <span class="emoji">${emoji}</span>
        <h2>${titulo}</h2>
        <div class="pontuacao">${acertos}/${total} (${pct.toFixed(0)}%)</div>
        <p>${subtitulo}</p>
        ${xpHtml}
        <div class="btn-grupo" style="justify-content:center;margin-top:var(--esp-3)">
          <a href="#trilhas" class="btn">Voltar às trilhas</a>
          <button class="btn btn-secundario" id="btn-refazer">Refazer o quiz</button>
        </div>
      </section>
      <section class="card">
        <h3>Revisão das questões</h3>
        <p style="color:var(--texto-fraco);font-size:0.95rem">Leia com calma as explicações abaixo — elas ajudam a fixar o conteúdo.</p>
        ${revisaoHtml}
      </section>
    `;

    document.getElementById('btn-refazer').addEventListener('click', () => {
      window.scrollTo(0, 0);
      renderTrilha(id, dados, salvarDados);
    });

    window.scrollTo(0, 0);
  }

  renderLeitura();
}