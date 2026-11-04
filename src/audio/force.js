// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FORCE SOUND: every Force power is built from layers, all synthesized, on its own bus.
//
//   TELEKINETIC (push, pull, repulse)   the films' recipe, all weighted low:
//       1 the rush             torn air through a flanger with heavy feedback; its sweep falls for a push and rises
//                              for a pull, so you hear which way the Force is flowing
//       2 the hum              a deep, pitch-bent drone as the power takes hold, the Force itself
//       3 the impact           a kick's pitch drop into the sub, a dull distorted crash, debris settling
//   LIGHTNING (cast, each chain tick, the held channel)   electricity first:
//       1 the ignition spark   a capacitor dump: a hard pop and a welder's knock
//       2 the crackle          a dense, uneven rain of tiny discharges with bigger snaps (makeCrackle), bright and low
//       3 the arc's buzz       a raspy, driven 120 Hz tone, the sound of a live arc
//       4 the fry              a sizzle up in 8-12 kHz; a quiet chaotic tear and a faint deep hum under it all
//       all of it runs through a TREMOLO wobbling at an irregular 12-18 Hz, so the current stutters and flickers
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

/* real electricity, as a sound: not hiss but a dense, uneven rain of discharges. Thousands of tiny clicks (each a
   few samples of noise dying in under 2 ms), bunched into stuttering clusters, with bigger snaps among them. Played
   looped like the noise buffers (AE.noise.crackle), through filters, it is the crackle every lightning layer leads with. */
function makeCrackle(){
  const sr = ac().sampleRate, n = sr * 2, buf = ac().createBuffer(1, n, sr), d = buf.getChannelData(0);
  let i = 0;
  while (i < n){
    const burst = Math.random() < 0.3;                         // a cluster of discharges, then a ragged gap
    const len = Math.floor(sr * (burst ? rand(0.01, 0.05) : rand(0.002, 0.012)));
    const rate = burst ? rand(2500, 6000) : rand(150, 600);    // clicks per second inside it
    for (let j = 0; j < len && i + j < n; j += Math.max(1, Math.floor(sr / rate * rand(0.3, 1.7)))){
      const big = Math.random() < 0.04, amp = (big ? 1 : rand(0.1, 0.55)) * (Math.random() < 0.5 ? -1 : 1);
      const dec = Math.floor(sr * (big ? rand(0.002, 0.005) : rand(0.0002, 0.0015)));
      for (let k = 0; k < dec && i + j + k < n; k++) d[i + j + k] += amp * (Math.random() * 2 - 1) * Math.exp(-5 * k / dec);
    }
    i += len + Math.floor(sr * (burst ? rand(0.002, 0.02) : rand(0.0005, 0.004)));
  }
  let mx = 0; for (let k = 0; k < n; k++) mx = Math.max(mx, Math.abs(d[k]));
  for (let k = 0; k < n; k++) d[k] = clamp(d[k] / (mx || 1) * 1.6, -1, 1);
  return buf;
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
  AE.noise.crackle = makeCrackle();
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

/* LAYER 1 of a telekinetic power: the rush. Torn air (noise through a sweeping band) run into a flanger with heavy
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

/* THE FILMS' RECIPE for a telekinetic power (as Star Wars sound breakdowns describe it): a whoosh of air first, then a
   deep hum as the power takes hold, then the crash of the impact, all of it weighted low.
   rush: torn air through the flanger (falling for a push, rising for a pull); hum: a deep, pitch-bent drone, the Force
   itself; impact: a kick's pitch drop into the sub with a dull, distorted crash on top. */
function hum(pos, self, { at = 0, g = 0.2, a = 0.05, hold = 0.1, d = 0.4, f = 55, f2 = 46 } = {}){
  V({ pos, at, type: 'sawtooth', f, f2, g: g * 0.5, a, hold, d, filt: { type: 'lowpass', f: 320, f2: 160 }, vib: { r: 5.5, d: 14 }, drive: 0.25, verb: 0.2 }, 'force', self);
  V({ pos, at, type: 'sawtooth', f: f * 1.005, f2: f2 * 1.005, det: 7, g: g * 0.35, a, hold, d, filt: { type: 'lowpass', f: 300, f2: 150 } }, 'force', self);
  V({ pos, at, type: 'sine', f: f / 2, f2: f2 / 2, g, a, hold, d: d * 1.2, pri: 2 }, 'force', self);           // its sub-octave, felt more than heard
}
function impact(pos, s, self, at = 0){
  V({ pos, at, type: 'sine', f: 140, f2: 42, ft: 0.08, g: 0.27 * s, a: 0.003, d: 0.24, pri: 2, jit: 0.02 }, 'force', self);
  VN({ pos, at, color: 'brown', g: 0.26 * s, a: 0.002, d: 0.32 * s, filt: { type: 'lowpass', f: 1100, f2: 120 }, drive: 0.5, verb: 0.3 }, 'force', self);   // the crash
  VN({ pos, at, g: 0.025 * s, a: 0.001, d: 0.03, filt: { type: 'lowpass', f: 2400 } }, 'force', self);
  for (let i = 0; i < 3; i++) VN({ pos, at: at + rand(0.04, 0.2), color: 'brown', g: 0.05 * s, d: 0.05, filt: { type: 'bandpass', f: rand(300, 700), q: 2 }, pri: 0 }, 'force', self);   // what it hit, settling
}

/* ---------- telekinetic ---------- */

const HIT = 0.13;   // when the impact lands after the rush starts (short, so the shove still feels instant)
export function push(pos){
  if (!ensureBus()) return;
  const self = !pos;
  rip({ pos, g: 0.17, a: 0.07, dur: HIT + 0.2, f: 1600, f2: 200, d0: 0.0016, d1: 0.011, q: 0.7, color: 'pink', verb: 0.3 });   // the rush, falling away from you
  hum(pos, self, { at: 0.04, g: 0.2, a: 0.06, hold: 0.08, d: 0.45, f: 58, f2: 44 });
  impact(pos, 1, self, HIT);
  if (self) duck(0.25, 0.12);
}

// the pull: the rush rising as the air is drawn in, the hum swelling as the target is dragged, the impact as it lands
export function pull(pos){
  if (!ensureBus()) return;
  const self = !pos;
  rip({ pos, g: 0.16, a: 0.18, dur: 0.26, f: 200, f2: 1600, d0: 0.011, d1: 0.0016, q: 0.7, color: 'pink', verb: 0.3 });   // rising toward you
  hum(pos, self, { at: 0.02, g: 0.2, a: 0.16, hold: 0.04, d: 0.35, f: 44, f2: 58 });
  impact(pos, 0.85, self, 0.22);
}

// the repulse: the same recipe round all of you at once — a rush in each ear, a deeper and longer hum, a much bigger crash
export function repulse(pos, big){
  if (!ensureBus()) return;
  const self = !pos, s = big ? 1.2 : 1;
  for (const [pan, d1] of [[-0.75, 0.0105], [0.75, 0.008], [0, 0.0095]])
    rip({ pos, pan: pos ? 0 : pan, g: 0.13 * s, a: 0.08, dur: 0.5 * s, f: 1800, f2: 160, d0: 0.0014, d1, color: 'pink', verb: 0.4 });
  hum(pos, self, { at: 0.04, g: 0.24 * s, a: 0.06, hold: 0.12, d: 0.7 * s, f: 52, f2: 38 });
  impact(pos, 1.3 * s, self, HIT + 0.02);
  V({ pos, at: HIT + 0.02, type: 'sine', f: 56, f2: 27, g: 0.34 * s, a: 0.006, d: 0.9 * s, pri: 2 }, 'force', self);
  VN({ pos, at: HIT + 0.02, color: 'brown', g: 0.28 * s, a: 0.004, d: 0.8 * s, filt: { type: 'lowpass', f: 1600, f2: 80 }, drive: 0.5, verb: 0.35 }, 'force', self);   // the blast rolling out
  if (self) duck(0.4, 0.2);
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

/* LIGHTNING, built as electricity first: the crackle (the discharge buffer, bright and dense) and the arc's buzz
   (a raspy, driven 120 Hz mains-like tone, the sound a live arc makes), the films' deep hum kept only faintly under it. */
function crackle(pos, s, dur, self, at = 0){
  VN({ pos, at, color: 'crackle', g: 0.32 * s, a: 0.002, d: dur, filt: { type: 'highpass', f: 1400 }, drive: 0.35, verb: 0.15, jit: 0.15 }, 'zap', self);
  VN({ pos, at, color: 'crackle', rate: 0.55, g: 0.16 * s, a: 0.002, d: dur * 0.8, filt: { type: 'bandpass', f: 900, q: 0.7 }, drive: 0.5, jit: 0.2 }, 'zap', self);   // its lower, heavier snaps
}
function buzz(pos, s, dur, self, at = 0){
  for (const [f, fq] of [[120, 2300], [180.6, 3400]])
    V({ pos, at, type: 'sawtooth', f, g: 0.05 * s, a: 0.003, d: dur, vib: { r: 47, d: 90 }, drive: 0.75, filt: { type: 'bandpass', f: fq, q: 0.9 } }, 'zap', self);
}
function zapHum(pos, s, dur, self, at = 0){
  V({ pos, at, type: 'sine', f: 49, f2: 44, g: 0.06 * s, a: 0.03, d: dur }, 'zap', self);
}

// the cast (Force Judgement opening up; also the Mando's electric gadgets, the boss's blink): the spark, a burst of
// crackle and the arc's buzz, the fry over it, a faint deep hum under it
export function zap(pos){
  if (!ensureBus()) return;
  const self = !pos;
  spark(pos, 1.1, self); crackle(pos, 1, 0.42, self); buzz(pos, 1, 0.34, self); fry(pos, 0.8, 0.36, self, 0.005);
  tear(pos, 0.3, 0.2, self); zapHum(pos, 1, 0.45, self);
}
// one chained strike landing on a foe (Judgement's ticks): self = the hero's own (placed at the foe, but on the Force bus)
export function arc(pos, self){
  if (!ensureBus()) return;
  spark(pos, 0.7, self); crackle(pos, 0.6, 0.1, self); buzz(pos, 0.5, 0.08, self);
}

/* the held channel: the crackle, the arc's buzz and a fry that run as long as lightning pours out (the hero's Judgement, the boss's
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
  // the crackle: the discharge buffer, looped, bright
  const ck = A.createBufferSource(); ck.buffer = AE.noise.crackle; ck.loop = true;
  const cf = A.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 1300;
  const cg = A.createGain(); cg.gain.value = 2.2; ck.connect(cf); cf.connect(cg); cg.connect(lvl);
  const ck2 = A.createBufferSource(); ck2.buffer = AE.noise.crackle; ck2.loop = true; ck2.playbackRate.value = 0.6;   // its heavier snaps
  const cf2 = A.createBiquadFilter(); cf2.type = 'bandpass'; cf2.frequency.value = 850; cf2.Q.value = 0.7;
  const cg2 = A.createGain(); cg2.gain.value = 1.1; ck2.connect(cf2); cf2.connect(cg2); cg2.connect(lvl);
  // the arc's buzz: raspy, driven 120 Hz, wavering
  const shp = A.createWaveShaper(), cv = new Float32Array(512);
  for (let i = 0; i < 512; i++){ const x = i / 511 * 2 - 1; cv[i] = Math.tanh(5 * x) / Math.tanh(5); }
  shp.curve = cv; const bfl = A.createBiquadFilter(); bfl.type = 'bandpass'; bfl.frequency.value = 2400; bfl.Q.value = 0.8;
  const rg = A.createGain(); rg.gain.value = 0.22; shp.connect(bfl); bfl.connect(rg); rg.connect(lvl);
  const wv = A.createOscillator(), wg = A.createGain(); wv.frequency.value = 47; wg.gain.value = 6; wv.connect(wg); oscs.push(wv);
  for (const f of [120, 180.6]){ const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; wg.connect(o.frequency); o.connect(shp); oscs.push(o); }
  // a faint deep hum under it
  const hs = A.createOscillator(), hg = A.createGain(); hs.frequency.value = 46; hg.gain.value = 0.35; hs.connect(hg); hg.connect(lvl); oscs.push(hs);
  tg.gain.value = 0.25;   // (the tear stays, quieter, under the crackle)
  // the fry: hiss up in 8-12 kHz
  const nz = A.createBufferSource(); nz.buffer = AE.noise.white; nz.loop = true;
  const nf = A.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 9800; nf.Q.value = 0.8;
  const ng = A.createGain(); ng.gain.value = 0.9; nz.connect(nf); nf.connect(ng); ng.connect(lvl);
  for (const o of oscs) o.start(t);
  nz.start(t); ck.start(t, rand(0, 1.5)); ck2.start(t, rand(0, 1.5));
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
  F.hero.set(heroOn ? 0.09 * (nim ? NIMAN_FORCE.g : 1) : 0, 0, 0, nim);
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
