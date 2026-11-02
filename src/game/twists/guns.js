// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GUNS (the Last Assault's beach): the emplacements aren't just posts, they're firing, and the ones you haven't taken
// yet are firing at you: a ring where the round will land, a tracer down from the gun, then the hit. Take a gun and
// the squad swings it round: from then on it shells the foes at the next one for you. The first round lands short.
//   first: seconds before the first round · every: seconds between rounds from each live gun · ours: seconds between
//   rounds from each gun of ours · r, fuse, dmg, foeDmg: each round's · line: { … } · ourLine: when the first is ours
import { TW, ev, line, words, pickHero, foesIn } from './kit.js';
import { V3, rand } from '../../utils.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';

const MUZZLE = 2.6;
export default {
  mood: { fill: 0.92, fog: 0x5a5048 },
  begin(tw){ TW.s = { next: [], n: 0, ours: 0 }; },
  update(tw, dt, ctx){
    TW.k = Math.min(1, TW.k + dt * 0.25);
    if (ctx.guest || !ctx.o || !ctx.s) return;
    const S = TW.s, posts = ctx.o.posts, k = ctx.s.k || 0, cur = posts[Math.min(k, posts.length - 1)].at;
    // a gun of ours for the first time: the squad turns it
    if (k > S.ours){
      S.ours = k;
      if (k < posts.length) showBanner('GUN TURNED', words(tw.ourLine, 'The squad has it round. It\'s shelling the next one for you.'), 3, { kicker: 'OURS NOW' });
    }
    posts.forEach((g, i) => {
      if (S.next[i] == null) S.next[i] = i === k ? (tw.first ?? 5) : i > k ? (tw.first ?? 5) + 2 + i * 1.7 : 2;
      if ((S.next[i] -= dt) > 0) return;
      const [gx, gz] = g.at, from = [gx, MUZZLE, gz];
      if (i < k){
        // ours: on the foes at the post the squad is going for, if there are any
        S.next[i] = (tw.ours ?? 4.5) * rand(0.85, 1.15);
        let best = null; foesIn(cur[0], cur[1], 9, (f, fp) => { if (!best) best = fp; });
        if (best) ev('blast', { x: best.x + rand(-1, 1), z: best.z + rand(-1, 1), r: (tw.r ?? 3) + 0.4, fuse: tw.fuse ?? 1.8, dmg: 0, foe: (tw.foeDmg ?? 60) * 1.3, col: 0x5ab8ff, from, ally: 1 });
        return;
      }
      // theirs: at a hero (the first lands short, between you and the gun)
      S.next[i] = (tw.every ?? 7) * rand(0.85, 1.15);
      const h = pickHero(gx, gz), p = h.pos;
      if (Math.hypot(p.x - gx, p.z - gz) < 6) return;   // too close under its barrel to bring it down on you
      let x = p.x + rand(-2, 2), z = p.z + rand(-2, 2);
      if (!S.n++){ x = p.x + (gx - p.x) * 0.3; z = p.z + (gz - p.z) * 0.3; showBanner('THE GUNS ARE FIRING', line(tw), 3.6, { kicker: 'INCOMING' }); }
      ev('blast', { x, z, r: tw.r ?? 3, fuse: tw.fuse ?? 1.8, dmg: tw.dmg ?? 18, foe: tw.foeDmg ?? 60, col: 0xff7a2a, from });
    });
  },
  done(){ const p = TW.o && TW.o.posts; if (p) floater(V3(p[p.length - 1].at[0], 3, p[p.length - 1].at[1]), 'THE GUNS ARE OURS', '#7bffae'); },
};
