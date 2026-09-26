// Service worker IKORUN — fichier statique (remplace l'ancienne version enregistrée
// via blob URL, qui empêchait le navigateur de détecter correctement les mises à jour).
// Stratégie EN DEUX TEMPS :
//  · Ressources versionnées ou immuables (app.js?v=N, images, polices) → cache-first.
//  · Tout le reste, à commencer par index.html → cache d'abord + mise à jour en fond
//    (depuis le 25/09, voir plus bas ; avant : network-first).
// Avant, TOUT passait en network-first avec {cache:'no-store'} : app.js était
// intégralement retéléchargé à CHAQUE ouverture de l'app, jamais servi depuis
// le cache. Mesuré à ~1 s sur une bonne connexion, bien pire en 3G. Or son URL
// porte déjà un numéro de version (?v=N) : monter ce numéro suffit à invalider
// l'entrée, le no-store ne protégeait donc de rien et coûtait un téléchargement
// complet par lancement.
// 21/09 : app.js était monté à 3,9 Mo (21 images de badges/rangs encodées en
// base64 directement dans le JS, jamais faites pour ça — parsé/compilé à
// chaque démarrage à froid, y compris sur iPhone). Extraites vers badges/*.png,
// qui profitent nativement du cache-first ci-dessous (repris par IMMUABLE) sans
// alourdir le script. app.js est repassé à ~1 Mo.
// v7 : purge forcée. Tant que manifest.json n'existait pas, l'hébergeur renvoyait
// index.html (du HTML) à sa place, et ce SW a pu mettre cette mauvaise réponse en
// cache. Changer le nom du cache supprime les anciennes entrées à l'activation, ce
// qui garantit que le vrai manifest.json est bien récupéré — condition nécessaire
// pour que le navigateur propose l'installation de l'app.
const C = 'ikorun-v84';

// Une réponse est réutilisable telle quelle si son URL identifie déjà une version
// précise : soit elle porte un paramètre ?v=..., soit c'est un binaire dont le nom
// change quand le contenu change. manifest.json et index.html n'en font PAS partie et
// ont leur propre stratégie (cache d'abord + mise à jour en fond + message 'ik-maj').
const IMMUABLE = /\.(png|jpe?g|webp|svg|gif|woff2?|ttf|ico|mp3|wav)$/i;
function estVersionnee(url){
  return url.searchParams.has('v') || IMMUABLE.test(url.pathname);
}

// Coquille de base mise en cache dès l'installation. Sans ça, le cache ne se
// remplissait qu'au fil des requêtes réussies : à chaque changement de nom de
// cache (donc à chaque mise à jour), l'activation supprimait tout et laissait
// une fenêtre où l'app ouverte hors-ligne — ou sur un réseau qui décroche —
// n'avait plus ses icônes. L'écran de connexion affichait alors le texte
// alternatif de l'image à la place du logo. On ne précharge PAS app.js : son
// URL porte un numéro de version, le réseau-d'abord s'en charge tout seul.
const SHELL = [
  './',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon-32.png',
  'favicon-16.png',
  'vendor/supabase.js?v=1',
  'vendor/sb-init.js?v=1'
];

self.addEventListener('install', e => {
  // Chaque entrée est ajoutée separement : avec cache.addAll(), un seul fichier
  // manquant ferait echouer TOUTE l'installation du service worker.
  e.waitUntil(
    caches.open(C)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .catch(() => {})
  );
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
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // CACHE-FIRST pour les ressources versionnées : on sert immédiatement depuis le
  // cache sans toucher au réseau. C'est ce qui rend les lancements suivants quasi
  // instantanés, y compris sur une connexion lente ou instable.
  if (estVersionnee(url)) {
    e.respondWith(
      caches.open(C).then(c =>
        c.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(res => {
            if (res && res.ok) { try { c.put(e.request, res.clone()); } catch (x) {} }
            return res;
          });
        })
      ).catch(() => fetch(e.request))
    );
    return;
  }

  // PAGE (index.html, manifest.json…) — 25/09 : CACHE D'ABORD, MISE À JOUR EN FOND.
  // Avant, chaque lancement attendait la réponse du réseau pour index.html (mesuré
  // à ~0,5 s, jusqu'à 0,7 s avec le délai max) : écran noir avant l'intro, remonté
  // par Hamou. Désormais la copie enregistrée s'affiche immédiatement ; le réseau
  // est interrogé en parallèle, met le cache à jour et, si la page a changé (nouvelle
  // version déployée), prévient la page (message 'ik-maj') qui propose de recharger.
  // Première visite (rien en cache) : on attend le réseau, comme avant. Hors-ligne :
  // la copie en cache, comme avant.
  const maj = fetch(e.request, { cache: 'no-store' }).then(res => {
    // fetch() RÉSOUT sur un 404/500/502 (il ne rejette que sur erreur réseau) : une
    // page d'erreur transitoire du CDN ne doit jamais remplacer la bonne copie.
    if (!res || !res.ok) return res;
    const pourCache = res.clone(), pourComparer = res.clone();
    return caches.open(C).then(c => c.match(e.request).then(ancien => {
      const change = (ancien && e.request.mode === 'navigate')
        ? Promise.all([ancien.text(), pourComparer.text()]).then(([x, y]) => x !== y).catch(() => false)
        : Promise.resolve(false);
      return c.put(e.request, pourCache).then(() => change).then(ch => { if (ch) prevenirMaj(e); });
    })).catch(() => {}).then(() => res);
  });
  e.respondWith(
    caches.open(C).then(c => c.match(e.request)).catch(() => undefined)
      .then(hit => hit || maj.then(res => res || Response.error(), () => Response.error()))
  );
  // garde le service worker en vie jusqu'à la fin de la mise à jour du cache
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
