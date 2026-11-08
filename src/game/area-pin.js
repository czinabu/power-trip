// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// YOUR OWN WAYPOINT in a mapped room (a story map, a hub's wing: ui/area-map.js), the open zone's waypoint
// (game/zone.js zonePin) everywhere else there is a map. Set on the full map; a cream pin on the compass and the
// minimap until you get there, clear it, set another, or the room changes. One per player, never shared.

import { shared } from '../state.js';
import { V3 } from '../utils.js';
import { playerPos } from '../player/helpers.js';
import { floater } from '../fx/floaters.js';

const REACH = 4;   // m: close enough to the waypoint that it has done its job
let pin = null;
// the waypoint, if it is still on this room's map (checked each frame by ui/zone-map.js: reached, it says so and goes)
export function areaPin(){
  if (pin && pin.room !== shared.arenaGroup) pin = null;
  return pin;
}
export function setAreaPin(x, z){ pin = { x, z, room: shared.arenaGroup }; return pin; }
export function clearAreaPin(){ pin = null; }
export function checkAreaPin(){
  const P = areaPin(); if (!P) return;
  const p = playerPos();
  if (Math.hypot(P.x - p.x, P.z - p.z) < REACH){ pin = null; floater(V3(p.x, 2.6, p.z), 'WAYPOINT REACHED', '#f3e7c4'); }
}
