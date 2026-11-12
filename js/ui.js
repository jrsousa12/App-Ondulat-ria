/* Peças visuais reutilizadas pelas telas. */
import { esc } from './utils.js';

const ICONES_TRILHA = {
  // 1 · ondas
  '1': '<path d="M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.5-3.5 5-1.5"/><path d="M2 18c2.5-3 5-3 7.5 0s5 3 7.5 0" opacity=".5"/>',
  // 2 · grandezas (λ medido entre cristas)
  '2': '<path d="M2 14c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/><path d="M5 5h12M5 3v4M17 3v4"/>',
  // 3 · o som (alto-falante)
  '3': '<path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  // 4 · qualidades (nota musical)
  '4': '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  // 5 · fenômenos (reflexão / eco)
  '5': '<path d="M3 20 12 6l9 14"/><path d="M12 6v-3M7 13l5-7 5 7" opacity=".5"/>',
  // 6 · cotidiano e saúde (ouvido)
  '6': '<path d="M7 9a5 5 0 1 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/><path d="M10 9a2 2 0 1 1 4 0"/>'
};

export function iconeTrilha(id, classe = 'icone-trilha') {
  return `<svg class="${classe}" viewBox="0 0 24 24" aria-hidden="true">${ICONES_TRILHA[String(id)] || ICONES_TRILHA['1']}</svg>`;
}

export const ICONES = {
  praticar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="10" rx="2"/><path d="M7 19h14V9"/></svg>',
  lab: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/></svg>',
  perfil: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  desempenho: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  trilhas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6"/></svg>',
  caderno: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>',
  treino: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  cadeado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
};

/** Cabeçalho padrão das telas. */
export function cabecalho({ rotulo = '', titulo, sub = '', voltar = null }) {
  return `
    <header class="tela-topo">
      ${voltar ? `<a href="${esc(voltar.href)}" class="tela-voltar">← ${esc(voltar.texto)}</a>` : ''}
      ${rotulo ? `<p class="tela-rotulo">${esc(rotulo)}</p>` : ''}
      <h2>${esc(titulo)}</h2>
      ${sub ? `<p class="tela-sub">${sub}</p>` : ''}
    </header>`;
}

/** Esqueleto de carregamento (blocos cinza animados). */
export function esqueleto(blocos = 3) {
  return `<div class="esqueleto" aria-busy="true" aria-label="Carregando">
    <div class="esq esq-titulo"></div>
    ${Array.from({ length: blocos }, () => '<div class="esq esq-bloco"></div>').join('')}
  </div>`;
}

/** Passo a passo de uma trilha: Leitura → Perguntas de compreensão → Quiz. */
export function etapas(atual, feitas = atual) {
  const nomes = ['Leitura', 'Perguntas', 'Quiz'];
  return `<ol class="etapas" aria-label="Etapas da trilha">${nomes.map((n, i) => {
    const cls = i < feitas ? 'feito' : (i === atual ? 'atual' : '');
    return `<li class="${cls}"${i === atual ? ' aria-current="step"' : ''}><span>${i < feitas ? '✓' : i + 1}</span>${n}</li>`;
  }).join('')}</ol>`;
}
