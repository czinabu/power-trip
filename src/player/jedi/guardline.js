// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Your guard on their line: the held block meets a duellist's strike where it's coming in, and a clean parry sets the
// riposte up on the side it left open (data/duel.js GUARD_LINE).
//
// THE GUARD TURNS (data/duel-guard.js GUARD_TURN) — the soft directional block. The guard covers one line at a time.
// Held, it goes on its own to the line of the soonest strike winding up at you, but a beat late (`react`, then `turn`),
// so a strike that switches sides late (a feint, a quick string, a riposte) can find it still on the old side: that
// blow is BEATEN (it still holds, at a heavy cost). Flick the mouse or the right stick toward the side the blow comes
// from while you hold the guard and it goes there at once, and a blow on a guard you placed is a CLEAN block. A blow
// with no line (a trooper's chop, a brute, a bolt) and a guard that has seen nothing coming are judged as before: the
// guard holds whatever the side. Run on every screen for its own hero; the guard's state rides in the pose (net/pose.js).

import * as THREE from 'three';
import { GUARD_LINE } from '../../data/duel.js';
import { GUARD_TURN, DUEL_PVP } from '../../data/duel-guard.js';
import { CUT_ANGLE, SWING_PATTERNS } from '../../data/stances.js';
import { G, enemies, player, isGunner } from '../../state.js';
import { scene } from '../../engine/renderer.js';
import { playerPos, fwd } from '../helpers.js';
import { localPlayer } from '../players.js';
import { netStrikeLine } from '../../enemies/duel.js';
import { pvpOn } from '../../game/pvp-rules.js';
import { stamDelay } from '../stamina.js';
import { clamp, dampToward } from '../../utils.js';

const LINES = ['R', 'L', 'H', 'Lo'];   // the lines the guard covers (a thrust, T, is parry-or-dodge: no guard holds it)
const RING_ANG = { R: 0, L: Math.PI, H: Math.PI / 2, Lo: -Math.PI / 2 };   // where the crescent sits for each (its right comes in on your left)

/* where a strike from a foe's side arrives on you, as the catch picker reads it (anim/saber.js pickDeflect): side + is
   your weapon side (right), h against the chest. The foe faces you, so its right comes in on your left. */
export function lineCatch(line){
  return GUARD_LINE.catch[line] || null;
}

/* ---------------- the guard's state ---------------- */
// line: the line it covers now (null: nothing seen coming, it holds anywhere) · to: the line it is turning to · goT: when
// that turn starts (after the react delay) · dur: how long the turn takes · manual: placed by hand, until `until`
const GD = { line: null, to: null, goT: 0, dur: 0, manual: false, until: 0, flash: 0, flashCol: 0, heldFor: 0, quietT: 0 };
const now = () => G.gt;
const reactOf = () => GUARD_TURN.react[G.diff] ?? GUARD_TURN.react.knight;

// the turn's progress (0 … 1), or 1 when not turning
function turnK(){
  if (!GD.to) return 1;
  if (now() < GD.goT) return 0;
  return GD.dur > 0 ? clamp((now() - GD.goT) / GD.dur, 0, 1) : 1;
}
function startTurn(to, manual){
  if (!to) return;
  if (manual){ GD.manual = true; GD.until = now() + GUARD_TURN.hold; }
  if (!GD.line && !GD.to){ GD.line = to; return; }   // a guard that was waiting on nothing is simply there
  if (GD.to === to){   // already on its way there: a hand on it hurries it
    if (manual){ GD.goT = Math.min(GD.goT, now()); GD.dur = Math.min(GD.dur, GUARD_TURN.manual); }
    return;
  }
  if (GD.line === to){ GD.to = null; return; }   // back to the line it is still on: the turn is called off
  GD.to = to;
  GD.goT = now() + (manual ? 0 : reactOf());
  GD.dur = manual ? GUARD_TURN.manual : GUARD_TURN.turn;
  if (!manual) GD.manual = false;
}
function settle(){
  if (GD.to && turnK() >= 1){ GD.line = GD.to; GD.to = null; }
}
function dropGuard(){ GD.line = null; GD.to = null; GD.manual = false; GD.heldFor = 0; GD.quietT = 0; }

/* ---------------- what the guard watches ---------------- */
// the soonest strike winding up at this hero, close and in front: { line, foe } or null. A duellist's own (enemies),
// a host's duellist on a co-op guest (its snapshot's wind-up line), and anything a mode adds (addThreatSource: a
// player's opponent in a sparring duel)
const sources = [];
export function addThreatSource(fn){ if (!sources.includes(fn)) sources.push(fn); }
function threat(){
  const pp = playerPos(), f = fwd(), R = GUARD_TURN.range;
  let best = null, bt = Infinity;
  const take = (line, x, z, t) => {
    if (!line) return;
    const dx = x - pp.x, dz = z - pp.z, d = Math.hypot(dx, dz);
    if (d > R || (d > 0.5 && (dx * f.x + dz * f.z) / d < 0.2)) return;
    if (t < bt){ bt = t; best = line; }
  };
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    if (e.net){
      const L = netStrikeLine(e);
      if (L) take(L, e.group.position.x, e.group.position.z, e.state === 'strike' ? -1 : 0);
      continue;
    }
    if (!e.dp || e.dp.brace || !e.plan) continue;
    if (e.state !== 'windup' && e.state !== 'strike') continue;
    if (e.hero && e.hero !== localPlayer) continue;
    take(e.plan.side, e.group.position.x, e.group.position.z, e.state === 'strike' ? -1 : e.st);
  }
  for (const fn of sources){
    const list = fn() || [];
    for (const s of list) take(s.line, s.x, s.z, s.t ?? 0);
  }
  return best;
}
// the line of the soonest strike in front (any kind: the old held-catch's read, kept for anyone who asks)
export const threatLine = () => threat();

/* ---------------- steering it by hand ---------------- */
// a hard flick of the mouse or the right stick while the guard is held (engine/input.js and engine/gamepad.js feed
// every look move through cutaim.js noteFlick; this reads the same motion, whatever the CUT AIM setting)
const FL = { x: 0, y: 0, at: -9 };
export function noteGuardFlick(dx, dy){
  const t = performance.now() / 1000, k = Math.exp(-(t - FL.at) / CUT_ANGLE.flick.tau);
  FL.x = FL.x * k + dx; FL.y = FL.y * k + dy; FL.at = t;
  if (!player.blockHeld || isGunner() || player.saberLock || G.mode !== 'play') return;
  if (Math.hypot(FL.x, FL.y) < CUT_ANGLE.flick.min * GUARD_TURN.flick) return;
  if (!duellistNear()) return;   // looking round a crowd with the guard up isn't steering it
  // the blade goes the way the hand went: left covers your left (the line its RIGHT comes in on), up covers the head
  const line = Math.abs(FL.x) >= Math.abs(FL.y) * 0.8 ? (FL.x < 0 ? 'R' : 'L') : FL.y < 0 ? 'H' : 'Lo';
  FL.x = FL.y = 0;
  startTurn(line, true);
}
// a duellist (or a sparring partner) close in front: only then does a flick steer the guard
function duellistNear(){
  const pp = playerPos(), f = fwd(), R = GUARD_TURN.range + 1;
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    if (!(e.dp || (e.net && e.ng))) continue;
    const dx = e.group.position.x - pp.x, dz = e.group.position.z - pp.z, d = Math.hypot(dx, dz);
    if (d < R && (d < 0.5 || (dx * f.x + dz * f.z) / d > 0.2)) return true;
  }
  for (const fn of sources) if ((fn() || []).length) return true;
  return !!player.lockTarget;
}

/* ---------------- a blow meets it ---------------- */
/* how the guard meets a blow on `line`: 'clean' (on the line you placed it on), 'covered' (on its line, or no line to
   judge), or 'beaten' (it is on another side, or still on its way). Called by player/damage.js as a held guard takes a
   duellist's (or a sparring partner's) strike. */
export function guardMeets(line){
  if (!line || !LINES.includes(line) || isGunner()) return 'covered';
  settle();
  const on = GD.line, to = GD.to, k = turnK();
  if (!on && !to) return 'covered';   // it saw nothing coming: it holds wherever, as it always has
  const covers = (to ? (to === line && k >= GUARD_TURN.catchAt) || (on === line && k < 0.25) : on === line);
  if (!covers) return 'beaten';
  return GD.manual ? 'clean' : 'covered';
}
// the crescent flares for a beat when a blow meets it (the colour says how: clean gold, beaten red)
export function guardFlash(kind){
  GD.flash = 1;
  GD.flashCol = kind === 'clean' ? GUARD_TURN.ring.clean : kind === 'beaten' ? GUARD_TURN.ring.beaten : GUARD_TURN.ring.colour;
  GD.quietT = 0;
}

/* the guard's state for the pose sync (net/pose.js): [line (0 R · 1 L · 2 H · 3 Lo, −1 none), turning to (the same, −1
   none), turn progress 0 … 100, placed by hand 0 / 1]. Null: no guard up. */
export function guardState(){
  if (!player.blockHeld || isGunner()) return null;
  return [LINES.indexOf(GD.line), LINES.indexOf(GD.to), Math.round(turnK() * 100), GD.manual ? 1 : 0];
}

/* ---------------- each frame ---------------- */
/* Holding the guard: it follows the soonest strike's line (a beat late), or stays where you placed it for a moment; the
   blade goes to meet that line (a held catch on the deflect poses) and the crescent shows where it is. A sparring duel
   charges a little stamina for a guard held with nothing hitting it (DUEL_PVP.upkeep). */
export function updateGuardLine(dt = 0){
  const d = player.deflectAnim;
  const held = d && d.hold;
  const up = !isGunner() && player.blockHeld && player.atkT <= 0 && !player.saberLock;
  if (!up){
    if (held) player.deflectAnim = null;
    // let go a moment (a re-press for a parry) and the guard is still where it was: it doesn't snap to the new line
    if (!player.blockHeld && (GD.downT = (GD.downT || 0) + dt) > 0.5) dropGuard();
    drawRing(dt, false); return;
  }
  GD.downT = 0;
  GD.heldFor += dt; GD.quietT += dt;
  const want = threat();
  if (want && LINES.includes(want) && !(GD.manual && now() < GD.until)) startTurn(want, false);
  if (GD.manual && now() >= GD.until) GD.manual = false;
  settle();
  if (pvpOn() && GD.heldFor > DUEL_PVP.upkeepAfter && GD.quietT > 0.5 && player.stam > 0){   // a sparring duel: turtling costs
    player.stam = Math.max(0, player.stam - DUEL_PVP.upkeep * dt); player.stamDelay = Math.max(player.stamDelay || 0, stamDelay() * 0.5);
  }
  drawRing(dt, true);
  // where the blade waits: the line it is on, or (turning) the line it is going to once the turn has begun
  const line = GD.to && now() >= GD.goT ? GD.to : GD.line;
  if (!line){ if (held) player.deflectAnim = null; return; }
  if (d && !held) return;   // a real catch (a bolt, a blow) is playing out: it hands back to the held line after
  if (held && d.line === line) return;
  const c = lineCatch(line);
  if (!c) return;
  player.deflectAnim = { t: 0, dur: 99, pose: null, side: c.side, h: c.h, hold: true, line };
}

/* ---------------- the crescent on your guard ----------------
   A pale arc in front of the hero on the covered side (the same shape a duellist's guard shows), only while a
   duellist is close: dim while it is still turning, gold while placed by hand, flaring as a blow meets it. */
let ring = null;
function makeRing(){
  const grp = new THREE.Group();
  const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.0, 20, 1, -0.75, 1.5), new THREE.MeshBasicMaterial({ color: GUARD_TURN.ring.colour,
    transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.renderOrder = 5;
  grp.add(m); grp.userData.arc = m; grp.visible = false;
  scene.add(grp);
  return grp;
}
const _c = new THREE.Color();
function drawRing(dt, up){
  GD.flash = Math.max(0, GD.flash - dt * 3);
  const show = up && !player.holstered && (GD.line || GD.to) && duellistNear();
  if (!ring){ if (!show) return; ring = makeRing(); }
  const arc = ring.userData.arc, mat = arc.material;
  const want = show ? 0.6 + GD.flash * 0.4 : 0;
  mat.opacity = dampToward(mat.opacity, want, dt, 12);
  ring.visible = mat.opacity > 0.01;
  if (!ring.visible) return;
  const pp = playerPos(), f = fwd(), T = GUARD_TURN.ring;
  ring.position.set(pp.x + f.x * T.fwd, pp.y + T.up, pp.z + f.z * T.fwd);
  ring.rotation.set(0, Math.atan2(f.x, f.z), 0);
  // the arc's side: the covered line's, swinging across toward the line it is turning to
  const from = RING_ANG[GD.line] ?? RING_ANG[GD.to] ?? Math.PI / 2, to = RING_ANG[GD.to] ?? from, k = GD.to ? turnK() : 1;
  const a = GD.to ? from + wrap(to - from) * k : from;
  arc.rotation.z = dampToward(arc.rotation.z, a, dt, 18);
  _c.setHex(GD.flash > 0.05 ? GD.flashCol : GD.to && k < 1 ? T.turning : GD.manual ? T.clean : T.colour);
  mat.color.lerp(_c, Math.min(1, dt * 14));
}
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/* the riposte after a clean parry of a duellist's strike from `line`: cut back in on the side it came from (its weapon
   has gone across and left that side open), or under an overhead with a thrust */
export function ripostePattern(line){
  const id = GUARD_LINE.riposte[line];
  return id ? SWING_PATTERNS[id] : null;
}
