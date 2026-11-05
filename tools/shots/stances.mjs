// STANCE CAPTURE — films the Jedi's forms standing, running and guard walking (RMB held), from the front, the side
// or behind, frame by frame on a held clock, and measures how far a planted foot slides (testing only):
//   npm run build && node tools/shots/stances.mjs <out-dir> [stances] [moves]   (DIST=<an index.html> films another build)
//   stances: comma list of stance ids (data/stances.js), each with +g per press of G after switching to it (Niman's
//            reverse grip: niman+g; Jar'Kai's mixed and both reverse: jarkai+g, jarkai+gg). Default: every form.
//   moves: idle,walk,block,strafe,blockstrafe,back    VIEWS=front,side,back    FRAMES=<n>
// Writes <out-dir>/<stance>-<move>-<view>/NNN.jpg
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2] || path.join(root, 'shots-jarkai');
const LIST = (process.argv[3] || 'shiicho,makashi,soresu,ataru,niman,niman+g,djemso,shien,juyo,vaapad,staff,jarkai,jarkai+g,jarkai+gg').split(',');
const MOVES = (process.argv[4] || 'idle,walk,block,blockstrafe').split(',');
const VIEWS = (process.env.VIEWS || 'front,side').split(',');
const FRAMES = +(process.env.FRAMES || 48);
const FPS = 30, STEP = 1000 / FPS;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 480, height: 520 } });
await page.addInitScript(() => {
  const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
  let frozen = null, queue = [];
  performance.now = () => frozen == null ? real() : frozen;
  window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
  window.__freeze = () => { frozen = real(); };
  window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
  try { localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_trained_jedi', '1'); localStorage.setItem('sw_dualgrip', '0'); localStorage.setItem('sw_sabergrip', 'regular'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
});
page.on('pageerror', e => console.log('page error', e.message));
await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href);
const run = ms => page.waitForTimeout(ms);
await page.waitForFunction(() => window.GAME && window.GAME.G && document.getElementById('hero-jedi'), null, { timeout: 60000 });
await page.evaluate(() => { document.getElementById('hero-jedi').click(); document.getElementById('mode-sandbox').click(); });
for (let i = 0; i < 20 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  await page.evaluate(() => { for (const s of ['#goText', '#trainNo', '#forms [data-go]']){ const b = document.querySelector(s); if (b && b.offsetParent) b.click(); } });
  await run(500);
}
await run(6000);
await page.evaluate(() => { GAME.setLoadout(['shiicho', null, null]); GAME.switchStance('shiicho', true); GAME.G.stanceCd = 0; });
await run(1500);
if (await page.evaluate(() => GAME.player.unlit)){ await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' })); document.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' })); }); await run(1500); }
await page.evaluate(() => window.__freeze());

let view = 'front', diag = [];
async function frame(file){
  await page.evaluate(ms => window.__step(ms), STEP);
  const r = await page.evaluate(([shoot, view]) => {
    const p = GAME.player, g = p.group, c = GAME.camera, y0 = GAME.G.yaw;
    const fx = Math.sin(p.faceYaw), fz = Math.cos(p.faceYaw);
    const x = g.position.x, y = g.position.y, z = g.position.z;
    if (view === 'front') c.position.set(x + fx * 5.2 - fz * 1.6, y + 1.5, z + fz * 5.2 + fx * 1.6);
    else if (view === 'back') c.position.set(x - fx * 5.2, y + 1.9, z - fz * 5.2);
    else c.position.set(x - fz * 5.4, y + 1.3, z + fx * 5.4);
    c.lookAt(x, y + 0.85, z);
    c.fov = 38; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); c.updateMatrixWorld();
    GAME.gfx.composer.render();
    // feet: world ankle positions, to measure slide (a foot on the floor that moves)
    const R = p.rig, a = [R.legL.ank, R.legR.ank].map(n => { n.updateWorldMatrix(true, false); const e = n.matrixWorld.elements; return [e[12], e[13], e[14]]; });
    // CLIP: how deep the blade(s) cut into the hero's own body (capsules round the spine, head and legs; the arms that
    // hold the hilts aren't counted), in metres
    const n0 = R.hips.position; const W = n => { n.updateWorldMatrix(true, false); return new n.position.constructor().setFromMatrixPosition(n.matrixWorld); };
    const caps = [[W(R.hips), W(R.chest), 0.17], [W(R.chest), W(R.head), 0.13], [W(R.head), W(R.head), 0.14],
      ...[R.legL, R.legR].flatMap(L => [[W(L.hip), W(L.knee), 0.09], [W(L.knee), W(L.ank), 0.07]])];
    const segD = (q, a, b) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, q.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-9))); return q.distanceTo(a.clone().addScaledVector(ab, t)); };
    const len = 0.18 + 1.6 * (GAME.stance().bladeLen || 1);
    let clip = 0;
    for (const node of [p.saberBladeRoot, p.offSaber && !p.offAway && p.offSaber.root].filter(Boolean)){
      if (!node.visible && node !== p.saberBladeRoot) continue;
      node.updateWorldMatrix(true, false);
      for (let s = 0.2; s <= len; s += 0.08){
        const q = new n0.constructor(0, s, 0); node.localToWorld(q);
        for (const [a, b, r] of caps) clip = Math.max(clip, r - segD(q, a, b));
      }
    }
    return { clip, img: shoot ? GAME.gfx.renderer.domElement.toDataURL('image/jpeg', 0.85) : null, feet: a, sp: Math.hypot(p.moveVel.x, p.moveVel.z), hy: R.hips.position.y, w: p._gait ? p._gait.w : 0, step: p._gait ? p._gait.step : 0, lock: [0, 1].map(j => p._gait && p._gait.locks && p._gait.w >= 1 ? !!p._gait.locks[j] : !!(p._footing && !p._footing.feet[j].step)), dbg: [p.vis.rotation.y.toFixed(2), R.hips.rotation.y.toFixed(2), p.faceYaw.toFixed(2), p._gait && p._gait.locks ? p._gait.locks.map(l => l ? 'L' : '-').join('') : 'x'].join(' ') };
  }, [!!file, view]);
  if (file) writeFileSync(file, Buffer.from(r.img.split(',')[1], 'base64'));
  diag.push(r);
}
const key = (k, on) => page.evaluate(([k, on]) => document.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { key: k })), [k, on]);

const pressed = {};
for (const entry of LIST){
  const [id, gs = ''] = entry.split('+'), name = entry.replace(/\+/g, '-');
  // switch in fresh (the grip back to its default), then press G as asked
  await page.evaluate(id => { GAME.setLoadout([id, null, null]); GAME.switchStance(id, true); GAME.G.stanceCd = 0; }, id);
  for (let i = 0; i < 20; i++) await frame();
  // (a grip choice outlives the switch: count the presses already made on this stance, round its cycle)
  const cyc = id === 'jarkai' ? 3 : 2, need = ((gs.length - (pressed[id] || 0)) % cyc + cyc) % cyc;
  for (let n = 0; n < need; n++){ await key('g', true); await frame(); await key('g', false); for (let i = 0; i < 12; i++) await frame(); }
  pressed[id] = gs.length;
  for (const move of MOVES){
    for (const v of VIEWS){
      view = v;
      await page.evaluate(() => { const p = GAME.player; p.group.position.set(0, 0, -6); p.vel.set(0, 0, 0); p.moveVel.set(0, 0, 0); GAME.G.yaw = 0; p.blockHeld = false; });
      for (let i = 0; i < 40; i++) await frame();
      const dir = path.join(out, `${name}-${move}-${v}`); mkdirSync(dir, { recursive: true });
      const blk = move.startsWith('block');
      const k = move === 'idle' ? null : move.includes('strafe') ? 'd' : move === 'back' ? 's' : 'w';
      if (blk) await page.evaluate(() => { GAME.player.blockHeld = true; });
      if (k) await key(k, true);
      diag.length = 0;
      for (let i = 0; i < FRAMES; i++){
        if (blk) await page.evaluate(() => { GAME.player.blockHeld = true; });
        await frame(path.join(dir, String(i).padStart(3, '0') + '.jpg'));
      }
      if (k) await key(k, false);
      // SLIDE: how far a foot travels in the world while the stride (or the standing footing) holds it planted, per second
      const d = diag.splice(0);
      let slide = 0, n = 0;
      for (let i = 1; i < d.length; i++) for (const j of [0, 1]) if (d[i].lock[j] && d[i-1].lock[j]){ slide += Math.hypot(d[i].feet[j][0] - d[i-1].feet[j][0], d[i].feet[j][2] - d[i-1].feet[j][2]); n++; }
      if (process.env.DUMP === `${name}-${move}`) d.forEach((f, i) => console.log(i, f.feet.map(a => a.map(x => x.toFixed(3)).join(',')).join('  '), f.dbg || ''));
      if (v === VIEWS[0]) console.log(name, move, 'speed', d.at(-1).sp.toFixed(2), 'step', d.at(-1).step.toFixed(2), 'w', d.at(-1).w.toFixed(2), 'hipY', d.at(-1).hy.toFixed(2), 'planted-foot slide (m/s)', (n ? slide / n * FPS : 0).toFixed(3),
        'blade in body: frames', d.filter(f => f.clip > 0.01).length + '/' + d.length, 'deepest (cm)', (Math.max(0, ...d.map(f => f.clip)) * 100).toFixed(1));
      await page.evaluate(() => { GAME.player.blockHeld = false; });
    }
  }
}
await browser.close();
