// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Ink look for the arenas: the same cel bands + dark ink outline as the heroes and enemies, applied to every static
// arena prop, then BAKED into one mesh per material (plus one outline hull per material) so a whole arena costs a
// couple of dozen draw calls instead of hundreds.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerProp, fadeTex, FADE_W } from './camblock.js';
import { DETAIL } from '../data/depth.js';

export const INK = 0x07060a;   // the model outline colour

let _ramp = null;
// the heroes' toon ramp (player/model/styles.js): three lit bands and a shadow band, hard steps
function ramp(){
  if (_ramp) return _ramp;
  _ramp = new THREE.DataTexture(new Uint8Array([70, 150, 235, 255]), 4, 1, THREE.RedFormat);
  _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter;
  _ramp.needsUpdate = true;
  return _ramp;
}

const toonCache = new Map();
/* a cel-shaded material for an arena surface (cached per colour/side/emissive, shared across rebuilds) */
export function toon(color, o = {}){
  const id = color + '|' + (o.side || 0) + '|' + (o.emissive || 0) + '|' + (o.ei || 0) + '|' + (o.map ? o.map.uuid : '') + (o.decal ? '|d' : '');
  if (toonCache.has(id)) return toonCache.get(id);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp() });
  if (o.side) m.side = o.side;
  if (o.emissive){ m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.map) m.map = o.map;
  // a decal (a far window sitting a few centimetres proud of its wall: world/backdrop.js) keeps its polygon offset
  if (o.decal){ m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; }
  toonCache.set(id, m);
  return m;
}

/* the arena GROUND: the same cel bands, plus two things that stop a 9 m painted tile from reading as wallpaper:
   broad light/dark patches tied to world position (tens of metres across), and, on organic ground (sand, snow,
   grass…, o.mix), a second copy of the tile, turned and rescaled, that takes over in patches so the repeat breaks
   up. Laid-out floors (flagstones, deck plates, boards) keep their grid and only get the patches. */
const groundCache = new Map();
export function toonGround(color, o = {}){
  const id = color + '|' + (o.map ? o.map.uuid : '') + '|' + (o.mix ? 1 : 0) + '|' + (o.macro ?? 0.08);
  if (groundCache.has(id)) return groundCache.get(id);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp() });
  if (o.map) m.map = o.map;
  const macro = (o.macro ?? 0.08).toFixed(3), mix = o.mix && o.map;
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vGWorld;\n' + sh.vertexShader
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vGWorld;
      float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gNoise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
        return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      ` + sh.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 gTex = texture2D(map, vMapUv);
        ${mix ? `
        vec2 gUvB = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.73 + vec2(0.37, 0.71);
        float gSel = smoothstep(0.46, 0.54, gNoise(vGWorld.xz * 0.06 + 3.1));
        gTex = mix(gTex, texture2D(map, gUvB), gSel);` : ''}
        diffuseColor *= gTex;
      #endif
      float gMac = gNoise(vGWorld.xz * 0.025) * 0.65 + gNoise(vGWorld.xz * 0.08 + 7.0) * 0.35;
      diffuseColor.rgb *= 1.0 + (gMac - 0.5) * 2.0 * ${macro};`);
  };
  m.customProgramCacheKey = () => 'toon-ground' + (mix ? 'm' : '') + macro;
  groundCache.set(id, m);
  return m;
}

/* a toon material of its own (not cached): for things the game recolours or flashes per object (barrels) */
export function toonUnique(color, o = {}){
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp() });
  if (o.emissive){ m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  return m;
}

const inkCache = new Map();
/* the outline hull material: back faces pushed out along the normal, drawn in ink. grow (metres): past this distance
   from the lens the outline thickens with it, so a mountain hundreds of metres out keeps a visible line */
export function inkHull(width, grow = 0){
  const k = width.toFixed(3), g = grow.toFixed(1), id = k + '|' + g;
  if (inkCache.has(id)) return inkCache.get(id);
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const push = grow > 0 ? `${k} * max(1.0, distance((modelMatrix * vec4(position, 1.0)).xyz, cameraPosition) / ${g})` : k;
  // the hull is dropped right at the lens: if the camera grazes (or briefly clips into) a prop, the hull's back faces
  // would otherwise fill the view solid black instead of letting you see through
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vInkDepth;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${push};`)
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vInkDepth = -mvPosition.z;');
    sh.fragmentShader = 'varying float vInkDepth;\n' + sh.fragmentShader
      .replace('void main() {', 'void main() {\n  if (vInkDepth < 0.6) discard;');
  };
  m.customProgramCacheKey = () => 'inkhull' + id;
  inkCache.set(id, m);
  return m;
}

/* SEE-THROUGH — a baked prop standing between the lens and the hero turns slightly see-through, whole and in its own
   shape, so the hero (and the fight) stay in view instead of the camera diving in past it. Each merged vertex carries
   its prop's id (aProp); world/camblock.js decides per frame which props are in the way and eases their entry in a
   small fade texture, which the vertex shader reads. The fade itself is a fine screen-door dither (no transparency
   sorting against the merged arena meshes); shadows are drawn with a separate depth material and stay whole. */
export const SEE = {
  tex: { value: fadeTex },
  amt: { value: 0.55 },     // share of a fully faded prop's pixels dropped: 0 = solid, 1 = gone
};
const seeCache = new Map();
/* the see-through variant of a baked arena material (cached per source material, shared across rebuilds).
   shade: a SURFACE (not an outline hull) also takes the arena's form shading (PROP_SHADE below) */
export function seeThrough(src, shade = false){
  const id = src.uuid + (shade ? '|s' : '');
  if (seeCache.has(id)) return seeCache.get(id);
  const m = src.clone();
  const prev = src.onBeforeCompile, key = src.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(src, sh, r);
    sh.uniforms.uSeeTex = SEE.tex; sh.uniforms.uSeeAmt = SEE.amt;
    if (shade){ sh.uniforms.uLamp = SCALE_U.lamp; sh.uniforms.uLit = SCALE_U.lit; }
    sh.vertexShader = `attribute float aProp;\nuniform sampler2D uSeeTex;\nvarying float vSee;\n${shade ? 'varying float vPropK;\nvarying float vPropY;\nattribute vec2 aDet;\nvarying vec2 vDet;\nvarying vec3 vDetW;\nvarying vec3 vDetN;\n' : ''}` + sh.vertexShader
      .replace('#include <project_vertex>', `#include <project_vertex>
  int sid = int(floor(aProp + 0.5));
  vSee = sid < 0 ? 0.0 : texelFetch(uSeeTex, ivec2(sid % ${FADE_W}, sid / ${FADE_W}), 0).r;${shade ? `
  vPropK = fract(sin(float(sid) * 12.9898 + 4.1) * 43758.5453);
  vPropY = (modelMatrix * vec4(transformed, 1.0)).y;
  vDet = aDet; vDetW = (modelMatrix * vec4(transformed, 1.0)).xyz; vDetN = normalize(mat3(modelMatrix) * objectNormal);` : ''}`);
    sh.fragmentShader = `varying float vSee;\nuniform float uSeeAmt;\n${shade ? 'varying float vPropK;\nvarying float vPropY;\nvarying vec2 vDet;\nvarying vec3 vDetW;\nvarying vec3 vDetN;\nuniform vec3 uLamp;\nuniform float uLit;\nfloat vWin = 0.0;\n' : ''}` + sh.fragmentShader
      .replace('void main() {', `void main() {
  if (vSee > 0.0 && vSee * uSeeAmt > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;`);
    if (shade) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb *= (1.0 + (vPropK - 0.5) * ${PROP_SHADE.jitter.toFixed(3)})
    * mix(${PROP_SHADE.foot.toFixed(3)}, 1.0, smoothstep(0.0, ${PROP_SHADE.footH.toFixed(2)}, vPropY))
    * (1.0 + ${PROP_SHADE.crown.toFixed(3)} * smoothstep(${PROP_SHADE.crownY[0].toFixed(1)}, ${PROP_SHADE.crownY[1].toFixed(1)}, vPropY));
${SCALE_GLSL}`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uLamp * vWin;`);
  };
  m.customProgramCacheKey = () => key + '|see' + (shade ? 's' : '');
  seeCache.set(id, m);
  return m;
}

/* FORM SHADING for the baked arena surfaces, so a courtyard of same-coloured blocks doesn't read as one flat mass:
   jitter  each prop's value is nudged by up to ±half this (seeded by its id: the same every run), so neighbouring
           walls, crates and columns separate
   foot    every prop darkens toward the ground (to this share of its colour over footH metres): it sits ON the
           floor instead of floating, even on tiers without ambient occlusion
   crown   tall things lighten a little toward the sky between crownY metres: skylines lift off the walls below */
export const PROP_SHADE = { jitter: 0.16, foot: 0.68, footH: 1.6, crown: 0.1, crownY: [5, 26] };

/* SCALE DETAIL (data/depth.js DETAIL): the big man-made blocks' panel seams, storey courses and, at night, a few lit
   window slots, drawn in world metres on their upright faces. bakeArena marks which props take it (aDet.x: 0 none,
   1 seams, 2 seams and windows at night, 3 windows by day too (dark slots, a few lit after dark: userData.windows); aDet.y: the prop's foot, so courses count up from its base). Seams fade out where a
   panel shrinks to a few pixels, so the far skyline never shimmers. SCALE_U is set per arena (world/atmosphere.js) */
export const SCALE_U = { lamp: { value: new THREE.Color(0xffc070) }, lit: { value: 0 } };
const f3 = v => v.toFixed(3);
const SCALE_GLSL = `
  if (vDet.x > 0.5 && abs(vDetN.y) < 0.35){
    float du = abs(vDetN.x) > abs(vDetN.z) ? vDetW.z : vDetW.x;
    vec2 q = vec2(du, vDetW.y - vDet.y);
    vec2 cs = vec2(${f3(DETAIL.panel)}, ${f3(DETAIL.storey)});
    vec2 cell = q / cs, fc = fract(cell), id = floor(cell);
    vec2 dm = (0.5 - abs(fc - 0.5)) * cs;   // metres to the nearest seam, each way
    vec2 px = max(fwidth(q), vec2(1e-4));
    vec2 ln = 1.0 - smoothstep(vec2(${f3(DETAIL.line)}), vec2(${f3(DETAIL.line)}) + px, dm);
    float fade = 1.0 - smoothstep(0.08, 0.35, max(px.x / cs.x, px.y / cs.y) * 4.0);
    float seam = max(ln.x, ln.y) * fade;
    // each panel's own dice. Not the usual fract(sin(x) * 43758): with the panel's index in world metres x runs into the
    // thousands, where sin() has too few bits left and the result changed from pixel to pixel, so the lit windows
    // of the far city sparkled on and off as the view moved. A sin-free hash of whole numbers holds steady
    vec3 h3 = fract(vec3(id.xyx + vec3(0.0, 0.0, floor(vPropK * 251.0 + 0.5))) * vec3(0.1031, 0.1030, 0.0973));
    h3 += dot(h3, h3.yzx + 33.33);
    float h = fract((h3.x + h3.y) * h3.z);
    diffuseColor.rgb *= (1.0 - seam * ${f3(DETAIL.seam)}) * (1.0 + (h - 0.5) * ${f3(DETAIL.jitter)} * fade);
    if (vDet.x > 1.5 && id.y >= 1.0 && (uLit > 0.0 || vDet.x > 2.5)){   // (3: the outskirts' buildings, windows by day too)
      float h2 = fract(h * 17.31 + 0.13);
      vec2 w = abs(fc - vec2(0.5, 0.55));
      float inWin = (1.0 - smoothstep(0.2, 0.2 + px.x / cs.x, w.x)) * (1.0 - smoothstep(0.13, 0.13 + px.y / cs.y, w.y));
      // far off a window shrinks under a pixel and sparkles on and off as the view moves: there it eases into its
      // average over the panel (its share of the cell, 0.4 × 0.26), so a distant lit tower glows steadily instead
      inWin = mix(inWin, 0.104, smoothstep(0.1, 0.3, max(px.x / cs.x, px.y / cs.y)));
      vWin = step(h2, uLit) * inWin;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.35, inWin * (1.0 - step(h2, uLit)) * 0.6);
    }
  }`;

/* FAR HAZE — the backdrop stands hundreds of metres out, far past where the arena's fog goes solid. Its materials swap
   the scene fog for aerial perspective: from the fog's near distance the haze builds toward `max` over `len` metres
   (an exponential, so near hills tint a little and the far range a lot) but never swallows a silhouette. The colour
   is still the scene fog's, so the mood beats and lightning tint the horizon with everything else. Set per world
   by applyAtmosphere (world/atmosphere.js). */
export const HAZE = { len: { value: 150 }, max: { value: 0.8 } };
const hazeCache = new Map();
export function farHaze(src){
  if (hazeCache.has(src.uuid)) return hazeCache.get(src.uuid);
  const m = src.clone();
  const prev = src.onBeforeCompile, key = src.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(src, sh, r);
    sh.uniforms.uHazeLen = HAZE.len; sh.uniforms.uHazeMax = HAZE.max;
    sh.fragmentShader = 'uniform float uHazeLen;\nuniform float uHazeMax;\n' + sh.fragmentShader
      .replace('#include <fog_fragment>', `#ifdef USE_FOG
  float fogFactor = uHazeMax * (1.0 - exp(-max(vFogDepth - fogNear, 0.0) / uHazeLen));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`);
  };
  m.customProgramCacheKey = () => key + '|haze';
  hazeCache.set(src.uuid, m);
  return m;
}

/* an outline hull for any geometry: position-only, welded so the normals average across corners */
export function hullGeo(geo){
  const c = new THREE.BufferGeometry();
  c.setAttribute('position', geo.attributes.position);
  if (geo.attributes.aProp) c.setAttribute('aProp', geo.attributes.aProp);   // baked: each prop's outline fades with it
  if (geo.index) c.setIndex(geo.index);
  const m = mergeVertices(c, 1e-3);
  m.computeVertexNormals();
  return m;
}

/* give one live (not baked) mesh the Ink look: hazards, barrels, anything the game moves or recolours */
export function inkify(mesh, width = 0.04){
  const hull = new THREE.Mesh(hullGeo(mesh.geometry), inkHull(width));
  hull.castShadow = false; hull.userData.noBake = true;
  mesh.add(hull);
  return mesh;
}

/* BAKE an arena: every MeshStandardMaterial / MeshToonMaterial mesh under `group` is converted to the toon look,
   merged per material, and given one outline hull per material. Unlit glows (MeshBasicMaterial: lava, braziers,
   beacons, the sky), points, lines and anything flagged userData.noBake stay live and untouched.
   width: outline thickness in world units. far: a backdrop (outlines grow with distance, see inkHull). */
export function bakeArena(group, width = 0.045, far = false){
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const baked = [];
  /* static GLOWS (window panes, lamps, beacons, molten channels: plain unlit colour) aren't inked, but a city's worth of
     them is hundreds of draw calls, paid again in the shadow and ambient-occlusion passes. They merge per material
     too, untouched otherwise: same material, same shadows, no outline */
  const glows = new Map();
  const glow = o => {
    const g = new THREE.BufferGeometry(), sg = o.geometry;
    g.setAttribute('position', sg.attributes.position.clone());
    g.setAttribute('normal', sg.attributes.normal.clone());   // the ambient-occlusion pass draws normals
    g.setIndex(sg.index ? sg.index.clone()
      : new THREE.BufferAttribute(Uint32Array.from({ length: sg.attributes.position.count }, (_, i) => i), 1));
    g.applyMatrix4(o.matrixWorld);
    const key = o.material.uuid + (o.castShadow ? 's' : '') + (o.receiveShadow ? 'r' : '');
    if (!glows.has(key)) glows.set(key, { mat: o.material, geos: [], cast: o.castShadow, receive: o.receiveShadow });
    glows.get(key).geos.push(g);
    baked.push(o);
  };
  group.traverse(o => {
    if (!o.isMesh || o.userData.noBake || o.userData.baked) return;
    for (let p = o.parent; p && p !== group; p = p.parent) if (p.userData.noBake) return;
    const src = o.material;
    if (src && src.isMeshBasicMaterial && staticGlow(o, group)){ glow(o); return; }
    if (!src || Array.isArray(src) || !(src.isMeshStandardMaterial || src.isMeshToonMaterial)) return;
    const mat = src.isMeshToonMaterial ? src
      : toon(src.color.getHex(), { side: src.side, emissive: src.emissive && src.emissive.getHex(), ei: src.emissiveIntensity, decal: src.polygonOffset });
    const g = new THREE.BufferGeometry();
    const sg = o.geometry;
    g.setAttribute('position', sg.attributes.position.clone());
    g.setAttribute('normal', sg.attributes.normal.clone());
    if (mat.map && sg.attributes.uv) g.setAttribute('uv', sg.attributes.uv.clone());
    g.setIndex(sg.index ? sg.index.clone()
      : new THREE.BufferAttribute(Uint32Array.from({ length: sg.attributes.position.count }, (_, i) => i), 1));
    g.applyMatrix4(o.matrixWorld);
    g.setAttribute('aProp', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(registerProp(o)), 1));
    g.setAttribute('aDet', detailOf(o, g));
    const key = mat.uuid + (o.castShadow ? 's' : '') + (o.userData.noOutline || src.side === THREE.DoubleSide ? 'n' : '');
    if (!buckets.has(key)) buckets.set(key, { mat, geos: [], shadow: o.castShadow, outline: !key.endsWith('n') });
    buckets.get(key).geos.push(g);
    baked.push(o);
  });
  // lift anything that is NOT being baked out from under a baked parent, then drop the baked meshes
  const bakedSet = new Set(baked);
  for (const o of baked){
    for (const ch of [...o.children]) if (!bakedSet.has(ch)) group.attach(ch);
  }
  for (const o of baked){ if (o.parent) o.parent.remove(o); o.geometry.dispose(); }
  let calls = 0;
  for (const b of buckets.values()){
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, seeThrough(b.mat, true));
    m.castShadow = b.shadow; m.receiveShadow = true;
    m.userData.baked = true;
    group.add(m); calls++;
    if (b.outline && width > 0){
      const hull = new THREE.Mesh(hullGeo(merged), seeThrough(inkHull(width, far ? 40 : 0)));
      hull.userData.baked = true;
      group.add(hull); calls++;
    }
  }
  for (const b of glows.values()){
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.receive;
    m.userData.baked = true;
    group.add(m); calls++;
  }
  return { meshes: baked.length, calls };
}

/* which baked props take the scale detail (SCALE_GLSL): box shapes at least DETAIL.minH tall (walls, towers, pillars,
   hulls). Round things (rocks, trunks, domes), low cover and anything flagged userData.noDetail stay plain */
function detailOf(o, g){
  const n = g.attributes.position.count, a = new Float32Array(n * 2);
  let k = 0, foot = 0;
  if (o.geometry.type === 'BoxGeometry' && !o.userData.noDetail){
    g.computeBoundingBox();
    const b = g.boundingBox, h = b.max.y - b.min.y, w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    if (h >= DETAIL.minH && w >= DETAIL.panel * 0.6){ k = h >= DETAIL.litH && w >= DETAIL.panel * 1.5 ? (o.userData.windows ? 3 : 2) : 1; foot = b.min.y; }
  }
  for (let i = 0; i < n; i++){ a[i * 2] = k; a[i * 2 + 1] = foot; }
  return new THREE.BufferAttribute(a, 2);
}

/* a glow that can merge: opaque plain colour on an ordinary, visible mesh nobody moves or draws specially (anything the
   game animates is flagged userData.noBake, as for the inked props) */
function staticGlow(o, group){
  const m = o.material, g = o.geometry;
  if (m.transparent || m.map || m.alphaMap || m.envMap || m.vertexColors || m.wireframe) return false;
  if (o.isSkinnedMesh || o.isInstancedMesh || o.morphTargetInfluences || o.renderOrder || !o.frustumCulled) return false;
  if (!g.attributes.position || !g.attributes.normal || g.morphAttributes.position) return false;
  for (let p = o; p && p !== group; p = p.parent) if (!p.visible) return false;
  return true;
}
