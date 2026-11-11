import { hojeISO, hojeLocal } from './utils.js';

const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'ondulatoria_dados_v1';
const FLAG_KEY = 'ondulatoria_flag_integridade';
const CORROMPIDO_KEY = 'ondulatoria_dados_corrompido';

function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function gerarNonce() {
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

function estadoInicial() {
  return {
    schemaVersion: SCHEMA_VERSION,
    aluno: { primeiroNome: '', ultimoNome: '', turma: '' },
    nonceDispositivo: gerarNonce(),
    criadoEm: hojeISO(),
    ultimoAcesso: hojeISO(),
    xp: 0,
    trilhas: {},
    flashcards: {},
    badges: [],
    flags: [],
    labPrefs: {},
    diario: [],
    atividadesAbertas: {}
  };
}

let ultimoErroQuota = null;
export function consumirErroQuota() {
  const e = ultimoErroQuota;
  ultimoErroQuota = null;
  return e;
}

export const storage = {
  carregar() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.error('[storage] Erro ao acessar localStorage:', e);
      return null;
    }
    if (!raw) return null;

    let pacote;
    try {
      pacote = JSON.parse(raw);
    } catch (e) {
      console.error('[storage] JSON inválido — preservando em backup:', e);
      try {
        if (!localStorage.getItem(CORROMPIDO_KEY)) {
          localStorage.setItem(CORROMPIDO_KEY, raw);
        }
      } catch (_) {}
      return null;
    }

    if (!pacote || typeof pacote !== 'object' || !pacote.dados || typeof pacote.dados !== 'object') {
      console.warn('[storage] Formato inválido — preservando em backup.');
      try {
        if (!localStorage.getItem(CORROMPIDO_KEY)) {
          localStorage.setItem(CORROMPIDO_KEY, raw);
        }
      } catch (_) {}
      return null;
    }

    const hashEsperado = hashString(JSON.stringify(pacote.dados));
    const integridadeViolada = pacote.integridade !== hashEsperado;

    let precisaSalvar = integridadeViolada;

    if (!pacote.dados.aluno || typeof pacote.dados.aluno !== 'object') {
      pacote.dados.aluno = { primeiroNome: '', ultimoNome: '', turma: '' };
      precisaSalvar = true;
    }
    if (!pacote.dados.nonceDispositivo) {
      pacote.dados.nonceDispositivo = gerarNonce();
      precisaSalvar = true;
    }
    if (!Array.isArray(pacote.dados.flags)) {
      pacote.dados.flags = [];
      precisaSalvar = true;
    }
    if (!pacote.dados.labPrefs || typeof pacote.dados.labPrefs !== 'object') {
      pacote.dados.labPrefs = {};
      precisaSalvar = true;
    }
    if (!pacote.dados.flashcards || typeof pacote.dados.flashcards !== 'object') {
      pacote.dados.flashcards = {};
      precisaSalvar = true;
    }
    if (!Array.isArray(pacote.dados.diario)) {
      pacote.dados.diario = [];
      precisaSalvar = true;
    }
    if (!pacote.dados.atividadesAbertas || typeof pacote.dados.atividadesAbertas !== 'object') {
      pacote.dados.atividadesAbertas = {};
      precisaSalvar = true;
    }

    if (integridadeViolada) {
      console.warn('[storage] Integridade violada — sinalizando.');
      const flag = { quando: hojeISO() };
      try { localStorage.setItem(FLAG_KEY, JSON.stringify(flag)); } catch (_) {}
      pacote.dados.flags.push({ tipo: 'edicao_externa', ...flag });
    }

    if (precisaSalvar) {
      try {
        const novoPacote = {
          schemaVersion: SCHEMA_VERSION,
          integridade: hashString(JSON.stringify(pacote.dados)),
          dados: pacote.dados
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(novoPacote));
      } catch (_) {}
    }

    return pacote.dados;
  },

  lerCorrompido() {
    try { return localStorage.getItem(CORROMPIDO_KEY); } catch (_) { return null; }
  },

  limparCorrompido() {
    try { localStorage.removeItem(CORROMPIDO_KEY); } catch (_) {}
  },

  salvar(dados) {
    try {
      dados.ultimoAcesso = hojeISO();
      const pacote = {
        schemaVersion: SCHEMA_VERSION,
        integridade: hashString(JSON.stringify(dados)),
        dados
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pacote));
      return true;
    } catch (e) {
      console.error('[storage] Erro ao salvar:', e);
      ultimoErroQuota = e;
      return false;
    }
  },

  inicializar(primeiroNome = '', ultimoNome = '', turma = '') {
    const dados = estadoInicial();
    dados.aluno = { primeiroNome, ultimoNome, turma };
    this.salvar(dados);
    return dados;
  },

  exportar() {
    const dados = this.carregar();
    if (!dados) return false;
    let flagIntegridade = null;
    try { flagIntegridade = JSON.parse(localStorage.getItem(FLAG_KEY) || 'null'); } catch (_) {}
    const pacote = {
      para: 'backup',
      app: 'ondulatoria',
      versao: SCHEMA_VERSION,
      exportadoEm: hojeISO(),
      avisoIntegridade: flagIntegridade,
      dados
    };
    const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ondulatoria-backup-${hojeLocal()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  },

  importar(jsonString) {
    try {
      const pacote = JSON.parse(jsonString);
      if (!pacote || !pacote.dados || pacote.versao === undefined) {
        throw new Error('Formato inválido');
      }
      this.salvar(pacote.dados);
      return pacote.dados;
    } catch (e) {
      console.error('[storage] Importação falhou:', e);
      return null;
    }
  },

  apagar() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(FLAG_KEY);
      localStorage.removeItem(CORROMPIDO_KEY);
      return true;
    } catch (e) {
      console.error('[storage] Erro ao apagar:', e);
      return false;
    }
  }
};