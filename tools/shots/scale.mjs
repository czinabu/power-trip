// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MAP SCALE CAPTURE — boots a BUILT game headlessly as a hero, builds maps in turn (GAME.mapLevels) and saves two views of
// each on a held clock, for a maps pass that wants the hero to look small and the cover to read:
//   <map>-eye.png   from just behind the hero on the south side, facing north, tipped up, so what towers over the floor shows
//   <map>-over.png  a high three-quarter view of the whole floor, so the lanes and the cover read
//   <map>-up.png    from the floor looking up at the map's first landmark (world/landmarks.js; LM=<kind> picks one), the hero before it
//   npm run build && node tools/shots/scale.mjs <out-dir> [map,map,...]   (HERO=trooper|mando|jedi, default trooper;
//   DIST=<an index.html> shoots another build; PW_CHROMIUM a Chromium binary when Playwright's own isn't installed)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || 'shots/scale');
const only = process.argv[3] ? process.argv[3].split(',') : null;
const hero = process.env.HERO || 'trooper';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.addInitScript(h => {
  const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
  let frozen = null, queue = [];
  performance.now = () => frozen == null ? real() : frozen;
  window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
  window.__freeze = () => { frozen = real(); };
  window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
  try { for (const k of ['sw_camp_mando', 'sw_camp_jedi', 'sw_camp_trooper', 'sw_trained_' + h]) localStorage.setItem(k, '1');
        localStorage.setItem('jpt_quality', 'medium'); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
}, hero);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href, { timeout: 120000 });
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 120000 });
await page.evaluate(h => { document.getElementById('hero-' + h).click(); document.getElementById('mode-sandbox').click(); }, hero);
for (let i = 0; i < 30 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  await page.evaluate(() => { for (const s of ['#goText', '#trainNo', '#forms [data-go]']){ const b = document.querySelector(s); if (b && b.offsetParent) b.click(); } });
  await page.waitForTimeout(500);
}
await page.waitForTimeout(5000);
await page.addStyleTag({ content: 'body > *:not(canvas){ visibility: hidden !important } canvas{ visibility: visible !important }' });
await page.evaluate(() => window.__freeze());
const step = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.__step(33); }, n);

const maps = await page.evaluate(() => Object.keys(GAME.mapLevels()));
for (const id of maps){
  if (only && !only.includes(id)) continue;
  const info = await page.evaluate(([id, LM]) => {
    const { G, player } = GAME, L = GAME.mapLevels()[id];
    GAME.sandboxClear();
    GAME.buildArena(L);
    G.sandboxGod = true; player.hp = 1e4;
    // the hero on the south side with a clear view north: neither the hero's spot nor the camera's (4 m behind) inside or
    // under anything
    const half = GAME.arena().half;
    const blocked = (x, z, r) => GAME.solids.some(c => c.box ? Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r : Math.hypot(x - c.x, z - c.z) < c.r + r);
    let s = null;
    for (let f = 0.62; f > 0.1 && !s; f -= 0.04) for (const dx of [0, 4, -4, 8, -8, 12, -12]){
      const x = dx, z = -half * f;
      if (!blocked(x, z, 1.2) && !blocked(x + 1.2, z - 3.6, 1.0) && !blocked(x, z + 4, 1.0)){ s = { x, z }; break; }
    }
    s = s || GAME.findClearSpawn(0, -half * 0.62, 1.6);
    player.group.position.set(s.x, 0, s.z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0);
    G.yaw = player.faceYaw = 0;
    // a few troopers across the floor for scale
    for (const [dx, dz] of [[-3, 8], [2.5, 11], [-6, 20], [7, 26]]){
      const q = GAME.findClearSpawn(s.x + dx, s.z + dz, 0.9);
      GAME.spawnEnemy('grunt', player.group.position.clone().set(q.x, 0, q.z));
      const e = GAME.enemies[GAME.enemies.length - 1]; e.dummy = true; e.home = { x: q.x, z: q.z };
    }
    // the first landmark (world/landmarks.js), for a third view looking up at it from the floor
    const placed = (GAME.shared.landmarks || {}).placed || [], lm = placed.find(p => p.startsWith(LM + '@')) || placed[0];
    let look = null;
    if (lm){
      const [lx, lz] = lm.split('@')[1].split(',').map(Number), d = Math.hypot(lx, lz) || 1;
      for (let f = 16; f < 34 && !look; f += 2){
        const hx = lx - lx / d * f, hz = lz - lz / d * f;
        if (!blocked(hx, hz, 1.0) && !blocked(hx - lx / d * 4, hz - lz / d * 4, 0.8)) look = { lx, lz, hx, hz, dx: lx / d, dz: lz / d };
      }
    }
    return { half, x: s.x, z: s.z, look };
  }, [id, process.env.LM || '']);
  await step(20);
  for (const [view, cam] of [['eye', 'eye'], ['over', 'over'], ...(info.look ? [['up', 'up']] : [])]){
    const img = await page.evaluate(([cam, I]) => {
      const c = GAME.camera, h = I.half;
      if (cam === 'eye'){ c.position.set(I.x + 1.2, 2.1, I.z - 3.6); c.lookAt(I.x, 9, I.z + 30); c.fov = 62; }
      else if (cam === 'up'){ const L = I.look, p = GAME.player;
        p.group.position.set(L.hx, 0, L.hz); p.group.rotation.y = Math.atan2(L.dx, L.dz); GAME.G.yaw = p.faceYaw = p.group.rotation.y; p.group.updateMatrixWorld(true);
        c.position.set(L.hx - L.dx * 5 + L.dz * 1.4, 1.7, L.hz - L.dz * 5 - L.dx * 1.4); c.lookAt(L.lx, 11, L.lz); c.fov = 66; }
      else { c.position.set(h * 0.95, h * 1.05, -h * 1.25); c.lookAt(0, 0, h * 0.05); c.fov = 55; }
      c.aspect = innerWidth / innerHeight; c.far = Math.max(c.far, 4000); c.updateProjectionMatrix(); c.updateMatrixWorld();
      GAME.gfx.composer.render();
      return GAME.gfx.renderer.domElement.toDataURL('image/jpeg', 0.88);
    }, [cam, info]);
    writeFileSync(path.join(out, `${id}-${view}.jpg`), Buffer.from(img.split(',')[1], 'base64'));
  }
  console.log(id, JSON.stringify(info));
}
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));
await browser.close();
