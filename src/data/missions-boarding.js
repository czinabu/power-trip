// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ACT IV · BOARDING THE WARSHIP: the party boards the star destroyer the Buyer paid for the clans' beskar with, hanging
// over Jedha with the vessel in its hold (the Mandalorian's road ends "it left this yard a month ago, for Jedha"). The
// fields are data/missions.js's; it sits on Act IV's shelf (data/mission-groups.js), one voice for every hero.
//
// EVERY HERO HAS A WAY THROUGH, three times over:
//   · SLIP ABOARD (infiltrate, game/infiltrate.js): the hangar's guards, its camera and the searchlight from the deck
//     above. The Jedi's Force tug turns a guard to look away, the Mando takes him down from behind, the trooper's smoke
//     blinds the camera, and the squad holds back on the shuttle until the alarm goes up (it never fails the mission)
//   · THE GUNS' COUPLINGS (sabotage with styled locks, game/locks.js): a Force seal, a high lock up on the gantry and the
//     gun crews' line. Anyone can work any of them; each goes twice as fast (or half again) for the hero it was built for
//   · BACK TO THE SHUTTLE (hold): the cradle in the hold is empty, the vessel already gone down to the gate. Hold the
//     shuttle while it warms up, the ship's whole garrison coming down through the bulkhead
// The map is world/arenas/destroyer.js (its spots: DESTROYER_SPOTS).

import { DESTROYER_SPOTS } from '../world/arenas/destroyer.js';
import { CHOIR } from './missions-gate.js';

const all = (v) => ({ jedi: v, mando: v, trooper: v });
const GRANT = { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'], trooper: [] };
const S = DESTROYER_SPOTS, NORTH = [0.4, Math.PI - 0.4];

export const BOARDING_MISSIONS = {
  'gate-warship': {
    id: 'gate-warship', story: 'gate', act: 0, order: 3.5, rank: 5,
    title: 'THE WARSHIP', voice: 'GENERAL KAST',
    blurb: 'board the Buyer\'s star destroyer over Jedha, kill its guns, and get out before the garrison does',
    level: { name: 'MISSION — THE WARSHIP', sub: all('The Buyer\'s star destroyer, over Jedha. The vessel is in its hold.'),
             arena: 64, floor: 0x6a7078, fog: 0x1a1e26, sky: 0x020308, layout: 'destroyer', waves: [], hazards: {} },
    start: [...S.start],
    kit: 9, grant: GRANT, squad: 2, foeLook: CHOIR,
    objectives: [
      // 1 · SLIP ABOARD: three marks across the hangar, the last at the blast door's panel
      { kind: 'infiltrate', title: 'SLIP ABOARD', markName: 'SLICER SPIKE', markDone: 'SPIKED', music: 'infiltrate',
        doneLine: 'THE HANGAR IS OURS', doneSub: 'The blast door is open.',
        quiet: ['THE HANGAR IS OURS', 'Nobody on this ship knows you are aboard.'],
        say: all('We are in their hangar, and nobody has looked at the shuttle twice. Spike the control booth, the fuel line on the fighter rack and the blast door\'s panel, and stay out of their sight. The squad waits on the ramp.'),
        task: all('Spike the booth, the fuel line and the door without being seen'),
        marks: [ { at: S.booth }, { at: [18, -15] }, { at: [4, -8.6] } ], time: 3, r: 2.2,
        guards: [ { type: 'blaster', path: [[-8, -28], [8, -28]], pause: 2.0 },
                  { type: 'blaster', path: [[10, -20], [10, -9.5]] },
                  { type: 'grunt', path: [[-21, -13.5], [-9, -13.5]], pause: 2.4 },
                  { type: 'lancer', at: [0, -10.5], face: 2.6, sweep: 0.6, period: 7 } ],
        cams: [ { at: [30, -8], y: 4, yaw: -Math.PI / 2 - 0.3, sweep: 0.7, period: 8 } ],
        lights: [ { from: [0, 14, -40], c: [8, -18], a: [10, 6], period: 15, ph: 0.3, r: 3.2 } ],
        alarm: { group: { grunt: 2, blaster: 2, lancer: 1 }, at: [[-20, -2], [20, -2]], line: 'They know we are aboard. Spike them anyway.',
                 trickle: { every: 12, cap: 7, group: { grunt: 1, blaster: 1 } } } },

      // 2 · THE GUNS: three couplings feed them, each built for a different hand
      { kind: 'sabotage', title: 'KILL THE GUNS', consoleName: 'COUPLING', consoleDone: 'CUT', music: 'battle', start: [0, -3, 0],
        doneLine: 'THE GUNS ARE DEAD', doneSub: 'The hold is open. The cradle is empty.',
        say: all('The reactor feeds the ship\'s guns through three couplings, and every one of them is aimed at Jedha. The west one is sealed the old way, the north one is up on the gantry, and the east one is the gun crews\' line. Any of you can cut any of them.'),
        task: all('Cut each coupling: the Force seal, the high lock and the line'),
        consoles: [ { at: [S.couplings.seal[0] + 0.6, S.couplings.seal[1]], style: 'seal', guards: { grunt: 2, blaster: 1 } },
                    { at: S.couplings.sky, y: S.gantryY, style: 'sky', guards: { grunt: 1, blaster: 2 } },
                    { at: [S.couplings.line[0] - 0.6, S.couplings.line[1]], style: 'line', guards: { grunt: 2, lancer: 1 } } ],
        time: 5, r: 2.6, hitLoss: 1.0,
        trickle: { every: 13, cap: 8, group: { grunt: 1, blaster: 1 } }, from: NORTH },

      // 3 · BACK TO THE SHUTTLE: the vessel went down to the gate before you came aboard. Hold the shuttle while it warms
      { kind: 'hold', title: 'HOLD THE SHUTTLE', music: 'defend', holding: 'THE SHUTTLE IS WARMING UP', start: [-4, -15, Math.PI],
        say: all('The cradle is empty. The vessel went down to the gate before we ever came aboard. Back to the shuttle, and hold it while the engines warm. Their whole garrison is coming down through that bulkhead.'),
        task: all('Hold the shuttle until it can lift off'),
        at: [S.shuttle[0] + 6, S.shuttle[1] + 2], r: 7, time: 40, awayRate: 0.35, squadRate: 0.55,
        overrun: 'CLEAR THE RAMP', unguarded: 'SHUTTLE UNGUARDED', doneLine: 'WHEELS UP', doneSub: 'Down to Jedha, after the vessel.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, lancer: 1, grenadier: 1 }, { grunt: 2, officer: 1, blaster: 1 }, { blaster: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 9, from: NORTH, aggro: 9 },
    ],
    done: all('The guns over Jedha are dead, and the warship is blind. The vessel is already at the gate.'),
  },
};
