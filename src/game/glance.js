// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GLANCE: a quick look at something without leaving play. The view swings round to face a spot (the next objective,
// as one is handed off: game/mission.js), holds there a moment, and is yours again. No letterbox, no lock: the hero still
// moves and fights through it, and the moment you turn the view yourself (mouse or right stick) the glance lets go.
// It turns the play camera's own heading (G.yaw), so it works for every hero's rig and leaves you facing the way to go.

import { G, player } from '../state.js';
import { playerPos } from '../player/helpers.js';

export const GLANCE = { delay: 0, turn: 0.7, hold: 1.1, near: 6, pitch: [-0.05, 0.32] };

let L = null;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (k) => k * k * (3 - 2 * k);

// look at (x, z): after `delay` seconds the view swings there over `turn` and holds for `hold`. A spot the hero is
// already standing by is not worth a look; neither is one while locked on a foe (the lock owns the view)
export function glanceAt(x, z, opts = {}){
  const o = { ...GLANCE, ...opts };
  L = { x, z, t: -o.delay, turn: o.turn, hold: o.hold, near: o.near, from: null, set: null };
}
export function cancelGlance(){ L = null; }
export const glancing = () => !!L && L.t >= 0;

// once a frame, before the camera (main.js); dt is the sim's (held while paused or in a scene)
export function updateGlance(dt){
  if (!L) return;
  if (G.mode !== 'play' || G.cutscene || player.lockTarget || player.downed){ L = null; return; }
  if (!dt) return;
  // the player turned the view themselves since the last frame: theirs again
  if (L.set != null && (Math.abs(wrap(G.yaw - L.set.yaw)) > 1e-4 || Math.abs(G.pitch - L.set.pitch) > 1e-4)){ L = null; return; }
  L.t += dt;
  if (L.t < 0) return;
  const p = playerPos();
  if (!L.from){
    if (Math.hypot(L.x - p.x, L.z - p.z) < L.near){ L = null; return; }
    L.from = { yaw: G.yaw, pitch: G.pitch };
  }
  const want = Math.atan2(L.x - p.x, L.z - p.z);   // (the view's heading: yaw 0 looks down +z)
  const k = ease(Math.min(1, L.t / L.turn));
  G.yaw = L.from.yaw + wrap(want - L.from.yaw) * k;
  // a view tipped far down at the hero's feet (or up at the sky) levels out enough to see the spot
  const pw = Math.min(GLANCE.pitch[1], Math.max(GLANCE.pitch[0], L.from.pitch));
  G.pitch = L.from.pitch + (pw - L.from.pitch) * k;
  L.set = { yaw: G.yaw, pitch: G.pitch };
  if (L.t >= L.turn + L.hold) L = null;
}
