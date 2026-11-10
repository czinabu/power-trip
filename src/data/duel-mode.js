// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL MODE: one player against another, Jedi against Jedi, in the temple's training-wing ring (or the sandbox's practice
// ring). The rules a challenger can pick, the ring itself, how the link's lag is hidden, and what a duel levels so skill
// decides it rather than rank or gear. game/duel-mode.js runs a match, net/pvp.js carries the blows, ui/duel-ui.js draws it.

export const DUEL_MODE = {
  // THE RULES the challenger picks on the challenge card. Every rule is best of `rounds` (first to win `toWin` rounds).
  rules: {
    hits:   { name: 'CLEAN HITS', line: 'First to 3 clean saber hits takes the round', hits: 3 },
    health: { name: 'HEALTH',     line: 'A full health bar each. Run it down to take the round' },
    timed:  { name: 'TIMED',      line: '90 seconds. The most clean hits takes the round', time: 90 },
  },
  defaultRule: 'hits',
  toWin: 2,             // rounds to win the match (best of 3)
  // the beats of a match (s): the fighters on their marks with the hilts on the belt, the countdown, the pause after a
  // round, and how long a trade has to land (a second blow this soon after a round-winning one counts too, the way a
  // double hit does in fencing)
  beats: { enter: 1.2, count: 3, roundEnd: 2.6, trade: 0.18 },
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
  lag: { poor: 150, parryWiden: 0.05, pingEvery: 2000 },
  // FORCE POWERS in a duel: push and pull only, at base strength (data/mastery.js rank 0). knock: how hard a push shoves
  // the other fighter (m/s) and a pull hauls them in; stagger: the reel it leaves (s); near: a pull stops this far off you
  force: { push: { knock: 13, lift: 2.5, stagger: 0.3 }, pull: { knock: 11, stagger: 0.25, near: 2 } },
  // a blow's damage, as the defender takes it, is clamped to this (a sanity bound on what arrives over the wire)
  maxBlow: 60,
  // THE MIRROR (the sandbox's practice ring): a duellist that fights in your own form
  mirror: { type: 'acolyte', rank: 1 },
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
     difficulty ............................ Knight for both */
export const DUEL_POWERS = { push: true, pull: true, dash: true };
