// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DEPTH & SCALE — the tricks that make a map read as a big place you stand in, not a tabletop you look down on.
// Older third-person Star Wars games (Jedi Academy, Bounty Hunter, Battlefront II) feel huge with simple models because
// every big surface carries details of a known, person-sized scale, and the far distance goes LIGHTER, not darker.
// Purely visual; every mode and every hero gets it (it lives on the arena's baked props and the atmosphere). Edit freely.

/* SCALE DETAIL (world/ink.js): man-made blocks taller than the hero (walls, towers, bunkers, pillars, ship hulls) get
   panel seams and storey courses in world metres, so the eye can count how many hero-heights a wall rises. Rocks, trees
   and anything round never get it (only box shapes do), and low cover stays plain.
     minH     a box at least this tall (m) takes the detail (the hero stands ~2.7 m)
     panel    width of one panel (m) along a wall
     storey   height of one course / storey (m)
     line     half-width of a seam (m)
     seam     how much darker a seam is (share of the colour)
     jitter   each panel's value nudged by up to ±half this, so a wall reads as many plates, not one sheet
     lit      night maps only (theme fog dark enough): share of storey-panels on buildings over litH m that carry a lit
              window slot, in the theme's lamp colour; 0 turns them off
     litH     a box at least this tall gets lit windows */
export const DETAIL = { minH: 3.4, panel: 2.6, storey: 3.3, line: 0.05, seam: 0.26, jitter: 0.12, lit: 0.12, litH: 7 };

/* AERIAL PERSPECTIVE (world/atmosphere.js): the far distance fades toward the sky's horizon glow and never into near
   black, so silhouettes layer back instead of the world ending in a dark wall a few dozen metres out.
     lift     share of the way the theme's fog colour moves toward its sky horizon colour
     minL     the fog is never darker than this lightness (HSL, 0–1): night maps fade to a moonlit haze, not to black
     push     fog distances scale by this (the near edge further out, so the middle distance stays crisp) */
export const AERIAL = { lift: 0.45, minL: 0.17, push: 1.2 };
