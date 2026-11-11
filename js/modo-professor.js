const CHAVE = 'ondulatoria_prof';

export function estaEmModoProfessor() {
  try { return sessionStorage.getItem(CHAVE) === '1'; } catch (_) { return false; }
}

export function ativarModoProfessor() {
  try { sessionStorage.setItem(CHAVE, '1'); } catch (_) {}
}

export function desativarModoProfessor() {
  try { sessionStorage.removeItem(CHAVE); } catch (_) {}
}
