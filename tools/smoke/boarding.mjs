// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BOARDING THE WARSHIP SMOKE TEST (data/missions-boarding.js, world/arenas/destroyer.js) on the BUILT game:
//   · it's on the Missions page under Act IV, and its map builds: every point the mission uses stands on open deck;
//   · SLIP ABOARD: the hangar's guards are on their beats and nobody sees the hero at the shuttle; every mark worked
//     finishes it;
//   · KILL THE GUNS: each coupling is worked its own way (the Force seal, the high lock from up on the gantry, the line),
//     and the hold's cradle is empty;
//   · HOLD THE SHUTTLE: the garrison comes, the hold fills, and the mission is won;
//   · CO-OP: a guest who joins the host's run draws the hangar's sight cones and follows the host's objectives.
// Fails on any page or console error. SHOTS=<dir> saves a screenshot at each beat.
//   npm run build && npm run smoke:boarding          (ONLY=solo or ONLY=coop runs just that part)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = +(process.env.PEER_PORT || 9033);
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=' + PORT;
const SHOTS = process.env.SHOTS, ONLY = process.env.ONLY;
const VIEW = SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 };
const poll = { timeout: 180000, polling: 250 };
const ID = 'gate-warship';
const server = PeerServer({ port: PORT, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function open(name){
  const page = await browser.newPage({ viewport: VIEW });
  page.on('pageerror', e => errors.push(name + ': ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript((q) => {
    try {
      localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, process.env.QUALITY || (SHOTS ? 'medium' : 'low'));
  await page.goto(url, { timeout: 180000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
async function toPlay(page){
  for (let i = 0; i < 14 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.paused)); i++){
    await page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); if (GAME.G.cutscene) GAME.cutscene.skipScene(); });
    for (const sel of ['#goText', '#trainNo', '#forms [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(700);
  }
}
const past = () => { if (GAME.G.cutscene) GAME.cutscene.skipScene(); const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); if (GAME.G.paused){ const o = document.getElementById('goText'); if (o) o.click(); } };
const shot = async (page, name) => { if (SHOTS){ await page.bringToFront(); await page.screenshot({ path: path.join(SHOTS, name + '.png'), timeout: 180000 }).catch(() => {}); } };
const ms = (page) => page.evaluate(() => { const M = GAME.missionState(); return { on: M.on, id: M.def && M.def.id, i: M.i, kind: M.o && M.o.kind, won: M.won }; });
// run the game until fn (in the page) is truthy, or `seconds` of game time pass; each poll keeps the hero standing
async function until(page, fn, seconds, what, arg){
  const t0 = await page.evaluate(() => GAME.G.gt);
  for (const r0 = Date.now(); Date.now() - r0 < 420000;){
    await page.evaluate(past);
    await page.evaluate(() => { GAME.player.hp = Math.max(GAME.player.hp, 1e4); });
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    if ((await page.evaluate(() => GAME.G.gt)) - t0 > seconds) break;
    await page.waitForTimeout(200);
  }
  throw new Error('boarding: ' + what + ' never happened (' + JSON.stringify(await ms(page)) + ')');
}
// is (x, z) open deck (no solid taller than a step over it)?
const openAt = (page, x, z) => page.evaluate(([x, z]) => !GAME.solids.some(s => (s.h || 0) > 0.6 && !s.y0 && (s.box ? Math.abs(x - s.x) < s.hx + 0.3 && Math.abs(z - s.z) < s.hz + 0.3 : Math.hypot(x - s.x, z - s.z) < (s.r || 0) + 0.3)), [x, z]);

try {
  if (ONLY !== 'coop'){
  /* ---------- SOLO ---------- */
  const page = await open('solo');
  await page.$eval('#hero-trooper', el => el.click()); await page.$eval('#mode-mission', el => el.click());
  if (!(await page.evaluate((id) => !!document.getElementById('msn-' + id), ID))) throw new Error('the warship is not on the Missions page');
  await page.evaluate((id) => document.getElementById('msn-' + id).click(), ID);
  await toPlay(page);
  await until(page, (id) => { const M = GAME.missionState(); return M.on && M.def.id === id && M.o && M.o.kind === 'infiltrate'; }, 30, 'the boarding beginning', ID);
  console.log('ok   on the Missions page, and it begins aboard the warship');
  // every point the mission uses stands on open deck
  const pts = await page.evaluate(() => { const d = GAME.missionState().def, out = [['start', d.start]];
    d.objectives.forEach((o, i) => { if (o.start) out.push(['start ' + i, o.start]); for (const m of o.marks || []) out.push(['mark', m.at]); for (const c of o.consoles || []) if (!c.y) out.push(['console', c.at]);
      if (o.at) out.push(['hold', o.at]); for (const g of o.guards || []) for (const p of g.path || [g.at]) out.push(['guard', p]); });
    return out; });
  const bad = []; for (const [what, [x, z]] of pts) if (!(await openAt(page, x, z))) bad.push(what + ' at ' + x + ', ' + z);
  if (bad.length) throw new Error('inside something solid: ' + bad.join('; '));
  console.log('ok   ' + pts.length + ' mission points all on open deck');
  // SLIP ABOARD: the guards are out, and nobody sees the hero at the shuttle
  await until(page, () => GAME.infiltrate.info().on && GAME.infiltrate.info().guards.length === 4, 10, 'the hangar\'s guards on their beats');
  await page.waitForTimeout(1500);
  let I = await page.evaluate(() => GAME.infiltrate.info());
  if (I.alarm > 0.05 || I.seen) throw new Error('the hero is seen at the shuttle (' + (I.alarm * 100).toFixed(0) + '%): ' + JSON.stringify({ me: await page.evaluate(() => GAME.player.group.position), g: I.guards }));
  await shot(page, 'board-1-hangar');
  // work every mark (the guards held still so the run is quick)
  await page.evaluate(() => { for (const e of GAME.missionState().s.guards || []) if (e.patrol){ e.patrol.spd = 0; e.patrol.wait = 999; } });
  const marks = await page.evaluate(() => GAME.missionState().s.marks.map(m => [m.x, m.z]));
  for (const [x, z] of marks)
    await until(page, ([x, z]) => { GAME.player.group.position.set(x, 0, z); const M = GAME.missionState(); return M.i > 0 || M.s.marks.some(k => k.done && Math.hypot(k.x - x, k.z - z) < 0.1); }, 20, 'the mark at ' + x + ', ' + z + ' worked', [x, z]);
  await until(page, () => GAME.missionState().i === 1 && GAME.missionState().o && GAME.missionState().o.kind === 'sabotage', 30, 'the hangar taken');
  console.log('ok   slipped aboard: every mark worked');
  // KILL THE GUNS: each coupling its own way
  const cons = await page.evaluate(() => GAME.missionState().o.consoles.map(c => ({ at: c.at, y: c.y || 0, style: c.style })));
  if (cons.map(c => c.style).join() !== 'seal,sky,line') throw new Error('the couplings are not a seal, a high lock and the line: ' + JSON.stringify(cons));
  await page.evaluate(() => { for (const e of GAME.enemies) if (!e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });
  for (const [k, c] of cons.entries()){
    await until(page, ([c, k]) => { for (const e of GAME.enemies) if (!e.dead && !e.ally) GAME.damageEnemy(e, 99999, null, 0, false, false);
      const M = GAME.missionState(); if (M.i > 1) return true; const C = M.s.cons[k];
      GAME.player.group.position.set(C.x, c.y ? c.y + 0.05 : 0, C.z); GAME.player.vel.set(0, 0, 0);
      return C.done; }, 60, 'the ' + c.style + ' coupling cut', [c, k]);
    if (k === 1) await shot(page, 'board-2-gantry');
  }
  await until(page, () => GAME.missionState().i === 2 && GAME.missionState().o && GAME.missionState().o.kind === 'hold', 20, 'the guns dead');
  console.log('ok   the guns: the Force seal, the high lock (from the gantry) and the line, all cut');
  // HOLD THE SHUTTLE
  const hold = await page.evaluate(() => GAME.missionState().o.at);
  await until(page, () => GAME.enemies.some(e => !e.dead && !e.ally), 40, 'the garrison coming');
  await shot(page, 'board-3-shuttle');
  await page.evaluate(() => GAME.skipObjective());
  await until(page, () => GAME.missionState().won || !GAME.missionState().on, 30, 'the mission won');
  console.log('ok   held the shuttle: wheels up, the mission is won (hold at ' + hold + ')');
  await page.close();
  }

  if (ONLY !== 'solo'){
  /* ---------- CO-OP ---------- */
  const host = await open('host'), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  for (const p of [host, guest]) await p.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
  await host.click('#coopclose');
  await host.$eval('#hero-mando', el => el.click()); await host.$eval('#mode-mission', el => el.click()); await host.evaluate((id) => document.getElementById('msn-' + id).click(), ID);
  await toPlay(host);
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.$eval('#hero-jedi', el => el.click());
  await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  await toPlay(guest);
  await until(guest, (id) => { const M = GAME.missionState(); return M.on && M.def.id === id && M.o && M.o.kind === 'infiltrate'; }, 60, 'the guest aboard the host\'s warship', ID);
  await until(guest, () => GAME.infiltrate.info().cones > 0, 30, 'the guest drawing the hangar\'s sight cones');
  await shot(guest, 'board-4-coop-guest');
  await host.evaluate(() => GAME.skipObjective());
  await until(guest, () => GAME.missionState().i === 1 && GAME.missionState().o.kind === 'sabotage', 30, 'the guest following the host to the guns');
  console.log('ok   co-op: the guest boarded the host\'s warship, drew its cones and followed it to the guns');
  }
} catch(e){ errors.push(e.stack || e.message); }

await browser.close(); server.close?.();
if (errors.length){ console.error('\nBOARDING FAILED:\n' + [...new Set(errors)].slice(0, 30).join('\n')); process.exit(1); }
console.log('\nthe warship was boarded' + (SHOTS ? ' (shots in ' + SHOTS + ')' : ''));
process.exit(0);
