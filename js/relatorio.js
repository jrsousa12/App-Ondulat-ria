import { criptografarRelatorio } from './crypto.js';
import { CHAVE_PUBLICA_PROFESSOR } from './chave-publica.js';
import { hojeLocal } from './utils.js';

function construirRelatorio(dados) {
  const trilhas = {};
  for (const [id, t] of Object.entries(dados.trilhas || {})) {
    trilhas[id] = {
      concluida: !!t.concluida,
      tentativasQuiz: t.tentativasQuiz || 0,
      quiz: t.quiz || null,
      compreensao: t.compreensao || null,
      concluidaEm: t.concluidaEm || null,
      xpTotalGanho: t.xpTotalGanho || 0
    };
  }

  return {
    app: 'ondulatoria',
    versaoApp: 1,
    exportadoEm: new Date().toISOString(),
    nonceDispositivo: dados.nonceDispositivo || null,
    aluno: {
      primeiroNome: dados.aluno?.primeiroNome || '',
      ultimoNome: dados.aluno?.ultimoNome || '',
      turma: dados.aluno?.turma || ''
    },
    resumo: {
      xp: dados.xp || 0,
      trilhasConcluidas: Object.values(dados.trilhas || {}).filter(t => t.concluida).length,
      totalTrilhas: 6,
      flashcardsEstudados: Object.keys(dados.flashcards || {}).length,
      registrosDiario: (dados.diario || []).length,
      atividadesAbertas: Object.keys(dados.atividadesAbertas || {}).length,
      badgesGanhos: (dados.badges || []).length
    },
    trilhas,
    atividadesAbertas: dados.atividadesAbertas || {},
    diario: dados.diario || [],
    badges: dados.badges || [],
    flashcards: dados.flashcards || {},
    flags: dados.flags || []
  };
}

export function chaveConfigurada() {
  return typeof CHAVE_PUBLICA_PROFESSOR === 'string' && CHAVE_PUBLICA_PROFESSOR.trim().length > 50;
}

export function fingerprintChave() {
  if (!chaveConfigurada()) return null;
  return CHAVE_PUBLICA_PROFESSOR.slice(0, 8) + '…';
}

function normalizarNomeArquivo(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export async function exportarParaProfessor(dados) {
  if (!chaveConfigurada()) {
    throw new Error('O professor ainda não configurou a chave de envio. Baixe seu progresso como backup normal.');
  }
  const relatorio = construirRelatorio(dados);
  const pacote = await criptografarRelatorio(relatorio, CHAVE_PUBLICA_PROFESSOR);
  const a = relatorio.aluno;
  const partes = [
    normalizarNomeArquivo(a.primeiroNome),
    normalizarNomeArquivo(a.ultimoNome),
    normalizarNomeArquivo(a.turma)
  ].filter(Boolean);
  const nomeArq = partes.join('-') || 'aluno';
  const arquivo = {
    para: 'professor', versao: 1,
    aluno: `${a.primeiroNome || '?'} ${a.ultimoNome || ''}`.trim(),
    turma: a.turma || '',
    data: hojeLocal(),
    ...pacote
  };
  const blob = new Blob([JSON.stringify(arquivo, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url;
  el.download = `relatorio-${nomeArq}-${hojeLocal()}.json`;
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
