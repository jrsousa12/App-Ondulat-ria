import { gerarParChaves, descriptografarRelatorio } from './crypto.js';
import { hojeLocal } from './utils.js';

const $ = sel => document.querySelector(sel);
const CHAVE_SESSAO = 'ondulatoria_prof_priv';
let chavePrivadaAtual = null;
let chavePublicaAtual = null;
let relatoriosDecifrados = [];

// O aviso de file:// é gerenciado por file-check.js (script clássico externo).
// Este módulo só roda em http:// ou https://. Em file://, o navegador bloqueia
// módulos ES por CORS e o main é escondido pelo file-check.js.

function atualizarEstadoChave() {
  const el = $('#estado-chave');
  el.innerHTML = chavePublicaAtual
    ? '<span class="badge badge-ok">✓ Chave gerada nesta sessão</span>'
    : '<span class="badge badge-aviso">Nenhuma chave configurada nesta sessão</span>';
}

function atualizarEstadoPrivada() {
  const el = $('#estado-privada');
  const btn = $('#btn-decriptar');
  if (chavePrivadaAtual) {
    el.innerHTML = '<span class="badge badge-ok">✓ Chave privada carregada</span>';
    btn.disabled = false;
  } else {
    el.innerHTML = '<span class="badge badge-aviso">Chave privada não carregada</span>';
    btn.disabled = true;
  }
}

$('#btn-gerar').addEventListener('click', async () => {
  if (chavePublicaAtual && !confirm('Já existe uma chave nesta sessão. Substituir?')) return;
  const btn = $('#btn-gerar');
  btn.disabled = true;
  btn.textContent = 'Gerando…';
  try {
    const par = await gerarParChaves();
    chavePublicaAtual = par.publicaBase64;
    chavePrivadaAtual = par.privadaBase64;
    try { sessionStorage.setItem(CHAVE_SESSAO, par.privadaBase64); } catch (_) {}
    $('#publica-valor').textContent = par.publicaBase64;
    $('#card-publica').hidden = false;
    $('#card-privada').hidden = false;
    baixarChavePrivada(par.privadaBase64);
    atualizarEstadoChave();
    atualizarEstadoPrivada();
    alert('Chave gerada. O download da chave privada deve ter iniciado. Guarde com cuidado.');
  } catch (e) {
    console.error(e);
    alert('Erro: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔑 Gerar novo par de chaves';
  }
});

function baixarChavePrivada(b64) {
  const obj = {
    tipo: 'chave-privada-professor-ondulatoria',
    versao: 1, algoritmo: 'RSA-OAEP-2048',
    criadaEm: new Date().toISOString(),
    chavePrivadaBase64: b64,
    aviso: 'NUNCA compartilhe este arquivo.'
  };
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chave-privada-professor-${hojeLocal()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#btn-baixar-privada').addEventListener('click', () => {
  if (chavePrivadaAtual) baixarChavePrivada(chavePrivadaAtual);
});

$('#btn-copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#publica-valor').textContent);
    const b = $('#btn-copiar');
    const o = b.textContent;
    b.textContent = '✓ Copiado';
    setTimeout(() => { b.textContent = o; }, 2000);
  } catch (_) { alert('Selecione e copie manualmente.'); }
});

$('#btn-baixar-chave-publica').addEventListener('click', () => {
  if (!chavePublicaAtual) return;
  const txt = `// Chave pública do professor — gerada por professor.html\nexport const CHAVE_PUBLICA_PROFESSOR = '${chavePublicaAtual}';\n`;
  const blob = new Blob([txt], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chave-publica.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('#btn-importar').addEventListener('click', () => $('#input-privada').click());
$('#input-privada').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (obj.tipo !== 'chave-privada-professor-ondulatoria' || !obj.chavePrivadaBase64) {
      throw new Error('Chave inválida.');
    }
    chavePrivadaAtual = obj.chavePrivadaBase64;
    try { sessionStorage.setItem(CHAVE_SESSAO, chavePrivadaAtual); } catch (_) {}
    atualizarEstadoPrivada();
    alert('Chave privada importada.');
  } catch (err) { alert('Erro: ' + err.message); }
  e.target.value = '';
});

$('#btn-decriptar').addEventListener('click', () => $('#input-relatorios').click());

$('#input-relatorios').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length) return;
  const btn = $('#btn-decriptar');
  btn.disabled = true;
  btn.textContent = `Decifrando ${files.length} arquivo(s)…`;
  try {
    for (const f of files) {
      try {
        const pacote = JSON.parse(await f.text());
        if (pacote.para !== 'professor' || !pacote.chaveCifrada || !pacote.dadosCifrados) {
          relatoriosDecifrados.push({ arquivo: f.name, erro: 'Formato inválido.' });
          continue;
        }
        const r = await descriptografarRelatorio(pacote, chavePrivadaAtual);
        relatoriosDecifrados.push({ arquivo: f.name, ...r });
      } catch (err) {
        relatoriosDecifrados.push({ arquivo: f.name, erro: 'Falha ao decifrar: ' + err.message });
      }
    }
    renderizarResultados();
    $('#card-resultados').hidden = false;
    try { document.getElementById('card-resultados').scrollIntoView({ behavior: 'smooth' }); } catch (_) {}
  } finally {
    btn.disabled = false;
    btn.textContent = '🔓 Selecionar e decifrar relatórios';
  }
});

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatarData(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch (_) { return String(iso); }
}

/** Converte `valor` para número; retorna `null` se não for numérico. */
function num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Retorna string numérica segura para `toFixed`. */
function numFmt(v, decimais = 0, padrao = '—') {
  const n = num(v);
  if (n === null) return padrao;
  return n.toFixed(decimais);
}

function renderizarResultados() {
  const c = $('#lista-relatorios');
  if (!relatoriosDecifrados.length) { c.innerHTML = '<p>Nenhum relatório.</p>'; return; }

  c.innerHTML = relatoriosDecifrados.map(r => {
    try {
      if (r.erro) {
        return `<div class="relatorio erro"><div class="relatorio-header"><strong>${escapeHtml(r.arquivo)}</strong><span class="badge badge-erro">Erro</span></div><p>${escapeHtml(r.erro)}</p></div>`;
      }
      const rel = r.relatorio || {};
      const a = rel.aluno || {};
      const res = rel.resumo || {};
      const trilhas = rel.trilhas || {};
      const flags = Array.isArray(rel.flags) ? rel.flags : [];
      const abertas = rel.atividadesAbertas || {};
      const diario = Array.isArray(rel.diario) ? rel.diario : [];
      const badges = Array.isArray(rel.badges) ? rel.badges : [];

      const badgeInt = r.integro
        ? '<span class="badge badge-ok">✓ Integridade OK</span>'
        : '<span class="badge badge-erro">⚠ Integridade FALHOU</span>';

      const flagsHtml = flags.length
        ? `<details><summary><strong>⚠ ${flags.length} flag(s)</strong></summary><ul>${flags.map(f => `<li><code>${escapeHtml(f.tipo)}</code>${f.quando ? ' — ' + escapeHtml(formatarData(f.quando)) : ''}</li>`).join('')}</ul></details>`
        : '<p class="ok-msg">✓ Nenhuma flag</p>';

      const trilhasHtml = Object.entries(trilhas).map(([id, t]) => {
        const q = t.quiz || {};
        const acertos = num(q.acertos);
        const total = num(q.total);
        const pct = num(q.pct);
        const linhaQuiz = (acertos !== null && total !== null)
          ? ` · ${acertos}/${total}${pct !== null ? ` (${pct.toFixed(0)}%)` : ''}`
          : '';
        const linhaTent = t.tentativasQuiz ? ` · ${t.tentativasQuiz} tent.` : '';
        return `<li><strong>Trilha ${escapeHtml(id)}</strong>: ${t.concluida ? '✓' : '○'}${linhaQuiz}${linhaTent}</li>`;
      }).join('') || '<li>Nenhuma</li>';

      const abertasArr = Object.entries(abertas);
      const abertasHtml = abertasArr.length
        ? `<details><summary><strong>${abertasArr.length} resposta(s) aberta(s)</strong></summary><ul>${abertasArr.map(([qid, d]) => `
            <li style="margin-bottom:12px">
              <div style="font-size:0.85rem;color:var(--texto-fraco)"><code>${escapeHtml(qid)}</code> · ${escapeHtml(formatarData(d?.quando))}</div>
              <div style="margin-top:4px">${escapeHtml(d?.resposta || '')}</div>
            </li>`).join('')}</ul></details>`
        : '<p style="color:var(--texto-fraco)">Nenhuma atividade aberta respondida</p>';

      const diarioHtml = diario.length
        ? `<details><summary><strong>${diario.length} registro(s) no diário</strong></summary><ul>${diario.slice().reverse().map(d => `
            <li style="margin-bottom:12px">
              <div style="font-size:0.85rem;color:var(--texto-fraco)">${escapeHtml(d?.local || '—')} · ${escapeHtml(formatarData(d?.quando))}</div>
              <div><strong>Som:</strong> ${escapeHtml(d?.descricao || '')}</div>
              ${d?.reflexao ? `<div style="font-style:italic;color:var(--texto-fraco)">${escapeHtml(d.reflexao)}</div>` : ''}
            </li>`).join('')}</ul></details>`
        : '<p style="color:var(--texto-fraco)">Nenhum registro no diário</p>';

      const badgesHtml = badges.length
        ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${badges.map(b => `<span style="background:rgba(245,158,11,0.15);border:1px solid var(--ambar);border-radius:999px;padding:4px 10px;font-size:0.9rem">${escapeHtml(b?.emoji || '🏅')} ${escapeHtml(b?.nome || '?')}</span>`).join('')}</div>`
        : '<p style="color:var(--texto-fraco)">Nenhuma conquista</p>';

      return `
        <div class="relatorio">
          <div class="relatorio-header">
            <strong>${escapeHtml(a.primeiroNome || '?')} ${escapeHtml(a.ultimoNome || '')}</strong>
            ${badgeInt}
          </div>
          <div class="relatorio-info">
            <span>🏫 ${escapeHtml(a.turma || '—')}</span>
            <span>⭐ ${numFmt(res.xp)} XP</span>
            <span>📚 ${numFmt(res.trilhasConcluidas)}/${numFmt(res.totalTrilhas, 0, '6')} trilhas</span>
            <span>🃏 ${numFmt(res.flashcardsEstudados)} flashcards</span>
            <span>📅 ${escapeHtml(formatarData(rel.exportadoEm))}</span>
          </div>
          <div class="relatorio-bloco"><h4>Progresso</h4><ul>${trilhasHtml}</ul></div>
          <div class="relatorio-bloco"><h4>Conquistas</h4>${badgesHtml}</div>
          <div class="relatorio-bloco"><h4>Atividades abertas</h4>${abertasHtml}</div>
          <div class="relatorio-bloco"><h4>Diário sonoro</h4>${diarioHtml}</div>
          <div class="relatorio-bloco"><h4>Comportamento</h4>${flagsHtml}</div>
        </div>`;
    } catch (err) {
      return `<div class="relatorio erro"><div class="relatorio-header"><strong>${escapeHtml(r.arquivo)}</strong><span class="badge badge-erro">Erro ao renderizar</span></div><p>${escapeHtml(err.message)}</p></div>`;
    }
  }).join('');
}

/**
 * Escapa uma célula CSV:
 * 1. Se começa com caractere de fórmula (= + - @ TAB CR), prefixa com `'`
 *    ANTES de escapar (o `'` fica dentro das aspas se houver vírgula)
 * 2. Depois, se houver vírgula/aspas/quebra de linha, envolve em aspas
 *    e duplica aspas internas
 */
function celulaCSV(valor) {
  let s = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

$('#btn-exportar-csv').addEventListener('click', () => {
  const linhas = [[
    'Arquivo', 'Nome', 'Sobrenome', 'Turma', 'XP', 'Trilhas concluídas',
    'Flashcards', 'Diário', 'Abertas', 'Badges', 'Flags', 'Integridade', 'Exportado em'
  ]];
  for (const r of relatoriosDecifrados) {
    if (r.erro) {
      linhas.push([r.arquivo, 'ERRO', '', '', '', '', '', '', '', '', '', r.erro, '']);
      continue;
    }
    const rel = r.relatorio || {};
    const a = rel.aluno || {};
    const res = rel.resumo || {};
    linhas.push([
      r.arquivo,
      a.primeiroNome || '',
      a.ultimoNome || '',
      a.turma || '',
      numFmt(res.xp, 0, '0'),
      numFmt(res.trilhasConcluidas, 0, '0'),
      numFmt(res.flashcardsEstudados, 0, '0'),
      numFmt(res.registrosDiario, 0, '0'),
      numFmt(res.atividadesAbertas, 0, '0'),
      numFmt(res.badgesGanhos, 0, '0'),
      Array.isArray(rel.flags) ? rel.flags.length : 0,
      r.integro ? 'OK' : 'FALHA',
      rel.exportadoEm || ''
    ]);
  }
  const csv = linhas.map(l => l.map(celulaCSV).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorios-ondulatoria-${hojeLocal()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('#btn-limpar').addEventListener('click', () => {
  if (!confirm('Limpar todos os relatórios?')) return;
  relatoriosDecifrados = [];
  $('#card-resultados').hidden = true;
  renderizarResultados();
});

(function init() {
  try {
    const p = sessionStorage.getItem(CHAVE_SESSAO);
    if (p) chavePrivadaAtual = p;
  } catch (_) {}
  atualizarEstadoChave();
  atualizarEstadoPrivada();
})();