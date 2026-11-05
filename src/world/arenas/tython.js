// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HIDDEN TEMPLE ON TYTHON: the hub's five wings (data/hub.js). Each wing is its own arena build, so only the one you
// stand in is ever in memory. The halls are the sanctum (world/sanctum.js) at a far bigger scale and opened right up:
// tall open arcades onto Tython's mountains, an oculus in the Grand Hall's vault, daylight falling across the floor.
// The Saber Forge is the odd one out: a kyber cave under the temple.
//
// Every station (data/hub.js `stations`) gets a lit ring on the floor and a sign over it; game/hub.js reads the same
// list for the prompts. Anything that moves (the map's hologram, the remotes, the forge's hilt parts) is flagged
// noBake and listed in shared.hubAnim for game/hub.js to turn.

import * as THREE from 'three';
import { shared } from '../../state.js';
import { arenaKit, seeded } from './kit.js';
import { buildSanctum, shelfFaces } from '../sanctum.js';
import { HUBS, SIDE_OUT, wingByLayout } from '../../data/hub.js';
import { PI, std, glowM, holoM, live, anim, spinner, roundStep, hubStations, hubDoorSigns } from './hub-kit.js';

/* the dispatcher: world/arena.js hands every ty* layout here */
export function buildTythonArena(L){
  shared.hubAnim = [];
  const wings = HUBS.temple.wings, found = wingByLayout(L.layout), wing = found && found.hub === 'temple' ? found.id : 'hall';
  const pal = L.pal || {}, K = arenaKit(), R = seeded(wing.length * 31 + 7), W = wings[wing];
  ({ hall, council, training, archives, forge })[wing](L, K, pal, R);
  hubStations(W, K, { ring: pal.kyber ?? 0x5ad2ff, beacon: (x, z) => waystone(K, pal, x, z), stone: { stone: pal.stoneD ?? 0xa89f8c, trim: pal.trim ?? 0xd8b860, glow: pal.kyber ?? 0x5ad2ff } });
  hubDoorSigns(W, wings, K, { runner: pal.kyber ?? 0x5ad2ff });
}

/* ---------------- the pieces every wing shares ---------------- */
/* a WAYSTONE: a short carved pillar with a kyber shard floating over it (fast travel from any wing) */
function waystone(K, pal, x, z){
  K.column(x, z, 0.55, 1.5, std(pal.stone ?? 0xd6cfbe), { wallKick: false, seg: 8, taper: 0.8 });
  K.deco(new THREE.CylinderGeometry(0.75, 0.75, 0.16, 8), std(pal.trim ?? 0xd8b860, 0.5, 0.5), x, 1.55, z);
  const shard = live(K.deco(new THREE.OctahedronGeometry(0.32), glowM(pal.kyber ?? 0x5ad2ff), x, 2.25, z));
  anim(shard, (o, t, b) => { o.position.y = b.y + Math.sin(t * 1.6) * 0.12; o.rotation.y = t * 0.9; });
}
/* a GUARDIAN on a colossal scale: hooded, robed, both hands on a blade planted point-down. With collision on its plinth */
function colossus(K, x, z, ry, s, stone, stoneD, trim, shade){
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; shared.arenaGroup.add(g);
  const add = (geo, mat, px, py, pz, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const b = 2.2;
  K.box(x, z, 3.6 * s / 2.4, 3.6 * s / 2.4, b, stoneD);
  add(new THREE.BoxGeometry(3.9 * s / 1.2, 0.3, 3.9 * s / 1.2), trim, 0, b, 0);
  add(new THREE.CylinderGeometry(1.1 * s, 1.9 * s, 7 * s, 12), stone, 0, b + 3.5 * s, 0);
  add(new THREE.CylinderGeometry(1.5 * s, 1.1 * s, 1.7 * s, 12), stone, 0, b + 7.6 * s, 0);
  add(new THREE.SphereGeometry(0.95 * s, 12, 10), stone, 0, b + 9.1 * s, 0.08 * s);
  add(new THREE.SphereGeometry(0.64 * s, 10, 8), shade, 0, b + 9.05 * s, -0.48 * s);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.52 * s, 2.9 * s, 0.6 * s), stone, sx * 0.76 * s, b + 6.6 * s, -0.84 * s, -0.35, sx * 0.35);
  add(new THREE.BoxGeometry(1.06 * s, 0.7 * s, 0.76 * s), stone, 0, b + 5.4 * s, -1.45 * s);
  add(new THREE.CylinderGeometry(0.18 * s, 0.18 * s, 1.4 * s, 8), trim, 0, b + 5.5 * s, -1.52 * s);
  add(new THREE.BoxGeometry(0.24 * s, 4.9 * s, 0.15 * s), stoneD, 0, b + 2.45 * s, -1.52 * s);
  return g;
}
/* a TREE in a stone planter: Tython's green brought indoors. The planter is low cover you can hop on */
function planter(K, x, z, pal, R, big = 1){
  const r = 2.6 * big;
  K.column(x, z, r, 0.95, std(pal.stoneD ?? 0xa89f8c), { wallKick: false, seg: 16, taper: 1 });
  K.deco(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.1, 16), std(0x3a2e22, 1), x, 0.98, z);
  const h = (7 + R() * 3) * big;
  K.deco(new THREE.CylinderGeometry(0.28 * big, 0.45 * big, h, 7), std(pal.wood ?? 0x7a5230), x, 0.95 + h / 2, z);
  const leaf = [std(pal.leaf ?? 0x4a8a4e, 0.95), std(pal.leafD ?? 0x36703c, 0.95)];
  for (let i = 0; i < 4; i++){
    const a = R() * PI * 2, d = R() * 1.6 * big, y = 0.95 + h * (0.72 + R() * 0.3);
    K.deco(new THREE.IcosahedronGeometry((2.2 + R() * 1.1) * big, 0), leaf[i % 2], x + Math.cos(a) * d, y, z + Math.sin(a) * d, R(), R(), R());
  }
}
/* a terrace past the open arches: a ledge, a balustrade, and the drop to the valley beyond (pictures past the edge) */
function terrace(side, off, len, stone, trim){
  const g = shared.arenaGroup, [ox, oz] = SIDE_OUT[side], along = ox ? 'z' : 'x';
  const put = (geo, mat, d, y, a = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(ox * d + (along === 'x' ? a : 0), y, oz * d + (along === 'z' ? a : 0));
    if (ox) m.rotation.y = PI / 2;
    m.userData.passThrough = true; m.castShadow = false; m.receiveShadow = true; g.add(m); return m;
  };
  put(new THREE.BoxGeometry(len, 0.6, 9), stone, off + 5.5, -0.25);
  put(new THREE.BoxGeometry(len, 0.2, 0.6), trim, off + 9.6, 1.25);
  for (let a = -len / 2 + 1; a < len / 2; a += 1.6) put(new THREE.CylinderGeometry(0.18, 0.24, 1.1, 6), stone, off + 9.6, 0.6, a);
}

/* ---------------- THE GRAND HALL ---------------- */
function hall(L, K, pal, R){
  const stone = std(pal.stone ?? 0xd6cfbe), stoneD = std(pal.stoneD ?? 0xa89f8c), trim = std(pal.trim ?? 0xd8b860, 0.45, 0.55);
  const shade = std(0x1a1610, 1), H = shared.arenaHalf;
  const s = buildSanctum({ style: 'temple', seed: 91, wallH: 44, rise: 26, bay: 12, gallery: [15, 30], windowY0: 32.5, windowW: 3.2,
    doors: ['n', 'e', 'w', 's'], sigilSide: 'n', sigilSize: 5, doorW: 9.6, doorH: 14, doorArch: true,
    arcade: ['e', 'w'], arcadeTop: 28, statueH: 11, light: [-22, 44, 26],
    hole: (x, z) => Math.hypot(x, z) < 15, holeShafts: [[0, 0, 9]], holeOp: 0.2, shaftOp: 0.14, shaftColor: 0xfff0d0,
    stone: 0xd6cfbe, stoneD: 0xb0a794, rib: 0xe2dccc, roof: 0xbcb4a2, coffer: 0x9a9282, trim: 0xd8b860, cloth: 0x2e6a8a,
    glass: 0xd8ecff, candle: 0xffc070, sigil: 0xffe0a0, door: 0xffe8c0, vaultGlow: 0.45 });
  terrace('e', s.off, H * 2, stoneD, trim); terrace('w', s.off, H * 2, stoneD, trim);
  // the PROCESSIONAL: two rows of columns up the middle, rising to the vault
  for (const x of [-17, 17]) for (const z of [-36, -24, -12, 12, 24, 36]){
    K.column(x, z, 1.7, 44, stone, { seg: 14, taper: 0.94 });
    K.deco(new THREE.CylinderGeometry(2.4, 2.4, 1.1, 14), stoneD, x, 0.55, z);
    K.deco(new THREE.BoxGeometry(4.2, 1.2, 4.2), trim, x, 43.4, z);
    for (const y of [9, 18, 27]) K.deco(new THREE.CylinderGeometry(1.78, 1.78, 0.3, 14), trim, x, y, z);   // gold bands
  }
  // the KYBER POOL under the oculus: a wide round dais, water round the projector, the temple's map turning over it
  roundStep(K, 0, 0, 13, 0.4, stoneD, 64);
  K.deco(new THREE.TorusGeometry(13, 0.14, 8, 96), trim, 0, 0.4, 0, -PI / 2).userData.noOutline = true;   // a gold lip round the dais edge
  live(K.deco(new THREE.RingGeometry(4.2, 10.5, 64), new THREE.MeshStandardMaterial({ color: pal.water ?? 0x6ac8e8, roughness: 0.15, metalness: 0.3, emissive: 0x1a5a78, emissiveIntensity: 0.6 }), 0, 0.46, 0, -PI / 2));
  K.column(0, 0, 1.3, 1.3, trim, { wallKick: false, seg: 12, taper: 0.8 });
  live(K.deco(new THREE.CylinderGeometry(1.9, 0.6, 3.5, 24, 1, true), holoM(pal.kyber ?? 0x5ad2ff, 0.18), 0, 3.1, 0));
  const map = new THREE.Group(); map.position.set(0, 5.6, 0); shared.arenaGroup.add(map);
  { const hm = holoM(pal.kyber ?? 0x5ad2ff, 0.5), hw = holoM(0xffffff, 0.35);
    const blk = (w, h, d, x, z, m = hm) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, h / 2, z); live(b); map.add(b); };
    blk(1.5, 0.5, 1.5, 0, 0, hw); blk(1.1, 0.35, 0.6, 0, -1.4); blk(0.6, 0.3, 1.2, 1.3, 0); blk(0.6, 0.3, 1.2, -1.3, 0); blk(0.8, 0.2, 0.8, 0, 1.3);
    blk(0.4, 0.04, 4.2, 0, 0); blk(4.2, 0.04, 0.4, 0, 0);
    const ring = live(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.03, 4, 64), hm)); ring.rotation.x = PI / 2; map.add(ring); }
  spinner(map, 0.25);
  // the four FOUNDERS: colossal guardians between the processional and the open arcades, facing the pool
  for (const [x, z] of [[-32, -22], [32, -22], [-32, 22], [32, 22]]) colossus(K, x, z, Math.atan2(-x, -z) + PI, 1.25, stone, stoneD, trim, shade);
  // Tython brought in: planters of trees along the arcades, and between the founders
  for (const [x, z] of [[-34, 0], [34, 0], [-34, -40], [34, -40], [-34, 40], [34, 40]]) planter(K, x, z, pal, R, 1.1);
  // benches along the processional, low steps to hop on
  for (const x of [-10, 10]) for (const z of [-30, -18, 18, 30]) K.box(x, z, 0.6, 2.4, 0.5, stoneD, { climbable: true });
  // great hanging banners down the processional columns, the Order's blue
  for (const x of [-17, 17]) for (const z of [-24, 24]) K.banner(x + Math.sign(x) * -1.8, 30, z, x < 0 ? PI / 2 : -PI / 2, 2.6, 12, pal.cloth ?? 0x2e6a8a, pal.trim ?? 0xd8b860, 0xffe0a0);
}

/* ---------------- THE COUNCIL CHAMBER ---------------- */
function council(L, K, pal, R){
  const stone = std(pal.stone ?? 0xd6cfbe), stoneD = std(pal.stoneD ?? 0xa89f8c), trim = std(pal.trim ?? 0xd8b860, 0.45, 0.55);
  const s = buildSanctum({ style: 'temple', seed: 57, wallH: 32, rise: 18, bay: 9, gallery: [13], windowW: 2.6,
    doors: ['s'], sigilSide: null, doorW: 8, doorH: 12, doorArch: true,
    arcade: ['n', 'e', 'w'], arcadeTop: 24, statueH: 9, light: [10, 40, -30],
    hole: (x, z) => Math.hypot(x, z) < 7, holeShafts: [[0, 0, 5]], holeOp: 0.16, shaftOp: 0.12, shaftColor: 0xfff0d0,
    stone: 0xd6cfbe, stoneD: 0xb0a794, rib: 0xe2dccc, roof: 0xbcb4a2, coffer: 0x9a9282, trim: 0xd8b860, cloth: 0x2e6a8a,
    door: 0xffe8c0, vaultGlow: 0.45 });
  const H = shared.arenaHalf;
  for (const side of ['n', 'e', 'w']) terrace(side, s.off, H * 2, stoneD, trim);
  // the raised floor, a gold inlay ring, and the TABLE: a round slab with the galaxy turning over it
  roundStep(K, 0, 0, 15, 0.45, stoneD, 64);
  K.deco(new THREE.TorusGeometry(15, 0.14, 8, 96), trim, 0, 0.45, 0, -PI / 2).userData.noOutline = true;
  live(K.deco(new THREE.RingGeometry(9.4, 9.8, 64), glowM(pal.trim ?? 0xd8b860, 0.7), 0, 0.5, 0, -PI / 2));
  K.column(0, 0, 3.4, 1.25, stone, { wallKick: false, seg: 32, taper: 1 });
  K.deco(new THREE.CylinderGeometry(3.6, 3.6, 0.16, 32), trim, 0, 1.3, 0);
  const gal = new THREE.Group(); gal.position.set(0, 4.2, 0); shared.arenaGroup.add(gal);
  { const P = [], C = [], col = new THREE.Color();
    for (let i = 0; i < 900; i++){
      const arm = i % 3, d = Math.pow(R(), 0.6) * 3.2, a = arm * PI * 2 / 3 + d * 1.5 + (R() - 0.5) * 0.5;
      P.push(Math.cos(a) * d, (R() - 0.5) * 0.25 * (1 - d / 3.4), Math.sin(a) * d);
      col.setHSL(0.55 + R() * 0.1, 0.8, 0.55 + (1 - d / 3.2) * 0.35); C.push(col.r, col.g, col.b);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.userData.noBake = true; gal.add(pts);
    const core = live(new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), glowM(0xfff0d0))); gal.add(core);
    const beam = live(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.2, 2.8, 32, 1, true), holoM(pal.kyber ?? 0x5ad2ff, 0.08))); beam.position.y = -1.5; gal.add(beam); }
  spinner(gal, 0.12);
  // twelve SEATS in a ring facing the table, the door's side left open
  const seat = std(pal.cloth ?? 0x2e6a8a, 0.9), wood = std(pal.woodD ?? 0x52361e, 0.85);
  for (let i = 0; i < 12; i++){
    const a = -PI / 2 + (i - 5.5) / 12 * PI * 1.62, r = 12.2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 9) continue;
    K.box(x, z, 0.85, 0.85, 1.0, wood);
    const back = K.deco(new THREE.BoxGeometry(1.9, 2.6, 0.35), wood, x + Math.cos(a) * 0.85, 1.3, z + Math.sin(a) * 0.85, 0, -a + PI / 2);
    back.userData.passThrough = true;
    K.deco(new THREE.BoxGeometry(1.5, 0.18, 1.5), seat, x, 1.08, z, 0, -a);
  }
  // planters by the arcades and a founder at each side of the window wall
  for (const [x, z] of [[-24, -22], [24, -22], [-24, 14], [24, 14]]) planter(K, x, z, pal, R, 0.9);
}

/* ---------------- THE TRAINING WING ---------------- */
function training(L, K, pal, R){
  const stone = std(pal.stone ?? 0xd6cfbe), stoneD = std(pal.stoneD ?? 0xa89f8c), trim = std(pal.trim ?? 0xd8b860, 0.45, 0.55);
  const wood = std(pal.wood ?? 0x7a5230, 0.8), woodD = std(pal.woodD ?? 0x52361e, 0.85);
  const s = buildSanctum({ style: 'temple', seed: 73, wallH: 28, rise: 15, bay: 9, gallery: [11], windowW: 2.6,
    doors: ['w'], sigilSide: 'e', doorW: 8, doorH: 10, doorArch: true,
    arcade: ['n', 's'], arcadeTop: 20, statueH: 8, light: [30, 42, 14], shaftOp: 0.13, shaftColor: 0xfff0d0,
    stone: 0xd6cfbe, stoneD: 0xb0a794, rib: 0xe2dccc, roof: 0xbcb4a2, coffer: 0x9a9282, trim: 0xd8b860, cloth: 0x8a3a24,
    door: 0xffe8c0, vaultGlow: 0.45 });
  const H = shared.arenaHalf;
  for (const side of ['n', 's']) terrace(side, s.off, H * 2, stoneD, trim);
  // three SPARRING RINGS: a sanded mat each, a gold edge, under its station
  const mat = std(pal.mat ?? 0xa8946f, 0.95), matHi = glowM(pal.trim ?? 0xd8b860, 0.6);
  for (const [x, z, r] of [[-6, -18, 7.5], [14, 0, 10], [-6, 18, 7.5]]){
    live(K.deco(new THREE.CircleGeometry(r, 48), mat, x, 0.03, z, -PI / 2)).receiveShadow = true;
    live(K.deco(new THREE.RingGeometry(r, r + 0.3, 48), matHi, x, 0.04, z, -PI / 2));
  }
  // REMOTES hovering over the sparring hall's ring, turning
  for (let i = 0; i < 4; i++){
    const a = i / 4 * PI * 2, m = live(K.deco(new THREE.SphereGeometry(0.45, 12, 8), std(0x3a3e44, 0.4, 0.6), 14 + Math.cos(a) * 5, 3.4, Math.sin(a) * 5));
    const eye = live(new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), glowM(0xff4a3a))); eye.position.set(0, 0, 0.42); m.add(eye);
    anim(m, (o, t, b) => { const k = t * 0.5 + i; o.position.set(14 + Math.cos(k) * 5, b.y + Math.sin(t * 1.4 + i) * 0.4, Math.sin(k) * 5); o.lookAt(14, 1.8, 0); });
  }
  // PRACTICE POSTS in two rows: wooden pylons to cut at, padded
  for (const z of [-30, 30]) for (let x = -18; x <= 24; x += 7){
    K.column(x, z, 0.45, 2.4, wood, { seg: 8, taper: 1 });
    K.deco(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 8), std(0x6a5a40, 0.95), x, 1.6, z);
  }
  // the CLIMBING TOWER: one gantry of stone tiers in the far corner, the parkour climb
  K.gantry(24, -22, { a: stoneD, b: stone, strut: woodD, beacon: pal.kyber ?? 0x5ad2ff }, [1, -1]);
  // weapon racks of training sabers along the east wall
  for (const z of [-12, 12]){
    K.box(32, z, 0.5, 3, 1.6, woodD);
    for (let k = -2; k <= 2; k++) live(K.deco(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6), glowM(k % 2 ? 0x5ad2ff : 0x7aff6a), 32 - 0.3, 2.3, z + k * 1.1, 0.25));
  }
  for (const [x, z] of [[-26, -26], [-26, 26]]) planter(K, x, z, pal, R, 0.8);
}

/* ---------------- THE ARCHIVES ---------------- */
function archives(L, K, pal, R){
  const stone = std(pal.stone ?? 0xd6cfbe), stoneD = std(0x8a8270), trim = std(pal.trim ?? 0xd8b860, 0.45, 0.55), dark = std(0x3a2e24, 0.9);
  buildSanctum({ style: 'archive', seed: 63, wallH: 32, rise: 16, bay: 8, gallery: [11, 21], windowY0: 23.5,
    doors: ['e'], sigilSide: 'w', doorW: 7, doorH: 10, doorArch: true, light: [-14, 46, 20],
    hole: (x, z) => Math.hypot(x, z) < 6, holeShafts: [[0, 0, 4]], holeOp: 0.18, shaftOp: 0.16, shaftColor: 0xd8ecff,
    stone: 0xc4bcaa, stoneD: 0x8a8270, rib: 0xd0c8b6, roof: 0x6e675a, coffer: 0x5a5448, trim: 0xd8b860, cloth: 0x2e4a6a,
    glass: 0xd8ecff, door: 0xffe8c0, cardTint: 0xd8f0ff, vaultGlow: 0.4 });
  // the STACKS: long double-faced shelves in aisles on either side of the reading floor, a gap down every row
  const shelves = shelfFaces();
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++){
    const z = side * (8 + k * 6.5);
    for (const [x0, x1] of [[-30, -10], [6, 22]]){
      const cx = (x0 + x1) / 2, hx = (x1 - x0) / 2, h = 7.5;
      K.box(cx, z, hx, 0.7, h, dark);
      K.deco(new THREE.BoxGeometry(hx * 2 + 0.3, 0.3, 1.7), trim, cx, h + 0.15, z);
      shelves.add(hx * 2 - 0.4, h - 1, cx, h / 2, z + 0.72, 0);
      shelves.add(hx * 2 - 0.4, h - 1, cx, h / 2, z - 0.72, PI);
    }
  }
  shelves.done(0xd8f0ff);
  // the READING FLOOR: a round desk with the terminal's hologram over it, and the busts of the old masters round it
  roundStep(K, 0, 0, 5.5, 0.35, stoneD, 40);
  K.column(0, 0, 2.2, 1.15, std(0x5a4a3a, 0.8), { wallKick: false, seg: 24, taper: 1 });
  K.deco(new THREE.CylinderGeometry(2.35, 2.35, 0.12, 24), trim, 0, 1.2, 0);
  const holo = new THREE.Group(); holo.position.set(0, 3.2, 0); shared.arenaGroup.add(holo);
  { const hm = holoM(pal.kyber ?? 0x5ad2ff, 0.4);
    for (let i = 0; i < 3; i++){ const t = live(new THREE.Mesh(new THREE.TorusGeometry(1.1 + i * 0.35, 0.03, 4, 48), hm)); t.rotation.x = PI / 2 + i * 0.5; t.rotation.y = i * 0.8; holo.add(t); }
    const c = live(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), holoM(0xffffff, 0.5))); holo.add(c); }
  spinner(holo, 0.4);
  for (let i = 0; i < 6; i++){
    const a = i / 6 * PI * 2 + PI / 6, x = Math.cos(a) * 8, z = Math.sin(a) * 8;
    if (Math.abs(z) < 2 && x > 0) continue;   // (the way in from the door stays clear)
    K.box(x, z, 0.5, 0.5, 1.5, stoneD);
    K.deco(new THREE.CylinderGeometry(0.34, 0.55, 0.6, 8), stone, x, 1.8, z);
    K.deco(new THREE.SphereGeometry(0.34, 10, 8), stone, x, 2.4, z);
  }
  // the HOLOCRON and the MISSION RECORDS: a lit pedestal each at the far end of the reading floor
  for (const z of [-4.5, 4.5]){
    K.column(-22, z, 0.8, 1.2, stoneD, { wallKick: false, seg: 10, taper: 0.85 });
    const cube = live(K.deco(new THREE.BoxGeometry(0.7, 0.7, 0.7), glowM(z < 0 ? 0x7ad8ff : 0xffd27a), -22, 2.2, z, PI / 4, 0, PI / 4));
    anim(cube, (o, t, b) => { o.rotation.y = t * 0.8; o.position.y = b.y + Math.sin(t * 1.3) * 0.1; });
  }
}

/* ---------------- THE SABER FORGE ---------------- */
function forge(L, K, pal, R){
  const H = shared.arenaHalf, g = shared.arenaGroup;
  const rock = [std(pal.rock ?? 0x3a3a46, 1), std(pal.rockD ?? 0x2a2a34, 1), std(0x46445a, 1)];
  const crystal = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 });
  const kyber = [crystal(0x5ad2ff), crystal(0x7aff8a), crystal(0xa07aff), crystal(0x5ad2ff)];
  const pic = (m) => { m.userData.passThrough = true; m.castShadow = false; return m; };
  // the CAVE: a ring of rough rock walls past the edge, leaning in, and a dome of rock over all of it
  for (let i = 0; i < 26; i++){
    const a = i / 26 * PI * 2 + R() * 0.1, r = H + 5 + R() * 3, x = Math.cos(a) * r * 1.15, z = Math.sin(a) * r * 1.15;
    if (Math.abs(Math.atan2(z, x) + PI / 2) < 0.22) continue;   // the way back up to the hall, north
    const h = 22 + R() * 14;
    pic(K.deco(new THREE.DodecahedronGeometry(1, 0), rock[i % 3], x, h * 0.4, z, R(), R(), R())).scale.set(7 + R() * 4, h, 6 + R() * 3);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(H * 1.7, 24, 12, 0, PI * 2, 0, PI / 2), std(0x1c1c26, 1));
  dome.material.side = THREE.BackSide; dome.scale.y = 0.62; dome.position.y = -1; pic(dome); dome.castShadow = false; dome.receiveShadow = false; g.add(dome);
  // the way up: a carved arch in the north rock, warm daylight on the stair beyond
  const dz = -(H + 3);
  K.deco(new THREE.BoxGeometry(2, 14, 3), std(pal.stoneD ?? 0xa89f8c), -6, 7, dz);
  K.deco(new THREE.BoxGeometry(2, 14, 3), std(pal.stoneD ?? 0xa89f8c), 6, 7, dz);
  K.deco(new THREE.BoxGeometry(14, 2.4, 3), std(pal.trim ?? 0xd8b860, 0.45, 0.55), 0, 14.6, dz);
  pic(K.deco(new THREE.PlaneGeometry(10, 13.6), new THREE.MeshBasicMaterial({ color: 0x9a8a68, fog: false }), 0, 6.8, dz - 1.2));
  for (let k = 0; k < 5; k++) pic(K.deco(new THREE.BoxGeometry(10, 0.5, 1.4), std(pal.stone ?? 0xd6cfbe), 0, 0.25 + k * 0.5, dz + 1.2 - k * 1.3));
  // KYBER: clusters of glowing crystals growing out of the walls and the floor's edge, a few lighting up the floor round them
  for (let i = 0; i < 34; i++){
    const a = R() * PI * 2, r = H - 1 + R() * 6, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(Math.atan2(z, x) + PI / 2) < 0.3) continue;
    const m = kyber[i % kyber.length], n = 2 + Math.floor(R() * 4), y = R() < 0.6 ? 0 : 2 + R() * 14;
    for (let k = 0; k < n; k++){
      const h = 1.4 + R() * 3.2, c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), m);
      c.scale.set(0.35 + R() * 0.3, h, 0.35 + R() * 0.3);
      c.position.set(x + (R() - 0.5) * 1.6, y + h * 0.7, z + (R() - 0.5) * 1.6);
      c.rotation.set((R() - 0.5) * 0.9, R() * PI, (R() - 0.5) * 0.9);
      pic(c); g.add(c);
    }
  }
  // the floor's own crystals: a few clusters in the play space, solid (stand behind them, hop over the low ones)
  for (const [x, z, h] of [[-14, -6, 2.4], [15, -8, 3.2], [-16, 12, 1.8], [17, 14, 2.6]]){
    K.column(x, z, 1.1, h, std(pal.rockD ?? 0x2a2a34, 1), { wallKick: false, seg: 7, taper: 0.7 });
    for (let k = 0; k < 4; k++){
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), kyber[k]); c.scale.set(0.3, 1 + R(), 0.3);
      c.position.set(x + (R() - 0.5) * 1.2, h + 0.6, z + (R() - 0.5) * 1.2); c.rotation.set((R() - 0.5) * 0.7, R() * 3, (R() - 0.5) * 0.7);
      pic(c); g.add(c);
    }
  }
  // the MEDITATION CIRCLE and the FORGE BENCH on it: a stone slab, a crystal held in the air over it, hilt parts orbiting
  roundStep(K, 0, 6, 8, 0.35, std(pal.stoneD ?? 0xa89f8c), 40);
  live(K.deco(new THREE.RingGeometry(6.6, 7.0, 48), glowM(pal.kyber ?? 0x5ad2ff, 0.6), 0, 0.37, 6, -PI / 2));
  K.box(0, 6, 1.9, 1.0, 1.05, std(pal.stone ?? 0xd6cfbe));
  K.deco(new THREE.BoxGeometry(4.0, 0.14, 2.2), std(pal.trim ?? 0xd8b860, 0.45, 0.55), 0, 1.12, 6);
  const heart = live(K.deco(new THREE.OctahedronGeometry(0.4, 0), glowM(0x8ae8ff), 0, 3.0, 6));
  anim(heart, (o, t, b) => { o.rotation.y = t * 1.2; o.position.y = b.y + Math.sin(t * 1.1) * 0.15; });
  const parts = new THREE.Group(); parts.position.set(0, 3.0, 6); g.add(parts);
  { const metal = std(0xb8bcc4, 0.35, 0.8), dk = std(0x2a2c30, 0.5, 0.6), gold = std(pal.trim ?? 0xd8b860, 0.4, 0.6);
    const bits = [[new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), metal], [new THREE.CylinderGeometry(0.13, 0.12, 0.3, 10), dk],
      [new THREE.CylinderGeometry(0.12, 0.14, 0.22, 10), gold], [new THREE.TorusGeometry(0.14, 0.03, 6, 14), gold], [new THREE.BoxGeometry(0.06, 0.16, 0.12), dk]];
    bits.forEach(([geo, m], i) => { const b = live(new THREE.Mesh(geo, m)); const a = i / bits.length * PI * 2; b.position.set(Math.cos(a) * 1.0, Math.sin(i * 1.7) * 0.2, Math.sin(a) * 1.0); b.rotation.z = 0.4 * i; parts.add(b); }); }
  anim(parts, (o, t) => { o.rotation.y = t * 0.35; });
  // light pools on the floor round the brightest clusters
  for (let i = 0; i < 6; i++){ const a = i / 6 * PI * 2 + 0.4, r = H - 3;
    live(K.deco(new THREE.CircleGeometry(4 + R() * 2, 24), holoM(i % 2 ? 0x5ad2ff : 0x7aff8a, 0.08), Math.cos(a) * r, 0.03, Math.sin(a) * r, -PI / 2)); }
}
