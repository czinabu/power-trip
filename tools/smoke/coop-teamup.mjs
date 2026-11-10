// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP TEAM-UP SMOKE TEST — two browsers on the BUILT game: a Jedi hosts the campaign's siege, a Mando joins it. With a
// foe in front of the Jedi, both screens offer LIFT & LAUNCH; the host presses, the guest's prompt lights up (its partner
// is ready), the guest presses, and the host (the referee) sends the go: both heroes play it, and the host's foe takes
// the rocket. Then a sparring duel (G.pvp) switches team-ups off.
//   npm run build && npm run smoke:coop-teamup

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9023';
const server = PeerServer({ port: 9023, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000, polling: 250 });
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, { timeout: 30000, polling: 250 });
// keep both heroes on their feet: this is a test of the team-up, not of surviving the siege
const sturdy = (page) => page.evaluate(() => { window._keep = setInterval(() => { const p = GAME.player; p.hp = Math.max(p.hp, 200); p.downed = null; if (GAME.G.mode === 'dead') GAME.G.mode = 'play'; }, 200); });

let ok = false;
try {
  const host = await open('host'), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, { timeout: 20000, polling: 250 });
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  const begin = (page) => page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); GAME.cutscene.skipScene(); });
  const play = async (page) => {
    for (let i = 0; i < 5; i++){
      if (await page.evaluate(() => GAME.G.mode === 'play')) break;
      if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
      if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  };
  await host.click('#coopclose'); await host.$eval('#mode-campaign', el => el.click()); await host.$eval('#hero-jedi', el => el.click()); await play(host); await begin(host);
  await guest.click('#coopclose'); await guest.$eval('#hero-mando', el => el.click());
  await guest.click('#mode-coop');
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, { timeout: 20000, polling: 250 });
  await guest.click('#coopjoinrun'); await play(guest); await begin(guest);
  await host.evaluate(() => GAME.startChapter(1)); await begin(host);
  await guest.waitForFunction(() => GAME.G.coopGuest && GAME.G.chapter === 1, null, { timeout: 60000, polling: 250 }); await begin(guest);
  await sturdy(host); await sturdy(guest);
  // the two heroes side by side, both looking down +z, and a trooper eight metres ahead of the Jedi
  await host.evaluate(() => { GAME.player.group.position.set(4, 0, 2); GAME.G.yaw = 0; GAME.player.faceYaw = 0; });
  await guest.evaluate(() => { GAME.player.group.position.set(7, 0, 1); GAME.G.yaw = 0; GAME.player.faceYaw = 0; });
  for (const page of [host, guest]) await page.waitForFunction(() => GAME.partnerInfo().here, null, { timeout: 30000, polling: 250 });
  const nid = await host.evaluate(() => { GAME.spawnEnemy('grunt', { x: 4, y: 0, z: 10 }); const e = GAME.enemies[GAME.enemies.length - 1]; e.dummy = true; e.home = { x: 4, z: 10 }; return e.nid; });
  // both screens offer it (the guest sees the host's foe as a puppet)
  const offered = (page) => page.waitForFunction(() => { const c = GAME.teamup.info().cand; GAME.player.faceYaw = 0; return c && c.k === 'lift'; }, null, { timeout: 90000, polling: 250 });
  await Promise.all([offered(host), offered(guest)]);
  const hp0 = await host.evaluate((n) => GAME.enemies.find(e => e.nid === n).hp, nid);
  if (!(await host.evaluate(() => GAME.teamup.press()))) throw new Error('the host\'s press was not taken');
  await guest.waitForFunction(() => GAME.teamup.info().ready === 'lift' && /ready/.test(GAME.teamup.info().prompt), null, { timeout: 20000, polling: 100 });
  if (!(await guest.evaluate(() => GAME.teamup.press()))) throw new Error('the guest\'s press was not taken');
  for (const page of [host, guest]) await page.waitForFunction(() => GAME.teamup.info().done === 1, null, { timeout: 20000, polling: 100 });
  // the rocket lands on the host's foe: it dies, or it's badly hurt
  await host.waitForFunction(([n, hp]) => { const e = GAME.enemies.find(o => o.nid === n); return !e || e.dead || e.hp < hp - 30; }, [nid, hp0], { timeout: 60000, polling: 250 });
  const roles = await Promise.all([host, guest].map(p => p.evaluate(() => GAME.teamup.info())));
  // a sparring duel: no team-ups
  await host.evaluate(() => { GAME.G.pvp = true; GAME.teamup.reset(); });
  await host.waitForTimeout(1500);
  if (await host.evaluate(() => GAME.teamup.info().cand)) throw new Error('a sparring duel should switch team-ups off');
  ok = true;
  console.log('ok   co-op team-up: both screens offered LIFT & LAUNCH, the guest saw the host ready, both pressed, the host\'s foe took it (cooldowns ' + roles.map(r => r.cd.toFixed(0)).join(' / ') + 's), and a sparring duel switched it off');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ t: GAME.teamup.info(), mode: GAME.G.mode, me: GAME.player.group.position.toArray(), info: GAME.partnerInfo(), foes: GAME.enemies.filter(e => !e.dead).length })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op team-up\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
