// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HERO SHIPS' CABINS (data/hero-ships.js): world/arena.js hands every sh* layout here. One plan for all three, dressed
// for its hero:
//   · the COCKPIT forward (north, −z): bulkheads close the room in to the nose, a curved dash of lit screens, two seats,
//     and a wide canopy looking out on the hub's world from orbit;
//   · the HOLD: a vaulted hull overhead (ribs, strip lights), the GALAXY TABLE in the middle with the galaxy turning over
//     it, the locker to port, the comms to starboard, and the hero's own furniture down both walls (the Jedi's meditation
//     benches, the trooper's jump seats, the Mando's crates and weapons wall);
//   · the RAMP aft (south): the way out into the hub (game/hub.js walks you through it like any door).
// Everything overhead or past the play square is a picture (no collision); the bulkheads, the dash, the table and the
// furniture on the floor are solid. On Low quality (phones) the extra dressing (ribs, the second row of props, the galaxy's
// stars) is thinned, and the whole cabin is one small wing, built alone behind the loading screen.

import * as THREE from 'three';
import { shared } from '../../state.js';
import { arenaKit, seeded } from './kit.js';
import { PI, std, glowM, holoM, live, anim, spinner, hubStations, hubDoorSigns } from './hub-kit.js';
import { HUBS, wingByLayout } from '../../data/hub.js';
import { SHIP_WING, homeWorld } from '../../data/hero-ships.js';
import { qualityLevel } from '../../engine/quality.js';
import { camera } from '../../engine/renderer.js';

// each ship's colours: hull, its darker panels, trim, the accent stripe, the lights, the holograms, and the world outside
const LOOK = {
  shJedi: { hub: 'temple', hull: 0xe6dfcf, hullD: 0xa49c8c, trim: 0xd8b860, accent: 0x2e6a8a, metal: 0x6a6e74, glow: 0xfff0d0, holo: 0x6fc8ff,
    floor: 0x8a7a64, seat: 0x2e6a8a, kind: 'jedi' },
  shTrooper: { hub: 'kamino', hull: 0xe8ecef, hullD: 0xa8b2bc, trim: 0x8ea0ae, accent: 0xc23a30, metal: 0x5a6672, glow: 0xd8f0ff, holo: 0x6ad8ff,
    floor: 0x6a7682, seat: 0x3e4852, kind: 'trooper' },
  shMando: { hub: 'covert', hull: 0x8c8e88, hullD: 0x4a4e52, trim: 0xd9a43a, accent: 0x6a2620, metal: 0x3a3e44, glow: 0xffc890, holo: 0xffb35a,
    floor: 0x4e4a46, seat: 0x5a3e2a, kind: 'mando' },
};

const pic = (m) => { m.castShadow = false; m.receiveShadow = false; m.userData.passThrough = true; return m; };   // overhead / past the edge

export function buildHeroShip(L){
  shared.hubAnim = [];
  const C = LOOK[L.layout] || LOOK.shJedi, found = wingByLayout(L.layout);
  const hubId = found ? found.hub : C.hub, Hb = HUBS[hubId], W = Hb.wings[SHIP_WING];
  const K = arenaKit(), R = seeded(L.layout.length * 53 + 7), H = shared.arenaHalf, low = qualityLevel() === 'low';
  const M = {
    hull: std(C.hull, 0.55, 0.18), hullD: std(C.hullD, 0.6, 0.3), trim: std(C.trim, 0.42, 0.6), accent: std(C.accent, 0.6, 0.1),
    metal: std(C.metal, 0.45, 0.6), seat: std(C.seat, 0.85, 0.05), dark: std(0x16181c, 0.7, 0.3),
    glow: glowM(C.glow), holo: holoM(C.holo, 0.4), screen: glowM(C.holo, 0.85),
  };
  const o = { K, M, C, H, R, low };
  shell(o);
  cockpit(o);
  galaxyTable(o);
  ({ jedi: jediHold, trooper: trooperHold, mando: mandoHold })[C.kind](o);
  ramp(o);
  outside(o, homeWorld(hubId));
  // every station's rings and sign, the console by the ramp a small lit post, the sign over the ramp
  hubStations(W, K, { ring: C.holo, tall: [], beacon: (x, z) => console_(o, x, z), sign: { ink: '#eaf6ff', edge: css(C.holo, 0.85) } });
  hubDoorSigns(W, Hb.wings, K, { signY: 4.6, runner: C.holo, sign: { ink: '#eaf6ff', edge: css(C.holo, 0.85) } });
}
const css = (c, a) => { const k = new THREE.Color(c); return 'rgba(' + Math.round(k.r * 255) + ',' + Math.round(k.g * 255) + ',' + Math.round(k.b * 255) + ',' + a + ')'; };

/* ---------------- the hull ---------------- */
const WALL_H = 4.2;   // the side walls' height, where the vault springs
const RISE = 3.0;     // how far the vault climbs over the walls
const NOSE = -6.2;    // z where the hold narrows into the cockpit
const NOSE_W = 5.2;   // the cockpit's half-width
const FRAME = 3.2;    // the hull's frames, this far apart down the hold
function shell({ K, M, C, H, low }){
  const g = shared.arenaGroup, off = H + 0.9, len = off * 2;
  const frames = []; for (let z = NOSE + 1.6; z < H - 0.5; z += FRAME) frames.push(z);
  // the side walls: a kick plate, a lit seam, the wall leaning in toward the vault, the accent band
  for (const sx of [-1, 1]){
    pic(K.deco(new THREE.BoxGeometry(0.6, 2.2, len), M.hullD, sx * off, 1.1, 0));
    pic(K.deco(new THREE.BoxGeometry(0.2, 0.08, len), M.glow, sx * (off - 0.36), 2.25, 0));
    pic(K.deco(new THREE.BoxGeometry(0.6, WALL_H - 2.2, len), M.hull, sx * (off - 0.15), 2.2 + (WALL_H - 2.2) / 2, 0, 0, 0, sx * 0.12));
    pic(K.deco(new THREE.BoxGeometry(0.7, 0.3, len), M.accent, sx * (off - 0.3), 1.6, 0));
    pic(K.deco(new THREE.BoxGeometry(0.5, 0.3, len), M.metal, sx * (off - 0.4), 0.15, 0));   // the deck's edge, a step up to the wall
    // CONDUITS: three pipes along the top of the wall, held to each frame by a bracket
    for (const [py, pr, mat] of [[3.2, 0.11, M.metal], [3.48, 0.08, M.accent], [3.72, 0.13, M.dark]]) pic(K.deco(new THREE.CylinderGeometry(pr, pr, len, 8), mat, sx * (off - 0.75 - (py - 3.2) * 0.22), py, 0, PI / 2));
  }
  // the FRAMES: a rib up each wall and over the vault every few metres, a lamp on each, and between them the wall's
  // fittings in turn: a lit panel, a stowage hatch, a breaker box
  frames.forEach((z, i) => {
    for (const sx of [-1, 1]){
      pic(K.deco(new THREE.BoxGeometry(0.55, WALL_H + 0.3, 0.4), M.metal, sx * (off - 0.55), (WALL_H + 0.3) / 2, z, 0, 0, sx * 0.06));
      pic(K.deco(new THREE.BoxGeometry(0.62, 0.5, 0.5), M.dark, sx * (off - 0.6), 0.25, z));
      if (!low) live(K.deco(new THREE.BoxGeometry(0.12, 0.5, 0.18), M.glow, sx * (off - 0.86), 2.75, z));
      const mid = z + FRAME / 2; if (mid > H - 0.8) continue;
      const kind = (i + (sx > 0 ? 1 : 0)) % 3;
      if (kind === 0){   // a lit panel: a frame and a screen of soft light
        pic(K.deco(new THREE.BoxGeometry(0.2, 1.3, 2.0), M.hullD, sx * (off - 0.42), 2.9, mid, 0, 0, sx * 0.12));
        const sc = live(K.deco(new THREE.PlaneGeometry(1.7, 1.0), glowM(C.holo, 0.35), sx * (off - 0.55), 2.9, mid, 0, sx * -PI / 2, 0)); sc.rotation.z = sx * -0.12;
      } else if (kind === 1){   // a stowage hatch: a raised plate, its seam and a handle
        pic(K.deco(new THREE.BoxGeometry(0.14, 1.6, 1.9), M.hullD, sx * (off - 0.3), 1.0, mid));
        pic(K.deco(new THREE.BoxGeometry(0.16, 0.06, 1.7), M.dark, sx * (off - 0.31), 1.2, mid));
        pic(K.deco(new THREE.BoxGeometry(0.2, 0.12, 0.5), M.trim, sx * (off - 0.4), 0.9, mid));
      } else {   // a breaker box: a dark cabinet, a row of lit tells
        pic(K.deco(new THREE.BoxGeometry(0.4, 0.9, 1.1), M.dark, sx * (off - 0.5), 1.2, mid));
        if (!low) for (let k = 0; k < 4; k++) live(K.deco(new THREE.BoxGeometry(0.05, 0.08, 0.08), glowM(k % 2 ? C.holo : 0x7aff9a), sx * (off - 0.72), 1.45, mid - 0.36 + k * 0.24));
      }
    }
  });
  // the VAULT: a flattened half-barrel over the whole room, its inside lit a little so it reads, the frames' ribs over
  // it, a cable tray down the crown with the lamps hung from it
  const vault = new THREE.Group(); vault.position.y = WALL_H; vault.scale.y = RISE / off; g.add(vault);
  const skin = std(C.hullD, 0.7, 0.2, 0.25); skin.side = THREE.BackSide;
  const barrel = pic(new THREE.Mesh(new THREE.CylinderGeometry(off, off, len, 28, 1, true, -PI / 2, PI), skin));
  barrel.rotation.x = -PI / 2; vault.add(barrel);   // (its axis along z, the half-round arching up)
  for (const z of frames){
    const rib = pic(new THREE.Mesh(new THREE.TorusGeometry(off - 0.25, 0.26, 5, 24, PI), M.metal));
    rib.position.z = z; vault.add(rib);
  }
  const crown = WALL_H + RISE - 0.35;
  pic(K.deco(new THREE.BoxGeometry(1.4, 0.24, len - 2), M.dark, 0, crown, 0));
  for (const sx of [-1, 1]) pic(K.deco(new THREE.CylinderGeometry(0.1, 0.1, len - 2, 8), M.metal, sx * 0.9, crown - 0.1, 0, PI / 2));
  for (const z of frames){
    if (z > H - 1) continue;
    pic(K.deco(new THREE.BoxGeometry(1.0, 0.3, 0.6), M.metal, 0, crown - 0.3, z + FRAME / 2));
    live(K.deco(new THREE.BoxGeometry(0.8, 0.06, 0.4), M.glow, 0, crown - 0.47, z + FRAME / 2));
  }
  for (const sx of [-0.5, 0.5]){
    const strip = pic(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, len - 6), M.glow));
    strip.position.set(sx * off, off * 0.86, 0); vault.add(strip);
  }
  // the end walls past the edge: the cockpit's (round the canopy) and the aft (round the ramp's opening)
  const endH = WALL_H + RISE;
  for (const sx of [-1, 1]){
    pic(K.deco(new THREE.BoxGeometry(off - NOSE_W, endH, 0.6), M.hullD, sx * (NOSE_W + (off - NOSE_W) / 2), endH / 2, -off));
    pic(K.deco(new THREE.BoxGeometry(off - 5.6, endH, 0.6), M.hull, sx * (5.6 + (off - 5.6) / 2), endH / 2, off));
  }
  pic(K.deco(new THREE.BoxGeometry(11.2, endH - 3.4, 0.6), M.hull, 0, 3.4 + (endH - 3.4) / 2, off));   // over the ramp's mouth
  // the DECK: plates with their seams, a grated walkway down the middle from the ramp to the cockpit, lit along its edges,
  // and a hazard stripe where the deck meets the ramp
  const plate = std(C.floor, 0.75, 0.25);
  K.deco(new THREE.BoxGeometry(H * 2, 0.04, H * 2), plate, 0, 0.02, 0).receiveShadow = true;
  for (let z = -H + 2; z < H; z += 2.6) live(K.deco(new THREE.BoxGeometry(H * 2 - 2, 0.02, 0.05), M.metal, 0, 0.05, z));
  for (const x of [-7.5, 7.5]) live(K.deco(new THREE.BoxGeometry(0.05, 0.02, H * 2 - 2), M.metal, x, 0.05, 0));
  const walk = std(0x2a2e34, 0.6, 0.6);
  K.deco(new THREE.BoxGeometry(2.4, 0.06, H * 2 + NOSE), walk, 0, 0.05, (H + NOSE) / 2 + 0.2).receiveShadow = true;
  if (!low) for (let z = NOSE + 0.4; z < H; z += 0.5) live(K.deco(new THREE.BoxGeometry(2.2, 0.02, 0.08), M.metal, 0, 0.09, z));
  for (const sx of [-1, 1]) live(K.deco(new THREE.BoxGeometry(0.08, 0.03, H * 2 + NOSE), glowM(C.holo, 0.6), sx * 1.25, 0.08, (H + NOSE) / 2 + 0.2));
  for (let i = 0; i < 12; i++) live(K.deco(new THREE.BoxGeometry(0.6, 0.02, 0.5), std(i % 2 ? 0x16181c : 0xd9a43a, 0.7), -5.5 + i * 1.0, 0.06, H - 0.4, 0, 0.6, 0));
}

/* ---------------- the cockpit ---------------- */
function cockpit({ K, M, C, H, R, low }){
  // the BULKHEADS closing the room in to the nose (solid to the vault)
  const bw = (H - NOSE_W) / 2, bz = (NOSE - H) / 2, bd = (H + NOSE) / 2;   // half-width, middle z and half-depth of each
  for (const sx of [-1, 1]){
    K.box(sx * (NOSE_W + bw), bz, bw, bd, WALL_H + 1.2, M.hullD);
    pic(K.deco(new THREE.BoxGeometry(bw * 2 + 0.05, 0.3, 0.2), M.glow, sx * (NOSE_W + bw), 2.4, NOSE + 0.02));
    // a lit doorframe edge where the hold meets the cockpit
    K.column(sx * (NOSE_W + 0.25), NOSE, 0.35, WALL_H + 1.2, M.metal, { wallKick: false, seg: 8, taper: 1 });
  }
  pic(K.deco(new THREE.BoxGeometry(NOSE_W * 2, 0.6, 0.8), M.metal, 0, WALL_H + 0.9, NOSE));   // the lintel
  // the bulkheads' faces to the hold: a hatch frame's chamfered corners, a panel of screens and a pipe run on each
  for (const sx of [-1, 1]){
    pic(K.deco(new THREE.BoxGeometry(1.2, 0.4, 0.5), M.metal, sx * (NOSE_W - 0.4), WALL_H + 0.35, NOSE + 0.1, 0, 0, sx * -0.7));
    const fx = sx * (NOSE_W + bw);
    pic(K.deco(new THREE.BoxGeometry(bw * 1.4, 1.6, 0.12), M.dark, fx, 2.2, NOSE + 0.08));
    for (let k = -1; k <= 1; k++){ const sc = live(K.deco(new THREE.PlaneGeometry(bw * 0.38, 1.1), M.screen, fx + k * bw * 0.45, 2.25, NOSE + 0.16)); anim(sc, (m, t) => { m.material.opacity = 0.55 + Math.sin(t * (0.8 + k * 0.3) + sx) * 0.2; }); }
    for (const py of [0.6, 0.9]) pic(K.deco(new THREE.CylinderGeometry(0.07, 0.07, bw * 2, 6), M.metal, fx, py, NOSE + 0.12, 0, 0, PI / 2));
  }
  // the DASH: a low curve of consoles across the nose, screens lit along its top, two SEATS in front of it
  const dz = -H + 1.6;
  K.box(0, dz, NOSE_W - 0.6, 0.7, 1.05, M.dark);
  for (let i = -2; i <= 2; i++){
    const s = live(K.deco(new THREE.PlaneGeometry(1.7, 0.55), M.screen, i * 2.1, 1.18, dz + 0.1, -PI / 2 + 0.55));
    anim(s, (m, t) => { m.material.opacity = 0.65 + Math.sin(t * (1.3 + i * 0.4) + i) * 0.2; });
    if (!low) for (let k = 0; k < 6; k++) live(K.deco(new THREE.BoxGeometry(0.12, 0.05, 0.12), glowM(R() < 0.5 ? C.holo : 0xff7a5a), i * 2.1 - 0.7 + k * 0.28, 1.08, dz - 0.4));
  }
  K.deco(new THREE.BoxGeometry(NOSE_W * 2 - 1, 0.1, 1.6), M.trim, 0, 1.06, dz);
  for (const sx of [-1, 1]){
    const x = sx * 2.4, z = dz + 2.6;
    K.box(x, z, 0.55, 0.55, 0.55, M.metal);
    K.deco(new THREE.BoxGeometry(1.1, 0.25, 1.1), M.seat, x, 0.68, z);
    pic(K.deco(new THREE.BoxGeometry(1.1, 1.5, 0.22), M.seat, x, 1.45, z + 0.55, -0.15));
    K.deco(new THREE.BoxGeometry(1.2, 0.1, 0.3), M.trim, x, 2.2, z + 0.62);
  }
  // the CANOPY: struts across the nose, and the glass (a picture, lit faintly from outside)
  const cz = -H - 0.9, gy0 = 1.3, gy1 = WALL_H + RISE - 0.6;
  const glass = new THREE.MeshBasicMaterial({ color: 0x9ad8f0, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  pic(K.deco(new THREE.PlaneGeometry(NOSE_W * 2, gy1 - gy0), glass, 0, (gy0 + gy1) / 2, cz + 0.05)).userData.noBake = true;
  pic(K.deco(new THREE.BoxGeometry(NOSE_W * 2 + 0.6, gy0, 0.6), M.hullD, 0, gy0 / 2, cz));
  pic(K.deco(new THREE.BoxGeometry(NOSE_W * 2 + 0.6, 0.6, 0.8), M.hullD, 0, gy1 + 0.3, cz));
  for (const x of [-NOSE_W, -NOSE_W / 3, NOSE_W / 3, NOSE_W]) pic(K.deco(new THREE.BoxGeometry(0.3, gy1 - gy0, 0.4), M.metal, x, (gy0 + gy1) / 2, cz));
  pic(K.deco(new THREE.BoxGeometry(NOSE_W * 2, 0.25, 0.4), M.metal, 0, gy0 + (gy1 - gy0) * 0.55, cz));
}

/* ---------------- the galaxy table ---------------- */
function galaxyTable({ K, M, C, R, low }){
  const x = 0, z = -0.5;
  K.column(x, z, 2.1, 0.95, M.dark, { wallKick: false, seg: 24, taper: 1 });
  K.deco(new THREE.CylinderGeometry(2.3, 2.3, 0.12, 24), M.trim, x, 1.0, z);
  live(K.deco(new THREE.RingGeometry(1.7, 2.0, 40), glowM(C.holo, 0.75), x, 1.07, z, -PI / 2));
  live(K.deco(new THREE.RingGeometry(3.2, 3.4, 48), glowM(C.holo, 0.35), x, 0.06, z, -PI / 2));
  // the hologram: a spiral galaxy of points turning over the table, its core bright, a faint beam up from the rim
  const gal = new THREE.Group(); gal.position.set(x, 2.3, z); shared.arenaGroup.add(gal);
  const P = [], Cs = [], col = new THREE.Color(C.holo), hi = new THREE.Color(0xffffff);
  const n = low ? 420 : 1100;
  for (let i = 0; i < n; i++){
    const arm = i % 4, d = Math.pow(R(), 0.6) * 1.9, a = arm * PI / 2 + d * 2.0 + (R() - 0.5) * 0.45;
    P.push(Math.cos(a) * d, (R() - 0.5) * 0.18 * (1 - d / 2), Math.sin(a) * d);
    const c = col.clone().lerp(hi, Math.max(0, 1 - d / 1.4) * 0.8); Cs.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(Cs, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.userData.noBake = true; pts.userData.passThrough = true; gal.add(pts);
  gal.add(live(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), glowM(0xfff4e0))));
  // a few worlds marked on it, a tick of light each
  for (let i = 0; i < 7; i++){ const a = R() * PI * 2, d = 0.6 + R() * 1.2; const m = live(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), glowM(0xffe8a0))); m.position.set(Math.cos(a) * d, 0.05, Math.sin(a) * d); gal.add(m); }
  const beam = live(new THREE.Mesh(new THREE.CylinderGeometry(2.0, 1.9, 1.2, 28, 1, true), holoM(C.holo, 0.07))); beam.position.y = -0.7; gal.add(beam);
  // turning, and fading out of the way when the follow-cam swings through it (walking past it to the cockpit)
  const mats = [pts.material, beam.material], full = mats.map(m => m.opacity), at = new THREE.Vector3(x, 2.3, z);
  anim(gal, (g, t) => { g.rotation.y = t * 0.15; const k = THREE.MathUtils.clamp((camera.position.distanceTo(at) - 4.5) / 2, 0, 1); mats.forEach((m, i) => { m.opacity = full[i] * k; }); g.visible = k > 0.02; });
}

/* ---------------- each hero's hold ---------------- */
const SIDE_X = (H) => H - 1.4;   // where the furniture stands along each wall
// the LOCKER to port (x −) and the COMMS to starboard (x +): the stations' own furniture, the same spots on every ship
function lockerAndComms({ K, M, C, H }, lockerArt){
  const wx = SIDE_X(H);
  lockerArt(-wx, 3);
  // the comms: a wall console, three screens over it, a call blinking on one
  K.box(wx + 0.3, 3, 0.6, 1.6, 1.1, M.dark);
  for (let i = -1; i <= 1; i++){
    const s = live(K.deco(new THREE.PlaneGeometry(0.9, 0.7), M.screen, wx - 0.05, 2.0, 3 + i * 1.0, 0, -PI / 2));
    anim(s, (m, t) => { m.material.opacity = i === 0 ? (Math.sin(t * 4) > 0 ? 0.95 : 0.35) : 0.55 + Math.sin(t * 0.9 + i) * 0.15; });
  }
  K.deco(new THREE.BoxGeometry(0.4, 0.08, 3.4), M.trim, wx - 0.1, 1.14, 3);
}
function jediHold(o){
  const { K, M, C, H, low } = o, wx = SIDE_X(H);
  lockerAndComms(o, (x, z) => {   // the saber bench: a low worktable, a crystal glowing in its clamp, a hilt laid out
    K.box(x, z, 0.8, 1.5, 0.95, M.hullD);
    K.deco(new THREE.BoxGeometry(1.7, 0.08, 3.1), M.trim, x, 0.98, z);
    const k = live(K.deco(new THREE.OctahedronGeometry(0.16), glowM(C.holo), x + 0.2, 1.25, z - 0.6));
    anim(k, (m, t) => { m.rotation.y = t; });
    K.deco(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), M.metal, x + 0.2, 1.06, z + 0.5, 0, 0, PI / 2);
  });
  // meditation benches down both walls, cushions on them, a lamp between each pair
  for (const sx of [-1, 1]) for (const z of sx < 0 ? [-4, 9] : [-4, 9]){
    K.box(sx * wx, z, 0.7, 1.6, 0.45, M.hullD, { climbable: true });
    for (const dz of [-0.8, 0.8]) K.deco(new THREE.CylinderGeometry(0.42, 0.45, 0.16, 10), M.seat, sx * wx, 0.53, z + dz);
  }
  if (!low) for (const sx of [-1, 1]) for (const z of [-5.4, 6.6]){
    K.column(sx * (wx + 0.2), z, 0.14, 1.8, M.metal, { wallKick: false, seg: 6, taper: 1 });
    live(K.deco(new THREE.SphereGeometry(0.22, 10, 8), glowM(0xffe2a8), sx * (wx + 0.2), 1.95, z));
  }
  // the Order's banners on the walls by the cockpit
  for (const sx of [-1, 1]) K.banner(sx * (H + 0.4), 2.6, -5.2, sx * -PI / 2, 1.4, 2.6, C.accent, C.trim, 0xffe0a0);
}
function trooperHold(o){
  const { K, M, C, H, low } = o, wx = SIDE_X(H);
  lockerAndComms(o, (x, z) => {   // the gear locker: three tall lockers, a unit stripe across them, lit tags
    for (const dz of [-1.1, 0, 1.1]){
      K.box(x - 0.1, z + dz, 0.55, 0.5, 2.5, M.hull);
      K.deco(new THREE.BoxGeometry(1.15, 0.25, 1.0), M.accent, x - 0.1, 1.7, z + dz);
      live(K.deco(new THREE.PlaneGeometry(0.3, 0.12), M.screen, x + 0.47, 2.1, z + dz, 0, PI / 2));
    }
  });
  // JUMP SEATS down both walls: a bench, a seat back each, the harness bars up over them, and grab rails overhead
  for (const sx of [-1, 1]) for (const [z0, z1] of [[-5.2, -0.6], [5.6, 10.6]]){
    const zc = (z0 + z1) / 2, hz = (z1 - z0) / 2;
    K.box(sx * (wx + 0.3), zc, 0.5, hz, 0.55, M.metal);
    for (let z = z0 + 0.6; z < z1; z += 1.1){
      K.deco(new THREE.BoxGeometry(0.85, 0.12, 0.9), M.seat, sx * (wx + 0.25), 0.62, z);
      pic(K.deco(new THREE.BoxGeometry(0.15, 1.3, 0.8), M.hullD, sx * (wx + 0.75), 1.3, z));
      if (!low) pic(K.deco(new THREE.TorusGeometry(0.32, 0.04, 5, 12, PI), M.accent, sx * (wx + 0.45), 1.85, z, 0, PI / 2, 0));
    }
    pic(K.deco(new THREE.CylinderGeometry(0.05, 0.05, z1 - z0, 6), M.metal, sx * (wx - 0.6), 3.0, zc, PI / 2, 0, 0));
  }
  // the unit's stripe down the floor either side of the runner, and a squad's helmets hung by the ramp
  for (const sx of [-1, 1]) live(K.deco(new THREE.PlaneGeometry(0.35, H * 2 - 6), glowM(C.accent, 0.35), sx * 2.2, 0.055, 1, -PI / 2));
  for (let i = 0; i < 4; i++) K.deco(new THREE.SphereGeometry(0.26, 10, 8, 0, PI * 2, 0, PI * 0.62), M.hull, -wx - 0.4, 2.6, 6.2 + i * 0.7);
}
function mandoHold(o){
  const { K, M, C, H, R, low } = o, wx = SIDE_X(H);
  lockerAndComms(o, (x, z) => {   // the weapons wall: a rack of long guns and two blasters on a dark plate
    K.box(x - 0.3, z, 0.4, 1.8, 2.6, M.dark);
    for (let i = 0; i < 4; i++) K.deco(new THREE.BoxGeometry(0.14, 1.5, 0.16), M.metal, x + 0.15, 1.6, z - 1.2 + i * 0.8, 0, 0, 0.08);
    for (const dz of [-0.5, 0.5]) K.deco(new THREE.BoxGeometry(0.12, 0.25, 0.5), M.trim, x + 0.15, 2.45, z + dz);
  });
  // CRATES lashed down along both walls, a strap of the clan's gold over each stack
  const crate = std(0x5a4632, 0.85), band = M.trim;
  for (const [x, z, n] of [[-wx, -5, 2], [-wx, 9, 3], [wx, -5, 1], [wx, 9, 2], [-wx + 1.6, 10.2, 1]]){
    for (let k = 0; k < n; k++){
      const cz = z + (k === 1 ? 1.4 : 0), y = k === 2 ? 1.2 : 0;
      K.box(x, cz, 0.6, 0.6, 1.2, crate, { y, climbable: k === 0 });
      K.deco(new THREE.BoxGeometry(1.24, 0.12, 1.24), band, x, y + 0.85, cz);
    }
  }
  // the clan's band in gold round the hold, and a few beskar ingots by the weapons wall
  for (const sx of [-1, 1]) pic(K.deco(new THREE.BoxGeometry(0.7, 0.28, H * 2), M.trim, sx * (H + 0.6), 3.3, 0));
  if (!low) for (let i = 0; i < 3; i++) K.deco(new THREE.BoxGeometry(0.5, 0.18, 0.24), std(0xb0b8c0, 0.32, 0.9), -wx + 1.0, 0.1 + i * 0.19, 6.0 + (R() - 0.5) * 0.2);
  // a carbon-scored hull plate patched over the starboard wall, and a hanging lamp swinging a little
  if (!low){ const lamp = live(K.deco(new THREE.SphereGeometry(0.25, 10, 8), glowM(0xffc070), 0, WALL_H + 1.4, 6)); anim(lamp, (m, t, b) => { m.position.x = b.x + Math.sin(t * 0.8) * 0.15; }); }
  void C;
}

/* ---------------- the ramp ---------------- */
function ramp({ K, M, C, H }){
  const z0 = H - 0.2, z1 = H + 6, drop = 1.8, l = Math.hypot(z1 - z0, drop);
  const r = pic(K.deco(new THREE.BoxGeometry(10.6, 0.2, l), M.hullD, 0, -drop / 2, (z0 + z1) / 2));
  r.rotation.x = Math.atan2(drop, z1 - z0);
  for (const sx of [-1, 1]){
    const e = live(K.deco(new THREE.BoxGeometry(0.12, 0.12, l), glowM(C.holo, 0.9), sx * 5.1, -drop / 2 + 0.14, (z0 + z1) / 2));
    e.rotation.x = Math.atan2(drop, z1 - z0);
    K.column(sx * 5.9, H - 0.2, 0.4, WALL_H, M.metal, { wallKick: false, seg: 8, taper: 1 });
  }
  // the light from the hub coming up the ramp, and the hatch's frame
  pic(K.deco(new THREE.PlaneGeometry(10.6, 3.6), new THREE.MeshBasicMaterial({ color: 0xfff0d8, fog: false, toneMapped: false }), 0, 1.0, H + 6.2));
  pic(K.deco(new THREE.BoxGeometry(11.6, 0.4, 0.8), M.trim, 0, 3.6, H + 0.6));
}

/* a small console post: the DISEMBARK station (act 'travel': the hub's map) */
function console_({ K, M, C }, x, z){
  K.column(x, z, 0.45, 1.1, M.dark, { wallKick: false, seg: 8, taper: 0.8 });
  const s = live(K.deco(new THREE.PlaneGeometry(0.8, 0.5), M.screen, x, 1.3, z - 0.1, -0.6));
  anim(s, (m, t) => { m.material.opacity = 0.6 + Math.sin(t * 1.7) * 0.2; });
  void C;
}

/* ---------------- outside the canopy: the hub's world from orbit ----------------
   (inside the sky dome, which is only the arena's width and a bit: a small world, close, reads as a big one far off) */
function outside({ C }, world){
  const g = shared.arenaGroup, col = new THREE.Color(world.col || '#7fb7d8');
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d'), R = seeded(world.id.length * 31 + 3);
  c.fillStyle = '#' + col.getHexString(); c.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 26; i++){   // bands of cloud and land
    const y = R() * 128, h = 2 + R() * 9, k = R() < 0.5 ? col.clone().offsetHSL(0, -0.1, 0.18) : col.clone().offsetHSL(0.02, 0, -0.14);
    c.fillStyle = '#' + k.getHexString(); c.globalAlpha = 0.5 + R() * 0.4; c.fillRect(0, y, 256, h);
  }
  c.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const planet = new THREE.Mesh(new THREE.SphereGeometry(10, 40, 24), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  planet.position.set(-9, 4, -36);   // (inside the sky dome: arena × 1.7) planet.rotation.z = 0.35;
  planet.userData.noBake = true; planet.userData.passThrough = true; planet.castShadow = false; planet.receiveShadow = false;
  g.add(planet);
  // its night side: a dark sphere offset toward us, so the world reads lit from one side
  const shade = new THREE.Mesh(new THREE.SphereGeometry(10.1, 40, 24, 0, PI * 2, 0, PI), new THREE.MeshBasicMaterial({ color: 0x02040a, transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
  shade.position.copy(planet.position); shade.rotation.set(0.3, 0, -1.9); shade.userData.noBake = true; shade.userData.passThrough = true; g.add(shade);
  const halo = new THREE.Mesh(new THREE.RingGeometry(10, 11, 64), new THREE.MeshBasicMaterial({ color: col.clone().offsetHSL(0, 0, 0.2), transparent: true, opacity: 0.35, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  halo.position.copy(planet.position); halo.userData.noBake = true; halo.userData.passThrough = true; g.add(halo);
  anim(planet, (m, t) => { m.rotation.y = t * 0.01; });
  void C;
}
