// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PEOPLE ON THE FIELD — whoever a mission is getting out: a hold's evacuees (game/mission.js), a child who froze
// (game/twists/stragglers.js), the escort being walked. The mission lists them here every frame it runs (the host's;
// a co-op guest's foes are the host's puppets), and the rest of the game reads the list:
//   · the foes give them room (enemies/ai.js): they steer round the line and never walk through a body; a foe that
//     shoulders through a gap pushes the people aside as it goes, and they flinch away from it
//   · a hostile bolt or blast that meets one stops in it (enemies/bolts.js, enemies/grenades.js), and the one it hit
//     goes down (game/mission.js: the line stalls behind them and the hold loses ground)
//   · a few troopers are sent to shoot at them on purpose (game/mission.js `civHunt`, enemies/ai.js): a long, bright
//     aim line marks each shot, so it can be stopped
// An entry: { m: its model (Object3D), r: its radius, h: its height, down: seconds still on the ground (0 standing),
//             vx, vz: how it's moving (for a hunter's lead), hit(by): what a hit does (none: it can't be hit),
//             shove(dx, dz): how a foe pushing past moves it (none: it stands its ground) }
export const CIV = { list: [] };

export const CIV_TUNE = {
  room: 1.9,       // how far (m, beyond both bodies) a foe starts to give one of them room
  push: 1.5,       // how hard it steers off them inside that
  look: 3.6,       // how far ahead a foe looks for someone in its way, to go round them
  side: 2.2,       // how hard it swings round them
  hunt: {
    every: 2,      // from the hold's second wave on, one ranged trooper in each wave is sent at the people (one at a time)
    aggro: 7,      // ...and turns on the hero instead once the hero comes this close
    tell: 1.6,     // its shot at them winds up this much slower than its shot at you (and paints a line all the way)
    lead: 0.85,    // how much of their walk it leads them by
  },
};

export const civUp = (c) => !!(c.m.visible && c.m.parent && !(c.down > 0));

/* a foe's steer around the people (added to its heading mx, mz): give room up close, and go round anyone in the way
   ahead. Returns the lateral nudge it added, so the caller can tell it's routing round someone. */
export function civSteer(e, x, z, hx, hz, er, out){
  out.x = 0; out.z = 0;
  if (!CIV.list.length) return false;
  const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
  let best = null, bestStr = 0, bestPerp = 0;
  for (const c of CIV.list){
    if (!c.m.visible || !c.m.parent) continue;
    const ox = c.m.position.x - x, oz = c.m.position.z - z, od = Math.hypot(ox, oz) || 0.001;
    const room = c.r + er + CIV_TUNE.room;
    if (od < room){ const k = (1 - od / room) * CIV_TUNE.push / od; out.x -= ox * k; out.z -= oz * k; }
    const look = c.r + er + CIV_TUNE.look;
    if (od > look) continue;
    const ahead = (ox * hx + oz * hz) / od;
    if (ahead <= 0.2) continue;
    const perp = -ox * hz + oz * hx, clear = c.r + er + 0.35;
    if (Math.abs(perp) > clear) continue;
    const str = (1 - od / look) * ahead;
    if (str > bestStr){ bestStr = str; best = c; bestPerp = perp; }
  }
  if (best){
    // commit to one side of whoever it's going round (as with cover: flip-flopping pins it in place)
    if (e.civAvoid !== best){ e.civAvoid = best; e.civSide = bestPerp >= 0 ? 1 : -1; }
    const k = bestStr * CIV_TUNE.side;
    out.x += e.civSide * hz * k; out.z += e.civSide * -hx * k;
  } else e.civAvoid = null;
  return !!best;
}

/* bodies never overlap: a foe that ends a step inside someone is set back out of them. Whoever can be shoved (an
   evacuee) takes part of it, stepping aside from the foe; someone who can't (a frozen child, the escort) takes none. */
export function civSeparate(g, er){
  for (const c of CIV.list){
    if (!c.m.visible || !c.m.parent) continue;
    const dx = g.position.x - c.m.position.x, dz = g.position.z - c.m.position.z, d = Math.hypot(dx, dz), min = c.r + er * 0.6;
    if (d >= min) continue;
    const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, over = min - d;
    const theirs = c.shove && !(c.down > 0) ? 0.45 : 0;
    g.position.x += nx * over * (1 - theirs); g.position.z += nz * over * (1 - theirs);
    if (theirs) c.shove(-nx * over * theirs, -nz * over * theirs);
  }
}

/* the first one a segment (a bolt's step) passes through: { c, t } (t 0..1 along it) or null */
export function civSweep(a, b, pad){
  let best = null;
  for (const c of CIV.list){
    if (!c.hit || !civUp(c)) continue;
    const p = c.m.position, r = c.r + pad;
    const ax = a.x - p.x, az = a.z - p.z, dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
    const qa = dx * dx + dz * dz;
    let t;
    if (qa < 1e-9){ if (ax * ax + az * az > r * r) continue; t = 0; }
    else {
      const qb = 2 * (ax * dx + az * dz), qc = ax * ax + az * az - r * r, disc = qb * qb - 4 * qa * qc;
      if (disc < 0) continue;
      const q = Math.sqrt(disc), t0 = (-qb - q) / (2 * qa), t1 = (-qb + q) / (2 * qa);
      if (t1 < 0 || t0 > 1) continue;
      t = Math.max(0, t0);
    }
    const y = a.y + dy * t - (p.y || 0);
    if (y < 0 || y > c.h + pad) continue;
    if (!best || t < best.t) best = { c, t };
  }
  return best;
}

/* a blast at (x, z) of radius R: everyone standing in it goes down */
// covered(x, y, z): true where a wall between shields them (a detonator's blast, enemies/grenades.js)
export function civBlast(x, z, R, by, covered){
  for (const c of CIV.list){
    if (!c.hit || !civUp(c)) continue;
    const cp = c.m.position;
    if (Math.hypot(cp.x - x, cp.z - z) < R + c.r && !(covered && covered(cp.x, cp.y, cp.z))) c.hit(by, 'blast');
  }
}

/* who a hunter aims at: the nearest one standing within reach of it, led a little along their walk */
export function civTarget(x, z, range, out){
  let best = null, bd = range * range;
  for (const c of CIV.list){
    if (!c.hit || !civUp(c)) continue;
    const dx = c.m.position.x - x, dz = c.m.position.z - z, d2 = dx * dx + dz * dz;
    if (d2 < bd){ bd = d2; best = c; }
  }
  if (!best) return null;
  out.set(best.m.position.x, 0, best.m.position.z);
  return best;
}
