// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// COVER AUDIT — boots the BUILT game (dist/index.html) headlessly, builds every map in turn (GAME.mapLevels) and measures
// how much of it the ARC trooper can actually take cover behind, by the rules player/trooper/cover.js uses: a solid on
// the floor at least TROOPER.cover.minH tall, not climbable, not a mound or an overhead slab, with a face at least
// 0.7 m long (LOW below tallH). Per map it prints:
//   size   the arena across (m) · cover  usable cover pieces in the play space (low / tall)
//   face   metres of cover face per 100 m² of open floor
//   near   % of open floor within 2.5 m of a cover face (a roll or a slide away) · far % more than 6 m from any
//   mean   mean distance from open floor to the nearest cover face (m)
//   real   cover pieces with a face at least 2 m long (room to put a back to) · near-real  % of open floor within 2.5 m of one
// The numbers go to <outDir>/cover.json so a layout pass can be compared before and after.
//   npm run build && node tools/shots/cover-audit.mjs [outDir] [map,map,...]

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || 'shots/cover');
const only = process.argv[3] ? process.argv[3].split(',') : null;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.addInitScript(() => {
  try { for (const k of ['sw_camp_mando', 'sw_camp_jedi']) localStorage.setItem(k, '1');
        localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('audit', 'NotSupportedError')); };
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
await page.$eval('#hero-jedi', el => el.click()); await page.$eval('#mode-sandbox', el => el.click());
const tap = async sel => { if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {}); };
for (let i = 0; i < 6; i++){
  await tap('#goText'); await tap('#trainNo'); await tap('#forms [data-go]');
  if (await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 4000 }).then(() => true, () => false)) break;
}

const maps = await page.evaluate(() => Object.keys(GAME.mapLevels()));
const report = {};
console.log('map            size  cover (low/tall)  face/100m²  near%  far%  mean   real  near-real%');
for (const id of maps){
  if (only && !only.includes(id)) continue;
  const res = await page.evaluate(id => {
    const { solids, shared } = GAME, L = GAME.mapLevels()[id];
    GAME.sandboxClear();
    GAME.buildArena(L);
    const hx = shared.arenaHalf, hz = shared.arenaHalfZ, big = shared.arenaBig;
    const MIN = 0.95, TALL = 1.85, STEP = 0.5;
    const onFloor = c => !c.mound && !((c.y0 || 0) > 0.3);
    const inPlay = c => Math.abs(c.x) < hx + 1 && Math.abs(c.z) < hz + 1;
    const cover = solids.filter(c => onFloor(c) && !c.climbable && c.h >= MIN && inPlay(c) && (c.box ? Math.max(c.hx, c.hz) >= 0.35 : c.r >= 0.25));
    const distTo = (c, x, z) => c.box ? Math.hypot(Math.max(0, Math.abs(x - c.x) - c.hx), Math.max(0, Math.abs(z - c.z) - c.hz))
      : Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r);
    const blocks = solids.filter(c => onFloor(c) && c.h > STEP + 0.05 && !(c.climbable && c.h <= STEP + 0.05));
    const CS = big ? 2 : 1;
    const real = cover.filter(c => c.box ? Math.max(c.hx, c.hz) >= 1 : c.r >= 0.7);   // a face 2 m long or more: room for a body
    let open = 0, near = 0, far = 0, sum = 0, nearR = 0;
    for (let x = -hx + CS/2; x < hx; x += CS) for (let z = -hz + CS/2; z < hz; z += CS){
      if (blocks.some(c => distTo(c, x, z) <= 0)) continue;
      let d = 99; for (const c of cover){ const e = distTo(c, x, z); if (e < d) d = e; }
      open++; sum += Math.min(d, 30); if (d <= 2.5) near++; if (d > 6) far++;
      let dr = 99; for (const c of real){ const e = distTo(c, x, z); if (e < dr) dr = e; }
      if (dr <= 2.5) nearR++;
    }
    let face = 0;
    for (const c of cover) face += c.box ? 4 * (c.hx + c.hz) : 2 * Math.PI * c.r;
    const low = cover.filter(c => c.h < TALL).length;
    return { size: Math.round(hx * 2), sizeZ: Math.round(hz * 2), cover: cover.length, real: real.length, nearReal: Math.round(nearR / open * 100), low, tall: cover.length - low,
             face: +(face / Math.max(1, open * CS * CS) * 100).toFixed(1), near: Math.round(near / open * 100), far: Math.round(far / open * 100), mean: +(sum / open).toFixed(1) };
  }, id);
  report[id] = res;
  console.log(`${id.padEnd(14)} ${String(res.size + (res.sizeZ !== res.size ? 'x' + res.sizeZ : '')).padStart(6)}  ${String(res.cover).padStart(4)} (${res.low}/${res.tall})${' '.repeat(Math.max(1, 10 - String(res.low + '/' + res.tall).length))}${String(res.face).padStart(6)}  ${String(res.near).padStart(5)} ${String(res.far).padStart(5)}  ${String(res.mean).padEnd(5)}  ${String(res.real).padStart(4)}  ${res.nearReal}`);
}
writeFileSync(path.join(out, 'cover.json'), JSON.stringify(report, null, 1));
if (errors.length) console.log('page errors:', errors.slice(0, 5));
await browser.close();
