import { esc, hojeLocal, localMaisDias } from './utils.js';
import { confirmar } from './dialogos.js';
import { renderDiario } from './diario.js';
import { renderAbertas } from './abertas.js';
import { renderTreino } from './treino.js';
import { carregarJSON } from './conteudo.js';
import { cabecalho, esqueleto } from './ui.js';

let cleanupAtual = null;

export function cleanupPraticar() {
  if (cleanupAtual) { try { cleanupAtual(); } catch (_) {} cleanupAtual = null; }
}

function carregarFlashcards() {
  return carregarJSON('dados/flashcards.json');
}

const INTERVALO_MAX = 180;
const FACILIDADE_MIN = 1.3;
const FACILIDADE_MAX = 2.5;

function estadoCartaoVazio() {
  return { facilidade: 2.5, intervalo: 0, proximaRevisao: null, repeticoes: 0, ultimaVez: null };
}

function precisaRevisar(estado) {
  if (!estado.proximaRevisao) return true;
  return estado.proximaRevisao <= hojeLocal();
}

function aplicarResposta(estado, resposta) {
  const e = { ...estado };
  if (resposta === 'facil') {
    e.repeticoes = (e.repeticoes || 0) + 1;
    e.facilidade = Math.min(FACILIDADE_MAX, (e.facilidade || 2.5) + 0.1);
    e.intervalo = e.repeticoes === 1 ? 1 : (e.intervalo === 0 ? 1 : Math.min(INTERVALO_MAX, e.intervalo * e.facilidade));
  } else if (resposta === 'medio') {
    e.repeticoes = (e.repeticoes || 0) + 1;
    e.intervalo = e.repeticoes === 1 ? 1 : Math.min(INTERVALO_MAX, e.intervalo === 0 ? 1 : e.intervalo * 2);
  } else {
    e.repeticoes = 0;
    e.facilidade = Math.max(FACILIDADE_MIN, (e.facilidade || 2.5) - 0.2);
    e.intervalo = 1;
  }
  e.proximaRevisao = localMaisDias(Math.max(1, Math.round(e.intervalo)));
  e.ultimaVez = new Date().toISOString();
  return e;
}

const ABAS = ['treino', 'flash', 'diario', 'abertas'];

export async function renderPraticar(dados, salvarDados, abaInicial = 'treino') {
  cleanupPraticar();
  const container = document.querySelector('#conteudo');

  container.innerHTML = `
    ${cabecalho({ rotulo: 'Praticar', titulo: 'Praticar', sub: 'Revise com flashcards, registre sons do dia a dia e responda atividades para o professor.' })}
    <div class="lab-tabs" role="tablist" aria-label="Modo de prática">
      <button class="lab-tab" data-sub="treino" role="tab" aria-selected="false">Treino</button>
      <button class="lab-tab" data-sub="flash" role="tab" aria-selected="false">Flashcards</button>
      <button class="lab-tab" data-sub="diario" role="tab" aria-selected="false">Diário sonoro</button>
      <button class="lab-tab" data-sub="abertas" role="tab" aria-selected="false">Atividades abertas</button>
    </div>
    <div id="sub-content" role="tabpanel"></div>
  `;

  const sub = document.getElementById('sub-content');

  // Cada troca de aba invalida a anterior: um carregamento lento não sobrescreve a aba nova.
  let abaToken = 0;
  async function trocarAba(tab) {
    const meu = ++abaToken;
    document.querySelectorAll('.lab-tab').forEach(b => {
      const ativo = b.dataset.sub === tab;
      b.classList.toggle('ativo', ativo);
      b.setAttribute('aria-selected', String(ativo));
    });
    sub.innerHTML = '';
    const alvo = document.createElement('div');
    sub.appendChild(alvo);
    const aindaAtual = () => meu === abaToken;
    if (tab === 'flash') await renderFlashcards(alvo, dados, salvarDados, aindaAtual);
    else if (tab === 'diario') renderDiario(alvo, dados, salvarDados);
    else if (tab === 'abertas') await renderAbertas(alvo, dados, salvarDados, aindaAtual);
    else if (tab === 'treino') await renderTreino(alvo, dados, salvarDados, aindaAtual);
  }

  document.querySelectorAll('.lab-tab').forEach(b => {
    b.addEventListener('click', () => trocarAba(b.dataset.sub));
  });

  cleanupAtual = () => {};
  await trocarAba(ABAS.includes(abaInicial) ? abaInicial : 'treino');
}

async function renderFlashcards(container, dados, salvarDados, aindaAtual = () => true) {
  container.innerHTML = esqueleto(2);

  let banco;
  try {
    banco = await carregarFlashcards();
  } catch (e) {
    if (!aindaAtual()) return;
    container.innerHTML = `<section class="card"><p class="erro-carregamento">Erro ao carregar: ${esc(e.message)}</p></section>`;
    return;
  }
  if (!aindaAtual()) return;

  if (!dados.flashcards || typeof dados.flashcards !== 'object') dados.flashcards = {};
  let sessao = null;

  const vencidos = () => banco.cartoes.filter(c => {
    const est = dados.flashcards[c.id];
    return !est || precisaRevisar(est);
  });

  const stats = () => {
    let dominados = 0, aprendendo = 0, novos = 0;
    for (const c of banco.cartoes) {
      const est = dados.flashcards[c.id];
      if (!est) { novos++; continue; }
      if (est.repeticoes >= 3 && est.intervalo >= 7) dominados++;
      else aprendendo++;
    }
    return { dominados, aprendendo, novos, total: banco.cartoes.length };
  };

  function telaInicial() {
    sessao = null;
    const est = stats();
    const paraEstudar = vencidos();

    container.innerHTML = `
      <section class="card">
        <h2>Flashcards</h2>
        <p>Revisão espaçada: os que você erra voltam mais vezes; os que acerta, aparecem cada vez menos.</p>
        <div class="flash-stats">
          <div><strong>${est.total}</strong><span>total</span></div>
          <div><strong>${est.dominados}</strong><span>dominados</span></div>
          <div><strong>${est.aprendendo}</strong><span>aprendendo</span></div>
          <div><strong>${est.novos}</strong><span>novos</span></div>
        </div>
      </section>
      <section class="card">
        <h3>${paraEstudar.length > 0 ? `${paraEstudar.length} cartão(ões) para revisar hoje` : 'Tudo em dia!'}</h3>
        ${paraEstudar.length === 0
          ? '<p>Volte amanhã para revisar os próximos.</p><div class="btn-grupo"><button class="btn btn-secundario" id="btn-aleat">Estudar 5 aleatórios</button></div>'
          : `<p>Uma sessão tem até 15 cartões.</p><div class="btn-grupo"><button class="btn" id="btn-iniciar">Iniciar sessão (${Math.min(15, paraEstudar.length)})</button></div>`}
      </section>
    `;
    const btn1 = document.getElementById('btn-iniciar');
    if (btn1) btn1.addEventListener('click', () => iniciarSessao(paraEstudar.slice(0, 15)));
    const btn2 = document.getElementById('btn-aleat');
    if (btn2) btn2.addEventListener('click', () => {
      const todos = [...banco.cartoes];
      const amostra = [];
      while (amostra.length < 5 && todos.length) amostra.push(todos.splice(Math.floor(Math.random() * todos.length), 1)[0]);
      iniciarSessao(amostra);
    });
  }

  function iniciarSessao(cartoes) {
    if (!cartoes.length) { telaInicial(); return; }
    sessao = { cartoes, indice: 0, virado: false, acertos: 0 };
    renderCartao();
  }

  function renderCartao() {
    if (!sessao || sessao.indice >= sessao.cartoes.length) { telaFim(); return; }
    const c = sessao.cartoes[sessao.indice];
    const idx = sessao.indice, total = sessao.cartoes.length;
    container.innerHTML = `
      <div class="flash-progresso"><div class="flash-progresso-fill" style="width:${(idx / total) * 100}%"></div></div>
      <section class="card">
        <div class="flash-header">
          <span>Cartão ${idx + 1} de ${total}</span>
          <button class="btn btn-secundario btn-pequeno" id="btn-sair-flash">Sair</button>
        </div>
        <div class="flash-cena">
          <div class="flash-cartao" id="flash-cartao" tabindex="0" role="button" aria-label="Virar o cartão">
            <div class="flash-face flash-face-frente">
              <p class="flash-label">Pergunta</p>
              <p class="flash-frente">${esc(c.frente)}</p>
              <p class="flash-dica">Toque ou pressione Enter para ver a resposta</p>
            </div>
            <div class="flash-face flash-face-verso" aria-hidden="true">
              <p class="flash-label">Resposta</p>
              <p class="flash-verso">${esc(c.verso)}</p>
            </div>
          </div>
        </div>
        <div class="flash-acoes" id="flash-acoes" hidden>
          <p class="flash-pergunta-auto">Como foi lembrar?</p>
          <button class="btn btn-flash-dificil" data-r="dificil">Difícil</button>
          <button class="btn btn-flash-medio" data-r="medio">Médio</button>
          <button class="btn btn-flash-facil" data-r="facil">Fácil</button>
        </div>
      </section>
    `;
    const el = document.getElementById('flash-cartao');
    el.addEventListener('click', () => virar(c));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); virar(c); }
    });
    document.getElementById('btn-sair-flash').addEventListener('click', async () => {
      if (await confirmar({ titulo: 'Sair da sessão?', texto: 'Os cartões já respondidos ficam salvos.', ok: 'Sair' })) telaInicial();
    });
  }

  function virar(c) {
    if (sessao.virado) return;
    sessao.virado = true;
    const el = document.getElementById('flash-cartao');
    el.classList.add('virado');
    el.removeAttribute('role');
    el.setAttribute('aria-label', 'Resposta');
    el.querySelector('.flash-face-frente').setAttribute('aria-hidden', 'true');
    el.querySelector('.flash-face-verso').removeAttribute('aria-hidden');
    const acoes = document.getElementById('flash-acoes');
    acoes.hidden = false;
    acoes.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => responder(c, b.dataset.r));
    });
    acoes.querySelector('button').focus();
  }

  function responder(c, resp) {
    const ant = dados.flashcards[c.id] || estadoCartaoVazio();
    dados.flashcards[c.id] = aplicarResposta(ant, resp);
    if (resp !== 'dificil') sessao.acertos++;
    salvarDados();
    sessao.virado = false;
    sessao.indice++;
    renderCartao();
  }

  function telaFim() {
    const total = sessao.cartoes.length;
    const pct = total > 0 ? Math.round((sessao.acertos / total) * 100) : 0;
    container.innerHTML = `
      <section class="card resultado-hero">
        <span class="emoji">📚</span>
        <h2>Sessão concluída</h2>
        <div class="pontuacao">${sessao.acertos}/${total}</div>
        <p>${pct}% avaliados como fácil ou médio.</p>
        <p style="color:var(--texto-fraco);font-size:0.95rem">Os marcados como difícil voltam amanhã.</p>
        <div class="btn-grupo" style="justify-content:center;margin-top:var(--esp-3)">
          <button class="btn" id="btn-voltar-flash">Voltar</button>
        </div>
      </section>
    `;
    document.getElementById('btn-voltar-flash').addEventListener('click', telaInicial);
  }

  telaInicial();
}