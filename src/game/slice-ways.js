// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// EVERY HERO SLICES THEIR OWN WAY (data/slice-ways.js has the numbers and the words): how fast a plain sabotage
// console is being worked this frame, by whoever is on it. game/mission.js asks once a frame per console (host only:
// a co-op guest's hero counts by where it stands, as every hero on a console always has).

import { G, player } from '../state.js';
import { players, targetable } from '../player/players.js';
import { squadIn } from '../allies/squad.js';
import { hostilesIn } from './objectives.js';
import { SLICE_WAY } from '../data/slice-ways.js';

const heroOf = (h) => h.local ? G.hero : h.hero || 'jedi';
export const partyHas = (hero) => players.some(h => (h.local || targetable(h)) && heroOf(h) === hero);

// c: the console ({ x, z, prog, charged }), r: how close counts, time: its full time. Returns { pace, way, on }:
// pace (work a second; below 0 a charge being pulled apart), way (whose way is working it, for the HUD), on (a hero on it)
export function sliceRate(c, r, time, dt){
  let pace = 0, way = null, on = false, mando = false;
  for (const h of players){
    if (!h.local && !targetable(h)) continue;
    if (Math.hypot(h.pos.x - c.x, h.pos.z - c.z) >= r) continue;
    on = true;
    const hero = heroOf(h);
    let k = 1, w = null;
    if (hero === 'jedi'){
      const J = SLICE_WAY.jedi;
      if (!h.local) { k = J.mul; w = 'rip'; }   // (a partner's Force is theirs to spend: it rips at the full pace)
      else if (player.force > J.min && dt > 0){ k = J.mul; w = 'rip'; player.force = Math.max(J.min, player.force - J.drain * dt); }
    } else if (hero === 'trooper'){
      const mates = squadIn(c.x, c.z, r);
      if (mates){ k = 1 + SLICE_WAY.trooper.perMate * mates; w = 'squad'; }
    } else if (hero === 'mando'){ mando = true; w = c.charged ? 'charge' : 'plant'; if (c.charged) k = 1 + SLICE_WAY.mando.burn * 0.5; }
    if (k > pace){ pace = k; way = w; }
  }
  // the Mando's charge: set once he has worked a share of it by hand, then it burns down on its own
  const C = SLICE_WAY.mando;
  if (mando && !c.charged && c.prog >= C.plant * time) c.charged = 'new';
  if (on){ if (c.charged && (!way || way === 'plant')) way = 'charge'; return { pace, way, on }; }
  if (c.charged) return { pace: hostilesIn(c.x, c.z, C.guard) ? -C.defuse : C.burn, way: 'charge', on };
  // the trooper's squad on a console with nobody else: they work it alone
  if (partyHas('trooper')){ const mates = squadIn(c.x, c.z, r); if (mates) return { pace: SLICE_WAY.trooper.alone, way: 'squad', on }; }
  return { pace: 0, way: null, on };
}
