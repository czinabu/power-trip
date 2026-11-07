// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIFE PAST THE EDGE: speeders and haulers on the skylanes over a city's outskirts, birds wheeling over a forest or a
// canyon (what each map gets, and why, is data/life.js). Purely visual: no collision, nothing the hero can reach, all of
// it past the edge of the play space or high over it. Cost: one instanced mesh per kind of thing (speeders, haulers,
// their running lights, birds), so a map pays 2-4 draw calls for it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand } from '../utils.js';
import { shared } from '../state.js';
import { camera } from '../engine/renderer.js';
import { LIFE } from '../data/life.js';
import { WORLD } from '../data/worlds.js';
import { farHaze } from './ink.js';
import { part } from './warfront.js';
import { OUTSKIRTS } from '../data/outskirts.js';
import { LANDMARKS } from '../data/landmarks.js';

const PI = Math.PI;
const S = { on: false };

/* ---------- shapes (nose along +z, ~1.5× life size like everything else) ---------- */
let speederGeo = null, haulerGeo = null, birdGeo = null;
function speeder(){   // an airspeeder: a long slim body, a canopy, two engine pods
  if (speederGeo) return speederGeo;
  const L = [];
  part(L, new THREE.BoxGeometry(2.2, 1.1, 7), 0xffffff, 0, 0, 0);
  part(L, new THREE.ConeGeometry(1.1, 2.6, 4), 0xffffff, 0, 0, 4.7, PI/2, 0, PI/4, 1, 1, 0.5);
  part(L, new THREE.BoxGeometry(1.5, 0.7, 2.2), 0x404850, 0, 0.8, 1.2);
  for (const s of [-1, 1]) part(L, new THREE.CylinderGeometry(0.6, 0.6, 4, 8), 0xb0b0b0, s*1.7, -0.1, -1.6, PI/2, 0, 0);
  return (speederGeo = mergeGeometries(L, false));
}
function hauler(){   // a cargo hauler: a boxy hold slung under a cab, engines either side
  if (haulerGeo) return haulerGeo;
  const L = [];
  part(L, new THREE.BoxGeometry(6, 4.4, 16), 0xffffff, 0, 0, 0);
  part(L, new THREE.BoxGeometry(4.6, 2.6, 4), 0xc8c8c8, 0, 1.6, 9.6);
  part(L, new THREE.BoxGeometry(6.4, 0.6, 16.4), 0x8a8a8a, 0, 2.5, 0);
  for (const s of [-1, 1]) part(L, new THREE.CylinderGeometry(1.2, 1.4, 6, 8), 0x9a9a9a, s*4, 0.4, -5, PI/2, 0, 0);
  return (haulerGeo = mergeGeometries(L, false));
}
function bird(){   // two wings in a shallow V, tips at y=1 so scaling y beats them (wingspan 1 m, scaled per map)
  if (birdGeo) return birdGeo;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.18,  0, 0, -0.14,  -0.5, 0.25, -0.04,
    0, 0, -0.14,  0, 0, 0.18,  0.5, 0.25, -0.04,
  ], 3));
  g.computeVertexNormals();
  return (birdGeo = g);
}

/* ---------- lanes ---------- */
// a point on a square loop of half-size r round the middle, u in [0, 1) along its perimeter; writes the heading too
function onSquare(r, u, out){
  const side = Math.floor(u * 4) & 3, t = (u * 4 - Math.floor(u * 4)) * 2 - 1;
  if (side === 0) out.set(t * r, 0, -r), out.h = 0;          // along +x on the north side
  else if (side === 1) out.set(r, 0, t * r), out.h = 1;      // along +z on the east side
  else if (side === 2) out.set(-t * r, 0, r), out.h = 2;     // along -x on the south side
  else out.set(-r, 0, -t * r), out.h = 3;                    // along -z on the west side
  return out;
}
const HEAD = [PI/2, 0, -PI/2, PI];   // the yaw that points +z at each side's heading

export function lifeFor(layout){
  const e = LIFE[layout];
  if (!e) return null;
  return e.traffic || e.birds ? e : (e[WORLD] || null);
}

export function buildLife(T, L, os){
  clearLife();
  const E = T.life === false ? null : lifeFor(L.layout);
  if (!E) return;
  const grp = new THREE.Group(); grp.userData.noBake = true;
  shared.arenaGroup.add(grp);
  const half = L.arena / 2;
  Object.assign(S, { on: true, grp, half, t: 0, craft: [], birds: [], lights: null, birdIM: null });
  const mat = farHaze(new THREE.MeshToonMaterial({ vertexColors: true }));
  const col = new THREE.Color();

  // TRAFFIC
  const F = E.traffic;
  if (F){
    const nH = Math.round(F.craft * (F.hauler ?? 0)), nS = F.craft - nH;
    const ims = {};
    if (nS) ims.s = new THREE.InstancedMesh(speeder(), mat, nS);
    if (nH) ims.h = new THREE.InstancedMesh(hauler(), mat, nH);
    const lightC = new THREE.Color(F.light ?? T.pal?.lamp ?? T.pal?.windows ?? 0xffc070);
    const lights = F.light === false ? null : new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: lightC, toneMapped: false, fog: false }), F.craft * 2);
    S.lights = lights;
    let iS = 0, iH = 0, nCross = Math.min(F.cross || 0, nS);
    const SO = OUTSKIRTS[os], avenue = !!(SO && SO.avenue);
    // the near end of the city past the edge (where the avenue lanes come down), and the tallest thing standing in
    // the play space (the lanes over the map clear it)
    const near = half + (SO ? SO.clear : 16) + ((T.backdrop || []).some(b => b.kind === 'district') ? 40 : 0);
    S.near = near; S.descend = 36;
    const lmTop = Math.max(0, ...((LANDMARKS[L.layout] || {}).pieces || []).map(p => (p.h || 0) * (p.kind === 'pylon' ? 1.2 : 1.1)));
    // the highest roof a square loop of half-size r (half-widths) could pass over: the outskirts' blocks there, and the
    // map's own backdrop where its ring overlaps the loop (a square loop runs r to r·√2 out from the middle)
    const roofTop = r => {
      let top = 0;
      if (SO && SO.h){ const t = Math.min(1, Math.max(0, (r * 1.41 - SO.from) / (SO.to - SO.from))); top = (SO.h[0] + (SO.h[1] - SO.h[0]) * t) * (os === 'city' || os === 'town' ? 1.3 * (1 + 0.45 * (SO.setback || 0) / 0.35) : 1.25); }
      for (const b of T.backdrop || []){
        const br = Array.isArray(b.r) ? b.r : b.r != null ? [b.r - 0.3, b.r + 0.3] : b.kind === 'district' ? [1, 1.7] : null;
        if (!br || br[1] < r - 0.15 || br[0] > r * 1.41 + 0.15) continue;
        const bh = Array.isArray(b.h) ? b.h[1] * (b.spires ? 1.9 : 1.3) : typeof b.h === 'number' ? b.h * 1.1 : 0;
        top = Math.max(top, bh, b.y != null ? b.y + 20 * (b.scale || 1) : 0);
      }
      return top;
    };
    for (let k = 0; k < F.craft; k++){
      const isH = k >= nS, im = isH ? ims.h : ims.s, i = isH ? iH++ : iS++;
      col.setHex(F.colors[k % F.colors.length]).multiplyScalar(rand(0.85, 1.1));
      im.setColorAt(i, col);
      const c = { im, i, big: isH, li: k * 2, dir: Math.random() < 0.5 ? 1 : -1, spd: rand(...F.speed) * (isH ? 0.65 : 1) };
      if (!isH && nCross > 0){
        // THROUGH traffic: straight down one of the avenues (the two axes), keeping to its side of the road, low
        // between the blocks out in the city and climbing over the map as it crosses (it never flies through a block)
        nCross--;
        const lo = rand(...(F.avenueAlt || [9, 24])), hi = Math.max(rand(...(F.crossAlt || [62, 80])), lmTop + 14);
        Object.assign(c, { cross: true, ax: Math.random() < 0.5, off: c.dir * rand(1.2, 3.4) * (avenue ? 1 : 3), lo: avenue ? lo : hi, hi,
          reach: half * (F.rings[1] + 0.6), s: rand(-1, 1) });
      } else {
        // a square loop round the play space, flown clear of every roof under it (lanes stacked by height, so craft
        // on different loops never meet)
        const r = half * rand(F.rings[0], F.rings[1]);
        Object.assign(c, { r, y: Math.max(rand(...F.alt), roofTop(r / half) + rand(4, 12) + (isH ? 4 : 0)), u: Math.random() });
      }
      S.craft.push(c);
    }
    for (const im of [...Object.values(ims), lights].filter(Boolean)){ im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); if (im.instanceColor) im.instanceColor.needsUpdate = true; grp.add(im); }
  }

  // BIRDS
  const B = E.birds;
  if (B){
    const n = B.flocks * B.per;
    const im = new THREE.InstancedMesh(bird(), farHaze(new THREE.MeshBasicMaterial({ color: B.color, side: THREE.DoubleSide })), n);
    im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    grp.add(im);
    S.birdIM = im; S.B = B;
    for (let f = 0; f < B.flocks; f++){
      const a = (f + rand(-0.3, 0.3)) / B.flocks * PI * 2, r = half * rand(B.ring[0], B.ring[1]);
      const flock = { cx: Math.cos(a) * r, cz: Math.sin(a) * r, y: rand(...B.alt), rad: rand(14, 30) * (B.span > 2.5 ? 1.6 : 1), spin: rand(0.12, 0.22) * (Math.random() < 0.5 ? 1 : -1), drift: rand(0, PI*2) };
      for (let j = 0; j < B.per; j++) S.birds.push({ fl: flock, a: rand(0, PI*2), dr: rand(-5, 5), dy: rand(-4, 4), ph: rand(0, PI*2), rate: rand(7, 10), glide: 0 });
    }
  }
}

export function clearLife(){ S.on = false; S.grp = null; S.craft = []; S.birds = []; }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _l = new THREE.Vector3();

export function updateLife(dt){
  if (!S.on || !S.grp) return;
  S.t += dt;
  // traffic
  const pxK = 0.75 * 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(240, innerHeight);   // metres per 0.75 px, per metre out
  for (const c of S.craft){
    let yaw;
    if (c.cross){
      c.s += c.dir * c.spd * dt / c.reach;
      if (c.s > 1.1) c.s = -1.1; else if (c.s < -1.1) c.s = 1.1;   // (out past the horizon haze before it wraps)
      const d = c.s * c.reach;
      // low in the avenue out past the near end of the city, up over the map between (a smooth climb)
      const k = Math.min(1, Math.max(0, (Math.abs(d) - S.near) / S.descend)), y = c.hi + (c.lo - c.hi) * k * k * (3 - 2 * k);
      if (c.ax){ _p.set(d, y, c.off); yaw = c.dir > 0 ? PI/2 : -PI/2; }
      else { _p.set(-c.off, y, d); yaw = c.dir > 0 ? 0 : PI; }
    } else {
      c.u = (c.u + c.dir * c.spd * dt / (8 * c.r) + 1) % 1;
      onSquare(c.r, c.u, _p); _p.y = c.y + Math.sin(S.t * 0.5 + c.r) * 0.6;
      yaw = HEAD[_p.h] + (c.dir < 0 ? PI : 0);
    }
    _q.setFromEuler(_e.set(0, yaw, 0));
    c.im.setMatrixAt(c.i, _m.compose(_p, _q, _s.set(1, 1, 1)));
    if (!S.lights) continue;
    // running lights: a head lamp at the nose and a tail light, small enough to read as points at range
    // never under about a pixel and a half across: a smaller light falls between pixels and blinks on and off (the
    // bloom turning each blink into a flash) as it flies, so a far craft's lamps grow just enough to hold steady
    const len = c.big ? 10 : 4.6, sz = Math.max(c.big ? 0.9 : 0.5, _p.distanceTo(camera.position) * pxK);
    _v.set(0, 0, len).applyQuaternion(_q).add(_p);
    S.lights.setMatrixAt(c.li, _m.compose(_v, _q, _s.setScalar(sz)));
    _l.set(0, c.big ? 2.8 : 0.4, -len * 0.75).applyQuaternion(_q).add(_p);
    S.lights.setMatrixAt(c.li + 1, _m.compose(_l, _q, _s.setScalar(sz * (0.7 + 0.3 * Math.sin(S.t * 6 + c.li)))));
  }
  if (S.craft.length){
    for (const c of S.craft) c.im.instanceMatrix.needsUpdate = true;
    if (S.lights) S.lights.instanceMatrix.needsUpdate = true;
  }
  // birds: each flock wheels round a slowly wandering centre; each bird flaps, and now and then glides
  if (S.birdIM){
    const B = S.B, span = B.span;
    S.birds.forEach((b, i) => {
      const f = b.fl, a = b.a + S.t * f.spin;
      const cx = f.cx + Math.cos(S.t * 0.05 + f.drift) * 18, cz = f.cz + Math.sin(S.t * 0.04 + f.drift) * 18;
      const r = f.rad + b.dr;
      _p.set(cx + Math.cos(a) * r, f.y + b.dy + Math.sin(S.t * 0.3 + b.ph) * 2, cz + Math.sin(a) * r);
      // heading along the circle (tangent), banked into the turn
      const yaw = Math.atan2(-Math.sin(a) * Math.sign(f.spin), Math.cos(a) * Math.sign(f.spin)) ;
      if (b.glide > 0) b.glide -= dt; else if (Math.random() < dt * B.soar * 0.5) b.glide = rand(1.5, 4);
      const beat = b.glide > 0 ? 0.35 : Math.sin(S.t * b.rate + b.ph);
      _q.setFromEuler(_e.set(0, yaw, -Math.sign(f.spin) * 0.35, 'YXZ'));
      S.birdIM.setMatrixAt(i, _m.compose(_p, _q, _s.set(span, span * beat * 1.4, span)));
    });
    S.birdIM.instanceMatrix.needsUpdate = true;
  }
}
