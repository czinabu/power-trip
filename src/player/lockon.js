// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Soft lock-on (Jedi): T (a pad: R3) keeps one foe framed so cuts and parries are aimed at it. While locked, a quick flick of
// the mouse or the right stick to one side moves the lock to the next foe that way (unless CUT AIM is MOUSE: the flick aims cuts,
// or the guard is up: the flick steers the guard, player/jedi/guardline.js).

import { CFG } from '../data/config.js';
import { wrapAngle, V3 } from '../utils.js';
import { sfx } from '../audio/sfx.js';
import { shared, G, enemies, player, isGunner } from '../state.js';
import { camera } from '../engine/renderer.js';
import { playerPos, fwd } from './helpers.js';
import { duelHooks } from '../game/duel-hooks.js';
import { outsideThreat, LOCK_YIELD } from './lock-yield.js';

const alive = t => !!t && (t === rival ? rivalUp() : t === shared.boss ? t.hp > 0 : !t.dead && !t.converted && t.state !== 'spawn');
/* DUEL MODE: the other fighter, as something to lock onto (game/duel-hooks.js bodies: there only while a round is being
   fought). One object, its position refreshed each frame, shaped enough like a foe for whoever reads the lock target. */
const rival = { duelBody: true, dead: false, group: { position: V3(0, 0, 0) } };
function rivalUp(){
  const b = G.duel && duelHooks.bodies ? duelHooks.bodies()[0] : null;
  if (b) rival.group.position.copy(b.pos);
  return !!b;
}
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

/* DUEL FOCUS (Settings · DUEL FOCUS). AUTO: squaring up with a saber duellist locks onto it by itself, and while any
   lock is held the fight stays put around you:
     · you strafe (player/strafe.js): moving circles and steps round the foe, squared to it, never turning away
     · a quick tap of a direction (to pick a cut: jedi/cutaim.js) doesn't move the feet; hold it and you step
     · the mouse and the right stick barely turn the view, so a flick places the guard or aims a cut (jedi/guardline.js,
       jedi/cutaim.js) and the fight stays framed
   It lets go when the foe falls or the gap opens, when a crowd closes in, on T, or when you sweep the view away on
   purpose; and while something outside the duel comes for you or someone beside you (fire from off to the side, a live
   detonator: player/lock-yield.js), so you can turn to block it or push it back. MANUAL: the lock is T's alone and behaves as it always has. OFF: no lock at all.
     on / off   the gap (m) it takes hold inside, and lets go beyond
     cone       how squarely in front the foe must be (cos) to take hold; settle: for how long (s)
     crowd/max  with more than `max` foes inside `crowd` m it won't take hold (a melee, not a duel); past `drop` it lets go
     look/pitch how much of a look still turns the view (pitch: only while the guard is up)
     tap/reach  a direction held under `tap` s inside `reach` m of the foe is a cut's aim, not a step
     away       a sweep of `px` mouse pixels inside `win` s (or the stick held hard over for `stick` s) with no guard
                or cut going breaks an auto focus, and it stays off `hold` s; T keeps it off `toggle` s */
export const FOCUS = { on: 5.5, off: 8.5, cone: 0.25, settle: 0.2, crowd: 10, max: 2, drop: 4, look: 0.15, pitch: 0.45,
  tap: 0.16, reach: 5, away: { px: 650, win: 0.4, stick: 0.5, hold: 2.5, toggle: 6 } };
const auto = () => G.duelFocus === 'auto' && !isGunner() && G.mode === 'play' && !G.cutscene;
function dropLock(holdOff = 0){
  player.lockTarget = null; player.lockAuto = false; player.focusOn = false;
  if (holdOff) player.focusOffUntil = G.gt + holdOff;
}
// the lone duellist close in front (not one of a crowd), or null
function duelPick(){
  const pp = playerPos(), f = fwd();
  if (rivalUp()){   // a duel against another player: there is only the one, wherever in the ring they are
    const p = rival.group.position;
    return Math.hypot(p.x - pp.x, p.z - pp.z) < FOCUS.off ? rival : null;
  }
  let best = null, bd = FOCUS.on, near = 0;
  for (const e of enemies){
    if (!alive(e)) continue;
    const p = posOf(e), dx = p.x - pp.x, dz = p.z - pp.z, d = Math.hypot(dx, dz);
    if (d < FOCUS.crowd) near++;
    if (!(e.dp || e.ng) || d >= bd || d < 0.01 || (dx * f.x + dz * f.z) / d < FOCUS.cone) continue;
    bd = d; best = e;
  }
  return near <= FOCUS.max ? best : null;
}
const crowded = (pp) => { let n = 0; for (const e of enemies){ if (alive(e) && Math.hypot(posOf(e).x - pp.x, posOf(e).z - pp.z) < FOCUS.crowd) n++; } return n > FOCUS.drop; };
let seenPick = null, seenT = 0, awayAcc = 0, awayAt = -9, stickT = 0;
// a look of dx mouse pixels: how much of it turns the view (engine/input.js), and whether it was a sweep away
export function focusLook(dx){
  if (!player.focusOn) return 1;
  if (player.lockAuto && !player.blockHeld && !(player.atkT > 0)){
    const now = performance.now() / 1000;
    if (now - awayAt > FOCUS.away.win || awayAcc * dx < 0){ awayAcc = 0; awayAt = now; }
    awayAcc += dx;
    if (Math.abs(awayAcc) > FOCUS.away.px){ awayAcc = 0; dropLock(FOCUS.away.hold); return 1; }
  }
  return FOCUS.look;
}
// the right stick's x this pad frame: the same answer for a pad (engine/gamepad.js)
export function focusStick(rx, dt){
  if (!player.focusOn){ stickT = 0; return 1; }
  if (player.lockAuto && !player.blockHeld && !(player.atkT > 0) && Math.abs(rx) > LOCK_SWITCH.stick){
    stickT += dt;
    if (stickT > FOCUS.away.stick){ stickT = 0; dropLock(FOCUS.away.hold); return 1; }
  } else stickT = 0;
  return FOCUS.look;
}
export const focusPitch = () => player.focusOn && player.blockHeld ? FOCUS.pitch : 1;
/* the feet in a focused duel (player/locomotion.js, before it reads `want`): steps are taken round the foe itself (not
   round wherever the easing view points), and a direction only tapped is a cut's aim, not a step */
export function focusMove(want, dt){
  const t = player.lockTarget;
  if (!player.focusOn || !t){ player.focusHeld = 0; return; }
  if (want.lengthSq() < 0.01){ player.focusHeld = 0; return; }
  player.focusHeld = (player.focusHeld || 0) + dt;
  const pp = playerPos(), p = posOf(t), d = Math.hypot(p.x - pp.x, p.z - pp.z);
  if (d < FOCUS.reach && player.focusHeld < FOCUS.tap && player.grounded && !(player.dashT > 0)){ want.set(0, 0, 0); return; }
  const dl = wrapAngle(Math.atan2(p.x - pp.x, p.z - pp.z) - G.yaw), c = Math.cos(dl), s = Math.sin(dl), x = want.x, z = want.z;
  want.x = x * c + z * s; want.z = z * c - x * s;
}

export function toggleLock(){
  if (isGunner() || G.mode !== 'play' || G.duelFocus === 'off') return;
  if (player.lockTarget){ dropLock(player.lockAuto ? FOCUS.away.toggle : 0); sfx(420, 0.05, 'triangle', 0.03, 300); return; }
  player.lockTarget = pickTarget(null); player.lockAuto = false;
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
  if (t && (isGunner() || G.mode !== 'play' || G.duelFocus === 'off')) t = player.lockTarget = null;
  if (t && player.lockAuto){
    // a focus the duel took by itself: gone with the foe, the gap or the duel (a crowd), and with the setting
    const pp = playerPos();
    if (!auto() || !alive(t) || Math.hypot(posOf(t).x - pp.x, posOf(t).z - pp.z) > FOCUS.off + (t === rival ? 1.5 : 0) || crowded(pp)) t = player.lockTarget = null;
    // ...and it yields to defence: fire or a detonator from outside the duel, at you or someone beside you (a duel
    // with another player is only ever the two of you)
    else if (t !== rival && outsideThreat(t)){ dropLock(LOCK_YIELD.hold); t = null; sfx(420, 0.05, 'triangle', 0.02, 300); }
  } else if (t){
    const pp = playerPos();
    // the foe fell or ran out of reach: hand the lock to the next foe in view, or let it go
    if (!alive(t) || Math.hypot(posOf(t).x - pp.x, posOf(t).z - pp.z) > L.keep) t = player.lockTarget = pickTarget(t);
  }
  if (!t){
    player.lockAuto = false;
    // DUEL FOCUS: squared up with a lone duellist a moment, the lock takes hold by itself
    // (not while a threat from outside the duel is still about: that holds it off a beat longer each frame it lasts)
    if (auto() && !rivalUp() && outsideThreat(null)) player.focusOffUntil = Math.max(player.focusOffUntil || 0, G.gt + LOCK_YIELD.hold);
    const c = auto() && player.grounded && G.gt >= (player.focusOffUntil || 0) ? duelPick() : null;
    if (c && c === seenPick){ seenT += dt; if (seenT >= FOCUS.settle){ t = player.lockTarget = c; player.lockAuto = true; seenT = 0; sfx(760, 0.05, 'triangle', 0.02, 1100); } }
    else { seenPick = c; seenT = 0; }
  }
  player.focusOn = !!t && G.duelFocus === 'auto';
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
  if (!player.lockTarget || G.cutMouse || player.blockHeld) return;   // (with the guard up a flick steers the guard: jedi/guardline.js)
  const now = performance.now() / 1000;
  if (now - flickT > LOCK_SWITCH.win) flickAcc = 0;
  flickT = now; flickAcc += dx;
  if (Math.abs(flickAcc) > LOCK_SWITCH.px){ switchLock(Math.sign(flickAcc)); flickAcc = 0; }
}
// the right stick's x, every pad frame (engine/gamepad.js)
export function lockStickFlick(rx){
  if (!player.lockTarget || G.cutMouse || Math.abs(rx) < LOCK_SWITCH.rearm){ stickArmed = true; return; }
  if (player.blockHeld){ stickArmed = false; return; }   // with the guard up a flick steers the guard (jedi/guardline.js), never the lock
  if (stickArmed && Math.abs(rx) > LOCK_SWITCH.stick){ stickArmed = false; switchLock(Math.sign(rx)); }
}
