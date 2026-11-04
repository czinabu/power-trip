// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIGHTSABER SOUND: every one-shot a blade makes, all synthesized (no recordings, nothing borrowed from a film or a game).
//   ignite / retract   the snap-hiss: a crack, the blade running up (or sucking back) through a filter that flares open
//                      (full: the showpiece version, for the ignite / retract key and a draw from the belt)
//   swing              the "vwoom": the hum bending up through the arc, a doppler pass, moving air; every stroke different
//   clash              blade on blade: inharmonic FM ring, a crack, the electric bite of the bind and its spitting crackle
//   burn               blade through a body: a scorching sear over a dull thump
//   wall               blade dragged through stone or metal: a sizzling scrape that spits sparks
//   deflect            a bolt batted away: the bolt's zing turned round, a ring, a spark of its energy
// The held hum (the loop that bends with the blade's real tip speed) lives in director.js and uses HUM_PITCH below.

import { play, tooSoon } from './engine.js';
import { G, isGunner } from '../state.js';
import { rand } from '../utils.js';

const N = o => play(Object.assign({ src: 'noise' }, o));
const T = o => play(o);

/* the hum's pitch by form: lighter forms ride higher; the Darksaber sits far under all of them */
export const HUM_PITCH = { shiicho: 0.92, makashi: 1.06, soresu: 0.96, ataru: 1.1, niman: 1, djemso: 0.86, shien: 0.92, juyo: 1.04, vaapad: 0.9, staff: 1.08, dark: 0.69 };

/* what every lit blade is doing this frame, filled in by fx/trail.js (which already follows every blade for its streak)
   and read by director.js: tip speeds (m/s against the owner's body) of the hero's blade, the saber staff's far end and
   the Darksaber in hand, and every other lit blade (its tip in the world, speed, dark, thrown) */
export const BLADE_AUDIO = { hero: 0, hero2: 0, dark: 0, others: [], lock: null };   // lock: the hero's saber lock, set by enemies/duel.js

/* EACH FORM'S VOICE — a form's swing and its clash, the same for the hero and for a master of that form (game/mission.js
   e.form). p bends the hum's pitch (light and high, or heavy and low), len is the stroke's length, air the rush of
   moved air, drive its grit; ring tunes the clash's metal and damp how long it rings (Soresu soaks a blow, Djem So's
   rings out). flick adds Ataru's flourish, a second short whoosh; thump puts weight under a Djem So clash. */
export const FORM_SOUND = {
  shiicho: { p: 0.9,  len: 1.3,  air: 1.3,  ring: 0.94, damp: 1 },     // a wide, open sweep
  makashi: { p: 1.22, len: 0.7,  air: 0.55, ring: 1.3,  damp: 1.1 },   // a fencer's thin flick, a bright, precise ring
  soresu:  { p: 1.0,  len: 0.8,  air: 0.7,  ring: 0.88, damp: 0.6 },   // tight and economical; its blocks thud dead
  ataru:   { p: 1.14, len: 0.85, air: 1.25, ring: 1.12, damp: 1, flick: true },
  djemso:  { p: 0.78, len: 1.45, air: 1.15, ring: 0.74, damp: 1.25, thump: true },
  shien:   { p: 0.88, len: 1.2,  air: 1,    ring: 0.84, damp: 1.1 },
  niman:   { p: 1,    len: 1,    air: 1,    ring: 1,    damp: 1 },
  juyo:    { p: 1.06, len: 0.8,  air: 1.1,  ring: 1.04, damp: 1.15, drive: 0.4 },   // ragged, snarling
  vaapad:  { p: 0.86, len: 1.1,  air: 0.9,  ring: 0.8,  damp: 1.3, drive: 0.2, thump: true },
  staff:   { p: 1.08, len: 0.9,  air: 1.2,  ring: 1.06, damp: 1, flick: true },   // the saber staff: two hums, the far end chasing the near
};

/* the spitting of a plasma blade: a scatter of tiny bright ticks over `spread` seconds (cheap: each is one short voice,
   and the lowest priority, so a crowded fight drops them first) */
function crackle(pos, n, spread, g, at0 = 0){
  for (let i = 0; i < n; i++)
    N({ pos, at: at0 + rand(0, spread), g: g * rand(0.5, 1), a: 0.001, d: rand(0.008, 0.024), filt: { type: 'highpass', f: rand(2600, 6500) }, drive: 0.5, pri: 0, jit: 0.2 });
}

/* ---------- ignite / retract ---------- */

/* the snap-hiss of a blade lighting. kind: a form id, 'staff' (both ends, the far one a beat behind) or 'dark' */
export function ignite(kind, o = {}){
  if (o.full) return igniteFull(kind, o);
  const dark = kind === 'dark', p = HUM_PITCH[kind] || 1, pos = o.pos, at = o.at || 0, g = (o.g ?? 1) * 0.75;
  // the snap: a hard electric crack and a knock of air off the emitter
  N({ pos, at, g: 0.1 * g, a: 0.001, d: 0.05, filt: { type: 'highpass', f: 2400 }, drive: 0.7, pri: 2 });
  T({ pos, at, type: 'sine', f: 160, f2: 52, g: 0.13 * g, d: 0.17 });
  // the blade running up: a saw climbing into the hum's pitch, bright at the flare and darkening as it settles
  T({ pos, at, type: 'sawtooth', f: 46 * p, f2: 90 * p, ft: 0.17, g: 0.1 * g, a: 0.006, d: 0.6, det: 7,
      filt: { type: 'lowpass', f: dark ? 2600 : 5200, f2: 420, t: 0.5 }, drive: dark ? 0.5 : 0.15, verb: 0.2, pri: 2 });
  T({ pos, at, type: 'sawtooth', f: 46.6 * p, f2: 91 * p, ft: 0.17, g: 0.06 * g, a: 0.006, d: 0.45, det: -9, filt: { type: 'lowpass', f: 3000, f2: 380 } });
  // the "zhing" of the blade's edge shooting out to its tip: a narrow band sweeping up
  T({ pos, at: at + 0.01, type: 'sawtooth', f: 180 * p, f2: 300 * p, g: 0.045 * g, a: 0.01, d: 0.22,
      filt: { type: 'bandpass', f: dark ? 500 : 700, f2: dark ? 2200 : 4200, q: 3.5, t: 0.16 } });
  // the hiss of the plasma catching, and its first spits
  N({ pos, at, color: 'pink', g: 0.07 * g, a: 0.012, d: 0.26, filt: { type: 'bandpass', f: 1300, f2: dark ? 2400 : 4600, q: 1 } });
  crackle(pos, dark ? 5 : 3, 0.22, 0.04 * g, at + 0.02);
  if (kind === 'staff') ignite('niman', { pos, at: at + 0.075, g: 0.8 * g });   // the far blade answers a beat behind
}

/* a blade going out: the hum sucking back down into the hilt, the hiss closing, a last pop */
export function retract(kind, o = {}){
  if (o.full) return retractFull(kind, o);
  const dark = kind === 'dark', p = HUM_PITCH[kind] || 1, pos = o.pos, at = o.at || 0, g = o.g ?? 1, dur = o.short ? 0.18 : 0.32;
  T({ pos, at, type: 'sawtooth', f: 92 * p, f2: 36 * p, ft: dur * 0.9, g: 0.09 * g, a: 0.008, d: dur, det: 6,
      filt: { type: 'lowpass', f: dark ? 1600 : 2600, f2: 180 }, drive: dark ? 0.45 : 0.1, verb: 0.15, pri: 2 });
  T({ pos, at, type: 'sawtooth', f: 280 * p, f2: 110 * p, g: 0.035 * g, a: 0.006, d: dur * 0.8,
      filt: { type: 'bandpass', f: dark ? 1800 : 3400, f2: 450, q: 3 } });
  N({ pos, at, color: 'pink', g: 0.05 * g, a: 0.015, d: dur * 0.75, filt: { type: 'bandpass', f: 2800, f2: 600, q: 1 } });
  N({ pos, at: at + dur * 0.85, g: 0.03 * g, a: 0.001, d: 0.025, filt: { type: 'highpass', f: 3000 } });   // the emitter's last pop
  if (kind === 'staff') retract('niman', { pos, at: at + 0.05, g: 0.55 * g, short: o.short });
}

/* THE SHOWPIECE snap-hiss and fade-out, for a blade lit or put out on purpose (5, a draw from the belt): the quick ones
   above stay for a form change. Built on the same voices, longer and fuller so it reads as the moment it is.
   ignite: the emitter's crack and a knock of air, a "kssh" of plasma catching, the blade roaring up through a filter
     that flares wide open as it reaches the tip, a bright edge zinging out with it, then a swell of hum with a slow
     waver that settles into the held hum (director.js) instead of stopping dead
   retract: the hum rises a hair as the blade lets go, then the whole tone sinks into the hilt through a closing
     filter, a hiss drawn in after it (a slow swell cut off sharp, so it sounds pulled back rather than blown out), and
     the emitter's click and a soft thud as it seals */
function igniteFull(kind, o){
  const dark = kind === 'dark', p = HUM_PITCH[kind] || 1, pos = o.pos, at = o.at || 0, g = (o.g ?? 1) * 0.75;   // (rendered: ~2x a swing at its peak was too forward; now ~1.6x)
  // the crack and the knock of air
  N({ pos, at, g: 0.13 * g, a: 0.001, d: 0.06, filt: { type: 'highpass', f: 2200 }, drive: 0.8, pri: 2 });
  T({ pos, at, type: 'sine', f: 180, f2: 48, g: 0.16 * g, d: 0.2, pri: 2 });
  // "kssh": the plasma catching, a burst of hiss that brightens fast and trails off
  N({ pos, at: at + 0.005, color: 'pink', g: 0.1 * g, a: 0.008, d: 0.42, filt: { type: 'bandpass', f: 900, f2: dark ? 2600 : 5200, q: 0.9, t: 0.14 }, verb: 0.15, pri: 2 });
  // the blade running up: two detuned saws climbing from a growl into the hum's pitch through a filter that flares open
  // at the tip (~0.13 s) and closes back to the hum's darkness as it settles
  for (const [det, gg, f0] of [[8, 0.12, 40], [-11, 0.075, 40.6]])
    T({ pos, at, type: 'sawtooth', f: f0 * p, f2: 90 * p, ft: 0.16, g: gg * g, a: 0.012, hold: 0.06, d: 0.8, det,
        filt: { type: 'lowpass', f: dark ? 3200 : 6400, f2: 380, t: 0.7 }, drive: dark ? 0.55 : 0.2, verb: 0.25, pri: 2 });
  // the run-up said an octave and more higher, where a small speaker can carry it: the climb you hear as the blade
  // grows (the fundamental alone sits too low to read on a laptop)
  T({ pos, at, type: 'sawtooth', f: 85 * p, f2: 200 * p, ft: 0.22, g: 0.045 * g, a: 0.01, d: 0.4, det: 5,
      filt: { type: 'bandpass', f: 500, f2: 1400, q: 1.4, t: 0.22 } });
  // the edge zinging out to the tip and ringing a moment once it's there
  T({ pos, at: at + 0.012, type: 'sawtooth', f: 170 * p, f2: 360 * p, ft: 0.15, g: 0.05 * g, a: 0.01, d: 0.32, vib: { r: 7, d: 14 },
      filt: { type: 'bandpass', f: dark ? 450 : 650, f2: dark ? 2400 : 4800, q: 4, t: 0.15 }, verb: 0.2 });
  // the hum swelling in under it all with a slow waver, handing over to the held loop
  T({ pos, at: at + 0.1, type: 'sawtooth', f: 90 * p, g: 0.05 * g, a: 0.12, hold: 0.12, d: 0.55, det: 4, vib: { r: 4.5, d: 18 },
      filt: { type: 'lowpass', f: 900, f2: 420, t: 0.6 }, drive: dark ? 0.4 : 0.1 });
  T({ pos, at: at + 0.06, type: 'sine', f: 45 * p, g: 0.08 * g, a: 0.08, d: 0.6 });   // the body of it, felt more than heard
  crackle(pos, dark ? 8 : 5, 0.4, 0.045 * g, at + 0.02);
  if (kind === 'staff') igniteFull('niman', { pos, at: at + 0.09, g: 0.7 * (o.g ?? 1) });   // the far blade a beat behind
}
function retractFull(kind, o){
  const dark = kind === 'dark', p = HUM_PITCH[kind] || 1, pos = o.pos, at = o.at || 0, g = (o.g ?? 1) * 0.9, dur = 0.42;
  // the hum lets go: up a hair, then sinking into the hilt as the filter closes
  for (const [det, gg] of [[7, 0.1], [-10, 0.06]])
    T({ pos, at, type: 'sawtooth', f: 96 * p, f2: 30 * p, ft: dur, g: gg * g, a: 0.02, hold: 0.04, d: dur, det,
        filt: { type: 'lowpass', f: dark ? 1800 : 3200, f2: 140, t: dur }, drive: dark ? 0.5 : 0.15, verb: 0.2, pri: 2 });
  T({ pos, at, type: 'sawtooth', f: 300 * p, f2: 95 * p, ft: dur * 0.8, g: 0.04 * g, a: 0.01, d: dur * 0.85, vib: { r: 9, d: 12 },
      filt: { type: 'bandpass', f: dark ? 1900 : 3800, f2: 380, q: 3.5, t: dur * 0.8 } });
  // the hiss drawn in after it: a slow swell, cut off sharp at the hilt
  N({ pos, at, color: 'pink', g: 0.1 * g, a: dur * 0.75, d: 0.05, filt: { type: 'bandpass', f: 4200, f2: 700, q: 1.1, t: dur * 0.8 }, pri: 2 });
  // the emitter sealing: a click and a soft thud
  N({ pos, at: at + dur * 0.82, g: 0.05 * g, a: 0.001, d: 0.03, filt: { type: 'highpass', f: 2800 }, drive: 0.4 });
  T({ pos, at: at + dur * 0.82, type: 'sine', f: 120, f2: 55, g: 0.07 * g, d: 0.1 });
  crackle(pos, dark ? 4 : 2, dur * 0.6, 0.03 * g, at);
  if (kind === 'staff') retractFull('niman', { pos, at: at + 0.05, g: 0.55 * (o.g ?? 1) });
}

/* a form change: the blade drops and lights again in its new form's colour (fx/trail.js reigniteBlade) */
export function reignite(kind, from){
  retract(from || 'niman', { short: true, g: 0.75 });
  ignite(kind, { at: 0.085, g: 0.85 });
}

/* ---------- swing ---------- */

/* a lightsaber whoosh: the hum's pitch bending up through the arc ("vwoom"), a doppler pass as the blade goes by, and
   moving air. p scales the pitch (fast forms lighter and higher, Djem So heavier, the Darksaber deep and gritty).
   No two strokes match: the length, the bend and where it peaks, the air's band and a blade tremble all vary. */
export function swing(p, len, dark, o = {}){
  const pos = o.pos, at = o.at || 0, air = o.air ?? 1, gain = o.g ?? 1;
  p *= rand(0.96, 1.04); len *= rand(0.88, 1.12);
  const d = 0.2 * len, rise = rand(1.5, 1.95), ft = d * rand(0.4, 0.7);
  const vib = Math.random() < 0.4 ? { r: rand(15, 26), d: rand(16, 32) } : undefined;   // the blade trembling through the cut
  T({ pos, at, type: 'sawtooth', f: 96 * p, f2: 96 * p * rise, ft, g: 0.068 * gain, a: 0.03, d, det: rand(4, 12), vib,
      filt: { type: 'lowpass', f: 550, f2: rand(2100, 3000), t: d * 0.5 }, drive: dark ? 0.45 : o.drive || 0, verb: 0.1 });
  T({ pos, at, type: 'sawtooth', f: 97.5 * p, f2: 97.5 * p * rise * 0.94, ft, g: 0.045 * gain, a: 0.03, d, filt: { type: 'lowpass', f: 900, f2: 2000 } });
  // the doppler pass: an octave up, swelling in and falling away as the blade sweeps by
  T({ pos, at: at + d * 0.12, type: 'sine', f: 192 * p * rise, f2: 150 * p, g: 0.028 * gain, a: d * 0.35, d: d * 0.65, pri: 0 });
  N({ pos, at, color: 'pink', g: 0.085 * air * gain, a: 0.05 * len, d: 0.16 * len, rate: rand(0.85, 1.15),
      filt: { type: 'bandpass', f: rand(380, 520), f2: rand(1600, 2300), q: 1.3 } });
  if (dark) crackle(pos, 2, d, 0.03 * gain, at);   // the Darksaber spits as it cuts
}
export function formSwing(v, pos){
  swing(v.p, v.len, false, { pos, air: v.air, drive: v.drive });
  if (v.flick) swing(v.p * 1.12, v.len * 0.55, false, { pos, at: 0.09, air: 0.8, g: 0.6 });
}

/* ---------- contact ---------- */

/* the saber meeting flesh/armour: a scorching sizzle over a dull thump, then the sear hissing away */
export function burn(pos, pw){
  N({ pos, g: 0.08 * pw, a: 0.002, d: 0.14 + pw * 0.05, filt: { type: 'highpass', f: 2600 }, drive: 0.55, pri: 2 });
  N({ pos, g: 0.045, d: 0.26, rate: 0.55, filt: { type: 'bandpass', f: rand(4600, 5800), q: 3 } });
  N({ pos, g: 0.04 * pw, a: 0.006, d: 0.3 + pw * 0.1, filt: { type: 'bandpass', f: rand(6500, 8200), f2: 2400, q: 1.4 }, pri: 0 });
  T({ pos, type: 'sine', f: 150, f2: 45, g: 0.16 * pw, d: 0.12 });
  T({ pos, type: 'sawtooth', f: 220, f2: 80, g: 0.06, d: 0.1, filt: { type: 'lowpass', f: 1600 } });
  crackle(pos, 2, 0.16, 0.03);
}

/* BLADE ON BLADE — "KCHHH-ZZZing!": a heavy, explosive strike. A deep punchy thud and a violent high-voltage pop land
   together, a gritty "kchhh" tears off them, then as the blades part a bright, ringing harmonic resonance sings out
   (a super-heated sword struck: whole-number partials through a resonant band sweeping up, never a clanking bell) and
   dissolves into a brief crackling static hiss. Voiced by form: FORM_SOUND ring = how high it sings, damp = how long
   (Soresu soaks a blow dead, Djem So's rings on); a big hit (a parry, a bind) is heavier all through. */
export function clash(pos, big, form){
  form = form || (!isGunner() ? G.stance : null);   // (no form named: the hero's own blade)
  const k = big ? 1.35 : 1, v = FORM_SOUND[form] || FORM_SOUND.niman, r = v.ring * rand(0.95, 1.05), dm = v.damp;
  // the thud: weight under the blow
  T({ pos, type: 'sine', f: 120 * rand(0.92, 1.08), f2: 40, g: 0.2 * k, a: 0.002, d: 0.17 * k, pri: 2 });
  N({ pos, color: 'brown', g: 0.13 * k, a: 0.001, d: 0.09, filt: { type: 'lowpass', f: 520 } });
  // the pop: a violent electrical discharge, and the "kchhh" tearing off it
  N({ pos, g: 0.16 * k, a: 0.0008, d: 0.035, filt: { type: 'bandpass', f: 2600 * r, q: 0.6 }, drive: 0.95, pri: 2 });
  N({ pos, g: 0.075 * k, a: 0.002, d: 0.13 * k, rate: rand(0.5, 0.75), filt: { type: 'bandpass', f: 4200 * r, f2: 1800, q: 0.7 }, drive: 0.85 });
  if (tooSoon('clashring', 0.03)) return;   // a flurry of blocks in one frame: one ring between them
  // "ZZZing": the blades parting. A buzzing saw an octave down gives it the electric edge; over it the struck blade sings
  const f = rand(560, 640) * r, at = 0.03, ring = 0.34 * dm * (big ? 1.25 : 1);
  T({ pos, at, type: 'sawtooth', f: f * 0.5, f2: f * 0.42, g: 0.04 * k, a: 0.004, d: ring * 0.6, fm: { r: 3, i: 1.2, i2: 0.1 },
      filt: { type: 'bandpass', f: 1600, f2: 3000, q: 1.6 }, drive: 0.5 });
  T({ pos, at, type: 'sawtooth', f, f2: f * 1.04, g: 0.045 * k, a: 0.006, d: ring, vib: { r: rand(24, 32), d: 22 },
      filt: { type: 'bandpass', f: 2400 * r, f2: 5200 * r, q: 6, t: ring * 0.5 }, verb: 0.22, pri: 2 });
  T({ pos, at, type: 'sine', f: f * 4, g: 0.022 * k, a: 0.004, d: ring * 0.7, vib: { r: 29, d: 18 }, verb: 0.2 });
  // ...dissolving into static
  N({ pos, at: 0.07, g: 0.04 * k, a: 0.02, d: 0.28 * dm, filt: { type: 'highpass', f: 4800 }, drive: 0.4, pri: 0 });
  crackle(pos, big ? 7 : 4, 0.32 * dm, 0.04 * k, 0.06);
}

/* blade dragged through a wall or a pillar. first = the moment it bites in (a crack and a buzz); after that a
   sizzling scrape keeps hissing while the blade stays in the stone */
export function wall(pos, first, dark){
  if (first){
    N({ pos, g: 0.09, a: 0.001, d: 0.05, filt: { type: 'highpass', f: 2000 }, drive: 0.7, pri: 2 });
    T({ pos, type: 'sawtooth', f: rand(110, 140) * (dark ? 0.7 : 1), f2: 60, g: 0.05, d: 0.16, fm: { r: 3.7, i: 2, i2: 0.1 },
        filt: { type: 'bandpass', f: 1400, q: 1.2 }, drive: 0.5 });
  }
  N({ pos, g: first ? 0.06 : 0.035, a: 0.01, d: 0.16, filt: { type: 'bandpass', f: rand(3500, 6000), f2: rand(1800, 2600), q: 1.2 }, drive: 0.4, pri: first ? 1 : 0 });
  crackle(pos, 2, 0.12, 0.025);
}

/* A BOLT DEFLECTED — "PZINGTT!" / "KRYZZ-ZING!": light, ultra-fast and percussive. A sharp, instantaneous electrical
   whip-crack and a high metallic ping as the super-heated bolt is flung off the blade's field, a ricochet zing tearing
   away, and a tiny electrical sizzle at the tail. All over in a fifth of a second. */
export function deflect(pos){
  const b = rand(0.92, 1.1);
  // the whip-crack: a hard snap of driven noise and a click
  N({ pos, g: 0.17, a: 0.0006, d: 0.018, filt: { type: 'highpass', f: 2600 }, drive: 0.95, pri: 2 });
  T({ pos, type: 'square', f: 3200 * b, f2: 900, g: 0.04, a: 0.0006, d: 0.02, filt: { type: 'lowpass', f: 9000 } });
  // the ping: a bright, very short harmonic tone (high, clean and gone at once; no bell body under it)
  T({ pos, type: 'sine', f: 3900 * b, f2: 3600 * b, g: 0.05, a: 0.0015, d: 0.075, fm: { r: 2, i: 0.5, i2: 0.02 }, verb: 0.15, pri: 2 });
  // the zing: the bolt torn round and flung off, falling fast
  T({ pos, type: 'sawtooth', f: 4600 * b, f2: 1300 * b, ft: 0.07, g: 0.035, a: 0.002, d: 0.09, filt: { type: 'bandpass', f: 4200, f2: 1600, q: 3.5 } });
  // the tiny sizzle at the tail
  N({ pos, at: 0.035, g: 0.022, a: 0.01, d: 0.12, filt: { type: 'bandpass', f: 6500, f2: 3500, q: 1.2 }, drive: 0.4, pri: 0 });
  crackle(pos, 2, 0.1, 0.022, 0.04);
}

/* BLADE LOCK — "KRRRZZZZ-SZS-SNAP!": the held bind itself is a loop in director.js (LOCK_GRIND there), fed by
   BLADE_AUDIO.lock; these are its one-shots. arc: one of the aggressive electric arcs that spit out of it at random
   (big = a surge bearing down, or a press of yours heaving the blade); snap: the bind breaking apart. */
export function lockArc(pos, big){
  const k = big ? 1.4 : 1;
  N({ pos, g: 0.08 * k, a: 0.001, d: 0.03, filt: { type: 'bandpass', f: rand(1800, 4200), q: 0.8 }, drive: 0.9, pri: big ? 2 : 0 });
  T({ pos, type: 'sawtooth', f: rand(90, 160), f2: rand(50, 70), g: 0.05 * k, a: 0.002, d: rand(0.06, 0.12) * k,
      fm: { r: rand(2.2, 3.6), i: 7, i2: 1 }, filt: { type: 'bandpass', f: rand(900, 1700), q: 0.9 }, drive: 0.8, pri: big ? 1 : 0 });
  if (big){ T({ pos, type: 'sine', f: 80, f2: 38, g: 0.14, d: 0.22 }); crackle(pos, 4, 0.2, 0.04); }
}
export function lockSnap(pos){
  N({ pos, g: 0.15, a: 0.0006, d: 0.03, filt: { type: 'highpass', f: 1800 }, drive: 0.95, pri: 2 });
  T({ pos, type: 'sawtooth', f: 260, f2: 60, g: 0.06, a: 0.001, d: 0.12, fm: { r: 2.7, i: 4, i2: 0.2 }, filt: { type: 'bandpass', f: 1800, q: 0.9 }, drive: 0.7 });
  crackle(pos, 4, 0.18, 0.035, 0.02);
}

/* a PERFECT parry: a big impact that flares, the hum surging up through it and a long spitting shower */
export function parryFlare(pos){
  T({ pos, type: 'sawtooth', f: 90, f2: 170, ft: 0.12, g: 0.06, a: 0.01, hold: 0.06, d: 0.5, det: 9,
      filt: { type: 'lowpass', f: 900, f2: 4200, t: 0.15 }, drive: 0.25, verb: 0.35 });
  N({ pos, color: 'pink', g: 0.05, a: 0.02, d: 0.55, filt: { type: 'bandpass', f: 2200, f2: 6000, q: 1 }, verb: 0.3 });
  crackle(pos, 6, 0.6, 0.04, 0.08);
}
