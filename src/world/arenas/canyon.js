// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: a wind-blasted canyon where the Marshal's trail runs (the ARC trooper's THE HUNT, data/missions.js
// hunt). Three of his camps up the dry riverbed, each a little fresher than the last, and his last one at the top.

import * as THREE from 'three';
import { spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';

/* THE CANYON (64 across, half 32), in a dust wind at noon.
     · the CANYON WALLS past the east and west edges, with ROCK SPURS running in from both sides (hard cover, a climb);
     · the DRY RIVERBED winding up the middle from the south, boulders along it;
     · the Marshal's three CAMPS up the canyon: west (z −14), east (z 2), and his last at the top (z 20), each a tarp
       on poles, crates and a low rock wall (1.6) round it;
     · rock SHELVES (low, climbable) along the walls for the overwatch.
   Every lane between solids is at least 3 m. */
export const CANYON_SPOTS = {
  start: [0, -27, 0],                          // at the canyon's mouth, facing up it
  camps: [[-13, -14], [14, 2], [-5, 21]],      // his trail, camp by camp
  duel: [-4, 13],                              // where he turns to fight
};

export function buildCanyonArena(L){
  const pal = L.pal || {};
  const rock   = new THREE.MeshStandardMaterial({ color: pal.rock ?? 0xa8704a, roughness: 0.95 });
  const rockD  = new THREE.MeshStandardMaterial({ color: pal.rockD ?? 0x8a5838, roughness: 0.95 });
  const sand   = new THREE.MeshStandardMaterial({ color: pal.sand ?? 0xc8a070, roughness: 1 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x4a4a42, roughness: 0.85 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x2e3238, roughness: 0.6, metalness: 0.45 });
  const tarp   = new THREE.MeshStandardMaterial({ color: pal.tarp ?? 0x5a2a24, roughness: 0.9, side: THREE.DoubleSide });
  const ember  = new THREE.MeshBasicMaterial({ color: pal.ember ?? 0xff8a3a });
  const K = arenaKit(), R = seeded(113);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };

  // ---- the CANYON WALLS past the edges, and the ROCK SPURS running in ----
  for (const sx of [-1, 1]){
    picture(K.deco(new THREE.BoxGeometry(4, 18, 70), rock, sx * 34, 9, 0));
    for (let z = -28; z <= 28; z += 7) picture(K.deco(new THREE.BoxGeometry(2, 4 + R() * 6, 6), rockD, sx * 31.8, 2 + R() * 3, z));
  }
  picture(K.deco(new THREE.BoxGeometry(70, 16, 4), rock, 0, 8, 34));
  for (const [x, z, hx, hz, h] of [[-25, -4, 4, 2.2, 3.6], [24, -16, 5, 2.4, 4.2], [25, 14, 4, 2.4, 3.4], [-24, 12, 5, 2.0, 4.0]]){
    K.box(x, z, hx, hz, h, rock);
    K.box(x + (x < 0 ? hx + 0.9 : -hx - 0.9), z, 0.9, 1.2, 1.2, rockD, { climbable: true });   // a step up onto it
  }
  // the shelves along the walls (overwatch)
  for (const [x, z] of [[-28, -22], [28, -4], [-28, 24], [28, 26]]) K.box(x, z, 1.8, 2.6, 1.2, rockD, { climbable: true });

  // ---- the DRY RIVERBED and its boulders ----
  for (const [x, z, w, d, ry] of [[2, -20, 6, 16, 0.2], [0, -4, 6, 18, -0.35], [4, 12, 6, 16, 0.3]])
    picture(K.deco(new THREE.PlaneGeometry(w, d), sand, x, 0.02, z, -Math.PI / 2, 0, ry)).receiveShadow = false;
  for (const [x, z, r, h] of [[7, -20, 1.6, 1.9], [-6, -6, 1.8, 2.2], [9, -9, 1.4, 1.7], [-14, 4, 1.6, 2.0], [12, 16, 1.7, 2.1], [-18, -24, 1.5, 1.8], [18, -26, 1.6, 2.0], [4, 26, 1.4, 1.7]])
    K.column(x, z, r, h, rockD, { seg: 7, taper: 0.75 });

  // ---- the Marshal's CAMPS: a tarp on poles, his crates, a low rock wall on the side you come from ----
  CANYON_SPOTS.camps.forEach(([x, z], i) => {
    for (const [dx, dz] of [[-1.8, 1.6], [1.8, 1.6], [-1.8, 4.4], [1.8, 4.4]]) K.column(x + dx, z + dz, 0.1, 2.4, metalD, { wallKick: false, seg: 5, taper: 1 });
    picture(K.deco(new THREE.BoxGeometry(4.2, 0.06, 3.4), tarp, x, 2.45, z + 3));
    K.box(x + 3.6, z + 3, 0.9, 0.9, 1.8, crate); K.box(x - 3.6, z + 3.2, 0.8, 0.8, 1.1, crate);
    K.box(x, z - 3.4, 2.6, 0.6, 1.6, rock);                                                       // the wall on the trail side
    picture(K.deco(new THREE.CircleGeometry(0.5, 10), i === 2 ? ember : metalD, x, 0.03, z + 0.4, -Math.PI / 2));   // his fire (the last one still warm)
  });
  for (const [x, z] of [[-20, -14], [20, 6]]) spawnBarrel(V3(x, 0, z));

  // ---- dust drifts on the ground ----
  for (let i = 0; i < 12; i++){
    const r = 1.2 + R() * 2.2;
    picture(K.deco(new THREE.CircleGeometry(r, 12), sand, (R() - 0.5) * 54, 0.015, (R() - 0.5) * 54, -Math.PI / 2)).receiveShadow = false;
  }
}
