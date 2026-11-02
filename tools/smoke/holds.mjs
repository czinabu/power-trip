// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HOLDS SMOKE TEST (the protect-mission audit) — every hold in every story mission (data/missions.js, game/lanes.js)
// on the BUILT game: start the mission at that hold as a hero who plays it, stand in the zone, push the clock along so
// the waves keep coming, and check the design rules a protect mission follows:
//   · it has approach lanes, each a good way off the evacuees' walk (LANE.clear);
//   · every wave is telegraphed: its lane is lit before anyone steps out of it;
//   · no foe arrives near anyone being got out (LANE.civGap, less a little for the jitter) or on top of a hero.
// Prints one line per hold (the audit table). SHOTS=<dir> saves a screenshot of each with a lane lit.
// ONLY=mission,mission… runs just those; ALL=1 every hold, not only the ones with evacuees. HOLD_SECONDS=… game seconds of each (default 22).
//   npm run build && npm run smoke:holds

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const SHOTS = process.env.SHOTS, ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const W = SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 };
const poll = { timeout: 150000, polling: 250 };
const SECONDS = +(process.env.HOLD_SECONDS || 16);

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
const past = () => {
  if (GAME.G.cutscene) GAME.cutscene.skipScene();
  const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click();
  if (GAME.G.paused){ const o = document.getElementById('goText'); if (o) o.click(); }
  const M = GAME.missionState();
  return !!(M.o && M.o.kind === 'hold' && M.s && M.s.lanes);
};

// every hold, with a hero who plays its mission
const RUNS = await (async () => {
  const p = await open('list');
  const list = await p.evaluate(() => {
    const out = [];
    for (const id in GAME.MISSIONS){
      const d = GAME.MISSIONS[id];
      if (id === 'chains-alone') continue;   // (the same hold as 'chains')
      d.objectives.forEach((o, i) => { if (o.kind === 'hold') out.push([(d.heroes && d.heroes[0]) || 'jedi', id, i, !!o.evacuees]); });
    }
    return out;
  });
  await p.close();
  return list.filter(r => ONLY ? ONLY.includes(r[1]) : process.env.ALL || r[3]);   // (by default the holds with people to get out; ALL=1 every hold)
})();

async function play(page, seconds){
  const t0 = await page.evaluate(() => GAME.G.gt);
  const seen = new Set();
  let worstCiv = 99, worstHero = 99, arrivals = 0, unwarned = 0, lit = 0, shotTaken = false;
  for (const r0 = Date.now(); Date.now() - r0 < 300000;){
    const s = await page.evaluate(() => {
      const { G, player, enemies } = GAME, M = GAME.missionState();
      player.hp = Math.max(player.hp, 1e3);
      if (G.cutscene) GAME.cutscene.skipScene();
      if (G.paused){ const o = document.getElementById('goText'); if (o) o.click(); }
      const o = M.o, S = M.s;
      if (!o || o.kind !== 'hold' || !S.lanes) return { gt: G.gt, mode: G.mode, off: true };
      if (G.gt - (window.__tp || 0) > 2){ window.__tp = G.gt; player.group.position.set(o.at[0], 0, o.at[1]); }   // on the zone
      S.prog = Math.min(o.time * 0.8, S.prog + o.time * 0.001);
      S.pulseT = Math.min(S.pulseT, 3);   // keep the waves coming
      const civ = (S.kids || []).filter(k => k.m.visible).map(k => [k.m.position.x, k.m.position.z]);
      const hot = S.lanes.filter(l => l.warnT > 0 || l.heat > 0.3).map(l => [l.x, l.z]);
      const fresh = enemies.filter(e => !e.dead && !e.converted && e.goal && G.gt - (e.born ?? -9) < 0.25)
        .map(e => ({ id: e.nid ?? e.uid ?? (e.group.id), x: e.group.position.x, z: e.group.position.z }));
      return { gt: G.gt, mode: G.mode, civ, hot, fresh, lanes: S.lanes.length, px: player.group.position.x, pz: player.group.position.z };
    });
    if (s.off){ if (s.gt - t0 >= seconds || s.mode !== 'play') break; await page.waitForTimeout(150); continue; }
    if (s.hot.length){ lit++; if (SHOTS && !shotTaken && lit > 3){ shotTaken = true; await page.screenshot({ path: path.join(SHOTS, 'hold-' + RUN + '.png') }).catch(() => {}); } }
    for (const f of s.fresh){
      if (seen.has(f.id)) continue;
      seen.add(f.id); arrivals++;
      for (const [x, z] of s.civ) worstCiv = Math.min(worstCiv, Math.hypot(f.x - x, f.z - z));
      worstHero = Math.min(worstHero, Math.hypot(f.x - s.px, f.z - s.pz));
      if (!s.hot.some(([x, z]) => Math.hypot(f.x - x, f.z - z) < 14)) unwarned++;
    }
    if (s.gt - t0 >= seconds || s.mode !== 'play') break;
    await page.waitForTimeout(100);
  }
  return { worstCiv, worstHero, arrivals, unwarned };
}

let RUN = '';
try {
  let page = null, hero = null;
  for (const [h, mid, i, evac] of RUNS){
    RUN = mid + '-' + i;
    if (h !== hero){
      if (page) await page.close();
      page = await open(h); hero = h;
      await page.click('#hero-' + h); await page.click('#mode-campaign');
      await toPlay(page);
    }
    await page.evaluate(([m, i]) => GAME.startMission(m, i), [mid, i]);
    await toPlay(page);
    let ready = false;
    for (let k = 0; k < 200 && !(ready = await page.evaluate(past)); k++) await page.waitForTimeout(400);
    if (!ready){ errors.push(RUN + ': the hold never began'); continue; }
    const lanes = await page.evaluate(() => {
      const M = GAME.missionState(), P = M.o.evacuees && M.o.evacuees.path;
      const segD = (px, pz, a, b) => { const dx = b[0]-a[0], dz = b[1]-a[1], l = dx*dx + dz*dz; const t = l ? Math.max(0, Math.min(1, ((px-a[0])*dx + (pz-a[1])*dz) / l)) : 0; return Math.hypot(px-a[0]-dx*t, pz-a[1]-dz*t); };
      return M.s.lanes.map(l => ({ x: l.x, z: l.z, hidden: l.hidden, clear: P ? Math.min(...P.slice(1).map((b, j) => segD(l.x, l.z, P[j], b))) : null }));
    });
    const r = await play(page, SECONDS);
    const minClear = lanes.reduce((m, l) => l.clear == null ? m : Math.min(m, l.clear), 99);
    const bad = [];
    if (!lanes.length) bad.push('no lanes');
    if (evac && minClear < 12.9) bad.push('a lane ' + minClear.toFixed(1) + ' m from the walk');
    if (evac && r.worstCiv < 8.5) bad.push('a foe arrived ' + r.worstCiv.toFixed(1) + ' m from the line');
    if (r.worstHero < 5.5) bad.push('a foe arrived ' + r.worstHero.toFixed(1) + ' m from the hero');
    if (r.unwarned) bad.push(r.unwarned + ' arrival(s) with no lit lane');
    if (!r.arrivals) bad.push('no wave came');
    console.log((bad.length ? 'FAIL ' : 'ok   ') + RUN.padEnd(16) + h.padEnd(8) + 'lanes ' + lanes.length + ' (' + lanes.filter(l => l.hidden).length + ' out of sight)'
      + (evac ? ' · lane→walk ' + minClear.toFixed(1) + ' m · nearest arrival to the line ' + (r.worstCiv > 98 ? '-' : r.worstCiv.toFixed(1) + ' m') : ' · no evacuees')
      + ' · to the hero ' + r.worstHero.toFixed(1) + ' m · arrivals ' + r.arrivals + (bad.length ? ' · ' + bad.join(', ') : ''));
    if (process.env.VERBOSE) console.log('      lanes ' + lanes.map(l => '[' + l.x.toFixed(1) + ', ' + l.z.toFixed(1) + (l.hidden ? ' hidden' : '') + ']').join(' '));
    for (const b of bad) errors.push(RUN + ': ' + b);
  }
  if (page) await page.close();
} finally {
  await browser.close();
}
if (errors.length){ console.error('\n' + errors.length + ' problem(s):\n' + errors.slice(0, 30).join('\n')); process.exit(1); }
console.log('\nholds smoke ok');
