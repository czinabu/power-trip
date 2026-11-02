// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story mission arena: the relay spire in the storm, where the Marshal means to give the order again (the ARC trooper's
// THE LAST ASSAULT and THE BROADCAST, data/missions.js lastassault and broadcast). Under it is something older than the
// clones; the spire only lends it a voice.

import * as THREE from 'three';
import { spawnBarrel } from '../hazards.js';
import { V3 } from '../../utils.js';
import { arenaKit, seeded } from './kit.js';

/* THE SPIRE (64 across, half 32), on a black headland in a lightning storm.
     · the APPROACH in the south: tank traps (1.6) and the band's landing ground (z −32…−16);
     · the OUTER DEFENCES: three GUN EMPLACEMENTS in an arc (sandbagged rings, a gun in each), the Last Assault's posts;
     · the SPIRE itself in the north (a tall column at z 17, its lift door on the south face) on a raised plinth, with
       three UPLINK PYLONS round it (the Broadcast's consoles) and an old stone ring in the ground, older than any of it.
   Every lane between solids is at least 3 m. */
export const RELAY_SPOTS = {
  start: [0, -26, 0],                               // the band's landing ground, facing the spire
  guns: [[-18, -8], [17, -5], [0, 1]],              // the emplacements (THE LAST ASSAULT)
  door: [0, 9],                                     // the spire's lift door
  pylons: [[-19, 19], [19, 19], [0, 28]],           // the uplinks (THE BROADCAST)
  duel: [0, 6],                                     // where the Marshal comes down
};

export function buildRelayArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x3a3a40, roughness: 0.9 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x24242a, roughness: 0.95 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x5a6068, roughness: 0.5, metalness: 0.55 });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x2a2e34, roughness: 0.6, metalness: 0.45 });
  const sand   = new THREE.MeshStandardMaterial({ color: pal.sand ?? 0x5a5648, roughness: 1 });
  const glow   = new THREE.MeshBasicMaterial({ color: pal.glow ?? 0x8ad8ff });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff3a2a });
  const old    = new THREE.MeshBasicMaterial({ color: pal.old ?? 0x9a7aff, transparent: true, opacity: 0.6 });
  const K = arenaKit(), R = seeded(131);
  const picture = m => { m.userData.passThrough = true; m.castShadow = false; return m; };

  // ---- the APPROACH: tank traps and the landing ground ----
  for (const [x, z, ax] of [[-10, -18, 1], [10, -20, 1], [-24, -22, 0], [24, -18, 0], [0, -12, 1], [-6, -28, 1]])
    K.box(x, z, ax ? 2.2 : 0.7, ax ? 0.7 : 2.2, 1.6, metalD);
  for (const [x, z] of [[-27, -4], [26, 8], [-26, 8]]) K.column(x, z, 1.6, 2.4, stoneD, { seg: 7, taper: 0.75 });   // boulders
  for (const [x, z] of [[14, -27], [-17, -14]]) spawnBarrel(V3(x, 0, z));

  // ---- the GUN EMPLACEMENTS: a ring of sandbags open at the back, a gun on a post ----
  for (const [x, z] of RELAY_SPOTS.guns){
    K.box(x, z - 2.8, 2.6, 0.6, 1.6, sand);                    // front
    for (const s of [-1, 1]) K.box(x + s * 3.0, z - 0.8, 0.6, 1.6, 1.6, sand);   // sides
    picture(K.deco(new THREE.CylinderGeometry(0.3, 0.35, 1.3, 8), metalD, x, 0.65, z));   // the gun's post (a picture: it leaves the ring open to fight in)
    picture(K.deco(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 6), metal, x, 1.5, z - 1.2, Math.PI / 2, 0, 0));   // its barrel, south
    picture(K.deco(new THREE.SphereGeometry(0.14, 6, 4), red, x, 1.9, z));
  }

  // ---- the SPIRE on its plinth, the lift door, the old ring in the ground ----
  K.box(0, 17, 6, 5, 1.2, stone, { climbable: true });                         // the plinth: a step up
  K.column(0, 17, 2.6, 32, metal, { seg: 12, taper: 0.45 });
  for (const y of [8, 16, 24]) picture(K.deco(new THREE.TorusGeometry(2.4 - y * 0.035, 0.12, 6, 20), glow, 0, y, 17, Math.PI / 2));
  picture(K.deco(new THREE.SphereGeometry(0.6, 10, 8), glow, 0, 32.4, 17));
  picture(K.deco(new THREE.PlaneGeometry(2.0, 2.6), glow, 0, 2.5, 14.35, 0, Math.PI, 0)).material = new THREE.MeshBasicMaterial({ color: 0x4ad2ff, side: THREE.DoubleSide });   // the lift door
  picture(K.deco(new THREE.RingGeometry(10.5, 11.1, 48), old, 0, 0.025, 17, -Math.PI / 2));
  for (let k = 0; k < 9; k++){ const a = k / 9 * Math.PI * 2; picture(K.deco(new THREE.BoxGeometry(0.5, 0.04, 1.4), old, Math.cos(a) * 10.8, 0.03, 17 + Math.sin(a) * 10.8, 0, -a, 0)); }

  // ---- the UPLINK PYLONS: a mast on a block, its dish to the sky, the console on its south face ----
  for (const [x, z] of RELAY_SPOTS.pylons){
    K.box(x, z + 2.2, 1.4, 1.0, 2.0, metalD);
    K.column(x, z + 2.2, 0.3, 9, metal, { seg: 8, taper: 0.6 });
    picture(K.deco(new THREE.CylinderGeometry(1.4, 0.2, 0.6, 12), metal, x, 9.3, z + 2.2));
    picture(K.deco(new THREE.PlaneGeometry(1.2, 0.5), glow, x, 1.4, z + 1.19, 0, Math.PI, 0));
  }
  // cover round the spire: low stone blocks in the open lanes
  for (const [x, z, ax] of [[-12, 8, 0], [12, 8, 0], [-9, 27, 1], [9, 27, 1], [-26, 22, 0], [26, 24, 0]])
    K.box(x, z, ax ? 2.2 : 0.7, ax ? 0.7 : 2.2, 1.6, stoneD);

  // ---- the headland's edge past the play space ----
  for (const sx of [-1, 1]) picture(K.deco(new THREE.BoxGeometry(2, 3, 66), stoneD, sx * 33.5, -0.6, 0));
  picture(K.deco(new THREE.BoxGeometry(66, 3, 2), stoneD, 0, -0.6, 33.5));
  for (let i = 0; i < 10; i++){
    const r = 0.8 + R() * 1.8;
    picture(K.deco(new THREE.CircleGeometry(r, 12), stone, (R() - 0.5) * 56, 0.015, (R() - 0.5) * 56, -Math.PI / 2)).receiveShadow = false;
  }
}
