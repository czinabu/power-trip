// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: Tipoca's drowned lower levels on Kamino, where the clones were grown and trained (the ARC
// trooper's THE DROWNED CITY and THE OLD KILL HOUSE, data/missions.js drowned and oldkillhouse). The city was
// abandoned when the Empire stopped buying clones; the sea has been coming in ever since.

import * as THREE from 'three';
import { spawnBarrel } from '../hazards.js';
import { shared, solids } from '../../state.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';
import { addDoor } from '../doors.js';

/* THE DROWNED LEVELS (60 across, half 30), in the storm.
     · the LANDING PLATFORM in the south (z −30…−12): the gunship sets the band down on the pad, with crates and cargo
       sleds for cover; the hero starts there facing north;
     · the HALL WALL across the deck at z −12 (4.5 m), open in the middle (x −8…8) and at both ends (|x| > 26);
     · the CLONING HALL beyond: rows of empty GROWTH PODS (x ±10, ±22), sea water across the floor, and the three ARCHIVE
       stacks that hold the batch files (the gold consoles);
     · the TRAINING LEVEL in the north (z 18…28): the old kill house you both grew up on, low drill walls (1.6) and the
       instructor's box at the back.
   Every lane between solids is at least 3 m. */
export const KAMINO_SPOTS = {
  start: [0, -24, 0],                         // on the landing pad, facing the hall
  pad: [0, -21],                              // where the gunship comes back down
  archives: [[-16, 8], [16, 8], [0, 22]],     // the batch file stacks (THE DROWNED CITY)
  posts: [[-16, -4], [16, 0], [0, 17]],       // the drill's posts (THE OLD KILL HOUSE)
  duel: [0, 12],                              // where the Marshal's record steps out
  // THE SEALED ARCHIVE (a level with `sealed`: WHO GAVE THE ORDER): the training level walled in round the third stack,
  // two rooms deep. Door 0 in its south face into the ante-room, door 1 through the partition into the vault
  sealed: {
    stack: [[0, 14.4], [6, 18.6]],            // where the squad stacks up on doors 0, 1
    rooms: [
      { at: [0, 18.2], spots: [[-7, 18], [-3, 19.2], [3, 17.4], [8, 18.8], [-8.5, 17.2]] },               // the ante-room
      { at: [0, 25], spots: [[-6, 23], [6, 23.4], [-4, 26.6], [4, 26.6], [-7, 29], [7, 29]] },           // the vault
    ],
  },
};
const PODS = [[-22, -4], [-22, 4], [-22, 12], [-10, -4], [-10, 4], [-10, 14], [10, -4], [10, 4], [10, 14], [22, -4], [22, 4], [22, 12]];

export function buildKaminoArena(L){
  const pal = L.pal || {};
  const wall   = new THREE.MeshStandardMaterial({ color: pal.wall ?? 0xd8dee4, roughness: 0.45, metalness: 0.2 });
  const wallD  = new THREE.MeshStandardMaterial({ color: pal.wallD ?? 0x8a98a6, roughness: 0.5, metalness: 0.3 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x9aa6b2, roughness: 0.45, metalness: 0.5 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x3e4852, roughness: 0.6, metalness: 0.45 });
  const glass  = new THREE.MeshStandardMaterial({ color: pal.glass ?? 0x9ad8f0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.4 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x6a7480, roughness: 0.8 });
  const gold   = new THREE.MeshStandardMaterial({ color: pal.gold ?? 0xc8a050, roughness: 0.4, metalness: 0.6 });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xd8f0ff });
  const screen = new THREE.MeshBasicMaterial({ color: pal.screen ?? 0x6ad8ff });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff4a3a });
  const sea    = new THREE.MeshStandardMaterial({ color: pal.sea ?? 0x2a4a5a, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.55 });
  const K = arenaKit(), R = seeded(71);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };

  // ---- the LANDING PLATFORM: the pad's ring, cargo sleds and crates ----
  picture(K.deco(new THREE.RingGeometry(5.2, 5.6, 32), lamp, KAMINO_SPOTS.pad[0], 0.02, KAMINO_SPOTS.pad[1], -Math.PI / 2));
  for (const [x, z, ax] of [[-15, -20, 1], [15, -18, 0], [-6, -28, 1], [24, -26, 1], [-25, -15, 0]])
    K.box(x, z, ax ? 2.4 : 1.1, ax ? 1.1 : 2.4, 1.6, crate);   // cargo sleds (1.6: stops a bolt)
  for (const [x, z] of [[8, -27], [-22, -26]]){ K.box(x, z, 0.9, 0.9, 2.2, crate); K.box(x + 1.7, z + 0.3, 0.8, 0.8, 1.1, crate); }
  for (const [x, z] of [[-11, -27], [27, -20]]) spawnBarrel(V3(x, 0, z));
  // the platform's rail at the south edge, over the sea (a picture past the play space)
  picture(K.deco(new THREE.BoxGeometry(60, 0.08, 0.08), metalD, 0, 1.1, -29.6));
  for (let x = -28; x <= 28; x += 4) picture(K.deco(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), metalD, x, 0.55, -29.6));

  // ---- the HALL WALL across the deck, open in the middle and at both ends ----
  for (const [x0, x1] of [[-26, -8], [8, 26]]){
    K.box((x0 + x1) / 2, -12, (x1 - x0) / 2, 0.5, 4.5, wall);
    picture(K.deco(new THREE.BoxGeometry(x1 - x0, 0.25, 1.04), wallD, (x0 + x1) / 2, 3.4, -12));
    for (let x = x0 + 3; x < x1 - 1; x += 5) picture(K.deco(new THREE.CircleGeometry(0.6, 16), screen, x, 2.6, -12.52, 0, Math.PI, 0));   // the round windows
  }
  for (const sx of [-1, 1]) K.column(sx * 8.6, -12, 0.7, 5.2, metalD, { seg: 10, taper: 1 });
  picture(K.deco(new THREE.BoxGeometry(18, 0.7, 1.3), wallD, 0, 5.2, -12));

  // ---- the CLONING HALL: growth pods in rows, the sea on the floor, the archive stacks ----
  for (const [x, z] of PODS){
    K.column(x, z, 0.95, 3.4, glass, { seg: 12, taper: 1 });
    K.deco(new THREE.CylinderGeometry(1.15, 1.15, 0.45, 12), metalD, x, 0.22, z);
    K.deco(new THREE.CylinderGeometry(1.1, 1.1, 0.5, 12), metalD, x, 3.6, z);
    picture(K.deco(new THREE.CylinderGeometry(0.06, 0.06, 6, 5), metalD, x, 6.8, z));   // its feed line up into the dark
  }
  for (const [x, z, w, d] of [[-16, 4, 14, 20], [16, 4, 14, 20], [0, -4, 10, 8]])
    picture(K.deco(new THREE.PlaneGeometry(w, d), sea, x, 0.03, z, -Math.PI / 2)).receiveShadow = false;
  // the low wall in front of the hall's door (cover for the push in)
  K.box(0, -5, 2.6, 0.6, 1.6, wallD);
  for (const [x, z] of KAMINO_SPOTS.archives){   // each stack: a tall gold cabinet behind its console
    const back = z > 18 ? 1 : 0;
    K.box(x, z + 2.2, 1.6, 0.6, 3.2, gold);
    K.box(x, z + 1.2, 1.0, 0.4, 1.1, metalD, { climbable: true });
    picture(K.deco(new THREE.PlaneGeometry(1.4, 0.5), screen, x, 1.3, z + 0.79, -0.5, 0, 0));
    if (!back) for (const k of [-1, 0, 1]) picture(K.deco(new THREE.BoxGeometry(0.2, 2.6, 0.04), lamp, x + k * 1.0, 1.7, z + 1.58));
  }

  // ---- the TRAINING LEVEL: drill walls and the instructor's box ----
  for (const [x, z, ax] of [[-20, 22, 1], [20, 22, 1], [-9, 27, 0], [9, 27, 0], [-24, 27, 0], [24, 27, 0]])
    K.box(x, z, ax ? 2.6 : 0.5, ax ? 0.5 : 2.2, 1.6, wallD);
  for (const [x, z] of [[-20, 21.4], [20, 21.4]]) picture(K.deco(new THREE.BoxGeometry(5.2, 0.12, 0.05), red, x, 1.4, z));
  K.box(0, 29, 4, 0.8, 1.2, metal, { climbable: true });   // the instructor's box: a step up at the back
  picture(K.deco(new THREE.PlaneGeometry(3.2, 1.2), screen, 0, 3.0, 29.7, 0, Math.PI, 0));

  if (L.sealed) buildSealedArchive(K, wall, wallD, metalD, red);

  // ---- the city around it: a wall past the east and west edges, the storm beyond, lamps overhead ----
  for (const sx of [-1, 1]){
    picture(K.deco(new THREE.BoxGeometry(1, 9, 42), wall, sx * 30.6, 4.5, 9));
    for (let z = -8; z <= 26; z += 6) picture(K.deco(new THREE.CircleGeometry(0.7, 16), screen, sx * 30.05, 4.2, z, 0, -sx * Math.PI / 2, 0));
  }
  picture(K.deco(new THREE.BoxGeometry(62, 9, 1), wall, 0, 4.5, 30.6));
  for (let z = -8; z <= 28; z += 9) picture(K.deco(new THREE.BoxGeometry(56, 0.5, 0.7), wallD, 0, 9.5, z));
  for (const [x, z] of [[-16, -16], [16, -24], [0, -18], [-28, 0], [28, 8]]){
    K.column(x, z, 0.14, 4.4, metalD, { wallKick: false, seg: 6, taper: 1 });
    K.deco(new THREE.SphereGeometry(0.24, 8, 6), lamp, x, 4.55, z);
  }
  for (let i = 0; i < 10; i++){
    const r = 0.8 + R() * 1.6;
    picture(K.deco(new THREE.CircleGeometry(r, 14), sea, (R() - 0.5) * 50, 0.025, -20 + (R() - 0.5) * 14, -Math.PI / 2)).receiveShadow = false;
  }
}

/* THE SEALED ARCHIVE: 4.2 m walls round the training level (x −10…10, z 16…30), no roof (the camera looks in from
   above), split by a partition at z 20.5 into the ante-room and the vault where the third stack stands. Blast doors in
   each gap, in breach order (world/doors.js): 0 the south face at x 0, 1 the partition at x 6. The pods at the corners
   keep a lane past it; the drill walls inside are cover. */
const AH = 4.2, AT = 0.3;
function buildSealedArchive(K, wall, wallD, metalD, red){
  const door = new THREE.MeshStandardMaterial({ color: 0x8a96a2, roughness: 0.45, metalness: 0.55 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x3a8ac8, roughness: 0.5, metalness: 0.3 });
  const capped = (m, geo) => { const c = new THREE.Mesh(geo, wallD); c.position.y = AH / 2 + 0.1; c.castShadow = c.receiveShadow = true; m.add(c); };
  const wx = (x0, x1, z) => capped(K.box((x0 + x1) / 2, z, (x1 - x0) / 2, AT, AH, wall), new THREE.BoxGeometry(x1 - x0, 0.2, AT * 2 + 0.2));
  const wz = (z0, z1, x) => capped(K.box(x, (z0 + z1) / 2, AT, (z1 - z0) / 2, AH, wall), new THREE.BoxGeometry(AT * 2 + 0.2, 0.2, z1 - z0));
  wx(-10.3, -1.3, 16); wx(1.3, 10.3, 16);       // the south face, door 0 at x 0
  wx(-10, 4.7, 20.5); wx(7.3, 10, 20.5);        // the partition, door 1 at x 6
  wx(-10.3, 10.3, 30);
  wz(16, 30, -10); wz(16, 30, 10);
  const blastDoor = (x, z) => {
    const hx = 1.3, hz = 0.22, dh = 3.3, g = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, dh, hz * 2), door); leaf.position.y = dh / 2; g.add(leaf);
    const band = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, 0.22, hz * 2 + 0.04), stripe); band.position.y = 1.6; g.add(band);
    for (const y of [0.8, 2.5]){ const r = new THREE.Mesh(new THREE.BoxGeometry(hx * 1.6, 0.08, hz * 2 + 0.06), metalD); r.position.y = y; g.add(r); }
    g.position.set(x, 0, z); g.traverse(m => { if (m.isMesh){ m.castShadow = true; m.receiveShadow = true; } });
    K.deco(new THREE.BoxGeometry(2.6, AH - dh, AT * 2), wall, x, dh + (AH - dh) / 2, z);   // the lintel
    K.slab(x, z, 1.3, AT, dh, AH);
    const solid = { x, z, hx, hz, h: dh, box: true };
    solids.push(solid);
    const lamp = K.deco(new THREE.BoxGeometry(0.6, 0.25, 0.06), red, x, dh + 0.25, z - 0.34); lamp.userData.passThrough = true;
    shared.arenaGroup.add(g); addDoor(g, solid, [x, z]);
  };
  blastDoor(0, 16); blastDoor(6, 20.5);
}
