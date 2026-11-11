// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// REWORKED MISSIONS SMOKE TEST — boots the BUILT game (dist/index.html) and plays the missions that got a new shape
// through, objective by objective, the way a player would (standing where the objective wants you, putting down what's
// in the way), instead of skipping them:
//   · THE GATE WAKES: the seals, then the Cantor's chase round the hall (hidden until it starts, two standoffs), then its duel;
//   · THE VOICE UNDER THE THRONE: the stones, then the ward walked to the throne in three legs, the singers on the second;
//   · WHO GAVE THE ORDER: Kamino's sealed archive breached a door at a time (its three doors open in turn; the records
//     room's alarm rings, the vault's contract is pulled), then the Cantor;
//   · RETURN TO JEDHA: the courtyard's posts taken, the dais held, the echo.
// Each must reach the win with the right objectives in the right order. Fails on any page or console error.
// HEROES=jedi,trooper picks who plays the gate's three (each one plays every gate mission; Return to Jedha is the Jedi's).
// ONLY=gate-vault,gate-order plays only those. SHOTS=dir saves a frame of each new objective there.
//   npm run build && npm run smoke:reworks

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const HEROES = (process.env.HEROES || 'jedi,mando,trooper').split(',');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) failed = true; };
const errors = [];

const RUNS = [];
for (const h of HEROES) for (const [id, kinds] of [['gate-wake', 'sabotage,pursuit,duel'], ['gate-vault', 'sabotage,escort,escort,escort'], ['gate-order', 'breach,breach,breach,duel']]) RUNS.push([h, id, kinds]);
if (HEROES.includes('jedi')) RUNS.push(['jedi', 'jedha-night', 'capture,hold,duel']);
// PR 4's six: each played as the hero whose story it is (the Missions page ones as both the Jedi and the Mando)
for (const [h, id, kinds] of [['jedi', 'academy', 'sabotage,escort,escort,duel'], ['mando', 'academy', 'sabotage,escort,escort,duel'],
                              ['jedi', 'graveyard', 'sabotage,escort,escort,duel'], ['mando', 'graveyard', 'sabotage,escort,escort,duel'],
                              ['mando', 'gallows', 'breach,breach,duel'], ['mando', 'meltworks', 'capture,sabotage,duel'],
                              ['mando', 'iron-road', 'pursuit,duel'], ['trooper', 'chipfiles', 'capture,hold']])
  if (HEROES.includes(h)) RUNS.push([h, id, kinds]);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;   // ONLY=gate-vault plays just those
if (ONLY) RUNS.splice(0, RUNS.length, ...RUNS.filter(r => ONLY.includes(r[1])));

// one step of helping the objective along, in the page: what a player would be doing about it right now
const STEP = () => {
  const { G, player, enemies } = GAME, M = GAME.missionState(), o = M.o, s = M.s, P = player.group.position;
  player.hp = Math.max(player.hp, 1e4); if (player.downed) player.downed = false;
  if (G.cutscene) GAME.cutscene.skipScene();
  if (G.paused){ const b = document.getElementById('goText'); if (b) b.click(); G.paused = false; }
  const card = document.querySelector('#chapcard.open [data-go]'); if (card) card.click();
  if (!o || !s) return { i: M.i, kind: null };
  const kill = (r, at) => { for (const e of enemies) if (!e.dead && !e.converted && (!r || Math.hypot(e.group.position.x - at.x, e.group.position.z - at.z) < r)) GAME.damageEnemy(e, 99999, null, 0, false, false); };
  const put = (x, z, y = 0) => P.set(x, y, z);
  const info = { i: M.i, kind: o.kind };
  switch (o.kind){
    case 'sabotage': GAME.skipObjective(); break;   // (the seals and stones are the gate's styled locks, unchanged: smoke:gate plays them)
    case 'hold': {
      if (!o.boss){ GAME.skipObjective(); break; }   // (Return to Jedha's dais, unchanged)
      // a hold with someone coming for it in person (the chip files): stand on it, wind the clock on, and put him down
      put(o.at[0] + 0.5, o.at[1] + 0.5);
      const b = s.boss; info.boss = !!b; info.prog = Math.round(100 * s.prog / o.time);
      if (b && !b.dead && GAME.enemies.includes(b)){ info.bossUp = true; info.capped = s.prog >= o.time * 0.96; if (s.prog >= o.time * 0.96) GAME.damageEnemy(b, Math.max(40, b.maxHp * 0.1), null, 0, false, false); else s.prog += 1.5; }
      else { kill(o.r + 4, { x: o.at[0], z: o.at[1] }); s.prog = Math.min(o.time * (b ? 1 : 0.995), s.prog + 1.5); }
      break;
    }
    case 'capture': {
      const c = s.cur; if (c){ put(c.x + 0.5, c.z + 0.5); kill(o.r + 6, c); }
      info.posts = s.k; break;
    }
    case 'pursuit': {
      const q = M.quarry; info.hidden = !!(q && q.hidden); info.visible = !!(q && q.g.visible);
      if (s.clash){   // it turned to fight: hurt it till it breaks away
        const e = s.clash; put(e.group.position.x + 2, e.group.position.z + 2); GAME.damageEnemy(e, Math.max(30, e.maxHp * 0.05), null, 0, false, false);
        info.clash = true; info.t = Math.round(s.clashT * 10); break;
      }
      if (!s.P || !q) break;
      // run on its heels, a few metres back along its line, and put down whatever it leaves to hold you off
      const d = Math.max(0, s.d - 5), pts = s.P.pts; let k = 0; while (k < pts.length - 2 && d > s.P.cum[k + 1]) k++;
      const a = pts[k], b = pts[k + 1], t = (d - s.P.cum[k]) / ((s.P.cum[k + 1] - s.P.cum[k]) || 1);
      put(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      if (s.hold || s.clash) kill(30, q.g.position);
      info.d = Math.round(s.d); info.len = Math.round(s.P.len); info.stand = !!s.hold; info.clash = !!s.clash;
      break;
    }
    case 'escort': {
      const v = M.vip; if (!v) break;
      put(v.g.position.x + 1.5, v.g.position.z + 1.5); kill(40, v.g.position);
      v.hp = Math.max(v.hp, v.maxHp * 0.6);
      if (!s.pinned && s.near && s.d < s.P.len - 1) s.d = Math.min(s.P.len - 1, s.d + 0.5);   // (it walks on a little quicker than its own pace: headless frames are slow)
      info.d = Math.round(s.d); info.len = Math.round(s.P.len); info.tw = GAME.twistState() && GAME.twistState().kind; info.pinned = s.pinned; info.near = s.near; info.dbg = [G.mode, G.paused, Math.round(G.gt), !!G.cutscene, M.waitT > 0, G.slowmo, Math.round(v.g.position.x*10)/10, Math.round(v.g.position.z*10)/10, s.goal && s.goal.x];
      break;
    }
    case 'breach': {
      info.doors = (GAME.shared.doors || []).filter(d => d.open).length;
      if (s.phase === 'stack') put(o.stack[0], o.stack[1]);
      else if (s.phase === 'clear'){
        if (o.alarm && !s.rang){ if (s.alarmT != null) s.alarmT = Math.min(s.alarmT, 0.05); }   // (let the alarm ring: headless is too slow to wait it out)
        else if (o.grab && !s.got) put(o.grab.at[0], o.grab.at[1]);                                 // (pull the contract with the room still fighting)
        else kill(0);
      }
      info.phase = s.phase; info.rang = !!s.rang; info.got = !!s.got; info.gp = s.gp;
      break;
    }
    case 'duel': {
      const f = s.foe; if (f) window.__duelFoe = { e: f, name: o.name };
      if (f && !f.dead){ put(f.group.position.x + 2.5, f.group.position.z + 2.5); GAME.damageEnemy(f, Math.max(40, f.maxHp * 0.08), null, 0, false, false); }
      kill(0, P); info.foe = f ? f.name || true : null;
      break;
    }
  }
  return info;
};

const page = await browser.newPage({ viewport: SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 }, deviceScaleFactor: SHOTS ? 2 : 1 });
await page.addInitScript(() => {
  try {
    localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
    for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
  } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
});
page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });

try {
  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
  let hero = null;
  for (const [h, id, kinds] of RUNS){
    if (h !== hero){ await page.$eval('#hero-' + h, el => el.click()); hero = h; }
    await page.evaluate((id) => { document.getElementById('overlay').style.display = 'none'; GAME.G.missionId = id; GAME.startMission(id); GAME.G.mode = 'play'; GAME.G.paused = false; }, id);
    await page.waitForFunction((id) => GAME.missionState().on && GAME.missionState().def.id === id, id, { timeout: 60000 });
    const seen = [], notes = {};
    let last = -2, shot = -1, stuck = 0, lastInfo = '';
    for (const t0 = Date.now(); Date.now() - t0 < 420000;){
      const st = await page.evaluate(() => GAME.G.mode === 'victory' ? { won: true } : GAME.G.mode === 'dead' ? { dead: true } : null);
      if (st && st.won) break;
      if (st && st.dead){ await page.evaluate(() => { GAME.G.mode = 'play'; }); }
      const info = await page.evaluate(STEP);
      if (info.kind && info.i !== last){
        last = info.i; seen.push(info.kind); stuck = 0;
        if (process.env.DEBUG){ const g0 = await page.evaluate(() => GAME.G.gt); await page.waitForTimeout(3000); console.log('pace', info.i, info.kind, (await page.evaluate(() => GAME.G.gt)) - g0, await page.evaluate(() => ({ foes: GAME.enemies.length, live: GAME.enemies.filter(e => !e.dead).length, q: GAME.G.spawnQueue.length, kids: GAME.camera.parent ? GAME.camera.parent.children.length : -1 }))); }
        if (info.kind === 'pursuit') notes.hiddenBefore = await page.evaluate(() => { const M = GAME.missionState(); return M.quarry ? !M.quarry.g.visible || M.quarry.hidden === false : null; });
      }
      if (info.kind === 'breach'){ if (info.rang) notes.rang = true; if (info.got) notes.got = true; if (info.gp > 0 && !info.got) notes.pulling = true; }
      if (info.kind === 'pursuit'){ notes.chaseVisible = notes.chaseVisible || info.visible; if (info.stand && !notes.inStand) notes.standoffs = (notes.standoffs || 0) + 1; notes.inStand = info.stand; if (info.clash) notes.clash = true; }
      if (info.kind === 'escort' && info.tw) notes.twist = info.tw;
      if (info.kind === 'hold' && info.bossUp){ notes.boss = true; if (info.capped) notes.waited = true; }
      if (info.kind === 'duel' && info.escaped) notes.escaped = true;
      if (info.kind === 'breach') notes.doors = Math.max(notes.doors || 0, info.doors);
      if (SHOTS && info.kind && info.kind !== 'sabotage' && info.kind !== 'hold' && shot !== info.i && ((info.d || 0) > 12 || info.kind === 'breach' || info.kind === 'capture' || info.kind === 'duel')){
        shot = info.i; await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, `${id}-${h}-${info.i}-${info.kind}.png`) });
      }
      const sig = JSON.stringify(info);
      if (sig === lastInfo && ++stuck > 400){
        if (process.env.DEBUG) console.log('stuck', JSON.stringify(await page.evaluate(() => new Promise(r => { let n = 0; const gt = GAME.G.gt, f = () => { n++; }; const id = setInterval(f, 0); requestAnimationFrame(function a(){ n += 1000; if (n < 30000) requestAnimationFrame(a); }); setTimeout(() => { clearInterval(id); r({ frames: Math.floor(n / 1000), dgt: GAME.G.gt - gt, foes: GAME.enemies.length, live: GAME.enemies.filter(e => !e.dead).length, hitstop: GAME.G.hitstop, freeze: GAME.G.freezeT, mode: GAME.G.mode, tutorial: GAME.G.tutorial, sel: GAME.G.skillSelect, card: GAME.G.cardUp }); }, 2000); }))));
        break;
      } else if (sig !== lastInfo) stuck = 0;
      lastInfo = sig;
      await page.waitForTimeout(120);
    }
    const won = await page.evaluate(() => GAME.G.mode === 'victory');
    const escapedName = await page.evaluate(() => { const d = window.__duelFoe; window.__duelFoe = null; return d && !d.e.dead && d.e.hp > 0 ? d.name : null; });
    const doors = await page.evaluate(() => (GAME.shared.doors || []).filter(d => d.open).length);
    check(won, `${h}: ${id} is won${won ? '' : ' (stuck at ' + lastInfo + ')'}`);
    check(seen.join() === kinds, `${h}: ${id} plays ${kinds} (${seen.join()})`);
    if (id === 'gate-wake') check(notes.chaseVisible && notes.standoffs === 2, `${h}: the Cantor steps out for the chase and stops twice to hold you off (${JSON.stringify(notes)})`);
    if (id === 'gate-vault') check(notes.twist === 'marked', `${h}: the singers mark the ward-bearer on the second leg (${notes.twist})`);
    if (id === 'chipfiles') check(notes.boss && notes.waited, `${h}: Vorn comes for the core near the end, and the download waits on him (${JSON.stringify(notes)})`);
    if (id === 'gallows') check(doors >= 2 && notes.got && notes.rang, `${h}: both blocks are breached, Skye's cell opened, Block B's alarm rang (${JSON.stringify(notes)})`);
    if (id === 'iron-road') check(notes.chaseVisible && notes.standoffs === 2, `${h}: the convoy's warden is chased down with two standoffs (${JSON.stringify(notes)})`);
    if (id === 'academy') check(escapedName === 'THE OVERSEER', `${h}: the overseer escapes (${escapedName})`);
    if (id === 'gate-order') check(doors >= 3, `${h}: all three of the archive's doors are breached (${doors} open)`);
    if (id === 'gate-order') check(notes.rang && notes.got && notes.pulling, `${h}: the records room's alarm brings more in, and the contract is pulled off the vault's terminal under fire (${JSON.stringify(notes)})`);
    await page.evaluate(() => { const pick = document.querySelector('#chapcard.open .cc-opt'); if (pick) pick.click(); GAME.G.mode = 'menu'; });
  }
  // the quarry waits out of sight while the seals are held: start the Gate Wakes and look before the chase
  await page.evaluate(() => { GAME.startMission('gate-wake'); GAME.G.mode = 'play'; GAME.G.paused = false; });
  await page.waitForFunction(() => GAME.missionState().on && GAME.missionState().def.id === 'gate-wake' && GAME.missionState().quarry, null, { timeout: 60000 });
  const pre = await page.evaluate(() => { const M = GAME.missionState(); return { hidden: M.quarry.hidden, vis: M.quarry.g.visible, kind: M.def.objectives[Math.max(0, M.i)].kind }; });
  check(pre.hidden && !pre.vis, `the Cantor is out of sight while the seals are held (${JSON.stringify(pre)})`);
} catch(e){ check(false, e.message); }
for (const e of errors) check(false, e);
await browser.close();
process.exit(failed ? 1 : 0);
