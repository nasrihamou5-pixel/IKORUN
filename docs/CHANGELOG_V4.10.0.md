# IKORUN v4.10.0 — Nouvelle inscription (style KORE)

L'inscription est refaite sur le modèle de l'assistant de KORE, aux couleurs d'IKORUN.

## Le principe
- **Une question par écran** : grand titre, une phrase qui dit pourquoi on demande, des réponses qu'on touche.
- Les choix simples (sexe, niveau, course, affichage) **passent tout seuls** à l'écran suivant.
- **Écran d'accueil** : langue (FR / EN / AR), ce que l'app va construire, durée estimée.
- **Écrans d'étapes** entre les parties (Toi → Course → Ton app) : la partie finie se coche.
- **Récapitulatif** : chaque ligne se touche pour corriger, puis retour direct au récap.
- **Construction de l'espace** : anneau de progression et étapes cochées une à une.

## Les écrans
1. Prénom · 2. Pseudo (proposé automatiquement, disponibilité vérifiée) · 3. Sexe · 4. Date de naissance (roues)
5. Niveau · 6. **Km par semaine** (nouveau, « Je ne sais pas » possible) · 7. **Meilleur chrono récent** (distance + temps, plusieurs possibles, ou « Je n'ai pas de chrono »)
8. **Course visée** (5 km → Ultra, autre distance, aucune, ou course du calendrier) · 9. **Date, terrain, objectif** (finir / viser un chrono)
10. Affichage complet ou simplifié · 11. Thème et couleur · 12. Récapitulatif

## Ce qui change dans les données
- Nouveaux champs remplis dès l'inscription : `kmWeek` réel, `objRace`, `objRaceKm`, `objProfile`, `objGoal`, `objTime`.
  « Configurer mon plan » les reprend à la première génération (comme avant pour l'objectif).
- Sans chrono : VDOT de départ estimée selon le niveau (`P.vdotEstimated`), corrigée par le test de fin de bloc.
- Sans course précise : pas de date imposée ; le plan se règle à sa création.
- Les jours d'entraînement restent choisis à la création du plan.

## Technique
- Nouveau module `ui/onboarding.js` (IKOB), ajouté au bundle `app.min.js`. Rendu dans `#ob`.
- Ancien code des 6 étapes retiré d'`app.js` et d'`index.html`.
- 90 nouvelles clés `ob2*` en FR / EN / AR. Arabe : sens RTL et chiffres corrigés.
- Versions : app 4.10.0, `app.min.js?v=159`, `app.min.css?v=67`, langues `v=14`, cache `ikorun-v145`.
