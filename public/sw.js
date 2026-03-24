// Version auto-incrémentée à chaque déploiement Vercel via la variable d'env
const CACHE = 'bl-studio-' + (self.registration?.scope || Date.now());

self.addEventListener('install', () => {
  // Prend le contrôle immédiatement sans attendre
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Supprime TOUS les anciens caches au démarrage
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// On ne cache RIEN — pas besoin pour une app Vercel toujours en ligne
// Le SW sert juste pour le manifest PWA (installable)
self.addEventListener('fetch', e => {
  // Laisse passer toutes les requêtes normalement
  return;
});
