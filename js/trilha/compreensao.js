import { esc } from '../utils.js';
import { etapas } from '../ui.js';
import * as fx from '../fx.js';
import { pausarTimerLeitura } from './leitura.js';

export function iniciarCompreensao(ctx) {
  const { estado } = ctx;
  pausarTimerLeitura(estado);
  estado.fase = 'compreensao';
  estado.compreensaoRespostas = [];
  renderCompreensao(ctx, 0);
}

function renderCompreensao(ctx, indice) {
  const { trilha, conteudo, registrarCleanup } = ctx;
  registrarCleanup(() => {});
  const perguntas = trilha.perguntasCompreensao;
  if (indice >= perguntas.length) { finalizarCompreensao(ctx); return; }
  const p = perguntas[indice];
  const total = perguntas.length;
  conteudo.innerHTML = `
    ${etapas(1, 1)}
    <section class="card card-pergunta">
      <div class="quiz-header">
        <span>Compreensão ${indice + 1} de ${total}</span>
      </div>
      <div class="quiz-progresso-barra"><div style="width:${(indice / total) * 100}%"></div></div>
      <h3>${esc(p.pergunta)}</h3>
      <div id="alternativas"></div>
      <div id="feedback-compreensao"></div>
    </section>
  `;
  const alts = document.getElementById('alternativas');
  p.alternativas.forEach((txt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'alternativa';
    btn.textContent = txt;
    btn.addEventListener('click', () => responderCompreensao(ctx, indice, i));
    alts.appendChild(btn);
  });
}

function responderCompreensao(ctx, indice, escolha) {
  const { trilha, estado } = ctx;
  const p = trilha.perguntasCompreensao[indice];
  const acertou = escolha === p.correta;
  estado.compreensaoRespostas.push({ id: p.id, escolha, correta: p.correta, acertou });

  const botoes = document.querySelectorAll('#alternativas .alternativa');
  botoes.forEach((b, i) => {
    b.disabled = true;
    if (i === p.correta) b.classList.add('correta');
    else if (i === escolha) b.classList.add('incorreta');
  });
  if (acertou) fx.acerto(); else fx.erro();

  const fb = document.getElementById('feedback-compreensao');
  fb.innerHTML = `
    <div class="feedback ${acertou ? 'ok' : 'erro'}">
      <strong>${acertou ? '✓ Correto!' : '✗ Não foi essa.'}</strong>
      <p style="margin-top:6px">${esc(p.explicacao)}</p>
    </div>
    <div class="btn-grupo">
      <button class="btn" id="btn-proxima-comp">${indice + 1 < trilha.perguntasCompreensao.length ? 'Próxima' : 'Continuar'}</button>
    </div>
  `;
  document.getElementById('btn-proxima-comp').addEventListener('click', () => {
    renderCompreensao(ctx, indice + 1);
  });
}

function finalizarCompreensao(ctx) {
  const { id, dados, salvarDados, trilha, estado, conteudo, registrarCleanup, ir } = ctx;
  registrarCleanup(() => {});
  const acertos = estado.compreensaoRespostas.filter(r => r.acertou).length;
  const total = trilha.perguntasCompreensao.length;
  const passou = acertos >= Math.ceil(total * 2 / 3);

  if (!passou) {
    conteudo.innerHTML = `
      <section class="card resultado-hero">
        <span class="emoji">📖</span>
        <h2>Vamos revisar?</h2>
        <p>Você acertou <strong>${acertos} de ${total}</strong> perguntas de compreensão. Para seguir, precisamos de ao menos ${Math.ceil(total * 2 / 3)} acertos.</p>
        <p style="color:var(--texto-fraco)">Volte ao texto e leia com calma — as perguntas cobram os conceitos principais.</p>
        <div class="btn-grupo" style="justify-content:center">
          <button class="btn btn-secundario" id="btn-reler">Reler o texto</button>
        </div>
      </section>`;
    document.getElementById('btn-reler').addEventListener('click', () => {
      window.scrollTo(0, 0);
      ir.leitura();
    });
    return;
  }

  if (!dados.trilhas) dados.trilhas = {};
  if (!dados.trilhas[id]) dados.trilhas[id] = {};
  dados.trilhas[id].compreensao = { acertos, total };
  salvarDados();
  ir.quiz();
}
