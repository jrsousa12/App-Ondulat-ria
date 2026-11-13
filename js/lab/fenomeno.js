import { paleta } from './paleta.js';

/* Fenômeno: a cena acontece e o gráfico é desenhado ao mesmo tempo (ideia das simulações da Plataforma de Física). */
const CENARIOS = {
  eco: {
    nome: 'Eco',
    texto: 'Você grita diante de um paredão. O som vai até ele, volta e só então você ouve o eco.',
    controle: { rotulo: 'Distância até o paredão', min: 17, max: 340, passo: 1, valor: 170, unidade: 'm' },
    duracao: v => (2 * v) / 340,
    eixoY: v => ({ max: 2 * v, rotulo: 'distância percorrida (m)' }),
    y: (v, t) => 340 * t,
    leitura: (v, t, fim) => fim
      ? `O eco chega em t = 2 · d / v = 2 · ${v} / 340 = ${((2 * v) / 340).toFixed(2).replace('.', ',')} s`
      : `t = ${t.toFixed(2).replace('.', ',')} s · o som percorreu ${Math.round(340 * t)} m`
  },
  trovao: {
    nome: 'Trovão',
    texto: 'O raio cai longe. A luz chega quase na hora; o som do trovão viaja a 340 m/s.',
    controle: { rotulo: 'Distância do raio', min: 340, max: 3400, passo: 10, valor: 1700, unidade: 'm' },
    duracao: v => v / 340,
    eixoY: v => ({ max: v, rotulo: 'distância do som (m)' }),
    y: (v, t) => 340 * t,
    leitura: (v, t, fim) => fim
      ? `O trovão chega em t = d / v = ${v} / 340 = ${(v / 340).toFixed(1).replace('.', ',')} s`
      : `t = ${t.toFixed(1).replace('.', ',')} s · o som está a ${Math.round(340 * t)} m do raio`
  },
  periodo: {
    nome: 'Período',
    texto: 'Um ponto vibra para cima e para baixo. O gráfico mostra a posição dele ao longo do tempo.',
    controle: { rotulo: 'Frequência', min: 0.5, max: 3, passo: 0.5, valor: 1, unidade: 'Hz' },
    duracao: () => 3,
    eixoY: () => ({ max: 1, min: -1, rotulo: 'posição' }),
    y: (v, t) => Math.sin(2 * Math.PI * v * t),
    leitura: (v, t, fim) => `f = ${String(v).replace('.', ',')} Hz · T = 1 / f = ${(1 / v).toFixed(2).replace('.', ',')} s${fim ? ` · ${Math.round(3 * v)} oscilações em 3 s` : ''}`
  }
};

export function montarFenomeno(area) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { cen: 'eco', valor: CENARIOS.eco.controle.valor, t: 0, rodando: false, raf: null, inicio: 0 };

  area.innerHTML = `
    <section class="card">
      <h3>Fenômeno em movimento</h3>
      <div class="btn-grupo" role="group" aria-label="Escolha o fenômeno">
        ${Object.entries(CENARIOS).map(([k, c]) => `<button class="lab-tab-btn${k === 'eco' ? ' ativo' : ''}" data-cen="${k}">${c.nome}</button>`).join('')}
      </div>
      <p id="fen-texto" class="fen-texto"></p>
      <div class="lab-canvas-wrap"><canvas id="cv-fen-cena" class="lab-canvas" aria-label="Cena do fenômeno"></canvas></div>
      <div class="lab-canvas-wrap"><canvas id="cv-fen-graf" class="lab-canvas fen-grafico" aria-label="Gráfico desenhado ao longo do tempo"></canvas></div>
      <p class="lab-legenda" id="fen-leitura" role="status" aria-live="polite"></p>
      <div class="lab-controles">
        <label for="fen-valor"><span id="fen-rotulo"></span>: <strong><span id="fen-valor-txt"></span></strong></label>
        <input type="range" id="fen-valor">
      </div>
      <div class="btn-grupo"><button class="btn" id="btn-fen-play">▶ Reproduzir</button></div>
    </section>`;

  const cena = area.querySelector('#cv-fen-cena'), graf = area.querySelector('#cv-fen-graf');
  const cc = cena.getContext('2d'), cg = graf.getContext('2d');
  const slider = area.querySelector('#fen-valor');
  let W1 = 0, H1 = 0, W2 = 0, H2 = 0;

  function resize() {
    const DPR = window.devicePixelRatio || 1;
    const r1 = cena.getBoundingClientRect(), r2 = graf.getBoundingClientRect();
    W1 = r1.width; H1 = r1.height; W2 = r2.width; H2 = r2.height;
    cena.width = W1 * DPR; cena.height = H1 * DPR; graf.width = W2 * DPR; graf.height = H2 * DPR;
    cc.setTransform(DPR, 0, 0, DPR, 0, 0); cg.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function configurar() {
    const c = CENARIOS[state.cen];
    area.querySelector('#fen-texto').textContent = c.texto;
    area.querySelector('#fen-rotulo').textContent = c.controle.rotulo;
    Object.assign(slider, { min: c.controle.min, max: c.controle.max, step: c.controle.passo });
    slider.value = state.valor;
    area.querySelector('#fen-valor-txt').textContent = `${String(state.valor).replace('.', ',')} ${c.controle.unidade}`;
    parar();
    state.t = reduceMotion ? c.duracao(state.valor) : 0;
    draw();
  }

  function draw() {
    if (!W1 || !W2) return;
    const P = paleta();
    const c = CENARIOS[state.cen], v = state.valor, T = c.duracao(v), t = Math.min(state.t, T), fim = t >= T - 1e-9;

    /* cena */
    cc.clearRect(0, 0, W1, H1);
    const chao = H1 - 18;
    cc.strokeStyle = P.grade; cc.lineWidth = 1;
    cc.beginPath(); cc.moveTo(0, chao); cc.lineTo(W1, chao); cc.stroke();
    if (state.cen === 'eco' || state.cen === 'trovao') {
      const xA = 34, xB = W1 - 34;
      // pessoa (eco) ou raio (trovão) à esquerda
      if (state.cen === 'eco') {
        cc.fillStyle = P.ponto; cc.beginPath(); cc.arc(xA, chao - 34, 8, 0, Math.PI * 2); cc.fill();
        cc.strokeStyle = P.ponto; cc.lineWidth = 3; cc.beginPath(); cc.moveTo(xA, chao - 26); cc.lineTo(xA, chao); cc.stroke();
        cc.fillStyle = P.textoFraco; cc.fillRect(xB, chao - 70, 12, 70);
      } else {
        const brilho = t < 0.15 * T ? 1 : 0.35;
        cc.strokeStyle = P.ponto; cc.globalAlpha = brilho; cc.lineWidth = 3;
        cc.beginPath(); cc.moveTo(xA + 6, 8); cc.lineTo(xA - 6, chao / 2); cc.lineTo(xA + 4, chao / 2); cc.lineTo(xA - 8, chao); cc.stroke();
        cc.globalAlpha = 1;
        cc.fillStyle = P.ponto; cc.beginPath(); cc.arc(xB, chao - 34, 8, 0, Math.PI * 2); cc.fill();
        cc.strokeStyle = P.ponto; cc.lineWidth = 3; cc.beginPath(); cc.moveTo(xB, chao - 26); cc.lineTo(xB, chao); cc.stroke();
      }
      // frente de onda
      const d = 340 * t, total = state.cen === 'eco' ? v : v;
      let pos = state.cen === 'eco' ? (d <= v ? d : 2 * v - d) : d;
      const x = xA + 14 + (xB - xA - 28) * Math.min(1, pos / total);
      cc.strokeStyle = P.onda; cc.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        cc.globalAlpha = 1 - k * 0.3;
        cc.beginPath(); cc.arc(x - (state.cen === 'eco' && d > v ? -k * 7 : k * 7), chao - 34, 14, -Math.PI / 3, Math.PI / 3, state.cen === 'eco' && d > v); cc.stroke();
      }
      cc.globalAlpha = 1;
      cc.fillStyle = P.textoFraco; cc.font = '12px system-ui, sans-serif'; cc.textAlign = 'center';
      cc.fillText(`${v} m`, (xA + xB) / 2, chao + 14);
    } else {
      const xP = W1 / 2, A = (chao - 16) / 2 - 6, yC = (chao + 8) / 2;
      cc.setLineDash([4, 4]); cc.strokeStyle = P.grade; cc.beginPath(); cc.moveTo(xP, yC - A - 4); cc.lineTo(xP, yC + A + 4); cc.stroke(); cc.setLineDash([]);
      const y = yC - A * c.y(v, t);
      cc.fillStyle = P.ponto; cc.beginPath(); cc.arc(xP, y, 10, 0, Math.PI * 2); cc.fill();
    }

    /* gráfico desenhado até o instante t */
    cg.clearRect(0, 0, W2, H2);
    const ml = 40, mr = 12, mt = 12, mb = 22, iw = W2 - ml - mr, ih = H2 - mt - mb;
    const ey = c.eixoY(v), ymin = ey.min ?? 0;
    const gx = tt => ml + (tt / T) * iw, gy = val => mt + ih - ((val - ymin) / (ey.max - ymin)) * ih;
    cg.strokeStyle = P.grade; cg.lineWidth = 1;
    cg.beginPath(); cg.moveTo(ml, mt); cg.lineTo(ml, mt + ih); cg.lineTo(ml + iw, mt + ih); cg.stroke();
    if (ymin < 0) { cg.beginPath(); cg.moveTo(ml, gy(0)); cg.lineTo(ml + iw, gy(0)); cg.stroke(); }
    cg.fillStyle = P.textoFraco; cg.font = '11px system-ui, sans-serif';
    cg.textAlign = 'right'; cg.fillText(state.cen === 'periodo' ? '' : String(ey.max), ml - 4, mt + 9);
    cg.textAlign = 'left'; cg.fillText(ey.rotulo, ml + 4, mt + 9);
    cg.textAlign = 'right'; cg.fillText(`${T.toFixed(T < 10 ? 2 : 1).replace('.', ',')} s`, ml + iw, H2 - 6);
    cg.textAlign = 'left'; cg.fillText('0', ml, H2 - 6);
    cg.strokeStyle = P.onda; cg.lineWidth = 2.5; cg.lineJoin = 'round';
    cg.beginPath();
    const passos = 160;
    for (let i = 0; i <= passos; i++) {
      const tt = (t * i) / passos;
      const px = gx(tt), py = gy(c.y(v, tt));
      if (i === 0) cg.moveTo(px, py); else cg.lineTo(px, py);
    }
    cg.stroke();
    cg.fillStyle = P.ponto; cg.beginPath(); cg.arc(gx(t), gy(c.y(v, t)), 5, 0, Math.PI * 2); cg.fill();

    area.querySelector('#fen-leitura').textContent = c.leitura(v, t, fim);
  }

  function quadro(agora) {
    const c = CENARIOS[state.cen], T = c.duracao(state.valor);
    // A animação dura entre 2 e 4 s na tela, mas o relógio mostra o tempo real do fenômeno.
    const escala = T / Math.min(4, Math.max(2, T));
    state.t = ((agora - state.inicio) / 1000) * escala;
    draw();
    if (state.t < T) state.raf = requestAnimationFrame(quadro);
    else parar();
  }

  function parar() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    state.rodando = false;
    const b = area.querySelector('#btn-fen-play');
    if (b) b.textContent = '▶ Reproduzir';
  }

  area.querySelector('#btn-fen-play').addEventListener('click', e => {
    if (state.rodando) { parar(); return; }
    if (reduceMotion) { state.t = CENARIOS[state.cen].duracao(state.valor); draw(); return; }
    state.rodando = true;
    e.currentTarget.textContent = '⏸ Pausar';
    state.inicio = performance.now();
    state.raf = requestAnimationFrame(quadro);
  });
  slider.addEventListener('input', () => { state.valor = Number(slider.value); configurar(); });
  area.querySelectorAll('[data-cen]').forEach(b => b.addEventListener('click', () => {
    state.cen = b.dataset.cen;
    state.valor = CENARIOS[state.cen].controle.valor;
    area.querySelectorAll('[data-cen]').forEach(x => x.classList.toggle('ativo', x === b));
    configurar();
  }));

  resize();
  configurar();
  requestAnimationFrame(() => { resize(); draw(); });
  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(cena); ro.observe(graf);
  return () => { parar(); ro.disconnect(); };
}
