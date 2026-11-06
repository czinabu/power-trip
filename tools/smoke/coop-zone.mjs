// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP OPEN ZONE SMOKE TEST — two browsers on the BUILT game roam the old city of Jedha together (game/zone.js). The host
// picks the zone at the council table, the guest answers the ready check and follows them in; each lands in their own
// seat and sees the other. The host's patrols come to wherever the guest walks, and the guest sees them; a guest's F at
// a giver starts the party's quest, which the host keeps and both screens show. The guest walks off across the city: the guest's own screen builds the streets round them,
// and the host's builds them too (so the host's foes would stand in a built street). Each has their own waystones. The
// host takes the shuttle home and the guest is called back with them.
//   npm run build && npm run smoke:coop-zone   (HOST=jedi|trooper|mando)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9035';
const server = PeerServer({ port: 9035, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 90000, polling: 250 };   // on a timer: only one of the two pages is in the foreground
const step = (what) => console.log('ok   ' + what);
const HOST = process.env.HOST || 'jedi', GUEST = HOST === 'trooper' ? 'mando' : 'trooper';
const COUNCIL = { jedi: 'council', trooper: 'warroom', mando: 'clan' }[HOST];

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const inHub = (page, wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && (!w || GAME.G.hubWing === w), wing, poll);
const inZone = (page) => page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.zone === 'jedha' && !GAME.G.hub && !GAME.G.paused, null, poll);
const stand = (page, x, z, yaw = Math.PI) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.6, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); G.yaw = player.faceYaw = yaw; }, [x, z, yaw]);
// is the chunk under (x, z) built on this screen
const builtAt = (page, x, z) => page.evaluate(([x, z]) => { const S = GAME.zone.zoneStream(); const c = S.chunks.find(c => x >= c.x0 && x < c.x1 && z >= c.z0 && z < c.z1); return !!(c && c.grp); }, [x, z]);

let ok = false;
try {
  const host = await open('host'), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  step('connected');

  // both into the host's hub
  await host.$eval('#hero-' + HOST, el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
  await inHub(host);
  await guest.waitForFunction(() => getComputedStyle(document.getElementById('coopjointemple')).display !== 'none', null, poll);
  await guest.$eval('#hero-' + GUEST, el => el.click());
  await guest.click('#coopjointemple');
  await inHub(guest);
  step(`the guest (${GUEST}) joins the host (${HOST}) in the hub`);

  // the host picks the zone at the council table; the ready check goes round; both land in the city
  await host.evaluate((w) => GAME.hub.goWing(w), COUNCIL); await inHub(host, COUNCIL);
  await stand(host, 0, 7);
  const gt = await host.evaluate(() => GAME.G.gt);
  await host.waitForFunction((gt) => GAME.G.gt > gt + 0.15 && document.getElementById('hubp').classList.contains('on'), gt, poll);
  await host.keyboard.press('f');
  await host.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, poll);
  await host.locator('#hubpanel .hb-o', { hasText: 'OPEN ZONE' }).first().click();
  await guest.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open') && /JEDHA/.test(document.getElementById('hubpanel').textContent), null, poll);
  step('a ready check goes round the party before the zone');
  await guest.locator('#hubpanel .hb-o', { hasText: 'READY' }).first().click();
  await inZone(host);
  step('the host goes into the old city');
  await inZone(guest);
  await guest.waitForFunction(() => GAME.G.coopGuest && GAME.G.partyRun, null, poll);
  step('the guest follows them in');
  const seats = await Promise.all([host, guest].map(p => p.evaluate(() => [GAME.player.group.position.x, GAME.player.group.position.z])));
  if (Math.hypot(seats[0][0] - seats[1][0], seats[0][1] - seats[1][1]) < 1.5) throw new Error('both landed on the same spot: ' + JSON.stringify(seats));
  step('each lands in their own seat by the pad');
  await guest.waitForFunction(() => GAME.partnerShown(), null, poll);
  await host.waitForFunction(() => GAME.partnerShown(), null, poll);
  step('each sees the other in the city');

  // the host sends a patrol to where the guest walks, and the guest is shown it
  await stand(guest, 4, 4); await guest.evaluate(() => { GAME.player.hp = 9999; });
  await host.waitForFunction(() => GAME.zone.zonePatrols() > 0, null, poll);
  await guest.waitForFunction(() => GAME.enemies.some(e => !e.dead), null, poll);
  step('the host sends a patrol through the square the guest walks, and the guest sees it');
  // a guest's F at a giver starts the party's quest: the host keeps it, both screens show it
  const gv = await guest.evaluate(() => GAME.zone.zoneGivers().find(g => g.id === 'deserter'));
  await stand(guest, gv.x, gv.z + 1.6);
  await guest.waitForFunction(() => document.getElementById('zoneqp').classList.contains('on'), null, poll);
  await guest.keyboard.down('f'); await guest.waitForTimeout(350); await guest.keyboard.up('f');
  await host.waitForFunction(() => GAME.zone.zoneQuest()?.id === 'deserter', null, poll);
  await guest.waitForFunction(() => GAME.zone.zoneQuest()?.id === 'deserter' && /DESERTER/.test(document.getElementById('waveinfo').textContent), null, poll);
  step('a guest\'s F at a giver starts the party\'s quest, on both screens');
  // the guest's walking counts: into the garrison yard, and the quest moves on for both
  await stand(guest, 70, 0); await guest.evaluate(() => { GAME.player.hp = 9999; });
  await host.waitForFunction(() => GAME.zone.zoneQuest()?.i === 1, null, poll);
  await guest.waitForFunction(() => GAME.zone.zoneQuest()?.i === 1, null, poll);
  step('the guest reaching the garrison yard moves the quest on for the party');

  // the guest walks off to the far north-west: their screen builds those streets, and so does the host's
  await stand(guest, -78, -96);
  await guest.waitForFunction(() => { const S = GAME.zone.zoneStream(); const c = S.chunks.find(c => -78 >= c.x0 && -78 < c.x1 && -96 >= c.z0 && -96 < c.z1); return !!(c && c.grp); }, null, poll);
  step('the guest\'s screen builds the streets round them');
  await host.waitForFunction(() => { const S = GAME.zone.zoneStream(); const c = S.chunks.find(c => -78 >= c.x0 && -78 < c.x1 && -96 >= c.z0 && -96 < c.z1); return !!(c && c.grp); }, null, poll);
  if (!(await builtAt(host, 0, 96))) throw new Error('the host let go of the streets round itself');
  step('the host builds the streets round the guest too, and keeps its own');
  // waystones are each player's own
  await stand(guest, -62, -56.5);
  await guest.waitForFunction(() => GAME.zone.stonesTouched().some(w => w.id === 'workings'), null, poll);
  if (await host.evaluate(() => GAME.zone.stonesTouched().some(w => w.id === 'workings'))) throw new Error('the guest\'s waystone counted for the host');
  step('a waystone the guest touches is theirs alone');
  await guest.evaluate(() => GAME.zone.travelTo('gate'));
  await guest.waitForFunction(() => !GAME.G.paused && Math.hypot(GAME.player.group.position.x - 10, GAME.player.group.position.z - 87) < 8, null, poll);
  step('the guest travels back to the gate');

  // the host takes the shuttle home; the guest is called back with them
  await stand(host, 10, 86.5);
  const gt2 = await host.evaluate(() => GAME.G.gt);
  await host.waitForFunction((gt) => GAME.G.gt > gt + 0.2 && document.getElementById('zonep').classList.contains('on'), gt2, poll);
  await host.keyboard.press('f');
  await host.waitForFunction(() => document.getElementById('zonepanel').classList.contains('open'), null, poll);
  await host.locator('#zonepanel .hb-o', { hasText: 'RETURN TO' }).first().click();
  await inHub(host);
  step('the host takes the shuttle home');
  await inHub(guest);
  step('the guest is called back to the hub with them');
  ok = !errors.length;
} catch(e){ console.log('FAIL ' + e.message); }
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close(); server.close?.();
console.log(ok ? 'PASS co-op zone' : 'FAIL co-op zone');
process.exit(ok ? 0 : 1);
