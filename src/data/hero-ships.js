// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HERO SHIPS: each hero has a small ship of their own, walked like any wing of their hub (data/hub.js adds it as the
// wing 'ship' of every hub). The Jedi flies a temple shuttle, the Mandalorian the Cinderwake (the gunship from their
// story), the ARC trooper a dropship. You board it at the hub's landing pad or hangar (the station there that already
// flies to Jedha: ui/hub-ui.js), and on board the GALAXY MAP (ui/galaxy-ui.js) shows every world, its story missions,
// its side missions, the open zone and the raid, and plots a course to one; the HELM jumps there and launches it. A run launched from the ship comes back to it.
//
// CO-OP: the ship is the party's lobby. A party loads the HOST's hub (game/hub.js hubIdFor), so friends board the host's
// ship; a guest who arrives while the host is aboard lands aboard too, and the host can call everyone aboard from the map.
//
// world/arenas/hero-ship.js builds the three interiors (the sh* layouts); data/worlds.js SHIP_WORLDS lights them. Each one
// is a single small wing, loaded on its own behind the loading screen like every other wing, so a phone only ever holds
// the cabin it stands in. Edit the words freely.
//
// A SHIP: { name (what it's called), kind (what it is), board (the line on the hangar's station), exit (the hub wing its
//   ramp lets you out into), outAt [x, z, yaw] (where you stand in that wing on walking down the ramp), wing (the wing) }
// The wing is a hub wing like any other (data/hub.js), its stations reuse the hub's acts, plus 'galaxy' (the galaxy map: plot a
// course) and 'helm' (the helm or cockpit: fly it, and launch what's there). game/ship-nav.js says who does what.

const PI = Math.PI;

// every ship's cabin shares one plan, so its stations stand in the same spots on every ship: the helm forward (north, −z),
// the galaxy table in the middle of the hold, the locker to port, the comms to starboard, the ramp aft (south)
const ARENA = 26;   // (a hold, not a hangar: wide enough for a party of four and the follow-cam, and no wider)
const plan = (o) => ({
  name: o.wingName, short: o.short,
  blurb: o.blurb,
  level: { name: o.levelName, sub: 'Plot a course at the galaxy map, then fly it from the helm. Walk down the ramp to leave.', arena: ARENA, layout: o.layout, waves: [], hazards: {} },
  map: ['hull'],   // what the hub map draws the room with (ui/hub-map.js ART)
  doors: { s: o.exit },   // the ramp: walk down it into the hub
  spawn: [0, 8, PI],
  stations: [
    { id: 'galaxy', x: 0, z: -0.5, name: 'GALAXY MAP', act: 'galaxy', r: 4.6 },
    { id: 'helm', x: 0, z: -9.4, name: o.helm, act: 'helm', r: 3 },
    { id: 'locker', x: -9.6, z: 3, name: o.locker, act: 'forge', r: 3 },
    { id: 'comms', x: 9.6, z: 3, name: 'CALLS FOR AID', act: 'quests', r: 3 },
    { id: 'console', x: 8.6, z: 9.4, name: o.console, act: 'travel', r: 2.8 },
  ],
});

export const HERO_SHIPS = {
  // the Jedi's: a pale temple shuttle, its hold lined with meditation benches and a rack of training remotes
  temple: {
    name: 'THE DAWNREACH', kind: 'TEMPLE SHUTTLE', board: 'BOARD THE DAWNREACH',
    boardLine: 'Your shuttle. On board, plot a course at the galaxy map and fly it from the helm',
    exit: 'landing', outAt: [0, 9, PI],
    wing: plan({ wingName: 'THE DAWNREACH', short: 'SHUTTLE', layout: 'shJedi', exit: 'landing',
      blurb: 'Your shuttle: a quiet hold with a galaxy map at its heart. Every world the Order still reaches is a jump away.',
      levelName: 'THE DAWNREACH — A TEMPLE SHUTTLE', helm: 'THE HELM', locker: 'SABER BENCH', console: 'DISEMBARK' }),
  },
  // the trooper's: a white dropship, red unit stripes, jump seats and harnesses down both walls, a weapons rack
  kamino: {
    name: 'THE KESTREL', kind: 'DROPSHIP', board: 'BOARD THE KESTREL',
    boardLine: 'Your dropship. On board, plot the op at the galaxy map and ship out from the cockpit',
    exit: 'deck', outAt: [-21, -16, PI],
    wing: plan({ wingName: 'THE KESTREL', short: 'DROPSHIP', layout: 'shTrooper', exit: 'deck',
      blurb: 'Your dropship: jump seats down both walls and the galaxy map on the deck between them. Every op ships out from here.',
      levelName: 'THE KESTREL — A DROPSHIP', helm: 'THE COCKPIT', locker: 'GEAR LOCKER', console: 'DISEMBARK' }),
  },
  // the Mando's: the Cinderwake, a blunt gunship, its hold full of crates, a weapons wall and the clan's band in gold
  covert: {
    name: 'THE CINDERWAKE', kind: 'GUNSHIP', board: 'BOARD THE CINDERWAKE',
    boardLine: 'Your gunship. On board, plot the job at the galaxy map and fly it from the cockpit',
    exit: 'hangar', outAt: [-5, -3, PI],
    wing: plan({ wingName: 'THE CINDERWAKE', short: 'CINDERWAKE', layout: 'shMando', exit: 'hangar',
      blurb: 'Your gunship: crates lashed down, the weapons wall, and the galaxy map that points at the next job.',
      levelName: 'THE CINDERWAKE — A GUNSHIP', helm: 'THE COCKPIT', locker: 'WEAPONS WALL', console: 'DISEMBARK' }),
  },
};
export const SHIP_WING = 'ship';   // the wing id every hub gives its ship
export const SHIP_LAYOUTS = Object.values(HERO_SHIPS).map(s => s.wing.level.layout);
export const shipOf = (hubId) => HERO_SHIPS[hubId] || HERO_SHIPS.temple;

/* THE GALAXY MAP's worlds (ui/galaxy-ui.js). Each is a node on the map at (x, y), in percent of the map's width and height,
   with the story missions played there (data/missions.js ids: a hero sees only their own, as on the Missions page), its
   side missions (data/side-quests.js slugs), and `zones` (its open zones: data/zones.js) or `raid` (data/raids.js) when it
   has them. `home` is the hub whose ship starts there (the ship's marker sits on it). A story mission no world lists still shows,
   on DEEP SPACE (the last entry). `col` is the world's colour on the map, `ring` a planet ring. */
export const GALAXY = [
  { id: 'tython', name: 'TYTHON', region: 'DEEP CORE', x: 50, y: 46, col: '#7fb7d8', home: 'temple', size: 1.1,
    line: 'The hidden temple, in the light of the galaxy\'s heart.', missions: [], sides: [] },
  { id: 'jedha', name: 'JEDHA', region: 'MID RIM', x: 61, y: 34, col: '#d8b07a', size: 1.0, zones: ['jedha', 'ruins'], raid: 'kharel',
    line: 'The holy moon. Its old city, its temple, and the Sith gate under it, and the dead city past the gate.',
    missions: ['last-lesson', 'vault', 'jedha-night', 'gate-wake', 'gate-heart'], sides: ['grave-knight'] },
  { id: 'refuge', name: 'THE HIDDEN REFUGE', region: 'INNER RIM', x: 40, y: 34, col: '#9ab88a', size: 0.7,
    line: 'A forest moon where the Order hid what it could.', missions: ['refuge', 'trial-wall'], sides: [] },
  { id: 'lothal', name: 'LOTHAL', region: 'OUTER RIM', x: 26, y: 54, col: '#b8c86a', size: 0.95,
    line: 'Grass seas, an Imperial outpost and its prison.', missions: ['breakout', 'grassland', 'trial-acrobat'], sides: ['temple-droid'] },
  { id: 'tessaril', name: 'TESSARIL', region: 'OUTER RIM', x: 17, y: 34, col: '#7a8aa0', size: 0.8,
    line: 'Rain, and the Inquisitors\' pens.', missions: ['pens', 'trial-sera'], sides: ['ledger-child'] },
  { id: 'hoth', name: 'HOTH', region: 'OUTER RIM', x: 20, y: 78, col: '#dfe9f2', size: 0.9,
    line: 'The ice front, and an enclave under it.', missions: ['icefront', 'trial-knight'], sides: ['long-trench'] },
  { id: 'jakku', name: 'JAKKU', region: 'INNER RIM', x: 38, y: 74, col: '#d8b880', size: 0.85,
    line: 'A desert of fallen starships.', missions: ['graveyard'], sides: ['wreckers-toll'] },
  { id: 'mustafar', name: 'MUSTAFAR', region: 'OUTER RIM', x: 54, y: 82, col: '#e0623a', size: 0.8,
    line: 'Fire, a forge, and the academy built over it.', missions: ['forge', 'academy'], sides: ['forge-rekindled'] },
  { id: 'kheldar', name: 'KHEL DAR', region: 'MID RIM', x: 70, y: 58, col: '#c8a0d8', size: 0.75,
    line: 'A spaceport where nobody asks questions.', missions: ['pursuit'], sides: ['relic-thief'] },
  { id: 'exegol', name: 'EXEGOL', region: 'UNKNOWN REGIONS', x: 88, y: 18, col: '#8a6ac8', size: 1.0, ring: true,
    line: 'Storms over a dead world, and a throne in a citadel.', missions: ['strike', 'chains', 'gate-vault'], sides: [] },
  { id: 'orvane', name: 'ORVANE', region: 'OUTER RIM', x: 80, y: 74, col: '#c88a5a', home: 'covert', size: 0.9,
    line: 'Salt flats, Salt Hollow, and the clan\'s covert under the ruins.', missions: ['salthollow', 'covert'], sides: [] },
  { id: 'vell', name: 'VELL', region: 'OUTER RIM', x: 90, y: 54, col: '#5a8ab0', size: 0.85,
    line: 'A storm sea, and the prison barge that sails it.', missions: ['gallows'], sides: [] },
  { id: 'thane', name: 'THANE', region: 'MID RIM', x: 74, y: 86, col: '#5a9a6a', size: 0.8,
    line: 'Cedar forests and an old holdfast.', missions: ['holdfast'], sides: ['forest-shrine'] },
  { id: 'kamino', name: 'KAMINO', region: 'WILD SPACE', x: 9, y: 58, col: '#5ab0c8', home: 'kamino', size: 1.0,
    line: 'Storm and ocean, Tipoca City and the clone citadel.', missions: ['drowned', 'oldkillhouse', 'gate-order'], sides: ['drowned-holocron'] },
  { id: 'vorran', name: 'VORRAN', region: 'MID RIM', x: 33, y: 16, col: '#a0a8b0', size: 0.8,
    line: 'The shipyards, and the garrison block behind them.', missions: ['killhouse', 'gate-yard'], sides: [] },
  { id: 'halcyon', name: 'THE HALCYON', region: 'ADRIFT', x: 47, y: 10, col: '#c0c8d0', size: 0.5, wreck: true,
    line: 'A dead frigate, tumbling. Its chip files are still aboard.', missions: ['chipfiles', 'drill'], sides: [] },
  { id: 'kesh', name: 'KESH', region: 'OUTER RIM', x: 66, y: 12, col: '#c86a4a', size: 0.9,
    line: 'Red canyons, the Marshal\'s garrison and his relay spire.', missions: ['chipworks', 'warcamp', 'hunt', 'lastassault', 'broadcast'], sides: [] },
  { id: 'deep', name: 'DEEP SPACE', region: 'UNCHARTED', x: 6, y: 12, col: '#6a7488', size: 0.55, deep: true,
    line: 'Every other place the story has taken you.', missions: [], sides: [] },
];
// hyperspace lanes drawn between worlds (just a picture: every world is one jump from wherever the ship is: game/ship-nav.js)
export const LANES = [
  ['tython', 'jedha'], ['tython', 'refuge'], ['tython', 'jakku'], ['tython', 'kheldar'], ['refuge', 'tessaril'], ['refuge', 'vorran'],
  ['lothal', 'tessaril'], ['lothal', 'hoth'], ['lothal', 'kamino'], ['jakku', 'hoth'], ['jakku', 'mustafar'], ['mustafar', 'thane'],
  ['thane', 'orvane'], ['orvane', 'vell'], ['kheldar', 'vell'], ['kheldar', 'jedha'], ['jedha', 'kesh'], ['kesh', 'exegol'],
  ['vorran', 'halcyon'], ['halcyon', 'kesh'], ['tessaril', 'deep'], ['kamino', 'tessaril'],
];
export const homeWorld = (hubId) => GALAXY.find(w => w.home === hubId) || GALAXY[0];
