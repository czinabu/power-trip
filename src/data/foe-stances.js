// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FOE STANCES: how a duellist holds its guard in its form (data/foe-forms.js), so the forms read apart at a glance
// before the tag does. enemies/foestance.js plays them; tools/enemy-lab.html ?set=forms lines every form up side by side.

/* EACH FORM'S GUARD — on top of data/duel.js GUARD_POSE / BLOCK_POSE (the line a guard covers still reads the same:
   the weapon stays on that side, the crescent sits there). Every key is optional.
     arm    [raise, out] added to the weapon arm on every guarded line (raise −: higher; out +: out to its side, −: across)
     guard  per line (R L H Lo) the arm's own [raise, out], in place of the shared guard; block: the same for a block
     wrist  per line [tip, turn]: the saber's angle in the fist (tip −: the blade stands up off a forward fist; turn ±:
            laid across). A cut or a bind puts the wrist straight again (the cuts are aimed down the arm)
     grip   'reverse': the blade runs back past the forearm, Ahsoka style, in the guard, the cuts and the binds alike
     twist  the chest's turn in the guard (+ draws the weapon shoulder back: coiled; −: the weapon side leads, side-on)
     lean   the chest's pitch (+ over the front foot)
     drop   how far the hips sink (m): a low stance
     off    the free hand: 'hilt' (both hands on the hilt), or a held pose from OFF_HAND
     wind   [raise, out] added to every wind-up's chamber (Djem So hauls back higher; Ataru winds low)
   Shii-Cho and Niman keep the plain guard: the shared poses with a straight wrist turned up a little. */
const UP = { R: [-1.05, 0], L: [-1.05, 0], H: [0.05, -1.35], Lo: [0.55, 0] };   // the default wrist: a blade stood up off the fist
export const FOE_STANCE = {
  // I — a plain, square guard: the shared poses, the blade stood up off the fist
  shiicho: { wrist: UP, off: 'rest' },
  // II — the fencer: side-on, weapon side leading, arm out long toward you, the point angled up at your eyes, the free
  // hand raised behind for balance
  makashi: { twist: -0.6, lean: 0.04, off: 'fencer',
             guard: { R: [-1.35, 0.35], L: [-1.45, -0.35], H: [-1.95, 0.1], Lo: [-1.0, -0.05] },
             wrist: { R: [-0.55, 0], L: [-0.55, 0], H: [-0.25, -0.9], Lo: [0.2, 0] } },
  // III — the wall: square, the blade held high and forward in front of the face, the free hand out ahead of it
  soresu:  { twist: 0.05, lean: 0.06, drop: 0.06, off: 'ward',
             guard: { R: [-1.5, 0.3], L: [-1.55, -0.5], H: [-2.2, 0.0], Lo: [-1.05, -0.3] },
             wrist: { R: [-1.35, 0.2], L: [-1.35, -0.2], H: [0.1, -1.45], Lo: [0.4, 0] } },
  // IV — the acrobat: low and coiled, weight forward, the blade drawn back alongside the body, the free hand out
  ataru:   { twist: 0.4, lean: 0.22, drop: 0.2, off: 'spring',
             guard: { R: [-0.65, 0.4], L: [-0.85, -0.7], H: [-1.9, 0.3], Lo: [-0.45, -0.25] },
             wrist: { R: [-2.3, 0], L: [-2.1, 0], H: [-0.4, -1.2], Lo: [0.2, 0] }, wind: [0.25, 0.1] },
  // V — the knight: both hands on the hilt, the blade raised high, square to you and heavy
  djemso:  { twist: 0.12, drop: 0.05, off: 'hilt',
             guard: { R: [-1.45, 0.05], L: [-1.45, -0.75], H: [-2.1, -0.45], Lo: [-0.95, -0.6] },
             wrist: { R: [-1.05, 0], L: [-1.05, 0], H: [0.0, -1.3], Lo: [0.5, 0] }, wind: [-0.25, 0] },
  // V — Shien: the reverse grip, the arm held low and forward with the blade running back up along it
  shien:   { grip: 'reverse', twist: 0.25, lean: 0.08, drop: 0.08, off: 'ward',
             guard: { R: [-0.95, 0.55], L: [-1.1, -0.7], H: [-1.9, 0.2], Lo: [-0.55, -0.35] },
             wrist: { R: [0.35, 0], L: [0.35, 0], H: [0.25, 0.7], Lo: [0.1, 0] } },
  // VI — the balance of them all: the plain guard
  niman:   { wrist: UP, off: 'rest' },
  // VII — savage: pitched forward, the blade cocked high and back, the free hand clawed out
  juyo:    { twist: 0.45, lean: 0.18, drop: 0.08, off: 'claw',
             guard: { R: [-2.3, 0.55], L: [-2.2, -0.6], H: [-2.75, 0.3], Lo: [-1.0, -0.2] },
             wrist: { R: [0.75, 0.2], L: [0.75, -0.2], H: [0.05, -1.35], Lo: [0.4, 0.2] }, wind: [-0.2, 0.15] },
  // VII — Vaapad: Juyo's poise held back, the blade up and waiting
  vaapad:  { twist: 0.2, lean: 0.08, drop: 0.06, off: 'claw', arm: [-0.25, 0.1], wrist: UP },
  // THE SABER STAFF on a one-bladed body: carried two-handed and low across the body
  staff:   { twist: 0.1, drop: 0.08, off: 'hilt', arm: [0.1, -0.3], wrist: { R: [-0.2, -1.2], L: [-0.2, -1.2], H: [0.1, -1.4], Lo: [0.4, -1.1] } },
};

/* THE FREE HAND (the acolyte's left arm): where the hand is held while it guards, from its shoulder in metres
   [− out to its left / + across, up, forward], and `tw` the turn of the arm that sets where the elbow points (the
   two-bone reach the staff's hands use: enemies/mesh.js reachPose). Eased in over the arm's own swing. */
export const OFF_HAND = {
  rest:   { at: [-0.1, -0.66, 0.2],   tw: 0.2 },    // loose at its side, a little forward
  fencer: { at: [-0.32, 0.12, -0.28], tw: 1.6 },    // raised behind, the hand up over the shoulder
  ward:   { at: [0.14, -0.18, 0.66],  tw: 0.3 },    // out ahead, open, warding
  spring: { at: [-0.5, -0.4, 0.3],    tw: 0.5 },    // out to the side, low, for balance
  claw:   { at: [0.02, -0.08, 0.52],  tw: 0.9 },    // up and forward, bent, clawed
};
// two hands: where the off hand closes on the hilt (in the saber's own frame: up the hilt from the sword hand, toward the
// pommel), how far it may stretch, and how fast it takes hold or lets go
export const TWO_HAND = { at: [0, 0.13, 0.0], reach: 0.86, rate: 12, tw: 0.4 };

/* THE STAFF (the magnaguard's electrostaff, held in both hands): its guard held ACROSS the body, one end high and one
   low, instead of upright at its side. [rotation.z, rotation.x] per line, in place of data/duel.js GUARD_POSE.staff,
   and the staff drawn in toward the body's middle (`at`, m: [across −, up, forward]) while it guards. */
export const STAFF_STANCE = {
  guard: { R: [0.75, 0.35], L: [2.2, 0.45], H: [-1.0, 0.45], Lo: [1.2, -0.45] },
  at: [-0.3, 0.02, 0.12],
  twist: 0.15, drop: 0.06,
};
// how fast the body settles into its stance (and out of it, into a cut)
export const STANCE_RATE = { body: 7, wrist: 12 };
