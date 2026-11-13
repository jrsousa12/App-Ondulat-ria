import { esc, shuffle } from '../utils.js';
import { estaEmModoProfessor } from '../modo-professor.js';
import { nomeSubtema } from '../conteudo.js';
import { etapas } from '../ui.js';
import * as fx from '../fx.js';
import { TIPOS_AUTO, embaralharQuestao, htmlPergunta, ligarResposta, verificarResposta, marcarResposta, formatarTexto } from '../quiz.js';
import { registrarResposta } from '../registro.js';
import { finalizarQuiz } from './resultado.js';

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

export function iniciarQuiz(ctx) {
  const { estado, banco } = ctx;
  estado.fase = 'quiz';
  estado.questoesQuiz = sortearQuestoes(banco.questoes, 10).map(embaralharQuestao);
  estado.indiceQuestao = 0;
  estado.respostasQuiz = [];
  estado.inicioQuestaoMs = Date.now();
  renderQuestao(ctx);
}

function renderQuestao(ctx) {
  const { estado, conteudo, registrarCleanup } = ctx;
  registrarCleanup(() => {});
  if (estado.indiceQuestao >= estado.questoesQuiz.length) { finalizarQuiz(ctx); return; }
  const q = estado.questoesQuiz[estado.indiceQuestao];
  const total = estado.questoesQuiz.length;
  const idx = estado.indiceQuestao;
  estado.inicioQuestaoMs = Date.now();

  const header = `
    ${etapas(2, 2)}
    <div class="quiz-header">
      <span>Questão ${idx + 1} de ${total}</span>
      <span class="quiz-conceito">${esc(nomeSubtema(q.subtema))}</span>
    </div>
    <div class="quiz-progresso-barra"><div style="width:${(idx / total) * 100}%"></div></div>
  `;

  conteudo.innerHTML = `
    ${header}
    <section class="card card-pergunta">
      ${htmlPergunta(q)}
      <div id="feedback-quiz"></div>
    </section>
  `;
  ligarResposta(conteudo, q, (tipo, resposta) => responderQuiz(ctx, tipo, resposta));
}

function responderQuiz(ctx, tipo, resposta) {
  const { id, dados, salvarDados, estado, conteudo } = ctx;
  const q = estado.questoesQuiz[estado.indiceQuestao];
  const acertou = verificarResposta(q, tipo, resposta);
  const tempoMs = Date.now() - estado.inicioQuestaoMs;
  estado.respostasQuiz.push({ id: q.id, acertou, tempoMs, tipo });
  const caderno = registrarResposta(dados, q, id, acertou);

  if (tempoMs < 4000) {
    dados.flags = dados.flags || [];
    dados.flags.push({ tipo: 'resposta_rapida', quando: new Date().toISOString(), questao: q.id, tempoMs });
    salvarDados();
  }

  marcarResposta(conteudo, q, tipo, resposta);

  if (acertou) fx.acerto(); else fx.erro();
  const primeiraTentativa = estado.tentativasQuiz === 1;
  const profMode = estaEmModoProfessor();
  const mostrarExplicacao = !primeiraTentativa || profMode || acertou;
  const explicacao = mostrarExplicacao
    ? `<p style="margin-top:6px">${formatarTexto(q.explicacao || '')}</p>`
    : `<p style="margin-top:6px;color:var(--texto-fraco)">Conceito a revisar: <strong>${esc(nomeSubtema(q.subtema))}</strong>. A explicação completa aparece no final do quiz.</p>`;

  const feedback = document.getElementById('feedback-quiz');
  feedback.innerHTML = `
    <div class="feedback ${acertou ? 'ok' : 'erro'}">
      <strong>${acertou ? '✓ Correto!' : '✗ Não foi essa.'}</strong>
      ${explicacao}
      ${caderno === 'entrou' ? '<p class="feedback-caderno">📒 Guardada no seu caderno de erros para treinar depois.</p>' : ''}
      ${caderno === 'saiu' ? '<p class="feedback-caderno">🎉 Saiu do caderno de erros: 2 acertos seguidos!</p>' : ''}
    </div>
    <div class="btn-grupo">
      <button class="btn" id="btn-proxima-q">${estado.indiceQuestao + 1 < estado.questoesQuiz.length ? 'Próxima' : 'Ver resultado'}</button>
    </div>
  `;
  document.getElementById('btn-proxima-q').addEventListener('click', () => {
    estado.indiceQuestao++;
    renderQuestao(ctx);
  });
}
