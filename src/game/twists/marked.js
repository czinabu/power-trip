// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MARKED (the Night of the Order, walking the General out): the company has snipers in the trees, and they want her,
// not you. One opens up as she reaches its stretch: a red line from its nest to her, steadying, beeping faster, and
// then the shot. Stand in the line and it's you it hits (a blade's guard turns it), or put the sniper down before it
// fires. The first one takes its time; the later ones don't.
//   nests: [{ at: [x, z], from: how far along her walk it opens up (0..1) }] · aim: [first, later] seconds it holds its
//   sight on her · hit: the share of her health a shot takes · dmg: what it takes off a hero in its line · line: { … }
import { TW, prop, line, beamMesh, layBeam, heroes } from './kit.js';
import { G, player, enemies } from '../../state.js';
import { V3, rand } from '../../utils.js';
import { hurtPlayer } from '../../player/damage.js';
import { spawnEnemy } from '../../enemies/spawn.js';
import { findClearSpawn } from '../../world/collision.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx } from '../../audio/sfx.js';
import { diffDmgMul } from '../../data/difficulty.js';

const RED = 0xff2a2a;
// how far (x, z) is off the segment a → b, and how far along it (0..1)
function offLine(ax, az, bx, bz, x, z){
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = ((x - ax) * dx + (z - az) * dz) / l2;
  return [Math.hypot(ax + dx * t - x, az + dz * t - z), t];
}
export default {
  begin(tw){ TW.s = { n: 0, nests: tw.nests.map(n => ({ ...n, e: null, charge: 0, cd: 1.2, line: null, x: 0, y: 0, z: 0, on: 0 })) }; },
  update(tw, dt, ctx){
    const S = TW.s, v = ctx.vip && ctx.vip.g.position;
    for (const N of S.nests){
      if (!N.line){ N.line = prop(beamMesh(RED, 0.025, 0.8)); N.line.visible = false; }
      if (!ctx.guest){
        const live = N.e && !N.e.dead && enemies.includes(N.e);
        if (live){ const p = N.e.group.position; N.x = p.x; N.y = p.y + 1.55; N.z = p.z; }
        N.on = live && N.cd <= 0 ? 1 : 0;
      }
      N.line.visible = !!(N.on && v);
      if (N.line.visible){
        layBeam(N.line, { x: N.x, y: N.y, z: N.z }, { x: v.x, y: 1.25, z: v.z });
        N.line.material.opacity = 0.25 + 0.7 * N.charge + (Math.sin(G.gt * (8 + N.charge * 30)) > 0 ? 0.1 : 0);
      }
    }
    if (ctx.guest || !v) return;
    const f = ctx.frac || 0;
    for (const N of S.nests){
      // its stretch: the sniper opens up from its nest
      if (!N.e && f >= N.from){
        const c = findClearSpawn(N.at[0], N.at[1], 1.0);
        spawnEnemy('sniper', V3(c.x, 0, c.z));
        N.e = enemies[enemies.length - 1]; N.e.marker = true;
        N.aim = S.n ? (tw.aim ? tw.aim[1] : 3) : (tw.aim ? tw.aim[0] : 5);
        if (!S.n++) showBanner('SNIPER', line(tw), 4, { kicker: 'SHE\'S MARKED' });
        continue;
      }
      if (!N.e || N.e.dead || !enemies.includes(N.e)){ N.charge = 0; continue; }
      if (N.cd > 0){ N.cd -= dt; continue; }
      N.charge = Math.min(1, N.charge + dt / N.aim);
      if ((N.beep = (N.beep || 0) - dt) <= 0){ N.beep = 0.5 - N.charge * 0.4; sfx(1400 + N.charge * 600, 0.04, 'square', 0.02, 1400 + N.charge * 600); }
      if (N.charge < 1) continue;
      // the shot: whoever stands in its line takes it, or she does
      N.charge = 0; N.cd = rand(2.5, 3.5); N.aim = tw.aim ? tw.aim[1] : 3;
      sfx(220, 0.25, 'sawtooth', 0.06, 90);
      burst(V3(N.x, N.y, N.z), 0xffb04a, 6, 6, 2, 0.5);
      const blocker = heroes().find(h => { const [d, t] = offLine(N.x, N.z, v.x, v.z, h.pos.x, h.pos.z); return d < 0.95 && t > 0.08 && t < 0.97; });
      if (blocker){
        const pp = blocker.pos;
        burst(V3(pp.x, 1.4, pp.z), 0xff6a4a, 10, 7, 3, 0.6);
        floater(V3(pp.x, 2.2, pp.z), 'COVERED HER', '#7bffae');
        if (blocker.local && player.hp > 0) hurtPlayer((tw.dmg ?? 14) * diffDmgMul(), V3(N.x, N.y, N.z), false, false, false);
      } else {
        const vip = ctx.vip;
        vip.hp -= vip.maxHp * (tw.hit ?? 0.2);
        burst(V3(v.x, 1.3, v.z), 0xff4a2a, 16, 7, 3, 0.8);
        floater(V3(v.x, 2.4, v.z), 'SHE\'S HIT', '#ff6a5a');
        G.shake = Math.max(G.shake, 0.3);
      }
    }
  },
  // the nest whose sight is on her: the HUD arrow points at it while it steadies
  target(){ const N = TW.s.nests.find(n => n.on && n.charge > 0.15); return N ? V3(N.x, 0, N.z) : null; },
  snap(){ return TW.s.nests.map(N => N.on ? [Math.round(N.x * 10) / 10, Math.round(N.y * 10) / 10, Math.round(N.z * 10) / 10, Math.round(N.charge * 100) / 100] : 0); },
  sync(tw, w){ TW.s.nests.forEach((N, i) => { const r = w[i]; N.on = r ? 1 : 0; if (r){ N.x = r[0]; N.y = r[1]; N.z = r[2]; N.charge = r[3]; } }); },
};
