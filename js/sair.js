import { confirmar, avisar } from './dialogos.js';

/* Confirmação ao sair do app. */

let saindo = false;

/**
 * Evita a saída acidental:
 * - botão/gesto "voltar" na primeira tela: mostra a janela "Deseja sair?" (Sair / Cancelar);
 * - fechar ou recarregar a aba: o navegador mostra o aviso padrão dele.
 */
export function instalarGuardaSaida() {
  history.replaceState({ ondaBase: true }, '');
  history.pushState({ ondaGuarda: true }, '');

  window.addEventListener('popstate', async e => {
    if (!e.state || !e.state.ondaBase || saindo) return;
    const sair = await confirmar({
      titulo: 'Deseja sair do app?',
      texto: 'Seu progresso já está salvo neste aparelho. Você pode voltar quando quiser.',
      ok: 'Sair',
      cancelar: 'Cancelar',
      perigo: true,
      icone: '👋'
    });
    if (!sair) {
      history.pushState({ ondaGuarda: true }, '');
      return;
    }
    saindo = true;
    history.back();
    // Se não havia página anterior (app instalado ou aba nova), o "voltar" não sai.
    setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      saindo = false;
      window.close();
      history.pushState({ ondaGuarda: true }, '');
      avisar('Para sair, feche esta aba ou o aplicativo.');
    }, 500);
  });

  window.addEventListener('beforeunload', e => {
    if (saindo) return;
    e.preventDefault();
    e.returnValue = '';
  });
}
