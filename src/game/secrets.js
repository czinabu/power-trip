// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SECRETS ON THE STORY MAPS (data/secrets.js has the maps, the kinds and the holocrons' pages): hidden holocrons, crystal
// caves and meditation spots. As a story map loads in any mode that plays one (a campaign chapter, a story mission, an
// arcade contract, a side mission from the temple), the map's secrets are placed in its quiet corners; walk up and press
// interact (F: game/interact.js) to take one. What you find is your hero's for good (game/profile.js noteSecret), so a
// found holocron or harvested cave stays gone on every later visit; a meditation spot stays, to sit at again.
//
// WHERE THEY GO: nobody sets a spot by hand. Once the hero is standing in the new map, the map is walked out from them on
// a coarse grid over the enemy pathing's clearance (enemies/nav.js), so only ground you can reach counts (a room behind
// a shut door, a wall's inside, a lava pool never do). Every reachable cell is scored: far from the start, tucked in by
// walls on several sides, a little seeded luck; each kind takes the best cell well apart from the others. The same map
// deals the same corners while its layout stays the same.
//
// AN OPEN ZONE (data/zones.js) is far too big to walk out like that: its map's `spots` are set by hand, any number of each
// kind, each its own find (its id carries the spot's: zoJedha:holo-gate:holocron) and each holocron with its own page.
// Each stands on the nearest open ground to where it is set.
//
// CO-OP: each browser places and runs its own (a guest's world is built the same way), and each player's finds are their
// own profile's. The training grounds, the sandbox, the temple and survival have none.

import * as THREE from 'three';
import { G, shared, solids, player, hazardZones } from '../state.js';
import { propSolids } from '../world/autosolid.js';
import { scene } from '../engine/renderer.js';
import { CFG } from '../data/config.js';
import { SECRET_MAPS, SECRET_KINDS, SECRET_TUNE as T, HOLOCRONS } from '../data/secrets.js';
import { holocronProp, caveProp, meditateProp } from '../world/secret-props.js';
import { navClearance, navNearestOpen, buildNav } from '../enemies/nav.js';
import { moundY } from '../world/collision.js';
import { hazardContains } from '../world/hazards.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { hostilesIn } from './objectives.js';
import { onInteract, INTERACT_KEY } from './interact.js';
import { pad, padKeys } from '../engine/gamepad.js';
const interactChip = (what) => '<kbd>' + (pad.active ? padKeys(INTERACT_KEY) : INTERACT_KEY) + '</kbd><span>' + what + '</span>';
import { noteSecret, secretFound, profileOf } from './profile.js';
import { codexMeet, codexQuiet } from './codex.js';
import { showBanner } from '../ui/banners.js';
import { floater } from '../fx/floaters.js';
import { burst } from '../fx/particles.js';
import { S, sfx } from '../audio/sfx.js';

const St = { want: false, list: [], near: null, sit: null, shownKey: '', restored: false, level: null };
let el = null;
const prompt = () => el || (el = document.getElementById('secp'));

// the modes that play a story map with its secrets: a mission of any kind (chapters, the Missions page, arcade, side)
export const secretsHere = () => G.mission && !G.training && !G.sandbox && !G.hub && !G.endless;

/* a new arena was just built (game/flow.js startLevel): drop the last map's, and place this one's once the hero stands in it */
export function queueSecrets(){
  St.list = []; St.near = null; St.sit = null; St.restored = false; St.shownKey = ''; St.level = shared.arenaLevel;
  St.want = !!(shared.arenaLevel && SECRET_MAPS[shared.arenaLevel.layout]);
  const e = prompt(); if (e) e.classList.remove('on');
}
export const secretsPlaced = () => St.list.map(s => ({ id: s.id, kind: s.kind, x: s.x, z: s.z, face: s.face, found: s.found }));   // (tests)

/* ---------------- placing ---------------- */
function dice(str){ let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const inHazard = (x, z) => hazardZones.some(hz => hazardContains(hz, x, z));
// the ground under a spot: a hill or a low step (never an overhead slab)
function floorAt(x, z){
  let y = 0;
  for (const c of solids){
    if (c.mound){ const h = moundY(c, x, z); if (h > y) y = h; continue; }
    if (!c.climbable || c.y0 || c.h > 1.2) continue;
    if (c.box ? Math.abs(x - c.x) <= c.hx && Math.abs(z - c.z) <= c.hz : Math.hypot(x - c.x, z - c.z) <= c.r) y = Math.max(y, c.h);
  }
  return y;
}
// every reachable cell from the hero, on a grid `step` m across: [{ x, z, nook, d }]
function reachable(step){
  const H = shared.arenaHalf - 4, HZ = (shared.arenaHalfZ || shared.arenaHalf) - 4;
  const nx = Math.max(2, Math.floor(2 * H / step)), nz = Math.max(2, Math.floor(2 * HZ / step));
  const cx = (i) => -H + (i + 0.5) * step, cz = (j) => -HZ + (j + 0.5) * step;
  const open = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
  const need = CFG.player.radius + 0.35;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++){ const x = cx(i), z = cz(j); open[j * nx + i] = navClearance(x, z) >= need && !inHazard(x, z) ? 1 : 0; }
  const f = shared.secretFrom, p = f ? { x: f[0], z: f[1] } : playerPos();   // (the mission's own start, so every player in a party gets the same spots)
  let si = Math.min(nx - 1, Math.max(0, Math.floor((p.x + H) / step))), sj = Math.min(nz - 1, Math.max(0, Math.floor((p.z + HZ) / step)));
  if (!open[sj * nx + si]){   // (the hero on a step: the nearest open cell)
    let best = -1, bd = 1e9;
    for (let k = 0; k < open.length; k++) if (open[k]){ const d = Math.hypot(cx(k % nx) - p.x, cz((k / nx) | 0) - p.z); if (d < bd){ bd = d; best = k; } }
    if (best < 0) return [];
    si = best % nx; sj = (best / nx) | 0;
  }
  const q = [sj * nx + si]; seen[q[0]] = 1;
  const out = [];
  while (q.length){
    const k = q.pop(), i = k % nx, j = (k / nx) | 0, x = cx(i), z = cz(j);
    let walls = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
      const a = i + di, b = j + dj, n = b * nx + a;
      if (a < 0 || b < 0 || a >= nx || b >= nz){ walls++; continue; }
      if (!open[n]){ walls++; continue; }
      if (navClearance((x + cx(a)) / 2, (z + cz(b)) / 2) < need * 0.8){ walls++; continue; }   // (a thin wall between two open cells)
      if (!seen[n]){ seen[n] = 1; q.push(n); }
    }
    out.push({ x, z, nook: walls, clear: navClearance(x, z), d: Math.hypot(x - p.x, z - p.z) });
  }
  return out;
}
const ROOM = { cave: 3.4, meditate: 2.2, holocron: 1.2 };   // m of clear ground round each kind (the cave's boulders, the ring)
function place(){
  St.want = false;
  const L = shared.arenaLevel, map = L && SECRET_MAPS[L.layout];
  if (!map || !secretsHere()) return;
  if (map.spots) return placeSpots(map);
  const span = Math.max(shared.arenaHalf, shared.arenaHalfZ || 0) * 2;
  const step = Math.max(2, Math.min(4, span / 36));
  const cells = reachable(step);
  if (cells.length < 8) return;
  const r = dice(L.layout), far = Math.max(...cells.map(c => c.d)) || 1;
  // each cell's score: far from the start, hemmed in, a little luck (the luck is fixed per map)
  for (const c of cells) c.s = c.d / far + c.nook * 0.22 + r() * 0.25;
  const taken = [], minApart = span * T.spread * (shared.arenaBig ? 0.5 : 1), minStart = span * T.fromStart * (shared.arenaBig ? 0.25 : 1);
  const kinds = ['holocron', 'cave', 'meditate'].filter(k => map[k]);
  for (const kind of kinds){
    const room = ROOM[kind];
    let best = null;
    for (const c of cells){
      if (c.clear < room * (kind === 'cave' ? 0.55 : 0.8) || c.d < minStart) continue;
      if (taken.some(t => Math.hypot(t.x - c.x, t.z - c.z) < minApart)) continue;
      if (!best || c.s > best.s) best = c;
    }
    if (!best){   // (a small map: the best cell anywhere well clear of the others)
      for (const c of cells) if (c.clear >= room * 0.5 && !taken.some(t => Math.hypot(t.x - c.x, t.z - c.z) < minApart * 0.5) && (!best || c.s > best.s)) best = c;
    }
    if (!best) continue;
    taken.push(best);
    build(kind, map, best);
  }
  if (St.list.some(s => s.solids && s.solids.length)) buildNav();   // (the cave's boulders: foes path round them)
}
// a map's hand-set spots (an open zone's), each on the nearest open ground to where it is set. A zone's map is too big to
// re-path for a cave's boulders, so its foes walk round them the plain way (they collide)
function placeSpots(map){
  const out = { x: 0, z: 0 };
  for (const sp of map.spots){
    if (!SECRET_KINDS[sp.kind]) continue;
    const [x, z] = sp.at;
    if (!navNearestOpen(x, z, 1, 8, out)){ out.x = x; out.z = z; }   // (room for a big body: clear of the walls)
    build(sp.kind, map, { x: out.x, z: out.z }, sp);
  }
}
function build(kind, map, c, spot){
  const id = St.level.layout + ':' + (spot ? spot.id + ':' : '') + kind, col = SECRET_KINDS[kind].col;
  const found = secretFound(id);
  if (found && kind !== 'meditate') return;   // a holocron taken, a cave harvested: gone from this map for good
  // the cave turns its mouth toward the open side (the way you'll walk up)
  let face = 0;
  if (kind === 'cave'){
    let best = -1;
    for (let k = 0; k < 8; k++){ const a = k * Math.PI / 4, v = navClearance(c.x + Math.sin(a) * 4, c.z + Math.cos(a) * 4); if (v > best){ best = v; face = a; } }
  }
  const P = kind === 'holocron' ? holocronProp(col) : kind === 'cave' ? caveProp(col, face) : meditateProp(col);
  const y = floorAt(c.x, c.z);
  P.g.position.set(c.x, y, c.z);
  (shared.arenaGroup || scene).add(P.g);
  const sol = P.solids.map(s => ({ x: c.x + s.x, z: c.z + s.z, r: s.r, h: y + s.h }));
  for (const s of sol) solids.push(s);
  // and whatever of it the boulders don't hold (the holocron's plinth, the cave's roof, a boulder's flank) (world/autosolid.js)
  for (const s of propSolids(P.g)){ solids.push(s); sol.push(s); }
  St.list.push({ id, kind, x: c.x, z: c.z, y, face, P, solids: sol, found, page: kind === 'holocron' ? (spot ? spot.page : map.holocron) : null, sensed: false, spot: !!spot });
}

/* ---------------- using them ---------------- */
function pickNear(){
  if (G.mode !== 'play' || G.paused || G.skillSelect || G.cutscene || player.downed || St.sit) return null;
  const p = playerPos();
  let best = null, bd = Infinity;
  for (const s of St.list){
    if (s.taken) continue;
    const reach = s.kind === 'cave' ? T.reach + 0.6 : s.kind === 'meditate' ? 1.6 : T.reach;
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (d < reach && d < bd){ bd = d; best = s; }
  }
  return best;
}
function verb(s){
  if (s.kind === 'meditate' && hostilesIn(s.x, s.z, T.calm)) return 'TOO CLOSE TO A FIGHT';
  if (s.kind === 'meditate' && St.restored && s.found) return 'MEDITATE (RESTED)';
  return SECRET_KINDS[s.kind].verb;
}
onInteract(() => {
  const s = St.near;
  if (!s || s.taken || !secretsHere() || G.hub) return false;
  if (s.kind === 'meditate'){ if (!St.sit) beginSit(s); return true; }   // (pressed again while sitting: keep sitting)
  take(s);
  return true;
}, () => !!St.near && !St.near.taken && secretsHere() && !G.hub);
// a holocron or a cave: taken at once
function take(s){
  s.taken = true; St.near = null;
  const first = noteSecret(s.id, s.kind);
  const at = new THREE.Vector3(s.x, s.y + 1.3, s.z), K = SECRET_KINDS[s.kind];
  burst(at, K.col, 26, 5, 4, 0.9);
  S.reward(1);
  if (s.kind === 'holocron'){
    const page = HOLOCRONS.find(h => h.id === s.page);
    if (page) codexMeet(page.id);
    showBanner(K.found, page ? page.name + ' · in the codex' : '', 2.6);
  } else {
    const shards = Object.keys(profileOf().secrets || {}).filter(k => k.endsWith(':cave')).length;
    showBanner(K.found, G.hero === 'jedi' ? 'Kyber for the workbench · ' + shards + ' harvested' : 'A crystal from the deep rock', 2.6);
  }
  if (first) floater(at, '+RANK XP', '#ffd24a');
  St.list.splice(St.list.indexOf(s), 1);
  s.P.g.parent && s.P.g.parent.remove(s.P.g);
  for (const sol of s.solids){ const i = solids.indexOf(sol); if (i >= 0) solids.splice(i, 1); }
  if (s.solids.length && !s.spot) buildNav();
}
// a meditation: sit in the circle, still, with no foe near, for a few seconds
function beginSit(s){
  if (hostilesIn(s.x, s.z, T.calm)){ S.uiDeny && S.uiDeny(); showBanner('', 'Too close to a fight to find any peace', 1.6); return; }
  St.sit = { s, t: 0, hp: player.hp };
  sfx(330, 0.5, 'sine', 0.04, 440);
}
function updateSit(dt){
  const m = St.sit, s = m.s, p = playerPos();
  const moved = Math.hypot(s.x - p.x, s.z - p.z) > 1.7, hit = player.hp < m.hp - 0.5;
  if (moved || hit || player.downed || hostilesIn(s.x, s.z, T.calm)){
    St.sit = null; s.P.fill = 0;
    showBanner('', hit ? 'Your meditation is broken' : 'You lose the stillness', 1.4);
    return;
  }
  m.hp = player.hp;
  m.t += dt; s.P.fill = Math.min(1, m.t / T.sit);
  const e = prompt(); if (e){ const b = e.querySelector('b'); if (b) b.style.width = Math.round(s.P.fill * 100) + '%'; }
  if (m.t < T.sit) return;
  St.sit = null; s.P.fill = 0;
  const first = noteSecret(s.id, 'meditate');
  s.found = true;
  const at = new THREE.Vector3(s.x, s.y + 1.4, s.z);
  burst(at, SECRET_KINDS.meditate.col, 22, 3, 5, 0.8);
  if (!St.restored){
    St.restored = true;
    player.hp = Math.max(player.hp, maxHp()); player.force = CFG.player.maxForce;
    showBanner(SECRET_KINDS.meditate.found, 'Health and Force restored' + (first ? ' · rank XP' : ''), 2.4);
  } else showBanner(SECRET_KINDS.meditate.found, first ? 'Rank XP' : 'Nothing more to find here today', 1.8);
  if (first) floater(at, '+RANK XP', '#ffd24a');
  S.reward(first ? 1 : 0);
}

/* once a frame (main.js) */
export function updateSecrets(dt){
  if (St.level !== shared.arenaLevel) queueSecrets();   // (a level built some other way: catch up)
  if (St.want && G.mode === 'play' && !G.paused && !G.cutscene){ try { place(); } catch(e){ St.want = false; console.warn('secrets', e); } }
  const e = prompt();
  if (!St.list.length || !secretsHere()){ St.near = null; St.sit = null; if (e && St.shownKey){ e.classList.remove('on'); St.shownKey = ''; } return; }   // (the last one taken: F is the hero's power again)
  for (const s of St.list) s.P.anim(G.gt);
  if (St.sit && dt > 0) updateSit(dt);
  St.near = St.sit ? St.sit.s : pickNear();
  // a soft chime the first time you come near one you haven't found
  const p = playerPos();
  for (const s of St.list) if (!s.sensed && !s.found && Math.hypot(s.x - p.x, s.z - p.z) < T.sense){ s.sensed = true; sfx(880, 0.35, 'sine', 0.025, 1320); }
  const n = St.near, words = n ? (St.sit ? 'MEDITATING' : verb(n)) : '', key = n ? n.id + words + interactChip('') : '';
  if (e && key !== St.shownKey){
    St.shownKey = key;
    if (n) e.innerHTML = interactChip(words) + (n.kind === 'meditate' ? '<b></b>' : '');
    e.classList.toggle('on', !!n);
  }
}

/* the codex's HOLOCRONS tab follows your heroes' finds (a new save slot's codex starts empty: game/codex.js) */
export function syncHolocronPages(){
  for (const h of ['jedi', 'mando', 'trooper']){
    const found = profileOf(h).secrets || {};
    for (const id in found){
      if (!id.endsWith(':holocron')) continue;
      const [layout, spot] = id.split(':'), map = SECRET_MAPS[layout];
      const page = map && (map.spots ? (map.spots.find(s => s.id === spot) || {}).page : map.holocron);
      if (page) codexQuiet(page);
    }
  }
}
