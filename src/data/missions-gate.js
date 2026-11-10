// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ACT IV · THE SITH GATE: its five missions (data/campaign-gate.js plays them as chapters; the Missions page lists them
// under their own shelf once any hero's campaign is beaten). The fields are data/missions.js's. One voice for every
// hero, as the trooper's story does: a party of any mix hears the same story.
//
// EVERY HERO HAS A WAY THROUGH. The mixed-party objectives are sabotage consoles with a `style` (game/locks.js): a
// Force seal (a Jedi holds it twice as fast), a high lock (worked from above: the Mando flies to it, anyone can climb or
// jump) and the line (the trooper works it faster, and squadmates hold it on their own). Every hero can work every
// one, and every mission brings a squad (General Kast's troopers), so a party of one Jedi, one Mando, three troopers
// or any other mix can finish it. A console up on a deck has `y`: it's worked from up there.
// The rest ask the same of any hero: the Cantor's chase at Jedha, the ward walked to the throne, the archive breached a
// door at a time (the doors are Kamino's own when its level is `sealed`: world/arenas/kamino.js).

import { KAMINO_SPOTS } from '../world/arenas/kamino.js';
import { SITH_GATE_SPOTS } from '../world/arenas/sith-gate.js';

const all = (v) => ({ jedi: v, mando: v, trooper: v });
const GRANT = { jedi: ['throw', 'slam'], mando: ['grapple', 'birds'], trooper: [] };
// THE HOLLOW CHOIR: the cult that hears Kharel. Black robes over old armour, violet eyes
const CHOIR_TROOP = { model: 'storm', color: 0x26222c, eye: 0xb46bff, cloth: 0x3a1a3a };
export const CHOIR = { blaster: CHOIR_TROOP, grenadier: CHOIR_TROOP, sniper: CHOIR_TROOP, officer: { ...CHOIR_TROOP, model: 'officer', cloth: 0x6a3a8a } };
const S = SITH_GATE_SPOTS;
const GATE_SHELF = { story: 'gate', act: 0 };

export const GATE_MISSIONS = {
  // 1 · THE GATE WAKES (together): the temple on Jedha at night. The old Jedi seals round the dais are failing; hold all
  // three, each its own way, and the Choir's voice comes up out of the gate to see who knocked. It runs: chase it round
  // the hall, through the ruins and past the columns, and catch it at the foot of the dais before it gets back through.
  'gate-wake': {
    id: 'gate-wake', ...GATE_SHELF, order: 0,
    title: 'THE GATE WAKES', voice: 'GENERAL KAST',
    blurb: 'hold the old seals under Jedha, every hero their own way, and run down what comes up the stair',
    level: { name: 'MISSION — THE GATE WAKES', sub: all('The temple at night. The gate under the dais is breathing again.'),
             arena: 56, floor: 0x3a3440, fog: 0x1a1626, sky: 0x08060e, layout: 'jedhaNight', waves: [], hazards: {} },
    start: [0, 18, Math.PI],
    kit: 9, grant: GRANT, squad: 2, foeLook: CHOIR,
    // the Cantor's run: out of the gate's north side, twice round the hall (over the ruins, between the columns), and back
    // to the dais's south foot to get through it again. One leg; it stops once, at the east arcade, to break the old seal
    route: [[[0, -6], [0, -13], [-9.2, -9.2], [-13, 0], [-9.2, 9.2], [0, 13], [9.2, 9.2], [13, 0], [9.2, -9.2], [0, -13],
             [-9.2, -9.2], [-13, 0], [-9.2, 9.2], [0, 13], [0, 6]]],
    quarry: all({ foe: 'acolyte', name: 'THE CANTOR', kicker: 'THE HOLLOW CHOIR', tint: 0x6a3a8a, scale: 1.04 }),
    objectives: [
      { kind: 'sabotage', title: 'HOLD THE OLD SEALS', consoleName: 'SEAL', consoleDone: 'HELD', music: 'battle',
        doneLine: 'THE SEALS HOLD', doneSub: 'Something is coming up the stair.',
        say: all('Three seals round the dais, each built to be held a different way. A Jedi holds the Force seal, the high lock on the summit is worked from above, and the squad can hold the line. Any of you can work any of them.'),
        task: all('Work each seal: the Force seal, the high lock and the line'),
        consoles: [ { at: [-15, 4], style: 'seal', guards: { grunt: 2, blaster: 1 } },
                    { at: [0, -0.9], y: 1.5, style: 'sky', guards: { grunt: 1, blaster: 2 } },
                    { at: [15, 4], style: 'line', guards: { grunt: 2, lancer: 1 } } ],
        time: 5, r: 2.6, hitLoss: 1.0,
        trickle: { every: 14, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.3, -0.3] },

      { kind: 'pursuit', leg: 0, title: 'CHASE THE CANTOR', start: [0, -14, 0],
        say: all('The Choir\'s voice. It came up to see who knocked, and now it is running for the gate. Do not let it back through. Over the ruins, not around them.'),
        task: all('Keep the Cantor in sight'),
        sight: 42, lost: 6, shove: 3.0,
        pace: [[-6, 11], [6, 9.8], [14, 8.8], [24, 8.0], [36, 7.2]],
        clash: { dmg: 0.12, time: 9, every: 16 },
        standoff: [ { at: [13, 0], spots: [[10, -4], [10, 4], [16.5, -2.5], [16.5, 2.5]], group: { grunt: 2, blaster: 1, acolyte: 1 },
                      line: all('It stops at the east arcade to break an old seal. The Choir holds you off.') } ],
        ambush: [ { at: [-13, 0], spots: [[-17, -3], [-17, 3], [-10, 5]], group: { grunt: 2, blaster: 1 } } ] },

      { kind: 'duel', quarry: true, title: 'MEET THE CANTOR', music: 'duel', start: [0, 12, Math.PI],
        say: all('Cornered at the dais. Make it tell us who it sings for.'),
        task: all('Beat the Cantor'),
        line: all('You came to the door. He has waited a thousand years for someone to knock.'),
        form: 'makashi', hp: 3.2, dmg: 1.05,
        duel: { posture: 150, feint: 0.4, chain: 3, counter: 0.45 },
        rage: 0.55, rageDuel: { feint: 0.5, delay: 0.32, chain: 3 },
        escape: 0.3, escapeLine: all('The Cantor backs into the gate\'s light, still humming, and is gone.'), escapeScene: 'cantor-escape',
        trickle: { every: 15, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: all('The gate is open, and it is not going to close on its own. The Cantor went through it. So do we.'),
  },

  // 2 · THE VOICE UNDER THE THRONE (the Jedi's payoff): through the gate, under the throne on Exegol where Vexis sat. The
  // stones there still whisper; silence them, then walk the temple's old ward across the floor and set it on the
  // throne's step. The voice is not fought: it is shut up, the way the temple on Jedha shut it up the first time.
  'gate-vault': {
    id: 'gate-vault', ...GATE_SHELF, order: 1,
    title: 'THE VOICE UNDER THE THRONE', voice: 'MASTER VAEL',
    blurb: 'silence the whispering stones under the throne, and carry the old ward to the throne\'s step',
    level: { name: 'MISSION — THE VOICE UNDER THE THRONE', sub: all('Under the old throne. The stones are whispering.'),
             arena: 64, floor: 0x2f2832, fog: 0x2a1430, sky: 0x0e0612, layout: 'sith', waves: [], hazards: {} },
    start: [0, 16, Math.PI],
    kit: 9, grant: GRANT, squad: 2, foeLook: CHOIR,
    // who carries the ward: one of Kast's troopers, the temple's warding stone strapped to his back
    escort: all({ model: 'clone', name: 'THE WARD-BEARER', kicker: 'CARRYING THE TEMPLE\'S WARD', color: 0xd8d0b8, eye: 0x9ad8ff, scale: 1, hp: 340 }),
    objectives: [
      { kind: 'sabotage', title: 'SILENCE THE STONES', consoleName: 'STONE', consoleDone: 'SILENT', music: 'battle',
        doneLine: 'THE STONES ARE SILENT', doneSub: 'All but one voice.',
        say: all('Three whispering stones round the floor. One is a seal of the old kind, one sits on the throne\'s top step, one is on the line where the cult stands. Any of you can quiet any of them. The ward-bearer waits for them to go quiet.'),
        task: all('Silence each stone: the Force seal, the high lock and the line'),
        consoles: [ { at: [-18, -23], style: 'seal', guards: { grunt: 2, blaster: 1, acolyte: 1 } },
                    { at: [0, -30.4], y: 1.2, style: 'sky', guards: { grunt: 1, blaster: 2 } },
                    { at: [18, -1], style: 'line', guards: { grunt: 2, lancer: 1 } } ],
        time: 5, r: 2.6, hitLoss: 1.0,
        trickle: { every: 14, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-0.6, 0.6] },

      { kind: 'escort', title: 'CARRY THE WARD', music: 'battle', start: [2, 16, Math.PI],
        say: all('The stones are quiet, but the voice is not. The temple on Jedha kept it shut with a ward, and we brought it. Walk the ward-bearer up the east side. He will not walk into fire, so clear it ahead of him.'),
        task: all('Stay near the ward-bearer and keep foes off him'),
        path: [[0, 14], [10, 5], [18, 3], [18, -6]],
        speed: 2.3, leash: 15, threat: 6, dps: 4, regen: 3, aggro: 7, ambushLine: 'THE CHOIR IS COMING FOR THE WARD',
        ambush: [ { at: [10, 5], group: { grunt: 2, blaster: 2 }, from: [-0.7, 0.7] },
                  { at: [18, -2], group: { grunt: 2, lancer: 1, acolyte: 1 }, from: [-0.7, 0.7] } ],
        trickle: { every: 16, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [-0.7, 0.7] },

      { kind: 'escort', title: 'CARRY THE WARD', music: 'battle', start: [18, -2, Math.PI],
        say: all('Across the floor to the west stair. The voice has the cult\'s singers up in the stands: when one of them finds him, a red line runs from its mouth to the ward. Stand in the line and the song is yours, or silence the singer first.'),
        task: all('Get the ward-bearer across the floor'),
        twist: { kind: 'marked', nests: [ { at: [26, -18], from: 0.08 }, { at: [-11, -27], from: 0.45 }, { at: [-28, -6], from: 0.7 } ], aim: [5, 3], hit: 0.2, dmg: 14,
                 line: all('A singer in the stands has the ward. Stand in the red line and the song hits you instead, or silence the singer first.') },
        path: [[18, -6], [10, -9], [6, -14], [-8, -14], [-12, -20], [-17, -20]],
        speed: 2.3, leash: 15, threat: 6, dps: 4.5, regen: 3, aggro: 7, ambushLine: 'THE CHOIR IS COMING FOR THE WARD',
        ambush: [ { at: [6, -14], group: { grunt: 2, blaster: 1, grenadier: 1 }, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8] },
                  { at: [-12, -20], group: { grunt: 2, acolyte: 1, blaster: 1 }, from: [Math.PI - 0.3, Math.PI + 0.3] } ],
        trickle: { every: 16, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [Math.PI - 0.3, Math.PI + 0.3] },

      { kind: 'escort', title: 'SET THE WARD', music: 'defend', start: [-16, -17, Math.PI],
        say: all('The throne\'s step. Get him onto it and the ward goes down where the voice is loudest. It will throw everything it has left at him. Hold it off for the last few steps.'),
        task: all('Get the ward-bearer to the throne\'s step'),
        path: [[-17, -20], [-8, -23], [0, -23]],
        speed: 2.0, leash: 14, threat: 6, dps: 5, regen: 2, aggro: 8, ambushLine: 'THE VOICE IS SCREAMING',
        doneLine: 'THE WARD IS SET', doneSub: 'Under the throne, the voice goes quiet.',
        // (they come in off the floor's sides, never out of the throne it is walking to)
        ambush: [ { at: [-15, -21], group: { grunt: 2, acolyte: 1, phalanx: 1 }, from: [Math.PI - 0.3, Math.PI + 0.3] },
                  { at: [-6, -23], group: { grunt: 2, duelist: 1, blaster: 1 }, from: [-0.5, 0.2] } ],
        trickle: { every: 13, cap: 7, group: { grunt: 1, acolyte: 1 } }, from: [-0.5, 0.2] },
    ],
    done: all('The ward is set and the voice is gone, and it left a name behind it: Darth Kharel, the Unburied. The temple on Jedha was built on his grave, to keep the door shut. We forgot why.'),
  },

  // 3 · THE BUYER (the Mando's payoff): the yard past the Rim where the Magistrate's missing beskar went. Take the yard,
  // break the moulds, and face the Choir's quartermaster in armour beaten out of the clans' beskar.
  'gate-yard': {
    id: 'gate-yard', ...GATE_SHELF, order: 2,
    title: 'THE BUYER', voice: 'THE ARMORER',
    blurb: 'take the yard where the stolen beskar went, break the moulds, and face the one who bought it',
    level: { name: 'MISSION — THE BUYER', sub: all('A yard past the Rim. The clans\' stolen beskar came here.'),
             arena: 84, floor: 0x3a3a40, fog: 0x1e1a28, sky: 0x0a0810, layout: 'shipyard', waves: [], hazards: {} },
    start: [0, -22, 0],
    kit: 9, grant: GRANT, squad: 2, foeLook: CHOIR,
    objectives: [
      { kind: 'capture', title: 'TAKE THE YARD', music: 'battle', postName: 'POST',
        say: all('Two guard posts hold the yard. Take them, or send the squad onto them. The Choir paid for the clans\' beskar in warships. Let us see what they bought.'),
        task: all('Take the yard\'s two guard posts'),
        posts: [ { at: [0, -12], guards: { grunt: 2, blaster: 2 } }, { at: [-20, -3], guards: { grunt: 2, blaster: 1, grenadier: 1 } } ],
        r: 4.5, time: 4, squadRate: 0.6, perMate: 0.3, doneLine: 'THE YARD IS OURS', doneSub: 'Now the freighter.',
        trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [Math.PI / 2 - 0.8, Math.PI / 2 + 0.8] },

      { kind: 'sabotage', title: 'BREAK THE MOULDS', consoleName: 'MOULD', consoleDone: 'BROKEN', music: 'infiltrate', start: [0, -6, 0],
        doneLine: 'THE MOULDS ARE BROKEN', doneSub: 'They were not moulds for armour.',
        say: all('Three moulds, and none of them is armour-shaped. One is up on the freighter\'s hull, one sits in an old seal, one is on the dock line. Break them.'),
        task: all('Break each mould: the high lock on the hull, the Force seal and the line'),
        consoles: [ { at: [4, 6], y: 3.7, style: 'sky', guards: { blaster: 2, sniper: 1 } },
                    { at: [-14, 16], style: 'seal', guards: { grunt: 2, acolyte: 1 } },
                    { at: [10, 19], style: 'line', guards: { grunt: 2, blaster: 1, grenadier: 1 } } ],
        time: 5, r: 2.6, hitLoss: 1.0,
        trickle: { every: 13, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9] },

      { kind: 'duel', title: 'FACE THE BUYER', music: 'duel', start: [0, -10, 0],
        say: all('There. The one who paid for our beskar is wearing some of it. It does not know how. Show it.'),
        task: all('Beat the Buyer'),
        enter: all('The Buyer walks down the freighter\'s ramp in armour that does not fit it.'), kicker: 'THE HOLLOW CHOIR · ITS QUARTERMASTER',
        line: all('Whoever sold it to me thought he was selling armour. He was selling a body.'),
        foe: 'lancer', name: 'THE BUYER', hp: 4.2, dmg: 1.2, scale: 1.25, tint: 0x8a8e98, at: [0, 0],
        dress: { model: 'magistrate', weapon: 'spear', color: 0x7e828c, eye: 0xb46bff, cloth: 0x1a1420, trim: 0x6a4a9a, rag: 0x2a1a30 },
        rage: 0.5, rageDuel: {},
        trickle: { every: 14, cap: 3, group: { grunt: 2, blaster: 1 } }, from: [Math.PI / 2 - 0.8, Math.PI / 2 + 0.8] },
    ],
    done: all('A vessel. They were forging a body out of the clans\' beskar, one a lightsaber will not cut. It left this yard a month ago, for Jedha.'),
  },

  // 4 · WHO GAVE THE ORDER (the trooper's payoff): the sealed archive under Tipoca City, walled in two rooms deep and
  // locked from the inside. Breach it a door at a time with the squad, pull the contract nobody signed, and the Cantor
  // comes for the file itself.
  'gate-order': {
    id: 'gate-order', ...GATE_SHELF, order: 3,
    title: 'WHO GAVE THE ORDER', voice: 'THE CAPTAIN',
    blurb: 'breach Kamino\'s sealed archive a door at a time, pull the contract nobody signed, and face who signed it',
    level: { name: 'MISSION — WHO GAVE THE ORDER', sub: all('Tipoca City, the sealed archive. Where the order was bought.'),
             arena: 80, floor: 0x9aa4ae, fog: 0x3a4a56, sky: 0x1a2632, layout: 'kamino', sealed: true, waves: [], hazards: {} },
    start: KAMINO_SPOTS.start,
    kit: 9, grant: GRANT, squad: 2, foeLook: CHOIR,
    objectives: [
      { kind: 'breach', title: 'BREACH THE ARCHIVE', start: [0, 6, 0], doors: 0,
        say: all('The archive is sealed from the inside, two doors deep. Stack up on the first with the squad, set the charge, and go in fast. Any of you can set it. Every brother stacked with you sets it faster.'),
        task: all('Stand at the door to set the charge, then clear the room'),
        door: 0, stack: KAMINO_SPOTS.sealed.stack[0], time: 2.6, fuse: 1.1, stun: 1.5,
        guards: { grunt: 2, blaster: 2, sniper: 1 }, spots: KAMINO_SPOTS.sealed.rooms[0].spots, breachLine: 'BREACH', breachSub: 'Go, go, go.' },
      { kind: 'breach', title: 'BREACH THE VAULT', start: [-4, 18, 0], doors: 1,
        say: all('The vault is through the partition. They have heard us now, so they will be waiting behind it. The contract is in the stack at the back. Stack up and go.'),
        task: all('Stack up on the vault door and clear the vault'),
        door: 1, stack: KAMINO_SPOTS.sealed.stack[1], time: 2.4, fuse: 1.0, stun: 1.2,
        guards: { grunt: 2, blaster: 2, grenadier: 1, officer: 1 }, spots: KAMINO_SPOTS.sealed.rooms[1].spots,
        doneLine: 'THE CONTRACT IS OURS', doneSub: 'And the name on it.' },

      { kind: 'duel', title: 'FACE THE CANTOR', music: 'duel', start: [0, 6, 0], doors: 2,
        say: all('The Cantor. It signed for every chip in the order, and it came for the receipt. It does not run this time.'),
        task: all('Beat the Cantor'),
        enter: all('The Cantor walks in out of the rain past the pods, humming the same three notes.'), kicker: 'THE HOLLOW CHOIR · IT SIGNED THE ORDER',
        line: all('An army that would hear him when he woke. I signed for every one of you.'),
        foe: 'acolyte', form: 'makashi', name: 'THE CANTOR', hp: 4.4, dmg: 1.2, scale: 1.06, tint: 0x6a3a8a, at: KAMINO_SPOTS.duel,
        duel: { posture: 170, feint: 0.45, chain: 3, counter: 0.5 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.3, chain: 4 },
        trickle: { every: 14, cap: 3, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8] },
    ],
    done: all('The signal in the chips was his voice. Every one was built to hear it. Three roads, one name: Kharel. Back to the gate.'),
  },

  // 5 · THE UNBURIED (together): the heart of the gate. Break the three chains holding the vessel to the gate, hold the
  // ring while it wakes, then Darth Kharel himself, in the vessel (the final boss layer: boss/kharel.js).
  'gate-heart': {
    id: 'gate-heart', ...GATE_SHELF, order: 4,
    title: 'THE UNBURIED', voice: 'GENERAL KAST',
    blurb: 'break the vessel\'s chains, hold the ring, and put Darth Kharel back in the dark',
    level: { name: 'MISSION — THE UNBURIED', sub: all('The heart of the gate. The vessel is chained to the ring, and it is waking.'),
             arena: 60, floor: 0x3a3442, fog: 0x1a1028, sky: 0x040208, layout: 'sithGate', waves: [], hazards: {} },
    start: S.start,
    kit: 10, grant: GRANT, squad: 2, foeLook: CHOIR,
    objectives: [
      { kind: 'sabotage', title: 'BREAK THE THREE CHAINS', consoleName: 'CHAIN', consoleDone: 'BROKEN', music: 'battle',
        doneLine: 'THE CHAINS ARE BROKEN', doneSub: 'The vessel is loose. So is he.',
        say: all('Three chains hold the vessel to the gate, and each anchor was built for a different hand: the Force seal in the west, the high lock up the east tower, the line in the south. Break them, any of you, any way you can.'),
        task: all('Break each chain: the Force seal, the high lock and the line'),
        consoles: [ { at: S.seal, style: 'seal', guards: { grunt: 2, blaster: 1, acolyte: 1 } },
                    { at: S.sky, y: S.skyY, style: 'sky', guards: { blaster: 2, sniper: 1 } },
                    { at: S.line, style: 'line', guards: { grunt: 2, lancer: 1, blaster: 1 } } ],
        time: 5.5, r: 2.8, hitLoss: 1.0,
        trickle: { every: 13, cap: 8, group: { grunt: 1, blaster: 1, flyer: 1 } }, from: [-Math.PI + 0.3, -0.3] },

      { kind: 'hold', title: 'HOLD THE RING', music: 'defend', holding: 'THE VESSEL IS WAKING', start: [0, 6, Math.PI],
        say: all('The vessel is waking on the dais. Hold the floor round it, and keep the Choir from finishing their song.'),
        task: all('Hold the dais while the vessel wakes'),
        twist: { kind: 'pulse', at: S.dais, r0: 5.5, every: [9, 5], spd: [7, 10.5], len: 30, w: 0.8, dmg: 15, foeDmg: 30, first: 5,
                 line: all('The vessel breathes out. Jump the rings as they reach you.') },
        at: S.dais, r: 8, time: 40, awayRate: 0.35, squadRate: 0.55,
        overrun: 'CLEAR THE DAIS', unguarded: 'DAIS UNGUARDED', doneLine: 'THE VESSEL STANDS', doneSub: 'Darth Kharel opens his eyes.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, acolyte: 1, grenadier: 1 }, { grunt: 2, officer: 1, flyer: 1 }, { grunt: 2, phalanx: 1, sniper: 1 }, { grunt: 2, duelist: 1, blaster: 1 } ],
        every: [8, 12], cap: 9, from: [-Math.PI, Math.PI], aggro: 8 },

      { kind: 'duel', title: 'DARTH KHAREL', music: 'duel', start: [0, 8, Math.PI],
        say: all('That is him. A thousand years dead, in a body of stolen beskar. Every one of you has a way to hurt him. Use it.'),
        task: all('Defeat Darth Kharel'),
        enter: all('The vessel steps down off the dais. The gate behind it goes dark.'),
        // the gate's guardian (boss/kharel.js): his own phases and moves on the final boss layer, the wards for the party
        finale: 'kharel', foe: 'acolyte', name: 'DARTH KHAREL', kicker: 'THE UNBURIED', scale: 1.3, tint: 0xb46bff, at: S.guardian,
        line: all('Little Jedi. Little hunter. Little soldier. You are the last door, and doors open.'),
        trickle: { every: 18, cap: 3, group: { grunt: 2, blaster: 1 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: all('The vessel is broken, and Kharel is back in the dark. The gate is still open.'),
  },
};
