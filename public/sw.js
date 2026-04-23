// ============================================================================
// BookFast Pro — Service Worker
// Strategy: Network-first for HTML pages; Cache-first for static assets;
//            Never cache API routes (auth tokens, booking data, etc.).
// ============================================================================

const CACHE_VERSION = 'v3';
const STATIC_CACHE  = `bookfast-static-${CACHE_VERSION}`;
const PAGE_CACHE    = `bookfast-pages-${CACHE_VERSION}`;

// Static assets to pre-cache on install (branding + PWA: repetición instantánea al abrir desde home)
const PRECACHE_URLS = [
  '/favicon.ico',
  '/favicon.png',
  '/icon.png',
  '/manifest.json',
  '/bookfast-mark.svg',
  '/bookfast-logo.png',
  '/bookfast-mark-192.png',
];

// ── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Pre-cache static assets (ignore failures so install never blocks)
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => null))
      );
    })
  );
  // Activate immediately — don't wait for existing tabs to close
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const VALID_CACHES = [STATIC_CACHE, PAGE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !VALID_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // ✖ Never cache API routes — they carry auth tokens and live data
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // ✖ Never cache Next.js internals
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // ✔ Static assets (images, icons, fonts) — Cache-first
  const isStaticAsset = /\.(png|jpg|jpeg|svg|ico|webp|woff2?|ttf|otf|eot)$/i.test(url.pathname);
  if (isStaticAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      })
    );
    return;
  }

  // ✔ Navigation / HTML pages — Network-first with page cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Offline fallback: redirect to /panel if we have it cached
          const panel = await caches.match('/panel');
          return panel || new Response('Offline - Comprueba tu conexión', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'BookFast Pro', body: 'Tienes una nueva notificación', icon: '/icon.png' };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch (_) {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon.png',
      badge: '/favicon.png',
      tag: data.tag || 'bookfast-notification',
      requireInteraction: false,
      data: { url: data.url || '/panel/agenda' },
    })
  );
});

// Open the relevant page when notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/panel/agenda';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes('/panel'));
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
      } else {
        self.clients.openWindow(targetUrl);
      }
    })
  );
});
