/* Service worker for THE QUIET COLLAPSE. Generated values are injected at build time. */
const CACHE_NAME = __CACHE_NAME__;
const PRECACHE = __PRECACHE__;
const INDEX = './index.html';

self.addEventListener('install', (event) => {
  // Precache only. Activation waits for the player to accept the update (SKIP_WAITING message),
  // except on the very first install where no controller exists yet.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.registration.active ? undefined : self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isNavigation(request) {
  return request.mode === 'navigate';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: isNavigation(request) }).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => (isNavigation(request) ? caches.match(INDEX) : Response.error()));
    }),
  );
});
