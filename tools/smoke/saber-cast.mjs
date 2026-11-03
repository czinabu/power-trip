// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SABER CAST SMOKE TEST — duel foes wear their own look (data/saber-cast.js) on the BUILT game: in a mission duel and its
// entrance, as the Jedi and the Mando, and on a co-op guest's screen. SHOTS=<dir> saves a screenshot of each.
//   npm run build && npm run smoke:saber-cast

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9023';
const server = PeerServer({ port: 9023, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 150000, polling: 250 };
const SHOTS = process.env.SHOTS;
const W = SHOTS ? { width: 960, height: 540 } : { width: 480, height: 270 };

async function open(name){
  const page = await browser.newPage({ viewport: W });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript((q) => {
    try { localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, SHOTS ? 'medium' : 'low');
  await page.goto(url, { timeout: 180000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
// past the start card and the Jedi's forms page, into the fight
async function toPlay(page){
  for (let i = 0; i < 8 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
}
const fail = (msg) => { throw new Error(msg); };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), timeout: 180000 }); };
// the duel foe's look as built: its id on the foe, and the face it wears
const foeLook = (page) => page.evaluate(() => { const e = GAME.enemies.find(o => o.champion); const L = e && e.group.userData.look; return e ? { id: e.look, side: L && L.side, style: L && L.face && L.face.style } : null; });

async function duel(page, mid, obj, want, tag){
  await page.evaluate(([m, o]) => GAME.startMission(m, o), [mid, obj]);
  await toPlay(page);
  await page.waitForFunction(() => GAME.G.cutscene, null, poll);
  await page.waitForTimeout(SHOTS ? 5000 : 500);
  await shot(page, tag + '-entrance');
  await page.evaluate(() => GAME.cutscene.skipScene());
  await page.waitForFunction(() => GAME.enemies.some(e => e.champion), null, poll);
  const got = await foeLook(page);
  if (!got || got.id !== want.id || got.side !== want.side) fail(tag + ': the duel foe wore ' + JSON.stringify(got) + ', not ' + JSON.stringify(want));
  if (SHOTS){ await page.waitForTimeout(3500); await shot(page, tag + '-duel'); }
  console.log(tag + ': ' + mid + ' duel foe is ' + got.id + ' (' + got.side + ', ' + got.style + ')');
}

let ok = false;
try {
  const page = await open('jedi');
  await page.$eval('#hero-jedi', el => el.click()); await page.click('#mode-campaign');   // into a run first (a mission starts from inside one)
  await toPlay(page);
  await page.waitForFunction(() => document.querySelector('#chapcard.open'), null, poll);
  await page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); });
  await duel(page, 'last-lesson', 0, { id: 'ILSA VENN', side: 'jedi' }, 'jedi-ilsa');
  await duel(page, 'trial-knight', 0, { id: 'THE KNIGHT', side: 'jedi' }, 'jedi-kast');
  await duel(page, 'refuge', 2, { id: 'THE INQUISITOR', side: 'inq' }, 'jedi-inquisitor');
  await page.close();

  /* ---------- co-op: the guest's puppet of the host's duel foe wears the same look ---------- */
  const host = await open('host'), guest = await open('guest');
  await host.click('#mode-coop'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  for (const p of [host, guest]) await p.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
  await host.click('#coopclose'); await guest.click('#coopclose');
  await host.evaluate(() => localStorage.setItem('sw_mission_refuge_jedi', '1'));
  await host.$eval('#hero-jedi', el => el.click()); await host.click('#mode-mission'); await host.click('#msn-refuge');
  for (let i = 0; i < 5 && !(await host.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await host.isVisible('#goText')) await host.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await host.isVisible('#forms [data-go]')) await host.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await host.waitForTimeout(800);
  }
  await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await guest.$eval('#hero-mando', el => el.click()); await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
  for (let i = 0; i < 5 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await guest.isVisible('#forms [data-go]')) await guest.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await guest.waitForTimeout(800);
  }
  await host.evaluate(() => GAME.startMission('refuge', 2));
  await host.waitForFunction(() => GAME.G.cutscene, null, poll);
  await guest.keyboard.press('Enter');
  await host.waitForFunction(() => GAME.enemies.some(e => e.champion), null, poll);
  await guest.waitForFunction(() => GAME.enemies.some(e => e.group.userData.look && e.group.userData.look.mask === 'half'), null, poll);
  if (SHOTS){ await guest.waitForTimeout(3000); await shot(guest, 'coop-guest-inquisitor'); }
  console.log('co-op: the guest sees the Inquisitor in its own look');
  ok = true;
} catch(e){ console.error('FAIL:', e.message); }
if (errors.length){ console.error('page errors:\n' + errors.slice(0, 10).join('\n')); ok = false; }
await browser.close(); server.close && server.close();
console.log(ok ? 'SABER CAST SMOKE OK' : 'SABER CAST SMOKE FAILED');
process.exit(ok ? 0 : 1);
