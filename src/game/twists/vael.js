// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WALK OUT (Vael's Chains): Vael is free, but he can barely walk, and he won't leave before the last child. He goes
// out behind the line, slow, and the hold goes with him: its zone is wherever he is, so the stand you're holding creeps
// up the floor toward the gate as the children get out, through whatever is in the way. When the hold stalls (foes on
// him and you away) he stops where he is and waits for you.
//   path: [[x, z]…] the way he walks (the hold's zone follows him along it as its progress climbs) · who: the cast name
//   of the one walking (data/cast.js) · line: { jedi } the banner's line
import { TW, line } from './kit.js';
import { enemies } from '../../state.js';
import { showBanner } from '../../ui/banners.js';
import { makeFigure, stepFigure, dropFigure } from '../cast.js';

function along(P, f){
  let len = 0; const seg = [];
  for (let i = 0; i < P.length - 1; i++){ const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); seg.push(l); len += l; }
  let d = Math.max(0, Math.min(1, f)) * len;
  for (let i = 0; i < seg.length; i++){
    if (d <= seg[i] || i === seg.length - 1){ const t = Math.min(1, d / (seg[i] || 1)); return [P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t, Math.atan2(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1])]; }
    d -= seg[i];
  }
  return [P[0][0], P[0][1], 0];
}
export default {
  begin(){ TW.s = { F: null, said: false, x: null, z: null, f: 0 }; },
  update(tw, dt, ctx){
    const S = TW.s, f = ctx.frac || 0, [x, z, yaw] = along(tw.path, f);
    const moving = f > S.f + 1e-5; S.f = f;
    if (!S.F) S.F = makeFigure(tw.who || 'MASTER VAEL', x, z, yaw);
    if (S.F){
      const g = S.F.g;
      g.position.x = x; g.position.z = z;
      g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 3);
      // wounded: he leans on the walk, and stops dead when it stalls
      g.rotation.x = moving ? 0.12 + Math.sin(TW.t * 4.2) * 0.04 : 0.05;
      S.F.look = moving ? null : { x: x + Math.sin(yaw) * 4, z: z + Math.cos(yaw) * 4 };
      stepFigure(S.F, dt);
    }
    TW.k = 0;
    if (!S.said && !ctx.guest){ S.said = true; showBanner('VAEL WALKS OUT', line(tw), 4, { kicker: 'THE HOLD MOVES' }); }
    if (ctx.guest || !ctx.o || !ctx.s || !ctx.s.zone) return;
    // the hold's zone is where he is: the objective reads o.at every frame, and the foes marching on it turn with it
    if (S.x === null || Math.hypot(x - S.x, z - S.z) > 0.02){
      S.x = x; S.z = z;
      ctx.o.at = [x, z];
      ctx.s.zone.position.set(x, 0, z);
      for (const e of enemies) if (e.goal && e.goal.pos) e.goal.pos.set(x, 0, z);
    }
  },
  end(){ if (TW.s.F){ dropFigure(TW.s.F); TW.s.F = null; } },
};
