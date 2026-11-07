// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// YOUR SAVE, CARRIED IN: a mode that starts a hero from scratch (survival, the hub) hands over everything this hero's own
// story has earned before its first fight, all at once and with no fanfare: the forms (Form VII the one kept), the powers,
// the guns and the gear (game/zone-gate.js storyCarries says which modes, and zoneReached what counts as earned). Survival
// still climbs from there as its waves go by. A lone mission, an arcade contract and a raid get the same through
// game/flow.js checkUnlocks as their kit is handed out (game/mission.js), so they don't call this.

import { G } from '../state.js';
import { checkUnlocks, missionFormRanks } from './flow.js';
import { autoLoadout } from './meditation.js';
import { setLoadout } from '../player/jedi/stance.js';
import { setKit } from './armory.js';
import { bestKit } from '../data/mando.js';
import { storyCarries, zoneFork } from './zone-gate.js';
import { refreshSandboxScope } from './sandbox-unlocks.js';

export function carryStoryKit(){
  if (!storyCarries()) return;
  refreshSandboxScope();   // (the hub's Force Level is the story's: read it as the save has it now)
  const was = G.kitQuiet; G.kitQuiet = true;
  try {
    const kept = zoneFork();   // (Form VII: the one this Jedi kept, once they're past the chapter that offers it)
    if (kept){ G.formFork = kept; (G.stanceUnlocked = G.stanceUnlocked || {})[kept] = true; }
    checkUnlocks();
    if (G.hero === 'jedi'){ missionFormRanks(0); setLoadout(autoLoadout()); }   // (the forms as practised as the story has them, the best three slotted)
    if (G.hero === 'mando') setKit(bestKit());
  } finally { G.kitQuiet = was; }
}
