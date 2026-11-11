// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE MANDO'S LOADOUT, in play: which guns sit on 1 (the SIDEARM) and 2 (the PRIMARY), and what happens when a run hands
// the hero a new one (data/mando.js ARMORY_PATH, granted by the auto-unlocks in data/store.js). A gun for an empty slot
// goes straight into it; one for a slot that's already full opens the armory (ui/armory-ui.js) so the hero picks which
// to carry, the Mando's version of the Jedi's meditation. The training grounds, a lone mission and the sandbox set the
// loadout themselves and never stop to ask.

import { G, player } from '../state.js';
import { MANDO_WEAPONS, KIT_SLOTS, ARMORY_PATH, cleanKit, kitOf, bestKit } from '../data/mando.js';
import { zoneReached } from './zone-gate.js';
import { switchWeapon } from '../player/mando/weapons.js';

// a run that stops to choose: the campaign and survival (not the training grounds, a lone mission or the sandbox)
export const armoryTaught = () => G.hero === 'mando' && !G.training && !G.sandbox && !(G.mission && G.chapter < 0);

let pickHook = () => {};
export function setArmoryPickHook(fn){ pickHook = fn; }   // ui/armory-ui.js: queue the choice screen

// put a loadout in hand: cleaned against what the hero owns; a gun in hand that's no longer carried goes back to the
// armory and the sidearm comes out instead
export function setKit(kit){
  G.mandoKit = cleanKit(kit);
  const W = MANDO_WEAPONS[player.weapon];
  if (G.hero === 'mando' && W && W.slot && G.mandoKit[W.slot] !== player.weapon){
    player.weapon = 'fists';   // (so switchWeapon below always runs, and says what came out)
    switchWeapon(G.mandoKit[W.slot] || G.mandoKit.sidearm);
  }
  // a holstered hero draws what's carried, not a gun left in the armory
  if (player.drawnWeapon && MANDO_WEAPONS[player.drawnWeapon] && MANDO_WEAPONS[player.drawnWeapon].slot && !KIT_SLOTS.some(s => G.mandoKit[s] === player.drawnWeapon)) player.drawnWeapon = G.mandoKit.sidearm;
  return G.mandoKit;
}

// the run is handed gun `id` (data/store.js MANDO_AUTO)
export function grantGun(id){
  const W = MANDO_WEAPONS[id];
  G.unlocked[id] = true;
  if (!W || !W.slot) return;
  const kit = { ...kitOf() };
  if (!kit[W.slot]){
    kit[W.slot] = id; setKit(kit);
    if (G.hero === 'mando' && G.mode === 'play' && armoryTaught()) switchWeapon(id);   // a new gun in a run: it comes out to try
  } else if (kit[W.slot] !== id && armoryTaught() && !G.kitQuiet && !G.hub) pickHook(id);   // (in a hub it just goes in the armory, no pick on the spot)   // (a veteran's kit handed over at once, Act IV: game/gate.js, takes the best instead)
}

// a lone mission (and a co-op guest, who skips the page before the fight): the kit picked before the fight, else the best
export function missionKit(){
  // the mission hands over what was picked, if this hero's own story has handed it out (game/zone-gate.js loneMission)
  const earned = (id) => { const p = ARMORY_PATH.find(q => q.weapon === id); return !p || zoneReached(p); };
  const kit = G.missionKit && Object.fromEntries(KIT_SLOTS.map(s => [s, earned(G.missionKit[s]) ? G.missionKit[s] : null]));
  if (kit) for (const s of KIT_SLOTS){ const id = kit[s]; if (id) G.unlocked[id] = true; }
  setKit(kit ? { ...kit, sidearm: kit.sidearm || 'single' } : bestKit());
}
