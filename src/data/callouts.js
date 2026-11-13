// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* THE CALLOUT RANKING: which words the fight says out loud, and which it leaves to sound and the blade.

   Every word that pops over the action (fx/floaters.js floater / callout) is ranked here, and ONE word shows at a time.
   A word that outranks the one showing replaces it at once; one of the same rank takes over once the first has been
   read; a lower one waits its turn briefly (NOTICE and up) or is dropped (MINOR). Damage numbers are not words: they
   are left alone.

     DECISIVE  changes what you press next: your parry, your guard beaten or broken, a foe laid open, a boss's "do this"
     KEY       the result of an exchange, or a warning worth a word: a foe's feint, a block on the wrong line, a bind
     NOTICE    everything not listed here (objectives, gadgets, boss move names): one at a time, newest first
     MINOR     a confirmation of something you just did on purpose: shown only when nothing else is up
     ROUTINE   said by the sound and the blade instead (fx/cues.js). The word still shows the first CALL.teach times a
               session, and always in training, so a move still gets its name once; after that it is a glint and a chime

   ROUTINE and MINOR only quiet the Jedi (the hero with a hundred labels): for a gunner they rank as NOTICE.

   A label is looked up by its exact text, then by the longest PREFIX it starts with (for built labels: 'FLOW ×3',
   'PARRY! ⟲ RIPOSTE READY'), then by PATTERN. A call site whose text comes from data passes its rank by name instead:
   floater(pos, text, color, 'key'). The names are the lower-case tiers, plus 'move' (ROUTINE, said by the hero's
   blade) and 'foe' (ROUTINE, said by a spark on the foe). */

export const TIER = { ROUTINE: 0, MINOR: 1, NOTICE: 2, KEY: 3, DECISIVE: 4 };

export const CALL = {
  word: 0.65,     // s a small word holds the slot (it is held bright for wordHold of it, then fades)
  wordHold: 0.4,
  big: 0.75,      // s a big callout holds the slot
  minRead: 0.35,  // s a word is given before another of its own rank may take its place
  stale: 0.7,     // s a waiting word is still worth showing; older than this it is dropped
  waits: TIER.NOTICE,   // the lowest rank that waits its turn instead of being dropped
  teach: 2,       // times a session a ROUTINE word is still shown, so the move gets its name
};

// cue: what says a ROUTINE word once it is quiet. 'blade' = a glint down the hero's blade and a soft chime;
// 'spark' = a small star on the foe; none = the call site already has its own sound and sparks
const R = (cue) => ({ tier: TIER.ROUTINE, cue });
const tier = (t) => ({ tier: t });
export const KINDS = {
  decisive: tier(TIER.DECISIVE), key: tier(TIER.KEY), notice: tier(TIER.NOTICE), minor: tier(TIER.MINOR),
  routine: R(null), move: R('blade'), foe: R('spark'),
};

const list = (kind, labels) => Object.fromEntries(labels.map(l => [l, KINDS[kind]]));

export const LABELS = {
  /* ---- DECISIVE ---- */
  ...list('decisive', [
    'WRONG SIDE', 'GUARD PIERCED', 'GUARD BROKEN', 'GUARD SHATTERED',             // your guard lost
    'OPENING', 'OPENING!', 'STAGGERED — OPEN!', 'POSTURE BROKEN!', 'SHATTERPOINT', 'DISARMED',   // the foe laid open
    'GUARD BREAKER', 'LAST STAND',                                                // a boss's blow that must be answered
  ]),
  /* ---- KEY ---- */
  ...list('key', [
    'CLEAN BLOCK', 'BLOCKED', 'SAME SIDE', 'READ YOU',                            // how the last cut was met
    'FEINT', 'RIPOSTE', 'PARRIED', 'RE-PARRIED', 'BIND',                          // what the foe is doing to you
    'BAITED', 'FEINTED', 'WINDED', 'PARRIED!', 'STAGGERED!', 'CLASH!',            // what you did to the foe
    'FLUID RIPOSTE', 'FORCE COUNTER', 'PERFECT DODGE', 'BROKE FREE',              // an answer is ready
    'COUNTER FORM', 'CHANGES STANCE', 'UNLEASHED', 'FURY',                        // the terms of the fight changed
    'FORCE LIGHTNING', 'FORCE CHOKE', 'BLINK', 'THE STORM', 'BLINDSIDE',          // a boss's move, named as it starts
    'EXHAUSTED', 'FORM LOCKED', 'NO BLADE',                                       // why nothing happened
  ]),
  /* ---- MINOR ---- */
  ...list('minor', [
    'RIPOSTE!', 'COUNTER-RIPOSTE!', 'EXECUTE', 'INTERRUPT', 'FORCE TAKEDOWN', 'CROWD CLEARED',
    'NOT FOOLED', 'OVERSHOT', 'OUT OF REACH', 'CAUGHT MID-AIR', 'EVADED', 'REFLECTED!', 'PUSHED BACK!',
    'HEADSHOT', 'PINNED', 'JETPACK BUSTED', 'TOO HEAVY', 'UNHURT', 'JOINED', 'SPLIT',
    'ARMOR HOLDS', 'RESISTED', 'HE HOLDS', 'HE STANDS FIRM', 'WARDED',
  ]),
  /* ---- ROUTINE: said by the hero's blade ---- */
  ...list('move', [
    'POLE VAULT', 'FORWARD STOMP', 'SCISSOR SLIDE', 'STRIKE TO THE BACK', 'HAWK-BAT SWOOP', 'SPIN ADVANCE', 'FLIP OVER',
    'ONSLAUGHT', 'SLIDE CUT', 'WALL STRIKE', 'VAULT STRIKE', 'LEDGE STRIKE', 'ROLL STRIKE', 'MOMENTUM',
    'PERFECT STRING', 'FLOW CAST',
  ]),
  /* ---- ROUTINE: said by a spark on the foe ---- */
  ...list('foe', ['SLIPPED', 'SIDESTEP', 'FLIPPED CLEAR', 'DEFLECTED', 'MET IT']),
  /* ---- ROUTINE: the call site's own sound and sparks already say it ---- */
  ...list('routine', [
    'BLOCK', 'DEFLECT', 'PARRY!', 'RICOCHET!', 'COVERED', 'CLASH',                // blade on bolt, blade on blade
    'PALM PUSH', 'PULL', 'PULL-IN', 'SHOCKWAVE', 'FORCE BARRIER', 'MENDING…', 'RETURNED',   // a power, cast
    'GRASPED', 'HURLED', 'DROPPED', 'BOWLED', 'BRACED',                           // the Force grasp
    'FOCUSED', 'ATTUNED',                                                         // the first two FOCUS tiers (the third is KEY)
  ]),
};

// built labels, by how they start (the longest match wins)
export const PREFIXES = {
  'PARRY! ': KINDS.decisive, 'FORCE PARRY': KINDS.decisive, 'SHATTERPOINT ·': KINDS.decisive, 'PHOENIX': KINDS.decisive,
  'IT BEARS DOWN': KINDS.decisive, 'DARK VOLLEY': KINDS.decisive, 'WARDED ·': KINDS.decisive, 'HE TURNS ON': KINDS.decisive,
  'DEFLECTED ·': KINDS.key,
  'FLOW ×': KINDS.move, 'EXCHANGE ×': KINDS.foe,
};

// anything else that carries an instruction or names an opening ('IN COVER · FLANK HIM', 'STUCK — OPEN') is KEY for every hero
export const PATTERNS = [[/ · | — /, KINDS.key]];

const _prefixes = Object.keys(PREFIXES).sort((a, b) => b.length - a.length);
/* DUEL CUES · MINIMAL (data/guard-rings.js) — the words for routine blade work are left to the sparks and the sound, so
   the eye stays on the blades: how a cut was met, what the foe just did, an answer made ready. What ends a duel still
   gets its word (GUARD BROKEN, WINDED, PERFECT STRIKE, DISARMED, GUARD PIERCED). Training shows them all. */
const DUEL_QUIET = new Set([
  'CLEAN BLOCK', 'BLOCKED', 'BLOCK', 'SAME SIDE', 'READ YOU', 'WRONG SIDE',
  'FEINT', 'RIPOSTE', 'PARRIED', 'PARRIED!', 'RE-PARRIED', 'BIND', 'BAITED', 'FEINTED', 'NOT FOOLED',
  'CLASH', 'CLASH!', 'SLIPPED', 'SIDESTEP', 'FLIPPED CLEAR', 'SIDESTEPPED', 'MET IT',
  'FLUID RIPOSTE', 'WHEELING RIPOSTE', 'RIPOSTE!', 'COUNTER-RIPOSTE!',
]);
const DUEL_QUIET_PRE = ['PARRY! ', 'EXCHANGE ×'];
export const duelQuiet = (text) => DUEL_QUIET.has(text) || DUEL_QUIET_PRE.some(p => text.startsWith(p));

const _cache = new Map();
/* the rank of a word: { tier, cue }. `kind` is a call site's own say (a KINDS name) and wins over the table */
export function rankOf(text, kind){
  if (kind && KINDS[kind]) return KINDS[kind];
  let r = _cache.get(text);
  if (r) return r;
  r = LABELS[text];
  if (!r){ const p = _prefixes.find(p => text.startsWith(p)); if (p) r = PREFIXES[p]; }
  if (!r){ const m = PATTERNS.find(([re]) => re.test(text)); r = m ? m[1] : KINDS.notice; }
  if (_cache.size < 400) _cache.set(text, r);
  return r;
}
