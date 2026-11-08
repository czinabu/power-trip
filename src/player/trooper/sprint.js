// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARC TROOPER'S SPRINT (hold SHIFT, pad B): no jetpack and no dive (that's the Mando's), so he runs for the next
// cover instead. Forward only, both arms pumping (anim/guns.js sprintArms: the DC-15 one-handed), and aiming or the trigger drops him back to
// a run. C out of a sprint is the slide, and a slide at cover ahead carries him into it (trooper/cover.js coverKey).
// Tuning: data/trooper.js TROOPER.sprint. player/locomotion.js reads this for player.sprinting.

import { G, player, keys, isTrooper } from '../../state.js';
import { tutEvent } from '../../game/tutor-bus.js';

// should he be sprinting this frame? `want` is the move keys (or the stick) in world space, `f` the camera's forward,
// `was` whether he was sprinting last frame
export function trooperSprint(moving, want, f, was){
  if (!isTrooper() || G.mode !== 'play' || !keys['shift'] || !moving) return false;
  // (off the ground only as he runs off a lip or over a bump at a sprint: a jump, or anything up, ends it)
  if (!player.grounded && !(was && (player.vy || 0) < 4)) return false;
  if (player.cover || player.blockHeld || player.zoom || player.trigHeld || player.firing || player.slideT > 0 || player.mantle
      || player.hang || player.flip || player.flinchT > 0 || player.downed || player.wallRun) return false;
  const l = Math.hypot(want.x, want.z) || 1;
  if ((want.x * f.x + want.z * f.z) / l < 0.45) return false;   // (forward, or forward and to one side: never a backpedal)
  if (!was){ player.sprintAt = G.gt; tutEvent('sprint'); }
  player.sprintT = G.gt;   // (the last moment he was at a sprint: a shot straight out of one is COVERING FIRE, gun-moves.js)
  return true;
}
