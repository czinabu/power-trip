// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// PERCHES: the second storey of the campaign and story arenas. A few raised decks round each arena's outer ring, so a
// Force leap, a chained double jump or a jetpack burst comes down somewhere worth being instead of on the same floor.

import * as THREE from 'three';
import { shared, solids, hazardZones, vents, barrels } from '../state.js';
import { arenaKit } from './arenas/kit.js';
import { MISSIONS } from '../data/missions.js';

/* A PERCH is a scaffold, honest to its collision: a deck SLAB (world/collision.js: walked under, stood on) on four thin
   posts, so the ground fight runs on underneath it and the floor it covers is still floor. A crate and a low step beside it, on the
   side that faces the middle, are the way up for anyone (its top is in a jump's reach, the deck is in reach from its top:
   data/movement.js MOVE.reach), and a TALL perch carries a second, smaller deck above the first for the leap and the
   pack. Ground melee can't follow, but blasters, snipers and jet troopers still see the deck, so it's a vantage, not a
   safe spot (the same deal as the temple's overwatch gantry).

   They are placed by rule, not by hand: after an arena's own builder has run, the outer ring (PERCH.ring of the half
   size) is searched for the spots furthest from everything already there (props, hazards, doors, the spawn, and every
   point a story mission on this layout uses), and the best few that sit far enough apart get a perch. The search has no
   randomness, so an arena comes out the same every time, and on both screens in co-op. An arena that already has a
   second storey of its own (PERCH.enough m² of decks 2 to 12 m up) gets none, and so do the training grounds, the
   sandbox's open rooms, the long chase and the battle maps. */
export const PERCH = {
  skip: ['hall', 'forge', 'dojo', 'throne', 'pursuit'],   // training, the sandbox's open rooms, the chase
  enough: 300,          // m² of existing high ground (2–12 m up) that already makes a second storey
  ring: [0.5, 0.82],    // where to look, as a share of the half size
  count: [[60, 3], [75, 4], [1e9, 5]],   // arena width under w → that many perches
  apart: 0.62,          // perches at least this share of the half size apart
  keep: 4.5,            // m kept clear round a mission point (its zone's radius on top)
  low: 1.15,            // the low step's top (under MOVE.vaultHeight: vaulted from a run, mantled from a stand)
  step: 2.3,            // crate top (a gunner's jump reaches 3.6 m: 1.3 apex + MOVE.reach 2.35)
  deck: 4.5,            // low deck top (2.2 above the crate top)
  high: 6.8,            // tall perch's upper deck top (2.3 above the low deck; its underside clears a body standing there)
  half: 2.2,            // low deck half-width
  upper: 1.5,           // upper deck half-width
};

const lip = 0.45;   // deck thickness: the slab is solid from (top − lip) up

/* every [x, z] the story missions on this layout use (objective zones, consoles, posts, paths, starts, squad spots),
   with the zone's radius where it has one */
const pointsCache = new Map();
const NOT_PLACES = ['level', 'from', 'lanes', 'every', 'pace', 'spd', 'dmg', 'first', 'len', 'w', 'r0'];   // number pairs that aren't places
function missionPoints(layout){
  if (pointsCache.has(layout)) return pointsCache.get(layout);
  const out = [];
  const walk = (o, r) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)){
      if (o.length >= 2 && typeof o[0] === 'number' && typeof o[1] === 'number' && Math.abs(o[0]) < 200 && Math.abs(o[1]) < 400){ out.push([o[0], o[1], r]); return; }
      for (const v of o) walk(v, r);
      return;
    }
    const rr = typeof o.r === 'number' ? o.r : r;
    for (const k in o){ if (!NOT_PLACES.includes(k)) walk(o[k], rr); }
  };
  for (const m of Object.values(MISSIONS)) if (m && m.level && m.level.layout === layout) walk(m, 0);
  pointsCache.set(layout, out);
  return out;
}

/* m² of decks between 2 and 12 m up inside the walls: the arena's own second storey */
function highGround(){
  const hx = shared.arenaHalf, hz = shared.arenaHalfZ;
  let a = 0;
  for (const c of solids){
    if (c.mound || c.h < 2 || c.h > 12) continue;
    if (c.box ? Math.min(c.hx, c.hz) < 0.6 : c.r < 0.8) continue;   // a wall, a shelf run or a post: nothing to stand on
    const ex = c.box ? c.hx : c.r, ez = c.box ? c.hz : c.r;
    if (Math.abs(c.x) + ex > hx - 1.5 || Math.abs(c.z) + ez > hz - 1.5) continue;   // the arena's own walls and the rim past them
    const s = c.box ? 4 * c.hx * c.hz : Math.PI * c.r * c.r;
    if (s >= 2) a += s;
  }
  return a;
}

/* how far (x, z) is from the nearest solid on the floor (beams high overhead don't count), hazard, vent or drum */
function floorGap(x, z){
  let d = 1e9;
  for (const c of solids){
    if (c.mound || (c.y0 && c.y0 > 3)) continue;
    let e;
    if (c.box){ const dx = Math.max(0, Math.abs(x - c.x) - c.hx), dz = Math.max(0, Math.abs(z - c.z) - c.hz); e = Math.hypot(dx, dz); }
    else e = Math.hypot(x - c.x, z - c.z) - c.r;
    if (e < d) d = e;
  }
  for (const h of hazardZones){
    const cx = h.cx ?? h.x, cz = h.cz ?? h.z;
    if (cx == null) continue;
    const r = h.kind === 'line' ? Math.max(h.halfLen || 0, h.halfW || 0) : (h.r || h.radius || 2);
    d = Math.min(d, Math.hypot(x - cx, z - cz) - r);
  }
  for (const v of vents){ const p = v.group ? v.group.position : v.pos; if (p) d = Math.min(d, Math.hypot(x - p.x, z - p.z) - 2.5); }
  for (const b of barrels){ const p = b.mesh ? b.mesh.position : b.pos; if (p) d = Math.min(d, Math.hypot(x - p.x, z - p.z) - 1.2); }
  return d;
}
/* does anything taller than `maxH` (or any slab in the way) stand inside the box (x ± hx, z ± hz)? */
function tallIn(x, z, hx, hz, maxH){
  for (const c of solids){
    if (c.mound) continue;
    const ex = c.box ? c.hx : c.r, ez = c.box ? c.hz : c.r;
    if (Math.abs(x - c.x) >= hx + ex || Math.abs(z - c.z) >= hz + ez) continue;
    if (c.h > maxH && !(c.y0 && c.y0 > PERCH.high + 1.5)) return true;
  }
  return false;
}

/* how good a perch centred on (x, z), climbed from the (sx, sz) side, would be; -1 if it doesn't fit */
function fit(x, z, sx, sz, pts, spawn){
  const H = PERCH.half, ins = H - 0.3;
  if (tallIn(x, z, H + 0.4, H + 0.4, PERCH.deck - lip - 1.9)) return -1;   // the deck clears whatever stands under it by a body
  let g = 1e9;
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g = Math.min(g, floorGap(x + a * ins, z + b * ins) - 0.2);
  const cx = x + sx * (H + 1.5), cz = z + sz * (H + 1.5);
  if (tallIn(cx, cz, 1.2 + 0.6, 1.2 + 0.6, 0)) return -1;               // the crate needs its own floor
  g = Math.min(g, floorGap(cx, cz) - 1.7, floorGap(cx + sx * 2.2, cz + sz * 2.2) - 1.4, floorGap(cx + sx * 4.4, cz + sz * 4.4) - 0.6);   // ...the low step, and a clear run-up
  if (g < 0.5) return -1;
  for (const [px, pz, r] of pts) if (Math.hypot(x - px, z - pz) < (r || 0) + PERCH.keep || Math.hypot(cx - px, cz - pz) < (r || 0) + 2.5) return -1;
  for (const [qx, qz] of spawn) if (Math.hypot(x - qx, z - qz) < 8 || Math.hypot(cx - qx, cz - qz) < 6) return -1;
  return Math.min(g, 4);
}

const pick = (pal, keys, fb) => { for (const k of keys) if (pal[k] != null) return pal[k]; return fb; };

export function buildPerches(L){
  if (!L.layout || PERCH.skip.includes(L.layout) || /^ty[A-Z]/.test(L.layout)) return 0;   // (nor the hidden temple: no fight there)
  if (L.arena > 100 || (L.arenaZ && L.arenaZ > L.arena)) return 0;   // the battle maps and the long route
  if (highGround() >= PERCH.enough) return 0;
  const half = shared.arenaHalf, pts = missionPoints(L.layout);
  const spawn = [[0, half * 0.5], [0, half * 0.42]];
  const want = PERCH.count.find(([w]) => L.arena < w)[1];
  // score a fixed grid of candidates round the outer ring (deterministic: no randomness, so co-op screens agree)
  const cand = [], lim = half - PERCH.half - 1.5;
  for (let i = 0; i < 96; i++){
    const a = (i / 96) * Math.PI * 2 + Math.PI / 96;
    for (let k = 0; k < 6; k++){
      const r = half * (PERCH.ring[0] + (PERCH.ring[1] - PERCH.ring[0]) * k / 5);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
      // the crate goes on the side facing the middle, squared to the nearer axis (collision is axis-aligned)
      const inX = Math.abs(x) > Math.abs(z), sx = inX ? -Math.sign(x) : 0, sz = inX ? 0 : -Math.sign(z);
      const c = fit(x, z, sx, sz, pts, spawn);
      if (c >= 0) cand.push({ x, z, a, c, sx, sz });
    }
  }
  // one per slice of the ring, so they stand all the way round instead of bunching on the roomiest side: each slice takes
  // its best spot, then any slice left empty is filled from the rest, still PERCH.apart from the others
  cand.sort((p, q) => q.c - p.c || p.a - q.a);
  const chosen = [], far = q => chosen.every(o => Math.hypot(q.x - o.x, q.z - o.z) >= half * PERCH.apart);
  const slice = q => Math.floor(((q.a + Math.PI / 4) % (Math.PI * 2)) / (Math.PI * 2 / want));
  for (let s = 0; s < want; s++){ const q = cand.find(q => slice(q) === s && far(q)); if (q) chosen.push(q); }
  for (const q of cand){ if (chosen.length >= want) break; if (!chosen.includes(q) && far(q)) chosen.push(q); }
  chosen.sort((p, q) => p.a - q.a);
  if (!chosen.length) return 0;

  const pal = L.pal || {};
  const body = pick(pal, ['stoneD', 'metalD', 'wallD', 'hullD', 'rockD', 'woodD', 'greenD'], 0x4a4a50);
  const top  = pick(pal, ['stone', 'metal', 'wall', 'hull', 'rock', 'wood', 'green'], 0x6a6a70);
  const trim = pick(pal, ['trim', 'stripe', 'yellow', 'beskar', 'inlay'], 0xc8a03a);
  const mBody = new THREE.MeshStandardMaterial({ color: body, roughness: 0.85, metalness: 0.25 });
  const mTop  = new THREE.MeshStandardMaterial({ color: top, roughness: 0.9, metalness: 0.1 });
  const mTrim = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.5, metalness: 0.5 });
  const K = arenaKit();
  chosen.forEach((p, i) => {
    const tall = i % 2 === 1;   // every other one carries an upper deck
    const { sx, sz } = p, H = PERCH.half;
    perch(K, p.x, p.z, H, PERCH.deck, { mBody, mTop, mTrim });
    board(K, p.x + sx * (H + 0.12), p.z + sz * (H + 0.12), sx, sz, H, 0, PERCH.deck, mBody);   // (just outside the deck's edge: a body pressed to it has its head clear of the deck)
    K.box(p.x + sx * (H + 1.5), p.z + sz * (H + 1.5), 1.2, 1.2, PERCH.step, mBody);   // the way up
    K.deco(new THREE.BoxGeometry(2.44, 0.08, 2.44), mTrim, p.x + sx * (H + 1.5), PERCH.step + 0.02, p.z + sz * (H + 1.5));
    K.box(p.x + sx * (H + 3.7), p.z + sz * (H + 3.7), 1.0, 1.0, PERCH.low, mTop);   // ...and a low step up to it, a vault from a run
    K.deco(new THREE.BoxGeometry(2.04, 0.08, 2.04), mTrim, p.x + sx * (H + 3.7), PERCH.low + 0.02, p.z + sz * (H + 3.7));
    if (tall){   // the upper deck stands on the outer half of the low one, on its own two posts
      const ux = p.x - sx * (H - PERCH.upper), uz = p.z - sz * (H - PERCH.upper);
      perch(K, ux, uz, PERCH.upper, PERCH.high, { mBody, mTop, mTrim }, PERCH.deck);
      board(K, ux + sx * (PERCH.upper + 0.12), uz + sz * (PERCH.upper + 0.12), sx, sz, PERCH.upper, PERCH.deck, PERCH.high, mBody);
    }
  });
  shared.perches = chosen.map(p => ({ x: p.x, z: p.z }));
  shared.perchSteps = chosen.map(p => ({ x: p.x + p.sx * (PERCH.half + 1.5), z: p.z + p.sz * (PERCH.half + 1.5) }));   // (the crates: for tests)
  return chosen.length;
}

/* the BOARD under a deck's climbing edge, from `y0` up to its underside: a solid face, so whoever stands on the crate (or
   the deck below) meets a ledge to pull up onto instead of walking in under the deck. The other sides stay open. */
function board(K, x, z, sx, sz, h, y0, y1, mat){
  const hx = sx ? 0.12 : h, hz = sx ? h : 0.12;
  K.deco(new THREE.BoxGeometry(hx * 2, y1 - y0, hz * 2), mat, x, y0 + (y1 - y0) / 2, z);
  if (y0) K.slab(x, z, hx, hz, y0, y1);
  else solids.push({ x, z, hx, hz, h: y1, box: true });
}

/* one deck: a slab `top` m up on four corner posts that stand on `base` (the floor, or the deck below) */
function perch(K, x, z, h, top, m, base = 0){
  K.slab(x, z, h, h, top - lip, top);
  K.deco(new THREE.BoxGeometry(h * 2, lip, h * 2), m.mTop, x, top - lip / 2, z);
  K.deco(new THREE.BoxGeometry(h * 2 + 0.08, 0.1, h * 2 + 0.08), m.mTrim, x, top - lip - 0.04, z);   // the deck's edge
  const pr = 0.2, ins = h - 0.3;
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]){
    const px = x + a * ins, pz = z + b * ins, ph = top - lip - base;
    if (base){   // stands on the deck below: solid from that deck up, open air under it
      K.deco(new THREE.CylinderGeometry(pr, pr, ph, 6), m.mBody, px, base + ph / 2, pz);
      K.slab(px, pz, pr, pr, base, top - lip);
      continue;
    }
    K.column(px, pz, pr, ph, m.mBody, { taper: 1, seg: 6, wallKick: false });
  }
  // a low rail on two sides, so the deck reads as a platform from below (a picture: it stops nothing)
  for (const s of [-1, 1]){
    const rail = K.deco(new THREE.BoxGeometry(h * 2, 0.08, 0.08), m.mTrim, x, top + 0.55, z + s * (h - 0.06));
    rail.userData.passThrough = true;
  }
}
