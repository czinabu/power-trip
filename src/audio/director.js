// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AUDIO DIRECTOR: everything that sounds continuously, steered once a frame from the main loop.
//   - the lightsaber hum (pitch by form; bends up, swells and brightens with the blade's real tip speed; an electric
//     sizzle that rises with motion; the saber staff's second blade; follows a thrown saber with a spinning wobble)
//   - the Darksaber's darker, grittier hum, moved the same way
//   - the hum of every other lit blade nearby (a foe's, the boss's, a co-op partner's), placed in the world
//   - the jetpack roar and the flamethrower, by how hard they're running
//   - each world's ambience bed plus its occasional distant events (Jedha bells, Mustafar lava, Exegol thunder)
//   - the mix state: muffled under the pause menu, on death, for a beat after a hit and when badly hurt
//   - which reverb room and which music palette the current arena uses

import { AE, loop, play, place, setRoom, setMuffle } from './engine.js';
import { MUSIC } from './music.js';
import { S } from './sfx.js';
import { updateFoley } from './foley.js';
import { shared, G, player, isGunner } from '../state.js';
import { maxHp } from '../player/helpers.js';
import { clamp, rand } from '../utils.js';
import { HUM_PITCH, BLADE_AUDIO } from './saber.js';

const L = { hum: null, hum2: null, hiss: null, dark: null, near: [], grind: null, grindLow: null, jet: null, flame: null, amb: [], ambKey: '' };
let nextEvt = 0, heartT = 0, lastMuffle = 0, prevMode = 'menu';

/* how much a blade is moving, 0..1, from its tip speed against its owner (m/s): a held guard barely stirs it, a full
   cut pins it. Eased in so small sways stay a gentle waver and a real cut takes the hum all the way. */
const motionOf = sp => { const m = clamp((sp - 2) / 16, 0, 1); return m * (2 - m); };
// smoothed motion per hum (attack fast, release a little slower, so a cut's tail rings out instead of snapping off)
const MV = { hero: 0, hero2: 0, dark: 0 };
const ease = (k, target, dt) => { const r = target > MV[k] ? 28 : 9; MV[k] += (target - MV[k]) * Math.min(1, dt * r); return MV[k]; };

// the hum: two slightly detuned saws an octave under a sine, a soft sub growl under them, through a lowpass that
// opens as the blade moves (the loop recipe is shared by the hero's blade, the staff's far end, and nearby blades)
const HUM = () => ({ base: 90, layers: [{ f: 90 }, { f: 90.7, det: 6, g: 0.8 }, { type: 'sine', f: 180, g: 0.6 }, { type: 'square', f: 45, g: 0.12 }],
                     filt: { f: 420, q: 1.2 }, lfo: { r: 3.7, d: 40 }, verb: 0.08 });
function ensureLoops(){
  if (L.hum) return;
  L.hum = loop(HUM());
  L.hum2 = loop(Object.assign(HUM(), { lfo: { r: 4.3, d: 50 } }));   // the saber staff's far blade, a hair sharp of the near one
  // the blade's electric sizzle: a narrow band of noise, flickering, that only really comes up as the blade moves
  L.hiss = loop({ base: 1, layers: [{ noise: 'white' }], filt: { type: 'bandpass', f: 2600, q: 1.6 }, lfo: { r: 13, d: 700 }, verb: 0.05 });
  L.dark = loop({ base: 62, layers: [{ type: 'square', f: 62, g: 0.6 }, { f: 62.6, g: 0.8 }, { type: 'sine', f: 124, g: 0.5 }],
                  filt: { f: 380, q: 2 }, lfo: { r: 5.3, d: 60 }, drive: 0.35, verb: 0.08 });
  // two placed hums for the nearest other lit blades (foes, the boss, a co-op partner, an ally)
  for (let i = 0; i < 2; i++) L.near.push({ h: loop({ base: 90, layers: [{ f: 90 }, { f: 90.8, det: 5, g: 0.7 }, { type: 'sine', f: 180, g: 0.5 }], filt: { f: 500, q: 1 }, lfo: { r: 3.3 + i, d: 40 } }), wob: rand(0, 6) });
  // LOCK_GRIND — "KRRRZZZZ...": two blades held against each other. A harsh, vibrating tear of driven white noise (its band
  // shaken fast, so it spits rather than hisses) over a heavy, gritty low hum; one-shot arcs and pops are thrown over it
  // from enemies/duel.js. Silent until a bind; how hard it grinds follows the struggle (BLADE_AUDIO.lock).
  L.grind = loop({ base: 1, layers: [{ noise: 'white' }, { noise: 'pink', g: 0.7 }], filt: { type: 'bandpass', f: 2200, q: 0.9 }, lfo: { r: 23, d: 1500 }, drive: 0.7, verb: 0.1 });
  L.grindLow = loop({ base: 58, layers: [{ f: 58 }, { f: 87.5, g: 0.8 }, { type: 'square', f: 29, g: 0.4 }], filt: { f: 650, q: 1.6 }, lfo: { r: 13, d: 260 }, drive: 0.6, verb: 0.08 });
  L.jet = loop({ base: 50, layers: [{ noise: 'brown', g: 1.6 }, { noise: 'pink', g: 0.5 }, { f: 50, g: 0.12 }],
                 filt: { f: 500, q: 0.6 }, lfo: { r: 11, d: 90 } });
  L.flame = loop({ base: 60, layers: [{ noise: 'pink', g: 1 }, { noise: 'brown', g: 1.2 }],
                   filt: { type: 'bandpass', f: 650, q: 0.6 }, lfo: { r: 7, d: 160 } });
}

/* ---------- ambience ----------
   One bed per arena layout (the 'worlds' direction names: Jedha / Mustafar / Exegol). Beds are loops on the amb
   bus; `events` are sparse one-shots scattered around the listener. */
const AMB = {
  temple: {   // JEDHA — dry desert wind across the holy city, a temple bell far off
    beds: [{ base: 1, layers: [{ noise: 'pink' }], filt: { type: 'bandpass', f: 520, q: 0.6 }, lfo: { r: 0.07, d: 260 }, lvl: 0.06 },
           { base: 1, layers: [{ noise: 'brown' }], filt: { f: 160 }, lvl: 0.05 }],
    every: [8, 15],
    event(){ const f = rand(180, 240);
      play({ bus: 'amb', type: 'sine', f, fm: { r: 2.76, i: 1.4, i2: 0.02 }, g: 0.022, a: 0.004, d: 3.2, pan: rand(-0.8, 0.8), verb: 0.7 });
      play({ bus: 'amb', type: 'sine', f: f * 2.01, g: 0.01, a: 0.004, d: 2.4, pan: rand(-0.8, 0.8), verb: 0.7 }); },
    tick(){},
  },
  foundry: {  // MUSTAFAR — a lava river's rumble, the hiss of heat, machinery somewhere in the forge
    beds: [{ base: 1, layers: [{ noise: 'brown' }], filt: { f: 150 }, lfo: { r: 0.13, d: 50 }, lvl: 0.16 },
           { base: 1, layers: [{ noise: 'pink' }], filt: { type: 'highpass', f: 3500 }, lfo: { r: 0.2, d: 900 }, lvl: 0.012 }],
    every: [4, 9],
    event(){ play({ bus: 'amb', type: 'sine', f: rand(300, 520), fm: { r: 1.53, i: 3, i2: 0.05 }, g: 0.02, d: 0.9, pan: rand(-0.9, 0.9), verb: 0.6 }); },
    // lava bubbles pop constantly, low and soft
    tick(dt){ if (Math.random() < dt * 2.2){ const f = rand(70, 190);
      play({ bus: 'amb', type: 'sine', f, f2: f * 0.45, g: 0.035, a: 0.01, d: 0.09, pan: rand(-0.9, 0.9), pri: 0 }); } },
  },
  plains: {   // EXEGOL — storm wind over a dead plain, a sub-bass drone underneath, far-off rumbles
    beds: [{ base: 1, layers: [{ noise: 'pink' }], filt: { type: 'bandpass', f: 380, q: 0.8 }, lfo: { r: 0.05, d: 240 }, lvl: 0.085 },
           { base: 41, layers: [{ type: 'sine', f: 41 }, { type: 'sine', f: 61.7, g: 0.5 }], filt: { f: 220 }, lfo: { r: 0.09, d: 40 }, lvl: 0.06 }],
    every: [10, 18],
    event(){ play({ bus: 'amb', src: 'noise', color: 'brown', g: 0.09, a: 0.6, d: 2.6, filt: { type: 'lowpass', f: 240, f2: 90 }, pan: rand(-0.6, 0.6), verb: 0.5 }); },
    tick(){},
  },
  menu: {
    beds: [{ base: 1, layers: [{ noise: 'pink' }], filt: { type: 'bandpass', f: 420, q: 0.7 }, lfo: { r: 0.06, d: 200 }, lvl: 0.03 }],
    every: [999, 999], event(){}, tick(){},
  },
};

/* extra beds by what drifts through the air (the world's ambient kind), on top of the arena's own: a frozen front gets
   a thin whistling wind, dusty ground a faint gritty hiss, falling ash a hollow low breath. Quiet by design. */
const KIND_BEDS = {
  snow: [{ base: 1, layers: [{ noise: 'pink' }], filt: { type: 'bandpass', f: 900, q: 2.2 }, lfo: { r: 0.11, d: 380 }, lvl: 0.035 },
         { base: 1, layers: [{ noise: 'brown' }], filt: { f: 220 }, lfo: { r: 0.08, d: 80 }, lvl: 0.05 }],
  dust: [{ base: 1, layers: [{ noise: 'white' }], filt: { type: 'highpass', f: 4200 }, lfo: { r: 0.15, d: 1200 }, lvl: 0.006 }],
  ash:  [{ base: 1, layers: [{ noise: 'brown' }], filt: { f: 300 }, lfo: { r: 0.07, d: 100 }, lvl: 0.04 }],
  rain: [{ base: 1, layers: [{ noise: 'white' }], filt: { type: 'bandpass', f: 2600, q: 0.5 }, lfo: { r: 0.09, d: 500 }, lvl: 0.03 },   // the hiss of rain on rock
         { base: 1, layers: [{ noise: 'pink' }], filt: { f: 700 }, lvl: 0.035 }],
};
function setAmbience(layout, kind){
  const key = layout + ':' + (kind || '');
  if (key === L.ambKey) return;
  L.ambKey = key;
  for (const b of L.amb) b.h.stop();
  L.amb = [];
  const A = AMB[layout]; if (!A) return;
  for (const spec of A.beds.concat(KIND_BEDS[kind] || [])){ const h = loop(Object.assign({ bus: 'amb' }, spec)); if (h){ h.set(spec.lvl, 0, 0, 1.5); L.amb.push({ h, lvl: spec.lvl }); } }
  nextEvt = rand(A.every[0], A.every[1]) * 0.5;
}

/* thunder from the storm overhead (atmosphere.js fires this with each lightning flash) — the crack arrives first,
   then the rumble rolls in after a delay that depends on how far off the strike was */
export function thunder(){
  if (!AE.ready) return;
  const far = Math.random(), lag = 0.15 + far * 0.9, pan = rand(-0.7, 0.7);
  play({ bus: 'amb', src: 'noise', g: 0.12 * (1 - far * 0.6), d: 0.3, filt: { type: 'highpass', f: 1400 }, drive: 0.6, pan, verb: 0.4 });
  play({ bus: 'amb', src: 'noise', color: 'brown', at: lag, g: 0.3 - far * 0.12, a: 0.05, hold: 0.3, d: 2.6, filt: { type: 'lowpass', f: 600, f2: 70 }, drive: 0.3, pan, verb: 0.6, pri: 2 });
}

/* a gust of wind sweeping through (fx/ambient.js): a soft swell of filtered air that rises and falls over a couple of seconds */
export function gust(kind){
  if (!AE.ready) return;
  const hi = kind === 'snow' ? 1100 : 700, pan = rand(-0.5, 0.5);
  play({ bus: 'amb', src: 'noise', color: 'pink', g: 0.05, a: 0.9, hold: 0.3, d: 1.4, filt: { type: 'bandpass', f: hi * 0.6, f2: hi, q: 0.9 }, pan, verb: 0.3, pri: 0 });
}

/* a blast in the battle beyond the walls (world/warfront.js): a low thud that arrives after the flash, by distance,
   quieter and duller the further off it was */
export function distantBoom(dist){
  if (!AE.ready) return;
  const far = Math.min(1, dist / 600), pan = rand(-0.6, 0.6);
  play({ bus: 'amb', src: 'noise', color: 'brown', at: Math.min(2.5, dist / 343), g: 0.16 * (1 - far * 0.7), a: 0.02, hold: 0.08, d: 1.4,
         filt: { type: 'lowpass', f: 420 - far * 250, f2: 60 }, drive: 0.4, pan, verb: 0.5, pri: 1 });
}

/* ---------- the per-frame update ---------- */
export function updateAudio(dt){
  if (!AE.ready || !shared.AC || shared.AC.state !== 'running') return;
  ensureLoops();
  updateFoley(dt);
  const t = shared.AC.currentTime;
  const playing = G.mode === 'play' && !G.paused && !G.skillSelect;
  const inWorld = G.mode === 'play' || G.mode === 'dead' || G.mode === 'victory';
  const layout = shared.arenaLayout || 'temple';
  if (G.mode !== prevMode){ if (G.mode === 'play') S.uiStart(); prevMode = G.mode; }   // launching a run

  // room, ambience, music palette follow the arena
  setRoom(inWorld ? layout : 'menu');
  setAmbience(inWorld ? layout : 'menu', inWorld ? shared.ambientKind : '');
  MUSIC.setPalette(inWorld ? layout : 'menu');

  // ── saber hums ── each follows its blade's real tip speed (fx/trail.js BLADE_AUDIO): it bends up in pitch, swells,
  // brightens and fizzes through a cut, and settles back to a low idle hum when the blade is held still
  const BA = BLADE_AUDIO;
  const jedi = G.hero === 'jedi' && (!player.holstered || shared.saberProj), darkOn = isGunner() && player.weapon === 'darksaber';
  const swinging = player.atkT > 0 || player.darkT > 0;
  const walk = clamp(Math.hypot(player.moveVel.x, player.moveVel.z) / 12, 0, 1);
  const thrown = jedi && shared.saberProj;
  const staff = jedi && !thrown && G.stance === 'staff';
  const mH = ease('hero', Math.max(motionOf(BA.hero), swinging ? 0.3 : 0), dt), mH2 = ease('hero2', motionOf(BA.hero2), dt);
  const mD = ease('dark', Math.max(motionOf(BA.dark), swinging && darkOn ? 0.3 : 0), dt);
  if (L.hum){
    const p = HUM_PITCH[G.stance] || 1;
    // a thrown blade: loud, open and wobbling as it spins (each turn sweeps the blade toward you and away)
    const spin = thrown ? Math.sin(t * 2 * Math.PI * 6.5) : 0;
    const m = thrown ? 0.7 : mH;
    const lvl = (playing && jedi) ? (thrown ? 0.08 + spin * 0.02 : 0.034 + m * 0.07 + (player.blockHeld ? 0.012 : 0) + walk * 0.008) : 0;
    const hz = thrown ? 1700 + spin * 600 : 420 + m * 2600 + walk * 150;
    const pitch = 90 * p * (1 + m * 0.2 + spin * 0.045);
    L.hum.set(lvl, hz, pitch, m > 0.05 || thrown ? 0.02 : 0.1);
    const P = thrown ? place(shared.saberProj.mesh.position) : null;
    L.hum.pan.pan.setTargetAtTime(P ? P.pan : 0, t, 0.05);
    // the saber staff's far blade: its own hum, a touch quieter and sharper, moving with its own end
    const m2 = Math.max(mH2, mH * 0.6);
    L.hum2.set((playing && staff) ? 0.02 + m2 * 0.045 : 0, 420 + m2 * 2400, 90 * p * 1.013 * (1 + m2 * 0.22), m2 > 0.05 ? 0.02 : 0.1);
  }
  if (L.hiss){
    const m = darkOn ? mD : thrown ? 0.5 : Math.max(mH, mH2 * 0.7);
    const on = playing && (jedi || darkOn);
    L.hiss.set(on ? 0.004 + m * (darkOn ? 0.03 : 0.022) : 0, darkOn ? 1500 + m * 1500 : 2200 + m * 3800, 0, 0.03);
  }
  if (L.dark) L.dark.set((playing && darkOn) ? 0.04 + mD * 0.07 : 0, 380 + mD * 2000, 62 * (1 + mD * 0.16), mD > 0.05 ? 0.02 : 0.12);

  // the saber lock's grind: louder, brighter and rawer in a surge, quivering higher as you're driven back
  if (L.grind){
    const BL = BA.lock, on = playing && BL && G.gt - (BL.at || 0) < 0.3;
    const hard = on ? (BL.surge ? 1 : BL.tell ? 0.75 : 0.55) + Math.abs(BL.bal) * 0.2 : 0;
    const P = on ? place(BL.pos) : null;
    L.grind.set(on ? 0.038 * hard : 0, on ? 1700 + hard * 1600 + Math.sin(t * 7.3) * 300 : 0, 0, on ? 0.03 : 0.06);
    L.grindLow.set(on ? 0.056 * hard : 0, on ? 420 + hard * 500 : 0, 58 * (1 - (on ? BL.bal * 0.08 : 0)) * (1 + Math.sin(t * 17) * 0.02), on ? 0.03 : 0.06);
    if (P){ L.grind.pan.pan.setTargetAtTime(P.pan, t, 0.05); L.grindLow.pan.pan.setTargetAtTime(P.pan, t, 0.05); }
  }

  // other blades: the two nearest lit, unthrown blades within earshot get a placed hum; the rest stay silent
  if (L.near.length){
    const live = (playing || G.cutscene) && G.mode === 'play';
    const cand = [];
    if (live) for (const o of BA.others){
      if (o.thrown) continue;
      const P = place(o.tip);
      if (P && P.d < 16) cand.push({ o, P });
    }
    cand.sort((a, b) => a.P.d - b.P.d);
    for (let i = 0; i < L.near.length; i++){
      const N = L.near[i], c = cand[i];
      if (!N.h) continue;
      if (!c){ N.h.set(0, 0, 0, 0.15); continue; }
      const m = motionOf(c.o.sp), base = c.o.dark ? 62 : 90;
      N.wob += dt;
      const lvl = (0.022 + m * 0.05) * c.P.gain * (1 - clamp((c.P.d - 10) / 6, 0, 1));
      N.h.set(lvl, Math.min(c.P.lp, 480 + m * 2200), base * (1 + m * 0.2 + Math.sin(N.wob * 0.7) * 0.01), 0.03);
      N.h.pan.pan.setTargetAtTime(c.P.pan, t, 0.05);
    }
  }

  // ── jetpack + flamethrower ──
  if (L.jet){
    const k = !playing || !isGunner() ? 0 : player.boosting ? 1.25 : player.jetActive ? 1 : player.hovering ? 0.45 : 0;
    L.jet.set(k * 0.16, 400 + k * 1300, 0, k > 0 ? 0.05 : 0.12);
  }
  if (L.flame){
    const on = playing && isGunner() && !!player.flaming;
    L.flame.set(on ? 0.2 : 0, on ? 900 : 500, 0, on ? 0.04 : 0.1);
  }

  // ── ambience events ──
  const A = AMB[L.ambKey.split(':')[0]];
  if (A && !G.paused){
    A.tick(dt);
    nextEvt -= dt;
    if (nextEvt <= 0){ A.event(); nextEvt = rand(A.every[0], A.every[1]); }
  }

  // ── low-health heartbeat (separate from the Jedi's stamina heartbeat, which is quicker and lighter) ──
  const hpFrac = player.hp / Math.max(1, maxHp());
  if (playing && hpFrac < 0.28 && player.hp > 0){
    heartT -= dt;
    if (heartT <= 0){
      heartT = 0.62 + hpFrac * 1.4;
      play({ type: 'sine', f: 58, f2: 38, g: 0.16, d: 0.14, pri: 2, jit: 0 });
      play({ type: 'sine', f: 52, f2: 36, at: 0.16, g: 0.11, d: 0.14, pri: 2, jit: 0 });
    }
  } else heartT = 0;

  // ── muffle: the pause menu, death, a beat after a hit, and when badly hurt ──
  let hz = 20000;
  if (G.paused || G.skillSelect) hz = 650;
  else if (G.mode === 'dead') hz = 900;
  else if (G.mode === 'play'){
    if (hpFrac < 0.28) hz = 2800 + hpFrac * 20000;
    if (G.slowmo < 0.6) hz = Math.min(hz, 3200);
    if (AE.hurtAt && t - AE.hurtAt < 0.22) hz = Math.min(hz, 1300);
  }
  hz = Math.round(hz / 100) * 100;
  if (hz !== lastMuffle){ setMuffle(hz, hz < 2000 ? 0.04 : 0.18); lastMuffle = hz; }
}
