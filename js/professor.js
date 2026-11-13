/* Página do professor: liga os módulos e cuida da decriptação e do PIN. */
import { descriptografarRelatorio, arrayBufferToBase64 } from './crypto.js';
import { hojeLocal } from './utils.js';
import { hashPin } from './modo-professor.js';
import { avisar } from './dialogos.js';
import { $, TAMANHO_MAX_ARQUIVO, estado, baixarArquivo } from './professor/estado.js';
import { ligarChaves, atualizarEstadoChave, atualizarEstadoPrivada } from './professor/chaves.js';
import { renderizarResultados } from './professor/resultados.js';
import { ligarExportar } from './professor/exportar.js';

// Versões antigas guardavam a chave privada no sessionStorage: apagamos.
try { sessionStorage.removeItem('ondulatoria_prof_priv'); } catch (_) {}

// O aviso de file:// é gerenciado por file-check.js (script clássico externo).
// Este módulo só roda em http:// ou https://. Em file://, o navegador bloqueia
// módulos ES por CORS e o main é escondido pelo file-check.js.

$('#btn-decriptar').addEventListener('click', () => $('#input-relatorios').click());

$('#input-relatorios').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length) return;
  const btn = $('#btn-decriptar');
  btn.disabled = true;
  btn.textContent = `Decifrando ${files.length} arquivo(s)…`;
  try {
    for (const f of files) {
      try {
        if (f.size > TAMANHO_MAX_ARQUIVO) throw new Error('arquivo grande demais');
        const pacote = JSON.parse(await f.text());
        if (pacote.para !== 'professor' || !pacote.chaveCifrada || !pacote.dadosCifrados) {
          estado.relatorios.push({ arquivo: f.name, erro: 'Formato inválido.' });
          continue;
        }
        const r = await descriptografarRelatorio(pacote, estado.chavePrivada);
        estado.relatorios.push({ arquivo: f.name, ...r });
      } catch (err) {
        estado.relatorios.push({ arquivo: f.name, erro: 'Falha ao decifrar: ' + err.message });
      }
    }
    renderizarResultados();
    $('#card-resultados').hidden = false;
    try { document.getElementById('card-resultados').scrollIntoView({ behavior: 'smooth' }); } catch (_) {}
  } finally {
    btn.disabled = false;
    btn.textContent = '🔓 Selecionar e decifrar relatórios';
  }
});

$('#form-pin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = $('#pin-novo').value;
  if (pin.length < 6) { avisar('Use pelo menos 6 caracteres.', 'erro'); return; }
  if (pin !== $('#pin-conf').value) { avisar('Os dois PINs não são iguais.', 'erro'); return; }
  const sal = arrayBufferToBase64(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const iteracoes = 200000;
  const hash = await hashPin(pin, sal, iteracoes);
  const js = `// PIN do modo professor, guardado só como hash (PBKDF2-SHA256 com sal).\n` +
    `// Gerado por professor.html em ${hojeLocal()}.\n` +
    `export const PIN_PROFESSOR = {\n  sal: '${sal}',\n  iteracoes: ${iteracoes},\n  hash: '${hash}'\n};\n`;
  baixarArquivo('pin-professor.js', js, 'text/javascript');
  e.target.reset();
  avisar('Arquivo pin-professor.js baixado. Substitua o arquivo em js/ no repositório.', 'ok', 6000);
});

ligarChaves();
ligarExportar();
atualizarEstadoChave();
atualizarEstadoPrivada();
