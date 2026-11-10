// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TEAM-UP MOVES (data/teamups.js has the moves and their numbers): things two heroes do together that neither can do
// alone. Every mode with a fight has them; the duel ring (a sparring duel, a boss duel's ring) never does.
//
//   THE PROMPT   every few frames this screen looks for a partner in reach (online: net/partner.js partnerStand; solo:
//                the apprentice or a squadmate) and a setup that's right for the pair (a foe to lift, a crowd to drop into,
//                a duellist to pin...). The first one found is shown under the crosshair: U (a pad: D-pad down) and its name.
//   THE PRESS    online, a press is an OFFER ('tu', passed on to every screen by the host: net/session.js RELAY). Your
//                partner's prompt lights up ("KIRA IS READY"); when they press too, within TEAMUP.window, the host (the
//                referee, even when it isn't one of the two) matches the two offers and sends GO ('tug') to everyone.
//                Solo, the press is the go: the ally plays the other part.
//   THE MOVE     on GO every screen plays the shared part (the tether between the two, the rocket, the dome, the slam);
//                each of the two heroes plays their own part on their own screen (facing, gesture, the jetpack flight, the
//                Jedi's finisher), held to it for the move's length; and the screen that owns the foes (the host in a
//                shared fight, the only one solo) lands what it does to them. A guest's own blows (the finisher) go to the
//                host the usual way (net/run.js queueHit).
// On a boss each move lands a capped share; a raid boss's sunder bar takes a chunk instead (boss/finale.js teamupSunder).

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, enemies, shared } from '../state.js';
import { V3, clamp } from '../utils.js';
import { TEAMUP, TEAMUPS, PAIRS, SOLO, pairKey } from '../data/teamups.js';
import { playerPos } from '../player/helpers.js';
import { castGesture } from '../player/jedi/force.js';
import { finishType, tryFinisher } from '../player/jedi/finisher.js';
import { damageEnemy, staggerEnemy, flinchEnemy } from '../enemies/damage.js';
import { bodyRadius } from '../enemies/bodyshape.js';
import { damageBoss, bossStagger } from '../boss/boss.js';
import { teamupSunder } from '../boss/finale.js';
import { allies } from '../allies/squad.js';
import { duelRingOn } from '../allies/squad.js';
import { apprenticeNow } from '../allies/apprentice.js';
import { pvpOn } from './pvp-rules.js';
import { burst } from '../fx/particles.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { explosion, sparks, groundRing, motes, puff } from '../fx/ink.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { bark } from '../fx/barks.js';
import { addTeamDome, updateTeamDomes, clearTeamDomes } from '../fx/team-dome.js';
import { SEAT_COLORS } from '../ui/coop-marks.js';
import { showBanner } from '../ui/banners.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { S, sfx } from '../audio/sfx.js';
import { partnerStand } from '../net/partner.js';
import { nameOf } from '../net/names.js';
import { net, on, send, connected } from '../net/session.js';
import { runKind } from '../net/foes.js';

const T = {
  cdUntil: -1e9,      // this hero's next team-up, by the game clock
  busyUntil: -1e9,    // committed to one until then: no other move (engine/input.js asks teamupBusy)
  checkT: 0,
  cand: null,         // the setup found last check: { k, mate, n, x, y, z } (mate: a partner { slot, ... } or an ally)
  offer: null,        // what this hero pressed for, online: { k, p, at } (performance.now)
  heard: new Map(),   // slot -> the last offer heard from that player { k, p, n, x, y, z, h, at }
  offers: new Map(),  // the host (the referee): slot -> that player's offer, this one's own included
  runs: [],           // the moves playing on this screen
  face: null,         // this hero's facing while committed (player/animation.js reads player.teamFace)
  fly: null,          // this hero's scripted flight (JETPACK DROP)
  el: null, shown: '',
  done: 0,            // team-ups this hero has been part of (the smoke test reads it)
};

/* ---------------- who's who ---------------- */
const mySlot = () => (connected() ? net.slot || 0 : 0);
const coop = () => connected() && net.status === 'connected';
// foes are shared (the host runs them: a survival run, the campaign, a mission, a zone) or each screen runs its own (the
// sandbox and training, even with friends in)
const sharedFight = () => !!G.coopGuest || (net.role === 'host' && coop() && !!runKind());
// is this screen the one that lands a move on the foes? The host in a shared fight; solo the only one; otherwise each of
// the two heroes on their own screen's foes
const owns = (role) => !coop() ? true : sharedFight() ? net.role === 'host' : role != null;

// can team-ups happen at all right now, here?
function allowed(){
  if (G.mode !== 'play' || G.paused || G.skillSelect || G.cutscene || G.hub || G.noTeamups) return false;
  if (pvpOn() || duelRingOn()) return false;   // the duel ring: one on one, always (a sparring duel, a boss duel's ring)
  if (player.downed || G.zoneFallT > 0) return false;
  return true;
}
export const teamupBusy = () => G.mode === 'play' && G.gt < T.busyUntil;

const alive = (e) => !!e && !e.dead && !e.converted && e.state !== 'spawn' && e.state !== 'fade' && !e.sparring && e.ward !== 0;
const bossy = (e) => e === shared.boss || !!e.fin;
const tough = (e) => !!(e.t && (e.t.heavy || e.warbringer || e.champion)) || bossy(e);
const foes = () => { const l = enemies.filter(alive); if (shared.boss && shared.boss.hp > 0 && shared.boss.group) l.push(shared.boss); return l; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const facing = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
// (an ally, solo, turns to whatever the hero picks: only a hero's own facing counts)
const faces = (P, p, cos) => !!P.ally || inFront(P.pos, P.yaw, p, cos);
const inFront = (from, yaw, p, cos) => { const f = facing(yaw), dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz) || 1; return (dx * f.x + dz * f.z) / d > cos; };
const nidOf = (e) => (e === shared.boss ? 'B' : e.nid);
const byNid = (n) => (n === 'B' ? shared.boss : n == null ? null : enemies.find(e => e.nid === n) || null);

// the hero who plays each part: a seat online (this one, or a partner's), or 'ally' solo
function partFor(k, mine, mate){
  const H = TEAMUPS[k].heroes;
  if (H[0] === H[1]) return mine.slot < mate.slot ? { a: mine, b: mate } : { a: mate, b: mine };
  return mine.hero === H[0] ? { a: mine, b: mate } : { a: mate, b: mine };
}

/* ---------------- THE SETUPS: is the move on, and at what? (A and B: { pos, yaw, hero }) ---------------- */
function crowdAt(list, p, r){ let n = 0, x = 0, z = 0; for (const e of list){ const q = e.group.position; if (flat(q, p) < r){ n++; x += q.x; z += q.z; } } return n ? { n, x: x / n, z: z / n } : null; }
function bestCrowd(list, from, maxD, minD, r, need){
  let best = null;
  for (const e of list){
    const q = e.group.position, d = flat(q, from);
    if (d > maxD || d < minD) continue;
    const c = crowdAt(list, q, r);
    if (c && c.n >= need && (!best || c.n > best.n || (c.n === best.n && d < best.d))) best = { ...c, d };
  }
  return best;
}
const SETUP = {
  lift(D, A, B, list){
    let best = null, bd = 1e9;
    for (const e of list){
      if (tough(e)) continue;
      const q = e.group.position, d = flat(q, A.pos);
      if (d > D.reach || flat(q, B.pos) > D.far || !faces(A, q, 0.2)) continue;
      if (d < bd){ bd = d; best = e; }
    }
    return best && { n: nidOf(best), p: best.group.position };
  },
  carry(D, A, B, list){
    if (!A.packed) return null;
    const c = bestCrowd(list.filter(e => !bossy(e)), B.pos, D.far, 6, D.crowd, D.min);
    return c && { n: null, p: { x: c.x, y: 0, z: c.z } };
  },
  pin(D, A, B, list){
    let best = null, bd = 1e9;
    for (const e of list){
      if (bossy(e) || !finishType(e)) continue;
      const q = e.group.position, d = flat(q, B.pos);
      if (d > D.far || flat(q, A.pos) > D.reach) continue;
      const w = d - (e.dp || e.ff || e.champion ? 3 : 0);   // a duellist first
      if (w < bd){ bd = w; best = e; }
    }
    return best && { n: nidOf(best), p: best.group.position };
  },
  barrier(D, A, B, list){
    const mid = { x: (A.pos.x + B.pos.x) / 2, y: 0, z: (A.pos.z + B.pos.z) / 2 };
    const shooters = list.filter(e => e.t && e.t.ranged && flat(e.group.position, mid) < 40).length;
    return shooters >= D.shooters ? { n: null, p: mid } : null;
  },
  mark(D, A, B, list){
    let seed = null, bd = 1e9;
    for (const e of list){
      const q = e.group.position, d = flat(q, A.pos);
      if (d > D.reach || flat(q, B.pos) > D.far || !(A.ally ? faces(B, q, 0.35) : faces(A, q, 0.35))) continue;
      if (d < bd){ bd = d; seed = e; }
    }
    if (!seed) return null;
    return marksAround(list, seed.group.position, D).length >= D.min ? { n: nidOf(seed), p: seed.group.position } : null;
  },
  sweep(D, A, B, list){
    const c = bestCrowd(list.filter(e => !bossy(e)), A.pos, D.reach, 3, D.crowd, D.min);
    return c && flat(c, B.pos) < D.far + D.crowd ? { n: null, p: { x: c.x, y: 0, z: c.z } } : null;
  },
  push(D, A, B, list){
    const mid = { x: (A.pos.x + B.pos.x) / 2, z: (A.pos.z + B.pos.z) / 2 };
    const c = bestCrowd(list, mid, D.range * 0.8, 1, 5, D.min);
    if (!c || !faces(A, c, 0) || !faces(B, c, 0)) return null;
    return { n: null, p: { x: c.x, y: 0, z: c.z } };
  },
  backs(D, A, B, list){
    const mid = { x: (A.pos.x + B.pos.x) / 2, y: 0, z: (A.pos.z + B.pos.z) / 2 };
    return list.filter(e => flat(e.group.position, mid) < D.ring).length >= D.min ? { n: null, p: mid } : null;
  },
};
// the marks a MARKED VOLLEY takes, nearest the seed first
function marksAround(list, p, D){
  return list.filter(e => flat(e.group.position, p) < D.spread).sort((a, b) => flat(a.group.position, p) - flat(b.group.position, p)).slice(0, D.marks);
}

function setupFor(k, A, B){
  const D = TEAMUPS[k];
  if (flat(A.pos, B.pos) > D.gap) return null;
  const s = SETUP[k](D, A, B, foes());
  return s ? { k, n: s.n, x: +s.p.x.toFixed(2), y: +(s.p.y || 0).toFixed(2), z: +s.p.z.toFixed(2) } : null;
}

const meNow = () => ({ slot: mySlot(), hero: G.hero, pos: playerPos(), yaw: player.faceYaw ?? player.group.rotation.y, packed: G.hero === 'mando' && (player.up.jetTier || 0) >= 1, me: true, group: player.group });

/* what this hero could team up on right now: online with the nearest partner in reach, solo with an ally */
function findCandidate(){
  const me = meNow();
  if (coop()){
    const mates = partnerStand().filter(P => !P.away && flat(P.pos, me.pos) < TEAMUP.near).sort((a, b) => flat(a.pos, me.pos) - flat(b.pos, me.pos));
    for (const P of mates){
      const mate = { slot: P.slot, hero: P.hero, pos: P.pos, yaw: P.yaw, packed: P.hero === 'mando' && P.packed, name: P.name, group: P.group };
      for (const k of PAIRS[pairKey(me.hero, mate.hero)] || []){
        const { a, b } = partFor(k, me, mate), s = setupFor(k, a, b);
        if (s) return { ...s, mate };
      }
    }
    return null;
  }
  // solo: the hero's apprentice or a squadmate on their feet, near
  const app = apprenticeNow().ally;
  const near = allies.filter(a => a.state !== 'down' && !a.net && flat(a.group.position, me.pos) < TEAMUP.near);
  for (const o of SOLO[G.hero] || []){
    const pool = o.ally === 'apprentice' ? near.filter(a => a === app) : o.ally === 'squad' ? near.filter(a => a !== app) : near;
    for (const a of pool.sort((x, y) => flat(x.group.position, me.pos) - flat(y.group.position, me.pos))){
      const H = TEAMUPS[o.k].heroes, otherHero = H[0] === G.hero ? H[1] : H[0];
      const mate = { slot: -1, ally: a, hero: otherHero, pos: a.group.position, yaw: a.group.rotation.y, packed: false, name: a.name || 'ALLY', group: a.group };
      const { a: A, b: B } = partFor(o.k, me, mate);
      const s = setupFor(o.k, A, B);
      if (s) return { ...s, mate, solo: true };
    }
  }
  return null;
}

/* ---------------- THE PRESS ---------------- */
export function teamupPress(){
  if (!allowed() || teamupBusy()) return false;
  const now = performance.now(), c = T.cand;
  // a partner already offered: answer them, even if this screen's own setup check differs
  const ask = readyFrom();
  if (G.gt < T.cdUntil){ if (c || ask) floater(playerPos(), 'TEAM-UP IN ' + Math.ceil(T.cdUntil - G.gt) + 'S', '#9fb4c8'); return !!(c || ask); }
  if (ask){
    const o = { t: 'tu', k: ask.k, p: ask.slot, n: ask.n, x: ask.x, y: ask.y, z: ask.z, h: G.hero };
    T.offer = { ...o, at: now }; offerOut(o); return true;
  }
  if (!c) return false;
  if (c.solo){ goSolo(c); return true; }
  const o = { t: 'tu', k: c.k, p: c.mate.slot, n: c.n, x: c.x, y: c.y, z: c.z, h: G.hero };
  T.offer = { ...o, at: now };
  offerOut(o);
  sfx(880, 0.08, 'triangle', 0.05, 1320);
  bark(player.group, TEAMUPS[c.k].says[TEAMUPS[c.k].heroes[0] === G.hero ? 0 : 1]);
  return true;
}
function offerOut(o){
  if (net.role === 'host') referee(mySlot(), o);
  send(o);   // (the host passes a guest's on to the others: they light their prompt)
}
// a partner who has offered this hero a team-up, fresh, and still in reach
function readyFrom(){
  const now = performance.now(), me = playerPos();
  for (const [slot, o] of T.heard){
    if (o.p !== mySlot() || now - o.at > TEAMUP.window * 1000) continue;
    const P = partnerStand().find(q => q.slot === slot);
    if (!P || flat(P.pos, me) > TEAMUPS[o.k].gap * 1.25) continue;
    if (!(PAIRS[pairKey(G.hero, P.hero)] || []).includes(o.k)) continue;
    if (TEAMUPS[o.k].pack && G.hero === 'mando' && !meNow().packed) continue;   // (the drop needs this Mando's jetpack)
    return { ...o, slot, name: P.name };
  }
  return null;
}

on('tu', (m) => {
  const from = m.from || 0;
  if (!TEAMUPS[m.k]) return;
  T.heard.set(from, { k: m.k, p: m.p, n: m.n, x: +m.x || 0, y: +m.y || 0, z: +m.z || 0, h: m.h, at: performance.now() });
  if (net.role === 'host') referee(from, m);
});
// THE REFEREE (the host): two offers for each other, for the same move, close enough together, make a GO
function referee(slot, m){
  const now = performance.now();
  T.offers.set(slot, { k: m.k, p: m.p, n: m.n, x: +m.x || 0, y: +m.y || 0, z: +m.z || 0, h: m.h || null, at: now });
  const mine = T.offers.get(slot), theirs = T.offers.get(m.p);
  if (!theirs || theirs.p !== slot || theirs.k !== mine.k || now - theirs.at > TEAMUP.window * 1000) return;
  T.offers.delete(slot); T.offers.delete(m.p);
  const D = TEAMUPS[mine.k], hs = { [slot]: mine.h, [m.p]: theirs.h };
  let a = slot, b = m.p;
  if (D.heroes[0] === D.heroes[1] ? b < a : hs[b] === D.heroes[0]){ a = m.p; b = slot; }
  // the target: the first offer's, if it's still standing (a shared fight), else the second's
  const first = theirs.at <= mine.at ? theirs : mine, second = first === mine ? theirs : mine;
  const pick = first.n == null || alive(byNid(first.n)) || !sharedFight() ? first : second;
  if (pick.n != null && sharedFight() && !alive(byNid(pick.n))) return;
  const go = { t: 'tug', k: mine.k, a, b, n: pick.n, x: pick.x, y: pick.y, z: pick.z };
  send(go);
  start(go);
}
on('tug', (m) => { if (net.role !== 'host' && TEAMUPS[m.k]) start(m); });

/* ---------------- THE MOVE ---------------- */
function goSolo(c){
  const me = meNow(), { a, b } = partFor(c.k, me, c.mate);
  start({ k: c.k, a: a.me ? 0 : -1, b: b.me ? 0 : -1, n: c.n, x: c.x, y: c.y, z: c.z, ally: c.mate.ally, solo: true });
  bark(player.group, TEAMUPS[c.k].says[a.me ? 0 : 1]);
  bark(c.mate.ally.group, TEAMUPS[c.k].says[a.me ? 1 : 0]);
}

// where a part's hero stands (and its body, for the effects), on this screen
function partOf(run, slot){
  if (slot === -1) return run.m.ally ? { pos: run.m.ally.group.position, group: run.m.ally.group, ally: run.m.ally } : null;
  if (slot === (run.m.solo ? 0 : mySlot())) return { pos: playerPos(), group: player.group, me: true };
  const P = partnerStand().find(q => q.slot === slot);
  return P ? { pos: P.pos, group: P.group } : null;
}

function start(m){
  const D = TEAMUPS[m.k];
  const me = m.solo ? 0 : mySlot();
  const role = m.a === me ? 'a' : m.b === me ? 'b' : null;
  T.heard.delete(m.a); T.heard.delete(m.b);
  if (role){
    T.busyUntil = G.gt + D.dur; T.cdUntil = G.gt + (m.solo ? TEAMUP.soloCd : TEAMUP.cd); T.offer = null; T.done++;
    player.teamFace = Math.atan2(m.x - playerPos().x, m.z - playerPos().z);
  }
  const shared_ = sharedFight() || !coop();
  const run = { k: m.k, D, m, t: 0, role, own: owns(role), fired: {}, fx: [], mul: m.solo ? TEAMUP.soloMul : 1,
                at: V3(m.x, m.y || 0, m.z), seats: [m.a, m.b] };
  run.target = m.n == null ? null : shared_ ? byNid(m.n) : nearestTo(run.at, 5);
  T.runs.push(run);
  // every screen: the name, the beat, the tether between the two
  const pa = partOf(run, m.a), pb = partOf(run, m.b);
  if (role) showBanner('TEAM-UP', D.name, 1.4, { kicker: m.solo ? 'WITH ' + (m.ally && m.ally.name || 'YOUR ALLY') : 'WITH ' + nameOf(role === 'a' ? m.b : m.a) });
  else if (pa) floater(pa.pos.clone().setY(pa.pos.y + 2.4), 'TEAM-UP · ' + D.name, '#ffd24a');
  run.tether = tether(m.solo ? 0x7fd0ff : SEAT_COLORS[m.a] ?? 0xffd24a, SEAT_COLORS[m.b] ?? 0x5ac8ff);
  G.slowmo = Math.min(G.slowmo, 0.75); G.slowmoT = Math.max(G.slowmoT, 0.12);
  sfx(660, 0.12, 'triangle', 0.06, 990); setTimeout(() => sfx(990, 0.16, 'triangle', 0.05, 1480), 90);
  if (MOVES[m.k].start) MOVES[m.k].start(run, pa, pb);
}
const nearestTo = (p, r) => { let best = null, bd = r; for (const e of foes()){ const d = flat(e.group.position, p); if (d < bd){ bd = d; best = e; } } return best; };

/* landing a blow from a team-up (the owner of the foes only): a boss takes a capped share, a raid boss's sunder bar a chunk */
function hit(run, e, dmg, dir, knock, opts){
  if (!alive(e) && e !== shared.boss) return;
  dmg *= run.mul * (player.up.dmg || 1);   // (grows with the hero's damage upgrades, as the rocket and the powers do)
  e.teamCd = Math.max(e.teamCd || 0, G.gt + 1);   // (the team strike doesn't stack on a team-up: game/teamstrike.js)
  if (e === shared.boss){ if (e.hp > 0){ damageBoss(Math.min(dmg, e.maxHp * TEAMUP.boss.cap)); if (opts && opts.stagger) bossStagger(); } return; }
  if (e.fin){ teamupSunder(e, TEAMUP.boss.sunder * run.mul); dmg = Math.min(dmg, e.maxHp * TEAMUP.boss.cap); }
  else if (e.champion || e.warbringer) dmg = Math.min(dmg, e.maxHp * TEAMUP.boss.cap * 2.5);
  damageEnemy(e, dmg, dir || null, knock || 0, !!(opts && opts.fin), false, opts && opts.slide ? { slide: true } : undefined);
}
const away = (from, e) => { const q = e.group.position, dx = q.x - from.x, dz = q.z - from.z, l = Math.hypot(dx, dz) || 1; return V3(dx / l, 0, dz / l); };

// a beat of the move at time `at` (s from the go), once
const once = (run, key, at, fn) => { if (run.t >= at && !run.fired[key]){ run.fired[key] = true; fn(); } };

const MOVES = {
  /* LIFT & LAUNCH — up it goes in the Force, and the rocket meets it in the air */
  lift: {
    start(run, pa){
      if (run.role === 'a'){ castGesture('pull', run.D.hit); }
      if (run.role === 'b'){ player.aiming = run.D.dur; }
      if (run.own && run.target && run.target !== shared.boss){ const e = run.target; e.state = 'stasis'; e.st = run.D.dur + 0.6; e.vel.set(0, 0, 0); run.y0 = e.group.position.y; }
    },
    step(run, dt, pa, pb){
      const e = run.target, D = run.D;
      if (e && alive(e)){
        const q = e.group.position;
        if (run.own && run.t < D.hit && e !== shared.boss){ e.state = 'stasis'; q.y = Math.min(run.y0 + D.rise, q.y + D.rise * 2.2 * dt); e.group.rotation.x = Math.sin(run.t * 9) * 0.15; }
        if (Math.random() < 0.6) motes(q.clone().setY(q.y + 1.2), 0x8fd8ff, 2, 0.8, { life: 0.4 });
      }
      once(run, 'fire', D.hit - 0.45, () => {
        if (!pb) return;
        const from = pb.pos.clone().setY(pb.pos.y + 1.5);
        if (run.role === 'b'){ player.recoil = 0.35; G.shake = Math.max(G.shake, 0.3); }
        S.rocket();
        run.rocket = projectile(from, 0.1, 0xb8c2cc);
      });
      if (run.rocket){ const to = e && alive(e) ? e.group.position.clone().setY(e.group.position.y + 1.2) : run.at.clone().setY(2.5); fly(run.rocket, to, (run.t - (D.hit - 0.45)) / 0.45); }
      once(run, 'hit', D.hit, () => {
        dropProjectile(run.rocket); run.rocket = null;
        const p = e && (alive(e) || e === shared.boss) ? e.group.position.clone().setY(e.group.position.y + 1.2) : run.at.clone().setY(2);
        explosion(p, D.splash, true); S.boom(p, 1.6); G.shake = Math.max(G.shake, 1.2); G.hitstop = Math.max(G.hitstop, 0.1);
        G.slowmo = Math.min(G.slowmo, TEAMUP.slowmo); G.slowmoT = Math.max(G.slowmoT, TEAMUP.slowT);
        floater(p, 'LIFT & LAUNCH', '#ffd24a');
        if (!run.own) return;
        if (e && alive(e)){ e.state = 'ragdoll'; e.st = 0; e.vel.set(0, 9, 0); hit(run, e, D.dmg, V3(0, 0, 0).add(away(pa ? pa.pos : p, e)), D.knock); if (!e.dead && e !== shared.boss){ e.state = 'ragdoll'; e.vel.y = Math.max(e.vel.y, 8); } }
        for (const o of foes()) if (o !== e && !bossy(o) && o.group.position.distanceTo(p) < D.splash + 1) hit(run, o, D.splashDmg, away(p, o), D.knock * 0.6);
      });
    },
  },

  /* JETPACK DROP — the Mando hauls the Jedi up and drops them into the crowd: a plunging Force slam where they land */
  carry: {
    start(run, pa, pb){
      const D = run.D;
      if (run.role){
        const s = playerPos().clone(), dir = V3(run.at.x - s.x, 0, run.at.z - s.z); const L = dir.length() || 1; dir.divideScalar(L);
        // the Jedi's arc ends on the crowd; the Mando's peels off short of it and sets down
        const end = run.role === 'b' ? run.at.clone() : V3(run.at.x - dir.x * 4.5, run.at.y, run.at.z - dir.z * 4.5);
        T.fly = { s, end, h: D.height + (run.role === 'a' ? 1.1 : 0), dur: D.hit, t: 0, jet: run.role === 'a' };
        if (run.role === 'a'){ player.aiming = 0; S.jetIgnite(); }
        else castGesture('push', 0.3);
      }
      groundRing(V3(run.at.x, 0.1, run.at.z), 0xffd24a, 5.5, D.hit, 0.8);
    },
    step(run, dt, pa, pb){
      const D = run.D;
      if (pa && Math.random() < 0.8) puff(pa.pos.clone().setY(pa.pos.y + 0.9), 0xffb04a, 0.25, 0.25, V3(0, -4, 0), { op: 0.8 });
      once(run, 'slam', D.hit, () => {
        const p = V3(run.at.x, 0.1, run.at.z);
        spawnGroundShock(p, 0x8fd8ff, D.radius + 2, 0.6, 0.9); explosion(V3(p.x, 0.6, p.z), D.radius * 0.6, false);
        S.slam(p); S.boom(p, 1.3); G.shake = Math.max(G.shake, 1.4); G.hitstop = Math.max(G.hitstop, 0.1);
        G.slowmo = Math.min(G.slowmo, TEAMUP.slowmo); G.slowmoT = Math.max(G.slowmoT, TEAMUP.slowT);
        floater(V3(p.x, 2, p.z), 'JETPACK DROP', '#ffd24a');
        if (!run.own) return;
        for (const e of foes()){
          const d = flat(e.group.position, p);
          if (d > D.radius) continue;
          hit(run, e, D.dmg * (1 - d / D.radius * 0.4), away(p, e), D.knock);
          if (!e.dead && !tough(e)){ e.state = 'knockdown'; e.st = 1.2; e.vel.set(away(p, e).x * 7, 6, away(p, e).z * 7); }
        }
      });
    },
  },

  /* PIN & FINISH — the trooper's fire pins a blade foe where it stands; the Jedi closes and finishes it */
  pin: {
    start(run){
      const e = run.target, D = run.D;
      if (run.role === 'a') player.aiming = D.dur;
      if (run.own && e && alive(e)){
        e.suppT = Math.max(e.suppT || 0, G.gt + D.pinT); e.fear = 0.35; e.fearAt = G.gt;
        staggerEnemy(e, 0, 0, 'PINNED'); e.st = Math.max(e.st || 0, D.pinT); e.stumble = 0;
        hit(run, e, D.dmg, V3(0, 0, 0), 0);
        if (!e.dead){ e.state = 'stagger'; e.st = Math.max(e.st || 0, D.pinT); }
      }
    },
    step(run, dt, pa, pb){
      const e = run.target, D = run.D;
      if (pa && e && alive(e) && run.t < D.hit + 0.3 && Math.random() < 0.45){
        const from = pa.pos.clone().setY(pa.pos.y + 1.4), to = e.group.position.clone().setY(e.group.position.y + 1.1 + (Math.random() - 0.5) * 0.6);
        tracer(from, to, run.m.solo ? 0x6fd0ff : 0x7fc0ff); if (Math.random() < 0.4) S.blaster();
      }
      // the Jedi: in for the kill (a guest's finisher reaches the host as its own blows: net/run.js)
      once(run, 'fin', D.hit, () => {
        if (run.role !== 'b' || !e || !alive(e)) return;
        const pp = playerPos(), q = e.group.position, d = flat(pp, q), r = bodyRadius(e);
        if (d > r + 1.0){ const k = (d - r - 0.9) / d; pp.x += (q.x - pp.x) * k; pp.z += (q.z - pp.z) * k; burst(pp.clone().setY(1), 0x8fd8ff, 10, 6, 3); }
        player.teamFace = player.faceYaw = Math.atan2(q.x - pp.x, q.z - pp.z); player.group.rotation.y = player.faceYaw;
        if (e.state !== 'stagger' && !e.net){ e.state = 'stagger'; e.st = Math.max(e.st || 0, 1); }
        if (!tryFinisher(e)) damageEnemy(e, D.dmg * 3 * run.mul, away(pp, e), 10, true);
        floater(q.clone().setY(q.y + 2.2), 'PIN & FINISH', '#ffd24a');
      });
    },
  },

  /* SHIELD DOME — the Jedi throws a barrier up over the trooper and the squad: every enemy bolt dies on it */
  barrier: {
    start(run){ if (run.role === 'a') castGesture('push', 0.45); if (run.role === 'b') player.aiming = 0.4; },
    step(run, dt, pa){
      const D = run.D;
      once(run, 'dome', D.hit, () => {
        addTeamDome(run.at.x, run.at.z, D.radius, D.life);
        groundRing(V3(run.at.x, 0.1, run.at.z), 0x7fd0ff, D.radius, 0.5, 1);
        if (pa) sparks(pa.pos.clone().setY(pa.pos.y + 1.4), 0x9fe0ff, 14, 10, { life: 0.3 });
        S.barrier(); S.push(pa ? pa.pos : run.at); G.shake = Math.max(G.shake, 0.5);
        screenFlash('radial-gradient(ellipse at center, rgba(120,210,255,.25), transparent 60%)', 0.45, 0.35);
        floater(V3(run.at.x, 2.5, run.at.z), 'SHIELD DOME', '#9fe0ff');
        if (!run.own) return;
        for (const e of foes()){   // (whatever stood inside is shoved out to the rim)
          const d = flat(e.group.position, run.at);
          if (d < D.radius && !bossy(e)){ const a = away(run.at, e); if (tough(e)) flinchEnemy(e, a, 0.8); else { e.state = 'knockdown'; e.st = 0.8; e.vel.set(a.x * 9, 4, a.z * 9); } }
        }
      });
    },
  },

  /* MARKED VOLLEY — the trooper marks up to four, the Mando's micro-rockets take every mark at once */
  mark: {
    start(run, pa){
      const D = run.D, seed = run.target;
      run.marks = marksAround(foes(), seed && alive(seed) ? seed.group.position : run.at, D);
      if (run.role) player.aiming = D.dur;
      for (const e of run.marks){ const q = e.group.position; groundRing(V3(q.x, 0.1, q.z), 0xff5a4a, 1.4, 0.9, 1); floater(q.clone().setY(q.y + 2.4), 'MARKED', '#ff8a7a'); }
      sfx(1400, 0.06, 'square', 0.03, 1700);
    },
    step(run, dt, pa, pb){
      const D = run.D, launch = D.hit - 0.5;
      once(run, 'fire', launch, () => {
        if (!pb) return;
        if (run.role === 'b'){ player.recoil = 0.3; G.shake = Math.max(G.shake, 0.25); }
        if (pb.ally){ run.volley = true; return; }   // solo, a squadmate's part: a volley of bolts, not rockets
        S.rocket();
        run.birds = run.marks.map((e, i) => ({ e, p: projectile(pb.pos.clone().setY(pb.pos.y + 1.9), 0.06, 0xd8e0e8), side: i % 2 ? 1 : -1, from: pb.pos.clone().setY(pb.pos.y + 1.9) }));
      });
      for (const b of run.birds || []){
        const k = clamp((run.t - launch) / 0.5, 0, 1), to = alive(b.e) || b.e === shared.boss ? b.e.group.position.clone().setY(b.e.group.position.y + 1.2) : b.p.position;
        const mid = b.from.clone().lerp(to, 0.5).add(V3(b.side * 2, 3, 0));
        b.p.position.copy(b.from).multiplyScalar((1 - k) * (1 - k)).addScaledVector(mid, 2 * k * (1 - k)).addScaledVector(to, k * k);
        if (Math.random() < 0.5) puff(b.p.position.clone(), 0x9a958f, 0.12, 0.25, V3(0, 0.5, 0), { op: 0.6 });
      }
      if (run.volley && pb && run.t < D.hit + 0.2 && Math.random() < 0.6){
        const e = run.marks[(Math.random() * run.marks.length) | 0];
        if (e && (alive(e) || e === shared.boss)){ tracer(pb.pos.clone().setY(pb.pos.y + 1.4), e.group.position.clone().setY(e.group.position.y + 1.2), 0x6fd0ff); S.blaster(); }
      }
      once(run, 'hit', D.hit, () => {
        for (const b of run.birds || []){ const p = b.p.position.clone(); dropProjectile(b.p); explosion(p, 1.6, false); burst(p, 0xffb04a, 6, 6, 3); }
        S.boom(run.at, 1.0); G.shake = Math.max(G.shake, 0.8);
        G.slowmo = Math.min(G.slowmo, TEAMUP.slowmo); G.slowmoT = Math.max(G.slowmoT, TEAMUP.slowT * 0.7);
        if (run.own) for (const e of run.marks) hit(run, e, D.dmg, away(pb ? pb.pos : run.at, e), 8);
        run.birds = null;
      });
    },
  },

  /* FIRE SWEEP — the trooper's frag flushes the crowd, the Mando's flamer sweeps it */
  sweep: {
    start(run, pa){
      const D = run.D;
      if (run.role) player.aiming = D.dur;
      if (pa){ run.frag = projectile(pa.pos.clone().setY(pa.pos.y + 1.6), 0.12, 0x56605a); run.fragFrom = pa.pos.clone().setY(pa.pos.y + 1.6); S.jump(); }
      groundRing(V3(run.at.x, 0.1, run.at.z), 0xff8a3a, D.radius, D.hit, 0.8);
    },
    step(run, dt, pa, pb){
      const D = run.D;
      if (run.frag){ const k = clamp(run.t / D.hit, 0, 1), to = V3(run.at.x, 0.3, run.at.z); run.frag.position.copy(run.fragFrom).lerp(to, k); run.frag.position.y += Math.sin(k * Math.PI) * 4; }
      once(run, 'boom', D.hit, () => {
        dropProjectile(run.frag); run.frag = null;
        const p = V3(run.at.x, 0.5, run.at.z);
        explosion(p, D.radius * 0.7, false); S.boom(p, 1.2); G.shake = Math.max(G.shake, 0.9);
        floater(V3(p.x, 2.2, p.z), 'FIRE SWEEP', '#ffb04a');
        if (run.own) for (const e of foes()){ const d = flat(e.group.position, p); if (d < D.radius) hit(run, e, D.dmg * (1 - d / D.radius * 0.4), away(p, e), D.knock); }
      });
      // the flame, from the Mando across the crowd
      if (run.t > D.hit && run.t < D.hit + D.burn && pb && pb.ally){   // solo, a squadmate's part: fire into the smoke
        if (Math.random() < 0.5) tracer(pb.pos.clone().setY(pb.pos.y + 1.4), V3(run.at.x + (Math.random() - 0.5) * D.radius, 1, run.at.z + (Math.random() - 0.5) * D.radius), 0x6fd0ff);
      } else if (run.t > D.hit && run.t < D.hit + D.burn && pb){
        const from = pb.pos.clone().setY(pb.pos.y + 1.3), to = V3(run.at.x, 0.8, run.at.z), sw = Math.sin((run.t - D.hit) / D.burn * Math.PI * 2) * 2.5;
        const side = V3(-(to.z - from.z), 0, to.x - from.x).normalize();
        for (let i = 0; i < 3; i++){ const k = Math.random(); burst(from.clone().lerp(to.clone().addScaledVector(side, sw), k), k < 0.5 ? 0xffd34a : 0xff7a2a, 1, 3, 2, 0.9); }
      }
      if (run.own && run.t > D.hit && run.t < D.hit + D.burn){
        const tick = D.burnDmg * dt / D.burn * run.mul * (player.up.dmg || 1);
        for (const e of foes()) if (!bossy(e) && flat(e.group.position, run.at) < D.radius && alive(e)) damageEnemy(e, tick, null, 0, false, true);
      }
    },
  },

  /* TWIN PUSH — two pushes as one wave: it floors anything in front, and even the big ones reel */
  push: {
    start(run){ if (run.role) castGesture('push', run.D.hit + 0.2); },
    step(run, dt, pa, pb){
      const D = run.D;
      once(run, 'wave', D.hit, () => {
        const mid = pa && pb ? V3((pa.pos.x + pb.pos.x) / 2, 0, (pa.pos.z + pb.pos.z) / 2) : (pa || pb) ? (pa || pb).pos.clone() : run.at.clone();
        const dir = V3(run.at.x - mid.x, 0, run.at.z - mid.z).normalize();
        for (const q of [pa, pb]) if (q){ const p = q.pos.clone().setY(q.pos.y + 1.3); sparks(p, 0x8fd8ff, 14, 14, { dir, cone: 0.5, life: 0.35, grav: 0, stretch: 4 }); }
        spawnGroundShock(mid.clone().addScaledVector(dir, 3).setY(0.1), 0x8fd8ff, D.range * 0.6, 0.45, 0.8);
        S.push(mid); S.repulse(mid, true); G.shake = Math.max(G.shake, 1.0); G.hitstop = Math.max(G.hitstop, 0.08);
        G.slowmo = Math.min(G.slowmo, TEAMUP.slowmo); G.slowmoT = Math.max(G.slowmoT, TEAMUP.slowT);
        floater(mid.clone().setY(2.4), 'TWIN PUSH', '#bfe8ff');
        if (!run.own) return;
        for (const e of foes()){
          const q = e.group.position, dx = q.x - mid.x, dz = q.z - mid.z, d = Math.hypot(dx, dz);
          if (d > D.range || (d > 1 && (dx * dir.x + dz * dir.z) / d < D.cone)) continue;
          const kd = V3(dx / (d || 1), 0, dz / (d || 1));
          hit(run, e, D.dmg * (1 - d / D.range * 0.5), kd, D.knock * (1 - d / D.range * 0.4), { stagger: true });
          if (e.dead || e === shared.boss) continue;
          if (tough(e)) staggerEnemy(e, kd.x, kd.z, 'REELING');
          else { e.state = 'ragdoll'; e.st = 0; e.vel.set(kd.x * D.knock, 5, kd.z * D.knock); }
        }
      });
    },
  },

  /* BACK TO BACK — a cut all round from the two of them, then each one covers the other's back (player/damage.js reads
     player.backT: a melee blow from behind is turned by your partner) */
  backs: {
    start(run){
      if (run.role){ castGesture('push', 0.3); player.backT = G.gt + run.D.guard; }
    },
    step(run, dt, pa, pb){
      const D = run.D;
      once(run, 'ring', D.hit, () => {
        const mid = pa && pb ? V3((pa.pos.x + pb.pos.x) / 2, 0, (pa.pos.z + pb.pos.z) / 2) : run.at.clone();
        spawnGroundShock(mid.clone().setY(0.1), 0xbfe8ff, D.cut + 1, 0.4, 0.9);
        groundRing(mid.clone().setY(0.1), 0xffd24a, D.cut, 0.5, 1);
        S.swing('strong'); G.shake = Math.max(G.shake, 0.6); G.hitstop = Math.max(G.hitstop, 0.06);
        floater(mid.clone().setY(2.4), 'BACK TO BACK', '#bfe8ff');
        if (!run.own) return;
        for (const e of foes()){ const d = flat(e.group.position, mid); if (d < D.cut) hit(run, e, D.dmg, away(mid, e), D.knock, { stagger: true }); }
      });
    },
  },
};

/* ---------------- every frame ---------------- */
// before the hero's own update (main.js): the moves play, the prompt shows. dt: the game's (slowed) step
export function updateTeamups(dt){
  if (G.mode !== 'play'){ if (T.runs.length) resetTeamups(); prompt(null); return; }
  updateTeamDomes(dt, G.gt);
  for (let i = T.runs.length - 1; i >= 0; i--){
    const run = T.runs[i];
    run.t += dt;
    const pa = partOf(run, run.m.a), pb = partOf(run, run.m.b);
    if (MOVES[run.k].step) MOVES[run.k].step(run, dt, pa, pb);
    if (run.m.ally && run.m.ally.group){ const g = run.m.ally.group; g.rotation.y = Math.atan2(run.at.x - g.position.x, run.at.z - g.position.z); }
    stepTether(run.tether, pa, pb, run.t, run.D.dur);
    if (run.t >= run.D.dur + 0.1){ dropTether(run.tether); for (const p of run.fx) dropProjectile(p); T.runs.splice(i, 1); }
  }
  if (!teamupBusy()){ player.teamFace = null; }
  else player.moveVel.multiplyScalar(0.5);   // planted: the move is the commitment
  // the prompt: a few times a second, not every frame
  if ((T.checkT -= dt) <= 0){
    T.checkT = TEAMUP.check;
    T.cand = allowed() && !teamupBusy() ? findCandidate() : null;
  }
  const ready = allowed() && !teamupBusy() ? readyFrom() : null;
  const waiting = T.offer && performance.now() - T.offer.at < TEAMUP.window * 1000 ? T.offer : (T.offer = null);
  prompt(teamupBusy() ? null : ready ? { kind: 'ready', k: ready.k, name: ready.name } : waiting ? { kind: 'wait', k: waiting.k, name: nameOf(waiting.p) }
    : T.cand ? { kind: G.gt < T.cdUntil ? 'cd' : 'go', k: T.cand.k, name: T.cand.mate.name, solo: !!T.cand.solo } : null);
}

// after the hero's own update: a scripted flight (JETPACK DROP) puts the body where the arc says
export function updateTeamupFlight(dt){
  const F = T.fly;
  if (!F) return;
  if (G.mode !== 'play'){ T.fly = null; return; }
  F.t += dt;
  const k = clamp(F.t / F.dur, 0, 1), pp = playerPos();
  const x = F.s.x + (F.end.x - F.s.x) * k, z = F.s.z + (F.end.z - F.s.z) * k;
  const y = F.s.y + (F.end.y - F.s.y) * k + F.h * 4 * k * (1 - k);
  pp.set(x, Math.max(0, y), z);
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; player.grounded = false;
  if (F.jet && Math.random() < 0.8) puff(pp.clone().setY(pp.y + 0.7), 0xffb04a, 0.22, 0.25, V3(0, -5, 0), { op: 0.8 });
  if (k >= 1){ player.vy = -8; T.fly = null; }
}

export function resetTeamups(){
  for (const run of T.runs){ dropTether(run.tether); dropProjectile(run.rocket); dropProjectile(run.frag); for (const b of run.birds || []) dropProjectile(b.p); }
  T.runs.length = 0; T.fly = null; T.busyUntil = -1e9; T.cdUntil = -1e9; T.offer = null; T.heard.clear(); T.offers.clear(); T.cand = null;
  player.teamFace = null; player.backT = 0;
  clearTeamDomes();
}
on('closed', () => { T.heard.clear(); T.offers.clear(); T.offer = null; });

/* ---------------- THE PROMPT (under the crosshair) ---------------- */
function prompt(p){
  const key = p ? p.kind + p.k + p.name + (p.kind === 'cd' ? Math.ceil(T.cdUntil - G.gt) : '') : '';
  if (key === T.shown && !(p && pad.active !== T.padShown)) return;
  T.shown = key; T.padShown = pad.active;
  if (!T.el){ T.el = document.createElement('div'); T.el.id = 'teamupp'; document.getElementById('hud').appendChild(T.el); }
  if (!p){ T.el.className = ''; return; }
  const K = pad.active ? padKeys(TEAMUP.key.toUpperCase()) : TEAMUP.key.toUpperCase(), name = TEAMUPS[p.k].name, who = esc(p.name || '');
  T.el.innerHTML = p.kind === 'ready' ? '<kbd>' + K + '</kbd><span><b>' + who + '</b> IS READY · ' + name + '</span>'
    : p.kind === 'wait' ? '<span>' + name + ' · WAITING FOR <b>' + who + '</b></span>'
    : p.kind === 'cd' ? '<span>TEAM-UP · ' + name + ' · ' + Math.ceil(T.cdUntil - G.gt) + 'S</span>'
    : '<kbd>' + K + '</kbd><span>TEAM-UP · <b>' + name + '</b>' + (who ? ' · ' + who : '') + '</span>';
  T.el.className = 'on ' + p.kind;
}
// a prompt you can answer is up (a pad's D-pad down answers it instead of its own bind: engine/gamepad.js)
shared.teamupUp = () => !!(T.el && / (go|ready)$/.test(T.el.className));
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ---------------- the pieces the moves are drawn with ---------------- */
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function tether(c1, c2){
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  geo.setAttribute('color', new THREE.Float32BufferAttribute([...new THREE.Color(c1).toArray(), ...new THREE.Color(c2).toArray()], 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  line.frustumCulled = false; line.renderOrder = 7;
  scene.add(line);
  return line;
}
function stepTether(line, pa, pb, t, dur){
  if (!line) return;
  line.visible = !!(pa && pb);
  if (!line.visible) return;
  _a.copy(pa.pos).setY(pa.pos.y + 1.3); _b.copy(pb.pos).setY(pb.pos.y + 1.3);
  const at = line.geometry.attributes.position;
  at.setXYZ(0, _a.x, _a.y, _a.z); at.setXYZ(1, _b.x, _b.y, _b.z); at.needsUpdate = true;
  line.material.opacity = 0.9 * clamp((dur - t) / 0.3, 0, 1) * (0.7 + Math.sin(t * 30) * 0.3);
}
function dropTether(line){ if (!line) return; scene.remove(line); line.geometry.dispose(); line.material.dispose(); }

function projectile(from, r, color){
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, r * 3.5, 4, 6), new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4, emissive: 0xff8a2a, emissiveIntensity: 0.3 }));
  m.position.copy(from);
  scene.add(m);
  return m;
}
function fly(m, to, k){
  if (!m) return;
  k = clamp(k, 0, 1);
  const from = m.userData.from || (m.userData.from = m.position.clone());
  const was = m.position.clone();
  m.position.copy(from).lerp(to, k * k);
  const d = m.position.clone().sub(was); if (d.lengthSq() > 1e-6) m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  if (Math.random() < 0.8) puff(m.position.clone(), 0x8a8580, 0.18, 0.3, V3(0, 0.6, 0), { op: 0.7 });
}
function dropProjectile(m){ if (!m) return; scene.remove(m); m.geometry.dispose(); m.material.dispose(); }

const tracers = [];
function tracer(from, to, color){
  const d = to.clone().sub(from), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, L, 4, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  m.position.copy(from).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  scene.add(m); tracers.push({ m, t: 0 });
  sparks(to, color, 3, 4, { life: 0.15 });
  if (tracers.length > 24) killTracer(0);
}
function killTracer(i){ const o = tracers[i]; scene.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); tracers.splice(i, 1); }
export function updateTeamupFx(dt){
  for (let i = tracers.length - 1; i >= 0; i--){ const o = tracers[i]; o.t += dt; o.m.material.opacity = Math.max(0, 0.9 - o.t * 9); if (o.t > 0.1) killTracer(i); }
}

/* ---------------- for the smoke tests ---------------- */
export const teamupInfo = () => ({ cand: T.cand ? { k: T.cand.k, mate: T.cand.mate.slot, solo: !!T.cand.solo } : null, busy: teamupBusy(), cd: Math.max(0, T.cdUntil - G.gt),
  runs: T.runs.map(r => ({ k: r.k, t: +r.t.toFixed(2), role: r.role, own: r.own })), done: T.done, offer: T.offer ? T.offer.k : null,
  ready: (() => { const r = readyFrom(); return r ? r.k : null; })(), prompt: T.el ? T.el.className : '' });
