// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP GATE RUINS SMOKE TEST — two browsers on the BUILT game roam the ruins of the Sith gate together (the second open
// zone: data/zones.js ZONES.ruins). The host, past Act IV's first chapter, picks it at the council table; the guest, on a
// brand-new save, answers the ready check and follows. Both land at the threshold in their own seats, both screens dress
// the foes as the Hollow Choir, the host's patrol comes to where the guest walks, a guest's F at a giver starts the
// party's quest, and the host walks back through the gate with the guest called home after them.
//   npm run build && npm run smoke:coop-zone-ruins   (HOST=jedi|trooper|mando)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9036';
const server = PeerServer({ port: 9036, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 90000, polling: 250 };   // on a timer: only one of the two pages is in the foreground
const step = (what) => console.log('ok   ' + what);
const HOST = process.env.HOST || 'jedi', GUEST = HOST === 'trooper' ? 'mando' : 'trooper';
const COUNCIL = { jedi: 'council', trooper: 'warroom', mando: 'clan' }[HOST];

// cleared: the chapters this save has closed, per hero (the host has closed Act I, which opens Jedha: game/zone-gate.js;
// a guest on a brand-new save still goes along with them)
async function open(name, cleared = {}){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript((cleared) => {
    try { for (const h in cleared) localStorage.setItem('sw_camp_ch_' + h, JSON.stringify(cleared[h])); localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, cleared);
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const inHub = (page, wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && (!w || GAME.G.hubWing === w), wing, poll);
const inZone = (page) => page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.zone === 'ruins' && !GAME.G.hub && !GAME.G.paused, null, poll);
const stand = (page, x, z, yaw = Math.PI) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.6, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); G.yaw = player.faceYaw = yaw; }, [x, z, yaw]);
// is the chunk under (x, z) built on this screen
const builtAt = (page, x, z) => page.evaluate(([x, z]) => { const S = GAME.zone.zoneStream(); const c = S.chunks.find(c => x >= c.x0 && x < c.x1 && z >= c.z0 && z < c.z1); return !!(c && c.grp); }, [x, z]);

let ok = false;
try {
  const host = await open('host', { [HOST]: ['siege', 'archive', 'refuge', 'trial-first'] }), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  step('connected');

  await host.$eval('#hero-' + HOST, el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
  await inHub(host);
  await guest.waitForFunction(() => getComputedStyle(document.getElementById('coopjointemple')).display !== 'none', null, poll);
  await guest.$eval('#hero-' + GUEST, el => el.click());
  await guest.click('#coopjointemple');
  await inHub(guest);
  step(`the guest (${GUEST}) joins the host (${HOST}) in the hub`);

  // the host has closed THE GATE WAKES (as a close of the chapter records it: game/profile.js); the guest has not
  await host.evaluate(() => { GAME.PROFILE.profileOf().cleared['gate-wake'] = 1; });
  await host.evaluate((w) => GAME.hub.goWing(w), COUNCIL); await inHub(host, COUNCIL);
  await stand(host, 0, 7);
  const gt = await host.evaluate(() => GAME.G.gt);
  await host.waitForFunction((gt) => GAME.G.gt > gt + 0.15 && document.getElementById('hubp').classList.contains('on'), gt, poll);
  await host.keyboard.press('f');
  await host.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, poll);
  await host.locator('#hubpanel .hb-o', { hasText: 'OPEN ZONE · THE SITH GATE' }).first().click();
  await guest.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open') && /SITH GATE/.test(document.getElementById('hubpanel').textContent), null, poll);
  step('a ready check goes round the party before the ruins');
  await guest.locator('#hubpanel .hb-o', { hasText: 'READY' }).first().click();
  await inZone(host);
  step('the host goes through the gate');
  await inZone(guest);
  await guest.waitForFunction(() => GAME.G.coopGuest && GAME.G.partyRun, null, poll);
  step('the guest, on a brand-new save, follows them in');
  const seats = await Promise.all([host, guest].map(p => p.evaluate(() => [GAME.player.group.position.x, GAME.player.group.position.z])));
  if (Math.hypot(seats[0][0] - seats[1][0], seats[0][1] - seats[1][1]) < 1.5) throw new Error('both landed on the same spot: ' + JSON.stringify(seats));
  if (seats.some(([x, z]) => Math.abs(z - 93) > 10)) throw new Error('not at the threshold: ' + JSON.stringify(seats));
  step('each lands in their own seat at the threshold');
  for (const p of [host, guest]) if (!(await p.evaluate(() => GAME.foeType('blaster').color === 0x26222c))) throw new Error('a screen does not dress the foes as the Choir');
  step('both screens dress the foes in the Hollow Choir\'s robes');
  await guest.waitForFunction(() => GAME.partnerShown(), null, poll);
  await host.waitForFunction(() => GAME.partnerShown(), null, poll);
  step('each sees the other in the ruins');

  // the host's patrol comes to where the guest walks, and the guest sees it
  await stand(guest, 4, 4); await guest.evaluate(() => { GAME.player.hp = 9999; });
  await host.waitForFunction(() => GAME.zone.zonePatrols() > 0, null, poll);
  await guest.waitForFunction(() => GAME.enemies.some(e => !e.dead), null, poll);
  step('the host sends a Choir patrol down the avenue the guest walks, and the guest sees it');
  await host.evaluate(() => { for (const e of GAME.enemies) if (!e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });

  // a guest's F at a giver starts the party's quest
  const gv = await guest.evaluate(() => GAME.zone.zoneGivers().find(g => g.id === 'cells'));
  await stand(guest, gv.x, gv.z + 1.6);
  await guest.waitForFunction(() => document.getElementById('zoneqp').classList.contains('on'), null, poll);
  await guest.keyboard.down('f'); await guest.waitForTimeout(350); await guest.keyboard.up('f');
  await host.waitForFunction(() => GAME.zone.zoneQuest()?.id === 'cells', null, poll);
  await guest.waitForFunction(() => GAME.zone.zoneQuest()?.id === 'cells' && /CELLS/.test(document.getElementById('waveinfo').textContent), null, poll);
  step('a guest\'s F at the scout starts the party\'s quest, on both screens');
  await stand(guest, 70, 0); await guest.evaluate(() => { GAME.player.hp = 9999; });
  await host.waitForFunction(() => GAME.zone.zoneQuest()?.i === 1, null, poll);
  await guest.waitForFunction(() => GAME.zone.zoneQuest()?.i === 1, null, poll);
  step('the guest reaching the bastion yard moves the quest on for the party');

  // the host walks back through the gate; the guest is called back with them
  await stand(host, 10, 86.5);
  const gt2 = await host.evaluate(() => GAME.G.gt);
  await host.waitForFunction((gt) => GAME.G.gt > gt + 0.2 && document.getElementById('zonep').classList.contains('on'), gt2, poll);
  await host.keyboard.press('f');
  await host.waitForFunction(() => document.getElementById('zonepanel').classList.contains('open'), null, poll);
  await host.locator('#zonepanel .hb-o', { hasText: 'RETURN TO' }).first().click();
  await inHub(host);
  step('the host walks back through the gate, home');
  await inHub(guest);
  step('the guest is called back to the hub with them');
  ok = !errors.length;
} catch(e){ console.log('FAIL ' + e.message); }
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close(); server.close?.();
console.log(ok ? 'PASS co-op gate ruins' : 'FAIL co-op gate ruins');
process.exit(ok ? 0 : 1);
