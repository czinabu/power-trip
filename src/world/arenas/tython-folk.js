// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TEMPLE'S PEOPLE: the Jedi, the younglings and the archivists who live in the hidden temple on Tython (the hub's
// wings, world/arenas/tython.js). They are hero-model figures, the same as the story's cast in a cutscene (game/cast.js:
// a face that blinks, robes on the cloth sim), dressed and placed from data/temple-folk.js. They only walk their rounds,
// talk among themselves and go through their drills: nobody to fight, and nothing solid (you walk through them). Where
// each one is comes from the game clock (G.gt), not from anything they remember, so every screen in a co-op party sees
// them in the same places. A hero figure costs far more to draw than a prop, so a wing keeps to a handful.

import { shared, G } from '../../state.js';
import { heroFigure, stepFigure } from '../../game/cast.js';
import { settleCloth } from '../../player/model/cloth.js';
import { playerPos } from '../../player/helpers.js';
import { groundAt } from '../collision.js';
import { qualityLevel } from '../../engine/quality.js';
import { TEMPLE_FOLK, FOLK_LOOKS } from '../../data/temple-folk.js';
import * as THREE from 'three';
import { slim } from '../../player/model/slim.js';
export { slim };   // (moved to player/model/slim.js: co-op partners slim down too)

let folk = [];   // this wing's people: { F (the live hero figure), cheap (its far figure: frames), p (data/temple-folk.js), near }
// up close a person is the live hero figure; further off, a frozen copy of it takes its place (the far figure, below) and
// the live one's cloth and face stop being worked. Only the nearest few are live at once (NEAR)

function figure(kind, seed){
  const L = FOLK_LOOKS[kind], look = L.looks[seed % L.looks.length];
  const target = heroFigure({ kind: 'hero', as: 'jedi', look: { jedi: look }, saber: !!L.saber && !L.drawn });
  const F = { g: target.group, target, kind: 'hero', own: true, scale: L.scale || 1, walk: null, talk: false, look: null, t: seed * 1.7, gest: 0, turn: 0 };
  target.group.scale.setScalar(F.scale);
  slim(target);
  // a training saber in hand and lit (the drill)
  const hilt = target.saberHand;
  if (hilt && L.drawn){ hilt.visible = true; if (target.blade){ target.blade.blade.visible = target.blade.glow.visible = true; } }
  return F;
}
/* the FAR FIGURE: the person's own hero figure, posed and then frozen. Every visible piece of it is folded into one mesh
   per kind of surface (in vertex colours), its outlines into one more, a lit blade into another: half a dozen draws
   where the live figure is a hundred, in the same shape and shading, so the swap between the two (NEAR) is hard to see. Whoever moves gets a few frames of it
   (FRAMES: a stride, a drill), flicked through in step with where the live figure's limbs would be */
const FRAMES = { walk: 8, drill: 8 };
/* the far figure's surfaces: one material for each way the hero model shades a surface (cloth, leather, skin, metal:
   player/model/styles.js inkSurface, its rim light and dark fill), white, coloured by the vertices instead. Shared by
   everyone in the temple */
const foldMats = new Map();
function foldMat(src){
  const key = (src.customProgramCacheKey ? src.customProgramCacheKey() : 'toon') + '|' + (src.gradientMap ? src.gradientMap.uuid : '');
  let m = foldMats.get(key);
  if (!m){
    m = src.clone(); m.color.set(0xffffff); m.vertexColors = true; m.emissive?.set(0); m.map = null;
    m.onBeforeCompile = src.onBeforeCompile; m.customProgramCacheKey = src.customProgramCacheKey;
    foldMats.set(key, m);
  }
  return m;
}
/* FOLD as it goes, down to what can be seen from across a hall: every point snaps to a grid of FAR_CELL metres (less
   than a pixel from where the far figure takes over), the points sharing a cell (and a colour, and a side) become one,
   and the triangles that shrink to nothing go. The live figure is some forty thousand triangles; this keeps about half */
const FAR_CELL = { body: 0.045, low: 0.06, ink: 0.08 };   // (metres: the low tier, a phone's, folds the body coarser)
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _b = new THREE.Matrix4(), _bi = new THREE.Matrix4();
// a growing run of numbers, without a JS array's boxing
const run = (T = Float32Array) => ({ a: new T(4096), n: 0 });
const room = (R, k) => { if (R.n + k > R.a.length){ const b = new R.a.constructor(Math.max(R.a.length * 2, R.n + k)); b.set(R.a); R.a = b; } };
const bucket = (cell, colour) => ({ cell, key: new Map(), tones: new Map(), pos: run(), nor: run(), cnt: run(), col: colour ? run() : null, idx: run(Uint32Array), m: 0 });
let _map = new Int32Array(4096);
function* snapshot(F){
  const g = F.g, shown = g.visible;
  g.visible = true; g.updateWorldMatrix(true, true);
  const pieces = []; g.traverseVisible(o => { if (o.isMesh) pieces.push(o); });
  g.visible = shown;
  _inv.copy(g.matrixWorld).invert();
  const cellB = qualityLevel() === 'low' ? FAR_CELL.low : FAR_CELL.body;
  const body = new Map(), other = new Map();   // (body: by the kind of surface, in vertex colours; other: the outlines and the glow, each on its own material)
  const M = new Float32Array(16);
  for (const o of pieces){
    const P = o.isMesh && o.geometry.attributes.position, mat = o.material;
    if (!P || Array.isArray(mat) || mat.visible === false || P.isInterleavedBufferAttribute) continue;
    const fold = mat.isMeshToonMaterial && !mat.transparent ? foldMat(mat) : null;
    const B = fold ? (body.get(fold) || body.set(fold, bucket(cellB, true)).get(fold)) : (other.get(mat) || other.set(mat, bucket(FAR_CELL.ink, false)).get(mat));
    _m.multiplyMatrices(_inv, o.matrixWorld);
    // a skinned piece: each bone's whole matrix into the figure's space, so a point is the weighted sum of a few of them
    let bones = null, si = null, sw = null;
    if (o.isSkinnedMesh && o.skeleton){
      const sk = o.skeleton; bones = new Float32Array(sk.bones.length * 16);
      si = o.geometry.attributes.skinIndex.array; sw = o.geometry.attributes.skinWeight.array;
      // (bound 'attached', the usual way, the bind's inverse is the piece's own world matrix, refreshed only as three.js
      // draws it: worked out here instead, or a figure just moved into place would fold as if still where it was built)
      const into = o.bindMode === 'attached' ? _inv : _bi.multiplyMatrices(_m, o.bindMatrixInverse);
      for (let k = 0; k < sk.bones.length; k++){
        _b.multiplyMatrices(sk.bones[k].matrixWorld, sk.boneInverses[k]).multiply(o.bindMatrix).premultiply(into);
        bones.set(_b.elements, k * 16);
      }
    } else M.set(_m.elements);
    const N = o.geometry.attributes.normal, pa = P.array, na = N && !N.isInterleavedBufferAttribute ? N.array : null, nv = P.count;
    const cell = B.cell, tone = fold ? (() => { const c = mat.color, h = c.getHex(); let t = B.tones.get(h); if (t === undefined){ t = B.tones.size; B.tones.set(h, t); } return t; })() : 0;
    if (_map.length < nv) _map = new Int32Array(nv * 2);
    room(B.pos, nv * 3); room(B.nor, nv * 3); room(B.cnt, nv); if (B.col) room(B.col, nv * 3);
    // each point of the piece once: where it lands, and which cell (which folded point) it joins
    for (let j = 0; j < nv; j++){
      const x = pa[j * 3], y = pa[j * 3 + 1], z = pa[j * 3 + 2];
      const nx = na ? na[j * 3] : 0, ny = na ? na[j * 3 + 1] : 1, nz = na ? na[j * 3 + 2] : 0;
      if (bones){   // (blend the bones' matrices for this point)
        M.fill(0);
        for (let w = 0; w < 4; w++){
          const wt = sw[j * 4 + w]; if (!wt) continue;
          const o16 = si[j * 4 + w] * 16;
          for (let q = 0; q < 16; q++) M[q] += bones[o16 + q] * wt;
        }
      }
      const e = M;
      const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
      let mx = e[0] * nx + e[4] * ny + e[8] * nz, my = e[1] * nx + e[5] * ny + e[9] * nz, mz = e[2] * nx + e[6] * ny + e[10] * nz;
      const l = Math.hypot(mx, my, mz) || 1; mx /= l; my /= l; mz /= l;
      // the cell, roughly which way the point faces (the two sides of a thin robe share cells, and mustn't share a
      // normal) and its colour, as one number
      const k = ((((Math.round(X / cell) + 256) * 512 + (Math.round(Y / cell) + 256)) * 512 + (Math.round(Z / cell) + 256)) * 125
            + (Math.round(mx * 1.4) + 2) + (Math.round(my * 1.4) + 2) * 5 + (Math.round(mz * 1.4) + 2) * 25) * 256 + tone;
      let v = B.key.get(k);
      if (v === undefined){
        v = B.m++; B.key.set(k, v);
        B.pos.a[v * 3] = B.pos.a[v * 3 + 1] = B.pos.a[v * 3 + 2] = 0; B.nor.a[v * 3] = B.nor.a[v * 3 + 1] = B.nor.a[v * 3 + 2] = 0; B.cnt.a[v] = 0;
        if (B.col){ const c = mat.color; B.col.a[v * 3] = c.r; B.col.a[v * 3 + 1] = c.g; B.col.a[v * 3 + 2] = c.b; }
      }
      B.cnt.a[v]++; B.pos.a[v * 3] += X; B.pos.a[v * 3 + 1] += Y; B.pos.a[v * 3 + 2] += Z;
      B.nor.a[v * 3] += mx; B.nor.a[v * 3 + 1] += my; B.nor.a[v * 3 + 2] += mz;
      _map[j] = v;
    }
    B.pos.n = B.nor.n = B.m * 3; B.cnt.n = B.m; if (B.col) B.col.n = B.m * 3;
    // its triangles, onto the folded points (a mirrored piece, the left of a pair, turned round: three.js turns its
    // faces when it draws it, so the fold must too), less those that fold to nothing
    const ix = o.geometry.index ? o.geometry.index.array : null, nt = ix ? ix.length : nv, flip = _m.determinant() < 0;
    room(B.idx, nt);
    const out = B.idx.a;
    for (let i = 0; i < nt; i += 3){
      const a = _map[ix ? ix[i] : i], b = _map[ix ? ix[i + 1] : i + 1], c = _map[ix ? ix[i + 2] : i + 2];
      if (a === b || b === c || a === c) continue;
      out[B.idx.n++] = a; out[B.idx.n++] = flip ? c : b; out[B.idx.n++] = flip ? b : c;
    }
    yield;   // (a piece at a time: stepTempleFolk spreads a frame's baking over a few frames)
  }
  const frame = new THREE.Group();
  const mesh = (B, mat) => {
    const m = B.m, pos = B.pos.a.slice(0, m * 3), nor = B.nor.a.slice(0, m * 3), cnt = B.cnt.a;
    for (let v = 0; v < m; v++){
      pos[v * 3] /= cnt[v]; pos[v * 3 + 1] /= cnt[v]; pos[v * 3 + 2] /= cnt[v];
      const l = Math.hypot(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]) || 1;
      nor[v * 3] /= l; nor[v * 3 + 1] /= l; nor[v * 3 + 2] /= l;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (B.col) geo.setAttribute('color', new THREE.BufferAttribute(B.col.a.slice(0, m * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(m > 65535 ? B.idx.a.slice(0, B.idx.n) : Uint16Array.from(B.idx.a.subarray(0, B.idx.n)), 1));
    geo.computeBoundingSphere();
    const Me = new THREE.Mesh(geo, mat); Me.castShadow = Me.receiveShadow = false; Me.matrixAutoUpdate = false;
    Me.userData.noBake = true; Me.userData.passThrough = true;
    frame.add(Me);
  };
  for (const [m, B] of [...body, ...other]) if (B.idx.n){ mesh(B, m); yield; }
  frame.userData.noBake = true; frame.userData.passThrough = true;
  return frame;
}
/* pose the figure the way frame i of its far figure shows it */
function poseFrame(f, i){
  const { F, p } = f;
  if (p.loop){ F.walking = true; F.stride = 1; F.ph = i / f.frames.length * PI2 - 1 / 60 * 5.6; stepFigure(F, 1 / 60); }
  else stepFigure(F, 0);
  if (p.drill) drill(F, (i / f.frames.length * PI2 - (p.phase || 0)) / p.drill, p.drill, p.phase || 0);
  if (p.kneel) kneel(F);
  F.target.vis.updateWorldMatrix(true, true);
  settleCloth(F.target, p.loop || p.drill ? 0.25 : 0.6);
}
function* bakeFrame(f, i){
  poseFrame(f, i);
  yield;
  const fr = yield* snapshot(f.F);
  fr.visible = false;
  if (f.frames[i]){ f.cheap.remove(f.frames[i]); for (const M of f.frames[i].children) M.geometry.dispose(); }
  f.frames[i] = fr; f.cheap.add(fr); f.shown = -1;
}
const drain = (it) => { while (!it.next().done); };
const PI2 = Math.PI * 2;
const frameOf = (f, t) => {   // which frame of the far figure: where in its stride or its drill they are now
  const n = f.frames.length;
  if (n < 2) return 0;
  const k = f.p.loop ? walkPhase(f, t) : t * f.p.drill + (f.p.phase || 0);
  return Math.round((((k % PI2) + PI2) % PI2) / PI2 * n) % n;
};
const walkPhase = (f, t) => t * 5.6 + f.seed * 1.3;   // (the stride's phase: game/cast.js steps F.ph at 5.6 a second)
function put(F, x, z, yaw){
  F.g.position.set(x, 0, z); F.g.rotation.y = yaw;
  F.g.traverse(o => { o.userData.noBake = true; o.userData.passThrough = true; });
  shared.arenaGroup.add(F.g);
}

// a closed loop of points, walked at `speed` m/s, `lead` metres along it: where on it at time t, and which way it heads
function onLoop(pts, speed, lead, t){
  let L = 0; const seg = [];
  for (let i = 0; i < pts.length; i++){ const a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push([a, b, d, L]); L += d; }
  const d = ((t * speed + lead) % L + L) % L, s = seg.find(q => d >= q[3] && d < q[3] + q[2]) || seg[0], k = (d - s[3]) / (s[2] || 1);
  return [s[0][0] + (s[1][0] - s[0][0]) * k, s[0][1] + (s[1][1] - s[0][1]) * k, Math.atan2(s[1][0] - s[0][0], s[1][1] - s[0][1])];
}

/* build a wing's people (world/arenas/tython.js, inside the wing's build: they go with the arena when it's cleared).
   Each far figure starts as one frame; the rest of a mover's frames are baked a few a frame after (stepTempleFolk) */
export function templeFolk(wing){
  folk = []; bakeQueue = []; baking = null;
  let n = 0;
  for (const p of TEMPLE_FOLK[wing] || []){
    const seed = p.seed ?? n++, F = figure(p.kind, seed);
    const at = p.loop ? onLoop(p.loop, p.speed, p.lead || 0, G.gt || 0) : [p.x, p.z, p.face || 0];
    if (p.toward) at[2] = Math.atan2(p.toward[0] - at[0], p.toward[1] - at[1]);
    put(F, at[0], at[1], at[2]);
    if (p.toward) F.look = { x: p.toward[0], z: p.toward[1] };
    const cheap = new THREE.Group();
    cheap.position.set(at[0], groundAt(at[0], at[1], 3), at[1]); cheap.rotation.y = at[2]; cheap.scale.setScalar(F.scale);
    cheap.userData.noBake = true; cheap.userData.passThrough = true;
    shared.arenaGroup.add(cheap);
    const f = { F, cheap, p, seed, near: false, frames: new Array(p.loop ? FRAMES.walk : p.drill ? FRAMES.drill : 1).fill(null), shown: -1 };
    drain(bakeFrame(f, 0));
    F.g.visible = false;
    for (let i = 1; i < f.frames.length; i++) bakeQueue.push([f, i]);
    folk.push(f);
  }
}
let bakeQueue = [], baking = null;
const BAKE_MS = { low: 2, medium: 3, high: 4 };   // (a frame's time spent baking far figures, by quality tier)

/* how many are the live figure at once, and from how far: fewer on the low tier (engine/quality.js), which phones sit on */
export const NEAR = { low: { dist: 22, max: 3 }, medium: { dist: 26, max: 4 }, high: { dist: 30, max: 4 }, keep: 3 };

/* once a frame in the temple (game/hub.js updateHub) */
export function stepTempleFolk(dt){
  if (!folk.length) return;
  if (!folk[0].F.g.parent){ folk = []; bakeQueue = []; baking = null; return; }   // (the wing was cleared away)
  const t = G.gt, me = playerPos(), N = NEAR[qualityLevel()] || NEAR.low;
  // the rest of the far figures' frames, baked a few milliseconds a frame (BAKE_MS), a piece of the figure at a time. A
  // frame is never baked for someone who is the live figure: baking poses them, so whoever comes near goes to the back
  const until = performance.now() + (BAKE_MS[qualityLevel()] ?? 2);
  while (performance.now() < until){
    if (!baking){
      const k = bakeQueue.findIndex(([f]) => !f.near);
      if (k < 0) break;
      const [job] = bakeQueue.splice(k, 1);
      baking = { job, it: bakeFrame(job[0], job[1]) };
    }
    if (baking.job[0].near){ bakeQueue.push(baking.job); baking = null; continue; }
    if (baking.it.next().done) baking = null;
  }
  // who is near enough to be the live figure: the nearest few inside N.dist. Whoever is one already counts as NEAR.keep
  // metres nearer, so someone at the edge doesn't flick back and forth
  const d = folk.map(f => Math.hypot(f.cheap.position.x - me.x, f.cheap.position.z - me.z) - (f.near ? NEAR.keep : 0));
  const order = folk.map((_, i) => i).filter(i => d[i] < N.dist).sort((a, b) => d[a] - d[b]).slice(0, N.max);
  folk.forEach((f, i) => {
    const near = order.includes(i);
    if (near !== f.near){
      f.near = near; f.F.g.visible = near; f.cheap.visible = !near;
      if (near){   // (taking up the pose the far figure showed: the same place, the same point in the stride)
        const F = f.F;
        F.g.position.copy(f.cheap.position); F.g.rotation.y = f.cheap.rotation.y;
        if (f.p.loop){ F.walking = true; F.stride = 1; F.ph = walkPhase(f, t); }
        F.target.vis.position.y = 0;
        stepFigure(F, 0);
        if (f.p.drill) drill(F, t, f.p.drill, f.p.phase || 0);
        if (f.p.kneel) kneel(F);
        F.target.vis.updateWorldMatrix(true, true); settleCloth(F.target, 0.4);
      }
    }
  });
  for (const f of folk){
    const { F, p, cheap } = f;
    if (p.loop){
      const [x, z, yaw] = onLoop(p.loop, p.speed, p.lead || 0, t);
      cheap.position.x = x; cheap.position.z = z;
      // (turning a corner: the body comes round over a moment, not in one jump)
      cheap.rotation.y += Math.atan2(Math.sin(yaw - cheap.rotation.y), Math.cos(yaw - cheap.rotation.y)) * Math.min(1, dt * 6);
      cheap.position.y = groundAt(x, z, 3);
      F.walking = true;
    }
    if (!f.near){   // (the far figure is all that's seen: the live one rests)
      const i = f.frames[frameOf(f, t)] ? frameOf(f, t) : 0;
      if (i !== f.shown){ f.frames.forEach((fr, j) => { if (fr) fr.visible = j === i; }); f.shown = i; }
      continue;
    }
    F.g.position.x = cheap.position.x; F.g.position.z = cheap.position.z; F.g.position.y = cheap.position.y; F.g.rotation.y = cheap.rotation.y;
    // a pair in conversation takes turns: each talks for a few seconds, then listens
    if (p.talk != null) F.talk = Math.floor(t / 4.5 + p.talk) % 2 === 0;
    stepFigure(F, dt);
    if (p.drill) drill(F, t, p.drill, p.phase || 0);
    if (p.kneel) kneel(F);
  }
}

/* the drill: the saber arm comes up into a guard, cuts down and across, back to guard, on the master's count */
function drill(F, t, rate, phase){
  const R = F.target.rig, k = t * rate + phase, cut = Math.sin(k), across = Math.cos(k);
  R.armR.sh.rotation.set(-1.05 - cut * 0.55, -0.25 + across * 0.3, -0.35);
  R.armR.el.rotation.set(-0.55 + cut * 0.35, 0, 0);
  R.armL.sh.rotation.set(-0.7 - cut * 0.4, 0.3, 0.35);
  R.armL.el.rotation.set(-0.9, 0, 0);
  R.torso.rotation.y = across * 0.18;
}
/* kneeling in meditation: legs folded under, hands on the knees, the head a little bowed */
function kneel(F){
  const R = F.target.rig;
  R.legL.hip.rotation.set(-1.45, 0, -0.12); R.legL.knee.rotation.set(2.4, 0, 0);
  R.legR.hip.rotation.set(-1.45, 0, 0.12); R.legR.knee.rotation.set(2.4, 0, 0);
  R.armL.sh.rotation.set(-0.55, 0, 0.2); R.armL.el.rotation.set(-0.7, 0, 0);
  R.armR.sh.rotation.set(-0.55, 0, -0.2); R.armR.el.rotation.set(-0.7, 0, 0);
  R.head.rotation.x = 0.25;
  F.target.vis.position.y = -0.55;   // (down onto the knees)
}
