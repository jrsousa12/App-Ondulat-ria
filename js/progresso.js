/* Regras de progresso compartilhadas pelas telas. */
import { TRILHAS } from './conteudo.js';

export const XP_POR_NIVEL = 100;

export function nivel(xp = 0) {
  return { nivel: Math.floor(xp / XP_POR_NIVEL) + 1, noNivel: xp % XP_POR_NIVEL };
}

export function trilhaConcluida(dados, id) {
  return dados?.trilhas?.[String(id)]?.concluida === true;
}

export function trilhaLiberada(dados, id) {
  const n = parseInt(id, 10);
  return n === 1 || trilhaConcluida(dados, String(n - 1));
}

/** 0 = não começou, 1 = leitura, 2 = compreensão feita, 3 = concluída. */
export function etapasTrilha(dados, id) {
  const t = dados?.trilhas?.[String(id)];
  if (!t) return 0;
  if (t.concluida) return 3;
  if (t.compreensao) return 2;
  return 1;
}

export function proximaTrilha(dados) {
  return TRILHAS.find(t => !trilhaConcluida(dados, t.id) && trilhaLiberada(dados, t.id)) || null;
}

export function totalConcluidas(dados) {
  return TRILHAS.filter(t => trilhaConcluida(dados, t.id)).length;
}
