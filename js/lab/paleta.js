/** Cores do tema atual (lidas do CSS), para os desenhos acompanharem o tema claro/escuro. */
export function paleta() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  const comAlfa = (hex, a) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  // Reservas (tema escuro) para quando uma variável do CSS não estiver definida.
  const texto = v('--texto-fraco') || '#94A3B8';
  const onda = v('--ciano') || '#22D3EE';
  return {
    onda,
    ondaSuave: comAlfa(onda, 0.3),
    ponto: v('--ambar') || '#F59E0B',
    fundo: v('--bg-elev') || '#1E293B',
    grade: comAlfa(texto, 0.35),
    gradeForte: comAlfa(texto, 0.55),
    textoFraco: texto,
    erro: v('--erro') || '#EF4444',
    meio: { ar: v('--meio-ar'), agua: v('--meio-agua'), aco: v('--meio-aco') }
  };
}
