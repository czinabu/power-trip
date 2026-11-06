// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE OPEN ZONE'S PATROLS (data/zone-jedha.js THREAT has them, by district): while a hero walks a district that has any,
// a patrol comes round a corner some way off, on open ground that walks to them, and hunts them. Beat it and the district
// rests a while before the next. The further from the gate, the tougher the patrol (its tier is a wave's worth: the foes'
// health and tricks follow it, enemies/elites.js). A patrol nobody is near any more (every hero well off) is let go.
// A quest's foes (game/zone-quests.js) come on top of these, and are never let go.
//
// CO-OP: the host owns every foe, as in every mode (net/foes.js), so only the host (or a solo hero) sends patrols, and it
// sends them to wherever any hero in the party is walking, not only its own. A guest is shown them.

import { G, enemies } from '../state.js';
import { districtAt } from '../data/zones.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { removeEnemy } from '../enemies/cleanup.js';
import { navClearance, navRoute } from '../enemies/nav.js';
import { findClearSpawn } from '../world/collision.js';
import { qualityLevel } from '../engine/quality.js';
import { playerPos } from '../player/helpers.js';
import { partnerStand } from '../net/partner.js';
import { net, connected } from '../net/session.js';
import { V3 } from '../utils.js';

export const FIGHT_TUNE = {
  near: 22, far: 34,   // m from the hero a patrol comes in
  clearOf: 18,         // ...and never closer than this to any hero
  first: 6,            // s in a district before its first patrol
  letGo: 72,           // m: a roaming foe this far from every hero is let go
  every: 0.5,          // s between looks
};
const F = { Z: null, life: null, rest: {}, inT: {}, sent: {}, t: 0 };

export function startZoneFights(Z){ F.Z = Z; F.life = Z.life || null; F.rest = {}; F.inT = {}; F.sent = {}; F.t = 0; }
export function stopZoneFights(){ F.Z = null; F.life = null; }

// every hero in the party, where they stand (the host's own and every guest's)
function heroes(){
  const p = playerPos(), out = [{ x: p.x, z: p.z }];
  if (net.role === 'host' && connected()) for (const P of partnerStand()) out.push({ x: P.pos.x, z: P.pos.z });
  return out;
}
const roaming = () => enemies.filter(e => e.zr && !e.dead);
export const zonePatrols = () => roaming().length;   // (tests)
// how tough a foe sent now is: the district's tier (its health is set as it spawns, enemies/elites.js enemyHpScale)
export function zoneTier(x, z){
  const d = F.Z && districtAt(F.Z, x, z), th = d && F.life && F.life.threat[d.id];
  return th && th.tier ? th.tier : 1;
}

/* once a frame (game/zone.js updateZone): the host's or a solo hero's */
export function updateZoneFights(dt){
  if (!F.Z || !F.life || G.coopGuest) return;
  F.t -= dt;
  if (F.t > 0) return;
  F.t = FIGHT_TUNE.every;
  const H = heroes();
  // a roaming foe every hero has left far behind goes
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    if (!e.zr || e.dead) continue;
    const p = e.group.position;
    if (H.every(h => Math.hypot(h.x - p.x, h.z - p.z) > FIGHT_TUNE.letGo)){ removeEnemy(e); enemies.splice(i, 1); }
  }
  // which districts a hero is in now, and for how long
  const here = {};
  for (const h of H){ const d = districtAt(F.Z, h.x, h.z); if (d) (here[d.id] ||= []).push(h); }
  for (const id in F.inT) if (!here[id]) delete F.inT[id];
  const live = roaming(), cap = F.life.cap[qualityLevel()] || F.life.cap.medium;
  for (const id in here){
    F.inT[id] = (F.inT[id] || 0) + FIGHT_TUNE.every;
    F.rest[id] = Math.max(0, (F.rest[id] || 0) - FIGHT_TUNE.every);
    const th = F.life.threat[id];
    if (!th || !th.tier || F.inT[id] < FIGHT_TUNE.first || F.rest[id] > 0) continue;
    const mine = live.filter(e => e.zr === id);
    if (mine.length) continue;   // its patrol is still out
    if (F.sent[id]){ F.sent[id] = 0; F.rest[id] = th.rest; continue; }   // its last one was beaten (or let go): it rests
    if (live.length + th.n > cap) continue;
    const at = pickSpot(id, here[id], H);
    if (!at) continue;
    sendPatrol(id, th, at);
    F.sent[id] = 1;
    return;   // (one a look at most)
  }
}
// open ground the patrol can walk to its hero from, in the same district, out of sight of every hero
function pickSpot(id, hs, H){
  let routes = 4;   // (a route is a search: a few a look at most)
  for (let k = 0; k < 18 && routes > 0; k++){
    const h = hs[k % hs.length], a = Math.random() * Math.PI * 2, r = FIGHT_TUNE.near + Math.random() * (FIGHT_TUNE.far - FIGHT_TUNE.near);
    const x = h.x + Math.sin(a) * r, z = h.z + Math.cos(a) * r, d = districtAt(F.Z, x, z);
    if (!d || d.id !== id || navClearance(x, z) < 1.4) continue;
    if (H.some(o => Math.hypot(o.x - x, o.z - z) < FIGHT_TUNE.clearOf)) continue;
    routes--;
    if (!navRoute(x, z, h.x, h.z, 0, 2600)) continue;   // (walks to them: not a yard behind a shut gate)
    return { x, z };
  }
  return null;
}
function sendPatrol(id, th, at){
  const was = G.waveTotal;
  G.waveTotal = th.tier;
  for (let i = 0; i < th.n; i++){
    const a = i / th.n * Math.PI * 2, s = findClearSpawn(at.x + Math.sin(a) * 1.8, at.z + Math.cos(a) * 1.8, 1.0);
    spawnEnemy(th.foes[i % th.foes.length], V3(s.x, 0, s.z));
    enemies[enemies.length - 1].zr = id;
  }
  G.waveTotal = was;
}
// a quest's foes (game/zone-quests.js), at the tier of where they stand: tagged with the quest, never let go
export function sendQuestFoes(qid, list, at){
  const was = G.waveTotal, out = [];
  G.waveTotal = zoneTier(at[0], at[1]);
  list.forEach((type, i) => {
    const a = i / list.length * Math.PI * 2, s = findClearSpawn(at[0] + Math.sin(a) * 2.2, at[1] + Math.cos(a) * 2.2, 1.0);
    spawnEnemy(type, V3(s.x, 0, s.z));
    const e = enemies[enemies.length - 1]; e.zq = qid; out.push(e);
  });
  G.waveTotal = was;
  return out;
}
