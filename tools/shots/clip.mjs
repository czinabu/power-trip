// BLADE CLIP CHECK — runs the Jedi through the ignite off the belt, standing lit, walking, sprinting, a guard, a string of
// cuts and the retract, frame by frame on a held clock (a fixed 1/30 s step), and measures how far any lit blade (the
// saber, the staff's far end, Jar'Kai's second, the Darksaber) sinks into the hero's body (testing only):
//   npm run build && node tools/shots/clip.mjs <out-dir> [form] [grip]   (DIST=<an index.html> checks another build)
//   form: a stance id (default niman) · grip: regular | reverse | mixed (Jar'Kai's right forward, left reversed)
// The body is the upright column anim/saber.js keepClear keeps the pose's blade out of (chest space), with the head on
// top (a coarse one: a fist at the belt sits inside it). Prints, per phase, the frames with a blade inside it and the deepest point (cm). SHOTS=1 writes each phase's
// deepest frame to <out-dir>/<form>-<grip>-<phase>.jpg; DARK=1 checks the Mando's Darksaber instead.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2] || path.join(root, 'shots-ignite');
const FORM = process.argv[3] || 'niman', GRIP = process.argv[4] || 'regular';
const FPS = 30, STEP = 1000 / FPS, SHOTS = !!process.env.SHOTS, DARK = !!process.env.DARK;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 480, height: 440 } });
await page.addInitScript((grip) => {
  const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
  let frozen = null, queue = [];
  performance.now = () => frozen == null ? real() : frozen;
  window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
  window.__freeze = () => { frozen = real(); };
  window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
  try { localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_trained_jedi', '1'); localStorage.setItem('sw_camp_mando', '1'); localStorage.setItem('sw_trained_mando', '1'); localStorage.setItem('sw_sabergrip', grip === 'mixed' ? 'regular' : grip); localStorage.setItem('sw_dualgrip', grip === 'reverse' ? '2' : grip === 'mixed' ? '1' : '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
}, GRIP);
page.on('pageerror', e => console.log('page error', e.message));
await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href);
const run = ms => page.waitForTimeout(ms);
await page.waitForFunction(() => window.GAME && window.GAME.G && document.getElementById('hero-jedi'), null, { timeout: 60000 });
await page.evaluate(dark => { document.getElementById(dark ? 'hero-mando' : 'hero-jedi').click(); document.getElementById('mode-sandbox').click(); }, DARK);
for (let i = 0; i < 20 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  await page.evaluate(() => { for (const s of ['#goText', '#trainNo', '#forms [data-go]']){ const b = document.querySelector(s); if (b && b.offsetParent) b.click(); } });
  await run(500);
}
await run(6000);   // past the sandbox's opening beat
await page.evaluate(grip => { GAME.G.saberGrip = grip === 'reverse' ? 'reverse' : 'regular'; for (const e of GAME.enemies) e.hp = 0; window.__freeze(); }, GRIP);
if (DARK) await page.evaluate(() => { GAME.player.up.darksaber = true; GAME.switchWeapon('darksaber'); });
else await page.evaluate(f => { GAME.setLoadout([f, null, null]); GAME.switchStance(f, true); GAME.G.stanceCd = 0; }, FORM);


// (anim/saber.js keepClear's column)
const BODY = { rx: 0.3, rz: 0.24, lo: -1.5, top: 0.36, head: 0.2, headTop: 0.7 };
async function frame(shoot){
  await page.evaluate(ms => window.__step(ms), STEP);
  return page.evaluate(([shoot, B]) => {
    const p = GAME.player, g = p.group, c = GAME.camera;
    p.stam = 999; p.force = 999;
    const x = g.position.x, y = g.position.y, z = g.position.z, ry = g.rotation.y - Math.PI * 0.3;
    c.position.set(x + Math.sin(ry) * 4.2, y + 1.5, z + Math.cos(ry) * 4.2);
    c.lookAt(x, y + 1.0, z);
    c.fov = 40; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); c.updateMatrixWorld();
    GAME.gfx.composer.render();
    g.updateMatrixWorld(true);
    const V = g.position.constructor, inv = p.rig.chest.matrixWorld.clone().invert();
    const depth = q => {
      if (q.y < B.lo || q.y > B.headTop) return 0;
      const hd = q.y > B.top, rx = hd ? B.head : B.rx, rz = hd ? B.head : B.rz, k = Math.hypot(q.x / rx, q.z / rz);
      return k >= 1 ? 0 : (1 - k) * Math.min(rx, rz);
    };
    let worst = 0, who = '';
    // every lit blade mesh: the long cylinders (the core) under the hilts in play
    const roots = [p.saberHand, p.offSaber && p.offSaber.node, p.darksaberMesh].filter(Boolean);
    for (const r of roots) r.traverse(m => {
      if (!m.isMesh || !m.geometry || !m.geometry.parameters) return;
      const h = m.geometry.parameters.height || 0;
      if (h < 1 || !/^(Cylinder|Box)Geometry$/.test(m.geometry.type)) return;
      for (let o = m; o; o = o.parent) if (!o.visible) return;
      for (let s = -0.5; s <= 0.5; s += 0.05){
        const q = new V(0, s * h, 0); m.localToWorld(q); q.applyMatrix4(inv);
        const d = depth(q); if (d > worst){ worst = d; who = r === p.saberHand ? 'main' : r === p.darksaberMesh ? 'dark' : 'off'; }
      }
    });
    const hp = new V(); p.saberHand.getWorldPosition(hp); hp.applyMatrix4(inv);
    return { dbg: hp.toArray().map(v => v.toFixed(2)).join(',') + ' handDepth ' + depth(hp).toFixed(3), d: worst, who, img: shoot ? GAME.gfx.renderer.domElement.toDataURL('image/jpeg', 0.85) : null };
  }, [shoot, BODY]);
}
const key = (k, on) => page.evaluate(([k, on]) => document.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { key: k })), [k, on]);
const tap = async k => { await key(k, true); await key(k, false); };
const res = {};
async function phase(name, frames, each){
  const R = res[name] = { n: 0, clip: 0, max: 0, who: '', img: null };
  for (let i = 0; i < frames; i++){
    if (each) await each(i);
    const f = await frame(SHOTS);
    R.n++;
    if (f.d > 0.01){ R.clip++; if (process.env.DBG) console.log(name, i, f.d.toFixed(3), f.dbg); }
    if (f.d > R.max){ R.max = f.d; R.who = f.who; R.img = f.img; }
  }
}
if (!(await page.evaluate(() => GAME.player.unlit && GAME.player.stowed))){ await tap('5'); for (let i = 0; i < 70; i++) await frame(false); }
for (let i = 0; i < 20; i++) await frame(false);
await tap('5');
await phase('ignite', 40);
await phase('idle', 40);
await phase('walk', 45, async i => { if (i === 0) await key('w', true); if (i === 44) await key('w', false); });
await phase('sprint', 45, async i => { if (i === 0){ await key('Shift', true); await key('w', true); } if (i === 44){ await key('w', false); await key('Shift', false); } });
await phase('settle', 20);
await phase('guard', 30, async i => { await page.evaluate(on => { GAME.player.blockHeld = on; }, i < 29); });
await phase('cuts', 90, async i => { if (i % 15 === 0) await page.evaluate(() => { GAME.player.atkHeld = false; GAME.tryAttack(); }); });
await phase('settle2', 30);
await tap('5');
await phase('retract', 55);
await browser.close();
const tagName = `${DARK ? 'darksaber' : FORM}-${GRIP}`;
if (SHOTS) mkdirSync(out, { recursive: true });
console.log(tagName + ': ' + Object.entries(res).filter(([k]) => !k.startsWith('settle')).map(([k, R]) => {
  if (SHOTS && R.img && R.max > 0.01) writeFileSync(path.join(out, `${tagName}-${k}.jpg`), Buffer.from(R.img.split(',')[1], 'base64'));
  return `${k} ${R.clip}/${R.n}` + (R.max > 0.01 ? ` ${(R.max * 100).toFixed(0)}cm(${R.who})` : '');
}).join(' · '));
