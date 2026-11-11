// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HEADSHOT FRAMING — the gunners' camera with the crosshair held on a standing foe's head, at rest and braced, in the
// sandbox. Saves a screenshot of each and prints where the hero's own helmet sits against the crosshair (a helmet top
// above the centre line means your own head is in the way of a headshot). Testing only:
//   npm run build && node tools/shots/headshot.mjs <outdir>
//   PW_CHROMIUM=<a chromium> if playwright's own isn't installed · DIST=<an index.html> shoots another build (a before/after) · HEROES=mando,trooper · DIST_M=8,14 (the foe's ranges, m)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2] || path.join(root, 'shots-headshot');
mkdirSync(out, { recursive: true });
const HEROES = (process.env.HEROES || 'mando,trooper').split(',');
const RANGES = (process.env.DIST_M || '8,14').split(',').map(Number);
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
for (const hero of HEROES){
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.log(hero + ' error: ' + e.message));
  await page.addInitScript(() => {
    try { for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
          localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
    const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
    let frozen = null, queue = [];
    performance.now = () => frozen == null ? real() : frozen;
    window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
    window.__freeze = () => { if (frozen == null) frozen = real(); };
    window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shot', 'NotSupportedError')); };
  });
  await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href, { timeout: 180000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 180000 });
  await page.evaluate(h => document.getElementById('hero-' + h).click(), hero);
  await page.waitForTimeout(800);
  await page.evaluate(() => { GAME.setSandboxMap('room'); GAME.startSandbox(); });
  for (let i = 0; i < 12 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.paused && !GAME.G.cutscene)); i++){
    await page.evaluate(() => { if (GAME.G.cutscene) GAME.cutscene.skipScene(); if (GAME.G.paused){ const g = document.getElementById('goText'); if (g) g.click(); } });
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1500);
  for (const braced of [false, true]) for (const range of RANGES){
    const info = await page.evaluate(async ({ range, braced }) => {
      const { G, player: P, camera: cam, shared } = GAME;
      G.sandboxGod = true; P.hp = P.maxHp = 1e5;
      const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'none';
      for (const e of GAME.enemies) if (e.group) e.group.visible = false;
      GAME.sandboxClear && GAME.sandboxClear();
      const pp = P.group.position; pp.set(0, 0, 0); P.vel.set(0, 0, 0); P.moveVel && P.moveVel.set(0, 0, 0);
      G.yaw = P.faceYaw = P.group.rotation.y = 0; G.pitch = 0;
      GAME.sandboxSpawn('grunt');
      const e = GAME.enemies[GAME.enemies.length - 1];
      await new Promise(r => setTimeout(r, 400));
      e.group.position.set(0, 0, range); e.frozen = true; e.state = 'idle';
      P.blockHeld = braced; P.aiming = 0;
      const comp = GAME.gfx.composer; if (!comp.__draw){ comp.__draw = comp.render.bind(comp); comp.render = (...a) => { if (window.__draw) comp.__draw(...a); }; }
      window.__draw = false;
      window.__freeze(); await new Promise(r => setTimeout(r, 200));
      const step = n => { for (let i = 0; i < n; i++){ G.mode = 'play'; G.paused = false; e.group.position.set(0, 0, range); e.group.rotation.y = Math.PI; P.blockHeld = braced; pp.set(0, 0, 0); G.yaw = 0; window.__step(16.667); } };
      const V = cam.position.constructor, hv = new V(), fw = new V();
      const headOf = o => { const h = o.rig && o.rig.head; if (h){ h.getWorldPosition(hv); return hv.clone(); } return o.group.position.clone().setY(1.7); };
      // hold the crosshair on the foe's head: nudge the pitch until the view's centre line passes through it
      step(120);
      for (let k = 0; k < 60; k++){
        step(20);
        const hd = headOf(e), sp = hd.clone().project(cam);
        G.pitch -= sp.y * 0.3;   // + pitch looks down
      }
      step(60); window.__draw = true; step(1); window.__draw = false;
      const hd = headOf(e).project(cam);
      // the hero's helmet top on screen (y: + is up, -1..1)
      const heroHeadY = +headOf(P).y.toFixed(2), foeHeadY = +headOf(e).y.toFixed(2);
      const mh = headOf(P); mh.y += 0.18; const ms = mh.project(cam);
      return { heroHeadY, foeHeadY, pitch: +(G.pitch * 180 / Math.PI).toFixed(1), lensY: +(cam.position.y - pp.y).toFixed(2), back: +Math.hypot(cam.position.x, cam.position.z).toFixed(2),
               foeHead: [+hd.x.toFixed(3), +hd.y.toFixed(3)], helmetTop: [+ms.x.toFixed(3), +ms.y.toFixed(3)], fov: +cam.fov.toFixed(1) };
    }, { range, braced });
    const name = `${hero}-${range}m-${braced ? 'braced' : 'rest'}`;
    await page.screenshot({ path: path.join(out, name + '.png') });
    console.log(name, JSON.stringify(info));
    await page.evaluate(() => { GAME.player.blockHeld = false; });
  }
  await page.close();
}
await browser.close();
