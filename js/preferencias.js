/* Tema e tamanho do texto (preferências do aparelho, não vão no backup). */
const K_TEMA = 'ondulatoria_tema';
const K_FONTE = 'ondulatoria_fonte';

function ler(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function gravar(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

export function temaAtual() {
  return document.documentElement.getAttribute('data-tema') || 'escuro';
}

export function aplicarTema(tema, salvar = false) {
  const t = tema === 'claro' ? 'claro' : 'escuro';
  document.documentElement.setAttribute('data-tema', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'claro' ? '#FAFAF7' : '#0F172A';
  if (salvar) gravar(K_TEMA, t);
}

export function fonteAtual() {
  return document.documentElement.getAttribute('data-fonte') || 'n';
}

export function aplicarFonte(f, salvar = false) {
  const v = ['g', 'gg'].includes(f) ? f : 'n';
  if (v === 'n') document.documentElement.removeAttribute('data-fonte');
  else document.documentElement.setAttribute('data-fonte', v);
  if (salvar) gravar(K_FONTE, v);
}

/** Aplica as preferências salvas (ou a do sistema, para o tema) ao abrir o app. */
export function aplicarPreferenciasSalvas() {
  const tema = ler(K_TEMA);
  if (tema === 'claro' || tema === 'escuro') aplicarTema(tema);
  else aplicarTema(window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro');
  aplicarFonte(ler(K_FONTE));
}
