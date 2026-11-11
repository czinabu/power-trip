// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MISSION MEDALS, kept while a mission plays (data/medals.js has the goals and the par times). game/mission.js starts
// the count when a mission starts fresh (a retry keeps it: the clock runs on, and the fall is counted), tells it what
// happened (note: an evacuee down, the quarry away, a console set back...), and settles it on the win.
//
// CO-OP: what happens to the mission itself (the line, the escort, the quarry, the consoles, the squad) the host sees,
// and sends with its snapshot (missed()); a guest adds it to its own. What happens to a hero (a fall, a duel's health)
// each screen counts for itself, and each keeps its own clock from when it joined the mission.

import { G, player } from '../state.js';
import { maxHp } from '../player/helpers.js';
import { allies } from '../allies/squad.js';
import { MEDALS, MEDAL_BIT, MISSED_BY, DUEL_HP, ESCORT_HP, bonusOf, parTime } from '../data/medals.js';

const T = { on: false, id: null, def: null, hero: null, t0: 0, missed: new Set(), host: [], wasDown: false };

// is this mission one that keeps medals? story missions (from the Missions page, or played as a campaign chapter: a story's
// own campaign-only missions count there) and side missions; an arcade contract shows its three but keeps none (each one
// is dealt once); a raid has none at all
export const keepsMedals = (def) => !!def && !def.raid && !def.arcade;
export const showsMedals = (def) => !!def && !def.raid;

export function medalsBegin(def, retry){
  if (retry && T.on && T.id === (def && def.id)) return;   // the same mission again from a checkpoint: the count runs on
  Object.assign(T, { on: showsMedals(def), id: def && def.id, def, hero: G.hero, t0: G.gt, missed: new Set(), host: [], wasDown: false });
}
export function medalsEnd(){ T.on = false; }
// something that counts against a goal (data/medals.js MISSED_BY): fell · evacuees · escort · chase · slice · squad · duel · seen
export function medalNote(what){ if (T.on) T.missed.add(what); }
// every frame of a mission (host and guest): the hero's own falls, a duel's health, the squad, the escort's health
export function medalsTick(o, vip){
  if (!T.on) return;
  const down = !!player.downed || G.mode === 'dead';
  if (down && !T.wasDown) T.missed.add('fell');
  T.wasDown = down;
  if (o && o.kind === 'duel' && player.hp != null && player.hp < maxHp() * DUEL_HP) T.missed.add('duel');
  if (!G.coopGuest && allies.some(a => !a.net && a.state === 'down')) T.missed.add('squad');
  if (vip && vip.maxHp && vip.hp < vip.maxHp * ESCORT_HP) T.missed.add('escort');
}
// host: what the mission itself has missed, for the guest (game/mission.js missionSnap); guest: the host's, taken in
export const medalsMissed = () => T.on ? [...T.missed].filter(k => k !== 'fell' && k !== 'duel') : [];
export function medalsHostMissed(list){ if (T.on && Array.isArray(list)) for (const k of list) if (typeof k === 'string') T.missed.add(k); }

// the win: which medals this run took ({ clear, par, bonus } true/false), with its time, par and goal
export function medalsResult(){
  if (!T.on || !T.def) return null;
  const time = Math.max(0, G.gt - T.t0), par = parTime(T.def, T.hero), bonus = bonusOf(T.def, T.hero);
  const missedBonus = MISSED_BY[bonus].some(k => T.missed.has(k));
  const got = { clear: true, par: time <= par, bonus: !missedBonus };
  let bits = 0; for (const m of MEDALS) if (got[m]) bits |= MEDAL_BIT[m];
  return { id: T.id, hero: T.hero, time, par, bonus, got, bits, keep: keepsMedals(T.def) };
}
// dev console / smoke test
export const medalsState = () => ({ on: T.on, id: T.id, missed: [...T.missed], time: T.on ? G.gt - T.t0 : 0 });
