// IKORUN — construction des fichiers servis (V3.14.0)
// ============================================================================
// app.js et app.css restent LES SOURCES : on les lit, on les modifie, on les commente.
// La page charge leurs versions minifiées, app.min.js et app.min.css, produites ici :
// commentaires et espaces retirés, noms de variables LOCALES raccourcis. Les noms de
// premier niveau (fonctions appelées par les onclick, P, SESS, I18N…) sont gardés
// tels quels : la suite de fumée et les gestionnaires d'événements en dépendent.
//
// Mesuré le 11/10 : app.js 413 → 304 Ko compressés (−26 %), app.css 89 → 56 Ko (−37 %).
//
// Utilisation (une fois : cd tools && npm install) :   node tools/build.mjs
// Le garde-fou de commit (.githooks/pre-commit) refuse un app.min.* qui ne
// correspond plus à sa source : l'empreinte de la source est écrite en tête.
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

for (const [src, out, loader] of [['app.js', 'app.min.js', 'js'], ['app.css', 'app.min.css', 'css']]) {
  const code = readFileSync(join(ROOT, src), 'utf8');
  const r = esbuild.transformSync(code, {
    loader, minify: true, charset: 'utf8', legalComments: 'none',
    // syntaxe laissée telle quelle (iOS 15+ la lit déjà) : rien n'est réécrit, seulement compacté
    target: 'esnext', logLevel: 'error',
  });
  const head = '/*! IKORUN ' + version + ' · ' + out + ' construit depuis ' + src + ' sha:' + sha(code) +
    ' · NE PAS MODIFIER : éditer ' + src + ' puis lancer node tools/build.mjs */\n';
  writeFileSync(join(ROOT, out), head + r.code);
  console.log(src.padEnd(8), (code.length / 1024).toFixed(0).padStart(5), 'Ko →', out.padEnd(12), ((head + r.code).length / 1024).toFixed(0).padStart(5), 'Ko');
}
