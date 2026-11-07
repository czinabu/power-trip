// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// RAID ROLES: what kind of blow just landed on a boss with a sunder bar (data/boss-kharel.js `sunder`, boss/finale.js),
// worked out on the screen of the hero who struck it. A guest's blows go to the host with these tags on them
// (net/run.js queueHit), so the host fills the bar by what each hero actually did on their own screen.
//   DEFLECT   a bolt turned back off a blade (enemies/bolts.js marks it)
//   BEHIND    struck from behind him (the hero stands at his back)
//   AIR       struck from above (the hero is up off the floor: a jump, a hover, a ledge)
//   SHOT      a gunshot; TROOPER when the ARC trooper fired it
//   SQUAD     a squadmate's shot (allies/squad.js)
// No imports but the state: enemies/damage.js reads this on every blow on the boss.

import { G, player } from '../state.js';

export const ROLE = { deflect: 1, behind: 2, air: 4, shot: 8, trooper: 16, squad: 32 };
// how far round his back counts as behind him (the cosine of the hero's bearing off his facing) and how high is above
export const ROLE_AT = { behind: -0.25, air: 1.4 };

export function roleTags(e, opts){
  if (opts && opts.ally) return ROLE.squad;
  let t = 0;
  if (opts && opts.deflected) t |= ROLE.deflect;
  if (opts && opts.shot){ t |= ROLE.shot; if (G.hero === 'trooper') t |= ROLE.trooper; }
  const p = player.group.position, g = e.group.position;
  const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz) || 1;
  const fx = Math.sin(e.group.rotation.y), fz = Math.cos(e.group.rotation.y);
  if ((dx * fx + dz * fz) / d < ROLE_AT.behind) t |= ROLE.behind;
  if (p.y > ROLE_AT.air) t |= ROLE.air;
  return t;
}
// is this foe a boss that reads the tags? (only those: nobody else pays for working them out)
export const takesRoles = (e) => !!e && (e.fin ? !!e.fin.def.sunder : !!e.roles);
