// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARC TROOPER'S COVER, ARMOUR AND SUPPRESSION (tuning: data/trooper.js TROOPER.cover / armor / suppress).
// No jetpack and no blade: the trooper lives behind things. C (pad L3) beside a crate, a wall or a pillar puts him in
// COVER: A/D shuffles him along the face, held aim or the trigger LEANS him out to shoot (he rises over LOW cover and
// steps out round the edge of TALL cover), and letting go ducks him back. In cover the face soaks what comes from in
// front of it; from the side or behind (a flank) it does nothing, and out in the open his thin plate takes every hit
// harder. Fire that tears past him SUPPRESSES him (a shaking aim, a greyed screen, heavier feet) until he ducks.
//   player.cover  null, or { c (the solid), box, nx, nz (the face's outward normal), s (box: along the face) / ang
//                 (column), low, top (its height over the feet), peek (0 ducked … 1 leaning out), side (the lean's way),
//                 edge (box: -1 / 0 / 1, at an end of the face), leaveT, at (G.gt it was taken), fx / fz / blend (where the
//                 body was when it went in, and how far its ease onto the face has come), cont (box: the cover that carries
//                 on past each end, for the shuffle across a seam) }
// A face is only ever walked where the body fits: another crate jutting across it stops the shuffle (no sticking and
// popping through it), and one that carries the face on past its end (crates in a row) takes the shuffle straight across.

import { G, player, solids, isTrooper } from '../../state.js';
import { TROOPER } from '../../data/trooper.js';
import { CFG } from '../../data/config.js';
import { V3, clamp } from '../../utils.js';
import { playerPos, fwd, rightV } from '../helpers.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx } from '../../audio/sfx.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { findLedge, startMantle } from '../parkour.js';
import { fireTrigger } from '../mando/weapons.js';
import { flowSuppMul, flowCoverTaken, flowCoverLeft } from '../gunner-flow.js';

const C = TROOPER.cover, A = TROOPER.armor, SH = TROOPER.suppress.onHero;

/* ---------- the face of one solid, seen from a body at (x, z) with its feet at y ---------- */
// a box gives the face the body is off (the axis it stands out from most); a column gives the point of it nearest
function faceOf(c, x, z, y){
  if (!c || c.climbable || c.mound || (c.y0 || 0) > y + 0.3) return null;
  const top = c.h - y;
  if (top < C.minH) return null;
  if (c.box){
    const ox = Math.abs(x - c.x) - c.hx, oz = Math.abs(z - c.z) - c.hz;
    if (ox < -0.05 && oz < -0.05) return null;   // (inside it)
    const alongX = ox >= oz;
    const nx = alongX ? Math.sign(x - c.x) || 1 : 0, nz = alongX ? 0 : Math.sign(z - c.z) || 1;
    const half = alongX ? c.hz : c.hx;            // the face's half-length
    const tx = -nz, tz = nx, s0 = c.x * tx + c.z * tz, s = x * tx + z * tz;
    const past = Math.max(0, Math.abs(s - s0) - half);   // beyond the end of the face, round the corner
    const dist = Math.hypot(Math.max(ox, oz), past);
    return { c, box: true, nx, nz, half, s0, s, dist, past, top, low: top < C.tallH };
  }
  const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  if (d < 1e-3) return null;
  return { c, box: false, nx: dx / d, nz: dz / d, ang: Math.atan2(dx, dz), dist: d - c.r, past: 0, top, low: top < C.tallH };
}

/* ---------- room for the body: is a spot on the face clear of every OTHER solid? ---------- */
// (what collideSolids would push him out of: not the cover itself, not a step he'd walk onto, not a slab overhead)
const R_BODY = () => CFG.player.radius - 0.04;
function blocks(o, x, z, y, r){
  if (o.mound || o.soft) return false;
  if (o.h <= y + 0.5) return false;                     // a step: he'd stand on it, not against it
  if ((o.y0 || 0) > y + 1.8) return false;              // a slab overhead, his head clears it
  if (o.box){ const dx = Math.max(0, Math.abs(x - o.x) - o.hx), dz = Math.max(0, Math.abs(z - o.z) - o.hz); return dx * dx + dz * dz < r * r; }
  return Math.hypot(x - o.x, z - o.z) < o.r + r;
}
function blocker(c, x, z, y, near){
  const r = R_BODY();
  for (const o of near || solids) if (o !== c && blocks(o, x, z, y, r)) return o;
  return null;
}
// the solids within a few metres of a face (what the shuffle and the lean can run into), refreshed as he goes
function nearOf(c, x, z){
  const out = [], R = 5 + (c.box ? Math.max(c.hx, c.hz) : c.r);
  for (const o of solids){
    if (o === c || o.mound) continue;
    const rr = o.box ? Math.hypot(o.hx, o.hz) : o.r;
    if (Math.hypot(o.x - x, o.z - z) < R + rr) out.push(o);
  }
  return out;
}
// the body on a box face at s (along it), hugging it
function hugPoint(f, s){
  const plane = f.c.x * f.nx + f.c.z * f.nz + (f.nx ? f.c.hx : f.c.hz), tx = -f.nz, tz = f.nx;
  return [f.nx * (plane + C.hug) + tx * s, f.nz * (plane + C.hug) + tz * s];
}
// the nearest s to `want` on box face f where the body fits (null: nowhere on it)
function clearS(f, want, y, near){
  const lo = f.s0 - f.half + C.edge, hi = f.s0 + f.half - C.edge;
  if (hi < lo) return null;
  const s0 = clamp(want, lo, hi);
  for (let d = 0; d <= hi - lo + 0.01; d += 0.15){
    for (const s of d ? [s0 - d, s0 + d] : [s0]){
      if (s < lo - 1e-6 || s > hi + 1e-6) continue;
      const [x, z] = hugPoint(f, s);
      if (!blocker(f.c, x, z, y, near)) return s;
    }
    if (d > 1.2) break;   // (no further than this from where he is: not a teleport down the wall)
  }
  return null;
}
// the face that carries this one on past its end (`end` -1 / 1): a crate in a row, a wall section beside it, facing the
// same way and near enough in line that the body can walk from one to the other
function carryOn(f, end, y, near){
  const tx = -f.nz, tz = f.nx, s = f.s0 + end * (f.half + 0.3);
  const plane = f.c.x * f.nx + f.c.z * f.nz + (f.nx ? f.c.hx : f.c.hz);
  const px = f.nx * (plane + C.hug) + tx * s, pz = f.nz * (plane + C.hug) + tz * s;
  let best = null;
  for (const o of near || solids){
    if (o === f.c || o.climbable || o.mound) continue;
    const g = faceOf(o, px, pz, y);
    if (!g || g.nx * f.nx + g.nz * f.nz < 0.9 || g.past > 0.25 || Math.abs(g.dist - C.hug) > 0.45) continue;
    if (g.box && g.half < 0.35) continue;
    if (!best || Math.abs(g.dist - C.hug) < Math.abs(best.dist - C.hug)) best = g;
  }
  return best;
}

// the best cover face within `reach` of the body: the nearest, a little in favour of one in `dir` (the way he's going).
// Only a face with room for the body on it (not one walled in by the crate beside it), and not a pole too thin to hide
// behind.
export function findCover(pp, reach, dir){
  let best = null, score = Infinity;
  const y = player.groundY ?? pp.y;
  for (const c of solids){
    if (c.climbable || c.mound) continue;
    const rr = c.box ? Math.hypot(c.hx, c.hz) : c.r;
    if (Math.abs(c.x - pp.x) > rr + reach + 1 || Math.abs(c.z - pp.z) > rr + reach + 1) continue;
    const f = faceOf(c, pp.x, pp.z, y);
    if (!f || f.dist > reach || f.past > 0.45) continue;
    if (f.box ? f.half < 0.35 : c.r < C.minR) continue;   // (a post too thin to put a back to)
    const into = dir ? -(f.nx * dir.x + f.nz * dir.z) : 0;   // 1: the face is right ahead of where he's going
    const sc = f.dist - into * 0.6;
    if (sc >= score) continue;
    if (f.box){ const s = clearS(f, f.s, y); if (s == null) continue; f.s = s; }
    else { const R = c.r + C.hug; if (blocker(c, c.x + f.nx * R, c.z + f.nz * R, y)) continue; }
    score = sc; best = f;
  }
  return best;
}

export const inCover = () => !!player.cover;
// the trooper is tucked down behind the face, not leaning out of it
export const coverHidden = () => !!player.cover && player.cover.peek < 0.5;
// for the enemy AI and co-op (enemies/coverfight.js, net/partner.js): what this hero's cover is, or null
export function coverInfo(){
  const v = player.cover;
  if (!v) return null;
  return { nx: v.nx, nz: v.nz, low: v.low, top: v.top, hidden: v.peek < 0.5 };
}

/* ---------- in and out ---------- */
// the cover record for face f, the body easing onto it from where it stands now
function coverFrom(f, pp, keep){
  const v = { c: f.c, box: f.box, nx: f.nx, nz: f.nz, half: f.half, s0: f.s0, s: f.box ? clamp(f.s, f.s0 - f.half + C.edge, f.s0 + f.half - C.edge) : 0,
              ang: f.ang, low: f.low, top: f.top, peek: 0, side: 1, edge: 0, leaveT: 0, offT: 0, at: G.gt,
              fx: pp.x, fz: pp.z, blend: 0, near: nearOf(f.c, pp.x, pp.z), nearT: G.gt };
  if (keep){ v.peek = keep.peek; v.side = keep.side; v.at = keep.at; v.hintT = keep.hintT; }
  if (f.box){ const y = player.groundY ?? pp.y; v.cont = [carryOn(f, -1, y, v.near), carryOn(f, 1, y, v.near)]; }
  return v;
}
export function takeCover(f, quiet){
  if (!f || !isTrooper()) return false;
  const pp = playerPos();
  player.cover = coverFrom(f, pp);
  flowCoverTaken();   // cover to cover, or into it under fire: BATTLE RHYTHM (player/gunner-flow.js)
  player.moveVel.set(0, 0, 0); player.slideT = 0; player.wallRun = null;
  if (player.flip && (player.flip.kind === 'slide' || player.flip.kind === 'dive')) player.flip = null;
  player.shotQ = false;
  if (!quiet){
    burst(V3(pp.x - f.nx * 0.6, (player.groundY ?? pp.y) + Math.min(1.2, f.top * 0.7), pp.z - f.nz * 0.6), 0x9a9288, 5, 2.5, 1, 0.8);
    sfx(200, 0.07, 'triangle', 0.05, 110); sfx(520, 0.03, 'square', 0.02, 300);
  }
  tutEvent('cover');
  return true;
}
// the shuffle has walked off this face onto the one that carries it on (crates in a row): the same cover, a new solid
function handOver(g, pp){
  const old = player.cover;
  player.cover = coverFrom(g, pp, old);
  player.cover.blend = 0.35;   // (a step across the seam, not a fresh dive in)
}
export function leaveCover(){
  if (!player.cover) return;
  player.cover = null; player.shotQ = false;
  flowCoverLeft();
}
// C (pad L3): in cover, out of it; beside cover, into it; at a run or a sprint with cover ahead, a SLIDE that carries
// him into it (a feet-first skid that eases out right on the face); at a run with none, the plain slide (kit.js)
export function coverKey(){
  if (!isTrooper() || G.mode !== 'play') return false;
  if (player.cover){ leaveCover(); return true; }
  if (!player.grounded || player.mantle || player.hang || player.flip) return false;
  const pp = playerPos(), sp = Math.hypot(player.moveVel.x, player.moveVel.z);
  const dir = sp > 0.5 ? V3(player.moveVel.x / sp, 0, player.moveVel.z / sp) : fwd();
  if (sp > C.slideMin){ const g = coverAhead(pp, dir, C.slideAhead); if (g) return slideIntoCover(g, sp); }
  const f = findCover(pp, C.reach, dir);
  if (f) return takeCover(f);
  return false;   // nothing near: C is the slide (player/trooper/kit.js)
}
// where the body ends up on face f
function restOn(f){
  if (f.box) return hugPoint(f, f.s);
  const R = f.c.r + C.hug;
  return [f.c.x + f.nx * R, f.c.z + f.nz * R];
}
// a cover face straight ahead along `dir`, facing him, within `maxD` (m), with a clear run to it: { f, x, z, d } or null
export function coverAhead(pp, dir, maxD){
  const y = player.groundY ?? pp.y, r = R_BODY();
  for (let d = 0; d <= maxD; d += 0.5){
    const q = V3(pp.x + dir.x * d, pp.y, pp.z + dir.z * d);
    const f = findCover(q, C.reach, dir);
    if (!f || -(f.nx * dir.x + f.nz * dir.z) < 0.55) continue;   // (a face he's running at, not one off to the side)
    const [x, z] = restOn(f), dx = x - pp.x, dz = z - pp.z, L = Math.hypot(dx, dz);
    if (L > maxD + C.reach) return null;
    // nothing in the way of the skid (a crate before it, a pillar beside the line)
    let open = true;
    for (let t = 0.4; t < L && open; t += 0.4){ const px = pp.x + dx * t / L, pz = pp.z + dz * t / L; for (const o of solids) if (o !== f.c && blocks(o, px, pz, y, r)){ open = false; break; } }
    if (open) return { f, x, z, d: L };
  }
  return null;
}
// THE SLIDE INTO COVER: in cover from the first frame (the face is his), the body skidding feet first onto it and
// easing out to a stop right on it, then settling into the crouch
export function slideIntoCover(g, sp){
  const pp = playerPos(), prev = player.flip && player.flip.kind === 'slide' ? player.flip : null;   // (out of a plain slide: the skid carries on)
  if (!takeCover(g.f, true)) return false;
  const v = player.cover, start = Math.max(sp * 1.15, C.slideSpeed);
  v.slideDur = clamp(2 * g.d / start, 0.22, 0.85);   // (an ease-out: it leaves at `start` and stops on the face)
  player.slideT = v.slideDur;
  player.flip = { kind: 'slide', t: prev ? Math.min(prev.t / prev.dur, 0.3) * v.slideDur : 0, dur: v.slideDur, face: Math.atan2(g.x - pp.x, g.z - pp.z) };
  player.cds.slide = v.slideDur + 0.3;
  burst(V3(pp.x, 0.15, pp.z), 0x9a9288, 8, 4, 1, 0.9);
  sfx(200, 0.07, 'triangle', 0.05, 110); sfx(140, 0.18, 'sawtooth', 0.025, 60);
  tutEvent('slide');
  return true;
}
// the end of a slide: cover close by takes him in
export function settleIntoCover(reach){
  if (!isTrooper() || player.cover || G.mode !== 'play' || !player.grounded) return false;
  const pp = playerPos(), sp = Math.hypot(player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z);
  const dir = sp > 0.5 ? V3((player.moveVel.x + player.vel.x) / sp, 0, (player.moveVel.z + player.vel.z) / sp) : null;
  const f = findCover(pp, reach, dir);
  if (!f || (dir && -(f.nx * dir.x + f.nz * dir.z) < -0.2)) return false;   // (only cover he was heading for, not one he slid away from)
  player.vel.set(0, 0, 0);
  return takeCover(f);
}

// is he holding a shot, and so leaning out for it? Aim held, the trigger held (the auto barrel) or just pulled
const wantsPeek = () => player.blockHeld || player.zoom || (player.firing && player.trigHeld) || player.shotQ || G.gt - (player.coverShotAt ?? -9) < C.peek;
// the trigger pulled in cover: ducked, he comes up first and the shot goes as he clears the face (updateCover)
export function coverTrigger(){
  if (!player.cover || player.cover.peek > 0.9) return false;
  player.shotQ = true; player.coverShotAt = G.gt;
  return true;
}

/* ---------- every frame in cover: called by player/locomotion.js updateMovement in place of the ground move ---------- */
export function updateCover(dt, pp, want, moving, again){
  let v = player.cover;
  if (!v) return false;
  if (!isTrooper() || G.mode !== 'play' || !player.grounded || player.mantle || player.hang || player.downed
      || !solids.includes(v.c) || Math.hypot(player.vel.x, player.vel.z) > 6){ leaveCover(); return false; }   // (blown out of it)
  const y = player.groundY ?? pp.y;
  if (G.gt - v.nearT > 1){ v.nearT = G.gt; v.near = nearOf(v.c, pp.x, pp.z); }   // (a door opened, a crate blown apart)
  let tx = -v.nz, tz = v.nx;
  // the keys (or the stick, as far as it's pushed), in the face's frame: along it, and away from it
  let along = 0, away = 0;
  if (moving){
    const l = Math.hypot(want.x, want.z) || 1, push = Math.min(1, l);
    along = (want.x * tx + want.z * tz) / l * push;
    away = (want.x * v.nx + want.z * v.nz) / l * (push > 0.55 ? 1 : 0);   // (a stick barely off centre never walks him out)
  }
  if (away > 0.72){ v.leaveT += dt; if (v.leaveT > C.leave){ leaveCover(); return false; } } else v.leaveT = 0;
  // the lean needs somewhere to lean: over LOW cover, round a column, or out past the end of TALL cover. In the middle
  // of a tall wall he stays tucked in (the aim and the trigger only tell him to shuffle to an end)
  const canLean = v.low || !v.box || (v.edge !== 0);
  const asked = wantsPeek();
  const peekWant = asked && canLean;
  if (asked && !canLean){
    player.shotQ = false;
    if (G.gt - (v.hintT ?? -9) > 2.5){ v.hintT = G.gt; floater(pp, 'SHUFFLE TO AN EDGE TO LEAN', '#9fb8d0'); }
  }
  v.peek = clamp(v.peek + (peekWant ? 1 : -1) * dt / C.rise, 0, 1);
  // the lean's side: the way the aim points along the face (the right shoulder by default)
  const f = fwd(), aimAlong = f.x * tx + f.z * tz;
  if (!peekWant && Math.abs(aimAlong) > 0.25) v.side = aimAlong > 0 ? 1 : -1;
  const spd = CFG.player.speed * C.move * (player.up.move || 1) * heroSuppSlow() * (v.peek > 0.5 ? (v.low ? 0.5 : 0) : 1);
  let bx, bz;
  if (v.box){
    const lo = v.s0 - v.half + C.edge, hi = v.s0 + v.half - C.edge;
    let ns = v.s + along * spd * dt;
    // past an end: onto the cover that carries the face on (crates in a row), or held at the end; pushing on past a
    // bare end for a moment steps him off it
    const end = ns > hi ? 1 : ns < lo ? -1 : 0, nxt = end && v.cont[end > 0 ? 1 : 0];
    if (end && nxt && !again){ handOver({ ...nxt, s: ns }, pp); return updateCover(dt, pp, want, moving, true); }
    if (end && Math.abs(along) > 0.6 && v.peek < 0.5){ v.offT += dt; if (v.offT > C.offEnd){ leaveCover(); player.moveVel.set(tx * end * spd, 0, tz * end * spd); return false; } }
    else v.offT = 0;
    ns = clamp(ns, lo, hi);
    // a crate jutting across the face: the shuffle stops against it (it used to walk into it, stick, then pop out the far side)
    if (ns !== v.s){
      const [qx, qz] = hugPoint(v, ns), o = blocker(v.c, qx, qz, y, v.near);
      if (o){
        const g = faceOf(o, qx, qz, y);
        if (g && g.nx * v.nx + g.nz * v.nz > 0.9 && Math.abs(g.dist - C.hug) < 0.45 && (!g.box || g.half >= 0.35) && !again){ handOver(g, pp); return updateCover(dt, pp, want, moving, true); }   // (the same face, carried on by an overlapping crate)
        let a = v.s, b = ns;   // the furthest it fits
        for (let k = 0; k < 6; k++){ const m = (a + b) / 2, [mx, mz] = hugPoint(v, m); if (blocker(v.c, mx, mz, y, v.near)) b = m; else a = m; }
        const [ax, az] = hugPoint(v, v.s);
        ns = blocker(v.c, ax, az, y, v.near) ? ns : a;   // (already wedged: let him walk out of it)
      }
    }
    v.s = ns;
    // an END is where the face really stops: not a seam the next crate carries on past
    v.edge = v.s > hi - 0.45 && !v.cont[1] ? 1 : v.s < lo + 0.45 && !v.cont[0] ? -1 : 0;
    if (v.edge && !peekWant) v.side = v.edge;   // at an end, the lean goes round it
    const plane = v.c.x * v.nx + v.c.z * v.nz + (v.nx ? v.c.hx : v.c.hz);
    let s = v.s;
    // TALL cover: leaning out round the end of the face (the middle of a long wall has nowhere to lean), as far as
    // there's room: never into the next crate along
    if (!v.low && v.edge === v.side){
      const out = (v.side > 0 ? v.s0 + v.half : v.s0 - v.half) + v.side * C.lean;
      let k = ease(v.peek);
      const at = q => { const ss = lerp(v.s, out, q); return blocker(v.c, v.nx * (plane + C.hug) + tx * ss, v.nz * (plane + C.hug) + tz * ss, y, v.near); };
      if (k > 0 && at(k)){ let a = 0, b = k; for (let i = 0; i < 6; i++){ const m = (a + b) / 2; if (at(m)) b = m; else a = m; } k = a; }
      s = lerp(v.s, out, k);
    }
    bx = v.nx * (plane + C.hug) + tx * s; bz = v.nz * (plane + C.hug) + tz * s;
  } else {
    const R = v.c.r + C.hug;
    const na = v.ang + along * spd * dt / R;
    if (!blocker(v.c, v.c.x + Math.sin(na) * R, v.c.z + Math.cos(na) * R, y, v.near)) v.ang = na;   // (round the pillar until something's in the way)
    let lean = !v.low ? v.side * (C.lean / R) * ease(v.peek) : 0;   // round a column: the lean steps round the curve
    if (lean && blocker(v.c, v.c.x + Math.sin(v.ang + lean) * R, v.c.z + Math.cos(v.ang + lean) * R, y, v.near)) lean *= 0.35;
    const a = v.ang + lean;
    v.nx = Math.sin(v.ang); v.nz = Math.cos(v.ang);
    bx = v.c.x + Math.sin(a) * R; bz = v.c.z + Math.cos(a) * R;
  }
  // going in: a quick step onto the face from wherever he pressed it, not a teleport
  if (v.blend < 1){
    v.blend = Math.min(1, v.blend + dt / (v.slideDur || C.snap));
    const k = v.slideDur ? 1 - (1 - v.blend) * (1 - v.blend) : ease(v.blend);   // (a slide in leaves fast and eases out onto the face)
    bx = lerp(v.fx, bx, k); bz = lerp(v.fz, bz, k);
  }
  const vx = (bx - pp.x) / Math.max(dt, 1e-4), vz = (bz - pp.z) / Math.max(dt, 1e-4);
  player.moveVel.set(clamp(vx, -9, 9), 0, clamp(vz, -9, 9));   // (the legs read this: a shuffle steps)
  pp.x = bx; pp.z = bz;
  player.vel.x = 0; player.vel.z = 0;   // (a bash or a glancing shove doesn't push him off the face: past `6` it blows him out, above)
  // leaning out round TALL cover or a column, the lens swings over that shoulder, so the crosshair isn't behind the wall
  if (!v.low && v.peek > 0.2){
    const r = rightV(), scr = (tx * r.x + tz * r.z) * v.side;
    if (Math.abs(scr) > 0.3) player.camSide = Math.sign(scr);
  }
  // the shot he came up for goes once he has cleared the face
  if (player.shotQ && v.peek > 0.9){ player.shotQ = false; fireTrigger(); tutEvent('lean'); }
  return true;
}
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);

// ducked behind the face: the gun stays down (nothing fires into the cover)
export const coverHoldsFire = () => !!player.cover && player.cover.peek < 0.9;

/* ---------- SPACE in cover: over low cover it's a vault (toward the face), off tall cover a step back out ---------- */
export function coverJump(){
  const v = player.cover;
  if (!v) return false;
  leaveCover();
  if (v.low){
    const pp = playerPos(), d = V3(-v.nx, 0, -v.nz);
    const ledge = findLedge(pp, d, 0.2, Math.max(1.4, v.top + 0.1));
    if (ledge){ startMantle(pp, ledge, true); return true; }
  }
  return false;
}

/* ---------- ARMOUR: what a hit on him is worth (player/damage.js hurtPlayer) ---------- */
// fromPos: where it came from. In cover, a blow from the face's side is soaked (ducked far more than leaning out);
// from the flank or behind it lands as in the open. Out in the open his plate is thin.
export function trooperHurtMul(fromPos, melee){
  if (!isTrooper()) return 1;
  const open = A.open * (player.up.openArmor || 1);
  const v = player.cover;
  // the COMMANDO's braced aim: feet planted, aim up, a blow from in front lands lighter (data/trooper.js fork)
  if (!v && player.up.brace && player.blockHeld && player.grounded && fromPos && Math.hypot(player.moveVel.x, player.moveVel.z) < 2.5){
    const pp = playerPos(), f = fwd(), dx = fromPos.x - pp.x, dz = fromPos.z - pp.z, l = Math.hypot(dx, dz) || 1;
    if ((dx * f.x + dz * f.z) / l > 0.3) return open * player.up.brace;
  }
  if (v && v.slideDur && v.blend < 0.6) return open;   // (still skidding in: not behind it yet)
  if (!v || !fromPos) return v ? 1 : open;
  const pp = playerPos(), dx = fromPos.x - pp.x, dz = fromPos.z - pp.z, l = Math.hypot(dx, dz);
  if (l < 0.3) return open;
  const front = -(dx * v.nx + dz * v.nz) / l;   // 1: straight across the face
  if (front < C.front) return open;             // FLANKED: the cover is no use from here
  if (melee) return 1;                           // (a blade over the crate: no worse than in the open, no better)
  const k = clamp(v.peek, 0, 1);
  return lerp(C.hidden, C.peekDr, k) * (player.up.coverArmor || 1);
}
// the band of his body a bolt can strike (m over the feet): ducked behind low cover, nothing over its top
export function heroHitBand(){
  const v = player.cover;
  if (v && v.low && v.peek < 0.5) return [0.1, Math.max(0.85, v.top - 0.08)];
  return [0.2, 2.6];
}
// shots fired leaning out of cover (the ARC's Commander path hits harder from it: data/trooper-progression.js)
export const coverShotMul = () => player.cover && player.cover.peek > 0.5 ? (player.up.coverDmg || 1) : 1;

/* ---------- SUPPRESSION on him ---------- */
export function suppressHero(amt){
  if (!isTrooper() || G.mode !== 'play') return;
  const hidden = coverHidden();
  player.supp = clamp((player.supp || 0) + amt * (hidden ? 0.35 : 1) * (player.up.suppRes || 1), 0, 1);
  player.suppAt = G.gt;
}
const suppK = () => clamp(((player.supp || 0) - SH.from) / (1 - SH.from), 0, 1);
export const heroSuppSpread = () => isTrooper() ? 1 + suppK() * SH.spread * flowSuppMul() : 1;   // (BATTLE RHYTHM steadies it: player/gunner-flow.js)
export const heroSuppSlow = () => isTrooper() ? 1 - suppK() * (1 - SH.slow) : 1;
let vig = null;
export function updateHeroSupp(dt){
  if (!isTrooper()){ if (vig) vig.style.opacity = '0'; return; }
  const decay = coverHidden() ? SH.coverDecay : SH.decay;
  if (G.gt - (player.suppAt ?? -9) > 0.35) player.supp = Math.max(0, (player.supp || 0) - decay * dt);
  if (!vig){
    vig = document.getElementById('suppvig');
    if (!vig){ vig = document.createElement('div'); vig.id = 'suppvig'; document.body.appendChild(vig); }
  }
  const k = suppK();
  vig.style.opacity = (G.mode === 'play' ? k * (0.75 + 0.25 * Math.sin(G.gt * 7)) : 0).toFixed(2);
  if (k > 0.85 && G.gt - (player.suppCallT ?? -9) > 6){ player.suppCallT = G.gt; floater(playerPos(), 'SUPPRESSED · GET TO COVER', '#ff9a66'); }
  // the cover chip under the reticle: IN COVER, and which way it faces you
  let chip = document.getElementById('coverchip');
  if (!chip){ chip = document.createElement('div'); chip.id = 'coverchip'; document.body.appendChild(chip); }
  const v = player.cover, on = G.mode === 'play' && !!v;
  chip.style.opacity = on ? '1' : '0';
  if (on){
    const txt = v.peek > 0.5 ? (v.low ? 'OVER COVER' : 'LEANING') : 'IN COVER';
    if (chip._t !== txt){ chip._t = txt; chip.textContent = txt; }
    chip.classList.toggle('peek', v.peek > 0.5);
  }
}
export function resetCover(){ player.cover = null; player.supp = 0; player.shotQ = false; }
