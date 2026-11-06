// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ZONE MAP SHOTS — boots the BUILT game straight into the old city of Jedha as a hero and screenshots the HUD's minimap
// and the full map (ui/zone-map.js).   npm run build && node tools/shots/zone-map.mjs [out-dir]   (HEROES=jedi PHONE=1)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { mkdirSync } from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const out = process.argv[2] || path.join(root, 'shots-out'); mkdirSync(out, { recursive: true });
const HEROES = (process.env.HEROES || 'jedi,mando,trooper').split(',');
const phone = !!process.env.PHONE;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const hero of HEROES){
  const page = await browser.newPage(phone ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 2) } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(process.env.DSF || 2) });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shot', 'NotSupportedError')); };
  });
  page.on('pageerror', e => console.log('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('console error: ' + m.text()); });
  const until = (fn, arg, ms = 120000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
  await page.$eval('#hero-' + hero, el => el.click());
  await page.click('#mode-temple'); await page.click('#goText');
  await until(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused);
  await page.evaluate(() => GAME.zone.startZone('jedha'));
  await until(() => GAME.G.mode === 'play' && GAME.G.zone === 'jedha' && !GAME.G.paused);
  await page.waitForTimeout(2500);
  // walk to the square, touching its stone
  await page.evaluate(() => { GAME.player.group.position.set(12, 0.6, 22); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { GAME.player.group.position.set(6, 0.6, 30); GAME.G.yaw = GAME.player.faceYaw = Math.PI * 0.8; });
  await page.waitForTimeout(2500);
  await page.screenshot({ timeout: 120000, path: path.join(out, hero + (phone ? '-phone' : '') + '-hud.png') });
  const opened = await page.evaluate(() => GAME.zoneMap.open());
  if (opened){ await page.waitForTimeout(800); await page.screenshot({ timeout: 120000, path: path.join(out, hero + (phone ? '-phone' : '') + '-map.png') }); }
  await page.close();
}
await browser.close();
