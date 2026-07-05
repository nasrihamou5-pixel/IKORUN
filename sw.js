// IKORUN — Service Worker
// IMPORTANT : à CHAQUE déploiement, incrémente CACHE_VERSION (v5, v6, v7…)
// Sans ça, le SW considère le script comme identique et ne se met jamais à
// jour tout seul — c'est exactement ce qui causait le bug de cache persistant.
const CACHE_VERSION = 'ikorun-v5';

self.addEventListener('install', e => {
  self.skipWaiting(); // n'attend pas que tous les onglets soient fermés
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stratégie "network-first" : on essaie toujours d'aller chercher la version
// la plus fraîche sur le réseau, et on ne retombe sur le cache que hors-ligne.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.open(CACHE_VERSION).then(c => c.match(e.request)))
  );
});
