// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// YOUR GUARD IN A DUEL: the soft directional block, your own feint, and the sparring (PvP) rules. Tuning only: the
// code is player/jedi/guardline.js (the guard), player/jedi/combat.js cancelSwing + enemies/duel.js (the feint) and
// game/pvp-rules.js (the sparring rules).

/* THE GUARD TURNS — a held guard meets a duellist's strike on the line it comes in on (R its right = your left, L,
   H overhead, Lo the legs; a thrust is still parry-or-dodge). The blade goes there on its own: easy to pick up on a pad
   or a phone. But it TAKES A MOMENT to get there. How long depends on what it is answering:
     react    the first strike of an attack: s before the guard starts after the wind-up shows (by difficulty)
     string   the next cut of a string, or the next beat of an exchange: the guard is already in the fight and goes at once,
              so an honest string is always covered (it used to be a coin flip on the frame it landed)
     fooled   a FEINT (the line switches in the middle of a wind-up): the guard went for the fake and is this slow to come
              back. On Knight and Master that is too late: steer it yourself. On Padawan it still gets there.
   Steer the guard yourself with the controls that aim a cut (while you hold the guard: a flick of the mouse or the
   right stick toward the side the blow comes from, or that direction pressed on the movement keys or the left stick:
   A left, D right, W overhead, S the legs) and it gets there at once. A guard placed by hand answers the strike that was showing when you placed it;
   the next strike (or a switch of line) hands it back to the automatic guard, so a clean block never costs you the cut
   that follows it.
     turn     s the guard takes to swing over to the new line once it starts (auto)
     manual   s it takes when you steer it yourself (no react delay)
     catchAt  how far through a turn the guard already covers the new line
     hold     s a guard you placed by hand stays where you put it before the automatic guard takes over again
     flick    how hard a flick must be to steer it (× the cut flick's own threshold: data/stances.js CUT_ANGLE.flick)
     keyLead  a direction pressed this long (s) before the guard goes up still places it (one held longer is only you moving)
     range    a duellist this close and in front is the one the guard watches (m)
   What a blow on each kind of guard costs (× the usual block stamina and chip: data/config.js blockStamCost, blockChip):
     clean    on the line you placed it on by hand: the cheapest block in the game
     beaten   on a line the guard isn't covering yet: it still holds, but barely. Run dry on one and the guard breaks */
export const GUARD_TURN = {
  react: { padawan: 0.1, knight: 0.22, master: 0.26 },
  string: 0.04,
  fooled: { padawan: 0.12, knight: 0.5, master: 0.56 },
  turn: 0.2, manual: 0.09, catchAt: 0.75, hold: 0.9, flick: 1.25, keyLead: 0.3, range: 4.6,
  clean:  { stam: 0.6, chip: 0.4 },
  beaten: { stam: 2.2, chip: 2.3, push: 1.6 },
  // the crescent on your own guard: how far in front of the chest it sits (m), and its colours (placed: how bright it
  // pulses, 0 … 1, as you send it somewhere by hand)
  ring: { faint: 0.2, placed: 0.75, fwd: 0.55, up: 1.3, colour: 0xdff4ff, turning: 0x8aa6c0, clean: 0xffe08a, beaten: 0xff6a3a },
  /* THE STRIKE MARK — where the next blow is coming from, and when. A wedge outside your guard's crescent on the side a
     duellist is winding up on (whether or not your guard is up), closing in on the crescent as the blow nears and
     meeting it as it lands: the side to guard, and the beat to parry on. Orange while that side is open, pale once your
     guard covers it. A feint makes it jump sides with a white flash and a double tick. A thrust (no guard holds it) is a
     small white ring closing on the middle. Shown with the GUARD RINGS setting: always on Padawan and Knight, on Master
     only with GUARD RINGS on ALWAYS, never with it OFF.
       from   how far out the wedge starts (× the crescent's radius) · lead: s before the blow it starts closing
       open / covered / feint / thrust   its colours · pop: how far the feint's flash throws it out */
  mark: { from: 1.55, lead: 0.6, rest: 1.14, open: 0xff7a2a, covered: 0xdff4ff, feint: 0xffffff, thrust: 0xffe6e0, pop: 0.3 },
};

/* YOUR FEINT — start a cut at a duellist that reads blades, then break it off into your guard (RMB) early in the
   swing. A guard that read the cut BITES: it swings over to cover the line you faked and stays there `bait` s (its
   crescent burns bright for as long as it is fooled), and a real cut on any other line in that time gets through clean.
   A guard that has been fooled lately is warier.
     by       the latest a cancel still counts as a feint (share of the swing)...
     grace    ...or this many seconds after the cut began, whichever is later (a quick form's cut is over in a blink), as
              long as the blade has not touched anything yet
     stam     stamina a feint that bites costs (and you need it to feint at all), on top of the cancel
     bait     s the guard is stuck on the faked line
     bite     the chance it bites on the first feint; each feint that FOOLED it within `memory` s makes it bite `wary`× as
              often (a feint it saw through doesn't add to that). A training partner always bites.
     reach    how close a guard must be to read the fake (m)
   The real cut: while the bait lasts LMB cuts even with the guard still held (no need to let go of RMB first), the cut
   that was faked doesn't count toward the string (so the real one is never forced into the finisher's overhead), and a
   form's cancel step (Ataru's hop, Makashi's retreat) and Djem So's slow recovery are skipped, so you are still in reach. */
export const FEINT = { by: 0.55, grace: 0.3, stam: 8, bait: 1.1, bite: 0.9, wary: 0.7, memory: 5, reach: 4.6, face: 0.55 };

/* SPARRING RULES (PvP) — a duel between two players runs on the same blade rules as the story, with the
   run-to-run edges taken out so the better duellist wins. game/pvp-rules.js has them on while a PvP duel is (G.duel.pvp).
     matchup   × the form counter's edge (data/foe-forms.js MATCHUP): a counter form helps, it doesn't decide the duel
     ramp      the elite skill ramp is off: everyone fights at their listed skill
     upkeep    stamina per second a held guard costs while nothing is hitting it (turtling loses), after `upkeepAfter` s held
   (the run's upgrades, skills and Force level are set to base by the duel mode itself) */
export const DUEL_PVP = { matchup: 0.5, ramp: false, upkeep: 6, upkeepAfter: 1.2 };
