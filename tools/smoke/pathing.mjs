// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ENEMY PATHING AUDIT — boots the BUILT game (dist/index.html) headlessly, builds every map in turn (GAME.mapLevels)
// and, on each, stands the hero still at a few spots and lets a crowd of grounded foes (troopers and brutes) hunt them
// from all over the floor, stepping the enemy AI directly (so it runs faster than real time). For every foe it records:
//   · REACHED: it got to the fight (within a few metres of the hero);
//   · STUCK: it never did, though the flow field had a way to the hero from where it stood;
//   · CLIPPED: it ended a step inside a solid it can't stand on (walked through a wall);
// and for every map, the floor no grounded foe can walk to from the hero's spot (POCKETS: a deck only reached by a jump,
// the far side of a one-way drop) and the floor at the foot of a step too tall for a foe to mount (LEDGE FEET: a foe
// sent at one used to grind into it; enemies/nav.js now walks it round).
// Fails when any map has a stuck or clipped foe.
//   npm run build && npm run smoke:pathing -- [map,map,...]      (PATH_SECONDS=… sets the game time per spot, default 24)

import { chromium } from 'playwright';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const only = process.argv[2] ? process.argv[2].split(',') : null;
const SECONDS = +(process.env.PATH_SECONDS || 24);
const SEED = +(process.env.PATH_SEED || 7);

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
await page.addInitScript(() => {
  try { for (const k of ['sw_camp_mando', 'sw_camp_jedi']) localStorage.setItem(k, '1');
        localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('audit', 'NotSupportedError')); };
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
await page.$eval('#hero-jedi', el => el.click()); await page.$eval('#mode-sandbox', el => el.click());
const tap = async sel => { if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {}); };
for (let i = 0; i < 6; i++){
  await tap('#goText'); await tap('#trainNo'); await tap('#forms [data-go]');
  if (await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 4000 }).then(() => true, () => false)) break;
}

const maps = await page.evaluate(() => Object.keys(GAME.mapLevels()));
const report = {};
let failed = false;
for (const id of maps){
  if (only && !only.includes(id)) continue;
  const r = await page.evaluate(async ([id, SECONDS, SEED]) => {
    const { G, player, enemies, solids } = GAME, L = GAME.mapLevels()[id], N = GAME.nav.NAV;
    let s = SEED * 9301 + id.length * 49297; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    GAME.sandboxClear();
    GAME.buildArena(L);
    G.sandboxGod = true;
    GAME.nav.buildNav();
    const CS = 0.6, n = N.n, nz = N.nz, cx = i => N.ox + (i + 0.5) * CS, cz = j => N.oz + (j + 0.5) * CS;
    // LEDGE FEET: open floor (by the real walls) at the foot of a step too tall for a foe to mount (nav.ledge)
    let open = 0, ledgeFoot = 0;
    for (let k = 0; k < n * nz; k++){ if (N.clear[k] < 0.62) continue; open++; if (N.ledge[k] < 0.62) ledgeFoot++; }
    // hero spots: the middle-ish north and south, and the centre (the first clear spot near each)
    const half = N.half, halfZ = N.halfZ, big = GAME.shared.arenaBig;
    const d = Math.min(half * 0.3, 22), dz = Math.min(halfZ * 0.3, 22);
    const spots = L.arenaZ ? [[0, -halfZ * 0.55], [0, -halfZ * 0.3]] : [[0, dz], [0, -dz], [d, 0]];
    const out = { id, half, halfZ, big: !!big, open, ledgeFoot, pockets: 0, spots: [] };
    const spawnOk = (x, z) => GAME.nav.navDist(x, z, 0) < 1e8;
    for (const [sx, sz] of spots){
      GAME.sandboxClear();
      for (const e of [...enemies]) { e.dead = true; }
      enemies.length = 0;
      const sp = GAME.findClearSpawn(sx, sz, 1.6);
      player.group.position.set(sp.x, 0, sp.z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.hp = 1e5;
      // what each body size can walk to from here: a flood over the grid (the field's own rules: no corner cutting)
      const flood = need => {
        const got = new Uint8Array(n * nz), q = [];
        const i0 = Math.floor((sp.x - N.ox) / CS), j0 = Math.floor((sp.z - N.oz) / CS);
        for (let r = 0; r <= 8 && !q.length; r++) for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++){
          const i = i0 + a, j = j0 + b; if (i < 0 || j < 0 || i >= n || j >= nz) continue;
          const k = j*n + i; if (N.clear[k] >= need && !got[k]){ got[k] = 1; q.push(k); }
        }
        for (let h = 0; h < q.length; h++){
          const k = q[h], i = k % n, j = (k - i) / n;
          for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
            const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= n || jj >= nz) continue;
            const kk = jj*n + ii; if (got[kk] || N.clear[kk] < need) continue;
            if (a && b && (N.clear[k + a] < need || N.clear[k + b*n] < need)) continue;
            if (N.top[k] - N.top[kk] > 0.501) continue;   // a foe walks kk → k: never up a ledge taller than a step
            got[kk] = 1; q.push(kk);
          }
        }
        return got;
      };
      const reachable = [flood(0.62), flood(0.95)];
      let reach = 0, pockets = 0;
      for (let k = 0; k < n * nz; k++){ if (N.clear[k] >= 0.62){ if (reachable[0][k]) reach++; else pockets++; } }
      out.pockets = Math.max(out.pockets, pockets);
      // spawn the hunters: troopers and brutes spread over the walkable floor, 8 m and more out
      const want = [['grunt', 10], ['brute', 3]], foes = [];
      const R = big || L.arenaZ ? 40 : Math.max(half, halfZ);
      for (const [type, k] of want){
        let placed = 0;
        for (let tries = 0; tries < 400 && placed < k; tries++){
          const x = sp.x + (rnd() * 2 - 1) * R, z = sp.z + (rnd() * 2 - 1) * R;
          if (Math.abs(x) > half - 2 || Math.abs(z) > halfZ - 2) continue;
          if (Math.hypot(x - sp.x, z - sp.z) < 8) continue;
          const cls = type === 'brute' ? 1 : 0;
          const i = Math.floor((x - N.ox) / CS), j = Math.floor((z - N.oz) / CS);
          if (N.clear[j*n + i] < (cls ? 0.95 : 0.62) + 0.3) continue;
          if (!reachable[cls][j*n + i]) continue;   // a pocket (counted above): not a pathing fault
          GAME.spawnEnemy(type, { x, y: 0, z });
          const e = enemies[enemies.length - 1];
          e.group.position.set(x, N.top[j*n + i], z); e.state = 'chase'; e.st = 0;   // (on the ground there: a deck's top, a step)
          foes.push({ e, type, cls, x0: x, z0: z, d0: 0, best: 1e9, clip: 0, path: [], lastMove: 0, stuckFor: 0, maxStuck: 0, px: x, pz: z });
          placed++;
        }
      }
      // the field from here, filled for these bodies, gives each its walking distance
      N.primed = false; N.t = 0; N.n = 0;
      GAME.nav.updateNav(0.2, player.group.position);
      for (const f of foes) f.d0 = Math.min(GAME.nav.navDist(f.x0, f.z0, f.cls), 999);
      // run the AI: stepping updateEnemies straight (the frame loop held), the hero rooted in place
      const wasPaused = G.paused; G.paused = true;
      let overlap = 0, pairs = 0;
      const dt = 1 / 30, steps = Math.round(SECONDS / dt);
      for (let k = 0; k < steps; k++){
        G.gt += dt;
        player.hp = 1e5; player.group.position.set(sp.x, 0, sp.z);
        GAME.updateEnemies(dt);
        if (k % 15 === 0){
          // BUNCHING: two live foes whose bodies overlap (closer than 80% of their radii added together)
          for (let a = 0; a < foes.length; a++) for (let b = a + 1; b < foes.length; b++){
            const A = foes[a].e, B = foes[b].e; if (A.dead || B.dead) continue;
            const r = 0.7 * ((A.t.scale || 1) + (B.t.scale || 1)) * 0.8;
            if (Math.hypot(A.group.position.x - B.group.position.x, A.group.position.z - B.group.position.z) < r) overlap++;
            pairs++;
          }
          for (const f of foes){
            const e = f.e; if (e.dead) continue;
            const p = e.group.position, dd = Math.hypot(p.x - sp.x, p.z - sp.z);
            if (dd < f.best) f.best = dd;
            // inside something it can't be (its feet below a non-climbable top, within the footprint)
            for (const c of solids){
              if (c.mound || c.y0 || c.soft) continue;
              if (p.y >= c.h - 0.05) continue;
              const inside = c.box ? Math.abs(p.x - c.x) < c.hx - 0.15 && Math.abs(p.z - c.z) < c.hz - 0.15 : Math.hypot(p.x - c.x, p.z - c.z) < c.r - 0.15;
              if (inside){ f.clip++; break; }
            }
            const mv = Math.hypot(p.x - f.px, p.z - f.pz);
            if (dd > 7 && mv < 0.35) f.stuckFor += 0.5; else f.stuckFor = 0;
            if (f.stuckFor > f.maxStuck){ f.maxStuck = f.stuckFor; f.stuckAt = [+p.x.toFixed(1), +p.z.toFixed(1)]; }
            f.px = p.x; f.pz = p.z;
            if (k % 60 === 0) f.path.push([+p.x.toFixed(1), +p.z.toFixed(1)]);
          }
        }
      }
      G.paused = wasPaused;
      const res = foes.map(f => ({ type: f.type, from: [+f.x0.toFixed(1), +f.z0.toFixed(1)], walk: +f.d0.toFixed(1), best: +f.best.toFixed(1),
        end: [+f.e.group.position.x.toFixed(1), +f.e.group.position.z.toFixed(1)], clip: f.clip, maxStuck: f.maxStuck, stuckAt: f.stuckAt, path: f.path,
        // speed × time is the furthest it could walk: a foe whose walk was longer than that is "too far", not stuck
        far: f.d0 > f.e.spd * SECONDS * 0.8 }));
      out.spots.push({ hero: [+sp.x.toFixed(1), +sp.z.toFixed(1)], foes: res, reach, overlap: pairs ? overlap / pairs : 0 });
      for (const e of enemies) e.hp = 0;
      GAME.sandboxClear();
    }
    return out;
  }, [id, SECONDS, SEED]);
  let stuck = 0, clipped = 0, total = 0, reached = 0;
  for (const sp of r.spots) for (const f of sp.foes){
    total++;
    if (f.best < 8) reached++;
    else if (!f.far) { stuck++; f.stuck = true; }
    if (f.clip) clipped++;
  }
  const overlap = r.spots.reduce((a, sp) => a + sp.overlap, 0) / Math.max(1, r.spots.length);
  r.summary = { total, reached, stuck, clipped, overlap };
  report[id] = r;
  const bad = stuck || clipped;
  if (bad) failed = true;
  console.log(`${bad ? 'FAIL' : ' ok '} ${id.padEnd(16)} foes ${String(total).padStart(3)}  reached ${String(reached).padStart(3)}  stuck ${String(stuck).padStart(2)}  clipped ${String(clipped).padStart(2)}  pockets ${String(r.pockets).padStart(5)}  ledge feet ${String(r.ledgeFoot).padStart(4)}/${r.open}  overlap ${(overlap * 100).toFixed(2)}%`);
  for (const sp of r.spots) for (const f of sp.foes) if (f.stuck || f.clip) console.log(`       ${f.type} from ${f.from} (walk ${f.walk}) → best ${f.best} end ${f.end}${f.clip ? ' CLIP' : ''} stuck ${f.maxStuck}s at ${f.stuckAt}  hero ${sp.hero}`);
}
const outDir = path.join(root, 'shots-pathing');   // (ignored: .gitignore)
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'pathing.json'), JSON.stringify(report, null, 1));
if (errors.length){ console.log('page errors:\n' + errors.slice(0, 10).join('\n')); failed = true; }
await browser.close();
console.log(failed ? 'PATHING: FAIL' : 'PATHING: ok');
process.exit(failed ? 1 : 0);
