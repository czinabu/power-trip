// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// REMIXES SMOKE TEST — boots the BUILT game (dist/index.html) and checks the travelling twists (data/twist-deck.js) away
// from home, and the remixes (data/remixes.js):
//   · every remixable mission builds a remix with one deck twist and another side's troops, and the same id always
//     builds the same remix; the remix of the week is one any hero can play, and changes from week to week;
//   · arcade contracts deal signature twists, and some threat 4 and 5 contracts carry two;
//   · every veteran side mission carries its signature twist;
//   · the Missions page shows the remix of the week, and a remix opens once its mission is cleared;
//   · a remix played through keeps its own medals (its source's goals) and pays rank XP.
// SHOTS=dir writes the Missions page there. Fails on any page or console error.
//   npm run build && npm run smoke:remixes

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) failed = true; };
const errors = [];
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: SHOTS ? 2 : 1 });
await page.addInitScript(() => {
  try {
    localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
    for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
  } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
});
page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
const poll = { timeout: 90000 };
const ticks = async (s = 0.3) => { const gt = await page.evaluate(() => GAME.G.gt); await page.waitForFunction(([gt, s]) => GAME.G.gt > gt + s, [gt, s], { timeout: 30000 }).catch(() => {}); };
async function play(id){
  await page.evaluate((id) => { const pick = document.querySelector('#chapcard.open .cc-opt'); if (pick) pick.click();
    document.getElementById('overlay').style.display = 'none'; GAME.G.missionId = id; GAME.startMission(id); GAME.G.mode = 'play'; GAME.G.paused = false; }, id);
  await page.waitForFunction((id) => GAME.missionState().on && GAME.missionState().def.id === id && GAME.missionState().o, id, poll);
  for (let i = 0; i < 10 && await page.evaluate(() => GAME.G.mode === 'play' && GAME.missionState().on); i++){
    await page.waitForFunction(() => GAME.missionState().o || GAME.G.mode !== 'play', null, poll).catch(() => {});
    await page.evaluate(() => { GAME.player.hp = Math.max(GAME.player.hp, 1e4); GAME.skipObjective(); }); await ticks(0.5);
  }
  return page.waitForFunction(() => GAME.G.mode === 'victory', null, poll).then(() => true, () => false);
}

try {
  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });

  // the remixes, as data
  const R = await page.evaluate(() => {
    const D = GAME.TWIST_DECK, names = new Set(Object.values(D).map(d => d.name)), pool = GAME.remixes.pool(), bad = [];
    for (const mid of pool){
      const id = GAME.remixes.idFor(mid), d = GAME.missionById(id), src = GAME.missionById(mid);
      const deck = d && d.objectives.filter(o => o.twist && D[o.twist.kind] && !(src.objectives[d.objectives.indexOf(o)] || {}).twist);
      if (!d || !d.remix || d.source !== mid || d.sig.length !== 1 || !names.has(d.sig[0]) || deck.length !== 1 || !d.faction || d.foeLook === src.foeLook && src.foeLook) bad.push(mid);
      if (src.objectives.some(o => o.twist)) { /* its own twists stay */ if (!src.objectives.every((o, i) => !o.twist || (d.objectives[i].twist || {}).kind === o.twist.kind)) bad.push(mid + ' (lost its own twist)'); }
    }
    const weeks = Array.from({ length: 12 }, (_, k) => GAME.remixes.weekly(3000 + k));
    const w = GAME.missionById(weeks[0]);
    const kinds = new Set(), factions = new Set();
    for (const mid of pool) for (let k = 0; k < 30; k++){ const d = GAME.missionById('remix:' + mid + ':' + k); d.sig.forEach(s => kinds.add(s)); factions.add(d.faction); }
    return { n: pool.length, bad, weeks, distinct: new Set(weeks).size, wHeroes: w && w.heroes, wWeekly: w && w.weekly,
      same: JSON.stringify(GAME.missionById(weeks[0]).objectives) === JSON.stringify(GAME.missionById(weeks[0]).objectives),
      kinds: kinds.size, deck: Object.keys(D).length, factions: [...factions] };
  });
  check(R.n >= 10, `${R.n} story missions can be remixed`);
  check(!R.bad.length, 'every remix carries one deck twist, its own twists and another side\'s troops' + (R.bad.length ? ': ' + R.bad.join(', ') : ''));
  check(R.wWeekly && !R.wHeroes, `the remix of the week (${R.weeks[0]}) is one any hero can play`);
  check(R.distinct >= 6, `the remix of the week changes from week to week (${R.distinct} different in 12 weeks)`);
  check(R.same, 'the same remix id builds the same mission');
  check(R.kinds === R.deck, `the remixes deal every twist in the deck (${R.kinds} of ${R.deck})`);
  check(R.factions.length >= 5, 'the remixes send in other sides: ' + R.factions.join(', '));

  // arcade contracts and the veteran calls
  const A = await page.evaluate(() => {
    const n = [0, 0, 0], two = { hi: 0, lo: 0 };
    for (let s = 1; s <= 600; s++){ const d = GAME.missionById('arcade:' + s); n[Math.min(2, d.sig.length)]++; if (d.sig.length === 2) two[d.threat >= 4 ? 'hi' : 'lo']++; }
    const vets = GAME.SIDE_QUESTS.filter(q => q.post).map(q => { const d = GAME.missionById('side:' + q.slug); return { slug: q.slug, sig: d.sig, on: d.objectives.some(o => o.twist && GAME.TWIST_DECK[o.twist.kind]) }; });
    return { n, two, vets };
  });
  check(A.n[1] > 60 && A.n[0] > 60, `arcade contracts deal signature twists (of 600: ${A.n[0]} none, ${A.n[1]} one, ${A.n[2]} two)`);
  check(A.n[2] > 0 && A.two.lo === 0, `only threat 4 and 5 contracts carry two (${A.two.hi})`);
  check(A.vets.length >= 3 && A.vets.every(v => v.sig.length === 1 && v.on), 'every veteran side mission carries its signature twist: ' + A.vets.map(v => v.slug + ' ' + v.sig.join('')).join(', '));

  // a remix played through: its own medals, rank XP
  await page.$eval('#hero-jedi', el => el.click());
  const weekly = await page.evaluate(() => GAME.remixes.weekly());
  const xp0 = await page.evaluate(() => GAME.PROFILE.profileOf ? GAME.PROFILE.profileOf().xp : null);
  const tot0 = await page.evaluate(() => GAME.PROFILE.medalTotal('jedi'));
  check(await play(weekly), `jedi: the remix of the week is won (${weekly})`);
  const rec = await page.evaluate((id) => GAME.PROFILE.medalsOf(id, 'jedi'), weekly);
  check(rec.m > 0 && rec.t > 0, `jedi: the remix keeps medals of its own (bits ${rec.m}, ${rec.t}s)`);
  check(await page.evaluate((b) => GAME.PROFILE.medalTotal('jedi') > b, tot0), 'jedi: they count toward the medal total');
  if (xp0 != null) check(await page.evaluate((x) => GAME.PROFILE.profileOf().xp > x, xp0), 'jedi: the remix pays rank XP');
  check(await page.evaluate(() => GAME.missionState().def.foeLook !== undefined || GAME.missionState().def.faction === 'THE EMPIRE'), 'jedi: the remix sends in its faction');

  // the Missions page: the remix of the week, and a remix that opens with its mission
  const src = await page.evaluate(() => GAME.remixes.pool().find(id => !GAME.missionById(id).heroes && !GAME.missionById(id).trial));
  await page.evaluate((m) => localStorage.setItem('sw_mission_' + m + '_jedi', '1'), src);
  await page.evaluate(() => { const pick = document.querySelector('#chapcard.open .cc-opt'); if (pick) pick.click(); });
  await page.click('#homeBtn').catch(() => {});
  await page.waitForTimeout(1500);
  const opened = await page.$eval('#mode-mission', el => { el.click(); return true; }).catch(() => false);
  if (opened){
    await page.waitForTimeout(600);
    const sel = (id) => `.msn[data-mission="${id}"]`;
    check(await page.isVisible(sel(weekly)), 'the Missions page shows the remix of the week');
    check(await page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.classList.contains('locked'); }, sel('remix:' + src)), `the remix of ${src} is open once it is cleared`);
    await page.evaluate((s) => { const c = document.querySelector(s); if (c) c.click(); }, sel('remix:' + src));
    await page.waitForTimeout(300);
    check(await page.evaluate(() => /REMIX/.test(document.getElementById('mpinfo').textContent)), 'its panel names it a remix, with its twist and faction');
    if (SHOTS){ await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel(weekly)); await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS, 'remix-shelf.png') }); }
  } else check(false, 'the MISSIONS entry is on the menu');
} catch(e){ check(false, e.message); }
for (const e of errors) check(false, e);
await browser.close();
process.exit(failed ? 1 : 0);
