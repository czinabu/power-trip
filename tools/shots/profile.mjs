// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// PROFILE CAPTURE — boots the BUILT game (dist/index.html), picks each hero and saves the profile page's three views
// (overview, the tree with a card picked, the two paths). For checking the hero profile looks (styles/heroes/profile.css).
//   npm run build && node tools/shots/profile.mjs [outDir] [jedi,mando,trooper]   (PHONE=1: a phone in landscape;
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
for (const hero of heroes){
  const page = await browser.newPage(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
  });
  page.on('pageerror', e => errors.push(hero + ': ' + e.message));
  await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
  await page.$eval('#hero-' + hero, el => el.click());
  await page.evaluate(() => document.fonts.ready);
  const snap = async name => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, `${hero}-profile-${name}${phone ? '-phone' : ''}.png`) }); };
  await page.$eval('#pfBtn', el => el.click());
  await page.waitForSelector('#profile.open');
  await snap('overview');
  await page.$eval('#profile .pf-vtabs [data-view="tree"]', el => el.click());
  const node = await page.$('#profile .pf-tnode');
  if (node) await node.evaluate(el => el.click());
  await snap('tree');
  const sides = await page.$('#profile .pf-vtabs [data-view="sides"]');
  if (sides){ await sides.evaluate(el => el.click()); await snap('sides'); }
  await page.close();
}
await browser.close();
if (errors.length){ console.log(errors.join('\n')); process.exitCode = 1; }
console.log('profile: shots in ' + out);
