# IKORUN V4.0.0 — Réglages à faire à la main

Ces réglages ne peuvent pas être faits depuis le code. Coche chaque case quand c'est fait.

## Supabase (supabase.com › projet `bsrbzuhvqtjkkmpmxyzw`)

### 1. Appliquer les 3 migrations (à faire en premier)

L'envoi automatique a attendu ta validation et n'a pas pu se terminer : **rien n'est encore créé** dans la base.

Tant que ce n'est pas fait :
- le calendrier des courses affiche « pas encore disponible » ;
- les statistiques restent en attente sur les téléphones ;
- le partage de forme avec le club ne s'enregistre pas.

Le reste de l'app fonctionne normalement.

- [ ] SQL Editor › New query : colle **le contenu complet** de chaque fichier, dans cet ordre, et clique Run à chaque fois :
  1. `supabase/migrations/20261012120000_athlete_status.sql`
  2. `supabase/migrations/20261012130000_races.sql`
  3. `supabase/migrations/20261012140000_analytics.sql`
  - Chaque fichier peut être rejoué sans risque : il ne casse rien s'il a déjà été appliqué.
  - *Autre solution* : rouvre la conversation et dis-moi « applique les migrations ». Puis valide la demande d'autorisation quand elle s'affiche.
- [ ] **Déployer la fonction des rappels de course** : `supabase/functions/send-race-reminders/index.ts`.
  - Edge Functions › Deploy a new function › nom `send-race-reminders` ; coller le fichier ; laisser « Verify JWT » coché.
  - Elle se protège elle-même avec le secret du cron, comme les trois autres fonctions.
  - Ou demande-le-moi en validant l'autorisation.
  - La tâche planifiée `send-race-reminders-9h` (9 h, heure d'Algérie) est créée par la migration n° 2.
- [ ] Rejouer `tests/security.sql` (SQL Editor). Les blocs 11 à 17 doivent revenir vides, sauf le 12 (une ligne : races / SELECT) et le 17 (la liste de tes admins).

### À faire par toi

- [ ] **Te déclarer administrateur de l'app.** C'est ce qui ouvre « Gérer le calendrier » et « Statistiques de l'app » dans Profil.
  1. SQL Editor.
  2. Colle :
     ```sql
     insert into public.app_admins (user_id, note)
     select id, 'propriétaire' from auth.users where email = 'TON_EMAIL_ICI'
     on conflict do nothing;
     ```
  3. Remplace `TON_EMAIL_ICI` par l'email de ton compte IKORUN, puis Run.
  - Pour retirer quelqu'un : `delete from public.app_admins where user_id = '…';`
- [ ] **Protection contre les mots de passe divulgués.** Authentication › Providers › Email (ou Authentication › Settings › Password security) : activer « Leaked password protection ». Supabase vérifie alors les mots de passe auprès de HaveIBeenPwned.
- [ ] **Longueur minimale des mots de passe.** Même page : 8 caractères au moins, avec lettres et chiffres.
- [ ] **Limites d'envoi d'emails et de connexions.** Authentication › Rate Limits : garder les valeurs par défaut ou plus strictes. Si les inscriptions invité sont la cible d'abus, activer le CAPTCHA (Authentication › Attack Protection › Turnstile).
- [ ] **Schémas exposés par l'API.** Settings › API › Exposed schemas : `public` seulement (jamais `net` ni `cron`).
- [ ] **Rejouer les tests de sécurité.** SQL Editor : coller `tests/security.sql`.
  - Chaque bloc doit revenir vide, sauf ceux qui disent le contraire.
  - Les blocs 11 à 17 concernent la V4.0.0.
- [ ] *(facultatif)* **Rappels de prière hors Béjaïa.** La notification serveur des prières utilise encore les horaires de Béjaïa. L'affichage dans l'app, lui, suit la ville choisie. À revoir dans une prochaine version.

## Cloudflare (dash.cloudflare.com)

- [ ] **Cloudflare Web Analytics.**
  1. Workers & Pages › projet **ikorun** › Metrics › Web Analytics › **Enable**.
     - Ou : Analytics & Logs › Web Analytics › Add a site › ikorun.pages.dev, en mode automatique.
  2. Cloudflare injecte alors son petit script de mesure, sans cookie. La politique de sécurité de la page l'autorise déjà (`static.cloudflareinsights.com`, `cloudflareinsights.com`).
- [ ] **Vérifier les en-têtes après déploiement.**
  1. Ouvre https://ikorun.pages.dev.
  2. Outils développeur › Réseau › `index.html` : `Content-Security-Policy` doit contenir `www.openstreetmap.org` (carte des courses) et `open-meteo.com` (météo).
- [ ] *(conseillé)* **Bot Fight Mode** : Security › Bots, si le domaine est un jour sur ton propre nom de domaine.

## Calendrier des courses : premiers contenus

La collecte automatique sur finishers, ahotu et FAA n'est **pas activée** : leurs conditions n'ont pas pu être vérifiées (voir `docs/COURSES_SOURCES.md`). Le calendrier est vide tant que tu n'y mets rien.

- [ ] Profil › Gérer le calendrier › Ajouter : saisir les courses dont tu as une source sûre (affiche, page officielle de l'organisateur).
- [ ] Ou Importer : un fichier CSV ou JSON (modèle dans `docs/COURSES_SOURCES.md`).
  - L'aperçu montre les doublons et les dates contradictoires avant d'écrire quoi que ce soit.
- [ ] Courses repérées à vérifier avant saisie :
  - Semi-marathon international d'Alger (annoncé le 18/12/2026) ;
  - Semi-marathon international de Béjaïa (16/10/2026, selon un listing seulement) ;
  - Sahara Marathon (date à trouver).

## Météo

Open-Meteo est gratuit pour un usage **non commercial**. Si IKORUN devient payante ou affiche de la publicité, il faudra prendre un abonnement Open-Meteo (API commerciale) ou changer de fournisseur. Un seul fichier à modifier : `weather/weather.js`, fonction `wxFetch`.
