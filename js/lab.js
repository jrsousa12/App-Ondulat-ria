import { audio } from './audio.js';
import { cabecalho } from './ui.js';
import { avisar } from './dialogos.js';

let cleanupAtual = null;

/** Cores do tema atual (lidas do CSS), para os desenhos acompanharem o tema claro/escuro. */
function paleta() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  const comAlfa = (hex, a) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const texto = v('--texto-fraco') || '#94A3B8';
  return {
    onda: v('--ciano') || P.onda,
    ondaSuave: comAlfa(v('--ciano') || P.onda, 0.3),
    ponto: v('--ambar') || P.ponto,
    fundo: v('--bg-elev') || P.fundo,
    grade: comAlfa(texto, 0.35),
    gradeForte: comAlfa(texto, 0.55),
    textoFraco: texto,
    erro: v('--erro') || P.erro,
    meio: { ar: v('--meio-ar'), agua: v('--meio-agua'), aco: v('--meio-aco') }
  };
}


export function cleanupLab() {
  if (cleanupAtual) {
    try { cleanupAtual(); } catch (_) {}
    cleanupAtual = null;
  }
}

export function renderLab(dados, salvarDados) {
  cleanupLab();

  const container = document.querySelector('#conteudo');
  let cleanupSubview = null;

  container.innerHTML = `
    ${cabecalho({ rotulo: 'Laboratório', titulo: 'Laboratório de ondas', sub: 'Simulações para você <strong>ver</strong> e <strong>ouvir</strong> as ondas. Experimente à vontade — nada sai do seu aparelho.' })}
    <div class="lab-tabs" role="tablist" aria-label="Experimentos">
      <button class="lab-tab ativo" data-tab="osciloscopio" role="tab" aria-selected="true">Osciloscópio</button>
      <button class="lab-tab" data-tab="meios" role="tab" aria-selected="false">Meios</button>
      <button class="lab-tab" data-tab="ressonancia" role="tab" aria-selected="false">Ressonância</button>
      <button class="lab-tab" data-tab="meu-som" role="tab" aria-selected="false">Meu som</button>
    </div>
    <div id="lab-content" role="tabpanel"></div>
  `;

  function trocarAba(tab) {
    if (cleanupSubview) { try { cleanupSubview(); } catch (_) {} cleanupSubview = null; }
    document.querySelectorAll('.lab-tab').forEach(b => {
      const ativo = b.dataset.tab === tab;
      b.classList.toggle('ativo', ativo);
      b.setAttribute('aria-selected', String(ativo));
    });
    const area = document.getElementById('lab-content');
    area.innerHTML = '';
    if (tab === 'osciloscopio') cleanupSubview = montarOsciloscopio(area, dados, salvarDados);
    else if (tab === 'meios') cleanupSubview = montarMeios(area);
    else if (tab === 'ressonancia') cleanupSubview = montarRessonancia(area);
    else if (tab === 'meu-som') cleanupSubview = montarMeuSom(area);
  }

  document.querySelectorAll('.lab-tab').forEach(btn => {
    btn.addEventListener('click', () => trocarAba(btn.dataset.tab));
  });

  cleanupAtual = () => {
    if (cleanupSubview) { try { cleanupSubview(); } catch (_) {} }
    audio.cleanup();
  };

  trocarAba('osciloscopio');
}

function montarOsciloscopio(area, dados, salvarDados) {
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

function montarMeios(area) {
  // Cores dos meios: canvas usa cores brilhantes; texto usa classes de tema.
  const meios = [
    { nome: 'Ar', v: 340, chave: 'ar', label: 'Gás' },
    { nome: 'Água', v: 1500, chave: 'agua', label: 'Líquido' },
    { nome: 'Aço', v: 5000, chave: 'aco', label: 'Sólido' }
  ];

  let freq = 440;
  let timeoutAnimar = null;

  area.innerHTML = `
    <section class="card">
      <h3>Comparador de meios</h3>
      <p>O som viaja mais rápido em sólidos. Para a <strong>mesma frequência</strong>, o comprimento de onda cresce com a velocidade. Veja a diferença em escala real:</p>

      <div class="meios-lista">
        ${meios.map(m => `
          <div class="meio-item">
            <div class="meio-label">
              <strong class="meio-cor-${m.chave}">${m.nome}</strong>
              <span>${m.label} · v ≈ ${m.v.toLocaleString('pt-BR')} m/s</span>
              <span class="meio-lambda">λ = <strong id="lam-${m.nome}">--</strong> m</span>
            </div>
            <canvas class="meio-canvas" id="cv-meio-${m.nome}" aria-label="Onda no ${m.nome}"></canvas>
          </div>
        `).join('')}
      </div>
      <p class="lab-legenda">Mesma escala nos três. Note como em aço o comprimento de onda é tão longo que mal cabe uma onda na tela.</p>

      <div class="lab-controles">
        <label for="freq-meios">Frequência: <strong><span id="freq-meios-val">${freq}</span> Hz</strong></label>
        <input type="range" id="freq-meios" min="200" max="1000" step="10" value="${freq}">
      </div>

      <h3 style="margin-top:var(--esp-3)">Distância percorrida em 1 segundo</h3>
      <div class="barra-meios" id="barra-meios">
        ${meios.map(m => `
          <div class="barra-item">
            <span class="meio-cor-${m.chave}">${m.nome}</span>
            <div style="background:var(--borda);border-radius:4px;overflow:hidden;height:20px">
              <div class="barra-fill" id="barra-${m.nome}" style="background:var(--meio-${m.chave});width:0%"></div>
            </div>
            <span id="dist-${m.nome}" style="text-align:right;color:var(--texto-fraco)">${m.v.toLocaleString('pt-BR')} m</span>
          </div>
        `).join('')}
      </div>
      <div class="btn-grupo">
        <button class="btn" id="btn-animar-barras">▶ Animar 1 segundo</button>
      </div>
      <p class="lab-aviso">⚡ Escala real: em 1 s, o som no ar percorre cerca de 340 m; na água, 1.500 m; no aço, 5.000 m (valores aproximados, como nas trilhas). As barras crescem com velocidade constante, como o som.</p>
    </section>
  `;

  const canvases = {};
  meios.forEach(m => {
    const cv = document.getElementById(`cv-meio-${m.nome}`);
    canvases[m.nome] = { el: cv, ctx: cv.getContext('2d'), W: 0, H: 0 };
  });

  function resize() {
    const DPR = window.devicePixelRatio || 1;
    meios.forEach(m => {
      const c = canvases[m.nome];
      const r = c.el.getBoundingClientRect();
      c.W = r.width; c.H = r.height;
      c.el.width = c.W * DPR; c.el.height = c.H * DPR;
      c.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    });
  }

  function atualizarLambdas() {
    meios.forEach(m => {
      document.getElementById(`lam-${m.nome}`).textContent = (m.v / freq).toFixed(2);
    });
    document.getElementById('freq-meios-val').textContent = freq;
  }

  function draw() {
    const P = paleta();
    // Escala única: em 440 Hz, a onda no ar ocupa 1/3 da largura. Assim λ = v/f aparece na tela.
    const pxPorMetro = ((canvases['Ar'].W || 300) / 3) / (340 / 440);
    meios.forEach(m => {
      const c = canvases[m.nome];
      if (!c.W || !c.H) return;
      const ctx = c.ctx;
      ctx.clearRect(0, 0, c.W, c.H);

      ctx.beginPath();
      ctx.moveTo(0, c.H / 2);
      ctx.lineTo(c.W, c.H / 2);
      ctx.strokeStyle = P.grade;
      ctx.lineWidth = 1;
      ctx.stroke();

      const lambdaPx = (m.v / freq) * pxPorMetro;
      const A = c.H * 0.32;

      ctx.beginPath();
      ctx.strokeStyle = P.meio[m.chave];
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      for (let x = 0; x <= c.W; x += 1.5) {
        const y = c.H / 2 - A * Math.sin(2 * Math.PI * x / lambdaPx);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }

  resize();
  atualizarLambdas();
  draw();
  requestAnimationFrame(() => { resize(); draw(); });

  const onResize = () => { resize(); draw(); };
  const ro = new ResizeObserver(() => { resize(); draw(); });
  meios.forEach(m => ro.observe(canvases[m.nome].el));

  window.addEventListener('resize', onResize);

  document.getElementById('freq-meios').addEventListener('input', (e) => {
    freq = parseInt(e.target.value, 10);
    atualizarLambdas();
    draw();
  });

  const maxV = Math.max(...meios.map(m => m.v));

  function resetarBarras() {
    meios.forEach(m => {
      const b = document.getElementById(`barra-${m.nome}`);
      b.style.transition = 'none';
      b.style.width = '0%';
    });
    void document.body.offsetWidth;
    meios.forEach(m => {
      const b = document.getElementById(`barra-${m.nome}`);
      b.style.transition = 'width 1000ms linear';
    });
  }

  document.getElementById('btn-animar-barras').addEventListener('click', () => {
    if (timeoutAnimar) clearTimeout(timeoutAnimar);
    resetarBarras();
    timeoutAnimar = setTimeout(() => {
      meios.forEach(m => {
        const b = document.getElementById(`barra-${m.nome}`);
        b.style.width = ((m.v / maxV) * 100) + '%';
      });
      timeoutAnimar = null;
    }, 30);
  });

  resetarBarras();

  return () => {
    window.removeEventListener('resize', onResize);
    ro.disconnect();
    if (timeoutAnimar) clearTimeout(timeoutAnimar);
  };
}

function montarRessonancia(area) {
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

function montarMeuSom(area) {
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