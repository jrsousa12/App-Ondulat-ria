/* Diálogos do app: confirmação, pedido de texto e avisos rápidos (substituem alert/confirm/prompt). */

function abrirDialogo({ icone, titulo, texto, campo, ok, cancelar, perigo }) {
  if (typeof HTMLDialogElement !== 'function') {
    // Navegadores muito antigos: usa os diálogos nativos.
    if (campo) return Promise.resolve(window.prompt(`${titulo}\n\n${texto || ''}`));
    return Promise.resolve(window.confirm(`${titulo}\n\n${texto || ''}`));
  }
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    dlg.setAttribute('aria-labelledby', 'modal-titulo');
    dlg.innerHTML = `
      <form method="dialog" class="modal-form">
        ${icone ? '<div class="modal-icone" aria-hidden="true"></div>' : ''}
        <h2 id="modal-titulo"></h2>
        ${texto ? '<p id="modal-texto"></p>' : ''}
        ${campo ? '<input class="modal-campo" autocomplete="off">' : ''}
        <div class="modal-acoes${cancelar ? '' : ' modal-acoes-um'}">
          ${cancelar ? '<button type="button" class="btn btn-secundario" data-r="0"></button>' : ''}
          <button type="submit" class="btn ${perigo ? 'btn-perigo' : ''}" data-r="1"></button>
        </div>
      </form>`;
    if (icone) dlg.querySelector('.modal-icone').textContent = icone;
    dlg.querySelector('#modal-titulo').textContent = titulo;
    if (texto) {
      dlg.querySelector('#modal-texto').textContent = texto;
      dlg.setAttribute('aria-describedby', 'modal-texto');
    }
    const input = dlg.querySelector('.modal-campo');
    if (input) {
      input.type = campo.tipo || 'text';
      input.placeholder = campo.placeholder || '';
      input.setAttribute('aria-label', campo.rotulo || titulo);
      if (campo.maxlength) input.maxLength = campo.maxlength;
    }
    const bOk = dlg.querySelector('[data-r="1"]');
    const bCancelar = dlg.querySelector('[data-r="0"]');
    bOk.textContent = ok;
    if (bCancelar) bCancelar.textContent = cancelar;

    let resposta = campo ? null : false;
    dlg.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      resposta = campo ? input.value : true;
      dlg.close();
    });
    if (bCancelar) bCancelar.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg && cancelar) dlg.close(); });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(resposta); });

    document.body.appendChild(dlg);
    dlg.showModal();
    (input || bCancelar || bOk).focus(); // a opção segura recebe o foco
  });
}

/** Pergunta sim/não. Resolve true para confirmar e false para cancelar (inclusive Esc). */
export function confirmar({ titulo, texto = '', ok = 'Confirmar', cancelar = 'Cancelar', perigo = false, icone = '' }) {
  return abrirDialogo({ titulo, texto, ok, cancelar, perigo, icone });
}

/** Mensagem com um único botão (substitui alert). */
export function informar({ titulo, texto = '', ok = 'Entendi', icone = '' }) {
  return abrirDialogo({ titulo, texto, ok, cancelar: null, icone });
}

/** Pede um texto. Resolve com o texto digitado ou null se cancelar. */
export function pedirTexto({ titulo, texto = '', tipo = 'text', placeholder = '', ok = 'OK', cancelar = 'Cancelar', icone = '', maxlength = 0 }) {
  return abrirDialogo({ titulo, texto, ok, cancelar, icone, campo: { tipo, placeholder, maxlength } });
}

function containerAvisos() {
  let c = document.getElementById('avisos');
  if (!c) {
    c = document.createElement('div');
    c.id = 'avisos';
    c.setAttribute('aria-live', 'polite');
    document.body.appendChild(c);
  }
  return c;
}

/** Aviso rápido que some sozinho. tipo: 'info' | 'ok' | 'erro'. */
export function avisar(texto, tipo = 'info', ms = 4000) {
  const el = document.createElement('div');
  el.className = `aviso aviso-${tipo}`;
  el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  el.textContent = texto;
  containerAvisos().appendChild(el);
  setTimeout(() => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/** Cartão de conquista (ou outro destaque) que entra pelo canto e some sozinho. */
export function avisarDestaque({ emoji, titulo, texto }, ms = 4500) {
  const el = document.createElement('div');
  el.className = 'aviso aviso-destaque';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span class="aviso-emoji" aria-hidden="true"></span><div><strong></strong><small></small></div>';
  el.querySelector('.aviso-emoji').textContent = emoji;
  el.querySelector('strong').textContent = titulo;
  el.querySelector('small').textContent = texto;
  containerAvisos().appendChild(el);
  setTimeout(() => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 300);
  }, ms);
}
