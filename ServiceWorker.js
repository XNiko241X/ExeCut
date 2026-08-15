// Service Worker - Presupuesto Rápido
// Estrategia: cache-first para assets del "app shell", con actualización en segundo plano.

const CACHE_NAME = 'turnos-peluqueria-v5';

// Recursos propios de la app (mismo origen)
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

// Recursos externos (CDN) que la app necesita para funcionar
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Los propios: si alguno falla, que falle la instalación (son esenciales)
      await cache.addAll(CORE_ASSETS);

      // Los externos: se intentan cachear pero no bloquean la instalación si fallan
      // (se usa modo 'no-cors' porque son recursos cross-origin)
      await Promise.all(
        EXTERNAL_ASSETS.map((url) =>
          fetch(new Request(url, { mode: 'no-cors' }))
            .then((res) => cache.put(url, res))
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo interceptamos GET (POST/PUT, etc. van directo a la red)
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Cache-first: servimos lo cacheado al instante
        return cached;
      }

      // Si no está en caché, vamos a la red y guardamos copia para la próxima vez
      return fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => {
          // Sin red y sin caché: si era una navegación, mostramos el index como fallback
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
