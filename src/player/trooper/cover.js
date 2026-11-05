// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARC TROOPER'S COVER, ARMOUR AND SUPPRESSION (tuning: data/trooper.js TROOPER.cover / armor / suppress).
// No jetpack and no blade: the trooper lives behind things. C (pad L3) beside a crate, a wall or a pillar puts him in
// COVER: A/D shuffles him along the face, held aim or the trigger LEANS him out to shoot (he rises over LOW cover and
// steps out round the edge of TALL cover), and letting go ducks him back. In cover the face soaks what comes from in
// front of it; from the side or behind (a flank) it does nothing, and out in the open his thin plate takes every hit
// harder. Fire that tears past him SUPPRESSES him (a shaking aim, a greyed screen, heavier feet) until he ducks.
//   player.cover  null, or { c (the solid), box, nx, nz (the face's outward normal), s (box: along the face) / ang
//                 (column), low, top (its height over the feet), peek (0 ducked … 1 leaning out), side (the lean's way),
//                 edge (box: -1 / 0 / 1, at an end of the face), leaveT, at (G.gt it was taken) }

import { G, player, solids, isTrooper } from '../../state.js';
import { TROOPER } from '../../data/trooper.js';
import { CFG } from '../../data/config.js';
import { V3, clamp } from '../../utils.js';
import { playerPos, fwd } from '../helpers.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx } from '../../audio/sfx.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { findLedge, startMantle } from '../parkour.js';
import { fireTrigger } from '../mando/weapons.js';

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

// the best cover face within `reach` of the body: the nearest, a little in favour of one in `dir` (the way he's going)
export function findCover(pp, reach, dir){
  let best = null, score = Infinity;
  const y = player.groundY ?? pp.y;
  for (const c of solids){
    if (c.climbable || c.mound) continue;
    const rr = c.box ? Math.hypot(c.hx, c.hz) : c.r;
    if (Math.abs(c.x - pp.x) > rr + reach + 1 || Math.abs(c.z - pp.z) > rr + reach + 1) continue;
    const f = faceOf(c, pp.x, pp.z, y);
    if (!f || f.dist > reach || f.past > 0.45) continue;
    if (f.box && f.half < 0.35) continue;   // (a post too thin to put a back to)
    const into = dir ? -(f.nx * dir.x + f.nz * dir.z) : 0;   // 1: the face is right ahead of where he's going
    const sc = f.dist - into * 0.6;
    if (sc < score){ score = sc; best = f; }
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
export function takeCover(f, quiet){
  if (!f || !isTrooper()) return false;
  const pp = playerPos();
  player.cover = { c: f.c, box: f.box, nx: f.nx, nz: f.nz, half: f.half, s0: f.s0, s: f.box ? clamp(f.s, f.s0 - f.half + C.edge, f.s0 + f.half - C.edge) : 0,
                   ang: f.ang, low: f.low, top: f.top, peek: 0, side: 1, edge: 0, leaveT: 0, at: G.gt };
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
export function leaveCover(){
  if (!player.cover) return;
  player.cover = null; player.shotQ = false;
}
// C (pad L3): in cover, out of it; beside cover, into it; at a run with cover ahead, a slide that settles in behind it
export function coverKey(){
  if (!isTrooper() || G.mode !== 'play') return false;
  if (player.cover){ leaveCover(); return true; }
  if (!player.grounded || player.mantle || player.hang || player.flip) return false;
  const pp = playerPos(), sp = Math.hypot(player.moveVel.x, player.moveVel.z);
  const dir = sp > 0.5 ? V3(player.moveVel.x / sp, 0, player.moveVel.z / sp) : fwd();
  const f = findCover(pp, C.reach, dir);
  if (f) return takeCover(f);
  return false;   // nothing near: C is the slide (player/trooper/kit.js)
}
// the end of a slide or a combat roll: cover close by takes him in
export function settleIntoCover(reach){
  if (!isTrooper() || player.cover || G.mode !== 'play' || !player.grounded) return false;
  const pp = playerPos(), sp = Math.hypot(player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z);
  const dir = sp > 0.5 ? V3((player.moveVel.x + player.vel.x) / sp, 0, (player.moveVel.z + player.vel.z) / sp) : null;
  const f = findCover(pp, reach, dir);
  if (!f || (dir && -(f.nx * dir.x + f.nz * dir.z) < -0.2)) return false;   // (only cover he was heading for, not one he rolled away from)
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
export function updateCover(dt, pp, want, moving){
  const v = player.cover;
  if (!v) return false;
  if (!isTrooper() || G.mode !== 'play' || !player.grounded || player.mantle || player.hang || player.downed
      || !solids.includes(v.c) || Math.hypot(player.vel.x, player.vel.z) > 6){ leaveCover(); return false; }   // (blown out of it)
  const tx = -v.nz, tz = v.nx;
  // the keys, in the face's frame: along it, and away from it
  let along = 0, away = 0;
  if (moving){ const l = Math.hypot(want.x, want.z) || 1; along = (want.x * tx + want.z * tz) / l; away = (want.x * v.nx + want.z * v.nz) / l; }
  if (away > 0.72){ v.leaveT += dt; if (v.leaveT > C.leave){ leaveCover(); return false; } } else v.leaveT = 0;
  const peekWant = wantsPeek();
  v.peek = clamp(v.peek + (peekWant ? 1 : -1) * dt / C.rise, 0, 1);
  // the lean's side: the way the aim points along the face (the right shoulder by default)
  const f = fwd(), aimAlong = f.x * tx + f.z * tz;
  if (!peekWant && Math.abs(aimAlong) > 0.25) v.side = aimAlong > 0 ? 1 : -1;
  const spd = CFG.player.speed * C.move * (player.up.move || 1) * heroSuppSlow() * (v.peek > 0.5 ? (v.low ? 0.5 : 0) : 1);
  let bx, bz;
  if (v.box){
    const lo = v.s0 - v.half + C.edge, hi = v.s0 + v.half - C.edge;
    v.s = clamp(v.s + along * spd * dt, lo, hi);
    v.edge = v.s > hi - 0.45 ? 1 : v.s < lo + 0.45 ? -1 : 0;
    if (v.edge && !peekWant) v.side = v.edge;   // at an end, the lean goes round it
    const plane = v.c.x * v.nx + v.c.z * v.nz + (v.nx ? v.c.hx : v.c.hz);
    let s = v.s;
    // TALL cover: leaning out round the end of the face (the middle of a long wall has nowhere to lean)
    if (!v.low && v.edge === v.side) s = lerp(v.s, (v.side > 0 ? v.s0 + v.half : v.s0 - v.half) + v.side * C.lean, ease(v.peek));
    bx = v.nx * (plane + C.hug) + tx * s; bz = v.nz * (plane + C.hug) + tz * s;
  } else {
    const R = v.c.r + C.hug;
    v.ang += along * spd * dt / R * 1;
    const a = v.ang + (!v.low ? v.side * (C.lean / R) * ease(v.peek) : 0);   // round a column: the lean steps round the curve
    v.nx = Math.sin(v.ang); v.nz = Math.cos(v.ang);
    bx = v.c.x + Math.sin(a) * R; bz = v.c.z + Math.cos(a) * R;
  }
  const vx = (bx - pp.x) / Math.max(dt, 1e-4), vz = (bz - pp.z) / Math.max(dt, 1e-4);
  player.moveVel.set(clamp(vx, -9, 9), 0, clamp(vz, -9, 9));   // (the legs read this: a shuffle steps)
  pp.x = bx; pp.z = bz;
  // the shot he came up for goes once he has cleared the face
  if (player.shotQ && v.peek > 0.9){ player.shotQ = false; fireTrigger(); tutEvent('lean'); }
  if (!v.low && v.box && v.edge !== v.side && player.blockHeld && G.gt - (v.hintT ?? -9) > 3){ v.hintT = G.gt; floater(pp, 'SHUFFLE TO AN EDGE TO LEAN', '#9fb8d0'); }
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
export const heroSuppSpread = () => isTrooper() ? 1 + suppK() * SH.spread : 1;
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
