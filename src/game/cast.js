// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CAST ON SET: the story's people as figures a cutscene can stand on the field (game/cutscene.js), built from
// data/cast.js. A Jedi, a Mandalorian or anyone in plain clothes is a hero-model figure (player/model: a face that blinks
// and talks, robes and capes on the cloth sim); a trooper or a droid is a trooper-model figure (enemies/mesh.js); a
// warlord is the boss's own model. Any of them can stand in as a HOLOGRAM instead (someone on a call): flickering blue,
// scan lines rolling up it, a projector disc at its feet.
//
// A figure idles while it waits: it breathes, shifts its weight, turns to whoever it is listening to, and while its line
// is up it talks with its hands (and its jaw, if it has a face). It knows nothing about shots or lines: the cutscene
// sets `talk` and `look` on it each frame and calls stepFigure.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { CAST } from '../data/cast.js';
// the cast's own base look: a field-worn Mando in the Hunter helmet (the player's starting basics differ: data/customize.js)
const CAST_BASE = { jedi: { wear: 'field' }, mando: { helmet: 'tvisor', wear: 'field' }, trooper: { wear: 'field', legion: 'blue' } };
import { buildHeroModel } from '../player/model/index.js';
import { MIRROR } from '../player/model/rig.js';
import { stepCloth, settleCloth } from '../player/model/cloth.js';
import { blink, express, gripHands } from '../player/model/life.js';
import { lookOf, disposeTree } from '../player/mesh.js';
import { mergeLook } from '../player/model/appearance.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { buildBoss } from '../boss/mesh.js';
import { updateLegs } from '../enemies/gait.js';
import { updateUpper } from '../enemies/upper.js';
import { groundAt } from '../world/collision.js';
import { allies } from '../allies/squad.js';
import { meetAlly } from './codex.js';

export const castOf = (name) => CAST[name] || null;

/* ---------- the hologram: one material per figure, blue and see-through, its scan lines rolling up ---------- */
const HOLO = { color: 0x6cc8ff, opacity: 0.5 };
function holoMaterial(){
  const m = new THREE.MeshBasicMaterial({ color: HOLO.color, transparent: true, opacity: HOLO.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide });
  m.userData.time = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHoloT = m.userData.time;
    sh.vertexShader = 'varying float vHoloY;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vHoloY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = 'varying float vHoloY;\nuniform float uHoloT;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      '  diffuseColor.a *= 0.55 + 0.45 * step(0.42, fract(vHoloY * 14.0 - uHoloT * 1.6));\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'holo';
  return m;
}
function holoify(F){
  const mat = holoMaterial(), old = [];
  F.g.traverse(o => { if (o.isMesh || o.isSkinnedMesh){ old.push(o.material); o.material = mat; o.castShadow = false; } });
  F.holo = { mat, old, glitch: 0, t: Math.random() * 10 };
  // the projector at its feet: a lit disc, and a faint beam up through the figure
  const base = new THREE.Group();
  base.add(new THREE.Mesh(new THREE.CircleGeometry(0.55, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: HOLO.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
  base.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 2.3, 24, 1, true).translate(0, 1.15, 0), new THREE.MeshBasicMaterial({ color: HOLO.color, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  base.children[0].position.y = 0.03;
  F.base = base;
  scene.add(base);
}

/* ---------- building one ---------- */
// no figure brings a light of its own (a saber's, a jetpack's, a warlord's aura): a light added to the scene recompiles
// every material in it, a hitch right as the scene opens
function stripLights(root){
  const lights = [];
  root.traverse(o => { if (o.isLight) lights.push(o); });
  for (const l of lights) l.removeFromParent();
}
// the squadmate already on the field by that name (the trooper's band, the Mandalorian on Jakku), if there is one near
function boundAlly(name, x, z){
  const a = allies.find(a => a.def && a.def.name === name && a.state !== 'down' && !a.net && Math.hypot(a.group.position.x - x, a.group.position.z - z) < 9);   // (near the scene: one across the map gets a stand-in)
  return a ? a.group : null;
}
function heroFigure(def){
  const target = { group: new THREE.Group() };
  target.group.add(buildHeroModel(target, mergeLook(lookOf(CAST_BASE), def.look)));
  const mando = def.as === 'mando';
  for (const m of target.mandoParts) m.visible = mando;
  for (const m of target.trooperParts || []) m.visible = false;
  for (const m of target.headBare) m.visible = !mando;
  target.rig.skirt.visible = !mando;
  for (const w of [target.pistols && target.pistols.L, target.pistols && target.pistols.R, target.rifleMesh, target.darksaberMesh]) if (w) w.visible = false;
  // a Jedi's hilt hangs at the belt, unlit; nobody else carries one
  const hilt = target.saberHand;
  if (hilt){
    if (def.saber){ target.rig.sockets.belt.add(hilt); hilt.position.set(0, -0.04, 0); hilt.rotation.set(0.25, 0, 0.18); target.blade.blade.visible = target.blade.glow.visible = false; }
    else hilt.visible = false;
  }
  stripLights(target.group);
  target.group.rotation.order = 'YXZ';
  return target;
}
// a figure for the codex's preview (ui/codex-ui.js): built and posed at rest, never put in the scene
export function castPreview(name){
  const def = castOf(name);
  if (!def) return null;
  if (def.kind === 'hero'){
    const target = heroFigure(def), F = { target, g: target.group, kind: 'hero', t: 0, gest: 0, turn: 0 };
    target.group.scale.setScalar(def.scale || 1);
    pose(F, 0);
    return target.group;
  }
  if (def.kind === 'boss') return buildBoss(def.boss);
  return buildEnemyMesh({ ...def.t, scale: def.scale || 1 }, { variant: def.variant ?? 0, wear: 0.15 });
}
// def: a data/cast.js entry · at { x, z } · yaw · opts.holo
export function makeFigure(name, x, z, yaw, opts = {}){
  const def = castOf(name);
  if (!def) return null;
  if (def.bound && !opts.holo){
    const g = boundAlly(name, x, z);
    if (g) return { name, g, own: false, bound: true, kind: 'foe', scale: g.scale.x || 1, walk: null, talk: false, look: null };
  }
  let F;
  if (def.kind === 'hero'){
    const target = heroFigure(def);
    F = { name, g: target.group, target, kind: 'hero', own: true, scale: def.scale || 1, walk: null, talk: false, look: null, t: Math.random() * 10, gest: 0, turn: 0 };
    target.group.scale.setScalar(F.scale);
  } else if (def.kind === 'boss'){
    const g = buildBoss(def.boss);
    stripLights(g);
    F = { name, g, kind: 'boss', own: true, scale: g.scale.x, walk: null, talk: false, look: null, t: 0 };
  } else {
    const g = buildEnemyMesh({ ...def.t, scale: def.scale || 1 }, { variant: def.variant ?? 0, wear: 0.15 });
    stripLights(g);
    F = { name, g, kind: 'foe', own: true, scale: def.scale || 1, walk: null, talk: false, look: null };
  }
  if (!opts.holo) meetAlly(name);   // a friendly face met in person opens its codex entry (game/codex.js: foes there have none)
  F.g.position.set(x, groundAt(x, z, 3.2), z);
  F.g.rotation.y = yaw;
  scene.add(F.g);
  if (opts.holo) holoify(F);
  if (F.kind === 'hero'){ pose(F, 0); F.target.vis.updateWorldMatrix(true, true); settleCloth(F.target, 1); }
  return F;
}
export function dropFigure(F){
  if (!F) return;
  if (F.g) F.g.userData.talk = false;
  if (!F.own) return;
  scene.remove(F.g);
  if (F.base){ scene.remove(F.base); disposeTree(F.base); }
  if (F.holo){ for (const m of new Set(F.holo.old)) if (F.kind === 'hero') m.dispose(); F.holo.mat.dispose(); }
  if (F.kind === 'hero') disposeTree(F.g);
}

/* ---------- every frame ---------- */
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const yawTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);
// a hero-model figure's body: at ease, breathing, weight on one leg; while it talks, its right hand works the line
function pose(F, dt){
  const R = F.target.rig, t = (F.t += dt);
  const k = Math.min(1, dt * 5);
  F.gest += ((F.talk ? 1 : 0) - F.gest) * k;
  const breath = Math.sin(t * 1.6), shift = Math.sin(t * 0.45);
  const g = F.gest, beat = 0.5 + 0.5 * Math.sin(t * 2.4);
  // legs: easy, a little apart, the weight drifting from one to the other
  R.legL.hip.rotation.set(0.04, 0, -0.07 - shift * 0.02); R.legL.knee.rotation.set(0.07 + Math.max(0, shift) * 0.05, 0, 0);
  R.legR.hip.rotation.set(-0.03, 0, 0.09 - shift * 0.02); R.legR.knee.rotation.set(0.07 + Math.max(0, -shift) * 0.05, 0, 0);
  R.hips.rotation.z = shift * 0.025;
  R.torso.rotation.set(0.02 + breath * 0.012, F.turn * 0.35, -shift * 0.02);
  R.chest.rotation.set(breath * 0.018 - g * 0.03, 0, 0);
  // arms: hanging loose; the talking hand comes up and opens toward whoever it speaks to
  R.armL.sh.rotation.set(0.04 - g * 0.1, 0.05, 0.13 + breath * 0.01); R.armL.el.rotation.set(-0.22 - g * 0.25, 0, 0);
  R.armR.sh.rotation.set(0.02 - g * (0.26 + beat * 0.08), -0.06 + g * 0.22, -0.13 - breath * 0.01 - g * 0.22);
  R.armR.el.rotation.set(-0.24 - g * (0.7 + beat * 0.16), 0, 0);
  // the head turns to whoever it is listening to (the body follows part of the way: F.turn), and nods along while it talks
  R.head.rotation.set(-0.04 + g * Math.sin(t * 5.3) * 0.045, F.turn * 0.65 * MIRROR, 0);
  // walking off (a scene without cuts sends them on their way: game/cutscene.js oneExit): a plain stride over the idle
  F.stride = (F.stride || 0) + ((F.walk ? 1 : 0) - (F.stride || 0)) * k;
  if (F.stride > 0.01){
    const s = F.stride, ph = (F.ph = (F.ph || 0) + dt * 5.6), sw = Math.sin(ph), up = Math.cos(ph);
    R.legL.hip.rotation.x -= sw * 0.48 * s; R.legR.hip.rotation.x += sw * 0.48 * s;
    R.legL.knee.rotation.x += Math.max(0, up) * 0.7 * s; R.legR.knee.rotation.x += Math.max(0, -up) * 0.7 * s;
    R.armL.sh.rotation.x += sw * 0.28 * s; R.armR.sh.rotation.x -= sw * 0.28 * s;
  }
}
// look: a point { x, y?, z } the figure turns toward (the speaker, or the hero)
export function stepFigure(F, dt){
  if (!F || !F.g) return;
  if (F.bound){ F.g.userData.talk = F.talk; return; }   // (a squadmate on the field keeps its own life: only its jaw is ours)
  const g = F.g;
  if (F.walk){
    const w = F.walk;
    w.k = Math.min(1, w.k + dt / w.t);
    g.position.x = w.x0 + (w.x1 - w.x0) * w.k; g.position.z = w.z0 + (w.z1 - w.z0) * w.k;
    if (w.k < 1) g.rotation.y = yawTo(w.x0, w.z0, w.x1, w.z1); else F.walk = null;
  }
  // the body turns slowly to whoever it addresses (the hero, mostly); the head does the rest
  if (F.look && !F.walk){
    const want = yawTo(g.position.x, g.position.z, F.look.x, F.look.z);
    const off = wrap(want - g.rotation.y);
    if (F.kind === 'hero'){ g.rotation.y += clamp(off, -1, 1) * Math.min(1, dt * 1.8) * (Math.abs(off) > 0.5 ? 1 : 0.3); F.turn += (clamp(wrap(want - g.rotation.y), -0.8, 0.8) - F.turn) * Math.min(1, dt * 4); }
    else if (F.kind !== 'boss') g.rotation.y += off * Math.min(1, dt * 3);
  }
  g.position.y += (groundAt(g.position.x, g.position.z, g.position.y + 0.6) - g.position.y) * Math.min(1, dt * 12);
  if (F.kind === 'hero'){
    pose(F, dt);
    blink(F.target, dt);
    express(F.target, dt, { talk: F.talk });
    gripHands(F.target, dt, { L: 0.45, R: F.talk ? 0.12 : 0.45 });   // hands loose at rest; the talking hand opens
    stepCloth(F.target, dt, g.position.y + 0.02);
  } else if (F.kind === 'foe'){
    g.userData.talk = F.talk;
    updateLegs(F, g, dt, 'ground');
    updateUpper(F, g, dt, F.look ? { x: F.look.x, y: F.look.y ?? g.position.y, z: F.look.z } : null);
  } else {
    F.t += dt;
    if (g.userData.vis) g.userData.vis.position.y = Math.sin(F.t * 1.3) * 0.02;
  }
  if (F.holo){
    const H = F.holo;
    H.t += dt;
    H.mat.userData.time.value = H.t;
    // a weak signal: it flickers, and now and then the picture jumps
    if ((H.glitch -= dt) < -1.5 - Math.random() * 3) H.glitch = 0.08 + Math.random() * 0.1;
    const jump = H.glitch > 0;
    H.mat.opacity = HOLO.opacity * (0.82 + Math.sin(H.t * 31) * 0.08 + Math.sin(H.t * 7.3) * 0.06) * (jump ? 0.55 : 1);
    const vis = F.kind === 'hero' ? F.target.vis : g.userData.vis;
    if (vis){ if (vis.userData.holoX0 === undefined) vis.userData.holoX0 = vis.position.x; vis.position.x = vis.userData.holoX0 + (jump ? (Math.random() - 0.5) * 0.12 : 0); }
    if (F.base) F.base.position.set(g.position.x, g.position.y, g.position.z);
  }
}
