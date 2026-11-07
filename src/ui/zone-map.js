// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ZONE MAPS, in an open zone (game/zone.js), for every hero, solo or in a co-op party of up to four, on any screen:
//
//   · THE MINIMAP: a small square in the HUD's top-right corner (the spot the objectives list takes in a mission, empty in
//     a zone). It turns with the camera, like the compass over it, so up is always the way you look, with a little N on
//     its rim. It shows the streets round you (ui/zone-map-art.js draws them once from the zone's plan), the waystones
//     (the touched ones bright), a side quest's goal in gold and the people who need a hand, your party in their seats'
//     colours and any foe close by in red. A goal or a partner past its edge stays pinned to the rim, pointing the way.
//     Tap or click it to open the full map. Settings · MINIMAP turns it off (G.minimap, ui/menus.js).
//   · THE FULL MAP, on M (on a controller LB + A; on a phone, tap the minimap): the whole zone, north up. Districts you
//     have walked into are named and the rest lie under a haze, every waystone is pinned, the secrets you have found are
//     marked where you found them, and the side quests and your party are on it live. A waystone you have touched is a
//     button: pick it on the map or in the list beside it to travel there (as at a waystone, game/zone.js travelTo),
//     anywhere but in the middle of a fight. Click anywhere else on it (or pick a district or a giver) to set your own
//     WAYPOINT: a cream pin on the compass and the minimap until you get there. Each district you've found says how many
//     of its secrets are still out there. M, Esc, Tab or the controller's B close it.
//   Solo the streets hold still while the map is up, like the waystone panel (ui/zone-ui.js); in a shared zone the party
//   plays on. Nothing here is per zone: a new zone maps itself from its plan, districts and waystones (data/zones.js).
// THE AREA MAPS: the same two, in a big story map and in a hub's wings (ui/area-map.js says where and what they carry;
//   ui/area-map-art.js draws the room from its collision). The minimap turns the same way and sits under the objectives
//   list when there is one (ui/hud-stage.js); the full map has the objectives (or a hub's stations and ways out) beside it
//   and takes a waypoint the same way (game/area-pin.js). No travel there: the hub's own TEMPLE MAP does that.

import { G, shared, player, enemies } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { playerPos } from '../player/helpers.js';
import { inCombat } from '../player/mobility.js';
import { zoneDef, zoneDistrict, travelTo, zonePin, setZonePin, clearZonePin } from '../game/zone.js';
import { zoneGivers, zoneQuestMarks } from '../game/zone-quests.js';
import { secretsPlaced } from '../game/secrets.js';
import { zoneMemo } from '../game/profile.js';
import { zonePlan } from '../world/zone-stream.js';
import { partnerStand } from '../net/partner.js';
import { seatCss } from './coop-marks.js';
import { compassHeading } from './compass.js';
import { zoneMapArt } from './zone-map-art.js';
import { pad, padKey } from '../engine/gamepad.js';
import { padLayout } from '../data/gamepad.js';
import { districtAt } from '../data/zones.js';
import { areaMapHere, areaRange, areaMarks, areaPanel, areaLive, areaPinRow } from './area-map.js';
import { areaMapArt } from './area-map-art.js';
import { areaPin, setAreaPin, clearAreaPin, checkAreaPin } from '../game/area-pin.js';

export const ZONE_MAP = {
  range: 46,        // m from the hero to the minimap's edge (straight up, down, left or right)
  foes: 34,         // m: a foe this close shows on the minimap
  every: 1 / 30,    // s between minimap redraws
  live: 0.12,       // s between the full map's live marks (the party, a quest's goal)
};
const MAP_KEY = 'm';
const SEC_NAME = { holocron: 'HOLOCRON', cave: 'CRYSTAL CAVE', meditate: 'MEDITATION SPOT' };
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const keyChip = () => pad.active ? padKey(MAP_KEY, padLayout(G.hero)) : MAP_KEY.toUpperCase();

/* ---------------- the minimap ---------------- */
const mini = document.createElement('div');
mini.id = 'minimap';
mini.innerHTML = '<div class="mm-frame"><canvas></canvas><b class="mm-n">N</b></div><div class="mm-key"><kbd></kbd><span>MAP</span></div>';
(document.getElementById('hud') || document.body).appendChild(mini);
const mcv = mini.querySelector('canvas'), mctx = mcv.getContext('2d'), mN = mini.querySelector('.mm-n'), mKey = mini.querySelector('.mm-key kbd');
mini.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openZoneMap(); });

let art = null, fullArt = null, artZ = null;
function artFor(Z){
  if (artZ !== Z){ artZ = Z; const plan = zonePlan(Z); art = zoneMapArt(Z, plan); fullArt = zoneMapArt(Z, plan, { districts: true }); }
  return art;
}

// a world spot on the minimap: metres right and down from its middle, up being the way the camera looks
const toMini = (dx, dz, c, s) => [dx * c + dz * s, -dx * s + dz * c];
// a world yaw (a model's rotation.y: it faces +z at 0) as a compass bearing, in radians
const yawBearing = (yaw) => Math.atan2(Math.sin(yaw), -Math.cos(yaw));

function glyph(ctx, kind, x, y, u, col, ang = 0){
  ctx.save(); ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#07060a'; ctx.lineWidth = Math.max(1.5, u * 0.32);
  if (kind === 'you' || kind === 'ally'){
    ctx.rotate(ang); const r = kind === 'you' ? u * 1.25 : u;
    ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 0.8, r * 0.85); ctx.lineTo(0, r * 0.4); ctx.lineTo(-r * 0.8, r * 0.85); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.stroke();
  } else if (kind === 'obj'){
    const r = u * 0.95; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
    ctx.fillStyle = '#ffd24a'; ctx.fill(); ctx.stroke();
  } else if (kind === 'stone' || kind === 'gate' || kind === 'stone-off'){
    const r = u * 0.8; ctx.beginPath(); ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 0.75, 0); ctx.lineTo(0, r * 1.3); ctx.lineTo(-r * 0.75, 0); ctx.closePath();
    ctx.fillStyle = kind === 'stone-off' ? 'rgba(200,220,235,.55)' : '#8ad8ff'; ctx.fill(); ctx.stroke();
    if (kind === 'gate'){ ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(1.5, u * 0.28); ctx.stroke(); }
  } else if (kind === 'giver'){
    const r = u * 0.85; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#f3e7c4'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#07060a'; ctx.fillRect(-u * 0.12, -r * 0.6, u * 0.24, r * 0.75); ctx.fillRect(-u * 0.12, r * 0.28, u * 0.24, u * 0.24);
  } else if (kind === 'pin'){   // your own waypoint: a cream map pin
    const r = u * 0.85; ctx.beginPath(); ctx.arc(0, -r * 0.9, r, Math.PI * 0.85, Math.PI * 0.15); ctx.lineTo(0, r * 0.9); ctx.closePath();
    ctx.fillStyle = '#f3e7c4'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -r * 0.9, r * 0.36, 0, Math.PI * 2); ctx.fillStyle = '#07060a'; ctx.fill();
  } else if (kind === 'foe'){
    ctx.beginPath(); ctx.arc(0, 0, u * 0.5, 0, Math.PI * 2); ctx.fillStyle = '#ff4a3a'; ctx.fill(); ctx.lineWidth = Math.max(1, u * 0.2); ctx.stroke();
  } else if (kind === 'part'){   // another part of the objective (a charge, a console): the gold diamond, smaller and hollow
    const r = u * 0.7; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
    ctx.fillStyle = 'rgba(255,210,74,.45)'; ctx.fill(); ctx.stroke();
  } else if (kind === 'spot'){   // a hub's station
    const r = u * 0.75; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#f3e7c4'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2); ctx.fillStyle = '#07060a'; ctx.fill();
  } else if (kind === 'door'){   // a way out: an arch, turned (ang) to face out through the wall it stands in
    ctx.rotate(ang); const r = u * 0.85;
    ctx.beginPath(); ctx.moveTo(-r, r * 0.8); ctx.lineTo(-r, -r * 0.1); ctx.arc(0, -r * 0.1, r, Math.PI, 0); ctx.lineTo(r, r * 0.8); ctx.closePath();
    ctx.fillStyle = '#8ad8ff'; ctx.fill(); ctx.stroke();
  } else if (kind === 'boss'){
    const r = u * 1.05; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
    ctx.fillStyle = '#ff4a3a'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = '#07060a'; ctx.fill();
  } else if (kind === 'threat'){   // a lane about to send a wave
    ctx.beginPath(); ctx.arc(0, 0, u * 0.8, 0, Math.PI * 2); ctx.strokeStyle = '#07060a'; ctx.lineWidth = Math.max(3, u * 0.55); ctx.stroke();
    ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = Math.max(1.5, u * 0.28); ctx.stroke();
  } else if (kind === 'mate'){   // a squadmate
    ctx.beginPath(); ctx.arc(0, 0, u * 0.55, 0, Math.PI * 2); ctx.fillStyle = '#7ee0a8'; ctx.fill(); ctx.lineWidth = Math.max(1, u * 0.24); ctx.stroke();
  }
  ctx.restore();
}

let miniOn = null, miniT = 0, miniArea = null;
// which map this place has: an open zone's, a story map's or a hub's (ui/area-map.js), or none
export const mapKind = () => G.zone ? (G.mode === 'play' && zoneDef() ? 'zone' : null) : areaMapHere() ? 'area' : null;
export const minimapOn = () => G.mode === 'play' && G.minimap !== false && !G.cutscene && !!mapKind();
function renderMini(dt){
  const on = minimapOn();
  if (on !== miniOn){ miniOn = on; mini.classList.toggle('on', on); document.body.classList.toggle('minimap-on', on); }
  const area = on && !G.zone;
  if (area !== miniArea){ miniArea = area; document.body.classList.toggle('minimap-area', area); }
  if (area) checkAreaPin();   // (reached: it says so and goes)
  if (!on || (miniT -= dt) > 0) return;
  miniT = ZONE_MAP.every;
  if (area) return renderAreaMini();
  const Z = zoneDef(), A = artFor(Z);
  // the canvas at the size it is shown, in device pixels
  const css = mcv.clientWidth || 160, dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(css * dpr);
  if (mcv.width !== W){ mcv.width = mcv.height = W; }
  const ctx = mctx, R = ZONE_MAP.range, k = W / (2 * R), u = Math.max(4, W / 34);   // k: pixels per metre · u: a mark's size
  const h = compassHeading() * Math.PI / 180, c = Math.cos(h), s = Math.sin(h);
  const p = playerPos();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, W);
  // the streets: the art turned under the hero (only the square round them is copied)
  ctx.save(); ctx.translate(W / 2, W / 2); ctx.rotate(-h); ctx.scale(k / A.ppm, k / A.ppm);
  const reach = R * 1.5 * A.ppm, sx = (p.x - A.x0) * A.ppm - reach, sz = (p.z - A.z0) * A.ppm - reach;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(A.canvas, sx, sz, reach * 2, reach * 2, -reach, -reach, reach * 2, reach * 2);
  ctx.restore();
  const at = (x, z) => { const [mx, my] = toMini(x - p.x, z - p.z, c, s); return [W / 2 + mx * k, W / 2 + my * k]; };
  const inside = (q, pad = 0) => q[0] >= -pad && q[1] >= -pad && q[0] <= W + pad && q[1] <= W + pad;
  // pinned to the rim: along the line from the middle, held a mark's width inside the edge
  const pin = (q) => { const dx = q[0] - W / 2, dy = q[1] - W / 2, e = W / 2 - u * 1.4, m = Math.max(Math.abs(dx), Math.abs(dy)) || 1; return m <= e ? q : [W / 2 + dx / m * e, W / 2 + dy / m * e]; };
  // foes close by
  for (const e of enemies){
    if (e.dead || e.converted || !e.group) continue;
    const ex = e.group.position.x, ez = e.group.position.z;
    if (Math.hypot(ex - p.x, ez - p.z) > ZONE_MAP.foes) continue;
    const q = at(ex, ez); if (inside(q)) glyph(ctx, 'foe', q[0], q[1], u);
  }
  // waystones, then the people who need a hand and a quest's goal (game/zone-quests.js: the marks the compass carries too)
  const memo = zoneMemo(G.zone);
  for (const w of Z.waystones){ const q = at(w.x, w.z); if (inside(q, u)) glyph(ctx, w.gate ? 'gate' : memo.stones[w.id] ? 'stone' : 'stone-off', q[0], q[1], u); }
  for (const m of zoneQuestMarks()){
    if (m.kind === 'spot'){ const q = at(m.x, m.z); if (inside(q, u)) glyph(ctx, 'giver', q[0], q[1], u); }
    else if (m.kind === 'obj'){ const q = pin(at(m.x, m.z)); glyph(ctx, 'obj', q[0], q[1], u); }
  }
  { const P = zonePin(); if (P){ const q = pin(at(P.x, P.z)); glyph(ctx, 'pin', q[0], q[1], u); } }   // your waypoint
  // the party, pinned to the rim when they're far
  for (const P of partnerStand()){ const q = pin(at(P.pos.x, P.pos.z)); glyph(ctx, 'ally', q[0], q[1], u * 0.95, seatCss(P.slot), yawBearing(P.yaw || 0) - h); }
  glyph(ctx, 'you', W / 2, W / 2, u, '#ffffff', yawBearing(player.group.rotation.y) - h);
  // the N on the rim: where north lies from the middle
  const [nx, ny] = toMini(0, -1, c, s), m = Math.max(Math.abs(nx), Math.abs(ny));
  mN.style.left = (50 + nx / m * 50).toFixed(2) + '%'; mN.style.top = (50 + ny / m * 50).toFixed(2) + '%';
  const kc = keyChip(); if (mKey._t !== kc){ mKey._t = kc; mKey.textContent = kc; }
}
// the minimap in a story map or a hub's wing: the same turning square, drawn from the room's own plan
function renderAreaMini(){
  const A = areaMapArt();
  const css = mcv.clientWidth || 160, dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(css * dpr);
  if (mcv.width !== W){ mcv.width = mcv.height = W; }
  const ctx = mctx, R = areaRange(), k = W / (2 * R), u = Math.max(4, W / 34);
  const h = compassHeading() * Math.PI / 180, c = Math.cos(h), s = Math.sin(h);
  const p = playerPos();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = A.outside; ctx.fillRect(0, 0, W, W);   // (past the art's edge, on a long route's sides)
  ctx.save(); ctx.translate(W / 2, W / 2); ctx.rotate(-h); ctx.scale(k / A.ppm, k / A.ppm);
  const reach = R * 1.5 * A.ppm, sx = (p.x - A.x0) * A.ppm - reach, sz = (p.z - A.z0) * A.ppm - reach;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(A.canvas, sx, sz, reach * 2, reach * 2, -reach, -reach, reach * 2, reach * 2);
  ctx.restore();
  const at = (x, z) => { const [mx, my] = toMini(x - p.x, z - p.z, c, s); return [W / 2 + mx * k, W / 2 + my * k]; };
  const inside = (q, pad = 0) => q[0] >= -pad && q[1] >= -pad && q[0] <= W + pad && q[1] <= W + pad;
  const pin = (q) => { const dx = q[0] - W / 2, dy = q[1] - W / 2, e = W / 2 - u * 1.4, m = Math.max(Math.abs(dx), Math.abs(dy)) || 1; return m <= e ? q : [W / 2 + dx / m * e, W / 2 + dy / m * e]; };
  for (const e of enemies){
    if (e.dead || e.converted || !e.group || e === shared.boss) continue;
    const ex = e.group.position.x, ez = e.group.position.z;
    if (Math.hypot(ex - p.x, ez - p.z) > R * 1.5) continue;
    const q = at(ex, ez); if (inside(q)) glyph(ctx, 'foe', q[0], q[1], u);
  }
  // the marks, the ones that matter most last (on top) and pinned to the rim when they're off it
  const marks = areaMarks(), order = { mate: 0, spot: 1, part: 2, door: 3, threat: 4, obj: 5, pin: 6 };
  marks.sort((a, b) => (order[a.kind] ?? 3) - (order[b.kind] ?? 3));
  for (const m of marks){
    if (m.kind === 'mate' || m.kind === 'spot' || m.kind === 'part'){ const q = at(m.x, m.z); if (inside(q, u)) glyph(ctx, m.kind, q[0], q[1], u); }
    else if (m.kind === 'door'){ const q = pin(at(m.x, m.z)); glyph(ctx, 'door', q[0], q[1], u, null, Math.atan2(m.x, -m.z) - h); }
    else if (m.kind === 'threat'){ const q = pin(at(m.x, m.z)); glyph(ctx, m.boss ? 'boss' : 'threat', q[0], q[1], u); }
    else if (m.kind === 'obj' || m.kind === 'pin'){ const q = pin(at(m.x, m.z)); glyph(ctx, m.kind, q[0], q[1], u); }
  }
  for (const P of partnerStand()){ const q = pin(at(P.pos.x, P.pos.z)); glyph(ctx, 'ally', q[0], q[1], u * 0.95, seatCss(P.slot), yawBearing(P.yaw || 0) - h); }
  glyph(ctx, 'you', W / 2, W / 2, u, '#ffffff', yawBearing(player.group.rotation.y) - h);
  const [nx, ny] = toMini(0, -1, c, s), m = Math.max(Math.abs(nx), Math.abs(ny));
  mN.style.left = (50 + nx / m * 50).toFixed(2) + '%'; mN.style.top = (50 + ny / m * 50).toFixed(2) + '%';
  const kc = keyChip(); if (mKey._t !== kc){ mKey._t = kc; mKey.textContent = kc; }
}

/* ---------------- the full map ---------------- */
const panel = document.getElementById('zonemap');
const isOpen = () => !!panel && panel.classList.contains('open');
export const zoneMapOpen = isOpen;
let liveT = 0, openKind = null, shownArt = null;

const pct = (Z, x, z) => { const A = shownArt || fullArt; return [((x - A.x0) / A.size * 100).toFixed(2), ((z - A.z0) / A.size * 100).toFixed(2)]; };
const posStyle = (Z, x, z) => { const [l, t] = pct(Z, x, z); return 'left:' + l + '%;top:' + t + '%'; };
const fighting = () => inCombat();

function render(){
  if (openKind === 'area') return renderArea();
  const Z = zoneDef(); if (!Z || !panel) return;
  artFor(Z); shownArt = fullArt;
  const memo = zoneMemo(G.zone), here = zoneDistrict(), p = playerPos();
  const touched = Z.waystones.filter(w => memo.stones[w.id]);
  const seen = Z.districts.filter(d => memo.seen[d.id] || (here && here.id === d.id));
  const secrets = secretsPlaced(), found = secrets.filter(s => s.found);
  const fight = fighting();
  const dist = (id) => (Z.districts.find(d => d.id === id) || {}).name || '';
  // the map: the art, a haze over the districts not yet walked into, their names, the pins
  let marks = '';
  for (const d of Z.districts){
    const known = seen.includes(d);
    const [l, t] = pct(Z, d.x0, d.z0), [r, b] = pct(Z, d.x1, d.z1);
    if (!known) marks += '<i class="zm-fog" style="left:' + l + '%;top:' + t + '%;width:' + (r - l).toFixed(2) + '%;height:' + (b - t).toFixed(2) + '%"></i>';
    // a district you've found says how many of its secrets are still out there (never where)
    const inD = secrets.filter(s => districtAt(Z, s.x, s.z) === d), left = inD.filter(s => !s.found).length;
    const sec = known && inD.length ? '<em>' + (left ? left + (left === 1 ? ' SECRET' : ' SECRETS') + ' LEFT' : 'ALL SECRETS FOUND') + '</em>' : '';
    const cx = (d.x0 + d.x1) / 2, cz = d.z0 + (d.z1 - d.z0) * 0.32;   // (the name sits high in its district, clear of the waystone by its middle)
    marks += '<span class="zm-dist' + (known ? '' : ' off') + (here && here.id === d.id ? ' here' : '') + (left ? '' : ' done') + '" data-px="' + cx + '" data-pz="' + cz + '" style="' + posStyle(Z, cx, cz) + '">' +
      (known ? esc(d.name.replace(/^THE /, '')) : 'UNEXPLORED') + sec + '</span>';
  }
  for (const s of found) marks += '<i class="zm-sec ' + esc(s.kind) + '" style="' + posStyle(Z, s.x, s.z) + '" title="' + esc(SEC_NAME[s.kind] || 'SECRET') + ' · FOUND"></i>';
  for (const g of zoneGivers()) if (!g.done) marks += '<i class="zm-giver" data-px="' + g.x.toFixed(1) + '" data-pz="' + g.z.toFixed(1) + '" style="' + posStyle(Z, g.x, g.z) + '"><b>!</b></i>';
  for (const w of Z.waystones){
    const known = !!memo.stones[w.id];
    marks += '<div class="' + (known ? 'zm-stone' : 'zm-pin') + (w.gate ? ' gate' : '') + '"' + (known ? ' data-w="' + esc(w.id) + '"' : '') + ' style="' + posStyle(Z, w.x, w.z) + '">' +
      '<i></i><span>' + (known ? esc(w.name) : '?') + '</span></div>';
  }
  marks += '<div class="zm-live"></div>';
  // beside it: where you are, what you've found, and the waystones to travel to
  const travel = touched.map(w => '<div class="zm-go' + (fight ? ' off' : '') + '" data-w="' + esc(w.id) + '"><b>' + esc(w.name) + '</b><span>' + esc(w.gate ? 'THE WAY HOME · ' + dist(w.district) : dist(w.district)) + ' · ' + Math.round(Math.hypot(w.x - p.x, w.z - p.z)) + ' m</span></div>').join('');
  panel.innerHTML = '<div class="zm-box">' +
    '<div class="zm-head"><div class="zm-k">OPEN ZONE · ' + esc(Z.place) + '</div><div class="zm-t">' + esc(Z.name) + '</div></div>' +
    '<div class="zm-body"><div class="zm-map"><canvas></canvas>' + marks + '<b class="zm-north">N</b></div>' +
    '<div class="zm-side">' +
      '<div class="zm-here"><span>YOU ARE IN</span><b>' + esc(here ? here.name : Z.name) + '</b></div>' +
      '<div class="zm-tally"><span><b>' + touched.length + '</b> / ' + Z.waystones.length + ' WAYSTONES</span><span><b>' + seen.length + '</b> / ' + Z.districts.length + ' DISTRICTS</span>' +
        (secrets.length ? '<span><b>' + found.length + '</b> / ' + secrets.length + ' SECRETS</span>' : '') + '</div>' +
      '<div class="zm-wp"></div>' +
      '<div class="zm-h">TRAVEL' + (fight ? '<em>NOT IN A FIGHT</em>' : '') + '</div>' +
      '<div class="zm-list">' + (travel || '<div class="zm-none">Walk up to a waystone to touch it.</div>') + '</div>' +
      '<div class="zm-legend"><span><i class="lg you"></i>YOU</span><span><i class="lg stone"></i>WAYSTONE</span><span><i class="lg obj"></i>QUEST GOAL</span><span><i class="lg giver"></i>NEEDS A HAND</span><span><i class="lg sec"></i>SECRET FOUND</span><span><i class="lg pin"></i>WAYPOINT</span>' +
        (partnerStand().length ? '<span><i class="lg ally"></i>PARTY</span>' : '') + '</div>' +
      '<div class="btn zm-x" data-x="1">CLOSE <kbd>' + (pad.active ? (pad.family === 'ps' ? '○' : 'B') : MAP_KEY.toUpperCase()) + '</kbd></div>' +
    '</div></div></div>';
  // the art, copied in at the size it is shown
  const cv = panel.querySelector('canvas'), A = fullArt;
  cv.width = cv.height = A.canvas.width;
  cv.getContext('2d').drawImage(A.canvas, 0, 0);
  renderLive();
}
// the full map of a story map or a hub's wing (ui/area-map.js): the room north up, its marks, and beside it the
// objectives (or the stations and ways out)
function renderArea(){
  if (!panel) return;
  const A = shownArt = areaMapArt(), pos = (x, z) => posStyle(null, x, z);
  const P = areaPanel(pos);
  panel.innerHTML = '<div class="zm-box zm-areabox">' +
    '<div class="zm-head"><div class="zm-k">' + esc(P.kicker) + '</div><div class="zm-t">' + esc(P.title) + '</div></div>' +
    '<div class="zm-body"><div class="zm-map"><canvas></canvas>' + P.marks + '<div class="zm-live"></div><b class="zm-north">N</b></div>' +
    '<div class="zm-side">' + P.side + '<div class="zm-wp"></div>' +
      '<div class="zm-legend">' + P.legend + '</div>' +
      '<div class="btn zm-x" data-x="1">CLOSE <kbd>' + (pad.active ? (pad.family === 'ps' ? '○' : 'B') : MAP_KEY.toUpperCase()) + '</kbd></div>' +
    '</div></div></div>';
  const cv = panel.querySelector('canvas');
  cv.width = cv.height = A.canvas.width;
  cv.getContext('2d').drawImage(A.canvas, 0, 0);
  renderLive();
}
// the marks that move: you, the party, a side quest's goal (redrawn a few times a second while the map is up)
function renderLive(){
  if (openKind === 'area'){
    const live = panel && panel.querySelector('.zm-live'); if (!live) return;
    const h = areaLive((x, z) => posStyle(null, x, z), (y) => yawBearing(y).toFixed(3) + 'rad');
    if (live._h !== h){ live._h = h; live.innerHTML = h; }
    const row = panel.querySelector('.zm-wp'), r = areaPinRow();
    if (row && row._h !== r){ row._h = r; row.innerHTML = r; }
    return;
  }
  const Z = zoneDef(), live = panel && panel.querySelector('.zm-live'); if (!Z || !live) return;
  const p = playerPos();
  let h = '';
  for (const m of zoneQuestMarks()) if (m.kind === 'obj') h += '<i class="zm-obj" style="' + posStyle(Z, m.x, m.z) + '"></i>';
  for (const P of partnerStand()) h += '<i class="zm-you ally" style="' + posStyle(Z, P.pos.x, P.pos.z) + ';--c:' + seatCss(P.slot) + ';--a:' + yawBearing(P.yaw || 0).toFixed(3) + 'rad"><span>' + esc(P.name || '') + '</span></i>';
  const P = zonePin();
  if (P) h += '<i class="zm-wpt" style="' + posStyle(Z, P.x, P.z) + '"></i>';
  h += '<i class="zm-you" style="' + posStyle(Z, p.x, p.z) + ';--a:' + yawBearing(player.group.rotation.y).toFixed(3) + 'rad"><span>YOU</span></i>';
  if (live._h !== h){ live._h = h; live.innerHTML = h; }
  const row = panel.querySelector('.zm-wp');
  const r = P ? '<div class="zm-go zm-clear" data-clear="1"><b>WAYPOINT · ' + Math.round(Math.hypot(P.x - p.x, P.z - p.z)) + ' m</b><span>On your compass and minimap · pick to clear it</span></div>'
              : '<div class="zm-tip">' + (pad.active ? 'Pick a district or someone who needs a hand' : 'Click anywhere on the map') + ' to set a waypoint.</div>';
  if (row && row._h !== r){ row._h = r; row.innerHTML = r; }
}

export function openZoneMap(){
  const kind = mapKind();
  if (!panel || !kind || G.mode !== 'play' || G.paused || G.skillSelect || G.cutscene || player.downed) return false;
  G.skillSelect = true; G.sbMenu = true; openKind = kind;   // holds the streets still (solo) and keeps the pause screen away while the cursor is free
  render(); panel.classList.add('open'); liveT = ZONE_MAP.live;
  S.uiHover && S.uiHover();
  if (document.pointerLockElement) document.exitPointerLock();
  return true;
}
export function closeZoneMap(relock = true){
  if (!isOpen()) return;
  panel.classList.remove('open'); panel.innerHTML = ''; openKind = null; shownArt = null;
  G.skillSelect = false; G.sbMenu = false;
  if (relock && !shared.lockFallback){ try { const q = renderer.domElement.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch(e){} }
}
function travel(id){
  const Z = zoneDef(), w = Z && Z.waystones.find(s => s.id === id);
  if (!w || !zoneMemo(G.zone).stones[id] || fighting()){ S.uiDeny && S.uiDeny(); return; }
  closeZoneMap(true);   // (while the click still counts as a gesture: the lock comes back with it)
  travelTo(id);
}

// M: the map wherever there is one (engine/input.js asks first; M is the music everywhere else). Answers true for any M
// there, so the music never flips by accident
shared.mapHere = () => !!mapKind();   // (engine/gamepad.js: LB + VIEW is the map here)
shared.mapKey = () => {
  if (!mapKind()) return false;
  if (isOpen()) closeZoneMap(); else openZoneMap();
  return true;
};

if (panel){
  panel.addEventListener('click', (e) => {
    e.stopPropagation(); audioInit();
    if (e.target === panel || e.target.closest('[data-x]')){ closeZoneMap(); return; }
    if (e.target.closest('[data-clear]')){ if (openKind === 'area') clearAreaPin(); else clearZonePin(); S.uiClick && S.uiClick(); renderLive(); return; }
    const o = e.target.closest('[data-w]');
    if (o){ if (o.classList.contains('off')){ S.uiDeny && S.uiDeny(); return; } travel(o.dataset.w); return; }
    // anywhere else on the map: your waypoint there (a district's name or a giver: its own spot, so a controller can set one)
    // (on an area map, a station or a way out in the list beside it too)
    const t = e.target.closest('[data-px]'), m = e.target.closest('.zm-map'), A = shownArt;
    if ((!m && !(t && openKind === 'area')) || !A) return;
    let x, z;
    if (t){ x = +t.dataset.px; z = +t.dataset.pz; }
    else { const b = m.getBoundingClientRect(); x = A.x0 + (e.clientX - b.left) / b.width * A.size; z = A.z0 + (e.clientY - b.top) / b.height * A.size; }
    const hx = openKind === 'area' ? A.hx : zoneDef().size / 2, hz = openKind === 'area' ? A.hz : hx;
    if (Math.abs(x) > hx || Math.abs(z) > hz){ S.uiDeny && S.uiDeny(); return; }
    if (openKind === 'area') setAreaPin(x, z); else setZonePin(x, z);
    S.uiClick && S.uiClick(); renderLive();
  });
  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' || k === 'tab' || (k === MAP_KEY && !e.repeat)){ e.preventDefault(); e.stopImmediatePropagation(); closeZoneMap(); }
  }, true);
}

/* once a frame (main.js) */
export function updateZoneMap(dt){
  renderMini(dt);
  if (!isOpen()) return;
  if (mapKind() !== openKind || G.mode !== 'play' || G.cutscene){ closeZoneMap(false); return; }
  if ((liveT -= dt) <= 0){ liveT = ZONE_MAP.live; renderLive(); }
}
// (tests and the shots)
export const zoneMapInfo = () => ({ kind: mapKind(), areaPin: areaPin(), pin: zonePin(), mini: !!miniOn, open: isOpen(), partners: partnerStand().length, pins: panel ? panel.querySelectorAll('.zm-stone').length : 0, district: (zoneDistrict() || {}).id || null, at: G.zone && zoneDef() ? (districtAt(zoneDef(), playerPos().x, playerPos().z) || {}).id || null : null });
