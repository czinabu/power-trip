// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FORCE SOUND: every Force power is built from layers, all synthesized, on its own bus.
//
//   TELEKINETIC (push, pull, repulse)   a localized sonic boom, not a whoosh:
//       1 the pressure snap    a compressed crack of air, the frame the power lands on
//       2 the displacement     a 40-60 Hz sub drop: the weight that moves the room
//       3 the vacuum rip       a jet of torn air through a flanger with heavy feedback; its sweep crashes DOWN for a
//                              push and rises UP for a pull, so you hear which way the Force is flowing
//   LIGHTNING (cast, each chain tick, the held channel)   unstable electrical tearing:
//       1 the ignition spark   a capacitor dump: a hard pop and a welder's knock
//       2 the fry              a sizzle sitting up in 8-12 kHz
//       3 the tear             detuned saws thrashed by a chaotic modulator
//       all three run through a TREMOLO wobbling at an irregular 12-18 Hz, so the current stutters and flickers
//   INTERNAL (Force Mend's channel and its bloom)   the camera pulls inward:
//       1 the riser            a reversed-cymbal swell and a pad opening upward
//       2 the harmony          a singing bowl ring and a soft choral hum, in a long bright reverb
//       3 the baseline         a slow heartbeat and a low throat-singing drone
//       while it channels the whole world goes through a low-pass (director.js reads innerHz), and only the Force
//       stays clear: this bus skips the world's muffle and goes straight to the master
//   NIMAN (Form VI, the Force-wizard's form): the hero's Force sounds come up +3 dB and ring into a longer, wetter room.
//
//   force bus ─┬──────────────── F.out (SFX slider) ─ masterGain ─ limiter   (never muffled, so it cuts through)
//   zap bus ── tremolo ─────────┘      ▲
//   sends ── force room (2.6 s) ───────┤
//            Niman's room (4.2 s) ─────┘
// A foe's Force (the boss's lightning, his blink, a co-op partner's push) is placed in the world on the ordinary sfx
// bus instead, so it muffles and fades with distance like any other sound out there.

import { AE, play, place, duck } from './engine.js';
import { shared, G, player, isGunner } from '../state.js';
import { clamp, rand } from '../utils.js';

const ac = () => shared.AC;
const now = () => shared.AC.currentTime;
const F = { ready: false, vol: -1, innerUntil: 0, hero: null, foe: null, mate: null, mateAt: -9, tick: 0 };

/* Niman's boost: +3 dB (×1.41) and a longer, wetter tail. Only the hero's own powers, only in Form VI. */
export const NIMAN_FORCE = { g: 1.41, verb: 1.6 };
const niman = () => G.hero === 'jedi' && G.stance === 'niman';

/* a bright, smooth room for the Force: slow to bloom, losing little of its top as it dies (a shimmer, not a cave) */
function makeIR(secs, damp){
  const sr = ac().sampleRate, n = Math.floor(sr * secs), ir = ac().createBuffer(2, n, sr), pre = Math.floor(sr * 0.018);
  for (let c = 0; c < 2; c++){
    const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++){
      if (i < pre){ d[i] = 0; continue; }
      const t = (i - pre) / (n - pre), k = 1 - t * damp, swell = Math.min(1, t * 22);
      lp = lp * (1 - k) + (Math.random() * 2 - 1) * k;
      d[i] = lp * swell * Math.pow(1 - t, 2.6);
    }
  }
  return ir;
}

/* an amplitude wobble at an irregular 12-18 Hz: two LFOs a little apart, their rates themselves dragged around by a
   slow third, summed onto a gain (lightning stutters instead of buzzing evenly) */
function tremolo(A, to, base){
  const g = A.createGain(); g.gain.value = base; g.connect(to);
  const drift = A.createOscillator(), dg = A.createGain(); drift.frequency.value = 0.9; dg.gain.value = 2.6; drift.connect(dg); drift.start();
  for (const [r, d, type] of [[13.3, base * 0.55, 'sine'], [16.9, base * 0.35, 'triangle']]){
    const o = A.createOscillator(), og = A.createGain(); o.type = type; o.frequency.value = r; og.gain.value = d;
    dg.connect(o.frequency); o.connect(og); og.connect(g.gain); o.start();
  }
  return g;
}

function ensureBus(){
  if (F.ready) return true;
  if (!AE.ready || !shared.masterGain) return false;
  const A = ac();
  const mk = (to, v) => { const n = A.createGain(); n.gain.value = v; n.connect(to); return n; };
  F.out = mk(shared.masterGain, AE.vol.sfx); F.vol = AE.vol.sfx;
  F.roomOut = mk(F.out, 0.55);
  F.room = A.createConvolver(); F.room.buffer = makeIR(2.6, 0.45); F.room.connect(F.roomOut);
  F.roomN = A.createConvolver(); F.roomN.buffer = makeIR(4.2, 0.4); F.roomN.connect(F.roomOut);
  AE.send = AE.send || {};
  AE.bus.force = AE.bus.forceN = mk(F.out, 1);
  AE.send.force = mk(F.room, 1); AE.send.forceN = mk(F.roomN, 1);
  AE.bus.zap = AE.bus.zapN = tremolo(A, F.out, 0.62);
  AE.send.zap = AE.send.force; AE.send.zapN = AE.send.forceN;
  AE.bus.zapW = tremolo(A, AE.bus.sfx, 0.62);   // a foe's lightning out in the world: the same stutter, muffled with the world
  F.ready = true;
  F.hero = zapLoop(AE.bus.zap, AE.send.force, AE.send.forceN);
  F.foe = zapLoop(AE.bus.zapW, AE.roomIn, AE.roomIn);
  return true;
}

/* the bus a voice goes on: the hero's own Force on the force bus (Niman's when in Form VI), a foe's in the world */
function route(kind, self){
  if (!self) return { bus: kind === 'zap' ? 'zapW' : 'sfx', g: 1, v: 1 };
  const n = niman();
  return { bus: kind + (n ? 'N' : ''), g: n ? NIMAN_FORCE.g : 1, v: n ? NIMAN_FORCE.verb : 1 };
}
// one layer: o is a play() spec; self = the hero's own power (default: when it has no world position)
function V(o, kind = 'force', self = !o.pos){
  const R = route(kind, self);
  play(Object.assign({}, o, { bus: R.bus, g: (o.g ?? 0.1) * R.g, verb: o.verb ? Math.min(1, o.verb * R.v) : (R.v > 1 ? 0.12 : 0) }));
}
const VN = (o, kind, self) => V(Object.assign({ src: 'noise' }, o), kind, self);

/* LAYER 3 of a telekinetic power: the vacuum rip. Torn air (noise through a sweeping band) run into a flanger with heavy
   feedback, whose delay sweeps with it: shortening (the comb rises) for a pull, lengthening (it crashes down) for a push. */
function rip({ pos, self = !pos, at = 0, g, a, dur, f, f2, d0, d1, fb = 0.74, q = 0.8, color = 'pink', verb = 0.3, pan = 0 }){
  if (!ensureBus() || ac().state !== 'running' || AE.live >= 56) return;
  const P = pos ? place(pos) : null;
  if (P && P.d > 70) return;
  const R = route('force', self), A = ac(), t = now() + at + 0.004, end = t + dur;
  const peak = g * R.g * (P ? P.gain : 1);
  if (peak < 0.002) return;
  const src = A.createBufferSource(); src.buffer = AE.noise[color]; src.loop = true; src.playbackRate.value = 1 + rand(-0.05, 0.05);
  const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(f, t); bp.frequency.exponentialRampToValueAtTime(f2, end);
  const dl = A.createDelay(0.05), fbg = A.createGain(), mix = A.createGain(), env = A.createGain();
  dl.delayTime.setValueAtTime(d0, t); dl.delayTime.exponentialRampToValueAtTime(d1, end);
  fbg.gain.value = fb; mix.gain.value = 0.7;
  src.connect(bp); bp.connect(mix); bp.connect(dl); dl.connect(fbg); fbg.connect(dl); dl.connect(mix); mix.connect(env);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + a);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  let out = env;
  if (P && P.lp < 19000){ const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = P.lp; out.connect(lp); out = lp; }
  const pn = P ? P.pan : pan;
  if (pn){ const p = A.createStereoPanner(); p.pan.value = clamp(pn, -1, 1); out.connect(p); out = p; }
  out.connect(AE.bus[R.bus]);
  const vs = Math.min(1, verb * R.v);
  if (vs){ const r = A.createGain(); r.gain.value = vs; out.connect(r); r.connect((AE.send && AE.send[R.bus]) || AE.roomIn); }
  src.start(t, Math.random() * 1.5); src.stop(end + 0.06);
  AE.live++;
  src.onended = () => { AE.live--; try { fbg.disconnect(); out.disconnect(); } catch(e){} };
}

/* a singing bowl: inharmonic partials, each a pair a couple of Hz apart so it beats slowly as it rings */
function bowl(f, { pos, at = 0, g = 0.05, a = 0.006, d = 2, verb = 0.55 } = {}){
  [[1, 1], [2.71, 0.45], [5.15, 0.2], [8.93, 0.07]].forEach(([r, k], i) => {
    for (const bt of [-1.1, 1.1]) V({ pos, at, type: 'sine', f: f * r + bt * (i + 1), g: g * k * 0.5, a, d: d / (1 + i * 0.4), verb, jit: 0.004 });
  });
}

/* LAYER 1 of a telekinetic power: the pressure snap, a heavily compressed crack of air (s scales it) */
function snap(pos, s, self){
  VN({ pos, g: 0.24 * s, a: 0.0008, d: 0.028, filt: { type: 'highpass', f: 1500 }, drive: 0.9, pri: 2, jit: 0.1 }, 'force', self);
  V({ pos, type: 'sine', f: 2600, f2: 240, ft: 0.016, g: 0.1 * s, a: 0.0005, d: 0.026 }, 'force', self);
  VN({ pos, color: 'brown', g: 0.3 * s, a: 0.001, d: 0.085, filt: { type: 'lowpass', f: 1100, f2: 180 }, drive: 0.55 }, 'force', self);   // the air-cannon's bark
}

/* ---------- telekinetic ---------- */

export function push(pos){
  if (!ensureBus()) return;
  const self = !pos;
  snap(pos, 1, self);
  V({ pos, type: 'sine', f: 60, f2: 38, g: 0.32, a: 0.006, d: 0.55, pri: 2 }, 'force', self);                  // the sub drop
  V({ pos, type: 'triangle', f: 98, f2: 44, g: 0.1, a: 0.004, d: 0.3, filt: { type: 'lowpass', f: 260 } }, 'force', self);
  rip({ pos, at: 0.008, g: 0.24, a: 0.014, dur: 0.44, f: 2800, f2: 300, d0: 0.0011, d1: 0.009 });              // crashing downward
  if (self) duck(0.22, 0.08);
}

// the pull: the air drawn IN — a smaller snap, the rip rising, the sub swelling as the target is dragged in, a thud as it lands
export function pull(pos){
  if (!ensureBus()) return;
  const self = !pos;
  snap(pos, 0.6, self);
  rip({ pos, g: 0.22, a: 0.2, dur: 0.34, f: 320, f2: 3200, d0: 0.009, d1: 0.0011 });                           // rising
  V({ pos, type: 'sine', f: 38, f2: 60, g: 0.26, a: 0.18, d: 0.2, pri: 2 }, 'force', self);
  V({ pos, at: 0.22, type: 'sine', f: 110, f2: 46, g: 0.14, d: 0.16 }, 'force', self);
  VN({ pos, at: 0.22, color: 'brown', g: 0.12, d: 0.1, filt: { type: 'lowpass', f: 600 } }, 'force', self);
}

// the repulse: the push gone round all of you at once — a harder snap, a deeper and longer drop, a rip in each ear
export function repulse(pos, big){
  if (!ensureBus()) return;
  const self = !pos, s = big ? 1.2 : 1;
  snap(pos, 1.25 * s, self);
  V({ pos, type: 'sine', f: 56, f2: 27, g: 0.4 * s, a: 0.006, d: 0.9 * s, pri: 2 }, 'force', self);
  VN({ pos, color: 'brown', g: 0.3 * s, a: 0.004, d: 0.75 * s, filt: { type: 'lowpass', f: 1900, f2: 90 }, drive: 0.45, verb: 0.3 }, 'force', self);   // the pressure wave rolling out
  for (const [pan, d1] of [[-0.75, 0.0095], [0.75, 0.0072], [0, 0.0085]])
    rip({ pos, pan: pos ? 0 : pan, at: 0.01, g: 0.17 * s, a: 0.016, dur: 0.6 * s, f: 3000, f2: 220, d0: 0.0012, d1, verb: 0.4 });
  if (self) duck(0.4, 0.15);
}

// the barrier snapping up: the shove's crack, then the bubble itself rings like a struck bowl over a low shimmering hum
export function barrier(){
  if (!ensureBus()) return;
  bowl(523, { at: 0.02, g: 0.06, d: 1.6, verb: 0.6 });
  bowl(784, { at: 0.06, g: 0.028, d: 1.2, verb: 0.6 });
  V({ type: 'sawtooth', f: 110, g: 0.045, a: 0.06, d: 0.6, filt: { type: 'lowpass', f: 560 }, vib: { r: 7, d: 25 } });
  VN({ g: 0.03, a: 0.08, d: 0.7, filt: { type: 'highpass', f: 7000 }, verb: 0.5 });
}

/* ---------- lightning ---------- */

function spark(pos, s, self){
  VN({ pos, g: 0.3 * s, a: 0.0005, d: 0.012, filt: { type: 'highpass', f: 3000 }, drive: 0.95, pri: 2, jit: 0.15 }, 'zap', self);   // the capacitor dumping
  V({ pos, type: 'sine', f: 4200, f2: 800, ft: 0.01, g: 0.09 * s, a: 0.0005, d: 0.02 }, 'zap', self);
  V({ pos, type: 'square', f: 190, f2: 60, g: 0.07 * s, a: 0.001, d: 0.05, filt: { type: 'lowpass', f: 1800 } }, 'zap', self);   // the welder's knock
}
function fry(pos, s, dur, self, at0 = 0){
  VN({ pos, at: at0, g: 0.09 * s, a: 0.004, d: dur, filt: { type: 'bandpass', f: 10000, q: 0.9 } }, 'zap', self);
  const n = Math.round(dur * 30);
  for (let i = 0; i < n; i++)
    VN({ pos, at: at0 + rand(0, dur), g: 0.05 * s * rand(0.5, 1), a: 0.0006, d: rand(0.004, 0.014), filt: { type: 'highpass', f: rand(6000, 11000) }, drive: 0.6, pri: 0, jit: 0.2 }, 'zap', self);
}
function tear(pos, s, dur, self){
  for (const [f, r] of [[58, 2.37], [87, 3.11]])
    V({ pos, type: 'sawtooth', f, g: 0.06 * s, a: 0.004, d: dur, fm: { r, i: 6, i2: 1.5, type: 'square' }, vib: { r: 31, d: 520 },
        filt: { type: 'lowpass', f: 2800, f2: 900 }, drive: 0.5 }, 'zap', self);
}

// the cast (Force Judgement opening up; also the Mando's electric gadgets, the boss's blink): spark, fry, tear
export function zap(pos){
  if (!ensureBus()) return;
  const self = !pos;
  spark(pos, 1, self); fry(pos, 1, 0.34, self, 0.005); tear(pos, 1, 0.3, self);
}
// one chained strike landing on a foe (Judgement's ticks): self = the hero's own (placed at the foe, but on the Force bus)
export function arc(pos, self){
  if (!ensureBus()) return;
  spark(pos, 0.55, self); fry(pos, 0.6, 0.08, self); tear(pos, 0.5, 0.09, self);
}

/* the held channel: a tear and a fry that run as long as lightning pours out (the hero's Judgement, the boss's
   lightning, a co-op partner's). Steered by updateForce. */
function zapLoop(dest, send, sendN){
  const A = ac(), t = now();
  const lvl = A.createGain(); lvl.gain.value = 0.0001;
  const pan = A.createStereoPanner(), lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000;
  lvl.connect(lp); lp.connect(pan); pan.connect(dest);
  const sv = A.createGain(), svN = A.createGain(); sv.gain.value = 0.25; svN.gain.value = 0;
  pan.connect(sv); sv.connect(send); pan.connect(svN); svN.connect(sendN);
  // the tear: two detuned saws thrashed by a square modulator whose own rate is dragged by noise-like LFOs
  const tf = A.createBiquadFilter(); tf.type = 'lowpass'; tf.frequency.value = 2200; tf.Q.value = 1.4;
  const tg = A.createGain(); tg.gain.value = 0.55; tf.connect(tg); tg.connect(lvl);
  const mod = A.createOscillator(), mg = A.createGain(); mod.type = 'square'; mod.frequency.value = 137; mg.gain.value = 70;
  const w1 = A.createOscillator(), w1g = A.createGain(); w1.frequency.value = 2.3; w1g.gain.value = 60; w1.connect(w1g); w1g.connect(mod.frequency);
  const w2 = A.createOscillator(), w2g = A.createGain(); w2.frequency.value = 9.1; w2g.gain.value = 900; w2.connect(w2g); w2g.connect(tf.frequency);
  mod.connect(mg);
  const oscs = [mod, w1, w2];
  for (const f of [58, 86.5]){ const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; mg.connect(o.frequency); o.connect(tf); oscs.push(o); }
  // the fry: hiss up in 8-12 kHz
  const nz = A.createBufferSource(); nz.buffer = AE.noise.white; nz.loop = true;
  const nf = A.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 9800; nf.Q.value = 0.8;
  const ng = A.createGain(); ng.gain.value = 0.9; nz.connect(nf); nf.connect(ng); ng.connect(lvl);
  for (const o of oscs) o.start(t);
  nz.start(t);
  let on = false;
  return {
    set(level, p, hz, nim){
      const tt = now(), k = level > 0.001 ? 0.03 : 0.08;
      if (!on && level <= 0.001) return;
      on = level > 0.001;
      lvl.gain.setTargetAtTime(Math.max(0.0001, level), tt, k);
      pan.pan.setTargetAtTime(clamp(p || 0, -1, 1), tt, 0.05);
      lp.frequency.setTargetAtTime(hz || 20000, tt, 0.05);
      sv.gain.setTargetAtTime(nim ? 0 : 0.25, tt, 0.05); svN.gain.setTargetAtTime(nim ? 0.4 : 0, tt, 0.05);
    },
  };
}

// a co-op partner's lightning is pouring out this frame, toward pos (net/partner-fx.js)
export function noteLightning(pos){ F.mate = pos; F.mateAt = G.gt; }

/* ---------- internal ---------- */

// Force Mend begins: the riser, the bowl, the drone and the heartbeat (the world's low-pass comes from innerHz)
export function mend(){
  if (!ensureBus()) return;
  VN({ g: 0.06, a: 0.6, d: 0.06, filt: { type: 'highpass', f: 3800 }, verb: 0.4 });                              // a reversed cymbal
  VN({ g: 0.035, a: 0.62, d: 0.1, filt: { type: 'bandpass', f: 900, f2: 6000, q: 1.2, t: 0.66 } });
  for (const f of [220, 277.2, 329.6, 440])                                                                        // a pad swelling open
    V({ type: 'triangle', f, g: 0.03, a: 0.55, hold: 0.1, d: 0.5, filt: { type: 'lowpass', f: 320, f2: 2600, t: 0.65 }, vib: { r: 4.5, d: 8 }, verb: 0.5, jit: 0.005 });
  bowl(440, { at: 0.12, g: 0.045, a: 0.18, d: 1.8, verb: 0.65 });                                                  // rubbed, not struck
  for (const [fq, q, g] of [[380, 2, 0.06], [1310, 9, 0.022]])                                                     // throat-singing: a low drone and its overtone whistle
    V({ type: 'sawtooth', f: 65.4, g, a: 0.25, hold: 0.35, d: 0.6, filt: { type: 'bandpass', f: fq, q }, vib: { r: 5, d: 6 }, verb: 0.3, jit: 0.005 });
  for (const [at, g] of [[0.04, 0.2], [0.2, 0.13], [0.92, 0.15], [1.08, 0.1]])                                     // a slow heartbeat (~66 bpm)
    V({ at, type: 'sine', f: 56, f2: 36, g, a: 0.006, d: 0.14, jit: 0 });
}
// the channel completes: the wound knits — a struck bowl and a soft choir bloom, and the world comes back in after a beat
export function mendDone(){
  if (!ensureBus()) return;
  bowl(392, { g: 0.085, d: 2.6, verb: 0.7 });
  for (const f of [196, 294, 392])
    for (const fq of [800, 1150]) V({ type: 'sawtooth', f, g: 0.02, a: 0.08, hold: 0.15, d: 1.1, filt: { type: 'bandpass', f: fq, q: 5 }, vib: { r: 5.2, d: 10 }, verb: 0.6, jit: 0.006 });
  V({ type: 'sine', f: 98, f2: 92, g: 0.1, a: 0.02, d: 0.8 });
  VN({ g: 0.03, a: 0.15, d: 0.9, filt: { type: 'highpass', f: 6500 }, verb: 0.6 });
  F.innerUntil = now() + 0.3;
}

/* the world's low-pass while an internal power runs (the Jedi's Mend channel and a beat after it), for director.js */
export function innerHz(){
  if (!AE.ready) return 20000;
  if (!isGunner() && player.mendT > 0) return 520;
  return now() < F.innerUntil ? 520 : 20000;
}

/* ---------- once a frame (director.js) ---------- */
export function updateForce(dt){
  if (!ensureBus()) return;
  if (F.vol !== AE.vol.sfx){ F.vol = AE.vol.sfx; F.out.gain.setTargetAtTime(F.vol, now(), 0.05); }
  const playing = G.mode === 'play' && !G.paused && !G.skillSelect;
  // the hero's Judgement, held: louder in Niman, a little brighter with the crackle thrown over it
  const heroOn = playing && !isGunner() && player.judgeT > 0, nim = niman();
  F.hero.set(heroOn ? 0.075 * (nim ? NIMAN_FORCE.g : 1) : 0, 0, 0, nim);
  // the nearest foe's lightning: the boss's beam, or the partner's
  let at = null;
  if (playing && shared.bossLight && shared.bossLight.visible && shared.boss) at = shared.boss.group.position;
  else if (playing && F.mate && G.gt - F.mateAt < 0.2) at = F.mate;
  const P = at ? place(at) : null;
  F.foe.set(P ? 0.085 * P.gain * (player.blockHeld ? 1.25 : 1) : 0, P ? P.pan : 0, P ? P.lp : 0, false);
  // tiny spits of current over a held channel
  if (heroOn || P){
    F.tick -= dt;
    if (F.tick <= 0){
      F.tick = rand(0.025, 0.07);
      if (heroOn) fry(undefined, 0.5, 0.02, true);
      if (P) fry(at, 0.6, 0.02, false);
    }
  }
}
