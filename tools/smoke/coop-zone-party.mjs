// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP OPEN ZONE PARTY SMOKE TEST — a host and two guests on the BUILT game roam the old city of Jedha together
// (game/zone.js): all three answer the ready check and land in their own seats, each sees the other two, and they share
// one side quest (game/zone-quests.js). One guest asks the old pilgrim for it, the other lights the lamps, the host
// beats the scavengers, and when the first guest tells the pilgrim it's done, the quest counts as a side mission won on
// every hero's own profile.
//   npm run build && npm run smoke:coop-zone-party          (SHOTS=<dir> also saves the host's view of the party)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9037';
const server = PeerServer({ port: 9037, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 150000, polling: 250 };   // three pages share the CPU, only one in the foreground
const step = (what) => console.log('ok   ' + what);
const HEROES = ['jedi', 'trooper', 'mando'];

const SHOTS = process.env.SHOTS;
// cleared: the chapters this save has closed, per hero (the host has closed Act I, which opens Jedha: game/zone-gate.js;
// a guest on a brand-new save still goes along with them)
async function open(name, cleared = {}){
  const page = await browser.newPage({ viewport: { width: 400, height: 225 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript((cleared) => {
    try { for (const h in cleared) localStorage.setItem('sw_camp_ch_' + h, JSON.stringify(cleared[h])); localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, cleared);
  await page.goto(url, { timeout: 120000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const inHub = (page) => page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, poll);
const inZone = (page) => page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.zone === 'jedha' && !GAME.G.hub && !GAME.G.paused, null, poll);
const stand = (page, x, z, yaw = Math.PI) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.6, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); G.yaw = player.faceYaw = yaw; player.hp = 9999; }, [x, z, yaw]);
const tapF = async (page) => { await page.bringToFront(); await page.keyboard.down('f'); await page.waitForTimeout(600); await page.keyboard.up('f'); };
const quest = (page) => page.evaluate(() => GAME.zone.zoneQuest());
const godly = (page) => page.evaluate(() => { setInterval(() => { if (GAME.G.mode === 'play' && GAME.player.hp < 500) GAME.player.hp = 9999; }, 100); });

let ok = false;
try {
  const host = await open('host', { [HEROES[0]]: ['siege', 'archive', 'refuge', 'trial-first'] }), g1 = await open('guest1'), g2 = await open('guest2');
  const all = [host, g1, g2], guests = [g1, g2];
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  for (const g of guests){ await g.click('#mode-coop'); await g.fill('#coopcode', code); await g.click('#coopjoin'); await connected(g); }
  await host.waitForFunction(() => /3 of 4/.test(document.getElementById('coopstatus').textContent), null, poll);
  await host.click('#coopclose');
  step('two guests join the host');

  // into the host's hub, then the ready check at the council table, and all three into the city
  await host.$eval('#hero-' + HEROES[0], el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
  await inHub(host);
  for (const [i, g] of guests.entries()){
    await g.waitForFunction(() => getComputedStyle(document.getElementById('coopjointemple')).display !== 'none', null, poll);
    await g.$eval('#hero-' + HEROES[i + 1], el => el.click());
    await g.click('#coopjointemple');
    await inHub(g);
  }
  step('all three in the host\'s hub');
  await host.evaluate(() => GAME.hub.goWing('council')); await host.waitForFunction(() => GAME.G.hubWing === 'council' && !GAME.G.paused, null, poll);
  await stand(host, 0, 7);
  const gt = await host.evaluate(() => GAME.G.gt);
  await host.waitForFunction((gt) => GAME.G.gt > gt + 0.15 && document.getElementById('hubp').classList.contains('on'), gt, poll);
  await tapF(host);
  await host.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, poll);
  await host.locator('#hubpanel .hb-o', { hasText: 'OPEN ZONE' }).first().click();
  for (const g of guests){
    await g.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open') && /JEDHA/.test(document.getElementById('hubpanel').textContent), null, poll);
    await g.locator('#hubpanel .hb-o', { hasText: 'READY' }).first().click();
  }
  for (const p of all) await inZone(p);
  for (const p of all) await godly(p);
  step('the ready check goes round, and all three land in the old city');
  const seats = await Promise.all(all.map(p => p.evaluate(() => [GAME.player.group.position.x, GAME.player.group.position.z])));
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) if (Math.hypot(seats[a][0] - seats[b][0], seats[a][1] - seats[b][1]) < 1.5) throw new Error('two heroes landed on the same spot: ' + JSON.stringify(seats));
  step('each lands in their own seat');
  for (const p of all) await p.waitForFunction(() => GAME.partnerInfo().all.filter(P => P.shown).length === 2, null, poll);
  step('each sees the other two');
  if (SHOTS){   // the two guests in front of the host, on the landing pad by the gate
    await host.setViewportSize({ width: 960, height: 540 });
    await stand(host, 0, 104, Math.PI); await stand(g1, -1.6, 98, 0.3); await stand(g2, 1.6, 97.5, -0.3);
    await host.bringToFront(); await host.waitForTimeout(15000);
    await host.screenshot({ path: path.join(SHOTS, 'zone-party.png') });
    await host.setViewportSize({ width: 400, height: 225 });
  }

  // ONE QUEST FOR THE PARTY: the first guest asks the old pilgrim
  const gv = await g1.evaluate(() => GAME.zone.zoneGivers().find(g => g.id === 'lamps'));
  await stand(g1, gv.x, gv.z + 1.6);
  await g1.waitForFunction(() => /SIDE QUEST/.test(document.getElementById('zoneqp').textContent), null, poll);
  await tapF(g1);
  for (const p of all) await p.waitForFunction(() => GAME.zone.zoneQuest()?.id === 'lamps', null, poll);
  step('a guest asks the old pilgrim, and the quest is on every screen');
  // the other guest lights the lamps
  const lamps = await g2.evaluate(() => GAME.zone.zoneQuestMarks().filter(m => m.kind === 'obj'));
  if (lamps.length !== 3) throw new Error('the guest should be shown the three lamps: ' + JSON.stringify(lamps));
  for (const { x, z } of lamps){
    const marks = await host.evaluate(() => GAME.zone.zoneQuest() && GAME.zone.zoneQuest().got.length);
    await stand(g2, x, z + 1);
    await g2.waitForFunction(() => /LAMP/.test(document.getElementById('zoneqp').textContent), null, { timeout: 30000, polling: 250 }).catch(async () => { await stand(g2, x + 1, z); });
    // (a page in the background draws a frame only now and then: press again until the host has it)
    const lit = (ms) => host.waitForFunction((n) => { const q = GAME.zone.zoneQuest(); return !q || q.i > 0 || q.got.length > n; }, marks, { timeout: ms, polling: 250 }).then(() => true, () => false);
    for (let k = 0; k < 6; k++){ await tapF(g2); if (await lit(15000)) break; }
    await lit(1000) || (() => { throw new Error('the lamp at ' + x + ', ' + z + ' was not lit'); })();
  }
  for (const p of all) await p.waitForFunction(() => GAME.zone.zoneQuest()?.i === 1, null, poll);
  step('the other guest lights the three lamps, and the step moves on for everyone');
  // the host beats the scavengers
  await stand(host, -80, 96);
  await host.waitForFunction(() => GAME.enemies.some(e => e.zq === 'lamps' && !e.dead), null, poll);
  await g2.waitForFunction(() => GAME.enemies.some(e => !e.dead), null, poll);
  await host.evaluate(() => { for (const e of GAME.enemies) if (e.zq && !e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });
  for (const p of all) await p.waitForFunction(() => GAME.zone.zoneQuest()?.i === 2, null, poll);
  step('the scavengers come, the guests see them, the host beats them');
  // the first guest tells the pilgrim: done on all three profiles
  const before = await Promise.all(all.map(p => p.evaluate(() => GAME.PROFILE.sidesWon())));
  await stand(g1, gv.x, gv.z + 1.6);
  await g1.waitForFunction(() => /DONE/.test(document.getElementById('zoneqp').textContent), null, poll);
  await tapF(g1);
  for (const p of all) await p.waitForFunction(() => !GAME.zone.zoneQuest(), null, poll);
  for (const [i, p] of all.entries()) await p.waitForFunction((n) => GAME.PROFILE.sideWon('zone:jedha:lamps') && GAME.PROFILE.sidesWon() === n + 1, before[i], poll);
  step('the pilgrim is told, and it counts as a side mission won for every hero');
  ok = !errors.length;
} catch(e){ console.log('FAIL ' + e.message); for (const p of browser.contexts().flatMap(c => c.pages())) console.log(JSON.stringify(await p.evaluate(() => ({ q: GAME.zone.zoneQuest(), prompt: document.getElementById('zoneqp').textContent, at: [GAME.player.group.position.x, GAME.player.group.position.z], guest: GAME.G.coopGuest })).catch(x => x.message))); }
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close(); server.close?.();
console.log(ok ? 'PASS co-op zone party' : 'FAIL co-op zone party');
process.exit(ok ? 0 : 1);
