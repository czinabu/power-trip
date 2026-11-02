// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MISSION TWISTS: one signature hook on an objective (data/missions.js, an objective's `twist`), taught safely and then
// tested. game/mission.js begins one with its objective, runs it every frame and lets it go when the objective is done.
// It runs the same on a co-op guest's screen (from what the host sends: the objective, its progress, the markers), and
// it goes wherever the objective goes: the Missions page, a campaign chapter, an arcade contract dealt from it.
//
//   blackout   the lights die once the duel's foe is in (a beat in full light first, a flicker, then dark): the fight is
//              lit by the blades. The foe's blade throws its own light; a hero with no blade gets a helmet lamp.
//              line: { jedi, mando } the banner's line as it goes dark
//   sandstorm  a storm rolls in over the hold: the view closes in to a few metres and foes come out of it close.
//              at: seconds into the hold it arrives (the first push comes in clear air) · ramp: seconds to full ·
//              near, far: the fog's distances at its height (m) · line: { jedi, mando }
//   heat       the floor floods with heat from one side as the hold's clock runs: it burns anything behind its front,
//              and the hold's zone falls back ahead of it in steps.
//              zones: [[x, z]…] the hold's zone, stage by stage · steps: [frac…] the hold's progress each stage ends at ·
//              fronts: [z…] where the front stands at the start, at each step and at the end (it moves along z; from
//              the lower end) · dps: hp a second it takes off a hero · foeDps: off a foe · line: { jedi, mando }
// Nothing here changes how an objective is won: a twist is the weather it's won in.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, enemies, shared, isGunner, heroKey } from '../state.js';
import { V3, rand, clamp } from '../utils.js';
import { playerPos } from '../player/helpers.js';
import { hurtPlayer } from '../player/damage.js';
import { damageEnemy } from '../enemies/damage.js';
import { showBanner } from '../ui/banners.js';
import { burst } from '../fx/particles.js';
import { sparks } from '../fx/ink.js';
import { floater } from '../fx/floaters.js';
import { holdPoolLight, releasePoolLight } from '../fx/lights.js';
import { MOOD, setMood } from '../world/atmosphere.js';
import { gust } from '../audio/director.js';
import { sfx } from '../audio/sfx.js';

const TW = { tw: null, o: null, t: 0, k: 0, fade: false, guest: false, lights: [], props: [], said: false, spot: 0 };
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const line = (tw) => tw.line ? heroKey(tw.line) : '';

/* ---------- the twists ---------- */
const KINDS = {
  blackout: {
    mood: { fill: 0.15, sun: 0.04, rim: 0.6, sky: 0.2, near: 0.45, far: 0.6, blade: 1.8, fog: 0x080506 },
    begin(){ TW.seen = -1; },
    update(tw, dt, ctx){
      const foe = ctx.foe && ctx.foe();
      if (!foe){ TW.k = 0; return; }
      if (TW.seen < 0){ TW.seen = TW.t; }
      const s = TW.t - TW.seen;
      // a beat in full light to see what it is, a flicker as the power fails, then dark for the rest of the fight
      if (s < 1.6) TW.k = 0;
      else if (s < 4.2){
        if ((TW.flickT = (TW.flickT || 0) - dt) <= 0){
          TW.flickT = rand(0.06, 0.22); TW.k = Math.random() < 0.5 ? rand(0.15, 0.4) : rand(0.7, 0.95);
          sfx(rand(90, 140), 0.06, 'sawtooth', 0.025, 50);
        }
        if (!TW.said && !ctx.guest){ TW.said = true; showBanner('THE LIGHTS GO OUT', line(tw), 3.4, { kicker: 'BLACKOUT' }); }
      } else TW.k = Math.min(1, TW.k + dt * 0.8);
      // the foe's blade lights the floor round it
      const L = TW.lights[0] || (TW.lights[0] = holdPoolLight(0xff2a2a, 0, 11));
      if (L){
        const g = foe.group && foe.group.userData.bladeGlow;
        if (g){ g.getWorldPosition(L.position); if (!TW.tinted){ TW.tinted = true; L.color.copy(g.material.color); } }   // (its own blade's colour)
        else L.position.set(foe.group.position.x, 1.3, foe.group.position.z);
        L.intensity = 7 * TW.k;
      }
      // a hero with no blade lit wears a lamp (the Mandalorian's helmet, the trooper's)
      const lit = !isGunner() ? !player.holstered : player.weapon === 'darksaber';
      const H = TW.lights[1] || (TW.lights[1] = holdPoolLight(0xd6e4ff, 0, 10));
      if (H){
        const p = playerPos();
        H.position.set(p.x - Math.sin(G.yaw) * 1.2, p.y + 2.4, p.z - Math.cos(G.yaw) * 1.2);
        H.intensity = (lit ? 1.2 : 4) * TW.k;
      }
    },
  },

  sandstorm: {
    mood(tw){ return { fill: 1.25, sun: 0.3, rim: 0.5, sky: 0.7, nearTo: tw.near ?? 3, farTo: tw.far ?? 26, fog: 0xb48a58 }; },
    begin(){ TW.gustT = 0; },
    update(tw, dt, ctx){
      const at = tw.at ?? 8, ramp = tw.ramp ?? 10;
      if (!TW.said && TW.t > at - 2.5 && !ctx.guest){ TW.said = true; showBanner('SANDSTORM', line(tw), 3.6, { kicker: 'WARNING' }); }
      TW.k = smooth((TW.t - at) / ramp);
      if (TW.k <= 0.02 || G.cutscene) return;
      // sand streaming across the view, thick as the storm is, with the wind rising and falling
      const pp = playerPos(), fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw), side = shared.windSide ?? (shared.windSide = 1);
      const dir = V3(-fz * side, rand(-0.03, 0.03), fx * side);
      TW.spot += dt * 70 * TW.k;
      while (TW.spot >= 1){
        TW.spot--;
        const ahead = rand(2, 16), off = rand(-9, 9);
        const p = V3(pp.x + fx * ahead - dir.x * 10 + fz * off * 0.2, rand(0.2, 4), pp.z + fz * ahead - dir.z * 10 - fx * off * 0.2);
        sparks(p, Math.random() < 0.5 ? 0xd9b47c : 0xc49a62, 3, rand(18, 30), { dir, cone: 0.08, life: 0.9, grav: 0, stretch: 10, size: 0.32 });
      }
      if ((TW.gustT -= dt) <= 0){ TW.gustT = rand(0.9, 1.8) / Math.max(0.4, TW.k); gust('dust'); }
    },
  },

  heat: {
    mood: { fill: 1.12, sun: 0.85, sky: 1.15, fog: 0x6a2a12 },
    begin(tw){
      // the flood: a glowing sheet over the floor up to the front, a bright lip at it and a warning band before it
      const half = (shared.arenaHalf || 34) + 4, w = half * 2;
      const mk = (color, op) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2; m.scale.x = w; m.renderOrder = 2; m.userData.noBake = true; m.frustumCulled = false;
        scene.add(m); TW.props.push(m);
        return m;
      };
      TW.sheet = mk(0xff5a14, 0.5); TW.lip = mk(0xffb050, 1); TW.band = mk(0xff6a20, 0.15);
      TW.back = (tw.fronts && tw.fronts[0]) ?? -half; TW.front = TW.back; TW.burnT = 0; TW.toldT = -9;
    },
    // where the front stands at this much of the hold (it eases from step to step)
    frontAt(tw, f){
      const st = [0, ...(tw.steps || []), 1], fr = tw.fronts;
      for (let i = 0; i < st.length - 1; i++) if (f <= st[i + 1] || i === st.length - 2){
        const u = clamp((f - st[i]) / Math.max(1e-3, st[i + 1] - st[i]), 0, 1);
        return fr[i] + (fr[i + 1] - fr[i]) * smooth(u);
      }
      return fr[fr.length - 1];
    },
    update(tw, dt, ctx){
      if (!TW.said && !ctx.guest){ TW.said = true; showBanner('THE FLOOR IS FLOODING', line(tw), 4, { kicker: 'HEAT' }); }
      const f = TW.fade ? 0 : clamp(ctx.frac || 0, 0, 1);
      const want = TW.fade ? TW.back - 4 : KINDS.heat.frontAt(tw, f);
      TW.front += (want - TW.front) * Math.min(1, dt * (TW.fade ? 1.2 : 3));   // (a guest's progress arrives in steps: ease it)
      TW.k = TW.fade ? Math.max(0, TW.k - dt * 0.5) : Math.min(0.85, 0.25 + f * 0.6);
      const z0 = TW.back - 6, z1 = TW.front, len = Math.max(0.01, z1 - z0), pulse = 0.5 + 0.5 * Math.sin(G.gt * 5);
      TW.sheet.scale.y = len; TW.sheet.position.set(0, 0.09, (z0 + z1) / 2);
      TW.sheet.material.opacity = 0.42 + 0.12 * pulse;
      TW.lip.scale.y = 2; TW.lip.position.set(0, 0.11, z1 - 1);
      TW.band.scale.y = 4; TW.band.position.set(0, 0.1, z1 + 2);
      TW.band.material.opacity = 0.06 + 0.14 * pulse;   // the warning: it creeps here next
      const vis = len > 0.5; TW.sheet.visible = TW.lip.visible = TW.band.visible = vis;
      if (!vis || G.cutscene) return;
      // embers and spits of flame off the flooded floor
      const half = shared.arenaHalf || 34;
      if (Math.random() < dt * 24) burst(V3(rand(-half, half), 0.2, z1 - rand(0, 1.5)), 0xffc060, 2, 2.5, 7, 0.55);   // it boils at the front
      if (Math.random() < dt * 14) burst(V3(rand(-half, half), 0.2, rand(Math.max(z0, z1 - 18), z1)), Math.random() < 0.5 ? 0xff7a1e : 0xffb040, 2, 3, 6, 0.6);
      if (TW.fade) return;
      // it burns: the hero behind the front (off the floor, on a jet or a jump, it can't reach) and, on the host, foes
      const p = playerPos();
      if (p.z < z1 && p.y < 1.2 && player.hp > 0){
        hurtPlayer((tw.dps ?? 14) * dt + 0.001, V3(p.x, 0, z1 - 4), true);
        if (Math.random() < dt * 10) burst(V3(p.x, 0.3, p.z), 0xff7a1e, 2, 2, 5, 0.5);
        if (G.gt - TW.toldT > 2.5){ TW.toldT = G.gt; floater(V3(p.x, 1.9, p.z), 'TOO HOT · FALL BACK', '#ff9a5a'); }
      }
      if (ctx.guest) return;
      for (const e of enemies){
        if (e.dead || e.champion || e.group.position.z >= z1 || e.hitCd > 0) continue;
        e.hitCd = 0.5;
        damageEnemy(e, (tw.foeDps ?? 8) * 0.5, V3(0, 0, 1), 3, false, true);
      }
    },
  },
};

/* ---------- the life of one ---------- */
// an objective with a twist begins (host and guest alike)
export function beginTwist(o, guest = false){
  endTwist(true);
  const tw = o && o.twist, K = tw && KINDS[tw.kind];
  if (!K) return;
  Object.assign(TW, { tw, o, t: 0, k: 0, fade: false, guest, lights: [], props: [], said: false, spot: 0, seen: -1, flickT: 0, tinted: false });
  setMood(typeof K.mood === 'function' ? K.mood(tw) : K.mood);
  K.begin(tw);
}
// every frame of the mission. ctx: { guest, frac: the objective's progress 0..1, foe: () => the duel's foe (or null) }
export function updateTwist(dt, ctx = {}){
  const tw = TW.tw;
  if (!tw) return;
  TW.t += dt;
  const K = KINDS[tw.kind];
  if (TW.fade && tw.kind !== 'heat') TW.k = Math.max(0, TW.k - dt * 0.6);
  else K.update(tw, dt, ctx);
  MOOD.k = TW.k;
  for (const L of TW.lights) if (L && TW.fade) L.intensity *= Math.max(0, 1 - dt * 3);
  if (TW.fade && TW.k <= 0) endTwist(true);
}
// the objective is done: the twist eases off (hard: gone at once, when the mission ends or starts over)
export function endTwist(hard = false){
  if (!TW.tw) return;
  if (!hard){ TW.fade = true; return; }
  for (const L of TW.lights) releasePoolLight(L);
  for (const m of TW.props){ scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  Object.assign(TW, { tw: null, o: null, lights: [], props: [], k: 0, fade: false });
  setMood(null);
}
// dev console / tests: what's running
export const twistState = () => ({ kind: TW.tw ? TW.tw.kind : null, k: TW.k, t: TW.t, front: TW.front ?? null, fade: TW.fade });
