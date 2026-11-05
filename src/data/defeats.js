// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DEFEATS — how a felled foe goes down (enemies/defeat.js), by what the killing blow took (enemies/scars.js severLimbs).
// Seconds unless noted. kneel: how far the knees give (0 standing → 1 on its knees, enemies/gait.js).

export const DEFEAT = {
  // the body cut in two at the waist: the legs stand a beat on their own, knees giving, then topple back
  halved:   { hold: 0.55, kneel: 0.35, wobble: 0.06, fallVel: 0.6 },
  // the head off: the body stands a breath, drops to its knees, then pitches forward onto its face
  headless: { hold: 0.45, kneel: 1, lean: 0.18, fallVel: 0.5 },
  // a leg off: it goes over sideways onto the side it lost, with a little of the blow's way in it
  legless:  { push: 1.6, side: 1.4, lift: 1.6, roll: 1.42, rate: 5.5 },
  // an arm (or a forearm) off: it reels back from the cut, hunched over the wound and turning away, sinks, then falls on its face
  reel:     { time: 0.6, back: 1.1, hunch: 0.42, lean: 0.2, turn: 1.3, kneel: 0.6, fallVel: 1.2 },
  // a plain killing cut: the body is thrown along the blade's way as well as off the hero (share of the knock), spinning
  // off a sideways sweep (radians a second at full sweep)
  thrown:   { sweep: 0.55, spin: 3.2 },
  // a droid: sparks off the body and the wounds, the limbs jerking, the eyes stuttering out
  droid:    { time: 2.2, every: [0.06, 0.18], jerk: 0.32, eyesOut: 1.6 },
  // the felled trooper's blaster leaves its hands
  drop:     { lift: [1.5, 3], push: [1, 2.2] },
};

/* BOSS FALLS (boss/boss.js bossFall): each has his own. dur: the whole fall before he's gone (the fight's end waits on it) */
export const BOSS_FALLS = {
  // DARTH VEXIS — the blade gutters out in his hand, he sinks to his knees, bows, and goes over on his side
  sith:  { dur: 1.94, recoil: 0.25, kneelAt: [0.22, 0.61], bladeOut: 0.68, bow: 0.45, topple: [1.08, 1.55], roll: 1.4, sink: 1.62 },
  // THE IRON MAGISTRATE — staggers back sparking, drops to one knee and braces there, then falls back with a thud
  mando: { dur: 2.02, stagger: [0.0, 0.47], back: 1.7, kneelAt: [0.4, 0.72], kneel: 0.55, brace: 0.15, topple: [1.15, 1.58], sink: 1.69 },
};
