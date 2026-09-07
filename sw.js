// Service worker IKORUN — fichier statique (remplace l'ancienne version enregistrée
// via blob URL, qui empêchait le navigateur de détecter correctement les mises à jour).
// Stratégie : network-first (toujours essayer le réseau en premier, no-store pour éviter
// le cache HTTP du navigateur), avec repli sur le cache uniquement hors-ligne.
// v7 : purge forcée. Tant que manifest.json n'existait pas, l'hébergeur renvoyait
// index.html (du HTML) à sa place, et ce SW a pu mettre cette mauvaise réponse en
// cache. Changer le nom du cache supprime les anciennes entrées à l'activation, ce
// qui garantit que le vrai manifest.json est bien récupéré — condition nécessaire
// pour que le navigateur propose l'installation de l'app.
const C = 'ikorun-v39';

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
        // fetch() RÉSOUT sur un 404/500/502 (il ne rejette que sur erreur réseau).
        // Sans ce test, une page d'erreur transitoire du CDN était mise en cache
        // puis resservie hors-ligne : l'utilisateur restait bloqué dessus jusqu'à
        // un rechargement en ligne. On ne met donc en cache que les vraies réponses.
        if (res && res.ok) {
          try {
            const copy = res.clone();
            caches.open(C).then(c => c.put(e.request, copy));
          } catch (x) {}
        }
        return res;
      })
      .catch(() => caches.open(C).then(c => c.match(e.request)))
  );
});

// Notifications push envoyées par les Edge Functions Supabase send-prayer-notifs
// et send-daily-reminders (voir app.js, subscribeToPush) : les seules à passer par
// un vrai serveur, puisqu'elles ne portent que des données publiques ou volontairement
// extraites du chiffrement (titre de séance + statut, jamais le détail) — voir
// syncDailyReminderState. Le reste (activité en cours) est affiché localement par la
// page elle-même via reg.showNotification (cf. startBgActivity dans app.js), pas ici.
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

// Gère aussi bien un tap simple (ouvrir/focus l'app) que les boutons d'action de la
// notification "activité en cours" (pause/annuler/arrêter) : ces actions ne peuvent être
// exécutées que par la page elle-même (LIVE/chrono/timer ne vivent qu'en mémoire côté page),
// le Service Worker se contente donc de relayer l'action via postMessage. On ne ferme PAS
// la notification sur un tap simple (juste focus/ouverture) : ça reste une activité en
// cours tant qu'aucune action de fin (pause/annuler/arrêter) n'a été explicitement tapée.
self.addEventListener('notificationclick', e => {
  const tag = e.notification.tag;
  const action = e.action;
  if (tag === 'ikorun-activity' && action) {
    e.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        list.forEach(c => c.postMessage({ type: 'bgActivityAction', action }));
        for (const c of list) { if ('focus' in c) return c.focus(); }
        if (clients.openWindow) return clients.openWindow('/');
      })
    );
    return;
  }
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
