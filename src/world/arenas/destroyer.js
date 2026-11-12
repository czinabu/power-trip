// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: THE WARSHIP, the star destroyer the Buyer paid for the clans' beskar with, hanging over Jedha
// (Act IV's boarding, data/missions-boarding.js). Grey decks under hard white light, the stars past the hangar's mouth.

import * as THREE from 'three';
import { spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';

/* THE MAIN HANGAR AND THE REACTOR DECK (64 across, half 32).
     · the HANGAR in the south (z −32…−6): the hangar's mouth along the south edge (the shield, and the stars past it);
       the party's stolen shuttle set down in the south-west, its ramp toward the deck; a RACK of fighters along the east
       side (tall cover to slip between); crate stacks and fuel carts; a raised CONTROL BOOTH on the west wall (a step up)
     · a BULKHEAD across the deck at z −6 (5 m), its blast door open in the middle (x −6…6), a crawlway at each end (|x| 24…28)
     · the REACTOR DECK beyond: the reactor's column in the middle (z 12, 3.4 m round), a ring of conduit housings
       round it (tall cover), the three COUPLINGS that feed the ship's guns: a sealed one in the west (x −19), a gantry up
       in the north (z 25, 2.6 m up, climbed by its steps) and the gun crews' line in the east (x 19)
     · the far wall past the north edge: the bridge lift's doors (a picture)
   Every lane between solids is at least 3 m, and there is tall cover (1.6 m and up) in every stretch a guard walks. */
export const DESTROYER_SPOTS = {
  start: [-8, -21, 0],                   // at the foot of the shuttle's ramp, facing the bay
  shuttle: [-15, -20],                  // the shuttle (the way out)
  booth: [-25, -12],                    // the control booth's console
  rack: [21, -24],                      // the fighter rack's fuel line
  door: [0, -6],                        // the blast door's panel (the infiltrate's last mark, then the way through)
  reactor: [0, 12],
  couplings: { seal: [-19, 10], sky: [0, 25], line: [19, 10] },
  gantryY: 2.6,
};

export function buildDestroyerArena(L){
  const pal = L.pal || {};
  const wall   = new THREE.MeshStandardMaterial({ color: pal.wall ?? 0x9aa0a8, roughness: 0.6, metalness: 0.25 });
  const wallD  = new THREE.MeshStandardMaterial({ color: pal.wallD ?? 0x5a6068, roughness: 0.6, metalness: 0.3 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x7a8088, roughness: 0.5, metalness: 0.35 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x32363e, roughness: 0.6, metalness: 0.35 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x4a4e54, roughness: 0.85 });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xe8f0ff });
  const screen = new THREE.MeshBasicMaterial({ color: pal.screen ?? 0x6ac8ff });
  const red    = new THREE.MeshBasicMaterial({ color: pal.warn ?? 0xff4a3a });
  const shield = new THREE.MeshBasicMaterial({ color: pal.shield ?? 0x6aa8ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  const core   = new THREE.MeshBasicMaterial({ color: pal.core ?? 0x9ad8ff });
  const K = arenaKit(), R = seeded(71);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };
  const S = DESTROYER_SPOTS;

  // ---- the HANGAR'S MOUTH along the south edge: the shield across it, the hull's lip over it ----
  picture(K.deco(new THREE.PlaneGeometry(62, 14), shield, 0, 7, -32.4));
  picture(K.deco(new THREE.BoxGeometry(66, 3, 2), wallD, 0, 15, -32.6));
  for (const sx of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(2, 16, 2), wallD, sx * 32.6, 8, -32.6));
  for (let x = -28; x <= 28; x += 7) picture(K.deco(new THREE.BoxGeometry(2.2, 0.2, 0.3), lamp, x, 0.11, -31));   // the landing lights

  // ---- the SHUTTLE: the party's stolen shuttle, set down nose-in, ramp toward the deck ----
  { const [sx, sz] = S.shuttle;
    K.box(sx, sz, 3.2, 4.6, 3.4, metal);
    K.deco(new THREE.BoxGeometry(6.8, 0.5, 10), metalD, sx, 3.6, sz);
    picture(K.deco(new THREE.BoxGeometry(0.4, 7, 4.2), metalD, sx, 7.2, sz - 1));   // the tall dorsal wing
    for (const s of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(3.2, 0.3, 4), metalD, sx + s * 4.4, 2.6, sz - 1, 0, 0, s * -0.5));
    K.box(sx + 4.1, sz - 1.2, 0.9, 1.2, 0.5, metalD, { climbable: true });   // the ramp's foot
    picture(K.deco(new THREE.PlaneGeometry(2.2, 0.8), screen, sx + 3.22, 2.4, sz + 1.5, 0, Math.PI / 2, 0)); }

  // ---- the FIGHTER RACK along the east side: hulls hung on a frame over the deck, tall cover between them ----
  for (const z of [-27, -19, -11]){
    K.box(26.5, z, 1.4, 2.6, 6, metalD);                                   // the rack's upright
    K.column(22.5, z, 1.5, 4.2, metal, { seg: 12, taper: 1 });            // a fighter's ball cockpit, hung
    for (const s of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(0.3, 4.6, 3.6), metalD, 22.5, 3.2, z + s * 2.2));   // its wings
  }
  K.box(14, -24, 1.3, 0.9, 1.9, crate); K.box(14, -21.4, 0.9, 0.9, 1.2, crate);   // a fuel cart and its tank
  // ---- crate stacks in the bay: tall cover for the guards' beats ----
  for (const [x, z, h] of [[-2, -24, 2.2], [6, -16, 2.4], [-6, -12, 1.9], [-19, -9.5, 2.0]]){
    K.box(x, z, 1.1, 1.1, h, crate);
    K.box(x + 2.3, z + 0.3, 0.9, 0.9, h * 0.55, crate);
  }
  for (const [x, z] of [[9, -28], [-28, -26]]) spawnBarrel(V3(x, 0, z));
  // ---- the CONTROL BOOTH on the west wall: a step up, a desk of screens ----
  K.box(-29, -14, 2.6, 4.2, 0.9, wall, { climbable: true });
  K.box(-30.8, -14, 0.6, 3.2, 1.4, wallD, { y: 0.9 });
  for (const dz of [-2, 0, 2]) picture(K.deco(new THREE.PlaneGeometry(1.2, 0.6), screen, -30.18, 2.0, -14 + dz, -0.3, Math.PI / 2, 0));

  // ---- the BULKHEAD at z −6: open in the middle (the blast door, slid up) and a crawlway at each end ----
  for (const [x0, x1] of [[-24, -6], [6, 24]]){
    K.box((x0 + x1) / 2, -6, (x1 - x0) / 2, 0.6, 5, wallD);
    picture(K.deco(new THREE.BoxGeometry(x1 - x0, 0.25, 1.24), red, (x0 + x1) / 2, 4.2, -6));
  }
  for (const sx of [-1, 1]){
    K.column(sx * 6.7, -6, 0.75, 5.6, metalD, { seg: 8, taper: 1 });
    K.slab(sx * 26, -6, 2, 0.6, 1.6, 5);                                   // the crawlway's lintel: crouch-height under it
    picture(K.deco(new THREE.BoxGeometry(4, 3.4, 1.2), wallD, sx * 26, 3.3, -6));
  }
  picture(K.deco(new THREE.BoxGeometry(14.6, 1.2, 1.4), metalD, 0, 5.8, -6));   // the blast door, up in its frame
  picture(K.deco(new THREE.BoxGeometry(12, 0.2, 0.2), red, 0, 5.1, -6.8));

  // ---- the REACTOR DECK: the column, a ring of conduit housings, the three couplings ----
  { const [cx, cz] = S.reactor;
    K.column(cx, cz, 3.4, 30, metalD, { seg: 16, taper: 0.85 });
    for (let y = 1.4; y < 30; y += 3.2) picture(K.deco(new THREE.TorusGeometry(3.3 - y * 0.017, 0.12, 4, 24), core, cx, y, cz, Math.PI / 2));
    for (let k = 0; k < 6; k++){                                              // conduit housings, every 60°, with gaps to slip through
      const a = k * Math.PI / 3 + Math.PI / 6, x = cx + Math.sin(a) * 9, z = cz + Math.cos(a) * 9;
      K.box(x, z, 1.2, 1.2, 2.1, wall);
      picture(K.deco(new THREE.BoxGeometry(0.3, 0.3, 4.5), core, cx + Math.sin(a) * 6, 0.3, cz + Math.cos(a) * 6, 0, a, 0));   // the feed in the floor
    }
  }
  // the sealed coupling in the west: a clamp housing with a violet seal on it
  { const [x, z] = S.couplings.seal;
    K.box(x - 2.4, z, 0.9, 1.6, 3.4, metalD);
    picture(K.deco(new THREE.TorusGeometry(0.9, 0.12, 6, 20), new THREE.MeshBasicMaterial({ color: 0x9a6aff }), x - 1.45, 1.8, z, 0, Math.PI / 2, 0)); }
  // the gantry in the north: a deck up at 2.6, climbed by two steps from the east, the coupling up on it
  { const [x, z] = S.couplings.sky, y = S.gantryY;
    K.box(x, z + 0.6, 4.2, 1.8, y, metal, { climbable: true });
    K.box(x + 5.4, z + 0.6, 1.2, 1.4, 0.9, metalD, { climbable: true });
    K.box(x + 7.4, z + 0.6, 0.9, 1.4, 1.75, metalD, { climbable: true });
    picture(K.deco(new THREE.BoxGeometry(8.4, 0.08, 0.08), metalD, x, y + 1.1, z - 1.2));
    picture(K.deco(new THREE.BoxGeometry(1.2, 1.6, 0.5), metalD, x, y + 0.8, z + 1.9)); }
  // the gun crews' line in the east: a long terminal bank
  { const [x, z] = S.couplings.line;
    K.box(x + 2.6, z, 0.7, 2.8, 1.7, wallD);
    for (const dz of [-1.6, 0, 1.6]) picture(K.deco(new THREE.PlaneGeometry(1.2, 0.6), screen, x + 1.88, 1.4, z + dz, 0, -Math.PI / 2, 0)); }
  // tall cover on the reactor deck's sides and south half
  for (const [x, z, h] of [[-12, 0, 2.2], [12, 0, 2.2], [-24, 20, 2.4], [24, 20, 2.4], [-11, 24, 1.8], [14, 24, 1.8]]) K.box(x, z, 1.2, 1.0, h, crate);

  // ---- the deck's walls past the edge, the bridge lift's doors, ribs overhead (pictures beyond the play space) ----
  for (const sx of [-1, 1]){
    picture(K.deco(new THREE.BoxGeometry(1, 12, 66), wall, sx * 32.6, 6, 0));
    for (let z = -26; z <= 26; z += 8) picture(K.deco(new THREE.BoxGeometry(0.2, 0.3, 2.6), lamp, sx * 32, 9.4, z));
  }
  picture(K.deco(new THREE.BoxGeometry(66, 12, 1), wall, 0, 6, 32.6));
  picture(K.deco(new THREE.BoxGeometry(5, 7, 0.3), metalD, 0, 3.5, 32));
  picture(K.deco(new THREE.BoxGeometry(0.2, 6.6, 0.32), lamp, 0, 3.5, 32));
  for (let z = -26; z <= 26; z += 8) picture(K.deco(new THREE.BoxGeometry(64, 0.8, 1.0), metalD, 0, 13, z));
  for (let i = 0; i < 12; i++) picture(K.deco(new THREE.BoxGeometry(0.5, 0.04, 0.5), metal, (R() - 0.5) * 50, 0.03, (R() - 0.5) * 50, 0, R() * 3, 0));
}
