// CUT CAPTURE — films the Jedi's saber cuts, frame by frame on a held clock (every frame a fixed 1/30 s step whatever
// the machine), for a look at a form's strokes (testing only):
//   npm run build && node tools/shots/cuts.mjs <out-dir> [form] [grip] [moves]   (DIST=<an index.html> films another build)
//   form: a stance id (default shien) · grip: regular | reverse (the grip preference: Niman follows it; Jar'Kai takes
//   both forward, both reversed, or mixed for its right forward and left reversed)
//   moves: comma list of string, right, left, low, lowR, stab, spin (default all). Each move presses its cut twice, so a
//   grip with variants (data/poses.js SWING_VARIANTS) shows both takes.
// Writes <out-dir>/<form>-<grip>-<move>/NNN.jpg, filmed from in front and to the weapon side of the hero (VIEW=0..0.5
// turns the camera from dead ahead round to square off the weapon side; PROBE=1 prints the arm and blade each frame).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2] || path.join(root, 'shots-cuts');
const FORM = process.argv[3] || 'shien', GRIP = process.argv[4] || 'reverse';
const MOVES = (process.argv[5] || 'string,right,left,low,lowR,stab,spin').split(',');
const FPS = 30, STEP = 1000 / FPS;
const VIEW = +(process.env.VIEW || 0.38);   // where the camera stands: 0 = dead in front of the hero, 0.5 = square off the weapon side

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 480, height: 440 } });
await page.addInitScript((grip) => {
  const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
  let frozen = null, queue = [];
  performance.now = () => frozen == null ? real() : frozen;
  window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
  window.__freeze = () => { frozen = real(); };
  window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
  try { localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_trained_jedi', '1'); localStorage.setItem('sw_sabergrip', grip === 'mixed' ? 'regular' : grip); localStorage.setItem('sw_dualgrip', grip === 'reverse' ? '2' : grip === 'mixed' ? '1' : '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
}, GRIP);
page.on('pageerror', e => console.log('page error', e.message));
if (process.env.PROBE){ page.on('console', m => { if (m.text().startsWith('probe')) console.log(m.text()); }); await page.addInitScript(() => { window.__probe = true; }); }
await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href);
const run = ms => page.waitForTimeout(ms);
await page.waitForFunction(() => window.GAME && window.GAME.G && document.getElementById('hero-jedi'), null, { timeout: 60000 });
await page.evaluate(() => { document.getElementById('hero-jedi').click(); document.getElementById('mode-sandbox').click(); });
for (let i = 0; i < 20 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  await page.evaluate(() => { for (const s of ['#goText', '#trainNo', '#forms [data-go]']){ const b = document.querySelector(s); if (b && b.offsetParent) b.click(); } });
  await run(500);
}
await run(6000);   // past the sandbox's opening beat
await page.evaluate(grip => { GAME.G.saberGrip = grip === 'reverse' ? 'reverse' : 'regular'; for (const e of GAME.enemies) e.hp = 0; window.__freeze(); }, GRIP);

// a camera in front of the hero and out to the weapon side, rendered after the game's own frame
async function frame(file){
  await page.evaluate(ms => window.__step(ms), STEP);
  const img = await page.evaluate(([shoot, side]) => {
    const p = GAME.player, g = p.group, c = GAME.camera;
    p.stam = 999; p.force = 999;
    const x = g.position.x, y = g.position.y, z = g.position.z, ry = g.rotation.y - Math.PI * side;
    c.position.set(x + Math.sin(ry) * 4.8, y + 1.55, z + Math.cos(ry) * 4.8);
    c.lookAt(x, y + 1.05, z);
    c.fov = 40; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); c.updateMatrixWorld();
    GAME.gfx.composer.render();
    if (window.__probe && p.swing && p.rig){
      const R = p.rig, T = window.THREE_V || (window.THREE_V = R.chest.position.constructor), inv = R.chest.matrixWorld.clone().invert();
      const el = new T().setFromMatrixPosition(R.armR.el.matrixWorld).applyMatrix4(inv), wr = new T().setFromMatrixPosition(R.armR.wr.matrixWorld).applyMatrix4(inv);
      const nb = p.saberBladeRoot || p.saberHand, b0 = new T(0, 0.2, 0), b1 = new T(0, 1.5, 0); nb.localToWorld(b0); nb.localToWorld(b1); b0.applyMatrix4(inv); b1.applyMatrix4(inv);
      const f = wr.clone().sub(el).normalize(), b = b1.clone().sub(b0).normalize(), k = (p.swing.t / p.swing.dur).toFixed(2);
      console.log('probe', k, 'hand', wr.toArray().map(v => v.toFixed(2)).join(','), 'fore', f.toArray().map(v => v.toFixed(2)).join(','), 'blade', b.toArray().map(v => v.toFixed(2)).join(','));
    }
    return shoot ? GAME.gfx.renderer.domElement.toDataURL('image/jpeg', 0.85) : null;
  }, [!!file, VIEW]);
  if (file) writeFileSync(file, Buffer.from(img.split(',')[1], 'base64'));
}
const key = (k, on) => page.evaluate(([k, on]) => document.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { key: k })), [k, on]);
const attack = () => page.evaluate(() => { GAME.player.atkHeld = false; GAME.tryAttack(); });
const dur = () => page.evaluate(() => GAME.player.swing ? GAME.player.swing.dur : 0.6);

// each move: [keys held, view pitch (+ looks down: past ~0.42 aims low), presses, linked in rhythm]. A strafe cut
// struck in rhythm would spin (data/poses.js SWING_SPINS move), so the side moves press again after the swing instead
const MOVE = {
  string: [[], 0.2, 3, true], right: [['d'], 0.2, 2, false], left: [['a'], 0.2, 2, false], low: [['a'], 0.7, 2, false],
  lowR: [['d'], 0.7, 2, false], stab: [['w'], 0.7, 2, false], spin: [[], 0.2, 2, true],
};
const swinging = () => page.evaluate(() => GAME.player.atkT > 0);
await page.evaluate(f => { GAME.setLoadout([f, null, null]); GAME.switchStance(f, true); GAME.G.stanceCd = 0; }, FORM);
// the blade lit (a sandbox start has the hilt in hand, blade out: 5 lights it)
if (await page.evaluate(() => !!GAME.player.unlit)){ await key('5', true); await key('5', false); }
for (let i = 0; i < 40; i++) await frame();
for (const move of MOVES){
  const [held, pitch, presses, rhythm] = MOVE[move];
  await page.evaluate(pitch => { const p = GAME.player; p.group.position.set(0, 0, -10); p.vel.set(0, 0, 0); p.moveVel.set(0, 0, 0); p._spinT = -99; p.cutStr = null; p.lastCut = null; GAME.G.yaw = 0; GAME.G.pitch = pitch; }, pitch);
  for (let i = 0; i < 30; i++) await frame();
  const dir = path.join(out, `${FORM}-${GRIP}-${move}`); mkdirSync(dir, { recursive: true });
  let n = 0; const shot = () => frame(path.join(dir, String(n++).padStart(3, '0') + '.jpg'));
  for (let i = 0; i < 4; i++) await shot();
  // (the cut's direction is read on the press: the keys go up straight after it, so the hero doesn't run off)
  const press = async () => { for (const k of held) await key(k, true); await attack(); for (const k of held) await key(k, false); };
  for (let i = 0; i < presses; i++){
    if (!rhythm || i === 0){ await press(); if (!rhythm) await page.evaluate(() => { GAME.player._spinT = GAME.G.gt; }); }
    if (process.env.PROBE) console.log('probe cut', await page.evaluate(() => { const w = GAME.player.swing; return w && [w.pat.id, w.pat.ang, w.h, w.dir].join(' '); }));
    const f = Math.round((await dur()) * FPS * (rhythm && i < presses - 1 ? 0.62 : 1));
    for (let j = 0; j < f; j++) await shot();
    if (rhythm && i < presses - 1) await press();   // in the back half: it queues, and leaves just after the follow-through
    else for (let j = 0; j < 40 && await swinging(); j++) await shot();
  }
  for (let i = 0; i < 8; i++) await shot();
  console.log(move, n, 'frames');
}
await browser.close();
