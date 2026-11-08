// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ZONE STREAMER: an open zone (data/zones.js) built in pieces. world/arena.js hands every zo* layout here.
//
//   · THE PLAN (world/zones/jedha-plan.js, ruins-plan.js) is rolled once per zone: every piece of the city as plain data.
//   · SOLIDS: every piece's collision goes into `solids` at once, so the whole zone collides from the first frame (foes
//     a long way from anyone, a hero fast-travelling across it: nothing ever falls through a wall that isn't built yet).
//   · CHUNKS: the zone is cut into squares (Z.chunk metres across); a chunk's meshes are built, inked and merged
//     (world/ink.js bakeArena) when a camera it serves comes within ZONE_TUNE.build of it, and thrown away when every one
//     is past ZONE_TUNE.drop: geometry freed, its camera props let go (world/camblock.js dropProps). At most
//     ZONE_TUNE.perFrame are built a frame, nearest first. On Low quality the reach is shorter, and the fog with it.
//   · THE SKYLINE: the few landmarks you steer by (the temple's dome and minarets, the shrines' broken tower, the
//     garrison's mast) are built once with the arena and never dropped, so the city reads from anywhere.
// Each browser streams round its own camera; in co-op the host also keeps the chunks round every hero its foes fight, so
// a foe's cover is drawn where a guest can see it (the guest's own screen builds them for itself anyway).

import * as THREE from 'three';
import { shared, solids, pillars } from '../state.js';
import { camera, scene } from '../engine/renderer.js';
import { bakeArena } from './ink.js';
import { autoSolids } from './autosolid.js';
import { propOwner, dropProps } from './camblock.js';
import { KINDS, zoneMats, meshKit } from './zones/zone-kit.js';
import { planJedha } from './zones/jedha-plan.js';
import { planRuins } from './zones/ruins-plan.js';
import { ZONE_TUNE as T, zoneByLayout } from '../data/zones.js';
import { qualityLevel } from '../engine/quality.js';

const PLANS = { zoJedha: planJedha, zoRuins: planRuins };
const planCache = new Map();
let RAW = false;   // the collision audit (tools/collision-audit.js): every chunk built at once, unbaked, so each prop is its own mesh
const ZS = { on: false, Z: null, n: 0, size: 0, chunk: 0, chunks: [], root: null, M: null, ink: 0.045, built: 0, extra: [], stats: { builds: 0, drops: 0, ms: 0 } };

export const zoneStream = () => ZS;
export const zoneStreaming = () => ZS.on;

/* world/arena.js: build an open zone's arena (its floor, sky and backdrop are the world's, built by buildWorld already).
   opts.raw (the collision audit): every chunk, unbaked */
export function buildZoneArena(L, opts = {}){
  RAW = !!opts.raw || !!shared.auditBuild;
  const Z = zoneByLayout(L.layout), plan = Z && planOf(L.layout, Z);
  if (!plan) return;
  ZS.on = true; ZS.Z = Z; ZS.size = Z.size; ZS.chunk = Z.chunk; ZS.n = Math.ceil(Z.size / Z.chunk);
  ZS.M = zoneMats(L.pal || {}); ZS.ink = L.ink ?? 0.045; ZS.built = 0; ZS.extra = []; ZS.stats = { builds: 0, drops: 0, ms: 0, autoMs: 0 };
  // every chunk's list of pieces (a piece belongs to the chunk its middle stands in)
  const half = Z.size / 2;
  ZS.chunks = [];
  for (let j = 0; j < ZS.n; j++) for (let i = 0; i < ZS.n; i++){
    const x0 = -half + i * Z.chunk, z0 = -half + j * Z.chunk;
    ZS.chunks.push({ i, j, x0, z0, x1: x0 + Z.chunk, z1: z0 + Z.chunk, pieces: [], grp: null, key: { chunk: i + ',' + j } });
  }
  const sky = new THREE.Group();
  sky.name = 'zone-skyline';
  const KS = meshKit(sky, ZS.M);
  for (const p of plan.pieces){
    const K = KINDS[p.t]; if (!K) continue;
    K.solids(p, solids);
    if (p.t === 'column' || p.t === 'tower' || p.t === 'minaret') pillars.push({ x: p.x, z: p.z, r: p.r, h: p.h });   // (wall-kick posts)
    if (p.sky){ K.mesh(p, KS); continue; }
    chunkAt(p.x, p.z).pieces.push(p);
  }
  // the auto colliders (world/autosolid.js) for the whole zone, worked out now from each chunk's meshes (built, read and
  // thrown away), so the city collides and paths everywhere from the first frame, like its own solids
  if (!shared.noAutoSolids){
    const t0 = performance.now();
    for (const c of ZS.chunks){
      if (!c.pieces.length) continue;
      const g = new THREE.Group(), K = meshKit(g, ZS.M);
      for (const p of c.pieces) KINDS[p.t].mesh(p, K);
      c.auto = autoSolids(g);
      if (shared.autoSolids) shared.autoSolids.push(...c.auto);
      g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    ZS.stats.autoMs = performance.now() - t0;
  }
  shared.arenaGroup.add(sky);   // (baked with the arena: it never leaves)
  ZS.root = new THREE.Group(); ZS.root.name = 'zone-chunks'; ZS.root.userData.noBake = true;   // (each chunk bakes itself as it's built)
  shared.arenaGroup.add(ZS.root);
  // the streets round where everyone lands are in before the first frame
  const [sx, sz] = Z.spawn;
  for (const c of ZS.chunks) if (RAW || rectDist(c, sx, sz) <= T.warm) buildChunk(c);
}
export function clearZoneStream(){ ZS.on = false; ZS.Z = null; ZS.chunks = []; ZS.root = null; ZS.extra = []; }

// the plan of the zone being played (or of `Z`): every piece as plain data (the map draws its streets from it: ui/zone-map-art.js)
export const zonePlan = (Z = ZS.Z) => Z ? planOf(Z.level.layout, Z) : null;
function planOf(layout, Z){
  if (!planCache.has(layout)){ const f = PLANS[layout]; planCache.set(layout, f ? f(Z) : null); }
  return planCache.get(layout);
}
function chunkAt(x, z){
  const half = ZS.size / 2, i = Math.max(0, Math.min(ZS.n - 1, Math.floor((x + half) / ZS.chunk))), j = Math.max(0, Math.min(ZS.n - 1, Math.floor((z + half) / ZS.chunk)));
  return ZS.chunks[j * ZS.n + i];
}
const rectDist = (c, x, z) => Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.z0 - z, 0, z - c.z1));

function buildChunk(c){
  if (c.grp || !ZS.root) return;
  const t0 = performance.now();
  const g = new THREE.Group(); g.name = 'zone-chunk-' + c.key.chunk;
  const K = meshKit(g, ZS.M);
  for (const p of c.pieces) KINDS[p.t].mesh(p, K);
  ZS.root.add(g);
  if (!RAW){ propOwner(c.key); try { bakeArena(g, ZS.ink); } finally { propOwner(null); } }
  c.grp = g; ZS.built++; ZS.stats.builds++; ZS.stats.ms = performance.now() - t0;
}
function dropChunk(c){
  if (!c.grp) return;
  c.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  c.grp.parent && c.grp.parent.remove(c.grp);
  dropProps(c.key);
  c.grp = null; ZS.built--; ZS.stats.drops++;
}

/* more cameras to stream for (co-op host: the other heroes, so their fights stand in a built street): [{ x, z }] */
export function zoneStreamExtra(list){ ZS.extra = list || []; }

/* once a frame (game/zone.js): build what's come near, drop what's gone far. force: build everything in reach now (a
   landing: x, z is where the hero is about to stand, so the camera that hasn't caught up yet doesn't decide) */
const _p = new THREE.Vector3();
export function updateZoneStream(force, x, z){
  if (!ZS.on || !ZS.root || RAW) return;
  const low = qualityLevel() === 'low', build = low ? T.buildLow : T.build, drop = low ? T.dropLow : T.drop;
  const eyes = [x != null ? { x, z } : camera.getWorldPosition(_p).clone()];
  for (const e of ZS.extra) eyes.push({ x: e.x, z: e.z });
  let want = null, wd = Infinity, n = 0;
  for (const c of ZS.chunks){
    let d = Infinity;
    for (const e of eyes){ const v = rectDist(c, e.x, e.z); if (v < d) d = v; }
    if (c.grp){ if (d > drop) dropChunk(c); continue; }
    if (d <= build){
      if (force){ buildChunk(c); n++; continue; }
      if (d < wd){ wd = d; want = c; }
    }
  }
  if (want) for (let k = 0; k < T.perFrame && want; k++){ buildChunk(want); want = null; }
  return n;
}
/* every chunk at once (tests and the collision audit) */
export function buildAllChunks(){ for (const c of ZS.chunks) buildChunk(c); }
export const zoneStreamInfo = () => ({ on: ZS.on, chunks: ZS.chunks.length, built: ZS.built, builds: ZS.stats.builds, drops: ZS.stats.drops, lastMs: +ZS.stats.ms.toFixed(1), autoMs: +(ZS.stats.autoMs || 0).toFixed(1), pieces: ZS.chunks.reduce((a, c) => a + c.pieces.length, 0) });
