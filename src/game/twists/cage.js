// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CAGE (the Pens on Tessaril, the Warden's duel): the Warden brings up the pens' containment field round the two
// of you, and it closes. A wall of red light, wide at first, tightening over the fight until there's nowhere left to back
// off to. Touch it and it burns and throws you back in. Foes it catches are thrown in too, and the ones that aren't the
// Warden are burned. It goes up a moment after the Warden is in, at a wide reach, and closes slowly.
//   at: [x, z] its middle · r0, r1: its reach when it goes up, and once it has closed · over: seconds it takes to close
//   dmg: what a touch costs a hero · line: { jedi, mando }
import * as THREE from 'three';
import { TW, prop, line, ringMesh, hurtMe, foesIn, hurtFoe } from './kit.js';
import { G, player } from '../../state.js';
import { V3, clamp } from '../../utils.js';
import { playerPos } from '../../player/helpers.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx } from '../../audio/sfx.js';

const RED = 0xff2a3a;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export default {
  mood: { fill: 0.88, rim: 1.2, fog: 0x3a0a14 },
  begin(){ TW.s = { seen: -1, r: 0, said: false, hurtT: 0 }; },
  update(tw, dt, ctx){
    const S = TW.s, [cx, cz] = tw.at, r0 = tw.r0 ?? 18, r1 = tw.r1 ?? 9;
    const foe = ctx.foe && ctx.foe();
    if (foe && S.seen < 0) S.seen = TW.t;
    if (!S.wall){
      S.wall = prop(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.6, 72, 1, true), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })));
      S.wall.userData.noBake = true; S.wall.frustumCulled = false; S.wall.position.set(cx, 1.8, cz); S.wall.visible = false;
      S.foot = prop(ringMesh(RED, 0.03, 0.9)); S.foot.position.set(cx, 0.1, cz); S.foot.visible = false;
    }
    if (!ctx.guest){
      // it goes up a moment after the Warden is in, then closes
      if (S.seen < 0) return;
      const u = TW.t - S.seen - 1.5;
      S.r = u < 0 ? 0 : r0 + (r1 - r0) * smooth(u / (tw.over ?? 55));
      if (u >= 0 && !S.said){ S.said = true; showBanner('THE FIELD GOES UP', line(tw), 3.6, { kicker: 'THE PENS' }); sfx(110, 1.2, 'sawtooth', 0.04, 220); }
    }
    const r = S.r, up = r > 0;
    TW.k = up ? Math.min(1, TW.k + dt) : 0;
    S.wall.visible = S.foot.visible = up;
    if (!up) return;
    // rising into place, then humming
    S.wall.scale.set(r, Math.min(1, (S.rise = (S.rise || 0) + dt * 1.5)), r);
    S.wall.material.opacity = 0.22 + 0.1 * Math.sin(G.gt * 7) + (S.flash = Math.max(0, (S.flash || 0) - dt * 2)) * 0.4;
    S.foot.scale.setScalar(r);
    if (Math.random() < dt * 18){ const a = Math.random() * Math.PI * 2; burst(V3(cx + Math.cos(a) * r, Math.random() * 3, cz + Math.sin(a) * r), RED, 1, 2, 2, 0.5); }
    // touching it: burned and thrown back in (this screen's hero; foes on the host)
    const pp = playerPos(), dx = pp.x - cx, dz = pp.z - cz, d = Math.hypot(dx, dz) || 1;
    S.hurtT -= dt;
    if (d > r - 0.5 && player.hp > 0){
      pp.x = cx + dx / d * (r - 0.6); pp.z = cz + dz / d * (r - 0.6);
      if (S.hurtT <= 0){
        S.hurtT = 0.7; S.flash = 1;
        if (hurtMe(tw.dmg ?? 10, cx + dx / d * (r + 1), cz + dz / d * (r + 1)) !== 'none') floater(V3(pp.x, 2, pp.z), 'THE FIELD BURNS', '#ff6a7a');
        player.vel.x -= dx / d * 9; player.vel.z -= dz / d * 9; player.vel.y = Math.max(player.vel.y, 3);
        burst(V3(pp.x, 1.2, pp.z), RED, 10, 6, 3, 0.7); sfx(320, 0.15, 'sawtooth', 0.04, 120);
      }
    }
    foesIn(cx, cz, 999, (e, p) => {
      const ex = p.x - cx, ez = p.z - cz, ed = Math.hypot(ex, ez) || 1;
      if (ed <= r - 0.5) return;
      p.x = cx + ex / ed * (r - 0.7); p.z = cz + ez / ed * (r - 0.7);
      if (!e.champion && !(e.cageT > G.gt)){ e.cageT = G.gt + 0.8; hurtFoe(e, 12, cx + ex / ed * (r + 1), cz + ez / ed * (r + 1), 6); }
    });
  },
  snap(){ return Math.round(TW.s.r * 10) / 10; },
  sync(tw, w){ TW.s.r = w; },
};
