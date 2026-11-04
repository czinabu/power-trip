// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIGHTSABER SOUND: every one-shot a blade makes, all synthesized (no recordings, nothing borrowed from a film or a game).
//   ignite / retract   the snap-hiss: a crack, the blade running up (or sucking back) through a filter that flares open,
//                      voiced by the form's group (Guard smooth, Speed snappy, Power roaring, Niman an airy shimmer)
//                      (full: the showpiece version, for the ignite / retract key and a draw from the belt)
//   swing              the "vwoom": the hum bending up through the arc, a doppler pass, moving air; every stroke different
//   clash              blade on blade, in four layers: a crack, a sub thump, a plasma sizzle and a hum tail, glued on one bus
//   burn               blade through a body: a scorching sear over a dull thump
//   wall               blade dragged through stone or metal: a sizzling scrape that spits sparks
//   deflect            a bolt batted away: the same sound as a clash (the hum shorting out, a blaster "pyew" off it)
// The held hum (the loop that bends with the blade's real tip speed) lives in director.js and uses HUM_PITCH below.

import { play, tooSoon, duck, place } from './engine.js';
import { G, isGunner, shared } from '../state.js';
import { rand } from '../utils.js';
import { FORM_FAMILY } from '../data/foe-forms.js';

const N = o => play(Object.assign({ src: 'noise' }, o));
const T = o => play(o);

/* the hum's pitch by form: lighter forms ride higher; the Darksaber sits far under all of them */
/* every lightsaber sounds this much lower than its recipe (Caleb, 2026-11-04: "too high"): about 3 semitones down. It
   scales the hum, the ignite and retract, the swings and the clashes, for every blade (the Darksaber too). */
export const SABER_PITCH = 0.84;
const HUM_BASE = { shiicho: 0.92, makashi: 1.06, soresu: 0.96, ataru: 1.1, niman: 1, djemso: 0.86, shien: 0.92, juyo: 1.04, vaapad: 0.9, staff: 1.08, jarkai: 1.12, dark: 0.69 };
export const HUM_PITCH = Object.fromEntries(Object.entries(HUM_BASE).map(([k, v]) => [k, v * SABER_PITCH]));

/* what every lit blade is doing this frame, filled in by fx/trail.js (which already follows every blade for its streak)
   and read by director.js: tip speeds (m/s against the owner's body) of the hero's blade, the saber staff's far end and
   the Darksaber in hand, and every other lit blade (its tip in the world, speed, dark, thrown) */
export const BLADE_AUDIO = { hero: 0, hero2: 0, dark: 0, others: [], lock: null, hduck: -1, charge: 0, chargeAt: -1 };   // lock: the hero's saber lock, set by enemies/duel.js; hduck: when a deflect last dipped the hum (audio time); charge: a heavy cut's draw 0..1 (player/jedi/weight.js), chargeAt: when it was last set (G.gt)

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
  jarkai:  { p: 1.12, len: 0.75, air: 1.15, ring: 1.08, damp: 1.05, flick: true },   // Jar'Kai: two short, bright swishes, one hand then the other
};

/* the spitting of a plasma blade: a scatter of tiny bright ticks over `spread` seconds (cheap: each is one short voice,
   and the lowest priority, so a crowded fight drops them first) */
function crackle(pos, n, spread, g, at0 = 0){
  for (let i = 0; i < n; i++)
    N({ pos, at: at0 + rand(0, spread), g: g * rand(0.5, 1), a: 0.001, d: rand(0.008, 0.024), filt: { type: 'highpass', f: rand(2600, 6500) }, drive: 0.5, pri: 0, jit: 0.2 });
}

/* ---------- ignite / retract ---------- */

/* EACH FORM GROUP'S IGNITION — the snap-hiss tells you which family you just lit (data/foe-forms.js FORM_FAMILY), so a
   form change is heard as well as seen. One recipe per group, the same in every mode, for the hero, a partner and a foe:
     guard  (Shii-Cho, Soresu, Shien)            smooth and composed: a slower, clean gas-burner hiss locking into a
            low ~100 Hz hum, no pops or crackle; it retracts in a clean suction ending on a heavy magnetic latch
     speed  (Makashi, Ataru, Jar'Kai, staff)     a whip-crack and a compressed-air snap that peaks inside 0.1 s and
            drops into a tight, high (200–250 Hz) turbine purr; it retracts in one instant pneumatic snap
     power  (Djem So, Juyo, Vaapad)              a roaring burst that tears the air: arc-welder snaps, a low blast and a
            gritty saw roar with white noise flickering through it; it retracts in a long crackling burn-off
     niman  (and any blade with no form)         the hilt's snap almost gone: an airy, shimmering bloom; it retracts
            in a soft wind-like fade
   The Darksaber keeps its own deep, buzzing voice. Every recipe is built on the same base voices (the snap, the run-up,
   the edge zinging out, the hiss), each scaled by the group's profile, with the group's own layers on top.
     crack  the hilt's snap   rise  how long the run-up takes   bright  how far the filter flares
     crackle  how much it spits   drive  added grit   len  how long a retract takes */
const IGNITE_FAMILY = {
  guard: { crack: 0.35, rise: 1.3, bright: 0.7,  crackle: 0,   drive: 0,    len: 1.15 },
  speed: { crack: 1.25, rise: 0.55, bright: 1.15, crackle: 0.4, drive: 0,    len: 0.45 },
  power: { crack: 1.2, rise: 1.05, bright: 1,    crackle: 2.6, drive: 0.35, len: 1.45 },
  niman: { crack: 0.15, rise: 1.2, bright: 0.85, crackle: 0,   drive: 0,    len: 1.2 },
  dark:  { crack: 1,   rise: 1,    bright: 1,    crackle: 1,   drive: 0,    len: 1 },
};
const familyOf = kind => kind === 'dark' ? 'dark' : FORM_FAMILY[kind] || 'niman';

/* the group's own layers over the base snap-hiss. full: the showpiece (5, a draw from the belt), a touch bigger */
function igniteLayers(fam, kind, pos, at, g, full){
  const p = HUM_PITCH[kind] || SABER_PITCH, k = full ? 1.15 : 1;
  if (fam === 'guard'){
    // a clean gas-burner hiss, smooth in and out, and a low hum swelling up to lock the blade in place
    N({ pos, at: at + 0.01, color: 'pink', g: 0.06 * g * k, a: 0.09, hold: 0.05, d: 0.45 * k, filt: { type: 'bandpass', f: 1500, f2: 900, q: 0.7 }, pri: 1 });
    T({ pos, at: at + 0.06, type: 'sine', f: 100 * p, g: 0.09 * g * k, a: 0.16, hold: 0.08, d: 0.55 * k, vib: { r: 3.5, d: 6 }, panK: 0.4 });
    T({ pos, at: at + 0.06, type: 'triangle', f: 200 * p, g: 0.025 * g * k, a: 0.16, d: 0.45 * k, filt: { type: 'lowpass', f: 700 } });
  } else if (fam === 'speed'){
    // the whip-crack click and a compressed-air burst, then a tight high purr spinning like a turbine
    N({ pos, at, g: 0.12 * g, a: 0.0006, d: 0.012, filt: { type: 'highpass', f: 3000 }, drive: 0.95, pri: 2 });
    T({ pos, at, type: 'square', f: 3400, f2: 1100, g: 0.03 * g, a: 0.0006, d: 0.016, filt: { type: 'lowpass', f: 8000 } });
    N({ pos, at: at + 0.004, g: 0.08 * g * k, a: 0.003, d: 0.07, filt: { type: 'bandpass', f: 3200, f2: 1400, q: 1.1 }, drive: 0.3 });
    T({ pos, at: at + 0.05, type: 'sawtooth', f: 225 * p, f2: 235 * p, g: 0.03 * g * k, a: 0.02, d: 0.32 * k, vib: { r: 44, d: 16 },
        filt: { type: 'bandpass', f: 900, q: 1.6 } });
  } else if (fam === 'power'){
    // arc-welder snaps tearing out of it, a low blast, a gritty saw roar, and white noise flickering through it all
    for (let i = 0; i < (full ? 4 : 3); i++)
      T({ pos, at: at + rand(0, 0.16), type: 'sawtooth', f: rand(110, 190), f2: rand(50, 70), g: 0.04 * g, a: 0.001, d: rand(0.04, 0.08),
          fm: { r: rand(2.2, 3.6), i: 6, i2: 1 }, filt: { type: 'bandpass', f: rand(1200, 2600), q: 0.9 }, drive: 0.85, pri: 0 });
    T({ pos, at, type: 'sine', f: 95, f2: 34, g: 0.18 * g * k, a: 0.002, d: 0.3, panK: 0.3, pri: 2 });
    N({ pos, at, color: 'brown', g: 0.14 * g * k, a: 0.002, d: 0.22, filt: { type: 'lowpass', f: 320 }, drive: 0.4, panK: 0.4 });
    T({ pos, at: at + 0.02, type: 'sawtooth', f: 52 * p, f2: 78 * p, ft: 0.2, g: 0.07 * g * k, a: 0.02, hold: 0.06, d: 0.55 * k, det: 14,
        filt: { type: 'lowpass', f: 2200, f2: 500, t: 0.5 }, drive: 0.7, verb: 0.2, pri: 1 });
    N({ pos, at: at + 0.04, g: 0.035 * g * k, a: 0.03, d: 0.5 * k, trem: { r: rand(11, 16), d: 0.85, type: 'square' }, filt: { type: 'highpass', f: 2400 }, pri: 0 });
  } else if (fam === 'niman'){
    // an airy shimmer blooming open
    N({ pos, at, color: 'pink', g: 0.07 * g * k, a: 0.12, d: 0.55 * k, trem: { r: 6, d: 0.35 }, filt: { type: 'bandpass', f: 1800, f2: 6000, q: 0.9, t: 0.4 }, verb: 0.3, pri: 1 });
  }
}
function retractLayers(fam, kind, pos, at, g, dur, full){
  const k = full ? 1.15 : 1;
  if (fam === 'guard'){
    // the heavy magnetic latch as the hilt seals: a low thunk and a click
    T({ pos, at: at + dur * 0.9, type: 'sine', f: 110, f2: 50, g: 0.1 * g * k, a: 0.001, d: 0.12, panK: 0.4 });
    N({ pos, at: at + dur * 0.9, g: 0.04 * g, a: 0.0008, d: 0.02, filt: { type: 'bandpass', f: 2400, q: 1.5 } });
  } else if (fam === 'speed'){
    // one instant pneumatic snap and it's gone
    N({ pos, at: at + dur * 0.7, g: 0.09 * g * k, a: 0.0008, d: 0.03, filt: { type: 'bandpass', f: 3600, q: 0.9 }, drive: 0.6, pri: 2 });
    N({ pos, at, g: 0.04 * g, a: 0.01, d: dur * 0.7, filt: { type: 'bandpass', f: 2200, f2: 5200, q: 1.2 } });
  } else if (fam === 'power'){
    // the blade burning off: arcing that crackles on and fades, a sizzle hanging in the air after it
    crackle(pos, full ? 10 : 7, dur * 1.3, 0.035 * g, at);
    for (let i = 0; i < 2; i++)
      T({ pos, at: at + rand(0.05, dur), type: 'sawtooth', f: rand(100, 160), f2: rand(50, 70), g: 0.03 * g, a: 0.001, d: rand(0.05, 0.1),
          fm: { r: rand(2.2, 3.6), i: 6, i2: 1 }, filt: { type: 'bandpass', f: rand(1000, 2000), q: 0.9 }, drive: 0.8, pri: 0 });
    N({ pos, at: at + dur * 0.6, g: 0.03 * g * k, a: 0.05, d: 0.55, trem: { r: rand(14, 20), d: 0.7, type: 'square' }, filt: { type: 'highpass', f: 4000 }, drive: 0.3, pri: 0 });
  } else if (fam === 'niman'){
    // a soft wind dissolving into the hilt
    N({ pos, at, color: 'pink', g: 0.05 * g * k, a: dur * 0.3, d: dur * 0.9, filt: { type: 'lowpass', f: 2400, f2: 400, q: 0.6, t: dur }, pri: 1 });
  }
}

/* the snap-hiss of a blade lighting. kind: a form id, 'staff' (both ends, the far one a beat behind) or 'dark'
   (o.second: the staff's far end, or Jar'Kai's second saber: the base snap-hiss only, its group's layers already sounded) */
export function ignite(kind, o = {}){
  if (o.full) return igniteFull(kind, o);
  const dark = kind === 'dark', p = HUM_PITCH[kind] || SABER_PITCH, pos = o.pos, at = o.at || 0, g = (o.g ?? 1) * 0.75;
  const fam = familyOf(kind), F = IGNITE_FAMILY[fam], ri = F.rise;
  // the snap: a hard electric crack and a knock of air off the emitter
  N({ pos, at, g: 0.1 * g * F.crack, a: 0.001, d: 0.05, filt: { type: 'highpass', f: 2400 }, drive: 0.7, pri: 2 });
  T({ pos, at, type: 'sine', f: 160, f2: 52, g: 0.13 * g * Math.max(0.4, F.crack), d: 0.17 });
  // the blade running up: a saw climbing into the hum's pitch, bright at the flare and darkening as it settles
  T({ pos, at, type: 'sawtooth', f: 46 * p, f2: 90 * p, ft: 0.17 * ri, g: 0.1 * g, a: 0.006, d: 0.6 * ri, det: 7,
      filt: { type: 'lowpass', f: (dark ? 2600 : 5200) * F.bright, f2: 420, t: 0.5 * ri }, drive: (dark ? 0.5 : 0.15) + F.drive, verb: 0.2, pri: 2 });
  T({ pos, at, type: 'sawtooth', f: 46.6 * p, f2: 91 * p, ft: 0.17 * ri, g: 0.06 * g, a: 0.006, d: 0.45 * ri, det: -9, filt: { type: 'lowpass', f: 3000 * F.bright, f2: 380 } });
  // the "zhing" of the blade's edge shooting out to its tip: a narrow band sweeping up
  T({ pos, at: at + 0.01, type: 'sawtooth', f: 180 * p, f2: 300 * p, g: 0.045 * g, a: 0.01, d: 0.22 * ri,
      filt: { type: 'bandpass', f: dark ? 500 : 700, f2: (dark ? 2200 : 4200) * F.bright, q: 3.5, t: 0.16 * ri } });
  // the hiss of the plasma catching, and its first spits
  N({ pos, at, color: 'pink', g: 0.07 * g, a: 0.012 * ri, d: 0.26 * ri, filt: { type: 'bandpass', f: 1300, f2: (dark ? 2400 : 4600) * F.bright, q: 1 } });
  if (F.crackle) crackle(pos, Math.round((dark ? 5 : 3) * F.crackle), 0.22 * ri, 0.04 * g, at + 0.02);
  if (o.second) return;
  igniteLayers(fam, kind, pos, at, g, false);
  if (kind === 'staff') ignite('staff', { pos, at: at + 0.075, g: 0.8 * g, second: true });   // the far blade answers a beat behind
  if (kind === 'jarkai') ignite('jarkai', { pos, at: at + 0.12, g: 0.85 * g, second: true });   // Jar'Kai: the second saber lights from the other hand
}

/* a blade going out: the hum sucking back down into the hilt, the hiss closing, a last pop */
export function retract(kind, o = {}){
  if (o.full) return retractFull(kind, o);
  const dark = kind === 'dark', p = HUM_PITCH[kind] || SABER_PITCH, pos = o.pos, at = o.at || 0, g = o.g ?? 1;
  const fam = familyOf(kind), F = IGNITE_FAMILY[fam], dur = (o.short ? 0.18 : 0.32) * F.len;
  T({ pos, at, type: 'sawtooth', f: 92 * p, f2: 36 * p, ft: dur * 0.9, g: 0.09 * g, a: 0.008, d: dur, det: 6,
      filt: { type: 'lowpass', f: (dark ? 1600 : 2600) * F.bright, f2: 180 }, drive: (dark ? 0.45 : 0.1) + F.drive, verb: 0.15, pri: 2 });
  T({ pos, at, type: 'sawtooth', f: 280 * p, f2: 110 * p, g: 0.035 * g, a: 0.006, d: dur * 0.8,
      filt: { type: 'bandpass', f: (dark ? 1800 : 3400) * F.bright, f2: 450, q: 3 } });
  N({ pos, at, color: 'pink', g: 0.05 * g, a: 0.015, d: dur * 0.75, filt: { type: 'bandpass', f: 2800, f2: 600, q: 1 } });
  N({ pos, at: at + dur * 0.85, g: 0.03 * g * F.crack, a: 0.001, d: 0.025, filt: { type: 'highpass', f: 3000 } });   // the emitter's last pop
  if (o.second) return;
  retractLayers(fam, kind, pos, at, g, dur, false);
  if (kind === 'staff') retract('staff', { pos, at: at + 0.05, g: 0.55 * g, short: o.short, second: true });
  if (kind === 'jarkai') retract('jarkai', { pos, at: at + 0.07, g: 0.6 * g, short: o.short, second: true });
}

/* THE SHOWPIECE snap-hiss and fade-out, for a blade lit or put out on purpose (5, a draw from the belt): the quick ones
   above stay for a form change. Built on the same voices, longer and fuller so it reads as the moment it is, and voiced
   by the form's group the same way (IGNITE_FAMILY).
   ignite: the emitter's crack and a knock of air, a "kssh" of plasma catching, the blade roaring up through a filter
     that flares wide open as it reaches the tip, a bright edge zinging out with it, then a swell of hum with a slow
     waver that settles into the held hum (director.js) instead of stopping dead
   retract: the hum rises a hair as the blade lets go, then the whole tone sinks into the hilt through a closing
     filter, a hiss drawn in after it (a slow swell cut off sharp, so it sounds pulled back rather than blown out), and
     the emitter's click and a soft thud as it seals */
function igniteFull(kind, o){
  const dark = kind === 'dark', p = HUM_PITCH[kind] || SABER_PITCH, pos = o.pos, at = o.at || 0, g = (o.g ?? 1) * 0.75;   // (rendered: ~2x a swing at its peak was too forward; now ~1.6x)
  const fam = familyOf(kind), F = IGNITE_FAMILY[fam], ri = F.rise, br = F.bright;
  // the crack and the knock of air
  N({ pos, at, g: 0.13 * g * F.crack, a: 0.001, d: 0.06, filt: { type: 'highpass', f: 2200 }, drive: 0.8, pri: 2 });
  T({ pos, at, type: 'sine', f: 180, f2: 48, g: 0.16 * g * Math.max(0.4, F.crack), d: 0.2, pri: 2 });
  // "kssh": the plasma catching, a burst of hiss that brightens fast and trails off
  N({ pos, at: at + 0.005, color: 'pink', g: 0.1 * g, a: 0.008 * ri, d: 0.42 * ri, filt: { type: 'bandpass', f: 900, f2: (dark ? 2600 : 5200) * br, q: 0.9, t: 0.14 * ri }, verb: 0.15, pri: 2 });
  // the blade running up: two detuned saws climbing from a growl into the hum's pitch through a filter that flares open
  // at the tip (~0.13 s) and closes back to the hum's darkness as it settles
  for (const [det, gg, f0] of [[8, 0.12, 40], [-11, 0.075, 40.6]])
    T({ pos, at, type: 'sawtooth', f: f0 * p, f2: 90 * p, ft: 0.16 * ri, g: gg * g, a: 0.012, hold: 0.06 * ri, d: 0.8 * ri, det,
        filt: { type: 'lowpass', f: (dark ? 3200 : 6400) * br, f2: 380, t: 0.7 * ri }, drive: (dark ? 0.55 : 0.2) + F.drive, verb: 0.25, pri: 2 });
  // the run-up said an octave and more higher, where a small speaker can carry it: the climb you hear as the blade
  // grows (the fundamental alone sits too low to read on a laptop)
  T({ pos, at, type: 'sawtooth', f: 85 * p, f2: 200 * p, ft: 0.22 * ri, g: 0.045 * g, a: 0.01, d: 0.4 * ri, det: 5,
      filt: { type: 'bandpass', f: 500, f2: 1400 * br, q: 1.4, t: 0.22 * ri } });
  // the edge zinging out to the tip and ringing a moment once it's there
  T({ pos, at: at + 0.012, type: 'sawtooth', f: 170 * p, f2: 360 * p, ft: 0.15 * ri, g: 0.05 * g, a: 0.01, d: 0.32 * ri, vib: { r: 7, d: 14 },
      filt: { type: 'bandpass', f: dark ? 450 : 650, f2: (dark ? 2400 : 4800) * br, q: 4, t: 0.15 * ri }, verb: 0.2 });
  // the hum swelling in under it all with a slow waver, handing over to the held loop
  T({ pos, at: at + 0.1 * ri, type: 'sawtooth', f: 90 * p, g: 0.05 * g, a: 0.12 * ri, hold: 0.12, d: 0.55, det: 4, vib: { r: 4.5, d: 18 },
      filt: { type: 'lowpass', f: 900, f2: 420, t: 0.6 }, drive: (dark ? 0.4 : 0.1) + F.drive });
  T({ pos, at: at + 0.06, type: 'sine', f: 45 * p, g: 0.08 * g, a: 0.08, d: 0.6 });   // the body of it, felt more than heard
  if (F.crackle) crackle(pos, Math.round((dark ? 8 : 5) * F.crackle), 0.4 * ri, 0.045 * g, at + 0.02);
  if (o.second) return;
  igniteLayers(fam, kind, pos, at, g, true);
  if (kind === 'staff') igniteFull('staff', { pos, at: at + 0.09, g: 0.7 * (o.g ?? 1), second: true });   // the far blade a beat behind
  if (kind === 'jarkai') igniteFull('jarkai', { pos, at: at + 0.14, g: 0.75 * (o.g ?? 1), second: true });   // the second saber from the other hand
}
function retractFull(kind, o){
  const dark = kind === 'dark', p = HUM_PITCH[kind] || SABER_PITCH, pos = o.pos, at = o.at || 0, g = (o.g ?? 1) * 0.9;
  const fam = familyOf(kind), F = IGNITE_FAMILY[fam], dur = 0.42 * F.len;
  // the hum lets go: up a hair, then sinking into the hilt as the filter closes
  for (const [det, gg] of [[7, 0.1], [-10, 0.06]])
    T({ pos, at, type: 'sawtooth', f: 96 * p, f2: 30 * p, ft: dur, g: gg * g, a: 0.02, hold: 0.04, d: dur, det,
        filt: { type: 'lowpass', f: (dark ? 1800 : 3200) * F.bright, f2: 140, t: dur }, drive: (dark ? 0.5 : 0.15) + F.drive, verb: 0.2, pri: 2 });
  T({ pos, at, type: 'sawtooth', f: 300 * p, f2: 95 * p, ft: dur * 0.8, g: 0.04 * g, a: 0.01, d: dur * 0.85, vib: { r: 9, d: 12 },
      filt: { type: 'bandpass', f: (dark ? 1900 : 3800) * F.bright, f2: 380, q: 3.5, t: dur * 0.8 } });
  // the hiss drawn in after it: a slow swell, cut off sharp at the hilt
  N({ pos, at, color: 'pink', g: 0.1 * g, a: dur * 0.75, d: 0.05, filt: { type: 'bandpass', f: 4200 * F.bright, f2: 700, q: 1.1, t: dur * 0.8 }, pri: 2 });
  // the emitter sealing: a click and a soft thud
  N({ pos, at: at + dur * 0.82, g: 0.05 * g * F.crack, a: 0.001, d: 0.03, filt: { type: 'highpass', f: 2800 }, drive: 0.4 });
  T({ pos, at: at + dur * 0.82, type: 'sine', f: 120, f2: 55, g: 0.07 * g, d: 0.1 });
  if (F.crackle) crackle(pos, Math.round((dark ? 4 : 2) * F.crackle), dur * 0.6, 0.03 * g, at);
  if (o.second) return;
  retractLayers(fam, kind, pos, at, g, dur, true);
  if (kind === 'staff') retractFull('staff', { pos, at: at + 0.05, g: 0.55 * (o.g ?? 1), second: true });
  if (kind === 'jarkai') retractFull('jarkai', { pos, at: at + 0.07, g: 0.6 * (o.g ?? 1), second: true });
}

/* a form change: the blade drops and lights again in its new form's colour (fx/trail.js reigniteBlade) */
export function reignite(kind, from){
  retract(from || 'niman', { short: true, g: 0.75 });
  ignite(kind, { at: 0.085, g: 0.85 });
}

/* ---------- swing ---------- */

/* A LIGHTSABER SWING, built the way the films' was: Ben Burtt played the hum (an idling projector motor and a broken
   TV's buzz) through a speaker and swung a microphone past it. So a swing is the hum itself DOPPLER-SHIFTED by a pass:
   its pitch rises as the blade comes at you, peaks as it goes by and drops below rest as it leaves, while it swells
   and brightens with the mic's proximity, and a little air moves with it. Two voices carry the pass (the approach and
   the leaving), each of them the motor (two saws beating a hair apart) and the TV buzz (a band of buzzing harmonics).
   p scales the pitch (fast forms lighter and higher, Djem So heavier, the Darksaber deep and gritty). No two strokes
   match: the length, how hard it bends, where it peaks, the air's band and a blade tremble all vary.
   o.rise: the pass's peak pitch ratio (a heavy cut's charge sinks it below 1: chargeRelease) · o.fam: the form's group */
export function swing(p, len, dark, o = {}){
  const pos = o.pos, at = o.at || 0, air = o.air ?? 1, gain = o.g ?? 1, fam = o.fam;
  p *= rand(0.96, 1.04) * SABER_PITCH; len *= rand(0.88, 1.12);
  const d = 0.22 * len, mid = d * rand(0.4, 0.55);   // the pass: approaching until `mid`, leaving after
  // how hard it bends (how fast the blade passes the mic): Guard's barely moves, Niman's swells softly
  const rise = o.rise || (fam === 'guard' ? rand(1.06, 1.1) : fam === 'niman' ? rand(1.1, 1.16) : rand(1.16, 1.3));
  const fall = Math.min(rise, 1) * rand(0.84, 0.9);   // where it lands as the blade leaves, under the hum's rest pitch
  const top = fam === 'guard' ? rand(1300, 1600) : rand(2400, 3400);   // how bright it gets at the pass (Guard keeps the highs rolled off)
  const vib = Math.random() < 0.35 ? { r: rand(15, 26), d: rand(14, 28) } : undefined;   // the blade trembling through the cut
  const drv = dark ? 0.45 : o.drive || 0, body = fam === 'niman' ? 0.6 : 1, f0 = 92 * p;
  // the approach: rest pitch climbing to the peak, swelling in as it nears
  T({ pos, at, type: 'sawtooth', f: f0, f2: f0 * rise, ft: mid, g: 0.066 * gain * body, a: mid * 0.85, d: mid * 0.5, det: rand(4, 10), vib,
      filt: { type: 'lowpass', f: 500, f2: top, t: mid }, drive: drv, verb: 0.1 });
  T({ pos, at, type: 'sawtooth', f: f0 * 1.004, f2: f0 * rise * 1.004, ft: mid, g: 0.04 * gain * body, a: mid * 0.85, d: mid * 0.5, det: -6, filt: { type: 'lowpass', f: 800, f2: Math.min(2200, top) } });
  // the leaving: from the peak down under the rest pitch, darkening and fading as it goes away
  T({ pos, at: at + mid * 0.7, type: 'sawtooth', f: f0 * rise, f2: f0 * fall, ft: d - mid * 0.7, g: 0.066 * gain * body, a: mid * 0.3, d: d - mid * 0.6, det: rand(4, 10), vib,
      filt: { type: 'lowpass', f: top, f2: 420, t: d - mid * 0.6 }, drive: drv, verb: 0.12 });
  T({ pos, at: at + mid * 0.7, type: 'sawtooth', f: f0 * rise * 1.004, f2: f0 * fall * 1.004, ft: d - mid * 0.7, g: 0.04 * gain * body, a: mid * 0.3, d: d - mid * 0.6, det: -6,
      filt: { type: 'lowpass', f: Math.min(2200, top), f2: 500 } });
  // the TV buzz riding the same pass (its harmonics are what a small speaker hears bend): up, then away
  if (fam !== 'guard'){
    T({ pos, at, type: 'square', f: f0 * 2, f2: f0 * 2 * rise, ft: mid, g: 0.016 * gain, a: mid * 0.8, d: mid * 0.5, filt: { type: 'bandpass', f: 1500, f2: 2600, q: 1.8, t: mid }, drive: 0.4, pri: 0 });
    T({ pos, at: at + mid * 0.7, type: 'square', f: f0 * 2 * rise, f2: f0 * 2 * fall, ft: d - mid * 0.7, g: 0.016 * gain, a: mid * 0.3, d: d - mid * 0.6, filt: { type: 'bandpass', f: 2600, f2: 1200, q: 1.8 }, drive: 0.4, pri: 0 });
  }
  // the air it moves
  N({ pos, at, color: 'pink', g: 0.07 * air * gain, a: mid, d: d - mid * 0.5, rate: rand(0.85, 1.15),
      filt: { type: 'bandpass', f: rand(380, 520), f2: rand(1500, 2100) * (fam === 'guard' ? 0.5 : 1), q: 1.3, t: mid } });
  if (dark) crackle(pos, 2, d, 0.03 * gain, at);   // the Darksaber spits as it cuts
}
/* a form's swing (FORM_SOUND), with its group's colour on top (data/foe-forms.js FORM_FAMILY):
     guard  heavy, low "whoosh": a dense wall of air and a low body, the pitch barely bending, no highs
     speed  a laser-thin slice: a sharp, high doppler drop and high-passed air chopped by a fast LFO, cut off at once
     power  tearing: saturation and crackle that grow with the stroke's size (a heavy overhead crackles violently)
     niman  a smooth whisper of wind through a sweeping phaser-like band */
export function formSwing(v, pos, form, o = {}){
  const fam = FORM_FAMILY[form] || (form ? 'niman' : null), len = v.len * rand(0.9, 1.1);
  const drive = Math.max(fam === 'power' ? 0.35 + len * 0.3 : v.drive || 0, o.drive || 0);
  swing(v.p, v.len, false, { pos, air: v.air, drive, fam, rise: o.rise });
  if (v.flick) swing(v.p * 1.12, v.len * 0.55, false, { pos, at: 0.09, air: 0.8, g: 0.6, fam });
  const p = v.p, d = 0.2 * len;
  if (fam === 'guard'){
    N({ pos, color: 'brown', g: 0.09, a: d * 0.4, d: d * 0.9, filt: { type: 'bandpass', f: 180, f2: 420, q: 1, t: d * 0.5 } });
    T({ pos, type: 'triangle', f: 68 * p, f2: 80 * p, g: 0.05, a: d * 0.4, d: d * 0.8, panK: 0.5 });
  } else if (fam === 'speed'){
    T({ pos, at: d * 0.15, type: 'sawtooth', f: 520 * p, f2: 170 * p, ft: d * 0.45, g: 0.03, a: 0.006, d: d * 0.55, filt: { type: 'bandpass', f: 2600, f2: 900, q: 2.5 } });
    N({ pos, g: 0.045, a: 0.012, d: d * 0.6, trem: { r: rand(26, 36), d: 0.8 }, filt: { type: 'highpass', f: 4200 } });
  } else if (fam === 'power'){
    const big = len > 1.2;
    T({ pos, type: 'sawtooth', f: 70 * p, f2: 110 * p, ft: d * 0.5, g: 0.05 * len, a: 0.02, d, filt: { type: 'lowpass', f: 600, f2: 2200, t: d * 0.5 }, drive: 0.6 + len * 0.25 });
    crackle(pos, big ? 6 : 3, d, 0.04, 0.02);
    if (big) N({ pos, g: 0.04, a: 0.02, d: d * 1.2, trem: { r: rand(13, 19), d: 0.85, type: 'square' }, filt: { type: 'highpass', f: 2600 }, drive: 0.6 });
  } else if (fam === 'niman'){
    N({ pos, color: 'pink', g: 0.06, a: d * 0.5, d: d * 1.4, trem: { r: 7, d: 0.3 }, filt: { type: 'bandpass', f: 700, f2: 3200, q: 3.5, t: d }, verb: 0.35 });
    N({ pos, color: 'pink', g: 0.035, a: d * 0.5, d: d * 1.2, filt: { type: 'bandpass', f: 2800, f2: 900, q: 4, t: d }, verb: 0.35, pdrift: rand(-0.3, 0.3) });
  }
}

/* ---------- the heavy cut's charge (player/jedi/weight.js) ----------
   Holding the saber button draws a cut back into a heavy: a charge from 0 (a tap) to 1 (committed heavy). While it
   builds, a riser climbs with it and the room's air is stripped away (director.js, from BLADE_AUDIO.charge); the
   instant it's full, a crisp electrical snap says "now". When the cut goes, chargeRelease voices it on a sliding scale:
     charge  0 → 1   doppler bend  +3 → −5 semitones   (a light cut whips up, a heavy one sinks into a rumble)
                     saturation    clean → roaring and crackling
                     sub kick      none → a 50 Hz thump on the frame of release (heavy only)
                     tail          an instant cutoff → a low rumble of displaced air lingering ~1.5 s
   The form still voices the swing (FORM_SOUND, its group's colour); its group colours the riser (director.js). */
export function chargeFull(pos){
  N({ pos, g: 0.08, a: 0.0005, d: 0.012, filt: { type: 'highpass', f: 4200 }, drive: 0.9, pri: 2 });
  T({ pos, type: 'square', f: 5200, f2: 2600, g: 0.022, a: 0.0005, d: 0.02, filt: { type: 'highpass', f: 2400 }, pri: 2 });
  crackle(pos, 2, 0.04, 0.03);
}
export function chargeRelease(form, c, pos){
  c = Math.max(0, Math.min(1, c));
  const v = FORM_SOUND[form], semis = 3 - 8 * c, rise = Math.pow(2, semis / 12);
  if (v) formSwing(v, pos, form, { rise, drive: c * c * 0.85 });
  else swing(form === 'dark' ? 0.68 : 1, 1.2, form === 'dark', { pos, rise, drive: c * c * 0.85 });
  if (c < 0.5) return;
  const k = (c - 0.5) * 2;
  // the roar and crackle of a saturated blade, and the 50 Hz kick on the frame of release
  T({ pos, type: 'sawtooth', f: 62, f2: 48, g: 0.06 * k, a: 0.01, d: 0.4, filt: { type: 'lowpass', f: 1400, f2: 300 }, drive: 0.9 });
  crackle(pos, Math.round(3 + 4 * k), 0.35, 0.04);
  if (c >= 0.99){
    T({ pos, type: 'sine', f: 75, f2: 50, ft: 0.05, g: 0.3, a: 0.001, hold: 0.02, d: 0.2, panK: 0, pri: 2 });
    N({ pos, color: 'brown', g: 0.14, a: 0.001, d: 0.1, filt: { type: 'lowpass', f: 220 }, panK: 0 });
  }
  // the displaced air rumbling on after it (up to ~1.5 s)
  N({ pos, at: 0.05, color: 'brown', g: 0.09 * k, a: 0.08, hold: 0.1, d: 1.4 * k, filt: { type: 'lowpass', f: 380, f2: 90 }, panK: 0.3, verb: 0.2, pri: 0 });
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

/* BLADE ON BLADE, the way it sounds in the films: not a ring or a bang, but the blades' own hum SHORTING OUT. The two
   plasma fields meet and the hum (projector motor + TV buzz) surges into an overdriven, crackling electrical burst
   ("KSSHHZZT"), the arc buzzing at mains-like rates as it spits, then the sparks fizz away and the hum settles back.
     the arc      (0 s)    driven noise in the 1.5–4.5 kHz bite, chopped by a fast square tremolo so it BUZZES ("zzzt")
                           rather than hisses; a sharp crack on its leading edge
     the surge    (0 s)    the hum itself at the form's pitch, hard-overdriven and wide open, dropping a little in pitch
                           as the fields fight (the loud "BZZHH" body of the clash), with its TV buzz an octave up
     the weight   (0 s)    a short low thump under it, kept centred
     the "pyew"   (+0.01)  a blaster bolt's guy-wire chirp and its echoes (pyew), up front over the short
     the sparks   (+0.04)  a scatter of crackle and a fizz of high hiss dying away
   All on the clash bus (engine.js glue compressor). The form tunes the surge (its hum pitch) and how long the arc spits
   (FORM_SOUND damp: Soresu soaks a blow, Djem So's rages on). Each clash rolls its own pitch, level, length (a short spit to a long tear), arc rate and a
   slight pan drift, so a duel never repeats; a big hit (a parry, a bind) is heavier and longer all through. */
export function clash(pos, big, form){
  form = form || (!isGunner() ? G.stance : null);   // (no form named: the hero's own blade)
  const v = FORM_SOUND[form] || FORM_SOUND.niman, dm = v.damp, k = (big ? 1.3 : 1) * rand(0.86, 1.06);
  const hp = (HUM_PITCH[form] || SABER_PITCH) * rand(0.94, 1.06), len = (big ? 0.42 : 0.28) * Math.min(1.3, dm) * rand(0.65, 1.5);   // short spits to long tearing ones
  const drift = (Math.random() < 0.5 ? -1 : 1) * rand(0.06, 0.16), buzz = rand(55, 85);   // the arc's buzz rate (Hz)
  const C = o => play(Object.assign({ pos, bus: 'clash' }, o));
  const CN = o => C(Object.assign({ src: 'noise' }, o));
  if (!tooSoon('clashduck', 0.12)) duck(big ? 0.3 : 0.16, big ? 0.08 : 0.03);   // the score steps aside for the hit

  // the crack on the arc's leading edge
  CN({ g: 0.15 * k, a: 0.0006, d: 0.025, filt: { type: 'bandpass', f: rand(2600, 3400), q: 0.8 }, drive: 1, pri: 2 });
  // the arc: buzzing, tearing, its band sliding down as it dies
  CN({ g: 0.085 * k, a: 0.002, hold: len * 0.25, d: len, trem: { r: buzz, d: 0.9, type: 'square' },
       filt: { type: 'bandpass', f: rand(3600, 4400), f2: 1500, q: 0.8, t: len }, drive: 0.9, pdrift: drift, pri: 2 });
  // the surge: the hum overdriven and thrown wide open, sagging in pitch as the fields grind
  for (const [mul, det, g] of [[1, 6, 0.04], [1.004, -8, 0.027]])
    C({ type: 'sawtooth', f: 92 * hp * mul, f2: 80 * hp * mul, ft: len, g: g * k, a: 0.003, hold: len * 0.2, d: len * 0.9, det,
        filt: { type: 'lowpass', f: 4200, f2: 600, t: len }, drive: 1, pdrift: drift * 0.5, pri: 2 });
  // its TV buzz, an octave up, buzzing at the arc's rate
  C({ type: 'square', f: 184 * hp, f2: 162 * hp, ft: len, g: 0.03 * k, a: 0.003, d: len * 0.8, trem: { r: buzz, d: 0.6, type: 'square' },
      filt: { type: 'bandpass', f: 2200, f2: 1100, q: 1.4, t: len }, drive: 0.8, pdrift: drift * 0.5 });
  // the weight: a short low thump (a Djem So / Vaapad blow lands deeper)
  const sub = rand(70, 90) * (v.thump ? 0.85 : 1);
  C({ type: 'sine', f: sub * 1.5, f2: sub * 0.6, ft: 0.1, g: 0.17 * k, a: 0.0015, d: big ? 0.2 : 0.14, panK: 0.25, pri: 2 });
  CN({ color: 'brown', g: 0.08 * k, a: 0.001, d: 0.07, filt: { type: 'lowpass', f: 450 }, panK: 0.4 });

  // the blaster bolt's "PYEW" off the strike (the guy-wire chirp and its echoes, pyew below), up front in the mix, the
  // hero's hum dipping for it
  if (!tooSoon('clashpew', 0.06)){ BLADE_AUDIO.hduck = shared.AC ? shared.AC.currentTime : 0; pyew(pos, k * (big ? 1.6 : 1.4)); }
  if (tooSoon('clashring', 0.03)) return;   // a flurry of blocks in one frame: one shower of sparks between them
  // the sparks fizzing away
  CN({ at: 0.04, g: 0.035 * k, a: 0.01, d: len * 1.4 * dm, filt: { type: 'highpass', f: 5200 }, drive: 0.4, verb: 0.15, pri: 0 });
  crackle(pos, big ? 8 : 5, len * 1.3 * dm, 0.045 * k, 0.03);
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

/* the blaster's "PYEW" thrown off every clash and bolt deflect: the guy-wire's falling chirp and its echoes ringing
   back along the wire, then the last of it flying off across the stereo field. No two are alike: each rolls its own
   pitch (about half an octave either way, never too near the last one's), where its fall ends, how long it rings (a
   short zip to a long whining "pyeeew"), how far apart its echoes come and whether there are two or three of them */
let lastPew = 1;
function pyew(pos, k){
  const C = o => play(Object.assign({ pos, bus: 'clash' }, o));
  let b = rand(0.7, 1.35);
  for (let i = 0; i < 4 && Math.abs(b / lastPew - 1) < 0.08; i++) b = rand(0.7, 1.35);
  lastPew = b;
  const P = place(pos), p0 = P ? P.pan : 0, side = Math.abs(p0) > 0.15 ? Math.sign(p0) : (Math.random() < 0.5 ? -1 : 1);
  const drift = -side * rand(0.6, 1.1), tw = rand(0.09, 0.3), end = rand(220, 420), gap = tw * rand(0.25, 0.4);
  const echoes = Math.random() < 0.6 ? [[0, 1], [gap, 0.45], [gap * 2, 0.2]] : [[0, 1], [gap, 0.4]];
  for (const [echo, eg] of echoes)
    for (const [mul, rate, g, type] of [[1, 1, 0.05, 'triangle'], [1.33, 0.85, 0.028, 'sine'], [0.75, 1.15, 0.03, 'square']])
      C({ at: 0.01 + echo, type, f: 4600 * b * mul, f2: end * b * mul, ft: tw * rate, g: g * eg * k, a: 0.0012, d: tw * rate * 1.1,
          fm: { r: 0.5, i: 0.35, i2: 0.05 }, filt: { type: 'lowpass', f: 9000, f2: 1400, t: tw }, pdrift: drift * (0.4 + echo * 6),
          verb: 0.12, pri: echo ? 0 : 2 });
  // the bolt flying off: the last of it, panning away and dulling (a longer pyew trails off longer)
  const fly = 0.35 * tw / 0.155;
  T({ pos, at: 0.04, type: 'square', f: 900 * b, f2: 220 * b, ft: fly, g: 0.02 * k, a: 0.02, d: fly,
      filt: { type: 'lowpass', f: 3000, f2: 500 }, pdrift: drift, bus: 'clash', pri: 0 });
}

/* A BOLT DEFLECTED: the same sound as a blade clash (clash above: the hum shorting out in a buzzing, overdriven
   "KSSHHZZT", with the blaster's "PYEW" thrown off it). Ben Burtt's blaster is a hammer striking a radio tower's
   guy-wire, whose twanging dispersion makes a falling, springy chirp with quick echoes as it rings along the wire
   (pyew). Played on the hero's own blade, so its form tunes the hum's surge. */
export function deflect(pos){
  clash(pos, false, !isGunner() ? G.stance : null);
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

/* THE PERFECT-PARRY REWARD — two layers stacked on the exact frame of a perfect parry, over its clash or deflect
   (sfx.js parry / boltParry), so you hear you hit the window without looking for a label:
     L6 THE IMPLOSION (-eta → 0 s)  parryRise: the field snatching the bolt's energy before it throws it back. A
                                    reversed sweep (suction rising in pitch and level) that ends exactly on impact.
                                    Only a bolt can have it, since only a bolt's arrival is known ahead
                                    (enemies/bolts.js starts it when the parry window will still be open on arrival).
     L7 THE SHOCKWAVE (0 s)         parryChime: a ~60 Hz sub punch with its attack pushed hard, gated off fast.
   No chime or bell rings over it. The score and ambience duck ~6 dB for half a second with it (sfx.js). */
export function parryRise(pos, eta){
  const d = Math.max(0.05, Math.min(0.22, eta)), C = o => play(Object.assign({ pos, bus: 'clash' }, o));
  // the suck-back: noise swelling up through a rising band, and a low tone climbing into the hit; cut off dead at 0
  C({ src: 'noise', color: 'pink', g: 0.07, a: d, d: 0.008, filt: { type: 'bandpass', f: 500, f2: 5200, q: 1.6, t: d }, pri: 2 });
  C({ type: 'sine', f: 45, f2: 140, ft: d, g: 0.11, a: d, d: 0.01, panK: 0.3, pri: 2 });
  C({ type: 'sawtooth', f: 160, f2: 900, ft: d, g: 0.025, a: d, d: 0.01, filt: { type: 'lowpass', f: 600, f2: 4000, t: d } });
}
export function parryChime(pos){
  const C = o => play(Object.assign({ pos, bus: 'clash' }, o)), c = rand(0.97, 1.03);
  // L7 · the shockwave: a sub punch, attack pushed hard (held at peak a beat), then gated off fast
  C({ type: 'sine', f: 120 * c, f2: 52, ft: 0.06, g: 0.34, a: 0.0008, hold: 0.025, d: 0.1, panK: 0, pri: 2 });
  C({ src: 'noise', color: 'brown', g: 0.16, a: 0.0008, hold: 0.01, d: 0.05, filt: { type: 'lowpass', f: 260 }, panK: 0 });
}
