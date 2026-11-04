// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: the temple archive on Jedha, its roof burned away, the stacks on fire (chapter 2, THE BURNING ARCHIVE).

import * as THREE from 'three';
import { V3 } from '../../utils.js';
import { hazardZones } from '../../state.js';
import { spawnBarrel } from '../hazards.js';
import { arenaKit, seeded } from './kit.js';
import { buildSanctum, shelfFaces } from '../sanctum.js';

/* THE BURNING ARCHIVE (half-size 30, from its level's arena). The great reading hall under the temple, its vault burned through in places:
     · the READING DAIS in the middle: a low stepped round of stone with the archive's holocron plinth on top;
     · the STACKS: eight tall shelf runs of glowing data cards (3.4, too tall to vault: hard cover, wall-kick faces) in two rings, laid
       along the walls' grain so the lanes between them run straight to the dais. Three of them are BURNING: stand in
       front of one and it flares on a slow, telegraphed cycle;
     · fallen shelves (1.1, vault them) and scattered scroll cases you step over;
     · THE HALL round it all (world/sanctum.js): floor-to-vault shelves in every bay, two galleries, busts of the old
       masters, the Order's sigil over the north wall, the vault burned open where the smoke and the daylight come in;
     · a scaffold in the north-west corner (the archivists' lift) as the overwatch climb, fuel drums by the doors.
   The player comes in from the south (z +12), facing the dais. */
export const ARCHIVE = { half: 24, wallH: 26 };   // the hall's walls climb to where the vault springs (was 11, open to the sky)

export function buildArchiveArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0xb89a70, roughness: 0.92 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x8e7250, roughness: 0.95 });
  const trim   = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xd8b46a, roughness: 0.5, metalness: 0.5 });
  const wood   = new THREE.MeshStandardMaterial({ color: pal.wood ?? 0x5a3a24, roughness: 0.85 });
  const woodD  = new THREE.MeshStandardMaterial({ color: pal.woodD ?? 0x3a2416, roughness: 0.9 });
  const char   = new THREE.MeshStandardMaterial({ color: pal.char ?? 0x241a14, roughness: 1 });
  const scroll = new THREE.MeshStandardMaterial({ color: pal.scroll ?? 0xd8c8a0, roughness: 0.8 });
  const fire   = new THREE.MeshBasicMaterial({ color: pal.fire ?? 0xff8a2a });
  const ember  = new THREE.MeshBasicMaterial({ color: pal.ember ?? 0xffc060 });
  const holo   = new THREE.MeshBasicMaterial({ color: pal.holo ?? 0x7ad8ff });
  const K = arenaKit(), R = seeded(29);
  const H = (L.arena || ARCHIVE.half * 2) / 2, W = ARCHIVE.wallH;   // (as big as its level says)
  const S = H / ARCHIVE.half;   // the stacks were placed for a 48 m hall: a bigger one spreads them out by the same share (sizes stay)

  // ---- THE HALL (world/sanctum.js): floor-to-vault shelves of data cards round the walls, two galleries, busts of the
  // old masters, and the vault overhead burned through in places, the smoke and the daylight coming in where it's gone ----
  const holes = [[-9, -11, 7.5], [13, 9, 6], [-15, 14, 4.5], [4, -24, 4]];
  buildSanctum({ style: 'archive', seed: 29, half: H, wallH: W, rise: 13, gallery: [9, 17], bay: 6.5, light: [18, 34, 30],
    hole: (x, z) => holes.some(([hx, hz, r]) => Math.hypot(x - hx*S, z - hz*S) < r),
    holeShafts: holes.slice(0, 3).map(([hx, hz, r]) => [hx*S, hz*S, r * 0.55]),
    burning: 0.22, fire: pal.fire ?? 0xff8a2a, ember: pal.ember ?? 0xffc060,
    stone: pal.stone ?? 0xb89a70, stoneD: pal.stoneD ?? 0x8e7250, roof: pal.roof ?? 0x6e5640, rib: pal.rib ?? 0xa88a62, char: pal.char ?? 0x2a1e16,
    trim: pal.trim ?? 0xd8b46a, cloth: pal.banner ?? 0x8a2a20, glass: pal.window ?? 0xf0a868, sigil: pal.trim ?? 0xd8b46a, door: pal.door ?? 0x7a5440,
    shaftColor: 0xffd8a0, shaftOp: 0.13, holeOp: 0.07, vaultGlow: 0.3 });

  // ---- the READING DAIS: three low walkable rounds, the holocron plinth on top ----
  for (const [r, h] of [[3.4, 0.35], [2.6, 0.7], [1.8, 1.05]]){
    K.box(0, 0, r, r, h, stone, { climbable: true });
    K.deco(new THREE.BoxGeometry(r*2 + 0.06, 0.06, r*2 + 0.06), trim, 0, h, 0);
  }
  K.box(0, 0, 0.45, 0.45, 2.0, stoneD);
  const cube = K.deco(new THREE.BoxGeometry(0.42, 0.42, 0.42), holo, 0, 2.35, 0, Math.PI/4, Math.PI/4, 0);
  cube.userData.noBake = true;

  // ---- the STACKS: tall shelf runs, [x, z, half-length, alongX, burning] ----
  const stacks = [
    [-9, -9, 3.2, 1, 0], [9, -9, 3.2, 1, 1], [-9, 9, 3.2, 1, 1], [9, 9, 3.2, 1, 0],
    [-16, -2, 3.6, 0, 0], [16, 2, 3.6, 0, 1], [-3, -17, 3.4, 1, 0], [4, 17.5, 2.8, 1, 0],
  ];
  const faces = shelfFaces();   // the stacks' faces: rows of data cards, merged into one mesh
  for (const [x0, z0, hl, ax, burn] of stacks){
    const x = x0*S, z = z0*S;
    const hx = ax ? hl : 0.55, hz = ax ? 0.55 : hl, h = 3.4;
    K.box(x, z, hx, hz, h, burn ? char : wood);
    // the shelves' faces: rows of data cards both sides (the burning runs are only charred ledges now)
    for (const sd of [-1, 1]){
      if (!burn){
        if (ax) faces.add(hl*2 - 0.3, h - 0.5, x, h/2 + 0.05, z + sd*(hz + 0.015), sd > 0 ? 0 : Math.PI);
        else faces.add(hl*2 - 0.3, h - 0.5, x + sd*(hx + 0.015), h/2 + 0.05, z, sd * Math.PI/2);
      }
      for (let k = 0; k < 4; k++){
        const y = 0.45 + k*0.8;
        if (ax) K.deco(new THREE.BoxGeometry(hl*2 - 0.2, 0.07, 0.1), woodD, x, y, z + sd*(hz + 0.02));
        else K.deco(new THREE.BoxGeometry(0.1, 0.07, hl*2 - 0.2), woodD, x + sd*(hx + 0.02), y, z);
      }
      // the end of the run: a bronze upright
      if (ax) K.deco(new THREE.BoxGeometry(0.16, h, hz*2 + 0.12), trim, x + sd*(hl - 0.06), h/2, z);
      else K.deco(new THREE.BoxGeometry(hx*2 + 0.12, h, 0.16), trim, x, h/2, z + sd*(hl - 0.06));
    }
    K.deco(new THREE.BoxGeometry(hx*2 + 0.2, 0.25, hz*2 + 0.2), trim, x, h + 0.12, z);
    if (burn){
      // flames along the top, and the run flares on a cycle: don't stand in front of it
      for (let n = 0; n < 4; n++){
        const t = (n / 3 - 0.5) * (hl*2 - 1), fx = ax ? x + t : x, fz = ax ? z : z + t;
        const f = K.deco(new THREE.ConeGeometry(0.42, 1.1 + R()*0.6, 7), n % 2 ? fire : ember, fx, h + 0.75, fz);
        f.userData.noBake = true; f.castShadow = false;
      }
      hazardZones.push({ kind: 'line', cx: x, cz: z, dirX: ax ? 1 : 0, dirZ: ax ? 0 : 1, halfLen: hl, halfW: 1.6,
                         period: 9, warnDur: 1.5, activeDur: 1.1, dmg: 18, color: pal.fire ?? 0xff8a2a, flash: true, t: R() * 9 });
    }
  }

  faces.done(pal.cards ?? 0xffffff);

  // ---- FALLEN SHELVES (vault them) and scroll cases you step over ----
  for (const [x0, z0, hl, ax] of [[-5, 4.5, 2.2, 1], [6, -4, 2.0, 0], [-12, 15, 2.4, 1], [13, -15, 2.2, 0], [17, 11, 1.8, 1]]){
    const x = x0*S, z = z0*S;
    K.box(x, z, ax ? hl : 0.5, ax ? 0.5 : hl, 1.1, woodD);
    for (let n = 0; n < 3; n++) K.deco(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6), scroll, x + (R() - 0.5)*hl, 1.14, z + (R() - 0.5), Math.PI/2, R()*3, 0);
  }
  for (const [x, z, len, ax] of [[-1, 11, 1.4, true], [11, 4, 1.2, false], [-13, -11, 1.5, true], [3, -12, 1.3, false]]) K.rubble(x*S, z*S, len, 0.28, stoneD, ax);

  // ---- the archivists' SCAFFOLD (the overwatch climb) in the north-west ----
  K.gantry(-18*S, -18*S, { a: wood, b: woodD, strut: trim, beacon: pal.fire ?? 0xff8a2a }, [1, 1]);

  // ---- FUEL DRUMS the Empire brought to burn it with, by the doors ----
  for (const [x, z] of [[-20, 6], [20, -6], [8, -20]]) spawnBarrel(V3(x*S, 0, z*S));
}
