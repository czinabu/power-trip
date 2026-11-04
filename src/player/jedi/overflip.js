// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* ATARU — THE FLIP OVER (Yoda against Dooku, Obi-Wan over Maul). Guard up, W and SPACE with a foe close in front: instead
   of the front handspring the body springs up over the foe's head in a high somersault, turning in the air, and lands
   behind it facing its back. A cut straight out of the landing strikes the back: no guard can turn it, and it lands
   harder. It costs a lot of stamina, so it is a move to pick a moment for, not to spam. (stances.js ataru `overflip`) */

import { V3, clamp } from '../../utils.js';
import { G, enemies, player } from '../../state.js';
import { playerPos, fwd } from '../helpers.js';
import { stamDelay } from '../stamina.js';
import { groundAt, solidAt } from '../../world/collision.js';
import { burst } from '../../fx/particles.js';
import { floater } from '../../fx/floaters.js';
import { S } from '../../audio/sfx.js';
import { tutEvent } from '../../game/tutor-bus.js';

export const OVERFLIP = {
  range: 4.6,    // m: a foe this close in front can be flipped over…
  near: 0.6,     // …but not one already against the chest
  cone: 0.75,    // how square in front it must be (dot)
  behind: 1.5,   // m past it the feet come down
  dur: 0.6,      // s in the air
  peak: 2.5,     // m the arc rises over the straight line (over a duellist's head and blade)
  stam: 34,      // stamina it costs (of 130)
  window: 0.9,   // s after the landing that a cut is still the strike to the back
  dmg: 1.5,      // that cut lands this much harder
};

const alive = e => !e.dead && !e.converted && e.state !== 'spawn' && !(e.t && e.t.fly);
// the foe to go over: the locked one if it is close in front, else the nearest close in front
function overTarget(){
  const pp = playerPos(), f = fwd(), O = OVERFLIP;
  const ok = e => {
    if (!e || !e.group || !alive(e)) return -1;
    const dx = e.group.position.x - pp.x, dz = e.group.position.z - pp.z, d = Math.hypot(dx, dz);
    if (d < O.near || d > O.range * (e.t && e.t.scale || 1)) return -1;
    return (dx * f.x + dz * f.z) / d >= O.cone ? d : -1;
  };
  const lt = player.lockTarget;
  if (lt && enemies.includes(lt) && ok(lt) >= 0) return lt;
  let best = null, bd = 1e9;
  for (const e of enemies){ const d = ok(e); if (d >= 0 && d < bd){ bd = d; best = e; } }
  return best;
}

// try the flip (doJump, guard up with W in a fight). False: no foe to go over, no stamina, or nowhere to land
export function tryOverflip(){
  const O = OVERFLIP;
  if (player.stam < O.stam || !player.grounded) return false;
  const e = overTarget();
  if (!e) return false;
  const pp = playerPos(), fp = e.group.position;
  const dx = fp.x - pp.x, dz = fp.z - pp.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  const behind = O.behind + 0.4 * ((e.t && e.t.scale || 1) - 1);
  const x1 = fp.x + ux * behind, z1 = fp.z + uz * behind;
  const y1 = groundAt(x1, z1, pp.y + 1.2);
  if (solidAt(x1, y1 + 0.9, z1) || solidAt((pp.x + x1) / 2, pp.y + 2.4, (pp.z + z1) / 2)) return false;   // a wall there, or a beam overhead
  player.stam -= O.stam; player.stamDelay = stamDelay();
  // the view turns with the body over the top, so it comes down looking back at the foe
  const yaw1 = Math.atan2(fp.x - x1, fp.z - z1);
  player.mantle = { t: 0, dur: O.dur, x0: pp.x, y0: pp.y, z0: pp.z, x1, y1, z1, keep: 0,
                    over: { peak: O.peak * Math.max(1, (e.t && e.t.scale) || 1), yaw0: G.yaw, yaw1, foe: e } };
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
  player.wallRun = null; player.gliding = false;
  // the whole flip clears the blade: it is over the foe's head
  player.dashT = Math.max(player.dashT || 0, O.dur); player.dashStartT = G.gt; player.dodgeKind = 'evade'; player.dashSpent = false;
  // a front somersault, pike to tuck; the turn of the view makes it a twisting one
  player.flip = { t: 0, dur: O.dur, somer: 1, lift: 0.2, legs: 'tuck', arms: 'tuck', side: 1, ease: 'twirl', face: G.yaw };
  player.momentum = { kind: 'overflip', until: G.gt + O.dur + O.window };
  floater(pp, 'FLIP OVER', '#7fe0ff');
  burst(V3(pp.x, pp.y + 0.2, pp.z), 0x88ddff, 8, 4, 3);
  S.dash();
  tutEvent('overflip');
  return true;
}

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = k => k * k * (3 - 2 * k);
// one frame of the flip (parkour.js updateMantle hands it over): a high arc over the foe, the view turning with it
export function overflipStep(m, k, pp){
  const o = m.over;
  pp.x = m.x0 + (m.x1 - m.x0) * k;
  pp.z = m.z0 + (m.z1 - m.z0) * k;
  pp.y = m.y0 + (m.y1 - m.y0) * k + 4 * o.peak * k * (1 - k);
  const tk = smooth(clamp((k - 0.15) / 0.7, 0, 1));   // the turn happens over the top
  G.yaw = o.yaw0 + wrap(o.yaw1 - o.yaw0) * tk;
  if (player.flip) player.flip.face = G.yaw;
}
