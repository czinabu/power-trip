// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TOWERING backdrop pieces: the things that make a hero feel SMALL. The rest of the backdrop (world/backdrop.js) is
// mostly far away and pushed further out by its DEPTH stretch, so it reads as a wide horizon but never as tall. These
// stand CLOSE, just past the play space's edge, and climb high over it, so you look UP at them: canyon walls and
// mountain faces, forest giants whose canopy reaches out over the floor, colossal statues, colonnades, a single
// megastructure, a crane spanning the yard overhead, Kamino's city on its stilts. No collision and no stretch: each
// piece keeps itself out of the play space (keepOut, measured by its foot only, so a canopy, a crane's beam or a
// tower's top may lean in overhead, all well above anything you can stand on or fly to) and is baked into the backdrop
// with the rest (one draw call per material), so it costs a few hundred triangles each.
//
// A theme lists them in its backdrop like any other piece ({ kind: 'bluffs', ... }); every mode that builds that map
// gets them (story, survival, sandbox, training, co-op, arcade), since they are part of the world's look.
//   K: the backdrop's own helpers (put, mat, glowMat, keepOut, since, angles, P, rand2, crag, lim) — see backdrop.js

import * as THREE from 'three';

const PI = Math.PI;
// the angle that turns a piece standing at polar angle `az` to face the middle of the arena (its local +Z inward)
const faceIn = az => Math.atan2(-Math.cos(az), -Math.sin(az));
const pick = (R, v, d) => Array.isArray(v) ? v[0] + R() * (v[1] - v[0]) : (v ?? d);
// the spots a kind stands on: a fixed list of angles (o.az) or a spread round the arena (o.count, o.skip)
const spots = (o, R, K) => o.az != null ? [].concat(o.az) : K.angles(o.count || 6, R, o.skip);

export const TALL = {
  /* BLUFFS — a canyon wall or a mountain face right at the edge, climbing in two to four broken tiers, each a little
     narrower and stepped back so the face leans away from you (never over you) as it goes up. `cap`: snow, grass or
     ash on the top tier. `h` is its full height in metres (everyone is ~2.6 m): 50–120 makes a hero an ant. */
  bluffs(grp, o, half, R, K){
    for (const a of spots(o, R, K)){
      const r = half * pick(R, o.r, 1.25), [x, z] = K.P(a, r), H = pick(R, o.h, 60), n0 = grp.children.length;
      let w = half * pick(R, o.w, 0.3) * (0.85 + R() * 0.4), y = 0, d = 0;
      const tiers = o.tiers || 3, ox = Math.cos(a), oz = Math.sin(a);
      for (let t = 0; t < tiers; t++){
        const th = H / tiers * (t ? 1.05 : 1.2), col = (t + (R() < 0.5 ? 0 : 1)) % 2 ? o.color : (o.color2 ?? o.color);
        K.put(grp, K.crag(Math.floor(a * 977) + t), K.mat(col), x + ox * d, y + th * 0.5, z + oz * d,
          (R() - 0.5) * 0.12, R() * PI, (R() - 0.5) * 0.12, [w, th * 0.62, w * (0.55 + R() * 0.2)]);
        y += th * 0.78; d += w * 0.22; w *= 0.74 + R() * 0.1;
      }
      if (o.cap) K.put(grp, K.crag(Math.floor(a * 331)), K.mat(o.cap), x + ox * d, y + H * 0.03, z + oz * d, 0, R() * PI, 0, [w * 1.1, H * 0.06, w * 0.7]);
      if (o.glow && R() < (o.glows ?? 0.3)) K.put(grp, new THREE.BoxGeometry(0.5, H * 0.3, 0.5), K.glowMat(o.glow), x - ox * w * 0.4, H * 0.2, z - oz * w * 0.4, 0, 0, (R() - 0.5) * 0.4);
      K.keepOut(K.since(grp, n0));
    }
  },

  /* GIANTS — forest giants just past the edge: a trunk wider than a gunship, root buttresses, a few limbs and a crown
     of leaf masses high overhead, some reaching in over the floor (`reach`, in half-widths) so the fight happens
     UNDER the trees. shape 'cedar' stacks drooping tiers up a straight trunk instead (Thane's cedars). */
  giants(grp, o, half, R, K){
    const bark = K.mat(o.bark ?? 0x3a2a20), leaf = K.mat(o.leaf ?? 0x24361e), leaf2 = K.mat(o.leaf2 ?? o.leaf ?? 0x2c4226);
    for (const a of spots(o, R, K)){
      const r = half * pick(R, o.r, 1.2), [x, z] = K.P(a, r), H = pick(R, o.h, 70), tr = pick(R, o.trunk, [2.2, 3.6]), n0 = grp.children.length;
      const lean = (R() - 0.5) * 0.06, ix = -Math.cos(a), iz = -Math.sin(a);
      const trunk = K.put(grp, new THREE.CylinderGeometry(tr * 0.55, tr, H, 9), bark, x, H / 2, z, lean, R() * PI, -lean);
      const foot = [trunk];
      // root buttresses: thin fins leaning out from the foot
      for (let k = 0; k < 4; k++){
        const ra = R() * PI * 2, rl = tr * (2.2 + R()), rh = tr * (2.4 + R() * 1.5);
        foot.push(K.put(grp, new THREE.BoxGeometry(rl, rh, tr * 0.35), bark, x + Math.cos(ra) * rl * 0.4, rh * 0.32, z + Math.sin(ra) * rl * 0.4, 0, -ra, Math.cos(ra) > 0 ? -0.5 : 0.5));
      }
      if (o.shape === 'cedar'){
        // a straight trunk under drooping tiers: wide at the bottom of the crown, a spike at the top
        const n = o.tiers || 6, base = H * 0.32, c = pick(R, o.crown, 9);
        for (let k = 0; k < n; k++){
          const f = k / n, th = (H - base) / n * 1.5, cr = c * (1 - f * 0.78);
          K.put(grp, new THREE.ConeGeometry(cr, th, 8), k % 2 ? leaf : leaf2, x, base + (H - base) * f + th * 0.4, z, 0, R() * PI, 0, [1, 1, 0.8 + R() * 0.3]);
        }
      } else {
        // a few limbs out from the upper trunk, a crown of flattened leaf masses on top, the biggest reaching inward
        const c = pick(R, o.crown, 12), reach = half * pick(R, o.reach, 0);
        for (let k = 0; k < 3; k++){
          const la = R() * PI * 2, ll = c * (0.8 + R() * 0.5), ly = H * (0.62 + R() * 0.2);
          const limb = K.put(grp, new THREE.CylinderGeometry(tr * 0.18, tr * 0.32, ll, 6), bark, x + Math.cos(la) * ll * 0.42, ly + ll * 0.25, z + Math.sin(la) * ll * 0.42);
          limb.lookAt(x + Math.cos(la) * ll, ly + ll * 0.6, z + Math.sin(la) * ll); limb.rotateX(PI / 2);
        }
        const masses = 4 + Math.floor(R() * 3);
        for (let k = 0; k < masses; k++){
          const ma = R() * PI * 2, md = c * (0.2 + R() * 0.6), s = c * (0.55 + R() * 0.4);
          K.put(grp, new THREE.IcosahedronGeometry(1, 1), k % 2 ? leaf : leaf2, x + Math.cos(ma) * md, H * (0.9 + R() * 0.12), z + Math.sin(ma) * md, R(), R() * PI, R(), [s, s * 0.42, s]);
        }
        if (reach > 0){   // a great bough reaching out over the floor, its leaves hanging well above anything you stand on
          const by = H * (0.72 + R() * 0.12), bx = x + ix * reach, bz = z + iz * reach;
          const bough = K.put(grp, new THREE.CylinderGeometry(tr * 0.16, tr * 0.3, reach * 1.05, 6), bark, (x + bx) / 2, by - 2, (z + bz) / 2);
          bough.lookAt(bx, by + 3, bz); bough.rotateX(PI / 2);
          for (let k = 0; k < 3; k++){
            const s = c * (0.5 + R() * 0.35), t = 0.55 + k * 0.22;
            K.put(grp, new THREE.IcosahedronGeometry(1, 1), k % 2 ? leaf : leaf2, x + ix * reach * t + (R() - 0.5) * c * 0.5, by + 2 + R() * 3, z + iz * reach * t + (R() - 0.5) * c * 0.5, R(), R() * PI, R(), [s, s * 0.38, s]);
          }
          if (o.vines) for (let k = 0; k < 3; k++){   // hanging vines off the bough
            const t = 0.4 + R() * 0.55, vl = 6 + R() * 10;
            K.put(grp, new THREE.CylinderGeometry(0.12, 0.12, vl, 4), K.mat(o.vines), x + ix * reach * t, by - vl / 2, z + iz * reach * t);
          }
        }
      }
      K.keepOut(K.since(grp, n0), foot);
    }
  },

  /* COLOSSI — robed statues tens of metres tall, standing at the edge and facing in: a plinth, a long robe, a hooded
     head bowed over the hilt of a blade held point-down in both hands (Jedha's guardians; in black stone with a red
     blade, Exegol's Sith). `h` is the full height. */
  colossi(grp, o, half, R, K){
    const m = K.mat(o.color), m2 = K.mat(o.color2 ?? o.color), dark = K.mat(o.dark ?? 0x1a1410);
    for (const a of spots(o, R, K)){
      const r = half * pick(R, o.r, 1.3), [x, z] = K.P(a, r), H = pick(R, o.h, 60), s = H / 56;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = faceIn(a); grp.add(g);
      const plinth = K.put(g, new THREE.BoxGeometry(15 * s, 6 * s, 15 * s), m2, 0, 3 * s, 0);
      const robe = K.put(g, new THREE.CylinderGeometry(5 * s, 8.5 * s, 34 * s, 8), m, 0, 23 * s, 0);
      K.put(g, new THREE.BoxGeometry(13 * s, 6 * s, 7.5 * s), m, 0, 42 * s, 0);                                   // shoulders
      K.put(g, new THREE.IcosahedronGeometry(3.6 * s, 1), m, 0, 48.5 * s, 0.6 * s);                                 // head
      K.put(g, new THREE.ConeGeometry(5.4 * s, 10 * s, 8, 1, true), m2, 0, 49.5 * s, -0.4 * s, 0.25, 0, 0);       // hood
      K.put(g, new THREE.BoxGeometry(4.2 * s, 4.6 * s, 0.6 * s), dark, 0, 47.8 * s, 3.5 * s, 0.25, 0, 0);           // the face, in shadow
      for (const sx of [-1, 1]) K.put(g, new THREE.BoxGeometry(2.6 * s, 13 * s, 2.8 * s), m2, sx * 4.2 * s, 36.5 * s, 3 * s, -0.55, 0, sx * -0.18);   // arms in to the hilt
      K.put(g, new THREE.BoxGeometry(5.2 * s, 3.2 * s, 3.4 * s), m2, 0, 31 * s, 6.2 * s);                           // hands on the hilt
      K.put(g, new THREE.CylinderGeometry(0.9 * s, 0.9 * s, 6 * s, 8), K.mat(o.metal ?? 0x6a665e), 0, 31 * s, 6.4 * s);   // the hilt
      K.put(g, new THREE.BoxGeometry(1.1 * s, 22 * s, 0.5 * s), o.blade ? K.glowMat(o.blade) : m2, 0, 17 * s, 6.4 * s);   // the blade, point to the plinth
      if (o.eyes) for (const sx of [-1, 1]) K.put(g, new THREE.BoxGeometry(0.9 * s, 0.3 * s, 0.2 * s), K.glowMat(o.eyes), sx * 0.9 * s, 48.4 * s, 3.85 * s);
      g.updateMatrixWorld(true);   // (measured through the group: its parts' world boxes need it placed first)
      K.keepOut([g], [plinth, robe]);
    }
  },

  /* COLONNADE — colossal columns round the edge, some broken off, a few still carrying a lintel between pairs: the
     ruin of a great hall that once roofed the floor (the archive, the Sith amphitheatre). */
  colonnade(grp, o, half, R, K){
    const m = K.mat(o.color), m2 = K.mat(o.color2 ?? o.color);
    for (const a of spots(o, R, K)){
      const r = half * pick(R, o.r, 1.2), [x, z] = K.P(a, r), H = pick(R, o.h, 40), cr = pick(R, o.radius, [2, 3]), n0 = grp.children.length;
      const broken = R() < (o.broken ?? 0.35), hh = broken ? H * (0.45 + R() * 0.35) : H;
      const shaft = K.put(grp, new THREE.CylinderGeometry(cr * 0.9, cr, hh, 10), m, x, hh / 2, z);
      const base = K.put(grp, new THREE.BoxGeometry(cr * 2.8, cr * 1.2, cr * 2.8), m2, x, cr * 0.6, z, 0, -a, 0);
      if (broken) K.put(grp, new THREE.CylinderGeometry(cr * 0.8, cr * 0.9, cr * 1.2, 7), m, x, hh + cr * 0.2, z, (R() - 0.5) * 0.7, R(), (R() - 0.5) * 0.7);   // the snapped top
      else {
        K.put(grp, new THREE.BoxGeometry(cr * 3, cr * 1.1, cr * 3), m2, x, H + cr * 0.55, z, 0, -a, 0);   // capital
        if (o.lintel && R() < o.lintel){   // a lintel along the ring to the next column (it may hang in over the corner)
          const span = r * 0.42, ta = a + PI / 2;
          K.put(grp, new THREE.BoxGeometry(span, cr * 1.3, cr * 2), m2, x + Math.cos(ta) * span * 0.5, H + cr * 1.6, z + Math.sin(ta) * span * 0.5, 0, -ta, 0);
        }
      }
      if (o.glow && R() < 0.4) K.put(grp, new THREE.BoxGeometry(0.3, hh * 0.5, 0.3), K.glowMat(o.glow), x - Math.cos(a) * cr * 0.95, hh * 0.35, z - Math.sin(a) * cr * 0.95);
      K.keepOut(K.since(grp, n0), [shaft, base]);
    }
  },

  /* TOWER — ONE megastructure close enough to loom: tiers tapering up a shaft (square, or `sides`), buttress fins at
     the foot, lit bands and rings (`glow`, `rings`), an antenna at the top. A citadel keep, a relay spire, an
     Imperial prison tower, a barge's superstructure. `h` is its height; `w` its base width. */
  tower(grp, o, half, R, K){
    const m = K.mat(o.color), m2 = K.mat(o.color2 ?? o.color), sides = o.sides || 4;
    for (const a of spots(o, R, K)){
      const r = half * pick(R, o.r, 1.6), [x, z] = K.P(a, r), H = pick(R, o.h, 160), W = pick(R, o.w, 26);
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = faceIn(a) + PI / sides; grp.add(g);
      const tiers = o.tiers || 4, foot = [];
      let y = 0, w = W;
      for (let t = 0; t < tiers; t++){
        const th = H * 0.82 / tiers * (t ? 1 : 1.25), top = w * (o.taper ?? 0.8);
        const seg = K.put(g, new THREE.CylinderGeometry(top / Math.SQRT2, w / Math.SQRT2, th, sides), t % 2 ? m2 : m, 0, y + th / 2, 0);
        if (!t) foot.push(seg);
        if (o.glow){   // a lit band round the top of each tier
          K.put(g, new THREE.CylinderGeometry(top / Math.SQRT2 + 0.15, top / Math.SQRT2 + 0.15, Math.max(0.6, H * 0.006), sides), K.glowMat(o.glow), 0, y + th * 0.9, 0);
        }
        if (o.rings && t){   // a platform ring jutting out between tiers (the relay's emitter rings)
          K.put(g, new THREE.CylinderGeometry(w * 0.85, w * 0.85, Math.max(1, H * 0.01), 16), m2, 0, y, 0);
          K.put(g, new THREE.TorusGeometry(w * 0.85, Math.max(0.4, H * 0.004), 4, 24), K.glowMat(o.rings), 0, y, 0, PI / 2);
        }
        y += th; w = top * 0.88;
      }
      // buttress fins at the foot, leaning in to the shaft
      if (o.fins !== false) for (let k = 0; k < sides; k++){
        const fa = (k + 0.5) / sides * PI * 2, fh = H * 0.3;
        foot.push(K.put(g, new THREE.BoxGeometry(W * 0.12, fh, W * 0.55), m2, Math.cos(fa) * W * 0.48, fh * 0.45, Math.sin(fa) * W * 0.48, 0, -fa, Math.cos(fa) * 0.0));
      }
      // the crown: a narrow mast and a beacon
      const mh = H - y;
      if (mh > 1){
        K.put(g, new THREE.CylinderGeometry(w * 0.05, w * 0.16, mh, 6), m, 0, y + mh / 2, 0);
        if (o.beacon) K.put(g, new THREE.SphereGeometry(Math.max(0.8, w * 0.1), 8, 6), K.glowMat(o.beacon), 0, H, 0);
      }
      if (o.windows) for (let k = 0; k < 18; k++){   // scattered lit windows up the faces
        const wy = 6 + R() * y * 0.9, wa = Math.floor(R() * sides) / sides * PI * 2 + PI / sides, ww = W * (1 - wy / H * 0.6) * 0.36;
        K.put(g, new THREE.BoxGeometry(Math.max(0.8, W * 0.06), Math.max(1.2, H * 0.012), 0.4), K.glowMat(o.windows), Math.cos(wa) * ww, wy, Math.sin(wa) * ww, 0, -wa + PI / 2, 0);
      }
      g.updateMatrixWorld(true);
      K.keepOut([g], foot);
    }
  },

  /* GANTRY — a crane or a gantry bridge spanning the WHOLE yard overhead: two lattice legs out past the edge on either
     side, a deep girder between them high above the floor, and a trolley with its hook hanging over the middle.
     `axis` 'x' (the beam runs east–west) or 'z'; `at` the offset across, in half-widths; `y` the beam's height. */
  gantry(grp, o, half, R, K){
    const m = K.mat(o.color), m2 = K.mat(o.color2 ?? o.color), [lx, lz] = K.lim();
    for (const g0 of [].concat(o.at ?? 0)){
      const alongX = (o.axis || 'x') === 'x', L = (alongX ? lx : lz) + (o.out ?? 6), across = g0 * (alongX ? lz : lx), Y = pick(R, o.y, 40), D = o.depth || 3.2;
      const at = (u, y, v) => alongX ? [u, y, v] : [v, y, u];
      // the legs: four posts and cross bracing, out past the edge on each end
      for (const s of [-1, 1]){
        for (const [du, dv] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) K.put(grp, new THREE.BoxGeometry(0.8, Y + D, 0.8), m, ...at(s * L + du, (Y + D) / 2, across + dv));
        for (let y = 6; y < Y; y += 8){
          K.put(grp, new THREE.BoxGeometry(alongX ? 3.6 : 0.4, 0.5, alongX ? 0.4 : 3.6), m2, ...at(s * L, y, across - 1.6));
          K.put(grp, new THREE.BoxGeometry(alongX ? 3.6 : 0.4, 0.5, alongX ? 0.4 : 3.6), m2, ...at(s * L, y, across + 1.6));
        }
      }
      // the girder: a deep box with a lower chord and diagonal web, a stripe down its face
      K.put(grp, new THREE.BoxGeometry(alongX ? L * 2 + 4 : 3.6, D * 0.45, alongX ? 3.6 : L * 2 + 4), m, ...at(0, Y + D * 0.78, across));
      K.put(grp, new THREE.BoxGeometry(alongX ? L * 2 + 4 : 3.2, 0.6, alongX ? 3.2 : L * 2 + 4), m, ...at(0, Y, across));
      for (let u = -L; u < L; u += 6){
        const web = K.put(grp, new THREE.BoxGeometry(0.4, D * 1.2, 0.4), m2, ...at(u + 1.5, Y + D * 0.4, across));
        web.rotation[alongX ? 'z' : 'x'] = 0.75 * (Math.round(u / 6) % 2 ? 1 : -1);
      }
      if (o.stripe) K.put(grp, new THREE.BoxGeometry(alongX ? L * 2 : 0.1, 0.5, alongX ? 0.1 : L * 2), K.mat(o.stripe), ...at(0, Y + D * 0.78, across + 1.85));
      // the trolley and its hook, hanging well above the floor (nothing over the play space comes below 20 m)
      const tu = (R() - 0.5) * L * 0.6, hook = Math.min(pick(R, o.hook, 8), Y - 22);   // the hook stays out of reach (over 16 m)
      K.put(grp, new THREE.BoxGeometry(4.5, 2.4, 4.5), m2, ...at(tu, Y - 1.4, across));
      K.put(grp, new THREE.CylinderGeometry(0.14, 0.14, hook, 4), m, ...at(tu, Y - 2.6 - hook / 2, across));
      K.put(grp, new THREE.BoxGeometry(1.6, 1.4, 1.6), m2, ...at(tu, Y - 3.3 - hook, across));
      if (o.lamp) for (const s of [-1, 1]) K.put(grp, new THREE.SphereGeometry(0.6, 8, 6), K.glowMat(o.lamp), ...at(s * L, Y + D + 0.8, across));
    }
  },

  /* PODS — Tipoca City on Kamino: domed pods on tall stilts out in the sea round the drowned levels, a lit band under
     each dome, the biggest high over your head. */
  pods(grp, o, half, R, K){
    const m = K.mat(o.color), m2 = K.mat(o.color2 ?? o.color);
    for (const a of spots(o, R, K)){
      const r = half * pick(R, o.r, 1.5), [x, z] = K.P(a, r), Y = pick(R, o.h, 50), PR = pick(R, o.size, [10, 18]), n0 = grp.children.length;
      const legs = [];
      for (let k = 0; k < 3; k++){
        const la = k / 3 * PI * 2 + a, lr = PR * 0.45;
        legs.push(K.put(grp, new THREE.CylinderGeometry(PR * 0.06, PR * 0.09, Y + 4, 8), m2, x + Math.cos(la) * lr, (Y - 4) / 2, z + Math.sin(la) * lr));
      }
      K.put(grp, new THREE.CylinderGeometry(PR, PR * 0.7, PR * 0.35, 18), m, x, Y, z);                                        // the underside
      K.put(grp, new THREE.SphereGeometry(PR, 18, 8, 0, PI * 2, 0, PI / 2), m, x, Y + PR * 0.17, z, 0, 0, 0, [1, 0.42, 1]);   // the dome
      if (o.glow) K.put(grp, new THREE.CylinderGeometry(PR * 1.005, PR * 1.005, Math.max(0.5, PR * 0.06), 18, 1, true), K.glowMat(o.glow), x, Y + PR * 0.12, z);
      K.keepOut(K.since(grp, n0), legs);
    }
  },
};
