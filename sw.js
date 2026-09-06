// Service worker IKORUN — fichier statique (remplace l'ancienne version enregistrée
// via blob URL, qui empêchait le navigateur de détecter correctement les mises à jour).
// Stratégie : network-first (toujours essayer le réseau en premier, no-store pour éviter
// le cache HTTP du navigateur), avec repli sur le cache uniquement hors-ligne.
// v7 : purge forcée. Tant que manifest.json n'existait pas, l'hébergeur renvoyait
// index.html (du HTML) à sa place, et ce SW a pu mettre cette mauvaise réponse en
// cache. Changer le nom du cache supprime les anciennes entrées à l'activation, ce
// qui garantit que le vrai manifest.json est bien récupéré — condition nécessaire
// pour que le navigateur propose l'installation de l'app.
const C = 'ikorun-v33';

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
  // IMPORTANT : on ne gère que les requêtes vers notre propre site.
  // Les ressources externes (Google Fonts, CDN jsdelivr, etc.) sont laissées
  // au navigateur, qui les charge normalement sans passer par ce service worker.
  // Avant ce correctif, le fetch() ci-dessous s'appliquait à TOUT, y compris
  // ces domaines externes — et se faisait bloquer par la CSP (connect-src),
  // cassant silencieusement le chargement des polices et du script Supabase.
  if (new URL(e.request.url).origin !== location.origin) return;
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

// Notifications push envoyées par l'Edge Function Supabase send-prayer-notifs
// (voir app.js, subscribeToPush) — seule notification de l'app à passer par un
// vrai serveur, puisque les horaires de prière sont une donnée publique alors
// que le reste (séances, rappels d'entraînement) reste programmé localement,
// le plan d'entraînement étant chiffré côté client.
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  const title = data.title || 'IKORUN';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag || 'ikorun-push',
    renotify: true,
    icon: 'icon-192.png',
    badge: 'icon-192.png'
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
