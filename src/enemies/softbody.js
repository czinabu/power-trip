// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SOFT BODY — a trooper's body under its plates as ONE continuous surface, the way the heroes are built
// (player/model/skin.js), in place of a rigid piece per bone: a spine from the pelvis to the neck, each leg from inside
// the pelvis to the ankle, each arm from inside the shoulder to the wrist. Every chain is skinned across the joints it
// passes (enemies/kit.js k.skin), so a knee, a hip, the waist, a shoulder and an elbow bend as a body does, and the
// armour rides on top of it. Looks only: the joints, their names and their places are the ones the game already drives
// (the gait, the upper body's flinch, the arm swings) and cuts (enemies/scars.js), so nothing else knows the difference.
//
// A model's parts note their joints on k.rig as they build them (enemies/mesh.js legBones, upper, arm, helmet); softBody
// runs last and lays the body over them. Every unit enemies/mesh.js buildEnemyMesh builds wears it.

import { ngon, SHIELD } from '../player/model/shapes.js';
import { FRAME } from './detail.js';

const ROUND = ngon(8, Math.PI / 8);   // a limb's section (the loft rounds it once more: 16 sides)
const up = o => { for (o = o.parent; o && !o.userData.slot && !o.userData.bone; o = o.parent); return o; };   // the joint a part hangs from

/* the joints a soft body needs, noted as the model is built. spine: the trunk's material when it isn't the body suit
   (an officer's or a duellist's tunic is cloth to the collar) · wc: the chest's width when it isn't the legs' (a robed
   duellist's hips and shoulders differ) · droid: a battle droid's frame (softDroid below) · an arm's key and sleeve:
   a robe's sleeve, cut fuller and in the sleeve's cloth */
export const newRig = dims => ({ legs: [], arms: [], chest: null, head: null, spine: null, wc: null, droid: false, w: 1, neck: 1.96, ...dims });   // dims: hipY, kneeY, ankY, waist (enemies/mesh.js LEG_E, WAIST)

export function softBody(k){
  const R = k.rig, w = R.w, body = k.body;
  if (!R.chest) return;
  if (R.droid) return softDroid(k);
  /* THE SPINE: pelvis → waist → ribs → shoulders → neck. It widens into the shoulders so each arm grows out of it, and
     narrows to a neck that turns with the head */
  {
    const y0 = 0.8, wh = w * FRAME.hips * (k.fem ? 1.12 : 1), wc = (R.wc ?? w) * FRAME.chest, dc = FRAME.depth;
    const ring = (y, ww, d, z = 0) => ({ t: y - y0, w: ww, d, z });
    k.skin(R.spine || 'suit', [
      ring(0.8, 0.2 * wh, 0.16), ring(0.86, 0.38 * wh, 0.26), ring(0.98, 0.44 * wh, 0.29), ring(1.07, 0.39 * wh, 0.265),
      ring(1.2, 0.37 * wc, 0.24 * dc), ring(1.33, 0.4 * wc, 0.25 * dc), ring(1.5, 0.5 * wc, 0.29 * dc),
      ring(1.64, 0.6 * wc, 0.3 * dc), ring(1.72, FRAME.shx * 1.74 * w, 0.21), ring(1.78, FRAME.shx * 1.6 * w, 0.2),
      ring(1.83, 0.3, 0.215), ring(1.9, 0.22, 0.185), ring(1.98, 0.18, 0.16), ring(2.03, 0.16, 0.15),
    ], { bones: [body, R.chest, ...(R.head ? [R.head] : [])], at: [R.waist - y0, ...(R.head ? [R.neck - y0] : [])],
         origin: [0, y0, 0], blend: 0.1, profile: SHIELD, dir: 1 });
  }
  /* THE LEGS: from inside the pelvis (so the hip folds out of it) down the thigh, over the knee and the calf to the
     ankle, inside the boot */
  for (const L of R.legs){
    const h0 = 0.1, T = R.hipY - R.kneeY, S = R.kneeY - R.ankY, r = (rel, ww, d, z = 0) => ({ t: h0 + rel, w: ww * w, d, z });
    k.skin('suit', [
      r(-0.1, 0.13, 0.17), r(-0.03, 0.195, 0.215), r(0.06, 0.205, 0.22), r(0.2, 0.19, 0.2, 0.004), r(0.36, 0.155, 0.165),
      r(T - 0.03, 0.14, 0.152), r(T + 0.02, 0.132, 0.15, -0.004), r(T + 0.12, 0.13, 0.15, -0.012), r(T + 0.24, 0.112, 0.125, -0.006),
      r(T + S - 0.03, 0.098, 0.11), r(T + S + 0.02, 0.096, 0.108),
    ], { bones: [body, L.thigh, L.shin], at: [h0, h0 + T], frame: 1, blend: 0.085, profile: ROUND });
  }
  /* THE ARMS: from inside the shoulder (held by the chest, so the shoulder rolls instead of a tube turning in a socket)
     down the upper arm, over the elbow and inside the bracer to the wrist */
  for (const A of R.arms){
    const s0 = 0.07, wa = A.w, U = A.upper, r = (rel, ww, d = ww) => ({ t: s0 + rel, w: ww * wa, d });
    k.skin(A.key || 'suit', A.sleeve ? [   // a robe's sleeve: fuller, round at the elbow, running on inside the forearm's bell
      r(-0.07, 0.11), r(-0.035, 0.155), r(0.02, 0.172), r(0.1, 0.17), r(0.24, 0.156), r(U - 0.05, 0.148),
      r(U, 0.15), r(U + 0.06, 0.142), r(U + 0.2, 0.118), r(U + 0.31, 0.1),
    ] : [
      r(-0.07, 0.1), r(-0.035, 0.145), r(0.02, 0.158), r(0.1, 0.156), r(0.24, 0.134), r(U - 0.05, 0.116),
      r(U, 0.114, 0.118), r(U + 0.06, 0.11), r(U + 0.2, 0.098), r(U + 0.31, 0.086), r(U + 0.345, 0.084),
    ], { bones: [up(A.sh), A.sh, A.el], at: [s0, s0 + U], frame: 1, blend: 0.06, profile: ROUND });
  }
}

/* A BATTLE DROID's frame (enemies/mesh.js b1): no body under plates, but the two places it bends are one piece each. The
   spine is a ribbed conduit from the pelvis into the chest that flexes at the waist, and each thigh is a strut that
   runs out of the pelvis and on through the knee, so the hip and the knee turn without a gap */
function softDroid(k){
  const R = k.rig, body = k.body, y0 = 0.96, HEX = ngon(6);
  const rib = (y, ww) => ({ t: y - y0, w: ww, d: ww });
  k.skin('metal', [rib(0.96, 0.06), rib(1.02, 0.085), rib(1.08, 0.062), rib(1.14, 0.085), rib(1.2, 0.062), rib(1.26, 0.085), rib(1.32, 0.062), rib(1.38, 0.06)],
    { bones: [body, R.chest], at: [R.waist - y0], origin: [0, y0, 0], blend: 0.1, profile: HEX, dir: 1 });
  for (const L of R.legs){
    const h0 = 0.08, T = R.hipY - R.kneeY, r = (rel, ww) => ({ t: h0 + rel, w: ww, d: ww });
    k.skin('armor', [r(-0.08, 0.06), r(-0.02, 0.092), r(0.1, 0.088), r(T - 0.08, 0.072), r(T, 0.082), r(T + 0.07, 0.07), r(T + 0.14, 0.064)],
      { bones: [body, L.thigh, L.shin], at: [h0, h0 + T], frame: 1, blend: 0.07, profile: ROUND });
  }
}
