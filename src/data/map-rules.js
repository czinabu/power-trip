// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MAP RULES: what changes with the size of the arena you're fighting in (the map-size pass). Edit freely.

/* SNIPERS need room. A marksman reaches 32 m (data/enemies.js), so on an arena narrower than `minArena` one on the edge
   covers nearly the whole floor and there is nowhere out of its line to fall back to. On those arenas a wave's, a
   mission's or survival's sniper arrives as `swap` instead (enemies/spawn.js). The sandbox still sends what you call
   in, training still teaches the marksman, and a co-op guest shows whatever the host sent. */
export const SNIPER_ROOM = { minArena: 60, swap: 'blaster' };

/* THE JETPACK'S CEILING. Held SPACE climbs about 5 m a second for as long as the fuel lasts: on a 56 m courtyard that
   is three times higher than anything there is to land on. On a campaign or story arena (not a battle map or the long
   chase) the climb fades out over the last `fade` m below a ceiling of the arena's tallest standable top plus `over`,
   never lower than `min` (player/mando/flight.js). Hover, the boost and the dive are untouched. */
export const JET_CEILING = { over: 6, min: 14, fade: 3 };
