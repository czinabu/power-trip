// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE LIST (the Gallows, a prison barge riding out a storm): the swell gets under the barge and it rolls, one rail and
// then the other. The deck drags everyone toward the low side (you, the foes and the prisoners' line holding on), and
// once it's rolling hard, loose cargo comes sliding across it. It eases in over a few rolls before the crates come, and
// a crate's lane lights up before it slides. A foe dragged into one goes down; so do you.
//   at: seconds into the hold it starts · period: seconds per roll (to one side and back) · roll: the view's tilt at its
//   steepest (rad) · slide: m/s the deck drags you at its steepest · crates: seconds into it before the first crate ·
//   width: the deck's half-width (where a crate sets off from) · line: { jedi, mando }
import { TW, ev, line, pickHero } from './kit.js';
import { G, player, enemies } from '../../state.js';
import { V3, rand, clamp } from '../../utils.js';
import { playerPos } from '../../player/helpers.js';
import { collideSolids } from '../../world/collision.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx } from '../../audio/sfx.js';
import { gust } from '../../audio/director.js';

// how hard the deck leans right now, -1 … 1 (+: down to the east)
function lean(tw){
  const u = TW.t - (tw.at ?? 6);
  if (u <= 0) return 0;
  const amp = clamp(u / 14, 0, 1) * (0.55 + 0.45 * clamp((u - 14) / 20, 0, 1));   // gentle rolls first, then hard ones
  return Math.sin(u * Math.PI * 2 / (tw.period ?? 9)) * amp;
}
export default {
  mood: { fill: 0.86, sky: 0.8, fog: 0x1a2a34 },
  begin(){ TW.s = { said: false, crateT: 0, side: 0, crates: 0 }; },
  update(tw, dt, ctx){
    const S = TW.s, L = lean(tw), half = tw.width ?? 26;
    TW.k = Math.min(1, Math.abs(L) * 1.4 + (TW.t > (tw.at ?? 6) ? 0.3 : 0));
    G.camRoll = -L * (tw.roll ?? 0.07);
    if (!S.said && TW.t > (tw.at ?? 6) - 1 && !ctx.guest){ S.said = true; showBanner('THE BARGE IS LISTING', line(tw), 4, { kicker: 'STORM' }); }
    if (!L) return;
    const drag = L * (tw.slide ?? 3.2);
    // the deck drags you downhill (not while you're in the air or dashing: that's how you fight it)
    const pp = playerPos();
    if (player.grounded && !(player.dashT > 0) && player.hp > 0) pp.x += drag * dt;
    // water over the low rail, a groan from the hull at each turn of the roll
    if (Math.abs(L) > 0.6 && Math.random() < dt * 10){ const sx = Math.sign(L) * (half + 1); burst(V3(sx, 0.4, pp.z + rand(-14, 14)), 0xbfd8e8, 3, 6, 6, 0.9); }
    const side = Math.sign(L);
    if (side !== S.side && Math.abs(L) > 0.2){ S.side = side; sfx(70, 0.9, 'sawtooth', 0.03, 46); gust('rain'); }
    if (ctx.guest) return;
    // foes slide too (the duel's foe keeps its feet)
    for (const e of enemies){
      if (e.dead || e.champion || e.converted || e.group.position.y > 0.4) continue;
      e.group.position.x += drag * 1.15 * dt;
      collideSolids(e.group.position, 0.5, false);
    }
    // loose cargo: once it's rolling hard, a crate comes across the deck at the turn of each roll
    if (TW.t > (tw.at ?? 6) + (tw.crates ?? 18) && Math.abs(L) > 0.75 && (S.crateT -= dt) <= 0){
      S.crateT = (tw.period ?? 9) * 0.5 + 0.5;
      const h = pickHero(), z = h.pos.z + rand(-2.5, 2.5), from = -side * half;
      ev('roll', { x: from, z, dx: side, dz: 0, spd: 11, len: half * 2, r: 0.9, fuse: 1.3, dmg: 18, foe: 70, kind: 'crate', col: 0xffb050 });
      if (!S.crates++) floater(V3(h.pos.x, 2.2, h.pos.z), 'LOOSE CARGO!', '#ffb050');
    }
  },
  end(){ G.camRoll = 0; },
  done(){ G.camRoll = 0; },
};
