const CACHE = 'bl-studio-v2';
const STATIC = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Ne jamais intercepter les appels API externes
  if (e.request.url.includes('googleapis.com')) return;
  if (e.request.url.includes('googleusercontent.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Ne cacher que les ressources du même origin et les réponses valides
        if (
          res.ok &&
          res.status === 200 &&
          res.type !== 'opaque' &&
          e.request.url.startsWith(self.location.origin)
        ) {
          const resClone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, resClone));
        }
        return res;
      }).catch(() => {
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
