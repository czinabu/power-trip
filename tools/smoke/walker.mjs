// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WALKER TAKEDOWN SMOKE TEST (game/walker.js) on the BUILT game: The Trench Line's walker, played start to end.
//   · SOLO: it marches and plants its feet, its guns shell the hero, and standing on each tow point in turn tangles
//     its legs; it goes down, the charge on its neck is set, it falls, and the mission moves on to the next objective
//     with the wreck lying there. A retry past it starts with the wreck already down.
//   · CO-OP: a guest who joins the host's mission draws the host's walker (its own copy, posed from the snapshot),
//     follows it down and sees the wreck.
// Fails on any page or console error. SHOTS=<dir> saves a screenshot at each beat.
//   npm run build && npm run smoke:walker          (ONLY=coop skips the solo run)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = +(process.env.PEER_PORT || 9031);
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=' + PORT;
const SHOTS = process.env.SHOTS;
const VIEW = SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 };
const poll = { timeout: 180000, polling: 250 };
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
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_mission_icefront_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, SHOTS ? 'medium' : 'low');
  await page.goto(url, { timeout: 180000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
async function toPlay(page){
  for (let i = 0; i < 12 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.paused)); i++){
    await page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); if (GAME.G.cutscene) GAME.cutscene.skipScene(); });
    for (const sel of ['#goText', '#trainNo', '#forms [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(700);
  }
}
const past = () => { if (GAME.G.cutscene) GAME.cutscene.skipScene(); const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); if (GAME.G.paused){ const o = document.getElementById('goText'); if (o) o.click(); } };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), timeout: 180000 }).catch(() => {}); };
const state = (page) => page.evaluate(() => GAME.walker.state());
// run the game until fn (in the page) is truthy, or `seconds` of game time pass; each poll keeps the hero standing
async function until(page, fn, seconds, what, arg){
  const t0 = await page.evaluate(() => GAME.G.gt);
  for (const r0 = Date.now(); Date.now() - r0 < 420000;){
    await page.evaluate(past);
    await page.evaluate(() => { GAME.player.hp = Math.max(GAME.player.hp, 1e3); });
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    if ((await page.evaluate(() => GAME.G.gt)) - t0 > seconds) break;
    await page.waitForTimeout(200);
  }
  throw new Error('walker: ' + what + ' never happened (' + JSON.stringify(await state(page)) + ')');
}

try {
  let wi = -1;
  /* ---------- SOLO ---------- */
  if (process.env.ONLY !== 'coop'){
  const page = await open('solo');
  await page.$eval('#hero-jedi', el => el.click()); await page.$eval('#mode-campaign', el => el.click());
  await toPlay(page);
  wi = await page.evaluate(() => GAME.missionById('icefront').objectives.findIndex(o => o.kind === 'walker'));
  if (wi < 0) throw new Error('The Trench Line has no walker objective');
  await page.evaluate(i => GAME.startMission('icefront', i), wi);
  await toPlay(page);
  await until(page, () => GAME.missionState().o && GAME.walker.state(), 60, 'the walker objective beginning');
  const s0 = await state(page);
  if (!s0 || s0.phase !== 'march' || s0.anchors.length !== 3) throw new Error('the walker did not come in on the march: ' + JSON.stringify(s0));
  // it marches, and its feet take turns: one lifts while the rest stay planted
  const d0 = s0.d;
  await until(page, () => GAME.walker.state().feet.some(f => f[1] > 0.5), 20, 'a foot lifting');
  await until(page, (d0) => GAME.walker.state().d > d0 + 3, 20, 'the walker moving along its path', d0);
  // its guns: the hero out in the open gets shelled
  await page.evaluate(() => { const w = GAME.walker.state(); GAME.player.group.position.set(w.x + 2, 0, w.z + 30); });
  await until(page, () => GAME.walker.state().shells > 0, 20, 'its guns firing');
  await shot(page, '1-march');
  // the tow points: stand on each until its leg is tangled
  for (let k = 0; k < 3; k++){
    await until(page, (k) => { const w = GAME.walker.state(), a = w.anchors.filter(a => !a.done)[0]; if (!a) return true; GAME.player.group.position.set(a.x, 0, a.z); return w.anchors.filter(a => a.done).length > k; }, 30, 'tow point ' + (k + 1) + ' tangled', k);
    if (!k) await shot(page, '2-tow-point');
  }
  if ((await state(page)).bound === 0) throw new Error('no leg shows as tangled');
  await until(page, () => GAME.walker.state().phase === 'down', 10, 'the walker going down');
  await shot(page, '3-down');
  // the neck: stand under it until the charge is set, then out of the way
  await until(page, () => { const w = GAME.walker.state(); if (w.phase !== 'down') return true; if (w.neck) GAME.player.group.position.set(w.neck.x, 0, w.neck.z); return false; }, 30, 'the neck charge set');
  await page.evaluate(() => { const w = GAME.walker.state(); GAME.player.group.position.set(w.x - 24, 0, w.z - 4); });
  await until(page, () => GAME.walker.state().phase === 'fall', 10, 'the walker toppling');
  await shot(page, '4-fall');
  await until(page, (i) => GAME.missionState().i === i + 1, 20, 'the mission moving on past the walker', wi);
  const wr = await state(page);
  if (!wr || wr.phase !== 'wreck') throw new Error('no wreck left lying after the walker fell: ' + JSON.stringify(wr));
  await shot(page, '5-wreck');
  console.log('ok   solo: marched, shelled, tangled 3 legs, went down, charge set, fell, the mission moved on');
  // a retry past it: the wreck is there from the start
  await page.evaluate(i => GAME.startMission('icefront', i + 1), wi);
  await toPlay(page);
  const rw = await state(page);
  if (!rw || rw.phase !== 'wreck') throw new Error('a retry past the walker has no wreck: ' + JSON.stringify(rw));
  // and a fresh start has none
  await page.evaluate(() => GAME.startMission('icefront', 0));
  await toPlay(page);
  if (await state(page)) throw new Error('the walker is still standing on a fresh start of the mission');
  console.log('ok   retries: past it, the wreck lies there; from the top, no walker');
  await page.close();
  }

  /* ---------- CO-OP ---------- */
  const host = await open('host'), guest = await open('guest');
  if (wi < 0) wi = await host.evaluate(() => GAME.missionById('icefront').objectives.findIndex(o => o.kind === 'walker'));
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  for (const p of [host, guest]) await p.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
  await host.click('#coopclose');
  await host.$eval('#hero-jedi', el => el.click()); await host.$eval('#mode-mission', el => el.click()); await host.evaluate(() => document.getElementById('msn-icefront').click());   // (its act's fold can be shut)
  await toPlay(host);
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.$eval('#hero-mando', el => el.click());
  await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  await toPlay(guest);
  await host.evaluate(i => GAME.startMission('icefront', i), wi);
  await until(host, () => GAME.walker.state() && GAME.walker.state().phase === 'march', 60, 'the host\'s walker coming in');
  const g = await until(guest, () => { const w = GAME.walker.state(); return w && !w.host && w.anchors.length === 3 && w; }, 60, 'the guest drawing the host\'s walker');
  await until(guest, () => GAME.walker.state().feet.some(f => f[1] > 0.5), 20, 'the guest\'s walker stepping');
  await shot(guest, '6-coop-guest');
  // the host trips it (dev skip): the guest sees it go down, then fall
  await host.evaluate(() => GAME.walker.skipStep());
  await until(guest, () => GAME.walker.state().phase === 'down', 30, 'the guest seeing it go down');
  await host.evaluate(() => GAME.walker.skipStep());
  await until(guest, () => GAME.walker.state().phase === 'wreck', 30, 'the guest seeing the wreck');
  await shot(guest, '7-coop-wreck');
  if (await guest.evaluate(() => GAME.enemies.some(e => !e.net))) throw new Error('the guest is running foes of its own');
  console.log('ok   co-op: the guest drew the host\'s walker (' + g.anchors.map(a => a.style).join(', ') + '), saw it go down and fall');
} catch(e){ errors.push(e.stack || e.message); }

await browser.close(); server.close?.();
if (errors.length){ console.error('\nWALKER FAILED:\n' + [...new Set(errors)].slice(0, 30).join('\n')); process.exit(1); }
console.log('\nthe walker takedown played through' + (SHOTS ? ' (shots in ' + SHOTS + ')' : ''));
process.exit(0);
