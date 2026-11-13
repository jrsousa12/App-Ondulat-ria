/* Meios: compara a velocidade do som no ar, na água e no aço. */
import { paleta } from './paleta.js';

export function montarMeios(area) {
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
