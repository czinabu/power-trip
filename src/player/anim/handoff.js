// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HANDOFF — a hilt changing hands doesn't teleport. When the reach (player/holster.js) moves the saber from the belt to
// the hand or back (or Jar'Kai's second hilt with it, model/weapons.js syncOffSaber), the hilt is re-parented at once,
// but it starts out exactly where it was and slides into its new hold over a beat: each frame, after the pose has put
// it where it belongs (animation.js), it is laid between where its old socket now carries it and that new spot.

import * as THREE from 'three';

export const HANDOFF = { dur: 0.12 };   // how long the hilt takes to settle into its new hold (s)
const live = new Map();   // node → { from: the socket it left, pos, quat (its hold there), t }
const _m = new THREE.Matrix4(), _w = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _q2 = new THREE.Quaternion();

// call just after moving `node` from `from` (its old parent) to its new one; pos / quat are its hold in the old one
export function startHandoff(node, from, pos, quat){
  if (!node || !from || !node.parent || from === node.parent) return;
  // (to: the new hold as it was set; the pose may aim the hilt afresh each frame, but nothing else moves it)
  const H = { from, to: node.parent, pos: pos.clone(), quat: quat.clone(), toPos: node.position.clone(), toQuat: node.quaternion.clone(), t: 0 };
  live.set(node, H);
  // this frame's pose has already run: put it where it was, so the frame that renders now doesn't show the jump
  oldWorld(H, _w); toLocal(node, _w, _p, _q);
  node.position.copy(_p); node.quaternion.copy(_q);
}
export const handingOff = node => live.has(node);
// before the pose (animatePlayer): each moving hilt back in its new hold, so the pose works from where it really is
// (the off hand closing on the pommel, the aim) and not from last frame's blend
export function handoffReset(){
  for (const [node, H] of live){
    if (node.parent !== H.to){ live.delete(node); continue; }   // (taken somewhere else since: thrown, holstered)
    node.position.copy(H.toPos); node.quaternion.copy(H.toQuat);
  }
}
export function clearHandoffs(){ live.clear(); }

// the hold it left, carried by its old socket as it moves this frame (world matrix)
function oldWorld(H, out){
  H.from.updateWorldMatrix(true, false);
  return out.multiplyMatrices(H.from.matrixWorld, _m.compose(H.pos, H.quat, _s.set(1, 1, 1)));
}
function toLocal(node, world, p, q){
  node.parent.updateWorldMatrix(true, false);
  _m.copy(node.parent.matrixWorld).invert().multiply(world).decompose(p, q, _s);
}

// after the pose (animatePlayer): ease each moving hilt from its old hold to the one the pose gave it
export function stepHandoffs(dt){
  for (const [node, H] of live){
    H.t += dt;
    const k = Math.min(1, H.t / HANDOFF.dur);
    // (where the new hold wants it this frame: the hold it was given (the belt), or the pose's aim for a hilt in the hand)
    _q2.copy(node.quaternion);
    if (node.parent !== H.to){ live.delete(node); continue; }
    if (k >= 1){ node.position.copy(H.toPos); node.quaternion.copy(_q2); live.delete(node); continue; }
    holdBetween(node, H.from, H.pos, H.quat, H.toPos, _q2, k * k * (3 - 2 * k));
  }
}

/* lay `node` (already in its new parent) part way (e: 0 → 1) between the hold it had in `from` (pos, quat) and its new
   one (toPos, toQuat), each where its socket carries it this frame (also the cutscene foe's draw: game/duel-draw.js) */
export function holdBetween(node, from, pos, quat, toPos, toQuat, e){
  oldWorld({ from, pos, quat }, _w); toLocal(node, _w, _p, _q);
  node.position.copy(_p).lerp(toPos, e);
  node.quaternion.copy(_q).slerp(toQuat, e);
}
