// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BARRAGE (the Last Evacuation's uplinks): the bombardment the uplinks are calling down starts falling while you cut
// them. A ring on the ground where each shell will land, filling as its fuse burns, then the hit: on you, mostly, and on
// any foe standing in it just as hard. Every uplink cut slows it. The first lands well off, ahead of you, so the rings
// mean something before one is under your feet.
//   first: seconds before the first shell · every: seconds between shells with every uplink up (it stretches as they
//   fall) · fuse, r, dmg, foeDmg: each shell's · line: { jedi, mando } the banner's line
import { TW, ev, pickHero, line } from './kit.js';
import { G } from '../../state.js';
import { rand } from '../../utils.js';
import { showBanner } from '../../ui/banners.js';
import { sfx } from '../../audio/sfx.js';

function shell(tw, x, z, first){
  ev('blast', { x, z, r: tw.r ?? 3.4, fuse: (tw.fuse ?? 2.2) + (first ? 0.6 : 0), dmg: tw.dmg ?? 20, foe: tw.foeDmg ?? 60, col: 0xff5a2a, big: 1 });
  sfx(1500, tw.fuse ?? 2.2, 'sine', 0.025, 260);   // the whistle coming down
}
export default {
  mood: { fill: 0.9, sun: 0.82, sky: 0.85, fog: 0x7a4a3a },   // smoke over the refuge
  begin(tw){ TW.s = { next: tw.first ?? 5, n: 0 }; },
  update(tw, dt, ctx){
    TW.k = Math.min(1, TW.k + dt * 0.25);
    if (ctx.guest) return;
    const S = TW.s;
    if ((S.next -= dt) > 0) return;
    const cons = ctx.s && ctx.s.cons, n = cons ? cons.length : 1, done = cons ? cons.filter(c => c.done).length : 0;
    S.next = (tw.every ?? 6) * (1 + 1.6 * done / n) * rand(0.85, 1.15);
    const h = pickHero(), p = h.pos;
    if (S.n++ === 0){
      // the first: well ahead of you, where you can watch it land
      const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
      shell(tw, p.x + fx * 13 + rand(-2, 2), p.z + fz * 13 + rand(-2, 2), true);
      showBanner('BOMBARDMENT', line(tw), 3.6, { kicker: 'INCOMING' });
      return;
    }
    // the rest: on you, leading you a little if you're running, and in pairs once the third has fallen
    const v = h.vel || { x: 0, z: 0 }, a = rand(0, Math.PI * 2), off = rand(0, 4.5);
    const x = p.x + v.x * 0.7 + Math.cos(a) * off, z = p.z + v.z * 0.7 + Math.sin(a) * off;
    shell(tw, x, z);
    if (S.n > 3 && S.n % 3 === 0){ const b = a + rand(1.8, 2.6); shell(tw, p.x + Math.cos(b) * 5.5, p.z + Math.sin(b) * 5.5); }
  },
};
