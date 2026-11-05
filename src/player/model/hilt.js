// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HILT THE WORKBENCH BUILDS (data/saber-parts.js names the parts, ui/customizer.js's SABER tab picks them): a body (the
// grip), an emitter (the head the blade leaves) and a pommel (the end below the hand), each its own silhouette and finish,
// so a saber reads at a glance in a fight, on a co-op partner and on the stand. look.jedi.hilt = { body, emitter, pommel }.
//
// In the saber root's space (model/weapons.js): the fist closes at y 0, the blade leaves the emitter at +0.17, and a
// two-handed form's off hand closes at −0.15 (anim/saber.js), so the GRIP runs −0.17…+0.08 and keeps to about the old
// hilt's girth where the hands close (a fatter grip pokes through the fingers). The emitter fills +0.08…+0.17 and the
// pommel hangs below −0.17. The saber staff (forms.js staff) carries on past the pommel with its own long hilt, so the
// pommel hides while the staff is out (weapons.js setSaberStaff).
//
// Add a part: a builder below, and a line in data/saber-parts.js with the same id.

import * as THREE from 'three';
import { loft, block, ngon, shard } from './shapes.js';

const ROUND = ngon(10, Math.PI / 10);
const GRIP_LO = -0.17, GRIP_HI = 0.08, EMIT = 0.17;
// the emitter keeps its height (the blade leaves at EMIT) and widens; the pommel widens and hangs longer below the hand
const EMIT_SCALE = [1.3, 1, 1.3], POMMEL_SCALE = [1.3, 1.5, 1.3];
// the builders below draw the grip to GRIP_LO; in the hand it is stretched on down to GRIP_END, so more hilt shows below
// the fist (where the gameplay camera sees it) without moving the blade, the hands or the staff (weapons.js STAFF)
const GRIP_END = -0.25, STRETCH = (GRIP_HI - GRIP_END) / (GRIP_HI - GRIP_LO);
// each body's metal: the emitter and the pommel are made in it too, so a part always matches the hilt it is fitted to
// band: the bright ring at each end of the grip, in the hilt's own colour, so the finish reads from across a room
const FINISH = {
  apprentice: { metal: 0x9aa4b0, dark: 0x16191e, band: 0xd8e2ec },
  guardian: { metal: 0x2b2e35, dark: 0xb9c2cc, m: 0.7, band: 0xeef4fa },
  sentinel: { metal: 0x1d2026, dark: 0xc9a24a, m: 0.6, band: 0xffc84a },
  duelist: { metal: 0xa8774a, dark: 0x2a1c12, band: 0xff9a5a },
  temple: { metal: 0xe2dac6, dark: 0xc9a24a, m: 0.25, r: 0.45, band: 0xffd860 },
  exile: { metal: 0x5b4733, dark: 0x1c1712, band: 0xc8925a },
};
const ring = (y0, y1, w) => loft([{ y: y0, w, d: w }, { y: y1, w, d: w }], ROUND);

/* ---------- BODIES: the grip ---------- */
const BODIES = {
  // plain steel and a leather wrap: the saber you started with
  apprentice(K){
    K.add(loft([{ y: GRIP_LO, w: 0.074, d: 0.074 }, { y: GRIP_LO + 0.02, w: 0.067, d: 0.067 }, { y: GRIP_HI - 0.025, w: 0.067, d: 0.067 }, { y: GRIP_HI, w: 0.078, d: 0.078 }], ROUND), K.metal);
    for (let i = 0; i < 6; i++) K.add(block(0.074, 0.013, 0.074, 0.4), 'leather', [0, -0.135 + i * 0.03, 0], [0, 0, 0], false);
    K.add(block(0.022, 0.036, 0.03, 0.3), K.dark, [0, 0.045, 0.038], [0, 0, 0], false);   // activator
  },
  // black, heavy, ribbed in silver bands all the way down
  guardian(K){
    K.add(loft([{ y: GRIP_LO, w: 0.08, d: 0.08 }, { y: GRIP_HI, w: 0.08, d: 0.08 }], ngon(8, Math.PI / 8)), K.metal);
    for (let i = 0; i < 8; i++) K.add(ring(-0.155 + i * 0.03, -0.147 + i * 0.03, 0.086), K.dark, [0, 0, 0], [0, 0, 0], false);
    K.add(block(0.026, 0.03, 0.03, 0.3), 'accent', [0, 0.05, 0.042], [0, 0, 0], false);
  },
  // slim black, three long brass inlays and brass bands at each end
  sentinel(K){
    K.add(loft([{ y: GRIP_LO, w: 0.064, d: 0.064 }, { y: GRIP_HI, w: 0.064, d: 0.064 }], ROUND), K.metal);
    for (let i = 0; i < 3; i++){
      const a = i * Math.PI * 2 / 3 + Math.PI / 6;
      K.add(block(0.012, 0.19, 0.01, 0.3), K.dark, [Math.sin(a) * 0.032, -0.05, Math.cos(a) * 0.032], [0, a, 0], false);
    }
    K.add(ring(GRIP_LO, GRIP_LO + 0.02, 0.072), K.dark);
    K.add(ring(GRIP_HI - 0.02, GRIP_HI, 0.074), K.dark);
  },
  // bronze, waisted in the middle and scored with dark grooves
  duelist(K){
    K.add(loft([{ y: GRIP_LO, w: 0.076, d: 0.076 }, { y: -0.06, w: 0.058, d: 0.058 }, { y: GRIP_HI, w: 0.078, d: 0.078 }], ROUND), K.metal);
    for (let i = 0; i < 5; i++){ const y = -0.12 + i * 0.035, w = 0.06 + Math.abs(y + 0.06) * 0.14 + 0.006; K.add(ring(y, y + 0.006, w), K.dark, [0, 0, 0], [0, 0, 0], false); }
    K.add(block(0.02, 0.03, 0.028, 0.3), K.dark, [0, 0.05, 0.039], [0, 0, 0], false);
  },
  // ivory, banded in gold
  temple(K){
    K.add(loft([{ y: GRIP_LO, w: 0.07, d: 0.07 }, { y: GRIP_HI, w: 0.07, d: 0.07 }], ROUND), K.metal);
    for (const y of [GRIP_LO, -0.075, 0.0, GRIP_HI - 0.016]) K.add(ring(y, y + 0.016, 0.078), 'trim', [0, 0, 0], [0, 0, 0], false);
    K.add(block(0.02, 0.03, 0.026, 0.3), 'trim', [0, 0.04, 0.037], [0, 0, 0], false);
  },
  // dark bronze bound in cloth, wound on a slant
  exile(K){
    K.add(loft([{ y: GRIP_LO, w: 0.072, d: 0.072 }, { y: GRIP_HI, w: 0.072, d: 0.072 }], ngon(8, Math.PI / 8)), K.metal);
    for (let i = 0; i < 8; i++) K.add(block(0.078, 0.014, 0.078, 0.4), K.cloth, [0, -0.15 + i * 0.026, 0], [0.18, 0, 0.12], false);
    K.add(block(0.02, 0.03, 0.026, 0.3), K.dark, [0, 0.06, 0.038], [0, 0, 0], false);
  },
};

/* ---------- EMITTERS: +0.08 up to the blade at +0.17 ---------- */
const EMITTERS = {
  plain(K){
    K.add(loft([{ y: GRIP_HI, w: 0.076, d: 0.076 }, { y: 0.1, w: 0.094, d: 0.094 }, { y: 0.15, w: 0.09, d: 0.09 }, { y: EMIT, w: 0.066, d: 0.066 }], ROUND), K.metal);
  },
  // a collar, and a tall half-shroud on the blade's outer side
  shroud(K){
    K.add(loft([{ y: GRIP_HI, w: 0.08, d: 0.08 }, { y: 0.13, w: 0.086, d: 0.086 }, { y: EMIT, w: 0.07, d: 0.07 }], ROUND), K.metal);
    K.add(loft([{ y: 0.09, w: 0.09, d: 0.02 }, { y: 0.2, w: 0.07, d: 0.014 }], ngon(6)), K.metal, [0, 0, -0.05]);
    K.add(ring(0.16, 0.168, 0.074), K.dark, [0, 0, 0], [0, 0, 0], false);
  },
  // a ring, and four prongs leaning out round the blade
  crown(K){
    K.add(loft([{ y: GRIP_HI, w: 0.08, d: 0.08 }, { y: 0.12, w: 0.096, d: 0.096 }, { y: 0.135, w: 0.08, d: 0.08 }], ROUND), K.metal);
    for (let i = 0; i < 4; i++){
      const a = i * Math.PI / 2 + Math.PI / 4;
      K.add(shard(0.02, 0.085, 0.02), K.metal, [Math.sin(a) * 0.038, 0.115, Math.cos(a) * 0.038], [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]);
    }
  },
  // a wide bell mouth, dark inside
  bell(K){
    K.add(loft([{ y: GRIP_HI, w: 0.076, d: 0.076 }, { y: 0.11, w: 0.082, d: 0.082 }, { y: 0.15, w: 0.11, d: 0.11 }, { y: EMIT, w: 0.13, d: 0.13 }], ROUND), K.metal);
    K.add(ring(EMIT, EMIT + 0.004, 0.1), K.dark, [0, 0, 0], [0, 0, 0], false);
  },
  // a heavy head slotted for heat
  vented(K){
    K.add(loft([{ y: GRIP_HI, w: 0.086, d: 0.086 }, { y: EMIT - 0.01, w: 0.086, d: 0.086 }, { y: EMIT, w: 0.07, d: 0.07 }], ngon(8, Math.PI / 8)), K.metal);
    for (let i = 0; i < 4; i++){
      const a = i * Math.PI / 2;
      K.add(block(0.016, 0.05, 0.01, 0.3), 'gunDark', [Math.sin(a) * 0.042, 0.125, Math.cos(a) * 0.042], [0, a, 0], false);
    }
  },
  // the side missions' head: two raised rings with a lit window between them, where the crystal shows through
  seeker(K){
    K.add(loft([{ y: GRIP_HI, w: 0.078, d: 0.078 }, { y: 0.1, w: 0.08, d: 0.08 }, { y: 0.155, w: 0.08, d: 0.08 }, { y: EMIT, w: 0.07, d: 0.07 }], ROUND), K.metal);
    K.add(ring(0.098, 0.11, 0.096), K.dark);
    K.add(ring(0.14, 0.152, 0.096), K.dark);
    K.add(block(0.022, 0.026, 0.012, 0.2), K.band, [0, 0.125, 0.04], [0, 0, 0], false);
    K.add(block(0.022, 0.026, 0.012, 0.2), K.band, [0, 0.125, -0.04], [0, 0, 0], false);
  },
};

/* ---------- POMMELS: below the grip ---------- */
const POMMELS = {
  cap(K){
    K.add(loft([{ y: -0.245, w: 0.05, d: 0.05 }, { y: -0.232, w: 0.074, d: 0.074 }, { y: -0.2, w: 0.082, d: 0.082 }, { y: GRIP_LO, w: 0.074, d: 0.074 }], ROUND), K.metal);
  },
  ring(K){
    K.add(loft([{ y: -0.215, w: 0.06, d: 0.06 }, { y: -0.2, w: 0.08, d: 0.08 }, { y: GRIP_LO, w: 0.074, d: 0.074 }], ROUND), K.metal);
    K.add(new THREE.TorusGeometry(0.024, 0.007, 6, 14), K.metal, [0, -0.24, 0]);
  },
  flanged(K){
    K.add(loft([{ y: -0.235, w: 0.06, d: 0.06 }, { y: -0.2, w: 0.078, d: 0.078 }, { y: GRIP_LO, w: 0.074, d: 0.074 }], ROUND), K.metal);
    for (let i = 0; i < 4; i++){
      const a = i * Math.PI / 2 + Math.PI / 4;
      K.add(block(0.012, 0.055, 0.03, 0.3), K.metal, [Math.sin(a) * 0.045, -0.205, Math.cos(a) * 0.045], [0, a, 0]);
    }
  },
  weighted(K){
    K.add(loft([{ y: -0.2, w: 0.056, d: 0.056 }, { y: GRIP_LO, w: 0.074, d: 0.074 }], ROUND), K.metal);
    K.add(new THREE.SphereGeometry(0.048, 12, 8), K.metal, [0, -0.235, 0]);
  },
  spike(K){
    K.add(loft([{ y: -0.285, w: 0.006, d: 0.006 }, { y: -0.2, w: 0.082, d: 0.082 }, { y: GRIP_LO, w: 0.074, d: 0.074 }], ngon(8, Math.PI / 8)), K.metal);
  },
  // a little holocron set on its corner below the hand, glowing in the hilt's own band colour
  holocron(K){
    K.add(loft([{ y: -0.205, w: 0.058, d: 0.058 }, { y: GRIP_LO, w: 0.074, d: 0.074 }], ROUND), K.metal);
    K.add(new THREE.OctahedronGeometry(0.036, 0), K.band, [0, -0.235, 0], [0, Math.PI / 4, 0]);
    K.add(ring(-0.212, -0.205, 0.07), K.dark, [0, 0, 0], [0, 0, 0], false);
  },
};

/* build the hilt into the saber root, each piece its own group so the workbench can lay them out apart (ui/bench-stage.js);
   returns { body, emitter, pommel } (the pommel hides while the saber staff is out) */
export function buildHilt(S, root, parts = {}){
  const body = BODIES[parts.body] ? parts.body : 'apprentice', F = FINISH[body];
  const K = {
    metal: S.mat('hilt', { c: F.metal, ...(F.m != null ? { m: F.m } : {}), ...(F.r != null ? { r: F.r } : {}) }),
    dark: S.mat('hilt', { c: F.dark, m: 0.6 }),
    band: S.mat('hilt', { c: F.band, e: F.band, ei: 0.45, m: 0.3, r: 0.3 }),
    cloth: S.mat('leather', { c: 0x6b5a44 }),
    to: null,
    add(geo, mat, p = [0, 0, 0], r = [0, 0, 0], outline = true){ return S.add(geo, mat, K.to, p, r, outline ? {} : { outline: false }); },
  };
  // each piece is a group the bench moves; the emitter and the pommel build into an inner group scaled up past the hand,
  // so at the gameplay camera (a saber a few dozen pixels long) the head and the end read as shapes and not specks
  const piece = (scale, anchor = 0, shift = 0) => {
    const g = new THREE.Group(); root.add(g); K.to = g;
    if (scale){ const s = new THREE.Group(); s.scale.set(...scale); s.position.y = anchor * (1 - scale[1]) + shift; g.add(s); K.to = s; }
    return g;
  };
  const out = { body: piece([1, STRETCH, 1], GRIP_HI) };
  const grip = K.to;
  BODIES[body](K);
  // the bright bands: one where the grip meets the emitter, one at its foot just above the pommel (unstretched, so they stay thin)
  K.to = out.body;
  K.add(ring(GRIP_HI - 0.012, GRIP_HI, 0.084), K.band, [0, 0, 0], [0, 0, 0], false);
  K.add(ring(GRIP_END, GRIP_END + 0.014, 0.084), K.band, [0, 0, 0], [0, 0, 0], false);
  out.emitter = piece(EMIT_SCALE, GRIP_HI);
  (EMITTERS[parts.emitter] || EMITTERS.plain)(K);
  out.pommel = piece(POMMEL_SCALE, GRIP_LO, GRIP_END - GRIP_LO);
  (POMMELS[parts.pommel] || POMMELS.cap)(K);
  // while the saber staff is out its own long hilt runs on below the fist (weapons.js), so the grip draws back to its old end
  out.staffFit = (on) => {
    grip.scale.y = on ? 1 : STRETCH; grip.position.y = GRIP_HI * (1 - grip.scale.y);
    out.body.children[out.body.children.length - 1].position.y = on ? GRIP_LO - GRIP_END : 0;
  };
  return out;
}
