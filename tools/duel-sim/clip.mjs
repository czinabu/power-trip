// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL SIM CLIP — films one scripted duel (tools/duel-sim/bot.js) on the built game with the renderer on, as a GIF:
// the fight is stepped a few frames at a time on the game's own clock and a frame is shot between steps, so the clip
// plays back at real speed however slow the machine draws it. Needs ffmpeg.
//   npm run build && node tools/duel-sim/clip.mjs --foe vexis --form ataru --seed 5 --from 2 --secs 8 --out vexis.gif
//   --foe       a boss duel (tools/duel-sim/bosses.mjs) or any acolyte form (--rank knight)
//   --from/secs the part of the fight to film (s of fight time) · --fps (default 12) · --size 640x360
//   --caption   text along the bottom · --page another build's index.html · --skill good | average | a JSON object of bot keys
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import os from 'os';
import { FORM_FAMILY as FAMILY, FAMILIES } from '../../src/data/foe-forms.js';
import { bossFoes } from './bosses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pageArg = process.argv.indexOf('--page');   // --page another build's index.html (a before / after pair)
const page_file = pageArg > 0 ? path.resolve(process.argv[pageArg + 1]) : path.join(root, 'dist/index.html');
const page_url = pathToFileURL(page_file).href;
if (!existsSync(page_file)){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BEATS = Object.fromEntries(Object.entries(FAMILIES).map(([k, f]) => [k, f.beats]));
const BOT = readFileSync(path.join(root, 'tools/duel-sim/bot.js'), 'utf8')
  .replace('__FORM_FAMILY__', JSON.stringify(FAMILY)).replace('__BEATS__', JSON.stringify(BEATS));
const PRESETS = { good: null, average: { parry: 0.35, sigma: 0.1, read: 0.5, mash: 0.5, gap: 0.65, bite: 0.5, see: 0.3 } };
const SK = opt('skill', 'good'), SKILL = SK in PRESETS ? PRESETS[SK] : JSON.parse(SK);

const HPM = (d) => 1 + d * 0.05;
const foe = opt('foe', 'vexis'), form = opt('form', 'ataru');
const B = bossFoes(HPM)[foe] || { depth: 9, foes: [{ type: 'acolyte', form: foe, rank: opt('rank', 'knight'), hpMul: HPM(9) }] };
const from = +opt('from', 0), secs = +opt('secs', 8), fps = +opt('fps', 12), out = path.resolve(opt('out', `${foe}-${form}.gif`));
const [W, H] = opt('size', '640x360').split('x').map(Number);
const cfg = { form, loadout: [form], foes: B.foes, depth: B.depth, seed: +opt('seed', 1), tmax: from + secs + 1, skill: SKILL };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(() => {
  try {
    localStorage.setItem('jpt_quality', 'medium'); localStorage.setItem('sw_fullscreen', '0');
    localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_trained_jedi', '1'); localStorage.setItem('sw_sandbox_map', 'room');
  } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('clip', 'NotSupportedError')); };
});
await page.addInitScript(BOT);
page.on('pageerror', e => console.error('page error: ' + e.message));
await page.goto(page_url, { timeout: 120000 });
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
await page.evaluate(() => { const { G } = GAME; G.hero = 'jedi'; GAME.setHero('jedi'); GAME.setSandboxMap('room'); GAME.startSandbox(); G.mode = 'play'; G.paused = false; });
await page.waitForTimeout(2000);
await page.evaluate((caption) => {
  for (const id of ['overlay', 'sandbox', 'sbpanel', 'sb-panel']){ const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (caption){
    const d = document.createElement('div');
    d.textContent = caption;
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:10px;text-align:center;font:600 15px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 8px #000;z-index:99999;pointer-events:none';
    document.body.appendChild(d);
  }
}, opt('caption', ''));

const tmp = path.join(os.tmpdir(), 'duel-clip-' + process.pid);
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const per = Math.max(1, Math.round(60 / fps));
// run up to `from` with the renderer off (fast), then film
await page.evaluate(([cfg, from]) => {
  const r = GAME.gfx.composer.render, rr = GAME.gfx.renderer.render;
  GAME.gfx.composer.render = () => {}; GAME.gfx.renderer.render = () => {};
  __duelSim.begin(cfg);
  const res = __duelSim.step(Math.round(from * 60));
  GAME.gfx.composer.render = r; GAME.gfx.renderer.render = rr;
  __duelSim.stopPump();
  window.__clipDone = res;
}, [cfg, from]);
let n = 0, res = await page.evaluate(() => window.__clipDone);
while (!res && n < secs * fps){
  res = await page.evaluate((per) => { const r = __duelSim.step(per); __duelSim.stopPump(); return r; }, per);
  await page.screenshot({ path: path.join(tmp, String(n++).padStart(4, '0') + '.png') });
}
await browser.close();
const pal = path.join(tmp, 'pal.png');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, '%04d.png'), '-vf', 'palettegen=stats_mode=diff', pal]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, '%04d.png'), '-i', pal, '-lavfi', 'paletteuse=dither=bayer:bayer_scale=4', out]);
rmSync(tmp, { recursive: true, force: true });
console.log(`${out}: ${n} frames${res ? ' (fight over: ' + res.end + ' at ' + res.t + ' s)' : ''}`);
