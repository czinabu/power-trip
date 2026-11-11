// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PEOPLE A MISSION SAVES, built: the archivists walked out of the Burning Archive, the prisoners off the barge, the
// younglings and the foundlings up the ramp (game/mission.js evacuees, game/twists/stragglers.js). They are drawn the way
// the troopers are (enemies/kit.js: the Ink style, baked to a few draws each, so a line of sixteen stays cheap), on the
// same skinned body (enemies/mesh.js legBones and upper), so the troopers' own gait (enemies/gait.js) walks them and
// enemies/upper.js breathes, glances, blinks and swings their arms. Only the clothes, the head and the build are theirs.
//
//   archivist  an elder in the long undyed robes of the temple archive, belled sleeves, a tabard and sash
//   prisoner   a grown-up in a prison jumpsuit (orange or grey), a number patch on the chest
//   youngling  a child: a Jedi tunic and tabard, a padawan's side braid or a topknot, a big head on a small frame
//   foundling  a child: a drab tunic under a rough hooded cloak, or a little beskar helmet with the creed's T-visor
//
// Children are the same body scaled down with the head scaled UP (as a child's is, against its height), and a softer
// face (a narrower jaw, a finer nose). Each kind has a small fixed pool of looks (CIV_LOOKS), picked by seed, so every
// look is baked once (engine/prewarm.js bakes them ahead of a fight).

import * as THREE from 'three';
import { loft, limb, plate, block, chamfer, ngon, KEEL } from '../player/model/shapes.js';
import { rounded } from '../player/model/skin.js';
import { bakeDesign, instantiate } from './kit.js';
import { legBones, upper, sideArm, cape, NECK } from './mesh.js';
import { face, LID_OPEN, FRAME } from './detail.js';
import { hood, cowl } from './saberist.js';
import { updateLegs } from './gait.js';
import { updateUpper } from './upper.js';

const PI = Math.PI;
const NO_INK = { outline: false };
const SOFT = rounded(chamfer(0.42)), SOFT_LIMB = rounded(chamfer(0.4)), SOFT_BODY = rounded(chamfer(0.3)), ROBE = rounded(chamfer(0.46));
const cloth = c => ({ c, r: 0.92, m: 0.04 });

const SKIN = [0xe2bea0, 0xcfa282, 0xb88a6a, 0x9c7a62, 0x82604a, 0x6e4a36, 0x553828];
const HAIR = [0x120c08, 0x2a2018, 0x4a3220, 0x6a4a2c, 0x7a3a1e, 0xa88a5a];
const GREY = [0xd8d4cc, 0xb8b4ae, 0x8a8682];

/* the looks. Per kind: scale (the whole figure: a grown-up about a man's height, a child near two thirds), head (the
   head's size against the body: a child's is bigger), and a pool of looks, each { colours (the bake's keys), face
   (enemies/detail.js face: skin, hair, style, beard, fem), and what it wears (robe, hood, helm, braid) } */
export const CIV_LOOKS = {
  archivist: { scale: 0.86, head: 1.08, looks: [
    { robe: true, c: { armor: 0xd8c8a0, armor2: 0x8c7656, suit: 0xb8a482, trim: 0x6a5238, leather: 0x4a3626, boot: 0x3a2a1e, cloth: 0xc8b48e }, face: { skin: SKIN[0], hair: GREY[0], style: 'bald', beard: 'full' } },
    { robe: true, c: { armor: 0xb8a080, armor2: 0x6b4f37, suit: 0x9a8466, trim: 0x8a6a42, leather: 0x3a2a1e, boot: 0x2e2218, cloth: 0xa8946a }, face: { skin: SKIN[4], hair: GREY[1], style: 'bun', fem: true } },
    { robe: true, hood: true, c: { armor: 0xe6e2d8, armor2: 0x8c7656, suit: 0xc9b48f, trim: 0x5a4632, leather: 0x4a3626, boot: 0x3a2a1e, cloth: 0x9a7a56 }, face: { skin: SKIN[2], hair: GREY[2], style: 'buzz', beard: 'goatee' } },
    { robe: true, c: { armor: 0xc9b48f, armor2: 0x5a4632, suit: 0xa89070, trim: 0x7a5a3a, leather: 0x3a2a1e, boot: 0x2e2218, cloth: 0xb8a080 }, face: { skin: SKIN[6], hair: GREY[0], style: 'long', fem: true } },
  ] },
  prisoner: { scale: 0.86, head: 1.08, looks: [
    { suit: true, c: { armor: 0xc86a2a, armor2: 0x8a4418, suit: 0xc86a2a, trim: 0xe6e2d8, leather: 0x2a2018, boot: 0x1a1612 }, face: { skin: SKIN[3], hair: HAIR[1], style: 'buzz', beard: 'stubble' } },
    { suit: true, c: { armor: 0x8a8a84, armor2: 0x5a5a56, suit: 0x8a8a84, trim: 0xe6e2d8, leather: 0x2a2018, boot: 0x1a1612 }, face: { skin: SKIN[1], hair: HAIR[4], style: 'ponytail', fem: true } },
    { suit: true, c: { armor: 0xb05a24, armor2: 0x7a3a14, suit: 0xb05a24, trim: 0xe6e2d8, leather: 0x2a2018, boot: 0x1a1612 }, face: { skin: SKIN[5], hair: HAIR[0], style: 'crop' } },
    { suit: true, c: { armor: 0xc86a2a, armor2: 0x8a4418, suit: 0xc86a2a, trim: 0xe6e2d8, leather: 0x2a2018, boot: 0x1a1612 }, face: { skin: SKIN[0], hair: HAIR[5], style: 'bun', fem: true } },
  ] },
  youngling: { scale: 0.6, head: 1.42, child: true, looks: [
    { c: { armor: 0xe6e2d8, armor2: 0x8c7656, suit: 0xb39d78, trim: 0x6a5238, leather: 0x4a3626, boot: 0x3a2a1e }, face: { skin: SKIN[2], hair: HAIR[3], style: 'buzz' }, braid: true },
    { c: { armor: 0xd2c4a2, armor2: 0x6b4f37, suit: 0x9a8466, trim: 0x8a6a42, leather: 0x3a2a1e, boot: 0x2e2218 }, face: { skin: SKIN[5], hair: HAIR[0], style: 'topknot' } },
    { c: { armor: 0xc9b48f, armor2: 0x5a4632, suit: 0xa89070, trim: 0x6a5238, leather: 0x4a3626, boot: 0x3a2a1e }, face: { skin: SKIN[0], hair: HAIR[4], style: 'braid', fem: true } },
    { c: { armor: 0xe6e2d8, armor2: 0x8c7656, suit: 0xb39d78, trim: 0x7a5a3a, leather: 0x3a2a1e, boot: 0x2e2218 }, face: { skin: SKIN[3], hair: HAIR[1], style: 'bald' } },
  ] },
  foundling: { scale: 0.58, head: 1.42, child: true, looks: [
    { helm: true, c: { armor: 0x6a5a4a, armor2: 0x9aa2aa, suit: 0x4a4038, trim: 0x2a2420, leather: 0x3a2a1e, boot: 0x2a2018, cloth: 0x5a5048 }, face: { skin: SKIN[2], hair: HAIR[1], style: 'crop' } },
    { hood: true, c: { armor: 0x5a5048, armor2: 0x3a3430, suit: 0x4a4038, trim: 0x2a2420, leather: 0x3a2a1e, boot: 0x2a2018, cloth: 0x6a5a4a }, face: { skin: SKIN[4], hair: HAIR[0], style: 'crop', fem: true } },
    { helm: true, c: { armor: 0x5a5048, armor2: 0x8a9298, suit: 0x3e3630, trim: 0x2a2420, leather: 0x3a2a1e, boot: 0x2a2018, cloth: 0x6a5a4a }, face: { skin: SKIN[1], hair: HAIR[2], style: 'crop' } },
    { hood: true, c: { armor: 0x6a5a4a, armor2: 0x4a4038, suit: 0x3e3630, trim: 0x2a2420, leather: 0x3a2a1e, boot: 0x2a2018, cloth: 0x7a6650 }, face: { skin: SKIN[6], hair: HAIR[0], style: 'buzz' } },
  ] },
};
// (a kind not listed, an old save's or a mod's: dressed as a grown-up in plain clothes)
const kindOf = kind => CIV_LOOKS[kind] ? kind : 'prisoner';

/* ---------------- the figure (ground at y 0, facing +z) ---------------- */

// trousers into soft boots
function legs(k, w){
  const thighs = [];
  for (const s of [-1, 1]){
    const L = legBones(k, 0.16 * s);
    thighs.push(L.thigh);
    k.add(limb(0.5, [[-0.04,0.2*w,0.21],[0.2,0.19*w,0.2],[0.8,0.15*w,0.155],[1,0.14*w,0.145]], KEEL), 'suit', L.thigh);
    k.add(limb(0.38, [[0,0.15*w,0.16],[0.4,0.15*w,0.16],[0.85,0.13*w,0.14],[1,0.125*w,0.135]], KEEL), 'suit', L.shin, [0, 0, 0.005]);
    k.add(limb(0.2, [[0,0.135*w,0.145],[0.8,0.145*w,0.155],[1,0.15*w,0.16]], KEEL), 'boot', L.shin, [0, -0.2, 0.005]);   // a low boot over the ankle
    k.add(plate([[-0.075,0.035],[-0.09,-0.075],[0.16,-0.085],[0.21,-0.05],[0.1,0.0],[0.03,0.04]].map(([x, y]) => [x * 1.08, y * 1.08]), 0.13*w, 0.014), 'boot', L.foot, [0, 0, 0], [0, -PI/2, 0]);
  }
  return thighs;
}

// hips and belt; a robe's long skirt (front panels riding the thighs so the stride opens them, the back hanging full),
// or a tunic's short one
function hips(k, w, thighs, len, o = {}){
  w *= FRAME.hips;   // (the troopers' frame: enemies/detail.js FRAME)
  k.add(loft([{ y:0.84, w:0.38*w, d:0.26 }, { y:0.98, w:0.44*w, d:0.29 }, { y:1.08, w:0.4*w, d:0.27 }], SOFT_BODY), o.suit ? 'armor' : 'suit');
  k.add(loft([{ y:0.96, w:0.46*w, d:0.31 }, { y:1.12, w:0.45*w, d:0.3 }], SOFT_BODY), 'armor');
  if (o.sash) k.add(loft([{ y:1.04, w:0.49*w, d:0.325 }, { y:1.11, w:0.485*w, d:0.322 }], SOFT_BODY), 'trim', k.root, [0,0,0], [0,0,0], NO_INK);
  k.add(loft([{ y:1.0, w:0.48*w, d:0.32 }, { y:1.05, w:0.48*w, d:0.32 }], SOFT_BODY), 'leather', k.root, [0,0,0], [0,0,0], NO_INK);   // belt
  k.add(block(0.06, 0.045, 0.02, 0.3), 'leather', k.root, [0, 1.025, 0.165], [0,0,0], NO_INK);
  if (!len) return;
  for (const [x, ry, z] of [[-0.2, 0.5, -0.12], [0, 0, -0.17], [0.2, -0.5, -0.12]]){
    const c = x === 0;
    k.add(plate([[-0.13*w,0],[0.13*w,0],[(c ? 0.16 : 0.19)*w,-len],[0,-len - 0.03],[-(c ? 0.16 : 0.19)*w,-len]], 0.016, 0.004), 'armor', k.root, [x*w, 1.03, z], [0.1, ry, 0], NO_INK);
  }
  thighs.forEach((T, i) => {
    const s = i ? 1 : -1;
    k.add(plate([[0,0.09],[0.12*s,0.09],[0.15*s,-len + 0.08],[0,-len + 0.05]], 0.014, 0.004), 'armor', T, [-0.08*s, 0, 0.14], [-0.06, 0.28*s, 0], NO_INK);
    k.add(plate([[0,0.09],[0.1*s,0.09],[0.12*s,-len + 0.06],[0,-len + 0.05]], 0.014, 0.004), 'armor', T, [-0.08*s, 0, 0.14], [-0.06, -0.38*s, 0], NO_INK);
    k.add(plate([[0,0.09],[0.1*s,0.09],[0.12*s,-len + 0.09],[0,-len + 0.08]], 0.014, 0.004), 'armor', T, [0.04*s, 0, 0.1], [-0.06, 0.9*s, 0], NO_INK);
    if (o.tabard) k.add(plate([[-0.05,0.085],[0.05,0.085],[0.036,-len*0.82],[0,-len*0.82 - 0.03],[-0.036,-len*0.82]], 0.016, 0.004), 'armor2', T, [0, 0, 0.165], [-0.06, 0, 0], NO_INK);
  });
}

// the body: a soft tunic or jumpsuit, round shoulders (no plate), a collar; crossed lapels (a tabard) or a zip and patch
function chest(k, w, f, o = {}){
  const b = f ? 1.05 : 1;
  // the round shoulders sit on the troopers' shoulder line; the body itself in the troopers' FRAME (enemies/detail.js)
  for (const s of [-1, 1]) k.add(loft([{ y:-0.07, w:0.16*w, d:0.17 }, { y:0.01, w:0.16*w, d:0.17 }, { y:0.06, w:0.12*w, d:0.13 }, { y:0.085, w:0.065*w, d:0.08 }], ngon(12)), 'armor', k.root, [FRAME.shx*w*s, 1.74, 0], [0, 0, -0.42*s]);
  { const T = k.group(k.root); T.scale.set(FRAME.chest, 1, FRAME.depth); k = k.within(T); }
  k.add(loft([{ y:1.07, w:0.36*w*(f ? 0.9 : 1), d:0.24 }, { y:1.28, w:0.38*w*(f ? 0.86 : 1), d:0.25 }], ROBE), 'armor');
  k.add(loft([{ y:1.26, w:0.4*w*(f ? 0.88 : 1), d:0.27 }, { y:1.44, w:0.53*w, d:0.31*b, z:0.01*b }, { y:1.58, w:0.58*w, d:0.33*b, z:0.014*b }, { y:1.7, w:0.6*w, d:0.31 },
              { y:1.79, w:0.52*w, d:0.27 }, { y:1.86, w:0.37*w, d:0.22 }, { y:1.92, w:0.23, d:0.18 }], ROBE), 'armor');
  if (o.suit){
    k.add(loft([{ y:1.84, w:0.25, d:0.2 }, { y:1.95, w:0.2, d:0.17 }], SOFT), 'armor2');   // the jumpsuit's collar
    k.add(block(0.018, 0.6, 0.015, 0.3), 'armor2', k.root, [0, 1.56, 0.163*b], [-0.05, 0, 0], NO_INK);   // its zip
    k.add(block(0.11, 0.07, 0.012, 0.3), 'trim', k.root, [-0.14*w, 1.62, 0.158*b], [0, -0.18, 0], NO_INK);   // the number patch
    k.add(block(0.07, 0.012, 0.004, 0.3), 'leather', k.root, [-0.14*w, 1.63, 0.166*b], [0, -0.18, 0], NO_INK);
    k.add(block(0.05, 0.012, 0.004, 0.3), 'leather', k.root, [-0.145*w, 1.61, 0.166*b], [0, -0.18, 0], NO_INK);
    return;
  }
  k.add(loft([{ y:1.84, w:0.24, d:0.19 }, { y:1.95, w:0.18, d:0.15 }], SOFT), 'armor2');   // the high collar
  for (const s of [-1, 1]){
    const p = [[-0.035,0],[0.035,0],[0.035,-0.6],[-0.035,-0.6]];
    k.add(plate(p, 0.012, 0.003), 'armor2', k.root, [0.11*w*s, 1.88, 0.15*b], [-0.16*b, 0, -0.2*s], NO_INK);
    k.add(plate(p, 0.012, 0.003), 'armor2', k.root, [0.11*w*s, 1.88, -0.15], [0.12, 0, -0.2*s], NO_INK);
  }
}

// a little beskar helmet with the creed's T-visor (a foundling's), on the head bone
function smallHelm(k, h){
  k.add(loft([{ y:-0.04, w:0.13, d:0.13 }, { y:0.08, w:0.12, d:0.12 }], ngon(8, PI/8)), 'suit', h);   // neck
  k.add(loft([{ y:0.0, w:0.25, d:0.27 }, { y:0.1, w:0.27, d:0.29 }, { y:0.24, w:0.27, d:0.29 }, { y:0.33, w:0.22, d:0.25 }, { y:0.38, w:0.12, d:0.15 }], rounded(chamfer(0.3))), 'armor2', h);
  k.add(block(0.2, 0.045, 0.02, 0.3), 'black', h, [0, 0.2, 0.142], [0,0,0], NO_INK);   // the T: the brow slot...
  k.add(block(0.05, 0.12, 0.02, 0.3), 'black', h, [0, 0.13, 0.142], [0,0,0], NO_INK);  // ...and the stem
  for (const s of [-1, 1]) k.add(block(0.03, 0.09, 0.06, 0.3), 'armor2', h, [0.135*s, 0.12, 0.02]);   // the ear caps
}

function design(k, kind, L, P){
  const f = !!(L.face && L.face.fem), child = !!P.child;
  const w = (f ? 0.88 : 0.96) * (child ? 1.08 : 1);   // (a child's limbs a touch rounder for its size)
  k.sleeve = 'armor'; k.bell = !!L.robe;   // the arms are sleeves (mesh.js arm), belled at the wrist in a robe
  const thighs = legs(k, w);
  hips(k, w, thighs, L.robe ? 0.74 : child ? 0.3 : 0, { sash: !L.suit, tabard: L.robe || kind === 'youngling', suit: !!L.suit });
  k = upper(k);
  chest(k, w, f, { suit: !!L.suit });
  if (L.hood) cowl(k, w);
  if (L.helm || (kind === 'foundling' && !L.hood)) cape(k, [[-0.26*w,0],[0.26*w,0],[0.34*w,-1.0],[0.12,-1.08],[-0.12,-1.08],[-0.34*w,-1.0]], [0, 1.86, -0.2], 0.08);   // a foundling's rough cloak
  // both arms free, hanging and swinging with the walk (enemies/upper.js armsSwing): each its own slot
  for (const s of [-1, 1]) sideArm(k, w, s, [0.04, 0, -0.1], { bend: -0.22 });
  // the head on the neck bone (enemies/upper.js turns it to look about), sized for the kind: a child's big
  const hb = k.bone('head', k.root, [0, 1.96, 0], [0,0,0], NECK);
  const h = k.group(hb); h.scale.setScalar(P.head);
  if (L.helm){ smallHelm(k, h); return; }
  const F = L.face;
  face(k, h, { ...F, fine: true, fem: f || child, beard: child ? null : F.beard, style: L.hood ? (F.style === 'bald' ? 'bald' : 'buzz') : F.style });
  if (L.braid){   // a padawan's braid, from behind the right ear down to the collarbone
    for (let i = 0; i < 6; i++) k.add(block(0.032 - i*0.002, 0.045, 0.03, 0.45), 'hair', h, [-0.115 + i*0.003, 0.14 - i*0.042, 0.02 + i*0.012], [0.1 * (i % 2 ? 1 : -1), 0, 0.08]);
  }
  if (L.hood) hood(k, h);
}

/* ---------------- build ---------------- */

/* one of the people a mission saves, as a group the game moves (its position, heading, lean and fall), with `vis`
   inside it for the gait's bob and sway (as every trooper: enemies/mesh.js buildEnemyMesh). kind: archivist,
   prisoner, youngling, foundling; seed picks the look */
export function buildCivilian(kind, seed = 0){
  kind = kindOf(kind);
  const P = CIV_LOOKS[kind], li = ((seed % P.looks.length) + P.looks.length) % P.looks.length, L = P.looks[li];
  const F = L.face || {};
  const baked = bakeDesign('civ:' + kind + ':' + li, k => design(k, kind, L, P), {
    ...L.c, armor: cloth(L.c.armor), armor2: L.helm ? { c: L.c.armor2, r: 0.35, m: 0.75 } : cloth(L.c.armor2), suit: cloth(L.c.suit), cloth: cloth(L.c.cloth ?? L.c.armor),
    glove: F.skin ?? 0xb88a6a,   // (bare hands: the sleeves' hands are the 'glove' key)
    skin: F.skin, hair: F.hair, beard: F.hair, stubble: F.hair, lip: 0x8a5444,
    socket: F.skin != null ? new THREE.Color(F.skin).multiplyScalar(0.72).getHex() : 0x6a4c3a, iris: 0x3a2a1c,
  });
  const vis = instantiate(baked, { seed: seed * 7.3, wear: -2 }), g = new THREE.Group();   // (wear below 0: clean cloth, no grime)
  vis.scale.setScalar(0.97 + ((seed * 0.618) % 1) * 0.06);   // no two quite the same height
  g.rotation.order = 'YXZ';
  g.add(vis);
  const u = g.userData = vis.userData;
  u.vis = vis;
  u.model = 'civilian';
  u.civ = kind;
  u.armSwing = P.child ? [0.9, 0.9] : [0.7, 0.7];
  if (u.lids) u.lids.scale.y = LID_OPEN;
  u.eyeBase = new THREE.Vector3(1, 1, 1);
  g.scale.setScalar(P.scale);
  return g;
}

// every look of every kind, for engine/prewarm.js to bake ahead
export const CIV_PREWARM = Object.entries(CIV_LOOKS).flatMap(([kind, P]) => P.looks.map((_, i) => [kind, i]));

/* THE COWER: arms up over the head, hunched (a line overrun, a foe shoving past, a child frozen where it hid), laid over
   whatever enemies/upper.js posed, by `c` 0 → 1 */
export function cowerArms(g, c){
  const u = g.userData;
  if (!(c > 0.001)) return;
  [u.offArm, u.offArmR].forEach((a, i) => {
    if (!a) return;
    const s = i ? 1 : -1;
    a.rotation.x += (-1.25 - a.rotation.x) * c;   // the upper arm forward and up...
    a.rotation.z += (-0.38 * s - a.rotation.z) * c;   // ...in across the chest...
    const el = a.children.find(o => o.name && o.name.startsWith('fore:'));
    if (el) el.rotation.x += (-2.35 - el.rotation.x) * c;   // ...and the forearm folded up over the face
  });
  if (u.chest) u.chest.rotation.x += 0.4 * c;
  if (u.head) u.head.rotation.x += 0.35 * c;
}

/* each frame, after the game has set where one stands and how it leans or lies (st: its own animation state, kept on
   the caller's record): the legs walk off its measured motion (enemies/gait.js), the body breathes, glances about and
   swings its arms (enemies/upper.js); knocked down, it all goes slack (mode 'off', the fall's curl); cower 0 → 1 */
export function animateCivilian(g, st, dt, down = false, cower = 0){
  if (!(dt > 0)) return;
  st.cw = (st.cw || 0) + ((down ? 0 : cower) - (st.cw || 0)) * Math.min(1, dt * 8);
  updateLegs(st, g, dt, down ? 'off' : 'ground');
  updateUpper(st, g, dt, null, down ? 'off' : 'on');
  cowerArms(g, st.cw);
}
