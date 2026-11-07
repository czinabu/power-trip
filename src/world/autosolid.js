// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AUTO SOLIDS: the safety net under every hand-placed collider. Once an arena is built (world/arena.js, in every mode
// that builds one: story, survival, sandbox, training, co-op, the hubs), and for each of an open zone's chunks and the
// secrets' props, every solid-looking mesh is checked against the collision `solids`, and wherever its body stands
// somewhere the collision doesn't, a collider is added for that part of it. So nothing you can see standing in the play
// space is a picture you walk (or a foe paths, or a bolt flies) through, whoever built it.
//
// OPT OUT: a mesh (or a group above it) with userData.passThrough (or noSolid) is decoration: ferns, canopies, cloth,
// holograms, signs, rails meant to be passed. Glows (additive), see-through (opacity < 0.9) and inside-out (BackSide)
// materials, anything flat on the floor and thin poles and wires are never solid either. Live props (userData.noBake:
// ships that lift off, hovering remotes) and the traffic overhead keep their own collision.
//
// How: each mesh's triangles are laid onto a STEP grid over its footprint inside the playable rectangle: at every cell
// the highest face looking up is its visible top, the lowest face looking down its underside (what a ray down and a ray
// up would meet). A cell the existing solids already hold (their top within SINK of that top) is fine. Any other, low
// enough to walk into, gets a collider standing to that top; up past head height, an overhead SLAB (solid from its
// underside up: walked under, stood on). The uncovered cells are merged into as few axis-aligned boxes as fit them (a
// rotated wall comes out as a short staircase of boxes), each one tagged `auto`. tools/collision-audit.js reports how
// many each map needed: a builder that needs many should give its props their own colliders instead.

import * as THREE from 'three';
import { shared, solids } from '../state.js';
import { moundY, STEP_UP } from './collision.js';

export const AUTO = {
  step: 0.4,        // sample spacing (m): the size of an auto collider's cells
  sink: 0.3,        // a visible top this far over the collision under it is uncovered (thin caps and trims sit under it)
  pad: 0.1,         // a sample this close to a solid's footprint counts as held by it
  low: 0.3,         // tops lower than this are ankle clutter: walked over
  head: 1.9,        // an underside above this is overhead (walked under): it becomes a slab
  reach: 16,        // overhead pieces higher than this are out of anyone's reach
  thin: 0.19,       // a mesh narrower than this (m) either way is a pole, a wire, a blade of a rail (the audit: under 0.2)
  band: 0.25,       // tops within this of each other merge into one box (its top the highest of them)
  slabBand: 1.0,    // …an overhead slab's, more loosely (its underside the lowest of them)
  maxSamples: 60000,// a mesh bigger than this many samples is a ground plate or a skyline piece, not a prop
};

export const autoStats = { ms: 0, runs: 0 };   // time spent (the collision audit and the maps smoke test print it)

/* the solids, bucketed on a coarse grid so a lookup only reads the ones nearby (an open zone holds a thousand). Each
   bucket keeps the list's own order (a raised slab only counts once something under it has: solidTop) */
const BUCKET = 4;
function bucketOf(list){
  const m = new Map(), add = c => {
    const ex = c.mound ? Math.max(c.a, c.b) : c.box ? c.hx : c.r, ez = c.mound ? Math.max(c.a, c.b) : c.box ? c.hz : c.r;
    const pad = AUTO.pad + 0.01;
    for (let i = Math.floor((c.x - ex - pad) / BUCKET); i <= Math.floor((c.x + ex + pad) / BUCKET); i++)
      for (let j = Math.floor((c.z - ez - pad) / BUCKET); j <= Math.floor((c.z + ez + pad) / BUCKET); j++){
        const k = i * 100003 + j; let a = m.get(k); if (!a) m.set(k, a = []); a.push(c);
      }
  };
  for (const c of list) add(c);
  return { near: (x, z) => m.get(Math.floor(x / BUCKET) * 100003 + Math.floor(z / BUCKET)) || NONE, add };
}
const NONE = [];

/* the collision top under (x, z) as a body standing there meets it (pad: how far past a footprint still holds you) */
function solidTop(x, z, pad, list){
  let g = 0;
  for (const c of list){
    if (c.mound){ const y = moundY(c, x, z); if (y > g) g = y; continue; }
    if (c.h <= g) continue;
    const inside = c.box ? Math.abs(x - c.x) <= c.hx + pad && Math.abs(z - c.z) <= c.hz + pad : Math.hypot(x - c.x, z - c.z) <= c.r + pad;
    if (inside && (c.y0 ?? 0) <= g + 0.01) g = c.h;   // a raised slab only counts once you're on something under it
  }
  return g;
}
/* the top of a raised slab over (x, z) whose underside sits near `under` (an overhead piece already held up there) */
function slabTop(x, z, pad, under, list){
  let g = -1;
  for (const c of list){
    if (!c.y0 || c.y0 > under + 0.6) continue;
    const inside = c.box ? Math.abs(x - c.x) <= c.hx + pad && Math.abs(z - c.z) <= c.hz + pad : Math.hypot(x - c.x, z - c.z) <= c.r + pad;
    if (inside && c.h > g) g = c.h;
  }
  return g;
}

/* lay a mesh's triangles onto the grid cells [i0..i1] × [j0..j1] (cell (i, j) centred at ((i + ½)S, (j + ½)S)): per
   cell the highest point of a face looking up (top) and the lowest of a face looking down (under). A double-sided
   material counts every face both ways. Returns { top, under } as Float32Arrays (−Infinity / +Infinity where none) */
const _v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
function rasterize(mesh, i0, i1, j0, j1, S, ox, oz){
  const W = i1 - i0 + 1, H = j1 - j0 + 1, top = new Float32Array(W * H).fill(-Infinity), under = new Float32Array(W * H).fill(Infinity);
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count, mw = mesh.matrixWorld;
  const both = mesh.material.side === THREE.DoubleSide, flip = mw.determinant() < 0;
  const wp = new Float32Array(pos.count * 3);
  for (let k = 0; k < pos.count; k++){ _v[0].fromBufferAttribute(pos, k).applyMatrix4(mw); wp[k*3] = _v[0].x; wp[k*3+1] = _v[0].y; wp[k*3+2] = _v[0].z; }
  for (let t = 0; t + 2 < n; t += 3){
    const a = (idx ? idx.getX(t) : t) * 3, b = (idx ? idx.getX(t + 1) : t + 1) * 3, c = (idx ? idx.getX(t + 2) : t + 2) * 3;
    const ax = wp[a], ay = wp[a+1], az = wp[a+2], bx = wp[b], by = wp[b+1], bz = wp[b+2], cx = wp[c], cy = wp[c+1], cz = wp[c+2];
    // the face's normal, up or down (counter-clockwise front faces, as three.js draws them)
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (flip) ny = -ny;
    const det = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);   // twice the signed area seen from above
    if (Math.abs(det) < 1e-9) continue;                            // a wall face, edge on from above: the top and bottom faces carry it
    const up = ny > 0, down = ny < 0;
    const ci0 = Math.max(i0, Math.ceil((Math.min(ax, bx, cx) - ox) / S - 0.5)), ci1 = Math.min(i1, Math.floor((Math.max(ax, bx, cx) - ox) / S - 0.5));
    const cj0 = Math.max(j0, Math.ceil((Math.min(az, bz, cz) - oz) / S - 0.5)), cj1 = Math.min(j1, Math.floor((Math.max(az, bz, cz) - oz) / S - 0.5));
    for (let i = ci0; i <= ci1; i++){
      const x = (i + 0.5) * S + ox;
      for (let j = cj0; j <= cj1; j++){
        const z = (j + 0.5) * S + oz;
        const u = ((x - ax) * (cz - az) - (cx - ax) * (z - az)) / det, v = ((bx - ax) * (z - az) - (x - ax) * (bz - az)) / det;
        if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
        const y = ay + u * (by - ay) + v * (cy - ay), k = (j - j0) * W + (i - i0);
        if ((up || both) && y > top[k]) top[k] = y;
        if ((down || both) && y < under[k]) under[k] = y;
      }
    }
  }
  return { top, under, W };
}

/* is this mesh decoration by its own say-so, or by what it's made of? */
function decoration(o){
  for (let p = o.parent; p; p = p.parent) if (p.userData && (p.userData.passThrough || p.userData.noSolid)) return true;
  const m = o.material;
  if (!m || Array.isArray(m)) return !m;
  if (m.side === THREE.BackSide || m.blending === THREE.AdditiveBlending) return true;
  if (m.transparent && m.opacity < 0.9) return true;
  if (m.wireframe || m.visible === false) return true;
  return false;
}

/* the solid-looking meshes under `root` (props only: no floors, decals, poles, glows or pictures). The backdrop (the
   world past the edge, userData.backdrop) is skipped whole: its hills that run in over the play space carry their own
   ground (world/backdrop.js), and the collision audit checks the rest of it stands outside. So is a LIVE prop
   (userData.noBake: a ship that lifts off, a hovering remote, a lamp that flickers) unless `live` asks for it: what moves
   keeps its own collision with it (propSolids, for one that stands still once it's placed; or userData.solidify on a
   live prop that never moves, so the arena's pass covers it) */
export function solidMeshes(root, live = false){
  const list = [];
  root.updateMatrixWorld(true);
  const walk = o => {
    if (!o.visible || (o.userData && (o.userData.backdrop || o.userData.passThrough || o.userData.noSolid))) return;
    if (!live && o !== root && o.userData.noBake && !o.userData.solidify) return;   // a live prop (it lifts off, hovers, turns): it carries its own collision
    for (const k of o.children) walk(k);
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || decoration(o)) return;
    const b = new THREE.Box3().setFromObject(o, true);   // (precise: a turned prop's box hugs it, so a round one reads round)
    if (b.isEmpty() || b.max.y < AUTO.low) return;                                          // floor, decals, flat inlays
    if (b.max.x - b.min.x < AUTO.thin || b.max.z - b.min.z < AUTO.thin) return;             // poles, wires, thin rails
    list.push({ o, b });
  };
  walk(root);
  return list;
}

/* merge a grid of cells (key "i,j" → { top, y0, step }) into as few rectangles as cover it, cells of one band each */
function rects(cells){
  const out = [], left = new Map(cells);
  const keys = [...left.keys()].map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [i0, j0] of keys){
    const c0 = left.get(i0 + ',' + j0); if (!c0) continue;
    // a wall's tops within `band` of each other; a slab's (seen from under, landed on from over) more loosely
    const fits = c => c && !c.y0 === !c0.y0 && (c0.y0 ? Math.abs(c.y0 - c0.y0) <= 0.5 && Math.abs(c.top - c0.top) <= AUTO.slabBand : Math.abs(c.top - c0.top) <= AUTO.band);
    let i1 = i0; while (fits(left.get((i1 + 1) + ',' + j0))) i1++;
    let j1 = j0;
    for (;;){
      let row = true;
      for (let i = i0; i <= i1 && row; i++) row = fits(left.get(i + ',' + (j1 + 1)));
      if (!row) break; j1++;
    }
    let top = 0, y0 = Infinity, step = true;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ const k = i + ',' + j, c = left.get(k); top = Math.max(top, c.top); y0 = Math.min(y0, c.y0); step = step && !!c.step; left.delete(k); }
    out.push({ i0, i1, j0, j1, top, y0, step });
  }
  return out;
}

/* ONE ROUND COLLIDER for a mesh's uncovered cells, if it fits them: every cell inside the circle round the mesh's
   middle (its radius the footprint's half width), and the circle no bigger than the mesh (nearly every cell inside it
   is the mesh's own). An overhead slab if every cell is one, otherwise a wall. Returns the column, or null */
function roundFit(cells, R, b, i0, j0, S, ox, oz){
  const hx = (b.max.x - b.min.x) / 2, hz = (b.max.z - b.min.z) / 2;
  if (Math.abs(hx - hz) > Math.max(0.25, 0.12 * Math.max(hx, hz))) return null;   // not round from above
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, r = Math.min(hx, hz);
  let top = 0, y0 = Infinity, slab = null, step = true;
  for (const [k, c] of cells){
    const [i, j] = k.split(',').map(Number);
    if (Math.hypot((i + 0.5) * S + ox - cx, (j + 0.5) * S + oz - cz) > r + S * 0.75) return null;   // a cell past the circle
    slab = (slab ?? true) && !!c.y0;   // (any cell standing from below makes it a wall: a statue's robe over the lip of its plinth)
    top = Math.max(top, c.top); y0 = Math.min(y0, c.y0); step = step && !!c.step;
  }
  let inside = 0, mesh = 0;
  for (let i = Math.ceil((cx - r - ox) / S - 0.5); i <= Math.floor((cx + r - ox) / S - 0.5); i++)
    for (let j = Math.ceil((cz - r - oz) / S - 0.5); j <= Math.floor((cz + r - oz) / S - 0.5); j++){
      if (Math.hypot((i + 0.5) * S + ox - cx, (j + 0.5) * S + oz - cz) > r - S * 0.5) continue;
      inside++;
      const k = (j - j0) * R.W + (i - i0);
      if (i >= i0 && j >= j0 && k < R.top.length && i - i0 < R.W && R.top[k] > -Infinity) mesh++;
    }
  if (inside < 4 || mesh < inside * 0.9) return null;                    // a ring, an arch, a hollow: the boxes fit it better
  const c = { x: cx, z: cz, r: +r.toFixed(2), h: +top.toFixed(2), auto: true };
  if (slab) c.y0 = y0; else if (step) c.climbable = true;
  return c;
}

/* the shift that puts a cell's middle on x */
const shiftTo = (x, S) => x - (Math.floor(x / S) + 0.5) * S;

/* AUTO SOLIDS over everything under `root`: adds a collider for every part of a solid-looking mesh the collision
   doesn't hold yet, into `list` (the arena's `solids` by default). bounds: the play rectangle's half sizes (only what
   stands inside it is reachable). Returns the colliders it added, each with `auto` and the mesh it stands for. */
export function autoSolids(root, o = {}){
  const list = o.list || solids, hx = o.hx ?? shared.arenaHalf - 1, hz = o.hz ?? shared.arenaHalfZ - 1;
  const S = AUTO.step, added = [], t0 = performance.now();
  const meshes = solidMeshes(root, !!o.live);
  const near = meshes.length ? bucketOf(list) : null;
  for (const { o: mesh, b } of meshes){
    const x0 = Math.max(b.min.x, -hx), x1 = Math.min(b.max.x, hx), z0 = Math.max(b.min.z, -hz), z1 = Math.min(b.max.z, hz);
    if (x0 >= x1 || z0 >= z1) continue;                                     // wholly outside the play space
    if ((x1 - x0) * (z1 - z0) / (S * S) > AUTO.maxSamples) continue;
    if (b.min.y > AUTO.reach) continue;                                       // out of anyone's reach
    // cells on a grid anchored to the world (so neighbouring meshes' cells line up), except across a prop thinner than two
    // cells (a plate, a slab wall): there the grid is shifted to run down its middle, so no row of cells falls either side of it
    const ox = b.max.x - b.min.x < 2 * S ? shiftTo((b.min.x + b.max.x) / 2, S) : 0, oz = b.max.z - b.min.z < 2 * S ? shiftTo((b.min.z + b.max.z) / 2, S) : 0;
    const i0 = Math.ceil((x0 - ox) / S - 0.5), i1 = Math.floor((x1 - ox) / S - 0.5), j0 = Math.ceil((z0 - oz) / S - 0.5), j1 = Math.floor((z1 - oz) / S - 0.5);
    if (i0 > i1 || j0 > j1) continue;
    // cheap first: is every cell already held up to the mesh's highest point?
    let held = true;
    for (let i = i0; i <= i1 && held; i++) for (let j = j0; j <= j1 && held; j++){
      const x = (i + 0.5) * S + ox, z = (j + 0.5) * S + oz;
      if (solidTop(x, z, AUTO.pad, near.near(x, z)) < b.max.y - AUTO.sink) held = false;
    }
    if (held) continue;
    const R = rasterize(mesh, i0, i1, j0, j1, S, ox, oz), cells = new Map();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++){
      const k = (j - j0) * R.W + (i - i0), top = R.top[k];
      if (!(top >= AUTO.low)) continue;                                       // the mesh doesn't cover this spot, or barely rises
      const x = (i + 0.5) * S + ox, z = (j + 0.5) * S + oz, here = near.near(x, z);
      const under = Math.max(0, R.under[k] === Infinity ? 0 : Math.min(R.under[k], top));
      const base = solidTop(x, z, AUTO.pad, here);                            // what a body under it stands on
      if (base >= top - AUTO.sink) continue;                                  // held already
      if (under - base > AUTO.head){                                          // overhead (a body fits under it): held once you're up there?
        if (under > AUTO.reach) continue;
        if (slabTop(x, z, AUTO.pad, under, here) >= top - AUTO.sink) continue;
        cells.set(i + ',' + j, { top, y0: Math.round(under * 4) / 4 });
        continue;
      }
      // standing on the floor or on something solid (a statue on its plinth), or too low over it to pass under: a wall to its top
      cells.set(i + ',' + j, { top, y0: 0, step: top - base <= STEP_UP + 0.1 });
    }
    if (!cells.size) continue;
    // a round prop (a column, a dome, a drum) gets one round collider instead of a staircase of boxes, when one fits it
    const col = roundFit(cells, R, b, i0, j0, S, ox, oz);
    if (col){
      Object.defineProperty(col, 'mesh', { value: mesh, enumerable: false });
      list.push(col); added.push(col); near.add(col);
      continue;
    }
    for (const r of rects(cells)){
      const c = { x: (r.i0 + r.i1 + 1) * S / 2 + ox, z: (r.j0 + r.j1 + 1) * S / 2 + oz, hx: (r.i1 - r.i0 + 1) * S / 2, hz: (r.j1 - r.j0 + 1) * S / 2,
                  h: +r.top.toFixed(2), box: true, auto: true };
      if (r.y0) c.y0 = r.y0;
      else if (r.step) c.climbable = true;   // a low step up from what's under it (the floor, a dais, a deck): walked up onto, never a wall
      Object.defineProperty(c, 'mesh', { value: mesh, enumerable: false });  // (for the audit's report; never sent over the wire)
      list.push(c); added.push(c); near.add(c);
    }
  }
  autoStats.ms += performance.now() - t0; autoStats.runs++;
  return added;
}

/* the colliders of a live prop (a mission console, a secret's rocks): built on their own list, so they come and go with
   the prop. Returns them; the caller adds them to `solids` and takes them out again (dropSolids) */
export function propSolids(root, o = {}){
  return autoSolids(root, { live: true, ...o, list: o.list || [...solids], hx: o.hx ?? 1e6, hz: o.hz ?? 1e6 });
}
export function dropSolids(list){
  if (!list || !list.length) return;
  const gone = new Set(list);
  for (let i = solids.length - 1; i >= 0; i--) if (gone.has(solids[i])) solids.splice(i, 1);
}
