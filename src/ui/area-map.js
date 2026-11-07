// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE AREA MAPS: the open zone's minimap and full map (ui/zone-map.js) taken everywhere it is easy to lose your way,
// for every hero, solo or in a co-op party, on any screen:
//   · a story mission's or a campaign chapter's map (a raid's and a challenge's too) at least AREA_MAP.minWidth across,
//     and a battle map; a small arena is all on screen anyway, and survival, the training grounds and the sandbox go
//     without (their rooms are small, and the sandbox's own panel and battle setup have the view);
//   · every wing of every hub (the temple, the citadel, the covert, the ships).
// This file says where the maps are up and what they carry; ui/zone-map.js draws both kinds, and ui/area-map-art.js
// draws a room's plan from its collision. The marks are the compass's own (ui/compass.js compassMarks), so the two always
// agree: the live objective in gold (its other parts fainter), a hub's stations and its doors with the wing each leads to,
// the boss and any lane about to send a wave in red, your squad, the co-op party in their seats' colours, and the
// waypoint you set on the full map (game/area-pin.js). Settings · MINIMAP turns the corner map off here as in a zone.

import { G, shared, player } from '../state.js';
import { HUBS, SIDE_OUT } from '../data/hub.js';
import { compassMarks } from './compass.js';
import { missionChecklist } from '../game/mission.js';
import { calmTarget } from '../game/aftermath.js';
import { allies } from '../allies/squad.js';
import { partnerStand } from '../net/partner.js';
import { seatCss } from './coop-marks.js';
import { areaPin } from '../game/area-pin.js';
import { playerPos } from '../player/helpers.js';
import { pad } from '../engine/gamepad.js';

export const AREA_MAP = {
  minWidth: 60,     // m: a story map at least this wide (or this deep) gets the maps
  share: 0.72,      // the minimap reaches this share of the room's half width from the hero...
  range: [22, 40],  // ...held to this many metres
};

const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const half = () => Math.max(shared.arenaHalf || 0, shared.arenaHalfZ || 0);

// this room has the maps (not an open zone: that is ui/zone-map.js's own)
export function areaMapHere(){
  if (G.mode !== 'play' || G.zone || G.endless || G.training || G.sandbox || !shared.arenaLevel) return false;
  if (G.hub) return true;
  if (!(G.mission || G.chapter >= 0)) return false;
  return !!shared.arenaBig || half() * 2 >= AREA_MAP.minWidth;
}
// m from the hero to the minimap's edge
export const areaRange = () => Math.max(AREA_MAP.range[0], Math.min(AREA_MAP.range[1], half() * AREA_MAP.share));

const hub = () => HUBS[G.hubId] || HUBS.temple;
const wing = () => { const H = hub(); return H.wings[G.hubWing] || H.wings[H.start]; };
const short = (t) => String(t || '').replace(/^THE /, '');

/* the marks the minimap and the full map carry: the compass's, the squad added. { x, z, kind, label?, col?, boss? } */
export function areaMarks(){
  const out = compassMarks().filter(m => m.kind !== 'ally');   // (the party is drawn on its own, with its facing)
  for (const a of allies){
    if (!a.group || a.state === 'down') continue;
    out.push({ x: a.group.position.x, z: a.group.position.z, kind: 'mate' });
  }
  return out;
}

/* ---------------- the full map ---------------- */
// the head, the side and the static marks of the full map (ui/zone-map.js puts them round the art and keeps the live
// marks moving). pos(x, z): a mark's style at that world spot
export function areaPanel(pos){
  const L = shared.arenaLevel || {}, p = playerPos();
  const dist = (x, z) => Math.round(Math.hypot(x - p.x, z - p.z)) + ' m';
  let kicker, title, side = '', marks = '';
  if (G.hub){
    const H = hub(), W = wing(), h = shared.arenaHalf || 30;
    kicker = H.name; title = W.name;
    const rooms = (W.stations || []).map(s => {
      marks += '<span class="zm-spot" data-px="' + s.x + '" data-pz="' + s.z + '" style="' + pos(s.x, s.z) + '"><i></i><b>' + esc(s.name) + '</b></span>';
      return '<div class="zm-go" data-px="' + s.x + '" data-pz="' + s.z + '"><b>' + esc(s.name) + '</b><span>' + dist(s.x, s.z) + '</span></div>';
    }).join('');
    const doors = Object.entries(W.doors || {}).map(([sd, to]) => {
      const T = H.wings[to]; if (!T) return '';
      const [ox, oz] = SIDE_OUT[sd], x = ox * (h - 3), z = oz * (h - 3);
      marks += '<span class="zm-door ' + sd + '" data-px="' + x + '" data-pz="' + z + '" style="' + pos(ox * h, oz * h) + '"><i></i><b>' + esc(T.short || short(T.name)) + '</b></span>';
      return '<div class="zm-go" data-px="' + x + '" data-pz="' + z + '"><b>TO ' + esc(T.short || short(T.name)) + '</b><span>' + esc((H.room || 'WING') + ' · ' + dist(x, z)) + '</span></div>';
    }).join('');
    side = '<div class="zm-h">HERE</div><div class="zm-list">' + (rooms || '<div class="zm-none">Nothing to tap here.</div>') + '</div>' +
      (doors ? '<div class="zm-h">WAYS OUT</div><div class="zm-list">' + doors + '</div>' : '');
  } else {
    const C = missionChecklist();
    kicker = (C && C.kicker) || (G.chapter >= 0 ? 'THE CAMPAIGN' : 'MISSION');
    title = String(L.name || '').replace(/^.*? — /, '');   // (a level's name opens with its mode: "MISSION — THE HIDDEN REFUGE")
    const calm = calmTarget();
    if (C) side = '<div class="zm-h">OBJECTIVES</div><div class="zm-obl">' + C.items.map(it =>
      '<div class="zm-oi' + (it.done ? ' done' : '') + (it.now ? ' now' : '') + '"><b>' + (it.done ? '✓' : it.now ? '◆' : '◇') + '</b><span>' + esc(it.text) + '</span></div>').join('') + '</div>';
    if (calm) side += '<div class="zm-h">THE WAY ON</div><div class="zm-list"><div class="zm-go" data-px="' + calm.x + '" data-pz="' + calm.z + '"><b>WALK ON</b><span>' + dist(calm.x, calm.z) + '</span></div></div>';
  }
  const legend = '<span><i class="lg you"></i>YOU</span>' +
    (G.hub ? '<span><i class="lg giver"></i>STATION</span><span><i class="lg door"></i>WAY OUT</span>' : '<span><i class="lg obj"></i>OBJECTIVE</span><span><i class="lg foe"></i>BOSS</span>') +
    (allies.length ? '<span><i class="lg mate"></i>SQUAD</span>' : '') + (partnerStand().length ? '<span><i class="lg ally"></i>PARTY</span>' : '') +
    '<span><i class="lg pin"></i>WAYPOINT</span>';
  return { kicker, title, side, marks, legend };
}

// the marks that move (redrawn a few times a second while the map is up): the objective and its parts, the boss and
// the lanes, the squad, the party, your waypoint and you
export function areaLive(pos, yawCss){
  let h = '';
  for (const m of areaMarks()){
    if (m.kind === 'obj') h += '<i class="zm-obj" style="' + pos(m.x, m.z) + '"></i>';
    else if (m.kind === 'part') h += '<i class="zm-obj part" style="' + pos(m.x, m.z) + '"></i>';
    else if (m.kind === 'threat') h += '<i class="zm-foe' + (m.boss ? ' boss' : '') + '" style="' + pos(m.x, m.z) + '"></i>';
    else if (m.kind === 'mate') h += '<i class="zm-mate" style="' + pos(m.x, m.z) + '"></i>';
  }
  for (const P of partnerStand()) h += '<i class="zm-you ally" style="' + pos(P.pos.x, P.pos.z) + ';--c:' + seatCss(P.slot) + ';--a:' + yawCss(P.yaw || 0) + '"><span>' + esc(P.name || '') + '</span></i>';
  const P = areaPin();
  if (P) h += '<i class="zm-wpt" style="' + pos(P.x, P.z) + '"></i>';
  const p = playerPos();
  h += '<i class="zm-you" style="' + pos(p.x, p.z) + ';--a:' + yawCss(player.group.rotation.y) + '"><span>YOU</span></i>';
  return h;
}
// the waypoint's row on the side
export function areaPinRow(){
  const P = areaPin(), p = playerPos();
  return P ? '<div class="zm-go zm-clear" data-clear="1"><b>WAYPOINT · ' + Math.round(Math.hypot(P.x - p.x, P.z - p.z)) + ' m</b><span>On your compass and minimap · pick to clear it</span></div>'
           : pad.active && !G.hub ? '' : '<div class="zm-tip">' + (pad.active ? 'Pick a station or a way out' : 'Click anywhere on the map') + ' to set a waypoint.</div>';
}
