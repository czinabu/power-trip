// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PLAN KIT: what every open zone's plan (world/zones/<zone>-plan.js) is rolled with. A plan is every piece of a zone
// as plain data (world/zones/zone-kit.js KINDS builds them); these are the shared tools for laying one out:
//   planContext(seed)        the zone's dice and its piece list: put a piece, keep ground clear, ask if ground is clear
//   fillLots(Z, ctx, STYLE)  fill every district's square with houses, lot by lot, skipping anything kept clear
// Rolled from the zone's seed, so every browser in a co-op party, and every visit, walks the same streets.

import { seeded } from '../arenas/kit.js';

export function planContext(seed){
  const R = seeded(seed), pieces = [], reserved = [];
  const rr = (a, b) => a + R() * (b - a);
  const put = (p) => { p.s = (R() * 1e9) | 0; pieces.push(p); return p; };
  // ground kept clear of houses: streets, squares, the landmarks and every waystone
  const keep = (x0, z0, x1, z1) => reserved.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  const keepC = (x, z, r) => keep(x - r, z - r, x + r, z + r);
  const clear = (x0, z0, x1, z1, pad = 0) => !reserved.some(k => x0 < k.x1 + pad && x1 > k.x0 - pad && z0 < k.z1 + pad && z1 > k.z0 - pad);
  return { R, rr, put, keep, keepC, clear, pieces, reserved };
}

export function districtOf(Z, x, z){
  for (const d of Z.districts) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.id;
  return null;
}

/* HOUSES: every block left in every district, cut into lots with alleys between. STYLE[district] = [lowest, tallest,
   share of roofs fallen in]; opts.yard: the share of lots left as a yard of crates */
export function fillLots(Z, ctx, STYLE, opts = {}){
  const { R, rr, put, keep, clear } = ctx, yard = opts.yard ?? 0.07;
  const lot = (x0, z0, x1, z1, depth) => {
    const w = x1 - x0, d = z1 - z0;
    if ((w > 17 || d > 17) && depth < 7){   // cut it in two, along its long side, with an alley between now and then
      const alley = R() < 0.45 ? rr(3, 4.4) : 0;
      if (w >= d){ const m = x0 + w * rr(0.38, 0.62); lot(x0, z0, m - alley / 2, z1, depth + 1); lot(m + alley / 2, z0, x1, z1, depth + 1); }
      else { const m = z0 + d * rr(0.38, 0.62); lot(x0, z0, x1, m - alley / 2, depth + 1); lot(x0, m + alley / 2, x1, z1, depth + 1); }
      return;
    }
    if (w < 4.5 || d < 4.5) return;
    const inset = 0.6, a0 = x0 + inset, b0 = z0 + inset, a1 = x1 - inset, b1 = z1 - inset;
    if (!clear(a0, b0, a1, b1, 0.8)) return;
    const cx = (a0 + a1) / 2, cz = (b0 + b1) / 2, dist = districtOf(Z, cx, cz), st = STYLE[dist] || [5, 9, 0.1];
    if (R() < yard){ put({ t: 'crates', x: cx, z: cz, n: 2, yaw: 0 }); return; }   // a yard
    const hx = (a1 - a0) / 2, hz = (b1 - b0) / 2, ruined = R() < st[2];
    const h = ruined ? rr(2.4, 4.2) : rr(st[0], st[1]);
    const p = put({ t: 'house', x: cx, z: cz, hx, hz, h, ruined, tone: R() * 3 | 0 });
    if (!ruined && R() < 0.22 && Math.min(hx, hz) > 3) p.dome = Math.min(hx, hz) * rr(0.45, 0.7);
    if (!ruined && R() < 0.3) p.bits = Array.from({ length: 1 + (R() * 2 | 0) }, () => [rr(-hx * 0.6, hx * 0.6), rr(-hz * 0.6, hz * 0.6), rr(0.5, 1), rr(0.6, 1.2)]);   // roof clutter: [dx, dz, half-size, height]
    // a lower annex on one side: the way up onto the roofs (a jump from it reaches the roof's edge)
    if (!ruined && R() < 0.35){
      const side = R() * 4 | 0, ah = Math.min(h - 1.6, rr(1.6, 2.4)), aw = rr(1.2, 1.8);
      const ax = side === 0 ? cx + hx + aw : side === 1 ? cx - hx - aw : cx, az = side === 2 ? cz + hz + aw : side === 3 ? cz - hz - aw : cz;
      const ahx = side < 2 ? aw : Math.min(hx * 0.6, 2.4), ahz = side < 2 ? Math.min(hz * 0.6, 2.4) : aw;
      if (clear(ax - ahx, az - ahz, ax + ahx, az + ahz, 0.4) && ah > 1){ p.annex = { x: ax, z: az, hx: ahx, hz: ahz, h: ah }; keep(ax - ahx, az - ahz, ax + ahx, az + ahz); }
    }
    // an awning over a door on a side that faces a street (a cloth one-way ledge: jump up through it, land on it)
    if (!ruined && R() < 0.4){
      const side = R() * 4 | 0, o = [[1, 0], [-1, 0], [0, 1], [0, -1]][side];
      const ax = cx + o[0] * (hx + 0.9), az = cz + o[1] * (hz + 0.9);
      if (!clear(ax - 1, az - 1, ax + 1, az + 1, 0) || R() < 0.5) p.awn = { side, cloth: R() * 4 | 0 };
    }
    keep(a0, b0, a1, b1);   // (after the annex looked for room beside it)
  };
  // fill each district's whole square: anything reserved is skipped lot by lot
  for (const d of Z.districts) lot(d.x0 + 4, d.z0 + 4, d.x1 - 4, d.z1 - 4, 0);
}
