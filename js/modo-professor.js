import { PIN_PROFESSOR } from './pin-professor.js';
import { arrayBufferToBase64, base64ToArrayBuffer } from './crypto.js';

const CHAVE = 'ondulatoria_prof';
const TENTATIVAS_KEY = 'ondulatoria_prof_tentativas';
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 5 * 60 * 1000;

export function estaEmModoProfessor() {
  try { return sessionStorage.getItem(CHAVE) === '1'; } catch (_) { return false; }
}

export function ativarModoProfessor() {
  try { sessionStorage.setItem(CHAVE, '1'); } catch (_) {}
}

export function desativarModoProfessor() {
  try { sessionStorage.removeItem(CHAVE); } catch (_) {}
}

/** Deriva o hash PBKDF2-SHA256 de um PIN (usado também por professor.html para gerar um PIN novo). */
export async function hashPin(pin, salBase64, iteracoes) {
  if (!globalThis.crypto?.subtle) throw new Error('Abra o app por http(s) para usar o modo professor.');
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToArrayBuffer(salBase64), iterations: iteracoes },
    base, 256
  );
  return arrayBufferToBase64(bits);
}

function lerTentativas() {
  try { return JSON.parse(localStorage.getItem(TENTATIVAS_KEY) || 'null') || { n: 0, ate: 0 }; } catch (_) { return { n: 0, ate: 0 }; }
}
function gravarTentativas(t) {
  try { localStorage.setItem(TENTATIVAS_KEY, JSON.stringify(t)); } catch (_) {}
}

/**
 * Confere o PIN. Depois de 5 erros seguidos, bloqueia novas tentativas por 5 minutos.
 * Retorna { ok: true } ou { ok: false, motivo }.
 */
export async function verificarPin(pin) {
  const t = lerTentativas();
  if (t.ate > Date.now()) {
    const min = Math.ceil((t.ate - Date.now()) / 60000);
    return { ok: false, motivo: `Muitas tentativas. Tente de novo em ${min} min.` };
  }
  const calculado = await hashPin(String(pin), PIN_PROFESSOR.sal, PIN_PROFESSOR.iteracoes);
  if (calculado === PIN_PROFESSOR.hash) {
    gravarTentativas({ n: 0, ate: 0 });
    return { ok: true };
  }
  const n = t.n + 1;
  gravarTentativas(n >= MAX_TENTATIVAS ? { n: 0, ate: Date.now() + BLOQUEIO_MS } : { n, ate: 0 });
  return { ok: false, motivo: 'PIN incorreto.' };
}
