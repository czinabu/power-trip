// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* THE DUEL BUBBLE — a 1v1 inside a battle stays a 1v1, softly (enemies/bubble.js).
   While a hero is squared up with a duel foe (a boss, a named champion, or for a Jedi the saber or staff duellist taking
   its turn on them), the troops around it give the duel room. No wall, nothing drawn; the war goes on around it:
     · the melee troops (and the saboteur droids) prowl the edge at `hold` instead of stepping in, or go after the squad;
     · the gunners would rather shoot the squad, fewer of them aim at the duelling hero at once, and most of what they do
       fire at the hero tears past wide (just outside the guard's reach, so it whizzes by instead of costing stamina);
     · no detonators lobbed into it, no officer's volley or flank called on it, no lancer charge from afar;
     · the squad on ON ME forms a ring round the duel and holds the edge (allies/squad.js, data/allies.js DUEL_RING).
   Other duellists keep their own turns (a pack of acolytes is still the fight). In co-op, a partner who comes in on the
   duel makes it a 2v1, and the bubble lifts for as long as they're there. */
export const BUBBLE = {
  start: 9,                 // the duel is on with the duel foe this close to the hero (m)...
  stop: 6,                  // ...and stays on until it's this much further than that
  // which foes start one, by the hero: a boss and a champion for everyone, a form duellist on its turn for the Jedi
  duellists: { jedi: true },
  partner: 7,               // co-op: another hero this close to the duel foe joins the duel, and the bubble lifts
  hold: 9,                  // the troops hold back this far from the duelling hero (m)
  gunHold: 13,              // ...the gunners at least this far
  rangedSlots: { line: 1, sniper: 1, grenade: 0 },   // gunners winding up at the duelling hero at once, by class
  miss: 0.8,                // the share of trooper bolts at the duelling hero that go wide
  wide: [2.4, 3.3],         // ...passing this far to the side of them (m)
  allyReach: 8,             // a trooper turns on a squadmate within its range plus SQUAD.aggroReach plus this (m)...
  aggroShare: 0.9,          // ...and up to this share of the fodder may be on the squad at once
};
