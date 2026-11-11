// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP FREE-FOR-ALL SMOKE TEST — duel mode under ANY HERO (game/duel-mode.js, net/pvp.js): three browsers on the BUILT
// game, a Jedi host, a Mandalorian and an ARC trooper, meet in the temple's training wing. The Jedi calls a free-for-all
// under ANY HERO; both accept and all three are put round the ring, levelled (the gunners on their base guns), with cover
// in the ring. Then: the Mando's real bolt flies on the Jedi's screen, which takes it as a part of a clean hit for the
// Mando; a bolt into the Jedi's held guard is blocked and scores nothing; the Mando's flamer burns the trooper; the Jedi's
// real cut lands on the trooper as a full clean hit. The trooper leaves and the match goes on for the other two.
//   npm run build && npm run smoke:coop-duel-ffa

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9047';
const server = PeerServer({ port: 9047, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 120000, polling: 250 };
const step = (what) => console.log('ok   ' + what);
const shots = process.env.SHOTS || '';   // a folder: screenshots of the match for the PR

async function open(name){
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1'); localStorage.setItem('sw_camp_mando', '1'); } catch(e){}   // (the story's flamer reached: game/sandbox-unlocks.js)
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url, { timeout: 120000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const inHub = (page, wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && (!w || GAME.G.hubWing === w), wing, poll);
const info = (page) => page.evaluate(() => GAME.duel.info());
const posOf = (page) => page.evaluate(() => { const p = GAME.player.group.position; return { x: p.x, y: p.y, z: p.z }; });

let ok = false;
try {
  const host = await open('host'), mando = await open('mando'), trooper = await open('trooper');
  await host.click('#mode-coop'); await host.fill('#coopname', 'Kira'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  for (const [g, n] of [[mando, 'Vex'], [trooper, 'Rook']]){ await g.click('#mode-coop'); await g.fill('#coopname', n); await g.fill('#coopcode', code); await g.click('#coopjoin'); await connected(g); }
  await host.waitForFunction(() => /3 of 4 players/.test(document.getElementById('coopstatus').textContent), null, poll);
  await host.click('#coopclose');
  await host.$eval('#hero-jedi', el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
  await inHub(host);
  for (const [g, hero] of [[mando, '#hero-mando'], [trooper, '#hero-trooper']]){
    await g.waitForFunction(() => getComputedStyle(document.getElementById('coopjointemple')).display !== 'none', null, poll);
    await g.$eval(hero, el => el.click());
    await g.click('#coopjointemple');
    await inHub(g);
  }
  for (const p of [host, mando, trooper]) await p.evaluate(() => GAME.hub.goWing('training'));
  await Promise.all([inHub(host, 'training'), inHub(mando, 'training'), inHub(trooper, 'training')]);
  await host.waitForFunction(() => GAME.partnerInfo().all.filter(p => p.shown).length === 2, null, poll);
  const heroes = await Promise.all([host, mando, trooper].map(p => p.evaluate(() => GAME.G.hero)));
  if (heroes.join() !== 'jedi,mando,trooper') throw new Error('the three heroes should be a Jedi, a Mando and a trooper: ' + heroes);
  const [sm, st] = await Promise.all([mando, trooper].map(p => p.evaluate(() => GAME.coopNet.slot)));
  step('a Jedi, a Mandalorian and an ARC trooper meet in the training wing');

  // the Mando at the DUEL RING station could challenge too now; the Jedi calls it. A party with gunners can't be SABERS ONLY
  await host.waitForFunction(() => GAME.duel.info && document && true, null, poll);
  await host.evaluate(() => { const c = GAME.duel.open; c(GAME.partnerInfo().all[0].slot, 'X', true); });
  await host.waitForFunction(() => document.getElementById('duelpanel').classList.contains('open') && /FREE-FOR-ALL/.test(document.getElementById('duelpanel').textContent), null, poll);
  const sabersOff = await host.evaluate(() => document.querySelector('#duelpanel [data-a="kit:sabers"]').classList.contains('off'));
  if (!sabersOff) throw new Error('SABERS ONLY should be off for a party with gunners in it');
  if (shots) await host.screenshot({ path: shots + '/ffa-challenge-card.png' });
  await host.locator('#duelpanel [data-a="send"]').click();
  for (const g of [mando, trooper]) await g.waitForFunction(() => document.getElementById('duelpanel').classList.contains('open') && /FREE-FOR-ALL/.test(document.getElementById('duelpanel').textContent), null, poll);
  if (shots) await mando.screenshot({ path: shots + '/ffa-incoming-card.png' });
  step('the Jedi calls a free-for-all under ANY HERO, and both gunners are asked');
  for (const g of [mando, trooper]) await g.locator('#duelpanel [data-a="yes"]').click();
  await host.waitForFunction(() => { const i = GAME.duel.info(); return i.M && i.M.ref && i.M.s.length === 3 && (i.M.ph === 'enter' || i.M.ph === 'count'); }, null, poll);
  for (const g of [mando, trooper]) await g.waitForFunction(() => { const i = GAME.duel.info(); return i.M && i.M.me >= 1 && i.levelled && i.cover > 0; }, null, poll);
  const lm = await mando.evaluate(() => ({ w: GAME.player.weapon, rocket: !!GAME.G.unlocked.rocket, kit: GAME.duel.info().M.kit, cover: GAME.duel.info().cover }));
  if (!['single', 'dual'].includes(lm.w) || lm.rocket || lm.kit !== 'any' || lm.cover < 4) throw new Error('the Mando should be on his base guns, no rockets, with cover in the ring: ' + JSON.stringify(lm));
  const marks = await Promise.all([host, mando, trooper].map(posOf));
  const spread = Math.min(...marks.map((a, i) => Math.min(...marks.filter((_, j) => j !== i).map(b => Math.hypot(a.x - b.x, a.z - b.z)))));
  if (spread < 4) throw new Error('the three marks should stand round the ring: ' + JSON.stringify(marks));
  step('all three on their marks round the ring, levelled, with cover in it');
  await Promise.all([host, mando, trooper].map(p => p.waitForFunction(() => GAME.duel.info().M.ph === 'fight', null, poll)));
  if (shots){ await mando.bringToFront(); await mando.waitForTimeout(600); await mando.screenshot({ path: shots + '/ffa-mando-view.png' }); await host.bringToFront(); await host.waitForTimeout(600); await host.screenshot({ path: shots + '/ffa-jedi-view.png' }); }
  step('the count, then FIGHT on all three screens');

  // THE MANDO'S BOLT: aimed at the Jedi, flown on the Jedi's screen, which takes the hit and scores a part of a clean hit
  const fire = async () => {
    const j = await posOf(host);
    await mando.evaluate((j) => {
      const { player, G } = GAME, p = player.group.position;
      p.set(j.x - 4, 0, j.z); player.vel.set(0, 0, 0); G.yaw = player.faceYaw = Math.PI / 2; player.group.rotation.y = G.yaw;
      const O = p.clone().set(p.x + 0.6, 1.5, p.z), D = p.clone().set(j.x - O.x, (j.y + 1.3) - O.y, j.z - O.z).normalize();
      GAME.spawnBlasterBolt(O, D, 14, 0xff5a3a, 1, {}, { spread: 0 });
    }, j);
  };
  await host.evaluate(() => { GAME.player.blockHeld = false; GAME.player.parryT = 0; });
  const hitsBefore = (await info(host)).M.hits[1];
  for (let i = 0; i < 8; i++){
    await host.evaluate(() => { GAME.player.blockHeld = false; GAME.player.parryT = 0; GAME.player.dashT = 0; });
    await fire();
    await host.waitForTimeout(800);
    if ((await info(host)).M.hits[1] > hitsBefore) break;
  }
  const afterBolt = (await info(host)).M.hits;
  if (!(afterBolt[1] > hitsBefore && afterBolt[1] < 1)) throw new Error('the Mando\'s bolt should land on the Jedi as a part of a clean hit: ' + JSON.stringify(afterBolt));
  step('the Mando\'s bolt flies on the Jedi\'s screen and lands as a part of a clean hit');

  // a bolt into the Jedi's held guard: blocked on the Jedi's screen, nothing scored
  let blocked = false;
  for (let i = 0; i < 6 && !blocked; i++){
    const m = await mando.evaluate(() => { const p = GAME.player.group.position; return { x: p.x, z: p.z }; });
    await host.evaluate((m) => { const { player, G } = GAME, pp = player.group.position; G.yaw = player.faceYaw = Math.atan2(m.x - pp.x, m.z - pp.z); player.group.rotation.y = G.yaw;
      player.stam = 999; player.blockHeld = true; player.parryT = 0; window.__blk = setInterval(() => { GAME.player.blockHeld = true; GAME.player.stam = 999; }, 30); }, m);
    const before = (await info(host)).M.hits[1];
    await fire();
    await host.waitForTimeout(800);
    await host.evaluate(() => clearInterval(window.__blk));
    if ((await info(host)).M.hits[1] === before) blocked = true;
  }
  await host.evaluate(() => { GAME.player.blockHeld = false; });
  if (!blocked) throw new Error('a bolt into the Jedi\'s held guard should be stopped and score nothing');
  step('a bolt into the Jedi\'s held guard is stopped on the Jedi\'s screen and scores nothing');

  // THE FLAMER: the Mando burns the trooper standing in the stream
  const t0 = await posOf(trooper);
  await mando.evaluate((t) => { const { player, G } = GAME, p = player.group.position; p.set(t.x - 2.2, 0, t.z); player.vel.set(0, 0, 0); G.yaw = player.faceYaw = Math.PI / 2; player.group.rotation.y = G.yaw; G.pitch = 0; player.force = 100; }, t0);
  await trooper.evaluate(() => { GAME.player.vel.set(0, 0, 0); });
  const burnBefore = (await info(host)).M.hits[1];
  await mando.evaluate(() => { GAME.keys['f'] = true; window.__f = setInterval(() => { GAME.player.force = 100; }, 50); });
  await host.waitForFunction((b) => GAME.duel.info().M.hits[1] > b + 0.05, burnBefore, { timeout: 30000, polling: 250 }).catch(() => {});
  if (shots){ await mando.bringToFront(); await mando.waitForTimeout(300); await mando.screenshot({ path: shots + '/ffa-flamer.png' }); }
  await mando.evaluate(() => { GAME.keys['f'] = false; clearInterval(window.__f); });
  const burnAfter = (await info(host)).M.hits[1];
  if (!(burnAfter > burnBefore + 0.05)) throw new Error('the flamer should burn the trooper for a part of a clean hit: ' + burnBefore + ' → ' + burnAfter);
  step('the Mando\'s flamer burns the trooper, judged on the trooper\'s screen');

  // THE JEDI'S CUT on the trooper: a full clean hit
  await mando.evaluate(() => { const p = GAME.player.group.position; p.set(p.x, 0, p.z + 6); });   // (out of the way)
  const cutBefore = (await info(host)).M.hits[0];
  for (let i = 0; i < 20; i++){
    const t = await posOf(trooper);
    await host.evaluate((t) => { const { G, player } = GAME; player.group.position.set(t.x - 1.3, 0, t.z); player.vel.set(0, 0, 0); G.yaw = player.faceYaw = Math.PI / 2; player.group.rotation.y = G.yaw; G.pitch = 0.05; player.stam = 999; GAME.tryAttack(); }, t);
    await host.waitForTimeout(700);
    const M = (await info(host)).M;
    if (M.hits[0] >= cutBefore + 1 || M.rounds[0] > 0) break;
  }
  const cut = (await info(host)).M;
  if (!(cut.hits[0] >= cutBefore + 1 || cut.rounds[0] > 0)) throw new Error('the Jedi\'s cut should land on the trooper as a clean hit: ' + JSON.stringify(cut.hits) + ' host ' + JSON.stringify(await host.evaluate(() => ({ pvp: GAME.duel.pvp(), duel: GAME.G.duel, pos: GAME.player.group.position, part: GAME.partnerInfo().all.map(p => [p.slot, p.shown, p.pos]) })))
    + ' trooper ' + JSON.stringify(await trooper.evaluate(() => ({ pvp: GAME.duel.pvp(), duel: GAME.G.duel, pos: GAME.player.group.position, cover: !!GAME.player.cover }))));
  step('the Jedi\'s cut lands on the trooper as a full clean hit');

  // the trooper leaves: the free-for-all goes on for the other two
  await trooper.evaluate(() => GAME.duel.leave());
  await trooper.waitForFunction(() => !GAME.duel.info().M && !GAME.duel.info().levelled && !GAME.G.duel, null, poll);
  await host.waitForFunction((s) => { const M = GAME.duel.info().M; return M && M.gone.includes(s); }, st, poll);
  const still = await mando.evaluate(() => !!GAME.duel.info().M);
  if (!still) throw new Error('the Mando should still be in the match after the trooper left');
  step('the trooper leaves; the match goes on for the Jedi and the Mando');
  await host.evaluate(() => GAME.duel.leave());
  await mando.waitForFunction(() => !GAME.duel.info().M && !GAME.duel.info().levelled && !GAME.G.duel && GAME.duel.info().cover === 0, null, poll);
  const back = await mando.evaluate(() => GAME.player.weapon);
  step('the Jedi ends it: everyone\'s own numbers come back, the cover goes (the Mando holds his ' + back + ')');
  ok = !errors.length;
} catch(e){ console.log('FAIL ' + e.message); }
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close(); server.close?.();
console.log(ok ? 'PASS co-op duel free-for-all' : 'FAIL co-op duel free-for-all');
process.exit(ok ? 0 : 1);
