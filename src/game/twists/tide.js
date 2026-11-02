// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TIDE (the Drowned City's archive): the sea is in the lower levels, and it comes in surges. A rumble and a call,
// then the water floods across the floor: everyone wades (you, and the purge troopers), and an archive stack under water
// is shorted out (no slicing until the water goes back down). Then it drains, and you have till the next surge. Slice in
// the dry spells; fight in the wet ones. The first surge comes in low.
//   first: seconds before the first surge · every: seconds from one surge to the next · level: how deep it gets (m) ·
//   slow: × speed while wading · line: { … }
import * as THREE from 'three';
import { TW, prop, line } from './kit.js';
import { player, enemies, shared } from '../../state.js';
import { V3, rand } from '../../utils.js';
import { playerPos } from '../../player/helpers.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx } from '../../audio/sfx.js';
import { gust } from '../../audio/director.js';

const RISE = 2, HIGH = 4.5, FALL = 2.5;   // seconds of each part of a surge
// how high the water stands now, 0 … 1 of its full level, and the seconds to the next surge's start
function tide(tw, t){
  const u = t - (tw.first ?? 8), P = tw.every ?? 16;
  if (u < 0) return [0, -u, 0];
  const n = Math.floor(u / P), v = u - n * P;
  const k = v < RISE ? v / RISE : v < RISE + HIGH ? 1 : v < RISE + HIGH + FALL ? 1 - (v - RISE - HIGH) / FALL : 0;
  return [k * k * (3 - 2 * k) * (n === 0 ? 0.65 : 1), P - v, n];
}
export default {
  mood: { fill: 0.9, sky: 0.85, fog: 0x2a4048 },
  begin(){ TW.s = { said: false, warned: -1, wet: false }; },
  update(tw, dt, ctx){
    const S = TW.s, [k, toNext, n] = tide(tw, TW.t), lvl = k * (tw.level ?? 0.6);
    if (!S.water){
      const half = (shared.arenaHalf || 30) + 6;
      S.water = prop(new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3a7a8a, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.6, depthWrite: false })));
      S.water.rotation.x = -Math.PI / 2; S.water.userData.noBake = true; S.water.renderOrder = 2;
    }
    S.water.visible = lvl > 0.02; S.water.position.y = lvl - 0.02;
    S.water.material.opacity = 0.45 + 0.15 * k;
    TW.k = Math.min(1, TW.k + dt * 0.3);
    // the warning: a rumble and a call, a couple of seconds before it comes in
    if (toNext < 2.2 && S.warned !== n + (k > 0 ? 1 : 0) && !ctx.guest){
      S.warned = n + (k > 0 ? 1 : 0);
      gust('wind'); sfx(55, 2.2, 'sawtooth', 0.05, 40);
      if (!S.said){ S.said = true; showBanner('THE SEA IS COMING IN', line(tw), 4, { kicker: 'SURGE' }); }
      else { const p = playerPos(); floater(V3(p.x, 2.4, p.z), 'SURGE COMING', '#8ad8e8'); }
    }
    const wet = lvl > 0.22;
    // wading: slower on your feet; spray where you move
    player.twistMove = wet ? (tw.slow ?? 0.6) : 1;
    if (wet && Math.random() < dt * 10){ const p = playerPos(); burst(V3(p.x + rand(-0.4, 0.4), lvl, p.z + rand(-0.4, 0.4)), 0xd8f0f8, 2, 3, 3, 0.6); }
    if (k > 0 && Math.random() < dt * 30){ const p = playerPos(); burst(V3(p.x + rand(-20, 20), lvl + 0.05, p.z + rand(-20, 20)), 0xe0f4fa, 2, 2, 2, 0.8); }
    if (ctx.guest) return;
    // the foes wade too (each keeps its own pace to come back to)
    for (const e of enemies){
      if (e.dead || e.t.fly) continue;
      if (e._spd0 == null) e._spd0 = e.spd;
      e.spd = e._spd0 * (wet ? (tw.slow ?? 0.6) : 1);
    }
    if (wet !== S.wet){ S.wet = wet; if (!wet){ const p = playerPos(); floater(V3(p.x, 2.4, p.z), 'THE WATER\'S DOWN · SLICE', '#7bffae'); } }
  },
  // an archive stack under water is shorted out
  gate(tw){ const [k] = tide(tw, TW.t); return k * (tw.level ?? 0.6) > 0.22 ? { rate: 0, status: 'SHORTED OUT · WAIT FOR THE WATER TO DRAIN', warn: true } : null; },
  done(){ player.twistMove = 1; for (const e of enemies) if (e._spd0 != null){ e.spd = e._spd0; e._spd0 = null; } },
  end(){ player.twistMove = 1; for (const e of enemies) if (e._spd0 != null){ e.spd = e._spd0; e._spd0 = null; } },
};
