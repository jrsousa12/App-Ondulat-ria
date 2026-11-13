import { gerarParChaves } from '../crypto.js';
import { hojeLocal } from '../utils.js';
import { confirmar, informar, avisar } from '../dialogos.js';
import { $, TAMANHO_MAX_ARQUIVO, estado, baixarArquivo } from './estado.js';

export function atualizarEstadoChave() {
  const el = $('#estado-chave');
  el.innerHTML = estado.chavePublica
    ? '<span class="badge badge-ok">✓ Chave gerada nesta sessão</span>'
    : '<span class="badge badge-aviso">Nenhuma chave configurada nesta sessão</span>';
}

export function atualizarEstadoPrivada() {
  const el = $('#estado-privada');
  const btn = $('#btn-decriptar');
  if (estado.chavePrivada) {
    el.innerHTML = '<span class="badge badge-ok">✓ Chave privada carregada</span>';
    btn.disabled = false;
  } else {
    el.innerHTML = '<span class="badge badge-aviso">Chave privada não carregada</span>';
    btn.disabled = true;
  }
}

function baixarChavePrivada(b64) {
  const obj = {
    tipo: 'chave-privada-professor-ondulatoria',
    versao: 1, algoritmo: 'RSA-OAEP-2048',
    criadaEm: new Date().toISOString(),
    chavePrivadaBase64: b64,
    aviso: 'NUNCA compartilhe este arquivo.'
  };
  baixarArquivo(`chave-privada-professor-${hojeLocal()}.json`, JSON.stringify(obj, null, 2), 'application/json');
}

export function ligarChaves() {
  $('#btn-gerar').addEventListener('click', async () => {
    if (estado.chavePublica && !await confirmar({ titulo: 'Substituir a chave desta sessão?', texto: 'Relatórios cifrados com a chave antiga só abrem com a chave privada antiga.', ok: 'Gerar nova', perigo: true })) return;
    const btn = $('#btn-gerar');
    btn.disabled = true;
    btn.textContent = 'Gerando…';
    try {
      const par = await gerarParChaves();
      estado.chavePublica = par.publicaBase64;
      estado.chavePrivada = par.privadaBase64;
      $('#publica-valor').textContent = par.publicaBase64;
      $('#card-publica').hidden = false;
      $('#card-privada').hidden = false;
      baixarChavePrivada(par.privadaBase64);
      atualizarEstadoChave();
      atualizarEstadoPrivada();
      informar({ titulo: 'Chave gerada', texto: 'O download da chave privada começou. Guarde esse arquivo com muito cuidado: sem ele você não abre os relatórios.', icone: '🔑' });
    } catch (e) {
      console.error(e);
      avisar('Erro: ' + e.message, 'erro', 6000);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔑 Gerar novo par de chaves';
    }
  });

  $('#btn-baixar-privada').addEventListener('click', () => {
    if (estado.chavePrivada) baixarChavePrivada(estado.chavePrivada);
  });
  
  $('#btn-copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#publica-valor').textContent);
      const b = $('#btn-copiar');
      const o = b.textContent;
      b.textContent = '✓ Copiado';
      setTimeout(() => { b.textContent = o; }, 2000);
    } catch (_) { avisar('Não foi possível copiar. Selecione o texto e copie manualmente.', 'erro'); }
  });
  

  $('#btn-baixar-chave-publica').addEventListener('click', () => {
    if (!estado.chavePublica) return;
    const txt = `// Chave pública do professor — gerada por professor.html\nexport const CHAVE_PUBLICA_PROFESSOR = '${estado.chavePublica}';\n`;
    baixarArquivo('chave-publica.js', txt, 'text/javascript');
  });

  $('#btn-importar').addEventListener('click', () => $('#input-privada').click());
  $('#input-privada').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > TAMANHO_MAX_ARQUIVO) throw new Error('Arquivo grande demais.');
      const obj = JSON.parse(await f.text());
      if (obj.tipo !== 'chave-privada-professor-ondulatoria' || !obj.chavePrivadaBase64) {
        throw new Error('Chave inválida.');
      }
      estado.chavePrivada = obj.chavePrivadaBase64;
      atualizarEstadoPrivada();
      avisar('Chave privada importada.', 'ok');
    } catch (err) { avisar('Erro: ' + err.message, 'erro', 6000); }
    e.target.value = '';
  });
}
