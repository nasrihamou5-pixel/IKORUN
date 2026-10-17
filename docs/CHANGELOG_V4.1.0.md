# IKORUN 4.1.1 — Écrans alignés sur les maquettes

- Onglet Programme comme la maquette Sport : carte « Programme combiné » (étiquette, semaine, chiffres séparés),
  jour de repos visible dans la bande, carte « Jambes faites · séance de … allégée » avec Pourquoi ? / Annuler,
  séance du jour en ligne, étiquettes Suivi / Suivre, bouton « Créer un plan » plein, sous-titre « Ton programme de la semaine ».
- Assistant comme la maquette Créer : icônes dans un carré (pleines quand choisies), « Conseillé » en étiquette,
  séances par semaine et matériel en sélecteur.
- Rangs comme la maquette Rangs : « Prochain rang · … », halo à la couleur du rang.
- Accueil comme la maquette Main : point sur la pastille Check tant que le check du matin n'est pas fait.

# IKORUN 4.1.0 — Programme course + muscu, accueil à pastilles, rangs

## Nouveautés
- **Accueil à pastilles** : Prière (+ Ramadan), Météo, Check du matin et Course suivie sont regroupés
  dans une rangée de pastilles ; une seule carte est ouverte à la fois et le choix est mémorisé.
  Une pastille sans contenu (check déjà fait, aucune course suivie…) n'apparaît pas.
- **Onglet « Programme »** dans Sport (masqué en mode simple) : semaine en cours, points course / muscu,
  séances adaptées, séance de muscu du jour, liste de mes plans.
- **Assistant « Nouveau plan »** : course, muscu ou les deux ensemble ; généré par IKORUN ou créé soi-même ;
  jours, nombre de séances par semaine, matériel (salle / maison / les deux).
- **Générateur de muscu** (plan/strength.js) accordé au plan de course : jamais de jambes le jour ou la veille
  d'une séance dure, ni dans les 5 jours avant la course ; muscu réduite en semaine de décharge et en affûtage ;
  cycles endurance de force → volume → force ; résultat vérifié par validateStrengthPlan.
  Les jours proposés par défaut sont ceux qui gênent le moins le plan de course ; si des séances
  n'ont pas trouvé de jour sûr, l'appli le dit.
- **Accord muscu → course** (règle « legs » du moteur d'adaptation) : après une séance de jambes lourde,
  la séance dure suivante dans les 48 h est allégée (qualité → footing ≤ 8 km, sortie longue −20 %),
  avec le même journal et le même bouton « Annuler » que les autres ajustements.
- **Badges de rang** : 8 rangs en SVG dessinés avec les deux lames du logo ; écran « Progression »
  (rang actuel, conditions du suivant, grille des 8 rangs) en tête de la galerie de badges.

## Détails
- Textes en français, anglais et arabe (68 clés), pluriels arabes inclus ; mise en page RTL vérifiée.
- Corrections après intégration : bouton « Suivi » étiré, nom des rangs rogné en arabe, cadenas
  des rangs verrouillés agrandi, titre de l'assistant non traduit.

## Tests
- Smoke 131 ok · validatePlan 192/192 · simulateAthlete 12/12.
- Générateur de muscu : 6 858 combinaisons (jours × séances × matériel × niveau × lié/seul),
  toutes valides, aucune séance de jambes avant une séance dure, matériel « maison » respecté.

## Réglages manuels
- Aucun nouveau : les données du plan de muscu restent sur le téléphone (clé `strength_plan`).
- Les réglages de la V4.0.0 (migrations, fonction send-race-reminders) restent à faire s'ils ne le sont pas.
