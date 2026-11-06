// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STYLED LOCKS: a spot to work (a sabotage console, a ward on a boss) that every hero can work, but one hero's way of
// fighting works faster. Act IV's mixed-party objectives are built on them (data/missions-gate.js), and so is the gate
// guardian's ward (boss/kharel.js), so a party of any mix, or one hero alone, always has a way through.
//
//   seal   a Force seal: a Jedi holds it with the Force, twice as fast. Anyone else can still work it by hand
//   sky    a lock up high: worked from above (a jetpack hover, a jump, or the climb to it) it goes twice as fast. The
//          Mando flies straight up to it; everyone else climbs or jumps
//   line   a lock on the line: the ARC trooper works it half again as fast, and squadmates sent onto it (H) hold it on
//          their own and speed up whoever is with them. Every hero in a story chapter has a squad for it
// Every hero standing on a lock adds to it (the best one's pace, plus a share for each other), so a party that splits
// up finishes faster, and a party that stacks on one lock still moves.

import { G } from '../state.js';
import { players, targetable } from '../player/players.js';
import { squadIn } from '../allies/squad.js';

export const LOCK = {
  fast: { seal: 2, sky: 2, line: 1.5 },   // the pace of the hero (or the way) a lock is built for
  extra: 0.35,          // each other hero on the same lock adds this share of a hero's pace
  high: 1.0,            // m off the floor (or off the lock's own deck) that counts as working it from above
  squad: 0.6,           // a line lock held by squadmates alone
  perMate: 0.25,        // each squadmate on a line lock with a hero speeds them up this much
  // the lock's name on the HUD, and the line that says whose way it is (shown the first time someone works one)
  name: { seal: 'FORCE SEAL', sky: 'HIGH LOCK', line: 'THE LINE' },
  hint: { seal: 'A Jedi holds a Force seal twice as fast. Anyone can still work it.',
          sky: 'Work the high lock from above: fly, jump or climb to it for double speed.',
          line: 'The trooper holds the line faster, and the squad can hold it alone (H).' },
  color: { seal: 0x9a6aff, sky: 0xffb040, line: 0x4aa8ff },
};

const heroOf = (h) => h.local ? G.hero : h.hero || 'jedi';
// how fast a lock at (x, z) is being worked right now, by every hero (and squadmate) on it. style: seal | sky | line
// (or none: a plain console, worked at 1 by anyone, as it always was). y: the lock's own height (a deck it sits on)
export function lockRate(x, z, r, style, y = 0){
  let best = 0, n = 0;
  for (const h of players){
    if (!h.local && !targetable(h)) continue;
    const p = h.pos;
    if (Math.hypot(p.x - x, p.z - z) >= r) continue;
    if (y > 0 && p.y < y - 1.5) continue;   // a lock up on a deck is worked from up there, not from under it
    let k = 1;
    if (style === 'seal' && heroOf(h) === 'jedi') k = LOCK.fast.seal;
    else if (style === 'sky' && p.y >= Math.max(LOCK.high, y - 0.3)) k = LOCK.fast.sky;
    else if (style === 'line' && heroOf(h) === 'trooper') k = LOCK.fast.line;
    best = Math.max(best, k); n++;
  }
  if (!style) return n ? 1 : 0;
  let rate = best ? best + LOCK.extra * (n - 1) : 0;
  if (style === 'line'){
    const mates = squadIn(x, z, r);
    if (mates) rate = rate ? rate * (1 + LOCK.perMate * mates) : LOCK.squad;
  }
  return rate;
}
