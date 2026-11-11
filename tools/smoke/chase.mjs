// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ZONE CHASE SMOKE TEST (game/zone-chase.js) on the BUILT game: the old city of Jedha's courier, run down end to end.
//   · SOLO: the gate warden's quest starts the chase; left alone, the courier gets away and bolts again from the start;
//     kept on his heels, he shuts each styled gate behind him (it is solid, and its lock opens it), and a hero who gets
//     to him catches him; the fight is where he was caught, and back at the warden it counts as a side mission won.
//   · CO-OP: a guest in the host's city draws the host's courier and its gates, and sees him caught.
// Fails on any page or console error. SHOTS=<dir> saves a screenshot at each beat.
//   npm run build && npm run smoke:chase

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = +(process.env.PEER_PORT || 9032);
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=' + PORT;
const SHOTS = process.env.SHOTS;
const VIEW = SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 };
const poll = { timeout: 180000, polling: 250 };
const server = PeerServer({ port: PORT, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function open(name, cleared){
  const page = await browser.newPage({ viewport: VIEW });
  page.on('pageerror', e => errors.push(name + ': ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(([q, cleared]) => {
    try {
      localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
      if (cleared) localStorage.setItem('sw_camp_ch_jedi', JSON.stringify(['siege', 'archive', 'refuge', 'trial-first']));
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, [SHOTS ? 'medium' : 'low', cleared]);
  await page.addInitScript('window.__heel = ' + heel.toString());
  await page.goto(url, { timeout: 180000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const shot = async (page, name) => { if (SHOTS){ await page.bringToFront(); await page.screenshot({ path: path.join(SHOTS, name + '.png'), timeout: 180000 }).catch(() => {}); } };
const state = (page) => page.evaluate(() => GAME.chase.state());
const quest = (page) => page.evaluate(() => GAME.zone.zoneQuest());
const stand = (page, x, z, yaw) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.6, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; if (yaw != null) G.yaw = player.faceYaw = yaw; player.hp = 9999; }, [x, z, yaw]);
const tapF = async (page) => { await page.bringToFront(); await page.keyboard.down('f'); await page.waitForTimeout(500); await page.keyboard.up('f'); };
const inZone = (page) => page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.zone === 'jedha' && !GAME.G.paused, null, poll);
// run the game until fn (in the page) is truthy, or `seconds` of game time pass; each poll keeps the hero standing
async function until(page, fn, seconds, what, arg){
  const t0 = await page.evaluate(() => GAME.G.gt);
  for (const r0 = Date.now(); Date.now() - r0 < 420000;){
    await page.evaluate(() => { GAME.player.hp = Math.max(GAME.player.hp, 9999); });
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    if ((await page.evaluate(() => GAME.G.gt)) - t0 > seconds) break;
    await page.waitForTimeout(150);
  }
  throw new Error('chase: ' + what + ' never happened (' + JSON.stringify(await state(page)) + ')');
}
// a hero 6 m behind the courier, on his route
const heel = function(){ const c = GAME.chase.state(); if (!c || !c.q) return; const [x, z] = c.q, p = GAME.player.group.position, d = Math.hypot(x - p.x, z - p.z) || 1;
  if (d > 8 || d < 4) p.set(x + (p.x - x) / d * 6, 0.6, z + (p.z - z) / d * 6); GAME.player.vel.set(0, 0, 0); GAME.G.yaw = GAME.player.faceYaw = Math.atan2(x - p.x, z - p.z); };

try {
  /* ---------- SOLO ---------- */
  const page = await open('solo');
  await page.$eval('#hero-jedi', el => el.click()); await page.$eval('#mode-temple', el => el.click()); await page.click('#goText');
  await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, poll);
  await page.evaluate(() => GAME.zone.startZone('jedha'));
  await inZone(page);
  const gv = await page.evaluate(() => GAME.zone.zoneGivers().find(g => g.id === 'courier'));
  if (!gv) throw new Error('nobody in Jedha gives the courier chase');
  await stand(page, gv.x, gv.z - 1.6, 0);
  await page.waitForFunction(() => /SIDE QUEST/.test(document.getElementById('zoneqp').textContent), null, poll);
  await tapF(page);
  await until(page, () => GAME.chase.state() && GAME.chase.state().state === 'run', 10, 'the chase beginning');
  const sidesBefore = await page.evaluate(() => GAME.PROFILE.sidesWon());
  console.log('ok   the warden\'s quest starts the chase');
  // left alone, he gets away, and bolts again from the start
  await until(page, () => GAME.chase.state().state === 'lost', 45, 'the courier getting away');
  await until(page, () => GAME.chase.state().state === 'run' && GAME.chase.state().d < 6, 10, 'the courier bolting again');
  console.log('ok   left behind, he gets away and bolts again from the start');
  // on his heels: each gate shuts behind him, is solid, and its lock opens it
  const gates = (await state(page)).gates.length;
  if (gates !== 3) throw new Error('the courier\'s route has ' + gates + ' gates, not 3');
  for (let k = 0; k < gates; k++){
    await until(page, (k) => { window.__heel(); return GAME.chase.state().gates[k].shut; }, 60, 'gate ' + (k + 1) + ' shutting', k);
    const c = await state(page), g = c.gates[k];
    if (k === 0) await shot(page, 'chase-1-gate');
    // solid: a hero walked into it from the near side doesn't come out the far side
    const pass = await page.evaluate(([gx, gz]) => {
      const c = GAME.chase.state(), [qx, qz] = c.q, p = GAME.player.group.position;
      const dx = qx - gx, dz = qz - gz, l = Math.hypot(dx, dz) || 1;
      return { from: [gx - dx / l * 3, gz - dz / l * 3], to: [dx / l, dz / l] };
    }, [g.x, g.z]);
    await stand(page, pass.from[0], pass.from[1], Math.atan2(pass.to[0], pass.to[1]));
    await page.evaluate(([ux, uz]) => { const t = Date.now(); window.__push = setInterval(() => { GAME.player.vel.set(ux * 8, 0, uz * 8); if (Date.now() - t > 1500) clearInterval(window.__push); }, 16); }, pass.to);
    await page.waitForTimeout(1800);
    const through = await page.evaluate(([gx, gz, ux, uz]) => { const p = GAME.player.group.position; return (p.x - gx) * ux + (p.z - gz) * uz; }, [g.x, g.z, pass.to[0], pass.to[1]]);
    const gs = (await state(page)).gates[k];
    if (through > 2.6 && gs.shut) throw new Error('walked through shut gate ' + (k + 1) + ' (' + g.style + '): ' + through.toFixed(2) + ' m past it');
    await until(page, (k) => { if (!GAME.chase.state()) return 'gone'; const g = GAME.chase.state().gates[k]; GAME.player.group.position.set(g.x, 0.6, g.z); return g.open; }, 20, 'gate ' + (k + 1) + ' (' + g.style + ') opened', k);
    if (k === 0) await shot(page, 'chase-2-gate-work');
  }
  console.log('ok   ' + gates + ' gates shut behind him, held, and opened');
  // caught: a hero gets to him
  await until(page, () => { const c = GAME.chase.state(); if (!c) return true; if (c.q) GAME.player.group.position.set(c.q[0], 0.6, c.q[1] - 1); return c.state === 'done' || GAME.zone.zoneQuest().i > 0; }, 30, 'the courier caught');
  const q1 = await until(page, () => { const q = GAME.zone.zoneQuest(); return q && q.i === 1 && q; }, 10, 'the quest moving on to the fight');
  if (await state(page)) throw new Error('the courier is still running after he was caught');
  await until(page, () => GAME.enemies.some(e => e.zq === 'courier' && !e.dead), 20, 'his escort coming');
  // the fight is where he was stopped (caught, or cornered at the end of his run)
  const where = await page.evaluate(() => { const at = GAME.zone.zoneQuest().at, f = GAME.enemies.filter(e => e.zq === 'courier' && !e.dead); return at ? Math.max(...f.map(e => Math.hypot(e.group.position.x - at[0], e.group.position.z - at[1]))) : 999; });
  if (where > 12) throw new Error('the fight is not where he was stopped (' + where.toFixed(1) + ' m away)');
  await shot(page, 'chase-3-caught');
  await page.evaluate(() => { for (const e of GAME.enemies) if (e.zq && !e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });
  await until(page, () => GAME.zone.zoneQuest().i === 2, 10, 'the escort beaten');
  await stand(page, gv.x, gv.z - 1.6, 0);
  await page.waitForFunction(() => /DONE/.test(document.getElementById('zoneqp').textContent), null, poll);
  await tapF(page);
  await until(page, (n) => !GAME.zone.zoneQuest() && GAME.PROFILE.sidesWon() === n + 1, 10, 'the quest counting as a side mission won', sidesBefore);
  console.log('ok   solo: stopped him, beat the escort where he stood, and the warden counts it');
  await page.close();

  /* ---------- CO-OP ---------- */
  const host = await open('host', true), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  for (const p of [host, guest]) await p.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
  await host.click('#coopclose');
  await host.$eval('#hero-jedi', el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
  await host.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, poll);
  await guest.waitForFunction(() => getComputedStyle(document.getElementById('coopjointemple')).display !== 'none', null, poll);
  await guest.$eval('#hero-trooper', el => el.click()); await guest.click('#coopjointemple');
  await guest.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, poll);
  await host.evaluate(() => GAME.hub.goWing('council')); await host.waitForFunction(() => GAME.G.hubWing === 'council' && !GAME.G.paused, null, poll);
  await stand(host, 0, 7);
  await host.waitForFunction(() => document.getElementById('hubp').classList.contains('on'), null, poll);
  await tapF(host);
  await host.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, poll);
  await host.locator('#hubpanel .hb-o', { hasText: 'OPEN ZONE' }).first().click();
  await guest.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open') && /JEDHA/.test(document.getElementById('hubpanel').textContent), null, poll);
  await guest.locator('#hubpanel .hb-o', { hasText: 'READY' }).first().click();
  for (const p of [host, guest]) await inZone(p);
  // the guest asks the warden; the host runs it
  const gw = await guest.evaluate(() => GAME.zone.zoneGivers().find(g => g.id === 'courier'));
  await stand(guest, gw.x, gw.z - 1.6, 0);
  await guest.waitForFunction(() => /SIDE QUEST/.test(document.getElementById('zoneqp').textContent), null, poll);
  await tapF(guest);
  await until(host, () => GAME.chase.state() && GAME.chase.state().host, 30, 'the host running the chase');
  await until(guest, () => { const c = GAME.chase.state(); return c && !c.host && c.d > 3; }, 60, 'the guest drawing the host\'s courier');
  await until(host, () => { window.__heel(); return GAME.chase.state().gates[0].shut; }, 60, 'the host\'s first gate shutting');
  await until(guest, () => GAME.chase.state().gates[0].shut, 30, 'the guest seeing the gate shut');
  await shot(guest, 'chase-4-coop-guest');
  // the guest works it open (the host's lock counts the guest's hero)
  await until(guest, () => { const g = GAME.chase.state().gates[0]; GAME.player.group.position.set(g.x, 0.6, g.z); return g.open; }, 40, 'the guest opening the gate');
  await until(host, () => { const c = GAME.chase.state(); if (!c) return true; GAME.player.group.position.set(c.q[0], 0.6, c.q[1] - 1); return c.state === 'done'; }, 30, 'the host catching him');
  await until(guest, () => !GAME.chase.state() && GAME.zone.zoneQuest() && GAME.zone.zoneQuest().i === 1, 30, 'the guest seeing him caught');
  console.log('ok   co-op: the guest drew the host\'s courier and gate, opened it, and saw him caught');
} catch(e){ errors.push(e.stack || e.message); }

await browser.close(); server.close?.();
if (errors.length){ console.error('\nCHASE FAILED:\n' + [...new Set(errors)].slice(0, 30).join('\n')); process.exit(1); }
console.log('\nthe zone chase ran through' + (SHOTS ? ' (shots in ' + SHOTS + ')' : ''));
process.exit(0);
