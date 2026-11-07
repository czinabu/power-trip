// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MENU CAPTURE — boots the BUILT game (dist/index.html), plays each hero into the sandbox, pauses, and saves a shot of
// the pause screen and every panel it opens (settings, controls, load / save, co-op, codex, roadmap, the leave-run
// confirm), then the title screen's own (save files, new game). For checking the hero menu looks (styles/heroes/menus.css)
// before and after.
//   npm run build && node tools/shots/menus.mjs [outDir] [jedi,mando,trooper]   (PHONE=1: a phone in landscape;
//   PW_CHROMIUM a Chromium binary, when Playwright's own isn't installed)

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || 'shots');
const heroes = process.argv[3] ? process.argv[3].split(',') : ['jedi', 'mando', 'trooper'];
const phone = !!process.env.PHONE;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const shots = [
  ['settings', '#settoggle', '#settings', '#setclose'],
  ['controls', '#ctltoggle', '#howto', '#howtoclose'],
  ['load', '#loadBtn', '#saves', '#savesclose'],
  ['save', '#saveBtn', '#saves', '#savesclose'],
  ['coop', '#coopBtn', '#coop', '#coopclose'],
  ['codex', '#cxtoggle', '#codex', '#codex .howto-x'],
  ['roadmap', '#rmtoggle', '#roadmap', '#rmclose'],
];
for (const hero of heroes){
  const page = await browser.newPage(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
  });
  page.on('pageerror', e => errors.push(hero + ': ' + e.message));
  await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
  await page.$eval('#hero-' + hero, el => el.click());
  const snap = async name => { await page.waitForTimeout(300); await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {}); await page.screenshot({ path: path.join(out, `${hero}-${name}${phone ? '-phone' : ''}.png`) }); };
  const open = async (btn, panel) => { await page.$eval(btn, el => el.click()); await page.waitForFunction(p => { const e = document.querySelector(p); return e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }, panel, { timeout: 5000 }).catch(() => {}); };
  const close = async x => { await page.$eval(x, el => el.click()).catch(() => page.keyboard.press('Escape')); await page.waitForTimeout(200); };

  // the title screen's own: settings from the menu, save files, new game's confirm
  await snap('title');
  await open('#settoggle', '#settings'); await snap('title-settings'); await close('#setclose');
  if (await page.$('#filesBtn')){ await open('#filesBtn', '#files'); await snap('title-files'); await close('#filesclose'); }

  // into the sandbox, then pause
  await page.$eval('#mode-sandbox', el => el.click());
  const tap = async sel => { if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {}); };
  for (let i = 0; i < 6; i++){
    await tap('#goText'); await tap('#trainNo'); await tap('#forms [data-go]');
    if (await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 4000 }).then(() => true, () => false)) break;
  }
  await page.waitForTimeout(800);
  await page.keyboard.press('b'); await page.waitForTimeout(400); await snap('sandbox'); await page.$eval('#sbclose', el => el.click()); await page.waitForTimeout(300);
  await page.keyboard.press('Tab'); await page.waitForFunction(() => GAME.G.paused, null, { timeout: 5000 }).catch(() => {});
  await snap('pause');
  // a run from a hub: RETURN TO THE TEMPLE / COVERT / CITADEL joins the grid
  await page.evaluate(() => { const b = document.getElementById('templeBtn'); b.textContent = 'RETURN TO THE COVERT'; b.style.display = 'inline-flex'; });
  await snap('pause-hub');
  await page.evaluate(() => { document.getElementById('templeBtn').style.display = 'none'; });
  for (const [name, btn, panel, x] of shots){
    if (!(await page.$(btn))) continue;
    await open(btn, panel); await snap(name); await close(x);
  }
  await page.$eval('#homeBtn', el => el.click()); await snap('leave'); await tap('#homeNo');
  await page.close();
}
await browser.close();
if (errors.length){ console.log(errors.join('\n')); process.exitCode = 1; }
console.log('menus: shots in ' + out);
