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

   THE FIRST RAID BOSS (data/raids.js): a phased fight for 2-4 heroes in which each hero has a job they're best at, and
   any hero can still do any of them (so a party of one hero, or one hero and the squad, always has a way through):
     DEFLECTING (the Jedi)       the DARK VOLLEY (from I): he plants and pours crimson bolts at each hero in turn. Turned
                                 back off a blade, every one that strikes him cracks the vessel (the sunder bar)
     FLANKING FROM THE AIR (the  the WARDED ADVANCE (from II): a ward across his front turns every blow and shot from in
       Mandalorian)              front of him. Only what comes from behind him or from above lands. Blows from behind or
                                 above crack the vessel at any time, and the high ward is worked from above
     SUPPRESSING AND REVIVING    gunfire on him PINS him (his moves come slower, his feet drag), the trooper's most of
       (the ARC trooper)         all, and the trooper gets a fallen teammate up twice as fast. The squad holds the line
   THE SUNDER BAR (`sunder`, the Warbringer's posture bar given to a raid boss: boss/finale.js): those role blows fill
   it, and full it BREAKS the vessel: he staggers and stands wide open for a while, every blow landing as on an opened
   foe. The bar grows with the party as the Warbringer's does (data/duel.js WARBRINGER.coop).
   A raid lays its own numbers over his (`raid` below, the modifiers in data/raids.js); the story's fight is the same
   fight without them. */
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
    // I+ THE DARK VOLLEY (the deflector's job): he plants, raises his free hand and pours bolts at each hero in turn for
    // `dur` s after a `wind` s tell, one every `every` s (`speed` m/s, `dmg` each). Nothing breaks him out of it; turned
    // back off a blade, each bolt that strikes him lands and cracks the vessel. Not when a hero is closer than `near`
    volley: { from: 1, cd: 15, wind: 0.8, dur: 3.4, every: 0.2, speed: 24, dmg: 10, near: 3.2 },
    // II+ THE WARDED ADVANCE (the flanker's job): a ward across his front for `dur` s while he walks at the nearest hero
    // (`step` m/s). Every blow and shot from in front of him is turned (`arc`: how far round his front the ward reaches,
    // as the cosine); from behind him or from above it lands. A slam off the ward every `slam.every` s throws back
    // whoever is in front of him (dodge or jump it)
    bulwark: { from: 2, cd: 21, dur: 7, step: 1.5, arc: 0.2, slam: { every: 2.4, r: 5.5, dmg: 15, knock: 11 } },
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
  // THE SUNDER BAR (boss/finale.js): `bar` at one hero, each extra hero adds `coop` of it again. What fills it, a blow at
  // a time (`gain`): a bolt turned back into him (deflect), a blow from behind him or from above (flank, and a shot that
  // way flankShot), any gunfire the trooper lands (pin), and the squad's (squad). A full bar breaks him `open` s (a
  // stagger, then wide open; his burst cap is `burstMul` times wider meanwhile). Left alone for `idle` s it drains
  // `drain` a second. PINNED: gunfire builds `supp` (`pin` per trooper hit, `pinOther` per other gunner's, losing
  // `pinDecay` a second, up to `pinMax`); at 1 or over he is pinned: his moves come `slow` as often and he moves `pace`
  sunder: { name: 'THE VESSEL', broke: 'THE VESSEL CRACKS', brokeSub: 'He is wide open. Everyone on him.', bar: 190, coop: 0.6, open: 4.5, burstMul: 1.8, idle: 2.5, drain: 9,
            gain: { deflect: 22, flank: 10, flankShot: 4, pin: 2, squad: 1 },
            pin: 0.12, pinOther: 0.04, pinDecay: 0.3, pinMax: 1.5, slow: 0.55, pace: 0.8 },
  // THE TROOPER'S REVIVES in his fight: a trooper gets a fallen teammate up this many times as fast (game/revive.js)
  reviveMul: { trooper: 2 },
  // A RAID'S OWN NUMBERS (data/raids.js lays them over his): his bar by the size of the party (on top of the usual co-op
  // scaling), and the ward's time
  raid: { hp: [1.0, 1.08, 1.16, 1.25], ward: { time: [24, 22, 20, 18] } },
};
