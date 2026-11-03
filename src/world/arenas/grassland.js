// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Battle map: the Grass Sea of Lothal, a wide open plain between an allied landing field and an Imperial outpost.

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones, shared, solids, pillars } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';
import { fieldKit, coverSpots, strike } from './field.js';

/* THE GRASS SEA (150 across, half 75). A big open battle from one end to the other, built for squads:
     · the LANDING FIELD in the north (z +48…+68): the allied pad with a gunship on it, supply crates, two flak guns and
       a staggered SANDBAG LINE round z +40 (short runs at different depths, a couple of them hooked back into an L),
       the middle lane open. The hero and the squads start here;
     · the GRASS (z −30…+30): broken stone RIDGES that wind and step across the plain in three loose bands instead of
       straight rows, every block under the single jump apex so it can be vaulted; clusters of rock SPIRES round a few
       tall ones, and two giants in the far corners, for wall-kicks, sightline breaks and scale; low grassy SWELLS; a
       DOWNED WALKER west of centre whose hull is the high ground of the whole field (crate, leg stump, hull); three
       scorched CRATERS where the outpost's mortars land (amber warning, then the blast); patches of tall grass that
       ripple in the wind (world/grass.js, from the world's `grass`);
     · the IMPERIAL OUTPOST in the south (z −42…−68): a perimeter wall with three gates, a command bunker you can
       climb, a comms mast and an overwatch gantry, fuel drums by the gates, a shot-down fighter by its west wall.
   Every gap between solids is at least 3 m, so a brute walks through anywhere a trooper can. */

/* a winding ridge as a RUN of blocks: each one starts where the last ended (a hand's overlap, so they join) and may
   step a full block north or south (dz ±1.1: faces touch, no pocket between them). segs: [half-length, height, dz] */
function run(x, z, segs){
  const out = [];
  for (const [hl, h, dz] of segs){ z += dz; out.push([+(x + hl).toFixed(2), +z.toFixed(2), hl, h, 1]); x += hl*2 - 0.3; }
  return out;
}
const PLAN = {
  // cover walls: [x, z, half-length, height, alongX]
  bags: [   // the allied sandbag line round z +40: staggered runs, two hooked back into an L, the middle lane open
    [-48, 41, 4, 1.15, 1], [-38, 38.5, 3, 1.15, 1], [-35.4, 40, 1.5, 1.15, 0], [-24, 41.5, 4.5, 1.15, 1], [-13, 39, 3, 1.15, 1],
    [11, 38.5, 3.5, 1.15, 1], [14.9, 39.8, 1.3, 1.15, 0], [25, 42, 4, 1.15, 1], [37, 39.5, 3, 1.15, 1], [48, 41, 4.5, 1.15, 1],
  ],
  ridges: [   // broken stone ridges winding across the grass: runs of blocks of different lengths and heights
    ...run(-58, 22, [[2.5, 1.4, 0], [2, 1.7, -1.1], [1.6, 1.3, -1.1]]),
    ...run(-36, 17, [[3, 1.55, 0], [1.5, 1.8, 1.1]]),
    ...run(-12, 21, [[2, 1.5, 0], [2.5, 1.75, -1.1], [1.5, 1.35, 0]]),
    ...run(12, 17, [[2.5, 1.6, 0], [2, 1.4, 1.1]]),
    ...run(38, 22, [[1.5, 1.5, 0], [2.5, 1.65, -1.1], [1.3, 1.3, -1.1]]),
    ...run(-39, -1, [[2, 1.6, 0], [1.5, 1.3, 1.1]]),
    ...run(20, -3, [[1.5, 1.5, 0], [2, 1.7, 1.1], [1.5, 1.35, 1.1]]),
    [44, 1, 3, 1.55, 1], [-56, -6, 3, 1.55, 0],
    ...run(-47, -19, [[2, 1.5, 0], [2, 1.75, -1.1]]),
    ...run(-18, -21, [[1.5, 1.4, 0], [2.5, 1.65, 1.1], [1, 1.3, 0]]),
    ...run(4, -17, [[2, 1.55, 0], [1.2, 1.3, -1.1]]),
    ...run(30, -19, [[1.5, 1.6, 0], [2, 1.8, -1.1], [1.5, 1.4, -1.1]]),
    ...run(53, -25, [[2, 1.5, 0]]),
  ],
  outpost: [   // the outpost's perimeter (2.6 tall: hard cover, double jump or fly to get on it)
    [-34, -42, 10, 2.6, 1], [-11, -42, 5, 2.6, 1], [11, -42, 5, 2.6, 1], [34, -42, 10, 2.6, 1],
    [-44, -49.5, 7.05, 2.6, 0], [44, -49.5, 7.05, 2.6, 0], [-44, -66, 3, 2.6, 0], [44, -66, 3, 2.6, 0],
  ],
  barricades: [   // inside the outpost: metal barricades behind the gates
    [0, -48, 3, 1.55, 1], [-20, -52, 2.5, 1.55, 1], [20, -52, 2.5, 1.55, 1],
  ],
  // rock spires [x, z, r, h]: clusters round a tall one, so no two look alike from the same spot
  spires: [[30, 10, 2.4, 16], [35, 14, 1.3, 8.5], [26.5, 14.5, 0.9, 5.5],
           [-40, 7, 2.8, 19], [-46, 11.5, 1.3, 7.5], [-45.5, 3, 0.9, 5],
           [22, -32, 1.8, 11], [-24, 30, 1.6, 10], [-28.5, 32, 0.9, 5.5], [52, -8, 2.0, 13], [56.5, -4.5, 1.1, 7],
           [-60, 26, 2.2, 14], [-65, 22, 1.2, 8], [62, 34, 1.8, 11], [-62, -32, 2.4, 15], [-57.5, -36.5, 1.2, 7]],
  // the GIANTS: a few huge needles at the field's edges that tower over everything (and give the Jedi a long wall-run)
  giants: [[-64, 47, 6.5, 64], [63, -47, 6, 56], [67, 9, 4, 38]],
  // the TITANS just past the edge (out of reach, so the field reads as one small corner of something vast)
  titans: [[-30, 92, 9, 96], [-96, -20, 11, 120], [88, 52, 8, 84], [40, -100, 10, 104], [104, -64, 7, 70]],
  rocks: [[8, 12, 1.4, 1.8], [-50, 4, 1.6, 2.2], [54, 30, 1.5, 1.9], [6, -32, 1.3, 1.7], [-25, 3, 1.2, 1.6], [40, -32, 1.5, 2.0],
          [-30, -32, 1.4, 1.8], [64, -2, 1.3, 1.6], [-64, 8, 1.6, 2.1], [-8, 30, 1.1, 1.4], [30, 30, 1.2, 1.5],
          [4, -9, 1.2, 1.5], [7, -11.5, 0.8, 1.0], [48, -14, 1.4, 1.8], [-60, -14, 1.5, 1.9], [-61.5, -17.5, 0.9, 1.1]],
  // low grassy SWELLS you walk straight over [x, z, half-x, half-z]
  swells: [[-22, 22, 6, 4], [24, 26, 7, 4.5], [-2, -30, 6, 3.5], [44, 12, 5, 4], [-50, -26, 5.5, 4]],
  walker: [-10, 4],        // the downed walker's hull centre (it lies along x)
  craters: [[14, 8, 3.6], [-24, 12, 3.6], [32, -10, 3.6]],
};

export const GRASSLAND_SPOTS = {
  allyStart: [0, 50, Math.PI],                                     // the landing field, facing the grass
  enemyStart: [[0, -66], [-30, -56], [30, -56], [-58, -30], [58, -30]],
  // the line the fight moves along, from the allied line to the outpost
  fronts: [[0, 40], [-4, 20], [0, -2], [0, -20], [0, -42], [0, -56]],
  points: { ridge: [-6, 23], walker: [-10, 10], crossroads: [20, -6], gate: [0, -39], bunker: [0, -51] },
  cover: coverSpots([...PLAN.bags, ...PLAN.ridges, ...PLAN.outpost], 1),
  enemyCover: coverSpots([...PLAN.ridges, ...PLAN.barricades, ...PLAN.bags], -1),
  craters: PLAN.craters.map(([x, z]) => [x, z]),
};

export function buildGrasslandArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x8a7e66 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x665c4a });
  const bag    = new THREE.MeshStandardMaterial({ color: pal.bag ?? 0x9a8a62 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x6a727e });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x7a6a52 });
  const scorch = new THREE.MeshBasicMaterial({ color: pal.scorch ?? 0x3a3428, transparent: true, opacity: 0.75, depthWrite: false });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const red    = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  const K = arenaKit(), R = seeded(71), F = fieldKit(K, R);

  // ---- the LANDING FIELD — the allied pad (walkable) with a gunship on it, supply crates, flak guns, the sandbag line ----
  K.box(0, 58, 10, 7, 0.24, metal, { climbable: true });
  for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.4, 0.04, 13.4), stripe, sx*9.5, 0.25, 58);
  for (const sx of [-1, 1]) for (const dz of [-6, 0, 6]) K.deco(new THREE.SphereGeometry(0.18, 8, 6), lamp, sx*9.2, 0.36, 58 + dz);
  gunship(K, 0, 59.5, { hull: pal.ship ?? 0xb8b4a8, dark: metal, mark: pal.shipMark ?? 0xa04a2a, glow: lamp, glass: pal.glass ?? 0x2a3440 });
  for (const [x, z, f] of [[-16, 52, 1], [16, 54, -1], [-28, 60, 1], [28, 60, -1], [-6, 46, -1], [38, 50, 1]]) F.crates(x, z, crate, stoneD, f);
  for (const w of PLAN.bags) F.wall(w, { body: bag, cap: bag }, { bags: true });
  for (const [x, z, ry] of [[-20, 48, 0.5], [20, 48, -0.4]]) flak(K, x, z, ry, { bag, gun: imp, metal });
  // a comms mast by the pad
  K.column(-14, 64, 0.35, 9, metal, { wallKick: false, seg: 6, taper: 0.5 });
  K.deco(new THREE.SphereGeometry(0.22, 8, 6), lamp, -14, 9.4, 64);
  // the fighter that didn't make it back: nose down short of the pad, burnt grass round it
  wreck(K, -38, 52, { hull: pal.ship ?? 0xb8b4a8, dark: stoneD, mark: pal.shipMark ?? 0xa04a2a });
  F.crater(-38, 52, 5, scorch);

  // ---- the GRASS — winding ridges, spire clusters and the giants, boulders, swells ----
  const turf = new THREE.MeshStandardMaterial({ color: pal.turf ?? L.floor ?? 0x7e8448 });
  // how far out along heading a a thing of radius r must stand to clear the square play space (plus a margin)
  const outside = (a, r, m) => (75 + r + m) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
  for (const w of PLAN.ridges) F.wall(w, { body: stone, cap: stoneD }, { jag: true });
  PLAN.spires.forEach(([x, z, r, h], i) => F.spire(x, z, r, h, i % 3 === 1 ? stoneD : stone, i % 3 === 1 ? stone : stoneD));
  for (const [x, z, r, h] of PLAN.giants) giant(K, F, R, x, z, r, h, stone, stoneD);
  for (const [x, z, r, h] of PLAN.titans) giant(K, F, R, x, z, r, h, stoneD, stone);
  // and the MESAS on the skyline: flat-topped bluffs a hundred metres and more past the edge, the plain's far wall
  for (let i = 0; i < 9; i++){
    const a = (i / 9) * Math.PI * 2 + 0.3 + (R() - 0.5) * 0.4, r = 12 + R() * 14, h = 30 + R() * 34;
    const d = Math.max(135 + R() * 40, outside(a, r * 1.9, 4)), x = Math.cos(a) * d, z = Math.sin(a) * d;
    // two stacked, twisted tiers and a broken cap: a butte worn by the wind, not a drum
    K.deco(new THREE.CylinderGeometry(r * 0.7, r, h * 0.62, 7), stoneD, x, h * 0.31 - 0.5, z, 0, R() * 3, 0);
    K.deco(new THREE.CylinderGeometry(r * 0.5, r * 0.66, h * 0.4, 6), i % 2 ? stone : stoneD, x + r * 0.08, h * 0.8 - 0.5, z - r * 0.06, 0, R() * 3, 0);
    K.deco(new THREE.DodecahedronGeometry(1, 0), stone, x + r * 0.1, h - 0.5, z, R(), R() * 3, R()).scale.set(r * 0.5, h * 0.06, r * 0.45);
    K.deco(new THREE.CylinderGeometry(r * 1.5, r * 1.9, h * 0.22, 9), turf, x, h * 0.11 - 0.5, z, 0, R() * 3, 0);        // a grassy talus
  }
  for (const [x, z, r, h] of PLAN.rocks) F.rock(x, z, r, h, stoneD, stone);
  for (const [x, z, hx, hz] of PLAN.swells) F.drift(x, z, hx, hz, turf);
  // ROLLING HILLS past the playable edge, so the plain swells away to the horizon instead of ending at a line
  const hills = [];
  for (let i = 0; i < 26; i++){
    const a = (i / 26) * Math.PI * 2 + (R() - 0.5) * 0.18, rx = 14 + R() * 12, rz = 9 + R() * 7, h = 3 + R() * 9;
    const d = outside(a, Math.max(rx, rz) + 2, 6 + R() * 16), x = Math.cos(a) * d, z = Math.sin(a) * d;
    const m = K.deco(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI*2, 0, Math.PI/2), turf, x, -0.05, z, 0, -a + Math.PI/2, 0);
    m.scale.set(rx, h, rz); m.castShadow = false;
    hills.push({ x, z, rx: Math.max(rx, rz), rz: Math.max(rx, rz), h, a, sx: rx, sz: rz });
  }
  // the grass rides up onto the swells and the hills (world/grass.js), and stays off the pad and the outpost's yard
  shared.grassMounds = [...PLAN.swells.map(([x, z, hx, hz]) => ({ x, z, rx: hx*1.15, rz: hz*1.15, h: 0.46 })),
    ...hills.map(m => ({ x: m.x, z: m.z, rx: Math.abs(Math.cos(m.a)) * m.sz + Math.abs(Math.sin(m.a)) * m.sx, rz: Math.abs(Math.sin(m.a)) * m.sz + Math.abs(Math.cos(m.a)) * m.sx, h: m.h }))];
  shared.grassClear = [[-11, 50, 11, 66], [-44, -66, 44, -42.5]];

  // ---- the DOWNED WALKER — the high ground of the field ----
  F.walkerHulk(PLAN.walker[0], PLAN.walker[1], true, { hull: metal, dark: imp, plate: metal, crate, glow: red });

  // ---- the CRATERS and the mortar strikes that keep landing on them (staggered, so they never fire together) ----
  PLAN.craters.forEach(([x, z, r], i) => {
    F.crater(x, z, r + 0.6, scorch);
    hazardZones.push(strike(x, z, r, i * 3.7, pal.blast ?? 0xff7a30));
  });

  // ---- the IMPERIAL OUTPOST ----
  for (const w of PLAN.outpost) F.wall(w, { body: imp, cap: stripe }, { buttress: true });
  for (const w of PLAN.barricades) F.wall(w, { body: metal, cap: stripe });
  // the command bunker: climbs crate (1.1) → step (2.2) → roof (3.4)
  K.box(0, -57, 6, 4, 3.4, imp);
  K.deco(new THREE.BoxGeometry(12.2, 0.2, 8.2), stripe, 0, 3.45, -57);
  K.deco(new THREE.PlaneGeometry(3, 1.2), lamp, 0, 2.1, -52.98);
  K.box(7.2, -54.6, 1.2, 1.2, 2.2, metal); K.box(9.2, -53.6, 0.8, 0.8, 1.1, crate);
  // the comms mast and its dish
  K.column(16, -60, 0.7, 12, imp, { wallKick: false, seg: 6, taper: 0.5 });
  K.box(16, -60, 1.4, 1.4, 0.6, imp);
  K.deco(new THREE.CylinderGeometry(2.2, 0.4, 0.8, 12, 1, true), metal, 16, 11.4, -59.4, 0.9, 0, 0);
  K.deco(new THREE.SphereGeometry(0.24, 8, 6), red, 16, 12.6, -60);
  // the overwatch gantry, west of the bunker
  K.gantry(-24, -60, { a: imp, b: metal, strut: imp, beacon: pal.beacon ?? 0xff5040 }, [1, 1]);
  // fuel drums by the gates and on the walker's approach
  for (const [x, z] of [[-8, -45], [8, -45], [-28, -46], [30, -46], [-21, 0], [-26, -7]]) spawnBarrel(V3(x, 0, z));
  // a TIE fighter the flak brought down, smashed against the ground by the west wall
  tieWreck(K, -55, -47, { hull: pal.tie ?? 0x6a7078, panel: pal.tiePanel ?? 0x2a2d34, glow: red });
  F.crater(-55, -47, 5.5, scorch);
  // the outpost has been under fire for a while: scorch marks along its north face and across the approach
  for (const [x, z, r] of [[-24, -38, 2.4], [6, -37, 2], [27, -38.5, 2.6], [-6, -26, 2.2], [40, -26, 2], [-36, -12, 2.4], [12, 30, 2]]) F.crater(x, z, r, scorch);
}

/* the allied GUNSHIP parked on the pad, nose to the grass: a solid hull you can climb from the crates (2.6 to its
   back), stub wings overhead as slabs you walk under and land on, engine pods glowing at the tail */
function gunship(K, x, z, c){
  const hull = new THREE.MeshStandardMaterial({ color: c.hull }), mark = new THREE.MeshStandardMaterial({ color: c.mark });
  const glass = new THREE.MeshStandardMaterial({ color: c.glass, metalness: 0.4, roughness: 0.3 });
  K.box(x, z, 2.2, 4.6, 2.4, hull, { y: 0.24 });                                   // the troop bay
  K.box(x, z - 5.6, 1.6, 1.0, 1.7, hull, { y: 0.24 });                             // the cockpit, a step lower
  K.deco(new THREE.BoxGeometry(2.6, 0.7, 1.6), glass, x, 1.75, z - 5.5, 0.35, 0, 0);
  K.deco(new THREE.BoxGeometry(4.5, 0.25, 9.4), mark, x, 2.7, z);                  // the spine stripe
  K.deco(new THREE.BoxGeometry(1.4, 1.6, 0.25), c.dark, x, 3.4, z + 3.8);          // the tail fin
  for (const s of [-1, 1]){
    // the stub wings: a slab from 2.0 up to 2.4, so the body walks under and stands on top
    K.deco(new THREE.BoxGeometry(5.2, 0.4, 3.2), hull, x + s*4.8, 2.5, z + 0.6);
    K.slab(x + s*4.8, z + 0.6, 2.6, 1.6, 2.3, 2.7);
    K.deco(new THREE.BoxGeometry(1.2, 0.3, 3.3), mark, x + s*6.6, 2.72, z + 0.6);
    // the engine pod under each wing tip, its glow facing aft, and a landing strut
    K.deco(new THREE.CylinderGeometry(0.55, 0.55, 3.6, 10), c.dark, x + s*5.6, 1.5, z + 1.2, Math.PI/2, 0, 0);
    solids.push({ x: x + s*5.6, z: z + 1.2, hx: 0.6, hz: 1.85, h: 2.05, box: true });   // (pod and its pylon, down to the deck)
    K.deco(new THREE.CircleGeometry(0.42, 10), c.glow, x + s*5.6, 1.5, z + 3.02, 0, 0, 0);
    K.deco(new THREE.CylinderGeometry(0.12, 0.16, 1.0, 6), c.dark, x + s*2.6, 0.74, z - 3);
  }
  // the ramp down at the tail: a low step, then the bay floor
  K.box(x, z + 5.4, 1.6, 0.8, 0.5, c.dark, { y: 0.24, climbable: true });
}

/* a FLAK GUN in a ring of sandbags: round cover (1.1, vaulted), the twin barrels cocked at the sky */
function flak(K, x, z, ry, m){
  K.column(x, z, 2.1, 1.1, m.bag, { wallKick: false, seg: 12, taper: 1 });
  for (let i = 0; i < 12; i++){
    const a = (i / 12) * Math.PI * 2;
    K.deco(new THREE.CapsuleGeometry(0.28, 0.5, 2, 6), m.bag, x + Math.cos(a)*1.85, 1.22, z + Math.sin(a)*1.85, 0, -a, Math.PI/2);
  }
  K.deco(new THREE.CylinderGeometry(0.55, 0.7, 0.6, 8), m.gun, x, 1.4, z);
  solids.push({ x, z, r: 0.95, h: 2.3 });   // the gun mount stands up out of the ring
  const g = new THREE.Group(); g.position.set(x, 1.9, z); g.rotation.y = ry; shared.arenaGroup.add(g);
  const part = (geo, mat, px, py, pz, rx = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.rotation.x = rx; o.castShadow = true; g.add(o); };
  part(new THREE.BoxGeometry(1.2, 0.7, 1.1), m.gun, 0, 0, 0);
  for (const s of [-0.28, 0.28]) part(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 6), m.metal, s, 0.95, -0.7, -0.75);
}

/* a crashed allied FIGHTER: the fuselage dug in nose first, one wing torn off and lying in the grass */
function wreck(K, x, z, c){
  const hull = new THREE.MeshStandardMaterial({ color: c.hull }), mark = new THREE.MeshStandardMaterial({ color: c.mark });
  K.deco(new THREE.BoxGeometry(1.6, 1.4, 9), hull, x, 1.1, z, 0.14, 0.4, 0.2);
  solids.push({ x, z, hx: 2.5, hz: 4.9, h: 2.1, box: true });   // (its collision, under the tilted hull)
  K.deco(new THREE.ConeGeometry(0.8, 3, 4), hull, x - 1.8, 0.4, z - 4.6, -1.3, 0.4, 0);
  K.deco(new THREE.BoxGeometry(5.5, 0.22, 2.4), mark, x + 3.4, 1.2, z + 1.4, 0.1, 0.4, -0.5);   // the wing still on
  solids.push({ x: x + 3.4, z: z + 1.4, hx: 3, hz: 1.9, h: 2.4, box: true });
  K.box(x - 4.8, z + 3.6, 2.4, 1.0, 0.45, mark, { climbable: true });                          // the torn-off wing
}

/* a downed TIE fighter: the ball cockpit half buried, one hex panel standing in the dirt, the other flat */
function tieWreck(K, x, z, c){
  const hull = new THREE.MeshStandardMaterial({ color: c.hull }), panel = new THREE.MeshStandardMaterial({ color: c.panel });
  solids.push({ x, z, r: 1.7, h: 2.6 });
  K.deco(new THREE.IcosahedronGeometry(1.8, 1), hull, x, 1.1, z, 0.4, 0.3, 0.2);
  K.deco(new THREE.CircleGeometry(0.7, 8), c.glow, x + 0.6, 1.4, z + 1.7, -0.3, 0.3, 0);
  K.deco(new THREE.CylinderGeometry(4, 4, 0.3, 6), panel, x + 3.6, 3.2, z - 0.4, 0, 0, Math.PI/2 - 0.25);
  solids.push({ x: x + 3.6, z: z - 0.4, hx: 1.2, hz: 3.6, h: 7.2, box: true });
  K.box(x - 4.6, z + 1.2, 3.4, 3.4, 0.3, panel, { climbable: true });
}

/* a GIANT spire: a huge needle that narrows in weathered steps (each a little off the last, so it never reads as a
   built tower), slabs of rock jutting from its flanks high overhead, a broken crown and fallen boulders at its foot */
function giant(K, F, R, x, z, r, h, mat, mat2){
  K.column(x, z, r, h * 0.36, mat, { taper: 0.86, seg: 7 });                   // the foot: the collision column
  pillarsTop(x, z, r, h);
  let y = h * 0.36, rad = r * 0.86;
  for (const [t, k] of [[0.62, 0.66], [0.84, 0.5], [1.0, 0.36]]){           // the upper steps, stacked and twisted
    const top = h * t, ox = (R() - 0.5) * rad * 0.16, oz = (R() - 0.5) * rad * 0.16;
    K.deco(new THREE.CylinderGeometry(r * k, rad * 0.97, top - y, 6 + Math.floor(R() * 2)), R() < 0.5 ? mat : mat2, x + ox, (y + top) / 2, z + oz, 0, R() * 3, 0);
    y = top; rad = r * k;
  }
  // jutting slabs high on the flanks (well over anyone's head: they're the rock's shape, not a perch)
  for (let i = 0; i < 4; i++){
    const a = R() * Math.PI * 2, t = 0.5 + R() * 0.4, rr = r * (1 - 0.64 * t);
    const c = K.deco(new THREE.DodecahedronGeometry(1, 0), mat2, x + Math.cos(a) * rr * 0.85, h * t, z + Math.sin(a) * rr * 0.85, R(), R() * 3, R());
    c.scale.set(rr * 0.7, h * 0.06, rr * 0.55);
  }
  K.deco(new THREE.ConeGeometry(r*0.34, h*0.1, 6), mat2, x + r*0.05, h + h*0.04, z, 0.1, R()*3, -0.07);
  for (let i = 0; i < 4; i++){
    const a = R() * Math.PI * 2, d = r * (1.35 + R()*0.35);
    const rr = 0.9 + R()*0.9, rh = 1.1 + R()*1.2, px = x + Math.cos(a)*d, pz = z + Math.sin(a)*d;
    F.rock(px, pz, rr, rh, mat2, mat);
    solids.push({ x: px, z: pz, r: rr*1.1, h: rh*1.12 });   // (a fallen block's tumbled shard stands proud of the plain rock's top)
  }
}

/* the giant's collision above its foot: one column to the crown (so the steps are solid and the Jedi can wall-run it) */
function pillarsTop(x, z, r, h){
  solids.push({ x, z, r: r * 0.86, h: h * 1.04 });
  pillars.push({ x, z, r: r * 0.86, h: h * 1.04 });
}
