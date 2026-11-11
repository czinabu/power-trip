// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL MODE (the duel plan's steps 2 and 3): a match between players in the training wing's ring in the temple on Tython,
// or in the sandbox's practice ring (against friends there, or a mirror duellist on your own).
//
// THE CHALLENGE: walk up to a friend (or pick them at the DUEL RING station), pick the rule, and they get a card to accept.
//   WHO MAY FIGHT is the challenger's other pick: SABERS ONLY (Jedi against Jedi, the default) or ANY HERO, where the
//   Mandalorian and the ARC trooper come in with their guns and the flamer (net/pvp.js carries the bolts and the burn to
//   the defender, whose screen deflects, blocks or takes them), the jetpack flies, and the ring gets cover to fight from.
//   FREE-FOR-ALL: the same card can challenge everyone here at once (up to four fighters). It starts when they've all
//   answered, with whoever said yes; every rule plays as one on one (on HEALTH the last one standing takes the round).
// THE MATCH: both step onto their marks with the hilts on the belt; a count of three; the blades come out and it's on.
//   CLEAN HITS (the default) first to 3 clean saber hits takes the round · HEALTH a full bar each · TIMED 90 s, most clean
//   hits. Best of 3 rounds. Then a score card with a straight REMATCH, and the win goes in the trophy hall (DUEL HONOURS).
// LEVELLED: for the match every fighter is put on the same base numbers (data/duel-mode.js FAIRNESS): no upgrades, skill
//   picks, crystal or perks, every power at base, push and pull only (a gunner: its base guns and the flamer), Knight
//   difficulty. Forms and looks stay yours.
// THE REFEREE is the challenger's screen: it keeps the clock and the score from the defenders' verdicts (net/pvp.js) and
//   tells the room ('dst'), so the other fighter and anyone watching (in the same wing: the balcony) see the same match.

import * as THREE from 'three';
import { G, shared, player, enemies } from '../state.js';
import { scene } from '../engine/renderer.js';
import { DUEL_MODE, DUEL_POWERS } from '../data/duel-mode.js';
import { solids } from '../state.js';
import { abil } from '../data/mastery.js';
import { buildNav } from '../enemies/nav.js';
import { weaponUnlocked } from '../data/mando.js';
import { switchWeapon } from '../player/mando/weapons.js';
import { allies, clearSquad, trooperSquad } from '../allies/squad.js';
import { duelHooks } from './duel-hooks.js';
import { playerPos, maxHp, maxStam } from '../player/helpers.js';
import { CFG } from '../data/config.js';
import { worldKey } from '../player/players.js';
import { stowForScene, lightFromBelt, clearUnlit } from '../player/holster.js';
import { cancelSwing } from '../player/jedi/combat.js';
import { freshUp, syncJediChips, syncMandoChips } from './flow.js';
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
export const KITS = D.kits;
const mySeat = () => M && !M.pvp ? 'me' : net.slot;
const syncChips = () => G.hero === 'jedi' ? syncJediChips() : syncMandoChips();

/* ---------------- where a duel can be fought ---------------- */
// the temple's training wing (its ring), or the sandbox (its floor), as any hero (a gunner fights under ANY HERO)
export const duelPlace = () => {
  if (G.mode !== 'play' || G.cutscene) return null;
  const T = D.ring.temple;
  if (G.hub && G.hubId === T.hub && G.hubWing === T.wing) return 'temple';
  if (G.sandbox) return 'sandbox';
  return null;
};
// the friends here you could challenge now: { slot, name, hero, pos, near (walked up to, facing them) }
export function challengeable(){
  if (!duelPlace() || M || !connected()) return [];
  const p = playerPos(), yaw = player.group.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
  return partnerStand().filter(q => partnerHero(q.slot) && !busy.has(q.slot)).map(q => {
    const dx = q.pos.x - p.x, dz = q.pos.z - p.z, d = Math.hypot(dx, dz);
    return { slot: q.slot, name: q.name, hero: partnerHero(q.slot), pos: q.pos, d, near: d < D.reach && (d < 1.2 || (dx * fx + dz * fz) / d > 0.3) };
  });
}
// SABERS ONLY needs every fighter a Jedi: a party with a gunner in it can only be challenged under ANY HERO
export const sabersOk = (slots) => G.hero === 'jedi' && slots.every(k => partnerHero(k) === 'jedi');
const busy = new Set();   // seats fighting a duel of their own right now (heard from their 'dst')

/* ---------------- the match ----------------
   M: this screen's match, as fighter, referee or spectator.
   { id, s (the seats, challenger first; 'me' and 'mirror' in a practice), a, b (the first two, for the HUD and the tests),
     rule, kit (sabers | any), place, ring: { x, z, r }, ph (wait | enter | count | fight | roundEnd | over), and one entry
     per seat in hits (clean hits, a gun's part of one included), hp, rounds, out (HEALTH in a free-for-all: down for the
     rest of the round; and anyone who left it), then round, clock, sudden, win (this round's seat index, -1 a draw), champ,
     ref (this screen keeps the score), me (this screen's seat index, -1 watching), lk (the link, ms), pgs, rematch: Set,
     gone: Set (fighters who left a free-for-all) } */
let M = null;
export const duelState = () => M;
let pending = null;      // a challenge this screen sent, waiting on its answers: { id, to: [seats], ok: Set, no: Set, rule, kit, until }
let incoming = null;     // a challenge to this screen, on its card: { id, from, rule, kit, all (everyone asked), place, pg, until }
let nextId = 1;
let lastBeat = 0, phaseEnds = 0, decideAt = 0, lastSent = 0, lastPing = 0, lostFoeT = 0;
const ui = { card: null, close: null };   // ui/duel-ui.js draws the cards
export function setDuelUi(card, close){ ui.card = card; ui.close = close; }

const ringFor = (place) => {
  if (place === 'temple'){ const T = D.ring.temple; return { x: T.x, z: T.z, r: T.r }; }
  const S0 = D.ring.sandbox; return { x: S0.x, z: S0.z, r: S0.r };
};
const seatIdx = (k) => !M || !M.s ? -1 : M.s.indexOf(k);
const fill = (n, v) => Array.from({ length: n }, () => v);
function newMatch(o){   // a match's record, with an entry per seat
  const n = o.s.length;
  return { ph: 'wait', hits: fill(n, 0), hp: fill(n, 1), rounds: fill(n, 0), out: fill(n, false), round: 1, clock: 0, sudden: false, win: -1, champ: -1,
    lk: 0, pgs: {}, rematch: new Set(), gone: new Set(), seen: now(), kit: D.defaultKit, ...o, a: o.s[0], b: o.s[1] };
}
// where seat i of n stands: round the ring, the challenger on the west, facing the middle (two: west and east)
function markOf(i, n){
  const R = M.ring, ang = Math.PI + i * Math.PI * 2 / n;
  const x = R.x + Math.cos(ang) * D.ring.marks, z = R.z + Math.sin(ang) * D.ring.marks;
  return { x, z, yaw: Math.atan2(R.x - x, R.z - z) };
}
const linkOf = (m) => Object.values(m.pgs || {}).reduce((a, b) => a + (+b || 0), 0);

/* ---------------- the challenge ---------------- */
// `slots`: one friend, or several (a FREE-FOR-ALL); `kit`: who may fight (SABERS ONLY needs every fighter a Jedi)
export function challenge(slots, rule = D.defaultRule, kit = D.defaultKit){
  if (!duelPlace() || M || !connected()) return false;
  const to = [...new Set([].concat(slots))].filter(k => k !== net.slot).slice(0, D.ffa.max - 1);
  if (!to.length) return false;
  if (!KITS[kit] || (kit === 'sabers' && !sabersOk(to))) kit = 'any';
  pending = { id: net.slot * 1000 + (nextId++ % 1000), to, ok: new Set(), no: new Set(), rule: RULES[rule] ? rule : D.defaultRule, kit, until: now() + D.answerWait * 1000 };
  for (const k of to) send({ t: 'dch', to: k, id: pending.id, rule: pending.rule, kit, all: to, place: duelPlace(), pg: pvpLinkMs() });
  showBanner('', to.length > 1 ? 'FREE-FOR-ALL: CHALLENGE SENT TO ' + to.length : 'CHALLENGE SENT TO ' + nameOf(to[0]), 1.8);
  S.uiHover && S.uiHover();
  return true;
}
on('dch', (m) => {
  if (m.to !== net.slot) return;
  const from = m.from || 0, kit = KITS[m.kit] ? m.kit : D.defaultKit;
  // busy (fighting, another card up, somewhere a duel can't be fought, a gunner asked to a sabers-only duel): turned down
  if (M || incoming || pending || duelPlace() !== m.place || G.paused || G.skillSelect) return void send({ t: 'dans', to: from, id: m.id, ok: 0, why: 'busy' });
  if (kit === 'sabers' && G.hero !== 'jedi') return void send({ t: 'dans', to: from, id: m.id, ok: 0, why: 'hero' });
  incoming = { id: m.id, from, rule: RULES[m.rule] ? m.rule : D.defaultRule, kit, all: Array.isArray(m.all) ? m.all.slice(0, D.ffa.max - 1) : [net.slot], place: m.place, pg: +m.pg || 0, until: now() + D.answerWait * 1000 };
  S.reward && S.reward(0);
  if (ui.card) ui.card('incoming', incomingView());
});
const incomingView = () => incoming && { ...incoming, name: nameOf(incoming.from), link: incoming.pg + pvpLinkMs(), others: incoming.all.filter(k => k !== net.slot).map(nameOf) };
export function answer(ok){
  const c = incoming; incoming = null;
  if (!c) return;
  send({ t: 'dans', to: c.from, id: c.id, ok: ok ? 1 : 0, pg: pvpLinkMs() });
  if (ui.close) ui.close();
  if (!ok) return;
  // the challenger referees: wait for their first word ('dst'), which puts this fighter on their mark (a free-for-all
  // waits for everyone asked to answer first)
  M = newMatch({ id: c.id, s: [c.from, net.slot], rule: c.rule, kit: c.kit, place: c.place, ring: ringFor(c.place), ref: false, me: 1, pvp: true, lk: c.pg + pvpLinkMs() });
  if (c.all.length > 1) showBanner('', 'WAITING FOR THE OTHERS TO ANSWER', 2.4);
}
on('dans', (m) => {
  if (m.to !== net.slot) return;
  const from = m.from || 0;
  // a yes that came in after the free-for-all had started without them: that one is off for them
  if (!pending || m.id !== pending.id){ if (m.ok && M && M.ref && M.id === m.id && seatIdx(from) < 0) send({ t: 'dq', id: m.id, to: from }); return; }
  const p = pending;
  if (!p.to.includes(from)) return;
  if (m.ok){ p.ok.add(from); p.pgs = { ...(p.pgs || {}), [from]: +m.pg || 0 }; }
  else {
    p.no.add(from);
    showBanner('', nameOf(from) + (m.why === 'busy' ? ' IS BUSY RIGHT NOW' : m.why === 'hero' ? ' ISN\'T A JEDI: TRY ANY HERO' : p.to.length > 1 ? ' SITS THIS ONE OUT' : ' TURNED IT DOWN'), 2);
  }
  if (p.ok.size + p.no.size >= p.to.length) launch();
});
// every answer is in (or the wait ran out): the match starts with whoever said yes
function launch(){
  const p = pending; pending = null;
  if (!p) return;
  const yes = p.to.filter(k => p.ok.has(k));
  if (!yes.length){ if (p.to.length > 1 || !p.no.size) showBanner('', p.no.size ? 'NOBODY TOOK IT UP' : 'NO ANSWER', 1.8); return; }
  if (M || !duelPlace()){ for (const k of yes) send({ t: 'dq', id: p.id, to: k }); return; }
  M = newMatch({ id: p.id, s: [net.slot, ...yes], rule: p.rule, kit: p.kit, place: duelPlace(), ring: ringFor(duelPlace()), ref: true, me: 0, pvp: true,
    pgs: { [net.slot]: pvpLinkMs(), ...(p.pgs || {}) } });
  if (M.place === 'sandbox'){ const pp = playerPos(); M.ring = { x: Math.round(pp.x), z: Math.round(pp.z), r: D.ring.sandbox.r }; }   // (the challenger's sandbox floor: everyone fights on the same spot)
  M.lk = linkOf(M);
  beginMatch();
}

/* ---------------- practice: the mirror (the sandbox) ---------------- */
export function startPractice(rule = D.defaultRule){
  if (!G.sandbox || M) return false;
  for (const e of [...enemies]) removeEnemy(e);
  enemies.length = 0;
  const pp = playerPos();
  // a gunner practises ANY HERO: a gunman for a mirror, and cover in the ring
  M = newMatch({ id: -1, s: ['me', 'mirror'], rule: RULES[rule] ? rule : D.defaultRule, kit: G.hero === 'jedi' ? 'sabers' : 'any', place: 'sandbox',
    ring: { x: Math.round(pp.x), z: Math.round(pp.z), r: D.ring.sandbox.r }, ref: true, me: 0, pvp: false });
  beginMatch();
  return true;
}
let mirror = null;
function spawnMirror(){
  dropMirror();
  const R = M.ring, mk = markOf(1, 2), at = new THREE.Vector3(mk.x, 0, mk.z);
  const gun = G.hero !== 'jedi';
  const e = spawnEnemy(gun ? D.mirror.gunner : D.mirror.type, at) || enemies[enemies.length - 1];
  if (!e) return;
  e.duelMirror = true;
  e.home = { x: at.x, z: at.z }; e.aiHold = true;   // it stands its mark until the FIGHT lets it loose (updateDuel)
  if (!gun) setFoeForm(e, G.stance, D.mirror.rank);   // a mirror: it fights in the form you hold
  e.maxHp = e.hp = Math.max(e.hp, maxHp());
  // its blows are scored by the match, not its health: a clean saber cut on it is a point (a bolt a part of one, a burn by
  // the second); in HEALTH rules it can't die, its bar runs down to a sliver and the round is decided there
  e.dmgRule = (e2, dmg, tick, opts) => {
    if (!M || M.ph !== 'fight' || (opts && opts.ally)) return 0;
    const fresh = opts && opts.blade && !tick && player.swing && !player.swing.duelScored;   // (one point a cut, Jar'Kai's second blade included)
    if (fresh) player.swing.duelScored = true;
    const flame = tick && player.flaming;
    const pts = fresh ? D.points.cut : opts && opts.shot ? D.points.bolt : flame ? D.points.flamePerS * dmg / Math.max(1, flameDps()) : 0;
    if (M.rule !== 'health'){ if (pts) scorePoint(0, pts); return 0; }
    const d = Math.min(dmg, Math.max(0, e2.hp - 1));
    M.hp[1] = Math.max(0, (e2.hp - d - 1) / (e2.maxHp - 1));
    if (pts) M.hits[0] += pts;
    if (M.hp[1] <= 0.001) roundDecided();
    return d;
  };
  mirror = e;
}
function dropMirror(){ if (mirror){ const i = enemies.indexOf(mirror); if (i >= 0){ removeEnemy(mirror); enemies.splice(i, 1); } mirror = null; } }

const flameDps = () => abil('flame').dmg * (player.up.flameDmg || 1);   // (the flamer's burn a second: player/mando/weapons.js updateFlame)
// the temple's PRACTICE RING button: the sandbox loads, then the mirror steps in
let practiceNext = null;
export function practiceOnArrive(rule = D.defaultRule){ practiceNext = { rule, until: now() + 30000 }; }

/* ---------------- levelling (data/duel-mode.js FAIRNESS) ---------------- */
let kept = null;
function level(){
  if (kept) return;
  kept = { wk: worldKey(), up: player.up, skills: player.skills, boon: player.boon, boons: player.boons, unlocked: G.unlocked, phoenix: player.phoenixReady, hp: player.hp,
    weapon: player.weapon, squad: allies.length > 0 && !G.coopGuest };
  player.up = freshUp(); player.skills = {}; player.boon = {}; player.boons = {}; player.phoenixReady = false;
  // the duel's even kit, less a power the story hasn't handed out yet (Force Pull waits for the siege: game/sandbox-unlocks.js).
  // A gunner keeps its base guns and the flamer (data/duel-mode.js gunKit): the long guns, explosives and darksaber stay off
  const K = G.hero === 'jedi' ? null : D.gunKit[G.hero] || { guns: [], powers: {} };
  G.unlocked = Object.fromEntries(Object.entries(K ? K.powers : DUEL_POWERS).filter(([k, on]) => on && storyReached(k)));
  if (K && !(K.guns.includes(player.weapon) && weaponUnlocked(player.weapon))){ const g = K.guns.find(weaponUnlocked); if (g) switchWeapon(g); }
  if (kept.squad) clearSquad();   // (the squad is never in the ring)
  syncChips();
}
function unlevel(){
  if (!kept) return;
  // gone somewhere else first (another wing, a run, the menu): that start set its own numbers, so there is nothing to put back
  if (worldKey() !== kept.wk || G.mode !== 'play'){ kept = null; syncChips(); return; }
  player.up = kept.up; player.skills = kept.skills; player.boon = kept.boon; player.boons = kept.boons; G.unlocked = kept.unlocked; player.phoenixReady = kept.phoenix;
  player.hp = Math.min(maxHp(), Math.max(1, kept.hp));
  if (G.hero !== 'jedi' && kept.weapon && kept.weapon !== player.weapon && weaponUnlocked(kept.weapon)) switchWeapon(kept.weapon);
  const squad = kept.squad;
  kept = null;
  if (squad && !G.hub) trooperSquad();
  syncChips();
}
const refill = () => { player.hp = maxHp(); player.stam = maxStam(); player.force = CFG.player.maxForce; player.focus = 0; player.fury = 0; player.flinchT = 0; player.gbT = 0; };

/* ---------------- the referee ---------------- */
function beginMatch(){
  M.rounds = fill(M.s.length, 0); M.round = 1; M.champ = -1; M.rematch.clear();
  startRound();
}
function startRound(){
  const n = M.s.length;
  M.hits = fill(n, 0); M.hp = fill(n, 1); M.out = M.s.map(k => M.gone.has(k)); M.win = -1; M.sudden = false; decideAt = 0;
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
const r2 = (n) => Math.round(n * 100) / 100;
const stateMsg = () => ({ t: 'dst', id: M.id, s: M.s, rule: M.rule, kit: M.kit, place: M.place, ring: M.ring, ph: M.ph, hits: M.hits.map(r2), hp: M.hp.map(r2), rounds: M.rounds,
  out: M.out.map(o => o ? 1 : 0), g: [...M.gone], round: M.round, clock: Math.round(M.clock * 10) / 10, sud: M.sudden ? 1 : 0, win: M.win, champ: M.champ, lk: M.lk, w: worldKey(), ends: Math.round((phaseEnds - now()) / 100) / 10, rm: [...M.rematch] });

// a clean hit (or a part of one: a bolt, a burn): seat index `by` struck someone
const reached = (h) => h >= RULES.hits.hits - 1e-6;
const leader = () => { const top = Math.max(...M.hits.filter((_, i) => !M.out[i])); const at = M.hits.map((h, i) => !M.out[i] && h >= top - 1e-6 ? i : -1).filter(i => i >= 0); return at.length === 1 ? at[0] : -1; };
function scorePoint(by, n = 1){
  if (!M || (M.ph !== 'fight' && !(decideAt && now() < decideAt)) || M.out[by]) return;
  M.hits[by] += n;
  if (M.rule === 'hits' && reached(M.hits[by])) roundDecided();
  else if (M.rule === 'timed' && M.sudden && leader() >= 0) roundDecided();
  tell();
}
// HEALTH: a fighter's bar ran out. One on one that's the round; in a free-for-all they're out of it until the last one stands
function knockedOut(i){
  M.hp[i] = 0; M.out[i] = true; syncOuts();
  if (M.out.filter(o => !o).length <= 1) roundDecided();
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
  // who took it: CLEAN HITS whoever reached the count, HEALTH the one still standing, TIMED the most hits. More than one
  // (two blows in the same instant), or nobody left: a trade, the round is drawn and fought again
  const alive = M.s.map((k, i) => !M.out[i] && !M.gone.has(k) && (M.rule !== 'health' || M.hp[i] > 0.001));
  const won = M.rule === 'hits' ? M.hits.map((h, i) => alive[i] && reached(h)) : M.rule === 'health' ? alive : M.hits.map((_, i) => i === leader());
  const ws = won.map((w, i) => w ? i : -1).filter(i => i >= 0);
  M.win = ws.length === 1 ? ws[0] : -1;
  if (M.win >= 0) M.rounds[M.win]++;
  const champ = M.rounds.findIndex(r => r >= D.toWin);
  if (champ >= 0){ M.champ = champ; setPhase('over', 0); return; }
  setPhase('roundEnd', D.beats.roundEnd);
}
onVerdict((m) => {
  if (!M || !M.ref || !M.pvp) return;
  const def = seatIdx(m.from || 0), att = seatIdx(m.to ?? -1);
  const trade = decideAt && now() < decideAt;   // (a round's last moment: a blow from someone just put out still counts, a trade)
  if (def < 0 || att < 0 || def === att || M.gone.has(M.s[att]) || (!trade && (M.out[def] || M.out[att]))) return;
  if (m.hp != null) M.hp[def] = +m.hp;
  if (m.r === 'hit'){
    const pts = Math.max(0, Math.min(1, m.w == null ? D.points.cut : +m.w || 0));   // (a cut is one clean hit; a bolt or a burn a part of one)
    if (M.rule === 'health'){ M.hits[att] += pts; if (M.hp[def] <= 0.011) knockedOut(def); tell(); }
    else if (pts) scorePoint(att, pts);
  }
});

/* ---------------- this screen's side of each beat ---------------- */
function apply(ph){
  const was = M.ph;
  M.ph = ph;
  const fighter = M.me >= 0;
  if (fighter){
    const foes = M.s.filter(k => k !== mySeat());
    G.duel = G.duel || { pvp: M.pvp, fighting: true, foes, foe: foes[0], rule: M.rule, kit: M.kit, phase: ph, widen: 0, outs: [] };
    G.duel.foes = foes; G.duel.foe = foes[0];
    G.duel.phase = ph; G.duel.rule = M.rule; G.duel.kit = M.kit; G.duel.widen = M.lk > D.lag.poor ? D.lag.parryWiden : 0;
  }
  syncOuts();
  if (ph === was) return;
  if (ph === 'enter'){
    if (fighter){
      level(); refill(); toMark();
      if (!M.pvp) spawnMirror();
      if (M.place === 'sandbox') showRing(true);
    }
    showCover(M.kit === 'any');
    const vs = M.s.length > 2 ? 'FREE-FOR-ALL · ' + M.s.length + ' FIGHTERS' : seatName(M.s[0]) + '  vs  ' + seatName(M.s[1]);
    showBanner('ROUND ' + M.round, vs, D.beats.enter + 0.6, { kicker: RULES[M.rule].name + (M.kit === 'any' ? ' · ANY HERO' : '') });
  } else if (ph === 'count'){
    countN = -1;
  } else if (ph === 'fight'){
    if (fighter){ if (player.holstered){ player.holstered = false; } if (G.hero === 'jedi') lightFromBelt(); }
    showBanner('FIGHT', '', 0.9);
    sfx(880, 0.12, 'square', 0.05, 1320);
  } else if (ph === 'roundEnd'){
    const w = M.win;
    showBanner(w < 0 ? 'A TRADE' : seatName(M.s[w]) + ' TAKES IT', w < 0 ? 'They landed at once: the round goes again' : 'ROUNDS ' + M.rounds.join(' – '), D.beats.roundEnd);
    if (fighter && M.me === w) S.reward && S.reward(1);
  } else if (ph === 'over'){
    const won = M.me >= 0 && M.champ === M.me;
    // the trophy hall: a win counts against everyone in the ring, a loss against whoever took it
    if (fighter){ if (M.pvp){ if (won) M.s.forEach((k, i) => i !== M.me && record(k, true)); else if (M.champ >= 0) record(M.s[M.champ], false); } dropMirror(); showRing(false); }
    showCover(false);
    showBanner(M.me < 0 ? seatName(M.s[M.champ]) + ' WINS' : won ? 'VICTORY' : 'DEFEAT', 'ROUNDS ' + M.rounds.join(' – '), 2.4);
    if (fighter && ui.card) ui.card('over', scoreView());
  }
}
let countN = -1;
// each fighter on their mark, facing the middle: the challenger (or you, in practice) on the west, the rest round the ring
function toMark(){
  const mk = markOf(M.me, M.s.length);
  if (player.atkT > 0) cancelSwing();
  player.holstered = false;
  if (G.hero === 'jedi') stowForScene();   // the hilt on the belt, the blade out: the FIGHT draws it
  playerPos().set(mk.x, 0, mk.z);
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
  G.yaw = player.faceYaw = mk.yaw;
  player.group.rotation.y = G.yaw;
}
// who is out of the round on this screen (net/pvp.js leaves them alone: no blade or bolt is sent their way)
function syncOuts(){
  if (!G.duel || !M || !M.out) return;
  const was = G.duel.outs || [];
  G.duel.outs = M.s.filter((k, i) => M.out[i]);
  const me = mySeat();
  if (M.ph === 'fight' && M.s.length > 2 && G.duel.outs.includes(me) && !was.includes(me)) showBanner('OUT', 'Your bar ran out: watch the rest of the round', 1.8);
}

/* ---------------- ANY HERO: cover in the ring (data/duel-mode.js cover) ---------------- */
let cover = null;   // { meshes, solids }
const coverMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.9, metalness: 0.05 });
const coverCap = new THREE.MeshStandardMaterial({ color: 0x5f574c, roughness: 0.9, metalness: 0.05 });
function showCover(on){
  if (cover && (!on || !M || cover.key !== M.id + ':' + M.ring.x + ':' + M.ring.z)){
    for (const m of cover.meshes){ scene.remove(m); m.geometry.dispose(); }
    for (const c of cover.solids){ const i = solids.indexOf(c); if (i >= 0) solids.splice(i, 1); }
    cover = null;
    if (!M || !M.pvp) buildNav();   // (the mirror finds its way round it)
  }
  if (!on || !M || cover) return;
  cover = { key: M.id + ':' + M.ring.x + ':' + M.ring.z, meshes: [], solids: [] };
  for (const c of D.cover){
    const x = M.ring.x + c.x, z = M.ring.z + c.z;
    const m = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2, c.h, c.hz * 2), coverMat);
    m.position.set(x, c.h / 2, z); m.castShadow = m.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2 + 0.08, 0.1, c.hz * 2 + 0.08), coverCap);
    cap.position.y = c.h / 2; m.add(cap);
    m.userData.noBake = true;
    scene.add(m); cover.meshes.push(m);
    const sol = { x, z, hx: c.hx, hz: c.hz, h: c.h, box: true, live: true };
    solids.push(sol); cover.solids.push(sol);
  }
  if (!M.pvp) buildNav();
}
export const duelCover = () => cover ? cover.solids.length : 0;

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
  const s = Array.isArray(m.s) ? m.s.slice(0, D.ffa.max) : [];
  if (m.ph === 'over' || m.ph === 'gone') s.forEach(k => busy.delete(k)); else s.forEach(k => busy.add(k));
  if (M && M.ref) return;
  const mine = s.includes(net.slot);
  if (!mine){
    // watching: only a duel in the same wing (or sandbox) as this screen
    if (m.w !== worldKey() || (M && M.me >= 0)) return;
    if (!M || M.id !== m.id){ if (M) showCover(false); M = newMatch({ id: m.id, s, me: -1, ref: false, pvp: true }); }
  } else if (!M || M.id !== m.id) return;
  if (m.ph === 'gone') return void (M.ph = 'gone');
  Object.assign(M, { s, a: s[0], b: s[1], me: s.indexOf(net.slot), rule: m.rule, kit: KITS[m.kit] ? m.kit : D.defaultKit, place: m.place, ring: m.ring, hits: m.hits, hp: m.hp,
    rounds: m.rounds, out: (m.out || []).map(Boolean), gone: new Set(m.g || []), round: m.round, clock: m.clock, sudden: !!m.sud, win: m.win, champ: m.champ, lk: m.lk, ends: m.ends, seen: now() });
  syncOuts();
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
  if (m.to != null && m.to !== net.slot) return;   // (one fighter turned away from a free-for-all that started without them)
  if (pending && m.id === pending.id && m.who == null){ pending = null; return; }
  if (!M || m.id !== M.id) return;
  // one fighter left a free-for-all: the referee carries on with the rest (the others hear it in the next 'dst')
  if (m.who != null && M.s.length > 2){ if (M.ref) dropSeat(m.who); return; }
  if (M.me >= 0 && M.ph !== 'over') showBanner('', 'THE DUEL IS OFF', 1.8);
  endDuel(true);
});
// the referee: fighter `k` left a free-for-all. With two or more still in it, it goes on without them
function dropSeat(k){
  const i = seatIdx(k);
  if (i < 0 || M.gone.has(k)) return;
  M.gone.add(k); M.out[i] = true; M.rematch.delete(k); syncOuts();
  showBanner('', seatName(k) + ' LEFT THE RING', 1.6);
  if (M.s.length - M.gone.size < 2){ send({ t: 'dq', id: M.id }); endDuel(true); return; }
  if (M.ph === 'fight' && M.rule === 'health') { if (M.out.filter(o => !o).length <= 1) roundDecided(); }
  else if (M.ph === 'over') rematchCheck();
  tell();
}

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
  if (!M.pvp || M.s.every(k => M.gone.has(k) || M.rematch.has(k))){ if (ui.close) ui.close(); beginMatch(); }
  else tell();
}
export function leaveDuel(){
  if (!M) return;
  if (M.pvp && M.me >= 0) send(M.s.length > 2 && !M.ref ? { t: 'dq', id: M.id, who: net.slot } : { t: 'dq', id: M.id });   // (a free-for-all goes on without you)
  endDuel(true);
}
function endDuel(quiet){
  const was = M;
  showCover(false);
  M = null;
  if (ui.close) ui.close();
  dropMirror(); showRing(false);
  if (was && was.me >= 0){
    unlevel();
    G.duel = null;
    clearUnlit();
    if (!quiet) showBanner('', 'THE DUEL IS OVER', 1.4);
    if (was.ref && was.pvp) send({ t: 'dst', id: was.id, s: was.s, ph: 'gone', w: worldKey() });
  }
}
export function scoreView(){
  if (!M) return null;
  const me = M.me, others = M.s.filter((k, i) => i !== me && !M.gone.has(k)), ffa = M.s.length > 2;
  const ready = [...M.rematch].filter(k => k !== mySeat()).map(seatName);
  return { rule: M.rule, kit: M.kit, rounds: M.rounds, champ: M.champ, me, names: M.s.map(seatName), pvp: M.pvp, ffa, gone: M.s.map(k => M.gone.has(k)),
    ready: [...M.rematch], readyNames: ready, waitingOn: others.filter(k => !M.rematch.has(k)).map(seatName), meReady: M.rematch.has(mySeat()),
    them: !M.pvp ? 'THE MIRROR' : ffa ? 'THE OTHERS' : nameOf(others[0]), record: M.pvp && !ffa ? recordOf(nameOf(others[0])) : null };
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
  if (pending && t > pending.until) launch();   // (the wait ran out: on with whoever said yes)
  if (incoming && (t > incoming.until || !duelPlace())){ send({ t: 'dans', to: incoming.from, id: incoming.id, ok: 0 }); incoming = null; if (ui.close) ui.close(); }
  if (practiceNext && t > practiceNext.until) practiceNext = null;
  if (practiceNext && G.sandbox && G.mode === 'play' && !G.paused && !G.skillSelect && !M){ const r = practiceNext.rule; practiceNext = null; startPractice(r); }
  if (!M) return;
  // the match goes away: the other fighter left (the room, the wing), this one left the place, or a spectator's view went quiet
  if (M.me < 0){ if (t - M.seen > 6000 || M.ph === 'gone' || (M.ph === 'over' && t - M.seen > 4000)){ showCover(false); M = null; } return; }
  if (M.ph === 'gone' || !duelPlace() || (M.pvp && !connected())){ endDuel(false); return; }
  if (M.pvp && M.ph !== 'wait'){
    // someone gone from the ring: one on one, the duel is off; a free-for-all goes on without them (the referee drops them)
    const lost = M.s.filter(k => k !== net.slot && !M.gone.has(k) && !((P) => P && P.group.visible)(partnerPuppet(k)));
    lostFoeT = lost.length ? (lostFoeT || t) : 0;
    if (lostFoeT && t - lostFoeT > 4000){
      if (M.s.length === 2){ showBanner('', 'YOUR OPPONENT LEFT THE RING', 1.8); leaveDuel(); return; }
      if (M.ref){ lostFoeT = 0; for (const k of lost) if (M) dropSeat(k); if (!M) return; }
    }
  }
  if (M.pvp){
    if (!M.ref && t - M.seen > (M.ph === 'wait' ? (D.answerWait + 8) * 1000 : 8000)){ showBanner('', 'LOST THE DUEL\'S REFEREE', 1.8); endDuel(true); return; }
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
      if (M.clock <= 0){ if (leader() >= 0) roundDecided(); else { M.sudden = true; showBanner('SUDDEN DEATH', 'The next clean hit takes it', 1.6); } tell(); }
    }
  }
  if (M.pvp && t - lastSent > 1000) tell();   // (a heartbeat in every beat, the score card too, so the other screens know the referee is still there)
  lastBeat = t;
}
function holdMark(){
  const mk = markOf(M.me, M.s.length), p = playerPos();
  p.x = mk.x; p.z = mk.z;
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
  // the mirror's clean hit on you (in a match with a friend, the verdict does it: net/pvp.js); a gunman's bolt is a part of one
  const by = opts && (opts.by || opts.src);
  if (!M.pvp && !chip && by && by.duelMirror){
    const pts = opts.by ? D.points.cut : D.points.bolt;
    if (M.rule === 'health') M.hits[1] += pts; else scorePoint(1, pts);
  }
};

// for the tests and the HUD
export const duelInfo = () => ({ M: M && { ...M, rematch: [...(M.rematch || [])], gone: [...(M.gone || [])] }, pending: !!pending, incoming: !!incoming, levelled: !!kept, duel: G.duel && { ...G.duel }, cover: duelCover() });
export const incomingChallenge = () => incomingView();
