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
  // three, each its own way, then hold the dais while the gate opens, and meet the Choir's voice coming up the stair.
  'gate-wake': {
    id: 'gate-wake', ...GATE_SHELF, order: 0,
    title: 'THE GATE WAKES', voice: 'GENERAL KAST',
    blurb: 'hold the old seals under Jedha, every hero their own way, and meet what comes up the stair',
    level: { name: 'MISSION — THE GATE WAKES', sub: all('The temple at night. The gate under the dais is breathing again.'),
             arena: 56, floor: 0x3a3440, fog: 0x1a1626, sky: 0x08060e, layout: 'jedhaNight', waves: [], hazards: {} },
    start: [0, 18, Math.PI],
    kit: 9, grant: GRANT, squad: 2, foeLook: CHOIR,
    objectives: [
      { kind: 'sabotage', title: 'HOLD THE OLD SEALS', consoleName: 'SEAL', consoleDone: 'HELD', music: 'battle',
        doneLine: 'THE SEALS HOLD', doneSub: 'For now. Something is climbing the stair.',
        say: all('Three seals round the dais, each built to be held a different way. A Jedi holds the Force seal, the high lock on the summit is worked from above, and the squad can hold the line. Any of you can work any of them.'),
        task: all('Work each seal: the Force seal, the high lock and the line'),
        consoles: [ { at: [-15, 4], style: 'seal', guards: { grunt: 2, blaster: 1 } },
                    { at: [0, -0.9], y: 1.5, style: 'sky', guards: { grunt: 1, blaster: 2 } },
                    { at: [15, 4], style: 'line', guards: { grunt: 2, lancer: 1 } } ],
        time: 5, r: 2.6, hitLoss: 1.0,
        trickle: { every: 14, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI + 0.3, -0.3] },

      { kind: 'hold', title: 'HOLD THE DAIS', music: 'defend', holding: 'THE GATE IS OPENING', start: [0, 10, Math.PI],
        say: all('The seals held long enough for the gate to open on our terms. Hold the dais until it does, and jump the rings it breathes out.'),
        task: all('Stay by the dais until the gate opens'),
        twist: { kind: 'pulse', at: [0, 0], r0: 4.2, every: [10, 6], spd: [7, 10], len: 30, w: 0.75, dmg: 14, foeDmg: 30, first: 6,
                 line: all('The gate breathes out. Each ring runs along the ground: jump it as it reaches you.') },
        at: [0, 0], r: 7, time: 40, awayRate: 0.35, squadRate: 0.55,
        overrun: 'CLEAR THE DAIS', unguarded: 'DAIS UNGUARDED', doneLine: 'THE GATE IS OPEN', doneSub: 'Someone is walking up out of it.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, lancer: 1, grenadier: 1 }, { grunt: 2, officer: 1, flyer: 1 }, { grunt: 2, duelist: 1, sniper: 1 } ],
        every: [8, 12], cap: 8, from: [-Math.PI, Math.PI], aggro: 8 },

      { kind: 'duel', title: 'MEET THE CANTOR', music: 'duel', start: [0, 10, Math.PI],
        say: all('The Choir\'s voice. It came up the stair to see who knocked. Make it tell us who it sings for.'),
        task: all('Beat the Cantor'),
        enter: all('A figure in a choir robe walks up out of the gate, humming.'), kicker: 'THE HOLLOW CHOIR',
        line: all('You came to the door. He has waited a thousand years for someone to knock.'),
        foe: 'acolyte', form: 'makashi', name: 'THE CANTOR', hp: 3.2, dmg: 1.05, scale: 1.04, tint: 0x6a3a8a, at: [0, -6],
        duel: { posture: 150, feint: 0.4, chain: 3, counter: 0.45 },
        rage: 0.55, rageDuel: { feint: 0.5, delay: 0.32, chain: 3 },
        escape: 0.3, escapeLine: all('The Cantor backs into the gate\'s light, still humming, and is gone.'),
        trickle: { every: 15, cap: 3, group: { grunt: 2 } }, from: [-Math.PI + 0.4, -0.4] },
    ],
    done: all('The gate is open, and it is not going to close on its own. The Cantor went through it. So do we.'),
  },

  // 2 · THE VOICE UNDER THE THRONE (the Jedi's payoff): through the gate, under the throne on Exegol where Vexis sat. The stones
  // there still whisper; silence them, hold the circle, and face the echo of the one who listened to them.
  'gate-vault': {
    id: 'gate-vault', ...GATE_SHELF, order: 1,
    title: 'THE VOICE UNDER THE THRONE', voice: 'MASTER VAEL',
    blurb: 'silence the whispering stones under the throne, and face the echo of the one who listened',
    level: { name: 'MISSION — THE VOICE UNDER THE THRONE', sub: all('Under the old throne. The stones are whispering.'),
             arena: 64, floor: 0x2f2832, fog: 0x2a1430, sky: 0x0e0612, layout: 'sith', waves: [], hazards: {} },
    start: [0, 16, Math.PI],
    kit: 9, grant: GRANT, squad: 2, foeLook: CHOIR,
    objectives: [
      { kind: 'sabotage', title: 'SILENCE THE STONES', consoleName: 'STONE', consoleDone: 'SILENT', music: 'battle',
        doneLine: 'THE STONES ARE SILENT', doneSub: 'All but one voice.',
        say: all('Three whispering stones round the floor. One is a seal of the old kind, one sits on the throne\'s top step, one is on the line where the cult stands. Any of you can quiet any of them.'),
        task: all('Silence each stone: the Force seal, the high lock and the line'),
        consoles: [ { at: [-18, -23], style: 'seal', guards: { grunt: 2, blaster: 1, acolyte: 1 } },
                    { at: [0, -30.4], y: 1.2, style: 'sky', guards: { grunt: 1, blaster: 2 } },
                    { at: [18, -1], style: 'line', guards: { grunt: 2, lancer: 1 } } ],
        time: 5, r: 2.6, hitLoss: 1.0,
        trickle: { every: 14, cap: 7, group: { grunt: 1, blaster: 1 } }, from: [-0.6, 0.6] },

      { kind: 'hold', title: 'HOLD THE CIRCLE', music: 'defend', holding: 'THE LAST VOICE IS RISING', start: [0, 6, Math.PI],
        say: all('Something is gathering in the middle of the floor. Hold the circle while it takes a shape, and keep the Choir off it.'),
        task: all('Hold the circle in the middle of the floor'),
        twist: { kind: 'pulse', at: [0, 0], r0: 4.5, every: [10, 6], spd: [7, 10], len: 30, w: 0.75, dmg: 14, foeDmg: 30, first: 6,
                 line: all('The floor breathes out. Jump the rings as they reach you.') },
        at: [0, 0], r: 8, time: 40, awayRate: 0.35, squadRate: 0.55,
        overrun: 'CLEAR THE CIRCLE', unguarded: 'CIRCLE UNGUARDED', doneLine: 'IT HAS A FACE', doneSub: 'The face of the last one who listened.',
        pulses: [ { grunt: 2, blaster: 2 }, { grunt: 2, acolyte: 1 }, { grunt: 2, officer: 1, flyer: 1 }, { grunt: 2, phalanx: 1, sniper: 1 } ],
        every: [8, 12], cap: 8, from: [-Math.PI, Math.PI], aggro: 8 },

      { kind: 'duel', title: 'FACE THE VOICE', music: 'duel', start: [0, 6, Math.PI],
        say: all('It wears the face of the last one who listened to it. Do not fight the face. Fight what is behind it.'),
        task: all('Beat the echo'),
        enter: all('A shape of violet light rises off the floor and takes a face.'), kicker: 'THE OLD THRONE',
        line: all('He sat here and thought my voice was his own ambition. They all do.'),
        foe: 'acolyte', form: 'juyo', name: 'THE ECHO', hp: 4.4, dmg: 1.2, scale: 1.12, tint: 0x6a4ad2, at: [0, -8],
        duel: { posture: 170, feint: 0.38, chain: 3, counter: 0.5 },
        rage: 0.5, rageDuel: { feint: 0.45, delay: 0.32, chain: 4 },
        trickle: { every: 14, cap: 3, group: { grunt: 2 } }, from: [-0.6, 0.6] },
    ],
    done: all('The echo is gone, and it left a name behind it: Darth Kharel, the Unburied. The temple on Jedha was built on his grave, to keep the door shut. We forgot why.'),
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

  // 4 · WHO GAVE THE ORDER (the trooper's payoff): the sealed archive under Tipoca City. Take the floor, pull the
  // contract nobody signed, hold the pad, and the Cantor comes for the file itself.
  'gate-order': {
    id: 'gate-order', ...GATE_SHELF, order: 3,
    title: 'WHO GAVE THE ORDER', voice: 'THE CAPTAIN',
    blurb: 'pull the chip contract nobody signed from Kamino\'s sealed archive, and face who signed it',
    level: { name: 'MISSION — WHO GAVE THE ORDER', sub: all('Tipoca City, the sealed archive. Where the order was bought.'),
             arena: 80, floor: 0x9aa4ae, fog: 0x3a4a56, sky: 0x1a2632, layout: 'kamino', waves: [], hazards: {} },
    start: KAMINO_SPOTS.start,
    kit: 9, grant: GRANT, squad: 2, foeLook: CHOIR,
    objectives: [
      { kind: 'sabotage', title: 'PULL THE CONTRACT', consoleName: 'ARCHIVE', consoleDone: 'PULLED', music: 'infiltrate', start: [0, -6, 0],
        doneLine: 'THE CONTRACT IS OURS', doneSub: 'And the name on it.',
        say: all('Three sealed stacks. One is locked the Jedi way, one is up on the gantry deck, one is behind the line the squad can hold. The contract is split across all three. Pull it.'),
        task: all('Pull each part of the contract: the Force seal, the high lock and the line'),
        consoles: [ { at: KAMINO_SPOTS.archives[0], style: 'seal', guards: { grunt: 2, blaster: 1 } },
                    { at: KAMINO_SPOTS.archives[1], style: 'sky', guards: { blaster: 2, grenadier: 1 } },
                    { at: KAMINO_SPOTS.archives[2], style: 'line', guards: { grunt: 2, blaster: 1, officer: 1 } } ],
        time: 5, r: 2.6, hitLoss: 1.0,
        trickle: { every: 14, cap: 6, group: { grunt: 1, blaster: 1 } }, from: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8] },

      { kind: 'hold', title: 'HOLD THE PAD', music: 'defend', start: [0, -16, Math.PI],
        say: all('The Choir knows we have it. Back to the pad and hold it until the gunship is down. Every brother in that archive was bought, and they want the receipt back.'),
        task: all('Hold the landing pad until the gunship is down'),
        at: KAMINO_SPOTS.pad, r: 6.5, time: 45, awayRate: 0.35, squadRate: 0.55, holding: 'GUNSHIP INBOUND',
        overrun: 'CLEAR THE PAD', unguarded: 'PAD UNGUARDED', doneLine: 'THE GUNSHIP IS DOWN', doneSub: 'And the Cantor is on the pad.',
        pulses: [ { grunt: 2, blaster: 2 }, { blaster: 2, grenadier: 1 }, { grunt: 2, officer: 1, sniper: 1 }, { grunt: 2, blaster: 1, brute: 1 }, { grunt: 3, blaster: 2 } ],
        every: [8, 11], cap: 9, from: [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9], aggro: 8 },

      { kind: 'duel', title: 'FACE THE CANTOR', music: 'duel', start: [0, -16, Math.PI],
        say: all('The Cantor. It signed for every chip in the order. It does not run this time.'),
        task: all('Beat the Cantor'),
        enter: all('The Cantor steps off a Choir shuttle onto the pad, humming the same three notes.'), kicker: 'THE HOLLOW CHOIR · IT SIGNED THE ORDER',
        line: all('An army that would hear him when he woke. I signed for every one of you.'),
        foe: 'acolyte', form: 'makashi', name: 'THE CANTOR', hp: 4.4, dmg: 1.2, scale: 1.06, tint: 0x6a3a8a, at: KAMINO_SPOTS.duel,
        duel: { posture: 170, feint: 0.45, chain: 3, counter: 0.5 },
        rage: 0.5, rageDuel: { feint: 0.5, delay: 0.3, chain: 4 },
        trickle: { every: 14, cap: 3, group: { grunt: 2, blaster: 1 } }, from: [Math.PI / 2 - 0.8, Math.PI / 2 + 0.8] },
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
