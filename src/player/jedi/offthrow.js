// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// JAR'KAI'S THROWN SABER — the finisher Nightsister's Cross ends by throwing the off-hand saber on to the next foe
// (data/finishers.js EDGES.throw, jedi/finisher.js edge 'throw'): it leaves the off hand spinning, strikes at the half
// way point and comes back to the hand. The saber in the hand is put away while it flies (model/weapons.js
// syncOffSaber reads player.offAway). Its own mesh, no light of its own (adding one recompiles every material).

import * as THREE from 'three';
import { scene } from '../../engine/renderer.js';
import { player } from '../../state.js';
import { stance } from '../helpers.js';
import { S } from '../../audio/sfx.js';

const flyer = new THREE.Group();
const core = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.028, 1.5, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 1.55, 8),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
halo.userData.saberTrail = { hilt: -1 }; flyer.userData.trailAlways = true;   // a streak the whole flight (fx/trail.js)
flyer.add(core, halo);
flyer.visible = false;
scene.add(flyer);

let fly = null;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
// throw it at foe `e`: out and back over `dur` s, `hit` called as it reaches the foe
export function throwOffSaber(e, dur, hit){
  if (!e || !e.group) return;
  fly = { e, t: 0, dur, hit, struck: false };
  halo.material.color.setHex(stance().blade || 0x7dffa8);
  player.offAway = true;
  flyer.visible = true;
  S.whoosh(handPos(new THREE.Vector3()), false);
}
const handPos = (out) => {
  const n = player.offSaber && player.offSaber.node;
  if (n){ n.updateWorldMatrix(true, false); return out.setFromMatrixPosition(n.matrixWorld); }
  return out.copy(player.group.position).setY(player.group.position.y + 1.3);
};
export function updateOffThrow(dt){
  if (!fly) return;
  fly.t += dt;
  const k = Math.min(1, fly.t / fly.dur), out = k < 0.5 ? k * 2 : 2 - k * 2;   // 0 → 1 (at the foe) → 0
  handPos(_a);
  const g = fly.e.group.position;
  _b.set(g.x, g.y + 1.3, g.z);
  flyer.position.copy(_a).lerp(_b, Math.sin(out * Math.PI / 2));
  flyer.rotation.set(0, fly.t * 22, Math.PI / 2);   // spinning flat, like a thrown saber
  if (!fly.struck && k >= 0.5){ fly.struck = true; fly.hit && fly.hit(); }
  if (k >= 1) endOffThrow();
}
export function endOffThrow(){
  if (fly && !fly.struck && fly.hit) fly.hit();
  fly = null; flyer.visible = false; player.offAway = false;
}
