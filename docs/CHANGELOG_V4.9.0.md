# IKORUN 4.9.0 — Allures par distance de répétition + test de fin de bloc

## Pourquoi il y avait si peu d'allures
Le générateur ne connaissait que **3 allures de zone** pour le fractionné (VMA courte 105 %, VMA longue 98 %, seuil 88 % de la vVO2max).
Un 200 m et un 600 m sortaient donc à la même allure, tout comme un 800 m et un 2000 m. La courbe `REP_INTENSITY_CURVE` (calibrée sur de
vraies séances de piste) existait déjà, mais ne servait qu'au contrôle anti-triche.

## Allure selon la distance (VMAc / VMAl / VO2 / pyramides)
Chaque répétition prend l'allure de sa distance, mélangée à l'allure de zone selon le niveau du coureur (`rs` de 0 à 1 : un débutant garde
l'allure de zone, un bon coureur suit la courbe). Pour VDOT 66 :

| Répétition | Avant | Maintenant |
|---|---|---|
| 200 m | 35 s | 27 s |
| 400 m | 1:10 | 1:01 |
| 800 m | 2:30 | 2:10 |
| 1000 m | 3:08 | 2:48 |
| 2000 m | 6:16 | 6:01 |

Inchangés : 30/30 et 15/15 (séances en temps), seuil, tempo, allure spécifique, footings, sortie longue. Les plans déjà générés gardent leurs
anciennes allures (`rs` absent = 0) jusqu'à leur régénération.

## Test de fin de bloc
Dans la semaine de décharge (S4, S8, S12…), la séance de qualité devient un **test plus court que la course** :
3000 m → test 1500 m · 5 km → 3000 m · 10 km → 5000 m · semi → 8 km · marathon → 10 km.
À la validation de la séance, l'appli demande le chrono, recalcule la VDOT (jamais plus de 3 points d'un coup, contrôle anti-triche appliqué)
et **recale les allures de toutes les séances à venir**. L'ajustement apparaît dans le journal du coach (annulable). Pas de test s'il ne tient pas
dans le volume de la semaine, à moins de 8 jours de la course ou en reprise.

## Vérifications
600 profils sans erreur, validateur 0 anomalie, fumée 143/143 (hors test hors-ligne, non exécutable dans le banc).
