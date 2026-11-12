/* Treino: adaptativo, caderno de erros, desafio cronometrado e revisão dos erros. */
import { esc, shuffle, hojeLocal } from './utils.js';
import { TRILHAS, carregarJSON, nomeSubtema, trilhaPorId } from './conteudo.js';
import { TIPOS_AUTO, embaralharQuestao, htmlPergunta, ligarResposta, verificarResposta, marcarResposta, formatarTexto, comentarioDoErro } from './quiz.js';
import { registrarResposta, totalNoCaderno, ACERTOS_PARA_SAIR_DO_CADERNO } from './registro.js';
import { trilhaLiberada } from './progresso.js';
import { confirmar } from './dialogos.js';
import { esqueleto, ICONES } from './ui.js';
import * as fx from './fx.js';

const TAMANHO_SESSAO = 10;
const SEGUNDOS_POR_QUESTAO = 20;
const XP_POR_ACERTO = 2;
const XP_TREINO_POR_DIA = 40;
const K_APROF = 'ondulatoria_aprofundamento';

function lerAprofundamento() { try { return localStorage.getItem(K_APROF) === '1'; } catch (_) { return false; } }
function gravarAprofundamento(v) { try { localStorage.setItem(K_APROF, v ? '1' : '0'); } catch (_) {} }

/** Todas as questões objetivas: as das trilhas e as extras (Plataforma de Física). */
export async function carregarBancoCompleto() {
  const bancos = await Promise.all(TRILHAS.map(t => carregarJSON(`dados/questoes-trilha-${t.id}.json`)));
  const todas = [];
  bancos.forEach((b, i) => {
    for (const q of b.questoes) if (TIPOS_AUTO.includes(q.tipo)) todas.push({ ...q, trilha: TRILHAS[i].id, nivel: 'basico' });
  });
  try {
    const extra = await carregarJSON('dados/questoes-extra.json');
    for (const q of extra.questoes) todas.push({ ...q, trilha: String(q.trilha), extra: true });
  } catch (e) {
    console.warn('[treino] banco extra indisponível:', e.message);
  }
  return todas;
}

/** Peso de cada questão no sorteio adaptativo (mais peso = aparece mais). */
function peso(dados, q) {
  if (dados.cadernoErros?.[q.id]) return 6;
  const e = dados.questoes?.[q.id];
  if (!e || !e.tentativas) return 3;
  const taxaErro = 1 - e.acertos / e.tentativas;
  const dias = e.em ? (Date.now() - Date.parse(e.em)) / 864e5 : 30;
  const dominada = e.ultimoAcerto && e.acertos >= 2 && taxaErro <= 0.2;
  return (dominada ? 0.4 : 1 + 4 * taxaErro) + Math.min(2, dias / 7);
}

function sortearPonderado(lista, n, pesoDe) {
  const pool = lista.map(q => ({ q, p: Math.max(0.01, pesoDe(q)) }));
  const saida = [];
  while (saida.length < n && pool.length) {
    let r = Math.random() * pool.reduce((s, x) => s + x.p, 0);
    const i = pool.findIndex(x => (r -= x.p) <= 0);
    saida.push(pool.splice(i < 0 ? pool.length - 1 : i, 1)[0].q);
  }
  return saida;
}

function disponiveis(dados, banco, { aprofundamento, semCalculo = false }) {
  return banco.filter(q => trilhaLiberada(dados, q.trilha)
    && (aprofundamento || q.nivel !== 'aprofundamento')
    && (!semCalculo || ['multipla_escolha', 'predicao', 'verdadeiro_falso'].includes(q.tipo)));
}

/** XP do treino: 2 por acerto, no máximo 40 por dia (o treino não vira "fábrica de XP"). */
function ganharXpTreino(dados, acertos) {
  const hoje = hojeLocal();
  if (!dados.treino || dados.treino.dia !== hoje) dados.treino = { ...(dados.treino || {}), dia: hoje, xp: 0 };
  const ganho = Math.max(0, Math.min(acertos * XP_POR_ACERTO, XP_TREINO_POR_DIA - dados.treino.xp));
  dados.treino.xp += ganho;
  dados.xp = (dados.xp || 0) + ganho;
  return ganho;
}

/**
 * Roda uma sessão de questões dentro de `container`.
 * opcoes: { titulo, modo: 'adaptativo'|'caderno'|'revisao'|'cronometrado', aoTerminar }
 */
export function iniciarSessao(container, dados, salvarDados, questoes, opcoes = {}) {
  const modo = opcoes.modo || 'adaptativo';
  const cronometrado = modo === 'cronometrado';
  const lista = questoes.map(embaralharQuestao);
  const respostas = [];
  let indice = 0;
  let timer = null;
  let encerrada = false;

  // Se o aluno sair da tela no meio, o cronômetro percebe (container fora da página) e para.
  const pararTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

  function render() {
    pararTimer();
    if (indice >= lista.length) { fim(); return; }
    const q = lista[indice];
    const t = trilhaPorId(q.trilha);
    container.innerHTML = `
      <div class="sessao" data-trilha="${esc(q.trilha)}">
        <div class="quiz-header">
          <span><strong>${esc(opcoes.titulo || 'Treino')}</strong> · ${indice + 1} de ${lista.length}</span>
          <button type="button" class="btn btn-secundario btn-pequeno" id="btn-sair-sessao">Sair</button>
        </div>
        <div class="quiz-progresso-barra"><div style="width:${(indice / lista.length) * 100}%"></div></div>
        ${cronometrado ? `<div class="cronometro" role="timer" aria-live="off"><div id="crono-barra"></div><span id="crono-seg">${SEGUNDOS_POR_QUESTAO}s</span></div>` : ''}
        <section class="card card-pergunta">
          <div class="sessao-chips">
            <span class="quiz-conceito">Trilha ${esc(q.trilha)} · ${esc(nomeSubtema(q.subtema))}</span>
            ${q.nivel === 'aprofundamento' ? '<span class="chip-aprof">Aprofundamento</span>' : ''}
            ${dados.cadernoErros?.[q.id] ? '<span class="chip-caderno">📒 Do seu caderno</span>' : ''}
          </div>
          ${htmlPergunta(q)}
          ${q.dica && !cronometrado ? '<button type="button" class="btn-dica" id="btn-dica">💡 Ver dica</button><p class="dica" id="dica" hidden></p>' : ''}
          <div id="feedback-quiz"></div>
        </section>
      </div>`;
    if (t) container.querySelector('.sessao').setAttribute('aria-label', t.titulo);
    ligarResposta(container, q, (tipo, resposta) => responder(q, tipo, resposta));
    container.querySelector('#btn-dica')?.addEventListener('click', e => {
      const p = container.querySelector('#dica');
      p.textContent = q.dica;
      p.hidden = false;
      e.currentTarget.remove();
    });
    container.querySelector('#btn-sair-sessao').addEventListener('click', async () => {
      if (await confirmar({ titulo: 'Sair do treino?', texto: 'As respostas já dadas ficam registradas.', ok: 'Sair' })) {
        encerrada = true;
        pararTimer();
        (opcoes.aoTerminar || (() => {}))();
      }
    });
    if (cronometrado) iniciarCronometro(q);
  }

  function iniciarCronometro(q) {
    const inicio = Date.now();
    const barra = container.querySelector('#crono-barra');
    const seg = container.querySelector('#crono-seg');
    timer = setInterval(() => {
      if (!container.isConnected || !container.querySelector('.sessao')) { pararTimer(); encerrada = true; return; }
      const resta = Math.max(0, SEGUNDOS_POR_QUESTAO - (Date.now() - inicio) / 1000);
      barra.style.width = `${(resta / SEGUNDOS_POR_QUESTAO) * 100}%`;
      barra.classList.toggle('acabando', resta < 6);
      seg.textContent = `${Math.ceil(resta)}s`;
      if (resta <= 0) { pararTimer(); responder(q, 'tempo', null); }
    }, 200);
  }

  function responder(q, tipo, resposta) {
    if (encerrada) return;
    pararTimer();
    const acertou = tipo !== 'tempo' && verificarResposta(q, tipo, resposta);
    respostas.push({ q, acertou });
    const caderno = registrarResposta(dados, q, q.trilha, acertou);
    salvarDados();
    if (tipo === 'tempo') {
      container.querySelectorAll('.alternativa, select, #btn-responder-assoc, #btn-responder-ord').forEach(b => { b.disabled = true; });
    } else {
      marcarResposta(container, q, tipo, resposta);
    }
    if (acertou) fx.acerto(); else fx.erro();
    container.querySelector('#btn-dica')?.remove();
    const comentario = tipo === 'tempo' ? null : comentarioDoErro(q, tipo, resposta);
    container.querySelector('#feedback-quiz').innerHTML = `
      <div class="feedback ${acertou ? 'ok' : 'erro'}">
        <strong>${acertou ? '✓ Correto!' : (tipo === 'tempo' ? '⏱ O tempo acabou.' : '✗ Não foi essa.')}</strong>
        ${comentario ? `<p class="feedback-comentario">${formatarTexto(comentario)}</p>` : ''}
        <p style="margin-top:6px">${formatarTexto(q.explicacao || '')}</p>
        ${caderno === 'entrou' ? '<p class="feedback-caderno">📒 Guardada no seu caderno de erros.</p>' : ''}
        ${caderno === 'saiu' ? `<p class="feedback-caderno">🎉 Saiu do caderno: ${ACERTOS_PARA_SAIR_DO_CADERNO} acertos seguidos!</p>` : ''}
      </div>
      <div class="btn-grupo"><button class="btn" id="btn-proxima-q">${indice + 1 < lista.length ? 'Próxima' : 'Ver resultado'}</button></div>`;
    const prox = container.querySelector('#btn-proxima-q');
    prox.addEventListener('click', () => { indice++; render(); });
    prox.focus({ preventScroll: true });
  }

  function fim() {
    encerrada = true;
    const acertos = respostas.filter(r => r.acertou).length;
    const erradas = respostas.filter(r => !r.acertou).map(r => r.q);
    const xp = ganharXpTreino(dados, acertos);
    let recorde = '';
    if (cronometrado) {
      const anterior = dados.treino?.recordeCronometrado || 0;
      if (acertos > anterior) {
        dados.treino.recordeCronometrado = acertos;
        recorde = `<p class="resultado-recorde">🏅 Novo recorde: ${acertos} acertos!</p>`;
      } else {
        recorde = `<p class="resultado-recorde">Recorde: ${anterior} acertos</p>`;
      }
    }
    salvarDados();
    const pct = respostas.length ? Math.round((acertos / respostas.length) * 100) : 0;
    const noCaderno = totalNoCaderno(dados);
    container.innerHTML = `
      <section class="card resultado-hero${pct >= 80 ? ' passou' : ''}">
        <span class="emoji">${pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'}</span>
        <h2>${esc(opcoes.titulo || 'Treino')} concluído</h2>
        <div class="pontuacao">${acertos}/${respostas.length} (${pct}%)</div>
        ${recorde}
        <div class="resultado-xp${xp ? '' : ' sem-ganho'}">${xp ? `+${xp} XP` : '0 XP'}${xp ? '' : `<small>Limite de ${XP_TREINO_POR_DIA} XP de treino por dia atingido</small>`}</div>
        <p class="resultado-caderno">📒 ${noCaderno ? `${noCaderno} questão(ões) no seu caderno de erros` : 'Seu caderno de erros está vazio'}</p>
        <div class="btn-grupo" style="justify-content:center;margin-top:var(--esp-2)">
          ${erradas.length ? `<button class="btn" id="btn-rever">🔎 Rever só as ${erradas.length} que errei</button>` : ''}
          <button class="btn btn-secundario" id="btn-voltar-treino">Voltar</button>
        </div>
      </section>`;
    if (pct >= 80) { fx.confete(); fx.vitoria(); }
    if (xp) fx.xpFlutuante(document.getElementById('xp-total'), xp);
    container.querySelector('#btn-rever')?.addEventListener('click', () => {
      iniciarSessao(container, dados, salvarDados, erradas, { ...opcoes, titulo: 'Revendo os erros', modo: 'revisao' });
    });
    container.querySelector('#btn-voltar-treino').addEventListener('click', () => (opcoes.aoTerminar || (() => {}))());
    window.scrollTo(0, 0);
  }

  render();
}

/** Aba "Treino" do Praticar. */
export async function renderTreino(container, dados, salvarDados, aindaAtual = () => true) {
  container.innerHTML = esqueleto(3);
  let banco;
  try {
    banco = await carregarBancoCompleto();
  } catch (e) {
    if (aindaAtual()) container.innerHTML = `<section class="card"><p class="erro-carregamento">Não foi possível carregar as questões: ${esc(e.message)}</p></section>`;
    return;
  }
  if (!aindaAtual()) return;
  const porId = new Map(banco.map(q => [q.id, q]));
  const voltar = () => renderTreino(container, dados, salvarDados, aindaAtual);

  function tela() {
    const aprof = lerAprofundamento();
    const disp = disponiveis(dados, banco, { aprofundamento: aprof });
    const caderno = Object.entries(dados.cadernoErros || {})
      .map(([id, c]) => ({ id, c, q: porId.get(id) }))
      .filter(x => x.q)
      .sort((a, b) => b.c.erros - a.c.erros);
    const recorde = dados.treino?.recordeCronometrado || 0;
    const xpHoje = dados.treino?.dia === hojeLocal() ? dados.treino.xp : 0;

    const itensCaderno = caderno.slice(0, 8).map(({ c, q }) => `
      <li class="caderno-item" data-trilha="${esc(q.trilha)}">
        <span class="caderno-enunciado">${formatarTexto(q.enunciado)}</span>
        <span class="caderno-meta">Trilha ${esc(q.trilha)} · errou ${c.erros}× ·
          <span class="caderno-progresso" aria-label="${c.acertosSeguidos} de ${ACERTOS_PARA_SAIR_DO_CADERNO} acertos seguidos">${'●'.repeat(c.acertosSeguidos)}${'○'.repeat(ACERTOS_PARA_SAIR_DO_CADERNO - c.acertosSeguidos)}</span>
        </span>
      </li>`).join('');

    container.innerHTML = `
      <section class="card treino-card treino-adaptativo">
        <div class="treino-topo">${ICONES.treino}<div><h3>Treino adaptativo</h3>
        <p>${TAMANHO_SESSAO} questões escolhidas para você: mais das que você erra ou não vê há tempo, menos das que já domina.</p></div></div>
        <label class="pref-chave"><span><strong>Incluir aprofundamento</strong><small>Questões de nível ensino médio (Doppler, tubos, cordas, decibéis)</small></span><input type="checkbox" id="chk-aprof" role="switch" ${aprof ? 'checked' : ''}></label>
        <p class="treino-info">${disp.length} questões disponíveis nas trilhas liberadas · XP de treino hoje: ${xpHoje}/${XP_TREINO_POR_DIA}</p>
        <button class="btn btn-grande" id="btn-adaptativo" ${disp.length ? '' : 'disabled'}>Começar treino</button>
      </section>

      <section class="card treino-card">
        <div class="treino-topo">${ICONES.caderno}<div><h3>Caderno de erros <small class="perfil-cont">${caderno.length}</small></h3>
        <p>Toda questão que você erra vem para cá. Ela sai depois de ${ACERTOS_PARA_SAIR_DO_CADERNO} acertos seguidos.</p></div></div>
        ${caderno.length
          ? `<ul class="caderno-lista">${itensCaderno}</ul>${caderno.length > 8 ? `<p class="treino-info">e mais ${caderno.length - 8}…</p>` : ''}
             <button class="btn btn-grande" id="btn-caderno">Treinar meus erros (${Math.min(TAMANHO_SESSAO, caderno.length)})</button>`
          : '<p class="des-vazio">Nenhum erro guardado. Quando errar uma questão, ela aparece aqui.</p>'}
      </section>

      <section class="card treino-card">
        <div class="treino-topo"><span class="treino-emoji" aria-hidden="true">⏱</span><div><h3>Desafio cronometrado</h3>
        <p>${TAMANHO_SESSAO} questões, ${SEGUNDOS_POR_QUESTAO} segundos cada, sem contas. Quantas você acerta?</p></div></div>
        <p class="treino-info">Seu recorde: <strong>${recorde}</strong> acerto(s)</p>
        <button class="btn btn-secundario btn-grande" id="btn-crono" ${disp.length ? '' : 'disabled'}>Aceitar o desafio</button>
      </section>`;

    container.querySelector('#chk-aprof').addEventListener('change', e => { gravarAprofundamento(e.target.checked); tela(); });
    container.querySelector('#btn-adaptativo').addEventListener('click', () => {
      const qs = sortearPonderado(disponiveis(dados, banco, { aprofundamento: lerAprofundamento() }), TAMANHO_SESSAO, q => peso(dados, q));
      iniciarSessao(container, dados, salvarDados, qs, { titulo: 'Treino adaptativo', modo: 'adaptativo', aoTerminar: voltar });
    });
    container.querySelector('#btn-caderno')?.addEventListener('click', () => {
      const qs = shuffle(caderno.map(x => x.q)).slice(0, TAMANHO_SESSAO);
      iniciarSessao(container, dados, salvarDados, qs, { titulo: 'Caderno de erros', modo: 'caderno', aoTerminar: voltar });
    });
    container.querySelector('#btn-crono').addEventListener('click', () => {
      const qs = shuffle(disponiveis(dados, banco, { aprofundamento: lerAprofundamento(), semCalculo: true })).slice(0, TAMANHO_SESSAO);
      iniciarSessao(container, dados, salvarDados, qs, { titulo: 'Desafio cronometrado', modo: 'cronometrado', aoTerminar: voltar });
    });
  }

  tela();
}
