// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FOE FORMS: every saber NPC fights in one of the hero's lightsaber forms at a RANK, Jedi Academy style, and the forms
// counter each other (rock, paper, scissors): switch to the form that beats your opponent's.

/* THE TRIANGLE — every form belongs to a FAMILY, and each family beats the next:
     POWER breaks GUARD   (Djem So, Juyo and Vaapad: heavy hits, fury and posture-breaking blows crush a high-defence
                           setup)
     GUARD outlasts SPEED (Soresu, Shii-Cho and Shien absorb a blitz with no wasted energy, and Shien sends the bolts
                           home: Obi-Wan's Soresu against Maul)
     SPEED outpaces POWER (Makashi, Ataru, Jar'Kai and the saber staff get inside a heavy wind-up before it lands:
                           Dooku's Makashi against Anakin's Djem So)
   Three families of forms for each side to pick from. The family is only the duel counter: each form keeps its own job
   outside it (Shii-Cho is still the crowd form, Shien still sends bolts home).
   Niman, the jack of all forms, sits outside it: no form counters it and it counters none. The Mandalorian has no form,
   so for him every fight is even. */
export const FAMILIES = {
  power: { name: 'POWER', beats: 'guard', color: '#ff8a4a' },
  guard: { name: 'GUARD', beats: 'speed', color: '#7ab8ff' },
  speed: { name: 'SPEED', beats: 'power', color: '#7dffa8' },
};
export const FORM_FAMILY = {
  // Caleb's triangle (2026-11-04): Shien, the blaster-deflection form, guards; the staff's quick wheeling strings are speed;
  // Niman stays outside it (it already draws the most on the Force: data/force-level.js)
  djemso: 'power', juyo: 'power', vaapad: 'power',
  makashi: 'speed', ataru: 'speed', staff: 'speed',
  soresu: 'guard', shiicho: 'guard', shien: 'guard',
  niman: null,
  jarkai: 'speed',   // Jar'Kai: two blades that get inside a heavy wind-up, shut down by a tight guard
};
// a fallback name for a foe form with no stance of its own (the hero's forms, the saber staff among them, are named by data/stances.js)
export const FOE_FORM_NAMES = { staff: { name: 'SABER STAFF', no: '' } };

/* WHAT A COUNTER DOES — the edge goes to whoever's form beats the other's. `win`: your form counters its form; `lose`:
   its form counters yours, and only while a form in your loadout could counter it (with no answer to hand, it's even).
   Kicks, Force powers and the Mando's kit ignore it.
     seal     the chance its sealed guard (a cut inside the glowing crescent: data/duel.js decide) still holds
     block    × its odds of turning a cut off its guarded line
     parry    × its odds of reading a mash and throwing your blade off
     posture  × the strain each blocked cut puts on its guard (how fast you break it)
     dmg      × your saber's damage on it
     tricks   × its feints and held strikes (you read them, or it reads you)
     hurt     × the damage its blade does to you
     guard    × the stamina your held guard spends on its blows and the chip that gets through them (player/damage.js)
     window   × your parry window against its blows: a form that beats yours is harder to parry, so the counter decides
              a long duel on defence as well as offence (Caleb's call, 2026-11-04: Soresu was turtling Djem So out) */
export const MATCHUP = {
  win:  { seal: 0.7, block: 0.6,  parry: 0.5, posture: 1.4,  dmg: 1.15, tricks: 0.5, hurt: 0.8,  guard: 0.75, window: 1 },
  even: { seal: 1,   block: 1,    parry: 1,   posture: 1,    dmg: 1,    tricks: 1,   hurt: 1,    guard: 1,    window: 1 },
  lose: { seal: 1,   block: 1.15, parry: 1.15, posture: 0.85, dmg: 0.95, tricks: 1.15, hurt: 1.15, guard: 1.8,  window: 0.6 },
};
// +1: form `a` counters form `b` · -1: `b` counters `a` · 0: even (the same family, Niman, or no form)
export function formEdge(a, b){
  const fa = FORM_FAMILY[a], fb = FORM_FAMILY[b];
  if (!fa || !fb || fa === fb) return 0;
  return FAMILIES[fa].beats === fb ? 1 : FAMILIES[fb].beats === fa ? -1 : 0;
}

/* RANKS — what a duellist knows. The rank is its move set and its reactions (data/duel.js DUEL_PROFILES has what each
   key does); its form then shapes them (FORM_STYLE). An INITIATE swings plain cuts and blocks, and its guard can be
   beaten even on the guarded line (`seal`); an ADEPT feints, strings two cuts, binds blades and reads a mash; a KNIGHT
   strings three with a finisher and keeps an exchange going; a MASTER does all of it, harder to break and quicker to
   answer. `craft` scales each form's own speciality (Soresu's tiring wall, Ataru's flip, Djem So's riposte). */
export const RANKS = {
  initiate: { no: 'I',   name: 'INITIATE', seal: 0.6,  craft: 0.4,
              block: 0.4,  posture: 55,  feint: 0.08, delay: 0.2,  chain: 0, counter: 0.15, thrust: 0,    dodge: 0.05, deflect: 0.3,
              stam: 80,  ramp: true },
  adept:    { no: 'II',  name: 'ADEPT',    seal: 0.85, craft: 0.6,
              block: 0.55, posture: 75,  feint: 0.2,  delay: 0.25, chain: 1, counter: 0.4,  thrust: 0.08, dodge: 0.1,  deflect: 0.55,
              lock: true, push: 0.4,  stam: 105, parry: 0.45, rally: 0.4, finisher: 0.4,  footwork: true, side: 0.4,  elite: true },
  knight:   { no: 'III', name: 'KNIGHT',   seal: 1,    craft: 0.85,
              block: 0.7,  posture: 100, feint: 0.28, delay: 0.28, chain: 2, counter: 0.6,  thrust: 0.14, dodge: 0.18, deflect: 0.75,
              lock: true, push: 0.5,  stam: 130, parry: 0.65, rally: 0.6, finisher: 0.7,  footwork: true, side: 0.45, elite: true },
  master:   { no: 'IV',  name: 'MASTER',   seal: 1,    craft: 1,
              block: 0.76, posture: 140, feint: 0.32, delay: 0.28, chain: 2, counter: 0.65, thrust: 0.16, dodge: 0.2,  deflect: 0.85,
              lock: true, push: 0.55, stam: 160, parry: 0.65, rally: 0.6, finisher: 0.75, footwork: true, side: 0.4,  elite: true },
};
export const RANK_ORDER = ['initiate', 'adept', 'knight', 'master'];

/* HOW EACH FORM FIGHTS — on top of its rank: `mul` scales a rank's numbers, `add` adds to them, `moves` is its string
   of cuts (data/duel.js FOE_STRINGS). A master of Soresu, Ataru or Djem So comes out where the trials' form masters
   were tuned. Specials (× the rank's craft): tire (Soresu wears you out), flip (Ataru's backflip), riposte (Djem So and
   Shien answer a block harder). */
export const FORM_STYLE = {
  // I — wide, simple sweeps: an easy guard to read
  shiicho: { moves: 'shiicho', mul: { block: 0.9, feint: 0.6, delay: 0.8, thrust: 0.3, parry: 0.8, side: 0.8 } },
  // II — the fencer: thrusts, feints, a parry for a mash; weak against blaster fire
  makashi: { moves: 'makashi', mul: { block: 1.05, parry: 1.25, feint: 1.3, thrust: 2.0, counter: 1.15, posture: 0.9, deflect: 0.5, side: 1.2 } },
  // III — the wall: barely strikes, turns nearly everything, sends every bolt home and wears you out
  soresu:  { moves: 'soresu', mul: { block: 1.08, posture: 1.3, feint: 0.3, delay: 0.7, counter: 0.45, thrust: 0, dodge: 0.25, push: 0.8,
             stam: 1.2, parry: 0.85, rally: 0.85, finisher: 0.65, side: 0.75 }, add: { chain: -1 }, set: { deflect: 1 }, special: { tire: 6 } },
  // IV — the acrobat: a light guard, flips out of your cuts and comes back in long, quick strings
  ataru:   { moves: 'ataru', mul: { block: 0.55, posture: 0.57, feint: 1.25, delay: 0.55, counter: 0.77, thrust: 1.25, deflect: 0.41, push: 0.64,
             stam: 0.75, parry: 0.62, rally: 0.92, finisher: 1.13, side: 1.25 }, add: { chain: 1, dodge: 0.25 }, special: { flip: 2.2 } },
  // V — the knight: meets a blow on the guard and answers it at once, harder; drives a saber lock
  djemso:  { moves: 'djemso', mul: { block: 0.92, posture: 1.21, feint: 0.78, delay: 1.07, counter: 1.15, thrust: 0.94, dodge: 0.25, deflect: 0.7,
             push: 1.27, stam: 0.94, parry: 0.85, side: 0.62 }, special: { riposte: 0.35 } },
  // V — Djem So's reverse-grip sister: strong answers, and every bolt goes home
  shien:   { moves: 'shien', mul: { block: 0.95, posture: 1.1, counter: 1.1, push: 1.1, dodge: 0.6 }, set: { deflect: 1 }, special: { riposte: 0.2 } },
  // VI — the balance of them all
  niman:   { moves: 'niman' },
  // VII — savage, broken strings and little guard
  juyo:    { moves: 'juyo', mul: { block: 0.8, posture: 0.9, feint: 1.2, counter: 1.2, parry: 0.9, thrust: 1.1, finisher: 1.15 }, add: { chain: 1 } },
  // VII — turns your aggression back on you
  vaapad:  { moves: 'niman', mul: { counter: 1.3, parry: 1.2, rally: 1.2 } },
  // THE SABER STAFF (and the magnaguard's electrostaff) — both ends: long strings that sweep round to the spin
  staff:   { moves: 'staff', mul: { finisher: 1.2, side: 1.2 }, add: { chain: 1 } },
  // JAR'KAI — a saber in each hand: long, relentless strings side to side, a light guard that is easy to strain
  jarkai:  { moves: 'jarkai', mul: { block: 0.75, posture: 0.75, feint: 1.1, delay: 0.55, counter: 0.9, thrust: 0.5, parry: 0.85, side: 1.2, finisher: 1.1 }, add: { chain: 1 } },
};

const CAP = { block: 0.9, dodge: 0.6, parry: 0.85, feint: 0.5, counter: 0.85, rally: 0.8, finisher: 0.95, side: 0.7, deflect: 1, thrust: 0.4 };
// a duel profile (data/duel.js DUEL_PROFILES keys) for a form at a rank
export function foeProfile(form, rank){
  const R = RANKS[rank] || RANKS.adept, S = FORM_STYLE[form] || FORM_STYLE.niman;
  const p = { ...R };
  delete p.no; delete p.name; delete p.craft;
  for (const k in S.mul || {}) p[k] = (p[k] || 0) * S.mul[k];
  for (const k in S.add || {}) p[k] = (p[k] || 0) + S.add[k];
  Object.assign(p, S.set || {});
  for (const k in CAP) if (p[k] != null) p[k] = Math.min(CAP[k], p[k]);
  p.block = Math.max(0.4, p.block);   // every form-fighter holds a guard you can see (the crescent shows from 0.4)
  p.chain = Math.max(0, Math.round(p.chain));
  p.posture = Math.round(p.posture); p.stam = Math.round(p.stam);
  const sp = S.special || {};
  if (sp.tire) p.tire = Math.round(sp.tire * R.craft);
  if (sp.flip) p.flip = +(sp.flip * R.craft).toFixed(2);
  if (sp.riposte) p.riposte = +(1 + sp.riposte * R.craft).toFixed(2);
  p.moves = S.moves;
  return p;
}

/* WHO FIGHTS IN WHAT — the rank and file by foe type, and the named duellists by the name on their duel banner.
   A foe type's `pool` picks its form by how deep the run is (waves cleared, as data/duel.js eliteRamp counts them):
   the first acolytes all fight in Shii-Cho, the form every initiate starts on; later waves bring the other forms in, so
   switching form starts to matter once you have more than one. The sandbox draws from the whole pool. An ELITE
   (enemies/elites.js) fights one rank higher. A type's `ranks` raises its rank the same way as the run deepens. */
export const FOE_FORMS = {
  // `ranks`: the rank by depth (as the pool): adepts early, knights from wave 6 (an elite still one higher)
  acolyte: { rank: 'adept', ranks: [{ from: 0, rank: 'adept' }, { from: 6, rank: 'knight' }], pool: [
    { from: 0, forms: ['shiicho'] },
    { from: 4, forms: ['shiicho', 'makashi', 'ataru', 'soresu'] },
    { from: 8, forms: ['shiicho', 'makashi', 'ataru', 'soresu', 'djemso', 'shien', 'juyo'] },
    { from: 10, forms: ['shiicho', 'makashi', 'ataru', 'soresu', 'djemso', 'shien', 'juyo', 'jarkai'] },   // Jar'Kai: late, at knight rank
  ] },
  duelist: { rank: 'adept', form: 'staff' },   // the magnaguard: its electrostaff fights as the saber staff does
};
/* THE CAMPAIGN'S CURVE — in the campaign (its wave levels, and the run's own foes in its mission chapters) the rank
   and file follow the acts, not just the wave count: acolytes stay ADEPTS through Jedha and Mustafar and fight as
   KNIGHTS on Exegol, by the level being played (G.levelIdx); an elite still fights one rank up. Survival, the Missions
   page and arcade contracts go by depth alone. */
export const CAMPAIGN_RANK_CAP = ['adept', 'adept', 'knight'];
/* MASTERS ARE RARE — at most this many rank-and-file masters (late elites) on the field at once; another elite that
   would make master fights as a knight instead. Named duellists and bosses don't count. */
export const MASTER_CAP = 1;
/* the named: a mission's own `form` wins (a trial's form master, at `master` unless it says `rank`); otherwise its
   name here; otherwise its type's form at `knight`. */
export const NAMED_FORMS = {
  'THE INQUISITOR':       { form: 'ataru',  rank: 'knight' },   // the hunter: quick and acrobatic (a guard form answers it)
  'THE SEVENTH BLADE':    { form: 'juyo',   rank: 'knight' },
  'THE WARDEN':           { form: 'djemso', rank: 'knight' },
  'THE GRAND INQUISITOR': { form: 'djemso', rank: 'master' },
  'ILSA VENN':            { rank: 'adept' },                    // a sparring partner, not a master
  'VX-7':                 { form: 'staff',  rank: 'knight' },
  'THE SALVAGE MASTER':   { form: 'staff',  rank: 'knight' },
  'THE IRON WARDEN':      { form: 'staff',  rank: 'master' },
  'THE CHALLENGER':       { form: 'staff',  rank: 'master' },
  'THE CLAN CHAMPION':    { form: 'staff',  rank: 'master' },
};
// the bosses: Darth Vexis fights in Juyo as a master (a speed form gets inside him); the Mandalorian boss has no form
export const BOSS_FORM = { sith: { form: 'juyo', rank: 'master' } };

/* MASTERS CHANGE FORM — the fight becomes a real back and forth: sit in a form that counters a master's for `after` s and
   it changes to one of its forms that counters yours (at most once every `cd` s). It twirls, calls the change out, and
   now you have to answer again. Knights and below hold one form. Who switches, and between which forms:
     a wave's master (a late elite): its acolyte pool at that depth · the named below: their own repertoire · the boss.
   A trial's form master and anyone not listed keeps the form it teaches. Each repertoire holds a form of every family,
   so whatever you switch to, it has an answer. */
export const FORM_SWITCH = {
  after: 6, cd: 15,
  named: {
    'THE GRAND INQUISITOR': ['djemso', 'makashi', 'soresu'],
    'THE ECHO':             ['djemso', 'soresu', 'ataru'],
  },
  boss: { sith: ['juyo', 'makashi', 'soresu'] },
};
