// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HUB KIT: the pieces every hub's wings share (data/hub.js HUBS), whichever hub builds them (world/arenas/tython.js
// the temple, world/arenas/clone-citadel.js the clone citadel…): materials, the lit ring and sign at every station, the sign
// over every door, and the list of moving things game/hub.js turns each frame (shared.hubAnim).

import * as THREE from 'three';
import { shared, solids } from '../../state.js';
import { SIDE_OUT } from '../../data/hub.js';

export const PI = Math.PI;
export const std = (c, r = 0.9, m = 0.05, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m,
  ...(e ? { emissive: new THREE.Color(c).multiplyScalar(e), emissiveIntensity: 1 } : {}) });
export const glowM = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...(op < 1 ? { transparent: true, opacity: op, depthWrite: false } : {}) });
export const holoM = (c, op = 0.45) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
// a mesh that's only a picture and stays out of the bake (it moves, or glows)
export const live = (m) => { m.userData.noBake = true; m.userData.passThrough = true; m.castShadow = false; m.receiveShadow = false; return m; };
// something game/hub.js turns every frame: fn(obj, time, its starting position)
export function anim(obj, fn){ obj.userData.noBake = true; (shared.hubAnim ||= []).push({ obj, fn, base: obj.position.clone() }); return obj; }
export function spinner(obj, rate){ return anim(obj, (o, t) => { o.rotation.y = t * rate; }); }
// a round step you walk up (under STEP_UP), drawn as a disc
export function roundStep(K, x, z, r, h, mat, seg = 40){
  const m = K.deco(new THREE.CylinderGeometry(r, r * 1.02, h, seg), mat, x, h / 2, z);
  solids.push({ x, z, r, h, climbable: true });
  return m;
}

/* every station: two lit rings on the floor and its name on a sign over it, facing the way you come in. o.ring the
   rings' colour, o.beacon(x, z) draws a fast-travel stone (a station with act 'travel' that isn't the wing's big map),
   o.tall the ids whose sign hangs high over a big centrepiece */
export function hubStations(W, K, o = {}){
  const [sx, sz] = W.spawn, ring = holoM(o.ring ?? 0x5ad2ff, 0.55), tall = o.tall || ['map', 'table'];
  for (const s of W.stations){
    const r = Math.min(2.2, (s.r || 3.2) * 0.55);
    live(K.deco(new THREE.RingGeometry(r, r + 0.22, 48), ring, s.x, 0.05, s.z, -PI / 2));
    live(K.deco(new THREE.RingGeometry(r + 0.5, r + 0.58, 48), ring, s.x, 0.05, s.z, -PI / 2));
    if (s.act === 'travel' && !tall.includes(s.id) && o.beacon) o.beacon(s.x, s.z);
    const face = Math.atan2(sx - s.x, sz - s.z);
    K.sign(s.name, s.x, tall.includes(s.id) ? 8.2 : 4.6, s.z, face, { w: 3.6, ...(o.sign || {}) });
  }
}
/* over every door, the name of the wing beyond it, and a lit runner from the middle of the floor out to it */
export function hubDoorSigns(W, wings, K, o = {}){
  const H = shared.arenaHalf;
  for (const side in W.doors){
    const to = wings[W.doors[side]], [ox, oz] = SIDE_OUT[side];
    const ry = Math.atan2(-ox, -oz);   // facing back into the room
    K.sign(to.short + '  ›', ox * (H - 0.4), o.signY ?? 7.4, oz * (H - 0.4), ry, { w: 6, size: 64, ...(o.sign || {}) });
    K.strip(ox * (H - 14), oz * (H - 14), ox * (H - 0.6), oz * (H - 0.6), 3.2, o.runner ?? 0x5ad2ff, 0.16);
  }
}
