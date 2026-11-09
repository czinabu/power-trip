// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Soft lock-on (Jedi): T (a pad: R3) keeps one foe framed so cuts and parries are aimed at it. While locked, a quick flick of
// the mouse or the right stick to one side moves the lock to the next foe that way (unless CUT AIM is MOUSE: the flick aims cuts).

import { CFG } from '../data/config.js';
import { wrapAngle, V3 } from '../utils.js';
import { sfx } from '../audio/sfx.js';
import { shared, G, enemies, player, isGunner } from '../state.js';
import { camera } from '../engine/renderer.js';
import { playerPos, fwd } from './helpers.js';

const alive = t => !!t && (t === shared.boss ? t.hp > 0 : !t.dead && !t.converted && t.state !== 'spawn');
const posOf = t => t.group.position;

// the foe closest to the middle of the view (angle matters more than distance), within range and the view cone
function pickTarget(exclude){
  const L = CFG.player.lockOn, pp = playerPos(), f = fwd();
  let best = null, bs = -1e9;
  const consider = (t) => {
    if (!alive(t) || t === exclude) return;
    const p = posOf(t), dx = p.x - pp.x, dz = p.z - pp.z, d = Math.hypot(dx, dz);
    if (d > L.range || d < 0.01) return;
    const c = (dx * f.x + dz * f.z) / d;
    if (c < L.cone) return;
    const sc = c * 2 - d / L.range;
    if (sc > bs){ bs = sc; best = t; }
  };
  for (const e of enemies) consider(e);
  if (shared.boss) consider(shared.boss);
  return best;
}

export function toggleLock(){
  if (isGunner() || G.mode !== 'play') return;
  if (player.lockTarget){ player.lockTarget = null; sfx(420, 0.05, 'triangle', 0.03, 300); return; }
  player.lockTarget = pickTarget(null);
  if (player.lockTarget) sfx(760, 0.06, 'triangle', 0.035, 1100);
}

let mark = null;
function marker(){
  if (!mark){
    const host = document.getElementById('threats');
    if (!host) return null;
    mark = document.createElement('div'); mark.id = 'lockmark'; host.appendChild(mark);
  }
  return mark;
}

// Each frame (before movement reads fwd()): ease the view toward the locked foe and keep the marker on it.
export function updateLockOn(dt){
  const L = CFG.player.lockOn;
  let t = player.lockTarget;
  if (t && (isGunner() || G.mode !== 'play')) t = player.lockTarget = null;
  if (t){
    const pp = playerPos();
    // the foe fell or ran out of reach: hand the lock to the next foe in view, or let it go
    if (!alive(t) || Math.hypot(posOf(t).x - pp.x, posOf(t).z - pp.z) > L.keep) t = player.lockTarget = pickTarget(t);
  }
  const m = marker();
  if (!t){ if (m) m.style.opacity = '0'; return; }
  const pp = playerPos(), p = posOf(t);
  const want = Math.atan2(p.x - pp.x, p.z - pp.z);
  G.yaw += wrapAngle(want - G.yaw) * Math.min(1, L.yawPull * dt);
  // the view is held level only past `pitchFree` of it: inside that you still aim your cuts high or low (jedi/cutaim.js)
  const po = G.pitch - L.pitch;
  if (Math.abs(po) > L.pitchFree) G.pitch -= (po - Math.sign(po) * L.pitchFree) * Math.min(1, L.pitchPull * dt);
  if (m){
    const big = t === shared.boss ? 2.6 : (t.t && t.t.scale ? 1.2 * t.t.scale : 1.2);
    const v = V3(p.x, p.y + big, p.z).project(camera);
    const on = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    m.style.opacity = on ? '1' : '0';
    m.style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(1)}px)`;
  }
}

/* SWITCHING — locked on, a quick flick sideways moves the lock to the nearest foe on that side of the current one (by
   bearing from the hero). The mouse counts a flick as `px` of travel within `win` s; the right stick as a push past
   `stick` from rest (it re-arms under `rearm`). With CUT AIM on MOUSE a flick aims the next cut instead, so it never switches. */
export const LOCK_SWITCH = { px: 150, win: 0.16, stick: 0.85, rearm: 0.35, cd: 0.28, arc: 2.6 };
let flickAcc = 0, flickT = -9, stickArmed = true, lastSwitch = -9;
function switchLock(side){   // side: +1 the next foe to the right on screen, -1 to the left
  const S = LOCK_SWITCH, cur = player.lockTarget, now = performance.now() / 1000;
  if (!cur || now - lastSwitch < S.cd) return;
  const L = CFG.player.lockOn, pp = playerPos(), cp = posOf(cur);
  const b0 = Math.atan2(cp.x - pp.x, cp.z - pp.z);
  let best = null, ba = 1e9;
  const consider = (t) => {
    if (!alive(t) || t === cur) return;
    const p = posOf(t), d = Math.hypot(p.x - pp.x, p.z - pp.z);
    if (d > L.keep || d < 0.01) return;
    const a = wrapAngle(Math.atan2(p.x - pp.x, p.z - pp.z) - b0);   // (a smaller bearing is further right on screen)
    if (-a * side <= 0.02 || Math.abs(a) > S.arc) return;
    if (Math.abs(a) < ba){ ba = Math.abs(a); best = t; }
  };
  for (const e of enemies) consider(e);
  if (shared.boss) consider(shared.boss);
  if (!best) return;
  player.lockTarget = best; lastSwitch = now;
  sfx(880, 0.05, 'triangle', 0.035, 1250);
}
// the mouse's sideways travel, from engine/input.js
export function lockMouseFlick(dx){
  if (!player.lockTarget || G.cutMouse) return;
  const now = performance.now() / 1000;
  if (now - flickT > LOCK_SWITCH.win) flickAcc = 0;
  flickT = now; flickAcc += dx;
  if (Math.abs(flickAcc) > LOCK_SWITCH.px){ switchLock(Math.sign(flickAcc)); flickAcc = 0; }
}
// the right stick's x, every pad frame (engine/gamepad.js)
export function lockStickFlick(rx){
  if (!player.lockTarget || G.cutMouse || Math.abs(rx) < LOCK_SWITCH.rearm){ stickArmed = true; return; }
  if (stickArmed && Math.abs(rx) > LOCK_SWITCH.stick){ stickArmed = false; switchLock(Math.sign(rx)); }
}
