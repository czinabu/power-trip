// GRIP CAPTURE — films the Jedi's hands on the hilt close up, per form and grip: standing lit, the guard, and a string of
// cuts, frame by frame on a held clock (testing only):
//   npm run build && node tools/shots/grips.mjs <out-dir> [forms]   (DIST=<an index.html> films another build)
//   forms: comma list of stance ids, each with +r for the reverse grip (jarkai+r: both reversed, jarkai+m: mixed).
//   PHASES=idle,guard,cuts (also sprint, push: a Force push, jump, ease: the cutscene stand)
//   VIEWS=front,side,back (default front,side)  FRAMES=<cut frames, default 60>  WIDE=1 frames the whole body
// FOCUS=off centres on the off hand. Writes <out-dir>/<form>-<phase>-<view>/NNN.jpg, and prints how far the fist's hollow
// sits off the hilt's axis (cm: a hilt held in the fist reads ~0) and how far the off hand is from its spot on a two-handed hilt.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2] || path.join(root, 'shots-grips');
const LIST = (process.argv[3] || 'shiicho,soresu,djemso,niman+r,staff,jarkai').split(',');
const VIEWS = (process.env.VIEWS || 'front,side').split(',');
const FRAMES = +(process.env.FRAMES || 60), WIDE = !!process.env.WIDE;
const FPS = 30, STEP = 1000 / FPS;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
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
await page.evaluate(() => { for (const e of GAME.enemies) e.hp = 0; GAME.setLoadout(['shiicho', null, null]); GAME.switchStance('shiicho', true); GAME.G.stanceCd = 0; });
await run(1500);
if (await page.evaluate(() => GAME.player.unlit)){ await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: '5' })); document.dispatchEvent(new KeyboardEvent('keyup', { key: '5' })); }); await run(1500); }
await page.evaluate(() => window.__freeze());

let view = 'front';
const stats = [];
async function frame(file){
  await page.evaluate(ms => window.__step(ms), STEP);
  const r = await page.evaluate(([shoot, view, wide, focus]) => {
    const p = GAME.player, g = p.group, c = GAME.camera, V = g.position.constructor;
    p.stam = 999; p.force = 999;
    g.updateMatrixWorld(true);
    const hand = new V(); p.rig.armR.wr.getWorldPosition(hand);
    const off = new V(); p.rig.armL.wr.getWorldPosition(off);
    const mid = wide ? new V(g.position.x, g.position.y + 1.1, g.position.z) : hand.clone().lerp(off, focus === 'off' ? 0.9 : 0.35);
    const fx = Math.sin(p.faceYaw), fz = Math.cos(p.faceYaw), d = wide ? 4.4 : 1.5;
    if (view === 'front') c.position.set(mid.x + fx * d - fz * d * 0.35, mid.y + d * 0.2, mid.z + fz * d + fx * d * 0.35);
    else if (view === 'back') c.position.set(mid.x - fx * d + fz * d * 0.3, mid.y + d * 0.3, mid.z - fz * d - fx * d * 0.3);
    else c.position.set(mid.x - fz * d, mid.y + d * 0.1, mid.z + fx * d);
    c.lookAt(mid);
    c.fov = wide ? 36 : 40; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); c.updateMatrixWorld();
    GAME.gfx.composer.render();
    // the fist: the palm's centre (wrist space y −0.07·scale, a little to the palm side) to the hilt's axis
    const axisDist = (wr, root, side = 1) => {
      if (!root || !root.visible) return null;
      const pc = new V(-0.035 * side, -0.1, 0.0); wr.localToWorld(pc);   // (the fist's hollow: model/weapons.js FIST)
      const a = new V(0, -0.65, 0), b = new V(0, 0.2, 0); root.localToWorld(a); root.localToWorld(b);   // (down to the staff's off grip)
      const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, pc.clone().sub(a).dot(ab) / ab.lengthSq()));
      return pc.distanceTo(a.clone().addScaledVector(ab, t));
    };
    // how far the off fist's hollow (the hilt's line through it, model/weapons.js HILT_TURN) turns off the main hilt (degrees)
    const ang = (wr, root) => {
      const a = new V(0, -0.27, 1).normalize().transformDirection(wr.matrixWorld), b = new V(0, 1, 0).transformDirection(root.matrixWorld);
      return Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180 / Math.PI;
    };
    return { twoAng: ang(p.rig.armL.wr, p.saberBladeRoot), main: axisDist(p.rig.armR.wr, p.saberBladeRoot), two: axisDist(p.rig.armL.wr, p.saberBladeRoot, -1), offd: p.offSaber && p.offSaber.node.visible ? axisDist(p.rig.armL.wr, p.offSaber.root, -1) : null,
      img: shoot ? GAME.gfx.renderer.domElement.toDataURL('image/jpeg', 0.88) : null };
  }, [!!file, view, WIDE, process.env.FOCUS || '']);
  if (file) writeFileSync(file, Buffer.from(r.img.split(',')[1], 'base64'));
  stats.push(r);
}
const key = (k, on) => page.evaluate(([k, on]) => document.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { key: k })), [k, on]);

for (const entry of LIST){
  const [id, g = ''] = entry.split('+'), name = entry.replace(/\+/g, '-');
  await page.evaluate(([id, g]) => {
    GAME.G.saberGrip = g === 'r' ? 'reverse' : 'regular';
    try { localStorage.setItem('sw_dualgrip', g === 'r' ? '2' : g === 'm' ? '1' : '0'); localStorage.setItem('sw_sabergrip', GAME.G.saberGrip); } catch(e){}
    GAME.setLoadout([id, null, null]); GAME.switchStance(id, true); GAME.G.stanceCd = 0;
  }, [id, g]);
  for (let i = 0; i < 30; i++) await frame();
  for (const ph of (process.env.PHASES || 'idle,guard,cuts').split(',')){
    for (const v of VIEWS){
      view = v;
      await page.evaluate(() => { const p = GAME.player; p.group.position.set(0, 0, -6); p.vel.set(0, 0, 0); p.moveVel.set(0, 0, 0); GAME.G.yaw = 0; p.blockHeld = false; p.atkHeld = false; });
      for (let i = 0; i < 30; i++) await frame();
      const dir = path.join(out, `${name}-${ph}-${v}`); mkdirSync(dir, { recursive: true });
      stats.length = 0;
      const n = ph === 'cuts' || ph === 'sprint' || ph === 'push' || ph === 'jump' || ph === 'ease' ? FRAMES : 12;
      if (ph === 'sprint'){ await key('Shift', true); await key('w', true); }
      if (ph === 'ease') await page.evaluate(() => { GAME.G.cutscene = true; });
      for (let i = 0; i < n; i++){
        if (ph === 'push' && i % 30 === 0) await page.evaluate(() => { GAME.player.force = 999; GAME.forcePush(); });
        if (ph === 'jump' && i % 30 === 0){ await key(' ', true); await key(' ', false); }
        if (ph === 'guard') await page.evaluate(() => { GAME.player.blockHeld = true; });
        if (ph === 'cuts' && i % 15 === 0) await page.evaluate(() => { GAME.player.atkHeld = false; GAME.tryAttack(); });
        await frame(path.join(dir, String(i).padStart(3, '0') + '.jpg'));
      }
      await page.evaluate(() => { GAME.player.blockHeld = false; GAME.G.cutscene = false; });
      if (ph === 'sprint'){ await key('w', false); await key('Shift', false); }
      if (v === VIEWS[0]){
        const m = stats.map(s => s.main).filter(x => x != null), o = stats.map(s => s.offd).filter(x => x != null);
        const f = a => a.length ? `${(Math.min(...a) * 100).toFixed(1)}–${(Math.max(...a) * 100).toFixed(1)}cm` : '-';
        const t = stats.map(s => s.two).filter(x => x != null);
        const ta = stats.filter(s => s.two != null && s.two < 0.03).map(s => s.twoAng);
        console.log(name, ph, 'main fist↔hilt', f(m), ' off fist↔its hilt', f(o), ' off fist↔main hilt', f(t), ta.length ? ` (its turn off the hilt ${Math.min(...ta).toFixed(0)}–${Math.max(...ta).toFixed(0)}°)` : '');
      }
    }
  }
}
await browser.close();
