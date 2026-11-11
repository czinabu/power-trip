// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CALLOUT SMOKE TEST — boots the BUILT game (dist/index.html) and checks the floating words (fx/floaters.js, data/callouts.js):
//   · the ranking: a parry and a beaten guard are DECISIVE, a foe's feint KEY, a move's name ROUTINE, the rest NOTICE;
//   · one word is up at a time: a higher rank takes the floor at once, the same rank once the first has been read,
//     a lower one waits its turn, a MINOR one is dropped; damage numbers go through untouched;
//   · a ROUTINE word is shown CALL.teach times, then left to the blade (and still shown in training);
//   · the ranking only quiets the Jedi: for a gunner a ROUTINE word still shows.
// Fails on any page or console error.   npm run build && npm run smoke:words

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) failed = true; };
const errors = [];

async function boot(hero, training){
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
  await page.evaluate(h => document.getElementById('hero-' + h).click(), hero);
  await page.waitForTimeout(500);
  if (training){ await page.$eval('#mode-training', el => el.click()); await page.click('#goText'); }
  else {   // (as tools/smoke/cpu.mjs: past the opening panels and into play)
    await page.evaluate(() => GAME.startSandbox());
    await page.evaluate(async () => { for (let i = 0; i < 30; i++){ const { G } = GAME; if (GAME.cutscene.sceneOn()) GAME.cutscene.skipScene(); G.mode = 'play'; G.paused = false; G.skillSelect = false; await new Promise(r => requestAnimationFrame(r)); } });
  }
  await page.waitForFunction((t) => GAME.G.mode === 'play' && !!GAME.G.training === t, training, { timeout: 60000 });
  await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.style.display = 'none'; GAME.G.sandboxGod = true; GAME.G.pitch = 0; });
  await page.waitForTimeout(1500);
  // the words are said at the hero, who is always in view
  await page.evaluate(() => {
    const W = GAME.words, P = () => GAME.player.group.position;
    window.say = (t, kind) => { W.say(P(), t, '#fff', kind); return W.up(); };
    window.big = (t) => { W.big(P(), t, '#fff'); return W.up(); };
    W.clear();
  });
  return page;
}
const wait = (page, s) => page.waitForTimeout(s * 1000);

try {
  /* ---- the Jedi, in the sandbox ---- */
  const page = await boot('jedi', false);
  const C = await page.evaluate(() => GAME.words.cfg);
  const tiers = await page.evaluate(() => Object.fromEntries(['PARRY! ⟲ RIPOSTE READY', 'WRONG SIDE', 'FEINT', 'CLEAN BLOCK', 'RIPOSTE!', 'POLE VAULT', 'FLOW ×3', 'BLOCK', 'CHARGE SET', 'IN COVER · FLANK HIM']
    .map(t => [t, GAME.words.rank(t).tier])));
  check(tiers['PARRY! ⟲ RIPOSTE READY'] === 4 && tiers['WRONG SIDE'] === 4, 'a parry and a beaten guard are DECISIVE');
  check(tiers['FEINT'] === 3 && tiers['CLEAN BLOCK'] === 3 && tiers['IN COVER · FLANK HIM'] === 3, 'a feint, a clean block and an instruction are KEY');
  check(tiers['CHARGE SET'] === 2 && tiers['RIPOSTE!'] === 1, 'an unlisted word is a NOTICE, a confirmation MINOR');
  check(tiers['POLE VAULT'] === 0 && tiers['FLOW ×3'] === 0 && tiers['BLOCK'] === 0, 'a move\'s name and a plain block are ROUTINE');

  check(await page.evaluate(() => say('CHARGE SET')) === 'CHARGE SET', 'a word shows when nothing is up');
  check(await page.evaluate(() => say('FEINT')) === 'FEINT', 'a higher rank takes the floor at once');
  check(await page.evaluate(() => say('CHARGE SET')) === 'FEINT' && await page.evaluate(() => GAME.words.stats().waiting) === 'CHARGE SET', 'a lower one waits its turn');
  check(await page.evaluate(() => say('RIPOSTE!')) === 'FEINT' && await page.evaluate(() => GAME.words.stats().waiting) === 'CHARGE SET', 'a MINOR one is dropped while a word is up');
  check(await page.evaluate(() => { GAME.words.say(GAME.player.group.position, 41, '#fff'); return GAME.words.up(); }) === 'FEINT', 'a damage number goes through beside the word');
  check(await page.waitForFunction(() => GAME.words.up() === 'CHARGE SET', null, { timeout: 2000, polling: 20 }).then(() => true, () => false), 'the waiting word is said when the first is done');
  await wait(page, C.word + 0.15);
  check(await page.evaluate(() => GAME.words.up()) === '', 'and then the floor is clear');

  check(await page.evaluate(() => big('WRONG SIDE')) === 'WRONG SIDE' && await page.evaluate(() => big('PARRY! ⟲ RIPOSTE READY')) === 'WRONG SIDE', 'a word of the same rank waits until the first is read');
  await wait(page, C.minRead + 0.1);
  check(await page.evaluate(() => GAME.words.up()) === 'PARRY! ⟲ RIPOSTE READY', 'then takes its place');
  await wait(page, C.big + 0.1);

  // a burst: the two seconds of a duel that used to put a dozen words up
  const most = await page.evaluate(async () => {
    const T = [[0, 'CLEAN BLOCK'], [60, 'FLUID RIPOSTE'], [200, 'RIPOSTE!'], [300, 'PERFECT STRING'], [360, 'FOCUSED'], [450, 'EXCHANGE ×2'], [600, 'FEINT'], [820, 'WRONG SIDE'],
      [900, 'BLOCK'], [1000, 'SLIDE CUT'], [1150, 'SLIPPED'], [1450, 'PARRIED'], [1600, 'PARRY! ⟲ RIPOSTE READY'], [1800, 'RIPOSTE!']];
    for (const [t, w] of T) setTimeout(() => say(w), t);
    let most = 0; const t0 = performance.now();
    // (a word is "up" from when it is said until its slot ends: count the pooled divs holding a live word)
    await new Promise(res => { const iv = setInterval(() => {
      const up = GAME.words.up(), live = [...document.querySelectorAll('#hud .fl.word, #hud .fl.call')].filter(d => d.style.transition === 'none' && d.style.opacity === '1').length;
      most = Math.max(most, Math.max(up ? 1 : 0, live)); if (performance.now() - t0 > 2600){ clearInterval(iv); res(); } }, 20); });
    return most;
  });
  check(most === 1, 'through a two-second exchange of fourteen callouts, one word is up at a time (most: ' + most + ')');
  await wait(page, 0.6);

  // ROUTINE: named CALL.teach times, then left to the blade
  const said = [];
  for (let i = 0; i < C.teach + 2; i++){ said.push(await page.evaluate(() => say('POLE VAULT'))); await wait(page, C.word + 0.1); }
  check(said.slice(0, C.teach).every(s => s === 'POLE VAULT') && said.slice(C.teach).every(s => s === ''), 'a move is named ' + C.teach + ' times, then the blade says it (' + said.map(s => s || '·').join(' ') + ')');
  check(await page.evaluate(() => GAME.words.stats().quiet) === 2, 'the quiet ones are counted, and their cue raised no error');
  check(await page.evaluate(() => say('HIGH BIND', 'key')) === 'HIGH BIND', 'a call site can rank a label built from data');
  await page.close();

  /* ---- training keeps the names ---- */
  const tr = await boot('jedi', true);
  const kept = [];
  for (let i = 0; i < 4; i++){ kept.push(await tr.evaluate(() => say('POLE VAULT'))); await wait(tr, C.word + 0.1); }
  check(kept.every(s => s === 'POLE VAULT'), 'in training a move is named every time');
  await tr.close();

  /* ---- a gunner is not quieted ---- */
  const mando = await boot('mando', false);
  const m = [];
  for (let i = 0; i < 4; i++){ m.push(await mando.evaluate(() => say('BOWLED'))); await wait(mando, C.word + 0.1); }
  check(m.every(s => s === 'BOWLED'), 'the Mandalorian\'s BOWLED still shows every time');
  check(await mando.evaluate(() => say('ROCKET')) === 'ROCKET' && await mando.evaluate(() => say('HEADSHOT')) === 'ROCKET', 'but his words are one at a time too');
  await mando.close();
} catch(e){ check(false, e.message); }
for (const e of errors) check(false, e);
await browser.close();
process.exit(failed ? 1 : 0);
