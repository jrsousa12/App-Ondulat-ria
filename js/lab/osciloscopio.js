/* Osciloscópio: onda com frequência e amplitude ajustáveis, com som. */
import { audio } from '../audio.js';
import { avisar } from '../dialogos.js';
import { paleta } from './paleta.js';

export function montarOsciloscopio(area, dados, salvarDados) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    freq: dados.labPrefs?.freq || 440,
    amp: dados.labPrefs?.amp || 0.7,
    playing: false,
    raf: null,
    lastTime: performance.now(),
    t: 0
  };

  area.innerHTML = `
    <section class="card">
      <h3>Osciloscópio</h3>
      <p>Ajuste a <strong>frequência</strong> e a <strong>amplitude</strong> e veja como a onda muda. Embaixo, o que um ponto fixo "sente".</p>

      <div class="lab-canvas-wrap">
        <canvas id="cv-onda" class="lab-canvas" aria-label="Onda viajando no espaço"></canvas>
      </div>
      <p class="lab-legenda">Onda viajando no espaço (o ponto laranja fica no lugar e só sobe/desce) →</p>

      <div class="lab-canvas-wrap">
        <canvas id="cv-trace" class="lab-canvas lab-canvas-baixo" aria-label="Traço do osciloscópio"></canvas>
      </div>
      <p class="lab-legenda">Osciloscópio: o que o ponto fixo sente ao longo do tempo →</p>

      <div class="lab-controles">
        <label for="freq">Frequência: <strong><span id="freq-val">${state.freq}</span> Hz</strong></label>
        <input type="range" id="freq" min="200" max="1000" step="10" value="${state.freq}">
        <label for="amp">Amplitude: <strong><span id="amp-val">${Math.round(state.amp * 100)}</span>%</strong></label>
        <input type="range" id="amp" min="10" max="100" step="5" value="${Math.round(state.amp * 100)}">
      </div>

      <div class="lab-valores" role="status" aria-live="polite">
        <div><span>λ</span><strong id="val-lambda">--</strong><small>m</small></div>
        <div><span>T</span><strong id="val-periodo">--</strong><small>s</small></div>
        <div><span>v</span><strong>340</strong><small>m/s</small></div>
      </div>

      <div class="btn-grupo">
        <button class="btn" id="btn-toggle-audio" aria-label="Tocar som">▶ Tocar som</button>
        <label class="lab-mute">
          <input type="checkbox" id="chk-mute">
          <span>Silenciar</span>
        </label>
      </div>
      <p class="lab-aviso">🔊 <strong>Use fones em volume confortável.</strong> O volume aqui é limitado a 30% por segurança. A amplitude também afeta o volume percebido.</p>
    </section>
  `;

  const cvOnda = document.getElementById('cv-onda');
  const cvTrace = document.getElementById('cv-trace');
  const ctxOnda = cvOnda.getContext('2d');
  const ctxTrace = cvTrace.getContext('2d');
  let W1 = 0, H1 = 0, W2 = 0, H2 = 0;

  function resize() {
    const DPR = window.devicePixelRatio || 1;
    const r1 = cvOnda.getBoundingClientRect();
    const r2 = cvTrace.getBoundingClientRect();
    W1 = r1.width; H1 = r1.height;
    W2 = r2.width; H2 = r2.height;
    cvOnda.width = W1 * DPR; cvOnda.height = H1 * DPR;
    cvTrace.width = W2 * DPR; cvTrace.height = H2 * DPR;
    ctxOnda.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctxTrace.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function atualizarValores() {
    const v = 340, f = state.freq;
    document.getElementById('freq-val').textContent = f;
    document.getElementById('amp-val').textContent = Math.round(state.amp * 100);
    document.getElementById('val-lambda').textContent = (v / f).toFixed(2);
    document.getElementById('val-periodo').textContent = (1 / f).toFixed(4);
  }

  let saveTimeout = null;
  function salvarDebounced() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (!dados.labPrefs) dados.labPrefs = {};
      dados.labPrefs.freq = state.freq;
      dados.labPrefs.amp = state.amp;
      salvarDados();
      saveTimeout = null;
    }, 300);
  }
  function flushSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      if (!dados.labPrefs) dados.labPrefs = {};
      dados.labPrefs.freq = state.freq;
      dados.labPrefs.amp = state.amp;
      salvarDados();
      saveTimeout = null;
    }
  }

  function draw() {
    const P = paleta();
    if (!W1 || !H1) return;

    ctxOnda.clearRect(0, 0, W1, H1);
    ctxOnda.beginPath();
    ctxOnda.moveTo(0, H1 / 2);
    ctxOnda.lineTo(W1, H1 / 2);
    ctxOnda.strokeStyle = P.grade;
    ctxOnda.lineWidth = 1;
    ctxOnda.stroke();

    const numWaves = state.freq / 200;
    const lambdaPx = W1 / numWaves;
    const fVis = state.freq / 200;
    const A = state.amp * (H1 / 2 - 12);

    ctxOnda.beginPath();
    ctxOnda.strokeStyle = P.onda;
    ctxOnda.lineWidth = 2.5;
    ctxOnda.lineCap = 'round';
    for (let x = 0; x <= W1; x += 1.5) {
      const y = H1 / 2 - A * Math.sin(2 * Math.PI * x / lambdaPx - 2 * Math.PI * fVis * state.t);
      if (x === 0) ctxOnda.moveTo(x, y); else ctxOnda.lineTo(x, y);
    }
    ctxOnda.stroke();

    const xM = W1 / 2;
    const yM = H1 / 2 - A * Math.sin(2 * Math.PI * xM / lambdaPx - 2 * Math.PI * fVis * state.t);
    ctxOnda.beginPath();
    ctxOnda.arc(xM, yM, 6, 0, Math.PI * 2);
    ctxOnda.fillStyle = P.ponto;
    ctxOnda.fill();
    ctxOnda.strokeStyle = P.fundo;
    ctxOnda.lineWidth = 2;
    ctxOnda.stroke();

    if (!W2 || !H2) return;
    ctxTrace.clearRect(0, 0, W2, H2);
    ctxTrace.beginPath();
    ctxTrace.moveTo(0, H2 / 2);
    ctxTrace.lineTo(W2, H2 / 2);
    ctxTrace.strokeStyle = P.grade;
    ctxTrace.lineWidth = 1;
    ctxTrace.stroke();

    const At = state.amp * (H2 / 2 - 8);
    const traceWindow = 2;
    const phase = Math.PI * numWaves;

    ctxTrace.beginPath();
    ctxTrace.strokeStyle = P.ponto;
    ctxTrace.lineWidth = 2.5;
    ctxTrace.lineCap = 'round';
    for (let x = 0; x <= W2; x += 2) {
      const timeAgo = ((W2 - x) / W2) * traceWindow;
      const tPoint = state.t - timeAgo;
      const y = H2 / 2 - At * Math.sin(phase - 2 * Math.PI * fVis * tPoint);
      if (x === 0) ctxTrace.moveTo(x, y); else ctxTrace.lineTo(x, y);
    }
    ctxTrace.stroke();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - state.lastTime) / 1000);
    state.lastTime = now;
    if (!document.hidden && !reduceMotion) state.t += dt;
    draw();
    state.raf = requestAnimationFrame(loop);
  }

  function onVisibility() {
    if (!document.hidden) state.lastTime = performance.now();
  }

  resize();
  draw();
  requestAnimationFrame(() => { resize(); draw(); });

  const onResize = () => { resize(); draw(); };
  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(cvOnda);
  ro.observe(cvTrace);

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  if (!reduceMotion) state.raf = requestAnimationFrame(loop);
  atualizarValores();

  document.getElementById('freq').addEventListener('input', (e) => {
    state.freq = parseInt(e.target.value, 10);
    atualizarValores();
    draw();
    if (state.playing) audio.setFrequency(state.freq);
    salvarDebounced();
  });

  document.getElementById('amp').addEventListener('input', (e) => {
    state.amp = parseInt(e.target.value, 10) / 100;
    atualizarValores();
    draw();
    // ⚠️ Amplitude afeta o volume percebido (#19)
    if (state.playing) audio.setAmplitude(state.amp);
    salvarDebounced();
  });

  const btnAudio = document.getElementById('btn-toggle-audio');
  const chkMute = document.getElementById('chk-mute');

  btnAudio.addEventListener('click', async () => {
    if (!audio.isSupported()) { avisar('Seu navegador não toca áudio gerado pelo app.', 'erro'); return; }
    if (state.playing) {
      audio.stopContinuous();
      state.playing = false;
      btnAudio.textContent = '▶ Tocar som';
      btnAudio.setAttribute('aria-label', 'Tocar som');
    } else {
      const ok = await audio.unlock();
      if (!ok) { avisar('Não foi possível ativar o áudio. Verifique as permissões do navegador.', 'erro'); return; }
      audio.setMuted(chkMute.checked);
      audio.setAmplitude(state.amp);
      audio.startContinuous(state.freq);
      state.playing = true;
      btnAudio.textContent = '⏸ Parar som';
      btnAudio.setAttribute('aria-label', 'Parar som');
    }
  });

  chkMute.addEventListener('change', () => { audio.setMuted(chkMute.checked); });

  return () => {
    if (state.raf) cancelAnimationFrame(state.raf);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    flushSave();
    ro.disconnect();
    if (state.playing) audio.stopContinuous();
  };
}
