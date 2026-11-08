// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CAMERA SMOOTHNESS PROBE — boots a BUILT game on a held clock, plays a fixed script of moves for each hero in the
// sandbox (run and stop, strafe, a dash, a jump, a steady turn, circling a pillar, aiming and shoulder swaps, a lock-on)
// and records the play camera every frame. Reports, per move, how hard the lens and the view were jerked from one frame
// to the next (the second difference of the lens position, the view's heading, its roll and its FOV): a smooth camera
// keeps these small and even, a snap or a stutter shows as a spike. Testing only:
//   npm run build && node tools/shots/camprobe.mjs
//   DIST=<an index.html> probes another build (a before/after) · HEROES=jedi,mando,trooper · STEP=ms per frame (16.7)
//   JITTER=1 alternates long and short frames (a real browser's uneven frame times) · CSV=<dir> writes each run's frames
//   SHOOT=<dir> FRAMES_OF=jedi:pillar,mando:turn-run saves those runs' frames as JPEGs (every second frame) for a GIF
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HEROES = (process.env.HEROES || 'jedi,mando,trooper').split(',');
const STEP = +(process.env.STEP || 16.667), JITTER = process.env.JITTER === '1';
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const all = {};
for (const hero of HEROES){
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', e => errors.push(hero + ': ' + e.message));
  await page.addInitScript(() => {
    let seed = 1234567; Math.random = () => ((seed = Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6D2B79F5 >>> 0) % 1000000) / 1000000;
    const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
    let frozen = null, queue = [];
    performance.now = () => frozen == null ? real() : frozen;
    window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
    window.__freeze = () => { frozen = real(); };
    window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
    try { for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
          localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('probe', 'NotSupportedError')); };
  });
  await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href, { timeout: 180000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 180000 });
  await page.evaluate(h => document.getElementById('hero-' + h).click(), hero);
  await page.waitForTimeout(800);
  await page.evaluate(() => { GAME.setSandboxMap('grassland'); GAME.startSandbox(); });
  for (let i = 0; i < 12 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.paused && !GAME.G.cutscene)); i++){
    await page.evaluate(() => { if (GAME.G.cutscene) GAME.cutscene.skipScene(); if (GAME.G.paused){ const g = document.getElementById('goText'); if (g) g.click(); } });
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1500);
  const res = await page.evaluate(async ({ hero, STEP, JITTER, shoot }) => {
    const { G, player: P, keys: K, camera: cam, shared } = GAME;
    const pp = P.group.position;
    G.sandboxGod = true; P.hp = P.maxHp = 1e5; shared.lockFallback = true;
    const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'none';
    // no drawing: only the camera's numbers are wanted, and software rendering makes each frame slow
    const comp = GAME.gfx.composer, draw = comp.render.bind(comp);
    comp.render = (...a) => { if (window.__draw) draw(...a); };
    window.__freeze();
    await new Promise(r => setTimeout(r, 300));   // the frames already asked for land in the held queue
    const key = (k, down) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true }));
    const mouse = (b, down) => document.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button: b, bubbles: true }));
    let fi = 0;
    const nextMs = () => JITTER ? (fi++ % 2 ? STEP * 0.7 : STEP * 1.3) : STEP;
    const step = (ms = nextMs()) => { G.mode = 'play'; G.paused = false; window.__step(ms); return ms / 1000; };
    const releaseAll = () => { for (const k in K) K[k] = false; };
    // a clear spot: the hero at (x, z) facing yaw, settled
    const place = (x, z, yaw, pitch = 0.08) => {
      releaseAll(); pp.set(x, 0, z); P.vel.set(0, 0, 0); P.moveVel && P.moveVel.set(0, 0, 0); P.vy = 0;
      G.yaw = P.faceYaw = P.group.rotation.y = yaw; G.pitch = pitch; P.lockTarget = null;
      for (let i = 0; i < 90; i++) step();
    };
    // the play camera this frame: lens, heading (yaw, pitch of the view), roll, fov
    const fw = new cam.position.constructor(), up = new cam.position.constructor();
    const snap = () => {
      cam.getWorldDirection(fw); up.set(0, 1, 0).applyQuaternion(cam.quaternion);
      const yaw = Math.atan2(fw.x, fw.z), pitch = Math.asin(Math.max(-1, Math.min(1, fw.y)));
      // roll: the lens's up against the level up for this heading
      const rx = fw.z, rz = -fw.x, rl = Math.hypot(rx, rz) || 1;   // the level right vector
      const roll = Math.asin(Math.max(-1, Math.min(1, (up.x * rx + up.z * rz) / rl)));
      return { x: cam.position.x, y: cam.position.y, z: cam.position.z, yaw, pitch, roll, fov: cam.fov, hx: pp.x, hy: pp.y, hz: pp.z, dbg: window.__cd && JSON.stringify(window.__cd, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v) };
    };
    const runs = {}, shots = {};
    // run a move for n frames; each(i, dt) sets the input for frame i
    const run = (name, n, each) => {
      const fr = [], pics = [];
      window.__draw = shoot.includes(name);
      // (the input for frame i is set before the frame is stepped)
      for (let i = 0; i < n; i++){ const ms = nextMs(); each(i, ms / 1000); step(ms); fr.push(snap()); if (window.__draw && i % 2 === 0) pics.push(GAME.gfx.renderer.domElement.toDataURL('image/jpeg', 0.85)); }
      window.__draw = false;
      releaseAll();
      runs[name] = fr;
      if (pics.length) shots[name] = pics;
    };
    const turn = (rate) => (i, dt) => { G.yaw -= rate * dt; };
    const X = 0, Z = 0;
    // 1 run forward and stop
    place(X, Z, 0); run('run-stop', 120, (i) => { K['w'] = i < 60; });
    // 2 strafe right, then left
    place(X, Z, 0); run('strafe', 120, (i) => { K['d'] = i < 55; K['a'] = i >= 60 && i < 110; });
    // 3 a dash (the Jedi's Force dash, the gunners' roll / boost) to the side, and a jump forward
    place(X, Z, 0); run('dash', 90, (i) => { K['d'] = i < 30; if (i === 5){ key('Shift', true); } if (i === 8) key('Shift', false); });
    place(X, Z, 0); run('jump', 110, (i) => { K['w'] = i < 80; if (i === 10) key(' ', true); if (i === 12) key(' ', false); });
    // 4 a steady turn with the mouse while running (the orbit), and a turn that starts and stops
    place(X, Z, 0); run('turn-run', 150, (i, dt) => { K['w'] = true; G.yaw -= 2.2 * dt; });
    place(X, Z, 0); run('flick', 90, (i, dt) => { if (i >= 10 && i < 22) G.yaw -= 7 * dt; if (i >= 50 && i < 56) G.yaw += 9 * dt; });
    // 5 walk round a pillar with it at your back: the lens's room behind the hero opens and closes
    const pil = (GAME.pillars || []).map(p => p.position || p.mesh && p.mesh.position || p).find(p => p && isFinite(p.x) && Math.hypot(p.x, p.z) < 40);
    if (pil){
      const yaw = Math.atan2(pp.x - pil.x, pp.z - pil.z);
      place(pil.x + 2.2, pil.z, Math.PI / 2);   // facing away from it (+x), the pillar behind
      run('pillar', 240, (i, dt) => { K['a'] = i < 200; G.yaw -= 0.9 * dt; });
    }
    // 6 the gunners: aim down the sights and back, and a shoulder swap each way while walking
    if (hero !== 'jedi'){
      place(X, Z, 0); run('ads', 120, (i) => { if (i === 10) mouse(2, true); if (i === 60) mouse(2, false); });
      place(X, Z, 0); run('swap', 120, (i) => { K['w'] = true; if (i === 10 || i === 60){ key('k', true); key('k', false); } });
    }
    // 7 the Jedi: lock onto a foe and circle him
    if (hero === 'jedi'){
      place(X, Z, 0);
      GAME.sandboxSpawn('grunt');
      const e = GAME.enemies[GAME.enemies.length - 1];
      if (e && e.group){ e.group.position.set(X, 0, Z + 6); e.frozen = true; }
      for (let i = 0; i < 10; i++) step();
      key('t', true); key('t', false);
      run('lock-circle', 180, (i) => { K['d'] = i < 150; if (e && e.group) e.group.position.set(X, 0, Z + 6); });
      key('t', true); key('t', false);
    }
    return { runs, shots, pillar: !!pil };
  }, { hero, STEP, JITTER, shoot: (process.env.FRAMES_OF || '').split(',').filter(x => x.startsWith(hero + ':')).map(x => x.split(':')[1]) });
  all[hero] = res;
  if (process.env.SHOOT) for (const name in res.shots){
    const d = path.join(process.env.SHOOT, `${hero}-${name}`); mkdirSync(d, { recursive: true });
    res.shots[name].forEach((u, i) => writeFileSync(path.join(d, String(i).padStart(4, '0') + '.jpg'), Buffer.from(u.split(',')[1], 'base64')));
  }
  await page.close();
}
await browser.close();

// how jerky a run is: per frame, the second difference of each channel (scaled to a 60 fps frame), its max and RMS
const ang = a => Math.atan2(Math.sin(a), Math.cos(a));
function score(fr){
  const ch = { pos: [], yaw: [], pitch: [], roll: [], fov: [] };
  for (let i = 1; i < fr.length - 1; i++){
    const a = fr[i - 1], b = fr[i], c = fr[i + 1];
    ch.pos.push(Math.hypot(c.x - 2*b.x + a.x, c.y - 2*b.y + a.y, c.z - 2*b.z + a.z) * 1000);   // mm per frame²
    ch.yaw.push(Math.abs(ang(c.yaw - b.yaw) - ang(b.yaw - a.yaw)) * 180 / Math.PI * 100);         // 1/100° per frame²
    ch.pitch.push(Math.abs((c.pitch - b.pitch) - (b.pitch - a.pitch)) * 180 / Math.PI * 100);
    ch.roll.push(Math.abs((c.roll - b.roll) - (b.roll - a.roll)) * 180 / Math.PI * 100);
    ch.fov.push(Math.abs((c.fov - b.fov) - (b.fov - a.fov)) * 100);
  }
  const o = {};
  for (const k in ch){ const v = ch[k]; o[k] = { max: +Math.max(...v).toFixed(1), rms: +Math.sqrt(v.reduce((s, x) => s + x*x, 0) / v.length).toFixed(1) }; }
  return o;
}
const out = {};
for (const hero in all){
  out[hero] = {};
  if (process.env.CSV){ mkdirSync(process.env.CSV, { recursive: true }); }
  for (const name in all[hero].runs){
    const fr = all[hero].runs[name];
    out[hero][name] = score(fr);
    if (process.env.CSV) writeFileSync(path.join(process.env.CSV, `${hero}-${name}.csv`), 'x,y,z,yaw,pitch,roll,fov,hx,hy,hz\n' + fr.map(f => [f.x, f.y, f.z, f.yaw, f.pitch, f.roll, f.fov, f.hx, f.hy, f.hz].map(v => +v.toFixed(5)).join(',') + (process.env.DBG ? ' ' + f.dbg : '')).join('\n'));
  }
  if (!all[hero].pillar) console.log(hero, '(no pillar near the start to circle)');
}
console.log('jerk per move (max / rms): pos mm, yaw/pitch/roll 1/100 deg, fov 1/100 deg — per 60 fps frame²');
for (const hero in out) for (const name in out[hero]){
  const s = out[hero][name];
  console.log(`${hero.padEnd(8)} ${name.padEnd(12)} ` + Object.entries(s).map(([k, v]) => `${k} ${String(v.max).padStart(7)}/${String(v.rms).padStart(6)}`).join('  '));
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(out));
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));
