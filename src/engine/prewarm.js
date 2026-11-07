// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// First-use hitch killer: everything a fight needs is built or compiled before the fight, not on its first use.

import * as THREE from 'three';
import { scene, compileLive } from './renderer.js';
import { arenaBuilt } from '../world/arena.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { SQUAD, TURNED, PURGE, DRILL, MARSHAL } from '../data/allies.js';
import { buildEnemyMesh, variantsOf, facesOf } from '../enemies/mesh.js';
import { buildCivilian, CIV_PREWARM } from '../enemies/civilian.js';
import { lookPool } from '../data/foe-looks.js';
import { MAGISTRATE, MARSHAL_BOSS } from '../data/bosses.js';
import { CAST_IDS } from '../data/saber-cast.js';
import { inkProbe } from '../fx/ink.js';
import { ensureBossLight } from '../boss/light.js';
import { ensureBarrierMesh } from '../player/jedi/force.js';
import { ensureJudgeLines } from '../player/jedi/judgement-fx.js';
import { shared, G } from '../state.js';
import { holdLightCount } from '../fx/lights.js';
import { seeThroughSpecimen } from '../world/charfade.js';
import { BladeGlowMaterial } from '../fx/blade-glow.js';
import { glowTrailMat, darkTrailMat } from '../fx/trail.js';
import { makeStyle, MATERIALS } from '../player/model/styles.js';

/* ---------- 1. SHADERS ----------
   three.js builds a shader program the first time a material variant is drawn, and again for every material when the
   scene's light count changes. renderer.compile only sees VISIBLE objects, so a few hidden "specimens" (one per
   material variant the fight spawns later) are shown for the compile, then hidden again. Runs after every arena
   build, so each mode (campaign, missions, training, sandbox, survival, battle maps) gets it; programs are cached,
   so repeat builds only pay for what's new. */
const basic = o => new THREE.MeshBasicMaterial(o);
const GEO = new THREE.BoxGeometry(0.01, 0.01, 0.01);
const specimens = [];
function specimen(obj){ obj.visible = false; obj.frustumCulled = false; scene.add(obj); specimens.push(obj); return obj; }
function buildSpecimens(){
  const mats = [
    basic({}),                                                                                       // plain (thrown blade, bolts, markers)
    basic({ toneMapped: false }),                                                                   // bolts, grenades: bloom-hot colours
    basic({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),   // rings, glows
    basic({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),   // the Mando's deflector disc
    basic({ transparent: true, depthWrite: false, side: THREE.BackSide, toneMapped: false }),       // bolt ink outlines
    basic({ transparent: true, depthTest: false, toneMapped: false }),                              // squad tags
    new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.6, roughness: 0.4 }),            // rockets, birds, thermal detonators
    new BladeGlowMaterial({ opacity: 0.5 }),                                                         // every lightsaber's glow (fx/blade-glow.js)
  ];
  for (const m of mats) specimen(new THREE.Mesh(GEO, m));
  // the saber streaks (fx/trail.js): vertex-coloured, and see-through on both sides, so each draws as two programs (back
  // faces, then front). They used to build on the first fast swing of a session, a hitch mid-fight
  const cgeo = GEO.clone().setAttribute('color', new THREE.BufferAttribute(new Float32Array(GEO.attributes.position.count * 4), 4));   // RGBA, as the ribbon's
  for (const m of [glowTrailMat, darkTrailMat]) specimen(new THREE.Mesh(cgeo, m));
  specimen(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)),
                          new THREE.LineBasicMaterial({ color: 0xbfe8ff })));   // grapple and Darksaber lines
  specimen(buildEnemyMesh(ENEMY_TYPES.grunt));   // the skinned, outlined trooper material every foe and squadmate shares
  // the same dithered see-through, as a squadmate or a foe in front of the lens wears it (world/charfade.js): the trooper
  // build, a heavy and a saber wielder (their faces, robes and blades), so none builds its program mid-fight
  for (const t of ['grunt', 'brute', 'acolyte']) if (ENEMY_TYPES[t]) specimen(seeThroughSpecimen(buildEnemyMesh(ENEMY_TYPES[t])));
  // the cast's armour, cloth and skin programs, skinned AND plain: a cut-off limb (enemies/scars.js makePiece) redraws a
  // unit's materials on an unskinned copy of its gear, and a unit type the warm-up's builds above don't include can wear
  // a kind of surface they don't. Those programs used to build mid-fight, on the first dismemberment or the first such
  // foe of a session. One specimen of each surface program (they're shared by kind: styles.js inkSurface), both ways
  const byKey = new Map(), take = m => { if (m && !m.transparent && m.customProgramCacheKey){ const k = m.type + m.customProgramCacheKey(); if (!byKey.has(k)) byKey.set(k, m); } };
  const S = makeStyle('ink');
  for (const key of Object.keys(MATERIALS)){ try { take(S.mat(key)); } catch(e){} }
  for (const t of ['grunt', 'brute', 'acolyte']) if (ENEMY_TYPES[t]) buildEnemyMesh(ENEMY_TYPES[t]).traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) take(m); });
  const sgeo = GEO.clone();
  const nv = sgeo.attributes.position.count;
  sgeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(nv * 4), 4));
  sgeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(nv * 4).fill(0.25), 4));
  for (const m of byKey.values()){
    specimen(new THREE.Mesh(GEO, m));
    const sk = new THREE.SkinnedMesh(sgeo, m), bone = new THREE.Bone();
    sk.add(bone); sk.bind(new THREE.Skeleton([bone]));
    specimen(sk);
  }
}
const lazy = [];   // objects that other modules build on first use: shown for the compile, then put back
function showLazy(){
  ensureBossLight(); ensureBarrierMesh(); ensureJudgeLines();
  lazy.length = 0;
  for (const o of [inkProbe, shared.bossLight, shared._barrierMesh]) if (o) lazy.push([o, o.visible]);
}
let built = false;
export function prewarmShaders(){
  if (!built){ built = true; buildSpecimens(); }
  showLazy();
  for (const [o] of lazy) o.visible = true;
  for (const o of specimens) o.visible = true;
  // the boss's lights, the darksaber's, a partner's saber: while any are in, as many pooled flash lights stand down, so
  // the light count (part of every program) stays the one compiled here (fx/lights.js)
  holdLightCount();
  try { compileLive(); } catch(e){}
  for (const o of specimens) o.visible = false;
  for (const [o, v] of lazy) o.visible = v;
}
arenaBuilt.push(prewarmShaders);

/* ---------- 2. MODELS ----------
   A model is built (lofted, merged, skinned) the first time its type spawns, at 15-40 ms a model. Do them all up
   front instead: one per idle slice while the menus are up, never during play (a slice that overruns its frame is a
   hitch), and whatever is still left when an arena is built gets built right there, under the load, so no spawn mid-
   fight pays for it. */
const jobs = [];
for (const t of Object.values(ENEMY_TYPES)){
  const pool = lookPool(t.model);
  if (pool) pool.forEach((_, lookIndex) => jobs.push(() => buildEnemyMesh(t, { lookIndex })));   // every look in its pool (data/foe-looks.js)
  else for (const variant of variantsOf(t)) for (const face of facesOf(t, variant)) jobs.push(() => buildEnemyMesh(t, { variant, face }));   // every marking and face
}
for (const t of Object.values(TURNED)) jobs.push(() => buildEnemyMesh({ ...ENEMY_TYPES.blaster, ...t }));   // the prologue's turned company (data/allies.js)
for (const t of [...Object.values(PURGE), ...Object.values(DRILL)]) jobs.push(() => buildEnemyMesh({ ...ENEMY_TYPES.blaster, ...t }));   // the trooper's story: the purge companies, the drill's droids
jobs.push(() => buildEnemyMesh({ ...ENEMY_TYPES.officer, ...MARSHAL }));   // the trooper story's rival
for (const roster of Object.values(SQUAD.roster)) for (const d of roster) jobs.push(() => buildEnemyMesh({ model: d.model, color: d.color, eye: d.eye, cloth: d.cloth, scale: d.scale || 1, ranged: true }));
for (const look of CAST_IDS) jobs.push(() => buildEnemyMesh(ENEMY_TYPES.acolyte, { look }));   // the saber cast's named faces (data/saber-cast.js)
jobs.push(() => buildEnemyMesh({ ...ENEMY_TYPES[MAGISTRATE.type], ...MAGISTRATE.dress }));
jobs.push(() => buildEnemyMesh({ ...ENEMY_TYPES[MARSHAL_BOSS.type], ...MARSHAL_BOSS.dress }));   // the Marshal as the trooper's final boss   // the Iron Magistrate in his own model (Darth Vexis is a cast look above: data/saber-cast.js)
for (const [kind, i] of CIV_PREWARM) jobs.push(() => buildCivilian(kind, i));   // the people a mission saves (enemies/civilian.js)
const run = job => { try { job(); } catch(e){} };
const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 1500 }) : f => setTimeout(f, 60);
function next(){
  if (!jobs.length) return;
  if (G.mode === 'play' && !G.paused){ setTimeout(next, 500); return; }   // in a fight: wait for a menu, a pause or the next load
  run(jobs.shift());
  idle(next);
}
idle(next);
// (first in line, ahead of the shader warm-up above)
arenaBuilt.unshift(() => { while (jobs.length) run(jobs.shift()); });
