// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP BOSS PARTY SMOKE TEST — one final boss, two heroes (boss/duo.js): two browsers on the BUILT game, the host starts
// the Mandalorian's campaign, the guest joins it as the trooper, and Darth Vexis steps in. His health must be sized for
// the party, the guest's blows must pull him onto the guest (THREAT) and the host's then land harder (BLINDSIDE), two
// blows from either side of him must catch him between them (PINCER, shown on both screens), and the guest leaving
// must shrink him back to one hero's worth, keeping his share of the bar.
//   npm run build && npm run smoke:coop-duo

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9032';
const server = PeerServer({ port: 9032, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 30000, polling: 250 };   // on a timer: only one of the two pages is in the foreground
const say = (t) => console.log('ok   ' + t);

async function open(name){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
          localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_camp_mando', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
// a banner with this headline shows on this page (polled, since it fades)
const bannerSeen = (page, re) => page.waitForFunction((re) => new RegExp(re).test(document.getElementById('bannerh').textContent), re, poll);

let ok = false;
try {
  const host = await open('host'), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(host), connected(guest)]);
  await host.click('#coopclose');
  await host.$eval('#mode-campaign', el => el.click()); await host.$eval('#hero-mando', el => el.click());
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    await host.waitForTimeout(800);
  }
  const begin = (page) => page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); GAME.cutscene.skipScene(); });
  await host.waitForFunction(() => document.querySelector('#chapcard.open'), null, poll); await begin(host);
  await host.evaluate(() => GAME.startChapter(1)); await begin(host);
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.click('#coopclose'); await guest.$eval('#hero-trooper', el => el.click());
  await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  for (let i = 0; i < 5 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
    await guest.waitForTimeout(800);
  }
  if (!(await guest.evaluate(() => GAME.G.coopGuest))) throw new Error('the guest did not join the host\'s run');
  await begin(guest);
  await host.evaluate(() => GAME.startLevel(1, { resume: true }));
  await guest.waitForFunction(() => GAME.G.levelIdx === 1 && GAME.G.coopGuest, null, poll);
  await guest.evaluate(() => { document.getElementById('skilltree').style.display = 'none'; GAME.G.skillSelect = false; });
  await host.waitForFunction(() => GAME.partnerMate(1) && GAME.partnerMate(1).here, null, poll);
  await host.evaluate(() => { for (const e of GAME.enemies) GAME.damageEnemy(e, 99999, null, 0, false, false); GAME.G.spawnQueue.length = 0; GAME.shared.levelPhase = 'bossfight';
    GAME.spawnFinale('vexis', { x: 0, z: -(GAME.shared.arenaHalfZ || 30) + 6 }); });
  await guest.waitForFunction(() => GAME.finale && GAME.finale.net, null, poll);
  // keep both heroes up and him busy with nothing: no moves, so the test decides who stands where
  // (and in the fight: a background page with no pointer lock reads as paused, which puts that hero out of it)
  for (const p of [host, guest]) await p.evaluate(() => { window._keep = setInterval(() => { if (GAME.player.hp < 80) GAME.player.hp = 100; GAME.G.paused = false; GAME.G.skillSelect = false; }, 100); });
  await host.waitForFunction(() => !GAME.partnerMate(1).away, null, poll);
  await host.bringToFront();

  // HIS HEALTH: sized for two (data/coop.js DUO.hp)
  const hp = await host.evaluate(() => ({ max: GAME.finale.maxHp, party: GAME.finale.fin.party }));
  if (hp.party !== 2) throw new Error('he did not count the party: ' + JSON.stringify(hp));
  say('he stepped in sized for a party of two (' + hp.max + ' hp)');

  // THREAT: the host stands right by him, the guest well off; the guest's blows pull him onto the guest
  const place = (page, dx, dz) => page.evaluate(([dx, dz]) => { const g = GAME.finale.group.position; GAME.player.group.position.set(g.x + dx, 0, g.z + dz); }, [dx, dz]);
  await place(host, 0, 3); await place(guest, 0, 9);
  await host.waitForTimeout(1200);
  await host.evaluate(() => { const e = GAME.finale; e.fin.duo && e.fin.duo.th.clear(); e.fin.sigT = 99; e.fin.duo && (e.fin.duo.since = -99); });
  for (let i = 0; i < 4; i++){ await guest.evaluate(() => { GAME.finale && GAME.damageEnemy(GAME.finale, 25, null, 0, false, false); }); await host.waitForTimeout(400); }
  await host.waitForFunction(() => GAME.finale.hero && !GAME.finale.hero.local, null, poll);
  say('the guest\'s blows pulled him off the host, onto the guest');

  // BLINDSIDE: the host's blow, now he's on the guest, lands harder than its face value
  const bs = await host.evaluate(() => { const e = GAME.finale; e.fin.bucket = 0; const h0 = e.hp; GAME.damageEnemy(e, 20, null, 0, false, false); return h0 - e.hp; });
  const base = await host.evaluate(() => { const e = GAME.finale, F = e.fin; return 20 * (F.def.phaseResist[F.phase - 1] ?? 1) * (F.def.armour ?? 1); });
  if (!(bs > base * 1.1)) throw new Error('the blindside did not land harder: ' + bs + ' vs ' + base);
  say('a blow from the hero he isn\'t on lands harder (' + bs.toFixed(1) + ' for ' + base.toFixed(1) + ')');

  // PINCER: the host on one side, the guest on the other, a blow each within a breath
  await host.evaluate(() => { const d = GAME.finale.fin.duo; d.pcUntil = 0; d.last.clear(); GAME.finale.fin.bucket = 0; GAME.finaleMove(null); GAME.finale.fin.sigT = 99; GAME.finale.fin.crowdT = -99; });
  await place(host, 0, 2.5); await place(guest, 0, -2.5);
  await host.waitForTimeout(700);
  // (the guest's first, then the host's the moment the guest's has landed there: a background page's link is slow)
  await guest.evaluate(() => GAME.damageEnemy(GAME.finale, 10, null, 0, false, false));
  await host.waitForFunction(() => [...GAME.finale.fin.duo.last.keys()].some(p => !p.local), null, poll);
  await host.evaluate(() => { const e = GAME.finale, g = e.group.position, a = [...e.fin.duo.last].find(([p]) => !p.local)[1].ang + Math.PI;   // (right across him from where the guest struck)
    GAME.player.group.position.set(g.x + Math.sin(a) * 2.5, 0, g.z + Math.cos(a) * 2.5); GAME.finaleMove(null); GAME.damageEnemy(e, 10, null, 0, false, false); });
  await host.waitForFunction(() => GAME.G.gt < (GAME.finale.openUntil || 0), null, poll);
  await bannerSeen(host, 'CAUGHT BETWEEN');
  await bannerSeen(guest, 'CAUGHT BETWEEN');
  say('two blows from either side caught him between them: he opened up, and both screens said so');

  // the party shrinks: the guest leaves, and he's one hero's worth again, at the same share of his bar
  const before = await host.evaluate(() => GAME.finale.hp / GAME.finale.maxHp);
  await guest.evaluate(() => { clearInterval(window._keep); GAME.startSandbox(); });   // (off to another mode: no longer in this fight)
  await host.waitForFunction(() => GAME.finale.fin.party === 1, null, { ...poll, timeout: 60000 });
  const after = await host.evaluate(() => ({ k: GAME.finale.hp / GAME.finale.maxHp, max: GAME.finale.maxHp }));
  if (!(after.max < hp.max * 0.75 && Math.abs(after.k - before) < 0.02)) throw new Error('he did not shrink back for one hero: ' + JSON.stringify({ before, after, hp }));
  say('the guest went off to another mode: he shrank to one hero\'s worth (' + after.max + ' hp), at the same share of his bar');
  ok = true;
} catch(e){ errors.push(e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, guest: GAME.G.coopGuest, boss: GAME.finale ? [GAME.finale.state, Math.round(GAME.finale.hp), GAME.finale.maxHp, GAME.finale.hero && GAME.finale.hero.id] : null, duo: GAME.finale && GAME.finale.fin && GAME.finale.fin.duo ? { gt: GAME.G.gt, pc: GAME.finale.fin.duo.pcUntil, open: GAME.finale.openUntil, last: [...GAME.finale.fin.duo.last].map(([p, l]) => [p.id, l]), at: [GAME.player.group.position, GAME.partnerMate(1) && GAME.partnerMate(1).pos].filter(Boolean).map(p => [+(p.x - GAME.finale.group.position.x).toFixed(1), +(p.z - GAME.finale.group.position.z).toFixed(1)]) } : null })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op boss party\n' + errors.join('\n')); process.exit(1); }
console.log('CO-OP BOSS PARTY SMOKE: PASSED');
process.exit(0);
