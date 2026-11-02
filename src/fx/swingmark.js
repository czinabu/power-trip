// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SWING MARKER — the Jedi's crosshair for the blade: a faint arc on the floor where the next saber cut will land. It is
// as long as the form's real reach (the blade's sweep plus the step into the cut, longer when the lunge will close on a
// foe), as wide as the cut sweeps (a side cut wide, an overhead or a thrust narrow, a spinning finisher all the way
// round), and a band runs across it the way the blade will travel, so it flips with the combo. A foe the cut will reach
// gets a ring at its feet and the arc lights up. It fades out with nothing near, and in cutscenes. Settings · SWING
// MARKER turns it off (G.swingMarker). Local to each player: every browser draws its own hero's.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { CFG } from '../data/config.js';
import { SWING_PATTERNS } from '../data/stances.js';
import { SWING_STYLE } from '../data/poses.js';
import { shared, G, enemies, player, isGunner } from '../state.js';
import { stance, bladeColor } from '../player/helpers.js';
import { pickCut } from '../player/jedi/cutaim.js';
import { bodyRadius } from '../enemies/bodyshape.js';
import { groundAt } from '../world/collision.js';

/* the numbers. blade: how far the blade reaches round the hero through a cut, per metre of blade length (measured in
   the sandbox, every form in both grips: the tip crosses the front about 2.1 m out, a thrust's point ~0.6 m further, the
   step into the cut on top). step: how far the cut's root
   motion carries with nothing to close on (combat.js stepIntoCut: 7 × lunge ÷ the ground drag). near: how close a foe
   has to be for the marker to come up. */
export const SWING_MARK = {
  blade: 2.05, thrust: 0.6, inner: 0.45, near: 7.5, fade: 7, opacity: 0.6,
  half: { side: 78, overhead: 22, thrust: 18, back: 74 },   // degrees either side of the cut's line
  dirOff: 0.12,   // a cut's line leans this far (radians) toward the side it sweeps to
  rings: 4,
};
const D2R = Math.PI / 180, GROUND_DRAG = 9;

/* ---------- the arc: a flat sector bent in the vertex shader, so one mesh serves any width and reach ---------- */
const SEG = 64;
function sectorGeometry(){
  const g = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  for (let i = 0; i <= SEG; i++) for (let j = 0; j <= 1; j++){ pos.push(0, 0, 0); uv.push(i / SEG, j); }
  for (let i = 0; i < SEG; i++){ const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const arcMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  uniforms: { uHalf: { value: 1 }, uIn: { value: 0.4 }, uOut: { value: 2.5 }, uCol: { value: new THREE.Color(0x66ccff) },
              uOp: { value: 0 }, uHot: { value: 0 }, uDir: { value: 1 }, uT: { value: 0 }, uFull: { value: 0 } },
  vertexShader: `
    uniform float uHalf, uIn, uOut; varying vec2 vUv;
    void main(){
      vUv = uv;
      float a = mix(-uHalf, uHalf, uv.x), r = mix(uIn, uOut, uv.y);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(sin(a) * r, 0.0, cos(a) * r, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 uCol; uniform float uOp, uHot, uDir, uT, uFull, uIn, uOut; varying vec2 vUv;
    void main(){
      float v = vUv.y, u = vUv.x;
      // the near end fades into the hero's feet; the far edge is a bright rim: that's how far the blade gets
      float fill = 0.24 * smoothstep(0.0, 0.45, v);
      float rim = exp(-pow((v - 0.92) / 0.05, 2.0));
      // a thin dark line just outside the rim, so the edge reads on a pale floor as well as a dark one
      float dark = exp(-pow((v - 0.985) / 0.022, 2.0));
      // the sides fade off, unless it goes all the way round
      float side = uFull > 0.5 ? 1.0 : smoothstep(0.0, 0.025, u) * smoothstep(1.0, 0.975, u);
      // and the same dark line down the two sides, fading in from the hero's feet
      float sideDark = uFull > 0.5 ? 0.0 : (exp(-pow(u / 0.012, 2.0)) + exp(-pow((1.0 - u) / 0.012, 2.0))) * smoothstep(0.15, 0.6, v) * 0.6;
      // the way the blade travels: across (a side cut, uDir ±1) or out from the hero (an overhead or a thrust, 0)
      float along = abs(uDir) > 0.5 ? (uDir > 0.0 ? u : 1.0 - u) : v;
      float lead = mix(0.22, 1.0, along);
      float p = fract(uT * 1.4);
      float band = exp(-pow((along - p) / 0.07, 2.0)) * (abs(uDir) > 0.5 ? smoothstep(0.2, 0.7, v) : 1.0);
      float a = ((fill + rim * 0.9) * lead + band * 0.35) * side * uOp * (1.0 + uHot * 0.6);
      float d = ((dark * side + sideDark) * 0.5 + 0.16 * smoothstep(0.0, 0.45, v) * side) * uOp;   // (and a faint shade under the fill)
      vec3 c = mix(uCol, vec3(1.0), clamp(rim * 0.4 + uHot * 0.2, 0.0, 1.0));
      float A = clamp(a + d, 0.0, 1.0);
      c = mix(c, vec3(0.02, 0.03, 0.06), d / max(a + d, 1e-3));
      gl_FragColor = vec4(c, A);
    }`,
});
const arc = new THREE.Mesh(sectorGeometry(), arcMat);
arc.frustumCulled = false; arc.renderOrder = 5; arc.visible = false;
scene.add(arc);

/* ---------- the rings at the feet of the foes the cut will reach ---------- */
const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const rings = [];
for (let i = 0; i < SWING_MARK.rings; i++){
  const r = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), ringMat());
  r.rotation.x = -Math.PI / 2; r.visible = false; r.renderOrder = 6; r.frustumCulled = false;
  scene.add(r); rings.push(r);
}

/* ---------- what the next cut is, and what it will reach ---------- */
// the cut a press right now would throw (combat.js tryAttack, without spending it): the combo step, the pattern, the lunge
function nextCut(){
  const st = stance(), sw = player.swing;
  if (player.atkT > 0 && sw) return { step: sw.step, pat: sw.pat, dir: sw.dir, back: sw.back, rip: sw.riposte, fin: sw.step === 2 && sw.dir === 'neutral' && !sw.riposte, spin: !!sw.spin };
  const step = (G.gt - player.lastAtkEnd < 0.9 * (st.comboGap || 1)) ? (player.comboStep + 1) % 3 : 0;
  if (player.riposteT > 0) return { step, pat: SWING_PATTERNS.forward, dir: 'forward', rip: true };
  const c = pickCut(step, false);
  return { step, pat: c.pat, dir: c.dir, back: c.dir === 'back', fin: step === 2 && c.dir === 'neutral' };
}
/* the cut's shape on the floor: its centre line (radians off the view's heading), how wide either side, which way the
   blade travels across it, and whether it goes all the way round */
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

const _white = new THREE.Color(0xffffff);
let hotT = 0, shownOp = 0, radius = 2.5, half = 1, lineYaw = 0;
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
  // how far the arc reaches along its line: the blade from where the step leaves the hero
  const along = sx * Math.sin(yaw + shape.yaw) + sz * Math.cos(yaw + shape.yaw);
  return { reach: blade + step * Math.max(0, along), tgt };
}

// anything to fight close enough for the marker to matter
function foeNear(pp){
  const n2 = SWING_MARK.near * SWING_MARK.near;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    const dx = e.group.position.x - pp.x, dz = e.group.position.z - pp.z;
    if (dx * dx + dz * dz < n2) return true;
  }
  const B = shared.boss;
  return !!(B && B.hp > 0 && B.group.position.distanceTo(pp) < SWING_MARK.near + 2);
}

// is the marker up right now (the HUD reads it: the free-aim dot steps back while the floor shows the cut)
export const swingMarkerOn = () => shownOp > 0.05;
// the marker's live read, for tests: how far and how wide, and who it says the cut will reach
export const swingMarkInfo = () => ({ on: swingMarkerOn(), op: +shownOp.toFixed(2), reach: +radius.toFixed(2), half: Math.round(half / D2R),
  full: arcMat.uniforms.uFull.value > 0.5, dir: arcMat.uniforms.uDir.value, hot: hotT > 0.5, hits: hits.length });

/* ---------- per frame ---------- */
export function updateSwingMarker(dt){
  const pp = player.group.position;
  const able = G.swingMarker !== false && G.mode === 'play' && !G.cutscene && !G.paused && !G.skillSelect && !G.sbMenu && !G.sbPlan && !isGunner() && !player.holstered
    && !shared.saberProj && !player.blockHeld && !(player.hp <= 0) && !player.downed && !player.hang && !player.mantle && player.judgeT <= 0 && player.mendT <= 0;
  let want = 0;
  if (able){
    const gy = groundAt(pp.x, pp.z, pp.y + 0.3);
    const lift = pp.y - gy;
    if (lift < 2.5 && (foeNear(pp) || player.atkT > 0)) want = SWING_MARK.opacity * (lift > 0.8 ? 0.5 : 1);
    if (want > 0 || shownOp > 0.01){
      const cut = nextCut(), shape = cutShape(cut), yaw = G.yaw;
      const pr = predict(cut, shape, yaw);
      const k = 1 - Math.exp(-14 * dt);
      radius += (Math.max(SWING_MARK.inner + 0.6, pr.reach) - radius) * k;
      half += (shape.half - half) * Math.min(1, k * 1.4);
      const ty = yaw + shape.yaw + (shape.full ? 0 : -shape.dir * SWING_MARK.dirOff);
      let dy = ty - lineYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); lineYaw += dy * Math.min(1, k * 1.6);
      hotT += ((hits.length ? 1 : 0) - hotT) * Math.min(1, 12 * dt);
      const U = arcMat.uniforms;
      U.uHalf.value = Math.min(Math.PI, half); U.uIn.value = SWING_MARK.inner; U.uOut.value = radius;
      U.uDir.value = shape.dir; U.uFull.value = shape.full ? 1 : 0; U.uHot.value = hotT;
      U.uT.value = (U.uT.value + dt * (player.atkT > 0 ? 2.2 : 1)) % 1000;
      U.uCol.value.setHex(bladeColor(stance()));
      arc.position.set(pp.x, gy + 0.03, pp.z);
      // the sector's u runs from local -x (the hero's right, looking down +z after the turn) to +x
      arc.rotation.set(0, lineYaw, 0);
      // a ring under each foe it will reach (the lunge's target brightest)
      for (let i = 0; i < rings.length; i++){
        const r = rings[i], e = hits[i];
        if (!e || want <= 0){ r.visible = false; continue; }
        const p = e.group.position, br = e === shared.boss ? 1.0 : bodyRadius(e) + 0.22;
        r.visible = true; r.position.set(p.x, groundAt(p.x, p.z, p.y + 0.3) + 0.04, p.z); r.scale.setScalar(br);
        r.material.color.setHex(bladeColor(stance())).lerp(_white, 0.35);
        r.material.opacity = shownOp * (e === pr.tgt ? 1.4 : 0.9);
      }
    }
  }
  if (!(want > 0)) for (const r of rings) r.visible = false;
  shownOp += (want - shownOp) * Math.min(1, SWING_MARK.fade * dt);
  if (want <= 0 && shownOp < 0.01) shownOp = 0;
  arcMat.uniforms.uOp.value = shownOp;
  arc.visible = shownOp > 0.005;
}
