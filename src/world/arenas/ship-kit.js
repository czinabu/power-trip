// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SHIP KIT: the shapes the hubs' parked ships are built from (world/arenas/tython.js's shuttle, clone-citadel.js's
// gunships, covert-hub.js's hunter's ship), so a hull reads as a made thing and not a stack of boxes: a turned fuselage, a
// side profile pressed out with rounded edges, a wing cut from its plan, engines with an intake and a lit nozzle, landing
// legs with an oleo and a brace, and the seams and lights that sell the scale. Every piece is a plain mesh added to the
// group handed in (the arena bake inks and merges them like any prop); collision stays the caller's business.

import * as THREE from 'three';

const PI = Math.PI;

/* put a mesh in `g` at (x, y, z), turned (rx, ry, rz) */
export function put(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0){
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = !mat.isMeshBasicMaterial; m.receiveShadow = !mat.isMeshBasicMaterial; g.add(m); return m;
}

/* a TURNED body along z: `prof` is [[z, r], ...] from nose to tail; the round section is squashed to `sx` wide and `sy`
   tall (so a fuselage is an oval, flatter than it is wide). Centred on the z axis */
export function turned(prof, sx = 1, sy = 1, seg = 24){
  const pts = prof.map(([z, r]) => new THREE.Vector2(Math.max(r, 0.001), z));
  const geo = new THREE.LatheGeometry(pts, seg);   // (about y: the profile's y is our z)
  geo.rotateX(PI / 2);                              // y → z: the body lies along +z, nose first
  geo.scale(sx, sy, 1);
  geo.computeVertexNormals();
  return geo;
}
/* the turned body's radius at z (for fitting things to it) */
export function radiusAt(prof, z){
  for (let i = 1; i < prof.length; i++){
    const [z0, r0] = prof[i - 1], [z1, r1] = prof[i];
    if ((z - z0) * (z - z1) <= 0) return r0 + (r1 - r0) * ((z - z0) / ((z1 - z0) || 1));
  }
  return 0;
}
/* a SEAM round the turned body at z: a thin dark ring, a hair proud of the skin */
export function seamRing(g, prof, z, sx, sy, mat, y = 0, w = 0.05){
  const r = radiusAt(prof, z) + 0.02;
  const ring = put(g, new THREE.TorusGeometry(r, w, 4, 32), mat, 0, y, z);
  ring.scale.set(sx, sy, 1);
  return ring;
}

/* a SIDE PROFILE pressed out across x: `pts` are [[z, y], ...] (z along the ship, y up), `w` the width, `bevel` how round
   its long edges are */
export function profile(pts, w, bevel = 0.2, segs = 3){
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, w - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, steps: 1 });
  geo.translate(0, 0, -(w - bevel * 2) / 2); geo.rotateY(-PI / 2);   // (the profile's x runs along +z, the extrusion across x)
  return geo;
}

/* a PLAN cut out flat and given thickness: `pts` are [[x, z], ...] seen from above, `t` thick, lying at y = 0. Points go
   round either way (they're put anticlockwise so the faces point out) */
export function plan(pts, t = 0.3, bevel = 0.1){
  let a = 0; for (let i = 0; i < pts.length; i++){ const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]; a += x0 * z1 - x1 * z0; }
  const P = a < 0 ? pts : [...pts].reverse();   // (the shape is drawn in x, −z: so the winding flips)
  const sh = new THREE.Shape(); sh.moveTo(P[0][0], -P[0][1]); for (const [x, z] of P.slice(1)) sh.lineTo(x, -z);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, t - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  geo.rotateX(-PI / 2); geo.translate(0, -(t - bevel * 2) / 2, 0);
  return geo;
}

/* an ENGINE along z, its nozzle aft (+z): a nacelle, an intake lip and its dark mouth forward, a cooling band, the
   nozzle's cone and the glow in it. Returns { group, glow } (the glow a MeshBasic disc to breathe) */
export function engine(m, { r = 1, len = 4, glowCol = 0x8ad8ff, ring = null, cone = true } = {}){
  const g = new THREE.Group();
  put(g, new THREE.CylinderGeometry(r, r * 1.04, len, 20), m.body, 0, 0, 0, PI / 2);
  put(g, new THREE.TorusGeometry(r * 0.94, r * 0.12, 6, 22), ring || m.trim, 0, 0, -len / 2);                      // the intake lip
  put(g, new THREE.CircleGeometry(r * 0.86, 20), m.dark, 0, 0, -len / 2 + 0.02, 0, PI);                              // its dark mouth
  put(g, new THREE.CylinderGeometry(r * 1.06, r * 1.06, len * 0.12, 20), ring || m.trim, 0, 0, len * 0.12, PI / 2);  // a band
  put(g, new THREE.CylinderGeometry(r * 0.82, r * 0.98, len * 0.16, 20, 1, true), m.dark, 0, 0, len / 2 + len * 0.07, PI / 2);   // the nozzle
  if (cone) put(g, new THREE.ConeGeometry(r * 0.32, len * 0.2, 12), m.dark, 0, 0, len / 2 + len * 0.02, -PI / 2);
  const glow = put(g, new THREE.CircleGeometry(r * 0.62, 20), new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: 0.85, toneMapped: false }), 0, 0, len / 2 + len * 0.13);
  glow.userData.noBake = true;
  return { group: g, glow };
}

/* a LANDING LEG from the hull at height `h` down to the floor: an upper strut, the shiny oleo, a foot pad, and a brace
   back up to the hull. `rake` leans it (radians about x) */
export function leg(m, h, { r = 0.16, pad = 0.5, brace = 0.9, rake = 0 } = {}){
  const g = new THREE.Group();
  const up = h * 0.55, lo = h - up;
  put(g, new THREE.CylinderGeometry(r * 1.3, r * 1.3, up, 8), m.dark, 0, h - up / 2, 0);
  put(g, new THREE.CylinderGeometry(r * 0.8, r * 0.8, lo + 0.1, 8), m.chrome || m.trim, 0, lo / 2, 0);
  put(g, new THREE.CylinderGeometry(pad, pad * 1.12, 0.14, 12), m.dark, 0, 0.07, 0);
  put(g, new THREE.CylinderGeometry(pad * 0.5, pad * 0.7, 0.14, 10), m.dark, 0, 0.2, 0);
  if (brace){
    const bl = Math.hypot(brace, h * 0.5);
    put(g, new THREE.CylinderGeometry(r * 0.6, r * 0.6, bl, 6), m.dark, 0, h * 0.62, brace / 2, Math.atan2(brace, h * 0.5), 0, 0);
  }
  g.rotation.x = rake;
  return g;
}

/* a run of SEAM lines on a flat face: thin dark strips */
export function strip(g, mat, x, y, z, lx, ly, lz, rx = 0, ry = 0, rz = 0){ return put(g, new THREE.BoxGeometry(lx, ly, lz), mat, x, y, z, rx, ry, rz); }

/* a NAV LIGHT: a small lit bead (MeshBasic, left live) that blinks if `anim` is given */
export function navLight(g, col, x, y, z, r = 0.12){
  const l = put(g, new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }), x, y, z);
  l.userData.noBake = true;
  return l;
}
