// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LANDMARKS: the few colossal structures that stand IN the play space of a map and make a body on the floor look small
// (the maps pass for the ARC trooper's and the Mandalorian's stories). The towering backdrop (world/towering.js) climbs
// over the edge; these stand among the fight: a walker parked over the yard, a comms pylon, a forest giant, a sea-stack,
// a smokestack, an arch over a lane, a grounded freighter, a statue of an old warrior. Each one is the anchor of its
// part of the map: its foot is real cover (the trooper puts his back to it: player/trooper/cover.js), its bulk breaks
// the long sightlines, and the lanes round it stay wide enough for a brute and the pathing grid.
//
// They're built after a map's builder and its spread (world/spread.js), before the perches, the cover pass and the
// pathing grid (world/arena.js), so the rest of the map fits round them, in every mode that builds the map. Placements
// live in data/landmarks.js. A piece that would crowd a story mission's point, a door, a hazard, the spawn or another
// solid is not built (and named in shared.landmarks.dropped, which tools/shots/map-audit.mjs prints), so a layout change
// can never wall a mission in.
//
// COLLISION. Everything you could touch below 16 m (the reach of a jump or the jetpack: tools/collision-audit.js) is
// backed by a solid: a leg, a trunk, a pier is a column or a box; a belly, a lintel, a head is an overhead SLAB you walk
// under and can land on. Above 16 m anything goes: a canopy, a statue's helmet, a tower's crown.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shared, solids, pillars, hazardZones, vents, barrels } from '../state.js';
import { arenaKit, seeded } from './arenas/kit.js';
import { LANDMARKS } from '../data/landmarks.js';
import { keepPoints } from './coverfill.js';

const PI = Math.PI;
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.75, metalness: o.m ?? 0.3, flatShading: !!o.flat });
const glowM = c => new THREE.MeshBasicMaterial({ color: c });
const th0 = (H, tiers) => H / tiers;   // a stone's tier height

/* KINDS — each builds one piece at (x, z); `ax` 1 lays its length along x, 0 along z; `M` is { a, b, dark, trim, glow }
   (materials from the world's palette, data/landmarks.js); `o` the placement's own options. Local helpers map (u, v),
   along and across the piece, to the world. */
const KINDS = {
  /* WALKER — a heavy assault walker parked on its four legs: you fight among its feet and under its belly (15 m up).
     The feet are hard cover, the legs wall-kick columns, the belly and head a deck the jetpack can land on. */
  walker(K, x, z, ax, M, o, R){
    const s = o.s ?? 1, at = (u, v) => ax ? [x + u, z + v] : [x + v, z + u];
    const box = (u, v, hu, hv, y0, y1, mat, solid = true) => {
      const [px, pz] = at(u, v);
      K.deco(new THREE.BoxGeometry(ax ? hu * 2 : hv * 2, y1 - y0, ax ? hv * 2 : hu * 2), mat, px, (y0 + y1) / 2, pz);
      if (solid) K.slab(px, pz, ax ? hu : hv, ax ? hv : hu, y0, y1);
    };
    const belly = 9.6 * s, top = 14.2 * s, LU = 5.0 * s, LV = 2.6 * s;
    const turn = (m, r) => { if (ax) m.rotation.z = r; else m.rotation.x = -r; return m; };   // a tilt about the across axis
    // the four legs: a broad foot (a pad to crouch behind), the shin, the knee, the thigh up into a hip joint
    for (const su of [-1, 1]) for (const sv of [-1, 1]){
      const [px, pz] = at(su * LU, sv * LV), kn = 5.2 * s;
      K.box(px, pz, 1.25 * s, 1.25 * s, 1.15, M.dark);
      K.deco(new THREE.CylinderGeometry(1.05 * s, 1.4 * s, 0.4, 10), M.b, px, 1.3, pz);
      solids[solids.length - 1].h = 1.5;
      K.deco(new THREE.CylinderGeometry(0.52 * s, 0.7 * s, kn - 1.4, 10), M.a, px, 1.4 + (kn - 1.4) / 2, pz);   // the shin
      solids.push({ x: px, z: pz, r: 0.72 * s, h: kn }); pillars.push({ x: px, z: pz, r: 0.72 * s, h: kn });
      K.deco(new THREE.BoxGeometry(1.5 * s, 1.4 * s, 1.5 * s), M.dark, px, kn + 0.5 * s, pz);                // the knee
      K.slab(px, pz, 0.78 * s, 0.78 * s, kn - 0.2 * s, kn + 1.2 * s);
      K.deco(new THREE.BoxGeometry(1.25 * s, belly - kn - 1.6 * s, 1.35 * s), M.a, px, (kn + 1.2 * s + belly - 0.4 * s) / 2, pz);   // the thigh
      K.slab(px, pz, 0.7 * s, 0.7 * s, kn + 1.2 * s, belly - 0.4 * s);
      const hip = K.deco(new THREE.CylinderGeometry(0.85 * s, 0.85 * s, 1.5 * s, 12), M.b, px, belly - 0.3 * s, pz, ax ? PI / 2 : 0, 0, ax ? 0 : PI / 2);   // the hip joint, its axle across
      void hip;
      K.slab(px, pz, 0.85 * s, 0.85 * s, belly - 1.15 * s, belly + 0.4 * s);
    }
    // the body: a long armoured hull, its ends raked back, a raised spine, skirt plates low on its flanks
    box(0, 0, 6.6 * s, 3.0 * s, belly, top, M.a);
    for (const su of [-1, 1]){
      const [px, pz] = at(su * 6.75 * s, 0);
      turn(K.deco(new THREE.BoxGeometry(ax ? 1.0 * s : 5.6 * s, (top - belly) * 0.92, ax ? 5.6 * s : 1.0 * s), M.b, px, (belly + top) / 2, pz), su * 0.28);
      K.slab(px, pz, ax ? 0.9 * s : 2.8 * s, ax ? 2.8 * s : 0.9 * s, belly, top);
    }
    box(0, 0, 5.4 * s, 2.0 * s, top, top + 0.9 * s, M.b);
    box(-1.5 * s, 0, 1.4 * s, 1.2 * s, top + 0.9 * s, top + 1.7 * s, M.dark);                          // a hatch house on the spine
    for (const sv of [-1, 1]) for (let u = -5.2; u <= 5.2; u += 2.6){
      const [px, pz] = at(u * s, sv * 3.06 * s);
      const p = K.deco(new THREE.BoxGeometry(ax ? 2.3 * s : 0.14, 2.4 * s, ax ? 0.14 : 2.3 * s), M.dark, px, belly + 0.9 * s, pz);
      p.userData.passThrough = true;   // (a skirt plate on the flank: the body's slab holds it)
    }
    { const [px, pz] = at(0, 0); const g = K.deco(new THREE.BoxGeometry(ax ? 11 * s : 0.3, 0.12, ax ? 0.3 : 11 * s), M.glow, px, belly + 0.05, pz); g.userData.passThrough = true; }
    // the neck (ribbed) and the head, forward and low, a raked brow, the chin guns, the viewports lit
    box(8.3 * s, 0, 0.9 * s, 0.9 * s, belly + 1.4 * s, belly + 3.0 * s, M.dark);
    for (const du of [-0.5, 0, 0.5]){ const [px, pz] = at((8.3 + du) * s, 0); const r = K.deco(new THREE.BoxGeometry(ax ? 0.2 : 2.0 * s, 1.8 * s, ax ? 2.0 * s : 0.2), M.b, px, belly + 2.2 * s, pz); r.userData.passThrough = true; }
    box(11.0 * s, 0, 1.8 * s, 1.5 * s, belly + 0.6 * s, belly + 3.3 * s, M.a);
    { const [px, pz] = at(12.6 * s, 0);
      turn(K.deco(new THREE.BoxGeometry(ax ? 0.8 * s : 2.9 * s, 2.0 * s, ax ? 2.9 * s : 0.8 * s), M.b, px, belly + 2.6 * s, pz), -0.5);   // the brow, raked forward
      K.slab(px, pz, ax ? 0.6 * s : 1.5 * s, ax ? 1.5 * s : 0.6 * s, belly + 1.4 * s, belly + 3.4 * s); }
    box(12.4 * s, 0, 0.6 * s, 1.1 * s, belly + 0.3 * s, belly + 1.4 * s, M.dark);                      // the chin
    for (const sv of [-1, 1]){
      const [px, pz] = at(13.4 * s, sv * 0.8 * s);
      const g = K.deco(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 2.6 * s, 8), M.dark, px, belly + 0.8 * s, pz, ax ? 0 : PI / 2, 0, ax ? PI / 2 : 0);
      g.userData.passThrough = true;
    }
    for (const sv of [-1, 1]){ const [px, pz] = at(12.82 * s, sv * 0.75 * s); const w = K.deco(new THREE.BoxGeometry(ax ? 0.06 : 0.8 * s, 0.3 * s, ax ? 0.8 * s : 0.06), M.glow, px, belly + 1.9 * s, pz); w.userData.passThrough = true; }
    void R;
  },

  /* PYLON — a square tower far over the floor (a comms mast, a relay pylon, an old obelisk): buttress fins round its foot
     (four, square to the axes) are tall cover on every side; lit bands climb it; an antenna and a beacon on top. `h` its height, `w` its half-width. */
  pylon(K, x, z, ax, M, o, R){
    const H = o.h ?? 34, w = o.w ?? 2.4, fins = o.fins ?? 4;
    K.box(x, z, w + 1.4, w + 1.4, 0.45, M.dark, { climbable: true });                       // the plinth: a step up
    const lo = Math.max(H * 0.62, 16.5);
    K.box(x, z, w, w, lo, M.a);                                                              // the shaft (one collider to past reach)
    K.deco(new THREE.BoxGeometry(w * 1.6, H - lo, w * 1.6), M.b, x, lo + (H - lo) / 2, z);
    K.deco(new THREE.CylinderGeometry(0.15, 0.4, H * 0.22, 6), M.dark, x, H + H * 0.11, z);
    if (o.beacon !== false) K.deco(new THREE.SphereGeometry(0.7, 8, 6), M.glow, x, H * 1.22, z);
    for (let y = 4; y < H * 0.98; y += o.band ?? 5.5){
      const s = y < lo ? w : w * 0.8;
      const b = K.deco(new THREE.BoxGeometry(s * 2 + 0.16, 0.3, s * 2 + 0.16), y % 11 < 5.5 ? M.glow : M.trim, x, y, z);
      b.userData.passThrough = true;
    }
    for (let k = 0; k < fins; k++){
      const a = k / fins * PI * 2, along = Math.abs(Math.cos(a)) > 0.5, L = o.fin ?? 3.4, fh = o.finH ?? 4.2;
      const cx = x + Math.cos(a) * (w + L / 2), cz = z + Math.sin(a) * (w + L / 2);
      K.box(cx, cz, along ? L / 2 : 0.4, along ? 0.4 : L / 2, fh, M.b);
      K.deco(new THREE.BoxGeometry(along ? L : 0.86, 0.2, along ? 0.86 : L), M.trim, cx, fh + 0.1, cz);
    }
    void R;
  },

  /* STACK — a round smokestack or cooling tower out of the floor: a wide ring of ducting at its foot (cover all round),
     a tapering shaft with rings, its lip glowing. `h` its height, `r` its radius at the foot. */
  stack(K, x, z, ax, M, o, R){
    const H = o.h ?? 30, r = o.r ?? 3.2;
    K.column(x, z, r, H, M.a, { taper: o.taper ?? 0.72, seg: 16, wallKick: true });
    for (let y = 5; y < H; y += 6){
      const rr = r * (1 - (1 - (o.taper ?? 0.72)) * (y / H)) + 0.12;
      const g = K.deco(new THREE.TorusGeometry(rr, 0.18, 4, 22), M.trim, x, y, z, PI / 2); g.userData.passThrough = true;
    }
    K.deco(new THREE.TorusGeometry(r * (o.taper ?? 0.72) - 0.1, 0.32, 6, 22), M.glow, x, H, z, PI / 2);
    // ducts round the foot: four short blocks you crouch behind, gaps between them
    for (let k = 0; k < 4; k++){
      const a = k / 4 * PI * 2 + PI / 4, cx = x + Math.cos(a) * (r + 1.2), cz = z + Math.sin(a) * (r + 1.2), along = Math.abs(Math.cos(a)) < 0.5;
      K.box(cx, cz, 1.3, 1.3, 1.3, M.dark);
      K.deco(new THREE.CylinderGeometry(0.5, 0.5, 2.8, 8), M.b, cx, 1.55, cz, along ? 0 : PI / 2, 0, along ? PI / 2 : 0).userData.passThrough = true;
    }
    void ax; void R;
  },

  /* GIANT — a forest giant's trunk in the clearing: root buttresses fanning from its foot are the cover, the trunk a
     wall-kick column wider than a gunship, the crown far overhead. `h` its height, `r` the trunk's radius. */
  giant(K, x, z, ax, M, o, R){
    const H = o.h ?? 48, r = o.r ?? 2.6;
    K.column(x, z, r, H * 0.5, M.a, { taper: 0.9, seg: 11 });
    K.deco(new THREE.CylinderGeometry(r * 0.6, r * 0.82, H * 0.52, 10), M.a, x, H * 0.74, z);
    for (let k = 0; k < 5; k++){
      const a = (k + 0.2) / 5 * PI * 2 + (o.turn ?? 0), rl = r + 1.6, rh = 1.6 + R() * 0.9;   // (a fixed footprint, whatever the seed)
      const cx = x + Math.cos(a) * rl, cz = z + Math.sin(a) * rl, along = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
      K.box(cx, cz, along ? 1.5 : 0.45, along ? 0.45 : 1.5, rh, M.a);
      K.deco(new THREE.BoxGeometry(along ? 2.6 : 0.5, 0.25, along ? 0.5 : 2.6), M.trim, cx, rh + 0.06, cz).userData.passThrough = true;
    }
    // the crown: flattened leaf masses high over the floor, one bough reaching out
    const c = o.crown ?? 12;
    for (let k = 0; k < 6; k++){
      const ma = R() * PI * 2, md = c * (0.15 + R() * 0.55), s = c * (0.5 + R() * 0.4);
      K.deco(new THREE.IcosahedronGeometry(1, 1), k % 2 ? M.b : M.dark, x + Math.cos(ma) * md, H * (0.86 + R() * 0.14), z + Math.sin(ma) * md, R(), R() * PI, R()).scale.set(s, s * 0.4, s);
    }
    for (let k = 0; k < 2; k++){
      const la = R() * PI * 2, ll = c * 1.1, ly = H * 0.7;
      const limb = K.deco(new THREE.CylinderGeometry(r * 0.16, r * 0.28, ll, 6), M.a, x + Math.cos(la) * ll * 0.42, ly + ll * 0.2, z + Math.sin(la) * ll * 0.42);
      limb.lookAt(x + Math.cos(la) * ll, ly + ll * 0.5, z + Math.sin(la) * ll); limb.rotateX(PI / 2);
    }
    if (o.vines) for (let k = 0; k < 5; k++){
      const a = R() * PI * 2, vy = H * (0.4 + R() * 0.3), len = vy - 17, vx = x + Math.cos(a) * (r * 0.95), vz = z + Math.sin(a) * (r * 0.95);
      if (len > 1) K.deco(new THREE.CylinderGeometry(0.06, 0.06, len, 4), M.trim, vx, 17 + len / 2, vz).userData.passThrough = true;
    }
    void ax;
  },

  /* STONE — a sea-stack, a hoodoo or a mesa: a tower of broken rock tiers, a skirt of fallen boulders round its foot for
     cover. `h` its height, `r` its radius. */
  stone(K, x, z, ax, M, o, R){
    const H = o.h ?? 26, r = o.r ?? 3.6, tiers = o.tiers ?? 3;
    const core = { x, z, r: r * 1.2, h: H }; solids.push(core); pillars.push({ x, z, r: r * 1.2, h: H });   // (the drawn rock is the collider's shape)
    let y = 0, w = r * 1.12;
    for (let t = 0; t < tiers; t++){
      const th = H / tiers * (t ? 1 : 1.15);
      K.deco(new THREE.DodecahedronGeometry(1, 0), t % 2 ? M.b : M.a, x + (R() - 0.5) * 0.6, y + th * 0.5, z + (R() - 0.5) * 0.6, (R() - 0.5) * 0.1, R() * PI, (R() - 0.5) * 0.1)
        .scale.set(w, th * 0.6, w * (0.85 + R() * 0.2));
      y += th * 0.82; w *= 0.8;
    }
    core.h = y + th0(H, tiers) * 0.28;   // (to the top tier's crown)
    if (o.cap) K.deco(new THREE.DodecahedronGeometry(1, 0), M.trim, x, y + 0.4, z, 0, R() * PI, 0).scale.set(w * 1.15, 1.2, w * 1.05);
    // the scree: three boulders out from the foot, at even turns, each one cover
    for (let k = 0; k < (o.boulders ?? 3); k++){
      const a = (k + 0.5) / (o.boulders ?? 3) * PI * 2 + (o.turn ?? 0.4), d = r + 2.2, br = 1.1, bh = 1.3 + R() * 0.8;   // (where they lie is fixed: the footprint never changes with the seed)
      const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
      solids.push({ x: bx, z: bz, r: br, h: bh });
      K.deco(new THREE.DodecahedronGeometry(1, 0), M.b, bx, bh * 0.45, bz, R() * 3, R() * 3, R() * 3).scale.set(br * 1.05, bh * 0.56, br * 1.05);
    }
    void ax;
  },

  /* ARCH — a colossal gate over a lane: two piers, a lintel 13 m up you walk under (and can land on), the old makers'
     mark on its face. `span` the half-gap between the piers, `h` the lintel's underside. */
  arch(K, x, z, ax, M, o, R){
    const sp = o.span ?? 5, h = o.h ?? 13, pw = o.pw ?? 2.2, th = o.th ?? 2.6, at = (u, v) => ax ? [x + u, z + v] : [x + v, z + u];
    for (const s of [-1, 1]){
      const [px, pz] = at(s * (sp + pw), 0);
      K.box(px, pz, ax ? pw : th, ax ? th : pw, h, M.a);
      const [bx, bz] = at(s * (sp + pw), 0);
      K.box(bx, bz, ax ? pw + 0.6 : th + 0.6, ax ? th + 0.6 : pw + 0.6, 1.0, M.b);                   // the pier's foot
    }
    const [lx, lz] = at(0, 0), L = sp + pw * 2;
    K.deco(new THREE.BoxGeometry(ax ? L * 2 : th * 2, 3.2, ax ? th * 2 : L * 2), M.b, lx, h + 1.6, lz);
    K.slab(lx, lz, ax ? L : th, ax ? th : L, h, h + 3.2);
    K.deco(new THREE.BoxGeometry(ax ? L * 2 + 1.6 : th * 2 + 0.6, 1.2, ax ? th * 2 + 0.6 : L * 2 + 1.6), M.dark, lx, h + 3.8, lz);
    K.slab(lx, lz, ax ? L + 0.8 : th + 0.3, ax ? th + 0.3 : L + 0.8, h + 3.2, h + 4.4);
    if (M.glow){
      for (const sv of [-1, 1]){
        const [mx, mz] = at(0, sv * (th + 0.04));
        const g = K.deco(new THREE.TorusGeometry(1.2, 0.16, 6, 18), M.glow, mx, h + 1.6, mz, 0, ax ? 0 : PI / 2, 0); g.userData.passThrough = true;
      }
    }
    void R;
  },

  /* FREIGHTER — a bulk freighter grounded on its landing struts: a hull two storeys high and longer than the yard is
     wide, a ramp down from its belly, its engines at the stern. The hull is a long wall of hard cover; its back a deck.
     `len` the hull's half-length. */
  freighter(K, x, z, ax, M, o, R){
    const hl = o.len ?? 11, hw = o.w ?? 3.6, hh = o.h ?? 7.5, at = (u, v) => ax ? [x + u, z + v] : [x + v, z + u];
    const bx = (u, v, hu, hv, h, mat, opt) => { const [px, pz] = at(u, v); return K.box(px, pz, ax ? hu : hv, ax ? hv : hu, h, mat, opt); };
    bx(0, 0, hl, hw, hh, M.a);                                           // the hull
    { const [px, pz] = at(0, 0);                                         // the deck house along its back
      K.deco(new THREE.BoxGeometry(ax ? hl * 2 - 1 : hw * 2 - 1.2, 1.6, ax ? hw * 2 - 1.2 : hl * 2 - 1), M.b, px, hh + 0.8, pz);
      K.slab(px, pz, ax ? hl - 0.5 : hw - 0.6, ax ? hw - 0.6 : hl - 0.5, hh, hh + 1.6); }
    // the bridge: a raised block forward, lit ports along it
    bx(hl * 0.55, 0, hl * 0.28, hw * 0.7, hh + 4.2, M.b);
    for (const sv of [-1, 1]){ const [px, pz] = at(hl * 0.55, sv * (hw * 0.7 + 0.03)); const w = K.deco(new THREE.BoxGeometry(ax ? hl * 0.5 : 0.06, 0.5, ax ? 0.06 : hl * 0.5), M.glow, px, hh + 3.0, pz); w.userData.passThrough = true; }
    // the nose: a wedge out ahead, low, like a ram; a step under it
    bx(hl + 1.6, 0, 1.6, hw * 0.75, hh * 0.55, M.dark);
    // the engines at the stern: three big round bells, glowing, above the floor on the hull's end
    for (const sv of [-1, 0, 1]){
      const [px, pz] = at(-hl - 1.2, sv * hw * 0.62);
      K.column(px, pz, 1.3, hh * 0.85, M.dark, { taper: 1, seg: 12, wallKick: false });
      const [gx, gz] = at(-hl - 2.52, sv * hw * 0.62);
      K.deco(new THREE.CircleGeometry(1.0, 14), M.glow, gx, hh * 0.55, gz, 0, ax ? -PI / 2 : PI, 0).userData.passThrough = true;
    }
    // panel seams down the flanks, and the striped ramp down from the belly (a climb onto the hull: two steps)
    for (const sv of [-1, 1]) for (let u = -hl + 2; u < hl - 1; u += 3.2){ const [px, pz] = at(u, sv * (hw + 0.03)); const p = K.deco(new THREE.BoxGeometry(ax ? 0.14 : 0.06, hh * 0.9, ax ? 0.06 : 0.14), M.dark, px, hh * 0.47, pz); p.userData.passThrough = true; }
    { const side = o.ramp ?? -1;
      bx(-hl * 0.3, side * (hw + 1.4), 1.6, 1.4, 1.0, M.trim, { climbable: false });
      bx(-hl * 0.3 + 3.4, side * (hw + 1.1), 1.4, 1.1, 2.6, M.b); }
    void R;
  },

  /* STATUE — a colossal armoured warrior standing on a plinth, a cape behind, the T of the visor looking down the
     yard. The plinth is hard cover on every side; the figure towers 26 m over the floor. `h` the figure's height. */
  statue(K, x, z, ax, M, o, R){
    const H = o.h ?? 24, s = H / 24, face = o.face ?? 0;   // face: the turn the figure looks toward (0 = +z; a quarter turn at a time)
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; shared.arenaGroup.add(g);
    const put = (geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    K.box(x, z, 3.6, 3.6, 2.6, M.dark);                                                       // the plinth
    K.box(x, z, 4.6, 4.6, 0.5, M.a, { climbable: true });                                     // its step
    const P = 2.6;
    // one collider round the whole figure (legs, arms, rifle) up past reach; a wall-kick face
    { const sq = Math.abs(Math.sin(face)) > 0.5, hx = Math.min(3.4 * s, 3.6), hz = Math.min(2.7 * s, 3.6);   // (no wider than the plinth)
      solids.push({ x, z, hx: sq ? hz : hx, hz: sq ? hx : hz, h: 17, box: true }); }
    // the legs, a little apart: thigh, knee plate, greave, boot
    for (const sx of [-1, 1]){
      put(new THREE.BoxGeometry(1.4 * s, 1.0 * s, 2.3 * s), M.dark, sx * 1.15 * s, P + 0.5 * s, 0.35 * s);                 // the boot
      put(new THREE.CylinderGeometry(0.8 * s, 0.62 * s, 4.4 * s, 8), M.a, sx * 1.15 * s, P + 3.1 * s, 0);                 // the greave
      put(new THREE.BoxGeometry(1.3 * s, 1.2 * s, 0.5 * s), M.b, sx * 1.15 * s, P + 5.4 * s, 0.75 * s);                  // the knee plate
      put(new THREE.CylinderGeometry(0.95 * s, 0.82 * s, 4.2 * s, 8), M.a, sx * 1.1 * s, P + 7.6 * s, 0);                 // the thigh
    }
    put(new THREE.BoxGeometry(3.9 * s, 1.6 * s, 2.5 * s), M.dark, 0, P + 9.9 * s, 0);                                     // the belt
    put(new THREE.CylinderGeometry(2.2 * s, 1.8 * s, 5.6 * s, 6), M.a, 0, P + 13.4 * s, 0).scale.set(1, 1, 0.62);         // the torso
    put(new THREE.BoxGeometry(3.4 * s, 2.6 * s, 0.4 * s), M.b, 0, P + 14.0 * s, 1.15 * s);                                // the chest plate
    put(new THREE.BoxGeometry(3.0 * s, 4.4 * s, 1.4 * s), M.dark, 0, P + 13.6 * s, -1.6 * s);                             // the jetpack
    for (const sx of [-1, 1]) put(new THREE.CylinderGeometry(0.45 * s, 0.6 * s, 1.0 * s, 8), M.b, sx * 0.8 * s, P + 11.0 * s, -1.6 * s);   // its nozzles
    for (const sx of [-1, 1]){
      put(new THREE.SphereGeometry(1.2 * s, 10, 6, 0, PI * 2, 0, PI / 2), M.b, sx * 2.5 * s, P + 15.6 * s, 0).scale.set(1, 0.7, 1);   // pauldrons
      put(new THREE.CylinderGeometry(0.62 * s, 0.55 * s, 5.4 * s, 8), M.a, sx * 2.5 * s, P + 12.6 * s, 0.6 * s, 0.32, 0, sx * 0.06);   // the arms, in to the rifle
      put(new THREE.BoxGeometry(0.8 * s, 0.9 * s, 0.9 * s), M.dark, sx * 0.75 * s, P + 10.4 * s, 2.0 * s);                 // the hands
    }
    // the rifle, its butt on the plinth before the boots, both hands on its muzzle
    put(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 10 * s, 6), M.dark, 0, P + 5.2 * s, 2.15 * s);
    put(new THREE.BoxGeometry(0.7 * s, 2.4 * s, 0.9 * s), M.dark, 0, P + 1.4 * s, 2.15 * s);
    // the helmet: a dome, the T visor, the cheek plates and the rangefinder; the cape falling behind
    put(new THREE.CylinderGeometry(0.8 * s, 1.1 * s, 0.8 * s, 8), M.dark, 0, P + 16.4 * s, 0);                           // the neck seal
    put(new THREE.SphereGeometry(1.75 * s, 14, 10), M.b, 0, P + 18.3 * s, 0).scale.set(1, 1.12, 1.02);
    put(new THREE.BoxGeometry(2.3 * s, 0.42 * s, 0.3 * s), M.glow, 0, P + 18.5 * s, 1.68 * s);
    put(new THREE.BoxGeometry(0.5 * s, 1.4 * s, 0.3 * s), M.glow, 0, P + 17.7 * s, 1.66 * s);
    for (const sx of [-1, 1]) put(new THREE.BoxGeometry(0.5 * s, 1.6 * s, 1.5 * s), M.b, sx * 1.45 * s, P + 17.4 * s, 0.5 * s);
    put(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 1.6 * s, 4), M.dark, 1.7 * s, P + 19.6 * s, 0.2 * s);
    put(new THREE.BoxGeometry(5.2 * s, 14 * s, 0.35 * s), M.trim, 0, P + 9.0 * s, -2.5 * s, -0.12, 0, 0);               // the cape
    g.traverse(m => { if (m.isMesh) m.userData.passThrough = true; });   // (the collider above holds the figure; its arms, rifle and cape stand on the plinth)
    void ax; void R;
  },

  /* BUILDING — a real multi-storey building standing in the fight: a podium block with a lit entrance under a canopy,
     a tower set back above it, and roof plant, a mast and a beacon. Its walls are hard cover and wall-kick faces; the
     barriers at its doors are cover to crouch behind; the podium's roof is a deck the jetpack can land on. Detail is
     merged into a few meshes per building. `style` dresses it for its world; the masses (so the cover and the lanes)
     are the same in every style:
       block    (the default) storey bands, pilasters, rows of windows: a garrison block, a relay station
       spire    Kamino's: smooth pale walls, rounded corners, round ports, a saucer deck, a domed crown
       keep     a fortress: buttresses, slit windows, battlements, a pyramid roof
       bunker   a prefab command bunker: armour plates leaning on its walls, shuttered slits, a comms dish
       control  a dock control tower: its top storeys a wide band of slanted glass over the yard
       adobe    a desert tower: rounded corners, small deep windows, beam ends, a dome and a vapour vane
     `w` / `d` half its length / depth, `h` its height, `podium` the podium's height (all of it when there's no tower),
     `inset` the tower's setback, `storey`, `bay` (window spacing), `lit` (share of windows lit), `front` 1 / −1 / 0 (which
     long face has the entrance, 0 both), `bands` false for no storey bands, `roof` false for no plant. */
  building(K, x, z, ax, M, o, R){
    const S = o.style || 'block';
    const w = o.w ?? 7, d = o.d ?? 5, H = o.h ?? 28, st = o.storey ?? 3.6, bay = o.bay ?? 3.2;
    const pod = Math.min(o.podium ?? (H > 20 ? 12.6 : H), H), tower = H - pod > 2;
    const tw = w - (o.inset ?? 1.6), td = d - (o.inset ?? 1.6);
    const rc = { spire: 0.5, keep: 0.55, bunker: 0.6, adobe: 0.45 }[S] || 0;   // the walls drawn this far in from the collider: corners, buttresses or plates fill it
    const rot = ax ? 0 : PI / 2;
    const W = (u, v) => ax ? [x + u, z + v] : [x + v, z - u];                               // local (along, across) to the world
    const ext = (hu, hv) => ax ? [hu, hv] : [hv, hu];
    const bins = new Map();
    const add = (mat, geo) => { if (!bins.has(mat)) bins.set(mat, []); bins.get(mat).push(geo); };
    const bx = (mat, u, y, v, su, sy, sv) => add(mat, new THREE.BoxGeometry(su, sy, sv).translate(u, y, v));
    const mass = (hu, hv, h, y = 0) => { const [ex, ez] = ext(hu, hv), m = K.box(x, z, ex, ez, h, M.a, y ? { y } : {}); if (rc) m.scale.set((ex - rc) / ex, 1, (ez - rc) / ez); };
    // the solid masses: a step round the foot, the podium, the tower over it (its collider from the floor up)
    { const [ex, ez] = ext(w + 0.5, d + 0.5); K.box(x, z, ex, ez, 0.3, M.dark, { climbable: true }); }
    mass(w, d, pod);
    if (tower) mass(tw, td, H - pod, pod);
    // the faces of a mass (half-sizes hu, hv) from y0 to y1
    const faces = (hu, hv, y0, y1, ground, top) => {
      const sides = [[0, 1, hu], [0, -1, hu], [1, 0, hv], [-1, 0, hv]];   // [nu, nv, half-length of that face]
      if (S === 'spire' || S === 'adobe'){   // rounded corners, out to the collider's corner
        const r = rc + 0.5;
        for (const su of [-1, 1]) for (const sv of [-1, 1]) add(M.a, new THREE.CylinderGeometry(r, r, y1 - y0, 12).translate(su * (hu - r), (y0 + y1) / 2, sv * (hv - r)));
      }
      for (const [nu, nv, hl] of sides){
        const n = Math.max(1, Math.round(hl * 2 / bay)), b = hl * 2 / n, face = (nu ? hu : hv) - rc;
        const at = (t, off) => nu ? [nu * (face + off), t] : [t, nv * (face + off)];   // t along the face, off out from the wall
        const dims = (along, up, out) => nu ? [out, up, along] : [along, up, out];
        const box = (mat, t, off, y, along, up, out) => { const [pu, pv] = at(t, off), [su, sy, sv] = dims(along, up, out); bx(mat, pu, y, pv, su, sy, sv); };
        const lit = () => R() < (o.lit ?? 0.45) ? M.glow : M.dark;
        const rows = fn => { for (let y = y0 + (ground ? st : 0); y + st <= y1 + 0.01; y += st) for (let i = 0; i < n; i++) fn(-hl + (i + 0.5) * b, y); };
        const inner = hl - (rc ? rc + 0.5 : 0);   // the face's length between rounded corners
        if (S === 'block' || S === 'control'){
          for (let i = 0; i <= n; i++) box(M.b, -hl + i * b, 0.12, (y0 + y1) / 2, 0.5, y1 - y0, 0.24);                 // pilasters
          if (o.bands !== false) for (let y = y0 + st; y < y1 - 0.5; y += st) box(M.b, 0, 0.09, y, hl * 2 + 0.2, 0.32, 0.18);   // a band at every floor
          rows((t, y) => box(lit(), t, 0.04, y + st * 0.55, b * (o.winW ?? 0.56), st * (o.winH ?? 0.46), 0.08));
        } else if (S === 'spire'){
          for (let y = y0 + st * 2; y < y1 - 0.5; y += st * 2) box(M.b, 0, 0.05, y, inner * 2, 0.22, 0.1);              // a thin band every other floor
          rows((t, y) => { if (Math.abs(t) > inner - 0.7) return;
            const g = new THREE.CylinderGeometry(st * 0.2, st * 0.2, 0.1, 14);
            if (nu) g.rotateZ(PI / 2); else g.rotateX(PI / 2);
            const [pu, pv] = at(t, 0.04); add(lit(), g.translate(pu, y + st * 0.55, pv)); });
        } else if (S === 'keep'){
          for (let i = 0; i <= n; i += 2){ const t = Math.max(-hl + 0.45, Math.min(hl - 0.45, -hl + i * b));
            box(M.b, t, rc / 2, (y0 + y1) / 2, 0.9, y1 - y0, rc);                                                   // buttresses, out to the collider
            box(M.dark, t, rc / 2, y0 + 1.2, 1.2, 2.4, rc + 0.02); }
          box(M.dark, 0, 0.06, y0 + 0.9, hl * 2, 1.8, 0.12);                                                         // a dark plinth course
          rows((t, y) => box(lit(), t, 0.04, y + st * 0.5, 0.28, st * 0.62, 0.08));                                   // arrow slits
        } else if (S === 'bunker'){
          const ph = Math.min(y1 - y0, 5.6), lean = Math.atan2(rc - 0.1, ph);
          for (let i = 0; i < n; i++){   // armour plates leaning on the wall, their feet at the collider
            const t = -hl + (i + 0.5) * b, g = new THREE.BoxGeometry(nu ? 0.22 : b * 0.92, ph / Math.cos(lean), nu ? b * 0.92 : 0.22);
            if (nu) g.rotateZ(nu * lean); else g.rotateX(-nv * lean);   // (the top in against the wall)
            const [pu, pv] = at(t, (rc - 0.1) / 2 + 0.1); add(M.b, g.translate(pu, y0 + ph / 2, pv));
          }
          box(M.trim, 0, rc - 0.05, y0 + ph + 0.15, hl * 2 - 0.2, 0.3, 0.1);                                         // a hazard stripe over them
          rows((t, y) => { if (y < y0 + ph) return; box(lit(), t, 0.04, y + st * 0.55, b * 0.8, st * 0.16, 0.08);    // shuttered slits
            box(M.dark, t, 0.08, y + st * 0.72, b * 0.86, st * 0.1, 0.16); });
        } else if (S === 'adobe'){
          rows((t, y) => { if (Math.abs(t) > inner - 0.6) return;
            box(M.dark, t, 0.03, y + st * 0.55, b * 0.42, st * 0.34, 0.06);                                          // a deep reveal
            if (R() < (o.lit ?? 0.3)) box(M.glow, t, 0.05, y + st * 0.55, b * 0.26, st * 0.22, 0.06); });
          for (let t = -inner + 0.6; t <= inner - 0.6; t += 1.2){                                                    // the beam ends under the roof line
            const g = new THREE.CylinderGeometry(0.12, 0.12, rc, 6); if (nu) g.rotateZ(PI / 2); else g.rotateX(PI / 2);
            const [pu, pv] = at(t, rc / 2); add(M.trim, g.translate(pu, y1 - 0.7, pv)); }
        }
        if (top && S === 'keep') for (let t = -hl + 0.4; t <= hl - 0.4; t += 1.6) box(M.a, t, rc - 0.4, y1 + 0.55, 0.8, 1.1, 0.8);   // battlements
        if (top && S === 'adobe') box(M.a, 0, rc - 0.25, y1 + 0.4, inner * 2, 0.8, 0.5);                            // a parapet
      }
    };
    faces(w, d, 0.3, pod, true, !tower && pod >= 16);
    if (tower) faces(tw, td, pod, H, false, true);
    // the cornices: a lip round the podium roof and the tower top (a saucer deck on a spire)
    if (S === 'spire') add(M.b, new THREE.CylinderGeometry(1, 1, 0.5, 28).scale(w, 1, d).translate(0, pod - 0.25, 0));
    else if (S !== 'adobe') bx(M.b, 0, pod - 0.25, 0, w * 2 + (rc ? 0 : 0.5), 0.5, d * 2 + (rc ? 0 : 0.5));
    if (tower && S !== 'adobe' && S !== 'spire') bx(M.b, 0, H - 0.3, 0, tw * 2 + 0.4, 0.6, td * 2 + 0.4);
    // the ground floor: on each entrance face a lit doorway under a canopy, and a barrier either side to crouch behind
    for (const sv of o.front === 0 ? [-1, 1] : [o.front ?? 1]){
      const dw = Math.min(2.2, w * 0.3), fz = d - rc;
      bx(M.dark, 0, 2.2, sv * (fz + 0.05), dw * 2, 3.8, 0.1);                                  // the doors
      bx(M.glow, 0, 4.3, sv * (fz + 0.06), dw * 2, 0.22, 0.1);                                 // the lit strip over them
      bx(M.b, 0, 4.75, sv * (d + 1.2), dw * 2 + 1.6, 0.4, 2.4);                                // the canopy
      { const [cx, cz] = W(0, sv * (d + 1.2)), [ex, ez] = ext(dw + 0.8, 1.2); K.slab(cx, cz, ex, ez, 4.55, 4.95); }
      for (const su of [-1, 1]){
        const [cx, cz] = W(su * (dw + 2.2), sv * (d + 3.0)), [ex, ez] = ext(1.1, 0.5);
        K.box(cx, cz, ex, ez, 1.2, M.dark);
        K.deco(new THREE.BoxGeometry(ex * 2 + 0.06, 0.12, ez * 2 + 0.06), M.trim, cx, 1.26, cz).userData.passThrough = true;
      }
    }
    // the roof (all past reach)
    if (o.roof !== false){
      const rw = tower ? tw : w, rd = tower ? td : d, rm = Math.min(rw, rd);
      const mast = (u, v, y, len) => { add(M.dark, new THREE.CylinderGeometry(0.12, 0.3, len, 6).translate(u, y + len / 2, v)); add(M.glow, new THREE.SphereGeometry(0.45, 8, 6).translate(u, y + len + 0.2, v)); };
      if (S === 'spire'){
        add(M.b, new THREE.CylinderGeometry(1, 1, 0.5, 28).scale(rw + 0.8, 1, rd + 0.8).translate(0, H + 0.25, 0));
        add(M.a, new THREE.SphereGeometry(rm * 0.85, 18, 8, 0, PI * 2, 0, PI / 2).translate(0, H + 0.5, 0));
        add(M.glow, new THREE.CylinderGeometry(rm * 0.87, rm * 0.87, 0.25, 24).translate(0, H + 0.9, 0));
        mast(0, 0, H + rm * 0.8, 5);
      } else if (S === 'keep'){
        add(M.b, new THREE.ConeGeometry(Math.SQRT2, 1, 4).rotateY(PI / 4).scale(rw - 0.9, rm * 1.4, rd - 0.9).translate(0, H + rm * 0.7, 0));
        mast(0, 0, H + rm * 1.4, 3);
      } else if (S === 'bunker'){
        bx(M.dark, -rw * 0.4, H + 0.9, 0, rw * 0.5, 1.8, rd * 1.1);
        const dish = new THREE.SphereGeometry(2.0, 14, 6, 0, PI * 2, 0, PI / 3.2).rotateX(PI).rotateX(-0.9).translate(rw * 0.35, H + 3.0, 0);
        add(M.b, dish); add(M.dark, new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6).translate(rw * 0.35, H + 1.2, 0));
        mast(-rw * 0.6, rd * 0.5, H, 6);
      } else if (S === 'control'){
        add(M.glow, new THREE.CylinderGeometry(Math.SQRT2, Math.SQRT2 * 0.8, 1, 4, 1).rotateY(PI / 4).scale(rw + 1.4, 4.0, rd + 1.4).translate(0, H - 2.6, 0));
        add(M.dark, new THREE.CylinderGeometry(Math.SQRT2, Math.SQRT2, 1, 4, 1).rotateY(PI / 4).scale(rw + 1.6, 0.7, rd + 1.6).translate(0, H - 0.25, 0));
        bx(M.b, rw * 0.3, H + 0.6, 0, rw * 0.6, 1.2, rd * 0.8);
        mast(-rw * 0.5, rd * 0.4, H, 8);
      } else if (S === 'adobe'){
        add(M.a, new THREE.SphereGeometry(rm * 0.7, 14, 6, 0, PI * 2, 0, PI / 2).translate(-rw * 0.15, H, 0));
        add(M.dark, new THREE.CylinderGeometry(0.08, 0.1, 4.5, 6).translate(rw * 0.55, H + 2.25, rd * 0.4));      // the vapour vane
        for (const y of [3.2, 4.0]) bx(M.trim, rw * 0.55, H + y, rd * 0.4, 1.6, 0.12, 0.12);
      } else {
        bx(M.dark, -rw * 0.4, H + 1.0, rd * 0.2, rw * 0.6, 2.0, rd * 0.8);
        bx(M.b, rw * 0.35, H + 0.7, -rd * 0.3, rw * 0.5, 1.4, rd * 0.6);
        mast(rw * 0.5, rd * 0.5, H, 7);
      }
    }
    for (const [mat, list] of bins){
      const m = K.deco(mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g), false), mat, x, 0, z, 0, rot, 0);
      m.userData.passThrough = true;   // (detail on the faces of the masses above: their colliders hold it)
      for (const g of list) g.dispose();
    }
  },
};

/* (the kinds, for tools: tools/landmark-fit.mjs finds where a wished-for piece fits on a map) */
export const LANDMARK_KINDS = KINDS;
export const landmarkMats = (spec, pal) => matsFor(spec, pal);

const gapBox = (a, b) => Math.hypot(Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1)), Math.max(0, Math.max(a.z0 - b.z1, b.z0 - a.z1)));
const boxOf = c => { const ex = c.box ? c.hx : c.r, ez = c.box ? c.hz : c.r; return { x0: c.x - ex, x1: c.x + ex, z0: c.z - ez, z1: c.z + ez }; };
const floorSolid = c => !c.mound && (c.y0 || 0) < 2 && c.h > 0.55;

/* the materials a placement asks for: palette keys (or colours) for a, b, dark, trim and glow */
function matsFor(spec, pal){
  const col = (k, d) => typeof k === 'number' ? k : (k && pal[k] != null ? pal[k] : d);
  const flat = !!spec.flat;
  return {
    a: std(col(spec.a, 0x6a6e74), { m: spec.metal ?? 0.35, flat }), b: std(col(spec.b, 0x4a4e56), { m: spec.metal ?? 0.35, flat }),
    dark: std(col(spec.dark, 0x2a2e34), { m: spec.metal ?? 0.35, flat }), trim: std(col(spec.trim, 0xc8a03a), { m: 0.3 }),
    glow: glowM(col(spec.glow, 0xff3a2a)),
  };
}

export function buildLandmarks(L){
  const plan = LANDMARKS[L.layout];
  shared.landmarks = { placed: [], dropped: [] };
  if (!plan || (L.arenaZ && L.arenaZ !== L.arena)) return;
  const hx = shared.arenaHalf, k = hx / (plan.base / 2);   // (a co-op room built wider: the plan moves out with it)
  const K = arenaKit(), R = seeded(plan.seed ?? L.layout.length * 131 + 7), pal = L.pal || {};
  const lane = plan.lane ?? 2.8, keep = plan.keep ?? 3.4;   // (2.8: the cover pass's lane, wide enough for a brute and the pathing grid)
  const keeps = keepPoints(L.layout).map(([x, z, r]) => [x, z, Math.min(r || 0, 2) + keep]);
  for (const h of hazardZones) keeps.push([h.cx, h.cz, (h.r || 2) + 1.5]);
  for (const v of vents) keeps.push([v.group.position.x, v.group.position.z, 3]);
  for (const b of barrels) keeps.push([b.mesh.position.x, b.mesh.position.z, 2.2]);
  for (const d of shared.doors || []) if (d.at) keeps.push([d.at[0], d.at[1], 5]);
  for (const p of plan.pieces){
    const fn = KINDS[p.kind];
    if (!fn) continue;
    const x = p.at[0] * k, z = p.at[1] * k, id = `${p.kind}@${p.at[0]},${p.at[1]}`;
    const before = solids.filter(floorSolid).map(boxOf);
    const g = shared.arenaGroup, n0 = g.children.length, s0 = solids.length, p0 = pillars.length;
    fn(K, x, z, p.ax ?? 1, matsFor(p.mats || plan.mats || {}, pal), p, R);
    // does it fit? every new piece on the floor inside the map, a lane clear of what was there, off every kept point
    const mine = solids.slice(s0).filter(floorSolid).map(boxOf);
    let why = null;
    for (const f of mine){
      if (Math.max(Math.abs(f.x0), Math.abs(f.x1), Math.abs(f.z0), Math.abs(f.z1)) > hx - 1.5){ why = 'past the edge'; break; }
      const near = before.find(b => gapBox(b, f) < lane);
      if (near){ why = `crowds a solid at ${((near.x0 + near.x1) / 2).toFixed(1)}, ${((near.z0 + near.z1) / 2).toFixed(1)}`; break; }
      const kp = keeps.find(([px, pz, r]) => gapBox(f, { x0: px, x1: px, z0: pz, z1: pz }) < r);
      if (kp){ why = `on a mission point at ${kp[0].toFixed(1)}, ${kp[1].toFixed(1)}`; break; }
    }
    if (why){   // take it back out
      for (const m of g.children.splice(n0)){ m.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      solids.length = s0; pillars.length = p0;
      shared.landmarks.dropped.push(id + ': ' + why);
      continue;
    }
    shared.landmarks.placed.push(id);
  }
}
