// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HUBS: where every run starts and comes back to, one per hero. The Jedi walks the hidden temple on Tython, the ARC
// trooper the clone citadel on Kamino, the Mando the hidden covert round its great forge (more can join HUBS below). Co-op loads the HOST's hero's hub for the whole party
// (game/hub.js hubIdFor). Each hub is a set of wings, each its own room (its world/arenas/ builder, data/worlds.js
// HUB_WORLDS colours it), joined by great doors: walk through one and the wing beyond loads, so only one wing is ever in
// memory (phones and co-op hosts stay smooth). game/hub.js runs them, ui/hub-ui.js draws the station panels. Edit freely.
//
// Sides: n is −z (the way the hero faces on arrival), s is +z, e is +x, w is −x. A door on a side stands in the middle
// of that wall; walking into it takes you to the wing it names (in the same hub), arriving at that wing's door back.
//
// A HUB: { name, place, home (what "RETURN TO …" says), tile (the title screen's line), travel (the map panel's line),
//   room (what the HUD calls a room: 'WING', 'DECK'…), start, order (the map's list), wings }
// A WING: its level (what buildArena reads: each hub's layouts share a prefix, world/arena.js hands them to its builder),
//   its doors and its stations. A station's `act` is what tapping F at it does (ui/hub-ui.js options): x, z in metres
//   from the wing's middle. The acts: travel, council (every mode), training, sparring (sandbox), proving (survival),
//   codex, profile, records, forge (the saber bench for a Jedi, the customizer for all; ARMORY for a gunner), raid (the
//   raid page: data/raids.js; every hub's mission table carries it too), shuttle (the ship to an open zone: data/zones.js),
//   duel (the duel ring: challenge a friend, watch from the balcony, practise), honours (the duel record, by the ring).
//   deeds (the hub's trophy hall: what it has restored, its trophies and its friends, data/hub-growth.js).

import { KAMINO_WINGS } from './hub-kamino.js';   // the clone citadel's wings
import { COVERT_WINGS, COVERT_ORDER } from './hub-covert.js';   // the hidden covert's wings
import { HERO_SHIPS, SHIP_WING } from './hero-ships.js';   // each hub's ship: one more wing, boarded from its pad (data/hero-ships.js)

export const HUB = {
  doorHalf: 5.5,   // metres either side of a door's middle that count as walking through it
  doorReach: 1.8,  // ...within this of the edge
  stride: 1.5,     // how much faster the hero walks in the temple than in a fight: its halls are long (player/locomotion.js)
  arrive: 10,      // metres in from the wall a hero walking through a door arrives
};

/* THE HIDDEN TEMPLE ON TYTHON: the Jedi's hub (world/arenas/tython.js builds its ty* wings) */
const TEMPLE_WINGS = {
  hall: {
    name: 'THE GRAND HALL', short: 'GRAND HALL',
    blurb: 'The heart of the temple: every wing opens off it, and every journey starts here. Calls for aid from across the galaxy reach the stone by the door.',
    level: { name: 'THE HIDDEN TEMPLE — THE GRAND HALL', sub: 'Tython. Walk up to a station and tap F.', arena: 96, layout: 'tyHall', waves: [], hazards: {} },
    map: ['pillars'],   // what the hub map draws the room with (ui/hub-map.js ART)
    doors: { n: 'council', e: 'training', w: 'archives', s: 'forge' },
    spawn: [0, 20, Math.PI],
    stations: [
      { id: 'map', x: 0, z: 0, name: 'TEMPLE MAP', act: 'travel', r: 11 },
      { id: 'calls', x: 8, z: 24, name: 'CALLS FOR AID', act: 'quests' },   // the side missions (data/side-quests.js)
    ],
  },
  council: {
    name: 'THE COUNCIL CHAMBER', short: 'COUNCIL',
    blurb: 'Where the Order chose its battles. The council table sends you, and your party, anywhere.',
    level: { name: 'THE HIDDEN TEMPLE — THE COUNCIL CHAMBER', sub: 'The council table launches any mode.', arena: 64, layout: 'tyCouncil', waves: [], hazards: {} },
    doors: { s: 'hall', n: 'landing' },
    spawn: [0, 20, Math.PI],
    stations: [
      { id: 'table', x: 0, z: 0, name: 'COUNCIL TABLE', act: 'council', r: 9 },
      { id: 'waystone', x: 9, z: 24, name: 'WAYSTONE', act: 'travel' },
      { id: 'raid', x: -9, z: 24, name: 'THE RAID TABLE', act: 'raid' },   // the raids (data/raids.js), once Act IV is beaten
    ],
  },
  // past the council chamber, out under the sky: the pilgrim shuttle that runs to the old city of Jedha (an open zone:
  // data/zones.js), once the story has opened it (game/zone-gate.js)
  landing: {
    name: 'THE LANDING PLATFORM', short: 'LANDING',
    blurb: 'A terrace past the council chamber where the pilgrim shuttles set down. One still runs to the old city of Jedha.',
    level: { name: 'THE HIDDEN TEMPLE — THE LANDING PLATFORM', sub: 'The Dawnreach on its pad, ready for anywhere in the galaxy.', arena: 64, layout: 'tyLanding', waves: [], hazards: {} },
    map: ['pads'],   // what the hub map draws the room with (ui/hub-map.js ART)
    doors: { s: 'council' },
    spawn: [0, 20, Math.PI],
    stations: [
      { id: 'shuttle', x: 0, z: 2, name: 'THE DAWNREACH', act: 'shuttle', r: 4 },
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
      // DUEL MODE (game/duel-mode.js): the sparring hall's ring is the duel ring; its spectators' balcony and the trophy case
      { id: 'duelring', x: 14, z: -17, name: 'DUEL RING', act: 'duel' },
      { id: 'honours', x: 24.6, z: 16.6, name: 'DUEL HONOURS', act: 'honours' },
    ],
  },
  archives: {
    name: 'THE ARCHIVES', short: 'ARCHIVES',
    blurb: 'Everything the Order learned, and everything you have: the codex, your holocron, the mission records.',
    level: { name: 'THE HIDDEN TEMPLE — THE ARCHIVES', sub: 'The codex, your holocron and the mission records.', arena: 72, layout: 'tyArchive', waves: [], hazards: {} },
    map: ['shelves'],   // what the hub map draws the room with (ui/hub-map.js ART)
    doors: { e: 'hall', w: 'trophies' },
    spawn: [26, 0, -Math.PI / 2],
    stations: [
      { id: 'terminal', x: 0, z: 0, name: 'ARCHIVE TERMINAL', act: 'codex', r: 4 },
      { id: 'holocron', x: -22, z: -4.5, name: 'HOLOCRON', act: 'profile' },
      { id: 'records', x: -22, z: 4.5, name: 'MISSION RECORDS', act: 'records' },
      { id: 'waystone', x: 28, z: 9, name: 'WAYSTONE', act: 'travel' },
    ],
  },
  // past the archives, west: THE TROPHY HALL, where the temple keeps what you've beaten, a banner for every raid day won
  // and a wall naming the friends who stood with you (data/hub-growth.js, world/arenas/growth-kit.js)
  trophies: {
    name: 'THE TROPHY HALL', short: 'TROPHY HALL',
    blurb: 'What the temple has won back: a trophy from every great foe you have beaten, a banner for every raid, and the names of everyone who stood with you.',
    level: { name: 'THE HIDDEN TEMPLE — THE TROPHY HALL', sub: 'Your trophies, your raid banners and your friends.', arena: 64, layout: 'tyTrophy', waves: [], hazards: {} },
    map: ['plinths'],   // what the hub map draws the room with (ui/hub-map.js ART)
    doors: { e: 'archives' },
    spawn: [22, 0, -Math.PI / 2],
    stations: [
      { id: 'deeds', x: 0, z: 0, name: 'THE LEDGER OF DEEDS', act: 'deeds', r: 4 },
      { id: 'waystone', x: 26, z: 9, name: 'WAYSTONE', act: 'travel' },
    ],
  },
  forge: {
    name: 'THE SABER FORGE', short: 'FORGE',
    blurb: 'A crystal cave under the temple, where every Jedi builds a blade of their own.',
    level: { name: 'THE HIDDEN TEMPLE — THE SABER FORGE', sub: 'Make your hero your own.', arena: 56, layout: 'tyForge', waves: [], hazards: {} },
    map: ['crystals'],   // what the hub map draws the room with (ui/hub-map.js ART)
    doors: { n: 'hall' },
    spawn: [0, -18, 0],
    stations: [
      { id: 'bench', x: 0, z: 6, name: 'SABER FORGE', act: 'forge', r: 4 },
      { id: 'waystone', x: 8, z: -20, name: 'WAYSTONE', act: 'travel' },
    ],
  },
};

const HUB_LIST = {
  temple: { name: 'THE HIDDEN TEMPLE', place: 'TYTHON', home: 'THE TEMPLE', room: 'WING',
    tile: 'Your hub on Tython: gather your party, pick a mission',
    travel: 'Travel to any wing of the temple.',
    start: 'hall', order: ['hall', 'council', 'landing', 'training', 'archives', 'trophies', 'forge'], wings: TEMPLE_WINGS },
  kamino: { name: 'THE CLONE CITADEL', place: 'KAMINO', home: 'THE CITADEL', room: 'DECK',
    tile: 'Your hub on Kamino: gather your squad, pick a mission',
    travel: 'Travel to any deck of the citadel.',
    start: 'deck', order: ['deck', 'warroom', 'range', 'halls', 'armory'], wings: KAMINO_WINGS },
  covert: { name: 'THE HIDDEN COVERT', place: 'UNDER THE RUINS', home: 'THE COVERT', room: 'HALL',
    tile: 'Your clan\'s hub: gather your party, pick a job',
    travel: 'Travel to any hall of the covert.',
    start: 'forge', order: COVERT_ORDER, wings: COVERT_WINGS },
};
// every hub's SHIP (data/hero-ships.js): one more wing of it, last on its map's list, boarded at its pad or hangar
for (const [id, H] of Object.entries(HUB_LIST)) if (HERO_SHIPS[id]){ H.wings = { ...H.wings, [SHIP_WING]: HERO_SHIPS[id].wing }; H.order = [...H.order, SHIP_WING]; }
export const HUBS = HUB_LIST;
// which hub each hero calls home (a hero without one of their own uses the temple)
export const HERO_HUB = { jedi: 'temple', trooper: 'kamino', mando: 'covert' };
export const hubOf = (hero) => HUBS[HERO_HUB[hero]] ? HERO_HUB[hero] : 'temple';
// every wing of every hub, for registering their levels and finding a wing by its layout
export const ALL_WINGS = Object.entries(HUBS).flatMap(([hub, H]) => Object.entries(H.wings).map(([id, W]) => ({ hub, id, W })));
export const wingByLayout = (layout) => ALL_WINGS.find(w => w.W.level.layout === layout) || null;


// the side a door to `to` stands on in wing `from`
export function doorSide(wings, from, to){
  const d = wings[from] && wings[from].doors;
  for (const k in d || {}) if (d[k] === to) return k;
  return null;
}
// outward unit vector of a side
export const SIDE_OUT = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
