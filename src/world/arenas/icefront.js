// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Battle map: the Ice Front on Hoth, two allied trench lines in front of the shield generator, walkers coming in.

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones, solids } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';
import { fieldKit, coverSpots, strike, trenchRows } from './field.js';

/* THE ICE FRONT (140 across, half 70). A trench defence in a snowfield, built for squads holding a line:
     · the ALLIED BASE in the north (z +41…+70) stands on a RISE climbed in three terraces (top 1.35): the SHIELD
       GENERATOR (the thing being defended), an ion cannon and the hangar's blast wall, looking down over the field;
     · TWO WINDING TRENCH LINES of packed-snow berms topped with sandbags, the rear one around z +32 and the forward one
       around z +10. Each zig-zags through traverses (trenchRows), so it reads as a dug line, not a row of blocks, and
       the gaps never line up: an attack that breaks through one gap meets a berm, not a free run to the generator.
       Berms are 1.3 tall (vault them, fight over them). A low snow knoll on each flank between the lines;
     · a GLACIER towers over it all past the edge, 34–52 m behind the base and 20–38 m down the north half of both
       flanks: on Hoth the player should feel small (straight up, not only across);
     · NO-MAN'S LAND (z −8…−44): ICE RIDGES on both flanks you can climb (terraces to 1.35, rock teeth and tall
       wall-kick seracs on the crest)
       and a low one across the middle, boulders and drifts, two wrecked snowspeeders, a toppled turret, a downed
       walker (climb it: crate, stump, hull), and three craters the walkers' cannons keep landing on;
     · the IMPERIAL FORWARD LINE in the south (z −48…−66): metal barricades, a drop-ship pad, an overwatch gantry.
   Past the edge, the war goes on without you (world/warfront.js): AT-ATs stride in from the south and shell the
   craters, soldier lines trade fire on both flanks, speeders scream low overhead. */
const PLAN = {
  rear: trenchRows([[-66, 30], [-48, 30], null, [-40, 34], [-24, 34], [-24, 30], [-7, 30], null,
                    [7, 30], [24, 30], [24, 34], [40, 34], null, [48, 30], [66, 30]], 1.3),
  forward: trenchRows([[-66, 18], [-58, 18], [-58, 12], [-44, 12], null, [-36, 8], [-24, 8], [-24, 11], [-11, 11], null,
                       [-5, 10], [5, 10], null, [11, 11], [24, 11], [24, 8], [36, 8], null, [44, 12], [58, 12], [58, 18], [66, 18]], 1.3),
  imperial: [[-36, -50, 5, 1.55, 1], [-14, -50, 5, 1.55, 1], [14, -50, 5, 1.55, 1], [36, -50, 5, 1.55, 1]],
  // ridges: [x, z, half-length, half-width, tiers, alongX, rock teeth, ice seracs]
  ridges: [[-50, -26, 13, 3, 3, 0, 2, 2], [52, -22, 11, 3, 3, 0, 2, 2], [-8, -36, 10, 2.4, 2, 1, 2, 0],
           [-40, 22, 6, 2.4, 2, 1, 1, 0], [40, 22, 6, 2.4, 2, 1, 1, 0]],
  // the GLACIER walls past the edge, towering over the base and the north half of both flanks: [x0, z0, x1, z1, hMin, hMax]
  glaciers: [[-96, 80, 96, 80, 34, 52], [-82, 72, -80, 6, 20, 38], [82, 72, 80, 6, 20, 38]],
  rise: { x0: -64, x1: 64, z0: 41, z1: 70, tiers: 3 },   // the base's hill (each terrace 0.45: tops 0.45, 0.9, 1.35)
  rocks: [[-20, -8, 1.8, 2.4], [6, -16, 1.6, 2.0], [-62, -6, 2.0, 2.8], [36, -44, 1.6, 2.2], [-28, -46, 1.5, 2.0],
          [62, -40, 1.8, 2.4], [12, -30, 1.3, 1.8], [-60, 44, 2.4, 3.4, 0.45], [62, 50, 2.6, 3.6, 0.45]],   // (the last two on the base's first terrace)
  drifts: [[-38, -10, 3, 2], [6, -26, 3.5, 2], [30, -40, 3, 2.2], [52, 0, 2.5, 2], [-8, 20, 2.5, 1.6], [-22, -44, 2.5, 1.8]],
  walker: [22, -20],     // the downed walker's hull centre (it lies along z, head to the north)
  speeders: [[-12, -2, 0], [-28, -22, 1]],   // wrecked snowspeeders: [x, z, nose-down]
  turret: [42, -6],      // a toppled turret: the stump and the barrel lying in the snow
  craters: [[-4, -4, 3.6], [32, 0, 3.6], [-30, -2, 3.6]],
};

export const ICEFRONT_SPOTS = {
  allyStart: [0, 44, Math.PI],                                     // on the base's first terrace, facing the field
  enemyStart: [[0, -60], [-32, -58], [42, -58], [-58, -48], [58, -48]],
  fronts: [[0, 32], [0, 10], [-12, -6], [0, -24], [0, -50], [0, -60]],
  points: { generator: [0, 49], rearTrench: [0, 35], forwardTrench: [0, 13], walker: [17, -20], pad: [0, -60] },
  cover: coverSpots([...PLAN.rear, ...PLAN.forward], 1),
  enemyCover: coverSpots([...PLAN.imperial, ...PLAN.forward, ...PLAN.rear], -1),
  craters: PLAN.craters.map(([x, z]) => [x, z]),
};

export function buildIcefrontArena(L){
  const pal = L.pal || {};
  const snow   = new THREE.MeshStandardMaterial({ color: pal.snow ?? 0x9aa8ba });
  const snowD  = new THREE.MeshStandardMaterial({ color: pal.snowD ?? 0x76859a });   // packed berms, a shade under the floor so they read
  const bag    = new THREE.MeshStandardMaterial({ color: pal.bag ?? 0x8a7a5e });
  const ice    = new THREE.MeshStandardMaterial({ color: pal.ice ?? 0x7e96b0 });
  const rock   = new THREE.MeshStandardMaterial({ color: pal.rock ?? 0x5a6474 });
  const plank  = new THREE.MeshStandardMaterial({ color: pal.plank ?? 0x6a5a48 });
  const metal  = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x8a929c });
  const metalD = new THREE.MeshStandardMaterial({ color: pal.metalD ?? 0x4a525c });
  const imp    = new THREE.MeshStandardMaterial({ color: pal.imperial ?? 0x3a3e46 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xd9a43a });
  const scorch = new THREE.MeshBasicMaterial({ color: pal.scorch ?? 0x3a4252, transparent: true, opacity: 0.7, depthWrite: false });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffc070 });
  const shield = new THREE.MeshBasicMaterial({ color: pal.shield ?? 0x7ad8ff });
  const red    = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  const K = arenaKit(), R = seeded(83), F = fieldKit(K, R);

  // ---- the RISE the base stands on, then the ALLIED BASE — shield generator, ion cannon, the hangar's blast wall ----
  const P = PLAN.rise, Y = F.rise(P.x0, P.x1, P.z0, P.z1, P.tiers, { body: snowD, cap: snow }, { inset: 4 });
  K.column(0, 56, 3.2, 6.5 + Y, metalD, { wallKick: false, seg: 12, taper: 0.8 });
  K.box(0, 56, 4.4, 4.4, 1.2, metal, { y: Y });
  K.deco(new THREE.SphereGeometry(3.0, 14, 8, 0, Math.PI*2, 0, Math.PI/2), metal, 0, 6.5 + Y, 56);
  K.deco(new THREE.CylinderGeometry(0.35, 0.5, 4, 8), metalD, 0, 10.5 + Y, 56);
  K.deco(new THREE.SphereGeometry(0.7, 10, 8), shield, 0, 12.8 + Y, 56);
  // the dome stands on the drum: it collides as stepped rings up to the mast and the globe on top
  for (const [r, h] of [[2.95, 7.2], [2.6, 8.0], [2.0, 8.7], [1.2, 9.25], [0.7, 13.5]]) solids.push({ x: 0, z: 56, r, h: h + Y });
  for (let i = 0; i < 6; i++) K.deco(new THREE.BoxGeometry(0.3, 1.1, 0.12), shield, Math.cos(i*1.05)*3.25, 3.8 + Y, 56 + Math.sin(i*1.05)*3.25, 0, -i*1.05 + Math.PI/2, 0);
  // the ion cannon (west): a ball turret on a squat drum
  K.column(-32, 58, 2.6, 4 + Y, metalD, { wallKick: false, seg: 10, taper: 0.9 });
  K.deco(new THREE.SphereGeometry(3.4, 14, 10), metal, -32, 6.2 + Y, 58);
  K.deco(new THREE.CylinderGeometry(0.5, 0.6, 5, 8), metalD, -32, 7.6 + Y, 54.6, Math.PI/2 - 0.5, 0, 0);
  for (const [r, h] of [[3.3, 7.0], [3.0, 7.8], [2.4, 8.6], [1.6, 9.2], [0.8, 9.5]]) solids.push({ x: -32, z: 58, r, h: h + Y });   // the ball turret, in rings
  solids.push({ x: -32, z: 54.2, hx: 0.6, hz: 1.9, y0: 6.3 + Y, h: 8.8 + Y, box: true });                   // the barrel, overhead
  // the hangar blast wall along the back, with a lit door slot and two supply stacks on the middle terrace
  K.box(26, 64, 14, 1.2, 4.6 + Y, rock);
  K.deco(new THREE.PlaneGeometry(10, 2.6), lamp, 26, 1.4 + Y, 62.78, 0, Math.PI, 0);
  for (const [x, z, f] of [[14, 52, 1], [40, 52, -1]]) F.crates(x, z, plank, metalD, f, Y * 2 / 3);

  // ---- the TRENCH LINES — packed-snow berms topped with sandbags ----
  for (const w of [...PLAN.rear, ...PLAN.forward]) F.wall(w, { body: snowD, cap: bag }, { bags: true });
  // turret emplacements on the rear line
  for (const x of [-32, 32]){ K.box(x, 34, 0.7, 0.6, 0.8, metalD, { y: 1.3 }); K.deco(new THREE.CylinderGeometry(0.12, 0.12, 2, 6), metalD, x, 1.9, 33, Math.PI/2, 0, 0); solids.push({ x, z: 33, hx: 0.15, hz: 1.0, h: 2.05, box: true }); }   // the gun barrel
  // the snow knolls on the flanks between the lines
  for (const [x, z, hl, hw, n, ax, t] of PLAN.ridges.slice(3)) F.ridge(x, z, hl, hw, n, { body: snowD, cap: snow, rock, rock2: ice }, { ax, teeth: t });
  // the glacier the base is dug in under, and its arms down both flanks: the scale of the place, straight up
  const glac = { body: new THREE.MeshStandardMaterial({ color: pal.glacier ?? 0x8aa2bc }), body2: new THREE.MeshStandardMaterial({ color: pal.glacierD ?? 0x7690ae }),
                 cap: new THREE.MeshStandardMaterial({ color: pal.glacierCap ?? 0xc2cedc }) };
  for (const [x0, z0, x1, z1, h0, h1] of PLAN.glaciers) F.glacier(x0, z0, x1, z1, [h0, h1], glac);

  // ---- NO-MAN'S LAND ----
  for (const [x, z, hl, hw, n, ax, t, sr] of PLAN.ridges.slice(0, 3)) F.ridge(x, z, hl, hw, n, { body: ice, cap: snow, rock, rock2: ice, serac: glac.body }, { ax, teeth: t, seracs: sr });
  for (const [x, z, r, h, y0] of PLAN.rocks) F.rock(x, z, r, h, rock, ice, y0);
  for (const [x, z, hx, hz] of PLAN.drifts) F.drift(x, z, hx, hz, snow);
  // the wrecked snowspeeders: a low hull you vault, stubby wings and a gun pod (one of them nose-down, a skid behind it)
  for (const [x, z, nose] of PLAN.speeders){
    const hull = K.box(x, z, 1.4, 2.6, 1.2, metal);
    if (nose){ hull.rotation.x = -0.22; solids[solids.length - 1].h = 1.8;   // its tail rides up: stand on it, not in it
      K.deco(new THREE.PlaneGeometry(2.4, 9), scorch, x, 0.03, z + 7, -Math.PI/2, 0, 0); }
    K.deco(new THREE.BoxGeometry(4.6, 0.22, 1.6), metal, x, 0.9, z + 0.6, 0, 0, nose ? -0.3 : 0.12);
    solids.push({ x, z: z + 0.6, hx: 2.3, hz: 0.8, h: 1.25, box: true });   // the stubby wings stick out past the hull
    K.deco(new THREE.BoxGeometry(1.0, 0.5, 0.8), stripe, x, 1.35, z - 1.6);
    K.deco(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 6), metalD, x - 1.2, 0.5, z - 2.4, Math.PI/2, 0, 0);
  }
  // the toppled turret: a gutted stump and its long barrel lying in the snow (step over it)
  { const [x, z] = PLAN.turret;
    K.column(x, z, 1.5, 1.7, metalD, { taper: 0.95, seg: 10 });
    K.deco(new THREE.SphereGeometry(1.3, 10, 6, 0, Math.PI*2, 0, Math.PI/2), metal, x, 1.7, z, 0.5, 0, 0.4);
    solids.push({ x, z, r: 1.2, h: 2.9 });   // the knocked-askew dome on top
    K.rubble(x + 4.4, z - 0.4, 5.2, 0.38, metal, true);
    F.crater(x + 1, z + 1, 3.2, scorch); }
  F.walkerHulk(PLAN.walker[0], PLAN.walker[1], false, { hull: metal, dark: metalD, plate: metal, crate: imp, glow: red });
  PLAN.craters.forEach(([x, z, r], i) => {
    F.crater(x, z, r + 0.6, scorch);
    hazardZones.push(strike(x, z, r, 2 + i * 3.6, pal.blast ?? 0xff7a40, { period: 12, walker: true }));   // the walkers' cannons fire these
  });

  // ---- the IMPERIAL FORWARD LINE ----
  for (const w of PLAN.imperial) F.wall(w, { body: imp, cap: stripe });
  K.box(0, -60, 8, 6, 0.24, metalD, { climbable: true });   // the drop-ship pad
  for (const sx of [-1, 1]) for (const dz of [-5, 0, 5]) K.deco(new THREE.SphereGeometry(0.18, 8, 6), red, sx*7.6, 0.36, -60 + dz);
  K.gantry(34, -62, { a: imp, b: metalD, strut: imp, beacon: pal.beacon ?? 0xff5040 }, [-1, 1]);
  for (const [x, z, f] of [[-22, -60, 1], [-44, -60, -1]]) F.crates(x, z, imp, metalD, f);
  for (const [x, z] of [[-24, -46], [24, -46], [-4, -52], [6, -52], [-14, 28], [14, 28]]) spawnBarrel(V3(x, 0, z));
}
