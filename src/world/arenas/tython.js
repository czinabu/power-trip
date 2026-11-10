// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HIDDEN TEMPLE ON TYTHON: the hub's six wings (data/hub.js). Each wing is its own arena build, so only the one you
// stand in is ever in memory. The halls are the sanctum (world/sanctum.js) at a far bigger scale and opened right up:
// tall open arcades onto Tython's mountains, an oculus in the Grand Hall's vault, daylight falling across the floor.
// The Saber Forge is the odd one out: a kyber cave under the temple. The Landing Platform is the other: no hall at all, a
// terrace out past the council chamber under the open sky, with the pilgrim shuttle to Jedha on its pad.
//
// Every station (data/hub.js `stations`) gets a lit ring on the floor and a sign over it; game/hub.js reads the same
// list for the prompts. Anything that moves (the map's hologram, the remotes, the forge's hilt parts) is flagged
// noBake and listed in shared.hubAnim for game/hub.js to turn.

import * as THREE from 'three';
import { shared } from '../../state.js';
import { arenaKit, seeded } from './kit.js';
import { buildSanctum, shelfFaces } from '../sanctum.js';
import { HUBS, SIDE_OUT, wingByLayout } from '../../data/hub.js';
import { PI, std, glowM, holoM, waterM, live, anim, spinner, roundStep, hubStations, hubDoorSigns } from './hub-kit.js';
import { templeFolk } from './tython-folk.js';
import { put, turned, radiusAt, seamRing, profile, plan, engine, leg, navLight } from './ship-kit.js';

/* the dispatcher: world/arena.js hands every ty* layout here */
export function buildTythonArena(L){
  shared.hubAnim = [];
  const wings = HUBS.temple.wings, found = wingByLayout(L.layout), wing = found && found.hub === 'temple' ? found.id : 'hall';
  const pal = L.pal || {}, K = arenaKit(), R = seeded(wing.length * 31 + 7), W = wings[wing];
  ({ hall, council, landing, training, archives, forge })[wing](L, K, pal, R);
  hubStations(W, K, { ring: pal.kyber ?? 0x5ad2ff, beacon: (x, z) => waystone(K, pal, x, z), stone: { stone: pal.stoneD ?? 0xa89f8c, trim: pal.trim ?? 0xd8b860, glow: pal.kyber ?? 0x5ad2ff } });
  hubDoorSigns(W, wings, K, { runner: pal.kyber ?? 0x5ad2ff });
  templeFolk(wing);   // the Jedi, younglings and archivists going about the temple (world/arenas/tython-folk.js)
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
    K.deco(new THREE.IcosahedronGeometry((2.2 + R() * 1.1) * big, 0), leaf[i % 2], x + Math.cos(a) * d, y, z + Math.sin(a) * d, R(), R(), R()).userData.passThrough = true;   // (the crown: leaves overhead, nothing to land on)
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
  { const wm = waterM(pal.water ?? 0x4fb4d4, { deep: 0x1d5c78, r0: 4.2, r1: 10.5 });
    const pool = live(K.deco(new THREE.RingGeometry(4.2, 10.5, 96, 4), wm, 0, 0.46, 0, -PI / 2));
    anim(pool, (o, t) => { wm.userData.water.uT.value = t; }); }
  K.column(0, 0, 1.3, 1.3, trim, { wallKick: false, seg: 12, taper: 0.8 });
  /* (art pass: the projector's cone and the map's white core were bright enough together, additive under the oculus
     light, that the bloom turned the whole map into one white blob. Fainter cone, a pale-blue core instead of white) */
  live(K.deco(new THREE.CylinderGeometry(1.9, 0.6, 3.5, 24, 1, true), holoM(pal.kyber ?? 0x5ad2ff, 0.07), 0, 3.1, 0));
  const map = new THREE.Group(); map.position.set(0, 5.6, 0); shared.arenaGroup.add(map);
  { const hm = holoM(pal.kyber ?? 0x5ad2ff, 0.42), hw = holoM(0x9fdcff, 0.26);
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
    doors: ['s', 'n'], sigilSide: null, doorW: 8, doorH: 12, doorArch: true,   // (north: out to the landing platform)
    arcade: ['e', 'w'], arcadeTop: 24, statueH: 9, light: [10, 40, -30],
    hole: (x, z) => Math.hypot(x, z) < 7, holeShafts: [[0, 0, 5]], holeOp: 0.16, shaftOp: 0.12, shaftColor: 0xfff0d0,
    stone: 0xd6cfbe, stoneD: 0xb0a794, rib: 0xe2dccc, roof: 0xbcb4a2, coffer: 0x9a9282, trim: 0xd8b860, cloth: 0x2e6a8a,
    door: 0xffe8c0, vaultGlow: 0.45 });
  const H = shared.arenaHalf;
  for (const side of ['e', 'w']) terrace(side, s.off, H * 2, stoneD, trim);
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

/* ---------------- THE LANDING PLATFORM ---------------- */
// out past the council chamber: a stone terrace under the sky, open to the valley on three sides, the temple's wall and
// its great door behind you (south). The pilgrim SHUTTLE stands on a pad in the middle, nose to the valley, its ramp down
// toward you: its station (data/hub.js) is at the foot of the ramp. Everything you can walk into is solid.
function landing(L, K, pal, R){
  const H = shared.arenaHalf, g = shared.arenaGroup;
  const stone = std(pal.stone ?? 0xd6cfbe), stoneD = std(pal.stoneD ?? 0xa89f8c), trim = std(pal.trim ?? 0xd8b860, 0.45, 0.55);
  const pic = (m) => { m.userData.passThrough = true; return m; };
  // the TEMPLE behind: a tall wall across the south edge, pilasters, a gold band, and the great door back to the council
  const wz = H + 1.5, doorW = 9, doorH = 13, wallH = 22;
  for (const sx of [-1, 1]){
    const w = H + 6 - doorW / 2;
    pic(K.deco(new THREE.BoxGeometry(w, wallH, 3), stone, sx * (doorW / 2 + w / 2), wallH / 2, wz));
    for (let a = doorW / 2 + 5; a < H + 4; a += 9) pic(K.deco(new THREE.BoxGeometry(1.6, wallH, 0.9), stoneD, sx * a, wallH / 2, wz - 1.8));
  }
  pic(K.deco(new THREE.BoxGeometry(doorW + 0.2, wallH - doorH, 3), stone, 0, doorH + (wallH - doorH) / 2, wz));
  pic(K.deco(new THREE.BoxGeometry((H + 6) * 2, 0.6, 3.4), trim, 0, wallH - 3, wz - 0.2));
  pic(K.deco(new THREE.BoxGeometry((H + 6) * 2, 1.2, 3.6), stoneD, 0, wallH, wz - 0.2));
  pic(K.deco(new THREE.TorusGeometry(doorW / 2, 0.5, 8, 24, PI), trim, 0, doorH - doorW / 2 + 0.2, wz - 1.6));
  pic(K.deco(new THREE.PlaneGeometry(doorW, doorH), new THREE.MeshBasicMaterial({ color: 0xffe8c0, fog: false }), 0, doorH / 2, wz + 1.4));   // the warm hall beyond
  // the TERRACES: the ledge and balustrade past the three open edges, and the valley beyond (the theme's backdrop)
  for (const side of ['n', 'e', 'w']) terrace(side, H - 1, H * 2 + 8, stoneD, trim);
  // the PAD: a wide round step, a gold lip, a lit ring and the guide marks to set down on
  const pz = -8;
  roundStep(K, 0, pz, 13, 0.35, stoneD, 64);
  K.deco(new THREE.TorusGeometry(13, 0.14, 8, 96), trim, 0, 0.35, pz, -PI / 2).userData.noOutline = true;
  live(K.deco(new THREE.RingGeometry(10.6, 11.1, 64), glowM(pal.kyber ?? 0x5ad2ff, 0.6), 0, 0.38, pz, -PI / 2));
  for (let i = 0; i < 8; i++){ const a = i / 8 * PI * 2;
    live(K.deco(new THREE.PlaneGeometry(0.5, 1.8), glowM(pal.trim ?? 0xd8b860, 0.8), Math.cos(a) * 12, 0.38, pz + Math.sin(a) * 12, -PI / 2, 0, -a + PI / 2)); }
  shuttle(K, pal, 0, pz - 1, 0.35);
  // LAMPS on posts round the pad's edge, and cargo by it (crates you can climb)
  for (const [x, z] of [[-17, -18], [17, -18], [-17, 4], [17, 4]]){
    K.column(x, z, 0.22, 4.2, std(0x6a6e74, 0.5, 0.5), { wallKick: false, seg: 8, taper: 1 });
    K.deco(new THREE.BoxGeometry(0.6, 0.3, 0.6), trim, x, 4.3, z);
    live(K.deco(new THREE.BoxGeometry(0.42, 0.5, 0.42), glowM(0xffe2a8), x, 4.7, z));
  }
  const crate = std(pal.wood ?? 0x7a5230, 0.85), band = std(pal.bronze ?? 0x9a7440, 0.5, 0.5);
  for (const [x, z, n] of [[-22, -4, 2], [-20, 8, 1], [22, -2, 3], [24, 10, 1]]){
    for (let k = 0; k < n; k++){
      const cx = x + (k === 1 ? 1.5 : 0), cz = z + (k === 2 ? 1.5 : 0), y = k === 2 ? 0 : 0;
      K.box(cx, cz, 0.7, 0.7, 1.4, crate, { y, climbable: false });
      K.deco(new THREE.BoxGeometry(1.46, 0.12, 1.46), band, cx, y + 1.1, cz);
    }
  }
  // the PILGRIMS' BANNERS on the temple wall either side of the door: the Order's blue, and Jedha's sand-gold
  for (const sx of [-1, 1]) K.banner(sx * 10, 18, wz - 1.6, 0, 2.6, 10, sx < 0 ? (pal.cloth ?? 0x2e6a8a) : 0xb8873a, pal.trim ?? 0xd8b860, 0xffe0a0);
  // planters at the terrace corners
  for (const [x, z] of [[-26, -26], [26, -26]]) planter(K, x, z, pal, R, 0.8);
  void g;
}
// a collider's mesh taken away, its collision kept (the bake would draw a hidden mesh)
const unseen = (m) => { if (m && m.parent) m.parent.remove(m); return m; };
/* the PILGRIM SHUTTLE: a long pale hull turned like a seed, a glazed cockpit over the nose, swept wings with a fin at
   each tip, a tall fin over the tail, two engines slung either side of the ramp and glowing while it idles, and three
   legs. The ramp is down at the rear (south, +z), the hold lit. At (x, z) on a floor at `y0`; its nose points north.
   Built from the ship kit (world/arenas/ship-kit.js); its collision is a few plain boxes and columns round the hull */
function shuttle(K, pal, x, z, y0 = 0){
  const hull = std(0xebe5d6, 0.5, 0.2), hullD = std(0xb4ad9c, 0.55, 0.3), panel = std(0xd8d1c0, 0.55, 0.2), metal = std(0x6a6e74, 0.4, 0.65);
  const dark = std(0x2a2d32, 0.6, 0.4), chrome = std(0xc8ccd2, 0.25, 0.9), seam = std(0x8a8476, 0.7, 0.2);
  const stripe = std(pal.cloth ?? 0x2e6a8a, 0.55, 0.15), gold = std(pal.trim ?? 0xd8b860, 0.35, 0.65);
  stripe.side = THREE.DoubleSide; gold.side = THREE.DoubleSide;
  const glass = new THREE.MeshStandardMaterial({ color: 0x14222e, roughness: 0.08, metalness: 0.8, emissive: 0x0a2a3a, emissiveIntensity: 0.5 });
  const gy = y0 + 1.3;   // the hull's belly, up on its gear
  const g = new THREE.Group(); g.position.set(x, 0, z); g.userData.passThrough = true; shared.arenaGroup.add(g);   // (a picture: its collision is below)
  const m = { body: hull, trim: gold, dark, chrome };
  // the FUSELAGE: turned, an oval a little flatter than it is wide, cut off square at the tail where the ramp drops
  const prof = [[-9.9, 0.04], [-9.5, 0.55], [-8.7, 1.15], [-7.3, 1.75], [-5.6, 2.15], [-3.5, 2.45], [0, 2.6], [3.5, 2.55], [5.3, 2.3], [6.0, 2.0], [6.02, 0.04]];
  const SX = 1, SY = 0.66, cy = gy + 2.6 * SY;
  put(g, turned(prof, SX, SY, 32), hull, 0, cy, 0);
  put(g, new THREE.BoxGeometry(2.6, 0.3, 11), hullD, 0, gy + 0.18, -0.4);   // the keel along the belly
  // the Order's colours: a band round the nose, a stripe down each flank with a gold line over it
  { const band = put(g, turned([[-8.3, radiusAt(prof, -8.3) + 0.03], [-7.6, radiusAt(prof, -7.6) + 0.03]], SX, SY, 32), stripe, 0, cy, 0); band.userData.noOutline = true; }
  for (const sx of [-1, 1]){
    put(g, new THREE.BoxGeometry(0.08, 0.42, 8.6), stripe, sx * 2.6, cy - 0.15, 0.2);
    put(g, new THREE.BoxGeometry(0.08, 0.1, 8.6), gold, sx * 2.6, cy + 0.17, 0.2);
  }
  // panel seams round the hull, and a row of hatches down the spine
  for (const sz of [-6.4, -3.5, 1.2, 4.6]) seamRing(g, prof, sz, SX, SY, seam, cy, 0.035);
  for (const sz of [-1.6, 0.6, 2.8]) put(g, new THREE.BoxGeometry(1.1, 0.06, 1.4), panel, 0, cy + 2.6 * SY + 0.02, sz);
  // the COCKPIT: a long glazed canopy over the nose, framed, with a sensor blister ahead of it
  { const can = put(g, new THREE.SphereGeometry(1.35, 24, 14, 0, PI * 2, 0, PI / 2), glass, 0, cy + 0.82, -5.7); can.scale.set(1.0, 0.62, 1.9); can.userData.noOutline = true;
    put(g, new THREE.BoxGeometry(0.12, 0.12, 4.6), metal, 0, cy + 1.66, -5.7, 0.04);
    for (const fz of [-6.9, -5.7, -4.5]){ const k = 1 - Math.pow((fz + 5.7) / 2.6, 2); const r = put(g, new THREE.TorusGeometry(1.35 * Math.sqrt(k), 0.06, 4, 20, PI), metal, 0, cy + 0.82, fz); r.scale.set(1, 0.62, 1); }
    put(g, new THREE.SphereGeometry(0.32, 12, 8), chrome, 0, cy - 0.5, -9.0); }
  // the SPINE over the hold, rising into the FIN over the tail (the Order's stripe up its edge)
  put(g, profile([[-3.4, 0], [-1.6, 0.45], [4.2, 0.62], [6.0, 0.3], [6.0, 0]], 1.3, 0.3), hullD, 0, cy + 2.6 * SY - 0.25, 0);
  put(g, profile([[2.4, 0], [5.1, 3.3], [6.4, 3.3], [6.2, 0]], 0.34, 0.1), hull, 0, cy + 2.6 * SY + 0.1, 0);
  put(g, profile([[4.85, 2.9], [5.1, 3.3], [6.4, 3.3], [6.35, 2.9]], 0.38, 0.06), stripe, 0, cy + 2.6 * SY + 0.1, 0);
  live(navLight(g, 0xff5a40, 0, cy + 2.6 * SY + 3.5, 5.8, 0.1));
  // the WINGS: swept back from the hull's middle, a little drooped, a fin and a running light at each tip
  for (const sx of [-1, 1]){
    const w = new THREE.Group(); w.position.set(0, gy + 1.05, 0); w.rotation.z = sx * -0.05; g.add(w);
    const P = [[2.0, -1.8], [8.7, 2.6], [9.0, 4.0], [2.0, 5.0]].map(([a, b]) => [a * sx, b]);
    put(w, plan(P, 0.38, 0.12), hullD, 0, 0, 0);
    put(w, plan([[3.0, -0.9], [8.5, 2.7], [8.62, 3.1], [3.0, -0.35]].map(([a, b]) => [a * sx, b]), 0.42, 0.06), stripe, 0, 0, 0);
    put(w, plan([[3.0, 2.0], [7.6, 3.5], [7.6, 4.25], [3.0, 4.4]].map(([a, b]) => [a * sx, b]), 0.4, 0.04), panel, 0, 0, 0);   // the flap
    put(w, profile([[2.5, 0], [3.5, 1.5], [4.3, 1.5], [4.25, 0]], 0.22, 0.06), hull, sx * 8.85, 0.1, 0);
    put(w, profile([[2.5, 0], [3.0, -0.6], [3.9, -0.6], [4.2, 0]], 0.2, 0.05), hull, sx * 8.85, -0.1, 0);
    const tip = live(navLight(w, sx < 0 ? 0xff5a40 : 0x5aff8a, sx * 8.95, 0.05, 2.5, 0.16));
    anim(tip, (o, t) => { o.visible = Math.sin(t * 3 + sx) > -0.2; });
  }
  // two ENGINES slung either side of the ramp on short pylons, their glow breathing while it idles
  for (const sx of [-1, 1]){
    const e = engine(m, { r: 1.0, len: 4.0, glowCol: 0x8ad8ff, ring: metal }); e.group.position.set(sx * 3.05, gy + 1.15, 4.4); g.add(e.group);
    live(e.glow); anim(e.glow, (o, t) => { o.material.opacity = 0.6 + Math.sin(t * 2.2 + sx) * 0.2; });
    put(g, new THREE.BoxGeometry(1.0, 0.5, 2.6), hullD, sx * 2.35, gy + 1.5, 4.0);
    put(g, new THREE.BoxGeometry(0.06, 0.3, 3.2), stripe, sx * 4.07, gy + 1.15, 4.0);
  }
  // the GEAR: a nose leg and two mains, each with its oleo and a brace up to the hull
  for (const [lx, lz, bz] of [[0, -5.6, -0.8], [-1.9, 2.4, 0.8], [1.9, 2.4, 0.8]]){
    const l = leg(m, gy - y0 + 0.25, { r: 0.15, pad: 0.5, brace: bz }); l.position.set(lx, y0, lz); g.add(l);
  }
  // the RAMP down from the hold at the tail, side rails and its two rams, lit from inside
  const rz0 = 6.0, rz1 = 9.8, rl = Math.hypot(rz1 - rz0, gy - y0), ang = Math.atan2(gy - y0, rz1 - rz0);
  put(g, new THREE.BoxGeometry(2.4, 0.18, rl), hullD, 0, (gy + y0) / 2, (rz0 + rz1) / 2, ang);
  for (let k = 1; k < 6; k++){ const f = k / 6; put(g, new THREE.BoxGeometry(2.2, 0.05, 0.1), metal, 0, gy - (gy - y0) * f + 0.12, rz0 + (rz1 - rz0) * f, ang); }
  for (const sx of [-1, 1]){
    put(g, new THREE.BoxGeometry(0.12, 0.5, rl), hullD, sx * 1.22, (gy + y0) / 2 + 0.2, (rz0 + rz1) / 2, ang);
    live(put(g, new THREE.BoxGeometry(0.06, 0.06, rl), glowM(0x8ad8ff, 0.9), sx * 1.15, (gy + y0) / 2 + 0.47, (rz0 + rz1) / 2, ang));
    put(g, new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), chrome, sx * 0.9, gy + 0.2, rz0 + 0.8, 0.9);
  }
  live(put(g, new THREE.PlaneGeometry(2.3, 2.1), glowM(0xfff0d0, 0.92), 0, gy + 1.15, rz0 + 0.04));   // the lit hold
  put(g, new THREE.BoxGeometry(2.7, 0.18, 0.2), metal, 0, gy + 2.25, rz0 + 0.06);
  // COLLISION: the hull solid from the floor up (you walk round it, not under), the nose, the wings overhead slabs, the
  // engines' columns, and two low hidden steps up the ramp
  K.slab(x, z - 0.2, 2.6, 6.0, 0, gy + 3.4);
  K.slab(x, z - 7.6, 1.6, 1.8, 0, gy + 2.6);
  for (const sx of [-1, 1]){
    K.slab(x + sx * 5.6, z + 1.8, 3.2, 1.8, gy + 0.8, gy + 1.5);
    unseen(K.column(x + sx * 3.05, z + 4.4, 1.1, gy + 2.2, metal, { wallKick: false, seg: 10, taper: 1 }));
  }
  unseen(K.box(x, z + 8.7, 1.2, 1.0, 0.4, hullD, { y: y0, climbable: true }));
  unseen(K.box(x, z + 7.0, 1.2, 0.8, 0.85, hullD, { y: y0, climbable: true }));
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
  // DUEL MODE (game/duel-mode.js, data/duel-mode.js): the sparring hall's ring is the duel ring. Its marker stone on the
  // north edge, the SPECTATORS' BALCONY on the south (two steps up to a stone deck facing the ring), and the TROPHY CASE
  // in the corner where the duel honours are kept
  K.box(14, -12.7, 0.7, 0.35, 1.1, stoneD);
  K.deco(new THREE.BoxGeometry(1.6, 0.12, 0.9), trim, 14, 1.16, -12.7);
  live(K.deco(new THREE.RingGeometry(0.22, 0.3, 24), glowM(0xffb84a, 0.8), 14, 1.24, -12.7, -PI / 2));
  K.box(15, 13.2, 2, 0.8, 0.8, stoneD, { climbable: true });
  K.box(15, 14.7, 2, 0.7, 1.6, stoneD, { climbable: true });
  K.box(15, 16.9, 6, 1.5, 2.4, stone, { climbable: true });
  K.deco(new THREE.BoxGeometry(12.2, 0.16, 0.3), trim, 15, 2.46, 15.45);
  for (const x of [9.4, 20.6]) K.column(x, 17.9, 0.22, 3.6, stoneD, { seg: 8, taper: 1 });
  K.box(26.4, 16.6, 0.7, 1.6, 2.2, woodD);
  for (let k = -1; k <= 1; k++){
    K.deco(new THREE.CylinderGeometry(0.16, 0.08, 0.34, 10), trim, 26.4, 2.42, 16.6 + k * 0.9);
    K.deco(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), trim, 26.4, 2.29 + 0.0, 16.6 + k * 0.9);
  }
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
