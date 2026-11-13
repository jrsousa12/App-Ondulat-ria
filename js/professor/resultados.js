import { $, estado } from './estado.js';

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
export function numFmt(v, decimais = 0, padrao = '—') {
  const n = num(v);
  if (n === null) return padrao;
  return n.toFixed(decimais);
}

export function renderizarResultados() {
  const c = $('#lista-relatorios');
  if (!estado.relatorios.length) { c.innerHTML = '<p>Nenhum relatório.</p>'; return; }

  c.innerHTML = estado.relatorios.map(r => {
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
            ${rel.questoes?.aproveitamento != null ? `<span>🎯 ${numFmt(rel.questoes.aproveitamento)}% de acertos</span>` : ''}
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
