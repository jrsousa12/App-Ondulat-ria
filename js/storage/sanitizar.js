import { hojeISO, clamp } from '../utils.js';
import { IDS_TRILHAS, AVATARES } from '../conteudo.js';
import { listarTodosBadges } from '../badges.js';

export const SCHEMA_VERSION = 1;

export function gerarNonce() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch (_) {}
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return 'nonce-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}


/* ============ Validação dos dados ============
   Tudo que vem do localStorage ou de um backup importado passa por aqui:
   só ficam os campos conhecidos, com o tipo e o tamanho esperados. */
const ID_OK = /^[\w.-]{1,60}$/;
const DATA_DIA = /^\d{4}-\d{2}-\d{2}$/;

function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function lista(v, max) { return Array.isArray(v) ? v.slice(-max) : []; }
function txt(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
function num(v, min, max, padrao = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, min, max) : padrao;
}
function int(v, min, max, padrao = 0) { return Math.round(num(v, min, max, padrao)); }
function dataISO(v) { return typeof v === 'string' && v.length <= 40 && !isNaN(Date.parse(v)) ? v : null; }
function trilhaOk(v) { const t = String(v ?? ''); return IDS_TRILHAS.has(t) ? t : null; }
export function semNulos(o) {
  Object.keys(o).forEach(k => { if (o[k] === null || o[k] === undefined) delete o[k]; });
  return o;
}

export function sanitizarDados(bruto) {
  const d = obj(bruto);
  const aluno = obj(d.aluno);
  const out = {
    schemaVersion: SCHEMA_VERSION,
    aluno: {
      primeiroNome: txt(aluno.primeiroNome, 30).trim(),
      ultimoNome: txt(aluno.ultimoNome, 30).trim(),
      turma: txt(aluno.turma, 10).trim(),
      avatar: AVATARES.includes(aluno.avatar) ? aluno.avatar : ''
    },
    nonceDispositivo: txt(d.nonceDispositivo, 64) || gerarNonce(),
    criadoEm: dataISO(d.criadoEm) || hojeISO(),
    ultimoAcesso: dataISO(d.ultimoAcesso) || hojeISO(),
    xp: int(d.xp, 0, 1_000_000),
    trilhas: {},
    flashcards: {},
    badges: [],
    flags: [],
    labPrefs: {},
    diario: [],
    atividadesAbertas: {},
    questoes: {},
    historico: [],
    cadernoErros: {},
    treino: {}
  };

  const tr = obj(d.treino);
  if (typeof tr.dia === 'string' && DATA_DIA.test(tr.dia)) out.treino.dia = tr.dia;
  if (tr.xp !== undefined) out.treino.xp = int(tr.xp, 0, 1000);
  if (tr.recordeCronometrado !== undefined) out.treino.recordeCronometrado = int(tr.recordeCronometrado, 0, 100);

  for (const [id, bruta] of Object.entries(obj(d.trilhas))) {
    if (!trilhaOk(id)) continue;
    const t = obj(bruta);
    const r = {};
    if (t.concluida === true) r.concluida = true;
    if (dataISO(t.concluidaEm)) r.concluidaEm = t.concluidaEm;
    if (t.compreensao) {
      const c = obj(t.compreensao);
      r.compreensao = { acertos: int(c.acertos, 0, 50), total: int(c.total, 1, 50, 3) };
    }
    if (t.quiz) {
      const q = obj(t.quiz);
      r.quiz = semNulos({
        acertos: int(q.acertos, 0, 50), total: int(q.total, 1, 50, 10), pct: num(q.pct, 0, 100),
        passou: q.passou === true, xpGanho: int(q.xpGanho, 0, 10_000), em: dataISO(q.em)
      });
    }
    if (t.tentativasQuiz !== undefined) r.tentativasQuiz = int(t.tentativasQuiz, 0, 10_000);
    if (t.xpTotalGanho !== undefined) r.xpTotalGanho = int(t.xpTotalGanho, 0, 100_000);
    out.trilhas[id] = r;
  }

  for (const [id, bruto] of Object.entries(obj(d.flashcards))) {
    if (!ID_OK.test(id)) continue;
    const c = obj(bruto);
    out.flashcards[id] = {
      facilidade: num(c.facilidade, 1.3, 2.5, 2.5),
      intervalo: num(c.intervalo, 0, 180),
      proximaRevisao: typeof c.proximaRevisao === 'string' && DATA_DIA.test(c.proximaRevisao) ? c.proximaRevisao : null,
      repeticoes: int(c.repeticoes, 0, 10_000),
      ultimaVez: dataISO(c.ultimaVez)
    };
  }

  const badgesValidos = new Map(listarTodosBadges().map(b => [b.id, b]));
  const vistos = new Set();
  for (const b of lista(d.badges, 100)) {
    const ref = badgesValidos.get(obj(b).id);
    if (!ref || vistos.has(ref.id)) continue;
    vistos.add(ref.id);
    out.badges.push(semNulos({ id: ref.id, emoji: ref.emoji, nome: ref.nome, quando: dataISO(b.quando) }));
  }

  for (const f of lista(d.flags, 500)) {
    const o = obj(f);
    if (!txt(o.tipo, 40)) continue;
    out.flags.push(semNulos({
      tipo: txt(o.tipo, 40), quando: dataISO(o.quando),
      trilha: trilhaOk(o.trilha), questao: ID_OK.test(o.questao || '') ? o.questao : null,
      tempoMs: o.tempoMs !== undefined ? int(o.tempoMs, 0, 86_400_000) : null,
      origem: txt(o.origem, 64) || null
    }));
  }

  const lab = obj(d.labPrefs);
  if (lab.freq !== undefined) out.labPrefs.freq = int(lab.freq, 200, 1000, 440);
  if (lab.amp !== undefined) out.labPrefs.amp = num(lab.amp, 0.1, 1, 0.7);

  for (const r of lista(d.diario, 500)) {
    const o = obj(r);
    const descricao = txt(o.descricao, 300);
    if (!descricao) continue;
    out.diario.push({
      id: ID_OK.test(o.id || '') ? o.id : 'reg-' + gerarNonce().slice(0, 12),
      quando: dataISO(o.quando) || hojeISO(),
      local: txt(o.local, 60), descricao,
      altura: txt(o.altura, 30), intensidade: txt(o.intensidade, 30),
      timbre: txt(o.timbre, 60), reflexao: txt(o.reflexao, 300)
    });
  }

  for (const [id, bruto] of Object.entries(obj(d.atividadesAbertas))) {
    if (!ID_OK.test(id)) continue;
    const o = obj(bruto);
    const resposta = txt(o.resposta, 800);
    if (!resposta) continue;
    out.atividadesAbertas[id] = semNulos({ resposta, quando: dataISO(o.quando), trilha: trilhaOk(o.trilha) });
  }

  for (const [id, bruto] of Object.entries(obj(d.questoes))) {
    if (!ID_OK.test(id)) continue;
    const o = obj(bruto);
    const tentativas = int(o.tentativas, 0, 10_000);
    out.questoes[id] = semNulos({
      trilha: trilhaOk(o.trilha), subtema: /^[a-z-]{1,40}$/.test(o.subtema || '') ? o.subtema : '',
      tentativas, acertos: int(o.acertos, 0, tentativas), ultimoAcerto: o.ultimoAcerto === true,
      em: dataISO(o.em)
    });
  }

  for (const h of lista(d.historico, 200)) {
    const o = obj(h);
    const trilha = trilhaOk(o.trilha);
    if (!trilha) continue;
    const total = int(o.total, 1, 50, 10);
    out.historico.push(semNulos({
      trilha, acertos: int(o.acertos, 0, total), total,
      tentativa: int(o.tentativa, 1, 10_000, 1), em: dataISO(o.em) || hojeISO()
    }));
  }

  for (const [id, bruto] of Object.entries(obj(d.cadernoErros))) {
    if (!ID_OK.test(id)) continue;
    const o = obj(bruto);
    out.cadernoErros[id] = semNulos({
      trilha: trilhaOk(o.trilha), acertosSeguidos: int(o.acertosSeguidos, 0, 10),
      erros: int(o.erros, 1, 10_000, 1), em: dataISO(o.em)
    });
  }

  return out;
}
