// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE OLD CITY OF JEDHA, as a PLAN (data/zones.js ZONES.jedha): every building, wall, stall and stone as plain data, no
// meshes. world/zone-stream.js turns the plan into solids at once (the whole city collides from the first frame) and into
// meshes chunk by chunk as heroes come near (world/zones/zone-kit.js builds each piece). The plan is rolled from the
// zone's seed, so every browser in a co-op party, and every visit, walks the same streets.
//
// THE CITY (north is −z; 240 m across, walled in at ±114):
//   · the PILGRIM WAY runs north from the south gate to the temple steps, and the MARKET ROAD east from the bazaar to the
//     garrison gate; two ring lanes (x = ±40, z = ±40) part the nine districts (data/zones.js);
//   · the south gate's landing pad (the shuttle home), the caravan yard; the Pillar Square round the toppled Guardian; the
//     bazaar's stall rows; the walled garrison; the cistern's flooded basin; the quarry outcrops of the kyber workings;
//     the temple on its stepped plinth; the field of standing stones;
//   · everything else is houses, packed into the blocks between the lanes, with alleys between them.
// Raised ground a foe walks on is only ever CLIMBABLE steps (under STEP_UP each): the nav grid is flat, so a roof or a
// tower top is somewhere only a hero can reach, like the gantries on the campaign maps.

import { seeded } from '../arenas/kit.js';

/* a piece: { t: its kind (world/zones/zone-kit.js KINDS), x, z, ...its own fields, s: its own seed for decoration that
   changes no solid, sky: built once into the skyline (seen from anywhere) instead of with its chunk } */
export function planJedha(Z){
  const R = seeded(Z.seed), pieces = [], reserved = [];
  const rr = (a, b) => a + R() * (b - a);
  const put = (p) => { p.s = (R() * 1e9) | 0; pieces.push(p); return p; };
  // ground kept clear of houses: streets, squares, the landmarks and every waystone
  const keep = (x0, z0, x1, z1) => reserved.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  const keepC = (x, z, r) => keep(x - r, z - r, x + r, z + r);
  const clear = (x0, z0, x1, z1, pad = 0) => !reserved.some(k => x0 < k.x1 + pad && x1 > k.x0 - pad && z0 < k.z1 + pad && z1 > k.z0 - pad);

  /* ---------------- the streets ---------------- */
  keep(-7.5, -58, 7.5, 118);      // the Pilgrim Way
  keep(-118, -6.5, 54, 6.5);      // the Market Road (to the garrison gate)
  for (const s of [-1, 1]){ keep(s * 36.5, -118, s * 43.5, 118); keep(-118, s * 36.5, 118, s * 43.5); }   // the ring lanes
  for (const w of Z.waystones){ keepC(w.x, w.z, 4.5); put({ t: 'waystone', x: w.x, z: w.z, gate: !!w.gate }); }

  /* ---------------- the city wall ---------------- */
  const W = 116, T = 2.2, wallH = 13;
  for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]){
    for (let u = -W; u < W; u += 24){
      const a = u, b = Math.min(W, u + 24), c = (a + b) / 2, len = b - a;
      if (nz === 1 && Math.abs(c) < 12) continue;   // the south gate's gap (its gatehouse stands either side)
      put({ t: 'wall', x: nz ? c : nx * W, z: nz ? nz * W : c, hx: nz ? len / 2 : T, hz: nz ? T : len / 2, h: wallH, face: [-nx, -nz] });
    }
    for (let u = -W; u <= W; u += 48) put({ t: 'tower', x: nz ? u : nx * W, z: nz ? nz * W : u, r: 4.2, h: wallH + 6, cap: true });
  }
  keep(-120, 108, 120, 120); keep(-120, -120, 120, -108); keep(108, -120, 120, 120); keep(-120, -120, -108, 120);

  /* ---------------- THE PILGRIMS' GATE ---------------- */
  put({ t: 'gatehouse', x: 0, z: W, half: 12, h: wallH + 5 });
  put({ t: 'pad', x: 0, z: 96, r: 11 }); keepC(0, 96, 13);
  put({ t: 'shuttle', x: 0, z: 104, yaw: 0 }); keep(-8, 98, 8, 112);
  // the caravan yard, west of the way: tents and crates, a well
  keep(-34, 56, -12, 104);
  for (let i = 0; i < 4; i++) put({ t: 'tent', x: -28 + (i % 2) * 12, z: 64 + Math.floor(i / 2) * 18, hx: 4, hz: 3.2, h: 3.2 });
  put({ t: 'well', x: -22, z: 92, r: 2.2 });
  for (let i = 0; i < 6; i++) put({ t: 'crates', x: rr(-33, -14), z: rr(58, 102), n: 1 + (R() * 3 | 0), yaw: R() < 0.5 ? 0 : 1 });
  // lanterns and arches down the Pilgrim Way
  for (let z = 110; z > -54; z -= 14) for (const s of [-1, 1]) put({ t: 'lamp', x: s * 6.4, z, h: 4.2 });
  for (const z of [72, 30, -30]) put({ t: 'arch', x: 0, z, span: 7, h: 9, alongX: true });

  /* ---------------- THE PILLAR SQUARE ---------------- */
  keepC(0, 0, 31);
  for (let i = 0; i < 16; i++){
    const a = i / 16 * Math.PI * 2 + Math.PI / 16, x = Math.cos(a) * 27, z = Math.sin(a) * 27;
    if (Math.abs(x) < 9 || Math.abs(z) < 9) continue;   // the roads come in clear
    put({ t: 'column', x, z, r: 1.1, h: i % 3 === 1 ? rr(3, 5) : 11, broken: i % 3 === 1, cap: i % 3 !== 1 });
  }
  // the Fallen Guardian: its plinth and stumps at the north-west of the square, its body across the middle
  put({ t: 'guardian', x: -6, z: -10 });

  /* ---------------- THE LOWER BAZAAR ---------------- */
  keep(-112, -34, -48, 34);
  for (const lz of [-22, -11, 11, 22]){
    for (let x = -108; x < -50; x += 6.5){
      if (R() < 0.18) continue;
      for (const side of [-1, 1]) if (R() < 0.85) put({ t: 'stall', x: x + rr(-0.4, 0.4), z: lz + side * 3.1, hx: 2.4, hz: 1.2, face: -side, cloth: R() * 4 | 0 });
    }
  }
  for (let i = 0; i < 10; i++) put({ t: 'crates', x: rr(-110, -50), z: R() < 0.5 ? rr(-32, -28) : rr(28, 32), n: 1 + (R() * 3 | 0), yaw: R() < 0.5 ? 0 : 1 });
  for (const [x, z] of [[-96, -32], [-64, -32], [-96, 32], [-64, 32], [-80, -16.5], [-80, 16.5]]) put({ t: 'planter', x, z, r: 1.6 });

  /* ---------------- THE GARRISON ---------------- */
  put({ t: 'garrison', x: 84, z: 0, x0: 56, z0: -32, x1: 112, z1: 32, gate: [-6, 6] }); keep(52, -36, 116, 36);

  /* ---------------- THE DROWNED CISTERN ---------------- */
  put({ t: 'cistern', x: 83, z: 83, x0: 60, z0: 60, x1: 106, z1: 106 }); keep(56, 56, 110, 110);

  /* ---------------- THE KYBER WORKINGS ---------------- */
  keep(-110, -110, -50, -50);
  const outcrops = [[-96, -94, 9, 7, 5.5], [-70, -100, 7, 6, 4], [-100, -66, 6, 8, 4.5], [-78, -74, 5, 5, 3.2], [-60, -88, 5, 6, 3.6]];
  for (const [x, z, a, b, h] of outcrops) put({ t: 'outcrop', x, z, a, b, h });
  for (const [x, z, h] of [[-108, -108, 18], [-88, -112, 14], [-112, -84, 16], [-56, -108, 11]]) put({ t: 'spire', x, z, r: rr(3, 4.5), h });
  for (let i = 0; i < 14; i++){ const x = rr(-108, -52), z = rr(-108, -52); if (outcrops.some(([ox, oz, a, b]) => Math.hypot((x - ox) / (a + 2), (z - oz) / (b + 2)) < 1)) continue; put({ t: 'crystal', x, z, r: rr(0.5, 1.0) }); }
  put({ t: 'rails', x: -80, z: -58, len: 40, alongX: true });
  put({ t: 'mouth', x: -84, z: -112, face: [0, 1] });   // a catacomb mouth in the north wall (a crystal cave: game/zone.js)

  /* ---------------- THE TEMPLE OF THE FIRST LIGHT ---------------- */
  put({ t: 'temple', x: 0, z: -84, sky: false }); keep(-32, -112, 32, -54);
  put({ t: 'dome', x: 0, z: -90, r: 9.5, y: 15, sky: true });
  put({ t: 'minaret', x: -24, z: -104, r: 2.4, h: 32, sky: true });
  put({ t: 'minaret', x: 24, z: -104, r: 2.4, h: 26, broken: true, sky: true });
  for (let z = -46; z > -58; z -= 6) for (const s of [-1, 1]) put({ t: 'column', x: s * 9, z, r: 0.9, h: 8, cap: true });

  /* ---------------- THE HOLLOW SHRINES ---------------- */
  keep(50, -110, 110, -50);
  for (const [x, z] of [[62, -96], [92, -76], [100, -100], [74, -56]]) put({ t: 'shrine', x, z, w: 4.4, h: 4 });
  put({ t: 'ruin', x: 100, z: -60, w: 7, h: 26, sky: true });
  for (let i = 0; i < 46; i++){
    const x = rr(52, 108), z = rr(-108, -52);
    if (Math.hypot(x - 62, z + 96) < 5 || Math.hypot(x - 92, z + 76) < 5 || Math.hypot(x - 100, z + 100) < 5 || Math.hypot(x - 74, z + 56) < 5 || Math.hypot(x - 100, z + 60) < 7 || Math.hypot(x - 64, z + 62) < 5) continue;
    if (pieces.some(p => p.t === 'stone' && Math.hypot(p.x - x, p.z - z) < 4.2)) continue;
    put({ t: 'stone', x, z, w: rr(0.9, 1.4), d: rr(0.5, 0.8), h: rr(2.2, 4.2), alongX: R() < 0.5 });
  }
  for (let i = 0; i < 8; i++) put({ t: 'lamp', x: rr(54, 106), z: rr(-106, -54), h: 3.2, pilgrim: true });

  /* ---------------- THE SILENT QUARTER: a dry fountain in its little square ---------------- */
  put({ t: 'fountain', x: -80, z: 80, r: 4.5 }); keepC(-80, 80, 10);

  /* ---------------- HOUSES: every block left, cut into lots with alleys between ---------------- */
  // how tall each district builds, and how many roofs have fallen in
  const STYLE = { gate: [5, 9, 0.05], silent: [4, 8, 0.32], cistern: [5, 10, 0.12], square: [7, 12, 0.08], bazaar: [5, 9, 0.05],
    garrison: [6, 10, 0.1], workings: [3.5, 6, 0.4], temple: [6, 10, 0.2], shrines: [4, 6, 0.3] };
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
    if (R() < 0.07){ put({ t: 'crates', x: cx, z: cz, n: 2, yaw: 0 }); return; }   // a yard
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
  return { pieces };
}

function districtOf(Z, x, z){
  for (const d of Z.districts) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.id;
  return null;
}
