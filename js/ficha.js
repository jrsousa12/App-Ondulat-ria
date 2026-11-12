/* Ficha da aula para imprimir: resumo, conceitos-chave, exercícios e gabarito de uma trilha. */
import { esc } from './utils.js';
import { carregarJSON, trilhaPorId, IDS_TRILHAS } from './conteudo.js';
import { formatarTexto } from './quiz.js';
import { esqueleto } from './ui.js';

const LETRAS = ['a', 'b', 'c', 'd', 'e', 'f'];

export async function renderFicha(id) {
  const conteudo = document.querySelector('#conteudo');
  if (!IDS_TRILHAS.has(String(id))) {
    conteudo.innerHTML = '<section class="card"><h2>Ficha não encontrada</h2><a href="#trilhas" class="btn">Voltar às trilhas</a></section>';
    return;
  }
  conteudo.innerHTML = esqueleto(3);
  let trilha, banco, flash;
  try {
    [trilha, banco, flash] = await Promise.all([
      carregarJSON(`dados/trilha-${id}.json`),
      carregarJSON(`dados/questoes-trilha-${id}.json`),
      carregarJSON('dados/flashcards.json')
    ]);
  } catch (e) {
    conteudo.innerHTML = `<section class="card"><p class="erro-carregamento">Não foi possível montar a ficha: ${esc(e.message)}</p></section>`;
    return;
  }
  if (location.hash !== `#ficha/${id}`) return; // o aluno saiu enquanto carregava

  const info = trilhaPorId(id);
  const conceitos = flash.cartoes.filter(c => String(c.trilha) === String(id));
  const abertas = banco.questoes.filter(q => q.tipo === 'aberta' || q.tipo === 'analise_erro').slice(0, 3);
  const comp = trilha.perguntasCompreensao;

  conteudo.innerHTML = `
    <div class="ficha-acoes nao-imprimir">
      <a href="#trilha/${esc(id)}" class="tela-voltar">← Voltar à trilha</a>
      <button class="btn" id="btn-imprimir">🖨️ Imprimir ou salvar em PDF</button>
    </div>
    <article class="ficha" data-trilha="${esc(id)}">
      <header class="ficha-cab">
        <p class="ficha-rotulo">Ondulatória · 9º ano · Ficha da aula</p>
        <h2>Trilha ${esc(id)} — ${esc(info.titulo)}</h2>
        <div class="ficha-campos"><span>Nome: ____________________________</span><span>Turma: ______</span><span>Data: ___/___/_____</span></div>
      </header>

      <section>
        <h3>Conceitos-chave</h3>
        <dl class="ficha-conceitos">
          ${conceitos.map(c => `<div><dt>${formatarTexto(c.frente)}</dt><dd>${formatarTexto(c.verso)}</dd></div>`).join('')}
        </dl>
      </section>

      <section>
        <h3>Texto da aula</h3>
        ${trilha.secoes.map((s, i) => `
          <h4>${i + 1}. ${esc(s.titulo)}</h4>
          ${s.texto.map(p => `<p>${formatarTexto(p)}</p>`).join('')}`).join('')}
      </section>

      <section class="ficha-exercicios">
        <h3>Exercícios</h3>
        <ol>
          ${comp.map(p => `
            <li>${formatarTexto(p.pergunta)}
              <ol class="ficha-alts" type="a">${p.alternativas.map(a => `<li>${formatarTexto(a)}</li>`).join('')}</ol>
            </li>`).join('')}
          ${abertas.map(q => `
            <li>${formatarTexto(q.enunciado)}
              <div class="ficha-linhas" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
            </li>`).join('')}
        </ol>
      </section>

      <section class="ficha-gabarito">
        <h3>Gabarito</h3>
        <p>${comp.map((p, i) => `${i + 1}) ${LETRAS[p.correta]}`).join(' · ')}${abertas.length ? ` · ${comp.length + 1} a ${comp.length + abertas.length}) respostas pessoais, avaliadas pelo professor` : ''}</p>
      </section>
    </article>`;
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
}
