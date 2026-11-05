// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DEFEATS — a felled foe goes down the way the killing blow says it should (tunables: data/defeats.js):
//   · cut in two at the waist, the legs stand a beat on their own, then topple; the head off, the body sinks to its
//     knees and pitches forward; a leg off, it goes over sideways onto the side it lost; an arm off, it reels back
//     hunched over the wound, turning away, then falls on its face (enemies/scars.js severLimbs picks the part)
//   · a plain killing cut throws the body along the blade's way, spinning off a sideways sweep (enemies/damage.js)
//   · a droid sparks and jerks where it lies, its eyes stuttering out; a trooper lets go of its blaster
// (slow motion and the camera on a fight's last foe, a duellist's finish and a boss's fall belong to the kill cam)
// defeatMotion owns the body while a reaction plays (the host: enemies/ai.js ragdoll); defeatLife runs on every felled
// foe on both screens (the knees, the sparks, the dropped blaster), so a co-op guest sees it too.

import { G } from '../state.js';
import { rand, clamp } from '../utils.js';
import { DEFEAT } from '../data/defeats.js';
import { dropRifle } from './scars.js';
import { sparks } from '../fx/ink.js';
import { burst } from '../fx/particles.js';
import * as THREE from 'three';

const DROID = { magna: 1, b1: 1 };
const RANK = { waist: 5, head: 4, leg: 3, shin: 2, arm: 1, fore: 0 };
const REACT = { waist: 'halved', head: 'headless', leg: 'legless', shin: 'legless', arm: 'reel', fore: 'reel' };
const ease = (a, b, dt, k) => a + (b - a) * (1 - Math.exp(-k * dt));
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

/* the cuts that killed `e` (kinds: [part kind, side -1 left / +1 right / 0 middle]); dir: the way the blow went */
export function cutDefeat(e, kinds, dir){
  if (!e.dead || e.fin || e.state === 'fade') return;
  let best = null;
  for (const k of kinds) if (!best || RANK[k[0]] > RANK[best[0]]) best = k;
  const kind = REACT[best[0]];
  const l = Math.hypot(dir.x, dir.z) || 1;
  e.defeat = { kind, t: 0, side: best[1], dx: dir.x / l, dz: dir.z / l, live: true };
  if (e.net) return;   // (a guest's copy: the host moves the body, this side only bends the knees)
  e.fall = null; e.crumple = false;
  const D = DEFEAT[kind];
  if (kind === 'halved' || kind === 'headless') e.vel.set(0, 0, 0);
  else if (kind === 'reel') e.vel.set(e.defeat.dx * D.back, 0, e.defeat.dz * D.back);
  else {   // legless: over toward the side it lost, and a little the blow's way
    const y = e.group.rotation.y, s = e.defeat.side || (Math.random() < 0.5 ? -1 : 1);
    e.defeat.side = s;
    e.vel.set(e.defeat.dx * D.push + Math.cos(y) * s * D.side, D.lift, e.defeat.dz * D.push - Math.sin(y) * s * D.side);
  }
}

/* the host's ragdoll while a reaction plays: true while it owns the body this frame, 'down' once it lies still
   (the caller lets it fade), false when it hands the body back to the plain fall */
export function defeatMotion(e, g, dt){
  const R = e.defeat;
  if (!R || !R.live || e.net) return false;
  const D = DEFEAT[R.kind], t = R.t;
  switch (R.kind){
    case 'halved': case 'headless': {
      if (t < D.hold){
        g.position.y = Math.max(0, g.position.y - dt * 3);
        e.vel.set(0, 0, 0);
        if (R.kind === 'halved') g.rotation.z = D.wobble * Math.sin(t * 17) * (1 - t / D.hold);
        else g.rotation.x = ease(g.rotation.x, D.lean, dt, 6);
        return true;
      }
      // over it goes: the legs alone fall back, the headless body forward onto its face
      R.live = false;
      const s = R.kind === 'halved' ? -1 : 1;
      e.fall = { s, roll: (Math.random() - 0.5) * 0.3, flip: false, yaw: 0 };
      const fw = s * D.fallVel, y = g.rotation.y;
      e.vel.set(Math.sin(y) * fw, 0.4, Math.cos(y) * fw);
      return false;
    }
    case 'reel': {
      if (t < D.time){
        e.vel.y = 0; g.position.y = Math.max(0, g.position.y - dt * 3);
        e.vel.x *= Math.max(0, 1 - dt * 2.5); e.vel.z *= Math.max(0, 1 - dt * 2.5);
        g.position.x += e.vel.x * dt; g.position.z += e.vel.z * dt;
        g.rotation.x = ease(g.rotation.x, D.hunch, dt, 7);
        g.rotation.z = ease(g.rotation.z, -R.side * D.lean, dt, 6);
        g.rotation.y += R.side * D.turn * dt * (1 - t / D.time);
        return true;
      }
      R.live = false;
      e.fall = { s: 1, roll: -R.side * 0.25, flip: false, yaw: 0 };
      const y = g.rotation.y;
      e.vel.set(Math.sin(y) * D.fallVel, 1.1, Math.cos(y) * D.fallVel);
      return false;
    }
    case 'legless': {
      e.vel.y -= 22 * dt;
      g.position.addScaledVector(e.vel, dt);
      g.rotation.z = ease(g.rotation.z, -R.side * D.roll, dt, D.rate);
      g.rotation.x = ease(g.rotation.x, 0.12, dt, 6);
      if (g.position.y <= 0){
        g.position.y = 0;
        if (e.vel.y < -3){ e.vel.y *= -0.3; e.vel.x *= 0.5; e.vel.z *= 0.5; burst(g.position, 0x888888, 3, 3, 2); }
        else {
          e.vel.y = 0; e.vel.x *= Math.max(0, 1 - dt * 10); e.vel.z *= Math.max(0, 1 - dt * 10);
          if (Math.abs(g.rotation.z + R.side * D.roll) < 0.15){ e.vel.set(0, 0, 0); R.live = false; return 'down'; }
        }
      }
      return true;
    }
  }
  return false;
}

/* every felled foe, every frame, after its pose (enemies/ai.js; the guest's net/foes.js): the knees, a droid's death
   throes, the blaster leaving its hands */
const _p = new THREE.Vector3();
export function defeatLife(e, g, dt){
  if (!e.dead || e.fin) return;
  const u = g.userData;
  if (!e._felled){
    e._felled = true;
    if (u.rifle){
      const l = Math.hypot(e.vel.x, e.vel.z);
      dropRifle(e, l > 0.3 ? { x: e.vel.x / l, z: e.vel.z / l } : null);
    }
    if (DROID[u.model]) e.throes = { t: 0, next: 0, jx: 0, jz: 0 };
  }
  const R = e.defeat;
  if (R){
    R.t += dt;
    const D = DEFEAT[R.kind];
    e.kneel = R.kind === 'halved' ? D.kneel * ss(0.1, D.hold, R.t)
      : R.kind === 'headless' ? D.kneel * ss(0.05, D.hold, R.t)
      : R.kind === 'reel' ? D.kneel * ss(D.time * 0.35, D.time, R.t) : 0;
  }
  // a droid's throes: sparks off its body, the head and arms jerking, the eyes stuttering, then out
  const T = e.throes;
  if (T && T.t < DEFEAT.droid.time){
    const DR = DEFEAT.droid;
    T.t += dt;
    if ((T.next -= dt) <= 0){
      T.next = rand(...DR.every);
      _p.set(g.position.x + rand(-0.25, 0.25), g.position.y + rand(0.4, 1.4) * g.scale.x * (g.rotation.x || g.rotation.z ? 0.4 : 1), g.position.z + rand(-0.25, 0.25));
      sparks(_p, Math.random() < 0.6 ? 0xbfe4ff : 0xffd080, 3, 5, { cone: 1.8, life: 0.2, size: 0.3 });
      const k = DR.jerk * (1 - T.t / DR.time);
      T.jx = rand(-k, k); T.jz = rand(-k, k);
    }
    T.jx *= Math.max(0, 1 - dt * 18); T.jz *= Math.max(0, 1 - dt * 18);
    if (u.head && !u.head.userData.cut){ u.head.rotation.x += T.jx; u.head.rotation.z += T.jz; }
    for (const a of [u.offArm, u.offArmR, u.weaponArm]) if (a && !a.userData.cut){ a.rotation.x += T.jz * 0.8; a.rotation.z += T.jx * 0.6; }
    if (u.eye) u.eye.visible = T.t < DR.eyesOut && Math.random() > T.t / DR.eyesOut * 0.8;
    if (T.t >= DR.time && u.eye) u.eye.visible = false;
  }
}
