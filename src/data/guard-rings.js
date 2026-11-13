// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* GUARD RINGS — the crescent beside a duellist on the line its guard covers (enemies/duel.js). The guard itself is
   read off the blade (data/foe-stances.js: every form's guard holds the blade on the line it covers, as you see it:
   L on your left, R on your right, H level over the head, Lo point down across the legs), so the ring is a helper
   that steps back as you learn to read the blade. Settings: GUARD RINGS (ui/menus.js).
   DUEL CUES (Settings; G.guardRings) — how much is drawn over a duel:
     minimal  (default) the blades and nothing else: no ring beside a duellist, no crescent or strike mark on your own
              guard, no guard dial on the crosshair, and the words for routine blade work (BLOCKED, FEINT, RE-PARRIED…:
              data/callouts.js DUEL_QUIET) are left to the sparks and the sound. A duellist's guard strain is one thin
              line over its head, shown only while its guard is under strain. The words that end a duel still show
              (GUARD BROKEN, WINDED, PERFECT STRIKE). Training always shows everything it teaches with.
     fading   (GUIDED) the ring at full on Padawan and while you learn; on Knight it fades to a ghost over your first
              duels won (learn: from `after` wins, gone to `ghost` by `by`); none on Master. The strike mark, your own
              crescent, the dial, the bars and the words are all on
     always   (FULL) the ring at full, every difficulty, and everything else as GUIDED
   A ghost ring still lights up for a moment when a blow is turned on its line, so it keeps teaching. */
export const GUARD_RINGS = {
  modes: ['minimal', 'fading', 'always'],
  names: { minimal: 'MINIMAL', fading: 'GUIDED', always: 'FULL' },
  learn: { after: 3, by: 10 },   // duels won (a guarding duellist down) before it starts to fade, and when it is a ghost
  ghost: 0.35,                   // a learned ring's share of its full brightness
};
/* THE BLADE TELLS what the ring used to: when the guard has READ your cut (the same line too often) the blade's glow
   swells and flickers hot, and a turned blow flares it. Scales on the glow's thickness and brightness. */
export const BLADE_CUE = { read: { swell: 1.4, bright: 0.45, rate: 16 }, block: { swell: 0.8, bright: 0.4 }, decay: 4 };
