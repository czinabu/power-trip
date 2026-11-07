// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// OPEN ZONES: big places to roam between missions, far larger than any arena, reached from every hero's hub (a station in
// each: data/hub.js) and from the galaxy map on every hero's ship (data/hero-ships.js). The first is the OLD CITY OF
// JEDHA (open after Act I); the second is the RUINS OF THE SITH GATE, the dead city on the far side of the gate under
// Jedha (open after Act IV's first chapter). A zone is one level (world/arena.js builds its zo* layout
// through world/zone-stream.js) cut into square CHUNKS: every wall and roof is solid from the start (collision is plain
// data, and cheap), but a chunk's meshes are only built while someone is near it and thrown away once they are far, so
// phones and co-op hosts only ever draw the streets round them. game/zone.js runs the mode. Edit the words freely.
//
// A ZONE: { name, place, blurb, opensAfter (the chapter that opens it: game/zone-gate.js), size (metres across, square), chunk (metres across a chunk), seed, level (what buildArena
//   reads), spawn [x, z, yaw] where you land, districts, waystones, life (its patrols, people and secrets: data/zone-jedha.js),
//   foeLook (optional: the uniform its foes wear, as a story mission's: enemies/look.js), home (optional: the waystone
//   panel's line for the way home) }
// A DISTRICT: { id, name, kicker, x0, z0, x1, z1 (its rectangle; north is −z), line (the banner's line as you walk in) }.
//   A spot belongs to the first district whose rectangle holds it.
// A WAYSTONE: { id, name, x, z, district }: fast travel between the ones you have touched, and where you wake after a fall.
//   `gate` is the way out (back to the hub): the shuttle on the landing pad stands beside it.

import { JEDHA_LIFE } from './zone-jedha.js';
import { RUINS_LIFE, CHOIR_LOOK } from './zone-ruins.js';

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
    // THE GATE (game/zone-gate.js): the chapter whose close opens it, per hero. 'trial-first' is Act I's last chapter in
    // every story (the Jedi's TRIAL OF THE WALL, the Mando's THE EXILE'S CHALLENGE, the trooper's BROTHERS IN ARMS).
    // Change it to any chapter id in data/campaign.js (e.g. 'mustafar', the end of Act II), or delete it to open it from the start.
    opensAfter: 'trial-first',
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
  // THE RUINS OF THE SITH GATE (world/zones/ruins-plan.js): Darth Kharel's dead city, a thousand years buried on the far
  // side of the gate under the Jedha temple. General Kast's camp holds the threshold; the Hollow Choir holds the rest.
  // It opens with the gate: once this hero has closed THE GATE WAKES, Act IV's first chapter (game/zone-gate.js).
  ruins: {
    name: 'THE RUINS OF THE SITH GATE', place: 'THE SITH GATE', short: 'GATE RUINS',
    blurb: 'Kharel\'s dead city, through the gate under Jedha. Kast holds the threshold. The Hollow Choir holds the rest.',
    opensAfter: 'gate-wake',
    size: 240, chunk: 48, seed: 4113, life: RUINS_LIFE, foeLook: CHOIR_LOOK,
    home: { line: 'Walk back through the gate to Jedha, and home. You can come back any time.', guest: 'Walk back through the gate and home. The rest of the party stays in the ruins.' },
    level: { name: 'OPEN ZONE — THE RUINS OF THE SITH GATE', sub: 'Roam the dead city. The gate behind you leads home.', arena: 240, layout: 'zoRuins', waves: [], hazards: {} },
    spawn: [0, 93, Math.PI],
    districts: [
      { id: 'threshold', name: 'THE THRESHOLD', kicker: 'SOUTH', x0: -40, z0: 40, x1: 40, z1: 120,
        line: 'The gate\'s far side, and General Kast\'s camp in its forecourt. The Choir keeps clear of the soldiers here.' },
      { id: 'barrows', name: 'THE BARROW FIELD', kicker: 'SOUTH-WEST', x0: -120, z0: 40, x1: -40, z1: 120,
        line: 'Grave mounds and tombs: the Jedi who fell burying him, laid down where they fell.' },
      { id: 'mere', name: 'THE BLACK MERE', kicker: 'SOUTH-EAST', x0: 40, z0: 40, x1: 120, z1: 120,
        line: 'A drowned court of the old city. The water is black, and perfectly still, and it hums.' },
      { id: 'avenue', name: 'THE AVENUE OF THE UNBURIED', kicker: 'THE MIDDLE', x0: -40, z0: -40, x1: 40, z1: 40,
        line: 'His statues line the road to his tomb, every one with the same worn-away face. The Jedi pulled the biggest down.' },
      { id: 'cloister', name: 'THE CHOIR\'S CLOISTER', kicker: 'WEST', x0: -120, z0: -40, x1: -40, z1: 40,
        line: 'Where the Hollow Choir slept and sang. Some of the stones are still singing.' },
      { id: 'bastion', name: 'THE CHOIR\'S BASTION', kicker: 'EAST', x0: 40, z0: -40, x1: 120, z1: 40,
        line: 'The Choir\'s walled hold, raised over the dead city\'s barracks. Every patrol in the ruins marches out of it.' },
      { id: 'scar', name: 'THE BLEEDING SCAR', kicker: 'NORTH-WEST', x0: -120, z0: -120, x1: -40, z1: -40,
        line: 'The Choir\'s quarry, dug for crystal close to his tomb. Every crystal they found had turned red.' },
      { id: 'tomb', name: 'THE TOMB OF KHAREL', kicker: 'NORTH', x0: -40, z0: -120, x1: 40, z1: -40,
        line: 'The barrow-temple the Jedi raised over his grave, broken open from the inside. It is empty now. Mostly.' },
      { id: 'masks', name: 'THE FIELD OF MASKS', kicker: 'NORTH-EAST', x0: 40, z0: -120, x1: 120, z1: -40,
        line: 'The Choir bury their dead standing, a mask on every stone. There are a great many stones.' },
    ],
    waystones: [
      { id: 'threshold', name: 'THE THRESHOLD', x: 10, z: 84, district: 'threshold', gate: true },
      { id: 'avenue', name: 'PLAZA OF THE FALLEN', x: 12, z: 18, district: 'avenue' },
      { id: 'cloister', name: 'CLOISTER COURT', x: -78, z: 4, district: 'cloister' },
      { id: 'tomb', name: 'TOMB STEPS', x: 12, z: -50, district: 'tomb' },
      { id: 'mere', name: 'MERE STAIR', x: 62, z: 62, district: 'mere' },
      { id: 'masks', name: 'FIELD OF MASKS', x: 64, z: -62, district: 'masks' },
      { id: 'scar', name: 'BLEEDING SCAR', x: -62, z: -60, district: 'scar' },
      { id: 'barrows', name: 'BARROW FIELD', x: -60, z: 70, district: 'barrows' },
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
