// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP RAID SMOKE TEST — a raid for a party: two browsers on the BUILT game, the host (the Jedi) begins today's raid
// (data/raids.js), the guest (the Mandalorian) joins it from the co-op panel; then Darth Kharel must show on the guest
// with the day's modifiers and his sunder bar, the guest's blows must carry their job to the host (boss/roles.js, net/run.js
// queueHit: from behind and a turned bolt fill the host's bar, a plain one from in front doesn't), the bar must fill on
// the guest's screen too, his break must show there, and his defeat must clear the raid for both.
//   npm run build && npm run smoke:coop-raid

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9024';
const server = PeerServer({ port: 9024, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 60000, polling: 250 };   // on a timer: only one of the two pages is in the foreground

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
          for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
          localStorage.setItem('sw_camp_gate_jedi', '1'); } catch(e){}   // (Act IV beaten: the raid table is open)
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const into = async (page) => {
  for (let i = 0; i < 20 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
    for (const sel of ['#goText', '#forms [data-go]', '#armory [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
};
const say = (t) => console.log('ok   ' + t);

let ok = false;
try {
  const host = await open('host'), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  // the host begins today's raid
  await host.$eval('#hero-jedi', el => el.click());
  const id = await host.evaluate(() => GAME.raids.raidIdFor('kharel'));
  await host.evaluate((id) => GAME.hub.launch('mission', id), id);
  await into(host);
  if (!(await host.evaluate((id) => GAME.G.mission && GAME.G.missionId === id, id))) throw new Error('the host did not begin the raid');
  // the guest joins it
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.$eval('#hero-mando', el => el.click());
  await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  await into(guest);
  if (!(await guest.evaluate((id) => GAME.G.coopGuest && GAME.G.mission && GAME.G.missionId === id, id))) throw new Error('the guest did not join the raid');
  say('the guest joined the host\'s raid (' + id + ')');
  // he steps down; the guest shows him with the day's modifiers and the bar
  await host.bringToFront();
  for (let i = 0; i < 480 && !(await host.evaluate(() => !!GAME.shared.finale)); i++){ await host.evaluate(() => GAME.cutscene && GAME.cutscene.skipScene && GAME.cutscene.skipScene()); await host.waitForTimeout(500); }
  if (!(await host.evaluate(() => GAME.shared.finale && GAME.shared.finale.fin.id === 'kharel' && GAME.shared.finale.fin.sd))) throw new Error('Kharel did not step down on the host with his bar');
  const hostMods = await host.evaluate(() => GAME.shared.finale.fin.raid.mods.join());
  await guest.waitForFunction(() => GAME.finale && GAME.finale.net, null, poll);
  await guest.waitForFunction(() => document.getElementById('bossmods').textContent.length > 0 && getComputedStyle(document.getElementById('bosssunder')).display !== 'none', null, poll);
  // the squad by the heroes in the fight as he stepped down (his bar grows with the same count)
  const sq = await host.evaluate(() => ({ allies: GAME.squad.allies.filter(a => !a.net && !a.dead).length, bar: GAME.shared.finale.fin.sd.max, solo: GAME.raids.RAIDS.kharel.boss.sunder.bar }));
  const want = sq.bar > sq.solo + 0.5 ? 1 : 3;
  if (sq.allies !== want) throw new Error('the squad does not match the party as he stepped down: ' + JSON.stringify(sq));
  say('Kharel is up on the guest with the day\'s modifiers (' + hostMods + ') and his sunder bar; ' + sq.allies + ' of the squad for the party he met (bar ' + sq.bar + ')');
  // keep both heroes standing, and him in one place
  await host.evaluate(() => { window._keep = setInterval(() => { if (GAME.player.hp < 60) GAME.player.hp = 100; const e = GAME.shared.finale; if (e && e.fin && !e.fin.over && e.hp < e.maxHp * 0.7) e.hp = e.maxHp * 0.9; }, 100); GAME.finaleMove(null); });
  await guest.evaluate(() => { window._keep = setInterval(() => { if (GAME.player.hp < 60) GAME.player.hp = 100; }, 100); });
  // the guest's blows: from in front (nothing for the bar), from behind and a turned bolt (the bar fills on the host)
  const blow = async (where, opts) => {
    const v0 = await host.evaluate(() => GAME.shared.finale.fin.sd.v);
    await guest.evaluate(([where, opts]) => { const b = GAME.finale, g = b.group.position, P = GAME.player.group.position, s = where === 'behind' ? -3 : 3;
      P.set(g.x + Math.sin(b.group.rotation.y) * s, 0, g.z + Math.cos(b.group.rotation.y) * s); GAME.damageEnemy(b, 10, null, 0, false, false, opts || undefined); }, [where, opts]);
    await host.waitForTimeout(1500);
    return host.evaluate((v0) => GAME.shared.finale.fin.sd.v - v0, v0);
  };
  await host.evaluate(() => { const e = GAME.shared.finale; e.fin.bucket = 0; });
  const front = await blow('front');
  await host.evaluate(() => { GAME.shared.finale.fin.bucket = 0; });
  const behind = await blow('behind');
  await host.evaluate(() => { GAME.shared.finale.fin.bucket = 0; });
  const deflect = await blow('front', { deflected: true });
  if (!(behind > 5 && deflect > 15 && front < behind)) throw new Error('the guest\'s jobs did not carry to the host: ' + JSON.stringify({ front, behind, deflect }));
  say('the guest\'s blows carry their job to the host (front ' + front.toFixed(1) + ', behind ' + behind.toFixed(1) + ', a turned bolt ' + deflect.toFixed(1) + ')');
  await guest.waitForFunction(() => parseFloat(document.querySelector('#bosssunder .sd-bg i').style.width) > 0, null, poll);
  say('the bar fills on the guest\'s screen too');
  // the break: the host's bar full, the guest sees it break
  await host.evaluate(() => { const F = GAME.shared.finale.fin; F.sd.v = F.sd.max; });
  await guest.waitForFunction(() => document.getElementById('bosssunder').classList.contains('open'), null, poll);
  say('his break shows on the guest');
  // his defeat: the raid is cleared for both
  await host.evaluate(() => { clearInterval(window._keep); GAME.finaleMove('defeat', 3); });
  await host.waitForFunction(() => GAME.G.mode === 'victory', null, { ...poll, timeout: 240000 });
  await guest.waitForFunction(() => GAME.G.mode === 'victory', null, { ...poll, timeout: 60000 });
  say('his defeat clears the raid for both');
  ok = true;
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, mission: GAME.G.missionId, boss: !!GAME.finale, sd: GAME.shared.finale && GAME.shared.finale.fin && GAME.shared.finale.fin.sd && GAME.shared.finale.fin.sd.v, status: document.getElementById('coopstatus').textContent })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op raid\n' + errors.join('\n')); process.exit(1); }
console.log('CO-OP RAID SMOKE: PASSED');
process.exit(0);
