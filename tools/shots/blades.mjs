// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BLADE CAPTURE — boots a BUILT game, lights the Jedi's saber in a few forms on a held clock and saves a close-up of each,
// then one with a Sith duellist beside the hero, so a lightsaber look (fx/blade-glow.js) can be compared before and after:
//   npm run build && node tools/shots/blades.mjs dist/index.html <out-dir>
//   FORMS=a,b,c (stance ids, default shiicho,niman,juyo,staff,jarkai) · MAP=<a GAME.mapLevels() id, e.g. jedhaNight>
//   HERO=mando (the Darksaber instead) · NOENEMY=1 · PW_CHROMIUM (a Chromium binary, when Playwright's own isn't installed)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';
const [dist, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
await page.addInitScript(() => {
  const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
  let frozen = null, queue = [];
  performance.now = () => frozen == null ? real() : frozen;
  window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
  window.__freeze = () => { frozen = real(); };
  window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
  try { localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'high'); for (const k of ['sw_camp_jedi','sw_trained_jedi','sw_camp_mando','sw_trained_mando']) localStorage.setItem(k, '1'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
});
page.on('pageerror', e => console.log('page error', e.message));
await page.goto(pathToFileURL(dist).href);
await page.waitForFunction(() => window.GAME && window.GAME.G && document.getElementById('hero-jedi'), null, { timeout: 60000 });
const run = ms => page.waitForTimeout(ms);
const hero = process.env.HERO || 'jedi';
await page.evaluate(h => { document.getElementById('hero-' + h).click(); document.getElementById('mode-sandbox').click(); }, hero);
for (let i = 0; i < 20 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
  await page.evaluate(() => { for (const s of ['#goText', '#trainNo', '#forms [data-go]']){ const b = document.querySelector(s); if (b && b.offsetParent) b.click(); } });
  await run(500);
}
await run(6000);
const MAP = process.env.MAP;
if (MAP) { console.log(await page.evaluate(() => Object.keys(GAME.mapLevels()).join(','))); await page.evaluate(id => { const L = GAME.mapLevels()[id]; GAME.sandboxClear(); GAME.buildArena(L); }, MAP); await run(1500); }
await page.evaluate(() => { GAME.sandboxClear && GAME.sandboxClear(); GAME.G.sandboxGod = true; window.__freeze(); });
const step = async n => { for (let i = 0; i < n; i++) await page.evaluate(() => window.__step(33)); };
const key = async k => { await page.evaluate(k => { document.dispatchEvent(new KeyboardEvent('keydown', { key: k })); document.dispatchEvent(new KeyboardEvent('keyup', { key: k })); }, k); };
async function shot(name, cam){
  const img = await page.evaluate(([d, h, a]) => {
    const p = GAME.player, g = p.group, c = GAME.camera;
    const x = g.position.x, y = g.position.y, z = g.position.z, ry = g.rotation.y + a;
    c.position.set(x + Math.sin(ry) * d, y + h, z + Math.cos(ry) * d);
    c.lookAt(x, y + 1.35, z);
    c.fov = 50; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); c.updateMatrixWorld();
    GAME.gfx.composer.render();
    return GAME.gfx.renderer.domElement.toDataURL('image/png');
  }, cam || [4.0, 1.7, -0.6]);
  writeFileSync(path.join(out, name + '.png'), Buffer.from(img.split(',')[1], 'base64'));
  console.log('shot', name);
}
async function lit(){
  const off = () => page.evaluate(() => !!(GAME.player.unlit || GAME.player.holstered));
  await step(5);
  for (let n = 0; n < 3 && await off(); n++){   // (5 can land while the sandbox is still settling: try again)
    await key('5');
    for (let i = 0; i < 90 && await off(); i++) await step(1);
  }
  await step(45);
}
if (hero === 'mando'){
  await page.evaluate(() => { GAME.player.up.darksaber = true; GAME.switchWeapon('darksaber'); });
  await step(60);
  await shot('darksaber');
} else {
  await page.evaluate(() => { GAME.setLoadout(['soresu', null, null]); GAME.switchStance('soresu', true); GAME.G.stanceCd = 0; }); await lit();
  for (const f of (process.env.FORMS || 'shiicho,niman,juyo,staff,jarkai').split(',')){
    await page.evaluate(f => { GAME.setLoadout([f, null, null]); GAME.switchStance(f, true); GAME.G.stanceCd = 0; }, f);
    await lit();
    await shot(f);
  }
  if (!process.env.NOENEMY){
  await page.evaluate(() => { const p = GAME.player.group.position; GAME.spawnEnemy('acolyte', p.clone().set(p.x + 1.6, 0, p.z + 1.2)); const e = GAME.enemies[GAME.enemies.length - 1]; e.dummy = true; e.home = { x: p.x + 1.6, z: p.z + 1.2 }; });
  await step(40);
  await shot('enemy', [4.2, 1.6, -0.9]); }
}
await browser.close();
