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
// …and the signature twists, one file each in game/twists/ (each file's header says what it does and what it takes):
//   barrage (sabotage) · gap, stragglers, list, standard, pulse, vael, decompress, signal (hold) · stalker, cage,
//   gunship (duel) · minefield, marked (escort) · searchlight, tide, stamp (sabotage) · rockslide, guns (capture)
// A twist is mostly the weather an objective is won in, but a few lean on it: one can hold up its progress for a
// while (twistGate: a ramp under rubble, a console under the sea, a searchlight's beam) or point the HUD's arrow
// somewhere else (twistTarget: a child frozen off the path). The kit they're built from (props, telegraphs, events a
// co-op guest is sent) is game/twists/kit.js.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, enemies, shared, isGunner } from '../state.js';
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

import { TW, smooth, line, updateEvents, clearEvents, eventsSnap, eventsSync, dispose } from './twists/kit.js';
import { MORE } from './twists/index.js';

/* ---------- the twists ---------- */
const KINDS = {
  blackout: {
    mood: { fill: 0.15, sun: 0.04, rim: 0.6, sky: 0.2, near: 0.45, far: 0.6, blade: 1.8, fog: 0x080506 },
    begin(){ TW.lit = -1; },
    update(tw, dt, ctx){
      const foe = ctx.foe && ctx.foe();
      if (!foe){ TW.k = 0; return; }
      if (TW.lit < 0){ TW.lit = TW.t; }
      const s = TW.t - TW.lit;
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
      const lit = !player.unlit && (!isGunner() ? !player.holstered : player.weapon === 'darksaber');
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
    fadeOwn: true,   // (it drains away on its own as the objective ends: update keeps running)
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

Object.assign(KINDS, MORE);   // the rest, one file each (game/twists/)

/* ---------- the life of one ---------- */
// an objective with a twist begins (host and guest alike). ctx: what it can see of the mission (see updateTwist)
export function beginTwist(o, guest = false, ctx = {}){
  endTwist(true);
  const tw = o && o.twist, K = tw && KINDS[tw.kind];
  if (!K) return;
  Object.assign(TW, { tw, o, t: 0, k: 0, fade: false, guest, lights: [], props: [], said: false, spot: 0, lit: -1, flickT: 0, tinted: false, s: {} });
  clearEvents();
  setMood(typeof K.mood === 'function' ? K.mood(tw) : K.mood || null);
  K.begin(tw, ctx);
}
// every frame of the mission. ctx: { guest, frac: the objective's progress 0..1, foe: () => the duel's foe (or null),
// o: the objective as this run plays it, s: its state (host), vip: the escort, mark(m) / unmark(m): put a marker of the
// twist's on the mission's list (the HUD arrow points at it, and a co-op guest is sent it) }
export function updateTwist(dt, ctx = {}){
  const tw = TW.tw;
  if (!tw) return;
  TW.t += dt;
  const K = KINDS[tw.kind];
  if (TW.fade && !K.fadeOwn) TW.k = Math.max(0, TW.k - dt * 0.6);
  else K.update(tw, dt, ctx);
  updateEvents(dt);
  MOOD.k = TW.k;
  for (const L of TW.lights) if (L && TW.fade) L.intensity *= Math.max(0, 1 - dt * 3);
  if (TW.fade && TW.k <= 0 && !TW.ev.length) endTwist(true);
}
// the objective is done: the twist eases off (hard: gone at once, when the mission ends or starts over)
export function endTwist(hard = false){
  if (!TW.tw) return;
  const K = KINDS[TW.tw.kind];
  if (!hard){ TW.fade = true; if (K.done) K.done(TW.tw); return; }
  if (K.end) K.end(TW.tw);
  clearEvents();
  for (const L of TW.lights) releasePoolLight(L);
  for (const m of TW.props){ scene.remove(m); dispose(m); }
  Object.assign(TW, { tw: null, o: null, lights: [], props: [], k: 0, fade: false, s: {} });
  setMood(null);
}
// does the twist hold up the objective at (x, z) right now (a ramp under rubble, a console shorted by the sea)?
// { rate: × its progress, status: the HUD's line instead, warn } or null. The objective kinds ask it (game/mission.js)
export function twistGate(x, z, ctx){
  const K = TW.tw && !TW.fade && KINDS[TW.tw.kind];
  return K && K.gate ? K.gate(TW.tw, x, z, ctx) : null;
}
// somewhere the twist needs you more than the objective's own marker (a child frozen off the path): the HUD arrow's
export function twistTarget(){
  const K = TW.tw && !TW.fade && KINDS[TW.tw.kind];
  return K && K.target ? K.target(TW.tw) : null;
}
// co-op: what a guest needs of it (the host's clock, the kind's own state, the live events), and the guest taking it
export function twistSnap(){
  if (!TW.tw) return null;
  const K = KINDS[TW.tw.kind];
  return { t: Math.round(TW.t * 100) / 100, f: TW.fade ? 1 : 0, s: K.snap ? K.snap(TW.tw) : null, e: eventsSnap() };
}
export function twistSync(w){
  if (!TW.tw || !TW.guest || !w) return;
  if (Math.abs(TW.t - w.t) > 0.4) TW.t = w.t;
  const K = KINDS[TW.tw.kind];
  if (K.sync && w.s != null) K.sync(TW.tw, w.s);
  eventsSync(w.e);
}
// dev console / tests: what's running
export const twistState = () => ({ kind: TW.tw ? TW.tw.kind : null, k: TW.k, t: TW.t, front: TW.front ?? null, fade: TW.fade, events: TW.evId, props: TW.props.length, s: TW.s });
