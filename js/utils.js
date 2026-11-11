export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatarDuracao(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  if (min === 0) return `${seg}s`;
  return `${min}min${seg.toString().padStart(2, '0')}s`;
}

/** Timestamp completo (data + hora) em UTC. Use para logs e `criadoEm`. */
export function hojeISO() {
  return new Date().toISOString();
}

/** Data local do dispositivo, formato YYYY-MM-DD. Use para "hoje" e cálculos de dia. */
export function hojeLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/** Soma `dias` à data local de hoje. Retorna YYYY-MM-DD local. */
export function localMaisDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
