// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ZONE KIT: every kind of piece an open zone's plan can hold (world/zones/jedha-plan.js), each as two halves:
//   solids(p, out)  its collision, pushed onto `out` (world/zone-stream.js registers every piece's at once)
//   mesh(p, K)      its meshes, built into a chunk's group when someone comes near (K: the kit below, bound to that group)
// The two never disagree: anything a mesh shows standing in the street has a solid under it, or is a low CLIMBABLE step,
// or is flagged passThrough (cloth overhead, a lit line on the ground). Decoration that changes no solid rolls its own dice
// from the piece's seed (p.s), so a chunk built a second time looks exactly as it did the first.
// Materials are made once per zone (zoneMats) and shared by every chunk: a chunk thrown away frees only its geometry.

import * as THREE from 'three';
import { seeded } from '../arenas/kit.js';

const PI = Math.PI;
const std = (c, r = 0.92, m = 0.04) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
const veil = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });

/* the zone's materials, from its world's palette (data/worlds.js ZONE_WORLDS) */
export function zoneMats(pal = {}){
  return {
    stone: [std(pal.stone ?? 0xc29c6e), std(pal.stone2 ?? 0xb48e62), std(pal.stone3 ?? 0xcaa77c)],
    stoneD: std(pal.stoneD ?? 0x8e7250), trim: std(pal.trim ?? 0x86643f), roof: std(pal.roof ?? 0x9c5e3a),
    dome: std(pal.dome ?? 0x5e8a9a, 0.7, 0.2), wall: std(pal.wall ?? 0xae8c64), wallD: std(pal.wallD ?? 0x987a56),
    cloth: [std(pal.cloth1 ?? 0xa8402a), std(pal.cloth2 ?? 0xd8b46a), std(pal.cloth3 ?? 0x3a6a8a), std(pal.cloth4 ?? 0xe0d4bc)].map(m => { m.side = THREE.DoubleSide; return m; }),
    wood: std(pal.wood ?? 0x6a4a2e), dark: std(pal.recess ?? 0x3a2a1e, 1, 0), rock: std(pal.rock ?? 0x9a7452), rockD: std(pal.rockD ?? 0x7a5a40),
    imp: std(pal.imp ?? 0xc8ccd2, 0.6, 0.25), impD: std(pal.impD ?? 0x5a606a, 0.6, 0.35), red: std(pal.red ?? 0xa83228, 0.7, 0.1),
    metal: std(pal.metal ?? 0x6a6e74, 0.55, 0.5), hull: std(pal.hull ?? 0xd8d4c8, 0.6, 0.25),
    gold: std(pal.gold ?? 0xd8b46a, 0.45, 0.55), statue: std(pal.statue ?? 0xa88a66), statueD: std(pal.statueD ?? 0x7a5e44),
    lamp: glow(pal.lamp ?? 0xffc870), kyber: glow(pal.kyber ?? 0x8ad8ff), beacon: glow(pal.beacon ?? 0xff5a40),
    water: new THREE.MeshStandardMaterial({ color: pal.water ?? 0x3a7a8a, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.72 }),
    flag: glow(pal.flag ?? 0xffe6a8),
    crystal: glow(pal.crystal ?? pal.kyber ?? 0x8ad8ff),   // a crystal cluster's shards (the gate ruins' are red: data/worlds.js)
    gate: veil(pal.gate ?? 0xb46bff), fire: glow(pal.fire ?? pal.gate ?? 0xb46bff),
  };
}

/* the mesh kit, bound to a group: every mesh casts and takes shadow unless it says otherwise */
export function meshKit(grp, M){
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true; grp.add(m); return m;
  };
  return {
    M, grp, add,
    box: (x, y0, z, hx, h, hz, mat, ry = 0) => add(new THREE.BoxGeometry(hx * 2, h, hz * 2), mat, x, y0 + h / 2, z, 0, ry, 0),
    cyl: (x, y0, z, r, h, mat, seg = 10, taper = 1) => add(new THREE.CylinderGeometry(r * taper, r, h, seg), mat, x, y0 + h / 2, z),
    dome: (x, y0, z, r, mat, seg = 14) => add(new THREE.SphereGeometry(r, seg, Math.max(5, seg >> 1), 0, PI * 2, 0, PI / 2), mat, x, y0, z),
    // a picture: no solid, no bake when it is see-through (cloth overhead, a lit line on the ground)
    pic: (m) => { m.userData.passThrough = true; return m; },
    flat: (m) => { m.userData.passThrough = true; m.castShadow = false; return m; },
  };
}

/* ---------------- solids ---------------- */
const box = (out, x, z, hx, hz, h, o = {}) => out.push({ x, z, hx, hz, h, box: true, ...o });
// a part of a bigger piece (the guardian, the garrison…): a mound, a column or a box
const partSolid = (s, out) => { if (!s.solid) return; if (s.mound) out.push(s.mound); else if (s.r) col(out, s.x, s.z, s.r, s.h, s.o); else box(out, s.x, s.z, s.hx, s.hz, s.h, s.o); };
const col = (out, x, z, r, h, o = {}) => out.push({ x, z, r, h, ...o });

/* ---------------- the kinds ---------------- */
export const KINDS = {
  /* a WAYSTONE (data/zones.js): a carved pillar with a kyber shard over it and a lit ring at its foot. Touch one and you can
     travel to it from any other, and wake at it after a fall (game/zone.js). The gate's is ringed gold: the way home */
  waystone: {
    solids(p, out){ col(out, p.x, p.z, 0.55, 1.6); },
    mesh(p, K){
      const M = K.M;
      K.cyl(p.x, 0, p.z, 0.75, 0.4, M.stoneD, 8);
      K.cyl(p.x, 0.4, p.z, 0.55, 1.2, M.stone[2], 8, 0.8);
      K.cyl(p.x, 1.6, p.z, 0.75, 0.16, M.gold, 8);
      const shard = K.add(new THREE.OctahedronGeometry(0.34), M.kyber, p.x, 2.35, p.z); shard.scale.y = 1.6; shard.castShadow = false; shard.userData.noOutline = true;
      K.flat(K.add(new THREE.RingGeometry(1.9, 2.15, 40), p.gate ? M.lamp : M.kyber, p.x, 0.04, p.z, -PI / 2));
    },
  },
  /* A HOUSE: sandstone walls on a darker plinth, a cornice and parapet, dark door and window recesses, a roof (sometimes a
     dome, clutter on top), an annex on one side to climb by, an awning over a door. A RUINED one is a roofless shell of
     four broken walls with a doorway gap, rubble inside */
  house: {
    solids(p, out){
      if (p.ruined){ for (const w of ruinWalls(p)) box(out, w.x, w.z, w.hx, w.hz, w.h); box(out, p.x, p.z, Math.max(0.5, p.hx - 1.6), Math.max(0.5, p.hz - 1.6), 0.45, { climbable: true }); return; }
      box(out, p.x, p.z, p.hx, p.hz, p.h + 0.77);   // (the roof you land on is the parapet's top)
      if (p.dome) col(out, p.x, p.z, p.dome * 1.02, p.h + 0.6 + p.dome * 0.92);
      for (const [dx, dz, s, h] of p.bits || []) box(out, p.x + dx, p.z + dz, s, s, p.h + h);
      if (p.annex) box(out, p.annex.x, p.annex.z, p.annex.hx, p.annex.hz, p.annex.h);
      if (p.awn){ const a = awning(p); box(out, a.x, a.z, a.hx, a.hz, 2.95, { y0: 2.6, soft: true }); }
    },
    mesh(p, K){
      const R = seeded(p.s), M = K.M, wall = M.stone[p.tone % 3];
      if (p.ruined){
        for (const w of ruinWalls(p)){
          K.box(w.x, 0, w.z, w.hx, w.h, w.hz, wall);
          if (R() < 0.7) K.box(w.x + (R() - 0.5) * w.hx, w.h, w.z + (R() - 0.5) * w.hz, Math.min(w.hx, 0.8) * 0.7, 0.4 + R() * 0.5, Math.min(w.hz, 0.8) * 0.7, wall);   // a broken top
        }
        K.box(p.x, 0, p.z, Math.max(0.5, p.hx - 1.6), 0.45, Math.max(0.5, p.hz - 1.6), M.stoneD);   // the fallen roof, in a heap
        const hx = Math.max(0.5, p.hx - 1.6), hz = Math.max(0.5, p.hz - 1.6);
        for (let i = 0; i < 3; i++){ const sx = Math.min(hx, 0.4 + R() * 0.4), sz = Math.min(hz, 0.4 + R() * 0.4); K.box(p.x + (R() - 0.5) * 2 * (hx - sx), 0.45, p.z + (R() - 0.5) * 2 * (hz - sz), sx, 0.15 + R() * 0.2, sz, wall); }   // (low on the heap: a step, not a wall)
        return;
      }
      K.box(p.x, 0, p.z, p.hx, p.h, p.hz, wall);
      K.box(p.x, 0, p.z, p.hx + 0.14, 0.9, p.hz + 0.14, M.stoneD);                         // plinth
      K.box(p.x, p.h - 0.05, p.z, p.hx + 0.22, 0.32, p.hz + 0.22, M.trim);                 // cornice
      K.box(p.x, p.h + 0.27, p.z, p.hx + 0.05, 0.5, p.hz + 0.05, wall);                     // parapet
      if (p.h > 6.5) K.box(p.x, p.h * 0.5, p.z, p.hx + 0.12, 0.28, p.hz + 0.12, M.trim);   // a string course
      if (p.dome){ K.cyl(p.x, p.h, p.z, p.dome * 1.02, 0.6, M.trim, 14); K.dome(p.x, p.h + 0.6, p.z, p.dome, M.dome); K.cyl(p.x, p.h + 0.6 + p.dome * 0.95, p.z, 0.12, 0.9, M.gold, 6); }
      for (const [dx, dz, s, h] of p.bits || []) K.box(p.x + dx, p.h, p.z + dz, s, h, s, R() < 0.5 ? M.stoneD : M.wood);
      // recesses: a doorway on one face, window slits on every face
      const faces = [[1, 0, p.hz], [-1, 0, p.hz], [0, 1, p.hx], [0, -1, p.hx]], door = R() * 4 | 0;
      faces.forEach(([fx, fz, half], i) => {
        const along = fz !== 0, off = (fx ? p.hx : p.hz) + 0.04;
        const rec = (t, y, w, hh) => { const m = K.box(p.x + (along ? t : fx * off), y, p.z + (along ? fz * off : t), along ? w / 2 : 0.06, hh, along ? 0.06 : w / 2, M.dark); m.userData.noOutline = true; m.castShadow = false; };
        if (i === door) rec((R() - 0.5) * half, 0, 1.8, 2.9);
        for (let y = 3.6; y < p.h - 1.2; y += 3.2) for (let t = -half + 1.4; t < half - 1; t += 2.6) if (R() < 0.42) rec(t, y, 0.8, 1.3);
      });
      if (p.annex){ const a = p.annex; K.box(a.x, 0, a.z, a.hx, a.h, a.hz, M.stone[(p.tone + 1) % 3]); K.box(a.x, a.h - 0.04, a.z, a.hx + 0.12, 0.2, a.hz + 0.12, M.trim); }
      if (p.awn){
        const a = awning(p), cl = M.cloth[p.awn.cloth % 4];
        K.pic(K.box(a.x, 2.62, a.z, a.hx, 0.08, a.hz, cl));
        for (const s of [-1, 1]){ const px = a.alongX ? a.x + s * (a.hx - 0.1) : a.ox, pz = a.alongX ? a.oz : a.z + s * (a.hz - 0.1); K.pic(K.cyl(px, 0, pz, 0.07, 2.62, M.wood, 5)); }
      }
    },
  },
  /* the city WALL: a thick curtain with a walk and merlons along its top, its inner face toward `face` */
  wall: {
    solids(p, out){ box(out, p.x, p.z, p.hx, p.hz, p.h + 1.2); },   // (up to the merlons' tops: nobody walks the wall)
    mesh(p, K){
      const R = seeded(p.s), M = K.M;
      K.box(p.x, 0, p.z, p.hx, p.h, p.hz, M.wall);
      K.box(p.x, 0, p.z, p.hx + 0.2, 1.6, p.hz + 0.2, M.wallD);
      K.box(p.x, p.h - 1.2, p.z, p.hx + 0.25, 0.4, p.hz + 0.25, M.trim);
      const along = p.hx > p.hz, len = (along ? p.hx : p.hz) * 2;
      for (let t = -len / 2 + 1; t < len / 2 - 0.5; t += 2.2) K.box(p.x + (along ? t : 0), p.h, p.z + (along ? 0 : t), along ? 0.6 : p.hx, 1.2, along ? p.hz : 0.6, M.wall);
      // dark arrow slits on the inner face
      const [fx, fz] = p.face;
      for (let t = -len / 2 + 3; t < len / 2 - 2; t += 6) if (R() < 0.7){ const m = K.box(p.x + (along ? t : fx * (p.hx + 0.03)), p.h * 0.55, p.z + (along ? fz * (p.hz + 0.03) : t), along ? 0.25 : 0.05, 2.2, along ? 0.05 : 0.25, M.dark); m.userData.noOutline = true; }
    },
  },
  tower: {
    solids(p, out){ col(out, p.x, p.z, p.r, p.h); },
    mesh(p, K){
      const M = K.M;
      K.cyl(p.x, 0, p.z, p.r, p.h, M.wall, 12, 0.92);
      K.cyl(p.x, 0, p.z, p.r * 1.08, 2, M.wallD, 12);
      K.cyl(p.x, p.h - 0.6, p.z, p.r * 1.1, 0.6, M.trim, 12);
      if (p.cap){ K.add(new THREE.ConeGeometry(p.r * 1.05, p.r * 1.3, 12), M.roof, p.x, p.h + p.r * 0.65, p.z); }
    },
  },
  /* the south GATEHOUSE: two square towers either side of the gap and a lintel high over it */
  gatehouse: {
    solids(p, out){
      for (const s of [-1, 1]){ box(out, p.x + s * (p.half + 3), p.z, 3.6, 4, p.h + 0.2); col(out, p.x + s * (p.half + 3), p.z, 2.6, p.h + 0.2 + 2.5); }   // (the towers, their trim and their domes)
      box(out, p.x, p.z, p.half, 2.4, p.h, { y0: 9 });
    },
    mesh(p, K){
      const M = K.M;
      for (const s of [-1, 1]){
        const x = p.x + s * (p.half + 3);
        K.box(x, 0, p.z, 3.2, p.h, 3.6, M.wall); K.box(x, 0, p.z, 3.4, 2, 3.8, M.wallD); K.box(x, p.h - 0.4, p.z, 3.6, 0.6, 4, M.trim);
        K.dome(x, p.h + 0.2, p.z, 2.6, M.dome);
      }
      K.box(p.x, 9, p.z, p.half, p.h - 9, 2.4, M.wall); K.box(p.x, 8.6, p.z, p.half + 0.2, 0.5, 2.6, M.trim);
      const ban = M.cloth[0];
      for (const s of [-1, 1]) K.pic(K.box(p.x + s * (p.half + 3), 6, p.z - 3.7, 1.2, 6, 0.04, ban));
    },
  },
  /* the LANDING PAD: a low disc you step up onto, lit ring, the shuttle's markings */
  pad: {
    solids(p, out){ col(out, p.x, p.z, p.r, 0.35, { climbable: true }); },
    mesh(p, K){
      const M = K.M;
      K.cyl(p.x, 0, p.z, p.r, 0.35, M.stoneD, 32);
      K.flat(K.add(new THREE.RingGeometry(p.r - 1.1, p.r - 0.7, 40), M.lamp, p.x, 0.37, p.z, -PI / 2));
      K.flat(K.add(new THREE.RingGeometry(1.6, 2.0, 24), M.lamp, p.x, 0.37, p.z, -PI / 2));
    },
  },
  /* the SHUTTLE home: a stubby pilgrim lander on its gear, ramp down toward the city (the way out: game/zone.js) */
  shuttle: {
    solids(p, out){ box(out, p.x, p.z, 3.2, 4.6, 3.6); box(out, p.x, p.z + 0.4, 2.2, 3.4, 4.5); box(out, p.x, p.z + 0.6, 7.2, 1.6, 2.1); for (const s of [-1, 1]) box(out, p.x + s * 6.6, p.z + 0.6, 0.6, 1.4, 2.8); },
    mesh(p, K){
      const M = K.M;
      K.box(p.x, 0.9, p.z, 3.2, 2.7, 4.6, M.hull);
      K.box(p.x, 3.6, p.z + 0.4, 2.2, 0.9, 3.4, M.hull);
      K.box(p.x, 1.6, p.z + 0.6, 7.2, 0.5, 1.6, M.hull);   // the wings
      for (const s of [-1, 1]){ K.box(p.x + s * 6.6, 1.2, p.z + 0.6, 0.6, 1.6, 1.4, M.metal); K.flat(K.add(new THREE.CircleGeometry(0.42, 12), M.lamp, p.x + s * 6.6, 1.9, p.z + 2.05)); }
      K.box(p.x, 1.4, p.z - 4.62, 1.9, 1.3, 0.06, M.dark).userData.noOutline = true;   // the cockpit glass, toward the city
      for (const s of [-1, 1]) for (const t of [-1, 1]) K.cyl(p.x + s * 2.4, 0, p.z + t * 3.2, 0.22, 0.95, M.metal, 6);
      K.box(p.x, 3.2, p.z + 3.4, 3.25, 0.3, 1.2, M.red);   // a stripe on the tail
    },
  },
  /* a caravan TENT: four poles and a cloth roof you can land on */
  tent: {
    solids(p, out){ for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) col(out, p.x + sx * (p.hx - 0.2), p.z + sz * (p.hz - 0.2), 0.14, p.h); box(out, p.x, p.z, p.hx, p.hz, p.h + 0.3, { y0: p.h - 0.1, soft: true }); box(out, p.x, p.z + 1, 1.6, 1, 0.8); },
    mesh(p, K){
      const R = seeded(p.s), M = K.M, cl = M.cloth[R() * 4 | 0];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.cyl(p.x + sx * (p.hx - 0.2), 0, p.z + sz * (p.hz - 0.2), 0.14, p.h, M.wood, 6);
      const roof = K.add(new THREE.ConeGeometry(Math.hypot(p.hx, p.hz), 1.2, 4, 1, true), cl, p.x, p.h + 0.4, p.z, 0, PI / 4, 0); roof.scale.set(p.hx / p.hz, 1, 1); K.pic(roof);
      K.box(p.x, 0, p.z + 1, 1.6, 0.8, 1, M.wood);   // bundles under it
    },
  },
  well: {
    solids(p, out){ col(out, p.x, p.z, p.r, 1.0); },
    mesh(p, K){ const M = K.M; K.cyl(p.x, 0, p.z, p.r, 1.0, M.stoneD, 16); K.flat(K.add(new THREE.CircleGeometry(p.r * 0.8, 16), M.dark, p.x, 1.01, p.z, -PI / 2)); for (const s of [-1, 1]) K.cyl(p.x + s * p.r * 0.9, 1, p.z, 0.1, 1.8, M.wood, 5); K.pic(K.box(p.x, 2.8, p.z, p.r, 0.08, 0.08, M.wood)); },
  },
  /* a stack of CRATES: one to three, the low ones a step up */
  crates: {
    solids(p, out){ for (const c of crateList(p)) box(out, c.x, c.z, c.s, c.s, c.h, { climbable: c.h <= 0.9 }); },
    mesh(p, K){ const M = K.M; for (const c of crateList(p)){ K.box(c.x, 0, c.z, c.s, c.h, c.s, M.wood); K.box(c.x, c.h - 0.06, c.z, c.s + 0.04, 0.08, c.s + 0.04, M.trim); } },
  },
  /* a pilgrim LAMP on a post */
  lamp: {
    solids(p, out){ col(out, p.x, p.z, 0.22, p.h); },
    mesh(p, K){ const M = K.M; K.cyl(p.x, 0, p.z, 0.22, p.h, M.metal, 6, 0.6); K.box(p.x, p.h, p.z, 0.32, 0.5, 0.32, M.trim); K.box(p.x, p.h + 0.08, p.z, 0.22, 0.34, 0.22, p.pilgrim ? M.kyber : M.lamp).userData.noOutline = true; },
  },
  /* an ARCH over a street: two piers and a lintel overhead */
  arch: {
    solids(p, out){ for (const s of [-1, 1]) box(out, p.x + (p.alongX ? s * (p.span + 1) : 0), p.z + (p.alongX ? 0 : s * (p.span + 1)), p.alongX ? 1 : 1.4, p.alongX ? 1.4 : 1, p.h); box(out, p.x, p.z, p.alongX ? p.span + 2 : 1.4, p.alongX ? 1.4 : p.span + 2, p.h + 1.4, { y0: p.h - 1 }); },
    mesh(p, K){
      const M = K.M;
      for (const s of [-1, 1]){ const x = p.x + (p.alongX ? s * (p.span + 1) : 0), z = p.z + (p.alongX ? 0 : s * (p.span + 1)); K.box(x, 0, z, p.alongX ? 1 : 1.4, p.h, p.alongX ? 1.4 : 1, M.wall); K.box(x, 0, z, p.alongX ? 1.15 : 1.55, 1.2, p.alongX ? 1.55 : 1.15, M.wallD); }
      K.box(p.x, p.h - 1, p.z, p.alongX ? p.span + 2 : 1.4, 2.4, p.alongX ? 1.4 : p.span + 2, M.wall);
      K.box(p.x, p.h - 1.15, p.z, p.alongX ? p.span + 2.2 : 1.55, 0.3, p.alongX ? 1.55 : p.span + 2.2, M.trim);
      K.pic(K.box(p.x, p.h - 3.6, p.z + (p.alongX ? -1.45 : 0), p.alongX ? 1.4 : 0.04, 2.4, p.alongX ? 0.04 : 1.4, M.cloth[0]));
    },
  },
  column: {
    solids(p, out){ col(out, p.x, p.z, p.r * 1.25, 0.8); col(out, p.x, p.z, p.r, p.h); if (p.cap) box(out, p.x, p.z, p.r * 1.25, p.r * 1.25, p.h + 0.5); if (p.broken){ const R = seeded(p.s); box(out, p.x + 1.6, p.z + (R() - 0.5) * 2, 0.6, 1.4, 0.6); } },
    mesh(p, K){
      const M = K.M;
      K.cyl(p.x, 0, p.z, p.r * 1.25, 0.8, M.stoneD, 10);
      K.cyl(p.x, 0.8, p.z, p.r, p.h - 0.8, M.stone[2], 12, p.broken ? 0.96 : 0.86);
      if (p.cap) K.box(p.x, p.h - 0.1, p.z, p.r * 1.25, 0.6, p.r * 1.25, M.trim);
      if (p.broken){ const R = seeded(p.s); K.box(p.x + 1.6, 0, p.z + (R() - 0.5) * 2, 0.6, 0.6, 1.4, M.stone[2]); }   // a fallen drum (its solid rolls the same dice)
    },
  },
  /* THE FALLEN GUARDIAN: an old colossus of the city, hooded and robed, toppled off its plinth across the square long
     ago. Its feet still stand on the plinth; its body lies along the ground, a hill of stone to climb */
  guardian: {
    solids(p, out){ for (const s of guardianParts(p)) partSolid(s, out); },
    mesh(p, K){
      const M = K.M;
      for (const s of guardianParts(p)) if (s.draw) s.draw(K, M);
    },
  },
  /* a market STALL: a counter, four posts and a cloth roof you can land on */
  stall: {
    solids(p, out){ box(out, p.x, p.z, p.hx, p.hz * 0.45, 1.0); box(out, p.x, p.z, p.hx + 0.2, p.hz + 0.3, 2.95, { y0: 2.6, soft: true }); for (const s of [-1, 1]) col(out, p.x + s * p.hx, p.z - p.face * p.hz * 0.8, 0.08, 2.6); },
    mesh(p, K){
      const R = seeded(p.s), M = K.M;
      K.box(p.x, 0, p.z, p.hx, 1.0, p.hz * 0.45, M.wood);
      for (let i = 0; i < 4; i++) K.box(p.x + (R() - 0.5) * p.hx * 1.6, 1.0, p.z + (R() - 0.5) * p.hz * 0.5, 0.18 + R() * 0.2, 0.15 + R() * 0.25, 0.18 + R() * 0.15, M.cloth[(R() * 4) | 0]);   // goods
      for (const s of [-1, 1]){ K.pic(K.cyl(p.x + s * p.hx, 0, p.z - p.face * p.hz * 0.8, 0.08, 2.6, M.wood, 5)); K.pic(K.cyl(p.x + s * p.hx, 1, p.z + p.face * p.hz * 0.4, 0.06, 1.6, M.wood, 5)); }
      const roof = K.pic(K.box(p.x, 2.62, p.z, p.hx + 0.2, 0.07, p.hz + 0.3, M.cloth[p.cloth % 4]));
      roof.rotation.x = p.face * 0.12;
    },
  },
  planter: {
    solids(p, out){ col(out, p.x, p.z, p.r, 0.9); },
    mesh(p, K){
      const R = seeded(p.s), M = K.M;
      K.cyl(p.x, 0, p.z, p.r, 0.9, M.stoneD, 12);
      const h = 4 + R() * 2.5; K.cyl(p.x, 0.9, p.z, 0.16, h, M.wood, 6, 0.6);
      const leaf = leafMat(M);
      for (let i = 0; i < 6; i++){ const a = i / 6 * PI * 2 + R(); const m = K.add(new THREE.ConeGeometry(0.5, 2.6, 4), leaf, p.x + Math.cos(a) * 1.1, 0.9 + h - 0.4, p.z + Math.sin(a) * 1.1, 0, 0, 0); m.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); K.pic(m); }
    },
  },
  /* THE GARRISON: the occupation's compound, walled, white and grey over the old guild halls. Barracks, a command block
     (its comm mast is part of the skyline), a raised landing deck on steps, barricades, a gantry to climb */
  garrison: {
    solids(p, out){ for (const s of garrisonParts(p)) partSolid(s, out); },
    mesh(p, K){ for (const s of garrisonParts(p)) if (s.draw) s.draw(K, K.M); },
  },
  /* THE DROWNED CISTERN: a walled basin of shallow water you can wade, broken columns standing in it, a dam wall at its
     back with the water still trickling over */
  cistern: {
    solids(p, out){ for (const s of cisternParts(p)) partSolid(s, out); },
    mesh(p, K){ for (const s of cisternParts(p)) if (s.draw) s.draw(K, K.M); },
  },
  /* a rock OUTCROP in the workings: a hill you walk up (a mound), faced with broken rock */
  outcrop: {
    solids(p, out){ out.push({ mound: true, climbable: true, x: p.x, z: p.z, a: p.a, b: p.b, cos: 1, sin: 0, base: 0, h: p.h }); },
    mesh(p, K){
      const M = K.M, m = K.add(new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2), M.rock, p.x, 0, p.z); m.scale.set(p.a, p.h, p.b);
      const R = seeded(p.s);
      for (let i = 0; i < 5; i++){ const a = R() * PI * 2, d = 0.82 + R() * 0.12; const r = K.add(new THREE.IcosahedronGeometry(0.8 + R() * 0.9, 0), M.rockD, p.x + Math.cos(a) * p.a * d, 0.3, p.z + Math.sin(a) * p.b * d, R(), R(), R()); r.scale.y = 0.6; K.pic(r); }
    },
  },
  spire: {
    solids(p, out){ col(out, p.x, p.z, p.r * 1.2, 1.4); col(out, p.x, p.z, p.r, p.h); },
    mesh(p, K){ const M = K.M, R = seeded(p.s); const m = K.add(new THREE.CylinderGeometry(p.r * 0.35, p.r, p.h, 7), M.rock, p.x, p.h / 2, p.z, 0, R() * 3, 0); m.rotation.z = (R() - 0.5) * 0.06; K.cyl(p.x, 0, p.z, p.r * 1.2, 1.4, M.rockD, 7); },
  },
  /* a CRYSTAL cluster: kyber veins showing through the rock, glowing */
  crystal: {
    solids(p, out){ col(out, p.x, p.z, p.r, 0.9); },
    mesh(p, K){
      const M = K.M, R = seeded(p.s);
      K.add(new THREE.IcosahedronGeometry(p.r * 1.1, 0), M.rockD, p.x, 0.2, p.z, R(), R(), R()).scale.y = 0.55;
      for (let i = 0; i < 4; i++){ const a = R() * PI * 2; const c = K.add(new THREE.OctahedronGeometry(0.22 + R() * 0.2), M.crystal, p.x + Math.cos(a) * p.r * 0.5, 0.6 + R() * 0.4, p.z + Math.sin(a) * p.r * 0.5); c.scale.y = 2.2; c.rotation.z = (R() - 0.5) * 0.8; c.castShadow = false; c.userData.noOutline = true; }
    },
  },
  /* mine-cart RAILS laid along the ground (only a picture: flat on the floor) */
  rails: {
    solids(){},
    mesh(p, K){ const M = K.M; for (const s of [-1, 1]) K.flat(K.box(p.x, 0, p.z + (p.alongX ? s * 0.6 : 0), p.alongX ? p.len / 2 : 0.06, 0.05, p.alongX ? 0.06 : p.len / 2, M.metal)); for (let t = -p.len / 2; t < p.len / 2; t += 1.4) K.flat(K.box(p.x + (p.alongX ? t : 0), 0, p.z, p.alongX ? 0.12 : 0.9, 0.03, p.alongX ? 0.9 : 0.12, M.wood)); },
  },
  /* a catacomb MOUTH: a dark arched doorway cut in a rock face (a picture against the wall: it leads nowhere you can walk) */
  mouth: {
    solids(p, out){ box(out, p.x, p.z, 7, 1.95, 9); },
    mesh(p, K){
      const M = K.M;
      K.box(p.x, 0, p.z, 7, 9, 1.6, M.rock);
      for (const s of [-1, 1]) K.box(p.x + s * 2.2, 0, p.z + p.face[1] * 1.62, 0.5, 4.2, 0.3, M.stoneD);
      K.box(p.x, 4.2, p.z + p.face[1] * 1.62, 2.7, 0.7, 0.3, M.stoneD);
      K.box(p.x, 0, p.z + p.face[1] * 1.61, 1.7, 4.1, 0.05, M.dark).userData.noOutline = true;
    },
  },
  /* THE TEMPLE OF THE FIRST LIGHT: a stepped plinth (every step a walk-up), a colonnade along its front, a hall of tall
     broken walls with its roof fallen in, a dais at its heart under the dome (the dome itself is skyline) */
  temple: {
    solids(p, out){ for (const s of templeParts(p)) partSolid(s, out); },
    mesh(p, K){ for (const s of templeParts(p)) if (s.draw) s.draw(K, K.M); },
  },
  /* the temple's DOME on its drum, high over the hall (skyline: seen from all over the city; nobody stands up there) */
  dome: {
    solids(p, out){ col(out, p.x, p.z, p.r * 1.08, p.y + 0.2, { y0: p.y - 3 }); },   // (the drum: out of reach but for a wall-kick up the hall)
    mesh(p, K){ const M = K.M; K.cyl(p.x, p.y - 3, p.z, p.r * 1.02, 3, M.stone[2], 20); K.cyl(p.x, p.y - 0.4, p.z, p.r * 1.08, 0.6, M.trim, 20); const d = K.dome(p.x, p.y, p.z, p.r, M.dome, 20); d.scale.y = 0.85; K.cyl(p.x, p.y + p.r * 0.82, p.z, 0.3, 3, M.gold, 8, 0.4); K.pic(d); },
  },
  minaret: {
    solids(p, out){ col(out, p.x, p.z, p.r * 1.2, 3); col(out, p.x, p.z, p.r, p.h); },
    mesh(p, K){
      const M = K.M;
      K.cyl(p.x, 0, p.z, p.r * 1.2, 3, M.stoneD, 10);
      K.cyl(p.x, 3, p.z, p.r, p.h - 3, M.stone[2], 10, 0.82);
      K.cyl(p.x, p.h * 0.6, p.z, p.r * 1.1, 0.5, M.trim, 10);
      if (!p.broken){ K.cyl(p.x, p.h, p.z, p.r * 1.15, 0.5, M.trim, 10); K.add(new THREE.ConeGeometry(p.r * 0.9, p.r * 2.4, 10), M.dome, p.x, p.h + 0.5 + p.r * 1.2, p.z); }
      else { const R = seeded(p.s); for (let i = 0; i < 3; i++) K.box(p.x + (R() - 0.5) * 1.2, p.h, p.z + (R() - 0.5) * 1.2, 0.5, 0.6 + R(), 0.4, M.stone[2], R() * 2); }
    },
  },
  /* a little domed SHRINE with an open front and a lamp inside */
  shrine: {
    solids(p, out){ const w = p.w / 2; box(out, p.x, p.z, w + 0.2, w + 0.2, p.h + 0.4); col(out, p.x, p.z, w * 0.9, p.h + 0.4 + w * 0.86); box(out, p.x, p.z + w + 0.7, 0.5, 0.4, 1.1); },
    mesh(p, K){
      const M = K.M, w = p.w / 2;
      K.box(p.x, 0, p.z, w, p.h, w, M.stone[1]);
      K.box(p.x, 0, p.z + w + 0.02, Math.min(0.8, w * 0.4), Math.min(2.4, p.h - 0.6), 0.04, M.dark).userData.noOutline = true;   // its sealed door
      K.box(p.x, p.h, p.z, w + 0.2, 0.4, w + 0.2, M.trim); K.dome(p.x, p.h + 0.4, p.z, w * 0.9, M.dome);
      K.box(p.x, 0, p.z + w + 0.7, 0.5, 1.1, 0.4, M.stoneD); K.box(p.x, 1.1, p.z + w + 0.7, 0.18, 0.3, 0.18, M.kyber).userData.noOutline = true;   // a pilgrim's lamp at the door
    },
  },
  /* a RUINED TOWER: a tall broken keep (skyline), open on one side at the foot */
  ruin: {
    solids(p, out){ const w = p.w / 2; box(out, p.x - w + 0.6, p.z, 0.6, w, p.h); box(out, p.x + w - 0.6, p.z, 0.6, w, p.h * 0.7); box(out, p.x, p.z - w + 0.6, w, 0.6, p.h * 0.85); },
    mesh(p, K){
      const M = K.M, w = p.w / 2;
      K.box(p.x - w + 0.6, 0, p.z, 0.6, p.h, w, M.wall); K.box(p.x + w - 0.6, 0, p.z, 0.6, p.h * 0.7, w, M.wall); K.box(p.x, 0, p.z - w + 0.6, w, p.h * 0.85, 0.6, M.wallD);
      for (const y of [p.h * 0.3, p.h * 0.6]) K.box(p.x - w + 0.6, y, p.z, 0.7, 0.4, w + 0.1, M.trim);
    },
  },
  /* a STANDING STONE among the pilgrims' graves */
  stone: {
    solids(p, out){ box(out, p.x, p.z, p.alongX ? p.w / 2 : p.d / 2, p.alongX ? p.d / 2 : p.w / 2, p.h); },
    mesh(p, K){ const M = K.M, R = seeded(p.s); K.box(p.x, 0, p.z, p.alongX ? p.w / 2 : p.d / 2, p.h, p.alongX ? p.d / 2 : p.w / 2, R() < 0.5 ? M.stoneD : M.stone[1]); K.box(p.x, 0, p.z, (p.alongX ? p.w / 2 : p.d / 2) + 0.2, 0.3, (p.alongX ? p.d / 2 : p.w / 2) + 0.2, M.stoneD); },
  },
  /* the silent quarter's dry FOUNTAIN: a low basin you can step into, a broken figure on a pillar in the middle */
  fountain: {
    solids(p, out){ col(out, p.x, p.z, p.r, 0.7, { climbable: true }); col(out, p.x, p.z, 0.9, 3.6); },
    mesh(p, K){ const M = K.M; K.cyl(p.x, 0, p.z, p.r, 0.7, M.stoneD, 20); K.flat(K.add(new THREE.CircleGeometry(p.r - 0.4, 20), M.stone[1], p.x, 0.71, p.z, -PI / 2)); K.cyl(p.x, 0, p.z, 0.9, 2.4, M.stone[2], 10); K.box(p.x, 2.4, p.z, 0.6, 1.2, 0.5, M.statue); },
  },
  /* ---------------- THE GATE RUINS' own pieces (world/zones/ruins-plan.js) ---------------- */
  /* THE SITH GATE: the great ring standing on its stepped base, its middle a veil of violet light (the way you came in,
     and the way home: the threshold's waystone stands beside it). Its plane runs east-west, so it faces north up the
     avenue. Skyline: seen from all over the ruins */
  gatering: {
    solids(p, out){ for (const s of gateParts(p)) partSolid(s, out); },
    mesh(p, K){ for (const s of gateParts(p)) if (s.draw) s.draw(K, K.M); },
  },
  /* an OBELISK: a black needle on a stepped foot, a lit rune strip up its face (skyline: the tomb's two) */
  obelisk: {
    solids(p, out){ box(out, p.x, p.z, p.r * 1.6, p.r * 1.6, 1.2, { climbable: true }); box(out, p.x, p.z, p.r, p.r, p.h); },
    mesh(p, K){
      const M = K.M;
      K.box(p.x, 0, p.z, p.r * 1.6, 1.2, p.r * 1.6, M.stoneD);
      K.box(p.x, 1.2, p.z, p.r * 1.25, 1.2, p.r * 1.25, M.trim);
      const n = K.add(new THREE.CylinderGeometry(0.18, p.r * 1.414, p.h - 2.4, 4), M.statueD, p.x, 2.4 + (p.h - 2.4) / 2, p.z, 0, PI / 4, 0); n.userData.k = 'obelisk';
      for (const s of [-1, 1]){ const r = K.box(p.x, 4, p.z + s * (p.r * 0.86), 0.16, p.h * 0.55, 0.05, M.fire); r.userData.noOutline = true; r.castShadow = false; }
    },
  },
  /* a SITH STATUE: a hooded, robed lord on a plinth, both hands on the pommel of a blade held point-down. They line the
     avenue up to the tomb, every one with the same face, worn away */
  sithstatue: {
    solids(p, out){ box(out, p.x, p.z, 1.5, 1.5, 1.4); col(out, p.x, p.z, 1.25, 1.4 + p.h); },   // (round the robe, the hands and the blade)
    mesh(p, K){
      const M = K.M, h = p.h, y = 1.4, f = p.face || 0;
      K.box(p.x, 0, p.z, 1.5, y, 1.5, M.stoneD); K.box(p.x, y - 0.12, p.z, 1.62, 0.24, 1.62, M.trim);
      K.cyl(p.x, y, p.z, 1.0, h * 0.62, M.statue, 10, 0.62);                          // the robe
      K.cyl(p.x, y + h * 0.62, p.z, 0.62, h * 0.18, M.statue, 10, 0.8);               // the shoulders
      const hood = K.add(new THREE.SphereGeometry(0.62, 10, 8), M.statue, p.x, y + h * 0.86, p.z); hood.scale.set(1, 1.15, 1);
      const fx = Math.sin(f), fz = Math.cos(f);
      K.add(new THREE.SphereGeometry(0.4, 8, 6), M.dark, p.x + fx * 0.32, y + h * 0.84, p.z + fz * 0.32).userData.noOutline = true;   // the dark under the hood
      K.box(p.x + fx * 0.9, y + h * 0.5, p.z + fz * 0.9, 0.28, 0.5, 0.28, M.statueD);   // the hands on the pommel
      K.box(p.x + fx * 0.9, y + 0.1, p.z + fz * 0.9, 0.12, h * 0.42, 0.12, M.metal);     // the blade, point down
      const eyes = K.box(p.x + fx * 0.6, y + h * 0.86, p.z + fz * 0.6, 0.22, 0.05, 0.05, M.fire, f); eyes.userData.noOutline = true; eyes.castShadow = false;
    },
  },
  /* a BRAZIER: a stone bowl on a short pillar, a violet flame in it */
  brazier: {
    solids(p, out){ col(out, p.x, p.z, 0.6, 1.4); },
    mesh(p, K){
      const M = K.M;
      K.cyl(p.x, 0, p.z, 0.45, 1.0, M.stoneD, 8, 0.8);
      K.cyl(p.x, 1.0, p.z, 0.6, 0.4, M.metal, 10, 1.25);
      const fl = K.add(new THREE.ConeGeometry(0.42, 1.1, 7), M.fire, p.x, 1.95, p.z); fl.castShadow = false; fl.userData.noOutline = true; K.pic(fl);
    },
  },
  /* a CLIFF: the ruins' edge, a rock face too tall to climb, boulders heaped at its foot toward `face` */
  cliff: {
    solids(p, out){ box(out, p.x, p.z, p.hx, p.hz, p.h); },
    mesh(p, K){
      const R = seeded(p.s), M = K.M, [fx, fz] = p.face, along = p.hx > p.hz, len = (along ? p.hx : p.hz) * 2;
      K.box(p.x, 0, p.z, p.hx, p.h, p.hz, M.rock);
      for (let t = -len / 2 + 3; t < len / 2 - 2; t += 5 + R() * 3){
        const hh = p.h * (0.35 + R() * 0.5), w = 1.8 + R() * 1.6;
        K.box(p.x + (along ? t : fx * (p.hx + 0.6)), 0, p.z + (along ? fz * (p.hz + 0.6) : t), along ? w : 0.8, hh, along ? 0.8 : w, R() < 0.5 ? M.rockD : M.rock, (R() - 0.5) * 0.3);
        if (R() < 0.6){ const b = K.add(new THREE.IcosahedronGeometry(0.9 + R() * 0.8, 0), M.rockD, p.x + (along ? t + 2 : fx * (p.hx + 1.6)), 0.4, p.z + (along ? fz * (p.hz + 1.6) : t + 2), R(), R(), R()); b.scale.y = 0.6; K.pic(b); }
      }
      K.box(p.x, p.h - 0.1, p.z, p.hx + 0.3, 0.6, p.hz + 0.3, M.rockD);
    },
  },
  /* a BARRICADE in Kast's camp: plates of hull on struts, waist high (vaulted, or shot over) */
  barricade: {
    solids(p, out){ box(out, p.x, p.z, p.hx, p.hz, 1.3); },
    mesh(p, K){ const M = K.M; K.box(p.x, 0, p.z, p.hx, 1.3, p.hz, M.hull); K.box(p.x, 1.2, p.z, p.hx + 0.05, 0.12, p.hz + 0.05, M.impD); for (const s of [-1, 1]) K.box(p.x + (p.hx > p.hz ? s * (p.hx - 0.3) : 0), 0, p.z + (p.hx > p.hz ? 0 : s * (p.hz - 0.3)), 0.2, 1.5, 0.2, M.metal); },
  },
};

const leafCache = new WeakMap();
function leafMat(M){ if (!leafCache.has(M)){ const m = std(0x6a8a4a); m.side = THREE.DoubleSide; leafCache.set(M, m); } return leafCache.get(M); }

/* ---------------- the parts behind the bigger pieces (shared by their solids and meshes, so they always agree) ---------------- */
function ruinWalls(p){
  const t = 0.35, R = seeded(p.s ^ 0x5151), gap = R() * 4 | 0, out = [];
  const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  sides.forEach(([sx, sz], i) => {
    const along = sz !== 0, len = along ? p.hx : p.hz, h = p.h * (0.6 + R() * 0.4);
    const cx = p.x + sx * (p.hx - t), cz = p.z + sz * (p.hz - t);
    if (i === gap){   // a doorway: the wall in two pieces
      const g = Math.min(1.3, len * 0.4), a = (len - g) / 2;
      if (a > 0.4) for (const s of [-1, 1]) out.push({ x: cx + (along ? s * (g + a) : 0), z: cz + (along ? 0 : s * (g + a)), hx: along ? a : t, hz: along ? t : a, h });
    } else out.push({ x: cx, z: cz, hx: along ? len : t, hz: along ? t : len, h });
  });
  return out;
}
function awning(p){
  const side = p.awn.side, o = [[1, 0], [-1, 0], [0, 1], [0, -1]][side], alongX = o[1] !== 0;
  const hx = alongX ? Math.min(p.hx * 0.5, 2.2) : 0.9, hz = alongX ? 0.9 : Math.min(p.hz * 0.5, 2.2);
  const x = p.x + o[0] * (p.hx + 0.9), z = p.z + o[1] * (p.hz + 0.9);
  return { x, z, hx, hz, alongX, ox: p.x + o[0] * (p.hx + 1.7), oz: p.z + o[1] * (p.hz + 1.7) };
}
function crateList(p){
  const R = seeded(p.s ^ 0x2222), out = [];
  for (let i = 0; i < p.n; i++){
    const s = 0.55 + R() * 0.35, h = i === 0 ? 0.9 : 0.9 + R() * 0.9;
    out.push({ x: p.x + (i % 2) * 1.3 * (p.yaw ? 0 : 1), z: p.z + (i % 2) * 1.3 * (p.yaw ? 1 : 0) + (i === 2 ? 1.3 : 0), s, h });
  }
  return out;
}

/* THE FALLEN GUARDIAN, as parts: { solid, x, z, hx, hz | r, h, o, draw(K, M) } */
function guardianParts(p){
  const x = p.x, z = p.z, out = [];
  const B = (bx, bz, hx, hz, h, draw, o) => out.push({ solid: true, x: bx, z: bz, hx, hz, h, o, draw });
  // the plinth: three walk-up steps to its top at 1.4, the feet still standing on it
  [[6.4, 0.45], [5.6, 0.9], [4.8, 1.35]].forEach(([s, h], i) => B(x, z, s, s, h, (K, M) => K.box(x, 0, z, s, h, s, i % 2 ? M.stoneD : M.stone[2]), { climbable: true }));
  for (const sx of [-1, 1]){
    out.push({ solid: true, x: x + sx * 1.6, z: z - 0.3, hx: 1.2, hz: 1.9, h: 1.35 + 0.9 });   // (the feet)
    out.push({ solid: true, x: x + sx * 1.6, z: z + 0.6, r: 1.25, h: 1.35 + 5.2, draw: (K, M) => { K.cyl(x + sx * 1.6, 1.35, z + 0.6, 1.25, 5.2, M.statue, 10, 0.9); K.box(x + sx * 1.6, 1.35, z - 0.3, 1.2, 0.9, 1.9, M.statueD); } });
  }
  // the body, toppled east along the square: the robed torso, a shoulder, the hooded head at the far end, an arm flung south
  const tx = x + 15, tz = z + 3;
  B(tx, tz, 8.5, 3.4, 4.2, (K, M) => { K.box(tx, 0, tz, 8.5, 4.2, 3.4, M.statue); K.box(tx - 6, 0, tz, 2.2, 3.6, 3.8, M.statueD); for (let k = -6; k <= 6; k += 2.4) K.box(tx + k, 4.1, tz, 0.3, 0.3, 3.2, M.statueD); });   // robe folds
  B(tx + 9.6, tz, 1.8, 4.2, 5.4, (K, M) => K.box(tx + 9.6, 0, tz, 1.8, 5.4, 4.2, M.statue));   // the shoulders
  out.push({ solid: true, x: tx + 14, z: tz, r: 3.2, h: 6.2, draw: (K, M) => { K.add(new THREE.SphereGeometry(3.3, 14, 10), M.statue, tx + 14, 3.0, tz); K.add(new THREE.SphereGeometry(2.3, 12, 8), M.dark, tx + 15.6, 3.0, tz).scale.set(0.6, 1, 1); } });
  B(tx + 7, tz + 12.4, 1.6, 1.2, 2.0);   // (the hand)
  B(tx + 7, tz + 7.5, 1.3, 4.4, 2.4, (K, M) => { K.box(tx + 7, 0, tz + 7.5, 1.3, 2.4, 4.4, M.statue); K.box(tx + 7, 0, tz + 12.4, 1.6, 2.0, 1.2, M.statueD); });   // the arm, and its hand
  // its blade, lying where it fell: a long low slab you can run along
  B(tx + 7.6, tz + 13.5, 0.6, 2.2, 0.9);   // (its hilt)
  B(tx - 2, tz + 13.5, 9, 0.6, 0.55, (K, M) => { K.box(tx - 2, 0, tz + 13.5, 9, 0.55, 0.6, M.metal); K.box(tx + 7.6, 0, tz + 13.5, 0.6, 0.9, 2.2, M.gold); }, { climbable: true });
  return out;
}

/* THE GARRISON, as parts */
function garrisonParts(p){
  const out = [], T = 0.8, H = 6.5;
  const B = (x, z, hx, hz, h, draw, o) => out.push({ solid: true, x, z, hx, hz, h, o, draw });
  const D = (draw) => out.push({ solid: false, draw });
  const { x0, z0, x1, z1 } = p, [g0, g1] = p.gate;
  const wallSeg = (x, z, hx, hz) => B(x, z, hx, hz, H, (K, M) => { K.box(x, 0, z, hx, H, hz, M.imp); K.box(x, 0, z, hx + 0.1, 1.0, hz + 0.1, M.impD); K.box(x, H - 0.3, z, hx + 0.15, 0.4, hz + 0.15, M.red); });
  wallSeg((x0 + x1) / 2, z0, (x1 - x0) / 2, T); wallSeg((x0 + x1) / 2, z1, (x1 - x0) / 2, T); wallSeg(x1, (z0 + z1) / 2, T, (z1 - z0) / 2);
  wallSeg(x0, (z0 + g0) / 2, T, (g0 - z0) / 2); wallSeg(x0, (g1 + z1) / 2, T, (z1 - g1) / 2);
  // the gate towers, a beacon on each
  for (const gz of [g0 - 2.2, g1 + 2.2]) B(x0, gz, 2.5, 2.5, H + 4.1, (K, M) => { K.box(x0, 0, gz, 2.2, H + 4, 2.2, M.imp); K.box(x0, H + 3.6, gz, 2.5, 0.5, 2.5, M.impD); K.box(x0, H + 4.1, gz, 0.3, 0.4, 0.3, M.beacon).userData.noOutline = true; });
  // the barracks and the command block
  for (const [bx, bz, hx, hz, h] of [[72, -20, 8, 4.5, 6], [72, 20, 8, 4.5, 6], [100, -18, 6, 6, 9]]){
    B(bx, bz, hx, hz, h, (K, M) => {
      K.box(bx, 0, bz, hx, h, hz, M.imp); K.box(bx, h - 0.2, bz, hx + 0.2, 0.4, hz + 0.2, M.impD);
      for (let t = -hx + 1.6; t < hx - 1; t += 2.4) K.box(bx + t, h * 0.6, bz + (bz < 0 ? hz : -hz) + (bz < 0 ? 0.03 : -0.03), 0.6, 0.5, 0.05, M.dark).userData.noOutline = true;
      K.box(bx, 0, bz + (bz < 0 ? hz : -hz), 1.2, 2.8, 0.08, M.impD);
    });
  }
  // the comm mast on the command block (seen across the city)
  out.push({ solid: true, x: 100, z: -18, r: 0.6, h: 22, draw: (K, M) => { K.cyl(100, 9, -18, 0.5, 13, M.impD, 6, 0.5); K.box(100, 18, -18, 2.4, 0.2, 0.2, M.impD); K.box(100, 20, -18, 1.6, 0.2, 0.2, M.impD); K.box(100, 22, -18, 0.35, 0.35, 0.35, M.beacon).userData.noOutline = true; } });
  // the landing deck: steps up its west face to 1.8
  [[7.5, 0.45], [7, 0.9], [6.5, 1.35], [6, 1.8]].forEach(([s, h], i) => B(92 + (7.5 - s), 16, s, 6.5, h, (K, M) => K.box(92 + (7.5 - s), 0, 16, s, h, 6.5, i % 2 ? M.impD : M.imp), { climbable: true }));
  D((K, M) => { K.flat(K.add(new THREE.RingGeometry(3.6, 4.1, 32), M.beacon, 92.5, 1.82, 16, -PI / 2)); });
  // barricades and cover in the yard (low enough to vault)
  for (const [bx, bz, along] of [[64, -6, 0], [64, 8, 0], [80, -4, 1], [86, 4, 1], [80, -28, 1], [100, 2, 0], [106, 24, 1], [68, 28, 1]]){
    const hx = along ? 2.4 : 0.5, hz = along ? 0.5 : 2.4;
    B(bx, bz, hx, hz, 1.35, (K, M) => { K.box(bx, 0, bz, hx, 1.35, hz, M.impD); K.box(bx, 1.25, bz, hx + 0.05, 0.12, hz + 0.05, M.red); });
  }
  for (const [cx, cz] of [[60, -26], [62, 26], [108, -28], [108, 8], [88, -10]]){ B(cx, cz, 0.8, 0.8, 1.6, (K, M) => { K.box(cx, 0, cz, 0.8, 1.6, 0.8, M.metal); K.box(cx, 1.5, cz, 0.84, 0.1, 0.84, M.impD); }); }
  // a three-tier gantry in the north-east corner: a vantage point (each tier above a single jump)
  [[104, -28, 1.3, 2.6], [106, -26, 1.2, 5.1], [108, -24, 1.6, 7.7]].forEach(([gx, gz, s, h], i) => B(gx, gz, s, s, h, (K, M) => { K.box(gx, 0, gz, s, h, s, i % 2 ? M.impD : M.metal); }));
  // banners of the occupation on the inner walls
  D((K, M) => { for (const bz of [-24, 24]) K.pic(K.box(x0 + T + 0.05, 3, bz, 0.04, 3, 1.1, M.red)); });
  return out;
}

/* THE DROWNED CISTERN, as parts */
function cisternParts(p){
  const out = [], { x0, z0, x1, z1 } = p;
  const B = (x, z, hx, hz, h, draw, o) => out.push({ solid: true, x, z, hx, hz, h, o, draw });
  const C = (x, z, r, h, draw, o) => out.push({ solid: true, x, z, r, h, o, draw });
  const D = (draw) => out.push({ solid: false, draw });
  // the rim: a low wall you step over (0.5), gaps on the west and north where the stairs come down
  const rim = (x, z, hx, hz) => B(x, z, hx, hz, 0.5, (K, M) => { K.box(x, 0, z, hx, 0.5, hz, M.stoneD); K.box(x, 0.45, z, hx + 0.08, 0.1, hz + 0.08, M.trim); }, { climbable: true });
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  rim(mx + 6, z0, (x1 - x0) / 2 - 6, 0.6); rim(mx, z1, (x1 - x0) / 2, 0.6); rim(x0, mz + 6, 0.6, (z1 - z0) / 2 - 6); rim(x1, mz, 0.6, (z1 - z0) / 2);
  rim(x0 + 2.5, z0, 2.5, 0.6); rim(x0, z0 + 2.5, 0.6, 2.5);
  // the water: a flat sheet just over the floor (you wade it; game/zone.js slows nothing, it's only a picture)
  D((K, M) => { const w = K.add(new THREE.PlaneGeometry(x1 - x0 - 1.2, z1 - z0 - 1.2), M.water, mx, 0.12, mz, -PI / 2); w.userData.passThrough = true; w.userData.noBake = true; w.castShadow = false; });
  // broken columns standing in the water, a fallen one to walk along
  for (const [cx, cz, h] of [[70, 72, 7], [82, 72, 3.4], [94, 72, 7], [70, 88, 2.6], [94, 88, 7], [82, 96, 4]]) C(cx, cz, h > 5 ? 1.3 : 1.0, h > 5 ? h + 0.4 : h, (K, M) => { K.cyl(cx, 0, cz, 1.2, 0.6, M.stoneD, 10); K.cyl(cx, 0.6, cz, 1.0, h - 0.6, M.stone[2], 12, 0.9); if (h > 5) K.box(cx, h - 0.1, cz, 1.3, 0.5, 1.3, M.trim); });
  B(80, 82, 6, 0.8, 1.6, (K, M) => K.add(new THREE.CylinderGeometry(0.8, 0.8, 12, 10), M.stone[2], 80, 0.8, 82, 0, 0, PI / 2), { climbable: false });
  // the dam wall at the basin's back (east and south), water trickling over it
  B(x1 + 3.4, mz, 2.4, (z1 - z0) / 2 + 2, 9, (K, M) => { K.box(x1 + 3.4, 0, mz, 2.4, 9, (z1 - z0) / 2 + 2, M.wall); K.box(x1 + 3.4, 8.6, mz, 2.6, 0.5, (z1 - z0) / 2 + 2.2, M.trim); for (let t = -16; t <= 16; t += 8){ const f = K.add(new THREE.PlaneGeometry(1.4, 8.6), M.water, x1 + 0.98, 4.4, mz + t, 0, -PI / 2, 0); f.userData.passThrough = true; f.userData.noBake = true; f.castShadow = false; } });
  // a rock shelf in the far corner with a cave mouth in it (a crystal cave: game/zone.js)
  out.push({ solid: true, mound: { mound: true, climbable: true, x: 99, z: 100, a: 6, b: 5, cos: 1, sin: 0, base: 0, h: 3.6 }, draw: (K, M) => { const m = K.add(new THREE.SphereGeometry(1, 12, 8, 0, PI * 2, 0, PI / 2), M.rock, 99, 0, 100); m.scale.set(6, 3.6, 5); } });
  return out;
}

/* THE TEMPLE, as parts */
function templeParts(p){
  const out = [], x = p.x, z = p.z;
  const B = (bx, bz, hx, hz, h, draw, o) => out.push({ solid: true, x: bx, z: bz, hx, hz, h, o, draw });
  const C = (cx, cz, r, h, draw) => out.push({ solid: true, x: cx, z: cz, r, h, draw });
  // the stepped plinth: three walk-up steps to the floor at 1.2
  [[26, 24, 0.4], [25, 23, 0.8], [24, 22, 1.2]].forEach(([hx, hz, h], i) => B(x, z, hx, hz, h, (K, M) => { K.box(x, 0, z, hx, h, hz, i % 2 ? M.stoneD : M.stone[2]); K.box(x, h - 0.06, z, hx + 0.05, 0.1, hz + 0.05, M.trim); }, { climbable: true }));
  const F = 1.2;   // the floor's height
  // the colonnade along the front
  for (let i = -5; i <= 5; i++){ if (Math.abs(i) < 1) continue; const cx = x + i * 4, cz = z + 19; C(cx, cz, 0.9, F + 10, (K, M) => { K.cyl(cx, F, cz, 1.1, 0.7, M.stoneD, 10); K.cyl(cx, F + 0.7, cz, 0.9, 9.3, M.stone[2], 12, 0.88); K.box(cx, F + 9.9, cz, 1.15, 0.6, 1.15, M.trim); }); }
  B(x, z + 19, 22, 1.2, F + 12.2, (K, M) => { K.box(x, F + 10.4, z + 19, 22, 1.8, 1.2, M.stone[2]); K.box(x, F + 12.1, z + 19, 22.2, 0.3, 1.4, M.trim); }, { y0: F + 10.4 });
  // the hall: tall walls round three sides and a front wall with a great door; broken tops
  const wh = F + 14;
  const hw = (bx, bz, hx, hz, h) => B(bx, bz, hx, hz, h, (K, M) => { K.box(bx, F, bz, hx, h - F, hz, M.stone[0]); K.box(bx, F, bz, hx + 0.12, 1.2, hz + 0.12, M.stoneD); K.box(bx, F + 7, bz, hx + 0.1, 0.35, hz + 0.1, M.trim); });
  hw(x - 17, z - 4, 1, 12, wh); hw(x + 17, z - 4, 1, 12, wh - 3); hw(x, z - 16, 18, 1, wh);
  hw(x - 10.5, z + 8, 6.5, 1, wh - 2); hw(x + 10.5, z + 8, 6.5, 1, wh);
  B(x, z + 8, 4, 1, wh + 1, (K, M) => { K.box(x, F + 9, z + 8, 4, wh - F - 8, 1, M.stone[0]); K.box(x, F + 8.6, z + 8, 4.2, 0.5, 1.2, M.trim); }, { y0: F + 9 });   // over the great door
  // tall windows on the side walls (dark slits), a dais at the heart with a ring of light round it
  out.push({ solid: false, draw: (K, M) => { for (const sx of [-1, 1]) for (let t = -12; t <= 4; t += 5.3){ const m = K.box(x + sx * 15.95, F + 4, z + t, 0.05, 6, 0.9, M.dark); m.userData.noOutline = true; } } });
  [[5, 0.4], [4, 0.8]].forEach(([r, h]) => C(x, z - 6, r, F + h, (K, M) => K.cyl(x, F, z - 6, r, h, M.stoneD, 24)));
  out.push({ solid: false, draw: (K, M) => { K.flat(K.add(new THREE.RingGeometry(4.2, 4.6, 40), M.lamp, x, F + 0.82, z - 6, -PI / 2)); } });
  // fallen roof beams across the hall floor (low, climbable)
  for (const [bx, bz, along] of [[x - 8, z - 10, 1], [x + 7, z + 2, 0]]) B(bx, bz, along ? 4 : 0.6, along ? 0.6 : 4, F + 0.7, (K, M) => K.box(bx, F, bz, along ? 4 : 0.6, 0.7, along ? 0.6 : 4, M.wood), { climbable: true });
  // the side courts (meditation, game/zone.js): low walls and planters, and a statue of a robed figure on each side
  for (const sx of [-1, 1]){
    const cx = x + sx * 21.5;
    out.push({ solid: true, x: cx, z: z - 12, r: 1.2, h: F + 6, draw: (K, M) => { K.cyl(cx, F, z - 12, 1.4, 1.2, M.stoneD, 10); K.cyl(cx, F + 1.2, z - 12, 0.9, 3.4, M.statue, 10, 0.7); K.add(new THREE.SphereGeometry(0.6, 10, 8), M.statue, cx, F + 5.1, z - 12); } });
  }
  return out;
}

/* THE SITH GATE, as parts: the stepped base (walk-up), two piers, the ring overhead and its veil */
function gateParts(p){
  const out = [], x = p.x, z = p.z, r = p.r, t = 1.1;
  const B = (bx, bz, hx, hz, h, draw, o) => out.push({ solid: true, x: bx, z: bz, hx, hz, h, o, draw });
  [[r + 4, 4.4, 0.4], [r + 3, 3.6, 0.8]].forEach(([hx, hz, h], i) => B(x, z, hx, hz, h, (K, M) => { K.box(x, 0, z, hx, h, hz, i ? M.stoneD : M.stone[1]); K.box(x, h - 0.06, z, hx + 0.05, 0.1, hz + 0.05, M.trim); }, { climbable: true }));
  const F = 0.8, cy = F + r + t * 0.4;   // the ring's middle
  for (const s of [-1, 1]) B(x + s * r, z, t * 1.3, t * 1.6, F + r * 0.9, (K, M) => { K.box(x + s * r, F, z, t * 1.3, r * 0.9, t * 1.6, M.statueD); });
  out.push({ solid: true, x, z, hx: r, hz: t, h: cy + r + t, o: { y0: cy + r - t * 1.4 }, draw: (K, M) => {
    const ring = K.add(new THREE.TorusGeometry(r, t, 10, 48), M.statueD, x, cy, z); ring.userData.k = 'gate';
    const lip = K.add(new THREE.TorusGeometry(r - t * 0.9, 0.14, 6, 48), M.fire, x, cy, z); lip.castShadow = false; lip.userData.noOutline = true;
    for (let i = 0; i < 12; i++){ const a = i / 12 * PI * 2; const k = K.add(new THREE.BoxGeometry(0.7, 1.3, t * 2.3), M.stoneD, x + Math.cos(a) * r, cy + Math.sin(a) * r, z, 0, 0, a); k.userData.k = 'gate-key'; }
    const v = K.add(new THREE.CircleGeometry(r - t * 0.9, 40), M.gate, x, cy, z); v.userData.passThrough = true; v.userData.noBake = true; v.userData.noOutline = true; v.castShadow = false; v.receiveShadow = false;
  } });
  return out;
}
