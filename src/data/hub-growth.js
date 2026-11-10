// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A HOME THAT GROWS WITH YOUR GROUP (game/hub-growth.js runs it). Every hero's hub starts part-ruined, short-handed and
// half dark, and comes back to life as that hero clears side missions, Act IV's chapters and raids: a wing is RESTORED
// (its rubble cleared, its lamps relit, its people home), and the hub's TROPHY HALL fills with what the hero has beaten,
// a banner for every raid day won and a wall naming the friends who were there. Edit the words and numbers freely.
//
// Each hero has a hub of their own (data/hub.js HERO_HUB) and it grows from that hero's own profile (game/profile.js), so
// it is theirs alone. In co-op the party stands in the HOST's hub and sees the host's: every helper's own browser counts
// the same win into their own hero's profile, so helping a friend grows your hub too.
//
// RESTORATIONS, one list per hub. Each:
//   id     what it is remembered by (the same five ids in every hub, so a co-op card can carry them as letters)
//   wing   the wing it restores (data/hub.js, hub-kamino.js, hub-covert.js)
//   need   what restores it: { sides: n } side missions won (the temple's calls for aid and the zones' errands alike),
//          { gate: n } Act IV chapters cleared, { gateWon: true } Act IV beaten, { raids: n } raids won
//   name   the banner as you come home to it, and its row in the hall's ledger · line: what changed, in one sentence
//   say    what the hub's guide says as they walk you to it (game/hub-news.js: the homecoming news)
//   dark   until restored, the wing's lamps are out: everything that glows in it burns at this much (0..1)
//   ruins  until restored, rubble on its floor: { k: 'rubble' | 'drum' | 'scaffold' | 'crates', x, z, s (size), ry }
//          (game/hub-growth.js builds them, each one solid or a low climbable step: world/arenas/growth-kit.js)
// Who lives in a restored wing is in the hub's people (data/temple-folk.js): an entry with grow: '<id>' is only there once
// it is restored, one with ruin: '<id>' only until then.

export const NEEDS_TEXT = (n) => n.sides ? (n.sides === 1 ? 'Win a side mission' : 'Win ' + n.sides + ' side missions')
  : n.gate ? (n.gate === 1 ? 'Clear an Act IV chapter' : 'Clear ' + n.gate + ' Act IV chapters')
  : n.gateWon ? 'Beat Act IV' : n.raids ? (n.raids === 1 ? 'Win a raid' : 'Win ' + n.raids + ' raids') : '';

// the five steps every hub takes, in order (the same needs in each, so the three hubs grow at the same pace)
const STEP = { home: { sides: 1 }, light: { sides: 3 }, yard: { gate: 1 }, hall: { gate: 3 }, heart: { gateWon: true } };

export const GROWTH = {
  /* THE HIDDEN TEMPLE ON TYTHON (world/arenas/tython.js) */
  temple: [
    { id: 'home', wing: 'hall', need: STEP.home, name: 'THE YOUNGLINGS COME HOME',
      line: 'Rescued younglings live in the temple now, and walk the Grand Hall with their master.',
      say: 'The children you brought back have found their way here. Come and see them in the Grand Hall.',
      ruins: [{ k: 'scaffold', x: -32, z: -22, s: 1.25 }, { k: 'rubble', x: -24, z: -40, s: 1.2 }, { k: 'drum', x: 25, z: 37, ry: 0.4 }] },
    { id: 'light', wing: 'archives', need: STEP.light, name: 'THE ARCHIVES LIGHT UP',
      line: 'The stacks are lit again, and the archivists are back on their rounds.',
      say: 'The archivists have come home, and the archives are lit again. Go and see.',
      dark: 0.18,
      ruins: [{ k: 'rubble', x: -2, z: -24, s: 1.1 }, { k: 'rubble', x: -2, z: 27, s: 0.9 }, { k: 'drum', x: 28, z: -22, ry: 1.2 }, { k: 'rubble', x: 29, z: 20, s: 0.8 }] },
    { id: 'yard', wing: 'training', need: STEP.yard, name: 'THE TRAINING YARD REOPENS',
      line: 'The rubble is cleared from the training wing, and a class drills on the mats again.',
      say: 'The training wing is clear at last, and there is a class on the mats. Go and watch them.',
      dark: 0.35,
      ruins: [{ k: 'rubble', x: 26, z: 22, s: 1.3 }, { k: 'drum', x: -20, z: -8, ry: 0.3 }, { k: 'rubble', x: 28, z: -4, s: 1.1 }, { k: 'rubble', x: -24, z: 12, s: 0.9 }] },
    { id: 'hall', wing: 'council', need: STEP.hall, name: 'THE COUNCIL SITS AGAIN',
      line: 'Masters have come back to the council chamber, and the table is never empty.',
      say: 'The council sits again. Masters have come back from across the galaxy. Go and hear them.',
      dark: 0.3,
      ruins: [{ k: 'rubble', x: -25, z: -6, s: 1.1 }, { k: 'drum', x: 25, z: -8, ry: 1.1 }, { k: 'rubble', x: 24, z: 24, s: 0.8 }] },
    { id: 'heart', wing: 'forge', need: STEP.heart, name: 'THE FORGE IS RELIT',
      line: 'The kyber in the saber forge burns again, and a Jedi keeps watch over it.',
      say: 'The crystals under the temple are singing again. The saber forge is relit.',
      dark: 0.2,
      ruins: [{ k: 'rubble', x: -19, z: -2, s: 1.0 }, { k: 'rubble', x: 20, z: 3, s: 0.9 }] },
  ],
  /* THE HIDDEN COVERT (world/arenas/covert-hub.js) */
  covert: [
    { id: 'home', wing: 'clan', need: STEP.home, name: 'THE FOUNDLINGS COME HOME',
      line: 'Foundlings you got out live in the covert now, round the clan hall\'s hearth.',
      say: 'The foundlings are home. They sit round the hearth in the clan hall. Go to them.',
      dark: 0.3,
      ruins: [{ k: 'crates', x: -20, z: 22, s: 1.0 }, { k: 'rubble', x: 21, z: 18, s: 0.9 }] },
    { id: 'light', wing: 'vault', need: STEP.light, name: 'THE VAULT IS LIT',
      line: 'The trophy vault\'s lamps burn again over the clan\'s helmets.',
      say: 'The vault is lit again, and the clan\'s trophies with it. Go and look.',
      dark: 0.2,
      ruins: [{ k: 'rubble', x: 22, z: -22, s: 1.0 }, { k: 'crates', x: -14, z: 22, s: 0.9 }] },
    { id: 'yard', wing: 'pit', need: STEP.yard, name: 'THE PIT REOPENS',
      line: 'The sparring pit is cleared, its fires lit, and the clan trains in it again.',
      say: 'The pit is clear and its fires are lit. The clan trains there again.',
      dark: 0.3,
      ruins: [{ k: 'rubble', x: -26, z: 16, s: 1.2 }, { k: 'drum', x: -10, z: -20, ry: 0.2 }, { k: 'rubble', x: 28, z: 24, s: 0.9 }] },
    { id: 'hall', wing: 'hangar', need: STEP.hall, name: 'THE HANGAR IS CLEARED',
      line: 'The wreckage is hauled off the hangar floor, and the clan works on the ship again.',
      say: 'The hangar is cleared. The clan is working on the ship. Go and see it.',
      dark: 0.45,
      ruins: [{ k: 'rubble', x: -26, z: 4, s: 1.3 }, { k: 'crates', x: 26, z: 4, s: 1.0 }, { k: 'drum', x: -8, z: 26, ry: 1.4 }] },
    { id: 'heart', wing: 'forge', need: STEP.heart, name: 'THE CLAN GATHERS',
      line: 'The clan has come together round the great forge, every one of them home.',
      say: 'The clan has gathered round the great forge. All of them, home. Come.' },
  ],
  /* THE CLONE CITADEL ON KAMINO (world/arenas/clone-citadel.js): never ruined, but short-handed and running dark */
  kamino: [
    { id: 'home', wing: 'deck', need: STEP.home, name: 'THE BROTHERS COME HOME',
      line: 'Clones you got out are back on the hangar deck, drilling with the rest.',
      say: 'Some of the brothers you got out are back on the hangar deck, Captain. Go and see them drill.' },
    { id: 'light', wing: 'halls', need: STEP.light, name: 'THE CLONING HALLS POWER UP',
      line: 'Power is back in the cloning halls, and the technicians are on their rounds.',
      say: 'Power\'s back in the cloning halls, Captain. The techs are on their rounds again.',
      dark: 0.2,
      ruins: [{ k: 'crates', x: 26, z: -18, s: 1.0 }, { k: 'crates', x: 26, z: 20, s: 0.9 }] },
    { id: 'yard', wing: 'range', need: STEP.yard, name: 'THE RANGE IS BACK ONLINE',
      line: 'The firing range is lit and staffed, troopers on the line again.',
      say: 'The firing range is back online. There are troopers on the line again.',
      dark: 0.3,
      ruins: [{ k: 'crates', x: 26, z: 22, s: 1.1 }, { k: 'crates', x: -24, z: 8, s: 0.9 }] },
    { id: 'hall', wing: 'warroom', need: STEP.hall, name: 'THE WAR ROOM IS STAFFED',
      line: 'Officers are back at every console in the war room.',
      say: 'The war room has its officers back, Captain. Every console manned.',
      dark: 0.3 },
    { id: 'heart', wing: 'armory', need: STEP.heart, name: 'THE ARMORY IS RESTOCKED',
      line: 'Every stand in the armory has its armour on it again.',
      say: 'The armory\'s restocked, Captain. Every stand full.' },
  ],
};
export const GROWTH_IDS = ['home', 'light', 'yard', 'hall', 'heart'];

/* THE TROPHY HALL: where each hub keeps what it has beaten. A trophy is won once, by the hero whose hub it is, and kept
   with the names of whoever stood with them the first time (game/hub-growth.js noteTrophy). `look` is which small model
   stands on its plinth (world/arenas/growth-kit.js trophy) */
export const TROPHIES = {
  vexis:      { name: 'DARTH VEXIS', what: 'The Herald\'s broken blade', look: 'blade', col: 0xff2a3a },
  magistrate: { name: 'THE IRON MAGISTRATE', what: 'The Magistrate\'s gilded helm', look: 'helm', col: 0xc9a040 },
  marshal:    { name: 'THE MARSHAL', what: 'The Marshal\'s command bucket', look: 'bucket', col: 0xc9a040 },
  kharel:     { name: 'DARTH KHAREL', what: 'A shard of the beskar vessel', look: 'shard', col: 0xb46bff },
  warbringer: { name: 'THE WARBRINGER', what: 'The Warbringer\'s horned helm', look: 'horns', col: 0xff7a2a },
};
export const TROPHY_IDS = Object.keys(TROPHIES);

/* where each hub keeps them: the wing, the deeds station (its panel lists everything: data/hub.js `act: 'deeds'`), a
   plinth for every trophy [x, z, facing], the raid banners' wall (from, to, height, facing) and the friends' wall
   [x, y, z, facing, width] */
export const DEEDS_HALL = {
  temple: { wing: 'trophies', kicker: 'THE TROPHY HALL', friendsTitle: 'THOSE WHO STOOD WITH US',
    plinths: [[-12, -14, 0], [0, -17, 0], [12, -14, 0], [-12, 14, Math.PI], [12, 14, Math.PI]],
    banners: { a: [-21, -29.5], b: [21, -29.5], y: 10.5, ry: 0, max: 7 },
    wall: [-29.75, 7.4, 0, Math.PI / 2, 15] },
  covert: { wing: 'vault', kicker: 'THE TROPHY VAULT', friendsTitle: 'THOSE WHO HUNTED WITH US',
    plinths: [[-12, -22, 0], [-4, -22, 0], [4, -22, 0], [-12, 22, Math.PI], [-4, 22, Math.PI]],
    banners: { a: [-28, -33], b: [24, -33], y: 11.4, ry: 0, max: 6 },
    wall: [33.4, 6.0, -8, -Math.PI / 2, 11] },
  kamino: { wing: 'warroom', kicker: 'THE HONOUR WALL', friendsTitle: 'THOSE WHO SERVED WITH US',
    plinths: [[-26, -16, Math.PI / 2], [-26, -8, Math.PI / 2], [-26, 0, Math.PI / 2], [-26, 8, Math.PI / 2], [-26, 16, Math.PI / 2]],
    banners: { a: [-31.4, -21], b: [-31.4, 21], y: 12.5, ry: Math.PI / 2, max: 6 },
    wall: [31.6, 5.4, -12, -Math.PI / 2, 9] },
};

export const FRIENDS_MAX = 24;   // how many friends a profile keeps (the most recent)
export const FRIENDS_SHOWN = 12;  // how many names the wall and a co-op card carry
// how fast a restored wing's pieces stream in, by quality tier (world/arenas/growth-kit.js: one piece is a trophy, a banner, the wall)
export const GROWTH_STREAM = { low: 1, medium: 2, high: 99 };
