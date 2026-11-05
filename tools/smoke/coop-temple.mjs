// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP TEMPLE SMOKE TEST — the hidden temple as the party's lobby (game/hub.js): two browsers on the BUILT game. The host
// walks into the temple; the guest joins them there from the co-op panel and sees them only while they share a wing.
// The host picks Survival at the council table, the guest answers its ready check, and follows them into it; the host goes back to the
// temple and the guest is called back with them.
// The lobby is the HOST's hero's hub for everyone: HOST=trooper walks it as the clone citadel on Kamino, with a Jedi
// guest who arrives there, not in their own temple.
//   npm run build && npm run smoke:coop-temple   (HOST=jedi|trooper)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9031';
const server = PeerServer({ port: 9031, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 90000, polling: 250 };   // on a timer: only one of the two pages is in the foreground
const step = (what) => console.log('ok   ' + what);
const HOST = process.env.HOST || 'jedi', GUEST = HOST === 'jedi' ? 'mando' : 'jedi';
const W = HOST === 'trooper' ? { hub: 'kamino', hall: 'deck', archives: 'halls', council: 'warroom' } : { hub: 'temple', hall: 'hall', archives: 'archives', council: 'council' };

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
          localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_camp_mando', '1'); localStorage.setItem('sw_camp_trooper', '1'); } catch(e){}   // Survival unlocked
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const inHub = (page, wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && (!w || GAME.G.hubWing === w), wing, poll);

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

  // the host walks into the temple; the guest's co-op panel offers to join them there
  await host.$eval('#hero-' + HOST, el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
  await inHub(host, W.hall);
  await guest.waitForFunction(() => getComputedStyle(document.getElementById('coopjointemple')).display !== 'none', null, poll);
  await guest.$eval('#hero-' + GUEST, el => el.click());
  await guest.click('#coopjointemple');
  await inHub(guest, W.hall);
  await guest.waitForFunction((h) => GAME.G.hubId === h, W.hub, poll);
  step(`the guest (${GUEST}) joins the host (${HOST}) in the host's hub: ${W.hub}`);
  await guest.waitForFunction(() => GAME.partnerShown(), null, poll);
  await host.waitForFunction(() => GAME.partnerShown(), null, poll);
  step('each sees the other in the grand hall');

  // in different wings they don't see each other
  await guest.evaluate((w) => GAME.hub.goWing(w), W.archives); await inHub(guest, W.archives);
  await guest.waitForFunction(() => !GAME.partnerShown(), null, poll);
  await host.waitForFunction(() => !GAME.partnerShown(), null, poll);
  step('apart in different wings');
  await guest.evaluate((w) => GAME.hub.goWing(w), W.hall); await inHub(guest, W.hall);

  // the host launches Survival from the council table; the guest goes with them
  await host.evaluate((w) => GAME.hub.goWing(w), W.council); await inHub(host, W.council);
  await host.evaluate(() => { const { G, player } = GAME; player.group.position.set(0, 0.6, 7); player.vel.set(0, 0, 0); G.yaw = player.faceYaw = Math.PI; });
  const gt = await host.evaluate(() => GAME.G.gt);
  await host.waitForFunction((gt) => GAME.G.gt > gt + 0.15 && document.getElementById('hubp').classList.contains('on'), gt, poll);
  await host.keyboard.press('f');
  await host.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, poll);
  await host.locator('#hubpanel .hb-o', { hasText: 'SURVIVAL' }).first().click();
  // the READY CHECK: the host's card waits on the guest, the guest is asked, and READY sets it off
  await host.waitForFunction(() => /READY CHECK/.test(document.getElementById('hubpanel').textContent) && GAME.G.hub, null, poll);
  await guest.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open') && /SURVIVAL/.test(document.getElementById('hubpanel').textContent), null, poll);
  step('a ready check goes round the party before the run starts');
  await guest.locator('#hubpanel .hb-o', { hasText: 'READY' }).first().click();
  for (let i = 0; i < 10 && !(await host.evaluate(() => GAME.G.mode === 'play' && !GAME.G.hub)); i++){
    if (await host.isVisible('#forms [data-go]')) await host.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
    await host.waitForTimeout(800);
  }
  await host.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.endless && !GAME.G.hub, null, poll);
  step('the host launches Survival from the council table');
  await guest.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.endless && !GAME.G.hub && GAME.G.coopGuest && GAME.G.partyRun, null, poll);
  step('the guest follows the host into it');
  await guest.waitForFunction(() => GAME.enemies.some(e => e.net), null, poll);
  step('the guest fights the host\'s foes');

  // the host goes back to the temple; the guest is called back with them
  await host.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); });
  await host.waitForFunction(() => document.getElementById('templeBtn').offsetParent, null, poll);
  await host.click('#templeBtn');
  if (await host.isVisible('#homeYes')) await host.click('#homeYes');
  await inHub(host);
  step('the host returns to the temple');
  await inHub(guest);
  await guest.waitForFunction((h) => GAME.G.hubId === h, W.hub, poll);
  step('the guest is called back to the host\'s hub with them');
  await guest.waitForFunction(() => !GAME.enemies.length, null, poll);
  ok = !errors.length;
} catch(e){ console.log('FAIL ' + e.message); }
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close(); server.close?.();
console.log(ok ? 'PASS co-op temple' : 'FAIL co-op temple');
process.exit(ok ? 0 : 1);
