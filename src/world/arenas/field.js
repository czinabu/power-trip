// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shared pieces for the large open battle maps (grassland, icefront, graveyard): cover walls laid out as plain data,
// the cover spots squads read off them, rocks, drifts, craters and wrecked walkers.
//
// A battle map keeps its layout in a PLAN at the top of its file so the map's SPOTS (where allies and enemies start,
// the cover lines, the points to hold) can be worked out at load time, before any arena is built: a story mission
// (data/missions.js) imports them like REFUGE_SPOTS. The builder then walks the same PLAN, so the two never drift apart.
// +z is the hero's side (north, where allies start); the enemy comes from -z.

import * as THREE from 'three';
import { solids } from '../../state.js';

/* a cover wall in a PLAN: [x, z, half-length, h, alongX (1) or alongZ (0)] → the box it stands as */
export const wallBox = ([x, z, hl, h, ax]) => ({ x, z, hx: ax ? hl : 0.55, hz: ax ? 0.55 : hl, h });

/* COVER SPOTS behind every wall that runs east–west: a spot every ~2.6 m along its length, just off the face away from
   the threat, and the way to face over it. side +1 = the north face (allies, facing south: yaw π), -1 = the south face
   (enemies, facing north: yaw 0). Walls that run north–south give flank cover and aren't listed. */
export function coverSpots(walls, side, step = 2.6){
  const out = [];
  for (const w of walls){
    const b = wallBox(w);
    if (!w[4] || b.h < 0.9) continue;
    const n = Math.max(1, Math.floor((b.hx * 2) / step)), z = b.z + side * (b.hz + 0.85);
    for (let i = 0; i < n; i++) out.push([+(b.x - b.hx + (i + 0.5) * (b.hx * 2 / n)).toFixed(2), +z.toFixed(2), side > 0 ? Math.PI : 0]);
  }
  return out;
}

export function fieldKit(K, R){
  /* a cover wall from a PLAN row: a solid box and a cap along the top, dressed as sandbags (o.bags), buttressed (o.buttress),
     a starship hull plate (o.plate) or broken (o.jag). mats: { body, cap } */
  const wall = (w, mats, o = {}) => {
    const b = wallBox(w), ax = w[4];
    K.box(b.x, b.z, b.hx, b.hz, b.h, mats.body);
    const solid = solids[solids.length - 1];
    if (mats.cap) K.deco(new THREE.BoxGeometry(b.hx*2 + 0.1, 0.16, b.hz*2 + 0.14), mats.cap, b.x, b.h + 0.06, b.z);
    if (o.bags){   // sandbag rows: rounded bags laid along the top
      const len = b.hx*2 > b.hz*2 ? b.hx*2 : b.hz*2, n = Math.floor(len / 0.9);
      for (let i = 0; i < n; i++){
        const t = -len/2 + (i + 0.5) * len/n;
        K.deco(new THREE.CapsuleGeometry(0.26, 0.42, 2, 6), mats.cap || mats.body, b.x + (ax ? t : 0), b.h + 0.2, b.z + (ax ? 0 : t), 0, ax ? 0 : Math.PI/2, Math.PI/2);
      }
      solid.h = b.h + 0.4;   // the bags are part of the wall: you stand on them, not sunk into them
    } else if (o.buttress && (ax ? b.hx : b.hz) > 3){
      const len = ax ? b.hx : b.hz;
      for (let t = -len + 1.6; t < len - 1; t += 3.2) K.deco(new THREE.BoxGeometry(ax ? 0.4 : 1.4, b.h + 0.1, ax ? 1.4 : 0.4), mats.cap || mats.body, b.x + (ax ? t : 0), (b.h + 0.1)/2, b.z + (ax ? 0 : t));
    }
    if (o.plate){   // a starship hull plate: frame ribs, panel seams and a torn top edge
      const len = ax ? b.hx : b.hz;
      for (let t = -len + 1.2; t < len - 0.6; t += 2.4) K.deco(new THREE.BoxGeometry(ax ? 0.3 : b.hx*2 + 0.16, b.h, ax ? b.hz*2 + 0.16 : 0.3), mats.cap || mats.body, b.x + (ax ? t : 0), b.h/2, b.z + (ax ? 0 : t));
      for (let y = 1.3; y < b.h - 0.5; y += 1.5) K.deco(new THREE.BoxGeometry(b.hx*2 + (ax ? 0.02 : 0.08), 0.12, b.hz*2 + (ax ? 0.08 : 0.02)), mats.cap || mats.body, b.x, y, b.z);
      for (let i = 0; i < 3; i++){
        const t = (R() - 0.5) * len * 1.6;
        const r = 0.45 + R()*0.45, h = 1 + R()*1.4, px = b.x + (ax ? t : 0), pz = b.z + (ax ? 0 : t);
        K.deco(new THREE.ConeGeometry(r, h, 4), mats.body, px, b.h + 0.45, pz, (R() - 0.5)*0.6, R()*3, (R() - 0.5)*0.6);
        solids.push({ x: px, z: pz, r: r*0.5, h: b.h + 0.45 + h*0.25 });   // the torn spike stands up off the top
      }
    }
    if (o.jag){   // a broken top: a few chunks stacked off the cap
      for (let i = 0; i < 3; i++){
        const t = (R() - 0.5) * (ax ? b.hx : b.hz) * 1.6;
        const l = 0.6 + R()*0.8, h = 0.3 + R()*0.4, px = b.x + (ax ? t : 0), pz = b.z + (ax ? 0 : t);
        K.deco(new THREE.BoxGeometry(l, h, 0.8), mats.cap || mats.body, px, b.h + 0.2, pz, 0, ax ? 0 : Math.PI/2, (R() - 0.5)*0.4);
        solids.push({ x: px, z: pz, hx: ax ? l/2 : 0.4, hz: ax ? 0.4 : l/2, h: b.h + 0.2 + h/2, box: true });   // a chunk you stand on
      }
    }
  };
  /* a boulder or rock outcrop: collides as a column, drawn as a lumpy faceted rock (two shards) */
  const rock = (x, z, r, h, mat, mat2, y0 = 0) => {   // (y0: it sits on something, a ridge's top)
    const c = { x, z, r, h: y0 + h }; solids.push(c);
    const a = K.deco(new THREE.DodecahedronGeometry(1, 0), mat, x, y0 + h*0.45, z, R()*3, R()*3, R()*3); a.scale.set(r*1.05, h*0.58, r*1.05);
    const b = K.deco(new THREE.DodecahedronGeometry(1, 0), mat2 || mat, x + r*0.3, y0 + h*0.72, z - r*0.2, R()*3, R()*3, R()*3); b.scale.set(r*0.7, h*0.35, r*0.7);
    if (y0){   // on a ridge's crest: the tumbled shards can stand taller than asked, so the column grows to their top
      const bb = new THREE.Box3().setFromObject(a).union(new THREE.Box3().setFromObject(b));
      c.h = Math.max(c.h, bb.max.y - 0.35);
    }
  };
  /* a tall rock SPIRE (the grasslands' needles): a wall-kick column, tapered, with a broken crown and a skirt of rubble */
  const spire = (x, z, r, h, mat, mat2) => {
    K.column(x, z, r, h, mat, { taper: 0.45, seg: 7 });
    K.deco(new THREE.ConeGeometry(r*0.55, h*0.22, 6), mat2 || mat, x + r*0.1, h + h*0.08, z, 0.1, R()*3, 0.08);
    K.deco(new THREE.CylinderGeometry(r*1.25, r*1.45, 0.5, 7), mat2 || mat, x, 0.25, z, 0, R()*3, 0);
    solids.push({ x: x + r*0.1, z, r: r*0.3, h: h*1.12 });                 // the broken crown
    solids.push({ x, z, r: r*1.4, h: 0.5, climbable: true });             // the rubble skirt: a step up to the spire
  };
  /* a low DRIFT or dune you walk over: a climbable step under STEP_UP, drawn as a squashed mound */
  const drift = (x, z, hx, hz, mat) => {
    solids.push({ x, z, hx, hz, h: 0.42, box: true, climbable: true });
    K.deco(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI*2, 0, Math.PI/2), mat, x, 0, z).scale.set(hx*1.15, 0.46, hz*1.15);
  };
  /* a scorched CRATER on the floor: a dark ring decal (flat, nothing to trip on). Mortar hazards sit on these */
  const crater = (x, z, r, mat) => {
    K.deco(new THREE.RingGeometry(r*0.35, r, 18), mat, x, 0.025, z, -Math.PI/2).receiveShadow = true;
    K.deco(new THREE.CircleGeometry(r*0.35, 14), mat, x, 0.02, z, -Math.PI/2);
  };
  /* a crate stack: a tall crate with a short one beside it, so it climbs in two hops (1.1 then 2.2) */
  const crates = (x, z, mat, mat2, flip = 1, y = 0) => {   // (y: standing on a terrace)
    K.box(x, z, 0.9, 0.9, 2.2, mat, { y });
    K.box(x + 1.7*flip, z + 0.2, 0.8, 0.8, 1.1, mat2 || mat, { y });
  };
  /* a BANK: one terrace of a ridge or a rise. It collides as a climbable box (y…y+h), and draws as a sloped frustum
     whose foot spreads `skirt` past the box, so a stack of them reads as a hillside, not a flight of crates */
  const bank = (x, z, hx, hz, y, h, mat, skirt = 0.8) => {
    solids.push({ x, z, hx, hz, h: y + h, box: true, climbable: true });
    const geo = new THREE.BoxGeometry((hx + skirt) * 2, h, (hz + skirt) * 2), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, Math.sign(p.getX(i)) * hx, p.getY(i), Math.sign(p.getZ(i)) * hz);   // the top pulls in to the box
    geo.computeVertexNormals();
    const m = K.deco(geo, mat, x, y + h / 2, z); m.castShadow = false;
    return m;
  };
  /* a RIDGE you can walk up: a long bank of packed snow (or ice) in stacked climbable terraces, each one under STEP_UP,
     narrowing to a crest, so a fight on a flat field gets high ground and a skyline to duck behind. Runs along x (ax 1)
     or z (ax 0) from its centre: half-length hl, half-width hw at the foot. On the crest: rock teeth for cover
     (o.teeth) and tall SERACS (o.seracs: ice towers you wall-kick up, 7–14 m) so it stands tall over the field.
     mats: { body, cap, rock, rock2 }. Returns the crest height. */
  const ridge = (x, z, hl, hw, tiers, mats, o = {}) => {
    const step = o.step ?? 0.45, ax = o.ax ?? 1;
    for (let i = 0; i < tiers; i++){
      const l = hl - i * (o.taperL ?? 1.6), w = Math.max(1.2, hw - i * (o.taperW ?? 1.1));
      bank(x, z, ax ? l : w, ax ? w : l, i * step, step, i ? (mats.cap || mats.body) : mats.body, i ? 0.7 : 1.4);
    }
    const top = tiers * step, n = o.teeth || 0, crest = hl - (tiers - 1) * (o.taperL ?? 1.6);
    for (let i = 0; i < n; i++){
      const t = n === 1 ? 0 : -crest * 0.7 + i * (crest * 1.4 / (n - 1)) + (R() - 0.5) * 1.2;
      rock(x + (ax ? t : (R() - 0.5) * 0.6), z + (ax ? (R() - 0.5) * 0.6 : t), 0.9 + R() * 0.5, 1.3 + R() * 0.9, mats.rock || mats.body, mats.rock2, top);
    }
    for (let i = 0; i < (o.seracs || 0); i++){
      const d = ((i + 0.5) / o.seracs * 2 - 1) * crest * 0.8;
      spire(x + (ax ? d : 0), z + (ax ? 0 : d), 1.3 + R() * 0.8, 7 + R() * 7, mats.serac || mats.rock2 || mats.body, mats.rock || mats.body);
    }
    return top;
  };
  /* a RISE: a hill climbed in terraces (each under STEP_UP), the top tier at the back. Footprint x0…x1 by z0…z1, the
     climb faces toward z (dir +1: the low side at z0 rising toward z1; -1 the other way); each tier also pulls in from
     the sides by `inset`. For a base on a hill, a defensive line on a knoll. Returns the top height. */
  const rise = (x0, x1, z0, z1, tiers, mats, o = {}) => {
    const step = o.step ?? 0.45, dir = o.dir ?? 1, depth = (z1 - z0) / (tiers + (o.flat ?? 1)), inset = o.inset ?? 3;
    for (let i = 0; i < tiers; i++){
      const a = x0 + i * inset, b = x1 - i * inset;
      const za = dir > 0 ? z0 + i * depth : z0, zb = dir > 0 ? z1 : z1 - i * depth;
      bank((a + b) / 2, (za + zb) / 2, (b - a) / 2, (zb - za) / 2, i * step, step, i % 2 ? (mats.cap || mats.body) : mats.body, 1.2);
    }
    return tiers * step;
  };
  /* a GLACIER WALL: a towering wall of ice past the edge of the play space (no collision: nobody reaches it), built
     from tall leaning slabs with snow on their shoulders, from (x0, z0) to (x1, z1). h: [min, max] height. For the
     maps whose lore is big: the player should feel small against it. */
  const glacier = (x0, z0, x1, z1, h, mats, o = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / (o.every ?? 9))), ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i < n; i++){
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t + (R() - 0.5) * 3, z = z0 + (z1 - z0) * t + (R() - 0.5) * 3;
      const hh = h[0] + R() * (h[1] - h[0]), w = 7 + R() * 7, d = 6 + R() * 6, lean = (R() - 0.5) * 0.12;
      const slab = K.deco(new THREE.CylinderGeometry(0.62, 1, 1, 5, 1).rotateY(R() * 3), R() < 0.5 ? mats.body : (mats.body2 || mats.body), x, hh / 2 - 1, z, lean, ry, lean);
      slab.scale.set(d, hh, w); slab.castShadow = false; slab.userData.passThrough = true;
      const cap = K.deco(new THREE.ConeGeometry(1, 1, 5).rotateY(R() * 3), mats.cap || mats.body, x, hh - 1 + hh * 0.06, z, lean, ry, lean);
      cap.scale.set(d * 0.66, hh * 0.16, w * 0.66); cap.castShadow = false; cap.userData.passThrough = true;
    }
  };
  /* a DOWNED WALKER hulk you can climb and fight from: the hull lies along x (or z), the head off one end and the
     legs splayed as low steps. The hull top is high ground (4.2): crate, a broken leg stump, then the hull. Every
     piece touches the hull, so there's no pocket between them for a body to wedge into. */
  const walkerHulk = (x, z, alongX, mats) => {
    const L = (dx, dz) => alongX ? [x + dx, z + dz] : [x + dz, z + dx];
    const hb = (dx, dz, hl, hw, h, mat, o) => { const [px, pz] = L(dx, dz); return K.box(px, pz, alongX ? hl : hw, alongX ? hw : hl, h, mat, o); };
    const hull = hb(0, 0, 7.5, 3.0, 4.2, mats.hull);
    hull.rotation[alongX ? 'x' : 'z'] = 0.05;   // rolled a touch onto its side
    hb(9.6, 0.8, 2.1, 1.5, 2.6, mats.dark);                     // the head, nose down in the ground
    { const [px, pz] = L(7.8, 0.6); K.deco(new THREE.CylinderGeometry(0.8, 0.8, 2.6, 8), mats.dark, px, 2.4, pz, alongX ? 0 : Math.PI/2, 0, alongX ? Math.PI/2 : 0);   // neck
      solids.push({ x: px, z: pz, hx: alongX ? 1.3 : 0.8, hz: alongX ? 0.8 : 1.3, h: 3.2, box: true }); }
    if (mats.glow){ const [px, pz] = L(11.8, 0.8); K.deco(new THREE.BoxGeometry(alongX ? 0.3 : 1.6, 0.4, alongX ? 1.6 : 0.3), mats.glow, px, 1.6, pz); }   // a dead viewport
    for (const [dx, dz, h] of [[-4.5, 3.85, 2.9], [3.8, 3.85, 1.8]]){ const [px, pz] = L(dx, dz); K.column(px, pz, 0.85, h, mats.dark, { taper: 0.9, seg: 8 }); }   // broken leg stumps
    for (const [dx, dz] of [[-4.0, -5.2], [4.4, -5.2]]) hb(dx, dz, 0.8, 2.2, 1.0, mats.dark);   // legs lying in the dirt (vault them)
    hb(-6.2, 3.9, 0.9, 0.9, 1.6, mats.crate || mats.dark);     // a cargo crate against the hull and the stump: the first hop up
    // armour plates along the hull's sides, and the gun chin
    { const [px, pz] = L(0, 0); K.deco(new THREE.BoxGeometry(alongX ? 13 : 4.4, 0.8, alongX ? 4.4 : 13), mats.plate || mats.dark, px, 4.5, pz);   // the armoured spine
      solids.push({ x: px, z: pz, hx: alongX ? 6.5 : 2.2, hz: alongX ? 2.2 : 6.5, h: 4.9, box: true }); }
    { const [px, pz] = L(-2, -3.05); K.deco(new THREE.BoxGeometry(alongX ? 2.2 : 0.14, 1.6, alongX ? 0.14 : 2.2), mats.dark, px, 1.6, pz); }       // a side hatch, blown open
    for (let i = -2; i <= 2; i++){ const [px, pz] = L(i * 2.8, 3.05); K.deco(new THREE.BoxGeometry(alongX ? 2.4 : 0.2, 2.6, alongX ? 0.2 : 2.4), mats.plate || mats.dark, px, 2.3, pz); }
    { const [px, pz] = L(11.2, 0.8); K.deco(new THREE.BoxGeometry(alongX ? 1.2 : 0.4, 0.4, alongX ? 0.4 : 1.2), mats.dark, px, 0.9, pz); }
  };
  return { wall, rock, spire, drift, crater, crates, walkerHulk, bank, ridge, rise, glacier };
}

/* a WINDING TRENCH LINE as PLAN rows: a path of corners, each leg running along x or along z (collision is
   axis-aligned), so a line zig-zags through traverses instead of standing as a row of identical blocks. A null in the
   path is a gap (a way through). h is the berm height, or a function of the leg's index for a line that varies.
   e.g. trenchRows([[-30, 10], [-10, 10], [-10, 14], [0, 14], null, [6, 14], [20, 14]], 1.3) */
export function trenchRows(path, h = 1.3){
  const rows = [];
  let leg = 0;
  for (let i = 1; i < path.length; i++){
    const a = path[i - 1], b = path[i];
    if (!a || !b) continue;
    const ax = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 1 : 0;
    const hl = Math.max(0.6, (ax ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1])) / 2 + (ax ? 0.55 : 0));   // legs along x run over the corners
    rows.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, hl, typeof h === 'function' ? h(leg) : h, ax]);
    leg++;
  }
  return rows;
}

/* a mortar / cannon strike zone on a crater: an amber telegraph, then a blast that hurts whoever stands in it */
export const strike = (x, z, r, t, color, o = {}) => ({ kind: 'point', cx: x, cz: z, r, period: o.period ?? 11, warnDur: o.warn ?? 1.8,
  activeDur: o.active ?? 0.8, dmg: o.dmg ?? 26, color, flash: true, t, walker: !!o.walker });   // walker: a walker's cannon fires the shot (world/warfront.js)
