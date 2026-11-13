import { esc, formatarDuracao } from '../utils.js';
import { avisar } from '../dialogos.js';
import { nomeSubtema } from '../conteudo.js';
import * as fx from '../fx.js';
import { nivel } from '../progresso.js';
import { formatarTexto } from '../quiz.js';
import { registrarTentativaQuiz } from '../registro.js';
import { iniciarSessao } from '../treino.js';
import { pausarTimerLeitura } from './leitura.js';

export function finalizarQuiz(ctx) {
  const { id, dados, salvarDados, estado, conteudo, registrarCleanup, ir } = ctx;
  pausarTimerLeitura(estado);
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

  const nivelAntes = nivel(dados.xp || 0).nivel;
  dados.xp = (dados.xp || 0) + xpDelta;
  const nivelDepois = nivel(dados.xp).nivel;
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

  const erradas = estado.questoesQuiz.filter((_, i) => !estado.respostasQuiz[i].acertou);
  const revisaoHtml = estado.questoesQuiz.map((q, i) => {
    const r = estado.respostasQuiz[i];
    return `
      <div class="revisao-item ${r.acertou ? 'ok' : 'erro'}">
        <div class="topo-revisao">
          <span>${r.acertou ? '✓' : '✗'} Questão ${i + 1} · ${esc(nomeSubtema(q.subtema))}</span>
          <span>${formatarDuracao(r.tempoMs)}</span>
        </div>
        <p style="font-size:0.95rem">${formatarTexto(q.enunciado)}</p>
        <p style="margin-top:8px;font-size:0.95rem;color:var(--texto-fraco)"><strong>Explicação:</strong> ${formatarTexto(q.explicacao || '')}</p>
      </div>`;
  }).join('');

  conteudo.innerHTML = `
    <section class="card resultado-hero${passou ? ' passou' : ''}">
      <span class="emoji">${emoji}</span>
      <h2>${titulo}</h2>
      <div class="pontuacao">${acertos}/${total} (${pct.toFixed(0)}%)</div>
      <p>${subtitulo}</p>
      ${xpHtml}
      <div class="btn-grupo" style="justify-content:center;margin-top:var(--esp-3)">
        <a href="#trilhas" class="btn">Voltar às trilhas</a>
        ${erradas.length ? `<button class="btn btn-secundario" id="btn-rever-erros">🔎 Rever só as ${erradas.length} que errei</button>` : ''}
        <button class="btn btn-secundario" id="btn-refazer">Refazer o quiz</button>
        <button class="btn btn-secundario" id="btn-reler-texto">Reler o texto</button>
      </div>
    </section>
    <section class="card">
      <h3>Revisão das questões</h3>
      <p style="color:var(--texto-fraco);font-size:0.95rem">Leia com calma as explicações abaixo — elas ajudam a fixar o conteúdo.</p>
      ${revisaoHtml}
    </section>
  `;

  // Refazer vai direto ao quiz (a compreensão já foi aprovada); a nova tentativa conta para o XP.
  document.getElementById('btn-refazer').addEventListener('click', () => {
    window.scrollTo(0, 0);
    estado.tentativasQuiz++;
    ir.quiz();
  });
  document.getElementById('btn-rever-erros')?.addEventListener('click', () => {
    window.scrollTo(0, 0);
    iniciarSessao(conteudo, dados, salvarDados, erradas.map(q => ({ ...q, trilha: id })), {
      titulo: 'Revendo os erros', modo: 'revisao', aoTerminar: ir.reiniciar
    });
  });
  document.getElementById('btn-reler-texto').addEventListener('click', () => {
    window.scrollTo(0, 0);
    ir.reiniciar();
  });

  window.scrollTo(0, 0);

  if (passou) { fx.confete(); fx.vitoria(); }
  if (xpDelta > 0) fx.xpFlutuante(document.getElementById('xp-total'), xpDelta);
  if (nivelDepois > nivelAntes) {
    setTimeout(() => avisar(`⬆️ Você subiu para o nível ${nivelDepois}!`, 'ok', 5000), 600);
  }
}
