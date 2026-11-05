// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CRYSTAL ATTUNEMENT (data/saber-parts.js has the crystals and their sidegrades): the Jedi's fitted kyber crystal nudges the
// run's numbers (player.up) one small way and pays for it another. It is put on as every level starts and as a saved run
// loads (game/flow.js startLevel, game/saves.js), in every mode: the campaign, missions, arcade, survival, the battle sim,
// training and the sandbox, and in co-op each player's browser attunes its own hero, so a partner fights with their own
// crystal. The crystal is chosen on the workbench between runs.
//
// player.up._att remembers which crystal is on, so attuning again (a new level, a loaded save that carried an older
// crystal, a switch to a hero with no saber) first takes the old one off exactly: it never stacks.

import { G, player } from '../state.js';
import { CRYSTALS, crystalOf } from '../data/saber-parts.js';
import { CUSTOMIZE, wornOption } from '../data/customize.js';
import { loadPicks } from '../player/mesh.js';

const ROW = CUSTOMIZE.jedi.find(r => r.id === 'saber');
// the crystal the Jedi wears (the pick, if earned: data/customize.js wornOption)
export const wornCrystal = () => crystalOf(wornOption('jedi', ROW, (loadPicks().jedi) || {}).id);

function put(up, c, sign){
  for (const [k, op, v] of c.fx){
    if (op === '*'){ const base = up[k] == null ? 1 : up[k]; up[k] = sign > 0 ? base * v : base / v; }
    else up[k] = (up[k] || 0) + v * sign;
  }
}
// attune player.up to the fitted crystal (none for the Mando and the trooper, whose numbers it leaves alone)
export function attune(up = player.up){
  if (!up) return null;
  const want = G.hero === 'jedi' ? wornCrystal() : null;
  const had = up._att && CRYSTALS.find(c => c.id === up._att);
  if (had && want && had.id === want.id) return want;
  if (had) put(up, had, -1);
  delete up._att;
  if (want && want.fx.length){ put(up, want, 1); up._att = want.id; }
  return want;
}
