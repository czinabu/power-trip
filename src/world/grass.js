// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TALL GRASS: patches of waist-high grass that lean and ripple in the wind, so an open plain reads as a sea of grass
// instead of a painted floor. A world lists it in `grass` (data/worlds.js); a world without one has none.
//
//   grass: { root, tip, dry,           colours: the blade's foot, its tip, and the golden tint some patches take
//            height: [lo, hi],         tuft height in metres (the hero is ~2.7 m tall), patchy between the two
//            cover: 0..1,              how much of the ground is grass (patches, not an even carpet)
//            density,                  tufts per square metre inside a patch (scaled down on lower graphics tiers)
//            reach: 1.5,               how far past the playable edge it runs (× half the arena), taller out there
//            wind: angle, sway, speed, sheen }   the wind: its heading (radians), how far blades bend, the gust speed,
//                                                 and how much a passing gust brightens the blades (the ripple)
//
// Purely visual: nothing collides, nothing hides a foe from the AI. Grass never grows through a solid, on a crater
// or inside an arena's `shared.grassClear` rectangles (a landing pad, a base's yard). Mounds an arena registers in
// `shared.grassMounds` lift the grass onto them. The hero parts the blades as they walk.
//
// Cost: one instanced mesh per 50 m chunk (frustum culled, so ~6-12 draw calls in view), no shadow casting and out of
// the ambient-occlusion pass. Every sway is in the vertex shader: the CPU does nothing per frame but bump a clock.

import * as THREE from 'three';
import { shared, solids, hazardZones, player } from '../state.js';
import { toonUnique } from './ink.js';
import { qualityLevel } from '../engine/quality.js';

const S = { on: false, uni: null };

function hash(x, z){ const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z){
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/* one tuft: a handful of tapered blades fanned round the root, each a strip of three rows so it can bend. Every
   normal points up, so a tuft takes the same light as the ground it grows from. aH: 0 at the root, 1 at the tip. */
function tuftGeo(blades, seed){
  const pos = [], h = [], col = [], idx = [];
  let r = seed;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let b = 0; b < blades; b++){
    const a = (b / blades) * Math.PI * 2 + rnd() * 0.8, lean = 0.1 + rnd() * 0.3, tall = 0.6 + rnd() * 0.4, w = 0.03 + rnd() * 0.025;
    const sp = 0.06 + rnd() * 0.2, ox = Math.cos(a) * sp, oz = Math.sin(a) * sp, lx = Math.cos(a) * lean, lz = Math.sin(a) * lean;
    const px = -Math.sin(a), pz = Math.cos(a);   // the blade's width runs across its lean
    const base = pos.length / 3;
    for (const [t, ww] of [[0, 1], [0.5, 0.7], [1, 0]]){
      const y = t * tall, bend = t * t;
      for (const s of ww ? [-1, 1] : [0]){
        pos.push(ox + lx * bend + px * w * ww * s, y, oz + lz * bend + pz * w * ww * s);
        h.push(t);
        col.push(1, 1, 1);
      }
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(h, 1));
  g.setIndex(idx);
  return g;
}

function grassMaterial(o){
  const m = toonUnique(0xffffff);
  m.vertexColors = true; m.side = THREE.DoubleSide;
  const a = o.wind ?? 0.6;
  S.uni = {
    uTime: { value: 0 }, uWind: { value: new THREE.Vector2(Math.cos(a), Math.sin(a)) },
    uSway: { value: o.sway ?? 0.55 }, uSpeed: { value: o.speed ?? 1 }, uSheen: { value: o.sheen ?? 0.35 },
    uHero: { value: new THREE.Vector3(0, -99, 0) }, uRoot: { value: new THREE.Color(o.root ?? 0x4a5a24) },
  };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, S.uni);
    sh.vertexShader = `attribute float aH;
      uniform float uTime, uSway, uSpeed; uniform vec2 uWind; uniform vec3 uHero;
      varying float vGust, vH;
      ` + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      {
        // (the chunk's model matrix is the identity, so this is the world position)
        float along = dot(mvPosition.xz, uWind), t = uTime * uSpeed, hh = aH * aH;
        float gust = sin(along * 0.05 - t * 0.9) * 0.5 + 0.5;            // broad gusts rolling across the plain
        gust = gust * gust * (3.0 - 2.0 * gust);
        float ripple = sin(along * 0.23 - t * 2.6 + sin(dot(mvPosition.xz, vec2(-uWind.y, uWind.x)) * 0.11) * 1.4);   // the waves inside them
        float flutter = sin(t * 6.3 + mvPosition.x * 1.9 + mvPosition.z * 1.3) * 0.12;
        float bend = (0.25 + 0.75 * gust) * (0.75 + 0.25 * ripple) + flutter;
        vec2 push = uWind * bend * uSway;
        vec2 away = mvPosition.xz - uHero.xz; float d = length(away);   // the hero parts the grass
        push += (d > 0.01 ? away / d : vec2(0.0)) * smoothstep(1.8, 0.4, d) * 0.9;
        mvPosition.xz += push * hh;
        mvPosition.y -= dot(push, push) * hh * 0.35;
        vGust = gust * (0.6 + 0.4 * ripple) * aH; vH = aH;
      }
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
    // root to tip: the blade's foot takes the root colour, its tip the tuft's own; every blade lit as if facing up
    // (a double-sided blade would otherwise go black on its back face), so the grass takes the ground's light
    sh.fragmentShader = 'uniform float uSheen; uniform vec3 uRoot;\nvarying float vGust, vH;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(uRoot, diffuseColor.rgb, smoothstep(0.0, 0.8, vH)) * (1.0 + vGust * uSheen);')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));');
  };
  m.customProgramCacheKey = () => 'tall-grass';
  return m;
}

export function clearGrass(){ S.on = false; }

/* grow the grass for a world (after the arena's solids are in, so it can keep clear of them) */
export function buildGrass(T, L){
  S.on = false;
  const o = T && T.grass;
  if (!o) return;
  const half = shared.arenaHalf, halfZ = shared.arenaHalfZ, reach = o.reach ?? 1.5;
  const q = qualityLevel(), coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const dens = (o.density ?? 0.5) * (q === 'low' ? 0.4 : q === 'medium' ? 0.7 : 1) * (coarse ? 0.6 : 1);
  const [hLo, hHi] = o.height || [0.7, 1.4];
  const cover = o.cover ?? 0.45;
  // a 1 m grid of where grass can't grow: solids (plus a hand's width), craters, the arena's clear zones
  const R = Math.ceil(half * reach), Rz = Math.ceil(halfZ * reach), W = R * 2, D = Rz * 2;
  const blocked = new Uint8Array(W * D);
  const mark = (x0, z0, x1, z1) => {
    for (let z = Math.max(0, Math.floor(z0 + Rz)); z <= Math.min(D - 1, Math.floor(z1 + Rz)); z++)
      for (let x = Math.max(0, Math.floor(x0 + R)); x <= Math.min(W - 1, Math.floor(x1 + R)); x++) blocked[z * W + x] = 1;
  };
  for (const s of solids){
    if (s.y0 > 0.5) continue;   // an overhead slab: grass grows under it
    if (s.box) mark(s.x - s.hx - 0.3, s.z - s.hz - 0.3, s.x + s.hx + 0.3, s.z + s.hz + 0.3);
    else mark(s.x - s.r - 0.3, s.z - s.r - 0.3, s.x + s.r + 0.3, s.z + s.r + 0.3);
  }
  for (const h of hazardZones) if (h.kind === 'point') mark(h.cx - h.r - 1, h.cz - h.r - 1, h.cx + h.r + 1, h.cz + h.r + 1);
  for (const [x0, z0, x1, z1] of shared.grassClear || []) mark(x0, z0, x1, z1);
  const mounds = shared.grassMounds || [];
  const groundAt = (x, z) => {   // the top of any mound under (x, z): a flattened dome
    let y = 0;
    for (const m of mounds){
      const dx = (x - m.x) / m.rx, dz = (z - m.z) / m.rz, d2 = dx * dx + dz * dz;
      if (d2 < 1) y = Math.max(y, m.h * Math.sqrt(1 - d2));
    }
    return y;
  };

  const geos = [tuftGeo(9, 9), tuftGeo(7, 77)];
  const mat = grassMaterial(o);
  const tip = new THREE.Color(o.tip ?? 0xb8b860), dry = new THREE.Color(o.dry ?? 0xc8a85a);
  const CH = 50, chunks = new Map();
  const step = 1 / Math.sqrt(Math.max(dens, 0.01));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
  for (let z = -Rz; z < Rz; z += step){
    for (let x = -R; x < R; x += step){
      const jx = x + (hash(x, z) - 0.5) * step, jz = z + (hash(z + 3.1, x) - 0.5) * step;
      const out = Math.max(Math.abs(jx) / half, Math.abs(jz) / halfZ);   // 1 at the playable edge
      if (out > reach) continue;
      // patches: two scales of noise, a little more cover past the edge so the horizon reads as a sea of grass
      const n = noise(jx * 0.045, jz * 0.045) * 0.65 + noise(jx * 0.13 + 5, jz * 0.13 + 2) * 0.35;
      const edge = out > 1 ? Math.min(1, (out - 1) * 3) * 0.2 : 0;
      const keep = n - (1 - cover - edge);
      if (keep < 0) continue;
      const gx = Math.floor(jx + R), gz = Math.floor(jz + Rz);
      if (gx < 0 || gz < 0 || gx >= W || gz >= D || blocked[gz * W + gx]) continue;
      // inside a patch the grass is tallest at its heart, short at its rim; taller still past the edge
      const core = Math.min(1, keep * 6), r1 = hash(jx * 1.7, jz * 2.3);
      const hgt = (hLo + (hHi - hLo) * core * (0.7 + 0.3 * r1)) * (out > 1 ? 1 + Math.min(0.5, (out - 1) * 1.2) : 1);
      const key = Math.floor(jx / CH) + ',' + Math.floor(jz / CH);
      if (!chunks.has(key)) chunks.set(key, [[], []]);
      _p.set(jx, groundAt(jx, jz) - 0.03, jz);
      _q.setFromAxisAngle(_y, r1 * Math.PI * 2);
      const wide = 0.9 + hash(jz, jx * 0.7) * 0.6;
      _s.set(wide, hgt, wide);
      _m.compose(_p, _q, _s);
      // colour: green to gold by a slow noise, a little brighter at the rim of a patch
      const dryK = Math.max(0, Math.min(1, noise(jx * 0.02 + 11, jz * 0.02 - 4) * 1.6 - 0.45));
      _c.copy(tip).lerp(dry, dryK).multiplyScalar(0.92 + 0.16 * r1);
      chunks.get(key)[r1 < 0.5 ? 0 : 1].push(_m.clone(), _c.clone());
    }
  }
  const grp = new THREE.Group(); grp.userData.noBake = true;
  let count = 0;
  for (const lists of chunks.values()){
    lists.forEach((list, gi) => {
      const n = list.length / 2;
      if (!n) return;
      const im = new THREE.InstancedMesh(geos[gi], mat, n);
      for (let i = 0; i < n; i++){ im.setMatrixAt(i, list[i * 2]); im.setColorAt(i, list[i * 2 + 1]); }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = false; im.receiveShadow = q !== 'low';
      im.userData.noBake = true; im.userData.noAO = true; im.userData.passThrough = true;   // (the collision audit skips it: grass is walked through)
      grp.add(im); count += n;
    });
  }
  shared.arenaGroup.add(grp);
  S.on = true; S.count = count; S.calls = grp.children.length;
}

export function updateGrass(dt){
  if (!S.on || !S.uni) return;
  S.uni.uTime.value += dt;
  const p = player.group && player.group.position;
  if (p) S.uni.uHero.value.copy(p);
}

/* for the smoke tests and the console */
export function grassInfo(){ return S.on ? { tufts: S.count, calls: S.calls } : null; }
