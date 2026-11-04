// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TEMPLE DOORS: the great doors in the Jedha courtyard's temple front (world/arenas/temple.js), shut in every mode.
// The Jedi's story opens them at the end of the siege (a chapter's `doorway`: game/aftermath.js runs it): they swing in,
// a passage opens past the edge of the play space (the movement clamp lets the hero into the doorway: player/locomotion.js),
// and walking through it fades the screen to black. The fade lifts when the next arena is built (world/arena.js), so the
// archive comes up out of the dark with the hero at its south doors.
//
// Co-op: the host's calm snapshot carries the doors' state (game/aftermath.js calmSnap), so a guest's doors open with the
// host's and its screen goes dark with the host's.

import { shared } from '../state.js';
import { S } from '../audio/sfx.js';
import * as THREE from 'three';

// state: 0 shut · 1 open (the passage is walkable) · 2 through (the fade is running)
const D = { doors: null, state: 0, open: 0, t: 0, then: null };
const SWING = 1.45, OPEN_TIME = 2.2, FADE_OUT = 1.1, FADE_IN = 1.3;

export function setTempleDoors(doors){ D.doors = doors; D.state = 0; D.open = 0; D.then = null; shared.passage = null; }
export const templeDoors = () => D.doors;
export const doorState = () => D.state;
// where to stand before the doors (inside the play space), and the point just past them that counts as through
export const doorFront = () => D.doors && { x: D.doors.x, z: shared.arenaHalfZ - 2.4 };
export const doorThrough = () => D.doors && { x: D.doors.x, z: D.doors.z + 2.6 };

// arena.js: a new arena. The old doors are gone, and the screen comes back up if it went dark going through them
export function resetDoorway(){
  D.doors = null; D.state = 0; D.open = 0; D.then = null; shared.passage = null;
  liftFade();
}

export function openDoors(){
  if (!D.doors || D.state >= 1) return;
  D.state = 1;
  const d = D.doors;
  S.slam(new THREE.Vector3(d.x, 2, d.z));
  // the passage: the doorway's width, from the edge of the play space to the far end of the hall behind
  shared.passage = { x: d.x, hw: d.w / 2 - 0.55, z0: shared.arenaHalfZ - 1, z1: d.z + d.depth - 1.2 };
}
// through the doors: the screen goes to black, then `then` (the chapter closes: game/aftermath.js)
export function goThrough(then){
  if (D.state >= 2) return;
  openDoors();
  D.state = 2; D.t = 0; D.then = then || null;
  fadeTo(1, FADE_OUT);
}

// every frame of play (main.js)
export function updateDoorway(dt){
  if (!D.doors) return;
  const want = D.state >= 1 ? 1 : 0;
  if (D.open !== want){
    D.open = want ? Math.min(1, D.open + dt / OPEN_TIME) : 0;
    const k = D.open * D.open * (3 - 2 * D.open);   // (eased: heavy doors start slow and settle)
    for (const h of D.doors.hinges) h.g.rotation.y = h.sx * k * SWING;    // both leaves swing in, away from the courtyard
  }
  if (D.state === 2 && D.then && (D.t += dt) >= FADE_OUT + 0.25){ const f = D.then; D.then = null; f(); }
}

/* the passage clamp (player/locomotion.js): true when the hero is in the open doorway, kept between its walls and short
   of its far end; false leaves the arena's own clamp to it */
export function passageHold(pp, r){
  const P = shared.passage;
  if (!P || pp.z < P.z0 - 0.4 || Math.abs(pp.x - P.x) > P.hw) return false;
  if (pp.z > P.z0 + 0.4) pp.x = Math.max(P.x - P.hw + r * 0.2, Math.min(P.x + P.hw - r * 0.2, pp.x));
  if (pp.z > P.z1) pp.z = P.z1;
  return true;
}

/* ---------- the fade to black ---------- */
let veil = null;
function veilEl(){
  if (veil) return veil;
  veil = document.createElement('div');
  veil.id = 'doorfade';
  veil.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:3;transition:opacity 1s ease';
  document.body.appendChild(veil);
  return veil;
}
export function fadeTo(v, secs){
  const el = veilEl();
  el.style.transition = 'opacity ' + secs + 's ease';
  el.style.opacity = String(v);
}
export function liftFade(){ if (veil && veil.style.opacity !== '0') fadeTo(0, FADE_IN); }
export const fadedOut = () => !!veil && veil.style.opacity === '1';
