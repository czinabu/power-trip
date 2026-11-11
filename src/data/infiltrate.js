// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// INFILTRATE, as data: the numbers and the words of the stealth objective (game/infiltrate.js runs it; an objective of
// kind 'infiltrate' in data/missions.js lays out its guards, cameras and marks). Edit freely.
//
// How it plays: guards walk their beats, cameras sweep and searchlights rake the ground, each with a cone of sight drawn
// on the floor. A hero in a cone (and not behind something tall enough to hide them) fills the ALARM meter, faster the
// closer they are; out of every cone it drains away. Past SPOT it counts as being seen (the "never seen" bonus goal is
// gone); full, the ALARM goes up: every guard turns on you, reinforcements come in and the rest of the mission sends
// more at you. It never fails the mission. Hurt a guard without dropping him and he raises a shout too.
//
// Each hero has their own way through, on F when the prompt shows:
//   jedi     DISTRACT  a Force tug on something behind a guard you can see: he turns to look at it for a while
//   mando    TAKEDOWN  from behind an unaware guard (outside his cone, close): drops him without a sound
//   trooper  SMOKE     a smoke grenade at your feet: nothing sees into it or through it while it hangs. The squad holds
//                      back at the start while you go in, and won't fire on a guard who hasn't seen you

export const INFIL = {
  // sight
  range: 12,          // m a guard sees
  fov: 0.68,          // half the cone's angle (rad)
  camRange: 15, camFov: 0.42,
  eye: 1.6,           // a guard's eye height (m); a camera's is its own `y`
  body: 0.95,         // what of a hero has to show over cover to be seen (m off the ground): low walls hide you
  fill: 1.5,          // seconds of being seen at the cone's edge to fill the meter (close up it's quicker)
  closeMul: 2.6,      // ...how much quicker right in front of him
  drain: 0.09,        // a second, out of sight
  spot: 0.34,         // the share of the meter that counts as SEEN (the bonus goal is gone)
  hurt: 0.4,          // a guard hurt but still standing adds this to the meter (and turns on you)
  look: 2.4,          // seconds a guard who glimpsed you stands and stares that way
  // the guards' beat
  walk: 1.6,          // m/s
  pause: 1.6,         // seconds at each end of the beat (each guard's own `pause` overrides)
  // the marks to reach
  r: 2.0,             // how close counts as on one
  time: 3,            // seconds to work one (each objective's `time` overrides)
  // each hero's way
  distract: { reach: 17, time: 5, force: 15, cd: 2 },
  takedown: { reach: 2.6, behind: 1.9 },   // behind: how far off his facing (rad) you have to be (π is straight behind)
  smoke: { n: 3, r: 3.6, time: 11, cd: 1.2 },
  // the alarm
  alarmGroup: { grunt: 2, blaster: 2 },   // who comes in when it goes (an objective's alarm.group overrides)
  after: 1,           // the rest of the mission once it's gone: one more foe in each group sent at you
};

// the words: the prompts (F …), the HUD, the banners
export const INFIL_TEXT = {
  verb: { jedi: 'DISTRACT', mando: 'TAKEDOWN', trooper: 'SMOKE' },
  teach: { jedi: 'Unseen, F tugs at something behind a guard: he turns to look.',
           mando: 'Get behind a guard who hasn\'t seen you: F takes him down quietly.',
           trooper: 'The squad holds back. F drops smoke: nothing sees into it or through it.' },
  unseen: 'UNSEEN', seen: 'SEEN', searching: 'THEY HEARD SOMETHING', alarm: 'ALARM',
  spotted: 'SPOTTED', spottedSub: 'Get out of sight before it fills.',
  alarmSub: 'They know you are here. More are coming.',
  quiet: 'IN AND OUT', quietSub: 'Nobody saw a thing.',
  noSmoke: 'OUT OF SMOKE',
  down: 'TAKEN DOWN',
};
