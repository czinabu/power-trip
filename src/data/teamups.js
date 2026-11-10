// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TEAM-UP MOVES (game/teamup.js): things two heroes do together that neither can do alone. A prompt comes up when a
// partner is close and the setup is right; both players press U (a pad: D-pad down while the prompt is up) within a
// couple of seconds of each other, and a short shared move plays on every screen. Solo, the hero's apprentice or a
// squadmate does a simpler version on one press.
//
// Every move trades TIME and POSITIONING for its payoff: both heroes stand committed for its length (no other move, no
// dodge), they have to be in range of each other and of the target, and each hero then waits `cd` seconds before the
// next one. Bosses take a capped share (a raid boss's sunder bar takes a chunk instead: boss/finale.js teamupSunder).
//
// A move's two parts are its two heroes: heroes[0] plays part A, heroes[1] part B. Two of the same hero: the lower seat
// plays part A. Everything here is in metres and seconds.

export const TEAMUP = {
  key: 'u',            // the keyboard key (a pad: D-pad down, while a prompt is up: data/gamepad.js `teamup`)
  near: 16,            // a partner (or an ally, solo) must be within this of you for any prompt
  window: 2.5,         // s: the second press has to come this soon after the first
  cd: 22,              // s each hero waits after a team-up before the next (co-op)
  soloCd: 28,          // ...and solo, with an apprentice or a squadmate
  soloMul: 0.65,       // a solo team-up hits this share as hard as the two-hero one
  check: 0.12,         // s between checks for a setup (the prompt)
  boss: { cap: 0.05, sunder: 0.22 },   // on a boss: at most this share of its health per team-up; a raid boss's sunder bar fills this share instead
  slowmo: 0.5, slowT: 0.3,             // the beat as it lands, on every screen
};

/* THE MOVES. reach: the farthest part A's hero may stand from the target; far: part B's; gap: the farthest the two heroes
   may stand apart. dur: how long both are committed. hit: when (s after the go) the payoff lands. dmg: base damage. */
export const TEAMUPS = {
  // Jedi + Mando: the Jedi lifts a foe high in the Force, the Mando's rocket meets it in the air
  lift: { name: 'LIFT & LAUNCH', heroes: ['jedi', 'mando'], reach: 14, far: 30, gap: 24, dur: 1.4, hit: 1.0, rise: 3.4,
          dmg: 140, splash: 4.5, splashDmg: 45, knock: 18,
          says: ['Lift it!', 'Rocket away.'] },
  // Mando + Jedi: the Mando hauls the Jedi up on the jetpack and drops them into the crowd: a plunging Force slam
  carry: { name: 'JETPACK DROP', heroes: ['mando', 'jedi'], reach: 8, far: 26, gap: 7, dur: 1.5, hit: 1.25, min: 2, crowd: 5, height: 7,
           dmg: 60, radius: 5.5, knock: 16, pack: true,
           says: ['Grab on!', 'Drop me in!'] },
  // Trooper + Jedi: the trooper's fire pins a duellist (or any blade foe), the Jedi closes and finishes it
  pin: { name: 'PIN & FINISH', heroes: ['trooper', 'jedi'], reach: 35, far: 8, gap: 30, dur: 1.5, hit: 0.45, pinT: 2.2,
         dmg: 30, says: ['Pinning him!', 'He\'s mine.'] },
  // Jedi + trooper: the Jedi throws a Force barrier over the trooper and the squad; enemy bolts die on it
  barrier: { name: 'SHIELD DOME', heroes: ['jedi', 'trooper'], reach: 9, far: 9, gap: 9, dur: 1.0, hit: 0.35, radius: 7.5, life: 7, shooters: 2,
             says: ['Everyone in!', 'Squad, on me!'] },
  // Trooper + Mando: the trooper marks up to four foes, the Mando's micro-rockets take every mark at once
  mark: { name: 'MARKED VOLLEY', heroes: ['trooper', 'mando'], reach: 40, far: 40, gap: 30, dur: 1.3, hit: 0.95, marks: 4, spread: 12, min: 2,
          dmg: 70, says: ['Targets marked!', 'Birds away.'] },
  // Trooper + Mando: the trooper's frag flushes a crowd, the Mando's flamer sweeps it
  sweep: { name: 'FIRE SWEEP', heroes: ['trooper', 'mando'], reach: 20, far: 12, gap: 16, dur: 1.6, hit: 0.6, burn: 0.9, min: 3, crowd: 6,
           dmg: 55, burnDmg: 70, radius: 6, knock: 12,
           says: ['Frag out!', 'Burn them out.'] },
  // Jedi + Jedi: two pushes as one, a wave that floors anything in front, even the big ones reel
  push: { name: 'TWIN PUSH', heroes: ['jedi', 'jedi'], reach: 12, far: 12, gap: 8, dur: 1.0, hit: 0.4, min: 2, range: 15, cone: 0.55,
          dmg: 45, knock: 26, says: ['Together!', 'Now!'] },
  // Jedi + Jedi: back to back in a crowd, a spinning cut all round, then each guards the other's back for a while
  backs: { name: 'BACK TO BACK', heroes: ['jedi', 'jedi'], reach: 7, far: 7, gap: 4, dur: 0.9, hit: 0.35, min: 3, ring: 7.5, cut: 4.2, guard: 8,
           dmg: 40, knock: 10, says: ['I\'ve got your back.', 'And I yours.'] },
};

// which moves a pair can do, the first whose setup is right is offered (pair key: the two heroes, sorted)
export const PAIRS = {
  'jedi+mando': ['carry', 'lift'],
  'jedi+trooper': ['pin', 'barrier'],
  'mando+trooper': ['sweep', 'mark'],
  'jedi+jedi': ['backs', 'push'],
};
export const pairKey = (a, b) => [a, b].sort().join('+');

/* SOLO: the hero's apprentice or a squadmate does a simpler version, on one press (allies/apprentice.js, allies/squad.js).
   ally: who it takes (apprentice: the Padawan or the foundling; squad: any squadmate). The ally plays the other part. */
export const SOLO = {
  jedi: [{ k: 'push', ally: 'apprentice' }, { k: 'pin', ally: 'squad' }, { k: 'backs', ally: 'any' }],
  mando: [{ k: 'mark', ally: 'any' }],
  trooper: [{ k: 'sweep', ally: 'squad' }, { k: 'mark', ally: 'squad' }],
};
