// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE MANDO'S JETPACK ON HIS BACK: he starts the story without one, and the Armorer forges it at the close of Act I (data/store.js
// MANDO_AUTO 'jet1', the beat in game/flow.js checkUnlocks). The model wears it only while the run holds it
// (state.js ownsPack): the player's own model is rebuilt to match whenever the jet tier crosses 0 (game/progression.js
// applyJetTier), and a co-op partner is sent the same (net/partner.js `packless` on the picks, read by player/mesh.js lookOf).
//
// The rebuild waits for the end of the current task: a level's start resets the tier and then hands out its kit in the
// same breath, and the model should be rebuilt once, for where it ends up, not twice.

import { player, ownsPack } from '../state.js';

let refit = null;   // ui/customizer.js refitPack, handed in (it loads after this)
export const packHooks = { set refit(fn){ refit = fn; } };

// does the model on the player's back show the pack right now? (the pack variant sets player.jetGlow; the bare back clears it)
const worn = () => !!player.jetGlow;
let queued = false;
export function packChanged(){
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    if (worn() !== ownsPack() && refit) refit();
  });
}
// the picks as worn, with the pack left off while the run hasn't earned it (what a co-op partner is sent)
export const packPicks = (picks) => ownsPack() ? picks : { ...picks, packless: true };
