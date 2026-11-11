// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP MISSION SMOKE TEST — a shared story mission: two browsers on the BUILT game, the host starts a mission, the guest
// joins it from the co-op panel; then the guest must follow the host's objectives, markers and chase quarry, and its
// mission must end when the host's does.
// MISSION=remix:pursuit plays the chase's remix instead: the guest must build the same remix (twist and faction) too.
//   npm run build && npm run smoke:coop-mission

import { chromium } from 'playwright';
import { waitGame } from './game-wait.mjs';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9020';
const server = PeerServer({ port: 9020, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 120000, polling: 250 };   // on a timer (only one page is in the foreground), and long: on a slow runner two to four browsers run the sim at a fraction of real time

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
          localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_camp_mando', '1'); } catch(e){}   // Survival unlocked
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);

const MID = process.env.MISSION || 'pursuit', SRC = MID.replace(/^remix:/, '').split(':')[0];
let ok = false;
try {
  const host = await open('host'), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  // the host starts Survival
  await host.evaluate((m) => localStorage.setItem('sw_mission_' + m + '_jedi', '1'), SRC);   // missions stay locked until the campaign clears them
  await host.$eval('#hero-jedi', el => el.click()); await host.$eval('#mode-mission', el => el.click()); await host.evaluate((id) => document.getElementById('msn-' + id.replace(/:/g, '-')).click(), MID);   // (its act's fold can be shut: the card is picked as a click on it would)
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await host.isVisible('#forms [data-go]')) await host.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
    await host.waitForTimeout(800);
  }
  if (!(await host.evaluate(() => GAME.G.mission))) throw new Error('the host did not start the mission');
  // the guest sees the run and joins it
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.$eval('#hero-mando', el => el.click());
  await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  for (let i = 0; i < 5 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await guest.isVisible('#forms [data-go]')) await guest.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});   // the Jedi's forms page before the fight: FIGHT
    await guest.waitForTimeout(800);
  }
  if (!(await guest.evaluate((m) => GAME.G.coopGuest && GAME.G.mission && GAME.G.missionId === m, MID))) throw new Error('the guest did not join the host\'s mission');
  const built = (p) => p.evaluate(() => { const d = GAME.missionState().def; return JSON.stringify({ id: d.id, sig: d.sig, faction: d.faction, tw: d.objectives.map(o => o.twist && o.twist.kind) }); });
  const hb = await built(host), gb = await built(guest);
  if (hb !== gb) throw new Error('the guest built another mission: ' + gb + ' (the host: ' + hb + ')');
  // the host's first objective begins: the guest follows, with its markers
  await host.waitForFunction(() => GAME.missionState().o, null, poll);
  await guest.waitForFunction(() => GAME.missionState().begun === 0 && GAME.missionState().o, null, poll);
  const mk = await host.evaluate(() => GAME.missionState().markers.length);
  await guest.waitForFunction((n) => GAME.missionState().markers.length === n, mk, poll);
  // the chase: the guest shows the quarry the host is running
  await guest.waitForFunction(() => GAME.missionState().quarry, null, poll);
  if (await guest.evaluate(() => GAME.enemies.some(e => !e.net))) throw new Error('the guest is running foes of its own');
  // the host's objective is done: the guest moves on to the next one
  const i0 = await host.evaluate(() => GAME.missionState().i);
  await host.evaluate(() => GAME.skipObjective());
  await host.waitForFunction((i) => GAME.missionState().i === i + 1, i0, poll);
  await guest.waitForFunction((i) => GAME.missionState().i === i + 1, i0, poll);
  // the host's last objective: the guest's mission ends with it
  await host.bringToFront();
  // (each objective begins a beat of GAME time after the last, so this runs on the host's clock: game-wait.mjs)
  await waitGame(host, () => { if (GAME.missionState().won || GAME.G.mode !== 'play') return true; if (GAME.missionState().o) GAME.skipObjective(); return false; }, null,
    { gameSeconds: 90, wallMs: 360000, what: 'the host\'s mission won' });
  await waitGame(guest, () => GAME.G.mode === 'victory', null, { clock: host, what: 'the guest\'s victory' });
  ok = true;
  console.log('ok   co-op mission: the guest joined the host\'s mission, followed its objectives, markers and quarry, and finished with it');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, mission: GAME.G.missionId, i: GAME.missionState().i, o: !!GAME.missionState().o, mk: GAME.missionState().markers.length, q: !!GAME.missionState().quarry, status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op mission\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
