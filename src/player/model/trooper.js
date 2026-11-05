// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The CLONE ARC TROOPER outfit, modelled on an ARC trooper like Fives or Captain Rex: Phase II plastoid
// over a black bodysuit, an ARC pauldron, the black collar yoke with its ammo pouches, the white utility belt, a cloth
// kama open at the front, legion markings and the bucket with its rangefinder. Slots and variants work like mando.js;
// its own palette keys (appearance.js DEFAULT_LOOK.trooper) are styled apart from the Mando's, so the two never share
// a colour.
//   plate = the white armour · grey = the black ARC gear and the seams between plates · suit = the bodysuit
//   mark = the legion colour · cloth = the kama
// The plates are built like the Mando's: pressed, rounded shells (lofts) layered over the skinned bodysuit with a dark
// gap where each plate meets the next, so the armour reads as separate pieces strapped on, not one white block.

import * as THREE from 'three';
import { loft, limb, plate, block, chamfer, ngon, KEEL, SHIELD, HEAD } from './shapes.js';
import { hand } from './jedi.js';
import { seg, rounded } from './skin.js';
import { DIM } from './rig.js';

// rounded sections, as the hero and NPC passes use (enemies/mesh.js SOFT*): pressed armour, not cut blocks
const SOFT = rounded(chamfer(0.42)), SOFT_HEAD = rounded(HEAD), SOFT_BODY = rounded(SHIELD), SOFT_LIMB = rounded(chamfer(0.4));
const mirror = pts => pts.map(([x, y]) => [-x, y]).reverse();

export const TROOPER_PARTS = {
  legs: {
    // bodysuit, white thigh shells, knee cops and shin panels in the legion colour, white greaves and boots
    arc(R, k){ legs(R, k, true); },
    // standard Phase II: all white
    phase2(R, k){ legs(R, k, false); },
    // the COMMANDO's Katarn plate: the same legs under heavier shells, broad knee guards and chunky boots
    commando(R, k){ legs(R, k, false); commandoLegs(R, k); },
  },
  torso: {
    // the Phase II cuirass, belt and back plate, with the ARC's black collar yoke and ammo pouches on the chest
    arc(R, k){ torso(R, k, true); },
    phase2(R, k){ torso(R, k, false); },
    // the Katarn cuirass: a deeper chest plate, an armoured belt and the big field pack on the back
    commando(R, k){ torso(R, k, false); commandoTorso(R, k); },
  },
  arms: {
    // the ARC pauldron in the legion colour on the left shoulder, legion bands on the bracers
    arc(R, k){ arms(R, k, 'arc'); },
    // a captain's single pauldron, smaller, and the bands (Rex)
    captain(R, k){ arms(R, k, 'captain'); },
    phase2(R, k){ arms(R, k, false); },
    // broad rounded shoulder plates on both arms and heavy gauntlets, a lit readout on the left wrist
    commando(R, k){ arms(R, k, false); commandoArms(R, k); },
  },
  helmet: {
    // Phase II bucket in the ARC's paint (Fives): the black brow band, a painted crest fin, chevrons over the brow,
    // stripes on the cheeks and the rangefinder
    arc(R, k){ helmet(R, k, { crest: true, rangefinder: true, arc: true }); },
    // rangefinder and markings, no crest (Rex)
    captain(R, k){ helmet(R, k, { rangefinder: true, brow: true }); },
    phase2(R, k){ helmet(R, k, {}); },
    // the Katarn helmet: a round dome with a ridge down the crown, the lit T-visor sweeping up at its ends, a jutting
    // jaw guard with its breather slots
    commando(R, k){ commandoHelmet(R, k, 'plain'); },
    // the same helmet in squad paint: a stripe over the crown and down the jaw, or the sides and jaw dark
    commandoStripe(R, k){ commandoHelmet(R, k, 'stripe'); },
    commandoSplit(R, k){ commandoHelmet(R, k, 'split'); },
  },
  kama: {
    // the kama: real cloth from the belt round the hips and behind, open at the front over the codpiece
    long(R, k){ kama(R, k); },
    none(){},
  },
};

/* ---------- legs ---------- */
function legs(R, k, arc){
  for (const L of [R.legL, R.legR]){
    k.skin('suit', [
      ...seg(DIM.thigh, [[-0.06,0.18,0.18],[0.2,0.17,0.17],[0.75,0.13,0.14],[1,0.11,0.12]]),
      ...seg(DIM.shin, [[0.1,0.14,0.15],[0.45,0.135,0.145],[0.8,0.115,0.125],[1,0.115,0.125]], DIM.thigh),
    ], { bones: [L.hip, L.knee], at: [DIM.thigh] });
    // the thigh: a full shell, swelling over the quad and tapering to the knee; its top rim stands off the suit
    k.add(limb(DIM.thigh - 0.13, [[0,0.2,0.195,0.008],[0.3,0.205,0.2,0.012],[0.75,0.172,0.172,0.012],[1,0.15,0.15,0.01]], SOFT_LIMB), 'plate', L.hip, [0, -0.07, 0]);
    k.add(limb(0.016, [[0,0.206,0.2,0.008],[1,0.204,0.198,0.008]], SOFT_LIMB), 'grey', L.hip, [0, -0.1, 0], [0, 0, 0], { outline: false });   // the seam band near the top
    // the knee cop: a domed plate over the joint, in the legion colour for an ARC
    k.add(loft([{ y:-0.065, w:0.11, d:0.04, z:-0.004 }, { y:-0.01, w:0.13, d:0.055 }, { y:0.04, w:0.12, d:0.05 }, { y:0.065, w:0.08, d:0.03, z:-0.004 }], SOFT), arc ? 'mark' : 'plate', L.knee, [0, -0.005, 0.07]);
    // the greave: a shell that swells over the calf, a dark band where it meets the boot
    k.add(limb(DIM.shin - 0.1, [[0,0.15,0.16,-0.004],[0.28,0.162,0.175,-0.01],[0.75,0.13,0.14,0],[1,0.124,0.13,0.004]], SOFT_LIMB), 'plate', L.knee, [0, -0.075, 0]);
    // the panel on the front of the shin under the knee, in the legion colour (Rex, Fives)
    if (arc) k.add(plate([[-0.05,0],[0.05,0],[0.042,-0.15],[0,-0.18],[-0.042,-0.15]], 0.012, 0.004), 'mark', L.knee, [0, -0.09, 0.082], [-0.03, 0, 0], { outline: false });
    // the boot: one rounded shoe, the toe low and the heel square, with a black sole under it and a cuff over the ankle
    const boot = k.group(L.ank, [0, 0, 0], [Math.PI/2, 0, 0]);   // its +y runs toe-ward, +z down
    k.add(loft([
      { y:-0.085, w:0.12, d:0.13, z:0.0 }, { y:-0.04, w:0.13, d:0.15, z:0.0 }, { y:0.05, w:0.135, d:0.12, z:0.015 },
      { y:0.14, w:0.125, d:0.085, z:0.035 }, { y:0.2, w:0.1, d:0.06, z:0.045 }, { y:0.215, w:0.06, d:0.035, z:0.05 },
    ], SOFT), 'plate', boot, [0, 0, 0.0]);
    k.add(loft([{ y:-0.09, w:0.125, d:0.025 }, { y:0.21, w:0.105, d:0.025 }], chamfer(0.3)), 'grey', boot, [0, 0, 0.078], [0, 0, 0], { outline: false });   // the sole
    k.add(loft([{ y:-0.03, w:0.142, d:0.15 }, { y:0.035, w:0.15, d:0.155 }], SOFT), 'plate', L.ank, [0, 0.035, -0.005]);   // the ankle cuff
  }
}

/* ---------- torso ---------- */
function torso(R, k, arc){
  k.skin('suit', [
    { t:-0.12, w:0.3, d:0.2 }, { t:0, w:0.34, d:0.22 }, { t:DIM.torsoY, w:0.31, d:0.2 }, { t:DIM.torsoY + DIM.chestY - 0.1, w:0.29, d:0.19 },
    ...seg(1, [[0,0.33,0.22],[0.14,0.45,0.265],[0.27,0.505,0.255],[0.35,0.36,0.2],[0.4,0.2,0.15]], DIM.torsoY + DIM.chestY),
  ], { bones: [R.hips, R.torso, R.chest], at: [DIM.torsoY, DIM.torsoY + DIM.chestY], blend: 0.07, profile: SHIELD, dir: 1 });
  // the codpiece: a shield-shaped plate between the legs, and the two hip plates on the flanks
  k.add(loft([{ y:-0.15, w:0.07, d:0.05, z:0.005 }, { y:-0.06, w:0.15, d:0.07 }, { y:0.02, w:0.19, d:0.07 }], SOFT), 'plate', R.hips, [0, -0.02, 0.105], [-0.08, 0, 0]);
  for (const sx of [-1, 1]) k.add(plate([[-0.06,0.03],[0.06,0.03],[0.05,-0.08],[-0.05,-0.08]], 0.02, 0.008), 'plate', R.hips, [0.175*sx, -0.02, 0.0], [0, sx*Math.PI/2, 0]);
  // the belt: a white band with a dark strap through it, and the ammo boxes round it
  k.add(loft([{ y:0.0, w:0.4, d:0.275 }, { y:0.075, w:0.395, d:0.27 }], SOFT_BODY), 'plate', R.torso, [0, -0.025, 0]);
  k.add(loft([{ y:0.0, w:0.408, d:0.28 }, { y:0.022, w:0.406, d:0.278 }], SOFT_BODY), 'grey', R.torso, [0, 0.002, 0], [0, 0, 0], { outline: false });
  const box = (x, z, ry, w = 0.075) => {
    k.add(block(w, 0.085, 0.05, 0.25), 'plate', R.torso, [x, 0.012, z], [0, ry, 0]);
    k.add(block(w * 0.7, 0.012, 0.052, 0.2), 'grey', R.torso, [x, 0.032, z + 0.001], [0, ry, 0], { outline: false });   // the lid line
  };
  box(-0.075, 0.15, 0); box(0.075, 0.15, 0);
  for (const sx of [-1, 1]){ box(0.16*sx, 0.115, 0.5*sx); box(0.205*sx, 0.0, Math.PI/2*sx, 0.09); }
  // the abdomen: a sculpted plate split by a dark seam, the suit showing at the flanks
  k.add(loft([{ y:0.06, w:0.24, d:0.07 }, { y:0.16, w:0.27, d:0.08 }, { y:0.27, w:0.29, d:0.08 }], SOFT), 'plate', R.torso, [0, 0, 0.095]);
  k.add(block(0.27, 0.01, 0.01, 0.2), 'grey', R.torso, [0, 0.17, 0.14], [0.08, 0, 0], { outline: false });
  // the CUIRASS: one pressed shell round the chest (pec plates swell off it, the back plate is its back), the suit
  // showing under the arms; it sits on the chest joint so the waist still twists
  k.add(loft([
    { y:-0.03, w:0.37, d:0.25, z:0.012 }, { y:0.06, w:0.44, d:0.285, z:0.01 }, { y:0.16, w:0.5, d:0.3 },
    { y:0.25, w:0.52, d:0.29 }, { y:0.31, w:0.48, d:0.27 }, { y:0.345, w:0.38, d:0.23 },
  ], SOFT_BODY), 'plate', R.chest);
  // the two pec plates standing off the shell, angled like a Phase II's, with the dark seam down the sternum
  const pec = [[0.0,-0.02],[0.16,0.0],[0.215,0.1],[0.2,0.19],[0.0,0.17]];
  k.add(plate(pec, 0.03, 0.014), 'plate', R.chest, [0.012, 0.09, 0.137], [-0.1, 0.24, 0]);
  k.add(plate(mirror(pec), 0.03, 0.014), 'plate', R.chest, [-0.012, 0.09, 0.137], [-0.1, -0.24, 0]);
  k.add(block(0.012, 0.18, 0.012, 0.2), 'grey', R.chest, [0, 0.17, 0.153], [-0.08, 0, 0], { outline: false });
  // the collar: the suit's neck seal
  k.add(loft([{ y:0.33, w:0.25, d:0.21 }, { y:0.45, w:0.17, d:0.16 }], SOFT), 'suit', R.chest);
  // the back plate and the pack
  k.add(loft([{ y:0.02, w:0.36, d:0.06 }, { y:0.16, w:0.4, d:0.07 }, { y:0.3, w:0.36, d:0.06 }], SOFT), 'plate', R.chest, [0, 0, -0.14]);
  k.add(loft([{ y:-0.08, w:0.24, d:0.11 }, { y:0.07, w:0.26, d:0.12 }, { y:0.1, w:0.22, d:0.1 }], SOFT), 'plate', R.chest, [0, 0.2, -0.205]);
  k.add(block(0.2, 0.012, 0.115, 0.2), 'grey', R.chest, [0, 0.21, -0.205], [0, 0, 0], { outline: false });
  if (arc){
    // the ARC yoke: a black collar plate over the shoulders, a tab down the breastbone
    k.add(loft([{ y:0.29, w:0.42, d:0.285 }, { y:0.335, w:0.43, d:0.285 }, { y:0.38, w:0.33, d:0.24 }, { y:0.415, w:0.22, d:0.18 }], SOFT_BODY), 'grey', R.chest);
    k.add(plate([[-0.07,0],[0.07,0],[0.05,-0.07],[-0.05,-0.07]], 0.02, 0.008), 'grey', R.chest, [0, 0.33, 0.14], [-0.2, 0, 0]);
    // the triple ammo pouch hanging off it on his right breast, each with a snap
    const P = k.group(R.chest, [0.12, 0.3, 0.155], [-0.18, 0, 0.05]);
    for (const bx of [-0.04, 0, 0.04]){
      k.add(block(0.038, 0.13, 0.04, 0.25), 'grey', P, [bx, -0.055, 0]);
      k.add(block(0.04, 0.035, 0.044, 0.25), 'grey', P, [bx, 0.0, 0.003]);
      k.add(block(0.012, 0.012, 0.008, 0.2), 'plate', P, [bx, -0.005, 0.026], [0, 0, 0], { outline: false });
    }
  }
}

/* ---------- arms ---------- */
function arms(R, k, kind){
  for (const A of [R.armL, R.armR]){
    const s = A.side;
    k.skin('suit', [
      ...seg(0.34, [[-0.18,0.14,0.14],[0.06,0.15,0.15],[0.5,0.125,0.125],[1,0.1,0.105]]),
      ...seg(0.3, [[0.5,0.095,0.095],[1,0.08,0.08]], 0.34),
    ], { bones: [A.sh, A.el], at: [0.34], blend: 0.05, profile: SOFT_LIMB });
    // the bicep shell
    k.add(limb(0.19, [[0,0.142,0.142],[0.5,0.14,0.138],[1,0.122,0.12]], SOFT_LIMB), 'plate', A.sh, [0, -0.095, 0]);
    // the shoulder bell every clone wears, and over it (left shoulder) the ARC's pauldron or a captain's
    k.add(loft([{ y:-0.08, w:0.21, d:0.2 }, { y:0.0, w:0.215, d:0.205 }, { y:0.06, w:0.17, d:0.17 }, { y:0.085, w:0.09, d:0.1 }], SOFT), 'plate', A.sh, [0.025*s, 0.02, 0], [0, 0, -0.32*s]);
    if ((kind === 'arc' || kind === 'captain') && s < 0){
      // the pauldron: a broad shell over the bell, flaring out and down over the upper arm, its rim in black
      const big = kind === 'arc';
      const P = k.group(A.sh, [0.055*s, 0.045, 0], [0, 0, -0.42*s]);
      P.scale.setScalar(big ? 1 : 0.86);
      k.add(loft([{ y:-0.2, w:0.27, d:0.31, x:0.045*s }, { y:-0.09, w:0.29, d:0.31, x:0.03*s }, { y:0.02, w:0.27, d:0.28, x:0.01*s }, { y:0.09, w:0.19, d:0.22 }, { y:0.12, w:0.08, d:0.12 }], SOFT), 'mark', P);
      k.add(loft([{ y:-0.215, w:0.275, d:0.315, x:0.047*s }, { y:-0.195, w:0.278, d:0.318, x:0.046*s }], SOFT), 'grey', P, [0, 0, 0], [0, 0, 0], { outline: false });
      // the strap round the arm that holds it on
      k.add(limb(0.025, [[0,0.148,0.148],[1,0.146,0.146]], SOFT_LIMB), 'grey', A.sh, [0, -0.17, 0], [0, 0, 0], { outline: false });
    }
    if (kind === 'arc' && s > 0){
      // and on the right, the ARC's second pauldron: smaller, in the dark of the kit, its rim in the squad colour
      const P = k.group(A.sh, [0.05*s, 0.04, 0], [0, 0, -0.4*s]);
      P.scale.setScalar(0.8);
      k.add(loft([{ y:-0.18, w:0.26, d:0.29, x:0.04*s }, { y:-0.08, w:0.28, d:0.3, x:0.028*s }, { y:0.02, w:0.26, d:0.27, x:0.01*s }, { y:0.09, w:0.18, d:0.21 }, { y:0.12, w:0.08, d:0.11 }], SOFT), 'grey', P);
      k.add(loft([{ y:-0.195, w:0.265, d:0.295, x:0.042*s }, { y:-0.175, w:0.268, d:0.298, x:0.041*s }], SOFT), 'mark', P, [0, 0, 0], [0, 0, 0], { outline: false });
    }
    // the elbow cop and the bracer, a legion band at the wrist
    k.add(loft([{ y:-0.045, w:0.115, d:0.12 }, { y:0.0, w:0.125, d:0.132 }, { y:0.045, w:0.11, d:0.116 }], SOFT_LIMB), 'plate', A.el, [0, 0.0, 0.012]);
    k.add(limb(0.22, [[0,0.112,0.108],[0.55,0.124,0.118],[1,0.106,0.102]], SOFT_LIMB), 'plate', A.el, [0, -0.045, 0]);
    k.add(limb(0.03, [[0,0.126,0.12],[1,0.122,0.117]], SOFT_LIMB), kind ? 'mark' : 'grey', A.el, [0, -0.11, 0], [0, 0, 0], { outline: false });
    if (kind === 'arc' && s > 0) k.add(block(0.055, 0.1, 0.025, 0.25), 'grey', A.el, [0, -0.17, 0.063]);   // the wrist comlink
    hand(A, k, 'strap');
  }
}

/* ---------- the bucket ----------
   A Phase II helmet: a round dome that flares out over the ears and the nape; the face is its own plate, the T-visor's
   brow slit sweeping down at its ends over the cheeks, a ridge running from the visor's drop to the chin between two
   breather bulbs. Then the optional crest, rangefinder (over the left ear, as Rex and Fives wear it) and the legion
   paint framing the visor. */
function helmet(R, k, { crest, rangefinder, brow, arc }){
  const helm = k.group(R.head);
  k.add(loft([{ y:-0.1, w:0.12, d:0.12 }, { y:0.04, w:0.11, d:0.11 }], ngon(10, Math.PI/10)), 'suit', helm);
  // the shell: flared rim, the sides over the ears, the dome
  k.add(loft([
    { y:-0.005, w:0.272, d:0.275, z:-0.02 },
    { y:0.04,  w:0.25, d:0.255, z:-0.008 },
    { y:0.12,  w:0.246, d:0.27, z:-0.004 },
    { y:0.2,   w:0.256, d:0.29, z:-0.008 },
    { y:0.27,  w:0.25, d:0.285, z:-0.01 },
    { y:0.32,  w:0.226, d:0.258, z:-0.012 },
    { y:0.358, w:0.18, d:0.21, z:-0.014 },
    { y:0.383, w:0.11, d:0.13, z:-0.014 },
    { y:0.395, w:0.04, d:0.05, z:-0.014 },
  ], SOFT_HEAD), 'plate', helm);
  // the face plate: stands proud of the shell from the brow to the chin, the jaw jutting forward and down
  k.add(loft([
    { y:0.0,  w:0.15, d:0.05, z:0.142 },
    { y:0.07, w:0.2,  d:0.055, z:0.136 },
    { y:0.16, w:0.23, d:0.05, z:0.13 },
    { y:0.25, w:0.225, d:0.04, z:0.127 },
  ], SOFT), 'plate', helm);
  // the chin ridge from the visor's drop down to the chin, and the two breather bulbs either side of it
  k.add(loft([{ y:0.0, w:0.035, d:0.03, z:0.168 }, { y:0.09, w:0.03, d:0.025, z:0.162 }], SOFT), 'plate', helm, [0, 0.01, 0]);
  for (const sx of [-1, 1]){
    k.add(loft([{ y:-0.022, w:0.052, d:0.052 }, { y:0.018, w:0.052, d:0.052 }, { y:0.024, w:0.04, d:0.04 }], ngon(12)), 'plate', helm, [0.052*sx, 0.042, 0.158], [Math.PI/2 - 0.35, 0, 0]);
    k.add(loft([{ y:-0.006, w:0.03, d:0.03 }, { y:0.006, w:0.03, d:0.03 }], ngon(10)), 'suit', helm, [0.052*sx, 0.034, 0.181], [Math.PI/2 - 0.35, 0, 0], { outline: false });
    // the vents along the jaw
    for (let i = 0; i < 3; i++) k.add(block(0.006, 0.03, 0.006, 0.2), 'grey', helm, [(0.088 + i*0.012)*sx, 0.06 - i*0.004, 0.15 - i*0.012], [0.3, sx*0.5, 0], { outline: false });
  }
  // the T-visor: the brow slit (its ends sweeping down over the cheeks) and the centre drop
  k.add(plate([[-0.075,0.022],[0.075,0.022],[0.075,-0.012],[-0.075,-0.012]], 0.024, 0.003), 'visor', helm, [0, 0.215, 0.14], [0, 0, 0], { outline: false });
  for (const sx of [-1, 1]) k.add(plate([[0,0.022],[0.04,0.012],[0.05,-0.03],[0.035,-0.034],[0.0,-0.012]], 0.024, 0.003), 'visor', helm, [0.07*sx, 0.215, 0.136], [0, sx*0.38, 0], { outline: false, scale: [sx, 1, 1] });
  k.add(plate([[-0.022,0],[0.022,0],[0.016,-0.115],[-0.016,-0.115]], 0.024, 0.003), 'visor', helm, [0, 0.205, 0.153], [-0.1, 0, 0], { outline: false });
  // the ear caps
  for (const sx of [-1, 1]){
    k.add(loft([{ y:-0.012, w:0.08, d:0.08 }, { y:0.012, w:0.068, d:0.068 }], ngon(12)), 'plate', helm, [0.128*sx, 0.16, -0.01], [0, 0, Math.PI/2]);
    k.add(loft([{ y:-0.003, w:0.026, d:0.026 }, { y:0.003, w:0.026, d:0.026 }], ngon(10)), 'grey', helm, [0.141*sx, 0.16, -0.01], [0, 0, Math.PI/2], { outline: false });
  }
  if (crest && arc){
    // the ARC's fin: standing tall from the brow back over the crown, in the squad colour
    k.add(plate([[-0.12,-0.05],[0.1,-0.06],[0.11,-0.03],[0.07,0.03],[-0.07,0.04],[-0.12,0.0]], 0.026, 0.006), 'mark', helm, [0, 0.39, -0.015], [0, -Math.PI/2, 0]);
  } else if (crest){
    // a low fin from the brow back over the crown
    k.add(plate([[-0.1,-0.03],[0.1,-0.03],[0.09,0.0],[0.0,0.018],[-0.09,0.0]], 0.018, 0.006), 'plate', helm, [0, 0.39, 0.01], [0, -Math.PI/2, 0]);
  }
  if (arc){
    // the black band round the brow, over the visor and back round the shell
    k.add(loft([{ y:0.0, w:0.264, d:0.298, z:-0.009 }, { y:0.024, w:0.262, d:0.296, z:-0.01 }], SOFT_HEAD), 'grey', helm, [0, 0.236, 0], [0, 0, 0], { outline: false });
    k.add(plate([[-0.118,0.014],[0.118,0.014],[0.114,-0.01],[-0.114,-0.01]], 0.01, 0.002), 'grey', helm, [0, 0.248, 0.146], [-0.08, 0, 0], { outline: false });
    for (const sx of [-1, 1]){
      // the chevrons: a slanted band each side of the fin, down from the crown toward the temples, laid on the shell
      for (let i = 0; i < 8; i++){
        const x = 0.03 + i * 0.012, y = 0.33 - i * 0.011, a = 0.124, b = 0.14;
        const z = -0.011 + b * Math.sqrt(Math.max(0, 1 - (x / a) ** 2)) * Math.cos((y - 0.27) * 3.2);
        k.add(block(0.03, 0.03 - i * 0.002, 0.006, 0.2), 'mark', helm, [x*sx, y, z + 0.002], [-0.35 - (y - 0.27) * 4, Math.atan2(x / (a*a), z / (b*b)) * sx, -0.74*sx], { outline: false, scale: [1, 1, 1] });
      }
      // a stripe on each cheek, below the visor's ends
      k.add(plate([[0,0.035],[0.016,0.035],[0.022,-0.04],[0.006,-0.04]], 0.008, 0.002), 'mark', helm, [0.09*sx, 0.13, 0.142], [0, sx*0.42, 0], { outline: false, scale: [sx, 1, 1] });
    }
  }
  if (rangefinder){
    // the stalk over the left ear, its eyepiece swung up
    const fin = k.group(helm, [-0.15, 0.19, -0.03], [0, 0, 0.05]);
    k.add(loft([{ y:-0.015, w:0.035, d:0.035 }, { y:0.015, w:0.03, d:0.03 }], ngon(10)), 'grey', fin, [0, 0, 0], [0, 0, Math.PI/2]);
    k.add(block(0.016, 0.28, 0.02, 0.3), 'grey', fin, [-0.01, 0.14, 0]);
    k.add(block(0.024, 0.035, arc ? 0.15 : 0.08, 0.3), 'grey', fin, [-0.01, 0.285, arc ? 0.06 : 0.03]);
    if (arc) k.add(block(0.022, 0.03, 0.02, 0.3), 'grey', fin, [-0.01, 0.262, 0.125]);   // the eyepiece's drop at the front
  }
  if (brow){
    // the legion paint framing the T: a band over the brow slit, one down each side of the drop and a stripe up over
    // the crown, the way Rex wears his
    k.add(plate([[-0.115,0.016],[0.115,0.016],[0.11,-0.004],[-0.11,-0.004]], 0.008, 0.002), 'mark', helm, [0, 0.245, 0.142], [-0.12, 0, 0], { outline: false });
    for (const sx of [-1, 1]){
      k.add(plate([[-0.01,0],[0.01,0],[0.016,-0.1],[0.0,-0.1]], 0.008, 0.002), 'mark', helm, [0.03*sx, 0.198, 0.157], [-0.1, sx*0.12, 0], { outline: false, scale: [sx, 1, 1] });
      k.add(plate([[0,0.01],[0.05,0.03],[0.06,0.015],[0.01,-0.008]], 0.008, 0.002), 'mark', helm, [0.03*sx, 0.27, 0.132], [-0.4, sx*0.3, 0], { outline: false, scale: [sx, 1, 1] });
    }
  }
}

/* ---------- THE COMMANDO (Katarn-class armour) ----------
   The Commando fork's kit (data/trooper-progression.js): bulkier everywhere than the ARC's Phase II plates, laid over
   the same bodysuit and base shells, with the lit visor ('glow') and a squad colour ('mark') only in small accents. */
function commandoLegs(R, k){
  for (const L of [R.legL, R.legR]){
    // the thigh guard: a broad plate over the front and outside of the thigh
    k.add(limb(DIM.thigh - 0.18, [[0,0.235,0.225,0.012],[0.45,0.236,0.222,0.016],[1,0.19,0.188,0.012]], SOFT_LIMB), 'plate', L.hip, [0, -0.1, 0.004]);
    // the knee guard: a big square-ish cup standing off the joint
    k.add(loft([{ y:-0.09, w:0.15, d:0.05, z:-0.006 }, { y:-0.03, w:0.175, d:0.075 }, { y:0.04, w:0.17, d:0.07 }, { y:0.085, w:0.12, d:0.04, z:-0.006 }], SOFT), 'plate', L.knee, [0, -0.01, 0.09]);
    k.add(block(0.12, 0.012, 0.02, 0.2), 'grey', L.knee, [0, -0.06, 0.125], [0, 0, 0], { outline: false });
    // the shin guard: a thick plate down the front of the greave
    k.add(limb(DIM.shin - 0.16, [[0,0.18,0.19,0.012],[0.35,0.188,0.2,0.016],[1,0.15,0.16,0.012]], SOFT_LIMB), 'plate', L.knee, [0, -0.1, 0.006]);
    // the boot: a deeper sole and a strap over the instep
    const boot = k.group(L.ank, [0, 0, 0], [Math.PI/2, 0, 0]);
    k.add(loft([{ y:-0.1, w:0.15, d:0.04 }, { y:0.23, w:0.13, d:0.04 }], chamfer(0.3)), 'grey', boot, [0, 0, 0.085], [0, 0, 0], { outline: false });
    k.add(block(0.15, 0.03, 0.02, 0.2), 'grey', boot, [0, 0.06, -0.02], [0.3, 0, 0], { outline: false });
  }
}
function commandoTorso(R, k){
  // the chest plate over the cuirass, squared off, and the armoured abdomen plates
  k.add(loft([
    { y:0.02, w:0.43, d:0.32, z:0.018 }, { y:0.12, w:0.48, d:0.34, z:0.016 }, { y:0.24, w:0.5, d:0.335, z:0.012 }, { y:0.32, w:0.46, d:0.3 },
  ], SOFT_BODY), 'plate', R.chest);
  k.add(block(0.016, 0.24, 0.012, 0.2), 'grey', R.chest, [0, 0.16, 0.182], [-0.06, 0, 0], { outline: false });
  for (const [y, w] of [[0.1, 0.3], [0.2, 0.32]]) k.add(loft([{ y:0, w, d:0.09 }, { y:0.075, w: w + 0.02, d:0.095 }], SOFT), 'plate', R.torso, [0, y - 0.04, 0.1]);
  // a broad armoured belt with a squad-colour buckle
  k.add(loft([{ y:0.0, w:0.43, d:0.3 }, { y:0.085, w:0.425, d:0.295 }], SOFT_BODY), 'plate', R.torso, [0, -0.035, 0]);
  k.add(block(0.07, 0.05, 0.02, 0.3), 'mark', R.torso, [0, 0.01, 0.152], [0, 0, 0], { outline: false });
  // the field pack: layered slabs, each angled off the one under it (kept inside the shoulders, so the arms swing clear):
  // the frame on the back plate, the main body over it, a canted top, and a narrower power cell on the outside
  const P = k.group(R.chest, [0, 0.17, -0.22]);
  k.add(block(0.36, 0.4, 0.08, 0.3), 'grey', P, [0, -0.01, 0.02]);
  k.add(block(0.34, 0.36, 0.13, 0.3, 0.9), 'plate', P, [0, -0.02, -0.07], [0.06, 0, 0]);
  k.add(block(0.3, 0.13, 0.12, 0.3, 0.8), 'plate', P, [0, 0.21, -0.06], [-0.4, 0, 0]);
  k.add(block(0.22, 0.24, 0.06, 0.3, 0.9), 'plate', P, [0, -0.06, -0.16], [0.1, 0, 0]);
  k.add(block(0.32, 0.014, 0.136, 0.2), 'grey', P, [0, 0.07, -0.07], [0.06, 0, 0], { outline: false });
  k.add(block(0.16, 0.012, 0.062, 0.2), 'grey', P, [0, -0.1, -0.162], [0.1, 0, 0], { outline: false });
  k.add(block(0.04, 0.02, 0.01, 0.3), 'glow', P, [0.06, 0.02, -0.193], [0.1, 0, 0], { outline: false });   // the cell's charge light
}
function commandoArms(R, k){
  for (const A of [R.armL, R.armR]){
    const s = A.side;
    // the shoulder plate: a rounded shell over the bell, two plates deep, its edge in the squad colour. Kept to the cap
    // of the shoulder (the arm shows below it, standing off the body) and set out from the chest
    const P = k.group(A.sh, [0.06*s, 0.04, 0], [0, 0, -0.34*s]);
    k.add(loft([{ y:-0.13, w:0.25, d:0.255, x:0.035*s }, { y:-0.06, w:0.26, d:0.26, x:0.025*s }, { y:0.02, w:0.24, d:0.24, x:0.01*s }, { y:0.08, w:0.17, d:0.19 }, { y:0.105, w:0.08, d:0.1 }], SOFT), 'plate', P);
    k.add(loft([{ y:-0.18, w:0.21, d:0.225, x:0.05*s }, { y:-0.13, w:0.225, d:0.235, x:0.045*s }, { y:-0.1, w:0.2, d:0.21, x:0.04*s }], SOFT), 'plate', P);
    k.add(loft([{ y:-0.142, w:0.255, d:0.262, x:0.037*s }, { y:-0.125, w:0.257, d:0.264, x:0.036*s }], SOFT), 'mark', P, [0, 0, 0], [0, 0, 0], { outline: false });
    // a dark band round the bicep under it, so the arm reads apart from the chest
    k.add(limb(0.03, [[0,0.146,0.146],[1,0.144,0.144]], SOFT_LIMB), 'grey', A.sh, [0, -0.2, 0], [0, 0, 0], { outline: false });
    // the gauntlet: a heavy shell over the bracer, flaring at the wrist
    k.add(limb(0.2, [[0,0.13,0.13,0.006],[0.6,0.15,0.145,0.008],[1,0.142,0.138,0.006]], SOFT_LIMB), 'plate', A.el, [0, -0.06, 0]);
    k.add(limb(0.022, [[0,0.152,0.147],[1,0.15,0.145]], SOFT_LIMB), 'grey', A.el, [0, -0.15, 0], [0, 0, 0], { outline: false });
    if (s < 0) k.add(block(0.03, 0.09, 0.012, 0.3), 'glow', A.el, [0, -0.17, 0.075], [0, 0, 0], { outline: false });   // the lit wrist readout
    else k.add(block(0.06, 0.12, 0.03, 0.25), 'grey', A.el, [0, -0.16, 0.074]);   // the blade housing
  }
}
function commandoHelmet(R, k, paint = 'plain'){
  const helm = k.group(R.head);
  const dark = paint === 'split' ? 'grey' : 'plate';
  k.add(loft([{ y:-0.1, w:0.13, d:0.13 }, { y:0.04, w:0.12, d:0.12 }], ngon(10, Math.PI/10)), 'suit', helm);
  // the dome: round, wide over the ears and swelling out over the nape
  k.add(loft([
    { y:-0.02, w:0.29, d:0.31, z:-0.035 }, { y:0.05, w:0.28, d:0.3, z:-0.02 }, { y:0.15, w:0.285, d:0.31, z:-0.01 },
    { y:0.24, w:0.29, d:0.315, z:-0.008 }, { y:0.32, w:0.27, d:0.3, z:-0.01 }, { y:0.38, w:0.22, d:0.25, z:-0.012 },
    { y:0.415, w:0.14, d:0.16, z:-0.012 }, { y:0.432, w:0.05, d:0.06, z:-0.012 },
  ], SOFT_HEAD), 'plate', helm);
  // the sides in a darker panel (one paint): a shell over each ear and the back of the dome
  if (paint === 'split') for (const sx of [-1, 1]) k.add(loft([{ y:-0.02, w:0.07, d:0.25, z:-0.05 }, { y:0.2, w:0.07, d:0.27, z:-0.04 }, { y:0.33, w:0.05, d:0.2, z:-0.05 }], SOFT), 'grey', helm, [0.122*sx, 0, 0]);
  // the face: flat cheeks from the visor down, a dark recess under each, the beak of the jaw jutting out between them
  k.add(loft([{ y:0.06, w:0.24, d:0.05, z:0.142 }, { y:0.17, w:0.255, d:0.05, z:0.14 }, { y:0.27, w:0.255, d:0.045, z:0.136 }], SOFT), 'plate', helm);
  for (const sx of [-1, 1]) k.add(plate([[0.0,0.03],[0.08,0.05],[0.1,0.0],[0.07,-0.04],[0.0,-0.03]], 0.01, 0.002), 'grey', helm, [0.03*sx, 0.1, 0.16], [0, sx*0.35, 0], { outline: false, scale: [sx, 1, 1] });
  k.add(loft([{ y:-0.035, w:0.12, d:0.05, z:0.19 }, { y:0.02, w:0.17, d:0.075, z:0.18 }, { y:0.08, w:0.2, d:0.07, z:0.166 }, { y:0.115, w:0.18, d:0.05, z:0.158 }], SOFT), dark, helm);
  for (const sx of [-1, 1]){
    k.add(loft([{ y:-0.006, w:0.026, d:0.026 }, { y:0.006, w:0.026, d:0.026 }], ngon(10)), 'grey', helm, [0.062*sx, 0.012, 0.212], [Math.PI/2 - 0.3, 0, 0], { outline: false });   // the breathers
    for (let i = 0; i < 4; i++) k.add(block(0.006, 0.05, 0.008, 0.2), 'grey', helm, [(0.128 + 0.004*i)*sx, 0.085, 0.1 - i*0.012], [0, sx*0.9, 0], { outline: false });   // the side grille
  }
  k.add(block(0.04, 0.045, 0.02, 0.25), 'grey', helm, [0, -0.012, 0.215], [0.2, 0, 0], { outline: false });   // the vent under the beak
  // the V of dark seams from the foot of the T out over the cheeks to the jaw
  for (const sx of [-1, 1]) k.add(block(0.11, 0.008, 0.006, 0.2), 'grey', helm, [0.05*sx, 0.105, 0.172], [0, sx*0.3, sx*0.42], { outline: false });
  // the brow ledge: a hood over the visor with its row of rivets
  k.add(loft([{ y:0.0, w:0.27, d:0.06, z:0.15 }, { y:0.026, w:0.275, d:0.055, z:0.148 }], SOFT), 'plate', helm, [0, 0.272, 0]);
  for (const x of [-0.08, 0, 0.08]) k.add(block(0.01, 0.01, 0.006, 0.3), 'grey', helm, [x, 0.286, 0.18], [0, 0, 0], { outline: false });
  // the lit visor: a straight brow band and the T's drop, widening as it falls, set in a dark frame
  const band = [[-0.11,0.02],[0.11,0.02],[0.11,-0.004],[0.095,-0.02],[-0.095,-0.02],[-0.11,-0.004]];
  const drop = [[-0.02,0.0],[0.02,0.0],[0.03,-0.12],[-0.03,-0.12]];
  k.add(plate(band.map(([x, y]) => [x * 1.08, y * 1.4]), 0.016, 0.002), 'grey', helm, [0, 0.247, 0.158], [0, 0, 0], { outline: false });
  k.add(plate(drop.map(([x, y]) => [x * 1.5, y * 1.04]), 0.016, 0.002), 'grey', helm, [0, 0.232, 0.161], [-0.06, 0, 0], { outline: false });
  k.add(plate(band, 0.02, 0.002), 'glow', helm, [0, 0.247, 0.163], [0, 0, 0], { outline: false });
  k.add(plate(drop, 0.02, 0.002), 'glow', helm, [0, 0.232, 0.166], [-0.06, 0, 0], { outline: false });
  // the ear discs, a lit lamp on the left one
  for (const sx of [-1, 1]){
    k.add(loft([{ y:-0.014, w:0.1, d:0.1 }, { y:0.014, w:0.088, d:0.088 }], ngon(14)), 'plate', helm, [0.148*sx, 0.21, 0.01], [0, 0, Math.PI/2]);
    k.add(loft([{ y:-0.004, w:0.05, d:0.05 }, { y:0.004, w:0.05, d:0.05 }], ngon(12)), 'grey', helm, [0.163*sx, 0.21, 0.01], [0, 0, Math.PI/2], { outline: false });
  }
  k.add(block(0.03, 0.022, 0.03, 0.3), 'plate', helm, [-0.16, 0.235, 0.06]);
  k.add(block(0.008, 0.01, 0.008, 0.3), 'glow', helm, [-0.16, 0.235, 0.077], [0, 0, 0], { outline: false });
  // the squad stripe (one paint): from the ledge up over the crown, and down the beak
  if (paint === 'stripe'){
    const segs = [[0.3, 0.135, -0.2], [0.36, 0.105, -0.75], [0.41, 0.05, -1.2], [0.43, -0.02, -1.6], [0.415, -0.09, -2.0]];
    for (const [y, z, rx] of segs) k.add(block(0.055, 0.075, 0.01, 0.2), 'mark', helm, [0, y, z], [rx, 0, 0], { outline: false });
    k.add(block(0.05, 0.07, 0.012, 0.2), 'mark', helm, [0, 0.04, 0.202], [-0.25, 0, 0], { outline: false });
  }
}

/* ---------- the kama ----------
   Real cloth (cloth.js), pinned along the belt from one hip round behind to the other and open at the front: it
   swings with the stride, the legs push it aside, and it settles when he stops. Its top hides under the belt. */
function kama(R, k){
  const A0 = 0.62, A1 = Math.PI * 2 - 0.62;   // round from the front of one hip, behind, to the other: open over the codpiece
  const RX = 0.22, RZ = 0.165, DROP = 0.6;
  k.cloth('cloth', R.hips, { W: 11, H: 6, thick: 0.012, outline: true, capsules: k.bodyCapsules(), slack: 0.55,
    rest: (u, v) => {
      const a = A0 + (u + 1) / 2 * (A1 - A0), flare = 1 + v * 0.38;
      return [Math.sin(a) * RX * flare, 0.1 - v * DROP, Math.cos(a) * RZ * flare];
    } });
}
