// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// OPEN ZONES: big places to roam between missions, far larger than any arena, reached from every hero's hub (a station in
// each: data/hub.js). The first is the OLD CITY OF JEDHA. A zone is one level (world/arena.js builds its zo* layout
// through world/zone-stream.js) cut into square CHUNKS: every wall and roof is solid from the start (collision is plain
// data, and cheap), but a chunk's meshes are only built while someone is near it and thrown away once they are far, so
// phones and co-op hosts only ever draw the streets round them. game/zone.js runs the mode. Edit the words freely.
//
// A ZONE: { name, place, blurb, size (metres across, square), chunk (metres across a chunk), seed, level (what buildArena
//   reads), spawn [x, z, yaw] where you land, districts, waystones, life (its patrols, people and secrets: data/zone-jedha.js) }
// A DISTRICT: { id, name, kicker, x0, z0, x1, z1 (its rectangle; north is −z), line (the banner's line as you walk in) }.
//   A spot belongs to the first district whose rectangle holds it.
// A WAYSTONE: { id, name, x, z, district }: fast travel between the ones you have touched, and where you wake after a fall.
//   `gate` is the way out (back to the hub): the shuttle on the landing pad stands beside it.

import { JEDHA_LIFE } from './zone-jedha.js';

export const ZONE_PREFIX = 'zone:';
export const ZONE_TUNE = {
  build: 84,        // m: a chunk whose square comes this close to the camera is built (High and Medium quality)
  buildLow: 64,     // ...on Low quality (phones)
  drop: 112,        // m: a built chunk this far from every camera it serves is thrown away (a gap over `build`, so a hero
  dropLow: 88,      //    pacing along a chunk's edge doesn't build and drop it over and over)
  perFrame: 1,      // chunks built per frame at most, nearest first (the first ones round the spawn are built at once)
  warm: 40,         // m: on arrival, every chunk this close is built before the loading screen lifts
  reach: 2.6,       // m: close enough to a waystone to use it
  respawn: 2.4,     // s from a fall to waking at the nearest touched waystone
  districtHold: 3,  // s a district's banner waits before another may show (walking a border doesn't flicker)
};

export const ZONES = {
  jedha: {
    name: 'THE OLD CITY OF JEDHA', place: 'JEDHA', short: 'OLD CITY',
    blurb: 'The holy city\'s oldest streets, half empty since the occupation. Pilgrims still come. So do the patrols.',
    size: 240, chunk: 48, seed: 1607, life: JEDHA_LIFE,
    level: { name: 'OPEN ZONE — THE OLD CITY OF JEDHA', sub: 'Roam the old city. The shuttle on the pad takes you home.', arena: 240, layout: 'zoJedha', waves: [], hazards: {} },
    spawn: [0, 96, Math.PI],
    districts: [
      { id: 'gate', name: 'THE PILGRIMS\' GATE', kicker: 'SOUTH', x0: -40, z0: 40, x1: 40, z1: 120,
        line: 'The landing pad, the old gatehouse and the caravan yard. The patrols leave pilgrims be here.' },
      { id: 'silent', name: 'THE SILENT QUARTER', kicker: 'SOUTH-WEST', x0: -120, z0: 40, x1: -40, z1: 120,
        line: 'Whole streets left empty when the occupation came. Some of the roofs have fallen in.' },
      { id: 'cistern', name: 'THE DROWNED CISTERN', kicker: 'SOUTH-EAST', x0: 40, z0: 40, x1: 120, z1: 120,
        line: 'The city\'s old water stair, flooded since the dam above it cracked. Something glows under the rock.' },
      { id: 'square', name: 'THE PILLAR SQUARE', kicker: 'THE MIDDLE', x0: -40, z0: -40, x1: 40, z1: 40,
        line: 'The crossroads of the old city, where the Guardian fell. Every road runs through here.' },
      { id: 'bazaar', name: 'THE LOWER BAZAAR', kicker: 'WEST', x0: -120, z0: -40, x1: -40, z1: 40,
        line: 'Awnings, stalls and the smell of spice. The traders stayed, and so did the people watching them.' },
      { id: 'garrison', name: 'THE GARRISON', kicker: 'EAST', x0: 40, z0: -40, x1: 120, z1: 40,
        line: 'The occupation\'s walled compound, built over the old guild halls. Every patrol in the city starts here.' },
      { id: 'workings', name: 'THE KYBER WORKINGS', kicker: 'NORTH-WEST', x0: -120, z0: -120, x1: -40, z1: -40,
        line: 'Quarry pits and catacomb mouths, dug for crystal long before the Republic. Mostly dug out. Mostly.' },
      { id: 'temple', name: 'THE TEMPLE OF THE FIRST LIGHT', kicker: 'NORTH', x0: -40, z0: -120, x1: 40, z1: -40,
        line: 'The oldest temple in the city, broken open but still standing. The quiet here is very old.' },
      { id: 'shrines', name: 'THE HOLLOW SHRINES', kicker: 'NORTH-EAST', x0: 40, z0: -120, x1: 120, z1: -40,
        line: 'A field of standing stones and little domed shrines, one for every pilgrim who never went home.' },
    ],
    waystones: [
      { id: 'gate', name: 'PILGRIMS\' GATE', x: 10, z: 84, district: 'gate', gate: true },
      { id: 'square', name: 'PILLAR SQUARE', x: 12, z: 18, district: 'square' },
      { id: 'bazaar', name: 'LOWER BAZAAR', x: -78, z: 12, district: 'bazaar' },
      { id: 'temple', name: 'TEMPLE STEPS', x: 12, z: -50, district: 'temple' },
      { id: 'cistern', name: 'CISTERN STAIR', x: 62, z: 62, district: 'cistern' },
      { id: 'shrines', name: 'HOLLOW SHRINES', x: 64, z: -62, district: 'shrines' },
      { id: 'workings', name: 'KYBER WORKINGS', x: -62, z: -60, district: 'workings' },
      { id: 'silent', name: 'SILENT QUARTER', x: -60, z: 64, district: 'silent' },
    ],
  },
};

export const isZoneId = (id) => typeof id === 'string' && id.startsWith(ZONE_PREFIX);
export const zoneOf = (id) => ZONES[isZoneId(id) ? id.slice(ZONE_PREFIX.length) : id] || null;
export const zoneByLayout = (layout) => Object.values(ZONES).find(Z => Z.level.layout === layout) || null;
export function districtAt(Z, x, z){
  for (const d of Z.districts) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return null;
}
