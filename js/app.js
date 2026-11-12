import { storage, consumirErroQuota } from './storage.js';
import { esc } from './utils.js';
import { renderTrilha, cleanupTrilha } from './trilhas.js';
import { renderLab as renderLabModule, cleanupLab } from './lab.js';
import { renderPraticar as renderPraticarModule, cleanupPraticar } from './praticar.js';
import { exportarParaProfessor, chaveConfigurada, fingerprintChave } from './relatorio.js';
import { estaEmModoProfessor, ativarModoProfessor, desativarModoProfessor, verificarPin } from './modo-professor.js';
import { verificarNovosBadges, mostrarToastBadges, listarTodosBadges } from './badges.js';
import { renderDesempenho } from './desempenho.js';
import { TRILHAS, IDS_TRILHAS } from './conteudo.js';
import { instalarGuardaSaida } from './sair.js';
import { confirmar, informar, pedirTexto, avisar } from './dialogos.js';

const $ = sel => document.querySelector(sel);

// ORDEM CORRETA: carregar() primeiro (ele cria o backup se detectar corrupção),
// depois lerCorrompido() para saber se há um backup pendente.
let dados = storage.carregar();
let corrompido = storage.lerCorrompido();
if (!dados && !corrompido) dados = storage.inicializar();

export function salvarDados() {
  const badgesAntes = Array.isArray(dados.badges) ? [...dados.badges] : [];
  const novos = verificarNovosBadges(dados);
  const ok = storage.salvar(dados);
  if (!ok) {
    dados.badges = badgesAntes;
    const q = consumirErroQuota();
    if (q) mostrarAvisoQuota();
  } else if (novos.length) {
    mostrarToastBadges(novos);
  }
  atualizarXP();
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

function trilhaConcluida(id) { return dados?.trilhas?.[id]?.concluida === true; }
function trilhaLiberada(id) {
  if (id === '1') return true;
  return trilhaConcluida(String(parseInt(id, 10) - 1));
}

const TITULOS_ROTA = {
  'inicio': 'Início',
  'trilhas': 'Trilhas',
  'praticar': 'Praticar',
  'lab': 'Laboratório',
  'perfil': 'Perfil',
  'desempenho': 'Meu desempenho'
};

function setTitulo(rota) {
  const base = rota.split('/')[0];
  const t = TITULOS_ROTA[base];
  document.title = t ? `${t} — Ondulatória` : 'Ondulatória — 9º ano';
}

/* ============ Recuperação de dados corrompidos ============ */
function renderRecuperacao() {
  const raw = corrompido || '';
  $('#conteudo').innerHTML = `
    <section class="card">
      <h2>⚠ Seus dados estavam danificados</h2>
      <p>Detectamos que o progresso salvo neste aparelho estava corrompido e não pôde ser recuperado automaticamente.</p>
      <p>Guardamos uma cópia do arquivo danificado — você pode baixá-lo para tentar recuperar manualmente, ou começar do zero.</p>
      <div class="btn-grupo">
        <button class="btn btn-secundario" id="btn-baixar-corrompido">⬇ Baixar arquivo danificado</button>
        <button class="btn" id="btn-comecar-zero">Começar do zero</button>
      </div>
    </section>
  `;
  document.getElementById('btn-baixar-corrompido').addEventListener('click', () => {
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ondulatoria-dados-corrompidos-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.getElementById('btn-comecar-zero').addEventListener('click', async () => {
    const ok = await confirmar({ titulo: 'Começar do zero?', texto: 'O arquivo danificado será apagado deste aparelho.', ok: 'Começar do zero', perigo: true });
    if (!ok) return;
    storage.limparCorrompido();
    dados = storage.inicializar();
    corrompido = null;
    navegar('inicio');
  });
  atualizarXP();
}

/* ============ Modo professor ============ */
function atualizarBadgeProfessor() {
  const badge = document.getElementById('badge-prof');
  if (estaEmModoProfessor()) {
    if (!badge) {
      const el = document.createElement('span');
      el.id = 'badge-prof';
      el.className = 'badge-prof';
      el.textContent = '👨‍🏫 Modo professor';
      el.title = 'Clique para desativar';
      el.style.cursor = 'pointer';
      el.addEventListener('click', async () => {
        if (await confirmar({ titulo: 'Desativar o modo professor?', ok: 'Desativar' })) {
          desativarModoProfessor();
          atualizarBadgeProfessor();
          navegar(location.hash.slice(1) || 'inicio');
        }
      });
      const acoes = document.querySelector('.topo-acoes');
      if (acoes) acoes.appendChild(el);
    }
  } else if (badge) badge.remove();
}

async function pedirPinProfessor() {
  const pin = await pedirTexto({ titulo: 'Modo professor', texto: 'Digite o PIN do professor.', tipo: 'password', ok: 'Entrar', icone: '👨‍🏫', maxlength: 64 });
  if (pin === null || pin === '') return;
  try {
    const r = await verificarPin(pin);
    if (r.ok) {
      ativarModoProfessor();
      atualizarBadgeProfessor();
      avisar('Modo professor ativado.', 'ok');
      navegar(location.hash.slice(1) || 'inicio');
    } else {
      avisar(r.motivo, 'erro');
    }
  } catch (e) {
    avisar(e.message, 'erro');
  }
}

// Atalho escondido: 7 toques no logotipo, ou abrir o app com #prof.
let tapCount = 0, tapTimer = null;
const logoEl = document.querySelector('.logo');
if (logoEl) {
  logoEl.addEventListener('click', () => {
    tapCount++;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 800);
    if (tapCount >= 7) {
      tapCount = 0;
      pedirPinProfessor();
    }
  });
}

const abrirComProf = location.hash === '#prof';
if (abrirComProf) history.replaceState(null, '', location.pathname);

/* ============ Tema ============ */
(function aplicarTema() {
  let salvo = null;
  try { salvo = localStorage.getItem('ondulatoria_tema'); } catch (_) {}
  if (salvo === 'claro' || salvo === 'escuro') {
    document.documentElement.setAttribute('data-tema', salvo);
    return;
  }
  const prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-tema', prefereEscuro ? 'escuro' : 'claro');
})();

$('#btn-tema').addEventListener('click', () => {
  const atual = document.documentElement.getAttribute('data-tema');
  const novo = atual === 'claro' ? 'escuro' : 'claro';
  document.documentElement.setAttribute('data-tema', novo);
  try { localStorage.setItem('ondulatoria_tema', novo); } catch (_) {}
});

/* ============ Onboarding ============ */
function renderOnboarding() {
  $('#conteudo').innerHTML = `
    <section class="onboarding">
      <div class="card">
        <h2>Bem-vindo(a) à Ondulatória</h2>
        <p>Antes de começar, precisamos de algumas informações.</p>
        <form id="form-onboarding" novalidate>
          <label for="in-nome">Primeiro nome *</label>
          <input id="in-nome" type="text" required maxlength="30" autocomplete="given-name">
          <label for="in-sobrenome">Último nome *</label>
          <input id="in-sobrenome" type="text" required maxlength="30" autocomplete="family-name">
          <label for="in-turma">Turma</label>
          <input id="in-turma" type="text" maxlength="10" placeholder="ex: 9A" autocomplete="off">
          <div class="aviso-privacidade">
            <strong>Privacidade:</strong> guardamos apenas seu nome, turma e progresso — <em>somente neste aparelho</em>.
            Nada é enviado a servidores.
          </div>
          <div class="btn-grupo"><button type="submit" class="btn">Começar</button></div>
        </form>
      </div>
    </section>
  `;
  $('#form-onboarding').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = $('#in-nome').value.trim();
    const u = $('#in-sobrenome').value.trim();
    const t = $('#in-turma').value.trim();
    if (!p || !u) {
      avisar('Preencha o primeiro e o último nome.', 'erro');
      (!p ? $('#in-nome') : $('#in-sobrenome')).focus();
      return;
    }
    dados.aluno.primeiroNome = p;
    dados.aluno.ultimoNome = u;
    dados.aluno.turma = t;
    salvarDados();
    navegar('inicio');
  });
}

/* ============ Páginas ============ */
const XP_POR_NIVEL = 100;

const ICONES = {
  praticar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="10" rx="2"/><path d="M7 19h14V9"/></svg>',
  lab: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/></svg>',
  perfil: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  desempenho: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  trilhas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6"/></svg>',
  seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  cadeado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
};

/** Etapas da trilha: leitura iniciada, compreensão feita, quiz aprovado. */
function etapasTrilha(id) {
  const t = dados.trilhas?.[id];
  if (!t) return 0;
  if (t.concluida) return 3;
  if (t.compreensao) return 2;
  return 1;
}

function proximaTrilha() {
  return TRILHAS.find(t => !trilhaConcluida(t.id) && trilhaLiberada(t.id)) || null;
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function renderInicio() {
  const nome = esc(dados.aluno.primeiroNome || '');
  const turma = dados.aluno.turma ? `<span class="home-chip">Turma ${esc(dados.aluno.turma)}</span>` : '';
  const xp = dados.xp || 0;
  const nivel = Math.floor(xp / XP_POR_NIVEL) + 1;
  const xpNoNivel = xp % XP_POR_NIVEL;
  const concluidas = TRILHAS.filter(t => trilhaConcluida(t.id)).length;
  const pct = Math.round((concluidas / TRILHAS.length) * 100);
  const badges = dados.badges || [];
  const totalBadges = listarTodosBadges().length;
  const flash = Object.keys(dados.flashcards || {}).length;

  // Anel de progresso: circunferência de r=52 ≈ 326,7
  const C = 2 * Math.PI * 52;
  const anel = `
    <svg class="home-anel" viewBox="0 0 120 120" role="img" aria-label="${pct}% das trilhas concluídas">
      <defs>
        <linearGradient id="grad-anel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--ciano)"/><stop offset="1" stop-color="var(--sucesso)"/>
        </linearGradient>
      </defs>
      <circle class="home-anel-fundo" cx="60" cy="60" r="52"/>
      <circle class="home-anel-valor" cx="60" cy="60" r="52" stroke="url(#grad-anel)"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/>
      <text x="60" y="58" class="home-anel-num">${concluidas}/${TRILHAS.length}</text>
      <text x="60" y="78" class="home-anel-rot">trilhas</text>
    </svg>`;

  const prox = proximaTrilha();
  let continuar;
  if (prox) {
    const etapas = etapasTrilha(prox.id);
    const nomesEtapa = ['Leitura', 'Compreensão', 'Quiz'];
    const passos = nomesEtapa.map((n, i) => `<li class="${i < etapas ? 'feito' : (i === etapas ? 'atual' : '')}">${n}</li>`).join('');
    continuar = `
      <a href="#trilha/${prox.id}" class="home-continuar">
        <span class="home-rotulo">${etapas ? 'Continue de onde parou' : 'Próxima trilha'}</span>
        <span class="home-continuar-num">Trilha ${prox.id}</span>
        <strong class="home-continuar-titulo">${esc(prox.titulo)}</strong>
        <span class="home-continuar-desc">${esc(prox.desc)}</span>
        <ol class="home-etapas" aria-label="Etapas da trilha">${passos}</ol>
        <span class="home-continuar-btn">${etapas ? 'Continuar' : 'Começar'} ${ICONES.seta}</span>
      </a>`;
  } else {
    continuar = `
      <div class="home-continuar home-continuar-fim">
        <span class="home-rotulo">Parabéns!</span>
        <strong class="home-continuar-titulo">Você concluiu todas as trilhas 🏆</strong>
        <span class="home-continuar-desc">Continue treinando no Praticar e explore o Laboratório.</span>
        <a href="#praticar" class="home-continuar-btn">Praticar ${ICONES.seta}</a>
      </div>`;
  }

  const mapa = TRILHAS.map(t => {
    const ok = trilhaConcluida(t.id);
    const livre = trilhaLiberada(t.id);
    const atual = prox && prox.id === t.id;
    const cls = ok ? 'feita' : (atual ? 'atual' : (livre ? 'livre' : 'bloqueada'));
    const icone = ok ? ICONES.check : (livre ? t.id : ICONES.cadeado);
    const estado = ok ? 'concluída' : (livre ? 'disponível' : 'bloqueada');
    const conteudo = `<span class="home-no">${icone}</span><span class="home-no-nome">${esc(t.curto)}</span>`;
    return livre
      ? `<li><a href="#trilha/${t.id}" class="home-mapa-item ${cls}" aria-label="Trilha ${t.id}: ${esc(t.titulo)} (${estado})">${conteudo}</a></li>`
      : `<li><span class="home-mapa-item ${cls}" aria-label="Trilha ${t.id}: ${esc(t.titulo)} (${estado})">${conteudo}</span></li>`;
  }).join('');

  const recentes = badges.slice(-3).reverse();
  const conquistas = recentes.length
    ? recentes.map(b => `<li class="home-badge"><span class="home-badge-emoji" aria-hidden="true">${esc(b.emoji)}</span>${esc(b.nome)}</li>`).join('')
    : '<li class="home-badge home-badge-vazio">Conclua atividades para ganhar sua primeira conquista.</li>';

  $('#conteudo').innerHTML = `
    <section class="home-hero" aria-labelledby="home-ola">
      <svg class="home-hero-ondas" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,120 Q75,60 150,120 T300,120 T450,120 T600,120 V200 H0Z"/>
        <path d="M0,140 Q75,95 150,140 T300,140 T450,140 T600,140 V200 H0Z"/>
      </svg>
      <div class="home-hero-texto">
        <p class="home-saudacao">${saudacao()}${turma}</p>
        <h2 id="home-ola">${nome ? `Olá, ${nome}!` : 'Olá!'}</h2>
        <div class="home-nivel">
          <div class="home-nivel-topo"><strong>Nível ${nivel}</strong><span>${xpNoNivel}/${XP_POR_NIVEL} XP</span></div>
          <div class="home-nivel-barra" role="progressbar" aria-label="Progresso até o próximo nível"
               aria-valuemin="0" aria-valuemax="${XP_POR_NIVEL}" aria-valuenow="${xpNoNivel}">
            <div style="width:${xpNoNivel}%"></div>
          </div>
        </div>
      </div>
      ${anel}
    </section>

    <a href="#desempenho" class="home-stats-link" aria-label="Ver meu desempenho completo">
      <ul class="home-stats">
        <li><strong>${xp}</strong><span>XP total</span></li>
        <li><strong>${badges.length}<small>/${totalBadges}</small></strong><span>Conquistas</span></li>
        <li><strong>${flash}</strong><span>Flashcards</span></li>
      </ul>
    </a>

    ${continuar}

    <section class="home-secao" aria-labelledby="home-mapa-tit">
      <div class="home-secao-topo">
        <h3 id="home-mapa-tit">Sua jornada</h3>
        <a href="#trilhas" class="home-link">Ver trilhas</a>
      </div>
      <ol class="home-mapa">${mapa}</ol>
    </section>

    <section class="home-secao" aria-labelledby="home-atalhos-tit">
      <h3 id="home-atalhos-tit" class="sr-only">Atalhos</h3>
      <div class="home-atalhos">
        <a href="#praticar" class="home-atalho atalho-praticar">${ICONES.praticar}<strong>Praticar</strong><span>Flashcards e exercícios</span></a>
        <a href="#lab" class="home-atalho atalho-lab">${ICONES.lab}<strong>Laboratório</strong><span>Simule e ouça ondas</span></a>
        <a href="#desempenho" class="home-atalho atalho-trilhas">${ICONES.desempenho}<strong>Desempenho</strong><span>Notas, evolução e conceitos</span></a>
        <a href="#perfil" class="home-atalho atalho-perfil">${ICONES.perfil}<strong>Perfil</strong><span>Conquistas e backup</span></a>
      </div>
    </section>

    <section class="home-secao" aria-labelledby="home-conq-tit">
      <div class="home-secao-topo">
        <h3 id="home-conq-tit">Conquistas recentes</h3>
        <a href="#perfil" class="home-link">Ver todas</a>
      </div>
      <ul class="home-badges">${conquistas}</ul>
    </section>

    <p class="home-privacidade">🔒 Seu progresso fica <strong>só neste aparelho</strong>. Nada é enviado a servidores.</p>
  `;
}

function renderTrilhas() {
  const cards = TRILHAS.map(t => {
    const liberada = trilhaLiberada(t.id);
    const concluida = trilhaConcluida(t.id);
    const iniciada = !!dados.trilhas?.[t.id];
    let status = '';
    if (concluida) status = '<span class="badge-concluida">✓ Concluída</span>';
    else if (iniciada) status = '<span class="badge-andamento">Em andamento</span>';
    else if (!liberada) status = '<span class="badge-bloqueada">🔒 Bloqueada</span>';
    if (!liberada) {
      return `<div class="card" style="opacity:0.6">
        <h3 style="margin:0 0 4px;color:var(--texto-fraco)">Trilha ${t.id} — ${esc(t.titulo)}</h3>
        <p style="margin:0;color:var(--texto-fraco);font-size:0.95rem">${esc(t.desc)} · Conclua a anterior</p>
      </div>`;
    }
    return `<a href="#trilha/${t.id}" class="card card-interativo" style="display:block;text-decoration:none;color:inherit">
      <h3 style="margin:0 0 4px;color:var(--ciano)">Trilha ${t.id} — ${esc(t.titulo)} ${status}</h3>
      <p style="margin:0;color:var(--texto-fraco);font-size:0.95rem">${esc(t.desc)}</p>
    </a>`;
  }).join('');
  $('#conteudo').innerHTML = `
    <section class="card">
      <h2>Trilhas de aprendizagem</h2>
      <p>Conclua uma trilha (80% no quiz) para liberar a próxima.</p>
    </section>
    ${cards}
  `;
}

function renderPerfil() {
  const a = dados.aluno;
  const totalFlags = (dados.flags || []).length;
  const temChave = chaveConfigurada();
  const totalFlash = Object.keys(dados.flashcards || {}).length;
  const totalDiario = (dados.diario || []).length;
  const totalAbertas = Object.keys(dados.atividadesAbertas || {}).length;

  const todos = listarTodosBadges();
  const ganhos = new Set((dados.badges || []).map(b => b.id));
  const badgesHtml = todos.map(b => `
    <div class="badge-single ${ganhos.has(b.id) ? 'ganho' : 'nao-ganho'}" title="${esc(b.desc)}">
      <span class="badge-emoji">${b.emoji}</span>
      <span class="badge-nome">${esc(b.nome)}</span>
    </div>
  `).join('');

  $('#conteudo').innerHTML = `
    <section class="card">
      <h2>Meu perfil</h2>
      <p><strong>Nome:</strong> ${esc(a.primeiroNome || '(não informado)')} ${esc(a.ultimoNome || '')}</p>
      <p><strong>Turma:</strong> ${esc(a.turma || '—')}</p>
      <p><strong>XP:</strong> ${dados.xp || 0} · <strong>Trilhas:</strong> ${Object.values(dados.trilhas || {}).filter(t => t.concluida).length}/6</p>
      <p><strong>Flashcards:</strong> ${totalFlash} · <strong>Diário:</strong> ${totalDiario} · <strong>Atividades abertas:</strong> ${totalAbertas}</p>
      ${totalFlags > 0 ? `<p style="color:var(--texto-fraco);font-size:0.9rem"><em>${totalFlags} registro(s) interno(s).</em></p>` : ''}
    </section>

    <a href="#desempenho" class="home-atalho atalho-trilhas perfil-desempenho">${ICONES.desempenho}<strong>Meu desempenho</strong><span>Aproveitamento, evolução nos quizzes e conceitos para revisar</span></a>

    <section class="card">
      <h3>Minhas conquistas</h3>
      <div class="badges-grid">${badgesHtml}</div>
    </section>

    <section class="card">
      <h3>Enviar para o professor</h3>
      <p>Arquivo cifrado que <strong>só o professor consegue abrir</strong>. Envie pelo canal combinado.</p>
      ${temChave
        ? `<p style="color:var(--texto-fraco);font-size:0.9rem">Código da chave: <code id="fp-chave">…</code></p>
           <div class="btn-grupo"><button class="btn" id="btn-enviar-prof">📤 Gerar arquivo</button></div>`
        : `<div class="feedback info">O professor ainda não configurou a chave de envio.</div>`}
    </section>

    <section class="card">
      <h3>Backup e privacidade</h3>
      <p>Guarda <strong>apenas neste navegador</strong>: nome, turma, progresso, respostas e diário. Nada vai a servidores — o professor só recebe o arquivo que você gerar acima.</p>
      <div class="btn-grupo">
        <button class="btn btn-secundario" id="btn-exportar">Baixar backup (.json)</button>
        <button class="btn btn-secundario" id="btn-importar">Importar progresso</button>
        <button class="btn btn-perigo" id="btn-apagar">Apagar tudo</button>
      </div>
      <input type="file" id="input-importar" accept=".json,application/json" style="display:none">
    </section>
  `;

  const fp = document.getElementById('fp-chave');
  if (fp) fingerprintChave().then(v => { fp.textContent = v; }).catch(() => { fp.textContent = '—'; });

  const btnEnviar = document.getElementById('btn-enviar-prof');
  if (btnEnviar) {
    btnEnviar.addEventListener('click', async () => {
      btnEnviar.disabled = true;
      btnEnviar.textContent = 'Gerando…';
      try {
        await exportarParaProfessor(dados);
        avisar('Arquivo gerado. Envie para o professor pelo canal combinado.', 'ok');
      } catch (e) { avisar('Não foi possível gerar o arquivo: ' + e.message, 'erro', 6000); }
      finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = '📤 Gerar arquivo';
      }
    });
  }

  $('#btn-exportar').addEventListener('click', () => {
    if (storage.exportar()) avisar('Backup baixado.', 'ok');
    else avisar('Não foi possível gerar o backup.', 'erro');
  });
  $('#btn-importar').addEventListener('click', () => $('#input-importar').click());
  $('#input-importar').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { avisar('Arquivo grande demais para ser um backup.', 'erro'); return; }
    const ok = await confirmar({
      titulo: 'Importar este backup?',
      texto: 'O progresso atual deste aparelho será substituído pelo do arquivo. A importação fica registrada no relatório do professor.',
      ok: 'Importar', perigo: true
    });
    if (!ok) return;
    let texto;
    try { texto = await file.text(); } catch (_) { avisar('Não foi possível ler o arquivo.', 'erro'); return; }
    const novo = storage.importar(texto, dados?.nonceDispositivo);
    if (novo) { dados = novo; atualizarXP(); avisar('Backup importado.', 'ok'); navegar('perfil'); }
    else avisar('Este arquivo não é um backup válido do Ondulatória.', 'erro', 6000);
  });
  $('#btn-apagar').addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Apagar todo o progresso?',
      texto: 'Nome, trilhas, XP, conquistas, flashcards e diário serão apagados deste aparelho. Não dá para desfazer. Se quiser, baixe um backup antes.',
      ok: 'Apagar tudo', perigo: true, icone: '⚠️'
    });
    if (!ok) return;
    storage.apagar();
    dados = storage.inicializar();
    corrompido = null;
    atualizarXP();
    avisar('Dados apagados.', 'ok');
    navegar('inicio');
  });
}

const rotasBase = { 'inicio': renderInicio, 'trilhas': renderTrilhas, 'perfil': renderPerfil };

function navegar(rota) {
  cleanupLab();
  cleanupTrilha();
  cleanupPraticar();

  if (!dados && corrompido) {
    renderRecuperacao();
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('ativo'));
    setTitulo('recuperacao');
    return;
  }

  if (!dados || !dados.aluno.primeiroNome) {
    renderOnboarding();
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('ativo'));
    setTitulo(rota || 'inicio');
    return;
  }

  const partes = rota.split('/');
  const base = partes[0];
  const param = partes[1];

  if (base === 'trilha' && param) {
    if (!IDS_TRILHAS.has(param)) {
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('ativo', el.dataset.rota === 'trilhas');
      });
      setTitulo('trilhas');
      $('#conteudo').innerHTML = `
        <section class="card">
          <h2>Trilha não encontrada</h2>
          <p>A trilha "${esc(param)}" não existe. Este app tem 6 trilhas (1 a 6).</p>
          <a href="#trilhas" class="btn">Voltar às trilhas</a>
        </section>`;
      const main = $('#conteudo');
      if (main) main.focus();
      return;
    }
    if (!trilhaLiberada(param)) {
      avisar('Trilha bloqueada. Conclua a anterior para liberar.', 'info');
      history.replaceState(history.state, '', '#trilhas');
      navegar('trilhas');
      return;
    }
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('ativo', el.dataset.rota === 'trilhas');
    });
    setTitulo('trilhas');
    renderTrilha(param, dados, salvarDados);
    atualizarXP();
    const mainT = $('#conteudo');
    if (mainT) mainT.focus();
    return;
  }

  const fn = rotasBase[base] || renderInicio;
  $('#conteudo').innerHTML = '';
  if (base === 'lab') renderLabModule(dados, salvarDados);
  else if (base === 'desempenho') renderDesempenho(dados, TRILHAS, { totalBadges: listarTodosBadges().length });
  else if (base === 'praticar') renderPraticarModule(dados, salvarDados);
  else fn();

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('ativo', el.dataset.rota === (base === 'desempenho' ? 'perfil' : (base || 'inicio')));
  });
  setTitulo(base || 'inicio');
  atualizarXP();
  const main = $('#conteudo');
  if (main) main.focus();
}

instalarGuardaSaida();
window.addEventListener('hashchange', () => navegar(location.hash.slice(1) || 'inicio'));
navegar(location.hash.slice(1) || 'inicio');
atualizarXP();
atualizarBadgeProfessor();
if (abrirComProf) pedirPinProfessor();