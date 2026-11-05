// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MAP SCALE: which authored arenas are built wider than they were laid out, and the real cover laid into the open gaps
// of a map (the cover pass). Edit freely.

/* SPREAD — layout: the width (m) its builder was authored at. A level on that layout with a bigger `arena` is built at
   the authored size and pulled apart to fit (world/spread.js): the lanes and yards grow, the props keep their size, and
   the story missions' points move with them. The ARC trooper's story maps, grown the way the Jedi's were (Tessaril went
   64 → 84 m). Their levels (data/missions.js, data/campaign-trooper.js) carry the new widths. */
export const SPREAD = {
  jungle: 76, shipyard: 64, garrison: 60, frigate: 56, kamino: 60, chipworks: 60, warcamp: 64, canyon: 64, relay: 64,
};

/* COVER FILL — real cover (something to put your back to: TROOPER.cover, player/trooper/cover.js) laid into the holes
   of a map, after its own builder and before the perches and the pathing grid (world/coverfill.js). It looks for the
   open floor furthest from any cover face at least 2 m long, and stands a piece there until no floor inside `ring`
   (share of the half size) is more than `hole` m from cover, or `max` pieces are down. Pieces keep `lane` m clear of
   every other solid (no new chokes for the brutes or the pathing grid), `keep` m clear of every mission point, the
   spawn, hazards and doors, and stand across the line to the middle, so they shelter you from the fight.
     style  what they are (world/coverfill.js STYLES): barricade · crates · sandbags · rocks · stone · plates · ice · logs
     big    the battle maps: longer walls, taller stacks, a coarser search
   Layouts not listed get none (the walled training rooms and the sandbox rooms, the long chase, the hub). */
export const COVER_FILL = {
  // the ARC trooper's story
  jungle:    { style: 'logs',      hole: 4.5, max: 22 },
  shipyard:  { style: 'crates',    hole: 4.5, max: 24 },
  garrison:  { style: 'barricade', hole: 4.5, max: 22 },
  frigate:   { style: 'crates',    hole: 4.5, max: 22 },
  kamino:    { style: 'barricade', hole: 4.5, max: 22 },
  chipworks: { style: 'crates',    hole: 4.5, max: 22 },
  warcamp:   { style: 'sandbags',  hole: 4.5, max: 24 },
  canyon:    { style: 'rocks',     hole: 4.5, max: 24 },
  relay:     { style: 'barricade', hole: 4.5, max: 24 },
  // the trooper's sandbox room
  hangar:    { style: 'crates',    hole: 5.5, max: 10 },
  // survival's rotation (the campaign arenas every hero fights on)
  temple:    { style: 'stone',     hole: 6,   max: 10 },
  foundry:   { style: 'barricade', hole: 6,   max: 12 },
  plains:    { style: 'stone',     hole: 6,   max: 16 },
  // the battle maps (and the chapters staged on their plans)
  grassland: { style: 'sandbags',  hole: 7,   max: 40, big: true },
  approach:  { style: 'stone',     hole: 7,   max: 40, big: true },
  ironroad:  { style: 'barricade', hole: 7,   max: 40, big: true },
  icefront:  { style: 'ice',       hole: 7,   max: 40, big: true },
  graveyard: { style: 'plates',    hole: 7,   max: 50, big: true },
};
