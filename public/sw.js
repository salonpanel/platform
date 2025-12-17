// Service Worker para caché de assets estáticos
// Mejora la velocidad de carga y permite funcionamiento offline parcial

const CACHE_NAME = 'panel-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/panel',
  '/panel/agenda',
  '/panel/clientes',
  '/panel/servicios',
  '/panel/staff',
];

// Install: cachear assets críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: limpiar cachés viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: estrategia Network First con fallback a caché
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignorar requests a APIs externas
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clonar la respuesta antes de cachearla
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // Si falla el network, intentar desde caché
        return caches.match(event.request).then((response) => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});
