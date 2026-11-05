// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// INTERACT: F, for every hero in every mode (Y on a pad, which sends F). While a prompt is up (a station in the temple:
// game/hub.js, or someone on your side to talk to in a lull: game/talk.js) a tap of F answers it; anywhere else F is the
// hero's own power (Force Push, the flamethrower, the trooper's grenade), so a fight never loses it. engine/input.js
// asks here first.

import { G } from '../state.js';
import { talkTap, talkReady } from './talk.js';

export const INTERACT_KEY = 'F';   // the label the prompts show (padKeys turns it into the pad's button)

let hubTap = () => false, hubNear = () => null;
export function setHubInteract(tap, near){ hubTap = tap; hubNear = near; }   // the temple's stations (game/hub.js)

// is there something F would answer right now?
export const interactReady = () => !!(G.hub && hubNear()) || talkReady();

// F was tapped: open the station you're at, or talk to whoever the prompt is over. True when it did (F does nothing else)
export function interactTap(){
  if (G.mode !== 'play' || G.paused) return false;
  if (G.hub && hubTap()) return true;
  return talkTap();
}
