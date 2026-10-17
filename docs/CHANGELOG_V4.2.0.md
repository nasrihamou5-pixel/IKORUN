# IKORUN 4.2.0 — Programme intégré, coach discret, bilan plus clair

## Coach
- Plus de carte « Ton coach a ajusté ton plan » (Accueil, Sport, mode simple, Programme) : les ajustements
  sont faits directement dans le plan. La séance modifiée porte l'étiquette « Ajustée ».
- Les nouvelles allures (VDOT en hausse ou en baisse) sont appliquées aussitôt, sans validation.
- Tout reste visible et annulable dans « Historique des ajustements » (Sport), y compris « Je n'ai plus mal ».

## Sport : intégré ou séparé
- **Les deux ensemble** : course et muscu dans un seul programme, sur une seule page (pas d'onglets) :
  semaine, liste unique des séances course + muscu par date, « Tout le programme » semaine par semaine,
  plans et historique. « Plan de course » et « Muscu » s'ouvrent en sous-page avec un bouton retour.
  « Séparer course et muscu » ramène aux trois onglets.
- **Les deux séparément**, **Running** ou **Muscu** seuls : les trois onglets Programme / Course / Musculation.
- Assistant : 4 choix (ensemble, séparément, running, muscu). Sans plan de course, il commence par lui puis
  reprend tout seul. « Je le crée moi-même » reste proposé pour un plan seul.
- Générateur :
  - jamais de séance sur un jour déjà passé ;
  - en mode intégré, la muscu suit le plan de course : nouveau plan de course → séances à venir recalées
    (le passé et ce qui est fait sont gardés) ; ajustement qui met des jambes la veille d'une séance dure → recalage ;
  - en mode séparé, la muscu suit son propre cycle.
- Accueil : s'il n'y a pas de course aujourd'hui mais une séance de muscu du plan, c'est elle la séance du jour
  (durée, exercices, séries, « Démarrer ») au lieu de « Jour de repos ».

## Barre du bas
- Plus basse sur iPhone : 22 px du bord au lieu de 44 (elle descend dans la zone de la barre d'accueil).

## Bilan de séance
- La silhouette pour dire où on a mal est maintenant celle de la musculation (face et dos) ; on touche
  directement la partie du corps : hanche, cuisse avant/arrière, genou, tibia, cheville, pied, bas du dos,
  mollet, tendon d'Achille, côté gauche ou droit.

## Tests
- Smoke 131 ok · validatePlan sans erreur · simulateAthlete sans échec · générateur 6 858/6 858.
- Captures FR clair et AR sombre, sans erreur JS.
