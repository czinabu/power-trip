// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SIDE MISSIONS, handed out at the temple on Tython (the CALLS FOR AID stone in the Grand Hall, data/hub.js) and listed on
// the Missions page. Each is built from a story mission's own objectives on that mission's own map, the way an arcade
// contract is (data/arcade.js), but written by hand: who asked, what it is for, the foe's name. Edit the words freely.
//
// A side mission's id is 'side:<slug>', and data/arcade.js missionById builds it from that id alone, so a co-op guest (and
// a reload) runs exactly the mission the host picked. game/mission.js plays it like any other mission; game/profile.js
// pays rank XP for it (more the first time), and the workbench's Seeker emitter waits for a few of them.
//
// One entry:
//   slug, title, place (shown under the title), blurb, threat (1-5 pips)
//   rank      the hero's rank index it waits for (game/profile.js: 0 from the first day, 1 Knight / Verd / Sergeant,
//             2 Master / Alor / Lieutenant): the Council trusts you with more as you rise
//   from      the story mission whose map and objectives it uses (data/missions.js)
//   take      the objectives it plays, in order: { i: the source objective's index, ...anything laid over it }. A field
//             set here replaces the source's (title / say / task, a duel's name and foe, a console's name...). `say` and
//             `task` may be one string for every hero or { jedi, mando, trooper }
//   ask       the voice's line as the mission is handed out (the temple panel shows it)
//   done      the line when it is won · reward: a short line on what it pays (the panel shows it)
//             startFrom: n takes the source objective n's `start` (where a retry of it begins)
//   legs      (a chase) how many of the source's pursuit legs its route keeps
//   escort / quarry (optional) replace the source mission's own (who you walk, who you chase)
//   post      a VETERAN side mission (the post-game): it waits for the hero's campaign to be beaten, as NEW GAME+ does
//   muts      the mutators it always runs with (data/ngplus.js NG_MUTATORS), shown on its card
//   sig       [n, twist] a signature twist from the deck (data/twist-deck.js) laid on its n-th objective, shown on its card
//   choice    (light and dark, data/alignment.js) asked on a card once it is won, the first time only: { title, lines,
//             options: [{ key, side: 'light' | 'dark', label, line }] }. It moves the hero's meter, and nothing else

import { MISSIONS } from './missions.js';
import { DECK } from './twist-deck.js';

export const SIDE_PREFIX = 'side:';
export const SIDE_VOICE = 'THE TEMPLE KEEPER';
export const isSideId = (id) => typeof id === 'string' && id.startsWith(SIDE_PREFIX);
const all = (v) => ({ jedi: v, mando: v, trooper: v });

export const SIDE_QUESTS = [
  { slug: 'forest-shrine', title: 'THE FOREST SHRINE', place: 'THE OLD HOLDFAST', threat: 2, rank: 0, from: 'holdfast',
    blurb: 'hold the shrine gate, then light its two braziers',
    ask: 'An old shrine in the forest, older than the holdfast built round it. Hunters are camped at its gate, and its braziers have gone out. Hold the gate and light them again.',
    take: [
      { i: 0, title: 'HOLD THE SHRINE GATE', doneLine: 'THE GATE HOLDS', doneSub: 'Now the braziers.',
        say: all('The hunters are coming up the lane. Keep them out of the shrine\'s courtyard until they give up.'),
        task: all('Hold the shrine gate') },
      { i: 1, title: 'LIGHT THE BRAZIERS', postName: 'BRAZIER', doneLine: 'THE BRAZIERS BURN', doneSub: 'The shrine is lit again.',
        say: all('Two braziers out in the clearing. Stand in each with nobody of theirs inside, and it catches.'),
        task: all('Take and light both braziers') },
    ],
    done: all('The braziers are lit, and the hunters are gone from the forest. The shrine will keep.'),
    choice: { title: 'THE HUNTERS\' CHIEF', lines: ['Their chief is on his knees in the courtyard, empty-handed, begging for his crew.', 'They will not come back to this forest. Unless you want to be sure of it.'],
      options: [ { key: 'go', side: 'light', label: 'LET THEM GO', line: 'They leave the forest with what they carry, and the shrine keeps its peace.' },
                 { key: 'example', side: 'dark', label: 'MAKE AN EXAMPLE', line: 'Nobody hunts near this shrine again. Everyone will know why.' } ] },
    reward: 'Rank XP · counts toward the Seeker emitter' },

  { slug: 'ledger-child', title: 'A NAME IN THE LEDGER', place: 'THE PENS ON TESSARIL', threat: 3, rank: 0, from: 'pens',
    blurb: 'open one cell block and walk a child from the Ledger out',
    ask: 'One name in the Ledger was never brought out: Tavi, eight years old, in the last cell block on Tessaril. The Inquisitors moved the child there after the breakout. Bring Tavi home.',
    take: [
      { i: 1, title: 'OPEN TAVI\'S CELL BLOCK', consoleName: 'CELL BLOCK', doneLine: 'THE CELL IS OPEN', doneSub: 'Tavi is coming out.',
        consoles: [ { at: [0, -33.2], guards: { phalanx: 1, grunt: 2, officer: 1 } } ],
        say: all('The cell block at the back of the yard. Stand at its panel until the door opens.'),
        task: all('Stand at the cell block\'s panel to open it') },
      { i: 2, title: 'WALK TAVI OUT', doneLine: 'TAVI IS OUT', doneSub: 'Through the gate and running for the ship.', time: 32,
        evacuees: { kind: 'youngling', count: 1, spacing: 1.5, speed: 2.4, ramp: false, verb: 'OUT', name: all('TAVI'),
                    path: [[0, -32], [0, -20], [0, -6], [-6, 2], [-12, 9]] },
        say: all('Tavi is out of the cell. Stay with the child, and keep everything off them until they are through the gate.'),
        task: all('Guard Tavi out through the gate') },
    ],
    done: all('Tavi is aboard. One more name in the Ledger, crossed off and safe.'),
    choice: { title: 'TAVI\'S JAILER', lines: ['The officer who kept Tavi locked up is cuffed at the gate. Tavi is watching you from the ramp.', 'The Inquisitors\' ship lands in an hour. They do not forgive failure.'],
      options: [ { key: 'take', side: 'light', label: 'TAKE HIM WITH YOU', line: 'He answers for it in a cell on Tython, alive. Tavi sees how it is done.' },
                 { key: 'leave', side: 'dark', label: 'LEAVE HIM IN TAVI\'S CELL', line: 'Locked in, for the Inquisitors to find. Let him learn what Tavi learned.' } ] },
    reward: 'Rank XP · counts toward the Seeker emitter' },

  { slug: 'temple-droid', title: 'THE KEEPER\'S DROID', place: 'THE EAST FLANK OF LOTHAL', threat: 3, rank: 1, from: 'grassland',
    blurb: 'walk the temple\'s droid across a sown field',
    ask: 'One of the temple\'s droids went looking for an old Jedi cache on Lothal and found the war instead. It has the cache\'s map in its head. Walk it out to the landing field.',
    escort: all({ model: 'b1', name: 'K-1', kicker: 'TEMPLE DROID', color: 0xc8b88a, eye: 0x7bffae, scale: 0.9, hp: 320 }),
    take: [
      { i: 0, title: 'ESCORT K-1',
        say: all('K-1 will not walk into blaster fire on its own. Stay close, keep the troops off it, and watch where it steps.'),
        task: all('Stay near the droid and keep foes off it') },
      { i: 1, title: 'ESCORT K-1',
        say: all('Up the flank to the landing field. Shields ahead of it: break them, or go round.'),
        task: all('Get the droid to the landing field') },
    ],
    done: all('K-1 is aboard with its map. The cache will keep until we are ready for it.'),
    choice: { title: 'THE CACHE', lines: ['K-1\'s map shows the cache at last: Jedi relics, and among them a Sith holocron, still humming.', 'The archivists would lock it away. Or you could listen to what it knows.'],
      options: [ { key: 'seal', side: 'light', label: 'SEAL THE HOLOCRON', line: 'It goes to the archive vault, unopened. Some things are better left unheard.' },
                 { key: 'listen', side: 'dark', label: 'KEEP IT FOR YOURSELF', line: 'Know your enemy. It whispers to you on the flight home.' } ] },
    reward: 'Rank XP · counts toward the Seeker emitter' },

  { slug: 'relic-thief', title: 'THE RELIC THIEF', place: 'THE SPACEPORT AT KHEL DAR', threat: 4, rank: 1, from: 'pursuit',
    blurb: 'run down the droid that robbed the temple',
    ask: 'A droid broke into the archives last night and took a crystal off the forge\'s shelf. It is in Khel Dar, running for a ship. Do not let it reach one.',
    legs: 1,   // (the chase is the first leg only: the Magpie turns to fight where it ends)
    quarry: all({ foe: 'duelist', name: 'THE MAGPIE', kicker: 'RELIC THIEF', tint: 0x6a5a3a, scale: 1.04 }),
    take: [
      { i: 0, title: 'CHASE THE MAGPIE',
        say: all('There it goes, up the market street. Keep it in sight: over the stalls, not round them.'),
        task: all('Keep the thief in sight') },
      { i: 2, title: 'BRING DOWN THE MAGPIE', hp: 4, quarry: true, hero: undefined, startFrom: 1,
        say: all('It has run out of street. It fights with a staff and it fights dirty. Break its guard.'),
        task: all('Win the duel') },
    ],
    done: all('The crystal is back on the forge\'s shelf, and the Magpie is down.'),
    choice: { title: 'THE MAGPIE', lines: ['The Magpie is sparking on the street, one arm gone. It is only a droid, built to steal for whoever owned it last.', 'Its memory could be wiped. Or it could be finished, here.'],
      options: [ { key: 'wipe', side: 'light', label: 'WIPE IT AND BRING IT HOME', line: 'Clean memory, a new owner. The temple could use a droid with quick hands.' },
                 { key: 'scrap', side: 'dark', label: 'SCRAP IT', line: 'It stole from the temple. Nobody will steal with it again.' } ] },
    reward: 'Rank XP · counts toward the Seeker emitter' },

  { slug: 'drowned-holocron', title: 'THE DROWNED HOLOCRON', place: 'TIPOCA CITY ON KAMINO', threat: 4, rank: 2, from: 'drowned',
    blurb: 'pull a Jedi holocron out of a flooded archive, then hold the pad',
    ask: 'A Jedi holocron was left in Tipoca City\'s archive at the start of the war, and the sea is in the archive now. Its pieces are in three stacks. Get them out before the water does.',
    take: [
      { i: 1, title: 'RECOVER THE HOLOCRON', consoleName: 'STACK', consoleDone: 'RECOVERED', doneLine: 'THE HOLOCRON IS OURS', doneSub: 'Every piece of it.',
        say: all('Three stacks, a piece of the holocron in each. Work them in the dry spells: the sea comes in waves down here.'),
        task: all('Stand at each stack to recover its piece') },
      { i: 2, title: 'HOLD THE PAD',
        say: all('Back to the pad, and hold it until the ship is down. They followed the water in.'),
        task: all('Hold the landing pad until the ship is down') },
    ],
    done: all('The holocron is dry, and on its way to the archives on Tython.'),
    choice: { title: 'THE GATEKEEPER', lines: ['The holocron\'s gatekeeper flickers in your hands: it will teach you nothing until the archive is ready for it.', 'You could push. Hard enough, and it will give up its last lesson now.'],
      options: [ { key: 'wait', side: 'light', label: 'WAIT FOR THE ARCHIVE', line: 'It goes to Tython sealed. Its lessons will keep for whoever is ready.' },
                 { key: 'force', side: 'dark', label: 'FORCE IT OPEN', line: 'It breaks, and what it knew pours into you. The archive gets an empty shell.' } ] },
    reward: 'Rank XP · counts toward the Seeker emitter' },

  { slug: 'grave-knight', title: 'THE GRAVE KNIGHT', place: 'THE BURNED TEMPLE ON JEDHA', threat: 5, rank: 2, from: 'jedha-night',
    blurb: 'break the seals, then face a fallen Jedi\'s blade',
    ask: 'Something walks the burned temple on Jedha at night: a Jedi who fell there, they say, still guarding the seals with a blade. Break the seals and see what comes for you.',
    take: [
      { i: 0, title: 'BREAK THE SEALS',
        say: all('Three seals round the dais, and a garrison camped on them. Stand at each until it breaks.'),
        task: all('Stand at each seal to break it') },
      { i: 2, title: 'FACE THE GRAVE KNIGHT', name: 'THE GRAVE KNIGHT', form: 'makashi', kicker: 'A FALLEN JEDI', tint: 0x3a6a5a, hp: 4.5,
        enter: all('A figure in a burned robe walks down the steps, its blade already lit.'),
        line: all('You came to the seals. So did I, once.'),
        say: all('It fought here when the temple fell, and it never stopped. It is precise and it waits for you to overreach. Do not.'),
        task: all('Win the duel') },
    ],
    done: all('The Grave Knight is still at last. The seals are broken, and Jedha is quiet.'),
    choice: { title: 'THE GRAVE KNIGHT\'S BLADE', lines: ['The Grave Knight\'s saber lies at your feet, still lit. Its crystal is bleeding red.', 'It could be buried with its knight. Or carried, with everything it remembers.'],
      options: [ { key: 'rest', side: 'light', label: 'LAY IT TO REST', line: 'It goes into the ground with its knight, and the temple is quiet at last.' },
                 { key: 'take', side: 'dark', label: 'TAKE THE BLADE', line: 'Its anger hums in your hand. It knows the way you fight now.' } ] },
    reward: 'Rank XP · counts toward the Seeker emitter' },
];
// ---- THE VETERAN CALLS: the post-game's own side missions, once the hero's campaign is beaten. Each carries mutators ----
SIDE_QUESTS.push(
  { slug: 'long-trench', title: 'THE LONG TRENCH', place: 'THE ICE FRONT ON HOTH', threat: 5, rank: 0, post: true, from: 'icefront', muts: ['ironhide', 'marksmen'], sig: [0, 'standard'],
    blurb: 'hold the old trench line against a veteran regiment',
    ask: 'The regiment that broke the Hoth line is back on the ice, and they have learned. A listening post is still in the old trenches. Hold the line while it gets out.',
    take: [
      { i: 0, title: 'HOLD THE FORWARD TRENCH', doneLine: 'THE FIRST RUSH BREAKS', doneSub: 'They are regrouping for another.',
        say: all('Veterans, all of them: hard to put down, and their bolts come fast. Hold the forward trench and keep your head below the lip.'),
        task: all('Hold the forward trench') },
      { i: 2, title: 'HOLD THE REAR TRENCH', doneLine: 'THE POST IS OUT', doneSub: 'The regiment pulls back into the snow.',
        say: all('The post is pulling out. Fall back to the rear trench and give them the time.'),
        task: all('Hold the rear trench until the post is away') },
    ],
    done: all('The listening post is clear of the ice. Whatever that regiment came back for, it did not get.'),
    reward: 'Veteran rank XP · for heroes who have beaten their campaign' },

  { slug: 'forge-rekindled', title: 'THE FORGE REKINDLED', place: 'THE MUSTAFAR FORGE', threat: 5, rank: 0, post: true, from: 'forge', muts: ['frenzy', 'vanguard'], sig: [0, 'stamp'],
    blurb: 'blow the rebuilt forge before its new masters arm themselves',
    ask: 'Someone has lit the Mustafar forge again, and its new guard are the best the Empire has left. Charge the feeds, then hold the lane until it goes up.',
    take: [
      { i: 0, title: 'CHARGE THE FORGE', consoleName: 'FEED', doneLine: 'THE CHARGES ARE SET', doneSub: 'Get clear before the clock runs out.',
        say: all('Elites on every feed, and they hit hard. Set a charge on each, and do not stand in the open while you do it.'),
        task: all('Stand at each feed to set a charge') },
      { i: 1, title: 'HOLD THE WAY OUT', doneLine: 'THE FORGE GOES UP', doneSub: 'This time it stays down.',
        say: all('The charges are on the clock. Hold the lane, fall back ahead of the heat, and let nothing near them.'),
        task: all('Hold each stand, and fall back ahead of the heat') },
    ],
    done: all('The forge is slag again. Whoever lit it will have to find somewhere else to arm.'),
    reward: 'Veteran rank XP · for heroes who have beaten their campaign' },

  { slug: 'wreckers-toll', title: 'THE WRECKERS\' TOLL', place: 'THE STARSHIP GRAVEYARD OF JAKKU', threat: 5, rank: 0, post: true, from: 'graveyard', muts: ['volatile', 'berserk'], sig: [0, 'barrage'],
    blurb: 'beat a wrecking crew to the cores, then walk the crawler out through the storm',
    ask: 'A wrecking crew is stripping the graveyard, and they wire their own people to blow when they fall. There are cores out there worth saving. Get to them first.',
    take: [
      { i: 0, title: 'SALVAGE THE CORES', doneLine: 'EVERY CORE RECOVERED', doneSub: 'The crew is coming for them.',
        say: all('They come fast, and they burst when they drop. Pull the cores out of the wrecks, and do not finish anyone at arm\'s length.'),
        task: all('Stand at each wreck to pull its core') },
      { i: 1, title: 'GET THE CRAWLER OUT',
        say: all('The cores are on the crawler. Walk it back across the yard, and keep the crew off it. They burst when they drop, so not next to it.'),
        task: all('Stay with the crawler and keep foes off it') },
      { i: 2, title: 'GET THE CRAWLER OUT', doneLine: 'THE CRAWLER IS HOME', doneSub: 'Off the sand, cores and all.',
        say: all('The storm is in. They will be on the crawler before you see them. Stay right by it.'),
        task: all('Get the crawler to the freighter through the storm') },
    ],
    done: all('The cores are aboard, and the wreckers are scattered over the dunes.'),
    reward: 'Veteran rank XP · for heroes who have beaten their campaign' },
);
export const SIDE_BY_ID = Object.fromEntries(SIDE_QUESTS.map(q => [SIDE_PREFIX + q.slug, q]));

const clone = (v) => JSON.parse(JSON.stringify(v));   // missions are plain data
const cache = new Map();
// the side mission behind an id, as a mission definition game/mission.js can run (null if there is none)
export function sideQuest(id){
  if (cache.has(id)) return cache.get(id);
  const q = SIDE_BY_ID[id], src = q && MISSIONS[q.from];
  if (!src) return null;
  const objectives = q.take.map((t, n) => {
    const o = { ...clone(src.objectives[t.i]), ...clone(Object.fromEntries(Object.entries(t).filter(([k, v]) => k !== 'i' && k !== 'startFrom' && v !== undefined))) };
    if (t.startFrom != null) o.start = clone(src.objectives[t.startFrom].start);
    for (const [k, v] of Object.entries(t)) if (v === undefined) delete o[k];   // (a field set to undefined is taken off)
    if (n === 0) delete o.start;   // (the first one plays from the mission's start)
    if (q.sig && q.sig[0] === n && DECK[q.sig[1]]){ const D = DECK[q.sig[1]]; o.twist = { kind: q.sig[1], ...D.make(o, src), line: D.line }; }
    return o;
  });
  const first = q.take[0].i, st = src.objectives[first].start;
  const def = {
    ...src,
    id, side: true, slug: q.slug, source: src.id, threat: q.threat, rank: q.threat,
    trial: false, campaignOnly: false, heroes: undefined, story: undefined, opening: undefined,
    title: q.title, place: q.place, blurb: q.blurb,
    level: { ...src.level, name: 'SIDE MISSION — ' + q.place, sub: q.blurb.charAt(0).toUpperCase() + q.blurb.slice(1) + '.' },
    start: st || src.start,
    // who you walk and who you chase, only when one of its objectives needs them (the pens' droid stays home)
    escort: objectives.some(o => o.kind === 'escort') ? q.escort || src.escort : undefined,
    quarry: objectives.some(o => o.kind === 'pursuit' || o.quarry) ? q.quarry || src.quarry : undefined,
    route: q.legs && src.route ? src.route.slice(0, q.legs) : src.route,
    voice: SIDE_VOICE,
    muts: q.muts ? [...q.muts] : [], veteran: !!q.post, sig: q.sig && DECK[q.sig[1]] ? [DECK[q.sig[1]].name] : [],   // (data/ngplus.js: game/mission.js puts them on as it starts)
    objectives,
    done: q.done,
  };
  cache.set(id, def);
  return def;
}
