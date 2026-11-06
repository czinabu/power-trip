// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* ============================================================
   DARTH KHAREL, THE UNBURIED — the gate's guardian, Act IV's last fight (boss/kharel.js on boss/finale.js)
   ============================================================
   A Sith lord a thousand years dead, coming back through the gate under Jedha in a VESSEL: a body of beskar the Hollow
   Choir forged for him out of the Iron Magistrate's stolen armour (beskar holds the Force, and a blade does not cut it
   easily). Fought on a duellist's body like Vexis, in the old Sith way (he lends Kharel his moves: boss/vexis.js), with
   one move of his own built for a party of mixed heroes:
     I   THE VESSEL     a duellist in beskar: strings and feints, the GUARD BREAKER on a held block, the SABER THROW
                        when you back off. The beskar shrugs off a little of everything (armour)
     II  THE WARDS      he kneels on the dais behind a ward, untouchable, and lights the THREE WARDS round the floor, one
                        built for each hero's way (game/locks.js: a Force seal, a high lock, the line). Break all three
                        before the ward bursts and he is thrown open; miss and the NOVA throws everyone off the floor.
                        Between wards: lightning and the repulse
     III THE UNBURIED   the lights die: the choke, blink chains, the storm, the wards again, and one last stand
   Every number below is his; the reused moves' own numbers are Vexis's (data/bosses.js VEXIS.moves). The phases,
   cooldowns and which moves he has are these.

   RAID READY: he is the first raid boss in waiting (the plan's Phase 3). Everything a raid needs is data here, not code:
   his health already scales with the party (data/coop.js SCALE.bossHp), the wards are the roles (any hero works any
   ward, each hero has one it is best at), and `raid` below is where a raid page lays its own numbers over his. */
export const KHAREL = {
  id: 'kharel', codex: 'gate',
  name: 'DARTH KHAREL', title: 'DARTH KHAREL — THE UNBURIED', look: 'DARTH KHAREL',
  intro: 'The Unburied · in a vessel of beskar',
  phases: ['THE VESSEL', 'THE WARDS', 'THE UNBURIED'],
  phaseLines: ['', 'Kneel, and hold my doors for me.', 'A thousand years in the dark. I will not go back.'],
  fallLine: 'THE VESSEL BREAKS',
  type: 'acolyte',
  hp: 1500, dmg: 1.3, scale: 1.3, speed: 1.0,
  form: 'djemso', rank: 'master',   // the heavy old form: he breaks a blade rather than dance round it
  phaseAt: [0.66, 0.33],
  duel: [
    { posture: 260, feint: 0.32, delay: 0.34, chain: 3, counter: 0.66, thrust: 0.18, parry: 0.68, finisher: 0.85, stam: 230 },
    { posture: 240, feint: 0.36, delay: 0.34, chain: 3, counter: 0.7, thrust: 0.2, parry: 0.7, finisher: 0.9, stam: 230 },
    { posture: 220, feint: 0.4,  delay: 0.36, chain: 4, counter: 0.76, thrust: 0.22, parry: 0.72, finisher: 0.95, stam: 250 },
  ],
  pace: [1, 1.04, 1.14],
  armour: 0.88,   // the beskar takes a little off every blow
  hitCap: 0.07, hitCapOpen: 0.13, phaseResist: [1, 0.9, 0.8],
  burstCap: 0.16, burstWin: 1.6,
  sigGap: [5.2, 4.2, 3.2], sigMin: 2.2,
  beat: { kneel: 1.3, rise: 0.9, slowmo: 0.35, slowT: 0.7, ring: { r: 9, dmg: 14 }, push: 11 },
  defeat: { kneel: 3.6, slowmo: 0.3, slowT: 1.3, xp: 1800 },
  moves: {
    guardBreak: { from: 1, cd: 7 },
    throw: { from: 1, cd: 10 },
    lightning: { from: 2, cd: 12 },
    repulse: { from: 2, cd: 9 },
    choke: { from: 3, cd: 14 },
    blink: { from: 3, cd: 12 },
    storm: { from: 3, cd: 18 },
    lastStand: { at: 0.12 },
    // II+ THE WARDS: once as each phase from II begins, then every `cd` s. He goes to the dais (`home`, or where he
    // stands), kneels behind his ward (nothing lands), and three wards light round the floor (the arena's own spots,
    // shared.gateWards, else a ring of `ring` m round him). Each takes `work` s of one hero's pace (game/locks.js);
    // all three inside `time` s throws him open for `open` s. If not, the NOVA: a ring of `nova.r` round him
    ward: { from: 2, cd: 34, time: 24, work: 5, r: 2.8, ring: 13, open: 4.2, nova: { r: 15, dmg: 32, knock: 15 },
            adds: [null, { grunt: 2, blaster: 1 }, { grunt: 1, blaster: 1, flyer: 1 }],
            styles: ['seal', 'sky', 'line'] },
  },
  // the old Sith lightning (Vexis's moves draw it in these: boss/vexis.js), and the dark of phase III
  mood: { fill: 0.48, sun: 0.32, rim: 1.6, sky: 0.3, fog: 0x1a0a28, blade: 1.4, near: 0.7, far: 0.75 },
  // A RAID'S OWN NUMBERS (for the raid page to come; nothing reads this yet): a party of four gets more wards and less
  // time for them, the bar a little longer, and the modifiers a raid rotates in
  raid: { hp: 1.25, ward: { time: [24, 22, 20, 18], extra: [0, 0, 1, 1] }, modifiers: ['storm-every-phase', 'two-wards-at-once', 'choir-reinforcements'] },
};
