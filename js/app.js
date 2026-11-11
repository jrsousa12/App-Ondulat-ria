import { storage, consumirErroQuota } from './storage.js';
import { esc } from './utils.js';
import { renderTrilha, cleanupTrilha } from './trilhas.js';
import { renderLab as renderLabModule, cleanupLab } from './lab.js';
import { renderPraticar as renderPraticarModule, cleanupPraticar } from './praticar.js';
import { exportarParaProfessor, chaveConfigurada, fingerprintChave } from './relatorio.js';
import { estaEmModoProfessor, ativarModoProfessor, desativarModoProfessor } from './modo-professor.js';
import { verificarNovosBadges, mostrarToastBadges, listarTodosBadges } from './badges.js';

const $ = sel => document.querySelector(sel);

// ⚠️ PIN em plaintext é FRICÇÃO, não segurança. Está documentado no relatório
// de segurança do projeto. Trocar por hash daria falsa sensação de segurança
// (o hash ficaria exposto no mesmo código). Se quiser autenticação real,
// seria necessário backend.
const PIN_PROFESSOR = 'ondas2026';

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

function mostrarAvisoQuota() {
  if (document.querySelector('.aviso-quota')) return;
  const el = document.createElement('div');
  el.className = 'aviso-quota';
  el.setAttribute('role', 'alert');
  el.textContent = 'Não foi possível salvar. Verifique espaço no navegador ou modo privado.';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
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
  'perfil': 'Perfil'
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
  document.getElementById('btn-comecar-zero').addEventListener('click', () => {
    if (!confirm('Começar do zero apaga o arquivo danificado. Continuar?')) return;
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
      el.addEventListener('click', () => {
        if (confirm('Desativar modo professor?')) {
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

let tapCount = 0, tapTimer = null;
const logoEl = document.querySelector('.logo');
if (logoEl) {
  logoEl.style.cursor = 'pointer';
  logoEl.addEventListener('click', () => {
    tapCount++;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 800);
    if (tapCount >= 7) {
      tapCount = 0;
      const pin = prompt('PIN do professor:');
      if (pin === null) return;
      if (pin === PIN_PROFESSOR) {
        ativarModoProfessor();
        atualizarBadgeProfessor();
        alert('Modo professor ativado.');
        navegar(location.hash.slice(1) || 'inicio');
      } else alert('PIN incorreto.');
    }
  });
}

if (location.hash === '#prof') {
  history.replaceState(null, '', location.pathname);
  const pin = prompt('PIN do professor:');
  if (pin === PIN_PROFESSOR) {
    ativarModoProfessor();
    atualizarBadgeProfessor();
    alert('Modo professor ativado.');
  } else if (pin !== null) alert('PIN incorreto.');
}

/* ============ Tema ============ */
(function aplicarTema() {
  const salvo = localStorage.getItem('ondulatoria_tema');
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
    if (!p || !u) { alert('Preencha primeiro e último nome.'); return; }
    dados.aluno.primeiroNome = p;
    dados.aluno.ultimoNome = u;
    dados.aluno.turma = t;
    salvarDados();
    navegar('inicio');
  });
}

/* ============ Páginas ============ */
function renderInicio() {
  const nome = dados.aluno.primeiroNome ? `, ${esc(dados.aluno.primeiroNome)}` : '';
  const concluidas = Object.values(dados.trilhas || {}).filter(t => t.concluida).length;
  const pct = Math.round((concluidas / 6) * 100);
  const badgeCount = (dados.badges || []).length;
  $('#conteudo').innerHTML = `
    <section class="card">
      <h2>Olá${nome}!</h2>
      <p>Progresso fica <strong>só no seu aparelho</strong> — nada é enviado a servidores.</p>
    </section>
    <section class="card">
      <h3>Seu progresso</h3>
      <p><strong>${concluidas} de 6</strong> trilhas concluídas · <strong>${dados.xp || 0} XP</strong> · <strong>${badgeCount}</strong> conquista(s)</p>
      <div class="progresso-trilhas-barra"><div class="progresso-trilhas-fill" style="width:${pct}%"></div></div>
      <div class="btn-grupo">
        <a href="#trilhas" class="btn">Trilhas</a>
        <a href="#praticar" class="btn btn-secundario">Praticar</a>
      </div>
    </section>
  `;
}

function renderTrilhas() {
  const lista = [
    { id: '1', titulo: 'Ondas: o que são e como se propagam', desc: 'Revisão + classificação' },
    { id: '2', titulo: 'As grandezas das ondas', desc: 'λ, A, f, T e v = λ·f' },
    { id: '3', titulo: 'O som como onda', desc: 'Produção, propagação e velocidade' },
    { id: '4', titulo: 'As qualidades do som', desc: 'Altura, intensidade, timbre' },
    { id: '5', titulo: 'Fenômenos sonoros', desc: 'Reflexão, refração, difração, ressonância' },
    { id: '6', titulo: 'Som no cotidiano e saúde auditiva', desc: 'Decibéis, poluição, proteção' }
  ];
  const cards = lista.map(t => {
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
  const fingerprint = fingerprintChave();
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

    <section class="card">
      <h3>Minhas conquistas</h3>
      <div class="badges-grid">${badgesHtml}</div>
    </section>

    <section class="card">
      <h3>Enviar para o professor</h3>
      <p>Arquivo cifrado que <strong>só o professor consegue abrir</strong>. Envie pelo canal combinado.</p>
      ${temChave
        ? `<p style="color:var(--texto-fraco);font-size:0.9rem">Chave: <code>${esc(fingerprint)}</code></p>
           <div class="btn-grupo"><button class="btn" id="btn-enviar-prof">📤 Gerar arquivo</button></div>`
        : `<div class="feedback info">O professor ainda não configurou a chave de envio.</div>`}
    </section>

    <section class="card">
      <h3>Backup e privacidade</h3>
      <p>Guarda <strong>apenas no navegador</strong>: nome, turma, progresso, respostas e diário. Nada vai a servidores.</p>
      <div class="btn-grupo">
        <button class="btn btn-secundario" id="btn-exportar">Baixar backup (.json)</button>
        <button class="btn btn-secundario" id="btn-importar">Importar progresso</button>
        <button class="btn btn-perigo" id="btn-apagar">Apagar tudo</button>
      </div>
      <input type="file" id="input-importar" accept=".json,application/json" style="display:none">
    </section>
  `;

  const btnEnviar = document.getElementById('btn-enviar-prof');
  if (btnEnviar) {
    btnEnviar.addEventListener('click', async () => {
      btnEnviar.disabled = true;
      btnEnviar.textContent = 'Gerando…';
      try {
        await exportarParaProfessor(dados);
        alert('Arquivo gerado. Envie para o professor.');
      } catch (e) { alert('Erro: ' + e.message); }
      finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = '📤 Gerar arquivo';
      }
    });
  }

  $('#btn-exportar').addEventListener('click', () => {
    if (!storage.exportar()) alert('Não foi possível exportar.');
  });
  $('#btn-importar').addEventListener('click', () => $('#input-importar').click());
  $('#input-importar').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const novo = storage.importar(reader.result);
      if (novo) { dados = novo; atualizarXP(); alert('Importado!'); navegar('perfil'); }
      else alert('Arquivo inválido.');
    };
    reader.onerror = () => alert('Erro ao ler o arquivo.');
    reader.readAsText(file);
  });
  $('#btn-apagar').addEventListener('click', () => {
    if (confirm('Apagar TUDO?') && confirm('Tem certeza?')) {
      storage.apagar();
      dados = storage.inicializar();
      corrompido = null;
      atualizarXP();
      alert('Dados apagados.');
      navegar('inicio');
    }
  });
}

const rotasBase = { 'inicio': renderInicio, 'trilhas': renderTrilhas, 'perfil': renderPerfil };
const TRILHAS_VALIDAS = new Set(['1', '2', '3', '4', '5', '6']);

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
    if (!TRILHAS_VALIDAS.has(param)) {
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
      alert('Trilha bloqueada. Conclua a anterior.');
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
  else if (base === 'praticar') renderPraticarModule(dados, salvarDados);
  else fn();

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('ativo', el.dataset.rota === (base || 'inicio'));
  });
  setTitulo(base || 'inicio');
  atualizarXP();
  const main = $('#conteudo');
  if (main) main.focus();
}

window.addEventListener('hashchange', () => navegar(location.hash.slice(1) || 'inicio'));
navegar(location.hash.slice(1) || 'inicio');
atualizarXP();
atualizarBadgeProfessor();