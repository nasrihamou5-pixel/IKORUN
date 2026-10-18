# IKORUN 4.4.0 — Le générateur crée vraiment un nouveau plan, et « Mes plans » devient clair

## Ce qui n'allait pas (vérifié dans le navigateur)
- « Les deux ensemble » avec un plan de course existant : le plan de course n'était PAS refait.
- La muscu ressortait identique à chaque génération (même graine → mêmes exercices, mêmes jours).
- « Running » seul faisait quitter le programme intégré sans le dire.
- « Mes plans » : pas de « Modifier » ni de « Supprimer » pour le plan de course ; « Suivi / Suivre »
  ressemblaient à des boutons mais ne faisaient que changer d'onglet ; « Voir » la muscu montrait les
  programmes par défaut, pas ton plan.
- « Régénérer / reconfigurer » effaçait le plan AVANT la configuration : fermer la fenêtre laissait sans plan.

## Corrigé
- Chaque génération crée un plan neuf : nouvelle graine pour la muscu (d'autres exercices), et avec un
  plan de course existant l'assistant demande « Plan de course : Nouveau / Garder l'actuel » (Nouveau par défaut).
- L'assistant dit ce qu'il va remplacer (« Tu as déjà : 10 km + Force 2×/sem… ») et le bouton devient
  « Créer et remplacer ».
- Running seul ne remplace que le plan de course ; Muscu seule ne remplace que la muscu (liée à la course
  si le programme est intégré). Le mode ne change que pour « ensemble » / « séparément ».
- « Mes plans » : une carte par plan (type, semaines, jours, date de fin, « En cours ») avec
  **Voir · Modifier · Supprimer**.
  - Course : Voir le plan, Modifier = configuration pré-remplie, Supprimer avec confirmation.
  - Muscu : Voir = le plan semaine par semaine, Modifier = l'assistant rouvert avec tes réglages,
    Supprimer avec confirmation.
  - Plans perso et routines : Voir, Supprimer.
- « Régénérer » garde ton plan tant que le nouveau n'est pas créé.

## Tests
- 8 parcours (FR clair, AR sombre) : les deux ×2 (tout est neuf), garder la course, course seule,
  muscu seule, modifier la muscu, supprimer la course, régénérer puis annuler. Aucune erreur JS.
- Smoke 131 ok · validatePlan sans erreur · simulateAthlete sans échec · générateur 6 858/6 858.
