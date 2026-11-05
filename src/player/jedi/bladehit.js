// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Blade contact: a cut lands on what the blade actually sweeps through, frame by frame, not on a radius around the hero.

import * as THREE from 'three';
import { shared, G, enemies, barrels, player, isGunner } from '../../state.js';
import { stance } from '../helpers.js';
import { pointHit, partsOf } from '../../enemies/bodyshape.js';
import { meetBlades } from './clash.js';
import { STAFF, saberIsStaff, saberIsDual } from '../model/weapons.js';
import { tutEvent } from '../../game/tutor-bus.js';
export { bodyRadius } from '../../enemies/bodyshape.js';

/* BODIES — foes use their real hitbox (enemies/bodyshape.js: legs, torso, head, turned and tipped over with the model);
   the boss and barrels are upright capsules. EDGE pads the blade by its glow, so a hit that LOOKS like it touched does. */
export const BODY = { edge: 0.12, bossR: 0.75, bossH: 3.2, barrelR: 0.55, barrelH: 1.3 };
const ALONG = 7, SWEEP = 4;   // points sampled along the blade, and sub-steps between last frame's blade and this one's
const P = new THREE.Vector3(), B = new THREE.Vector3(), T = new THREE.Vector3(), PB = new THREE.Vector3(), PT = new THREE.Vector3();

// the live blade, base → tip, in world space (the same line the swing trail draws). false when no blade is in hand.
export function bladeSegment(outB, outT){
  const dark = isGunner();
  const node = dark ? (player.darksaberMesh && player.darksaberMesh.visible ? player.darksaberMesh : null)
                    : (player.saberBladeRoot || player.saberHand);
  if (!node) return false;
  const len = dark ? 1.3 : 0.18 + 1.6 * (stance().bladeLen || 1);
  node.updateWorldMatrix(true, false);
  outB.set(0, 0.12 * len, 0); node.localToWorld(outB);
  outT.set(0, len, 0); node.localToWorld(outT);
  return true;
}
// the saber staff's far blade, base → tip, in world space (false unless the staff is in hand: data/forms.js staff)
export function farBladeSegment(outB, outT){
  if (isGunner() || !saberIsStaff(player)) return false;
  const node = player.saberBladeRoot, l2 = 1.6 * (stance().bladeLen || 1);
  node.updateWorldMatrix(true, false);
  outB.set(0, -(STAFF.end + 0.04 + 0.12 * l2), 0); node.localToWorld(outB);
  outT.set(0, -(STAFF.end + l2), 0); node.localToWorld(outT);
  return true;
}
const FB = new THREE.Vector3(), FT = new THREE.Vector3(), FPB = new THREE.Vector3(), FPT = new THREE.Vector3();
// Jar'Kai's off-hand saber, base → tip, in world space (false unless it's in hand: data/forms.js jarkai)
export function offBladeSegment(outB, outT){
  if (isGunner() || !saberIsDual(player) || player.offAway) return false;
  const node = player.offSaber.root, len = 0.18 + 1.6 * (stance().bladeLen || 1);
  node.updateWorldMatrix(true, false);
  outB.set(0, 0.12 * len, 0); node.localToWorld(outB);
  outT.set(0, len, 0); node.localToWorld(outT);
  return true;
}
const OB = new THREE.Vector3(), OT = new THREE.Vector3(), OPB = new THREE.Vector3(), OPT = new THREE.Vector3();
/* JAR'KAI'S FOLLOW-UP — the off blade is swept the same way as the main one, every frame of the swing, and cuts while its
   own stroke runs (`live`: anim/saber.js saberPose.offLive). It keeps its OWN list of who it has cut, so the follow-up
   lands on a foe the lead blade already struck: that is the second beat. Returns the new targets (enemies only). */
export function sweepOffBlade(sw, live){
  if (!offBladeSegment(OB, OT)) return null;
  if (!sw.opb){ sw.opb = OB.clone(); sw.opt = OT.clone(); }
  OPB.copy(sw.opb); OPT.copy(sw.opt);
  sw.opb.copy(OB); sw.opt.copy(OT);
  if (!live) return null;
  const cut = sw.offCut || (sw.offCut = new Set()), out = [], pts = [];
  sweepPoints(OPB, OB, OPT, OT, pts);
  const at = sw.offAt || (sw.offAt = new Map());
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || cut.has(e)) continue;
    for (let k = 0; k < pts.length; k += 3){
      const part = pointHit(e, P.set(pts[k], pts[k + 1], pts[k + 2]), BODY.edge);
      if (part){
        cut.add(e); out.push(e);
        at.set(e, { at: P.clone(), zone: part.head ? 2 : partsOf(e).indexOf(part) === 0 ? 0 : 1, cut: new THREE.Vector3().subVectors(OT, OPT), blade: new THREE.Vector3().subVectors(OT, OB) });
        break;
      }
    }
  }
  const boss = shared.boss;
  if (boss && boss.hp > 0 && !cut.has(boss)){
    const p = boss.group.position, r = BODY.bossR + BODY.edge;
    for (let k = 0; k < pts.length; k += 3){
      const py = pts[k + 1];
      if (py < p.y || py > p.y + BODY.bossH) continue;
      const dx = pts[k] - p.x, dz = pts[k + 2] - p.z;
      if (dx * dx + dz * dz < r * r){ cut.add(boss); out.push(boss); break; }
    }
  }
  return out;
}

/* the blade swings AROUND the hero, so between two frames its base and tip travel along arcs, not straight chords:
   interpolate each in cylindrical coordinates about the hero (angle, distance, height), into flat x,y,z samples. A slow
   frame still can't let a cut skip over a body it visibly passed through. */
function sweepPoints(PB, B, PT, T, pts){
  const c = player.group.position;
  const cyl = (v, o) => { o.a = Math.atan2(v.z - c.z, v.x - c.x); o.r = Math.hypot(v.x - c.x, v.z - c.z); o.y = v.y; return o; };
  const b0 = cyl(PB, {}), b1 = cyl(B, {}), t0 = cyl(PT, {}), t1 = cyl(T, {});
  const da = (p, q) => { let d = q.a - p.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const dB = da(b0, b1), dT = da(t0, t1);
  const steps = Math.max(SWEEP, Math.ceil(Math.max(Math.abs(dB), Math.abs(dT)) / 0.2));   // a sample every ~11° of swing
  for (let i = 1; i <= steps; i++){
    const s = i / steps;
    const ab = b0.a + dB * s, rb = b0.r + (b1.r - b0.r) * s, yb = b0.y + (b1.y - b0.y) * s;
    const at = t0.a + dT * s, rt = t0.r + (t1.r - t0.r) * s, yt = t0.y + (t1.y - t0.y) * s;
    const bx = c.x + Math.cos(ab) * rb, bz = c.z + Math.sin(ab) * rb, tx = c.x + Math.cos(at) * rt, tz = c.z + Math.sin(at) * rt;
    for (let j = 0; j < ALONG; j++){ const a = j / (ALONG - 1); pts.push(bx + (tx - bx) * a, yb + (yt - yb) * a, bz + (tz - bz) * a); }
  }
  return pts;
}

/* Sweep the blade from where it was last frame to where it is now; return the targets it passed through for the first
   time this swing (enemies, the boss, barrels). The swing remembers who it has already cut. `live` is false outside
   the stroke: the blade is still tracked, so the stroke's first frame sweeps from where it really was. */
export function sweepBlade(sw, live){
  if (!bladeSegment(B, T)) return null;
  if (!sw.pb){ sw.pb = B.clone(); sw.pt = T.clone(); }
  PB.copy(sw.pb); PT.copy(sw.pt);
  sw.pb.copy(B); sw.pt.copy(T);
  // the saber staff's far blade is tracked the same way (it cuts on the same beats as the near one)
  const far = farBladeSegment(FB, FT);
  if (far){
    if (!sw.fpb){ sw.fpb = FB.clone(); sw.fpt = FT.clone(); }
    FPB.copy(sw.fpb); FPT.copy(sw.fpt);
    sw.fpb.copy(FB); sw.fpt.copy(FT);
  }
  if (!live) return null;   // the chamber and the follow-through only track the blade; the stroke between them cuts
  const cut = sw.cutSet || (sw.cutSet = new Set());
  const out = [];
  const pts = [];
  sweepPoints(PB, B, PT, T, pts);
  const nearN = pts.length;   // (samples past this one are the far blade's)
  // a READY blade in the way (a guard that holds, a strike in flight) stops the cut before it reaches any body
  if (meetBlades(sw, pts)) return out;
  // the staff's far blade meets blades on its own: one it meets turns that end only (jedi/clash.js meetBlades `far`)
  if (far){ const fp = []; sweepPoints(FPB, FB, FPT, FT, fp); meetBlades(sw, fp, true); for (const v of fp) pts.push(v); }
  const test = (obj, x, z, y0, y1, r) => {
    if (cut.has(obj)) return;
    r += BODY.edge;
    for (let k = 0; k < pts.length; k += 3){
      const py = pts[k + 1];
      if (py < y0 || py > y1) continue;
      const dx = pts[k] - x, dz = pts[k + 2] - z;
      if (dx * dx + dz * dz < r * r){ cut.add(obj); out.push(obj); return; }
    }
  };
  // WHERE it landed: the point the blade first met the body, which part (0 legs · 1 torso · 2 head, data/bodyshape.js) and
  // which way the tip was travelling (the foe reels with the cut: enemies/damage.js hitReact)
  const at = sw.hitAt || (sw.hitAt = new Map());
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || cut.has(e)) continue;
    if (sw.nearStop && sw.nearStop.has(e)) continue;   // its guard turned the sweep (Shii-Cho: jedi/clash.js meetBlades)
    const stopped = sw.farStop && sw.farStop.has(e);   // its weapon turned the far end: only the near blade can reach it
    for (let k = 0; k < (stopped ? nearN : pts.length); k += 3){
      const part = pointHit(e, P.set(pts[k], pts[k + 1], pts[k + 2]), BODY.edge);
      if (part){
        const back = k >= nearN;   // the staff's far blade found it
        cut.add(e); out.push(e);
        at.set(e, { at: P.clone(), zone: part.head ? 2 : partsOf(e).indexOf(part) === 0 ? 0 : 1, cut: back ? new THREE.Vector3().subVectors(FT, FPT) : new THREE.Vector3().subVectors(T, PT),
                    blade: back ? new THREE.Vector3().subVectors(FT, FB) : new THREE.Vector3().subVectors(T, B), far: back });   // (blade: its line, base → tip: with the cut, the plane it sliced along, enemies/scars.js)
        if (back) tutEvent('farBlade', e);   // (the training's saber staff lesson)
        break;
      }
    }
  }
  const boss = shared.boss;
  if (boss && boss.hp > 0){ const p = boss.group.position; test(boss, p.x, p.z, p.y, p.y + BODY.bossH, BODY.bossR); }
  for (const b of barrels){ const p = b.mesh.position; test(b, p.x, p.z, p.y - BODY.barrelH / 2, p.y + BODY.barrelH / 2, BODY.barrelR); }
  return out;
}
