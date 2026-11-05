// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SPREAD: build an authored arena wider than it was laid out, the way the temple and the foundry spread their plans
// (data/map-scale.js SPREAD lists which layouts, at what size they were authored). The builder runs at its authored
// size; then everything it put down is pulled apart from the middle by S (the built width over the authored one) while
// every piece keeps its own size, so lanes, yards and the gaps between buildings grow and the props stay the scale of
// a body. A structure moves as one: props whose footprints touch (a hull and its bridge, a crate stack, the walls of a
// kill house and the doors in them) are a CLUSTER and shift together by S × their middle, so nothing comes apart.
// Pieces that span the room (a deck's side walls, ribs overhead, a crane's beam) stretch along their length instead.
//
// Every point a story mission uses on the map goes through the same move (spreadAt below; game/mission.js spreads its
// def when it starts): a point on or beside a structure moves with that structure, a point in the open is pulled
// apart like the open floor. The move is worked out from the build alone (no randomness), so co-op screens agree.

import * as THREE from 'three';
import { shared, solids, pillars, barrels, vents, hazardZones } from '../state.js';

const SPAN = 0.35;   // a piece longer than this share of the authored width, overhead or along the edge, spans the room: it stretches
const TOUCH = 0.3;   // footprints this close (m) belong to the same structure
const NEAR = 2;      // a point this close to a structure's footprint moves with it

/* the counts before an arena builder runs: spreadBuilt moves only what was added after */
export function spreadMark(){
  return { kids: shared.arenaGroup.children.length, solids: solids.length, pillars: pillars.length, barrels: barrels.length,
           vents: vents.length, zones: hazardZones.length, doors: (shared.doors || []).length };
}

const _b = new THREE.Box3(), _q = new THREE.Quaternion(), _v = new THREE.Vector3();

export function spreadBuilt(S, W, mark){
  shared.spreadAt = null;
  if (!(S > 1.001)) return;
  const g = shared.arenaGroup, span = W * SPAN;
  const items = [];   // { x0, x1, z0, z1, move(dx, dz) }
  const loose = [];   // things that follow a point (floor decals): { x, z, move }
  const stretch = (cx, cz, alongX, apply) => apply((S - 1) * cx, (S - 1) * cz, alongX);
  // ---- the meshes the builder added ----
  for (let i = mark.kids; i < g.children.length; i++){
    const m = g.children[i];
    _b.setFromObject(m);
    if (_b.isEmpty()) continue;
    const cx = (_b.min.x + _b.max.x) / 2, cz = (_b.min.z + _b.max.z) / 2, w = _b.max.x - _b.min.x, d = _b.max.z - _b.min.z;
    // a piece across the room (overhead, flat on the floor, or along the room's edge) stretches along its length; a long
    // wall standing in the room (a kill house's front) is part of its structure and moves with it
    const across = Math.max(w, d) >= span && (_b.min.y >= 2.5 || _b.max.y < 0.15 || Math.abs(w >= d ? cz : cx) >= W * 0.45);
    if (across){
      stretch(cx, cz, w >= d, (dx, dz, ax) => {
        m.position.x += dx; m.position.z += dz;
        m.getWorldQuaternion(_q).invert();
        _v.set(ax ? 1 : 0, 0, ax ? 0 : 1).applyQuaternion(_q);
        const a = Math.abs(_v.x), b = Math.abs(_v.y), c = Math.abs(_v.z);
        if (a > 0.95) m.scale.x *= S; else if (b > 0.95) m.scale.y *= S; else if (c > 0.95) m.scale.z *= S;
      });
      continue;
    }
    const move = (dx, dz) => { m.position.x += dx; m.position.z += dz; };
    if (_b.max.y < 0.15){ loose.push({ x: cx, z: cz, move }); continue; }   // paint and scatter on the floor
    items.push({ x0: _b.min.x, x1: _b.max.x, z0: _b.min.z, z1: _b.max.z, move });
  }
  // ---- their collision ----
  for (let i = mark.solids; i < solids.length; i++){
    const c = solids[i], ex = c.box ? c.hx : c.r, ez = c.box ? c.hz : c.r;
    if (c.box && Math.max(ex, ez) * 2 >= span && ((c.y0 || 0) >= 2.5 || Math.abs(ex >= ez ? c.z : c.x) >= W * 0.45)){
      const ax = ex >= ez;
      c.x *= S; c.z *= S; if (ax) c.hx *= S; else c.hz *= S;
      continue;
    }
    items.push({ x0: c.x - ex, x1: c.x + ex, z0: c.z - ez, z1: c.z + ez, move: (dx, dz) => { c.x += dx; c.z += dz; } });
  }
  // ---- structures: footprints that touch are one cluster (union–find) ----
  const n = items.length, up = items.map((_, k) => k);
  const root = k => { while (up[k] !== k){ up[k] = up[up[k]]; k = up[k]; } return k; };
  for (let a = 0; a < n; a++){
    const A = items[a];
    for (let b = a + 1; b < n; b++){
      const B = items[b];
      if (A.x0 - TOUCH > B.x1 || B.x0 - TOUCH > A.x1 || A.z0 - TOUCH > B.z1 || B.z0 - TOUCH > A.z1) continue;
      const ra = root(a), rb = root(b); if (ra !== rb) up[ra] = rb;
    }
  }
  const groups = new Map();
  for (let k = 0; k < n; k++){
    const r = root(k), it = items[k];
    let G = groups.get(r);
    if (!G) groups.set(r, G = { x0: it.x0, x1: it.x1, z0: it.z0, z1: it.z1, members: [] });
    G.x0 = Math.min(G.x0, it.x0); G.x1 = Math.max(G.x1, it.x1); G.z0 = Math.min(G.z0, it.z0); G.z1 = Math.max(G.z1, it.z1);
    G.members.push(it);
  }
  const clusters = [...groups.values()];
  for (const G of clusters){
    G.dx = (S - 1) * (G.x0 + G.x1) / 2; G.dz = (S - 1) * (G.z0 + G.z1) / 2;
    for (const it of G.members) it.move(G.dx, G.dz);
  }
  // ---- where a point lands: with the structure it stands on or beside, or pulled apart with the open floor. A point
  // near more than one structure takes the first move (nearest first, then the open floor's) that doesn't put it
  // inside a solid; one that was inside a solid as authored (a foe's post behind a crate) keeps the nearest ----
  const built = solids.filter(c => !c.mound && !((c.y0 || 0) > 0.3) && c.h > 0.55 && !c.climbable);
  const inside = (x, z) => built.some(c => c.box ? Math.abs(x - c.x) < c.hx + 0.3 && Math.abs(z - c.z) < c.hz + 0.3 : Math.hypot(x - c.x, z - c.z) < c.r + 0.3);
  const at = (x, z) => {
    const near = [];
    for (const G of clusters){
      const d = Math.hypot(Math.max(0, G.x0 - x, x - G.x1), Math.max(0, G.z0 - z, z - G.z1));
      if (d <= NEAR) near.push([d, x + G.dx, z + G.dz]);
    }
    near.sort((a, b) => a[0] - b[0]);
    near.push([NEAR, x * S, z * S]);
    for (const [, px, pz] of near) if (!inside(px, pz)) return [px, pz];
    return [near[0][1], near[0][2]];
  };
  const memo = new Map();   // (one answer per point, whatever is built after: the cover pass, the perches)
  shared.spreadAt = (x, z) => { const k = x + ',' + z; if (!memo.has(k)) memo.set(k, at(x, z)); return memo.get(k); };
  for (const f of loose){ const [x, z] = at(f.x, f.z); f.move(x - f.x, z - f.z); }
  // ---- the live things the builder placed: pillars (wall-kick columns), drums, vents, hazard zones, doors ----
  for (let i = mark.pillars; i < pillars.length; i++){ const p = pillars[i], [x, z] = at(p.x, p.z); p.x = x; p.z = z; }
  for (let i = mark.barrels; i < barrels.length; i++){ const p = barrels[i].mesh.position, [x, z] = at(p.x, p.z); p.x = x; p.z = z; }
  for (let i = mark.vents; i < vents.length; i++){ const p = vents[i].group.position, [x, z] = at(p.x, p.z); p.x = x; p.z = z; }
  for (let i = mark.zones; i < hazardZones.length; i++){ const h = hazardZones[i], [x, z] = at(h.cx, h.cz); h.cx = x; h.cz = z; }
  const doors = shared.doors || [];
  for (let i = mark.doors; i < doors.length; i++){ const d = doors[i]; if (d.at) d.at = at(d.at[0], d.at[1]); }
}

/* number pairs in a mission's data that are not places on the floor (angles, timings, ranges) */
export const NOT_PLACES = ['level', 'from', 'lanes', 'every', 'pace', 'spd', 'dmg', 'first', 'len', 'w', 'r0', 'aim', 'period', 'a'];

/* a copy of `o` with every place in it ([x, z, …]: a start, a zone, a console, a path) passed through f(x, z) */
export function mapPlaces(o, f){
  if (Array.isArray(o)){
    if (o.length >= 2 && typeof o[0] === 'number' && typeof o[1] === 'number' && Math.abs(o[0]) < 200 && Math.abs(o[1]) < 400){
      const [x, z] = f(o[0], o[1]); return [x, z, ...o.slice(2)];
    }
    return o.map(v => mapPlaces(v, f));
  }
  if (!o || typeof o !== 'object') return o;
  const r = {};
  for (const k in o) r[k] = NOT_PLACES.includes(k) ? o[k] : mapPlaces(o[k], f);
  return r;
}

/* a story mission's data, spread to the arena that was just built (an arena that isn't spread gives it back as it is) */
export const spreadDef = (def) => shared.spreadAt ? mapPlaces(def, shared.spreadAt) : def;
