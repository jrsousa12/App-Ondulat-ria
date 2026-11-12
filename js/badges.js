import { avisarDestaque } from './dialogos.js';

const BADGES = [
  { id: 'iniciante', emoji: '🌱', nome: 'Iniciante', desc: 'Começou a jornada na Ondulatória', cond: d => !!d.aluno?.primeiroNome },
  { id: 'primeira-leitura', emoji: '📖', nome: 'Leitor Atento', desc: 'Concluiu a leitura de uma trilha', cond: d => Object.values(d.trilhas || {}).some(t => t.compreensao) },
  { id: 'primeira-trilha', emoji: '🎯', nome: 'Primeira Conquista', desc: 'Concluiu a Trilha 1', cond: d => d.trilhas?.['1']?.concluida },
  { id: 'gabaritou', emoji: '💯', nome: 'Gabaritou!', desc: 'Acertou todas as 10 questões de um quiz', cond: d => Object.values(d.trilhas || {}).some(t => t.quiz?.acertos === 10) },
  { id: 'flash-10', emoji: '🃏', nome: 'Cartão em Dia', desc: 'Estudou 10 flashcards', cond: d => Object.keys(d.flashcards || {}).length >= 10 },
  { id: 'flash-30', emoji: '🎴', nome: 'Mestre dos Cartões', desc: 'Estudou 30 flashcards', cond: d => Object.keys(d.flashcards || {}).length >= 30 },
  { id: 'diario-1', emoji: '👂', nome: 'Observador', desc: 'Fez o primeiro registro no diário sonoro', cond: d => (d.diario?.length || 0) >= 1 },
  { id: 'diario-5', emoji: '📝', nome: 'Cronista do Som', desc: 'Fez 5 registros no diário sonoro', cond: d => (d.diario?.length || 0) >= 5 },
  { id: 'aberta-1', emoji: '🤔', nome: 'Pensador', desc: 'Respondeu uma atividade aberta', cond: d => Object.keys(d.atividadesAbertas || {}).length >= 1 },
  { id: 'xp-100', emoji: '⭐', nome: 'Explorador', desc: 'Alcançou 100 XP', cond: d => (d.xp || 0) >= 100 },
  { id: 'xp-500', emoji: '🔬', nome: 'Cientista', desc: 'Alcançou 500 XP', cond: d => (d.xp || 0) >= 500 },
  { id: 'todas-trilhas', emoji: '🏆', nome: 'Mestre das Ondas', desc: 'Concluiu todas as 6 trilhas', cond: d => Object.values(d.trilhas || {}).filter(t => t.concluida).length === 6 }
];

export function listarTodosBadges() {
  return BADGES.map(b => ({ id: b.id, emoji: b.emoji, nome: b.nome, desc: b.desc }));
}

export function verificarNovosBadges(dados) {
  if (!Array.isArray(dados.badges)) dados.badges = [];
  const ganhos = new Set(dados.badges.map(b => b.id));
  const novos = [];
  for (const b of BADGES) {
    if (ganhos.has(b.id)) continue;
    try {
      if (b.cond(dados)) {
        dados.badges.push({ id: b.id, emoji: b.emoji, nome: b.nome, quando: new Date().toISOString() });
        novos.push(b);
      }
    } catch (_) {}
  }
  return novos;
}

export function mostrarToastBadges(novos) {
  novos.forEach((b, i) => {
    setTimeout(() => avisarDestaque({ emoji: b.emoji, titulo: `Conquista: ${b.nome}`, texto: b.desc }), i * 600);
  });
}
