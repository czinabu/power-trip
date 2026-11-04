// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP FINAL BOSS SMOKE TEST — the gunners' final boss in a shared run: two browsers on the BUILT game, the host starts
// the Mandalorian's campaign, the guest joins it; then the Iron Magistrate (boss/magistrate.js on boss/finale.js) must show
// on the guest in his own model, take the guest's blows, land his on the guest, turn his phases there (the shield goes),
// draw his rockets there, and his defeat must end the guest's fight too. (Darth Vexis's side: smoke:coop-campaign.)
//   npm run build && npm run smoke:coop-boss

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9021';
const server = PeerServer({ port: 9021, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 30000, polling: 250 };   // on a timer: only one of the two pages is in the foreground

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

let ok = false;
try {
  const host = await open('host'), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  // the host starts the Mandalorian's campaign
  await host.click('#mode-campaign'); await host.$eval('#hero-mando', el => el.click());
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    await host.waitForTimeout(800);
  }
  const begin = (page) => page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); GAME.cutscene.skipScene(); });
  await host.waitForFunction(() => document.querySelector('#chapcard.open'), null, poll); await begin(host);
  await host.evaluate(() => GAME.startChapter(1)); await begin(host);
  // the guest joins the run as the trooper (the Magistrate is the trooper's final boss too, for now)
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.$eval('#hero-trooper', el => el.click());
  await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  for (let i = 0; i < 5 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
    await guest.waitForTimeout(800);
  }
  if (!(await guest.evaluate(() => GAME.G.coopGuest))) throw new Error('the guest did not join the host\'s run');
  await begin(guest);
  // on to a level, and the final boss
  await host.evaluate(() => GAME.startLevel(1, { resume: true }));
  await guest.waitForFunction(() => GAME.G.levelIdx === 1 && GAME.G.coopGuest, null, poll);
  await guest.evaluate(() => { document.getElementById('skilltree').style.display = 'none'; GAME.G.skillSelect = false; });
  await host.evaluate(() => { for (const e of GAME.enemies) GAME.damageEnemy(e, 99999, null, 0, false, false); GAME.G.spawnQueue.length = 0; GAME.shared.levelPhase = 'bossfight'; GAME.spawnBoss(); });
  if (!(await host.evaluate(() => GAME.finale && GAME.finale.fin.id === 'magistrate'))) throw new Error('the gunner\'s final boss is not the Iron Magistrate');
  await guest.waitForFunction(() => GAME.finale && GAME.finale.net, null, poll);
  if (!(await guest.evaluate(() => GAME.finale.group.userData.model === 'magistrate' && GAME.finale.group.userData.shield.visible))) throw new Error('the guest\'s Magistrate is not in his own model, shield up');
  // the guest's blow (from behind him: round his shield) reaches the host's boss
  const bhp = await host.evaluate(() => GAME.finale.hp);
  await guest.evaluate(() => { const b = GAME.finale, V = b.group.position.constructor; GAME.damageEnemy(b, 60, new V(Math.sin(b.group.rotation.y), 0, Math.cos(b.group.rotation.y)), 6, false, false); });
  await host.waitForFunction((h) => GAME.finale && GAME.finale.hp < h, bhp, poll);
  const ghp = await guest.evaluate(() => GAME.player.hp);
  await host.evaluate(() => { const b = GAME.finale; GAME.coopHooks.hurt(b, 7, b.group.position, 'bossmelee', false); });
  await guest.waitForFunction((h) => GAME.player.hp < h, ghp, poll);
  await host.bringToFront();   // the beat and the moves run on the host's frames, which a background page does not get
  // the phase turn: the banner and the cast-off shield on the guest too; then a rocket barrage, drawn there
  await host.evaluate(() => GAME.finaleMove('beat'));
  await guest.waitForFunction(() => /PHASE II/.test((document.getElementById('bossphase') || {}).textContent || '') && !GAME.finale.group.userData.shield.visible, null, poll);
  await host.evaluate(() => GAME.finaleMove('barrage'));
  await host.waitForTimeout(4000);
  // his defeat: the guest's fight ends too
  await host.evaluate(() => { GAME.finaleMove(null, 3); GAME.finale.hp = 1; });
  await guest.waitForFunction(() => GAME.G.mode !== 'play' && !GAME.finale, null, { ...poll, timeout: 120000 });   // (his fall plays out on the host's clock, slowed down)
  ok = true;
  console.log('ok   co-op final boss: the guest sees the Iron Magistrate in his own model, hits reach both ways, his phase turn and shield drop show there, and his defeat ends both fights');
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, lv: GAME.G.levelIdx, boss: GAME.finale ? [GAME.finale.state, GAME.finale.hp, !!GAME.finale.net, GAME.finale.fin && GAME.finale.fin.phase, GAME.finale.fin && GAME.finale.fin.sig && GAME.finale.fin.sig.mv.id, GAME.finale.fin && GAME.finale.fin.over, GAME.finale.fin && GAME.finale.fin.sig && GAME.finale.fin.sig.t, GAME.G.gt] : null, status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op final boss\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
