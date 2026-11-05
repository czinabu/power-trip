// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The Mandalorian outfit, split into SLOTS (legs, torso, arms, helmet, cape, jetpack) with named variants, the same
// way jedi.js works. Every Mando part starts hidden; setHero() shows them for the bounty hunter.
// The jetpack variant must set player.jetGlow / jetFuelSegs / jetMissileMesh (flight.js and gadgets.js drive them).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loft, limb, plate, block, shard, chamfer, ngon, KEEL, SHIELD, HEAD } from './shapes.js';
import { hand } from './jedi.js';
import { seg, rounded } from './skin.js';
import { DIM } from './rig.js';

// rounded-off sections: the bucket, pauldrons and gorget shade as pressed metal, not cut blocks
const SOFT = rounded(chamfer(0.42)), SOFT_HEAD = rounded(HEAD);

// a domed rivet head flat against a plate (+z out of it)
let _rivet = null;
const rivetGeo = () => _rivet || (_rivet = loft([{ y:0, w:0.02, d:0.02 }, { y:0.005, w:0.016, d:0.016 }, { y:0.009, w:0.007, d:0.007 }], ngon(6)).rotateX(Math.PI/2));
// several rivets on one parent as ONE mesh (a draw call, not one per rivet)
function rivets(k, parent, pts, r = [0, 0, 0]){
  const e = new THREE.Euler(...r), m = new THREE.Matrix4();
  const geo = mergeGeometries(pts.map(p => rivetGeo().clone().applyMatrix4(m.makeRotationFromEuler(e).setPosition(...p))));
  k.add(geo, 'beskar', parent, [0, 0, 0], [0, 0, 0], { outline: false });
}

const mirror = pts => pts.map(([x, y]) => [-x, y]).reverse();
const SEAM_COOL = 0x5fd8ff, SEAM_WARM = 0xff7a3d;

export const MANDO_PARTS = {
  legs: {
    // suit, thigh plate, knee cop, shin greave, armored boot, right-hip holster
    armored(R, k){
      for (const L of [R.legL, R.legR]){
        // the flight suit: one surface over hip and knee, down into the boot
        k.skin('suit', [
          ...seg(DIM.thigh, [[-0.06,0.18,0.18],[0.2,0.17,0.17],[0.75,0.13,0.14],[1,0.11,0.12]]),
          ...seg(DIM.shin, [[0.1,0.14,0.15],[0.45,0.135,0.145],[0.8,0.115,0.125],[1,0.115,0.125]], DIM.thigh),
        ], { bones: [L.hip, L.knee], at: [DIM.thigh] });
        k.add(plate([[-0.07,0],[0.07,0],[0.078,-0.2],[0,-0.25],[-0.078,-0.2]], 0.03, 0.01), 'beskar2', L.hip, [0, -0.07, 0.085], [-0.06, 0, 0]);
        rivets(k, L.hip, [[0.055, -0.085, 0.107], [-0.055, -0.085, 0.107]], [-0.06, 0, 0]);
        k.add(plate([[-0.055,0.04],[0.055,0.04],[0.065,-0.02],[0,-0.07],[-0.065,-0.02]], 0.03, 0.01), 'beskar', L.knee, [0, 0, 0.07]);
        k.add(limb(DIM.shin - 0.09, [[0,0.125,0.11,0.02],[0.3,0.15,0.13,0.02],[1,0.12,0.1,0.02]], KEEL), 'beskar2', L.knee, [0, -0.08, 0]);
        k.add(plate([[-0.075,0.035],[-0.09,-0.075],[0.16,-0.085],[0.21,-0.05],[0.1,0.0],[0.03,0.04]], 0.115, 0.014),
          'strap', L.ank, [0, 0, 0], [0, -Math.PI/2, 0]);
        k.seam(new THREE.BoxGeometry(0.008, 0.2, 0.008), SEAM_COOL, L.knee, [0, -0.2, 0.085]);   // greave line
      }
      k.add(block(0.075, 0.17, 0.09, 0.35), 'strap', R.legR.hip, [0.06, -0.28, 0.04]);
    },
  },

  torso: {
    // suit under pec plates, segmented abdomen, keystone, belt + pouches, back plate, pack straps
    cuirass(R, k){
      // the suit from pelvis to collar is one surface that bends and twists through the hips, torso and chest joints
      k.skin('suit', [
        { t:-0.12, w:0.3, d:0.2 }, { t:0, w:0.34, d:0.22 }, { t:DIM.torsoY, w:0.31, d:0.2 }, { t:DIM.torsoY + DIM.chestY - 0.1, w:0.29, d:0.19 },
        ...seg(1, [[0,0.33,0.22],[0.14,0.45,0.265],[0.27,0.505,0.255],[0.35,0.36,0.2],[0.4,0.2,0.15]], DIM.torsoY + DIM.chestY),
      ], { bones: [R.hips, R.torso, R.chest], at: [DIM.torsoY, DIM.torsoY + DIM.chestY], blend: 0.07, profile: SHIELD, dir: 1 });
      k.add(loft([{ y:0.04, w:0.38, d:0.26 }, { y:0.17, w:0.37, d:0.255 }], SHIELD), 'strap', R.torso);
      for (const bx of [-0.12, 0.12]) k.add(block(0.085, 0.1, 0.06, 0.3), 'beskar2', R.torso, [bx, 0.08, 0.14]);
      const abPlate = plate([[-0.115,-0.035],[0.115,-0.035],[0.125,0.03],[-0.125,0.03]], 0.028, 0.008);
      k.add(abPlate, 'beskar2', R.torso, [0, 0.25, 0.108], [0.05, 0, 0]);
      k.add(abPlate, 'beskar2', R.torso, [0, 0.32, 0.112], [0.08, 0, 0], { scale: [1.08, 1, 1] });
      k.seam(new THREE.BoxGeometry(0.22, 0.008, 0.008), SEAM_WARM, R.torso, [0, 0.285, 0.13]);

      const pec = [[0.0,0.0],[0.165,0.02],[0.19,0.13],[0.15,0.19],[0.02,0.17]];
      k.add(plate(pec, 0.04, 0.012), 'beskar', R.chest, [0.012, 0.12, 0.125], [-0.06, 0.22, 0]);
      k.add(plate(mirror(pec), 0.04, 0.012), 'beskar', R.chest, [-0.012, 0.12, 0.125], [-0.06, -0.22, 0]);
      for (const sx of [-1, 1]) k.seam(new THREE.BoxGeometry(0.008, 0.16, 0.008), SEAM_COOL, R.chest, [0.19*sx, 0.2, 0.1], [0, 0, 0.25*sx]);
      k.add(shard(0.05, 0.11, 0.03), 'accent', R.chest, [0, 0.03, 0.14]);   // keystone
      k.add(loft([{ y:0.33, w:0.24, d:0.2 }, { y:0.45, w:0.165, d:0.155 }], SOFT), 'suit', R.chest);   // gorget
      k.add(plate([[-0.17,0],[0.17,0],[0.15,0.24],[-0.15,0.24]], 0.03, 0.01), 'beskar2', R.chest, [0, 0.06, -0.125]);
      for (const sx of [-1, 1]) k.add(block(0.05, 0.42, 0.03, 0.2), 'strap', R.chest, [0.13*sx, 0.18, 0.13], [-0.25, 0, 0]);
      // PLATE LAYERING: rivets at the pec plates' corners and the back plate's, a dark gap line where each pec meets the
      // suit, so the beskar reads as separate plates strapped over the flight suit
      rivets(k, R.chest, [[0.05, 0.155, 0.152], [0.17, 0.165, 0.142], [-0.05, 0.155, 0.152], [-0.17, 0.165, 0.142]]);
      rivets(k, R.chest, [[0.13, 0.27, -0.142], [-0.13, 0.27, -0.142]], [0, Math.PI, 0]);
      for (const sx of [-1, 1]) k.add(block(0.006, 0.17, 0.006, 0.2), 'suit', R.chest, [0.205*sx, 0.2, 0.118], [0, 0, 0.25*sx], { outline: false });
      // GEAR THAT MOVES: two pouches and a cable coil on the belt, each on a pivot that bounces and lags with the stride
      // (model/life.js gearSway)
      const gear = (x, z, ry) => { const g = k.group(R.hips, [x, 0.08, z], [0, ry, 0]); g.userData.rest = g.rotation.clone(); (R.hips.userData.gear || (R.hips.userData.gear = [])).push(g); return g; };
      for (const sx of [-1, 1]){
        const p = gear(0.17*sx, 0.11, 0.35*sx);
        k.add(block(0.07, 0.085, 0.055, 0.3), 'strap', p, [0, -0.045, 0.012]);
        k.add(block(0.074, 0.025, 0.06, 0.3), 'suit', p, [0, -0.002, 0.014], [0, 0, 0], { outline: false });
      }
      const coil = gear(-0.2, -0.06, -1.2);
      k.add(new THREE.TorusGeometry(0.045, 0.012, 5, 10), 'suit', coil, [0, -0.06, -0.01], [0, Math.PI/2, 0]);
      // JETPACK HOSES: from the belt up into the pack's underside, skinned over the hips, waist and chest so they bend
      // and twist with the body instead of cutting through it
      for (const sx of [-1, 1]) k.skin('suit', [
        { t:0.0, w:0.03, d:0.03, x:0.15*sx, z:-0.16 }, { t:0.1, w:0.03, d:0.03, x:0.16*sx, z:-0.2 },
        { t:0.22, w:0.03, d:0.03, x:0.15*sx, z:-0.24 }, { t:0.32, w:0.03, d:0.03, x:0.13*sx, z:-0.27 },
      ], { bones: [R.hips, R.torso, R.chest], at: [DIM.torsoY, DIM.torsoY + DIM.chestY], blend: 0.07, profile: ngon(6), dir: 1 });
    },
  },

  arms: {
    // suit sleeves, pauldrons (accent colour on the right), bracers with a gauntlet plate, gloves
    pauldrons(R, k){ arms(R, k, true); },
    // no shoulder armour, for a lighter scout look
    bare(R, k){ arms(R, k, false); },
    // layered war pauldrons on both shoulders, accent on both
    heavy(R, k){ arms(R, k, 'heavy'); },
  },

  helmet: {
    // T-visor, chiseled dome, comm caps, rangefinder stalk (Boba, Din)
    tvisor(R, k){ helmet(R, k, { rangefinder: true }); },
    // the same bucket without the stalk
    clean(R, k){ helmet(R, k, {}); },
    // a raised crest along the dome and swept cheek guards (Death Watch)
    crest(R, k){ helmet(R, k, { crest: true, cheeks: true }); },
  },

  cape: {
    // Both capes are worn UNDER the jetpack, as Boba and Din wear theirs: the top panel hangs in the gap between the
    // back plate and the pack, and a cloth hem hangs free below the pack (capeHem, simulated by cloth.js). animation.js only
    // lets the top panel sway sideways in that gap; the hem takes the trail and flutter, so it never swings through
    // the pack. (The pack's front face sits at chest z ≈ -0.26, the back plate at ≈ -0.14.)
    // half cape off the left shoulder (Boba): a strip shows beside the left tank, the ragged hem below the pack
    half(R, k){
      R.cape.position.set(-0.2, 0.36, -0.2); R.cape.rotation.set(0, 0, 0);
      k.add(plate([[-0.18,0.0],[0.13,0.0],[0.15,-0.74],[-0.2,-0.74]], 0.012, 0.004), 'cloth', R.cape, [0, 0, 0], [0, 0, 0], { outline: false });
      capeHem(R, k, { top: [-0.2, 0.15], bottom: [-0.22, 0.12], drop: [-0.4, -0.24], dip: 0.04 });
    },
    // full cape across both shoulders, down to the knees below the pack
    full(R, k){
      R.cape.position.set(0, 0.36, -0.2); R.cape.rotation.set(0, 0, 0);
      k.add(plate([[-0.26,0.0],[0.26,0.0],[0.29,-0.74],[-0.29,-0.74]], 0.012, 0.004), 'cloth', R.cape, [0, 0, 0], [0, 0, 0], { outline: false });
      capeHem(R, k, { top: [-0.29, 0.29], bottom: [-0.33, 0.33], drop: [-0.5, -0.5], dip: 0.06 });
    },
    none(){},
  },

  // THE BESKAR FORGE's pieces (data/beskar-forge.js): looks only
  signet: {
    none(){},
    mudhorn(R, k){ signet(R, k, MUDHORN); },
    mythosaur(R, k){ signet(R, k, MYTHOSAUR); },
    owl(R, k){ signet(R, k, OWL); },
    jaig(R, k){ jaigEyes(R, k); },
  },
  // a helmet's silhouette piece, on top of whichever HELMET the customizer picked
  helmod: {
    none(){},
    fins(R, k){ helmetMod(R, k, 'fins'); },
    plume(R, k){ helmetMod(R, k, 'plume'); },
    horns(R, k){ helmetMod(R, k, 'horns'); },
  },
  vambrace: {
    standard(){},   // (the gauntlet plate arms() always builds)
    whistler(R, k){ vambrace(R, k, 'whistler'); },
    flame(R, k){ vambrace(R, k, 'flame'); },
    plated(R, k){ vambrace(R, k, 'plated'); },
  },
  chest: {
    none(){},
    bandolier(R, k){ chestKit(R, k, 'bandolier'); },
    gorget(R, k){ chestKit(R, k, 'gorget'); },
    sash(R, k){ chestKit(R, k, 'sash'); },
  },

  jetpack: {
    // THE BESKAR FORGE's jetpacks (data/beskar-forge.js) are the standard pack with more bolted on: swept wings out past
    // the tanks, or a pair of reserve canisters slung outboard. Both change the hero's outline from behind
    winged(R, k, player){
      MANDO_PARTS.jetpack.standard(R, k, player);
      const wing = [[0,0.14],[0.12,0.1],[0.26,-0.02],[0.24,-0.08],[0.1,-0.04],[0,-0.12]];
      for (const sx of [-1, 1]){
        k.add(plate(wing, 0.022, 0.006), 'beskar', R.back, [0.28*sx, 0.02, -0.21], [0, 0, -0.25*sx], { scale: [sx, 1, 1] });
        k.add(plate([[0,0.02],[0.2,-0.04],[0.2,-0.06],[0,-0.02]], 0.024, 0.004), 'accent', R.back, [0.3*sx, 0.03, -0.225], [0, 0, -0.25*sx], { outline: false, scale: [sx, 1, 1] });
      }
    },
    heavy(R, k, player){
      MANDO_PARTS.jetpack.standard(R, k, player);
      for (const sx of [-1, 1]){
        k.add(loft([{ y:-0.2, w:0.12, d:0.12 }, { y:0.14, w:0.12, d:0.12 }, { y:0.19, w:0.07, d:0.07 }], ngon(8, Math.PI/8)), 'beskar', R.back, [0.36*sx, -0.06, -0.22]);
        for (const y of [-0.12, 0.06]) k.add(block(0.2, 0.02, 0.13, 0.2), 'strap', R.back, [0.3*sx, y, -0.22], [0, 0, 0], { outline: false });
        k.add(loft([{ y:-0.04, w:0.06, d:0.06 }, { y:0.03, w:0.1, d:0.1 }], ngon(8)), 'beskar2', R.back, [0.36*sx, -0.3, -0.22]);
      }
    },
    // Boba-style pack: ribbed core, twin domed tanks, bell nozzles, antenna, mount for the back missile
    standard(R, k, player){
      const jet = k.group(R.back, [0, 0, -0.22]);   // its -z faces the camera
      k.add(block(0.4, 0.58, 0.18, 0.3), 'suit', jet);
      k.add(block(0.24, 0.48, 0.1, 0.3), 'beskar2', jet, [0, 0, -0.1]);
      for (const sx of [-1, 1]){
        k.add(block(0.08, 0.44, 0.06, 0.35), 'beskar', jet, [0.055*sx, 0, -0.16]);
        for (let i = 0; i < 5; i++) k.add(new THREE.BoxGeometry(0.088, 0.012, 0.03), 'suit', jet, [0.055*sx, -0.17 + i*0.085, -0.19], [0,0,0], { outline: false });
        k.add(loft([{ y:-0.25, w:0.2, d:0.2 }, { y:0.2, w:0.2, d:0.2 }, { y:0.26, w:0.16, d:0.16 }, { y:0.32, w:0.06, d:0.06 }], ngon(8, Math.PI/8)), 'beskar2', jet, [0.2*sx, -0.02, 0]);
        k.add(loft([{ y:-0.09, w:0.09, d:0.09 }, { y:0.08, w:0.17, d:0.17 }], ngon(8, Math.PI/8)), 'beskar', jet, [0.2*sx, -0.35, 0.01], [0, 0, -0.1*sx]);
        k.seam(new THREE.BoxGeometry(0.006, 0.2, 0.006), SEAM_COOL, jet, [0.055*sx, 0, -0.195]);
      }
      k.add(block(0.028, 0.46, 0.03, 0.3), 'accent', jet, [0, 0, -0.2]);
      k.add(loft([{ y:-0.15, w:0.03, d:0.03 }, { y:0.15, w:0.022, d:0.022 }], ngon(6)), 'beskar', jet, [0.13, 0.46, -0.02]);
      k.add(shard(0.04, 0.07, 0.04), 'accent', jet, [0.13, 0.6, -0.02]);
      k.add(loft([{ y:-0.05, w:0.17, d:0.17 }, { y:0.05, w:0.12, d:0.12 }], ngon(8, Math.PI/8)), 'beskar', jet, [0, 0.32, 0]);

      // back missile: shown once the JETPACK MISSILE ability is unlocked, hidden while it recharges
      const jmiss = new THREE.Group(); jmiss.position.set(0, 0.43, -0.03); jet.add(jmiss);
      k.style.add(loft([{ y:-0.15, w:0.124, d:0.124 }, { y:0.15, w:0.124, d:0.124 }], ngon(8, Math.PI/8)), k.mat('beskar2'), jmiss);
      k.style.add(loft([{ y:0.15, w:0.124, d:0.124 }, { y:0.28, w:0.001, d:0.001 }], ngon(8, Math.PI/8)), k.mat('accent'), jmiss);
      for (let fi = 0; fi < 3; fi++){ const a = fi/3*Math.PI*2;
        k.style.add(plate([[0,0],[0.05,-0.02],[0.05,-0.1],[0,-0.07]], 0.012, 0.003), k.mat('beskar'), jmiss, [Math.cos(a)*0.05, -0.08, Math.sin(a)*0.05], [0, -a, 0]); }
      jmiss.visible = false; player.jetMissileMesh = jmiss;

      const glowMat = () => new THREE.MeshBasicMaterial({ color: 0x59c6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      player.jetGlow = [-1, 1].map(sx => {
        const g = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.025, 0.13, 8), glowMat());
        g.position.set(0.18*sx, -0.47, 0.01); g.rotation.z = -0.1*sx; jet.add(g); return g;
      });
      // diegetic fuel gauge: LED strips on the tanks' camera-facing side, filled bottom → top by flight.js
      const fuelSegs = [], SEG_N = 6;
      for (const sx of [-1, 1]) for (let i = 0; i < SEG_N; i++){
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.02),
          new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
        seg.position.set(0.2*sx, -0.17 + i*0.072, -0.105); jet.add(seg);
        fuelSegs.push({ mesh: seg, thr: i / SEG_N });
      }
      player.jetFuelSegs = fuelSegs;
    },
  },
};

/* the cape below the pack is real cloth (cloth.js), pinned along the bottom of the top panel: it trails, flutters
   and swings on a turn by itself, and the legs and hips push it aside. top/bottom = [left x, right x],
   drop = how far each side hangs, dip = extra length at the middle */
function capeHem(R, k, { top, bottom, drop, dip }){
  const lerp = (a, b, t) => a + (b - a) * t;
  R.cape.userData.hem = k.group(R.cape, [0, -0.74, 0]);   // marks the cape as worn under the pack (animation.js)
  k.cloth('cloth', R.cape, { W: 6, H: 7, thick: 0.012, outline: false, capsules: k.bodyCapsules(), slack: 0.8,
    rest: (u, v) => {
      const t = (u + 1) / 2;
      return [lerp(lerp(top[0], top[1], t), lerp(bottom[0], bottom[1], t), v),
        -0.73 + v * (lerp(drop[0], drop[1], t) - dip * (1 - Math.abs(u))), 0];
    } });
}

/* the bucket: dome, T-visor and chin guard, then the optional rangefinder stalk, crest and cheek guards */
function helmet(R, k, { rangefinder, crest, cheeks }){
  const helm = k.group(R.head);
  k.add(loft([{ y:-0.1, w:0.12, d:0.12 }, { y:0.04, w:0.11, d:0.11 }], ngon(10, Math.PI/10)), 'suit', helm);
  k.add(loft([
    { y:0.0,  w:0.205, d:0.225, z:0.005 },
    { y:0.07, w:0.215, d:0.235, z:0.005 },
    { y:0.2,  w:0.235, d:0.25 },
    { y:0.3,  w:0.222, d:0.24, z:-0.005 },
    { y:0.345, w:0.19, d:0.212, z:-0.008 },
    { y:0.375, w:0.13, d:0.155, z:-0.01 },
    { y:0.39, w:0.06,  d:0.075, z:-0.01 },
  ], SOFT_HEAD), 'beskar', helm);
  k.add(plate([[-0.098,0.026],[0.098,0.026],[0.104,-0.01],[0.026,-0.02],[-0.026,-0.02],[-0.104,-0.01]], 0.02, 0.003), 'visor', helm, [0, 0.205, 0.121], [0, 0, 0], { outline: false });
  k.add(plate([[-0.024,0],[0.024,0],[0.019,-0.11],[-0.019,-0.11]], 0.02, 0.003), 'visor', helm, [0, 0.192, 0.12], [0.07, 0, 0], { outline: false });
  k.add(block(0.13, 0.05, 0.07, 0.4), 'beskar2', helm, [0, 0.03, 0.08]);   // chin guard
  for (const sx of [-1, 1]) k.add(block(0.03, 0.07, 0.075, 0.35), 'suit', helm, [0.118*sx, 0.15, 0.0]);
  k.seam(new THREE.BoxGeometry(0.17, 0.006, 0.006), SEAM_COOL, helm, [0, 0.205, 0.134]);
  if (rangefinder){
    const fin = k.group(helm, [-0.13, 0.25, 0.01], [0, 0, 0.22]);
    k.add(block(0.016, 0.17, 0.024, 0.3), 'suit', fin, [0, 0.085, 0]);
    k.add(shard(0.03, 0.05, 0.03), 'accent', fin, [0, 0.17, 0]);
  }
  if (crest){
    // a fin from brow to nape in the accent colour, tallest over the crown
    k.add(plate([[-0.15,-0.02],[0.12,-0.02],[0.09,0.04],[-0.02,0.075],[-0.12,0.05]], 0.045, 0.012), 'accent', helm, [0, 0.36, 0.0], [0, -Math.PI/2, 0]);
  }
  if (cheeks) for (const sx of [-1, 1]){
    // swept plates over the jaw, angled back like a Death Watch bucket's
    k.add(plate([[0,0.06],[0.07,0.05],[0.09,-0.04],[0.02,-0.07],[-0.02,-0.02]], 0.02, 0.006), 'beskar2', helm, [0.108*sx, 0.07, 0.04], [0, sx * (Math.PI/2 - 0.25), 0]);
  }
}

function arms(R, k, pauldrons){
  for (const A of [R.armL, R.armR]){
    const s = A.side;
    k.skin('suit', [
      ...seg(0.34, [[-0.18,0.14,0.14],[0.06,0.15,0.15],[0.5,0.125,0.125],[1,0.1,0.105]]),
      ...seg(0.3, [[0.5,0.095,0.095],[1,0.08,0.08]], 0.34),
    ], { bones: [A.sh, A.el], at: [0.34], blend: 0.05, profile: chamfer(0.4) });
    if (pauldrons === 'heavy'){
      // two overlapping plates: a broad cap and a lame below it
      k.add(loft([{ y:-0.07, w:0.25, d:0.23 }, { y:0.03, w:0.24, d:0.22 }, { y:0.1, w:0.15, d:0.17 }], SOFT), 'accent', A.sh, [0.04*s, 0.045, 0], [0, 0, -0.36*s]);
      k.add(loft([{ y:-0.04, w:0.2, d:0.2 }, { y:0.03, w:0.19, d:0.19 }], SOFT), 'beskar', A.sh, [0.07*s, -0.07, 0], [0, 0, -0.42*s]);
    } else if (pauldrons) k.add(loft([{ y:-0.06, w:0.21, d:0.2 }, { y:0.03, w:0.2, d:0.19 }, { y:0.08, w:0.13, d:0.15 }], SOFT),
      s > 0 ? 'accent' : 'beskar', A.sh, [0.025*s, 0.035, 0], [0, 0, -0.32*s]);
    k.add(limb(0.24, [[0,0.11,0.105],[0.6,0.115,0.11],[1,0.098,0.095]], KEEL), 'beskar2', A.el, [0, -0.04, 0]);
    k.add(plate([[-0.04,0],[0.04,0],[0.045,-0.12],[-0.045,-0.12]], 0.02, 0.006), 'beskar', A.el, [0, -0.08, 0.058]);
    k.seam(new THREE.BoxGeometry(0.008, 0.18, 0.008), SEAM_COOL, A.el, [0, -0.16, 0.07]);
    hand(A, k, 'strap');
  }
}

/* ---------- the BESKAR FORGE's pieces (data/beskar-forge.js) ---------- */
// THE SIGNETS: flat outlines ([x, y], about ±0.06), painted in the accent colour on the outside of the left shoulder
const MUDHORN = [[-0.055,-0.03],[-0.04,0.0],[-0.045,0.035],[-0.02,0.02],[0.0,0.045],[0.012,0.025],[0.03,0.05],[0.06,0.062],[0.045,0.02],[0.055,-0.01],[0.03,-0.035],[0.005,-0.02],[-0.02,-0.045]];
const MYTHOSAUR = [[0,0.045],[0.03,0.04],[0.05,0.06],[0.07,0.045],[0.045,0.02],[0.03,-0.015],[0.012,-0.05],[0,-0.04],[-0.012,-0.05],[-0.03,-0.015],[-0.045,0.02],[-0.07,0.045],[-0.05,0.06],[-0.03,0.04]];
const OWL = [[0,0.03],[0.02,0.045],[0.07,0.03],[0.05,0.0],[0.028,-0.005],[0.012,-0.05],[0,-0.035],[-0.012,-0.05],[-0.028,-0.005],[-0.05,0.0],[-0.07,0.03],[-0.02,0.045]];
// the frame on the outside of the left shoulder that a signet lies in (+z out of the shoulder), fitted to the arms worn
function shoulderFace(R, k){
  const A = R.armL.side < 0 ? R.armL : R.armR, s = A.side, arms = k.parts.arms;
  const at = arms === 'heavy' ? { p: [0.04*s, 0.045, 0], tilt: -0.36*s, out: 0.128, y: -0.01 }
    : arms === 'bare' ? { p: [0, -0.02, 0], tilt: 0, out: 0.074, y: -0.04 }
    : { p: [0.025*s, 0.035, 0], tilt: -0.32*s, out: 0.106, y: -0.015 };
  const pad = k.group(A.sh, at.p, [0, 0, at.tilt]);
  return k.group(pad, [at.out * s, at.y, 0], [0, s * Math.PI/2, 0]);
}
function signet(R, k, shape){
  k.add(plate(shape, 0.006, 0.002), 'accent', shoulderFace(R, k), [0, 0, 0.004], [0, 0, 0], { outline: false, scale: 1.6 });
}
// JAIG EYES: the swept marks round the T-visor's brow, given for courage
function jaigEyes(R, k){
  const helm = k.group(R.head);
  const mark = [[0,0.012],[0.075,0.0],[0.11,-0.045],[0.095,-0.05],[0.065,-0.014],[0,-0.006]];
  for (const sx of [-1, 1]) k.add(plate(mark, 0.006, 0.002), 'accent', helm, [0.018*sx, 0.25, 0.123], [-0.12, sx*0.32, 0], { outline: false, scale: [sx * 1.3, 1.3, 1] });
}
function vambrace(R, k, kind){
  for (const A of [R.armL, R.armR]){
    const s = A.side, left = s < 0;
    if (kind === 'plated'){
      // three overlapping plates down the forearm's top, each a little bigger than the gauntlet plate under it
      for (let i = 0; i < 3; i++) k.add(plate([[-0.055,0],[0.055,0],[0.058,-0.07],[-0.058,-0.07]], 0.022, 0.006), 'beskar', A.el, [0, -0.035 - i*0.055, 0.066 + i*0.002], [-0.05, 0, 0]);
      rivets(k, A.el, [[0.045, -0.06, 0.082], [-0.045, -0.06, 0.082]]);
    } else if (kind === 'whistler' && left){
      // the rack: a block on the outside of the forearm, the tube mouths facing the wrist
      k.add(block(0.055, 0.15, 0.08, 0.25), 'beskar2', A.el, [0.075*s, -0.13, 0.008]);
      k.add(block(0.058, 0.02, 0.083, 0.2), 'accent', A.el, [0.075*s, -0.07, 0.008], [0, 0, 0], { outline: false });   // its accent band
      const mouth = loft([{ y:-0.005, w:0.016, d:0.016 }, { y:0.005, w:0.016, d:0.016 }], ngon(6));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.add(mouth, 'accent', A.el, [0.075*s + (j - 0.5)*0.022, -0.207, -0.016 + i*0.024], [0, 0, 0], { outline: false });
    } else if (kind === 'flame' && !left){
      // the tank along the underside of the forearm and the nozzle under the wrist
      k.add(loft([{ y:-0.07, w:0.04, d:0.04 }, { y:0.07, w:0.04, d:0.04 }], ngon(10)), 'beskar2', A.el, [0, -0.12, -0.066]);
      k.add(loft([{ y:-0.02, w:0.03, d:0.03 }, { y:0.02, w:0.022, d:0.022 }], ngon(8)), 'accent', A.el, [0, -0.21, -0.062]);
      k.add(block(0.02, 0.06, 0.02, 0.2), 'suit', A.el, [0, -0.17, -0.05], [0, 0, 0], { outline: false });   // the feed line
    }
  }
}
function chestKit(R, k, kind){
  if (kind === 'gorget'){
    // a forged collar over the throat, standing proud of the suit's own, rivets at its front corners
    k.add(loft([{ y:0.33, w:0.28, d:0.235 }, { y:0.37, w:0.26, d:0.22 }, { y:0.415, w:0.205, d:0.18 }], SOFT), 'beskar', R.chest);
    rivets(k, R.chest, [[0.07, 0.38, 0.108], [-0.07, 0.38, 0.108]]);
  } else if (kind === 'bandolier'){
    // a strap from the left shoulder across to the right hip, over the plates, a row of power cells along it
    const B = k.group(R.chest, [0, 0.13, 0.172], [0, 0, 0.62]);
    k.add(block(0.05, 0.56, 0.016, 0.2), 'strap', B);
    for (let i = 0; i < 5; i++) k.add(block(0.04, 0.045, 0.03, 0.3), 'beskar2', B, [0, -0.14 + i*0.07, 0.016]);
  } else if (kind === 'sash'){
    // a cloth sash from the right shoulder to the left hip, in the cape colour
    const B = k.group(R.chest, [0, 0.12, 0.168], [0, 0, -0.58]);
    k.add(block(0.085, 0.6, 0.012, 0.15), 'cloth', B);
    k.add(block(0.09, 0.03, 0.016, 0.15), 'strap', B, [0, -0.26, 0.004]);   // its knot at the hip
  }
}

// THE HELMET MODS: silhouette pieces on top of the bucket (the BESKAR FORGE)
function helmetMod(R, k, kind){
  const helm = k.group(R.head);
  if (kind === 'fins'){
    // two swept fins rising off the back of the dome
    for (const sx of [-1, 1]) k.add(plate([[0,0],[0.06,0.03],[0.16,0.13],[0.13,0.14],[0.02,0.06]], 0.016, 0.005), 'beskar2', helm, [0.07*sx, 0.33, -0.06], [0, sx * (Math.PI/2 + 0.35), 0]);
  } else if (kind === 'plume'){
    // a crest of cloth from brow to nape, in the cape colour
    k.add(plate([[-0.14,0],[0.12,0],[0.1,0.06],[0.02,0.1],[-0.1,0.09],[-0.17,0.05]], 0.035, 0.01), 'cloth', helm, [0, 0.37, -0.01], [0, -Math.PI/2, 0]);
  } else if (kind === 'horns'){
    // two horns swept up and back from the temples
    for (const sx of [-1, 1]){
      k.add(loft([{ y:0, w:0.04, d:0.04 }, { y:0.1, w:0.03, d:0.03, x:0.03*sx }, { y:0.18, w:0.012, d:0.012, x:0.07*sx }], ngon(6)), 'beskar2', helm, [0.1*sx, 0.3, -0.02], [-0.5, 0, -0.5*sx]);
    }
  }
}
