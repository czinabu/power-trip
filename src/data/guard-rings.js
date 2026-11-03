// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* GUARD RINGS — the crescent beside a duellist on the line its guard covers (enemies/duel.js). The guard itself is
   read off the blade (data/foe-stances.js: every form's guard holds the blade on the line it covers, as you see it:
   L on your left, R on your right, H level over the head, Lo point down across the legs), so the ring is a helper
   that steps back as you learn to read the blade. Settings: GUARD RINGS (ui/menus.js).
     always   the ring at full, every difficulty
     fading   (default) full on Padawan and while you learn; on Knight it fades to a ghost over your first duels won
              (learn: from `after` wins, gone to `ghost` by `by`); none on Master
     off      no ring: read the blade
   A ghost ring still lights up for a moment when a blow is turned on its line, so it keeps teaching. */
export const GUARD_RINGS = {
  modes: ['fading', 'always', 'off'],
  learn: { after: 3, by: 10 },   // duels won (a guarding duellist down) before it starts to fade, and when it is a ghost
  ghost: 0.35,                   // a learned ring's share of its full brightness
};
/* THE BLADE TELLS what the ring used to: when the guard has READ your cut (the same line too often) the blade's glow
   swells and flickers hot, and a turned blow flares it. Scales on the glow's thickness and brightness. */
export const BLADE_CUE = { read: { swell: 1.4, bright: 0.45, rate: 16 }, block: { swell: 0.8, bright: 0.4 }, decay: 4 };
