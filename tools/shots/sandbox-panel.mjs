// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SANDBOX PANEL SHOTS — opens the sandbox panel (B) for each hero from the BUILT game and saves a screenshot of it at a
// desktop, a phone-upright and a phone-on-its-side size. Writes to OUT (default: shots-sandbox/).
//   npm run build && node tools/shots/sandbox-panel.mjs            (HEROES=jedi,mando picks some; SIZES=desk picks some)

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const OUT = process.env.OUT || path.join(root, 'shots-sandbox');
const SIZES = { desk: { width: 1280, height: 760 }, phone: { width: 390, height: 780 }, side: { width: 844, height: 390 } };
const heroes = (process.env.HEROES || 'jedi,mando,trooper').split(',');
const sizes = (process.env.SIZES || Object.keys(SIZES).join(',')).split(',');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const hero of heroes) for (const sz of sizes){
  const page = await browser.newPage({ viewport: SIZES[sz], deviceScaleFactor: +(process.env.DPR || 1) });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_asktrain', '1');
    for (const h of ['jedi', 'mando', 'trooper']) localStorage.setItem('sw_camp_' + h, '1');
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shot', 'NotSupportedError')); };
  });
  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && GAME.G);
  await page.$eval('#hero-' + hero, el => el.click()); await page.$eval('#mode-sandbox', el => el.click());
  for (let i = 0; i < 8; i++){
    for (const s of ['#goText', '#trainNo', '#forms [data-go]']) if (await page.isVisible(s)) await page.click(s, { timeout: 1500 }).catch(() => {});
    if (await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 3000 }).then(() => true, () => false)) break;
  }
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: '.sb-panel,.sb-bsimbox{animation:none!important}' });   // (headless frames are slow: skip the rise-in)
  await page.keyboard.press('b');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${hero}-${sz}.png`) });
  if (process.env.BSIM && await page.isVisible('#sbbsim')){ await page.click('#sbbsim'); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${hero}-${sz}-bsim.png`) }); }
  if (errs.length) console.log(hero, sz, 'errors:', errs.join(' | '));
  await page.close();
}
await browser.close();
