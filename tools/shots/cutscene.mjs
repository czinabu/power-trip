// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A CHAPTER'S OPENING CUTSCENE, frame by frame, on the BUILT game (game/cutscene.js):
// node tools/shots/cutscene.mjs <out dir> <hero: jedi|mando|trooper> <chapter id> [every ms: 250] [width: 960]
// Writes <out>/<hero>-<chapter>-NNN.png while the scene plays, and logs each shot as it changes. Turn the frames into a GIF
// with ffmpeg (see the command it prints). STORY='{"ilsa":"struck"}' sets the run's choices. (CHROME=<path>: another Chromium)
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [out, hero = 'jedi', ch = 'siege', every = '250', width = '960'] = process.argv.slice(2);
const W = +width, H = Math.round(W * 9 / 16);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
// VIDEO=1 records the whole run as a .webm in <out> instead (smoother than the frames: ffmpeg it into a GIF)
const ctx = await browser.newContext({ viewport: { width: W, height: H }, ...(process.env.VIDEO ? { recordVideo: { dir: out, size: { width: W, height: H } } } : {}) });
const page = await ctx.newPage();
const t0 = Date.now();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => { try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('x', 'NotSupportedError')); }; });
await page.goto(pathToFileURL(root + '/dist/index.html').href + (hero === 'trooper' ? '?trooper' : ''));
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
await page.click('#hero-' + hero); await page.click('#mode-campaign');
for (let i = 0; i < 8 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
  if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(800);
}
await page.waitForSelector('#chapcard.open', { timeout: 30000 });
await page.evaluate((st) => { if (st) GAME.G.story = JSON.parse(st); }, process.env.STORY || '');
await page.evaluate((ch) => { document.getElementById('chapcard').classList.remove('open'); GAME.G.cardUp = false; const i = GAME.chapters().findIndex(c => c.id === ch); GAME.startChapter(i < 0 ? 0 : i); }, ch);
await page.waitForTimeout(2500);
await page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); });
let n = 0, last = '';
// STEP=<ms>: frame-step the page's clock instead of letting it run (smooth frames however slow the renderer: one frame
// every STEP ms of game time)
if (process.env.STEP){
  await page.waitForFunction(() => GAME.G.cutscene, null, { timeout: 30000 });
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
}
for (let i = 0; i < (process.env.STEP ? 3000 : 400); i++){
  if (process.env.STEP) await page.clock.runFor(+process.env.STEP);
  const st = await page.evaluate(() => ({ on: !!GAME.G.cutscene, shot: GAME.cutscene.shotInfo ? GAME.cutscene.shotInfo() : '' }));
  if (!st.on){ if (n) break; await page.waitForTimeout(100); continue; }
  if (st.shot !== last){ console.log('shot', ((Date.now() - t0) / 1000).toFixed(1) + 's', st.shot); last = st.shot; }
  if (!process.env.VIDEO) await page.screenshot({ path: out + '/' + hero + '-' + ch + '-' + String(n++).padStart(3, '0') + '.png' }); else n++;
  await page.waitForTimeout(+every);
}
console.log(n + ' frames');
console.log('gif: ffmpeg -y -framerate ' + Math.round(1000 / +every) + ' -i ' + out + '/' + hero + '-' + ch + '-%03d.png -vf "fps=' + Math.round(1000 / +every) + ',scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" ' + out + '/' + hero + '-' + ch + '.gif');
console.log('errors', errors.slice(0, 10));
await ctx.close();
await browser.close();
