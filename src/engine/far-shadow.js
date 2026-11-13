// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FAR BODIES DON'T CAST — every body on the field (a foe, a squadmate, a co-op partner) is drawn twice: once for the
// screen and once more into the sun's shadow map, a draw for each of its parts (a trooper is some twenty). Far from the
// camera its shadow is a few pixels nobody reads, so past a distance it stops casting. Sooner on the lower tiers, which
// weaker machines sit on (and which the frame-rate governor steps down to: engine/quality.js). A co-op fight has half
// again as many foes for each hero (data/coop.js SCALE.waves) and every hero's squad on every screen, so this is most of
// what keeps a shared fight drawing like a solo one. Gameplay never reads it: only the shadow pass changes.
// Switched only as a body crosses the line (2 m either side), never a frame at a time: the walk over its parts is the
// cost, and it is paid once per crossing.

import { camera } from './renderer.js';
import { qualityLevel } from './quality.js';

export const SHADOW_NEAR = { low: 12, medium: 20, high: 35 };
const HYST = 2;

/* `holder` keeps whether it is far now (holder.farShadow), `group` is its body. A fresh body (rebuilt meshes) should
   clear holder.farShadow so it is walked again */
export function farShadow(holder, group){
  if (!group) return;
  const near = SHADOW_NEAR[qualityLevel()] || 20;
  const far = group.position.distanceTo(camera.position) > near + (holder.farShadow ? -HYST : HYST);
  if (far !== !!holder.farShadow) cast(holder, group, far);
}
function cast(holder, group, far){
  holder.farShadow = far;
  group.traverse(o => { if (!o.isMesh) return; if (o.userData.cs === undefined) o.userData.cs = o.castShadow; o.castShadow = !far && o.userData.cs; });
}

/* every body in a list (the foes, the squad): `keep` says which always cast (a boss, a final boss: few, and they own
   the fight's frame) */
export function farShadows(list, keep){
  for (const b of list){
    if (!b || !b.group) continue;
    if (keep && keep(b)){ if (b.farShadow) cast(b, b.group, false); continue; }   // (made a boss while far: casts again)
    farShadow(b, b.group);
  }
}
