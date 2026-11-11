// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TWIST DECK: the signature twists (game/twists.js and game/twists/, one objective's hook each) that can travel to
// another mission's objective. The arcade deals them onto its contracts (data/arcade.js), and a remix lays one on the
// mission it remixes (data/remixes.js). Most twists are built round one map (the forge's heat, the barge's roll, the
// pens' searchlights), so only the ones that stand on their own are here, each with what it needs:
//   name    shown on the card and the details
//   kinds   the objective kinds it can go on
//   needs   (optional) (o, def) => true when this objective and mission can carry it (an open field, a squad...)
//   make    (o, def) => the twist's own settings, as an objective's `twist` would have them (its header says what they are)
//   line    the banner's line as it starts ({ jedi, mando, trooper } or one for every hero)
// Edit the words and the numbers freely: each make() is only what its twist's own header lists.

const all = (v) => ({ jedi: v, mando: v, trooper: v });

export const DECK = {
  // ---- on a duel ----
  stalker: { name: 'THE STALKER', kinds: ['duel'],
    line: all('It goes to ground. Listen for it: it comes out behind you.'),
    make: () => ({ first: 10, every: 18, rageEvery: 13, hide: 2.2, tell: [1.4, 0.9], back: 4 }) },
  blackout: { name: 'BLACKOUT', kinds: ['duel'],
    line: { jedi: 'The lights are gone. Fight by the blades.', mando: 'Lights out. Helmet lamp on.', trooper: 'Lights out. Lamps on, and watch its blade.' },
    make: () => ({}) },
  gunship: { name: 'GUNSHIP', kinds: ['duel'],
    line: all('A gunship overhead, strafing the ground. It does not care who is under it.'),
    make: () => ({ first: 8, every: 16, rageEvery: 12, shots: 8, gap: 2.2, r: 1.6, dmg: 14, foeDmg: 40 }) },
  cage: { name: 'THE CAGE', kinds: ['duel'], needs: (o) => !!o.at && !o.quarry,
    line: all('A containment field goes up round the two of you, and it is closing.'),
    make: (o) => ({ at: [o.at[0], o.at[1]], r0: 16, r1: 8.5, over: 70, dmg: 10 }) },

  // ---- on a hold ----
  standard: { name: 'THE STANDARD', kinds: ['hold'], needs: (o) => !o.evacuees,
    line: all('An officer is carrying their war standard up to the line. Cut the bearer down and it falls.'),
    make: () => ({ first: 12, every: 16, at: [0, -9], r: 7, ward: 0.5, guards: { phalanx: 1, grunt: 1 } }) },
  signal: { name: 'THE SIGNAL', kinds: ['hold'], needs: (o, def) => !!def.squad && !o.evacuees,
    line: all('Something on their side is broadcasting. When it hums, the squad freezes where they stand. Shake them out of it.'),
    make: () => ({ first: 10, every: [16, 9], spd: 9, len: 24, daze: 5, reach: 2.4 }) },
  sandstorm: { name: 'SANDSTORM', kinds: ['hold', 'sabotage', 'capture', 'escort', 'pursuit'],
    line: all('A storm is rolling in. You will not see them until they are close.'),
    make: (o) => ({ at: o.kind === 'pursuit' ? 4 : 9, ramp: 9, near: 3, far: o.kind === 'pursuit' ? 30 : 24 }) },

  // ---- on a slice ----
  barrage: { name: 'BARRAGE', kinds: ['sabotage'],
    line: all('They are calling down a bombardment while you work. Watch for the rings, and stay out of them.'),
    make: () => ({ first: 6, every: 3.4, fuse: 1.8, r: 3, dmg: 16, foeDmg: 70 }) },
  stamp: { name: 'THE PRESSES', kinds: ['sabotage'],
    line: all('There is a press over every console, and it is still running. Work in the gaps between the strokes.'),
    make: () => ({ period: [4.2, 3.2], slow: 0, warn: 1.1, r: 1.8, dmg: 22, foeDmg: 90 }) },
  tide: { name: 'THE TIDE', kinds: ['sabotage'],
    line: all('The water comes in surges down here. Slice in the dry spells, fight in the wet ones.'),
    make: () => ({ first: 12, every: 22, level: 0.55, slow: 0.62 }) },

  // ---- on a take ----
  guns: { name: 'THE GUNS', kinds: ['capture'],
    line: all('The posts are not just posts: the ones you have not taken are firing at you. Take one and it fires for you.'),
    make: () => ({ first: 6, every: 7, ours: 4.5, r: 3, fuse: 1.8, dmg: 18, foeDmg: 60 }) },
};
export const deckName = (k) => (DECK[k] || {}).name || String(k).toUpperCase();

// the twists that could go on this objective of this mission (none on one that already has a twist of its own)
export function fitsOn(o, def){
  if (!o || o.twist) return [];
  return Object.keys(DECK).filter(k => DECK[k].kinds.includes(o.kind) && (!DECK[k].needs || DECK[k].needs(o, def)));
}
// lay `n` twists on a mission's objectives (each on its own objective, never twice the same), with the dice r (r(), r.int,
// r.pick: the arcade's seeded dice). Lays them in place on `objectives` (a copy); returns the twists' keys, in order
export function dealTwists(objectives, def, r, n = 1, not = []){
  const out = [], used = new Set(not);
  const free = (i) => fitsOn(objectives[i], def).filter(t => !used.has(t));
  for (let k = 0; k < n; k++){
    const slots = objectives.map((o, i) => i).filter(i => free(i).length);   // (only where a twist not yet dealt still fits)
    if (!slots.length) break;
    const i = r.pick(slots), o = objectives[i];
    const t = r.pick(free(i)), D = DECK[t];
    o.twist = { kind: t, ...D.make(o, def), line: D.line };
    used.add(t); out.push(t);
  }
  return out;
}
