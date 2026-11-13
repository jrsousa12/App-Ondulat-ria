/* Ressonância: harmônicos de um tubo fechado. */
import { paleta } from './paleta.js';

export function montarRessonancia(area) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { n: 1, t: 0, raf: null, lastTime: performance.now() };

  area.innerHTML = `
    <section class="card">
      <h3>Ressonância em tubo fechado</h3>
      <p>Um tubo fechado nas duas pontas forma <strong>ondas estacionárias</strong> em certos comprimentos. Os pontos que <strong>não se movem</strong> são <em>nós</em>; os que <strong>vibram mais</strong> são <em>antinós</em>.</p>

      <div class="lab-canvas-wrap">
        <canvas id="cv-res" class="lab-canvas" style="height:180px" aria-label="Onda estacionária em tubo"></canvas>
      </div>
      <p class="lab-legenda">Nós fixos nas extremidades. Antinós vibram no meio.</p>

      <div class="btn-grupo" style="justify-content:center">
        <button class="lab-tab-btn ativo" data-n="1">1º modo</button>
        <button class="lab-tab-btn" data-n="2">2º modo</button>
        <button class="lab-tab-btn" data-n="3">3º modo</button>
      </div>

      <div class="lab-valores" role="status" aria-live="polite">
        <div><span>Comprimento</span><strong id="val-L">0,5λ</strong><small></small></div>
        <div><span>Nós</span><strong id="val-nos">2</strong><small></small></div>
        <div><span>Antinós</span><strong id="val-antinos">1</strong><small></small></div>
      </div>

      <p class="lab-aviso">🎵 Cada modo corresponde a uma frequência de ressonância. É assim que instrumentos de sopro afinam — o comprimento do tubo define a nota.</p>
    </section>
  `;

  const cv = document.getElementById('cv-res');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0;

  function resize() {
    const DPR = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function atualizarInfo() {
    const n = state.n;
    document.getElementById('val-L').textContent = n === 1 ? '0,5λ' : n === 2 ? '1λ' : '1,5λ';
    document.getElementById('val-nos').textContent = n + 1;
    document.getElementById('val-antinos').textContent = n;
  }

  function draw() {
    const P = paleta();
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);

    const margemX = 30;
    const tubeW = W - margemX * 2;
    const tubeH = H * 0.55;
    const tubeY = (H - tubeH) / 2;

    ctx.strokeStyle = P.gradeForte;
    ctx.lineWidth = 2;
    ctx.strokeRect(margemX, tubeY, tubeW, tubeH);

    const n = state.n;
    const A = tubeH / 2 - 6;
    const centerY = tubeY + tubeH / 2;
    const omega = 2 * Math.PI * 0.8;
    const cosWt = Math.cos(omega * state.t);

    ctx.beginPath();
    ctx.strokeStyle = P.onda;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i <= 200; i++) {
      const xRel = i / 200;
      const envelope = A * Math.sin(n * Math.PI * xRel);
      const y = centerY - envelope * cosWt;
      const x = margemX + xRel * tubeW;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = P.ondaSuave;
    ctx.lineWidth = 1;
    for (const sinal of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const xRel = i / 200;
        const env = A * Math.sin(n * Math.PI * xRel) * sinal;
        const x = margemX + xRel * tubeW;
        const y = centerY - env;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (let k = 0; k <= n; k++) {
      const xRel = k / n;
      const x = margemX + xRel * tubeW;
      ctx.beginPath();
      ctx.arc(x, centerY, 5, 0, Math.PI * 2);
      ctx.fillStyle = P.ponto;
      ctx.fill();
      ctx.strokeStyle = P.fundo;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    for (let k = 0; k < n; k++) {
      const xRel = (k + 0.5) / n;
      const x = margemX + xRel * tubeW;
      ctx.beginPath();
      ctx.arc(x, centerY, 4, 0, Math.PI * 2);
      ctx.fillStyle = P.erro;
      ctx.fill();
    }

    ctx.fillStyle = P.textoFraco;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nó', margemX, tubeY - 8);
    ctx.fillText('Nó', W - margemX, tubeY - 8);
    ctx.fillStyle = P.erro;
    ctx.fillText('● Antinó', W / 2, tubeY - 8);
    ctx.fillStyle = P.ponto;
    ctx.fillText('● Nó', margemX + 30, tubeY - 8);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - state.lastTime) / 1000);
    state.lastTime = now;
    if (!document.hidden && !reduceMotion) state.t += dt;
    draw();
    state.raf = requestAnimationFrame(loop);
  }

  function onVisibility() { if (!document.hidden) state.lastTime = performance.now(); }

  resize();
  atualizarInfo();
  draw();
  requestAnimationFrame(() => { resize(); draw(); });

  const onResize = () => { resize(); draw(); };
  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(cv);

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  if (!reduceMotion) state.raf = requestAnimationFrame(loop);

  area.querySelectorAll('.lab-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.n = parseInt(btn.dataset.n, 10);
      area.querySelectorAll('.lab-tab-btn').forEach(b => b.classList.toggle('ativo', b === btn));
      atualizarInfo();
      draw();
    });
  });

  return () => {
    if (state.raf) cancelAnimationFrame(state.raf);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    ro.disconnect();
  };
}
