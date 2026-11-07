// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MASTERY WITH A CONTROLLER — boots the BUILT game with a stand-in pad (navigator.getGamepads) and walks the D-pad round
// the mastery pages (ui/forms-ui.js, ui/armory-ui.js) and the Jedi's meditation (game/meditation.js), logging where the
// ring lands (engine/gamepad.js) and shooting it. A sealed tile must never take the ring, and every tab, tile and slot
// must be reachable.   npm run build && node tools/shots/mastery-pad.mjs [out-dir]   (HEROES=jedi,mando,trooper)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { mkdirSync } from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const out = process.argv[2] || path.join(root, 'shots-out'); mkdirSync(out, { recursive: true });
const HEROES = (process.env.HEROES || 'jedi,mando,trooper').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
const BTN = { A: 0, B: 1, MENU: 9, up: 12, down: 13, left: 14, right: 15 };
for (const hero of HEROES){
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); } } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shot', 'NotSupportedError')); };
    const gp = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    window.__pad = gp; navigator.getGamepads = () => [gp];
  });
  page.on('pageerror', e => { bad++; console.log('page error: ' + e.message); });
  // held for three frames and let go for three (the pad is read once a frame, and a slow frame must not miss a press)
  const frames = (n) => page.evaluate((n) => new Promise(res => { const f = () => --n <= 0 ? res() : requestAnimationFrame(f); requestAnimationFrame(f); }), n);
  const press = async (b) => { await page.evaluate((i) => { const x = window.__pad.buttons[i]; x.pressed = true; x.value = 1; }, BTN[b]); await frames(3);
    await page.evaluate((i) => { const x = window.__pad.buttons[i]; x.pressed = false; x.value = 0; }, BTN[b]); await frames(3); await page.waitForTimeout(60); };
  const ring = () => page.evaluate(() => { const f = document.querySelector('.padfocus'); if (!f) return null;
    const d = Object.entries(f.dataset).map(([k, v]) => k + '=' + v).join(' ');
    return { what: f.className.replace(/\s*padfocus/, '') + (d ? ' [' + d + ']' : ''), sealed: f.classList.contains('sealed'), seen: (() => { const r = f.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === f || f.contains(h)); })() }; });
  // walk: each press logged; a sealed tile or a ring off screen counts as a fault
  const walk = async (label, dirs) => { const seen = new Set();
    for (const d of dirs){ await press(d); const r = await ring(); if (!r) continue; seen.add(r.what);
      if (r.sealed || !r.seen){ bad++; console.log('  FAULT', label, d, r); } }
    console.log(hero, label, '→', [...seen].join(' | ')); };
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
  await page.$eval('#hero-' + hero, el => el.click());
  await page.$eval('#mode-endless', el => el.click()); await page.$eval('#goText', el => el.click());
  await page.waitForTimeout(600);
  for (const s of ['#forms [data-go]', '#armory [data-go]']) if (await page.isVisible(s)) await page.click(s).catch(() => {});
  await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.evaluate((hero) => { const G = GAME.G;
    if (hero === 'jedi'){ for (const id of ['soresu', 'ataru']) (G.stanceUnlocked || (G.stanceUnlocked = {}))[id] = true; }
    else if (hero === 'mando') Object.assign(G.unlocked, { dual: true }); else Object.assign(G.unlocked, { modAuto: true });
    G.paused = true; document.getElementById('overlay').style.display = 'flex'; GAME.setOverlayState('pause'); }, hero);
  await page.waitForTimeout(300);
  await page.$eval('#formsBtn', el => el.click());
  await page.waitForSelector('#forms.open'); await page.waitForTimeout(600);
  await walk('forms', ['right', 'right', 'right', 'right', 'down', 'down', 'down', 'left', 'left', 'left', 'left', 'up', 'up', 'up', 'up', 'up']);
  await page.screenshot({ path: path.join(out, 'pad-' + hero + '-forms.png') });
  // on to the detail's tabs, and A opens one
  await walk('detail tabs', ['right', 'right', 'right', 'right', 'up', 'right', 'right']);
  await press('A'); await page.waitForTimeout(250);
  console.log(hero, 'after A:', (await ring())?.what, '· the detail tab open:', await page.evaluate(() => document.querySelector('#forms [data-dtab].on')?.dataset.dtab));
  await page.screenshot({ path: path.join(out, 'pad-' + hero + '-forms-a.png') });
  await press('B'); await page.waitForTimeout(400);
  console.log(hero, 'B closes the page:', await page.evaluate(() => !document.querySelector('#forms.open')));
  if (hero === 'jedi'){   // the meditation: A picks, MENU rises
    await press('B'); await page.waitForTimeout(600);   // (resume)
    await page.evaluate(() => { const G = GAME.G; G.paused = false; document.getElementById('overlay').style.display = 'none'; GAME.setOverlayState && GAME.setOverlayState('play'); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { GAME.G.stanceUnlocked.makashi = true; GAME.meditation.queue(['makashi']); });
    await page.waitForSelector('#meditate.open', { timeout: 20000 }); await page.waitForTimeout(700);
    await press('MENU'); await page.waitForTimeout(500);   // CONTINUE past the unlock card
    console.log('meditation after MENU:', await page.evaluate(() => document.querySelector('#meditate .md-panel')?.className));
    await walk('meditation', ['down', 'right', 'right', 'down', 'down', 'left', 'up', 'up', 'down', 'down', 'down']);
    await press('A'); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'pad-jedi-meditate.png') });
    await press('MENU'); await page.waitForTimeout(400);
    console.log('meditation risen by MENU:', await page.evaluate(() => !document.getElementById('meditate').classList.contains('open')), await page.evaluate(() => GAME.G.loadout));
  }
  await page.close();
}
await browser.close();
console.log(bad ? bad + ' fault(s)' : 'no faults');
process.exit(bad ? 1 : 0);
