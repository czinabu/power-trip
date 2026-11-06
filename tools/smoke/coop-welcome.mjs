// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP WELCOME SMOKE TEST — the hubs' first-visit welcome (game/hub-welcome.js) in a party: two browsers on the BUILT
// game, each a fresh save file. The host walks into their hub and is greeted, the tour starting; the guest joins them
// there and is greeted with the HOST's hub's welcome (with the party's lines), on their own screen only, nothing held on
// either. The host sets off on a run mid-tour: the ready check comes up as ever, both tours end with the run, and back
// home neither is greeted again.
//   npm run build && npm run smoke:coop-welcome   (HOST=jedi|trooper · SHOTS=dir for the guest's greeting)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9033';
const server = PeerServer({ port: 9033, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 90000, polling: 250 };   // on a timer: only one of the two pages is in the foreground
const step = (what) => console.log('ok   ' + what);
const HOST = process.env.HOST || 'jedi', GUEST = HOST === 'jedi' ? 'mando' : 'jedi';
const W = HOST === 'trooper' ? { hub: 'kamino', hall: 'deck', archives: 'halls', council: 'warroom' } : { hub: 'temple', hall: 'hall', archives: 'archives', council: 'council' };

async function open(name){
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
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

const greeted = (page) => page.waitForFunction(() => GAME.hub.welcome.state.greet && document.getElementById('tutor').classList.contains('on'), null, poll);
const line = (page) => page.evaluate(() => document.getElementById('tutor').innerText);
const touring = (page) => page.evaluate(() => { const t = document.getElementById('tutor'), s = GAME.hub.welcome.state; return s.tour || s.beacon || t.classList.contains('hw-tour'); });
const SHOTS = process.env.SHOTS || '';

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

  // the host walks in and is greeted; the tour starts on its own
  await host.$eval('#hero-' + HOST, el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
  await inHub(host, W.hall);
  await greeted(host);
  if (await host.evaluate(() => GAME.G.skillSelect || document.getElementById('hubpanel').classList.contains('open'))) throw new Error('the host\'s welcome covered the hub');
  step('the host is greeted, the tour under way, nothing over the hub');

  // the guest joins them: the host's hub's welcome, with the party's lines
  await guest.waitForFunction(() => getComputedStyle(document.getElementById('coopjointemple')).display !== 'none', null, poll);
  await guest.$eval('#hero-' + GUEST, el => el.click());
  await guest.click('#coopjointemple');
  await inHub(guest, W.hall);
  await guest.waitForFunction((h) => GAME.G.hubId === h, W.hub, poll);
  await greeted(guest);
  const gl = await line(guest);
  if (!/leads it|leader/i.test(gl)) throw new Error('the guest\'s greeting has no party line: ' + gl.slice(0, 300));
  if (await guest.evaluate(() => GAME.G.skillSelect)) throw new Error('the guest\'s welcome held them');
  await guest.waitForTimeout(400);
  if (SHOTS) await guest.screenshot({ path: SHOTS + '/coop-guest-greeting-' + W.hub + '.png' });
  step(`the guest (${GUEST}) is greeted in the host's hub (${W.hub}), with the party's lines`);

  // the host sets off mid-tour: the ready check as ever, and both tours end with the run
  await host.evaluate((w) => GAME.hub.goWing(w), W.council); await inHub(host, W.council);
  await host.evaluate(() => { const { G, player } = GAME; player.group.position.set(0, 0.6, 7); player.vel.set(0, 0, 0); G.yaw = player.faceYaw = Math.PI; });
  const t0 = await host.evaluate(() => GAME.G.gt);
  await host.waitForFunction((gt) => GAME.G.gt > gt + 0.15 && document.getElementById('hubp').classList.contains('on'), t0, poll);
  await host.keyboard.press('f');
  await host.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, poll);
  await host.locator('#hubpanel .hb-o', { hasText: 'SURVIVAL' }).first().click();
  await guest.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open') && /READY CHECK/.test(document.getElementById('hubpanel').textContent), null, poll);
  step('the ready check goes round mid-tour');
  await guest.locator('#hubpanel .hb-o', { hasText: 'READY' }).first().click();
  for (let i = 0; i < 10 && !(await host.evaluate(() => GAME.G.mode === 'play' && !GAME.G.hub)); i++){
    if (await host.isVisible('#forms [data-go]')) await host.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await host.waitForTimeout(800);
  }
  await host.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.endless && !GAME.G.hub, null, poll);
  await guest.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.endless && !GAME.G.hub && GAME.G.partyRun, null, poll);
  await host.waitForTimeout(800);
  if (await touring(host)) throw new Error('the host\'s tour outlived the run setting off');
  if (await touring(guest)) throw new Error('the guest\'s tour outlived the run setting off');
  step('both are in the run, both tours over');

  // home again: nobody is greeted twice
  await host.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); });
  await host.waitForFunction(() => document.getElementById('templeBtn').offsetParent, null, poll);
  await host.click('#templeBtn');
  if (await host.isVisible('#homeYes')) await host.click('#homeYes');
  await inHub(host); await inHub(guest);
  await host.waitForTimeout(5000);
  if (await touring(host) || await touring(guest)) throw new Error('greeted twice');
  step('back in the hub, nobody is greeted twice');
  ok = !errors.length;
} catch(e){ console.log('FAIL ' + e.message); }
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close(); server.close?.();
console.log(ok ? 'PASS co-op welcome' : 'FAIL co-op welcome');
process.exit(ok ? 0 : 1);
