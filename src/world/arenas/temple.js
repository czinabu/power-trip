// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Level 1 arena: the temple courtyard (Holy City of Jedha).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { shared, hazardZones } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded, at } from './kit.js';
import { setTempleDoors } from '../doorway.js';

/* LEVEL 1 — the TEMPLE COURTYARD (half-size 21). The opener teaches the toolkit on a readable, symmetric plan:
     · a walkable ZIGGURAT in the centre: contested high ground with a summit brazier that ERUPTS on a slow, telegraphed
       cycle (the first hazard the player meets, and it only punishes camping the top);
     · a ring of eight grand COLUMNS (r 13): wall-kick surfaces and cover from blaster fire, spaced so even a brute
       walks between them;
     · two straight broken WALLS east and west and four L-shaped corner RUINS on the diagonals (all under the 1.93
       single-jump apex, so they can be vaulted): cover that faces outward, toward where the enemy pours in;
     · the OVERWATCH gantry in the south-east corner for the Mando (fly) and the Jedi (chained double-jumps);
     · three Imperial FUEL DRUMS beside the walls to teach Push / kick / shoot-to-detonate before the Forge;
     · low rubble you step over (climbable, never a snag).
     · a BASTION in each corner (kit.js, level-design pass): steps up to a raised fall-back spot behind a wall, so the
       corners past the round edge ring are a second vantage, not dead floor 18 m from cover.
     · the TEMPLE FRONT just past the edge behind the spawn: a pillared façade with its great doors shut. The Jedi's
       story opens them once the siege is held, and the hero walks through them into the archive (world/doorway.js).
   The player spawns north (0, +10.5), facing the dais; the north lane is kept clear. */
export function buildTempleArena(L){
  const pal = L.pal || {};   // the world theme's colours (data/worlds.js); the defaults are the original look
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x7c715a, roughness: 0.93, metalness: 0.05 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x564b39, roughness: 0.95, metalness: 0.04 });
  const trim   = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xb89a5a, roughness: 0.5, metalness: 0.55 });
  const fireC  = pal.brazier ?? 0xff8a2a;
  const K = arenaKit(), R = seeded(11);
  // the plan is authored at 42 m across; a bigger arena spreads every piece out by the same share (sizes stay)
  const S = L.arena / 42;

  // ---- central ZIGGURAT — stepped and walkable (each step under STEP_UP), summit 1.5. The base is deliberately tight:
  // a foe blocked at the base can still reach a player on the summit, so the dais is contested, never a safe perch ----
  for (const t of [ {r:3.2, h:0.4}, {r:2.6, h:0.8}, {r:2.0, h:1.2}, {r:1.5, h:1.5} ]){
    K.box(0, 0, t.r, t.r, t.h, stone, { climbable: true });   // foes walk up the steps; avoidance ignores climbables
    K.deco(new THREE.BoxGeometry(t.r*2+0.05, 0.06, t.r*2+0.05), trim, 0, t.h, 0);   // a crisp gold lip on each step
  }
  // a gold inlay ring set into the floor around the dais — a focal anchor
  K.deco(new THREE.RingGeometry(3.7, 4.2, 40),
    new THREE.MeshBasicMaterial({ color: pal.inlay ?? 0x8a6e2e, transparent: true, opacity: 0.5, side: THREE.DoubleSide }), 0, 0.03, 0, -Math.PI/2);
  // ---- SUMMIT BRAZIER — the courtyard's glowing landmark; the flame is live (flickered in updateAmbient) ----
  K.deco(new THREE.CylinderGeometry(0.46, 0.3, 0.34, 12), stoneD, 0, 1.5 + 0.17, 0);
  shared.templeBrazier = K.deco(new THREE.ConeGeometry(0.38, 0.8, 10), new THREE.MeshBasicMaterial({ color: fireC }), 0, 1.5 + 0.66, 0);
  shared.templeBrazier.userData.noBake = true;   // it flickers (fx/ambient.js)
  // the summit ERUPTS on a slow cycle (1.4s amber warning): it only punishes standing on top
  hazardZones.push({ kind:'point', cx:0, cz:0, r:2.3, period:8, warnDur:1.4, activeDur:1.0, dmg:24, color:fireC, flash:true, t:0 });

  // ---- GRAND COLUMNS — eight at r 13, offset so the north spawn lane and the cardinal lanes stay open ----
  for (let i = 0; i < 8; i++){
    const a = (i / 8) * Math.PI*2 + Math.PI/8, [x, z] = at(a, 13 * S), h = 8.4 + R()*1.1, rad = 0.85;
    K.column(x, z, rad, h, stone, { taper: 0.84 });
    K.deco(new THREE.BoxGeometry(rad*2.4, 0.4, rad*2.4), stoneD, x, 0.2, z);            // plinth
    K.deco(new THREE.BoxGeometry(rad*2.7, 0.45, rad*2.7), stoneD, x, h - 0.22, z);       // capital
    K.slab(x, z, rad*1.35, rad*1.35, h - 0.45, h);                                       // (it overhangs the shaft: stand on all of it)
    if (i % 2 === 0){   // a hanging banner on every other column, on the courtyard side
      const ban = K.deco(new THREE.PlaneGeometry(1.0, 3.2),
        new THREE.MeshStandardMaterial({ color: pal.banner ?? 0x6e1f24, roughness: 0.9, side: THREE.DoubleSide }),
        x - Math.cos(a)*(rad+0.02), h - 2.4, z - Math.sin(a)*(rad+0.02), 0, -a + Math.PI/2, 0);
      ban.castShadow = false;
      const hem = K.deco(new THREE.PlaneGeometry(1.0, 0.28),
        new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xb89a5a, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }),
        ban.position.x, h - 4.0, ban.position.z, 0, ban.rotation.y, 0);
      hem.castShadow = false;
    }
  }

  // ---- BROKEN WALLS — east and west, along z (axis-aligned so collision matches the mesh), vaultable at 1.5 ----
  for (const sx of [-1, 1]){
    K.box(sx*8.5*S, 0, 0.3, 2.0, 1.5, stoneD);
    K.deco(new THREE.BoxGeometry(0.34, 0.3, 1.6), stone, sx*8.5*S, 1.6, -0.6 + R()*0.4, 0, 0.12*sx, 0);   // askew cap stone
  }
  // ---- CORNER RUINS — an L on each diagonal, corner outward, so the inside faces the dais and the outside faces the
  // edge where foes arrive. One arm is lower (1.2) to vault, one taller (1.65) to hide behind ----
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]){
    const cx = sx*7.5*S, cz = sz*7.5*S;
    K.box(cx - sx*1.3, cz, 1.3, 0.3, 1.65, stoneD);          // arm along x, toward the centre line
    K.box(cx, cz - sz*1.4, 0.3, 1.1, 1.2, stone);             // arm along z
    K.deco(new THREE.BoxGeometry(0.7, 0.3, 0.5), stone, cx - sx*0.5, 1.8, cz, 0, 0.3, 0);
  }

  // ---- OVERWATCH gantry — south-east, between two columns, clear of the cardinal lanes ----
  K.gantry(10*S, -12*S, { a: stoneD, b: stone, strut: trim, beacon: fireC });

  // ---- a BASTION in each corner ----
  { const c = shared.arenaHalf - 6;
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) K.bastion(sx*c, sz*c, sx, sz, { a: stoneD, b: stone }); }

  // ---- low RUBBLE you step over (toppled drums, all under STEP_UP) ----
  for (const [x, z, len, ax] of [[-4.5, 4.8, 1.6, true], [5.2, -5.0, 1.4, false], [-11.5, -6.5, 1.8, true], [12.0, 7.5, 1.5, false], [-2.5, -15.5, 1.7, true], [15.5, -2.5, 1.4, false]]){
    K.rubble(x*S, z*S, len, 0.3, stoneD, ax);
  }

  // ---- FUEL DRUMS — beside the walls and the south lane, where foes bunch up on their way in ----
  for (const [x, z] of [[10.2, -1.0], [-10.2, -1.0], [0, -10.2]]) spawnBarrel(V3(x*S, 0, z*S));

  // ---- the TEMPLE FRONT behind the spawn, past the edge (no collision: the movement clamp keeps the fight off it) ----
  templeFront(K, { stone, stoneD, trim, fireC, pal });
}

/* the temple's façade along the +z edge, its great doors in the middle: two leaves on hinges (live meshes, so they
   can swing: world/doorway.js) and a short firelit passage behind them, the burning archive somewhere down it */
function templeFront(K, m){
  const H = shared.arenaHalf, F = H + 2, DW = 5.6, DH = 8.4, WH = 14, len = H * 2 + 18;
  const mats = [];
  const d = (geo, mat, x, y, z, rx, ry, rz) => { const o = K.deco(geo, mat, x, y, z, rx, ry, rz); o.castShadow = false; o.userData.passThrough = true; mats.push(o); return o; };
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1, emissive: 0x3a1608, emissiveIntensity: 1 });   // (lit by the fire down the hall)
  const glow = new THREE.MeshBasicMaterial({ color: 0xff7a32, fog: false });
  const ember = new THREE.MeshBasicMaterial({ color: 0xffb060 });
  const side = (len - DW) / 4;   // half the length of each wall run beside the doorway
  // the wall, in three pieces round the doorway, a plinth course and a gold cornice along its top
  for (const sx of [-1, 1]){
    d(new THREE.BoxGeometry(side * 2, WH, 2.6), m.stoneD, sx * (DW / 2 + side), WH / 2, F + 1.3);
    d(new THREE.BoxGeometry(side * 2, 1.0, 0.7), m.stone, sx * (DW / 2 + side), 0.5, F - 0.3);
  }
  d(new THREE.BoxGeometry(DW, WH - DH, 2.6), m.stoneD, 0, DH + (WH - DH) / 2, F + 1.3);   // over the doors
  d(new THREE.BoxGeometry(len, 0.5, 0.9), m.trim, 0, WH - 0.25, F - 0.35);
  d(new THREE.BoxGeometry(len, 1.4, 0.6), m.stone, 0, WH - 1.2, F - 0.2);                   // the frieze
  // pilasters every 6 m along it (not over the doorway)
  for (let x = DW / 2 + 4; x < len / 2 - 1; x += 6) for (const sx of [-1, 1]){
    d(new THREE.BoxGeometry(1.4, WH - 1.9, 0.8), m.stone, sx * x, (WH - 1.9) / 2, F - 0.3);
    d(new THREE.BoxGeometry(1.8, 0.7, 1.1), m.stoneD, sx * x, 0.35, F - 0.45);
  }
  // the doorway's frame: gold jambs and a stepped lintel, a tall column either side and a gable over it all
  for (const sx of [-1, 1]){
    d(new THREE.BoxGeometry(0.7, DH, 1.0), m.trim, sx * (DW / 2 + 0.35), DH / 2, F - 0.2);
    d(new THREE.CylinderGeometry(0.62, 0.72, WH - 2.4, 12), m.stone, sx * (DW / 2 + 1.9), (WH - 2.4) / 2, F - 1.0);
    d(new THREE.BoxGeometry(1.7, 0.6, 1.7), m.stoneD, sx * (DW / 2 + 1.9), 0.3, F - 1.0);
    d(new THREE.BoxGeometry(1.7, 0.6, 1.7), m.trim, sx * (DW / 2 + 1.9), WH - 2.7, F - 1.0);
    // a brazier on a stone foot before each column, burning
    d(new THREE.CylinderGeometry(0.5, 0.32, 0.9, 10), m.stoneD, sx * (DW / 2 + 3.6), 0.45, F - 1.4);
    d(new THREE.ConeGeometry(0.36, 0.75, 9), new THREE.MeshBasicMaterial({ color: m.fireC }), sx * (DW / 2 + 3.6), 1.25, F - 1.4);
    // a long banner either side
    const ban = d(new THREE.PlaneGeometry(1.5, 6.5), new THREE.MeshStandardMaterial({ color: m.pal.banner ?? 0x6e1f24, roughness: 0.9, side: THREE.DoubleSide }), sx * (DW / 2 + 5.6), WH - 5.4, F - 0.62);
    ban.castShadow = false;
  }
  d(new THREE.BoxGeometry(DW + 0.6, 0.7, 1.2), m.trim, 0, DH + 0.35, F - 0.25);
  d(new THREE.BoxGeometry(DW + 5.6, 0.9, 2.2), m.stone, 0, WH - 2.0, F - 0.9);                // the entablature on the columns
  const gw = DW / 2 + 3.4, tri = new THREE.Shape([new THREE.Vector2(-gw, 0), new THREE.Vector2(gw, 0), new THREE.Vector2(0, 2.4)]);
  d(new THREE.ExtrudeGeometry(tri, { depth: 1.8, bevelEnabled: false }), m.stoneD, 0, WH - 1.55, F - 1.8);   // the gable over it all
  // the Order's sigil, a gold disc on the gable
  d(new THREE.CircleGeometry(0.6, 20), m.trim, 0, WH - 0.55, F - 1.82, 0, Math.PI, 0);

  // the PASSAGE behind the doors: dark walls, a low ceiling and the archive's fire glowing at the far end
  const P = 9;
  for (const sx of [-1, 1]) d(new THREE.BoxGeometry(0.6, DH, P), dark, sx * (DW / 2 + 0.3), DH / 2, F + P / 2);
  d(new THREE.BoxGeometry(DW + 1.2, 0.6, P), dark, 0, DH + 0.3, F + P / 2);
  d(new THREE.PlaneGeometry(DW, 0.02 + P), dark, 0, 0.015, F + P / 2, -Math.PI / 2);
  // (the glow and the embers stay live: unlit colours, which the arena's bake would shade)
  d(new THREE.PlaneGeometry(DW, DH), glow, 0, DH / 2, F + P - 0.05, 0, Math.PI, 0).userData.noBake = true;
  for (let k = 0; k < 4; k++) d(new THREE.BoxGeometry(0.5, 0.05, 0.5), ember, (k % 2 ? 1 : -1) * 1.2, 0.03, F + 2.2 + k * 1.7).userData.noBake = true;   // embers on the floor

  // the DOORS: a leaf on each hinge, shut. Bronze, banded and studded in gold
  const leafM = new THREE.MeshStandardMaterial({ color: m.pal.door ?? 0x5a3e24, roughness: 0.6, metalness: 0.45, emissive: 0x24120a, emissiveIntensity: 1 });   // (a little firelight on the inner faces once they swing in)
  const hinges = [];
  for (const sx of [-1, 1]){
    const hinge = new THREE.Group();
    hinge.position.set(sx * DW / 2, 0, F + 0.25);
    hinge.userData.noBake = true;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(DW / 2 - 0.04, DH - 0.04, 0.32), leafM);
    leaf.position.set(-sx * DW / 4, DH / 2, 0);
    hinge.add(leaf);
    for (const y of [1.4, DH / 2, DH - 1.4]){
      const band = new THREE.Mesh(new THREE.BoxGeometry(DW / 2 - 0.3, 0.22, 0.38), m.trim);
      band.position.set(-sx * DW / 4, y, 0); hinge.add(band);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 14), m.trim);
    ring.position.set(-sx * 0.42, DH * 0.45, -0.2); hinge.add(ring);
    hinge.traverse(o => { o.castShadow = false; o.userData.passThrough = true; });
    shared.arenaGroup.add(hinge);
    hinges.push({ g: hinge, sx });
  }
  setTempleDoors({ hinges, x: 0, z: F, w: DW, depth: P });
}
