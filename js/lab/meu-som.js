/* Meu som: forma de onda captada pelo microfone. */
import { audio } from '../audio.js';
import { paleta } from './paleta.js';

export function montarMeuSom(area) {
  const state = { ativo: false, raf: null, dataArray: null };

  area.innerHTML = `
    <section class="card">
      <h3>Meu som</h3>
      <p>Use o <strong>microfone</strong> para ver o formato da sua voz. O som é processado <strong>apenas na memória</strong> — nada é gravado, nada é enviado, nada sai do seu aparelho.</p>

      <div class="lab-canvas-wrap">
        <canvas id="cv-mic" class="lab-canvas" style="height:180px" aria-label="Osciloscópio da sua voz"></canvas>
      </div>
      <p class="lab-legenda">Traço do microfone em tempo real</p>

      <div class="btn-grupo">
        <button class="btn" id="btn-mic-start">🎤 Ativar microfone</button>
        <button class="btn btn-perigo" id="btn-mic-stop" style="display:none">Desligar</button>
      </div>

      <p class="lab-aviso" id="mic-status">🔒 Ao ativar, o navegador vai pedir permissão. Nada é enviado a servidores.</p>
    </section>
  `;

  const cv = document.getElementById('cv-mic');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0;

  function resize() {
    const DPR = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function draw() {
    const P = paleta();
    if (!state.ativo || !audio.isMicActive()) return;
    const analyser = audio.getMicAnalyser();
    if (!analyser) return;

    if (!state.dataArray || state.dataArray.length !== analyser.fftSize) {
      state.dataArray = new Uint8Array(analyser.fftSize);
    }
    analyser.getByteTimeDomainData(state.dataArray);

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.strokeStyle = P.grade;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = P.onda;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const step = W / state.dataArray.length;
    for (let i = 0; i < state.dataArray.length; i++) {
      const normalized = (state.dataArray[i] - 128) / 128;
      const y = H / 2 - normalized * (H / 2);
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    state.raf = requestAnimationFrame(draw);
  }

  document.getElementById('btn-mic-start').addEventListener('click', async () => {
    const status = document.getElementById('mic-status');
    status.textContent = 'Ativando microfone…';
    status.style.color = 'var(--texto-fraco)';
    try {
      await audio.startMic();
      state.ativo = true;
      document.getElementById('btn-mic-start').style.display = 'none';
      document.getElementById('btn-mic-stop').style.display = '';
      status.textContent = '🎤 Microfone ativo. Fale, cante ou assovie para ver a onda.';
      status.style.color = 'var(--sucesso)';
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = requestAnimationFrame(draw);
    } catch (e) {
      status.textContent = 'Não foi possível acessar o microfone. Verifique as permissões do navegador.';
      status.style.color = 'var(--erro)';
    }
  });

  document.getElementById('btn-mic-stop').addEventListener('click', () => {
    audio.stopMic();
    state.ativo = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    document.getElementById('btn-mic-start').style.display = '';
    document.getElementById('btn-mic-stop').style.display = 'none';
    const status = document.getElementById('mic-status');
    status.textContent = 'Microfone desligado. O som nunca foi gravado.';
    status.style.color = 'var(--texto-fraco)';
    ctx.clearRect(0, 0, W, H);
  });

  resize();
  requestAnimationFrame(() => resize());
  const onResize = () => resize();
  const ro = new ResizeObserver(() => resize());
  ro.observe(cv);
  window.addEventListener('resize', onResize);

  return () => {
    audio.stopMic();
    if (state.raf) cancelAnimationFrame(state.raf);
    window.removeEventListener('resize', onResize);
    ro.disconnect();
  };
}
