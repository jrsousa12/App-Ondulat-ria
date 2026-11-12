/* Tela "Fontes de referência". */
import { esc } from './utils.js';
import { FONTES } from './conteudo.js';
import { cabecalho } from './ui.js';

export function renderFontes(voltarPara = 'perfil') {
  const destinos = { perfil: ['#perfil', 'Perfil'], trilhas: ['#trilhas', 'Trilhas'] };
  const [href, texto] = destinos[voltarPara] || destinos.perfil;
  document.querySelector('#conteudo').innerHTML = `
    ${cabecalho({ voltar: { href, texto }, rotulo: 'Para ir além', titulo: 'Fontes de referência', sub: 'Sites confiáveis para revisar e aprofundar ondas e som. Os links abrem em outra aba e precisam de internet.' })}
    <ul class="fontes-lista">
      ${FONTES.map(f => `
        <li><a class="fonte" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(f.nome)} (abre em outra aba)">
          <strong>${esc(f.nome)}</strong>
          <span>${esc(f.desc)}</span>
          <small>${esc(f.autor)} ↗</small>
        </a></li>`).join('')}
    </ul>
    <p class="home-privacidade">Os textos das trilhas e as questões foram escritos para este app e devem ser revisados pelo professor. Confira sempre unidades e valores.</p>`;
}
