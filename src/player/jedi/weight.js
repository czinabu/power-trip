// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIGHT AND HEAVY CUTS (data/swing-weight.js). The saber button (LMB, the pad's RT) weighs each cut: a tap is a quick
// light cut, a hold draws the blade back into its chamber and commits to a slower, harder heavy one.
//
// A cut never waits for the button to know which it is. It leaves on the press like any cut; while the button is
// held it waits in its loaded chamber until SWING_WEIGHT.hold s after the press, and then it is a heavy. Let go
// before that and it goes on as a light cut at once. A cut launched from a press made earlier (a buffered link in the
// string) counts from that press, so a link held through the last cut's follow-through leaves already heavy.

import { SWING_WEIGHT, weightOf } from '../../data/swing-weight.js';
import { G, player, isGunner } from '../../state.js';
import { stance, heldGrip } from '../helpers.js';
import { stamDelay } from '../stamina.js';
import { sfx } from '../../audio/sfx.js';
import { tutEvent } from '../../game/tutor-bus.js';

const formOf = () => isGunner() ? 'darksaber' : stance().form;

/* ---------------- the button (engine/input.js) ---------------- */
export function atkPress(){ player.atkHeld = true; player.atkPressAt = G.gt; }
export function atkRelease(){ player.atkHeld = false; }

/* A fresh cut (jedi/combat.js tryAttack): can it be weighed, and how is the button right now. A cut that can't (a
   riposte, a momentum strike, a spin, a cut struck in the air) stays the form's plain cut. */
export function armWeight(sw, can){
  if (!can){ sw.weigh = null; return; }
  sw.pressAt = player.atkPressAt ?? G.gt;
  sw.weigh = player.atkHeld ? 'pending' : 'light';
  sw.drawK = 0;
  if (sw.weigh === 'pending') settle(sw);
}
// whether a cut launched now could be weighed heavy at all (so a held link doesn't spend a spin it can't use)
export const holding = () => !!player.atkHeld;

// still held at `hold` s: commit to the heavy (if there's stamina for its surcharge); let go: a light cut
function settle(sw){
  if (sw.weigh !== 'pending') return;
  if (!player.atkHeld){ sw.weigh = 'light'; return; }
  if (G.gt - sw.pressAt < SWING_WEIGHT.hold) return;
  const H = weightOf(formOf(), 'heavy'), cost = stance().stamina * H.stam;
  if (player.stam < cost){ sw.weigh = 'light'; return; }   // no breath for the bigger blow: it goes on light
  player.stam -= cost; player.stamDelay = stamDelay();
  sw.weigh = 'heavy'; sw.heavy = true;
  // a heavy in another hold (data/swing-weight.js grip: Shien's forward two-handed smash): the hilt turns over and the
  // second hand closes on it while the blade waits in its chamber, and the cut is built afresh in that grip (anim/saber.js)
  const g0 = heldGrip();
  if (H.grip && H.grip !== g0){ sw.regrip = H.grip; sw.restGrip = g0; sw.regripT = sw.regripDur = H.regrip || 0; sw.anim = null; }
  if (sw.travel){ sw.travel.x *= SWING_WEIGHT.look.step; sw.travel.z *= SWING_WEIGHT.look.step; }   // it drives in further behind the blow
  sfx(95, 0.22, 'sawtooth', 0.05, 60); sfx(420, 0.12, 'sine', 0.03, 260);   // the blade's hum drops as it loads
  tutEvent('heavyDraw');
}

/* How far the swing clock moves this frame (player/animation.js). A pending cut runs to its loaded chamber (`wind`,
   anim/saber.js) and waits there; a light cut runs a touch quicker, a heavy one slower. */
export function swingStep(sw, dt){
  if (!sw.weigh) return dt;
  settle(sw);
  if (sw.regripT > 0){ sw.regripT = Math.max(0, sw.regripT - dt); sw.drawing = true; return 0; }   // turning the hilt over: the clock waits
  if (sw.weigh === 'pending'){
    const wind = ((sw.anim && sw.anim.wind) || 0.3) * SWING_WEIGHT.drawAt * sw.dur;
    sw.drawK = Math.min(1, (G.gt - sw.pressAt) / SWING_WEIGHT.hold);
    const step = Math.max(0, Math.min(dt, wind - sw.t));
    sw.drawing = step < dt;   // reached the chamber: the blade waits there, and cuts nothing while it does
    return step;
  }
  sw.drawing = false;
  if (sw.weigh === 'light') sw.drawK = Math.max(0, (sw.drawK || 0) - dt * 8);
  return dt * weightOf(formOf(), sw.weigh).speed;
}

// the multiplier a cut's weight puts on one of its numbers (dmg, knock, posture); a plain or still-pending cut: 1
export function cutMul(sw, key){
  if (!sw || (sw.weigh !== 'light' && sw.weigh !== 'heavy')) return 1;
  const v = weightOf(formOf(), sw.weigh)[key];
  return v == null ? 1 : v;
}
