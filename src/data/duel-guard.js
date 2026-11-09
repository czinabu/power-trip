// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// YOUR GUARD IN A DUEL: the soft directional block, your own feint, and the sparring (PvP) rules. Tuning only: the
// code is player/jedi/guardline.js (the guard), player/jedi/combat.js cancelSwing + enemies/duel.js (the feint) and
// game/pvp-rules.js (the sparring rules).

/* THE GUARD TURNS — a held guard meets a duellist's strike on the line it comes in on (R its right = your left, L,
   H overhead, Lo the legs; a thrust is still parry-or-dodge). The blade goes there on its own: easy to pick up on a pad
   or a phone. But it TAKES A MOMENT to get there, so a strike that switches sides late (its feint, a quick string, a
   riposte) can find it still on the old side. Watch the wind-up and steer the guard yourself (a flick of the mouse or
   the right stick toward the side the blow comes from, while you hold the guard) and it gets there at once.
     react    s before the guard starts after a wind-up shows on a new line (by difficulty: Padawan gets there sooner)
     turn     s the guard takes to swing over to the new line once it starts (auto)
     manual   s it takes when you steer it yourself (no react delay)
     catchAt  how far through a turn the guard already covers the new line
     hold     s a guard you placed by hand stays where you put it before the automatic guard takes over again
     flick    how hard a flick must be to steer it (× the cut flick's own threshold: data/stances.js CUT_ANGLE.flick)
     range    a duellist this close and in front is the one the guard watches (m)
   What a blow on each kind of guard costs (× the usual block stamina and chip: data/config.js blockStamCost, blockChip):
     clean    on the line you placed it on by hand: the cheapest block in the game
     beaten   on a line the guard isn't covering yet: it still holds, but barely. Run dry on one and the guard breaks */
export const GUARD_TURN = {
  react: { padawan: 0.1, knight: 0.22, master: 0.26 },
  turn: 0.2, manual: 0.09, catchAt: 0.75, hold: 0.9, flick: 1.6, range: 4.6,
  clean:  { stam: 0.6, chip: 0.4 },
  beaten: { stam: 2.2, chip: 2.3, push: 1.6 },
  // the crescent on your own guard: how far in front of the chest it sits (m), and its colours
  ring: { fwd: 0.55, up: 1.3, colour: 0xdff4ff, turning: 0x8aa6c0, clean: 0xffe08a, beaten: 0xff6a3a },
};

/* YOUR FEINT — start a cut at a duellist that reads blades, then break it off into your guard (RMB) early in the
   swing. A guard that read the cut BITES: it swings over to cover the line you faked and stays there `bait` s, and a
   real cut on any other line in that time gets through clean. A guard that has been fooled lately is warier.
     by       the latest a cancel still counts as a feint (share of the swing)
     stam     stamina a feint that bites costs (and you need it to feint at all), on top of the cancel
     bait     s the guard is stuck on the faked line
     bite     the chance it bites on the first feint; each further feint within `memory` s bites `wary`× as often
     reach    how close a guard must be to read the fake (m) */
export const FEINT = { by: 0.4, stam: 8, bait: 0.75, bite: 0.9, wary: 0.55, memory: 5, reach: 4.6, face: 0.55 };

/* SPARRING RULES (PvP) — a duel between two players runs on the same blade rules as the story, with the
   run-to-run edges taken out so the better duellist wins. game/pvp-rules.js has them on while a PvP duel is (G.duel.pvp).
     matchup   × the form counter's edge (data/foe-forms.js MATCHUP): a counter form helps, it doesn't decide the duel
     ramp      the elite skill ramp is off: everyone fights at their listed skill
     upkeep    stamina per second a held guard costs while nothing is hitting it (turtling loses), after `upkeepAfter` s held
   (the run's upgrades, skills and Force level are set to base by the duel mode itself) */
export const DUEL_PVP = { matchup: 0.5, ramp: false, upkeep: 6, upkeepAfter: 1.2 };
