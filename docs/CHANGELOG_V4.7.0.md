# IKORUN 4.7.0 — Tout plus léger : fiches minimales, assistant de plan simplifié, Santé dans Stats

## Bug corrigé : la fiche d'une séance (fartlek…) qui bloquait l'appli
Quand la météo arrivait après l'ouverture de la fiche, celle-ci se redessinait… puis se redessinait encore, sans fin, si la séance
était au-delà des prévisions (ex. un fartlek dans plusieurs semaines). L'appli restait figée. Désormais un seul redessin, et
seulement si la météo peut vraiment s'afficher. Contrôlé sur 5 990 séances de 108 plans différents.

## Fiches minimales
- **Séance de course** : titre, les 3 chiffres (km, allure, durée), l'objectif en une ligne, l'allure cible, le tableau de la séance
  et le bouton. Disparus : échauffement/corps/retour au calme en doublon, allures détaillées, récupération, conseils, erreurs à éviter,
  « pourquoi cette séance ». La carte « Ajoute ta ville » n'apparaît plus dans la fiche.
- **Exercice** : démo animée, muscles principaux, 3 étapes au plus (quand elles sont propres à l'exercice). Disparus : respiration,
  erreurs fréquentes, conseils génériques, sécurité générique, variantes, muscles secondaires.
- **22 exercices sans démo** en ont maintenant une (vacuum, wall sit, planche latérale, exercices à l'élastique, cou, kettlebell…).

## Assistant « Nouveau plan »
- **Plus de question « combien de séances par semaine ? »** : les jours de muscu choisis fixent le nombre (3 jours au maximum).
- **Les jours de course ne sont plus demandés deux fois** : ils se règlent dans la configuration du plan de course.
- Étapes numérotées dans l'ordre.
- **Plus rapide** : en « course + muscu », un seul message, un seul rendu et un seul feu d'artifice à la fin (avant : deux de chaque, et la
  proposition d'installation entre les deux). Stats : plus de délai artificiel de 0,2 s avant l'affichage.

## Santé dans Stats
Stats › **Bilan · Santé · Course · Muscu · Trophées**. Le tableau de bord Santé (poids, IMC, sommeil, nutrition) quitte Outils.

## Vérifications du plan de course
Mêmes résultats que la V4.5 sur 2 625 plans (aucune erreur, les 79 petites progressions à +3 km sur très petits volumes sont connues),
validateur 192/192, simulateur sans échec, 6 858 plans de muscu sans erreur, fumée 138/138.
