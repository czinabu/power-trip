// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Your guard on their line: the held block meets a duellist's strike where it's coming in, and a clean parry sets the
// riposte up on the side it left open (data/duel.js GUARD_LINE).
//
// THE GUARD TURNS (data/duel-guard.js GUARD_TURN) — the soft directional block. The guard covers one line at a time.
// Held, it goes on its own to the line of the soonest strike winding up at you, a beat late on the first strike of an
// attack (`react`, then `turn`), at once on the cuts that follow it in a string, and too late on a FEINT (the line
// switches mid wind-up: `fooled`): that blow is BEATEN (it still holds, at a heavy cost). Steer it the way you aim a cut:
// flick the mouse or the right stick toward the side the blow comes from, or press that direction (A / D / W / S, the
// left stick) while you hold the guard, and it goes there at once; a blow on a guard you placed is a CLEAN block. THE STRIKE MARK (GUARD_TURN.mark) shows which side that is and when the blow lands. A blow
// with no line (a trooper's chop, a brute, a bolt) and a guard that has seen nothing coming are judged as before: the
// guard holds whatever the side. Run on every screen for its own hero; the guard's state rides in the pose (net/pose.js).

import * as THREE from 'three';
import { GUARD_LINE } from '../../data/duel.js';
import { GUARD_TURN, DUEL_PVP } from '../../data/duel-guard.js';
import { CUT_ANGLE, SWING_PATTERNS } from '../../data/stances.js';
import { G, enemies, keys, player, isGunner } from '../../state.js';
import { scene } from '../../engine/renderer.js';
import { playerPos, fwd } from '../helpers.js';
import { localPlayer } from '../players.js';
import { netStrikeLine } from '../../enemies/duel.js';
import { pvpOn } from '../../game/pvp-rules.js';
import { stamDelay } from '../stamina.js';
import { clamp, dampToward } from '../../utils.js';
import { sfx } from '../../audio/sfx.js';

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
const GD = { line: null, to: null, goT: 0, dur: 0, manual: false, until: 0, flash: 0, flashCol: 0, heldFor: 0, quietT: 0, mRec: null, mSeq: 0, cueAt: -9 };
const now = () => G.gt;
const reactOf = () => GUARD_TURN.react[G.diff] ?? GUARD_TURN.react.knight;

// the turn's progress (0 … 1), or 1 when not turning
function turnK(){
  if (!GD.to) return 1;
  if (now() < GD.goT) return 0;
  return GD.dur > 0 ? clamp((now() - GD.goT) / GD.dur, 0, 1) : 1;
}
function startTurn(to, manual, delay = reactOf()){
  if (!to) return;
  // (placed by hand: it answers the strike showing now; the next one hands it back to the automatic guard)
  if (manual){
    GD.manual = true; GD.until = now() + GUARD_TURN.hold; GD.mRec = TH && TH.rec || null; GD.mSeq = TH && TH.rec ? TH.rec.seq : 0;
    GD.flash = Math.max(GD.flash, GUARD_TURN.ring.placed); GD.flashCol = GUARD_TURN.ring.clean;   // the crescent answers your hand: a gold pulse as it goes
  }
  if (!GD.line && !GD.to){ GD.line = to; return; }   // a guard that was waiting on nothing is simply there
  if (GD.to === to){   // already on its way there: a hand on it hurries it
    if (manual){ GD.goT = Math.min(GD.goT, now()); GD.dur = Math.min(GD.dur, GUARD_TURN.manual); }
    return;
  }
  if (GD.line === to){ GD.to = null; return; }   // back to the line it is still on: the turn is called off
  GD.to = to;
  GD.goT = now() + (manual ? 0 : delay);
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
/* what each duellist near you has been doing, so the guard knows what kind of strike this is (GUARD_TURN react / string
   / fooled). Read off its state and its line alone, so it is the same for a host's own foes and a guest's puppets:
     seq     counts the lines it has shown (a new wind-up, the next cut of a string, a feint's switch)
     struck  when it was last seen mid-strike (a wind-up soon after is the next cut of a string, or an exchange's beat)
     feint   when its line last switched in the middle of a wind-up */
const seen = new WeakMap();
function track(e, line, striking){
  let r = seen.get(e);
  if (!r) seen.set(e, r = { line: null, wind: false, seq: 0, struck: -9, feint: -9 });
  const t = now();
  if (striking) r.struck = t;
  if (line !== r.line){
    if (line){ r.seq++; r.feint = r.wind && !striking && r.line ? t : -9; }
    r.line = line;
  }
  r.wind = !!line && !striking;
  return r;
}
const kindOf = r => !r ? 'first' : now() - r.feint < 0.9 ? 'feint' : now() - r.struck < 1.2 ? 'string' : 'first';
const delayOf = th => { const k = kindOf(th.rec); return k === 'string' ? GUARD_TURN.string : k === 'feint' ? (GUARD_TURN.fooled[G.diff] ?? GUARD_TURN.fooled.knight) : reactOf(); };
// { line, rec, eta } of the soonest strike in front (eta: s until it lands, null when only its line is known), or null
let TH = null;
function threat(){
  const pp = playerPos(), f = fwd(), R = GUARD_TURN.range;
  let best = null, bt = Infinity;
  const take = (line, x, z, t, rec, eta) => {
    if (!line) return;
    const dx = x - pp.x, dz = z - pp.z, d = Math.hypot(dx, dz);
    if (d > R || (d > 0.5 && (dx * f.x + dz * f.z) / d < 0.2)) return;
    if (t < bt){ bt = t; best = { line, rec: rec || null, eta: eta ?? null }; }
  };
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    const striking = e.state === 'strike';
    if (e.net){
      if (!e.ng) continue;
      const L = netStrikeLine(e), rec = track(e, L, striking);
      if (L) take(L, e.group.position.x, e.group.position.z, striking ? -1 : 0, rec);
      continue;
    }
    if (!e.dp || e.dp.brace) continue;
    const mine = e.plan && (e.state === 'windup' || striking) && !(e.hero && e.hero !== localPlayer);
    const rec = track(e, mine ? e.plan.side : null, striking);
    if (!mine) continue;
    // when it lands: the rest of the wind-up, then the strike up to the blow (enemies/ai.js)
    const sw = (e.t.swing || 0.16) * (e.plan.swingMul || 1), hit = sw * (e.plan.hitK || 0.5);
    const eta = striking ? (e.struck ? 0 : Math.max(0, hit - ((e.swDur || sw) - Math.max(e.st, 0)))) : Math.max(e.st, 0) + hit;
    take(e.plan.side, e.group.position.x, e.group.position.z, striking ? -1 : e.st, rec, eta);
  }
  for (const fn of sources){
    const list = fn() || [];
    for (const s of list) take(s.line, s.x, s.z, s.t ?? 0, null, s.t != null ? Math.max(0, s.t) : null);   // (a duel's incoming cut knows when it lands: net/pvp.js)
  }
  return best;
}
// the line of the soonest strike in front (any kind: the old held-catch's read, kept for anyone who asks)
export const threatLine = () => { const t = threat(); return t ? t.line : null; };

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
/* THE SAME KEYS AS A CUT — a direction pressed while the guard is held (or just as it goes up: within `keyLead` s)
   places it the way a flick does: A your left, D your right, W overhead, S the legs. The left stick does the same on
   a pad (engine/gamepad.js feeds it as these keys). A direction already held as the guard goes up is only you
   moving: the guard stays automatic until you press one. */
const KEY_LINE = { w: 'H', s: 'Lo', a: 'R', d: 'L' };   // (a pad's diagonal presses two at once: the side wins)
const KD = { w: false, s: false, a: false, d: false, last: null, at: -9, wasUp: false };
function keySteer(up){
  let fresh = null;
  for (const k in KEY_LINE){
    const on = !!keys[k];
    if (on && !KD[k]){ fresh = k; KD.last = k; KD.at = now(); }
    KD[k] = on;
  }
  const raised = up && !KD.wasUp;
  KD.wasUp = up;
  if (!up || G.mode !== 'play') return;
  const k = fresh || (raised && KD.last && keys[KD.last] && now() - KD.at < GUARD_TURN.keyLead ? KD.last : null);
  if (k && duellistNear()) startTurn(KEY_LINE[k], true);
}
// a duellist (or a sparring partner) close in front: only then does a flick or a key steer the guard
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

/* the guard as the HUD's dial draws it round the crosshair (ui/hud.js, beside the cut dial): the line the blade is on or
   going to, whether it is still turning, whether you placed it by hand, and the pulse as it is placed or struck. Null:
   no guard up, or no duellist near to guard against. */
export function guardDial(){
  if (!GD.shown || !player.blockHeld) return null;
  const line = GD.to && now() >= GD.goT ? GD.to : GD.line || GD.to;
  return line ? { line, turning: !!GD.to && turnK() < 1, placed: GD.manual, flash: GD.flash } : null;
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
  // RMB still down after a cut made from behind the guard (a riposte, the real cut after a feint: engine/input.js): the
  // guard comes back up on its own once the cut is done
  if (player.guardBack && !player.blockHeld && player.atkT <= 0){
    if (player.guardKey && !isGunner() && !player.exhausted && !(player.gbT > 0) && G.mode === 'play'){ player.blockHeld = true; player.blockT = 0; }
    player.guardBack = false;
  }
  const up = !isGunner() && player.blockHeld && player.atkT <= 0 && !player.saberLock;
  const th = TH = isGunner() ? null : threat();
  if (!up){
    keySteer(false);
    if (held) player.deflectAnim = null;
    // let go a moment (a re-press for a parry) and the guard is still where it was: it doesn't snap to the new line
    if (!player.blockHeld && (GD.downT = (GD.downT || 0) + dt) > 0.5) dropGuard();
    drawRing(dt, false, th); return;
  }
  GD.downT = 0;
  GD.heldFor += dt; GD.quietT += dt;
  keySteer(true);
  const want = th && th.line;
  // (a guard placed by hand stays put for the strike it was placed against; a new strike or a switch of line is the automatic guard's again)
  const placed = GD.manual && now() < GD.until && th && GD.mRec === th.rec && GD.mSeq === (th.rec ? th.rec.seq : 0);
  if (want && LINES.includes(want) && !placed) startTurn(want, false, delayOf(th));
  if (GD.manual && now() >= GD.until) GD.manual = false;
  settle();
  if (pvpOn() && GD.heldFor > DUEL_PVP.upkeepAfter && GD.quietT > 0.5 && player.stam > 0){   // a sparring duel: turtling costs
    player.stam = Math.max(0, player.stam - DUEL_PVP.upkeep * dt); player.stamDelay = Math.max(player.stamDelay || 0, stamDelay() * 0.5);
  }
  drawRing(dt, true, th);
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
const additive = (geo, color) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0,
  side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false })); m.renderOrder = 6; return m; };
function makeRing(){
  const grp = new THREE.Group();
  const m = new THREE.Mesh(new THREE.RingGeometry(0.955, 1.0, 24, 1, -0.75, 1.5), new THREE.MeshBasicMaterial({ color: GUARD_TURN.ring.colour,
    transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.renderOrder = 5;
  // THE STRIKE MARK: a wedge outside the crescent (a blow on a line), a small ring on the middle (a thrust)
  const mark = additive(new THREE.RingGeometry(1.0, 1.3, 20, 1, -0.5, 1.0), GUARD_TURN.mark.open);
  const pip = additive(new THREE.RingGeometry(0.26, 0.34, 28), GUARD_TURN.mark.thrust);
  grp.add(m, mark, pip); grp.userData.arc = m; grp.userData.mark = mark; grp.userData.pip = pip; grp.visible = false;
  scene.add(grp);
  return grp;
}
// the strike mark follows the GUARD RINGS setting (data/guard-rings.js): Master reads the blade unless it is on ALWAYS
const markOn = () => (G.guardRings || 'fading') !== 'off' && (G.diff !== 'master' || G.guardRings === 'always');
// is the guard on `line` right now (as guardMeets would judge a blow landing this instant)?
function covers(line){
  if (!player.blockHeld || player.atkT > 0) return false;
  const k = turnK();
  return GD.to ? (GD.to === line && k >= GUARD_TURN.catchAt) || (GD.line === line && k < 0.25) : GD.line === line;
}
const _c = new THREE.Color();
function drawRing(dt, up, th){
  GD.flash = Math.max(0, GD.flash - dt * 3);
  const show = up && !player.holstered && (GD.line || GD.to) && duellistNear();
  GD.shown = !!show;
  const marked = !!th && markOn() && G.mode === 'play' && !player.downed && !player.saberLock && !G.cutscene;
  if (!ring){ if (!show && !marked) return; ring = makeRing(); }
  const arc = ring.userData.arc, mat = arc.material, mark = ring.userData.mark, pip = ring.userData.pip;
  const faint = GUARD_TURN.ring.faint, want = show ? faint + GD.flash * (1 - faint) : 0;   // (your own guard: a thin faint arc that only brightens on a blow, so it never hides the blade coming in)
  mat.opacity = dampToward(mat.opacity, want, dt, 12);
  drawMark(dt, marked ? th : null, mark, pip);
  arc.visible = mat.opacity > 0.01;
  ring.visible = arc.visible || mark.visible || pip.visible;
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
/* the strike mark for threat `th` (null: fade it out): on the line's side, closing from `from`× the crescent's radius to
   `rest`× as the blow nears (a line known without its timing, a guest's puppet or a sparring partner, sits part way and
   pulses); orange while that side is open, pale once the guard covers it; a feint's switch flashes it white, throws it
   out and ticks twice */
function drawMark(dt, th, mark, pip){
  const M = GUARD_TURN.mark, thrust = !!th && th.line === 'T', on = !!th && !thrust && RING_ANG[th.line] != null;
  const m = thrust ? pip : mark, other = thrust ? mark : pip;
  other.material.opacity = dampToward(other.material.opacity, 0, dt, 20); other.visible = other.material.opacity > 0.01;
  if (!on && !thrust){ m.material.opacity = dampToward(m.material.opacity, 0, dt, 20); m.visible = m.material.opacity > 0.01; return; }
  const sinceFeint = th.rec ? now() - th.rec.feint : 9;
  if (th.rec && sinceFeint < 0.12 && GD.cueAt !== th.rec.feint){   // the switch, once: a sharp double tick
    GD.cueAt = th.rec.feint;
    sfx(1750, 0.045, 'square', 0.05, 1200); setTimeout(() => sfx(2300, 0.05, 'square', 0.05, 1500), 70);
  }
  const pop = Math.max(0, 1 - sinceFeint / 0.22);
  const near = th.eta == null ? 0.35 + 0.08 * Math.sin(now() * 14) : clamp(th.eta / M.lead, 0, 1);
  const s = thrust ? 1 + near * 2.2 : M.rest + (M.from - M.rest) * near + M.pop * pop;
  m.scale.setScalar(s);
  if (!thrust) m.rotation.z = pop > 0 || m.material.opacity < 0.05 ? RING_ANG[th.line] : dampToward(m.rotation.z, m.rotation.z + wrap(RING_ANG[th.line] - m.rotation.z), dt, 30);
  _c.setHex(pop > 0 ? M.feint : thrust ? M.thrust : covers(th.line) ? M.covered : M.open);
  m.material.color.lerp(_c, Math.min(1, dt * 22));
  m.material.opacity = dampToward(m.material.opacity, 0.7 + 0.3 * (1 - near) + 0.3 * pop, dt, 24);
  m.visible = true;
}
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/* the riposte after a clean parry of a duellist's strike from `line`: cut back in on the side it came from (its weapon
   has gone across and left that side open), or under an overhead with a thrust */
export function ripostePattern(line){
  const id = GUARD_LINE.riposte[line];
  return id ? SWING_PATTERNS[id] : null;
}
