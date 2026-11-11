// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* POSE INERTIA — no move starts with a snap. The pose code (player/animation.js) works out where every joint should be
   each frame, and when the hero changes what he is doing (lands, stops a sprint, starts a cut, comes out of a dash, raises
   a gun) some joints used to be somewhere else entirely one frame later. Here, last of all, each joint that jumped keeps
   going from where it was and closes on its new pose over a beat (INERTIA.time), easing in and out, so one move flows
   into the next. A joint that didn't jump isn't touched, so a cut in flight, the aim and the stride are exactly the
   pose code's own.

   The pose code damps its joints from where they stood last frame, so it has to be handed back its own values: `inertiaReset`
   (first thing in animatePlayer) puts every joint back as the pose left it, and `inertiaApply` (last) lays the blend on
   top, as anim/handoff.js does for a hilt changing hands. The blade's sweep for hits (jedi/bladehit.js) runs inside the
   pose, on the pose's own joints, so what a cut hits and when is unchanged. */

import * as THREE from 'three';
import { G, player, isGunner } from '../../state.js';

export const INERTIA = {
  time: 0.16,        // s for a joint to close on its new pose after a change of move
  swingTime: 0.08,   // ...into a cut or a strike: quicker, the button still answers at once
  landTime: 0.18,    // ...onto the ground out of the air
  min: 0.07,         // rad: a joint that jumped less than this at a change of move is left alone (the pose already blends it)
  minPos: 0.025,     // m: the same for the body's own shift (hips, the flip pivot)
  teleport: 0.75,    // rad in one frame with no change of move: still a snap, blended the same way
  most: 2.5,         // rad: further than this is a turn right round, not a pose change: it snaps as before
  mostPos: 0.6,      // m
};

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const ID = new THREE.Quaternion();

// the joints that carry the pose (model/rig.js); vis is the flip pivot under the body's yaw
function jointsOf(R, vis){
  const J = [vis, R.hips, R.torso, R.chest, R.head];
  for (const a of [R.armL, R.armR]) if (a) J.push(a.sh, a.el, a.wr);
  for (const l of [R.legL, R.legR]) if (l) J.push(l.hip, l.knee, l.ank);
  return J.filter(Boolean);
}
function build(R, vis){
  return { rig: R, key: '', dt: 0, tracks: jointsOf(R, vis).map(node => ({
    node, pos: node === vis || node === R.hips,
    raw: new THREE.Euler(), rawP: new THREE.Vector3(), has: false,          // the pose's own values, handed back next frame
    out: new THREE.Quaternion(), outP: new THREE.Vector3(),                  // what was shown
    prev: new THREE.Quaternion(), prevP: new THREE.Vector3(), seen: 0,       // ...and the frame before (to carry its motion on)
    rawQ: new THREE.Quaternion(), rawStep: 0,                                // the pose last frame, and how far it moved to get there
    axis: new THREE.Vector3(1, 0, 0), ang: 0, vel: 0, w: 0,                  // the offset still to close: a turn about `axis`
    off: new THREE.Vector3(), offV: new THREE.Vector3(), wp: 0,              // ...and a shift
  })) };
}
const stateOf = () => { const R = player.rig; let S = player._inertia; if (!S || S.rig !== R) S = player._inertia = build(R, player.vis); return S; };

/* what the hero is doing, as far as his pose goes: a change in any of these is a change of move. (The catches and the
   recoil of a shot are left out on purpose: they are meant to snap.) */
function moveKey(){
  const p = player, sw = p.atkT > 0 && p.swing;
  return [G.hero, p.weapon, isGunner() ? '' : G.stance, p.grounded ? 1 : 0, p.flip ? p.flip.kind || 'f' : 0, p.slamming ? 1 : 0,
    sw ? sw.at : 0, p.blockHeld ? 1 : 0, p.sprinting ? 1 : 0, p.slideT > 0 ? 1 : 0, p.mantle ? 1 : 0, p.hang ? 1 : 0, p.wallRun ? 1 : 0,
    p.cover ? 1 : 0, p.holstered ? 1 : 0, p.stowed ? 1 : 0, p.zoom ? 1 : 0, p.flinchT > 0 ? 1 : 0, p.landStagT > 0 ? 1 : 0,
    p.castT > 0 ? 1 : 0, p.kickT > 0 ? 1 : 0, p.palmT > 0 ? 1 : 0, p.judgeT > 0 ? 1 : 0, p.darkT > 0 ? 1 : 0, p.clinch ? 1 : 0,
    p.downed ? 1 : 0, p.fin ? 1 : 0, p.saberLock ? 1 : 0, p.airCut ? 1 : 0, p.dashT > 0 ? 1 : 0, p.hovering ? 1 : 0, p.gliding ? 1 : 0].join('|');
}
// how long this change takes to blend: a strike answers quickest, a landing takes its time
function blendTime(was, now){
  const a = was.split('|'), b = now.split('|');
  if (a[6] !== b[6] && b[6] !== '0') return INERTIA.swingTime;                    // a cut starts
  if (a[19] !== b[19] || a[20] !== b[20] || a[21] !== b[21]) return INERTIA.swingTime;   // a cast, a kick, a palm strike
  if (a[3] === '0' && b[3] === '1') return INERTIA.landTime;                      // touchdown
  return INERTIA.time;
}

// before the pose: every joint back as the pose left it (unless something else has moved it since: a cutscene, a team-up)
export function inertiaReset(){
  const S = player._inertia;
  if (!S || S.rig !== player.rig) return;
  for (const t of S.tracks){
    if (!t.has) continue;
    t.has = false;
    const n = t.node;
    if (Math.abs(n.quaternion.dot(t.out)) > 0.999999) n.rotation.copy(t.raw);
    if (t.pos && n.position.distanceToSquared(t.outP) < 1e-10) n.position.copy(t.rawP);
  }
}

// drop every blend in flight (a cutscene's cut, a new life, a hero swap): the next frame is the pose's own
export function inertiaClear(){
  const S = player._inertia;
  if (!S) return;
  for (const t of S.tracks){ t.ang = t.vel = 0; t.off.set(0, 0, 0); t.offV.set(0, 0, 0); t.seen = 0; }
  S.key = '';
}

// a critically damped close on zero: x and its speed after dt, at rate w
function closeOn(x, v, w, dt){
  const e = Math.exp(-w * dt), j = (v + w * x) * dt;
  return [(x + j) * e, (v - j * w) * e];
}

// after the pose: blend whatever jumped
export function inertiaApply(dt){
  if (!player.rig || !player.vis) return;
  const S = stateOf();
  // a cutscene poses and cuts as it likes; a frozen clock shows the pose as it stands
  if (G.cutscene || G.mode !== 'play'){ inertiaClear(); return; }
  if (!(dt > 0)){   // a held clock (a pause that still poses): the blend stands as it was
    for (const t of S.tracks){
      const n = t.node;
      t.raw.copy(n.rotation); if (t.pos) t.rawP.copy(n.position);
      if (t.ang > 1e-4) n.quaternion.premultiply(_q2.setFromAxisAngle(t.axis, t.ang));
      if (t.pos) n.position.add(t.off);
      t.out.copy(n.quaternion); if (t.pos) t.outP.copy(n.position);
      t.has = true;
    }
    return;
  }
  const key = moveKey(), changed = S.key !== '' && key !== S.key;
  const T = changed ? blendTime(S.key, key) : INERTIA.time, wNew = 4.75 / T;   // (the close is within 5% by T)
  const ratio = S.dt > 0 ? Math.min(2, dt / S.dt) : 0;
  for (const t of S.tracks){
    const n = t.node;
    t.raw.copy(n.rotation); _q.copy(n.quaternion);   // the pose's own
    if (t.pos) t.rawP.copy(n.position);
    // how far the pose moved this frame, against how far it moved the last one: a snap is a step out of all proportion
    const step = t.seen ? 2 * Math.acos(Math.min(1, Math.abs(_q.dot(t.rawQ)))) : 0;
    const snap = t.seen >= 2 && step - t.rawStep * (ratio || 1) > INERTIA.teleport;
    if ((changed || snap) && t.seen >= 2){
      // where the joint would have been had it carried on: last frame's shown pose, moved on by its own last step
      _q2.copy(t.out).multiply(_q3.copy(t.prev).invert());                 // last frame's step (in the parent's frame)
      _q2.slerp(ID, 1 - ratio).multiply(t.out);                            // ...scaled to this frame, laid on
      _q3.copy(_q).invert(); _q2.multiply(_q3);                             // the offset: carried-on pose × pose⁻¹
      if (_q2.w < 0){ _q2.x = -_q2.x; _q2.y = -_q2.y; _q2.z = -_q2.z; _q2.w = -_q2.w; }
      const ang = 2 * Math.acos(Math.min(1, _q2.w));
      if (ang > INERTIA.min && ang < INERTIA.most){
        const s = Math.sqrt(Math.max(1e-12, 1 - _q2.w * _q2.w));
        t.axis.set(_q2.x / s, _q2.y / s, _q2.z / s); t.ang = ang; t.vel = 0; t.w = wNew;
      } else if (ang >= INERTIA.most){ t.ang = t.vel = 0; }
      if (t.pos){
        _v.copy(t.outP).sub(t.prevP).multiplyScalar(ratio).add(t.outP).sub(t.rawP);
        const d = _v.length();
        if (d > INERTIA.minPos && d < INERTIA.mostPos){ t.off.copy(_v); t.offV.set(0, 0, 0); t.wp = wNew; }
        else if (d >= INERTIA.mostPos){ t.off.set(0, 0, 0); t.offV.set(0, 0, 0); }
      }
    }
    t.rawStep = step; t.rawQ.copy(_q);
    // close the offsets, and lay what's left on the pose
    t.prev.copy(t.out); t.prevP.copy(t.outP);
    if (t.ang > 1e-4){
      [t.ang, t.vel] = closeOn(t.ang, t.vel, t.w, dt);
      if (t.ang < 1e-4) t.ang = t.vel = 0;
      else { n.quaternion.premultiply(_q2.setFromAxisAngle(t.axis, t.ang)); }
    }
    if (t.pos && t.off.lengthSq() > 1e-8){
      const e = Math.exp(-t.wp * dt);
      _v2.copy(t.offV).addScaledVector(t.off, t.wp).multiplyScalar(dt);    // j = (v + w x) dt
      t.off.add(_v2).multiplyScalar(e);
      t.offV.addScaledVector(_v2, -t.wp).multiplyScalar(e);
      if (t.off.lengthSq() < 1e-8){ t.off.set(0, 0, 0); t.offV.set(0, 0, 0); }
      else n.position.add(t.off);
    }
    t.out.copy(n.quaternion); if (t.pos) t.outP.copy(n.position);
    t.has = true; t.seen = Math.min(2, t.seen + 1);
  }
  S.key = key; S.dt = dt;
}
