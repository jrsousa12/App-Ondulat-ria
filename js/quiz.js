/* Motor de questões usado pelo quiz das trilhas e pelo Treino:
   embaralha, desenha, confere e marca a resposta, para todos os tipos objetivos. */
import { esc, shuffle } from './utils.js';
import { avisar } from './dialogos.js';

export const TIPOS_AUTO = ['multipla_escolha', 'predicao', 'calculo_guiado', 'verdadeiro_falso', 'associacao', 'ordenacao'];
const TIPOS_ALTERNATIVAS = ['multipla_escolha', 'predicao', 'calculo_guiado'];
const LETRAS = ['a', 'b', 'c', 'd', 'e', 'f'];

/** Escapa o texto e mostra divisões escritas como "a / b" como fração empilhada. */
export function formatarTexto(texto) {
  return esc(texto).replace(
    /([\wλ°₀-₉²³.,·]+|\([^()\s]{1,20}\)) \/ ([\wλ°₀-₉²³.,·]+|\([^()\s]{1,20}\))/g,
    '<span class="frac" role="math" aria-label="$1 dividido por $2"><span>$1</span><span>$2</span></span>'
  );
}

/**
 * Embaralha alternativas (ajustando o gabarito, as referências "(a)" da explicação e os
 * comentários por alternativa), a coluna B da associação e os itens da ordenação.
 */
export function embaralharQuestao(q) {
  if (TIPOS_ALTERNATIVAS.includes(q.tipo)) {
    const n = q.alternativas.length;
    const ordem = shuffle(q.alternativas.map((_, i) => i));
    const novaPos = {};
    ordem.forEach((orig, nova) => { novaPos[orig] = nova; });
    const explicacao = (q.explicacao || '').replace(/\(([a-fA-F])\)/g, (m, letra) => {
      const orig = LETRAS.indexOf(letra.toLowerCase());
      return orig < 0 || orig >= n ? m : `(${LETRAS[novaPos[orig]]})`;
    });
    let feedbackErro;
    if (q.feedbackErro) {
      feedbackErro = {};
      for (const [k, v] of Object.entries(q.feedbackErro)) feedbackErro[novaPos[+k]] = v;
    }
    return { ...q, alternativas: ordem.map(i => q.alternativas[i]), correta: ordem.indexOf(q.correta), explicacao, feedbackErro };
  }
  if (q.tipo === 'associacao') {
    const ordemB = shuffle(q.colunaB.map((_, i) => i));
    return { ...q, colunaB: ordemB.map(i => q.colunaB[i]), correta: q.correta.map(orig => ordemB.indexOf(orig)) };
  }
  if (q.tipo === 'ordenacao') {
    const ordem = shuffle(q.itens.map((_, i) => i));
    // Para cada item na posição exibida, a posição correta (0 = primeiro).
    return { ...q, itens: ordem.map(i => q.itens[i]), correta: ordem.map(orig => q.correta.indexOf(q.itens[orig])) };
  }
  return q;
}

/** HTML do enunciado e da área de resposta. */
export function htmlPergunta(q) {
  let corpo = `<h3>${formatarTexto(q.enunciado)}</h3>`;
  if (TIPOS_ALTERNATIVAS.includes(q.tipo) || q.tipo === 'verdadeiro_falso') {
    corpo += '<div id="alt-container"></div>';
  } else if (q.tipo === 'associacao') {
    corpo += `<div id="assoc-container">
      ${q.colunaA.map((item, i) => `
        <div class="assoc-item">
          <label for="assoc-${i}">${esc(item)}</label>
          <select id="assoc-${i}" data-i="${i}">
            <option value="">— selecione —</option>
            ${q.colunaB.map((op, j) => `<option value="${j}">${esc(op)}</option>`).join('')}
          </select>
        </div>`).join('')}
    </div>
    <div class="btn-grupo"><button class="btn" id="btn-responder-assoc">Responder</button></div>`;
  } else if (q.tipo === 'ordenacao') {
    corpo += `<p class="ord-instrucao">Escolha a posição de cada item (1º = primeiro).</p>
      <div id="ord-container">
      ${q.itens.map((item, i) => `
        <div class="ord-item">
          <span>${esc(item)}</span>
          <select data-i="${i}" class="ord-select" aria-label="Posição de ${esc(item)}">
            ${q.itens.map((_, j) => `<option value="${j + 1}"${i === j ? ' selected' : ''}>${j + 1}º</option>`).join('')}
          </select>
        </div>`).join('')}
      </div>
      <div class="btn-grupo"><button class="btn" id="btn-responder-ord">Responder</button></div>`;
  } else {
    corpo += '<p>Formato não suportado.</p>';
  }
  return corpo;
}

/** Cria os botões/campos da resposta dentro de `raiz` e chama onResposta(tipo, resposta). */
export function ligarResposta(raiz, q, onResposta) {
  const alts = raiz.querySelector('#alt-container');
  if (TIPOS_ALTERNATIVAS.includes(q.tipo)) {
    q.alternativas.forEach((txt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'alternativa';
      b.innerHTML = `<strong>${LETRAS[i].toUpperCase()})</strong> ${formatarTexto(txt)}`;
      b.addEventListener('click', () => onResposta('mc', i));
      alts.appendChild(b);
    });
  } else if (q.tipo === 'verdadeiro_falso') {
    [['Verdadeiro', true], ['Falso', false]].forEach(([txt, val]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'alternativa';
      b.textContent = txt;
      b.addEventListener('click', () => onResposta('vf', val));
      alts.appendChild(b);
    });
  } else if (q.tipo === 'associacao') {
    raiz.querySelector('#btn-responder-assoc').addEventListener('click', () => {
      const resposta = [...raiz.querySelectorAll('#assoc-container select')].map(s => s.value === '' ? -1 : parseInt(s.value, 10));
      if (resposta.some(v => v < 0)) { avisar('Selecione uma opção para cada item.', 'erro'); return; }
      onResposta('assoc', resposta);
    });
  } else if (q.tipo === 'ordenacao') {
    raiz.querySelector('#btn-responder-ord').addEventListener('click', () => {
      const ordem = [...raiz.querySelectorAll('#ord-container select')].map(s => parseInt(s.value, 10) - 1);
      if (new Set(ordem).size !== ordem.length) { avisar('Cada item precisa de uma posição diferente.', 'erro'); return; }
      onResposta('ord', ordem);
    });
  }
}

export function verificarResposta(q, tipo, resposta) {
  if (tipo === 'mc' || tipo === 'vf') return resposta === q.correta;
  if (tipo === 'assoc') {
    return Array.isArray(resposta) && resposta.length === q.correta.length && resposta.every((v, i) => v === q.correta[i]);
  }
  if (tipo === 'ord') {
    return Array.isArray(resposta) && resposta.length === q.itens.length && resposta.every((p, i) => p === q.correta[i]);
  }
  return false;
}

/** Trava a resposta e pinta certa/errada. */
export function marcarResposta(raiz, q, tipo, resposta) {
  raiz.querySelectorAll('.alternativa').forEach(b => { b.disabled = true; });
  raiz.querySelectorAll('#assoc-container select, #ord-container select').forEach(s => { s.disabled = true; });
  raiz.querySelectorAll('#btn-responder-assoc, #btn-responder-ord').forEach(b => { b.disabled = true; });
  if (tipo === 'mc' || tipo === 'vf') {
    const certa = tipo === 'vf' ? (q.correta ? 0 : 1) : q.correta;
    const escolha = tipo === 'vf' ? (resposta ? 0 : 1) : resposta;
    raiz.querySelectorAll('#alt-container .alternativa').forEach((b, i) => {
      if (i === certa) b.classList.add('correta');
      else if (i === escolha) b.classList.add('incorreta');
    });
  }
}

/** Comentário específico para a alternativa errada escolhida (quando a questão tiver). */
export function comentarioDoErro(q, tipo, resposta) {
  if (!q.feedbackErro) return null;
  if (tipo === 'mc') return q.feedbackErro[resposta] || null;
  if (tipo === 'vf') return q.feedbackErro[String(resposta)] || null;
  return null;
}
