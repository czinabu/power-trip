// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SANCTUM: the inside of a Jedi temple, built round an arena's play space so the fight happens INDOORS, under a
// roof, in a hall far taller than anyone in it. Used by the temple on Jedha at night (world/arenas/jedha-night.js) and
// the burning archive under it (world/arenas/archive.js), so every mode that builds those maps (story, the Missions
// page, arcade, co-op, sandbox) gets the same hall.
//
//   · WALLS just past the edge: stone, engaged pilasters every bay, a gallery ledge with a balustrade part way up, tall
//     clerestory windows above it, and light falling through some of them in long pale shafts;
//   · a VAULT over everything: elliptical ribs across the hall, the roof laid between them, holes where it has burned or
//     broken through (`hole`), the end walls filled up to the curve;
//   · in the bays at the floor: robed GUARDIAN statues holding their blades point-down, MEDITATION alcoves with
//     cushions and candles, or (the archive) floor-to-vault SHELVES of glowing data cards with busts of the old masters;
//   · the Order's SIGIL high on the north wall over the dais, the great DOORS open behind the spawn in the south.
//
// None of it is in the play space (everything stands past the edge, or overhead well above the jetpack's ceiling), so
// it has no collision and changes no fight: the hall's solids are still the arena builder's own. Nothing here casts a
// shadow either, so the floor keeps its light. The roof is a picture of a roof: you can't reach it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shared } from '../state.js';
import { arenaKit, seeded } from './arenas/kit.js';

const PI = Math.PI;
// the four walls: the angle that turns a piece's local +Z inward, and the polar frame along each wall
const SIDES = { n: 0, s: PI, e: -PI / 2, w: PI / 2 };

/* a shelf face full of data cards: rows of thin glowing spines on a dark ground, a bronze board under each row, gaps where
   the cards were taken. One tile = one shelf (1.6 m) by 3.2 m; it repeats along every shelf in the hall. */
let cardTex = null;
function cards(){
  if (cardTex) return cardTex;
  const W = 256, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), R = seeded(71);
  c.fillStyle = '#120e0c'; c.fillRect(0, 0, W, H);
  let x = 4;
  while (x < W - 4){
    const w = 4 + Math.floor(R() * 5), gap = R() < 0.12;
    if (!gap){
      const h = H * (0.6 + R() * 0.25), r = R();
      // most cards a cool data-blue, some paler, a few warm (old bound records among the cards)
      c.fillStyle = r < 0.62 ? `hsl(${192 + R() * 14},${70 + R() * 20}%,${48 + R() * 22}%)`
                  : r < 0.86 ? `hsl(200,30%,${70 + R() * 15}%)` : `hsl(${30 + R() * 14},55%,${40 + R() * 15}%)`;
      c.fillRect(x, H - 16 - h, w, h);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x, H - 16 - h, w, 3);   // a lit tab on top
    }
    x += w + 1 + (gap ? 10 + Math.floor(R() * 18) : 0);
  }
  c.fillStyle = '#6a4a2a'; c.fillRect(0, H - 16, W, 12);   // the shelf board
  c.fillStyle = '#a07a44'; c.fillRect(0, H - 16, W, 2);
  c.fillStyle = '#080605'; c.fillRect(0, H - 4, W, 4);
  cardTex = new THREE.CanvasTexture(cv);
  cardTex.colorSpace = THREE.SRGBColorSpace; cardTex.wrapS = cardTex.wrapT = THREE.RepeatWrapping; cardTex.anisotropy = 4;
  return cardTex;
}

/* the SHELF faces of a hall, merged into one mesh: planes(w, h, x, y, z, ry) with their UVs scaled so the card tile
   repeats at its real size. Used by the sanctum's walls and by the archive's stacks in the play space. */
export function shelfFaces(){
  const geos = [];
  const add = (w, h, x, y, z, ry = 0) => {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3.2, uv.getY(i) * h / 1.6);
    g.rotateY(ry); g.translate(x, y, z); geos.push(g);
  };
  const done = (tint = 0xffffff) => {
    if (!geos.length) return null;
    const m = new THREE.Mesh(mergeGeometries(geos, false), new THREE.MeshBasicMaterial({ map: cards(), color: tint }));
    for (const g of geos) g.dispose();
    m.userData.noBake = true; m.userData.passThrough = true; m.castShadow = false; m.receiveShadow = false;
    shared.arenaGroup.add(m); return m;
  };
  return { add, done };
}

/* the shafts' material: additive vertex colour, faded out close to the lens, so a camera that ends up standing in a
   shaft doesn't see the whole frame wash out, and into the scene's fog far off */
const shaftMats = new Map();
function shaftMat(op){
  if (shaftMats.has(op)) return shaftMats.get(op);
  const m = new THREE.ShaderMaterial({
    uniforms: { op: { value: op }, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) },
    vertexShader: `attribute vec3 color; varying vec3 vC; varying float vD;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    // the scene's fog swallows them like everything else (so a blackout or a storm closing in puts them out too)
    fragmentShader: `uniform float op; uniform float fogNear; uniform float fogFar; varying vec3 vC; varying float vD;
      void main(){ gl_FragColor = vec4(vC * op * smoothstep(2.5, 11.0, vD) * (1.0 - smoothstep(fogNear, fogFar, vD)), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: true,
  });
  shaftMats.set(op, m); return m;
}

/* a light SHAFT: a long box of light from `from` down to `to`, bright at the top and gone by the floor (additive, so black
   is nothing). Only a picture; it passes through everything. Collected into `out` (by opacity) and merged into one
   mesh each at the end of the build (shafts()). */
function shaft(out, from, to, w, d, color, op){
  const dir = new THREE.Vector3().subVectors(to, from), len = dir.length();
  const geo = new THREE.BoxGeometry(w, len, d, 1, 4, 1), pos = geo.attributes.position, col = [];
  const c = new THREE.Color(color);
  // (clamped: a hair under 0 to the power 1.6 is NaN, and one NaN pixel blacks out the whole bloom)
  for (let i = 0; i < pos.count; i++){ const f = Math.pow(Math.min(1, Math.max(0, 0.5 + pos.getY(i) / len)), 1.6); col.push(c.r * f, c.g * f, c.b * f); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  geo.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  if (!out.has(op)) out.set(op, []);
  out.get(op).push(geo);
}
function shafts(g, out){
  for (const [op, geos] of out){
    const m = new THREE.Mesh(mergeGeometries(geos, false), shaftMat(op));
    for (const q of geos) q.dispose();
    m.userData.noBake = true; m.userData.passThrough = true; m.castShadow = false; m.receiveShadow = false; m.renderOrder = 3;
    g.add(m);
  }
}

/* build the hall round an arena of half size `half`. o (all optional but the colours have defaults):
     wallH     the walls' height to where the vault springs        rise   how far the vault climbs above that
     gallery   the gallery ledge's height (array: one per gallery) bay    pilaster spacing along a wall
     hole(x,z) true where the roof is gone                          char   colour of the roof's burned edges
     style     'temple' (statues, alcoves) | 'archive' (shelves, busts)
     light     the direction light comes in from (the theme's sun), for the shafts; shaftColor, shaftOp
     colours   stone, stoneD, trim, glass (window), cloth (banners, cushions), candle, sigil (its glow), door (outside) */
export function buildSanctum(o = {}){
  const g = shared.arenaGroup, K = arenaKit(), R = seeded(o.seed || 41);
  const H = o.half ?? shared.arenaHalf, off = H + (o.gap ?? 3), Wh = o.wallH ?? 24, rise = o.rise ?? 14, bay = o.bay ?? 7;
  const std = (c, r = 0.92, m = 0.04, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m,
    ...(e ? { emissive: new THREE.Color(c).multiplyScalar(e), emissiveIntensity: 1 } : {}) });
  const stone = std(o.stone ?? 0x8a8272), stoneD = std(o.stoneD ?? 0x5e574c), trim = std(o.trim ?? 0xc8a860, 0.5, 0.5);
  // the vault's undersides face away from every light: a little of the hall's own glow on them, so the roof reads
  const vg = o.vaultGlow ?? 0.35, ribM = std(o.rib ?? o.stone ?? 0x8a8272, 0.92, 0.04, vg), roofM = std(o.roof ?? o.stoneD ?? 0x5e574c, 0.92, 0.04, vg);
  const cofferM = std(o.coffer ?? o.stoneD ?? 0x4a443c, 0.92, 0.04, vg * 0.6), charM = std(o.char ?? 0x2a2018, 1, 0);
  const cloth = std(o.cloth ?? 0x6e2a24, 0.9, 0), hem = std(o.trim ?? 0xc8a860, 0.5, 0.5);
  const wax = std(0xe8dcc0, 0.8), shade = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 1 });
  const fireM = new THREE.MeshBasicMaterial({ color: o.fire ?? 0xff7a2a, toneMapped: false }), emberM = new THREE.MeshBasicMaterial({ color: o.ember ?? 0xffc060 });
  const glass = new THREE.MeshBasicMaterial({ color: o.glass ?? 0xd8e0f0, transparent: true, opacity: o.glassOp ?? 0.12, depthWrite: false, side: THREE.DoubleSide });
  const candle = new THREE.MeshBasicMaterial({ color: o.candle ?? 0xffc070 });
  const sigilM = new THREE.MeshBasicMaterial({ color: o.sigil ?? o.trim ?? 0xc8a860, toneMapped: false });
  const all = [];   // every mesh the hall adds: none casts a shadow, and the collision audit skips them
  const put = (side, geo, mat, a, y, d, rx = 0, ry = 0, rz = 0) => {
    const th = SIDES[side], nx = Math.sin(th), nz = Math.cos(th);
    const m = K.deco(geo, mat, -nx * d + Math.cos(th) * a, y, -nz * d - Math.sin(th) * a);
    m.rotation.set(rx, th + ry, rz, 'YXZ'); all.push(m); return m;
  };
  const free = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = K.deco(geo, mat, x, y, z, rx, ry, rz); all.push(m); return m; };
  const galleries = [].concat(o.gallery ?? [Wh * 0.46]);
  const lightDir = new THREE.Vector3(...(o.light || [-18, 40, 30])).normalize();   // toward the light
  const shelves = o.style === 'archive' ? shelfFaces() : null;
  const len = off * 2 + 4, beams = new Map();

  // ---------------- the WALLS ----------------
  const pil = [];   // pilaster positions along a wall: one either side of every bay, the middle bay left open
  for (let a = bay / 2; a < off - 1; a += bay) pil.push(a, -a);
  pil.sort((p, q) => p - q);
  // the CLERESTORY: a tall window in every bay over the top gallery (not the sigil's or the doors'), OPEN to the world
  // outside, so the city, the statues and the sky beyond the walls (the theme's backdrop) show through
  const top = galleries[galleries.length - 1], wy0 = o.windowY0 ?? top + 2.2, wy1 = Wh - 2.4;
  const bays = [];
  for (let k = 0; k < pil.length - 1; k++){
    const a0 = pil[k], a1 = pil[k + 1], c = (a0 + a1) / 2, w = a1 - a0 - 1.8;
    if (w >= 2) bays.push({ k, c, w, mid: Math.abs(c) < 0.1, ww: Math.min(o.windowW ?? 2.4, w * 0.5) });
  }
  const tall = side => (o.arcade || []).includes(side) && (o.arcadeTop ?? 0) > wy0;   // an arcade up past the windows: the whole wall is arches
  const windowed = (side, b) => !(b.mid && (side === 'n' || side === 's')) && wy1 - wy0 > 3 && !tall(side);
  // the ARCADE (o.arcade: the walls it opens): the lower storey of a side wall open between its piers, a tall arch in
  // every bay from the plinth up to under the gallery, the holy city right outside
  const ay0 = 1.1, ay1 = o.arcadeTop ?? galleries[0] - 1.4, arcaded = side => (o.arcade || []).includes(side) && ay1 - ay0 > 3;
  for (const side of ['n', 's', 'e', 'w']){
    // the wall itself, in bands: solid, then cut where an arch or a window opens in it
    const band = (y0, y1, cuts = []) => {
      if (y1 - y0 < 0.01) return;
      let from = -len / 2;
      for (const [c0, c1] of [...cuts, [len / 2, len / 2]]){
        if (c0 - from > 0.01) put(side, new THREE.BoxGeometry(c0 - from, y1 - y0, 2), stoneD, (from + c0) / 2, (y0 + y1) / 2, off + 1);
        from = c1;
      }
    };
    const arches = arcaded(side) ? bays.filter(b => !b.mid).map(b => [b.c - b.w * 0.4, b.c + b.w * 0.4]) : [];
    const lights = bays.filter(b => windowed(side, b)).map(b => [b.c - b.ww / 2, b.c + b.ww / 2]);
    if (tall(side)){ band(0, ay0); band(ay0, ay1, arches); band(ay1, Wh); }
    else {
      if (arches.length){ band(0, ay0); band(ay0, ay1, arches); band(ay1, wy0); } else band(0, wy0);
      band(wy0, wy1, lights); band(wy1, Wh);
    }
    for (const [c0, c1] of arches){   // each arch: its head in tracery, a keystone
      const c = (c0 + c1) / 2, r = (c1 - c0) / 2;
      put(side, new THREE.TorusGeometry(r - 0.1, 0.22, 6, 16, PI), trim, c, ay1 - r, off - 0.05);
      put(side, new THREE.BoxGeometry(0.5, 0.8, 0.5), trim, c, ay1 - 0.3, off - 0.1);
      for (const sx of [-1, 1]) put(side, new THREE.BoxGeometry(r * 0.7, r * 0.7, 2), stoneD, c + sx * (r - r * 0.35), ay1 - r * 0.35, off + 1, 0, 0, 0);   // the spandrels
    }
    put(side, new THREE.BoxGeometry(len, 1.1, 0.8), stone, 0, 0.55, off - 0.3);           // the plinth course
    put(side, new THREE.BoxGeometry(len, 0.5, 1.0), trim, 0, Wh - 0.25, off - 0.4);       // the cornice where the vault springs
    for (const gy of tall(side) ? [] : galleries){
      put(side, new THREE.BoxGeometry(len, 0.6, 2.4), stone, 0, gy, off - 1.2);            // the gallery ledge
      put(side, new THREE.BoxGeometry(len, 0.14, 0.2), trim, 0, gy + 1.05, off - 2.3);     // its rail
      for (let a = -off; a <= off; a += 1.4) put(side, new THREE.BoxGeometry(0.16, 0.8, 0.16), stoneD, a, gy + 0.65, off - 2.3);
    }
    for (const a of pil){
      put(side, new THREE.BoxGeometry(1.8, Wh, 1.1), stone, a, Wh / 2, off - 0.5);          // the pilaster
      put(side, new THREE.BoxGeometry(2.3, 1.0, 1.5), stoneD, a, 0.5, off - 0.6);            // its base
      put(side, new THREE.BoxGeometry(2.3, 0.8, 1.5), trim, a, Wh - 0.9, off - 0.6);         // its capital
    }
    // the bays between the pilasters
    const b0 = c => bays.find(b => b.c === c);
    for (const { k, c, w, mid, ww } of bays){
      if (windowed(side, b0(c))){
        // the opening: a sill, a frame either side, an arch of tracery across its head (and a faint pane, o.glassOp)
        put(side, new THREE.BoxGeometry(ww + 0.5, 0.35, 0.5), trim, c, wy0 - 0.1, off - 0.2);
        for (const sx of [-1, 1]) put(side, new THREE.BoxGeometry(0.22, wy1 - wy0, 0.4), trim, c + sx * (ww / 2 + 0.06), (wy0 + wy1) / 2, off - 0.1);
        put(side, new THREE.TorusGeometry(ww / 2 - 0.05, 0.12, 6, 14, PI), trim, c, wy1 - ww / 2, off + 0.2);
        put(side, new THREE.BoxGeometry(0.12, wy1 - wy0, 0.12), trim, c, (wy0 + wy1) / 2, off + 0.2);   // the mullion
        if (o.glassOp) put(side, new THREE.PlaneGeometry(ww, wy1 - wy0), glass, c, (wy0 + wy1) / 2, off + 0.25);
        const th = SIDES[side], inward = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
        // a shaft only from the walls the light comes in through, and not from every window
        if (inward.dot(lightDir) < -0.2 && (k % 2 === 0) && o.shaftOp !== 0){
          const from = new THREE.Vector3(-inward.x * (off - 0.3) + Math.cos(th) * c, (wy0 + wy1) / 2, -inward.z * (off - 0.3) - Math.sin(th) * c);
          const t = from.y / Math.max(0.2, lightDir.y), to = from.clone().addScaledVector(lightDir, -t);
          shaft(beams, from, to, ww * 1.3, ww * 0.9, o.shaftColor ?? 0xd8e4ff, o.shaftOp ?? 0.16);
        }
      }
      if (mid && side === 'n'){ sigil(c); continue; }
      if (mid && side === 's'){ doors(c, w); continue; }
      if (o.style === 'archive' && arcaded(side)){
        if (k % 2 === 0) bust(side, c);   // the side walls stand open: only a bust in the arch now and then
      } else if (o.style === 'archive'){
        // floor-to-vault SHELVES between the pilasters, a bronze board on every shelf, a ladder now and then
        const sh = wy0 - 1.6;   // (up to the windows)
        const [fx, fz] = wallXZ(side, c, off - 0.05);
        shelves.add(w, sh, fx, 1.1 + sh / 2, fz, SIDES[side]);
        if (R() < 0.3) put(side, new THREE.BoxGeometry(0.9, Wh * 0.42, 0.12), stoneD, c + (R() - 0.5) * w * 0.6, Wh * 0.21, off - 0.4, -0.12);
        // a bust of one of the old masters on a pedestal at the foot of every other bay
        if (k % 2 === 0) bust(side, c);
        // the fire has reached a few of the upper shelves
        if (o.burning && R() < o.burning){
          const by = 2.5 + R() * Math.max(0, wy0 - 6.5);   // (under the windows)
          put(side, new THREE.PlaneGeometry(w * 0.9, 3), fireM, c, by, off - 0.1);
          for (let n = 0; n < 3; n++){
            const f = put(side, new THREE.ConeGeometry(0.5, 1.6 + R(), 7), n % 2 ? fireM : emberM,
              c + (n - 1) * w * 0.3, by + 2, off - 0.6);
            f.userData.noBake = true;
          }
        }
      } else if (side === 'e' || side === 'w' || k % 2 === 0){
        if ((k + (side === 'e' ? 1 : 0)) % 2 === 0) guardian(side, c); else if (!arcaded(side)) alcove(side, c, w);
      }
    }
  }
  // corner piers, where the walls meet
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) free(new THREE.BoxGeometry(3, Wh, 3), stone, sx * (off + 0.4), Wh / 2, sz * (off + 0.4));

  // ---------------- the VAULT ----------------
  // the ribs run across the hall (x), every `ribEvery` along z; the roof is laid between them, segment by segment
  const N = 16, ribs = [], ribEvery = o.ribEvery ?? bay;
  const arc = t => [Math.cos(t) * (off + 0.5), Wh + Math.sin(t) * rise];
  for (let z = -off; z <= off + 0.01; z += ribEvery) ribs.push(z);
  if (ribs[ribs.length - 1] < off - 0.5) ribs.push(off);
  for (const z of ribs) for (let i = 0; i < N; i++){
    const [x0, y0] = arc(PI * i / N), [x1, y1] = arc(PI * (i + 1) / N), l = Math.hypot(x1 - x0, y1 - y0);
    free(new THREE.BoxGeometry(l + 0.3, 1.3, 1.1), ribM, (x0 + x1) / 2, (y0 + y1) / 2 - 0.5, z, 0, 0, Math.atan2(y1 - y0, x1 - x0));
  }
  for (let j = 0; j < ribs.length - 1; j++){
    const z0 = ribs[j], z1 = ribs[j + 1], zc = (z0 + z1) / 2;
    for (let i = 0; i < N; i++){
      const [x0, y0] = arc(PI * i / N), [x1, y1] = arc(PI * (i + 1) / N), l = Math.hypot(x1 - x0, y1 - y0), xc = (x0 + x1) / 2;
      const gone = o.hole && o.hole(xc, zc), edge = !gone && o.hole && (o.hole(xc + 3, zc) || o.hole(xc - 3, zc) || o.hole(xc, zc + 3) || o.hole(xc, zc - 3));
      if (gone) continue;
      free(new THREE.BoxGeometry(l + 0.1, 0.5, z1 - z0), edge ? charM : roofM, xc, (y0 + y1) / 2, zc, 0, 0, Math.atan2(y1 - y0, x1 - x0));
      // a coffer in each panel: a darker recess, so the roof reads as built and not as a lid
      if (!edge && l > 2) free(new THREE.BoxGeometry(l * 0.6, 0.2, (z1 - z0) * 0.6), cofferM, xc, (y0 + y1) / 2 - 0.3, zc, 0, 0, Math.atan2(y1 - y0, x1 - x0));
    }
  }
  // the end walls, filled up under the curve
  for (const sz of [-1, 1]) for (let i = 0; i < N; i++){
    const [x0, y0] = arc(PI * i / N), [x1, y1] = arc(PI * (i + 1) / N), top = Math.max(y0, y1);
    free(new THREE.BoxGeometry(Math.abs(x1 - x0) + 0.2, top - Wh + 0.5, 2), stoneD, (x0 + x1) / 2, (Wh + top) / 2 - 0.25, sz * (off + 1));
  }
  // light down through the holes in the roof
  if (o.hole && o.holeShafts) for (const [x, z, r] of o.holeShafts){
    const from = new THREE.Vector3(x, Wh + rise * 0.9, z), t = from.y / Math.max(0.2, lightDir.y);
    shaft(beams, from, from.clone().addScaledVector(lightDir, -t), r * 1.4, r, o.shaftColor ?? 0xffe0b0, o.holeOp ?? (o.shaftOp ?? 0.16) * 0.8);
  }

  // ---------------- the pieces ----------------
  function wallXZ(side, a, d){ const th = SIDES[side]; return [-Math.sin(th) * d + Math.cos(th) * a, -Math.cos(th) * d - Math.sin(th) * a]; }
  /* a GUARDIAN: a robed, hooded figure three times a man's height on a plinth, both hands on the pommel of a blade
     planted point-down in front of it */
  function guardian(side, a){
    const d = H + 1.7, s = (o.statueH ?? 7.5) / 7.5, b = 1.4;
    put(side, new THREE.BoxGeometry(2.8, b, 2.6), stoneD, a, b / 2, d);
    put(side, new THREE.BoxGeometry(3.0, 0.2, 2.8), trim, a, b, d);
    put(side, new THREE.CylinderGeometry(0.7 * s, 1.25 * s, 4.6 * s, 10), stone, a, b + 2.3 * s, d);              // the robe
    put(side, new THREE.CylinderGeometry(0.95 * s, 0.7 * s, 1.1 * s, 10), stone, a, b + 5.0 * s, d);              // shoulders
    put(side, new THREE.SphereGeometry(0.62 * s, 10, 8), stone, a, b + 6.0 * s, d + 0.05 * s);                    // the hood
    put(side, new THREE.SphereGeometry(0.42 * s, 8, 6), shade, a, b + 5.95 * s, d - 0.32 * s);   // the shadow in it
    for (const sx of [-1, 1]) put(side, new THREE.BoxGeometry(0.34 * s, 1.9 * s, 0.4 * s), stone, a + sx * 0.5 * s, b + 4.35 * s, d - 0.55 * s, -0.35, 0, sx * 0.35);   // the arms
    put(side, new THREE.BoxGeometry(0.7 * s, 0.45 * s, 0.5 * s), stone, a, b + 3.55 * s, d - 0.95 * s);           // the hands, clasped
    put(side, new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.9 * s, 8), trim, a, b + 3.6 * s, d - 1.0 * s);       // the hilt
    put(side, new THREE.BoxGeometry(0.16 * s, 3.2 * s, 0.1 * s), stoneD, a, b + 1.6 * s, d - 1.0 * s);             // the blade, to the plinth
  }
  /* a MEDITATION alcove: a low round step at the foot of a bay, cushions round it and candles burning */
  function alcove(side, a, w){
    const d = H + 1.8;
    put(side, new THREE.CylinderGeometry(1.6, 1.7, 0.25, 16), stone, a, 0.125, d);
    put(side, new THREE.CylinderGeometry(1.25, 1.25, 0.04, 16), trim, a, 0.26, d);
    for (let n = 0; n < 3; n++) put(side, new THREE.CylinderGeometry(0.42, 0.46, 0.18, 10), cloth, a + (n - 1) * 0.95, 0.36, d + (n === 1 ? -0.3 : 0.2));
    for (let n = 0; n < 6; n++){
      const ca = a + (R() - 0.5) * w * 0.8, cd = d + 1.0 + R() * 0.6, ch = 0.25 + R() * 0.4;
      put(side, new THREE.CylinderGeometry(0.07, 0.07, ch, 6), wax, ca, ch / 2, cd);
      const f = put(side, new THREE.ConeGeometry(0.05, 0.14, 5), candle, ca, ch + 0.08, cd);
      f.userData.noBake = true;
    }
    // a long banner down the bay
    banner(side, a, galleries[0] - 3.6, Math.min(2.2, w * 0.5), 6.5);
  }
  /* a BANNER hung flat on the wall: cloth, a hem top and bottom, the sigil's ring on it */
  function banner(side, a, y, w, h){
    const d = off - 0.12;
    put(side, new THREE.BoxGeometry(w, h, 0.06), cloth, a, y, d);
    put(side, new THREE.BoxGeometry(w + 0.1, h * 0.06, 0.1), hem, a, y - h * 0.47, d - 0.02);
    put(side, new THREE.BoxGeometry(w + 0.3, 0.16, 0.16), hem, a, y + h / 2, d - 0.04);
    put(side, new THREE.TorusGeometry(w * 0.2, w * 0.035, 6, 24), sigilM, a, y + h * 0.18, d - 0.06);
  }
  /* a BUST of an old master on a pedestal (the archive) */
  function bust(side, a){
    const d = H + 1.3;
    put(side, new THREE.BoxGeometry(0.9, 1.5, 0.9), stoneD, a, 0.75, d);
    put(side, new THREE.BoxGeometry(1.05, 0.14, 1.05), trim, a, 1.52, d);
    put(side, new THREE.CylinderGeometry(0.32, 0.5, 0.55, 8), stone, a, 1.86, d);
    put(side, new THREE.SphereGeometry(0.3, 10, 8), stone, a, 2.38, d);
  }
  /* the Order's SIGIL over the north bay: a ring, three wings either side, the blade standing up through it */
  function sigil(a){
    const y = (galleries[galleries.length - 1] + Wh) / 2 + 0.5, d = off - 0.2, s = o.sigilSize ?? 3.2;
    put('n', new THREE.TorusGeometry(s * 0.55, s * 0.09, 8, 40), sigilM, a, y, d);
    put('n', new THREE.CircleGeometry(s * 0.46, 32), stoneD, a, y, d + 0.05);
    // the blade: up out of the top of the ring, a short guard where it meets it
    put('n', new THREE.BoxGeometry(s * 0.16, s * 1.5, 0.22), sigilM, a, y + s * 0.55 + s * 0.75, d);
    put('n', new THREE.BoxGeometry(s * 0.5, s * 0.12, 0.22), sigilM, a, y + s * 0.62, d);
    put('n', new THREE.ConeGeometry(s * 0.08, s * 0.3, 4), sigilM, a, y + s * 2.2, d, 0, PI / 4, 0);
    // the wings: three feathers a side, sweeping up and out from the ring
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++){
      const l = s * (1.6 - k * 0.35), ang = 0.35 + k * 0.32;
      put('n', new THREE.BoxGeometry(l, s * 0.13, 0.22), sigilM, a + sx * (s * 0.62 + Math.cos(ang) * l / 2), y - s * 0.1 + Math.sin(ang) * l / 2 - k * s * 0.05, d, 0, 0, sx * ang);
    }
    // and two tall banners hanging either side of it, down to the gallery
    for (const sx of [-1, 1]) banner('n', a + sx * s * 2.5, Wh - 6.4, 2.0, 9);
  }
  /* the great DOORS in the south, behind the spawn: standing open, the night (or the smoke) outside */
  function doors(a, w){
    const dh = Math.min(galleries[0] - 1, 11), dw = Math.min(w - 0.6, 7);
    const out = new THREE.MeshBasicMaterial({ color: o.door ?? 0x1a1a2e, fog: false });
    put('s', new THREE.PlaneGeometry(dw, dh - dw / 2), out, a, (dh - dw / 2) / 2, off - 0.03);
    put('s', new THREE.CircleGeometry(dw / 2, 14, 0, PI), out, a, dh - dw / 2, off - 0.03);
    for (const sx of [-1, 1]){
      put('s', new THREE.BoxGeometry(0.8, dh, 0.9), trim, a + sx * (dw / 2 + 0.4), dh / 2, off - 0.3);
      put('s', new THREE.BoxGeometry(dw * 0.5, dh - dw / 2 - 0.4, 0.3), stoneD, a + sx * (dw / 2 + 1.6), (dh - dw / 2) / 2, off - 1.0, 0, sx * 0.9, 0);   // a door leaf, swung open
    }
  }

  if (shelves) shelves.done(o.cardTint ?? 0xffffff);
  shafts(g, beams);
  for (const m of all){ m.castShadow = false; m.userData.passThrough = true; }
  return { off, wallH: Wh, top: Wh + rise };
}
