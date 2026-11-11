// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Saber assist: which foe a cut is meant for (the one nearest the crosshair), and how far the body turns toward it.
// Data and the rules: data/saber-assist.js. Read by jedi/combat.js (the lunge) and animation.js (the body's facing).

import { SABER_ASSIST } from '../../data/saber-assist.js';
import { CFG } from '../../data/config.js';
import { wrapAngle, clamp } from '../../utils.js';
import { shared, G, enemies, player } from '../../state.js';
import { playerPos } from '../helpers.js';
import { bodyRadius } from './bladehit.js';

const D2R = Math.PI / 180;
const level = () => SABER_ASSIST[G.saberAssist] || null;
const padOn = () => typeof document !== 'undefined' && document.body && document.body.classList.contains('pad');
const live = t => !!t && t.group && (t === shared.boss ? t.hp > 0 : !t.dead && !t.converted && t.state !== 'spawn');

/* the foe this cut is aimed at, or null: the locked foe if there is one in reach, else the one nearest the crosshair
   (within the cone, inside `range` m of the hero). The crosshair's line runs from the hero along the view (player/aim.js
   heroCrosshair), so "near the crosshair" is the angle off the view's heading. */
export function assistTarget(range){
  const pp = playerPos();
  const lt = player.lockTarget;
  const reach = live(lt) && Math.hypot(lt.group.position.x - pp.x, lt.group.position.z - pp.z) <= range + 1;
  if (reach && !player.lockLoose) return lt;
  // (a loose focus, player/lockon.js: the cut goes to whoever the crosshair is on; with nobody there, to the marked foe
  // if it is in front of you)
  const fallback = reach && Math.abs(wrapAngle(Math.atan2(lt.group.position.x - pp.x, lt.group.position.z - pp.z) - G.yaw)) < 1.2 ? lt : null;
  const L = level();
  if (!L) return fallback;
  const cone = (L.cone + (padOn() ? SABER_ASSIST.pad : 0)) * D2R;
  let best = null, bs = 1e9;
  const consider = (t, r) => {
    if (!live(t)) return;
    const p = t.group.position, dx = p.x - pp.x, dz = p.z - pp.z, d = Math.hypot(dx, dz);
    if (d < 0.05 || d - r > range) return;
    // the angle off the crosshair, less the half-width the body takes up at that distance
    const off = Math.max(0, Math.abs(wrapAngle(Math.atan2(dx, dz) - G.yaw)) - Math.asin(Math.min(1, r / d)));
    if (off > cone) return;
    const sc = off / cone + 0.35 * d / range;   // centred matters most, near breaks a tie
    if (sc < bs){ bs = sc; best = t; }
  };
  for (const e of enemies) consider(e, bodyRadius(e));
  if (shared.boss) consider(shared.boss, 0.75);
  return best || fallback;
}

/* the body's heading for a cut aimed at `t`: the view's heading, turned toward the foe by at most the setting's `turn`
   (a locked foe: the full way, the lock already frames it). Null once the foe is gone. */
export function assistFace(t){
  if (!live(t)) return null;
  const pp = playerPos(), p = t.group.position;
  const want = Math.atan2(p.x - pp.x, p.z - pp.z);
  if (t === player.lockTarget && !player.lockLoose) return want;
  const L = level();
  if (!L) return null;
  const lim = L.turn * D2R;
  return G.yaw + clamp(wrapAngle(want - G.yaw), -lim, lim);
}

export function comboRange(st){ return (st.reach && st.reach.range) ?? CFG.player.comboRange; }
