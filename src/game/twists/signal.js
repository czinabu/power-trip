// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SIGNAL (the Broadcast, holding the spire): the Order isn't just counting down on the spire, it's going out. Every
// so often the spire hums, its crown lights violet, and a pulse goes out across the ground: a squadmate it passes
// stops where they stand, swaying, out of the fight and off the door, till it wears off or you get to them and shake
// them out of it. It doesn't touch you. It comes more often the nearer the count gets.
//   first: seconds before the first pulse · every: [at the start, near the end] seconds between · spd: m/s it goes out ·
//   len: how far · daze: seconds it holds a squadmate · reach: metres to get to one to shake them out · line: { … }
import { TW, ev, prop, line, ringMesh } from './kit.js';
import { G } from '../../state.js';
import { V3 } from '../../utils.js';
import { playerPos } from '../../player/helpers.js';
import { allies } from '../../allies/squad.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx } from '../../audio/sfx.js';

const VIOLET = 0xb06aff, BUILD = 2.2;
export default {
  mood: { fill: 0.88, rim: 1.15, fog: 0x3a2a4a },
  begin(tw){ TW.s = { next: tw.first ?? 6, n: 0, build: 0, pulses: [], dz: [], rings: [] }; },
  update(tw, dt, ctx){
    const S = TW.s, at = ctx.o ? ctx.o.at : [0, 0];
    TW.k = Math.min(1, TW.k + dt * 0.25);
    // the crown: a violet ring over the spire, bright while it builds
    if (!S.crown){ S.crown = prop(ringMesh(VIOLET, 0.2, 0.6)); S.crown.position.set(at[0], 0.15, at[1]); S.crown.scale.setScalar(2.6); }
    S.crown.material.opacity = 0.2 + 0.7 * S.build * (0.6 + 0.4 * Math.sin(G.gt * 30));
    // who's dazed: a violet halo over each (the host's own, sent to a guest)
    const dz = ctx.guest ? S.dz : allies.filter(a => a.dazeT > G.gt).map(a => [a.group.position.x, a.group.position.z]);
    while (S.rings.length < dz.length){ const m = prop(ringMesh(VIOLET, 0.25, 0.85)); S.rings.push(m); }
    S.rings.forEach((m, i) => {
      m.visible = i < dz.length;
      if (m.visible){ m.position.set(dz[i][0], 2.6, dz[i][1]); m.rotation.set(-Math.PI / 2, 0, G.gt * 3); m.scale.setScalar(0.55 + 0.08 * Math.sin(G.gt * 6)); }
    });
    if (ctx.guest) return;
    // shake one out of it: get to them
    const pp = playerPos();
    for (const a of allies){
      if (!(a.dazeT > G.gt) || a.net) continue;
      const p = a.group.position;
      if (Math.hypot(p.x - pp.x, p.z - pp.z) < (tw.reach ?? 2.6)){ a.dazeT = 0; floater(V3(p.x, 2.4, p.z), 'SNAPPED OUT', '#7bffae'); sfx(880, 0.12, 'triangle', 0.04, 1200); }
    }
    // the pulses going out: a squadmate it passes is caught
    for (const P of S.pulses){
      const r = (TW.t - P.t0) * (tw.spd ?? 11);
      for (const a of allies){
        if (a.net || a.state === 'down' || P.got.has(a)) continue;
        const p = a.group.position, d = Math.hypot(p.x - at[0], p.z - at[1]);
        if (Math.abs(d - r) < 1.3){ P.got.add(a); a.dazeT = G.gt + (tw.daze ?? 6); burst(V3(p.x, 1.6, p.z), VIOLET, 8, 3, 2, 0.6); floater(V3(p.x, 2.6, p.z), 'DAZED · GET TO THEM', '#d0a0ff'); }
      }
    }
    S.pulses = S.pulses.filter(P => (TW.t - P.t0) * (tw.spd ?? 11) < (tw.len ?? 34));
    // the next: it builds, then goes
    S.next -= dt;
    S.build = Math.max(0, Math.min(1, 1 - S.next / BUILD));
    if (S.next > 0){ if (S.build > 0 && (S.hum = (S.hum || 0) - dt) <= 0){ S.hum = 0.3; sfx(120 + 200 * S.build, 0.25, 'sine', 0.03, 140 + 200 * S.build); } return; }
    const e = tw.every || [16, 9], f = Math.min(1, ctx.frac || 0);
    S.next = e[0] + (e[1] - e[0]) * f;
    S.build = 0;
    S.pulses.push({ t0: TW.t, got: new Set() });
    ev('ring', { x: at[0], z: at[1], r0: 2.4, spd: tw.spd ?? 11, len: tw.len ?? 34, w: 1.1, dmg: 0, foe: 0, col: VIOLET });
    sfx(90, 0.9, 'sawtooth', 0.05, 60);
    if (!S.n++) showBanner('THE SIGNAL', line(tw), 4, { kicker: 'IT\'S GETTING INTO THEIR HEADS' });
  },
  snap(){ return allies.filter(a => a.dazeT > G.gt).map(a => [Math.round(a.group.position.x * 10) / 10, Math.round(a.group.position.z * 10) / 10]); },
  sync(tw, w){ TW.s.dz = w || []; },
  end(){ for (const a of allies) a.dazeT = 0; },
  done(){ for (const a of allies) a.dazeT = 0; },
};
