// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PRESSES (the Chip Foundry): the chip presses are still running while you rig them. Each one's head hangs over its
// console and comes down on a beat: it glows and whines as it gets ready, then slams. Standing at the console when it
// lands costs you; a foe standing there is flattened. Work in the strokes' gaps and step out on the glow. A press stops
// once its charge is set. One runs slower than the rest (the one you reach first), to learn the beat on.
//   period: [the slow press, the others] seconds per stroke · slow: which console's press is the slow one · warn:
//   seconds of glow before it lands · r: what it covers · dmg · foeDmg · line: { … }
import * as THREE from 'three';
import { TW, prop, line, ringMesh, meIn, hurtMe, shoveMe, foesIn, hurtFoe } from './kit.js';
import { G } from '../../state.js';
import { V3 } from '../../utils.js';
import { playerPos } from '../../player/helpers.js';
import { showBanner } from '../../ui/banners.js';
import { burst } from '../../fx/particles.js';
import { sparks } from '../../fx/ink.js';
import { sfx, S as SFX } from '../../audio/sfx.js';

const TOP = 4.6, LOW = 1.1;
function head(){
  const g = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 2.8), new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.5, metalness: 0.7 }));
  block.castShadow = true; g.add(block);
  const face = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 2.6), new THREE.MeshBasicMaterial({ color: 0xff6a1e, toneMapped: false }));
  face.position.y = -0.6; g.add(face);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 8), new THREE.MeshStandardMaterial({ color: 0x2a2e34, metalness: 0.7, roughness: 0.4 }));
  rod.position.y = 3.5; g.add(rod);
  g.userData.face = face;
  return g;
}
// where a press is in its stroke: 0 up · 1 glowing (k: how far) · 2 down
function stroke(P, warn, u){
  const v = ((u % P) + P) % P;
  if (v < P - warn - 0.15) return [0, 0, v];
  if (v < P - 0.15) return [1, (v - (P - warn - 0.15)) / warn, v];
  return [2, 1, v];
}
export default {
  mood: { fill: 0.92, fog: 0x3a2018 },
  begin(){ TW.s = { said: false, p: null }; },
  update(tw, dt, ctx){
    const S = TW.s, cons = ctx.o && ctx.o.consoles;
    if (!cons) return;
    // the presses where their consoles are (the host's own spots, sent once to a guest)
    if (!S.p){
      const at = ctx.s && ctx.s.cons ? ctx.s.cons.map(c => [c.x, c.z]) : S.at || cons.map(c => c.at);
      S.p = at.map(([x, z], i) => {
        const g = prop(head()); g.position.set(x, TOP, z);
        const ring = prop(ringMesh(0xff6a1e, 0.1, 0.8)); ring.position.set(x, 0.1, z); ring.scale.setScalar(tw.r ?? 2.1);
        const P = i === (tw.slow ?? 0) ? (tw.period ? tw.period[0] : 4.6) : (tw.period ? tw.period[1] : 3.4);
        return { x, z, g, ring, P, off: i * 1.3, last: 0, done: false };
      });
    }
    TW.k = Math.min(1, TW.k + dt * 0.3);
    if (!S.said && !ctx.guest){ S.said = true; showBanner('THE PRESSES ARE RUNNING', line(tw), 4, { kicker: 'MIND THE STROKE' }); }
    const warn = tw.warn ?? 1.0;
    S.p.forEach((p, i) => {
      if (!ctx.guest && ctx.s && ctx.s.cons && ctx.s.cons[i]) p.done = ctx.s.cons[i].done;
      if (p.done){ p.g.position.y += (TOP + 0.6 - p.g.position.y) * Math.min(1, dt * 2); p.ring.visible = false; p.g.userData.face.material.color.setHex(0x3a3a3a); return; }
      const [ph, k, v] = stroke(p.P, warn, TW.t + p.off);
      const y = ph === 0 ? (v < 0.6 ? LOW + (TOP - LOW) * (v / 0.6) : TOP) : ph === 1 ? TOP - 0.5 * k : LOW;
      p.g.position.y += (y - p.g.position.y) * Math.min(1, dt * (ph === 2 ? 40 : 8));
      p.ring.material.opacity = ph === 1 ? 0.3 + 0.6 * Math.abs(Math.sin(k * 12)) : 0.15;
      p.g.userData.face.material.color.setHex(ph === 1 && Math.sin(k * 30) > 0 ? 0xffd04a : 0xff6a1e);
      if (ph === 1 && (p.whine = (p.whine || 0) - dt) <= 0){ p.whine = 0.25; sfx(500 + k * 700, 0.08, 'sawtooth', 0.015, 600 + k * 700); }
      // the stroke lands
      if (ph === 2 && p.last !== 2){
        const pp = playerPos(), d = Math.hypot(pp.x - p.x, pp.z - p.z);
        SFX.boom(V3(p.x, 0.5, p.z), 0.6);
        G.shake = Math.max(G.shake, Math.max(0, 0.5 - d / 30));
        sparks(V3(p.x, 0.6, p.z), 0xffc46a, 10, 12, { life: 0.4, up: 0.3, size: 0.4 });
        burst(V3(p.x, 0.3, p.z), 0x6a6460, 8, 5, 2, 0.8);
        if (meIn(p.x, p.z, tw.r ?? 2.1, LOW + 0.5) && hurtMe(tw.dmg ?? 20, p.x, p.z) !== 'none') shoveMe(9, p.x, p.z, 4);
        foesIn(p.x, p.z, tw.r ?? 2.1, (f) => hurtFoe(f, tw.foeDmg ?? 80, p.x, p.z, 8));
      }
      p.last = ph;
    });
  },
  snap(){ const S = TW.s; return S.p ? S.p.map(p => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, p.done ? 1 : 0]) : null; },
  sync(tw, w){
    const S = TW.s;
    if (!S.p){ S.at = w.map(r => [r[0], r[1]]); return; }
    S.p.forEach((p, i) => { p.done = !!(w[i] && w[i][2]); });
  },
};
