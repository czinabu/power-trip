// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A GUARD ON HIS BEAT (the infiltrate objective: game/infiltrate.js). A foe with `e.patrol` that hasn't been alerted walks
// its points (back and forth, a pause at each end), or stands its post and looks side to side; it doesn't fight, and the
// squad leaves it be (allies/squad.js). enemies/ai.js hands it here instead of chasing; once `alert` is set it's a foe like
// any other.
//   e.patrol = { pts: [[x, z]…], k, dir, wait, pause, spd, face, sweep, period, look: { x, z, t } | null, alert }

import { MOVE } from '../data/movement.js';

const turnTo = (g, want, rate, dt) => {
  const d = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
  g.rotation.y += Math.max(-rate * dt, Math.min(rate * dt, d));
};
export const unaware = (e) => !!(e && e.patrol && !e.patrol.alert && !e.dead);

// one frame of the beat. True: it took the frame (the chase is skipped)
export function patrolStep(e, dt){
  const P = e.patrol, g = e.group;
  if (!P || P.alert) return false;
  e.walking = false;
  // something caught his eye (a glimpse of you, the Jedi's tug): he stands and stares that way
  if (P.look && P.look.t > 0){
    P.look.t -= dt;
    turnTo(g, Math.atan2(P.look.x - g.position.x, P.look.z - g.position.z), MOVE.turnRate * 0.7, dt);
    if (P.look.t <= 0) P.look = null;
    return true;
  }
  const pts = P.pts;
  if (pts.length < 2 || P.wait > 0){   // at a post (or the end of the beat): look side to side
    if (P.wait > 0) P.wait -= dt;
    P.st = (P.st || 0) + dt;
    const face = P.face != null ? P.face : g.rotation.y;
    if (P.face == null) P.face = face;
    const want = face + Math.sin(P.st * Math.PI * 2 / (P.period || 6)) * (P.sweep ?? 0.6);
    turnTo(g, want, MOVE.turnRate * 0.5, dt);
    return true;
  }
  const [tx, tz] = pts[P.k], dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz);
  if (d < 0.35){
    // the end of the beat: a pause, looking on the way he was going, then back the other way
    if (P.k === 0 || P.k === pts.length - 1){ P.wait = P.pause; P.face = g.rotation.y; P.st = 0; P.dir = P.k === 0 ? 1 : -1; }
    P.k = Math.max(0, Math.min(pts.length - 1, P.k + (P.dir || 1)));
    return true;
  }
  P.face = null;
  const step = Math.min(d, (P.spd || 1.6) * dt);
  g.position.x += dx / d * step; g.position.z += dz / d * step;
  turnTo(g, Math.atan2(dx, dz), MOVE.turnRate * 0.6, dt);
  e.walking = true;
  return true;
}
