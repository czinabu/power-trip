// TROOPER SPRINT CAPTURE — films the ARC trooper's run into a sprint and back, gun by gun, from the side and from the
// game's own camera, frame by frame on a held clock (a fixed 1/30 s a frame whatever the machine), and prints his top
// speed at a run and at a sprint (testing only):
//   npm run build && node tools/shots/trooper-sprint.mjs <out-dir> [guns]   (DIST=<an index.html> films another build)
//   guns: comma list of rifle,pistols,launcher (default rifle,pistols) · VIEWS=side or cam films one view · MAP=room the
//   sandbox floor (default the Grass Sea) · TRACE=1 prints each frame: S sprinting / r not, the speed, and what stopped it
// Writes <out-dir>/<gun>-side/NNN.jpg and <out-dir>/<gun>-cam/NNN.jpg.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2] || path.join(root, 'shots-sprint');
const GUNS = (process.argv[3] || 'rifle,pistols').split(',');
const FPS = 30, STEP = 1000 / FPS;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
await page.addInitScript(() => {
  const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
  let frozen = null, queue = [];
  performance.now = () => frozen == null ? real() : frozen;
  window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
  window.__freeze = () => { frozen = real(); };
  window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
  try {
    localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_asktrain', '1');
    for (const h of ['jedi', 'mando', 'trooper']) localStorage.setItem('sw_camp_' + h, '1');
  } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
});
page.on('pageerror', e => console.log('page error', e.message));
await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href + '?trooper');
const run = ms => page.waitForTimeout(ms);
await page.waitForFunction(() => window.GAME && window.GAME.G && document.getElementById('hero-trooper'), null, { timeout: 60000 });
await page.evaluate(() => { document.getElementById('hero-trooper').click(); document.getElementById('mode-sandbox').click(); });
for (let i = 0; i < 20 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.sbMenu)); i++){
  await page.evaluate(() => { for (const s of ['#goText', '#trainNo', '#sbclose']){ const b = document.querySelector(s); if (b && b.offsetParent) b.click(); } });
  await run(500);
}
await run(5000);
await page.evaluate(() => { if (GAME.G.sbMenu) document.getElementById('sbclose')?.click(); for (const e of GAME.enemies) e.hp = 0; window.__freeze(); });
// the open Grass Sea (MAP=room keeps the sandbox's own floor)
const MAP = process.env.MAP || 'grassland';
if (MAP !== 'room'){ await page.evaluate(m => { window.__step(16); GAME.setSandboxMap(m); }, MAP); for (let i = 0; i < 30; i++) await page.evaluate(() => window.__step(33)); }
// a clear lane to run down: the start and heading whose 40 m line passes nothing solid
const lane = await page.evaluate(() => {
  const obs = [...GAME.solids, ...(GAME.pillars || [])], A = GAME.arena(), hx = (A.half || 30) - 3, hz = (A.halfZ || A.half || 30) - 3, inside = (x, z) => Math.abs(x) < hx && Math.abs(z) < hz;
  let best = null;
  for (let x = -60; x <= 60; x += 4) for (let z = -60; z <= 60; z += 4) for (let a = 0; a < 8; a++){
    const yaw = a * Math.PI / 4, dx = Math.sin(yaw), dz = Math.cos(yaw);
    if (!inside(x, z) || !inside(x + dx * 40, z + dz * 40)) continue;   // (on the floor, end to end)
    let clear = 99;
    for (const o of obs){
      const t = Math.max(-4, Math.min(44, (o.x - x) * dx + (o.z - z) * dz));
      const px = x + dx * t - o.x, pz = z + dz * t - o.z;
      const r = o.box ? Math.hypot(o.hx || 0, o.hz || 0) : (o.r || 1);
      clear = Math.min(clear, Math.hypot(px, pz) - r);
    }
    if (!best || clear > best.clear) best = { x, z, yaw, clear };
  }
  return best;
});
console.log('lane', JSON.stringify(lane));

let side = true;
async function frame(file){
  await page.evaluate(ms => window.__step(ms), STEP);
  const r = await page.evaluate(([shoot, side]) => {
    const p = GAME.player, g = p.group, c = GAME.camera, s = Math.sin(GAME.G.yaw), co = Math.cos(GAME.G.yaw);
    const x = g.position.x, y = g.position.y, z = g.position.z;
    if (side){
      c.position.set(x - co * 5.5 + s * 2.2, y + 1.5, z + s * 5.5 + co * 2.2);   // (side-on, a little ahead of him)
      c.lookAt(x, y + 1.1, z);
      c.fov = 36; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); c.updateMatrixWorld();
    }
    if (shoot) GAME.gfx.composer.render();   // (read straight back after a render of our own: the game's frame is cleared by now)
    const why = ['cover','blockHeld','zoom','trigHeld','firing','mantle','hang','flip','downed','wallRun'].filter(k => p[k]).concat(p.slideT > 0 ? ['slide'] : [], p.flinchT > 0 ? ['flinch'] : [], p.grounded ? [] : ['air']).join('+');
    return { why, sp: Math.hypot(p.moveVel.x, p.moveVel.z), spr: !!p.sprinting, img: shoot ? GAME.gfx.renderer.domElement.toDataURL('image/jpeg', 0.85) : null };
  }, [!!file, side]);
  if (file) writeFileSync(file, Buffer.from(r.img.split(',')[1], 'base64'));
  return r;
}
const hold = (k, on) => page.evaluate(([k, on]) => document.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { key: k })), [k, on]);

for (const gun of GUNS){
  for (const view of (process.env.VIEWS || 'side,cam').split(',')){
    side = view === 'side';
    await page.evaluate(([gun, lane]) => { GAME.switchWeapon(gun); const p = GAME.player; p.group.position.set(lane.x, 0, lane.z); p.vel.set(0, 0, 0); p.moveVel.set(0, 0, 0); GAME.G.yaw = lane.yaw; GAME.G.pitch = 0; }, [gun, lane]);
    for (let i = 0; i < 30; i++) await frame();
    const dir = path.join(out, `${gun}-${view}`); mkdirSync(dir, { recursive: true });
    let n = 0, runTop = 0, sprTop = 0;
    const shot = async k => { for (let i = 0; i < k; i++){ const r = await frame(path.join(dir, String(n++).padStart(3, '0') + '.jpg')); trace.push((r.spr ? 'S' : 'r') + r.sp.toFixed(1) + (r.why ? '(' + r.why + ')' : '')); if (r.spr) sprTop = Math.max(sprTop, r.sp); else runTop = Math.max(runTop, r.sp); } };
    const trace = [];
    await shot(6);
    await hold('w', true); await shot(30);        // a run
    await hold('Shift', true); await shot(50);    // into a sprint
    await hold('Shift', false); await shot(24);   // back to a run
    await hold('w', false); await shot(16);
    if (side && process.env.TRACE) console.log(trace.join(' '));
    if (side) console.log(`${gun}: run ${runTop.toFixed(2)} m/s, sprint ${sprTop.toFixed(2)} m/s, ${n} frames`);
  }
}
await browser.close();
