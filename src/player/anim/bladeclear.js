// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE LAST WORD ON CLEARANCE — anim/saber.js keepClear keeps the pose's own blade out of the hero, but a few things
// turn the hilt after the pose has been solved: the at-ease stand blending the arms (anim/ease.js), the ignite and
// retract spin, the hilt sliding between belt and hand (anim/handoff.js), the captured chest twist. So once the whole
// pose is done (animation.js), each lit blade in a hand (the saber, the staff's far end with it, Jar'Kai's second, the
// Darksaber) is checked against the same body column, and any blade that has sunk into it is turned out about the fist,
// just far enough to clear it. It reads the blade meshes themselves, so whatever length the blade is at (running up,
// going in) is what's tested, and the blade that's seen is the one that cuts and the one a co-op partner sees.

import * as THREE from 'three';
import { player, isGunner } from '../../state.js';
import { bodyDepth } from './saber.js';

const NEAR = 0.14;   // the part of the blade this close to the fist is left alone (the hand itself can sit by the body)
const _inv = new THREE.Matrix4(), _pc = new THREE.Vector3(), _q = new THREE.Vector3(), _n = new THREE.Vector3();
const _wp = new THREE.Vector3(), _wn = new THREE.Vector3(), _ax = new THREE.Vector3(), _rq = new THREE.Quaternion();

// the long blade meshes under a hilt (the saber's cylinders, both of the staff's, the Darksaber's edge and glow), found once
function cores(node){
  if (node.userData._cores) return node.userData._cores;
  const out = [];
  node.traverse(m => { if (m.isMesh && m.geometry && /^(Cylinder|Box)Geometry$/.test(m.geometry.type) && (m.geometry.parameters.height || 0) >= 1) out.push(m); });
  return (node.userData._cores = out);
}
const shown = (m, top) => { for (let o = m; o && o !== top.parent; o = o.parent) if (!o.visible) return false; return true; };
const inHand = n => n && n.parent && n.userData.hand ? n.parent === n.userData.hand : !!(n && n.parent);

// turn `node` about its own origin (the fist) by `ang` about the world-space axis `axW`. The rig is mirrored (a negative
// scale up the chain), so this goes by matrices, and a mirrored frame turns the other way
function turnWorld(node, axW, ang){
  const P = node.parent.matrixWorld;
  _ax.copy(axW).transformDirection(_inv.copy(P).invert());
  node.quaternion.premultiply(_rq.setFromAxisAngle(_ax, Math.sign(P.determinant()) * ang));
  node.updateWorldMatrix(false, true);
}
// how deep the deepest blade point is (0 = clear), with it and its way out in _wp / _wn (chest space) and the fist in _pc
function deepest(node, list, chest){
  chest.updateWorldMatrix(true, false); node.updateWorldMatrix(true, true);
  _inv.copy(chest.matrixWorld).invert();
  node.getWorldPosition(_pc).applyMatrix4(_inv);
  let worst = 0;
  for (const m of list){
    const h = m.geometry.parameters.height;
    for (let s = -0.5; s <= 0.5001; s += 0.05){
      _q.set(0, s * h, 0); m.localToWorld(_q); _q.applyMatrix4(_inv);
      if (_q.distanceTo(_pc) < NEAR) continue;
      const d = bodyDepth(_q, _n);
      if (d > worst){ worst = d; _wp.copy(_q); _wn.copy(_n); }
    }
  }
  return worst;
}
const _b = new THREE.Vector3(), _u = new THREE.Vector3(), _t = new THREE.Vector3();
function clear(node, chest, staff){
  const list = cores(node).filter(m => shown(m, node));
  if (!list.length) return;
  for (let it = 0; it < 6; it++){
    const worst = deepest(node, list, chest);
    if (worst < 0.004) return;
    // the saber staff, still in after a couple of turns: it has a blade each way out of the fist, so turning one end out
    // tips the other in. Lay it along the body instead, square to the line from the body's middle to the fist, so both
    // blades pass beside the hero
    if (staff && it >= 2){
      // (a fist at the middle of the body, at the belt: it lies across the front of the hero)
      _u.set(_pc.x, 0, _pc.z);
      if (_u.lengthSq() < 0.15 * 0.15) _u.set(0, 0, 1);
      _u.normalize().transformDirection(chest.matrixWorld);
      _b.set(0, 1, 0).transformDirection(list[0].matrixWorld);   // (the main blade's line)
      _t.copy(_b).addScaledVector(_u, -_b.dot(_u));
      if (_t.lengthSq() < 1e-6) return;
      _t.normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, _b.dot(_t))));
      if (ang < 1e-3) return;
      turnWorld(node, _ax.crossVectors(_b, _t).normalize().clone(), ang);
      return;
    }
    // turn the blade about the fist so its deepest point moves straight out of the body (a little past the edge)
    const L = _wp.distanceTo(_pc);
    if (L < NEAR) return;
    _wp.applyMatrix4(chest.matrixWorld); _pc.applyMatrix4(chest.matrixWorld); _wn.transformDirection(chest.matrixWorld);
    const ax = _t.crossVectors(_wp.sub(_pc), _wn);
    if (ax.lengthSq() < 1e-10) return;
    turnWorld(node, ax.normalize(), (worst + 0.01) / L);
  }
}

// after the whole pose (animatePlayer), every lit blade in a hand of the hero you play
export function clearHeldBlades(R){
  const chest = R && R.chest;
  if (!chest) return;
  if (isGunner()){
    if (player.weapon === 'darksaber' && inHand(player.darksaberMesh)) clear(player.darksaberMesh, chest);
    return;
  }
  if (player.holstered) return;
  if (inHand(player.saberHand)) clear(player.saberHand, chest, !!(player.saberBladeRoot && player.saberBladeRoot.userData.staff));
  const O = player.offSaber;
  if (O && O.node.visible && !player.offAway && O.node.parent === R.sockets.handL) clear(O.node, chest);   // (Jar'Kai's second, in the off hand)
}
