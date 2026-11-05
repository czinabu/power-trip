// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CLONE CITADEL ON KAMINO: the ARC trooper's hub, its five wings (data/hub-kamino.js). Each wing is its own arena
// build, like the temple's (world/arenas/tython.js): only the one you stand in is ever in memory. They're the citadel's
// PRESSURE HALLS: smooth white walls, a low dome of ribbed panels over every room, long ribbon windows streaming with
// rain, and the storm (lightning off the sea, data/worlds.js KM_STORM) lighting the lot. The Hangar Deck is the grand
// one: its east and west walls are open hangar mouths onto the storm, gunships on their pads, the army drilling.
//
// Stations, door signs and the moving things all come from world/arenas/hub-kit.js, as the temple's do.

import * as THREE from 'three';
import { shared, solids } from '../../state.js';
import { arenaKit, seeded } from './kit.js';
import { HUBS, SIDE_OUT, wingByLayout } from '../../data/hub.js';
import { PI, std, glowM, holoM, live, anim, spinner, roundStep, hubStations, hubDoorSigns } from './hub-kit.js';
import { buildEnemyMesh } from '../../enemies/mesh.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* the dispatcher: world/arena.js hands every km* layout here */
export function buildCloneCitadel(L){
  shared.hubAnim = [];
  const wings = HUBS.kamino.wings, found = wingByLayout(L.layout), wing = found && found.hub === 'kamino' ? found.id : 'deck';
  const pal = { ...PAL, ...(L.pal || {}) }, K = arenaKit(), R = seeded(wing.length * 37 + 11), W = wings[wing];
  const M = mats(pal);
  ({ deck, warroom, range, halls, armory })[wing](K, pal, M, R);
  hubStations(W, K, { ring: pal.holo, beacon: (x, z) => beacon(K, M, x, z), sign: { ink: '#d8f0ff', edge: 'rgba(120,210,255,.85)' } });
  hubDoorSigns(W, wings, K, { runner: pal.holo, signY: 13, sign: { ink: '#d8f0ff', edge: 'rgba(120,210,255,.85)' } });
}

const PAL = { wall: 0xe8ecef, wallD: 0xb8c2ca, panel: 0xd2d9df, trim: 0x8ea0ae, metal: 0x9aa6b2, metalD: 0x3e4852, glass: 0x9ad8f0,
  glow: 0xd8f0ff, holo: 0x6ad8ff, red: 0xc23a30, blue: 0x2f7fd6, sea: 0x20384a, pod: 0xffb84a, podFluid: 0x5ad0c0, rack: 0x4a545e, mat: 0x5a6672 };
function mats(p){
  return {
    wall: std(p.wall, 0.5, 0.12), wallD: std(p.wallD, 0.55, 0.15), panel: std(p.panel, 0.45, 0.2), trim: std(p.trim, 0.4, 0.45),
    metal: std(p.metal, 0.4, 0.55), metalD: std(p.metalD, 0.55, 0.45), red: std(p.red, 0.6, 0.1), blue: std(p.blue, 0.6, 0.1),
    rack: std(p.rack, 0.6, 0.4), mat: std(p.mat, 0.85, 0.05), white: std(0xf4f6f8, 0.5, 0.1),
    glow: glowM(p.glow), holo: holoM(p.holo, 0.4), holoDim: holoM(p.holo, 0.16), screen: glowM(p.holo, 0.85),
    rain: rainGlass(p.glass),
  };
}
// a picture only: no shadow, and the collision audit skips it
const pic = (m) => { m.castShadow = false; m.userData.passThrough = true; return m; };

/* GLASS IN THE RAIN: a pane with streaks running down it (one texture for the whole wing, scrolled every frame) */
function rainGlass(tint){
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const c = cv.getContext('2d'), R = seeded(5);
  c.fillStyle = 'rgba(200,230,255,0.10)'; c.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 70; i++){
    const x = R() * 128, y = R() * 256, l = 10 + R() * 40;
    c.strokeStyle = 'rgba(230,245,255,' + (0.18 + R() * 0.3).toFixed(2) + ')'; c.lineWidth = 0.8 + R() * 1.2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 3, y + l); c.stroke();
    c.fillStyle = 'rgba(240,250,255,0.45)'; c.beginPath(); c.arc(x, y + l, 1.2, 0, PI * 2); c.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ color: tint, map: tex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const holder = new THREE.Object3D(); holder.userData.noBake = true; shared.arenaGroup.add(holder);
  anim(holder, (o, t) => { tex.offset.y = t * 0.35; });
  return m;
}

/* ---------------- THE SHELL: walls, ribbon windows, doors, the dome ---------------- */
// o: wallH, rise (the dome above the walls), doors (sides), win [y0, y1] (the ribbon windows), winBy { side: [y0, y1] } (a
// side's own), bay (pilaster spacing), open { side: top } (a hangar mouth from the floor to `top`, a bulkhead round the
// door), doorW, doorH
function shell(K, M, pal, o){
  const g = shared.arenaGroup, H = shared.arenaHalf, off = H + 2, len = off * 2 + 2, Wh = o.wallH, T = 1.6, bay = o.bay ?? 7;
  const dW = o.doorW ?? 10, dH = o.doorH ?? 12;
  const put = (side, geo, mat, a, y, d) => {
    const [ox, oz] = SIDE_OUT[side];
    const m = K.deco(geo, mat, ox ? ox * d : a, y, oz ? oz * d : a);
    if (ox) m.rotation.y = PI / 2;
    return pic(m);
  };
  // a run of wall from a0 to a1 along the side, y0 to y1 high, with gaps cut where `cuts` say
  const run = (side, a0, a1, y0, y1, cuts = [], mat = M.wall) => {
    if (y1 - y0 < 0.01) return;
    let from = a0;
    for (const [c0, c1] of [...cuts.filter(c => c[1] > a0 && c[0] < a1).sort((p, q) => p[0] - q[0]), [a1, a1]]){
      if (c0 - from > 0.01) put(side, new THREE.BoxGeometry(c0 - from, y1 - y0, T), mat, (from + c0) / 2, (y0 + y1) / 2, off + T / 2);
      from = Math.max(from, c1);
    }
  };
  const bays = [];
  for (let a = -off + bay; a < off - bay * 0.5; a += bay) bays.push(a);
  for (const side of ['n', 's', 'e', 'w']){
    const door = (o.doors || []).includes(side), mouthTop = o.open && o.open[side];
    const [w0, w1] = (o.winBy && o.winBy[side]) || o.win || [Wh * 0.45, Wh * 0.8];
    const doorCut = door ? [[-dW / 2, dW / 2]] : [];
    const winCuts = bays.slice(0, -1).map((a, i) => [a + 0.6, bays[i + 1] - 0.6]).filter(([c0, c1]) => c1 - c0 > 1.5);
    if (mouthTop){
      const tw = dW + 10;   // the bulkhead round the door
      run(side, -tw / 2, tw / 2, 0, dH, doorCut, M.wallD); run(side, -tw / 2, tw / 2, dH, mouthTop, [], M.wallD);
      run(side, -len / 2, len / 2, mouthTop, Wh, []);
      // the mouth's lintel: a heavy beam with a strip of light under it, and the deck running on out into the rain
      put(side, new THREE.BoxGeometry(len, 1.4, 3.2), M.metalD, 0, mouthTop + 0.7, off - 0.6);
      put(side, new THREE.BoxGeometry(len, 0.18, 0.5), M.glow, 0, mouthTop - 0.1, off - 1.6);
      for (const s of [-1, 1]) for (let a = tw / 2 + 9; a < off; a += 14) put(side, new THREE.BoxGeometry(1.6, mouthTop, 1.6), M.metal, s * a, mouthTop / 2, off + 0.4);   // the mouth's piers
      apron(K, M, pal, side, off, len);
    } else {
      run(side, -len / 2, len / 2, 0, door ? dH : 0, doorCut);
      run(side, -len / 2, len / 2, door ? dH : 0, w0, []);
      run(side, -len / 2, len / 2, w0, w1, winCuts);
      run(side, -len / 2, len / 2, w1, Wh, []);
      for (const [c0, c1] of winCuts){   // the panes, streaming with rain, a sill under each
        put(side, new THREE.PlaneGeometry(c1 - c0, w1 - w0), M.rain, (c0 + c1) / 2, (w0 + w1) / 2, off + 0.3).userData.noBake = true;
        put(side, new THREE.BoxGeometry(c1 - c0 + 0.4, 0.3, 0.9), M.trim, (c0 + c1) / 2, w0 + 0.15, off - 0.2);
      }
    }
    // the inside: a lit skirting, a cornice where the dome springs, a rounded pilaster between every bay
    put(side, new THREE.BoxGeometry(len, 0.5, 0.5), M.panel, 0, 0.25, off - 0.2);
    put(side, new THREE.BoxGeometry(len, 0.08, 0.1), M.glow, 0, 0.55, off - 0.42);
    put(side, new THREE.BoxGeometry(len, 0.9, 1.4), M.panel, 0, Wh - 0.45, off - 0.6);
    put(side, new THREE.BoxGeometry(len, 0.12, 0.2), M.glow, 0, Wh - 1.0, off - 1.2);
    for (const a of bays){
      if (door && Math.abs(a) < dW / 2 + 1.2) continue;
      const h = mouthTop ? (Math.abs(a) < dW / 2 + 6 ? Wh : Wh - mouthTop) : Wh, y = mouthTop && Math.abs(a) >= dW / 2 + 6 ? mouthTop + h / 2 : h / 2;
      const p = put(side, new THREE.CylinderGeometry(0.55, 0.55, h, 12), M.white, a, y, off - 0.1); p.rotation.y = 0;
    }
    if (door) portal(K, M, side, off, dW, dH);
  }
  // the DOME: a low ribbed cap over the whole room, a ring of light round its crown
  const R0 = off * Math.SQRT2 + 1, rise = o.rise ?? 12, sy = rise / R0;
  const cap = new THREE.Group(); cap.position.y = Wh - 0.2; cap.scale.y = sy; g.add(cap);
  const add = (mesh) => { pic(mesh); mesh.receiveShadow = false; cap.add(mesh); return mesh; };
  const shellM = std(pal.panel, 0.55, 0.12, 0.35); shellM.side = THREE.BackSide;
  add(new THREE.Mesh(new THREE.SphereGeometry(R0, 40, 14, 0, PI * 2, 0, PI / 2), shellM));
  for (let i = 0; i < 12; i++){
    const rib = add(new THREE.Mesh(new THREE.TorusGeometry(R0 - 0.3, 0.45, 6, 40, PI), M.white));
    rib.rotation.y = i / 12 * PI;
  }
  for (const k of [0.35, 0.62, 0.84]){   // rings of panels: rings of light as the dome climbs
    const a = Math.acos(k), r = R0 * k, y = R0 * Math.sin(a) - 0.4;
    add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 5, 64), M.glow)).position.y = y;
    add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 5, 64), M.glow)).rotation.x = PI / 2;
    cap.children[cap.children.length - 1].position.y = y;
  }
  const crown = add(new THREE.Mesh(new THREE.CircleGeometry(R0 * 0.2, 40), glowM(pal.glow, 0.9)));
  crown.rotation.x = PI / 2; crown.position.y = R0 - 0.6;
  // the SEA far below the windows, and the stilts of the city standing out of it
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(off * 14, off * 14), new THREE.MeshStandardMaterial({ color: pal.sea, roughness: 0.25, metalness: 0.4 }));
  sea.rotation.x = -PI / 2; sea.position.y = -18; pic(sea); sea.receiveShadow = false; sea.userData.noBake = true; g.add(sea);
  return { off, len };
}
/* a DOOR: a rounded white portal, light running round its frame, a lit corridor beyond */
function portal(K, M, side, off, dW, dH){
  const [ox, oz] = SIDE_OUT[side], ry = ox ? PI / 2 : 0;
  const at = (a, y, d, geo, mat) => { const m = K.deco(geo, mat, ox ? ox * d : a, y, oz ? oz * d : a); m.rotation.y = ry; return pic(m); };
  for (const s of [-1, 1]){
    at(s * (dW / 2 + 0.6), dH / 2, off - 0.4, new THREE.BoxGeometry(1.2, dH, 2.4), M.white);
    at(s * (dW / 2 + 0.05), dH / 2, off - 1.65, new THREE.BoxGeometry(0.16, dH - 0.4, 0.1), M.glow);
  }
  at(0, dH + 0.7, off - 0.4, new THREE.BoxGeometry(dW + 2.4, 1.4, 2.4), M.white);
  at(0, dH - 0.1, off - 1.65, new THREE.BoxGeometry(dW, 0.16, 0.1), M.glow);
  // the corridor: walls, a ceiling, and a pale glow at its end
  const deep = 9;
  for (const s of [-1, 1]) at(s * (dW / 2 + 0.3), dH / 2, off + deep / 2, new THREE.BoxGeometry(0.6, dH, deep), M.panel).rotation.y = ry + (ox ? 0 : 0);
  at(0, dH + 0.2, off + deep / 2, new THREE.BoxGeometry(dW + 1.2, 0.4, deep), M.panel);
  at(0, dH / 2, off + deep, new THREE.PlaneGeometry(dW, dH), new THREE.MeshBasicMaterial({ color: 0xa8c8dc })).rotation.y = ry + (ox > 0 || oz > 0 ? PI : 0);
}
/* past a hangar mouth: the deck running on out over the sea, a hazard edge, a rail, and rain sheeting down past it */
function apron(K, M, pal, side, off, len){
  const [ox, oz] = SIDE_OUT[side], ry = ox ? PI / 2 : 0, g = shared.arenaGroup;
  const at = (geo, mat, a, y, d, rx = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(ox ? ox * d : a, y, oz ? oz * d : a); m.rotation.set(rx, ry, 0, 'YXZ');
    pic(m); m.receiveShadow = true; g.add(m); return m;
  };
  at(new THREE.BoxGeometry(len, 0.6, 16), M.metal, 0, -0.32, off + 8);
  at(new THREE.BoxGeometry(len, 0.04, 0.8), std(0xd8b040, 0.6), 0, 0.0, off + 15);
  at(new THREE.BoxGeometry(len, 0.14, 0.2), M.trim, 0, 1.2, off + 15.8);
  for (let a = -len / 2; a <= len / 2; a += 3) at(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), M.trim, a, 0.6, off + 15.8);
  for (let a = -len / 2 + 6; a < len / 2; a += 12) at(new THREE.CylinderGeometry(0.9, 1.3, 26, 10), M.wallD, a, -13.5, off + 12);   // the stilts
  // the rain: a curtain of falling streaks just past the mouth
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const c = cv.getContext('2d'), R = seeded(side.charCodeAt(0));
  for (let i = 0; i < 90; i++){ c.strokeStyle = 'rgba(220,235,250,' + (0.2 + R() * 0.35).toFixed(2) + ')'; c.lineWidth = 1; const x = R() * 64, y = R() * 256; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y + 18 + R() * 20); c.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(len / 4, 4);
  const rainM = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  live(at(new THREE.PlaneGeometry(len, 40), rainM, 0, 10, off + 9));
  const holder = new THREE.Object3D(); g.add(holder);
  anim(holder, (o, t) => { tex.offset.y = t * 1.6; tex.offset.x = t * 0.05; });
}

/* ---------------- the props every wing shares ---------------- */
/* a TRANSIT BEACON: a slim white post with a blue ring of light turning over it (fast travel from any wing) */
function beacon(K, M, x, z){
  K.column(x, z, 0.4, 1.6, M.white, { wallKick: false, seg: 12, taper: 0.7 });
  K.deco(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 16), M.metalD, x, 1.62, z);
  const ring = live(K.deco(new THREE.TorusGeometry(0.42, 0.05, 6, 32), M.screen, x, 2.3, z, PI / 2));
  anim(ring, (o, t, b) => { o.position.y = b.y + Math.sin(t * 1.4) * 0.1; o.rotation.x = PI / 2 + Math.sin(t * 0.9) * 0.4; o.rotation.z = t; });
  live(K.deco(new THREE.OctahedronGeometry(0.16), M.screen, x, 2.3, z));
}
/* a CLONE standing his post, rifle across his chest: a light figure of a dozen plain shapes, so a whole company of them
   bakes into the room for next to nothing (the army's full trooper model, enemies/mesh.js, is far too heavy to stand
   thirty of). o.y raises him (a stand, the gallery), o.cloth his unit colour, o.rest his rifle grounded at his side */
const FIG = {};
function figMats(cloth){
  FIG.white ||= std(0xeef0f2, 0.45, 0.1); FIG.under ||= std(0x24282e, 0.8, 0.1); FIG.gun ||= std(0x2e3238, 0.5, 0.5); FIG.visor ||= std(0x101418, 0.3, 0.4);
  return { cloth: FIG['c' + cloth] ||= std(cloth, 0.6, 0.1) };
}
function trooper(x, z, yaw, o = {}){
  const g = new THREE.Group(); g.position.set(x, o.y || 0, z); g.rotation.y = yaw; g.scale.setScalar(o.scale || 1); shared.arenaGroup.add(g);
  const { cloth } = figMats(o.cloth ?? PAL.blue), W = FIG.white, D = FIG.under;
  const add = (w, h, d, mat, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(px, py, pz); m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true; m.userData.passThrough = true; g.add(m); return m;
  };
  const v = o.variant || 0, lean = (v % 3 - 1) * 0.03;
  for (const s of [-1, 1]){
    add(0.2, 0.12, 0.3, D, s * 0.11, 0.06, 0.03);                      // boots
    add(0.17, 0.42, 0.19, W, s * 0.11, 0.33, 0);                       // shins
    add(0.18, 0.07, 0.2, D, s * 0.11, 0.57, 0);                        // knees
    add(0.19, 0.38, 0.21, W, s * 0.11, 0.8, 0);                        // thighs
    add(0.15, 0.12, 0.22, cloth, s * 0.31, 1.53, 0, 0, 0, s * -0.25);  // the unit's colour on the shoulders
    add(0.12, 0.3, 0.14, W, s * 0.3, 1.33, 0, 0, 0, s * 0.06);         // upper arms
  }
  add(0.4, 0.12, 0.24, D, 0, 1.02, 0);                                 // the belt
  add(0.34, 0.18, 0.21, W, 0, 1.16, 0);                                // the abdomen plate
  add(0.46, 0.34, 0.27, W, 0, 1.4, 0, lean);                           // the chest
  add(0.3, 0.32, 0.13, W, 0, 1.4, -0.2);                               // the pack
  add(0.18, 0.06, 0.18, D, 0, 1.6, 0);                                 // the collar
  if (o.rest){
    for (const s of [-1, 1]) add(0.11, 0.3, 0.12, W, s * 0.31, 1.06, 0.02);
    add(0.07, 0.8, 0.1, FIG.gun, 0.4, 0.55, 0.06);                     // grounded at his side
  } else {
    for (const s of [-1, 1]) add(0.11, 0.28, 0.12, W, s * 0.22, 1.18, 0.13, -1.1, 0, s * 0.3);
    add(0.08, 0.1, 0.78, FIG.gun, 0.02, 1.24, 0.22, 0, 0.5, 0.75);      // across the chest
  }
  // the helmet: a dome, its brow and the T of the visor
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), W); head.position.set(0, 1.78, 0); head.scale.set(1, 1.08, 1.05);
  head.castShadow = true; head.userData.passThrough = true; g.add(head);
  add(0.27, 0.08, 0.24, W, 0, 1.66, -0.01);
  add(0.21, 0.045, 0.03, FIG.visor, 0, 1.8, 0.145);
  add(0.05, 0.12, 0.03, FIG.visor, 0, 1.73, 0.15);
  if (!o.y) solids.push({ x, z, r: 0.45, h: 1.9 });
  return g;
}
/* the army's full trooper model (enemies/mesh.js): one, on show, where you stand right by it */
function showTrooper(x, z, yaw, o = {}){
  const g = buildEnemyMesh({ model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: o.cloth ?? PAL.blue, scale: 1, ranged: true }, { variant: o.variant ?? 0, wear: 0.05, seed: 7 });
  g.traverse(m => { if (m.isLight) m.visible = false; if (m.isMesh) m.userData.passThrough = true; });
  g.position.set(x, o.y || 0, z); g.rotation.y = yaw; shared.arenaGroup.add(g);
  return g;
}
/* a GUNSHIP on its pad: an original Republic dropship. A rounded troop bay with its side doors open, a glazed nose, swept
   wings with an engine at each tip and a ball turret at each root, twin tail fins. `yaw` a quarter turn (0: nose to −z).
   The bay is solid to its roof, the wings overhead slabs you walk under and can land on */
function gunship(K, M, pal, x, z, yaw, o = {}){
  const g = new THREE.Group(); g.position.set(x, o.y || 0, z); g.rotation.y = yaw; shared.arenaGroup.add(g);
  const hull = std(0xe2e4e2, 0.55, 0.15), mark = M.red, dark = M.metalD, glass = std(0x1e3a54, 0.2, 0.6, 0.15);
  const add = (geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  if (o.y){ g.rotation.z = o.tilt || 0; }
  // the pad under it: a ring of hazard paint, lit at four points
  if (!o.y){
  const padM = std(0x6a7480, 0.7, 0.3);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.2, 0.12, 40), padM); pad.position.set(x, 0.06, z); pic(pad); pad.receiveShadow = true; shared.arenaGroup.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(7.6, 8.2, 48), std(0xd8b040, 0.6)); ring.rotation.x = -PI / 2; ring.position.set(x, 0.13, z); pic(ring); shared.arenaGroup.add(ring);
  for (let i = 0; i < 4; i++){ const a = i / 4 * PI * 2 + PI / 4; live(K.deco(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), M.glow, x + Math.cos(a) * 8.6, 0.15, z + Math.sin(a) * 8.6)); }
  }
  // the troop bay: a long body with a rounded roof, the doors open in each flank
  add(new THREE.BoxGeometry(3.4, 2.4, 7.4), hull, 0, 1.9, 0.6);
  add(new THREE.CylinderGeometry(1.7, 1.7, 7.4, 16, 1, false, -PI / 2, PI), hull, 0, 3.1, 0.6, -PI / 2);   // the rounded roof
  for (const s of [-1, 1]){
    add(new THREE.BoxGeometry(0.1, 1.7, 2.8), dark, s * 1.71, 1.9, 0.2);                                   // a door, open
    add(new THREE.BoxGeometry(0.12, 0.3, 7.5), mark, s * 1.72, 2.95, 0.6);                                 // the red band down the flank
  }
  // the nose: tapering forward, glazed, a chin turret under it
  add(new THREE.CylinderGeometry(0.9, 1.7, 3.2, 12), hull, 0, 2.6, -4.6, -PI / 2);
  add(new THREE.SphereGeometry(1.0, 14, 10, 0, PI * 2, 0, PI / 2), glass, 0, 3.0, -5.2, -PI / 2 - 0.35);
  add(new THREE.BoxGeometry(0.6, 0.3, 2.6), mark, 0, 3.55, -4.0);
  add(new THREE.SphereGeometry(0.5, 10, 8), dark, 0, 1.55, -5.4);
  add(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6), dark, 0, 1.5, -6.1, PI / 2);
  // the wings: swept back from the roof, an engine at each tip, a ball turret at each root
  for (const s of [-1, 1]){
    add(new THREE.BoxGeometry(5.4, 0.32, 2.6), hull, s * 4.3, 4.3, 1.4, 0, s * 0.18, s * -0.05);
    add(new THREE.BoxGeometry(1.4, 0.34, 2.62), mark, s * 6.4, 4.38, 1.8, 0, s * 0.18, 0);
    add(new THREE.CylinderGeometry(0.55, 0.62, 3.2, 12), hull, s * 7.0, 4.2, 2.0, PI / 2);
    const nz = live(new THREE.Mesh(new THREE.CircleGeometry(0.46, 12), glowM(0x8ad8ff))); nz.position.set(s * 7.0, 4.2, 3.62); g.add(nz);
    add(new THREE.SphereGeometry(0.62, 12, 10), glass, s * 2.0, 4.2, -0.4);
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), dark, s * 2.2, 4.2, -1.1, PI / 2);
    add(new THREE.BoxGeometry(0.22, 0.9, 0.22), dark, s * 1.2, 0.45, 3.2);                                 // the skids
    add(new THREE.BoxGeometry(0.22, 0.9, 0.22), dark, s * 1.2, 0.45, -2.4);
    add(new THREE.BoxGeometry(0.3, 0.16, 6.4), dark, s * 1.2, 0.08, 0.4);
    add(new THREE.BoxGeometry(0.2, 1.8, 1.6), hull, s * 0.9, 4.9, 4.0, -0.3, 0, s * 0.25);                 // the tail fins
  }
  add(new THREE.BoxGeometry(2.6, 1.6, 1.0), dark, 0, 2.2, 4.5);                                            // the tail, its hatch shut
  if (o.y) return g;
  // collision: the bay and nose to the roof, the wings overhead (the boxes turned with the ship, a quarter turn at a time)
  const turn = (lx, lz) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [x + lx * c + lz * s, z - lx * s + lz * c]; };
  const flip = Math.abs(Math.sin(yaw)) > 0.5;
  const box = (lx, lz, hx, hz, h, y0) => { const [bx, bz] = turn(lx, lz); solids.push({ x: bx, z: bz, hx: flip ? hz : hx, hz: flip ? hx : hz, h, ...(y0 != null ? { y0 } : {}), box: true }); };
  box(0, 0.4, 1.75, 4.5, 4.8);
  box(0, -4.8, 1.2, 1.4, 3.6);
  for (const s of [-1, 1]) box(s * 4.6, 1.6, 2.9, 1.5, 4.6, 4.0);
  return g;
}

/* ---------------- THE HANGAR DECK ---------------- */
function deck(K, pal, M, R){
  shell(K, M, pal, { wallH: 30, rise: 14, doors: ['n', 'e', 'w', 's'], win: [16, 26], bay: 8, open: { e: 22, w: 22 }, doorW: 10, doorH: 12 });
  // the FACILITY MAP: a dais under the crown, a projector, and the citadel itself turning in blue light over it
  roundStep(K, 0, 0, 12, 0.35, M.panel, 64);
  live(K.deco(new THREE.RingGeometry(11.2, 11.6, 64), M.screen, 0, 0.37, 0, -PI / 2));
  K.column(0, 0, 1.6, 1.4, M.metalD, { wallKick: false, seg: 16, taper: 0.8 });
  live(K.deco(new THREE.CylinderGeometry(3.2, 1.2, 3.4, 24, 1, true), holoM(pal.holo, 0.06), 0, 3.1, 0));
  const map = new THREE.Group(); map.position.set(0, 5.2, 0); shared.arenaGroup.add(map);
  { const hm = M.holo, hw = holoM(0xbfeaff, 0.45);
    const sea = live(new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), holoM(pal.holo, 0.12))); sea.rotation.x = -PI / 2; map.add(sea);
    const pod = (px, pz, r, h, m = hm) => {
      const st = live(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 6), m)); st.position.set(px, h / 2, pz); map.add(st);
      const d = live(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, PI * 2, 0, PI / 2), m)); d.position.set(px, h, pz); d.scale.y = 0.5; map.add(d);
      const base = live(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 16), m)); base.position.set(px, h, pz); map.add(base);
    };
    pod(0, 0, 1.0, 1.0, hw); pod(1.9, 0.6, 0.6, 0.7); pod(-1.7, 0.9, 0.55, 0.8); pod(0.4, -1.9, 0.6, 0.6); pod(-1.2, -1.5, 0.45, 0.9); pod(2.2, -1.4, 0.4, 0.5);
    for (const [a, b] of [[[0, 0], [1.9, 0.6]], [[0, 0], [-1.7, 0.9]], [[0, 0], [0.4, -1.9]], [[0.4, -1.9], [2.2, -1.4]], [[0, 0], [-1.2, -1.5]]]){
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      const w = live(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, l), hm)); w.position.set((a[0] + b[0]) / 2, 0.55, (a[1] + b[1]) / 2); w.rotation.y = Math.atan2(dx, dz); map.add(w);
    }
    const ring = live(new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.03, 4, 64), hm)); ring.rotation.x = PI / 2; map.add(ring); }
  spinner(map, 0.18);
  // the GUNSHIPS on their pads, noses to the mouths
  for (const [x, z, yaw] of [[-30, -24, PI / 2], [30, -24, -PI / 2], [-30, 24, PI / 2], [30, 24, -PI / 2]]) gunship(K, M, pal, x, z, yaw);
  // the ARMY: two companies drawn up between the map and the north door, a sergeant out in front of each, facing them
  for (const s of [-1, 1]){
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) trooper(s * (9 + c * 2.1), -30 + r * 2.4, 0, { variant: (r + c) % 3 });
    trooper(s * 12.2, -22.6, PI, { cloth: 0x7a6a3a, variant: 4 });
  }
  // a pair on watch at the mouths of the hangar, rifles to the storm
  for (const s of [-1, 1]) for (const z of [-8, 8]) trooper(s * 44, z, s > 0 ? PI / 2 : -PI / 2, { variant: 1 });
  // CARGO: crates in stacks by the walls, fuel carts by the pads (cover you can climb)
  const crate = std(0x6a7480, 0.8, 0.2), crateD = std(0x4a545e, 0.8, 0.2);
  for (const [x, z, n] of [[-40, -40, 2], [40, -40, 3], [-40, 40, 3], [40, 40, 2], [-18, 40, 1], [18, 40, 2], [-20, -42, 1], [20, -42, 2]]){
    for (let k = 0; k < n; k++){ const hx = 1.3 - k * 0.15; K.box(x + (k % 2) * 0.4, z, hx, hx, 1.3, k % 2 ? crateD : crate, { y: k * 1.3, climbable: k === 0 }); }
    K.deco(new THREE.BoxGeometry(0.06, 0.4, 2.0), M.red, x + 1.32, 0.7, z).userData.passThrough = true;
  }
  for (const [x, z] of [[-18, -14], [18, -14], [-18, 14], [18, 14]]){
    K.box(x, z, 1.0, 1.6, 1.0, M.metalD, { climbable: true });
    K.column(x, z - 0.6, 0.6, 1.9, M.red, { wallKick: false, seg: 10, taper: 1 });
  }
  // the CRANES: two gantry beams across the hangar under the dome, a lit hook hanging from each
  for (const z of [-24, 24]){
    pic(K.deco(new THREE.BoxGeometry(100, 1.2, 1.6), M.metalD, 0, 27, z));
    const hx = z < 0 ? -10 : 12;
    pic(K.deco(new THREE.BoxGeometry(3, 1, 2.4), M.metalD, hx, 26, z));
    for (const s of [-1, 1]) pic(K.deco(new THREE.CylinderGeometry(0.06, 0.06, 6, 4), M.metal, hx + s * 1.2, 23, z));
    // a gunship in for repairs, hanging from it
    const gs = gunship(K, M, pal, hx, z, z < 0 ? 0.2 : PI - 0.3, { y: 15.2, tilt: z < 0 ? 0.04 : -0.05 });
    gs.traverse(m => { if (m.isMesh) m.userData.passThrough = true; });
  }
  // the GALLERY: a walkway along the north wall over the deck, officers looking down on the drill
  pic(K.deco(new THREE.BoxGeometry(60, 0.6, 3.2), M.panel, 0, 9.7, -48.4));
  pic(K.deco(new THREE.BoxGeometry(60, 0.1, 0.15), M.glow, 0, 9.4, -46.8));
  pic(K.deco(new THREE.BoxGeometry(60, 0.14, 0.14), M.trim, 0, 11.1, -46.9));
  for (let x = -29; x <= 29; x += 2) pic(K.deco(new THREE.BoxGeometry(0.08, 1.1, 0.08), M.trim, x, 10.55, -46.9));
  for (const x of [-28, -14, 14, 28]) pic(K.deco(new THREE.CylinderGeometry(0.4, 0.4, 9.4, 10), M.white, x, 4.7, -48));
  for (const x of [-22, -8, 9, 21]) trooper(x, -48.2, 0, { y: 10, cloth: 0x7a6a3a, variant: 4 });
  // banners of the army hung from the cornice: the citadel's own mark, a white ring and bar on blue
  for (const [x, z, ry] of [[-20, -49.4, 0], [20, -49.4, 0], [-20, 49.4, PI], [20, 49.4, PI]]) K.banner(x, 22, z, ry, 4, 12, pal.blue, 0xe8ecef, 0xe8ecef);
}

/* ---------------- THE WAR ROOM ---------------- */
function warroom(K, pal, M, R){
  shell(K, M, pal, { wallH: 20, rise: 9, doors: ['s'], win: [9, 16], winBy: { n: [1.6, 18] }, bay: 7 });
  // the HOLOTABLE on its raised floor, a rail round the edge, and the war itself over it: a planet, the fleets, the fronts
  roundStep(K, 0, 0, 12, 0.5, M.panel, 64);
  live(K.deco(new THREE.RingGeometry(11.6, 12, 64), M.screen, 0, 0.52, 0, -PI / 2));
  K.column(0, 0, 4.2, 1.1, M.metalD, { wallKick: false, seg: 40, taper: 1 });
  K.deco(new THREE.CylinderGeometry(4.35, 4.35, 0.14, 40), M.trim, 0, 1.15, 0);
  live(K.deco(new THREE.CircleGeometry(4.1, 40), holoM(pal.holo, 0.35), 0, 1.24, 0, -PI / 2));
  const war = new THREE.Group(); war.position.set(0, 4.0, 0); shared.arenaGroup.add(war);
  { const planet = live(new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), holoM(pal.holo, 0.28))); war.add(planet);
    const grid = live(new THREE.Mesh(new THREE.SphereGeometry(1.52, 16, 10), new THREE.MeshBasicMaterial({ color: pal.holo, wireframe: true, transparent: true, opacity: 0.35, toneMapped: false })));
    war.add(grid);
    for (let i = 0; i < 3; i++){
      const orbit = live(new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.5, 0.02, 4, 64), holoM(pal.holo, 0.4))); orbit.rotation.x = PI / 2 + (i - 1) * 0.35; war.add(orbit);
      for (let k = 0; k < 3 + i; k++){
        const a = k / (3 + i) * PI * 2, red = (k + i) % 3 === 0, r = 2.2 + i * 0.5;
        const ship = live(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), glowM(red ? 0xff5a4a : 0x8ad8ff)));
        ship.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); ship.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), (i - 1) * 0.35);
        war.add(ship);
      }
    } }
  spinner(war, 0.1);
  // tiered rails: a ring of officers' consoles round the table, a gap to the door
  for (let i = 0; i < 10; i++){
    const a = -PI / 2 + (i - 4.5) / 10 * PI * 1.7, r = 16.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 12) continue;
    const yaw = Math.atan2(-x, -z);
    const desk = K.box(x, z, 1.1, 0.5, 1.0, M.metalD); desk.rotation.y = yaw;
    const scr = pic(K.deco(new THREE.PlaneGeometry(1.8, 0.7), M.screen, x - Math.sin(yaw) * 0.1, 1.25, z - Math.cos(yaw) * 0.1, -0.6, yaw, 0));
    scr.userData.noBake = false;
  }
  for (const [x, z, yaw] of [[-16, 6, -PI / 2 + 0.6], [16, 6, PI / 2 - 0.6], [-8, -18, 0.3], [10, -17, -0.2]]) trooper(x, z, yaw + PI, { variant: 4, cloth: 0x7a6a3a });
  // the wall of glass onto the storm: a rail under it, the officers' walk
  K.box(0, -31, 30, 0.3, 1.1, M.trim);
  // a holo-screen on each side wall: the front lines
  for (const s of [-1, 1]){
    live(K.deco(new THREE.PlaneGeometry(10, 5), holoM(pal.holo, 0.18), s * 32.6, 5, 0, 0, -s * PI / 2, 0));
    for (let k = 0; k < 6; k++) live(K.deco(new THREE.PlaneGeometry(8.4, 0.06), holoM(pal.holo, 0.5), s * 32.5, 3 + k * 0.8, 0, 0, -s * PI / 2, 0));
    live(K.deco(new THREE.PlaneGeometry(1.2, 1.2), glowM(0xff5a4a, 0.6), s * 32.4, 5.4, -2 + s, 0, -s * PI / 2, 0));
  }
}

/* ---------------- THE FIRING RANGE ---------------- */
function range(K, pal, M, R){
  shell(K, M, pal, { wallH: 18, rise: 8, doors: ['w'], win: [9, 15], bay: 7 });
  const H = shared.arenaHalf;
  // the SHOOTING LANES: a firing line north of its station, booths, and lanes running away to the north wall with
  // droid targets popping up and down along them
  K.box(-6, -21, 11, 0.5, 1.1, M.metalD);
  pic(K.deco(new THREE.BoxGeometry(22.4, 0.1, 1.2), M.trim, -6, 1.15, -21));
  for (let k = 0; k <= 5; k++){
    const x = -17 + k * 4.4;
    K.box(x, -23, 0.12, 1.6, 2.2, M.panel);   // the booth dividers
    pic(K.deco(new THREE.BoxGeometry(0.16, 0.03, H - 25), std(0xc89a3a, 0.7), x, 0.03, -(21 + (H - 21) / 2)));
  }
  const tgt = std(0xb8bec4, 0.6, 0.3), eye = glowM(0xff6a3a);
  for (let k = 0; k < 5; k++) for (let d = 0; d < 2; d++){
    const x = -14.8 + k * 4.4, z = -28 - d * 6 - (k % 2) * 2;
    const t = new THREE.Group(); t.position.set(x, 0, z); shared.arenaGroup.add(t); live(t);
    const add = (geo, mat, px, py) => { const m = live(new THREE.Mesh(geo, mat)); m.position.set(px, py, 0); t.add(m); return m; };
    add(new THREE.BoxGeometry(0.5, 0.9, 0.1), tgt, 0, 1.2); add(new THREE.BoxGeometry(0.3, 0.3, 0.12), tgt, 0, 1.85); add(new THREE.BoxGeometry(0.1, 0.06, 0.13), eye, 0, 1.88);
    add(new THREE.BoxGeometry(0.08, 0.8, 0.08), M.metalD, 0, 0.4);
    const ph = R() * 10, per = 3 + R() * 3;
    anim(t, (o, time) => { const c = ((time + ph) % per) / per; o.rotation.x = c < 0.6 ? 0 : -PI / 2 * Math.min(1, (c - 0.6) / 0.08); });
  }
  for (let k = 0; k < 3; k++) trooper(-12.6 + k * 8.8, -19.6, PI, { variant: k });
  // the COMBAT SIM: a floor of light under a projector frame, cover blocks to fight from, droids in blue light
  live(K.deco(new THREE.CircleGeometry(10, 48), holoM(pal.holo, 0.1), 14, 0.03, 0, -PI / 2));
  for (let k = -4; k <= 4; k++){
    live(K.deco(new THREE.PlaneGeometry(0.1, 19 * Math.sqrt(1 - (k / 5) ** 2)), holoM(pal.holo, 0.6), 14 + k * 2, 0.04, 0, -PI / 2));
    live(K.deco(new THREE.PlaneGeometry(19 * Math.sqrt(1 - (k / 5) ** 2), 0.1), holoM(pal.holo, 0.6), 14, 0.04, k * 2, -PI / 2));
  }
  live(K.deco(new THREE.TorusGeometry(10, 0.2, 6, 64), M.screen, 14, 9, 0, PI / 2));
  for (const a of [0.4, 2.0, 3.6, 5.2]) pic(K.deco(new THREE.BoxGeometry(0.3, 9, 0.3), M.metalD, 14 + Math.cos(a) * 10, 4.5, Math.sin(a) * 10));
  // the cover: low walls to crouch behind and full-height ones to lean out from, edged in light
  for (const [x, z, hx, hz, h] of [[9, -5, 1.6, 0.4, 1.2], [19, -4, 0.4, 1.6, 2.4], [12, 5, 0.4, 1.4, 2.4], [20, 5, 1.5, 0.4, 1.2], [15, -1, 0.9, 0.9, 1.2], [8, 2, 1.2, 0.35, 1.2], [16, -8, 1.4, 0.35, 2.4]]){
    K.box(x, z, hx, hz, h, M.panel, { climbable: h < 2 });
    live(K.deco(new THREE.BoxGeometry(hx * 2 + 0.05, 0.08, hz * 2 + 0.05), M.screen, x, h + 0.02, z));
    live(K.deco(new THREE.BoxGeometry(hx * 2 + 0.05, 0.06, hz * 2 + 0.05), M.screen, x, 0.06, z));
  }
  for (const [x, z] of [[11, -8], [21, 0], [17, 8]]){
    const d = new THREE.Group(); d.position.set(x, 0, z); shared.arenaGroup.add(d); live(d);
    const add = (geo, px, py) => { const m = live(new THREE.Mesh(geo, M.holo)); m.position.set(px, py, 0); d.add(m); };
    add(new THREE.BoxGeometry(0.4, 0.8, 0.25), 0, 1.3); add(new THREE.SphereGeometry(0.2, 8, 6), 0, 1.95); add(new THREE.BoxGeometry(0.12, 0.9, 0.12), -0.12, 0.45); add(new THREE.BoxGeometry(0.12, 0.9, 0.12), 0.12, 0.45);
    anim(d, (o, t) => { o.rotation.y = Math.atan2(14 - x, 0 - z) + Math.sin(t * 0.6 + x) * 0.6; o.visible = Math.sin(t * 7 + x) > -0.95; });
  }
  // the KILLHOUSE: a mock-up of rooms in the south of the range, its doorway facing the station, a red light over it
  const kh = std(0x9aa4ae, 0.7, 0.2);
  K.box(-10, 22, 3, 0.3, 3.4, kh); K.box(-2, 22, 3, 0.3, 3.4, kh);   // the front wall, a doorway in its middle pic(K.deco(new THREE.BoxGeometry(2, 0.8, 0.6), kh, -6, 3.0, 22));
  K.box(-13, 28, 0.3, 6, 3.4, kh); K.box(1, 28, 0.3, 6, 3.4, kh); K.box(-6, 34, 7, 0.3, 3.4, kh);
  K.box(-8.5, 28, 0.3, 3, 3.4, kh); K.box(-2, 30, 3, 0.3, 3.4, kh);
  live(K.deco(new THREE.BoxGeometry(1.4, 0.3, 0.3), glowM(0xff3a2a), -6, 3.9, 21.7));
  K.sign('LIVE FIRE', -6, 4.6, 21.6, PI, { w: 3, ink: '#ff9a8a', edge: 'rgba(255,90,70,.85)' });
  // racks of rifles along the east wall, ammunition by them
  for (const z of [-14, 14]) rack(K, M, 34, z, -PI / 2, 6);
  for (const [x, z] of [[30, -26], [30, 26], [-30, -26], [-30, 26]]) K.box(x, z, 1.2, 0.8, 1.0, std(0x4a545e, 0.8, 0.2), { climbable: true });
}
/* a RIFLE RACK: a frame against a wall, `n` rifles stood in it */
function rack(K, M, x, z, ry, n){
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; shared.arenaGroup.add(g);
  const add = (geo, mat, px, py, pz, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(n * 0.6 + 0.6, 0.12, 0.6), M.rack, 0, 0.5, 0); add(new THREE.BoxGeometry(n * 0.6 + 0.6, 0.1, 0.2), M.rack, 0, 1.6, -0.2);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.12, 1.9, 0.6), M.rack, s * (n * 0.3 + 0.3), 0.95, 0);
  for (let k = 0; k < n; k++){
    const px = -n * 0.3 + 0.3 + k * 0.6;
    add(new THREE.BoxGeometry(0.1, 1.15, 0.16), M.metalD, px, 1.15, 0.05, -0.08);
    add(new THREE.BoxGeometry(0.08, 0.3, 0.22), M.white, px, 0.75, 0.1);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), M.metalD, px, 1.9, 0.02);
  }
  const c = Math.cos(ry), s = Math.sin(ry), hx = n * 0.3 + 0.4, hz = 0.4;
  solids.push({ x, z, hx: Math.abs(c) > 0.5 ? hx : hz, hz: Math.abs(c) > 0.5 ? hz : hx, h: 2.0, box: true });
  return g;
}

/* ---------------- THE CLONING HALLS ---------------- */
function halls(K, pal, M, R){
  shell(K, M, pal, { wallH: 26, rise: 12, doors: ['e'], win: [17, 23], bay: 7 });
  const amber = glowM(pal.pod), cap = M.white;
  const glassG = [], fluidG = [];   // every pod's glass and fluid, merged into one mesh each at the end (see-through: no bake)
  const tubeAt = (list, r, h, x, y, z, open) => { const q = new THREE.CylinderGeometry(r, r, h, 10, 1, open); q.translate(x, y, z); list.push(q); };
  // a GROWTH POD: a glass tube of fluid on a white base, the shape of a body lit amber inside it
  const pod = (x, z, y = 0, s = 1, solid = true) => {
    pic(K.deco(new THREE.CylinderGeometry(0.75 * s, 0.85 * s, 0.5 * s, 10), cap, x, y + 0.25 * s, z));
    pic(K.deco(new THREE.CapsuleGeometry(0.22 * s, 0.7 * s, 2, 6), amber, x, y + 1.6 * s, z));   // the body growing inside
    tubeAt(fluidG, 0.66 * s, 2.3 * s, x, y + 1.7 * s, z, false);
    tubeAt(glassG, 0.74 * s, 2.5 * s, x, y + 1.7 * s, z, true);
    pic(K.deco(new THREE.CylinderGeometry(0.62 * s, 0.78 * s, 0.4 * s, 10), cap, x, y + 3.1 * s, z));
    pic(K.deco(new THREE.TorusGeometry(0.76 * s, 0.05 * s, 3, 12), M.glow, x, y + 0.55 * s, z, PI / 2));
    if (solid) solids.push({ x, z, r: 0.85, h: 3.3 });
  };
  // the floor's rows: either side of the reading floor, a gap down the middle of each row to walk through
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++){
    const z = side * (9 + k * 6.5);
    for (let x = -30; x <= 24; x += 2.6){ if (Math.abs(x + 4) < 3.2) continue; pod(x, z); }
    pic(K.deco(new THREE.BoxGeometry(60, 0.08, 0.6), M.glow, -3, 0.04, z + side * 1.6));
  }
  // and the ARMY waiting overhead: tiers of pods on racks climbing into the haze, row behind row
  for (const side of [-1, 1]) for (let t = 0; t < 3; t++){
    const y = 7 + t * 5, z = side * (12 + t * 6);
    pic(K.deco(new THREE.BoxGeometry(66, 0.5, 2.4), M.metalD, -3, y - 0.25, z));
    pic(K.deco(new THREE.BoxGeometry(66, 0.1, 0.12), M.glow, -3, y + 0.05, z - side * 1.2));
    for (let x = -32; x <= 26; x += 2.4) pod(x, z, y, 0.85, false);
  }
  for (const s of [-1, 1]) for (let x = -30; x <= 26; x += 14) pic(K.deco(new THREE.BoxGeometry(0.6, 18, 0.6), M.metalD, x, 9, s * 24));   // the racks' posts
  for (const [list, mat, order] of [[fluidG, glowM(pal.podFluid, 0.42), 2], [glassG, glowM(0xd8f4ff, 0.14), 3]]){
    const m = live(new THREE.Mesh(mergeGeometries(list, false), mat)); m.renderOrder = order; shared.arenaGroup.add(m);
    for (const q of list) q.dispose();
  }
  // the GENOME TERMINAL: a round desk, and the strand of the army's genome turning over it
  roundStep(K, 0, 0, 5.5, 0.35, M.panel, 40);
  K.column(0, 0, 2.2, 1.15, M.metalD, { wallKick: false, seg: 24, taper: 1 });
  K.deco(new THREE.CylinderGeometry(2.35, 2.35, 0.12, 24), M.trim, 0, 1.2, 0);
  const helix = new THREE.Group(); helix.position.set(0, 1.6, 0); shared.arenaGroup.add(helix);
  for (let i = 0; i < 26; i++){
    const y = i * 0.16, a = i * 0.45;
    for (const s of [0, PI]){
      const b = live(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), glowM(s ? 0xffb84a : pal.holo))); b.position.set(Math.cos(a + s) * 0.7, y, Math.sin(a + s) * 0.7); helix.add(b);
    }
    if (i % 2 === 0){ const rung = live(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.02), holoM(pal.holo, 0.5))); rung.position.y = y; rung.rotation.y = -a; helix.add(rung); }
  }
  spinner(helix, 0.5);
  // the SERVICE RECORD and the MISSION LOGS: a console each at the far end of the reading floor
  for (const z of [-4.5, 4.5]){
    K.box(-22, z, 0.8, 0.7, 1.1, M.metalD);
    pic(K.deco(new THREE.PlaneGeometry(1.4, 0.9), M.screen, -21.2, 1.6, z, 0, PI / 2 - 0.25, 0));
    const holo = live(K.deco(new THREE.BoxGeometry(0.5, 0.5, 0.5), glowM(z < 0 ? 0x7ad8ff : 0xffd27a), -22, 2.4, z, PI / 4, 0, PI / 4));
    anim(holo, (o, t, b) => { o.rotation.y = t * 0.8; o.position.y = b.y + Math.sin(t * 1.3) * 0.1; });
  }
  // the technicians on their rounds
  for (const [x, z, yaw] of [[-12, 2, PI / 2], [8, -3, -0.4], [14, 3, PI]]) trooper(x, z, yaw, { cloth: 0x8a98a6, variant: 2 });
}

/* ---------------- THE ARMORY ---------------- */
function armory(K, pal, M, R){
  shell(K, M, pal, { wallH: 15, rise: 7, doors: ['n'], win: [8, 12.5], bay: 7 });
  const H = shared.arenaHalf;
  // the ARMOUR STAND: a suit of armour on a lit plinth, the bench in front of it laid out with parts
  roundStep(K, 0, 6, 7, 0.35, M.panel, 40);
  live(K.deco(new THREE.RingGeometry(6.6, 7.0, 48), M.screen, 0, 0.37, 6, -PI / 2));
  K.column(0, 10, 1.2, 0.7, M.metalD, { wallKick: false, seg: 20, taper: 1 });
  showTrooper(0, 10, PI, { y: 0.7, variant: 4 });
  live(K.deco(new THREE.CylinderGeometry(0.6, 2.2, 8, 24, 1, true), holoM(0xd8f0ff, 0.07), 0, 4.6, 10));
  K.box(0, 6, 2.2, 0.9, 1.0, M.metalD);
  K.deco(new THREE.BoxGeometry(4.6, 0.12, 2.0), M.trim, 0, 1.06, 6);
  for (const [x, z, w, h] of [[-1.4, 5.8, 0.5, 0.3], [-0.5, 6.2, 0.9, 0.2], [0.8, 5.9, 0.4, 0.4], [1.6, 6.3, 0.6, 0.15]]) K.deco(new THREE.BoxGeometry(w, h, 0.4), x > 0 ? M.white : M.metalD, x, 1.12 + h / 2, z);
  const part = live(K.deco(new THREE.SphereGeometry(0.28, 12, 8), M.holo, 0, 2.2, 6));
  anim(part, (o, t, b) => { o.position.y = b.y + Math.sin(t * 1.2) * 0.12; o.rotation.y = t; });
  // armour on its stands down both walls, and lockers between them
  for (const s of [-1, 1]){
    for (let z = -16; z <= 16; z += 6.5){
      K.column(s * 24, z, 0.7, 0.4, M.metalD, { wallKick: false, seg: 12, taper: 1 });
      trooper(s * 24, z, s > 0 ? -PI / 2 : PI / 2, { y: 0.4, rest: true, cloth: s > 0 ? PAL.blue : PAL.red });
      solids.push({ x: s * 24, z, r: 0.75, h: 2.4 });
    }
    for (const z of [-19.5, -9.6, -3.2, 3.2, 9.6, 19.5]) rack(K, M, s * 28.6, z, s > 0 ? -PI / 2 : PI / 2, 4);
  }
  // crates of kit and a weapons table on the way in
  for (const [x, z] of [[-10, -12], [10, -12], [-12, 18], [12, 18]]){ K.box(x, z, 1.1, 0.8, 0.9, std(0x4a545e, 0.8, 0.2), { climbable: true }); K.deco(new THREE.BoxGeometry(0.06, 0.3, 1.4), M.red, x + 1.12, 0.55, z).userData.passThrough = true; }
  K.box(-8, 0, 0.8, 2.4, 1.0, M.metalD);
  for (let k = 0; k < 4; k++) K.deco(new THREE.BoxGeometry(0.16, 0.12, 1.1), M.metalD, -8 + (k - 1.5) * 0.35, 1.08, -1.2 + k * 0.8);
  K.banner(0, 10, H + 0.6, PI, 5, 8, pal.blue, 0xe8ecef, 0xe8ecef);
}
