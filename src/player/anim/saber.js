// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The bladed-weapon pose driver: guards and keyframed swings for the Jedi saber (both grips) and the Mando's darksaber.
// Poses come from data/poses.js as hand positions + blade directions in chest space; this solves them onto the rig.

import * as THREE from 'three';
import { SABER_GUARDS, DUAL_GUARDS, SABER_SWINGS, SWING_STYLE, SWING_OFF, SABER_DEFLECTS, SWING_VARIANTS, SWING_SPIN_KEYS, SWING_KEY_LOOK } from '../../data/poses.js';
import { AIR_GUARDS } from '../../data/agility.js';
import { CUT_ANGLE } from '../../data/stances.js';
import { DIM } from '../model/rig.js';
import { solveArm, aimHeld, pointInChest, wristInChest, axisInChest, slerpDir, arcLerp } from './ik.js';
import { STAFF } from '../model/weapons.js';
import { SWING_WEIGHT } from '../../data/swing-weight.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const PIVOT = new THREE.Vector3(0, 0.12, 0.04);   // the arc centre of a cut: between the shoulders, a touch forward
const OFF_REST = new THREE.Vector3(-0.3, -0.42, 0.12), OFF_POLE = new THREE.Vector3(-0.55, -0.8, -0.25);
const Y = new THREE.Vector3(0, 1, 0);
const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _ax = new THREE.Vector3(), _grip = new THREE.Vector3();
/* THE PROPELLER — a saber staff wheels about the middle of its long hilt, not about the fist: the hands pass it round
   between them, so as the staff turns the fist rides a small circle about the hilt's middle (STAFF_MID back down the
   hilt from it). `shiftToMid` moves the hand by however far the blade turned from `from`, keeping that middle still. */
const STAFF_MID = 0.2;
const _wd = new THREE.Vector3(), _wf = new THREE.Vector3();
const shiftToMid = (hand, from, to) => hand.addScaledVector(to, STAFF_MID).addScaledVector(from, -STAFF_MID);

// cache the data as vectors once
const vecOff = o => o && { hand: V(o.hand), pole: V(o.pole || [-0.55, -0.8, -0.25]).normalize(), sway: o.sway ?? 1 };   // sway: how much of the stride a free hand picks up (0 = held still, tucked)
const vecPose = p => p && ({ ...p, hand: V(p.hand), blade: V(p.blade).normalize(), pole: V(p.pole || [0.55, -0.8, -0.25]).normalize(),
  off: vecOff(p.off), offMove: vecOff(p.offMove), offFight: vecOff(p.offFight), offBlade: p.offBlade ? V(p.offBlade).normalize() : null });
/* JAR'KAI (data/forms.js jarkai): the off hand holds a saber of its own. A pose names where it points (offBlade); a pose
   that doesn't (an air guard, a catch) has it MIRROR the main blade across the body, so both blades read as a pair. */
const mirror = (v, out) => out.set(-v.x, v.y, v.z);
const _mo = new THREE.Vector3(), _mb = new THREE.Vector3();
const dualIn = (held) => !!(held && held.off && held.root && held.root.userData.dual);
/* JAR'KAI holds each hand in its own grip (data/forms.js DUAL_GRIPS): the off hand's grip, read off its hilt, and the
   off hand's half of a guard, taken from that grip's guard for the same form and key (ready, block, block2) */
const offGripIn = (held, grip) => dualIn(held) && held.off.root ? (held.off.root.userData.gripTo === 0 ? 'reverse' : 'regular') : grip;
const DUAL_G = {};
for (const k in DUAL_GUARDS){ DUAL_G[k] = {}; for (const key in DUAL_GUARDS[k]) DUAL_G[k][key] = { ...vecPose(DUAL_GUARDS[k][key]), mixed: true }; }
// the guard set a hand pose is drawn from: the grip's for the form, with a mixed-grip Jar'Kai's own guards laid over it
function guardSet(held, grip, form){
  const G0 = (GUARDS[grip] && (GUARDS[grip][form] || GUARDS[grip].niman)) || GUARDS.regular.niman;
  const og = offGripIn(held, grip), D = og !== grip && DUAL_G[grip + '/' + og];
  if (!D) return G0;
  const k = grip + '/' + og + '/' + form;
  return MIXED_SETS[k] || (MIXED_SETS[k] = { ...G0, ...D });
}
const MIXED_SETS = {};
function offGuard(held, grip, form, G0, g){
  const og = offGripIn(held, grip);
  if (og === grip || g.mixed) return g;
  const O = GUARDS[og] && GUARDS[og][form];
  if (!O) return g;
  return g === G0.block2 ? O.block2 || O.block : g === G0.block ? O.block : g === G0.ready ? O.ready : g;
}
const GUARDS = {}, SWINGS = {};
for (const g in SABER_GUARDS){ GUARDS[g] = {}; for (const f in SABER_GUARDS[g]) GUARDS[g][f] = { ready: vecPose(SABER_GUARDS[g][f].ready), block: vecPose(SABER_GUARDS[g][f].block), block2: vecPose(SABER_GUARDS[g][f].block2) }; }
const AIR = {};
for (const g in AIR_GUARDS){ AIR[g] = {}; for (const f in AIR_GUARDS[g]){ AIR[g][f] = {}; for (const k in AIR_GUARDS[g][f]) AIR[g][f][k] = vecPose(AIR_GUARDS[g][f][k]); } }
/* an agility guard (data/agility.js AIR_GUARDS) for this grip and form, or null to keep the form's ready guard. A form
   without its own (the newer forms) borrows the same grip's Niman, Ataru or Djem So pose for that key, so it still
   hangs from a ledge with its hands up or hammers down with the blade raised. */
const AIR_BORROW = ['niman', 'ataru', 'djemso'];
export function airGuard(grip, form, key){
  if (!key || !AIR[grip]) return null;
  const A = AIR[grip];
  if (A[form] && A[form][key]) return A[form][key];
  if (form === 'darksaber') return null;
  for (const f of AIR_BORROW) if (A[f] && A[f][key]) return A[f][key];
  return null;
}
for (const g in SABER_SWINGS){ SWINGS[g] = {}; for (const p in SABER_SWINGS[g]) SWINGS[g][p] = SABER_SWINGS[g][p].map(vecPose); }
/* ANGLE CUTS (data/stances.js CUT_ANGLE): the keyframes of a cut from `ang` degrees, blended between the tuned cuts
   either side of it on the clock and lifted or dropped for its height. The reverse grip takes the nearest tuned cut. */
const D2R = Math.PI / 180;
const HEIGHT_ID = { left: { high: 'leftHigh', low: 'leftLow' }, right: { high: 'rightHigh', low: 'rightLow' } };
// the anchors either side of `ang` on the clock, and how far it sits between them
function anchorsOf(ang){
  const A = CUT_ANGLE.anchors;
  ang = ((ang % 360) + 360) % 360;
  let i = A.length - 1;
  while (i > 0 && A[i][0] > ang) i--;
  const [a0, id0] = A[i], [n1, id1] = A[(i + 1) % A.length], a1 = n1 <= a0 ? n1 + 360 : n1;
  return { ang, id0, id1, t: (ang - a0) / (a1 - a0) };
}
// the tuned cut nearest `ang` at height h (the reverse grip's angle cuts): its key id in the set
function nearestId(set, ang, h){
  const { id0, id1, t } = anchorsOf(ang), id = t < 0.5 ? id0 : id1, hid = HEIGHT_ID[id] && HEIGHT_ID[id][h];
  return set[hid] ? hid : set[id] ? id : 'right';
}
function angleKeys(set, grip, ang, h){
  if (grip !== 'regular') return set[nearestId(set, ang, h)];
  const { id0, id1, t } = anchorsOf(ang);
  ang = ((ang % 360) + 360) % 360;
  const k0 = set[id0], k1 = set[id1], off = CUT_ANGLE[h];
  const w = CUT_ANGLE.vert + (1 - CUT_ANGLE.vert) * Math.abs(Math.cos(ang * D2R));
  return k0.map((p, j) => {
    const q = k1[j], hand = p.hand.clone().lerp(q.hand, t), blade = p.blade.clone().lerp(q.blade, t);
    if (off){ hand.y += off[j][0] * w; blade.y += off[j][1] * w; }
    return { hand, blade: blade.normalize(), twist: p.twist + (q.twist - p.twist) * t };
  });
}
const OFF_KEYS = { fore: SWING_OFF.fore.map(V), back: SWING_OFF.back.map(V) };   // (data arrays → vectors once)
const DEFLECTS = {};
for (const g in SABER_DEFLECTS){ DEFLECTS[g] = {}; for (const z in SABER_DEFLECTS[g]) DEFLECTS[g][z] = SABER_DEFLECTS[g][z].map(p => ({ ...vecPose(p), flick: V(p.flick || [0, 0, 0]) })); }
/* the over-the-top wrap a blade takes when the next cut chambers on the far side from where the last one finished:
   the hand rises past the head and the blade rolls up and back (regular) or lies back along the forearm (reverse) */
const WRAP_LIFT = new THREE.Vector3(0, 0.24, -0.1);
const WRAP_BLADE = { regular: new THREE.Vector3(0, 0.78, -0.62).normalize(), reverse: new THREE.Vector3(0, -0.55, -0.83).normalize() };

const TWIRL_AXIS = new THREE.Vector3(0.25, 0, 1).normalize();   // a wheel in front of the chest, just canted
const TWIRL_OFF = new THREE.Vector3(-0.5, 0.02, 0.18);   // where a two-handed wheel's free hand goes (the saber staff)
const easeOut = t => 1 - (1 - t) * (1 - t);
const DEF_POLE = new THREE.Vector3(0.55, -0.8, -0.25).normalize();
const REV_ROUND = -0.2;   // a reverse stroke whose blade turns further than this (dot of chamber and strike) goes round level
const HEAVY_LOOK = SWING_WEIGHT.look;
const COIL_HOLD = 0.22;   // the share of the stroke's time the blade hangs at the top of the chamber before it goes
/* A CUT IS ONE MOTION, not a bat swung at a ball (data/poses.js SWING_STYLE: load, accel, lag, recover):
   the wind-up eases into a chamber loaded a little deeper than its key, so the hang at the top is a slow settle, never a
   dead stop. The stroke accelerates into contact and CARRIES THROUGH: the follow-through leaves the strike at the speed
   the blade arrived with and bleeds it off over the rest of the arc, instead of slamming to a halt on contact. The wrist
   leads: the hilt starts the stroke with the tip trailing, the tip whips past at contact and leads out into the
   follow-through. The recovery flows back toward the guard and hands over at the speed the guard picks it up at. */
const TIP = 0.9;   // where along the blade the eye follows (the tip's travel sets the stroke's speed)
const _ta = new THREE.Vector3(), _tb = new THREE.Vector3();
const tipGap = (a, b) => _ta.copy(a.hand).addScaledVector(a.blade, TIP).distanceTo(_tb.copy(b.hand).addScaledVector(b.blade, TIP));
const powIn = (x, e) => Math.pow(x, e), powOut = (x, e) => 1 - Math.pow(1 - x, e);
// a Hermite ease from rest that leaves at slope m1 (≤ 3 keeps it from overshooting)
const settle = (x, m1) => x * x * (3 - 2 * x) + (x * x * x - x * x) * m1;
const GUARD_RATE = 9;   // guardPose's own blend rate, which the recovery hands over to

/* live, smoothed pose state (chest space) */
export const saberPose = {
  live: false,
  hand: new THREE.Vector3(), blade: new THREE.Vector3(0, 1, 0), pole: new THREE.Vector3(0.55, -0.8, -0.25),
  off: new THREE.Vector3().copy(OFF_REST), offPole: new THREE.Vector3().copy(OFF_POLE), two: 0,
  twist: 0, lean: 0,
  offBlade: new THREE.Vector3(0, 1, 0),   // Jar'Kai: which way the off hand's saber points (chest space)
  offLive: false,   // Jar'Kai: the off hand's follow-up is in its stroke right now (jedi/bladehit.js cuts with it)
  palm: 0,   // how open the free hand is held (1: the flat Force palm of Niman's reaching guard), for the fingers
  gaze: 0,   // how much of the upper body's turn the head undoes, so a side-on guard (Soresu) still looks at the foe
  sink: 0,   // how much lower the hips settle in this guard (the mixed-grip Jar'Kai block drops its base)
};

/* the held weapon: { node, axis } — axis is the blade direction in the node's own frame (flips with the grip) */
function bladeAxis(held, out){
  if (held.root) return out.copy(Y).applyQuaternion(held.root.quaternion);
  return out.copy(Y);
}

/* Seed the pose from wherever the arm currently is, so blending in from an FK pose (Force cast, mend…) is smooth. */
function seed(R, held){
  wristInChest(R.chest, R.armR, saberPose.hand);
  axisInChest(R.chest, held.node, bladeAxis(held, _ax), saberPose.blade);
  wristInChest(R.chest, R.armL, saberPose.off);
  saberPose.twist = R.chest.rotation.y;
  saberPose.two = 0;
  saberPose.live = true;
}

/* GUARD — damp the live pose toward the form's ready or block guard. `sway` adds stride carriage while moving
   (sway.off swings a free off hand with the stride). `over` swaps in an agility guard (airGuard) for flips, dives,
   landings and the run; `rate` scales how fast the pose gets there. */
export function guardPose(dt, R, held, grip, form, blocking, sway, over = null, rate = 1){
  if (!saberPose.live) seed(R, held);
  const G0 = guardSet(held, grip, form);
  if (blocking && !wasBlocking && G0.block2) blockAlt = !blockAlt;
  wasBlocking = blocking;
  const g = (!blocking && over) || (blocking ? (blockAlt && G0.block2) || G0.block : G0.ready);
  switchT = Math.max(0, switchT - dt);
  const k = Math.min(1, dt * (blocking ? 18 : switchT > 0 ? SWITCH_RATE : 9) * rate);
  _t.copy(g.hand); _t.y += sway.y; _t.z += sway.z;
  // an air guard can whirl the weapon (data/agility.js 'wheel': `wheel` turns a second about `axis`, in chest space):
  // the target spins and the pose chases it fast, the staff turning about its middle
  let wd = null;
  if (g.wheel){
    wheelA += dt * g.wheel * Math.PI * 2;
    wd = _wd.copy(g.blade).applyAxisAngle(g._axis || (g._axis = V(g.axis || [1, 0, 0]).normalize()), wheelA);
    shiftToMid(_t, g.blade, wd);
  } else wheelA = 0;
  // mid-switch the blade swings out round the weapon side, never across the body or face
  const out = switchT > 0 ? Math.sin(Math.PI * switchT / SWITCH_TIME) : 0;
  if (out){ _t.x += 0.12 * out; _t.z += 0.08 * out; }
  saberPose.hand.lerp(_t, k);
  if (wd) slerpDir(saberPose.blade, wd, Math.min(1, dt * 30), saberPose.blade);
  else slerpDir(saberPose.blade, out ? _ax.copy(g.blade).addScaledVector(OUTX, SWITCH_OUT * out).normalize() : g.blade, k, saberPose.blade);
  saberPose.pole.lerp(g.pole, k).normalize();
  saberPose.two += ((g.two ? 1 : 0) - saberPose.two) * Math.min(1, dt * 14);
  // a guard can rest its free hand while idle and bring it up as soon as the hero moves (offMove) or a fight is on (offFight)
  const gO = offGuard(held, grip, form, G0, g);   // (Jar'Kai with the hands in different grips)
  const off = (sway.fight && gO.offFight) || (sway.moving && gO.offMove) || gO.off;
  if (off){
    _p.copy(off.hand); if (sway.off){ const so = sway.off * off.sway; _p.z += so; _p.y += Math.abs(so) * 0.3; }
    saberPose.off.lerp(_p, Math.min(1, dt * 8 * rate)); saberPose.offPole.lerp(off.pole, k).normalize();
  }
  if (dualIn(held)){ slerpDir(saberPose.offBlade, gO.offBlade || mirror(saberPose.blade, _mo), k, saberPose.offBlade); saberPose.offLive = false; }
  saberPose.palm += ((g.palm && off === g.off ? g.palm : 0) - saberPose.palm) * Math.min(1, dt * 8);
  saberPose.gaze += ((g.gaze || 0) - saberPose.gaze) * Math.min(1, dt * 9 * rate);
  saberPose.sink += ((g.sink || 0) - saberPose.sink) * Math.min(1, dt * 8 * rate);
  saberPose.twist += ((g.twist || 0) - saberPose.twist) * Math.min(1, dt * 9 * rate);
  saberPose.lean += ((g.lean || 0) - saberPose.lean) * Math.min(1, dt * 10 * rate);
  return { torso: g.torso || 0 };
}

/* SWITCH — changing form or grip turns the saber straight into the new guard in one quick, efficient rotation
   (the guard blend runs much faster for a moment) instead of drifting there. */
const SWITCH_TIME = 0.22, SWITCH_RATE = 24;   // seconds the fast blend lasts; its rate (the guard's own is 9)
const GRIP_TURN = Math.PI / 0.16;   // rad/s the hilt turns over in the fingers on a grip change (half a turn in 0.16 s)
const SWITCH_OUT = 1.1, OUTX = new THREE.Vector3(1, 0, 0);   // how far out to the weapon side the blade swings mid-switch
let switchT = 0, wheelA = 0;
// a form with a second block (block2, Makashi) alternates between the two each time the guard goes up
let blockAlt = true, wasBlocking = false;
export function startSwitch(){ switchT = SWITCH_TIME; }

/* KEEP CLEAR — the blade never passes through the hero. The body is an upright elliptic column in chest space (a
   narrower one for the head); a hand inside it is pushed out, and a blade crossing it is turned out around the hand
   by how deep its deepest point sits. Runs on every pose (guards, cuts, form and grip switches, the blends between them). */
const BODY_RX = 0.3, BODY_RZ = 0.24, BODY_LO = -1.5, BODY_TOP = 0.36, HEAD_R = 0.2, HEAD_TOP = 0.7, BLADE_LEN = 1.55;
const _n = new THREE.Vector3(), _w = new THREE.Vector3(), _s = new THREE.Vector3(), _ch = new THREE.Vector3(), _cd = new THREE.Vector3();
// how deep a point sits inside the body (0 = outside), with the way out (level) in _n
function depth(p){
  if (p.y < BODY_LO || p.y > HEAD_TOP) return 0;
  const head = p.y > BODY_TOP, rx = head ? HEAD_R : BODY_RX, rz = head ? HEAD_R : BODY_RZ;
  const q = Math.hypot(p.x / rx, p.z / rz);
  if (q >= 1) return 0;
  if (q < 1e-4) _n.set(0, 0, 1); else _n.set(p.x / (rx * rx), 0, p.z / (rz * rz)).normalize();
  return (1 - q) * Math.min(rx, rz);
}
/* `far`: the saber staff's second blade, which leaves the far end of the hilt the other way (STAFF.end below the fist,
   as long as the first): it is kept out of the body too, the staff turning about the fist to clear whichever end is in. */
const FAR_LEN = STAFF.end + 1.3;
function keepClear(h, d, far = false){
  const dh = depth(h);
  if (dh > 0) h.addScaledVector(_n, dh);
  for (let it = 0; it < (far ? 10 : 6); it++){
    let worst = 0, ws = 0;
    for (let s = 0.15; s <= BLADE_LEN; s += 0.1){
      const dp = depth(_s.copy(h).addScaledVector(d, s));
      if (dp > worst){ worst = dp; ws = s; _w.copy(_n); }
    }
    if (far){
      // the far end: a point s back along the hilt is pushed out by turning the staff the other way about the fist
      for (let s = 0.3; s <= FAR_LEN; s += 0.1){
        const dp = depth(_s.copy(h).addScaledVector(d, -s));
        if (dp > worst){ worst = dp; ws = -s; _w.copy(_n); }
      }
    }
    if (!worst) break;
    d.addScaledVector(_w, worst / ws).normalize();
  }
}

/* THE LORE GRIP (data/poses.js SWING_STYLE hands): whether this cut is struck with both hands on the hilt. The form's
   `two` is its plain cut; `hands` names the moves that take the other hold (an alternating form's one-handed leap,
   lunge or flourish). The first move this cut is wins, in this order. */
const HAND_MOVES = [['fin', (sw, A) => A.fin], ['rip', sw => sw.riposte], ['mom', sw => !!sw.mom], ['air', sw => !!sw.air],
  ['spin', sw => !!sw.spin], ['back', sw => !!sw.back]];
export function swingHands(style, sw, A){
  const H = style.hands;
  if (H) for (const [m, is] of HAND_MOVES) if (H[m] !== undefined && is(sw, A)) return H[m];
  return !!style.two;
}

/* VARIANTS (data/poses.js SWING_VARIANTS) — the same cut struck again in a grip with a second take alternates between
   the two, the variant first. One toggle per grip and cut, so a string that comes back round to a cut plays the
   other take of it. */
const VAR_NEXT = {};
function variantOf(grip, id, set){
  const v = SWING_VARIANTS[grip] && SWING_VARIANTS[grip][id];
  if (!v || !set[v]) return id;
  const k = grip + ':' + id, alt = VAR_NEXT[k] !== false;
  VAR_NEXT[k] = !alt;
  return alt ? v : id;
}

/* SWING — evaluate the keyframed cut at the swing's progress. Returns body cues for the caller (envelope, spin,
   hop, drop) so legs and the whole-body turn stay in step with the blade. */
export function swingPose(R, held, grip, form, sw){
  if (!saberPose.live) seed(R, held);
  const style = SWING_STYLE[form] || SWING_STYLE.niman;
  if (!sw.anim){
    // a SABER FINISHER's beat (jedi/finisher.js) names its own cut, spin and hop; otherwise the 3rd hit is the form's finisher
    const fb = sw.finBeat;
    const fin = !!fb || (sw.step === 2 && sw.dir === 'neutral' && !sw.riposte);
    const pid = fb ? fb.pat : sw.riposte && !sw.ripLine ? 'forward' : fin ? style.finisher.pattern : (sw.pat.id || 'right');   // (a riposte on a line: jedi/guardline.js)
    const set = (style.set && SWINGS[style.set]) || SWINGS[grip] || SWINGS.regular;   // (the saber staff swings its own two-ended set)
    const angled = sw.pat.ang != null && !sw.riposte && !fin;
    // a grip with its own takes (data/poses.js SWING_VARIANTS, SWING_SPIN_KEYS: the reverse grip) picks the cut by its id
    // so it can swap in the variant or the spinning cut; the others blend angle cuts as before
    const own = !style.set && (SWING_VARIANTS[grip] || SWING_SPIN_KEYS[grip]);
    let kid = null, keys;
    if (own){
      kid = (fb && fb.keys && set[fb.keys]) ? fb.keys : angled ? nearestId(set, sw.pat.ang, sw.h) : set[pid] ? pid : 'right';
      const spinning = (sw.spin && sw.spin.turns) || (fb ? fb.spin : fin && style.finisher.spin);
      const SK = SWING_SPIN_KEYS[grip];
      if (spinning && SK){
        const base = set[kid], dir = base[2].hand.x - base[0].hand.x >= 0 ? 'R' : 'L';
        if (set[SK[dir]]) kid = SK[dir];
      } else if (!(fb && fb.keys)) kid = variantOf(grip, kid, set);
      keys = set[kid];
    } else keys = angled ? angleKeys(set, grip, sw.pat.ang, sw.h) : (set[pid] || set.right);
    const pf = fin && !fb && sw.pf;   // a PERFECT STRING's finisher: the same move, bigger (data/finishers.js PERFECT)
    // reach scales the chamber and follow-through out from the arc centre (committed forms swing bigger)
    const scaled = keys.map((kf, i) => i === 1 ? kf : { ...kf, hand: kf.hand.clone().sub(PIVOT).multiplyScalar(style.reach).add(PIVOT) });
    sw.anim = {
      keys: scaled, fin, spin: fb ? (fb.spin || 0) : fin ? style.finisher.spin + (pf && pf.spin || 0) : 0,
      hop: fb ? (fb.hop || 0) : fin ? style.finisher.hop + (pf && pf.hop || 0) : style.spinHop,
      tc: style.tc * (sw.riposte ? 0.45 : sw.flowCut ? CUT_ANGLE.flow.chamber : 1), ts: style.ts, tf: style.tf,
      start: { hand: saberPose.hand.clone(), blade: saberPose.blade.clone(), twist: saberPose.twist, pole: saberPose.pole.clone() },
      look: (kid && SWING_KEY_LOOK[grip] && SWING_KEY_LOOK[grip][kid]) || null,   // (a low sweep's crouch, a stab's lean)
    };
    // (a Shien heavy turned over into the forward grip: jedi/weight.js regrip. Its cut is the forward grip's, two-handed)
    sw.anim.two = sw.regrip ? true : swingHands(style, sw, sw.anim);
    // FLOW: the blade carries on from wherever the last cut left it. Finishing on the far side from this cut's
    // chamber, it wraps over the top to get there (the films' twirl between strokes) instead of dragging back
    // across the front like a second, backwards cut.
    const st0 = sw.anim.start.hand, c0 = scaled[0].hand;
    sw.anim.wrap = !sw.flowCut && st0.x * c0.x < 0 && Math.abs(st0.x - c0.x) > 0.3;
    // the follow-through settles a little toward the form's guard instead of freezing (the recovery)
    const G0 = guardSet(held, sw.restGrip || grip, form);   // (a regripped heavy goes back to the form's own guard)
    sw.anim.rest = G0.ready;
    // Jar'Kai with the off hand in the other grip: its follow-up mirrors the same cut from that grip's set
    const og = offGripIn(held, grip);
    if (og !== grip && style.dual){
      const oset = SWINGS[og] || SWINGS.regular;
      const oid = kid && oset[kid] ? kid : null;   // (the off hand's reversed blade takes the same stroke as the lead's)
      const ok = oid ? oset[oid] : angled ? angleKeys(oset, og, sw.pat.ang, sw.h) : (oset[pid] || oset.right);
      sw.anim.offSrc = ok.map((kf, i) => i === 1 ? kf : { ...kf, hand: kf.hand.clone().sub(PIVOT).multiplyScalar(style.reach).add(PIVOT) });
      sw.anim.offRestG = offGuard(held, grip, form, G0, G0.ready);
    }
    if (style.dual && dualIn(held)){
      sw.anim.dual = style.dual[og !== grip ? 'mixed' : grip] || style.dual.regular;
      sw.anim.hop += sw.anim.dual.hop || 0;
    }
    // which way across the body the cut travels (chest +x is the weapon side): spins and twirls turn into it. A cut
    // that runs straight down the middle has none of its own and turns toward the weapon side.
    const dx = scaled[2].hand.x - scaled[0].hand.x;
    sw.anim.side = Math.abs(dx) > 0.15 ? Math.sign(dx) : 1;
    sw.anim.lateral = Math.abs(dx) > 0.15;
    // the LOADED chamber: the hang at the top keeps drawing back a touch past the key (a riposte is already moving)
    const A0 = sw.anim, [C0, S0, F0] = scaled, ld = sw.riposte ? 0 : (style.load ?? 0.08);
    A0.hold = sw.riposte ? 0 : COIL_HOLD * (A0.ts - A0.tc);
    A0.wind = A0.tc + A0.hold;
    A0.load = { hand: arcLerp(S0.hand, C0.hand, 1 + ld, PIVOT, new THREE.Vector3()), blade: slerpDir(S0.blade, C0.blade, 1 + ld, new THREE.Vector3()), twist: C0.twist, pole: C0.pole };
    // CARRY THROUGH: the strike accelerates as x^a and the follow-through decelerates as 1-(1-y)^b, with a and b picked
    // so the tip leaves contact at the speed it arrived (a long arc after contact = a long, controlled glide out)
    const tin = Math.max(0.02, A0.ts - A0.wind), tout = Math.max(0.02, A0.tf - A0.ts);
    const l1 = Math.max(0.05, tipGap(A0.load, S0)), l2 = Math.max(0.05, tipGap(S0, F0));
    let a = style.accel || 2.4, b = a * l1 * tout / (l2 * tin);
    if (b > 7 || b < 1.6){ b = THREE.MathUtils.clamp(b, 1.6, 7); a = THREE.MathUtils.clamp(b * l2 * tin / (l1 * tout), 1.3, 4); }
    A0.a = a; A0.b = b;
    // the recovery's hand-over speed: it reaches `recover` of the way to the guard and leaves at the guard blend's pace
    const R0 = style.recover ?? 0.55, trec = (1 - A0.tf) * (sw.dur || 0.4);
    A0.rec = R0; A0.recM = Math.min(3, GUARD_RATE * (1 - R0) * trec / R0);
    A0.start.off = saberPose.off.clone();
  }
  const A = sw.anim, [C, S, F] = A.keys, L = A.load;
  const k = Math.min(1, sw.t / sw.dur);
  const lag = style.lag || 0;
  // t: the hand's progress through this leg of the cut; tb: the blade's (the wrist leading, the tip trailing then whipping past)
  let a, b, t, tb, ta, tw, ph;
  if (k < A.wind){
    // WIND-UP — eases into the loaded chamber; the hilt draws first and the tip follows it round
    ph = 0; a = A.start; b = L; const x = k / A.wind;
    t = powOut(x, 3); tb = powOut(x, 3 / (1 + lag)); ta = A.start.twist; tw = C.twist;
  } else if (k < A.ts){
    // STROKE — accelerating into contact, the tip trailing the hilt until it whips through
    ph = 1; a = L; b = S; const x = (k - A.wind) / (A.ts - A.wind);
    t = powIn(x, A.a); tb = powIn(x, A.a * (1 + lag)); ta = C.twist; tw = S.twist;
  } else if (k < A.tf){
    // FOLLOW-THROUGH — carried on at the contact speed, the tip leading out, then bled off over the arc
    ph = 2; a = S; b = F; const x = (k - A.ts) / (A.tf - A.ts);
    t = powOut(x, A.b); tb = powOut(x, A.b * (1 + lag)); ta = S.twist; tw = F.twist;
  } else {
    // RECOVERY — the blade flows back toward the guard and is still travelling as the guard takes it over
    ph = 3; a = F; b = A.rest; const x = (k - A.tf) / (1 - A.tf);
    t = A.rec * settle(x, A.recM); tb = t; ta = F.twist; tw = (A.rest.twist || 0) / (style.twist || 1);
  }
  arcLerp(a.hand, b.hand, t, PIVOT, saberPose.hand);
  if (ph === 0 && A.wrap){
    // wind-up wrap: lift the hand past the head and roll the blade up and back through the middle of it
    const wb = WRAP_BLADE[grip] || WRAP_BLADE.regular;
    saberPose.hand.addScaledVector(WRAP_LIFT, Math.sin(Math.PI * t));
    if (tb < 0.5) slerpDir(a.blade, wb, tb * 2, saberPose.blade);
    else slerpDir(wb, b.blade, tb * 2 - 1, saberPose.blade);
  } else if (grip === 'reverse' && ph === 1 && A.lateral && a.blade.dot(b.blade) < REV_ROUND){
    // REVERSE-GRIP STROKE: the blade comes from laid back along the arm to out in front, near a half turn. Left to the
    // shortest way round it drops through the floor and the legs; instead the fist leads across and the blade trails
    // level behind it (out on the side the cut comes from), then whips round through the front onto the strike
    _w.set(-A.side, -0.12, 0.3).normalize();
    if (tb < 0.5) slerpDir(a.blade, _w, tb * 2, saberPose.blade);
    else slerpDir(_w, b.blade, tb * 2 - 1, saberPose.blade);
  } else slerpDir(a.blade, b.blade, tb, saberPose.blade);
  // a heavy blade drags PAST the follow-through, then gets hauled back (overshoot), with a wobble
  if (style.overshoot && k > A.ts){
    const o = Math.sin(Math.min(1, (k - A.ts) / (1 - A.ts)) * Math.PI) * style.overshoot;
    _p.subVectors(F.hand, S.hand).multiplyScalar(o * 0.5);
    saberPose.hand.add(_p);
    _ax.subVectors(F.blade, S.blade).multiplyScalar(o * 0.6);
    saberPose.blade.add(_ax).normalize();
  }
  // HEAVY CUT (player/jedi/weight.js): held, the blade draws back PAST its chamber, up and behind the shoulder, the tip
  // laid back further; committed, that extra wind-up is let go through the stroke (so it whips in faster) and the
  // blade carries well past the follow-through before it is hauled back, the body's weight dragged after it
  const hk = sw.heavy ? 1 : sw.weigh === 'pending' ? (sw.drawK || 0) : 0;
  if (hk > 0){
    const H = HEAVY_LOOK;
    const wind = k < A.wind ? powOut(k / A.wind, 2) : k < A.ts ? 1 - powIn((k - A.wind) / (A.ts - A.wind), 1.6) : 0;
    if (wind > 0){
      _p.subVectors(C.hand, S.hand).multiplyScalar(H.draw * hk * wind);
      saberPose.hand.add(_p); saberPose.hand.y += H.lift * hk * wind;
      _ax.subVectors(C.blade, S.blade).multiplyScalar(H.lay * hk * wind);
      saberPose.blade.add(_ax).normalize();
    }
    if (sw.heavy && k > A.ts){
      const o = Math.sin(Math.min(1, (k - A.ts) / (1 - A.ts)) * Math.PI) * H.carry;
      _p.subVectors(F.hand, S.hand).multiplyScalar(o * 0.5);
      saberPose.hand.add(_p);
      _ax.subVectors(F.blade, S.blade).multiplyScalar(o * 0.6);
      saberPose.blade.add(_ax).normalize();
    }
  }
  // TWIRL — the blade wheels about the hand in front of the chest while it coils, and is back on the chamber's line by
  // the strike (whole turns only, so it leaves and returns on the same line). The reverse grip keeps its blade along the forearm.
  const sp = sw.spin;
  if (sp && sp.twirl && grip === 'regular' && k < A.ts){
    // the wheel carries the blade over the top toward the cut's side (the top of the wheel moves with the cut, so the
    // tip comes round into the chamber already travelling the way the stroke goes)
    const p = k / A.ts;
    _wf.copy(saberPose.blade);
    saberPose.blade.applyAxisAngle(TWIRL_AXIS, -Math.PI * 2 * sp.twirl * A.side * (p - Math.sin(Math.PI * 2 * p) / (Math.PI * 2))).normalize();
    if (staffIn(held)) shiftToMid(saberPose.hand, _wf, saberPose.blade);   // (the staff: passed round between the hands)
  }
  // the elbow: a reverse-grip cut raises and swings it with the key (data/poses.js pole), so the forearm can carry the
  // blade square off the fist; a regular-grip cut keeps it down and out
  if (grip === 'reverse') saberPose.pole.copy(a.pole || b.pole || DEF_POLE).lerp(b.pole || DEF_POLE, t).normalize();
  else saberPose.pole.copy(DEF_POLE);
  saberPose.twist = (ta + (tw - ta) * t) * style.twist;
  // (a two-handed weapon wheeled about the fist lets go with the off hand for the twirl, flung out for balance, and
  // takes the hilt again for the strike: a two-handed saber's spin)
  // (the saber staff keeps both hands on: it's passed round between them, hand over hand, about the hilt's middle)
  // A REGRIP (jedi/weight.js: Shien's heavy turning over into the forward grip): the cut was built afresh in the new
  // grip, so its chamber is somewhere else; while the hilt turns over the blade travels there from where it waited
  if (sw.regripDur > 0 && sw.regripT > 0){
    const u = 1 - sw.regripT / sw.regripDur, e = u * u * (3 - 2 * u);
    saberPose.hand.lerpVectors(A.start.hand, saberPose.hand, e);
    _wf.copy(saberPose.blade); slerpDir(A.start.blade, _wf, e, saberPose.blade);
  }
  const two = A.two;
  const wheel = two && sp && sp.twirl && grip === 'regular' && k < A.ts * 0.85 && !staffIn(held);
  saberPose.two += ((two && !wheel ? 1 : 0) - saberPose.two) * 0.3;
  if (wheel) saberPose.off.lerp(TWIRL_OFF, 0.2);
  saberPose.lean = ((style.drop || 0) + (sw.heavy ? HEAVY_LOOK.drop : 0)) * Math.sin(Math.PI * k) * 1.6   // (a heavy throws the shoulders down into it)
    + (A.look && A.look.lean || 0) * Math.sin(Math.PI * k);
  // the free hand works against the blade (data/poses.js SWING_OFF): a forehand reaches it out at the foe on the wind-up
  // and draws it back to the hip as the blade comes through (the counter-pull that turns the body), a backhand tucks it in
  // and flings it out the other way; it opens for balance on the follow-through and returns to the guard's place
  if (style.dual && dualIn(held)) dualSwing(A, k, style, sw);
  else if (!two){
    const O = style.offKeys ? (style.offV || (style.offV = style.offKeys.map(V))) : OFF_KEYS[A.side > 0 ? 'back' : 'fore'], fl = style.offFlare;
    const rOff = A.rest.offFight || A.rest.off, guardOff = (rOff && rOff.hand) || OFF_REST;
    const key = i => _p.copy(guardOff).lerp(O[i], fl);
    if (ph === 0){ _t.copy(A.start.off).lerp(key(0), t); }
    else if (ph === 1){ _t.copy(key(0)); _t.lerp(key(1), t); }
    else if (ph === 2){ _t.copy(key(1)); _t.lerp(key(2), t); }
    else { _t.copy(key(2)); _t.lerp(guardOff, t / A.rec); }
    saberPose.off.copy(_t);
    saberPose.offPole.copy(OFF_POLE);
    // the reaching hand is open; it closes as it pulls back through the strike
    saberPose.palm = A.side > 0 ? 0 : ph === 0 ? Math.max(saberPose.palm, t) : ph === 1 ? 1 - t : 0;
  } else saberPose.palm = 0;
  // progress through the actual cut (chamber → follow), for spins
  const cut = THREE.MathUtils.clamp((k - A.tc) / (A.tf - A.tc), 0, 1);
  // the body's beats for animation.js: coil (loaded back into the chamber) and drive (the weight thrown through the
  // strike, peaking as the blade reaches the strike key, then carried out by the follow-through)
  const coil = ph === 0 ? t : ph === 1 ? 1 - t : 0;
  const drive = ph === 0 ? 0 : ph === 1 ? t : ph === 2 ? 1 - 0.6 * t : 0.4 * (1 - easeOut((k - A.tf) / (1 - A.tf)));
  return { k, env: Math.sin(Math.PI * k), cut, spin: A.spin, hop: A.hop, drop: (style.drop || 0) + (A.fin ? 0 : sw.pat.drop || 0) + (A.look && A.look.drop || 0), fin: A.fin, strike: k > A.tc && k < A.tf, coil, drive, side: A.side };
}

/* DEFLECT — the blade snaps to catch a bolt and flicks it away. Which catch is picked from where the bolt arrives
   (d.side: + weapon side; d.h: height against the chest) and from the last few catches, so a volley moves the blade
   between covers like the films instead of repeating one block. Returns the same body cue as guardPose. */
const ZONE_CYCLE = ['mid', 'high', 'mid', 'low'];
const _pick = { side: 1, cyc: 0, last: {} };
function pickDeflect(grip, d, form){
  const ps = SWING_STYLE[form] && SWING_STYLE[form].set;
  const set = (ps && DEFLECTS[ps]) || DEFLECTS[grip] || DEFLECTS.regular;   // (the saber staff has its own catches)
  // a saber lock (enemies/duel.js) always takes the same cover for its kind of bind: the bind looks the same every time
  if (d.fixed && set[d.fixed]) return set[d.fixed][0];
  // a bolt clearly off to one side is caught on that side; a bolt down the middle alternates forehand / cross-body
  const side = Math.abs(d.side) > 0.25 ? Math.sign(d.side) : -_pick.side;
  _pick.side = side;
  const h = d.h > 0.35 ? 'high' : d.h < -0.35 ? 'low' : ZONE_CYCLE[_pick.cyc++ % ZONE_CYCLE.length];
  const zone = h + (side > 0 ? 'R' : 'L'), list = set[zone], key = (ps || grip) + zone;
  // never the same catch twice running in a zone
  const last = _pick.last[key] ?? -1;
  const i = (last + 1 + (list.length > 2 && Math.random() < 0.5 ? 1 : 0)) % list.length;
  _pick.last[key] = i;
  return list[i];
}
/* MEET THE BLADE — fit a catch to where the foe's blade really is (d.contact, a world point from jedi/clash.js
   parryContact). The picked cover keeps its character (which side, what angle) but the hand is moved, within the arm's
   reach, and the blade turned just enough that the saber's length passes through the contact point. */
const ARM_SLACK = 0.04, BLADE_NEAR = 0.3, BLADE_FAR = 1.35;
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _cc = new THREE.Vector3(), _m = new THREE.Vector3(), _d = new THREE.Vector3();
function fitContact(R, P, world, staff = false){
  // the contact in chest space AS THE CATCH WILL HAVE THE CHEST: the cover turns the chest by its twist, so undo that
  // turn rather than reading the chest where it happens to stand this frame
  const ch = R.chest;
  ch.parent.updateWorldMatrix(true, false);
  _e.copy(ch.rotation); _e.y = P.twist;
  const C = ch.parent.worldToLocal(_cc.copy(world)).sub(ch.position).applyQuaternion(_q.setFromEuler(_e).invert());
  const hand = P.hand, blade = P.blade;
  // slide the hand so the cover's own blade line crosses the contact at a point along the blade (a saber staff's
  // cover that stands its FAR blade in the line meets it on that one, back past the far end of the hilt)
  const along = _m.subVectors(C, hand).dot(blade), farSide = staff && along < 0;
  const s = farSide ? THREE.MathUtils.clamp(along, -(STAFF.end + BLADE_FAR - 0.2), -(STAFF.end + 0.1))
                    : THREE.MathUtils.clamp(along, BLADE_NEAR, BLADE_FAR);
  hand.add(_m.copy(C).addScaledVector(blade, -s).sub(hand));
  // …but only as far as the arm goes
  const sh = R.armR.sh.position, reach = DIM.upper + DIM.fore - ARM_SLACK;
  _d.subVectors(hand, sh);
  if (_d.length() > reach) hand.copy(sh).addScaledVector(_d.normalize(), reach);
  // what the arm couldn't cover, the wrist makes up: turn the blade toward the contact
  const to = _d.subVectors(C, hand), dist = to.length();
  if (dist > 0.05){
    to.divideScalar(dist);
    if (farSide){
      const miss = _m.copy(C).addScaledVector(blade, Math.min(Math.max(dist, STAFF.end + 0.1), STAFF.end + BLADE_FAR)).sub(hand).length();
      if (miss > 0.02) blade.copy(to).negate();   // (the far blade turned onto it: the near one points away)
    } else {
      const miss = _m.copy(C).addScaledVector(blade, -Math.min(Math.max(dist, BLADE_NEAR), BLADE_FAR)).sub(hand).length();
      if (miss > 0.02) blade.copy(to);
    }
  }
  P.flick.multiplyScalar(0.3);   // the flick is for sending a bolt away: against a blade the saber stays on it
  P.flickHand.copy(hand).add(P.flick);
  P.flickBlade.copy(blade).addScaledVector(P.flick, 2.4).normalize();
}

const staffIn = (held) => !!(held.root && held.root.userData.staff);   // the saber staff is in this hand
export function deflectPose(dt, R, held, grip, form, d){
  if (!saberPose.live) seed(R, held);
  const G0 = guardSet(held, grip, form);
  const bg = G0.block, bO = offGuard(held, grip, form, G0, bg);
  if (!d.pose){
    const p = pickDeflect(grip, d, form);
    const j = () => d.fixed ? 0 : (Math.random() - 0.5) * 0.06;
    const hand = p.hand.clone().add(_t.set(j(), j(), j()));
    const blade = p.blade.clone().add(_t.set(j() * 2, j() * 2, j() * 2)).normalize();
    d.pose = {
      hand, blade, pole: p.pole, twist: p.twist || 0,
      // the flick carries the hand on and turns the tip further the same way, sending the bolt back out
      flickHand: hand.clone().add(p.flick), flickBlade: blade.clone().addScaledVector(p.flick, 2.4).normalize(),
      from: { hand: saberPose.hand.clone(), blade: saberPose.blade.clone(), twist: saberPose.twist },
      flick: p.flick.clone(),
    };
    if (d.lock) d.pose.base = { hand: d.pose.hand.clone(), blade: d.pose.blade.clone() };
    if (d.contact) fitContact(R, d.pose, d.contact, staffIn(held));
  } else if (d.lock && d.contact){
    // A SABER LOCK tracks the bind every frame: the cover is fitted afresh (from its own unfitted shape, so it never
    // drifts) to where the foe's blade is now, so the two blades stay crossed at the one point as the bind sways
    d.pose.hand.copy(d.pose.base.hand); d.pose.blade.copy(d.pose.base.blade);
    fitContact(R, d.pose, d.contact, staffIn(held));
  } else if (d.refit){   // a held guard on a duellist's line turned into the real catch: re-aim the held cover at the blade
    d.refit = false;
    d.pose.from.hand.copy(saberPose.hand); d.pose.from.blade.copy(saberPose.blade); d.pose.from.twist = saberPose.twist;
    if (d.contact) fitContact(R, d.pose, d.contact, staffIn(held));
  }
  // an anticipated twirl (jedi/combat.js anticipateDeflect) leads the catch by d.lead seconds: until the bolt lands the
  // blade stays on its guard and wheels toward the bottom; the catch itself runs from the landing on
  const lead = d.lead || 0, tp = Math.max(0, d.t - lead);
  // a HELD catch (jedi/guardline.js: the guard waiting on a duellist's line) gets there fast and stays, no flick
  const P = d.pose, k = d.hold || d.lock ? Math.min(0.3, d.t / 0.1 * 0.3) : Math.min(1, tp / (d.dur - lead));
  if (k < 0.3){
    const t = easeOut(k / 0.3);
    arcLerp(P.from.hand, P.hand, t, PIVOT, saberPose.hand);
    slerpDir(P.from.blade, P.blade, t, saberPose.blade);
    saberPose.twist = P.from.twist + (P.twist - P.from.twist) * t;
  } else {
    const t = easeOut(Math.min(1, (k - 0.3) / 0.3));
    saberPose.hand.copy(P.hand).lerp(P.flickHand, t);
    slerpDir(P.blade, P.flickBlade, t, saberPose.blade);
    saberPose.twist = P.twist;
  }
  // a catch turned into a twirl (data/poses.js DEFLECT_SPINS): the blade wheels once about the hand and is on the
  // catch's line again by the flick. Anticipated, the half turn to the bottom of the wheel is done at the landing (the
  // blade sweeping through it at speed) and the rest follows. The reverse grip keeps its blade along the forearm.
  const sp = d.spin;
  if (sp && sp.twirl && grip === 'regular'){
    let ang;
    if (lead){
      const w = Math.max(lead, 0.14);
      if (d.t < lead){ const u = d.t / lead; ang = Math.PI * (0.4 * u + 0.6 * u * u); }
      else { const v = Math.min(1, (d.t - lead) / w); ang = Math.PI + Math.PI * (0.4 * v + 0.6 * (1 - (1 - v) * (1 - v))); }
    } else { const p = Math.min(1, k / 0.6); ang = Math.PI * 2 * (p - Math.sin(Math.PI * 2 * p) / (Math.PI * 2)); }
    _wf.copy(saberPose.blade);
    saberPose.blade.applyAxisAngle(TWIRL_AXIS, -sp.twirl * sp.side * ang).normalize();
    if (staffIn(held)) shiftToMid(saberPose.hand, _wf, saberPose.blade);
  }
  saberPose.pole.lerp(P.pole, Math.min(1, dt * 30)).normalize();
  // the form's block decides the hands: Djem So closes both on the hilt, Makashi and Shien keep the free hand out. A
  // two-handed catch turned into a twirl lets go with the off hand while the blade wheels (as a two-handed cut's twirl)
  const wheel = !!(sp && sp.twirl && grip === 'regular' && !staffIn(held) && k < 0.6);
  saberPose.two += ((bg.two && !wheel ? 1 : 0) - saberPose.two) * Math.min(1, dt * 14);
  const off = wheel ? { hand: TWIRL_OFF, pole: OFF_POLE } : bO.off || bg.off || G0.ready.off;
  if (off){ saberPose.off.lerp(off.hand, Math.min(1, dt * 12)); saberPose.offPole.lerp(off.pole, Math.min(1, dt * 12)).normalize(); }
  // Jar'Kai: the off blade crosses the catch (the X-block) or, on a bolt, mirrors it
  if (dualIn(held)){ slerpDir(saberPose.offBlade, (!d.contact && bO.offBlade) || mirror(saberPose.blade, _mo), Math.min(1, dt * 16), saberPose.offBlade); saberPose.offLive = false; }
  saberPose.lean += ((bg.lean || 0) - saberPose.lean) * Math.min(1, dt * 12);
  return { torso: 0 };
}

/* Solve the live pose onto the rig: weapon arm by IK, blade aimed, off hand on the hilt (two-handed) or free. */
export function applySaberPose(R, held, offFree = true, dt = 1 / 60){
  // a grip change turns the hilt over in the hand; the wrist follows it round, so the blade itself stays on course
  // (the Darksaber has no flippable root: it's always held regular)
  const r = held.root, to = r ? r.userData.gripTo : undefined;
  if (to !== undefined && r.rotation.x !== to){
    const d = to - r.rotation.x, st = GRIP_TURN * dt;
    r.rotation.x = Math.abs(d) <= st ? to : r.rotation.x + Math.sign(d) * st;
  }
  R.chest.rotation.y = saberPose.twist;
  const staff = !!(r && r.userData.staff);
  keepClear(_ch.copy(saberPose.hand), _cd.copy(saberPose.blade), staff);
  solveArm(R.armR, _ch, saberPose.pole);
  R.armR.wr.updateWorldMatrix(true, false);
  // REVERSE-GRIP WRIST: the blade leaves the pinky side of the fist, so it can lie back along the forearm or stand
  // square off it, but never run on out past the knuckles (that reads as a punch-dagger). Whatever the pose asked for,
  // the part of the blade pointing on along the forearm is taken off, so every reverse cut, catch, flip and blend
  // between them hooks the blade out from the fist with the fist leading. Scaled by how far the hilt has turned over.
  const rev = r ? 1 - Math.abs(r.rotation.x) / Math.PI : 0;
  if (rev > 0.01 && reverseWrist(R, _cd, rev)) keepClear(_ch, _cd, staff);
  aimHeld(R.chest, R.armR.wr, held.node, bladeAxis(held, _ax), _cd, 0.4);
  if (!offFree) return;
  // off hand: blend between its own target and the pommel end of the hilt (on the saber staff, its own grip further
  // down the long hilt: model/weapons.js STAFF.off)
  bladeAxis(held, _ax).multiplyScalar(staff ? -STAFF.off : -0.15);
  pointInChest(R.chest, held.node, _ax, _grip);
  _t.copy(saberPose.off).lerp(_grip, saberPose.two);
  _p.copy(saberPose.offPole);
  // two-handed, the off elbow flares out to its own side (as a real two-handed grip does), so the arm reads past the
  // body from the camera behind instead of tucking out of sight in front of the chest
  if (saberPose.two > 0.5) _p.set(-0.85, -0.5, -0.15).normalize();
  if (dualIn(held)){
    // JAR'KAI: the off hand's own saber, kept out of the body and aimed like the main one
    const orr = held.off.root, oto = orr && orr.userData.gripTo;
    if (oto !== undefined && orr.rotation.x !== oto){   // its own grip change turns its hilt over too
      const dd = oto - orr.rotation.x, st = GRIP_TURN * dt;
      orr.rotation.x = Math.abs(dd) <= st ? oto : orr.rotation.x + Math.sign(dd) * st;
    }
    _mb.copy(saberPose.offBlade);
    keepClear(_t, _mb);   // (the body column is symmetric: the same test keeps the off blade out of it)
    solveArm(R.armL, _t, _p);
    R.armL.wr.updateWorldMatrix(true, false);
    const orev = orr ? 1 - Math.abs(orr.rotation.x) / Math.PI : 0;   // a reversed off saber hooks out from the fist like the main one
    if (orev > 0.01 && reverseWrist(R, _mb, orev, R.armL, -1)) keepClear(_t, _mb);
    aimHeld(R.chest, R.armL.wr, held.off.node, bladeAxis({ root: held.off.root }, _ax), _mb, 0.4);
    return;
  }
  solveArm(R.armL, _t, _p);
  R.armL.wr.quaternion.identity();
}

/* JAR'KAI'S FOLLOW-UP — the off hand swings the SAME cut as the main hand, the same way across the body (a cut to the
   left takes both blades left), on a parallel arc shifted across to the off side, a beat behind: wind-up from wherever
   it held, the stroke, the follow-through, then back to the guard. Each grip pairing has its own beat (data/poses.js
   SWING_STYLE.jarkai.dual): both forward, a parallel two-beat, the off arc a hand lower; forward with the off saber
   reversed, the reversed blade raking through well after at the hip; both reversed, the twin blades almost as one. A
   cut straight down or up the middle (no side to travel to) brings both blades down or up together (`sync`). While its
   stroke runs, saberPose.offLive is up (jedi/bladehit.js cuts). */
const _op = new THREE.Vector3();
function dualSwing(A, k, style, sw){
  const D = A.dual || style.dual.regular || {};
  if (!A.offK){
    const sh = D.shift ?? 0.34, dy = -(D.drop || 0);
    A.offK = (A.offSrc || A.keys).map(kf => ({
      hand: kf.hand.clone().add(_op.set(-sh, dy, 0)),
      blade: kf.blade.clone().normalize(),
      pole: kf.pole ? mirror(kf.pole, new THREE.Vector3()).normalize() : OFF_POLE,
    }));
    A.offPivot = PIVOT.clone().add(_op.set(-sh, dy, 0));
    A.offStart = { hand: saberPose.off.clone(), blade: saberPose.offBlade.clone() };
    const RO = A.offRestG || A.rest, rOff = RO.off;
    A.offRest = { hand: rOff ? rOff.hand.clone() : OFF_REST.clone(), blade: (RO.offBlade || mirror(RO.blade, new THREE.Vector3())).clone() };
  }
  const lagT = (A.lateral ? D.lag : D.sync ?? D.lag) ?? 0.2, k2 = lagT > 0 ? (k - lagT) / (1 - lagT) : k;
  const [C, S, F] = A.offK, wind = A.wind, R0 = A.rec;
  let a, b, t;
  if (k2 <= 0){ a = A.offStart; b = A.offStart; t = 0; }
  else if (k2 < wind){ a = A.offStart; b = C; t = powOut(k2 / wind, 3); }
  else if (k2 < A.ts){ a = C; b = S; t = powIn((k2 - wind) / (A.ts - wind), A.a); }
  else if (k2 < A.tf){ a = S; b = F; t = powOut((k2 - A.ts) / (A.tf - A.ts), A.b); }
  else { a = F; b = A.offRest; t = R0 * settle(Math.min(1, (k2 - A.tf) / (1 - A.tf)), A.recM); }
  arcLerp(a.hand, b.hand, t, A.offPivot, saberPose.off);
  slerpDir(a.blade, b.blade, t, saberPose.offBlade);
  saberPose.offPole.copy(b.pole || OFF_POLE);
  saberPose.offLive = !sw.recoil && k2 >= A.tc * 0.6 && k2 <= Math.min(0.92, A.tf + 0.05);
  saberPose.palm = 0;
}

const REV_ALONG = 0.12;   // the most the reverse blade may point on along the forearm (dot of blade and elbow → wrist)
const _el = new THREE.Vector3(), _wr = new THREE.Vector3(), _fa = new THREE.Vector3(), _mi = new THREE.Matrix4();
function reverseWrist(R, d, rev, arm = R.armR, side = 1){
  R.chest.updateWorldMatrix(true, false);
  _mi.copy(R.chest.matrixWorld).invert();
  _el.setFromMatrixPosition(arm.el.matrixWorld).applyMatrix4(_mi);
  _wr.setFromMatrixPosition(arm.wr.matrixWorld).applyMatrix4(_mi);
  const f = _fa.subVectors(_wr, _el);
  if (f.lengthSq() < 1e-6) return false;
  f.normalize();
  const along = d.dot(f);
  if (along <= REV_ALONG) return false;
  d.addScaledVector(f, -(along - REV_ALONG) * rev);
  // a blade asked to point dead along the forearm has no side left to stand out on: hook it out to the weapon side
  if (d.lengthSq() < 0.04){ d.set(side, -0.2, 0.3); d.addScaledVector(f, -d.dot(f)); }
  d.normalize();
  return true;
}

/* hand the arms back to plain joint animation (Force casts, flight…); the next guard re-seeds from there */
export function releaseSaberPose(R, dt){
  saberPose.live = false;
  R.armR.wr.quaternion.slerp(IDQ, Math.min(1, dt * 10));
  R.chest.rotation.y += (0 - R.chest.rotation.y) * Math.min(1, dt * 10);
}
const IDQ = new THREE.Quaternion();
