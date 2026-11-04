// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIGHTSABER SOUND: every one-shot a blade makes, all synthesized (no recordings, nothing borrowed from a film or a game).
//   ignite / retract   the snap-hiss: a crack, the blade running up (or sucking back) through a filter that flares open,
//                      voiced by the form's group (Guard smooth, Speed snappy, Power roaring, Niman a crystal shimmer)
//                      (full: the showpiece version, for the ignite / retract key and a draw from the belt)
//   swing              the "vwoom": the hum bending up through the arc, a doppler pass, moving air; every stroke different
//   clash              blade on blade, in four layers: a crack, a sub thump, a plasma sizzle and a hum tail, glued on one bus
//   burn               blade through a body: a scorching sear over a dull thump
//   wall               blade dragged through stone or metal: a sizzling scrape that spits sparks
//   deflect            a bolt batted away, in four layers: a burst, a falling twang, a hiss and the bolt whizzing off
// The held hum (the loop that bends with the blade's real tip speed) lives in director.js and uses HUM_PITCH below.

import { play, tooSoon, duck, place } from './engine.js';
import { G, isGunner, shared } from '../state.js';
import { rand } from '../utils.js';
import { FORM_FAMILY } from '../data/foe-forms.js';

const N = o => play(Object.assign({ src: 'noise' }, o));
const T = o => play(o);

/* the hum's pitch by form: lighter forms ride higher; the Darksaber sits far under all of them */
export const HUM_PITCH = { shiicho: 0.92, makashi: 1.06, soresu: 0.96, ataru: 1.1, niman: 1, djemso: 0.86, shien: 0.92, juyo: 1.04, vaapad: 0.9, staff: 1.08, jarkai: 1.12, dark: 0.69 };

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
     niman  (and any blade with no form)         the hilt's snap almost gone: an airy, shimmering bloom with a crystal
            singing-bowl ring; it retracts in a soft wind-like fade with a faint chime tail
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
  const p = HUM_PITCH[kind] || 1, k = full ? 1.15 : 1;
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
    // an airy shimmer blooming open, and a crystal singing bowl ringing over it
    N({ pos, at, color: 'pink', g: 0.07 * g * k, a: 0.12, d: 0.55 * k, trem: { r: 6, d: 0.35 }, filt: { type: 'bandpass', f: 1800, f2: 6000, q: 0.9, t: 0.4 }, verb: 0.3, pri: 1 });
    const f0 = rand(1020, 1080);
    for (const [m, gg, d] of [[1, 0.022, 1.3], [2.71, 0.012, 0.9], [5.1, 0.006, 0.6]])
      T({ pos, at: at + 0.05, type: 'sine', f: f0 * m, g: gg * g * k, a: 0.08, d: d * k, vib: { r: 4.5, d: 5 }, verb: 0.5, jit: 0.005 });
  }
}
function retractLayers(fam, kind, pos, at, g, dur, full){
  const k = full ? 1.15 : 1;
  if (fam === 'guard'){
    // the heavy metallic magnetic latch as the hilt seals
    T({ pos, at: at + dur * 0.9, type: 'sine', f: 420, fm: { r: 1.41, i: 2.5, i2: 0.05 }, g: 0.05 * g * k, a: 0.001, d: 0.2, verb: 0.15 });
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
    // a soft wind dissolving into the hilt, and a faint crystal chime left ringing
    N({ pos, at, color: 'pink', g: 0.05 * g * k, a: dur * 0.3, d: dur * 0.9, filt: { type: 'lowpass', f: 2400, f2: 400, q: 0.6, t: dur }, pri: 1 });
    T({ pos, at: at + dur * 0.8, type: 'sine', f: rand(2050, 2150), g: 0.014 * g * k, a: 0.004, d: 1.1, verb: 0.55, jit: 0.005 });
  }
}

/* the snap-hiss of a blade lighting. kind: a form id, 'staff' (both ends, the far one a beat behind) or 'dark'
   (o.second: the staff's far end, or Jar'Kai's second saber: the base snap-hiss only, its group's layers already sounded) */
export function ignite(kind, o = {}){
  if (o.full) return igniteFull(kind, o);
  const dark = kind === 'dark', p = HUM_PITCH[kind] || 1, pos = o.pos, at = o.at || 0, g = (o.g ?? 1) * 0.75;
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
  const dark = kind === 'dark', p = HUM_PITCH[kind] || 1, pos = o.pos, at = o.at || 0, g = o.g ?? 1;
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
  const dark = kind === 'dark', p = HUM_PITCH[kind] || 1, pos = o.pos, at = o.at || 0, g = (o.g ?? 1) * 0.75;   // (rendered: ~2x a swing at its peak was too forward; now ~1.6x)
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
  const dark = kind === 'dark', p = HUM_PITCH[kind] || 1, pos = o.pos, at = o.at || 0, g = (o.g ?? 1) * 0.9;
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

/* a lightsaber whoosh: the hum's pitch bending up through the arc ("vwoom"), a doppler pass as the blade goes by, and
   moving air. p scales the pitch (fast forms lighter and higher, Djem So heavier, the Darksaber deep and gritty).
   No two strokes match: the length, the bend and where it peaks, the air's band and a blade tremble all vary.
   o.fam voices it by the form's group (see formSwing). */
export function swing(p, len, dark, o = {}){
  const pos = o.pos, at = o.at || 0, air = o.air ?? 1, gain = o.g ?? 1, fam = o.fam;
  p *= rand(0.96, 1.04); len *= rand(0.88, 1.12);
  const d = 0.2 * len, ft = d * rand(0.4, 0.7);
  // how far the pitch bends: Guard's barely moves (an anchor through the air), Niman's swells softly
  const rise = o.rise || (fam === 'guard' ? rand(1.12, 1.22) : fam === 'niman' ? rand(1.25, 1.4) : rand(1.5, 1.95));
  const top = fam === 'guard' ? rand(1200, 1500) : rand(2100, 3000);   // Guard keeps the highs rolled off
  const vib = Math.random() < 0.4 ? { r: rand(15, 26), d: rand(16, 32) } : undefined;   // the blade trembling through the cut
  T({ pos, at, type: 'sawtooth', f: 96 * p, f2: 96 * p * rise, ft, g: 0.068 * gain * (fam === 'niman' ? 0.6 : 1), a: 0.03, d, det: rand(4, 12), vib,
      filt: { type: 'lowpass', f: 550, f2: top, t: d * 0.5 }, drive: dark ? 0.45 : o.drive || 0, verb: 0.1 });
  T({ pos, at, type: 'sawtooth', f: 97.5 * p, f2: 97.5 * p * rise * 0.94, ft, g: 0.045 * gain, a: 0.03, d, filt: { type: 'lowpass', f: 900, f2: Math.min(2000, top) } });
  // the doppler pass: an octave up, swelling in and falling away as the blade sweeps by (Guard and Niman have none)
  if (fam !== 'guard' && fam !== 'niman') T({ pos, at: at + d * 0.12, type: 'sine', f: 192 * p * rise, f2: 150 * p, g: 0.028 * gain, a: d * 0.35, d: d * 0.65, pri: 0 });
  N({ pos, at, color: 'pink', g: 0.085 * air * gain, a: 0.05 * len, d: 0.16 * len, rate: rand(0.85, 1.15),
      filt: { type: 'bandpass', f: rand(380, 520), f2: rand(1600, 2300) * (fam === 'guard' ? 0.5 : 1), q: 1.3 } });
  if (dark) crackle(pos, 2, d, 0.03 * gain, at);   // the Darksaber spits as it cuts
}
/* a form's swing (FORM_SOUND), with its group's colour on top (data/foe-forms.js FORM_FAMILY):
     guard  heavy, low "whoosh": a dense wall of air and a low body, the pitch barely bending, no highs
     speed  a laser-thin slice: a sharp, high doppler drop and high-passed air chopped by a fast LFO, cut off at once
     power  tearing: saturation and crackle that grow with the stroke's size (a heavy overhead crackles violently)
     niman  a smooth whisper of wind through a sweeping phaser-like band, ringing faintly out into the room */
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
    T({ pos, at: d * 0.6, type: 'sine', f: rand(1040, 1090), g: 0.008, a: 0.02, d: 0.7, verb: 0.5, jit: 0.005, pri: 0 });
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

/* BLADE ON BLADE — a heavy, explosive strike built the way a film clash is: FOUR LAYERS on one timeline (0 to ~1.5 s),
   all routed into the clash bus (engine.js), whose glue compressor squeezes them into one object.
     L1 TRANSIENT (0 s)      the crack: the instant the two plasma fields meet. A driven, brick-walled snap of noise and
                             an electric click, all in the 2–5 kHz bite that cuts straight through the score.
     L3 SUB-BASS  (0 s)      the weight: a 50–80 Hz sine drop landing on the exact same frame as the crack, peaking at
                             once and dying fast so it never muddies the mix (with a knock an octave up for laptops).
     L2 SIZZLE    (+0.05 s)  the plasma fighting: high-passed noise chopped by a fast, uneven tremolo and a band that
                             wanders, so the crack melts straight into a spitting hiss, then fades slowly out.
     L4 HUM TAIL  (+0.03 s)  the power connection after it: two detuned saws drifting out of phase in the 150–300 Hz
                             low mids, kept centred, on a slow release.
   Between L1 and L4 the struck blade still sings (the form's ring: FORM_SOUND ring = how high, damp = how long; Soresu
   soaks a blow dead, Djem So's rings on). Each clash rolls its own pitch, level and a slight pan drift (the blades
   sliding past each other), so a fast duel never plays the same clash twice. A big hit (a parry, a bind) is heavier
   all through and holds its tail longer. */
export function clash(pos, big, form){
  form = form || (!isGunner() ? G.stance : null);   // (no form named: the hero's own blade)
  const k = (big ? 1.3 : 1) * rand(0.86, 1.06), v = FORM_SOUND[form] || FORM_SOUND.niman, dm = v.damp;
  const r = v.ring * rand(0.94, 1.06), pt = rand(0.92, 1.08);           // this clash's tuning and pitch
  const drift = (Math.random() < 0.5 ? -1 : 1) * rand(0.08, 0.2);       // which way the blades slide apart
  const C = o => play(Object.assign({ pos, bus: 'clash' }, o));
  const CN = o => C(Object.assign({ src: 'noise' }, o));
  // the score steps aside for an instant so the crack lands on top of it (a flurry only ducks once)
  if (!tooSoon('clashduck', 0.12)) duck(big ? 0.3 : 0.16, big ? 0.08 : 0.03);

  // L1 · the transient: a brick-walled snap (hard-driven, so its peak is flat and loud) in the high mids, and a click
  CN({ g: 0.17 * k, a: 0.0006, d: 0.03, filt: { type: 'bandpass', f: 3200 * r, q: 0.7 }, drive: 1, pri: 2 });
  CN({ g: 0.09 * k, a: 0.0005, d: 0.012, filt: { type: 'highpass', f: 1800 }, drive: 1, pri: 2 });
  C({ type: 'square', f: 2600 * pt, f2: 700, g: 0.035 * k, a: 0.0005, d: 0.018, filt: { type: 'lowpass', f: 7000 } });
  // the "kchhh" tearing off the crack
  CN({ g: 0.07 * k, a: 0.002, d: 0.11 * k, rate: rand(0.5, 0.75), filt: { type: 'bandpass', f: 4200 * r, f2: 1800, q: 0.7 }, drive: 0.85 });

  // L3 · the sub-bass: lands with the crack, peaks at once and drops away (kept centred, like any low end)
  const sub = rand(62, 80) * (v.thump ? 0.88 : 1);
  C({ type: 'sine', f: sub * 1.6, f2: sub * 0.6, ft: 0.12, g: 0.24 * k, a: 0.0015, d: (big ? 0.26 : 0.18) * (v.thump ? 1.2 : 1), panK: 0.25, pri: 2 });
  C({ type: 'sine', f: sub * 2.2, f2: sub * 1.1, g: 0.08 * k, a: 0.0015, d: 0.09, panK: 0.4 });   // the knock a small speaker can carry
  CN({ color: 'brown', g: 0.12 * k, a: 0.001, d: 0.08, filt: { type: 'lowpass', f: 480 }, panK: 0.4 });

  const flurry = tooSoon('clashring', 0.03);   // a flurry of blocks in one frame: one ring and one tail between them
  if (flurry) return;

  // L2 · the plasma sizzle: 0.05 s after the crack, high-passed hiss chopped by a fast uneven tremolo, its band
  // wandering down as it fades; a second, rougher strand on another rate keeps it chaotic rather than a steady buzz
  const sz = (big ? 0.85 : 0.55) * dm;
  CN({ at: 0.05, g: 0.075 * k, a: 0.006, hold: 0.04, d: sz, rate: rand(0.9, 1.15), trem: { r: rand(19, 31), d: 0.85, type: 'triangle' },
       filt: { type: 'bandpass', f: rand(5200, 6400) * r, f2: 2600, q: 0.9, t: sz }, drive: 0.35, pdrift: drift, verb: 0.15, pri: 1 });
  CN({ at: 0.055, g: 0.04 * k, a: 0.01, d: sz * 0.7, rate: rand(0.6, 0.8), trem: { r: rand(37, 53), d: 0.9, type: 'square' },
       filt: { type: 'highpass', f: 3800 }, pdrift: drift * 1.3, pri: 0 });

  // the struck blade singing as the blades part: the form's ring, with a buzzing saw an octave down for its edge
  const f = rand(560, 640) * r, at = 0.03, ring = 0.34 * dm * (big ? 1.25 : 1);
  C({ at, type: 'sawtooth', f: f * 0.5, f2: f * 0.42, g: 0.035 * k, a: 0.004, d: ring * 0.6, fm: { r: 3, i: 1.2, i2: 0.1 },
      filt: { type: 'bandpass', f: 1600, f2: 3000, q: 1.6 }, drive: 0.5, pdrift: drift * 0.6 });
  C({ at, type: 'sawtooth', f, f2: f * 1.04, g: 0.04 * k, a: 0.006, d: ring, vib: { r: rand(24, 32), d: 22 },
      filt: { type: 'bandpass', f: 2400 * r, f2: 5200 * r, q: 6, t: ring * 0.5 }, verb: 0.22, pdrift: drift * 0.6, pri: 2 });
  C({ at, type: 'sine', f: f * 4, g: 0.018 * k, a: 0.004, d: ring * 0.7, vib: { r: 29, d: 18 }, verb: 0.2 });

  // L4 · the hum tail: two saws a few cents apart beating against each other, low-passed into the 150–300 Hz low mids,
  // centred, swelling in under the ring and letting go slowly. A quick run of blocks shares one tail.
  if (!tooSoon('clashtail', 0.22)){
    const hp = (HUM_PITCH[form] || 1) * pt, tl = (big ? 1.3 : 0.85) * Math.min(1.25, dm);
    for (const [det, gg] of [[9, 0.05], [-12, 0.034]])
      C({ at: 0.03, type: 'sawtooth', f: 180 * hp, f2: 168 * hp, ft: tl, g: gg * k, a: 0.05, hold: 0.06, d: tl, det, vib: { r: rand(3, 5), d: 9 },
          filt: { type: 'lowpass', f: 900, f2: 300, t: tl }, panK: 0.2, verb: 0.12, pri: 0 });
  }
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

/* A BOLT DEFLECTED — a hit-and-ping in two phases (the impact, then the bolt flung away), four layers on a ~1 s
   timeline, glued on the clash bus (engine.js) with the blade clashes:
     L1 INCINERATION BURST (0 s)       the bolt slamming into the blade: a gated, hard-saturated pop with a narrow
                                       1–3 kHz bite, and a whip-crack click on top. Instant, and gone in ~30 ms.
     L3 THERMAL HISS       (0 s)       the bolt's steam: a very short burst of noise with everything under 4 kHz cut,
                                       bridging the impact into the redirection.
     L2 THE TWANG          (+0.03 s)   the blade's field throwing it: a resonant, springy tone whose pitch falls
                                       sharply from high to low in a tenth of a second (the "pew"), the beat after
                                       the impact so you hear the hit first and the redirect second.
     L4 THE WHIZ-BY        (+0.05 s)   the bolt flying off: a chorus of detuned tones dropping in pitch (doppler),
                                       panning fast across the stereo field away from where it hit while its highs
                                       roll off and its level falls away over about a second.
   And the hero's own saber hum dips ~3 dB for an instant (BLADE_AUDIO.hduck, read by director.js) so the deflect
   punches out of it. Every deflect rolls its own pitch, level and flight. */
export function deflect(pos){
  const b = rand(0.9, 1.1), k = rand(0.86, 1.06);
  const C = o => play(Object.assign({ pos, bus: 'clash' }, o));
  const CN = o => C(Object.assign({ src: 'noise' }, o));
  BLADE_AUDIO.hduck = shared.AC ? shared.AC.currentTime : 0;
  // L1 · the burst: gated (instant on, hard cut), saturated, a narrow band in the 1–3 kHz bite; the whip-crack on top
  CN({ g: 0.16 * k, a: 0.0005, hold: 0.012, d: 0.016, filt: { type: 'bandpass', f: rand(1700, 2600), q: 2.2 }, drive: 1, pri: 2 });
  CN({ g: 0.11 * k, a: 0.0005, d: 0.014, filt: { type: 'highpass', f: 2600 }, drive: 0.95, pri: 2 });
  C({ type: 'square', f: 3200 * b, f2: 900, g: 0.035 * k, a: 0.0006, d: 0.02, filt: { type: 'lowpass', f: 9000 } });
  C({ type: 'sine', f: 190 * b, f2: 70, g: 0.08 * k, a: 0.001, d: 0.06, panK: 0.4 });   // a little body under the pop
  // L3 · the thermal hiss: everything below 4 kHz cut, short, a bridge from the hit into the twang
  CN({ at: 0.004, g: 0.06 * k, a: 0.003, d: 0.075, rate: rand(0.9, 1.2), filt: { type: 'highpass', f: rand(4200, 5200), q: 0.9 }, drive: 0.3, pri: 1 });
  // L2 · the twang: a sprung cable struck and bent down. A clean tone and a metallic FM partner both falling fast
  const tw = rand(0.1, 0.14);
  C({ at: 0.03, type: 'sine', f: 4200 * b, f2: 520 * b, ft: tw, g: 0.06 * k, a: 0.001, d: tw * 1.4, fm: { r: 1.5, i: 0.6, i2: 0.05 }, verb: 0.12, pri: 2 });
  C({ at: 0.032, type: 'sawtooth', f: 2900 * b, f2: 360 * b, ft: tw * 1.1, g: 0.026 * k, a: 0.001, d: tw * 1.2,
      filt: { type: 'bandpass', f: 3600, f2: 900, q: 5, t: tw }, pri: 1 });
  if (tooSoon('deflwhiz', 0.08)) return;   // a volley of deflects: one bolt whizzes off at a time
  // L4 · the whiz-by: off the side it hit (or a random side if dead ahead), across the stereo field and away
  const P = place(pos), p0 = P ? P.pan : 0, side = Math.abs(p0) > 0.15 ? Math.sign(p0) : (Math.random() < 0.5 ? -1 : 1);
  const fly = rand(0.7, 1), drift = -side * rand(0.9, 1.3) * (Math.random() < 0.35 ? -1 : 1);   // mostly back across you
  for (const [det, gg] of [[0, 0.03], [14, 0.022], [-17, 0.018]])
    C({ at: 0.05, type: 'sine', f: 1900 * b, f2: 820 * b, ft: fly, g: gg * k, a: 0.035, d: fly, det, vib: { r: rand(5, 8), d: 12 },
        filt: { type: 'lowpass', f: 9000, f2: 900, t: fly }, pdrift: drift, verb: 0.15, pri: 0 });
  CN({ at: 0.05, color: 'pink', g: 0.03 * k, a: 0.03, d: fly * 0.6, filt: { type: 'bandpass', f: 5200, f2: 1400, q: 1.4, t: fly * 0.6 }, pdrift: drift, pri: 0 });
  crackle(pos, 2, 0.1, 0.02, 0.04);
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

/* THE PERFECT-PARRY REWARD — three layers stacked on the exact frame of a perfect parry, over its clash or deflect
   (sfx.js parry / boltParry), so you hear you hit the window without looking for a label:
     L6 THE IMPLOSION (-eta → 0 s)  parryRise: the field snatching the bolt's energy before it throws it back. A
                                    reversed sweep (suction rising in pitch and level) that ends exactly on impact.
                                    Only a bolt can have it, since only a bolt's arrival is known ahead
                                    (enemies/bolts.js starts it when the parry window will still be open on arrival).
     L7 THE SHOCKWAVE (0 s)         parryChime: a ~60 Hz sub punch with its attack pushed hard, gated off fast.
     L5 THE CHIME     (0 s)         parryChime: a crystalline ring band-locked at 6–8 kHz, high above the combat's
                                    mid-range noise, with a long clean reverb tail (~2.5 s).
   The score and ambience duck ~6 dB for half a second with it (sfx.js), leaving the chime ringing alone. */
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
  // L5 · the chime: a struck crystal. Three close partials in the 6–8 kHz band (beating gently against each other),
  // a bright FM strike for the attack, and a long send into the room so it rings on after the hit has gone
  for (const [f, g, d] of [[6400, 0.03, 2.4], [7060, 0.024, 2.0], [7880, 0.016, 1.5]])
    C({ type: 'sine', f: f * c, g, a: 0.002, d, filt: { type: 'bandpass', f: 7000, q: 2 }, verb: 0.6, jit: 0.004, pri: 2 });
  C({ type: 'sine', f: 6800 * c, g: 0.03, a: 0.001, d: 0.25, fm: { r: 1.41, i: 1.4, i2: 0.05 }, filt: { type: 'bandpass', f: 7000, q: 1.5 }, verb: 0.5 });
}
