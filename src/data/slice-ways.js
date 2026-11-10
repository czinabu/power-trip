// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// EVERY HERO SLICES THEIR OWN WAY: a plain console (a sabotage objective's, data/missions.js, with no `style` of its own)
// still asks the same thing of everyone, to get it done, but each hero has their own way of doing it (game/slice-ways.js):
//
//   rip     THE JEDI tears it open with the Force: on the console with Force to spend, the work goes `mul` times as fast
//           and the Force drains `drain` a second. Out of Force, the Jedi works it by hand at the plain pace
//   charge  THE MANDO plants a charge: `plant` (a share of the console's time) worked by hand sets it, and from then on it
//           burns down by itself at `burn` with nobody on it, so he can leave it and fight. A foe within `guard` m of
//           a set charge with no hero on the console pulls the wires: the work goes back at `defuse` a second
//   squad   THE ARC TROOPER sends the squad onto it (H): squadmates on the console work it alone at `alone`, and each
//           one with him speeds him up by `perMate`
// The Act IV locks (game/locks.js: seal, sky, line) keep their own ways; a console that is one ignores these.
// Edit the numbers freely.

export const SLICE_WAY = {
  jedi: { kind: 'rip', mul: 1.6, drain: 30, min: 4 },            // min: Force it needs to start tearing (and keeps above); drain is before the Force's own regen (13 a second, more holstered)
  mando: { kind: 'charge', plant: 0.35, burn: 1.0, guard: 4.5, defuse: 0.6 },
  trooper: { kind: 'squad', alone: 0.6, perMate: 0.3 },
};
// the banner the first time a hero meets a console (the hero's own way), and the HUD's word while it is worked
export const SLICE_TEXT = {
  rip: { title: 'TEAR IT OPEN', hint: 'Stay on the console with Force to spare: you tear it open faster, and the Force drains while you do.', hud: 'FORCE RIP' },
  plant: { hud: 'PLANTING THE CHARGE' },
  charge: { title: 'PLANT THE CHARGE', hint: 'Set the charge, then go and fight: it burns down on its own. Keep the foes off it, or they pull the wires.', hud: 'CHARGE' },
  squad: { title: 'SEND THE SQUAD', hint: 'Send the squad onto a console (H): they slice it on their own, and faster with you there.', hud: 'SQUAD SLICING' },
};
export const CHARGE_COLOR = 0xffa040;
