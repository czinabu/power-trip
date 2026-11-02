// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PULSE (Return to Jedha, the gate under the dais): as the gate wakes it breathes out, a ring of violet light racing
// across the courtyard from the dais's foot. It throws down anyone on the flagstones as it passes: jump it, or be up on
// the dais's steps when it comes (but not on the summit, which burns). Foes caught by it go down hard. Each one is
// warned by the gate drawing in its breath. The first is slow and soft; they come faster and closer together as the
// gate wakes, and in pairs at the end.
//   at: [x, z] the gate · r0: where a ring starts · every: [first, last] seconds between · spd: [first, last] m/s ·
//   len: how far it runs · w: its half-width · dmg · foeDmg · line: { jedi, mando }
import { TW, ev, line } from './kit.js';
import { V3, rand } from '../../utils.js';
import { showBanner } from '../../ui/banners.js';
import { motes } from '../../fx/ink.js';
import { sfx } from '../../audio/sfx.js';

const VIOLET = 0xa06aff;
const lerp = (a, b, k) => a + (b - a) * k;
function ring(tw, f, soft){
  const [x, z] = tw.at, spd = soft ? 5.5 : lerp(tw.spd ? tw.spd[0] : 7, tw.spd ? tw.spd[1] : 10.5, f);
  ev('ring', { x, z, r0: tw.r0 ?? 4.2, spd, len: tw.len ?? 30, w: tw.w ?? 0.75, dmg: soft ? 6 : (tw.dmg ?? 14), foe: tw.foeDmg ?? 30, col: VIOLET });
  sfx(90, 0.8, 'sine', 0.06, 45); sfx(520, 0.4, 'triangle', 0.03, 260);
}
export default {
  mood: { fill: 0.85, rim: 1.15, fog: 0x2a1640 },
  begin(tw){ TW.s = { next: tw.first ?? 5, n: 0, pair: 0 }; },
  update(tw, dt, ctx){
    const S = TW.s, f = ctx.frac || 0, [x, z] = tw.at;
    TW.k = Math.min(1, 0.3 + f * 0.7);
    // the gate drawing in its breath: light gathering at the dais's foot
    if (S.next < 1.2 && Math.random() < dt * 22){ const a = rand(0, Math.PI * 2); motes(V3(x + Math.cos(a) * 3.8, 0.1, z + Math.sin(a) * 3.8), VIOLET, 1, 0.3, { h: 1.2 }); }
    if (S.pair > 0 && (S.pair -= dt) <= 0 && !ctx.guest) ring(tw, f);
    if (ctx.guest){ S.next -= dt; return; }
    if ((S.next -= dt) > 0) return;
    const soft = S.n === 0;
    ring(tw, f, soft);
    if (soft) showBanner('THE GATE BREATHES', line(tw), 3.8, { kicker: 'JUMP IT' });
    S.n++;
    S.next = lerp(tw.every ? tw.every[0] : 10, tw.every ? tw.every[1] : 5.5, f) * rand(0.9, 1.1);
    if (f > 0.55 && S.n % 2 === 0) S.pair = 1.0;   // late on, a second ring hard behind the first
  },
  snap(){ return Math.round(TW.s.next * 10) / 10; },
  sync(tw, w){ TW.s.next = w; },
};
