// IKORUN — construction des fichiers servis
// ============================================================================
// Les fichiers .js / .css des dossiers (app.js, plan/adapt.js, weather/…) sont LES SOURCES :
// on les lit, on les modifie, on les commente. La page charge leurs versions assemblées et
// minifiées, produites ici d'après tools/bundle.json :
//   · app.min.js : le cœur, toutes ses sources mises bout à bout dans un seul script classique
//     (elles partagent le même environnement global, comme quand tout était dans app.js) ;
//   · app.min.css : la feuille de style ;
//   · les modules chargés à la demande (scène météo, image de partage, courses…), un fichier chacun.
// Commentaires et espaces retirés, noms de variables LOCALES raccourcis. Les noms de premier niveau
// (fonctions appelées par les onclick, P, SESS, I18N…) sont gardés : la suite de fumée en dépend.
//
// Utilisation (une fois : cd tools && npm install) :   node tools/build.mjs
// Le garde-fou de commit (.githooks/pre-commit) refuse un fichier servi qui ne correspond plus
// à ses sources : l'empreinte des sources assemblées est écrite en tête (sha:…).
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'tools', 'package.json'));
const esbuild = require('esbuild');

const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const version = (readFileSync(join(ROOT, 'app.js'), 'utf8').match(/const APP_VERSION='([^']+)'/) || [])[1] || '?';
const bundle = JSON.parse(readFileSync(join(ROOT, 'tools', 'bundle.json'), 'utf8'));
// Même assemblage que le garde-fou de commit (sources séparées par un saut de ligne).
export const assemble = srcs => srcs.map(s => readFileSync(join(ROOT, s), 'utf8')).join('\n');

let fail = 0;
for (const [out, srcs] of Object.entries(bundle)) {
  if (out === '_') continue;
  const loader = out.endsWith('.css') ? 'css' : 'js';
  const code = assemble(srcs);
  let r;
  try {
    r = esbuild.transformSync(code, {
      loader, minify: true, charset: 'utf8', legalComments: 'none',
      // syntaxe laissée telle quelle (iOS 15+ la lit déjà) : rien n'est réécrit, seulement compacté
      target: 'esnext', logLevel: 'error',
    });
  } catch (e) { console.error('ERREUR dans', srcs.join(' + '), '\n', e.message); fail = 1; continue; }
  const head = '/*! IKORUN ' + version + ' · ' + out + ' construit depuis ' + srcs.join('+') + ' sha:' + sha(code) +
    ' · NE PAS MODIFIER : éditer les sources puis lancer node tools/build.mjs */\n';
  writeFileSync(join(ROOT, out), head + r.code);
  console.log(out.padEnd(24), (code.length / 1024).toFixed(0).padStart(5), 'Ko →', ((head + r.code).length / 1024).toFixed(0).padStart(5), 'Ko', srcs.length > 1 ? '(' + srcs.length + ' sources)' : '');
}
process.exit(fail);
