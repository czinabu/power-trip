// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STRAGGLERS (the Ember Academy's children): not every child runs. Now and then one freezes where it hid, off the
// path, and the line can't move on without it: go and get it (stand by it a moment) and it runs for the ships. The
// first freezes just off the lane, in sight of the hold; the last is down by the smelter, where the foes come in.
//   at: [frac…] the hold's progress each one freezes at · spots: [[x, z]…] where · r: how close to stand ·
//   back: [x, z] where it runs to · line: { jedi, mando } the first one's banner line · more: the later ones'
import { TW, prop, unprop, line, words, puffAt } from './kit.js';
import { V3 } from '../../utils.js';
import { G, isMando } from '../../state.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { sfx } from '../../audio/sfx.js';
import { heroIn, makeBeacon, removeMarker } from '../objectives.js';
import { makeEvacuee } from '../../world/arenas/refuge.js';
import { CIV } from '../civilians.js';

const kindOf = (o) => (o && o.evacuees && o.evacuees.kind) || (isMando() ? 'foundling' : 'youngling');
function child(o, i, x, z){
  const m = prop(makeEvacuee(kindOf(o), 40 + i));
  m.position.set(x, 0, z);
  return { i, x, z, m, state: 1, near: 0, t: 0 };
}
export default {
  begin(){ TW.s = { i: 0, cur: null }; },
  update(tw, dt, ctx){
    const S = TW.s, c = S.cur;
    // the one that froze: huddled and shaking, then running for the line once you've reached it
    if (c && c.state === 1){
      c.m.rotation.set(0.35, Math.atan2(-c.x, -c.z), Math.sin(G.gt * 22) * 0.05);
      c.m.position.y = 0;
    } else if (c && c.state === 2){
      const [bx, bz] = tw.back, dx = bx - c.m.position.x, dz = bz - c.m.position.z, l = Math.hypot(dx, dz);
      c.t += dt;
      if (l > 0.4){ const st = Math.min(l, dt * 4.6); c.m.position.x += dx / l * st; c.m.position.z += dz / l * st; c.m.rotation.set(0, Math.atan2(dx, dz), 0); c.m.position.y = Math.abs(Math.sin(c.t * 14)) * 0.08; }
      if ((l <= 0.4 || c.t > 5) && !ctx.guest){ unprop(c.m); S.cur = null; S.i++; }
    }
    if (ctx.guest) return;
    if (S.cur) CIV.list.push(S.cur.civ || (S.cur.civ = { m: S.cur.m, r: 0.32, h: 1.4 }));   // the foes give the frozen one room too (game/civilians.js)
    const at = tw.at || [];
    if (!S.cur && S.i < at.length && (ctx.frac || 0) >= at[S.i] - 0.002){
      const [x, z] = tw.spots[S.i];
      S.cur = child(ctx.o, S.i, x, z);
      S.cur.beacon = makeBeacon(x, z, 0, 0x7bffae, 1.0); ctx.mark && ctx.mark(S.cur.beacon);
      sfx(880, 0.18, 'triangle', 0.04, 660);
      if (S.i === 0) showBanner('A CHILD HAS FROZEN', line(tw), 4, { kicker: 'THE LINE STOPS' });
      else showBanner('ANOTHER ONE HAS FROZEN', words(tw.more, 'Go and get them.'), 2.6, { kicker: 'THE LINE STOPS' });
      return;
    }
    if (S.cur && S.cur.state === 1){
      const cc = S.cur;
      cc.near = heroIn(cc.x, cc.z, tw.r ?? 2.2) ? cc.near + dt : 0;
      if (cc.near > 0.5){
        cc.state = 2; cc.t = 0;
        floater(V3(cc.x, 1.6, cc.z), isMando() ? 'GO. STAY LOW.' : 'GO. RUN TO THE SHIPS.', '#7bffae');
        puffAt(cc.x, cc.z, 0x7bffae, 6); sfx(660, 0.12, 'triangle', 0.04, 990);
        if (cc.beacon){ ctx.unmark ? ctx.unmark(cc.beacon) : removeMarker(cc.beacon); cc.beacon = null; }
      }
    }
  },
  gate(tw){
    const c = TW.s.cur;
    return c && c.state === 1 ? { rate: 0, status: 'A CHILD HAS FROZEN · GO AND GET THEM', warn: true } : null;
  },
  target(){ const c = TW.s.cur; return c && c.state === 1 ? V3(c.x, 0, c.z) : null; },
  snap(){ const c = TW.s.cur; return c ? [c.i, c.state, Math.round(c.m.position.x * 10) / 10, Math.round(c.m.position.z * 10) / 10] : [TW.s.i, 0]; },
  sync(tw, w){
    const S = TW.s;
    if (!w[1]){ if (S.cur){ unprop(S.cur.m); S.cur = null; } S.i = w[0]; return; }
    if (!S.cur || S.cur.i !== w[0]){ if (S.cur) unprop(S.cur.m); S.cur = child(TW.o, w[0], w[2], w[3]); }
    if (w[1] === 2 && S.cur.state === 1){ S.cur.state = 2; S.cur.t = 0; }
  },
};
