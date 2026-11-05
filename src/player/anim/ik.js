// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Pose solvers for the hero rig: two-bone arm IK and "point this held thing that way" for blades and guns (holdAim, gripAt).
//
// Everything here works in CHEST space (the rig's chest joint: +x is the weapon-hand side, +y up, +z the way the
// hero faces), so a pose authored as "hand here, blade pointing there" turns with the upper body for free.

import * as THREE from 'three';
import { DIM } from '../model/rig.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _m = new THREE.Matrix4();

/* The rotation taking `from`-local directions into `to`'s frame, read from the world matrices. Not via
   getWorldQuaternion: the hero model is mirrored (see rig.js MIRROR), and a world quaternion can't hold a mirror. */
const _m2 = new THREE.Matrix4();
function relRot(to, from, out){
  _m2.copy(to.matrixWorld).invert().multiply(from.matrixWorld);
  return out.setFromRotationMatrix(_m.extractRotation(_m2));
}

/* Two-bone IK: put the arm's wrist at `target` (chest space), bending the elbow toward `pole` (a chest-space
   direction the elbow should point, e.g. down and out). Writes sh.quaternion and el.rotation; leaves wr alone. */
export function solveArm(arm, target, pole){
  const a = DIM.upper, b = DIM.fore;
  const S = arm.sh.position;
  const d = _a.subVectors(target, S);
  const dist = THREE.MathUtils.clamp(d.length(), 0.08, a + b - 0.002);
  const dn = d.normalize();
  // elbow bend from the law of cosines; the forearm folds toward the arm's local +z
  const inner = Math.acos(THREE.MathUtils.clamp((a*a + b*b - dist*dist) / (2*a*b), -1, 1));
  const bend = Math.PI - inner;
  arm.el.rotation.set(-bend, 0, 0);
  // the wrist in the shoulder's rest frame, then the swing that lays that onto the target direction
  const h = _b.set(0, -a - b*Math.cos(bend), b*Math.sin(bend)).normalize();
  _q.setFromUnitVectors(h, dn);
  // twist about the shoulder→wrist line so the elbow points toward the pole
  const e = _c.set(0, -a, 0).applyQuaternion(_q);
  e.addScaledVector(dn, -e.dot(dn));
  const p = _d.copy(pole).addScaledVector(dn, -pole.dot(dn));
  if (e.lengthSq() > 1e-8 && p.lengthSq() > 1e-8){
    e.normalize(); p.normalize();
    const ang = Math.atan2(_b.crossVectors(e, p).dot(dn), e.dot(p));
    _q2.setFromAxisAngle(dn, ang);
    _q.premultiply(_q2);
  }
  arm.sh.quaternion.copy(_q);
}

/* A point on a held node (node-local), expressed in chest space — e.g. where the off-hand closes on the hilt. */
export function pointInChest(chest, node, local, out){
  node.updateWorldMatrix(true, false);
  out.copy(local).applyMatrix4(node.matrixWorld);
  chest.updateWorldMatrix(true, false);
  return out.applyMatrix4(_m.copy(chest.matrixWorld).invert());
}

/* The wrist's position in chest space (for seeding an IK pose from wherever FK left the arm). */
export function wristInChest(chest, arm, out){
  arm.wr.updateWorldMatrix(true, false);
  out.setFromMatrixPosition(arm.wr.matrixWorld);
  chest.updateWorldMatrix(true, false);
  return out.applyMatrix4(_m.copy(chest.matrixWorld).invert());
}
/* A held node's axis direction in chest space. */
export function axisInChest(chest, node, axis, out){
  node.updateWorldMatrix(true, false);
  chest.updateWorldMatrix(true, false);
  return out.copy(axis).applyQuaternion(relRot(chest, node, _q3)).normalize();
}

/* Direction slerp (handles the long sweeps of a cut without collapsing through the middle). */
export function slerpDir(a, b, t, out){
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  if (dot > 0.9995) return out.copy(a).lerp(b, t).normalize();
  const th = Math.acos(dot);
  if (th > Math.PI - 1e-3){   // opposite: go round through UP-ish
    const mid = _c.crossVectors(a, UP).lengthSq() > 1e-6 ? _c.crossVectors(a, UP).normalize() : _c.set(1, 0, 0);
    return t < 0.5 ? slerpDir(a, mid, t*2, out) : slerpDir(mid, b, t*2 - 1, out);
  }
  const s = Math.sin(th);
  return out.copy(a).multiplyScalar(Math.sin((1-t)*th) / s).addScaledVector(b, Math.sin(t*th) / s).normalize();
}

/* Hand path: interpolate around a pivot (the chest centre) so cuts travel on an arc, not a straight chord. */
export function arcLerp(a, b, t, pivot, out){
  const ra = _c.subVectors(a, pivot), la = ra.length();
  const rb = _d.subVectors(b, pivot), lb = rb.length();
  if (la < 1e-4 || lb < 1e-4) return out.copy(a).lerp(b, t);
  const da = ra.clone().divideScalar(la), db = rb.clone().divideScalar(lb);
  slerpDir(da, db, t, out);
  return out.multiplyScalar(la + (lb - la) * t).add(pivot);
}

/* HOLD — a weapon held FAST in the fist. (A held node left to swivel on its own about the wrist joint lets a hilt leave
   the hand at any angle, out through the back of the wrist or past the knuckles.) holdAim keeps the
   node where the hand grips it (`rest`: its mount turn in the wrist's frame, e.g. a hilt laid through the curled
   fingers) and turns the WRIST to aim it, the way a real hand does:
     · of every wrist turn that lays the held axis on `dir`, it takes the one that bends the hand least off the line of
       the forearm (or, given upAxis/upHint, the one that stands a gun upright), so a blade out in front is a straight
       wrist, a blade up is the wrist cocked back, a blade laid along the arm the wrist rolled over;
     · the turn is held to what a wrist can do (LIMITS: the forearm rolls a long way, the hand bends ~70° up or down
       but only ~35° to the thumb or little-finger side); whatever a pose asks past that, the hilt rolls in the fingers;
     · its roll is kept from the last frame where the aim leaves it open (a blade straight down the forearm's line), so
       the hand never flips round from one frame to the next.
   Returns the wrist turn (wr.quaternion). With `node` null it only turns the wrist (an off hand closing on the main
   hilt). Call after the arm is posed; `chest` and the arm need up-to-date world matrices. */
export const WRIST_LIMITS = { twist: 2.3, bend: 1.15, side: 0.62 };
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _e3 = new THREE.Vector3(), _f1 = new THREE.Vector3(), _f2 = new THREE.Vector3(), _f3 = new THREE.Vector3();
const _mA = new THREE.Matrix4(), _mB = new THREE.Matrix4(), _qW = new THREE.Quaternion(), _qT = new THREE.Quaternion(), _qS = new THREE.Quaternion(), _qR = new THREE.Quaternion();
const HAND = new THREE.Vector3(0, -1, 0), ALT = new THREE.Vector3(0, 0, 1);
export function holdAim(chest, wr, node, axis, dir, rest, upAxis = null, upHint = null, lim = WRIST_LIMITS, memo = wr.userData){
  const el = wr.parent;
  el.updateWorldMatrix(true, false);
  relRot(el, chest, _q2);   // chest → elbow frame
  const want = _f1.copy(dir).applyQuaternion(_q2).normalize();
  const g = _e1.copy(axis).applyQuaternion(rest).normalize();   // the held axis in the wrist's frame, the wrist straight
  // the second axis to match: the hand's own line (the knuckles' way) → kept nearest the forearm's line; or a gun's top → up
  const gun = !!(upAxis && upHint);
  const ref = gun ? _e2.copy(upAxis).applyQuaternion(rest) : _e2.copy(HAND);
  const refTo = gun ? _f2.copy(upHint).applyQuaternion(_q2) : _f2.copy(HAND);
  ref.addScaledVector(g, -ref.dot(g));
  if (ref.lengthSq() < 1e-6) ref.copy(ALT).addScaledVector(g, -ALT.dot(g));
  ref.normalize();
  refTo.addScaledVector(want, -refTo.dot(want));
  // where the aim leaves the roll open (refTo along the aim), lean on last frame's
  const prev = memo._holdRef;
  if (prev){ const p = _e3.copy(prev).addScaledVector(want, -prev.dot(want)); refTo.addScaledVector(p, 0.15); }
  if (refTo.lengthSq() < 1e-6) refTo.copy(ALT).addScaledVector(want, -ALT.dot(want));
  refTo.normalize();
  (memo._holdRef || (memo._holdRef = new THREE.Vector3())).copy(refTo);
  // the turn taking the frame (g, ref) onto (want, refTo)
  _e3.crossVectors(g, ref); _f3.crossVectors(want, refTo);
  _mA.makeBasis(g, ref, _e3); _mB.makeBasis(want, refTo, _f3);
  _qW.setFromRotationMatrix(_mB.multiply(_mA.transpose()));
  // held to the wrist's reach: swing (the hand bending) × twist (the forearm rolling, about its own line, y)
  _qT.set(0, _qW.y, 0, _qW.w);
  if (_qT.lengthSq() < 1e-9) _qT.identity(); else _qT.normalize();
  let ta = 2 * Math.atan2(_qT.y, _qT.w);
  if (ta > Math.PI) ta -= Math.PI * 2; else if (ta < -Math.PI) ta += Math.PI * 2;
  ta = THREE.MathUtils.clamp(ta, -lim.twist, lim.twist);
  _qS.copy(_qW).multiply(_qR.copy(_qT).invert());   // swing = W · twist⁻¹
  if (_qS.w < 0){ _qS.x = -_qS.x; _qS.y = -_qS.y; _qS.z = -_qS.z; _qS.w = -_qS.w; }
  const sa = 2 * Math.acos(Math.min(1, _qS.w)), sn = Math.sqrt(1 - Math.min(1, _qS.w * _qS.w));
  if (sn > 1e-6){
    // its axis lies in the wrist's xz plane: about z bends the hand toward the palm or the back, about x toward the thumb or the little finger
    let bx = _qS.x / sn * sa, bz = _qS.z / sn * sa;
    const k = Math.hypot(bx / lim.side, bz / lim.bend);
    if (k > 1){ bx /= k; bz /= k; }
    const a = Math.hypot(bx, bz);
    _qS.setFromAxisAngle(_e3.set(bx / (a || 1), 0, bz / (a || 1)), a);
  } else _qS.identity();
  _qW.copy(_qS).multiply(_qT.setFromAxisAngle(_e3.set(0, 1, 0), ta));
  wr.quaternion.copy(_qW);
  if (node){
    // what the wrist couldn't do, the hilt does: it rolls in the fingers by the rest of the way (about the fist)
    const cur = _e3.copy(g).applyQuaternion(_qW);
    _qR.setFromUnitVectors(cur, want);   // (elbow frame)
    node.quaternion.copy(_qW).invert().multiply(_qR).multiply(_qW).multiply(rest);
  }
  return _qW;
}

/* GRIP AT — solve `arm` so its FIST (fistLocal, in the wrist's frame) lands on `target` (chest space) rather than its wrist
   joint: the pose's hand point is where the hilt is held, so the blade's path is the pose's own whatever the wrist does.
   `aim` turns the wrist (and the hilt) once the arm is posed; the fist's offset from the wrist that results is carried
   to the next pass and the next frame (`k` fades it, for an off hand only part way onto the hilt). */
const _wt = new THREE.Vector3(), _fp = new THREE.Vector3(), _wq = new THREE.Vector3();
export function gripAt(R, arm, target, pole, fistLocal, aim, k = 1){
  const U = arm.wr.userData, off = U._fistOff || (U._fistOff = new THREE.Vector3(0, -0.1, 0.06));
  for (let i = 0; i < 2; i++){
    _wt.copy(target).addScaledVector(off, -k);
    solveArm(arm, _wt, pole);
    arm.wr.updateWorldMatrix(true, false);
    aim();
    arm.wr.updateWorldMatrix(true, false);
    pointInChest(R.chest, arm.wr, _fp.copy(fistLocal), _wq);
    wristInChest(R.chest, arm, _fp);
    off.subVectors(_wq, _fp);
  }
}
