// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AT EASE — the hero stands up straight while a cutscene plays (game/cutscene.js sets G.cutscene) and drops back into
// the fight's stance when play resumes. The feet come from FOOTWORK.atEase (data/poses.js, read by footwork() in
// animation.js), so the footing still plants them; this pass, run after every pose, lets the arms hang and squares the
// body up, blended in and out so the guard eases away and back. Every hero shares the rig (model/rig.js), so it works
// for each Jedi form and grip, the Mando and the ARC trooper alike, and a co-op partner sees it through the pose sync.
// The same stand carries the hero about in play while the blade is put out (relaxed below).

import * as THREE from 'three';
import { G, player, isGunner } from '../../state.js';
import { gunLook } from '../../data/trooper.js';
import { MANDO_WEAPONS } from '../../data/mando.js';

export const AT_EASE = {
  inRate: 5, outRate: 7,   // how fast the stance lets go when a scene starts, and comes back when it ends (per second)
  relaxOut: 22,            // a cut, a guard or a power out of the relaxed stand (blade put out): the arms go to it straight away
  // the arms hang loose at the sides, elbows soft, hands a touch in front of the thighs (armR is the weapon hand)
  armR: { sh: [-0.08, 0.04, -0.07], el: [-0.28, 0, 0], wr: [0.1, 0, 0] },
  armL: { sh: [-0.06, -0.04, 0.07], el: [-0.24, 0, 0], wr: [0.1, 0, 0] },
  // a lit blade in a hanging hand points at the floor ahead, held off the leg
  blade: { sh: [-0.2, 0.1, -0.16], el: [-0.5, 0, 0], wr: [1.15, 0, 0] },
};

const q = ([x, y, z]) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const T = {};
for (const k of ['armR', 'armL', 'blade']) T[k] = { sh: q(AT_EASE[k].sh), el: q(AT_EASE[k].el), wr: q(AT_EASE[k].wr) };
const ZERO = new THREE.Quaternion();

// a gunner whose hands are full keeps the weapon's own carry (blasters low at the hip, a long gun across the body):
// those are already at rest. Fists (holstered) and the darksaber let go like the Jedi
const keepsGun = () => isGunner() && player.weapon !== 'fists' && player.weapon !== 'darksaber' && !!gunLook(player.weapon);
const twoHanded = () => !!(MANDO_WEAPONS[gunLook(player.weapon)] || {}).twoHand;

/* how far into the stand the hero is right now (0 in play, 1 settled in a scene) */
export const easeAmount = () => player._ease || 0;
export const atEase = () => !!G.cutscene;

/* BLADE PUT OUT (5: player/holster.js) — the hilt in hand, the hero stands and moves at ease in play too: upright
   feet, arms loose and swinging with the stride, the hilt hanging in the hand. Anything the body is busy with (a cut,
   a cast, a guard, a flip, a dash, a slide, a ledge, a wall-run) takes back over for as long as it lasts. */
export const RELAXED = {
  swing: 0.5,     // how far the arms swing with the stride at full pace (shoulder, radians each way)
  elbow: 0.55,    // and how much more the elbows bend at a run
};
export function relaxed(){
  if (G.mode !== 'play' || G.cutscene || !player.unlit) return false;
  if (isGunner() ? player.weapon !== 'darksaber' : player.holstered) return false;
  return !(player.atkT > 0 || player.castT > 0 || player.blockHeld || player.judgeT > 0 || player.mendT > 0 || player.darkT > 0 ||
    player.flip || player.hang || player.mantle || player.wallRun || player.slideT > 0 || player.dashT > 0 || player.saberLock || player.kickT > 0);
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
const qe = (x, y, z) => _q.setFromEuler(_e.set(x, y, z));

export function easePose(dt, vis, R, gait){
  const scene = atEase(), loose = !scene && relaxed();
  const want = scene || loose ? 1 : 0, cur = player._ease || 0;
  const rate = want > cur ? AT_EASE.inRate : scene ? AT_EASE.outRate : AT_EASE.relaxOut;   // (a move out of the relaxed stand takes the arms at once)
  const k = player._ease = cur + (want - cur) * Math.min(1, dt * rate);
  if (k < 0.002){ player._ease = 0; return; }
  const s = k * k * (3 - 2 * k);   // eased, so the guard melts away and comes back without a snap
  if (!scene){ relaxedArms(R, s, gait); return; }
  // the body squares up: no bladed twist, no lean into the guard
  vis.quaternion.slerp(ZERO, s);
  R.torso.quaternion.slerp(ZERO, s);
  R.chest.quaternion.slerp(ZERO, s);
  if (keepsGun()){
    // a long gun stays in both hands; the blasters' arms are already low. Just the shoulders settle a little
    if (!twoHanded()) for (const A of [R.armR, R.armL]) A.sh.quaternion.slerp(T[A === R.armR ? 'armR' : 'armL'].sh, s * 0.35);
    return;
  }
  const lit = !player.unlit && (!isGunner() ? !player.holstered : player.weapon === 'darksaber');
  for (const [A, key] of [[R.armR, lit ? 'blade' : 'armR'], [R.armL, 'armL']]){
    A.sh.quaternion.slerp(T[key].sh, s);
    A.el.quaternion.slerp(T[key].el, s);
    A.wr.quaternion.slerp(T[key].wr, s);
  }
}

/* the at-ease arms in play (blade put out): the body keeps its own lean into a run (vis), the guard's twist goes, and
   the arms hang and swing opposite the legs, elbows bending more the faster the stride */
function relaxedArms(R, s, gait){
  R.torso.quaternion.slerp(ZERO, s);
  R.chest.quaternion.slerp(ZERO, s);
  const g = gait || {}, on = g.moving && player.grounded ? (g.inten || 0) : 0;
  const sw = Math.sin(g.ph || 0) * RELAXED.swing * on, bend = RELAXED.elbow * on;
  for (const [A, key, k] of [[R.armR, 'armR', -1], [R.armL, 'armL', 1]]){
    const P = AT_EASE[key];
    A.sh.quaternion.slerp(qe(P.sh[0] + k * sw, P.sh[1], P.sh[2]), s);
    A.el.quaternion.slerp(qe(P.el[0] - bend, P.el[1], P.el[2]), s);
    A.wr.quaternion.slerp(qe(P.wr[0], P.wr[1], P.wr[2]), s);
  }
}
