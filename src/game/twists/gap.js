// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GAP (the Last Ship's ramp): halfway through the hold a shell finds the ramp. The line stops, rubble blocks the
// way up, and the hold can't go on until it's dragged clear (stand at each pile), with the foes still coming for the
// ramp. Warned first: a whistle and a ring on the ramp a couple of seconds before it lands, so you can get off it.
//   at: the hold's progress it comes at (0..1) · hit: [x, z] where the shell lands · piles: [[x, z]…] the rubble ·
//   clear: seconds at each pile · r: how close to stand · line: { jedi, mando } the banner's line once it's down
import * as THREE from 'three';
import { TW, ev, prop, line, ringMesh, puffAt } from './kit.js';
import { V3 } from '../../utils.js';
import { G } from '../../state.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx, S as SFX } from '../../audio/sfx.js';
import { heroIn, makeBeacon, removeMarker } from '../objectives.js';

const FUSE = 2.6;
function pileMesh(seed){
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 5; i++){
    const a = (seed * 7 + i * 2.3), s = 0.45 + ((seed + i) % 3) * 0.22;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
    m.position.set(Math.cos(a) * 0.8, s * 0.6, Math.sin(a) * 0.8); m.rotation.set(a, a * 1.7, 0); m.castShadow = true;
    g.add(m);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.6, metalness: 0.6 }));
  beam.position.y = 0.9; beam.rotation.set(0.2, seed, 0.35); beam.castShadow = true; g.add(beam);
  g.userData.ring = ringMesh(0xffa040, 0.08, 0.8); g.add(g.userData.ring); g.userData.ring.rotation.x = -Math.PI / 2;
  return g;
}
function buildPiles(tw){
  TW.s.piles = tw.piles.map(([x, z], i) => {
    const m = prop(pileMesh(i + 1)); m.position.set(x, 0, z);
    m.userData.ring.scale.setScalar(tw.r ?? 2.2);
    return { x, z, prog: 0, done: false, m };
  });
}
export default {
  mood: { fill: 0.94, fog: 0x5a3020 },
  begin(){ TW.s = { phase: 0, t1: 0, piles: null, marks: [] }; },
  update(tw, dt, ctx){
    const S = TW.s;
    TW.k = S.phase === 1 || S.phase === 2 ? Math.min(1, TW.k + dt) : Math.max(0, TW.k - dt * 0.4);
    // the rubble, while it's down (its smoke, and the work on it)
    if (S.piles) for (const p of S.piles){
      if (p.done){ p.m.position.y = Math.max(-1.6, p.m.position.y - dt * 1.4); continue; }
      if (Math.random() < dt * 3) burst(V3(p.x + (Math.random() - 0.5), 1.0, p.z + (Math.random() - 0.5)), 0x5a5048, 1, 1, 2, 1.0);
      p.m.userData.ring.material.opacity = 0.4 + 0.5 * (p.prog / (tw.clear ?? 2.4)) + 0.1 * Math.sin(G.gt * 6);
    }
    if (ctx.guest) return;
    if (S.phase === 0 && (ctx.frac || 0) >= (tw.at ?? 0.45)){
      S.phase = 1; S.t1 = TW.t;
      ev('blast', { x: tw.hit[0], z: tw.hit[1], r: 4.6, fuse: FUSE, dmg: 26, foe: 90, col: 0xff4a2a, big: 1 });
      sfx(1700, FUSE, 'sine', 0.03, 220);
      showBanner('INCOMING', 'They have the ramp\'s range. Get clear of it!', 2.2, { kicker: 'WARNING' });
    }
    if (S.phase === 1 && TW.t - S.t1 > FUSE + 0.1){
      S.phase = 2;
      buildPiles(tw);
      G.shake = Math.max(G.shake, 0.9);
      for (const p of S.piles){ puffAt(p.x, p.z, 0x6a6058, 14); const b = makeBeacon(p.x, p.z, 0, 0xffa040, 1.2); ctx.mark && ctx.mark(b); p.beacon = b; }
      showBanner('THE RAMP IS HIT', line(tw), 3.6, { kicker: 'THE LINE STOPS' });
    }
    if (S.phase !== 2) return;
    let left = 0;
    for (const p of S.piles){
      if (p.done) continue;
      if (!heroIn(p.x, p.z, tw.r ?? 2.2)){ left++; continue; }
      p.prog += dt;
      if (Math.random() < dt * 8) burst(V3(p.x, 0.8, p.z), 0x8a8078, 2, 4, 3, 0.6);
      if (Math.floor(p.prog * 3) !== Math.floor((p.prog - dt) * 3)) sfx(220 + p.prog * 60, 0.06, 'square', 0.025, 140);
      if (p.prog >= (tw.clear ?? 2.4)){
        p.done = true;
        puffAt(p.x, p.z, 0x8a8078, 12); floater(V3(p.x, 1.8, p.z), 'CLEARED', '#7bffae'); SFX.reward(1);
        if (p.beacon){ ctx.unmark ? ctx.unmark(p.beacon) : removeMarker(p.beacon); p.beacon = null; }
      } else left++;
    }
    if (!left){ S.phase = 3; showBanner('THE RAMP IS CLEAR', 'They\'re moving again.', 2.2); }
  },
  gate(tw){
    const S = TW.s;
    if (S.phase === 1) return { rate: 0, status: 'INCOMING · GET CLEAR OF THE RAMP', warn: true };
    if (S.phase === 2){ const n = S.piles.filter(p => !p.done).length; return { rate: 0, status: 'RAMP BLOCKED · CLEAR THE RUBBLE (' + n + ' LEFT)', warn: true }; }
    return null;
  },
  target(){
    const S = TW.s;
    if (S.phase !== 2) return null;
    const p = S.piles.find(p => !p.done);
    return p ? V3(p.x, 0, p.z) : null;
  },
  snap(){ const S = TW.s; return [S.phase, ...(S.piles || []).map(p => p.done ? -1 : Math.round(p.prog * 10) / 10)]; },
  sync(tw, w){
    const S = TW.s;
    S.phase = w[0];
    if (S.phase >= 2 && !S.piles){ buildPiles(tw); for (const p of S.piles) puffAt(p.x, p.z, 0x6a6058, 14); }
    if (S.piles) S.piles.forEach((p, i) => { const v = w[i + 1]; if (v === -1 && !p.done){ p.done = true; puffAt(p.x, p.z, 0x8a8078, 12); } else if (v >= 0) p.prog = v; });
  },
  end(){ TW.s.piles = null; },
};
