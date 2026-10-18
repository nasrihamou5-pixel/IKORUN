# Sources de la bibliothèque d'exercices

- **free-exercise-db** — https://github.com/yuhonas/free-exercise-db — licence **The Unlicense** (domaine public).
  Fournit les images de démonstration (déjà utilisées par l'appli, `raw.githubusercontent.com` est autorisé par la CSP)
  et les instructions anglaises de 196 exercices.
- Noms et tutos **français et arabes** : traduits à la main pour IKORUN (`exercises/exdb-steps.js`).
- 26 exercices de **rééducation** et les programmes par zone : rédigés pour IKORUN, sans image externe sauf quand un exercice
  de la base est identique (ex. mollets sur pointes).
- Régénération : télécharger `dist/exercises.json` de free-exercise-db dans `tools/exdb-src/` (non versionné), puis
  `python3 -I tools/exdb-build.py tools/exdb-src exercises/exdb.js` et `node tools/build.mjs`.
  Sources versionnées : `tools/exdb-src/tr/*.tsv` (traductions), `rehab_ex.py` (26 exercices), `rehab_prog.py` (programmes par zone).
