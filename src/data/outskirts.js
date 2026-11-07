// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// OUTSKIRTS — the world past the playable floor (world/outskirts.js). The backdrop used to be a ring of silhouettes
// round an empty floor, so a map read as a stage with nothing outside it. The outskirts fill the land between the
// edge and the horizon with the place the map is part of: city blocks and the avenues that lead out of the yard, a
// forest that goes on, a rock field that rolls away. No collision and no gameplay; it is baked into the backdrop (so it
// takes the far haze, the wall detail and, at night, the lit windows) and every mode that builds the map gets it.
// Edit freely.

/* STYLE — what a map's outskirts are. A layout not listed here takes its style from its world (world/outskirts.js
   styleFor: city-like backdrops → 'city', grass or forest giants → 'forest', anything else → 'rocks').
   'none' leaves a map alone (the indoor rooms, which have walls and a roof between you and the outside, and the maps
   whose outside is open sea or grassland that the backdrop already shows). A layout that changes planet with the world
   (data/worlds.js WORLD_DIRECTIONS) can give one per world: { siege, worlds, frozen }. */
export const OUTSKIRTS_STYLE = {
  archive: 'none', dojo: 'none', hangar: 'none', throne: 'none', frigate: 'none', jedhaNight: 'none',
  // the hubs' wings are halls under a roof (the temple's, the cloning citadel's, the covert's), and the crystal cave
  tyHall: 'none', tyCouncil: 'none', tyTraining: 'none', tyArchive: 'none', tyForge: 'none',
  kmDeck: 'none', kmWar: 'none', kmRange: 'none', kmHalls: 'none', kmArmory: 'none',
  mfForge: 'none', mfClan: 'none', mfPit: 'none', mfVault: 'none', mfHangar: 'none',
  jungle: 'forest', holdfast: 'forest',
  canyon: 'rocks', refuge: 'rocks', warcamp: 'rocks', hall: 'rocks', forge: 'rocks', approach: 'rocks', sith: 'rocks', sithGate: 'rocks',
  relay: 'rocks',   // a spire on a bare black headland over the sea
  pens: 'rocks',    // the Inquisitors' prison moon: black wet rock, nobody lives out there
  garrison: 'city', shipyard: 'city', chipworks: 'city', citadel: 'city',
  meltworks: 'rocks',   // the Imperial foundry cut into the ice: glacier all round it
  foundry: { siege: 'city', worlds: 'city', frozen: 'rocks' },
  covert: 'town',   // the clan's dwellings cut into the canyon, low and few, not towers
  prison: 'none',   // a lone Imperial yard on the Grass Sea: open grass to the horizon
  barge: 'none',    // the prison barge out on the storm sea: nothing but water past the rail
  // the temple: Coruscant's city, Jedha's holy city, Ilum's bare glacier · the plains: Coruscant's ruins, Exegol's
  // Sith wastes and Hoth's snowfield are no city
  temple: { siege: 'city', worlds: 'city', frozen: 'rocks' },
  plains: { siege: 'city', worlds: 'rocks', frozen: 'rocks' },
  kamino: 'stilts',
  outpost: 'town',
};

/* the look of each style. Distances are in half-widths of the play space, measured square-on from its middle (1 is
   the edge): the land from `from` to `to` is filled, the nearest of it held `clear` metres off the edge (the camera's
   reach behind a hero at the wall, and the room the map's own backdrop stands in).
     cell     city grid: one block plus its street (m) · block: share of the cell a building fills
     h        building height (m) at the near edge of the outskirts → at the far edge (they climb toward the horizon)
     fill     share of the cells that get something
     avenue   width (m) of the roads that run straight out from the middle of each side, lamps along both kerbs
     lamp     metres between street lamps (0: none) */
export const OUTSKIRTS = {
  city:   { from: 1, to: 4.2, clear: 16, cell: 24, block: [0.55, 0.8], h: [14, 68], fill: 0.78, avenue: 12, lamp: 16, setback: 0.35, beacon: 0.25 },
  town:   { from: 1, to: 3.6, clear: 14, cell: 18, block: [0.45, 0.75], h: [4, 12], fill: 0.62, avenue: 10, lamp: 0, setback: 0.2, beacon: 0, domes: 0.35 },
  forest: { from: 1, to: 3.6, clear: 12, cell: 11, h: [16, 44], fill: 0.72 },
  // rocks climb into ranges toward the horizon, tall enough to show over a map's own ring of cliffs
  rocks:  { from: 1, to: 4.4, clear: 14, cell: 22, h: [8, 110], fill: 0.55 },
  // Kamino: more of the city's stilt towers standing out of the sea, saucer decks on top
  stilts: { from: 1, to: 4.2, clear: 20, cell: 30, h: [14, 52], fill: 0.5 },
};
