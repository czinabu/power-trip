// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP GROUP CHOICE SMOKE TEST — a story choice in co-op (game/group-choice.js): both screens are asked at once, picks
// stay hidden until everyone has chosen, a split is settled by a roll, both screens tell the winner's story, and each
// player's own pick moves their own meter. Agreed picks need no roll.
//   npm run build && node tools/smoke/coop-choice.mjs   (SHOTS=dir saves screenshots)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9031';
const server = PeerServer({ port: 9031, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 30000, polling: 250 };
const SHOTS = process.env.SHOTS;
const shot = async (page, name) => { if (SHOTS){ await page.bringToFront(); await page.waitForTimeout(1200); } if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

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


  // the chapter the Jedi's first choice follows (data/campaign-jedi.js JEDI_CHOICES: the Ledger, after 'archive')
  const archive = await host.evaluate(() => GAME.chapters().findIndex(c => c.id === 'archive'));
  if (archive < 0) throw new Error('no archive chapter');
  const align = (page, h) => page.evaluate((h) => GAME.PROFILE.alignOf(h), h);
  const card = (page) => page.evaluate(() => (document.querySelector('#chapcard.open') || {}).textContent || '');
  // no foes, and the pop-ups the jump between chapters handed over seen (they'd sit over the card)
  const clear = async (page) => {
    await page.evaluate(() => { for (const e of GAME.enemies) GAME.damageEnemy(e, 99999, null, 0, false, false); GAME.G.spawnQueue.length = 0; });
    for (let i = 0; i < 20; i++){
      await page.waitForTimeout(400);
      const up = await page.evaluate(() => { const b = document.querySelector('#abilitycard.open [data-next]'); if (b) b.click(); const m = document.querySelector('#meditate.open .go, #armory.open [data-go]'); if (m) m.click(); return !!(b || m); });
      if (!up && i > 4) break;
    }
  };
  await host.evaluate((p) => GAME.startChapter(p), archive); await begin(host);
  await guest.waitForFunction((p) => GAME.G.chapter === p && document.querySelector('#chapcard.open [data-go]'), archive, poll); await begin(guest);
  await host.waitForTimeout(1500);
  await clear(host); await clear(guest);
  await guest.evaluate(() => GAME.cutscene.skipScene()); await host.evaluate(() => GAME.cutscene.skipScene());

  // 1. A SPLIT: everyone is asked at once, picks stay hidden until all are in, a roll settles it, the same story on both
  const a0 = { host: await align(host, 'jedi'), guest: await align(guest, 'mando') };
  await host.evaluate((p) => { GAME.G.chapter = p; GAME.nextChapter(); }, archive);
  await host.waitForFunction(() => /GROUP CHOICE/.test((document.querySelector('#chapcard.open') || {}).textContent || ''), null, poll);
  await guest.bringToFront();
  await guest.waitForFunction(() => /GROUP CHOICE/.test((document.querySelector('#chapcard.open') || {}).textContent || '') && document.querySelector('#chapcard.open .cc-opt'), null, poll);
  await shot(guest, 'guest-asked');
  console.log('ok   both screens are asked the choice at once');
  await host.click('#chapcard.open .cc-opt[data-go="saved"]');
  await host.waitForFunction(() => /WAITING FOR FRIEND/i.test(document.querySelector('#chapcard.open').textContent), null, poll);
  if (/BURN|SAVE IT|CARRY/.test(await guest.evaluate(() => document.querySelector('#chapcard.open .gv-list') ? document.querySelector('#chapcard.open .gv-list').textContent : ''))) throw new Error('the host\'s pick showed before everyone chose');
  await shot(host, 'host-waiting-on-pick');
  console.log('ok   host waits: ' + (await card(host)).replace(/\s+/g, ' ').slice(0, 160));
  await guest.click('#chapcard.open .cc-opt[data-go="burned"]');
  await Promise.all([host, guest].map(p => p.waitForFunction(() => document.querySelector('#chapcard.open .gv-res'), null, poll)));
  const rh = await host.evaluate(() => GAME.voteState()), rg = await guest.evaluate(() => GAME.voteState());
  await shot(host, 'host-roll'); await shot(guest, 'guest-roll');
  if (!rh.res || !rg.res || rh.res.k !== rg.res.k) throw new Error('the screens disagree on the result: ' + JSON.stringify([rh, rg]));
  if (!rh.res.picks.every(p => p[2] >= 1 && p[2] <= 100)) throw new Error('a split was not rolled: ' + JSON.stringify(rh.res));
  console.log('ok   split rolled: ' + JSON.stringify(rh.res.picks) + ' -> ' + rh.res.k);
  for (const p of [guest, host]) await p.evaluate(() => { const b = document.querySelector('#chapcard.open .cc-vote .go'); if (b) b.click(); });
  await host.waitForFunction((p) => GAME.G.chapter === p + 1, archive, poll);
  const sh = await host.evaluate(() => GAME.G.story.ledger), sg = await guest.evaluate(() => GAME.G.story.ledger);
  if (sh !== rh.res.k || sg !== rh.res.k) throw new Error('the story is not the winner on both: ' + sh + ' / ' + sg);
  const a1 = { host: await align(host, 'jedi'), guest: await align(guest, 'mando') };
  if (!(a1.host > a0.host) || !(a1.guest < a0.guest)) throw new Error('each player\'s own pick did not move their own meter: ' + JSON.stringify([a0, a1]));
  console.log('ok   story = ' + sh + ' on both; own meters moved (host light, guest dark)');

  // 2. AGREED: the same pick, no roll
  await host.waitForTimeout(1500); await shot(guest, 'guest-next-briefing'); await begin(host); await begin(guest);
  await host.evaluate(() => { delete GAME.G.story.ledger; });
  await host.evaluate((p) => GAME.startChapter(p), archive); await begin(host);
  await guest.waitForFunction((p) => GAME.G.chapter === p && document.querySelector('#chapcard.open [data-go]'), archive, poll); await begin(guest);
  await host.waitForTimeout(1500);
  await clear(host); await clear(guest);
  await guest.evaluate(() => GAME.cutscene.skipScene()); await host.evaluate(() => GAME.cutscene.skipScene());
  await host.evaluate((p) => { GAME.G.chapter = p; GAME.nextChapter(); }, archive);
  // (the guest's pop-ups from the jump come first, and the choice right after them; its tab in front, where frames run)
  await guest.bringToFront();
  await guest.waitForFunction(() => { GAME.clearComms(); const b = document.querySelector('#abilitycard.open [data-next]'); if (b) b.click(); return document.querySelector('#chapcard.open .cc-opt'); }, null, { timeout: 60000, polling: 400 });
  await guest.click('#chapcard.open .cc-opt[data-go="saved"]');
  await host.waitForFunction(() => document.querySelector('#chapcard.open .cc-opt'), null, poll);
  await host.click('#chapcard.open .cc-opt[data-go="saved"]');
  await Promise.all([host, guest].map(p => p.waitForFunction(() => /EVERYONE AGREED/.test((document.querySelector('#chapcard.open') || {}).textContent || ''), null, poll)));
  await shot(guest, 'guest-agreed');
  console.log('ok   agreed picks: no roll');
  ok = true;
} catch(e){ errors.push(e.stack || e.message); for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, ch: GAME.G.chapter, sel: GAME.G.skillSelect, card: GAME.G.cardUp, cut: GAME.G.cutscene, ph: GAME.shared.levelPhase, vote: GAME.voteState(), hold: GAME.coopRun.holdPopups, foes: GAME.enemies.filter(e => !e.dead).length, sq: GAME.G.spawnQueue.length, txt: ((document.querySelector('#chapcard.open') || {}).textContent || '').slice(0, 300) })).catch(x => x.message))); }
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op group choice\n' + errors.join('\n')); process.exit(1); }
console.log('ok   co-op group choice');
process.exit(0);
