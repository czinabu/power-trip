// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SPARRING RULES (data/duel-guard.js DUEL_PVP): a duel between two players runs on the story's blade rules with the
// run-to-run edges taken out. They are on while a player-versus-player duel is (G.duel.pvp, set by the duel mode; G.pvp
// also turns them on, for a test). Outside one every rule here sleeps.
//   · the form counter's edge is scaled down (enemies/foeform.js matchup)
//   · the elite skill ramp is off (enemies/duel.js eliteRamp)
//   · a held guard costs a little stamina while nothing hits it (player/jedi/guardline.js)
// (The duel mode sets the run's upgrades, skills and Force level to base for the duel itself, and hands them back after.)

import { G } from '../state.js';
import { DUEL_PVP } from '../data/duel-guard.js';

export const pvpOn = () => !!(G.pvp || (G.duel && G.duel.pvp));

// the form counter's edge in a sparring duel: `k` (−1 … 1, enemies/foeform.js edgeOn) scaled down
export const pvpEdge = (k) => (pvpOn() ? k * DUEL_PVP.matchup : k);
