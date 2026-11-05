// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HIDDEN TEMPLE CAPTURE — boots the BUILT game (dist/index.html) headlessly, walks into the temple from the title
// screen's tile, and saves gameplay-camera shots of every wing (data/hub.js) from a few spots, plus a station panel.
//   npm run build && node tools/shots/temple.mjs [outDir] [hero]   (QUALITY=high|medium|low; PW_CHROMIUM a Chromium binary)

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || 'shots');
const hero = process.argv[3] || 'jedi';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(q => {
  try { localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
}, process.env.QUALITY || 'high');
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
await page.click('#mode-temple');
await page.$eval('#hero-' + hero, el => el.click());
await page.click('#goText');
await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, { timeout: 90000 });
await page.waitForTimeout(1500);
const VIEWS = {
  hall: [[0, 34, Math.PI, 0.05], [0, 12, Math.PI, -0.35], [30, -30, Math.PI * 0.75, 0], [-12, -38, 0.25, -0.2]],
  council: [[0, 22, Math.PI, 0.05], [-10, 4, Math.PI * 0.7, -0.1]],
  training: [[-30, 0, Math.PI / 2, 0.05], [10, 22, Math.PI, 0]],
  archives: [[30, 0, -Math.PI / 2, 0.05], [-6, -4, -Math.PI * 0.6, -0.1]],
  forge: [[0, -22, 0, 0.05], [10, 18, Math.PI * 0.9, -0.1]],
};
for (const [wing, views] of Object.entries(VIEWS)){
  await page.evaluate(w => GAME.hub.startHub(w), wing);
  await page.waitForTimeout(900);
  let i = 0;
  for (const [x, z, yaw, pitch] of views){
    await page.evaluate(([x, z, yaw, pitch]) => {
      const { G, player } = GAME, s = GAME.findClearSpawn(x, z, 1.2);
      player.group.position.set(s.x, 0, s.z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0);
      G.yaw = player.faceYaw = yaw; G.pitch = pitch;
    }, [x, z, yaw, pitch]);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(out, `temple-${wing}-${++i}.png`) });
    console.log(wing, i, JSON.stringify(await page.evaluate(() => GAME.arena())));
  }
}
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));
await browser.close();
