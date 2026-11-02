// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ROCKSLIDE (the Hunt, up the canyon): the Marshal knows he's being followed, and his rear guard is bringing the walls
// down on the trail. A rumble and a lane of dust lights across the riverbed from one wall, then the boulder comes down
// it: out of its way, or under it. It takes his own troopers as flat as it takes you. The first one comes down ahead
// of you on the trail, so you see the lane and the rock that follows it before one is aimed at you.
//   first: seconds before the first · every: seconds between (later ones in pairs) · ahead: metres up the trail the first
//   one crosses · r, spd, fuse, dmg, foeDmg: each boulder's · line: { … }
import { TW, ev, line, pickHero } from './kit.js';
import { rand } from '../../utils.js';
import { showBanner } from '../../ui/banners.js';
import { sfx } from '../../audio/sfx.js';
import { gust } from '../../audio/director.js';

const WALL = 30, SLOPE = -0.35;   // where they come off the wall, and how they run on down the riverbed as they cross
function boulder(tw, x, z, side){
  // a lane from the wall on `side` that crosses (x, z), running across and down the canyon
  const l = Math.hypot(1, SLOPE), ux = -side / l, uz = SLOPE / l;
  const run = Math.abs(side * WALL - x) / Math.abs(ux), x0 = x - ux * run, z0 = z - uz * run;
  ev('roll', { x: x0, z: z0, dx: ux, dz: uz, spd: tw.spd ?? 13, len: run + 26, r: tw.r ?? 1.4, fuse: tw.fuse ?? 1.8,
               dmg: tw.dmg ?? 22, foe: tw.foeDmg ?? 90, kind: 'rock', tint: 0x8a5838 });
  sfx(50, 1.6, 'sawtooth', 0.05, 30);
}
export default {
  mood: { fill: 0.92, sun: 0.9, fog: 0x9a6a48 },   // dust in the air
  begin(tw){ TW.s = { next: tw.first ?? 6, n: 0 }; },
  update(tw, dt, ctx){
    TW.k = Math.min(1, TW.k + dt * 0.25);
    if (ctx.guest) return;
    const S = TW.s;
    if ((S.next -= dt) > 0) return;
    S.next = (tw.every ?? 8) * rand(0.85, 1.15);
    const h = pickHero(), p = h.pos, side = Math.random() < 0.5 ? -1 : 1;
    gust('wind');
    if (!S.n++){
      // the first: across the trail ahead of you (the canyon climbs toward +z)
      boulder(tw, p.x, p.z + (tw.ahead ?? 9), side);
      showBanner('ROCKSLIDE', line(tw), 3.6, { kicker: 'EYES ON THE WALLS' });
      return;
    }
    boulder(tw, p.x + rand(-1.5, 1.5), p.z + rand(-1.5, 1.5), side);
    if (S.n > 3 && S.n % 2) boulder(tw, p.x + rand(-3, 3), p.z + rand(5, 8) * (Math.random() < 0.5 ? -1 : 1), -side);
  },
};
