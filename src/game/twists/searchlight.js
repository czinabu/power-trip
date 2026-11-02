// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SEARCHLIGHTS (the Lothal Breakout's cell blocks): the outpost's towers sweep the yard with their lights while you open
// the cells. Get caught in a beam and the alarm goes: the guard comes running for wherever you're standing, and the
// panel you were working loses ground. The first time it only warns you. The beams sweep in slow figure-eights, so
// each panel has its gaps: work in the dark and step out as the light comes round.
//   beams: [{ from: [x, y, z] its tower, c: [x, z] the middle of its sweep, a: [ax, az] how far it swings, period, ph }]
//   r: the lit spot's radius · cool: seconds after an alarm before that beam can raise another · group: { type: n } who
//   comes running · line: { jedi, mando }
import { TW, prop, line, discMesh, ringMesh, beamMesh, layBeam, heroes } from './kit.js';
import { enemies } from '../../state.js';
import { V3, rand } from '../../utils.js';
import { spawnEnemy } from '../../enemies/spawn.js';
import { findClearSpawn } from '../../world/collision.js';
import { holdPoolLight } from '../../fx/lights.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { sfx } from '../../audio/sfx.js';
import { heroIn } from '../objectives.js';

const LIT = 0xfff0c0, ALARM = 0xff3a2a;
function spotAt(b, t){
  const w = Math.PI * 2 / (b.period || 12), u = t * w + (b.ph || 0);
  return [b.c[0] + b.a[0] * Math.sin(u), b.c[1] + b.a[1] * Math.sin(2 * u + 0.6)];
}
export default {
  mood: { fill: 0.55, sun: 0.35, rim: 0.7, sky: 0.45, fog: 0x141a26 },   // the outpost after dark
  begin(tw){
    TW.s = { n: 0, beams: tw.beams.map(() => ({ cool: 0, red: 0 })) };
  },
  update(tw, dt, ctx){
    const S = TW.s, r = tw.r ?? 3.6;
    TW.k = Math.min(1, TW.k + dt * 0.4);
    tw.beams.forEach((b, i) => {
      const B = S.beams[i];
      if (!B.disc){
        B.disc = prop(discMesh(LIT, 0.32)); B.edge = prop(ringMesh(LIT, 0.08, 0.7)); B.cone = prop(beamMesh(LIT, 0.35, 0.07, r));
        B.light = holdPoolLight(LIT, 0, 14); if (B.light) TW.lights.push(B.light);
      }
      const [x, z] = spotAt(b, TW.t), red = B.red > 0;
      B.red = Math.max(0, B.red - dt);
      const col = red ? ALARM : LIT;
      for (const m of [B.disc, B.edge, B.cone]) m.material.color.setHex(col);
      B.disc.position.set(x, 0.07, z); B.disc.scale.setScalar(r);
      B.edge.position.set(x, 0.09, z); B.edge.scale.setScalar(r);
      layBeam(B.cone, { x: b.from[0], y: b.from[1], z: b.from[2] }, { x, y: 0, z });
      if (B.light){ B.light.position.set(x, 4, z); B.light.color.setHex(col); B.light.intensity = 9 * TW.k; }
      B.x = x; B.z = z;
      if (ctx.guest) return;
      // caught in it
      B.cool -= dt;
      if (B.cool > 0 || !heroes().some(h => Math.hypot(h.pos.x - x, h.pos.z - z) < r)) return;
      B.cool = tw.cool ?? 7; B.red = 1.6;
      sfx(880, 0.5, 'square', 0.04, 660); sfx(660, 0.5, 'square', 0.03, 880);
      if (!S.n++){ showBanner('SPOTTED', line(tw), 3.6, { kicker: 'SEARCHLIGHTS' }); return; }   // the first only warns
      showBanner('', 'ALARM · THE GUARD IS COMING', 1.6);
      // the panel you were on loses ground, and the guard runs for where you were seen
      const cons = ctx.s && ctx.s.cons;
      if (cons) for (const c of cons) if (!c.done && heroIn(c.x, c.z, (ctx.o && ctx.o.r) || 2.4)){ c.prog = Math.max(0, c.prog - 1.5); floater(V3(c.x, 1.7, c.z), 'ALARM', '#ff6a5a'); }
      if (enemies.filter(e => !e.dead).length > 10) return;
      const g = tw.group || { grunt: 2, blaster: 1 };
      for (const t in g) for (let k = 0; k < g[t]; k++){
        const a = rand(0, Math.PI * 2), s = findClearSpawn(x + Math.cos(a) * 13, z + Math.sin(a) * 13, 1.0);
        spawnEnemy(t, V3(s.x, 0, s.z));
        const e = enemies[enemies.length - 1]; e.state = 'chase';
      }
    });
  },
  snap(){ return TW.s.beams.map(B => B.red > 0 ? 1 : 0); },
  sync(tw, w){ TW.s.beams.forEach((B, i) => { if (w[i] && !(B.red > 0)) B.red = 1.6; }); },
};
