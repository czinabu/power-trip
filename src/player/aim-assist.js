// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CONTROLLER AIM ASSIST — the blasters on a pad (engine/gamepad.js). A thumbstick can't make the small, quick corrections
// a mouse can, so with a gun out (the Mando's or the trooper's, never a blade) the view helps a little:
//   SLOWDOWN  the look slows as the crosshair crosses a foe, so a sweep of the stick settles on him instead of past
//   PULL      while you are aiming (the right stick) or moving (the left), the view leans gently toward the foe nearest
//             the crosshair, so it follows a strafing trooper you are already tracking
// It never turns the view while you leave both sticks alone, never reaches through a wall, and the mouse never gets it.
// Off in Settings (AIM ASSIST, G.padAssist). Tuning: data/gamepad.js AIM_ASSIST.

import * as THREE from 'three';
import { camera } from '../engine/renderer.js';
import { G, enemies, player, isGunner } from '../state.js';
import { clamp } from '../utils.js';
import { AIM_ASSIST as A } from '../data/gamepad.js';
import { bodyRadius, bodyHeight } from '../enemies/bodyshape.js';
import { sweepSolids } from '../world/collision.js';
import { mandoWeapon } from './mando/weapons.js';

const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _q = new THREE.Vector3();
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

function assistOn(){
  if (!G.padAssist || G.mode !== 'play' || G.paused || G.sbMenu || !isGunner() || !player.group) return false;
  const W = mandoWeapon();
  return !W.melee && W.fire !== 'fists' && W.fire !== 'saber' && player.weapon !== 'darksaber';
}

/* the foe nearest the crosshair (how far off its body's edge, in radians), within the assist's reach and in sight */
function nearestFoe(o, d){
  let best = null, bestOff = A.pullAng;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || e.dummy === 'off') continue;
    const p = e.group.position, h = bodyHeight(e);
    const vx = p.x - o.x, vy = p.y + h * 0.6 - o.y, vz = p.z - o.z, dist = Math.hypot(vx, vy, vz);
    if (dist < 2 || dist > A.far) continue;
    const c = clamp((vx*d.x + vy*d.y + vz*d.z) / dist, -1, 1);
    if (c <= 0) continue;
    const off = Math.acos(c) - Math.atan(bodyRadius(e) / dist);
    if (off < bestOff){ bestOff = off; best = e; }
  }
  if (!best) return null;
  const p = best.group.position;
  _q.set(p.x, p.y + bodyHeight(best) * 0.6, p.z);
  if (sweepSolids(o.x, o.y, o.z, _q.x, _q.y, _q.z, 0)) return null;   // behind cover: no help through it
  return { e: best, off: Math.max(0, bestOff), at: _q };
}

/* each frame from the pad's look code: `looking` (the right stick is pushed), `moving` (the left one is). Leans the view
   toward the foe by the crosshair and returns how much to scale the right stick's look speed this frame (1 = none). */
export function padAimAssist(dt, looking, moving){
  if (!assistOn()) return 1;
  _ndc.set(player.aimOff.x * 2 / innerWidth, -player.aimOff.y * 2 / innerHeight);
  _ray.setFromCamera(_ndc, camera);
  const o = _ray.ray.origin, d = _ray.ray.direction;
  const hit = nearestFoe(o, d);
  if (!hit) return 1;
  const zoomed = !!player.zoom, ads = zoomed || player.blockHeld;
  // PULL: only while the player is steering, scaled down toward the zone's edge, and a touch stronger down the sights
  if ((looking || moving) && !zoomed){
    const w = 1 - hit.off / A.pullAng;
    const k = Math.min(1, A.pull * (ads ? A.adsPull : 1) * w * dt);
    const qx = hit.at.x - o.x, qy = hit.at.y - o.y, qz = hit.at.z - o.z, ql = Math.hypot(qx, qy, qz);
    // the view's yaw runs atan2(x, z) (fwd = sin yaw, cos yaw) and its pitch looks DOWN as it grows (player/aim.js)
    G.yaw += wrap(Math.atan2(qx, qz) - Math.atan2(d.x, d.z)) * k;
    G.pitch = clamp(G.pitch - (Math.asin(clamp(qy / ql, -1, 1)) - Math.asin(clamp(d.y, -1, 1))) * k, -0.62, 1.2);
  }
  // SLOWDOWN: over the body or just beside it
  return hit.off < A.slowAng ? (ads ? A.adsSlow : A.slow) : 1;
}
