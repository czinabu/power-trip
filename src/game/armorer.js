// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARMORER FORGES: the Mandalorian's beskar grows as his story goes (the Jedi's Force Level rise, in metal). At the
// close of a chapter in data/beskar-forge.js ARMORER_FORGES, the piece it opens is struck onto the armour as the cutscene
// hands him back: a beat across the screen (ui/force-toast.js, kind 'forge'), sparks and a hammer ring on the hero
// (fx/force-rise.js forgePulse), and the model wears it there and then (ui/customizer.js refreshWornLook).
//
// The piece goes on only where the slot is still the Armorer's to fill: nothing picked for it, or the last piece she put
// there (sw_forge_fit). A slot the player has picked for himself keeps his pick, and the beat says where the new piece
// waits. Once per piece: a replay or a co-op rejoin that had it already gets no beat. Every Mando screen does this for its
// own hero (game/flow.js checkUnlocks, at a chapter's close, host or guest), and a co-op partner sees the new piece as
// the picks are next sent (net/partner.js).

import { G } from '../state.js';
import { CUSTOMIZE } from '../data/customize.js';
import { ARMORER_FORGES } from '../data/beskar-forge.js';
import { optionOpen } from './wardrobe.js';
import { loadPicks, savePicks } from '../player/mesh.js';

const FIT = 'sw_forge_fit';
const fits = () => { try { return JSON.parse(localStorage.getItem(FIT)) || {}; } catch(e){ return {}; } };
const rowOf = (id) => (CUSTOMIZE.mando || []).find(r => r.id === id);
let refit = null;   // ui/customizer.js refreshWornLook, handed in (it loads after this)
export const armorerHooks = { set refit(fn){ refit = fn; } };

// the piece this chapter forges, and whether it's open yet: call before the chapter's close hands things out
export function forgeBefore(id){
  const F = G.hero === 'mando' && ARMORER_FORGES[id], row = F && rowOf(F.row), o = row && row.options.find(x => x.id === F.opt);
  return o ? { F, row, o, had: optionOpen('mando', row, o) } : null;
}
// ...and after: if it has just opened, fit it and say so. The beat, for ui/force-toast.js, or null
export function forgeAfter(b){
  if (!b || b.had || !optionOpen('mando', b.row, b.o)) return null;
  const picks = loadPicks(), mine = picks.mando || {}, last = fits();
  const free = mine[b.row.id] == null || mine[b.row.id] === last[b.row.id];
  if (free){
    picks.mando = { ...mine, [b.row.id]: b.o.id }; savePicks(picks);
    try { localStorage.setItem(FIT, JSON.stringify({ ...last, [b.row.id]: b.o.id })); } catch(e){}
    if (refit) refit();
  }
  const where = b.row.bench ? 'the BESKAR FORGE' : 'the customizer';
  return { kind: 'forge', lead: true, name: b.o.name.toUpperCase(), what: b.row.label, line: b.F.line, fitted: free,
           note: free ? 'Fitted now. Change it any time at ' + where + '.' : 'Waiting at ' + where + ': you picked your own for this slot.',
           covers: [b.row.id + ':' + b.o.id] };
}
