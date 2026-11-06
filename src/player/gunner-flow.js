// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GUNNERS' FLOW METERS (data/gunner-flow.js): the Mandalorian's HUNTER'S EYE and the ARC trooper's BATTLE RHYTHM,
// each with its signature move at the top: DEAD EYE (the Mando tags up to three heads and drops them in slow motion) and
// COORDINATED FIRE (the trooper marks a foe and his squad puts one volley into it on his call).
// The feats feed in from where they happen: enemies/bolts.js (headshots, ricochets, the trooper's flanks),
// enemies/damage.js (kills), enemies/coverfight.js (pins), player/mando/weapons.js (the perfect vent),
// player/trooper/cover.js (cover to cover), player/damage.js (getting hit). The edges are read by mando/weapons.js (the
// cone), mando/flight.js (fuel), trooper/cover.js (suppression's shake) and trooper/command.js (command points).
// player.flow holds the meter; player.flowSig the signature move while it plays out.

import * as THREE from 'three';
import { HUNT, RHYTHM } from '../data/gunner-flow.js';
import { MANDO_WEAPONS, HEADSHOT_MULT } from '../data/mando.js';
import { damageEnemy, flinchEnemy } from '../enemies/damage.js';
import { champHeadMul } from '../enemies/coverfight.js';
import { spawnHitSpark } from '../fx/vfx.js';
import { camera } from '../engine/renderer.js';
import { killCam, killCamOn } from '../engine/killcam.js';
import { padKey } from '../engine/gamepad.js';
import { padLayout } from '../data/gamepad.js';
import { coopRun, hooks } from '../net/run.js';
import { MERC } from '../game/alignment.js';
import { G, enemies, bolts, solids, player, isGunner, isMando, isTrooper } from '../state.js';
import { playerPos, fwd, rightV } from './helpers.js';
import { crosshairPoint } from './aim.js';
import { headPos, chestPos } from '../enemies/bodyshape.js';
import { spawnBlasterBolt } from './mando/weapons.js';
import { fireBolt } from '../enemies/bolts.js';
import { allies } from '../allies/squad.js';
import { sfx } from '../audio/sfx.js';
import { V3, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { showBanner } from '../ui/banners.js';
import { tutEvent } from '../game/tutor-bus.js';

// the meter this hero fights with (null: the Jedi, who has Focus)
export const flowDef = () => isMando() ? HUNT : isTrooper() ? RHYTHM : null;
export function flowTier(){
  const D = flowDef(); if (!D) return 0;
  const f = player.flow || 0;
  if (f >= D.thresh[2]) player.flowReady = true;           // full: the signature is READY, and stays so while the
  else if (f <= D.thresh[1]) player.flowReady = false;     // meter only ebbs (a hit or a long lull takes it back down)
  return player.flowReady ? 3 : f >= D.thresh[1] ? 2 : f >= D.thresh[0] ? 1 : 0;
}
export function resetFlow(){ player.flowReady = false; player.flow = 0; player.flowIdle = 9; player._flowTier = 0; player.flowSig = null; }

// a feat: `why` is a key of the meter's `gain` table (or a number)
export function addFlow(why){
  const D = flowDef();
  if (!D || G.mode !== 'play' || player.flowSig) return;
  const n = typeof why === 'number' ? why : (D.gain[why] || 0);
  if (!n) return;
  player.flow = clamp((player.flow || 0) + n, 0, 100);
  player.flowIdle = 0;
}
// a hit landed on him (player/damage.js): the trooper keeps more of it when the cover took the blow
export function flowHurt(){
  const D = flowDef(); if (!D || player.flowSig) return;
  player.flow = (player.flow || 0) * (isTrooper() && player.cover ? D.hurtCover : D.hurt);
}

/* ---------- THE EDGES (tiers 1 and 2) ---------- */
export const flowSpreadMul = () => isMando() && flowTier() >= 1 ? HUNT.steady : 1;        // the blasters' cone (mando/weapons.js)
export const flowJetMul = () => isMando() && flowTier() >= 2 ? HUNT.jetRegen : 1;         // jet fuel back (mando/flight.js)
export const flowSuppMul = () => isTrooper() && flowTier() >= 1 ? RHYTHM.steady : 1;      // suppression's shake (trooper/cover.js)
export const flowCpMul = () => isTrooper() && flowTier() >= 2 ? RHYTHM.cpGain : 1;        // command points (trooper/command.js)

/* ---------- THE FEATS that need a little reading ---------- */
const facing = (e) => { const r = e.group.rotation.y; return { x: Math.sin(r), z: Math.cos(r) }; };
// the trooper's shot struck this foe from its side or back (or while it was pinned down)?
function flanked(e, dir){
  if (!e || !e.group) return false;
  if (e.suppT > G.gt) return true;
  if (!dir) return false;
  const f = facing(e), l = Math.hypot(dir.x, dir.z) || 1;
  return (f.x * dir.x + f.z * dir.z) / l > RHYTHM.flankDot;
}
// a bolt of the trooper's landed (enemies/bolts.js)
export function flowShotHit(e, dir){
  if (!isTrooper() || MERC.guest || !flanked(e, dir)) return;
  if (G.gt - (e.flowFlankT ?? -9) < 0.5) return;   // a burst is one flank, not three
  e.flowFlankT = G.gt;
  addFlow('flank');
}
// he got into cover (trooper/cover.js takeCover): a dash from the last cover to a new one, or into it under fire
export function flowCoverTaken(){
  if (!isTrooper()) return;
  const pp = playerPos(), L = player.flowCoverLeft;
  const moved = L && G.gt - L.t < RHYTHM.coverMove && Math.hypot(pp.x - L.x, pp.z - L.z) > 3;
  if (moved || (player.supp || 0) >= RHYTHM.coverSupp) addFlow('coverMove');
}
export function flowCoverLeft(){ const pp = playerPos(); player.flowCoverLeft = { t: G.gt, x: pp.x, z: pp.z }; }
// the hero's own kill (enemies/damage.js, after the fight's last-foe beat)
export function flowKill(e, dir){
  if (!flowDef() || MERC.guest) return;   // (co-op: a guest's blow applied on the host's browser is the guest's kill, fed on their side)
  if (isMando()){
    addFlow(player.grounded ? 'kill' : 'airKill');
    return;
  }
  const flank = flanked(e, dir);
  addFlow(flank ? 'flankKill' : player.cover ? 'coverKill' : 'kill');
  // the payoff: a flank on a pinned foe, or the squad's volley, gets the kill cam's side-on beat (when it's safe)
  if ((flank || e.volleyT > G.gt) && !killCamOn()) killCam('flank', e);
}
// the Mando's takedown kills (mando/melee.js)
export function flowTakedown(e){
  if (!isMando() || MERC.guest) return;
  addFlow('takedown');
  if (e && e.dead && !killCamOn()) killCam('takedown', e);
}

/* ---------- THE SIGNATURE (tier 3): T for the Mando, Y for the trooper ---------- */
const sigKey = () => isMando() ? 't' : 'y';
export function flowKeyLabel(){
  const k = sigKey();
  return typeof document !== 'undefined' && document.body.classList.contains('pad') ? padKey(k, padLayout(G.hero)) : k.toUpperCase();
}
const _p = new THREE.Vector3(), _c = new THREE.Vector3();
// a bolt from a to b gets there: nothing solid in the way at the height it flies (enemies/bolts.js stops bolts the same
// way), so a head over low cover can be tagged and one behind a wall can't
function clearShot(a, b){
  const d = a.distanceTo(b), n = Math.max(2, Math.ceil(d / 0.4));
  for (let i = 1; i < n; i++){
    const t = i / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    for (const c of solids){
      if (c.climbable || y >= c.h || y < (c.y0 || 0)) continue;
      if (c.box ? (x > c.x - c.hx && x < c.x + c.hx && z > c.z - c.hz && z < c.z + c.hz) : Math.hypot(x - c.x, z - c.z) < c.r) return false;
    }
  }
  return true;
}
// foes nearest the reticle, on screen, in reach and in clear sight of the hero: [{ e, off }]
function marks(range, cone, max){
  const pp = playerPos(), ch = crosshairPoint(player.aimOff ? player.aimOff.x : 0, player.aimOff ? player.aimOff.y : 0);
  _c.copy(ch).project(camera);
  const out = [];
  for (const e of enemies){
    if (e.dead || e.converted || !e.group || e.state === 'dying') continue;
    const g = e.group.position;
    if (Math.hypot(g.x - pp.x, g.z - pp.z) > range) continue;
    headPos(e, _p).project(camera);
    if (_p.z > 1 || Math.abs(_p.x) > 1 || Math.abs(_p.y) > 1) continue;   // (behind the lens, or off the screen)
    const off = Math.hypot(_p.x - _c.x, (_p.y - _c.y) / camera.aspect);
    if (off > cone) continue;
    if (!clearShot(V3(pp.x, pp.y + 1.75, pp.z), headPos(e, V3()))) continue;
    out.push({ e, off });
  }
  return out.sort((a, b) => a.off - b.off).slice(0, max);
}
function slowFor(S, shots){
  if (coopRun.live) return;   // (a shared world can't slow for one hero: the kill cam's own co-op rule)
  G.slowmo = Math.min(G.slowmo, S.slow);
  G.slowmoT = Math.max(G.slowmoT || 0, S.hold + (S.delay + S.gap * shots) / S.slow);
}
export function flowSignature(k, repeat){
  if (repeat || G.mode !== 'play' || G.cutscene || G.paused || k !== sigKey() || !flowDef()) return false;
  if (player.flowSig) return true;
  const pp = playerPos();
  if (flowTier() < 3){
    if (G.gt - (player.flowNagT ?? -9) > 0.6){ player.flowNagT = G.gt; floater(V3(pp.x, pp.y + 2.3, pp.z), (isMando() ? 'HUNTER\'S EYE' : 'BATTLE RHYTHM') + ' NOT FULL', '#9fb8d0'); sfx(140, 0.08, 'square', 0.03, 100); }
    return true;
  }
  return isMando() ? deadEye(pp) : coordinatedFire(pp);
}
function deadEye(pp){
  const S = HUNT.deadEye, list = marks(S.range, S.cone, S.max);
  if (!list.length){ floater(V3(pp.x, pp.y + 2.3, pp.z), 'NO TARGETS', '#ffc46a'); sfx(160, 0.08, 'square', 0.03, 120); return true; }
  player.flow = 0; player._flowTier = 0; player.flowReady = false;
  player.flowSig = { kind: 'deadEye', shots: list.map((m, i) => ({ e: m.e, at: G.gt + S.delay + S.gap * i })), end: G.gt + S.delay + S.gap * list.length + 0.1 };
  for (const m of list){
    const h = headPos(m.e, V3());
    floater(V3(h.x, h.y + 0.5, h.z), '◎', '#ffc46a');
    m.e.deadEyeT = G.gt + 1.5;
  }
  slowFor(S, list.length);
  floater(V3(pp.x, pp.y + 2.4, pp.z), 'DEAD EYE', '#ffc46a');
  screenFlash('radial-gradient(ellipse at center, transparent 45%, rgba(255,180,80,.22))', 0.6, 0.35);
  sfx(240, 0.3, 'sine', 0.06, 120); sfx(1800, 0.12, 'triangle', 0.04, 2400);
  tutEvent('deadEye');
  return true;
}
function coordinatedFire(pp){
  const S = RHYTHM.volley, [m] = marks(S.range, S.cone, 1);
  if (!m){ floater(V3(pp.x, pp.y + 2.3, pp.z), 'NO TARGET', '#9fd4ff'); sfx(160, 0.08, 'square', 0.03, 120); return true; }
  const mates = allies.filter(a => a.group && a.state !== 'down' && !(a.dazeT > G.gt) && Math.hypot(a.group.position.x - pp.x, a.group.position.z - pp.z) < S.reach);
  if (!mates.length){ floater(V3(pp.x, pp.y + 2.3, pp.z), 'NO SQUAD IN REACH', '#9fd4ff'); sfx(160, 0.08, 'square', 0.03, 120); return true; }
  player.flow = 0; player._flowTier = 0; player.flowReady = false;
  const e = m.e;
  e.volleyT = G.gt + 2.5;
  player.flowSig = { kind: 'volley', shots: mates.map((a, i) => ({ e, a, at: G.gt + S.delay + S.gap * i })), end: G.gt + S.delay + S.gap * mates.length + 0.1 };
  const h = headPos(e, V3());
  floater(V3(h.x, h.y + 0.6, h.z), 'ON MY MARK', '#6ab8ff');
  slowFor(S, mates.length);
  floater(V3(pp.x, pp.y + 2.4, pp.z), 'COORDINATED FIRE', '#9fd4ff');
  sfx(520, 0.1, 'square', 0.05, 780); sfx(780, 0.14, 'square', 0.04, 1040);
  tutEvent('volley');
  return true;
}
/* one shot of the signature, when its moment comes. The bolt is drawn flying (a partner sees it too: mando/weapons.js
   spawnBlasterBolt's co-op hook) but it never misses: the blow lands when the bolt gets there (landSig), so a body in
   between or a foe that steps can't waste the move the meter paid for. */
function fireSig(s, kind){
  const e = s.e;
  if (!e || e.dead || e.converted || !e.group) return;
  let from, to, S;
  if (kind === 'deadEye'){
    S = HUNT.deadEye;
    const pp = playerPos(), f = fwd(), r = rightV();
    from = V3(pp.x + r.x * 0.26 + f.x * 0.65, pp.y + 1.78, pp.z + r.z * 0.26 + f.z * 0.65);
    to = headPos(e, V3());
    const W = MANDO_WEAPONS[player.weapon] && !MANDO_WEAPONS[player.weapon].melee ? MANDO_WEAPONS[player.weapon] : MANDO_WEAPONS.single;
    spawnBlasterBolt(from, V3(to.x - from.x, to.y - from.y, to.z - from.z).normalize(), 0, S.color, 1.35, W, { spread: 0, to, quiet: true });
    sfx(1500, 0.07, 'square', 0.06, 380);
    G.shake = Math.max(G.shake, 0.2);
  } else {
    S = RHYTHM.volley;
    const a = s.a;
    if (!a || !a.group) return;
    const g = a.group, sc = (a.t && a.t.scale) || 1, fy = g.rotation.y;
    from = V3(g.position.x + Math.sin(fy) * 0.55, g.position.y + 1.42 * sc, g.position.z + Math.cos(fy) * 0.55);
    to = chestPos(e, V3());
    fireBolt(from, V3(to.x - from.x, to.y - from.y, to.z - from.z).normalize(), S.speed, 0, true, true);
    const b = bolts[bolts.length - 1];
    if (b){ b.mesh.material.color.setHex(S.color); b.mesh.scale.set(1.3, 1.7, 1.3); }
    a.kick = 1;
    sfx(700, 0.05, 'square', 0.04, 300);
  }
  const b = bolts[bolts.length - 1], dist = from.distanceTo(to);
  if (b){
    b.speed = S.speed; b.ghost = true; b.life = dist / S.speed;   // (drawn only: it ends where it lands)
    if (hooks.pbolt) hooks.pbolt(b, S.color, 1.35);   // co-op: the partner sees every bolt of it fly, at its real speed
  }
  s.hitAt = G.gt + dist / S.speed;
  s.dir = V3(to.x - from.x, 0, to.z - from.z).normalize();
}
function landSig(s, kind){
  const e = s.e;
  if (!e || e.dead || e.converted || !e.group) return;
  if (kind === 'deadEye'){
    const h = headPos(e, V3());
    damageEnemy(e, HUNT.deadEye.dmg * (champHeadMul(e) ?? HEADSHOT_MULT), s.dir, 8);
    flinchEnemy(e, s.dir, 1.2);
    spawnHitSpark(V3(h.x, h.y + 0.1, h.z), 0xffd24a, 1.6);
    floater(V3(h.x, h.y + 0.45, h.z), 'HEADSHOT', '#ffd24a');
    G.hitstop = Math.max(G.hitstop, 0.04);
  } else {
    const c = chestPos(e, V3());
    damageEnemy(e, RHYTHM.volley.dmg, s.dir, 8);
    flinchEnemy(e, s.dir, 1.1);
    spawnHitSpark(c, RHYTHM.volley.color, 1.2);
  }
  player.hitMarkT = 1; player.hitMarkKind = e.dead ? 'kill' : 'head';
}

/* ---------- EACH FRAME (player/update.js) ---------- */
export function updateGunnerFlow(dt){
  const D = flowDef();
  if (!D){ if (player.flow) resetFlow(); return; }
  const S = player.flowSig;
  if (S){
    let live = false;
    for (const s of S.shots){
      if (!s.done){ live = true;
        if (G.gt >= s.at){
          s.done = true;
          if (S.kind === 'volley' && (!s.e || s.e.dead)){ const [m] = marks(RHYTHM.volley.range, 1, 1); s.e = m ? m.e : null; if (s.e) s.e.volleyT = G.gt + 2.5; }   // (it fell: the rest of the volley finds the next one)
          fireSig(s, S.kind);
        } }
      else if (s.hitAt != null && !s.hit){ live = true; if (G.gt >= s.hitAt){ s.hit = true; landSig(s, S.kind); } }
    }
    if (!live || G.gt > S.end + 2) player.flowSig = null;
    return;
  }
  player.flowIdle = (player.flowIdle || 0) + dt;
  const t = flowTier();
  const drain = t >= 3 ? D.ebb : player.flowIdle > D.idle ? D.decay : 0;
  if (drain) player.flow = Math.max(0, (player.flow || 0) - drain * dt);
  if (t > (player._flowTier || 0)){   // a tier-up beat
    const pp = playerPos(), col = isMando() ? '#ffc46a' : '#9fd4ff', hex = isMando() ? 0xffc46a : 0x9fd4ff;
    floater(V3(pp.x, pp.y + 2.2, pp.z), D.names[t], col);
    burst(V3(pp.x, pp.y + 1.4, pp.z), hex, 10, 6, 4);
    sfx(t >= 3 ? 660 : 440, 0.16, 'sine', 0.08, t >= 3 ? 1200 : 820);
    if (t >= 3) showBanner('', D.names[3] + ' READY · ' + flowKeyLabel(), 1.1);
  }
  player._flowTier = t;
}
