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
import { loft, limb, plate, block, chamfer, ngon, hoodRing, cowlDrape, warpGeo, KEEL, shard } from '../player/model/shapes.js';
import { rounded } from '../player/model/skin.js';
import { face, FRAME } from './detail.js';
import { lookColors } from '../data/saber-cast.js';

const PI = Math.PI;
const NO_INK = { outline: false };
const SOFT = rounded(chamfer(0.42)), SOFT_LIMB = rounded(chamfer(0.4)), SOFT_BODY = rounded(chamfer(0.3));
const ROBE = rounded(chamfer(0.46));   // cloth over a body: rounder than any plate

// the bake's colours for a look: cloth on the 'armor' keys (no metal sheen), the face's own
export function lookPalette(L){
  const C = lookColors(L), F = L.face || {};
  const cloth = c => ({ c, r: 0.92, m: 0.04 });
  return {
    armor: L.side === 'inq' ? { c: C.tunic, r: 0.85, m: 0.08 } : cloth(C.tunic), armor2: L.side === 'inq' ? { c: C.tabard, r: 0.55, m: 0.3 } : cloth(C.tabard),
    suit: C.under, cloth: C.cloak, leather: C.belt, trim: C.trim, glove: C.glove, boot: C.boot ?? C.belt,
    skin: F.skin, hair: F.hair, beard: F.beardC ?? F.hair, stubble: F.beardC ?? F.hair, lip: F.lip ?? 0x7a4a3c,
    socket: F.skin != null ? new THREE.Color(F.skin).multiplyScalar(0.72).getHex() : 0x6a4c3a, iris: F.eyes ?? 0x3a2a1c,
    tattoo: F.marks ?? 0x1a1414, horn: F.horns ?? 0xd8c8a8, scar: F.skin != null ? new THREE.Color(F.skin).lerp(new THREE.Color(0xffffff), 0.35).getHex() : 0xd8b4a0,
  };
}

/* the figure (ground at y 0, facing +z, the weapon arm from the +x shoulder as every trooper's) */
export function buildSaberist(k, t, L, H){
  const f = L.build === 'f', w = (f ? 0.86 : 0.98) * (L.w || 1), hw = f ? 0.98 : 1;   // shoulders · hips
  const inq = L.side === 'inq', jedi = L.side === 'jedi';
  // a raised hood comes with the long OUTER ROBE it belongs to (as the hero's: player/model/jedi.js outerRobe): the
  // sleeves, the skirts and an open-fronted body all in the cloak's cloth over the tunic
  const robed = !!(L.hood && L.cloak && !inq);
  k.sleeve = robed ? 'cloth' : 'armor';   // the arms are sleeves (mesh.js arm), belled at the wrist unless armoured
  k.bell = !inq;
  const thighs = legs(k, hw, jedi, H.legBones);
  hipsAndSkirt(k, hw, L, thighs, robed ? 'cloth' : 'armor');
  k = H.upper(k);
  // the tunic and any plate over it in the troopers' FRAME (enemies/detail.js): a fighter's chest, not a barrel. A static
  // group (no bones in it), so it bakes into the chest's mesh
  const kb = (() => { const T = k.group(k.root); T.scale.set(FRAME.chest, 1, FRAME.depth); return k.within(T); })();
  chest(kb, w, f, L);
  if (robed) outerRobe(k, w);
  if (L.cloak){
    // (a Sith lord's cloak is wider and longer, its hem torn into points: lordPlates)
    if (L.armour === 'lord') H.cape(k, LORD_CAPE(w), [0, 1.9, -0.22], 0.07);
    else H.cape(k, [[-0.3*w,0],[0.3*w,0],[0.4*w,-1.5],[0.14,-1.62],[-0.14,-1.62],[-0.4*w,-1.5]], [0, 1.86, -0.2], 0.07);
    // the cloak's fall over the shoulders, and the hood lying back below the collar
    k.add(loft([{ y:1.7, w:0.6*w, d:0.2, z:-0.1 }, { y:1.84, w:0.5*w, d:0.18, z:-0.11 }, { y:1.9, w:0.3, d:0.12, z:-0.12 }], SOFT), 'cloth');
    // over plain shoulders the cloak wraps forward onto them, so it reads from the front too; a clasp and its chain hold it
    if (!inq && !L.mantle && !L.hood){   // (a raised hood's cowl covers the shoulders itself: cowl())
      for (const s of [-1, 1]) k.add(loft([{ y:-0.05, w:0.24*w, d:0.34 }, { y:0.04, w:0.22*w, d:0.32 }, { y:0.09, w:0.14*w, d:0.24 }], ngon(12)), 'cloth', k.root, [0.36*w*s, 1.76, -0.03], [0, 0, -0.42*s]);
      for (const s of [-1, 1]) k.add(loft([{ y:-0.022, w:0.045, d:0.02 }, { y:0.022, w:0.045, d:0.02 }], ngon(10)), 'metal', k.root, [0.15*w*s, 1.8, 0.16], [0.2, 0, 0], NO_INK);
      k.add(block(0.2*w, 0.012, 0.012, 0.3), 'metal', k.root, [0, 1.79, 0.165], [0,0,0], NO_INK);
    }
    if (!L.hood && L.mask !== 'helm') k.add(loft([{ y:-0.1, w:0.3, d:0.1, z:-0.03 }, { y:0.0, w:0.34, d:0.14, z:-0.02 }, { y:0.06, w:0.26, d:0.1, z:-0.02 }], ngon(10)), 'cloth', k.root, [0, 1.9, -0.17], [-0.25, 0, 0]);
  }
  if (L.hood) cowl(k, w);
  if (L.mantle) mantle(k, w, L.mantle);
  if (L.armour === 'inq') inqPlates(kb, w);
  if (L.armour === 'warden') wardenPlates(kb, w);
  if (L.armour === 'general') generalPlates(kb, w);
  if (L.armour === 'lord') lordPlates(kb, w);
  H.sideArm(k, w, -1, [-0.3, 0, 0.12], { bend: -0.5, elbow: 'elbowOff' });   // (its elbow a bone: the free hand takes its form's pose, or the hilt: enemies/foestance.js)
  H.weaponArm(k, t, w);
  head(k, t, L, f, H);
}

// trousers into tall boots; the Jedi's boots a shade lighter than the Sith's
function legs(k, w, jedi, legBones){
  const thighs = [];
  for (const s of [-1, 1]){
    const L = legBones(k, 0.16 * s);
    thighs.push(L.thigh);
    k.add(limb(0.5, [[-0.04,0.2*w,0.21],[0.2,0.19*w,0.2],[0.8,0.15*w,0.155],[1,0.14*w,0.145]], KEEL), 'suit', L.thigh);
    k.add(limb(0.38, [[0,0.15*w,0.16],[0.12,0.16*w,0.17],[0.85,0.13*w,0.14],[1,0.125*w,0.135]], KEEL), 'boot', L.shin, [0, 0, 0.005]);
    k.add(loft([{ y:-0.03, w:0.165*w, d:0.175 }, { y:0.02, w:0.17*w, d:0.18 }], SOFT_LIMB), jedi ? 'leather' : 'boot', L.shin, [0, -0.01, 0.005]);   // the boot's cuff
    k.add(plate([[-0.075,0.035],[-0.09,-0.075],[0.16,-0.085],[0.21,-0.05],[0.1,0.0],[0.03,0.04]].map(([x, y]) => [x * 1.12, y * 1.12]), 0.13*w, 0.014), 'boot', L.foot, [0, 0, 0], [0, -PI/2, 0]);
  }
  return thighs;
}

// the hips, a wide belt and sash, and the tunic's skirts front and back (a Jedi's tabard runs down over them)
function hipsAndSkirt(k, w, L, thighs, skirt = 'armor'){
  k.add(loft([{ y:0.84, w:0.38*w, d:0.26 }, { y:0.98, w:0.44*w, d:0.29 }, { y:1.08, w:0.4*w, d:0.27 }], SOFT_BODY), 'suit');
  k.add(loft([{ y:0.98, w:0.47*w, d:0.31 }, { y:1.12, w:0.45*w, d:0.3 }], SOFT_BODY), 'armor');   // the tunic's hem over the hips
  k.add(loft([{ y:1.04, w:0.49*w, d:0.325 }, { y:1.11, w:0.485*w, d:0.322 }], SOFT_BODY), 'trim', k.root, [0,0,0], [0,0,0], NO_INK);   // sash
  k.add(loft([{ y:1.0, w:0.5*w, d:0.33 }, { y:1.05, w:0.5*w, d:0.33 }], SOFT_BODY), 'leather', k.root, [0,0,0], [0,0,0], NO_INK);       // belt
  k.add(block(0.07, 0.05, 0.02, 0.3), 'metal', k.root, [0, 1.025, 0.17], [0,0,0], NO_INK);   // buckle
  for (const x of [-0.17, 0.2]) k.add(block(0.06, 0.07, 0.04, 0.35), 'leather', k.root, [x*w, 1.0, 0.13], [0, x < 0 ? -0.4 : 0.4, 0], NO_INK);   // pouches
  /* THE ROBE'S SKIRTS. An Inquisitor's are short, under its armour. Otherwise a long robe split up the front: each front
     panel rides its thigh (it swings open with the stride instead of the leg cutting through it) and the back hangs long
     and full. A Jedi's tabard runs down each front panel */
  if (L.side === 'inq'){
    for (const [z, r] of [[0.16, -0.08], [-0.16, 0.08]]) k.add(plate([[-0.22*w,0],[0.22*w,0],[0.26*w,-0.36],[-0.26*w,-0.36]], 0.014, 0.004), 'armor', k.root, [0, 1.02, z], [r, 0, 0], NO_INK);
    return;
  }
  const len = 0.74;
  /* the back: three pleats, the outer two angled forward round the hips, flaring as they fall */
  for (const [x, ry, z] of [[-0.2, 0.5, -0.12], [0, 0, -0.17], [0.2, -0.5, -0.12]]){
    const c = x === 0;
    k.add(plate([[-0.13*w,0],[0.13*w,0],[(c ? 0.16 : 0.19)*w,-len],[0,-len - 0.03],[-(c ? 0.16 : 0.19)*w,-len]], 0.016, 0.004), skirt, k.root, [x*w, 1.03, z], [0.1, ry, 0], NO_INK);
  }
  thighs.forEach((T, i) => {
    const s = i ? 1 : -1;   // (left, then right)
    /* in the thigh's frame (its top at the hip, y 0): a front panel folded once down its length, so it catches the light
       as cloth does, narrow at the waist and flaring to the hem past the knee; a Jedi's tabard runs down it, tapering */
    k.add(plate([[0,0.09],[0.12*s,0.09],[0.15*s,-len + 0.08],[0,-len + 0.05]], 0.014, 0.004), skirt, T, [-0.08*s, 0, 0.14], [-0.06, 0.28*s, 0], NO_INK);
    k.add(plate([[0,0.09],[0.1*s,0.09],[0.12*s,-len + 0.06],[0,-len + 0.05]], 0.014, 0.004), skirt, T, [-0.08*s, 0, 0.14], [-0.06, -0.38*s, 0], NO_INK);
    k.add(plate([[0,0.09],[0.1*s,0.09],[0.12*s,-len + 0.09],[0,-len + 0.08]], 0.014, 0.004), skirt, T, [0.04*s, 0, 0.1], [-0.06, 0.9*s, 0], NO_INK);   // its side, round the leg
    if (L.side === 'jedi') k.add(plate([[-0.05,0.085],[0.05,0.085],[0.036,-len*0.82],[0,-len*0.82 - 0.03],[-0.036,-len*0.82]], 0.016, 0.004), 'armor2', T, [0.0, 0, 0.165], [-0.06, 0, 0], NO_INK);
  });
}

// the torso: the tunic, shaped by the build; crossed lapels (the Jedi's tabard over both shoulders)
function chest(k, w, f, L){
  const b = f ? 1.05 : 1;   // the chest stands out a touch on a woman's frame; the waist pulls in
  k.add(loft([{ y:1.07, w:0.36*w*(f ? 0.9 : 1), d:0.24 }, { y:1.28, w:0.38*w*(f ? 0.86 : 1), d:0.25 }], ROBE), 'armor');
  // the chest rounds over into sloping shoulders (no plate's square shelf)
  k.add(loft([{ y:1.26, w:0.4*w*(f ? 0.88 : 1), d:0.27 }, { y:1.44, w:0.54*w, d:0.32*b, z:0.012*b }, { y:1.58, w:0.6*w, d:0.34*b, z:0.016*b }, { y:1.7, w:0.62*w, d:0.32 },
              { y:1.79, w:0.54*w, d:0.28 }, { y:1.86, w:0.38*w, d:0.23 }, { y:1.92, w:0.24, d:0.19 }], ROBE), 'armor');
  k.add(loft([{ y:1.84, w:0.25, d:0.2 }, { y:1.97, w:0.18, d:0.16 }], SOFT), 'armor2');   // the high collar
  // the lapels: two bands from each shoulder, crossing at the belt (the Jedi's tabard, the Sith's dark wrap)
  for (const s of [-1, 1]){
    const p = [[-0.035,0],[0.035,0],[0.035,-0.62],[-0.035,-0.62]];
    k.add(plate(p, 0.012, 0.003), 'armor2', k.root, [0.11*w*s, 1.88, 0.15*b], [-0.16*b, 0, -0.2*s], NO_INK);
    k.add(plate(p, 0.012, 0.003), 'armor2', k.root, [0.11*w*s, 1.88, -0.15], [0.12, 0, -0.2*s], NO_INK);
    // the shoulder's roll of cloth (no pauldron)
    k.add(loft([{ y:-0.07, w:0.19*w, d:0.2 }, { y:0.01, w:0.19*w, d:0.2 }, { y:0.06, w:0.14*w, d:0.16 }, { y:0.085, w:0.07*w, d:0.09 }], ngon(12)), 'armor', k.root, [(FRAME.shx + 0.01)*w*s / FRAME.chest, 1.74, 0], [0, 0, -0.42*s]);   // (on the FRAME's shoulder line once scaled)
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

// THE WARDEN, the pens' jailer: a lopsided brute. One great stacked pauldron on the off shoulder under a hanging
// half-cape, a high armoured gorget, a chain across the chest and a heavy studded belt; the sword arm bare to the sleeve
function wardenPlates(k, w){
  const P = [-0.42*w, 1.8, 0];
  for (const [i, sc] of [[0, 1.12], [1, 0.95], [2, 0.78]].map(([i, sc]) => [i, sc])){
    const y = P[1] - i * 0.075;
    k.add(loft([{ y:-0.07, w:0.29*w*sc, d:0.29*sc }, { y:0.02, w:0.29*w*sc, d:0.29*sc }, { y:0.07, w:0.22*w*sc, d:0.23*sc }, { y:0.1, w:0.12*w*sc, d:0.13*sc }], SOFT), 'armor2', k.root, [P[0] - i*0.025, y + 0.04, 0], [0, 0, 0.38 + i*0.1]);
    k.add(loft([{ y:-0.08, w:0.295*w*sc, d:0.295*sc }, { y:-0.06, w:0.295*w*sc, d:0.295*sc }], SOFT), 'trim', k.root, [P[0] - i*0.025, y + 0.04, 0], [0, 0, 0.38 + i*0.1], NO_INK);
  }
  // the half-cape, hung from under the pauldron down the off side and back
  k.add(plate([[-0.2,0],[0.2,0],[0.26,-1.05],[0.05,-1.12],[-0.22,-1.0]], 0.02, 0.006), 'cloth', k.root, [-0.36*w, 1.8, -0.05], [0.06, -0.9, 0.08]);
  k.add(loft([{ y:1.74, w:0.34*w, d:0.3 }, { y:1.86, w:0.36, d:0.3 }, { y:2.0, w:0.3, d:0.27 }], ngon(12)), 'armor2');   // gorget
  k.add(loft([{ y:1.48, w:0.48*w, d:0.06, z:0.15 }, { y:1.62, w:0.54*w, d:0.07, z:0.165 }, { y:1.76, w:0.46*w, d:0.06, z:0.15 }], SOFT), 'armor2');   // breastplate
  // the chain: links from the off shoulder down across the chest to the hip
  const link = new THREE.TorusGeometry(0.02, 0.007, 4, 8);
  for (let i = 0; i < 20; i++){
    const u = i / 19;
    k.add(link, 'metal', k.root, [-0.3*w + u * 0.5*w, 1.8 - u * 0.62, 0.235 - u*0.03 + Math.sin(u * PI) * 0.015], [0, i % 2 ? PI/2 : 0, 0.68], NO_INK);
  }
  k.add(loft([{ y:0.99, w:0.53, d:0.35 }, { y:1.09, w:0.53, d:0.35 }], SOFT_BODY), 'leather', k.root, [0,0,0], [0,0,0], NO_INK);   // the heavy belt
  for (const x of [-0.18, -0.09, 0.09, 0.18]) k.add(block(0.03, 0.03, 0.02, 0.4), 'metal', k.root, [x, 1.04, 0.18], [0,0,0], NO_INK);
}

/* A SITH LORD (Darth Vexis, the Jedi's final boss: data/bosses.js VEXIS). The silhouette is the point: a tall flared
   collar standing up behind the hood, broad stacked pauldrons crowned with spikes, a segmented black cuirass with the
   dark side burning through its seams, a long tabard to the shins, and a wide cloak torn into points at the hem. Read
   from across the arena, nothing else on the field has that outline. */
const LORD_CAPE = w => [[-0.36*w,0],[0.36*w,0],[0.52*w,-0.9],[0.6*w,-1.62],[0.46*w,-1.5],[0.38*w,-1.74],[0.22*w,-1.6],[0.1*w,-1.8],
                        [0,-1.64],[-0.12*w,-1.82],[-0.24*w,-1.62],[-0.4*w,-1.76],[-0.48*w,-1.52],[-0.6*w,-1.66],[-0.52*w,-0.9]];
function lordPlates(k, w){
  // the collar: a high flared shell open at the front, standing up behind the head (it reads over the hood)
  k.add(loft([
    ring(1.82, 0.52*w, 0.38, -0.06, 0.5,  0.02, 0.9),
    ring(1.94, 0.5*w,  0.38, -0.09, 0.62, 0.02, 0.88),
    ring(2.06, 0.6*w,  0.42, -0.14, 0.72, 0.02, 0.86),
    ring(2.14, 0.7*w,  0.46, -0.19, 0.78, 0.02, 0.84),
  ], hoodRing(0.5), { capTop: false, capBottom: false }), 'armor2');
  // the pauldrons: two plates stacked on each shoulder, a trim edge, and spikes rising off the crown of each
  for (const s of [-1, 1]){
    for (const [i, sc, dy] of [[0, 1.18, 0.06], [1, 0.98, -0.02]]){
      const P = [0.42*w*s, 1.82 + dy, 0], r = [0, 0, -(0.32 + i*0.16)*s];
      k.add(loft([{ y:-0.08, w:0.3*w*sc, d:0.3*sc }, { y:0.02, w:0.3*w*sc, d:0.3*sc }, { y:0.08, w:0.24*w*sc, d:0.25*sc }, { y:0.11, w:0.13*w*sc, d:0.15*sc }], SOFT), 'armor2', k.root, P, r);
      k.add(loft([{ y:-0.09, w:0.305*w*sc, d:0.305*sc }, { y:-0.07, w:0.305*w*sc, d:0.305*sc }], SOFT), 'trim', k.root, P, r, NO_INK);
    }
    for (const [x, z, h, lean] of [[0.36, 0.06, 0.26, 0.2], [0.46, -0.04, 0.2, 0.42], [0.3, -0.1, 0.17, 0.1]])
      k.add(shard(0.055, h, 0.055), 'metal', k.root, [x*w*s, 1.93, z], [-0.12, 0, -lean*s]);
  }
  // the cuirass: a chest plate and three bands down the stomach, the dark side's light in the seams between them
  k.add(loft([{ y:1.44, w:0.5*w, d:0.06, z:0.15 }, { y:1.6, w:0.58*w, d:0.07, z:0.168 }, { y:1.78, w:0.5*w, d:0.06, z:0.152 }], SOFT), 'armor2');
  for (const [i, y] of [[0, 1.37], [1, 1.28], [2, 1.19]]) k.add(loft([{ y: y - 0.035, w:(0.44 - i*0.02)*w, d:0.05, z:0.15 }, { y: y + 0.035, w:(0.45 - i*0.02)*w, d:0.05, z:0.152 }], SOFT), 'armor2');
  for (const y of [1.415, 1.325, 1.235]) k.glow(new THREE.BoxGeometry(0.36*w, 0.008, 0.006), 0xff2236, k.root, [0, y, 0.18]);
  for (const s of [-1, 1]) k.glow(new THREE.BoxGeometry(0.006, 0.16, 0.006), 0xff2236, k.root, [0.16*w*s, 1.6, 0.21], [0, 0, 0.32*s]);
  k.add(plate([[0,0.045],[0.045,0],[0,-0.06],[-0.045,0]], 0.012, 0.003), 'trim', k.root, [0, 1.63, 0.215], [0,0,0], NO_INK);   // his sigil
  // the long tabard to the shins, front and back, edged in red
  for (const [z, r, len] of [[0.19, -0.07, 0.86], [-0.2, 0.08, 0.92]]){
    k.add(plate([[-0.13*w,0],[0.13*w,0],[0.15*w,-len],[0,-len - 0.06],[-0.15*w,-len]], 0.016, 0.004), 'armor2', k.root, [0, 1.06, z], [r, 0, 0], NO_INK);
    k.add(plate([[-0.012,0],[0.012,0],[0.012,-len + 0.04],[-0.012,-len + 0.04]], 0.006, 0.002), 'trim', k.root, [0, 1.06, z + (z > 0 ? 0.012 : -0.012)], [r, 0, 0], NO_INK);
  }
  // vambraces: a black plate on each forearm's sleeve would ride the arm slot; a heavy belt and its plated buckle instead
  k.add(loft([{ y:0.99, w:0.54*w, d:0.36 }, { y:1.1, w:0.53*w, d:0.355 }], SOFT_BODY), 'leather', k.root, [0,0,0], [0,0,0], NO_INK);
  k.add(block(0.12, 0.09, 0.03, 0.3), 'armor2', k.root, [0, 1.045, 0.185], [0,0,0]);
  k.add(block(0.05, 0.03, 0.012, 0.3), 'trim', k.root, [0, 1.045, 0.203], [0,0,0], NO_INK);
}
/* the Sith lord's mask: a black faceplate over the brow, eyes and nose under the hood, his eyes burning through two
   slits, and the crack the Jedi gave him running down its left side, lit from inside; the scarred jaw shows below */
function lordMask(k, h, t){
  k.add(loft([{ y:0.115, w:0.07, d:0.05, z:0.142 }, { y:0.16, w:0.16, d:0.07, z:0.132 }, { y:0.22, w:0.2, d:0.075, z:0.126 }, { y:0.28, w:0.19, d:0.07, z:0.118 }, { y:0.31, w:0.15, d:0.05, z:0.112 }], chamfer(0.4)), 'armor2', h);
  const eyes = k.live(new THREE.Group(), h, 'eye');
  for (const s of [-1, 1]){
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.014, 0.01), new THREE.MeshBasicMaterial({ color: t.eye, toneMapped: false }));
    m.position.set(0.045*s, 0.218, 0.166); m.rotation.z = -0.26*s; eyes.add(m);
  }
  // the crack: a jagged line of red light from the brow, through the left eye, to the cheek
  const pts = [[-0.02, 0.3], [-0.04, 0.262], [-0.028, 0.235], [-0.06, 0.2], [-0.05, 0.165], [-0.075, 0.135]];
  for (let i = 0; i < pts.length - 1; i++){
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = Math.hypot(bx - ax, by - ay);
    k.glow(new THREE.BoxGeometry(0.006, len, 0.006), 0xff3a2a, h, [(ax + bx) / 2, (ay + by) / 2, 0.165], [0, 0, Math.atan2(ax - bx, by - ay)]);
  }
}

// a short shoulder cape (a mantle) over the robe: a rank-and-file acolyte's, in its cloth colour
function mantle(k, w){
  k.add(loft([{ y:1.48, w:0.7*w, d:0.42, z:-0.02 }, { y:1.62, w:0.72*w, d:0.42, z:-0.01 }, { y:1.76, w:0.66*w, d:0.38 }, { y:1.88, w:0.42*w, d:0.3 }, { y:1.96, w:0.26, d:0.22 }], ngon(14)), 'cloth');
  k.add(loft([{ y:1.47, w:0.705*w, d:0.425, z:-0.02 }, { y:1.5, w:0.705*w, d:0.425, z:-0.02 }], ngon(14)), 'trim', k.root, [0,0,0], [0,0,0], NO_INK);
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
  face(k, h, { ...F, fine: true, fem: f, hair: L.hood && F.style !== 'bald' ? true : undefined, style: L.hood ? (F.style === 'bald' ? 'bald' : 'buzz') : F.style });
  if (L.mask === 'half') rebreather(k, h);
  if (L.mask === 'lord') lordMask(k, h, t);
  if (L.hood) hood(k, h);
}

/* a raised hood, cut like the hero's (player/model/jedi.js): the cloak's own cloth, a C open at the face that rounds
   over the crown to a soft point at the back, and below it (on the body: buildSaberist) the cowl it falls into, over
   the shoulders and down the back. The hood's skirt reaches down inside the cowl's neck, so as the head turns the two
   stay one piece of cloth instead of a cap set on top */
const ring = (y, w, d, z, open, fold, wall) => ({ y, w, d, z, p: hoodRing(open, fold, wall) });
let _hood = null;
const HOOD_GEO = () => _hood || (_hood = loft([
  ring(-0.11, 0.31, 0.3,  -0.035, 0.44, 0.02, 0.87),
  ring(0.03,  0.29, 0.305,-0.03,  0.56, 0.02, 0.86),
  ring(0.13,  0.31, 0.325,-0.03,  0.64, 0.015, 0.86),   // framing the cheeks, clear of the face
  ring(0.23,  0.315,0.335,-0.035, 0.62, 0.015, 0.86),
  ring(0.3,   0.265,0.31, -0.05,  0.52, 0.01, 0.86),
  ring(0.355, 0.19, 0.25, -0.07,  0.38, 0.01, 0.84),
  ring(0.39,  0.09, 0.13, -0.095, 0.22, 0,    0.7),     // the crown, peaked a little to the back
  ring(0.4,   0.02, 0.03, -0.105, 0.2,  0,    0.5),
], hoodRing(0.4), { capTop: false, capBottom: false }));
export function hood(k, h){ k.add(HOOD_GEO(), 'cloth', h); }
// the cowl a raised hood falls into: gathered round the neck, out over the shoulders, its hem dipping down the back
export function cowl(k, w){
  const geo = loft([
    ring(1.76, 0.98*w, 0.52, -0.04, 0.32, 0.05, 0.97),
    ring(1.81, 0.84*w, 0.47, -0.04, 0.32, 0.05, 0.9),
    ring(1.87, 0.56*w, 0.38, -0.045,0.36, 0.04, 0.88),
    ring(1.9,  0.36,   0.32, -0.045,0.44, 0.03, 0.87),
    ring(1.93, 0.33,   0.31, -0.04, 0.5,  0.02, 0.87),
  ], hoodRing(0.3), { capTop: false, capBottom: false });
  k.add(warpGeo(geo, cowlDrape({ neck: 1.9, len: 0.15, zc: -0.04, back: 0.2, front: 0.05, side: 0.02, width: 0.32 })), 'cloth');
}

// the outer robe's body, open down the front over the tunic and running up under the cowl
function outerRobe(k, w){
  k.add(loft([
    ring(1.0,  0.53*w, 0.37, -0.01, 0.72, 0.03, 0.95),
    ring(1.25, 0.49*w, 0.33, -0.01, 0.7,  0.025, 0.9),
    ring(1.45, 0.6*w,  0.37, -0.01, 0.66, 0.02, 0.9),
    ring(1.6,  0.66*w, 0.39, -0.01, 0.62, 0.02, 0.9),
    ring(1.72, 0.68*w, 0.37, -0.015,0.56, 0.02, 0.9),
    ring(1.8,  0.6*w,  0.33, -0.02, 0.5,  0.015,0.9),
    ring(1.87, 0.44*w, 0.28, -0.03, 0.46, 0.01, 0.92),
  ], hoodRing(0.7), { capTop: false, capBottom: false }), 'cloth');
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
