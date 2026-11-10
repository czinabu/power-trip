// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP DUEL SMOKE TEST — duel mode (game/duel-mode.js, net/pvp.js): two browsers on the BUILT game, both Jedi, meet in the
// temple's training wing. The host challenges the guest, who accepts on the card; both are put on their marks, levelled,
// and after the count the blades come out. The host's real saber cuts reach the guest, whose own screen judges them
// (the defender's verdict); three clean hits take the round for the host and the referee moves to round two. Then a
// guest's parry is checked to come back as a parry, and leaving puts both heroes' own numbers back. The guest plays over a
// slow link (?netlag): the cut's cue shows on the guest's screen before it lands, and a guard raised after a blow landed
// is judged too late while one dropped since still holds (net/pvp.js, split the link).
//   npm run build && npm run smoke:coop-duel

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9043';
const server = PeerServer({ port: 9043, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 90000, polling: 250 };
const step = (what) => console.log('ok   ' + what);

async function open(name, extra = ''){
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url + extra);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const inHub = (page, wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && (!w || GAME.G.hubWing === w), wing, poll);
const info = (page) => page.evaluate(() => GAME.duel.info());

let ok = false;
try {
  const host = await open('host'), guest = await open('guest', process.env.NETLAG === undefined ? '&netlag=90' : '&netlag=' + process.env.NETLAG);
  await host.click('#mode-coop'); await host.fill('#coopname', 'Kira'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopname', 'Tal'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  await host.$eval('#hero-jedi', el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
  await inHub(host);
  await guest.waitForFunction(() => getComputedStyle(document.getElementById('coopjointemple')).display !== 'none', null, poll);
  await guest.$eval('#hero-jedi', el => el.click());
  await guest.click('#coopjointemple');
  await inHub(guest);
  for (const p of [host, guest]) await p.evaluate(() => GAME.hub.goWing('training'));
  await Promise.all([inHub(host, 'training'), inHub(guest, 'training')]);
  await host.waitForFunction(() => GAME.partnerShown(), null, poll);
  await guest.waitForFunction(() => GAME.partnerShown(), null, poll);
  step('two Jedi meet in the training wing');

  // the walk-up prompt: the host stands in front of the guest, facing them
  await guest.evaluate(() => { const { G, player } = GAME; player.group.position.set(10, 0, 4); player.vel.set(0, 0, 0); G.yaw = player.faceYaw = -Math.PI / 2; });
  await host.bringToFront();
  await host.evaluate(() => { const { G, player } = GAME; player.group.position.set(8, 0, 4); player.vel.set(0, 0, 0); G.yaw = player.faceYaw = Math.PI / 2; player.group.rotation.y = G.yaw; });
  await host.waitForFunction(() => document.getElementById('duelp').classList.contains('on') && /CHALLENGE TAL/.test(document.getElementById('duelp').textContent), null, poll);
  step('walking up to them offers F · CHALLENGE');
  await host.keyboard.press('f');
  await host.waitForFunction(() => document.getElementById('duelpanel').classList.contains('open') && /CHALLENGE TAL/.test(document.getElementById('duelpanel').textContent), null, poll);
  await host.locator('#duelpanel [data-a="send"]').click();
  await guest.waitForFunction(() => document.getElementById('duelpanel').classList.contains('open') && /KIRA CHALLENGES YOU/.test(document.getElementById('duelpanel').textContent), null, poll);
  step('the challenge card goes out, and the guest is asked');
  await guest.locator('#duelpanel [data-a="yes"]').click();
  await host.waitForFunction(() => { const i = GAME.duel.info(); return i.M && i.M.ref && (i.M.ph === 'enter' || i.M.ph === 'count'); }, null, poll);
  await guest.waitForFunction(() => { const i = GAME.duel.info(); return i.M && i.M.me === 1 && i.levelled; }, null, poll);
  const lv = await host.evaluate(() => ({ lev: GAME.duel.info().levelled, dmg: GAME.player.up.dmg, hp: GAME.player.up.hpMax, push: !!GAME.G.unlocked.push, slam: !!GAME.G.unlocked.slam, x: GAME.player.group.position.x }));
  if (!lv.lev || lv.dmg !== 1 || lv.hp !== 0 || !lv.push || lv.slam) throw new Error('the fighters should be levelled: ' + JSON.stringify(lv));
  if (Math.abs(lv.x - (14 - 3.6)) > 0.5) throw new Error('the challenger should be on the west mark: ' + lv.x);
  step('accepted: both on their marks in the ring, levelled');
  await host.waitForFunction(() => GAME.duel.info().M.ph === 'fight', null, poll);
  await guest.waitForFunction(() => GAME.duel.info().M.ph === 'fight', null, poll);
  step('the count, then FIGHT on both screens');

  // the host's real cuts: stand at the guest, swing until the guest's screen has judged three clean hits
  const close = async () => {
    const g = await guest.evaluate(() => { const p = GAME.player.group.position; return { x: p.x, z: p.z }; });
    await host.evaluate((g) => { const { G, player } = GAME; player.group.position.set(g.x - 1.3, 0, g.z); player.vel.set(0, 0, 0); G.yaw = player.faceYaw = Math.PI / 2; player.group.rotation.y = G.yaw; G.pitch = 0.05; }, g);
  };
  await guest.evaluate(() => { GAME.player.blockHeld = false; GAME.player.parryT = 0; });
  for (let i = 0; i < 40; i++){
    const s = await info(host);
    if (!s.M || s.M.rounds[0] >= 1) break;
    await close();
    await host.evaluate(() => { GAME.player.stam = 999; GAME.tryAttack(); });
    await host.waitForTimeout(700);
  }
  const s1 = await info(host);
  if (!s1.M || s1.M.rounds[0] < 1) throw new Error('three clean hits should take the round: ' + JSON.stringify(s1.M && { hits: s1.M.hits, rounds: s1.M.rounds, ph: s1.M.ph }));
  step('the host\'s cuts reach the guest, are judged on the guest\'s screen, and three clean hits take round one');
  await guest.waitForFunction(() => GAME.duel.info().M.rounds[0] === 1, null, poll);
  await host.waitForFunction(() => { const M = GAME.duel.info().M; return M.round === 2 && M.ph === 'fight'; }, null, poll);
  step('the guest sees the score; round two starts');

  // a parry on the guest's screen comes back as a parry: the guest holds a fresh parry window while the cut lands
  let parried = false;
  for (let i = 0; i < 12 && !parried; i++){
    await close();
    await guest.evaluate(() => { const { player, G } = GAME; const h = GAME.partnerInfo(); player.blockHeld = true; player.parryT = player.parryOpen = 0.6; player.parryLockT = 0;
      const pp = player.group.position, hp = GAME.partnerMate(0).pos; G.yaw = player.faceYaw = Math.atan2(hp.x - pp.x, hp.z - pp.z); player.group.rotation.y = G.yaw; });
    const before = await host.evaluate(() => GAME.duel.info().M.hits[0]);
    await host.evaluate(() => { GAME.player.stam = 999; window.__parried = 0; GAME.tryAttack(); });
    await host.waitForTimeout(700);
    const after = await host.evaluate(() => GAME.duel.info().M.hits[0]);
    const fl = await host.evaluate(() => GAME.player.flinchHeavy && GAME.player.flinchT > 0);
    if (after === before && fl) parried = true;
  }
  if (!parried) throw new Error('a parry on the guest\'s screen should turn the host\'s cut and leave the host reeling');
  step('a parry on the defender\'s screen turns the cut, and the attacker reels');

  // over the slow link: the guest's screen shows the cut coming before it lands
  await guest.evaluate(() => { window.__cue = 0; setInterval(() => { if (document.getElementById('duelcue').classList.contains('on')) window.__cue = 1; }, 16); });
  for (let i = 0; i < 6; i++){
    await close();
    await host.evaluate(() => { GAME.player.stam = 999; GAME.tryAttack(); });
    await host.waitForTimeout(700);
    if (await guest.evaluate(() => window.__cue)) break;
  }
  if (!await guest.evaluate(() => window.__cue)) throw new Error('the guest should see the host\'s cut coming');
  if (await guest.evaluate(() => GAME.duel.info().M.lk) < 60) throw new Error('the slow link should show in the duel\'s link: ' + await guest.evaluate(() => GAME.duel.info().M.lk));
  step('over a slow link, the defender sees the cut coming on its line');

  // split the link: a guard raised after the blow landed is too late; one dropped since still holds
  const face = () => guest.evaluate(() => { const { player, G } = GAME; const pp = player.group.position, hp = GAME.partnerMate(0).pos; G.yaw = player.faceYaw = Math.atan2(hp.x - pp.x, hp.z - pp.z); player.group.rotation.y = G.yaw; player.stam = 999; player.dashT = 0; player.flinchT = 0; });
  await close(); await face();
  await guest.evaluate(() => { GAME.player.blockHeld = false; GAME.player.parryT = 0; });
  await guest.waitForTimeout(400);
  const late = await guest.evaluate(() => { GAME.player.blockHeld = true; return GAME.duel.testBlow(200); });
  const onTime = await guest.evaluate(() => GAME.duel.testBlow(0));
  await guest.waitForTimeout(400); await face();
  const held = await guest.evaluate(() => { GAME.player.blockHeld = false; GAME.player.parryT = 0; const r = GAME.duel.testBlow(200); return { ...r, still: GAME.player.blockHeld }; });
  if (!late || late.res !== 'hit' || late.rw !== 'late') throw new Error('a guard raised after the blow landed should be too late: ' + JSON.stringify(late));
  if (!onTime || onTime.res !== 'blocked') throw new Error('a guard up when the blow lands should block it: ' + JSON.stringify(onTime));
  if (!held || held.res !== 'blocked' || held.rw !== 'held' || held.still) throw new Error('a guard dropped after the blow landed should still hold it: ' + JSON.stringify(held));
  step('split the link: a late guard is too late, a guard dropped after the blow still held');

  await host.evaluate(() => GAME.duel.leave());
  await guest.waitForFunction(() => !GAME.duel.info().M && !GAME.duel.info().levelled && !GAME.G.duel, null, poll);
  await host.waitForFunction(() => !GAME.duel.info().M && !GAME.duel.info().levelled && !GAME.G.duel, null, poll);
  step('leaving ends it on both screens and puts the heroes\' own numbers back');
  ok = !errors.length;
} catch(e){ console.log('FAIL ' + e.message); }
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close(); server.close?.();
console.log(ok ? 'PASS co-op duel' : 'FAIL co-op duel');
process.exit(ok ? 0 : 1);
