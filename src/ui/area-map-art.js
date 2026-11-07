// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE AREA MAP'S ART: the room you are in (a story mission's or a campaign chapter's map, a hub's wing, a battle map)
// drawn as the same flat, inked plan as an open zone's (ui/zone-map-art.js), for the corner minimap and the full map
// (ui/area-map.js). An arena has no plan to read, so it is drawn from what was actually built: the solids every body
// collides with (world/collision.js), each one's footprint, shaded by how tall it stands. Nothing here is per map: a new
// arena, or a new kind of prop, maps itself the moment it has collision.
//
// The art is drawn once per build and again whenever the solids change (a door opening, a wall blown through), at most
// every AREA_ART.redraw seconds. Colours come from the arena's world (data/worlds.js themeFor: its floor and palette).

import { G, shared, solids } from '../state.js';
import { themeFor } from '../data/worlds.js';
import { mapColours, inkFootprints, isFootprint } from './zone-map-art.js';

export const AREA_ART = {
  ppm: 4,          // canvas pixels per metre (a battle map is drawn coarser, to stay under maxPx)
  maxPx: 2048,     // the canvas's widest side
  margin: 6,       // m of ground drawn round the playable square
  redraw: 1,       // s: the soonest the art is drawn again after the solids change
};

let art = null, artGroup = null, artN = -1, artAt = -99;
/* the art for the arena that is up: { canvas, ppm, x0, z0, size, hx, hz } (x0 / z0: the world spot at the canvas's
   top-left corner, in metres; hx / hz: the playable half width and depth; outside: the colour past its edge) */
export function areaMapArt(){
  const fresh = artGroup !== shared.arenaGroup;
  if (art && !fresh && (artN === solids.length || G.gt - artAt < AREA_ART.redraw)) return art;
  artGroup = shared.arenaGroup; artN = solids.length; artAt = G.gt;
  const hx = shared.arenaHalf || 30, hz = shared.arenaHalfZ || hx;
  const half = Math.max(hx, hz) + AREA_ART.margin, size = half * 2;
  const ppm = Math.min(AREA_ART.ppm, AREA_ART.maxPx / size);
  const cv = art && !fresh && art.canvas.width === Math.round(size * ppm) ? art.canvas : document.createElement('canvas');
  cv.width = cv.height = Math.round(size * ppm);
  const c = cv.getContext('2d'), C = colours();
  c.setTransform(ppm, 0, 0, ppm, half * ppm, half * ppm);   // world metres in, the arena's middle at the canvas's middle
  c.fillStyle = C.outside; c.fillRect(-half, -half, size, size);
  c.fillStyle = C.ground; c.fillRect(-hx, -hz, hx * 2, hz * 2);
  const foot = [];
  for (const s of solids){
    if (!isFootprint(s)) continue;
    const r = s.mound ? Math.max(s.a, s.b) : s.box ? Math.max(s.hx, s.hz) : s.r || 0;
    if (Math.abs(s.x) - r > half || Math.abs(s.z) - r > half) continue;   // (the backdrop's far hills)
    foot.push(s);
  }
  inkFootprints(c, foot, C, ppm);
  // the playable edge, inked like the arena's own edge line
  c.strokeStyle = C.ink; c.lineWidth = 2 / ppm; c.strokeRect(-hx, -hz, hx * 2, hz * 2);
  art = { canvas: cv, ppm, x0: -half, z0: -half, size, hx, hz, outside: C.outside };
  return art;
}

function colours(){
  const T = (shared.arenaLevel && themeFor(shared.arenaLevel)) || {}, pal = T.pal || {}, floor = (T.floor && T.floor.base) ?? 0x8f8575;
  // the floor is the street here: the palest thing on the map, the props shaded from it toward the world's dark trim
  return mapColours({ ...pal, stone: floor, roof: pal.stoneD ?? pal.metalD ?? pal.roof ?? pal.dark ?? 0x4a3a2c }, T.outer ?? floor);
}
