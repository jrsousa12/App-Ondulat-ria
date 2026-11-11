import { esc } from './utils.js';

const TRILHAS = [
  { id: '1', titulo: 'Ondas: o que são e como se propagam' },
  { id: '2', titulo: 'As grandezas das ondas' },
  { id: '3', titulo: 'O som como onda' },
  { id: '4', titulo: 'As qualidades do som' },
  { id: '5', titulo: 'Fenômenos sonoros' },
  { id: '6', titulo: 'Som no cotidiano e saúde auditiva' }
];

const cache = {};

async function carregarAbertas(trilhaId) {
  if (cache[trilhaId]) return cache[trilhaId];
  try {
    const res = await fetch(`dados/questoes-trilha-${trilhaId}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const banco = await res.json();
    const abertas = banco.questoes.filter(q => q.tipo === 'aberta' || q.tipo === 'analise_erro');
    cache[trilhaId] = abertas;
    return abertas;
  } catch (e) {
    console.error('[abertas]', e);
    return [];
  }
}

export async function renderAbertas(container, dados, salvarDados) {
  if (!dados.atividadesAbertas || typeof dados.atividadesAbertas !== 'object') {
    dados.atividadesAbertas = {};
  }

  async function tela() {
    container.innerHTML = '<section class="card"><p>Carregando…</p></section>';
    const porTrilha = await Promise.all(
      TRILHAS.map(async t => ({ ...t, abertas: await carregarAbertas(t.id) }))
    );

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
          <a href="#" class="card card-interativo" data-trilha="${t.id}" style="display:block;text-decoration:none;color:inherit">
            <h3 style="margin:0 0 4px;color:var(--ciano)">Trilha ${t.id} — ${esc(t.titulo)}</h3>
            <p style="margin:0;color:var(--texto-fraco);font-size:0.9rem">
              ${ok ? '✓ ' : ''}${respondidas} de ${total} respondida(s)
            </p>
          </a>
        `;
      }).join('')}
    `;

    container.querySelectorAll('[data-trilha]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
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
      if (btnSair) btnSair.addEventListener('click', () => {
        if (foiAlterado() && !confirm('Descartar o que você digitou?')) return;
        tela();
      });

      const btnPular = container.querySelector('#btn-pular');
      if (btnPular) btnPular.addEventListener('click', () => {
        if (foiAlterado() && !confirm('Descartar o que você digitou?')) return;
        indice++;
        render();
      });

      const btnEnviar = container.querySelector('#btn-enviar');
      if (btnEnviar) btnEnviar.addEventListener('click', () => {
        const resp = textarea.value.trim();
        if (resp.length < 10) { alert('Escreva pelo menos uma frase.'); return; }
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