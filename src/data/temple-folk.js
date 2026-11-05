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
  archivist: { looks: [0, 1, 2].map(i => ({
    parts: { robe: 'outer', hair: ['bald', 'long', 'short'][i], beard: ['full', 'none', 'goatee'][i] },
    palette: { skin: SKIN[(i + 4) % 6], hair: 0xd8d4cc, ...robe([0xb8a080, 0xd8c8a0, 0xa8946a][i], 0x8c7656, 0xe6e2d8) } })) },
};

const HALL_LOOP = [[-14, -36], [14, -36], [14, 36], [-14, 36]];

export const TEMPLE_FOLK = {
  hall: [
    // a master leading two younglings up and down the processional
    { kind: 'master', loop: HALL_LOOP, speed: 1.1, lead: 0 },
    { kind: 'youngling', loop: HALL_LOOP, speed: 1.1, lead: -1.6 },
    { kind: 'youngling', loop: HALL_LOOP, speed: 1.1, lead: -3.0 },
    // two knights by the west colossus, talking; one by the pool, watching the map turn
    { kind: 'knight', x: -27, z: 6, toward: [-25.6, 7.4], talk: 0 },
    { kind: 'knight', x: -25.6, z: 7.4, toward: [-27, 6], talk: 1 },
    { kind: 'master', x: 9.5, z: -9.5, toward: [0, 0] },
  ],
  council: [
    // two masters at the table, over the galaxy, taking turns; one walking slowly round it
    { kind: 'master', x: -4.6, z: -3.6, toward: [4.6, -3.6], talk: 0 },
    { kind: 'master', x: 4.6, z: -3.6, toward: [-4.6, -3.6], talk: 1 },
    { kind: 'knight', loop: [...Array(12)].map((_, i) => [Math.cos(-i / 12 * Math.PI * 2) * 7.2, Math.sin(-i / 12 * Math.PI * 2) * 7.2]), speed: 0.6 },
  ],
  training: [
    // a class on the training grounds' mat, drilling a form on their master's count
    { kind: 'master', x: -6, z: -23, toward: [-6, -18], talk: 0 },
    { kind: 'pupil', x: -9, z: -20.4, toward: [-9, -26], drill: 1.6 },
    { kind: 'pupil', x: -6, z: -20.4, toward: [-6, -26], drill: 1.6 },
    { kind: 'pupil', x: -3, z: -20.4, toward: [-3, -26], drill: 1.6 },
    // two younglings sparring on the proving ground, either side of its ring
    { kind: 'pupil', x: -8.6, z: 18, toward: [-6, 18], drill: 2.4, phase: 0 },
    { kind: 'pupil', x: -3.4, z: 18, toward: [-6, 18], drill: 2.4, phase: Math.PI },
  ],
  archives: [
    // archivists on their rounds of the reading floor, one at the desk, and a knight reading down an aisle
    { kind: 'archivist', loop: [[-18, -6.4], [18, -6.4], [18, 6.4], [-18, 6.4]], speed: 0.8, lead: 0 },
    { kind: 'archivist', x: 0, z: -3.3, toward: [0, 0] },
    { kind: 'knight', x: -14, z: 11.25, toward: [-20, 11.25] },
  ],
  forge: [
    // a Jedi kneeling in meditation at the edge of the circle, facing the heart crystal
    { kind: 'knight', x: -4.2, z: 9.2, toward: [0, 6], kneel: true },
  ],
};
