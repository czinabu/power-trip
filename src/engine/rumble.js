// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CONTROLLER RUMBLE: the pad's two motors (strong = the heavy low one, weak = the light high one) through the Gamepad
// API's dual-rumble effect. Nothing in the fight has to call it: each frame it reads the feedback the game already
// gives (a screen-shake kick, a hitstop freeze, a hit taken, a slow-motion beat, a saber lock) and turns it into a
// pulse, so every hero, mode and enemy rumbles the same way the screen reacts. The guns add a kick per shot (rumble()).
// Off while the mouse and keyboard are in use, and scaled by RUMBLE in Settings (G.rumble).

import { G, player } from '../state.js';
import { BLADE_AUDIO } from '../audio/saber.js';

export const RUMBLE = {
  shake:   { min: 0.05, strong: 0.8, weak: 0.9, weak0: 0.2, ms0: 50, ms: 180 },   // a shake kick of size Δ
  hitstop: { min: 0.015, strong: 3, weak: 6, ms0: 50 },                          // a freeze of h seconds
  hurt:    { strong0: 0.35, per: 1 / 40, weak: 0.5, ms0: 140, msPer: 4 },        // a hit taken of n hp
  slowmo:  { below: 0.6, strong: 0.2, weak: 0.6, ms: 90 },                       // a perfect dodge or parry beat
  lock:    { strong: 0.15, bal: 0.3, surge: 0.3, weak: 0.25, ms: 90 },           // a saber lock, held while it lasts
  gap: 33,   // ms between effects sent to the pad (the API restarts the effect on every call)
};

let pend = { s: 0, w: 0, ms: 0 }, playing = { s: 0, w: 0, until: 0 }, lastSend = 0;
let prevShake = 0, prevStop = 0, prevHp = -1, prevSlow = 1, quiet = true;

// ask for a pulse (0..1 motors, ms long); the strongest asked for in a frame wins
export function rumble(strong, weak, ms){
  pend.s = Math.max(pend.s, strong); pend.w = Math.max(pend.w, weak); pend.ms = Math.max(pend.ms, ms);
}

function stop(gp){
  pend = { s: 0, w: 0, ms: 0 }; playing.until = 0;
  if (!quiet && gp && gp.vibrationActuator){ try { (gp.vibrationActuator.reset ? gp.vibrationActuator.reset() : gp.vibrationActuator.playEffect('dual-rumble', { duration: 1, strongMagnitude: 0, weakMagnitude: 0 }))?.catch?.(() => {}); } catch(e){} }
  quiet = true;
}

// once a frame, from the pad poll (engine/gamepad.js): gp is the live pad, active whether it's what's being played with
export function updateRumble(gp, active, t){
  const scale = G.rumble ?? 1;
  const live = active && scale > 0 && G.mode === 'play' && !G.paused && !G.cutscene && gp && gp.vibrationActuator;
  // read the frame's feedback (always, so nothing stale fires the moment the pad is picked up again)
  const dShake = G.shake - prevShake, dStop = G.hitstop - prevStop, hp = player.hp, slow = G.slowmo;
  const L = BLADE_AUDIO.lock, locked = !!(L && G.gt - (L.at || 0) < 0.1);
  if (live){
    const R = RUMBLE;
    if (!locked && dShake > R.shake.min) rumble(Math.min(1, dShake * R.shake.strong), Math.min(1, R.shake.weak0 + dShake * R.shake.weak), R.shake.ms0 + dShake * R.shake.ms);
    if (dStop > R.hitstop.min) rumble(Math.min(1, dStop * R.hitstop.strong), Math.min(1, dStop * R.hitstop.weak), R.hitstop.ms0 + dStop * 1000);
    if (prevHp >= 0 && hp < prevHp - 0.5){ const n = prevHp - hp; rumble(Math.min(1, R.hurt.strong0 + n * R.hurt.per), R.hurt.weak, R.hurt.ms0 + n * R.hurt.msPer); }
    if (slow < R.slowmo.below && prevSlow >= R.slowmo.below) rumble(R.slowmo.strong, R.slowmo.weak, R.slowmo.ms);
    if (locked) rumble(Math.min(1, R.lock.strong + Math.abs(L.bal || 0) * R.lock.bal + (L.surge ? R.lock.surge : 0)), R.lock.weak, R.lock.ms);
  }
  prevShake = G.shake; prevStop = G.hitstop; prevHp = hp; prevSlow = slow;
  if (!live){ stop(gp); return; }
  if (pend.ms <= 0 || t - lastSend < RUMBLE.gap) return;
  // a weaker pulse never cuts short a stronger one still playing
  const left = playing.until - t;
  if (left > 0 && pend.s + pend.w < (playing.s + playing.w) * 0.8){ pend = { s: 0, w: 0, ms: 0 }; return; }
  const s = Math.min(1, pend.s * scale), w = Math.min(1, pend.w * scale), ms = Math.round(Math.min(600, pend.ms));
  pend = { s: 0, w: 0, ms: 0 };
  if (s < 0.02 && w < 0.02) return;
  try { gp.vibrationActuator.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: s, weakMagnitude: w })?.catch?.(() => {}); } catch(e){ return; }
  playing = { s, w, until: t + ms }; lastSend = t; quiet = false;
}
