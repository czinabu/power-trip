// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* ============================================================
   THE WALKER TAKEDOWN (a set piece: game/walker.js runs it, as the mission objective kind `walker`). A full-size
   walker strides across the field toward the line it is shelling. The party trips it by working the tow points at
   three of its legs as they move, each one a STYLED LOCK built for one hero's way of fighting (game/locks.js: a Force
   seal, a high lock worked from the air, the line), though anyone can work any of them. With three legs tangled it goes
   down on its knees, its crew bails out, and someone sets the charge on its neck before it gets back up.
   Edit the numbers and words freely. An objective can override any of these with its own field of the same name.
   ============================================================ */

export const WALKER = {
  scale: 1,            // its size (1: about 23 m to the top of its back, 8 or 9 heroes tall)
  speed: 1.25,         // m/s on the march
  slow: 0.24,          // the share of its pace each tangled leg costs it
  stride: 5.2,         // m each foot moves in a step
  turn: 0.32,          // rad/s it can turn toward the next leg of its path
  lift: 2.4,           // m a foot lifts as it swings
  foot: 1.9,           // m: a foot's radius (it is solid, and it stomps whoever is under it as it plants)
  guns: { every: [4.4, 6.5], r: 3, fuse: 1.5, dmg: 18, range: 80, near: 9 },   // chin guns: s between volleys (on the march, down), a shell's
  stomp: { dmg: 22, shove: 9 },   // a foot planted on you
  anchor: { time: 6, r: 2.6, decay: 0.35, out: 2.5 },   // a tow point: s of work at a hero's pace, how close counts, work lost a second
                                                        // while nobody is on it, how far out from its foot it is
  neck: { time: 5, r: 3.2 },   // the charge on its neck once it is down (a high lock: worked from the air, it goes twice as fast)
  trip: 3.2,           // s from the last leg tangled to it being down on its knees
  down: 40,            // s it stays down before it tears the cables and gets back up
  rise: 3,             // s to get up
  snap: 2,             // tow points that tear loose when it gets up (worked again)
  fuse: 3.4,           // s from the charge set to the blast
  fall: 3.2,           // s it takes to topple
  crush: 34,           // what it does to a hero it falls on (its shadow on the snow shows where)
  drop: { every: 16, cap: 9 },   // troops let down from its belly on the march (the objective's `drop.group`)
};

// the words (per hero where it matters)
export const WALKER_TEXT = {
  name: 'WALKER',
  tangled: 'LEG TANGLED',
  trip: ['IT\'S GOING DOWN', 'Three legs tangled. Get to its head.'],
  down: ['THE WALKER IS DOWN', 'Set the charge on its neck before it gets up.'],
  rise: ['THE CABLES SNAP', 'It\'s getting up. Tangle its legs again.'],
  fuse: ['CHARGE SET', 'Get clear of it.'],
  fail: ['THE WALKER REACHED THE LINE', 'Back to where it came in.'],
  // the HUD's status lines
  hud: { march: 'TANGLE ITS LEGS', eta: 'AT THE LINE IN', working: 'STAY ON IT', down: 'SET THE CHARGE ON ITS NECK', up: 'IT GETS UP IN',
         trip: 'IT\'S GOING DOWN', fuse: 'CHARGE SET · GET CLEAR', fall: 'THE WALKER FALLS' },
  // the first time a hero is on a tow point of each kind: whose way it is (game/locks.js LOCK.hint says it for a plain lock)
  hint: { seal: 'A Jedi holds a leg with the Force twice as fast. Anyone can work the winch by hand.',
          sky: 'Wrap the cable round its knees from the air for double speed: fly, jump or climb.',
          line: 'The trooper winches the line faster, and the squad can hold it alone (H).' },
  neckName: 'NECK CHARGE',
};
