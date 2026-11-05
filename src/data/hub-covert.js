// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HIDDEN COVERT: the Mando's hub. The same plan as the temple on Tython (data/hub.js): five wings, each its own room
// (world/arenas/covert-hub.js builds them, data/worlds.js COVERT_WORLDS colours them), joined by great doors, so only one
// wing is ever in memory. The clan's new home after Orvane: halls hewn into the rock under a ruined city, built round
// a great forge. Same station acts as the temple, so every mode opens from here the way it does from there. Edit freely.
//
// Sides: n is −z (the way the hero faces on arrival), s is +z, e is +x, w is −x (data/hub.js SIDE_OUT).

export const COVERT = {
  id: 'covert',
  name: 'THE HIDDEN COVERT',
  start: 'forge',
  doorHalf: 5.5,
  doorReach: 1.8,
};

export const COVERT_WINGS = {
  forge: {
    name: 'THE GREAT FORGE', short: 'GREAT FORGE',
    blurb: 'The heart of the covert: a furnace that never goes out, and the anvil every piece of the clan\'s armour was beaten on.',
    level: { name: 'THE HIDDEN COVERT — THE GREAT FORGE', sub: 'Walk up to a station and tap F.', arena: 88, layout: 'mfForge', waves: [], hazards: {} },
    doors: { n: 'clan', e: 'pit', w: 'vault', s: 'hangar' },
    spawn: [0, 32, Math.PI],
    stations: [
      { id: 'anvil', x: -8, z: 20, name: 'ARMORER\'S ANVIL', act: 'forge', r: 4.2 },
      { id: 'map', x: 14, z: 22, name: 'COVERT MAP', act: 'travel', r: 3.6 },
    ],
  },
  clan: {
    name: 'THE CLAN HALL', short: 'CLAN HALL',
    blurb: 'Where the clan gathers. The war table sends you, and your party, anywhere.',
    level: { name: 'THE HIDDEN COVERT — THE CLAN HALL', sub: 'The war table launches any mode.', arena: 64, layout: 'mfClan', waves: [], hazards: {} },
    doors: { s: 'forge' },
    spawn: [0, 22, Math.PI],
    stations: [
      { id: 'table', x: 0, z: 0, name: 'WAR TABLE', act: 'council', r: 9 },
      { id: 'console', x: 10, z: 25, name: 'COVERT MAP', act: 'travel' },
    ],
  },
  pit: {
    name: 'THE SPARRING PIT', short: 'SPARRING PIT',
    blurb: 'Targets, a pit and a gauntlet. Learn the moves, fight anything, or see how long you can hold.',
    level: { name: 'THE HIDDEN COVERT — THE SPARRING PIT', sub: 'Training, sparring and the gauntlet.', arena: 76, layout: 'mfPit', waves: [], hazards: {} },
    doors: { w: 'forge' },
    spawn: [-30, 0, Math.PI / 2],
    stations: [
      { id: 'range', x: -4, z: -22, name: 'TARGET RANGE', act: 'training' },
      { id: 'ring', x: 12, z: 0, name: 'SPARRING PIT', act: 'sparring', r: 4 },
      { id: 'gauntlet', x: -4, z: 22, name: 'THE GAUNTLET', act: 'proving' },
      { id: 'console', x: -31, z: 10, name: 'COVERT MAP', act: 'travel' },
    ],
  },
  vault: {
    name: 'THE TROPHY VAULT', short: 'TROPHY VAULT',
    blurb: 'Every helmet the clan ever took, and every record it keeps: the bounty archive, your signet, the mission records.',
    level: { name: 'THE HIDDEN COVERT — THE TROPHY VAULT', sub: 'The bounty archive, your signet and the mission records.', arena: 68, layout: 'mfVault', waves: [], hazards: {} },
    doors: { e: 'forge' },
    spawn: [26, 0, -Math.PI / 2],
    stations: [
      { id: 'archive', x: 0, z: 0, name: 'BOUNTY ARCHIVE', act: 'codex', r: 4.2 },
      { id: 'signet', x: -22, z: -6, name: 'YOUR SIGNET', act: 'profile' },
      { id: 'records', x: -22, z: 6, name: 'MISSION RECORDS', act: 'records' },
      { id: 'console', x: 27, z: 10, name: 'COVERT MAP', act: 'travel' },
    ],
  },
  hangar: {
    name: 'THE HANGAR', short: 'HANGAR',
    blurb: 'The clan\'s ship on its pad under the open sky. Take a job, or pick the hunt back up.',
    level: { name: 'THE HIDDEN COVERT — THE HANGAR', sub: 'Your ship, and the bounty board.', arena: 72, layout: 'mfHangar', waves: [], hazards: {} },
    doors: { n: 'forge' },
    spawn: [0, -27, 0],
    stations: [
      { id: 'ship', x: 0, z: -11, name: 'THE SHIP', act: 'ship', r: 4 },
      { id: 'board', x: -20, z: -12, name: 'BOUNTY BOARD', act: 'bounties' },
      { id: 'console', x: 10, z: -28, name: 'COVERT MAP', act: 'travel' },
    ],
  },
};
export const COVERT_ORDER = ['forge', 'clan', 'pit', 'vault', 'hangar'];
