// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE COMPASS: a slim, faint strip along the top of the HUD. It turns with the camera and reads N / E / S / W (north is
// −z, east +x, the same as the hub's doors: data/hub.js SIDE_OUT), and it carries a mark for everything worth heading
// for, in every mode:
//   · the live objective, a gold diamond with its distance (a story mission or campaign chapter, an arcade contract,
//     the calm after a chapter, the training grounds' beacon), and the objective's other parts fainter;
//   · in the hub, each station and each door (with the wing it leads to), named when you face it;
//   · the co-op party, each partner in their seat's colour;
//   · the boss, and a lane that is about to send a wave (red);
//   · the waypoint you set on a map (cream, with its distance): an open zone's (ui/zone-map.js), a story map's or a
//     hub's (ui/area-map.js).
// A mark past the edge of the strip sits pinned at that edge with a chevron, so it still says which way to turn.
// Settings · COMPASS turns it off (G.compass, ui/menus.js). ui/hud.js calls renderCompass() each frame.

import * as THREE from 'three';
import { G, shared } from '../state.js';
import { camera } from '../engine/renderer.js';
import { playerPos } from '../player/helpers.js';
import { objectiveTarget, objectiveMarks } from '../game/mission.js';
import { calmTarget } from '../game/aftermath.js';
import { trainingTarget } from '../game/tutorial.js';
import { HUBS, SIDE_OUT } from '../data/hub.js';
import { partnerStand } from '../net/partner.js';
import { seatCss } from './coop-marks.js';
import { zoneMarks } from '../game/zone.js';
import { areaPin } from '../game/area-pin.js';

const SPAN = 75;          // degrees either side of straight ahead the strip shows
const TAPE_FROM = -180;   // the tape runs -180…540 so any heading has a full strip under it
const TAPE_DEG = 720;
const LABEL_WITHIN = 11;  // a hub mark this close to straight ahead says its name

/* ---------- the strip ---------- */
const el = document.createElement('div');
el.id = 'compass';
const NAMES = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
let tape = '';
for (let d = TAPE_FROM; d <= TAPE_FROM + TAPE_DEG; d += 15){
  const a = ((d % 360) + 360) % 360, at = ((d - TAPE_FROM) / TAPE_DEG * 100).toFixed(3) + '%';
  const nm = NAMES[a];
  if (nm) tape += '<b class="cp-l' + (a % 90 ? ' mid' : '') + (a === 0 ? ' n' : '') + '" style="left:' + at + '">' + nm + '</b>';
  else tape += '<i class="cp-t" style="left:' + at + '"></i>';
}
el.innerHTML = '<div class="cp-tape">' + tape + '</div><div class="cp-marks"></div><i class="cp-mid"></i>';
(document.getElementById('hud') || document.body).appendChild(el);
const tapeEl = el.querySelector('.cp-tape'), marksEl = el.querySelector('.cp-marks');

/* ---------- where things are ---------- */
const _dir = new THREE.Vector3();
// the way the camera looks, as a compass bearing in degrees (0 north, 90 east)
export function compassHeading(){
  camera.getWorldDirection(_dir);
  if (Math.hypot(_dir.x, _dir.z) < 1e-3) return ((-G.yaw * 180 / Math.PI + 180) % 360 + 360) % 360;   // straight down: the hero's yaw
  return ((Math.atan2(_dir.x, -_dir.z) * 180 / Math.PI) % 360 + 360) % 360;
}
const bearing = (dx, dz) => Math.atan2(dx, -dz) * 180 / Math.PI;

// { x, z, kind ('obj' | 'part' | 'spot' | 'door' | 'ally' | 'threat'), col?, label? } for everything the strip marks now
export function compassMarks(){
  const out = [];
  if (G.mode !== 'play') return out;
  if (G.hub){
    const Hb = HUBS[G.hubId] || HUBS.temple, W = Hb.wings[G.hubWing] || Hb.wings[Hb.start], H = shared.arenaHalf || 30;
    for (const s of W.stations || []) out.push({ x: s.x, z: s.z, kind: 'spot', label: s.name });
    for (const side in W.doors || {}){
      const [ox, oz] = SIDE_OUT[side], to = Hb.wings[W.doors[side]];
      out.push({ x: ox * H, z: oz * H, kind: 'door', label: to ? (to.short || to.name) : '' });
    }
  } else if (G.zone){
    for (const m of zoneMarks()) out.push(m);   // an open zone: its waystones, the touched ones bright (game/zone.js)
  } else {
    const main = calmTarget() || (G.training ? trainingTarget() : objectiveTarget());
    if (main) out.push({ x: main.x, z: main.z, kind: 'obj' });
    if (!G.training) for (const p of objectiveMarks()) if (!main || p.x !== main.x || p.z !== main.z) out.push({ x: p.x, z: p.z, kind: 'part' });
    if (shared.boss && shared.boss.hp > 0 && shared.boss.group) out.push({ x: shared.boss.group.position.x, z: shared.boss.group.position.z, kind: 'threat', boss: true });
    if (shared.incoming) for (const p of shared.incoming) out.push({ x: p.x, z: p.z, kind: 'threat' });
  }
  if (!G.zone){ const P = areaPin(); if (P) out.push({ x: P.x, z: P.z, kind: 'pin' }); }   // your waypoint, set on a story map's or a hub's full map (ui/area-map.js)
  for (const P of partnerStand()) out.push({ x: P.pos.x, z: P.pos.z, kind: 'ally', col: seatCss(P.slot) });
  return out;
}

/* ---------- each frame ---------- */
const pool = [];
function markEl(i){
  let m = pool[i];
  if (!m){
    m = document.createElement('div');
    m.innerHTML = '<i class="cp-g"></i><span class="cp-n"></span>';
    marksEl.appendChild(m); pool[i] = m;
  }
  return m;
}
const setText = (e, v) => { if (e._t !== v){ e._t = v; e.textContent = v; } };
let shown = null;
export function renderCompass(){
  const on = G.mode === 'play' && G.compass !== false && !G.cutscene;
  if (on !== shown){ shown = on; el.classList.toggle('on', on); document.body.classList.toggle('compass-on', on); }
  if (!on) return;
  const head = compassHeading();
  // the tape: slide it so `head` sits in the middle
  tapeEl.style.transform = 'translateX(' + (-((head - SPAN - TAPE_FROM) / TAPE_DEG) * 100).toFixed(3) + '%)';
  const pp = playerPos(), marks = compassMarks();
  // the hub mark nearest straight ahead gets its name
  let named = -1, nb = LABEL_WITHIN;
  const rels = marks.map((k, i) => {
    let r = bearing(k.x - pp.x, k.z - pp.z) - head;
    r = ((r + 540) % 360) - 180;
    if ((k.kind === 'spot' || k.kind === 'door') && Math.abs(r) < nb){ nb = Math.abs(r); named = i; }
    return r;
  });
  let n = 0;
  marks.forEach((k, i) => {
    const r = rels[i], d = Math.hypot(k.x - pp.x, k.z - pp.z);
    if (k.kind !== 'obj' && k.kind !== 'pin' && k.kind !== 'ally' && d < 2.5) return;   // standing on it: no need to point
    const edge = Math.abs(r) > SPAN;
    if (edge && (k.kind === 'part' || k.kind === 'spot' || k.kind === 'door')) return;   // only the things that matter pin to the edge
    const m = markEl(n++), x = (Math.max(-SPAN, Math.min(SPAN, r)) + SPAN) / (2 * SPAN) * 100;
    const cls = 'cp-m ' + k.kind + (edge ? ' edge ' + (r < 0 ? 'l' : 'r') : '') + (i === named ? ' named' : '');
    if (m._c !== cls){ m._c = cls; m.className = cls; }
    m.style.left = x.toFixed(2) + '%';
    m.style.display = '';
    if (k.col && m._col !== k.col){ m._col = k.col; m.style.setProperty('--mc', k.col); }
    setText(m.lastChild, k.kind === 'obj' || k.kind === 'pin' ? (d >= 7 ? Math.round(d) + ' m' : '') : i === named ? k.label + (d >= 7 ? ' · ' + Math.round(d) + ' m' : '') : '');
  });
  for (let i = n; i < pool.length; i++) if (pool[i].style.display !== 'none') pool[i].style.display = 'none';
}
