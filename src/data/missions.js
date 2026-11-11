// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STORY MISSIONS, as data. game/mission.js runs them one objective after another; edit the words, timings and foes freely.
//
// A mission is a level (an arena to build, like data/levels.js) plus a list of objectives run in order. Dying puts you
// back at the start of the objective you fell on. `kit` is how far into a run your gear is (the stage the automatic
// unlocks in data/store.js check against), so a mission plays with a mid-run kit instead of the bare starting one.
// `start` is [x, z, yaw] where the hero stands when it begins (yaw 0 faces +z, which the HUD compass calls south; π faces north, −z). `grant` is the abilities each
// hero gets on top (G.unlocked keys; one from a fork pair, data/store.js). Foes are as tough as a run's first wave.
// `foeLook` dresses the foe types it sends in another uniform ({ type: { model, color, eye, cloth } }, enemies/look.js);
// `squadCap` is the most squadmates it has (the ARC trooper otherwise tops his squad up to his own size).
//
// Objective kinds and their fields
//   hold      stand by a spot until a timer runs out
//               at [x, z], r: the zone · time: seconds of progress needed · awayRate: progress speed while you're out of
//               the zone and no foe is in it (in it: full speed; a foe in it while you're out: it stalls)
//               pulses: reinforcement groups { type: count }, sent in turn · every: [with an officer alive, without]
//               seconds between pulses (officers call them in, so drop the officers) · cap: most foes on the field
//               from: [a0, a1] the arc of the edge they arrive from (radians, 0 = east, -π/2 = south) · aggro: a foe
//               marches on the zone and only fights you when you're this close to it
//               lanes (optional): [[a0, a1]…] arcs for its approach lanes instead of `from` (game/lanes.js): each wave is
//               called down one of two or three lanes picked in them, lit red a few seconds before it steps out. A lane
//               is never within 13 m of the evacuees' path (if the arcs have none that far, the whole ring is searched)
//               squadRate (optional): progress speed with only squadmates (allies/squad.js) in the zone
//               evacuees: { count, path: [[x, z]…] (from their shelter to the ship's hatch), spacing, speed, name } the
//               people being saved, filing aboard as the timer runs (they stop and huddle while it stalls). They walk
//               the whole path, start to end, and the zone rides on the line (game/mission.js followLine), so you
//               guard the people, not a spot; at is then only the middle the lanes are picked round, and the foes
//               march on the line. escort: false keeps the zone at `at` with the line queued at the end
//   sabotage  reach each console and stay on it to slice it
//               consoles: [{ at: [x, z], guards: { type: count } }] · time: seconds of slicing each · r: how close
//               hitLoss: seconds of slicing lost when you're hit · trickle: { every, cap, group } light reinforcements
//   capture   take a line of posts in turn: stand in one (or send the squad onto it with H) with no foe inside
//               posts: [{ at: [x, z], guards: { type: count } }] · r · time: seconds to take each · squadRate: speed with
//               only squadmates in it · perMate: extra speed per squadmate in it · trickle: { every, cap, group } troops
//               marching on the post being taken · from: the arc they come from · aggro (see hold)
//   duel      one opponent, one on one
//               foe: the enemy type it's built from · name · hp, dmg: multipliers on that type · scale · tint
//               duel: overrides of its duelling profile (data/duel.js) · rage: at this fraction of hp it presses harder
//               (rageDuel: the profile then) · at: [x, z] where it lands · quarry: true fights the mission's quarry
//               where it stopped running instead (its name and look come from the mission's `quarry`)
//               escape (optional): at this fraction of hp it breaks off and is gone instead of falling, with
//               escapeLine ({ jedi, mando }) under its banner
//               trickle (optional): { every, cap, group } troops for the squad to hold off during the duel · from
//   escort    walk the mission's `escort` (a droid, a courier) along a path to where it's needed (its `ward`: a colour,
//               a glowing stone it carries on its back)
//               path: [[x, z]…] its route · speed: m/s while it walks · leash: it waits for you when you're further
//               off than this · threat: a foe this close pins it down (it stops and takes fire) · dps: hp a second
//               each such foe takes off it · regen: hp a second back while nothing is on it · ambush: [{ at: [x, z]
//               (fires as it walks past here), group: { type: count }, from: the arc they come from }] foes sent at
//               it, who march on it and only turn on you when you're within `aggro` · trickle (optional) · it falls
//               and the objective restarts; its hp carries from one escort leg to the next
//   pursuit   chase the quarry along one leg of its route (the arena's spots) without losing it
//               leg: which leg · sight: how far you can see it (m; walls block the view) · lost: seconds out of
//               sight before it gets away (the objective restarts) · pace: [[gap m, speed m/s]…] how fast it runs for
//               how far ahead of you it is (it eases off when you fall behind and sprints when you close in)
//               shove: how close you can get before it throws you back and breaks away · the route itself is the
//               mission's `route` (one polyline per leg) and who runs it is its `quarry`
//               ambush: [{ at: [x, z] (fires as the quarry runs past here), spots: [[x, z]…], group: { type: count } }]
//               foes stepping out of doorways (optional: the spaceport keeps its runs clear and fights only at standoffs)
//               shortcuts: [{ zone: [x0, x1, z0, z1], at: [x, z] }] parkour lanes that cut a corner: a beacon marks the
//               way in, and inside one the escape clock holds · start: [x, z, yaw] where a retry of this leg begins
//               standoff: [{ at: [x, z], spots, group, line }] it stops here to cut through a sealed way and its guard
//               (group, at spots) holds you off; it runs on once they're down (or bolts if you get ahead of it) · clash: { dmg, time, every } catch it on
//               open ground and it turns to fight until you've taken dmg (a fraction of its hp) off it or `time` runs
//               out, then breaks away; again no sooner than `every` seconds. The wounds carry into the quarry duel.
//               The leg starts as soon as you reach the quarry; standing in its way on its line catches it from a few
//               metres further off (and sooner after the last clash); running far out ahead of it (30 m, out of sight)
//               loses it like falling behind; and it only finishes a leg once you can see it or are close.
//   breach    stack up on one of the arena's doors (world/doors.js, in order), set the charge and clear the room behind it
//               door: which door · stack: [x, z] where you stand to set it · time: seconds of setting it (each squadmate
//               stacked with you speeds it up) · fuse: seconds before it blows · guards: { type: count } the room's,
//               at spots: [[x, z]…], caught reeling for `stun` seconds as the world slows for `slow` · opens: doors
//               open once the room is clear (a cell, the way back out) · joins / joinAt: squadmates freed in there
//               breachLine / breachSub: the blast's banner; lines.breach in a chapter (one entry per door) on the comms
//               alarm: { time, at: [[x, z]…], group, startLine, line } the room calls it in: clear it inside `time`
//               seconds or `group` comes in at `at` (once) · grab: { at: [x, z], time, r, status, line } something in
//               the room to stand at and pull while they fight for it (slower with foes on it); the room isn't done till it's got
//   infiltrate get in unseen (game/infiltrate.js, data/infiltrate.js has the sight and the alarm's numbers): reach and work
//               each of `marks` [{ at: [x, z] }] (any order; `time` seconds on each, `r` how close; markName / markDone
//               name them) while guards walk their beats (guards: [{ type, path: [[x, z]…], pause } | { type, at, face,
//               sweep, period }]), cameras sweep (cams: [{ at, y, yaw, sweep, period, ph }]) and searchlights rake the
//               floor (lights: the searchlight twist's beams). Being seen fills the alarm; full, every guard turns on
//               you, alarm.group comes in at alarm.at (then alarm.trickle) and the rest of the mission sends more. It
//               never fails the mission. quiet: [banner, sub] when it's done unseen. Each hero has their own way through
//               on F (the Jedi turns a guard with the Force, the Mando takes one down from behind, the trooper has smoke
//               and a squad that holds back)
//   walker    a set piece (game/walker.js, data/walker.js): a full-size walker strides along `path` toward the line,
//               shelling heroes and letting troops down. Tangle three of its legs at their tow points (anchors: [{ leg:
//               0..3 (front left, front right, hind left, hind right), style: 'seal' | 'sky' | 'line' }], styled locks
//               any hero can work: game/locks.js), then set the charge on its neck once it's down. It reaching the end
//               of its path fails the objective. drop: { group } troops from its belly · crew: { type: count } who bail
//               out when it goes down · trickle, from (see sabotage) · any of data/walker.js WALKER's numbers
// Any objective can set `doors`: how many of the arena's doors are open when it begins (a retry rebuilds them
// shut), and `squad`: the squad's size by then (someone freed on the way joined it).
// Any objective can set `twist`: its one signature hook, taught then tested ({ kind: 'blackout' | 'sandstorm' | 'heat' |
// 'barrage' | 'gap' | 'stragglers' | 'list' | 'stalker' | 'standard' | 'minefield' | 'searchlight' | 'cage' | 'pulse' |
// 'vael' | 'marked' | 'decompress' | 'tide' | 'stamp' | 'gunship' | 'rockslide' | 'guns' | 'signal', … }: game/twists.js
// and the files in game/twists/ have each kind's fields). It plays wherever the objective does: Missions page, story, arcade, co-op.
// Text a kind shows can be renamed per objective: sabotage `consoleName` ('UPLINK'), `doneLine` / `doneSub` (the
// banner when it's done; hold and capture take them too).
// On the big battle maps an objective after the first can have `start`: [x, z, yaw], where a retry of it begins.
// Every objective has `title` (the HUD line), and `say` / `task` per hero: the voice's line and the plain instruction.
// Any field can differ per hero: put the hero's version under `hero: { jedi: {…}, mando: {…} }`.
// `music` (optional) picks the score's cue for it (audio/music.js CUES: defend, infiltrate, duel, chase, battle…);
// by default each kind plays its own (hold: defend, sabotage: infiltrate, duel: duel).

import { REFUGE_SPOTS } from '../world/arenas/refuge.js';
import { PURSUIT_SPOTS } from '../world/arenas/pursuit.js';
import { COVERT_SPOTS } from '../world/arenas/covert.js';
import { BARGE_SPOTS } from '../world/arenas/barge.js';
import { HOLDFAST_SPOTS } from '../world/arenas/holdfast.js';
import { BATTLE_MAPS, GRASSLAND_SPOTS, ICEFRONT_SPOTS, GRAVEYARD_SPOTS } from './battlemaps.js';
import { LEVELS } from './levels.js';
import { JUNGLE_SPOTS } from '../world/arenas/jungle.js';
import { GARRISON_SPOTS } from '../world/arenas/garrison.js';
import { FRIGATE_SPOTS } from '../world/arenas/frigate.js';
import { KAMINO_SPOTS } from '../world/arenas/kamino.js';
import { CHIPWORKS_SPOTS } from '../world/arenas/chipworks.js';
import { WARCAMP_SPOTS } from '../world/arenas/warcamp.js';
import { CANYON_SPOTS } from '../world/arenas/canyon.js';
import { RELAY_SPOTS } from '../world/arenas/relay.js';
import { OUTPOST_SPOTS } from '../world/arenas/outpost.js';
import { TURNED, PURGE, DRILL, MARSHAL } from './allies.js';
import { MARSHAL_BOSS } from './bosses.js';
import { GATE_MISSIONS } from './missions-gate.js';

export const MISSION_VOICE = { jedi: 'MASTER VAEL', mando: 'THE ARMORER', trooper: 'THE CAPTAIN' };
export const MISSION_COLOR = { jedi: 0x5ad2ff, mando: 0xffa040, trooper: 0x4aa8ff };
// the same words (or value) for every hero: a mission with one story whoever plays it
const all = (v) => ({ jedi: v, mando: v, trooper: v });

export const MISSIONS = {
  refuge: {
    id: 'refuge',
    title: 'THE LAST EVACUATION',
    blurb: 'hold the ramp, slice the uplinks, duel the Inquisitor',   // the line under its card on the menu's MISSIONS list
    level: { name: 'MISSION — THE HIDDEN REFUGE', sub: 'The Empire has found the refuge. The last transport is still loading.',
             arena: 64, floor: 0x8a8478, fog: 0xa89098, sky: 0x2c3c66, layout: 'refuge', waves: [], hazards: {} },
    start: [0, 2, 0],   // south of the ramp, looking at the transport and the line filing aboard
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'hold', title: 'HOLD THE RAMP',
        say: { jedi: 'The younglings are coming out for the transport. Walk them to the ramp, and nothing reaches them until they are aboard.',
               mando: 'The foundlings are coming out for the transport. Walk them to the ramp and keep them covered till it lifts. This is the Way.' },
        task: { jedi: 'Guard the younglings to the ramp', mando: 'Guard the foundlings to the ramp' },
        at: [0, 9], r: 6, time: 60, awayRate: 0.5,
        evacuees: { count: 16, spacing: 1.2, speed: 2.2, name: { jedi: 'YOUNGLINGS', mando: 'FOUNDLINGS' },
                    path: [...REFUGE_SPOTS.path, ...REFUGE_SPOTS.ramp] },
        pulses: [ { grunt: 2, blaster: 1 }, { grunt: 2, officer: 1 }, { grunt: 2, blaster: 1, grenadier: 1 },
                  { grunt: 2, lancer: 1 }, { grunt: 1, duelist: 1, blaster: 1 } ],
        every: [9, 13], cap: 6, from: [-Math.PI + 0.35, -0.35], aggro: 8 },

      { kind: 'sabotage', title: 'SLICE THE UPLINKS',
        say: { jedi: 'They are calling down a bombardment on the refuge. Silence their uplinks before it falls.',
               mando: 'Their uplinks are calling in the bombardment. Slice them. Quickly.' },
        task: { jedi: 'Stand at each uplink console to slice it', mando: 'Stand at each uplink console to slice it' },
        twist: { kind: 'barrage', first: 5, every: 6, fuse: 2.2, r: 3.4, dmg: 20, foeDmg: 60,
                 line: { jedi: 'The bombardment has started. Where a ring fills, a shell lands. Every uplink you cut slows it.', mando: 'Shells coming in. The rings mark where. Every uplink you cut slows it down.' } },
        consoles: [ { at: REFUGE_SPOTS.uplinks[0], guards: { grunt: 2, blaster: 1 } },
                    { at: REFUGE_SPOTS.uplinks[1], guards: { lancer: 1, grunt: 2 } },
                    { at: REFUGE_SPOTS.uplinks[2], guards: { grenadier: 1, blaster: 1, officer: 1 } } ],
        time: 4, r: 2.2, hitLoss: 1.2,
        trickle: { every: 16, cap: 5, group: { grunt: 2, blaster: 1 } } },

      { kind: 'duel', title: 'DEFEAT THE INQUISITOR',
        say: { jedi: 'The Inquisitor has come for you, not the refuge. Read the blade, not the mask.',
               mando: 'A hunter of Jedi. It turns a blaster bolt with ease. Close the distance and break it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        // the first story duel, so a step gentler than the act III blades (the Long Chase's rematch is the hard one)
        foe: 'acolyte', name: 'THE INQUISITOR', hp: 4, dmg: 1.1, scale: 1.09, tint: 0xa01a22, at: [0, -6],
        duel: { block: 0.72, posture: 160, feint: 0.3, chain: 2, counter: 0.5 },
        rage: 0.55, rageDuel: { feint: 0.45, delay: 0.45, chain: 3, thrust: 0.2 },
        // it breaks off at this much health instead of falling: the Long Chase is where you finish it
        escape: 0.3, escapeLine: { jedi: 'It is wounded, and it saw which way the transports went.', mando: 'Wounded, and gone. It saw which way the transports went.' } },
    ],
    done: { jedi: 'The younglings are safe and the refuge still stands. But the Inquisitor lives, and it will be back.',
            mando: 'The foundlings are safe. The hunter got away. We will see it again.' },
  },

  // THE MANDALORIAN'S STORY, chapter 1 (data/campaign-mando.js: A JOB IN SALT HOLLOW): the bounty is an ambush. Out of the
  // cantina door into the street, cut the clamps they put on the Cinderwake, then hold the pad while it warms up. The
  // arena is the salt town's (world/arenas/outpost.js): the cantina south, the pad north, the guild hall east, stalls west.
  salthollow: {
    id: 'salthollow',
    title: 'A JOB IN SALT HOLLOW',
    campaignOnly: true,
    heroes: ['mando'],
    blurb: 'clear the street, cut the clamps, hold the pad',
    level: { name: 'MISSION — SALT HOLLOW', sub: 'The mark left an hour ago. The men who came in after him did not.',
             arena: 60, floor: 0xcdbb98, fog: 0xd8c8a8, sky: 0x6a8ab0, layout: 'outpost', waves: [], hazards: {} },
    start: [0, -12.5, 0],   // on the cantina's doorstep under the awning, looking up the street at the square and the pad
    kit: 4,
    objectives: [
      { kind: 'capture', title: 'CLEAR THE CANTINA STREET', postName: 'STREET', doneLine: 'THE STREET IS CLEAR', doneSub: 'Now get to the ship.', aggro: 8,
        say: all('They were waiting outside the door. Clear the street in front of the cantina, then we can think.'),
        task: all('Clear the street in front of the cantina'),
        posts: [ { at: [0, -6], guards: { grunt: 2, blaster: 2 } } ],
        r: 4.5, time: 5,
        trickle: { every: 12, cap: 5, group: { grunt: 1, blaster: 1 } }, from: [0.35, Math.PI - 0.35] },

      { kind: 'sabotage', title: 'CUT THE DOCKING CLAMPS', consoleName: 'CLAMP RELAY', consoleDone: 'CUT', doneLine: 'THE CINDERWAKE IS FREE', doneSub: 'Get to the pad.',
        say: all('They have clamped the Cinderwake to the pad. The clamp relays are round the square. Cut all three.'),
        task: all('Stand at each clamp relay to cut it'),
        consoles: [ { at: [13.5, -5], guards: { grunt: 1, blaster: 1, officer: 1 } },                    // the guild hall's door
                    { at: [-13.5, -14], guards: { grunt: 2, sniper: 1 } },                              // under the water-tower gantry
                    { at: [-12, 6], guards: { grunt: 2, blaster: 1, grenadier: 1 } } ],               // by the market stalls
        time: 3.5, r: 2.2, hitLoss: 1.2,
        trickle: { every: 15, cap: 6, group: { grunt: 2, blaster: 1 } } },

      { kind: 'hold', title: 'HOLD THE PAD', holding: 'ENGINES WARMING', doneLine: 'THE CINDERWAKE LIFTS', doneSub: 'Home. Now.',
        say: all('The engines take time from cold. Hold the pad until she is ready to lift.'),
        task: all('Hold the pad while the ship warms up'),
        at: [OUTPOST_SPOTS.pad[0], OUTPOST_SPOTS.pad[1] - 7], r: 6, time: 35, awayRate: 0.5,
        pulses: [ { grunt: 2, blaster: 1 }, { grunt: 2, officer: 1 }, { grunt: 2, blaster: 1, grenadier: 1 }, { grunt: 2, lancer: 1 } ],
        every: [8, 11], cap: 7, from: [-Math.PI + 0.35, -0.35], aggro: 8 },
    ],
    done: all('The street is quiet and the Cinderwake is up. Somebody wanted you away from home for an hour.'),
  },

  // THE MANDALORIAN'S STORY (data/campaign-mando.js): the covert's last ship, on the clan's own canyon (world/arenas/covert.js)
  covert: {
    id: 'covert',
    title: 'THE LAST SHIP',
    heroes: ['mando'],   // (the Mandalorian's own story: the covert, its foundlings, VX-7)
    blurb: 'hold the ramp, rig the jammers unseen, duel VX-7',
    level: { name: 'MISSION — THE COVERT', sub: 'The Magistrate has found the covert. One ship is left to carry the foundlings out.',
             arena: 60, floor: 0x8a5a44, fog: 0x6a3428, sky: 0x1a1830, layout: 'covert', waves: [], hazards: {} },
    start: [0, 3, 0],   // in the yard south of the blast wall, looking up at the ship and the line filing aboard
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'hold', title: 'HOLD THE RAMP',
        say: { jedi: 'The clan\'s foundlings are coming up from the tunnels for their last ship. Walk them to the ramp, and keep everything off them.',
               mando: 'The foundlings are coming up from the tunnels. Walk them to the ramp and keep them covered until every one of them is aboard.' },
        task: { jedi: 'Guard the foundlings to the ramp', mando: 'Guard the foundlings to the ramp' },
        twist: { kind: 'gap', at: 0.4, hit: [0, 14.6], piles: [[-3, 12.5], [3.5, 13]], clear: 2.5, r: 2.2,
                 line: { jedi: 'A shell has buried the foot of the ramp. The foundlings cannot get past. Clear the rubble.', mando: 'Ramp\'s blocked. The kids can\'t get past it. Dig it out.' } },
        at: COVERT_SPOTS.hold, r: 6, time: 72, awayRate: 0.5,
        evacuees: { kind: 'foundling', count: 10, spacing: 1.3, speed: 2.2, name: { jedi: 'FOUNDLINGS', mando: 'FOUNDLINGS' },
                    path: [...COVERT_SPOTS.path, ...COVERT_SPOTS.ramp] },
        pulses: [ { grunt: 2, blaster: 1 }, { grunt: 2, officer: 1 }, { grunt: 2, blaster: 1, grenadier: 1 },
                  { grunt: 2, lancer: 1 }, { grunt: 2, blaster: 1, officer: 1 }, { grunt: 1, duelist: 1, blaster: 1 } ],
        every: [9, 14], cap: 7, from: [-Math.PI + 0.35, -0.35], aggro: 8 },

      // INFILTRATE (game/infiltrate.js): the yard's patrols think the fight is at the ramp. Rig the jammers before they look round
      { kind: 'infiltrate', title: 'RIG THE JAMMERS', markName: 'JAMMER', markDone: 'RIGGED', doneLine: 'THE JAMMERS ARE DOWN', doneSub: 'The ship can call the clan.', start: [0, 3, Math.PI],
        quiet: ['THE JAMMERS ARE DOWN', 'Not one of them looked round.'],
        say: { jedi: 'Three jammers on the canyon floor are keeping the ship from calling for help. Their patrols think the fight is still at the ramp. Rig the jammers before they look round.',
               mando: 'Three jammers on the canyon floor. Their patrols think the fight\'s still at the ramp. Get down there quiet and rig every one before they look round.' },
        task: { jedi: 'Rig each jammer without being seen', mando: 'Rig each jammer without being seen' },
        marks: [ { at: COVERT_SPOTS.jammers[0] }, { at: COVERT_SPOTS.jammers[1] }, { at: COVERT_SPOTS.jammers[2] } ], time: 3, r: 2.2,
        guards: [ { type: 'blaster', path: [[-9, -3], [-21, -3]] },
                  { type: 'grunt', path: [[8, -5], [21, -5]], pause: 2.0 },
                  { type: 'blaster', path: [[-5, -12], [12, -14]] },
                  { type: 'officer', at: [4, -19.5], face: 0, sweep: 1.0, period: 8 } ],
        cams: [ { at: [-22, 0], y: 3.2, yaw: Math.PI / 2, sweep: 0.7, period: 7 },
                { at: [22, -3], y: 3.2, yaw: -Math.PI / 2, sweep: 0.7, period: 9, ph: 1.4 } ],
        lights: [ { from: [0, 16, -34], c: [0, -9], a: [12, 5], period: 16, r: 3.2 } ],
        alarm: { group: { grunt: 2, blaster: 2, grenadier: 1 }, at: [[-20, -24], [20, -24]],
                 line: { jedi: 'They have seen you. Rig the jammers anyway.', mando: 'Spotted. Rig them anyway.' },
                 trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1 } } } },

      { kind: 'duel', title: 'DEFEAT VX-7', start: [0, 3, Math.PI],
        say: { jedi: 'The Magistrate\'s hunter droid. It is fast, and it reads a blade. Make it commit.',
               mando: 'VX-7. It turns blaster fire and it doesn\'t tire. Get inside its guard and break it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'duelist', name: 'VX-7', kicker: 'BOUNTY · ASSASSIN DROID', hp: 5, dmg: 1.2, scale: 1.06, tint: 0x4a5a6a, at: [0, -6],
        duel: { block: 0.72, posture: 160, feint: 0.3, chain: 2, counter: 0.55 },
        rage: 0.5, rageDuel: { feint: 0.45, delay: 0.4, chain: 3, thrust: 0.25 },
        // it breaks off at this much health instead of falling, and takes a foundling with it (the Long Chase finishes it)
        escape: 0.22, escapeScene: 'vx-escape',
        escapeLine: { jedi: 'It is gone, and it has taken a child with it.', mando: 'Gone. And it took Rook.' } },
    ],
    done: { jedi: 'The ship is away with ten foundlings aboard. The droid got away with the eleventh.',
            mando: 'Ten foundlings are safe. VX-7 has Rook. We will get him back.' },
  },

  // THE BURNING ARCHIVE (the Jedi's story, chapter 2): the archive under the temple on fire. Get the archivists out
  // through the hall, cut into the Ledger's vault under the reading dais, and meet the Inquisitor who got there first.
  // The arena is the archive's (world/arenas/archive.js): the dais in the middle, the stacks in two rings, doors south.
  vault: {
    id: 'vault',
    title: 'THE BURNING ARCHIVE',
    blurb: 'get the archivists out, break into the vault, face the Inquisitor',
    story: 'campaign', act: 0, order: 1.5,   // (the Missions page: with the Burning Archive, the Jedi's chapter 2)
    level: { name: 'MISSION — THE BURNING ARCHIVE', sub: 'The archive is burning. The Ledger of Names is in the vault below it.',
             arena: 60, floor: 0x4a4234, fog: 0x2a1a14, sky: 0x1a1010, skyTop: 0x060304, sun: 0xffc890, ember: 0xff8a3a,
             fill: 0.9, sunI: 1.6, fogStart: 0.62, layout: 'archive', waves: [], hazards: {} },
    start: [0, 19, Math.PI],   // in from the south doors, looking north across the hall at the dais
    kit: 1,
    grant: { jedi: ['throw'], mando: ['grapple'] },
    objectives: [
      { kind: 'hold', title: 'GET THE ARCHIVISTS OUT',
        say: { jedi: 'The archivists are coming out of the north stacks with whatever they can carry. Meet them there and walk them out. Stay between them and the troops until every one of them is through the doors.',
               mando: 'Robed folk with their arms full of scrolls, coming out of the north stacks. Get to them, and walk them out through the fire.' },
        task: { jedi: 'Guard the archivists to the doors', mando: 'Guard the archivists to the doors' },
        // the archivists walk the whole way, from the north stacks down the east side of the hall, past the dais to the
        // south doors, and the zone rides on the line (game/mission.js followLine); the troops come in from the
        // west (behind the west stacks) and march on the line, so you stand between them and it. at: the hall's middle,
        // which the lanes are picked round. Away from the line, it creeps on at a fifth of the pace
        at: [1, 3], r: 7, time: 60, awayRate: 0.2,
        evacuees: { kind: 'archivist', count: 10, spacing: 1.6, speed: 2.4, ramp: false, verb: 'OUT', name: { jedi: 'ARCHIVISTS', mando: 'ARCHIVISTS' },
                    path: [[3, -26], [3, -16], [5.5, -7.5], [5.5, 4.5], [2, 12], [0, 20], [0, 29]] },
        pulses: [ { grunt: 2, blaster: 1 }, { grunt: 2, grenadier: 1 }, { grunt: 2, blaster: 1, officer: 1 }, { grunt: 1, duelist: 1, blaster: 1 } ],
        every: [10, 15], cap: 6, from: [Math.PI - 1.05, Math.PI + 1.05], aggro: 8 },

      { kind: 'sabotage', title: 'BREAK INTO THE VAULT', consoleName: 'VAULT SEAL', consoleDone: 'OPEN', doneLine: 'THE VAULT IS OPEN', doneSub: 'Someone has already been down there.',
        start: [0, 12, Math.PI],
        say: { jedi: 'The vault is under the reading dais. Its seals are on the north and south steps. Cut through both before the fire reaches it.',
               mando: 'There is a vault under that dais. Cut the seals.' },
        task: { jedi: 'Stand at each seal to cut through it', mando: 'Stand at each seal to cut through it' },
        consoles: [ { at: [0, 4.2], guards: { grunt: 2, blaster: 1 } },
                    { at: [0, -4.2], guards: { lancer: 1, grunt: 1, officer: 1 } } ],
        time: 4.5, r: 2.2, hitLoss: 1.2,
        trickle: { every: 15, cap: 4, group: { grunt: 2, blaster: 1 } } },

      { kind: 'duel', title: 'FACE THE INQUISITOR', start: [0, 10, Math.PI],
        say: { jedi: 'It was in the vault before you. It knows how you fight. Do not let it out with the Ledger.',
               mando: 'A Jedi hunter, coming up out of the vault. Close the distance and break it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'acolyte', name: 'THE INQUISITOR', hp: 3.5, dmg: 1.1, scale: 1.09, tint: 0xa01a22, at: [0, -15],
        duel: { block: 0.72, posture: 150, feint: 0.3, chain: 2, counter: 0.5 },
        rage: 0.55, rageDuel: { feint: 0.45, delay: 0.4, chain: 3, thrust: 0.2 },
        // the twist (game/twists.js): the lights die once it's in, and the duel is fought by the blades' light
        twist: { kind: 'blackout', line: { jedi: 'The smoke has taken the lights. Watch its blade, not its body. Yours lights the ground around you.',
                                           mando: 'Lights are out. Its blade gives it away, and your lamp shows the floor.' } },
        // it breaks off: the refuge is where it comes back, and the chase where it ends
        escape: 0.3, escapeLine: { jedi: 'The mask is off. It runs for the refuge.', mando: 'Wounded, and gone into the smoke.' } },
    ],
    done: { jedi: 'The archivists are out, and the vault is open. But somebody got there first.',
            mando: 'The archivists are out. The hunter got away.' },
  },

  // THE EMBER ACADEMY (the Jedi's story, Mustafar): the forge is where Vexis trains the children he has taken. Open their
  // cells, walk them out to the ships up the north lane, and face the academy's overseer, while Vael goes after Vexis
  // himself somewhere in the smoke. It's a trap for Vael (the chapter's words: data/campaign-jedi.js mustafar).
  academy: {
    id: 'academy',
    title: 'THE EMBER ACADEMY',
    blurb: 'open the children\'s cells, walk the stragglers out, and face the overseer',
    story: 'campaign', act: 1, order: 9.5,   // (the Missions page: with the Mustafar chapter)
    level: { ...LEVELS[1], name: 'MISSION — THE EMBER ACADEMY', sub: 'He teaches the children he has taken in the fire. Get them out.', waves: [], hazards: {} },
    start: [0, 17, Math.PI],   // the north lane, looking down the forge floor
    kit: 6,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    // the three who froze (built from the evacuees' own figures: game/mission.js buildKids)
    escort: all({ kids: 3, name: 'THE STRAGGLERS', kicker: 'THREE WHO DIDN\'T RUN', hp: 260 }),
    objectives: [
      { kind: 'sabotage', title: 'OPEN THE CELLS', consoleName: 'CELL', consoleDone: 'OPEN', doneLine: 'THE CELLS ARE OPEN', doneSub: 'The children are coming out.',
        say: { jedi: 'Three cell blocks off the forge floor: by the smelter and under the two catwalks. Cut every lock. Mind the channels: the lava rises on a cycle.',
               mando: 'Three cell blocks. Kids inside. Cut every lock, and keep off the channels when they glow.' },
        task: { jedi: 'Stand at each cell block to cut its lock', mando: 'Stand at each cell block to cut its lock' },
        consoles: [ { at: [-13.8, 4.2], guards: { grunt: 2, blaster: 1, acolyte: 1 } },
                    { at: [13.8, -4.2], guards: { grunt: 2, lancer: 1, grenadier: 1 } },
                    { at: [0, -5], guards: { phalanx: 1, grunt: 2, officer: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1, flyer: 1 } } },

      // the stragglers: most of them ran for the ships when the locks went. Three didn't, and they're down by the
      // smelter where the troops come in. Walk them out, round the smelter and up the north lane
      { kind: 'escort', title: 'GET THE STRAGGLERS OUT', music: 'battle', start: [2, -14, Math.PI],
        say: { jedi: 'Most of them ran for the ships when the locks went. Three did not: they are hiding by the smelter, too frightened to move. Stay with them and they will follow you. Keep the troops off them.',
               mando: 'Most of the kids ran when the locks went. Three froze by the smelter. Stay close and they\'ll follow you. Keep the troops off them.' },
        task: { jedi: 'Stay with the children and keep foes off them', mando: 'Stay with the kids and keep foes off them' },
        path: [[0, -16], [0, -5.4], [-3.7, -3.7], [-5.4, 0]],
        speed: 2.2, leash: 12, threat: 5, dps: 4, regen: 2.5, aggro: 7,
        ambush: [ { at: [0, -10], group: { grunt: 2, acolyte: 1 }, from: [-Math.PI + 0.3, -0.3] },
                  { at: [-3.7, -3.7], group: { grunt: 2, blaster: 1, flyer: 1 }, from: [Math.PI / 2 + 0.3, Math.PI - 0.3] } ],
        trickle: { every: 15, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.3, -0.3] },
      { kind: 'escort', title: 'GET THE STRAGGLERS OUT', music: 'battle', start: [-6, 2, 0],
        say: { jedi: 'Round the smelter and up the north lane to the ships. The overseers know they are getting away. They will throw everything at the lane.',
               mando: 'Round the smelter, up the lane to the ships. They know the kids are getting away. Everything\'s coming at the lane.' },
        task: { jedi: 'Get the children up the lane to the ships', mando: 'Get the kids up the lane to the ships' },
        path: [[-5.4, 0], [-3.7, 3.7], [0, 5.4], [0, 13], [0, 22]],
        speed: 2.2, leash: 12, threat: 5, dps: 4.5, regen: 2.5, aggro: 7,
        ambush: [ { at: [0, 5.4], group: { grunt: 2, lancer: 1, blaster: 1 }, from: [-0.6, 0.6] },
                  { at: [0, 15], group: { grunt: 2, sniper: 1, bomber: 1 }, from: [-Math.PI + 0.3, -0.3] } ],
        trickle: { every: 14, cap: 7, group: { grunt: 1, acolyte: 1 } }, from: [-Math.PI + 0.3, -0.3] },

      // the overseer: beaten, but it breaks off into the smoke (it isn't finished: the story needs it to have got away)
      { kind: 'duel', title: 'DEFEAT THE OVERSEER', start: [0, 12, Math.PI],
        say: { jedi: 'The overseer who trained them comes out of the smoke. Read the swing, then punish it. I am going after Vexis.',
               mando: 'The one who ran this place. Make it miss, then hit it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'brute', name: 'THE OVERSEER', hp: 3.6, dmg: 1.2, scale: 1.35, tint: 0xff7a1e, at: [0, -12],
        escape: 0.3, escapeScene: 'overseer-escape',
        escapeLine: { jedi: 'It throws a channel open between you and is gone into the smoke.', mando: 'It floods a channel between you and runs.' },
        rage: 0.45, trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The children are aboard and the academy is burning. The overseer got away, and Vael has gone quiet.',
            mando: 'The kids are out and the academy burns. Its overseer got away.' },
  },

  // THE MANDALORIAN'S STORY, ACT II: Skye's prison barge on the storm sea of Vell (world/arenas/barge.js)
  gallows: {
    id: 'gallows',
    title: 'THE GALLOWS',
    heroes: ['mando'],
    blurb: 'breach the cell blocks, get Skye out, put down the warden',
    // the barge's cell blocks are hollow on this level, a blast door on each (world/arenas/barge.js cells)
    level: { name: 'MISSION — THE GALLOWS', sub: 'The Magistrate\'s prison barge, riding out a storm. Skye is in one of its cells.',
             arena: 60, floor: 0x4a545e, fog: 0x22303c, sky: 0x060a10, layout: 'barge', cells: true, waves: [], hazards: {} },
    start: [0, 10, Math.PI],   // in front of the impounded gunship, looking down the deck at the warden's tower
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'breach', title: 'BREACH BLOCK A', start: [-8, 2, -Math.PI / 2], doors: 0,
        say: { jedi: 'The cell blocks are sealed from inside, a blast door on each. Block A first, on the west side. Set the charge and go in fast.',
               mando: 'Two cell blocks, a blast door on each. Block A first, west side. Set the charge and go in hard.' },
        task: { jedi: 'Stand at the door to set the charge, then clear the block', mando: 'Stand at the door to set the charge, then clear the block' },
        door: 0, stack: BARGE_SPOTS.cells.stack[0], time: 2.6, fuse: 1.1, stun: 1.5,
        guards: { grunt: 2, blaster: 2, lancer: 1 }, spots: BARGE_SPOTS.cells.rooms[0].spots,
        breachLine: 'BREACH', breachSub: 'Into the block.', doneLine: 'BLOCK A CLEAR', doneSub: 'The prisoners are running for the ship. Skye isn\'t with them.' },
      // Block B: they heard Block A go. The alarm's up the moment the door blows, and Skye is at the back
      { kind: 'breach', title: 'BREACH BLOCK B', start: [8, 2, Math.PI / 2], doors: 1,
        say: { jedi: 'Skye is in Block B, across the deck. They heard the first door, so the moment this one goes they will call it in. Get her cell open and clear the block before more come.',
               mando: 'Skye\'s in Block B, across the deck. They heard the first door. When this one blows they\'ll call it in. Get her cell open and clear the block before more come.' },
        task: { jedi: 'Breach Block B, open Skye\'s cell, and clear the block', mando: 'Breach Block B, open Skye\'s cell, and clear the block' },
        door: 1, stack: BARGE_SPOTS.cells.stack[1], time: 2.4, fuse: 1.0, stun: 1.2,
        guards: { grunt: 2, blaster: 1, grenadier: 1, officer: 1 }, spots: BARGE_SPOTS.cells.rooms[1].spots,
        alarm: { time: 15, at: [[22.5, 6.5], [18, -10.5]], group: { grunt: 2, blaster: 1, lancer: 1 }, startLine: 'THE ALARM\'S UP · CLEAR THE BLOCK FAST', line: 'More of the guard, in from the deck hatches.' },
        grab: { at: BARGE_SPOTS.cells.skye, time: 3.5, r: 1.3, status: 'OPEN SKYE\'S CELL', line: 'SKYE IS OUT · CLEAR THE BLOCK' },
        breachLine: 'BREACH', breachSub: 'Find Skye.', doneLine: 'BLOCK B CLEAR', doneSub: 'Skye is running for her ship. The warden is coming down from its tower.' },

      { kind: 'duel', title: 'DEFEAT THE WARDEN', start: [0, 8, Math.PI],
        say: { jedi: 'The warden comes down from its tower with a shock maul, and the storm has the barge rolling. Let it swing. Then punish it.',
               mando: 'The warden. Big, slow, and it hits like a cargo lift, and the deck\'s rolling. Make it miss, then hit it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        twist: { kind: 'list', at: 8, period: 9, roll: 0.06, slide: 2.2, crates: 4, width: 9,
                 line: { jedi: 'The barge is listing. Keep your feet, and watch for the cargo coming loose.', mando: 'The barge is going over on its side. Watch the cargo. It\'s coming loose.' } },
        foe: 'brute', name: 'THE WARDEN', kicker: 'THE GALLOWS', hp: 3.2, dmg: 1.15, scale: 1.3, tint: 0x5a6a7a, at: [0, -8],
        rage: 0.45, trickle: { every: 15, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The cells are empty and the warden is down.',
            mando: 'The cells are empty, the warden is down, and Skye is flying again.' },
  },

  // THE MANDALORIAN'S STORY, ACT II: Brakka's last stand at the old holdfast on Thane (world/arenas/holdfast.js)
  holdfast: {
    id: 'holdfast',
    title: 'THE HOLDFAST',
    heroes: ['mando'],
    blurb: 'hold the gate, light the signal cairns, face the houndmaster',
    level: { name: 'MISSION — THE OLD HOLDFAST', sub: 'Brakka is holding a ruined fort in the forest, and the Magistrate\'s hunters have found it.',
             arena: 60, floor: 0x5a7040, fog: 0xa8b49a, sky: 0x5a86b0, layout: 'holdfast', waves: [], hazards: {} },
    start: [0, 2, Math.PI],   // in the courtyard, looking out through the gate at the hunters' camp
    kit: 5,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'hold', title: 'HOLD THE GATE', music: 'battle',
        say: { jedi: 'The hunters are coming up the lane to the gate. Brakka has the wall. The gate is yours.',
               mando: 'Hunters up the lane. Brakka has the wall, you have the gate. Nothing gets into that courtyard.' },
        task: { jedi: 'Hold the gate', mando: 'Hold the gate' },
        at: HOLDFAST_SPOTS.hold, r: 6, time: 60, awayRate: 0.4, overrun: 'RETAKE THE GATE', unguarded: 'GATE UNGUARDED',
        doneLine: 'THE GATE HOLDS', doneSub: 'Now call the ship.',
        pulses: [ { grunt: 3, blaster: 1 }, { grunt: 2, lancer: 1 }, { grunt: 2, blaster: 1, officer: 1 },
                  { grunt: 2, sniper: 1, blaster: 1 }, { grunt: 2, brute: 1 }, { grunt: 2, lancer: 1, grenadier: 1 } ],
        every: [8, 12], cap: 8, from: [-Math.PI + 0.45, -0.45], aggro: 8 },

      { kind: 'capture', title: 'LIGHT THE CAIRNS', start: [0, -6, Math.PI],
        say: { jedi: 'Two signal cairns stand out in the clearing. Take them and light them, and the ship can find you.',
               mando: 'The old signal cairns. Take both and light them, and the Cinderwake can find us through the trees.' },
        task: { jedi: 'Take and light both cairns', mando: 'Take and light both cairns' },
        r: 3.6, time: 7, postName: 'CAIRN', doneLine: 'THE CAIRNS ARE LIT', aggro: 8,
        posts: [ { at: HOLDFAST_SPOTS.cairns[0], guards: { grunt: 2, blaster: 1, lancer: 1 } },
                 { at: HOLDFAST_SPOTS.cairns[1], guards: { grunt: 2, blaster: 1, officer: 1 } } ],
        trickle: { every: 13, cap: 7, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.35, -0.35] },

      { kind: 'duel', title: 'DEFEAT THE HOUNDMASTER', start: [0, -6, Math.PI],
        say: { jedi: 'The hunters\' master comes out of the trees. It tracks by scent and strikes from the side. Turn with it.',
               mando: 'The Houndmaster. It runs the Magistrate\'s trackers. It\'s fast and it flanks. Keep it in front of you.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        twist: { kind: 'stalker', first: 9, every: 14, rageEvery: 10, hide: 2.5, tell: [1.6, 1.0], back: 4,
                 line: { jedi: 'It has gone into the trees. Listen. It comes out behind you, and it growls first.', mando: 'Lost it in the trees. It\'ll come from behind. Listen for the growl and turn.' } },
        foe: 'lancer', name: 'THE HOUNDMASTER', kicker: 'THE MAGISTRATE\'S HUNTER', hp: 4, dmg: 1.15, scale: 1.12, tint: 0x6a5a3a, at: [0, -16],
        duel: { feint: 0.4, chain: 3, counter: 0.45 },
        rage: 0.5, rageDuel: { chain: 4, delay: 0.3 },
        trickle: { every: 15, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The hunters are broken and the holdfast stands.',
            mando: 'The hunters are broken. The holdfast stands, and so does Brakka.' },
  },

  // A STRIKE TEAM mission: `squad` squadmates form up beside the hero (allies/squad.js, data/allies.js), and `battle`
  // runs the wider war past the walls (fx/battle.js). The squad shoots the troopers; the duellists are yours.
  strike: {
    id: 'strike',
    title: 'SPEARHEAD',
    blurb: 'lead a strike team through the battle lines',
    // the Grass Sea of Lothal (data/battlemaps.js): up from the landing field, across the ridges, to the outpost's gate
    level: { ...BATTLE_MAPS.grassland.level, name: 'MISSION — THE BATTLE OF THE GRASS SEA',
             sub: 'The Empire holds the grass before its outpost. Break its line and take the gate.' },
    start: GRASSLAND_SPOTS.allyStart,   // the landing field in the north, looking south across the grass
    kit: 8,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 4, battle: true,
    objectives: [
      { kind: 'capture', title: 'BREAK THEIR LINE',
        say: { jedi: 'Your troopers are with you, General. Take their forward posts one by one. Leave the troopers to the squad, and the blades to yourself.',
               mando: 'Your clan rides with you. Take their posts one by one. They\'ll handle the troopers. The blades are yours.' },
        task: { jedi: 'Take the three posts (tap T on one to send the squad there)', mando: 'Take the three posts (tap the middle mouse button on one to send the squad there)' },
        r: 5, time: 9, squadRate: 0.55, perMate: 0.15, postName: 'POST', doneLine: 'THEIR LINE BREAKS', aggro: 9,
        posts: [ { at: GRASSLAND_SPOTS.points.ridge, guards: { grunt: 3, blaster: 2 } },                        // the first ridge
                 { at: GRASSLAND_SPOTS.points.walker, guards: { grunt: 3, blaster: 2, officer: 1, lancer: 1 } },   // under the downed walker
                 { at: GRASSLAND_SPOTS.points.crossroads, guards: { grunt: 2, blaster: 2, grenadier: 1, duelist: 1 } } ],
        trickle: { every: 13, cap: 10, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.35, -0.35] },

      { kind: 'hold', title: 'HOLD THE GATE', music: 'battle',
        say: { jedi: 'Their gate is open and the whole outpost is coming out of it. Hold it until the gunships arrive. If a blade comes for you, put the squad on the gate (H) and meet it.',
               mando: 'The gate\'s ours if we can keep it. Hold it till the gunships come. Put your clan on it (H) when you have to go hunting.' },
        task: { jedi: 'Hold the gate until the gunships arrive', mando: 'Hold the gate until the gunships arrive' },
        twist: { kind: 'standard', first: 14, every: 16, at: [0, -15], r: 7, ward: 0.5, guards: { phalanx: 1, grunt: 1 },
                 line: { jedi: 'An officer has planted their standard. Every trooper near it fights twice as hard. Cut it down.', mando: 'They\'ve planted a banner. The ones near it won\'t go down easy. Take it out.' } },
        at: GRASSLAND_SPOTS.points.gate, r: 7, time: 60, awayRate: 0.25, squadRate: 0.6, overrun: 'RETAKE THE GATE', unguarded: 'GATE UNGUARDED',
        pulses: [ { grunt: 3, blaster: 2 }, { grunt: 2, blaster: 2, officer: 1 }, { grunt: 3, blaster: 1, phalanx: 1 },
                  { grunt: 2, blaster: 2, grenadier: 1 }, { grunt: 2, blaster: 1, acolyte: 1 }, { grunt: 3, blaster: 2, flyer: 1 } ],
        every: [8, 11], cap: 11, from: [-Math.PI + 0.35, -0.35], aggro: 9,
        doneLine: 'THE GUNSHIPS ARE HERE', doneSub: 'The gate is ours. Its warden is coming out.' },

      { kind: 'duel', title: 'DEFEAT THE WARDEN',
        say: { jedi: 'Their commander takes the field himself. Your men will keep his troops off you. He is yours.',
               mando: 'Their commander wants you himself. The clan will keep his troops busy. Take him.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds', trooper: 'Win the duel while the band holds' },
        // the last duel before the throne in the campaign (SPEARHEAD on Exegol), so one of the toughest
        foe: 'acolyte', name: 'THE WARDEN', hp: 4.5, dmg: 1.15,   // (BALANCE: was 5 / 1.25: a Knight's ranks now stack under it)
        scale: 1.1, tint: 0x8a2a1a, at: [0, -28],   // the open grass before the gate
        duel: { block: 0.78, posture: 170, feint: 0.4, chain: 2, counter: 0.6 },
        rage: 0.5, rageDuel: { feint: 0.42, delay: 0.35, chain: 3, thrust: 0.2 },
        trickle: { every: 12, cap: 4, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.35, -0.35],
        hero: { mando: { foe: 'duelist', name: 'THE IRON WARDEN', tint: 0x4a4a52, hp: 6,
                         duel: { block: 0.7, posture: 155, feint: 0.3, chain: 2, counter: 0.5 } } } },
    ],
    done: { jedi: 'The line is broken and the Grass Sea is ours. Your men fought well, General. So did you.',
            mando: 'The ground is ours. The clan stands. This is the Way.' },
  },

  pursuit: {
    id: 'pursuit',
    title: 'THE LONG CHASE',
    blurb: 'run the quarry down before it reaches its ship',
    level: { name: 'MISSION — THE SPACEPORT AT KHEL DAR', sub: 'It knows where the refuge went. Do not let it reach its ship.',
             arena: 56, arenaZ: 320, floor: 0xb49470, fog: 0xd8a878, sky: 0x3a5c92, layout: 'pursuit', waves: [], hazards: {} },
    start: PURSUIT_SPOTS.start,   // the south end of the town, the quarry already running up the market street
    route: PURSUIT_SPOTS.legs,     // the quarry's line through the town, one polyline per pursuit leg
    kit: 8,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    // who you are chasing (built from an enemy type, like the refuge's duel)
    quarry: { jedi: { foe: 'acolyte', name: 'THE SEVENTH BLADE', kicker: 'INQUISITOR', tint: 0xa01a22, scale: 1.08 },
              mando: { foe: 'duelist', name: 'VX-7', kicker: 'BOUNTY · ASSASSIN DROID', tint: 0x4a5a6a, scale: 1.06 } },
    objectives: [
      { kind: 'pursuit', leg: 0,
        title: { jedi: 'CHASE THE INQUISITOR', mando: 'CHASE THE BOUNTY' },
        say: { jedi: 'The Inquisitor carries the refuge\'s new coordinates. Keep it in sight. Over the stalls, not around them, and take the roofline lane off the cross if you can climb it.',
               mando: 'The droid has the foundlings\' trail in its memory core. Run it down. Use the jetpack, use the walls. The roofline lane off the cross cuts its corner.' },
        task: { jedi: 'Keep the Inquisitor in sight', mando: 'Keep the bounty in sight' },
        sight: 42, lost: 6, shove: 3.0,
        pace: [[-6, 11.5], [6, 10.2], [14, 9.0], [24, 8.2], [36, 7.4]],
        clash: { dmg: 0.12, time: 9, every: 16 },
        shortcuts: PURSUIT_SPOTS.shortcuts[0],
        standoff: [ { at: [0, -100], spots: [[-10, -104], [10, -104], [-9, -96], [9, -96]], group: { grunt: 2, lancer: 1, blaster: 1 } },
                    { at: [6, 6], spots: [[-6, 0], [14, 14], [-10, 14], [2, 22]], group: { grunt: 2, officer: 1, blaster: 1 } } ] },

      { kind: 'pursuit', leg: 1, start: PURSUIT_SPOTS.checkpoint,
        title: { jedi: 'CHASE THE INQUISITOR', mando: 'CHASE THE BOUNTY' },
        say: { jedi: 'It is making for the docks. The causeway is faster, if you can clear the gaps, and the stacks west of the hangars cut straight to the bay.',
               mando: 'It\'s heading for the docking bay. Take the causeway. Don\'t lose it in the hangars.' },
        task: { jedi: 'Keep the Inquisitor in sight', mando: 'Keep the bounty in sight' },
        sight: 42, lost: 6, shove: 3.0,
        pace: [[-6, 11.5], [6, 10.4], [14, 9.2], [24, 8.4], [36, 7.6]],
        clash: { dmg: 0.12, time: 9, every: 16 },
        shortcuts: PURSUIT_SPOTS.shortcuts[1],
        standoff: [ { at: [4, 83], spots: [[-8, 92], [0, 92], [8, 75], [-2, 75]], group: { grunt: 2, lancer: 1, grenadier: 1, blaster: 1 } } ] },

      { kind: 'duel', quarry: true, title: { jedi: 'DEFEAT THE INQUISITOR', mando: 'BRING IN THE BOUNTY' },
        say: { jedi: 'Its ship is clamped down. Nowhere left to run. Read the blade, not the mask.',
               mando: 'Docking clamps are locked. It has to come through you. Watch the staff, and break its guard.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        // the act III rematch: tougher than the refuge's, but every clash on the run carries into it (and it can't
        // come in with less than 60% of this, game/mission.js)
        hp: 5.3, dmg: 1.25,   // (BALANCE: was 5.5 / 1.3, feint 0.45, rage feint 0.55: a step up from the Warden, not a wall)
        duel: { block: 0.78, posture: 170, feint: 0.42, chain: 3, counter: 0.6 },
        rage: 0.5, rageDuel: { feint: 0.52, delay: 0.35, chain: 3, thrust: 0.3 },
        hero: { mando: { hp: 6.5, dmg: 1.3, duel: { block: 0.72, posture: 160, feint: 0.35, chain: 2, counter: 0.55 },
                         rageDuel: { feint: 0.55, delay: 0.35, chain: 3, thrust: 0.3 } } } },
    ],
    done: { jedi: 'The coordinates die with it. The younglings stay hidden. Well run, and well fought.',
            mando: 'The trail is wiped and the bounty is claimed. The foundlings stay hidden. This is the Way.' },
  },

  // ---- on the battle maps (data/battlemaps.js): a map's level, renamed for the mission, and its SPOTS ----

  // HOTH: a trench defence with the full strike team. Hold the forward line, blow the walker that's shelling it,
  // fall back to the rear trench while the transports launch, then meet what comes over the berm.
  icefront: {
    id: 'icefront',
    title: 'THE TRENCH LINE',
    blurb: 'hold two trench lines and bring down a walker',
    level: { ...BATTLE_MAPS.icefront.level, name: 'MISSION — THE ICE FRONT ON HOTH',
             sub: { jedi: 'The shield generator must stand until the last transport is away.',
                    mando: 'The clan\'s ships are still in the ice hangar. Buy them the time to launch.',
                    trooper: 'The transports carry the enclave\'s children off the ice. Hold until the last one is away.' } },
    start: ICEFRONT_SPOTS.allyStart,
    kit: 5,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 4, battle: true,
    objectives: [
      { kind: 'hold', title: 'HOLD THE FORWARD TRENCH', music: 'battle',
        say: { jedi: 'Here they come, General. Hold the forward trench. The troopers are the squad\'s; the shields and the brutes are yours.',
               mando: 'They\'re coming over the snow. Hold the forward trench. Your clan takes the troopers; you take the heavies.',
               trooper: 'Here they come, brother. Hold the forward trench. The band and Master Iro take the line troops; the heavies are yours.' },
        task: { jedi: 'Hold the forward trench (H puts the squad on it)', mando: 'Hold the forward trench (H puts the clan on it)', trooper: 'Hold the forward trench (H puts the band on it)' },
        at: [0, 14], r: 7, time: 45, awayRate: 0.3, squadRate: 0.6, holding: 'TRENCH HELD',
        overrun: 'CLEAR THE TRENCH', unguarded: 'TRENCH UNGUARDED', doneLine: 'THE FIRST WAVE BREAKS', doneSub: 'But the walker is still firing.',
        pulses: [ { grunt: 3, blaster: 2 }, { grunt: 2, blaster: 1, phalanx: 1 }, { grunt: 2, blaster: 2, grenadier: 1 },
                  { grunt: 3, officer: 1, sniper: 1 }, { grunt: 2, blaster: 1, brute: 1 }, { grunt: 2, blaster: 2, flyer: 1 } ],
        every: [8, 11], cap: 10, from: [-Math.PI + 0.4, -0.4], aggro: 9 },

      // THE WALKER TAKEDOWN (game/walker.js): a real one, striding in from the Imperial line to shell the trench
      { kind: 'walker', title: 'BRING DOWN THE WALKER', start: [0, 18, Math.PI], music: 'battle', doneLine: 'THE WALKER FALLS', doneSub: 'Its guns go quiet.',
        say: { jedi: 'That walker is coming for the trench. There are tow points at three of its legs: hold one with the Force, and get the cables round the others. When it goes down, set a charge on its neck.',
               mando: 'That walker will level the trench. Three tow points on its legs: fly the cable round its knees and winch the rest. When it drops, put a charge on its neck. This is the Way.',
               trooper: 'Walker inbound, brother. Tow cables on three of its legs, and the band can hold the winch line. Trip it, then set a charge on its neck.' },
        task: all('Work the tow points at its legs, then set the charge on its neck'),
        path: [[-25, -64], [-22, -42], [-14, -22], [-6, -2]],
        anchors: [{ leg: 0, style: 'seal' }, { leg: 1, style: 'sky' }, { leg: 3, style: 'line' }],
        drop: { group: { grunt: 2, blaster: 1 } },
        crew: { officer: 1, blaster: 2, grunt: 1 },
        trickle: { every: 15, cap: 8, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'hold', title: 'FALL BACK TO THE REAR TRENCH', music: 'battle', start: [0, 40, Math.PI],
        say: { jedi: 'The transports are launching. Fall back to the rear trench and hold it until the last one clears the shield.',
               mando: 'The ships are lifting. Back to the rear trench. Nothing reaches the hangar till they\'re gone.',
               trooper: 'The transports are lifting. Fall back to the rear trench and hold it until the last one clears the shield.' },
        task: { jedi: 'Hold the rear trench until the transports are away', mando: 'Hold the rear trench until the ships are away' },
        at: [0, 36], r: 7, time: 45, awayRate: 0.25, squadRate: 0.6, holding: 'TRANSPORTS LAUNCHING',
        overrun: 'CLEAR THE TRENCH', unguarded: 'TRENCH UNGUARDED', doneLine: 'THE LAST TRANSPORT IS AWAY', doneSub: 'Something big is coming through the snow.',
        pulses: [ { grunt: 3, blaster: 2, flyer: 1 }, { grunt: 2, lancer: 1, blaster: 1 }, { grunt: 2, blaster: 2, officer: 1 },
                  { grunt: 2, bomber: 2 }, { grunt: 2, blaster: 1, phalanx: 1, grenadier: 1 }, { grunt: 3, blaster: 1, sniper: 1 } ],
        every: [7, 10], cap: 10, from: [-Math.PI + 0.4, -0.4], aggro: 9 },

      { kind: 'duel', title: 'STOP THE AVALANCHE', start: [0, 34, Math.PI],
        say: { jedi: 'Their siege trooper walks through blaster fire like snow. Your men will hold off the rest. Don\'t trade blows with it: read the swing, then punish it.',
               mando: 'A siege trooper, built like a walker. Rifles won\'t stop it. Keep moving, hit it when it overcommits.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds', trooper: 'Win the duel while the band holds' },
        foe: 'brute', name: 'THE AVALANCHE', hp: 3.2, dmg: 1.1, scale: 1.3, tint: 0xc8d4e0, at: [0, 22],
        rage: 0.45, trickle: { every: 13, cap: 4, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The transports are clear and the line held. The generator can fall now. It bought what it had to.',
            mando: 'The ships are away and the clan stands. This is the Way.',
            trooper: 'The transports are clear and the line held. Every child is off the ice.' },
  },

  // JAKKU: a raid with no squad. Pull the cores out of the wrecks before the salvage crews do, walk the crawler with
  // them aboard back across the yard (the storm comes in halfway), and settle it with the hunter who tracked you there.
  graveyard: {
    id: 'graveyard',
    title: 'SALVAGE RIGHTS',
    blurb: 'raid the wrecks for their cores, and walk the crawler home through the storm',
    level: { ...BATTLE_MAPS.graveyard.level, name: 'MISSION — THE STARSHIP GRAVEYARD OF JAKKU',
             sub: { jedi: 'The cores in these wrecks remember where his ships have been.',
                    mando: 'The cores in these wrecks remember where the beskar went. The Empire wants them first.' } },
    start: GRAVEYARD_SPOTS.allyStart,
    kit: 6,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    // the salvage crawler the cores ride home on (game/mission.js buildCrawler)
    escort: all({ vehicle: 'crawler', name: 'THE CRAWLER', kicker: 'HAULING THE CORES', color: 0x9a7a4e, eye: 0xffa040, scale: 1.05, hp: 380 }),
    objectives: [
      { kind: 'sabotage', title: 'SALVAGE THE CORES', consoleName: 'CORE', doneLine: 'EVERY CORE RECOVERED', doneSub: 'They know you have them.',
        say: { jedi: 'Four wrecks still hold their navigation cores, and they remember where Vexis\'s ships go. Pull each one before the salvage crews burn them. Mind the snipers on the hulls.',
               mando: 'Four cores, four wrecks, and every one remembers where the Magistrate\'s beskar goes. Pull them before his crews do. Snipers on the high plates: take the high ground or stay low.' },
        task: { jedi: 'Stand at each wreck to pull its core', mando: 'Stand at each wreck to pull its core' },
        consoles: [ { at: GRAVEYARD_SPOTS.points.engine, guards: { grunt: 2, blaster: 2 } },   // (the first core: no sniper yet)
                    { at: [42, 20], guards: { grunt: 2, lancer: 1, blaster: 1 } },
                    { at: [-10, -31], guards: { grunt: 1, grenadier: 1, blaster: 1, officer: 1 },
                      found: { jedi: ['THE CAPTAIN\'S HOLOCRON', 'The Republic cruiser kept more than its route.'], mando: null } },
                    { at: [26, -54], guards: { phalanx: 1, grunt: 2, sniper: 1 } } ],
        time: 4, r: 2.4, hitLoss: 0.6,
        trickle: { every: 18, cap: 5, group: { grunt: 1, blaster: 1, flyer: 1 } } },

      // the crawler: the cores are loaded on it, and it has to cross the yard to the freighter. Halfway, the storm comes in
      { kind: 'escort', title: 'GET THE CRAWLER HOME', start: [3, -40, 0],
        say: { jedi: 'The cores are loaded on the crawler. It is slow, and it will not drive into fire. Walk it back across the yard to the freighter, and keep the salvage crews off it.',
               mando: 'Cores are on the crawler. Slow, and it won\'t drive into fire. Walk it back to the freighter and keep the crews off it.' },
        task: { jedi: 'Stay with the crawler and keep foes off it', mando: 'Stay with the crawler and keep foes off it' },
        path: [[0, -46], [0, -28], [0, -12], [-10, 2]],
        speed: 2.4, leash: 15, threat: 6, dps: 4, regen: 2, aggro: 7,
        ambush: [ { at: [0, -34], group: { grunt: 2, blaster: 2 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [0, -16], group: { grunt: 2, sniper: 1, grenadier: 1 }, from: [Math.PI - 0.6, Math.PI + 0.6] },
                  { at: [-6, -3], group: { grunt: 2, lancer: 1, blaster: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 16, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },
      { kind: 'escort', title: 'GET THE CRAWLER HOME', start: [-6, 4, 0],
        say: { jedi: 'A storm off the dunes. You will not see them until they are close, and neither will it. Stay right by the crawler.',
               mando: 'Storm\'s coming in. You won\'t see them till they\'re on it. Stay right on the crawler.' },
        task: { jedi: 'Get the crawler to the freighter through the storm', mando: 'Get the crawler to the freighter through the storm' },
        twist: { kind: 'sandstorm', at: 3, ramp: 8, near: 3, far: 22,
                 line: { jedi: 'The storm is on us. Stay by the crawler. They will come out of it close.',
                         mando: 'Storm\'s here. Stay on the crawler. They\'ll come out of it close.' } },
        path: [[-10, 2], [-4, 12], [0, 22], [0, 36], [4, 44]],
        speed: 2.3, leash: 12, threat: 6, dps: 4.5, regen: 2, aggro: 7,
        ambush: [ { at: [-4, 12], group: { grunt: 2, bomber: 1, blaster: 1 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [0, 26], group: { grunt: 2, officer: 1, flyer: 1 }, from: [Math.PI - 0.6, Math.PI + 0.6] },
                  { at: [1, 38], group: { grunt: 1, duelist: 1, blaster: 2 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 13, cap: 8, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'duel', title: 'DEFEAT THE SALVAGE MASTER', start: [4, 44, Math.PI],
        say: { jedi: 'The hunter who runs these crews has come to take the cores back. Its staff hits from both ends. Watch both.',
               mando: 'Their salvage master wants the cores back. It fights with a staff. Break its guard and it breaks.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'duelist', name: 'THE SALVAGE MASTER', hp: 4.5, dmg: 1.2, scale: 1.09, tint: 0x9a6a3a, at: [2, 34],
        duel: { block: 0.7, posture: 150, feint: 0.4, chain: 2, counter: 0.5 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.4, chain: 3, thrust: 0.25 } },
    ],
    done: { jedi: 'The cores are aboard, and a holocron with them. Every route they remember ends on Mustafar.',
            mando: 'The cores are aboard. Every route ends at the Magistrate\'s forge on Mustafar. This is the Way.' },
  },

  // LOTHAL: an escort, on the far side of the Grass Sea from SPEARHEAD's push. The slicer droid has what it came for
  // inside the outpost; walk it out up the east flank to the landing field, hold the pad until the shuttle is down,
  // then face the shield captain who followed you out.
  grassland: {
    id: 'grassland',
    title: 'THE EXTRACTION',
    blurb: 'walk a slicer droid out under fire, hold the landing pad',
    level: { ...BATTLE_MAPS.grassland.level, name: 'MISSION — THE EAST FLANK OF LOTHAL',
             sub: { jedi: 'The droid carries the outpost\'s prison codes. Get it to the shuttle.',
                    mando: 'The droid carries the outpost\'s cell codes. Get it to the ship.' } },
    start: [52, -42, 0],   // outside the outpost's east wall, just behind the droid, looking north up the flank
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 2,
    // who you walk across the field (built like a squadmate: allies/squad.js looks, enemies/mesh.js MODELS)
    escort: { jedi: { model: 'b1', name: 'RX-4', kicker: 'SLICER DROID', color: 0x7f93ae, eye: 0x5ad2ff, scale: 0.9, hp: 320 },
              mando: { model: 'b1', name: 'SCRAP', kicker: 'SLICER DROID', color: 0x9a7a4e, eye: 0xffa040, scale: 0.9, hp: 320 } },
    objectives: [
      { kind: 'escort', title: { jedi: 'ESCORT RX-4', mando: 'ESCORT SCRAP' },
        say: { jedi: 'RX-4 carries the outpost\'s cell codes: no droid, no breakout. It will not walk into blaster fire on its own. Stay close and keep the troops off it. Clear them and it walks on.',
               mando: 'Scrap has the cell codes. No droid, no breakout. It won\'t move if you\'re not with it, and it won\'t move under fire. Keep them off it.' },
        task: { jedi: 'Stay near the droid and keep foes off it', mando: 'Stay near the droid and keep foes off it' },
        twist: { kind: 'minefield', mines: [[54, -31], [46, -28], [53.2, -22], [45.5, -17], [52.8, -13], [44.5, -11], [53.5, -6], [46, -3], [51.8, 1.5]], see: 7, trip: 1.4, r: 3, dmg: 22, foeDmg: 80,
                 line: { jedi: 'RX-4 has found a mine. The field is sown with them, and it marks each one it passes. Stay on its track, and lure them over the marks.', mando: 'Scrap found a mine. Field\'s full of them. Stay on its track. Let them charge across the marks.' } },
        path: [[51, -36], [49, -24], [49, -10], [49, 4]],
        speed: 2.6, leash: 15, threat: 6, dps: 4, regen: 3, aggro: 7,
        ambush: [ { at: [49, -30], group: { grunt: 2, blaster: 2 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [49, -16], group: { grunt: 2, lancer: 1, grenadier: 1 }, from: [Math.PI - 0.6, Math.PI + 0.6] },
                  { at: [49, -2], group: { grunt: 2, blaster: 1, officer: 1, flyer: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 16, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'escort', title: { jedi: 'ESCORT RX-4', mando: 'ESCORT SCRAP' }, start: [52, 0, 0],
        say: { jedi: 'Up the flank to the landing field. They will throw shields in front of it: break them, or go around.',
               mando: 'Last stretch to the landing field. Shield troopers ahead. Break them or flank them.' },
        task: { jedi: 'Get the droid to the landing field', mando: 'Get the droid to the landing field' },
        path: [[49, 4], [49, 20], [48, 31], [34, 36], [34, 44], [14, 50]],
        speed: 2.4, leash: 15, threat: 6, dps: 4.5, regen: 3, aggro: 7,
        ambush: [ { at: [49, 12], group: { grunt: 2, phalanx: 1, blaster: 1 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [48, 30], group: { grunt: 2, sniper: 1, grenadier: 1 }, from: [Math.PI - 0.6, Math.PI + 0.6] },
                  { at: [34, 42], group: { grunt: 2, bomber: 1, blaster: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 15, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'hold', title: 'HOLD THE LANDING PAD', music: 'defend', start: [10, 46, Math.PI],
        say: { jedi: 'The shuttle is inbound to fly the codes to the breakout team. Hold the pad until it is down. They will come over the sandbags.',
               mando: 'Ship\'s inbound for the codes. Hold the pad till it lands. They\'re coming over the sandbags.' },
        task: { jedi: 'Hold the landing pad until the shuttle lands', mando: 'Hold the landing pad until the ship lands' },
        at: [8, 52], r: 7, time: 45, awayRate: 0.35, squadRate: 0.55, holding: 'SHUTTLE INBOUND',
        overrun: 'CLEAR THE PAD', unguarded: 'PAD UNGUARDED', doneLine: 'THE SHUTTLE IS DOWN', doneSub: 'Someone followed you out.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, officer: 1, blaster: 1 }, { grunt: 2, lancer: 1, grenadier: 1 },
                  { grunt: 2, flyer: 1, blaster: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 9, from: [-Math.PI + 0.3, -0.3], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE OUTRIDER', start: [8, 50, Math.PI],
        say: { jedi: 'The outpost sent its outrider after the codes. It closes fast with that lance and lunges from range. Sidestep the charge, then make it pay.',
               mando: 'Their outrider\'s on us. Lance, and a lunge that covers ground. Don\'t stand in its line. Make it miss, then hit it.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds', trooper: 'Win the duel while the band holds' },
        enter: { jedi: 'Something comes over the sandbags at a run, lance first.', mando: 'Something comes over the sandbags at a run, lance first.' },
        foe: 'lancer', name: 'THE OUTRIDER', hp: 4.5, dmg: 1.15, scale: 1.15, tint: 0x6a7a3a, at: [6, 36],
        duel: { feint: 0.35, chain: 2, counter: 0.45 },
        rage: 0.5, rageDuel: { feint: 0.45, delay: 0.4, chain: 3 },
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The droid is aboard and the codes with it. The prisoners will walk free. Well done.',
            mando: 'The droid is aboard and the codes with it. The cells open tonight. This is the Way.' },
  },
  // THE LOTHAL BREAKOUT: the same field and droid as the Extraction, the other way round. Walk the slicer droid in to
  // the outpost, open its cell blocks, hold the gate while the prisoners run, and meet the captain who held the keys.
  breakout: {
    id: 'breakout',
    title: 'THE LOTHAL BREAKOUT',
    blurb: 'walk a slicer droid into the outpost, open the cells, hold the gate',
    level: { ...BATTLE_MAPS.grassland.level, name: 'MISSION — THE OUTPOST ON LOTHAL',
             sub: { jedi: 'The Acrobat is in a cell behind that wall. The droid has the codes.',
                    mando: 'The ace is in a cell behind that wall. The droid has the codes.' } },
    start: [49, 14, Math.PI],   // up the east flank, behind the droid, looking south at the outpost
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 2,
    escort: { jedi: { model: 'b1', name: 'RX-4', kicker: 'SLICER DROID', color: 0x7f93ae, eye: 0x5ad2ff, scale: 0.9, hp: 320 },
              mando: { model: 'b1', name: 'SCRAP', kicker: 'SLICER DROID', color: 0x9a7a4e, eye: 0xffa040, scale: 0.9, hp: 320 } },
    objectives: [
      { kind: 'escort', title: { jedi: 'GET RX-4 TO THE GATE', mando: 'GET SCRAP TO THE GATE' },
        say: { jedi: 'RX-4 carries the outpost\'s cell codes. It will not walk into blaster fire on its own: stay close, clear the troops, and it walks on. The east gate first.',
               mando: 'Scrap has the cell codes. It won\'t move under fire, so keep them off it. East gate.' },
        task: { jedi: 'Stay near the droid and keep foes off it', mando: 'Stay near the droid and keep foes off it' },
        path: [[49, 10], [49, -6], [48, -20], [47, -36], [22, -38], [20, -46]],
        speed: 2.6, leash: 15, threat: 6, dps: 4, regen: 3, aggro: 7,
        ambush: [ { at: [49, -4], group: { grunt: 2, blaster: 2 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [48, -22], group: { grunt: 2, lancer: 1, grenadier: 1, phalanx: 1 }, from: [-Math.PI + 0.4, -0.4] },
                  { at: [30, -37], group: { grunt: 2, blaster: 1, officer: 1, flyer: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 16, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'sabotage', title: 'OPEN THE CELL BLOCKS', consoleName: 'CELL BLOCK', consoleDone: 'OPEN', doneLine: 'THE CELLS ARE OPEN', doneSub: 'The prisoners are running for the gate.', start: [20, -44, Math.PI],
        say: { jedi: 'We are in. Three cell blocks, three door panels. Stand at each while RX-4 feeds it the codes.',
               mando: 'Three cell blocks. Stand at each panel while Scrap feeds it the codes. Don\'t let them pull you off it.' },
        task: { jedi: 'Stand at each cell block\'s panel to open it', mando: 'Stand at each cell block\'s panel to open it' },
        twist: { kind: 'searchlight', beams: [ { from: [-44, 14, -70], c: [-14, -52], a: [18, 7], period: 13, ph: 0 }, { from: [44, 14, -70], c: [16, -56], a: [18, 8], period: 11, ph: 2 } ],
                 r: 3.2, cool: 6, group: { grunt: 2, blaster: 1 },
                 line: { jedi: 'Searchlights from the towers. Caught in a beam, the panel loses ground and the guard comes running. Work in the dark.', mando: 'Searchlights. Get caught in one and the panel slips back and the guard comes. Let it pass.' } },
        consoles: [ { at: [30, -58], guards: { grunt: 2, blaster: 1 } },
                    { at: [-32, -52], guards: { grunt: 2, lancer: 1, blaster: 1 } },
                    { at: [0, -64], guards: { phalanx: 1, grunt: 2, officer: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 15, cap: 6, group: { grunt: 1, blaster: 1 } } },

      { kind: 'hold', title: 'HOLD THE GATE', music: 'defend', start: [0, -42, 0],
        say: { jedi: 'The prisoners are running for the middle gate. Stay with them, between them and the guards, until the last of them is out. The Acrobat is among them.',
               mando: 'They\'re running for the middle gate. Stay on them and keep the guards off till the last one\'s out. The ace is in there somewhere.' },
        task: { jedi: 'Guard the prisoners out through the gate', mando: 'Guard the prisoners out through the gate' },
        at: [0, -40], r: 7, time: 45, awayRate: 0.35, squadRate: 0.55,
        evacuees: { kind: 'prisoner', count: 14, spacing: 1.5, speed: 3, ramp: false, verb: 'OUT', name: { jedi: 'PRISONERS', mando: 'PRISONERS' },
                    path: [[6, -51], [5, -45], [1, -40], [0, -30], [-2, -16]] },
        overrun: 'CLEAR THE GATE', unguarded: 'GATE UNGUARDED', doneLine: 'EVERY CELL IS EMPTY', doneSub: 'The last one out walked, not ran.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, officer: 1, blaster: 1 }, { grunt: 2, lancer: 1, grenadier: 1 },
                  { grunt: 2, flyer: 1, blaster: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 9, from: [-Math.PI + 0.3, -0.3], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE SHIELD CAPTAIN', start: [0, -38, Math.PI],
        say: { jedi: 'The outpost\'s captain held the keys to those cells, and it wants its prisoners back. It fights behind a riot shield. Go around it, or break it with the Force.',
               mando: 'The captain wants its prisoners back. Riot shield, stun baton. Get behind it, or blow it off its feet.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds', trooper: 'Win the duel while the band holds' },
        foe: 'phalanx', name: 'THE SHIELD CAPTAIN', hp: 4, dmg: 1.2, scale: 1.22, tint: 0x5a6472, at: [8, -47],
        duel: { posture: 130, feint: 0.3, chain: 2, counter: 0.45 },
        rage: 0.5, rageDuel: { feint: 0.45, delay: 0.4, chain: 3 },
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The cells are empty and the Acrobat is free. It has not said thank you. It will want to test you instead.',
            mando: 'The cells are empty and the ace is out. It wants a word with whoever came for it. This is the Way.' },
  },
  // THE PENS ON TESSARIL (the Jedi's Act II): the Inquisitors' prison moon, where the children taken off the Ledger's
  // list are held until the ships come. Walk the slicer droid in from the pad, open the three cell blocks, hold the gate
  // while the children run for the ship, then the Warden who keeps them. The breakout's plan on a world of its own.
  pens: {
    id: 'pens',
    title: 'THE PENS ON TESSARIL',
    blurb: 'walk a slicer droid into the prison moon, open the cells, get the children to the ship',
    story: 'campaign', act: 1, order: 4.5,   // (the Missions page: with the Lothal chapter, which the Jedi plays here)
    level: { name: 'MISSION — THE PENS ON TESSARIL', sub: { jedi: 'An Inquisitor prison moon. The children are behind that wall.', mando: 'A prison moon. The kids are behind that wall.' },
             arena: 84, floor: 0x3a3c44, fog: 0x2a3042, sky: 0x05070e, layout: 'pens', waves: [], hazards: {} },
    start: [3, 31, Math.PI],   // on the pad, behind the droid, looking north at the prison
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 2,
    escort: { jedi: { model: 'b1', name: 'RX-4', kicker: 'SLICER DROID', color: 0x7f93ae, eye: 0x5ad2ff, scale: 0.9, hp: 320 },
              mando: { model: 'b1', name: 'SCRAP', kicker: 'SLICER DROID', color: 0x9a7a4e, eye: 0xffa040, scale: 0.9, hp: 320 } },
    objectives: [
      { kind: 'escort', title: { jedi: 'GET RX-4 TO THE GATE', mando: 'GET SCRAP TO THE GATE' },
        say: { jedi: 'RX-4 carries the prison\'s cell codes. It will not walk into blaster fire on its own: stay close, clear the guards, and it walks on. Round the rocks to the gate.',
               mando: 'Scrap has the cell codes. It won\'t move under fire, so keep them off it. Round the rocks, then the gate.' },
        task: { jedi: 'Stay near the droid and keep foes off it', mando: 'Stay near the droid and keep foes off it' },
        path: [[0, 27], [-14, 20], [-24, 7], [-18, -4], [0, -6], [0, -16]],
        speed: 2.8, leash: 17, threat: 6, dps: 4, regen: 3, aggro: 7,
        ambush: [ { at: [-14, 19], group: { grunt: 2, blaster: 2 }, from: [Math.PI - 0.5, Math.PI + 0.4] },
                  { at: [-24, 4], group: { grunt: 2, lancer: 1, grenadier: 1, phalanx: 1 }, from: [Math.PI - 0.3, Math.PI + 0.6] },
                  { at: [-9, -6], group: { grunt: 2, blaster: 1, officer: 1, flyer: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 16, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [Math.PI - 0.4, Math.PI + 0.5] },   // (one fewer since the scale pass, so the canyon doesn't clog)

      { kind: 'sabotage', title: 'OPEN THE CELL BLOCKS', consoleName: 'CELL BLOCK', consoleDone: 'OPEN', doneLine: 'THE CELLS ARE OPEN', doneSub: 'The children are coming out.', start: [0, -16, Math.PI],
        say: { jedi: 'We are through the wall. Three cell blocks, three door panels. Stand at each while RX-4 feeds it the codes.',
               mando: 'Three cell blocks. Stand at each panel while Scrap feeds it the codes. Don\'t let them pull you off it.' },
        task: { jedi: 'Stand at each cell block\'s panel to open it', mando: 'Stand at each cell block\'s panel to open it' },
        consoles: [ { at: [-26, -27.2], guards: { grunt: 2, blaster: 1 } },
                    { at: [26, -27.2], guards: { grunt: 2, lancer: 1, blaster: 1 } },
                    { at: [0, -33.2], guards: { phalanx: 1, grunt: 2, officer: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 15, cap: 5, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.3, -0.3] },

      { kind: 'hold', title: 'HOLD THE GATE', music: 'defend', start: [0, -4, 0],
        say: { jedi: 'The children are running for the ship. Stay with them, and keep everything off them until the last one is through the gate.',
               mando: 'The kids are running for the ship. Stay with them and keep them covered till the last one\'s through the gate.' },
        task: { jedi: 'Guard the children out through the gate', mando: 'Guard the children out through the gate' },
        at: [0, -5], r: 8, time: 45, awayRate: 0.35, squadRate: 0.55,
        evacuees: { kind: 'youngling', count: 14, spacing: 1.5, speed: 2.6, ramp: false, verb: 'OUT', name: { jedi: 'CHILDREN', mando: 'CHILDREN' },
                    path: [[0, -32], [0, -20], [0, -6], [-6, 2], [-12, 9]] },   // (out through the gate, toward the ship on the pad)
        overrun: 'CLEAR THE GATE', unguarded: 'GATE UNGUARDED', doneLine: 'EVERY CELL IS EMPTY', doneSub: 'The last of them is running for the ship.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, officer: 1, blaster: 1 }, { grunt: 2, lancer: 1, grenadier: 1 },
                  { grunt: 2, flyer: 1, blaster: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 9, from: [Math.PI * 0.75, Math.PI * 1.15], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE WARDEN', start: [0, -4, Math.PI],
        say: { jedi: 'The Warden of the pens. An Inquisitor who never hunted: it only kept what the others caught. It will not let them go easily.',
               mando: 'The Warden. Red blade, and it thinks those kids are its property. Show it otherwise.' },
        task: { jedi: 'Win the duel while the squad holds', mando: 'Win the duel while the clan holds', trooper: 'Win the duel while the band holds' },
        twist: { kind: 'cage', at: [0, -7], r0: 20, r1: 10, over: 70, dmg: 10,
                 line: { jedi: 'It has shut the pens around you both, and the field is closing. Do not let it pin you to the wall.', mando: 'It\'s shut the pen on us and the fence is closing in. Don\'t get backed into it.' } },
        enter: { jedi: 'The Warden walks out of the gate, its blade already lit.', mando: 'The Warden comes out of the gate.' },
        line: { jedi: 'Every one of them is on my list. I will have them back.', mando: 'Those are mine.' },
        foe: 'acolyte', form: 'djemso', name: 'THE WARDEN', hp: 4, dmg: 1.1, scale: 1.06, tint: 0x8a2a30, at: [0, -15],
        duel: { posture: 150, feint: 0.3, chain: 2, counter: 0.45 },
        rage: 0.5, rageDuel: { feint: 0.45, delay: 0.4, chain: 3 },
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The cells on Tessaril are empty, and the ship is full of children. Sera Quill walked out last.',
            mando: 'The cells are empty and the ship is full. This is the Way.' },
  },
  // THE TRIAL OF SERA QUILL (the Jedi's Act II): the trial of the Acrobat, in the yard of the prison moon she was freed from
  'trial-sera': {
    id: 'trial-sera', trial: true, heroes: ['jedi'],
    title: 'TRIAL OF SERA QUILL',
    blurb: 'the master you freed wants to see what you are',
    level: { name: 'TRIAL — THE PENS ON TESSARIL', sub: 'Sera Quill is free, and restless.',
             arena: 84, floor: 0x3a3c44, fog: 0x2a3042, sky: 0x05070e, layout: 'pens', waves: [], hazards: {} },
    start: [0, 6, Math.PI],   // outside the prison wall, in the open ground before the gate
    kit: 5,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'duel', title: 'KEEP UP WITH SERA', music: 'duel',
        say: 'She strikes from the air and is gone before you answer. Catch the landing, then punish her while she breathes.',
        task: 'Win the trial',
        enter: 'Sera drops off the prison wall and lands without a sound.', kicker: 'TRIAL',
        line: 'Too slow. Again.',
        foe: 'acolyte', form: 'ataru', name: 'SERA QUILL', hp: 3.6, dmg: 1.0, scale: 1.0, tint: 0x3ad28a, at: [0, -5],
        duel: { feint: 0.4, chain: 3, counter: 0.4 },
        rage: 0.5, rageDuel: { chain: 3, delay: 0.3, feint: 0.45 } },   // (BALANCE: a master's Ataru already strings long: the rage was chain 4)
    ],
    done: 'Sera laughs for the first time in a year. She will come.',
  },
  // THE LAST LESSON (the Jedi's prologue): the temple dojo on Jedha, the night before the siege. A practice duel with
  // Ilsa Venn, who will open the temple gate to the Empire before morning. Short, low stakes, and it teaches the duel.
  'last-lesson': {
    id: 'last-lesson',
    title: 'THE LAST LESSON',
    campaignOnly: true, heroes: ['jedi'],
    blurb: 'spar with Ilsa the night before the siege',
    level: { name: 'PROLOGUE — THE TEMPLE DOJO', sub: 'Jedha. The night before.',
             arena: 60, floor: 0x6a3020, fog: 0x2a1a14, sky: 0x1a0e0a, layout: 'dojo', waves: [], hazards: {} },
    start: [0, 8, Math.PI],
    kit: 1,
    grant: { jedi: [], mando: [] },
    objectives: [
      { kind: 'duel', title: 'SPAR WITH ILSA', music: 'duel',
        say: 'Training blades, first to yield. Ilsa is faster than you and knows it. Block her chain, then answer when she overreaches.',
        task: 'Win the sparring match',
        enter: 'Ilsa thumbs her training blade to life.', kicker: 'SPARRING',
        line: 'Guard up. You always drop it when you are tired.',
        foe: 'acolyte', form: 'djemso', name: 'ILSA VENN', hp: 2, dmg: 0.45, scale: 1.0, tint: 0x4a7ad2, at: [0, -4],
        duel: { feint: 0.25, chain: 2, counter: 0.3 } },
    ],
    done: 'Ilsa yields, laughing. It is the last time you will hear her laugh for a long while.',
  },
  // RETURN TO JEDHA (the Jedi's Act III): the burned temple at night. Under the dais is an old Sith gate, Vexis's own road
  // to Exegol. Take the courtyard from the Inquisitors' garrison, hold the dais while the gate wakes, then face what it shows you.
  'jedha-night': {
    id: 'jedha-night',
    title: 'RETURN TO JEDHA',
    campaignOnly: true, heroes: ['jedi'],
    blurb: 'open the old Sith gate under the burned temple',
    level: { name: 'MISSION — RETURN TO JEDHA', sub: 'The temple, burned and empty. Something under it is awake.',
             arena: 56, floor: 0x3a3440, fog: 0x1a1626, sky: 0x08060e, layout: 'jedhaNight', waves: [], hazards: {} },
    start: [0, 18, Math.PI],   // up the pilgrim steps, looking north at the dais
    kit: 6,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 2,
    objectives: [
      // INFILTRATE (game/infiltrate.js): the garrison hasn't seen you. Break the seals before it does
      { kind: 'infiltrate', title: 'BREAK THE SEALS', markName: 'SEAL', markDone: 'BROKEN',
        doneLine: 'THE SEALS ARE BROKEN', quiet: ['THE SEALS ARE BROKEN', 'The garrison never knew you were here.'],
        say: 'The Inquisitors left a garrison walking the courtyard, and three seals on the gate. They have not seen you. Break the seals before they do. The squad waits on the steps.',
        task: 'Break each seal without being seen',
        marks: [ { at: [-15, 4] }, { at: [15, 4] }, { at: [0, -16] } ], time: 3, r: 2.2,
        guards: [ { type: 'blaster', path: [[-20, -2], [-20, 10]] },
                  { type: 'blaster', path: [[20, 10], [20, -2]], pause: 2.2 },
                  { type: 'grunt', path: [[-9, -13], [9, -13]] },
                  { type: 'lancer', at: [0, 9], face: Math.PI, sweep: 1.1, period: 7 } ],
        lights: [ { from: [0, 16, -34], c: [0, -2], a: [16, 9], period: 15, ph: 0.6, r: 3.2 } ],
        alarm: { group: { grunt: 2, blaster: 2, lancer: 1 }, at: [[-16, -22], [16, -22]], line: 'The garrison knows. Break the seals anyway.',
                 trickle: { every: 12, cap: 7, group: { grunt: 1, blaster: 1 } } } },

      { kind: 'hold', title: 'HOLD THE DAIS', music: 'defend', holding: 'THE GATE IS WAKING',
        say: 'The gate is waking. Hold the dais until it opens, and keep off the summit while it burns.',
        task: 'Stay by the dais until the gate opens',
        twist: { kind: 'pulse', at: [0, 0], r0: 4.2, every: [9, 5], spd: [7, 10.5], len: 30, w: 0.75, dmg: 14, foeDmg: 30, first: 5,
                 line: all('The gate breathes out. Each ring runs along the ground: jump it as it reaches you.') },
        at: [0, 0], r: 7, time: 40, awayRate: 0.35, squadRate: 0.55,
        overrun: 'CLEAR THE DAIS', unguarded: 'DAIS UNGUARDED', doneLine: 'THE GATE IS OPEN', doneSub: 'Something steps out of it.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, lancer: 1, grenadier: 1 }, { grunt: 2, officer: 1, flyer: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 8, from: [-Math.PI, Math.PI], aggro: 8 },

      { kind: 'duel', title: 'FACE THE ECHO', music: 'duel',
        say: 'The gate shows you something with a blade. It is not real. Its strikes are.',
        task: 'Win the duel',
        enter: 'A shape of violet light steps down from the dais.', kicker: 'THE GATE',
        line: 'You came back to where it started. So did I.',
        foe: 'acolyte', form: 'djemso', name: 'THE ECHO', hp: 4, dmg: 1.15, scale: 1.05, tint: 0x6a4ad2, at: [0, -6],
        duel: { posture: 150, feint: 0.35, chain: 3, counter: 0.45 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.35, chain: 4 },
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: 'The echo is gone. The gate under Jedha stands open, and on the other side of it is Exegol.',
  },
  // VAEL'S CHAINS (the Jedi's Act III, before the throne): the Citadel's amphitheatre on Exegol. Break the chains holding
  // Master Vael, hold the floor while the children Vexis took from the Ember Academy run for the gate, then his Grand
  // Inquisitor. With Ilsa spared she breaks one chain herself ('chains'); without her it is all yours ('chains-alone').
  chains: {
    id: 'chains',
    title: 'VAEL\'S CHAINS',
    campaignOnly: true, heroes: ['jedi'],
    blurb: 'free Master Vael and the children before the throne',
    level: { name: 'MISSION — THE CITADEL ON EXEGOL', sub: 'Vael is chained before the throne. The children are in the stands.',
             arena: 64, floor: 0x3b2f31, fog: 0x401a22, sky: 0x1a080c, layout: 'sith', waves: [], hazards: {} },
    start: [0, 16, Math.PI],   // in at the south gate, looking north at the throne
    kit: 7,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    squad: 2,
    objectives: [
      { kind: 'sabotage', title: 'BREAK VAEL\'S CHAINS', consoleName: 'CHAIN', consoleDone: 'BROKEN', doneLine: 'VAEL IS FREE', doneSub: 'He can barely stand. He stands anyway.', music: 'battle',
        say: 'Ilsa has the left chain. Break the other two. Stand at each anchor until it gives.',
        task: 'Stand at each chain anchor to break it',
        consoles: [ { at: [16, -24], guards: { grunt: 2, lancer: 1, blaster: 1 } },   // (east of the throne: the map-size pass spread the chains out)
                    { at: [0, -21], guards: { phalanx: 1, grunt: 2, officer: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 14, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.3, -0.3] },

      { kind: 'hold', title: 'GET THE CHILDREN OUT', music: 'defend', start: [0, -4, Math.PI],
        say: 'The children Vexis took from the academy are running for the gate. Stay with them, and keep everything off them until the last one is through.',
        task: 'Guard the children out to the gate',
        twist: { kind: 'vael', path: [[2, -18], [2, -8], [1.5, 0], [1.5, 7]], who: 'MASTER VAEL',
                 line: all('Vael will not go ahead of the children. He walks out behind them, and your stand walks with him.') },
        at: [0, -6], r: 7, time: 45, awayRate: 0.35, squadRate: 0.55,
        evacuees: { kind: 'youngling', count: 14, spacing: 1.5, speed: 2.6, ramp: false, verb: 'OUT', name: { jedi: 'CHILDREN', mando: 'CHILDREN' },
                    path: [[0, -22], [0, -12], [0, -2], [0, 8]] },
        overrun: 'CLEAR THE FLOOR', unguarded: 'FLOOR UNGUARDED', doneLine: 'THE CHILDREN ARE OUT', doneSub: 'Kast\'s troopers have them at the gate.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, lancer: 1, grenadier: 1 }, { grunt: 2, officer: 1, flyer: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        // (the children run up the middle of the floor from the throne: the troops come down off the stands either side)
        every: [8, 12], cap: 9, from: [-0.8, 0.8], lanes: [[-0.8, 0.8], [Math.PI - 0.8, Math.PI + 0.8]], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE GRAND INQUISITOR', music: 'duel', start: [0, -4, Math.PI],
        say: 'His Grand Inquisitor. Every hunter who came for the children answered to it. It answers to you now.',
        task: 'Win the duel while the squad holds',
        enter: 'The Grand Inquisitor comes down off the dais, both blades spinning.', kicker: 'THE CITADEL',
        line: 'Every name in that Ledger was mine to collect.',
        foe: 'acolyte', form: 'djemso', name: 'THE GRAND INQUISITOR', hp: 4.3, dmg: 1.12, scale: 1.11, tint: 0x8a1a22, at: [0, -18],   // (BALANCE: was 4.5 / 1.2)
        duel: { posture: 170, feint: 0.35, chain: 3, counter: 0.5 },
        rage: 0.5, rageDuel: { feint: 0.4, delay: 0.3, chain: 3 },   // (BALANCE: was feint 0.5, chain 4, then 0.42: the finale's hardest duel, not its unfairest)
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: 'Vael is free and the children are out. Only Vexis is left.',
  },
  // THE MUSTAFAR FORGE: the forge floor of the second campaign level, broken for good. Charges on its three feeds,
  // hold the lane out while they burn, then the forge's master comes for whoever lit them.
  forge: {
    id: 'forge',
    title: 'THE MUSTAFAR FORGE',
    blurb: 'charge the forge\'s feeds, hold while they burn, face its master',
    level: { ...LEVELS[1], name: 'MISSION — THE MUSTAFAR FORGE', sub: { jedi: 'His war machines are forged here. Break the forge.', mando: 'Our beskar, melted down for his machines. Tear it down.' },
             waves: [], hazards: {} },
    start: [0, 17, Math.PI],   // the north lane, looking down the forge floor at the smelter
    kit: 7,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'sabotage', title: 'CHARGE THE FORGE', consoleName: 'CHARGE', doneLine: 'CHARGES SET', doneSub: 'Now get clear of it.',
        say: { jedi: 'Three feeds carry the ore into the forge: the smelter\'s and the two catwalks\'. Set a charge on each. Mind the channels: the lava rises on a cycle.',
               mando: 'Three feeds into the forge. Charge every one. Keep off the channels when they glow.' },
        task: { jedi: 'Stand at each feed to set a charge', mando: 'Stand at each feed to set a charge' },
        consoles: [ { at: [-13.8, 4.2], guards: { grunt: 2, blaster: 2, duelist: 1 } },
                    { at: [13.8, -4.2], guards: { grunt: 2, lancer: 1, grenadier: 1 } },
                    { at: [0, -5], guards: { phalanx: 1, grunt: 2, officer: 1, bomber: 1 } } ],
        time: 4.5, r: 2.4, hitLoss: 1.2,
        trickle: { every: 14, cap: 7, group: { grunt: 1, blaster: 1, flyer: 1 } } },

      // the charges are on a clock (it runs whether you stand in the zone or not: only a foe in it with you away stops
      // it), and the floor floods with heat from the south as it runs: the hold falls back up the north lane ahead of it
      { kind: 'hold', title: 'HOLD THE WAY OUT', music: 'battle', start: [0, -4, Math.PI],
        say: { jedi: 'The charges are on a clock. Keep the guard off them, and fall back up the lane to the ships as the heat comes.',
               mando: 'Charges are lit. Hold the lane till they go. Nobody gets near them.' },
        task: { jedi: 'Hold each stand, and fall back ahead of the heat', mando: 'Hold each stand, and fall back ahead of the heat' },
        at: [0, 14], r: 6, time: 40, awayRate: 1, holding: 'CHARGES ON THE CLOCK',
        overrun: 'THEY\'RE AT THE CHARGES', unguarded: 'CHARGES ON THE CLOCK', doneLine: 'THE FORGE GOES UP', doneSub: 'Every mould on Mustafar is slag.',
        twist: { kind: 'heat', zones: [[0, -10], [0, 6.5], [0, 14]], steps: [0.3, 0.65], fronts: [-40, -17, -0.5, 7.5], dps: 14, foeDps: 8,
                 line: { jedi: 'The charges are on a clock, and the floor floods behind them. Fall back with the line. It burns anything it catches.',
                         mando: 'Charges are on the clock and the floor\'s going molten. Fall back with the line. Don\'t get caught behind it.' } },
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, brute: 1 }, { grunt: 2, sniper: 1, blaster: 1 },
                  { grunt: 2, lancer: 1, bomber: 1 }, { grunt: 2, duelist: 1, officer: 1 } ],
        every: [8, 12], cap: 9, from: [-Math.PI + 0.3, -0.3], aggro: 8 },

      { kind: 'duel', title: 'DEFEAT THE FORGEMASTER', start: [0, 12, Math.PI],
        say: { jedi: 'The forge\'s master comes out of the smoke. It is built like the machines it made. Read the swing, then punish it.',
               mando: 'The forgemaster. It melted our beskar with its own hands. Don\'t trade blows. Make it miss, then hit it.' },
        task: { jedi: 'Win the duel', mando: 'Win the duel' },
        foe: 'brute', name: 'THE FORGEMASTER', hp: 3.6, dmg: 1.2, scale: 1.35, tint: 0xff7a1e, at: [0, -12],
        rage: 0.45, trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: { jedi: 'The forge is ash. But it fell too easily. This was never his army.',
            mando: 'The forge is ash, and it was too easy. This was bait.' },
  },
  // THE NIGHT OF THE ORDER: the ARC trooper's prologue, eight years before the campaign. A jungle firebase at
  // night; the order has come, the company has turned, and the trooper and two brothers who refused it get their
  // wounded General out. Campaign only (the trooper's first chapter, data/campaign.js); one voice for every hero, so a
  // co-op partner of any kind hears the same story. The foes wear the turned company's armour (`foeLook`).
  order66: {
    id: 'order66',
    title: 'THE NIGHT OF THE ORDER',
    campaignOnly: true,
    blurb: 'get the General out when the company turns',
    level: { name: 'MISSION — THE NIGHT OF THE ORDER', sub: all('Eight years ago. The order came at midnight.'),
             arena: 84, floor: 0x34442a, fog: 0x18302a, sky: 0x070c18, layout: 'jungle', waves: [], hazards: {} },
    start: JUNGLE_SPOTS.start,   // the ruin's courtyard, where the General fell back, looking south at the firebase
    kit: 2,
    grant: all([]),
    squad: 2, squadCap: 2,       // VANT and BRISK: the two who refused it with you (and no more: the trooper's run tops up to its own size)
    foeLook: TURNED,
    escort: all({ model: 'officer', name: 'GENERAL KAST', kicker: 'JEDI · WOUNDED', color: 0x8a7458, eye: 0x5ad2ff, cloth: 0x5a4030, hp: 360,
                 person: { fem: true, cap: false, face: { skin: 0xc49a7c, hair: 0x5a4a3a, style: 'bun', fem: true, scar: true } } }),   // General Rhenna Kast: the Knight of the Jedi's Hoth chapter, years later (her face as saber-cast.js has it, hair not yet grey)
    objectives: [
      { kind: 'sabotage', title: 'CUT THE COMPANY\'S COMMS', consoleName: 'RELAY', consoleDone: 'CUT',
        doneLine: 'THE RELAYS ARE DOWN', doneSub: 'No gunship will find the General tonight.', music: 'battle',
        say: all('They turned on the General mid-sentence, brother. Our own company. Their relays are calling the gunships down on that ruin. Cut both.'),
        task: all('Stand at each relay console to cut it'),
        consoles: [ { at: JUNGLE_SPOTS.relays[0], guards: { blaster: 3 } },
                    { at: JUNGLE_SPOTS.relays[1], guards: { blaster: 2, grenadier: 1 } } ],
        time: 4, r: 2.4, hitLoss: 1.0,
        trickle: { every: 15, cap: 6, group: { blaster: 2 } } },

      { kind: 'escort', title: 'GET THE GENERAL OUT', start: [-11, 4, 0],
        say: all('The General can walk, barely. Through the trees to the landing zone. It will not walk into fire, so clear the way.'),
        task: all('Stay near the General and keep the company off it'),
        twist: { kind: 'marked', nests: [ { at: [-30, 8], from: 0.05 }, { at: [0, 34], from: 0.4 }, { at: [20, 28], from: 0.7 } ], aim: [5, 3], hit: 0.2, dmg: 14,
                 line: all('A sniper has her. Stand in the red line and the shot is yours, or put him down first.') },
        path: JUNGLE_SPOTS.walk,
        speed: 2.2, leash: 14, threat: 6, dps: 4, regen: 3, aggro: 7,
        ambush: [ { at: [-14, 12], group: { blaster: 2, grenadier: 1 }, from: [Math.PI - 0.6, Math.PI + 0.6] },
                  { at: [-4, 19], group: { blaster: 2, sniper: 1 }, from: [-0.6, 0.6] },
                  { at: [2, 22], group: { blaster: 2, officer: 1 }, from: [-Math.PI + 0.4, -0.4] } ],
        trickle: { every: 16, cap: 6, group: { blaster: 1, grenadier: 1 } }, from: [-Math.PI + 0.4, -0.4] },

      { kind: 'hold', title: 'HOLD THE LANDING ZONE', music: 'defend', start: [6, 24, Math.PI],
        say: all('A friend with a fast ship owes me a favour, and it is coming in dark. Hold the pad until it is down. They know where we are now.'),
        task: all('Hold the landing zone until the ship is down'),
        at: [8, 26], r: 7, time: 45, awayRate: 0.35, squadRate: 0.55, holding: 'SHIP INBOUND',
        overrun: 'CLEAR THE PAD', unguarded: 'PAD UNGUARDED', doneLine: 'THE SHIP IS DOWN', doneSub: 'And someone walks out of the trees.',
        pulses: [ { blaster: 3 }, { blaster: 2, grenadier: 1 }, { blaster: 2, officer: 1 }, { blaster: 2, sniper: 1 }, { blaster: 3, grenadier: 1 } ],
        every: [8, 12], cap: 8, from: [-Math.PI + 0.2, -0.2], aggro: 8 },

      { kind: 'duel', title: 'FACE THE MARSHAL', start: [6, 24, Math.PI],
        say: all('The Marshal. Same batch, same tank, same instructors. He is the one who gave the order to fire. Put him down, or at least make him run.'),
        task: all('Beat the Marshal while the squad holds the pad'),
        enter: all('The company falls back. One of them keeps walking.'),
        foe: 'officer', dress: MARSHAL, name: 'THE MARSHAL', kicker: 'COMMANDER · YOUR BATCH', hp: 4, dmg: 1.1, scale: 1.12, tint: 0xc9a040, at: JUNGLE_SPOTS.duel,
        line: all('Good soldiers follow orders, brother. You were the best of us.'),
        rage: 0.5, rageDuel: {},
        // he breaks off instead of falling: the trooper's campaign is where it ends
        escape: 0.3, escapeLine: all('He falls back into the trees. He will be back.'), escapeScene: 'marshal-escape',
        trickle: { every: 14, cap: 3, group: { blaster: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: all('The General is aboard, and the three of us with it. Nobody is coming to save the clones who refused. So we save each other. Starting tonight.'),
  },

  // ---------------- THE ARC TROOPER'S OWN STORY (data/campaign-trooper.js): campaign only, one voice for every hero ----------------
  // THE KILL HOUSE: the band's cover on the Vorran yards is blown and Brisk was taken in the raid. The Captain sends
  // you and Vant through the garrison block for him, door by door.
  killhouse: {
    id: 'killhouse',
    title: 'THE KILL HOUSE',
    campaignOnly: true,
    blurb: 'breach the garrison block, room by room, and bring Brisk out',
    level: { name: 'MISSION — THE KILL HOUSE', sub: all('The garrison block at the yards. Brisk is in there.'),
             arena: 80, floor: 0x4a4e52, fog: 0x1e242a, sky: 0x080a10, layout: 'garrison', waves: [], hazards: {} },
    start: GARRISON_SPOTS.start,
    kit: 3,
    grant: all([]),
    squad: 1, squadCap: 1,     // Vant goes in with you; Brisk joins when his cell is open
    foeLook: PURGE,
    objectives: [
      { kind: 'capture', title: 'TAKE THE YARD', music: 'battle', postName: 'FRONT',
        say: all('The yard first. Purge troopers on the door and a pair on the towers. Clear the front so we can stack up on it.'),
        task: all('Take the front of the block'),
        posts: [ { at: [-12, -4], guards: { grunt: 2, blaster: 2, sniper: 1 } } ],
        r: 4.5, time: 4, squadRate: 0.6, perMate: 0.3, doneLine: 'THE FRONT IS OURS', doneSub: 'Stack up on the door.',
        trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7] },
      { kind: 'breach', title: 'BREACH THE GUARD ROOM', start: [-14, -5, 0], doors: 0,
        say: all('Stack up on the door, Vant on your shoulder. Charge on the lock, then in fast. They will not see straight for a second. Use it.'),
        task: all('Stand at the door to set the charge, then clear the room'),
        door: 0, stack: GARRISON_SPOTS.stack[0], time: 2.4, fuse: 1.1, stun: 1.5,
        guards: { grunt: 2, blaster: 2 }, spots: GARRISON_SPOTS.rooms[0].spots, breachLine: 'BREACH', breachSub: 'Go, go, go.' },
      { kind: 'breach', title: 'BREACH THE INTERROGATION HALL', start: [-13, 7, Math.PI / 2], doors: 1,
        say: all('Next door, east wall. Same drill. Short bursts in there, brother; Brisk could be behind any of them.'),
        task: all('Stack up on the next door and clear the hall'),
        door: 1, stack: GARRISON_SPOTS.stack[1], time: 2.2, fuse: 1.0, stun: 1.4,
        guards: { blaster: 2, grunt: 2, officer: 1 }, spots: GARRISON_SPOTS.rooms[1].spots },
      { kind: 'breach', title: 'BREACH THE CELLS', start: [1, 7, Math.PI / 2], doors: 2,
        say: all('The cells are through there. They will have heard us coming, so they will be ready. So are we.'),
        task: all('Breach the cells and get Brisk out'),
        door: 2, stack: GARRISON_SPOTS.stack[2], time: 2.2, fuse: 1.0, stun: 1.1,
        guards: { grunt: 2, blaster: 2, grenadier: 1, officer: 1 }, spots: GARRISON_SPOTS.rooms[2].spots,
        opens: 5, joins: 1, joinAt: GARRISON_SPOTS.cell, doneLine: 'BRISK IS OUT', doneSub: 'He has opinions about the food.' },
      { kind: 'hold', title: 'HOLD FOR THE GUNSHIP', music: 'defend', start: [-12, -10, Math.PI], doors: 5, squad: 2,
        say: all('Tally is bringing the gunship in over the yard, and the garrison is waking up behind us. Hold the pad.'),
        task: all('Hold the landing pad until the gunship is down'),
        at: GARRISON_SPOTS.pad, r: 6.5, time: 40, awayRate: 0.35, squadRate: 0.55, holding: 'GUNSHIP INBOUND',
        overrun: 'CLEAR THE PAD', unguarded: 'PAD UNGUARDED', doneLine: 'THE GUNSHIP IS DOWN', doneSub: 'Everyone aboard.',
        pulses: [ { grunt: 2, blaster: 1 }, { blaster: 2, grenadier: 1 }, { grunt: 3, officer: 1 }, { blaster: 2, sniper: 1 }, { grunt: 2, blaster: 2 } ],
        every: [8, 12], cap: 8, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8], aggro: 8 },
    ],
    done: all('Brisk is aboard and the yards are behind us. They knew our faces, brother. Somebody gave them our names.'),
  },

  // WHAT THE CHIP SAYS: the HALCYON, the medical frigate that fitted the clones' chips, adrift in the Vorran system.
  // Its records core still holds every chip's file, yours and the Marshal's. The Marshal wants it wiped; so does the Empire.
  chipfiles: {
    id: 'chipfiles',
    title: 'WHAT THE CHIP SAYS',
    campaignOnly: true,
    blurb: 'take a dead frigate\'s breakers with the squad, and hold the chip files as the purge pushes harder',
    level: { name: 'MISSION — WHAT THE CHIP SAYS', sub: all('The HALCYON. Every chip it fitted, it remembers.'),
             arena: 72, floor: 0x8a8e92, fog: 0x1a1e26, sky: 0x020308, layout: 'frigate', waves: [], hazards: {} },
    start: FRIGATE_SPOTS.start,
    kit: 4,
    grant: all([]),
    squad: 2, squadCap: 2,
    foeLook: PURGE,
    objectives: [
      // the breakers: two side bays with the purge troopers already in them. Take each bay with the squad and throw it
      { kind: 'capture', title: 'RESTORE POWER', music: 'infiltrate',
        say: all('The core is dead. Two breakers in the side bays bring it back, and the purge troopers got here first: there is a shuttle on the other airlock. Take each bay with the squad. Send them in (H) and cover them, or go in together.'),
        task: all('Take both breaker bays with the squad'),
        r: 5, time: 8, squadRate: 0.6, perMate: 0.2, postName: 'BREAKER', doneLine: 'POWER RESTORED', doneSub: 'The records core is waking up.', aggro: 9,
        posts: [ { at: FRIGATE_SPOTS.breakers[0], guards: { grunt: 2, blaster: 2 } },
                 { at: FRIGATE_SPOTS.breakers[1], guards: { blaster: 2, grenadier: 1, grunt: 1 } } ],
        trickle: { every: 15, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [Math.PI / 2 - 0.6, Math.PI / 2 + 0.6] },
      // the download: the longer it runs, the harder they push, and near the end their captain comes for the core himself.
      // No duel: he is one more body on the deck, and the download won't finish while he's standing
      { kind: 'hold', title: 'PULL THE CHIP FILES', music: 'defend', start: [0, 4, 0],
        say: all('Download running. Every clone it ever fitted, every chip, every order. Stay by the core. They know what we are pulling, and they will push harder the longer it runs.'),
        task: all('Hold the records core until the download is done'),
        twist: { kind: 'decompress', spots: [[-26.5, 14], [26.5, 18], [-26.5, -2], [26.5, -6]], first: 7, every: 15, warn: 1.4, open: 5, reach: 17, pull: 5.5,
                 line: all('The hull is going. Hold on to something when it opens. Their troopers are not holding on.') },
        at: FRIGATE_SPOTS.core, r: 6, time: 62, awayRate: 0.3, squadRate: 0.55, holding: 'DOWNLOADING', climb: 1,
        overrun: 'CLEAR THE CORE', unguarded: 'CORE UNGUARDED', doneLine: 'THE FILES ARE OURS', doneSub: 'Yours. Vant\'s. Brisk\'s. And his.',
        boss: { frac: 0.7, from: [0, 20], foe: 'officer', name: 'CAPTAIN VORN', kicker: 'PURGE CAPTAIN · THE MARSHAL\'S OWN', hp: 3.0, dmg: 1.05, scale: 1.1, tint: 0x8a1a1a,
                line: all('The Marshal sends his regards, deserter. He says your chip was a factory fault.'), status: 'VORN IS AT THE CORE · PUT HIM DOWN' },
        pulses: [ { grunt: 2, blaster: 1 }, { blaster: 2, grenadier: 1 }, { grunt: 2, officer: 1 }, { blaster: 2, sniper: 1 }, { grunt: 3, blaster: 1 },
                  { grunt: 2, blaster: 2, grenadier: 1 } ],
        every: [8, 12], cap: 7, from: [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9], aggro: 8 },
    ],
    done: all('The files are ours. Your chip never failed, brother. Somebody switched it off, the night before the order. And the Marshal\'s was switched on.'),
  },

  // BROTHERS IN ARMS: the trooper's trial. The Captain runs a live drill on the HALCYON's empty decks, stun settings
  // on the old training droids: take the posts with the squad, then hold the last of them.
  drill: {
    id: 'drill', trial: true,
    title: 'BROTHERS IN ARMS',
    campaignOnly: true,
    blurb: 'the Captain\'s drill: take the posts with your squad',
    level: { name: 'TRIAL — BROTHERS IN ARMS', sub: all('The HALCYON\'s decks, after. The Captain has set up a drill.'),
             arena: 72, floor: 0x8a8e92, fog: 0x1a1e26, sky: 0x020308, layout: 'frigate', waves: [], hazards: {} },
    start: FRIGATE_SPOTS.start,
    kit: 4,
    grant: all([]),
    squad: 2, squadCap: 2,
    foeLook: DRILL,
    objectives: [
      { kind: 'capture', title: 'TAKE THE POSTS', music: 'battle', postName: 'POST',
        say: all('Three posts, three teams of droids. I do not want to see you take them alone. Send Vant and Brisk onto each one, and cover them while they hold it.'),
        task: all('Take each post: send the squad onto it (H) and cover them'),
        posts: [ { at: FRIGATE_SPOTS.hangar, guards: { blaster: 3 } },
                 { at: FRIGATE_SPOTS.aisle, guards: { blaster: 2, grenadier: 1 } },
                 { at: FRIGATE_SPOTS.gallery, guards: { blaster: 2, sniper: 1 } } ],
        r: 4.5, time: 6, squadRate: 0.8, perMate: 0.4, doneLine: 'EVERY POST TAKEN', doneSub: 'Not bad. Again, harder.',
        trickle: { every: 12, cap: 6, group: { blaster: 2 } }, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8], aggro: 9 },
      { kind: 'hold', title: 'HOLD THE GALLERY', music: 'defend', start: [0, 14, 0],
        say: all('Now hold it. Put the squad on the gallery and work the flanks yourself. A line holds because everyone in it trusts the next man.'),
        task: all('Hold the gallery with the squad until the drill ends'),
        at: FRIGATE_SPOTS.gallery, r: 6, time: 35, awayRate: 0.3, squadRate: 0.7, holding: 'DRILL CLOCK',
        overrun: 'RETAKE THE GALLERY', unguarded: 'GALLERY UNGUARDED', doneLine: 'DRILL COMPLETE', doneSub: 'The Captain is almost smiling.',
        pulses: [ { blaster: 3 }, { blaster: 2, grenadier: 1 }, { blaster: 2, officer: 1 }, { blaster: 3, sniper: 1 } ],
        every: [7, 10], cap: 8, from: [-Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9], aggro: 8 },
    ],
    done: all('That is a squad. Now we go and find out who switched your chip off, and why.'),
  },

  // THE DROWNED CITY (Act II, Kamino): Tipoca's lower levels, abandoned and flooding. The archive stacks still hold every
  // batch's file, and the Marshal's batch is yours. Pull it, then get back to the pad before the sea takes the hall.
  drowned: {
    id: 'drowned',
    title: 'THE DROWNED CITY',
    campaignOnly: true,
    blurb: 'pull the Marshal\'s batch file from Kamino\'s flooded archive, then get out before the storm takes the hall',
    level: { name: 'MISSION — THE DROWNED CITY', sub: all('Tipoca City, the lower levels. Where we were made.'),
             arena: 80, floor: 0x9aa4ae, fog: 0x3a4a56, sky: 0x1a2632, layout: 'kamino', waves: [], hazards: {} },
    start: KAMINO_SPOTS.start,
    kit: 5,
    grant: all([]),
    squad: 2, squadCap: 2,
    foeLook: PURGE,
    objectives: [
      { kind: 'capture', title: 'TAKE THE HALL DOOR', music: 'battle', postName: 'DOOR',
        say: all('Purge troopers on the hall door. The Marshal sent them for the same file we came for. Take the door and do not let them seal it.'),
        task: all('Take the hall door'),
        posts: [ { at: [0, -7], guards: { grunt: 2, blaster: 2, sniper: 1 } } ],
        r: 4.5, time: 4, squadRate: 0.6, perMate: 0.3, doneLine: 'THE DOOR IS OURS', doneSub: 'The archive is through the pods.',
        trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [Math.PI / 2 - 0.8, Math.PI / 2 + 0.8] },
      { kind: 'sabotage', title: 'PULL THE BATCH FILE', consoleName: 'ARCHIVE', consoleDone: 'PULLED', music: 'infiltrate', start: [0, -6, 0],
        doneLine: 'THE BATCH FILE IS OURS', doneSub: 'Yours. His. Every brother in your batch.',
        say: all('Three stacks, and the file is split across all of them. Slice each one. Water is rising on the lower decks, brother. Do not take your time.'),
        task: all('Stand at each archive stack to pull its part of the file'),
        twist: { kind: 'tide', first: 8, every: 16, level: 0.6, slow: 0.6,
                 line: all('The sea comes in waves down here. A stack under water is shorted out. Slice in the dry spells.') },
        consoles: [ { at: KAMINO_SPOTS.archives[0], guards: { grunt: 2, blaster: 1 } },
                    { at: KAMINO_SPOTS.archives[1], guards: { blaster: 2, grenadier: 1 } },
                    { at: KAMINO_SPOTS.archives[2], guards: { grunt: 2, blaster: 1, officer: 1 } } ],
        time: 4, r: 2.6, hitLoss: 1.0,
        trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8] },
      { kind: 'hold', title: 'HOLD THE PAD', music: 'defend', start: [0, -16, Math.PI],
        say: all('The sea is in the hall. Back to the pad. Tally is bringing the gunship down through the storm, and the purge company is coming with the water.'),
        task: all('Hold the landing pad until the gunship is down'),
        at: KAMINO_SPOTS.pad, r: 6.5, time: 45, awayRate: 0.35, squadRate: 0.55, holding: 'GUNSHIP INBOUND',
        overrun: 'CLEAR THE PAD', unguarded: 'PAD UNGUARDED', doneLine: 'THE GUNSHIP IS DOWN', doneSub: 'Everyone aboard. Now.',
        pulses: [ { grunt: 2, blaster: 2 }, { blaster: 2, grenadier: 1 }, { grunt: 2, officer: 1, sniper: 1 }, { grunt: 2, blaster: 1, brute: 1 }, { grunt: 3, blaster: 2 } ],
        every: [8, 11], cap: 9, from: [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9], aggro: 8 },
    ],
    done: all('The file was not a batch record. It was an order list. His chip was switched on by hand, brother, eight years ago, by someone with the code. The Marshal does not know who. He wants to.'),
  },

  // THE OLD KILL HOUSE (Act II's trial, Kamino): the training level you and the Marshal grew up on. The Captain loads
  // the Marshal's old drill records into the training droids: run his course, then beat the droid running his file.
  oldkillhouse: {
    id: 'oldkillhouse', trial: true,
    title: 'THE OLD KILL HOUSE',
    campaignOnly: true,
    blurb: 'run the Marshal\'s old training course, then beat a droid that fights the way he does',
    level: { name: 'TRIAL — THE OLD KILL HOUSE', sub: all('The training level. Every score on the wall is his or yours.'),
             arena: 80, floor: 0x9aa4ae, fog: 0x3a4a56, sky: 0x1a2632, layout: 'kamino', waves: [], hazards: {} },
    start: KAMINO_SPOTS.start,
    kit: 5,
    grant: all([]),
    squad: 2, squadCap: 2,
    foeLook: DRILL,
    objectives: [
      { kind: 'capture', title: 'RUN HIS COURSE', music: 'battle', postName: 'POST',
        say: all('The droids are running his old drill records. Three posts. He always took them alone. You take them with your squad.'),
        task: all('Take each post with the squad (H sends them onto it)'),
        posts: [ { at: KAMINO_SPOTS.posts[0], guards: { blaster: 3 } },
                 { at: KAMINO_SPOTS.posts[1], guards: { blaster: 2, grenadier: 1 } },
                 { at: KAMINO_SPOTS.posts[2], guards: { blaster: 2, sniper: 1 } } ],
        r: 4.5, time: 5, squadRate: 0.8, perMate: 0.4, doneLine: 'COURSE CLEAR', doneSub: 'Two seconds under his record.',
        trickle: { every: 12, cap: 6, group: { blaster: 2 } }, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8], aggro: 9 },
      { kind: 'duel', title: 'BEAT HIS RECORD', start: [0, 4, 0],
        say: all('Last droid. It is running his whole file: every fight he ever had on this level. He never wasted a shot, and he never let anyone close.'),
        task: all('Beat the droid running the Marshal\'s file'),
        enter: all('The last droid steps out of the instructor\'s box, moving the way he moves.'),
        foe: 'officer', name: 'THE MARSHAL\'S RECORD', kicker: 'A TRAINING DROID · RUNNING HIS FILE', hp: 3.2, dmg: 0.9, scale: 1.08, tint: 0xb0a070, at: KAMINO_SPOTS.duel,
        line: all('RECORD CT-0451. DRILL SCORE: FIRST IN BATCH. BEGIN.'),
        rage: 0.5, rageDuel: {},
        trickle: { every: 15, cap: 3, group: { blaster: 2 } }, from: [-Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6] },
    ],
    done: all('First in batch, brother. You were always second, and you were always behind him in line. Remember how he fights. You will need it.'),
  },

  // THE CHIP FOUNDRY (Act II, Jakku's slot): the order list names a foundry in a dead volcano's shadow. The chips were
  // never retired: the Empire is making new ones. Take the dock, wreck the presses, and hold for the shuttle.
  chipworks: {
    id: 'chipworks',
    title: 'THE CHIP FOUNDRY',
    campaignOnly: true,
    blurb: 'wreck the presses making new inhibitor chips, then hold the dock for the shuttle',
    level: { name: 'MISSION — THE CHIP FOUNDRY', sub: all('A foundry under a dead volcano. They are making them again.'),
             arena: 80, floor: 0x3a3634, fog: 0x3a2a26, sky: 0x1a1414, layout: 'chipworks', waves: [], hazards: {} },
    start: CHIPWORKS_SPOTS.start,
    kit: 6,
    grant: all([]),
    squad: 3, squadCap: 3,
    foeLook: PURGE,
    objectives: [
      { kind: 'capture', title: 'TAKE THE DOCK', music: 'battle', postName: 'DOCK',
        say: all('Their guard post covers the dock. Take it and the shuttle can come and go as it likes. Hammer, earn your keep.'),
        task: all('Take the dock\'s guard post'),
        posts: [ { at: CHIPWORKS_SPOTS.dock, guards: { grunt: 2, blaster: 2, grenadier: 1 } } ],
        r: 4.5, time: 4, squadRate: 0.6, perMate: 0.3, doneLine: 'THE DOCK IS OURS', doneSub: 'Now the presses.',
        trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [Math.PI / 2 - 0.8, Math.PI / 2 + 0.8] },
      { kind: 'sabotage', title: 'WRECK THE CHIP PRESSES', consoleName: 'PRESS', consoleDone: 'WRECKED', music: 'infiltrate', start: [-6, -12, 0],
        doneLine: 'THE PRESSES ARE RIGGED', doneSub: 'Thirty seconds on the fuses.',
        say: all('Three presses, and every one of them is stamping out chips for clones who have not been grown yet. Charges on the consoles. Vant has your back.'),
        task: all('Stand at each press to set a charge'),
        twist: { kind: 'stamp', period: [4.6, 3.4], slow: 0, warn: 1.0, r: 2.9, dmg: 20, foeDmg: 80,
                 line: all('The presses are still running. When the head glows, step off the console. It does not stop for you.') },
        consoles: [ { at: CHIPWORKS_SPOTS.presses[0], guards: { grunt: 2, blaster: 1, sniper: 1 } },
                    { at: CHIPWORKS_SPOTS.presses[1], guards: { blaster: 2, grenadier: 1, phalanx: 1 } },
                    { at: CHIPWORKS_SPOTS.presses[2], guards: { grunt: 2, blaster: 1, officer: 1 } } ],
        time: 4, r: 2.6, hitLoss: 1.0,
        trickle: { every: 13, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9] },
      { kind: 'hold', title: 'HOLD THE DOCK', music: 'defend', start: [0, -14, Math.PI],
        say: all('Back to the dock and hold it. The foundry guard is waking up, and the shuttle needs the pad clear to land.'),
        task: all('Hold the dock until the shuttle is down'),
        at: CHIPWORKS_SPOTS.exfil, r: 6.5, time: 45, awayRate: 0.35, squadRate: 0.55, holding: 'SHUTTLE INBOUND',
        overrun: 'CLEAR THE DOCK', unguarded: 'DOCK UNGUARDED', doneLine: 'THE FOUNDRY BURNS', doneSub: 'Every chip in it.',
        pulses: [ { grunt: 2, blaster: 2 }, { blaster: 2, grenadier: 1, lancer: 1 }, { grunt: 2, officer: 1, sniper: 1 }, { grunt: 2, brute: 1 }, { grunt: 3, blaster: 2 } ],
        every: [8, 11], cap: 10, from: [Math.PI / 2 - 1.0, Math.PI / 2 + 1.0], aggro: 8 },
    ],
    done: all('The foundry is ash. Its last shipment went out a week ago, to one place: the Marshal\'s camp. He is not hunting us, brother. He is building something.'),
  },

  // THE MARSHAL'S GARRISON (Act II's end, Mustafar's slot): his war camp on a cold plateau. The band takes the gate,
  // holds it against his counterattack, and pushes to his command post. He comes down to meet you, and he does not lose.
  warcamp: {
    id: 'warcamp',
    title: 'THE MARSHAL\'S GARRISON',
    campaignOnly: true,
    blurb: 'take the Marshal\'s gate, hold it, and push to his command post',
    level: { name: 'MISSION — THE MARSHAL\'S GARRISON', sub: all('His war camp. His company. His brothers, once ours.'),
             arena: 84, floor: 0x5a5a5e, fog: 0x4a4a54, sky: 0x1a2030, layout: 'warcamp', waves: [], hazards: {} },
    start: WARCAMP_SPOTS.start,
    kit: 6,
    grant: all([]),
    squad: 4, squadCap: 4,
    foeLook: PURGE,
    objectives: [
      { kind: 'capture', title: 'TAKE THE GATE', music: 'battle', postName: 'GATE',
        say: all('The gate is blown and his sentries are scrambling. Take it before the company forms up behind it.'),
        task: all('Take the gate'),
        posts: [ { at: WARCAMP_SPOTS.gate, guards: { grunt: 3, blaster: 2, sniper: 1 } } ],
        r: 5, time: 5, squadRate: 0.6, perMate: 0.3, doneLine: 'THE GATE IS OURS', doneSub: 'Here comes the company.',
        trickle: { every: 13, cap: 7, group: { grunt: 2, blaster: 1 } }, from: [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9] },
      { kind: 'hold', title: 'HOLD THE GATE', music: 'battle',
        say: all('Here they come, his whole company. Hold the gate. Hammer on the left, Tally up the tower. Nobody falls back.'),
        task: all('Hold the gate against the counterattack (H puts the squad on it)'),
        at: WARCAMP_SPOTS.gate, r: 7, time: 55, awayRate: 0.3, squadRate: 0.6, holding: 'GATE HELD',
        overrun: 'CLEAR THE GATE', unguarded: 'GATE UNGUARDED', doneLine: 'THE COUNTERATTACK BREAKS', doneSub: 'Push for the command post.',
        pulses: [ { grunt: 3, blaster: 2 }, { grunt: 2, blaster: 1, phalanx: 1 }, { blaster: 2, grenadier: 2 }, { grunt: 3, officer: 1, sniper: 1 },
                  { grunt: 2, blaster: 1, brute: 1 }, { grunt: 2, blaster: 2, lancer: 1 } ],
        every: [7, 10], cap: 11, from: [Math.PI / 2 - 1.0, Math.PI / 2 + 1.0], aggro: 9 },
      { kind: 'hold', title: 'TAKE THE COMMAND POST', music: 'battle', start: [0, 2, 0],
        say: all('Up onto his deck. Vant is slicing his orders while we hold it. Whatever he is sending, we need to see it first.'),
        task: all('Hold the command post while Vant slices the Marshal\'s orders'),
        at: WARCAMP_SPOTS.command, r: 7, time: 50, awayRate: 0.3, squadRate: 0.6, holding: 'SLICING HIS ORDERS',
        overrun: 'CLEAR THE DECK', unguarded: 'DECK UNGUARDED', doneLine: 'HIS ORDERS ARE OURS', doneSub: 'And there he is.',
        pulses: [ { grunt: 3, blaster: 2 }, { blaster: 2, grenadier: 1, phalanx: 1 }, { grunt: 2, officer: 1, sniper: 1 }, { grunt: 2, brute: 1, blaster: 1 },
                  { grunt: 3, blaster: 1, bomber: 1 } ],
        every: [7, 10], cap: 11, from: [-Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2], aggro: 9 },
      { kind: 'duel', title: 'FACE THE MARSHAL', start: [0, 4, 0], music: 'duel',
        say: all('He came down himself. Brother, he is not here to win. Watch the gunship.'),
        task: all('Face the Marshal while the squad holds the yard'),
        twist: { kind: 'gunship', first: 6, every: 11, rageEvery: 8, shots: 7, gap: 4.6, r: 2.5, dmg: 16, foeDmg: 45,
                 line: all('His gunship is making runs on the yard. Off the line of rings, brother. Put him on it if you can.') },
        enter: all('The Marshal walks down off his deck, rifle low.'),
        foe: 'officer', dress: MARSHAL, name: 'THE MARSHAL', kicker: 'COMMANDER · YOUR BATCH', hp: 4.5, dmg: 1.15, scale: 1.12, tint: 0xc9a040, at: WARCAMP_SPOTS.duel,
        line: all('You came all this way to read my orders, brother. You could have asked.'),
        rage: 0.5, rageDuel: {},
        escape: 0.3, escapeLine: all('He breaks off, and his gunship lifts from behind the barracks. The Captain is aboard it.'), escapeScene: 'marshal-camp',
        trickle: { every: 13, cap: 4, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8] },
    ],
    done: all('He has the Captain. His orders name one place: a relay spire, out past the Rim. He is going to give the order again, brother, to every clone with a chip in his head. And he wants us to watch.'),
  },

  // THE HUNT (Act III, the chase slot): the Marshal's trail up a wind-blasted canyon. Three of his camps, each fresher
  // than the last; at the top, he turns to fight, then runs again, and leaves the Captain behind, alive, as a message.
  hunt: {
    id: 'hunt',
    title: 'THE HUNT',
    campaignOnly: true,
    blurb: 'tag his supplies unseen, take his camps one by one, and catch him at the top',
    level: { name: 'MISSION — THE HUNT', sub: all('His trail runs up the canyon. So do we.'),
             arena: 84, floor: 0xb08058, fog: 0xd8a878, sky: 0x4a7ab0, layout: 'canyon', waves: [], hazards: {} },
    start: CANYON_SPOTS.start,
    kit: 7,
    grant: all([]),
    squad: 4, squadCap: 4,
    foeLook: PURGE,
    objectives: [
      // INFILTRATE (game/infiltrate.js): before the camps, trackers on his supply sleds, with his sentries none the wiser
      { kind: 'infiltrate', title: 'TAG HIS SUPPLIES', markName: 'SLED', markDone: 'TAGGED',
        doneLine: 'TRACKERS ON', doneSub: 'Now we know which way he runs.', quiet: ['TRACKERS ON', 'His sentries never saw you.'],
        say: all('Before we hit the camps, brother: trackers on his supply sleds, so we know where he runs. His sentries have not seen us. The squad holds at the mouth. Smoke if you need it.'),
        task: all('Tag each sled without being seen'),
        marks: [ { at: [-20, -9] }, { at: [7, -13.5] }, { at: [-4, -2] } ], time: 3, r: 2.2,
        guards: [ { type: 'blaster', path: [[-18, -16], [-18, -6]] },
                  { type: 'sniper', at: [6, -16], face: -Math.PI / 2, sweep: 0.8, period: 8 },
                  { type: 'grunt', path: [[4, -10], [16, -10]], pause: 2.0 },
                  { type: 'blaster', path: [[-10, -2], [-10, 6]] } ],
        cams: [ { at: [-3, -11], y: 3, yaw: Math.PI, sweep: 0.9, period: 8 } ],
        alarm: { group: { grunt: 2, blaster: 2, sniper: 1 }, at: [[-20, 10], [20, 10]], line: all('They have seen us. Tag the sleds anyway, then we take the camps the hard way.'),
                 trickle: { every: 13, cap: 6, group: { grunt: 1, blaster: 1 } } } },
      { kind: 'capture', title: 'FOLLOW HIS TRAIL', music: 'battle', postName: 'CAMP',
        say: all('Three camps up the canyon, brother, and he has left a rear guard at every one. Take each camp. Tally, eyes on the ridges.'),
        task: all('Take each of his camps, one after another'),
        twist: { kind: 'rockslide', first: 6, every: 8, ahead: 9, r: 1.4, spd: 13, fuse: 1.8, dmg: 22, foeDmg: 90,
                 line: all('His rear guard is bringing the walls down on the trail. Watch for the dust and get out of its lane.') },
        posts: [ { at: CANYON_SPOTS.camps[0], guards: { grunt: 2, blaster: 2, sniper: 1 } },
                 { at: CANYON_SPOTS.camps[1], guards: { blaster: 2, grenadier: 1, sniper: 1 } },
                 { at: CANYON_SPOTS.camps[2], guards: { grunt: 2, blaster: 2, officer: 1 } } ],
        r: 4.5, time: 5, squadRate: 0.6, perMate: 0.3, doneLine: 'HIS LAST CAMP', doneSub: 'The fire is still warm.',
        trickle: { every: 13, cap: 7, group: { grunt: 1, blaster: 1, sniper: 1 } }, from: [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9], aggro: 9 },
      { kind: 'duel', title: 'CATCH THE MARSHAL', start: [-4, 4, 0], music: 'duel',
        say: all('He is right there, brother. He waited for you. Squad, keep his men off the trooper.'),
        task: all('Face the Marshal while the squad holds his rear guard'),
        enter: all('The Marshal steps out from behind the rocks. He has the Captain\'s helmet on his belt.'),
        foe: 'officer', dress: MARSHAL, name: 'THE MARSHAL', kicker: 'COMMANDER · YOUR BATCH', hp: 5, dmg: 1.2, scale: 1.12, tint: 0xc9a040, at: CANYON_SPOTS.duel,
        line: all('You were always good at following, brother. Keep up.'),
        rage: 0.5, rageDuel: {},
        escape: 0.3, escapeLine: all('He breaks for his ship at the canyon\'s head. The Captain is bound in the last camp, alive.'), escapeScene: 'marshal-canyon',
        trickle: { every: 13, cap: 4, group: { grunt: 2, blaster: 1 } }, from: [Math.PI / 2 - 0.8, Math.PI / 2 + 0.8] },
    ],
    done: all('He left the Captain alive, so we would know he could have done otherwise. The Captain heard him talk, brother. The spire is not his idea. Something under it asked him to come.'),
  },

  // THE LAST ASSAULT (Act III, the spearhead slot): every brother the band has freed comes to the relay spire. Take the
  // three gun emplacements in the outer defences, then hold the lift door while the company comes up.
  lastassault: {
    id: 'lastassault',
    title: 'THE LAST ASSAULT',
    campaignOnly: true,
    blurb: 'take the relay spire\'s gun emplacements with every brother you freed, then hold the lift door',
    level: { name: 'MISSION — THE LAST ASSAULT', sub: all('The relay spire. Everyone we freed is here.'),
             arena: 84, floor: 0x3a3a40, fog: 0x22222e, sky: 0x0a0c14, layout: 'relay', waves: [], hazards: {} },
    start: RELAY_SPOTS.start,
    kit: 8,
    grant: all([]),
    squad: 4, squadCap: 4, battle: true,
    foeLook: PURGE,
    objectives: [
      { kind: 'capture', title: 'TAKE THE GUNS', music: 'battle', postName: 'GUN',
        say: all('Three guns cover the approach. The company is pinned on the beach until they go quiet. One at a time, brother, the squad in with you.'),
        task: all('Take each gun emplacement with the squad (H sends them onto it)'),
        twist: { kind: 'guns', first: 5, every: 7, ours: 4.5, r: 3, fuse: 1.8, dmg: 18, foeDmg: 60,
                 line: all('The guns have found us. Keep moving. Take one and we turn it on the rest.'), ourLine: all('The squad has the gun round. It is shelling the next one for you.') },
        posts: [ { at: RELAY_SPOTS.guns[0], guards: { grunt: 2, blaster: 2, grenadier: 1 } },
                 { at: RELAY_SPOTS.guns[1], guards: { blaster: 2, sniper: 1, phalanx: 1 } },
                 { at: RELAY_SPOTS.guns[2], guards: { grunt: 2, blaster: 2, officer: 1 } } ],
        r: 4.5, time: 5, squadRate: 0.7, perMate: 0.35, doneLine: 'THE GUNS ARE QUIET', doneSub: 'The company is coming up the beach.',
        trickle: { every: 12, cap: 8, group: { grunt: 2, blaster: 1 } }, from: [Math.PI / 2 - 1.0, Math.PI / 2 + 1.0], aggro: 9 },
      { kind: 'hold', title: 'HOLD THE LIFT DOOR', music: 'battle', start: [0, 0, 0],
        say: all('Vant is on the lift door. Hold it while he cuts it open and the company comes up behind us. Nobody goes through it but us.'),
        task: all('Hold the lift door until Vant has it open'),
        at: RELAY_SPOTS.door, r: 6.5, time: 50, awayRate: 0.3, squadRate: 0.6, holding: 'CUTTING THE DOOR',
        overrun: 'CLEAR THE DOOR', unguarded: 'DOOR UNGUARDED', doneLine: 'THE DOOR IS OPEN', doneSub: 'Up the spire.',
        pulses: [ { grunt: 3, blaster: 2 }, { blaster: 2, grenadier: 1, lancer: 1 }, { grunt: 2, officer: 1, sniper: 1 }, { grunt: 2, brute: 1, blaster: 1 },
                  { grunt: 2, blaster: 2, bomber: 1 }, { grunt: 3, phalanx: 1 } ],
        every: [7, 10], cap: 11, from: [-Math.PI + 0.3, Math.PI - 0.3], aggro: 9 },
    ],
    done: all('The door is open, and the company is on the plinth. Whatever he is sending, it starts soon. Go up, brother. We hold the bottom.'),
  },

  // THE BROADCAST (the trooper's finale, Exegol's slot): hold the spire's foot while the order counts down, cut its three
  // uplinks, then the Marshal. Whatever becomes of him is asked after (data/campaign-trooper.js TROOPER_CHOICES).
  broadcast: {
    id: 'broadcast',
    title: 'THE BROADCAST',
    campaignOnly: true,
    blurb: 'hold the spire, cut the uplinks before the order goes out, and face the Marshal',
    level: { name: 'MISSION — THE BROADCAST', sub: all('The order goes out in minutes. Unless we stop it.'),
             arena: 84, floor: 0x3a3a40, fog: 0x22222e, sky: 0x0a0c14, layout: 'relay', waves: [], hazards: {} },
    start: [0, 4, Math.PI],
    kit: 9,
    grant: all([]),
    squad: 4, squadCap: 4, battle: true,
    foeLook: PURGE,
    objectives: [
      { kind: 'hold', title: 'HOLD THE SPIRE', music: 'battle',
        say: all('The broadcast is warming up. Every purge trooper he has is coming back down to stop us. Hold the foot of the spire.'),
        task: all('Hold the spire\'s door while the squad digs in'),
        twist: { kind: 'signal', first: 6, every: [16, 9], spd: 11, len: 34, daze: 6, reach: 2.6,
                 line: all('The spire is pushing the order out early. It is getting into the squad\'s heads. Get to them and shake them out of it.') },
        at: RELAY_SPOTS.door, r: 7, time: 55, awayRate: 0.3, squadRate: 0.6, holding: 'THE ORDER IS COUNTING DOWN',
        overrun: 'CLEAR THE DOOR', unguarded: 'DOOR UNGUARDED', doneLine: 'THEY BREAK', doneSub: 'Now the uplinks.',
        pulses: [ { grunt: 3, blaster: 2 }, { blaster: 2, grenadier: 2 }, { grunt: 2, officer: 1, sniper: 1, phalanx: 1 }, { grunt: 2, brute: 1, blaster: 2 },
                  { grunt: 3, lancer: 1, blaster: 1 }, { grunt: 2, bomber: 2, blaster: 1 } ],
        every: [6, 9], cap: 12, from: [-Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2], aggro: 9 },
      { kind: 'sabotage', title: 'CUT THE UPLINKS', consoleName: 'UPLINK', consoleDone: 'CUT', music: 'infiltrate', start: [0, 8, 0],
        doneLine: 'THE SPIRE GOES DARK', doneSub: 'The order never leaves it.',
        say: all('Three uplinks round the spire. Cut every one and the order has nowhere to go. Quick, brother. You can hear it starting.'),
        task: all('Stand at each uplink pylon to cut it'),
        consoles: [ { at: RELAY_SPOTS.pylons[0], guards: { grunt: 2, blaster: 1, sniper: 1 } },
                    { at: RELAY_SPOTS.pylons[1], guards: { blaster: 2, grenadier: 1, phalanx: 1 } },
                    { at: RELAY_SPOTS.pylons[2], guards: { grunt: 2, blaster: 2, officer: 1 } } ],
        time: 4, r: 2.6, hitLoss: 1.0,
        trickle: { every: 12, cap: 8, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI / 2 - 1.0, -Math.PI / 2 + 1.0] },
      { kind: 'duel', title: 'THE MARSHAL', start: [0, -4, 0], music: 'duel',
        say: all('He is coming down the spire himself. No more running, for either of you. Remember how he fights.'),
        task: all('Face the Marshal'),
        enter: all('The Marshal walks out of the lift. His helmet is off.'),
        // the trooper's final boss (boss/marshal.js): his own phases and moves on the final boss layer
        finale: 'marshal', foe: 'officer', dress: MARSHAL_BOSS.dress, name: 'THE MARSHAL', kicker: 'YOUR BATCH-BROTHER · THE LAST ORDER', scale: MARSHAL_BOSS.scale, tint: 0xc9a040, at: RELAY_SPOTS.duel,
        line: all('It is not the Empire\'s order, brother. It never was. It is older than all of us. I only wanted to hear the end of it.'),
        trickle: { every: 16, cap: 3, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8] },
    ],
    done: all('The Marshal is down, and the spire is quiet. But under it, something is still listening.'),
  },

  // TRIALS: the campaign's quiet one-on-ones between the battles (data/campaign.js). A master tests the hero before
  // teaching its form; for the Mando, a rival of the old clans. Stand-ins for now: built from today's duellists until the
  // seven forms' gatekeepers land, on the arenas their chapters borrow. `trial` keeps them off the Missions list until
  // the campaign has reached them.
  'trial-wall': {
    id: 'trial-wall', trial: true,
    title: { jedi: 'TRIAL OF THE WALL', mando: 'THE CHALLENGE' },
    blurb: 'a master tests you before it lets the younglings go',
    level: { name: 'TRIAL — THE HIDDEN REFUGE', sub: { jedi: 'The refuge\'s keeper has a question, and it asks with a blade.',
                                                     mando: 'A hunter of the old clans waits at the covert door.' },
             arena: 64, floor: 0x8a8478, fog: 0xa89098, sky: 0x2c3c66, layout: 'refuge', waves: [], hazards: {} },
    start: [0, 2, Math.PI],
    kit: 4,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'duel', title: { jedi: 'PASS THE WALL', mando: 'ANSWER THE CHALLENGE' }, music: 'duel',
        say: { jedi: 'The Wall barely strikes. It waits for you to tire. Push its guard open, and do not swing yourself empty.',
               mando: 'It will let you come to it. Don\'t. Make it move, then make it pay.' },
        task: { jedi: 'Win the trial', mando: 'Win the challenge' },
        enter: { jedi: 'The keeper of the refuge steps into the light.', mando: 'The challenger draws.' }, kicker: 'TRIAL',
        line: { jedi: 'Show me you can hold a door.', mando: 'By the old custom.' },
        foe: 'acolyte', form: 'soresu', name: 'THE WALL', hp: 4, dmg: 0.9, scale: 1.06, tint: 0x3a7ad2, at: [0, -6],   // a Soresu master (data/foe-forms.js)
        duel: { block: 0.9, posture: 200, feint: 0.15, chain: 1, counter: 0.35 },
        rage: 0.4, rageDuel: { chain: 2, counter: 0.5 },
        hero: { mando: { foe: 'duelist', form: null, name: 'THE CHALLENGER', tint: 0x7a5a3a, line: 'By the old custom.' } } },
    ],
    done: { jedi: 'The Wall steps aside. The younglings are yours to keep now.',
            mando: 'The challenge is answered. The foundlings follow you now. This is the Way.' },
  },

  'trial-acrobat': {
    id: 'trial-acrobat', trial: true,
    title: { jedi: 'TRIAL OF THE ACROBAT', mando: 'THE JET ACE' },
    blurb: 'the master you freed wants to see what you are',
    level: { name: 'TRIAL — THE PRISON YARD ON LOTHAL', sub: { jedi: 'The Acrobat is free, and restless.', mando: 'The ace is free, and wants a word.' },
             arena: 60, floor: 0x6a6e72, fog: 0xc8c4a0, sky: 0x3e6aa8, layout: 'prison', waves: [], hazards: {} },
    start: [0, 16, Math.PI],
    kit: 5,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'duel', title: { jedi: 'KEEP UP WITH THE ACROBAT', mando: 'GROUND THE ACE' }, music: 'duel',
        say: { jedi: 'It strikes from the air and is gone before you answer. Catch the landing, then punish it while it breathes.',
               mando: 'Fast, and it knows it. Let it come in, then don\'t let it leave.' },
        task: { jedi: 'Win the trial', mando: 'Win the fight' },
        enter: { jedi: 'Something drops off the guard tower and lands without a sound.', mando: 'The ace drops in from the guard walk.' }, kicker: 'TRIAL',
        line: { jedi: 'Too slow. Again.', mando: 'Let\'s see the armour move.' },
        foe: 'acolyte', form: 'ataru', name: 'THE ACROBAT', hp: 3.6, dmg: 1.0, scale: 1.0, tint: 0x3ad28a, at: [0, -6],   // an Ataru master
        duel: { feint: 0.4, chain: 3, counter: 0.4 },
        rage: 0.5, rageDuel: { chain: 3, delay: 0.3, feint: 0.45 },   // (BALANCE: as Sera's)
        hero: { mando: { foe: 'lancer', form: null, name: 'THE JET ACE', tint: 0xd2a03a } } },
    ],
    done: { jedi: 'The Acrobat laughs for the first time in a year. It will come.',
            mando: 'The ace is with us. This is the Way.' },
  },

  'trial-knight': {
    id: 'trial-knight', trial: true,
    title: { jedi: 'TRIAL OF THE KNIGHT', mando: 'THE CLAN CHAMPION' },
    blurb: 'a general tests you blade to blade',
    level: { name: 'TRIAL — THE LAST HANGAR ON HOTH', sub: { jedi: 'The line held. The Knight is waiting.', mando: 'The champion is waiting.' },
             arena: 60, floor: 0x8a98aa, fog: 0x3a4658, sky: 0x0e1218, layout: 'hangar', waves: [], hazards: {} },
    start: [0, 14, Math.PI],
    kit: 6,
    grant: { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'] },
    objectives: [
      { kind: 'duel', title: { jedi: 'MATCH THE KNIGHT', mando: 'BEST THE CHAMPION' }, music: 'duel',
        say: { jedi: 'It meets every careless block with a riposte. Parry, don\'t block, and answer it in kind.',
               mando: 'Beskar like yours, and it hits harder. Keep your distance until it overreaches.' },
        task: { jedi: 'Win the trial', mando: 'Win the fight' },
        enter: { jedi: 'The Knight walks out past the last transport.', mando: 'The champion steps out past the last transport.' }, kicker: 'TRIAL',
        line: { jedi: 'Show me what you learned out there.', mando: 'Beskar to beskar.' },
        foe: 'acolyte', form: 'djemso', name: 'THE KNIGHT', hp: 4, dmg: 1, scale: 1.08, tint: 0xd2b23a, at: [0, -8],   // a Djem So master
        duel: { block: 0.72, posture: 160, feint: 0.3, chain: 2, counter: 0.55 },
        rage: 0.45, rageDuel: { chain: 3, counter: 0.6 },   // (BALANCE: was hp 4.5, dmg 1.1, block 0.75, counter 0.7 / 0.72: a trial, not the hardest duel of the act)
        hero: { mando: { foe: 'duelist', form: null, name: 'THE CLAN CHAMPION', tint: 0x6a7a8a, hp: 4.5, dmg: 1.1,
                         duel: { block: 0.75, posture: 160, feint: 0.3, chain: 2, counter: 0.7 }, rageDuel: { chain: 3, counter: 0.72 } } } },
    ],
    done: { jedi: 'The Knight sheathes its blade. Where you go now, it goes too.',
            mando: 'The champion stands with you. The clan is whole again. This is the Way.' },
  },
};

// ACT IV · THE SITH GATE: its five missions (data/missions-gate.js), on their own shelf (data/mission-groups.js)
Object.assign(MISSIONS, GATE_MISSIONS);

// SPEARHEAD ON THE ROAD TO THE CITADEL (the campaign's chapter 12): the Grass Sea battle's plan and fight, laid on
// Exegol's ash (BATTLE_WORLDS.approach) and told in the last act's words. Campaign only: the Missions list keeps the
// Grass Sea one.
{
  const S = MISSIONS.strike, sayAt = (i, say) => ({ ...S.objectives[i], say });
  MISSIONS['strike-exegol'] = { ...S, id: 'strike-exegol', campaignOnly: true,
    level: { ...S.level, layout: 'approach', name: 'MISSION — THE ROAD TO THE CITADEL',
             sub: 'His last army holds the road to the Citadel. Break its line and take the gate.' },
    objectives: [
      sayAt(0, { jedi: 'Every master you found is with you, and the troopers who held Hoth. Take their forward posts one by one. Leave the troopers to the squad, and the blades to yourself.',
                 mando: 'The whole clan rides with you. Take their posts one by one. They\'ll handle the troopers. The blades are yours.' }),
      sayAt(1, { jedi: 'The Citadel\'s gate is open and his army is pouring out of it. Hold it until the gunships come. If a blade comes for you, put the squad on the gate (H) and meet it.',
                 mando: 'The Citadel gate\'s ours if we can keep it. Hold it till the gunships come. Put your clan on it (H) when you have to go hunting.' }),
      sayAt(2, { jedi: 'The gate\'s warden comes out to meet you. Your men will keep its troops off you. It is yours. Vexis is behind it.',
                 mando: 'The warden of the gate wants you himself. The clan will keep his troops busy. The Magistrate is behind him.' }),
    ],
    done: { jedi: 'The road is open and the gate is ours. Vexis is waiting inside.',
            mando: 'The gate is down. The Magistrate is inside. This is the Way.' } };
}

// VAEL'S CHAINS without Ilsa (the Jedi struck her down at Khel Dar): nobody takes the third chain, and with no one
// reading the Citadel's guard rota the hold runs longer under heavier pulses.
{
  const C = MISSIONS.chains, [chain, hold, duel] = C.objectives;
  MISSIONS['chains-alone'] = { ...C, id: 'chains-alone',
    objectives: [
      { ...chain, say: 'Three chains, and nobody left who knows them. Stand at each anchor until it gives.',
        consoles: [ { at: [-16, -24], guards: { grunt: 2, blaster: 1, grenadier: 1 } }, ...chain.consoles ] },
      { ...hold, time: 55, cap: 10,
        pulses: [ ...hold.pulses, { grunt: 2, lancer: 1, phalanx: 1 } ] },
      duel,
    ] };
}

// THE MANDALORIAN'S STORY, re-staged on its own worlds (data/campaign-mando.js): the forge's plan and fight cut into the
// ice of Caldus (the meltworks), and the spearhead's on the iron plain before the Magistrate's citadel on Duren.
// Campaign only: the Missions list keeps the originals.
{
  const F = MISSIONS.forge;
  // THE MELTWORKS: the ice moon's own shape. The coolant valves first (its channels run on Caldus's meltwater: open
  // them all and the moulds crack as they cool), then the charges on the feeds, then the forgemaster. Its escape (an
  // extraction) comes with that objective type
  MISSIONS.meltworks = { ...F, id: 'meltworks', title: 'THE MELTWORKS', campaignOnly: true,
    blurb: 'open the coolant valves, charge the feeds, and face the forgemaster',
    level: { ...F.level, layout: 'meltworks', name: 'MISSION — THE MELTWORKS ON CALDUS',
             sub: 'The covert\'s beskar, poured into moulds cut for children. Tear it down.' },
    objectives: [
      { kind: 'capture', title: 'OPEN THE COOLANT VALVES', music: 'battle', start: [0, 14, Math.PI],
        say: all('The meltworks runs on the moon\'s own ice. Three coolant valves round the floor. Open them all and the meltwater floods the moulds. Hot beskar and ice water: they crack. Each valve is guarded.'),
        task: all('Take and open each coolant valve'),
        r: 4.5, time: 6, postName: 'VALVE', doneLine: 'THE MOULDS ARE FLOODING', doneSub: 'Now charge the feeds.', aggro: 9,
        posts: [ { at: [-18, 1], guards: { grunt: 2, blaster: 1 } },
                 { at: [0, -17], guards: { grunt: 2, lancer: 1, grenadier: 1 } },
                 { at: [18, -1], guards: { grunt: 2, blaster: 1, officer: 1 } } ],
        trickle: { every: 15, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.3, -0.3] },
      { ...F.objectives[0], start: [14, 2, -Math.PI / 2], say: all('Three feeds into the meltworks. Charge every one, then get clear. Keep off the channels when they glow.') },
      { ...F.objectives[2], say: { ...F.objectives[2].say, mando: 'The forgemaster. It melted our beskar with its own hands. Don\'t trade blows. Make it miss, then hit it.' } },
    ],
    done: { ...F.done, mando: 'The meltworks are slag, and Rook was never here.' } };

  // THE IRON ROAD: the Magistrate's convoy runs for the citadel across the iron plain, the Iron Warden riding its rear.
  // Run it down (it stops twice for its rear guard to hold you off), and take the warden where it stops, at the gate.
  const S = MISSIONS['strike-exegol'], SW = S.objectives[2], IW = SW.hero.mando;
  MISSIONS['iron-road'] = { ...S, id: 'iron-road', title: 'THE IRON ROAD', campaignOnly: true, battle: false, squad: 2,
    blurb: 'run down the Magistrate\'s convoy across the iron plain, and take its warden at the gate',
    level: { ...S.level, layout: 'ironroad', name: 'MISSION — THE IRON ROAD',
             sub: 'His last convoy is running for the Iron Citadel. Run it down before it reaches the gate.' },
    start: [-24, 46, Math.PI],
    // the convoy's run: off the landing field's west end, through the gap in the first ridges, past the walker's hull,
    // round the crater, down past the southern ridges and in at the outpost's gate
    route: [[[-24, 38], [-16, 30], [-4, 27], [4, 22], [5, 12], [6, 3], [18, -7], [13, -24], [2, -31], [0, -44]]],
    quarry: all({ foe: 'duelist', name: 'THE IRON WARDEN', kicker: 'RIDING THE MAGISTRATE\'S CONVOY', tint: IW.tint, scale: 1.1 }),
    objectives: [
      { kind: 'pursuit', leg: 0, title: 'RUN DOWN THE CONVOY',
        say: all('The Magistrate\'s convoy is running for the citadel with the Iron Warden on its tail. Don\'t let it reach the gate. Keep it in sight. When it stops, its rear guard holds the road. Go through them.'),
        task: all('Keep the Iron Warden in sight'),
        sight: 34, lost: 6, shove: 3.0,
        pace: [[-6, 11.2], [6, 10.0], [14, 9.0], [24, 8.2], [36, 7.4]],
        clash: { dmg: 0.12, time: 9, every: 16 },
        standoff: [ { at: [6, 3], spots: [[0, 8], [12, 8], [2, -4], [11, -2]], group: { grunt: 2, blaster: 2, lancer: 1 } },
                    { at: [13, -24], spots: [[8, -20], [18, -20], [8, -28], [18, -29]], group: { grunt: 2, phalanx: 1, grenadier: 1, blaster: 1 } } ],
        ambush: [ { at: [4, 22], spots: [[-6, 18], [12, 26], [-2, 30]], group: { grunt: 2, blaster: 1 } },
                  { at: [2, -31], spots: [[-8, -34], [10, -34], [-6, -26]], group: { grunt: 2, sniper: 1, officer: 1 } } ] },
      { kind: 'duel', quarry: true, title: 'DEFEAT THE IRON WARDEN',
        say: all('The gate is shut in its face. It has to come through you. The clan has the convoy. The warden is yours.'),
        task: all('Win the duel while the clan holds'),
        hp: IW.hp, dmg: SW.dmg, duel: IW.duel, rage: SW.rage, rageDuel: SW.rageDuel,
        trickle: SW.trickle, from: SW.from },
    ],
    done: { ...S.done, mando: 'The convoy is burning on the road and the gate is down. The Magistrate is inside, and so is Rook. This is the Way.' } };
}
