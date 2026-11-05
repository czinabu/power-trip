// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE DRAW BEFORE A DUEL: in the entrance of a fight with a saber wielder (game/cutscene.js playDuelIntro, the boss's
// arrival), both duellists wait out the scene with their hilts on the belt and the blades out. At its last beat the foe
// reaches down, draws, lights it and comes up into its form's guard as the scene hands over to the fight; the hero's
// stays on the belt for the player to light (5, or any fight move: player/holster.js stowForScene).
//
// This file is the foe's side:
//   · a saber wielder on set (the duel foe's stand-in, the cornered quarry): its hilt clipped at its sword-hand hip,
//     the weapon arm hanging; then the hand goes down to the belt, takes it, the blade runs up out of the emitter (both,
//     a Jar'Kai foe's), and the arm rises into its form's high guard (enemies/foestance.js), so the real foe stepping in
//     after picks up from the same stance
//   · Darth Vexis: his blade is out and his hilt in his fist while he talks; it lights at the end
// Each co-op screen plays its own copy of the scene, so each draws its own foe; a hero lighting theirs after reaches the
// partner through the pose sync (net/pose.js), sound and all.

import { S } from '../audio/sfx.js';
import { GUARD_POSE } from '../data/duel.js';
import { guardArm, updateStance } from '../enemies/foestance.js';
import { holdBetween } from '../player/anim/handoff.js';

// the foe's timing (s): the reach for the belt (the hilt changes hands `swap` of the way through), the blade running up,
// how fast the arm rises into the guard (per second), and where the hilt hangs on the belt, in the body's frame
export const FOE_DRAW = { reach: 0.4, swap: 0.5, ext: 0.22, rise: 0.45, hand: 0.12, belt: { pos: [0.27, 0.98, 0.15], rot: [0.12, 0, 0.16] } };
// (rise: how long the arm takes from the belt up into the guard; hand: how long the hilt takes to slide from the belt
// into the fist, rather than jumping: player/anim/handoff.js)
// the weapon arm: hanging loose with the hilt on the belt, and reaching across to it
const HANG = { x: 0.05, z: 0.14 }, REACH = { x: 0.12, z: -0.22 };   // (the hilt hangs at the weapon hand's hip: an easy reach down)

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = k => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
// the blade meshes in a hilt's group (its glows: the hilt itself is baked), each with where its emitter end is
function bladesOf(node){
  const out = [];
  for (const m of node.children){
    if (!m.isMesh || !m.userData.live || !m.geometry || !m.geometry.parameters || !m.geometry.parameters.height) continue;
    const h = m.geometry.parameters.height * m.scale.y, y = m.position.y;
    out.push({ m, y, s: m.scale.y, base: y - Math.sign(y || 1) * h / 2 });   // (the end nearer the grip)
  }
  return out;
}
function fit(list, k){
  for (const b of list){
    b.m.visible = k > 0.001;
    b.m.scale.y = b.s * Math.max(0.02, k);
    b.m.position.y = b.base + (b.y - b.base) * Math.max(0.02, k);
  }
}
const soundOf = (form) => form === 'staff' ? 'staff' : form || 'niman';

/* the scene opens: put the actor's blade away. a: a cutscene actor ({ g, own, ... }); form: the form it fights in.
   Returns true if it has a blade to draw at the end. */
export function stowFoe(a, form){
  const g = a && a.g, u = g && g.userData;
  if (!u || a.draw) return !!(a && a.draw);
  if (u.saber && u.weaponArm && u.vis){   // a saber wielder (enemies/mesh.js weaponArm: the hilt and blade are one slot)
    const D = a.draw = { kind: 'saber', u, form, t: -1, lit: false,
      home: u.saber.parent, pos: u.saber.position.clone(), quat: u.saber.quaternion.clone(), blades: bladesOf(u.saber),
      arm: u.weaponArm.rotation.clone(), off: null };
    u.vis.add(u.saber);
    u.saber.position.set(...FOE_DRAW.belt.pos); u.saber.rotation.set(...FOE_DRAW.belt.rot);
    fit(D.blades, 0);
    if (u.offSaber) u.offSaber.visible = false;
    u.weaponArm.rotation.set(HANG.x, D.arm.y, HANG.z);
    return true;
  }
  if (a.bind === 'boss' && u.hand){   // Darth Vexis: the hilt stays in his fist, the blade out
    const lights = [];
    u.hand.traverse(o => { if (o.isLight) lights.push([o, o.intensity]); });
    a.draw = { kind: 'boss', u, form, t: -1, lit: false, blades: bladesOf(u.hand), lights };
    fit(a.draw.blades, 0);
    for (const [l] of lights) l.intensity = 0;
    return true;
  }
  return false;
}
// the scene's last beat: reach for it
export function drawFoe(a){ if (a && a.draw && a.draw.t < 0) a.draw.t = 0; }
const at = (g) => ({ x: g.position.x, y: g.position.y + 1.2 * g.scale.y, z: g.position.z });

// every frame of the scene, before the actor's upper body is posed (game/cutscene.js updateActor)
export function stepFoe(a, dt){
  const D = a && a.draw;
  if (!D || D.t < 0 || D.done) return;
  D.t += dt;
  if (D.kind === 'boss'){
    if (!D.lit && D.t >= 0.15){ D.lit = true; D.t0 = D.t; S.ignite(soundOf(D.form), at(a.g), true); }
    if (D.lit){
      const e = Math.min(1, (D.t - D.t0) / FOE_DRAW.ext);
      fit(D.blades, 1 - Math.pow(1 - e, 3));
      for (const [l, i] of D.lights) l.intensity = i * e;
      if (e >= 1) D.done = true;
    }
    return;
  }
  const u = D.u, arm = u.weaponArm;
  if (!arm || !u.saber) return;   // (a cut took the arm)
  const k = Math.min(1, D.t / FOE_DRAW.reach);
  if (!D.lit){
    const r = Math.sin(Math.PI * k) ** 2;   // (sin²: the hand sets off from still)
    arm.rotation.x = lerp(HANG.x, REACH.x, r); arm.rotation.z = lerp(HANG.z, REACH.z, r);
    if (k >= FOE_DRAW.swap && u.saber.parent !== D.home){
      // the hilt off the belt and into the hand, sliding into the fist from where it hung (below); lit there and then,
      // and the arm carries it straight up from the hip into the guard (not back down to the thigh first)
      D.from = { pos: u.saber.position.clone(), quat: u.saber.quaternion.clone() };
      D.home.add(u.saber); u.saber.position.copy(D.pos); u.saber.quaternion.copy(D.quat);
      D.lit = true; D.t0 = D.t; D.armFrom = [arm.rotation.x, arm.rotation.z];
      a.group = a.g; a.ff = D.form;   // its form's stance from here (enemies/foestance.js reads these off the actor)
      S.ignite(soundOf(D.form), at(a.g), true);
      if (D.from) holdBetween(u.saber, u.vis, D.from.pos, D.from.quat, D.pos, D.quat, 0);
    }
    return;
  }
  // lit: the blade runs up (both, in Jar'Kai: the off hand's copy is made from the main one on its first frame,
  // enemies/foestance.js offSaber), and the arm rises into the high guard, easing off the belt and settling into it
  const lt = D.t - D.t0, e = Math.min(1, lt / FOE_DRAW.ext), s = 1 - Math.pow(1 - e, 3);
  fit(D.blades, s);
  if (u.offSaber && u.offSaber.visible){ if (!D.off) D.off = bladesOf(u.offSaber).map((b, i) => ({ ...b, ...(D.blades[i] ? { y: D.blades[i].y, s: D.blades[i].s, base: D.blades[i].base } : {}) })); fit(D.off, s); }
  const p = guardArm(a, GUARD_POSE, 'H', false), A0 = D.armFrom || [arm.rotation.x, arm.rotation.z], rk = smooth(lt / FOE_DRAW.rise);
  arm.rotation.x = lerp(A0[0], p[0], rk);
  arm.rotation.z = lerp(A0[1], p[1], rk);
  if (D.from){
    const hk = lt / FOE_DRAW.hand;
    if (hk >= 1){ u.saber.position.copy(D.pos); u.saber.quaternion.copy(D.quat); D.from = null; }
    else { arm.updateWorldMatrix(true, true); holdBetween(u.saber, u.vis, D.from.pos, D.from.quat, D.pos, D.quat, smooth(hk)); }
  }
  updateStance(a, dt, true, 'H');
}
// the scene is over: anything left half drawn is put back as it was (a stand-in leaves the set anyway; the quarry and
// the boss carry on into the fight with their blades lit)
export function endFoe(a){
  const D = a && a.draw;
  if (!D) return;
  a.draw = null;
  if (D.kind === 'boss'){ fit(D.blades, 1); for (const [l, i] of D.lights) l.intensity = i; return; }
  const u = D.u;
  if (u.saber && D.from){ u.saber.position.copy(D.pos); u.saber.quaternion.copy(D.quat); }
  if (u.saber && u.saber.parent !== D.home){ D.home.add(u.saber); u.saber.position.copy(D.pos); u.saber.quaternion.copy(D.quat); }
  fit(D.blades, 1);
  if (D.off) fit(D.off, 1);
  if (u.weaponArm && !D.lit) u.weaponArm.rotation.copy(D.arm);
}
