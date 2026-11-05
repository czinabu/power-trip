// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// GUARD CUES (data/guard-rings.js): how bright a duellist's guard ring burns for this player (the GUARD RINGS setting,
// the difficulty and how many duels they have won), and the blade's own tells (it has read your cut; a blow turned).
// Run on the host from enemies/duel.js updateDuel and on a co-op guest from updatePuppetDuel, so both screens match.

import { G } from '../state.js';
import { clamp } from '../utils.js';
import { GUARD_RINGS, BLADE_CUE } from '../data/guard-rings.js';
import { BLADE } from '../fx/blade-glow.js';
import { noteDuelWon } from '../game/profile.js';

const KEY = 'sw_duelwins';
let wins = 0;
try { wins = parseInt(localStorage.getItem(KEY), 10) || 0; } catch(e){}
export const duelWins = () => wins;

// a guarding duellist went down: one more duel won (the ring fades with these on Knight)
export function duelWon(e){
  if (!e || e.converted || e._duelWon) return;
  const guards = e.dp ? e.dp.block >= 0.4 : e.ng ? e.ng[5] >= 40 : false;   // (the puppet's snapshot: enemies/duel.js NG.block)
  if (!guards) return;
  e._duelWon = true; wins++;
  try { localStorage.setItem(KEY, String(wins)); } catch(err){}
  noteDuelWon();   // rank XP for your profile (game/profile.js: real fights only)
}

// the ring's share of its full brightness right now: 0 hidden, 1 full
export function ringMul(){
  const m = G.guardRings || 'fading';
  if (m === 'off') return 0;
  if (m === 'always' || G.diff === 'padawan') return 1;
  if (G.diff === 'master') return 0;
  const L = GUARD_RINGS.learn, k = clamp((wins - L.after) / Math.max(1, L.by - L.after), 0, 1);
  return 1 + (GUARD_RINGS.ghost - 1) * k;
}
// the ring's opacity: its usual (closer is brighter), scaled for the setting; a turned blow lights even a ghost ring
export function ringOpacity(base, flash){
  const m = ringMul();
  if (m <= 0) return 0;
  return base * m + flash;   // (a ghost ring still lights up when a blow is turned on its line)
}

/* the blade's tell, every frame for a duellist with a lit saber: `read` while its guard has read your cut, `flash`
   (0..1, decaying) after it turns a blow. Swells the glow and brightens it; eases back to how it was built */
export function bladeCue(e, read, flash, dt){
  const gl = e.group.userData.bladeGlow;
  if (!gl || !gl.material) return;
  const u = gl.userData;
  if (u.cue0 == null){ u.cue0 = gl.material.opacity; u.cueS = gl.scale.x; }
  const R = BLADE_CUE.read, B = BLADE_CUE.block;
  const pulse = read ? 0.5 + 0.5 * Math.sin(G.gt * R.rate) : 0;
  e.bladeRead = clamp((e.bladeRead || 0) + (read ? 1 : -1) * dt * BLADE_CUE.decay, 0, 1);
  const k = e.bladeRead * (0.6 + 0.4 * pulse), f = clamp(flash || 0, 0, 1);
  const s = u.cueS * (1 + R.swell * k + B.swell * f);
  gl.scale.x = gl.scale.z = s;
  gl.material.opacity = Math.min(gl.material.isBladeGlow ? 2 : 1, u.cue0 + (R.bright * k + B.bright * f) * (gl.material.isBladeGlow ? BLADE.opacity : 1));   // (a blade glow's opacity is a brightness: fx/blade-glow.js)
}
