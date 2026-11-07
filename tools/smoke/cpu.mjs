// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CPU PROFILE — boots the BUILT game headlessly and, per scene (a big map, the outskirts' traffic and birds, a crowded
// fight, a hub, the open zone), samples the main thread's JavaScript while it plays: frame time (median, p95, p99),
// update time, draw calls, heap growth and GCs, and the functions that cost the most self time (where the frame goes).
// Software rendering, so only good for comparing one build against another on the same machine.
//   npm run build && npm run perf:cpu
//   CPU_ONLY (comma list of scene names), CPU_FRAMES (default 240), CPU_QUALITY (low/medium/high, default high),
//   CPU_W / CPU_H (viewport, default 640×360), CPU_THROTTLE (slow the CPU down this many times: a phone ≈ 4),
//   CPU_DRAW=0 (skip the draw: only the game's own update), CPU_TOP (functions listed, default 14),
//   CPU_DIST (the build to load, default dist: `npx vite build --minify false --outDir dist-prof` keeps function names),
//   PW_CHROMIUM (a Chromium binary, when Playwright's own isn't installed)

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = process.env.CPU_DIST || 'dist';   // CPU_DIST=dist-prof: a build made with --minify false, so the functions keep their names
const page_url = pathToFileURL(path.join(root, DIST, 'index.html')).href;
const FRAMES = +(process.env.CPU_FRAMES || 240);
const ONLY = process.env.CPU_ONLY ? process.env.CPU_ONLY.split(',') : null;
const DRAW = process.env.CPU_DRAW !== '0';
const TOP = +(process.env.CPU_TOP || 14);
if (!existsSync(path.join(root, DIST, 'index.html'))){ console.error(DIST + '/index.html missing: run `npm run build` first'); process.exit(1); }

// [name, hero, code that starts it]. The crowd scenes keep a fight going: foes are topped back up as they fall
const crowd = (map, n) => `GAME.setSandboxMap('${map}'); GAME.startSandbox(); window.__crowd = () => { const live = GAME.enemies.filter(e => !e.dead).length;
  for (let i = live; i < ${n}; i++) GAME.sandboxSpawn(['grunt', 'blaster', 'officer', 'brute', 'blaster'][i % 5]); }; __crowd()`;
const SCENES = [
  ['mission garrison (traffic)', 'jedi', `GAME.startMission('killhouse')`],
  ['mission holdfast (birds)',   'jedi', `GAME.startMission('holdfast')`],
  ['mission jungle (big map)',   'jedi', `GAME.startMission('order66')`],
  ['mission kamino',             'mando', `GAME.startMission('drowned')`],
  ['crowd 24 grassland',         'jedi', crowd('grassland', 24)],
  ['crowd 24 mando icefront',    'mando', crowd('icefront', 24)],
  ['hub temple hall',            'jedi', `GAME.hub.startHub('hall')`],
  ['zone jedha bazaar',          'jedi', `GAME.zone.startZone('jedha', { at: 'bazaar' })`],
  ['campaign jedha',             'jedi', `GAME.startLevel(0)`],
  ['campaign exegol',            'jedi', `GAME.startLevel(2)`],
  ['mission strike (grass)',     'jedi', `GAME.startMission('strike')`],
  ['hub temple training',        'jedi', `GAME.hub.startHub('training')`],
];

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
const errors = [];
for (const [name, hero, code] of SCENES){
  if (ONLY && !ONLY.some(o => name.includes(o))) continue;
  const page = await browser.newPage({ viewport: { width: +(process.env.CPU_W || 640), height: +(process.env.CPU_H || 360) } });
  await page.addInitScript(q => {
    try { for (const k of ['sw_camp_mando', 'sw_camp_jedi']) localStorage.setItem(k, '1');
          localStorage.setItem('jpt_quality', q); localStorage.setItem('sw_fullscreen', '0'); for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('perf', 'NotSupportedError')); };
  }, process.env.CPU_QUALITY || 'high');
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.$eval('#hero-' + hero, el => el.click());
  const tLoad = await page.evaluate(async ({ code, hero }) => {
    const { G } = GAME; G.hero = hero;
    const t = performance.now(); new Function('G', code)(G); return Math.round(performance.now() - t);
  }, { code, hero });
  // warm: shader compiles and the first frames of the scene stay out of the numbers
  await page.evaluate(async () => { for (let i = 0; i < 40; i++){ const { G } = GAME; if (GAME.cutscene.sceneOn()) GAME.cutscene.skipScene(); G.mode = 'play'; G.paused = false; G.skillSelect = false; await new Promise(r => requestAnimationFrame(r)); } });
  const cdp = await page.context().newCDPSession(page);
  if (+process.env.CPU_THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.CPU_THROTTLE });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  // CPU_ALLOC=1: who makes the frame's garbage (sampled, by function and caller, collected objects included)
  if (process.env.CPU_ALLOC){ await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 2048, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); }
  const r = await page.evaluate(async ({ FRAMES, DRAW, hero }) => {
    const { G } = GAME, { renderer } = GAME.gfx, P = GAME.player, comp = GAME.gfx.composer, gl = renderer.getContext();
    const render = comp.render.bind(comp), raf = window.requestAnimationFrame.bind(window);
    let tStart = 0, upd = 0, draw = 0, calls = 0;
    window.requestAnimationFrame = f => raf(t => { tStart = performance.now(); f(t); });
    renderer.info.autoReset = false;
    comp.render = (...a) => { const t = performance.now(); upd = t - tStart; renderer.info.reset(); if (DRAW){ render(...a); gl.finish(); } calls = renderer.info.render.calls; draw = performance.now() - t; };
    const fr = [], heap0 = performance.memory.usedJSHeapSize; let gcs = 0, prevHeap = heap0, last = performance.now();
    for (let i = 0; i < FRAMES; i++){
      if (GAME.cutscene.sceneOn()) GAME.cutscene.skipScene();
      G.mode = 'play'; G.paused = false; G.skillSelect = false; P.hp = Math.max(P.hp, 1e3);
      if (window.__crowd && i % 30 === 0) window.__crowd();
      // fight whatever's nearest, as a player would: walk at it, swing or shoot
      const pp = P.group.position, K = GAME.keys;
      const f = GAME.enemies.filter(e => !e.dead && e.group).sort((a, b) => a.group.position.distanceToSquared(pp) - b.group.position.distanceToSquared(pp))[0];
      const click = (type) => document.dispatchEvent(new MouseEvent(type, { button: 0, bubbles: true }));
      if (f){ const dx = f.group.position.x - pp.x, dz = f.group.position.z - pp.z; G.yaw = Math.atan2(dx, dz); G.pitch = 0.05;
        K['w'] = Math.hypot(dx, dz) > (hero === 'jedi' ? 2.4 : 9);
        try { if (hero === 'jedi'){ if (i % 9 === 0){ click('mousedown'); click('mouseup'); } } else if (i % 120 < 90) click('mousedown'); else click('mouseup'); } catch(e){}
      } else { K['w'] = i % 200 < 120; G.yaw += 0.01; }
      await new Promise(r => requestAnimationFrame(r));
      const now = performance.now(), h = performance.memory.usedJSHeapSize;
      if (h < prevHeap - 1e6) gcs++;
      prevHeap = h;
      fr.push({ ms: now - last, upd, draw, calls }); last = now;
    }
    window.requestAnimationFrame = raf; comp.render = render;
    const q = (k, p) => { const s = fr.map(f => f[k]).sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1); };
    const avg = k => +(fr.reduce((a, f) => a + f[k], 0) / fr.length).toFixed(1);
    return { frame: { med: q('ms', 0.5), p95: q('ms', 0.95), p99: q('ms', 0.99), max: q('ms', 1) }, upd: { avg: avg('upd'), med: q('upd', 0.5), p99: q('upd', 0.99) },
             draw: { avg: avg('draw'), med: q('draw', 0.5) }, calls: Math.round(avg('calls')), foes: GAME.enemies.filter(e => !e.dead).length,
             heapMB: +(performance.memory.usedJSHeapSize / 1e6).toFixed(0), gcs, objects: (() => { let n = 0; GAME.gfx.scene.traverse(() => n++); return n; })() };
  }, { FRAMES, DRAW, hero });
  const { profile } = await cdp.send('Profiler.stop');
  if (process.env.CPU_ALLOC){
    const { profile: hp } = await cdp.send('HeapProfiler.stopSampling');
    const by = new Map(), walk = (n, up) => { const f = n.callFrame, k = (f.functionName || '(anon)') + ':' + (f.lineNumber + 1) + ' < ' + up;
      by.set(k, (by.get(k) || 0) + n.selfSize); for (const c of n.children) walk(c, (f.functionName || '(anon)') + (up ? ' < ' + up.split(' < ')[0] : '')); };
    walk(hp.head, '');
    const tot = [...by.values()].reduce((a, b) => a + b, 0);
    console.log('   garbage', (tot / 1e3 / FRAMES).toFixed(0), 'KB/frame');
    for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log('     ', (v / 1e3 / FRAMES).toFixed(1).padStart(6), 'KB/f', k);
  }
  // self time per function (by name, file line), the idle and the GPU process left out
  const dt = profile.timeDeltas, byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
  let total = 0;
  profile.samples.forEach((id, i) => { const n = byId.get(id), f = n.callFrame; const d = dt[i] || 0;
    if (f.functionName === '(idle)' || f.functionName === '(program)') return;
    total += d; const k = (f.functionName || '(anon)') + ' ' + (f.url ? path.basename(f.url).slice(0, 12) + ':' : '') + (f.lineNumber + 1) + ':' + f.columnNumber;
    self.set(k, (self.get(k) || 0) + d); });
  console.log(`${name.padEnd(28)} load ${tLoad}ms`, JSON.stringify(r));
  const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, TOP);
  for (const [k, v] of top) console.log('     ', (v / 1000 / FRAMES).toFixed(2).padStart(6), 'ms/f', (v / total * 100).toFixed(1).padStart(5) + '%', k);
  // CPU_WHO=name[,name]: who calls these (their callers' chains, by self time spent in them)
  if (process.env.CPU_WHO){
    const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
    const who = new Map(), names = process.env.CPU_WHO.split(',');
    profile.samples.forEach((id, i) => { const n = byId.get(id); if (!names.includes(n.callFrame.functionName)) return;
      const chain = []; for (let p = parent.get(id); p && chain.length < 5; p = parent.get(p)) chain.push(byId.get(p).callFrame.functionName || '(anon)');
      const k = n.callFrame.functionName + ' < ' + chain.join(' < '); who.set(k, (who.get(k) || 0) + (dt[i] || 0)); });
    for (const [k, v] of [...who].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log('      who', (v / 1000 / FRAMES).toFixed(2), 'ms/f', k);
  }
  await page.close();
}
if (errors.length) console.log('errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close();
