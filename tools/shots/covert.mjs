// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HIDDEN COVERT CAPTURE — boots the BUILT game as the Mando, walks into the hub and saves shots of every wing of the
// covert (data/hub-covert.js) from a few spots.
//   npm run build && node tools/shots/covert.mjs <outDir> [wing]   (QUALITY=high|medium|low; PW_CHROMIUM a Chromium binary;
//   VIEWS='{"forge":[[x, z, yaw, pitch], ...]}' for your own spots)
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), out = path.resolve(process.argv[2] || 'shots'), only = process.argv[3];
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(process.env.DPR || 1) });
await page.addInitScript(q => { try { localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); }; }, process.env.QUALITY || 'high');
const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
await page.$eval('#mode-temple', el => el.click());
await page.$eval('#hero-mando', el => el.click());
await page.click('#goText');
await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, { timeout: 90000 });
await page.waitForTimeout(1500);
const VIEWS = JSON.parse(process.env.VIEWS || 'null') || {
  forge: [[0, 34, Math.PI, 0.05], [0, 24, Math.PI, -0.3], [28, 28, Math.PI * 0.75, 0.05], [-14, -30, 0.4, -0.25]],
  clan: [[0, 24, Math.PI, 0.05], [-12, 6, Math.PI * 0.7, -0.1]],
  pit: [[-30, 0, -Math.PI / 2, 0.05], [-10, 10, Math.PI, 0]],
  vault: [[28, 0, Math.PI / 2, 0.05], [-4, -4, Math.PI / 2 + 0.6, -0.1]],
  hangar: [[0, -28, 0, 0.05], [16, -24, -0.5, -0.15]],
};
for (const [wing, views] of Object.entries(VIEWS)){
  if (only && only !== wing) continue;
  await page.evaluate(w => GAME.hub.startHub(w), wing);
  await page.waitForTimeout(900);
  let i = 0;
  for (const [x, z, yaw, pitch] of views){
    await page.evaluate(([x, z, yaw, pitch]) => { const { G, player } = GAME, s = GAME.findClearSpawn(x, z, 1.2);
      player.group.position.set(s.x, 0, s.z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); G.yaw = player.faceYaw = yaw; G.pitch = pitch; }, [x, z, yaw, pitch]);
    for (let k = 0; k < 8; k++){ await page.evaluate(([yaw, pitch]) => { GAME.G.yaw = yaw; GAME.G.pitch = pitch; }, [yaw, pitch]); await page.waitForTimeout(200); }   // (held while the camera settles)
    await page.screenshot({ path: path.join(out, `covert-${wing}-${++i}.png`) });
  }
}
console.log(errors.length ? 'errors:\n' + [...new Set(errors)].join('\n') : 'no errors');
await browser.close();
