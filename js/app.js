/* Ponto de entrada: carrega os dados, controla a navegação entre telas e o modo professor. */
import { storage, consumirErroQuota } from './storage.js';
import { esc, hojeLocal } from './utils.js';
import { renderTrilha, cleanupTrilha } from './trilhas.js';
import { renderLab, cleanupLab } from './lab.js';
import { renderPraticar, cleanupPraticar } from './praticar.js';
import { estaEmModoProfessor, ativarModoProfessor, desativarModoProfessor, verificarPin } from './modo-professor.js';
import { verificarNovosBadges, mostrarToastBadges, listarTodosBadges } from './badges.js';
import { renderDesempenho } from './desempenho.js';
import { TRILHAS, IDS_TRILHAS } from './conteudo.js';
import { instalarGuardaSaida } from './sair.js';
import { confirmar, pedirTexto, avisar } from './dialogos.js';
import { renderInicio } from './inicio.js';
import { renderListaTrilhas } from './lista-trilhas.js';
import { renderPerfil } from './perfil.js';
import { renderOnboarding } from './onboarding.js';
import { trilhaLiberada } from './progresso.js';
import { aplicarPreferenciasSalvas, aplicarTema, temaAtual } from './preferencias.js';
import { movimentoReduzido } from './fx.js';
import { cartaoEstudo } from './inicio.js';
import { iniciarPwa } from './pwa.js';
import { renderFontes } from './fontes.js';
import { renderFicha } from './ficha.js';

const $ = sel => document.querySelector(sel);

aplicarPreferenciasSalvas();
iniciarPwa();

// carregar() primeiro (ele guarda uma cópia se detectar dados corrompidos),
// depois lerCorrompido() para saber se há uma cópia pendente.
let dados = storage.carregar();
let corrompido = storage.lerCorrompido();
if (!dados && !corrompido) dados = storage.inicializar();

export function salvarDados() {
  const badgesAntes = Array.isArray(dados.badges) ? [...dados.badges] : [];
  const novos = verificarNovosBadges(dados);
  const ok = storage.salvar(dados);
  if (!ok) {
    dados.badges = badgesAntes;
    if (consumirErroQuota()) mostrarAvisoQuota();
  } else if (novos.length) {
    mostrarToastBadges(novos);
  }
  atualizarXP();
  atualizarMarcadores();
  return ok;
}

let ultimoAvisoQuota = 0;
function mostrarAvisoQuota() {
  if (Date.now() - ultimoAvisoQuota < 6000) return;
  ultimoAvisoQuota = Date.now();
  avisar('Não foi possível salvar. Verifique o espaço do navegador ou se está em modo privado.', 'erro', 6000);
}

function atualizarXP() {
  const el = $('#xp-total');
  if (el) el.textContent = `${dados?.xp || 0} XP`;
}

/** Número no menu "Praticar": flashcards já estudados que vencem hoje. */
function atualizarMarcadores() {
  const item = document.querySelector('.nav-item[data-rota="praticar"]');
  if (!item || !dados) return;
  const hoje = hojeLocal();
  const n = Object.values(dados.flashcards || {}).filter(c => c.proximaRevisao && c.proximaRevisao <= hoje).length;
  let ponto = item.querySelector('.nav-ponto');
  if (!n) { ponto?.remove(); item.removeAttribute('aria-description'); return; }
  if (!ponto) {
    ponto = document.createElement('span');
    ponto.className = 'nav-ponto';
    ponto.setAttribute('aria-hidden', 'true');
    item.appendChild(ponto);
  }
  ponto.textContent = n > 9 ? '9+' : String(n);
  item.setAttribute('aria-description', `${n} flashcard(s) para revisar hoje`);
}

/* Contexto entregue às telas: acesso aos dados e à navegação sem variáveis globais. */
const ctx = {
  dados: () => dados,
  salvar: salvarDados,
  navegar: rota => {
    if (location.hash.slice(1) === rota) navegar(rota);
    else location.hash = rota;
  },
  substituirDados: novo => { dados = novo; corrompido = null; atualizarXP(); atualizarMarcadores(); }
};

const TITULOS_ROTA = {
  inicio: 'Início', trilhas: 'Trilhas', praticar: 'Praticar', lab: 'Laboratório',
  perfil: 'Perfil', desempenho: 'Meu desempenho', fontes: 'Fontes', ficha: 'Ficha da aula'
};

function setTitulo(rota) {
  const t = TITULOS_ROTA[rota.split('/')[0]];
  document.title = t ? `${t} — Ondulatória` : 'Ondulatória — 9º ano';
}

/* ============ Recuperação de dados corrompidos ============ */
function renderRecuperacao() {
  const raw = corrompido || '';
  $('#conteudo').innerHTML = `
    <section class="card">
      <h2>⚠ Seus dados estavam danificados</h2>
      <p>O progresso salvo neste aparelho estava corrompido e não pôde ser recuperado automaticamente.</p>
      <p>Guardamos uma cópia do arquivo danificado — você pode baixá-la para tentar recuperar, ou começar do zero.</p>
      <div class="btn-grupo">
        <button class="btn btn-secundario" id="btn-baixar-corrompido">⬇ Baixar arquivo danificado</button>
        <button class="btn" id="btn-comecar-zero">Começar do zero</button>
      </div>
    </section>`;
  $('#btn-baixar-corrompido').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ondulatoria-dados-corrompidos-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('#btn-comecar-zero').addEventListener('click', async () => {
    const ok = await confirmar({ titulo: 'Começar do zero?', texto: 'O arquivo danificado será apagado deste aparelho.', ok: 'Começar do zero', perigo: true });
    if (!ok) return;
    storage.limparCorrompido();
    ctx.substituirDados(storage.inicializar());
    navegar('inicio');
  });
}

/* ============ Modo professor ============ */
function atualizarBadgeProfessor() {
  const badge = document.getElementById('badge-prof');
  if (!estaEmModoProfessor()) { badge?.remove(); return; }
  if (badge) return;
  const el = document.createElement('button');
  el.type = 'button';
  el.id = 'badge-prof';
  el.className = 'badge-prof';
  el.textContent = '👨‍🏫 Professor';
  el.title = 'Desativar o modo professor';
  el.addEventListener('click', async () => {
    if (await confirmar({ titulo: 'Desativar o modo professor?', ok: 'Desativar' })) {
      desativarModoProfessor();
      atualizarBadgeProfessor();
      navegar(location.hash.slice(1) || 'inicio');
    }
  });
  document.querySelector('.topo-acoes')?.prepend(el);
}

async function pedirPinProfessor() {
  const pin = await pedirTexto({ titulo: 'Modo professor', texto: 'Digite o PIN do professor.', tipo: 'password', ok: 'Entrar', icone: '👨‍🏫', maxlength: 64 });
  if (!pin) return;
  try {
    const r = await verificarPin(pin);
    if (!r.ok) { avisar(r.motivo, 'erro'); return; }
    ativarModoProfessor();
    atualizarBadgeProfessor();
    avisar('Modo professor ativado.', 'ok');
    navegar(location.hash.slice(1) || 'inicio');
  } catch (e) {
    avisar(e.message, 'erro');
  }
}

// Atalho escondido: 7 toques no logotipo, ou abrir o app com #prof.
let toques = 0, timerToques = null;
$('.logo')?.addEventListener('click', () => {
  toques++;
  clearTimeout(timerToques);
  timerToques = setTimeout(() => { toques = 0; }, 800);
  if (toques >= 7) { toques = 0; pedirPinProfessor(); }
});

const abrirComProf = location.hash === '#prof';
if (abrirComProf) history.replaceState(null, '', location.pathname);

$('#btn-tema').addEventListener('click', () => aplicarTema(temaAtual() === 'claro' ? 'escuro' : 'claro', true));

/* ============ Navegação ============ */
function marcarMenu(rotaMenu) {
  document.querySelectorAll('.nav-item').forEach(el => {
    const ativo = el.dataset.rota === rotaMenu;
    el.classList.toggle('ativo', ativo);
    if (ativo) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

function animarEntrada() {
  const main = $('#conteudo');
  if (!main) return;
  main.classList.remove('entrando');
  if (!movimentoReduzido()) {
    void main.offsetWidth;
    main.classList.add('entrando');
  }
  main.focus({ preventScroll: true });
}

function navegar(rota) {
  cleanupLab();
  cleanupTrilha();
  cleanupPraticar();
  window.scrollTo(0, 0);

  if (!dados && corrompido) {
    renderRecuperacao();
    marcarMenu(null);
    setTitulo('recuperacao');
    return;
  }
  if (!dados.aluno.primeiroNome) {
    renderOnboarding(ctx);
    marcarMenu(null);
    setTitulo('inicio');
    animarEntrada();
    return;
  }

  const [base, param] = rota.split('/');

  if (base === 'trilha' && param) {
    marcarMenu('trilhas');
    setTitulo('trilhas');
    if (!IDS_TRILHAS.has(param)) {
      $('#conteudo').innerHTML = `
        <section class="card">
          <h2>Trilha não encontrada</h2>
          <p>A trilha "${esc(param)}" não existe. Este app tem ${TRILHAS.length} trilhas.</p>
          <a href="#trilhas" class="btn">Voltar às trilhas</a>
        </section>`;
    } else if (!trilhaLiberada(dados, param)) {
      avisar('Trilha bloqueada. Conclua a anterior para liberar.', 'info');
      history.replaceState(history.state, '', '#trilhas');
      renderListaTrilhas(ctx);
    } else {
      renderTrilha(param, dados, salvarDados);
    }
    animarEntrada();
    return;
  }

  const telas = {
    inicio: () => renderInicio(ctx, { estudo: cartaoEstudo(dados) }),
    trilhas: () => renderListaTrilhas(ctx),
    praticar: () => renderPraticar(dados, salvarDados, param),
    lab: () => renderLab(dados, salvarDados),
    perfil: () => renderPerfil(ctx),
    desempenho: () => renderDesempenho(dados, TRILHAS, { totalBadges: listarTodosBadges().length }),
    fontes: () => renderFontes(param),
    ficha: () => renderFicha(param)
  };
  const nome = telas[base] ? base : 'inicio';
  telas[nome]();
  marcarMenu({ desempenho: 'perfil', ficha: 'trilhas', fontes: param === 'trilhas' ? 'trilhas' : 'perfil' }[nome] || nome);
  setTitulo(nome);
  animarEntrada();
}

instalarGuardaSaida();
window.addEventListener('hashchange', () => navegar(location.hash.slice(1) || 'inicio'));
navegar(location.hash.slice(1) || 'inicio');
atualizarXP();
atualizarMarcadores();
atualizarBadgeProfessor();
if (abrirComProf) pedirPinProfessor();
