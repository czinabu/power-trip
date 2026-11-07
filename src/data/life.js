// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIFE PAST THE EDGE (world/life.js): what moves in the outskirts while you fight, so the place out there reads as
// lived in and not as a painted wall. Each entry fits the map's world and its mission: an Imperial garrison has patrol
// craft and cargo haulers on the skylanes, a forest at dawn has birds over the canopy, a map at war or in a storm keeps
// only the war it already has (world/warfront.js). A layout not listed gets nothing. Purely visual. Edit freely.
//
// An entry can be a { worldDirection: entry } map for the layouts that change planet with the world (temple, foundry,
// plains: data/worlds.js WORLD_DIRECTIONS), so Coruscant's temple gets traffic and Ilum's glacier gets none.

/* TRAFFIC — airspeeders and haulers on skylanes. Lanes are square loops round the play space (the city's grid seen
   from above), each flown clear of the roofs under it, plus through traffic down the avenues that climbs over the map.
     craft     how many in the air at once
     rings     [inner, outer] half-widths of the play space the loops run between (1 is the edge)
     alt       [low, high] metres the lanes fly at
     cross     how many of the speeders are through traffic down the avenues (0: none)
     avenueAlt [low, high] metres they fly at between the blocks · crossAlt: and over the map (kept above its landmarks)
     speed     [slow, fast] m/s
     hauler    share of the craft that are slow cargo haulers instead of speeders
     colors    hull colours picked from per craft
     light     running-light colour (the theme's lamp if left out; false: none, for a map in broad daylight) */
/* BIRDS — flocks wheeling over the land past the edge.
     flocks    how many · per: birds in each · ring: [inner, outer] half-widths they circle over (below 1: over
               the play space itself, high above it: a canopy or canyon walls would hide them further out)
     alt       [low, high] metres · span: wingspan (m) · color: their dark shape against the sky
     soar      share of the time they glide, wings held (birds of prey soar; small birds flap) */
const garrisonLanes = { craft: 26, rings: [1.45, 3.2], alt: [16, 52], cross: 8, avenueAlt: [9, 24], crossAlt: [62, 80], speed: [20, 34], hauler: 0.3,
  colors: [0x6a7078, 0x8a8e96, 0x4a4e56, 0xa0a4aa], light: 0xff4a3a };

export const LIFE = {
  // the Imperial garrison block at the yards, at night in the rain: patrol speeders and haulers under red lamps
  garrison: { traffic: garrisonLanes },
  // the Vorran yards at dusk: cargo lighters running parts to the slips, slow and heavy
  shipyard: { traffic: { ...garrisonLanes, craft: 18, hauler: 0.6, speed: [14, 26], colors: [0x8a7a5a, 0x6a6458, 0x9a8e74], light: 0xffb050 } },
  // the chip foundry and the Iron Citadel: ore haulers on the industrial lanes, few and slow under the smoke
  chipworks: { traffic: { craft: 10, rings: [1.5, 3.0], alt: [20, 46], cross: 0, speed: [12, 20], hauler: 0.8, colors: [0x4a4a50, 0x5a524a], light: 0xffa040 } },
  citadel: { traffic: { craft: 10, rings: [1.5, 3.0], alt: [24, 50], cross: 0, speed: [12, 20], hauler: 0.8, colors: [0x3a3a40, 0x5a4a40], light: 0xff7a3a } },
  // Tipoca City: a few shuttles running between the stilt towers through the storm
  kamino: { traffic: { craft: 6, rings: [1.6, 3.4], alt: [26, 48], cross: 0, speed: [16, 24], hauler: 0, colors: [0xd8dce0, 0xb8c0c8], light: 0xcfe8ff } },
  // Salt Hollow at noon: a couple of skiffs and a slow hauler out on the flat, low over the salt
  outpost: { traffic: { craft: 4, rings: [1.5, 3.2], alt: [6, 14], cross: 0, speed: [10, 18], hauler: 0.4, colors: [0xc8b89a, 0x9a8a72], light: false } },
  // the temple and the forgeworks change planet with the world
  temple: {
    siege: { traffic: { ...garrisonLanes, craft: 34, cross: 12, colors: [0xa8a4a0, 0x7a7e86, 0xb8a888, 0x8a6a5a], light: 0xffd090 } },   // Coruscant
    worlds: { traffic: { craft: 8, rings: [1.5, 3.0], alt: [14, 34], cross: 0, speed: [12, 20], hauler: 0.4, colors: [0xb89a74, 0x8a7a64], light: 0xffd090 } },   // Jedha: pilgrims' skiffs, sparse under the occupation
  },
  foundry: {
    siege: { traffic: { craft: 10, rings: [1.5, 3.0], alt: [20, 46], cross: 0, speed: [12, 20], hauler: 0.8, colors: [0x4a4a50, 0x5a524a], light: 0xffa040 } },
    worlds: { traffic: { craft: 8, rings: [1.5, 3.0], alt: [24, 50], cross: 0, speed: [12, 20], hauler: 0.9, colors: [0x3a3a40, 0x4a4040], light: 0xff7a3a } },   // Mustafar: ore barges over the lava
  },
  // the cedar forest of Thane at dawn, the Jedi terrace on the temple mountain at dawn, the refuge valley at dusk
  holdfast: { birds: { flocks: 4, per: 9, ring: [0.5, 2.0], alt: [50, 72], span: 1.4, color: 0x2a2a26, soar: 0.3 } },
  hall: { birds: { flocks: 3, per: 7, ring: [1.4, 3.2], alt: [30, 70], span: 1.4, color: 0x3a3440, soar: 0.4 } },
  refuge: { birds: { flocks: 3, per: 6, ring: [0.6, 2.4], alt: [34, 70], span: 1.8, color: 0x241c20, soar: 0.6 } },
  // the Marshal's trail: red rock at noon, a few birds of prey riding the heat high over the canyon
  canyon: { birds: { flocks: 3, per: 3, ring: [0.3, 1.4], alt: [42, 70], span: 3.2, color: 0x2a1c16, soar: 0.9 } },
};
