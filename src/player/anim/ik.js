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
const TWIST_BAND = 1.6;   // past this roll either way (rad) the forearm keeps the way round it already turned
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
  // a roll asked for near the half turn (the blade laid back past the wrist's reach either way round) could be taken
  // either way: it stays the way the forearm already rolled, and the forearm turns over to the other only once the
  // roll is well in reach that way
  const was = memo._holdTa;
  if (was !== undefined){
    if (Math.abs(ta) > TWIST_BAND && Math.abs(was) > TWIST_BAND && Math.sign(ta) !== Math.sign(was)) ta -= Math.sign(ta) * Math.PI * 2;
  }
  ta = THREE.MathUtils.clamp(ta, -lim.twist, lim.twist);
  memo._holdTa = ta;
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
  if (node && node.parent === wr){   // (only a weapon really in this hand: one clipped on the belt or holstered keeps the turn its socket gave it)
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
    solveArmClear(arm, _wt, pole);
    arm.wr.updateWorldMatrix(true, false);
    aim();
    arm.wr.updateWorldMatrix(true, false);
    pointInChest(R.chest, arm.wr, _fp.copy(fistLocal), _wq);
    wristInChest(R.chest, arm, _fp);
    off.subVectors(_wq, _fp);
  }
}

/* THE ARM KEEPS OFF THE BODY — a cut that carries the hand across the chest, low past the hip or up past the head can ask
   for an elbow that (by the pole alone) folds in THROUGH the torso or swings round BEHIND the back. solveArmClear runs
   the two-bone solve as solveArm does, but first:
     · a wrist target inside the torso is pushed out of it (forward, or out to its own side), and one round behind the
       back is brought forward to beside it;
     · of the ring of elbows that reach that wrist (the arm turning about its shoulder → wrist line), the one nearest
       the pose's pole is kept unless it sinks the upper arm or the forearm into the torso or behind the back; then
       the nearest one round the ring that clears (or clears the most) is taken, so the elbow flares out to the side
       or drops, as a real arm does when the hand comes across.
   TORSO is the body in chest space (an upright ellipse from the belt to the collar, the shoulders' own joint left out). */
export const TORSO = { rx: 0.2, rz: 0.15, lo: -0.75, top: 0.28, back: -0.16, pad: 0.05 };
const _sw = new THREE.Vector3(), _st = new THREE.Vector3(), _sd = new THREE.Vector3(), _su = new THREE.Vector3(), _sv = new THREE.Vector3(), _se = new THREE.Vector3(), _sp = new THREE.Vector3(), _sq = new THREE.Vector3(), _sP = new THREE.Vector3();
// how far a chest-space point sinks into the torso (padded by the limb's own thickness), and how far round behind the back
function bodyCost(q, pad){
  let c = 0;
  if (q.y > TORSO.lo && q.y < TORSO.top){
    const rx = TORSO.rx + pad, rz = TORSO.rz + pad, k = Math.hypot(q.x / rx, q.z / rz);
    if (k < 1) c += (1 - k) * rz;
  }
  if (q.z < TORSO.back && Math.abs(q.x) < TORSO.rx + 0.12 && q.y < TORSO.top + 0.3) c += (TORSO.back - q.z) * 0.6;
  return c;
}
function armCost(S, E, T){
  let c = 0;
  for (let i = 3; i <= 10; i++) c += bodyCost(_sq.copy(S).lerp(E, i / 10), TORSO.pad);   // (the upper arm, past the shoulder's own round)
  for (let i = 1; i <= 10; i++) c += bodyCost(_sq.copy(E).lerp(T, i / 10), TORSO.pad * 0.8);
  return c;
}
const CLEAR = 1e-4, STEP = 0.22, EDGE = 0.03, KEEP = 0.45, ELBOW_RATE = 22, POLE_FIRM = 0.5;   // clear enough; the ring search's step, the margin past the edge (rad); how much the last way is preferred; how fast the elbow settles (/s); how far off the arm's line a pole must lie to hold the elbow alone
export function solveArmClear(arm, target, pole){
  const a = DIM.upper, b = DIM.fore, S = arm.sh.position;
  const T = _st.copy(target);
  // the wrist itself out of the torso: out along its own way from the body's middle (level), past the padded edge
  if (T.y > TORSO.lo && T.y < TORSO.top){
    const rx = TORSO.rx + TORSO.pad, rz = TORSO.rz + TORSO.pad, k = Math.hypot(T.x / rx, T.z / rz);
    if (k < 1){
      if (k < 1e-3){ T.z = rz; }
      else if (T.z < 0 && Math.abs(T.x) < rx * 0.7){ T.x = Math.sign(T.x || S.x) * rx * 0.9; T.z = Math.max(T.z, -rz * 0.2); }   // (behind the middle: round to its side)
      else { T.x /= k; T.z /= k; }
    }
  }
  if (T.z < TORSO.back && Math.abs(T.x) < TORSO.rx + 0.12) T.z = TORSO.back;   // never round behind the back
  const d = _sd.subVectors(T, S), dist = THREE.MathUtils.clamp(d.length(), 0.08, a + b - 0.002);
  const dn = d.normalize();
  // the ring of elbows: centre and radius from the triangle's sides, the pole's own spot on it first
  const ca = THREE.MathUtils.clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), r = a * Math.sqrt(1 - ca * ca);
  const C = _sv.copy(S).addScaledVector(dn, a * ca);
  // (a pole laid nearly along the arm's own line names no side for the elbow, and a centimetre of wrist would swing it
  // right round: as it lines up the elbow is let drop instead, so it hangs down where the pole stops saying)
  const u = _su.copy(pole).normalize(), pl = Math.sqrt(Math.max(0, 1 - u.dot(dn) ** 2));
  u.addScaledVector(dn, -u.dot(dn));
  if (pl < POLE_FIRM) u.addScaledVector(_sw.set(0, -1, 0).addScaledVector(dn, dn.y), (POLE_FIRM - pl) / POLE_FIRM * POLE_FIRM);
  if (u.lengthSq() < 1e-8) u.set(1, 0, 0).addScaledVector(dn, -dn.x);
  u.normalize();
  const Tw = _sP.copy(S).addScaledVector(dn, dist);
  const elbowAt = (ang, out) => out.copy(u).applyAxisAngle(dn, ang).multiplyScalar(r).add(C);
  const cost = ang => armCost(S, elbowAt(ang, _se), Tw);
  let best = 0;
  if (cost(0) > CLEAR){
    // round the ring each way: the first step that clears, then bisected back to the very edge of clearing (so the elbow
    // slides out as far as it must and no further, smoothly frame to frame, instead of jumping a whole step); failing
    // that, the least deep spot, likewise refined between the steps
    const way = sgn => {
      let prev = 0, lo = Infinity, at = 0;
      for (let i = 1; i <= 12; i++){
        const ang = sgn * i * STEP, c = cost(ang);
        if (c <= CLEAR){
          let x0 = prev, x1 = ang;
          for (let k = 0; k < 6; k++){ const m = (x0 + x1) / 2; if (cost(m) <= CLEAR) x1 = m; else x0 = m; }
          return { ang: x1 + sgn * EDGE, clear: true, c: 0, y: elbowAt(x1, _se).y };
        }
        if (c < lo){ lo = c; at = ang; }
        prev = ang;
      }
      let x0 = at - STEP, x1 = at + STEP;
      for (let k = 0; k < 8; k++){ const m1 = x0 + (x1 - x0) / 3, m2 = x1 - (x1 - x0) / 3; if (cost(m1) < cost(m2)) x1 = m2; else x0 = m1; }
      return { ang: (x0 + x1) / 2, clear: false, c: cost((x0 + x1) / 2), y: 0 };
    };
    const P = way(1), N = way(-1), was = arm._clrWay || 0;
    // which way: the one that clears (the nearer, or if both are about as near the lower elbow, so the arm drops and
    // flares out before it lifts) — but the way the elbow went last time is kept unless the other is clearly better,
    // so a guard hovering between two equal answers doesn't flick the elbow from one to the other
    const score = w => w.clear ? Math.abs(w.ang) + (was ? 0 : w.y * 0.6) - (was === Math.sign(w.ang) ? KEEP : 0)
                               : 10 + w.c * 40 - (was === Math.sign(w.ang) ? KEEP : 0);
    const W = score(P) <= score(N) ? P : N;
    best = W.ang;
    arm._clrWay = Math.sign(best);
  }
  // THE ELBOW SETTLES — it eases from where it was last frame toward that spot on the ring rather than snapping there,
  // so a guard whose answer hovers between two (the pole's own spot just clear or just not, a hand folded in close to
  // the shoulder where a centimetre of wrist swings the ring) holds still instead of shaking. Within one frame (a grip's
  // passes) it stays put, so only the wrist settles.
  const now = performance.now(), M = arm._clr || (arm._clr = { e: new THREE.Vector3(), t: -1e9 }), dt = (now - M.t) / 1000;
  if (dt < 0.25){
    const v = _sq.subVectors(M.e, C), w = _sw.crossVectors(dn, u);
    v.addScaledVector(dn, -v.dot(dn));
    if (v.lengthSq() > r * r * 0.04){
      const was = Math.atan2(v.dot(w), v.dot(u));
      let gap = best - was; gap -= Math.round(gap / (Math.PI * 2)) * Math.PI * 2;
      const goal = best, eased = was + gap * (1 - Math.exp(-ELBOW_RATE * dt)), cg = cost(goal), ok = Math.max(CLEAR, cg * 1.05);
      best = eased;
      // …but never INTO the body for it: an eased elbow that would sink where the goal clears is brought on just far
      // enough to clear (a fast cut carries the elbow out with it)
      if (cost(eased) > ok){
        let x0 = eased, x1 = goal;
        for (let k = 0; k < 7; k++){ const m = (x0 + x1) / 2; if (cost(m) <= ok) x1 = m; else x0 = m; }
        best = x1;
      }
    }
  }
  M.t = now;
  elbowAt(best, M.e);
  solveArm(arm, T, _sp.copy(u).applyAxisAngle(dn, best));
}
