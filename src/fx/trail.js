// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Lightsaber swing trail, blade motion smear, and the re-ignite flicker on a form change.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, isGunner, enemies, shared } from '../state.js';
import { stance, bladeColor } from '../player/helpers.js';
import { FORM_OF, SWING_STYLE } from '../data/poses.js';
import { fitStaffBlades, saberIsStaff } from '../player/model/weapons.js';
import { solidAt } from '../world/collision.js';
import { S } from '../audio/sfx.js';
import { BLADE_AUDIO } from '../audio/saber.js';
import { spawnHitSpark } from './vfx.js';

/* ---------- saber motion trail ----------
   Every lightsaber in the scene leaves a streak that runs EXACTLY where its blade went: the player's saber, the saber
   staff's far blade, the Darksaber (in hand or thrown), the thrown saber, a foe's or an ally's saber, the boss's
   blade, a co-op partner's. Nothing here knows how a blade is animated. A blade opts in by carrying
   `userData.saberTrail = { hilt: ±1, dark?: 1, always?: 1 }` on its glow mesh (hilt: which end of the mesh's local y
   the emitter is on), and the streak is read off that mesh's real world transform at the end of the frame, after
   every pose, cutscene and camera has run, so it never lags the blade the eye sees.

   ACCURACY: each frame stores the blade as an emitter point, a direction and a length (not two loose points). Between
   frames the emitter follows a centripetal Catmull-Rom curve and the DIRECTION is swung round the sphere the same way
   (renormalised), subdivided by how far the blade turned, so a 90° whip in one frame still draws the round arc the tip
   travelled instead of a straight chord through the middle, and the blade never shrinks mid-cut.

   WHEN: a blade streaks when it moves against its owner's body (tip speed in the owner's own frame, so turning or
   running doesn't smear a held saber); the player's swings always do; a thrown blade (owner tagged trailAlways)
   always does. The leading edge burns white-hot and cools to the blade colour as it fades, banded like the toon ramp.
   Each form leaves its own trail: Ataru short and whippy, Djem So long and heavy, the darksaber a dark cold edge. */
const glowTrailMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true });
// the darksaber can't glow additively (its blade is black): its streak is drawn as ink, a near-black smear with a
// white crackling edge, alpha-blended so the dark actually shows
const darkTrailMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, vertexColors: true });
const TRAIL = {   // life (s) · core (how hot the leading edge burns) · base (how far up the blade the streak reaches full strength)
  shiicho:   { life: 0.22, core: 0.65, base: 0.12 },   // broad, sweeping arcs
  makashi:   { life: 0.11, core: 0.95, base: 0.4 },    // a thin, precise flick
  soresu:    { life: 0.15, core: 0.7, base: 0.25 },
  ataru:     { life: 0.13, core: 0.9, base: 0.35 },
  niman:     { life: 0.17, core: 0.75, base: 0.2 },
  djemso:    { life: 0.24, core: 0.6, base: 0.12 },
  shien:     { life: 0.2, core: 0.7, base: 0.18 },
  juyo:      { life: 0.16, core: 0.95, base: 0.22 },   // hot, ragged streaks
  vaapad:    { life: 0.19, core: 0.8, base: 0.16 },
  staff:     { life: 0.12, core: 0.6, base: 0.42 },
  jarkai:    { life: 0.12, core: 0.85, base: 0.32 },   // two quick streaks, one from each hand: thin and short so the pair stays readable    // two wheeling streaks, one off each end: kept short and thin, or a whirl of both washes the view out
  darksaber: { life: 0.2, core: 0.35, base: 0.15 },
  thrown:    { life: 0.14, core: 0.7, base: 0.1 },     // a spinning disc of light, short so it doesn't swallow the hilt
};
export const TRAIL_TUNE = {
  speedOn: 4, speedFull: 10,   // m/s of tip speed against the owner's body: below speedOn no streak, full by speedFull
  turn: 0.06,                  // rad of blade turn per subdivision (≈3.4°): the arc stays round however fast the cut
  step: 0.06,                  // m of emitter travel per subdivision
  maxSub: 16,                  // subdivisions per frame at most
  jump: 3,                     // m: a blade that moves further than this in one frame was teleported, not swung
  scan: 0.25,                  // s between looks round the scene for blades that have come or gone
  // HOW STRONG every streak is, on top of each form's own shape (TRAIL above): toned down so a cut leaves a quick
  // flick of light near the tip, not a wide sheet that hangs in the air
  life: 0.55,                  // × each form's life: the streak fades this much sooner
  glow: 0.6,                   // × its brightness (the ink streak's opacity, for the Darksaber)
  reach: 0.5,                  // the streak reaches full strength no lower than this far up the blade (0 hilt · 1 tip)
};
const MAXS = 48, MAXP = 420;   // frame samples kept per blade; points drawn per ribbon
const BLADES = new Map();      // glow mesh → its blade state (samples, ribbon)
const POOL = [];
let scanT = 0, tipSpeed = 0;
const owners = new Map();      // a character's group → { e } (a foe or the boss), for its form's trail
const _h = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _l = new THREE.Vector3();
const _c = new THREE.Color(), _cw = new THREE.Color(0xffffff), _col = new THREE.Color();

function makeRibbon(){
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(MAXP * 9), 3).setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.BufferAttribute(new Float32Array(MAXP * 12), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pos); geo.setAttribute('color', col);
  // three rows a point (emitter · where the streak reaches full strength · tip), two quads per row pair
  const idx = new Uint16Array((MAXP - 1) * 12);
  for (let i = 0, o = 0; i < MAXP - 1; i++) for (let r = 0; r < 2; r++){
    const a = i * 3 + r, b = a + 1, c = a + 4, d = a + 3;
    idx[o++] = a; idx[o++] = b; idx[o++] = c; idx[o++] = a; idx[o++] = c; idx[o++] = d;
  }
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, glowTrailMat);
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2; scene.add(mesh);
  return { geo, mesh, pos, col };
}
const ribbon = () => POOL.pop() || makeRibbon();

// the top of a blade's family tree under the scene (the character, or the thrown blade itself); null if detached or hidden
function ownerOf(m){
  let o = m;
  while (o){ if (!o.visible) return null; if (o.parent === scene) return o; o = o.parent; }
  return null;
}
// look round the scene for tagged blades (new foes, a partner, a cutscene's actors) and for who owns them
function scan(){
  const seen = new Set();
  scene.traverse(o => { if (o.userData.saberTrail && o.isMesh) seen.add(o); });
  for (const m of seen) if (!BLADES.has(m)) BLADES.set(m, { m, tag: m.userData.saberTrail, s: [], rib: null, lt: null, owner: null, w: 0 });
  for (const [m, b] of BLADES) if (!seen.has(m) && !b.s.length){ if (b.rib){ b.rib.mesh.visible = false; POOL.push(b.rib); } BLADES.delete(m); }
  owners.clear();
  for (const e of enemies) if (e.group) owners.set(e.group, e);
  if (shared.boss && shared.boss.group) owners.set(shared.boss.group, shared.boss);
}
const formTrail = (f) => TRAIL[FORM_OF[f] || f];

/* ---------- what the blades sound like (read by audio/director.js) ----------
   BLADE_AUDIO (audio/saber.js), filled each frame: how fast each lit blade's tip is moving against its owner's body (m/s), so the hum bends with the blade
   the eye sees rather than with a swing timer: hero = the hero's saber, hero2 = the saber staff's far end, dark = the
   Darksaber in hand. others = every other lit blade (a foe's, the boss's, a co-op partner's, an ally's, a cutscene
   actor's): its tip in the world, its speed, whether it's dark or thrown. */
const _otherPool = [];
/* the hero's blade cutting through a wall, a pillar or a crate (anything solid above the feet, so a low guard never
   sizzles on the floor): a sizzling scrape and a spit of sparks where it bites, repeating while it stays in */
let wallIn = false, wallT = 0;
const _w = new THREE.Vector3();
function wallContact(b, sp, dt, len){
  if (sp < TRAIL_TUNE.speedOn * 0.75) return false;
  const feet = player.group.position.y + 0.3;
  for (const f of [1, 0.8, 0.6]){
    _w.copy(_h).addScaledVector(_d, f * len);
    if (_w.y > feet && solidAt(_w.x, _w.y, _w.z)){
      wallT -= dt;
      if (!wallIn || wallT <= 0){
        S.saberWall(_w.clone(), !wallIn, !!b.tag.dark);
        spawnHitSpark(_w.clone(), b.tag.dark ? 0xd9ccff : 0xfff1c4, wallIn ? 0.35 : 0.7);
        wallT = 0.11;
      }
      return true;
    }
  }
  return false;
}

// one blade's emitter (h), unit direction (d) and length, off its mesh's world transform; false if it isn't lit
function bladeLine(b){
  const m = b.m, g = m.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  m.updateWorldMatrix(true, false);
  const lo = b.tag.hilt > 0 ? bb.max.y : bb.min.y, hi = b.tag.hilt > 0 ? bb.min.y : bb.max.y;
  _h.set(cx, lo, cz).applyMatrix4(m.matrixWorld);
  _t.set(cx, hi, cz).applyMatrix4(m.matrixWorld);
  _d.subVectors(_t, _h);
  const len = _d.length();
  if (len < 0.25) return 0;   // stowed (shrunk to nothing) or still igniting from the emitter
  _d.divideScalar(len);
  return len;
}

export function updateTrail(dt){
  updateBladeFX(dt);
  if (!(dt > 0)) return;   // paused: the streaks hold where they are
  if ((scanT -= dt) <= 0){ scanT = TRAIL_TUNE.scan; scan(); }
  const swinging = player.atkT > 0 || player.darkT > 0;
  const riposte = player.swing && player.swing.riposte;
  // (the saber staff's whirl between cuts draws no streak: both blades wheeling a full turn in a few frames would fan
  // two great additive sheets across the view; the streaks pick up again as the cut itself comes through)
  const sw = player.swing, whirl = swinging && sw && sw.spin && sw.spin.twirl && sw.t < sw.dur * SWING_STYLE.staff.ts && saberIsStaff(player);
  tipSpeed = 0;
  const BA = BLADE_AUDIO;
  BA.hero = BA.hero2 = BA.dark = 0;
  for (const o of BA.others) _otherPool.push(o);
  BA.others.length = 0;
  let touching = false;
  for (const b of BLADES.values()){
    for (const p of b.s) p.age += dt;
    const owner = ownerOf(b.m);
    const len = owner ? bladeLine(b) : 0;
    const mine = owner === player.group;
    // this blade's look: its form's streak, its colour
    const dark = !!b.tag.dark;
    b.cfg = dark ? TRAIL.darksaber
      : owner && owner.userData.trailAlways ? TRAIL.thrown
      : mine ? (formTrail(G.stance) || TRAIL.niman)
      : (owners.has(owner) && formTrail(owners.get(owner).ff)) || TRAIL.niman;
    while (b.s.length && b.s[0].age > b.cfg.life * TRAIL_TUNE.life) b.s.shift();
    if (len){
      if (b.gap){ b.s.length = 0; b.gap = false; }   // lit again after being put away: a fresh streak, not a bridge
      const last = b.s[b.s.length - 1];
      // a jump (a respawn, a re-mount, a blade drawn somewhere else, a re-ignite) starts a fresh streak too
      if (last && (last.h.distanceTo(_h) > TRAIL_TUNE.jump || Math.abs(last.len - len) > 0.3 * len)) b.s.length = 0;
      // how fast the tip is moving against its owner's body
      _l.copy(_t); owner.worldToLocal(_l);
      const sp = b.lt && b.owner === owner ? b.lt.distanceTo(_l) / dt : 0;
      b.lt = (b.lt || new THREE.Vector3()).copy(_l); b.owner = owner;
      const T = TRAIL_TUNE;
      let w = Math.min(1, Math.max(0, (sp - T.speedOn) / (T.speedFull - T.speedOn)));
      if (owner.userData.trailAlways || (mine && swinging)) w = 1;
      if (mine && whirl) w = 0;
      if (mine && player.blade && b.m === player.blade.glow) tipSpeed = sp;   // the blade's motion smear (updateBladeFX)
      // the hum follows the blade (audio/director.js)
      if (mine){
        if (dark) BA.dark = Math.max(BA.dark, sp);
        else if (player.blade && b.m === player.blade.glow) BA.hero = sp;
        else BA.hero2 = Math.max(BA.hero2, sp);
        if (!touching && G.mode === 'play') touching = wallContact(b, sp, dt, len);
      } else {
        const o = _otherPool.pop() || { tip: new THREE.Vector3() };
        o.tip.copy(_t); o.sp = sp; o.dark = dark; o.thrown = !!owner.userData.trailAlways;
        BA.others.push(o);
      }
      b.s.push({ h: _h.clone(), d: _d.clone(), len, age: 0, w });
      if (b.s.length > MAXS) b.s.shift();
      // nothing streaking: keep only this frame's blade, so the next streak starts from where the blade really was
      if (!b.s.some(p => p.w > 0)) b.s.splice(0, b.s.length - 1);
      (b.color || (b.color = new THREE.Color())).setHex(dark ? 0xd9ccff
        : mine ? (riposte ? 0xffe27a : bladeColor())   // a riposte cuts a brilliant GOLD arc
        : b.m.material.color.getHex());
    } else { b.lt = null; b.gap = true; }
    drawBlade(b);
  }
  if (!touching){ wallIn = false; wallT = 0; } else wallIn = true;
}

// a blade's streak: its frame samples, densified round the arc, drawn as a three-row ribbon
const _pa = [], _H = new THREE.Vector3(), _D = new THREE.Vector3();
/* CENTRIPETAL Catmull-Rom (Barry-Goldman, alpha ½) through p1 → p2 at u ∈ [0, 1]. Unlike the uniform kind it doesn't
   overshoot or loop where the samples bunch up and spread out, which is every saber cut: slow chamber, a strike that
   covers a metre a frame, a braking follow-through. Measured against a blade recorded at 240 fps, it (on the emitter
   and the blade's direction, the blade kept rigid) halves how far the streak strays from the real path at 30 fps. */
const _A1 = new THREE.Vector3(), _A2 = new THREE.Vector3(), _A3 = new THREE.Vector3(), _B1 = new THREE.Vector3(), _B2 = new THREE.Vector3(), _P0 = new THREE.Vector3(), _P3 = new THREE.Vector3();
function ccr(p0, p1, p2, p3, u, out){
  const k = (a, b) => Math.max(1e-4, Math.sqrt(a.distanceTo(b)));
  if (p0 === p1) p0 = _P0.copy(p1).multiplyScalar(2).sub(p2);   // the ends: mirror a point past them
  const t1 = k(p0, p1), t2 = t1 + k(p1, p2), t3 = t2 + (p3 === p2 ? k(p1, p2) : k(p2, p3)), t = t1 + (t2 - t1) * u;
  const q3 = p3 === p2 ? _P3.copy(p2).multiplyScalar(2).sub(p1) : p3;
  const mix = (o, a, b, ta, tb) => o.copy(a).multiplyScalar((tb - t) / (tb - ta)).addScaledVector(b, (t - ta) / (tb - ta));
  mix(_A1, p0, p1, 0, t1); mix(_A2, p1, p2, t1, t2); mix(_A3, p2, q3, t2, t3);
  mix(_B1, _A1, _A2, 0, t2); mix(_B2, _A2, _A3, t1, t3);
  return mix(out, _B1, _B2, t1, t2);
}
function drawBlade(b){
  const S = b.s;
  if (S.length < 2 || !S.some(p => p.w > 0)){
    if (b.rib){ b.rib.mesh.visible = false; POOL.push(b.rib); b.rib = null; }
    return;
  }
  const R = b.rib || (b.rib = ribbon());
  R.mesh.material = b.tag.dark ? darkTrailMat : glowTrailMat;
  R.mesh.visible = true;
  // DENSIFY: between frame samples, the emitter on a centripetal Catmull-Rom curve and the blade's direction swung
  // round the sphere on one too (renormalised), as finely as the blade turned, so the tip draws the arc it really
  // travelled, not the chord, and the blade keeps its length through the cut
  let n = 0;
  const T = TRAIL_TUNE, n0 = S.length;
  const add = (h, d, len, age, w) => {
    if (n >= MAXP) return;
    const p = _pa[n] || (_pa[n] = { h: new THREE.Vector3(), d: new THREE.Vector3(), len: 0, age: 0, w: 0 });
    p.h.copy(h); p.d.copy(d); p.len = len; p.age = age; p.w = w; n++;
  };
  for (let i = 0; i < n0 - 1; i++){
    const p0 = S[Math.max(0, i - 1)], p1 = S[i], p2 = S[i + 1], p3 = S[Math.min(n0 - 1, i + 2)];
    const ang = Math.acos(Math.max(-1, Math.min(1, p1.d.dot(p2.d))));
    const sub = Math.min(T.maxSub, Math.max(1, Math.ceil(ang / T.turn), Math.ceil(p1.h.distanceTo(p2.h) / T.step)));
    for (let s = 0; s < sub; s++){
      const t = s / sub;
      ccr(p0.h, p1.h, p2.h, p3.h, t, _H);
      ccr(p0.d, p1.d, p2.d, p3.d, t, _D);
      if (_D.lengthSq() < 1e-6) _D.copy(p1.d).lerp(p2.d, t);
      _D.normalize();
      add(_H, _D, p1.len + (p2.len - p1.len) * t, p1.age + (p2.age - p1.age) * t, p1.w + (p2.w - p1.w) * t);
    }
  }
  const pl = S[n0 - 1]; add(pl.h, pl.d, pl.len, pl.age, pl.w);
  const pos = R.pos.array, col = R.col.array, cfg = b.cfg, dark = !!b.tag.dark, base = Math.max(cfg.base, TRAIL_TUNE.reach);
  const life = cfg.life * TRAIL_TUNE.life, glow = TRAIL_TUNE.glow;
  const band = (x) => Math.ceil(x * 4) / 4;   // the fade is QUANTISED into cel bands, so the streak reads as flat painted arcs
  let o = 0, c = 0;
  for (let i = 0; i < n; i++){
    const p = _pa[i];
    // emitter · the point the streak reaches full strength · tip
    for (const f of [0, base, 1]){ pos[o++] = p.h.x + p.d.x * p.len * f; pos[o++] = p.h.y + p.d.y * p.len * f; pos[o++] = p.h.z + p.d.z * p.len * f; }
    // brightness by AGE, not by place in the list (the subdivisions crowd where the blade moved most): the newest
    // couple of frames burn white, then the streak cools down the bands to nothing
    const fa = Math.max(0, 1 - p.age / life);
    const k = band(fa * fa * fa * p.w) * glow;
    const hot = Math.pow(fa, 7) * p.w * cfg.core > 0.3 ? 1 : 0;   // a hard white leading edge, not a soft blend
    let a = 1;
    if (dark){ _c.setRGB(0.05, 0.04, 0.08).lerp(_cw, hot); a = k; }
    else _c.copy(b.color).multiplyScalar(k).lerp(_cw, hot * 0.85 * glow * (k > 0 ? 1 : 0));
    // the emitter row fades to nothing, so the streak grows out of the hilt instead of a hard line along it
    if (dark){ col[c++] = _c.r; col[c++] = _c.g; col[c++] = _c.b; col[c++] = 0; }
    else { col[c++] = 0; col[c++] = 0; col[c++] = 0; col[c++] = 1; }
    for (let r = 0; r < 2; r++){ col[c++] = _c.r; col[c++] = _c.g; col[c++] = _c.b; col[c++] = a; }
  }
  R.pos.needsUpdate = true; R.col.needsUpdate = true;
  R.geo.setDrawRange(0, (n - 1) * 12);
}
// for tests and tuning: every blade the trail is following and its streak
export const trailInfo = () => [...BLADES.values()].map(b => ({ name: b.m.name || b.m.parent?.name || '', samples: b.s.length, drawn: !!(b.rib && b.rib.mesh.visible), w: b.s.length ? b.s[b.s.length - 1].w : 0 }));

/* ---------- blade FX ----------
   • motion smear: the glow sheath swells with tip speed mid-cut, so a fast stroke reads as a smear of light
   • re-ignite: changing form retracts and re-extends the blade (snap-hiss) instead of a silent recolour */
let igniteT = 0;
const IGNITE = 0.24;
export function reigniteBlade(){ igniteT = IGNITE; }
/* IGNITE / RETRACT (player/holster.js toggleBlade): the blade runs up out of the emitter (fast out, settling at full
   length) or sucks back down into it (slow to start, snapping into the hilt), the Jedi saber, the saber staff's far
   blade with it, and the Mando's Darksaber alike. extE is how far out it is (1 = full); `done` runs when it gets there. */
const EXT = { up: 0.2, down: 0.26 };
let extE = 1, extDir = 0, extDone = null;
export function extendBlade(dir, done){
  if (!dir){ extE = 1; extDir = 0; extDone = null; applyExt(); return; }   // stop where it is and stand at full length
  if (dir > 0 && extDir === 0) extE = 0;   // lighting from dark (mid-retract, it turns round where it is)
  extDir = dir; extDone = done || null; igniteT = 0;
  applyExt();
}
export const bladeExtending = () => extDir !== 0;
// how far out a blade looks for extE e going up (dir > 0: fast out, settling) or down (slow to start, snapping in)
export const extShown = (e, dir) => Math.max(0.02, dir > 0 ? 1 - Math.pow(1 - e, 3) : e >= 1 ? 1 : 1 - Math.pow(1 - e, 2));
// any hero's blade at length s (1 = full): the saber (scaled by len) or the Darksaber. A co-op partner's puppet
// uses it too (net/pose.js), so their blade slides out and back the way yours does
export function fitBlade(hero, s, dark, len = 1){
  if (dark){
    const D = hero.darkBlades;   // [glow, edge, blade]: the glow and edge centred on the blade, the black core from its base
    if (D){ D[0].scale.y = D[1].scale.y = D[2].scale.y = s; D[0].position.y = 0.07 + 0.65 * s; D[1].position.y = 0.1 + 0.62 * s; }
  } else if (hero.blade) setBladeLen(hero.blade, len * s);
}
function applyExt(){
  fitBlade(player, extShown(extE, extDir), isGunner(), stance().bladeLen || 1);
}
function stepExt(dt){
  if (!extDir) return;
  extE = Math.min(1, Math.max(0, extE + extDir * dt / (extDir > 0 ? EXT.up : EXT.down)));
  applyExt();
  if (extE <= 0 || extE >= 1){
    const d = extDone; extDir = 0; extDone = null;
    if (d) d();
    if (extE <= 0){ extE = 1; applyExt(); extE = 0; }   // (hidden now: put the meshes back to full length for whoever shows them next)
  }
}
function updateBladeFX(dt){
  stepExt(dt);
  const B = player.blade;
  if (!B) return;
  const len = stance().bladeLen || 1;
  if (extDir){ /* the ignite / retract above has the length */ }
  else if (igniteT > 0){
    igniteT = Math.max(0, igniteT - dt);
    const k = 1 - igniteT / IGNITE;
    const ext = k < 0.35 ? 1 - k / 0.35 : (k - 0.35) / 0.65;          // retract, then extend (eased)
    const e = Math.max(0.02, ext < 1 ? 1 - Math.pow(1 - ext, 3) : 1);
    setBladeLen(B, len * e);
  } else if (B.blade.scale.y !== len && !isGunner()) setBladeLen(B, len);
  const smear = 1 + Math.min(0.9, tipSpeed * 0.025);
  const sx = B.glow.scale.x + (smear - B.glow.scale.x) * Math.min(1, dt * 18);
  B.glow.scale.x = B.glow.scale.z = sx;
}
// the blade meshes are centred on y≈0.95; keep the hilt end fixed as the length changes
function setBladeLen(B, s){
  B.blade.scale.y = s; B.glow.scale.y = s;
  B.blade.position.y = 0.17 + 0.78 * s; B.glow.position.y = 0.15 + 0.8 * s;
  fitStaffBlades(B.blade, B.glow, B.staff, s);   // the saber staff's far blade stays on its own emitter
}
