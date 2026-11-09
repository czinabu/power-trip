// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Off-screen threat markers.

import * as THREE from 'three';
import { camera } from '../engine/renderer.js';
import { clamp } from '../utils.js';
import { shared, G, enemies, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { grenades } from '../enemies/grenades.js';
import { localPlayer } from '../player/players.js';

/* THREAT AWARENESS — project a world point to screen space; return the on-screen flag, a clamped edge position, and
   the CSS rotation (0°=up, clockwise) for an arrow pointing toward it. Powers the damage arc + off-screen markers. */
const _pv = new THREE.Vector3();
function threatScreen(world){
  _pv.copy(world).project(camera);
  const behind = _pv.z > 1;
  let nx = _pv.x, ny = _pv.y; if (behind){ nx = -nx; ny = -ny; }
  const onScreen = !behind && Math.abs(_pv.x) <= 0.98 && Math.abs(_pv.y) <= 0.98;
  const W = innerWidth, H = innerHeight;
  const sx = (nx*0.5+0.5)*W, sy = (1-(ny*0.5+0.5))*H;
  const deg = Math.atan2(sx - W/2, -(sy - H/2)) * 180/Math.PI;
  const m = 48;
  return { onScreen, behind, deg, ex: clamp(sx, m, W-m), ey: clamp(sy, m, H-m) };
}
const _threatMarks = [];
const ARRIVAL_SHOW = 2.6;
// the wind-ups that count as an attack coming in (enemies/ai.js states), and how near a melee foe must be for its to
const ATK_WIND = { windup: 1, lungewind: 1, leapwind: 1 }, ATK_NEAR = 9;   // seconds a new arrival's direction stays marked
export function renderThreats(){
  const wrap = document.getElementById('threats'), dind = document.getElementById('dmgind');
  if (G.mode !== 'play'){ wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  // --- directional DAMAGE indicator: a red arc swung toward whatever last hit you ---
  if ((player.dmgIndT || 0) > 0 && player.hitFrom){
    const s = threatScreen(player.hitFrom);
    dind.style.opacity = Math.min(0.9, player.dmgIndT);
    dind.style.transform = 'rotate(' + s.deg.toFixed(0) + 'deg)';
  } else dind.style.opacity = '0';
  // --- off-screen markers for the genuinely dangerous foes: charging snipers, live bombers, boss/warbringer ---
  const threats = [], pp = playerPos();
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    let col = null;
    if (e.t.sniper && e.aimLine && e.aimLine.visible) col = '#ff3030';      // a marksman drawing a bead on you
    else if (e.t.bomber && (e.state === 'fuse' || e.state === 'chase')) col = '#ffae2a';   // a saboteur closing in
    else if (e.warbringer) col = '#ff3b3b';
    // INCOMING: any foe out of view winding up a blow or a shot at THIS hero (in co-op, the one it picked: enemies/targets.js)
    // gets a pulsing marker, so a swing from behind or a rifle levelled from the side never lands unannounced
    else if (ATK_WIND[e.state] && (!e.hero || e.hero === localPlayer) && !e.dummy){
      const p = e.group.position, d = Math.hypot(p.x - pp.x, p.z - pp.z);
      if (d < (e.t.ranged ? (e.t.range || 14) + 2 : ATK_NEAR)){ threats.push({ pos: p, col: '#ff6a3a', atk: true }); continue; }
    }
    if (col) threats.push({ pos: e.group.position, col });
  }
  if (shared.boss && shared.boss.hp > 0) threats.push({ pos: shared.boss.group.position, col: '#ff5a5a' });
  // a live detonator coming down on you out of view: point at its landing mark (enemies/grenades.js)
  for (const n of grenades){
    if (n.friendly || n.vel) continue;
    const m = n.ring.position;
    if (Math.hypot(m.x - pp.x, m.z - pp.z) < n.R + 2.5) threats.push({ pos: m, col: '#ffae2a' });
  }
  // a hold's lane that's lit: a wave is about to step out of it (game/lanes.js)
  if (shared.incoming) for (const pos of shared.incoming) threats.push({ pos, col: '#ff4a2a' });
  // --- where a SURGE is coming in: one pale marker per direction for foes that arrived in the last few seconds
  // off-screen (the spawn director brings each surge in from one side: world/collision.js edgeSpawn) ---
  const t = G.gt, arrivals = [];
  for (const e of enemies){
    const age = t - (e.born ?? -1e9);
    if (e.dead || e.converted || e.dummy || !(age >= 0 && age < ARRIVAL_SHOW)) continue;
    const s = threatScreen(e.group.position);
    if (s.onScreen || arrivals.some(a => Math.abs(((a.deg - s.deg + 540) % 360) - 180) < 28)) continue;   // one per direction
    arrivals.push(s);
  }
  let mi = 0;
  for (const th of [...threats, ...arrivals.map(s => ({ s, col: '#ffe6a8', op: 0.75 }))]){
    const s = th.s || threatScreen(th.pos);
    if (s.onScreen) continue;   // visible already — no marker needed
    let mk = _threatMarks[mi];
    if (!mk){ mk = document.createElement('div'); mk.className = 'threatmark'; mk.innerHTML = '<i></i>'; wrap.appendChild(mk); _threatMarks[mi] = mk; }
    mk.style.left = s.ex + 'px'; mk.style.top = s.ey + 'px';
    mk.style.transform = 'rotate(' + s.deg.toFixed(0) + 'deg)';
    mk.style.color = th.col; mk.style.opacity = th.op || '0.92';
    mk.classList.toggle('atk', !!th.atk);
    mi++;
  }
  for (let i = mi; i < _threatMarks.length; i++) _threatMarks[i].style.opacity = '0';
}
