// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL MODE (the duel plan's steps 2 and 3): a match between two players, Jedi against Jedi, in the training wing's ring
// in the temple on Tython, or in the sandbox's practice ring (against a friend there, or a mirror duellist on your own).
//
// THE CHALLENGE: walk up to a friend (or pick them at the DUEL RING station), pick the rule, and they get a card to accept.
// THE MATCH: both step onto their marks with the hilts on the belt; a count of three; the blades come out and it's on.
//   CLEAN HITS (the default) first to 3 clean saber hits takes the round · HEALTH a full bar each · TIMED 90 s, most clean
//   hits. Best of 3 rounds. Then a score card with a straight REMATCH, and the win goes in the trophy hall (DUEL HONOURS).
// LEVELLED: for the match both fighters are put on the same base numbers (data/duel-mode.js FAIRNESS): no upgrades, skill
//   picks, crystal or perks, every power at base, push and pull only, Knight difficulty. Forms and looks stay yours.
// THE REFEREE is the challenger's screen: it keeps the clock and the score from the defenders' verdicts (net/pvp.js) and
//   tells the room ('dst'), so the other fighter and anyone watching (in the same wing: the balcony) see the same match.

import * as THREE from 'three';
import { G, shared, player, enemies } from '../state.js';
import { scene } from '../engine/renderer.js';
import { DUEL_MODE, DUEL_POWERS } from '../data/duel-mode.js';
import { duelHooks } from './duel-hooks.js';
import { playerPos, maxHp, maxStam } from '../player/helpers.js';
import { CFG } from '../data/config.js';
import { worldKey } from '../player/players.js';
import { stowForScene, lightFromBelt, clearUnlit } from '../player/holster.js';
import { cancelSwing } from '../player/jedi/combat.js';
import { freshUp, syncJediChips } from './flow.js';
import { storyReached } from './sandbox-unlocks.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { removeEnemy } from '../enemies/cleanup.js';
import { setFoeForm } from '../enemies/foeform.js';
import { showBanner } from '../ui/banners.js';
import { floater } from '../fx/floaters.js';
import { S, sfx } from '../audio/sfx.js';
import { net, on, send, connected } from '../net/session.js';
import { nameOf, savedName } from '../net/names.js';
import { partnerStand, partnerHero, partnerPuppet } from '../net/partner.js';
import { onVerdict, pvpLinkMs, pvpTick } from '../net/pvp.js';

const D = DUEL_MODE;
const now = () => performance.now();
const seatName = (k) => k === 'mirror' ? 'THE MIRROR' : k === net.slot || k === 'me' ? (savedName() || (connected() ? nameOf(net.slot) : 'YOU')).toUpperCase() : nameOf(k);
export const RULES = D.rules;

/* ---------------- where a duel can be fought ---------------- */
// the temple's training wing (its ring), or the sandbox (its floor): and only as a Jedi, for now
export const duelPlace = () => {
  if (G.mode !== 'play' || G.cutscene || G.hero !== 'jedi') return null;
  const T = D.ring.temple;
  if (G.hub && G.hubId === T.hub && G.hubWing === T.wing) return 'temple';
  if (G.sandbox) return 'sandbox';
  return null;
};
// the friends here you could challenge now: { slot, name, pos, near (walked up to, facing them) }
export function challengeable(){
  if (!duelPlace() || M || !connected()) return [];
  const p = playerPos(), yaw = player.group.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
  return partnerStand().filter(q => partnerHero(q.slot) === 'jedi' && !busy.has(q.slot)).map(q => {
    const dx = q.pos.x - p.x, dz = q.pos.z - p.z, d = Math.hypot(dx, dz);
    return { slot: q.slot, name: q.name, pos: q.pos, d, near: d < D.reach && (d < 1.2 || (dx * fx + dz * fz) / d > 0.3) };
  });
}
const busy = new Set();   // seats fighting a duel of their own right now (heard from their 'dst')

/* ---------------- the match ----------------
   M: this screen's match, as fighter, referee or spectator.
   { id, a, b (seats; 'me' and 'mirror' in a practice), rule, place, ring: { x, z, r }, ph (enter | count | fight | roundEnd |
     over), hits: [a, b], hp: [a, b], rounds: [a, b], round, clock, sudden, win (this round's: 0 | 1 | -1 draw), champ,
     ref (this screen keeps the score), me (0 | 1 as a fighter, -1 watching), lk (the link, ms), pgs, rematch: Set } */
let M = null;
export const duelState = () => M;
let pending = null;      // a challenge this screen sent, waiting on its answer: { id, to, rule, until }
let incoming = null;     // a challenge to this screen, on its card: { id, from, rule, place, pg, until }
let nextId = 1;
let lastBeat = 0, phaseEnds = 0, decideAt = 0, lastSent = 0, lastPing = 0, lostFoeT = 0;
const ui = { card: null, close: null };   // ui/duel-ui.js draws the cards
export function setDuelUi(card, close){ ui.card = card; ui.close = close; }

const ringFor = (place) => {
  if (place === 'temple'){ const T = D.ring.temple; return { x: T.x, z: T.z, r: T.r }; }
  const S0 = D.ring.sandbox; return { x: S0.x, z: S0.z, r: S0.r };
};
const seatIdx = (k) => !M ? -1 : k === M.a ? 0 : k === M.b ? 1 : -1;
const linkOf = (m) => Object.values(m.pgs || {}).reduce((a, b) => a + (+b || 0), 0);

/* ---------------- the challenge ---------------- */
export function challenge(slot, rule = D.defaultRule){
  if (!duelPlace() || M || !connected()) return false;
  pending = { id: net.slot * 1000 + (nextId++ % 1000), to: slot, rule: RULES[rule] ? rule : D.defaultRule, until: now() + D.answerWait * 1000 };
  send({ t: 'dch', to: slot, id: pending.id, rule: pending.rule, place: duelPlace(), pg: pvpLinkMs() });
  showBanner('', 'CHALLENGE SENT TO ' + nameOf(slot), 1.8);
  S.uiHover && S.uiHover();
  return true;
}
on('dch', (m) => {
  if (m.to !== net.slot) return;
  const from = m.from || 0;
  // busy (fighting, another card up, somewhere a duel can't be fought, not a Jedi): turned down on the spot
  if (M || incoming || pending || duelPlace() !== m.place || G.paused || G.skillSelect) return void send({ t: 'dans', to: from, id: m.id, ok: 0, why: 'busy' });
  incoming = { id: m.id, from, rule: RULES[m.rule] ? m.rule : D.defaultRule, place: m.place, pg: +m.pg || 0, until: now() + D.answerWait * 1000 };
  S.reward && S.reward(0);
  if (ui.card) ui.card('incoming', { ...incoming, name: nameOf(from), link: incoming.pg + pvpLinkMs() });
});
export function answer(ok){
  const c = incoming; incoming = null;
  if (!c) return;
  send({ t: 'dans', to: c.from, id: c.id, ok: ok ? 1 : 0, pg: pvpLinkMs() });
  if (ui.close) ui.close();
  if (!ok) return;
  // the challenger referees: wait for their first word ('dst'), which puts this fighter on their mark
  M = { id: c.id, a: c.from, b: net.slot, rule: c.rule, place: c.place, ring: ringFor(c.place), ph: 'wait', hits: [0, 0], hp: [1, 1], rounds: [0, 0], round: 1, clock: 0,
        sudden: false, win: -1, champ: -1, ref: false, me: 1, pvp: true, lk: c.pg + pvpLinkMs(), pgs: {}, rematch: new Set(), seen: now() };
}
on('dans', (m) => {
  if (m.to !== net.slot || !pending || m.id !== pending.id) return;
  const p = pending; pending = null;
  if (!m.ok){ showBanner('', nameOf(p.to) + (m.why === 'busy' ? ' IS BUSY RIGHT NOW' : ' TURNED IT DOWN'), 2); return; }
  if (M || !duelPlace()) return void send({ t: 'dq', id: p.id });
  M = { id: p.id, a: net.slot, b: p.to, rule: p.rule, place: duelPlace(), ring: ringFor(duelPlace()), ph: 'wait', hits: [0, 0], hp: [1, 1], rounds: [0, 0], round: 1,
        clock: 0, sudden: false, win: -1, champ: -1, ref: true, me: 0, pvp: true, lk: 0, pgs: { [net.slot]: pvpLinkMs(), [p.to]: +m.pg || 0 }, rematch: new Set(), seen: now() };
  if (M.place === 'sandbox'){ const pp = playerPos(); M.ring = { x: Math.round(pp.x), z: Math.round(pp.z), r: D.ring.sandbox.r }; }   // (the challenger's sandbox floor: both fight on the same spot)
  M.lk = linkOf(M);
  beginMatch();
});

/* ---------------- practice: the mirror (the sandbox) ---------------- */
export function startPractice(rule = D.defaultRule){
  if (!G.sandbox || G.hero !== 'jedi' || M) return false;
  for (const e of [...enemies]) removeEnemy(e);
  enemies.length = 0;
  const pp = playerPos();
  M = { id: -1, a: 'me', b: 'mirror', rule: RULES[rule] ? rule : D.defaultRule, place: 'sandbox', ring: { x: Math.round(pp.x), z: Math.round(pp.z), r: D.ring.sandbox.r }, ph: 'wait',
        hits: [0, 0], hp: [1, 1], rounds: [0, 0], round: 1, clock: 0, sudden: false, win: -1, champ: -1, ref: true, me: 0, pvp: false, lk: 0, pgs: {}, rematch: new Set(), seen: now() };
  beginMatch();
  return true;
}
let mirror = null;
function spawnMirror(){
  dropMirror();
  const R = M.ring, at = new THREE.Vector3(R.x + D.ring.marks, 0, R.z);
  const e = spawnEnemy(D.mirror.type, at) || enemies[enemies.length - 1];
  if (!e) return;
  e.duelMirror = true;
  e.home = { x: at.x, z: at.z }; e.aiHold = true;   // it stands its mark until the FIGHT lets it loose (updateDuel)
  setFoeForm(e, G.stance, D.mirror.rank);   // a mirror: it fights in the form you hold
  e.maxHp = e.hp = Math.max(e.hp, maxHp());
  // its blows are scored by the match, not its health: a clean saber cut on it is a point; in HEALTH rules it can't die,
  // its bar runs down to a sliver and the round is decided there
  e.dmgRule = (e2, dmg, tick, opts) => {
    if (!M || M.ph !== 'fight') return 0;
    const fresh = opts && opts.blade && !tick && player.swing && !player.swing.duelScored;   // (one point a cut, Jar'Kai's second blade included)
    if (fresh) player.swing.duelScored = true;
    if (M.rule !== 'health'){ if (fresh) scorePoint(0, 1); return 0; }
    const d = Math.min(dmg, Math.max(0, e2.hp - 1));
    M.hp[1] = Math.max(0, (e2.hp - d - 1) / (e2.maxHp - 1));
    if (fresh) M.hits[0]++;
    if (M.hp[1] <= 0.001) roundDecided();
    return d;
  };
  mirror = e;
}
function dropMirror(){ if (mirror){ const i = enemies.indexOf(mirror); if (i >= 0){ removeEnemy(mirror); enemies.splice(i, 1); } mirror = null; } }

// the temple's PRACTICE RING button: the sandbox loads, then the mirror steps in
let practiceNext = null;
export function practiceOnArrive(rule = D.defaultRule){ practiceNext = { rule, until: now() + 30000 }; }

/* ---------------- levelling (data/duel-mode.js FAIRNESS) ---------------- */
let kept = null;
function level(){
  if (kept) return;
  kept = { wk: worldKey(), up: player.up, skills: player.skills, boon: player.boon, boons: player.boons, unlocked: G.unlocked, phoenix: player.phoenixReady, hp: player.hp };
  player.up = freshUp(); player.skills = {}; player.boon = {}; player.boons = {}; player.phoenixReady = false;
  // the duel's even kit, less a power the story hasn't handed out yet (Force Pull waits for the siege: game/sandbox-unlocks.js)
  G.unlocked = Object.fromEntries(Object.entries(DUEL_POWERS).filter(([k, on]) => on && storyReached(k)));
  syncJediChips();
}
function unlevel(){
  if (!kept) return;
  // gone somewhere else first (another wing, a run, the menu): that start set its own numbers, so there is nothing to put back
  if (worldKey() !== kept.wk || G.mode !== 'play'){ kept = null; syncJediChips(); return; }
  player.up = kept.up; player.skills = kept.skills; player.boon = kept.boon; player.boons = kept.boons; G.unlocked = kept.unlocked; player.phoenixReady = kept.phoenix;
  player.hp = Math.min(maxHp(), Math.max(1, kept.hp));
  kept = null;
  syncJediChips();
}
const refill = () => { player.hp = maxHp(); player.stam = maxStam(); player.force = CFG.player.maxForce; player.focus = 0; player.fury = 0; player.flinchT = 0; player.gbT = 0; };

/* ---------------- the referee ---------------- */
function beginMatch(){
  M.rounds = [0, 0]; M.round = 1; M.champ = -1; M.rematch.clear();
  startRound();
}
function startRound(){
  M.hits = [0, 0]; M.hp = [1, 1]; M.win = -1; M.sudden = false; decideAt = 0;
  M.clock = M.rule === 'timed' ? RULES.timed.time : 0;
  setPhase('enter', D.beats.enter);
}
function setPhase(ph, dur){
  phaseEnds = now() + (dur || 0) * 1000;
  M.ends = dur || 0;
  apply(ph);
  if (M.ref) tell();
}
function tell(){ if (M && M.ref && M.pvp){ lastSent = now(); send(stateMsg()); } }
const stateMsg = () => ({ t: 'dst', id: M.id, a: M.a, b: M.b, rule: M.rule, place: M.place, ring: M.ring, ph: M.ph, hits: M.hits, hp: M.hp, rounds: M.rounds,
  round: M.round, clock: Math.round(M.clock * 10) / 10, sud: M.sudden ? 1 : 0, win: M.win, champ: M.champ, lk: M.lk, w: worldKey(), ends: Math.round((phaseEnds - now()) / 100) / 10, rm: [...M.rematch] });

// a clean hit: `by` (0 | 1) struck the other
function scorePoint(by, n = 1){
  if (!M || (M.ph !== 'fight' && !(decideAt && now() < decideAt))) return;
  M.hits[by] += n;
  const R = RULES[M.rule];
  if (M.rule === 'hits' && M.hits[by] >= R.hits) roundDecided();
  else if (M.rule === 'timed' && M.sudden && M.hits[0] !== M.hits[1]) roundDecided();
  tell();
}
// the round's end is called: a trade still has a moment to land (both count, like a double hit in fencing)
// (a trade's moment follows the link: the other fighter's verdict has a one-way trip to make. M.lk sums both fighters'
// round trips to the host, so half of it is the one-way trip between them)
const tradeS = () => Math.min(D.lag.trade.max, D.lag.trade.base + (M && M.pvp ? (M.lk || 0) / 2000 : 0));
function roundDecided(){
  if (decideAt) return;
  const wait = tradeS();
  decideAt = now() + wait * 1000;
  const id = M.id;   // (and a timer too, so a referee whose tab is in the background, with no frames, still calls it)
  setTimeout(() => { if (M && M.id === id && M.ref && decideAt && now() >= decideAt) closeRound(); }, wait * 1000 + 30);
}
function closeRound(){
  decideAt = 0;
  const R = RULES[M.rule];
  const done = (i) => M.rule === 'hits' ? M.hits[i] >= R.hits : M.rule === 'health' ? M.hp[1 - i] <= 0.001 : M.hits[i] > M.hits[1 - i];
  const a = done(0), b = done(1);
  M.win = a && !b ? 0 : b && !a ? 1 : -1;   // both: a trade, the round is drawn and fought again
  if (M.win >= 0) M.rounds[M.win]++;
  if (M.rounds[0] >= D.toWin || M.rounds[1] >= D.toWin){ M.champ = M.rounds[0] > M.rounds[1] ? 0 : 1; setPhase('over', 0); return; }
  setPhase('roundEnd', D.beats.roundEnd);
}
onVerdict((m) => {
  if (!M || !M.ref || !M.pvp) return;
  const def = seatIdx(m.from || 0), att = 1 - def;
  if (def < 0) return;
  if (m.hp != null) M.hp[def] = +m.hp;
  if (m.r === 'hit'){
    if (M.rule === 'health'){ M.hits[att]++; if (M.hp[def] <= 0.011){ M.hp[def] = 0; roundDecided(); } tell(); }
    else scorePoint(att);
  }
});

/* ---------------- this screen's side of each beat ---------------- */
function apply(ph){
  const was = M.ph;
  M.ph = ph;
  const fighter = M.me >= 0;
  if (fighter){
    G.duel = G.duel || { pvp: M.pvp, fighting: true, foe: M.me === 0 ? M.b : M.a, rule: M.rule, phase: ph, widen: 0 };
    G.duel.phase = ph; G.duel.rule = M.rule; G.duel.widen = M.lk > D.lag.poor ? D.lag.parryWiden : 0;
  }
  if (ph === was) return;
  if (ph === 'enter'){
    if (fighter){
      level(); refill(); toMark();
      if (!M.pvp) spawnMirror();
      if (M.place === 'sandbox') showRing(true);
    }
    showBanner('ROUND ' + M.round, (seatName(M.a) + '  vs  ' + seatName(M.b)), D.beats.enter + 0.6, { kicker: RULES[M.rule].name });
  } else if (ph === 'count'){
    countN = -1;
  } else if (ph === 'fight'){
    if (fighter){ if (player.holstered){ player.holstered = false; } lightFromBelt(); }
    showBanner('FIGHT', '', 0.9);
    sfx(880, 0.12, 'square', 0.05, 1320);
  } else if (ph === 'roundEnd'){
    const w = M.win;
    showBanner(w < 0 ? 'A TRADE' : seatName(w === 0 ? M.a : M.b) + ' TAKES IT', w < 0 ? 'Both landed at once: the round goes again' : 'ROUNDS ' + M.rounds[0] + ' – ' + M.rounds[1], D.beats.roundEnd);
    if (fighter && M.me === w) S.reward && S.reward(1);
  } else if (ph === 'over'){
    const won = M.me >= 0 && M.champ === M.me;
    if (fighter){ if (M.pvp) record(M.me === 0 ? M.b : M.a, won); dropMirror(); showRing(false); }
    showBanner(M.me < 0 ? seatName(M.champ === 0 ? M.a : M.b) + ' WINS' : won ? 'VICTORY' : 'DEFEAT', 'ROUNDS ' + M.rounds[0] + ' – ' + M.rounds[1], 2.4);
    if (fighter && ui.card) ui.card('over', scoreView());
  }
}
let countN = -1;
// each fighter on their mark, facing the other: the challenger (or you, in practice) on the west, the other on the east
function toMark(){
  const R = M.ring, side = M.me === 0 ? -1 : 1;
  if (player.atkT > 0) cancelSwing();
  player.holstered = false;
  stowForScene();   // the hilt on the belt, the blade out: the FIGHT draws it
  playerPos().set(R.x + side * D.ring.marks, 0, R.z);
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
  G.yaw = player.faceYaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  player.group.rotation.y = G.yaw;
}

/* ---------------- the ring on the sandbox floor ---------------- */
let ringMesh = null;
function showRing(on){
  if (ringMesh){ scene.remove(ringMesh); ringMesh.geometry.dispose(); ringMesh = null; }
  if (!on || !M) return;
  ringMesh = new THREE.Mesh(new THREE.RingGeometry(M.ring.r - 0.15, M.ring.r + 0.15, 64), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.55, depthWrite: false }));
  ringMesh.rotation.x = -Math.PI / 2; ringMesh.position.set(M.ring.x, 0.05, M.ring.z);
  scene.add(ringMesh);
}

/* ---------------- a fighter and spectators hear the referee ---------------- */
on('dst', (m) => {
  const a = m.a ?? 0, b = m.b ?? 0;
  if (m.ph === 'over' || m.ph === 'gone') busy.delete(a), busy.delete(b); else { busy.add(a); busy.add(b); }
  if (M && M.ref) return;
  const mine = a === net.slot || b === net.slot;
  if (!mine){
    // watching: only a duel in the same wing (or sandbox) as this screen
    if (m.w !== worldKey() || (M && M.me >= 0)) return;
    if (!M || M.id !== m.id) M = { id: m.id, a, b, me: -1, ref: false, pvp: true, rematch: new Set(), pgs: {}, ph: 'wait' };
  } else if (!M || M.id !== m.id) return;
  Object.assign(M, { rule: m.rule, place: m.place, ring: m.ring, hits: m.hits, hp: m.hp, rounds: m.rounds, round: m.round, clock: m.clock, sudden: !!m.sud, win: m.win, champ: m.champ, lk: m.lk, ends: m.ends, seen: now() });
  const rmWas = [...(M.rematch || [])].join();
  M.rematch = new Set(m.rm || []);
  if (m.ph !== M.ph && m.ph === 'enter' && M.me >= 0 && M.ph === 'over' && ui.close) ui.close();   // (a rematch: the score card goes)
  if (m.ph !== M.ph) apply(m.ph);
  else if (M.ph === 'over' && M.me >= 0 && ui.card && [...M.rematch].join() !== rmWas) ui.card('over', scoreView());   // (who is ready for a rematch: only when it changes, not on each heartbeat)
  M.ph = m.ph;
});
on('dpg', (m) => { if (M && M.ref && seatIdx(m.from || 0) >= 0){ M.pgs[m.from || 0] = +m.p || 0; M.lk = linkOf(M); } });
on('drm', (m) => {
  if (!M || m.id !== M.id || !M.ref || M.ph !== 'over') return;
  M.rematch.add(m.from || 0);
  rematchCheck();
  if (M && M.ph === 'over' && ui.card) ui.card('over', scoreView());   // (their READY shows on this card)
});
on('dq', (m) => {
  if (pending && m.id === pending.id) pending = null;
  if (!M || m.id !== M.id) return;
  if (M.me >= 0 && M.ph !== 'over') showBanner('', 'THE DUEL IS OFF', 1.8);
  endDuel(true);
});

/* ---------------- after the match ---------------- */
export function rematch(){
  if (!M || M.ph !== 'over' || M.me < 0) return;
  const seat = M.pvp ? net.slot : 'me';
  M.rematch.add(seat);
  if (M.pvp && !M.ref) send({ t: 'drm', id: M.id });
  rematchCheck();
  if (ui.card) ui.card('over', scoreView());
}
function rematchCheck(){
  if (!M.ref) return;
  if (!M.pvp || (M.rematch.has(M.a) && M.rematch.has(M.b))){ if (ui.close) ui.close(); beginMatch(); }
  else tell();
}
export function leaveDuel(){
  if (!M) return;
  if (M.pvp && M.me >= 0) send({ t: 'dq', id: M.id });
  endDuel(true);
}
function endDuel(quiet){
  const was = M;
  M = null;
  if (ui.close) ui.close();
  dropMirror(); showRing(false);
  if (was && was.me >= 0){
    unlevel();
    G.duel = null;
    clearUnlit();
    if (!quiet) showBanner('', 'THE DUEL IS OVER', 1.4);
    if (was.ref && was.pvp) send({ t: 'dst', id: was.id, a: was.a, b: was.b, ph: 'gone', w: worldKey() });
  }
}
export function scoreView(){
  if (!M) return null;
  const me = M.me, other = me === 0 ? M.b : M.a;
  return { rule: M.rule, rounds: M.rounds, champ: M.champ, me, names: [seatName(M.a), seatName(M.b)], pvp: M.pvp,
    ready: [...M.rematch], meReady: M.rematch.has(M.pvp ? net.slot : 'me'), them: M.pvp ? nameOf(other) : 'THE MIRROR', record: M.pvp ? recordOf(nameOf(other)) : null };
}

/* ---------------- the trophy hall (DUEL HONOURS): wins and losses against each friend, by name ---------------- */
const HONOURS = 'sw_duel_honours';
export function honours(){ try { return JSON.parse(localStorage.getItem(HONOURS)) || {}; } catch(e){ return {}; } }
const recordOf = (name) => honours()[name] || { w: 0, l: 0 };
function record(seat, won){
  const name = nameOf(seat), h = honours(), r = h[name] || { w: 0, l: 0 };
  if (won) r.w++; else r.l++;
  r.at = Date.now(); h[name] = r;
  try { localStorage.setItem(HONOURS, JSON.stringify(h)); } catch(e){}
}

/* ---------------- the spectators' balcony (the temple's ring) ---------------- */
export function toBalcony(){
  if (duelPlace() !== 'temple' || (M && M.me >= 0)) return false;
  const B = D.balcony;
  playerPos().set(B.x, B.y, B.z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
  G.yaw = player.faceYaw = B.yaw; player.group.rotation.y = B.yaw;
  return true;
}
export const duelOnHere = () => !!M && M.me < 0 && M.ph !== 'over';

/* ---------------- each frame (main.js) ---------------- */
export function updateDuel(){
  pvpTick();   // (the guard's recent history, for judging a blow as it stood when it landed: net/pvp.js)
  const t = now();
  if (pending && t > pending.until){ pending = null; showBanner('', 'NO ANSWER', 1.4); }
  if (incoming && (t > incoming.until || !duelPlace())){ send({ t: 'dans', to: incoming.from, id: incoming.id, ok: 0 }); incoming = null; if (ui.close) ui.close(); }
  if (practiceNext && (t > practiceNext.until || G.hero !== 'jedi')) practiceNext = null;
  if (practiceNext && G.sandbox && G.mode === 'play' && !G.paused && !G.skillSelect && !M){ const r = practiceNext.rule; practiceNext = null; startPractice(r); }
  if (!M) return;
  // the match goes away: the other fighter left (the room, the wing), this one left the place, or a spectator's view went quiet
  if (M.me < 0){ if (t - M.seen > 6000 || M.ph === 'gone' || (M.ph === 'over' && t - M.seen > 4000)) M = null; return; }
  if (M.ph === 'gone' || !duelPlace() || (M.pvp && !connected())){ endDuel(false); return; }
  if (M.pvp){
    const P = partnerPuppet(M.me === 0 ? M.b : M.a), here = P && P.group.visible;
    lostFoeT = here ? 0 : (lostFoeT || t);
    if (lostFoeT && t - lostFoeT > 4000){ showBanner('', 'YOUR OPPONENT LEFT THE RING', 1.8); leaveDuel(); return; }
    if (!M.ref && t - M.seen > 8000){ showBanner('', 'LOST THE DUEL\'S REFEREE', 1.8); endDuel(true); return; }
    if (t - lastPing > D.lag.pingEvery){ lastPing = t; if (M.ref){ M.pgs[net.slot] = pvpLinkMs(); M.lk = linkOf(M); } else send({ t: 'dpg', p: pvpLinkMs() }); }
  }
  if (G.duel){ G.duel.widen = M.lk > D.lag.poor ? D.lag.parryWiden : 0; }
  // on the marks and through the count, the fighters hold still; in the fight, the ring holds them in
  if (M.ph === 'enter' || M.ph === 'count'){ holdMark(); countBeat(); }
  if (mirror) mirror.aiHold = M.ph !== 'fight';   // the mirror waits for the FIGHT too, and stands down once a round is called
  else if (M.ph === 'fight') keepInRing();
  if (M.rule !== 'health' && M.ph === 'fight' && player.hp < maxHp()) player.hp = maxHp();   // (clean hits: the bar is not the score)
  if (!M.ref) return;
  // THE REFEREE's clock
  if (decideAt && t >= decideAt) return void closeRound();
  if (M.ph === 'enter' && t >= phaseEnds) setPhase('count', D.beats.count);
  else if (M.ph === 'count' && t >= phaseEnds) setPhase('fight', 0);
  else if (M.ph === 'roundEnd' && t >= phaseEnds){ M.round++; startRound(); }
  else if (M.ph === 'fight'){
    if (M.rule === 'timed' && !M.sudden){
      const dt = Math.min(0.1, (t - (lastBeat || t)) / 1000);
      M.clock = Math.max(0, M.clock - dt);
      if (M.clock <= 0){ if (M.hits[0] !== M.hits[1]) roundDecided(); else { M.sudden = true; showBanner('SUDDEN DEATH', 'The next clean hit takes it', 1.6); } tell(); }
    }
  }
  if (M.pvp && t - lastSent > 1000) tell();   // (a heartbeat in every beat, the score card too, so the other screens know the referee is still there)
  lastBeat = t;
}
function holdMark(){
  const R = M.ring, side = M.me === 0 ? -1 : 1, p = playerPos();
  p.x = R.x + side * D.ring.marks; p.z = R.z;
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0);
}
function countBeat(){
  if (M.ph !== 'count') return;
  const left = Math.ceil(Math.max(0, phaseEnds - now()) / 1000 || M.ends || 0);
  if (left !== countN && left > 0){ countN = left; showBanner(String(left), '', 0.8); sfx(520, 0.08, 'square', 0.04, 520); }
}
function keepInRing(){
  const R = M.ring, p = playerPos(), dx = p.x - R.x, dz = p.z - R.z, d = Math.hypot(dx, dz), lim = R.r - D.ring.edge;
  if (d <= lim) return;
  p.x = R.x + dx / d * lim; p.z = R.z + dz / d * lim;
  const out = (player.vel.x * dx + player.vel.z * dz) / d;
  if (out > 0){ player.vel.x -= dx / d * out; player.vel.z -= dz / d * out; }
}

/* ---------------- blows on this hero (player/damage.js) ---------------- */
duelHooks.taken = (dmg, opts, chip) => {
  if (!M || M.me < 0) return;
  if (M.rule === 'health'){
    M.hp[M.me] = Math.max(0, player.hp) / maxHp();
    if (!M.pvp && player.hp < 1){ M.hp[0] = 0; roundDecided(); }
  } else player.hp = maxHp();
  // the mirror's clean hit on you (in a match with a friend, the verdict does it: net/pvp.js)
  if (!M.pvp && !chip && opts && opts.by && opts.by.duelMirror){
    if (M.rule === 'health') M.hits[1]++; else scorePoint(1);
  }
};

// for the tests and the HUD
export const duelInfo = () => ({ M: M && { ...M, rematch: [...(M.rematch || [])] }, pending: !!pending, incoming: !!incoming, levelled: !!kept, duel: G.duel && { ...G.duel } });
export const incomingChallenge = () => incoming && { ...incoming, name: nameOf(incoming.from), link: incoming.pg + pvpLinkMs() };
