// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Story arena: THE HEART OF THE GATE, the far side of the Sith gate under Jedha (Act IV's last chapter, THE UNBURIED:
// mission `gate-heart`, data/missions-gate.js). Darth Kharel's tomb: a round floor of black stone hanging in the dark,
// the gate's great ring standing at the north end, and the vessel the Hollow Choir forged for him chained to it.
//
// Its three CHAIN ANCHORS are styled locks (game/locks.js), one built for each hero's way of fighting, and the gate
// guardian's ward (boss/kharel.js) lights the same three again in his fight:
//   · the FORCE SEAL in the west: a rune ring cut into the floor (a Jedi holds it twice as fast)
//   · the HIGH LOCK in the east: on top of a broken stair-tower, 4 m up. Four climbable steps from the floor side are the
//     way up for anyone (each one under a mantle); the Mando flies straight up
//   · THE LINE in the south: a broken barricade across the floor, low walls either side (the squad holds it, H)
// The hero comes in from the south (z +22), facing the ring. Ring of pillars at r 19 for cover; low walls on the diagonals.

import * as THREE from 'three';
import { shared } from '../../state.js';
import { arenaKit, seeded } from './kit.js';
import { MISSION_WORLDS } from '../../data/worlds.js';

export const SITH_GATE = { half: 30, ring: { z: -25, r: 9 } };
// the spots its missions and its guardian use
export const SITH_GATE_SPOTS = {
  start: [0, 22, Math.PI],
  dais: [0, -8],                // the vessel's dais (the hold, and where the guardian stands)
  guardian: [0, -11],
  seal: [-17, -3],              // the anchors (and the guardian's wards)
  sky: [17.5, -4], skyY: 4,     // (the high lock sits on the stair-tower's deck)
  line: [0, 13],
};

// its world: the void past the gate, violet light from the ring, a cold moon-white key from nowhere in particular
Object.assign(MISSION_WORLDS, {
  sithGate: {
    sky: { top: 0x040208, horizon: 0x2a1640, below: 0x0a0610, bands: 7, stars: 220,
      sun: { el: 0.34, az: -1.6, color: 0xc8a8ff, halo: 0x6a3aa8, size: 26, kind: 'moon' },
      clouds: { color: 0x2a1a3a, under: 0x120a1a, count: 14, lo: 0.2, hi: 0.7 },
      ridges: [{ color: 0x120a18, h: 0.08, rough: 0.1, spiky: 1.4, seed: 44 }, { color: 0x0c0612, h: 0.05, rough: 0.14, spiky: 1.8, seed: 9 }] },
    fog: 0x1a1028, fogStart: 0.45, fogEnd: 2.2,
    light: { sun: 0xc0b0f0, sunI: 1.2, dir: [10, 44, 30], hemiSky: 0x6a5a98, hemiGround: 0x1e1626, fill: 0.95, rim: 0xb46bff, rimI: 0.8 },
    floor: { kind: 'flagstone', base: 0x3a3442, seed: 57 },
    outer: 0x1a1420,
    pal: { stone: 0x4e4858, stoneD: 0x322c3a, dark: 0x141018, metal: 0x5a5662, gate: 0xb46bff, seal: 0x9a6aff, beskar: 0x8a8e98, ember: 0xff7a3a },
    backdrop: [
      { kind: 'spires', count: 14, r: [1.9, 2.6], h: [24, 46], color: 0x140e1a, color2: 0x1c1424, skip: [[-Math.PI / 2, 0.5]] },
      { kind: 'colossi', az: [-1.05, -2.1], r: 1.75, h: [84, 96], color: 0x18121e, color2: 0x201828, dark: 0x060408, metal: 0x2a2232, blade: 0xb46bff, eyes: 0xb46bff },
    ],
    ambient: { kind: 'ash', color: 0xc8a8ff, count: 130, size: 0.2, opacity: 0.45 },
      mist: { color: 0x4a2a6a, count: 36, size: 10, opacity: 0.16 },
    hazards: { barrel: 0x6a2a50 },
    beats: { fog: 0x24163a, fill: 1.08, tint: 0xb090ff },
    sound: 'plains',
  },
});

export function buildSithGateArena(L){
  const pal = L.pal || {};
  const stone  = new THREE.MeshStandardMaterial({ color: pal.stone ?? 0x4e4858, roughness: 0.9 });
  const stoneD = new THREE.MeshStandardMaterial({ color: pal.stoneD ?? 0x322c3a, roughness: 0.95 });
  const dark   = new THREE.MeshStandardMaterial({ color: pal.dark ?? 0x141018, roughness: 0.8, metalness: 0.2 });
  const beskar = new THREE.MeshStandardMaterial({ color: pal.beskar ?? 0x8a8e98, roughness: 0.32, metalness: 0.85 });
  const glowC  = pal.gate ?? 0xb46bff;
  const glow   = new THREE.MeshBasicMaterial({ color: glowC, toneMapped: false });
  const veil   = new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const inlay  = new THREE.MeshBasicMaterial({ color: pal.seal ?? 0x9a6aff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const ember  = new THREE.MeshBasicMaterial({ color: pal.ember ?? 0xff7a3a, toneMapped: false });
  const K = arenaKit(), R = seeded(73);
  const flat = (m) => { m.userData.passThrough = true; m.userData.noBake = true; m.castShadow = false; m.receiveShadow = false; return m; };
  const S = SITH_GATE_SPOTS, H = SITH_GATE.half;
  shared.gateWards = [{ style: 'seal', at: S.seal }, { style: 'sky', at: S.sky, y: S.skyY }, { style: 'line', at: S.line }];   // (the guardian's ward: boss/kharel.js)

  // ---- THE GATE: a ring of black stone standing on its edge at the north end, the veil of the void inside it ----
  const gz = SITH_GATE.ring.z, gr = SITH_GATE.ring.r;
  const ring = K.deco(new THREE.TorusGeometry(gr, 1.1, 10, 48), dark, 0, gr + 0.6, gz);
  ring.userData.passThrough = true;   // (it stands on its two feet: the feet are the solids)
  flat(K.deco(new THREE.TorusGeometry(gr - 0.9, 0.12, 6, 64), glow, 0, gr + 0.6, gz + 0.6));
  const membrane = flat(K.deco(new THREE.CircleGeometry(gr - 1.0, 48), veil, 0, gr + 0.6, gz));
  membrane.renderOrder = 2;
  for (const sx of [-1, 1]){
    K.box(sx * 5.6, gz, 1.6, 1.6, 3.4, stoneD);   // its feet
    K.deco(new THREE.BoxGeometry(0.2, 2.6, 0.06), glow, sx * 5.6, 1.6, gz + 1.62).userData.noBake = true;
  }
  // runes round the ring, lit
  for (let i = 0; i < 18; i++){
    const a = i / 18 * Math.PI * 2, x = Math.cos(a) * (gr + 1.5), y = gr + 0.6 + Math.sin(a) * (gr + 1.5);
    if (y < 1) continue;
    flat(K.deco(new THREE.BoxGeometry(0.35, 0.7, 0.08), glow, x, y, gz + 0.9, 0, 0, a));
  }

  // ---- THE VESSEL'S DAIS: two low round rises in the middle of the floor, the chains running off it to the anchors ----
  for (const [r, h] of [[5.2, 0.35], [3.4, 0.7]]){
    const m = K.deco(new THREE.CylinderGeometry(r, r + 0.15, h, 32), r > 4 ? stoneD : stone, S.dais[0], h / 2, S.dais[1]);
    m.userData.passThrough = true;
    K.slab(S.dais[0], S.dais[1], r * 0.72, r * 0.72, 0, h, { climbable: true });   // (each rise under a step: walked up)
  }
  flat(K.deco(new THREE.RingGeometry(5.5, 5.9, 48), inlay, S.dais[0], 0.04, S.dais[1], -Math.PI / 2));
  // the chains: beskar links in a line from the dais to each anchor, lying slack on the floor (pictures)
  for (const to of [S.seal, S.sky, S.line]){
    const dx = to[0] - S.dais[0], dz = to[1] - S.dais[1], len = Math.hypot(dx, dz), n = Math.floor(len / 0.9);
    for (let k = 3; k < n - 1; k++){
      const t = k / n, x = S.dais[0] + dx * t, z = S.dais[1] + dz * t;
      flat(K.deco(new THREE.TorusGeometry(0.32, 0.09, 5, 10), beskar, x, 0.1, z, Math.PI / 2, 0, Math.atan2(dx, dz) + (k % 2 ? Math.PI / 2 : 0)));
    }
  }

  // ---- THE FORCE SEAL (west): a rune ring cut into the floor round a standing stone ----
  flat(K.deco(new THREE.RingGeometry(2.4, 2.75, 40), inlay, S.seal[0], 0.04, S.seal[1], -Math.PI / 2));
  for (let i = 0; i < 8; i++){
    const a = i / 8 * Math.PI * 2;
    flat(K.deco(new THREE.BoxGeometry(0.5, 0.04, 0.16), glow, S.seal[0] + Math.cos(a) * 3.1, 0.05, S.seal[1] + Math.sin(a) * 3.1, 0, -a, 0));
  }
  K.column(S.seal[0] - 3.4, S.seal[1] - 2.6, 0.7, 4.2, stoneD, { taper: 0.7, seg: 6 });

  // ---- THE HIGH LOCK (east): a broken stair-tower, its deck 4 m up, four climbable steps on the floor side ----
  const [tx, tz] = S.sky, top = S.skyY;
  K.box(tx, tz, 2.4, 2.4, top, stone);   // the tower (its deck is the top)
  K.deco(new THREE.BoxGeometry(5.0, 0.12, 5.0), stoneD, tx, top + 0.06, tz);
  for (let k = 1; k <= 3; k++) K.box(tx - 2.4 - k * 1.25 + 0.6, tz, 0.65, 1.3, top - k * 1.0, k % 2 ? stoneD : stone, { climbable: true });   // the steps down to the floor (1.0 apart)
  K.column(tx + 1.9, tz + 1.9, 0.35, top + 3.2, dark, { wallKick: false, seg: 6, taper: 0.6 });   // a broken post on the deck's far corner
  flat(K.deco(new THREE.SphereGeometry(0.26, 8, 6), ember, tx + 1.9, top + 3.4, tz + 1.9));

  // ---- THE LINE (south): a broken barricade across the floor, a gap in the middle where the anchor stands ----
  for (const sx of [-1, 1]){
    K.box(sx * 5.2, S.line[1] - 1.2, 2.6, 0.35, 1.3, stoneD);
    K.box(sx * 9.8, S.line[1] - 0.4, 1.6, 0.35, 1.3, stone);
    K.deco(new THREE.BoxGeometry(0.8, 0.35, 0.6), stone, sx * 4.2, 1.45, S.line[1] - 1.2, 0, 0.4 * sx, 0);
  }
  flat(K.deco(new THREE.PlaneGeometry(22, 0.25), inlay, 0, 0.03, S.line[1] + 0.8, -Math.PI / 2));

  // ---- the RING OF PILLARS (r 19): cover from his lightning, wall-kick faces ----
  for (let i = 0; i < 10; i++){
    const a = i / 10 * Math.PI * 2 + 0.31, x = Math.cos(a) * 20, z = Math.sin(a) * 20;
    if (z < -17 && Math.abs(x) < 10) continue;   // (the gate's end stays open)
    if (Math.hypot(x - S.sky[0], z - S.sky[1]) < 6 || Math.hypot(x - S.seal[0], z - S.seal[1]) < 6 || Math.hypot(x - S.line[0], z - S.line[1]) < 7) continue;
    const broken = R() < 0.3, h = broken ? 2.6 + R() : 10 + R() * 3;
    K.column(x, z, 1.0, h, stone, { taper: 0.84 });
    K.box(x, z, 1.35, 1.35, 0.45, stoneD, { climbable: true });
    if (!broken) flat(K.deco(new THREE.BoxGeometry(0.14, h * 0.5, 0.06), glow, x - Math.cos(a) * 0.95, h * 0.5, z - Math.sin(a) * 0.95, 0, -a + Math.PI / 2, 0));
  }
  // ---- LOW WALLS on the diagonals (vault them) and rubble you step over ----
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]){
    const cx = sx * 12, cz = sz * 12 - 2;
    if (Math.hypot(cx - S.sky[0], cz - S.sky[1]) < 7) continue;
    K.box(cx, cz, 1.8, 0.35, 1.3, stoneD);
    K.box(cx + sx * 1.6, cz - sz * 1.4, 0.35, 1.2, 1.3, stoneD);
  }
  for (const [x, z, len, ax] of [[-7, 4, 1.6, true], [8, 3, 1.4, false], [-12, -14, 1.8, false], [12, -15, 1.5, true], [-21, 10, 1.6, false]]) K.rubble(x, z, len, 0.3, stoneD, ax);

  // ---- the edge: a lip of broken stone round the floor, the dark below it (pictures past the bounds) ----
  for (let i = 0; i < 28; i++){
    const a = i / 28 * Math.PI * 2, r = H + 1.5 + R() * 2;
    flat(K.deco(new THREE.BoxGeometry(3 + R() * 3, 1.2 + R() * 2.5, 2.2), i % 2 ? stoneD : dark, Math.cos(a) * r, 0.4, Math.sin(a) * r, 0, -a, (R() - 0.5) * 0.3));
  }
  // the light the gate throws on the floor
  flat(K.deco(new THREE.CircleGeometry(11, 40), new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.08, depthWrite: false, toneMapped: false }), 0, 0.03, gz + 6, -Math.PI / 2));
}
