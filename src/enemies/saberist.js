// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SABER CAST, built: a lightsaber wielder dressed as a person rather than a trooper (data/saber-cast.js has the
// looks). It keeps every hook the Sith acolyte's body has (the skinned legs and chest, the weapon arm and its blade,
// the off arm a cut can sever, the cape, a face that blinks and talks), so it fights, animates and syncs exactly as
// an acolyte does; only the clothes, the build and the head change.
//
//   build   'f' narrows the shoulders and waist, shapes the chest and stands a little shorter; 'm' is the acolyte's frame
//   side    the Jedi in undyed cream and brown with a tabard and a wide belt; the Sith and Inquisitors in black and
//           charcoal with red piping (an Inquisitor adds plates); the gate's Echo in violet shadow
//   head    a face (enemies/detail.js face), under a raised hood, a rebreather or the Inquisitor's full helm
//
// mesh.js hands in its body-kit functions (H), so this file adds no import cycle.

import * as THREE from 'three';
import { loft, limb, plate, block, chamfer, ngon, KEEL } from '../player/model/shapes.js';
import { rounded } from '../player/model/skin.js';
import { face } from './detail.js';
import { lookColors } from '../data/saber-cast.js';

const PI = Math.PI;
const NO_INK = { outline: false };
const SOFT = rounded(chamfer(0.42)), SOFT_LIMB = rounded(chamfer(0.4)), SOFT_BODY = rounded(chamfer(0.3));

// the bake's colours for a look: cloth on the 'armor' keys (no metal sheen), the face's own
export function lookPalette(L){
  const C = lookColors(L), F = L.face || {};
  const cloth = c => ({ c, r: 0.92, m: 0.04 });
  return {
    armor: L.side === 'inq' ? { c: C.tunic, r: 0.7, m: 0.18 } : cloth(C.tunic), armor2: L.side === 'inq' ? { c: C.tabard, r: 0.45, m: 0.55 } : cloth(C.tabard),
    suit: C.under, cloth: C.cloak, leather: C.belt, trim: C.trim, glove: C.glove, boot: C.boot ?? C.belt,
    skin: F.skin, hair: F.hair, beard: F.beardC ?? F.hair, stubble: F.beardC ?? F.hair, lip: F.lip ?? 0x7a4a3c,
    tattoo: F.marks ?? 0x1a1414, horn: F.horns ?? 0xd8c8a8, scar: F.skin != null ? new THREE.Color(F.skin).lerp(new THREE.Color(0xffffff), 0.35).getHex() : 0xd8b4a0,
  };
}

/* the figure (ground at y 0, facing +z, the weapon arm from the +x shoulder as every trooper's) */
export function buildSaberist(k, t, L, H){
  const f = L.build === 'f', w = (f ? 0.86 : 0.98) * (L.w || 1), hw = f ? 0.98 : 1;   // shoulders · hips
  const inq = L.side === 'inq', jedi = L.side === 'jedi';
  k.sleeve = 'armor';   // the arms are sleeves (mesh.js arm)
  legs(k, hw, jedi, H.legBones);
  hipsAndSkirt(k, hw, L);
  k = H.upper(k);
  chest(k, w, f, L);
  if (L.cloak){
    H.cape(k, [[-0.3*w,0],[0.3*w,0],[0.4*w,-1.5],[0.14,-1.62],[-0.14,-1.62],[-0.4*w,-1.5]], [0, 1.86, -0.2], 0.07);
    // the cloak's fall over the shoulders, and the hood lying back below the collar
    k.add(loft([{ y:1.7, w:0.6*w, d:0.2, z:-0.1 }, { y:1.84, w:0.5*w, d:0.18, z:-0.11 }, { y:1.9, w:0.3, d:0.12, z:-0.12 }], SOFT), 'cloth');
    if (!L.hood && L.mask !== 'helm') k.add(loft([{ y:-0.1, w:0.3, d:0.1, z:-0.03 }, { y:0.0, w:0.34, d:0.14, z:-0.02 }, { y:0.06, w:0.26, d:0.1, z:-0.02 }], ngon(10)), 'cloth', k.root, [0, 1.9, -0.17], [-0.25, 0, 0]);
  }
  if (inq) inqPlates(k, w);
  if (L.armour === 'general') generalPlates(k, w);
  H.sideArm(k, w, -1, [-0.3, 0, 0.12], { bend: -0.5 });
  H.weaponArm(k, t, w);
  head(k, t, L, f, H);
}

// trousers into tall boots; the Jedi's boots a shade lighter than the Sith's
function legs(k, w, jedi, legBones){
  for (const s of [-1, 1]){
    const L = legBones(k, 0.16 * s);
    k.add(limb(0.5, [[-0.04,0.2*w,0.21],[0.2,0.19*w,0.2],[0.8,0.15*w,0.155],[1,0.14*w,0.145]], KEEL), 'suit', L.thigh);
    k.add(limb(0.38, [[0,0.15*w,0.16],[0.12,0.16*w,0.17],[0.85,0.13*w,0.14],[1,0.125*w,0.135]], KEEL), 'boot', L.shin, [0, 0, 0.005]);
    k.add(loft([{ y:-0.03, w:0.165*w, d:0.175 }, { y:0.02, w:0.17*w, d:0.18 }], SOFT_LIMB), jedi ? 'leather' : 'boot', L.shin, [0, -0.01, 0.005]);   // the boot's cuff
    k.add(plate([[-0.075,0.035],[-0.09,-0.075],[0.16,-0.085],[0.21,-0.05],[0.1,0.0],[0.03,0.04]].map(([x, y]) => [x * 1.12, y * 1.12]), 0.13*w, 0.014), 'boot', L.foot, [0, 0, 0], [0, -PI/2, 0]);
  }
}

// the hips, a wide belt and sash, and the tunic's skirts front and back (a Jedi's tabard runs down over them)
function hipsAndSkirt(k, w, L){
  k.add(loft([{ y:0.84, w:0.38*w, d:0.26 }, { y:0.98, w:0.44*w, d:0.29 }, { y:1.08, w:0.4*w, d:0.27 }], SOFT_BODY), 'suit');
  k.add(loft([{ y:0.98, w:0.47*w, d:0.31 }, { y:1.12, w:0.45*w, d:0.3 }], SOFT_BODY), 'armor');   // the tunic's hem over the hips
  k.add(loft([{ y:1.04, w:0.49*w, d:0.325 }, { y:1.11, w:0.485*w, d:0.322 }], SOFT_BODY), 'trim', k.root, [0,0,0], [0,0,0], NO_INK);   // sash
  k.add(loft([{ y:1.0, w:0.5*w, d:0.33 }, { y:1.05, w:0.5*w, d:0.33 }], SOFT_BODY), 'leather', k.root, [0,0,0], [0,0,0], NO_INK);       // belt
  k.add(block(0.07, 0.05, 0.02, 0.3), 'metal', k.root, [0, 1.025, 0.17], [0,0,0], NO_INK);   // buckle
  for (const x of [-0.17, 0.2]) k.add(block(0.06, 0.07, 0.04, 0.35), 'leather', k.root, [x*w, 1.0, 0.13], [0, x < 0 ? -0.4 : 0.4, 0], NO_INK);   // pouches
  // the skirts: long for the Jedi and the Sith, short under an Inquisitor's armour
  const len = L.side === 'inq' ? 0.36 : 0.5;
  for (const [z, r] of [[0.16, -0.08], [-0.16, 0.08]]){
    k.add(plate([[-0.22*w,0],[0.22*w,0],[0.26*w,-len],[-0.26*w,-len]], 0.014, 0.004), 'armor', k.root, [0, 1.02, z], [r, 0, 0], NO_INK);
    if (L.side === 'jedi') k.add(plate([[-0.09,0],[0.09,0],[0.1,-len - 0.04],[-0.1,-len - 0.04]], 0.016, 0.004), 'armor2', k.root, [0, 1.02, z * 1.07], [r, 0, 0], NO_INK);
  }
}

// the torso: the tunic, shaped by the build; crossed lapels (the Jedi's tabard over both shoulders)
function chest(k, w, f, L){
  const b = f ? 1.05 : 1;   // the chest stands out a touch on a woman's frame; the waist pulls in
  k.add(loft([{ y:1.07, w:0.36*w*(f ? 0.9 : 1), d:0.24 }, { y:1.28, w:0.38*w*(f ? 0.88 : 1), d:0.25 }], SOFT_BODY), 'armor');
  k.add(loft([{ y:1.26, w:0.4*w*(f ? 0.9 : 1), d:0.27 }, { y:1.44, w:0.56*w, d:0.33*b, z:0.01*b }, { y:1.58, w:0.62*w, d:0.35*b, z:0.015*b }, { y:1.72, w:0.64*w, d:0.34 },
              { y:1.82, w:0.5*w, d:0.29 }, { y:1.9, w:0.28, d:0.21 }], SOFT_BODY), 'armor');
  k.add(loft([{ y:1.84, w:0.25, d:0.2 }, { y:1.97, w:0.18, d:0.16 }], SOFT), 'armor2');   // the high collar
  // the lapels: two bands from each shoulder, crossing at the belt (the Jedi's tabard, the Sith's dark wrap)
  for (const s of [-1, 1]){
    const p = [[-0.035,0],[0.035,0],[0.035,-0.62],[-0.035,-0.62]];
    k.add(plate(p, 0.012, 0.003), 'armor2', k.root, [0.11*w*s, 1.88, 0.15*b], [-0.16*b, 0, -0.2*s], NO_INK);
    k.add(plate(p, 0.012, 0.003), 'armor2', k.root, [0.11*w*s, 1.88, -0.15], [0.12, 0, -0.2*s], NO_INK);
    // the shoulder's roll of cloth (no pauldron)
    k.add(loft([{ y:-0.06, w:0.2*w, d:0.22 }, { y:0.03, w:0.19*w, d:0.21 }, { y:0.08, w:0.13*w, d:0.15 }], SOFT), 'armor', k.root, [0.39*w*s, 1.76, 0], [0, 0, -0.32*s]);
  }
  if (L.side !== 'jedi') k.add(plate([[-0.012,0],[0.012,0],[0.012,-0.62],[-0.012,-0.62]], 0.006, 0.002), 'trim', k.root, [0, 1.86, 0.17*b + 0.005], [-0.1, 0, 0], NO_INK);   // red piping down the front
}

// AN INQUISITOR's armour: dark plates over the robe, ribbed pauldrons with red edges, a chest plate with its sigil
function inqPlates(k, w){
  for (const s of [-1, 1]){
    k.add(loft([{ y:-0.08, w:0.25*w, d:0.25 }, { y:0.02, w:0.25*w, d:0.25 }, { y:0.07, w:0.2*w, d:0.21 }, { y:0.1, w:0.12*w, d:0.13 }], SOFT), 'armor2', k.root, [0.4*w*s, 1.8, 0], [0, 0, -0.34*s]);
    k.add(loft([{ y:-0.09, w:0.255*w, d:0.255 }, { y:-0.07, w:0.255*w, d:0.255 }], SOFT), 'trim', k.root, [0.4*w*s, 1.8, 0], [0, 0, -0.34*s], NO_INK);
  }
  k.add(loft([{ y:1.48, w:0.5*w, d:0.06, z:0.15 }, { y:1.62, w:0.56*w, d:0.07, z:0.165 }, { y:1.78, w:0.48*w, d:0.06, z:0.15 }], SOFT), 'armor2');   // breastplate
  k.add(plate([[0,0.05],[0.05,0],[0,-0.05],[-0.05,0]], 0.01, 0.003), 'trim', k.root, [0, 1.63, 0.205], [0,0,0], NO_INK);   // its sigil
  for (const s of [-1, 1]) k.add(plate([[-0.06,0],[0.06,0],[0.05,-0.2],[-0.05,-0.2]], 0.02, 0.005), 'armor2', k.root, [0.13*s, 0.98, 0.18], [-0.05, 0, 0]);   // tassets
}

// A JEDI GENERAL in the field: a dull breastplate over the tunic and one plate on the sword shoulder
function generalPlates(k, w){
  k.add(loft([{ y:1.46, w:0.46*w, d:0.06, z:0.15 }, { y:1.6, w:0.52*w, d:0.07, z:0.165 }, { y:1.76, w:0.44*w, d:0.06, z:0.15 }], SOFT), 'steel');
  k.add(loft([{ y:-0.08, w:0.24*w, d:0.24 }, { y:0.03, w:0.23*w, d:0.23 }, { y:0.08, w:0.16*w, d:0.17 }], SOFT), 'steel', k.root, [0.4*w, 1.8, 0], [0, 0, -0.34]);
  k.add(loft([{ y:-0.09, w:0.245*w, d:0.245 }, { y:-0.07, w:0.245*w, d:0.245 }], SOFT), 'trim', k.root, [0.4*w, 1.8, 0], [0, 0, -0.34], NO_INK);
}

/* the head on the neck bone, as the helmets ride it (enemies/upper.js turns it to look): a face, and over it the
   look's hood, rebreather or full helm */
function head(k, t, L, f, H){
  const h = k.bone('head', k.root, [0, 1.96, 0], [0,0,0], H.NECK);
  const F = L.face || {};
  if (L.mask === 'helm'){ inqHelm(k, h, t); return; }
  face(k, h, { ...F, fem: f, hair: L.hood && F.style !== 'bald' ? true : undefined, style: L.hood ? (F.style === 'bald' ? 'bald' : 'buzz') : F.style });
  if (L.mask === 'half') rebreather(k, h);
  if (L.hood) hood(k, h);
}

// a raised hood: the shell over the crown and back, its sides framing the face, a lip of cloth over the brow
function hood(k, h){
  // round, close over the crown and down past the jaw behind the cheeks, its front edge stopping short of the face
  k.add(loft([{ y:-0.08, w:0.3, d:0.25, z:-0.06 }, { y:0.06, w:0.31, d:0.3, z:-0.05 }, { y:0.24, w:0.3, d:0.3, z:-0.04 }, { y:0.36, w:0.24, d:0.27, z:-0.04 },
              { y:0.43, w:0.12, d:0.15, z:-0.05 }], ngon(12)), 'cloth', h);
}

// the Inquisitor's rebreather: a dark plate over the mouth and jaw, red vents, straps to the ears
function rebreather(k, h){
  k.add(loft([{ y:-0.01, w:0.13, d:0.06, z:0.11 }, { y:0.05, w:0.18, d:0.08, z:0.11 }, { y:0.115, w:0.19, d:0.07, z:0.105 }], SOFT_LIMB), 'armor2', h);
  for (const x of [-0.035, 0, 0.035]) k.add(block(0.012, 0.05, 0.01, 0.3), 'trim', h, [x, 0.055, 0.15], [0,0,0], NO_INK);
  for (const s of [-1, 1]) k.add(block(0.01, 0.022, 0.09, 0.3), 'black', h, [0.1*s, 0.1, 0.06], [0, 0.35*s, 0], NO_INK);
}

// the Inquisitor's full helm: a smooth black dome, a narrowed crest, and a red visor cut in a shallow V
function inqHelm(k, h, t){
  k.add(loft([{ y:-0.04, w:0.14, d:0.14 }, { y:0.08, w:0.13, d:0.13 }], ngon(6, PI/6)), 'suit', h);   // neck
  k.add(H_DOME(), 'armor2', h);
  k.add(loft([{ y:-0.04, w:0.2, d:0.08, z:0.13 }, { y:0.14, w:0.25, d:0.08, z:0.15 }], chamfer(0.35)), 'armor2', h);   // the face plate
  k.add(block(0.03, 0.2, 0.3, 0.3), 'armor2', h, [0, 0.38, -0.02]);   // crest
  k.add(block(0.032, 0.18, 0.28, 0.3), 'trim', h, [0, 0.37, -0.02], [0,0,0], NO_INK);
  const eyes = k.live(new THREE.Group(), h, 'eye');
  for (const s of [-1, 1]){
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.012), new THREE.MeshBasicMaterial({ color: t.eye, toneMapped: false }));
    m.position.set(0.055*s, 0.205, 0.192); m.rotation.z = 0.28*s; eyes.add(m);
  }
}
let _dome = null;
const H_DOME = () => _dome || (_dome = loft([{ y:-0.02, w:0.25, d:0.27 }, { y:0.1, w:0.28, d:0.3 }, { y:0.25, w:0.28, d:0.3 }, { y:0.36, w:0.21, d:0.25 }, { y:0.42, w:0.1, d:0.14 }], rounded(chamfer(0.3))));
