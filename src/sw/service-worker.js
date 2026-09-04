/* Service worker for THE QUIET COLLAPSE. Generated values are injected at build time. */
const CACHE_NAME = __CACHE_NAME__;
const PRECACHE = __PRECACHE__;
const INDEX = './index.html';
const FRESH_PARAM = 'fresh';

self.addEventListener('install', (event) => {
  // Precache the full hashed asset list. Activation waits for the player to accept the update
  // (SKIP_WAITING message), except on the very first install where no controller exists yet.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => (self.registration.active ? undefined : self.skipWaiting())),
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
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', cacheName: CACHE_NAME, precached: PRECACHE.length });
});

function isNavigation(request) {
  return request.mode === 'navigate';
}

/** Network-first shell: a fresh index.html when online, the cached one when offline. */
function shellResponse(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(INDEX, copy)).catch(() => undefined);
      }
      return response;
    })
    .catch(() => caches.match(INDEX));
}

/** `?fresh=1` bypasses every cache and wipes them; the page then reloads without the parameter. */
function freshResponse(request) {
  return caches
    .keys()
    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    .then(() => self.registration.unregister())
    .then(() => fetch(request, { cache: 'reload' }));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNavigation(request)) {
    if (url.searchParams.get(FRESH_PARAM) === '1') {
      event.respondWith(freshResponse(request));
      return;
    }
    event.respondWith(shellResponse(request));
    return;
  }
  // Cache-first for hashed assets; anything else falls through to the network with a cache backstop.
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request).catch(() => Response.error())),
  );
});
