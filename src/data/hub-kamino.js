// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CLONE CITADEL ON KAMINO: the ARC trooper's hub (data/hub.js HUBS.kamino). White pressure halls on stilts over a
// storm ocean, rain on every window, the clone army drilling on the decks. Five wings on the temple's own door plan, so
// every station sits where its counterpart does in the temple: world/arenas/clone-citadel.js builds them, data/worlds.js
// HUB_WORLDS (the km* layouts) colours them. Edit freely.

export const KAMINO_WINGS = {
  deck: {
    name: 'THE HANGAR DECK', short: 'HANGAR DECK',
    blurb: 'The citadel\'s great hangar, open to the storm. Gunships on their pads (one of them yours), squads drilling, every deck a door away.',
    level: { name: 'THE CLONE CITADEL — THE HANGAR DECK', sub: 'Kamino. Walk up to a station and tap F.', arena: 96, layout: 'kmDeck', waves: [], hazards: {} },
    map: ['pads'],   // what the hub map draws the room with (ui/hub-map.js ART)
    doors: { n: 'warroom', e: 'range', w: 'halls', s: 'armory' },
    spawn: [0, 30, Math.PI],
    stations: [
      { id: 'map', x: 0, z: 0, name: 'FACILITY MAP', act: 'travel', r: 11 },
      { id: 'gunship', x: -21, z: -24, name: 'THE KESTREL', act: 'shuttle', r: 4 },   // the north-west pad's gunship: your own ship (data/hero-ships.js)
    ],
  },
  warroom: {
    name: 'THE WAR ROOM', short: 'WAR ROOM',
    blurb: 'Where the campaigns are planned. The holotable sends you, and your squad, anywhere.',
    level: { name: 'THE CLONE CITADEL — THE WAR ROOM', sub: 'The holotable launches any mode.', arena: 64, layout: 'kmWar', waves: [], hazards: {} },
    doors: { s: 'deck' },
    spawn: [0, 20, Math.PI],
    stations: [
      { id: 'table', x: 0, z: 0, name: 'HOLOTABLE', act: 'council', r: 9 },
      { id: 'beacon', x: 9, z: 24, name: 'TRANSIT BEACON', act: 'travel' },
      { id: 'calls', x: -9, z: 24, name: 'CALLS FOR AID', act: 'quests' },   // the side missions (data/side-quests.js)
      { id: 'deeds', x: -20, z: 0, name: 'HONOUR WALL', act: 'deeds' },   // what the citadel has restored, won and who served with you (data/hub-growth.js)
    ],
  },
  range: {
    name: 'THE FIRING RANGE', short: 'FIRING RANGE',
    blurb: 'Lit lanes, pop-up targets and a sim floor of cover. Drill the basics, run any fight, or hold the killhouse.',
    level: { name: 'THE CLONE CITADEL — THE FIRING RANGE', sub: 'Training, the combat sim and the killhouse.', arena: 76, layout: 'kmRange', waves: [], hazards: {} },
    doors: { w: 'deck' },
    spawn: [-28, 0, Math.PI / 2],
    stations: [
      { id: 'grounds', x: -6, z: -18, name: 'SHOOTING LANES', act: 'training' },
      { id: 'sparring', x: 14, z: 0, name: 'COMBAT SIM', act: 'sparring' },
      { id: 'proving', x: -6, z: 18, name: 'KILLHOUSE', act: 'proving' },
      { id: 'beacon', x: -30, z: 9, name: 'TRANSIT BEACON', act: 'travel' },
    ],
  },
  halls: {
    name: 'THE CLONING HALLS', short: 'CLONING HALLS',
    blurb: 'Row on row of growth pods, an army waiting to be born. The genome records, your service file and the mission logs.',
    level: { name: 'THE CLONE CITADEL — THE CLONING HALLS', sub: 'The codex, your service record and the mission logs.', arena: 72, layout: 'kmHalls', waves: [], hazards: {} },
    map: ['tanks'],   // what the hub map draws the room with (ui/hub-map.js ART)
    doors: { e: 'deck' },
    spawn: [26, 0, -Math.PI / 2],
    stations: [
      { id: 'terminal', x: 0, z: 0, name: 'GENOME TERMINAL', act: 'codex', r: 4 },
      { id: 'holocron', x: -22, z: -4.5, name: 'SERVICE RECORD', act: 'profile' },
      { id: 'records', x: -22, z: 4.5, name: 'MISSION LOGS', act: 'records' },
      { id: 'beacon', x: 28, z: 9, name: 'TRANSIT BEACON', act: 'travel' },
    ],
  },
  armory: {
    name: 'THE ARMORY', short: 'ARMORY',
    blurb: 'Racks of rifles and armour on its stands. Kit yourself out before you ship.',
    level: { name: 'THE CLONE CITADEL — THE ARMORY', sub: 'Make your hero your own.', arena: 56, layout: 'kmArmory', waves: [], hazards: {} },
    map: ['racks'],   // what the hub map draws the room with (ui/hub-map.js ART)
    doors: { n: 'deck' },
    spawn: [0, -18, 0],
    stations: [
      { id: 'bench', x: 0, z: 6, name: 'ARMOUR STAND', act: 'forge', r: 4 },
      { id: 'beacon', x: 8, z: -20, name: 'TRANSIT BEACON', act: 'travel' },
    ],
  },
};
