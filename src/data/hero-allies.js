// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HERO-CLASS ALLIES: squadmates who are heroes, not troopers. A Jedi, a Mandalorian or an ARC trooper fighting on your
// side, built and animated as your own hero is (player/stand-in.js: the same model, the same forms' guards and cuts, the
// same catches, flips, rolls, blasters and jetpack poses), driven by the squad (allies/squad.js) and its hero-class
// moves (allies/hero-ally.js). Edit freely.
//
// A def is a squad def (data/allies.js shape: name, role for its numbers, scale) plus
//   hero     'jedi' | 'mando' | 'trooper': which hero it is
//   cast     a name in data/cast.js: wear that figure's look (so a story guest is the same person in the cutscene and
//            the fight) · or look: a partial look (player/model/appearance.js, the customizer's options) of its own
//   stance   the Jedi's form (data/stances.js id) · blade: its crystal's colour (else the form's)
//   weapon   a gunner's (data/mando.js MANDO_WEAPONS id: single, dual, carbine, repeater... the trooper's rifle)

// what each hero does on its own, beyond what the squad already does (move, take cover, shoot, cut, go down, get up)
export const HERO_MOVES = {
  jedi: {
    // its cuts run in strings, as yours do: a cut this soon after the last is the next in the string (the third is the
    // form's finisher). Each string is one set of directions (data/stances.js SWING_PATTERNS ids; 'neutral' = finisher)
    strings: [['right', 'left', 'neutral'], ['diagL', 'diagR', 'neutral'], ['left', 'riseR', 'neutral'], ['forward', 'left', 'neutral']],
    chain: 1.3,          // s: a cut within this of the last carries the string on
    // the guard goes up when a blow is coming: a foe this close (m) winding up
    block: { reach: 3.4, hold: 0.5 },
    // FORCE PUSH: when at least `min` of the rank and file stand within `range` m, in front (cos > `cone`), a palm throws
    // them back: `dmg` and a shove of `knock`, every `every` seconds
    push: { every: [7, 11], range: 6.5, cone: 0.5, min: 2, dmg: 10, knock: 15, cast: 0.38 },
    // the form's evade flip (data/agility.js) to cover ground: running at least `speed` m/s, every `every` seconds
    flip: { speed: 5.2, every: [4, 7], vy: 6.2, dur: 0.6 },
  },
  mando: {
    // the jetpack HOP to cover ground: running at least `speed` m/s, every `every` s, up at `vy` and hanging a while
    hop: { speed: 5.0, every: [6, 10], vy: 8.5, hang: 0.55 },
    // a ROLL out of the way of a hit, at most every `every` s
    roll: { every: [3.5, 6], dur: 0.5, push: 5.5, chance: 0.35 },
    fireHold: 0.35,      // s the guns stay up after a shot
  },
  trooper: {
    roll: { every: [3, 5.5], dur: 0.5, push: 6, chance: 0.45 },
    fireHold: 0.4,
  },
  flinch: 0.28,          // s the body reels from a hit that lands
  gravity: 22,           // m/s² on a flip or a hop
};

// the cast's own looks for the guests who don't have a cutscene figure (data/cast.js has the rest)
export const HERO_LOOKS = {
  // the ARC trooper's Hoth chapter: a Jedi on the right flank (the same colours as the duellist's look he wore before:
  // data/saber-cast.js)
  'MASTER IRO': { jedi: { parts: { hair: 'topknot', beard: 'goatee', robe: 'outer' }, palette: { skin: 0xb07a56, hair: 0x2a2018, eyes: 0x5a3a20, robe: 0x5a4632, tabard: 0x6a4a2e, tunic: 0xc9b48f }, build: { bulk: 1.02 } } },
  // the battle simulator's three (below)
  KNIGHT: { jedi: { parts: { hair: 'short', robe: 'outer' }, palette: { skin: 0x8a5536, hair: 0x140e0a, robe: 0x4a3a2a, tabard: 0x8c7656, tunic: 0xd2c4a2 } } },
  WARRIOR: { mando: { parts: { helmet: 'tvisor', cape: 'half' }, palette: { beskar: 0x6e7f8c, beskar2: 0x3a4652, cloth: 0x7a2a22, accent: 0x1f2126 } } },
  ARC: { trooper: { legion: 'blue' } },
};

// the BATTLE SIMULATOR's hero-class allies (data/battlesim.js BATTLE_SIM.allies), by its id, for every hero
export const HERO_ALLY_DEFS = {
  'hero-jedi':    { name: 'JEDI KNIGHT', role: 'jedi', hero: 'jedi', look: 'KNIGHT', stance: 'soresu', model: 'acolyte', color: 0xd2c4a2, eye: 0x4a86ff, cloth: 0x4a3a2a },
  'hero-mando':   { name: 'MANDALORIAN', role: 'rifle', hero: 'mando', look: 'WARRIOR', weapon: 'single', model: 'mandalorian', color: 0x6e7f8c, eye: 0xffa040, cloth: 0x7a2a22 },
  'hero-trooper': { name: 'ARC TROOPER', role: 'rifle', hero: 'trooper', look: 'ARC', weapon: 'rifle', model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2f7fd6 },
};
for (const [id, d] of Object.entries(HERO_ALLY_DEFS)) d.bsId = id;
export const heroAllyDef = (id) => HERO_ALLY_DEFS[id] || null;
