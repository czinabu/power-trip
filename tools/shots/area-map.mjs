// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AREA MAP SHOTS — boots the BUILT game into a hub and a few story maps as each hero and screenshots the HUD's minimap
// and the full map (ui/area-map.js, ui/zone-map.js).   npm run build && node tools/shots/area-map.mjs [out-dir]
//   HEROES=jedi,mando,trooper  PHONE=1 (a phone held sideways)  CHROMIUM (a Chromium binary)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { mkdirSync } from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const out = process.argv[2] || path.join(root, 'shots-out'); mkdirSync(out, { recursive: true });
const HEROES = (process.env.HEROES || 'jedi,mando,trooper').split(',');
const phone = !!process.env.PHONE;
// each hero's story map: one with objectives that have parts, a squad, a battle map
const MISSION = { jedi: 'refuge', trooper: 'killhouse', mando: 'strike-exegol' };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const hero of HEROES){
  const page = await browser.newPage(phone ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 2) } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(process.env.DSF || 2) });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); localStorage.setItem('jpt_quality', 'low');
      for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shot', 'NotSupportedError')); };
  });
  page.on('pageerror', e => console.log('page error: ' + e.message));
  const until = (fn, arg, ms = 120000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const shot = (name) => page.screenshot({ timeout: 120000, path: path.join(out, hero + (phone ? '-phone' : '') + '-' + name + '.png') });
  const fullMap = async (name) => {
    if (!(await page.evaluate(() => GAME.zoneMap.open()))) return console.log(hero + ' ' + name + ': no map here');
    await page.waitForTimeout(800); await shot(name + '-map');
    await page.evaluate(() => GAME.zoneMap.close(false)); await page.waitForTimeout(400);
  };
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
  await page.$eval('#hero-' + hero, el => el.click());
  // THE HUB
  await page.click('#mode-temple'); await page.click('#goText');
  await until(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused);
  await page.waitForTimeout(4000);
  await shot('hub'); await fullMap('hub');
  // A STORY MAP, one objective in (its parts are on the map), a waypoint set
  await page.evaluate((id) => GAME.startMission(id), MISSION[hero]);
  for (let i = 0; i < 12; i++){
    await page.evaluate(() => { const f = document.querySelector('#forms [data-go]'); if (f && f.offsetParent) f.click(); if (GAME.cutscene.sceneOn()) GAME.cutscene.skipScene();
      const G = GAME.G; G.mode = 'play'; G.paused = false; G.skillSelect = false; document.body.classList.remove('in-menu'); document.getElementById('overlay').style.display = 'none'; });
    if (await page.evaluate(() => GAME.G.mode === 'play' && !GAME.cutscene.sceneOn())) break;
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => { GAME.missionState().waitT = 0.01; }); await page.waitForTimeout(3000);
  await page.evaluate(() => GAME.skipObjective()); await page.waitForTimeout(2000);
  await page.evaluate(() => { GAME.missionState().waitT = 0.01; }); await page.waitForTimeout(4000);
  await shot('mission');
  if (await page.evaluate(() => GAME.zoneMap.open())){
    await page.waitForTimeout(600);
    const mb = await page.locator('#zonemap .zm-map').boundingBox();
    await page.mouse.click(mb.x + mb.width * 0.3, mb.y + mb.height * 0.3);   // a waypoint
    await page.waitForTimeout(400); await shot('mission-map');
    await page.evaluate(() => GAME.zoneMap.close(false)); await page.waitForTimeout(1500);
    await shot('mission-pin');
  }
  await page.close();
}
await browser.close();
