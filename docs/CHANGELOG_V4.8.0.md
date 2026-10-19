# IKORUN 4.8.0 — Un plan de course qui tire vers l'objectif, un accord course ↔ muscu audité, des fiches à deux niveaux

## Chiffres avant (V4.7.0) / après (V4.8.0)
Harnais `tests/engine-harness.js` : la vraie appli dans Chromium, des milliers de profils (VDOT 32 à 70, 5 km → marathon, 3 à 6 jours, 4 à 24 semaines, reprise, types aimés).

| Mesure | V4.7.0 | V4.8.0 |
|---|---|---|
| 600 profils sans défaut (NaN, « 3:6x », sortie longue absente, jour J, volume…) | 533 (67 en défaut) | **600** (2 000 profils : 2 000) |
| 10 km à 32:00, 5 j, 13 sem. — fractionnés rapides par plan | 5,3 (7,7 % des séances) | **10,3 (15,1 %)** |
| …semaines VO2/spécifique/pic sans fractionné rapide (20 plans) | 28 | **0** |
| …structures de pyramide différentes sur 20 générations | 0 (une seule, figée) | **8** (10 en bibliothèque) |
| …séances VMA moins rapides que l'allure objectif | 59 | **0** |
| …volume maxi atteint (max choisi : 90 km) | 75 km | **88 km** |
| Même utilisateur, 20 régénérations : qualité différente d'un plan à l'autre | 90 % (min 68 %) | **96 % (min 80 %)** |
| 1 000 paires d'utilisateurs : similarité médiane / p95 / max | 0 / 5 / 42 % | 0 / 5 / 46 % — aucun plan identique, aucun profil qui ressemble à tous |
| Séances dures sur un jour de jambes ou le lendemain (261 plans liés) | 280 sur 1 258 (22 %) | **1 150 sur 8 733 (13 %)** — le reste est imposé par le calendrier |
| Séances dures sacrifiées par adaptAfterMuscu | 6 | **0** |

## Moteur de course
- **Chrono objectif** : `P.objTime` calcule un VDOT visé. Le VDOT de travail se place entre le VDOT mesuré et le VDOT visé, plafonné à 3,1 → 4,1 points selon le niveau, avec montée progressive (0 au début, plein écart à l'entrée de la phase spécifique). Seules les allures de qualité et spécifiques montent : les footings gardent l'allure mesurée. Chaque séance porte son écart (`pvo`) : l'ajustement de VDOT du moteur d'adaptation déplace donc aussi ces séances. Allure spécifique, tempo spécifique et jour J convergent vers l'allure objectif.
- **Poids de progression** : `PROGRESSION_WEIGHT = 0,65` au-dessus de VDOT 50 (65 % progression / 35 % sécurité), interpolé jusqu'à 0,35 à VDOT 30. Il règle seul : hausse hebdo (×1,10 → ×1,14, +2 → +3 km mini), séances très dures (2 → 3 dès 5 jours), décharge (80 → 85 % du pic), vitesse de montée du volume, écart de VDOT. **Garde-fous durs inchangés** : jamais deux jours durs de suite, veille de course = récupération, J-2 un rappel court, affûtage, décharge toutes les 4 semaines, volume ≤ maximum choisi, reprise après coupure, blessure. Les plans d'avant la V4.8 gardent leurs seuils d'origine.
- **Qualité garantie** : de la phase VO2 au pic, au moins 2 séances de qualité (3 à partir de 5 jours) dans la limite du calendrier — sur 5 jours, au plus 3 jours durs sans jours consécutifs, donc 2 qualités + sortie longue —, dont un fractionné rapide ; tirage pondéré avec mémoire (un type absent depuis longtemps pèse plus) ; les gardes-fous de volume sacrifient ce fractionné en dernier. Phases VO2 (24 %), spécifique (22 %) et pic (12 %) plus longues pour 10 km et moins.
- **Pyramides** : 10 structures (200-400-600-800-600-400-200, 400…1600…400, 1000-2000-3000-2000-1000, échelles montantes et descendantes, 200→1000→200…) choisies selon niveau, phase et distance, allure par segment (VMAc / VMAl / allure spécifique / seuil) et récupérations de 45 s à 2 min 30. INTERVAL n'est plus converti en VMAl : la pyramide perd d'abord un segment, ce n'est qu'en dernier recours qu'elle devient 5 × 1000 m en VMAl (même zone).
- **Séances plus extrêmes** (niveaux avancés) : 30/30, 15/15, 12-16 × 200 m, 10 × 400 m à l'allure 3 km, séries de 600 m, 8 × 800 m, 3-4 × 1600 m, seuil en 1500/2000/3000 m, côtes courtes en sprint (10-15 s), fartlek structuré (1-2-3-2-1, échelle 30-60-90-120…).
- **Échelle par niveau** (VDOT 60 %, volume 40 %) : répétitions, distance de travail, récupération, échauffement (12-20 min) et retour au calme (8-14 min). Une séance de qualité reste plus courte que la sortie longue (plafond de distance).
- `spkToStr` : 239,6 s s'affiche 4:00 et non 3:60.

## Accord course ↔ muscu (audit : `docs/AUDIT_COURSE_MUSCU_V4.8.0.md`)
- Le plan de course **lit** désormais les jours de jambes de la muscu (ou les jours choisis dans l'assistant) et y évite séances dures et sortie longue.
- `adaptAfterMuscu` n'allège que la séance dure du **lendemain** (avant : J+2, donc la qualité était sacrifiée à chaque fois), au plus tous les 4 jours, toujours dit au journal.
- Muscu : −1 série pour un débutant, +1 pour un avancé sur les exercices principaux ; RPE visé et repos par exercice.
- `strengthRelink` réapplique la rééducation en cours aux nouvelles séances.

## Fiches
- **Séance de course** : échauffement chiffré (min · allure), tableau des répétitions avec allure, temps de passage et récupération de chaque segment, retour au calme chiffré, « pourquoi » et un conseil en une ligne. Le détail complet est dans « Détails » (replié).
- **Exercice** : démo, muscles, consigne clé, 3 points d'exécution **propres à l'exercice**, effort visé (RPE, répétitions en réserve, repos) ; respiration, erreurs, conseils, sécurité, variantes et muscles secondaires dans « Détails ».

## Technique
- `tests/engine-harness.js` + `tests/engine-harness.page.js` (voir plus haut) ; 6 tests de fumée de plus (144 au total).
- i18n : 2 529 clés × 3 langues. `APP_VERSION` 4.8.0, SW `ikorun-v140`.
- Limites : le harnais tourne dans la vraie appli (Chromium) et non dans un contexte `vm` avec un DOM simulé — app.js touche au DOM dès son chargement ; 11 % des séances dures tombent encore sur un jour de jambes ou le lendemain quand les jours de course et de muscu choisis ne laissent pas d'autre place ; sur 5 jours, 3 séances de qualité + sortie longue sont impossibles sans deux jours durs consécutifs.
