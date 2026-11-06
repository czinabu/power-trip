// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GUNS' SIGNATURE MOVES AND MASTERY, as data: the gunners' answer to the Jedi's form signatures and form mastery
// (data/form-moves.js, data/force-level.js FORM_MASTERY). player/gun-moves.js runs them; the armory page shows them
// (ui/armory-ui.js), each with a HOW TO DO IT line in the same key-chip words as data/form-moves.js. Edit freely.
//
// Every gun has ONE move that only it does, done with the gun's own buttons (no extra key), and a MASTERY earned by
// using it: a bolt that lands is `pts.hit`, a kill `pts.kill`, its move `pts.move`. Rank I wants `need[0]` points,
// rank II `need[1]` and `moves[1]` moves done, rank III (MASTER) `need[2]` and `moves[2]` moves.
//   rank I    the gun hits harder (`dmg`)
//   rank II   it runs cooler (`heat`, × heat a shot)
//   rank III  its move is stronger: `master` says how, and the move's tuning reads `m` (its value at MASTER)
// The sandbox and the training grounds fight at the best rank each gun has reached in any run (like the forms).
// Ids are the gun's (data/mando.js MANDO_WEAPONS); the trooper's DC-15 counts each module as its own gun
// (data/trooper.js RIFLE_MODS: burst / auto / marksman), and his twin DC-17s are `pistols`.

export const GUN_RANKS = {
  need: [70, 200, 420], moves: [0, 3, 10], names: ['', 'I', 'II', 'III'], title: ['', 'RANK I', 'RANK II', 'MASTER'],
  pts: { hit: 1, kill: 3, move: 5 },
  dmg: 1.08,    // rank I+: shot damage × this
  heat: 0.88,   // rank II+: heat a shot × this
};

// the order each hero's guns are shown in (the armory page)
export const GUN_ORDER = { mando: ['single', 'dual', 'carbine', 'repeater', 'disruptor'], trooper: ['burst', 'auto', 'marksman', 'pistols'] };

export const GUN_MOVES = {
  /* ---------------- the Mandalorian ---------------- */
  // QUICKDRAW: the first shot within `window` s of drawing the pistol hits as hard as a headshot wherever it lands
  // (`head` × the headshot multiplier on top when it IS the head)
  single: { name: 'QUICKDRAW', how: [['1', 'draw the pistol'], ['LMB', 'at once']],
            ds: 'The first shot out of the holster hits like a headshot, wherever it lands.',
            master: 'A longer draw window, and a quickdraw to the head hits harder still',
            window: 0.5, head: 1.15, m: { window: 0.8, head: 1.35 } },
  // GUN KATA: firing through a combat dive or an air dodge (for `after` s past its start) keeps both guns true (the
  // braced cone, no bloom) and each bolt × `dmg`
  dual:   { name: 'GUN KATA', how: [['SHIFT', 'dive or air dodge'], ['HOLD LMB', 'through it']],
            ds: 'Fire through a dive or an air dodge: both guns stay dead on, and every bolt hits harder.',
            master: 'Kata bolts hit harder and the window lasts longer',
            after: 0.55, dmg: 1.3, m: { after: 0.75, dmg: 1.5 } },
  // TAG BURST: a whole burst on one foe TAGS it for `time` s: the wrist rocket, the detonator and the whistling birds
  // home onto it, and they hit it × `mul`
  carbine: { name: 'TAG BURST', how: [['LMB', 'all three bolts on one foe'], ['Q / V', 'rocket or gadget']],
             ds: 'Land a whole burst on one foe to tag it. Your rocket, detonator and birds home onto a tag and hit it harder.',
             master: 'Tags last longer and gadgets hit a tagged foe harder',
             time: 6, mul: 1.3, turn: 7, m: { time: 9, mul: 1.5 } },
  // PLANT: hold RMB with the barrels fully spun (`spin` or more) on the ground: he plants his feet. Planted he cannot
  // walk, the spin holds at full even off the trigger, the cone tightens × `cone`, heat × `heat`, and every bolt
  // PUNCHES THROUGH the first body it hits into `pierce` more behind it, rocking each × `flinch`
  repeater: { name: 'PLANT', how: [['HOLD LMB', 'spin it up'], ['HOLD RMB', 'plant your feet']],
              ds: 'Spun up, brace to plant your feet: the spin holds, the cone tightens, and every bolt punches through into the foe behind.',
              master: 'A planted gun runs cooler and its cone closes further',
              spin: 0.95, cone: 0.55, heat: 0.75, pierce: 1, flinch: 0.7, m: { cone: 0.4, heat: 0.6 } },
  // OVERCHARGE: in the scope, hold LMB `charge` s to overcharge the shot, let go to fire: it PIERCES up to `pierce`
  // foes in a line, × `dmg`. A tap fires the plain shot at once.
  disruptor: { name: 'OVERCHARGE', how: [['HOLD RMB', 'scope'], ['HOLD LMB', 'charge'], ['', 'let go']],
               ds: 'Hold the trigger in the scope to overcharge the shot: it tears through every foe in a line.',
               master: 'Charges faster and pierces one more',
               charge: 0.9, tap: 0.22, pierce: 3, dmg: 1.25, m: { charge: 0.65, pierce: 4 } },

  /* ---------------- the ARC trooper ---------------- */
  // TRIPLE TAP: all three bolts of a burst on one foe: the burst's heat comes back × `refund`, and each of them that
  // struck the head adds `bonus` × the bolt's damage on top
  burst: { name: 'TRIPLE TAP', how: [['LMB', 'all three bolts on one foe'], ['', 'on the head for more']],
           ds: 'Put a whole burst into one foe and the burst\'s heat comes back. Every bolt of it on the head adds a bonus hit.',
           master: 'More heat back and a heavier bonus',
           refund: 1, bonus: 0.5, m: { refund: 1.6, bonus: 0.8 } },
  // SWEEP: in one unbroken hold of the trigger, every foe the stream lands on after the first is PINNED outright
  auto:  { name: 'SWEEP', how: [['HOLD LMB', 'drag it across their line']],
           ds: 'Hold the trigger and drag it across their line: every foe it touches after the first is pinned.',
           master: 'The first foe pins too, and a sweep of three cools the barrel',
           from: 2, cool: 0, m: { from: 1, cool: 0.35 } },
  // STEADY BREATH: scoped and still for `settle` s, he holds his breath for `hold` s: the reticle stops dead, and the
  // next shot × `dmg` hits a head in full (even a gunman keeping it down: enemies/coverfight.js champHeadMul) and
  // PIERCES `pierce` foe. Then he breathes out: `after` s of a shakier aim. Let it run out and it shakes harder.
  marksman: { name: 'STEADY BREATH', how: [['HOLD RMB', 'scope, stand still'], ['LMB', 'while the breath holds']],
              ds: 'Hold still in the scope and he holds his breath: the aim stops dead, and the next shot hits harder and pierces.',
              master: 'He settles faster and holds his breath longer',
              settle: 0.45, hold: 3, dmg: 1.4, pierce: 1, after: 1.1, m: { settle: 0.25, hold: 4.5 } },
  // COVERING FIRE: DC-17 shots fired while rolling, or on the move between cover (left one `move` s ago or less),
  // PIN what they hit and shake every foe within `near` m of the bolt's path
  pistols: { name: 'COVERING FIRE', how: [['SHIFT', 'roll for the next cover'], ['LMB', 'on the way']],
             ds: 'Fire the DC-17s as you roll or run between cover: what you hit is pinned, and the rest keep their heads down.',
             master: 'Its fire shakes foes from further off',
             move: 3, near: 3.2, shake: 0.35, m: { near: 4.6, shake: 0.55 } },
};
