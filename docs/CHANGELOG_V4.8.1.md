# IKORUN 4.8.1 — Démos d'exercices réparées

## Pourquoi certains exercices n'avaient pas de démo
Les photos viennent de free-exercise-db (GitHub). Deux causes :
1. **Identifiants renommés dans la base** : 5 identifiants n'existaient plus (parenthèses et tirets retirés en amont).
   L'image renvoyait une erreur 404, la carte restait vide. 11 exercices touchés.
2. **Aucune photo correspondante dans la base** : surtout des exercices de rééducation, qui n'ont pas d'équivalent photographié.

## Corrigé (photo de démo affichée)
| Exercice | Avant | Après |
|---|---|---|
| Pont fessier, Glute Bridge, Pont isométrique (ischios) | `Butt_Lift_(Bridge)` (404) | `Butt_Lift_Bridge` |
| Hyperextension lombaire, 45° One Leg Hyperextension | `Hyperextensions_-_Back_Extensions` (404) | `Hyperextensions_Back_Extensions` |
| Développé machine épaules, Lever Seated Shoulder Press | `Machine_Shoulder_(Military)_Press` (404) | `Machine_Shoulder_Military_Press` |
| Fentes marchées, Walking Lunge | `Dumbbell_Walking_Lunge` (404) | `Bodyweight_Walking_Lunge` (même mouvement, sans charge) |
| Thruster | `Thrusters` (404) | `Kettlebell_Thruster` (même mouvement, kettlebells) |
| Marche-course (rééducation) | aucune | `Trail_Running_Walking` |

## Encore sans photo (icône + consignes écrites)
Burpees (n'existe pas dans la base ; l'id cassé est retiré pour afficher l'icône au lieu d'une case vide) et 14 exercices de
rééducation : relevé de pointes (tibial), short foot, serviette avec les orteils, coquille, serrage ballon, quadriceps en
isométrie, extension terminale du genou, descente de marche, équilibre unipodal, éversion de cheville, marche sur les talons,
bird dog, curl-up de McGill, charnière de hanche au mur, planche latérale genoux fléchis.
Tous ont déjà leurs consignes FR/EN/AR.

## Vérifications
- Audit des 395 exercices contre `dist/exercises.json` de free-exercise-db : 0 identifiant cassé (avant : 11 exercices).
- Chargement réel des photos dans Chromium : 11/11 affichées.
- Fumée : 143/144 ; le seul échec est le test hors connexion, attendu quand le service worker est bloqué par le harnais.
- `APP_VERSION` 4.8.1, `app.min.js?v=156`, SW `ikorun-v142`.
