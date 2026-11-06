// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// EVERY CHAPTER'S OPENING, one still each, on the BUILT game: for each chapter of a hero's story, its card's BEGIN, a
// frame from the scene on set (or the objective, where there's no talk), then a skip. Logs the shots and any page error.
// node tools/shots/cutscene-tour.mjs <out dir> <hero: jedi|mando|trooper> [chapter ids, comma-separated: all]
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [out, hero = 'jedi', only = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => { try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('x', 'NotSupportedError')); }; });
await page.goto(pathToFileURL(root + '/dist/index.html').href + (hero === 'trooper' ? '?trooper' : ''));
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
await page.$eval('#hero-' + hero, el => el.click()); await page.$eval('#mode-campaign', el => el.click());
for (let i = 0; i < 8 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
  if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(800);
}
await page.waitForSelector('#chapcard.open', { timeout: 30000 });
const ids = only ? only.split(',') : await page.evaluate(() => GAME.chapters().map(c => c.id));
for (const ch of ids){
  const e0 = errors.length;
  await page.evaluate((ch) => { if (GAME.G.cutscene) GAME.cutscene.skipScene(); document.getElementById('chapcard').classList.remove('open'); GAME.G.cardUp = false; GAME.startChapter(GAME.chapters().findIndex(c => c.id === ch)); }, ch);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); });
  const shots = [];
  let shotted = false;
  for (let i = 0; i < 90; i++){
    const st = await page.evaluate(() => GAME.G.cutscene ? GAME.cutscene.shotInfo() : '');
    if (!st) break;
    const kind = st.split(':')[1];
    if (!shots.length || shots[shots.length - 1] !== st.split(' lens')[0]) shots.push(st.split(' lens')[0]);
    if (!shotted && (kind === 'close' || (kind === 'goal' && i > 3))){ await page.waitForTimeout(900); await page.screenshot({ path: out + '/' + hero + '-' + ch + '.png' }); shotted = true; break; }
    await page.waitForTimeout(250);
  }
  if (!shotted) await page.screenshot({ path: out + '/' + hero + '-' + ch + '.png' });
  console.log(ch.padEnd(14), shots.join(' | '), errors.length > e0 ? ' ERRORS: ' + errors.slice(e0).join(' / ') : '');
}
await browser.close();
