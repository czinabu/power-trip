// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* LIGHT AND HEAVY CUTS (player/jedi/weight.js) — the saber button weighs each cut.
   TAP it: a LIGHT cut, a touch quicker and a touch lighter than the form's plain cut.
   HOLD it: the blade draws back and waits in its chamber until `hold` s after the press, then commits to a HEAVY cut:
   slower through the strike, harder on flesh, armour and a guard, and it costs `stam` more of the form's swing stamina.
   Let go before `hold` and the cut goes on as a light one from wherever the draw had it.

   The numbers are multipliers on top of the form's own (data/stances.js dmg, speed, knock, postureMul, stamina), so every
   form keeps its identity: Djem So's heavy is still the biggest blow in the game. A form can override any of them in
   `forms` (the rest come from the defaults). `speed` scales the swing clock (above 1 quicker); `posture` scales how hard
   a cut strains a duellist's guard; `hitstop` and `shake` are the weight a landed heavy carries.
   Anything that later scales a form's swings (mastery, the Force level) can scale these per form through weightOf.
   A heavy can also change the HOLD: `grip` turns the hilt over into that grip as the heavy commits and `regrip` is how
   long (s) the blade waits in its chamber while it does (the second hand closes on the hilt then too: a regripped heavy
   is always two-handed). The cut is that grip's, and the follow-through turns it back to the form's own (anim/saber.js).
   Shien, the one-handed reverse-grip form, draws its heavy back into a forward, two-handed counter-smash. */
export const SWING_WEIGHT = {
  hold: 0.2,      // s from the press: still held by then, the cut commits to a heavy
  drawAt: 0.85,   // how far into its chamber a held cut waits (fraction of the chamber)
  light: { speed: 1.08, dmg: 0.88, knock: 0.9, posture: 0.85 },
  heavy: { speed: 0.82, dmg: 1.45, knock: 1.35, posture: 1.6, stam: 0.6, hitstop: 0.06, shake: 0.35 },
  // how a heavy LOOKS (player/anim/saber.js, player/animation.js): the extra draw past the chamber (of the chamber-to-
  // strike gap) and lift (m), how far the tip lays back, how far the blade carries past the follow-through, the
  // shoulders' extra drop; the body's counter-turn away from the cut while drawn (rad), its sink (m), how much harder
  // it turns through the strike, and how much further the cut's step drives in
  look: { draw: 0.32, lift: 0.08, lay: 0.35, carry: 0.32, drop: 0.05, coil: 0.38, sink: 0.07, turn: 1.35, step: 1.3 },
  forms: {
    // the strong forms were made for the heavy blow
    djemso:    { heavy: { dmg: 1.55, posture: 1.8 } },
    shien:     { heavy: { dmg: 1.5, posture: 1.7, grip: 'regular', regrip: 0.16 } },
    darksaber: { heavy: { dmg: 1.5, posture: 1.8 } },
    // the fast forms live on the light cut: quicker taps, a smaller payoff for drawing back
    ataru:     { light: { speed: 1.12 }, heavy: { dmg: 1.35, speed: 0.86 } },
    jarkai:    { light: { speed: 1.12 }, heavy: { dmg: 1.35, speed: 0.86 } },
    staff:     { light: { speed: 1.1 },  heavy: { dmg: 1.38 } },
    // the duelling form: a light cut that strains a guard nearly as well as a plain one
    makashi:   { light: { posture: 0.95 } },
    // the defensive form: its heavy is a slow commitment
    soresu:    { heavy: { dmg: 1.4, speed: 0.78 } },
  },
};

const merged = {};
// the light or heavy numbers for a form (its own overrides over the defaults)
export function weightOf(form, kind){
  const key = form + ':' + kind;
  if (!merged[key]) merged[key] = Object.assign({}, SWING_WEIGHT[kind], (SWING_WEIGHT.forms[form] || {})[kind]);
  return merged[key];
}
