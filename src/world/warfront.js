// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WAR BEYOND THE WALLS: a battle that never stops past the arena edge, so a fight in a courtyard reads as one corner
// of something huge. Fighters and dropships cross the sky in formation, AT-ATs march on the horizon with snowspeeders
// circling them, blasts go up across the city, smoke columns climb from what's already burning, and tracer fire
// streaks between the lines. A world lists what it has in `warfront` (data/worlds.js), true to its place in the
// films; a world without one (the training rooms) stays quiet. Purely visual: no collision, no damage, nothing the
// hero can reach. Everything here stands outside the play space and takes the backdrop's far haze (world/ink.js).
//
// A world can also bring the battle in CLOSE (all of it data in its `warfront` entry, so any map can switch it on):
//   · walkerRing [start, stop] (in half-widths of the play space): the walkers stride in from `start` and halt at
//     `stop`, right over the edge; walkerSpeed, walkerSpread (radians between them). stomp: each footfall throws up
//     snow, thuds, and shakes the camera by how close it landed. walkerStrikes: a map's crater strikes flagged
//     `walker` (world/arenas/field.js strike) are fired by the nearest walker's cannon, timed to land as the blast
//     goes off, and leave a scorch; the walkers' other fire stays out past the edge of the play space;
//   · troops: fake soldier lines (one instanced mesh for all of them) trading fire just past the edge, dropping and
//     being replaced: { fronts: [{ x, z, len, ax, gap, n }], colors: [sideA, sideB], fire: [boltA, boltB], rate };
//   · smoke: a colour, or { color, opacity } for soft, see-through smoke (below 1 it's drawn blended).
//
// Sizes follow the backdrop's HERO_SCALE (everyone is ~1.5× life size): a TIE fighter is 11 m across, an X-wing
// 19 m long, an AT-AT 34 m tall. Cost: a handful of merged ship meshes, two walkers, and three instanced pools
// (tracers, flashes, smoke), so the whole battle is roughly 20-30 draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand } from '../utils.js';
import { shared, G, hazardZones } from '../state.js';
import { farHaze } from './ink.js';
import { fightMood } from './atmosphere.js';
import { distantBoom } from '../audio/director.js';
import { camera } from '../engine/renderer.js';
import { scorchGround } from '../fx/scorch.js';

const PI = Math.PI;
const W = { on: false };   // the live battle (one per arena build)
export const warState = W;   // (world/skywar.js layers the trailer moments on top of it)

/* ---------- ships: each one a single merged, vertex-coloured mesh, nose along +z (so lookAt points it) ---------- */
export function part(list, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1){
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  list.push(g);
}
const SHIPS = {
  // TIE fighter (7.2 m → 11 m): ball cockpit, two hexagonal wing panels
  tie(o){ const L = [], hull = o.color ?? 0x6a7078, panel = o.color2 ?? 0x23262e;
    part(L, new THREE.IcosahedronGeometry(1.7, 1), hull);
    part(L, new THREE.CylinderGeometry(0.5, 0.5, 8.4, 6), hull, 0, 0, 0, 0, 0, PI/2);
    for (const s of [-1, 1]) part(L, new THREE.CylinderGeometry(5.4, 5.4, 0.35, 6), panel, s*4.4, 0, 0, 0, 0, PI/2);
    return { L, engine: [[0, 0, -1.6]], glow: 0xff6a4a }; },
  // X-wing (12.5 m → 19 m): long nose, four wings in an X, four engines
  xwing(o){ const L = [], hull = o.color ?? 0xd0ccc4, mark = o.color2 ?? 0xb0402a;
    part(L, new THREE.BoxGeometry(1.6, 1.5, 11), hull, 0, 0, 1);
    part(L, new THREE.ConeGeometry(0.8, 6, 4), hull, 0, 0, 9.4, PI/2, 0, PI/4);
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]){
      part(L, new THREE.BoxGeometry(8.5, 0.25, 3.2), sx > 0 ? hull : mark, sx*4.6, sy*1.2, -3, 0, 0, sy*sx*0.22);
      part(L, new THREE.CylinderGeometry(0.55, 0.55, 4, 8), hull, sx*1.6, sy*0.9, -4, PI/2, 0, 0);
    }
    return { L, engine: [[1.6, 0.9, -6], [-1.6, 0.9, -6], [1.6, -0.9, -6], [-1.6, -0.9, -6]], glow: 0xff7a5a }; },
  // snowspeeder (5.3 m → 8 m): a flat wedge with a raised cockpit, orange flashes
  speeder(o){ const L = [], hull = o.color ?? 0xd8d2c6, mark = o.color2 ?? 0xd8702a;
    part(L, new THREE.BoxGeometry(4.6, 1.2, 6.4), hull, 0, 0, 0);
    part(L, new THREE.ConeGeometry(2.4, 3.2, 4), hull, 0, 0, 4.6, PI/2, 0, PI/4, 1, 1, 0.45);
    part(L, new THREE.BoxGeometry(1.8, 0.9, 2.2), mark, 0, 0.9, 0.6);
    for (const s of [-1, 1]) part(L, new THREE.BoxGeometry(0.9, 0.9, 3), mark, s*2.6, 0, -1.4);
    return { L, engine: [[2.6, 0, -3], [-2.6, 0, -3]], glow: 0xffa060 }; },
  // a troop GUNSHIP (≈26 m): a blunt armoured hull with a glazed nose, open troop doors down each side, stubby wings
  // swept back to wingtip pods, a ball turret on the spine and two big engines at the tail (world/skywar.js flies them)
  gunship(o){ const L = [], hull = o.color ?? 0xd6d2c8, mark = o.color2 ?? 0x9a3a2a, dark = 0x3a3c42;
    part(L, new THREE.BoxGeometry(5.2, 4.6, 15), hull, 0, 0, 0);
    part(L, new THREE.BoxGeometry(4.4, 3.4, 6), hull, 0, -0.4, 9.6, -0.18, 0, 0);
    part(L, new THREE.IcosahedronGeometry(2.1, 1), dark, 0, 0.2, 12.4, 0, 0, 0, 1, 0.8, 1.1);
    for (const s of [-1, 1]){
      part(L, new THREE.BoxGeometry(0.2, 2.6, 5), dark, s*2.62, -0.3, 1.5);
      part(L, new THREE.BoxGeometry(9.5, 0.6, 4.4), hull, s*6.8, 1.6, -1.5, 0, s*0.38, s*-0.08);
      part(L, new THREE.BoxGeometry(1.4, 1.4, 5.2), mark, s*11.2, 1.3, -3.6);
      part(L, new THREE.CylinderGeometry(1.5, 1.7, 6, 8), hull, s*2.6, 2.4, -7.8, PI/2, 0, 0);
      part(L, new THREE.BoxGeometry(0.3, 3.2, 3.4), mark, s*1.2, 3.6, -9.8);
    }
    part(L, new THREE.BoxGeometry(5.4, 1.2, 15.2), mark, 0, 2.2, 0, 0, 0, 0, 1, 1, 0.4);
    part(L, new THREE.IcosahedronGeometry(1, 1), dark, 0, 2.8, 3.5);
    return { L, engine: [[2.6, 2.4, -10.9], [-2.6, 2.4, -10.9]], glow: 0x9ad8ff }; },
  // Imperial dropship / lander (≈40 m): a slab hull, folded wings, a bank of engines
  dropship(o){ const L = [], hull = o.color ?? 0x8a8e96, dark = o.color2 ?? 0x50545c;
    part(L, new THREE.BoxGeometry(10, 6, 26), hull, 0, 0, 0);
    part(L, new THREE.BoxGeometry(6, 4, 8), dark, 0, 3.4, 6);
    part(L, new THREE.ConeGeometry(5.5, 8, 4), hull, 0, 0, 17, PI/2, 0, PI/4, 1, 1, 0.6);
    for (const s of [-1, 1]) part(L, new THREE.BoxGeometry(14, 0.8, 9), dark, s*11, 1.6, -4, 0, 0, s*-0.5);
    return { L, engine: [[3, 0, -13.2], [-3, 0, -13.2], [0, 1.5, -13.2]], glow: 0x9ad8ff }; },
  // a light freighter (35 m → 52 m): the saucer, two forward mandibles, the cockpit tube off to the side
  freighter(o){ const L = [], hull = o.color ?? 0xb8b2a6, dark = o.color2 ?? 0x7a766e;
    part(L, new THREE.CylinderGeometry(17, 18, 4.5, 20), hull);
    for (const s of [-1, 1]) part(L, new THREE.BoxGeometry(5, 3.6, 16), hull, s*4.5, 0, 22);
    part(L, new THREE.CylinderGeometry(2.2, 2.2, 12, 10), dark, 18, 0, 8, PI/2, 0, 0);
    part(L, new THREE.CylinderGeometry(4, 4, 1.2, 12), dark, 0, 2.8, 0);
    return { L, engine: [[0, 0, -17.6]], glow: 0x9ad8ff, wide: 20 }; },
};
const shipCache = new Map();
export function shipGeo(kind, o){
  const id = kind + '|' + (o.color ?? '') + '|' + (o.color2 ?? '');
  if (!shipCache.has(id)){
    const s = SHIPS[kind](o), big = kind === 'dropship' || kind === 'freighter' ? 2.4 : kind === 'gunship' ? 1.8 : 1;
    // the engine glows, merged into one unlit mesh per ship
    const eng = mergeGeometries(s.engine.map(e => new THREE.SphereGeometry(0.7 * big, 8, 6).translate(e[0], e[1], e[2])), false);
    shipCache.set(id, { geo: mergeGeometries(s.L, false), eng, glow: s.glow });
  }
  return shipCache.get(id);
}
export const shipMat = farHaze(new THREE.MeshToonMaterial({ vertexColors: true }));
const glowMats = new Map();
export const glowMat = c => { if (!glowMats.has(c)) glowMats.set(c, new THREE.MeshBasicMaterial({ color: c, toneMapped: false, fog: false })); return glowMats.get(c); };

/* ---------- an AT-AT (22.5 m → 34 m tall) that marches: a body and four legs that swing in the walk ---------- */
function walker(o){
  const g = new THREE.Group(), L = [], hull = o.color ?? 0x7a8494, dark = o.color2 ?? 0x5e6878;
  part(L, new THREE.BoxGeometry(9, 8.5, 21), hull, 0, 27, 0);
  part(L, new THREE.BoxGeometry(7, 3, 17), dark, 0, 31.5, 0);
  part(L, new THREE.CylinderGeometry(1.8, 1.8, 6, 8), dark, 0, 26, 12.5, PI/2, 0, 0);
  part(L, new THREE.BoxGeometry(5, 5, 8), hull, 0, 25.5, 18.5);
  part(L, new THREE.BoxGeometry(5.2, 1.4, 1), dark, 0, 26, 22.6);
  const body = new THREE.Mesh(mergeGeometries(L, false), shipMat); g.add(body);
  const legGeo = (() => { const l = []; part(l, new THREE.BoxGeometry(2.4, 11, 2.4), hull, 0, -5.5, 0); part(l, new THREE.BoxGeometry(2, 11, 2), dark, 0, -16.5, 0);
    part(l, new THREE.CylinderGeometry(2.4, 2.8, 1.4, 10), dark, 0, -22.3, 0); return mergeGeometries(l, false); })();
  const legs = [];
  for (const [lx, lz, ph] of [[3.6, 7.5, 0], [-3.6, 7.5, PI], [3.6, -7.5, PI], [-3.6, -7.5, 0]]){
    const leg = new THREE.Mesh(legGeo, shipMat); leg.position.set(lx, 23, lz); leg.userData.ph = ph; g.add(leg); legs.push(leg);
  }
  g.userData.legs = legs; g.userData.head = new THREE.Vector3(0, 25.5, 23);
  g.scale.setScalar(o.scale ?? 1);   // (a walker close in can stand a size up: it's the thing that sells the scale)
  return g;
}

/* ---------- a soldier far off (≈2.7 m, the hero scale): legs, torso, helmet and a rifle, one merged mesh, white
   vertex colours so the instance colour tints it per side ---------- */
let soldierCache = null;
function soldierGeo(){
  if (soldierCache) return soldierCache;
  const L = [], w = 0xffffff, d = 0x8a8a8a;
  part(L, new THREE.BoxGeometry(0.62, 1.15, 0.36), d, 0, 0.58, 0);
  part(L, new THREE.BoxGeometry(0.78, 0.95, 0.46), w, 0, 1.62, 0);
  part(L, new THREE.IcosahedronGeometry(0.3, 0), w, 0, 2.36, 0);
  part(L, new THREE.BoxGeometry(0.14, 0.14, 1.1), 0x404040, 0.24, 1.7, 0.5);
  return (soldierCache = mergeGeometries(L, false));
}

/* ---------- placement: a point on the battle ring, an ellipse round the (possibly long) play space ---------- */
export function ringPoint(r0, r1, out = new THREE.Vector3(), a = rand(0, PI*2)){
  const r = rand(r0, r1);
  return out.set(Math.cos(a) * r * W.half + W.cx, 0, Math.sin(a) * r * W.halfZ + W.cz);
}

/* build the battle for a world (called from world/arena.js buildWorld once the backdrop is up) */
export function buildWarfront(T, L){
  clearWarfront();
  const F = T.warfront;
  if (!F) return;
  const grp = new THREE.Group(); grp.userData.noBake = true;
  shared.arenaGroup.add(grp);
  Object.assign(W, { on: true, F, grp, half: L.arena / 2, halfZ: (L.arenaZ || L.arena) / 2, cx: 0, cz: 0,
    ships: [], walkers: [], tracers: [], flashes: [], puffs: [], columns: [], later: [], nextBlast: rand(0.5, 2), nextVolley: rand(0.2, 1), t: 0 });
  W.reach = F.reach ?? [1.5, 4.5];   // the ring the ground battle fills, in half-widths of the play space

  // FLIGHTS — each entry is a group that crosses the sky, leaves, and comes back on a new heading
  for (const fl of F.flyers || []){
    for (let k = 0; k < (fl.count || 1); k++){
      const s = shipGeo(fl.kind, fl), wing = [];
      for (let j = 0; j < (fl.wing || 1); j++){
        const m = new THREE.Group();
        m.add(new THREE.Mesh(s.geo, shipMat));
        m.add(new THREE.Mesh(s.eng, glowMat(fl.glow ?? s.glow)));
        grp.add(m); wing.push(m);
      }
      const sh = { fl, wing, t: 0, dur: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), wait: k * rand(2, 5) + rand(0, 3), fireT: rand(0.3, 1.2) };
      for (const m of wing) m.visible = false;
      W.ships.push(sh);
    }
  }
  // WALKERS — AT-ATs marching slowly across the far field, speeders circling them
  for (let k = 0; k < (F.walkers || 0); k++){
    const g = walker(F.walker || {}); grp.add(g);
    const a = (F.walkerAz ?? -PI/2) + (k - ((F.walkers || 1) - 1) / 2) * (F.walkerSpread ?? 0.5);
    const r0 = F.walkerRing ? F.walkerRing[0] + rand(-0.15, 0.15) : W.reach[1] * 0.75;
    ringPoint(r0, r0, g.position, a);
    g.lookAt(W.cx, 0, W.cz);   // they march inward, toward the fight
    g.updateMatrixWorld();
    W.walkers.push({ g, step: rand(0, PI*2), fireT: rand(1, 3), sway: 1, foot: -1 });
  }
  for (const w of W.walkers) for (let j = 0; j < (F.speedersPer || 0); j++){
    const s = shipGeo('speeder', {}), m = new THREE.Group();
    m.add(new THREE.Mesh(s.geo, shipMat));
    grp.add(m);
    W.ships.push({ orbit: w, wing: [m], ang: j * PI, rad: rand(38, 55), alt: rand(10, 18), spd: rand(0.35, 0.5) * (j % 2 ? -1 : 1), fireT: rand(0.5, 1.5) });
  }
  // TROOPS — the fake ground war: two ranks per front facing each other across a gap, all in one instanced mesh
  W.troops = []; W.troopIM = null;
  const TP = F.troops;
  if (TP && TP.fronts){
    for (const fr of TP.fronts){
      const n = fr.n ?? 10, ax = fr.ax ?? 1, gap = fr.gap ?? 24;
      for (const side of [0, 1]){
        const off = (side ? -1 : 1) * gap / 2;   // side 0 on the +perpendicular side (the north, or the east)
        for (let i = 0; i < n; i++){
          const t = -fr.len + (i + 0.5) * (fr.len * 2 / n) + rand(-1, 1);
          const x = fr.x + (ax ? t : off + rand(-2.5, 2.5)), z = fr.z + (ax ? off + rand(-2.5, 2.5) : t);
          const yaw = ax ? (side ? 0 : PI) : (side ? PI/2 : -PI/2);   // facing the other rank
          W.troops.push({ x, z, x0: x, z0: z, yaw, side, ph: rand(0, PI*2), down: 0, gone: 0, crouch: Math.random() < 0.4, fireT: rand(0.5, 4), fr });
        }
      }
    }
    W.troopIM = new THREE.InstancedMesh(soldierGeo(), farHaze(new THREE.MeshToonMaterial({ vertexColors: true })), W.troops.length);
    W.troopIM.frustumCulled = false; W.troopIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    W.troopIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(W.troops.length * 3), 3);
    W.troops.forEach((s, i) => W.troopIM.setColorAt(i, _c.setHex((TP.colors || [0xd8dce4, 0x3a3e46])[s.side])));
    grp.add(W.troopIM);
  }
  // TRACERS, FLASHES, SMOKE — instanced pools; an unused slot is scaled to nothing
  const tr = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), F.troops ? 110 : 80);   // (the sky war shares these: world/skywar.js)
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), 28);
  const smoke = typeof F.smoke === 'object' ? F.smoke : { color: F.smoke }, sOp = smoke.opacity ?? 1;
  const pf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, sOp < 1 ? 2 : 1),
    // soft smoke is unlit and see-through, so overlapping puffs blend into one cloud instead of stacking as solid balls
    farHaze(sOp < 1 ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: sOp, depthWrite: false }) : new THREE.MeshToonMaterial({ color: 0xffffff })), 240);
  if (sOp < 1) pf.renderOrder = 2;   // soft smoke draws over the far layers it drifts in front of
  for (const im of [tr, fl, pf]){ im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hideAll(im); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(im.count * 3), 3); grp.add(im); }
  W.tr = tr; W.fl = fl; W.pf = pf;
  W.smokeCol = new THREE.Color(smoke.color ?? 0x3a3634);
  W.snowCol = new THREE.Color(F.stompColor ?? 0xe8eef6);
  // COLUMNS — fires already burning out there, each sending up a slow, leaning plume
  for (let k = 0; k < (F.columns || 0); k++) W.columns.push({ p: ringPoint(Math.max(W.reach[0] + 0.3, 2.8), Math.max(W.reach[1], 3.6), new THREE.Vector3()),   // (far enough out that a plume stays a column on the horizon, never a wall over the fight)
    every: rand(0.45, 0.8), t: rand(0, 1), size: rand(0.8, 1.4) });
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function hideAll(im){ for (let i = 0; i < im.count; i++) im.setMatrixAt(i, ZERO); im.instanceMatrix.needsUpdate = true; }

export function clearWarfront(){ W.on = false; W.grp = null; }

/* ---------- spawners ---------- */
// w: a width multiplier (a capital ship's turbolasers are fat); delay: seconds before it leaves the muzzle
export function tracer(from, to, color, speed = 260, w = 1, delay = 0){
  if (!W.tr || W.tracers.length >= W.tr.count) return;
  W.tracers.push({ a: from.clone(), b: to.clone(), t: -delay, dur: from.distanceTo(to) / speed, color, w });
}
// o (all optional): dur (s), col (hex), k (brightness), boom (false: silent; a number scales how loud), smoke (false: no
// plume), lift (how high the plume climbs), smokeK (how big its puffs are)
export function flash(p, size, o = {}){
  if (!W.fl || W.flashes.length >= W.fl.count) return;
  W.flashes.push({ p: p.clone(), t: 0, size, dur: o.dur ?? 0.55, col: o.col, k: o.k ?? 1 });
  const d = p.distanceTo(camera.position);
  if (o.boom !== false && G.mode === 'play' && !G.paused) distantBoom(d, o.boom || 1);
  if (o.smoke !== false) for (let k = 0; k < 4; k++) puff(_v.set(p.x + rand(-3, 3) * size * 0.1, p.y + k * size * 0.25, p.z + rand(-3, 3) * size * 0.1), size * rand(0.35, 0.6) * (o.smokeK ?? 1), rand(5, 8), o.lift ?? 3);
}
export function puff(p, size, life, rise, col = null){
  if (!W.pf || W.puffs.length >= W.pf.count) return;
  W.puffs.push({ p: p.clone(), size, life, rise, t: 0, drift: rand(0.6, 1.4), col });
}
/* a shot landing: out past the edge a big blast; a walker's strike in the play space a tighter one that scorches the
   crater and rocks the camera by how close it was */
function land(h){
  if (!h.near){ flash(h.p, rand(8, 13)); return; }
  flash(h.p, h.near * 2.2);
  scorchGround(h.p, h.near * 1.4);
  const d = h.p.distanceTo(camera.position);
  if (G.mode === 'play' && !G.paused && !G.cutscene) G.shake = Math.max(G.shake, Math.min(0.7, Math.max(0, 0.8 - d / 50)));
}
/* the soldier lines: they shuffle and crouch, trade bolts across the gap, and now and then one drops; a while later
   another takes the spot */
function updateTroops(dt, heat){
  const T = W.troops, TP = W.F.troops, im = W.troopIM, cols = TP.fire || [0xff3a2a, 0xff3a2a];
  for (let i = 0; i < T.length; i++){
    const s = T[i];
    if (s.gone > 0){ if ((s.gone -= dt) <= 0){ s.down = 0; s.x = s.x0 + rand(-1.5, 1.5); s.z = s.z0 + rand(-1.5, 1.5); s.crouch = Math.random() < 0.4; } else { im.setMatrixAt(i, ZERO); continue; } }
    let fall = 0;
    if (s.down > 0){ s.down += dt; fall = Math.min(1, s.down / 0.45); if (s.down > 5) s.gone = rand(3, 8); }
    else if ((s.fireT -= dt) <= 0){
      s.fireT = rand(1.2, 4) / ((TP.rate ?? 1) * heat);
      // pick a mark in the other rank of the same front
      let tg = null;
      for (let k = 0; k < 6 && !tg; k++){ const o = T[(Math.random() * T.length) | 0]; if (o.fr === s.fr && o.side !== s.side && !o.down && !o.gone) tg = o; }
      if (tg){
        _v.set(s.x, s.crouch ? 1.3 : 1.8, s.z); _w.set(tg.x + rand(-1.5, 1.5), rand(0.6, 2.4), tg.z + rand(-1.5, 1.5));
        tracer(_v, _w, cols[s.side], 180);
        if (Math.random() < (TP.drop ?? 0.07)) tg.down = 0.001 - _v.distanceTo(_w) / 180;   // it lands, then it falls
      }
    }
    if (s.down < 0) s.down = Math.min(0, s.down + dt) || 0.001;
    const bob = Math.sin(W.t * 1.6 + s.ph);
    _q.setFromEuler(_e.set(0, s.yaw + Math.sin(W.t * 0.4 + s.ph) * 0.25, fall * PI / 2));   // a hit one topples sideways
    _v.set(s.x + Math.sin(W.t * 0.3 + s.ph) * 0.6, fall * 0.25, s.z);
    im.setMatrixAt(i, _m.compose(_v, _q, _s.set(1, (s.crouch && !fall ? 0.72 : 1) * (1 + bob * 0.02), 1)));
  }
  im.instanceMatrix.needsUpdate = true;
}
/* a skirmish somewhere on the ring: two knots of fighters trading fire across a gap */
function volley(){
  const F = W.F, cols = F.tracers?.colors || [0xff3a2a, 0x3aff6a];
  const a = rand(0, PI*2), A = ringPoint(W.reach[0], W.reach[1], new THREE.Vector3(), a), B = ringPoint(W.reach[0], W.reach[1], new THREE.Vector3(), a + rand(0.15, 0.5) * (Math.random() < 0.5 ? -1 : 1));
  A.y = rand(1, 4); B.y = rand(1, 4);
  const n = 2 + Math.floor(Math.random() * 4), side = Math.random() < 0.5;
  for (let k = 0; k < n; k++){
    const [s, e] = (k + (side ? 1 : 0)) % 2 ? [A, B] : [B, A];
    _v.copy(s).add(_w.set(rand(-6, 6), rand(0, 2), rand(-6, 6))); _s.copy(e).add(_w.set(rand(-8, 8), rand(-1, 3), rand(-8, 8)));
    W.tracers.length < W.tr.count && W.tracers.push({ a: _v.clone(), b: _s.clone(), t: -k * 0.12, dur: _v.distanceTo(_s) / 220, color: cols[((k + (side ? 1 : 0)) % 2) % cols.length] });
  }
}

/* ---------- the per-frame update (fx/ambient.js) ---------- */
export function updateWarfront(dt){
  if (!W.on || !W.grp) return;
  const F = W.F, mood = fightMood(), heat = 1 + mood * 1.5;
  W.t += dt;
  // ships
  for (const sh of W.ships){
    if (sh.orbit){   // a speeder circling its walker, strafing it now and then
      sh.ang += sh.spd * dt;
      const c = sh.orbit.g.position, m = sh.wing[0];
      m.position.set(c.x + Math.cos(sh.ang) * sh.rad, sh.alt + Math.sin(W.t * 0.7 + sh.rad) * 3, c.z + Math.sin(sh.ang) * sh.rad);
      _v.set(c.x + Math.cos(sh.ang + Math.sign(sh.spd) * 0.2) * sh.rad, m.position.y, c.z + Math.sin(sh.ang + Math.sign(sh.spd) * 0.2) * sh.rad);
      m.lookAt(_v); m.rotateZ(-Math.sign(sh.spd) * 0.5);
      if ((sh.fireT -= dt) <= 0){ sh.fireT = rand(0.8, 2.2); tracer(m.position, _w.copy(c).setY(rand(18, 30)), F.tracers?.colors?.[1] ?? 0xff5a3a, 300); }
      continue;
    }
    const fl = sh.fl;
    if (sh.dur <= 0){
      if ((sh.wait -= dt) > 0) continue;
      // a new pass: in from one side of the sky, out the other, across the arena or along its flank
      const D = Math.max(W.half, W.halfZ) * (fl.far ?? 6), alt = rand(...(fl.alt || [30, 80])), a = rand(0, PI*2), off = rand(-1, 1) * Math.max(W.half, W.halfZ) * (fl.spread ?? 2.5);
      const ox = -Math.sin(a) * off, oz = Math.cos(a) * off;
      sh.from.set(W.cx + Math.cos(a) * D + ox, alt, W.cz + Math.sin(a) * D + oz);
      sh.to.set(W.cx - Math.cos(a) * D + ox, alt + rand(-15, 15), W.cz - Math.sin(a) * D + oz);
      sh.dur = sh.from.distanceTo(sh.to) / rand(...(fl.speed || [60, 100])); sh.t = 0;
      for (const m of sh.wing) m.visible = true;
    }
    sh.t += dt;
    const k = sh.t / sh.dur;
    sh.wing.forEach((m, j) => {
      if (m.userData.lost) return;   // shot down this pass (world/skywar.js): its wreck is falling on its own
      // a loose formation: wingmen trail back and out to alternating sides
      _v.lerpVectors(sh.from, sh.to, k);
      _w.subVectors(sh.to, sh.from).normalize();
      const side = j === 0 ? 0 : (j % 2 ? 1 : -1) * Math.ceil(j / 2), back = Math.ceil(j / 2) * 22;
      m.position.set(_v.x - _w.x * back - _w.z * side * 16, _v.y + side * 2 + Math.sin(W.t * 1.3 + j) * 1.5, _v.z - _w.z * back + _w.x * side * 16);
      _s.copy(m.position).add(_w);
      m.lookAt(_s); m.rotateZ(Math.sin(W.t * 0.9 + j * 2) * 0.25);
    });
    if (fl.fire && (sh.fireT -= dt) <= 0){   // fighters strafe the ground battle as they pass
      sh.fireT = rand(0.4, 1.1) / heat;
      const m = sh.wing[Math.floor(Math.random() * sh.wing.length)];
      if (m.visible && !m.userData.lost){
      _w.subVectors(sh.to, sh.from).normalize();
      tracer(m.position, _v.copy(m.position).addScaledVector(_w, 160).setY(0), fl.fire, 340);
      }
    }
    if (k >= 1){ sh.dur = 0; sh.wait = rand(...(fl.every || [4, 12])) / heat; for (const m of sh.wing){ m.visible = false; m.userData.lost = false; } }
  }
  // walkers: a slow, heavy stride toward the fight, firing their chin guns into the lines
  const stopAt = Math.max(W.half, W.halfZ) * (F.walkerRing ? F.walkerRing[1] : W.reach[0] + 0.6);
  const live = G.mode === 'play' && !G.paused && !G.cutscene;
  for (const w of W.walkers){
    const g = w.g, legs = g.userData.legs;
    const dist = Math.hypot(g.position.x - W.cx, g.position.z - W.cz), marching = dist > stopAt;
    w.sway += ((marching ? 1 : 0) - w.sway) * Math.min(1, dt * 0.6);   // a halted walker settles its legs square
    w.step += dt * (F.walkerStride ?? 0.9) * (0.25 + w.sway * 0.75);
    for (const l of legs) l.rotation.x = Math.sin(w.step + l.userData.ph) * 0.22 * w.sway;
    g.position.y = Math.abs(Math.sin(w.step)) * 0.5 * w.sway;
    if (marching) g.translateZ(dt * (F.walkerSpeed ?? 4));   // they stop short of the walls
    // a FOOTFALL each half-stride: the leg pair that just planted throws up snow, and the ground thuds
    const foot = Math.floor(w.step / PI);
    if (F.stomp && foot !== w.foot && w.sway > 0.4){
      w.foot = foot;
      g.updateMatrixWorld();
      for (const l of legs){
        if (Math.cos(w.step + l.userData.ph) < 0) continue;   // the pair that's planting
        _v.set(0, -22.5, 0).applyMatrix4(l.matrixWorld).setY(0.5);
        for (let k = 0; k < 3; k++) puff(_w.set(_v.x + rand(-2, 2), 0.6, _v.z + rand(-2, 2)), rand(2.2, 3.4), rand(2.5, 3.5), 1.6, W.snowCol);
      }
      const d = g.position.distanceTo(camera.position);
      if (live){ distantBoom(d * 0.8); G.shake = Math.max(G.shake, Math.min(0.4, Math.max(0, 0.55 - d / 450) * w.sway)); }
    } else if (foot !== w.foot) w.foot = foot;
    if ((w.fireT -= dt) <= 0){
      w.fireT = rand(1.2, 3) / heat;
      _v.copy(g.userData.head).applyMatrix4(g.matrixWorld);
      g.getWorldDirection(_w);
      // a walker close in keeps this fire out past the edge (the play space only takes the strikes it can read)
      const ahead = F.walkerRing ? rand(0.25, 0.85) * Math.max(10, dist - Math.max(W.half, W.halfZ) * 1.12) : rand(80, 160);
      const hit = _v.clone().addScaledVector(_w, ahead).add(_s.set(rand(-1, 1), 0, rand(-1, 1)).multiplyScalar(F.walkerRing ? 18 : 30)).setY(0);
      const col = F.tracers?.colors?.[0] ?? 0xff3a2a;
      tracer(_v, hit, col, 200);
      tracer(_v.add(_s.set(1.5, 0, 0)), hit, col, 200);
      if (Math.random() < 0.6) W.later.push({ t: hit.distanceTo(_v) / 200, p: hit.setY(2) });
    }
  }
  // STRIKES the walkers fire: a crater strike in the play space (hazardZones, world/hazards.js) gets a bolt from the
  // nearest walker's cannon, timed to land the moment the blast goes off
  if (F.walkerStrikes && W.walkers.length) for (const hz of hazardZones){
    if (!hz.walker) continue;
    const cyc = hz.t % hz.period, until = hz.period - hz.activeDur - cyc, n = Math.floor(hz.t / hz.period);
    if (until <= 0 || until > 0.85 || hz._wfShot === n) continue;
    hz._wfShot = n;
    let best = null, bd = Infinity;
    for (const w of W.walkers){ const d = Math.hypot(w.g.position.x - hz.cx, w.g.position.z - hz.cz); if (d < bd){ bd = d; best = w; } }
    best.g.updateMatrixWorld();
    _v.copy(best.g.userData.head).applyMatrix4(best.g.matrixWorld);
    const hit = new THREE.Vector3(hz.cx, 0.4, hz.cz), sp = _v.distanceTo(hit) / until, col = F.tracers?.colors?.[0] ?? 0xff3a2a;
    tracer(_v, hit, col, sp);
    tracer(_v.add(_s.set(1.5, 0, 0)), hit, col, sp);
    W.later.push({ t: until, p: hit.setY(0.6), near: hz.r });
  }
  // walker shots landing
  W.later = W.later.filter(h => (h.t -= dt) > 0 || (land(h), false));
  if (W.troopIM) updateTroops(dt, heat);
  // the ground battle: blasts and volleys, faster as the fight climbs
  if (F.blasts && (W.nextBlast -= dt) <= 0){
    W.nextBlast = rand(0.6, 1.6) / (F.blasts * heat);
    const p = ringPoint(W.reach[0] + 0.3, W.reach[1], new THREE.Vector3()); p.y = rand(0, 4);
    flash(p, rand(9, 16) * (F.blastSize ?? 1));
  }
  if (F.tracers && (W.nextVolley -= dt) <= 0){ W.nextVolley = rand(0.3, 1.0) / ((F.tracers.rate ?? 1) * heat); volley(); }
  for (const c of W.columns){
    if ((c.t -= dt) <= 0){ c.t = c.every; puff(_v.copy(c.p).add(_w.set(rand(-3, 3), 0, rand(-3, 3))), rand(10, 14) * c.size, rand(12, 16), 7); }
  }
  // draw the pools
  let i = 0;
  W.tracers = W.tracers.filter(t => (t.t += dt) < t.dur);
  for (const t of W.tracers){
    if (t.t < 0) continue;
    const k = t.t / t.dur;
    _v.lerpVectors(t.a, t.b, k); _w.subVectors(t.b, t.a).normalize();
    const d = _v.distanceTo(camera.position), th = Math.max(0.3, d * 0.004);   // thicker with distance so it still reads
    _q.setFromUnitVectors(_s.set(0, 0, 1), _w);
    W.tr.setMatrixAt(i, _m.compose(_v, _q, _s.set(th * t.w, th * t.w, Math.max(8, d * 0.06) * (t.w > 1 ? 1 + t.w * 0.25 : 1))));
    W.tr.setColorAt(i, _c.setHex(t.color).multiplyScalar(2.2));
    i++;
  }
  for (; i < W.tr.count; i++) W.tr.setMatrixAt(i, ZERO);
  W.tr.instanceMatrix.needsUpdate = true; W.tr.instanceColor.needsUpdate = true;
  i = 0;
  W.flashes = W.flashes.filter(f => (f.t += dt) < f.dur);
  for (const f of W.flashes){
    const k = f.t / f.dur;
    W.fl.setMatrixAt(i, _m.compose(f.p, _q.identity(), _s.setScalar(f.size * (0.15 + Math.sqrt(k) * 0.45))));
    W.fl.setColorAt(i, _c.setHex(f.col ?? F.flash ?? 0xffa040).multiplyScalar(3 * f.k * (1 - k) * (1 - k)));
    i++;
  }
  for (; i < W.fl.count; i++) W.fl.setMatrixAt(i, ZERO);
  W.fl.instanceMatrix.needsUpdate = true; W.fl.instanceColor.needsUpdate = true;
  i = 0;
  const wind = F.wind ?? [3, 1];
  W.puffs = W.puffs.filter(p => (p.t += dt) < p.life);
  for (const p of W.puffs){
    const k = p.t / p.life;
    p.p.y += p.rise * dt * (1 - k * 0.5); p.p.x += wind[0] * p.drift * dt; p.p.z += wind[1] * p.drift * dt;
    const s = p.size * (0.5 + k * 1.3) * (k > 0.75 ? (1 - k) * 4 : 1);
    W.pf.setMatrixAt(i, _m.compose(p.p, _q.identity(), _s.setScalar(Math.max(0.01, s))));
    if (p.col) W.pf.setColorAt(i, p.col);   // kicked-up snow
    else W.pf.setColorAt(i, _c.copy(W.smokeCol).multiplyScalar(k < 0.08 ? 2.2 : 1));   // fresh smoke still lit by the fire
    i++;
  }
  for (; i < W.pf.count; i++) W.pf.setMatrixAt(i, ZERO);
  W.pf.instanceMatrix.needsUpdate = true; W.pf.instanceColor.needsUpdate = true;
}

/* for the smoke tests and the console: what the battle is running right now */
export function warfrontInfo(){ return W.on ? { ships: W.ships.length, walkers: W.walkers.length, tracers: W.tracers.length, flashes: W.flashes.length, puffs: W.puffs.length,
  troops: W.troops ? W.troops.length : 0, walkerAt: W.walkers.map(w => [Math.round(w.g.position.x), Math.round(w.g.position.z)]) } : null; }
