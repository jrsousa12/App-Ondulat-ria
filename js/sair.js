/* Confirmação ao sair do app e janela de confirmação reutilizável. */

let saindo = false;

/**
 * Janela de confirmação acessível (usa <dialog>; cai para confirm() em navegadores antigos).
 * Resolve true para confirmar e false para cancelar (inclusive com Esc).
 */
export function confirmar({ titulo, texto, ok = 'Confirmar', cancelar = 'Cancelar', perigo = false }) {
  if (typeof HTMLDialogElement !== 'function') {
    return Promise.resolve(window.confirm(`${titulo}\n\n${texto}`));
  }
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    dlg.setAttribute('aria-labelledby', 'modal-titulo');
    dlg.setAttribute('aria-describedby', 'modal-texto');
    dlg.innerHTML = `
      <div class="modal-icone" aria-hidden="true">👋</div>
      <h2 id="modal-titulo"></h2>
      <p id="modal-texto"></p>
      <div class="modal-acoes">
        <button type="button" class="btn btn-secundario" data-r="0"></button>
        <button type="button" class="btn ${perigo ? 'btn-perigo' : ''}" data-r="1"></button>
      </div>`;
    dlg.querySelector('#modal-titulo').textContent = titulo;
    dlg.querySelector('#modal-texto').textContent = texto;
    const [bCancelar, bOk] = dlg.querySelectorAll('button');
    bCancelar.textContent = cancelar;
    bOk.textContent = ok;

    let resposta = false;
    const fechar = r => { resposta = r; dlg.close(); };
    bCancelar.addEventListener('click', () => fechar(false));
    bOk.addEventListener('click', () => fechar(true));
    dlg.addEventListener('click', e => { if (e.target === dlg) fechar(false); });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(resposta); });

    document.body.appendChild(dlg);
    dlg.showModal();
    bCancelar.focus(); // a opção segura recebe o foco
  });
}

function avisar(texto) {
  const el = document.createElement('div');
  el.className = 'aviso-quota aviso-info';
  el.setAttribute('role', 'status');
  el.textContent = texto;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

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
      perigo: true
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
