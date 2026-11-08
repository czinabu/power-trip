// GRIP CAPTURE — films the Jedi's hands on the hilt close up, per form and grip: standing lit, the guard, and a string of
// cuts, frame by frame on a held clock (testing only):
//   npm run build && node tools/shots/grips.mjs <out-dir> [forms]   (DIST=<an index.html> films another build)
//   forms: comma list of stance ids, each with +r for the reverse grip (jarkai+r: both reversed, jarkai+m: mixed).
//   PHASES=idle,guard,cuts (also blocks: raised twice, blockmove: the same walking, bolts: plain bolt catches round the zones, sprint, push: a Force push, jump, ease: the cutscene stand, covers: the held catches zone by zone)  JITTER=1|2 counts elbow jerks  HEAD=1 counts blades through the head
//   VIEWS=front,side,back (default front,side)  FRAMES=<cut frames, default 60>  WIDE=1 frames the whole body (2: the upper body)
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
const FRAMES = +(process.env.FRAMES || 60), WIDE = process.env.WIDE === '2' ? 2 : !!process.env.WIDE;
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
  if (process.env.DBG) await page.evaluate(() => { window.__dbg = []; });
  await page.evaluate(ms => window.__step(ms), STEP);
  if (process.env.DBG) console.log(JSON.stringify(await page.evaluate(() => window.__dbg)));
  const r = await page.evaluate(([shoot, view, wide, focus]) => {
    const p = GAME.player, g = p.group, c = GAME.camera, V = g.position.constructor;
    p.stam = 999; p.force = 999;
    g.updateMatrixWorld(true);
    const hand = new V(); p.rig.armR.wr.getWorldPosition(hand);
    const off = new V(); p.rig.armL.wr.getWorldPosition(off);
    const mid = wide ? new V(g.position.x, g.position.y + (wide === 2 ? 1.35 : 1.1), g.position.z) : hand.clone().lerp(off, focus === 'off' ? 0.9 : 0.35);
    const fx = Math.sin(p.faceYaw), fz = Math.cos(p.faceYaw), d = wide ? (wide === 2 ? 2.6 : 4.4) : 1.5;
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
    // THE ARMS IN THE BODY: points down each arm (from a third of the way down the upper arm to the wrist) in chest
    // space, against the torso (an upright ellipse, rx 0.2 · rz 0.15, from the belt to the collar) — how deep (m) — and
    // how far any of them reaches round behind the back (z < -0.16 with the point inside the shoulders' width)
    const R = p.rig, inv = R.chest.matrixWorld.clone().invert(), W = n => new V().setFromMatrixPosition(n.matrixWorld).applyMatrix4(inv);
    let armIn = 0, armBack = 0, worst = '';
    const elR = W(R.armR.el), elL = W(R.armL.el);   // (the elbows in chest space, for the jitter count: JITTER=1)
    for (const [A, nm] of [[R.armR, 'R'], [R.armL, 'L']]){
      const sh = W(A.sh), el = W(A.el), wr = W(A.wr);
      for (let t = 0.35; t <= 2.001; t += 0.1){
        const q = t <= 1 ? sh.clone().lerp(el, t) : el.clone().lerp(wr, t - 1);
        if (q.y > -0.75 && q.y < 0.28){ const k = Math.hypot(q.x / 0.2, q.z / 0.15); if (k < 1){ const d = (1 - k) * 0.15; if (d > armIn){ armIn = d; worst = nm + (t <= 1 ? ' upper' : ' fore'); } } }
        if (Math.abs(q.x) < 0.3 && q.z < -0.16) armBack = Math.max(armBack, -0.16 - q.z);
      }
    }
    // THE BLADES THROUGH THE HEAD: the nearest either lit blade (0.15–1.1m up from its hilt) passes to the head's centre (m)
    const hd = W(R.head).add(new V(0, 0.1, 0));
    let headGap = 9;
    for (const root of [p.saberBladeRoot, p.offSaber && p.offSaber.node.visible ? p.offSaber.root : null]){
      if (!root || !root.visible) continue;
      for (let s = 0.15; s <= 1.1; s += 0.05){ const q = new V(0, s, 0); root.localToWorld(q); q.applyMatrix4(inv); headGap = Math.min(headGap, q.distanceTo(hd)); }
    }
    // the blade tips (chest space), for the jitter count: a blade flicking between two ways round shows as a tip jerk
    const tip = root => root && root.visible ? new V(0, 0.9, 0).applyMatrix4(root.matrixWorld).applyMatrix4(inv).toArray() : [0, 0, 0];
    const tipR = tip(p.saberBladeRoot), tipL = tip(p.offSaber && p.offSaber.node.visible ? p.offSaber.root : null);
    return { tipR, tipL, headGap, armIn, armBack, worst, elR: elR.toArray(), elL: elL.toArray(), twoAng: ang(p.rig.armL.wr, p.saberBladeRoot), main: axisDist(p.rig.armR.wr, p.saberBladeRoot), two: axisDist(p.rig.armL.wr, p.saberBladeRoot, -1), offd: p.offSaber && p.offSaber.node.visible ? axisDist(p.rig.armL.wr, p.offSaber.root, -1) : null,
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
  // Jar'Kai's grips are cycled in play with G (both forward → mixed → both reversed): step round to the one asked for
  if (id === 'jarkai') for (let i = 0; i < 3; i++){
    const at = await page.evaluate(() => { const p = GAME.player, rv = r => r && r.userData.gripTo === 0; return (rv(p.saberBladeRoot) ? 'r' : '') + (p.offSaber && rv(p.offSaber.root) ? 'o' : ''); });
    if (at === (g === 'r' ? 'ro' : g === 'm' ? 'o' : '')) break;
    await key('g', true); await key('g', false);
  }
  for (let i = 0; i < 30; i++) await frame();
  for (const ph of (process.env.PHASES || 'idle,guard,cuts').split(',')){
    for (const v of VIEWS){
      view = v;
      await page.evaluate(() => { const p = GAME.player; p.group.position.set(0, 0, -6); p.vel.set(0, 0, 0); p.moveVel.set(0, 0, 0); GAME.G.yaw = 0; p.blockHeld = false; p.atkHeld = false; });
      for (let i = 0; i < 30; i++) await frame();
      const dir = path.join(out, `${name}-${ph}-${v}`); mkdirSync(dir, { recursive: true });
      stats.length = 0;
      const n = ph === 'covers' ? 120 : ph === 'bolts' ? 96 : ph === 'blocks' || ph === 'blockmove' ? 90 : ph === 'guard' && process.env.JITTER ? 60 : ph === 'cuts' || ph === 'sprint' || ph === 'push' || ph === 'jump' || ph === 'ease' ? FRAMES : 12;
      if (ph === 'sprint'){ await key('Shift', true); await key('w', true); }
      if (ph === 'ease') await page.evaluate(() => { GAME.G.cutscene = true; });
      for (let i = 0; i < n; i++){
        if (ph === 'push' && i % 30 === 0) await page.evaluate(() => { GAME.player.force = 999; GAME.forcePush(); });
        if (ph === 'jump' && i % 30 === 0){ await key(' ', true); await key(' ', false); }
        if (ph === 'guard') await page.evaluate(() => { GAME.player.blockHeld = true; });
        // BLOCKS: the guard raised, dropped and raised again (a form with two blocks alternates them)
        if (ph === 'blocks' || ph === 'blockmove') await page.evaluate(on => { GAME.player.blockHeld = on; }, i < 40 || i >= 50);
        // BLOCKMOVE: the same, walking (forward, then strafing left and right)
        if (ph === 'blockmove' && i % 30 === 0){ for (const k of ['w', 'a', 'd']) await key(k, false); await key(['w', 'a', 'd'][i / 30], true); }
        // COVERS: the held catches a duellist's line waits on (jedi/guardline.js), each zone in turn, 20 frames apiece
        if (ph === 'covers' && i % 20 === 0) await page.evaluate(z => { const Z = [[1, 0], [-1, 0], [1, 0.6], [-1, 0.6], [1, -0.6], [-1, -0.6]][z % 6];
          GAME.player.blockHeld = true; GAME.player.deflectAnim = { t: 0, dur: 99, pose: null, side: Z[0], h: Z[1], hold: true, line: 'z' + z }; }, i / 20);
        // BOLTS: plain bolt catches (not held, flicked away), round the zones, one every 12 frames
        if (ph === 'bolts' && i % 12 === 0) await page.evaluate(z => { const Z = [[1, 0], [-1, 0], [1, 0.6], [-1, 0.6], [1, -0.6], [-1, -0.6], [0, 0], [0.1, 0.6]][z % 8];
          GAME.player.blockHeld = true; GAME.player.deflectAnim = { t: 0, dur: 0.3, pose: null, side: Z[0], h: Z[1] }; }, i / 12);
        if (ph === 'cuts' && i % 15 === 0) await page.evaluate(() => { GAME.player.atkHeld = false; GAME.tryAttack(); });
        await frame(path.join(dir, String(i).padStart(3, '0') + '.jpg'));
      }
      await page.evaluate(() => { GAME.player.blockHeld = false; GAME.G.cutscene = false; GAME.player.deflectAnim = null; });
      if (ph === 'sprint'){ await key('w', false); await key('Shift', false); }
      if (ph === 'blockmove') for (const k of ['w', 'a', 'd']) await key(k, false);
      if (v === VIEWS[0]){
        const m = stats.map(s => s.main).filter(x => x != null), o = stats.map(s => s.offd).filter(x => x != null);
        const f = a => a.length ? `${(Math.min(...a) * 100).toFixed(1)}–${(Math.max(...a) * 100).toFixed(1)}cm` : '-';
        const t = stats.map(s => s.two).filter(x => x != null);
        const ta = stats.filter(s => s.two != null && s.two < 0.03).map(s => s.twoAng);
        const ai = stats.map(s => s.armIn), ab = stats.map(s => s.armBack);
        if (process.env.ARMS === '2') stats.forEach((s, i) => { if (s.armIn > 0.02 || s.armBack > 0.02) console.log('  frame', i, (s.armIn * 100).toFixed(1), s.worst, (s.armBack * 100).toFixed(1)); });
        // ELBOW JITTER: an elbow's jerk (its second difference frame to frame, cm) — a flip between solutions shows as a spike
        if (process.env.JITTER){
          const jerk = k => stats.slice(2).map((s, i) => Math.hypot(...s[k].map((x, j) => x - 2 * stats[i + 1][k][j] + stats[i][k][j])) * 100);
          const jR = jerk('elR'), jL = jerk('elL'), J = jR.map((x, i) => Math.max(x, jL[i]));
          // …and a SHAKE: the elbow doubling back on itself (each step over 0.6cm, the two steps more than 90° apart)
          const shake = k => stats.slice(2).filter((s, i) => { const a = stats[i + 1][k].map((x, j) => x - stats[i][k][j]), b = s[k].map((x, j) => x - stats[i + 1][k][j]);
            const la = Math.hypot(...a), lb = Math.hypot(...b); return la > 0.006 && lb > 0.006 && a.reduce((t, x, j) => t + x * b[j], 0) < 0; }).length;
          const tR = jerk('tipR'), tL = jerk('tipL');
          console.log(name, ph, 'blade tip shakes R', shake('tipR'), 'L', shake('tipL'), ' tip jerk >10cm: frames', tR.map((x, i) => Math.max(x, tL[i])).filter(x => x > 10).length, ' worst R', Math.max(...tR).toFixed(1), 'L', Math.max(...tL).toFixed(1) + 'cm');
          console.log(name, ph, 'elbow shakes R', shake('elR'), 'L', shake('elL'), ' jerk: frames >2cm', J.filter(x => x > 2).length + '/' + J.length, ' >5cm', J.filter(x => x > 5).length, ' worst', Math.max(...J).toFixed(1) + 'cm', '(R', Math.max(...jR).toFixed(1), 'L', Math.max(...jL).toFixed(1) + ')');
          if (process.env.JITTER === '2') tR.forEach((x, i) => { if (Math.max(x, tL[i]) > 10) console.log('  tip frame', i + 2, 'R', x.toFixed(1), 'L', tL[i].toFixed(1)); });
          if (process.env.JITTER === '2') J.forEach((x, i) => { if (x > 2) console.log('  frame', i + 2, x.toFixed(1)); });
        }
        const hg = stats.map(s => s.headGap);
        if (process.env.HEAD) console.log(name, ph, 'blade through the head (<14cm): frames', hg.filter(x => x < 0.14).length + '/' + hg.length, 'nearest', (Math.min(...hg) * 100).toFixed(1) + 'cm');
        if (process.env.ARMS) console.log(name, ph, 'arm in body: frames', ai.filter(x => x > 0.01).length + '/' + ai.length, 'deepest', (Math.max(...ai) * 100).toFixed(1) + 'cm', stats.reduce((a, s) => s.armIn > a.armIn ? s : a).worst,
          ' behind the back: frames', ab.filter(x => x > 0.01).length, 'furthest', (Math.max(...ab) * 100).toFixed(1) + 'cm');
        else console.log(name, ph, 'main fist↔hilt', f(m), ' off fist↔its hilt', f(o), ' off fist↔main hilt', f(t), ta.length ? ` (its turn off the hilt ${Math.min(...ta).toFixed(0)}–${Math.max(...ta).toFixed(0)}°)` : '');
      }
    }
  }
}
await browser.close();
