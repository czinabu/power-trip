// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* SABER ASSIST (Settings · CONTROLS · SABER ASSIST) — a light, per-cut aim assist for the lightsaber (and the Mando's
   Darksaber). It is NOT a lock: nothing is held between cuts and the camera is never moved. On each press it looks for
   the foe nearest the crosshair, within `cone` degrees of it (the foe's own width counts) and inside the form's lunge
   range; if there is one, the body turns up to `turn` degrees toward it for that cut (and keeps turning with it while
   the cut lasts, so a sidestep doesn't slip out of the arc), and the cut's lunge closes on THAT foe instead of the
   nearest one in a wide cone. The cut's angle and height stay yours, and guards and parries still stop it.
   Aim somewhere else and the next cut goes there. A soft lock-on (middle mouse) overrides it: the locked foe is the target.
     modes  the setting's values, in the order the pill cycles; 'low' is the default
     pad    extra cone degrees on a controller (a stick aims coarser than a mouse) */
export const SABER_ASSIST = {
  modes: ['low', 'normal', 'off'],
  low:    { cone: 10, turn: 14 },
  normal: { cone: 15, turn: 22 },
  pad: 5,
};
