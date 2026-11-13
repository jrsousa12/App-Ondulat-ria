import { esc } from './utils.js';
import { carregarJSON } from './conteudo.js';
import { esqueleto } from './ui.js';
import { renderLeitura, pausarTimerLeitura, retomarTimerLeitura } from './trilha/leitura.js';
import { iniciarCompreensao } from './trilha/compreensao.js';
import { iniciarQuiz } from './trilha/quiz.js';

let cleanupAtual = null;
let trilhaToken = 0;

export function cleanupTrilha() {
  trilhaToken++;
  if (cleanupAtual) {
    try { cleanupAtual(); } catch (_) {}
    cleanupAtual = null;
  }
}

function calcularTempoEstimadoMs(secoes) {
  let palavras = 0;
  for (const s of secoes) {
    for (const p of s.texto) palavras += p.split(/\s+/).filter(Boolean).length;
  }
  const minutos = (palavras / 200) * 1.3;
  return Math.max(60_000, minutos * 60_000);
}

export async function renderTrilha(id, dados, salvarDados) {
  cleanupTrilha();
  const myToken = trilhaToken;

  const conteudo = document.querySelector('#conteudo');
  conteudo.dataset.trilha = id;
  conteudo.innerHTML = esqueleto(3);

  let trilha, banco;
  try {
    [trilha, banco] = await Promise.all([
      carregarJSON(`dados/trilha-${id}.json`),
      carregarJSON(`dados/questoes-trilha-${id}.json`)
    ]);
  } catch (e) {
    if (myToken !== trilhaToken) return;
    conteudo.innerHTML = `
      <section class="card">
        <h2 class="erro-carregamento">Não foi possível carregar a trilha</h2>
        <p>Verifique se você está rodando o app a partir de um servidor local
        (por exemplo, <code>python -m http.server</code>) — abrir o arquivo
        direto com <code>file://</code> bloqueia o carregamento dos dados.</p>
        <p style="color:var(--texto-fraco);font-size:0.9rem">Detalhe técnico: ${esc(e.message)}</p>
        <a href="#trilhas" class="btn btn-secundario">Voltar</a>
      </section>`;
    return;
  }

  if (myToken !== trilhaToken) return;

  const estado = {
    fase: 'leitura',
    tempoLeituraVisivelMs: 0,
    ultimaVisibilidadeMs: document.hidden ? null : Date.now(),
    chegouAoFim: false,
    tempoEstimadoMs: calcularTempoEstimadoMs(trilha.secoes),
    compreensaoRespostas: [],
    tentativasQuiz: (dados.trilhas?.[id]?.tentativasQuiz || 0) + 1,
    questoesQuiz: [],
    indiceQuestao: 0,
    respostasQuiz: [],
    inicioQuestaoMs: 0
  };

  let cleanupFaseAtual = null;
  const registrarCleanup = (fn) => {
    if (cleanupFaseAtual) { try { cleanupFaseAtual(); } catch (_) {} }
    cleanupFaseAtual = fn;
  };

  const onVisibilidade = () => {
    if (document.hidden) {
      pausarTimerLeitura(estado);
      if (estado.fase === 'quiz') {
        dados.flags = dados.flags || [];
        dados.flags.push({ tipo: 'troca_aba_quiz', quando: new Date().toISOString(), trilha: id });
        salvarDados();
      }
    } else {
      retomarTimerLeitura(estado);
    }
  };
  document.addEventListener('visibilitychange', onVisibilidade);

  cleanupAtual = () => {
    if (cleanupFaseAtual) { try { cleanupFaseAtual(); } catch (_) {} cleanupFaseAtual = null; }
    document.removeEventListener('visibilitychange', onVisibilidade);
    pausarTimerLeitura(estado);
    delete conteudo.dataset.trilha;
  };

  const ctx = { id, dados, salvarDados, trilha, banco, estado, conteudo, registrarCleanup };
  ctx.ir = {
    leitura: () => renderLeitura(ctx),
    compreensao: () => iniciarCompreensao(ctx),
    quiz: () => iniciarQuiz(ctx),
    reiniciar: () => renderTrilha(id, dados, salvarDados)
  };
  renderLeitura(ctx);
}
