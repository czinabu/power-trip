// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A CHASE ACROSS THE OPEN ZONE: a set piece, run as a side quest's `chase` step (game/zone-quests.js runs the quest,
// data/zone-jedha.js has the route, the gates and the words). Somebody bolts through the streets, district to district,
// and the party runs them down.
//
//   · THE RUN: the quarry runs its route at a pace set by how close the nearest hero is (it sprints when you're on its
//     heels and slows when you fall far behind, so a party is never shaken off by speed alone). Get within arm's reach of
//     it and it's caught where it stands: a Jedi's leaps, a Mando's jetpack over the roofs or a trooper who reads the
//     route and cuts a corner all close the gap.
//   · THE GATES: as it passes each one it shuts it behind it, each a STYLED LOCK (game/locks.js) built for one hero's
//     way: a blast door it seals (a Jedi tears it open with the Force twice as fast), a barricade piled high (worked from
//     the top: fly, jump or climb, twice as fast) or a checkpoint's shield gate (the trooper and his squad hold the line).
//     Anyone can open any of them, or go round.
//   · LOST: nobody within `sight` of it for `lost` seconds and it gets away (the escape clock holds while a hero is at a
//     shut gate, working it). It starts again from where it bolted, the gates open.
//   · THE END: it reaches the end of its route with a hero in sight (or is caught) and turns to fight (with nobody in
//     sight it waits there, and slips away if nobody comes): the quest's next step (a `clear`) is
//     fought where it stands.
//
// CO-OP: the host runs it (the quarry, the gates and their work, as every quest is the host's) and sends it to every
// guest ('zc'); each screen draws its own copy, and every gate's barrier is solid on every screen.

import * as THREE from 'three';
import { G, shared, solids } from '../state.js';
import { V3, clamp, rand } from '../utils.js';
import { playerPos } from '../player/helpers.js';
import { players, targetable } from '../player/players.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { updateLegs } from '../enemies/gait.js';
import { updateUpper } from '../enemies/upper.js';
import { groundAt } from '../world/collision.js';
import { LOCK, lockRate } from './locks.js';
import { makeBeacon, setMarkerColor, pulseMarker, removeMarker, mmss } from './objectives.js';
import { showBanner } from '../ui/banners.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { S, sfx } from '../audio/sfx.js';
import { net, on, send, connected } from '../net/session.js';

export const CHASE_TUNE = {
  pace: [[10, 8.2], [22, 7.2], [36, 5.8], [999, 3.2]],   // [gap to the nearest hero (m), its speed (m/s)]: it sprints when you're close
  catch: 2.6,      // m: this close and it's caught
  sight: 45,       // m: further than this from every hero, it's slipping away...
  lost: 10,        // ...and after this many seconds of that, it's gone
  gate: { time: 4, r: 3.2, h: 4.6 },   // a gate: seconds of work at a hero's pace, how close counts, the barrier's height
  restart: 2.4,    // s from getting away to bolting again from the start
  send: 0.1,       // s between the host's words to its guests
};
const GREEN = 0x7bffae;
const C = { on: false, host: true, def: null, qid: null, P: null, d: 0, v: 0, q: null, gates: [], lostT: 0, state: 'run', t: 0, run: 0, net: null, sendT: 0, caught: null, said: false };

/* ---------- the route ---------- */
function pathOf(pts){
  const P = { pts, cum: [0], len: 0 };
  for (let i = 1; i < pts.length; i++){ P.len += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]); P.cum.push(P.len); }
  return P;
}
function pathAt(P, d){
  d = clamp(d, 0, P.len);
  let k = 0; while (k < P.pts.length - 2 && d > P.cum[k + 1]) k++;
  const a = P.pts[k], b = P.pts[k + 1], L = P.cum[k + 1] - P.cum[k] || 1, t = (d - P.cum[k]) / L;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}
// how far along the route a point lies (the nearest spot on it)
function project(P, x, z){
  let best = 0, bd = Infinity;
  for (let i = 0; i < P.pts.length - 1; i++){
    const [ax, az] = P.pts[i], [bx, bz] = P.pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < bd){ bd = d; best = P.cum[i] + t * Math.sqrt(l2); }
  }
  return best;
}

/* ---------- the quarry ---------- */
function buildQuarry(q){
  const g = buildEnemyMesh(ENEMY_TYPES[q.foe] || ENEMY_TYPES.officer, { seed: 11 });   // (seeded: the same look on every screen)
  if (q.tint != null && g.userData.bodyMat) g.userData.bodyMat.color.lerp(new THREE.Color(q.tint), 0.5);
  const tag = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xff4a3a, depthTest: false, transparent: true, opacity: 0.9, toneMapped: false }));
  tag.rotation.x = Math.PI; tag.renderOrder = 998;
  const parent = shared.arenaGroup;   // (it stands in the arena's group: dropped with the zone)
  parent.add(g, tag);
  return { g, tag, def: q, yaw: 0, y: 0, parent };
}
function placeQuarry(dt, x, z, yaw, moving){
  const q = C.q; if (!q) return;
  const want = groundAt(x, z, q.y + 1.2);
  q.y = dt ? q.y + (want - q.y) * Math.min(1, dt * 12) : want;
  q.yaw = dt ? q.yaw + Math.atan2(Math.sin(yaw - q.yaw), Math.cos(yaw - q.yaw)) * Math.min(1, dt * 8) : yaw;
  q.g.position.set(x, q.y, z); q.g.rotation.set(0, q.yaw, 0);
  updateLegs(q, q.g, moving ? dt : 0, 'ground');
  const near = nearestHero(x, z);
  updateUpper(q, q.g, dt, near ? near.pos : V3(x, 0, z + 1));
  q.tag.position.set(x, q.y + 2.7 + Math.sin(G.gt * 5) * 0.12, z);
}

/* ---------- the gates ---------- */
const put = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.4, ...o });
// a barrier across the street at `at`, `w` wide, square to the route there; its lock stands on the side you come from
function buildGate(def, P){
  const d = project(P, def.at[0], def.at[1]), p = pathAt(P, d), H = CHASE_TUNE.gate.h, w = def.w || 7;
  const g = new THREE.Group(), col = LOCK.color[def.style];
  if (def.style === 'seal'){   // a blast door, sealed shut: a seam of light down its middle
    g.add(put(new THREE.Mesh(new THREE.BoxGeometry(w, H, 0.8), mat(0x4a4e58)), 0, H / 2, 0));
    g.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.25, H * 0.92, 0.9), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })), 0, H / 2, 0));
    for (const s of [-1, 1]) g.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.8, H + 0.6, 1.2), mat(0x2e3238)), s * (w / 2 + 0.2), (H + 0.6) / 2, 0));
  } else if (def.style === 'sky'){   // a barricade piled high, a lit cable winch on top
    for (let i = 0; i < Math.ceil(w / 1.6); i++) for (let j = 0; j < 3; j++){
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.45, 1.4), mat(j % 2 ? 0x6a5a44 : 0x5a4c3a, { metalness: 0.1 }));
      c.position.set(-w / 2 + 0.8 + i * 1.6 + (j % 2) * 0.3, 0.72 + j * 1.45, rand(-0.15, 0.15)); c.rotation.y = rand(-0.1, 0.1); g.add(c);
    }
    g.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 8), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })), 0, H + 0.3, 0));
  } else {   // a checkpoint's shield gate: two posts and the field between them
    for (const s of [-1, 1]) g.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.7, H + 0.8, 0.7), mat(0x3a3e46)), s * w / 2, (H + 0.8) / 2, 0));
    g.add(put(new THREE.Mesh(new THREE.PlaneGeometry(w, H), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })), 0, H / 2, 0));
  }
  g.position.set(p.x, groundAt(p.x, p.z, 3), p.z); g.rotation.y = p.yaw;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.visible = false;
  shared.arenaGroup.add(g);
  // the barrier is solid once it's shut (a box, turned to the street: the route runs along x or z)
  const alongX = Math.abs(Math.sin(p.yaw)) > Math.abs(Math.cos(p.yaw));
  const solid = { x: p.x, z: p.z, hx: alongX ? 0.5 : w / 2, hz: alongX ? w / 2 : 0.5, h: H, box: true };
  // its lock: on the near side, back down the route
  const back = pathAt(P, Math.max(0, d - 2.6));
  return { def, d, x: p.x, z: p.z, yaw: p.yaw, g, solid, lx: back.x, lz: back.z, shut: false, open: false, prog: 0, m: null, sink: 0 };
}
function shutGate(k){
  if (k.shut || k.open) return;
  k.shut = true; k.g.visible = true; k.sink = 0;
  k.g.position.y = groundAt(k.x, k.z, 3);
  solids.push(k.solid);
  k.m = makeBeacon(k.lx, k.lz, 0, LOCK.color[k.def.style], CHASE_TUNE.gate.r / 0.9);
  burst(V3(k.x, 2, k.z), LOCK.color[k.def.style], 16, 6, 4, 0.8);
  sfx(160, 0.35, 'square', 0.05, 80);
  const me = playerPos();
  if (Math.hypot(me.x - k.x, me.z - k.z) < 60) showBanner(LOCK.name[k.def.style], C.def.gateLine && C.def.gateLine[k.def.style] || LOCK.hint[k.def.style], 2.8, { kicker: 'IT SHUT THE WAY BEHIND IT' });
}
function openGate(k){
  if (k.open) return;
  k.open = true; k.shut = false;
  const i = solids.indexOf(k.solid); if (i >= 0) solids.splice(i, 1);
  if (k.m){ setMarkerColor(k.m, GREEN); removeMarker(k.m); k.m = null; }
  burst(V3(k.x, 1.5, k.z), GREEN, 20, 7, 5, 0.9); S.reward && S.reward(1);
  floater(V3(k.x, 2.4, k.z), 'THE WAY IS OPEN', '#7bffae');
}
function resetGate(k){
  const i = solids.indexOf(k.solid); if (i >= 0) solids.splice(i, 1);
  if (k.m){ removeMarker(k.m); k.m = null; }
  k.shut = false; k.open = false; k.prog = 0; k.g.visible = false; k.sink = 0;
}

/* ---------- who's where ---------- */
const standing = () => players.filter(h => h.local ? true : targetable(h));
function nearestHero(x, z){
  let best = null, bd = Infinity;
  for (const h of standing()){ const d = Math.hypot(h.pos.x - x, h.pos.z - z); if (d < bd){ bd = d; best = h; } }
  return best ? Object.assign(best, { _d: bd }) : null;
}
// a hero on the near side of a gate it has shut behind it (they can't reach it through the gate)
const behindGate = (h) => C.gates.some(k => k.shut && project(C.P, h.pos.x, h.pos.z) < k.d);
const paceFor = (gap) => { for (const [g, v] of CHASE_TUNE.pace) if (gap < g) return v; return CHASE_TUNE.pace[CHASE_TUNE.pace.length - 1][1]; };

/* ============================================================
   THE LIFE OF ONE (game/zone-quests.js starts and stops it with its step)
   ============================================================ */
// a chase step begins on this screen. qid: the quest's id, step: its data, host: this screen runs it
export function startChase(qid, step, host){
  if (C.on && C.qid === qid && C.def === step) return;
  stopChase();
  Object.assign(C, { on: true, host, def: step, qid, P: pathOf(step.route), d: 0, v: 0, lostT: 0, state: 'run', t: 0, run: 0, net: null, sendT: 0, caught: null, said: false });
  C.q = buildQuarry(step.quarry || {});
  C.gates = (step.gates || []).map(g => buildGate(g, C.P));
  const p = pathAt(C.P, 0); placeQuarry(0, p.x, p.z, p.yaw, false);
}
export function stopChase(){
  if (!C.on) return;
  for (const k of C.gates){ resetGate(k); if (k.g.parent) k.g.parent.remove(k.g); }
  if (C.q){ for (const o of [C.q.g, C.q.tag]) if (o.parent) o.parent.remove(o); }
  Object.assign(C, { on: false, q: null, gates: [], def: null, qid: null, net: null });
}
export const chaseOn = () => C.on;
export const chaseState = () => C.on ? { state: C.state, d: C.d, len: C.P.len, v: C.v, host: C.host, q: C.q && [C.q.g.position.x, C.q.g.position.z],
  gates: C.gates.map(k => ({ style: k.def.style, shut: k.shut, open: k.open, prog: k.prog, x: k.lx, z: k.lz })), lostT: C.lostT, caught: C.caught } : null;
// where it was caught or cornered (the quest's next step, the fight, is fought there)
export const chaseEnd = () => C.caught;

// the host (or a solo hero): one frame. Returns true once it's caught or cornered
export function updateChaseHost(dt){
  if (!C.on || !C.host) return false;
  const T = CHASE_TUNE;
  C.t += dt;
  if (C.state === 'lost'){
    if (C.t >= T.restart){
      C.state = 'run'; C.t = 0; C.d = 0; C.v = 0; C.lostT = 0; C.run++;
      for (const k of C.gates) resetGate(k);
      showBanner('', 'It bolts again from where it started.', 2);
    }
    tellGuests(dt, true);
    return false;
  }
  const p0 = pathAt(C.P, C.d), near = nearestHero(p0.x, p0.z), gap = near ? near._d : 999;
  // caught: a hero got to it
  if (gap < T.catch && C.d > 4 && !behindGate(near)){ return corner(p0, true); }   // (not through a shut gate)
  // its pace, by how close you are
  const want = paceFor(gap);
  C.v += (want - C.v) * Math.min(1, dt * 3);
  C.d += C.v * dt;
  // a gate it has run through shuts behind it
  for (const k of C.gates) if (!k.shut && !k.open && C.d > k.d + 1.2) shutGate(k);
  // the gates: worked by whoever is on them, faster in their own way
  let working = null;
  for (const k of C.gates){
    if (!k.shut) continue;
    const rate = lockRate(k.lx, k.lz, T.gate.r, k.def.style);
    if (rate > 0){ k.prog += rate * dt; k.pace = rate; working = k; if (Math.random() < dt * 8) burst(V3(k.lx, 1, k.lz), LOCK.color[k.def.style], 2, 3, 3, 0.6); }
    if (k.prog >= T.gate.time) openGate(k);
  }
  C.working = working;
  // slipping away: out of everyone's sight long enough, and nobody at a shut gate
  const atGate = C.gates.some(k => k.shut && standing().some(h => Math.hypot(h.pos.x - k.lx, h.pos.z - k.lz) < T.gate.r + 3));
  if (gap > T.sight && !atGate) C.lostT += dt; else C.lostT = Math.max(0, C.lostT - dt * 2);
  if (C.lostT >= T.lost){
    C.state = 'lost'; C.t = 0;
    showBanner((C.def.quarry && C.def.quarry.name || 'THEY') + ' GOT AWAY', 'Back to where the chase began.', 2.6, { kicker: 'LOST' });
    S.uiDeny && S.uiDeny();
    tellGuests(dt, true);
    return false;
  }
  const p = pathAt(C.P, C.d);
  placeQuarry(dt, p.x, p.z, p.yaw, true);
  for (const k of C.gates) pulse(k, dt);
  if (C.d >= C.P.len){   // the end of its run: cornered if a hero is in sight, else it waits there (and slips away in time)
    C.d = C.P.len; C.v = 0;
    if (gap < T.sight) return corner(p, false);
  }
  tellGuests(dt);
  return false;
}
function corner(p, caught){
  C.state = 'done'; C.caught = [p.x, p.z];
  burst(V3(p.x, 1.4, p.z), 0xffd24a, 18, 6, 4, 0.8);
  showBanner(caught ? 'CAUGHT' : 'CORNERED', caught ? 'You ran it down. It turns to fight.' : 'Nowhere left to run. It turns to fight.', 2.4, { kicker: C.def.quarry && C.def.quarry.name || '' });
  sfx(520, 0.2, 'square', 0.05, 260);
  tellGuests(0, true);
  return true;
}
function pulse(k, dt){
  if (k.m) pulseMarker(k.m, dt, G.gt);
  if (k.open && k.g.visible){   // an opened gate sinks into the street
    k.sink += dt * 2.4; k.g.position.y = groundAt(k.x, k.z, 3) - k.sink;
    if (k.sink > CHASE_TUNE.gate.h + 1) k.g.visible = false;
  }
}

/* ---------- co-op ---------- */
const r2 = (n) => Math.round(n * 100) / 100;
function tellGuests(dt, now = false){
  if (net.role !== 'host' || !connected()) return;
  if (!now && (C.sendT -= dt) > 0) return;
  C.sendT = CHASE_TUNE.send;
  const q = C.q && C.q.g.position;
  send({ t: 'zc', id: C.qid, r: C.run, s: C.state, d: r2(C.d), v: r2(C.v), q: q ? [r2(q.x), r2(q.z)] : null, c: C.caught,
         g: C.gates.map(k => [k.shut ? 1 : 0, k.open ? 1 : 0, r2(k.prog)]), l: r2(C.lostT) });
}
on('zc', (m) => {
  if (net.role !== 'guest' || !C.on || C.host || m.id !== C.qid) return;
  if (C.net && m.r !== C.net.r) for (const k of C.gates) resetGate(k);
  C.net = m;
});
// a guest: the host's quarry and gates, drawn here
export function updateChaseGuest(dt){
  if (!C.on || C.host || !C.net) return;
  const m = C.net;
  C.state = m.s; C.lostT = m.l; C.caught = m.c || null;
  C.d += ((m.d) - C.d) * Math.min(1, dt * 10) + (m.s === 'run' ? m.v * dt * 0.5 : 0);
  if (Math.abs(m.d - C.d) > 8) C.d = m.d;
  C.v = m.v;
  m.g.forEach((w, i) => {
    const k = C.gates[i]; if (!k) return;
    k.prog = w[2];
    if (w[1] && !k.open){ if (!k.shut) shutGate(k); openGate(k); }
    else if (w[0] && !k.shut && !k.open) shutGate(k);
    else if (!w[0] && !w[1] && (k.shut || k.open)) resetGate(k);
    pulse(k, dt);
  });
  const p = pathAt(C.P, C.d);
  placeQuarry(dt, p.x, p.z, p.yaw, m.s === 'run');
}

/* ---------- the HUD's line and the compass's marks (game/zone-quests.js) ---------- */
export function chaseStatus(){
  if (!C.on) return '';
  const name = (C.def.quarry && C.def.quarry.name) || 'THE QUARRY';
  if (C.state === 'lost') return name + ' GOT AWAY';
  if (C.state === 'done') return 'IT TURNS TO FIGHT';
  const k = C.working;
  if (k) return LOCK.name[k.def.style] + ' · STAY ON IT' + (k.pace > 1.01 ? ' ×' + k.pace.toFixed(1) : '');
  const p = C.q && C.q.g.position, me = playerPos(), gap = p ? Math.round(Math.hypot(p.x - me.x, p.z - me.z)) : 0;
  return C.lostT > 0.5 ? 'LOSING ' + name + ' · ' + mmss(CHASE_TUNE.lost - C.lostT) : 'RUN ' + name + ' DOWN · ' + gap + ' M';
}
export function chaseMarks(){
  if (!C.on) return [];
  const out = [];
  if (C.q && C.state === 'run') out.push({ x: C.q.g.position.x, z: C.q.g.position.z, kind: 'obj' });
  for (const k of C.gates) if (k.shut) out.push({ x: k.lx, z: k.lz, kind: 'obj' });
  return out;
}
