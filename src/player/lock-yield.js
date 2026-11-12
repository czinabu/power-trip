// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* DEFENCE OUTRANKS THE LOCK — a lock (the lock button: player/lockon.js) pins the view on one foe, so a Force Push goes
   at it. A live thermal detonator near you is the more pressing answer, so a Push thrown while locked goes for the
   nearest live detonator before the locked foe (pushGrenade, read by jedi/force.js). */
import { player } from '../state.js';
import { playerPos } from './helpers.js';
import { grenades } from '../enemies/grenades.js';

/* a Push thrown while locked on: the nearest live detonator within `range` m of you (lobbed or landed, not yet pushed),
   or null. The push goes at it instead of the locked foe: a detonator at your feet is the more pressing answer. */
export function pushGrenade(range){
  if (!player.lockTarget || player.lockLoose) return null;   // (a loose focus leaves the aim yours already)
  const pp = playerPos();
  let best = null, bd = range;
  for (const g of grenades){
    if (g.friendly || g.vel) continue;
    const p = g.ball.position, d = Math.hypot(p.x - pp.x, p.z - pp.z);
    if (d < bd){ bd = d; best = g; }
  }
  return best;
}
