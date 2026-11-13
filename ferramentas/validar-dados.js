#!/usr/bin/env node
/* Confere os arquivos de dados (trilhas, questões e flashcards).
   Uso: node ferramentas/validar-dados.js   (sai com código 1 se houver erro) */
'use strict';
const fs = require('fs');
const path = require('path');

const DADOS = path.join(__dirname, '..', 'dados');
const TRILHAS = ['1', '2', '3', '4', '5', '6'];
const DIFICULDADES = new Set(['facil', 'medio', 'desafio']);
const TIPOS = new Set(['multipla_escolha', 'predicao', 'calculo_guiado', 'verdadeiro_falso', 'associacao', 'ordenacao', 'analise_erro', 'aberta']);

const erros = [];
const avisos = [];
const idsGlobais = new Map();

function ler(nome) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DADOS, nome), 'utf8'));
  } catch (e) {
    erros.push(`${nome}: não foi possível ler (${e.message})`);
    return null;
  }
}

function texto(v) { return typeof v === 'string' && v.trim().length > 0; }

function registrarId(id, onde) {
  if (!texto(id)) { erros.push(`${onde}: id ausente`); return; }
  if (idsGlobais.has(id)) erros.push(`${onde}: id "${id}" repetido (também em ${idsGlobais.get(id)})`);
  else idsGlobais.set(id, onde);
}

function conferirAlternativas(q, onde) {
  if (!Array.isArray(q.alternativas) || q.alternativas.length < 2) {
    erros.push(`${onde}: precisa de 2 ou mais alternativas`);
    return;
  }
  if (q.alternativas.some(a => !texto(a))) erros.push(`${onde}: alternativa vazia`);
  const norm = q.alternativas.map(a => String(a).trim().toLowerCase());
  if (new Set(norm).size !== norm.length) erros.push(`${onde}: alternativas repetidas`);
  if (!Number.isInteger(q.correta) || q.correta < 0 || q.correta >= q.alternativas.length) {
    erros.push(`${onde}: gabarito (correta=${q.correta}) fora das alternativas`);
  }
}

for (const t of TRILHAS) {
  const nomeT = `trilha-${t}.json`;
  const trilha = ler(nomeT);
  if (trilha) {
    if (!texto(trilha.titulo)) erros.push(`${nomeT}: título ausente`);
    if (!Array.isArray(trilha.secoes) || !trilha.secoes.length) erros.push(`${nomeT}: sem seções`);
    (trilha.secoes || []).forEach((s, i) => {
      const onde = `${nomeT} seção ${i + 1}`;
      if (!texto(s.titulo)) erros.push(`${onde}: título ausente`);
      if (!Array.isArray(s.texto) || !s.texto.length || s.texto.some(p => !texto(p))) erros.push(`${onde}: texto vazio`);
    });
    const comp = trilha.perguntasCompreensao;
    if (!Array.isArray(comp) || comp.length < 1) erros.push(`${nomeT}: sem perguntas de compreensão`);
    (comp || []).forEach(p => {
      const onde = `${nomeT} ${p.id}`;
      registrarId(p.id, onde);
      if (!texto(p.pergunta)) erros.push(`${onde}: pergunta vazia`);
      if (!texto(p.explicacao)) erros.push(`${onde}: explicação vazia`);
      conferirAlternativas(p, onde);
    });
  }

  const nomeQ = `questoes-trilha-${t}.json`;
  const banco = ler(nomeQ);
  if (!banco) continue;
  if (!Array.isArray(banco.questoes)) { erros.push(`${nomeQ}: falta a lista "questoes"`); continue; }
  const auto = banco.questoes.filter(q => !['aberta', 'analise_erro'].includes(q.tipo));
  if (auto.length < 10) erros.push(`${nomeQ}: só ${auto.length} questões objetivas (o quiz usa 10)`);

  for (const q of banco.questoes) {
    const onde = `${nomeQ} ${q.id || '(sem id)'}`;
    registrarId(q.id, onde);
    if (!TIPOS.has(q.tipo)) erros.push(`${onde}: tipo desconhecido "${q.tipo}"`);
    if (!DIFICULDADES.has(q.dificuldade)) erros.push(`${onde}: dificuldade inválida "${q.dificuldade}"`);
    if (!texto(q.enunciado)) erros.push(`${onde}: enunciado vazio`);
    if (!texto(q.subtema)) avisos.push(`${onde}: sem subtema`);
    if (!texto(q.explicacao) && !['aberta'].includes(q.tipo)) erros.push(`${onde}: explicação vazia`);

    if (['multipla_escolha', 'predicao', 'calculo_guiado'].includes(q.tipo)) conferirAlternativas(q, onde);
    if (q.tipo === 'verdadeiro_falso' && typeof q.correta !== 'boolean') erros.push(`${onde}: correta deve ser true/false`);
    if (q.tipo === 'associacao') {
      const okA = Array.isArray(q.colunaA) && q.colunaA.length >= 2;
      const okB = Array.isArray(q.colunaB) && q.colunaB.length >= 2;
      if (!okA || !okB) erros.push(`${onde}: colunas A e B precisam de 2 ou mais itens`);
      else if (!Array.isArray(q.correta) || q.correta.length !== q.colunaA.length ||
        q.correta.some(i => !Number.isInteger(i) || i < 0 || i >= q.colunaB.length)) {
        erros.push(`${onde}: gabarito da associação inválido`);
      }
    }
    if (q.tipo === 'ordenacao') {
      if (!Array.isArray(q.itens) || q.itens.length < 2) erros.push(`${onde}: ordenação precisa de 2 ou mais itens`);
      else if (!Array.isArray(q.correta) || q.correta.length !== q.itens.length ||
        [...q.correta].sort().join('|') !== [...q.itens].sort().join('|')) {
        erros.push(`${onde}: "correta" deve conter exatamente os mesmos itens de "itens"`);
      } else if (new Set(q.itens).size !== q.itens.length) erros.push(`${onde}: itens repetidos`);
    }
    if (q.tipo === 'aberta' && (!Array.isArray(q.criterios) || !q.criterios.length)) avisos.push(`${onde}: sem critérios de avaliação`);
    if (q.tipo === 'analise_erro' && !texto(q.respostaEsperada)) erros.push(`${onde}: sem respostaEsperada`);
  }
}

const extra = ler('questoes-extra.json');
if (extra) {
  if (!Array.isArray(extra.questoes)) erros.push('questoes-extra.json: falta a lista "questoes"');
  for (const q of extra.questoes || []) {
    const onde = `questoes-extra.json ${q.id || '(sem id)'}`;
    registrarId(q.id, onde);
    if (!TRILHAS.includes(String(q.trilha))) erros.push(`${onde}: trilha inválida "${q.trilha}"`);
    if (!['basico', 'aprofundamento'].includes(q.nivel)) erros.push(`${onde}: nível inválido "${q.nivel}"`);
    if (!DIFICULDADES.has(q.dificuldade)) erros.push(`${onde}: dificuldade inválida`);
    if (!texto(q.enunciado) || !texto(q.explicacao)) erros.push(`${onde}: enunciado ou explicação vazios`);
    if (!texto(q.subtema)) erros.push(`${onde}: sem subtema`);
    if (['multipla_escolha', 'calculo_guiado'].includes(q.tipo)) {
      conferirAlternativas(q, onde);
      for (const k of Object.keys(q.feedbackErro || {})) {
        if (+k === q.correta || !(+k >= 0 && +k < (q.alternativas || []).length)) erros.push(`${onde}: comentário para alternativa inválida (${k})`);
      }
    } else if (q.tipo === 'verdadeiro_falso') {
      if (typeof q.correta !== 'boolean') erros.push(`${onde}: correta deve ser true/false`);
      for (const k of Object.keys(q.feedbackErro || {})) {
        if (k !== String(!q.correta)) erros.push(`${onde}: comentário para a resposta certa (${k})`);
      }
    } else erros.push(`${onde}: tipo não suportado no treino "${q.tipo}"`);
  }
}

const flash = ler('flashcards.json');
if (flash) {
  if (!Array.isArray(flash.cartoes) || !flash.cartoes.length) erros.push('flashcards.json: sem cartões');
  (flash.cartoes || []).forEach(c => {
    const onde = `flashcards.json ${c.id || '(sem id)'}`;
    registrarId(c.id, onde);
    if (!texto(c.frente) || !texto(c.verso)) erros.push(`${onde}: frente ou verso vazio`);
    if (!TRILHAS.includes(String(c.trilha))) erros.push(`${onde}: trilha inválida "${c.trilha}"`);
  });
}

// O modo sem internet (sw.js) precisa listar todos os arquivos do app.
try {
  const RAIZ = path.join(__dirname, '..');
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  const necessarios = [
    'index.html', 'css/estilo.css', 'manifest.webmanifest',
    ...fs.readdirSync(path.join(RAIZ, 'js'), { recursive: true }).map(f => f.replace(/\\/g, '/'))
      .filter(f => f.endsWith('.js') && !['professor.js', 'file-check.js'].includes(f)).map(f => 'js/' + f),
    ...fs.readdirSync(DADOS).filter(f => f.endsWith('.json')).map(f => 'dados/' + f)
  ];
  for (const f of necessarios) if (!sw.includes(`'./${f}'`)) erros.push(`sw.js: falta "${f}" na lista do modo sem internet`);
} catch (e) {
  erros.push('sw.js: não foi possível conferir (' + e.message + ')');
}

avisos.forEach(a => console.log('aviso: ' + a));
erros.forEach(e => console.error('ERRO: ' + e));
console.log(`\n${idsGlobais.size} itens conferidos · ${erros.length} erro(s) · ${avisos.length} aviso(s)`);
process.exit(erros.length ? 1 : 0);
