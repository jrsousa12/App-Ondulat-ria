import { hojeLocal } from '../utils.js';
import { confirmar } from '../dialogos.js';
import { $, estado, baixarArquivo } from './estado.js';
import { numFmt, renderizarResultados } from './resultados.js';

/**
 * Escapa uma célula CSV:
 * 1. Se começa com caractere de fórmula (= + - @ TAB CR), prefixa com `'`
 *    ANTES de escapar (o `'` fica dentro das aspas se houver vírgula)
 * 2. Depois, se houver vírgula/aspas/quebra de linha, envolve em aspas
 *    e duplica aspas internas
 */
function celulaCSV(valor) {
  let s = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function ligarExportar() {
  $('#btn-exportar-csv').addEventListener('click', () => {
    const linhas = [[
      'Arquivo', 'Nome', 'Sobrenome', 'Turma', 'XP', 'Trilhas concluídas',
      'Flashcards', 'Diário', 'Abertas', 'Badges', 'Aproveitamento (%)',
      'Trilha 1 (%)', 'Trilha 2 (%)', 'Trilha 3 (%)', 'Trilha 4 (%)', 'Trilha 5 (%)', 'Trilha 6 (%)',
      'Flags', 'Integridade', 'Exportado em'
    ]];
    for (const r of estado.relatorios) {
      if (r.erro) {
        linhas.push([r.arquivo, 'ERRO', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', r.erro, '']);
        continue;
      }
      const rel = r.relatorio || {};
      const a = rel.aluno || {};
      const res = rel.resumo || {};
      linhas.push([
        r.arquivo,
        a.primeiroNome || '',
        a.ultimoNome || '',
        a.turma || '',
        numFmt(res.xp, 0, '0'),
        numFmt(res.trilhasConcluidas, 0, '0'),
        numFmt(res.flashcardsEstudados, 0, '0'),
        numFmt(res.registrosDiario, 0, '0'),
        numFmt(res.atividadesAbertas, 0, '0'),
        numFmt(res.badgesGanhos, 0, '0'),
        numFmt(rel.questoes?.aproveitamento, 0, ''),
        ...['1', '2', '3', '4', '5', '6'].map(id => numFmt(rel.trilhas?.[id]?.quiz?.pct, 0, '')),
        Array.isArray(rel.flags) ? rel.flags.length : 0,
        r.integro ? 'OK' : 'FALHA',
        rel.exportadoEm || ''
      ]);
    }
    const csv = linhas.map(l => l.map(celulaCSV).join(',')).join('\n');
    baixarArquivo(`relatorios-ondulatoria-${hojeLocal()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  });

  $('#btn-limpar').addEventListener('click', async () => {
    if (!await confirmar({ titulo: 'Limpar todos os relatórios da tela?', texto: 'Os arquivos dos alunos não são apagados.', ok: 'Limpar' })) return;
    estado.relatorios = [];
    $('#card-resultados').hidden = true;
    renderizarResultados();
  });
}
