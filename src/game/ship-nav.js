// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SHIP'S NAVIGATION (data/hero-ships.js): where each hero's ship is, and the course plotted from there. The two
// stations aboard split the work between them:
//   · the GALAXY MAP (ui/galaxy-ui.js galaxyPanel) is the chart. You browse every world and your story across them, and
//     PLOT A COURSE to one. It launches nothing.
//   · the HELM / COCKPIT (ui/galaxy-ui.js helmPanel) flies it. It shows the course, launches what's on the world at the
//     end of it (the ship jumps there first: ui/hyperspace.js), and holds the voyages that aren't tied to one world.
// The ship stays at the last world it jumped to (kept in localStorage per hub, a look only, not save progress), so the
// map's marker and the planet out of the cabin's window (world/arenas/hero-ship.js) are where you last went.
//
// CO-OP: the host's ship is the party's, so the host's course and position are sent to the guests (shipnav) whenever
// they change or the host opens either station, and a guest's map and helm show those.

import { G } from '../state.js';
import { GALAXY, homeWorld } from '../data/hero-ships.js';
import { net, on, send } from '../net/session.js';

const KEY = 'sw_ship_at';   // { hubId: worldId }
const byId = (id) => GALAXY.find(w => w.id === id) || null;
const asGuest = () => net.role === 'guest' && net.status === 'connected';
let course = null;    // the world plotted (this session only), or null: none, or the ship is already there
let hostNav = null;   // a guest: { hub, at, course } as the host last sent it

function stored(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return {}; } }

/* the world the ship is at (its hub's home world until it first jumps) */
export function shipAt(hubId = G.hubId){
  if (asGuest() && hostNav && hostNav.hub === hubId && byId(hostNav.at)) return byId(hostNav.at);
  return byId(stored()[hubId]) || homeWorld(hubId);
}
/* the world the course is plotted to, or null */
export function shipCourse(hubId = G.hubId){
  if (asGuest()) return hostNav && hostNav.hub === hubId ? byId(hostNav.course) : null;
  const c = byId(course);
  return c && c.id !== shipAt(hubId).id ? c : null;
}
/* plot a course (the galaxy map); plotting the world the ship is at clears it */
export function plotCourse(id){
  if (asGuest() || !byId(id)) return false;
  course = id === shipAt().id ? null : id;
  shareNav();
  return true;
}
export function clearCourse(){ if (asGuest()) return; course = null; shareNav(); }
/* the ship made the jump (the helm): it's there now, and the course is flown */
export function arriveAt(id, hubId = G.hubId){
  if (asGuest() || !byId(id)) return;
  const s = stored(); s[hubId] = id;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){}
  if (course === id) course = null;
  shareNav();
}
/* the raid, picked at the helm with a course plotted: its page opens first, and BEGIN there makes the jump (ui/hub-ui.js) */
let raidJump = null;
export const armRaidJump = (w) => { raidJump = w || null; };
export const takeRaidJump = () => { const w = raidJump; raidJump = null; return w; };
/* host: tell the party where the ship is and where it's headed */
export function shareNav(){
  if (net.role !== 'host' || net.status !== 'connected') return;
  const c = shipCourse();
  send({ t: 'shipnav', hub: G.hubId, at: shipAt().id, course: c ? c.id : null });
}
on('shipnav', (m) => { if (net.role === 'guest') hostNav = { hub: m.hub, at: m.at, course: m.course }; });
