const VERSION = '1.1.0';
const CACHE_PREFIX = 'balanceos-';
const CACHE_NAME = `${CACHE_PREFIX}shell-${VERSION}`;
const SHELL = ['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./data/balance_templates.json','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    const cachePromise = caches.open(CACHE_NAME);
    const networkPromise = fetch(request).then(response => {
      if (response && response.ok) return cachePromise.then(cache => cache.put('./index.html', response.clone()).then(() => response));
      return response;
    }).catch(() => null);
    event.waitUntil(networkPromise.then(() => undefined));
    event.respondWith(networkPromise.then(async response => {
      if (response) return response;
      const cache = await cachePromise;
      return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
    }));
    return;
  }

  const cachePromise = caches.open(CACHE_NAME);
  const cachedPromise = cachePromise.then(cache => cache.match(request));
  const networkPromise = fetch(request).then(response => {
    if (response && response.ok) return cachePromise.then(cache => cache.put(request, response.clone()).then(() => response));
    return response;
  }).catch(() => null);
  event.waitUntil(networkPromise.then(() => undefined));
  event.respondWith(cachedPromise.then(async cached => cached || (await networkPromise) || (await (await cachePromise).match('./index.html')) || Response.error()));
});
