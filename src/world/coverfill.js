// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE COVER PASS: real cover laid into the open holes of a map, after its own builder (data/map-scale.js COVER_FILL).
// "Cover" is what the ARC trooper puts his back to (player/trooper/cover.js): a solid on the floor at least 0.95 m tall,
// not a climbable step, with a face long enough for a body. A map can have plenty of solids and still leave long
// stretches of open floor where the nearest thing to hide behind is a lamp post; this finds those stretches and stands
// a piece of the world's own cover in each one: a barricade, a crate stack, a sandbag wall, a broken stone wall, a
// boulder, a hull plate, an ice block or a fallen log, by the map's style.
//
// Each piece is a LOW wall (1.25 m: crouch behind it, rise to shoot over it, and every hero vaults it on the run) with,
// on most, a TALL block (2.4 m) at one end to lean out round. It stands across the line to the middle of the map, so
// its face shelters you from the fight. Pieces keep a full lane clear of every other solid, so no new choke or pocket
// opens for the brutes or the pathing grid (enemies/nav.js is built after), and stay off every story mission point,
// the spawn, hazards and doors. No randomness but a fixed seed per map: every screen in co-op builds the same pieces,
// and they are built in every mode that builds the map.

import * as THREE from 'three';
import { shared, solids, hazardZones, vents, barrels } from '../state.js';
import { arenaKit, seeded } from './arenas/kit.js';
import { fieldKit } from './arenas/field.js';
import { COVER_FILL } from '../data/map-scale.js';
import { MISSIONS } from '../data/missions.js';
import { BATTLE_MAPS } from '../data/battlemaps.js';
import { NOT_PLACES } from './spread.js';

const LOW = 1.25, TALL = 2.4, HALF_T = 0.55;   // the low wall's top, the tall block's top, a wall's half-thickness
// a collider with no box of its own to draw (a rock or a log drawn round it)
const hit = (x, z, hx, hz, h) => solids.push({ x, z, hx, hz, h, box: true });

/* the materials of each style, from the world's palette where it has the colour */
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.8, metalness: o.m ?? 0.2 });
function mats(style, pal){
  switch (style){
    case 'barricade': return { body: mat(pal.metal ?? pal.wall ?? 0x6a7078, { m: 0.45, r: 0.6 }), cap: mat(pal.metalD ?? pal.wallD ?? 0x33383e, { m: 0.45, r: 0.6 }),
                               stripe: mat(pal.stripe ?? 0xd0a030, { r: 0.6 }) };
    case 'crates':    return { body: mat(pal.crate ?? 0x5a5040, { r: 0.85 }), cap: mat(pal.metalD ?? 0x33383e, { m: 0.4, r: 0.6 }),
                               box2: mat(pal.metal ?? 0x6a7078, { m: 0.35, r: 0.65 }), stripe: mat(pal.stripe ?? pal.yellow ?? 0xd0a030, { r: 0.6 }) };
    case 'sandbags':  return { body: mat(pal.sand ?? 0x7a6e56, { r: 0.95, m: 0 }), cap: mat(pal.sand ?? 0x8a7c60, { r: 0.95, m: 0 }),
                               box2: mat(pal.metalD ?? pal.wallD ?? 0x3a3e46, { m: 0.4, r: 0.6 }) };
    case 'rocks':     return { body: mat(pal.rock ?? pal.stone ?? 0x8a6a50, { r: 0.95, m: 0 }), cap: mat(pal.rockD ?? pal.stoneD ?? 0x6a4e38, { r: 0.95, m: 0 }) };
    case 'stone':     return { body: mat(pal.stone ?? 0x9a8c76, { r: 0.95, m: 0.05 }), cap: mat(pal.stoneD ?? 0x76695a, { r: 0.95, m: 0.05 }) };
    case 'plates':    return { body: mat(pal.hull ?? pal.metal ?? 0x8a8478, { m: 0.4, r: 0.7 }), cap: mat(pal.hullD ?? pal.metalD ?? pal.rust ?? 0x5a4a3a, { m: 0.3, r: 0.8 }) };
    case 'ice':       return { body: mat(pal.ice ?? pal.snow ?? 0xb4c4d4, { r: 0.5, m: 0.05 }), cap: mat(pal.snow ?? 0xdce6f0, { r: 0.9, m: 0 }),
                               box2: mat(pal.rock ?? pal.stoneD ?? 0x5a6474, { r: 0.95, m: 0 }) };
    case 'logs':      return { body: mat(pal.bark ?? 0x4a3a2c, { r: 0.95, m: 0 }), cap: mat(pal.moss ?? pal.leaf ?? 0x3a5a2e, { r: 0.95, m: 0 }),
                               box2: mat(pal.stone ?? 0x5a6a5a, { r: 0.95, m: 0 }) };
    default:          return { body: mat(0x6a6e74), cap: mat(0x3a3e46) };
  }
}

/* STYLES — draw one piece: a low wall [x, z, half-length, alongX] and, where `tall` is set, a tall block standing at one
   end of it ([x, z, half-length along the wall], same axis). Every collider is a box on the floor, axis-aligned. */
const STYLES = {
  barricade(K, F, M, w, t){   // Imperial barrier sections: a plate wall with a striped band and posts; a blast shield
    F.wall([w.x, w.z, w.hl, LOW - 0.08, w.ax], { body: M.body, cap: M.cap });
    const n = Math.max(2, Math.round(w.hl / 1.2));
    for (let i = 0; i <= n; i++){ const s = -w.hl + i * (w.hl * 2 / n); K.deco(new THREE.BoxGeometry(w.ax ? 0.22 : 1.2, LOW + 0.1, w.ax ? 1.2 : 0.22), M.cap, w.x + (w.ax ? s : 0), (LOW + 0.1) / 2, w.z + (w.ax ? 0 : s)); }
    K.deco(new THREE.BoxGeometry(w.ax ? w.hl * 2 - 0.4 : 1.14, 0.16, w.ax ? 1.14 : w.hl * 2 - 0.4), M.stripe, w.x, LOW * 0.62, w.z);
    if (t){ F.wall([t.x, t.z, t.hl, TALL - 0.08, w.ax], { body: M.body, cap: M.cap }, { buttress: true });
            K.deco(new THREE.BoxGeometry(w.ax ? t.hl * 2 - 0.3 : 1.14, 0.2, w.ax ? 1.14 : t.hl * 2 - 0.3), M.stripe, t.x, TALL - 0.5, t.z); }
  },
  crates(K, F, M, w, t, R){   // a row of cargo crates for the low face; a two-crate stack (or a short container) for the tall
    // one collider for the whole row (one face to shuffle along: player/trooper/cover.js), drawn as crates side by side
    hit(w.x, w.z, w.ax ? w.hl : HALF_T, w.ax ? HALF_T : w.hl, LOW);
    const n = Math.max(2, Math.round(w.hl / 0.75)), step = w.hl * 2 / n;
    for (let i = 0; i < n; i++){
      const s = -w.hl + (i + 0.5) * step, x = w.x + (w.ax ? s : 0), z = w.z + (w.ax ? 0 : s), m = i % 3 === 1 ? M.box2 : M.body;
      const hh = LOW - (i % 2) * 0.08;   // (a hair uneven, so the row reads as crates, not one block)
      K.deco(new THREE.BoxGeometry(w.ax ? step - 0.06 : HALF_T * 2, hh, w.ax ? HALF_T * 2 : step - 0.06), m, x, hh / 2, z);
      K.deco(new THREE.BoxGeometry(w.ax ? step - 0.02 : 1.16, 0.08, w.ax ? 1.16 : step - 0.02), M.cap, x, LOW * 0.5, z);
    }
    if (t){
      K.box(t.x, t.z, w.ax ? t.hl : 0.65, w.ax ? 0.65 : t.hl, TALL, M.box2);
      for (const y of [0.7, TALL - 0.5]) K.deco(new THREE.BoxGeometry(w.ax ? t.hl * 2 + 0.04 : 1.34, 0.1, w.ax ? 1.34 : t.hl * 2 + 0.04), M.stripe, t.x, y, t.z);
      { const ox = (R() - 0.5) * t.hl; K.box(t.x + (w.ax ? ox : 0), t.z + (w.ax ? 0 : ox), 0.45, 0.45, 0.5, M.body, { y: TALL }); }   // a crate left on top
    }
  },
  sandbags(K, F, M, w, t){   // a sandbag wall; a plate-steel shield with bags at its foot for the tall
    F.wall([w.x, w.z, w.hl, LOW - 0.4, w.ax], { body: M.body, cap: M.cap }, { bags: true });
    if (t){ F.wall([t.x, t.z, t.hl, TALL - 0.08, w.ax], { body: M.box2, cap: M.box2 }, { plate: false });
            K.deco(new THREE.BoxGeometry(w.ax ? t.hl * 2 + 0.3 : 1.5, 0.5, w.ax ? 1.5 : t.hl * 2 + 0.3), M.body, t.x, 0.25, t.z); }
  },
  rocks(K, F, M, w, t){   // a broken rock shelf for the low face; a boulder standing at its end (the rocks kept inside their colliders)
    F.wall([w.x, w.z, w.hl, LOW - 0.08, w.ax], { body: M.body, cap: M.cap });
    for (let i = 0; i < 3; i++){ const s = (i - 1) * w.hl * 0.62;
      const m = K.deco(new THREE.DodecahedronGeometry(1, 0), i % 2 ? M.cap : M.body, w.x + (w.ax ? s : 0), LOW * 0.5, w.z + (w.ax ? 0 : s));
      m.scale.set(w.ax ? w.hl * 0.36 : 0.55, LOW * 0.5, w.ax ? 0.55 : w.hl * 0.36); }
    if (t){ hit(t.x, t.z, w.ax ? t.hl : 0.75, w.ax ? 0.75 : t.hl, TALL);
            const m = K.deco(new THREE.DodecahedronGeometry(1, 0), M.cap, t.x, TALL * 0.5, t.z);
            m.scale.set(w.ax ? t.hl : 0.75, TALL * 0.5, w.ax ? 0.75 : t.hl); }
  },
  stone(K, F, M, w, t){   // a broken masonry wall; a standing pier of the same stone
    F.wall([w.x, w.z, w.hl, LOW - 0.08, w.ax], { body: M.body, cap: M.cap });
    if (t){ F.wall([t.x, t.z, t.hl, TALL - 0.08, w.ax], { body: M.body, cap: M.cap }, { jag: true }); }
  },
  plates(K, F, M, w, t){   // a torn hull plate half buried; a taller plate with its ribs
    F.wall([w.x, w.z, w.hl, LOW - 0.08, w.ax], { body: M.body, cap: M.cap });
    if (t){ F.wall([t.x, t.z, t.hl, TALL - 0.08, w.ax], { body: M.body, cap: M.cap }, { plate: true }); }
  },
  ice(K, F, M, w, t){   // a snow berm with an ice cap; a block of ice with rock at its foot
    F.wall([w.x, w.z, w.hl, LOW - 0.08, w.ax], { body: M.body, cap: M.cap });
    if (t){ F.wall([t.x, t.z, t.hl, TALL - 0.08, w.ax], { body: M.body, cap: M.cap });
            K.deco(new THREE.DodecahedronGeometry(1, 0), M.box2, t.x, 0.35, t.z).scale.set(w.ax ? t.hl * 1.2 : 0.9, 0.5, w.ax ? 0.9 : t.hl * 1.2); }
  },
  logs(K, F, M, w, t){   // a fallen trunk on its side (a box underneath, so it collides as one); a mossy rock at its end
    hit(w.x, w.z, w.ax ? w.hl : HALF_T, w.ax ? HALF_T : w.hl, LOW);
    K.deco(new THREE.CylinderGeometry(LOW * 0.5, LOW * 0.56, w.hl * 2 + 0.3, 9), M.body, w.x, LOW * 0.5, w.z, w.ax ? 0 : Math.PI / 2, 0, w.ax ? Math.PI / 2 : 0);
    K.deco(new THREE.BoxGeometry(w.ax ? w.hl * 1.4 : 0.5, 0.12, w.ax ? 0.5 : w.hl * 1.4), M.cap, w.x, LOW + 0.02, w.z);
    if (t){ const e = Math.max(t.hl * 1.1, 0.95);   // (the rock is turned: its collider holds it whichever way it lies)
            hit(t.x, t.z, e, e, TALL);
            const m = K.deco(new THREE.DodecahedronGeometry(1, 0), M.box2, t.x, TALL * 0.5, t.z, 0.4, 1.1, 0.2);
            m.scale.set(w.ax ? t.hl * 1.1 : 0.95, TALL * 0.55, w.ax ? 0.95 : t.hl * 1.1);
            K.deco(new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M.cap, t.x, TALL * 0.95, t.z).scale.set(0.8, 0.3, 0.8); }
  },
};

/* every [x, z] a story mission on this layout uses (and a battle map's squad spots), as it lands on this build */
export function keepPoints(layout){
  const out = [], at = shared.spreadAt || ((x, z) => [x, z]);
  const walk = (o, r) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)){
      if (o.length >= 2 && typeof o[0] === 'number' && typeof o[1] === 'number' && Math.abs(o[0]) < 200 && Math.abs(o[1]) < 400){ const [x, z] = at(o[0], o[1]); out.push([x, z, r]); return; }
      for (const v of o) walk(v, r);
      return;
    }
    const rr = typeof o.r === 'number' ? o.r : r;
    for (const k in o){ if (!NOT_PLACES.includes(k)) walk(o[k], rr); }
  };
  for (const m of Object.values(MISSIONS)) if (m && m.level && m.level.layout === layout) walk(m, 0);
  const bm = BATTLE_MAPS[layout]; if (bm) walk(bm.spots, 0);
  return out;
}

const gapBox = (a, b) => Math.hypot(Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1)), Math.max(0, Math.max(a.z0 - b.z1, b.z0 - a.z1)));
const boxOf = c => { const ex = c.box ? c.hx : c.r, ez = c.box ? c.hz : c.r; return { x0: c.x - ex, x1: c.x + ex, z0: c.z - ez, z1: c.z + ez }; };
const distTo = (c, x, z) => c.box ? Math.hypot(Math.max(0, Math.abs(x - c.x) - c.hx), Math.max(0, Math.abs(z - c.z) - c.hz))
  : Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r);
const onFloor = c => !c.mound && !((c.y0 || 0) > 0.3);
// a face 2 m long or more, tall enough to crouch behind: what the search counts as cover already there
const isCover = c => onFloor(c) && !c.climbable && c.h >= 0.95 && (c.box ? Math.max(c.hx, c.hz) >= 1 : c.r >= 0.7);

export function fillCover(L){
  const cfg = COVER_FILL[L.layout];
  shared.coverFill = 0;
  if (!cfg || (L.arenaZ && L.arenaZ !== L.arena)) return;
  const hx = shared.arenaHalf, big = !!cfg.big, ring = (cfg.ring ?? 0.86) * hx;
  const CS = big ? 2 : 1, lane = cfg.lane ?? (big ? 3.4 : 2.8), keep = cfg.keep ?? 3.2;
  const K = arenaKit(), R = seeded(cfg.seed ?? (L.layout.length * 977 + 13)), F = fieldKit(K, R), M = mats(cfg.style, L.pal || {});
  const draw = STYLES[cfg.style] || STYLES.stone;
  const blocks = solids.filter(c => !c.mound && c.h > 0.55 && (c.y0 || 0) < 5).map(boxOf);   // (a perch's deck too: nothing goes in under it)
  const cover = solids.filter(isCover);
  // what the pieces stay off: the hero's spawn, mission points, hazards, drums, vents, doors
  const keeps = keepPoints(L.layout).map(([x, z, r]) => [x, z, Math.min(r || 0, 1.5) + keep]);   // (a hold zone can have cover in it: only its middle stays clear)
  keeps.push([0, hx * 0.5, 5]);
  for (const h of hazardZones) keeps.push([h.cx, h.cz, (h.r || 2) + 1.5]);
  for (const v of vents) keeps.push([v.group.position.x, v.group.position.z, 3]);
  for (const b of barrels) keeps.push([b.mesh.position.x, b.mesh.position.z, 2.2]);
  for (const d of shared.doors || []) if (d.at) keeps.push([d.at[0], d.at[1], 4.5]);
  // the open floor, each cell's distance to the nearest cover face
  const cells = [];
  for (let x = -hx + CS / 2; x < hx; x += CS) for (let z = -hx + CS / 2; z < hx; z += CS){
    if (Math.hypot(x, z) > ring) continue;
    const p = { x0: x, x1: x, z0: z, z1: z };
    if (blocks.some(b => gapBox(b, p) <= 0.4)) continue;
    let d = 99; for (const c of cover){ const e = distTo(c, x, z); if (e < d) d = e; }
    cells.push({ x, z, d, tried: 0 });
  }
  const sizes = big ? { low: [2.8, 3.6], tall: [2.0, 2.6] } : { low: [1.9, 2.5], tall: [1.3, 1.6] };
  let placed = 0;
  for (let guard = 0; guard < 400 && placed < cfg.max; guard++){
    let best = null;
    for (const c of cells) if (c.tried < 3 && c.d > cfg.hole && (!best || c.d > best.d)) best = c;
    if (!best) break;
    best.tried++;
    // across the line to the middle: a piece north or south of the middle runs along x, east or west runs along z
    const ax0 = Math.abs(best.z) >= Math.abs(best.x) ? 1 : 0;
    const kind = placed % 3 === 2 ? 'low' : 'combo';   // two in three get a tall block at one end to lean out round
    let done = null;
    for (const ax of [ax0, 1 - ax0]) for (const shrink of [1, 0.75, 0.55]){
      if (done) break;
      const hl = (sizes.low[0] + R() * (sizes.low[1] - sizes.low[0])) * shrink;
      const thl = kind === 'combo' ? (sizes.tall[0] + R() * (sizes.tall[1] - sizes.tall[0])) * Math.max(0.7, shrink) : 0;
      const end = R() < 0.5 ? -1 : 1;
      const w = { x: best.x, z: best.z, hl, ax };
      // the tall block carries on past the low wall's end, in line with it
      const t = thl ? { x: best.x + (ax ? end * (hl + thl) : 0), z: best.z + (ax ? 0 : end * (hl + thl)), hl: thl } : null;
      const halfT = 0.75;
      const fp = ax ? { x0: Math.min(w.x - hl, t ? t.x - thl : 1e9), x1: Math.max(w.x + hl, t ? t.x + thl : -1e9), z0: w.z - halfT, z1: w.z + halfT }
                    : { x0: w.x - halfT, x1: w.x + halfT, z0: Math.min(w.z - hl, t ? t.z - thl : 1e9), z1: Math.max(w.z + hl, t ? t.z + thl : -1e9) };
      if (Math.max(Math.abs(fp.x0), Math.abs(fp.x1), Math.abs(fp.z0), Math.abs(fp.z1)) > hx - 2) continue;
      const corners = [[fp.x0, fp.z0], [fp.x1, fp.z0], [fp.x0, fp.z1], [fp.x1, fp.z1]];
      if (corners.some(([x, z]) => Math.hypot(x, z) > ring + 1.5)) continue;
      if (blocks.some(b => gapBox(b, fp) < lane)) continue;
      if (keeps.some(([x, z, r]) => gapBox(fp, { x0: x, x1: x, z0: z, z1: z }) < r)) continue;
      done = { w, t, fp };
    }
    if (!done) continue;
    const n0 = solids.length;
    draw(K, F, M, done.w, done.t, R);
    blocks.push(done.fp);
    for (let i = n0; i < solids.length; i++) if (isCover(solids[i])) cover.push(solids[i]);
    for (const c of cells){
      const p = { x0: c.x, x1: c.x, z0: c.z, z1: c.z };
      const e = gapBox(done.fp, p); if (e < c.d) c.d = e;
    }
    placed++;
  }
  shared.coverFill = placed;
}
