// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HIDDEN TEMPLE ON TYTHON: the hub. Five wings, each its own room (world/arenas/tython.js builds them, data/worlds.js
// HUB_WORLDS colours them), joined by great doors: walk through one and the wing beyond loads, so only one wing is ever in
// memory (phones and co-op hosts stay smooth). game/hub.js runs it, ui/hub-ui.js draws the station panels. Edit freely.
//
// Sides: n is −z (the way the hero faces on arrival), s is +z, e is +x, w is −x. A door on a side stands in the middle
// of that wall; walking into it takes you to the wing it names, arriving at that wing's door back.

export const HUB = {
  start: 'hall',
  doorHalf: 5.5,   // metres either side of a door's middle that count as walking through it
  doorReach: 1.8,  // ...within this of the edge
};

/* each wing: its level (what buildArena reads), its doors and its stations. A station's `act` is what tapping H at it
   does (game/hub.js STATION_ACTS): its panel lists `opts`. x, z in metres from the wing's middle */
export const HUB_WINGS = {
  hall: {
    name: 'THE GRAND HALL', short: 'GRAND HALL',
    blurb: 'The heart of the temple: every wing opens off it, and every journey starts here.',
    level: { name: 'THE HIDDEN TEMPLE — THE GRAND HALL', sub: 'Tython. Walk up to a station and tap H.', arena: 96, layout: 'tyHall', waves: [], hazards: {} },
    doors: { n: 'council', e: 'training', w: 'archives', s: 'forge' },
    spawn: [0, 30, Math.PI],
    stations: [
      { id: 'map', x: 0, z: 0, name: 'TEMPLE MAP', act: 'travel', r: 11 },
    ],
  },
  council: {
    name: 'THE COUNCIL CHAMBER', short: 'COUNCIL',
    blurb: 'Where the Order chose its battles. The council table sends you, and your party, anywhere.',
    level: { name: 'THE HIDDEN TEMPLE — THE COUNCIL CHAMBER', sub: 'The council table launches any mode.', arena: 64, layout: 'tyCouncil', waves: [], hazards: {} },
    doors: { s: 'hall' },
    spawn: [0, 20, Math.PI],
    stations: [
      { id: 'table', x: 0, z: 0, name: 'COUNCIL TABLE', act: 'council', r: 9 },
      { id: 'waystone', x: 9, z: 24, name: 'WAYSTONE', act: 'travel' },
    ],
  },
  training: {
    name: 'THE TRAINING WING', short: 'TRAINING',
    blurb: 'Mats, rings and remotes. Learn the moves, spar with anything, or see how long you can hold.',
    level: { name: 'THE HIDDEN TEMPLE — THE TRAINING WING', sub: 'Training, sparring and the proving ground.', arena: 76, layout: 'tyTraining', waves: [], hazards: {} },
    doors: { w: 'hall' },
    spawn: [-28, 0, Math.PI / 2],
    stations: [
      { id: 'grounds', x: -6, z: -18, name: 'TRAINING GROUNDS', act: 'training' },
      { id: 'sparring', x: 14, z: 0, name: 'SPARRING HALL', act: 'sparring' },
      { id: 'proving', x: -6, z: 18, name: 'PROVING GROUND', act: 'proving' },
      { id: 'waystone', x: -30, z: 9, name: 'WAYSTONE', act: 'travel' },
    ],
  },
  archives: {
    name: 'THE ARCHIVES', short: 'ARCHIVES',
    blurb: 'Everything the Order learned, and everything you have: the codex, your holocron, the mission records.',
    level: { name: 'THE HIDDEN TEMPLE — THE ARCHIVES', sub: 'The codex, your holocron and the mission records.', arena: 72, layout: 'tyArchive', waves: [], hazards: {} },
    doors: { e: 'hall' },
    spawn: [26, 0, -Math.PI / 2],
    stations: [
      { id: 'terminal', x: 0, z: 0, name: 'ARCHIVE TERMINAL', act: 'codex', r: 4 },
      { id: 'holocron', x: -22, z: -4.5, name: 'HOLOCRON', act: 'profile' },
      { id: 'records', x: -22, z: 4.5, name: 'MISSION RECORDS', act: 'records' },
      { id: 'waystone', x: 28, z: 9, name: 'WAYSTONE', act: 'travel' },
    ],
  },
  forge: {
    name: 'THE SABER FORGE', short: 'FORGE',
    blurb: 'A crystal cave under the temple, where every Jedi builds a blade of their own.',
    level: { name: 'THE HIDDEN TEMPLE — THE SABER FORGE', sub: 'Make your hero your own.', arena: 56, layout: 'tyForge', waves: [], hazards: {} },
    doors: { n: 'hall' },
    spawn: [0, -18, 0],
    stations: [
      { id: 'bench', x: 0, z: 6, name: 'SABER FORGE', act: 'forge', r: 4 },
      { id: 'waystone', x: 8, z: -20, name: 'WAYSTONE', act: 'travel' },
    ],
  },
};
export const HUB_ORDER = ['hall', 'council', 'training', 'archives', 'forge'];

// the side a door to `to` stands on in wing `from`
export function doorSide(from, to){
  const d = HUB_WINGS[from] && HUB_WINGS[from].doors;
  for (const k in d || {}) if (d[k] === to) return k;
  return null;
}
// outward unit vector of a side
export const SIDE_OUT = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
