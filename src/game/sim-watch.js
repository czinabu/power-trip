// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SIM WATCH — two listeners for the headless combat sims (tools/duel-sim, trooper-sim, mando-sim), so a bot can see what a
// player sees and a report can say who did the work. Both are null in play; nothing in the game reads them.
//   tell(kind, pos, radius, dur)   every attack tell as it flashes (fx/tells.js tellFx): the duel bot dodges the red ones
//   hit(e, dmg, opts)              every blow that lands on a foe (enemies/damage.js damageEnemy): opts.ally marks a squadmate's
// (window.GAME.simWatch)
export const SIM_WATCH = { tell: null, hit: null };
