// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// APPROACH LANES: where a hold's reinforcements come in from, and how the player is told before they do.
//
// The rules a protect mission follows (docs/level-design.md, "Protect missions"):
//   · foes never arrive near the people being protected: every lane is at least LANE.clear metres from the whole of
//     the evacuees' walk, from the shelter door to the hatch, and no mission spawn (lanes or arcSpawn) lands within
//     LANE.civGap of anyone on the field (game/civilians.js CIV.list: the line, a frozen child, the escort);
//   · they arrive out of sight where the map allows it: a lane behind a stack or a wall (as seen from the zone)
//     scores higher than one in the open;
//   · they come by a few fixed LANES (two or three, spread round the zone), so the player learns the routes and can
//     meet a wave at the mouth instead of chasing it to the line;
//   · each wave is TELEGRAPHED: its lane flares red (a ring at the mouth, chevrons running toward the zone and an
//     arrow at the screen edge when it's off-screen) LANE.warn seconds before the troops step out of it.
// Host and co-op guest alike: the host picks the lanes and runs the warnings; lanesSnap()/lanesSync() carry them over.

import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { shared, solids } from '../state.js';
import { V3 } from '../utils.js';
import { players } from '../player/players.js';
import { findClearSpawn } from '../world/collision.js';
import { CIV } from './civilians.js';

export const LANE = {
  clear: 13,        // m: the nearest a lane's mouth may be to any point of the evacuees' walk
  civGap: 11,       // m: the nearest any mission spawn may land to someone being protected (CIV.list)
  heroGap: 8,       // m: ...and to a hero (one standing in the mouth: the wave steps out further back)
  count: 3,         // lanes per hold (fewer if the map hasn't room for them, spread apart)
  spread: 0.75,     // radians round the zone between two lanes
  warn: 3.2,        // seconds a lane is lit before its wave steps out
  cool: 2.2,        // seconds it takes to fade back to idle once they're out
  jitter: 1.6,      // m round the mouth each foe steps out at
  ring: [0.74, 0.86], // the mouths on a small arena: this share of the arena's half-size out from its centre
  bigRing: [27, 33],  // on a battle map: this far out from the zone (the edge is a minute's run away)
  hidden: 5,        // score for a mouth the zone can't see (out of sight behind cover)
  idle: 0.16,       // the marks' opacity between waves (the routes stay readable)
};
const RED = 0xff3a2a;

/* ============================================================
   PICKING THE LANES
   ============================================================ */
const segD = (px, pz, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx*dx + dz*dz;
  const t = l ? Math.max(0, Math.min(1, ((px - a[0])*dx + (pz - a[1])*dz) / l)) : 0;
  return Math.hypot(px - a[0] - dx*t, pz - a[1] - dz*t);
};
export function pathDist(x, z, P){
  if (!P || !P.length) return Infinity;
  if (P.length === 1) return Math.hypot(x - P[0][0], z - P[0][1]);
  let m = Infinity;
  for (let i = 0; i < P.length - 1; i++) m = Math.min(m, segD(x, z, P[i], P[i+1]));
  return m;
}
function blockedAt(x, z, pad){
  for (const c of solids){
    if (c.mound || c.y0) continue;
    if (c.box){ if (Math.abs(x - c.x) < c.hx + pad && Math.abs(z - c.z) < c.hz + pad) return true; }
    else if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
  }
  return false;
}
// is the line from the zone to a lane's mouth (at a body's chest height) cut by something taller?
function hiddenFrom(ax, az, bx, bz){
  const dx = bx - ax, dz = bz - az, l2 = dx*dx + dz*dz || 1;
  for (const c of solids){
    if (c.mound || c.y0 || c.h < 1.8) continue;
    if (c.box){
      let t0 = 0, t1 = 1, miss = false;
      for (const [o, d, lo, hi] of [[ax, dx, c.x - c.hx, c.x + c.hx], [az, dz, c.z - c.hz, c.z + c.hz]]){
        if (Math.abs(d) < 1e-6){ if (o < lo || o > hi){ miss = true; break; } continue; }
        let u0 = (lo - o) / d, u1 = (hi - o) / d; if (u0 > u1){ const w = u0; u0 = u1; u1 = w; }
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
      }
      if (!miss && t0 <= t1 && t1 > 0.05 && t0 < 0.95) return true;
    } else {
      const u = Math.max(0, Math.min(1, ((c.x - ax)*dx + (c.z - az)*dz) / l2));
      if (u > 0.05 && u < 0.95 && Math.hypot(ax + dx*u - c.x, az + dz*u - c.z) < c.r * 0.85) return true;
    }
  }
  return false;
}
// a point on the ring the lanes sit on, at angle a (0 = +x, π/2 = +z), kept inside the arena
function ringPoint(a, f, zone){
  if (shared.arenaBig){
    const r = LANE.bigRing[0] + f * (LANE.bigRing[1] - LANE.bigRing[0]);
    const hx = shared.arenaHalf - 4, hz = (shared.arenaHalfZ || shared.arenaHalf) - 4;
    return [Math.max(-hx, Math.min(hx, zone[0] + Math.cos(a) * r)), Math.max(-hz, Math.min(hz, zone[1] + Math.sin(a) * r))];
  }
  const h = shared.arenaHalf * (LANE.ring[0] + f * (LANE.ring[1] - LANE.ring[0]));
  return [Math.cos(a) * h, Math.sin(a) * h];
}
const angAt = (p, zone) => Math.atan2(p[1] - zone[1], p[0] - zone[0]);
const angGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/* the lanes for a hold: o.lanes (a list of arcs) or o.from (one arc), [a0, a1] in radians as data/missions.js has them.
   walk: the evacuees' path (or null). If the authored arcs have no mouth far enough from the walk, the whole ring is
   searched instead, so a mission's data can never put a wave on top of the people it's protecting. */
export function pickLanes(o, walk){
  const zone = o.at, arcs = o.lanes || (o.from ? [o.from] : [[-Math.PI, Math.PI]]);
  const score = (a, f) => {
    const p = ringPoint(a, f, zone);
    if (blockedAt(p[0], p[1], 0.9)) return null;
    const clear = walk ? pathDist(p[0], p[1], walk) : 99;
    const hidden = hiddenFrom(zone[0], zone[1], p[0], p[1]);
    return { x: p[0], z: p[1], a: angAt(p, zone), clear, hidden, s: Math.min(clear, 22) + (hidden ? LANE.hidden : 0) };
  };
  const gather = (list) => {
    const out = [];
    for (const [a0, a1] of list) for (let a = a0; a <= a1 + 1e-6; a += 0.07) for (const f of [0, 0.5, 1]){ const c = score(a, f); if (c) out.push(c); }
    return out;
  };
  let cands = gather(arcs).filter(c => c.clear >= LANE.clear);
  if (!cands.length) cands = gather([[-Math.PI, Math.PI]]).filter(c => c.clear >= LANE.clear);   // the data's arc is too close: anywhere that isn't
  if (!cands.length) cands = gather([[-Math.PI, Math.PI]]).sort((p, q) => q.clear - p.clear).slice(0, 6);   // (a tiny room: the farthest it has)
  cands.sort((p, q) => q.s - p.s);
  const lanes = [];
  for (const c of cands){
    if (lanes.length >= LANE.count) break;
    if (lanes.every(l => angGap(l.a, c.a) >= LANE.spread)) lanes.push(c);
  }
  return lanes.map((l, i) => ({ i, x: l.x, z: l.z, tx: zone[0], tz: zone[1], r: o.r, heat: 0, hidden: l.hidden }));
}

/* where one of a lane's wave steps out: round its mouth, never in reach of a hero or the people on the field (a hero
   standing in the mouth: further back along the lane, away from the zone) */
const tooNear = (x, z, gap, list) => list.some(p => Math.hypot(x - p.x, z - p.z) < gap);
function heroSpots(){ const out = []; for (const p of players) if (p.here !== false && p.pos) out.push(p.pos); return out; }
function civSpots(){ const out = []; for (const c of CIV.list) if (c.m && c.m.visible !== false && c.m.parent) out.push(c.m.position); return out; }
export function laneSpawn(l){
  const dx = l.x - l.tx, dz = l.z - l.tz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  const hx = shared.arenaHalf - 1.5, hz = (shared.arenaHalfZ || shared.arenaHalf) - 1.5, heroes = heroSpots(), civ = civSpots();
  let best = null;
  for (let t = 0; t < 14; t++){
    const back = t < 6 ? 0 : (t - 5) * 1.5, a = Math.random() * Math.PI * 2, j = Math.random() * LANE.jitter;
    const x = Math.max(-hx, Math.min(hx, l.x + ux * back + Math.cos(a) * j)), z = Math.max(-hz, Math.min(hz, l.z + uz * back + Math.sin(a) * j));
    const s = findClearSpawn(x, z, 0.9);
    if (!tooNear(s.x, s.z, LANE.heroGap, heroes) && !tooNear(s.x, s.z, LANE.civGap, civ)) return V3(s.x, 0, s.z);
    if (!best) best = s;
  }
  return V3(best.x, 0, best.z);
}

/* a generic guard for any other mission arrival (game/mission.js arcSpawn: trickles, ambushes, an escort's road):
   of a few tries within the arc, the first that's clear of the heroes and the people on the field, or the farthest */
export function safeSpot(pick){
  const heroes = heroSpots(), civ = civSpots();
  let best = null, bestD = -1;
  for (let t = 0; t < 10; t++){
    const p = pick();
    if (!tooNear(p.x, p.z, LANE.heroGap, heroes) && !tooNear(p.x, p.z, LANE.civGap, civ)) return p;
    const d = Math.min(...civ.map(c => Math.hypot(p.x - c.x, p.z - c.z)), ...heroes.map(h => Math.hypot(p.x - h.x, p.z - h.z) + 3), 99);
    if (d > bestD){ bestD = d; best = p; }
  }
  return best;
}

/* ============================================================
   THE MARKS — a ring at each lane's mouth and chevrons down it to the zone; dim between waves, red and running
   toward the zone while a wave is on its way. shared.incoming lists the hot ones for the screen-edge arrows (ui/threats.js)
   ============================================================ */
const L = { list: [], told: false };
let chevGeo = null;
function chevron(){
  if (!chevGeo){
    const s = new THREE.Shape();
    s.moveTo(-0.8, -0.3); s.lineTo(0, 0.35); s.lineTo(0.8, -0.3); s.lineTo(0.8, 0.15); s.lineTo(0, 0.8); s.lineTo(-0.8, 0.15); s.closePath();
    chevGeo = new THREE.ShapeGeometry(s);
  }
  return chevGeo;
}
const mat = () => new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: LANE.idle, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
function buildMark(l){
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 40), mat());
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07;
  g.add(ring);   // (no column of light over the mouth: the ring, the chevrons and the edge arrow are the telegraph)
  g.position.set(l.x, 0, l.z);
  // the chevrons: from the mouth toward the zone, stopping short of its edge
  const dx = l.tx - l.x, dz = l.tz - l.z, d = Math.hypot(dx, dz) || 1, run = Math.max(0, Math.min(14, d - (l.r || 6) - 1.5));
  const yaw = Math.atan2(dx, dz), chev = [];
  for (let s = 2.4, k = 0; s <= run; s += 2.2, k++){
    const m = new THREE.Mesh(chevron(), mat());
    m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, yaw, 0);
    m.position.set(l.x + dx / d * s, 0.08, l.z + dz / d * s);
    m.userData.k = k;
    scene.add(m); chev.push(m);
  }
  scene.add(g);
  return { g, ring, chev };
}
function dropMark(l){
  if (!l.mk) return;
  const { g, ring, chev } = l.mk;
  scene.remove(g); ring.geometry.dispose(); ring.material.dispose();
  for (const m of chev){ scene.remove(m); m.material.dispose(); }
  l.mk = null;
}
export function setLanes(list){
  clearLanes();
  L.list = list;
  for (const l of list) l.mk = buildMark(l);
}
export function clearLanes(){
  for (const l of L.list) dropMark(l);
  L.list = []; L.told = false;
  shared.incoming = null;
}
export const lanes = () => L.list;
// a wave is on its way down lane i (host): it lights up for LANE.warn, then cools as they step out
export function warnLane(l){ l.heat = 1; l.warnT = LANE.warn; }
const _v = new THREE.Vector3();
function onScreen(x, z){ _v.set(x, 1, z).project(camera); return _v.z < 1 && Math.abs(_v.x) < 0.95 && Math.abs(_v.y) < 0.95; }
export function updateLanes(dt, gt){
  const hot = [];
  for (const l of L.list){
    if (l.warnT > 0) l.warnT -= dt;
    else if (l.heat > 0 && !l.synced) l.heat = Math.max(0, l.heat - dt / LANE.cool);
    const h = l.warnT > 0 ? 1 : l.heat;
    const mk = l.mk; if (!mk) continue;
    const pulse = 0.5 + 0.5 * Math.sin(gt * 9);
    mk.ring.material.opacity = LANE.idle + h * (0.45 + 0.35 * pulse);
    mk.ring.rotation.z += dt * (0.4 + h * 2.5);
    for (const m of mk.chev){
      const run = h > 0 ? 0.5 + 0.5 * Math.sin(gt * 8 - m.userData.k * 0.9) : 0;   // a wave of light running toward the zone
      m.material.opacity = LANE.idle * 0.8 + h * (0.35 + 0.6 * run);
    }
    if (h > 0.3) hot.push({ pos: mk.g.position, seen: onScreen(l.x, l.z) });
  }
  shared.incoming = hot.length ? hot.map(h => h.pos) : null;
  return hot;
}
// the first warning of a hold says what the red lanes mean (the host and the guest each tell their own screen)
export function firstWarning(){ if (L.told) return false; L.told = true; return true; }

/* ============================================================
   CO-OP — the host's lanes on the guest's screen: [x, z, tx, tz, r, heat] each
   ============================================================ */
const r2 = (n) => Math.round(n * 100) / 100;
export function lanesSnap(){
  if (!L.list.length) return undefined;
  return L.list.map(l => [r2(l.x), r2(l.z), r2(l.tx), r2(l.tz), r2(l.r || 6), r2(l.warnT > 0 ? 1 : l.heat)]);
}
// returns true when a lane has just lit up (so the guest's screen can say so too)
export function lanesSync(w){
  if (!w || !w.length){ if (L.list.length) clearLanes(); return false; }
  const same = L.list.length === w.length && L.list.every((l, i) => Math.abs(l.x - w[i][0]) < 0.05 && Math.abs(l.z - w[i][1]) < 0.05 && Math.abs(l.tx - w[i][2]) < 0.05 && Math.abs(l.tz - w[i][3]) < 0.05);
  if (!same) setLanes(w.map((r, i) => ({ i, x: r[0], z: r[1], tx: r[2], tz: r[3], r: r[4], heat: 0, synced: true })));
  let lit = false;
  L.list.forEach((l, i) => { if (w[i][5] > 0.95 && l.heat < 0.95) lit = true; l.heat = w[i][5]; });
  return lit;
}
