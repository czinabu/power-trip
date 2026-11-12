// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP DUEL ROOMS SMOKE TEST — the duel ring is in the HOST's hub (game/duel-mode.js duelPlace, data/duel-mode.js ring):
// two browsers on the BUILT game, for each gunner hub in turn (a Mando host in the covert's sparring pit, an ARC trooper
// host in the citadel's combat sim), the guest a Jedi. The spectators' spot there holds a player up; the host calls a duel
// under ANY HERO; both are put on their marks in the room's wider ring, with its cover (the sim keeps only the low walls,
// its own tall ones standing there already), and a fighter is held inside the ring's edge.
//   npm run build && npm run smoke:coop-duel-rooms

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9048';
const server = PeerServer({ port: 9048, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 120000, polling: 250 };
const step = (what) => console.log('ok   ' + what);
const shots = process.env.SHOTS || '';

async function open(name){
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url, { timeout: 120000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const inHub = (page, wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && (!w || GAME.G.hubWing === w), wing, poll);

const ROOMS = [
  { hero: 'mando', hub: 'covert', wing: 'pit', place: 'covert', x: 12, cover: 6 },
  { hero: 'trooper', hub: 'kamino', wing: 'range', place: 'kamino', x: 14, cover: 4 },
];
let ok = false;
try {
  for (const R of ROOMS){
    const host = await open('host'), guest = await open('guest');
    await host.click('#mode-coop'); await host.fill('#coopname', 'Vex'); await host.click('#coophost');
    await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
    const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
    await guest.click('#mode-coop'); await guest.fill('#coopname', 'Kira'); await guest.fill('#coopcode', code); await guest.click('#coopjoin'); await connected(guest);
    await host.click('#coopclose');
    await host.$eval('#hero-' + R.hero, el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
    await inHub(host);
    await guest.waitForFunction(() => getComputedStyle(document.getElementById('coopjointemple')).display !== 'none', null, poll);
    await guest.$eval('#hero-jedi', el => el.click());
    await guest.click('#coopjointemple');
    await inHub(guest);
    for (const p of [host, guest]) await p.evaluate((w) => GAME.hub.goWing(w), R.wing);
    await Promise.all([inHub(host, R.wing), inHub(guest, R.wing)]);
    const hubs = await Promise.all([host, guest].map(p => p.evaluate(() => GAME.G.hubId)));
    if (hubs.join() !== R.hub + ',' + R.hub) throw new Error('both should be in the host\'s hub, ' + R.hub + ': ' + hubs);
    await host.waitForFunction(() => GAME.partnerInfo().all.filter(p => p.shown).length === 1, null, poll);
    step(R.hero + ' host: both in the ' + R.hub + '\'s ' + R.wing);

    // the spectators' spot: somewhere to stand, facing the ring
    await guest.evaluate(() => GAME.duel.balcony());
    await guest.waitForTimeout(1500);
    const sp = await guest.evaluate(() => { const p = GAME.player.group.position; return { x: p.x, y: p.y, z: p.z }; });
    if (sp.y < 1) throw new Error('the spectators\' spot should hold a player up: ' + JSON.stringify(sp));
    step('the spectators\' spot holds a player up, at ' + JSON.stringify({ x: +sp.x.toFixed(1), y: +sp.y.toFixed(1), z: +sp.z.toFixed(1) }));

    const gs = await guest.evaluate(() => GAME.coopNet.slot);
    const sent = await host.evaluate((k) => GAME.duel.challenge([k], 'hits', 'any'), gs);
    if (!sent) throw new Error('the host should be able to challenge in the ' + R.wing);
    await guest.waitForFunction(() => GAME.duel.info().incoming, null, poll);
    await guest.evaluate(() => GAME.duel.answer(true));
    for (const p of [host, guest]) await p.waitForFunction(() => { const i = GAME.duel.info(); return i.M && i.M.me >= 0 && i.levelled && i.cover > 0 && (i.M.ph === 'count' || i.M.ph === 'fight'); }, null, poll);
    const m = await host.evaluate(() => { const i = GAME.duel.info(); return { place: i.M.place, ring: i.M.ring, cover: i.cover }; });
    if (m.place !== R.place || m.ring.x !== R.x || m.ring.r < 15 || m.cover !== R.cover) throw new Error('the duel should be in the ' + R.place + '\'s wide ring with its cover: ' + JSON.stringify(m));
    const marks = await Promise.all([host, guest].map(p => p.evaluate(() => { const p = GAME.player.group.position; return { x: p.x, z: p.z }; })));
    const apart = Math.hypot(marks[0].x - marks[1].x, marks[0].z - marks[1].z);
    if (apart < 9) throw new Error('the marks should stand further apart in the wide ring: ' + apart.toFixed(1));
    step('a duel under ANY HERO in the ' + R.place + ' ring: r ' + m.ring.r + ', ' + m.cover + ' cover, marks ' + apart.toFixed(1) + ' m apart');
    if (shots) await host.screenshot({ path: shots + '/ring-' + R.place + '.png' });

    // held inside the edge
    await guest.evaluate(() => { const p = GAME.player.group.position; p.x += 30; });
    await guest.waitForTimeout(600);
    const held = await guest.evaluate(() => { const p = GAME.player.group.position, R = GAME.duel.info().M.ring; return Math.hypot(p.x - R.x, p.z - R.z) - R.r; });
    if (held > 0.05) throw new Error('a fighter should be held inside the ring: ' + held.toFixed(2) + ' m out');
    step('a fighter is held inside the wide ring\'s edge');

    await host.evaluate(() => GAME.duel.leave());
    await guest.waitForFunction(() => !GAME.duel.info().M || GAME.duel.info().M.ph === 'over' || GAME.duel.info().M.ph === 'gone', null, poll);
    await host.close(); await guest.close();
  }
  if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
  ok = true;
  console.log('PASS: the duel ring is in the host\'s own training room, wider for guns');
} catch(e){
  console.error('FAIL: ' + e.message);
  if (errors.length) console.error(errors.join('\n'));
} finally {
  await browser.close(); server.close?.();
  process.exit(ok ? 0 : 1);
}
