import { esc } from './utils.js';
import { confirmar, avisar } from './dialogos.js';
import { TRILHAS, carregarJSON } from './conteudo.js';

async function carregarAbertas(trilhaId) {
  try {
    const banco = await carregarJSON(`dados/questoes-trilha-${trilhaId}.json`);
    return banco.questoes.filter(q => q.tipo === 'aberta' || q.tipo === 'analise_erro');
  } catch (e) {
    console.error('[abertas]', e);
    return [];
  }
}

export async function renderAbertas(container, dados, salvarDados, aindaAtual = () => true) {
  if (!dados.atividadesAbertas || typeof dados.atividadesAbertas !== 'object') {
    dados.atividadesAbertas = {};
  }

  async function tela() {
    container.innerHTML = '<section class="card"><p>Carregando…</p></section>';
    const porTrilha = await Promise.all(
      TRILHAS.map(async t => ({ ...t, abertas: await carregarAbertas(t.id) }))
    );
    if (!aindaAtual()) return;

    container.innerHTML = `
      <section class="card">
        <h2>Atividades abertas</h2>
        <p>Questões de resposta livre e análise de erro. Suas respostas ficam salvas e vão no relatório — <strong>o professor avalia</strong>.</p>
      </section>
      ${porTrilha.map(t => {
        if (!t.abertas.length) return '';
        const respondidas = t.abertas.filter(q => dados.atividadesAbertas[q.id]).length;
        const total = t.abertas.length;
        const ok = respondidas === total;
        return `
          <button type="button" class="card card-interativo card-botao" data-trilha="${t.id}">
            <h3 style="margin:0 0 4px;color:var(--ciano)">Trilha ${t.id} — ${esc(t.titulo)}</h3>
            <p style="margin:0;color:var(--texto-fraco);font-size:0.9rem">
              ${ok ? '✓ ' : ''}${respondidas} de ${total} respondida(s)
            </p>
          </button>
        `;
      }).join('')}
    `;

    container.querySelectorAll('[data-trilha]').forEach(el => {
      el.addEventListener('click', () => {
        const t = porTrilha.find(x => x.id === el.dataset.trilha);
        if (t) iniciar(t);
      });
    });
  }

  function iniciar(trilha) {
    let indice = 0;

    function render() {
      if (indice >= trilha.abertas.length) {
        salvarDados();
        tela();
        return;
      }
      const q = trilha.abertas[indice];
      const jaFeita = dados.atividadesAbertas[q.id];
      const total = trilha.abertas.length;

      container.innerHTML = `
        <section class="card">
          <div class="quiz-header">
            <span>${esc(trilha.titulo)} · ${indice + 1} de ${total}</span>
            <button class="btn btn-secundario btn-pequeno" id="btn-sair">Sair</button>
          </div>
          <div class="quiz-progresso-barra"><div style="width:${(indice / total) * 100}%"></div></div>
          <p style="font-size:0.9rem;color:var(--texto-fraco);margin-bottom:var(--esp-2)">
            ${q.tipo === 'analise_erro' ? 'Análise de erro' : 'Resposta livre'} · avaliada pelo professor
          </p>
          <h3>${esc(q.enunciado)}</h3>
          ${q.criterios && q.criterios.length
            ? `<details style="margin:var(--esp-2) 0"><summary style="cursor:pointer;color:var(--ambar)">Ver critérios de avaliação</summary>
                <ul style="margin:8px 0 0 20px;font-size:0.95rem;color:var(--texto-fraco)">
                  ${q.criterios.map(c => `<li>${esc(c)}</li>`).join('')}
                </ul>
              </details>`
            : ''}
          <textarea class="textarea-resposta" id="resp-aberta" maxlength="800" placeholder="Digite sua resposta (2–4 linhas)">${jaFeita ? esc(jaFeita.resposta) : ''}</textarea>
          <div class="btn-grupo">
            <button class="btn" id="btn-enviar">${indice + 1 < total ? 'Próxima' : 'Concluir'}</button>
            <button class="btn btn-secundario" id="btn-pular">Pular</button>
          </div>
        </section>
      `;

      const textarea = container.querySelector('#resp-aberta');
      const original = jaFeita ? jaFeita.resposta : '';
      const foiAlterado = () => textarea && textarea.value.trim() !== original.trim();

      const btnSair = container.querySelector('#btn-sair');
      if (btnSair) btnSair.addEventListener('click', async () => {
        if (foiAlterado() && !await confirmar({ titulo: 'Descartar o que você digitou?', ok: 'Descartar', perigo: true })) return;
        tela();
      });

      const btnPular = container.querySelector('#btn-pular');
      if (btnPular) btnPular.addEventListener('click', async () => {
        if (foiAlterado() && !await confirmar({ titulo: 'Descartar o que você digitou?', ok: 'Descartar', perigo: true })) return;
        indice++;
        render();
      });

      const btnEnviar = container.querySelector('#btn-enviar');
      if (btnEnviar) btnEnviar.addEventListener('click', () => {
        const resp = textarea.value.trim();
        if (resp.length < 10) { avisar('Escreva pelo menos uma frase.', 'erro'); textarea.focus(); return; }
        dados.atividadesAbertas[q.id] = {
          resposta: resp,
          quando: new Date().toISOString(),
          trilha: trilha.id
        };
        salvarDados();
        indice++;
        render();
      });
    }

    render();
  }

  tela();
}