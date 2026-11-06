// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE KILL CAM (data/killcam.js): a big kill's short cinematic beat. killCam() asks for one where it happens (the last
// foe down: enemies/damage.js; a saber finisher on a duellist: player/jedi/finisher.js; a boss: boss/boss.js,
// boss/finale.js); updateKillCam() runs it each frame on real time and drives the slow motion and the letterbox, and
// engine/camera.js blends the shot (KC.lens, KC.look, KC.w) over the follow rig. Visual only: it never changes a
// number in the fight, and it stands down the moment anything is a threat.

import * as THREE from 'three';
import { KILLCAM } from '../data/killcam.js';
import { camera } from './renderer.js';
import { padMove } from './gamepad.js';
import { cameraClearance } from '../world/camblock.js';
import { shared, G, enemies, bolts, player, keys } from '../state.js';
import { playerPos, fwd } from '../player/helpers.js';
import { coopRun } from '../net/run.js';

const K = KILLCAM;
const now = () => performance.now() / 1000;
const ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

/* the shot camera.js reads: where the lens sits, where it looks, how far it's blended in (0..1), how much narrower */
export const KC = { w: 0, fov: 0, lens: new THREE.Vector3(), look: new THREE.Vector3() };

let shot = null, lastEnd = -1e9, bars = null, mine = 1, hudDim = false;

// is this hero clear of danger? any hostile close by (further for a shooter), an enemy shot near, a boss still up
function calm(pp, except){
  const S = K.safe;
  for (const e of enemies){
    if (e === except || e.dead || e.converted || !e.group) continue;
    const r = e.t && e.t.ranged ? S.ranged : S.melee;
    if (Math.hypot(e.group.position.x - pp.x, e.group.position.z - pp.z) < r) return false;
  }
  for (const b of bolts){
    if (b.friendly || !b.mesh) continue;
    if (b.mesh.position.distanceTo(pp) < S.bolt) return false;
  }
  const B = shared.boss;
  if (B && B !== except && B.hp > 0 && B.state !== 'dying') return false;
  return true;
}

const MOVE = ['w', 'a', 's', 'd', ' '];
/* ASK FOR ONE — kind: 'last' | 'duel' | 'takedown' | 'flank' | 'boss'; foe: the one that fell (its body is framed with the hero) */
export function killCam(kind, foe){
  const D = K.kinds[kind];
  if (!D || G.killCam === false || G.mode !== 'play' || G.cutscene || G.paused || G.sbPlan || G.sbMenu) return false;
  if (player.zoom) return false;
  if (shot && shot.kind === 'boss') return false;   // (a boss's beat is never cut over)
  const t = now();
  if (kind !== 'boss' && t - lastEnd < K.cd) return false;
  const pp = playerPos(), fp = foe && foe.group ? foe.group.position : null;
  if (!fp || Math.hypot(fp.x - pp.x, fp.z - pp.z) > K.safe.far * (kind === 'boss' ? 1.6 : 1)) return false;   // (a partner's kill, across the field)
  if (!calm(pp, foe)) return false;
  const coop = !!coopRun.live;
  // the line from the hero to the foe; the lens goes out to the side it's already on, so the view never crosses it
  let ax = fp.x - pp.x, az = fp.z - pp.z, gap = Math.hypot(ax, az);
  if (gap < 0.4){ const f = fwd(); ax = f.x; az = f.z; gap = 0.4; } else { ax /= gap; az /= gap; }
  const mx = pp.x + ax * gap * 0.5, mz = pp.z + az * gap * 0.5;
  const nx = -az, nz = ax;
  let side = Math.sign((camera.position.x - mx) * nx + (camera.position.z - mz) * nz) || 1;
  // pick the side (and, failing both, a higher lens) whose view of the pair isn't walled off by a prop
  const dist = D.dist + gap * 0.45, y0 = pp.y;
  const clearOf = (s, up) => cameraClearance(mx, y0 + D.look, mz, mx + nx * s * dist - ax * D.back, y0 + up, mz + nz * s * dist - az * D.back);
  let up = D.up;
  if (clearOf(side, up) < 0.85){
    if (clearOf(-side, up) >= 0.85) side = -side;
    else if (clearOf(side, up + 2.2) >= 0.85) up += 2.2;
    else if (clearOf(-side, up + 2.2) >= 0.85){ side = -side; up += 2.2; }
    else return false;   // boxed in: no room for a shot, so none
  }
  const held = {};
  for (const k of MOVE) held[k] = !!keys[k];
  shot = { kind, D, foe, t0: t, dur: D.dur * (coop ? K.coop : 1), coop, out: K.blend.out, end: -1,
           fx: fp.x, fz: fp.z, ax, az, mx, mz, nx: nx * side, nz: nz * side, side, dist, up, y0, held, pad: Math.hypot(padMove.x, padMove.y) > 0.5,
           swing: player.swing, block: !!player.blockHeld };
  mine = G.slowmo;
  return true;
}
export const killCamOn = () => !!shot;

// the hero's own input, after the grace: a fresh press of a move key, the stick pushed, a new swing, a guard, a scope
function heroActs(S){
  for (const k of MOVE){
    if (!keys[k]) S.held[k] = false;
    else if (!S.held[k]) return true;
  }
  const pm = Math.hypot(padMove.x, padMove.y) > 0.5;
  if (!pm) S.pad = false; else if (!S.pad) return true;
  if (player.swing && player.swing !== S.swing) return true;
  if (player.blockHeld && !S.block) return true;
  if (!player.blockHeld) S.block = false;
  return !!(player.zoom || player.dashT > 0);
}

// how deep the slow motion is `a` seconds in: all the way through the hold, easing back up over the last 40%
const holdOf = (S, a) => 1 - ss((a - S.dur * 0.6) / (S.dur * 0.4));
function stop(fast){
  if (!shot || shot.end >= 0) return;
  const S = shot, t = now();
  S.holdAt = holdOf(S, t - S.t0);   // (how deep the slow motion still was: it eases back up from there)
  S.end = t; S.out = fast ? K.blend.cut : K.blend.out;
}

/* EACH FRAME (engine/camera.js, before anything else): the shot's weight, the lens, the slow motion and the bars */
export function updateKillCam(){
  const S = shot;
  if (!S){ KC.w = 0; setBars(0); return; }
  const t = now(), a = t - S.t0;
  // anything that takes the screen or the fight away ends it at once (no blend: the next view owns the lens)
  if (G.mode !== 'play' || G.cutscene || G.sbPlan){ shot = null; lastEnd = t; KC.w = 0; setBars(0); return; }
  if (G.paused || G.sbMenu || G.skillSelect){ KC.w = 0; setBars(0); return; }   // (held: the pause cuts have the lens)
  if (S.end < 0){
    if (a >= S.dur) stop(false);
    else if (!calm(playerPos(), S.foe) || (player.camKickT != null && player.camKickT > G.gt - 0.05 && a > 0.05)) stop(true);   // a threat: hand back now
    else if (a > K.grace && heroActs(S)) stop(true);
  }
  let w;
  if (S.end < 0) w = ss(a / K.blend.in);
  else {
    w = ss(Math.min(1, (S.end - S.t0) / K.blend.in)) * (1 - ss((t - S.end) / S.out));
    if (t - S.end >= S.out){ shot = null; lastEnd = t; KC.w = 0; setBars(0); return; }
  }
  KC.w = w;
  // the lens: out to the side of the pair, low, drifting slowly round them over the shot
  const D = S.D, k = Math.min(1, a / S.dur), rot = (k - 0.5) * D.orbit * S.side;
  const c = Math.cos(rot), s = Math.sin(rot);
  const ox = S.nx * S.dist - S.ax * D.back, oz = S.nz * S.dist - S.az * D.back;
  // (the foe's body is flung by the blow: the aim follows it a little, so it stays in the shot)
  const fp = S.foe && S.foe.group ? S.foe.group.position : null, pp = playerPos();
  let fx = S.fx, fz = S.fz;
  if (fp){
    const dx = fp.x - S.fx, dz = fp.z - S.fz, dl = Math.hypot(dx, dz), m = dl > K.follow ? K.follow / dl : 1;
    fx += dx * m; fz += dz * m;
  }
  const lx = pp.x * 0.55 + fx * 0.45, lz = pp.z * 0.55 + fz * 0.45;
  const cx = (S.mx + lx) * 0.5, cz = (S.mz + lz) * 0.5;
  KC.lens.set(cx + ox * c - oz * s, Math.max(0.5, S.y0 + S.up), cz + ox * s + oz * c);
  KC.look.set(lx, S.y0 + D.look, lz);
  KC.fov = D.fov * w;
  // SLOW MOTION — the whole world slows together (main.js dt), deepest through the hold and easing back out. Not in
  // a shared fight: the world there can't be slowed for one hero, and slowing only this one would hand the foes a beat
  if (!S.coop){
    const hold = S.end < 0 ? holdOf(S, a) : S.holdAt * (1 - ss((t - S.end) / S.out));
    const sm = 1 - (1 - D.slow) * hold;
    // (set outright, so it can ease back up; only a deeper dip someone else asked for this frame is kept)
    G.slowmo = G.slowmo < mine - 1e-3 ? Math.min(G.slowmo, sm) : sm;
    G.slowmoT = Math.max(G.slowmoT, 0.04);
    mine = G.slowmo;
  }
  setBars(w);
}

// the letterbox: two thin black bars that slide in with the shot
function setBars(w){
  if (!bars){
    if (w <= 0) return;
    bars = [0, 1].map(i => {
      const d = document.createElement('div');
      d.className = 'kc-bar ' + (i ? 'bot' : 'top');
      const hud = document.getElementById('hud');   // (under the HUD: the bars frame the shot, they never hide a bar of yours)
      if (hud) hud.before(d); else document.body.appendChild(d);
      return d;
    });
  }
  const h = (K.bars * 100 * w).toFixed(2) + 'vh';
  for (const d of bars) d.style.height = h;
  // the HUD steps back for the shot
  const hud = document.getElementById('hud');
  if (hud){ if (w > 0){ hud.style.opacity = (1 - (1 - K.hud) * w).toFixed(3); hud.style.transition = 'none'; hudDim = true; }
            else if (hudDim){ hud.style.opacity = ''; hud.style.transition = ''; hudDim = false; } }
}
