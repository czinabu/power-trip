// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SWING MARKER — Jedi Academy style: on each foe the next saber cut will reach, a glowing slash shows WHERE on its body
// the blade will land and HOW: at the height you aim (high at the head and shoulders, middle across the chest, low at the
// legs: player/jedi/cutaim.js cutHeight) and at the cut's angle on the clock as you see it, thick and bright where the
// blade comes in, tapering to a point where it leaves, with a pulse running the way it travels. A thrust is a point; a
// spinning finisher a level line. It flips with the combo, the keys and the mouse flick, because it reads the same pick
// the swing will (pickCut). Who it reaches follows the swing's own reach: the form's blade, the step and the lunge onto the
// nearest foe in front (combat.js tryAttack). The foe the lunge closes on is brightest. Nothing in reach, nothing shows;
// never in cutscenes. Settings · SWING MARKER turns it off (G.swingMarker). Local to each player: every browser draws its
// own hero's.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { CFG } from '../data/config.js';
import { SWING_PATTERNS } from '../data/stances.js';
import { SWING_STYLE } from '../data/poses.js';
import { shared, G, enemies, player, isGunner } from '../state.js';
import { stance, bladeColor } from '../player/helpers.js';
import { pickCut } from '../player/jedi/cutaim.js';
import { bodyRadius, bodyHeight, headPos, chestPos } from '../enemies/bodyshape.js';

/* the numbers. blade: how far the blade reaches round the hero through a cut, per metre of blade length (measured in
   the sandbox, every form in both grips: the tip crosses the front about 2.1 m out, a thrust's point ~0.6 m further, the
   step into the cut on top). half: how far either side of the cut's line it sweeps (degrees). len / wide: the slash on
   the body (m, scaled with the foe). fade: how fast it comes and goes. */
export const SWING_MARK = {
  blade: 2.05, thrust: 0.6, fade: 9, max: 4,
  half: { side: 78, overhead: 22, thrust: 18, back: 74 },
  len: 1.3, wide: 0.34, point: 0.5, front: 0.2,
};
const D2R = Math.PI / 180, GROUND_DRAG = 9;

/* ---------- the slash: a quad drawn as a blade stroke ---------- */
const slashMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false,
  uniforms: { uCol: { value: new THREE.Color(0x66ccff) }, uOp: { value: 0 }, uT: { value: 0 }, uPoint: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform vec3 uCol; uniform float uOp, uT, uPoint; varying vec2 vUv;
    void main(){
      vec3 dark = vec3(0.02, 0.03, 0.06);
      if (uPoint > 0.5){
        // a thrust: where the point goes in, a bright core in a ring that closes on it
        vec2 q = vUv * 2.0 - 1.0; float r = length(q);
        float core = exp(-pow(r / 0.16, 2.0));
        float ringR = mix(0.95, 0.35, fract(uT * 1.6));
        float ring = exp(-pow((r - ringR) / 0.07, 2.0)) * 0.8;
        float halo = exp(-pow((r - 0.72) / 0.12, 2.0)) * 0.35;
        float a = (core + ring + halo) * uOp * smoothstep(1.0, 0.9, r);
        float d = exp(-pow((r - 0.2) / 0.12, 2.0)) * 0.45 * uOp;
        vec3 c = mix(uCol, vec3(1.0), core * 0.7);
        gl_FragColor = vec4(mix(c, dark, d / max(a + d, 1e-3)), clamp(a + d, 0.0, 1.0));
        return;
      }
      // x: 0 where the blade comes in, 1 where it leaves; y across the stroke
      float x = vUv.x, y = abs(vUv.y - 0.5) * 2.0;
      float w = mix(1.25, 0.08, pow(x, 0.8));          // thick at the entry, tapering to a point
      float ends = smoothstep(0.0, 0.08, x) * smoothstep(1.0, 0.94, x);
      float core = exp(-pow(y / (0.2 * w), 2.0));
      float glow = exp(-pow(y / (0.8 * w), 2.0)) * 0.5;
      float lead = mix(1.15, 0.35, x);
      float band = exp(-pow((x - fract(uT * 1.5)) / 0.08, 2.0)) * exp(-pow(y / (0.6 * w), 2.0)) * 0.7;
      float a = ((core + glow) * lead + band) * ends * uOp;
      float d = exp(-pow(y / (0.95 * w), 2.0)) * 0.55 * ends * uOp;   // a dark edge, so it reads on a pale foe or wall
      vec3 c = mix(uCol, vec3(1.0), core * 0.65 + band * 0.3);
      gl_FragColor = vec4(mix(c, dark, d / max(a + d, 1e-3) * (1.0 - core)), clamp(a + d, 0.0, 1.0));
    }`,
});
const quad = new THREE.PlaneGeometry(1, 1);
const slashes = [];
for (let i = 0; i < SWING_MARK.max; i++){
  const m = new THREE.Mesh(quad, slashMat());
  m.matrixAutoUpdate = false; m.frustumCulled = false; m.renderOrder = 20; m.visible = false;
  scene.add(m); slashes.push({ mesh: m, foe: null, op: 0, ang: 0 });
}

/* ---------- what the next cut is, and what it will reach ---------- */
// the cut a press right now would throw (combat.js tryAttack, without spending it): the combo step, the pattern, the lunge
function nextCut(){
  const st = stance(), sw = player.swing;
  if (player.atkT > 0 && sw) return { step: sw.step, pat: sw.pat, dir: sw.dir, h: sw.h, back: sw.back, rip: sw.riposte, fin: sw.step === 2 && sw.dir === 'neutral' && !sw.riposte, spin: !!sw.spin };
  const step = (G.gt - player.lastAtkEnd < 0.9 * (st.comboGap || 1)) ? (player.comboStep + 1) % 3 : 0;
  if (player.riposteT > 0) return { step, pat: SWING_PATTERNS.forward, dir: 'forward', rip: true };
  const c = pickCut(step, false);
  return { step, pat: c.pat, dir: c.dir, h: c.h, back: c.dir === 'back', fin: step === 2 && c.dir === 'neutral' };
}
/* the cut's sweep round the hero (what it can reach): its centre line (radians off the view's heading), how wide either
   side, and whether it goes all the way round */
function cutShape(cut){
  const H = SWING_MARK.half, style = SWING_STYLE[G.stance] || SWING_STYLE.niman;
  if (cut.back) return { yaw: Math.PI, half: H.back * D2R, dir: 0, full: false };
  if (cut.fin && style.finisher.spin) return { yaw: 0, half: Math.PI, dir: 1, full: true };
  let id = cut.rip ? 'forward' : cut.fin ? style.finisher.pattern : cut.pat.id;
  if (cut.spin) return { yaw: 0, half: Math.PI, dir: 1, full: true };
  if (id === 'thrust') return { yaw: 0, half: H.thrust * D2R, dir: 0, full: false, thrust: true };
  if (id === 'forward' || id === 'back') return { yaw: 0, half: H.overhead * D2R, dir: 0, full: false };
  if (cut.pat.ang != null && !cut.fin && !cut.rip){
    // an angle cut: ang 0 comes in from the right and sweeps to the left, 90 is an overhead, 270 a rising cut
    const c = Math.cos(cut.pat.ang * D2R), w = Math.min(1, Math.abs(c) * 1.25);
    const half = (H.overhead + (H.side - H.overhead) * w) * D2R;
    // u runs from the hero's right (u 0, local -x … the sector's start) to his left; a cut from the right travels toward u 1
    return { yaw: 0, half, dir: w > 0.3 ? (c > 0 ? 1 : -1) : 0, full: false };
  }
  // a keyed side sweep (the finisher's backhand, a strafe cut): SWING_PATTERNS right sweeps toward the right
  if (id === 'right' || id === 'rightHigh' || id === 'rightLow' || id === 'riseR' || id === 'diagR') return { yaw: 0, half: H.side * D2R, dir: -1, full: false };
  return { yaw: 0, half: H.side * D2R, dir: 1, full: false };
}
const bladeReach = (shape) => SWING_MARK.blade * (stance().bladeLen || 1) + (shape.thrust ? SWING_MARK.thrust : 0);
function lungeOf(cut){
  const st = stance();
  if (cut.rip) return 2.0;
  return ((cut.step === 2 && st.finisherLunge) ? st.finisherLunge : st.lunge) * (cut.pat.lunge || 1);
}

const hits = [];
/* what the cut will reach: the foe the lunge closes on (combat.js tryAttack: the nearest in front, within the form's
   range) and everything else within the blade's reach from where the step leaves the hero, inside the cut's sweep */
function predict(cut, shape, yaw){
  const st = stance(), pp = player.group.position, fx = Math.sin(yaw), fz = Math.cos(yaw);
  const lunge = lungeOf(cut), blade = bladeReach(shape);
  // the lunge target, exactly as tryAttack picks it (a back strike doesn't lunge)
  let tgt = null, td = st.reach?.range ?? CFG.player.comboRange;
  if (!cut.back){
    for (const e of enemies){
      if (e.dead || e.converted || e.state === 'spawn') continue;
      const dx = e.group.position.x - pp.x, dz = e.group.position.z - pp.z, d = Math.hypot(dx, dz);
      if (d > td || d < 0.01 || (dx * fx + dz * fz) / d < 0.6) continue;
      td = d; tgt = e;
    }
  }
  // the step: toward the target (closing the gap, up to the form's lungeMax), or straight on
  let sx = fx, sz = fz, step = player.grounded ? 7 * lunge / GROUND_DRAG : 0;
  if (cut.back) step = 0;
  if (tgt){
    const dx = tgt.group.position.x - pp.x, dz = tgt.group.position.z - pp.z;
    sx = dx / td; sz = dz / td;
    step = td > 2.2 ? lunge * Math.min(td - 1.8, st.reach?.lungeMax ?? CFG.player.lungeMax) / 0.18 / GROUND_DRAG : 0;
  }
  const ox = pp.x + sx * step, oz = pp.z + sz * step;   // where the hero will be as the blade comes through
  hits.length = 0;
  const reachUp = 2.2;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    const p = e.group.position;
    if (Math.abs(p.y - pp.y) > reachUp) continue;
    const r = bodyRadius(e);
    const dx = p.x - ox, dz = p.z - oz, d = Math.hypot(dx, dz);
    if (d - r > blade) continue;
    if (!shape.full && d > r){
      const lx = dx * Math.cos(yaw + shape.yaw) - dz * Math.sin(yaw + shape.yaw);   // (rotate into the cut's frame)
      const lz = dx * Math.sin(yaw + shape.yaw) + dz * Math.cos(yaw + shape.yaw);
      const off = Math.abs(Math.atan2(lx, lz));
      if (off > shape.half + Math.asin(Math.min(1, r / d))) continue;
    }
    hits.push(e);
  }
  const B = shared.boss;
  if (B && B.hp > 0 && Math.hypot(B.group.position.x - ox, B.group.position.z - oz) - 0.75 <= blade) hits.push(B);
  return { tgt };
}

/* ---------- the slash on the body ---------- */
/* the cut's angle on the clock as the hero sees it, where it comes FROM (0 from the right, 90 from above, 180 from the
   left, 270 from below), or null for a thrust (a point) */
const KEYED = { left: 0, right: 180, forward: 90, back: 270, diagL: 45, diagR: 135, leftHigh: 0, rightHigh: 180, leftLow: 0, rightLow: 180, riseL: 315, riseR: 225 };
function cutAngle(cut){
  const style = SWING_STYLE[G.stance] || SWING_STYLE.niman;
  if (cut.rip) return 90;   // the riposte: a committed overhead
  if (cut.fin){ const id = style.finisher.pattern; return id === 'thrust' ? null : KEYED[id] ?? 180; }
  if (cut.back) return 180;   // the back strike whirls the blade round behind, level
  if (cut.pat.id === 'thrust') return null;
  if (cut.pat.ang != null) return cut.pat.ang;
  return KEYED[cut.pat.id] ?? 180;
}
// how high on the foe it lands: the height you aimed (a riposte and an overhead come down on the head and shoulders)
const _h = new THREE.Vector3(), _c = new THREE.Vector3();
function landY(e, h){
  if (e === shared.boss){ const y = e.group.position.y; return y + (h === 'high' ? 2.7 : h === 'low' ? 0.9 : 1.9); }
  headPos(e, _h); chestPos(e, _c);
  if (h === 'high') return _c.y + (_h.y - _c.y) * 0.75;
  if (h === 'low') return e.group.position.y + bodyHeight(e) * 0.3;
  return _c.y;
}
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _p = new THREE.Vector3();
function placeSlash(s, e, ang, h, pp){
  const p = e.group.position, r = e === shared.boss ? 0.8 : bodyRadius(e), k = e === shared.boss ? 1.6 : Math.max(0.8, (e.group.scale.x || 1));
  let dx = p.x - pp.x, dz = p.z - pp.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  // through the body's middle, square to the hero (drawn over the body: on the near face it sank below the height it
  // marks, seen from the lens up behind the hero)
  _p.set(p.x - dx * r * SWING_MARK.front, landY(e, h), p.z - dz * r * SWING_MARK.front);
  _z.set(-dx, 0, -dz);
  const U = s.mesh.material.uniforms;
  if (ang == null){
    U.uPoint.value = 1;
    const sz = SWING_MARK.point * k;
    _x.set(-dz, 0, dx).multiplyScalar(sz); _y.set(0, sz, 0);
  } else {
    U.uPoint.value = 0;
    // the hero's right as he faces the foe, and up: the entry end sits at `ang` on that clock, the stroke runs across
    const a = ang * D2R, c = Math.cos(a), sn = Math.sin(a), rx = -dz, rz = dx;
    const L = SWING_MARK.len * k * (Math.abs(sn) > 0.9 ? 0.85 : 1);
    _x.set(-(c * rx), -sn, -(c * rz)).normalize();         // entry → exit
    _y.crossVectors(_z, _x).normalize().multiplyScalar(SWING_MARK.wide * k);
    _x.multiplyScalar(L);
  }
  _m.makeBasis(_x, _y, _z.clone().multiplyScalar(1)).setPosition(_p);
  s.mesh.matrix.copy(_m); s.mesh.matrixWorldNeedsUpdate = true;
}

let shownAny = 0, last = { ang: null, h: 'mid', hits: 0 };
// is the marker up right now (the HUD reads it: the free-aim dot steps back while a slash shows on a foe)
export const swingMarkerOn = () => shownAny > 0.05;
// the marker's live read, for tests: who it says the cut reaches, the angle it comes from and the height it lands
export const swingMarkInfo = () => ({ on: swingMarkerOn(), hits: last.hits, ang: last.ang, h: last.h,
  shown: slashes.filter(s => s.mesh.visible).length });

/* ---------- per frame ---------- */
export function updateSwingMarker(dt){
  const pp = player.group.position;
  const able = G.swingMarker !== false && G.mode === 'play' && !G.cutscene && !G.paused && !G.skillSelect && !G.sbMenu && !G.sbPlan && !isGunner() && !player.holstered
    && !shared.saberProj && !player.blockHeld && !(player.hp <= 0) && !player.downed && !player.hang && !player.mantle && player.judgeT <= 0 && player.mendT <= 0;
  hits.length = 0;
  let ang = null, h = 'mid', tgt = null;
  if (able){
    const cut = nextCut(), shape = cutShape(cut);
    tgt = predict(cut, shape, G.yaw).tgt;
    ang = cutAngle(cut);
    h = cut.rip || (cut.fin && ang === 90) ? 'high' : cut.h || 'mid';
    if (ang === 90 && h === 'low') h = 'mid';   // an overhead can't come in under the belt
    hits.sort((a, b) => (a === tgt ? -1 : b === tgt ? 1 : 0));
  }
  last = { ang, h, hits: hits.length };
  const t = performance.now() / 1000, col = bladeColor(stance());
  // keep each slash on the foe it was on, so it fades out where it was rather than jumping
  for (const s of slashes){
    const want = s.foe && hits.includes(s.foe) ? (s.foe === tgt || hits.length === 1 ? 1 : 0.6) : 0;
    s.op += (want - s.op) * Math.min(1, SWING_MARK.fade * dt);
    if (want === 0 && s.op < 0.02){ s.op = 0; s.foe = null; }
  }
  for (const e of hits){
    if (slashes.some(s => s.foe === e)) continue;
    const free = slashes.find(s => !s.foe); if (free){ free.foe = e; free.op = 0; }
  }
  shownAny = 0;
  for (const s of slashes){
    const e = s.foe, alive = e && (e === shared.boss ? e.hp > 0 : !e.dead);
    s.mesh.visible = !!alive && s.op > 0.01;
    if (!s.mesh.visible){ if (!alive) { s.foe = null; s.op = 0; } continue; }
    if (able) { s.ang = ang; s.h = h; }
    placeSlash(s, e, s.ang, s.h || 'mid', pp);
    const U = s.mesh.material.uniforms;
    U.uOp.value = s.op; U.uT.value = t * (player.atkT > 0 ? 1.6 : 1); U.uCol.value.setHex(col);
    shownAny = Math.max(shownAny, s.op);
  }
}
