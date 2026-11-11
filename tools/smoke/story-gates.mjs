// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STORY GATES SMOKE — nothing past the hero's own story, in any mode that plays away from the campaign:
//   · a side mission waits for its campaign chapter (data/side-quests.js `after`), cleared in this hero's own story: none
//     is open on a fresh save, the first opens at the close of Act I, and A NAME IN THE LEDGER (the Padawan) after THE PENS
//   · a lone mission (a story mission off the list, a side mission, an arcade contract) hands out the story's kit and
//     nothing past it: no Force Pull before the siege, no Jump Attack or Saber Throw before the chapters that teach them,
//     however generous the mission's own kit (game/zone-gate.js loneMission)
//   · beaten, the campaign opens every side mission and the lone missions' whole kit again
//   npm run build && node tools/smoke/story-gates.mjs

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const check = (ok, what) => { if (!ok){ console.error('FAIL: ' + what); process.exitCode = 1; } else console.log('ok: ' + what); };

const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
await page.addInitScript(() => {
  try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
});
await page.goto(url);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
await page.waitForTimeout(1000);

// the story so far, for a hero: the chapter slots cleared (game/wardrobe.js chapterEarned reads them), or the campaign beaten
const story = (hero, chapters, beaten = false) => page.evaluate(([hero, chapters, beaten]) => {
  localStorage.setItem('sw_camp_ch_' + hero, JSON.stringify(chapters));
  if (beaten) localStorage.setItem('sw_camp_' + hero, '1'); else localStorage.removeItem('sw_camp_' + hero);
  GAME.G.hero = hero;
}, [hero, chapters, beaten]);
const locks = () => page.evaluate(() => Object.fromEntries(GAME.SIDE_QUESTS.filter(q => !q.post).map(q => [q.slug, GAME.PROFILE.sideLock(q)])));
// start a lone mission and read back what it put in hand
const kitIn = (id) => page.evaluate((id) => {
  document.getElementById('overlay').style.display = 'none';
  GAME.G.chapter = -1; GAME.G.missionId = id; GAME.G.modeSel = 'mission'; GAME.G.missionForms = null; GAME.G.missionKit = null;
  GAME.startMission(id); GAME.G.mode = 'play'; GAME.G.paused = false;
  const u = GAME.G.unlocked || {};
  return { pull: !!u.pull, slam: !!u.slam, throw: !!u.throw, forms: Object.keys(GAME.G.stanceUnlocked || {}).filter(k => GAME.G.stanceUnlocked[k]), lv: GAME.G.forceLevel };
}, id);

// A FRESH SAVE: nothing open, and the lone missions hand out the starting kit only
await story('jedi', []);
let L = await locks();
check(Object.values(L).every(Boolean), 'a fresh save opens no side mission ' + JSON.stringify(L));
check(/^CLEAR /.test(L['forest-shrine']), 'the first side mission asks for a chapter first (' + L['forest-shrine'] + ')');
let k = await kitIn('holdfast');
check(!k.pull && !k.slam && !k.throw, 'a story mission with a big kit hands out no power a fresh story hasn\'t given ' + JSON.stringify(k));
check(k.forms.length === 0, 'and no form past Form I ' + JSON.stringify(k.forms));
k = await kitIn('side:ledger-child');
check(!k.pull && !k.slam, 'a side mission the same ' + JSON.stringify(k));
k = await kitIn(await page.evaluate(() => GAME.arcadeId()));
check(!k.pull && !k.slam && !k.throw, 'an arcade contract the same ' + JSON.stringify(k));

// PAST THE SIEGE: Force Pull, still no Jump Attack; Act I done: the first side mission opens, the Ledger still waits
await story('jedi', ['last-lesson', 'siege', 'archive', 'refuge', 'trial-first']);
k = await kitIn('holdfast');
check(k.pull && !k.slam, 'after the siege a mission hands over Force Pull, and still no Jump Attack ' + JSON.stringify(k));
L = await locks();
check(!L['forest-shrine'], 'the close of Act I opens THE FOREST SHRINE');
check(/^CLEAR /.test(L['ledger-child']), 'A NAME IN THE LEDGER still waits (' + L['ledger-child'] + ')');
check(await page.evaluate(() => /campaign/i.test(GAME.PROFILE.sideLockLine(GAME.SIDE_QUESTS.find(q => q.slug === 'ledger-child')))), 'its locked line says where in the campaign');

// PAST THE PENS: the Ledger (and the Padawan with it) opens
await story('jedi', ['last-lesson', 'siege', 'archive', 'refuge', 'trial-first', 'lothal']);
L = await locks();
check(!L['ledger-child'], 'THE PENS opens A NAME IN THE LEDGER');
k = await kitIn('side:ledger-child');
check(k.pull && !k.slam, 'still no Jump Attack before Sera Quill\'s trial ' + JSON.stringify(k));

// THE OTHER HEROES go by their own story: a Mando save that has done the pens doesn't open the Jedi's
await story('mando', ['siege', 'archive', 'refuge', 'trial-first', 'lothal']);
await story('jedi', []);
L = await locks();
check(!!L['ledger-child'], 'another hero\'s story opens nothing for this one');
await story('mando', []);
L = await locks();
check(/^CLEAR /.test(L['forest-shrine']), 'the Mando\'s side missions wait the same (' + L['forest-shrine'] + ')');

// BEATEN: everything open, and the mission's whole kit
await story('jedi', [], true);
L = await locks();
check(Object.entries(L).every(([s, l]) => !l || /^REACH /.test(l)), 'a beaten campaign opens every side mission (a rank aside) ' + JSON.stringify(L));
k = await kitIn('holdfast');
check(k.pull && k.slam && k.throw, 'and a mission hands over its whole kit ' + JSON.stringify(k));

check(!errors.length, 'no page or console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
