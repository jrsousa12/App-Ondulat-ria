/* Instalação como aplicativo, uso sem internet e tela cheia. */

const K_TELA_CHEIA = 'ondulatoria_tela_cheia';
let pedidoInstalacao = null;
const ouvintes = new Set();

function avisarMudanca() { ouvintes.forEach(fn => { try { fn(); } catch (_) {} }); }

export function aoMudarInstalacao(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

export function estaInstalado() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || navigator.standalone === true;
}

export function podeInstalar() { return !!pedidoInstalacao; }

export function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function instalar() {
  if (!pedidoInstalacao) return false;
  pedidoInstalacao.prompt();
  const { outcome } = await pedidoInstalacao.userChoice;
  pedidoInstalacao = null;
  avisarMudanca();
  return outcome === 'accepted';
}

export function telaCheiaSuportada() {
  return !!document.documentElement.requestFullscreen;
}

export function alternarTelaCheia() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen()?.catch?.(() => {});
  } catch (_) {}
}

export function telaCheiaAutomatica() {
  try { return localStorage.getItem(K_TELA_CHEIA) === '1'; } catch (_) { return false; }
}

export function definirTelaCheiaAutomatica(v) {
  try { localStorage.setItem(K_TELA_CHEIA, v ? '1' : '0'); } catch (_) {}
}

export function iniciarPwa() {
  // O service worker só funciona em https ou localhost (não em file://).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('[pwa] service worker não registrado:', e.message));
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    pedidoInstalacao = e;
    avisarMudanca();
  });
  window.addEventListener('appinstalled', () => { pedidoInstalacao = null; avisarMudanca(); });

  // Tela cheia automática: o navegador só permite depois de um toque do usuário.
  if (telaCheiaAutomatica() && telaCheiaSuportada() && !estaInstalado()) {
    document.addEventListener('pointerdown', () => {
      if (!document.fullscreenElement && telaCheiaAutomatica()) {
        try { document.documentElement.requestFullscreen()?.catch?.(() => {}); } catch (_) {}
      }
    }, { once: true });
  }
}
