// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mandalorian gun holds, Din Djarin style: blasters ride low at the hip until he shoots, then snap up one-handed
// (point-shooting down the arm at the reticle); the disruptor is shouldered with the off hand on the foregrip.
// Same chest-space IK as the saber (anim/ik.js); visual only, bolts still leave from muzzleOrigin() in weapons.js.

import * as THREE from 'three';
import { solveArm, holdAim, gripAt, pointInChest } from './ik.js';
import { fistAt } from '../model/weapons.js';
import { DIM } from '../model/rig.js';

const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
const _aim = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4();
const POLE_R = new THREE.Vector3(0.6, -0.8, -0.1).normalize(), POLE_L = new THREE.Vector3(-0.6, -0.8, -0.1).normalize();
const LOW_DIR = new THREE.Vector3(0.05, -0.75, 0.66).normalize();

/* THE TROOPER'S DC-17 REST (Captain Rex's carry): between shots the gun hand holds its pistol up by the shoulder, muzzle
   to the sky, and the off hand lets the other hang at his side, muzzle at the ground. Hand points and muzzle directions
   are in chest space (armR is the gun hand; its shoulder sits at +x). `up` is the way the pistol's top faces: the
   raised one turned so its sights face back toward him. */
const REX = {
  R: { hand: new THREE.Vector3(0.33, 0.42, 0.2), dir: new THREE.Vector3(0.08, 1, 0.12).normalize(), up: new THREE.Vector3(0.2, 0, -1).normalize() },
  L: { hand: new THREE.Vector3(-0.29, -0.4, 0.09), dir: new THREE.Vector3(-0.03, -0.95, 0.3).normalize(), up: new THREE.Vector3(0, 0.3, 1).normalize() },
};
// ON THE RUN both come up: the off hand's pistol raised by its shoulder as the gun hand's is (REX.R, mirrored)
const REX_RUN_L = { hand: new THREE.Vector3(-0.33, 0.42, 0.2), dir: new THREE.Vector3(-0.08, 1, 0.12).normalize(), up: new THREE.Vector3(-0.2, 0, -1).normalize() };
const _restL = { hand: new THREE.Vector3(), dir: new THREE.Vector3(), up: new THREE.Vector3() };
const _u = new THREE.Vector3();

/* per-gun live state: how "drawn" it is (0 hip → 1 aimed), smoothed so the draw is a fast snap, the re-holster slow */
const draw = { R: 0, L: 0, rifle: 0, run: 0 };
// (another figure posed with this code for a moment takes its own: player/stand-in.js) returns what was here, puts `o` in
export function gunMemo(o){ const was = { ...draw }; if (o) Object.assign(draw, o); return was; }

/* the reticle point (world) → a unit aim direction from a shoulder, in chest space */
function aimFrom(chest, shoulder, worldPoint, out){
  chest.updateWorldMatrix(true, false);
  out.copy(worldPoint).applyMatrix4(_m.copy(chest.matrixWorld).invert());
  return out.sub(shoulder).normalize();
}

/* One pistol arm. side: 'R' (gun hand) or 'L' (off-hand gun). drawn: 0..1. recoil kicks the hand up and back. */
function pistolArm(R, arm, gun, aimDir, k, recoil, pole, rest = null){
  const sh = arm.sh.position;
  const sx = Math.sign(sh.x);
  // hip: a low ready by the holster, muzzle angled at the ground ahead (or the trooper's rest: REX above)
  const hip = rest ? _h.copy(rest.hand) : _h.set(0.24 * sx, -0.42, 0.16);
  // drawn: arm nearly straight down the aim line from the shoulder (point shooting), recoil lifts it
  const reach = DIM.upper + DIM.fore - 0.04 - recoil * 0.12;
  _p.copy(sh).addScaledVector(aimDir, reach);
  _p.y += recoil * 0.06;
  hip.lerp(_p, k);
  _d.copy(rest ? rest.dir : LOW_DIR).lerp(aimDir, k).normalize();
  _d.y += recoil * 0.5; _d.normalize();          // muzzle flip
  _u.copy(rest ? _u.copy(rest.up).lerp(Y, k).normalize() : Y);
  // the gun's grip in the fist, the wrist pointing it (anim/ik.js holdAim): the hand points the gun, not the gun alone
  gripAt(R, arm, hip, pole, gun.position, () => holdAim(R.chest, arm.wr, gun, Z, _d, gun.userData.restQ || gun.quaternion, Y, _u));
}

/* the trooper's pistols at rest (REX), for a figure with no aim to follow: the hero select's stand, the model lab */
export function rexRest(R, pistols){
  R.chest.updateWorldMatrix(true, false);
  pistolArm(R, R.armR, pistols.R, Z, 0, 0, POLE_R, REX.R);
  pistolArm(R, R.armL, pistols.L, Z, 0, 0, POLE_L, REX.L);
}

/* SINGLE or DUAL blasters. firing/aiming → draw; idle → back to the hip.
   mode.braced (RMB, aimed fire): both guns stay drawn down the aim line; the single blaster's off arm comes up as
   the gauntlet-shield arm. mode.backRun (running away from the reticle): only one hand draws, the chest twists that
   shoulder back toward the target and the head turns to it, while the legs keep running the other way. The single
   blaster always shoots back with the gun hand; dual blasters shoot back with whichever hand is on the target's
   side (player.backHand, which weapons.js fires from). mode.rex: the trooper's DC-17s rest Rex's way (REX above)
   instead of at the hips; mode.run (the trooper on the run or at a sprint) brings the off hand's up beside the other. */
export function pistolPose(dt, R, player, worldAim, dual, mode = {}){
  const { braced, backRun, rex, run } = mode;
  draw.run += ((run ? 1 : 0) - draw.run) * Math.min(1, dt * (run ? 9 : 5));
  let restL = REX.L;
  if (rex && draw.run > 0.001){
    const k = draw.run * draw.run * (3 - 2 * draw.run);
    _restL.hand.copy(REX.L.hand).lerp(REX_RUN_L.hand, k);
    _restL.dir.copy(REX.L.dir).lerp(REX_RUN_L.dir, k).normalize();
    _restL.up.copy(REX.L.up).lerp(REX_RUN_L.up, k).normalize();
    restL = _restL;
  }
  const hot = braced || player.firing || player.aiming > 0 || player.zoom;
  const twoGuns = dual && !backRun;
  player.backHand = backRun && dual ? backHand(R, worldAim, player.backHand) : 'R';
  const backL = player.backHand === 'L';
  const tgtR = hot && !backL ? 1 : 0, tgtL = hot && (twoGuns || backL) ? 1 : 0;
  draw.R += (tgtR - draw.R) * Math.min(1, dt * (tgtR > draw.R ? 22 : 4));   // quick draw, unhurried re-holster
  draw.L += (tgtL - draw.L) * Math.min(1, dt * (tgtL > draw.L ? (backL ? 22 : 18) : 4));
  // gunslinger blade-on: the gun shoulder turns toward the target when one-handed
  const side = backL ? -1 : 1, k = backL ? draw.L : draw.R;
  const twist = backRun ? backTwist(R, worldAim, side) * k : (twoGuns ? 0 : -0.32 * draw.R);
  R.chest.rotation.y += (twist - R.chest.rotation.y) * Math.min(1, dt * 12);
  if (backRun) lookAtAim(dt, R, worldAim, k, side);
  const rec = player.recoil || 0;
  const fired = player.firePistol || 1;   // dual: the gun that just fired kicks
  const aimR = aimFrom(R.chest, R.armR.sh.position, worldAim, _aim);
  if (backRun) overShoulder(aimR, 1);
  pistolArm(R, R.armR, player.pistols.R, aimR, draw.R, twoGuns ? (fired < 0 ? rec : rec * 0.3) : backL ? 0 : rec, POLE_R, rex ? REX.R : null);
  if (dual){
    const aimL = aimFrom(R.chest, R.armL.sh.position, worldAim, _aim);
    if (backRun) overShoulder(aimL, -1);
    pistolArm(R, R.armL, player.pistols.L, aimL, draw.L, backRun ? (backL ? rec : 0) : fired > 0 ? rec : rec * 0.3, POLE_L, rex ? restL : null);
  } else if (braced){
    // shield arm: forearm up across the chest, fist forward, behind the gauntlet's energy disc
    solveArm(R.armL, _h.set(-0.14, 0.08, 0.42), POLE_L);
    R.armL.wr.quaternion.identity();
  } else {
    // free hand: relaxed by the belt, a little out from the body
    solveArm(R.armL, _h.set(-0.3, -0.44, 0.08 + draw.R * 0.06), POLE_L);
    R.armL.wr.quaternion.identity();
  }
}

/* The target's bearing in `node`'s frame, measured round from the front toward `side` (+1 the gun hand's side, -1
   the off hand's): 0 ahead, π/2 square to that shoulder, π dead behind. It wraps on the far side (past -π/2), never
   behind, so a target near dead behind reads as about π, not as π on one frame and -π on the next (which used to
   swing the chest and the helmet from one shoulder to the other as the crosshair drifted across). */
function sideBearing(node, worldAim, side, from = null){
  node.updateWorldMatrix(true, false);
  _p.copy(worldAim).applyMatrix4(_m.copy(node.matrixWorld).invert());
  if (from) _p.sub(from);
  const a = Math.atan2(_p.x * side, _p.z);
  return a < -Math.PI / 2 ? a + Math.PI * 2 : a;
}

/* Dual back-run: shoot back with the hand on the target's side. Changes hands only once the target is well across
   the line behind him, so a target dead behind doesn't flick the guns from hand to hand. */
function backHand(R, worldAim, cur){
  const g = sideBearing(R.torso, worldAim, 1);   // ≈ π dead behind; more = round toward the off hand
  if (cur === 'L') return g < Math.PI - 0.3 ? 'R' : 'L';
  return g > Math.PI + 0.3 ? 'L' : 'R';
}

/* Running away while shooting: how far the chest turns (rig y) so the shooting shoulder faces the target behind. A
   real torso only twists so far; the gun arm and the head make up the rest. */
function backTwist(R, worldAim, side){
  return side * THREE.MathUtils.clamp(sideBearing(R.torso, worldAim, side) - Math.PI / 2, -0.35, 0.95);
}
/* ...and the helmet turns to the reticle, over the shooting shoulder (k fades it in with the draw). */
function lookAtAim(dt, R, worldAim, k, side){
  const a = sideBearing(R.chest, worldAim, side, R.head.position);
  const yaw = side * Math.min(a, 1.4) * k;
  R.head.rotation.y += (yaw - R.head.rotation.y) * Math.min(1, dt * 14);
}
/* A gun arm can only reach so far round behind: past ~150° from the chest's front it would swing through the back,
   so the arm stops there and points back over the shoulder (bolts still fly from muzzleOrigin to the reticle). */
const BEHIND_MAX = 2.6;
function overShoulder(dir, side){
  let a = Math.atan2(dir.x * side, dir.z);
  if (a < -Math.PI / 2) a += Math.PI * 2;
  if (a <= BEHIND_MAX) return dir;
  const flat = Math.hypot(dir.x, dir.z);
  dir.x = Math.sin(BEHIND_MAX) * flat * side; dir.z = Math.cos(BEHIND_MAX) * flat;
  return dir;
}

/* THE TROOPER'S SPRINT (player/trooper/sprint.js): both arms swing from the shoulder against the stride like a
   sprinter's, elbows bent, the hands passing close by the ribs from the hip to the chest. Plain joint angles (no IK:
   a pendulum swing reads as running, a hand steered between points reads as a puppet). The guns sit straight in the
   fists, so a pistol follows its forearm, level out front, angled at the ground behind. The DC-15 (or the launcher)
   rides in the gun hand alone on a shorter, stiffer swing, its barrel along the forearm; the free hand pumps full.
   `k` (0..1) blends it in over whatever the arms already hold this frame (Rex's carry, the long-gun rest), so the
   sprint eases in and out; `ph` is the stride's clock (player.runPhase: the right arm forward as sin(ph) rises).
   Tuning: data/trooper.js sprint.arms. */
const _save = Array.from({ length: 6 }, () => new THREE.Quaternion());
// one arm: `a` 1 swung fully forward … -1 fully back; side +1 the right arm, -1 the left
function swingArm(arm, a, side, P){
  const fw = Math.max(0, a), bk = Math.max(0, -a);
  arm.sh.rotation.set(P.base - a * P.swing, side * P.yaw * fw, -side * (P.tuck + P.out * bk));
  arm.el.rotation.set(-(P.bend + P.bendFwd * fw - P.open * bk), 0, 0);
  arm.wr.rotation.set(P.wrist + (P.wristFwd || 0) * fw - (P.wristBack || 0) * bk, 0, 0);
}
export function sprintArms(dt, R, player, k, ph, twoH, dual, A){
  if (k <= 0.001) return;
  const arms = [R.armR.sh, R.armR.el, R.armR.wr, R.armL.sh, R.armL.el, R.armL.wr];
  arms.forEach((j, i) => _save[i].copy(j.quaternion));
  const sw = Math.sin(ph);
  if (twoH){
    swingArm(R.armR, sw * A.carry.amp, 1, A.carry);
    swingArm(R.armL, -sw, -1, A.free);
    const gun = player.rifleMesh;
    if (gun){ rememberRest(gun); gun.quaternion.slerp(gun.userData.restQ, Math.min(1, dt * 14)); }
  } else {
    swingArm(R.armR, sw, 1, A.pistol);
    swingArm(R.armL, -sw, -1, dual ? A.pistol : A.free);
    for (const g of [player.pistols.R, dual && player.pistols.L]) if (g){ rememberRest(g); g.quaternion.slerp(g.userData.restQ, Math.min(1, dt * 14)); }
  }
  // ease in from the pose the arms held before this
  if (k < 0.999) arms.forEach((j, i) => j.quaternion.copy(_save[i].slerp(j.quaternion, k)));
}

/* DISRUPTOR shouldered: gun hand by the weapon-side collarbone, rifle down the aim line, off hand on the foregrip. */
// thrust: the disruptor's spear stab (-0.3 chambered back … 1 at full reach): the stock comes off the shoulder to
// the hip line and both hands drive it down the aim, the chest squaring into it
export function riflePose(dt, R, player, worldAim, thrust = 0){
  draw.rifle += (1 - draw.rifle) * Math.min(1, dt * 14);
  const stab = thrust !== 0;
  R.chest.rotation.y += (-0.38 + Math.max(0, thrust) * 0.34 - R.chest.rotation.y) * Math.min(1, dt * (stab ? 24 : 10));   // bladed behind the stock
  const dir = aimFrom(R.chest, _p.set(0.1, 0.3, 0), worldAim, _aim);
  const rec = player.recoil || 0;
  _h.set(0.13, 0.17 - rec * 0.05 - (stab ? 0.14 : 0), 0.2 - rec * 0.1).addScaledVector(dir, 0.08 + thrust * 0.36);
  _d.copy(dir); _d.y += rec * 0.35; _d.normalize();
  const gun = player.rifleMesh;
  gripAt(R, R.armR, _h, POLE_R, gun.position, () => holdAim(R.chest, R.armR.wr, gun, Z, _d, gun.userData.restQ || gun.quaternion, Y, Y));
  // off hand under the barrel, about a forearm out from the trigger hand: its fist closed round the foregrip from below,
  // the palm up, the fingers wrapping the far side (the barrel runs through the off fist's hollow, as the hilt does)
  pointInChest(R.chest, gun, _p.set(0, 0.03, 0.42), _h);
  gripAt(R, R.armL, _h, _p.set(-0.3, -0.9, 0.1).normalize(), OFF_FIST, () => holdAim(R.chest, R.armL.wr, null, FORE_AXIS, _d, FORE_REST, FORE_UP, Y));
}
const OFF_FIST = new THREE.Vector3(...fistAt(-1));
/* the foregrip in the off fist, cupped from below: the barrel lies along the fist's hollow (the wrist's z, the thumb toward
   the muzzle) and the gun sits on the palm, its top the way the left palm faces (the wrist's +x) */
const FORE_AXIS = new THREE.Vector3(0, 0, 1), FORE_UP = new THREE.Vector3(1, 0, 0), FORE_REST = new THREE.Quaternion();
export function rifleLowered(){ draw.rifle = 0; }

/* hand a gun back to its mount rotation (when an FK pose — brace, flight, punch — owns the arm) */
export function restGun(gun, dt){
  if (!gun) return;
  if (!gun.userData.restQ) gun.userData.restQ = gun.quaternion.clone();
  gun.quaternion.slerp(gun.userData.restQ, Math.min(1, dt * 14));
}
export function rememberRest(gun){ if (gun && !gun.userData.restQ) gun.userData.restQ = gun.quaternion.clone(); }
