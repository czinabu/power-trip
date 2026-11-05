// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE BENCH'S SIDEGRADE (data/hero-benches.js names each hero's): the Jedi's fitted kyber crystal (data/saber-parts.js),
// the trooper's power pack (data/trooper-locker.js) or the Mando's forged beskar (data/beskar-forge.js) nudges the run's
// numbers (player.up) one small way and pays for it another. It is put on as every level starts and as a saved run
// loads (game/flow.js startLevel, game/saves.js), in every mode: the campaign, missions, arcade, survival, the battle sim,
// training and the sandbox, and in co-op each player's browser attunes its own hero, so a partner fights with their own.
// The part is chosen on the hero's bench between runs.
//
// player.up._att remembers which part is on ('<row>:<id>'; a bare id is a crystal, as saves from before the locker
// wrote it), so attuning again (a new level, a loaded save that carried an older part, a switch to another hero) first
// takes the old one off exactly: it never stacks.
//
// The trooper's SQUAD SPECIALIST is the locker's other sidegrade: it changes a squadmate, not player.up, so it is read
// where the squad is called in (allies/squad.js addSquadmate, through squadSpecialist below).

import { G, player } from '../state.js';
import { CRYSTALS } from '../data/saber-parts.js';
import { SIDE_ROW, sideParts } from '../data/hero-benches.js';
import { specialistOf } from '../data/trooper-locker.js';
import { CUSTOMIZE, wornOption } from '../data/customize.js';
import { loadPicks } from '../player/mesh.js';

const rowOf = (hero, id) => CUSTOMIZE[hero] && CUSTOMIZE[hero].find(r => r.id === id);
// the part the hero has fitted in a bench row (the pick, if earned: data/customize.js wornOption)
export const wornPart = (hero, rowId) => { const R = rowOf(hero, rowId); return R ? wornOption(hero, R, (loadPicks()[hero]) || {}).id : null; };
// the sidegrade part the hero carries: { key, part }
function wornSide(hero){
  const row = SIDE_ROW[hero], list = sideParts(hero), id = row && wornPart(hero, row);
  const part = list.find(p => p.id === id) || list[0];
  return part ? { key: hero === 'jedi' ? part.id : row + ':' + part.id, part } : null;
}
export const wornCrystal = () => wornSide('jedi').part;
// what a stored _att names: a crystal by its bare id, anything else by '<row>:<id>'
function partOfKey(key){
  if (!key) return null;
  const i = key.indexOf(':');
  if (i < 0) return CRYSTALS.find(c => c.id === key) || null;
  const row = key.slice(0, i), id = key.slice(i + 1);
  for (const hero in SIDE_ROW) if (SIDE_ROW[hero] === row) return sideParts(hero).find(p => p.id === id) || null;
  return null;
}

function put(up, c, sign){
  for (const [k, op, v] of c.fx){
    if (op === '*'){ const base = up[k] == null ? 1 : up[k]; up[k] = sign > 0 ? base * v : base / v; }
    else up[k] = (up[k] || 0) + v * sign;
  }
}
// attune player.up to the hero's fitted sidegrade part
export function attune(up = player.up){
  if (!up) return null;
  const want = wornSide(G.hero);
  if (up._att && want && up._att === want.key) return want.part;
  const had = partOfKey(up._att);
  if (had) put(up, had, -1);
  delete up._att;
  if (want && want.part.fx && want.part.fx.length){ put(up, want.part, 1); up._att = want.key; }
  return want && want.part;
}
// the trooper's squad specialist: SGT. VANT's kit (data/trooper-locker.js SPECIALISTS), or null for a plain rifleman
export function squadSpecialist(){
  const s = specialistOf(wornPart('trooper', 'specialist'));
  return s.role ? s : null;
}
