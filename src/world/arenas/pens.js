// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: TESSARIL, the Inquisitor prison moon where the Empire holds the children taken from the Ledger's list
// (the Jedi's chapter THE PENS, mission `pens`; Sera Quill's trial). A wet black rock under a gas giant, at night, in
// the rain.

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones, solids, shared } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';

/* THE PENS ON TESSARIL (84 across, half 42). The player lands at the south pad (+z) and looks north at the prison (-z).
   The scale pass: the prison is built to make a person feel small. Everything that frames the fight goes UP, well
   past anyone's reach, while the floor between keeps wide lanes so a squad, a droid and a dozen guards don't pile up:
     · the LANDING PAD at the south edge, where the ship waits to take the children off (the evacuees run to it);
     · the CANYON: the way in from the pad runs between a towering rock spine in the east (crags up to 26 m) and the
       crater's west face (up to 30 m), a lane 20 m wide at its narrowest. The causeway the slicer droid walks bends
       west round the spine, lit by guide lamps;
     · the PRISON WALL across the north (z -10), 14 m high with 20 m buttress towers and a 12 m blast gate in the middle,
       slid open once the droid is through. Behind it a YARD 30 m deep, and three CELL STACKS (22 m towers of lit cells)
       spread across it, a door panel at each foot;
     · OVERHEAD: a gantry bridge spans the yard at 22 m with prison cages hung from it, and searchlights rake the rain;
     · the INQUISITORS' SPIRE beyond the north edge, 140 m of black glass with a red slit running up it, and the crater
       rim (world backdrop) closing in on every side;
     · two GUARD TOWERS (the overwatch climb): one by the canyon, one in the yard;
     · SHOCK PYLONS that arc on a slow, telegraphed cycle, boulders, puddles, floodlights and supply crates.
   Cost: the tall pieces are a few dozen plain boxes and cones, baked with the rest of the arena; the searchlight beams
   and window strips are unlit basic material. No new per-frame work. */
export const PENS = { half: 42, wallZ: -10, wallH: 14, gate: 6 };

export function buildPensArena(L){
  const pal = L.pal || {};
  const rock   = new THREE.MeshStandardMaterial({ color: pal.rock ?? 0x3a3c44, roughness: 0.9, metalness: 0.05, flatShading: true });
  const rockD  = new THREE.MeshStandardMaterial({ color: pal.rockD ?? 0x2a2c34, roughness: 0.9, metalness: 0.05, flatShading: true });
  const wall   = new THREE.MeshStandardMaterial({ color: pal.wall ?? 0x4a4e58, roughness: 0.7, metalness: 0.35 });
  const wallD  = new THREE.MeshStandardMaterial({ color: pal.wallD ?? 0x2e3138, roughness: 0.75, metalness: 0.35 });
  const black  = new THREE.MeshStandardMaterial({ color: pal.spire ?? 0x15161b, roughness: 0.45, metalness: 0.6 });
  const stripe = new THREE.MeshStandardMaterial({ color: pal.stripe ?? 0xb83a2a, roughness: 0.6 });
  const crate  = new THREE.MeshStandardMaterial({ color: pal.crate ?? 0x5a5448, roughness: 0.9 });
  const red    = new THREE.MeshBasicMaterial({ color: pal.red ?? 0xff3a2a });
  const lamp   = new THREE.MeshBasicMaterial({ color: pal.lamp ?? 0xffe0b0 });
  const guide  = new THREE.MeshBasicMaterial({ color: pal.guide ?? 0x7ad8ff });
  const cell   = new THREE.MeshBasicMaterial({ color: pal.cell ?? 0xffc890 });
  const beamM  = new THREE.MeshBasicMaterial({ color: pal.beam ?? 0xc8d8ff, transparent: true, opacity: 0.05, depthWrite: false,
                                               blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const wet    = new THREE.MeshStandardMaterial({ color: pal.puddle ?? 0x1a2230, roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.75, depthWrite: false });
  const shockC = pal.shock ?? 0x9a7aff;
  const K = arenaKit(), R = seeded(73);
  const H = PENS.half, WZ = PENS.wallZ, WH = PENS.wallH, GT = PENS.gate;
  const WX = Math.max(H, (L.arena || 0) / 2) + 1.5;   // the wall runs edge to edge, in a co-op room built wider too (data/coop.js ROOM)
  const glow = (m) => m;   // (an unlit glow: the bake merges them per colour, world/ink.js staticGlow)
  const pic = (m) => { m.userData.passThrough = true; return m; };   // high overhead: out of everyone's reach

  // a boulder: a lumpy rock you can see, with a round solid to match (low ones climbable from the side by a jump)
  const boulder = (x, z, r, h, mat = rock) => {
    K.deco(new THREE.DodecahedronGeometry(1, 0), mat, x, h*0.42, z, R()*3, R()*3, R()*3).scale.set(r, h*0.62, r*(0.8 + R()*0.3));
    solids.push({ x, z, r: r*0.92, h: h*0.9 });
  };
  // a CRAG: a tall leaning rock needle (the canyon's walls). A faceted cone over a round solid, far too tall to top
  const crag = (x, z, r, h, mat = rock) => {
    K.deco(new THREE.ConeGeometry(r, h, 5), mat, x, h/2, z, (R() - 0.5)*0.12, R()*3, (R() - 0.5)*0.12).scale.set(1, 1, 0.75 + R()*0.4);
    K.deco(new THREE.DodecahedronGeometry(1, 0), R() < 0.5 ? rock : rockD, x, r*0.5, z, R()*3, R()*3, R()*3).scale.set(r*1.15, r*0.9, r*1.1);   // its broken foot
    solids.push({ x, z, r: r*1.05, h });
  };

  // ---- the LANDING PAD, south: a ring of lit deck where the ship sets down ----
  const PZ = 32;
  K.deco(new THREE.CylinderGeometry(7, 7.3, 0.18, 32), wallD, 0, 0.09, PZ).receiveShadow = true;
  K.deco(new THREE.RingGeometry(5.4, 5.7, 40), new THREE.MeshBasicMaterial({ color: 0xd9a43a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0, 0.2, PZ, -Math.PI/2);
  for (let k = 0; k < 10; k++){ const a = k / 10 * Math.PI*2; glow(K.deco(new THREE.BoxGeometry(0.4, 0.1, 0.4), guide, Math.cos(a)*6.5, 0.22, PZ + Math.sin(a)*6.5)); }
  // the landing lights on tall masts either side, so the pad reads from the gate
  for (const s of [-1, 1]){
    K.column(s*9.5, PZ + 2, 0.22, 9, wallD, { wallKick: false, seg: 8, taper: 0.8 });
    glow(K.deco(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd9a43a }), s*9.5, 9.3, PZ + 2));
  }

  // ---- the CANYON: the east ROCK SPINE (one solid mass: no pocket between the rocks to hide in)… ----
  for (const [x, z, r, h] of [[13, 15, 3.6, 14], [16, 8, 4.4, 20], [19, 0, 4.0, 17], [24, 11, 3.6, 12], [28, 3, 5.0, 26], [22, 18, 3.0, 9],
                               [17, -4, 2.6, 8], [33, 12, 4.4, 22], [35, -2, 4.0, 18]]) crag(x, z, r, h, R() < 0.5 ? rock : rockD);
  boulder(13, 4, 2.4, 3.6, rockD); boulder(24, 22, 2.6, 4.4);
  // …and the crater's WEST FACE, its feet stepping down toward the causeway
  for (const [x, z, r, h] of [[-40, 24, 4.6, 24], [-41, 12, 5.0, 30], [-39, 0, 4.6, 26], [-40, -12, 4.4, 22], [-36, 30, 3.6, 16]]) crag(x, z, r, h, R() < 0.5 ? rock : rockD);
  for (const [x, z, r, h] of [[-35, 18, 2.4, 4.6], [-35, 5, 2.8, 5.4], [-34, -6, 2.2, 3.8]]) boulder(x, z, r, h, rockD);
  // scattered rocks: cover in the open, low ones to vault
  for (const [x, z, r, h] of [[-26, 24, 2.2, 3.4], [-8, 6, 1.1, 1.6], [7, 21, 1.2, 1.8], [-18, -2, 1.0, 1.4], [34, 28, 2.8, 5],
                               [-30, -4, 1.6, 2.4], [6, -3, 0.9, 1.3], [-12, 16, 1.0, 1.4], [8, 8, 1.4, 2.2]]) boulder(x, z, r, h, R() < 0.5 ? rock : rockD);

  // ---- the CAUSEWAY: guide lamps along the droid's walk, pad → west of the spine → the gate ----
  const way = [[0, 27], [-14, 20], [-24, 7], [-18, -4], [0, -6]];
  for (let i = 0; i < way.length - 1; i++){
    const [x0, z0] = way[i], [x1, z1] = way[i + 1];
    K.strip(x0, z0, x1, z1, 4.4, 0x2a3140, 0.55);
    const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 4);
    for (let k = 1; k < n; k++){
      const t = k / n, x = x0 + (x1 - x0)*t, z = z0 + (z1 - z0)*t, nx = -(z1 - z0), nz = x1 - x0, nl = Math.hypot(nx, nz);
      for (const s of [-1, 1]) glow(K.deco(new THREE.BoxGeometry(0.22, 0.14, 0.22), guide, x + s*nx/nl*2.6, 0.08, z + s*nz/nl*2.6));
    }
  }

  // ---- the PRISON WALL across the north, its blast gate in the middle ----
  for (const s of [-1, 1]){
    const x0 = s*GT, x1 = s*WX, cx = (x0 + x1)/2, hx = Math.abs(x1 - x0)/2;
    K.box(cx, WZ, hx, 0.9, WH, wall);
    K.deco(new THREE.BoxGeometry(hx*2, 0.6, 2.4), wallD, cx, WH + 0.3, WZ);                      // the guard walk on top
    K.deco(new THREE.BoxGeometry(hx*2, 0.3, 0.08), stripe, cx, 3.2, WZ + 0.94);                 // a red band at chest height
    K.deco(new THREE.BoxGeometry(hx*2, 0.18, 0.08), stripe, cx, WH - 2.2, WZ + 0.94);           // and one under the walk
    // BUTTRESS TOWERS: wall-run faces, each rising past the walk with a red light near its crown
    for (let x = s*(GT + 7); Math.abs(x) < WX - 2.5; x += s*13){
      K.box(x, WZ + 1.3, 0.9, 0.5, WH + 6, wallD);
      glow(K.deco(new THREE.BoxGeometry(0.7, 0.16, 0.06), red, x, WH + 4.6, WZ + 1.84));
      glow(K.deco(new THREE.BoxGeometry(0.7, 0.16, 0.06), red, x, 6, WZ + 1.84));
    }
    // the gate's posts and its doors, slid back into the wall
    K.box(s*(GT + 0.8), WZ, 0.8, 1.4, WH + 6, wallD);
    K.box(s*(GT + 3.4), WZ + 1.15, 2.6, 0.25, WH - 0.4, wallD);
    for (let k = 0; k < 5; k++) K.deco(new THREE.BoxGeometry(0.3, WH - 0.6, 0.06), stripe, s*(GT + 1.6 + k*1.0), (WH - 0.4)/2, WZ + 1.32);
  }
  // the lintel over the gate: a slab you can land on (Sera's perch), with the sign under it
  K.deco(new THREE.BoxGeometry(GT*2 + 3.2, 2.4, 2.8), wallD, 0, WH + 1.2, WZ);
  K.slab(0, WZ, GT + 1.6, 1.4, WH, WH + 2.4);
  K.sign('DETENTION LEVEL', 0, WH - 1.2, WZ + 1.45, 0, { ink: '#ff9a8a', edge: 'rgba(255,90,70,.85)', w: 7 });

  // ---- the CELL STACKS behind the wall: towers of lit cells, a sealed door and its panel at each foot ----
  const stack = (x, z, h) => {
    const hx = 5, hz = 3.6;
    K.box(x, z, hx, hz, h, wall);
    K.deco(new THREE.BoxGeometry(hx*2 + 0.6, 0.5, hz*2 + 0.6), wallD, x, h + 0.25, z);          // the roof's lip
    const dome = K.deco(new THREE.SphereGeometry(3.6, 18, 8, 0, Math.PI*2, 0, Math.PI/2), wallD, x, h + 0.5, z);
    dome.scale.set(1.2, 0.55, 0.85);
    solids.push({ x, z, hx: 4.3, hz: 3.06, h: h + 2.4, box: true });                                                     // (up there, out of reach: still solid)
    glow(K.deco(new THREE.SphereGeometry(0.3, 8, 6), red, x, h + 2.6, z));                        // a beacon on the dome
    K.deco(new THREE.BoxGeometry(3.0, 3.4, 0.2), black, x, 1.7, z + hz + 0.08);                  // the door
    K.deco(new THREE.BoxGeometry(3.4, 0.22, 0.24), stripe, x, 3.6, z + hz + 0.1);
    glow(K.deco(new THREE.BoxGeometry(1.6, 0.16, 0.1), red, x, 3.85, z + hz + 0.16));
    // the cells: rows of barred windows up the face, most of them lit (the children are in there)
    for (let y = 5.5; y < h - 1.5; y += 2.6){
      K.deco(new THREE.BoxGeometry(hx*2 + 0.2, 0.18, 0.5), wallD, x, y - 0.75, z + hz + 0.2);   // each tier's ledge
      for (let c = -2; c <= 2; c++) if (R() < 0.8) glow(K.deco(new THREE.BoxGeometry(0.7, 1.0, 0.06), cell, x + c*1.9, y, z + hz + 0.04));
    }
    for (const s of [-1, 1]) for (let y = 5.5; y < h - 1.5; y += 5.2)                              // and a few down each side
      if (R() < 0.7) glow(K.deco(new THREE.BoxGeometry(0.06, 1.0, 0.7), cell, x + s*(hx + 0.04), y, z + (R() - 0.5)*3));
  };
  stack(-26, -32, 22); stack(26, -32, 22); stack(0, -38, 26);

  // ---- OVERHEAD: a gantry bridge across the yard at 22 m on two great pylons, with cages hung from it ----
  const BY = 22, BZ = -22;
  for (const s of [-1, 1]){
    K.box(s*37, BZ, 2.2, 2.2, BY + 2, wallD);
    glow(K.deco(new THREE.BoxGeometry(0.16, 0.7, 4.0), red, s*(37 - 2.24), BY - 4, BZ));
  }
  pic(K.deco(new THREE.BoxGeometry(74, 1.4, 3.2), wallD, 0, BY + 0.7, BZ));
  pic(K.deco(new THREE.BoxGeometry(74, 0.9, 0.2), wall, 0, BY + 1.85, BZ - 1.5));
  pic(K.deco(new THREE.BoxGeometry(74, 0.9, 0.2), wall, 0, BY + 1.85, BZ + 1.5));
  for (let x = -33; x <= 33; x += 6) glow(pic(K.deco(new THREE.BoxGeometry(0.5, 0.1, 0.5), red, x, BY - 0.06, BZ)));
  for (const [x, len] of [[-20, 3.2], [-9, 1.6], [9, 2.6], [20, 1.8]]){                            // the hanging cages
    pic(K.deco(new THREE.CylinderGeometry(0.05, 0.05, len, 4), wallD, x, BY - len/2, BZ));
    const cy = BY - len - 1.6;
    pic(K.deco(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 8), wallD, x, cy - 1.5, BZ));
    pic(K.deco(new THREE.CylinderGeometry(0.5, 1.1, 0.8, 8), wallD, x, cy + 1.7, BZ));
    for (let k = 0; k < 8; k++){ const a = k / 8 * Math.PI*2;
      pic(K.deco(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 4), wallD, x + Math.cos(a)*1.05, cy, BZ + Math.sin(a)*1.05)); }
  }

  // ---- SEARCHLIGHTS: four lamps up on the wall and the pylons, their beams thrown up into the rain ----
  const beam = (x, y, z, ry, tilt, len = 60) => {
    K.box(x, z, 0.5, 0.5, 0.7, wallD, { y: y - 0.35 });
    glow(K.deco(new THREE.CircleGeometry(0.4, 10), lamp, x, y + 0.36, z, -Math.PI/2));
    const b = new THREE.Mesh(new THREE.ConeGeometry(4.5, len, 14, 1, true), beamM);
    b.geometry.translate(0, -len/2, 0);                                     // its tip at the lamp
    b.position.set(x, y + 0.4, z); b.rotation.set(Math.PI - tilt, ry, 0, 'YXZ');
    b.castShadow = b.receiveShadow = false; b.renderOrder = 3;
    pic(b); b.userData.noBake = true; b.userData.noAO = true; shared.arenaGroup.add(b);
  };
  beam(-(GT + 0.8), WH + 6.35, WZ, 0.5, 0.42); beam(GT + 0.8, WH + 6.35, WZ, -0.7, 0.38);
  beam(-37, BY + 2.35, BZ, 2.4, 0.5); beam(37, BY + 2.35, BZ, -2.1, 0.46);

  // ---- the INQUISITORS' SPIRE: black, beyond the north edge, a red slit of light running all the way up ----
  const SZ = -H - 24;
  K.deco(new THREE.CylinderGeometry(3, 16, 140, 6), black, 0, 70, SZ);
  K.deco(new THREE.CylinderGeometry(5.2, 5.2, 3, 6), black, 0, 141, SZ);
  K.deco(new THREE.CylinderGeometry(0.2, 2.4, 14, 6), black, 0, 149, SZ);
  glow(K.deco(new THREE.SphereGeometry(0.9, 8, 6), red, 0, 156.5, SZ));
  glow(K.deco(new THREE.BoxGeometry(0.7, 118, 0.3), red, 0, 62, SZ + 9.7, -0.1, 0, 0));
  for (let y = 22; y < 130; y += 18) glow(K.deco(new THREE.BoxGeometry(6, 0.3, 0.3), red, 0, y, SZ + 15.6 - y*0.093));
  for (const s of [-1, 1]){   // its buttresses, and two lesser spires
    K.deco(new THREE.CylinderGeometry(1.2, 6, 56, 6), black, s*20, 28, SZ + 6);
    glow(K.deco(new THREE.BoxGeometry(0.3, 30, 0.2), red, s*20, 24, SZ + 10.6, -0.08, 0, 0));
    K.deco(new THREE.CylinderGeometry(0.8, 4, 34, 6), black, s*34, 17, SZ + 12);
  }

  // ---- the GUARD TOWERS ----
  K.gantry(-30, 26, { a: wall, b: wallD, strut: wallD, beacon: pal.red ?? 0xff3a2a }, [1, -1]);
  K.gantry(32, -16, { a: wall, b: wallD, strut: wallD, beacon: pal.red ?? 0xff3a2a }, [-1, -1]);

  // ---- SHOCK PYLONS: a post with a coil, arcing on a slow cycle round its foot ----
  [[-8, -1], [12, -24], [-12, -25], [-26, 14], [10, 2]].forEach(([x, z], i) => {
    K.column(x, z, 0.3, 2.6, wallD, { wallKick: false, seg: 6, taper: 0.7 });
    glow(K.deco(new THREE.TorusGeometry(0.42, 0.08, 6, 14), new THREE.MeshBasicMaterial({ color: shockC }), x, 2.3, z, Math.PI/2));
    hazardZones.push({ kind: 'point', cx: x, cz: z, r: 2.2, period: 8, warnDur: 1.5, activeDur: 0.9, dmg: 14, color: shockC, flash: true, t: i * 1.6 });
  });

  // ---- floodlights on tall poles, puddles in the low ground, crates and drums ----
  for (const [x, z] of [[-8, 13], [8, -16], [-30, -20], [20, -18], [-34, 30], [10, 28], [-28, 4], [36, -36]]){
    K.column(x, z, 0.2, 8.5, wallD, { wallKick: false, seg: 8, taper: 1 });
    K.deco(new THREE.BoxGeometry(1.0, 0.36, 0.6), wallD, x, 8.6, z);
    glow(K.deco(new THREE.BoxGeometry(0.8, 0.08, 0.44), lamp, x, 8.42, z));
  }
  for (const [x, z, w, d] of [[-5, 10, 5, 3], [-22, -1, 4, 4.6], [4, -5, 4, 2.4], [-13, 25, 5.6, 2.8], [16, -28, 4, 2.6], [-16, -28, 3.4, 3.4], [2, 16, 3.6, 2.2]]){
    const p = K.deco(new THREE.CircleGeometry(1, 18), wet, x, 0.03, z, -Math.PI/2);
    p.scale.set(w/2, d/2, 1); p.castShadow = false; p.userData.passThrough = true;
  }
  for (const [x, z, s] of [[-4, 21, 0.5], [6, 16, 0.45], [-15, -19, 0.5], [15, -19, 0.45], [-36, -26, 0.5], [36, 20, 0.45], [-28, 0, 0.4],
                           [-6, -40, 0.5], [7, -41, 0.45], [36, -26, 0.5]]){
    K.box(x, z, s, s, s*1.4, crate, { climbable: true });
  }
  for (const [x, z] of [[-8, -20], [30, -8], [-20, 28], [20, -38]]) spawnBarrel(V3(x, 0, z));
}
