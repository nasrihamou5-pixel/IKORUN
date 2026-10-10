// Service worker IKORUN — fichier statique.
// ============================================================================
// HORS LIGNE COMPLET (27/09, v105 : « la PWA doit marcher sans connexion »).
//
// Trois caches, chacun avec son rôle :
//   · C      (ikorun-vNN)       la coquille VERSIONNÉE : index.html, manifest,
//                                scripts (app.js?v=N, vendor/*). Remplacé à chaque
//                                nouvelle version (changer C purge l'ancien).
//   · STATIC (ikorun-static-vN) images et polices. GARDÉ d'une version à l'autre :
//                                avant, chaque mise à jour purgeait tout et les 21
//                                badges étaient retéléchargés. /!\ Changer une image
//                                sans changer son nom → monter STATIC.
//   · EXT    (ikorun-ext-v1)    démos d'exercices (raw.githubusercontent.com) déjà
//                                vues, gardées pour la salle sans réseau (250 max).
//
// Ce qui ne marchait pas hors ligne avant ce correctif :
//   1. app.js n'était pas préchargé. Pire : index.html est mis à jour en fond, si
//      bien que la copie en cache pouvait pointer vers un app.js?v=N+1 jamais
//      téléchargé — au lancement suivant sans réseau, l'app ne démarrait plus.
//      Désormais une page n'entre en cache qu'APRÈS les scripts qu'elle charge.
//   2. La page était cherchée avec son adresse exacte : /?open=sport (notification),
//      /?code=… (retour Google), /index.html… n'étaient jamais en cache. Toute
//      navigation sert maintenant LA page de l'app (une seule, c'est une SPA).
//   3. Badges et démos d'exercices vus pour la première fois hors ligne : cassés.
//      Les badges sont préchargés ; les démos, gardées après leur 1re vue.
//   4. Rien en cache du tout (tout premier lancement sans réseau) : écran d'erreur
//      du navigateur. On affiche maintenant une page « hors ligne » propre.
//
// Rappels de l'historique (toujours valables) : cache d'abord + mise à jour en fond
// pour la page (25/09 : plus d'écran noir à attendre le réseau, message 'ik-maj'
// quand une nouvelle version est prête) ; cache-first pour tout ce qui est versionné
// ou immuable (app.js n'est plus retéléchargé à chaque ouverture) ; chaque fichier
// est ajouté séparément (un seul fichier manquant ne fait pas échouer l'installation).
// ============================================================================
const C = 'ikorun-v114';
const STATIC = 'ikorun-static-v1';
const EXT = 'ikorun-ext-v1';
const EXT_MAX = 250;
const INDEX = './';

const IMMUABLE = /\.(png|jpe?g|webp|svg|gif|woff2?|ttf|ico|mp3|wav)$/i;

// Coquille : la page et ses scripts (app.js est ajouté d'après la page elle-même,
// voir cacherLaPage — pas de numéro de version à recopier ici à chaque livraison).
const SHELL = [INDEX, 'manifest.json'];
const STATIC_ASSETS = [
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png', 'favicon-16.png',
  'fonts/unbounded-latin.woff2', 'fonts/unbounded-latin-ext.woff2',
  'fonts/inter-latin.woff2', 'fonts/inter-latin-ext.woff2',
  'fonts/jetbrains-mono-latin.woff2', 'fonts/jetbrains-mono-latin-ext.woff2',
  'badges/ach_allure.png', 'badges/ach_cinqk.png', 'badges/ach_denivele.png', 'badges/ach_dixk.png',
  'badges/ach_endurance.png', 'badges/ach_force.png', 'badges/ach_nouveaupb.png', 'badges/ach_objectif.png',
  'badges/ach_podium.png', 'badges/ach_premiere.png', 'badges/ach_puissance.png', 'badges/ach_serie.png',
  'badges/ach_vo2max.png', 'badges/rank_amateur.png', 'badges/rank_athlete.png', 'badges/rank_debutant.png',
  'badges/rank_elite.png', 'badges/rank_expert.png', 'badges/rank_legende.png', 'badges/rank_maitre.png',
  'badges/rank_sportif.png'
];

// Scripts chargés par la page : 'vendor/supabase.js?v=1', 'app.js?v=104'… (le préchargement
// <link rel=preload> et la liste SCRIPTS du bas d'index.html). tests/smoke.js n'en fait pas partie.
// …et sa feuille de style app.css?v=N (sortie d'index.html le 28/09).
const SCRIPTS_DE_LA_PAGE = /['"]((?:vendor\/)?[\w.-]+\.(?:js|css)\?v=\d+)['"]/g;

// Une réponse issue d'une redirection (/index.html → /) ne peut pas resservir une
// navigation telle quelle (Safari refuse) : on en fait une copie propre.
function propre(res) {
  if (!res.redirected) return Promise.resolve(res);
  return res.blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }));
}

// Met la page en cache SEULEMENT si ses scripts y sont aussi : sinon on garde l'ancienne
// paire page + scripts, qui fonctionne. Retourne true si la page a été enregistrée.
function cacherLaPage(cache, res) {
  return res.clone().text().then(html => {
    const urls = [...new Set([...html.matchAll(SCRIPTS_DE_LA_PAGE)].map(m => m[1]))];
    return Promise.all(urls.map(u => cache.match(u).then(hit => hit || fetch(u, { cache: 'no-cache' }).then(r => {
      if (!r || !r.ok) throw new Error('script indisponible : ' + u);
      return cache.put(u, r);
    })))).then(() => propre(res)).then(r => cache.put(INDEX, r)).then(() => true);
  }).catch(() => false);
}

const PAGE_HORS_LIGNE = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0A0D12"><title>IKORUN — hors ligne</title><style>html,body{margin:0;height:100%;background:#07090D;color:#F4F6F9;font:16px/1.5 system-ui,-apple-system,sans-serif}main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box}h1{font-size:22px;margin:0 0 10px}p{color:#97A0B2;max-width:320px;margin:0 0 22px}button{font:600 15px system-ui,-apple-system,sans-serif;color:#fff;background:linear-gradient(180deg,#3775F2,#2152CC);border:0;border-radius:14px;padding:13px 26px}</style></head><body><main><h1>Pas de connexion</h1><p>IKORUN doit être ouverte une première fois avec Internet. Ensuite, elle fonctionne entièrement hors ligne.</p><button onclick="location.reload()">Réessayer</button></main></body></html>';

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    // Coquille : la page (réseau, sans cache HTTP) puis les scripts qu'elle charge.
    caches.open(C).then(c =>
      fetch(INDEX, { cache: 'no-store' }).then(res => res && res.ok ? cacherLaPage(c, res) : false).catch(() => false)
        .then(() => Promise.all(SHELL.slice(1).map(u => c.add(u).catch(() => {}))))
    ),
    // Images et polices : seulement celles qui manquent (le cache est conservé entre versions).
    caches.open(STATIC).then(s => Promise.all(STATIC_ASSETS.map(u => s.match(u).then(hit => hit || s.add(u)).catch(() => {}))))
  ]).catch(() => {}).then(() =>
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => list.forEach(cl => cl.postMessage({ type: 'ik-offline-ready' }))).catch(() => {})
  ));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  const garder = [C, STATIC, EXT];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !garder.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(nomCache, req, opts) {
  return caches.open(nomCache).then(c => c.match(req).then(hit => {
    if (hit) return hit;
    return fetch(opts && opts.url ? opts.url : req, opts && opts.init).then(res => {
      if (res && res.ok) {
        const copie = res.clone();
        c.put(req, copie).then(() => opts && opts.max ? rogner(c, opts.max) : null).catch(() => {});
      }
      return res;
    });
  })).catch(() => fetch(req));
}
// Garde les N entrées les plus récentes (keys() rend l'ordre d'insertion).
function rogner(cache, max) {
  return cache.keys().then(keys => Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map(k => cache.delete(k))));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Démos d'exercices (images de raw.githubusercontent.com) : gardées après la 1re vue.
  // Requête CORS (le serveur répond Access-Control-Allow-Origin: *) : une réponse
  // « opaque » pèserait ~7 Mo de quota chacune dans Chrome, une réponse CORS son vrai poids.
  if (url.hostname === 'raw.githubusercontent.com' && req.destination === 'image') {
    e.respondWith(cacheFirst(EXT, req, { url: req.url, init: { mode: 'cors', credentials: 'omit' }, max: EXT_MAX }));
    return;
  }
  // Tout autre domaine externe (Supabase, Google…) : laissé au navigateur. Le fetch()
  // d'un SW est soumis à SA CSP (connect-src) — c'est ce qui cassait tout avant.
  if (url.origin !== location.origin) return;

  // PAGE — toute navigation sert LA page de l'app, quelle que soit l'adresse.
  // Cache d'abord (démarrage instantané, hors ligne compris), mise à jour en fond.
  if (req.mode === 'navigate') {
    const maj = fetch(req, { cache: 'no-store' }).then(res => {
      // fetch() RÉSOUT sur un 404/500 : une page d'erreur du CDN ne remplace jamais la bonne copie.
      if (!res || !res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return res;
      // Deux copies : le corps d'une réponse ne se lit qu'une fois, et `res` part à la page.
      const pourCache = res.clone(), pourComparer = res.clone();
      return caches.open(C).then(c => c.match(INDEX).then(ancien => {
        const avant = ancien ? ancien.text().catch(() => '') : Promise.resolve(null);
        return Promise.all([avant, pourComparer.text()]).then(([x, y]) =>
          cacherLaPage(c, pourCache).then(ok => { if (ok && x !== null && x !== y) prevenirMaj(e); })
        );
      })).catch(() => {}).then(() => res);
    });
    e.respondWith(
      caches.open(C).then(c => c.match(INDEX)).catch(() => undefined)
        .then(hit => hit || maj.then(res => (res && res.ok) ? propre(res) : (res || Response.error()))
          .catch(() => new Response(PAGE_HORS_LIGNE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
    );
    e.waitUntil(maj.catch(() => {}));
    return;
  }

  // Images et polices : cache STATIC, gardé entre les versions.
  if (IMMUABLE.test(url.pathname)) { e.respondWith(cacheFirst(STATIC, req)); return; }
  // Scripts versionnés (?v=N) : cache de la version.
  if (url.searchParams.has('v')) { e.respondWith(cacheFirst(C, req)); return; }

  // Reste (manifest.json…) : cache d'abord, mise à jour en fond.
  const maj = fetch(req, { cache: 'no-store' }).then(res => {
    if (res && res.ok) { const copie = res.clone(); caches.open(C).then(c => c.put(req, copie)).catch(() => {}); }
    return res;
  });
  e.respondWith(
    caches.open(C).then(c => c.match(req)).catch(() => undefined)
      .then(hit => hit || maj.catch(() => Response.error()))
  );
  e.waitUntil(maj.catch(() => {}));
});
// Prévient la page qui vient de s'ouvrir (ou, à défaut, toutes les fenêtres) qu'une
// nouvelle version vient d'être téléchargée.
function prevenirMaj(e) {
  const id = e.resultingClientId || e.clientId;
  const cibles = id
    ? self.clients.get(id).then(cl => cl ? [cl] : self.clients.matchAll({ type: 'window' }))
    : self.clients.matchAll({ type: 'window' });
  return cibles.then(list => list.forEach(cl => cl.postMessage({ type: 'ik-maj' }))).catch(() => {});
}

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
    badge: 'icon-192.png',
    // Lien profond (27/09) : 'sport' (séance du jour), 'prayer', 'rank' (record d'un ami).
    data: { open: data.open || '' }
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
  // Notification serveur (rappel, prière, record d'un ami) : on la referme, on remet
  // l'app au premier plan et on lui dit quel écran ouvrir ; app fermée, on l'ouvre
  // directement sur cet écran (?open=…, lu au démarrage par app.js).
  const open = (e.notification.data && e.notification.data.open) || '';
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) {
          if (open) c.postMessage({ type: 'ik-open', open });
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(open ? '/?open=' + encodeURIComponent(open) : '/');
    })
  );
});
