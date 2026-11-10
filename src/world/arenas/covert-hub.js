// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HIDDEN COVERT: the Mando's hub, its five wings (data/hub-covert.js). Like the temple on Tython (tython.js), each wing
// is its own arena build, so only the one you stand in is ever in memory. The halls are hewn into dark rock under a
// ruined city: rough walls banded with beskar, braziers at the foot of every pier, clan banners, and the warm light of
// the forge on everything. The Great Forge is the grand centrepiece: a furnace two storeys high under a shaft in the
// roof, a ring of molten beskar running round it under a grate, crucibles on chains, two colossal armoured founders.
//
// Every station gets an amber ring on the floor and a sign over it (the temple's are kyber blue); game/hub.js reads the
// same list for the prompts. Anything that moves (holograms, the crucibles' pour, the forge's glow) is flagged noBake and
// listed in shared.hubAnim for game/hub.js to turn. Everything past the play square is a picture: no collision.

import * as THREE from 'three';
import { shared, solids } from '../../state.js';
import { arenaKit, seeded } from './kit.js';
import { PI, std, glowM, holoM, live, anim, spinner, roundStep, hubStations, hubDoorSigns } from './hub-kit.js';
import { toon, inkify } from '../ink.js';
import { leg, navLight } from './ship-kit.js';
import { COVERT_WINGS } from '../../data/hub-covert.js';
import { SIDE_OUT } from '../../data/hub.js';
import { growWing } from './growth-kit.js';
import { buildGrowth } from '../../game/hub-growth.js';
import { templeFolk } from './tython-folk.js';

const pic = (m) => { m.userData.passThrough = true; m.castShadow = false; return m; };   // past the edge: a picture, baked
const AMBER = 0xffb35a;

/* the dispatcher: world/arena.js hands every mf* layout here */
export function buildCovertHubArena(L){
  shared.hubAnim = [];
  const wing = Object.keys(COVERT_WINGS).find(k => COVERT_WINGS[k].level.layout === L.layout) || 'forge';
  const pal = L.pal || {}, K = arenaKit(), R = seeded(wing.length * 37 + 11);
  const M = mats(pal);
  const st = buildGrowth('covert');   // how far the covert has grown (game/hub-growth.js): the host's, in a party
  ({ forge, clan, pit, vault, hangar })[wing](L, K, pal, R, M);
  // a hall still to be restored: its fires low and its rubble; the trophy vault: its trophies, banners and friends
  growWing(K, 'covert', wing, st, { stone: pal.stone ?? 0x6a5c52, stoneD: pal.stoneD ?? 0x4a4038, trim: pal.trim ?? 0xc89a4a, crate: pal.wood ?? 0x5a3e2a,
    wood: pal.wood ?? 0x5a3e2a, cloth: pal.cloth ?? 0x6a2620, ink: '#ffd8a0', edge: 'rgba(255,179,90,.85)', plate: 'rgba(26,18,14,.92)' });
  // every station's amber rings and sign (a covert map console at each fast-travel stop), the signs over the doors
  hubStations(COVERT_WINGS[wing], K, { ring: pal.ring ?? AMBER, stone: { stone: 0x4a4440, trim: 0x8a7a60, glow: pal.ring ?? AMBER }, tall: ['table', 'ship'], beacon: (x, z) => mapConsole(K, pal, x, z, wing === 'forge' ? 1 : 0.5) });
  hubDoorSigns(COVERT_WINGS[wing], COVERT_WINGS, K, { signY: 8.2, runner: pal.ring ?? AMBER });
  templeFolk(wing, 'covert', st);   // the foundlings and the clan, home as the covert grows (world/arenas/tython-folk.js)
}

function mats(pal){
  return {
    rock: std(pal.rock ?? 0x4a3e38, 1), rockD: std(pal.rockD ?? 0x342a26, 1), rockL: std(pal.rockL ?? 0x5e5048, 1),
    stone: std(pal.stone ?? 0x6a5c52, 0.95), stoneD: std(pal.stoneD ?? 0x4a4038, 0.95),
    beskar: std(pal.beskar ?? 0xb0b8c0, 0.32, 0.9), metal: std(pal.metal ?? 0x5a6068, 0.55, 0.7), metalD: std(pal.metalD ?? 0x30343a, 0.6, 0.6),
    brass: std(pal.trim ?? 0xc89a4a, 0.45, 0.6), wood: std(pal.wood ?? 0x5a3e2a, 0.85),
    molten: glowM(pal.molten ?? 0xff7a1e), hot: glowM(pal.hot ?? 0xffc060), fire: glowM(pal.fire ?? 0xff8a2a), ember: glowM(0xffd080),
    dark: new THREE.MeshBasicMaterial({ color: 0x0a0806 }),
    cloth: pal.cloth ?? 0x6a2620, clothD: pal.clothD ?? 0x2a2224,
  };
}

/* ---------------- the pieces every wing shares ---------------- */
/* a COVERT MAP console: a squat metal post with the covert's five wings turning over it in amber (fast travel) */
function mapConsole(K, pal, x, z, s = 1){
  const M = mats(pal);
  K.column(x, z, 0.6 + s * 0.6, 1.1, M.metalD, { wallKick: false, seg: 8, taper: 0.85 });
  K.deco(new THREE.CylinderGeometry(0.75 + s * 0.65, 0.75 + s * 0.65, 0.12, 8), M.brass, x, 1.14, z);
  const g = new THREE.Group(); g.position.set(x, 2.0 + s * 0.4, z); shared.arenaGroup.add(g);
  const hm = holoM(pal.ring ?? AMBER, 0.16 + s * 0.14), k = 0.35 + s * 0.45;
  const blk = (w, d, bx, bz, h = 0.18) => { const b = live(new THREE.Mesh(new THREE.BoxGeometry(w * k, h * k, d * k), hm)); b.position.set(bx * k, 0, bz * k); g.add(b); };
  blk(1.4, 1.4, 0, 0, 0.5); blk(0.9, 0.7, 0, -1.4); blk(0.7, 0.9, 1.4, 0); blk(0.7, 0.9, -1.4, 0); blk(0.9, 0.8, 0, 1.4);
  blk(0.12, 3.6, 0, 0, 0.04); blk(3.6, 0.12, 0, 0, 0.04);
  spinner(g, 0.3);
  return g;
}
/* a BRAZIER: an iron bowl on three legs, the fire in it live (it flickers) */
function brazier(K, M, x, z, h = 1.6, solid = true){
  if (solid) K.column(x, z, 0.35, h - 0.3, M.metalD, { wallKick: false, seg: 6, taper: 0.7 });
  else K.deco(new THREE.CylinderGeometry(0.18, 0.3, h - 0.3, 6), M.metalD, x, (h - 0.3) / 2, z);
  K.deco(new THREE.CylinderGeometry(0.75, 0.42, 0.45, 10), M.metal, x, h - 0.1, z);
  K.deco(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 10), M.hot, x, h + 0.1, z).userData.noBake = true;
  for (let n = 0; n < 3; n++){
    const f = live(K.deco(new THREE.ConeGeometry(0.28, 0.9 - n * 0.15, 7), n % 2 ? M.ember : M.fire, x + (n - 1) * 0.22, h + 0.5, z + (n === 1 ? 0.15 : -0.1)));
    anim(f, (o, t, b) => { const k = 0.85 + Math.sin(t * (7 + n * 2.3) + x) * 0.15; o.scale.set(1, k, 1); o.position.y = b.y + (k - 1) * 0.4; });
  }
}
/* a CLAN BANNER hung from a bar: rust cloth, a brass hem, the clan's mark (a ring round a spear point) in gold */
function clanBanner(K, M, x, y, z, ry, w, h){
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; shared.arenaGroup.add(grp);
  const add = (geo, mat, px, py, pz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.userData.passThrough = true; m.castShadow = false; grp.add(m); return m; };
  const cloth = new THREE.MeshStandardMaterial({ color: M.cloth, roughness: 0.9, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: M.clothD, roughness: 0.9, side: THREE.DoubleSide });
  const gold = new THREE.MeshBasicMaterial({ color: 0xe0b060, side: THREE.DoubleSide });
  add(new THREE.PlaneGeometry(w, h), cloth, 0, 0);
  add(new THREE.PlaneGeometry(w * 0.22, h), dark, -w * 0.39, 0, 0.005); add(new THREE.PlaneGeometry(w * 0.22, h), dark, w * 0.39, 0, 0.005);
  add(new THREE.BoxGeometry(w + 0.5, 0.18, 0.18), M.metalD, 0, h / 2);
  add(new THREE.PlaneGeometry(w, h * 0.05), gold, 0, -h * 0.47, 0.01);
  // a notched tail
  const tail = new THREE.Shape(); tail.moveTo(-w / 2, 0); tail.lineTo(w / 2, 0); tail.lineTo(w / 2, -h * 0.12); tail.lineTo(0, -h * 0.04); tail.lineTo(-w / 2, -h * 0.12);
  add(new THREE.ShapeGeometry(tail), cloth, 0, -h / 2);
  // the mark: a ring, a spear point through it
  add(new THREE.RingGeometry(w * 0.2, w * 0.26, 24), gold, 0, h * 0.18, 0.012);
  const sp = new THREE.Shape(); sp.moveTo(0, w * 0.42); sp.lineTo(w * 0.09, w * 0.1); sp.lineTo(w * 0.03, w * 0.08); sp.lineTo(w * 0.03, -w * 0.36); sp.lineTo(-w * 0.03, -w * 0.36); sp.lineTo(-w * 0.03, w * 0.08); sp.lineTo(-w * 0.09, w * 0.1);
  add(new THREE.ShapeGeometry(sp), gold, 0, h * 0.18, 0.014);
  return grp;
}
/* a light SHAFT falling from `from` to `to`: an additive box, bright at the top and gone by the floor (only a picture) */
function shaft(from, to, w, color, op){
  const dir = new THREE.Vector3().subVectors(to, from), len = dir.length();
  const geo = new THREE.BoxGeometry(w, len, w * 0.8, 1, 4, 1), pos = geo.attributes.position, col = [], c = new THREE.Color(color);
  for (let i = 0; i < pos.count; i++){ const f = Math.pow(Math.min(1, Math.max(0, 0.5 + pos.getY(i) / len)), 1.6) * op; col.push(c.r * f, c.g * f, c.b * f); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  geo.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  const m = live(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
  m.renderOrder = 3; shared.arenaGroup.add(m); return m;
}

/* the ROOM: hewn rock walls just past the play square, a pier banded in beskar every `bay` with a brazier at its foot,
   the great doors cut where the wing has them (a beskar frame, the leaves slid back, the hall beyond lit), and a rock
   roof at `wallH` with an opening (`hole`: [x, z, half-width, half-depth]) where light falls in. All of it a picture. */
function room(K, M, R, wing, o = {}){
  const H = shared.arenaHalf, off = H + 2.5, Wh = o.wallH ?? 20, bay = o.bay ?? 10, len = off * 2 + 6;
  const W = COVERT_WINGS[wing], doorSides = Object.keys(W.doors), dw = o.doorW ?? 10, dh = o.doorH ?? 11;
  const SIDES = { n: 0, s: PI, e: -PI / 2, w: PI / 2 };
  const put = (side, geo, mat, a, y, d, rx = 0, ry = 0, rz = 0) => {
    const th = SIDES[side], nx = Math.sin(th), nz = Math.cos(th);
    const m = K.deco(geo, mat, -nx * d + Math.cos(th) * a, y, -nz * d - Math.sin(th) * a);
    m.rotation.set(rx, th + ry, rz, 'YXZ'); return pic(m);
  };
  const strata = [M.rockD, M.rock, M.rockD, M.rockL];
  for (const side of ['n', 's', 'e', 'w']){
    const door = doorSides.includes(side) && !(o.open || []).includes(side);
    // the wall in bands of strata, cut for the door
    let y = 0, b = 0;
    while (y < Wh){
      const h = Math.min(Wh - y, 2.5 + R() * 3.5), m = strata[b++ % strata.length];
      if (door && y < dh){
        const seg = (len - dw) / 2;
        put(side, new THREE.BoxGeometry(seg, h, 3), m, -(dw + seg) / 2, y + h / 2, off + 1.5);
        put(side, new THREE.BoxGeometry(seg, h, 3), m, (dw + seg) / 2, y + h / 2, off + 1.5);
      } else put(side, new THREE.BoxGeometry(len, h, 3), m, 0, y + h / 2, off + 1.5);
      y += h;
    }
    // rough rock heaped at the foot of the wall, and chunks standing proud of it
    for (let a = -off; a < off; a += 3 + R() * 3){
      if (door && Math.abs(a) < dw / 2 + 2) continue;
      const s = 1.2 + R() * 1.8;
      put(side, new THREE.DodecahedronGeometry(1, 0), R() < 0.5 ? M.rock : M.rockD, a, s * 0.4, off + 0.4, R(), R(), R()).scale.set(s * 1.4, s, s * 0.8);
    }
    // the PIERS: hewn square, two beskar bands, a capital, a brazier at the foot of every other one
    let k = 0;
    for (let a = bay / 2; a < off - 1; a += bay) for (const sa of [a, -a]){
      if (door && Math.abs(sa) < dw / 2 + 1.6) continue;
      put(side, new THREE.BoxGeometry(2.4, Wh, 1.6), M.stoneD, sa, Wh / 2, off - 0.2);
      for (const by of [2.6, Wh * 0.55]) put(side, new THREE.BoxGeometry(2.6, 0.5, 1.8), M.beskar, sa, by, off - 0.2);
      put(side, new THREE.BoxGeometry(3.2, 1.0, 2.2), M.stone, sa, Wh - 0.6, off - 0.3);
      if ((k++ + (side === 'e' || side === 'w' ? 1 : 0)) % 2 === 0 && o.braziers !== false){
        const [ox, oz] = SIDE_OUT[side], al = side === 'n' || side === 's';
        brazier(K, M, al ? sa : ox * (H + 1.2), al ? oz * (H + 1.2) : sa, 1.7, false);
      }
    }
    // clan banners hung between the piers, high up
    if (o.banners) for (let a = bay; a < off - 2; a += bay * 2) for (const sa of [a, -a]){
      if (door && Math.abs(sa) < dw / 2 + 3) continue;
      const th = SIDES[side], nx = Math.sin(th), nz = Math.cos(th);
      clanBanner(K, M, -nx * (off - 0.6) + Math.cos(th) * sa, Wh * 0.6, -nz * (off - 0.6) - Math.sin(th) * sa, th, 3.0, Math.min(10, Wh * 0.5));
    }
    if (door) greatDoor(K, M, side, put, off, dw, dh, o.doorGlow ?? 0xffb070);
  }
  // corner piers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pic(K.deco(new THREE.BoxGeometry(4, Wh, 4), M.stoneD, sx * (off + 0.6), Wh / 2, sz * (off + 0.6)));
  // the ROOF: slabs of rock round the opening, beams of iron across it
  if (o.roof !== false){
    const [hx, hz, hw, hd] = o.hole || [0, 0, 0, 0], T = 2.4, Y = Wh + T / 2, E = off + 3;
    const slab = (x0, x1, z0, z1) => { if (x1 - x0 > 0.1 && z1 - z0 > 0.1){ const m = pic(K.deco(new THREE.BoxGeometry(x1 - x0, T, z1 - z0), M.rockD, (x0 + x1) / 2, Y, (z0 + z1) / 2)); m.castShadow = false; m.receiveShadow = false; } };
    if (hw > 0){
      slab(-E, E, -E, hz - hd); slab(-E, E, hz + hd, E); slab(-E, hx - hw, hz - hd, hz + hd); slab(hx + hw, E, hz - hd, hz + hd);
    } else slab(-E, E, -E, E);
    for (let x = -off + bay / 2; x < off; x += bay){
      if (hw > 0 && Math.abs(x - hx) < hw) continue;
      pic(K.deco(new THREE.BoxGeometry(1.2, 1.6, off * 2), M.metalD, x, Wh - 0.6, 0)).castShadow = false;
    }
  }
  return { off, Wh };
}
/* a GREAT DOOR: a beskar frame in the wall, its two leaves slid back into the rock, the hall beyond lit warm */
function greatDoor(K, M, side, put, off, dw, dh, glow){
  for (const sx of [-1, 1]){
    put(side, new THREE.BoxGeometry(1.4, dh + 1.2, 2.2), M.beskar, sx * (dw / 2 + 0.7), (dh + 1.2) / 2, off - 0.1);
    put(side, new THREE.BoxGeometry(dw * 0.18, dh - 0.4, 0.5), M.metal, sx * (dw / 2 - dw * 0.09 + 0.2), dh / 2, off + 1.4);   // the leaf, nearly all the way back
  }
  put(side, new THREE.BoxGeometry(dw + 4.2, 1.6, 2.4), M.beskar, 0, dh + 0.8, off - 0.1);
  put(side, new THREE.BoxGeometry(dw + 1.4, 0.3, 2.5), M.brass, 0, dh + 1.7, off - 0.1);
  // the passage beyond: a floor, a warm glow at its end
  put(side, new THREE.BoxGeometry(dw, 0.2, 8), M.stoneD, 0, -0.05, off + 4);
  put(side, new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ color: glow, fog: false }), 0, dh / 2, off + 7.5, 0, PI);
  for (const sx of [-1, 1]) put(side, new THREE.BoxGeometry(0.6, dh, 8), M.rockD, sx * (dw / 2 + 0.3), dh / 2, off + 4);
}
/* a COLOSSAL FOUNDER: an armoured warrior of the clan's first days, hewn in dark stone with beskar plates, a spear
   planted beside them. The helmet is the clan's own: a domed crown, a narrow slit, a crest down the middle */
function founder(K, M, x, z, ry, s){
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; shared.arenaGroup.add(g);
  const add = (geo, mat, px, py, pz, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px * s, py * s, pz * s); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const b = 2.4 / s;
  K.box(x, z, 2.6 * s / 1.6, 2.6 * s / 1.6, 2.4, M.stoneD);
  add(new THREE.BoxGeometry(3.6, 0.3, 3.6), M.brass, 0, b, 0);
  for (const sx of [-1, 1]){
    add(new THREE.BoxGeometry(0.8, 3.4, 0.9), M.stone, sx * 0.55, b + 1.7, 0);                       // legs
    add(new THREE.BoxGeometry(0.95, 1.2, 1.05), M.beskar, sx * 0.55, b + 0.6, 0.06);                   // boots
    add(new THREE.BoxGeometry(0.9, 1.0, 0.25), M.beskar, sx * 0.55, b + 2.4, -0.5);                    // knee plates
  }
  add(new THREE.BoxGeometry(2.1, 0.7, 1.2), M.stoneD, 0, b + 3.6, 0);                                  // belt
  add(new THREE.BoxGeometry(2.0, 2.6, 1.2), M.stone, 0, b + 5.2, 0);                                   // torso
  add(new THREE.BoxGeometry(1.8, 1.6, 0.3), M.beskar, 0, b + 5.6, -0.66);                              // chest plate
  add(new THREE.BoxGeometry(2.6, 0.3, 0.2), M.stoneD, 0, b + 4.4, -0.66);
  for (const sx of [-1, 1]){
    add(new THREE.BoxGeometry(1.1, 0.9, 1.4), M.beskar, sx * 1.45, b + 6.3, 0, 0, sx * -0.3);          // pauldrons
    add(new THREE.BoxGeometry(0.6, 2.6, 0.7), M.stone, sx * 1.4, b + 4.8, 0);                          // arms
    add(new THREE.BoxGeometry(0.7, 1.0, 0.8), M.beskar, sx * 1.4, b + 4.2, 0);                         // vambraces
  }
  // a cape down the back
  add(new THREE.BoxGeometry(2.2, 5.0, 0.2), new THREE.MeshStandardMaterial({ color: M.clothD, roughness: 0.95 }), 0, b + 4.0, 0.72);
  // the helmet
  add(new THREE.SphereGeometry(0.75, 14, 10, 0, PI * 2, 0, PI * 0.55), M.beskar, 0, b + 7.05, 0);
  add(new THREE.CylinderGeometry(0.72, 0.7, 0.9, 14), M.beskar, 0, b + 6.75, 0);
  add(new THREE.BoxGeometry(1.0, 0.12, 0.2), M.dark, 0, b + 6.95, -0.68);                              // the slit
  add(new THREE.BoxGeometry(0.12, 0.62, 0.16), M.metalD, 0, b + 7.4, -0.62, -0.5);                     // the crest
  add(new THREE.BoxGeometry(0.1, 0.24, 1.5), M.brass, 0, b + 7.75, 0.05);
  // the spear, planted at their right hand, a hot glow at its point
  add(new THREE.CylinderGeometry(0.1, 0.1, 9.2, 8), M.metalD, 1.95, b + 4.6, -0.3);
  add(new THREE.ConeGeometry(0.22, 1.1, 6), M.beskar, 1.95, b + 9.7, -0.3);
  add(new THREE.SphereGeometry(0.38, 10, 8), M.stone, 1.5, b + 4.4, -0.35);                            // the hand round it
  return g;
}
/* a HELMET for the trophy shelves: a dome, a visor slit, and the look of whoever wore it */
const TROPHIES = [
  { c: 0xe6e8ea, v: 0x101214, k: 'dome' },   // a trooper's white
  { c: 0x2a2c30, v: 0x8a2020, k: 'dome' },   // a black-armoured hunter's
  { c: 0x8a2a24, v: 0x111111, k: 'crest' },  // a red guard's
  { c: 0x6a6a4a, v: 0x101010, k: 'flat' },   // an olive scout's
  { c: 0xc8a04a, v: 0x141210, k: 'crest' },  // a gilded magistrate's officer
  { c: 0x9aa4ac, v: 0x101820, k: 'flat' },   // a droid's head
];
function trophy(g, x, y, z, ry, t, R){
  const mat = std(t.c, 0.5, 0.35), vis = new THREE.MeshBasicMaterial({ color: t.v });
  const put = (geo, m, px, py, pz) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x + Math.sin(ry) * pz + Math.cos(ry) * px, y + py, z + Math.cos(ry) * pz - Math.sin(ry) * px); mesh.rotation.y = ry; g.push(mesh); return mesh; };
  put(new THREE.SphereGeometry(0.34, 10, 8, 0, PI * 2, 0, PI * 0.6), mat, 0, 0.36, 0);
  put(new THREE.CylinderGeometry(0.33, 0.31, 0.36, 10), mat, 0, 0.18, 0);
  put(new THREE.BoxGeometry(0.4, 0.08, 0.05), vis, 0, 0.3, 0.32);
  if (t.k === 'crest') put(new THREE.BoxGeometry(0.07, 0.14, 0.6), mat, 0, 0.62, 0);
  if (t.k === 'flat') put(new THREE.BoxGeometry(0.66, 0.06, 0.66), mat, 0, 0.5, 0);
  if (R() < 0.3) put(new THREE.BoxGeometry(0.06, 0.2, 0.04), vis, 0.18, 0.14, 0.3);   // a scar
}

/* ---------------- THE GREAT FORGE ---------------- */
function forge(L, K, pal, R, M){
  const H = shared.arenaHalf, g = shared.arenaGroup;
  const { Wh } = room(K, M, R, 'forge', { wallH: 34, bay: 11, doorW: 11, doorH: 12, banners: true, hole: [0, 0, 11, 11] });
  // the light through the roof: a long shaft down beside the flue, warm daylight from the ruins above
  shaft(new THREE.Vector3(7, Wh + 2, -7), new THREE.Vector3(-2, 0, 6), 5, 0xcfe4ff, 0.09);
  shaft(new THREE.Vector3(-8, Wh + 2, 5), new THREE.Vector3(-17, 0, 18), 3.2, 0xdce8ff, 0.06);
  // a bright slit of sky at the top of the shaft
  pic(K.deco(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ color: 0xffe2b0, fog: false }), 0, Wh + 6, 0, PI / 2));

  // ---- the FURNACE: a stepped plinth, an iron drum two storeys high banded in beskar, a glowing mouth toward the
  // door the hero comes in by, the flue rising through the roof ----
  roundStep(K, 0, 0, 9, 0.45, M.stoneD, 8);
  roundStep(K, 0, 0, 7.6, 0.9, M.stone, 8);
  K.deco(new THREE.TorusGeometry(9, 0.12, 6, 8), M.brass, 0, 0.45, 0, -PI / 2).userData.noOutline = true;
  K.column(0, 0, 6.2, 13, M.metalD, { wallKick: false, seg: 16, taper: 0.9 });
  for (const y of [1.6, 6.4, 11.6]) K.deco(new THREE.CylinderGeometry(6.3 - y * 0.05, 6.3 - y * 0.05, 0.7, 16), M.beskar, 0, y, 0);
  for (let i = 0; i < 16; i++){ const a = i / 16 * PI * 2; K.deco(new THREE.BoxGeometry(0.34, 11, 0.34), M.metal, Math.cos(a) * 5.95, 6.5, Math.sin(a) * 5.95, 0, -a, 0); }   // ribs
  K.deco(new THREE.CylinderGeometry(3.6, 5.8, 5, 16), M.metalD, 0, 15.5, 0);   // the hood
  K.deco(new THREE.CylinderGeometry(3.8, 3.8, 0.6, 16), M.beskar, 0, 18, 0);
  const flue = K.deco(new THREE.CylinderGeometry(2.8, 3.6, Wh + 6, 14), M.metalD, 0, 18 + (Wh + 6) / 2, 0); flue.userData.passThrough = true;
  for (const y of [24, 31, 37]) pic(K.deco(new THREE.CylinderGeometry(3.1, 3.1, 0.5, 14), M.beskar, 0, y, 0));
  // its mouth: an arch of molten light on the south face, a pool of it spilling out onto the plinth, the glow pulsing
  const MZ = 6.0;
  const mouth = live(K.deco(new THREE.PlaneGeometry(5.4, 5.4), M.molten, 0, 3.6, MZ));
  live(K.deco(new THREE.CircleGeometry(2.7, 20, 0, PI), M.molten, 0, 6.3, MZ + 0.01));
  K.deco(new THREE.TorusGeometry(2.95, 0.36, 8, 20, PI), M.beskar, 0, 6.3, MZ + 0.05);
  for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.7, 6.3, 0.7), M.beskar, sx * 2.95, 3.15, MZ + 0.05);
  const core = live(K.deco(new THREE.PlaneGeometry(3.6, 4.0), M.hot, 0, 3.0, MZ + 0.02));
  live(K.deco(new THREE.CircleGeometry(3.4, 20, 0, PI), holoM(0xff9a3a, 0.35), 0, 0.93, MZ + 0.2, -PI / 2));   // its glow spilling on the plinth
  anim(core, (o, t) => { const k = 0.85 + Math.sin(t * 2.1) * 0.08 + Math.sin(t * 5.3) * 0.05; o.scale.set(k, k, 1); });
  anim(mouth, (o, t) => { o.scale.y = 1 + Math.sin(t * 1.7) * 0.03; });
  // glowing vents round the drum, sparks drifting up the flue
  for (let i = 0; i < 6; i++){ const a = i / 6 * PI * 2 + PI / 6; live(K.deco(new THREE.PlaneGeometry(0.9, 2.4), M.molten, Math.cos(a) * 6.15, 9.2, Math.sin(a) * 6.15, 0, PI / 2 - a)); }
  const sparks = new THREE.Group(); g.add(sparks);
  for (let i = 0; i < 26; i++){
    const sp = live(new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), i % 3 ? M.hot : M.ember));
    const a = R() * PI * 2, r = 1.5 + R() * 3.5, ph = R() * 10, sp0 = 2 + R() * 3;
    sp.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); sparks.add(sp);
    anim(sp, (o, t, b) => { const y = ((t * sp0 + ph * 4) % 30); o.position.set(b.x + Math.sin(t + ph) * 0.6, 18 + y, b.z + Math.cos(t * 0.8 + ph) * 0.6); o.scale.setScalar(1 - y / 34); });
  }

  // ---- the RING OF BESKAR: a channel of molten metal round the furnace, under an iron grate you walk across ----
  const RC = 15;
  live(K.deco(new THREE.RingGeometry(RC - 1.3, RC + 1.3, 96), M.molten, 0, 0.04, 0, -PI / 2));
  const glowRing = live(K.deco(new THREE.RingGeometry(RC - 0.6, RC + 0.6, 96), M.hot, 0, 0.045, 0, -PI / 2));
  anim(glowRing, (o, t) => { o.material.color.setHSL(0.1 + Math.sin(t * 0.9) * 0.012, 1, 0.62 + Math.sin(t * 1.6) * 0.05); });
  for (const r of [RC - 1.45, RC + 1.45]) K.deco(new THREE.TorusGeometry(r, 0.16, 6, 96), M.metalD, 0, 0.06, 0, -PI / 2).userData.noOutline = true;
  for (let i = 0; i < 56; i++){ const a = i / 56 * PI * 2; K.deco(new THREE.BoxGeometry(2.9, 0.08, 0.13), M.metalD, Math.cos(a) * RC, 0.08, Math.sin(a) * RC, 0, -a); }
  // a heat shimmer over it
  live(K.deco(new THREE.CylinderGeometry(RC + 1, RC + 1, 1.4, 64, 1, true), holoM(0xff8a3a, 0.06), 0, 0.75, 0));

  // ---- CRUCIBLES on chains over the ring, two of them tipped, pouring into the channel ----
  for (let i = 0; i < 4; i++){
    const a = i / 4 * PI * 2 + PI / 4, x = Math.cos(a) * RC, z = Math.sin(a) * RC, y = 13, pour = i % 2 === 0;
    const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.set(pour ? 0.5 * Math.cos(a + PI / 2) : 0, 0, pour ? -0.5 * Math.sin(a + PI / 2) : 0); g.add(c);
    const add = (geo, m, py) => { const mm = new THREE.Mesh(geo, m); mm.position.y = py; mm.userData.passThrough = true; c.add(mm); return mm; };
    add(new THREE.CylinderGeometry(1.4, 1.0, 1.8, 12), M.metalD, 0);
    add(new THREE.TorusGeometry(1.4, 0.14, 6, 14), M.beskar, 0.9).rotation.x = PI / 2;
    add(new THREE.CircleGeometry(1.25, 14), M.molten, 0.86).rotation.x = -PI / 2;
    for (const sx of [-1, 1]){ const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, Wh - y, 4), M.metalD); ch.position.set(x + sx * 1.2 * Math.cos(a + PI / 2), (Wh + y) / 2 + 1, z + sx * 1.2 * Math.sin(a + PI / 2)); pic(ch); g.add(ch); }
    if (pour){
      const st = live(K.deco(new THREE.CylinderGeometry(0.16, 0.26, y - 0.2, 8), M.hot, x, y / 2, z));
      anim(st, (o, t) => { o.scale.x = o.scale.z = 0.8 + Math.sin(t * 9 + a) * 0.2; });
      live(K.deco(new THREE.CircleGeometry(1.1, 14), M.ember, x, 0.07, z, -PI / 2));
    }
  }

  // ---- the ARMORER'S ANVIL in front of the furnace: a stump of iron, the anvil, a plate glowing hot on it, the
  // quench trough and the tool rack beside it ----
  { const ax = -8, az = 20;
    roundStep(K, ax, az, 4.2, 0.35, M.stoneD, 12);
    K.box(ax, az, 0.75, 0.55, 1.0, M.metalD);
    K.deco(new THREE.BoxGeometry(2.4, 0.5, 1.0), M.metal, ax, 1.25, az);
    K.deco(new THREE.ConeGeometry(0.42, 1.2, 8), M.metal, ax - 1.75, 1.3, az, 0, 0, PI / 2);
    K.deco(new THREE.BoxGeometry(1.6, 0.12, 0.9), M.beskar, ax + 0.2, 1.56, az);
    const plate = live(K.deco(new THREE.SphereGeometry(0.55, 12, 6, 0, PI * 2, 0, PI * 0.35), M.hot, ax + 0.2, 1.4, az));
    anim(plate, (o, t) => { o.material.color.setHSL(0.09, 1, 0.55 + Math.sin(t * 1.3) * 0.08); });
    // the hammer, laid across the horn
    K.deco(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), M.wood, ax - 0.9, 1.62, az + 0.25, 0, 0.4, PI / 2);
    K.deco(new THREE.BoxGeometry(0.45, 0.3, 0.3), M.metalD, ax - 1.55, 1.62, az + 0.5);
    // the quench trough and the rack of tongs and hammers
    K.box(ax + 3.0, az + 1.0, 0.9, 0.5, 0.8, M.metalD, { climbable: true });
    live(K.deco(new THREE.PlaneGeometry(1.6, 0.8), std(0x2a3a44, 0.15, 0.4, 0.2), ax + 3.0, 0.82, az + 1.0, -PI / 2));
    K.box(ax - 3.2, az - 0.4, 0.25, 1.4, 2.4, M.wood);
    for (let k = -2; k <= 2; k++) K.deco(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), M.metalD, ax - 3.0, 1.5, az - 0.4 + k * 0.5);
    // a mannequin with a half-finished suit beside it
    K.column(ax + 2.6, az - 2.0, 0.25, 1.6, M.metalD, { wallKick: false, seg: 6 });
    K.deco(new THREE.BoxGeometry(1.2, 1.1, 0.6), M.beskar, ax + 2.6, 2.2, az - 2.0);
    K.deco(new THREE.SphereGeometry(0.34, 10, 8), M.beskar, ax + 2.6, 3.1, az - 2.0); }

  // ---- the two FOUNDERS, colossal, either side of the furnace, facing the way in ----
  for (const sx of [-1, 1]) founder(K, M, sx * 30, -16, Math.atan2(sx * 30, -16 - 30) + PI, 1.55);
  // ---- the PIERS of the cavern: eight great hewn columns at r 31, the doors' lanes left clear ----
  for (let i = 0; i < 8; i++){
    const a = i / 8 * PI * 2 + PI / 8, x = Math.cos(a) * 31, z = Math.sin(a) * 31;
    if (Math.abs(x) > 26 && Math.abs(z + 16) < 8) continue;   // (the founders stand there)
    K.column(x, z, 2.4, Wh, M.rock, { seg: 9, taper: 0.9 });
    K.deco(new THREE.CylinderGeometry(3.0, 3.2, 1.2, 9), M.stoneD, x, 0.6, z);
    for (const y of [4, 12]) K.deco(new THREE.CylinderGeometry(2.45, 2.45, 0.5, 9), M.beskar, x, y, z);
    brazier(K, M, x - Math.cos(a) * 3.6, z - Math.sin(a) * 3.6, 1.7);
  }
  // ---- WORKBENCHES and stacked ingots round the floor: low cover you hop on ----
  for (const [x, z, hx, hz] of [[-20, 8, 2.4, 1.0], [20, 6, 2.4, 1.0], [-14, -24, 1.0, 2.4], [14, -24, 1.0, 2.4]]){
    K.box(x, z, hx, hz, 1.0, M.wood, { climbable: true });
    K.deco(new THREE.BoxGeometry(hx * 2 + 0.1, 0.08, hz * 2 + 0.1), M.metalD, x, 1.02, z);
    for (let k = 0; k < 3; k++) K.deco(new THREE.BoxGeometry(0.7, 0.22, 0.35), M.beskar, x + (R() - 0.5) * hx, 1.17 + k * 0.22, z + (R() - 0.5) * hz, 0, R());
  }
  for (const [x, z] of [[-22, 24], [24, -4], [-25, -6]]){
    K.box(x, z, 0.9, 0.6, 0.6, M.beskar, { climbable: true });
    K.deco(new THREE.BoxGeometry(1.4, 0.4, 0.9), M.beskar, x, 0.8, z);
  }
  // great banners hanging from the roof over the four lanes
  for (const [x, z, ry] of [[-11, -26, 0], [11, -26, 0], [-26, 11, PI / 2], [26, 11, -PI / 2]]) clanBanner(K, M, x, 22, z, ry, 3.6, 13);
  // light pools on the floor round the ring
  for (let i = 0; i < 8; i++){ const a = i / 8 * PI * 2; live(K.deco(new THREE.CircleGeometry(4.5, 24), holoM(0xff7a2a, 0.07), Math.cos(a) * (RC + 4), 0.03, Math.sin(a) * (RC + 4), -PI / 2)); }
}

/* ---------------- THE CLAN HALL ---------------- */
function clan(L, K, pal, R, M){
  const H = shared.arenaHalf;
  room(K, M, R, 'clan', { wallH: 20, bay: 8, doorW: 9, doorH: 11, banners: true, hole: [0, 0, 6, 6] });
  shaft(new THREE.Vector3(0, 22, 0), new THREE.Vector3(-2, 0, 4), 5, 0xdce8ff, 0.07);
  // the raised floor and the WAR TABLE: an octagon of beskar, the hunt turning over it in amber
  roundStep(K, 0, 0, 13, 0.45, M.stoneD, 8);
  K.deco(new THREE.TorusGeometry(13, 0.14, 6, 8), M.brass, 0, 0.45, 0, -PI / 2).userData.noOutline = true;
  K.column(0, 0, 3.8, 1.25, M.metalD, { wallKick: false, seg: 8, taper: 1 });
  K.deco(new THREE.CylinderGeometry(4.1, 4.1, 0.2, 8), M.beskar, 0, 1.32, 0);
  live(K.deco(new THREE.RingGeometry(2.8, 3.4, 8), glowM(AMBER, 0.6), 0, 1.44, 0, -PI / 2));
  const hunt = new THREE.Group(); hunt.position.set(0, 4.0, 0); shared.arenaGroup.add(hunt);
  { const hm = holoM(AMBER, 0.32), hw = holoM(0xfff0d0, 0.5);
    const world = live(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 2), new THREE.MeshBasicMaterial({ color: AMBER, wireframe: true, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))); hunt.add(world);
    const inner = live(new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 14), holoM(AMBER, 0.12))); hunt.add(inner);
    for (let i = 0; i < 3; i++){ const r = live(new THREE.Mesh(new THREE.TorusGeometry(2.3 + i * 0.5, 0.025, 4, 64), hm)); r.rotation.set(PI / 2 + (i - 1) * 0.35, 0, i * 0.6); hunt.add(r); }
    for (let i = 0; i < 4; i++){ const a = i * 1.7, p = live(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glowM(0xff4a3a))); p.position.set(Math.cos(a) * 1.62, Math.sin(i * 2.1) * 0.9, Math.sin(a) * 1.4); hunt.add(p); }
    const beam = live(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 2.6, 8, 1, true), holoM(AMBER, 0.06))); beam.position.y = -1.4; hunt.add(beam);
    const moon = live(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), hw)); hunt.add(moon);
    anim(moon, (o, t) => { o.position.set(Math.cos(t * 0.6) * 2.9, Math.sin(t * 0.6) * 0.6, Math.sin(t * 0.6) * 2.9); }); }
  spinner(hunt, 0.14);
  // the clan's SEATS round it: heavy iron stools, the door's side left open
  for (let i = 0; i < 10; i++){
    const a = -PI / 2 + (i - 4.5) / 10 * PI * 1.6, r = 10.4, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 8) continue;
    K.box(x, z, 0.8, 0.8, 1.0, M.metalD);
    K.deco(new THREE.BoxGeometry(1.7, 0.16, 1.7), M.beskar, x, 1.08, z, 0, -a);
    const back = K.deco(new THREE.BoxGeometry(1.8, 2.2, 0.3), M.metalD, x + Math.cos(a) * 0.8, 1.6, z + Math.sin(a) * 0.8, 0, -a + PI / 2); back.userData.passThrough = true;
  }
  // tripod braziers on the four diagonals of the dais
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) brazier(K, M, sx * 9.5, sz * 9.5, 2.0);
  // the HEARTH along the north wall: a long trench of fire on a stone kerb
  K.box(0, -H + 3, 9, 1.2, 0.6, M.stoneD, { climbable: true });
  live(K.deco(new THREE.PlaneGeometry(17, 1.8), M.hot, 0, 0.62, -H + 3, -PI / 2));
  for (let x = -8; x <= 8; x += 1.3){
    const f = live(K.deco(new THREE.ConeGeometry(0.5, 1.4 + R(), 7), (x * 3 | 0) % 2 ? M.fire : M.ember, x, 1.3, -H + 3 + (R() - 0.5) * 0.8));
    anim(f, (o, t, b) => { const k = 0.8 + Math.sin(t * 6 + x * 2) * 0.2; o.scale.set(1, k, 1); o.position.y = b.y + (k - 1) * 0.6; });
  }
  clanBanner(K, M, 0, 13, -H - 2.0, 0, 6, 12);   // the clan's great banner over the hearth
  // ARMOUR STANDS along the side walls: the clan's spare suits, each in its own colours
  const suits = [0x6a2a24, 0x3a5a4a, 0x4a4a6a, 0x8a7a4a, 0x2a2c30, 0x5a6a7a];
  let n = 0;
  for (const sx of [-1, 1]) for (let z = -20; z <= 16; z += 9){
    const x = sx * (H - 2.6), c = std(suits[n++ % suits.length], 0.5, 0.5);
    K.box(x, z, 0.6, 0.6, 0.3, M.stoneD);
    K.column(x, z, 0.12, 2.8, M.metalD, { wallKick: false, seg: 6 });
    K.deco(new THREE.BoxGeometry(0.6, 1.2, 1.3), c, x, 2.6, z);
    for (const sz of [-1, 1]) K.deco(new THREE.BoxGeometry(0.7, 0.4, 0.6), M.beskar, x, 3.1, z + sz * 0.85, sz * 0.3);
    K.deco(new THREE.SphereGeometry(0.4, 12, 8, 0, PI * 2, 0, PI * 0.6), c, x, 3.55, z);
    K.deco(new THREE.CylinderGeometry(0.4, 0.38, 0.4, 12), c, x, 3.4, z);
    K.deco(new THREE.BoxGeometry(0.06, 0.08, 0.5), M.dark, x - sx * 0.39, 3.5, z);
  }
}

/* ---------------- THE SPARRING PIT ---------------- */
function pit(L, K, pal, R, M){
  const H = shared.arenaHalf;
  room(K, M, R, 'pit', { wallH: 22, bay: 9, doorW: 9, doorH: 11, banners: true, hole: [10, 0, 9, 9] });
  shaft(new THREE.Vector3(12, 24, -2), new THREE.Vector3(10, 0, 3), 6, 0xdce8ff, 0.06);
  // the PIT: a sanded floor in a ring of iron posts, each with a fire on top, a tier of steps for the clan to watch from
  const sand = std(pal.sand ?? 0x8a6a4a, 1);
  live(K.deco(new THREE.CircleGeometry(11, 8), sand, 12, 0.03, 0, -PI / 2)).receiveShadow = true;
  live(K.deco(new THREE.RingGeometry(11, 11.4, 8), glowM(AMBER, 0.5), 12, 0.04, 0, -PI / 2));
  for (let i = 0; i < 8; i++){
    const a = i / 8 * PI * 2 + PI / 8, x = 12 + Math.cos(a) * 11.6, z = Math.sin(a) * 11.6;
    if (Math.abs(z) < 4 && x < 12) continue;   // (the way in from the door)
    K.column(x, z, 0.45, 2.4, M.metalD, { wallKick: false, seg: 8 });
    brazier(K, M, x, z, 2.6, false);
  }
  for (let k = 0; k < 3; k++) K.box(H - 5.4 + k * 1.2, 0, 0.6, 7, 0.45 * (k + 1), M.stoneD, { climbable: true });   // the tiers, east
  // the TARGET RANGE along the north wall: a firing line, the targets on posts beyond it
  for (const [x0, x1] of [[-22, -8], [0, 14]]) K.box((x0 + x1) / 2, -27.5, (x1 - x0) / 2, 0.4, 1.0, M.metal, { climbable: true });
  for (let x = -20; x <= 12; x += 5){
    const z = -34 + (x % 2 ? 1 : 0);
    K.column(x, z, 0.18, 2.0, M.metalD, { wallKick: false, seg: 6 });
    K.box(x, z, 0.9, 0.1, 2.0, M.metal);   // (a plate on its post)
    K.deco(new THREE.BoxGeometry(1.8, 2.2, 0.2), M.metal, x, 3.0, z);
    for (const [r0, r1, c] of [[0.5, 0.7, 0xd83a2a], [0.2, 0.32, 0xd83a2a]]) live(K.deco(new THREE.RingGeometry(r0, r1, 20), glowM(c), x, 3.0, z + 0.12));
  }
  // the GAUNTLET in the south: pillars stepping up for the jump, hoops in the air for the jetpack, a scaffold to climb
  for (const [x, z, h] of [[-18, 28, 1.2], [-12, 30, 2.4], [-6, 28, 3.6], [0, 30, 4.8]]){
    K.column(x, z, 1.3, h, M.rock, { seg: 8, taper: 0.95 });
    K.deco(new THREE.CylinderGeometry(1.35, 1.35, 0.2, 8), M.beskar, x, h, z);
  }
  K.gantry(12, 24, { a: M.metalD, b: M.metal, strut: M.brass, beacon: AMBER }, [1, 1]);
  for (let i = 0; i < 4; i++){
    const hoop = live(K.deco(new THREE.TorusGeometry(2.2, 0.16, 8, 32), glowM(AMBER, 0.85), -14 + i * 7, 8 + i * 2.2, 22 - i * 1.5));
    anim(hoop, (o, t, b) => { o.rotation.y = Math.sin(t * 0.5 + i) * 0.4; o.position.y = b.y + Math.sin(t * 1.1 + i) * 0.3; });
  }
  // RACKS of blasters and spears along the east wall, training dummies about the floor
  for (const z of [-16, 16]){
    K.box(H - 1.2, z, 0.4, 3.4, 1.8, M.wood);
    for (let k = -3; k <= 3; k++){
      if (k % 2) K.deco(new THREE.BoxGeometry(0.2, 0.3, 1.0), M.metalD, H - 1.7, 1.2 + (k & 2 ? 0.4 : 0), z + k * 0.9, 0, 0, 0.1);
      else K.deco(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 5), M.metal, H - 1.7, 1.9, z + k * 0.9);
    }
  }
  for (const [x, z] of [[-20, -10], [-14, 12], [-2, -12], [24, -24]]){
    K.column(x, z, 0.4, 2.0, M.wood, { seg: 8, taper: 1 });
    K.deco(new THREE.BoxGeometry(1.0, 0.9, 0.6), std(0x6a5a40, 0.95), x, 1.9, z);
    K.deco(new THREE.SphereGeometry(0.32, 8, 6), std(0x6a5a40, 0.95), x, 2.6, z);
  }
}

/* ---------------- THE TROPHY VAULT ---------------- */
function vault(L, K, pal, R, M){
  const H = shared.arenaHalf, g = shared.arenaGroup;
  room(K, M, R, 'vault', { wallH: 16, bay: 8, doorW: 9, doorH: 10, banners: false, hole: [0, 0, 4, 4], doorGlow: 0xffa060 });
  shaft(new THREE.Vector3(0, 18, 0), new THREE.Vector3(0, 0, 2), 4, 0xdce8ff, 0.07);
  // the walls plated in beskar to head height inside
  for (const [x, z, w, d] of [[0, -H - 0.4, H * 2, 0.4], [0, H + 0.4, H * 2, 0.4], [-H - 0.4, 0, 0.4, H * 2]]) pic(K.deco(new THREE.BoxGeometry(w, 5, d), M.metal, x, 2.5, z));
  // the great round VAULT DOOR, rolled back beside the way in
  pic(K.deco(new THREE.CylinderGeometry(6, 6, 1.4, 32), M.metal, H + 1.2, 6.4, 12.5, 0, 0, PI / 2));
  pic(K.deco(new THREE.TorusGeometry(5.6, 0.4, 8, 32), M.beskar, H + 0.4, 6.4, 12.5, 0, PI / 2, 0));
  for (let i = 0; i < 8; i++){ const a = i / 8 * PI * 2; pic(K.deco(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 8), M.brass, H + 1.2, 6.4 + Math.sin(a) * 4.6, 12.5 + Math.cos(a) * 4.6, 0, 0, PI / 2)); }
  pic(K.deco(new THREE.CylinderGeometry(2.0, 2.0, 1.8, 6), M.metalD, H + 1.2, 6.4, 12.5, 0, 0, PI / 2));
  // the TROPHY SHELVES along the north and south walls: four tiers of helmets, every one a bounty brought in
  const helms = [];
  for (const sz of [-1, 1]) for (const [x0, x1] of [[-30, -12], [-8, 8], [12, 26]]){
    const cx = (x0 + x1) / 2, hx = (x1 - x0) / 2, z = sz * (H - 1.4), face = sz < 0 ? 0 : PI;
    K.slab(cx, z, hx, 0.9, 0, 7.2);   // (the whole case is solid: you can't walk in among the helmets)
    K.deco(new THREE.BoxGeometry(hx * 2, 7.2, 0.5), M.stoneD, cx, 3.6, z + sz * 0.65);
    for (const ex of [x0, x1]) K.deco(new THREE.BoxGeometry(0.4, 7.4, 1.9), M.stoneD, ex, 3.7, z);
    K.deco(new THREE.BoxGeometry(hx * 2 + 0.4, 0.3, 2.0), M.stoneD, cx, 7.3, z);
    for (let t = 0; t < 4; t++){
      const y = 0.9 + t * 1.6;
      K.deco(new THREE.BoxGeometry(hx * 2, 0.14, 1.7), M.brass, cx, y - 0.07, z);
      for (let x = x0 + 0.9; x < x1 - 0.5; x += 1.25) if (R() > 0.12) trophy(helms, x, y, z - sz * 0.15, face, TROPHIES[Math.floor(R() * TROPHIES.length)], R);
      live(K.deco(new THREE.PlaneGeometry(hx * 2, 1.2), holoM(AMBER, 0.05), cx, y + 0.6, z + sz * 0.38, 0, face));   // a warm glow at the back of each shelf
    }
    live(K.deco(new THREE.PlaneGeometry(hx * 2, 0.08), glowM(AMBER, 0.7), cx, 7.1, z - sz * 0.92, 0, face));
  }
  for (const m of helms){ m.castShadow = false; g.add(m); }
  // the BOUNTY ARCHIVE: a round dais, a projector, a quarry turning in amber over it with the puck's rings
  roundStep(K, 0, 0, 5.5, 0.35, M.stoneD, 12);
  K.column(0, 0, 1.9, 1.15, M.metalD, { wallKick: false, seg: 12, taper: 0.9 });
  K.deco(new THREE.CylinderGeometry(2.1, 2.1, 0.14, 12), M.beskar, 0, 1.2, 0);
  const q = new THREE.Group(); q.position.set(0, 2.0, 0); g.add(q);
  { const hm = holoM(AMBER, 0.2);
    const part = (geo, y, sx = 0) => { const m = live(new THREE.Mesh(geo, hm)); m.position.set(sx, y, 0); q.add(m); return m; };
    part(new THREE.SphereGeometry(0.28, 12, 8), 2.05); part(new THREE.CylinderGeometry(0.4, 0.32, 0.9, 10), 1.4);
    part(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 10), 0.78); for (const sx of [-0.17, 0.17]) part(new THREE.CylinderGeometry(0.11, 0.1, 0.8, 6), 0.15, sx);
    for (const sx of [-0.52, 0.52]) part(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6), 1.3, sx);
    for (let i = 0; i < 2; i++){ const r = live(new THREE.Mesh(new THREE.TorusGeometry(1.0 + i * 0.25, 0.02, 4, 40), hm)); r.rotation.x = PI / 2; r.position.y = 0.3 + i * 1.6; q.add(r); }
    const beam = live(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.6, 2.4, 12, 1, true), holoM(AMBER, 0.035))); beam.position.y = 1.0; q.add(beam); }
  spinner(q, 0.5);
  // the SIGNET and the MISSION RECORDS: a lit pedestal each before the west wall, the clan's mark huge over them
  K.column(-22, -6, 0.8, 1.2, M.stoneD, { wallKick: false, seg: 8, taper: 0.85 });
  const sig = live(K.deco(new THREE.TorusGeometry(0.45, 0.09, 8, 24), glowM(0xffd27a), -22, 2.2, -6));
  anim(sig, (o, t, b) => { o.rotation.y = t * 0.8; o.position.y = b.y + Math.sin(t * 1.3) * 0.1; });
  K.column(-22, 6, 0.8, 1.2, M.stoneD, { wallKick: false, seg: 8, taper: 0.85 });
  for (let k = 0; k < 5; k++){ const p = live(K.deco(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), glowM(k % 2 ? 0xffb35a : 0x7ad8ff), -22, 1.5 + k * 0.18, 6)); anim(p, (o, t, b) => { o.rotation.y = t * (0.4 + k * 0.2); o.position.y = b.y + Math.sin(t * 1.2 + k) * 0.03; }); }
  clanBanner(K, M, -H - 1.6, 8.5, 0, PI / 2, 6, 10);
  // BESKAR: stacked ingots and strongboxes, low cover about the floor
  for (const [x, z] of [[9, -12], [9, 12], [-10, -14], [-10, 14], [18, 0]]){
    K.box(x, z, 1.1, 0.7, 0.7, M.metalD, { climbable: true });
    for (let k = 0; k < 4; k++) K.deco(new THREE.BoxGeometry(0.8, 0.22, 0.4), M.beskar, x + (k % 2 - 0.5) * 0.9, 0.82 + Math.floor(k / 2) * 0.22, z + (R() - 0.5) * 0.5);
  }
}

/* ---------------- THE HANGAR ---------------- */
function hangar(L, K, pal, R, M){
  const H = shared.arenaHalf;
  // open to the sky: the roof is only a rim round a great opening, the ruins of the city at its edge
  const { Wh } = room(K, M, R, 'hangar', { wallH: 16, bay: 10, doorW: 10, doorH: 12, banners: false, hole: [0, 4, 30, 30] });
  for (const [x, z, w, d] of [[-24, -20, 8, 5], [22, 28, 10, 6], [28, -8, 5, 12], [-28, 18, 6, 9]]){   // broken masonry on the rim
    pic(K.deco(new THREE.BoxGeometry(w, 6 + R() * 6, d), M.rockL, x * 1.3, Wh + 4, z * 1.3, 0, R() * 0.4, 0));
    pic(K.deco(new THREE.BoxGeometry(w * 0.6, 3 + R() * 4, d * 0.5), M.stone, x * 1.3 + 2, Wh + 10, z * 1.3, 0, R() * 0.6, 0));
  }
  // the ROOF DOORS: two great beskar plates rolled back over the rim, and a crane's boom reaching out over the pad
  for (const sx of [-1, 1]) pic(K.deco(new THREE.BoxGeometry(26, 1.2, 64), M.metal, sx * 44, Wh + 2.6, 4, 0, 0, sx * 0.08));
  for (const sx of [-1, 1]) for (let z = -24; z <= 32; z += 8) pic(K.deco(new THREE.BoxGeometry(26.4, 1.4, 0.6), M.beskar, sx * 44, Wh + 2.6, z, 0, 0, sx * 0.08));
  pic(K.deco(new THREE.BoxGeometry(1.4, 1.4, 34), M.metalD, -30, Wh + 1, -4));
  pic(K.deco(new THREE.BoxGeometry(16, 1.2, 1.2), std(0xd9a43a, 0.6, 0.4), -22, Wh + 2, -4));
  pic(K.deco(new THREE.CylinderGeometry(0.06, 0.06, Wh - 6, 4), M.metalD, -16, Wh / 2 + 4, -4));
  pic(K.deco(new THREE.BoxGeometry(1.6, 0.8, 1.6), M.metalD, -16, 7.6, -4));
  // the LIFT PAD and the clan's SHIP on it, set at an angle, ramp down toward the way in
  const PX = 2, PZ = 4;
  K.box(PX, PZ, 12, 13, 0.2, M.metalD, { climbable: true });
  for (const sx of [-1, 1]) K.deco(new THREE.BoxGeometry(0.35, 0.04, 25.6), std(0xd9a43a, 0.6, 0.4), PX + sx * 11.6, 0.21, PZ);
  for (const sz of [-1, 1]) K.deco(new THREE.BoxGeometry(23.6, 0.04, 0.35), std(0xd9a43a, 0.6, 0.4), PX, 0.21, PZ + sz * 12.6);
  live(K.deco(new THREE.RingGeometry(9.2, 9.6, 48), glowM(AMBER, 0.35), PX, 0.22, PZ, -PI / 2));
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]){
    const l = live(K.deco(new THREE.SphereGeometry(0.22, 8, 6), glowM(AMBER), PX + sx * 11.8, 0.4, PZ + sz * 12.8));
    anim(l, (o, t) => { o.scale.setScalar(0.7 + (Math.sin(t * 3 + sx + sz * 2) > 0 ? 0.5 : 0)); });
  }
  shared.refugeShip = null;
  huntersShip(PX, PZ + 1, 0.6, pal);
  // fuel and cargo: tanks, crates stacked to climb, a cart of tools
  for (const [x, z] of [[-24, 20], [-18, 26]]){
    K.column(x, z, 1.6, 4.4, M.metal, { seg: 12, taper: 1 });
    K.deco(new THREE.CylinderGeometry(1.65, 1.65, 0.3, 12), std(0xd9a43a, 0.6, 0.4), x, 3.4, z);
    K.deco(new THREE.SphereGeometry(1.6, 12, 6, 0, PI * 2, 0, PI / 2), M.metal, x, 4.4, z);
  }
  for (const [x, z, h] of [[22, -14, 1.0], [24.5, -14, 2.0], [22, -11.5, 1.0], [20, 14, 1.0], [-14, -24, 1.0]]){
    K.box(x, z, 1.15, 1.15, h, M.wood, { climbable: h <= 1.0 });
    K.deco(new THREE.BoxGeometry(2.35, 0.1, 2.35), std(0xd9a43a, 0.6, 0.4), x, h * 0.6, z);
  }
  K.gantry(24, 20, { a: M.metalD, b: M.metal, strut: std(0xd9a43a, 0.6, 0.4), beacon: AMBER }, [1, 1]);
  // a fuel line and a power cable snaking to the pad
  for (const [x0, z0, x1, z1] of [[-22, 18, -10, 10], [24, -12, 14, -6]]){
    const len = Math.hypot(x1 - x0, z1 - z0);
    K.deco(new THREE.BoxGeometry(0.28, 0.18, len), M.metalD, (x0 + x1) / 2, 0.09, (z0 + z1) / 2, 0, Math.atan2(x1 - x0, z1 - z0)).userData.passThrough = true;
  }
  // the BOUNTY BOARD: an iron board on posts, pucks glowing on it, the quarry's faces flickering over them
  { const bx = -20, bz = -12, ry = Math.atan2(0 - bx, -27 - bz);
    K.box(bx - 1.6 * Math.cos(ry), bz + 1.6 * Math.sin(ry), 0.2, 0.2, 3.6, M.metalD);
    K.box(bx + 1.6 * Math.cos(ry), bz - 1.6 * Math.sin(ry), 0.2, 0.2, 3.6, M.metalD);
    const back = K.deco(new THREE.BoxGeometry(4.0, 2.6, 0.2), M.metal, bx, 2.6, bz, 0, ry); back.userData.passThrough = true;
    for (let k = 0; k < 6; k++){
      const px = (k % 3 - 1) * 1.15, py = k < 3 ? 3.2 : 2.1;
      live(K.deco(new THREE.CircleGeometry(0.24, 14), glowM(k === 1 ? 0xff4a3a : AMBER), bx + Math.cos(ry) * px + Math.sin(ry) * 0.12, py, bz - Math.sin(ry) * px + Math.cos(ry) * 0.12, 0, ry));
      const face = live(K.deco(new THREE.PlaneGeometry(0.6, 0.7), holoM(AMBER, 0.25), bx + Math.cos(ry) * px + Math.sin(ry) * 0.5, py + 0.55, bz - Math.sin(ry) * px + Math.cos(ry) * 0.5, 0, ry));
      anim(face, (o, t) => { o.material.opacity = 0.18 + (Math.sin(t * 7 + k * 3) > 0.6 ? 0.1 : 0); });
    } }
  // work lamps on tall posts round the pad
  for (const [x, z] of [[-14, -6], [14, -6], [-14, 18], [14, 18]]){
    K.column(x, z, 0.2, 5.5, M.metalD, { wallKick: false, seg: 6 });
    K.deco(new THREE.BoxGeometry(0.9, 0.4, 0.5), std(0xffd8a0, 0.6, 0, 0.9), x, 5.6, z);
    live(K.deco(new THREE.CircleGeometry(3.4, 20), holoM(0xffd8a0, 0.06), x, 0.03, z, -PI / 2));
  }
}

/* THE CLAN'S SHIP: a heavy hunter's gunship of the clan's own make. A wedge of a hull with a raised cockpit, inverted
   gull wings with an engine at each tip, a main thruster in the tail, a swept fin, twin cannons under the chin, and
   the belly ramp lowered at the back with the hold lit. Nose toward local +z; `ry` turns it. Toon-shaded and inked
   like the heroes, with collision as a chain of columns down the hull (the ramp is three climbable steps). */
// ink every mesh under a group (gathered first: inkify hangs its outline under each mesh, which a live traverse would
// then visit and ink again, and again)
const inkAll = (grp) => { const ms = []; grp.traverse(o => { if (o.isMesh) ms.push(o); }); for (const o of ms) inkify(o, 0.04); };
function huntersShip(x, z, ry, pal){
  const g = new THREE.Group(); g.userData.noBake = true; g.userData.solidify = true; g.position.set(x, 0, z); g.rotation.y = ry; shared.arenaGroup.add(g);   // (it never leaves its pad: the auto colliders fill in round its own, world/autosolid.js)
  const hull = toon(pal.hull ?? 0x8a8e84), hullD = toon(0x6a6e68), dark = toon(pal.metalD ?? 0x30343a), bes = toon(0xc0c6cc);
  const paint = toon(0xb0542a), glass = toon(0x1e2a36, { emissive: 0x2a4a60, ei: 0.35 });
  const jet = new THREE.MeshBasicMaterial({ color: 0x8ad8ff, toneMapped: false }), hot = new THREE.MeshBasicMaterial({ color: 0xffd8a0 });
  const part = (geo, m, px, py, pz, rx = 0, ryy = 0, rz = 0, ink = 0.05) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(px, py, pz); mesh.rotation.set(rx, ryy, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); if (ink) inkify(mesh, ink); return mesh;
  };
  // a side profile (y up, along z), extruded across x with a rounded bevel
  const side = (pts, w, bevel) => {
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, steps: 1 });
    geo.translate(0, 0, -w / 2); geo.rotateY(-PI / 2);   // (the profile's x runs along +z, the extrusion across x)
    return geo;
  };
  // the HULL: flat belly, a long nose sweeping down to a point, the spine rising to the cockpit and running back level
  part(side([[-8.6, 1.7], [5.5, 1.7], [10.8, 2.5], [11.4, 2.9], [10.2, 3.5], [6.2, 4.3], [3.4, 5.0], [-6.5, 5.0], [-10.2, 4.3], [-10.2, 2.7]], 4.2, 0.7), hull, 0, 0, 0);
  // the spine plates and the clan's paint: a band down each flank, swept up at the nose
  part(side([[-9.6, 4.2], [3.2, 4.2], [6.0, 3.6], [9.8, 2.9], [10.6, 2.75], [9.4, 3.3], [5.8, 4.05], [3.0, 4.6], [-9.6, 4.6]], 4.3, 0.72), paint, 0, 0, 0, 0);
  part(new THREE.BoxGeometry(3.2, 0.5, 9.0), hullD, 0, 5.9, -2.2);
  for (const pz of [-6, -3.5, -1, 1.5]) part(new THREE.BoxGeometry(3.4, 0.14, 0.18), dark, 0, 6.16, pz, 0, 0, 0, 0);   // panel seams
  // the COCKPIT: a raised canopy on the hump, framed in beskar
  part(side([[3.0, 5.4], [6.4, 4.5], [7.0, 4.25], [6.2, 4.95], [4.6, 5.9], [3.0, 6.0]], 2.4, 0.35), glass, 0, 0, 0);
  part(new THREE.BoxGeometry(0.16, 1.4, 3.8), bes, 0, 5.45, 4.9, -0.36);
  // the WINGS: inverted gulls, up from the flanks then down to an engine at each tip
  for (const sx of [-1, 1]){
    // (the left wing is drawn mirrored, its points the other way round, so its faces still point out)
    const wing = (len, w0, w1, sweep) => { const P = [[0, -w0 / 2], [len, -w1 / 2 - sweep], [len, w1 / 2 - sweep], [0, w0 / 2]].map(([a, b]) => [a * sx, b]);
      if (sx < 0) P.reverse(); const sh = new THREE.Shape(); sh.moveTo(...P[0]); for (const q of P.slice(1)) sh.lineTo(...q);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.44, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 2 }); geo.rotateX(PI / 2); geo.translate(0, 0.22, 0); return geo; };
    part(wing(3.4, 7.2, 5.4, 1.2), hull, sx * 2.6, 3.4, -2.4, 0, 0, sx * 0.42);
    const ox = sx * (2.6 + 3.4 * Math.cos(0.42)), oy = 3.4 + 3.4 * Math.sin(0.42);
    part(wing(3.2, 5.4, 3.8, 1.0), hullD, ox, oy, -3.4, 0, 0, sx * -0.62);
    part(new THREE.BoxGeometry(0.2, 0.06, 3.0), paint, ox + sx * 0.4, oy + 0.4, -3.4, 0, 0, sx * -0.62, 0);
    // the wingtip ENGINE: a long nacelle, a beskar intake ring, the nozzle glowing
    const ex = ox + sx * 3.2 * Math.cos(0.62), ey = oy - 3.2 * Math.sin(0.62), ez = -4.6;
    part(new THREE.CylinderGeometry(1.0, 1.15, 6.4, 14), dark, ex, ey, ez, PI / 2);
    part(new THREE.CylinderGeometry(1.12, 1.12, 1.4, 14), hull, ex, ey, ez + 1.2, PI / 2);   // a painted collar
    part(new THREE.TorusGeometry(0.95, 0.14, 8, 18), toon(0x6a7078), ex, ey, ez + 3.2);
    part(new THREE.CylinderGeometry(1.2, 1.05, 0.7, 14), hullD, ex, ey, ez - 2.7, PI / 2);
    part(new THREE.CylinderGeometry(0.75, 0.75, 0.2, 14), dark, ex, ey, ez - 3.05, PI / 2, 0, 0, 0);
    const noz = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), jet); noz.position.set(ex, ey, ez - 3.16); noz.rotation.y = PI; g.add(noz);
    part(new THREE.ConeGeometry(0.45, 1.0, 10), dark, ex, ey, ez + 3.6, PI / 2);
    // a landing leg under each wing root: strut, oleo, foot and a brace back to the hull (world/arenas/ship-kit.js)
    { const l = leg({ dark, chrome: bes, trim: bes }, 1.95, { r: 0.18, pad: 0.65, brace: -0.9 }); l.position.set(sx * 2.4, 0, -6.0); g.add(l); inkAll(l); }
    // a running light at each engine's nose, and the intake grille at the wing root
    navLight(g, sx < 0 ? 0xff5a40 : 0x5aff8a, ex, ey + 1.05, ez + 2.4, 0.12);
    for (let k = 0; k < 4; k++) part(new THREE.BoxGeometry(0.06, 0.5, 1.6), dark, sx * (2.05 + k * 0.12), 3.0, 1.2, 0, 0, sx * 0.42, 0);
    // scuffed plates down the flank, the clan's ship well used
    for (const [pz, py, pw, ph] of [[-5.4, 2.6, 2.2, 0.9], [-1.4, 2.3, 1.6, 0.7], [2.2, 2.8, 1.8, 0.6]]) part(new THREE.BoxGeometry(0.05, ph, pw), hullD, sx * 2.82, py, pz, 0, 0, 0, 0);
  }
  { const l = leg({ dark, chrome: bes, trim: bes }, 1.95, { r: 0.18, pad: 0.6, brace: 0.9 }); l.position.set(0, 0, 7.5); g.add(l); inkAll(l); }   // the nose leg
  // PANEL SEAMS across the back and down the flanks, a sensor dome and aerials on the spine, the canopy's frame
  for (const pz of [-8.0, -4.8, -1.6, 1.6]){
    part(new THREE.BoxGeometry(4.6, 0.06, 0.07), dark, 0, 5.08, pz, 0, 0, 0, 0);
    for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.06, 2.6, 0.07), dark, sx * 2.82, 3.3, pz, 0, 0, 0, 0);
  }
  part(new THREE.SphereGeometry(0.42, 12, 8, 0, PI * 2, 0, PI / 2), bes, 0, 6.15, -4.6);
  for (const [ax, az, al] of [[0.8, -7.4, 1.4], [-0.9, -6.9, 0.9]]) part(new THREE.CylinderGeometry(0.03, 0.03, al, 4), dark, ax, 6.15 + al / 2, az, -0.2, 0, 0, 0);
  for (const fz of [4.0, 5.2]) part(new THREE.BoxGeometry(2.5, 0.1, 0.12), bes, 0, fz > 4.5 ? 5.25 : 5.75, fz, -0.4, 0, 0, 0);
  for (const pz of [-6.4, -3.0, 0.2]) part(new THREE.BoxGeometry(0.9, 0.22, 0.7), dark, 0.9, 6.2, pz);   // vents and boxes on the spine
  navLight(g, 0xffffff, 0, 7.6, -8.9, 0.1);
  // the FIN: swept back off the tail, the clan's mark in paint on it
  { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(-3.2, 3.6); sh.lineTo(-4.6, 3.6); sh.lineTo(-3.6, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 });
    geo.translate(0, 0, -0.18); geo.rotateY(-PI / 2); part(geo, hull, 0, 5.5, -5.2);
    part(new THREE.RingGeometry(0.42, 0.62, 16), paint, 0.3, 7.3, -8.6, 0, PI / 2, 0, 0);
    part(new THREE.RingGeometry(0.42, 0.62, 16), paint, -0.3, 7.3, -8.6, 0, -PI / 2, 0, 0); }
  // the MAIN THRUSTER in the tail, a pair of nozzles glowing
  part(side([[-11.6, 2.7], [-10.4, 2.4], [-10.4, 4.5], [-11.6, 4.1]], 3.6, 0.4), dark, 0, 0, 0);   // the tail cowl, narrowing aft
  for (const sx of [-1, 0, 1]){
    part(new THREE.CylinderGeometry(0.58, 0.68, 0.7, 14), toon(0x6a7078), sx * 1.3, 3.4, -12.2, PI / 2);
    const n = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), jet); n.position.set(sx * 1.3, 3.4, -12.56); n.rotation.y = PI; g.add(n);
  }
  for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.3, 2.6, 2.2), hullD, sx * 2.2, 3.3, -11.0);   // the cowl's cheeks
  // twin CANNONS under the chin
  for (const sx of [-1, 1]){
    part(new THREE.CylinderGeometry(0.16, 0.16, 3.0, 8), dark, sx * 0.8, 1.55, 9.4, PI / 2);
    part(new THREE.BoxGeometry(0.6, 0.6, 1.2), hullD, sx * 0.8, 1.6, 7.6);
  }
  // the RAMP: hinged at the back of the belly, lowered to the ground, the hold lit warm beyond it
  const B = 1.1, RL = 4.6, ang = Math.asin((B - 0.25) / RL);
  const ramp = new THREE.Group(); ramp.position.set(0, B, -8.2); ramp.rotation.x = -ang; g.add(ramp);
  { const rm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, RL), dark); rm.position.z = -RL / 2; rm.castShadow = true; inkify(rm, 0.05); ramp.add(rm);
    for (let k = 0; k < 6; k++){ const r = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.12), bes); r.position.set(0, 0.11, -0.5 - k * 0.7); ramp.add(r); } }
  const hold = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), hot); hold.position.set(0, 0.98, -9.5); hold.rotation.x = PI / 2; g.add(hold);   // the open hatch in the belly, lit
  // collision: columns down the hull, the engines, the ramp's steps (all turned with the ship)
  const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const [lz, r, h] of [[-8.6, 2.4, 5.2], [-4.6, 2.6, 5.6], [-0.4, 2.6, 5.6], [3.6, 2.5, 5.6], [7.4, 1.9, 4.0], [10.0, 1.1, 3.0]]){ const [px, pz] = at(0, lz); solids.push({ x: px, z: pz, r, h }); }
  for (const sx of [-1, 1]){
    const ex = sx * (2.6 + 3.4 * Math.cos(0.42) + 3.2 * Math.cos(0.62));
    for (const lz of [-6.8, -4.6, -2.4]){ const [px, pz] = at(ex, lz); solids.push({ x: px, z: pz, r: 1.15, y0: 1.6, h: 4.1 }); }
  }
  for (let k = 0; k < 3; k++){ const lz = -8.2 - RL * Math.cos(ang) * (k + 0.5) / 3, [px, pz] = at(0, lz); solids.push({ x: px, z: pz, r: 1.3, h: 0.2 + (B - 0.2) * (1 - (k + 0.5) / 3), climbable: true }); }
  return g;
}
