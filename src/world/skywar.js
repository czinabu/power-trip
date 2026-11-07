// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SKY WAR: the trailer layer over the war beyond the walls (world/warfront.js). Where that file keeps the battle
// going past the edge, this one adds the moments a film trailer cuts to, so a fight on any battle world feels like one
// corner of something enormous:
//   · CAPITAL SHIPS hanging in the far sky, hazed by distance, trading fat turbolaser salvos with each other (and
//     shelling the ground battle on the horizon); the hits flash on their hulls and leave them smoking;
//   · GUNSHIPS sweeping low along the flanks in pairs, banking through the turn, firing rockets out into the war
//     beyond the walls, with an engine roar as they pass;
//   · SHOOTDOWNS: a fighter or gunship in the sky takes a hit, bursts, and its wreck spirals down trailing fire and
//     smoke to crash on the horizon in a big blast that burns for a while;
//   · FLAK bursting around the passing flights, and BURNING DEBRIS raining from the explosions;
//   · now and then a HUGE DETONATION far out (a fuel dump, a reactor): a fireball, a rising plume, a heavy rumble.
//
// Purely visual and sound: no collision, no damage, nothing a hero or foe can touch or see past (every piece of it
// stays outside the play space and well above it), and the camera never shakes for it. It rides the world's
// `warfront` entry (data/worlds.js), so it runs in every mode that plays on a battle world (story missions, survival,
// arcade, the battle simulator, the sandbox's battle maps, co-op); a world without a warfront (the training rooms,
// the interiors) stays quiet. A world tunes it with `warfront.epic`:
//   epic: false                      — none of it (a calm map)
//   epic: { level: 0..1,             — how much happens (default 1; 0.4 on a world whose warfront has no blasts:
//                                      gunship patrols and a capital ship overhead, no explosions)
//           capitals: n, gunships: n — how many (defaults from the level)
//           capital: { color, color2 }, cruiser: { color, color2 }, gunship: { color, color2 },
//           bolts: [foe, ally],      — the capital ships' turbolaser colours
//           gunAlt: [lo, hi] }       — how high the gunships fly
// Settings · SKY BATTLE picks how much of it plays (AUTO follows the graphics tier, and phones take the light
// version; FULL; LIGHT; OFF). Cost: a few merged meshes plus one instanced pool, sharing the warfront's tracers,
// flashes and smoke.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand } from '../utils.js';
import { shared, G } from '../state.js';
import { camera } from '../engine/renderer.js';
import { qualityLevel } from '../engine/quality.js';
import { fightMood } from './atmosphere.js';
import { flyby } from '../audio/director.js';
import { warState as W, tracer, flash, puff, shipGeo, shipMat, glowMat, part } from './warfront.js';

const PI = Math.PI;
const SK = { on: false };
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/* how much of the sky war plays right now: 0 off, 0.5 light, 1 full (Settings · SKY BATTLE, G.skywar) */
export function skywarLevel(){
  const pref = G.skywar || 'auto';
  if (pref === 'off') return 0;
  if (pref === 'light') return 0.5;
  if (pref === 'full') return 1;
  return qualityLevel() === 'low' || coarse ? 0.5 : 1;
}

/* ---------- capital ships: one merged, vertex-coloured mesh each, nose along +z, about 240 m long at scale 1 ---------- */
function destroyerGeo(o){
  const L = [], hull = o.color ?? 0x9aa0a8, dark = o.color2 ?? 0x5c626c;
  // the wedge: a three-sided cone laid flat, the keel underneath and the deck on top
  part(L, new THREE.ConeGeometry(1, 1, 3), hull, 0, 0, 0, PI/2, 0, 0, 64, 240, 24);
  part(L, new THREE.ConeGeometry(1, 1, 3), dark, 0, -3, -6, PI/2, 0, 0, 50, 200, 22);
  // the stepped superstructure and the bridge tower at the stern
  part(L, new THREE.BoxGeometry(54, 9, 70), hull, 0, 14, -80);
  part(L, new THREE.BoxGeometry(30, 9, 36), dark, 0, 22, -92);
  part(L, new THREE.BoxGeometry(7, 16, 7), hull, 0, 33, -100);
  part(L, new THREE.BoxGeometry(36, 5, 7), hull, 0, 43, -100);
  for (const s of [-1, 1]) part(L, new THREE.IcosahedronGeometry(3.6, 1), hull, s * 12, 48, -100);
  // trench lines along the deck
  for (const s of [-1, 1]) part(L, new THREE.BoxGeometry(2, 1.2, 120), dark, s * 18, 8.5, -10, 0, s * 0.14, 0);
  const geo = mergeGeometries(L, false);
  const eng = mergeGeometries([[0, 6], [-16, 4], [16, 4]].map(([x, y]) => new THREE.SphereGeometry(6, 8, 6).translate(x, y, -121)), false);
  const lp = [];
  for (let k = 0; k < 14; k++){ const t = k / 14, s = k % 2 ? 1 : -1; lp.push([s * 55 * (1 - t) * 0.98, 4.5 * (1 - t), -118 + t * 232]); }
  for (let k = 0; k < 6; k++) lp.push([(k - 2.5) * 6, 47, -96.2]);
  // the gun batteries salvos leave from (local, before the ship's scale)
  return { geo, eng, lights: portLights(lp), glow: 0x9ad8ff, guns: [[-26, 9, -40], [26, 9, -40], [-16, 11, 10], [16, 11, 10], [0, 26, -86]] };
}
function cruiserGeo(o){
  const L = [], hull = o.color ?? 0xc8c0b0, dark = o.color2 ?? 0x8a6a5a;
  part(L, new THREE.CylinderGeometry(16, 13, 190, 12), hull, 0, 0, -10, PI/2, 0, 0, 1, 1, 0.7);
  part(L, new THREE.IcosahedronGeometry(1, 2), hull, 0, 0, 86, 0, 0, 0, 15, 10, 22);
  part(L, new THREE.BoxGeometry(46, 7, 26), dark, 0, 0, 62);   // the forward hammer block
  part(L, new THREE.BoxGeometry(4, 22, 60), dark, 0, 16, -50);   // the dorsal fin
  part(L, new THREE.BoxGeometry(4, 18, 40), dark, 0, -16, -40);
  for (const s of [-1, 1]){
    part(L, new THREE.CylinderGeometry(7, 7, 70, 10), hull, s * 21, -2, -70, PI/2, 0, 0);
    part(L, new THREE.BoxGeometry(12, 3, 30), dark, s * 13, 0, -60);
  }
  const geo = mergeGeometries(L, false);
  const eng = mergeGeometries([[0, 0, -106, 10], [21, -2, -106, 6], [-21, -2, -106, 6]].map(([x, y, z, r]) => new THREE.SphereGeometry(r, 8, 6).translate(x, y, z)), false);
  const lp = [];
  for (let k = 0; k < 16; k++){ const s = k % 2 ? 1 : -1; lp.push([s * 14, 3, -95 + (k >> 1) * 22]); }
  return { geo, eng, lights: portLights(lp), glow: 0xffb070, guns: [[-12, 9, 30], [12, 9, 30], [0, 14, 60], [-20, 4, -40], [20, 4, -40]] };
}

// unlit, the light baked into the vertex colours (buildSkywar): at night a lit hull would sink into the dark sky
const capMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
// the running lights along a hull: little glowing ports that pick a capital ship out of a night sky
function portLights(pts){ return mergeGeometries(pts.map(([x, y, z]) => new THREE.BoxGeometry(1.8, 1.8, 1.8).translate(x, y, z)), false); }

/* ---------- placement helpers ---------- */
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
// where the fight is: the middle of the play space, or on a battle map (far bigger) the camera's patch of it
function centre(out){ return shared.arenaBig ? out.set(camera.position.x, 0, camera.position.z) : out.set(W.cx, 0, W.cz); }
const maxHalf = () => shared.arenaBig ? 45 : Math.max(W.half, W.halfZ);
// how far out of the play space a point sits, in half-widths (an ellipse round it): below ~1.25 is too close to the fight
function norm(p){
  if (shared.arenaBig) return Math.hypot(p.x - camera.position.x, p.z - camera.position.z) / 45;
  return Math.hypot((p.x - W.cx) / W.half, (p.z - W.cz) / W.halfZ);
}
// push a ground point out until it's clear of the play space
// (and at least minM metres from the middle: smoke and fire close in would hang over the fight's skyline)
function clearOut(p, min = 1.35, minM = 0){
  centre(_u);
  const n = norm(p), dx = p.x - _u.x, dz = p.z - _u.z, len = Math.hypot(dx, dz) || 1;
  if (n >= min && len >= minM) return p;
  const want = Math.max(len * min / Math.max(n, 0.05), maxHalf() * min, minM);
  p.x = _u.x + dx / len * want; p.z = _u.z + dz / len * want;
  return p;
}
// the nearest a big blast, a crash or a burning wreck may be: far enough that its smoke stays a column on the horizon
const FAR = () => Math.max(150, maxHalf() * 3.5);
const flashK = () => 0.35 + 0.65 * Math.min(1, G.flashScale ?? 1);   // Settings · FLASHES calms the bright ones
const live = () => G.mode === 'play' && !G.paused && !G.cutscene;

/* ---------- build (world/arena.js buildWorld, after the warfront) ---------- */
/* THE SKYLINE: how high the backdrop climbs in each direction, seen from the middle of the play space (the tangent of
   its elevation, per bin of azimuth), so a capital ship can be hung where the sky is open and just above the tallest
   thing under it, never hidden behind a mountain or a spire. One pass over the backdrop's vertices at build time */
const BINS = 36, RING = 40, RINGS = 20;
const binOf = (x, z) => Math.floor(((Math.atan2(z, x) / (PI * 2)) + 1) % 1 * BINS) % BINS;
// (it also fills SK.hmap: the tallest thing in each bin of azimuth and 40 m ring of distance, so a gunship can lift
// over what stands in its way)
function skyline(back){
  const top = new Float32Array(BINS), v = new THREE.Vector3(), m = new THREE.Matrix4();
  const hmap = SK.hmap = new Float32Array(BINS * RINGS);
  if (!back) return top;
  back.updateMatrixWorld(true);
  const look = (x, y, z) => {
    const h = Math.hypot(x, z);
    if (h < 2) return;
    const b = binOf(x, z), t = (y - 2.5) / h, r = Math.floor(h / RING);
    if (t > top[b]) top[b] = t;
    if (r < RINGS && y > hmap[b * RINGS + r]) hmap[b * RINGS + r] = y;
  };
  back.traverse(o => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    if (o.isInstancedMesh){
      // an instanced crowd (trees, rocks): the top of each one's bounding sphere is enough
      const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere;
      for (let i = 0; i < o.count; i++){
        o.getMatrixAt(i, m); m.premultiply(o.matrixWorld);
        v.copy(bs.center).applyMatrix4(m);
        const r = bs.radius * m.getMaxScaleOnAxis();
        look(v.x, v.y + r, v.z);
      }
      return;
    }
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++){ v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); look(v.x, v.y, v.z); }
  });
  return top;
}
/* the tallest thing standing near a point (its bin and ring, and the ones either side) */
function heightNear(x, z){
  const H = SK.hmap; if (!H) return 0;
  const b = binOf(x, z), r = Math.floor(Math.hypot(x, z) / RING);
  let h = 0;
  for (let db = -1; db <= 1; db++) for (let dr = -1; dr <= 1; dr++){
    const rr = r + dr; if (rr < 0 || rr >= RINGS) continue;
    h = Math.max(h, H[((b + db + BINS) % BINS) * RINGS + rr]);
  }
  return h;
}
/* the open sky for a ship spanning `span` bins either side: the azimuth whose skyline is lowest, and how high it is */
function openSky(top, span, avoid = []){
  let best = -1, bestT = Infinity;
  for (let b = 0; b < BINS; b++){
    if (avoid.some(a => { const d = Math.abs(((b - a) % BINS + BINS) % BINS); return Math.min(d, BINS - d) < span * 2 + 1; })) continue;
    let t = 0;
    for (let k = -span; k <= span; k++) t = Math.max(t, top[((b + k) % BINS + BINS) % BINS]);
    t += Math.random() * 0.02;   // (a tie between open bins goes a different way each build)
    if (t < bestT){ bestT = t; best = b; }
  }
  return { bin: best, a: (best + 0.5) / BINS * PI * 2, tan: bestT };
}

export function buildSkywar(T, back){
  SK.on = false;
  const F = T.warfront;
  if (!F || !W.on || !W.grp || F.epic === false) return;
  const E = typeof F.epic === 'object' ? F.epic : {};
  const e = E.level ?? (F.blasts === 0 ? 0.4 : 1);
  if (e <= 0) return;
  const grp = new THREE.Group(); grp.userData.noBake = true; grp.userData.noSolid = true;   // (it flies: never collision, world/autosolid.js)
  W.grp.add(grp);
  Object.assign(SK, { on: true, F, E, e, grp, t: 0, caps: [], guns: [], wrecks: [], fires: [], later: [], embers: [],
    nextDown: rand(4, 8), nextFlak: rand(1, 2), nextHero: rand(8, 14), fighters: (F.flyers || []).some(f => f.kind === 'tie' || f.kind === 'xwing') });
  const skyR = shared.skyR || 600;
  // CAPITAL SHIPS — out past the backdrop, inside the sky dome; on a battle map they ride along with the camera
  const nCap = E.capitals ?? (e >= 0.7 ? 2 : 1);
  const D = Math.min(520, Math.max(260, skyR * 0.5));
  const top = skyline(back), used = [];
  SK.top = top;
  // their own aerial haze: the colours lean a set share toward the fog (the far haze would wash them out to nothing
  // at this range), unfogged after that, so they read as huge, pale shapes hanging in the sky
  const haze = new THREE.Color(T.sky?.horizon ?? T.fog ?? 0x888888).lerp(new THREE.Color(T.fog ?? 0x888888), 0.5), hk = E.haze ?? 0.22;
  const sun = new THREE.Vector3(0.3, 1, 0.25).normalize();
  const hazed = geo => { const g = geo.clone(), c = g.attributes.color, n = g.attributes.normal;
    for (let i = 0; i < c.count; i++){
      const lit = 0.55 + 0.45 * Math.max(0, _w.set(n.getX(i), n.getY(i), n.getZ(i)).dot(sun));   // the light, baked: decks bright, keels in shade
      _c.setRGB(c.getX(i), c.getY(i), c.getZ(i)).multiplyScalar(lit).lerp(haze, hk); c.setXYZ(i, _c.r, _c.g, _c.b);
    }
    return g; };
  for (let k = 0; k < nCap; k++){
    const foe = k % 2 === 0, s = foe ? destroyerGeo(E.capital || {}) : cruiserGeo(E.cruiser || {});
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hazed(s.geo), capMat));
    g.add(new THREE.Mesh(s.eng, glowMat(s.glow)));
    g.add(new THREE.Mesh(s.lights, glowMat(0xd8ecff)));
    grp.add(g);
    // the second ship takes the next open stretch of sky, at least ~40° round from the first
    // high enough that its keel clears the skyline, low enough that the play camera's top third still holds it
    const dist = D * rand(0.92, 1.05), sky = openSky(top, 2, used), sc = dist / 330 * rand(0.9, 1.1); used.push(sky.bin);
    const a = sky.a, el = Math.min(0.5, Math.max(0.16, Math.atan(sky.tan) + (shared.arenaBig ? 0.1 : 0.05) + 50 * sc / dist));
    g.scale.setScalar(sc);
    SK.caps.push({ g, foe, guns: s.guns, a, a0: a, dist, alt: dist * Math.tan(el), sc, drift: Math.random() < 0.5 ? -1 : 1,
      fireT: rand(0.5, 2), hits: 0, burns: [], bob: rand(0, PI * 2) });
  }
  // each turns its bow toward the other (broadside to the fight either way), so the two read as squaring off
  for (const c of SK.caps){
    const o = SK.caps.find(q => q !== c);
    if (o) c.drift = Math.sin(o.a - c.a) >= 0 ? 1 : -1;
  }
  // GUNSHIPS — pairs that sweep the flanks, leave, and come round again on a new line
  const nGun = E.gunships ?? (e >= 0.7 ? 2 : 1);
  for (let k = 0; k < nGun; k++){
    const s = shipGeo('gunship', E.gunship || {}), wing = [];
    for (let j = 0; j < 2; j++){
      const m = new THREE.Group();
      m.add(new THREE.Mesh(s.geo, shipMat));
      m.add(new THREE.Mesh(s.eng, glowMat(s.glow)));
      m.visible = false; grp.add(m); wing.push(m);
    }
    SK.guns.push({ wing, t: 0, dur: 0, wait: k * rand(5, 9) + rand(1, 4), from: new THREE.Vector3(), to: new THREE.Vector3(), bend: new THREE.Vector3(),
      fireT: 1, side: 1, roared: false, best: Infinity });
  }
  // BURNING DEBRIS — one instanced pool of glowing shards, stretched along their fall
  SK.em = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), 64);
  SK.em.frustumCulled = false; SK.em.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  SK.em.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SK.em.count * 3), 3);
  for (let i = 0; i < SK.em.count; i++) SK.em.setMatrixAt(i, ZERO);
  grp.add(SK.em);
}

/* ---------- spawners ---------- */
function ember(p, v, life = rand(2, 3.5), hot = 1){
  if (SK.embers.length >= SK.em.count) return;
  SK.embers.push({ p: p.clone(), v: v.clone(), t: 0, life, hot, smokeT: rand(0, 0.3) });
}
// debris flung out of a blast: up and away from the fight, so nothing falls into the play space
function debrisBurst(p, n, speed, up){
  centre(_u);
  const ax = p.x - _u.x, az = p.z - _u.z, al = Math.hypot(ax, az) || 1;
  for (let k = 0; k < n; k++){
    const a = Math.atan2(az, ax) + rand(-1.2, 1.2), sp = rand(0.4, 1) * speed;
    ember(p, _w.set(Math.cos(a) * sp, rand(0.5, 1) * up, Math.sin(a) * sp), rand(1.8, 3.4), rand(0.8, 1.2));
  }
}
// a fire left burning on the ground (a wreck, a detonation): a leaning column of smoke for a while
function fire(p, life, size){ SK.fires.push({ p: p.clone().setY(0.5), t: 0, life, size, every: 0.5, next: 0 }); }

/* a ship in the sky takes a hit: it bursts, and its wreck spirals down to crash out past the edge */
function shootDown(m, vel, heavy){
  const p = m.position.clone();
  flash(p, heavy ? 14 : 9, { dur: 0.7, col: 0xffb050, k: 1.3 * flashK(), boom: heavy ? 1.4 : 0.9, lift: 1 });
  debrisBurst(p, heavy ? 8 : 5, 16, 10);
  m.visible = false; m.userData.lost = true;
  const wr = new THREE.Mesh(m.children[0].geometry, shipMat);
  wr.position.copy(p); wr.quaternion.copy(m.quaternion);
  SK.grp.add(wr);
  SK.wrecks.push({ m: wr, v: vel.clone().multiplyScalar(0.65).add(_w.set(0, -2, 0)), spin: new THREE.Vector3(rand(-1, 1), rand(-0.4, 0.4), rand(1.5, 3) * (Math.random() < 0.5 ? -1 : 1)),
    t: 0, trailT: 0, heavy });
}
/* where a wreck falling from p with velocity v (gravity g) would land, to keep crashes out of the play space */
function landing(p, v, g){
  const t = (v.y + Math.sqrt(v.y * v.y + 2 * g * Math.max(1, p.y))) / g;
  return _u.set(p.x + v.x * t, 0, p.z + v.z * t);
}
const GRAV = 13;

/* pick a fighter mid-pass (world/warfront.js flights), or a gunship, to bring down */
function tryShootdown(){
  const cands = [];
  for (const sh of W.ships){
    if (sh.orbit || !(sh.dur > 0)) continue;
    const k = sh.t / sh.dur;
    if (k < 0.15 || k > 0.7) continue;
    _w.subVectors(sh.to, sh.from);
    const sp = _w.length() / sh.dur; _w.normalize().multiplyScalar(sp);
    for (const m of sh.wing) if (m.visible && !m.userData.lost && sh.fl.kind !== 'freighter') cands.push({ m, vel: _w.clone(), heavy: sh.fl.kind === 'dropship' });
  }
  if (Math.random() < 0.35) for (const gs of SK.guns){
    if (!(gs.dur > 0)) continue;
    const k = gs.t / gs.dur;
    if (k < 0.2 || k > 0.6) continue;
    for (const m of gs.wing) if (m.visible && !m.userData.lost) cands.push({ m, vel: gs.vel.clone(), heavy: true });
  }
  for (let tries = 0; tries < 4 && cands.length; tries++){
    const c = cands.splice((Math.random() * cands.length) | 0, 1)[0];
    if (norm(c.m.position) < 1.6) continue;   // never over the fight: the wreck would come down on it
    const v = c.vel.clone().multiplyScalar(0.65).add(_w.set(0, -2, 0));
    const L = landing(c.m.position, v, GRAV);
    if (norm(L) < 1.6 || Math.hypot(L.x - (shared.arenaBig ? camera.position.x : W.cx), L.z - (shared.arenaBig ? camera.position.z : W.cz)) < FAR()) continue;
    // the killing shot: a bolt up from the ground war under it, led to where the ship will be
    const lead = 0.45, at = c.m.position.clone().addScaledVector(c.vel, lead);
    const from = clearOut(at.clone().add(_w.set(rand(-60, 60), 0, rand(-60, 60))).setY(1), 1.5);
    tracer(from, at, Math.random() < 0.5 ? 0xff3a2a : 0x5aff6a, from.distanceTo(at) / lead, 1.4);
    SK.later.push({ t: lead, fn: () => { if (c.m.visible && !c.m.userData.lost) shootDown(c.m, c.vel, c.heavy); } });
    return true;
  }
  return false;
}

/* the big one: a fireball far out on the horizon, a plume climbing out of it, a long heavy rumble */
function heroBlast(){
  const p = new THREE.Vector3();
  centre(_u);
  const a = rand(0, PI * 2), r = rand(FAR() * 1.25, FAR() * 2);
  p.set(_u.x + Math.cos(a) * r, 0, _u.z + Math.sin(a) * r);
  const big = rand(22, 30), fk = flashK();
  flash(p.clone().setY(big * 0.3), big, { dur: 1.2, col: 0xffc060, k: 1.25 * fk, boom: 2.6, smoke: false });
  SK.later.push({ t: 0.18, fn: () => flash(_v.copy(p).setY(big * 0.75), big * 0.8, { dur: 1.0, col: 0xff8030, k: fk, boom: false, smoke: false }) });
  // the plume: a fat stem rising fast, the cap rolling out over it
  for (let k = 0; k < 6; k++) puff(_v.set(p.x + rand(-4, 4), big * 0.2 + k * 4, p.z + rand(-4, 4)), big * rand(0.2, 0.28), rand(7, 10), 9 + k * 1.4);
  for (let k = 0; k < 4; k++) puff(_v.set(p.x + rand(-1, 1) * big * 0.5, big * 1.1, p.z + rand(-1, 1) * big * 0.5), big * rand(0.3, 0.4), rand(7, 10), 7);
  debrisBurst(_v.copy(p).setY(big * 0.4), SK.lvl >= 1 ? 12 : 6, 22, 26);
  fire(p, 12, 0.75);
}

/* ---------- the per-frame update (fx/ambient.js, after the warfront's) ---------- */
export function updateSkywar(dt){
  if (!SK.on || !W.on || !SK.grp || !SK.grp.parent) return;
  const lvl = skywarLevel();
  SK.grp.visible = lvl > 0;
  if (!lvl) return;
  SK.lvl = lvl;
  const e = SK.e, heat = 1 + fightMood() * 1.5, rate = e * lvl * heat;
  SK.t += dt;
  centre(_v); const cx = _v.x, cz = _v.z;
  const anchor = shared.arenaBig ? camera.position : _s.set(cx, 0, cz);
  const ax = anchor.x, az = anchor.z;

  // CAPITAL SHIPS: a slow drift along the sky, broadside on, trading salvos
  for (const c of SK.caps){
    c.a = c.a0 + Math.sin(SK.t * 0.015 + c.bob) * 0.03;   // a slow creep along its stretch of open sky
    const g = c.g;
    g.position.set(ax + Math.cos(c.a) * c.dist, c.alt + Math.sin(SK.t * 0.12 + c.bob) * 2.5, az + Math.sin(c.a) * c.dist);
    // nose along the drift (broadside to the fight), a touch toward the other ship
    const tx = -Math.sin(c.a) * Math.sign(c.drift), tz = Math.cos(c.a) * Math.sign(c.drift);
    g.lookAt(_w.set(g.position.x + tx * 100 - Math.cos(c.a) * 12, g.position.y, g.position.z + tz * 100 - Math.sin(c.a) * 12));
    // rolled a little toward the fight, so the deck and its towers show instead of a flat keel seen from under it
    g.updateMatrixWorld();
    _w.set(ax, 0, az); g.worldToLocal(_w);
    g.rotateZ(-Math.sign(_w.x) * 0.38);
    g.updateMatrixWorld();
    if ((c.fireT -= dt) <= 0){
      c.fireT = rand(1.6, 3.4) / Math.max(0.4, rate);
      const other = SK.caps.find(o => o !== c && o.foe !== c.foe);
      const col = (SK.E.bolts || [0x5aff6a, 0xff4a3a])[c.foe ? 0 : 1];
      const n = lvl >= 1 ? 2 + ((Math.random() * 2) | 0) : 2;
      if (other && Math.random() < 0.75){
        // a salvo across the sky at the other ship; most of it hits
        const hitAt = new THREE.Vector3(rand(-60, 60), rand(-8, 14), rand(-90, 90)).applyMatrix4(other.g.matrixWorld);
        for (let k = 0; k < n; k++){
          const gun = c.guns[(Math.random() * c.guns.length) | 0];
          const from = new THREE.Vector3(...gun).applyMatrix4(g.matrixWorld);
          const to = hitAt.clone().add(_w.set(rand(-1, 1), rand(-0.5, 0.5), rand(-1, 1)).multiplyScalar(18 * other.sc));
          const sp = 260, delay = k * 0.14;
          tracer(from, to, col, sp, 2.4, delay);
          if (Math.random() < 0.7) SK.later.push({ t: delay + from.distanceTo(to) / sp, fn: () => hullHit(other, to) });
        }
      } else {
        // or down into the ground war on the horizon below it
        const to = new THREE.Vector3(g.position.x, 0, g.position.z).lerp(_w.set(ax, 0, az), rand(0.3, 0.55)).add(_u.set(rand(-40, 40), 0, rand(-40, 40)));
        clearOut(to, 2, FAR());
        for (let k = 0; k < n; k++){
          const gun = c.guns[(Math.random() * c.guns.length) | 0];
          const from = new THREE.Vector3(...gun).applyMatrix4(g.matrixWorld), sp = 300, delay = k * 0.16;
          const hit = to.clone().add(_w.set(rand(-14, 14), 0, rand(-14, 14)));
          tracer(from, hit, col, sp, 2.4, delay);
          SK.later.push({ t: delay + from.distanceTo(hit) / sp, fn: () => flash(hit.setY(3), rand(10, 15), { col: 0xffb050, k: flashK(), boom: 0.8 }) });
        }
      }
    }
    // where it's burning: smoke pouring off the hull, a flicker of fire now and then
    for (const b of c.burns){
      if ((b.t -= dt) > 0) continue;
      b.t = rand(0.35, 0.6) / lvl;
      _w.set(...b.at).applyMatrix4(g.matrixWorld);
      puff(_w, rand(7, 11) * c.sc, rand(6, 9), 2);
      if (Math.random() < 0.25) flash(_w, rand(5, 8) * c.sc, { dur: 0.4, col: 0xff8a3a, k: 0.8 * flashK(), boom: false, smoke: false });
    }
  }

  // GUNSHIPS: a low sweep along a flank, banking through a gentle curve, firing out into the war beyond the walls
  const R = maxHalf();
  for (const gs of SK.guns){
    if (!(gs.dur > 0)){
      if ((gs.wait -= dt) > 0) continue;
      const a = rand(0, PI * 2), dx = Math.cos(a), dz = Math.sin(a), side = Math.random() < 0.5 ? -1 : 1, off = side * (R * rand(1.7, 2.8) + 20), Dg = R * 5 + 160;
      const alt = rand(...(SK.E.gunAlt || [26, 40]));
      gs.from.set(cx - dx * Dg - dz * off, alt + rand(4, 10), cz - dz * Dg + dx * off);
      gs.to.set(cx + dx * Dg - dz * off * rand(0.8, 1.2), alt + rand(-4, 8), cz + dz * Dg + dx * off * rand(0.8, 1.2));
      gs.bend.set(-dz * side * R * rand(0.15, 0.4), -rand(2, 6), dx * side * R * rand(0.15, 0.4));   // the curve bows a touch toward the fight, and dips
      gs.dur = gs.from.distanceTo(gs.to) / rand(34, 46); gs.t = 0; gs.side = side; gs.roared = false; gs.best = Infinity;
      gs.lift = Math.max(0, heightNear(gs.from.x - W.cx, gs.from.z - W.cz) + 12 - gs.from.y);
      gs.vel = new THREE.Vector3();
      for (const m of gs.wing){ m.visible = true; m.userData.lost = false; }
    }
    gs.t += dt;
    const k = gs.t / gs.dur, bow = Math.sin(k * PI);
    _v.lerpVectors(gs.from, gs.to, k).addScaledVector(gs.bend, bow);
    // lifting over whatever stands in the way out there (a ridge, a spire, the city's towers), easing back down after
    const k2 = Math.min(1, k + 1.6 / gs.dur), ahead = _u.lerpVectors(gs.from, gs.to, k2).addScaledVector(gs.bend, Math.sin(k2 * PI));   // (and a second and a half ahead)
    // and high enough to show over the skyline from the fight (a walled courtyard's rooftops), as it comes in close
    const dx = _v.x - W.cx, dz = _v.z - W.cz, over = SK.top ? SK.top[binOf(dx, dz)] * Math.hypot(dx, dz) + 4 : 0;
    const need = Math.min(120, Math.max(0, Math.max(heightNear(dx, dz) + 12, heightNear(ahead.x - W.cx, ahead.z - W.cz) + 12, over) - _v.y));
    gs.lift += (need - gs.lift) * Math.min(1, dt * (need > gs.lift ? 1.6 : 0.4));
    _v.y += gs.lift;
    // heading: the path's tangent (the straight line plus the bow's slope)
    _w.subVectors(gs.to, gs.from).addScaledVector(gs.bend, PI * Math.cos(k * PI)).divideScalar(gs.dur);
    gs.vel.copy(_w);
    const dir = _u.copy(_w).normalize();
    const bank = -gs.side * Math.cos(k * PI) * 0.45;   // leaning into the curve
    gs.wing.forEach((m, j) => {
      if (m.userData.lost) return;
      const back = j * 20, lat = j * 14 * -gs.side;
      m.position.set(_v.x - dir.x * back - dir.z * lat, _v.y + j * 3 + Math.sin(SK.t * 1.1 + j) * 0.8, _v.z - dir.z * back + dir.x * lat);
      m.lookAt(_s.copy(m.position).add(dir).setY(m.position.y + dir.y - 0.06));
      m.rotateZ(bank + Math.sin(SK.t * 0.8 + j * 2) * 0.05);
    });
    // the roar as it passes: once a pass, at its nearest to the camera
    const lead = gs.wing[0], d = lead.position.distanceTo(camera.position);
    if (!gs.roared && lead.visible){
      if (d < gs.best) gs.best = d;
      else if (gs.best < 220 && live()){
        gs.roared = true;
        camera.getWorldDirection(_s); const pan = (_s.z * (lead.position.x - camera.position.x) - _s.x * (lead.position.z - camera.position.z)) / Math.max(1, d);
        flyby(gs.best, -pan, true);
      }
    }
    if ((gs.fireT -= dt) <= 0 && k > 0.08 && k < 0.92){
      gs.fireT = rand(0.7, 1.6) / Math.max(0.5, heat * lvl);
      const m = gs.wing[(Math.random() * gs.wing.length) | 0];
      if (m.visible && !m.userData.lost){
        // rockets out the far side, away from the fight
        const ox = m.position.x - cx, oz = m.position.z - cz, ol = Math.hypot(ox, oz) || 1, ahead = rand(50, 90), out = rand(25, 60);
        const hit = clearOut(new THREE.Vector3(m.position.x + dir.x * ahead + ox / ol * out, 0, m.position.z + dir.z * ahead + oz / ol * out), 1.5, FAR() * 0.6), sp = 150;
        for (let r = 0; r < 2; r++) tracer(m.position, hit, 0xffa050, sp, 1.6, r * 0.12);
        SK.later.push({ t: m.position.distanceTo(hit) / sp + 0.12, fn: () => flash(hit.setY(1.5), rand(7, 11), { col: 0xffa040, k: flashK(), boom: 0.7 }) });
      }
    }
    if (k >= 1){ gs.dur = 0; gs.wait = rand(6, 14) / Math.max(0.5, heat * e * lvl); for (const m of gs.wing){ m.visible = false; m.userData.lost = false; } }
  }

  // SHOOTDOWNS, FLAK and the big DETONATION, as often as the fight is hot (none on a quiet world)
  if (e >= 0.7){
    if ((SK.nextDown -= dt) <= 0){
      SK.nextDown = (tryShootdown() ? rand(9, 18) : rand(1.5, 3)) / Math.max(0.4, rate);
    }
    if (SK.fighters && (SK.nextFlak -= dt) <= 0){
      SK.nextFlak = rand(0.35, 0.9) / Math.max(0.3, rate);
      const ships = W.ships.filter(sh => !sh.orbit && sh.dur > 0);
      const sh = ships[(Math.random() * ships.length) | 0];
      if (sh){
        const m = sh.wing[0];
        _w.subVectors(sh.to, sh.from).normalize();
        const p = _v.copy(m.position).addScaledVector(_w, rand(10, 40)).add(_s.set(rand(-25, 25), rand(-10, 14), rand(-25, 25)));
        if (norm(p) > 1.3 && p.y > 25){
          flash(p, rand(3, 5), { dur: 0.3, col: 0xffd890, k: 0.9 * flashK(), boom: false, smoke: false });
          puff(p, rand(2.5, 4), rand(3, 5), 0.4, _c.setHex(0x26262a).clone());
        }
      }
    }
    if ((SK.nextHero -= dt) <= 0){ SK.nextHero = rand(16, 30) / Math.max(0.4, rate); heroBlast(); }
  }

  // timed hits (salvos, rockets, killing shots) landing
  SK.later = SK.later.filter(h => (h.t -= dt) > 0 || (h.fn(), false));

  // WRECKS: tumbling down, trailing fire and smoke, and a crash where they land
  SK.wrecks = SK.wrecks.filter(w => {
    w.t += dt;
    w.v.y -= GRAV * dt;
    w.m.position.addScaledVector(w.v, dt);
    w.m.rotateX(w.spin.x * dt); w.m.rotateY(w.spin.y * dt); w.m.rotateZ(w.spin.z * dt);
    if ((w.trailT -= dt) <= 0){
      w.trailT = (lvl >= 1 ? 0.05 : 0.1);
      const p = w.m.position;
      puff(p, rand(1.4, 2.4) * (w.heavy ? 1.6 : 1), rand(0.4, 0.7), 0, _c.setHex(0xffa040).clone());
      puff(_v.copy(p).add(_s.set(rand(-1, 1), rand(-1, 1), rand(-1, 1))), rand(2.2, 3.4) * (w.heavy ? 1.6 : 1), rand(4, 6), 1.2);
      if (Math.random() < 0.3) ember(p, _s.set(rand(-6, 6), rand(-2, 6), rand(-6, 6)).addScaledVector(w.v, 0.3), rand(1, 2), 0.8);
    }
    const p = w.m.position;
    // safety: one that strays toward the fight bursts in the air instead
    centre(_u);
    if (norm(p) < 1.3 || Math.hypot(p.x - _u.x, p.z - _u.z) < FAR() * 0.7 || w.t > 14){ flash(p, 10, { dur: 0.7, col: 0xffa040, k: flashK(), boom: 1 }); SK.grp.remove(w.m); return false; }
    if (p.y <= 1){
      const big = w.heavy ? rand(22, 30) : rand(15, 20);
      flash(_v.copy(p).setY(big * 0.25), big, { dur: 1, col: 0xffb050, k: 1.2 * flashK(), boom: w.heavy ? 2.2 : 1.6, lift: 5, smokeK: 0.45 });
      debrisBurst(_v.copy(p).setY(2), lvl >= 1 ? 8 : 4, 14, 16);
      fire(p, w.heavy ? 12 : 9, w.heavy ? 0.75 : 0.55);
      SK.grp.remove(w.m);
      return false;
    }
    return true;
  });

  // fires left burning on the ground
  SK.fires = SK.fires.filter(f => {
    f.t += dt;
    if ((f.next -= dt) <= 0){
      f.next = f.every * 1.6 / lvl;
      const fade = 1 - f.t / f.life;
      puff(_v.copy(f.p).add(_s.set(rand(-3, 3), 0, rand(-3, 3))), rand(7, 10) * f.size * (0.5 + fade * 0.5), rand(10, 14), 6);
      if (Math.random() < 0.35 * fade) puff(_v.copy(f.p).add(_s.set(rand(-2, 2), 1, rand(-2, 2))), rand(2, 3.5) * f.size, rand(0.5, 0.9), 2, _c.setHex(0xff9a3a).clone());
    }
    return f.t < f.life;
  });

  // burning debris: falls, cools from yellow-white to a dull red, and trails a wisp of smoke
  let i = 0;
  SK.embers = SK.embers.filter(m => (m.t += dt) < m.life && m.p.y > -1);
  for (const m of SK.embers){
    m.v.y -= 9.8 * dt; m.v.multiplyScalar(1 - dt * 0.15);
    m.p.addScaledVector(m.v, dt);
    const k = m.t / m.life, d = m.p.distanceTo(camera.position), th = Math.max(0.25, d * 0.0035) * m.hot;
    const sp = m.v.length();
    _q.setFromUnitVectors(_s.set(0, 0, 1), _w.copy(m.v).divideScalar(sp || 1));
    SK.em.setMatrixAt(i, _m.compose(m.p, _q, _s.set(th, th, th + sp * 0.06)));
    SK.em.setColorAt(i, _c.setRGB(1, 0.75 - k * 0.5, 0.35 - k * 0.3).multiplyScalar(2.4 * (1 - k * 0.8)));
    if (lvl >= 1 && (m.smokeT -= dt) <= 0){ m.smokeT = rand(0.25, 0.45); puff(m.p, th * 3, rand(1.5, 2.5), 0.5); }
    i++;
  }
  for (; i < SK.em.count; i++) SK.em.setMatrixAt(i, ZERO);
  SK.em.instanceMatrix.needsUpdate = true; SK.em.instanceColor.needsUpdate = true;
}

/* a turbolaser salvo landing on a capital ship's hull: a flash there, and enough of them leave it burning */
function hullHit(c, at){
  flash(at, rand(8, 13) * c.sc, { dur: 0.5, col: 0xffc070, k: flashK(), boom: false, smoke: false });
  if (Math.random() < 0.4) for (let k = 0; k < 2; k++) ember(at, _w.set(rand(-8, 8), rand(-2, 4), rand(-8, 8)), rand(2.5, 4), 1.4);
  c.hits++;
  if (c.burns.length < 3 && c.hits % 6 === 0){
    // where it hit, in the ship's own frame, so the smoke keeps pouring from the same spot as it drifts
    const loc = c.g.worldToLocal(at.clone());
    c.burns.push({ at: [loc.x, loc.y, loc.z], t: 0 });
  }
}

/* for the smoke tests and the console: what the sky war is running right now */
export function skywarInfo(){
  return SK.on ? { level: skywarLevel(), epic: SK.e, capitals: SK.caps.length, gunships: SK.guns.length, flying: SK.guns.filter(g => g.dur > 0).length,
    wrecks: SK.wrecks.length, embers: SK.embers.length, fires: SK.fires.length, caps: SK.caps.map(c => [Math.round(c.g.position.x), Math.round(c.g.position.y), Math.round(c.g.position.z)]),
    top: SK.top ? Array.from(SK.top, t => +t.toFixed(2)) : null, guns: SK.guns.map(g => g.wing[0].position.toArray().map(Math.round)), cam: camera.getWorldDirection(new THREE.Vector3()).toArray() } : null;
}
/* the capture tools: fire the big moments on cue */
export function skywarCue(what){
  if (!SK.on) return false;
  if (what === 'down') return tryShootdown();
  if (what === 'blast'){ heroBlast(); return true; }
  if (what === 'gunships'){ for (const g of SK.guns) if (!(g.dur > 0)) g.wait = 0; return true; }
  return false;
}
export const skywarState = () => Object.assign(SK, { camera, wf: W });   // (the console: the live sky war)
