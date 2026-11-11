// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DROP IN MID-RUN: a co-op player who joins a story mission (or a mission chapter) or an open zone after the host has
// moved on doesn't start back at the map's opening spot, a long walk from the fight. As soon as the host (or any partner)
// is seen on the same map, the newcomer is set down WITH THE SQUAD, a few steps behind them; in an open zone, at the
// WAYSTONE nearest the host when there is one close by (and it counts as touched). If no partner shows up in time, a
// mission drops them at the start of the objective the host is on, the mission's own checkpoint.
// Armed by game/mission.js (a guest's start) and game/zone.js (a guest's zone); stepped from net/foes.js on each sync.

import { G, player } from '../state.js';
import { CFG } from '../data/config.js';
import { playerPos } from '../player/helpers.js';
import { findClearSpawn } from '../world/collision.js';
import { partnerStand } from '../net/partner.js';
import { regroupSquad } from '../allies/squad.js';
import { showBanner } from '../ui/banners.js';

const NEAR = 18;     // m: already this close to the party, the newcomer stays where they are
const WAIT = 8000;   // ms to wait for a partner to be seen before the fallback
const SETTLE = 1200;   // ms a partner is seen before their spot is trusted
const STONE = 40;    // m: a waystone at most this far from the host is where a zone drop-in lands

// kind: 'mission' | 'zone'. fallback(): a mission's checkpoint for the objective the host is on, or null
let pending = null;
export function armDropIn(kind, opts = {}){ pending = { kind, until: performance.now() + WAIT, ...opts }; }
export const cancelDropIn = () => { pending = null; };

export function stepDropIn(){
  const p = pending;
  if (!p) return;
  if (!G.coopGuest || G.mode !== 'play'){ if (G.mode !== 'play' && G.mode !== 'menu') return; pending = null; return; }
  const party = partnerStand();
  const host = party.find(s => s.slot === 0) || party[0];
  const me = playerPos();
  if (!p.from) p.from = { x: me.x, z: me.z };
  if (Math.hypot(me.x - p.from.x, me.z - p.from.z) > 4){ pending = null; return; }   // already on their way (or moved by the game): leave them be
  if (host){
    // (a partner's figure glides to where their screen says they are as it first shows: give it a moment to get there)
    if (!p.seen){ p.seen = performance.now(); return; }
    if (performance.now() - p.seen < SETTLE) return;
    pending = null;
    const hx = host.pos.x, hz = host.pos.z;
    if (Math.hypot(me.x - hx, me.z - hz) < NEAR) return;
    // an open zone: the waystone by the host, when there's one close by
    const stone = p.stones && p.stones().reduce((b, w) => { const d = Math.hypot(w.x - hx, w.z - hz); return d < STONE && (!b || d < b.d) ? { w, d } : b; }, null);
    if (stone){ p.land(stone.w); showBanner(stone.w.name, 'You arrive by the waystone, near the party.', 2.2, { kicker: 'DROPPED IN' }); return; }
    // with the squad: a few steps behind and beside the host, facing the way they face
    const yaw = host.yaw || 0, bx = Math.sin(yaw), bz = Math.cos(yaw);   // (the hero's forward is +sin, +cos of its yaw)
    put(hx - bx * 3 + bz * 1.8, hz - bz * 3 - bx * 1.8, yaw);
    showBanner('', 'DROPPED IN WITH THE SQUAD', 2.2);
    return;
  }
  if (performance.now() < p.until) return;
  pending = null;
  const at = p.fallback && p.fallback();
  if (at && Math.hypot(me.x - at[0], me.z - at[1]) >= NEAR){ put(at[0], at[1], at[2] || 0); showBanner('', 'DROPPED IN AT THE CHECKPOINT', 2.2); }
}

function put(x, z, yaw){
  const s = findClearSpawn(x, z, CFG.player.radius + 0.8);
  playerPos().set(s.x, 0, s.z);
  G.yaw = player.faceYaw = yaw;
  player.vel.set(0, 0, 0); if (player.moveVel) player.moveVel.set(0, 0, 0); player.vy = 0;
  regroupSquad();   // (the trooper's clones come along)
}
