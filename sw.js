/* Service worker: guarda o app no aparelho para abrir sem internet.
   Estratégia: responde com a cópia guardada e atualiza a cópia em segundo plano,
   então uma versão nova chega na próxima vez que o app for aberto com internet. */
const CACHE = 'ondulatoria-v4';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilo.css',
  './js/abertas.js',
  './js/app.js',
  './js/audio.js',
  './js/badges.js',
  './js/chave-publica.js',
  './js/conteudo.js',
  './js/crypto.js',
  './js/desempenho.js',
  './js/dialogos.js',
  './js/diario.js',
  './js/ficha.js',
  './js/fontes.js',
  './js/fx.js',
  './js/inicio.js',
  './js/lab.js',
  './js/lab/fenomeno.js',
  './js/lab/meios.js',
  './js/lab/meu-som.js',
  './js/lab/osciloscopio.js',
  './js/lab/paleta.js',
  './js/lab/ressonancia.js',
  './js/lista-trilhas.js',
  './js/modo-professor.js',
  './js/onboarding.js',
  './js/perfil.js',
  './js/pin-professor.js',
  './js/praticar.js',
  './js/preferencias.js',
  './js/progresso.js',
  './js/pwa.js',
  './js/quiz.js',
  './js/registro.js',
  './js/relatorio.js',
  './js/sair.js',
  './js/storage.js',
  './js/storage/perfis.js',
  './js/storage/sanitizar.js',
  './js/treino.js',
  './js/trilhas.js',
  './js/ui.js',
  './js/utils.js',
  './dados/flashcards.json',
  './dados/questoes-extra.json',
  './dados/questoes-trilha-1.json',
  './dados/questoes-trilha-2.json',
  './dados/questoes-trilha-3.json',
  './dados/questoes-trilha-4.json',
  './dados/questoes-trilha-5.json',
  './dados/questoes-trilha-6.json',
  './dados/trilha-1.json',
  './dados/trilha-2.json',
  './dados/trilha-3.json',
  './dados/trilha-4.json',
  './dados/trilha-5.json',
  './dados/trilha-6.json',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png',
  './icones/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // Cada arquivo é guardado separadamente: se um falhar, os outros continuam disponíveis.
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ARQUIVOS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('ondulatoria-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const guardada = await cache.match(req, { ignoreSearch: true });
    const daRede = fetch(req).then(resp => {
      if (resp.ok && resp.type === 'basic') cache.put(req, resp.clone());
      return resp;
    }).catch(() => null);
    if (guardada) {
      e.waitUntil(daRede);
      return guardada;
    }
    const resp = await daRede;
    if (resp) return resp;
    if (req.mode === 'navigate') return cache.match('./index.html');
    return new Response('', { status: 504, statusText: 'Sem conexão' });
  }));
});
