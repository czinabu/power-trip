// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL MODE: players against each other in the temple's training-wing ring (or the sandbox's practice ring): two of them,
// or three or four in a FREE-FOR-ALL; sabers only (Jedi against Jedi), or ANY HERO on the challenger's rule. The rules a challenger can pick, the ring itself, how the link's lag is hidden, and what a duel levels so skill
// decides it rather than rank or gear. game/duel-mode.js runs a match, net/pvp.js carries the blows, ui/duel-ui.js draws it.

export const DUEL_MODE = {
  // THE RULES the challenger picks on the challenge card. Every rule is best of `rounds` (first to win `toWin` rounds).
  rules: {
    hits:   { name: 'CLEAN HITS', line: 'First to 3 clean hits takes the round', hits: 3 },
    health: { name: 'HEALTH',     line: 'A full health bar each. Run it down to take the round' },
    timed:  { name: 'TIMED',      line: '90 seconds. The most clean hits takes the round', time: 90 },
  },
  defaultRule: 'hits',
  // WHO MAY FIGHT, the challenger's other pick: SABERS ONLY (the default, Jedi against Jedi) or ANY HERO (the Mandalorian
  // and the ARC trooper too). A party that isn't all Jedi can only be challenged under ANY HERO.
  kits: {
    sabers: { name: 'SABERS ONLY', line: 'Jedi against Jedi, blade to blade' },
    any:    { name: 'ANY HERO',    line: 'Blasters and flame against the blade, jetpacks, and cover in the ring' },
  },
  defaultKit: 'sabers',
  // ANY HERO: what each kind of blow is worth under CLEAN HITS and TIMED (a saber cut is one clean hit; a gun's single bolt
  // is a part of one, so a blaster has to land a few to match a cut), and how often a flamer's burn is told (s)
  points: { cut: 1, bolt: 1 / 3, flamePerS: 1 / 1.5 },
  flameEvery: 0.2,
  // each gunner's levelled kit in an ANY HERO match (data/duel-mode.js FAIRNESS): the guns it may draw and the powers it
  // keeps. Everything else (rockets, missiles, detonators, the darksaber, the long guns, the trooper's calls) stays off
  gunKit: {
    mando:   { guns: ['single', 'dual'], powers: { flame: true, dual: true } },
    trooper: { guns: ['rifle', 'pistols'], powers: {} },
  },
  // THE RING'S COVER under ANY HERO: low walls (crouch behind, rise to shoot over, vault on the run) and a tall block or two
  // to lean round, set out from the ring's middle (x, z, half-widths hx, hz, height h), so the gun has somewhere to hide
  cover: [
    { x: 0, z: -5.4, hx: 1.3, hz: 0.35, h: 1.25 }, { x: 0, z: 5.4, hx: 1.3, hz: 0.35, h: 1.25 },
    { x: -6.4, z: 0, hx: 0.35, hz: 1.1, h: 1.25 }, { x: 6.4, z: 0, hx: 0.35, hz: 1.1, h: 1.25 },
    { x: -3.2, z: -2.9, hx: 0.45, hz: 0.45, h: 2.4 }, { x: 3.2, z: 2.9, hx: 0.45, hz: 0.45, h: 2.4 },
  ],
  // FREE-FOR-ALL: a challenge to everyone here (up to `max` fighters). The marks stand round the ring, and every rule
  // plays as it does one on one: first to the clean hits, the last one standing on HEALTH, the most hits when TIMED
  ffa: { max: 4 },
  toWin: 2,             // rounds to win the match (best of 3)
  // the beats of a match (s): the fighters on their marks with the hilts on the belt, the countdown, the pause after a
  // round, and how long a trade has to land (a second blow this soon after a round-winning one counts too, the way a
  // double hit does in fencing)
  beats: { enter: 1.2, count: 3, roundEnd: 2.6 },
  // THE RING: where it is (the training wing's sparring ring, data/hub.js; the sandbox room's floor), its radius, and how
  // far apart the fighters stand on their marks
  ring: {
    temple: { hub: 'temple', wing: 'training', x: 14, z: 0, r: 10 },
    sandbox: { x: 0, z: 0, r: 9 },
    marks: 3.6,          // m from the middle each fighter starts
    edge: 0.5,           // m inside the ring's edge a fighter is held at
  },
  // THE BALCONY over the ring (world/arenas/tython.js training): spectators stand here, facing the ring
  balcony: { x: 15, z: 17.2, y: 2.4, yaw: Math.PI },
  // the challenge: how near (m) you must be to someone to challenge them by walking up, and how long a card waits
  reach: 3.4,
  answerWait: 25,
  // LAG: a blow is sent the moment the swing starts (with a timestamp) and its contact the moment the blade reaches the
  // other fighter; the DEFENDER's screen judges it. Above `poor` ms round trip the link counts as poor: the card warns
  // first, and both fighters' parry windows widen by `parryWiden` s for the match.
  lag: { poor: 150, parryWiden: 0.05, pingEvery: 2000,
    // SPLIT THE LINK: the defender's screen sees a cut arrive a one-way trip after it landed on the attacker's. The guard
    // is judged as it stood `share` of that trip ago (at most `rewindMax` s): a guard raised later than that is too late,
    // and one dropped since still holds. Neither side's screen gets the whole say. `keep`: s of guard history kept
    rewind: { share: 0.5, rewindMax: 0.09, keep: 0.6 },
    // a trade (two blows in the same instant, both count) waits this long, plus a one-way trip of the link, at most `max`
    trade: { base: 0.18, max: 0.4 },
  },
  // FORCE POWERS in a duel: push and pull only, at base strength (data/mastery.js rank 0). knock: how hard a push shoves
  // the other fighter (m/s) and a pull hauls them in; stagger: the reel it leaves (s); near: a pull stops this far off you
  force: { push: { knock: 13, lift: 2.5, stagger: 0.3 }, pull: { knock: 11, stagger: 0.25, near: 2 } },
  // a blow's damage, as the defender takes it, is clamped to this (a sanity bound on what arrives over the wire)
  maxBlow: 60,
  // THE MIRROR (the sandbox's practice ring): a duellist that fights in your own form (a gunner faces a gunman)
  mirror: { type: 'acolyte', rank: 1, gunner: 'blaster' },
};

/* FAIRNESS — what a duel levels, from the duel plan's table. game/duel-mode.js applies it for the length of a match and
   puts everything back after.
     rank, Force Tree picks, skill cards ... off: base numbers for both (player.up, skills and boons at their fresh-run values)
     crystal attunement, locker sidegrades . off (they live in player.up)
     forms ................................. on: any three you have learned (the loadout as it is)
     Force powers .......................... push and pull only, at base strength
     alignment powers, finishers on a player off in clean hits (they are perks in player.up)
     looks ................................. on: your saber is yours
     squad, apprentices, allies ............ never in the ring
     ANY HERO: gunners ..................... their base guns (gunKit) and the flamer; no explosives, no darksaber
     difficulty ............................ Knight for both */
export const DUEL_POWERS = { push: true, pull: true, dash: true };
