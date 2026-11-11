// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WALKER TAKEDOWN: a set piece, run as the mission objective kind `walker` (data/missions.js has the fields, data/walker.js
// the numbers and words). A full-size walker strides along its path toward the line, shelling whoever it can see with
// its chin guns and letting troops down from its belly. Its feet are solid and plant where they land: under one as it
// comes down, you're stomped.
//
//   · TANGLE ITS LEGS: a tow point rides beside three of its feet, each a STYLED LOCK (game/locks.js) built for one
//     hero's way of fighting (a Force seal for the Jedi, a high lock worked from the air for the Mando, the line for the
//     trooper and his squad), and anyone can work any of them. A tow point left alone slips back. Each leg tangled
//     slows it; reaching the end of its path fails the objective (it starts again from where it came in).
//   · DOWN: three legs tangled, it lurches and goes down on its knees, and its crew bails out. Set the charge on its
//     neck (a high lock again) before it tears the cables and gets back up (a couple of tow points to work again).
//   · DOWN FOR GOOD: the charge blows, it topples to one side (its shadow on the snow shows where: don't be under it)
//     and lies there as a wreck for the rest of the mission.
//
// It's drawn the same on every screen. Its legs are planned by each screen from where its body is (each foot plants and
// stays put while the body walks over it, then swings ahead), with a two-bone reach from hip to foot. CO-OP: the host
// runs it (where it is, its phase, the tow points and their markers, the shells); a guest is sent walkerSnap in the
// mission's snapshot and poses its own copy from it. Each screen takes its own hero's hits (a shell, a stomp, the fall).

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, solids, enemies } from '../state.js';
import { V3, clamp, rand } from '../utils.js';
import { playerPos } from '../player/helpers.js';
import { players, targetable } from '../player/players.js';
import { showBanner } from '../ui/banners.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { explosion, sparks } from '../fx/ink.js';
import { S, sfx } from '../audio/sfx.js';
import { distantBoom } from '../audio/director.js';
import { blastAllies } from '../allies/squad.js';
import { makeBeacon, setMarkerColor, pulseMarker, setObjectiveHud, hostilesAlive, mmss } from './objectives.js';
import { LOCK, lockRate } from './locks.js';
import { ringMesh, discMesh, beamMesh, laneMesh, layBeam, layLane, hurtMe, shoveMe, meIn, hurtFoe, dispose } from './twists/kit.js';
import { WALKER, WALKER_TEXT as TXT } from '../data/walker.js';

const GREEN = 0x7bffae, RED = 0xff4a3a;
const PHASES = ['march', 'trip', 'down', 'rise', 'fuse', 'fall', 'wreck'];
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const ang = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/* ---------- the body plan (at scale 1, in metres at the heroes' scale) ---------- */
const B = {
  bodyY: 19, kneelY: 8.6, len: 16, wide: 7, tall: 6.5,
  hipX: 3.1, hipZ: 5.6, hipDrop: 3.0,    // hips: under the body's corners
  upper: 8.4, lower: 8.6,                // leg bones (a hip 16 up stands with its knee a little bent)
  neckZ: 8, headZ: 12.6, headY: -0.6,
};
// the legs: left front, right front, left hind, right hind. off: where its step comes in the walk (a lateral walk:
// one foot in the air at a time) · knee: which way its knee bends (front legs forward, hind legs back)
const LEGS = [
  { sx: -1, sz: 1, off: 0, knee: 1 }, { sx: 1, sz: 1, off: 0.5, knee: 1 },
  { sx: -1, sz: -1, off: 0.75, knee: -1 }, { sx: 1, sz: -1, off: 0.25, knee: -1 },
];
const SWING = 0.22;   // the share of a step's cycle a foot spends in the air

// the one live walker (one at a time: an objective's)
const W = { on: false, root: null, body: null, head: null, legs: [], T: WALKER, o: null, host: false,
  x: 0, z: 0, yaw: 0, gp: 0, v: 0, kn: 0, fk: 0, side: 1, hy: 0, phase: 'march', pt: 0, d: 0, P: null,
  bound: 0, shells: [], shellId: 0, seen: new Set(), solids: [], wreck: null, net: null, gunT: 3, dropT: 0, trickT: 0,
  anchors: [], neck: null, told: {}, crewOut: false, fallHit: false, shadow: null, fuseLamp: null, said: false };
// what the mission lends it (game/mission.js bindWalker): put up a marker it keeps, fail the objective, its kicker, troops
let API = { mark: (m) => m, unmark(){}, fail(){}, kick: () => '', group(){}, arc: () => null, index: () => -1 };
export function bindWalker(api){ API = { ...API, ...api }; }

/* ============================================================
   THE MESH
   ============================================================ */
function mats(){
  return {
    hull: new THREE.MeshStandardMaterial({ color: 0x8e96a0, roughness: 0.55, metalness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x4c545e, roughness: 0.6, metalness: 0.5 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x737b86, roughness: 0.5, metalness: 0.45 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }),
  };
}
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r0, r1, h, m, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m);
function at(o, x, y, z, rx = 0, ry = 0, rz = 0){ o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; }

function buildMesh(scale){
  const M = mats(), root = new THREE.Group(), body = new THREE.Group();
  root.add(body); body.position.y = B.bodyY;
  // the hull: a long armoured box, a raised spine, skirts down the sides and a sloped nose
  body.add(box(B.wide, B.tall, B.len, M.hull));
  body.add(at(box(B.wide - 1.6, 2, B.len - 3, M.plate), 0, B.tall / 2 + 0.9, 0));
  for (const s of [-1, 1]){
    body.add(at(box(0.5, B.tall * 0.8, B.len - 2, M.plate), s * (B.wide / 2 + 0.2), -0.4, 0));
    for (let k = -2; k <= 2; k++) body.add(at(box(0.25, 1.4, 1.1, M.dark), s * (B.wide / 2 + 0.5), 0.6, k * 2.8));
  }
  body.add(at(box(B.wide - 1, B.tall - 1.5, 2.4, M.plate), 0, -0.4, B.len / 2 + 0.6, -0.35));
  body.add(at(box(B.wide - 1, 1.2, B.len - 4, M.dark), 0, -B.tall / 2 - 0.4, 0));   // the belly (the troops come down through it)
  // the hips
  for (const L of LEGS) body.add(at(cyl(1.4, 1.4, 2.4, M.dark), L.sx * (B.hipX + 0.6), -B.tall / 2 + 0.2, L.sz * B.hipZ, 0, 0, Math.PI / 2));
  // the neck: three ribbed segments out to the head
  const neck = new THREE.Group(); body.add(neck); neck.position.set(0, -0.6, B.neckZ);
  for (let k = 0; k < 3; k++) neck.add(at(cyl(1.25 - k * 0.08, 1.25 - k * 0.08, 1.3, k % 2 ? M.dark : M.plate), 0, -0.15 * k, 0.9 + k * 1.15, Math.PI / 2));
  // the head: a wedge with a lit viewport and its guns slung under the chin
  const head = new THREE.Group(); body.add(head); head.position.set(0, B.headY, B.headZ);
  head.add(box(4.2, 3.6, 5.6, M.hull));
  head.add(at(box(3.6, 2.4, 2.2, M.plate), 0, -0.3, 3.4, -0.25));
  head.add(at(box(2.8, 0.35, 0.2, M.glow), 0, 0.55, 4.5, -0.25));
  head.add(at(box(4.6, 0.6, 4.2, M.dark), 0, 1.9, -0.4));
  const guns = [];
  for (const s of [-1, 1]){
    const g = at(cyl(0.32, 0.32, 3.4, M.dark, 8), s * 1.1, -2.1, 3.8, Math.PI / 2); head.add(g); guns.push(g);
    head.add(at(cyl(0.22, 0.22, 2.2, M.dark, 8), s * 2.5, -0.9, 3.1, Math.PI / 2));   // the cheek guns
    head.add(at(box(0.6, 1.4, 2.4, M.plate), s * 2.3, -0.2, 0.6));
  }
  // the charge on its neck (lit once it is set)
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }));
  lamp.position.set(0, 1.25, 1.8); lamp.visible = false; neck.add(lamp);
  // the legs: each a hip-to-knee bone, a knee-to-foot bone and a broad foot. They live in the root, posed every frame
  const legs = LEGS.map((L, i) => {
    const up = new THREE.Group(), low = new THREE.Group();
    up.add(at(box(1.7, B.upper, 1.9, M.hull), 0, -B.upper / 2, 0));
    up.add(at(box(1.9, B.upper * 0.5, 0.5, M.plate), 0, -B.upper * 0.45, L.knee * 0.95));
    low.add(at(box(1.35, B.lower, 1.45, M.hull), 0, -B.lower / 2, 0));
    low.add(at(box(1.6, B.lower * 0.35, 0.4, M.plate), 0, -B.lower * 0.3, L.knee * 0.75));
    const knee = at(cyl(1.15, 1.15, 2.2, M.dark), 0, 0, 0, 0, 0, Math.PI / 2);
    const foot = new THREE.Group();
    foot.add(at(cyl(B.footR || 1.9, 2.1, 1.0, M.dark, 14), 0, 0.5, 0));
    foot.add(at(cyl(1.0, 1.4, 1.2, M.hull, 10), 0, 1.5, 0));
    for (let k = 0; k < 4; k++){ const a = k * Math.PI / 2 + Math.PI / 4; foot.add(at(box(0.7, 0.5, 1.2, M.dark), Math.sin(a) * 1.8, 0.25, Math.cos(a) * 1.8, 0, a)); }
    // a tangled leg: the cable wound round its shin, lit in its tow point's colour
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.22, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    wrap.rotation.x = Math.PI / 2; wrap.position.y = -B.lower * 0.55; wrap.visible = false; low.add(wrap);
    const wrap2 = wrap.clone(); wrap2.material = wrap.material; wrap2.position.y = -B.lower * 0.7; low.add(wrap2);
    root.add(up, low, knee, foot);
    return { L, i, up, low, knee, foot, wrap: [wrap, wrap2], pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(),
             swing: false, t: 0, dur: 1, local: new THREE.Vector3(), kneeL: new THREE.Vector3(), footL: new THREE.Vector3(), solid: null };
  });
  root.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  lamp.castShadow = false;
  root.scale.setScalar(scale);
  scene.add(root);
  return { root, body, head, neck, guns, lamp, legs, mats: M };
}

/* ============================================================
   WHERE IT IS: its path, its feet, its pose
   ============================================================ */
function pathOf(pts){
  const P = { pts, seg: [], len: 0 };
  for (let i = 1; i < pts.length; i++){ const l = Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]); P.seg.push(l); P.len += l; }
  return P;
}
function pathAt(P, d){
  d = clamp(d, 0, P.len);
  for (let i = 0; i < P.seg.length; i++){
    if (d <= P.seg[i] || i === P.seg.length - 1){
      const [ax, az] = P.pts[i], [bx, bz] = P.pts[i + 1], k = P.seg[i] ? clamp(d / P.seg[i], 0, 1) : 0;
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, yaw: Math.atan2(bx - ax, bz - az) };
    }
    d -= P.seg[i];
  }
  return { x: P.pts[0][0], z: P.pts[0][1], yaw: 0 };
}
const sc = () => W.T.scale || 1;
const fwdX = () => Math.sin(W.yaw), fwdZ = () => Math.cos(W.yaw);
// a leg's hip, straight down on the floor, pushed `ahead` metres along its heading
function hipGround(L, ahead, out){
  const s = sc(), hx = L.sx * B.hipX * s, hz = L.sz * B.hipZ * s + ahead;
  const c = Math.cos(W.yaw), sn = Math.sin(W.yaw);
  return out.set(W.x + hx * c + hz * sn, 0, W.z - hx * sn + hz * c);
}
// feet down where they would stand mid-stride, as it first appears
function plantFeet(){
  const st = W.T.stride * sc();
  for (const g of W.legs){
    const c = ((W.gp - g.L.off) % 1 + 1) % 1;
    const rel = c < SWING ? 0.45 : 0.45 - (c - SWING) / (1 - SWING) * (1 - SWING);
    hipGround(g.L, st * rel, g.pos); g.swing = false;
  }
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);
// a bone from a to b (both in the root's space), the bone's group hanging down from a
function bone(g, a, b){
  _u.subVectors(b, a); const l = _u.length() || 1e-3; _u.multiplyScalar(1 / l);
  g.position.copy(a); g.quaternion.setFromUnitVectors(DOWN, _u);
}
// the feet: each one planted until its turn in the walk, then swung ahead to where its hip will be when it lands
function stepFeet(dt){
  const T = W.T, s = sc(), st = T.stride * s, moving = W.v > 0.05 && W.phase === 'march';
  const was = W.gpWas ?? W.gp; W.gpWas = W.gp;
  for (const g of W.legs){
    if (g.swing){
      g.t += dt;
      const u = clamp(g.t / g.dur, 0, 1), e = smooth(u);
      g.pos.lerpVectors(g.from, g.to, e); g.pos.y = Math.sin(Math.PI * u) * T.lift * s;
      if (u >= 1){ g.swing = false; g.pos.y = 0; plant(g); }
      continue;
    }
    if (!moving || W.gp - was > 0.5) continue;   // (a guest whose phase jumped on a snapshot doesn't kick off every step at once)
    const c0 = ((was - g.L.off) % 1 + 1) % 1, c1 = ((W.gp - g.L.off) % 1 + 1) % 1;
    if (c1 < c0){   // its turn: lift and swing ahead
      g.swing = true; g.t = 0; g.dur = SWING * st / Math.max(0.4, W.v);
      g.from.copy(g.pos);
      hipGround(g.L, st * 0.45 + W.v * g.dur, g.to);
      sfx(rand(70, 90), 0.4, 'sawtooth', 0.025, 50);
    }
  }
}
// a foot comes down: dust, a thud, and anyone under it is stomped
function plant(g){
  const T = W.T, s = sc(), r = (T.foot || 1.9) * s, p = g.pos;
  for (let k = 0; k < 4; k++){ const a = rand(0, Math.PI * 2); burst(V3(p.x + Math.cos(a) * r, 0.3, p.z + Math.sin(a) * r), 0xdfe6ee, 3, 4, 2.5, 1.1); }
  const me = playerPos(), d = Math.hypot(me.x - p.x, me.z - p.z);
  distantBoom(d * 0.6);
  G.shake = Math.max(G.shake, clamp(0.5 - d / 60, 0, 0.5));
  if (W.phase === 'march' && meIn(p.x, p.z, r + 0.6, 2.2)){
    if (hurtMe(T.stomp.dmg, p.x, p.z) !== 'none') shoveMe(T.stomp.shove, p.x, p.z, 4);
    floater(V3(me.x, 2, me.z), 'STOMPED', '#ff9a7a');
  }
  if (W.host) for (const e of enemies){
    if (e.dead || e.converted) continue;
    const q = e.group.position;
    if (Math.hypot(q.x - p.x, q.z - p.z) < r + 0.5 && q.y < 2) hurtFoe(e, 60, p.x, p.z, 10);
  }
}
// its pose this frame, from where it is (x, z, yaw), how far through its walk (gp), how far down (kn) and fallen (fk)
function pose(dt){
  const T = W.T, s = sc(), root = W.root, body = W.body;
  root.position.set(W.x, 0, W.z); root.rotation.set(0, W.yaw, 0);
  const moving = W.phase === 'march' && W.v > 0.05;
  W.bob = (W.bob || 0) + ((moving ? 1 : 0) - (W.bob || 0)) * Math.min(1, dt * 1.5);
  const lurch = W.phase === 'trip' ? Math.sin(Math.min(1, W.pt / 1.2) * Math.PI) : 0;   // the stumble as its legs bind
  body.position.set(0, B.bodyY + (B.kneelY - B.bodyY) * smooth(W.kn) + Math.sin(W.gp * Math.PI * 4) * 0.22 * W.bob, lurch * 1.4);
  body.rotation.set(0.15 * smooth(W.kn) + lurch * 0.08, 0, Math.sin(W.gp * Math.PI * 2) * 0.02 * W.bob + lurch * 0.05);
  // the head looks for its mark (and hangs low once it's down)
  W.head.rotation.y += (W.hy - W.head.rotation.y) * Math.min(1, dt * 2);
  W.head.rotation.x = 0.1 + 0.12 * smooth(W.kn);
  // the topple: the whole of it rolls onto one side (the legs with it)
  if (W.fk > 0){
    const f = smooth(W.fk) ** 1.6;
    root.rotation.z = -W.side * 1.42 * f; root.position.y = 2.6 * s * f;
  }
  root.updateMatrixWorld(true); body.updateMatrix();
  // the legs: a two-bone reach from each hip to its foot (once it has fallen, they lie as they were)
  for (const g of W.legs){
    _a.set(g.L.sx * B.hipX, -B.hipDrop, g.L.sz * B.hipZ).applyMatrix4(body.matrix);   // the hip, in the root's space
    if (W.fk <= 0){
      _m.copy(root.matrixWorld).invert();
      g.footL.copy(g.pos).applyMatrix4(_m);
    }
    const a = B.upper, b = B.lower;
    _u.subVectors(g.footL, _a); let L = _u.length() || 1e-3; _u.multiplyScalar(1 / L);
    L = clamp(L, Math.abs(a - b) + 0.3, a + b - 0.02);
    _p.set(0, 0, g.L.knee).addScaledVector(_u, -g.L.knee * _u.z);   // the knee's side: forward (or back), square to the bone
    if (_p.lengthSq() < 1e-4) _p.set(0, 0, g.L.knee); _p.normalize();
    const cosA = clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    g.kneeL.copy(_a).addScaledVector(_u, a * cosA).addScaledVector(_p, a * sinA);
    _b.copy(_a).addScaledVector(_u, L);   // the foot (where the leg reaches: on the floor where it stands)
    bone(g.up, _a, g.kneeL); bone(g.low, g.kneeL, _b);
    g.knee.position.copy(g.kneeL);
    g.foot.position.copy(_b); g.foot.quaternion.identity();
    // the cable round a tangled leg
    const tied = !!(W.bound & (1 << g.i)), col = tied && W.anchors.find(k => k.leg === g.i);
    for (const w of g.wrap){ w.visible = tied; if (col) w.material.color.setHex(LOCK.color[col.style]); }
    // its foot is solid where it stands (a slab while it's up in the air: you can walk under it, and get stomped)
    const c = g.solid;
    if (c){
      const off = W.fk > 0 || W.wreck;
      c.x = g.pos.x; c.z = g.pos.z; c.y0 = off ? 99 : g.pos.y > 0.3 ? g.pos.y : undefined; c.h = off ? 99.1 : g.pos.y + 6.5 * s;
      if (c.y0 === undefined) delete c.y0;
    }
  }
  // the chin guns' muzzle (where its shells are fired from)
  W.guns[0].getWorldPosition(_a); W.guns[1].getWorldPosition(_b);
  W.muzzle = [(_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2];
  // the head, straight down on the floor (where the neck charge is set once it's down)
  W.head.getWorldPosition(_a); W.headAt = [_a.x, _a.y, _a.z];
}

/* ============================================================
   ITS GUNS: a shell on a spot, a ring drawn where it will land filling as its fuse burns (both screens)
   ============================================================ */
function addShell(id, p, age = 0){
  if (W.seen.has(id)) return;
  W.seen.add(id);
  const ring = ringMesh(0xff5a2a, 0.1, 0.85), disc = discMesh(0xff5a2a, 0.22);
  ring.position.x = disc.position.x = p.x; ring.position.z = disc.position.z = p.z; ring.scale.setScalar(p.r); disc.scale.setScalar(0.01);
  scene.add(ring, disc);
  W.shells.push({ id, ...p, age, ring, disc, tracer: null });
}
function updateShells(dt){
  for (let i = W.shells.length - 1; i >= 0; i--){
    const h = W.shells[i];
    h.age += dt;
    if (!h.hit){
      const k = clamp(h.age / h.fuse, 0, 1);
      h.disc.scale.setScalar(Math.max(0.01, h.r * k));
      h.ring.material.opacity = 0.5 + 0.45 * Math.abs(Math.sin(h.age * (6 + k * 18)));
      if (h.age < h.fuse) continue;
      h.hit = true;
      for (const m of [h.ring, h.disc]){ scene.remove(m); dispose(m); }
      const at = V3(h.x, 0.3, h.z);
      explosion(at, h.r * 0.8, false); S.boom(at, 0.9);
      const pp = playerPos(), d = Math.hypot(pp.x - h.x, pp.z - h.z);
      G.shake = Math.max(G.shake, clamp(1 - d / 26, 0, 1) * 0.6);
      h.tracer = beamMesh(0xff6a3a, 0.14, 0.95); scene.add(h.tracer);
      layBeam(h.tracer, { x: h.fx, y: h.fy, z: h.fz }, at);
      if (meIn(h.x, h.z, h.r)){ hurtMe(h.dmg, h.x, h.z); shoveMe(7, h.x, h.z, 4); }
      if (W.host) blastAllies(at, h.r, h.dmg * 0.6);
      continue;
    }
    h.tracer.material.opacity *= 0.7;
    if (h.age > h.fuse + 0.3){ scene.remove(h.tracer); dispose(h.tracer); W.shells.splice(i, 1); }
  }
}
// the host: a volley from the chin guns at a hero it can see (not one right under its head)
function fireGuns(){
  const T = W.T.guns, hs = players.filter(h => h.local ? player.hp > 0 && !player.downed : targetable(h));
  const hx = W.headAt[0], hz = W.headAt[2];
  const able = hs.filter(h => { const d = Math.hypot(h.pos.x - hx, h.pos.z - hz); return d > T.near && d < T.range; });
  if (!able.length) return false;
  const h = able[Math.floor(Math.random() * able.length)], p = h.pos, first = !W.fired;
  W.fired = true;
  W.hy = clamp(ang(W.yaw, Math.atan2(p.x - hx, p.z - hz)), -0.7, 0.7);
  // the first volley lands short, between the hero and the walker: it shows you what's coming
  const k = first ? 0.35 : 0, x0 = p.x + (hx - p.x) * k, z0 = p.z + (hz - p.z) * k;
  const lead = first ? 0 : 0.6, vx = (h.vel && h.vel.x) || 0, vz = (h.vel && h.vel.z) || 0;
  for (const s of [-1, 1]){
    const x = x0 + vx * lead + rand(-1.6, 1.6) + s * 1.2, z = z0 + vz * lead + rand(-1.6, 1.6);
    addShell(++W.shellId, { x, z, r: T.r, fuse: T.fuse + (s > 0 ? 0.25 : 0), dmg: T.dmg, fx: W.muzzle[0], fy: W.muzzle[1], fz: W.muzzle[2] });
  }
  sfx(220, 0.25, 'sawtooth', 0.05, 90);
  for (let k2 = 0; k2 < 3; k2++) sparks(V3(...W.muzzle), 0xff5a2a, 3, 10, { life: 0.25 });
  if (first) showBanner('ITS GUNS ARE ON YOU', 'Where the ring is drawn, a shell lands. Keep moving.', 3, { kicker: TXT.name });
  return true;
}

/* ============================================================
   THE LIFE OF IT
   ============================================================ */
const tuneFor = (o) => ({ ...WALKER, ...o, guns: { ...WALKER.guns, ...(o.guns || {}) }, stomp: { ...WALKER.stomp, ...(o.stomp || {}) },
  anchor: { ...WALKER.anchor, ...(o.anchor || {}) }, neck: { ...WALKER.neck, ...(o.neck || {}) }, drop: { ...WALKER.drop, ...(o.drop || {}) } });

function build(o, host){
  clearWalker();
  W.T = tuneFor(o); W.o = o; W.host = host; W.on = true;
  B.footR = W.T.foot;
  const m = buildMesh(sc());
  Object.assign(W, { root: m.root, body: m.body, head: m.head, neck: m.neck, guns: m.guns, lamp: m.lamp, legs: m.legs, mats: m.mats,
    P: pathOf(o.path), d: 0, v: 0, gp: 0.1, gpWas: undefined, kn: 0, fk: 0, phase: 'march', pt: 0, bound: 0, hy: 0, bob: 0,
    shells: [], seen: new Set(), shellId: 0, gunT: 3.5, dropT: (W.T.drop.every || 16) * 0.6, trickT: (o.trickle && o.trickle.every) || 14,
    anchors: [], neck: null, told: {}, crewOut: false, fallHit: false, wreck: null, fired: false, net: null, downT: 0, said: false });
  const p = pathAt(W.P, 0); W.x = p.x; W.z = p.z; W.yaw = p.yaw;
  // its feet are solid (each a column standing on the floor; lifted, a slab you can walk under)
  for (const g of W.legs){ g.solid = { x: 0, z: 0, r: W.T.foot * sc(), h: 6.5 * sc() }; solids.push(g.solid); W.solids.push(g.solid); }
  plantFeet(); pose(0);
  // the shadow it falls into, shown from the moment the charge is set
  W.shadow = laneMesh(RED, 0.2); W.shadow.visible = false; scene.add(W.shadow);
}
export function clearWalker(){
  for (const h of W.shells){ for (const m of [h.ring, h.disc, h.tracer]) if (m && m.parent){ scene.remove(m); dispose(m); } }
  W.shells = [];
  for (const c of W.solids){ const i = solids.indexOf(c); if (i >= 0) solids.splice(i, 1); }
  W.solids = [];
  if (W.root){ scene.remove(W.root); dispose(W.root); }
  if (W.shadow){ scene.remove(W.shadow); dispose(W.shadow); }
  Object.assign(W, { on: false, root: null, body: null, head: null, legs: [], anchors: [], neck: null, wreck: null, shadow: null, net: null });
}
export const walkerState = () => W.on ? { phase: W.phase, d: W.d, len: W.P && W.P.len, v: W.v, x: W.x, z: W.z, kn: W.kn, fk: W.fk, bound: W.bound,
  anchors: W.anchors.map(a => ({ style: a.style, prog: a.prog, done: a.done, x: a.x, z: a.z })), neck: W.neck && { prog: W.neck.prog, x: W.neck.x, z: W.neck.z },
  shells: W.shells.length, host: W.host, feet: W.legs.map(g => [g.pos.x, g.pos.y, g.pos.z]) } : null;

function setPhase(p){ W.phase = p; W.pt = 0; }
// a tow point rides beside its foot, out from the walker's side
function anchorSpot(a){
  const g = W.legs[a.leg], s = sc(), out = (W.T.foot + W.T.anchor.out) * s;
  const c = Math.cos(W.yaw), sn = Math.sin(W.yaw), sx = g.L.sx;
  a.x = g.pos.x + sx * c * out; a.z = g.pos.z - sx * sn * out;
}

/* ---------- the host: the objective kind (game/mission.js KINDS.walker) ---------- */
export const WALKER_KIND = {
  cue: 'battle',
  music: (o, s) => ({ urgency: W.P ? W.d / W.P.len : 0, danger: W.phase === 'march' && W.P && (W.P.len - W.d) / Math.max(0.3, W.v) < 15, focus: !!s.at }),
  begin(o, s){
    build(o, true); W.idx = API.index();
    const list = o.anchors || [{ leg: 0, style: 'seal' }, { leg: 1, style: 'sky' }, { leg: 3, style: 'line' }];
    W.anchors = list.map(a => ({ leg: a.leg, style: a.style, prog: 0, done: false, x: 0, z: 0, m: null }));
    for (const a of W.anchors){ anchorSpot(a); a.m = API.mark(makeBeacon(a.x, a.z, 0, LOCK.color[a.style], W.T.anchor.r / 0.9)); }
    s.at = null;
  },
  update(o, s, dt){ return hostUpdate(o, s, dt); },
};

function hostUpdate(o, s, dt){
  const T = W.T, n = W.anchors.length;
  W.pt += dt;
  let at = null, status = '', frac = 0, warn = false;
  switch (W.phase){
    case 'march': {
      W.v += (T.speed * Math.max(0.2, 1 - T.slow * W.anchors.filter(a => a.done).length) - W.v) * Math.min(1, dt * 0.8);
      W.d += W.v * dt;
      if (W.d >= W.P.len){ W.d = W.P.len; API.fail(TXT.fail[0], TXT.fail[1]); return false; }
      // the tow points: each worked by whoever is on it, faster in its own way; left alone, it slips back
      for (const a of W.anchors){
        if (a.done) continue;
        const rate = lockRate(a.x, a.z, T.anchor.r, a.style);
        if (rate > 0){
          a.prog += rate * dt; a.pace = rate; at = a;
          if (!W.told[a.style]){ W.told[a.style] = true; showBanner(LOCK.name[a.style], TXT.hint[a.style] || LOCK.hint[a.style], 3.4, { kicker: 'EVERY HERO HAS A WAY' }); }
          if (Math.random() < dt * 8) burst(V3(a.x, 0.6, a.z), LOCK.color[a.style], 2, 3, 3, 0.6);
        } else a.prog = Math.max(0, a.prog - T.anchor.decay * dt);
        if (a.prog >= T.anchor.time) tangle(a);
      }
      const done = W.anchors.filter(a => a.done).length;
      frac = (done + W.anchors.reduce((t, a) => t + (a.done ? 0 : a.prog / T.anchor.time), 0)) / Math.max(1, n);
      const eta = (W.P.len - W.d) / Math.max(0.3, W.v);
      warn = eta < 15;
      status = at ? LOCK.name[at.style] + ' · ' + TXT.hud.working + (at.pace > 1.01 ? ' ×' + at.pace.toFixed(1) : '')
                  : TXT.hud.march + ' · ' + done + ' / ' + n + ' · ' + TXT.hud.eta + ' ' + mmss(eta);
      if (done >= n){ setPhase('trip'); showBanner(TXT.trip[0], TXT.trip[1], 2.6, { kicker: TXT.name }); }
      // troops let down from its belly, and the trickle from the edge
      if ((W.dropT -= dt) <= 0){
        W.dropT = T.drop.every;
        if (o.drop && o.drop.group && hostilesAlive() < T.drop.cap) API.group(o.drop.group, () => V3(W.x + rand(-3, 3), 0, W.z + rand(-4, 4)));
      }
      if (o.trickle && (W.trickT -= dt) <= 0){
        W.trickT = o.trickle.every;
        if (hostilesAlive() < o.trickle.cap) API.group(o.trickle.group, o.from ? () => API.arc(o.from) : null);
      }
      gunsUp(dt, T.guns.every[0]);
      break;
    }
    case 'trip': {
      W.v = Math.max(0, W.v - dt * 2);
      W.kn = smooth((W.pt - T.trip * 0.4) / (T.trip * 0.6));
      status = TXT.hud.trip; frac = 1;
      if (W.pt >= T.trip){
        setPhase('down'); W.kn = 1; W.downT = T.down;
        showBanner(TXT.down[0], TXT.down[1], 3, { kicker: TXT.name });
        G.shake = Math.max(G.shake, 0.9); S.boom(V3(W.x, 0.5, W.z), 1.4);
        for (let k = 0; k < 10; k++) burst(V3(W.x + rand(-8, 8), 0.5, W.z + rand(-8, 8)), 0xdfe6ee, 4, 6, 4, 1.4);
        W.neck = { prog: 0, x: 0, z: 0, m: null };
        neckSpot(); W.neck.m = API.mark(makeBeacon(W.neck.x, W.neck.z, 0, LOCK.color.sky, T.neck.r / 0.9));
        if (o.crew && !W.crewOut){ W.crewOut = true; API.group(o.crew, () => V3(W.neck.x + rand(-4, 4), 0, W.neck.z + rand(-4, 4))); }
      }
      break;
    }
    case 'down': {
      W.downT -= dt;
      neckSpot();
      const rate = lockRate(W.neck.x, W.neck.z, T.neck.r, 'sky');
      if (rate > 0){
        W.neck.prog += rate * dt; at = W.neck; W.neck.pace = rate;
        if (Math.random() < dt * 10) burst(V3(W.neck.x, 1, W.neck.z), LOCK.color.sky, 2, 3, 3, 0.6);
      }
      frac = W.neck.prog / T.neck.time;
      status = (at ? TXT.neckName + ' · ' + TXT.hud.working + (rate > 1.01 ? ' ×' + rate.toFixed(1) : '') : TXT.hud.down) + ' · ' + TXT.hud.up + ' ' + mmss(W.downT);
      warn = W.downT < 10;
      if (W.neck.prog >= T.neck.time){
        setPhase('fuse'); W.lamp.visible = true;
        neckDone();
        showBanner(TXT.fuse[0], TXT.fuse[1], 2.4, { kicker: TXT.name });
        W.side = pickSide();
      } else if (W.downT <= 0) getUp();
      gunsUp(dt, T.guns.every[1]);
      break;
    }
    case 'rise': {
      W.kn = 1 - smooth(W.pt / T.rise);
      status = TXT.rise[0]; frac = 0; warn = true;
      if (W.pt >= T.rise){ W.kn = 0; setPhase('march'); }
      break;
    }
    case 'fuse': {
      status = TXT.hud.fuse; frac = 1; warn = true;
      if (W.pt >= T.fuse){
        setPhase('fall');
        const [x, y, z] = W.headAt;
        explosion(V3(x, y, z), 7, true); S.boom(V3(x, y, z), 1.6); G.shake = Math.max(G.shake, 1.1);
        W.lamp.visible = false;
      }
      break;
    }
    case 'fall': {
      W.fk = clamp(W.pt / T.fall, 0, 1);
      status = TXT.hud.fall; frac = 1;
      fallFx(dt);
      if (W.pt >= T.fall + 0.6){ toWreck(); showBanner(o.doneLine || 'THE WALKER FALLS', o.doneSub || '', 2.4); return true; }
      break;
    }
  }
  if (W.phase === 'march') pathStep(dt);
  W.gp += W.v * dt / (T.stride * sc());
  for (const a of W.anchors){ anchorSpot(a); if (a.m){ a.m.position.set(a.x, 0, a.z); if (!a.done) pulseMarker(a.m, dt, G.gt); } }
  if (W.neck && W.neck.m){ W.neck.m.position.set(W.neck.x, 0, W.neck.z); pulseMarker(W.neck.m, dt, G.gt); }
  live(dt);
  s.at = at;
  setObjectiveHud({ kicker: API.kick(), title: o.title, frac, status, warn });
  return false;
}
// along its path: where it stands, turning toward the next leg of it at its own slow rate
function pathStep(dt){
  const p = pathAt(W.P, W.d);
  W.x = p.x; W.z = p.z;
  const want = pathAt(W.P, W.d + 6).yaw;
  W.yaw += clamp(ang(W.yaw, want), -W.T.turn * dt, W.T.turn * dt);
}
function gunsUp(dt, every){
  if ((W.gunT -= dt) > 0) return;
  W.gunT = fireGuns() ? every * rand(0.85, 1.15) : 1;
}
function neckSpot(){
  if (!W.neck) return;
  const [x, , z] = W.headAt, c = Math.sin(W.yaw), d = Math.cos(W.yaw);
  W.neck.x = x - c * 1.2; W.neck.z = z - d * 1.2;   // (just under the neck, behind the head's chin)
}
function tangle(a){
  a.done = true; a.prog = W.T.anchor.time;
  W.bound |= 1 << a.leg;
  if (a.m){ setMarkerColor(a.m, GREEN); a.m.userData.done = true; a.m.userData.beam.visible = false; }
  burst(V3(a.x, 1.2, a.z), LOCK.color[a.style], 20, 7, 5, 0.9); S.reward(1);
  floater(V3(a.x, 2.2, a.z), TXT.tangled, '#7bffae');
  sfx(140, 0.5, 'sawtooth', 0.06, 60);
  G.shake = Math.max(G.shake, 0.35);
}
function neckDone(){
  const n = W.neck;
  if (n.m){ setMarkerColor(n.m, GREEN); n.m.userData.done = true; n.m.userData.beam.visible = false; }
  burst(V3(n.x, 2, n.z), GREEN, 20, 6, 5, 0.9); S.reward(1);
  sfx(380, 0.12, 'square', 0.05, 760);
}
// it gets up: the cables tear on a couple of legs (those tow points to work again)
function getUp(){
  setPhase('rise');
  showBanner(TXT.rise[0], TXT.rise[1], 2.8, { kicker: TXT.name });
  S.uiDeny && S.uiDeny();
  const torn = W.anchors.filter(a => a.done).sort(() => Math.random() - 0.5).slice(0, W.T.snap);
  for (const a of torn){
    a.done = false; a.prog = 0; W.bound &= ~(1 << a.leg);
    if (a.m){ setMarkerColor(a.m, LOCK.color[a.style]); a.m.userData.done = false; a.m.userData.beam.visible = true; }
    burst(V3(a.x, 2, a.z), LOCK.color[a.style], 14, 8, 6, 0.7);
  }
  if (W.neck && W.neck.m) API.unmark(W.neck.m);
  W.neck = null;
}
// which way it falls: away from the most heroes (it doesn't come down on a party standing at its neck)
function pickSide(){
  const c = Math.cos(W.yaw), sn = Math.sin(W.yaw);
  let l = 0;
  for (const h of players){ if (!h.local && !targetable(h)) continue; const dx = h.pos.x - W.x, dz = h.pos.z - W.z; l += Math.sign(dx * c - dz * sn); }
  return l > 0 ? -1 : 1;
}
// the fall: its own blasts down the hull, and anyone under it as it lands is crushed
function fallFx(dt){
  if (Math.random() < dt * 6){
    const t = rand(-0.5, 0.5), p = V3(W.x + Math.sin(W.yaw) * t * 14 * sc(), rand(4, 12), W.z + Math.cos(W.yaw) * t * 14 * sc());
    explosion(p, 3.5, false); S.boom(p, 0.8);
  }
  if (!W.fallHit && W.fk >= 0.85){
    W.fallHit = true;
    G.shake = Math.max(G.shake, 1.2); S.boom(V3(W.x, 0.5, W.z), 1.8);
    const L = fallLane();
    for (let k = 0; k < 14; k++){ const u = rand(0, 1); burst(V3(L.x0 + (L.x1 - L.x0) * u + rand(-3, 3), 0.5, L.z0 + (L.z1 - L.z0) * u + rand(-3, 3)), 0xdfe6ee, 5, 7, 5, 1.6); }
    crushLane(L);
  }
}
// where it comes down: a strip from its feet out to the side it falls to, as long as its hull
function fallLane(){
  const s = sc(), c = Math.cos(W.yaw), sn = Math.sin(W.yaw), side = W.side, out = 10 * s;
  const mx = W.x + side * c * out, mz = W.z - side * sn * out, half = (B.len / 2 + 4) * s;
  return { x0: mx - Math.sin(W.yaw) * half, z0: mz - Math.cos(W.yaw) * half, x1: mx + Math.sin(W.yaw) * half, z1: mz + Math.cos(W.yaw) * half, w: 9 * s, mx, mz };
}
function inLane(L, x, z){
  const dx = L.x1 - L.x0, dz = L.z1 - L.z0, l2 = dx * dx + dz * dz || 1, t = clamp(((x - L.x0) * dx + (z - L.z0) * dz) / l2, 0, 1);
  return Math.hypot(x - (L.x0 + dx * t), z - (L.z0 + dz * t)) < L.w / 2;
}
function crushLane(L){
  const me = playerPos();
  if (player.hp > 0 && !player.downed && inLane(L, me.x, me.z)){ hurtMe(W.T.crush, L.mx, L.mz); shoveMe(10, L.mx, L.mz, 5); }
  if (W.host) for (const e of enemies){ if (!e.dead && !e.converted && inLane(L, e.group.position.x, e.group.position.z)) hurtFoe(e, 400, L.mx, L.mz, 14); }
}
// down for good: a wreck you can climb on, for the rest of the mission
function toWreck(){
  setPhase('wreck'); W.fk = 1; W.v = 0;
  pose(0);
  const L = fallLane(), s = sc();
  for (const c of W.solids){ const i = solids.indexOf(c); if (i >= 0) solids.splice(i, 1); }
  const hull = { x: L.mx - Math.cos(W.yaw) * W.side * 2 * s, z: L.mz + Math.sin(W.yaw) * W.side * 2 * s, r: 3.6 * s, h: 6.4 * s };
  W.solids = [hull]; solids.push(hull);
  for (const k of [-1, 1]){   // (the hull lies along its heading: two more columns down its length)
    const c = { x: hull.x + Math.sin(W.yaw) * k * 5 * s, z: hull.z + Math.cos(W.yaw) * k * 5 * s, r: 3.4 * s, h: 6.2 * s };
    W.solids.push(c); solids.push(c);
  }
  W.wreck = true;
  if (W.shadow) W.shadow.visible = false;
}

/* ---------- every screen: the shadow, the feet, the guns ---------- */
function live(dt){
  stepFeet(dt);
  pose(dt);
  updateShells(dt);
  // its shadow where it will fall, from the moment the charge is set
  if (W.shadow){
    const show = W.phase === 'fuse' || (W.phase === 'fall' && W.fk < 0.85);
    W.shadow.visible = show;
    if (show){ const L = fallLane(); layLane(W.shadow, L.x0, L.z0, L.x1, L.z1, L.w); W.shadow.material.opacity = 0.12 + 0.14 * Math.abs(Math.sin(G.gt * 7)); }
  }
  if (W.lamp && W.lamp.visible) W.lamp.material.color.setHex(Math.sin(G.gt * (W.phase === 'fuse' ? 6 + W.pt * 6 : 4)) > 0 ? 0xff3a2a : 0x401010);
}

/* ============================================================
   CO-OP: the host's walker, sent with the mission's snapshot
   ============================================================ */
const r2 = (n) => Math.round(n * 100) / 100;
export function walkerSnap(){
  if (!W.on || !W.host) return undefined;
  return { i: W.idx, x: r2(W.x), z: r2(W.z), y: r2(W.yaw), g: r2(W.gp), v: r2(W.v), p: PHASES.indexOf(W.phase), t: r2(W.pt), k: r2(W.kn), f: r2(W.fk),
    s: W.side, h: r2(W.hy), b: W.bound, an: W.anchors.map(a => a.style + ':' + a.leg), sh: W.shells.filter(h => !h.hit).map(h => [h.id, r2(h.x), r2(h.z), h.r, h.fuse, r2(h.age), h.dmg, r2(h.fx), r2(h.fy), r2(h.fz)]) };
}
// a guest: the objective it belongs to (its data: the path, the size) and the host's latest
export function walkerSync(o, w){
  if (!w || !o){ if (W.on && !W.host && !W.wreck) clearWalker(); return; }
  if (!W.on || W.host){
    build(o, false);
    W.x = w.x; W.z = w.z; W.yaw = w.y; W.gp = w.g; plantFeet();
  }
  W.anchors = (w.an || []).map(s => { const [style, leg] = s.split(':'); return { style, leg: +leg }; });
  W.net = w;
  for (const h of w.sh || []) addShell(h[0], { x: h[1], z: h[2], r: h[3], fuse: h[4], dmg: h[6], fx: h[7], fy: h[8], fz: h[9] }, h[5]);
}
export function updateWalkerGuest(dt){
  if (!W.on || W.host || !W.net) return;
  const w = W.net, k = 1 - Math.exp(-10 * dt);
  W.x += (w.x - W.x) * k; W.z += (w.z - W.z) * k; W.yaw += ang(W.yaw, w.y) * k;
  W.v = w.v; W.gp = Math.abs(w.g - W.gp) > 0.6 ? w.g : W.gp + W.v * dt / (W.T.stride * sc()) + (w.g - W.gp) * k * 0.5;
  const ph = PHASES[w.p] || 'march';
  if (ph !== W.phase){
    const was = W.phase; setPhase(ph); W.pt = w.t;
    if (ph === 'down' && was !== 'down') G.shake = Math.max(G.shake, 0.9);
    if (ph === 'fall' && was !== 'fall' && W.headAt){ const [x, y, z] = W.headAt; explosion(V3(x, y, z), 7, true); S.boom(V3(x, y, z), 1.6); }
  } else W.pt += dt;
  W.kn += (w.k - W.kn) * k; W.fk = ph === 'fall' || ph === 'wreck' ? Math.max(W.fk, Math.min(w.f, W.fk + dt / W.T.fall * 1.5)) : 0;
  W.side = w.s; W.hy = w.h; W.bound = w.b;
  W.lamp.visible = ph === 'fuse';
  if (ph === 'fall') fallFx(dt);
  if (ph === 'wreck' && !W.wreck){ W.fk = 1; W.fallHit = true; toWreck(); }
  if (!W.wreck) live(dt); else updateShells(dt);
}

/* a mission retried past its walker: the wreck already lies where it fell (on the way along its path) */
export function walkerWreck(o, idx){
  if (!o || !o.path) return;
  build(o, true); W.idx = idx;
  W.d = W.P.len * 0.62; pathStep(0); W.yaw = pathAt(W.P, W.d).yaw;
  plantFeet(); W.kn = 1; pose(0);
  W.side = 1; W.fallHit = true;
  toWreck();
}
// dev console / tests: tangle every leg (or set the charge) at once
export function walkerSkipStep(){
  if (!W.on || !W.host) return false;
  if (W.phase === 'march'){ for (const a of W.anchors) if (!a.done) tangle(a); }
  else if (W.phase === 'down' && W.neck) W.neck.prog = W.T.neck.time;
  return true;
}
// the objective skipped (dev console, the smoke tests): straight to the wreck
export function walkerSkip(){
  if (!W.on || !W.host || W.wreck) return;
  W.kn = 1; W.side = pickSide(); W.fallHit = true;
  toWreck();
}
