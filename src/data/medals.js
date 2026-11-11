// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MISSION MEDALS, as data: three to earn on every story mission and side mission (the Missions page shows them on the
// card; a story's campaign-only missions keep theirs too, won as chapters), kept for each hero on the PROFILE
// (game/profile.js noteMedals) with the mission's best time. game/medals.js keeps count while a mission plays; edit the
// words, the par times and the goals freely.
//
//   CLEAR   win the mission (any difficulty, solo or co-op, from the Missions page or as a campaign chapter)
//   PAR     win it inside its par time: the clock runs from the mission's start, through every retry, to the win
//   BONUS   win it with its bonus goal kept (BONUS below: one goal per mission, `bonus` in MISSION_MEDALS)
//
// Par times are worked out from the mission's own objectives (parTime: each kind's PAR cost, the map's spread) unless
// MISSION_MEDALS gives one (`par`, seconds). A bonus goal is MISSION_MEDALS' `bonus`, else the first that fits the
// mission (defaultBonus). Either can differ per hero: { jedi, mando, trooper }.
// A remix (data/remixes.js) keeps its source mission's goals and par time, with medals of its own.
// An arcade contract shows its three on the results screen too, but keeps nothing (each one is dealt once). Raids,
// survival and the sandbox have none.

import { SPREAD, GROW } from './map-scale.js';

export const MEDALS = ['clear', 'par', 'bonus'];
export const MEDAL_BIT = { clear: 1, par: 2, bonus: 4 };
export const MEDAL_NAME = { clear: 'CLEAR', par: 'PAR TIME', bonus: 'BONUS GOAL' };
export const MEDAL_COL = { clear: '#c8d2dc', par: '#7fd4ff', bonus: '#ffd24a' };

/* THE BONUS GOALS. `line` is what the Missions page and the results screen say (per hero where they'd say it
   differently); `fits(def)` whether a mission has what the goal needs. game/medals.js marks a goal missed:
     fell      the hero went down for good (a retry), or was knocked down in co-op
     evacuees  someone in a line being got out (a hold's `evacuees`) was put down
     escort    the escort dropped below half its health, or fell
     chase     the quarry got away (a pursuit leg restarted)
     slice     a hit knocked slicing progress off a console
     squad     a squadmate went down
     duel      the hero dropped below half health in a duel
     seen      a guard, a camera or a light saw a hero on an infiltrate (game/infiltrate.js: the meter passed SPOT)
   A goal that is never missed is kept. */
export const BONUS = {
  deathless: { line: 'Win without falling once', fits: () => true },
  evacuees: { line: 'No one in the line goes down', fits: (d) => d.objectives.some(o => o.kind === 'hold' && o.evacuees) },
  escort:   { line: 'Keep the escort above half health', fits: (d) => !!d.escort && d.objectives.some(o => o.kind === 'escort') },
  chase:    { line: 'Never let the quarry get away', fits: (d) => d.objectives.some(o => o.kind === 'pursuit') },
  slice:    { line: 'Never lose slicing progress to a hit', fits: (d) => d.objectives.some(o => o.kind === 'sabotage' && o.hitLoss) },
  squad:    { line: { jedi: 'No squadmate goes down', mando: 'No one at your side goes down', trooper: 'Bring the whole squad home: no one goes down' },
              fits: (d) => !!d.squad || d.objectives.some(o => o.squad) },
  duel:     { line: 'Win every duel above half health', fits: (d) => d.objectives.some(o => o.kind === 'duel') },
  unseen:   { line: 'Never be seen', fits: (d) => d.objectives.some(o => o.kind === 'infiltrate') },
};
// what each goal is missed by (game/medals.js note): the events that count against it
export const MISSED_BY = { deathless: ['fell'], evacuees: ['evacuees'], escort: ['escort'], chase: ['chase'], slice: ['slice'], squad: ['squad'], duel: ['duel'], unseen: ['seen'] };
export const DUEL_HP = 0.5;     // the duel goal: never below this share of your health while a duel is on
export const ESCORT_HP = 0.5;   // the escort goal: never below this share of its health

/* EACH MISSION'S GOAL (and a par of its own where the worked-out one is off). One goal per mission, picked so that
   missions side by side ask for different things. */
export const MISSION_MEDALS = {
  // the Jedi's and the shared story
  refuge:        { bonus: 'evacuees' },
  'last-lesson': { bonus: 'duel' },
  'trial-wall':  { bonus: 'duel' },
  'trial-acrobat': { bonus: 'deathless' },
  'trial-knight': { bonus: 'duel' },
  'trial-sera':  { bonus: 'duel' },
  vault:         { bonus: 'evacuees' },
  pens:          { bonus: 'escort' },
  academy:       { bonus: 'escort' },
  breakout:      { bonus: 'escort' },
  grassland:     { bonus: 'escort' },
  icefront:      { bonus: 'squad' },
  graveyard:     { bonus: 'escort' },
  forge:         { bonus: 'deathless' },
  pursuit:       { bonus: 'chase' },
  'jedha-night': { bonus: 'unseen' },
  strike:        { bonus: 'squad' },
  chains:        { bonus: 'evacuees' },
  // the Mandalorian's
  salthollow:    { bonus: 'slice' },
  covert:        { bonus: 'unseen' },
  gallows:       { bonus: 'duel' },
  holdfast:      { bonus: 'duel' },
  // the ARC trooper's
  order66:       { bonus: 'escort' },
  killhouse:     { bonus: 'squad' },
  chipfiles:     { bonus: 'squad' },
  drill:         { bonus: 'deathless' },
  drowned:       { bonus: 'squad' },
  oldkillhouse:  { bonus: 'duel' },
  chipworks:     { bonus: 'slice' },
  warcamp:       { bonus: 'squad' },
  hunt:          { bonus: 'unseen' },
  lastassault:   { bonus: 'squad' },
  broadcast:     { bonus: 'deathless' },
  // Act IV, the Sith gate
  'gate-wake':   { bonus: 'chase' },
  'gate-vault':  { bonus: 'escort' },
  'gate-yard':   { bonus: 'duel' },
  'gate-order':  { bonus: 'squad' },
  'gate-heart':  { bonus: 'duel' },
  // the campaign's own tellings of a mission (data/missions.js, at its end)
  'strike-exegol': { bonus: 'squad' },
  'chains-alone': { bonus: 'duel' },
  meltworks:     { bonus: 'slice' },
  'iron-road':   { bonus: 'chase' },
};
// a side mission's (data/side-quests.js, ids 'side:<slug>'): its own here, else the first that fits what it plays
export const SIDE_MEDALS = {};

// the order a mission with no goal of its own tries them in
const DEFAULT_ORDER = ['unseen', 'evacuees', 'escort', 'chase', 'slice', 'duel', 'deathless'];
export function defaultBonus(def){ return DEFAULT_ORDER.find(k => BONUS[k].fits(def)) || 'deathless'; }
const pick = (v, hero) => v && typeof v === 'object' ? (v[hero] || v.jedi || v.mando || v.trooper) : v;
// the bonus goal's key for a mission as this hero plays it (one that doesn't fit the mission falls back to one that does)
export function bonusOf(def, hero){
  if (!def) return 'deathless';
  const own = def.side ? SIDE_MEDALS[def.id] : MISSION_MEDALS[def.remix ? def.source : def.id];
  const k = pick(own && own.bonus, hero);
  return k && BONUS[k] && BONUS[k].fits(def) ? k : defaultBonus(def);
}
export const bonusLine = (k, hero) => pick(BONUS[k] ? BONUS[k].line : '', hero);

/* PAR TIMES, worked out: each objective's cost in seconds (its own clock, plus the walking and fighting round it), the
   lengths on a spread map stretched with it, and the whole rounded up to `round`. A fair first clear on STANDARD should
   miss it by a little; a clean second run makes it. */
export const PAR = {
  per: 6,                         // every objective: the breather and the hand-off before it
  hold: [1.3, 18],                // × its time, + this
  sabotage: [1.0, 24],            // per console: × its time, + this
  capture: [1.0, 24],             // per post: × its time, + this
  escort: [1.6, 20],              // × the walk (path / speed), + this
  pursuit: { speed: 8, standoff: 30, add: 20 },   // the route at this m/s, each standoff, + this
  duel: [45, 22],                 // + this × its foe's hp multiplier
  breach: 40,                     // a door: stack, fuse, the room
  infiltrate: [1.0, 26, 15],      // per mark: × its time, + this (the sneaking up to it); + this once
  walker: 80,                     // the walker takedown: three legs tangled, the neck charge, the fall
  round: 15,
  min: 60,
};
const len = (pts) => { let n = 0; for (let i = 1; i < (pts || []).length; i++) n += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]); return n; };
// how much wider than laid out its map is built (world/spread.js): its paths are that much longer
function spreadOf(def){
  const lv = def.level || {}, at = SPREAD[lv.layout];
  return at ? Math.max(1, Math.max(lv.arena || at, GROW[lv.layout] || 0) / at) : 1;
}
function objCost(o, def, S){
  switch (o.kind){
    case 'hold': return (o.time || 30) * PAR.hold[0] + PAR.hold[1];
    case 'sabotage': return (o.consoles || []).length * ((o.time || 5) * PAR.sabotage[0] + PAR.sabotage[1]);
    case 'capture': return (o.posts || []).length * ((o.time || 6) * PAR.capture[0] + PAR.capture[1]);
    case 'escort': return len(o.path) * S / Math.max(0.5, o.speed || 2) * PAR.escort[0] + PAR.escort[1];
    case 'pursuit': { const leg = (def.route || [])[o.leg || 0]; return len(leg) * S / PAR.pursuit.speed + (o.standoff || []).length * PAR.pursuit.standoff + PAR.pursuit.add; }
    case 'duel': return PAR.duel[0] + PAR.duel[1] * (o.hp || 1);
    case 'breach': return PAR.breach;
    case 'infiltrate': return (o.marks || []).length * ((o.time || 3) * PAR.infiltrate[0] + PAR.infiltrate[1]) + PAR.infiltrate[2];
    case 'walker': return PAR.walker;
  }
  return 30;
}
export function parTime(def, hero){
  if (!def) return 0;
  const own = def.side ? SIDE_MEDALS[def.id] : MISSION_MEDALS[def.remix ? def.source : def.id], set = pick(own && own.par, hero);
  if (set) return set;
  const S = spreadOf(def);
  let t = 0;
  for (const raw of def.objectives || []){ const o = raw.hero && raw.hero[hero] ? { ...raw, ...raw.hero[hero] } : raw; t += PAR.per + objCost(o, def, S); }
  return Math.max(PAR.min, Math.ceil(t / PAR.round) * PAR.round);
}

/* WHAT MEDALS PAY. Rank XP the first time each one is won (per hero, per mission), and looks at a hero's medal total
   (the parts carry `earn: { medals: n }`: data/customize.js, data/trooper-locker.js). */
export const MEDAL_XP = { clear: 0, par: 30, bonus: 40 };   // (a clear already pays the mission's own rank XP)
export const mmss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
