// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE JEDI'S FORCE LEVEL, EACH FORM'S FORCE SHARE, AND FORM MASTERY.
//  · FORCE LEVEL (1-10) — how strongly the Force answers the hero. It rises once at the close of each chapter that teaches
//    a form or a power (the same beats as data/forms.js FORM_PATH and data/store.js), and every Force power grows with it.
//    The Force meter is untouched: it says how OFTEN you can cast, the level says how HARD.
//  · FORCE SHARE — the form in hand sets how much of the level's growth the powers get (Niman the most). It only ever
//    scales the GROWTH: a power on the chapter it arrives is exactly its tuning in data/config.js, in any form.
//  · FORM MASTERY (ranks I-III) — fighting in a form sharpens what it is good at and softens what it is bad at
//    (FORM_MASTERY: each field's value at Master, reached a third at a time), and adds FORM_RANK_SHARE to its share.
// game/flow.js checkUnlocks sets G.forceLevel; game/upgrades.js trainForm earns the ranks; player/helpers.js stance() and
// data/mastery.js abil() read them, so every mode that hands out the kit also sets the level.

import { onFileSwitch } from '../engine/save-files.js';
import { G, isGunner } from '../state.js';
import { STANCES } from './stances.js';
import { CFG } from './config.js';

export const FORCE_MAX = 10;
// each level and the chapter whose close brings it, with the same gates the unlocks it comes with use (data/store.js):
// `chapter` for the story, `level`/`wave` for the old level-by-level run, `stage` (waveTotal) for survival and a mission's kit
export const FORCE_LEVELS = [   // (`stage` keeps pace with the store, data/store.js: survival and a mission reach a power's level as it opens)
  { lv: 2,  chapter: 'siege',         level: 0, wave: 2, stage: 1 },    // Force Pull
  { lv: 3,  chapter: 'archive',       level: 0, wave: 3, stage: 2 },    // Makashi, Force Jump I
  { lv: 4,  chapter: 'trial-first',   level: 1, wave: 0, stage: 2 },    // Soresu, Saber Throw or Barrier
  { lv: 5,  chapter: 'trial-acrobat', level: 1, wave: 1, stage: 4 },    // Ataru, Jump Attack or Mend
  { lv: 6,  chapter: 'trial-knight',  level: 1, wave: 2, stage: 5 },    // Djem So, Force Jump II
  { lv: 7,  chapter: 'jakku',         level: 1, wave: 2, stage: 5 },    // Shien
  { lv: 8,  chapter: 'mustafar',      level: 1, wave: 3, stage: 6 },    // Niman, Judgement or Repulse
  { lv: 9,  chapter: 'chase',         level: 2, wave: 0, stage: 7 },    // Form VII, Dark Lord's Grip
  { lv: 10, chapter: 'spearhead',     level: 2, wave: 1, stage: 8 },    // Storm of Judgement or Force Nova
];

/* POWER GROWTH — per level held above the power's `arrive` level (the level its chapter brings), times the form's share.
   `mul`: +rate of the field per step · `add`: +rate per step (capped by `cap`). Keyed by data/mastery.js id, plus
   'grasp' (CFG.abilities.grasp, read in player/jedi/grasp.js, Dark Lord's Grip with it) and 'palm' (the holstered Force
   strikes, CFG.holster, player/jedi/palm.js). Storm of Judgement and Force Nova ride on Judgement's and Repulse's growth.
   Every power's Force COST falls with the same steps too (forceCostMul, below). Cooldowns never scale. Force Jump and
   Dash keep their heights and reach (the maps' perches are built to them): only what they cost in Force falls. */
export const POWER_GROWTH = {
  push:    { nm: 'FORCE PUSH',      arrive: 1, mul: { knock: 0.06, range: 0.03, angle: 0.02 }, show: ['knock', 'shove'] },
  palm:    { nm: 'FORCE STRIKES',   arrive: 1, mul: { dmg: 0.05, knock: 0.05, range: 0.02, reach: 0.02, radius: 0.02 }, show: ['dmg', 'damage'] },
  pull:    { nm: 'FORCE PULL',      arrive: 2, mul: { range: 0.03 }, show: ['range', 'reach'] },   // (its haul is Push's shove, grown with Push's: data/mastery.js abilAt)
  grasp:   { nm: 'FORCE GRASP',     arrive: 2, mul: { throwDmg: 0.07, bumpDmg: 0.07, maxT: 0.04, range: 0.03, multiAngle: 0.02 }, show: ['throwDmg', 'hurl'] },
  throw:   { nm: 'SABER THROW',     arrive: 4, mul: { dmg: 0.07, range: 0.03 }, show: ['dmg', 'damage'] },
  barrier: { nm: 'FORCE BARRIER',   arrive: 4, mul: { dur: 0.04, castKnock: 0.06, expireKnock: 0.06, knockR: 0.03 }, add: { dr: 0.01 }, cap: { dr: 0.9 }, show: ['dur', 'duration'] },
  jslam:   { nm: 'JUMP ATTACK',     arrive: 5, mul: { dmg: 0.07, strike: 0.07, radius: 0.03, knock: 0.06 }, show: ['strike', 'damage'] },
  mend:    { nm: 'FORCE MEND',      arrive: 5, add: { heal: 0.015 }, show: ['heal', 'heal'] },
  judge:   { nm: 'FORCE JUDGEMENT', arrive: 8, mul: { dmg: 0.07, time: 0.04, range: 0.03 }, show: ['dmg', 'damage'] },
  repulse: { nm: 'FORCE REPULSE',   arrive: 8, mul: { dmg: 0.07, radius: 0.03, knock: 0.06 }, show: ['dmg', 'damage'] },
};
// the Force moves that aren't powers above (no strength to grow, so only their Force cost follows the level):
// Force Jump (its take-off, hold and float), the Force Dash, the double jump and wall kick, and Ataru's-style air cut
export const MOVE_ARRIVE = { jump: 1, dash: 1, airCut: 1 };
/* FORCE COST — a stronger Force answers for less: a power's Force cost (and a held power's drain) drops COST_RATE for
   each step of growth (the same levels-above-arrival times the form's share), to COST_FLOOR at most. Held below its
   arrival level a power never costs more than its tuning. */
export const COST_RATE = 0.03, COST_FLOOR = 0.7;
/* THE COST FLOOR — power mastery, the Force Level, a form's cheaper casts (Niman), survival's cost boons and the palm
   flow all cut a cost, and they multiply. Together they never take a cast below COST_MIN of its base tuning
   (data/config.js), so a long survival run can't make the powers nearly free. A cost that rises (Djem So) is untouched. */
export const COST_MIN = 0.5;
export const floorCost = (cost, base) => Math.max(cost, base * COST_MIN);
// a Jedi power's base Force cost (keyed by data/mastery.js id, plus 'grasp')
export const baseCost = (id) => (CFG.abilities[id === 'jslam' ? 'slam' : id] || {}).cost || 0;
const FLOOR = 0.7;   // a power held below its arrival level (the sandbox's slider) shrinks at the same rates, to 70% at most

/* FORCE SHARE — the share of the level's growth each form draws on, before mastery (Caleb's ranking: Niman, Jar'Kai,
   Ataru, Form VII, the staff, Form V, Makashi and Soresu, Shii-Cho). Each mastery rank adds FORM_RANK_SHARE. */
export const FORCE_SHARE = { niman: 0.85, jarkai: 0.8, ataru: 0.75, juyo: 0.7, vaapad: 0.7, staff: 0.65,
                             djemso: 0.6, shien: 0.6, makashi: 0.55, soresu: 0.55, shiicho: 0.5 };
export const FORM_RANK_SHARE = 0.05;

/* FORM MASTERY — earned by fighting in the form (game/upgrades.js trainForm): a cut that lands is 1 point, a kill 2 more,
   and the form's SIGNATURE (`sig`, matched in trainForm) 2 more again. `need` is the total for each rank; a rank also waits
   `gap` stages (waveTotal, about a chapter each) after the form was first used, so mastery follows time with the form.
   `master` holds each field's value at Master (STANCES has the value it starts from): strengths up, weaknesses toward even. */
export const FORM_RANKS = { need: [160, 420, 820], gap: 1, names: ['', 'ADEPT', 'EXPERT', 'MASTER'] };
export const FORM_MASTERY = {
  shiicho: { sig: 'finisher', practice: 'Sarlacc Sweeps and disarms',
             master: { finisherArc: 1.45, disarm: 8, duelBlockMul: 1.0, dmg: 1.42 },
             lines: ['Sarlacc Sweep reaches further', 'Disarms last longer', 'Duellists read it less', 'Cuts hit a little harder'] },
  makashi: { sig: 'blade', practice: 'cuts on duellists and acolytes',
             master: { swordDmg: 1.55, readMul: 0.35, deflectScatter: 0.08, deflectStamMul: 1.25 },
             lines: ['More damage against blades', 'Reads more feints', 'Deflects fly truer and cost less'] },
  soresu:  { sig: 'guard', practice: 'blocks, parries and bolts sent home',
             master: { parryBonus: 0.2, chipMul: 0.12, guardDeflect: 0.35, blockStamMul: 0.3, dmg: 1.28 },
             lines: ['Wider parry window', 'Almost nothing gets through a held guard', 'Returns bolts from a wider front', 'Hits harder'] },
  ataru:   { sig: 'air', practice: 'air cuts, swoops and back-line kills',
             master: { airCutDmg: 1.5, backLineDmg: 1.8, heavyDmg: 1.0, deflectScatter: 0.05 },
             lines: ['Air cuts land harder', 'More damage on the back line', 'Less weak against armour'] },
  djemso:  { sig: 'heavy', practice: 'blows on brutes, the boss and finishers',
             master: { heavyDmg: 2.6, postureMul: 1.65, powerCostMul: 1.15, forceRegen: 0.85 },
             lines: ['Breaks armour and guards faster', 'Force powers cost less', 'Force comes back faster'] },
  shien:   { sig: 'deflect', practice: 'bolts sent home',
             master: { deflectDmg: 1.75, heavyDmg: 1.55, parryBonus: 0.07 },
             lines: ['Deflected bolts hit harder', 'Less weak against armour', 'Wider parry window'] },
  niman:   { sig: 'cast', practice: 'casting a power mid-fight',
             master: { powerCostMul: 0.75, dmg: 1.6, parryRefund: 20 },
             lines: ['Powers cost less', 'Cuts hit harder', 'Parries feed back more Force'] },
  juyo:    { sig: 'finisher', practice: 'finishers and kills',
             master: { furyDmg: 1.5, dmgTaken: 1.02, furyTaken: 1.2 },
             lines: ['Full fury hits harder', 'Leaves you less open'] },
  vaapad:  { sig: 'guard', practice: 'blocks and parries',
             master: { furyDmg: 1.6, shatter: 2.25, furyTaken: 1.15 },
             lines: ['Full fury hits harder', 'Shatterpoint cuts deeper', 'Leaves you less open'] },
  staff:   { sig: 'finisher', practice: 'spinning finishers',
             master: { dmg: 1.3, blockStamMul: 1.1, castMul: 1.1 },
             lines: ['Each blade bites deeper', 'Cheaper guard', 'Faster Force casts'] },
  jarkai:  { sig: 'finisher', practice: 'finishers and off-hand cuts',
             master: { offDmg: 0.75, deflectScatter: 0.08, powerCostMul: 1.1 },
             lines: ['Off-hand cuts land harder', 'Deflects fly truer', 'Force powers cost less'] },
};

/* ---------------- reading them ---------------- */
// the best rank each form has reached in any run (the training grounds and the sandbox fight with it)
const BEST_KEY = 'sw_formrank_jedi';
let best = null;
onFileSwitch(() => { best = null; });   // (another save file's: engine/save-files.js)
export function bestRanks(){
  if (best) return best;
  try { best = JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch(e){ best = {}; }
  return best;
}
export function noteBestRank(id, r){
  const b = bestRanks(); if ((b[id] || 0) >= r) return;
  b[id] = r; try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch(e){}
}
export function forceLevel(){
  if (isGunner()) return 0;
  if (G.duel) return 1;   // (a duel levels both fighters: game/duel-mode.js)
  if (G.sandbox && G.sbForceLevel) return G.sbForceLevel;
  return Math.max(1, Math.min(FORCE_MAX, G.forceLevel || 1));
}
export function formRank(id){
  if (!FORM_MASTERY[id] || G.duel) return 0;
  if (G.sandbox && G.sbFormRank != null) return G.sbFormRank;
  if (G.sandbox || G.training) return bestRanks()[id] || 0;
  return (G.formRank && G.formRank[id]) || 0;
}
// a form's share at a mastery rank (the forms page reads a saved run's ranks, not the one in play)
export const shareAt = (id, rank) => Math.min(1, (FORCE_SHARE[id] || 0.6) + (rank || 0) * FORM_RANK_SHARE);
export const forceShare = (id = G.stance) => shareAt(id, formRank(id));

const COST_KEYS = ['cost', 'drain'];
export const costMulFor = (steps) => Math.max(COST_FLOOR, 1 - COST_RATE * Math.max(0, steps));
// what a power's (or a Force move's: MOVE_ARRIVE) Force cost is multiplied by at this level, in the form in hand
export function forceCostMul(id, lv = forceLevel(), share = forceShare()){
  if (!lv || isGunner()) return 1;
  const g = POWER_GROWTH[id], at = g ? g.arrive : (MOVE_ARRIVE[id] || 1);
  return costMulFor((lv - at) * share);
}
// a power's tuning `v` (already with its power mastery) grown by the Force Level and the form's share. Changes v in place.
export function growPower(id, v, lv = forceLevel(), share = forceShare()){
  const g = POWER_GROWTH[id];
  if (!g || !lv || isGunner()) return v;
  const over = lv - g.arrive, steps = over >= 0 ? over * share : over;   // (below arrival: the full rate down, no share)
  if (!steps) return v;
  const cm = costMulFor(steps);
  for (const k of COST_KEYS) if (typeof v[k] === 'number') v[k] *= cm;
  for (const k in g.mul || {}) if (typeof v[k] === 'number') v[k] *= Math.max(FLOOR, 1 + g.mul[k] * steps);
  for (const k in g.add || {}) if (typeof v[k] === 'number'){
    const base = v[k];
    v[k] = Math.max(base * FLOOR, base + g.add[k] * steps);
    if (g.cap && g.cap[k] != null) v[k] = Math.min(Math.max(base, g.cap[k]), v[k]);   // (never pulled below what mastery gave)
  }
  return v;
}
// what a power's headline number gains at a level, in a form's share: '+30% shove' ('' at or below its arrival level)
export function growthGain(id, lv = forceLevel(), share = forceShare()){
  const g = POWER_GROWTH[id], steps = Math.max(0, lv - (g ? g.arrive : (MOVE_ARRIVE[id] || 1))) * share;
  if (!steps || !g || !g.show) return '';
  const [k, word] = g.show;
  return g.mul && g.mul[k] ? '+' + Math.round(g.mul[k] * steps * 100) + '% ' + word
    : k === 'heal' ? '+' + (Math.round(g.add.heal * steps * 1000) / 10) + '% ' + word
    : '+' + Math.round(g.add[k] * steps * 100) + '% ' + word;
}
// the same with the Force cost it saves: '+30% shove · −20% Force cost' (the level-up card)
export function growthLine(id, lv = forceLevel(), share = forceShare()){
  const cut = Math.round((1 - forceCostMul(id, lv, share)) * 100), cost = cut ? '−' + cut + '% Force cost' : '';
  const gain = growthGain(id, lv, share);
  return gain && cost ? gain + ' · ' + cost : gain || cost;
}
// the Force Level each Jedi power opens at (data/store.js `force`): the level its chapter brings
export const powerArrives = (id) => (POWER_GROWTH[id] || {}).arrive || 1;
// has the Force grown enough for a power that needs Force Level `need`? (the sandbox and the training grounds hand out their kit)
export function forceReady(need){
  if (!need || isGunner() || G.sandbox || G.training) return true;
  if (!(G.chapter >= 0 || G.endless || G.mission)) return true;   // (the old level-by-level run keeps its own gates)
  return forceLevel() >= need;
}

// the form's numbers at its mastery rank: STANCES[id] with each FORM_MASTERY field moved rank/3 of the way to its Master
// value. Cached per form and rank (stance() is read every frame); a form with no mastery, or rank 0, is STANCES[id] itself.
const cache = {};
export function masteredStance(id){
  const st = STANCES[id], m = FORM_MASTERY[id];
  if (!st || !m || isGunner()) return st;
  const r = formRank(id);
  if (!r) return st;
  const key = id + r;
  if (cache[key] && cache[key].src === st) return cache[key].st;
  const out = Object.assign({}, st), t = r / 3;
  for (const k in m.master){
    const from = st[k] != null ? st[k] : (k === 'chipMul' || k === 'readMul' || k === 'breakRes' ? 1 : 0);
    out[k] = from + (m.master[k] - from) * t;
  }
  cache[key] = { src: st, st: out };
  return out;
}
