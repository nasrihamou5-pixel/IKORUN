# IKORUN 4.3.0 — Jours au choix, séances à confirmer, accueil plus visuel

## Assistant « Nouveau plan »
- Deux rangées de jours : **jours de course** (ceux du plan de course) et **jours de muscu**.
- Sans plan de course : les jours choisis sont repris dans la configuration du plan.
- Avec un plan existant : si les jours de course changent, l'assistant prévient, recalcule le plan de course
  sur ces jours, puis la muscu autour.

## Séances oubliées
- Une séance passée non cochée n'est plus envoyée vers « Pas faite » : elle reste **« À confirmer »**.
- Carte « N séances à confirmer » (Accueil, Programme, Course) avec « Je l'ai faite » / « Pas faite »,
  pour la course comme pour la muscu (3 dernières semaines).
- Une séance marquée « Manquée » par erreur : « En fait, je l'ai faite » dans sa fiche la repasse en faite.

## Sport
- Programme intégré : la carte du plan (course, compte à rebours, phases, VDOT, km prévus, Voir le plan,
  Régénérer) est de retour en tête de page. « Voir le plan » montre course + muscu semaine par semaine.

## Accueil
- Séance de muscu du jour : silhouette des muscles travaillés, groupes musculaires, 4 premiers exercices
  (séries × répétitions), durée, exercices, séries, « Démarrer ».
- Jour de repos : la semaine en points (course, muscu, fait) et la prochaine séance avec sa distance et son allure.
- « Séances » compte aussi les séances de muscu du plan dans l'objectif de la semaine.

## Tests
- Smoke 131 ok · validatePlan sans erreur · simulateAthlete sans échec · générateur 6 858/6 858.
- Parcours testés (FR clair, AR sombre) : changement des jours avec recalcul, séances à confirmer,
  manquée → faite, muscu confirmée après coup. Aucune erreur JS.
