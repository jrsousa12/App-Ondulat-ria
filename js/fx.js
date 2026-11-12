/* Efeitos: som curto, vibração, confete e "+XP" flutuante. Tudo respeita "reduzir movimento". */

const K_SOM = 'ondulatoria_som';
const K_VIBRA = 'ondulatoria_vibracao';
let ctx = null;

function ler(k, padrao) {
  try { const v = localStorage.getItem(k); return v === null ? padrao : v === '1'; } catch (_) { return padrao; }
}
function gravar(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (_) {} }

export const prefs = {
  get som() { return ler(K_SOM, false); },
  set som(v) { gravar(K_SOM, v); },
  get vibracao() { return ler(K_VIBRA, true); },
  set vibracao(v) { gravar(K_VIBRA, v); }
};

export function movimentoReduzido() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function tocarNotas(notas) {
  if (!prefs.som) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    let t = ctx.currentTime;
    for (const [freq, dur] of notas) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); // volume baixo e seguro
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
      t += dur * 0.8;
    }
  } catch (_) {}
}

function vibrar(padrao) {
  if (prefs.vibracao && navigator.vibrate) {
    try { navigator.vibrate(padrao); } catch (_) {}
  }
}

export function acerto() {
  tocarNotas([[660, 0.09], [880, 0.14]]);
  vibrar(25);
}

export function erro() {
  tocarNotas([[220, 0.18]]);
  vibrar([40, 60, 40]);
}

export function vitoria() {
  tocarNotas([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]]);
  vibrar([30, 50, 30, 50, 80]);
}

/** Confete em um canvas temporário por cima da tela. */
export function confete(qtd = 120) {
  if (movimentoReduzido()) return;
  const cv = document.createElement('canvas');
  cv.className = 'confete';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const dpr = window.devicePixelRatio || 1;
  const W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const cores = ['#22D3EE', '#F59E0B', '#34D399', '#A78BFA', '#F472B6', '#FCD34D'];
  const p = Array.from({ length: qtd }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.35,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 13 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    cor: cores[(Math.random() * cores.length) | 0]
  }));
  const inicio = performance.now();
  (function quadro(agora) {
    const dt = agora - inicio;
    c.clearRect(0, 0, W, H);
    for (const q of p) {
      q.vy += 0.35; q.vx *= 0.99;
      q.x += q.vx; q.y += q.vy; q.r += q.vr;
      c.save();
      c.globalAlpha = Math.max(0, 1 - dt / 2600);
      c.translate(q.x, q.y); c.rotate(q.r);
      c.fillStyle = q.cor;
      c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      c.restore();
    }
    if (dt < 2600) requestAnimationFrame(quadro);
    else cv.remove();
  })(inicio);
}

/** "+N XP" subindo a partir de um elemento. */
export function xpFlutuante(origem, xp) {
  if (!xp || movimentoReduzido()) return;
  const r = origem?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  const el = document.createElement('div');
  el.className = 'xp-flutuante';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = `+${xp} XP`;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}
