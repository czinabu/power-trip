// KILL CAM CAPTURE — films THE KILL CAM (engine/killcam.js) on a held clock, for a look at the shot (testing only):
//   npm run build && node tools/shots/killcam.mjs <out-dir> [hero] [case]
//   hero: jedi | mando | trooper · case: last (one foe, killed) | crowd (a foe killed with others close: no shot) |
//   duel (a duellist finished with a saber finisher: Jedi) | boss (a boss felled) | off (the setting off)
// Writes <out-dir>/<hero>-<case>/NNN.jpg at 30 fps from the game's own camera, and prints the slow motion and the
// shot's weight each frame.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.argv[2] || path.join(root, 'shots-killcam');
const HERO = process.argv[3] || 'jedi', CASE = process.argv[4] || 'last';
const STEP = 1000 / 30;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.addInitScript((off) => {
  const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
  let frozen = null, queue = [];
  performance.now = () => frozen == null ? real() : frozen;
  window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
  window.__freeze = () => { frozen = real(); };
  window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
  try { localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'low'); for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); } if (off) localStorage.setItem('sw_killCam', '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
}, CASE === 'off');
page.on('pageerror', e => console.log('page error', e.message));
await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href);
const run = ms => page.waitForTimeout(ms);
await page.waitForFunction(() => window.GAME && window.GAME.G && document.getElementById('hero-jedi'), null, { timeout: 60000 });
await page.evaluate(h => { document.getElementById('hero-' + h).click(); document.getElementById('mode-sandbox').click(); }, HERO);
for (let i = 0; i < 20 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  await page.evaluate(() => { for (const s of ['#goText', '#trainNo', '#forms [data-go]']){ const b = document.querySelector(s); if (b && b.offsetParent) b.click(); } });
  await run(500);
}
await run(6000);
await page.evaluate(() => { for (const e of GAME.enemies) e.hp = 0; });
await run(2500);
// the foe (or foes) in front of the hero
await page.evaluate((c) => {
  const p = GAME.player.group.position, f = { x: Math.sin(GAME.G.yaw), z: Math.cos(GAME.G.yaw) };
  const put = (type, d, side) => GAME.spawnEnemy(type, { x: p.x + f.x * d + f.z * side, y: 0, z: p.z + f.z * d - f.x * side });
  if (c === 'boss'){ const b = GAME.spawnBoss(); b.group.position.set(p.x + f.x * 4, 0, p.z + f.z * 4); return; }
  window.__foe = put(c === 'duel' ? 'duelist' : 'grunt', 2.4, 0);
  if (c === 'crowd'){ put('grunt', 6, 3); put('grunt', 7, -3); }
}, CASE);
await run(CASE === 'boss' ? 7000 : 1500);
await page.evaluate(() => { window.__freeze(); });
const step = () => page.evaluate(ms => window.__step(ms), STEP);
for (let i = 0; i < 3; i++) await step();
await page.evaluate((c) => {
  const e = window.__foe || GAME.enemies.find(o => !o.dead);
  if (!e) return;
  if (c === 'boss'){ GAME.finaleMove('defeat'); return; }
  if (c === 'duel'){
    // a broken guard, then the finisher
    const p = GAME.player.group.position;
    e.group.position.set(p.x + Math.sin(GAME.G.yaw) * 2.2, 0, p.z + Math.cos(GAME.G.yaw) * 2.2);
    e.state = 'stagger'; e.st = 2; GAME.tryAttack();
  } else {
    const dx = e.group.position.x - GAME.player.group.position.x, dz = e.group.position.z - GAME.player.group.position.z, l = Math.hypot(dx, dz) || 1;
    GAME.damageEnemy(e, 99999, e.group.position.clone().set(dx / l, 0, dz / l), 20, true);
  }
}, CASE);
const dir = path.join(out, `${HERO}-${CASE}`); mkdirSync(dir, { recursive: true });
for (let i = 0; i < (CASE === 'duel' ? 90 : CASE === 'boss' ? 96 : 66); i++){
  await step();
  const info = await page.evaluate(() => `slow ${GAME.G.slowmo.toFixed(2)} kc ${(window.GAME.killcam ? GAME.killcam.KC.w : 0).toFixed(2)} fov ${GAME.camera.fov.toFixed(1)}`);
  await page.screenshot({ path: path.join(dir, String(i).padStart(3, '0') + '.jpg'), type: 'jpeg', quality: 85 });
  if (i % 6 === 0) console.log(i, info);
}
await browser.close();
