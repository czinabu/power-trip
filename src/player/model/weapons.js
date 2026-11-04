// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// WEAPON MODELS — a registry of hand-held gear, each mounted on a named rig socket (rig.js) with its own grip.
//   hold   — which pose family the weapon wants (saber-1h, pistol, rifle-2h). animation.js still picks poses by
//            hero/weapon today; this tag is where per-weapon holds plug in when that's reworked.
//   socket — default mount (handR / handL / back / hipL / hipR)
//   grip   — position + rotation of the weapon in the socket: change this to change how it's held
//            (the lightsaber also has a regular/reverse grip preference, see applySaberGrip)
//   build  — returns { group, ...hooks } built in the current render style
// Adding a weapon type = one entry here + mounting it in mountLoadout().

import { offGrip } from '../../data/forms.js';
import * as THREE from 'three';
import { loft, plate, block, ngon, chamfer } from './shapes.js';
import { glow } from '../../engine/renderer.js';
import { carriedLight } from '../../fx/lights.js';

const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
const GRIP_Y = -0.04;   // where the fist closes, below the wrist joint
export const SABER_LIGHT = 8, DARK_LIGHT = 6;   // the blade PointLights at full, in a dark arena (scaled by glow.light)

export const WEAPON_MODELS = {
  saber: {
    hold: 'saber-1h', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [0.25, 0, -0.4] },
    build(S){
      const g = new THREE.Group(), root = new THREE.Group(); g.add(root);   // root flips for the regular grip (see applySaberGrip)
      S.add(loft([
        { y:-0.13, w:0.06, d:0.06 }, { y:-0.11, w:0.078, d:0.078 }, { y:-0.08, w:0.066, d:0.066 },
        { y:0.06, w:0.066, d:0.066 }, { y:0.08, w:0.086, d:0.086 }, { y:0.12, w:0.08, d:0.08 }, { y:0.13, w:0.06, d:0.06 },
      ], ngon(8, Math.PI/8)), 'hilt', root);
      for (let i = 0; i < 4; i++) S.add(block(0.072, 0.012, 0.072, 0.4), 'leather', root, [0, -0.05 + i*0.03, 0], [0,0,0], { outline: false });
      S.add(block(0.022, 0.035, 0.03, 0.3), 'gunDark', root, [0, 0.02, 0.038], [0,0,0], { outline: false });   // activator
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.022, 1.55, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      blade.position.y = 0.95;
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 1.6, 8), glowMat(0x33bbff, 0.45));
      glow.position.y = 0.95;
      glow.userData.saberTrail = { hilt: -1 };   // its streak (fx/trail.js) follows this glow, emitter end down
      const light = carriedLight(new THREE.PointLight(0x44bbff, SABER_LIGHT * glow.light, 9)); light.position.y = 0.9;
      root.add(blade, glow, light);
      /* THE SABER STAFF (data/forms.js staff): the hilt runs on past the pommel to a second emitter, STAFF.end below the
         fist, and a second blade leaves it the other way. The off hand closes on the hilt at STAFF.off. The second
         blade and its glow are children of the first, so they light, retract, re-ignite, smear and hide with it
         (fx/trail.js setBladeLen keeps them on their emitter as the length changes). Hidden until setSaberStaff. */
      const staff = new THREE.Group(); staff.visible = false; root.add(staff);
      S.add(loft([
        { y:-STAFF.end - 0.01, w:0.062, d:0.062 }, { y:-STAFF.end + 0.02, w:0.082, d:0.082 }, { y:-STAFF.end + 0.05, w:0.068, d:0.068 },
        { y:-0.2, w:0.064, d:0.064 }, { y:-0.16, w:0.078, d:0.078 }, { y:-0.12, w:0.07, d:0.07 },
      ], ngon(8, Math.PI/8)), 'hilt', staff);
      for (let i = 0; i < 4; i++) S.add(block(0.072, 0.012, 0.072, 0.4), 'leather', staff, [0, -STAFF.off - 0.05 + i*0.03, 0], [0,0,0], { outline: false });   // the off hand's wrap
      S.add(block(0.022, 0.035, 0.03, 0.3), 'gunDark', staff, [0, -STAFF.end + 0.1, -0.038], [0,0,0], { outline: false });   // its own activator
      S.add(block(0.09, 0.02, 0.09, 0.4), 'accent', staff, [0, -0.17, 0], [0,0,0], { outline: false });   // the coupling at the middle
      const blade2 = new THREE.Mesh(blade.geometry, blade.material), glow2 = new THREE.Mesh(glow.geometry, glow.material);
      blade2.rotation.x = glow2.rotation.x = Math.PI;
      blade.add(blade2); glow.add(glow2);
      blade2.visible = glow2.visible = false;
      glow2.userData.saberTrail = { hilt: -1 };   // flipped, so its local -y is still the end at its emitter
      const staffParts = { hilt: staff, blade2, glow2 };
      root.userData.staffParts = staffParts;
      fitStaffBlades(blade, glow, staffParts, 1);
      return { group: g, bladeRoot: root, blade, glow, light, staff: staffParts };
    },
  },

  pistol: {
    hold: 'pistol', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [1.15, 0, 0] },   // pre-tilted so the raised aim pose points at the reticle
    build(S){
      const g = new THREE.Group();
      S.add(block(0.05, 0.15, 0.068, 0.3), 'gunDark', g, [0, -0.02, 0], [0.34, 0, 0]);
      S.add(block(0.05, 0.085, 0.24, 0.3), 'gunDark', g, [0, 0.09, 0.07]);
      S.add(loft([{ y:-0.13, w:0.058, d:0.05 }, { y:0.13, w:0.058, d:0.05 }], chamfer(0.4)), 'gunMetal', g, [0, 0.135, 0.07], [Math.PI/2, 0, 0]);
      S.add(loft([{ y:-0.08, w:0.042, d:0.042 }, { y:0.08, w:0.036, d:0.036 }], ngon(6)), 'gunMetal', g, [0, 0.115, 0.26], [Math.PI/2, 0, 0]);
      const emit = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.03, 8), new THREE.MeshBasicMaterial({ color: 0xffb84a }));
      emit.rotation.x = Math.PI/2; emit.position.set(0, 0.115, 0.34); g.add(emit);
      S.add(block(0.01, 0.02, 0.03, 0.2), 'gunMetal', g, [0, 0.168, 0.18], [0,0,0], { outline: false });
      S.add(block(0.054, 0.02, 0.04, 0.2), 'accent', g, [0, 0.115, 0.07], [0,0,0], { outline: false });
      return { group: g };
    },
  },

  disruptor: {
    hold: 'rifle-2h', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [1.15, 0, 0] }, muzzle: [0, 0.11, 0.96],
    build(S){
      const g = new THREE.Group();
      S.add(block(0.06, 0.1, 0.18, 0.3), 'gunDark', g, [0, 0.06, -0.14]);
      S.add(block(0.07, 0.1, 0.52, 0.3), 'gunMetal', g, [0, 0.1, 0.16]);
      S.add(loft([{ y:-0.3, w:0.048, d:0.048 }, { y:0.3, w:0.04, d:0.04 }], ngon(6)), 'gunMetal', g, [0, 0.11, 0.56], [Math.PI/2, 0, 0]);
      for (const sx of [-1, 1]) S.add(loft([{ y:0, w:0.03, d:0.03 }, { y:0.16, w:0.002, d:0.002 }], ngon(4)), 'gunMetal', g, [0.028*sx, 0.11, 0.82], [Math.PI/2, 0, 0]);
      const prongGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glowMat(0x7fe0ff, 0)); prongGlow.position.set(0, 0.11, 0.92); g.add(prongGlow);
      S.add(loft([{ y:-0.1, w:0.06, d:0.06 }, { y:0.1, w:0.06, d:0.06 }], ngon(8, Math.PI/8)), 'gunDark', g, [0, 0.185, 0.16], [Math.PI/2, 0, 0]);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 8), new THREE.MeshBasicMaterial({ color: 0x66ddff }));
      lens.rotation.x = Math.PI/2; lens.position.set(0, 0.185, 0.055); g.add(lens);
      S.add(block(0.05, 0.12, 0.06, 0.3), 'gunDark', g, [0, 0, 0.04], [0.3, 0, 0]);
      return { group: g, prongGlow };
    },
  },

  // PULSE CARBINE — a compact shouldered carbine: boxy receiver, short shrouded barrel, a power cell under the grip,
  // folding stock and a reflex sight. Muzzle at z 0.74 (muzzle below).
  carbine: {
    hold: 'rifle-2h', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [1.15, 0, 0] }, muzzle: [0, 0.11, 0.76],
    build(S){
      const g = new THREE.Group();
      S.add(block(0.05, 0.08, 0.26, 0.3), 'gunDark', g, [0, 0.07, -0.2]);                     // stock
      S.add(block(0.07, 0.11, 0.36, 0.3), 'gunMetal', g, [0, 0.1, 0.12]);                    // receiver
      S.add(loft([{ y:-0.15, w:0.07, d:0.07 }, { y:0.15, w:0.066, d:0.066 }], ngon(8, Math.PI/8)), 'gunDark', g, [0, 0.11, 0.44], [Math.PI/2, 0, 0]);   // barrel shroud
      for (let i = 0; i < 3; i++) S.add(block(0.074, 0.012, 0.03, 0.2), 'gunMetal', g, [0, 0.148, 0.36 + i*0.07], [0,0,0], { outline: false });   // vent slots
      S.add(loft([{ y:-0.06, w:0.036, d:0.036 }, { y:0.06, w:0.032, d:0.032 }], ngon(6)), 'gunMetal', g, [0, 0.11, 0.66], [Math.PI/2, 0, 0]);     // muzzle
      S.add(block(0.05, 0.13, 0.07, 0.3), 'gunDark', g, [0, -0.02, 0.2], [-0.12, 0, 0]);      // power cell
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.03, 0.05), new THREE.MeshBasicMaterial({ color: 0x8fe8ff })); cell.position.set(0, -0.06, 0.205); g.add(cell);
      S.add(block(0.04, 0.05, 0.08, 0.2), 'gunDark', g, [0, 0.185, 0.08]);                    // reflex sight
      S.add(block(0.05, 0.12, 0.06, 0.3), 'gunDark', g, [0, 0, 0.0], [0.3, 0, 0]);            // grip
      S.add(block(0.074, 0.02, 0.06, 0.2), 'accent', g, [0, 0.1, -0.02], [0,0,0], { outline: false });
      return { group: g };
    },
  },

  // DC-15A BLASTER RIFLE — the clone trooper's: a long slim barrel in a vented shroud, a boxy receiver with the power
  // pack slotted in its left side, a scope riding the top, a skeletal stock and a white grip panel. Muzzle at z 0.95.
  dc15: {
    hold: 'rifle-2h', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [1.15, 0, 0] }, muzzle: [0, 0.11, 0.97],
    build(S){
      const g = new THREE.Group();
      // the stock: a skeletal frame, its butt plate and the struts back to the receiver
      S.add(block(0.04, 0.13, 0.04, 0.3), 'gunDark', g, [0, 0.05, -0.32]);
      for (const y of [0.1, 0.0]) S.add(block(0.022, 0.022, 0.24, 0.3), 'gunDark', g, [0, y, -0.2], [y ? 0.06 : -0.1, 0, 0]);
      // the receiver and the grip
      S.add(loft([{ y:-0.17, w:0.07, d:0.1 }, { y:0.17, w:0.066, d:0.095 }], chamfer(0.35)), 'gunMetal', g, [0, 0.1, 0.08], [Math.PI/2, 0, 0]);
      S.add(block(0.072, 0.03, 0.3, 0.3), 'gunDark', g, [0, 0.145, 0.08]);                     // its top rail
      S.add(block(0.05, 0.12, 0.06, 0.3), 'gunDark', g, [0, 0, 0.0], [0.3, 0, 0]);            // grip
      S.add(block(0.012, 0.05, 0.04, 0.2), 'gunDark', g, [0, 0.03, 0.06], [0, 0, 0], { outline: false });   // trigger guard
      // the power pack slotted in the left side, its cell lit
      S.add(block(0.05, 0.06, 0.14, 0.3), 'gunDark', g, [-0.055, 0.085, 0.1]);
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.08), new THREE.MeshBasicMaterial({ color: 0x8fe8ff })); cell.position.set(-0.081, 0.085, 0.1); g.add(cell);
      // the barrel shroud (a long vented tube) and the barrel inside it to the muzzle
      S.add(loft([{ y:-0.22, w:0.062, d:0.062 }, { y:0.22, w:0.056, d:0.056 }], ngon(10)), 'gunDark', g, [0, 0.11, 0.47], [Math.PI/2, 0, 0]);
      for (let i = 0; i < 6; i++) S.add(block(0.064, 0.012, 0.022, 0.2), 'gunMetal', g, [0, 0.142, 0.32 + i*0.055], [0, 0, 0], { outline: false });   // the vents
      S.add(loft([{ y:-0.13, w:0.03, d:0.03 }, { y:0.13, w:0.028, d:0.028 }], ngon(8)), 'gunMetal', g, [0, 0.11, 0.82], [Math.PI/2, 0, 0]);
      S.add(loft([{ y:-0.025, w:0.044, d:0.044 }, { y:0.025, w:0.04, d:0.04 }], ngon(8)), 'gunDark', g, [0, 0.11, 0.93], [Math.PI/2, 0, 0]);   // the flash hider
      // the front sight
      S.add(block(0.012, 0.035, 0.02, 0.2), 'gunDark', g, [0, 0.15, 0.68], [0, 0, 0], { outline: false });
      // THE MODULES (data/trooper.js RIFLE_MODS): each fitted module is a set of parts of its own; setRifleMod shows one
      const lit = (w, h, d, col, pos, par) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: col })); m.position.set(...pos); par.add(m); return m; };
      const mods = { burst: new THREE.Group(), auto: new THREE.Group(), marksman: new THREE.Group() };
      for (const k in mods){ mods[k].visible = k === 'burst'; g.add(mods[k]); }
      // BURST (stock): the short scope on the top rail, offset left, with its lens
      { const b = mods.burst;
        S.add(loft([{ y:-0.09, w:0.04, d:0.04 }, { y:0.07, w:0.04, d:0.04 }, { y:0.09, w:0.05, d:0.05 }], ngon(8)), 'gunDark', b, [-0.02, 0.19, 0.12], [Math.PI/2, 0, 0]);
        for (const z of [0.07, 0.17]) S.add(block(0.02, 0.03, 0.02, 0.2), 'gunDark', b, [-0.012, 0.165, z], [0, 0, 0], { outline: false });
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 8), new THREE.MeshBasicMaterial({ color: 0x66ddff }));
        lens.rotation.x = Math.PI/2; lens.position.set(-0.02, 0.19, 0.216); b.add(lens); }
      // AUTO BARREL: a fat finned heat sink over the front of the barrel, a drum cell slung under the receiver (its
      // charge ring lit), a foregrip, and an open reflex sight in place of the scope
      { const a = mods.auto;
        S.add(loft([{ y:-0.13, w:0.09, d:0.09 }, { y:0.13, w:0.084, d:0.084 }], ngon(10)), 'gunMetal', a, [0, 0.11, 0.76], [Math.PI/2, 0, 0]);
        for (let i = 0; i < 5; i++) S.add(loft([{ y:-0.006, w:0.12, d:0.12 }, { y:0.006, w:0.12, d:0.12 }], ngon(10)), 'gunDark', a, [0, 0.11, 0.66 + i*0.05], [Math.PI/2, 0, 0], { outline: false });   // the cooling fins
        S.add(loft([{ y:-0.045, w:0.13, d:0.13 }, { y:0.045, w:0.13, d:0.13 }], ngon(12)), 'gunDark', a, [0, -0.01, 0.2], [0, 0, Math.PI/2]);   // the drum cell
        for (const sx of [-1, 1]){ const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 4, 16), new THREE.MeshBasicMaterial({ color: 0xffb84a }));
          ring.rotation.y = Math.PI/2; ring.position.set(0.047 * sx, -0.01, 0.2); a.add(ring); }   // its charge rings, lit
        S.add(block(0.03, 0.1, 0.035, 0.3), 'gunDark', a, [0, 0.03, 0.5], [-0.25, 0, 0]);   // the foregrip
        S.add(block(0.05, 0.016, 0.06, 0.2), 'gunDark', a, [0, 0.165, 0.1]);   // the reflex sight: its base…
        S.add(block(0.05, 0.05, 0.008, 0.2), 'gunDark', a, [0, 0.19, 0.12], [0, 0, 0], { outline: false });   // …its frame
        lit(0.03, 0.03, 0.004, 0xffb84a, [0, 0.19, 0.124], a); }
      // MARKSMAN SCOPE: a long scope on high mounts with a lit front lens, a barrel extension to a muzzle brake, a cheek
      // rest on the stock and a folded bipod
      { const m = mods.marksman;
        S.add(loft([{ y:-0.2, w:0.06, d:0.06 }, { y:-0.15, w:0.05, d:0.05 }, { y:0.12, w:0.05, d:0.05 }, { y:0.2, w:0.07, d:0.07 }], ngon(10)), 'gunDark', m, [-0.01, 0.215, 0.1], [Math.PI/2, 0, 0]);
        for (const z of [0.0, 0.2]) S.add(block(0.026, 0.06, 0.03, 0.2), 'gunMetal', m, [-0.006, 0.172, z], [0, 0, 0], { outline: false });
        S.add(loft([{ y:-0.02, w:0.03, d:0.03 }, { y:0.02, w:0.03, d:0.03 }], ngon(8)), 'gunMetal', m, [0.03, 0.215, 0.08], [0, 0, Math.PI/2]);   // the turret
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 10), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
        lens.rotation.x = Math.PI/2; lens.position.set(-0.01, 0.215, 0.302); m.add(lens);
        S.add(loft([{ y:-0.1, w:0.026, d:0.026 }, { y:0.1, w:0.024, d:0.024 }], ngon(8)), 'gunMetal', m, [0, 0.11, 1.05], [Math.PI/2, 0, 0]);   // the barrel extension
        S.add(block(0.06, 0.04, 0.07, 0.3), 'gunDark', m, [0, 0.11, 1.17]);   // the muzzle brake…
        for (const sx of [-1, 1]) S.add(block(0.006, 0.026, 0.05, 0.1), 'gunMetal', m, [0.031 * sx, 0.11, 1.17], [0, 0, 0], { outline: false });   // …its ports
        S.add(block(0.045, 0.05, 0.14, 0.3), 'gunMetal', m, [0, 0.12, -0.22]);   // the cheek rest
        for (const sx of [-1, 1]) S.add(block(0.012, 0.012, 0.3, 0.2), 'gunMetal', m, [0.022 * sx, 0.078, 0.6], [0, 0, 0], { outline: false });   // the folded bipod, under the shroud
      }
      return { group: g, mods };
    },
  },

  // HEAVY REPEATER — a squat, heavy gun: a fat receiver with heat-sink fins, a drum cell slung underneath, a carry
  // handle, and a three-barrel cluster that SPINS with the spin-up (the `spinner` hook, turned in anim). Muzzle at z 0.86.
  repeater: {
    hold: 'rifle-2h', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [1.15, 0, 0] }, muzzle: [0, 0.1, 0.88],
    build(S){
      const g = new THREE.Group();
      S.add(block(0.09, 0.14, 0.42, 0.3), 'gunMetal', g, [0, 0.1, 0.1]);                     // receiver
      for (let i = 0; i < 4; i++) S.add(block(0.12, 0.012, 0.03, 0.2), 'gunDark', g, [0, 0.1 + (i - 1.5)*0.032, 0.36], [0,0,0], { outline: false });   // heat fins
      S.add(block(0.06, 0.09, 0.2, 0.3), 'gunDark', g, [0, 0.08, -0.2]);                      // short butt
      const spinner = new THREE.Group(); spinner.position.set(0, 0.1, 0.36); g.add(spinner);
      for (let i = 0; i < 3; i++){
        const a = i * Math.PI * 2 / 3;
        S.add(loft([{ y:0, w:0.03, d:0.03 }, { y:0.5, w:0.028, d:0.028 }], ngon(6)), 'gunMetal', spinner, [Math.cos(a)*0.032, Math.sin(a)*0.032, 0], [Math.PI/2, 0, 0]);
      }
      S.add(loft([{ y:-0.02, w:0.1, d:0.1 }, { y:0.02, w:0.1, d:0.1 }], ngon(8, Math.PI/8)), 'gunDark', spinner, [0, 0, 0.42], [Math.PI/2, 0, 0]);   // barrel clamp
      S.add(loft([{ y:-0.08, w:0.12, d:0.12 }, { y:0.08, w:0.12, d:0.12 }], ngon(10)), 'gunDark', g, [0, -0.04, 0.16], [0, 0, Math.PI/2]);   // drum cell
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.17, 10), new THREE.MeshBasicMaterial({ color: 0xff8a4a }));
      drum.rotation.z = Math.PI/2; drum.position.set(0, -0.04, 0.16); g.add(drum);
      S.add(block(0.03, 0.03, 0.22, 0.2), 'gunDark', g, [0, 0.215, 0.1]);                     // carry handle
      for (const z of [0.0, 0.2]) S.add(block(0.03, 0.06, 0.03, 0.2), 'gunDark', g, [0, 0.185, z]);
      S.add(block(0.05, 0.12, 0.06, 0.3), 'gunDark', g, [0, 0, -0.02], [0.3, 0, 0]);          // grip
      S.add(block(0.094, 0.02, 0.08, 0.2), 'accent', g, [0, 0.172, -0.06], [0,0,0], { outline: false });
      return { group: g, spinner, drum };
    },
  },

  darksaber: {
    hold: 'saber-1h', socket: 'handR', grip: { pos: [0, GRIP_Y, 0], rot: [0.25, 0, -0.4] },
    build(S){
      const g = new THREE.Group();
      S.add(loft([{ y:-0.14, w:0.07, d:0.07 }, { y:0.12, w:0.082, d:0.082 }, { y:0.14, w:0.07, d:0.07 }], ngon(8, Math.PI/8)), S.mat('gunDark', { c: 0x0c0d11 }), g);
      S.add(block(0.06, 0.05, 0.06, 0.4), S.mat('gunDark', { c: 0x2a2030 }), g, [0, -0.16, 0]);
      const blade = new THREE.Mesh(plate([[-0.035,0],[0.035,0],[0.04,1.1],[0,1.2],[-0.04,1.1]], 0.02, 0), new THREE.MeshBasicMaterial({ color: 0x07060c }));
      blade.position.y = 0.12;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.24, 0.012), glowMat(0xe7dcff, 0.9)); edge.position.y = 0.72;
      edge.userData.saberTrail = { hilt: -1, dark: 1 };   // the ink streak (fx/trail.js)
      g.userData.trailAlways = true;   // thrown (attached to the scene on its own), it streaks the whole flight
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.02), glowMat(0x9a5cff, 0.4)); glow.position.y = 0.72;
      const light = carriedLight(new THREE.PointLight(0x9a6cff, DARK_LIGHT * glow.light, 7)); light.position.y = 0.7;
      g.add(glow, edge, blade, light);
      return { group: g, light, blades: [glow, edge, blade] };
    },
  },
};

/* SABER GRIP — a player preference: 'regular' (blade out of the thumb side) or 'reverse' (Shien reverse grip, blade
   out of the pinky side along the forearm). Visual only: swing reach and damage don't depend on the blade mesh.
   The animated node (player.saberHand) is untouched; only the hilt+blade root inside it flips. The saber's built
   orientation (root unrotated) runs the blade back up the forearm, i.e. it IS the reverse grip, so 'regular' is
   the flipped one. Checked in game: regular points the blade away from the elbow, reverse back toward it.
   A switch mid-game turns the hilt over in the fingers (anim/saber.js eases the root to `gripTo`); a fresh model
   starts in its grip. */
let saberGrip = 'regular';
/* THE SABER STAFF'S HILT, in the saber root's space (the fist at 0, the main blade's emitter at +0.17): where the far
   emitter sits (below the fist) and where the off hand closes on the hilt. anim/saber.js and jedi/bladehit.js read
   these, so the blade the eye sees is the blade that cuts. */
export const STAFF = { end: 0.56, off: 0.34 };
// keep the staff's second blade on its emitter for a main blade of length s (the main blade centres on 0.17 + 0.78 s
// and the glow on 0.15 + 0.8 s, both starting just past the hilt; the second pair mirrors them past the far emitter, and
// sits in its parent's scaled space)
export function fitStaffBlades(blade, glow, sp, s){
  if (!sp) return;
  s = Math.max(0.02, s);
  sp.blade2.position.y = (-(STAFF.end + 0.03 + 0.78 * s) - (0.17 + 0.78 * s)) / s;
  sp.glow2.position.y = (-(STAFF.end + 0.01 + 0.8 * s) - (0.15 + 0.8 * s)) / s;
}
// show or put away the staff (the long hilt and the second blade) on a hero's saber. A model built later takes the
// last state set (mountLoadout), like the grip.
let staffOn = false;
export function setSaberStaff(hero, on, remember = true){
  on = !!on;
  if (remember) staffOn = on;
  const root = hero && hero.saberBladeRoot, sp = root && root.userData.staffParts;
  if (!sp) return;
  sp.hilt.visible = sp.blade2.visible = sp.glow2.visible = on;
  root.userData.staff = on;
}
export const saberIsStaff = (hero) => !!(hero && hero.saberBladeRoot && hero.saberBladeRoot.userData.staff);

/* JAR'KAI (data/forms.js jarkai): a second saber in the off hand. It is the same saber model, mounted on the left hand
   with no light of its own (a light added or hidden recompiles every material: the main blade's light is enough),
   and its blade and glow SHARE the main saber's materials, so it burns the form's colour without being told. Every frame
   syncOffSaber copies the main blade's length (ignite, retract, the smear) and its grip, and hides it whenever the main
   one is away (holstered, thrown). anim/saber.js aims it (saberPose.offBlade); jedi/bladehit.js cuts with it. */
let dualOn = false;
function mountOffSaber(R, S, player){
  const w = WEAPON_MODELS.saber.build(S);
  w.light.parent.remove(w.light);
  w.blade.material = player.blade.blade.material;
  w.glow.material = player.blade.glow.material;
  w.group.position.set(0, GRIP_Y, 0);
  w.group.rotation.set(0.25, 0, 0.4);
  w.group.userData.weapon = { id: 'saberOff', hold: 'saber-1h' };
  w.group.userData.restQ = w.group.quaternion.clone();
  w.group.visible = false;
  R.sockets.handL.add(w.group);
  player.offSaber = { node: w.group, root: w.bladeRoot, blade: w.blade, glow: w.glow };
}
// show or put away the off-hand saber. A model built later takes the last state set (mountLoadout), like the staff.
export function setSaberDual(hero, on, remember = true){
  on = !!on;
  if (remember) dualOn = on;
  if (!hero) return;
  if (hero.saberBladeRoot) hero.saberBladeRoot.userData.dual = on;
  if (hero.offSaber) hero.offSaber.node.visible = on;
}
export const saberIsDual = (hero) => !!(hero && hero.saberBladeRoot && hero.saberBladeRoot.userData.dual && hero.offSaber);
// where Jar'Kai's second hilt hangs while the first is on the belt: the right hip (the belt socket sits at the left)
const OFF_BELT = { pos: [0.4, -0.04, 0], rot: [0.25, 0, -0.18] };
// keep the off saber in step with the main one (call each frame after the blade FX and the holster have run)
export function syncOffSaber(hero, allowed = true){
  const O = hero && hero.offSaber, B = hero && hero.blade;
  if (!O || !B) return;
  const on = allowed && !!(hero.saberBladeRoot && hero.saberBladeRoot.userData.dual);
  // the main hilt clipped to the belt (put out, holstered, a duel's entrance): the off hilt clips on at the other hip
  const M = hero.saberHand, belt = hero.rig && hero.rig.sockets && hero.rig.sockets.belt, belted = !!(M && belt && M.parent === belt);
  const away = !!hero.offAway || !M || (M.scale.x < 0.01 && !hero.mainAway) || (!belted && M.parent !== M.userData.hand && !!M.userData.hand);
  O.node.visible = on && !away;
  if (O.node.visible && belted){
    if (O.node.parent !== belt){ belt.add(O.node); O.node.position.set(...OFF_BELT.pos); O.node.rotation.set(...OFF_BELT.rot); }
    O.blade.visible = O.glow.visible = false;
    return;
  }
  if (O.node.parent !== hero.rig?.sockets?.handL && hero.rig?.sockets?.handL){   // (back from the belt: into the off hand)
    hero.rig.sockets.handL.add(O.node); O.node.position.set(0, GRIP_Y, 0); O.node.quaternion.copy(O.node.userData.restQ);
  }
  if (!O.node.visible) return;
  O.blade.visible = B.blade.visible; O.glow.visible = B.glow.visible;
  O.blade.scale.copy(B.blade.scale); O.blade.position.y = B.blade.position.y;
  O.glow.scale.copy(B.glow.scale); O.glow.position.y = B.glow.position.y;
  // the off hand's own grip (data/forms.js DUAL_GRIPS); anim/saber.js turns the hilt over to it
  const to = offGrip('jarkai') === 'reverse' ? 0 : Math.PI;
  if (O.root.userData.gripTo === undefined) O.root.rotation.x = to;
  O.root.userData.gripTo = to;
}
export function applySaberGrip(player, grip, instant = false){
  saberGrip = grip === 'reverse' ? 'reverse' : 'regular';
  const root = player.saberBladeRoot;
  if (!root) return;
  root.userData.gripTo = saberGrip === 'reverse' ? 0 : Math.PI;
  if (instant) root.rotation.x = root.userData.gripTo;
  const O = player.offSaber;   // Jar'Kai's off saber: its own grip
  if (O){ O.root.userData.gripTo = offGrip('jarkai') === 'reverse' ? 0 : Math.PI; if (instant) O.root.rotation.x = O.root.userData.gripTo; }
}

export function mountWeapon(R, S, id, socket){
  const def = WEAPON_MODELS[id];
  const w = def.build(S);
  w.group.position.set(...def.grip.pos);
  w.group.rotation.set(...def.grip.rot);
  w.group.userData.weapon = { id, hold: def.hold };
  w.group.userData.restQ = w.group.quaternion.clone();   // the mount grip, for poses that hand the weapon back
  R.sockets[socket || def.socket].add(w.group);
  return w;
}

// the current loadout for both heroes, wired to the hooks the game already uses (player.saberHand, player.pistols, …)
export function mountLoadout(R, S, player){
  const saber = mountWeapon(R, S, 'saber');
  player.saberHand = saber.group;
  player.saberPivot = R.armR.sh;
  player.blade = { blade: saber.blade, glow: saber.glow, light: saber.light };
  player.saberBladeRoot = saber.bladeRoot;
  player.blade.staff = saber.staff;
  applySaberGrip(player, saberGrip, true);
  setSaberStaff(player, staffOn, false);
  mountOffSaber(R, S, player);
  setSaberDual(player, dualOn, false);
  player.offSaber.node.visible = false;   // (shown by syncOffSaber on the hero you play, by the gear on a partner, by the stance preview: never on a cutscene's actor)

  player.pistols = { L: mountWeapon(R, S, 'pistol', 'handL').group, R: mountWeapon(R, S, 'pistol', 'handR').group };

  mountLongGuns(R, S, player);

  const dark = mountWeapon(R, S, 'darksaber');
  dark.group.visible = false;
  player.darksaberMesh = dark.group; player.darkLight = dark.light; player.darkBlades = dark.blades;
}

/* THE LONG GUNS — the disruptor, the pulse carbine, the heavy repeater and the trooper's DC-15 share ONE mount in the right hand
   (player.rifleMesh), holding all three models; only the drawn one shows (setLongGun). Every pose, the holster and the
   co-op pose sync keep working on player.rifleMesh whichever long gun it is. */
export const LONG_GUNS = ['disruptor', 'carbine', 'repeater', 'dc15'];   // (append only: co-op sends the index)
/* a gun with a model of its own where it otherwise borrows another's look (data/trooper.js GUN_LOOK): the trooper's
   DC-15 is held like the carbine but is its own rifle */
export const OWN_MODEL = { rifle: 'dc15' };
function mountLongGuns(R, S, player){
  const def = WEAPON_MODELS.disruptor, mount = new THREE.Group();
  mount.position.set(...def.grip.pos); mount.rotation.set(...def.grip.rot);
  mount.userData.weapon = { id: 'long', hold: 'rifle-2h' };
  mount.userData.restQ = mount.quaternion.clone();
  R.sockets[def.socket].add(mount);
  player.longGuns = {};
  for (const id of LONG_GUNS){
    const w = WEAPON_MODELS[id].build(S);
    w.group.userData.muzzle = WEAPON_MODELS[id].muzzle;
    w.group.visible = id === 'disruptor';
    mount.add(w.group);
    player.longGuns[id] = w;
  }
  player.rifleMesh = mount; player.rifleProngGlow = player.longGuns.disruptor.prongGlow;
  player.repeaterSpin = player.longGuns.repeater.spinner;
  mount.userData.long = 'disruptor';
}
// show the long gun `id` on the mount (a sidearm or anything else leaves it as it was)
export function setLongGun(player, id){
  const m = player.rifleMesh;
  if (!m || !player.longGuns || !player.longGuns[id] || m.userData.long === id) return;
  for (const k of LONG_GUNS) player.longGuns[k].group.visible = k === id;
  m.userData.long = id;
}
// fit the DC-15's module `mod` (burst / auto / marksman): its parts show, the others go, and the muzzle moves with it
const DC15_MUZZLE = { burst: [0, 0.11, 0.97], auto: [0, 0.11, 0.97], marksman: [0, 0.11, 1.21] };
export const RIFLE_MOD_IDS = ['burst', 'auto', 'marksman'];   // (append only: co-op sends the index)
export function setRifleMod(player, mod){
  const w = player.longGuns && player.longGuns.dc15; if (!w || !w.mods) return;
  if (!w.mods[mod]) mod = 'burst';
  if (w.group.userData.mod === mod) return;
  for (const k in w.mods) w.mods[k].visible = k === mod;
  w.group.userData.mod = mod; w.group.userData.muzzle = DC15_MUZZLE[mod];
}
// the drawn long gun's muzzle point in the mount's space
export const longMuzzle = (player) => (player.longGuns && player.longGuns[player.rifleMesh.userData.long] || {}).group?.userData.muzzle || [0, 0.11, 0.96];
