// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// REMIXES: a story mission played again on its own map, with a signature twist it never had (data/twist-deck.js) and
// another side's troops in its foes' place. Clear a mission from the Missions page or the campaign, and its remix opens
// for that hero; a remix earns medals of its own (its source mission's goals and par time: data/medals.js).
//
// A remix's id is 'remix:<mission id>', and REMIX OF THE WEEK's is 'remix:<mission id>:<week>': one mission every hero
// can play, picked for the week, with that week's own twist and faction, open whether or not it's been cleared. The
// same id always builds the same mission (seeded dice, like the arcade's), so a co-op guest and a reload play exactly
// the one the host picked. data/arcade.js missionById builds them.
//
// Tuning: FACTIONS (whose troops can stand in), and the twists' own settings in data/twist-deck.js.

import { MISSIONS } from './missions.js';
import { dice } from './arcade.js';
import { dealTwists, deckName, fitsOn } from './twist-deck.js';
import { PURGE, TURNED } from './allies.js';
import { CHOIR } from './missions-gate.js';

export const REMIX_PREFIX = 'remix:';
export const isRemixId = (id) => typeof id === 'string' && id.startsWith(REMIX_PREFIX);

// whose troops a remix sends in (a look per enemy type, data/foe-looks.js style: what isn't listed keeps its own)
const IRON = { model: 'storm', color: 0x4a4a52, eye: 0xffa040, cloth: 0x2a2a30 };
const RED = { model: 'storm', color: 0x8a1a1a, eye: 0xffd27a, cloth: 0x2a0a0a };
export const FACTIONS = [
  { key: 'empire', name: 'THE EMPIRE', look: null },
  { key: 'purge', name: 'THE PURGE', look: PURGE },
  { key: 'turned', name: 'THE TURNED', look: TURNED },
  { key: 'choir', name: 'THE HOLLOW CHOIR', look: CHOIR },
  { key: 'iron', name: 'THE IRON GUARD', look: { blaster: IRON, grenadier: IRON, sniper: IRON, officer: { ...IRON, model: 'officer', cloth: 0x4a4a52 } } },
  { key: 'red', name: 'THE CRIMSON GUARD', look: { blaster: RED, grenadier: RED, sniper: RED, officer: { ...RED, model: 'officer', cloth: 0x8a1a1a } } },
];

// every story mission that can be remixed: one that stands on its own on the Missions page, with an objective a
// twist from the deck can go on
export const remixable = (m) => !!m && !m.campaignOnly && !m.trial && !m.raid && !!m.objectives
  && m.objectives.some(o => fitsOn(o, m).length);
export const REMIX_POOL = () => Object.values(MISSIONS).filter(remixable);

// the week (Monday to Sunday, UTC) and the remix it features: one any hero can play
export const thisWeek = () => Math.floor((Date.now() / 86400000 + 3) / 7);
export function weeklyRemixId(week = thisWeek()){
  const pool = REMIX_POOL().filter(m => !m.heroes);
  if (!pool.length) return null;
  const r = dice(0x5eed + week * 7919);
  return REMIX_PREFIX + r.pick(pool).id + ':' + week;
}
export const remixIdFor = (missionId) => REMIX_PREFIX + missionId;
export function parseRemixId(id){
  if (!isRemixId(id)) return null;
  const [mid, wk] = id.slice(REMIX_PREFIX.length).split(':');
  return { mid, week: wk != null ? parseInt(wk, 10) : null };
}

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const clone = (v) => JSON.parse(JSON.stringify(v));
const cache = new Map();
// the mission a remix id builds, or null
export function remixMission(id){
  if (cache.has(id)) return cache.get(id);
  const p = parseRemixId(id), src = p && MISSIONS[p.mid];
  if (!remixable(src)) return null;
  const r = dice(hash(id) || 1);
  const objectives = clone(src.objectives);
  const sig = dealTwists(objectives, src, r, 1, objectives.map(o => o.twist && o.twist.kind).filter(Boolean));
  // another side's troops: never the ones the mission already sends
  const own = src.foeLook || null, pick = r.pick(FACTIONS.filter(f => f.look !== own));
  const def = {
    ...src,
    id, remix: true, weekly: p.week != null, week: p.week, source: src.id,
    title: src.title,   // (the page and the HUD add REMIX)
    faction: pick.name, sig: sig.map(deckName),
    blurb: src.blurb + ', remixed: ' + sig.map(deckName).join(', ').toLowerCase() + ', against ' + pick.name.toLowerCase(),
    level: { ...src.level, name: 'REMIX — ' + src.level.name.replace(/^[A-Z ]+\s*—\s*/, '') },
    foeLook: pick.look || undefined,
    campaignOnly: false, story: undefined, opening: undefined,
    objectives,
  };
  cache.set(id, def);
  return def;
}
