// Service worker IKORUN — fichier statique (remplace l'ancienne version enregistrée
// via blob URL, qui empêchait le navigateur de détecter correctement les mises à jour).
// Stratégie : network-first (toujours essayer le réseau en premier, no-store pour éviter
// le cache HTTP du navigateur), avec repli sur le cache uniquement hors-ligne.
const C = 'ikorun-v5';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        try {
          const copy = res.clone();
          caches.open(C).then(c => c.put(e.request, copy));
        } catch (x) {}
        return res;
      })
      .catch(() => caches.open(C).then(c => c.match(e.request)))
  );
});
