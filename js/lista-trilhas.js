/* Tela "Trilhas": lista das 6 trilhas com progresso e cor própria. */
import { esc } from './utils.js';
import { TRILHAS } from './conteudo.js';
import { ICONES, iconeTrilha, cabecalho } from './ui.js';
import { trilhaConcluida, trilhaLiberada, etapasTrilha, proximaTrilha, totalConcluidas } from './progresso.js';

export function renderListaTrilhas(ctx) {
  const dados = ctx.dados();
  const prox = proximaTrilha(dados);
  const concluidas = totalConcluidas(dados);

  const cartoes = TRILHAS.map(t => {
    const liberada = trilhaLiberada(dados, t.id);
    const concluida = trilhaConcluida(dados, t.id);
    const feitas = etapasTrilha(dados, t.id);
    const quiz = dados.trilhas?.[t.id]?.quiz;
    const atual = prox?.id === t.id;
    let chip;
    if (concluida) chip = `<span class="trilha-chip ok">${ICONES.check} Concluída${quiz ? ` · ${Math.round(quiz.pct)}%` : ''}</span>`;
    else if (!liberada) chip = `<span class="trilha-chip bloq">${ICONES.cadeado} Conclua a trilha ${+t.id - 1}</span>`;
    else if (feitas) chip = '<span class="trilha-chip and">Em andamento</span>';
    else chip = '<span class="trilha-chip nova">Disponível</span>';

    const barra = [0, 1, 2].map(i => `<i class="${i < (feitas === 3 ? 3 : feitas === 2 ? 2 : 0) ? 'feito' : ''}"></i>`).join('');
    const miolo = `
      <span class="trilha-icone">${liberada ? iconeTrilha(t.id) : ICONES.cadeado}</span>
      <span class="trilha-texto">
        <span class="trilha-num">Trilha ${t.id}${atual ? ' · <b>sua próxima</b>' : ''}</span>
        <strong>${esc(t.titulo)}</strong>
        <span class="trilha-desc">${esc(t.desc)}</span>
        <span class="trilha-etapas" aria-hidden="true">${barra}</span>
        ${chip}
      </span>`;
    return liberada
      ? `<li><a href="#trilha/${t.id}" class="trilha-card${atual ? ' atual' : ''}" data-trilha="${t.id}">${miolo}</a></li>`
      : `<li><div class="trilha-card bloqueada" data-trilha="${t.id}" aria-disabled="true">${miolo}</div></li>`;
  }).join('');

  document.querySelector('#conteudo').innerHTML = `
    ${cabecalho({
      rotulo: `${concluidas} de ${TRILHAS.length} concluídas`,
      titulo: 'Trilhas de aprendizagem',
      sub: 'Cada trilha tem leitura, 3 perguntas de compreensão e um quiz de 10 questões. Acerte 80% no quiz para liberar a próxima.'
    })}
    <ol class="trilhas-lista">${cartoes}</ol>
  `;
}
