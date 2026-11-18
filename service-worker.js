const CACHE_NAME = 'planilha-cartao-v4';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './ui.css',
  './script.js',
  './cash-calculator.js',
  './note-composer.js',
  './notes-page.js',
  './notes-page.css',
  './images/favicon.svg',
  './images/cash-2.svg',
  './images/cash-5.svg',
  './images/cash-10.svg',
  './images/cash-20.svg',
  './images/cash-larger.svg',
  './images/cash-coins.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// Network first strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Atualiza o cache com a resposta mais recente
        return caches.open(CACHE_NAME).then(cache => {
          // Só faz cache de requisições GET e http(s)
          if (
            event.request.method === 'GET' &&
            (event.request.url.startsWith('http://') || event.request.url.startsWith('https://'))
          ) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
      .catch(() => {
        // Se falhar (offline), tenta servir do cache
        return caches.match(event.request);
      })
  );
});
