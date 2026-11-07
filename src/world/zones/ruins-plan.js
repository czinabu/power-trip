// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE RUINS OF THE SITH GATE, as a PLAN (data/zones.js ZONES.ruins): the dead city on the far side of the gate under
// Jedha, every piece as plain data, no meshes. world/zone-stream.js turns it into solids at once and meshes chunk by
// chunk, the same way as the old city of Jedha (world/zones/jedha-plan.js); world/zones/plan-kit.js rolls the houses.
//
// THE RUINS (north is −z; 240 m across, closed in by cliffs at ±114):
//   · the AVENUE OF THE UNBURIED runs north from the gate to the tomb's steps, lined with statues of Kharel; the CHOIR'S
//     ROAD runs east from the cloister to the bastion's gate; two ring lanes (x = ±40, z = ±40) part the nine districts;
//   · the gate's great ring and General Kast's camp at the threshold (south); the toppled colossus of Kharel in the
//     plaza (the middle); the cloister's court (west); the Choir's bastion, walled (east); the black mere's flooded court
//     (south-east); the barrow mounds (south-west); the bleeding scar's quarry, red crystal in the rock (north-west);
//     the tomb on its stepped plinth between two obelisks (north); the field of masks (north-east);
//   · everything else is the dead city's houses, most of them roofless.
// Like Jedha, raised ground a foe walks on is only ever CLIMBABLE steps: a roof is somewhere only a hero can reach.
// The ground round every quest giver, quest step and secret (data/zone-ruins.js) is kept clear of houses.

import { planContext, fillLots } from './plan-kit.js';

export function planRuins(Z){
  const ctx = planContext(Z.seed), { R, rr, put, keep, keepC, pieces } = ctx;

  /* ---------------- the roads ---------------- */
  keep(-7.5, -58, 7.5, 104);      // the Avenue of the Unburied
  keep(-118, -6.5, 54, 6.5);      // the Choir's Road (to the bastion's gate)
  for (const s of [-1, 1]){ keep(s * 36.5, -118, s * 43.5, 118); keep(-118, s * 36.5, 118, s * 43.5); }   // the ring lanes
  for (const w of Z.waystones){ keepC(w.x, w.z, 4.5); put({ t: 'waystone', x: w.x, z: w.z, gate: !!w.gate }); }
  // every place a quest or a secret needs: open ground, never under a house
  const life = Z.life || {};
  for (const q of life.quests || []){
    keepC(q.giver.at[0], q.giver.at[1], 3.5);
    for (const st of q.steps || []){
      if (st.kind === 'take') for (const [x, z] of st.at) keepC(x, z, 3);
      else if (st.at) keepC(st.at[0], st.at[1], st.kind === 'clear' ? 7 : (st.r || 4));
    }
  }
  for (const sp of life.secrets || []) keepC(sp.at[0], sp.at[1], 3);

  /* ---------------- the cliffs: the ruins sit in a basin of black rock ---------------- */
  const W = 116, T = 2.4, cliffH = 17;
  for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]){
    for (let u = -W; u < W; u += 24){
      const a = u, b = Math.min(W, u + 24), c = (a + b) / 2, len = b - a;
      put({ t: 'cliff', x: nz ? c : nx * W, z: nz ? nz * W : c, hx: nz ? len / 2 : T, hz: nz ? T : len / 2, h: cliffH + rr(-2, 4), face: [-nx, -nz] });
    }
    for (let u = -W; u <= W; u += 48) put({ t: 'spire', x: nz ? u : nx * W, z: nz ? nz * W : u, r: rr(3.6, 5), h: cliffH + rr(5, 12) });
  }
  keep(-120, 108, 120, 120); keep(-120, -120, 120, -108); keep(108, -120, 120, 120); keep(-120, -120, -108, 120);

  /* ---------------- THE THRESHOLD: the gate, and Kast's camp ---------------- */
  put({ t: 'gatering', x: 0, z: 107, r: 9, sky: true }); keep(-14, 100, 14, 116);
  // the camp, west of the avenue: tents and crates behind a line of barricades, a cook fire
  keep(-34, 56, -12, 104);
  for (let i = 0; i < 4; i++) put({ t: 'tent', x: -28 + (i % 2) * 12, z: 66 + Math.floor(i / 2) * 18, hx: 4, hz: 3.2, h: 3.2 });
  for (let i = 0; i < 6; i++) put({ t: 'crates', x: rr(-33, -14), z: rr(58, 102), n: 1 + (R() * 3 | 0), yaw: R() < 0.5 ? 0 : 1 });
  for (const [x, z, hx, hz] of [[-23, 56, 3, 0.4], [-33.5, 62, 0.4, 3], [-13.6, 60, 0.4, 2.4], [14, 56, 3, 0.4], [26, 64, 0.4, 3]]) put({ t: 'barricade', x, z, hx, hz });
  put({ t: 'brazier', x: -22, z: 92 });
  // the east side of the threshold: the gate's old forecourt, a few broken columns
  for (const [x, z, h] of [[18, 98, 9], [26, 90, 3.6], [18, 76, 9], [30, 104, 4.2]]) put({ t: 'column', x, z, r: 1.0, h, broken: h < 6, cap: h >= 6 });
  // Kast's lights down the avenue as far as the camp reaches, then the Choir's braziers to the tomb
  for (let z = 96; z > -54; z -= 14) for (const s of [-1, 1]) put(z > 40 ? { t: 'lamp', x: s * 6.4, z, h: 4.2 } : { t: 'brazier', x: s * 6.4, z });
  for (const z of [72, 30, -30]) put({ t: 'arch', x: 0, z, span: 7, h: 9, alongX: true });
  // the statues of Kharel, either side of the avenue, all facing it
  for (const z of [50, 64, -36, -50]) for (const s of [-1, 1]){ put({ t: 'sithstatue', x: s * 10.5, z, h: 6.4, face: s > 0 ? -Math.PI / 2 : Math.PI / 2 }); keepC(s * 10.5, z, 2.4); }

  /* ---------------- THE PLAZA OF THE FALLEN: the colossus of Kharel, pulled down by the Jedi who buried him ---------------- */
  keepC(0, 0, 31);
  for (let i = 0; i < 16; i++){
    const a = i / 16 * Math.PI * 2 + Math.PI / 16, x = Math.cos(a) * 27, z = Math.sin(a) * 27;
    if (Math.abs(x) < 9 || Math.abs(z) < 9) continue;   // the roads come in clear
    put({ t: 'column', x, z, r: 1.1, h: i % 3 === 1 ? rr(3, 5) : 11, broken: i % 3 !== 2, cap: i % 3 === 2 });
  }
  put({ t: 'guardian', x: -6, z: -10 });
  put({ t: 'sithstatue', x: 25.5, z: 32.5, h: 5.2, face: -2.4 }); keepC(25.5, 32.5, 2.6);   // the one a trooper is robbing (data/zone-ruins.js: the idol)
  for (const [x, z] of [[-14, 14], [14, 14], [14, -14], [-20, -20]]) put({ t: 'brazier', x, z });

  /* ---------------- THE CHOIR'S CLOISTER: a colonnaded court where the Choir sang, its dwellings round it ---------------- */
  keep(-104, -26, -56, 26);
  for (let x = -100; x <= -60; x += 8) for (const z of [-22, 22]) put({ t: 'column', x, z, r: 0.9, h: (x / 8 | 0) % 2 ? 8 : rr(3, 5), cap: (x / 8 | 0) % 2 !== 0, broken: (x / 8 | 0) % 2 === 0 });
  for (const z of [-14, 14]) for (const x of [-100, -60]) put({ t: 'column', x, z, r: 0.9, h: 8, cap: true });
  put({ t: 'fountain', x: -80, z: -14, r: 4.2 });
  for (const [x, z] of [[-96, -10], [-64, -10], [-96, 12], [-64, 12]]) put({ t: 'brazier', x, z });
  for (const x of [-92, -68]) put({ t: 'arch', x, z: 0, span: 6.5, h: 8, alongX: false });

  /* ---------------- THE CHOIR'S BASTION: their walled hold over the old city's barracks ---------------- */
  put({ t: 'garrison', x: 84, z: 0, x0: 56, z0: -32, x1: 112, z1: 32, gate: [-6, 6] }); keep(52, -36, 116, 36);

  /* ---------------- THE BLACK MERE: a drowned court, black water over the old flagstones ---------------- */
  put({ t: 'cistern', x: 83, z: 83, x0: 60, z0: 60, x1: 106, z1: 106 }); keep(56, 56, 110, 110);

  /* ---------------- THE BLEEDING SCAR: the Choir's quarry, the crystal in its rock turned red ---------------- */
  keep(-110, -110, -50, -50);
  const outcrops = [[-96, -94, 9, 7, 5.5], [-70, -100, 7, 6, 4], [-100, -66, 6, 8, 4.5], [-78, -74, 5, 5, 3.2], [-60, -88, 5, 6, 3.6]];
  for (const [x, z, a, b, h] of outcrops) put({ t: 'outcrop', x, z, a, b, h });
  for (const [x, z, h] of [[-108, -108, 20], [-88, -112, 15], [-112, -84, 17], [-56, -108, 12]]) put({ t: 'spire', x, z, r: rr(3, 4.5), h });
  for (let i = 0; i < 16; i++){ const x = rr(-108, -52), z = rr(-108, -52); if (outcrops.some(([ox, oz, a, b]) => Math.hypot((x - ox) / (a + 2), (z - oz) / (b + 2)) < 1)) continue; put({ t: 'crystal', x, z, r: rr(0.5, 1.1) }); }
  put({ t: 'rails', x: -80, z: -58, len: 40, alongX: true });
  put({ t: 'mouth', x: -84, z: -112, face: [0, 1] });

  /* ---------------- THE TOMB OF KHAREL: the barrow-temple the Jedi raised over his grave ---------------- */
  put({ t: 'temple', x: 0, z: -84, sky: false }); keep(-32, -112, 32, -54);
  put({ t: 'dome', x: 0, z: -90, r: 9.5, y: 15, sky: true });
  put({ t: 'obelisk', x: -24, z: -104, r: 2.2, h: 36, sky: true });
  put({ t: 'obelisk', x: 24, z: -104, r: 2.2, h: 30, sky: true });
  for (let z = -46; z > -58; z -= 6) for (const s of [-1, 1]) put({ t: 'brazier', x: s * 9, z });

  /* ---------------- THE FIELD OF MASKS: the Choir buried standing, a mask on every stone ---------------- */
  keep(50, -110, 110, -50);
  const tombs = [[62, -96], [92, -76], [100, -100], [74, -56]];
  for (const [x, z] of tombs) put({ t: 'shrine', x, z, w: 4.4, h: 4 });
  put({ t: 'ruin', x: 100, z: -60, w: 7, h: 28, sky: true });
  for (let i = 0; i < 46; i++){
    const x = rr(52, 108), z = rr(-108, -52);
    if (tombs.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 5) || Math.hypot(x - 100, z + 60) < 7 || Math.hypot(x - 64, z + 62) < 5) continue;
    if (life.secrets && life.secrets.some(sp => Math.hypot(sp.at[0] - x, sp.at[1] - z) < 4)) continue;
    if ((life.quests || []).some(q => Math.hypot(q.giver.at[0] - x, q.giver.at[1] - z) < 4.5)) continue;
    if (pieces.some(p => p.t === 'stone' && Math.hypot(p.x - x, p.z - z) < 4.2)) continue;
    put({ t: 'stone', x, z, w: rr(0.9, 1.4), d: rr(0.5, 0.8), h: rr(2.2, 4.2), alongX: R() < 0.5 });
  }
  for (let i = 0; i < 8; i++) put({ t: 'lamp', x: rr(54, 106), z: rr(-106, -54), h: 3.2, pilgrim: true });

  /* ---------------- THE BARROW FIELD: grave mounds and the tombs of the Jedi who fell burying him ---------------- */
  const barrows = [[-92, 72, 7, 5, 3.4], [-66, 62, 6, 4.5, 2.8], [-106, 86, 5, 6, 3], [-74, 108, 6, 4, 2.6], [-54, 92, 4.5, 5, 2.4]];
  for (const [x, z, a, b, h] of barrows){ put({ t: 'outcrop', x, z, a, b, h }); keep(x - a - 1, z - b - 1, x + a + 1, z + b + 1); }
  for (const [x, z] of [[-112, 60], [-82, 96]]){ put({ t: 'shrine', x, z, w: 3.8, h: 3.4 }); keepC(x, z, 4); }
  for (let i = 0; i < 18; i++){
    const x = rr(-112, -48), z = rr(48, 112);
    if (barrows.some(([bx, bz, a, b]) => Math.hypot((x - bx) / (a + 2), (z - bz) / (b + 2)) < 1)) continue;
    if (pieces.some(p => (p.t === 'stone' || p.t === 'shrine') && Math.hypot(p.x - x, p.z - z) < 4.5)) continue;
    if (!ctx.clear(x - 1, z - 1, x + 1, z + 1, 1)) continue;
    put({ t: 'stone', x, z, w: rr(0.8, 1.2), d: rr(0.4, 0.7), h: rr(1.6, 3), alongX: R() < 0.5 });
    keepC(x, z, 1.4);
  }

  /* ---------------- HOUSES: the dead city's, most of them roofless ---------------- */
  const STYLE = { threshold: [4, 7, 0.45], avenue: [6, 11, 0.35], cloister: [5, 9, 0.2], bastion: [5, 8, 0.4], mere: [4, 8, 0.5],
    scar: [3, 5, 0.6], tomb: [6, 10, 0.45], masks: [3.5, 6, 0.5], barrows: [3, 5, 0.7] };
  fillLots(Z, ctx, STYLE, { yard: 0.1 });
  return { pieces };
}
