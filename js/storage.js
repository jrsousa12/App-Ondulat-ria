import { hojeISO, hojeLocal } from './utils.js';
import { perfis, kDados, kFlag, kCorrompido } from './storage/perfis.js';
import { SCHEMA_VERSION, gerarNonce, semNulos, sanitizarDados } from './storage/sanitizar.js';

export { perfis, sanitizarDados };

const TAMANHO_MAX_IMPORTACAO = 2 * 1024 * 1024;

function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
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
    atividadesAbertas: {},
    questoes: {},
    historico: [],
    cadernoErros: {},
    treino: {}
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
      raw = localStorage.getItem(kDados());
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
        if (!localStorage.getItem(kCorrompido())) {
          localStorage.setItem(kCorrompido(), raw);
        }
      } catch (_) {}
      return null;
    }

    if (!pacote || typeof pacote !== 'object' || !pacote.dados || typeof pacote.dados !== 'object') {
      console.warn('[storage] Formato inválido — preservando em backup.');
      try {
        if (!localStorage.getItem(kCorrompido())) {
          localStorage.setItem(kCorrompido(), raw);
        }
      } catch (_) {}
      return null;
    }

    const hashEsperado = hashString(JSON.stringify(pacote.dados));
    const integridadeViolada = pacote.integridade !== hashEsperado;

    let precisaSalvar = integridadeViolada;

    const limpos = sanitizarDados(pacote.dados);
    if (JSON.stringify(limpos) !== JSON.stringify(pacote.dados)) precisaSalvar = true;
    pacote.dados = limpos;

    if (integridadeViolada) {
      console.warn('[storage] Integridade violada — sinalizando.');
      const flag = { quando: hojeISO() };
      try { localStorage.setItem(kFlag(), JSON.stringify(flag)); } catch (_) {}
      pacote.dados.flags.push({ tipo: 'edicao_externa', ...flag });
    }

    if (precisaSalvar) {
      try {
        const novoPacote = {
          schemaVersion: SCHEMA_VERSION,
          integridade: hashString(JSON.stringify(pacote.dados)),
          dados: pacote.dados
        };
        localStorage.setItem(kDados(), JSON.stringify(novoPacote));
      } catch (_) {}
    }

    return pacote.dados;
  },

  lerCorrompido() {
    try { return localStorage.getItem(kCorrompido()); } catch (_) { return null; }
  },

  limparCorrompido() {
    try { localStorage.removeItem(kCorrompido()); } catch (_) {}
  },

  salvar(dados) {
    try {
      dados.ultimoAcesso = hojeISO();
      const pacote = {
        schemaVersion: SCHEMA_VERSION,
        integridade: hashString(JSON.stringify(dados)),
        dados
      };
      localStorage.setItem(kDados(), JSON.stringify(pacote));
      perfis.atualizarAtual(dados.aluno || {});
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
    try { flagIntegridade = JSON.parse(localStorage.getItem(kFlag()) || 'null'); } catch (_) {}
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

  /** Importa um backup gerado por exportar(). Retorna os dados validados ou null. */
  importar(jsonString, nonceAtual = null) {
    try {
      if (typeof jsonString !== 'string' || jsonString.length > TAMANHO_MAX_IMPORTACAO) {
        throw new Error('Arquivo grande demais');
      }
      const pacote = JSON.parse(jsonString);
      if (!pacote || pacote.app !== 'ondulatoria' || pacote.para !== 'backup' ||
          !pacote.dados || typeof pacote.dados !== 'object') {
        throw new Error('Não é um backup do Ondulatória');
      }
      const dados = sanitizarDados(pacote.dados);
      if (!dados.aluno.primeiroNome) throw new Error('Backup sem nome do aluno');
      // A importação fica registrada (vai no relatório do professor).
      dados.flags.push(semNulos({
        tipo: 'importacao_backup',
        quando: hojeISO(),
        origem: nonceAtual && nonceAtual !== dados.nonceDispositivo ? dados.nonceDispositivo : null
      }));
      if (!this.salvar(dados)) return null;
      return dados;
    } catch (e) {
      console.warn('[storage] Importação recusada:', e.message);
      return null;
    }
  },

  apagar() {
    try {
      localStorage.removeItem(kDados());
      localStorage.removeItem(kFlag());
      localStorage.removeItem(kCorrompido());
      return true;
    } catch (e) {
      console.error('[storage] Erro ao apagar:', e);
      return false;
    }
  }
};
