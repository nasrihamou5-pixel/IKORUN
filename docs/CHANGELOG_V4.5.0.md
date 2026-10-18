# IKORUN 4.5.0 — Générateur testé à fond et rendu logique

## Banc d'essai
2 625 plans de course (VDOT 32 à 70 · 5 km, 10 km, 15 km, semi, marathon · 2 à 7 jours, y compris des jours
consécutifs · 3 à 24 semaines · en prépa / reprise / autre) et 2 610 plans de muscu liés (≈ 47 000 séances),
contrôlés par 30 règles indépendantes de l'appli (calendrier, enchaînements, progression, décharge, affûtage,
sortie longue, allures, durées, matériel, niveau…).

| Règle | Avant | Après |
|---|---|---|
| Deux séances dures d'affilée (sortie longue comprise) | 7 452 | 0 |
| Séance dure à J-1 / J-2 de la course | 138 | 0 |
| Sortie longue pas la plus longue de la semaine | 245 | 0 |
| Sortie longue trop longue pour la distance | 1 762 | 0 |
| Volume au-delà du km/sem maxi | 723 | 1 |
| Affûtage trop faible | 165 | 0 |
| Erreurs du validateur de l'appli | 121 | 78 (petites reprises : +3 km au lieu de +2) |
| Muscu (30 000+ séances) | 0 | 0 |

## Corrections du générateur de course
- **Placement au vrai calendrier** : la sortie longue va le dimanche (ou samedi, ou dernier jour) ; jamais deux
  séances dures — ni une dure et la longue — sur deux jours qui se suivent, dimanche → lundi compris.
  Avant, « se suivre » voulait dire « voisins dans la liste des jours » et tempo / fartlek / côtes ne comptaient pas.
- **Dur la veille de la sortie longue** interdit partout (génération, sécurité, validateur), comme le moteur d'adaptation.
- **J-2** : au plus un court rappel à l'allure de course ; **J-1** : footing.
- **Petits volumes** : footings de 3 à 4 km et sortie longue de 5 à 8 km selon le volume ; la qualité se raccourcit
  davantage ; en dernier recours un footing devient un jour de repos (au moins 3 séances gardées) plutôt que de
  dépasser le maximum.
- **Progression** : +10 % ou +2 km par semaine, le plus grand des deux (identique partout).
- **Affûtage** selon la distance : marathon 3 semaines, semi 2, 10 km et moins 1 à 2 ; calculé sur la dernière
  vraie semaine de charge.
- **Sortie longue** : plafonds 5 km 16 · 10 km 20 · semi 24 · marathon 35 km ; pour semi et marathon, progression
  propre (≈ 40 % de la distance → plafond, atteint juste avant l'affûtage), +3 km par semaine au plus, 75 % en
  décharge ; elle reste la plus longue séance, en distance et en durée.
- **Plans existants** : remis une fois aux nouvelles règles à l'ouverture (séances faites et passées intactes),
  et la muscu liée est recalée si besoin.

## Non-régression
Smoke 131 ok · banc d'origine 192/192 · moteur d'adaptation 44/44 · muscu 6 858/6 858 ·
8 parcours de l'assistant (FR/AR) · migration d'un ancien plan.
