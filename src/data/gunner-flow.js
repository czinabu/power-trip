// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GUNNERS' FLOW METERS, as data: the Mandalorian's HUNTER'S EYE and the ARC trooper's BATTLE RHYTHM. Their answer to
// the Jedi's Focus (player/jedi/focus.js), built on what each hero is good at rather than copied from it. Edit freely.
// player/gunner-flow.js runs both; the HUD shows them on the meter over vitality (ui/hud.js, #gfmeter).
//
// Each fills 0..100 from the play its hero is meant for, drains out of the fight, and is cut when the hero is caught.
// Tier 1 and 2 are passive edges; tier 3 (a full meter) readies the hero's SIGNATURE MOVE on its own key, which spends it.
//   thresh   the meter value each tier starts at (tier 3 = full)
//   decay    per second lost once out of the fight (no gain for `idle` s) · `ebb` per second lost while the signature waits
//   gain     what each feat adds
//   hurt     the share kept when a hit lands (`hurtCover`: the trooper, hit while in cover)
//   names    the tier names on the meter

/* HUNTER'S EYE — the Mandalorian: precision and style. Headshots, ricochets, kills on the wing and the vibroblade. */
export const HUNT = {
  thresh: [34, 67, 100], decay: 9, ebb: 2.5, idle: 2.2,
  gain: { head: 9, ricochet: 14, airKill: 12, kill: 3, takedown: 14, headKill: 6 },
  hurt: 0.6,
  names: ['', 'STEADY', 'ON THE HUNT', 'DEAD EYE'],
  steady: 0.7,      // tier 1+: the reticle's bloom and the blasters' cone × this
  jetRegen: 1.45,   // tier 2+: the jetpack's fuel comes back × this
  /* DEAD EYE (the signature, T · pad LB + R3): the world drops into slow motion, he tags up to `max` heads nearest the
     reticle (on screen, in `range` m, in clear sight) and puts one bolt through each, `gap` s of game time apart.
     dmg is each bolt's damage before the headshot multiplier; speed its bolt speed. `slow` / `hold` the slow motion
     (solo only: a co-op world can't slow for one hero). `cone` how far off the reticle (screen units, 0..1) a head may be. */
  deadEye: { max: 3, range: 46, cone: 0.55, gap: 0.07, delay: 0.08, dmg: 48, speed: 140, slow: 0.25, hold: 0.55, color: 0xffc46a },
};

/* BATTLE RHYTHM — the ARC trooper: position and teamwork. Perfect vents, pins, flanks, the squad's kills and moving
   cover to cover under fire. Out in the open a hit breaks it far more than one taken in cover. */
export const RHYTHM = {
  thresh: [34, 67, 100], decay: 8, ebb: 2.5, idle: 2.4,
  gain: { vent: 14, pin: 6, flank: 4, flankKill: 10, coverKill: 5, kill: 3, squadKill: 4, coverMove: 8 },
  hurt: 0.55, hurtCover: 0.88,
  names: ['', 'STEADY', 'IN STEP', 'COORDINATED FIRE'],
  coverMove: 3.0,   // a dash to new cover counts as cover-to-cover if he left the last one this recently (s)...
  coverSupp: 0.3,   // ...or if he gets into cover while at least this suppressed
  flankDot: 0.25,   // a shot counts as a FLANK when it strikes the foe from its side or back (its facing · the shot's way > this)
  steady: 0.5,      // tier 1+: the shake suppression puts in his aim × this
  cpGain: 1.5,      // tier 2+: command points come in × this
  /* COORDINATED FIRE (the signature, Y · pad LB + L3): the foe nearest the reticle is marked and every standing
     squadmate in `reach` m puts a heavy bolt into it on his call, `gap` s apart. dmg is each bolt's (elites and heavies
     take it too). `slow` / `hold` as Dead Eye's (solo only). `cone` as Dead Eye's. */
  volley: { reach: 45, range: 60, cone: 0.6, gap: 0.06, delay: 0.12, dmg: 42, speed: 90, slow: 0.4, hold: 0.45, color: 0x6ab8ff },
};
