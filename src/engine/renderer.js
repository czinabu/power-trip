// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Renderer, scene, camera, post-processing (antialiasing, ambient occlusion, light shafts, bloom, colour grade), base lights,
// resize handling.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ============================================================
   ENGINE SETUP
   ============================================================ */
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;   // moodier, more filmic contrast
document.body.appendChild(renderer.domElement);
/* a shipped build doesn't read back every shader's compile log (a stall per program, on top of the compile itself).
   The dev server keeps it, so a shader typo still shows in the console */
if (import.meta.env && import.meta.env.PROD) renderer.debug.checkShaderErrors = false;

export const scene = new THREE.Scene();
/* far: the backdrop stands up to a kilometre or two out (world/backdrop.js). near: depth precision scales with it, and
   with the far land that far out a 0.1 m near plane left too few depth steps out there (far walls and their windows
   flickered through each other). 0.2 doubles it everywhere; the follow camera keeps 0.35 m off any prop (world/camblock.js),
   so nothing it frames ever comes that close */
export const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.2, 4000);

/* post-processing: scene → ambient occlusion → bloom (sabers, bolts and embers glow) → tone map → colour grade.
   ANTIALIASING: the canvas's own antialias does nothing once the scene is drawn into the composer's buffers, so the
   buffers are multisampled themselves (setMSAA, per quality preset in engine/quality.js). */
export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
export function setMSAA(n){
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== n){ rt.samples = n; rt.dispose(); }
}
export const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

/* AMBIENT OCCLUSION — soft contact shadow in corners, under props and where a body meets the floor, so nothing
   floats. HIGH quality only (it draws the scene a second time for depth and normals). Only solid surfaces take part:
   glows, blades, particles, sprites, see-through props and the ink hulls (back faces) are left out, so a saber or a
   muzzle flash never darkens the floor around it. It runs at half resolution (below) and fades out with distance, so
   the fogged backdrop isn't smudged. */
export const aoPass = new GTAOPass(scene, camera, innerWidth, innerHeight);
aoPass.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.5, thickness: 1.2, scale: 1.25, samples: 12 });
aoPass.updatePdMaterial({ samples: 12, radius: 6 });
aoPass.blendIntensity = 0.85;
const _aoHidden = [];
function noAO(o){
  if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO) return true;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  return !!m && (m.transparent || m.side === THREE.BackSide || m.toneMapped === false || m.blending === THREE.AdditiveBlending);
}
/* ...and nothing past where the AO has faded out (aoFade.far): its depth and normals would be drawn for no shade at all
   (a hub's far halls, a battle map's far side, the backdrop). Kept when the light shafts are on: they read this pass's
   depth for where the sky is */
const _aoSph = new THREE.Sphere();
function beyondAO(o){
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.children.length || shaftPass.enabled) return false;   // (a mesh with others hung on it: they may stand elsewhere)
  const bs = o.geometry && o.geometry.boundingSphere;
  if (!bs) return false;
  _aoSph.copy(bs).applyMatrix4(o.matrixWorld);
  return _aoSph.center.distanceTo(camera.position) - _aoSph.radius > aoFade.far + 4;
}
aoPass.overrideVisibility = function(){ this.scene.traverseVisible(o => { if (noAO(o) || beyondAO(o)){ o.visible = false; _aoHidden.push(o); } }); };
aoPass.restoreVisibility = function(){ for (const o of _aoHidden) o.visible = true; _aoHidden.length = 0; };
/* HALF RESOLUTION: the composer hands each pass its size in device pixels. The AO is soft and denoised, so it's worked
   out at half the CSS-pixel resolution (or of the device's, when the resolution scale has it under one pixel per CSS
   pixel): a quarter of the pixels, the blend spreads it back over the full frame */
const _aoSize = aoPass.setSize.bind(aoPass);
aoPass.setSize = (w, h) => { const k = 0.5 / Math.max(1, renderer.getPixelRatio()); _aoSize(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))); };
// the stock blend multiplies the AO in everywhere: this one fades it out from aoFade.near to aoFade.far metres
export const aoFade = { near: 18, far: 46 };
Object.assign(aoPass.blendMaterial.uniforms, { tDepth: { value: aoPass.depthTexture }, cameraNear: { value: 0.1 }, cameraFar: { value: 400 },
  fadeNear: { value: aoFade.near }, fadeFar: { value: aoFade.far } });
aoPass.blendMaterial.fragmentShader = `
  uniform float intensity, cameraNear, cameraFar, fadeNear, fadeFar;
  uniform sampler2D tDiffuse, tDepth;
  varying vec2 vUv;
  void main(){
    float d = texture2D(tDepth, vUv).x;
    float z = cameraNear * cameraFar / ((cameraFar - cameraNear) * d - cameraFar);   // view-space z (negative)
    float k = intensity * (1.0 - smoothstep(fadeNear, fadeFar, -z));
    vec4 texel = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(mix(vec3(1.0), texel.rgb, k), texel.a);
  }`;
aoPass.blendMaterial.needsUpdate = true;
const _aoRender = aoPass.render.bind(aoPass);
aoPass.render = (...a) => {
  const u = aoPass.blendMaterial.uniforms;
  u.cameraNear.value = camera.near; u.cameraFar.value = camera.far; u.fadeNear.value = aoFade.near; u.fadeFar.value = aoFade.far;
  // its depth/normal draw is a second render of the scene, and three.js would redraw the sun's shadow map for it too
  // (every caster, again, each frame). The normals don't take shadows: keep the map the scene pass just drew
  const sm = renderer.shadowMap, auto = sm.autoUpdate;
  sm.autoUpdate = false;
  try { _aoRender(...a); } finally { sm.autoUpdate = auto; }
};
composer.addPass(aoPass);

/* LIGHT SHAFTS — god rays from the painted sun: each pixel marches toward the sun's spot on screen through the AO
   pass's depth buffer, and every step that lands on open sky adds a little of the sun's colour, so the light
   streams between pillars, spires and wrecks. Uses that depth, so it runs with the AO (HIGH); world/air.js aims it
   and sets its strength per world. Added before the bloom, so the brightest rays glow. */
export const shaftPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tDepth: { value: aoPass.depthTexture }, sunUv: { value: new THREE.Vector2(0.5, 0.5) },
    strength: { value: 0 }, color: { value: new THREE.Color(1, 0.95, 0.85) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth; uniform vec2 sunUv; uniform float strength; uniform vec3 color;
    varying vec2 vUv;
    #define N 24
    void main(){
      vec4 src = texture2D(tDiffuse, vUv);
      vec2 dstep = (sunUv - vUv) / float(N) * 0.9;
      float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 uv = vUv + dstep * jitter;
      float lit = 0.0, w = 1.0, wsum = 0.0;
      for (int i = 0; i < N; i++){
        vec2 c = clamp(uv, 0.001, 0.999);
        lit += step(0.99999, texture2D(tDepth, c).x) * w;
        wsum += w; w *= 0.94; uv += dstep;
      }
      lit /= wsum;
      float fall = 1.0 - smoothstep(0.0, 0.85, length((vUv - sunUv) * vec2(1.6, 1.0)));   // strongest near the sun
      // only where the view itself isn't open sky: the rays fall across the arena, the sky keeps its painted look
      float onSky = step(0.99999, texture2D(tDepth, vUv).x);
      gl_FragColor = vec4(src.rgb + color * lit * fall * strength * (1.0 - 0.75 * onSky), src.a);
    }`,
});
shaftPass.enabled = false;
composer.addPass(shaftPass);
export const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.82, 0.55, 0.78);
/* the bloom's own chain starts at half the size it's given: given CSS pixels rather than device pixels, a high-DPI screen
   blurs a quarter of the pixels (the glow is a blur, it looks the same), and a 1x screen keeps the look it was tuned on */
{ const _bloomSize = bloomPass.setSize.bind(bloomPass);
  bloomPass.setSize = (w, h) => { const k = 1 / Math.max(1, renderer.getPixelRatio()); _bloomSize(Math.max(2, Math.round(w * k)), Math.max(2, Math.round(h * k))); }; }
composer.addPass(bloomPass);
/* SCENE GLOW — the bloom and the blade lights are tuned for a dark arena. In a bright one (pale stone, ice, snow) the
   sunlit floor already sits near the bloom threshold, so the bloom hazes the whole view, and a blade's light lifts a
   pale wall or floor right next to it past white into a blown-out halo. setSceneGlow eases both off as the arena
   gets brighter: b 0 (dark, the tuned look) → 1 (bright). The blade core plus its additive glow sits well over the
   raised threshold, so sabers keep their bloom. world/atmosphere.js sets it per arena; the menu stand (ui/showcase.js)
   swaps in its own threshold for its frame and puts this one back. */
export const glow = { b: 0, light: 1 };   // light: multiplier for the blade PointLights (player/model/weapons.js, boss)
export function setSceneGlow(b){
  glow.b = b;
  bloomPass.threshold = 0.78 + 0.16 * b;
  bloomPass.strength = 0.82 - 0.24 * b;
  glow.light = 1 - 0.55 * b;
}
composer.addPass(new OutputPass());

/* COLOUR GRADE — after tone mapping, on the display image: a little more colour and contrast, and a split tone (the
   shadows lean toward the arena's sky fill, the highlights toward its sun) so each world has its own cast. Brightness
   is kept: the tint is normalised to its own luminance. world/atmosphere.js sets it per arena (setGrade); the menu
   stand switches it off for its frame (ui/showcase.js). */
export const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: 1 }, sat: { value: 1.1 }, contrast: { value: 1.08 },
    shadow: { value: new THREE.Color(0.93, 0.97, 1.06) }, high: { value: new THREE.Color(1.05, 1.0, 0.93) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float amount, sat, contrast; uniform vec3 shadow, high;
    varying vec2 vUv;
    const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);
    void main(){
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb;
      float l = dot(c, LUM);
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * contrast + 0.5;
      vec3 tint = mix(shadow, high, smoothstep(0.12, 0.75, l));
      c *= tint / max(dot(tint, LUM), 1e-3);
      gl_FragColor = vec4(mix(src.rgb, clamp(c, 0.0, 1.0), amount), src.a);
    }`,
});
composer.addPass(gradePass);
export const GRADE_DEFAULT = { sat: 1.1, contrast: 1.08, shadow: 0xedf7ff, high: 0xfff4e6 };
export function setGrade(g = GRADE_DEFAULT){
  const u = gradePass.uniforms;
  u.sat.value = g.sat ?? GRADE_DEFAULT.sat; u.contrast.value = g.contrast ?? GRADE_DEFAULT.contrast;
  if (g.shadow instanceof THREE.Color) u.shadow.value.copy(g.shadow); else u.shadow.value.setHex(g.shadow ?? GRADE_DEFAULT.shadow, THREE.LinearSRGBColorSpace);
  if (g.high instanceof THREE.Color) u.high.value.copy(g.high); else u.high.value.setHex(g.high ?? GRADE_DEFAULT.high, THREE.LinearSRGBColorSpace);
}
setGrade();

/* the menu stand draws its own little stage through this same composer: no AO (it would sample the game scene) and
   no arena grade */
let _standAO = false, _standShafts = false;
/* 1 in the arena, 0 on the menu stand (which is already lit bright, so black robes should stay black there) */
export const darkFill = { value: 1 };
export function standPost(on){
  darkFill.value = on ? 0 : 1;
  if (on){ _standAO = aoPass.enabled; _standShafts = shaftPass.enabled; aoPass.enabled = shaftPass.enabled = false; gradePass.uniforms.amount.value = 0; }
  else { aoPass.enabled = _standAO; shaftPass.enabled = _standShafts; gradePass.uniforms.amount.value = 1; }
}

/* ONE SCENE WALK A FRAME — every renderer.render of the scene (the scene pass, the ambient-occlusion pass's own draw)
   walks the whole scene graph again to refresh its matrices, and the scene's onBeforeRender (fx/lights.js) counts its
   lights again. Nothing moves between the passes of one frame, so the main loop's draw refreshes the matrices once and
   the passes after it skip that walk (frameOnce.on: fx/lights.js settles its light count once too). */
export const frameOnce = { on: false, lights: false };
export function drawFrame(){
  scene.updateMatrixWorld();
  scene.matrixWorldAutoUpdate = false;
  frameOnce.on = true; frameOnce.lights = false;
  try { composer.render(); }
  finally { scene.matrixWorldAutoUpdate = true; frameOnce.on = false; }
}

/* SHADER VARIANTS, NOT RE-RESOLVED — one material on both skinned and rigid meshes (a character's cloth on its skinned
   body and on its rigid kit, the ambient-occlusion pass's normal material on everything) needs two programs, and three.js
   re-resolves which one (a costly lookup that makes garbage) every time consecutive draws switch between them.
   1. Opaque draws of one material are sorted skinned-together (three's own order otherwise: material, then depth), so a
      material switches at most once a pass.
   2. An override material (the AO normals, one material for the whole scene) and the sun's shadow-depth material (three
      draws every caster with one) are drawn on skinned meshes through a twin of their own, so neither copy ever
      switches. The shadow material is set up per caster just before its draw (which faces, alpha): the twin takes that
      on each draw. */
renderer.setOpaqueSort((a, b) => {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  if (a.material.id !== b.material.id) return a.material.id - b.material.id;
  const sa = a.object.isSkinnedMesh ? 1 : 0, sb = b.object.isSkinnedMesh ? 1 : 0;
  if (sa !== sb) return sa - sb;
  if (a.z !== b.z) return a.z - b.z;
  return a.id - b.id;
});
const _skinTwins = new WeakMap();
function skinTwin(m){
  let t = _skinTwins.get(m);
  if (!t || t.userData.srcVersion !== m.version){
    if (t) t.dispose();
    t = m.clone(); t.userData.srcVersion = m.version;
    _skinTwins.set(m, t);
  }
  return t;
}
const SHADOW_STATE = ['visible', 'wireframe', 'side', 'alphaMap', 'alphaTest', 'map', 'clipShadows', 'clippingPlanes', 'clipIntersection',
  'displacementMap', 'displacementScale', 'displacementBias', 'wireframeLinewidth', 'linewidth'];
const _rbd = renderer.renderBufferDirect.bind(renderer);
renderer.renderBufferDirect = (cam, sc, geo, mat, obj, group) => {
  if (obj.isSkinnedMesh){
    // (no scene: the shadow map's draw. A material with its own shader hooks isn't copied: clone() would drop them)
    if ((sc ? sc.overrideMaterial === mat : mat.isMeshDepthMaterial) && !Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile')){
      const t = skinTwin(mat);
      if (!sc) for (const k of SHADOW_STATE) t[k] = mat[k];
      mat = t;
    }
  }
  return _rbd(cam, sc, geo, mat, obj, group);
};

export const hemi = new THREE.HemisphereLight(0x8fb0d6, 0x231a16, 0.62);   // dimmer ambient → more contrast & mood
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff2dd, 1.55);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 160;
sun.shadow.radius = 3.5;        // softer, more natural shadow edges
sun.shadow.bias = -0.0004;
scene.add(sun);
// cool rim/back light to separate silhouettes from the gloom — key to an "immersive" 3D look
export const rim = new THREE.DirectionalLight(0x5a7fd8, 0.5);
rim.position.set(-26, 18, -30);
scene.add(rim);

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

/* renderer.compile, but as the game draws: the scene is drawn into the composer's render target, where three.js builds a
   different shader variant (no tone mapping, linear output) than for the screen. Compiling against the screen, as a bare
   renderer.compile does, builds programs the game never uses and leaves the real ones to compile on first draw. */
const _compileFog = new THREE.Fog(0x000000, 1, 2);
/* PARALLEL SHADER COMPILE (the first launch): where the browser can link shader programs off the main thread
   (KHR_parallel_shader_compile: Chrome, Edge and the desktop app on a real GPU), the boot hands the title stage's and the
   fight's programs to the driver all at once and waits for them together, instead of linking one by one on the main
   thread (most of the time behind the loader). Elsewhere it's false, and the warm-ups below link as they always have. */
export const parallelCompile = !!renderer.extensions.get('KHR_parallel_shader_compile');
// compile `sc` for `cam` as a draw into `rt` would (the target decides tone mapping and colour space, so the variants
// match the real draw's), without waiting on the links; resolves when they're all done (or after `ms`, whatever's left
// then just links at its first draw as before)
export function compileAhead(sc, cam, rt, ms = 8000){
  if (!parallelCompile) return Promise.resolve();
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  let p;
  try { p = renderer.compileAsync(sc, cam); } catch(e){ p = Promise.resolve(); }
  finally { renderer.setRenderTarget(prev); }
  return Promise.race([p, new Promise(r => setTimeout(r, ms))]);
}
// the live scene's programs (compileLive below), ahead
export function compileLiveAhead(){
  const fog = scene.fog;
  if (!fog) scene.fog = _compileFog;
  try { scene.onBeforeRender(renderer, scene, camera, composer.readBuffer); return compileAhead(scene, camera, composer.readBuffer); }
  finally { scene.fog = fog; }
}
export function compileLive(){
  const prev = renderer.getRenderTarget(), fog = scene.fog;
  renderer.setRenderTarget(composer.readBuffer);
  // every arena has a linear fog, and fog is part of a program's variant: a warm-up from the title screen (no arena yet,
  // so no fog) would otherwise build programs no fight ever uses, and the first level would build them all again
  if (!fog) scene.fog = _compileFog;
  try {
    scene.onBeforeRender(renderer, scene, camera, composer.readBuffer);   // the light count is settled there (fx/lights.js): compile at it
    renderer.compile(scene, camera);
    // compile only queues the links; a program's first DRAW is what waits on its link and the driver's first-use work.
    // Draw the live scene once here (into the spare buffer) so that wait is paid now, not on the first spark or ring of a fight
    renderer.render(scene, camera);
    // the AO pass's own programs (its depth/normal override, the AO, denoise and blend shaders) would otherwise
    // compile on the first frame it runs: run it once here into the composer's spare buffer
    if (aoPass.enabled) aoPass.render(renderer, composer.writeBuffer, composer.readBuffer);
  } finally { renderer.setRenderTarget(prev); scene.fog = fog; }
}
