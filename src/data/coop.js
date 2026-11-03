// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Online co-op tuning: how often the partner's state is sent, and how enemies split themselves between the heroes.

export const NET = {
  sendMs: 50,        // the hero's pose goes out ~20 times a second
  picksEvery: 40,    // ...and the customizer picks ride along every this many messages (they rarely change)
};

/* SCALING WITH HEROES — what grows when a partner is in the fight (player/players.js heroesHere; solo reads 1, so none of
   it touches a solo run, in any mode). Each extra hero adds this share of the base value again.
   Already per hero by design, no number here: melee attack turns (data/enemies.js ENGAGE.meleeSlots: each hero has their
   own queue, so two heroes face up to four swinging foes) and ranged / marksman / grenadier firing slots (one pool per
   hero). The squad stays rank and file only (data/allies.js FODDER), however many heroes there are. */
export const SCALE = {
  bossHp: 0.6,    // a boss's, a Warbringer's and a duel champion's health, at spawn (the Warbringer's posture bar has its own: data/duel.js WARBRINGER.coop)
  revives: 1,     // extra squad revives per wave or objective, for each extra hero
};
export const heroScale = (per, n) => 1 + per * (n - 1);

/* ROOM — with this many heroes or more in the session, a campaign, story or survival arena is built this much wider
   (world/arena.js arenaScaleFor). Four heroes and their squads on a 56 m courtyard were elbow to elbow. The battle maps,
   the long chase and the walled rooms (`keep`) keep their size. The host decides it when it builds, and its guests
   build at the host's scale (net/foes.js sends it as `as`), so every screen has the same walls. */
export const ROOM = { from: 3, scale: 1.2, upTo: 100,
  keep: ['hall', 'forge', 'dojo', 'throne', 'hangar', 'archive', 'prison'] };   // walled rooms (60 m since the map-size pass): their doors and paths sit on the walls

/* TARGETING (enemies/targets.js) — each foe picks one hero to go after. It scores every hero by distance, plus a
   penalty for each other foe already on that hero (so a crowd splits instead of all mobbing one), minus a bonus for
   the one it's already chasing (so it doesn't flip back and forth). Only a foe that isn't mid-attack re-picks. */
export const TARGET = {
  recheck: [1.2, 2.0],   // seconds between a foe's re-picks
  crowd: 2.5,            // metres of extra distance per other foe already on that hero
  stick: 4,              // metres of loyalty to the current target
  swap: 7,               // a hero this much nearer than the current one wins at once, even mid-recheck
};
