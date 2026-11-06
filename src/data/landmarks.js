// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LANDMARKS: the colossal structures standing IN each map (world/landmarks.js builds them, in every mode that builds the
// map). Edit freely: a piece that would crowd a mission point, a door, a hazard or another solid is skipped, and
// tools/shots/map-audit.mjs names it, so move it and look again.
//   base    the map's built width (m) the positions are laid out for (a co-op room built wider moves them out with it)
//   mats    palette keys (data/worlds.js pal) or colours: a (the main body), b (second), dark, trim, glow
//   pieces  { kind, at: [x, z], ax: 1 along x / 0 along z, …the kind's own options }:
//     walker    a heavy walker parked on its legs, belly 9.6 m up              s (scale)
//     pylon     a square tower with buttress fins                              h, w (half-width), fin, finH
//     stack     a round smokestack, ducts round its foot                       h, r
//     giant     a forest giant: root buttresses, crown high overhead            h, r, crown, vines
//     stone     a sea-stack / hoodoo of broken rock, boulders round its foot   h, r, tiers, cap, boulders
//     arch      two piers and a lintel over a lane                             span, h, pw, th
//     freighter a grounded freighter, a long wall of hull                      len, w, h, ramp (−1 / 1: which flank)
//     statue    an armoured warrior on a plinth                                h, face (a quarter turn: 0 faces +z)
export const LANDMARKS = {
  // ---- the ARC trooper's story ----
  garrison: { base: 80, mats: { a: 'metal', b: 'wallD', dark: 'metalD', trim: 'stripe', glow: 'red', metal: 0.5 }, pieces: [
    { kind: 'walker', at: [16, -8], ax: 1 },                       // parked in the yard, its head over the gate road
    { kind: 'pylon', at: [0, 28], h: 42, w: 2.2 },                 // the garrison's comms mast behind the cell block
  ] },
  shipyard: { base: 84, mats: { a: 'hull', b: 'metal', dark: 'hullD', trim: 'yellow', glow: 'lamp', metal: 0.5 }, pieces: [
    { kind: 'freighter', at: [-12, 20], ax: 1, len: 8 },          // a bulk hauler in for refit
    { kind: 'freighter', at: [3, -23], ax: 0, len: 8, ramp: 1 },
    { kind: 'pylon', at: [22, 2], h: 40, w: 2.0, mats: { a: 'metalD', b: 'hullD', dark: 'metalD', trim: 'yellow', glow: 'red' } },   // crane towers
    { kind: 'pylon', at: [12, 24], h: 34, w: 2.0, mats: { a: 'metalD', b: 'hullD', dark: 'metalD', trim: 'yellow', glow: 'red' } },
  ] },
  jungle: { base: 84, mats: { a: 'bark', b: 'leaf', dark: 'leafD', trim: 'moss', glow: 'fungus', metal: 0, flat: true }, pieces: [
    { kind: 'giant', at: [-15, 25], h: 62, r: 2.8, crown: 13, vines: 1 },   // a forest giant the firebase was built round
  ] },
  kamino: { base: 80, mats: { a: 'wall', b: 'wallD', dark: 'metalD', trim: 'metal', glow: 'lamp', metal: 0.3 }, pieces: [
    { kind: 'pylon', at: [-6, 12], h: 46, w: 2.4 },                // the city's stilts, down through the drowned levels
    { kind: 'pylon', at: [20, 23], h: 46, w: 2.2 },
  ] },
  chipworks: { base: 80, mats: { a: 'metalD', b: 'imperial', dark: 'rock', trim: 'stripe', glow: 'glow', metal: 0.5 }, pieces: [
    { kind: 'stack', at: [-20, 17], h: 34, r: 3.2 },               // the foundry's smokestacks
    { kind: 'stack', at: [-30, -4], h: 28, r: 2.8 },
  ] },
  warcamp: { base: 84, mats: { a: 'metal', b: 'wall', dark: 'metalD', trim: 'cloth', glow: 'red', metal: 0.5 }, pieces: [
    { kind: 'walker', at: [-1, -24], ax: 0 },                      // the Marshal's walker, parked over the camp
    { kind: 'stone', at: [-23, -4], h: 32, r: 3.2, cap: 1, mats: { a: 'rock', b: 'wall', dark: 'wallD', trim: 0xe8ecf0, glow: 'red', metal: 0, flat: true } },
  ] },
  canyon: { base: 84, mats: { a: 'rock', b: 'rockD', dark: 'rockD', trim: 'sand', glow: 'ember', metal: 0, flat: true }, pieces: [
    { kind: 'arch', at: [-5, 13], ax: 1, span: 4.5, h: 13 },        // a natural arch over the trail
    { kind: 'stone', at: [-2, -23], h: 36, r: 3.6 },               // hoodoos left standing in the riverbed
    { kind: 'stone', at: [25, -10], h: 28, r: 3.0 },
  ] },
  relay: { base: 84, mats: { a: 'stoneD', b: 'stone', dark: 'stoneD', trim: 'stone', glow: 'old', metal: 0.1, flat: true }, pieces: [
    { kind: 'pylon', at: [-23, 2], h: 28, w: 1.8, beacon: false },  // the old makers' obelisks on the headland
    { kind: 'pylon', at: [24, 4], h: 26, w: 1.8, beacon: false },
    { kind: 'stone', at: [0, -26], h: 28, r: 3.2 },                // a sea-stack
  ] },
  // ---- the Mandalorian's story ----
  outpost: { base: 80, mats: { a: 0xb87a5a, b: 0xa06848, dark: 'adobeD', trim: 0xe8e2d4, glow: 'lamp', metal: 0, flat: true }, pieces: [
    { kind: 'freighter', at: [17, 34], ax: 1, len: 9, mats: { a: 'hull', b: 'adobeD', dark: 'hullD', trim: 'stripe', glow: 'engine', metal: 0.4 } },   // a salt hauler grounded past the pad
    { kind: 'stone', at: [31, 10], h: 28, r: 3.2, cap: 1 },        // a red mesa on the flat, the town built up to it
  ] },
  covert: { base: 80, mats: { a: 'rock', b: 'rockD', dark: 'rockD', trim: 'clay', glow: 'fire', metal: 0, flat: true }, pieces: [
    { kind: 'statue', at: [-12, 25], h: 28, face: Math.PI,          // the clan's first Mandalorian, carved from the canyon wall's rock
      mats: { a: 'clay', b: 'beskar', dark: 'rockD', trim: 0x6a2a1e, glow: 0x0a0806, metal: 0.2 } },
    { kind: 'stone', at: [6, -23], h: 34, r: 3.2 },                // pillars of the canyon left standing in the yard
    { kind: 'stone', at: [12, 29], h: 28, r: 2.8 },
  ] },
  barge: { base: 80, mats: { a: 'metalD', b: 'hullM', dark: 'bar', trim: 'stripe', glow: 'alarm', metal: 0.6 }, pieces: [
    { kind: 'pylon', at: [24, 17], h: 32, w: 2.0 },                // the barge's masts, floodlit through the rain
    { kind: 'pylon', at: [-12, 28], h: 30, w: 2.0 },
  ] },
  holdfast: { base: 80, mats: { a: 'bark', b: 'leaf', dark: 'leafL', trim: 'moss', glow: 'ember', metal: 0, flat: true }, pieces: [
    { kind: 'giant', at: [23, 0], h: 66, r: 3.0, crown: 13 },      // the cedars the holdfast was built among
    { kind: 'giant', at: [6, -24], h: 60, r: 2.4, crown: 11 },
    { kind: 'giant', at: [24, 20], h: 58, r: 2.4, crown: 11 },
  ] },
  citadel: { base: 80, mats: { a: 'iron', b: 'ironD', dark: 'ironD', trim: 'rust', glow: 'molten', metal: 0.7 }, pieces: [
    { kind: 'statue', at: [-21, -31], h: 30, face: 0, mats: { a: 'iron', b: 'beskar', dark: 'ironD', trim: 'cloth', glow: 'fire', metal: 0.7 } },   // the Magistrate's iron colossi either side of the throne
    { kind: 'statue', at: [26, -30], h: 30, face: 0, mats: { a: 'iron', b: 'beskar', dark: 'ironD', trim: 'cloth', glow: 'fire', metal: 0.7 } },
    { kind: 'stack', at: [3, 20], h: 32, r: 3.0 },                 // the furnace stacks over the yard
    { kind: 'stack', at: [-16, 24], h: 28, r: 2.8 },
  ] },
};
