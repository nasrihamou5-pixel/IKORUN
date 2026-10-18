# IKORUN 4.6.0 — Muscu qui s'adapte, blessure confirmée, rééducation, bibliothèque ×2

## Muscu : mêmes adaptations que la course
Tout passe par les mêmes garde-fous que la course (copie du plan, validation, journal « Ton coach a ajusté », « Annuler »).

| Situation | Ce qui change dans le plan de muscu |
|---|---|
| Douleur ≥ 4/10 ou qui change la foulée | Pendant 4 jours, les exercices qui sollicitent la zone sont retirés et remplacés par 1 exercice doux de rééducation |
| Même zone 3 fois en 7 jours | Idem tant que le blocage « douleur répétée » dure |
| Maladie | Muscu en pause pendant le repos, puis une série de moins par exercice jusqu'à la fin de la période facile |
| Séance sautée pour fatigue | La prochaine séance perd une série par exercice |
| 2 séances sautées en 14 jours | La suivante est allégée d'une série |
| 10 jours sans muscu (21 jours : 2 séries de moins) | Les 2 prochaines séances reprennent avec moins de séries |

**Sens unique** : une séance de course dure ou manquée n'allège jamais la muscu (une séance de jambes lourde allège toujours la course qui suit, comme avant).

La zone douloureuse se corrèle aux muscles : genou → quadriceps et ischios, hanche → fessiers, adducteurs, abducteurs et quadriceps,
cuisse arrière → ischios et fessiers, lombaires → bas du dos et exercices lourds du dos, mollet / Achille / cheville / pied / tibia → mollets.

Nouveau : à la fin d'une séance de muscu, **« J'ai mal quelque part »** (même silhouette que le bilan de course), et **« Pas fait »**
demande maintenant pourquoi (douleur, maladie, fatigue, pas le temps, autre).

## Blessure confirmée
Une blessure est **confirmée** quand la même zone (et le même côté) est signalée **7 fois**, ou **pendant plus de 14 jours** (3 signalements au moins),
sans trou de plus de 10 jours entre deux signalements. Un ancien épisode ne compte pas ; « Je n'ai plus mal » remet le compteur à zéro.

Trois étapes, la course et la muscu s'adaptent seules :

| Étape | Course | Muscu | Passage à la suivante |
|---|---|---|---|
| 1. Calmer | séances faciles, plus courtes (−30 %, 5 km max), 2 jours de repos si douleur forte | zone retirée, 3 exercices de rééducation | 7 jours et aucune douleur ≥ 4 depuis 5 jours |
| 2. Reconstruire | footings faciles, pas d'intensité (8 km max) | rééducation progressive à la place de la zone | 7 jours et aucune douleur ≥ 3 depuis 5 jours |
| 3. Reprendre | qualité −20 %, le reste retrouve son volume | zone réintroduite avec une série de moins + prévention | 7 jours sans aucun signalement : blessure terminée |

Une douleur ≥ 4 pendant les étapes 2 ou 3 ramène à l'étape 1. « Je n'ai plus mal » avance d'une étape (avec confirmation).
Au retour : la première séance de qualité est allégée d'un cran, les séances de muscu retrouvent leur contenu d'origine.
Après 2 rechutes ou 6 semaines, l'écran invite à consulter un médecin ou un kiné.

**Carte « Blessure suivie »** (Accueil et Sport) → écran **Rééducation** : étape, ce que fait l'app, exercices de l'étape (avec tuto et animation),
conseils, à éviter, activités pour rester en forme, signes qui imposent de consulter, critères de reprise, rappel que ça ne remplace pas un avis médical.
Programmes pour : hanche/aine, cuisse avant, genou, tibia, cheville, pied, lombaires, cuisse arrière, mollet, tendon d'Achille.

## Bibliothèque d'exercices : 177 → 395
- 196 exercices ajoutés depuis **free-exercise-db** (The Unlicense, domaine public) avec images de démonstration en deux temps :
  force (poulie, machines, haltères, poids du corps…), étirements, mobilité / rouleau de massage, cardio, pliométrie.
- Tutos pas à pas **en français, anglais et arabe** (traduits à la main) ; 26 exercices de rééducation rédigés pour IKORUN.
- Nouveau filtre **Type** : Musculation · Étirement · Mobilité · Cardio · Pliométrie · Rééducation.
- Le générateur de muscu ne pioche que dans les exercices de force. Matériel « Accessoire » ajouté (rouleau, ballon).
- Les tutos sont chargés à la demande (`exercises/exdb.min.js`, 209 Ko, préchargé hors ligne par le service worker) :
  l'appli n'alourdit son démarrage que de la liste des noms (50 Ko).

## Technique
- `plan/injury.js` (moteur), `plan/injury-ui.js` (écrans), `exercises/exdb.js` + `exdb-steps.js` (générés par `tools/exdb-build.py`).
- Journal des douleurs `P.adapt.painLog` (120 jours), blessure `P.injury`, historique `P.injuryHist`.
- Muscu seule (sans plan de course) : blessure, maladie et pauses fonctionnent aussi.
- Tests : fumée 138/138 (7 nouveaux : bibliothèque, seuils 7 signalements / 14 jours / trou de 10 jours, cycle complet de la blessure,
  sens unique, fatigue + annulation), validateur de plans 192/192, simulateur, 6 858 plans de muscu sans erreur.
