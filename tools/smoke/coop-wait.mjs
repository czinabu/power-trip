// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP WAITING SMOKE TEST — between two chapters: the dark after a doorway shows the waiting card (ui/waiting.js) naming
// who the run waits for; pop-ups wait for the fight to end and hold the next chapter; a briefing that comes up under the
// pause screen is reached with RESUME.
//   npm run build && node tools/smoke/coop-wait.mjs   (SHOTS=dir saves screenshots)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9023';
const server = PeerServer({ port: 9023, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 30000, polling: 250 };
const SHOTS = process.env.SHOTS;
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

async function open(name, coopName){
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript((n) => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); localStorage.setItem('sw_coop_name', n); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, coopName);
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 90000, polling: 250 });
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const begin = (page) => page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); GAME.cutscene.skipScene(); });
const wsText = (page) => page.evaluate(() => (document.getElementById('waitscreen') || {}).textContent || '');

let ok = false;
try {
  const host = await open('host', 'Caleb'), guest = await open('guest', 'Friend');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  await host.$eval('#hero-jedi', el => el.click()); await host.$eval('#mode-campaign', el => el.click());
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await host.isVisible('#forms [data-go]')) await host.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await host.waitForTimeout(800);
  }
  await host.waitForFunction(() => document.querySelector('#chapcard.open'), null, poll); await begin(host);
  await host.evaluate(() => GAME.startChapter(1)); await begin(host);
  await host.evaluate(() => GAME.squad.clearSquad());
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.$eval('#hero-mando', el => el.click());
  await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  for (let i = 0; i < 5 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
    await guest.waitForTimeout(800);
  }
  await guest.waitForFunction(() => GAME.G.chapter === 1 && document.querySelector('#chapcard.open'), null, poll);
  await begin(guest);
  if (!(await guest.evaluate(() => GAME.G.coopGuest))) throw new Error('the guest did not join the host\'s campaign');
  await host.waitForFunction(() => GAME.enemies.length >= 1, null, poll);

  // 1. POP-UPS WAIT FOR THE FIGHT: a new power's card stays queued while foes are up, and comes once they're gone
  await host.evaluate(() => GAME.abilityCards.queue([{ key: 'pull' }]));
  await host.waitForTimeout(2500);
  if (await host.evaluate(() => GAME.abilityCards.up())) throw new Error('a power\'s card came up mid-fight');
  await host.evaluate(() => { for (const e of GAME.enemies) GAME.damageEnemy(e, 99999, null, 0, false, false); GAME.G.spawnQueue.length = 0; GAME.shared.levelPhase = 'idle'; });
  await host.waitForFunction(() => GAME.abilityCards.up(), null, poll);
  console.log('ok   a power\'s card waited for the fight to end');
  await host.evaluate(() => document.querySelector('#abilitycard [data-next]').click());

  // 2. THE NEXT CHAPTER WAITS FOR POP-UPS: the road on ('travel') holds while a card is still to see
  await host.evaluate(() => { GAME.abilityCards.queue([{ key: 'flame' }]); GAME.shared.levelPhase = 'travel'; GAME.shared.phaseT = 0; });
  await host.waitForFunction(() => GAME.abilityCards.up(), null, poll);
  await host.waitForTimeout(2500);
  if (await host.evaluate(() => GAME.G.chapter !== 1)) throw new Error('the next chapter started under a power\'s card');
  await host.evaluate(() => { GAME.shared.levelPhase = 'idle'; document.querySelector('#abilitycard [data-next]').click(); });
  console.log('ok   the next chapter held for the pop-up');

  // (the upgrade page as the run shows it, whether or not this build has points to spend)
  const tree = (page) => page.evaluate(() => { document.getElementById('skilltree').style.display = 'flex'; GAME.G.skillSelect = true; document.exitPointerLock(); });
  // 3. THE WAITING CARD: both through the doorway's dark; the guest's upgrade page is open, the host waits for it
  await host.evaluate(() => { GAME.shared.levelPhase = 'idle'; GAME.goThrough(); });
  await guest.evaluate(() => GAME.goThrough()); await tree(guest);
  await host.bringToFront();
  await host.waitForFunction(() => GAME.waitingUp(), null, poll);
  await host.waitForFunction(() => /WAITING FOR FRIEND/.test(document.getElementById('waitscreen').textContent), null, poll);
  if (!/CHOOSING UPGRADES/.test(await wsText(host))) throw new Error('the guest\'s state is not shown: ' + await wsText(host));
  await shot(host, 'host-waiting-jedi');
  console.log('ok   host: ' + await wsText(host));
  // the guest closes it; now the host's page is open, and the guest waits for the host
  await guest.evaluate(() => { document.getElementById('skilltree').style.display = 'none'; GAME.G.skillSelect = false; });
  await host.waitForFunction(() => /MOVING ON/.test(document.getElementById('waitscreen').textContent), null, poll);
  await shot(host, 'host-moving-on');
  await tree(host);
  await guest.bringToFront();
  await guest.waitForFunction(() => GAME.waitingUp() && /WAITING FOR CALEB/.test(document.getElementById('waitscreen').textContent), null, poll);
  await shot(guest, 'guest-waiting-mando');
  console.log('ok   guest: ' + await wsText(guest));
  await host.evaluate(() => { document.getElementById('skilltree').style.display = 'none'; GAME.G.skillSelect = false; });

  // 4. A SCENE CHANGE UNDER THE PAUSE SCREEN: the guest pauses in the dark, the host moves on. The briefing takes the
  // screen (the pause screen goes), and can be read and closed
  await guest.keyboard.press('Tab');
  await guest.waitForFunction(() => document.getElementById('overlay').style.display === 'flex' && GAME.G.paused, null, poll);
  await shot(guest, 'guest-paused-in-dark');
  await host.evaluate(() => GAME.startChapter(3)); await begin(host);
  await guest.waitForFunction(() => GAME.G.chapter === 3 && document.querySelector('#chapcard.open'), null, poll);
  await guest.waitForFunction(() => document.getElementById('overlay').style.display === 'none' && !GAME.G.paused, null, { timeout: 5000, polling: 100 });
  if (await guest.evaluate(() => GAME.waitingUp())) throw new Error('the waiting card is still up in the next chapter');
  await shot(guest, 'guest-briefing-after-scene-change');
  await guest.click('#chapcard.open [data-go]');
  await guest.waitForFunction(() => !document.querySelector('#chapcard.open'), null, poll);
  console.log('ok   a scene change while paused brings the briefing up in front, and it closes');
  // 5. RESUME with a screen that owns the cursor under the pause (the upgrade page opened while paused): it lifts
  await guest.evaluate(() => GAME.cutscene.skipScene());
  await guest.waitForFunction(() => !GAME.G.cutscene, null, poll);
  await guest.keyboard.press('Tab');
  await guest.waitForFunction(() => document.getElementById('overlay').style.display === 'flex' && GAME.G.paused, null, poll);
  await tree(guest);
  await guest.keyboard.press('Enter');
  await guest.waitForFunction(() => document.getElementById('overlay').style.display === 'none' && !GAME.G.paused, null, { timeout: 5000, polling: 100 });
  console.log('ok   RESUME over the upgrade page lifts the pause screen');
  ok = true;
} catch(e){ errors.push(e.stack || e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, ch: GAME.G.chapter, door: GAME.doorState(), dark: GAME.doorDark(), sel: GAME.G.skillSelect, card: GAME.G.cardUp, cut: GAME.G.cutscene, paused: GAME.G.paused, ph: GAME.shared.levelPhase, ws: GAME.waitingUp(), wsT: (document.getElementById('waitscreen') || {}).textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op waiting\n' + errors.join('\n')); process.exit(1); }
console.log('ok   co-op waiting');
process.exit(0);
