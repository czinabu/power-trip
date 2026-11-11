// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// PLAYER AGAINST PLAYER (duel mode, step 1 of the duel plan): one player's saber, push or pull aimed at another player,
// and under ANY HERO a gunner's bolts and flamer too. In a free-for-all every other fighter still in the round is a foe.
// The co-op link already shows each hero to the other (net/partner.js, net/pose.js); this adds the blows between them.
//   dsw   a cut has STARTED: sent the instant it starts, with a timestamp, not on the 50 ms pose update, so the other
//         screen knows a blow is coming (and on which line) as early as the link allows
//   dhit  the blade REACHED them on the attacker's screen (the blade sweep found their body: player/jedi/bladehit.js)
//   dres  the DEFENDER's verdict. Their own screen judges the blow through the same incoming-blow path a foe's blow takes
//         (net/foefire.js incomingBlow → player/damage.js): block, parry, dodge or hit. If you parried on your screen,
//         it counts. Everyone in the duel's world hears the verdict: the attacker for the feel, the referee for the score
//   dfp   a Force push or pull caught them
//   dbl   a gunner's BOLT left the barrel (or a turned one came back off a blade or a vambrace): each foe's screen flies its
//         own hostile copy, so the blade that deflects it, the beskar that stops it and the cover in the way are all theirs;
//         whoever else is watching draws a harmless one. The verdict comes back as a dres like a cut's
//   dfl   a FLAMER's burn caught them (sent every DUEL_MODE.flameEvery s while they stand in the stream): fire is no blow to
//         parry or block, only a dash slips it
// Trades fall out of this on their own: each fighter's blow is judged by the other, so two blows landing in the same
// instant both count (game/duel-mode.js scores a trade, the way a double hit counts in fencing).

import * as THREE from 'three';
import { G, player } from '../state.js';
import { V3 } from '../utils.js';
import { DUEL_MODE } from '../data/duel-mode.js';
import { duelHooks } from '../game/duel-hooks.js';
import { playerPos, fwd, maxHp } from '../player/helpers.js';
import { cancelSwing } from '../player/jedi/combat.js';
import { recoilSwing } from '../player/jedi/clash.js';
import { addThreatSource } from '../player/jedi/guardline.js';
import { floater } from '../fx/floaters.js';
import { spawnHitSpark } from '../fx/vfx.js';
import { clashFlash, clashSparks } from '../fx/ink.js';
import { S } from '../audio/sfx.js';
import { net, on, send } from './session.js';
import { partnerPuppet } from './partner.js';
import { incomingBlow } from './foefire.js';
import { fireBolt } from '../enemies/bolts.js';
import { bolts } from '../state.js';
import { hurtPlayer } from '../player/damage.js';
import { columnInAim } from '../player/aim.js';
import { worldKey } from '../player/players.js';
import { blastCovered } from '../world/collision.js';

const r2 = (n) => Math.round(n * 100) / 100;
const fromOf = (m) => m.from || 0;   // (the host's own messages carry no seat: it is seat 0)
let swingN = 0;
const R = { body: 0.42, height: 1.9 };   // the other fighter as the blade sweep sees them: an upright capsule

// the duel this screen is FIGHTING in (not watching), and the other fighters' seats (every one still in the round)
const fighting = () => !!(G.duel && G.duel.pvp && G.duel.fighting);
const foeSeats = () => (G.duel.foes || [G.duel.foe]).filter(k => !(G.duel.outs || []).includes(k));
const meOut = () => (G.duel.outs || []).includes(net.slot);   // (a free-for-all on HEALTH: down for the rest of the round)
const isFoe = (k) => fighting() && !meOut() && foeSeats().includes(k);
const posOf = (k) => { const P = partnerPuppet(k); return P && P.group.visible ? P.group.position : null; };
const forMe = (m) => Array.isArray(m.to) ? m.to.includes(net.slot) : m.to === net.slot;
export const pvpLinkMs = () => net.role === 'host' ? 0 : net.ping;   // this screen's share of the link between the two fighters

/* ---------------- the attacker's side ---------------- */
// the other fighter's body, one object per seat so the sweep's "already cut" set holds across frames
const bodies = new Map();
duelHooks.bodies = () => {
  if (!fighting() || G.duel.phase !== 'fight' || meOut()) return [];
  const out = [];
  for (const k of foeSeats()){
    const pos = posOf(k);
    if (!pos) continue;
    let b = bodies.get(k);
    if (!b){ b = { duelBody: true, slot: k, pos: new THREE.Vector3(), r: R.body, h: R.height }; bodies.set(k, b); }
    b.pos.copy(pos);
    out.push(b);
  }
  return out;
};

duelHooks.swingStart = (sw) => {
  if (!fighting()) return;
  sw.pvpId = ++swingN;
  const pp = playerPos();
  send({ t: 'dsw', to: foeSeats(), i: sw.pvpId, at: Math.round(performance.now()), d: r2(sw.dur), l: lineOf(sw), h: sw.heavy || sw.charging ? 1 : 0, x: r2(pp.x), z: r2(pp.z) });
};
const lineOf = (sw) => (sw && sw.pat && (sw.pat.line || (sw.pat.h === 'low' ? 'Lo' : sw.pat.yF < -0.5 ? 'L' : sw.pat.yF > 0.5 ? 'R' : 'H'))) || 'H';

duelHooks.swingHit = (body, b) => {
  if (!fighting() || G.duel.phase !== 'fight') return;
  const sw = player.swing, pp = playerPos();
  if (sw && sw.pvpSent) return;   // one verdict per cut
  if (sw) sw.pvpSent = true;
  send({ t: 'dhit', to: body.slot, i: sw && sw.pvpId || ++swingN, at: Math.round(performance.now()), k: Math.round(pvpLinkMs()), dm: r2(b.dmg), l: b.line || 'H', f: b.finisher ? 1 : 0, r: b.riposte ? 1 : 0, h: b.heavy ? 1 : 0, x: r2(pp.x), z: r2(pp.z) });
};

/* a push or a pull: does its cone have the other fighter in it (on this screen, where you aimed it)? */
duelHooks.power = (kind, aim, A) => {
  if (!fighting() || G.duel.phase !== 'fight') return;
  for (const k of foeSeats()){
    const pos = posOf(k); if (!pos) continue;
    const pp = playerPos(), dx = pos.x - pp.x, dz = pos.z - pp.z, d = Math.hypot(dx, dz);
    if (d > A.range + 0.5 || d < 0.05) continue;
    const ax = aim.dir.x, az = aim.dir.z, al = Math.hypot(ax, az) || 1;
    if ((dx * ax + dz * az) / (d * al) < Math.cos(A.angle) - 0.1) continue;
    send({ t: 'dfp', to: k, k: kind, dx: r2(dx / d), dz: r2(dz / d), d: r2(d) });
  }
};

/* ---------------- ANY HERO: the gunner's side ---------------- */
// a bolt just left this gunner's barrel (player/mando/weapons.js spawnBlasterBolt): every foe flies its own copy
let boltN = 0;
duelHooks.shot = (b, color, scale) => {
  if (!fighting() || G.duel.phase !== 'fight') return false;
  b.pvpOut = true;   // (here it only flies: it stops on a foe's body, their screen says what it did)
  sendBolt(foeSeats(), b, color, scale);
  return true;
};
function sendBolt(to, b, color, scale){
  const p = b.mesh.position, d = b.dir;
  send({ t: 'dbl', to, i: ++boltN, p: [r2(p.x), r2(p.y), r2(p.z)], d: [r2(d.x), r2(d.y), r2(d.z)], s: r2(b.speed), m: r2(b.dmg), c: color ?? b.mesh.material.color.getHex(), k: r2(scale || 1), w: worldKey() });
}
// the flamer's stream (player/mando/weapons.js updateFlame): a burn on each foe standing in it, told every flameEvery s
const burn = new Map();   // seat → { d (damage gathered), t (s gathered) }
let burnT = 0;
duelHooks.flame = (aim, range, cosLim, dmg, dt) => {
  if (!fighting() || G.duel.phase !== 'fight') return;
  for (const k of foeSeats()){
    const pos = posOf(k);
    if (!pos || !columnInAim(aim, pos, pos.y, pos.y + R.height, R.body, range, cosLim, 0.12)) continue;
    const c = burn.get(k) || { d: 0, t: 0 };
    c.d += dmg; c.t += dt; burn.set(k, c);
  }
  burnT += dt;
  if (burnT < DUEL_MODE.flameEvery) return;
  burnT = 0;
  const pp = playerPos();
  for (const [k, c] of burn) send({ t: 'dfl', to: k, d: r2(c.d), s: r2(c.t), x: r2(pp.x), y: r2(pp.y + 1.4), z: r2(pp.z) });
  burn.clear();
};

/* ---------------- the defender's side ---------------- */
// a cut on its way at you: where it comes from, its line and when it should land on your screen (the soft directional
// block's auto guard reads it: player/jedi/guardline.js addThreatSource)
const incoming = [];
on('dsw', (m) => {
  if (!forMe(m) || !isFoe(fromOf(m))) return;
  const strike = Math.max(0.05, (+m.d || 0.4) * 0.35 - pvpLinkMs() / 2000);   // (the strike point, less the half of the link it spent getting here)
  incoming.push({ id: m.i, line: m.l, x: +m.x, z: +m.z, t: G.gt + strike, until: G.gt + strike + 0.4 });
  if (incoming.length > 6) incoming.shift();
});
addThreatSource(() => {
  if (!fighting()) return [];
  for (let i = incoming.length - 1; i >= 0; i--) if (incoming[i].until < G.gt) incoming.splice(i, 1);
  return incoming.map(c => ({ line: c.line, x: c.x, z: c.z, t: c.t - G.gt }));   // (t: seconds until it lands, as a foe's wind-up counts down)
});

/* SPLIT THE LINK (data/duel-mode.js lag.rewind): this screen sees the cut a one-way trip after it landed on theirs. The
   guard is judged as it stood part of that trip ago: raised since, it was too late; dropped since, it still held. */
const hist = [];   // { at (ms), block, parry, open, dash }, oldest first
export function pvpTick(){
  if (!fighting()){ hist.length = 0; return; }
  const t = performance.now(), keep = DUEL_MODE.lag.rewind.keep * 1000;
  hist.push({ at: t, block: !!player.blockHeld, parry: player.parryT || 0, open: player.parryOpen || 0, dash: player.dashT || 0 });
  while (hist.length > 2 && hist[0].at < t - keep) hist.shift();
}
export const guardAgo = (ms) => {   // the guard as it stood `ms` ago (null: no history that far back)
  const t = performance.now() - ms;
  for (let i = hist.length - 1; i >= 0; i--) if (hist[i].at <= t) return hist[i];
  return null;
};
const guarding = (s) => s.block || s.parry > 0;
export const rewindMs = (theirShare) => Math.min(DUEL_MODE.lag.rewind.rewindMax * 1000, ((+theirShare || 0) + pvpLinkMs()) / 2 * DUEL_MODE.lag.rewind.share);
function judgeThen(ms, fn){
  const then = ms > 1 ? guardAgo(ms) : null;
  if (!then) return { res: fn(), rw: 0 };
  const nowS = { block: player.blockHeld, parry: player.parryT, open: player.parryOpen, dash: player.dashT };
  const late = guarding(nowS) && !guarding(then), held = !guarding(nowS) && guarding(then);
  const slip = (nowS.dash > 0) !== (then.dash > 0);
  if (!late && !held && !slip) return { res: fn(), rw: 0 };
  if (late || held){ player.blockHeld = then.block; player.parryT = then.parry; player.parryOpen = then.open; }
  if (slip) player.dashT = then.dash > 0 ? Math.max(0.01, then.dash) : 0;
  let res;
  try { res = fn(); }
  finally {
    player.blockHeld = nowS.block;
    if (late) player.parryT = nowS.parry, player.parryOpen = nowS.open;   // (the late guard is still up for the next blow)
    else if (held) player.parryT = 0;
    if (slip) player.dashT = nowS.dash;
  }
  const rw = late && res === 'hit' ? 'late' : held && res !== 'hit' ? 'held' : 0;
  if (rw === 'late') floater(playerPos(), 'TOO LATE', '#ff9a6a');
  return { res, rw };
}

on('dhit', (m) => {
  if (!forMe(m) || !isFoe(fromOf(m)) || G.duel.phase !== 'fight') return;
  const P = partnerPuppet(fromOf(m)), at = P ? P.group.position : V3(+m.x, 0, +m.z);
  const dmg = Math.max(0, Math.min(DUEL_MODE.maxBlow, +m.dm || 0));
  const hp0 = player.hp;
  const { res, rw } = judgeThen(rewindMs(m.k), () => incomingBlow(dmg, V3(at.x, at.y, at.z), 'cut', false, null, { pvp: true, line: m.l || 'H', heavy: !!m.h, noClash: true }));
  const k = (i => i >= 0 ? incoming.splice(i, 1)[0] : null)(incoming.findIndex(c => c.id === m.i));
  cueAfter = { line: (k && k.line) || m.l || 'H', until: G.gt + 0.15 };   // (the cue stays a moment on the line it came in on)
  const out = { t: 'dres', to: fromOf(m), i: m.i, r: res, rw, k: 'cut', w: DUEL_MODE.points.cut, hp: r2(Math.max(0, player.hp) / maxHp()), lost: r2(Math.max(0, hp0 - player.hp)) };
  send(out);
  verdict({ ...out, from: net.slot }, true);
});

/* ANY HERO: a foe's bolt. A fighter it's meant for flies a hostile copy (enemies/bolts.js judges it as it would a foe's: a
   deflect, a parry, the beskar, a block, cover, or a hit) and answers with duelHooks.boltDone below; anyone else in the
   duel's world draws a harmless one */
on('dbl', (m) => {
  const from = fromOf(m), mine = forMe(m) && isFoe(from) && G.duel.phase === 'fight';
  if (!mine && (m.w !== worldKey() || from === net.slot)) return;
  const p = V3(+m.p[0], +m.p[1], +m.p[2]), d = V3(+m.d[0], +m.d[1], +m.d[2]);
  if (!(d.lengthSq() > 0.01)) return;
  fireBolt(p, d, +m.s || 60, mine ? Math.max(0, Math.min(DUEL_MODE.maxBlow, +m.m || 0)) : 0, !mine, !mine);   // (one at you: you hear it fired)
  const b = bolts[bolts.length - 1];
  if (!b) return;
  b.mesh.material.color.setHex(+m.c || 0xff5a3a); const k = +m.k || 1; b.mesh.scale.set(k, k * 1.3, k);
  if (mine) b.pvp = { from, i: m.i };
  else b.ghost = true;
});
// how a foe's bolt went on this screen (enemies/bolts.js): the shooter hears it, and the referee scores it. Turned off a
// blade or a vambrace, it goes back down the line at whoever fired it, as their foe's bolt now
duelHooks.boltDone = (b, res) => {
  if (!b.pvp || b.pvp.sent) return;
  b.pvp.sent = true;
  if (!fighting()) return;
  const out = { t: 'dres', to: b.pvp.from, i: 'b' + b.pvp.i, r: res, k: 'bolt', w: res === 'hit' ? DUEL_MODE.points.bolt : 0, hp: r2(Math.max(0, player.hp) / maxHp()) };
  send(out);
  verdict({ ...out, from: net.slot }, true);
  if (b.friendly && isFoe(b.pvp.from)){ b.pvpOut = true; sendBolt([b.pvp.from], b, null, b.mesh.scale.x); }
};
// a burn from a foe's flamer: no guard holds fire, a dash slips it, cover between stops it
on('dfl', (m) => {
  if (!forMe(m) || !isFoe(fromOf(m)) || G.duel.phase !== 'fight') return;
  const at = V3(+m.x, +m.y, +m.z), pp = playerPos();
  if (blastCovered(at, pp.x, pp.y, pp.z)) return;
  const hp0 = player.hp;
  const res = hurtPlayer(Math.max(0, Math.min(DUEL_MODE.maxBlow, +m.d || 0)), at, true, false, false, { blast: true, flame: true, pvp: true });
  const out = { t: 'dres', to: fromOf(m), i: 'f', r: res, k: 'flame', w: res === 'hit' ? r2(Math.min(1, (+m.s || 0) * DUEL_MODE.points.flamePerS)) : 0,
    hp: r2(Math.max(0, player.hp) / maxHp()), lost: r2(Math.max(0, hp0 - player.hp)) };
  send(out);
  verdict({ ...out, from: net.slot }, true);
  if (res === 'hit' && G.gt - (lastBurnSaid || -9) > 0.6){ lastBurnSaid = G.gt; floater(pp, 'BURNING', '#ff9a4a'); }
});
let lastBurnSaid = -9;

on('dfp', (m) => {
  if (!forMe(m) || !isFoe(fromOf(m)) || G.duel.phase !== 'fight') return;
  if (player.dashT > 0) return void floater(playerPos(), 'SLIPPED IT', '#9fe6ff');   // a dash slips the Force too
  const F = DUEL_MODE.force[m.k === 'pull' ? 'pull' : 'push'], dx = +m.dx || 0, dz = +m.dz || 0;
  if (player.atkT > 0) cancelSwing();
  player.blockHeld = false;
  if (m.k === 'pull'){
    const room = Math.max(0, (+m.d || 0) - F.near);
    const v = Math.min(F.knock, room * 4);
    player.vel.x -= dx * v; player.vel.z -= dz * v;
    floater(playerPos(), 'PULLED', '#7fd4ff');
  } else {
    player.vel.x += dx * F.knock; player.vel.z += dz * F.knock; player.vy = Math.max(player.vy, F.lift); player.grounded = false;
    floater(playerPos(), 'PUSHED', '#7fd4ff');
  }
  player.flinchT = player.flinchMax = Math.max(player.flinchT || 0, F.stagger); player.flinchAt = G.gt;
  player.flinchDir = m.k === 'pull' ? { x: -dx, z: -dz } : { x: dx, z: dz }; player.flinchHeavy = false;
  G.shake = Math.max(G.shake, 0.35);
});

/* ---------------- the verdict ----------------
   Heard by everyone in the duel: the attacker feels it (a clean hit's spark, a parry that throws the cut back and leaves
   them open for the riposte, a block that bounces it), the referee scores it (game/duel-mode.js), and spectators see it. */
const verdictFns = [];
export function onVerdict(fn){ verdictFns.push(fn); }
on('dres', (m) => verdict(m, false));
let lastVerdict = null;
function verdict(m, mine){
  if (!G.duel || !G.duel.pvp) return;
  lastVerdict = { r: m.r, rw: m.rw || 0, mine };
  for (const fn of verdictFns) fn(m, mine);
  if (mine || m.to !== net.slot || !fighting()) return;
  // the attacker's own feel of it
  const pos = posOf(fromOf(m)), pp = playerPos(), f = fwd();
  const cp = pos ? V3((pos.x + pp.x) / 2, 1.4, (pos.z + pp.z) / 2) : V3(pp.x + f.x, 1.4, pp.z + f.z);
  // a gun's bolt or a burn: a light touch, the hit marker's tick (the blade's clash and reel below are a cut's)
  if (m.k === 'bolt' || m.k === 'flame'){
    if (m.r === 'hit' && m.k === 'bolt'){ if (pos) spawnHitSpark(V3(pos.x, pos.y + 1.3, pos.z), 0xffd24a, 0.8); floater(pp, 'HIT', '#ffe27a'); }
    else if (m.r === 'parried' || m.r === 'deflected') floater(pp, m.r === 'parried' ? 'SENT BACK' : 'DEFLECTED', '#bfe8ff');
    else if (m.r === 'blocked') floater(pp, 'BLOCKED', '#bfe8ff');
    return;
  }
  if (m.r === 'hit'){
    if (pos) spawnHitSpark(V3(pos.x, pos.y + 1.3, pos.z), 0xffffff, 1.2);
    S.saberHit(cp, 1, G.stance);
    G.hitstop = Math.max(G.hitstop, 0.05);
    if (G.duel.rule !== 'health') floater(pp, 'CLEAN HIT', '#ffe27a');
  } else if (m.r === 'parried'){
    // parried: the cut is thrown back and you reel, open for their riposte
    if (player.swing && player.atkT > 0) recoilSwing(cp); else clashSparks(cp, 0xffe9b0, 4);
    player.flinchT = player.flinchMax = Math.max(player.flinchT || 0, 0.5); player.flinchAt = G.gt; player.flinchHeavy = true;
    player.queuedAtk = false;
    clashFlash(cp, 0xffd24a, true); S.parry(cp);
    floater(pp, 'PARRIED', '#ffb84a');
  } else if (m.r === 'blocked' || m.r === 'clashed'){
    if (player.swing && player.atkT > 0) recoilSwing(cp);
    S.clash(cp, false, G.stance);
    floater(pp, m.r === 'clashed' ? 'CLASHED' : 'BLOCKED', '#bfe8ff');
  } else if (m.r === 'none') floater(pp, 'MISSED', '#bfe8ff');
}

// the soonest cut on its way at this fighter: { line, t (s until it lands, < 0 once it should have) } or null (ui/duel-ui.js)
let cueAfter = null;
export function pvpIncoming(){
  if (!fighting() || G.duel.phase !== 'fight') return null;
  let best = null;
  for (const c of incoming) if (c.until >= G.gt && (!best || c.t < best.t)) best = c;
  if (best) return { line: best.line, t: best.t - G.gt };
  return cueAfter && cueAfter.until > G.gt ? { line: cueAfter.line, t: 0 } : null;
}
// the smoke test's look at the judging (tools/smoke/coop-duel.mjs): a plain cut from the other fighter, judged as it
// stood `ms` ago, taking no health
export function pvpTestBlow(ms){
  const pos = posOf(foeSeats()[0]); if (!pos) return null;
  const hp = player.hp, out = judgeThen(ms, () => incomingBlow(1, V3(pos.x, pos.y, pos.z), 'cut', false, null, { pvp: true, line: 'H', noClash: true }));
  player.hp = hp;
  return out;
}
export const pvpInfo = () => ({ incoming: incoming.length, link: pvpLinkMs(), hist: hist.length, last: lastVerdict });
