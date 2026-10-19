/* Harnais des générateurs de course et de muscu (V4.8.0).
   Lance la vraie appli dans Chromium (Playwright), puis rejoue des milliers de profils.
   Usage :  node tests/engine-harness.js [robust=2000] [link=300]
   Prérequis : un serveur statique sur http://127.0.0.1:8137 (python3 -m http.server 8137) et playwright installé. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const N = +process.argv[2] || 2000, NL = +process.argv[3] || 300;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route(/vendor\/supabase\.js/, r => r.fulfill({ contentType: 'text/javascript', body: 'window.supabase={createClient:function(){return undefined;}};' }));
  await ctx.route(/vendor\/sb-init\.js/, r => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await ctx.route(/supabase\.co|accounts\.google|githubusercontent|open-meteo/, r => r.abort());
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8137/index.html');
  await page.waitForFunction(() => typeof initApp === 'function' && window.DB_READY); await page.evaluate(() => window.DB_READY); await page.waitForTimeout(2000);
  await page.evaluate(() => { P = { setupDone: true, name: 'T', lang: 'fr', mode: 'dark', theme: 'blue', joinedAt: Date.now() - 9e9 }; PREFS = {}; window.currentUserId = null; });
  await page.evaluate(fs.readFileSync(path.join(__dirname, 'engine-harness.page.js'), 'utf8'));
  const run = (fn, ...a) => page.evaluate(([f, a]) => window.__ENG[f](...a), [fn, a]);
  const out = {};
  out['A. robustesse'] = await run('robust', N, 1);
  out['B. exigence (10 km 32:00, 5 j, 13 sem)'] = await run('demand', 20);
  out['C1. personnalisation course'] = await run('perso');
  out['C3. personnalisation muscu'] = await run('persoStrength');
  out['D. course ↔ muscu'] = await run('link', NL);
  out.erreursJS = errs.slice(0, 5);
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
