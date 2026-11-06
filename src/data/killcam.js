// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE KILL CAM, as data. engine/killcam.js runs it, engine/camera.js blends the shot in.

/* THE KILL CAM — a big kill gets a short cinematic beat: the lens swings off the hero's back to a low side-on shot of
   the hero and the foe, the world drops into slow motion and thin letterbox bars slide in, then it all hands back.
   It's visual only: the whole world slows together (the hero no faster than the foes), it never fires while anything
   else is still a threat, and anything that becomes one (a foe closing, a shot on the way, a blow landing) ends it at
   once. Moving, attacking, aiming or jumping cuts it short too. Settings · KILL CAM turns it off.

   kinds    what earns one:
            last   the last foe of a fight falls (nothing left and nothing waiting to come in)
            duel   a saber finisher kills a duellist, a champion or the Warbringer, with nobody else close
            boss   a boss goes down (his minions and shots are already cleared by then)
            takedown  the Mandalorian's vibroblade takedown kills (player/gunner-flow.js), with nobody else close
            flank  the ARC trooper drops a foe from its flank or while it's pinned, or with his squad's
                   COORDINATED FIRE (player/gunner-flow.js), with nobody else close
            per kind: dur (s, real time) · slow (the world's speed through the hold) · dist (m, lens out to the side)
            · back (m, lens back behind the hero along the line) · up (m, lens height off the hero's feet) · look (m,
            aim height) · fov (° narrower) · orbit (rad the lens drifts round over the shot)
   blend    seconds to ease in / out (real time); `cut` is the faster ease out when something ends it early
   safe     who counts as a threat: any hostile foe within `melee` m (`ranged` m for a shooter), an enemy shot within
            `bolt` m, a boss still fighting. `far`: a kill further than this from the hero (a partner's) gets none
   follow   how far (m) the aim may follow the foe's body as the blow flings it
   hud      how much of the HUD shows through the shot (it fades back as the shot hands back)
   grace    seconds before the hero's own input can cut it short (the press that landed the kill is still held)
   cd       seconds after one before another can start (a boss is never held back by it)
   coop     a shared fight: the world can't be slowed for one hero, so no slow motion, and the shot is this short (×dur)
   bars     the letterbox, as a share of the screen height, top and bottom */
export const KILLCAM = {
  kinds: {
    last: { dur: 1.35, slow: 0.3,  dist: 4.4, back: 0.35, up: 1.05, look: 1.05, fov: 6, orbit: 0.32 },
    duel: { dur: 1.2,  slow: 0.28, dist: 4.0, back: 0.3,  up: 1.0,  look: 1.1,  fov: 7, orbit: 0.28 },
    takedown: { dur: 1.15, slow: 0.28, dist: 3.4, back: 0.25, up: 0.85, look: 0.95, fov: 8, orbit: 0.3 },
    flank: { dur: 1.2, slow: 0.3, dist: 4.6, back: 0.4, up: 1.15, look: 1.1, fov: 6, orbit: 0.26 },
    boss: { dur: 2.1,  slow: 0.3,  dist: 6.2, back: 0.6,  up: 1.4,  look: 1.6,  fov: 5, orbit: 0.4 },
  },
  blend: { in: 0.22, out: 0.45, cut: 0.18 },
  safe: { melee: 14, ranged: 24, bolt: 12, far: 14 },
  follow: 3.5, hud: 0.3,
  grace: 0.35,
  cd: 5,
  coop: 0.55,
  bars: 0.075,
};
