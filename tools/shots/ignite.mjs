// IGNITE CAPTURE — films the Jedi lighting the saber off the belt (5) and putting it out again, frame by frame on a held
// clock (a fixed 1/30 s step whatever the machine), and measures how smoothly the hilt and the weapon hand move (testing only):
//   npm run build && node tools/shots/ignite.mjs <out-dir> [form] [grip]   (DIST=<an index.html> films another build)
//   form: a stance id (default niman) · grip: regular | reverse | mixed (Jar'Kai's right forward, left reversed)
// Prints, for the ignite and the retract, the largest frame-to-frame turn of the hilt and the largest jolt in it (how much
// one frame's turn differs from the frames either side: a snap into the guard shows as a spike). SHOTS=1 writes the
// frames to <out-dir>/<form>-<grip>/NNN.jpg; DARK=1 films the Mando's Darksaber instead.
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

const samples = [];
async function frame(file, tag){
  await page.evaluate(ms => window.__step(ms), STEP);
  const r = await page.evaluate(([shoot, dark]) => {
    const p = GAME.player, g = p.group, c = GAME.camera;
    p.stam = 999; p.force = 999;
    const x = g.position.x, y = g.position.y, z = g.position.z, ry = g.rotation.y - Math.PI * 0.3;
    c.position.set(x + Math.sin(ry) * 4.2, y + 1.5, z + Math.cos(ry) * 4.2);
    c.lookAt(x, y + 1.0, z);
    c.fov = 40; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); c.updateMatrixWorld();
    GAME.gfx.composer.render();
    // the hilt and the weapon hand, in the hero's own frame (so turning on the spot doesn't count)
    const node = dark ? p.darksaberMesh : p.saberHand, off = !dark && p.offSaber && (p.offSaber.node || p.offSaber);
    g.updateMatrixWorld(true);
    const inv = g.matrixWorld.clone().invert(), V = g.position.constructor;
    const dirOf = n => { if (!n) return null; const a = new V(0, 0, 0), b = new V(0, 1, 0); n.localToWorld(a); n.localToWorld(b); a.applyMatrix4(inv); b.applyMatrix4(inv); return b.sub(a).normalize().toArray(); };
    const posOf = n => { const a = new V(); n.getWorldPosition(a); return a.applyMatrix4(inv).toArray(); };
    return { rt: p.reach ? +p.reach.t.toFixed(3) : null, ez: +(p._ease || 0).toFixed(3), rh: p._reachHold, d: dirOf(node), o: off && off.parent && off.visible !== false ? dirOf(off) : null, h: posOf(p.rig.armR.wr), lh: posOf(p.rig.armL.wr),
      img: shoot ? GAME.gfx.renderer.domElement.toDataURL('image/jpeg', 0.85) : null };
  }, [!!file, DARK]);
  if (file) writeFileSync(file, Buffer.from(r.img.split(',')[1], 'base64'));
  samples.push({ tag, ...r, img: null });
}
const key = async k => { await page.evaluate(k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k })), k); await page.evaluate(k => document.dispatchEvent(new KeyboardEvent('keyup', { key: k })), k); };

const dir = path.join(out, `${DARK ? 'darksaber' : FORM}-${GRIP}`);
if (SHOTS) mkdirSync(dir, { recursive: true });
let n = 0; const shot = tag => frame(SHOTS ? path.join(dir, String(n++).padStart(3, '0') + '.jpg') : null, tag);
// at ease with the hilt on the belt (a sandbox start, or put it out now and let it settle)
if (!(await page.evaluate(() => GAME.player.unlit && GAME.player.stowed))){ await key('5'); for (let i = 0; i < 70; i++) await frame(); }
for (let i = 0; i < 20; i++) await frame();
for (let i = 0; i < 6; i++) await shot('rest');
await key('5');
for (let i = 0; i < 45; i++) await shot('ignite');
await key('5');
for (let i = 0; i < 55; i++) await shot('retract');
await browser.close();

// how smooth: the hilt's turn each frame (degrees) and the jolt (the turn's change between frames)
const ang = (a, b) => (a && b) ? Math.acos(Math.max(-1, Math.min(1, a[0]*b[0] + a[1]*b[1] + a[2]*b[2]))) * 180 / Math.PI : 0;
const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
for (const tag of ['ignite', 'retract']){
  const S = samples.filter(s => s.tag === tag);
  const report = (name, val) => {
    const v = S.map((s, i) => i ? val(S[i-1], s) : 0);
    let mx = 0, mi = 0, jolt = 0, ji = 0;
    for (let i = 1; i < v.length; i++){ if (v[i] > mx){ mx = v[i]; mi = i; } const j = Math.abs(v[i] - v[i-1]); if (j > jolt){ jolt = j; ji = i; } }
    return `${name} max ${mx.toFixed(1)}@${mi} jolt ${jolt.toFixed(1)}@${ji}`;
  };
  console.log(`${DARK ? 'darksaber' : FORM}/${GRIP} ${tag}: ` + [
    report('hilt°', (a, b) => ang(a.d, b.d)),
    S[0].o ? report('off°', (a, b) => ang(a.o, b.o)) : '',
    report('hand cm', (a, b) => dist(a.h, b.h) * 100),
    report('lhand cm', (a, b) => dist(a.lh, b.lh) * 100),
  ].filter(Boolean).join(' · '));
  if (process.env.TRACE){
    console.log('  hilt°', S.map((s, i) => i ? ang(S[i-1].d, s.d).toFixed(0) : '-').join(' '));
    console.log('  hand', S.map((s, i) => i ? (dist(S[i-1].h, s.h) * 100).toFixed(0) : '-').join(' '));
    console.log('  reach', S.map(s => s.rt + '/' + s.ez).join(' '));
    console.log('  lhand', S.map((s, i) => i ? (dist(S[i-1].lh, s.lh) * 100).toFixed(0) : '-').join(' '));
  }
}
