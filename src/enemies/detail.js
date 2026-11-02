// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// NPC DETAIL: the small things that make a trooper look built and worn rather than moulded (enemies/mesh.js calls these).
//   · FACES — a real face on a head bone: skull, jaw, ears, eyes in shadowed sockets, brows, nose, lips. Its lids and
//     its jaw are bones of their own, so it blinks and talks (enemies/upper.js faceLife) without a draw call of its own.
//     The officer wears one under its cap; some line troopers go BARE-HEADED (variant 4), the helmet clipped to the belt.
//   · PLATE LAYERING — rivets on the plates, a rolled rim on each pauldron so it reads as a plate with a thickness,
//     and dark gap lines where the cuirass meets its side plates
//   · DECALS — an Imperial roundel on the shoulder, hazard chevrons on a brute's collar, tallies on the pack
//   · GEAR THAT MOVES — belt pouches, a holstered sidearm and a back canteen each hang from a bone of their own
//     (gearL, gearR, gearB) that enemies/upper.js swings with the stride, so they bounce and lag as the unit runs
//   · SLINGS — a rifle strap from the gun over the shoulder
// Everything here bakes into the unit's existing meshes (enemies/kit.js), so none of it costs a draw call.

import * as THREE from 'three';
import { loft, plate, block, shard, chamfer, ngon, HEAD } from '../player/model/shapes.js';
import { rounded } from '../player/model/skin.js';

const PI = Math.PI;
const SOFT_HEAD = rounded(HEAD), SOFT_LIMB = rounded(chamfer(0.4)), SOFT = rounded(chamfer(0.42));
const NO_INK = { outline: false };

/* ---------------- faces ---------------- */

export const LID_OPEN = 0.2;   // the lids' scale while the eyes are open (enemies/upper.js faceLife closes them to 1)

// skin, hair and brow for a face, picked per bake (the bake id carries the index, enemies/mesh.js)
export const FACES = [
  { skin: 0x9c7a62, hair: 0x2a2018, style: 'crop' },
  { skin: 0x6e4a36, hair: 0x140e0a, style: 'buzz' },
  { skin: 0xc49a7c, hair: 0x5a4026, style: 'part' },
  { skin: 0x4a3226, hair: 0x0e0a08, style: 'buzz' },
  { skin: 0xb88a6a, hair: 0x8a6a42, style: 'crop' },
];
// clones all wear the same face
export const CLONE_FACE = { skin: 0x8a6450, hair: 0x120d0a, style: 'buzz' };

/* a face on head bone `h` (its origin at the neck). o.hair: false under a cap. The lids hang from a 'lids' bone at the
   top of the eyes (scaled down open, to full when they blink) and the chin, lower lip and mouth's dark from a 'jaw'
   bone at the hinge, so both animate inside the baked mesh.
   The saber cast (enemies/saberist.js, data/saber-cast.js) asks for more: o.fem (a narrower jaw and chin, a finer
   nose and brow, lashes), o.style (bald, buzz, crop, part, long, ponytail, bun, topknot, braid), o.beard (stubble,
   goatee, full: 'beard' key), o.marks + o.markStyle (face tattoos: 'tattoo' key), o.scar ('scar' key), o.horns (a horn
   crown: 'horn' key), o.void (a face of shadow) and o.sith (lit Sith eyes, o.eyeC, the 'eye' tag: they flare on a wind-up) */
export function face(k, h, o = {}){
  const f = !!o.fem, jw = f ? 0.86 : 1;
  k.add(loft([{ y:-0.04, w:0.13*jw, d:0.13 }, { y:0.08, w:0.12*jw, d:0.12 }], ngon(8, PI/8)), 'skin', h);   // neck
  k.add(loft([{ y:0.04, w:0.17*jw, d:0.2, z:-0.005 }, { y:0.1, w:0.205*(f ? 0.93 : 1), d:0.232 }, { y:0.18, w:0.218*(f ? 0.96 : 1), d:0.24 }, { y:0.26, w:0.21, d:0.235, z:-0.005 },
              { y:0.31, w:0.17, d:0.2, z:-0.01 }, { y:0.335, w:0.08, d:0.1, z:-0.01 }], SOFT_HEAD), 'skin', h);   // skull
  k.add(loft([{ y:0.02, w:0.15*jw, d:0.1, z:0.052 }, { y:0.09, w:0.17*(f ? 0.92 : 1), d:0.1, z:0.058 }], SOFT_LIMB), 'skin', h);   // upper jaw, cheeks
  // the jaw: chin and lower lip on a hinge just under the ears
  const jaw = k.bone('jaw', h, [0, 0.085, 0.0]);
  k.add(loft([{ y:-0.075, w:0.085*(f ? 0.8 : 1), d:0.07*(f ? 0.9 : 1), z:0.07 }, { y:-0.04, w:0.13*jw, d:0.09, z:0.064 }, { y:-0.005, w:0.15*jw, d:0.1, z:0.058 }], SOFT_LIMB), 'skin', jaw);
  k.add(block(0.05, f ? 0.016 : 0.012, f ? 0.017 : 0.014, 0.4), 'lip', jaw, [0, -0.032, 0.11], [0, 0, 0], NO_INK);   // lower lip
  k.add(block(0.05, 0.03, 0.03, 0.3), 'black', jaw, [0, -0.012, 0.085], [0, 0, 0], NO_INK);   // the dark of the mouth (shows as it opens)
  k.add(block(0.054, f ? 0.011 : 0.008, 0.012, 0.3), 'lip', h, [0, 0.062, 0.113], [0, 0, 0], NO_INK);    // upper lip
  if (o.fine) nose(k, h, f);
  else k.add(shard(f ? 0.028 : 0.034, f ? 0.06 : 0.07, f ? 0.027 : 0.032), 'skin', h, [0, 0.1, 0.12], [0.2, 0, 0], NO_INK);           // nose
  const lids = k.bone('lids', h, [0, 0.157, 0]);
  for (const s of [-1, 1]){
    k.add(block(0.025, 0.06, 0.045, 0.45), 'skin', h, [0.11*s*(f ? 0.97 : 1), 0.13, -0.005], [0, 0.2*s, 0]);   // ears
    if (o.fine && !o.void) fineEye(k, h, lids, s, f, o.sith);
    else {
      k.add(block(0.05, 0.03, 0.02, 0.4), 'black', h, [0.045*s, 0.145, 0.107], [0, 0, 0], NO_INK);   // socket shadow
      if (!o.void){
        k.add(block(0.032, 0.016, 0.012, 0.4), 'eyew', h, [0.045*s, 0.143, 0.115], [0, 0, 0], NO_INK);
        k.add(block(0.013, 0.014, 0.01, 0.3), 'black', h, [0.045*s, 0.143, 0.121], [0, 0, 0], NO_INK);   // pupil
      }
      k.add(block(0.04, 0.022, 0.012, 0.4), 'skin', lids, [0.045*s, -0.011, 0.12], [0, 0, 0], NO_INK);   // lid
      if (f) k.add(block(0.042, 0.006, 0.014, 0.3), 'black', lids, [0.046*s, -0.021, 0.121], [0, 0, -0.1*s], NO_INK);   // lashes, on the lid's edge
    }
    if (o.fine && f){   // an arched brow: rising, then falling away to the temple
      k.add(block(0.03, 0.009, 0.014, 0.3), 'hair', h, [0.036*s, 0.176, 0.119], [0, 0, 0.18*s], NO_INK);
      k.add(block(0.026, 0.008, 0.014, 0.3), 'hair', h, [0.063*s, 0.177, 0.113], [0, 0.3*s, -0.35*s], NO_INK);
    } else k.add(block(0.052, f ? 0.008 : o.fine ? 0.015 : 0.012, 0.015, 0.3), 'hair', h, [0.047*s, f ? 0.176 : 0.172, 0.115], [0, 0, (f ? -0.2 : -0.12)*s], NO_INK);   // brow
    k.add(block(0.04, 0.02, 0.025, 0.45), 'skin', h, [0.066*s, 0.112, 0.092], [0, 0.5*s, 0], NO_INK);   // cheekbone
  }
  if (o.sith){
    // SITH EYES: gold irises that burn (unlit), on one live group so a wind-up swells them like a visor (enemies/ai.js)
    const eyes = k.live(new THREE.Group(), h, 'eye');
    for (const s of [-1, 1]){
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.void ? 0.03 : 0.016, o.void ? 0.012 : 0.013, 0.004), new THREE.MeshBasicMaterial({ color: o.eyeC ?? 0xffb21c, toneMapped: false }));
      m.position.set(0.045*s, 0.143, o.void ? 0.118 : o.fine ? 0.1242 : 0.1235); eyes.add(m);
    }
  }
  if (o.scar) k.add(block(0.008, 0.075, 0.006, 0.3), 'scar', h, [-0.047, 0.15, 0.121], [0, 0, 0.18], NO_INK);   // a pale line through the brow and down the cheek
  if (o.marks) tattoo(k, h, o.markStyle || 'bars');
  if (o.horns) for (const [x, y, z, r] of [[0, 0.335, 0.05, 0], [0.06, 0.32, 0.03, -0.35], [-0.06, 0.32, 0.03, 0.35], [0.1, 0.27, 0.0, -0.8], [-0.1, 0.27, 0.0, 0.8], [0.03, 0.3, -0.07, -0.3], [-0.03, 0.3, -0.07, 0.3]])
    k.add(shard(0.022, 0.05, 0.022), 'horn', h, [x, y, z], [-0.2, 0, r]);
  if (o.beard) beard(k, h, jaw, o.beard);
  if (o.hair === false) return;
  hairdo(k, h, o.style || 'crop');
}

/* THE FINE FACE (o.fine: the saber cast, seen close in duel entrances): an almond eye with a coloured iris ('iris')
   in a soft socket shade ('socket', not a black box), a lash line over it, and a nose with a bridge, a tip and wings */
function fineEye(k, h, lids, s, f, sith){
  const x = 0.045*s;
  k.add(block(0.054, 0.034, 0.02, 0.45), 'socket', h, [x, 0.146, 0.106], [0, 0, 0], NO_INK);   // the socket's shade
  k.add(block(0.037, 0.018, 0.008, 0.45), 'eyew', h, [x, 0.143, 0.118], [0, 0.18*s, 0], NO_INK);   // the white, turned with the face's curve
  if (!sith) k.add(block(0.017, 0.017, 0.004, 0.3), 'iris', h, [x - 0.002*s, 0.143, 0.1225], [0, 0, 0], NO_INK);
  k.add(block(0.0075, 0.0085, 0.004, 0.2), 'black', h, [x - 0.002*s, 0.143, 0.1245], [0, 0, 0], NO_INK);   // pupil
  k.add(block(0.04, f ? 0.0065 : 0.0045, 0.01, 0.3), 'black', h, [x, 0.1525, 0.121], [0, 0.18*s, f ? -0.12*s : 0], NO_INK);   // lash line
  if (f) k.add(block(0.01, 0.004, 0.008, 0.2), 'black', h, [x + 0.022*s, 0.155, 0.117], [0, 0.3*s, 0.5*s], NO_INK);   // its flick
  k.add(block(0.045, 0.024, 0.012, 0.4), 'skin', lids, [x, -0.011, 0.123], [0, 0.18*s, 0], NO_INK);   // lid (covers it all when it blinks)
  k.add(block(0.032, 0.005, 0.008, 0.3), 'socket', h, [x, 0.131, 0.119], [0, 0.18*s, 0], NO_INK);   // the crease under the eye
}
function nose(k, h, f){
  const n = f ? 0.85 : 1;
  k.add(loft([{ y:0, w:0.02*n, d:0.02, z:0.0 }, { y:0.055, w:0.016*n, d:0.014, z:-0.012 }], SOFT_LIMB), 'skin', h, [0, 0.1, 0.127], [0, 0, 0], NO_INK);   // bridge
  k.add(loft([{ y:-0.014, w:0.028*n, d:0.024 }, { y:0.004, w:0.034*n, d:0.03 }, { y:0.016, w:0.022*n, d:0.022 }], SOFT_LIMB), 'skin', h, [0, 0.094, 0.13], [0, 0, 0], NO_INK);   // tip
  for (const s of [-1, 1]) k.add(block(0.014*n, 0.014, 0.018, 0.45), 'skin', h, [0.018*s*n, 0.088, 0.123], [0, 0.4*s, 0], NO_INK);   // wings
  k.add(block(0.022*n, 0.004, 0.01, 0.2), 'socket', h, [0, 0.081, 0.128], [0, 0, 0], NO_INK);   // the shadow under it
}

// the hair over the crown: a skull-hugging cap (buzz) or a fuller one (crop), and what hangs from it
function hairdo(k, h, style){
  if (style === 'bald') return;
  if (style === 'buzz'){
    k.add(loft([{ y:0.16, w:0.222, d:0.214, z:-0.03 }, { y:0.22, w:0.224, d:0.246, z:-0.012 }, { y:0.27, w:0.214, d:0.244, z:-0.008 },
                { y:0.315, w:0.175, d:0.205, z:-0.01 }, { y:0.34, w:0.085, d:0.105, z:-0.01 }], SOFT_HEAD), 'hair', h, [0, 0, 0], [0, 0, 0], NO_INK);
    return;
  }
  k.add(loft([{ y:0.15, w:0.226, d:0.2, z:-0.04 }, { y:0.21, w:0.232, d:0.25, z:-0.015 }, { y:0.27, w:0.226, d:0.254, z:-0.006 },
              { y:0.32, w:0.188, d:0.22, z:-0.01 }, { y:0.355, w:0.09, d:0.12, z:-0.012 }], SOFT_HEAD), 'hair', h);
  if (style === 'part') k.add(block(0.09, 0.03, 0.12, 0.45), 'hair', h, [0.04, 0.33, 0.04], [0.15, 0, -0.2]);   // a swept fringe
  if (style === 'long'){
    // a fall to the shoulders behind, and a lock down each side in front of the ears
    k.add(loft([{ y:-0.14, w:0.19, d:0.05, z:-0.1 }, { y:0.0, w:0.23, d:0.1, z:-0.09 }, { y:0.16, w:0.24, d:0.15, z:-0.07 }], SOFT_LIMB), 'hair', h);
    for (const s of [-1, 1]) k.add(loft([{ y:-0.02, w:0.03, d:0.07, z:0.0 }, { y:0.2, w:0.04, d:0.12, z:-0.01 }], SOFT_LIMB), 'hair', h, [0.112*s, 0, 0]);
  }
  if (style === 'ponytail' || style === 'braid'){
    // tied at the back of the crown, the tail hanging down the back of the neck (a braid in links, longer)
    k.add(loft([{ y:-0.025, w:0.045, d:0.045 }, { y:0.025, w:0.05, d:0.05 }], ngon(8, PI/8)), 'black', h, [0, 0.25, -0.125], [-1.1, 0, 0], NO_INK);   // the tie
    if (style === 'ponytail') k.add(loft([{ y:-0.3, w:0.03, d:0.03 }, { y:-0.18, w:0.07, d:0.06 }, { y:-0.04, w:0.08, d:0.07 }, { y:0.02, w:0.06, d:0.06 }], SOFT_LIMB), 'hair', h, [0, 0.25, -0.15], [0.32, 0, 0]);
    else for (let i = 0; i < 8; i++) k.add(block(0.05 - i*0.003, 0.055, 0.045, 0.45), 'hair', h, [0, 0.21 - i*0.05, -0.155 - i*0.012], [0.2 + 0.15*(i % 2 ? 1 : -1), 0, 0]);
  }
  if (style === 'bun') k.add(loft([{ y:-0.05, w:0.06, d:0.06 }, { y:-0.01, w:0.1, d:0.1 }, { y:0.04, w:0.09, d:0.09 }, { y:0.065, w:0.04, d:0.04 }], SOFT_HEAD), 'hair', h, [0, 0.27, -0.13], [-1.0, 0, 0]);
  if (style === 'topknot') k.add(loft([{ y:-0.03, w:0.06, d:0.06 }, { y:0.02, w:0.085, d:0.085 }, { y:0.06, w:0.07, d:0.07 }, { y:0.08, w:0.03, d:0.03 }], SOFT_HEAD), 'hair', h, [0, 0.36, -0.03]);
}

// a beard on the jaw (it moves as the jaw talks) and a moustache on the lip
function beard(k, h, jaw, kind){
  if (kind === 'stubble'){
    k.add(loft([{ y:-0.08, w:0.09, d:0.075, z:0.07 }, { y:-0.04, w:0.136, d:0.095, z:0.064 }, { y:0.0, w:0.156, d:0.104, z:0.058 }], SOFT_LIMB), 'stubble', jaw, [0, 0, 0], [0, 0, 0], NO_INK);
    return;
  }
  if (kind === 'full'){
    // under the lower lip and round the chin, and up the jaw on each side to the ears: the mouth stays clear
    k.add(loft([{ y:-0.14, w:0.07, d:0.06, z:0.075 }, { y:-0.1, w:0.14, d:0.1, z:0.07 }, { y:-0.05, w:0.155, d:0.105, z:0.063 }], SOFT_LIMB), 'beard', jaw);
    for (const s of [-1, 1]) k.add(block(0.022, 0.1, 0.09, 0.45), 'beard', jaw, [0.074*s, 0.0, 0.05], [0, 0.25*s, 0], NO_INK);
  }
  else k.add(loft([{ y:-0.11, w:0.04, d:0.04, z:0.09 }, { y:-0.06, w:0.07, d:0.06, z:0.09 }, { y:-0.03, w:0.07, d:0.05, z:0.092 }], SOFT_LIMB), 'beard', jaw);   // goatee
  k.add(block(0.075, 0.018, 0.02, 0.45), 'beard', h, [0, 0.074, 0.112], [0, 0, 0], NO_INK);   // moustache
  for (const s of [-1, 1]) k.add(block(0.016, 0.04, 0.018, 0.45), 'beard', h, [0.038*s, 0.05, 0.108], [0, 0, 0.15*s], NO_INK);
}

// face tattoos, pressed onto the skin: bars (across the brow and chin), diamonds (under each eye), lines (down the face)
function tattoo(k, h, style){
  const at = (w, hh, p, r = [0, 0, 0]) => k.add(block(w, hh, 0.006, 0.2), 'tattoo', h, p, r, NO_INK);
  if (style === 'diamonds') for (const s of [-1, 1]){
    at(0.016, 0.016, [0.046*s, 0.118, 0.115], [0, 0, PI/4]);
    at(0.011, 0.011, [0.06*s, 0.097, 0.107], [0, 0, PI/4]);
  }
  else if (style === 'lines') for (const x of [-0.06, -0.03, 0, 0.03, 0.06]) at(0.009, 0.06, [x, 0.215, 0.112 - Math.abs(x) * 0.45]);
  else { at(0.12, 0.012, [0, 0.2, 0.112]); at(0.04, 0.01, [0, 0.022, 0.116]); for (const s of [-1, 1]) at(0.03, 0.01, [0.072*s, 0.1, 0.1], [0, 0.5*s, 0]); }
}

/* ---------------- plate layering ---------------- */

// a domed rivet head, flat against the plate (+z out of the plate)
let _rivet = null;
const rivetGeo = () => _rivet || (_rivet = loft([{ y:0, w:0.024, d:0.024 }, { y:0.006, w:0.02, d:0.02 }, { y:0.011, w:0.009, d:0.009 }], ngon(6)).rotateX(PI/2));
export function rivets(k, parent, pts, r = [0, 0, 0], key = 'metal'){
  for (const p of pts) k.add(rivetGeo(), key, parent, p, r, NO_INK);
}

/* the cuirass detail every armoured trooper shares: rivets at the chest plate's corners and the thigh plates', and dark
   gap lines down the chest's flanks, so the plate reads as one piece laid over the suit beside its side plates */
export function chestDetail(k, w){
  rivets(k, k.root, [[0.13*w, 1.76, 0.18], [-0.13*w, 1.76, 0.18], [0.12*w, 1.42, 0.168], [-0.12*w, 1.42, 0.168]]);
  for (const s of [-1, 1]) k.add(block(0.012, 0.3, 0.012, 0.3), 'black', k.root, [0.235*w*s, 1.6, 0.152], [0, 0.62*s, 0], NO_INK);   // flank gaps
}
export function thighDetail(k, L, w){
  rivets(k, L.thigh, [[0.062*w, -0.06, 0.122], [-0.062*w, -0.06, 0.122]], [-0.06, 0, 0]);
}

/* a rolled rim round each pauldron's lower edge, in the darker plate: the plate gets a thickness and a seam where it
   meets the arm (sizes and placement match enemies/mesh.js pauldrons) */
export function pauldronRims(k, w, size = 1){
  const W = 0.24 * w * size, D = 0.24 * size;
  for (const s of [-1, 1]){
    k.add(loft([{ y:-0.092, w:W*1.05, d:D*1.05 }, { y:-0.07, w:W*1.04, d:D*1.04 }], SOFT), 'armor2', k.root, [0.39*w*s, 1.8, 0], [0, 0, -0.32*s]);
    rivets(k, k.group(k.root, [0.39*w*s, 1.8, 0], [0, 0, -0.32*s]), [[0, 0.0, D*0.5]], [0, 0, 0]);
  }
}

/* ---------------- decals ---------------- */

// the Imperial roundel on the left pauldron's outer face: a dark disc, a ring of the plate's trim, six spokes
export function shoulderBadge(k, w, size = 1, ring = 'armor2'){
  const pg = k.group(k.root, [-0.39*w, 1.8, 0], [0, 0, 0.32]);
  const at = k.group(pg, [-0.124*w*size, -0.035, 0.0], [0, -PI/2, 0]);
  const disc = n => ngon(n).map(([x, y]) => [x, y]);
  k.add(plate(disc(12).map(([x, y]) => [x * 0.05 * size, y * 0.05 * size]), 0.006, 0), 'black', at, [0, 0, 0], [0, 0, 0], NO_INK);
  k.add(plate(disc(6).map(([x, y]) => [x * 0.03 * size, y * 0.03 * size]), 0.008, 0), ring, at, [0, 0, 0.002], [0, 0, 0], NO_INK);
  k.add(plate(disc(6).map(([x, y]) => [x * 0.014 * size, y * 0.014 * size]), 0.01, 0), 'black', at, [0, 0, 0.003], [0, 0, 0], NO_INK);
}
// a brute's hazard chevrons across the front of its raised collar (rank paint)
export function hazard(k, y = 1.86, z = 0.205){
  for (let i = -2; i <= 2; i++) k.add(block(0.035, 0.1, 0.012, 0.2), i % 2 ? 'black' : 'mark', k.root, [i * 0.05, y, z], [0, 0, 0.6], NO_INK);
}
// tally bars stencilled on the backpack
export function packTallies(k, w, n = 3, y = 1.66, z = -0.312){
  for (let i = 0; i < n; i++) k.add(block(0.012, 0.07, 0.006, 0.2), 'black', k.root, [-0.1*w + i * 0.026, y, z], [0, 0, 0], NO_INK);
  k.add(block(0.1, 0.012, 0.006, 0.2), 'black', k.root, [-0.1*w + 0.026, y, z - 0.002], [0, 0, 0.5], NO_INK);
}

/* ---------------- gear that moves ---------------- */

/* the belt's kit, each piece on a bone of its own at the belt (enemies/upper.js gearSwing bounces and lags them):
   gearL a pouch (or, bare-headed, the helmet clipped there), gearR a pouch or a holstered sidearm, gearB a canteen
   at the small of the back. o.holster puts the sidearm on the right; o.helmet(g) hangs a helmet on the left */
export function belt(k, w, o = {}){
  const L = k.bone('gearL', k.root, [-0.21*w, 1.04, 0.1]), R = k.bone('gearR', k.root, [0.22*w, 1.04, 0.07]);
  const B = k.bone('gearB', k.root, [0.1*w, 1.03, -0.16]);
  const pouch = (b, s) => {
    k.add(block(0.085, 0.1, 0.07, 0.3), 'black', b, [0, -0.04, 0.012], [0, 0.3*s, 0], NO_INK);
    k.add(block(0.09, 0.03, 0.075, 0.3), 'leather', b, [0, 0.005, 0.014], [0, 0.3*s, 0], NO_INK);   // its flap
  };
  if (o.helmet){
    const hg = k.group(L, [-0.06, -0.15, 0.03], [0.25, -0.9, 0.2]);
    hg.scale.setScalar(0.92);
    k.add(block(0.03, 0.08, 0.02, 0.3), 'leather', L, [0, -0.03, 0.02], [0, 0, 0], NO_INK);   // the clip strap
    o.helmet(hg);
  } else pouch(L, -1);
  if (o.holster){
    // a drop holster on the thigh line: leather sleeve, the sidearm's grip out the top
    k.add(block(0.07, 0.17, 0.085, 0.3), 'leather', R, [0.02, -0.11, 0.0], [0.08, 0.15, -0.06]);
    k.add(block(0.045, 0.08, 0.06, 0.3), 'gun', R, [0.022, 0.0, -0.016], [-0.3, 0.15, -0.06], NO_INK);
    k.add(block(0.03, 0.03, 0.09, 0.3), 'leather', R, [0.02, -0.21, 0.0], [0, 0.15, 0], NO_INK);   // the thigh tie
  } else pouch(R, 1);
  k.add(loft([{ y:-0.12, w:0.075, d:0.06 }, { y:0.0, w:0.085, d:0.07 }, { y:0.025, w:0.04, d:0.04 }], ngon(8, PI/8)), 'metal', B, [0, -0.04, -0.02]);   // canteen
  k.add(block(0.012, 0.06, 0.012, 0.3), 'leather', B, [0, 0.01, -0.02], [0, 0, 0], NO_INK);
}

/* a strap between two points (body space), on the given parent: a rifle sling, a bandolier run */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function strap(k, key, a, b, width = 0.035, thick = 0.012, parent = k.root){
  _a.set(...a); _b.set(...b);
  const len = _a.distanceTo(_b), mid = _a.clone().add(_b).multiplyScalar(0.5);
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _b.sub(_a).normalize());
  _e.setFromQuaternion(_q);
  k.add(block(width, len, thick, 0.25), key, parent, mid.toArray(), [_e.x, _e.y, _e.z], NO_INK);
}
// the rifle sling of a trooper holding the E-11 at the ready (enemies/mesh.js rifle, short): from the gun's grip, up
// the chest and over the left shoulder
export function rifleSling(k, w){
  strap(k, 'leather', [0.24, 1.38, 0.22], [0.04, 1.56, 0.24]);
  strap(k, 'leather', [0.04, 1.56, 0.24], [-0.21*w, 1.86, 0.15]);
}
