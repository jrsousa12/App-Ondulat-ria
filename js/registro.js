/* Registro das respostas: estatística por questão, histórico de quizzes e caderno de erros. */

const HISTORICO_MAX = 200;
export const ACERTOS_PARA_SAIR_DO_CADERNO = 2;

/**
 * Registra uma resposta objetiva (quiz da trilha ou treino):
 * - estatística da questão (tentativas, acertos, último resultado);
 * - caderno de erros: entra ao errar; sai depois de 2 acertos seguidos.
 * Retorna 'entrou' | 'saiu' | null para a tela poder avisar o aluno.
 */
export function registrarResposta(dados, q, trilha, acertou) {
  if (!dados.questoes || typeof dados.questoes !== 'object') dados.questoes = {};
  const e = dados.questoes[q.id] || { trilha: String(trilha), subtema: q.subtema || '', tentativas: 0, acertos: 0 };
  e.tentativas++;
  if (acertou) e.acertos++;
  e.ultimoAcerto = acertou;
  e.em = new Date().toISOString();
  dados.questoes[q.id] = e;

  if (!dados.cadernoErros || typeof dados.cadernoErros !== 'object') dados.cadernoErros = {};
  const c = dados.cadernoErros[q.id];
  if (!acertou) {
    dados.cadernoErros[q.id] = { trilha: String(trilha), erros: (c?.erros || 0) + 1, acertosSeguidos: 0, em: e.em };
    return c ? null : 'entrou';
  }
  if (c) {
    c.acertosSeguidos = (c.acertosSeguidos || 0) + 1;
    c.em = e.em;
    if (c.acertosSeguidos >= ACERTOS_PARA_SAIR_DO_CADERNO) {
      delete dados.cadernoErros[q.id];
      return 'saiu';
    }
  }
  return null;
}

export function registrarTentativaQuiz(dados, { trilha, acertos, total, tentativa }) {
  if (!Array.isArray(dados.historico)) dados.historico = [];
  dados.historico.push({ trilha: String(trilha), acertos, total, tentativa, em: new Date().toISOString() });
  if (dados.historico.length > HISTORICO_MAX) dados.historico.splice(0, dados.historico.length - HISTORICO_MAX);
}

export function totalNoCaderno(dados) {
  return Object.keys(dados?.cadernoErros || {}).length;
}
