// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Main menu showcase: while the title screen is up, the canvas draws a painted backdrop and the picked hero on a lit
// turntable on the right, instead of the live arena. Switching hero spins the turntable and swaps the figure.

import * as THREE from 'three';
import { renderer, composer, renderPass, scene, camera, bloomPass, compileLive, standPost, hemi, parallelCompile, compileAhead, compileLiveAhead } from '../engine/renderer.js';
import { holdBoot } from './boot.js';
import { inkRim } from '../player/model/styles.js';
import { G } from '../state.js';
import { prewarmJudgeFX } from '../player/jedi/judgement-fx.js';
import { buildHeroModel } from '../player/model/index.js';
import { benchOpen, renderBench } from './bench-stage.js';
import { kitSet, kitSets } from './kit-stage.js';
import { applySaberGrip, setSaberStaff, setSaberDual, syncOffSaber, setPistolLook, setLongGun, setRifleMod } from '../player/model/weapons.js';
import { settleCloth, stepCloth } from '../player/model/cloth.js';
import { blink } from '../player/model/life.js';
import { wornLook, loadPicks } from '../player/mesh.js';
import { heroName } from '../game/wardrobe.js';
import { STANCES, SWING_PATTERNS, stanceUnlocked } from '../data/stances.js';
import { FORM_OF, FOOTWORK, FOOTWORK_GRIP } from '../data/poses.js';
import { FORMS, formGrip, forkClosed, isStaff, isDual } from '../data/forms.js';
import { guardPose, swingPose, applySaberPose, releaseSaberPose, saberPose } from '../player/anim/saber.js';
import { rexRest, riflePose } from '../player/anim/guns.js';

const HERO_X = 0.72;     // where the figure stands across the screen (0 = left edge, 1 = right)
const TURN = 0.32;       // turntable speed while customizing, rad/s (on the title screen the camera orbits instead)
const FACE = 0.38;       // on the title screen the figure stands turned this far to its left: a three-quarter view
const ORBIT = 0.34, ORBIT_RATE = 0.11;   // the camera's slow drift round the stand: how far either way (rad), and how fast
const SWAP = 0.9;        // seconds the hero swap takes
const STAND_BLOOM = 1.35; // bloom threshold on the stand (the arena's is lower, renderer.js)
const STAND_RIM = 1.0;    // the Ink look's edge light on the stand (the arena's is lower: model/styles.js inkRim)

/* each hero's display: colours for the backdrop, the pedestal lights, and the pose on the stand */
const THEMES = {
  jedi: {
    word: 'JEDI',
    sky: ['#0a0b38', '#2b2fb4', '#1798e0', '#8af0ff'],
    halo: '#bdf6ff', ink: '#070a2e', far: '#141a66', glow: 0x48c8ff, rim: 0x4a7bff, key: 0xe8f3ff,
    stars: true, planet: { c: '#d9e4ff', shade: '#3a3f9e', ring: true }, skyline: 'spires', suns: 0,
  },
  mando: {
    word: 'MANDALORIAN',
    sky: ['#24050f', '#7e1022', '#e5501c', '#ffd77a'],
    halo: '#fff0c2', ink: '#1c0608', far: '#4b1212', glow: 0xff8a3a, rim: 0xff5a2a, key: 0xfff0dc,
    stars: false, planet: { c: '#ffe2b0', shade: '#a33a1c', ring: false }, skyline: 'mesas', suns: 2,
  },
  // the clone trooper: a stormy dusk over a city of spires, in the legion's blue. TROOPER until his promotion to ARC
  trooper: {
    get word(){ return heroName('trooper'); },
    sky: ['#05101c', '#123a5c', '#2f7fd6', '#c8e6ff'],
    halo: '#e8f4ff', ink: '#040a12', far: '#0e2236', glow: 0x4aa8ff, rim: 0x2f7fd6, key: 0xf2f6ff,
    stars: true, planet: { c: '#cfe0f0', shade: '#2a4a6a', ring: false }, skyline: 'spires', suns: 0,
  },
};

const POSES = {
  // (the Jedi's legs and the start of the arms: the idle below sets the arms through the game's own saber IK)
  jedi: {
    armR: { sh: [-1.05, -0.95, -0.5], el: [-1.2, 0, 0] }, armL: { sh: [-0.45, 0.3, 0.12], el: [-0.85, 0, 0] },
    saber: [0.15, 0, -0.35], torso: [0, 0.05, 0], head: [0.04, -0.1, 0],
    legL: { hip: [0.05, 0, -0.3], knee: [0.25, 0, 0] }, legR: { hip: [-0.05, 0, 0.3], knee: [0.25, 0, 0] }, drop: -0.05,
  },
  // easy stance, blaster held low at the side
  mando: {
    armR: { sh: [-0.3, -0.05, -0.22], el: [-0.55, 0, 0] }, armL: { sh: [0.05, 0.1, 0.22], el: [-0.35, 0, 0] },
    torso: [0, -0.08, 0], head: [0.02, 0.12, 0],
    legL: { hip: [0.06, 0, -0.14], knee: [0.08, 0, 0] }, legR: { hip: [-0.06, 0, 0.16], knee: [0.12, 0, 0] },
  },
  // Rex at ease: a DC-17 in each hand, held low, feet planted wide
  trooper: {
    armR: { sh: [-0.2, -0.05, -0.3], el: [-0.5, 0, 0] }, armL: { sh: [-0.15, 0.05, 0.3], el: [-0.5, 0, 0] },
    torso: [0, 0.06, 0], head: [0.02, -0.08, 0],
    legL: { hip: [0.04, 0, -0.18], knee: [0.06, 0, 0] }, legR: { hip: [-0.04, 0, 0.18], knee: [0.06, 0, 0] },
  },
};

/* THE JEDI AT EASE, between the guards of the title screen's stance cycle: not a fighting guard but a calm, ready stand. The lit saber hangs in the weapon
   hand by the hip, blade angled down and out in front, the off hand loose at the side; the weight settles from foot to
   foot. Set as a target for the game's saber IK (anim/saber.js guardPose, chest space as in data/poses.js) */
const v3 = (a) => new THREE.Vector3(...a);
const JEDI_IDLE = {
  hand: v3([0.32, -0.28, 0.28]), blade: v3([0.34, -0.42, 0.84]).normalize(), pole: v3([0.6, -0.8, -0.1]).normalize(), two: false,
  twist: 0.1, torso: 0, lean: 0, gaze: 0.35,
  off: { hand: v3([-0.32, -0.4, 0.12]), pole: v3([-0.5, -0.85, -0.2]).normalize(), sway: 0 },
};
const IDLE_FEET = { crouch: -0.05, splay: 0.2 };


/* ---------- scene ---------- */
const stage = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 2.5, 40);   // the stand is 6+ m away: a tight depth range keeps the figure's ink outlines from z-fighting through its surfaces
cam.position.set(0, 1.9, 9.4);
cam.lookAt(0, 1.3, 0);

stage.add(new THREE.HemisphereLight(0x9fb4ff, 0x1a1012, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(2.5, 5, 6); stage.add(key);
const rimL = new THREE.DirectionalLight(0xffffff, 1.6); rimL.position.set(-4, 3, -4); stage.add(rimL);
const rimR = new THREE.DirectionalLight(0xffffff, 1.2); rimR.position.set(4, 2.5, -3); stage.add(rimR);
const spot = new THREE.SpotLight(0xffffff, 26, 9, 0.42, 0.6, 1.6); spot.position.set(0, 6, 1.4); stage.add(spot, spot.target);
spot.target.position.set(0, 0.6, 0);

/* the backdrop: a screen-filling quad mixing two painted canvases, with slowly sweeping light rays from the halo */
const bgMat = new THREE.ShaderMaterial({
  uniforms: { a: { value: null }, b: { value: null }, mixAB: { value: 0 }, t: { value: 0 }, center: { value: new THREE.Vector2(HERO_X, 0.56) },
    aspect: { value: 1 }, rayA: { value: new THREE.Color() }, rayB: { value: new THREE.Color() }, flare: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D a, b; uniform float mixAB, t, aspect, flare; uniform vec2 center; uniform vec3 rayA, rayB;
    varying vec2 vUv;
    void main(){
      vec3 c = mix(texture2D(a, vUv).rgb, texture2D(b, vUv).rgb, mixAB);
      vec2 d = (vUv - center) * vec2(aspect, 1.0);
      float r = length(d), ang = atan(d.y, d.x);
      float rays = smoothstep(0.35, 1.0, sin(ang * 11.0 + t * 0.07) * 0.5 + 0.5) * 0.6
                 + smoothstep(0.55, 1.0, sin(ang * 5.0 - t * 0.045 + 1.3) * 0.5 + 0.5) * 0.4;
      float fall = smoothstep(1.25, 0.12, r) * (1.0 - smoothstep(0.0, 0.1, -d.y - 0.18));   // fade out, and below the horizon
      c += mix(rayA, rayB, mixAB) * rays * fall * (0.16 + flare * 0.5);
      gl_FragColor = vec4(c, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
bg.frustumCulled = false; bg.renderOrder = -10;
stage.add(bg);

/* turntable: pedestal + figure turn together */
const table = new THREE.Group();
stage.add(table);
const PED_H = 0.24;
const pedMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.38, metalness: 0.75 });
const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.12, PED_H, 64), pedMat);
ped.position.y = PED_H / 2; table.add(ped);
const step = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.3, 0.08, 64), pedMat);
step.position.y = 0.04; table.add(step);
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const rimRing = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.022, 8, 96), glowMat);
rimRing.rotation.x = Math.PI / 2; rimRing.position.y = PED_H; table.add(rimRing);
const inRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.66, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
inRing.rotation.x = -Math.PI / 2; inRing.position.y = PED_H + 0.003; table.add(inRing);
// tick marks round the rim, so the turn reads even when the figure faces the camera
const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.012, 0.14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }), 24);
{ const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 24; i++){ const a = i / 24 * Math.PI * 2;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    ticks.setMatrixAt(i, m.compose(new THREE.Vector3(Math.cos(a) * 0.86, PED_H + 0.006, Math.sin(a) * 0.86), q, new THREE.Vector3(1, 1, 1))); } }
table.add(ticks);
// soft pool of light on and under the stand
const poolTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.005; stage.add(pool);
// the swap beam: a column of light that flares up the stand while the figure changes
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 4.2, 48, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, alphaMap: (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 128);
    return new THREE.CanvasTexture(c);
  })() }));
beam.position.y = PED_H + 2.1; stage.add(beam);

/* the figure: its own copy of the hero model (both outfits on one rig, like the player) */
const fig = { group: new THREE.Group() };
fig.group.position.y = PED_H;
table.add(fig.group);
let R, hipsY;
/* The stand skins the hands on the CPU: each skinned mesh (hands and their ink hulls) is swapped for a plain mesh whose
   vertices are skinned here every frame, and the original is kept hidden to drive the bones. On Firefox the GPU-skinned
   hands flashed a black box now and then as the stand turned. */
let cpuSkinned = [];
function cpuSkin(root){
  cpuSkinned = [];
  const swap = (sm, into) => {
    const geo = sm.geometry.clone();
    geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight');
    geo.setAttribute('position', geo.attributes.position.clone().setUsage(THREE.DynamicDrawUsage));
    const rm = new THREE.Mesh(geo, sm.material);
    rm.matrixAutoUpdate = false; rm.matrix.copy(sm.matrix); rm.matrixWorldNeedsUpdate = true;
    rm.frustumCulled = false; rm.castShadow = false; rm.renderOrder = sm.renderOrder;
    into.add(rm);
    sm.layers.set(1);   // still updated with the tree, never drawn
    cpuSkinned.push({ sm, rm });
    for (const c of sm.children) if (c.isSkinnedMesh) swap(c, rm);
    return rm;
  };
  const tops = [];
  root.traverse(o => { if (o.isSkinnedMesh && !(o.parent && o.parent.isSkinnedMesh)) tops.push(o); });
  for (const sm of tops) swap(sm, sm.parent);
}
const _bm = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()], _bt = new THREE.Matrix4();
function chainVisible(o){ for (; o; o = o.parent) if (!o.visible) return false; return true; }
function updateCpuSkin(){
  if (!cpuSkinned.length) return;
  stage.updateMatrixWorld(true);   // the bones' (and the hidden originals') world matrices
  for (const { sm, rm } of cpuSkinned){
    rm.visible = sm.visible;
    if (!chainVisible(rm)) continue;
    const bones = sm.skeleton.bones, inv = sm.skeleton.boneInverses, n = Math.min(bones.length, 4);
    for (let j = 0; j < n; j++){   // vertex → bone → back into the mesh's own space, one matrix per bone
      _bt.multiplyMatrices(bones[j].matrixWorld, inv[j]).multiply(sm.bindMatrix);
      _bm[j].multiplyMatrices(sm.bindMatrixInverse, _bt);
    }
    const src = sm.geometry.attributes.position, idx = sm.geometry.attributes.skinIndex, wt = sm.geometry.attributes.skinWeight, dst = rm.geometry.attributes.position;
    for (let i = 0; i < src.count; i++){
      const x = src.getX(i), y = src.getY(i), z = src.getZ(i);
      let ox = 0, oy = 0, oz = 0;
      for (let c = 0; c < 4; c++){
        const w = wt.getComponent(i, c);
        if (w === 0) continue;
        const e = _bm[idx.getComponent(i, c)].elements;
        ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12]);
        oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
        oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      }
      dst.setXYZ(i, ox, oy, oz);
    }
    dst.needsUpdate = true;
  }
}
/* THE PICK HITCH: disposing the old figure's materials at once dropped every shader program it used to no users, so
   three.js deleted them, and the new figure (the same materials, rebuilt) compiled and linked them all over again: a
   dozen programs, a second or more of a stalled main thread on every option picked (the title music stuttering with
   it). The old figure's materials are kept until the new one has been drawn and warmed (warmStand), so its programs
   are found in the cache instead; only its geometry goes at once. */
const retired = [];
function retire(vis){
  vis.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) retired.push(o.material); });
}
function flushRetired(keep = 0){   // (keep: the newest few left, while the stand hasn't warmed the figure yet)
  const drop = retired.splice(0, Math.max(0, retired.length - keep));
  for (const m of drop) for (const x of [].concat(m)) x.dispose();
}
function build(picks){
  if (fig.vis){ fig.group.remove(fig.vis); retire(fig.vis); if (retired.length > 4000) flushRetired(2000); }
  fig.group.add(buildHeroModel(fig, wornLook(picks)));
  cpuSkin(fig.vis);
  fig.blade.light.intensity = 2.2;   // the saber's real light floods a close-up; keep it low so the model reads
  const crystal = fig.look.jedi.saber;
  if (crystal != null){ fig.blade.glow.material.color.setHex(crystal); fig.blade.light.color.setHex(crystal); }
  R = fig.rig;
  hipsY = R.hips.position.y;
  standWarm = false; warmAt = performance.now() + 600;   // a new figure: its outfits' buffers are new too (warmStand)
}
/* THE FIRST-SWAP HITCH: every outfit lives on the one rig, hidden until its hero is picked, and three.js only builds a
   material's shader and uploads a mesh's buffers the first time it's drawn. So the first switch to each hero paid for a
   dozen shader programs and ~180 meshes in one frame, a visible stutter as the stand spun. Instead the whole wardrobe
   is drawn off screen, into the composer's spare buffer (the same target, so the same shader variants, as the stand's
   real draw): on the title screen's first frame, behind the loader (ui/boot.js). A moment after the customizer
   rebuilds the figure (new meshes, and a new look can need new programs) it's warmed again, drawn into one pixel. In a fight the hero never changes:
   the arena's own warm-up (engine/prewarm.js) compiles the player as they are. */
let standWarm = false, warmAt = 0, stageWarmed = false;
function standDraw(full){   // (full: false draws one pixel: the buffers go up, the fill is skipped)
  stage.updateMatrixWorld(true);
  const prev = renderer.getRenderTarget(), rt = composer.readBuffer, sc = rt.scissorTest;
  if (!full){ rt.scissor.set(0, 0, 1, 1); rt.scissorTest = true; }   // (before it's bound: the target's scissor is read then)
  renderer.setRenderTarget(rt);
  try { renderer.compile(stage, cam); renderer.render(stage, cam); } catch(e){}
  finally { if (!full){ rt.scissorTest = sc; rt.scissor.set(0, 0, rt.width, rt.height); } renderer.setRenderTarget(prev); }
}
const _snap = [];
let aheadWarm = 0;   // 0 not begun · 1 linking in parallel · 2 done (renderShowcase)
// warmStand's passes (each hero as the stand shows them, then everything on the rig as the Jedi), compiled ahead instead
// of drawn: their programs link in parallel, and warmStand then draws them linked
function warmStandAhead(){
  const was = shown, rt = composer.readBuffer, all = [];
  stage.updateMatrixWorld(true);
  for (const h of ['mando', 'trooper', 'jedi']){ dress(h, false); all.push(compileAhead(stage, cam, rt)); }
  const lit = [], parts = [];
  fig.vis.traverse(o => { if (o.isLight && o.visible && !chainVisible(o)){ o.visible = false; lit.push(o); } });
  fig.vis.traverse(o => { if (!o.visible && !o.isLight){ o.visible = true; parts.push(o); } });
  all.push(compileAhead(stage, cam, rt));
  for (const o of parts) o.visible = false;
  for (const o of lit) o.visible = true;
  dress(was, false);
  return Promise.all(all);
}
function warmStand(){
  standWarm = true;
  const first = !stageWarmed, was = shown;
  stageWarmed = true;
  // the figure's pose as it stands now (its idle, a stance preview…), put back after, so the warm-up never shows
  _snap.length = 0;
  fig.group.traverse(o => _snap.push(o, o.position.clone(), o.quaternion.clone(), o.scale.clone()));
  // the number of lights is part of every program, and the Jedi's lit blade is one: so each hero, dressed as the stand
  // shows them (the gunners with no blade light), gets its own pass. The first time, behind the loader, each is drawn
  // in full, so the programs are linked and the buffers up; after a rebuild, with the menu showing, into one pixel
  // (drawing it all in full then cost a long frame of its own)
  for (const h of ['mando', 'trooper', 'jedi']){ dress(h, false); standDraw(first); }
  // …then, as the Jedi, everything on the rig at once (the long guns, the Darksaber, the second blades): every hidden
  // part shown, but no light that's off now comes on, so the count (and so the programs) stays the Jedi's
  const lit = [], parts = [];
  fig.vis.traverse(o => { if (o.isLight && o.visible && !chainVisible(o)){ o.visible = false; lit.push(o); } });
  fig.vis.traverse(o => { if (!o.visible && !o.isLight){ o.visible = true; parts.push(o); } });
  if (first) for (const k in textures) renderer.initTexture(textures[k]);   // the other heroes' painted backdrops
  standDraw(first);
  for (const o of parts) o.visible = false;
  for (const o of lit) o.visible = true;
  dress(was, false);
  for (let i = 0; i < _snap.length; i += 4){ const o = _snap[i]; o.position.copy(_snap[i + 1]); o.quaternion.copy(_snap[i + 2]); o.scale.copy(_snap[i + 3]); }
  _snap.length = 0;
  flushRetired();   // the new figure holds its programs now: the old one's materials can go
}
build(loadPicks());
// the customizer restyles the figure on the stand as each option is picked
export function restyleShowcase(picks){
  idle.on = false; saberPose.live = false;   // the new figure settles into its idle afresh
  build(picks);
  if (shown) dress(shown);
  for (const k in painted) if (painted[k] !== THEMES[k].word) paint(k);   // (the trooper's name follows his rank)
}

let shown = null;   // hero currently on the stand
let rifleOn = false;   // the trooper holds the DC-15, not the DC-17s (showcaseRifle)
let figTop = 0, fitTop = 0;   // the dressed figure's top (world y), and the eased value the close-up frames to
function dress(hero, settle = true){   // (settle: false, for warmStand, leaves the cloth as it hangs)
  if (hero === 'trooper' && !(fig.trooperParts && fig.trooperParts.length)) hero = 'mando';
  shown = hero;
  const mando = hero === 'mando', trooper = hero === 'trooper', gunner = mando || trooper, P = POSES[hero];
  for (const m of fig.mandoParts) m.visible = mando;
  for (const m of fig.trooperParts || []) m.visible = trooper;
  for (const m of fig.headBare) m.visible = !gunner;
  R.skirt.visible = !gunner;
  fig.saberHand.visible = !gunner;
  fig.pistols.L.visible = trooper;
  fig.pistols.R.visible = gunner;
  setPistolLook(fig, trooper ? 'pistols' : 'single');
  fig.rifleMesh.visible = false;
  fig.darksaberMesh.visible = false;
  applySaberGrip(fig, G.saberGrip, true);
  setSaberStaff(fig, false, false);   // (the stance preview and the form rotation put the saber staff in hand themselves)
  setSaberDual(fig, false, false);    // (…and Jar'Kai's second saber)
  const set = (o, v) => o.rotation.set(...(v || [0, 0, 0]));
  for (const s of ['armL', 'armR']){ set(R[s].sh, P[s].sh); set(R[s].el, P[s].el); }
  for (const s of ['legL', 'legR']){ set(R[s].hip, P[s].hip); set(R[s].knee, P[s].knee); }
  set(R.torso, P.torso); set(R.head, P.head);
  if (P.saber) set(fig.saberHand, P.saber);
  R.hips.position.y = hipsY + (P.drop || 0);
  if (trooper && rifleOn){
    // THE ARMORY LOCKER (ui/kitbench.js): the DC-15 in hand at the low ready, so its stock and finish are on show
    fig.pistols.L.visible = fig.pistols.R.visible = false;
    setLongGun(fig, 'dc15'); setRifleMod(fig, 'burst');
    fig.rifleMesh.visible = true;
    stage.updateMatrixWorld(true);
    riflePose(1, R, { rifleMesh: fig.rifleMesh, recoil: 0 }, fig.vis.localToWorld(new THREE.Vector3(0.6, 0.2, 6)));
  } else if (trooper) rexRest(R, fig.pistols);   // the DC-17s Rex's way, as he carries them in the fight: one up, one down
  if (settle) settleCloth(fig);
  figTop = measureTop();
}

/* how tall the dressed figure stands (helmet crest, antenna, raised pistol and all; the Jedi's blade left out), so the
   customizer's close-up can frame every hero and build head to toe */
const _box = new THREE.Box3(), _ob = new THREE.Box3();
function measureTop(){
  stage.updateMatrixWorld(true);
  _box.makeEmpty();
  fig.vis.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || !(o.layers.mask & 1) || !chainVisible(o)) return;
    for (let p = o; p; p = p.parent) if (p === fig.saberHand) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    _box.union(_ob.copy(g.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return _box.isEmpty() ? PED_H + 2.2 : _box.max.y;
}

/* ---------- painted backdrops ---------- */
const BG_W = 1600;
const canvases = { jedi: document.createElement('canvas'), mando: document.createElement('canvas'), trooper: document.createElement('canvas') };
const textures = {};
for (const k in canvases){ textures[k] = new THREE.CanvasTexture(canvases[k]); textures[k].colorSpace = THREE.SRGBColorSpace; }

// a seeded random, so the painting is the same every time it's redrawn
function rng(seed){ return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

function paint(k){
  const T = THEMES[k], c = canvases[k];
  const W = BG_W, H = Math.round(BG_W / Math.max(0.5, innerWidth / innerHeight));
  c.width = W; c.height = H;
  const x = c.getContext('2d'), rnd = rng(k === 'jedi' ? 7 : 11);
  const cx = HERO_X * W, hz = H * 0.8;   // halo centre x, horizon line
  // sky
  let g = x.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, T.sky[0]); g.addColorStop(0.45, T.sky[1]); g.addColorStop(0.82, T.sky[2]); g.addColorStop(1, T.sky[3]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // stars
  if (T.stars) for (let i = 0; i < 260; i++){
    const sx = rnd() * W, sy = rnd() * hz * 0.6, s = rnd();
    x.fillStyle = `rgba(255,255,255,${0.25 + s * 0.6 * (1 - sy / (hz * 0.6))})`;
    x.fillRect(sx, sy, s > 0.93 ? 3 : 1.6, s > 0.93 ? 3 : 1.6);
  }
  // halftone dots fading down from the top: the comic-book grain of the game's Ink look
  x.fillStyle = 'rgba(0,0,0,.28)';
  for (let y = 8; y < hz * 0.55; y += 14) for (let xx = (y / 14) % 2 * 7; xx < W; xx += 14){
    const r = 4.2 * (1 - y / (hz * 0.55)); if (r > 0.4){ x.beginPath(); x.arc(xx, y, r, 0, 6.283); x.fill(); }
  }
  // planet, high and to the right of the halo
  const pr = H * 0.17, px = cx + W * 0.14, py = H * 0.22;
  g = x.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
  g.addColorStop(0, T.planet.c); g.addColorStop(1, T.planet.shade);
  x.fillStyle = g; x.beginPath(); x.arc(px, py, pr, 0, 6.283); x.fill();
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(px + pr * 0.38, py + pr * 0.22, pr * 0.95, 0, 6.283); x.arc(px, py, pr, 0, 6.283, true); x.fill('evenodd');
  if (T.planet.ring){
    x.save(); x.translate(px, py); x.rotate(-0.38); x.scale(1, 0.22);
    x.strokeStyle = 'rgba(220,235,255,.55)'; x.lineWidth = pr * 0.16;
    x.beginPath(); x.arc(0, 0, pr * 1.65, Math.PI * 0.02, Math.PI * 0.98); x.stroke(); x.restore();
  }
  // the halo behind the hero: a hot disc with ink rings round it
  const hy = H * 0.44, hr = H * 0.34;
  g = x.createRadialGradient(cx, hy, 0, cx, hy, hr * 1.9);
  g.addColorStop(0, T.halo + 'c0'); g.addColorStop(0.25, T.halo + '70'); g.addColorStop(0.6, T.halo + '22'); g.addColorStop(1, T.halo + '00');
  x.fillStyle = g; x.beginPath(); x.arc(cx, hy, hr * 1.9, 0, 6.283); x.fill();
  // (the ink rings round the halo and the hero's name in giant letters behind the stand are gone: with the moon, the
  // rays and the skyline they crowded the figure. The menu's hero cards carry the name.)
  // twin suns, low over the mesas between the menu and the stand
  for (let i = 0; i < T.suns; i++){
    const sx = cx - W * (0.2 - i * 0.055), sy = hz - H * (0.2 + i * 0.07), sr = H * (0.034 - i * 0.012);
    g = x.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
    g.addColorStop(0, '#ffe7a8cc'); g.addColorStop(1, '#ffe7a800');
    x.fillStyle = g; x.beginPath(); x.arc(sx, sy, sr * 3, 0, 6.283); x.fill();
    x.fillStyle = '#ffe2a0'; x.beginPath(); x.arc(sx, sy, sr, 0, 6.283); x.fill();
  }
  // far skyline, then the near one in ink
  const skyline = (col, base, amp, seed, near) => {
    const r = rng(seed); x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
    let xx = 0;
    while (xx < W){
      if (T.skyline === 'spires'){
        const w = 24 + r() * 60, top = base - amp * (0.2 + r() * 0.6);
        x.lineTo(xx, base); x.lineTo(xx, top);
        if (r() > 0.45){   // a needle spire on top
          x.lineTo(xx + w * 0.38, top); x.lineTo(xx + w * 0.5, top - amp * (near ? 1.2 : 0.9) * (0.5 + r() * 0.5)); x.lineTo(xx + w * 0.62, top);
        }
        x.lineTo(xx + w, top); x.lineTo(xx + w, base);
        xx += w + r() * 40;
      } else {
        const w = 120 + r() * 260, h = amp * (0.3 + r() * 0.7);
        x.lineTo(xx + w * 0.12, base - h); x.lineTo(xx + w * 0.88, base - h); x.lineTo(xx + w, base);
        xx += w - 10;
      }
    }
    x.lineTo(W, base); x.lineTo(W, H); x.fill();
  };
  skyline(T.far, hz + H * 0.01, H * 0.12, 3, false);
  skyline(T.ink, hz + H * 0.07, H * 0.07, 5, true);
  x.fillStyle = T.ink; x.fillRect(0, hz + H * 0.07, W, H);
  textures[k].needsUpdate = true;
  painted[k] = T.word;
}
const painted = {};
function paintAll(){ paint('jedi'); paint('mando'); paint('trooper'); }
paintAll();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintAll);   // the hero name needs the display font

/* ---------- framing ---------- */
let camZ = 9.4;
let focus = 0, focusTo = 0;   // 0 = the whole stand, 1 = closer on the figure (while customizing)
export function focusShowcase(on){ focusTo = on ? 1 : 0; }
// the trooper holds his DC-15 on the stand instead of the DC-17s (while the armory locker is open: ui/kitbench.js)
export function showcaseRifle(on){ if (rifleOn === !!on) return; rifleOn = !!on; if (shown) dress(shown); }
export function spinShowcase(rad){ spin += rad; }   // drag to turn the stand
// THE GUNNERS' BENCH SETS (ui/kit-stage.js): while the armory locker or the beskar forge is open the hero stands in that
// room on its own pad, not on the customizer's turntable under the painted sky. null puts the stand back
let kitOn = null;
const STAND_BITS = [ped, step, rimRing, inRing, ticks, pool, beam, bg];
export function showcaseKit(hero){
  kitOn = hero || null;
  const want = kitOn && kitSet(kitOn, PED_H);
  if (want && !want.room.parent){ stage.add(want.room); table.add(want.pad); }
  for (const k of kitSets()) k.room.visible = k.pad.visible = k === want;
  for (const o of STAND_BITS) o.visible = !want;
  stage.background = want ? want.bg : null;
}
function frame(){
  const w = innerWidth, h = innerHeight;
  cam.aspect = w / h;
  // shift the view so the stand sits at HERO_X instead of mid-screen; on narrow screens pull it back a little
  cam.setViewOffset(w, h, -(HERO_X - 0.5) * w, 0, w, h);
  camZ = w / h < 1.3 ? 10.8 : 9.4;
  cam.updateProjectionMatrix();
  bgMat.uniforms.aspect.value = w / h;
}
frame();
addEventListener('resize', () => { frame(); paintAll(); });
/* the close-up while customizing: the band from the stand's foot to the figure's top plus headroom fills the view, so a
   tall helmet or a heavy build pulls the camera back instead of losing its head off the top of the screen */
const HALF_FOV = Math.tan(THREE.MathUtils.degToRad(28 / 2));
const fitOut = { y: 0, z: 0, look: 0 };
function closeUp(top){
  const lo = -0.05, hi = top + 0.22 + (top - lo) * 0.06;   // headroom: a fixed margin plus a share of the height
  const mid = (lo + hi) / 2, half = (hi - lo) / 2;
  fitOut.look = mid;
  fitOut.y = mid + 0.45;   // a touch above, looking slightly down onto the stand
  fitOut.z = Math.max(5.6, half / HALF_FOV) * (cam.aspect < 1.3 ? 1.12 : 1);
  return fitOut;
}

/* ---------- per frame ---------- */
const accent = new THREE.Color(), tmpC = new THREE.Color(), _sky = new THREE.Color();
let spin = 0, swapT = -1, nextHero = null, warm = false;
function setTheme(k, now){
  const T = THEMES[k];
  if (now){ accent.setHex(T.glow); bgMat.uniforms.a.value = bgMat.uniforms.b.value = textures[k]; bgMat.uniforms.mixAB.value = 0; }
  rimL.color.setHex(T.rim); rimR.color.setHex(T.glow); key.color.setHex(T.key);
  bgMat.uniforms.rayA.value.setHex(THEMES[shown || k].glow); bgMat.uniforms.rayB.value.setHex(T.glow);
}

export function showcaseActive(){
  return !!pv.id || (G.mode === 'menu' && !G.fovPreview && document.getElementById('overlay').style.display !== 'none');
}

/* ---------- the STANCE PREVIEW: the unlock screen (game/meditation.js) shows the hero on the stand, running a form's own
   guard and cuts through the game's own saber animation (anim/saber.js), looping: guard, the three-cut string, the block ---------- */
const pv = { id: null, t: 0, phase: 0, sw: null, vy: 0 };
const PV_PLAN = [{ guard: 1.1 }, { cut: 0 }, { cut: 1 }, { cut: 2 }, { guard: 0.9 }, { block: 1.1 }];
export function previewStance(id){
  if (!id){
    if (!pv.id) return;
    pv.id = null; pv.sw = null;
    if (R){ releaseSaberPose(R, 1); R.chest.rotation.y = 0; fig.vis.rotation.y = 0; fig.vis.position.y = pv.vy; setSaberStaff(fig, false, false); setSaberDual(fig, false, false); if (shown) dress(shown); }
    document.body.classList.remove('stance-preview');
    return;
  }
  idle.on = false;
  if (!pv.id) pv.vy = fig.vis.position.y;
  Object.assign(pv, { id, t: 0, phase: 0, sw: null });
  dress('jedi'); setTheme('jedi', true);
  const st = STANCES[id];
  applySaberGrip(fig, formGrip(id, G.saberGrip), true);
  setSaberStaff(fig, isStaff(id), false);   // the saber staff shows its long hilt and second blade
  setSaberDual(fig, isDual(id), false);     // Jar'Kai shows a saber in each hand
  const crystal = fig.look.jedi.saber != null ? fig.look.jedi.saber : st.blade;
  fig.blade.glow.material.color.setHex(crystal); fig.blade.light.color.setHex(crystal);
  releaseSaberPose(R, 1);   // the next guard seeds the pose from the figure's own arm
  document.body.classList.add('stance-preview');
}
const SWAY = { y: 0, z: 0, off: 0, moving: false }, smooth = (k) => k * k * (3 - 2 * k);
function previewPose(dt){
  const id = pv.id, form = FORM_OF[id], st = STANCES[id], grip = formGrip(id, G.saberGrip), F = FOOTWORK[form];
  const held = { node: fig.saberHand, root: fig.saberBladeRoot, off: isDual(id) ? fig.offSaber : null }, plan = PV_PLAN[pv.phase];
  pv.t += dt;
  if (held.off) syncOffSaber(fig, true);   // (its grip follows the main hilt's)
  let cue = null, sw = null;
  if (plan.cut != null){
    if (!pv.sw){
      const step = plan.cut, dur = (step === 2 ? 0.52 : 0.4) / st.speed * 1.25;   // a touch slower than the fight, so the cut reads
      pv.sw = { t: 0, dur, step, applied: false, dir: step === 2 ? 'neutral' : step ? 'left' : 'right', pat: step === 2 ? SWING_PATTERNS.forward : step ? SWING_PATTERNS.left : SWING_PATTERNS.right, h: 'mid', riposte: false, flowCut: false };
    }
    sw = pv.sw; sw.t += dt;
    cue = swingPose(R, held, grip, form, sw);
    if (sw.t >= sw.dur){ pv.sw = null; pv.phase++; pv.t = 0; }
  } else {
    guardPose(dt, R, held, grip, form, !!plan.block, SWAY);
    if (pv.t >= (plan.guard || plan.block)){ pv.phase = (pv.phase + 1) % PV_PLAN.length; pv.t = 0; }
  }
  applySaberPose(R, held, true, dt);
  if (!cue) R.head.rotation.y -= saberPose.gaze * R.chest.rotation.y;   // a side-on guard (Soresu) keeps its eyes on the foe
  // the body turns with the blade (a finisher spins all the way round) and settles square between cuts
  const vis = fig.vis;
  if (cue){
    const turn = Math.sign(sw.pat.yT - sw.pat.yF);
    vis.rotation.y = cue.spin ? smooth(cue.cut) * Math.PI * 2 * cue.spin * -(cue.side || 1) : cue.env * st.twist * turn * 0.55;
    vis.position.y = pv.vy + (cue.hop ? Math.sin(Math.PI * cue.k) * cue.hop : 0);
    R.hips.position.y -= cue.drop * cue.env * 0.5;
  } else {
    vis.rotation.y *= Math.max(0, 1 - dt * 12); vis.position.y += (pv.vy - vis.position.y) * Math.min(1, dt * 12);
  }
  // the form's own footing: crouch and splay
  R.hips.position.y += F.crouch * 0.5;
  R.legL.hip.rotation.z = -0.05 - F.splay * 0.32; R.legR.hip.rotation.z = 0.05 + F.splay * 0.32;
  R.legL.knee.rotation.x = R.legR.knee.rotation.x = 0.25 - F.crouch * 1.4;
}

/* ---------- THE STANCE CYCLE: the Jedi on the title screen cycles through the forms the save has unlocked, each in its
   own ready guard and footing (read from data/poses.js through the game's guardPose, so a retuned guard shows here too).
   Between two forms the Jedi eases out of the guard into the at-ease stand (JEDI_IDLE: saber low at the side) for a
   breath, then into the next form's guard. All the while the weight shifts slowly from foot to foot ---------- */
const FORM_FOR = 4.6, EASE_FOR = 2.2;   // seconds in each form's guard, and at ease between two of them
const idle = { on: false, id: null, ease: false, t: 0, crouch: 0, splay: 0 };
const IDLE_SWAY = { y: 0, z: 0, off: 0, moving: false };
const rotForms = () => Object.keys(FORMS).filter(id => FORMS[id].ready && stanceUnlocked(id) && !forkClosed(id, G.formFork));
function pickForm(id){
  Object.assign(idle, { id, ease: false, t: 0 });
  applySaberGrip(fig, formGrip(id, G.saberGrip), false);   // the hilt turns over in the hand if the grip changes
  setSaberStaff(fig, isStaff(id), false);
  const st = STANCES[id], crystal = fig.look.jedi.saber != null ? fig.look.jedi.saber : st && st.blade;   // the customizer's blade colour wins
  if (crystal != null){ fig.blade.glow.material.color.setHex(crystal); fig.blade.light.color.setHex(crystal); }
}
function toEase(){
  Object.assign(idle, { ease: true, t: 0 });
  applySaberGrip(fig, 'regular', false);   // at rest the blade hangs forward from the fist, whatever grip the form used
  setSaberStaff(fig, false, false);
  setSaberDual(fig, false, false);
}
function idleStart(){
  const list = rotForms(), F = FOOTWORK[FORM_OF[list[0]]] || FOOTWORK.niman;
  idle.on = true; idle.crouch = F.crouch; idle.splay = F.splay;
  releaseSaberPose(R, 1);   // the first guard seeds from the figure's own arm
  if (list.length){ applySaberGrip(fig, formGrip(list[0], G.saberGrip), true); pickForm(list[0]); }
  else { applySaberGrip(fig, 'regular', true); toEase(); }
}
function idleStop(){
  if (!idle.on) return;
  idle.on = false;
  releaseSaberPose(R, 1); R.chest.rotation.y = 0;
  applySaberGrip(fig, G.saberGrip, true);
  setSaberStaff(fig, false, false);
}
function idlePose(dt, t, shift){
  const list = rotForms();
  idle.t += dt;
  if (!list.length){ if (!idle.ease) toEase(); }
  else if (idle.ease ? idle.t > EASE_FOR : !list.includes(idle.id)) pickForm(list[(list.indexOf(idle.id) + 1) % list.length]);   // (indexOf −1 → the first)
  else if (!idle.ease && idle.t > FORM_FOR) toEase();
  const held = { node: fig.saberHand, root: fig.saberBladeRoot };
  IDLE_SWAY.y = Math.sin(t * 1.7) * 0.012; IDLE_SWAY.z = Math.sin(t * 0.45) * 0.02;   // the blade rides the breath and the weight shift
  let F;
  if (idle.ease){
    guardPose(dt, R, held, 'regular', 'niman', false, IDLE_SWAY, JEDI_IDLE, 0.5);   // an unhurried settle out of the guard
    F = IDLE_FEET;
  } else {
    const form = FORM_OF[idle.id], grip = formGrip(idle.id, G.saberGrip);
    guardPose(dt, R, held, grip, form, false, IDLE_SWAY, null, 0.7);
    F = FOOTWORK[(FOOTWORK_GRIP[grip] || {})[form] || form] || FOOTWORK.niman;   // (reverse-grip Niman stands on Djem So's feet)
  }
  applySaberPose(R, held, true, dt);
  R.head.rotation.y -= saberPose.gaze * R.chest.rotation.y;   // a side-on guard (Soresu) keeps its eyes on the foe
  // the footing eases from one stance's to the next; the knee off the weight softens as it shifts
  const k = Math.min(1, dt * 3);
  idle.crouch += (F.crouch - idle.crouch) * k; idle.splay += (F.splay - idle.splay) * k;
  R.hips.position.y += idle.crouch * 0.5;
  R.legL.hip.rotation.z = -0.05 - idle.splay * 0.32 - shift * 0.035; R.legR.hip.rotation.z = 0.05 + idle.splay * 0.32 - shift * 0.035;
  const knee = 0.25 - idle.crouch * 1.4;
  R.legL.knee.rotation.x = knee + Math.max(0, shift) * 0.08; R.legR.knee.rotation.x = knee + Math.max(0, -shift) * 0.08;
}

// TEMPORARY flicker hunt: ?dbg=noink,noskin,noblade,nolight,nocull hides parts of the figure (not for merging)
const DBG = new Set((new URLSearchParams(location.search).get('dbg') || '').split(','));
let dbgDone = false;
export function renderShowcase(dt){
  if (benchOpen()) return renderBench(dt, STAND_BLOOM);   // the saber workbench has its own set (ui/bench-stage.js)
  if (!dbgDone && shown){
    dbgDone = true;
    fig.group.traverse(o => {
      if (!o.isMesh) return;
      if (DBG.has('noink') && o.material && o.material.side === THREE.BackSide) o.visible = false;
      if (DBG.has('noskin') && o.isSkinnedMesh) o.visible = false;
      if (DBG.has('nocull')) o.frustumCulled = false;
    });
    if (DBG.has('noblade')){ fig.blade.blade.visible = false; fig.blade.glow.visible = false; }
    if (DBG.has('nolight')) fig.blade.light.visible = false;
  }
  // THE FIRST LAUNCH, IN PARALLEL: where programs can link off the main thread, every one the stand and the fight need is
  // handed over at once behind the loader, and nothing is drawn until they're in (a draw would wait on its own link).
  // Then the warm-ups below find them all linked and only upload buffers (engine/renderer.js compileAhead)
  if (aheadWarm === 0 && parallelCompile && !stageWarmed){
    aheadWarm = 1;
    if (!shown){ dress(G.hero); setTheme(G.hero, true); }
    const p = Promise.all([warmStandAhead(), compileLiveAhead()]).catch(() => {}).finally(() => { aheadWarm = 2; });
    holdBoot(p);
  }
  if (aheadWarm === 1) return;
  if (!warm){ warm = true; compileLive(); prewarmJudgeFX(); }   // keep the arena's shaders ready, so BEGIN doesn't hitch
  if (!shown){ dress(G.hero); setTheme(G.hero, true); }
  // (after the first dress, so it puts back the picked hero's own outfit; after a rebuild, once the picks settle and
  // with no swap, stance preview or kit on the stand, which a re-dress would undo)
  if (!standWarm && (!stageWarmed || (performance.now() >= warmAt && swapT < 0 && !pv.id && !kitOn))) warmStand();
  // hero picked → spin the stand once, swapping the figure at the brightest point of the beam
  if (G.hero !== shown && swapT < 0){ idleStop(); swapT = 0; nextHero = G.hero; setTheme(nextHero, false); bgMat.uniforms.b.value = textures[nextHero]; }
  let flare = 0, boost = 0;
  if (swapT >= 0){
    swapT += dt / SWAP;
    const s = Math.min(1, swapT);
    flare = Math.sin(s * Math.PI);
    boost = flare * 9;
    bgMat.uniforms.mixAB.value = s * s * (3 - 2 * s);
    if (s >= 0.5 && shown !== nextHero) dress(nextHero);
    if (s >= 1){
      swapT = -1;
      bgMat.uniforms.a.value = bgMat.uniforms.b.value; bgMat.uniforms.mixAB.value = 0;
      bgMat.uniforms.rayA.value.copy(bgMat.uniforms.rayB.value);
    }
  }
  focus += ((pv.id ? 0.45 : focusTo) - focus) * Math.min(1, dt * 4);
  const f = focus * focus * (3 - 2 * focus);
  fitTop = fitTop ? fitTop + (figTop - fitTop) * Math.min(1, dt * 5) : figTop;
  const fit = closeUp(fitTop);
  // THE ORBIT: on the title screen the stand holds a three-quarter view and the camera drifts slowly round the front of
  // it and back, rising a touch as it swings; while customizing (f) the stand turns instead, to show every side
  const t = performance.now() / 1000, P = POSES[shown];
  const free = pv.id ? 0 : 1 - f, orb = Math.sin(t * ORBIT_RATE) * ORBIT * free;
  const cz = camZ + (fit.z - camZ) * f, cy = 1.9 + (fit.y - 1.9) * f + Math.cos(t * ORBIT_RATE * 2) * 0.12 * free;
  cam.position.set(Math.sin(orb) * cz, cy, Math.cos(orb) * cz);
  cam.lookAt(0, 1.3 + (fit.look - 1.3) * f, 0);
  if (pv.id) table.rotation.y = 0.5;   // three-quarter view, not turning: the cuts are what is on show
  else {
    spin += (TURN * f + boost) * dt;
    // back on the title screen (after customizing, or the swap's spin) the stand settles to face the front again
    if (swapT < 0 && free > 0.5){ const home = Math.round(spin / (Math.PI * 2)) * Math.PI * 2; spin += (home - spin) * Math.min(1, dt * 1.6 * free); }
    table.rotation.y = FACE * free + spin;
  }
  // a slow breath, the head looking about, and the weight shifting from foot to foot, so the figure isn't a statue
  const shift = Math.sin(t * 0.45);
  R.torso.rotation.x = P.torso[0] + Math.sin(t * 1.7) * 0.025;
  R.torso.rotation.z = (P.torso[2] || 0) - shift * 0.025;
  R.head.rotation.y = P.head[1] + Math.sin(t * 0.6) * 0.1;
  R.hips.position.y = hipsY + (P.drop || 0) + Math.sin(t * 1.7) * 0.008 - Math.abs(shift) * 0.012;
  R.hips.rotation.z = shift * 0.035;
  if (pv.id) previewPose(dt);
  else if (shown === 'jedi' && swapT < 0){
    if (!idle.on) idleStart();
    idlePose(dt, t, shift);
  } else if (!pv.id){
    const L = P.legL, Rr = P.legR;
    R.legL.hip.rotation.z = L.hip[2] - shift * 0.035; R.legR.hip.rotation.z = Rr.hip[2] - shift * 0.035;
  }
  stepCloth(fig, dt, PED_H);
  blink(fig, dt);   // and a blink now and then (model/life.js)
  updateCpuSkin();
  // the stand's lights follow the hero colour
  accent.lerp(tmpC.setHex(THEMES[nextHero || shown].glow), Math.min(1, dt * 5));
  glowMat.color.copy(accent).multiplyScalar(2.2 + flare * 4);
  inRing.material.color.copy(accent); ticks.material.color.copy(accent);
  pool.material.color.copy(accent); pool.material.opacity = 0.45 + flare * 0.4;
  beam.material.color.copy(accent); beam.material.opacity = flare * 0.4;
  spot.intensity = (17 + flare * 16) * (kitOn ? kitSet(kitOn, PED_H).spot : 1);
  bgMat.uniforms.t.value = t; bgMat.uniforms.flare.value = flare;
  if (kitOn) kitSet(kitOn, PED_H).step(dt, t);
  renderPass.scene = stage; renderPass.camera = cam;
  // under the stand's spotlight a pale skin or white tunic lands near full brightness and the bloom set for
  // sabers and bolts would halo it; on the stand only light sources (blade, rings, beam) should glow
  // (and the stand keeps its own bloom strength whatever the arena behind the menu set, see setSceneGlow)
  const th = bloomPass.threshold, st = bloomPass.strength; bloomPass.threshold = STAND_BLOOM; bloomPass.strength = 0.82;
  standPost(true);   // no ambient occlusion or arena colour grade on the stand
  // THE RIM: the Ink surfaces' edge light (model/styles.js) turned up and tinted the hero colour for the stand, so the
  // figure's outline catches the backdrop's light instead of reading as a flat cut-out; the arena's own is put back
  const rimWas = inkRim.value; _sky.copy(hemi.color);
  inkRim.value = STAND_RIM; hemi.color.copy(accent);
  composer.render();
  inkRim.value = rimWas; hemi.color.copy(_sky);
  standPost(false);
  bloomPass.threshold = th; bloomPass.strength = st;
  renderPass.scene = scene; renderPass.camera = camera;
}
export function leaveShowcase(){ warm = false; }   // the next visit re-warms (a new run builds a new arena)
