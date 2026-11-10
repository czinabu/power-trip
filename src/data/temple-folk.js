// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TEMPLE'S PEOPLE (world/arenas/tython-folk.js): who lives in each wing of the hidden temple, how they're dressed,
// and what they do there. Edit freely.
//
// FOLK_LOOKS: each kind of person, as partial looks for the hero model (player/model/appearance.js, the customizer's
// options): one is picked per person by its seed. `scale` sizes them (a youngling is about 0.62), `saber` hangs a hilt at
// the belt, `drawn` puts a lit training saber in the hand instead.
// TEMPLE_FOLK: per wing, a list of people. Each one is either
//   walking a loop   { loop: [[x, z], …], speed (m/s), lead (metres along it: a file walks one behind another) }
//   or standing      { x, z, toward: [x, z] (who or what they face), talk: 0 or 1 (a pair takes turns talking) }
// plus `drill` (the saber drill's pace, with `phase`) or `kneel` (meditating). x, z in metres from the wing's middle.
// A hero figure costs far more to draw than a prop: keep a wing to about six.
// THE HOME GROWS (data/hub-growth.js): `grow: '<id>'` puts someone there only once that restoration is done (the younglings
// you rescued, the archivists back on their rounds, the council sitting again), `ruin: '<id>'` only until it is.
// HUB_FOLK: the same, for every hub that has people of this kind (the covert's foundlings and clan).

const robe = (robe, tabard, tunic) => ({ robe, tabard, tunic });
const SKIN = [0xc58c64, 0xe0ac86, 0x8a5536, 0x3f261a, 0xf1c9a5, 0x8aa66a];
const HAIR = [0x140e0a, 0x6a2c16, 0x85817c, 0xd8d4cc, 0x3a2414];

export const FOLK_LOOKS = {
  master: { saber: true, looks: [0, 1, 2, 3].map(i => ({
    parts: { head: 'hood', robe: 'outer', hair: 'short', waist: 'long', beard: ['full', 'none', 'goatee', 'none'][i] },
    palette: { skin: SKIN[i], hair: HAIR[(i + 2) % 5], ...robe([0x3b2a1e, 0x2a2724, 0x4a3a2a, 0x24331f][i], 0x6b4f37, 0xd2c4a2) } })) },
  knight: { saber: true, looks: [0, 1, 2, 3, 4].map(i => ({
    parts: { robe: 'outer', hair: ['short', 'braid', 'topknot', 'long', 'bald'][i], beard: ['stubble', 'none', 'none', 'moustache', 'none'][i] },
    palette: { skin: SKIN[(i + 1) % 6], hair: HAIR[i], ...robe([0x5a4632, 0x3b2a1e, 0x6b5a44, 0x2e2a28, 0x4a3a2a][i], 0x8c7656, [0xd2c4a2, 0xe6e2d8, 0xc9b48f, 0xb8a080, 0xd2c4a2][i]) } })) },
  youngling: { scale: 0.62, looks: [0, 1, 2, 3].map(i => ({
    parts: { robe: 'none', hair: ['short', 'braid', 'bald', 'topknot'][i] },
    palette: { skin: SKIN[(i + 3) % 6], hair: HAIR[i], ...robe(0x8c7656, 0xb39d78, [0xe6e2d8, 0xd2c4a2, 0xc9b48f, 0xe6e2d8][i]) }, build: { head: 1.12 } })) },
  pupil: { scale: 0.62, drawn: true, looks: [0, 1, 2, 3].map(i => ({
    parts: { robe: 'none', hair: ['braid', 'short', 'topknot', 'bald'][i] },
    palette: { skin: SKIN[(i + 2) % 6], hair: HAIR[(i + 1) % 5], ...robe(0x8c7656, 0xb39d78, 0xe6e2d8) }, build: { head: 1.12 } })) },
  // THE COVERT'S PEOPLE: foundlings in their tunics, and the clan in its armour (as: 'mando', the hero model's beskar)
  foundling: { scale: 0.62, looks: [0, 1, 2, 3].map(i => ({
    parts: { robe: 'none', hair: ['short', 'braid', 'topknot', 'short'][i] },
    palette: { skin: SKIN[(i + 1) % 6], hair: HAIR[(i + 2) % 5], ...robe(0x5a3e2a, 0x6a4a32, [0x8a6a4a, 0x7a5a3a, 0x9a7a5a, 0x6a5040][i]) }, build: { head: 1.12 } })) },
  clan: { as: 'mando', looks: [0, 1, 2, 3].map(i => ({
    palette: { beskar: [0x9aa7b5, 0x8a2a26, 0x5f6e45, 0x3e5f8a][i], beskar2: [0x667381, 0x4a4f58, 0x7e4428, 0xaab4c0][i] } })) },
  archivist: { looks: [0, 1, 2].map(i => ({
    parts: { robe: 'outer', hair: ['bald', 'long', 'short'][i], beard: ['full', 'none', 'goatee'][i] },
    palette: { skin: SKIN[(i + 4) % 6], hair: 0xd8d4cc, ...robe([0xb8a080, 0xd8c8a0, 0xa8946a][i], 0x8c7656, 0xe6e2d8) } })) },
};

const HALL_LOOP = [[-14, -36], [14, -36], [14, 36], [-14, 36]];

export const TEMPLE_FOLK = {
  hall: [
    // (once the first younglings are home) a master leading two of them up and down the processional
    { kind: 'master', loop: HALL_LOOP, speed: 1.1, lead: 0, grow: 'home' },
    { kind: 'youngling', loop: HALL_LOOP, speed: 1.1, lead: -1.6, grow: 'home' },
    { kind: 'youngling', loop: HALL_LOOP, speed: 1.1, lead: -3.0, grow: 'home' },
    // two knights by the west colossus, talking; one by the pool, watching the map turn
    { kind: 'knight', x: -27, z: 6, toward: [-25.6, 7.4], talk: 0 },
    { kind: 'knight', x: -25.6, z: 7.4, toward: [-27, 6], talk: 1 },
    { kind: 'master', x: 9.5, z: -9.5, toward: [0, 0] },
  ],
  council: [
    // (once the council sits again) two masters at the table, over the galaxy, taking turns, and a third at the window
    { kind: 'master', x: -4.6, z: -3.6, toward: [4.6, -3.6], talk: 0, grow: 'hall' },
    { kind: 'master', x: 4.6, z: -3.6, toward: [-4.6, -3.6], talk: 1, grow: 'hall' },
    { kind: 'master', x: 18, z: -20, toward: [24, -26], grow: 'hall' },
    // one knight walking slowly round it, always
    { kind: 'knight', loop: [...Array(12)].map((_, i) => [Math.cos(-i / 12 * Math.PI * 2) * 7.2, Math.sin(-i / 12 * Math.PI * 2) * 7.2]), speed: 0.6 },
  ],
  training: [
    // (once the yard reopens) a class on the training grounds' mat, drilling a form on their master's count
    { kind: 'master', x: -6, z: -23, toward: [-6, -18], talk: 0, grow: 'yard' },
    { kind: 'pupil', x: -9, z: -20.4, toward: [-9, -26], drill: 1.6, grow: 'yard' },
    { kind: 'pupil', x: -6, z: -20.4, toward: [-6, -26], drill: 1.6, grow: 'yard' },
    { kind: 'pupil', x: -3, z: -20.4, toward: [-3, -26], drill: 1.6, grow: 'yard' },
    // two younglings sparring on the proving ground, either side of its ring
    { kind: 'pupil', x: -8.6, z: 18, toward: [-6, 18], drill: 2.4, phase: 0, grow: 'yard' },
    { kind: 'pupil', x: -3.4, z: 18, toward: [-6, 18], drill: 2.4, phase: Math.PI, grow: 'yard' },
    // (until then) a knight looking over the rubble, wondering where to start
    { kind: 'knight', x: 22.5, z: 18.5, toward: [26, 22], ruin: 'yard' },
  ],
  archives: [
    // (once the archives light up) archivists on their rounds of the reading floor, and a knight reading down an aisle
    { kind: 'archivist', loop: [[-18, -6.4], [18, -6.4], [18, 6.4], [-18, 6.4]], speed: 0.8, lead: 0, grow: 'light' },
    { kind: 'archivist', loop: [[-18, -6.4], [18, -6.4], [18, 6.4], [-18, 6.4]], speed: 0.8, lead: -36, grow: 'light' },
    { kind: 'knight', x: -14, z: 11.25, toward: [-20, 11.25], grow: 'light' },
    // the last archivist, always at the desk
    { kind: 'archivist', x: 0, z: -3.3, toward: [0, 0] },
  ],
  trophies: [
    // the hall's keeper by the ledger
    { kind: 'archivist', x: 2.8, z: -2.6, toward: [0, 0] },
  ],
  forge: [
    // (once the forge is relit) a Jedi kneeling in meditation at the edge of the circle, facing the heart crystal
    { kind: 'knight', x: -4.2, z: 9.2, toward: [0, 6], kneel: true, grow: 'heart' },
  ],
};

/* the hidden covert (world/arenas/covert-hub.js): who comes home to it as it grows */
export const COVERT_FOLK = {
  clan: [
    // (once the foundlings are home) children sitting by the hearth, a warrior of the clan standing over them, telling it
    { kind: 'foundling', x: -4, z: -24, toward: [-4, -30], kneel: true, grow: 'home' },
    { kind: 'foundling', x: 0, z: -23.4, toward: [0, -30], kneel: true, grow: 'home' },
    { kind: 'foundling', x: 4, z: -24, toward: [4, -30], kneel: true, grow: 'home' },
    { kind: 'clan', x: 7.5, z: -25.5, toward: [0, -24], talk: 0, grow: 'home' },
  ],
  vault: [
    { kind: 'clan', x: 3.4, z: -3.6, toward: [0, 0], grow: 'light' },
  ],
  pit: [
    // (once the pit reopens) two foundlings at their drill in the pit, two of the clan watching from the tiers
    { kind: 'foundling', x: 9.4, z: 0, toward: [14.6, 0], drill: 2.2, phase: 0, grow: 'yard' },
    { kind: 'foundling', x: 14.6, z: 0, toward: [9.4, 0], drill: 2.2, phase: Math.PI, grow: 'yard' },
    { kind: 'clan', x: 26, z: -3.4, toward: [12, 0], talk: 0, grow: 'yard' },
    { kind: 'clan', x: 26.4, z: 3.2, toward: [12, 0], talk: 1, grow: 'yard' },
  ],
  hangar: [
    { kind: 'clan', x: -11, z: 6, toward: [-9.4, 8.2], talk: 0, grow: 'hall' },
    { kind: 'clan', x: -9.4, z: 8.2, toward: [-11, 6], talk: 1, grow: 'hall' },
  ],
  forge: [
    // (once the clan gathers) the clan round the great forge
    { kind: 'clan', x: -13, z: 12, toward: [-11.4, 13.8], talk: 0, grow: 'heart' },
    { kind: 'clan', x: -11.4, z: 13.8, toward: [-13, 12], talk: 1, grow: 'heart' },
    { kind: 'clan', x: 12, z: 12, toward: [0, 0], grow: 'heart' },
    { kind: 'foundling', x: 10.6, z: 13.4, toward: [0, 0], grow: 'heart' },
  ],
};
export const HUB_FOLK = { temple: TEMPLE_FOLK, covert: COVERT_FOLK };
