// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// PLAYER AGAINST PLAYER (duel mode, step 1 of the duel plan): one player's saber, push or pull aimed at another player.
// The co-op link already shows each hero to the other (net/partner.js, net/pose.js); this adds the blows between them.
//   dsw   a cut has STARTED: sent the instant it starts, with a timestamp, not on the 50 ms pose update, so the other
//         screen knows a blow is coming (and on which line) as early as the link allows
//   dhit  the blade REACHED them on the attacker's screen (the blade sweep found their body: player/jedi/bladehit.js)
//   dres  the DEFENDER's verdict. Their own screen judges the blow through the same incoming-blow path a foe's blow takes
//         (net/foefire.js incomingBlow → player/damage.js): block, parry, dodge or hit. If you parried on your screen,
//         it counts. Everyone in the duel's world hears the verdict: the attacker for the feel, the referee for the score
//   dfp   a Force push or pull caught them
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

const r2 = (n) => Math.round(n * 100) / 100;
const fromOf = (m) => m.from || 0;   // (the host's own messages carry no seat: it is seat 0)
let swingN = 0;
const R = { body: 0.42, height: 1.9 };   // the other fighter as the blade sweep sees them: an upright capsule

// the duel this screen is FIGHTING in (not watching), and the other fighter's seat
const fighting = () => !!(G.duel && G.duel.pvp && G.duel.fighting);
const foeSeat = () => G.duel.foe;
const foePos = () => { const P = partnerPuppet(foeSeat()); return P && P.group.visible ? P.group.position : null; };
export const pvpLinkMs = () => net.role === 'host' ? 0 : net.ping;   // this screen's share of the link between the two fighters

/* ---------------- the attacker's side ---------------- */
// the other fighter's body, one object per seat so the sweep's "already cut" set holds across frames
const bodies = new Map();
duelHooks.bodies = () => {
  if (!fighting() || G.duel.phase !== 'fight') return [];
  const pos = foePos();
  if (!pos) return [];
  let b = bodies.get(foeSeat());
  if (!b){ b = { duelBody: true, slot: foeSeat(), pos: new THREE.Vector3(), r: R.body, h: R.height }; bodies.set(foeSeat(), b); }
  b.pos.copy(pos);
  return [b];
};

duelHooks.swingStart = (sw) => {
  if (!fighting()) return;
  sw.pvpId = ++swingN;
  const pp = playerPos();
  send({ t: 'dsw', to: foeSeat(), i: sw.pvpId, at: Math.round(performance.now()), d: r2(sw.dur), l: lineOf(sw), h: sw.heavy || sw.charging ? 1 : 0, x: r2(pp.x), z: r2(pp.z) });
};
const lineOf = (sw) => (sw && sw.pat && (sw.pat.line || (sw.pat.h === 'low' ? 'Lo' : sw.pat.yF < -0.5 ? 'L' : sw.pat.yF > 0.5 ? 'R' : 'H'))) || 'H';

duelHooks.swingHit = (body, b) => {
  if (!fighting() || G.duel.phase !== 'fight') return;
  const sw = player.swing, pp = playerPos();
  if (sw && sw.pvpSent) return;   // one verdict per cut
  if (sw) sw.pvpSent = true;
  send({ t: 'dhit', to: body.slot, i: sw && sw.pvpId || ++swingN, at: Math.round(performance.now()), dm: r2(b.dmg), l: b.line || 'H', f: b.finisher ? 1 : 0, r: b.riposte ? 1 : 0, h: b.heavy ? 1 : 0, x: r2(pp.x), z: r2(pp.z) });
};

/* a push or a pull: does its cone have the other fighter in it (on this screen, where you aimed it)? */
duelHooks.power = (kind, aim, A) => {
  if (!fighting() || G.duel.phase !== 'fight') return;
  const pos = foePos(); if (!pos) return;
  const pp = playerPos(), dx = pos.x - pp.x, dz = pos.z - pp.z, d = Math.hypot(dx, dz);
  if (d > A.range + 0.5 || d < 0.05) return;
  const ax = aim.dir.x, az = aim.dir.z, al = Math.hypot(ax, az) || 1;
  if ((dx * ax + dz * az) / (d * al) < Math.cos(A.angle) - 0.1) return;
  send({ t: 'dfp', to: foeSeat(), k: kind, dx: r2(dx / d), dz: r2(dz / d), d: r2(d) });
};

/* ---------------- the defender's side ---------------- */
// a cut on its way at you: where it comes from, its line and when it should land on your screen (the soft directional
// block's auto guard reads it: player/jedi/guardline.js addThreatSource)
const incoming = [];
on('dsw', (m) => {
  if (!fighting() || m.to !== net.slot || fromOf(m) !== foeSeat()) return;
  const strike = Math.max(0.05, (+m.d || 0.4) * 0.35 - pvpLinkMs() / 2000);   // (the strike point, less the half of the link it spent getting here)
  incoming.push({ id: m.i, line: m.l, x: +m.x, z: +m.z, t: G.gt + strike, until: G.gt + strike + 0.4 });
  if (incoming.length > 6) incoming.shift();
});
addThreatSource(() => {
  if (!fighting()) return [];
  for (let i = incoming.length - 1; i >= 0; i--) if (incoming[i].until < G.gt) incoming.splice(i, 1);
  return incoming.map(c => ({ line: c.line, x: c.x, z: c.z, t: c.t - G.gt }));   // (t: seconds until it lands, as a foe's wind-up counts down)
});

on('dhit', (m) => {
  if (!fighting() || m.to !== net.slot || fromOf(m) !== foeSeat() || G.duel.phase !== 'fight') return;
  const P = partnerPuppet(fromOf(m)), at = P ? P.group.position : V3(+m.x, 0, +m.z);
  const dmg = Math.max(0, Math.min(DUEL_MODE.maxBlow, +m.dm || 0));
  const hp0 = player.hp;
  const res = incomingBlow(dmg, V3(at.x, at.y, at.z), 'cut', false, null, { pvp: true, line: m.l || 'H', heavy: !!m.h, noClash: true });
  const k = (i => i >= 0 ? incoming.splice(i, 1) : null)(incoming.findIndex(c => c.id === m.i));
  const out = { t: 'dres', to: fromOf(m), i: m.i, r: res, hp: r2(Math.max(0, player.hp) / maxHp()), lost: r2(Math.max(0, hp0 - player.hp)) };
  send(out);
  verdict({ ...out, from: net.slot }, true);
});

on('dfp', (m) => {
  if (!fighting() || m.to !== net.slot || fromOf(m) !== foeSeat() || G.duel.phase !== 'fight') return;
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
function verdict(m, mine){
  if (!G.duel || !G.duel.pvp) return;
  for (const fn of verdictFns) fn(m, mine);
  if (mine || m.to !== net.slot || !fighting()) return;
  // the attacker's own feel of it
  const pos = foePos(), pp = playerPos(), f = fwd();
  const cp = pos ? V3((pos.x + pp.x) / 2, 1.4, (pos.z + pp.z) / 2) : V3(pp.x + f.x, 1.4, pp.z + f.z);
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
  } else if (m.r === 'none') floater(pp, 'MISSED', '#bfe8ff');
}

export const pvpInfo = () => ({ incoming: incoming.length, link: pvpLinkMs() });
