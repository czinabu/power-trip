// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MISSION TWISTS SMOKE TEST — every objective with a signature twist (data/missions.js `twist`, game/twists.js and
// game/twists/) on the BUILT game: start its mission at that objective as a hero who plays it, stand on the objective,
// push its progress along so the twist's later beats come, and check the twist is running and has put something in
// the world (an event, a prop). Then the same in co-op, on a guest's screen. Fails on any page or console error.
// SHOTS=<dir> saves a screenshot of each. ONLY=kind,kind… runs just those.
//   npm run build && npm run smoke:twists

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = +(process.env.PEER_PORT || 9024);
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=' + PORT;
const SHOTS = process.env.SHOTS, ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const W = SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 };
const poll = { timeout: 150000, polling: 250 };
const SECONDS = +(process.env.TWIST_SECONDS || 16);
// [hero, mission, twist kind]
const RUNS = [
  ['jedi', 'refuge', 'barrage'], ['mando', 'covert', 'gap'], ['jedi', 'academy', 'stragglers'], ['mando', 'gallows', 'list'],
  ['mando', 'holdfast', 'stalker'], ['jedi', 'strike', 'standard'], ['jedi', 'grassland', 'minefield'], ['jedi', 'breakout', 'searchlight'],
  ['jedi', 'pens', 'cage'], ['jedi', 'jedha-night', 'pulse'], ['jedi', 'chains', 'vael'],
  ['trooper', 'order66', 'marked'], ['trooper', 'chipfiles', 'decompress'], ['trooper', 'drowned', 'tide'], ['trooper', 'chipworks', 'stamp'],
  ['trooper', 'warcamp', 'gunship'], ['trooper', 'hunt', 'rockslide'], ['trooper', 'lastassault', 'guns'], ['trooper', 'broadcast', 'signal'],
].filter(r => !ONLY || ONLY.includes(r[2]));

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
// a mission's objective with this twist
const twistAt = (page, mid, kind) => page.evaluate(([m, k]) => GAME.MISSIONS[m].objectives.findIndex(o => o.twist && o.twist.kind === k), [mid, kind]);

// a few game seconds of the objective: the hero kept standing and on it, its progress pushed along at a steady clip
async function play(page, seconds, push = true){
  const t0 = await page.evaluate(() => GAME.G.gt);
  for (const r0 = Date.now(); Date.now() - r0 < 360000;){   // (headless WebGL is slow: up to six minutes of wall time)
    const s = await page.evaluate(([push]) => {
      const { G, player } = GAME, M = GAME.missionState();
      player.hp = Math.max(player.hp, 1e3);
      if (G.cutscene) GAME.cutscene.skipScene();
      if (G.paused){ const o = document.getElementById('goText'); if (o) o.click(); }
      const o = M.o, S = M.s;
      if (push && o && S){
        // stand on the objective (where the twist's teeth are), and move its clock along
        const at = o.kind === 'hold' ? o.at : o.kind === 'sabotage' ? (S.cons.find(c => !c.done) || {}) : o.kind === 'capture' && S.cur ? S.cur : null;
        const x = Array.isArray(at) ? at[0] : at && at.x, z = Array.isArray(at) ? at[1] : at && at.z;
        if (x != null && G.gt - (window.__tp || 0) > 3){ window.__tp = G.gt; player.group.position.set(x + 1, 0, z + 1); }
        if (o.kind === 'hold') S.prog = Math.min(o.time * 0.9, S.prog + o.time * 0.004);
        if (o.kind === 'escort' && S.P) S.d = Math.min(S.P.len * 0.9, S.d + S.P.len * 0.004);
        if (o.kind === 'capture' && S.cur) S.cur.prog = Math.min(o.time - 0.05, S.cur.prog + 0.05);
      }
      return { gt: G.gt, mode: G.mode, tw: GAME.twistState() };
    }, [push]);
    if (s.gt - t0 >= seconds || s.mode !== 'play') return s;
    await page.waitForTimeout(150);
  }
  return page.evaluate(() => ({ tw: GAME.twistState() }));
}

const rows = [];
try {
  let page = null, hero = null;
  for (const [h, mid, kind] of RUNS){
    if (h !== hero){
      if (page) await page.close();
      page = await open(h); hero = h;
      await page.click('#hero-' + h); await page.click('#mode-campaign');   // into a run first (a mission starts from inside one)
      await toPlay(page);
    }
    const i = await twistAt(page, mid, kind);
    if (i < 0){ errors.push(mid + ': no objective with a ' + kind + ' twist'); continue; }
    const ev0 = await page.evaluate(() => GAME.twistState().events);   // (its count runs on across missions)
    await page.evaluate(([m, i]) => GAME.startMission(m, i), [mid, i]);
    await toPlay(page);
    for (let k = 0; k < 200 && !(await page.evaluate(() => {   // past its scenes and cards, to the objective
      if (GAME.G.cutscene) GAME.cutscene.skipScene();
      const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click();
      if (GAME.G.paused){ const o = document.getElementById('goText'); if (o) o.click(); }
      return !!GAME.missionState().o;
    })); k++) await page.waitForTimeout(400);
    if (!(await page.evaluate(() => !!GAME.missionState().o))){ errors.push(mid + ': its objective never began (' + await page.evaluate(() => JSON.stringify({ mode: GAME.G.mode, paused: GAME.G.paused, cut: !!GAME.G.cutscene, i: GAME.missionState().i, on: GAME.missionState().on }))+ ')'); continue; }
    const s = await play(page, SECONDS);
    await shot(page, kind + '-' + mid);
    const tw = s.tw || {}; tw.events -= ev0;
    const ok = tw.kind === kind && (tw.events > 0 || tw.props > 0 || tw.k > 0.05);   // (an event, a prop, or its mood: the listing deck has only the last)
    rows.push({ mission: mid, hero: h, kind, running: tw.kind, events: tw.events, props: tw.props, ok });
    console.log((ok ? 'ok   ' : 'FAIL ') + kind.padEnd(12) + mid.padEnd(13) + h.padEnd(8) + 'events ' + tw.events + ' · props ' + tw.props + ' · t ' + (tw.t || 0).toFixed(1));
    if (!ok) errors.push(mid + ': the ' + kind + ' twist ' + (tw.kind !== kind ? 'was not running (' + tw.kind + ')' : 'put nothing in the world'));
    // and it lets go cleanly when the objective is done
    await page.evaluate(() => GAME.skipObjective());
    await page.waitForTimeout(400);
  }
  if (page) await page.close();

  /* ---------- co-op: the host's twist on the guest's screen (its events, its own state) ---------- */
  if (!ONLY || ONLY.includes('barrage')){
    const host = await open('host'), guest = await open('guest');
    await host.click('#mode-coop'); await host.click('#coophost');
    await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
    const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
    await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
    for (const p of [host, guest]) await p.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
    await host.click('#coopclose');
    await host.evaluate(() => localStorage.setItem('sw_mission_refuge_jedi', '1'));
    await host.click('#hero-jedi'); await host.click('#mode-mission'); await host.click('#msn-refuge');
    await toPlay(host);
    // the guest sees the run and joins it
    await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
    await guest.click('#coopclose'); await guest.click('#hero-mando');
    await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
    await toPlay(guest);
    const i = await twistAt(host, 'refuge', 'barrage');
    await host.evaluate(i => GAME.startMission('refuge', i), i);
    // both past the scenes, until the guest is running the host's twist
    const past = () => { if (GAME.G.cutscene) GAME.cutscene.skipScene(); if (GAME.G.paused){ const o = document.getElementById('goText'); if (o) o.click(); } return GAME.twistState().kind; };
    for (let k = 0; k < 200 && (await host.evaluate(past), await guest.evaluate(past)) !== 'barrage'; k++) await host.waitForTimeout(400);
    await Promise.all([play(host, 14), play(guest, 14, false)]);
    await shot(guest, 'coop-guest-barrage');
    const g = await guest.evaluate(() => GAME.twistState());
    console.log('co-op guest: ' + g.kind + ' · events ' + g.events + ' · props ' + g.props);
    if (g.kind !== 'barrage' || !(g.events > 0)) errors.push('co-op: the guest never saw the host\'s shells (' + JSON.stringify({ kind: g.kind, events: g.events }) + ')');
  }
} catch(e){ errors.push(e.stack || e.message); }

await browser.close(); server.close?.();
if (errors.length){ console.error('\nTWISTS FAILED:\n' + [...new Set(errors)].slice(0, 30).join('\n')); process.exit(1); }
console.log('\nall ' + rows.length + ' twists ran' + (SHOTS ? ' (shots in ' + SHOTS + ')' : ''));
process.exit(0);
