// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MISSION MEDALS SMOKE TEST — boots the BUILT game (dist/index.html) and checks the medals (data/medals.js, game/medals.js):
//   · every story and side mission has a par time and a bonus goal that fits it, for every hero (PARS=1 prints them all);
//   · a mission played through takes CLEAR, PAR and BONUS, keeps them on the hero's profile with its best time, and the
//     results screen shows the three;
//   · a goal missed (the quarry got away) loses the bonus but keeps the rest; a retry keeps the clock running;
//   · the Missions page card shows the medals and its panel the three goals;
//   · an arcade contract shows its medals on the results screen but keeps none.
// SHOTS=dir writes the results screen and the Missions page there. Fails on any page or console error.
//   npm run build && npm run smoke:medals

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
async function play(id, during){
  await page.evaluate((id) => { const pick = document.querySelector('#chapcard.open .cc-opt'); if (pick) pick.click();
    document.getElementById('overlay').style.display = 'none'; GAME.G.missionId = id; GAME.startMission(id); GAME.G.mode = 'play'; GAME.G.paused = false; }, id);
  await page.waitForFunction((id) => GAME.missionState().on && GAME.missionState().def.id === id && GAME.missionState().o, id, poll);
  if (during) await during();
  for (let i = 0; i < 10 && await page.evaluate(() => GAME.G.mode === 'play' && GAME.missionState().on); i++){
    await page.waitForFunction(() => GAME.missionState().o || GAME.G.mode !== 'play', null, poll).catch(() => {});
    await page.evaluate(() => { GAME.player.hp = Math.max(GAME.player.hp, 1e4); GAME.skipObjective(); }); await ticks(0.5);
  }
  return page.waitForFunction(() => GAME.G.mode === 'victory', null, poll).then(() => true, () => false);
}

try {
  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });

  // every mission's par and goal, for every hero who plays it
  const rows = await page.evaluate(() => {
    const D = GAME.MEDAL_DATA, out = [];
    for (const [id, def] of Object.entries(GAME.missionDefs())){
      if (def.raid || def.arcade) continue;
      for (const h of ['jedi', 'mando', 'trooper']){
        if (def.heroes && !def.heroes.includes(h)) continue;
        const b = D.bonusOf(def, h);
        out.push({ id, h, par: D.parTime(def, h), bonus: b, fits: D.BONUS[b].fits(def), own: !!(def.side ? D.SIDE_MEDALS[id] : D.MISSION_MEDALS[id]) });
      }
    }
    return out;
  });
  check(rows.length > 40, `par times and goals for ${rows.length} mission/hero pairs`);
  check(rows.every(r => r.par >= 60 && r.par <= 1800), 'every par time is between 1 and 30 minutes' + (rows.filter(r => !(r.par >= 60 && r.par <= 1800)).map(r => ' ' + r.id + ':' + r.par).join('')));
  check(rows.every(r => r.fits), 'every bonus goal fits its mission');
  check(rows.filter(r => !r.id.startsWith('side:')).every(r => r.own), 'every story mission has a goal of its own (data/medals.js MISSION_MEDALS)');
  if (process.env.PARS) for (const r of rows) console.log('   ' + r.id.padEnd(22) + r.h.padEnd(8) + String(Math.floor(r.par / 60) + ':' + String(r.par % 60).padStart(2, '0')).padEnd(7) + r.bonus);

  // a clean run: all three, kept, with the best time
  await page.$eval('#hero-jedi', el => el.click());
  check(await play('refuge'), 'jedi: the Last Evacuation is won');
  const rec = await page.evaluate(() => GAME.PROFILE.medalsOf('refuge', 'jedi'));
  check(rec.m === 7, `jedi: all three medals are kept on the profile (bits ${rec.m})`);
  check(rec.t > 0, `jedi: the best time is kept (${rec.t}s)`);
  await page.waitForFunction(() => document.querySelectorAll('#runsummary .rs-medal').length === 3, null, { timeout: 15000 }).catch(() => {});
  check(await page.evaluate(() => document.querySelectorAll('#runsummary .rs-medal.on').length === 3), 'jedi: the results screen shows the three medals won');
  check(await page.evaluate(() => document.querySelectorAll('#runsummary .rs-medal em').length === 3), 'jedi: ...each marked NEW');
  if (SHOTS){ await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, 'results-all-three.png') }); }
  check(await page.evaluate(() => GAME.PROFILE.medalTotal('jedi') === 3), 'jedi: the medal total is 3');

  // a goal missed: the quarry got away once, so the chase keeps its clear and par but not its bonus; the retry kept the clock
  check(await play('pursuit', async () => {
    await page.evaluate(() => GAME.MEDALS.medalNote('chase'));
    const t0 = await page.evaluate(() => GAME.MEDALS.medalsState().time);
    await page.evaluate(() => GAME.startMission('pursuit', 0, false, { retry: true }));
    await ticks(0.5);
    const st = await page.evaluate(() => GAME.MEDALS.medalsState());
    check(st.missed.includes('chase') && st.time >= t0, `jedi: a retry keeps the count and the clock (${st.time.toFixed(1)}s ≥ ${t0.toFixed(1)}s)`);
  }), 'jedi: the Long Chase is won');
  const rec2 = await page.evaluate(() => GAME.PROFILE.medalsOf('pursuit', 'jedi'));
  check(rec2.m === 3, `jedi: clear and par kept, the missed bonus not (bits ${rec2.m})`);
  await page.waitForFunction(() => document.querySelectorAll('#runsummary .rs-medal').length === 3, null, { timeout: 15000 }).catch(() => {});
  check(await page.evaluate(() => document.querySelector('#runsummary .rs-medal.bonus:not(.on)') !== null), 'jedi: the results screen shows the bonus missed');
  if (SHOTS){ await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, 'results-bonus-missed.png') }); }

  // a fall: a retry after going down misses "win without falling"
  await page.evaluate(() => { GAME.G.mode = 'play'; });
  check(await play('forge', async () => { await page.evaluate(() => GAME.MEDALS.medalNote('fell')); }), 'jedi: the Mustafar Forge is won');
  check((await page.evaluate(() => GAME.PROFILE.medalsOf('forge', 'jedi'))).m === 3, 'jedi: a fall loses the forge\'s deathless bonus');

  // an arcade contract: shown, not kept
  const before = await page.evaluate(() => GAME.PROFILE.medalTotal('jedi'));
  const arc = await page.evaluate(() => GAME.arcadeId ? GAME.arcadeId() : null);
  if (arc){
    check(await play(arc), 'jedi: an arcade contract is won');
    await page.waitForFunction(() => document.querySelectorAll('#runsummary .rs-medal').length === 3, null, { timeout: 15000 }).catch(() => {});
    check(await page.evaluate(() => !!document.querySelector('#runsummary .rs-medal-note')), 'jedi: the contract shows its medals and says it keeps none');
    check(await page.evaluate((b) => GAME.PROFILE.medalTotal('jedi') === b, before), 'jedi: the contract adds nothing to the medal total');
  }

  // the Missions page: the card's pips and the panel's goals
  await page.evaluate(() => { const pick = document.querySelector('#chapcard.open .cc-opt'); if (pick) pick.click(); });
  await page.click('#homeBtn').catch(() => {});
  await page.waitForTimeout(1500);
  const opened = await page.$eval('#mode-mission', el => { el.click(); return true; }).catch(() => false);
  if (opened){
    await page.waitForTimeout(600);
    await page.evaluate(() => { const c = document.querySelector('.msn[data-mission="refuge"]'); if (c) c.click(); });
    await page.waitForTimeout(300);
    check(await page.evaluate(() => document.querySelectorAll('.msn[data-mission="refuge"] .mmedals i.on').length === 3), 'the Missions page card shows the refuge\'s three medals');
    check(await page.evaluate(() => document.querySelectorAll('#mpinfo .mpi-medal').length === 3 && /BEST TIME/.test(document.getElementById('mpinfo').textContent)), 'the panel lists the three goals and the best time');
    check(await page.isVisible('#mpinfo .mpi-medals'), 'the Missions page is up, its goals on screen');
    if (SHOTS){ await page.evaluate(() => document.querySelector('.msn[data-mission="refuge"]').scrollIntoView({ block: 'center' })); await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS, 'missions-page.png') }); }
  } else check(false, 'the MISSIONS entry is on the menu');
} catch(e){ check(false, e.message); }
for (const e of errors) check(false, e);
await browser.close();
process.exit(failed ? 1 : 0);
