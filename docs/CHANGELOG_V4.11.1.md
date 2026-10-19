# IKORUN v4.11.1 — Inscription = profil seulement, tutoriel adapté

## Le conflit corrigé
L'inscription (v4.10) posait déjà des questions du plan (course, date, objectif, km/semaine, chrono),
puis « Configurer mon plan » les reposait. On revient à l'ordre de l'app de base :
**inscription → tutoriel → création du plan** (dernière étape du tutoriel).

- Inscription : prénom, pseudo, sexe, date de naissance, niveau, affichage, couleur. Rien d'autre.
- Les chronos sont maintenant demandés à la création du plan (« Ton meilleur chrono récent », après ta situation),
  seulement s'il n'y en a aucun d'enregistré. « Je n'ai pas de chrono » garde l'estimation.
- Sans chrono, la VDOT de départ est estimée selon le niveau (`P.vdotEstimated`) et **n'est plus remise à 0**
  au démarrage de l'app (nouvelle fonction `vdotRefresh()`) : sans ça, « Créer mon plan » à la fin du tutoriel
  renvoyait vers les records au lieu d'ouvrir la création du plan.

## Tutoriel
- Bienvenue : le nombre d'étapes est calculé (10, ou 9 en mode simplifié) au lieu de « 8 ».
- Étape Sport et dernière étape : décrivent la création du plan en une question par écran.

## Petits points corrigés
- Un assistant fermé vide son contenu : plus de boutons en double (deux `#ikfGo`) entre l'inscription et la création du plan.
- Fonction `ageDe` retirée par erreur pendant le nettoyage : remise (l'écran d'étapes restait vide).

Versions : app 4.11.1, `app.min.js?v=161`, `app.min.css?v=69`, langues `v=16`, cache `ikorun-v147`.
