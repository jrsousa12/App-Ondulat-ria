import { esc, formatarDuracao } from '../utils.js';
import { iconeTrilha, etapas } from '../ui.js';

export function pausarTimerLeitura(estado) {
  if (estado.ultimaVisibilidadeMs !== null && estado.fase === 'leitura') {
    estado.tempoLeituraVisivelMs += Date.now() - estado.ultimaVisibilidadeMs;
    estado.ultimaVisibilidadeMs = null;
  }
}
export function retomarTimerLeitura(estado) {
  if (estado.fase === 'leitura' && estado.ultimaVisibilidadeMs === null) {
    estado.ultimaVisibilidadeMs = Date.now();
  }
}

export function renderLeitura(ctx) {
  const { estado, conteudo, trilha, id, registrarCleanup, ir } = ctx;
  estado.fase = 'leitura';
  estado.chegouAoFim = false;
  if (estado.ultimaVisibilidadeMs === null) estado.ultimaVisibilidadeMs = Date.now();

  const totalMin = (estado.tempoEstimadoMs / 60_000).toFixed(1);
  conteudo.innerHTML = `
    <div class="progresso-leitura" aria-hidden="true">
      <div class="progresso-leitura-fill" id="prog-leitura"></div>
    </div>
    <a href="#trilhas" class="tela-voltar">← Trilhas</a>
    <section class="leitura-hero">
      <span class="leitura-icone">${iconeTrilha(id)}</span>
      <p class="tela-rotulo">Trilha ${esc(id)}</p>
      <h2>${esc(trilha.titulo)}</h2>
      <p class="leitura-sub">${esc(trilha.subtitulo || '')}</p>
      <div class="meta-leitura">
        <span>⏱ ~${totalMin} min</span>
        <span>📖 ${trilha.secoes.length} seções</span>
        <span>❓ 3 perguntas + quiz de 10</span>
      </div>
    </section>
    ${etapas(0, 0)}
    ${trilha.secoes.map((s, i) => `
      <section class="card secao-leitura" data-secao="${esc(s.id)}">
        <h3><span class="secao-num">${i + 1}</span>${esc(s.titulo)}</h3>
        ${s.texto.map(p => `<p>${esc(p)}</p>`).join('')}
      </section>
    `).join('')}
    <section class="card leitura-fim">
      <p class="leitura-links"><a href="#ficha/${esc(id)}">🖨️ Ficha da aula para imprimir</a> · <a href="#fontes/trilhas">📚 Fontes para aprofundar</a></p>
      <p id="msg-leitura" role="status" aria-live="polite"></p>
      <button class="btn btn-grande" id="btn-ir-compreensao">Ir para as perguntas →</button>
    </section>
  `;

  const prog = document.getElementById('prog-leitura');
  const atualizarProg = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100;
    if (prog) prog.style.width = pct + '%';
    if (pct >= 95) {
      estado.chegouAoFim = true;
      atualizarMensagemLeitura();
    }
  };
  window.addEventListener('scroll', atualizarProg, { passive: true });
  setTimeout(atualizarProg, 100);

  function atualizarMensagemLeitura() {
    const msg = document.getElementById('msg-leitura');
    if (!msg) return;
    const decorrido = estado.tempoLeituraVisivelMs + (estado.ultimaVisibilidadeMs ? Date.now() - estado.ultimaVisibilidadeMs : 0);
    const minDecorrido = Math.floor(decorrido / 60_000);
    const minNecessario = Math.ceil((estado.tempoEstimadoMs * 0.6) / 60_000);
    if (estado.chegouAoFim && minDecorrido >= minNecessario) {
      msg.textContent = `✓ Leitura concluída em ${formatarDuracao(decorrido)}.`;
      msg.className = 'msg-ok';
    } else if (!estado.chegouAoFim) {
      msg.textContent = 'Role até o fim do texto para continuar.';
      msg.className = '';
    } else {
      msg.textContent = `Continue lendo mais um pouco (${minDecorrido}/${minNecessario} min) — a leitura completa vale mais XP.`;
      msg.className = 'msg-alerta';
    }
  }

  const interval = setInterval(atualizarMensagemLeitura, 5000);
  atualizarMensagemLeitura();

  registrarCleanup(() => {
    window.removeEventListener('scroll', atualizarProg);
    clearInterval(interval);
  });

  document.getElementById('btn-ir-compreensao').addEventListener('click', () => {
    ir.compreensao();
  });
}
