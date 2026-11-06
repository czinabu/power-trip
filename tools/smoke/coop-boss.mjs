// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP FINAL BOSS SMOKE TEST — the gunners' final bosses in a shared run: two browsers on the BUILT game, the host starts
// the Mandalorian's campaign, the guest joins it as the trooper; then each boss (the Iron Magistrate, boss/magistrate.js;
// the Marshal, boss/marshal.js; both on boss/finale.js) must show on the guest in his own model, take the guest's blows,
// land his on the guest, turn his phases there (the Magistrate's shield goes, the Marshal drops his guns), play a move
// there, and his defeat must end the guest's fight too. (Darth Vexis's side: smoke:coop-campaign.)
//   npm run build && npm run smoke:coop-boss [magistrate|marshal]

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
// each boss: his model, what he carries in phase I (gone on the guest once the phase turns), the phase that takes it,
// and a move to play there
const CASES = {
  magistrate: { model: 'magistrate', held: 'shield', turn: 2, move: 'barrage', what: 'his shield drop' },
  marshal:    { model: 'commander', held: 'pistolR', turn: 3, move: 'signal', what: 'his guns going down' },
};
const ONLY = process.argv[2];

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

async function run(id){
  const K = CASES[id];
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
  await host.$eval('#mode-campaign', el => el.click()); await host.$eval('#hero-mando', el => el.click());
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    await host.waitForTimeout(800);
  }
  const begin = (page) => page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); GAME.cutscene.skipScene(); });
  await host.waitForFunction(() => document.querySelector('#chapcard.open'), null, poll); await begin(host);
  await host.evaluate(() => GAME.startChapter(1)); await begin(host);
  // the guest joins the run as the trooper
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
  await host.evaluate((id) => { for (const e of GAME.enemies) GAME.damageEnemy(e, 99999, null, 0, false, false); GAME.G.spawnQueue.length = 0; GAME.shared.levelPhase = 'bossfight';
    if (id === 'magistrate') GAME.spawnBoss(); else GAME.spawnFinale(id, { x: 0, z: -(GAME.shared.arenaHalfZ || 30) + 6 }); }, id);
  if (!(await host.evaluate((id) => GAME.finale && GAME.finale.fin.id === id, id))) throw new Error('the boss up is not ' + id + (id === 'magistrate' ? ' (the Mandalorian\'s spawnBoss)' : ''));
  await guest.waitForFunction(() => GAME.finale && GAME.finale.net, null, poll);
  if (!(await guest.evaluate((K) => GAME.finale.group.userData.model === K.model && GAME.finale.group.userData[K.held].visible, K))) throw new Error('the guest\'s ' + id + ' is not in his own model, with his phase I kit');
  // the guest's blow (from behind him: round his shield) reaches the host's boss
  const bhp = await host.evaluate(() => GAME.finale.hp);
  await guest.evaluate(() => { const b = GAME.finale, V = b.group.position.constructor; GAME.damageEnemy(b, 60, new V(Math.sin(b.group.rotation.y), 0, Math.cos(b.group.rotation.y)), 6, false, false); });
  await host.waitForFunction((h) => GAME.finale && GAME.finale.hp < h, bhp, poll);
  const ghp = await guest.evaluate(() => GAME.player.hp);
  await host.evaluate(() => { const b = GAME.finale; GAME.coopHooks.hurt(b, 7, b.group.position, 'bossmelee', false); });
  await guest.waitForFunction((h) => GAME.player.hp < h, ghp, poll);
  await host.bringToFront();   // the beat and the moves run on the host's frames, which a background page does not get
  // the phase turn: the banner and the phase I kit gone on the guest too; then one of his moves, drawn there
  if (K.turn > 2) await host.evaluate((p) => GAME.finaleMove(null, p - 1), K.turn);
  await host.evaluate(() => GAME.finaleMove('beat'));
  await guest.waitForFunction((K) => new RegExp('PHASE ' + 'I'.repeat(K.turn) + '\\b').test((document.getElementById('bossphase') || {}).textContent || '') && !GAME.finale.group.userData[K.held].visible, K, poll);
  await host.evaluate((m) => GAME.finaleMove(m), K.move);
  await host.waitForTimeout(4000);
  // his defeat: the guest's fight ends too
  await host.evaluate(() => { GAME.finaleMove(null, 3); GAME.finale.hp = 1; });
  await guest.waitForFunction(() => GAME.G.mode !== 'play' && !GAME.finale, null, { ...poll, timeout: 120000 });   // (his fall plays out on the host's clock, slowed down)
  ok = true;
  console.log('ok   co-op final boss (' + id + '): the guest sees him in his own model, hits reach both ways, his phase turn and ' + K.what + ' show there, and his defeat ends both fights');
  } catch(e){ errors.push(id + ': ' + e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, lv: GAME.G.levelIdx, boss: GAME.finale ? [GAME.finale.state, GAME.finale.hp, !!GAME.finale.net, GAME.finale.fin && GAME.finale.fin.phase, GAME.finale.fin && GAME.finale.fin.sig && GAME.finale.fin.sig.mv.id, GAME.finale.fin && GAME.finale.fin.over, GAME.finale.fin && GAME.finale.fin.sig && GAME.finale.fin.sig.t, GAME.G.gt] : null, status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
  for (const c of browser.contexts()) await c.close().catch(() => {});
  return ok;
}
let ok = true;
for (const id of ONLY ? [ONLY] : Object.keys(CASES)) ok = (await run(id)) && ok;
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op final boss\n' + errors.join('\n')); process.exit(1); }
process.exit(0);
