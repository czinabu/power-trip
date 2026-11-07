// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE COVER FIGHT — how the rank and file fight the ARC TROOPER (tuning: data/tactics.js COVER_FIGHT). He fights from
// cover, so they do too, and they come round his:
//   COVER     a line trooper picks a spot behind a solid tall enough to hide it, on the far side from him, inside its
//             range; it ducks there, then PEEKS out to the side for a shot and ducks back
//   FLANK     while he sits in cover, a couple of them at a time are sent wide, round to his side of it, where his
//             cover does nothing (player/trooper/cover.js trooperHurtMul)
//   PINNED    his fire that tears past a foe frightens it (data/trooper.js suppress.onFoe): past the edge it is PINNED,
//             the squad's SUPPRESS state (a crawl, slow shots), and a line trooper with cover stays down behind it
//   AIM       a foe shooting at him ducked behind low cover aims at what shows of him (lower): the crate takes it
// Only against a trooper hero (this browser's or a co-op partner's): the Jedi and the Mando fights are untouched.

import { G, enemies, shared, solids } from '../state.js';
import { rand, clamp, V3 } from '../utils.js';
import { TROOPER } from '../data/trooper.js';
import { COVER_FIGHT as CF } from '../data/tactics.js';
import { segBlockedTall, spotBlocked } from '../world/collision.js';
import { floater } from '../fx/floaters.js';
import { tacticsRamp } from './tactics.js';
import { throwGrenade, lobClear } from './grenades.js';
import { players } from '../player/players.js';
import { addFlow } from '../player/gunner-flow.js';
import { hooks } from '../net/run.js';

const SF = TROOPER.suppress.onFoe;
const flat = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// is this foe one that fights the cover fight? (the line troops; never a boss, a champion, a duellist or a flyer)
// (a mission's named gunman, a CHAMPION, fights it too, harder: CHAMP below)
const coverFoe = (e) => !!e && !e.dead && !e.converted && e.t.ranged && !e.t.fly && !e.fin && !e.ff && !e.goal && !e.civHunt;
// a hero this foe is on who is a trooper (players.js: `trooper`, `cover`)
export const vsTrooper = (hero) => !!hero && !!hero.trooper;

/* ---------- what of the hero shows over the cover between ---------- */
// a solid this tall (absolute, m) or taller between a foe and the hero hides him: ducked behind low cover, the
// cover's own top; otherwise a solid that would stop a bolt at chest height
export function heroHideTop(hero){
  const v = hero.cover, y = hero.pos.y;
  return v && v.low && v.hidden ? y + Math.max(0.8, v.top - 0.12) : y + CF.chestTop;
}
export const heroExposedFrom = (x, z, hero) => !segBlockedTall(x, z, hero.pos.x, hero.pos.z, heroHideTop(hero));
// the height over his feet a foe aims at: his chest, or, ducked behind low cover, what shows of him
export const heroAimH = (hero) => hero && hero.cover && hero.cover.low && hero.cover.hidden ? CF.duckAim : 1.4;

/* ---------- his fire frightens (data/trooper.js suppress.onFoe) ---------- */
function fear(e){
  if (e.fearAt != null) e.fear = Math.max(0, (e.fear || 0) - SF.decay * (G.gt - e.fearAt));
  e.fearAt = G.gt;
  return e.fear || 0;
}
function frighten(e, amt){
  if (e.dead || e.converted || e.fin || e.champion || e.ff) return;   // (a boss or a duellist doesn't scare)
  const f = fear(e) + amt * (e.t.heavy ? 0.5 : 1) * (e.elite ? 0.6 : 1);
  if (f >= 1){
    e.fear = 0.35;
    const was = e.suppT > G.gt;
    e.suppT = Math.max(e.suppT || 0, G.gt + SF.pin);
    if (e.net && hooks.fpin) hooks.fpin(e, SF.pin);   // co-op: a guest's pin is the host's to keep (its AI runs there: net/foefire.js)
    if (!was) addFlow('pin');   // BATTLE RHYTHM (player/gunner-flow.js)
    if (!was && G.gt - (e.pinCallT ?? -9) > 3){ e.pinCallT = G.gt; floater(V3(e.group.position.x, e.group.position.y + 2.6, e.group.position.z), 'PINNED', '#9fd4ff'); }
  } else e.fear = f;
}
// a bolt of his in flight: the foes it tears past (once each)
export function suppressFoes(b){
  const p = b.mesh.position;
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    const g = e.group.position;
    if (Math.abs(p.x - g.x) > SF.near || Math.abs(p.z - g.z) > SF.near) continue;
    if (Math.hypot(p.x - g.x, p.y - (g.y + 1.3), p.z - g.z) > SF.near) continue;
    const set = b.supSet || (b.supSet = new Set());
    if (set.has(e)) continue;
    set.add(e); frighten(e, SF.perBolt);
  }
}
export const foeShotHit = (e) => frighten(e, SF.perHit);
// the guns' signature moves (player/gun-moves.js): pin one outright, or shake it by `amt` of a pin
export const pinFoe = (e) => frighten(e, 9);
export const shakeFoe = (e, amt) => frighten(e, amt);

/* ---------- a cover spot: behind a tall solid, on the far side from the hero, inside the foe's range ---------- */
function spotTaken(e, x, z){
  for (const o of enemies) if (o !== e && !o.dead && o.cv && o.cv.spot && flat(o.cv.spot.x, o.cv.spot.z, x, z) < CF.spacing) return true;
  return false;
}
function pickSpot(e, hero){
  const g = e.group.position, hp = hero.pos, t = e.t;
  const want = Math.min(t.range * CF.rangeShare, Math.max(CF.minDist + 2, t.standoff || 0));
  let best = null, bs = Infinity;
  for (const c of solids){
    if (c.climbable || c.mound || c.y0 || c.h < CF.minTall) continue;
    const rr = c.box ? Math.hypot(c.hx, c.hz) : c.r;
    if (flat(c.x, c.z, g.x, g.z) > CF.search + rr) continue;
    const ax = c.x - hp.x, az = c.z - hp.z, al = Math.hypot(ax, az) || 1, ux = ax / al, uz = az / al;
    const ext = c.box ? Math.abs(ux) * c.hx + Math.abs(uz) * c.hz : c.r;   // how far the solid reaches toward the far side
    const x = c.x + ux * (ext + CF.behind), z = c.z + uz * (ext + CF.behind);
    const dh = flat(x, z, hp.x, hp.z);
    if (dh < CF.minDist || dh > t.range * 0.95) continue;
    if (!shared.arenaBig && (Math.abs(x) > shared.arenaHalf - 1.2 || Math.abs(z) > (shared.arenaHalfZ || shared.arenaHalf) - 1.2)) continue;
    if (spotBlocked(x, z, 0.45) || spotTaken(e, x, z)) continue;
    if (!segBlockedTall(x, z, hp.x, hp.z, hp.y + CF.chestTop)) continue;   // (the solid really is between)
    const sc = flat(x, z, g.x, g.z) + Math.abs(dh - want) * 0.45;
    if (sc < bs){ bs = sc; best = { x, z, c, hx: hp.x, hz: hp.z }; }
  }
  return best;
}

/* ---------- the flankers: while a trooper sits in cover, a couple of foes at a time are sent round to his side ---------- */
let flankTick = 0;
function updateFlankers(hero){
  if (G.gt < flankTick) return;
  flankTick = G.gt + 0.5;
  const v = hero.cover;
  let n = 0;
  for (const e of enemies) if (e.cv && e.cv.flank && e.cv.flank.hero === hero && e.cv.flank.until > G.gt && !e.dead) n++;
  const max = Math.max(1, Math.round(CF.flankers * clamp(tacticsRamp(), 0.5, 1)));   // (one at a time early in a run)
  if (!v || n >= max || G.gt < (hero._flankCd || 0)) return;
  // the foe best placed to go round: not pinned, in the fight, nearest to either side of his cover
  const tx = -v.nz, tz = v.nx, hp = hero.pos;
  let pick = null, ps = Infinity, side = 1;
  for (const e of enemies){
    if (!coverFoe(e) || e.hero !== hero || (e.cv && e.cv.flank && e.cv.flank.until > G.gt) || e.suppT > G.gt) continue;
    const dx = e.group.position.x - hp.x, dz = e.group.position.z - hp.z, d = Math.hypot(dx, dz);
    if (d > e.t.range * 1.3) continue;
    const s = (dx * tx + dz * tz) / (d || 1);
    const sc = d * (1.2 - Math.abs(s));
    if (sc < ps){ ps = sc; pick = e; side = s >= 0 ? 1 : -1; }
  }
  if (!pick) return;
  const R = Math.min(pick.t.range * 0.7, CF.flankDist);
  let fx = hp.x + (tx * side * 0.94 + v.nx * 0.34) * R, fz = hp.z + (tz * side * 0.94 + v.nz * 0.34) * R;
  if (!shared.arenaBig){ const lx = shared.arenaHalf - 1.5, lz = (shared.arenaHalfZ || shared.arenaHalf) - 1.5; fx = clamp(fx, -lx, lx); fz = clamp(fz, -lz, lz); }
  (pick.cv || (pick.cv = {})).flank = { x: fx, z: fz, hero, until: G.gt + CF.flankTime };
  pick.cv.spot = null;
  hero._flankCd = G.gt + rand(CF.flankGap[0], CF.flankGap[1]);
  if (G.gt - (hero._flankCallT ?? -9) > 5){ hero._flankCallT = G.gt; floater(V3(pick.group.position.x, pick.group.position.y + 2.7, pick.group.position.z), 'FLANKING', '#ff8a6a'); }
}

/* ---------- each frame, for a line trooper fighting a trooper: where to go. Returns true with `out` set to a heading
   (0, 0 to hold still) and `out.pace` the stride, or false to let the plain AI move it. Sets e.cvHold while it should
   keep its head down (no shot started) ---------- */
export function coverSteer(e, dt, hero, dist, out){
  e.cvHold = false;
  if (!coverFoe(e) || !vsTrooper(hero) || e.state !== 'chase'){ return false; }
  if (hero.cover) updateFlankers(hero);
  const cv = e.cv || (e.cv = { spot: null, reT: 0, phase: 'move', t: 0, side: Math.random() < 0.5 ? 1 : -1 });
  const g = e.group.position, hp = hero.pos;
  if (e.champion && (e.champT = (e.champT || 0) - dt) <= 0){ e.champT = 0.1; champGrenade(e, hero, dist); }
  // FLANKING: round to his side of his cover, then fight from there (the plain AI shoots once it's in the open)
  const F = cv.flank;
  if (F && (F.until < G.gt || F.hero !== hero || !hero.cover)) cv.flank = null;
  if (cv.flank){
    const d = flat(g.x, g.z, cv.flank.x, cv.flank.z);
    if (d < 1.2 || heroExposedFrom(g.x, g.z, hero) && d < 5){ out.x = 0; out.z = 0; out.pace = 0.6; return d < 1.2 ? true : false; }
    out.x = (cv.flank.x - g.x) / d; out.z = (cv.flank.z - g.z) / d; out.pace = 1;
    return true;
  }
  // a fresh spot now and then, or when he has moved far enough that this one no longer hides it
  cv.reT -= dt;
  if (cv.spot && (flat(cv.spot.hx, cv.spot.hz, hp.x, hp.z) > CF.reseat || !segBlockedTall(cv.spot.x, cv.spot.z, hp.x, hp.z, hp.y + CF.chestTop))) cv.spot = null;
  if (!cv.spot && cv.reT <= 0){ cv.spot = pickSpot(e, hero); cv.reT = rand(1.5, 2.5); cv.phase = 'move'; }
  if (!cv.spot) return false;
  const S = cv.spot, ds = flat(g.x, g.z, S.x, S.z);
  const pinned = e.suppT > G.gt;
  if (cv.phase === 'move'){
    if (ds < 0.7){ cv.phase = 'hide'; cv.t = rand(CF.hide[0], CF.hide[1]); }
    else { out.x = (S.x - g.x) / ds; out.z = (S.z - g.z) / ds; out.pace = pinned ? 0.6 : 1; e.cvHold = pinned; return true; }
  }
  if (cv.phase === 'hide'){
    e.cvHold = pinned;   // (pinned, it keeps its head down even with a shot: otherwise a shot at him that shows is a shot)
    if (!pinned) cv.t -= dt;
    if (cv.t <= 0){ cv.phase = 'peek'; cv.t = CF.peekMax; cv.shotAt = e.shotAt || 0; }
    if (ds > 0.35){ out.x = (S.x - g.x) / ds; out.z = (S.z - g.z) / ds; out.pace = 0.5; } else { out.x = 0; out.z = 0; out.pace = 0; }
    return true;
  }
  // PEEK: out to the side until it has a shot, take it, and back down
  if (pinned){ cv.phase = 'hide'; cv.t = SF.duck; return true; }
  cv.t -= dt;
  if ((e.shotAt || 0) > (cv.shotAt || 0) || cv.t <= 0){
    cv.phase = 'hide'; cv.t = rand(CF.hide[0], CF.hide[1]);
    if (cv.t <= 0 || Math.random() < 0.3) cv.side = -cv.side;
    return true;
  }
  if (heroExposedFrom(g.x, g.z, hero)){ out.x = 0; out.z = 0; out.pace = 0; return true; }   // (holding the peek for the shot: the plain AI fires)
  const ax = hp.x - S.x, az = hp.z - S.z, al = Math.hypot(ax, az) || 1;
  const px = S.x + (-az / al) * cv.side * CF.peekStep, pz = S.z + (ax / al) * cv.side * CF.peekStep;
  const dp = flat(g.x, g.z, px, pz);
  if (dp < 0.3){ cv.side = -cv.side; out.x = 0; out.z = 0; return true; }   // nothing that side: the other
  out.x = (px - g.x) / dp; out.z = (pz - g.z) / dp; out.pace = 0.7;
  return true;
}
/* ---------- THE NAMED GUNMEN (a mission's duel foe on a gunman's body: the Marshal, his captain, his record) against
   the trooper. Before, a handful of headshots ended them in seconds; now they fight like the boss they are:
     · no single bolt takes more than `hitCap` of the bar (`hitCapOpen` while it reels), and no more than `burstCap` of
       it goes in over any `burstWin` s: pouring it on from one spot can't end it, he has to be worked
     · headshots land `headMul` × (a line trooper's 2.4 ×): he keeps his head down
     · they fight the cover fight (spots, peeks, his own flank) and every `nade` s lob a detonator onto him when he has
       sat in cover more than `sitFor` s: the cover is never a place to stay ---------- */
const CH = CF.champ;
export const trooperInFight = () => players.some(p => p.here !== false && p.trooper);
export function champRule(e, dmg, tick){
  if (!(dmg > 0)) return dmg;
  const open = e.state === 'stagger' || G.gt < (e.openUntil || 0);
  const at = () => V3(e.group.position.x, e.group.position.y + 2.6, e.group.position.z);
  if (!tick){
    const cap = e.maxHp * (open ? CH.hitCapOpen : CH.hitCap);
    if (dmg > cap){ dmg = cap; if (G.gt - (e.holdCallT ?? -9) > 1.5){ e.holdCallT = G.gt; floater(at(), 'ARMOURED', '#9fb8d0'); } }
  }
  const now = G.gt, B = e.burst || (e.burst = { v: 0, at: now });
  B.v = Math.max(0, B.v - e.maxHp * CH.burstCap / CH.burstWin * (now - B.at)); B.at = now;
  const room = e.maxHp * CH.burstCap - B.v;
  if (room <= 0){ if (!tick && G.gt - (e.holdCallT ?? -9) > 1.5){ e.holdCallT = G.gt; floater(at(), 'IN COVER · FLANK HIM', '#9fb8d0'); } return null; }
  dmg = Math.min(dmg, room); B.v += dmg;
  return dmg;
}
export const champHeadMul = (e) => e && e.champion && !e.ff && trooperInFight() ? CH.headMul : null;
// the detonator onto a trooper who sits in cover
function champGrenade(e, hero, dist){
  if (!e.champion || dist > 26 || dist < 5) return;
  const v = hero.cover;
  if (v) e.sitT = (e.sitT || 0) + 0.1; else e.sitT = 0;
  if (G.gt < (e.nadeT || 0) || (e.sitT || 0) < CH.sitFor) return;
  e.nadeT = G.gt + rand(CH.nade[0], CH.nade[1]);
  const g = e.group.position, hp = hero.pos, from = V3(g.x, g.y + 2.2, g.z), at = V3(hp.x + rand(-0.8, 0.8), 0, hp.z + rand(-0.8, 0.8));
  if (!lobClear(from, at)) return;   // a wall in the way, not cover: no lob through it (enemies/grenades.js)
  const fx = { ...e, t: { ...e.t, fuse: CH.fuse, dmg: CH.nadeDmg * (e.t.dmgMul || 1), blastR: CH.nadeR } };
  throwGrenade(fx, from, at, false);
  floater(V3(g.x, g.y + 2.8, g.z), 'DETONATOR', '#ffb060');
}
export function dropCover(e){ if (e.cv) e.cv = null; e.cvHold = false; }
