// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FOE STANCES at runtime (data/foe-stances.js): a duellist's guard held in its own form. The weapon arm's pose on each
// line (guardArm, read by enemies/duel.js guardPose), the saber's angle in the fist and the reverse grip (the saber slot,
// enemies/mesh.js weaponArm), the body's turn, pitch and crouch (read by enemies/upper.js and enemies/gait.js), and the
// free hand: held in its form's pose or closed on the hilt (stanceArms, run from enemies/upper.js after the arm swing).
// The host runs it from enemies/duel.js updateDuel, a co-op guest from updatePuppetDuel off the snapshot's guard, so a
// puppet stands its form on both screens.

import * as THREE from 'three';
import { FOE_STANCE, OFF_HAND, TWO_HAND, STAFF_STANCE, STANCE_RATE } from '../data/foe-stances.js';
import { reachPose } from './mesh.js';

const damp = (a, b, dt, r) => a + (b - a) * (1 - Math.exp(-r * dt));
const stanceOf = e => (e && e.ff && FOE_STANCE[e.ff]) || null;
const REVERSE = Math.PI - 0.9;   // the reverse grip: the blade turned back past the forearm, a little off it
const NONE = [0, 0];

/* the weapon's pose on a guarded line: P is data/duel.js GUARD_POSE or BLOCK_POSE. A staff ([rotation.z, .x]) guards
   across the body (STAFF_STANCE); a sword arm ([raise, out]) takes its form's own guard, nudged by its `arm` */
export function guardArm(e, P, line, blk){
  const u = e.group.userData;
  if (u.staff){
    if (e.ff && !blk && STAFF_STANCE.guard[line]) return STAFF_STANCE.guard[line];
    return P.staff[line] || P.staff.H;
  }
  const base = P.sword[line] || P.sword.H, S = stanceOf(e);
  if (!S) return base;
  const own = blk ? S.block : S.guard, p = own && own[line] ? own[line] : base, a = S.arm;
  if (!a) return p;
  const k = blk ? 0.5 : 1;   // (a block still goes out to meet the cut: half the form's lean on it)
  return [p[0] + a[0] * k, p[1] + a[1] * k];
}
// its form's pull on a wind-up's chamber: [raise, out] (Djem So hauls back higher, Ataru winds low)
export const windAdd = e => { const S = stanceOf(e); return (S && S.wind) || NONE; };
// what its blade's line hangs on in a saber lock (a reverse grip binds the other way: enemies/duel.js lockArm caches by it)
export const gripKey = e => { const S = stanceOf(e); return S && S.grip === 'reverse' ? 'rev' : ''; };

/* every frame for a duellist with a form: `on` while its guard is up (host: duel.js GUARDING; guest: the snapshot's),
   `line` the line it covers (or the one it has read and is blocking) */
export function updateStance(e, dt, on, line){
  const u = e.group.userData, S = stanceOf(e);
  const cut = e.state === 'windup' || e.state === 'strike', lock = e.state === 'lock';
  const k = e.stk = damp(e.stk || 0, on && (S || (u.staff && e.ff)) ? 1 : 0, dt, cut ? STANCE_RATE.body * 2 : STANCE_RATE.body);
  const B = u.staff ? (e.ff ? STAFF_STANCE : null) : S;
  e.stanceTwist = B && B.twist ? B.twist * k : 0;
  e.stanceLean = B && B.lean ? B.lean * k : 0;
  e.stanceDrop = B && B.drop ? B.drop * k : 0;
  // the staff drawn in to the body's middle to be held across it
  if (u.staff){
    if (!u.staff0) u.staff0 = u.staff.position.clone();
    const A = e.ff ? STAFF_STANCE.at : NONE;
    e.staffLift = damp(e.staffLift || 0, e.ff && on && !cut ? STAFF_STANCE.lift[line] || 0 : 0, dt, STANCE_RATE.wrist);   // high or low on its line
    u.staff.position.set(u.staff0.x + (A[0] || 0) * k, u.staff0.y + (A[1] || 0) * k + e.staffLift, u.staff0.z + (A[2] || 0) * k);
  }
  // the saber in the fist: its form's grip always, its guard's wrist only while it guards (straight for a cut or a bind)
  if (u.saber && u.weaponArm){   // (an arm a cut took off carries its saber away with it)
    if (!u.saber0) u.saber0 = u.saber.rotation.clone();
    const rev = S && S.grip === 'reverse' ? REVERSE : 0;
    const w = S && S.wrist && on && !cut && !lock ? (S.wrist[line] || S.wrist.H || NONE) : NONE;
    const tx = u.saber0.x + rev + w[0], tz = u.saber0.z + w[1];
    if (lock){ u.saber.rotation.x = tx; u.saber.rotation.z = tz; }   // (the bind's pose is solved with the wrist set: duel.js lockArm)
    else {
      u.saber.rotation.x = damp(u.saber.rotation.x, tx, dt, STANCE_RATE.wrist);
      u.saber.rotation.z = damp(u.saber.rotation.z, tz, dt, STANCE_RATE.wrist);
    }
  }
  // both hands on the hilt for a two-handed form, through the guard and its cuts (not in a bind: the arm is solved alone)
  e.twoHand = !!(S && S.off === 'hilt' && !lock && (on || cut));
}

/* THE FREE HAND (enemies/upper.js, after the arm's own swing): eased into its form's pose while it guards, or closed on
   the hilt while the hilt is in reach. Both are a two-bone reach (enemies/mesh.js reachPose, as the staff's hands):
   the pose onto a spot by the shoulder, the grip onto the hilt's pommel. */
const Qp = new THREE.Quaternion(), P = new THREE.Vector3(), out = { b: 0 };
function pommel(u, a){
  a.parent.updateWorldMatrix(true, false); u.saber.updateWorldMatrix(true, false);
  return a.parent.worldToLocal(u.saber.localToWorld(P.fromArray(TWO_HAND.at)));
}
/* JAR'KAI'S SECOND SABER — a foe fighting in Jar'Kai (e.ff 'jarkai', on the host and on a co-op guest alike, from the
   snapshot's form) carries a copy of its own saber in the off hand. It is made the first time it's needed (the same
   meshes and materials, so it burns the same colour and streaks: fx/trail.js finds its tagged glow) and hidden whenever
   the foe changes out of the form. */
function offSaber(o, u){
  const on = o.ff === 'jarkai' && !!u.saber && !!u.elbowOff;
  if (!on){ if (u.offSaber) u.offSaber.visible = false; return null; }
  if (!u.offSaber){
    const c = u.saber.clone(true);
    c.position.set(0, -0.38, 0.03);   // the off fist (enemies/mesh.js arm: the grip group sits there on the elbow)
    c.rotation.copy(u.saber0 || u.saber.rotation);
    u.elbowOff.add(c);
    u.offSaber = c;
  }
  u.offSaber.visible = true;
  return u.offSaber;
}
// the weapon arm's recent swing, so the off arm can play it back a beat later (`follow` s), the same way across
const HIST = 24;
function remember(u, t){
  const h = u.armHist || (u.armHist = { i: 0, t: new Float32Array(HIST), x: new Float32Array(HIST), y: new Float32Array(HIST), z: new Float32Array(HIST) });
  const r = u.weaponArm.rotation, i = h.i = (h.i + 1) % HIST;
  h.t[i] = t; h.x[i] = r.x; h.y[i] = r.y; h.z[i] = r.z;
  return h;
}
const _e = new THREE.Euler(), Qf = new THREE.Quaternion();
function lagged(h, t, out){
  for (let n = 0, i = h.i; n < HIST; n++, i = (i - 1 + HIST) % HIST) if (h.t[i] <= t){ out.set(h.x[i], h.y[i], h.z[i]); return out; }
  return null;
}
export function stanceArms(o, u, dt){
  const a = u.offArm, el = u.elbowOff;
  if (!a || !el || !u.saber || !u.weaponArm) return;
  if (!u.offHome) u.offHome = a.parent;
  if (a.parent !== u.offHome){ if (u.offSaber) u.offSaber.visible = false; return; }   // a saber cut took it off: a loose piece now
  if (u.elbow0 == null) u.elbow0 = el.rotation.x;
  const S = stanceOf(o), k = o.stk || 0;
  const dual = offSaber(o, u);
  const hist = dual ? remember(u, (o.armClock = (o.armClock || 0) + dt)) : null;
  let bend = u.elbow0;
  const H = S && OFF_HAND[S.off === 'hilt' ? 'rest' : S.off];
  if (H && k > 0.001){
    P.set(a.position.x + H.at[0], a.position.y + H.at[1], a.position.z + H.at[2]);
    reachPose(a.position, P, H.tw, out, Qp);
    a.quaternion.slerp(Qp, k);
    bend += (-out.b - bend) * k;
  }
  // two hands: the pommel within reach of the off shoulder?
  const want = o.twoHand && pommel(u, a).distanceTo(a.position) < TWO_HAND.reach ? 1 : 0;
  o.thk = damp(o.thk || 0, want, dt, TWO_HAND.rate);
  if (o.thk > 0.001){
    if (!o.twoHand) pommel(u, a);
    reachPose(a.position, P, TWO_HAND.tw, out, Qp);
    a.quaternion.slerp(Qp, o.thk);
    bend += (-out.b - bend) * o.thk;
  }
  // JAR'KAI: through a cut the off arm swings the weapon arm's cut the same way across, `follow` s behind it
  if (dual && S && S.follow){
    const cut = o.state === 'windup' || o.state === 'strike' || o.state === 'recover';
    o.dfk = damp(o.dfk || 0, cut ? 1 : 0, dt, 14);
    if (o.dfk > 0.001 && lagged(hist, o.armClock - S.follow, _e)){
      a.quaternion.slerp(Qf.setFromEuler(_e), o.dfk);
      bend += (-0.25 - bend) * o.dfk;
    }
    // the off saber's wrist: stood up off the fist in the guard, straight down the arm for a cut
    dual.rotation.x = damp(dual.rotation.x, (u.saber0 ? u.saber0.x : 0) + (cut ? 0 : -1.05 * k), dt, 12);
  }
  el.rotation.x = bend;
}
