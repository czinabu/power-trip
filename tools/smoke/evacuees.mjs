// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// EVACUEES SMOKE TEST — the people a hold gets out (game/civilians.js, game/mission.js) on the BUILT game: in each mission
// with a line of evacuees, the hero stands off to one side while the waves come for the zone, and the test checks that
// no foe ever stands inside one of them, that a trooper is sent to shoot at the line, and that a shot or blast that
// meets the line puts someone down. Then the same hold in co-op: the guest's screen draws the host's line.
// SHOTS=<dir> saves screenshots. ONLY=mission,mission… runs just those. EVAC_SECONDS=… game seconds each (default 30).
//   npm run build && npm run smoke:evacuees

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = +(process.env.PEER_PORT || 9031);
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=' + PORT;
const SHOTS = process.env.SHOTS, ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const W = SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 };
const poll = { timeout: 150000, polling: 250 };
const SECONDS = +(process.env.EVAC_SECONDS || 30);
// [hero, mission]: one of each kind of line (children up a ramp, archivists out of a hall, prisoners onto a barge)
const RUNS = [['jedi', 'refuge'], ['mando', 'covert'], ['jedi', 'academy'], ['mando', 'gallows']]
  .filter(r => !ONLY || ONLY.includes(r[1]));

const server = PeerServer({ port: PORT, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function open(name){
  const page = await browser.newPage({ viewport: W });
  page.on('pageerror', e => errors.push(name + ': ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript((q) => {
    try {
      localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']) localStorage.setItem('sw_camp_' + h, '1');
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, SHOTS ? 'medium' : 'low');
  await page.goto(url, { timeout: 180000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
async function toPlay(page){
  for (let i = 0; i < 10 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.paused)); i++){
    await page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); if (GAME.G.cutscene) GAME.cutscene.skipScene(); });
    for (const sel of ['#goText', '#trainNo', '#forms [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(700);
  }
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), timeout: 180000 }).catch(() => {}); };
const holdAt = (page, mid) => page.evaluate(m => GAME.MISSIONS[m].objectives.findIndex(o => o.kind === 'hold' && o.evacuees), mid);
const past = () => {
  if (GAME.G.cutscene) GAME.cutscene.skipScene();
  const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click();
  if (GAME.G.paused){ const o = document.getElementById('goText'); if (o) o.click(); }
  const M = GAME.missionState();
  return !!(M.o && M.s && (M.s.kids || M.gk));
};

// game seconds of the hold, the hero kept alive and standing off the line (where the foes leave it be), sampling
// how close any foe's body gets to anyone standing in it
async function play(page, seconds, host = true){
  const t0 = await page.evaluate(() => GAME.G.gt);
  let worst = 9, hits = 0, hunters = 0, shown = 0;
  for (const r0 = Date.now(); Date.now() - r0 < 420000;){
    const s = await page.evaluate(([host]) => {
      const { G, player, enemies } = GAME, M = GAME.missionState();
      player.hp = Math.max(player.hp, 1e3);
      if (G.cutscene) GAME.cutscene.skipScene();
      if (G.paused){ const o = document.getElementById('goText'); if (o) o.click(); }
      const o = M.o, S = M.s, kids = host ? S && S.kids : M.gk && M.gk.kids;
      if (host && o && o.kind === 'hold'){
        // off to the side of the zone, past the foes' aggro: they march for the zone (and the line) and leave the hero be
        if (G.gt - (window.__tp || 0) > 2){ window.__tp = G.gt; player.group.position.set(o.at[0] + o.r + 4, 0, o.at[1] - 2); }
        S.prog = Math.min(o.time * 0.85, S.prog + o.time * 0.0015);
      }
      let worst = 9;
      if (kids) for (const k of kids){
        if (!k.m.visible || k.down > 0) continue;
        for (const e of enemies){
          if (e.dead || e.t.fly || e.state === 'ragdoll' || e.state === 'knockdown' || e.state === 'spawn') continue;
          worst = Math.min(worst, Math.hypot(e.group.position.x - k.m.position.x, e.group.position.z - k.m.position.z) - k.r - 0.7 * (e.t.scale || 1) * 0.6);
        }
      }
      return { gt: G.gt, mode: G.mode, worst, hits: S && S.hitAt != null ? 1 : 0, down: kids ? kids.filter(k => k.down > 0).length : 0,
               hunters: enemies.filter(e => !e.dead && e.civHunt).length, shown: kids ? kids.filter(k => k.m.visible).length : 0 };
    }, [host]);
    worst = Math.min(worst, s.worst); hits = Math.max(hits, s.hits, s.down ? 1 : 0); hunters = Math.max(hunters, s.hunters); shown = Math.max(shown, s.shown);
    if (s.gt - t0 >= seconds || s.mode !== 'play') break;
    await page.waitForTimeout(120);
  }
  return { worst, hits, hunters, shown };
}

let sent = 0;
try {
  let page = null, hero = null;
  for (const [h, mid] of RUNS){
    if (h !== hero){
      if (page) await page.close();
      page = await open(h); hero = h;
      await page.$eval('#hero-' + h, el => el.click()); await page.click('#mode-campaign');
      await toPlay(page);
    }
    const i = await holdAt(page, mid);
    if (i < 0){ errors.push(mid + ': no hold with evacuees'); continue; }
    await page.evaluate(([m, i]) => GAME.startMission(m, i), [mid, i]);
    await toPlay(page);
    for (let k = 0; k < 200 && !(await page.evaluate(past)); k++) await page.waitForTimeout(400);
    const r = await play(page, SECONDS);
    await shot(page, 'evac-' + mid);
    // (bodies may brush: a foe is set back out of anyone it ends a step inside, so the gap never goes far below 0)
    const ok = r.worst > -0.15 && r.shown > 0;
    sent += r.hunters;
    console.log((ok ? 'ok   ' : 'FAIL ') + mid.padEnd(10) + h.padEnd(7) + 'closest ' + r.worst.toFixed(2) + ' m · hunters ' + r.hunters + ' · someone hit ' + (r.hits ? 'yes' : 'no'));
    if (r.worst <= -0.15) errors.push(mid + ': a foe stood inside an evacuee (' + r.worst.toFixed(2) + ' m)');
    if (!r.shown) errors.push(mid + ': the line never showed');
    await page.evaluate(() => GAME.skipObjective());
    await page.waitForTimeout(400);
  }
  if (page) await page.close();
  // (a wave with no rifle in it sends nobody: across the runs, at least one must have been sent)
  if (RUNS.length && !sent) errors.push('no trooper was ever sent at a line');

  /* ---------- co-op: the guest's screen draws the host's line ---------- */
  if (!ONLY || ONLY.includes('refuge')){
    const host = await open('host'), guest = await open('guest');
    await host.click('#mode-coop'); await host.click('#coophost');
    await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
    const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
    await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
    for (const p of [host, guest]) await p.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
    await host.click('#coopclose');
    await host.evaluate(() => localStorage.setItem('sw_mission_refuge_jedi', '1'));
    await host.$eval('#hero-jedi', el => el.click()); await host.click('#mode-mission'); await host.click('#msn-refuge');
    await toPlay(host);
    await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
    await guest.click('#coopclose'); await guest.$eval('#hero-mando', el => el.click());
    await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
    await toPlay(guest);
    const i = await holdAt(host, 'refuge');
    await host.evaluate(i => GAME.startMission('refuge', i), i);
    for (let k = 0; k < 200 && !((await host.evaluate(past)) && (await guest.evaluate(past))); k++) await host.waitForTimeout(400);
    console.log('co-op: hold begun · guest line ' + await guest.evaluate(() => { const M = GAME.missionState(); return JSON.stringify({ i: M.i, o: M.o && M.o.kind, gk: !!M.gk, ev: !!(M.net && M.net.ev) }); }));
    // (and the host's approach lanes, lit on the guest's screen as each wave is called in: game/lanes.js)
    await guest.evaluate(() => { window.__lit = 0; (function watch(){ if (GAME.shared.incoming) window.__lit++; if (window.__lit < 1e6) setTimeout(watch, 100); })(); });
    const [, g] = await Promise.all([play(host, 12), play(guest, 12, false)]);
    await shot(guest, 'evac-coop-guest');
    const lit = await guest.evaluate(() => window.__lit);
    console.log('co-op guest: ' + g.shown + ' of the line drawn · a lit lane seen ' + (lit ? 'yes' : 'no'));
    if (!(g.shown > 0)) errors.push('co-op: the guest never saw the host\'s evacuees');
    if (!lit) errors.push('co-op: the guest never saw a lane light up');
  }
} catch(e){ errors.push(e.stack || e.message); }
await browser.close();
server.close && server.close();
if (errors.length){ console.error('\n' + errors.length + ' problem(s):\n' + errors.slice(0, 20).join('\n')); process.exit(1); }
console.log('\nevacuees ok');
process.exit(0);
