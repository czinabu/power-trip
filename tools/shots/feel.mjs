// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FEEL CAPTURE — boots a BUILT game, starts story missions as a hero and saves the live game view (the real follow camera
// and HUD) on a held clock, for before/after looks at how big the world reads (testing only):
//   npm run build && node tools/shots/feel.mjs <out-dir> <shot> [shot ...]
//     shot: <name>=<hero>:<mission>[:<objective>[:<yaw>[:<x>,<z>]]]   e.g. prologue=trooper:order66:0:3.14
//   DIST=<an index.html> shoots another build; W/H the viewport (default 1600×900); HUD=0 hides the HUD
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || 'shots/feel');
const shots = process.argv.slice(3);
mkdirSync(out, { recursive: true });
const W = +(process.env.W || 1600), H = +(process.env.H || 900);
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const spec of shots){
  const [name, rest] = spec.split('=');
  const [hero, mission, obj = '0', yaw = '', at = ''] = rest.split(':');
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.addInitScript(() => {
    // a seeded Math.random, so a before and an after build lay the same map out the same way
    let seed = 1234567; Math.random = () => ((seed = Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6D2B79F5 >>> 0) % 1000000) / 1000000;
    const real = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
    let frozen = null, queue = [];
    performance.now = () => frozen == null ? real() : frozen;
    window.requestAnimationFrame = cb => { if (frozen == null) return rRAF(cb); queue.push(cb); return queue.length; };
    window.__freeze = () => { frozen = real(); };
    window.__step = ms => { frozen += ms; const q = queue; queue = []; for (const cb of q) cb(frozen); };
    try { for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
          localStorage.setItem('jpt_quality', 'high'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shots', 'NotSupportedError')); };
  });
  await page.goto(pathToFileURL(process.env.DIST || path.join(root, 'dist/index.html')).href, { timeout: 180000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 180000 });
  await page.evaluate(h => document.getElementById('hero-' + h).click(), hero);
  // CAM='{"lookUp":0.6}' patches CFG.camera for the shot (a camera tune to look at before it's made for real)
  if (process.env.CAM) await page.evaluate(j => { const p = JSON.parse(j), C = GAME.CFG.camera; for (const k in p) if (p[k] && typeof p[k] === 'object') Object.assign(C[k], p[k]); else C[k] = p[k]; }, process.env.CAM);
  await page.waitForTimeout(800);
  await page.evaluate(([m, o]) => GAME.startMission(m, o), [mission, +obj]);
  for (let i = 0; i < 16 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.paused && !GAME.G.cutscene)); i++){
    await page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); if (GAME.G.cutscene) GAME.cutscene.skipScene(); if (GAME.G.paused){ const g = document.getElementById('goText'); if (g) g.click(); } });
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.style.display = 'none'; });
  await page.evaluate(([yaw, at]) => {
    const { G, player } = GAME;
    G.sandboxGod = true; player.hp = player.maxHp = 1e4;
    if (at){ const [x, z] = at.split(',').map(Number); player.group.position.set(x, 0, z); player.vel.set(0, 0, 0); player.moveVel && player.moveVel.set(0, 0, 0); }
    if (yaw !== '') G.yaw = +yaw;
    player.faceYaw = player.group.rotation.y = G.yaw;
    G.pitch = 0;
    window.__freeze();
  }, [yaw, at]);
  // let the rig settle on the held clock (the follow camera eases in)
  await page.evaluate(() => { for (let i = 0; i < 90; i++){ GAME.G.pitch = 0; window.__step(33); } });
  if (process.env.HUD === '0') await page.addStyleTag({ content: 'body > *:not(canvas){ visibility: hidden !important } canvas{ visibility: visible !important }' });
  await page.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 });
  console.log(name, await page.evaluate(() => { const c = GAME.camera, p = GAME.player.group.position; return JSON.stringify({ cam: c.position.toArray().map(v => +v.toFixed(2)), fov: +c.fov.toFixed(1), hero: p.toArray().map(v => +v.toFixed(2)), fog: GAME.gfx.scene.fog && [GAME.gfx.scene.fog.near | 0, GAME.gfx.scene.fog.far | 0], draw: GAME.arena && (({ calls, tris }) => ({ calls, tris }))(GAME.arena()) }); }));
  await page.close();
}
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));
await browser.close();
