/* Laboratório: abas e troca de experimento. Cada experimento fica em js/lab/. */
import { audio } from './audio.js';
import { cabecalho } from './ui.js';
import { montarOsciloscopio } from './lab/osciloscopio.js';
import { montarMeios } from './lab/meios.js';
import { montarRessonancia } from './lab/ressonancia.js';
import { montarFenomeno } from './lab/fenomeno.js';
import { montarMeuSom } from './lab/meu-som.js';

let cleanupAtual = null;

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
      <button class="lab-tab" data-tab="fenomeno" role="tab" aria-selected="false">Fenômeno</button>
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
    else if (tab === 'fenomeno') cleanupSubview = montarFenomeno(area);
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
