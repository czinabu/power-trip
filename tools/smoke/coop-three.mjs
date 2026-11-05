// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP THREE-PLAYER SMOKE TEST — a host and two guests on the BUILT game, in a shared Survival run:
//   · a guest in a menu (paused) is safe: a blow meant for them doesn't land, and the others see them as away
//   · a guest who falls with no second chance left while the others stand is OUT, not finished, and rises once the
//     wave is down (game/revive.js)
//   · the host leaves: the first guest takes the room over under the same code, and the second rejoins it, fighting
//     the new host's foes (net/session.js HOST HANDOFF, net/foes.js takeOver)
//   npm run build && npm run smoke:coop-three

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9023';
const server = PeerServer({ port: 9023, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 60000, polling: 250 };   // on a timer: only one page is in the foreground

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
          localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_camp_mando', '1'); } catch(e){}   // Survival unlocked
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url, { timeout: 120000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { ...poll, timeout: 120000 });
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const play = async (page) => {
  for (let i = 0; i < 8 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
};
// slow headless pages leave heroes standing in the fight a long while: keep them up, unless a check wants them to fall
const keepUp = (page) => page.evaluate(() => { setInterval(() => { if (GAME.G.mode === 'play' && GAME.player.hp < 50 && !GAME.player.downed && !window.letFall) GAME.player.hp = 100; }, 100); });

let ok = false;
try {
  const host = await open('host'), g1 = await open('guest1'), g2 = await open('guest2');
  await host.bringToFront();
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  for (const g of [g1, g2]){ await g.bringToFront(); await g.click('#mode-coop'); await g.fill('#coopcode', code); await g.click('#coopjoin'); await connected(g); }
  await host.waitForFunction(() => /3 of 4 players/.test(document.getElementById('coopstatus').textContent), null, poll);
  await host.click('#coopclose');
  await host.$eval('#hero-jedi', el => el.click()); await host.click('#mode-endless');
  await play(host); await keepUp(host);
  for (const [g, hero] of [[g1, '#hero-mando'], [g2, '#hero-trooper']]){
    await g.bringToFront();
    await g.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
    await g.click('#coopclose'); await g.$eval(hero, el => el.click());
    await g.click('#mode-coop'); await g.click('#coopjoinrun');
    await play(g); await keepUp(g);
    if (!(await g.evaluate(() => GAME.G.coopGuest))) throw new Error('a guest did not join the host\'s run');
  }
  await host.waitForFunction(() => { const a = GAME.partnerInfo().all; return a.length === 2 && a.every(p => p.shown && p.posed); }, null, poll);
  await host.waitForFunction(() => GAME.enemies.length >= 2, null, poll);
  const slot = (page) => page.evaluate(() => GAME.coopNet.slot);
  const seen = await host.evaluate(() => GAME.partnerInfo().all.map(p => p.slot));
  for (const g of [g1, g2]) await g.waitForFunction((seen) => seen.includes(GAME.coopNet.slot), seen, poll).catch(() => {});   // (each guest knows its seat)
  const s1 = await slot(g1), s2 = await slot(g2);
  if (!seen.includes(s1) || !seen.includes(s2)) throw new Error('the guests\' seats ' + [s1, s2] + ' are not the host\'s ' + seen);

  // PAUSED: safe, and shown as away
  await g1.evaluate(() => { GAME.G.paused = true; });
  await host.waitForFunction((s) => GAME.partnerInfo().all.find(p => p.slot === s).away, s1, poll);
  const hp1 = await g1.evaluate(() => GAME.player.hp);
  await host.evaluate((s) => { const e = GAME.enemies[0]; e.hero = GAME.partnerMate(s); GAME.coopHooks.hurt(e, 8, e.group.position, 'melee', true); }, s1);
  await host.waitForTimeout(1500);
  if ((await g1.evaluate(() => GAME.player.hp)) < hp1) throw new Error('a blow landed on a paused guest');
  await g1.evaluate(() => { GAME.G.paused = false; });
  await host.waitForFunction((s) => !GAME.partnerInfo().all.find(p => p.slot === s).away, s1, poll);

  // OUT: no second chance left, the others standing: out of the fight, not the run; up once the wave is down
  await g2.evaluate(() => { window.letFall = true; GAME.G.reviveLeft = 0; GAME.player.phoenixReady = false; GAME.player.reviveGuardT = 0; GAME.player.awayAt = -1e9; });
  await host.evaluate((s) => { const e = GAME.enemies[0]; e.hero = GAME.partnerMate(s); GAME.coopHooks.hurt(e, 99999, e.group.position, 'melee', true); }, s2);
  await g2.waitForFunction(() => GAME.player.downed && GAME.player.downed.out && GAME.G.mode === 'play', null, poll)
    .catch(async () => { throw new Error('the fallen guest is not OUT: ' + JSON.stringify(await g2.evaluate(() => ({ mode: GAME.G.mode, downed: !!GAME.player.downed, hp: GAME.player.hp })))); });
  await host.waitForFunction((s) => GAME.partnerInfo().all.find(p => p.slot === s).down, s2, poll);
  await host.bringToFront();
  await host.evaluate(() => { for (const e of GAME.enemies) GAME.damageEnemy(e, 99999, null, 0, false, false); GAME.G.spawnQueue.length = 0; });
  await g2.waitForFunction(() => !GAME.player.downed && GAME.player.hp > 0 && GAME.G.mode === 'play', null, { ...poll, timeout: 90000 });
  await g2.evaluate(() => { window.letFall = false; });
  // (the wave's clear may open an upgrade page: close them, as a player would)
  for (const p of [host, g1, g2]) await p.evaluate(() => { const st = document.getElementById('skilltree'); if (st) st.style.display = 'none'; GAME.G.skillSelect = false; });

  // HOST HANDOFF: the host leaves; the first guest takes the room, the second rejoins it and fights its foes
  const heir = s1 < s2 ? g1 : g2, other = heir === g1 ? g2 : g1;
  await host.evaluate(() => document.getElementById('coopleave').click());
  await heir.bringToFront();
  await heir.waitForFunction((c) => GAME.coopNet.role === 'host' && GAME.coopNet.code === c && GAME.G.mode === 'play' && !GAME.G.coopGuest, code, poll)
    .catch(async () => { throw new Error('the first guest did not take the room over: ' + JSON.stringify(await heir.evaluate(() => ({ role: GAME.coopNet.role, status: GAME.coopNet.status, code: GAME.coopNet.code, err: GAME.coopNet.error, mode: GAME.G.mode })))); });
  await other.waitForFunction(() => GAME.coopNet.role === 'guest' && GAME.coopNet.status === 'connected' && GAME.G.coopGuest, null, { ...poll, timeout: 90000 })
    .catch(async () => { throw new Error('the second guest did not rejoin the new host: ' + JSON.stringify(await other.evaluate(() => ({ role: GAME.coopNet.role, status: GAME.coopNet.status, err: GAME.coopNet.error, guest: GAME.G.coopGuest, mode: GAME.G.mode })))); });
  await heir.evaluate(() => { const st = document.getElementById('skilltree'); if (st) st.style.display = 'none'; GAME.G.skillSelect = false; });
  await heir.waitForFunction(() => GAME.enemies.filter(e => !e.net).length >= 2, null, { ...poll, timeout: 90000 })
    .catch(async () => { throw new Error('the new host runs no foes: ' + JSON.stringify(await heir.evaluate(() => ({ phase: GAME.shared.levelPhase, t: GAME.shared.phaseT, wave: GAME.G.endlessWave, sel: GAME.G.skillSelect, picking: GAME.coopRun.guestPicking, q: GAME.G.spawnQueue.length })))); });
  await other.waitForFunction(() => GAME.enemies.filter(e => e.net).length >= 2 && !GAME.enemies.some(e => !e.net), null, poll);
  await heir.waitForFunction(() => GAME.partnerInfo().all.filter(p => p.shown).length === 1, null, poll);
  ok = true;
  console.log('ok   co-op three: a paused guest is safe, a fallen guest is out until the wave is down, and when the host leaves the first guest takes the room and the other rejoins it');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, role: GAME.coopNet.role, status: GAME.coopNet.status, partners: GAME.partnerInfo().all.length, foes: GAME.enemies.length })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op three\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
