// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE STALKER (the Holdfast's Houndmaster): every so often the duel's foe goes to ground. A burst of leaves and it's
// gone (nothing touches it while it's gone), and it comes back out of the trees from behind you: the brush rustles and a
// growl gives it away a beat before it strikes. Turn and meet it as it breaks cover and it's wide open. The first time,
// the tell is long and the floor marks the spot; once it's wounded it goes to ground more often and the tell is short.
//   first: seconds into the duel it first goes · every: seconds between (rage: rageEvery) · hide: seconds gone before
//   the tell · tell: [first, later] seconds of warning · back: how far behind you it comes out · line: { jedi, mando }
import { TW, prop, line, ringMesh, pickHero } from './kit.js';
import { G } from '../../state.js';
import { V3, rand } from '../../utils.js';
import { findClearSpawn } from '../../world/collision.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx } from '../../audio/sfx.js';

const LEAF = 0x3a5a2a;
function leaves(x, z, n = 14){ burst(V3(x, 1.0, z), LEAF, n, 6, 4, 0.9); burst(V3(x, 0.5, z), 0x6a5a3a, Math.ceil(n / 2), 3, 2, 0.7); }
export default {
  mood: { fill: 0.9, sun: 0.8, fog: 0x4a5a40, near: 0.8, far: 0.85 },
  begin(){ TW.s = { phase: 0, next: -1, t: 0, x: 0, z: 0, n: 0, ring: null }; },
  update(tw, dt, ctx){
    const S = TW.s, e = ctx.foe && ctx.foe();
    if (!S.ring){ S.ring = prop(ringMesh(0xff8a3a, 0.14, 0.9)); S.ring.visible = false; }
    if (!e){ S.ring.visible = false; return; }
    TW.k = Math.min(1, TW.k + dt * 0.3);
    if (ctx.guest){   // the host says where it is in its cycle
      S.t += dt;
      e.group.visible = S.phase !== 1 && S.phase !== 2;
      if (S.phase === 2){ tellFx(S, dt); }
      else S.ring.visible = false;
      return;
    }
    if (S.next < 0) S.next = tw.first ?? 7;
    const raged = e.hp <= e.maxHp * ((TW.o && TW.o.rage) || 0.5);
    S.t += dt;
    if (S.phase === 0){
      if ((S.next -= dt) > 0) return;
      // gone to ground: it can't be touched, and it slips round behind whoever it's after
      S.phase = 1; S.t = 0;
      const p = e.group.position;
      leaves(p.x, p.z, 18); sfx(160, 0.3, 'sawtooth', 0.03, 80);
      e.group.visible = false; e.ward = 0; e.stunT = 99; S.foe = e;
      const h = pickHero(p.x, p.z), hp = h.pos, dx = hp.x - p.x, dz = hp.z - p.z, l = Math.hypot(dx, dz) || 1, side = rand(-0.5, 0.5);
      const bx = hp.x + (dx / l) * (tw.back ?? 8) + (-dz / l) * side * 6, bz = hp.z + (dz / l) * (tw.back ?? 8) + (dx / l) * side * 6;
      const c = findClearSpawn(bx, bz, 1.0);
      S.x = c.x; S.z = c.z; S.hx = hp.x; S.hz = hp.z;
      p.set(c.x, 0, c.z);
      e.group.rotation.y = Math.atan2(hp.x - c.x, hp.z - c.z);
      if (!S.n) showBanner('IT GOES TO GROUND', line(tw), 3.4, { kicker: 'THE HUNT' });
    } else if (S.phase === 1){
      if (S.t >= (tw.hide ?? 1.4)){ S.phase = 2; S.t = 0; S.tell = S.n ? (tw.tell ? tw.tell[1] : 1.0) : (tw.tell ? tw.tell[0] : 2.0); if (!S.n) floater(V3(S.hx, 2.4, S.hz), 'LISTEN · BEHIND YOU', '#ffb050'); }
    } else if (S.phase === 2){
      tellFx(S, dt);
      if (S.t >= S.tell){
        // out of the brush: it strikes, but for a moment it's wide open to a blade that met it
        S.phase = 0; S.t = 0; S.n++;
        S.next = raged ? (tw.rageEvery ?? 9) : (tw.every ?? 13);
        e.group.visible = true; e.ward = null; e.stunT = 0; e.state = 'chase';
        e.openUntil = G.gt + 0.9;
        leaves(S.x, S.z, 22); sfx(120, 0.35, 'sawtooth', 0.05, 60); sfx(340, 0.2, 'square', 0.03, 180);
        S.ring.visible = false;
      }
    }
    if (S.phase !== 2) S.ring.visible = false;
  },
  done(){ const e = TW.s.foe; if (e){ e.group.visible = true; e.ward = null; } },
  snap(){ const S = TW.s; return [S.phase, Math.round(S.x * 10) / 10, Math.round(S.z * 10) / 10, Math.round(S.t * 10) / 10, S.tell || 1]; },
  sync(tw, w){ const S = TW.s; if (S.phase !== w[0]) S.t = w[3]; S.phase = w[0]; S.x = w[1]; S.z = w[2]; S.tell = w[4]; },
};
// the tell: the brush shakes where it is, the ring tightens on the spot, and it growls
function tellFx(S, dt){
  const k = Math.min(1, S.t / Math.max(0.1, S.tell));
  S.ring.visible = true; S.ring.position.set(S.x, 0.1, S.z); S.ring.scale.setScalar(3.2 - k * 2);
  S.ring.material.opacity = 0.5 + 0.4 * Math.abs(Math.sin(G.gt * 12));
  if (Math.random() < dt * 12) burst(V3(S.x + rand(-1, 1), rand(0.4, 1.8), S.z + rand(-1, 1)), LEAF, 2, 3, 3, 0.8);
  if ((S.growl = (S.growl || 0) - dt) <= 0){ S.growl = 0.45; sfx(rand(70, 95), 0.4, 'sawtooth', 0.035, 50); }
}
