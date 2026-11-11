import { esc } from './utils.js';

function formatarData(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('pt-BR');
  } catch (_) {
    return String(iso);
  }
}

export function renderDiario(container, dados, salvarDados) {
  if (!Array.isArray(dados.diario)) dados.diario = [];

  function tela() {
    const registros = [...dados.diario].reverse();
    container.innerHTML = `
      <section class="card">
        <h2>Diário sonoro</h2>
        <p>Registre sons do seu dia e reflita. Fica <strong>só no seu aparelho</strong> — nada é enviado.</p>
        <div class="btn-grupo"><button class="btn" id="btn-novo-reg">✍️ Novo registro</button></div>
      </section>
      ${registros.length === 0
        ? '<section class="card"><p style="color:var(--texto-fraco)">Nenhum registro ainda. Comece com um som que chamou sua atenção hoje.</p></section>'
        : registros.map(r => `
            <section class="card">
              <div class="diario-header">
                <strong>${esc(r.local || '—')}</strong>
                <span>${esc(formatarData(r.quando))}</span>
              </div>
              <p><strong>Som:</strong> ${esc(r.descricao)}</p>
              ${r.altura || r.intensidade || r.timbre
                ? `<p><strong>Classificação:</strong> ${esc(r.altura || '—')} · ${esc(r.intensidade || '—')}${r.timbre ? ' · ' + esc(r.timbre) : ''}</p>`
                : ''}
              ${r.reflexao ? `<p style="color:var(--texto-fraco);font-size:0.95rem"><em>${esc(r.reflexao)}</em></p>` : ''}
              <button class="btn btn-secundario btn-pequeno" data-del="${esc(r.id)}">Apagar</button>
            </section>`).join('')
      }
    `;
    const btnNovo = container.querySelector('#btn-novo-reg');
    if (btnNovo) btnNovo.addEventListener('click', novo);
    container.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', () => {
        if (!confirm('Apagar este registro?')) return;
        dados.diario = dados.diario.filter(r => r.id !== b.dataset.del);
        salvarDados();
        tela();
      });
    });
  }

  function novo() {
    container.innerHTML = `
      <section class="card">
        <h2>Novo registro</h2>
        <form id="form-diario">
          <label for="di-local">Onde você estava?</label>
          <input id="di-local" type="text" maxlength="60" placeholder="ex: cozinha, ônibus, parque">
          <label for="di-desc">Que som você ouviu? *</label>
          <textarea id="di-desc" class="textarea-resposta" maxlength="300" required placeholder="Descreva o som..."></textarea>
          <label for="di-altura">Altura (agudo/grave)</label>
          <select id="di-altura" class="select-campo">
            <option value="">— selecione —</option>
            <option>Bem agudo</option><option>Agudo</option><option>Médio</option><option>Grave</option><option>Bem grave</option>
          </select>
          <label for="di-int">Intensidade (forte/fraco)</label>
          <select id="di-int" class="select-campo">
            <option value="">— selecione —</option>
            <option>Muito forte</option><option>Forte</option><option>Médio</option><option>Fraco</option><option>Muito fraco</option>
          </select>
          <label for="di-timbre">Timbre (opcional)</label>
          <input id="di-timbre" type="text" maxlength="60" placeholder="ex: metálico, oco, estridente">
          <label for="di-refl">Reflexão (opcional)</label>
          <textarea id="di-refl" class="textarea-resposta" maxlength="300" placeholder="O que esse som te fez pensar?"></textarea>
          <div class="btn-grupo">
            <button type="submit" class="btn">Salvar</button>
            <button type="button" class="btn btn-secundario" id="btn-cancelar">Cancelar</button>
          </div>
        </form>
      </section>
    `;

    function algoFoiDigitado() {
      const campos = ['di-local', 'di-desc', 'di-timbre', 'di-refl'];
      return campos.some(id => {
        const el = container.querySelector('#' + id);
        return el && el.value.trim().length > 0;
      });
    }

    const btnCancelar = container.querySelector('#btn-cancelar');
    if (btnCancelar) btnCancelar.addEventListener('click', () => {
      if (algoFoiDigitado() && !confirm('Descartar o que você digitou?')) return;
      tela();
    });

    const form = container.querySelector('#form-diario');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const desc = container.querySelector('#di-desc').value.trim();
      if (!desc) { alert('Descreva o som.'); return; }
      dados.diario.push({
        id: 'reg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        quando: new Date().toISOString(),
        local: container.querySelector('#di-local').value.trim(),
        descricao: desc,
        altura: container.querySelector('#di-altura').value,
        intensidade: container.querySelector('#di-int').value,
        timbre: container.querySelector('#di-timbre').value.trim(),
        reflexao: container.querySelector('#di-refl').value.trim()
      });
      salvarDados();
      tela();
    });
  }

  tela();
}