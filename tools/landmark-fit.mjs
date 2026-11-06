// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LANDMARK FIT (dev only): for each layout in a wish list, find where its wished-for landmarks (world/landmarks.js) fit by
// the same rules the build checks (inside the map, a lane clear of every solid on the floor, off every mission point,
// door and hazard), and pick the spot in the most exposed open floor, spread from the others. Prints placements to paste
// into data/landmarks.js:
//   node tools/landmark-fit.mjs wish.json      wish: { layout: { base, apart, pieces: [ { kind, …options, rmin, rmax,
//                                                xmin, xmax, zmin, zmax } ] } }   (a piece with `at` stays put)   (CHROMIUM: a Chromium binary)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wish = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-proxy-server', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
page.setDefaultTimeout(0);
page.on('pageerror', e => console.log('page error', e.message));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 120000 });
const res = await page.evaluate(async wish => {
  const { LANDMARKS } = await import('/src/data/landmarks.js');
  const { LANDMARK_KINDS, landmarkMats } = await import('/src/world/landmarks.js');
  const { keepPoints } = await import('/src/world/coverfill.js');
  const { COVER_FILL } = await import('/src/data/map-scale.js');
  const { PERCH } = await import('/src/world/perches.js');
  const { buildArena } = await import('/src/world/arena.js');
  const { arenaKit, seeded } = await import('/src/world/arenas/kit.js');
  const { solids, pillars, shared, hazardZones, vents, barrels } = await import('/src/state.js');
  const floor = c => !c.mound && (c.y0 || 0) < 2 && c.h > 0.55;
  const boxOf = c => { const ex = c.box ? c.hx : c.r, ez = c.box ? c.hz : c.r; return { x0: c.x - ex, x1: c.x + ex, z0: c.z - ez, z1: c.z + ez }; };
  const gap = (a, b) => Math.hypot(Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1)), Math.max(0, Math.max(a.z0 - b.z1, b.z0 - a.z1)));
  const out = {};
  for (const [layout, w] of Object.entries(wish)){
    const L = GAME.mapLevels()[layout];
    const fill = COVER_FILL[layout]; delete COVER_FILL[layout]; PERCH.skip.push(layout);
    const saved = LANDMARKS[layout]; LANDMARKS[layout] = { base: w.base, pieces: [] };
    buildArena(L);
    const hx = shared.arenaHalf, k = hx / (w.base / 2);
    const base = solids.filter(floor).map(boxOf);
    const cover = solids.filter(c => floor(c) && !c.climbable && c.h >= 0.95).map(boxOf);
    const keeps = keepPoints(layout).map(([x, z, r]) => [x, z, Math.min(r || 0, 2) + 3.4]);
    for (const h of hazardZones) keeps.push([h.cx, h.cz, (h.r || 2) + 1.5]);
    for (const v of vents) keeps.push([v.group.position.x, v.group.position.z, 3]);
    for (const b of barrels) keeps.push([b.mesh.position.x, b.mesh.position.z, 2.2]);
    for (const d of shared.doors || []) if (d.at) keeps.push([d.at[0], d.at[1], 5]);
    const K = arenaKit(), chosen = [], taken = [];
    for (const p of w.pieces){
      const { rmin, rmax, xmin, xmax, zmin, zmax, r0, ...spec } = p; spec.r0 = r0;
      // the piece's footprint, built once at the origin and taken back out
      const g = shared.arenaGroup, n0 = g.children.length, s0 = solids.length, p0 = pillars.length;
      LANDMARK_KINDS[spec.kind](K, 0, 0, spec.ax ?? 1, landmarkMats({}, {}), spec, seeded(3));
      const foot = solids.slice(s0).filter(floor).map(boxOf);
      g.children.splice(n0); solids.length = s0; pillars.length = p0;
      let best = null;
      if (spec.at){   // a piece already placed: kept where it is, the others fit round it
        const [x, z] = [spec.at[0] * k, spec.at[1] * k];
        best = { x, z, score: 0, fs: foot.map(f => ({ x0: f.x0 + x, x1: f.x1 + x, z0: f.z0 + z, z1: f.z1 + z })) };
      }
      else for (let x = -hx; x <= hx; x += 1) for (let z = -hx; z <= hx; z += 1){
        const r = Math.hypot(x, z) / hx;
        if (r < (rmin ?? 0.3) || r > (rmax ?? 0.85)) continue;
        if ((zmin != null && z < zmin * k) || (zmax != null && z > zmax * k) || (xmin != null && x < xmin * k) || (xmax != null && x > xmax * k)) continue;
        const fs = foot.map(f => ({ x0: f.x0 + x, x1: f.x1 + x, z0: f.z0 + z, z1: f.z1 + z }));
        if (fs.some(f => Math.max(Math.abs(f.x0), Math.abs(f.x1), Math.abs(f.z0), Math.abs(f.z1)) > hx - 1.5)) continue;
        if (fs.some(f => base.some(b => gap(b, f) < 2.8) || taken.some(b => gap(b, f) < 2.8))) continue;
        if (fs.some(f => keeps.some(([px, pz, rr]) => gap(f, { x0: px, x1: px, z0: pz, z1: pz }) < rr))) continue;
        const sep = Math.min(40, ...chosen.filter(c => c.at).map(c => Math.hypot(c.at[0] * k - x, c.at[1] * k - z)));
        if (sep < (w.apart ?? 18)) continue;
        // how exposed the spot is now: the distance from it to the nearest cover face
        const open = Math.min(30, ...cover.map(b => gap(b, { x0: x, x1: x, z0: z, z1: z })));
        const score = Math.min(open, 9) + Math.min(sep, 30) * 0.12 - Math.abs(r - (spec.r0 ?? 0.55)) * 14;
        if (!best || score > best.score) best = { x, z, score, fs };
      }
      if (best){ delete spec.r0; chosen.push({ ...spec, at: [Math.round(best.x / k), Math.round(best.z / k)] }); taken.push(...best.fs); }
      else chosen.push({ fail: spec.kind });
    }
    if (fill) COVER_FILL[layout] = fill; PERCH.skip.pop(); LANDMARKS[layout] = saved;
    out[layout] = chosen;
  }
  return out;
}, wish);
for (const [k, v] of Object.entries(res)) console.log(k, JSON.stringify(v));
await browser.close(); await server.close();
