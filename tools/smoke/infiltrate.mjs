// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// INFILTRATE SMOKE TEST — the stealth objective (game/infiltrate.js) on the BUILT game, for each hero on their mission:
//   · its guards are out on their beats (and walk them), its cameras and lights are up, every guard has a sight cone,
//     and nobody sees the hero where the objective starts;
//   · the hero's own way works: the Jedi's DISTRACT turns a guard, the Mando's TAKEDOWN drops one from behind without a
//     sound, the trooper's SMOKE goes down (and the squad holds back);
//   · standing in front of a guard fills the meter: SEEN (the "never seen" goal is gone), then the ALARM: every guard
//     turns, more come in;
//   · working every mark finishes it; done unseen, the goal is kept;
//   · an arcade contract can deal one;
//   · CO-OP: a guest sees the cones and the cameras, the alarm when the host's goes up, and its F is done on the host.
// SHOTS=dir saves a screenshot of each mission's cones. ONLY=jedi,mando,trooper,arcade,coop runs just those. Fails on any
// page or console error.
//   npm run build && npm run smoke:infiltrate

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const PORT = +(process.env.PEER_PORT || 9026);
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=' + PORT;
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
// [hero, mission, the infiltrate objective's index]
const RUNS = [['jedi', 'jedha-night', 0], ['mando', 'covert', 1], ['trooper', 'hunt', 0], ['trooper', 'gate-warship', 0, 'warship']].filter(r => want(r[3] || r[0]));   // (ONLY=warship: Act IV's boarding)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) failed = true; };
const errors = [];
const poll = { timeout: 150000, polling: 250 };
async function open(name){
  const page = await browser.newPage({ viewport: SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript((q) => {
    try {
      localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, SHOTS ? 'medium' : 'low');
  await page.goto(url, { timeout: 180000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const info = (page) => page.evaluate(() => GAME.infiltrate.info());
// a few seconds of game time (headless runs slow: wait on the game's clock)
async function ticks(page, s){
  const gt = await page.evaluate(() => GAME.G.gt);
  await page.waitForFunction(([gt, s]) => { GAME.player.hp = Math.max(GAME.player.hp, 1e4); return GAME.G.gt > gt + s; }, [gt, s], poll).catch(() => {});
}
async function start(page, hero, id, i){
  await page.evaluate(([h, id, i]) => {
    document.getElementById('hero-' + h).click();
    const pick = document.querySelector('#chapcard.open .cc-opt'); if (pick) pick.click();
    document.getElementById('overlay').style.display = 'none'; GAME.G.missionId = id; GAME.startMission(id, i); GAME.G.mode = 'play'; GAME.G.paused = false;
  }, [hero, id, i]);
  await page.waitForFunction((id) => { const M = GAME.missionState(); return M.on && M.def.id === id && M.o && M.o.kind === 'infiltrate'; }, id, poll);
  await ticks(page, 0.3);
}
// stand the hero at (x, z), looking at (lx, lz)
const stand = (page, x, z, lx, lz) => page.evaluate(([x, z, lx, lz]) => { GAME.player.group.position.set(x, 0, z); if (lx != null) GAME.G.yaw = GAME.player.faceYaw = Math.atan2(lx - x, lz - z); }, [x, z, lx, lz]);
const pressF = async (page) => { await page.keyboard.down('f'); await page.waitForTimeout(80); await page.keyboard.up('f'); };

async function heroRun([hero, id, i]){
  const page = await open(hero);
  try {
    await start(page, hero, id, i);
    const def = await page.evaluate(() => { const o = GAME.missionState().o; return { g: (o.guards || []).length, c: (o.cams || []).length, l: (o.lights || []).length, m: (o.marks || []).length }; });
    let I = await info(page);
    check(I.on && I.guards.length === def.g && I.guards.every(g => g.unaware), `${hero}: ${id}: ${I.guards.length} guards out on their beats, none of them alert`);
    check(I.cams === def.c && I.lights === def.l, `${hero}: ...${I.cams} cameras and ${I.lights} lights up`);
    const g0 = I.guards.map(g => [g.x, g.z]);
    await ticks(page, 3);
    I = await info(page);
    check(I.cones >= I.guards.filter(g => g.unaware).length && I.cones > 0, `${hero}: ...every guard has a sight cone (${I.cones})`);
    const moved = I.guards.filter((g, k) => Math.hypot(g.x - g0[k][0], g.z - g0[k][1]) > 1).length;
    check(moved >= 1, `${hero}: ...the guards walk their beats (${moved} moved)`);
    check(I.alarm < 0.05 && !I.seen, `${hero}: ...nobody sees the hero where it starts (meter ${(I.alarm * 100).toFixed(0)}%)`);
    if (hero === 'trooper') check(await page.evaluate(() => GAME.squad.allies.length > 0 && GAME.squad.allies.every(a => a.ord && a.ord.back)), 'trooper: ...the squad holds back');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'infiltrate-' + id + '.png') });

    // the hero's own way
    const G = I.guards.find(g => g.unaware && !g.dead);
    if (hero === 'mando'){
      await stand(page, G.x - Math.sin(G.yaw) * 1.5, G.z - Math.cos(G.yaw) * 1.5, G.x, G.z);
      await page.evaluate(() => { const M = GAME.missionState(); for (const e of M.s.guards) if (e.patrol){ e.patrol.spd = 0; e.patrol.wait = 99; } });   // (hold still while we creep up)
      await ticks(page, 0.3);
      I = await info(page);
      check(I.act === 't' && await page.isVisible('#sneakp.on'), 'mando: from behind a guard, F reads TAKEDOWN');
      await pressF(page); await ticks(page, 0.5);
      I = await info(page);
      check(I.guards.find(g => g.nid === G.nid).dead, 'mando: ...and drops him');
      check(I.alarm < 0.34 && !I.alarmed, `mando: ...without a sound (meter ${(I.alarm * 100).toFixed(0)}%)`);
    } else if (hero === 'jedi'){
      await stand(page, G.x - Math.sin(G.yaw) * 8, G.z - Math.cos(G.yaw) * 8, G.x, G.z);
      await page.evaluate(() => { GAME.player.force = 100; });
      await ticks(page, 0.3);
      I = await info(page);
      const g = I.guards.find(x => x.nid === G.nid);
      check(I.act === 'd' && await page.isVisible('#sneakp.on'), 'jedi: a guard in view, F reads DISTRACT');
      await pressF(page); await ticks(page, 0.3);
      I = await info(page);
      check(I.guards.find(x => x.nid === G.nid).look, 'jedi: ...and he turns to look at something else');
    } else {
      I = await info(page);
      const n = I.smokeLeft;
      check(I.act === 's' && await page.isVisible('#sneakp.on'), `trooper: F reads SMOKE (${n} left)`);
      await pressF(page); await ticks(page, 0.4);
      I = await info(page);
      check(I.smokes === 1 && I.smokeLeft === n - 1 && I.smokesDrawn === 1, 'trooper: ...and the smoke goes down');
    }

    // seen: right in front of a guard
    await page.evaluate(() => { const M = GAME.missionState(); for (const e of M.s.guards) if (e.patrol){ e.patrol.spd = 0; e.patrol.wait = 99; e.patrol.look = null; } });
    await page.evaluate(() => { const M = GAME.missionState(); M.s.smokes.length = 0; });
    I = await info(page);
    const W = I.guards.find(g => g.unaware && !g.dead);
    await stand(page, W.x + Math.sin(W.yaw) * 4, W.z + Math.cos(W.yaw) * 4, W.x, W.z);
    const foes0 = await page.evaluate(() => GAME.enemies.filter(e => !e.dead).length);
    await page.waitForFunction(([x, z]) => { GAME.player.group.position.set(x, 0, z); GAME.player.hp = 1e4; return GAME.infiltrate.info().alarmed; }, [W.x + Math.sin(W.yaw) * 4, W.z + Math.cos(W.yaw) * 4], poll).catch(() => {});
    I = await info(page);
    check(I.seen && (await page.evaluate(() => GAME.MEDALS.medalsState().missed)).includes('seen'), `${hero}: in front of a guard: SEEN, the "never seen" goal is gone`);
    check(I.alarmed && I.guards.every(g => g.dead || !g.unaware), `${hero}: ...then the ALARM: every guard turns`);
    await ticks(page, 1.5);
    check(await page.evaluate((n) => GAME.enemies.filter(e => !e.dead).length + GAME.G.spawnQueue.length > n, foes0), `${hero}: ...and more come in`);
    check(await page.evaluate(() => GAME.missionState().alarmed), `${hero}: ...and the rest of the mission sends more`);

    // the marks, one by one
    const i0 = await page.evaluate(() => GAME.missionState().i);
    for (const m of I.marks){
      await page.waitForFunction(([x, z]) => { GAME.player.group.position.set(x, 0, z); GAME.player.hp = 1e4; const M = GAME.missionState(); return !M.o || M.o.kind !== 'infiltrate' || M.s.marks.some(k => k.done && Math.hypot(k.x - x, k.z - z) < 0.1); }, [m.x, m.z], poll).catch(() => {});
    }
    await page.waitForFunction((i0) => GAME.missionState().i > i0 || GAME.G.mode === 'victory', i0, poll).catch(() => {});
    check(await page.evaluate((i0) => GAME.missionState().i > i0, i0), `${hero}: every mark worked: the objective is done`);
    check(!(await info(page)).on && !(await page.isVisible('#sneakp.on')), `${hero}: ...its cones and prompt are gone with it`);

    // again, unseen: with nobody looking, the goal is kept
    await page.evaluate(() => { GAME.G.mode = 'play'; });
    await page.evaluate(() => { GAME.infiltrate.INFIL._r = GAME.infiltrate.INFIL.range; GAME.infiltrate.INFIL._c = GAME.infiltrate.INFIL.camRange; GAME.infiltrate.INFIL.range = 0; GAME.infiltrate.INFIL.camRange = 0; });
    await start(page, hero, id, i);
    await page.evaluate(() => { GAME.missionState().o.lights = []; });
    I = await info(page);
    for (const m of I.marks){
      await page.waitForFunction(([x, z]) => { GAME.player.group.position.set(x, 0, z); GAME.player.hp = 1e4; const M = GAME.missionState(); return !M.o || M.o.kind !== 'infiltrate' || M.s.marks.some(k => k.done && Math.hypot(k.x - x, k.z - z) < 0.1); }, [m.x, m.z], poll).catch(() => {});
    }
    await page.waitForFunction((i) => GAME.missionState().i > i, i, poll).catch(() => {});
    check(!(await page.evaluate(() => GAME.MEDALS.medalsState().missed)).includes('seen') && await page.evaluate((i) => GAME.missionState().i > i, i), `${hero}: done unseen: the goal is kept`);
    await page.evaluate(() => { const F = GAME.infiltrate.INFIL; F.range = F._r; F.camRange = F._c; });
    check(await page.evaluate((id) => GAME.MEDAL_DATA.bonusOf(GAME.missionById(id), GAME.G.hero) === 'unseen', id), `${hero}: ${id}'s bonus goal is "never seen"`);
  } catch(e){ check(false, hero + ': ' + e.message); }
  await page.close();
}

async function arcadeRun(){
  const page = await open('arcade');
  try {
    const id = await page.evaluate(() => { for (let s = 1; s < 4000; s++){ const d = GAME.missionById('arcade:' + s); if (d && d.objectives[0].kind === 'infiltrate') return d.id; } return null; });
    check(!!id, 'arcade: a contract can open on an infiltrate (' + id + ')');
    if (id){
      await start(page, 'jedi', id, 0);
      const I = await info(page);
      check(I.on && I.guards.length > 0 && I.marks.length > 0, `arcade: ${id} plays it (${I.guards.length} guards, ${I.marks.length} marks)`);
    }
  } catch(e){ check(false, 'arcade: ' + e.message); }
  await page.close();
}

async function coopRun(){
  const step = (w) => { if (process.env.DEBUG) console.log('   co-op: ' + w); };
  const server = PeerServer({ port: PORT, host: '127.0.0.1', path: '/' });
  const host = await open('host'), guest = await open('guest');
  const connected = (p) => p.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
  try {
    await host.click('#mode-coop'); await host.click('#coophost');
    await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
    const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
    await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
    await Promise.all([connected(host), connected(guest)]);
    step('connected');
    await host.click('#coopclose');
    await host.evaluate(() => localStorage.setItem('sw_mission_covert_mando', '1'));
    await host.$eval('#hero-mando', el => el.click()); await host.$eval('#mode-mission', el => el.click()); await host.evaluate(() => { const c = document.getElementById('msn-covert'); c.click(); c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    for (let i = 0; i < 6 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
      if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
      if (await host.isVisible('#forms [data-go]')) await host.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
      const pick = await host.$('#chapcard.open .cc-opt'); if (pick) await pick.click().catch(() => {});
      await host.waitForTimeout(1500);
    }
    step('host started: ' + await host.evaluate(() => GAME.G.mode + ' ' + GAME.missionState().on));
    await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
    step('guest sees the run');
    await guest.click('#coopclose'); await guest.$eval('#hero-trooper', el => el.click());
    await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
    for (let i = 0; i < 6 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
      if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
      await guest.waitForTimeout(800);
    }
    check(await guest.evaluate(() => GAME.G.coopGuest && GAME.missionState().on), 'co-op: the guest joined the covert');
    // the host past the ramp, to the jammers
    step('host skips the ramp');
    await host.waitForFunction(() => GAME.missionState().o, null, poll);
    await host.evaluate(() => GAME.skipObjective());
    await host.waitForFunction(() => { const M = GAME.missionState(); return M.o && M.o.kind === 'infiltrate'; }, null, poll);
    await host.evaluate(() => { const M = GAME.missionState(); for (const e of M.s.guards) if (e.patrol){ e.patrol.spd = 0; e.patrol.wait = 99; } });
    await guest.waitForFunction(() => { const I = GAME.infiltrate.info(); return I.on && I.cams === 2 && I.cones > 0; }, null, poll).catch(() => {});
    const gi = await info(guest);
    check(gi.on && gi.guest && gi.cones > 0 && gi.cams === 2, `co-op: the guest sees the guards' cones (${gi.cones}) and the cameras (${gi.cams})`);
    // the guest's smoke, done on the host
    const n = (await info(host)).smokeLeft;
    await guest.waitForFunction(() => GAME.infiltrate.info().act === 's', null, poll).catch(() => {});
    await guest.bringToFront(); await pressF(guest);
    await host.waitForFunction((n) => GAME.infiltrate.info().smokeLeft === n - 1 && GAME.infiltrate.info().smokes === 1, n, poll).catch(() => {});
    check((await info(host)).smokes === 1, 'co-op: the guest\'s F drops smoke on the host');
    await guest.waitForFunction(() => GAME.infiltrate.info().smokesDrawn === 1, null, poll).catch(() => {});
    check((await info(guest)).smokesDrawn === 1, 'co-op: ...and the guest draws it');
    // the host is seen: the guest's alarm goes up with it
    await host.bringToFront();
    const W = (await info(host)).guards.find(g => g.unaware);
    await host.evaluate(() => { GAME.missionState().s.smokes.length = 0; });
    await host.waitForFunction(([x, z]) => { GAME.player.group.position.set(x, 0, z); GAME.player.hp = 1e4; return GAME.infiltrate.info().alarmed; }, [W.x + Math.sin(W.yaw) * 4, W.z + Math.cos(W.yaw) * 4], poll).catch(() => {});
    await guest.waitForFunction(() => GAME.infiltrate.info().alarmed, null, poll).catch(() => {});
    check((await info(guest)).alarmed, 'co-op: the host is seen, and the guest\'s alarm goes up with it');
    check((await guest.evaluate(() => GAME.MEDALS.medalsState().missed)).includes('seen'), 'co-op: ...the guest\'s "never seen" goal is gone too');
  } catch(e){ check(false, 'co-op: ' + e.message); }
  await host.close(); await guest.close();
  server.close && server.close();
}

try {
  for (const r of RUNS) await heroRun(r);
  if (want('arcade')) await arcadeRun();
  if (want('coop')) await coopRun();
} catch(e){ check(false, e.message); }
for (const e of errors) check(false, e);
await browser.close();
process.exit(failed ? 1 : 0);
