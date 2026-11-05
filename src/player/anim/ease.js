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
  // (these two run at an even pace over a set time, eased at both ends, so the arm sets off gently and lands in the
  // guard without a lurch at the start or a long crawl into it at the end)
  relaxIn: 0.6,            // putting the blade out: the guard melts away slowly as the hand takes the hilt to the belt (s)
  relaxBack: 0.5,          // lighting it with 5: the arm rises into the guard over a beat, not in a snap (s)
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
export const atEase = () => !!G.cutscene && !G.sceneLit;   // (a scene that keeps the blade lit holds the fight's stance: game/cutscene.js `lit`)

/* BLADE PUT OUT (5: player/holster.js) — the hilt in hand, the hero stands and moves at ease in play too: upright
   feet, arms loose and swinging with the stride, the hilt hanging in the hand. Anything the body is busy with (a cut,
   a cast, a guard, a flip, a dash, a slide, a ledge, a wall-run) takes back over for as long as it lasts. */
export const RELAXED = {
  swing: 0.5,     // how far the arms swing with the stride at full pace (shoulder, radians each way)
  elbow: 0.55,    // and how much more the elbows bend at a run
  air: { lift: -0.25, out: 0.4, elbow: 0.35 },   // in the air (a jump, a flip): arms up and out from the sides, elbows soft
  breath: 0.025,  // the shoulders rising and falling with the breath at a standstill
  // the arms at rest: hanging off the shoulders with a little room from the body (not pinned to the sides), elbows
  // soft, hands loose by the thighs (armR is the weapon hand: the hilt's on the belt, so it hangs like the other)
  armR: { sh: [-0.06, 0.05, 0.22], el: [-0.32, 0, 0], wr: [0.18, 0, 0] },   // (+z swings the right arm out from the body)
  armL: { sh: [-0.06, -0.05, -0.22], el: [-0.3, 0, 0], wr: [0.18, 0, 0] },   // (and -z the left)
  // the weapon hand reaching across to the belt at the left hip (to clip the hilt on, or take it off)
  reach: { sh: [-0.25, -0.55, -0.3], el: [-1.05, 0, 0], wr: [0.25, 0, 0] },
};
export function relaxed(){
  if (G.mode !== 'play' || G.cutscene || !player.unlit) return false;
  if (isGunner() ? player.weapon !== 'darksaber' : player.holstered) return false;
  // (a jump or a flip keeps the loose arms: only what needs the hands or a guard takes them back)
  return !(player.atkT > 0 || player.castT > 0 || player.blockHeld || player.judgeT > 0 || player.mendT > 0 || player.darkT > 0 ||
    player.hang || player.mantle || player.wallRun || player.slideT > 0 || player.dashT > 0 || player.saberLock || player.kickT > 0);
}

/* THE FLOURISH — lighting or putting out the blade on purpose (5, a draw from the belt) spins the hilt one full turn in
   the fingers, end over end, as the blade runs up (the arm rises into the guard on its own as the at-ease stand lets
   go) or sucks back in (the arm settling to the hip). It turns the weapon in the hand (the saber, both of Jar'Kai's
   hilts, or the Darksaber) on top of the pose: animatePlayer puts the hilt back to its mount grip first
   (flourishReset), poses the arms (which aim the hilt where the guard holds it), then spins it about that aim
   (flourishApply), so the turn starts and ends exactly on the pose and never jumps into it. The spin eases in and out
   (no frame turns it much more than the next), and the spun hilt rides the pose sync, so a co-op partner sees it too. */
export const FLOURISH = {
  ignite:  { dur: 0.42, turns: 1 },    // out of the fingers and round, settling square in the hand as the blade reaches full length
  retract: { dur: 0.44, turns: -1 },   // the other way round, the hilt settling as the blade goes in
};
const FL = { t: 0, F: null, node: null, off: null };
const flNode = () => isGunner() ? (player.weapon === 'darksaber' ? player.darksaberMesh : null) : (player.holstered ? null : player.saberHand);
// Jar'Kai's second hilt, when it's in the off hand with the first (model/weapons.js syncOffSaber)
const flOff = () => !isGunner() && !player.holstered && !player.offAway && player.offSaber && player.offSaber.node.visible && player.saberBladeRoot && player.saberBladeRoot.userData.dual ? player.offSaber.node : null;
export function startFlourish(dir){ FL.F = dir > 0 ? FLOURISH.ignite : FLOURISH.retract; FL.t = 0; FL.node = flNode(); FL.off = flOff(); }
export const flourishing = () => !!FL.F;
const _ax = new THREE.Vector3(1, 0, 0), _fq = new THREE.Quaternion();
const inHand = m => m && m.userData.restQ && m.userData.hand && m.parent === m.userData.hand;
export function flourishReset(){
  const m = FL.node;
  if (inHand(m)) m.quaternion.copy(m.userData.restQ);
  // (the off hilt is aimed afresh by the pose only while Jar'Kai's guard holds it: start it from its grip during a spin
  // so the turn laid over it can't build up)
  const o = FL.F && FL.off;
  if (o && o.parent && o.userData.restQ) o.quaternion.copy(o.userData.restQ);
}
export function flourishApply(dt){
  if (!FL.F) return;
  const m = FL.node, F = FL.F;
  FL.t += dt;
  const k = Math.min(1, FL.t / F.dur);
  if (!inHand(m) || m !== flNode()){ FL.F = null; return; }   // (thrown, holstered, swapped)
  if (k >= 1){ FL.F = null; return; }   // (the pose has it square in the hand already)
  const e = k * k * k * (k * (6 * k - 15) + 10);   // smootherstep: from still, round, and still again
  _fq.setFromAxisAngle(_ax, Math.PI * 2 * F.turns * e);
  m.quaternion.multiply(_fq);
  const o = FL.off;
  if (o && o === flOff() && o.parent) o.quaternion.multiply(_fq);   // Jar'Kai: both hilts turn together
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
const qe = (x, y, z) => _q.setFromEuler(_e.set(x, y, z));

export function easePose(dt, vis, R, gait){
  const scene = atEase(), loose = !scene && relaxed();
  const want = scene || loose ? 1 : 0, cur = player._ease || 0;
  const busy = player.atkT > 0 || player.blockHeld || player.castT > 0 || player.kickT > 0 || player.dashT > 0 || player.judgeT > 0;
  // (a move out of the relaxed stand takes the arms at once; lighting it with 5 eases into the guard)
  const even = !scene && !(busy && want < cur), d = want - cur;
  const k = player._ease = even
    ? cur + Math.sign(d) * Math.min(Math.abs(d), dt / (want > cur ? AT_EASE.relaxIn : AT_EASE.relaxBack))
    : cur + d * Math.min(1, dt * (!scene ? AT_EASE.relaxOut : want > cur ? AT_EASE.inRate : AT_EASE.outRate));
  // a draw from the belt lights the blade with the hand still at the hip: it rises from there into the guard (held at
  // the reach as the stand lets go), and lets go of that reach if the stand comes back first (put out again)
  if (player._reachHold && loose) player._reachHold = Math.max(0, player._reachHold - dt * 6);
  if (k < 0.002){ player._ease = 0; player._reachHold = 0; return; }
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
  const air = player.grounded ? 0 : 1, A_ = RELAXED.air;   // off the ground: the arms come up and out a little for balance
  const br = Math.sin(G.gt * 1.6) * RELAXED.breath;         // a slow breath in the shoulders, so standing still isn't a statue
  // the reach to the belt and back (player/holster.js player.reach): the weapon hand crosses to the left hip and back
  const rk = reachK();
  // Jar'Kai: the off hand crosses to the other hip at the same time, for the second hilt clipped on there
  const both = !isGunner() && !player.offAway && player.offSaber && player.saberBladeRoot && player.saberBladeRoot.userData.dual;
  for (const [A, P, k] of [[R.armR, RELAXED.armR, -1], [R.armL, RELAXED.armL, 1]]){
    const reach = A === R.armR || both ? rk : 0, H = A === R.armR ? RELAXED.reach : REACH_OFF;
    A.sh.quaternion.slerp(qe(lerp(P.sh[0] + k * sw + air * A_.lift + br, H.sh[0], reach), lerp(P.sh[1], H.sh[1], reach), lerp(P.sh[2] - k * air * A_.out, H.sh[2], reach)), s);
    A.el.quaternion.slerp(qe(lerp(P.el[0] - bend - air * A_.elbow, H.el[0], reach), P.el[1], P.el[2]), s);
    A.wr.quaternion.slerp(qe(lerp(P.wr[0], H.wr[0], reach), P.wr[1], P.wr[2]), s);
  }
}
const lerp = (a, b, t) => a + (b - a) * t;
const REACH_DUR = 0.42;   // (player/holster.js REACH.dur)
const REACH_OFF = { sh: [RELAXED.reach.sh[0], -RELAXED.reach.sh[1], -RELAXED.reach.sh[2]], el: RELAXED.reach.el, wr: RELAXED.reach.wr };   // (the reach, mirrored)
// how far across to the belt the weapon hand is right now: through the reach (player/holster.js player.reach), or
// held there as a draw lights the blade (player._reachHold)
export function reachK(){
  const RC = player.reach;
  return RC ? Math.sin(Math.PI * Math.min(1, RC.t / REACH_DUR)) ** 2 : player._reachHold || 0;   // (sin²: the hand sets off and comes back from still)
}
