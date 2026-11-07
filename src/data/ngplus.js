// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// NEW GAME+, as data (game/ngplus.js runs it). Edit the words and numbers freely.
//
// A hero who has beaten their campaign can play it again as NEW GAME+: the same story from chapter 1, with a fresh run's
// build but everything the PROFILE keeps (rank, bench parts, looks, light and dark). Each NG+ beaten opens
// the next TIER, up to MAX_TIER. A tier makes every foe a little tougher and hit a little harder (stacked on the chosen
// difficulty), and deals each chapter its own MUTATORS: one at tier I, two at tier II, three at tier III. Which ones is fixed
// by the chapter and the tier (a retry, a reload and every co-op player see the same), so a chapter has a character.
//
// THE GUARDRAIL: NG+ pays more rank XP and its own legendary parts (looks only: data/saber-parts.js `earn: { ng }`), never
// raw numbers, so a ranked hero coming out of it stands level with a fresh one in every other mode.
//
// Leaf data but for the shared state: the foes' hooks (enemies/ai.js, elites.js, damage.js) ask mutOn() every frame.
import { G } from '../state.js';

export const MAX_TIER = 3;
export const ROMAN = ['', 'I', 'II', 'III'];
export const tierName = (t) => 'NEW GAME+' + (t > 0 ? ' ' + ROMAN[t] : '');

// each tier, on top of the difficulty preset: foe durability, the damage you take, and the run's XP (a harder run levels faster)
export const NG_TIERS = [
  null,
  { hp: 1.15, dmg: 1.1, xp: 1.15, muts: 1 },
  { hp: 1.3, dmg: 1.2, xp: 1.3, muts: 2 },
  { hp: 1.45, dmg: 1.3, xp: 1.45, muts: 3 },
];

// THE MUTATORS a NG+ chapter (or a veteran side mission, data/side-quests.js `muts`) runs with. The first five are the
// survival waves' own (data/mutators.js) and use the same hooks; VANGUARD is NG+'s own. They stack.
export const NG_MUTATORS = [
  { id: 'ironhide', name: 'IRONHIDE', col: '#9cc8e8', tip: 'foes are 40% tougher' },
  { id: 'berserk',  name: 'BERSERK',  col: '#ff6a4a', tip: 'foes move faster' },
  { id: 'volatile', name: 'VOLATILE', col: '#ff9a3a', tip: 'every foe erupts when it falls' },
  { id: 'marksmen', name: 'MARKSMEN', col: '#7fd4ff', tip: 'their bolts fly faster' },
  { id: 'frenzy',   name: 'FRENZY',   col: '#ff5a5a', tip: 'foes hit 25% harder' },
  { id: 'vanguard', name: 'VANGUARD', col: '#d6b23a', tip: 'far more elites' },
];
export const mutatorById = (id) => NG_MUTATORS.find(m => m.id === id) || null;
export const NG_FRENZY = 1.25;        // FRENZY outside survival: the damage foes deal
export const NG_VANGUARD = 0.25;      // VANGUARD: added to the elite odds (capped at VANGUARD_CAP)
export const VANGUARD_CAP = 0.55;

// RANK XP for a NG+ run (data/profile.js RANK_XP has the first run's): a chapter cleared, and the campaign beaten
export const NG_XP = { chapter: 60, won: 400 };

// the words: the campaign tile, the NEW GAME+ button and its card, the chapter card's strip
export const NG_WORDS = {
  button: (t) => tierName(t),
  locked: 'Beat the campaign to unlock NEW GAME+',
  confirm: (t) => 'Start ' + tierName(t) + '? Your rank, tree, deck, parts and looks stay. The story starts again from chapter 1 with a fresh build, tougher foes and ' + NG_TIERS[t].muts + ' mutator' + (NG_TIERS[t].muts === 1 ? '' : 's') + ' on every chapter.',
  strip: (t) => tierName(t) + ' · FOES +' + Math.round((NG_TIERS[t].hp - 1) * 100) + '% TOUGHER',
  won: (t) => t >= MAX_TIER ? 'You have beaten every tier of NEW GAME+.' : tierName(t + 1) + ' is open.',
};

/* ---------- read by the fight (cheap: called per foe per frame) ---------- */
// is this mutator on right now? A survival wave's (G.mut) or the NG+ chapter's / veteran side mission's (G.ngMuts)
export const mutOn = (id) => G.mut === id || (G.ngMuts.length > 0 && G.ngMuts.includes(id));
// the NG+ tier's multiplier on `k` ('hp', 'dmg', 'xp'): a campaign chapter of a NG+ run only
export function ngScale(k){
  const T = G.chapter >= 0 && G.ngPlus > 0 && NG_TIERS[Math.min(MAX_TIER, G.ngPlus)];
  return T ? T[k] : 1;
}

/* ---------- which mutators a chapter deals: fixed by its id and the tier ---------- */
function hash(str){ let h = 2166136261; for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function chapterMutators(chapterId, tier){
  if (!(tier > 0) || !chapterId) return [];
  const n = NG_TIERS[Math.min(MAX_TIER, tier)].muts, pool = NG_MUTATORS.map(m => m.id), out = [];
  let h = hash(chapterId + '#ng');   // (the same seed every tier: a tier keeps the one before's and adds to it)
  while (out.length < n && pool.length){ h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
  return out;
}
