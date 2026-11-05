// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* MAKASHI'S BIND AND DISARM (Dooku against Anakin, Obi-Wan against Dooku). A clean Makashi parry of a duellist's strike
   catches its blade in a BIND: it can't keep the exchange going, and the riposte off the bind wrenches the weapon out
   of its hand. The hilt spins away and lands at its feet; empty-handed it can't guard, strike or turn bolts, and it
   backs off to the ring until it calls the blade back to its hand with the Force. (stances.js makashi `bind`) */

import { scene } from '../engine/renderer.js';
import { G } from '../state.js';
import { V3, clamp } from '../utils.js';
import { floater } from '../fx/floaters.js';
import { burst } from '../fx/particles.js';
import { clashSparks } from '../fx/ink.js';
import { S } from '../audio/sfx.js';
import { dropToken } from './director.js';

export const BIND = {
  window: 1.1,    // s after the parry that the riposte still finds the blade in the bind
  champion: 0.6,  // a champion or a boss holds on to it: it is empty-handed for this share of the time
  cooldown: 8,    // s after it has its blade back before it can be disarmed again
  fly: 0.62,      // s the hilt spins through the air
  toss: 3.0,      // m it lands away from the foe
  arc: 2.2,       // m the hilt rises over its flight
  recall: 0.4,    // s the Force pull takes to bring it back to the hand
};

const weapon = e => { const u = e.group.userData; return u.saber || u.staff || null; };
// can this foe's blade be bound and taken? A duellist (never the Warbringer's brace) holding a saber or a staff
export const bindable = e => !!e.dp && !e.dp.brace && !e.net && !e.dead && !e.converted && !!weapon(e)
  && !(e.bindCd > G.gt) && !(e.disarmUntil > G.gt);
export const bladeless = e => !!e.disarm;

// the parry caught its blade: the riposte that follows takes it
export function bindBlade(e){
  if (!bindable(e)) return false;
  e.boundUntil = G.gt + BIND.window;
  e.exch = null; e.rallyT = 0; e.counterQueued = false;   // Makashi holds the blade: no exchange to keep going
  const g = e.group;
  floater(V3(g.position.x, g.position.y + 1.9, g.position.z), 'BIND', '#ffb02e');
  return true;
}

// the riposte off the bind: the weapon flies out of its hand toward (dx, dz), and it is empty-handed for `time` s
export function disarmBlade(e, dx, dz, time){
  if (!(e.boundUntil > G.gt) || !bindable(e)) return false;
  e.boundUntil = 0;
  const node = weapon(e), g = e.group;
  node.updateWorldMatrix(true, true);
  const prop = node.clone(true);
  node.getWorldPosition(prop.position); node.getWorldQuaternion(prop.quaternion); node.getWorldScale(prop.scale);
  scene.add(prop);
  node.visible = false;
  // it is flung out to one side of the riposte's line, and lands flat
  const side = Math.random() < 0.5 ? -1 : 1, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;
  const to = V3(g.position.x + (ux * 0.5 - uz * side * 0.85) * BIND.toss, g.position.y + 0.06, g.position.z + (uz * 0.5 + ux * side * 0.85) * BIND.toss);
  const t = time * (e.champion || e.boss ? BIND.champion : 1);
  e.disarm = { prop, node, from: prop.position.clone(), to, t: 0, phase: 'fly', spin: side * (14 + Math.random() * 6), back: G.gt + t - BIND.recall };
  e.disarmUntil = G.gt + t; e.bindCd = G.gt + t + BIND.cooldown;
  e.exch = null; e.rallyT = 0; e.counterQueued = false; e.plan = null;
  if (e.token) dropToken(e, true);
  e.tokenRest = Math.max(e.tokenRest || 0, t);   // it backs off to the ring until its hand is full again
  floater(V3(g.position.x, g.position.y + 1.7, g.position.z), 'DISARMED', '#ffb02e');
  clashSparks(prop.position, 0xffe2a0, 6);
  G.hitstop = Math.max(G.hitstop, 0.1);
  G.slowmo = Math.min(G.slowmo, 0.35); G.slowmoT = Math.max(G.slowmoT, 0.22);   // a beat to watch the hilt go
  return true;
}

// every frame for a disarmed foe (enemies/duel.js updateDuel)
export function updateDisarm(e, dt){
  const D = e.disarm;
  if (!D) return;
  if (e.dead || e.converted){ endDisarm(e); return; }
  D.t += dt;
  const p = D.prop.position;
  if (D.phase === 'fly'){
    const k = clamp(D.t / BIND.fly, 0, 1);
    p.lerpVectors(D.from, D.to, k);
    p.y += Math.sin(k * Math.PI) * BIND.arc;
    D.prop.rotation.x += D.spin * dt; D.prop.rotation.z += D.spin * 0.35 * dt;
    if (k >= 1){
      D.phase = 'down';
      D.prop.rotation.set(Math.PI / 2, D.prop.rotation.y, 0);   // lying flat where it fell
      burst(V3(p.x, 0.1, p.z), 0xa89a86, 6, 2, 1.2);
      S.clash(p, false);
    }
  } else if (D.phase === 'down'){
    if (G.gt >= D.back){ D.phase = 'call'; D.t = 0; D.from.copy(p); }
  } else {
    // the Force pull: the hilt leaps up off the floor into its hand
    const k = clamp(D.t / BIND.recall, 0, 1), hand = V3(0, 0, 0);
    D.node.getWorldPosition(hand);
    p.lerpVectors(D.from, hand, k * k);
    p.y += Math.sin(k * Math.PI) * 0.6;
    D.prop.rotation.x += 18 * dt;
    if (k >= 1){
      burst(hand, 0x9cc4ff, 6, 2, 1);
      S.pull(hand);
      endDisarm(e);
    }
  }
}

// it fell before it got its blade back: the hilt drops where it was headed and lies there with the body
export function settleDisarm(e){
  const D = e.disarm;
  if (!D || D.phase === 'down') return;
  D.prop.position.copy(D.to); D.prop.rotation.set(Math.PI / 2, D.prop.rotation.y, 0); D.phase = 'down'; D.back = Infinity;
}

export function endDisarm(e){
  const D = e.disarm;
  if (!D) return;
  scene.remove(D.prop);
  D.node.visible = true;
  e.disarm = null;
  if (e.disarmUntil > G.gt) e.disarmUntil = 0;
}
