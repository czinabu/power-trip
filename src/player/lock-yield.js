// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* DEFENCE OUTRANKS THE LOCK — what a duel lock-on must not get in the way of. A lock (T, or DUEL FOCUS taking hold by
   itself: player/lockon.js) pins the view on one foe, so the guard faces it and a Force Push goes at it. That is right
   in a duel and wrong the moment the fight is bigger than the duel:
     · fire coming in from OUTSIDE the duel (a shooter off to the side, behind you) at you or at someone beside you
       (a squadmate, an evacuee, a co-op partner): you need to turn and put the blade in its path
     · a live thermal detonator on the ground near you or them: you need to turn and push it back
   outsideThreat() says whether one of those is happening right now; DUEL FOCUS lets go while it is (and for a beat
   after), so the view is yours again. A lock taken on T is the player's own choice and stays, but a Push thrown while
   locked goes for the nearest live detonator before the locked foe (pushGrenade, read by jedi/force.js).
     bolt     a hostile bolt within `range` m whose line passes within `pass` m of you (or `ally` m of someone you
              protect, who stands within `guard` m of you), and that comes from outside the front `arc` (cos) of the view:
              one coming in over the duellist's shoulder is already in front of the blade, so it doesn't count
     gren     a live detonator (lobbed or landed, not yet pushed) whose mark is within `near` m of you, or within its own
              blast + `ally` m of someone you protect
     hold     after the last threat, how long (s) before the focus may take hold again */
import { bolts, player } from '../state.js';
import { playerPos, fwd } from './helpers.js';
import { grenades } from '../enemies/grenades.js';
import { allies } from '../allies/squad.js';
import { CIV, civUp } from '../game/civilians.js';
import { players } from './players.js';

export const LOCK_YIELD = { range: 16, pass: 3, ally: 1.6, guard: 9, arc: 0.5, near: 9, hold: 2.5 };

// the people around you worth standing in front of: standing squadmates, evacuees, partners, within `guard` m
function protectees(pp, out){
  out.length = 0;
  const R = LOCK_YIELD.guard, add = (p) => { if (Math.hypot(p.x - pp.x, p.z - pp.z) < R) out.push(p); };
  for (const a of allies) if (a.state !== 'down' && a.group) add(a.group.position);
  for (const c of CIV.list) if (civUp(c)) add(c.m.position);
  for (let i = 1; i < players.length; i++){ const p = players[i]; if (p.here && !p.down && p.pos) add(p.pos); }
  return out;
}
// how close the bolt's line (ahead of it only) comes to point p, on the ground plane
function passGap(b, p){
  const o = b.mesh.position, dx = b.dir.x, dz = b.dir.z, l2 = dx * dx + dz * dz;
  if (l2 < 1e-6) return 1e9;
  const t = ((p.x - o.x) * dx + (p.z - o.z) * dz) / l2;
  if (t < 0) return 1e9;   // already past it
  return Math.hypot(o.x + dx * t - p.x, o.z + dz * t - p.z);
}

const _near = [];
// is something outside the duel coming for you or someone beside you right now? (`lockT`: the locked foe, whose own
// fire never counts)
export function outsideThreat(lockT){
  const Y = LOCK_YIELD, pp = playerPos(), f = fwd(), near = protectees(pp, _near);
  for (const g of grenades){
    if (g.friendly || g.vel) continue;
    const m = g.landed ? g.ball.position : g.to, d = Math.hypot(m.x - pp.x, m.z - pp.z);
    if (d < Y.near) return true;
    for (const p of near) if (Math.hypot(m.x - p.x, m.z - p.z) < g.R + Y.ally) return true;
  }
  for (const b of bolts){
    if (b.friendly || b.ghost || (lockT && b.src === lockT)) continue;
    const o = b.mesh.position, dx = o.x - pp.x, dz = o.z - pp.z, d = Math.hypot(dx, dz);
    if (d > Y.range || d < 0.01) continue;
    if ((dx * f.x + dz * f.z) / d > Y.arc) continue;   // in front of the blade already: the lock isn't in the way
    if (passGap(b, pp) < Y.pass) return true;
    for (const p of near) if (passGap(b, p) < Y.ally) return true;
  }
  return false;
}

/* a Push thrown while locked on: the nearest live detonator within `range` m of you (lobbed or landed, not yet pushed),
   or null. The push goes at it instead of the locked foe: a detonator at your feet is the more pressing answer. */
export function pushGrenade(range){
  if (!player.lockTarget) return null;
  const pp = playerPos();
  let best = null, bd = range;
  for (const g of grenades){
    if (g.friendly || g.vel) continue;
    const p = g.ball.position, d = Math.hypot(p.x - pp.x, p.z - pp.z);
    if (d < bd){ bd = d; best = g; }
  }
  return best;
}
