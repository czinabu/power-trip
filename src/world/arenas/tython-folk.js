// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TEMPLE'S PEOPLE: the Jedi, the younglings and the archivists who live in the hidden temple on Tython (the hub's
// wings, world/arenas/tython.js). They are hero-model figures, the same as the story's cast in a cutscene (game/cast.js:
// a face that blinks, robes on the cloth sim), dressed and placed from data/temple-folk.js. They only walk their rounds,
// talk among themselves and go through their drills: nobody to fight, and nothing solid (you walk through them). Where
// each one is comes from the game clock (G.gt), not from anything they remember, so every screen in a co-op party sees
// them in the same places. A hero figure costs far more to draw than a prop, so a wing keeps to a handful.

import { shared, G } from '../../state.js';
import { heroFigure, stepFigure } from '../../game/cast.js';
import { settleCloth } from '../../player/model/cloth.js';
import { toon, inkify } from '../ink.js';
import { playerPos } from '../../player/helpers.js';
import { groundAt } from '../collision.js';
import { TEMPLE_FOLK, FOLK_LOOKS } from '../../data/temple-folk.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let folk = [];   // this wing's people: { F (the hero figure), cheap (its stand-in), p (data/temple-folk.js), near }
// up close a person is the full hero figure; further off, a cheap stand-in in the same colours takes its place (and the
// figure's cloth and face stop being worked). At most NEAR.max are full figures at once, the nearest ones
export const NEAR = { dist: 24, max: 3 };

function figure(kind, seed){
  const L = FOLK_LOOKS[kind], look = L.looks[seed % L.looks.length];
  const target = heroFigure({ kind: 'hero', as: 'jedi', look: { jedi: look }, saber: !!L.saber && !L.drawn });
  const F = { g: target.group, target, kind: 'hero', own: true, scale: L.scale || 1, walk: null, talk: false, look: null, t: seed * 1.7, gest: 0, turn: 0 };
  target.group.scale.setScalar(F.scale);
  slim(target);
  // a training saber in hand and lit (the drill)
  const hilt = target.saberHand;
  if (hilt && L.drawn){ hilt.visible = true; if (target.blade){ target.blade.blade.visible = target.blade.glow.visible = true; } }
  return F;
}
/* SLIM a figure down to what the temple draws: the Mandalorian's and the trooper's outfits and the guns that every hero
   model carries hidden go entirely, and the rigid pieces riding each joint are merged, one mesh per material (and one
   outline), instead of a mesh each. What the face and the saber move stays as it is. A hero model is well over a hundred
   draws; this brings one down to a few dozen. */
function slim(target){
  const T = target;
  for (const m of [...(T.mandoParts || []), ...(T.trooperParts || [])]) m.removeFromParent();
  for (const w of [T.pistols && T.pistols.L, T.pistols && T.pistols.R, T.rifleMesh, T.darksaberMesh]) if (w) w.removeFromParent();
  // keep whatever the figure's own code reaches for (the eyelids, the jaw, the hands, the saber): every Object3D the
  // target names, and everything under them
  const keep = new Set();
  const mark = (o) => o.traverse(c => keep.add(c));
  const look = (v, depth) => {
    if (!v || typeof v !== 'object' || depth > 2) return;
    if (v.isObject3D){ if (v !== T.group && v !== T.vis) mark(v); return; }
    for (const x of Array.isArray(v) ? v : Object.values(v)) look(x, depth + 1);
  };
  for (const [k, v] of Object.entries(T)) if (k !== 'rig' && k !== 'group' && k !== 'vis' && k !== 'headBare' && k !== 'cloth') look(v, 0);
  for (const C of T.cloth || []) if (C.mesh) mark(C.mesh);
  const hullOf = (m) => m.children.length === 1 && m.children[0].isMesh && m.children[0].material.side === THREE.BackSide ? m.children[0] : null;
  const joints = [];
  T.vis.traverse(o => { if (!o.isMesh) joints.push(o); });
  for (const J of joints){
    const buckets = new Map();
    for (const c of J.children){
      if (!c.isMesh || c.isSkinnedMesh || !c.visible || keep.has(c) || c.morphTargetInfluences) continue;
      if (c.children.length && !hullOf(c)) continue;
      const key = c.material.uuid + '|' + Object.keys(c.geometry.attributes).sort().join(',') + '|' + c.castShadow;
      (buckets.get(key) || buckets.set(key, []).get(key)).push(c);
    }
    for (const list of buckets.values()){
      if (list.length < 2) continue;
      const geos = [], hulls = new Map();
      for (const c of list){
        c.updateMatrix();
        const g = c.geometry.clone().applyMatrix4(c.matrix); geos.push(g.index ? g.toNonIndexed() : g);
        const h = hullOf(c);
        if (h){ h.updateMatrix(); const hg = h.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(c.matrix, h.matrix));
          const hk = h.material.uuid; (hulls.get(hk) || hulls.set(hk, { mat: h.material, g: [] }).get(hk)).g.push(hg.index ? hg.toNonIndexed() : hg); }
      }
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const M = new THREE.Mesh(merged, list[0].material); M.castShadow = list[0].castShadow; J.add(M);
      for (const { mat, g } of hulls.values()){ const hg = mergeGeometries(g, false); if (hg){ const H = new THREE.Mesh(hg, mat); H.castShadow = false; J.add(H); } }
      for (const c of list) c.removeFromParent();
    }
  }
  T.group.traverse(o => { if (o.isMesh) o.castShadow = false; });   // (no shadows of their own: the temple's light falls on the floor alone)
}
/* the STAND-IN: a few simple shapes in the person's own colours (tunic, robe, skin, the hood up or down), folded into
   one mesh and one outline. What's seen of someone across a hall */
let foldM = null;
function standIn(kind, look){
  const P = look.palette || {}, parts = look.parts || {}, small = kind === 'youngling' || kind === 'pupil';
  const g = new THREE.Group(), list = [];
  const add = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, null); m.position.set(x, y, z); m.userData.c = new THREE.Color(color); list.push(m); };
  if (small){
    add(new THREE.ConeGeometry(0.3, 0.75, 10), P.tunic ?? 0xd2c4a2, 0, 0.42, 0);
    add(new THREE.SphereGeometry(0.17, 10, 8), P.skin ?? 0xc58c64, 0, 0.92, 0);
  } else {
    add(new THREE.CylinderGeometry(0.22, 0.28, 0.95, 10), P.tunic ?? 0xd2c4a2, 0, 1.05, 0);
    add(new THREE.ConeGeometry(0.42, 1.45, 12, 1, true), P.robe ?? 0x3b2a1e, 0, 0.78, -0.04);
    add(new THREE.SphereGeometry(0.17, 10, 8), P.skin ?? 0xc58c64, 0, 1.7, 0);
    if (parts.head === 'hood') add(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), P.robe ?? 0x3b2a1e, 0, 1.71, -0.03);
  }
  const geos = list.map(m => {
    m.updateMatrix();
    const q = m.geometry.clone();
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    q.applyMatrix4(m.matrix);
    const n = q.attributes.position.count, col = new Float32Array(n * 3), c = m.userData.c;
    for (let i = 0; i < n; i++){ col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    q.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return q.index ? q.toNonIndexed() : q;
  });
  if (!foldM){ foldM = toon(0xffffff).clone(); foldM.vertexColors = true; }
  const body = new THREE.Mesh(mergeGeometries(geos, false), foldM);
  inkify(body, 0.025); g.add(body);
  if (kind === 'pupil'){   // (the training saber, held up)
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.75, 6), new THREE.MeshBasicMaterial({ color: 0x7aff6a, toneMapped: false }));
    b.position.set(0.24, 0.9, 0.3); b.rotation.x = 0.6; g.add(b);
  }
  return g;
}
function put(F, x, z, yaw){
  F.g.position.set(x, 0, z); F.g.rotation.y = yaw;
  F.g.traverse(o => { o.userData.noBake = true; o.userData.passThrough = true; });
  shared.arenaGroup.add(F.g);
}

// a closed loop of points, walked at `speed` m/s, `lead` metres along it: where on it at time t, and which way it heads
function onLoop(pts, speed, lead, t){
  let L = 0; const seg = [];
  for (let i = 0; i < pts.length; i++){ const a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push([a, b, d, L]); L += d; }
  const d = ((t * speed + lead) % L + L) % L, s = seg.find(q => d >= q[3] && d < q[3] + q[2]) || seg[0], k = (d - s[3]) / (s[2] || 1);
  return [s[0][0] + (s[1][0] - s[0][0]) * k, s[0][1] + (s[1][1] - s[0][1]) * k, Math.atan2(s[1][0] - s[0][0], s[1][1] - s[0][1])];
}

/* build a wing's people (world/arenas/tython.js, inside the wing's build: they go with the arena when it's cleared) */
export function templeFolk(wing){
  folk = [];
  let n = 0;
  for (const p of TEMPLE_FOLK[wing] || []){
    const seed = p.seed ?? n++, F = figure(p.kind, seed), L = FOLK_LOOKS[p.kind];
    const cheap = standIn(p.kind, L.looks[seed % L.looks.length]);
    const at = p.loop ? onLoop(p.loop, p.speed, p.lead || 0, G.gt || 0) : [p.x, p.z, p.face || 0];
    if (p.toward) at[2] = Math.atan2(p.toward[0] - at[0], p.toward[1] - at[1]);
    put(F, at[0], at[1], at[2]);
    if (p.toward) F.look = { x: p.toward[0], z: p.toward[1] };
    stepFigure(F, 0); F.target.vis.updateWorldMatrix(true, true); settleCloth(F.target, 1);
    cheap.position.copy(F.g.position); cheap.position.y = groundAt(cheap.position.x, cheap.position.z, 3); cheap.rotation.y = F.g.rotation.y; if (p.kneel) cheap.scale.y = 0.62;
    cheap.traverse(o => { o.userData.noBake = true; o.userData.passThrough = true; });
    shared.arenaGroup.add(cheap);
    F.g.visible = false;
    folk.push({ F, cheap, p, near: false });
  }
}

/* once a frame in the temple (game/hub.js updateHub) */
export function stepTempleFolk(dt){
  if (!folk.length) return;
  if (!folk[0].F.g.parent){ folk = []; return; }   // (the wing was cleared away)
  const t = G.gt, me = playerPos();
  // who is near enough to be the full figure: the nearest few inside NEAR.dist
  const d = folk.map(f => Math.hypot(f.cheap.position.x - me.x, f.cheap.position.z - me.z));
  const order = folk.map((_, i) => i).filter(i => d[i] < NEAR.dist).sort((a, b) => d[a] - d[b]).slice(0, NEAR.max);
  folk.forEach((f, i) => {
    const near = order.includes(i);
    if (near !== f.near){
      f.near = near; f.F.g.visible = near; f.cheap.visible = !near;
      if (near){ f.F.g.position.copy(f.cheap.position); f.F.g.rotation.y = f.cheap.rotation.y; stepFigure(f.F, 0); f.F.target.vis.updateWorldMatrix(true, true); settleCloth(f.F.target, 0.4); }
    }
  });
  for (const f of folk){
    const { F, p, cheap } = f;
    if (p.loop){
      const [x, z, yaw] = onLoop(p.loop, p.speed, p.lead || 0, t);
      cheap.position.x = x; cheap.position.z = z;
      // (turning a corner: the body comes round over a moment, not in one jump)
      cheap.rotation.y += Math.atan2(Math.sin(yaw - cheap.rotation.y), Math.cos(yaw - cheap.rotation.y)) * Math.min(1, dt * 6);
      cheap.position.y = groundAt(x, z, 3) + Math.abs(Math.sin(t * 5.6)) * 0.04;
      F.walking = true;
    }
    if (!f.near) continue;   // (the stand-in is all that's seen: the figure rests)
    F.g.position.x = cheap.position.x; F.g.position.z = cheap.position.z; F.g.rotation.y = cheap.rotation.y;
    // a pair in conversation takes turns: each talks for a few seconds, then listens
    if (p.talk != null) F.talk = Math.floor(t / 4.5 + p.talk) % 2 === 0;
    stepFigure(F, dt);
    if (p.drill) drill(F, t, p.drill, p.phase || 0);
    if (p.kneel) kneel(F);
  }
}

/* the drill: the saber arm comes up into a guard, cuts down and across, back to guard, on the master's count */
function drill(F, t, rate, phase){
  const R = F.target.rig, k = t * rate + phase, cut = Math.sin(k), across = Math.cos(k);
  R.armR.sh.rotation.set(-1.05 - cut * 0.55, -0.25 + across * 0.3, -0.35);
  R.armR.el.rotation.set(-0.55 + cut * 0.35, 0, 0);
  R.armL.sh.rotation.set(-0.7 - cut * 0.4, 0.3, 0.35);
  R.armL.el.rotation.set(-0.9, 0, 0);
  R.torso.rotation.y = across * 0.18;
}
/* kneeling in meditation: legs folded under, hands on the knees, the head a little bowed */
function kneel(F){
  const R = F.target.rig;
  R.legL.hip.rotation.set(-1.45, 0, -0.12); R.legL.knee.rotation.set(2.4, 0, 0);
  R.legR.hip.rotation.set(-1.45, 0, 0.12); R.legR.knee.rotation.set(2.4, 0, 0);
  R.armL.sh.rotation.set(-0.55, 0, 0.2); R.armL.el.rotation.set(-0.7, 0, 0);
  R.armR.sh.rotation.set(-0.55, 0, -0.2); R.armR.el.rotation.set(-0.7, 0, 0);
  R.head.rotation.x = 0.25;
  F.target.vis.position.y = -0.55;   // (down onto the knees)
}
