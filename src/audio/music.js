// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MUSIC: the adaptive synthesized score.

import { shared, G, enemies, isGunner, bossUp } from '../state.js';
import { AE } from './engine.js';

/* ---------- procedural MUSIC engine ----------
   A fully synthesized orchestral score (no audio files): string sections, horns and trumpets, a choir, timpani,
   taiko and cymbals, all built from oscillators and noise. Each world has its own PALETTE (key, tempo, chord loop,
   melody, drum kit) and each hero has a THEME. Layers fade in with an INTENSITY the game state drives:

     menu / lull   strings + sub drone, a melody played softly
     combat        + low strings, the string ostinato, timpani on the downbeats, drums
     heavy combat  + galloping low strings, snare, hats, fills, horns on the melody
     boss          + brass stabs, trumpets over horns in octaves, a cymbal at the top of each phrase

   SECTIONS swap the chord loop on a downbeat:
     main    the world's own progression and melody
     hero    the hero's theme over a major progression: the title screen, the final push of a mission objective,
             a boss on its last legs
     tense   a dark loop with brass alarms and string tremolo: a mission objective going wrong
     villain a boss's own theme (VILLAINS) for its fight, until the hero's takes over
     film    a cutscene's bed: the hero's theme on a solo voice, no drums (filmFoe: the villain's, while a foe speaks)
     lament  the hero's theme in a minor key, slowed, once the hero falls

   CUTSCENES steer it through MUSIC.scene* (called by game/cutscene.js): the bed, the dip under dialogue, a title's hit,
   a duel's riser into its first clash.

   Story missions steer the score with a CUE per objective (MUSIC.setCue, called by game/mission.js): see CUES.
   One-shot STINGS mark a boss rising, a wave starting, an area or objective cleared, an unlock, victory and death.

   THE EPIC LAYER rides on top of any boss fight (a final boss, the Herald, the Magistrate, a Warbringer; every mode,
   both sides of co-op): a low men's choir holding the root, a chanting choir and a taiko ensemble driving the bar,
   trombones swelling into each new phrase, and from phase II a full choir over the strings (from phase III sopranos
   doubling the melody too). It grows with the boss's phase and SWELLS at the big moments: MUSIC.bossBeat (driven to a
   knee: the fight drops out under a rising choir), MUSIC.bossPhase (he rises: a tutti hit on a fresh downbeat) and
   MUSIC.bossFinish (the fall: the score stops dead under a held major chord, the choir ringing out).
   Tuned to sit UNDER the SFX; the whole score rides the MUSIC volume slider and toggles with M (persisted). */

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const GRIT = (() => { const c = new Float32Array(256); for (let i = 0; i < 256; i++) c[i] = Math.tanh(3 * (i / 127.5 - 1)); return c; })();
const R = -1;   // a rest in a pattern

/* PALETTES. Pitches are semitones above `root` (a MIDI note). Each loop is 4 bars of 16 steps.
     prog   per bar: bass note + chord voicing          lead   [step, semitone, length in steps]
     bass   per step: 0 rest, 1 root, 2 octave, 5 fifth  arp    per step: chord-tone index (3 = top octave), R rest
     kit    which drums; kick/snare/hat list the steps they hit on
   The menu palette only sets the key, tempo and drums: the title screen plays the picked hero's THEME. */
export const PALETTES = {
  // the menu: A minor
  menu: { root: 33, bpm: 84, pad: 'saw', calm: 'flute', big: 'brass', kit: 'rock',
    prog: [ { bass: 0, chord: [24,27,31] }, { bass: -4, chord: [24,27,32] }, { bass: 3, chord: [27,31,34] }, { bass: -2, chord: [26,29,34] } ],
    lead: [ [0,36,6],[8,34,4],[12,31,4], [16,32,8],[26,36,5], [32,39,6],[40,38,4],[44,34,4], [48,38,8],[57,36,6] ],
    bass: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    arp:  [0,R,1,R, 2,R,1,R, 0,R,1,R, 2,R,1,R],
    kick: [0,8], snare: [4,12], hat: [1,3,5,7,9,11,13,15] },

  // JEDHA: D dorian, Dm · C · G · Am — a plucked, dusty pilgrim's theme over frame drums
  temple: { root: 38, bpm: 100, pad: 'saw', calm: 'pluck', big: 'brass', kit: 'frame',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: -2, chord: [10,14,17] }, { bass: 5, chord: [12,17,21] }, { bass: 7, chord: [10,14,19] } ],
    lead: [ [0,31,3],[3,33,1],[4,34,2],[6,36,6],[12,34,2],[14,31,2],
            [16,29,4],[20,26,2],[22,29,2],[24,34,6],[30,33,2],
            [32,33,3],[35,31,1],[36,29,4],[40,36,4],[44,33,4],
            [48,34,4],[52,33,2],[54,31,6],[60,26,4] ],
    bass: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,5,0],
    arp:  [0,1,2,1, 3,2,1,2, 0,1,2,1, 3,2,1,R],
    kick: [0,6,10], snare: [4,12], hat: [2,3,7,11,14,15] },

  // MUSTAFAR: C phrygian, Cm · D♭ · Cm · B♭m — a driving forge rhythm, taiko and anvils
  foundry: { root: 36, bpm: 126, pad: 'saw', calm: 'pluck', big: 'brass', kit: 'taiko',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: 1, chord: [13,17,20] }, { bass: 0, chord: [12,15,19] }, { bass: -2, chord: [10,13,17] } ],
    lead: [ [0,31,2],[2,32,2],[4,31,4],[8,27,2],[10,29,2],[12,31,4],
            [16,32,4],[20,29,4],[24,25,6],[30,27,2],
            [32,36,4],[36,34,2],[38,32,2],[40,31,6],[46,32,2],
            [48,29,4],[52,25,4],[56,27,4],[60,24,4] ],
    bass: [1,0,1,0, 2,0,1,0, 1,0,1,0, 2,0,5,0],
    arp:  [0,R,0,1, 0,R,0,2, 0,R,0,1, 0,2,1,0],
    kick: [0,3,8,10], snare: [4,12], hat: [2,6,10,14] },

  // EXEGOL: B♭ minor (harmonic), B♭m · G♭ · E♭m · F — a slow Sith choir, a tolling bell, half-time drums
  plains: { root: 34, bpm: 104, pad: 'choir', calm: 'choir', big: 'brass', kit: 'toll',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: -4, chord: [8,12,15] }, { bass: 5, chord: [12,17,20] }, { bass: -5, chord: [11,14,19] } ],
    lead: [ [0,31,8],[8,32,4],[12,31,4], [16,27,8],[24,29,4],[28,31,4], [32,32,6],[38,31,2],[40,29,8], [48,35,8],[56,26,4],[60,31,4] ],
    bass: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
    arp:  [0,R,R,1, R,R,2,R, 0,R,R,1, R,R,3,R],
    kick: [0,10], snare: [8], hat: [2,6,10,14] },

  // THE HIDDEN REFUGE (and any world without a palette of its own): B minor, Bm · G · D · A — a war march at dusk,
  // timpani and a military snare
  refuge: { root: 35, bpm: 112, pad: 'saw', calm: 'flute', big: 'brass', kit: 'war',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: -4, chord: [12,15,20] }, { bass: 3, chord: [15,19,22] }, { bass: -2, chord: [14,17,22] } ],
    lead: [ [0,27,4],[4,26,2],[6,24,2],[8,31,6],[14,29,2],
            [16,27,6],[22,26,2],[24,24,4],[28,20,4],
            [32,22,4],[36,27,4],[40,31,4],[44,34,4],
            [48,32,6],[54,31,2],[56,29,8] ],
    bass: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,2,0],
    arp:  [0,1,2,1, 3,1,2,1, 0,1,2,1, 3,2,1,R],
    kick: [0,7,8], snare: [4,12], hat: [2,6,10,14] },
};

/* HERO THEMES — original melodies, one per hero, played in whatever key the world is in. The Jedi's is a horn call
   over I · ♭VI · ♭VII · I; the Mandalorian's starts minor, i · ♭VI · ♭VII, and only lands major on its last bar.
   Same layout as a palette's prog and lead; `calm` is the instrument it gets when it's played softly. */
export const THEMES = {
  jedi: { calm: 'horn',
    prog: [ { bass: 0, chord: [12,16,19] }, { bass: -4, chord: [8,12,15] }, { bass: -2, chord: [10,14,17] }, { bass: 0, chord: [12,16,19] } ],
    lead: [ [0,24,4],[4,31,2],[6,29,1],[7,31,1],[8,36,6],[14,34,2],
            [16,32,6],[22,31,2],[24,29,4],[28,27,4],
            [32,26,2],[34,29,2],[36,34,8],[44,31,4],
            [48,36,10],[58,31,2],[60,28,4] ] },
  mando: { calm: 'flute',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: -4, chord: [8,12,15] }, { bass: -2, chord: [10,14,17] }, { bass: 0, chord: [12,16,19] } ],
    lead: [ [0,24,3],[3,24,1],[4,27,4],[8,31,6],[14,29,2],
            [16,32,4],[20,31,4],[24,27,8],
            [32,29,3],[35,31,1],[36,34,6],[42,31,2],[44,29,4],
            [48,28,4],[52,31,4],[56,36,8] ] },
  // the ARC trooper's: a parade-ground march, I · IV · ♭VII · I, a bugle call up the fifth on the snare's pickup
  trooper: { calm: 'horn',
    prog: [ { bass: 0, chord: [12,16,19] }, { bass: 5, chord: [12,17,21] }, { bass: -2, chord: [10,14,17] }, { bass: 0, chord: [12,16,19] } ],
    lead: [ [0,19,2],[2,19,1],[3,19,1],[4,24,4],[8,26,2],[10,28,2],[12,26,4],
            [16,29,6],[22,28,2],[24,26,4],[28,24,4],
            [32,22,2],[34,22,1],[35,22,1],[36,26,4],[40,24,2],[42,22,2],[44,21,4],
            [48,24,8],[56,19,2],[58,24,6] ] },
};

/* VILLAIN THEMES — original motifs, one per final boss, plus the RIVAL's for every other duel foe (the Inquisitor, VX-7,
   the trial duellists). Each scores its boss fight (the hero's theme still takes over once the boss is on its last
   legs) and any cutscene line its villain speaks. Same layout as a hero theme; `calm` plays it softly (a cutscene),
   `big` is its voice once the fight is loud, `choir` lays a choir over its strings.
     vexis       harmonic minor, i · ♭VI · iv · V: a slow descending choir line that leans on the tritone
     magistrate  i · ♭VI · ♭II · i: hammered repeated notes in the low brass, like a forge
     marshal     i · v · ♭VI · ♭VII: a minor march, the hero's own drill turned against him
     rival       i · iv · i · ♭II: a creeping line in the cellos */
export const VILLAINS = {
  vexis: { calm: 'choir', big: 'sith', choir: true,
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: -4, chord: [12,15,20] }, { bass: 5, chord: [12,17,20] }, { bass: 7, chord: [11,14,19] } ],
    lead: [ [0,24,6],[6,23,2],[8,24,4],[12,30,4], [16,27,8],[24,26,4],[28,24,4],
            [32,29,6],[38,27,2],[40,26,8], [48,23,8],[56,24,8] ] },
  magistrate: { calm: 'lowhorn', big: 'forge',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: -4, chord: [12,15,20] }, { bass: 1, chord: [13,17,20] }, { bass: 0, chord: [12,15,19] } ],
    lead: [ [0,24,2],[2,24,2],[4,24,2],[6,25,6],[12,24,4], [16,20,4],[20,24,2],[22,27,2],[24,25,8],
            [32,24,2],[34,24,2],[36,24,2],[38,27,4],[42,25,2],[44,24,4], [48,22,4],[52,20,4],[56,24,8] ] },
  marshal: { calm: 'horn', big: 'drill',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: 7, chord: [14,19,22] }, { bass: -4, chord: [12,15,20] }, { bass: -2, chord: [10,14,17] } ],
    lead: [ [0,31,3],[3,31,1],[4,32,4],[8,31,3],[11,29,1],[12,27,4], [16,26,6],[22,27,2],[24,24,8],
            [32,31,3],[35,31,1],[36,32,4],[40,34,4],[44,32,4], [48,31,6],[54,26,2],[56,24,8] ] },
  rival: { calm: 'cello', big: 'brass',
    prog: [ { bass: 0, chord: [12,15,19] }, { bass: 5, chord: [12,17,20] }, { bass: 0, chord: [12,15,19] }, { bass: 1, chord: [13,17,20] } ],
    lead: [ [0,24,2],[4,27,2],[6,26,6], [16,24,2],[20,30,2],[22,29,6],
            [32,24,2],[36,27,2],[38,31,4],[42,30,2],[44,27,4], [48,25,8],[56,24,8] ] },
};
// which villain a name (a speaker's, or a boss's look) belongs to; anyone else hostile is the rival
export const villainOf = (name) => { const n = String(name || '').toUpperCase();
  return n.includes('VEXIS') ? 'vexis' : n.includes('MAGISTRATE') ? 'magistrate' : n.includes('MARSHAL') ? 'marshal' : 'rival'; };
// the boss up now: its villain (a final boss by its id, Darth Vexis and the Magistrate by kind, a co-op guest's puppet by look)
const bossVillain = (b) => b ? (b.fin && VILLAINS[b.fin.def.id] ? b.fin.def.id : b.kind === 'sith' ? 'vexis' : b.kind === 'mando' ? 'magistrate' : b.look ? villainOf(b.look) : null) : null;

/* THE LAMENT — the hero's own theme turned minor and slowed, over i · ♭VI · iv · i: what plays once the hero falls */
const LAMENT = [ { bass: 0, chord: [12,15,19] }, { bass: -4, chord: [8,12,15] }, { bass: 5, chord: [12,17,20] }, { bass: 0, chord: [12,15,19] } ];
const MINOR = { 4: 3, 9: 8, 11: 10 };   // the major scale's third, sixth and seventh, flattened
const minorOf = (lead) => lead.map(([s, n, l]) => { const k = ((n % 12) + 12) % 12; return [s, n - (MINOR[k] != null ? k - MINOR[k] : 0), l]; });
const LAMENTS = {};
const lamentOf = (k) => LAMENTS[k] || (LAMENTS[k] = minorOf(THEMES[k].lead));
// the tense section: i · ♭II · i° · vii°, no melody (the brass alarms and the tremolo carry it)
const TENSE = [ { bass: 0, chord: [12,15,19] }, { bass: 1, chord: [13,17,20] }, { bass: 0, chord: [12,15,18] }, { bass: -1, chord: [11,14,17] } ];

/* CUES — how a story-mission objective steers the score. game/mission.js calls MUSIC.setCue(name, drive) every frame
   with drive = { urgency: 0..1, how close the objective is to done · danger: it's going wrong · focus: the hero is on
   the task right now }. A name with no entry here plays as `battle`.
     floor / ceil   the intensity range the objective holds the score in (a hold never drops to lull music between
                    pulses; a sabotage never gets louder than the slicing)
     ost            the string ostinato: arp (the world's own) · gallop (3-3-2 low strings) · drive (straight 16ths)
                    · tick (a clock, twice as fast while focused)
     lift           at this urgency the hero's theme takes over (the final push); danger still wins over it
     choir          a choir over the strings throughout
     riser          while focused, a swell that climbs over each bar
     bpm            tempo multiplier · dangerBpm  the multiplier while it's going wrong */
export const CUES = {
  regroup:    { floor: 0.2, ceil: 0.42 },   // between objectives: the fight catches its breath
  calm:       { floor: 0.08, ceil: 0.24 },  // the calm after a chapter's last fight (game/aftermath.js): the walk back
  battle:     { floor: 0.5, lift: 0.85 },
  defend:     { floor: 0.55, ost: 'gallop', lift: 0.8 },
  infiltrate: { floor: 0.36, ceil: 0.8, ost: 'tick', riser: true },
  duel:       { floor: 0.72, ost: 'drive', choir: true, lift: 0.75, dangerBpm: 1.08 },
  chase:      { floor: 0.62, ost: 'drive', bpm: 1.1, lift: 0.85 },
};

// intensity per game state, before a cue raises or caps it
// (victory: the hero's theme stated in full after the fanfare; dead: the lament, after the death sting)
const BASE = { menu: 0.16, lull: 0.3, combat: 0.62, heavy: 0.84, boss: 1.0, victory: 0.5, dead: 0.26 };
// a CUTSCENE holds the score down to its film bed: pads, a choir and the melody on a solo voice, no drums or ostinato.
// FILM is the bed's intensity, FILM_DIP the level while a line of dialogue is up (the music steps back under the words)
const FILM = 0.26, FILM_DIP = 0.72;
// the bed is a handful of quiet voices, and with the fight held it's most of what's heard: lifted like the menu's (×4.5,
// about +13 dB) into the compressor, so it never vanishes under the ambience (FILM_POST lifts it again after)
const FILM_LIFT = 4.5;
const LOUD_STATES = new Set(['victory', 'dead']);
// after a stinger (victory, death) the loop rests this long before its theme comes in from the top
const REST = { victory: 3.4, dead: 2.8 };
const FIGHTING = new Set(['lull', 'combat', 'heavy', 'boss']);
const LEVEL = 0.15;   // the score's level on the music bus: the orchestra is denser than the old synth score, so it sits lower
// the title screen plays the theme softly (low intensity = few, quiet voices), which at LEVEL was all but silent
// (about -55 dBFS). It gets its own lift so the menu theme is clearly heard; gameplay levels are unchanged.
// MENU_LIFT raises it into the score's compressor; MENU_POST raises it again after the compressor (the master limiter
// still guards the peaks), since pushing it all through the compressor only squashed it. MENU_POST was 3.2 (about
// -15 dBFS RMS out of the speakers with every slider at 100%), which still read as quiet for a title screen that has to
// sell the mood; at 7 it sits around -9 dBFS, and the soft ceiling after `post` (init) rounds its peaks off under
// -1 dBFS so the lift never clips.
const MENU_LIFT = 3, MENU_POST = 3;
// ...and it still wasn't something you FEEL: at the menu's old intensity (0.16) the title theme was a soft pad, a sub
// drone and a horn, with no bass line or drums. The title screen now plays the hero's theme at TITLE_I, the full
// orchestra (bass line, kick, timpani every bar, horns doubled by trumpets on the tune), with a low shelf of TITLE_SHELF dB
// under 120 Hz for weight. Only the title's own palette gets this: a pause or a menu over a world keeps BASE.menu.
const TITLE_I = 0.62, TITLE_SHELF = 6;
// in play the score was felt more than heard: GAME_POST lifts all of it after its compressor (about +6 dB), and the
// quiet moments with the fight held (a cutscene's bed, the victory statement, the lament) get FILM_POST on top, so they
// sit up near the menu theme's level. The master limiter still guards the peaks
const GAME_POST = 2, FILM_POST = 2.2;

// the soft ceiling's curve (see init): linear up to K, then a tanh knee that never passes CEIL
const SOFT_CEIL = (() => { const n = 4096, K = 0.5, CEIL = 0.89, c = new Float32Array(n);
  for (let i = 0; i < n; i++){ const x = (i / (n - 1)) * 8 - 4, a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= K ? a : K + (CEIL - K) * Math.tanh((a - K) / (CEIL - K))); }
  return c; })();

export const MUSIC = (function(){
  let bus=null, shelf=null, comp=null, post=null, delay=null, timer=null, started=false;
  let nextTime=0, step=0, intensity=0, target=0.16, state='menu', prevState='';
  let pal = PALETTES.menu, want = 'menu', palName = 'menu';
  let section = 'hero', entered = false, heroKey = 'jedi', bpmMul = 1, dangerLv = 0;
  let cue = null, cueName = null;
  let film = null, villain = null, restUntil = 0, dip = 1;   // film: the cutscene playing ({ foe, talk }), see scene*() below
  const drive = { urgency: 0, danger: false, focus: false };
  let enabled = (() => { try { return localStorage.getItem('sw_music') !== '0'; } catch(e){ return true; } })();
  const stepDur = () => 60 / (pal.bpm * bpmMul) / 4, barDur = () => stepDur() * 16;
  const nf = s => mtof(pal.root + s);
  const AC = () => shared.AC;
  const liveCue = () => (cue && G.mission && FIGHTING.has(state)) ? cue : null;

  /* ---------- instruments ---------- */
  function env(g, t, peak, a, dur){
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  // attack, sustain, release: the bowed and blown voices hold their note instead of dying away
  function hold(g, t, peak, a, dur, rel){
    rel = Math.min(rel, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  // every note's last node goes to the bus (and the echo and the room, by `send`); once the note is over it's
  // disconnected, so finished voices drop out of the graph instead of waiting on garbage collection
  const done = [];
  function out(node, send, end){ node.connect(bus); let s = null;
    if (send){ s = AC().createGain(); s.gain.value = send; node.connect(s); s.connect(delay); s.connect(AE.roomIn); }
    done.push({ node, s, end: end + 0.1 }); }
  function sweep(now){ let k = 0;
    for (const d of done){ if (d.end < now){ d.node.disconnect(); if (d.s) d.s.disconnect(); } else done[k++] = d; }
    done.length = k; }
  function osc(type, f, t, dur, det){ const o = AC().createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; o.start(t); o.stop(t + dur + 0.05); return o; }
  function lp(f, q){ const F = AC().createBiquadFilter(); F.type = 'lowpass'; F.frequency.value = f; if (q) F.Q.value = q; return F; }
  function vibrato(t, dur, depth, delay){ const v = osc('sine', 4.8 + Math.random() * 0.8, t, dur), vg = AC().createGain();
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(0, t + delay); vg.gain.linearRampToValueAtTime(depth, t + delay + 0.5);
    v.connect(vg); return vg; }

  // a plain voice (the flute, the sub drone, the death sting)
  function voice(t, freq, dur, o){ o = o || {};
    const s = osc(o.type || 'triangle', freq, t, dur, o.detune), g = AC().createGain();
    env(g, t, o.gain || 0.08, o.attack || 0.01, dur);
    let n = s; if (o.filter){ const F = lp(o.filter); s.connect(F); n = F; }
    if (o.vib) vibrato(t, dur, o.vib, 0.05).connect(s.detune);
    n.connect(g); out(g, o.send, t + dur);
  }
  // a string section: detuned saws swelling in and holding (thin: two saws, for a doubling). The detune spread is the
  // ensemble's shimmer; no vibrato, since modulating an oscillator's pitch costs Chrome a per-sample computation
  function strings(t, f, dur, gain, bright, thin){
    const F = lp(bright, 0.5), g = AC().createGain(); hold(g, t, gain * (thin ? 0.8 : 0.6), Math.min(0.7, dur * 0.3), dur, 0.6);
    for (const det of thin ? [-8, 8] : [-11, 1, 12]) osc('sawtooth', f, t, dur, det).connect(F);
    F.connect(g); out(g, 0.55, t + dur);
  }
  // spiccato: a short bowed stroke, the ostinato's voice (low = the cellos, darker and drier)
  function spic(t, f, dur, gain, low){
    const F = lp(low ? 1800 : 3600, 1), g = AC().createGain(); env(g, t, gain, 0.006, Math.max(0.12, dur));
    F.frequency.setValueAtTime(low ? 1800 : 3600, t); F.frequency.exponentialRampToValueAtTime(low ? 500 : 1200, t + 0.15);
    osc('sawtooth', f, t, dur, -6).connect(F); osc('sawtooth', f, t, dur, 6).connect(F);
    F.connect(g); out(g, low ? 0.2 : 0.35, t + Math.max(0.12, dur));
  }
  // a choir: saws with vibrato, mixed, through three vowel formants ("ah" unless told otherwise). atk: the swell's
  // length (a long one is a crescendo); lite: two voices and no vibrato, for the short chanted syllables
  const VOWEL = { ah: [[730, 6, 1], [1090, 7, 0.55], [2440, 8, 0.2]], oh: [[500, 6, 1], [820, 7, 0.5], [2400, 8, 0.12]],
                  oo: [[320, 6, 1], [800, 7, 0.3], [2250, 8, 0.08]], eh: [[560, 6, 1], [1700, 7, 0.45], [2500, 8, 0.18]] };
  function choir(t, f, dur, gain, vowel, atk, lite){
    const g = AC().createGain(), mix = AC().createGain(); hold(g, t, gain * 1.7, atk || Math.min(0.6, dur * 0.35), dur, lite ? Math.min(0.15, dur * 0.4) : 0.6);
    const vg = lite ? null : vibrato(t, dur, 14, 0);
    for (const det of lite ? [-7, 7] : [-9, 0, 9]){ const o = osc('sawtooth', f, t, dur, det); if (vg) vg.connect(o.detune); o.connect(mix); }
    for (const [ff, q, k] of VOWEL[vowel || 'ah']){
      const B = AC().createBiquadFilter(); B.type = 'bandpass'; B.frequency.value = ff; B.Q.value = q;
      const kg = AC().createGain(); kg.gain.value = k; mix.connect(B); B.connect(kg); kg.connect(g); }
    out(g, 0.6, t + dur);
  }
  // a plucked string (the harp, the Jedha oud): bright attack that closes down fast
  function pluck(t, f, dur, gain){
    const F = lp(4200, 2), g = AC().createGain(); env(g, t, gain, 0.004, Math.max(0.25, dur));
    F.frequency.setValueAtTime(4200, t); F.frequency.exponentialRampToValueAtTime(500, t + 0.25);
    osc('sawtooth', f, t, dur).connect(F); osc('triangle', f * 2, t, dur, 4).connect(F);
    F.connect(g); out(g, 0.45, t + Math.max(0.25, dur));
  }
  // a French horn section: warm, the filter blooms on the attack
  function horn(t, f, dur, gain, bright){ bright = bright || 1;
    const F = lp(380 * bright, 0.8), g = AC().createGain(); hold(g, t, gain, 0.07, dur, 0.18);
    F.frequency.setValueAtTime(380 * bright, t); F.frequency.linearRampToValueAtTime(1500 * bright, t + 0.1); F.frequency.exponentialRampToValueAtTime(1000 * bright, t + 0.5);
    osc('sawtooth', f, t, dur, -5).connect(F); osc('sawtooth', f, t, dur, 6).connect(F); osc('triangle', f, t, dur).connect(F);
    F.connect(g); out(g, 0.5, t + dur);
  }
  // trumpets: brighter and quicker than the horns, the filter snaps open on the attack
  // (no pitch scoop: see strings; and every filter sweep ends, since a filter whose cutoff is still moving is
  // recomputed every sample)
  function trumpet(t, f, dur, gain){
    const F = lp(900, 1.2), g = AC().createGain(); hold(g, t, gain, 0.025, dur, 0.12);
    F.frequency.setValueAtTime(900, t); F.frequency.linearRampToValueAtTime(4600, t + 0.04); F.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
    osc('sawtooth', f, t, dur, -4).connect(F); osc('sawtooth', f, t, dur, 5).connect(F);
    F.connect(g); out(g, 0.4, t + dur);
  }
  // low brass: trombones and tuba, blared and driven (the stabs)
  function lowBrass(t, f, dur, gain){
    const F = lp(250, 1.4), pre = AC().createGain(), w = AC().createWaveShaper(), g = AC().createGain();
    pre.gain.value = 0.35; w.curve = GRIT; env(g, t, gain, 0.03, dur);
    F.frequency.setValueAtTime(250, t); F.frequency.exponentialRampToValueAtTime(1800, t + 0.05); F.frequency.exponentialRampToValueAtTime(700, t + 0.35);
    osc('sawtooth', f, t, dur, -6).connect(F); osc('sawtooth', f, t, dur, 6).connect(F); osc('square', f / 2, t, dur).connect(F);
    F.connect(pre); pre.connect(w); w.connect(g); out(g, 0.35, t + dur);
  }
  // trombones swelling from nothing into the next downbeat: the filter and the level climb together, then cut off
  function brassSwell(t, f, dur, gain){
    const F = lp(200, 1.2), pre = AC().createGain(), w = AC().createWaveShaper(), g = AC().createGain();
    pre.gain.value = 0.4; w.curve = GRIT;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.96); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    F.frequency.setValueAtTime(200, t); F.frequency.exponentialRampToValueAtTime(2400, t + dur);
    osc('sawtooth', f, t, dur, -7).connect(F); osc('sawtooth', f, t, dur, 7).connect(F); osc('square', f / 2, t, dur).connect(F);
    F.connect(pre); pre.connect(w); w.connect(g); out(g, 0.4, t + dur);
  }
  function bassNote(t, f, dur, gain, grit){
    const F = lp(260 + intensity * 600, 3), g = AC().createGain(); env(g, t, gain, 0.005, dur);
    osc('sawtooth', f, t, dur).connect(F); osc('sine', f, t, dur).connect(g);
    let n = F;
    if (grit){ const w = AC().createWaveShaper(); w.curve = GRIT; F.connect(w); n = w; }
    n.connect(g); out(g, 0, t + dur);
  }
  const INSTR = { flute: (t, f, d, g) => voice(t, f, d, { type: 'triangle', gain: g, attack: 0.05, filter: 2600, send: 0.6, vib: 14 }),
                  pluck, horn: (t, f, d, g) => horn(t, f / 2, d, g * 0.8), choir: (t, f, d, g) => choir(t, f, d, g * 0.9),
                  lowhorn: (t, f, d, g) => horn(t, f / 2, d, g * 0.9, 0.7),
                  cello: (t, f, d, g) => strings(t, f / 2, d, g * 0.9, 1100, true) };
  // a villain's melody once the fight is loud (VILLAINS.big)
  const BIG = { sith: (t, f, d) => { choir(t, f, d, 0.026); lowBrass(t, f / 2, d * 0.9, 0.016); },
                forge: (t, f, d) => { lowBrass(t, f / 2, d * 0.9, 0.02); horn(t, f / 2, d * 0.94, 0.022); },
                drill: (t, f, d) => { horn(t, f / 2, d * 0.94, 0.024); trumpet(t, f, d * 0.85, 0.016); },
                brass: (t, f, d) => { horn(t, f / 2, d * 0.94, 0.026); spic(t, f / 2, d * 0.5, 0.02, true); } };

  /* ---------- percussion ---------- */
  function noiseHit(t, amp, type, f, q, dur){
    const s = AC().createBufferSource(); s.buffer = AE.noise.white;
    const F = AC().createBiquadFilter(); F.type = type; F.frequency.value = f; if (q) F.Q.value = q;
    const g = AC().createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(F); F.connect(g); out(g, 0.12, t + dur); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  function kick(t, amp, f0, f1, dur){ const o = AC().createOscillator(), g = AC().createGain();
    o.frequency.setValueAtTime(f0 || 132, t); o.frequency.exponentialRampToValueAtTime(f1 || 45, t + 0.12);
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
    o.connect(g); out(g, 0, t + (dur || 0.2)); o.start(t); o.stop(t + (dur || 0.2) + 0.02); }
  function taiko(t, amp){ kick(t, amp, 110, 48, 0.45); noiseHit(t, amp * 0.35, 'lowpass', 420, 0, 0.22); }
  // the war drum: one enormous low hit, felt more than heard
  function boom(t, amp){ kick(t, amp, 74, 30, 1.1); noiseHit(t, amp * 0.3, 'lowpass', 260, 0, 0.35); }
  function frame(t, amp){ kick(t, amp * 0.6, 200, 95, 0.16); noiseHit(t, amp * 0.25, 'bandpass', 900, 1.2, 0.08); }
  // a tuned timpani: the pitch settles onto the note, an inharmonic overtone on top, a felt-mallet thud
  function timpani(t, f, amp){
    const o = AC().createOscillator(), o2 = AC().createOscillator(), g = AC().createGain(), g2 = AC().createGain();
    o.frequency.setValueAtTime(f * 1.05, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    o2.type = 'triangle'; o2.frequency.value = f * 1.51;
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    g2.gain.setValueAtTime(0.3, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); o2.connect(g2); g2.connect(g); out(g, 0.3, t + 1.55);
    o.start(t); o2.start(t); o.stop(t + 1.55); o2.stop(t + 0.5);
    noiseHit(t, amp * 0.4, 'lowpass', 350, 0, 0.1);
  }
  function timpRoll(t, f, dur, amp){ const n = Math.max(4, Math.round(dur / 0.055)); for (let i = 0; i < n; i++) timpani(t + i * dur / n, f, amp * (0.25 + 0.75 * i / n)); }
  function crash(t, amp){
    const s = AC().createBufferSource(); s.buffer = AE.noise.white;
    const F = AC().createBiquadFilter(); F.type = 'highpass'; F.frequency.value = 3500;
    const g = AC().createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    s.connect(F); F.connect(g); out(g, 0.5, t + 2.5); s.start(t, Math.random()); s.stop(t + 2.5);
  }
  function metal(t, amp, f){ const o = AC().createOscillator(), m = AC().createOscillator(), mg = AC().createGain(), g = AC().createGain();
    o.frequency.value = f; m.frequency.value = f * 1.53; mg.gain.setValueAtTime(f * 3, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.8);
    m.connect(mg); mg.connect(o.frequency); env(g, t, amp, 0.002, 0.9); o.connect(g); out(g, 0.5, t + 1); o.start(t); m.start(t); o.stop(t + 1); m.stop(t + 1); }
  function swell(t, amp, dur){ // a cymbal/gong swell into a hit
    const s = AC().createBufferSource(); s.buffer = AE.noise.white;
    const F = AC().createBiquadFilter(); F.type = 'highpass'; F.frequency.value = 5000;
    const g = AC().createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    s.connect(F); F.connect(g); out(g, 0.4, t + dur + 0.7); s.start(t); s.stop(t + dur + 0.7); }
  // a rising band of noise over a bar (the slicing tension)
  function riser(t, dur, amp){
    const s = AC().createBufferSource(); s.buffer = AE.noise.white;
    const F = AC().createBiquadFilter(); F.type = 'bandpass'; F.Q.value = 4;
    F.frequency.setValueAtTime(400, t); F.frequency.exponentialRampToValueAtTime(3200, t + dur);
    const g = AC().createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + dur * 0.92); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(F); F.connect(g); out(g, 0.4, t + dur); s.start(t, Math.random()); s.stop(t + dur + 0.05); }

  function drum(kind, t, I){
    const K = pal.kit;
    if (kind === 'kick'){
      if (K === 'taiko' || K === 'toll' || K === 'war') taiko(t, 0.42 + I * 0.4);
      else if (K === 'frame') frame(t, 0.5 + I * 0.4);
      else kick(t, 0.4 + I * 0.4);
    } else if (kind === 'snare'){
      if (K === 'taiko' && I > 0.85) metal(t, 0.035, 820);                 // the forge's anvil on the backbeat
      if (K === 'toll') noiseHit(t, 0.2, 'bandpass', 1400, 0.6, 0.35);      // a big, roomy half-time crack
      else if (K === 'war'){ noiseHit(t, 0.17, 'bandpass', 2400, 0.9, 0.12); kick(t, 0.12, 240, 160, 0.06); }   // a tight military snare
      else noiseHit(t, 0.16, 'bandpass', K === 'frame' ? 1100 : 1800, 0.7, 0.16);
    } else if (kind === 'hat'){
      noiseHit(t, (K === 'frame' ? 0.05 : 0.08) + (I - 0.75) * 0.3, 'highpass', K === 'frame' ? 5000 : 7000, 0, K === 'frame' ? 0.07 : 0.05);
    }
  }

  /* ---------- the string ostinatos (see CUES.ost) ---------- */
  const DRIVE = [0,12,7,12, 0,12,7,12, 0,12,7,12, 0,12,10,12];
  function ostinato(kind, t, P, inBar, I, sd, under){
    if (I < 0.3) return;
    const low = nf(P.bass + 12);
    if (kind === 'arp'){
      const ai = pal.arp[inBar];
      if (I < 0.34 || ai === R) return;
      const tone = ai === 3 ? P.chord[0] + 12 : P.chord[ai];
      if (pal.calm === 'pluck') pluck(t, nf(tone + 12), sd * 1.5, 0.018 + I * 0.03);
      else spic(t, nf(tone + 12), sd * 1.3, 0.016 + I * 0.026);
    } else if (kind === 'gallop'){   // 3-3-2: accents on 1, the "and" of 2 and 4 of every half bar
      const acc = inBar % 8 === 0 || inBar % 8 === 3 || inBar % 8 === 6;
      if (acc) spic(t, low, sd * 1.6, 0.03 + I * 0.03, true);
      if (under) return;   // under the world's arpeggio: just the accents
      if (!acc && I > 0.7) spic(t, low, sd * 0.8, 0.01 + I * 0.01, true);
      if (acc && I > 0.6) spic(t, low * 2, sd * 1.2, 0.012 + I * 0.01);
    } else if (kind === 'drive'){
      spic(t, nf(P.bass + 12 + DRIVE[inBar]), sd * 0.9, (inBar % 4 === 0 ? 0.03 : 0.018) + I * 0.015, true);
    } else if (kind === 'tick'){
      if (inBar % (drive.focus ? 2 : 4) === 0) pluck(t, nf(P.chord[2] + 24), sd, inBar % 4 === 0 ? 0.028 : 0.016);
      if (I > 0.5 && inBar % 4 === 2) spic(t, low, sd, 0.02, true);
    }
  }

  /* ---------- the epic layer (boss fights) ----------
     EP.lv eases toward the boss's tier (TIER, by phase; a Warbringer fights at phase I) plus EP.surge, which a phase
     turn or a fall kicks to 1 and which dies away over a couple of bars. Each part comes in at its own level. */
  const TIER = [0, 0.5, 0.75, 1];
  const EP = { lv: 0, surge: 0, phase: 0, who: null, warb: null, done: null };
  // the chant: a choir stamping out the bar in syllables (accented steps get the root and fifth, the rest the root),
  // and the taiko ensemble under it. Original rhythms, one per four-bar phrase position
  const CHANT = [ [[0, 'ah', 1], [3, 'oh', 0], [6, 'ah', 1], [8, 'eh', 0], [10, 'oh', 0], [12, 'ah', 1]],
                  [[0, 'oh', 1], [2, 'oh', 0], [4, 'ah', 1], [8, 'oh', 1], [11, 'eh', 0], [14, 'ah', 0]] ];
  const TAIKO = [0, 3, 6, 8, 11, 14], TAIKO_SOFT = [2, 7, 10, 13, 15];
  function epicStep(t, P, bar, inBar, ls, sd, M){
    const E = Math.min(1, EP.lv), I = intensity;
    if (E < 0.05 || I < 0.45) return;
    const root = P.chord[0];
    if (inBar === 0){
      const bd = barDur() * 1.04;
      // the low men's choir: the bar's root and its fifth, an octave and a half under the strings, on "oh"
      soon(() => { choir(t, nf(P.bass + 12), bd, 0.01 + E * 0.012, 'oh'); choir(t, nf(P.bass + 19), bd, 0.007 + E * 0.009, 'oh'); });
      // phase II on: the full choir on the chord, an octave up, "ah" (it builds over the bar)
      if (EP.phase >= 2) for (const c of P.chord) soon(() => choir(t, nf(c + 12), bd, 0.006 + E * 0.008, 'ah', bd * 0.5));
      if (bar === 0 || bar === 2) boom(t, 0.25 + E * 0.25);
    }
    // the chant, the taiko ensemble under it (from phase II the soft strokes between)
    if (E > 0.45){
      for (const [s, v, acc] of CHANT[bar & 1]){ if (s !== inBar) continue;
        soon(() => { choir(t, nf(root), sd * (acc ? 1.8 : 1.3), (acc ? 0.014 : 0.009) + E * 0.006, v, 0.02, true);
                     if (acc) choir(t, nf(root + 7), sd * 1.8, 0.009 + E * 0.005, v, 0.02, true); }); }
      if (TAIKO.includes(inBar)) taiko(t, (inBar === 0 || inBar === 8 ? 0.3 : 0.18) + E * 0.16);
      else if (EP.phase >= 2 && TAIKO_SOFT.includes(inBar)) taiko(t, 0.08 + E * 0.05);
    }
    // the last bar of each phrase: the trombones swell into the downbeat, a cymbal swell with them
    if (bar === 3 && inBar === 8 && E > 0.55){ const d = sd * 8;
      soon(() => { brassSwell(t, nf(M.prog[0].bass + 12), d, 0.026 + E * 0.016); brassSwell(t, nf(M.prog[0].bass + 19), d, 0.016 + E * 0.012); });
      swell(t, 0.04 + E * 0.03, d); }
  }
  // a tutti hit on a downbeat: the whole orchestra and choir at once (a phase turning; `minor` for the villain)
  function tutti(t, k, minor){
    boom(t, 0.5 * k); taiko(t, 0.5 * k); crash(t, 0.14 * k); timpani(t, nf(12), 0.4 * k);
    for (const c of [0, 7, 12]) lowBrass(t, nf(c + 12), 1.8, 0.04 * k);
    for (const c of minor ? [12, 15, 19, 24] : [12, 16, 19, 24]) soon(() => choir(t, nf(c + 12), 2.6, 0.02 * k, 'ah', 0.06));
    voice(t, nf(-12), 2.2, { type: 'sine', gain: 0.12 * k, attack: 0.02, filter: 300 });
  }
  // the phase the boss up now is in (a final boss's own count, the Herald's; a co-op guest's puppet: the phase it was
  // adopted in, and from then on the host's word, MUSIC.bossPhase from boss/finale.js finaleNet)
  const phaseOf = (b) => b.fin ? b.fin.phase : b.finPhase || (b.warbringer ? 1 : b.phase || 1);
  // once a frame (updateState): a new boss, his phase turning, his fall (any boss, either side of co-op)
  function watchBoss(){
    const b = bossUp() || (shared.boss && shared.boss.state === 'dying' ? shared.boss : null);
    let warb = null; if (!b) for (const e of enemies){ if (e.warbringer && !e.dead && !e.converted){ warb = e; break; } }
    const who = b || warb;
    if (who && who !== EP.who){ EP.who = who; EP.phase = phaseOf(who); EP.done = null; }
    if (EP.who && EP.done !== EP.who){
      const w = EP.who, fell = w.state === 'dying' || (w.warbringer && w.dead && !w.converted);
      if (fell) M.bossFinish(w.warbringer ? 0.75 : 1);
      else if (w === who && phaseOf(w) > EP.phase) M.bossPhase(phaseOf(w));
    }
    if (!who) EP.who = null;   // fallen, or gone without a fall (a reset, a dropped boss)
  }

  /* ---------- the sequencer ---------- */
  // palette, section, tempo and hero only ever change on a downbeat
  // keyed on `want`, not the playing palette: leaving the menu drops the lift at once, so a run's first stings
  // never play at the title screen's level while the menu's last bar finishes
  const level = () => enabled ? LEVEL * (want === 'menu' ? MENU_LIFT : 1) * (film ? FILM_LIFT : 1) * dip : 0.0001;
  const postLevel = () => want === 'menu' ? MENU_POST : GAME_POST * (film || LOUD_STATES.has(state) ? FILM_POST : 1);
  const shelfDb = () => want === 'menu' ? TITLE_SHELF : 0;
  function setLevel(tc){ const t = AC().currentTime; bus.gain.setTargetAtTime(level(), t, tc); post.gain.setTargetAtTime(postLevel(), t, tc);
    shelf.gain.setTargetAtTime(shelfDb(), t, tc); compFor(t, tc); }
  // the title's full orchestra is all transients (kick, timpani, crash): it gets a harder compressor so it can sit loud
  // without its hits slamming the ceiling; in play the score keeps its gentle one
  function compFor(t, tc){ const T = want === 'menu', set = (p, v) => tc ? p.setTargetAtTime(v, t, tc) : (p.value = v);
    set(comp.threshold, T ? -28 : -15); set(comp.ratio, T ? 10 : 4); set(comp.knee, T ? 8 : 30);
    set(comp.attack, T ? 0.004 : 0.003); set(comp.release, T ? 0.3 : 0.25); }
  function barTop(){
    if (want !== palName){ palName = want; pal = PALETTES[want] || PALETTES.menu; step = 0; }
    const hk = G.hero === 'trooper' ? 'trooper' : isGunner() ? 'mando' : 'jedi';
    if (hk !== heroKey){ heroKey = hk; if (section === 'hero') step = 0; }   // a new hero picked: their theme from the top
    const C = liveCue(), b = bossUp();
    villain = state === 'boss' ? bossVillain(b) : null;
    const lift = palName === 'menu' || state === 'victory' || (C ? C.lift != null && drive.urgency >= C.lift
      : !!(b && b.hp > 0 && b.hp < b.maxHp * 0.35 && state === 'boss'));   // a boss on its last legs
    const tense = C && palName !== 'menu' && (dangerLv > 0.5 || (section === 'tense' && dangerLv > 0.2));
    // a cutscene: the villain's theme while a foe has the floor, the hero's otherwise. Death: the lament. A boss fight
    // plays its villain's theme until the hero's takes over (lift)
    const sec = film ? (film.talk === 'foe' ? 'filmFoe' : 'film') : state === 'dead' ? 'lament'
      : tense ? 'tense' : lift ? 'hero' : villain ? 'villain' : 'main';
    if (sec !== section){ section = sec; step = 0; entered = !film; }
    bpmMul = film ? 0.9 : section === 'lament' ? 0.72 : C ? (C.bpm || 1) * (section === 'tense' && C.dangerBpm ? C.dangerBpm : 1) : 1;
  }
  const soon = f => setTimeout(f, 0);
  function scheduleStep(t){
    const I = intensity; if (I < 0.04) return;   // faded out (death / muted): let the reverb ring, schedule nothing
    const ls = step % 64, bar = (ls / 16) | 0, inBar = ls % 16, sd = stepDur();
    const theme = THEMES[heroKey], heroic = section === 'hero', tense = section === 'tense', C = liveCue();
    // whose music this section plays: the world's, the hero's, a villain's, the lament
    const V = section === 'filmFoe' ? VILLAINS[film && film.foe || 'rival'] : section === 'villain' ? VILLAINS[villain] : null;
    const M = V || (heroic || section === 'film' ? theme : section === 'lament' ? { prog: LAMENT, lead: lamentOf(heroKey), calm: theme.calm }
            : tense ? { prog: TENSE, lead: [] } : pal);
    const P = M.prog[bar];
    if (inBar === 0){
      const bd = barDur() * 1.04;
      const withChoir = pal.pad === 'choir' || (C && C.choir) || (heroic && I > 0.7) || (V && V.choir);
      // the chord's pads are the heaviest thing the score builds (a dozen voices, filters and vibratos at the top of a
      // big fight's bar): one task per note, so a frame can be drawn between them instead of waiting on all of them
      // (the step is scheduled ~0.1s ahead, so they're all built long before t)
      for (const c of P.chord) soon(() => {
        strings(t, nf(c), bd, 0.014 + I * 0.024, 800 + I * 2200);
        if (I > 0.7 || heroic) strings(t, nf(c + 12), bd, 0.004 + I * 0.012, 1600 + I * 2600, true);   // the violins an octave up
        if (withChoir) choir(t, nf(c), bd, 0.008 + I * 0.016);
      });
      voice(t, nf(P.bass - 12), bd, { type: 'sine', gain: 0.05 + I * 0.05, attack: 0.3, filter: 380 });   // sub drone
      if (I > 0.4 || (heroic && I > 0.12) || (film && bar === 0)) timpani(t, nf(P.bass + 12), 0.06 + I * 0.2);
      if ((ls === 0 && I > 0.68) || (entered && I > 0.4)) crash(t, 0.04 + I * 0.05);   // the top of each phrase, and a new section
      entered = false;
      if (pal.kit === 'toll' && I > 0.2) metal(t, 0.03 + I * 0.03, nf(P.bass + 12));   // Exegol's bell tolls each bar
      if (pal.kit === 'taiko' && I > 0.5 && bar === 0) metal(t, 0.02, nf(24));
      if (C && C.riser && drive.focus) riser(t, bd * 0.96, 0.03 + I * 0.03);
    }
    // bass line
    const b = pal.bass[inBar];
    if (I > 0.3 && b){ const s = b === 2 ? 12 : b === 5 ? 7 : 0;
      bassNote(t, nf(P.bass + s), sd * (pal.kit === 'toll' ? 6 : 1.7), 0.06 + I * 0.06, pal.kit === 'taiko'); }
    // ostinato: the cue's, or the world's own arpeggio with galloping cellos under it once the fight is heavy
    const ost = (C && C.ost) || 'arp';
    ostinato(ost, t, P, inBar, I, sd);
    if (ost === 'arp' && I > 0.8) ostinato('gallop', t, P, inBar, I, sd, true);
    // drums
    if (I > 0.36 && pal.kick.includes(inBar) && (I > 0.8 || inBar === 0 || inBar === 8 || pal.kit !== 'rock')) drum('kick', t, I);
    if (I > 0.6 && pal.snare.includes(inBar)) drum('snare', t, I);
    if (I > 0.75 && pal.hat.includes(inBar)) drum('hat', t, I);
    // a fill into the top of the loop: the kit, with a timpani roll building under it
    if (I > 0.6 && bar === 3 && inBar >= 12){ const k = pal.kit === 'frame' ? frame : taiko; k(t, 0.25 + (inBar - 12) * 0.08);
      if (inBar === 12) timpRoll(t, nf(P.bass + 12), sd * 4, 0.05 + I * 0.08); }
    // boss: low brass stabs on the chord
    if (I > 0.9 && (bar === 0 || bar === 2) && (inBar === 0 || inBar === 6 || inBar === 12))
      for (const c of P.chord) soon(() => lowBrass(t, nf(c), sd * (inBar === 12 ? 3 : 2), 0.02));
    // going wrong: a minor-second brass alarm on the half bars, and the high strings trembling
    if (tense && I > 0.35){
      if (inBar === 0 || inBar === 8){ horn(t, nf(P.chord[0]), sd * 3, 0.026, 1.5); horn(t, nf(P.chord[0] + 1), sd * 3, 0.02, 1.5); }
      spic(t, nf(P.chord[2] + 12), sd * 0.9, 0.006 + I * 0.01);
    }
    // the epic layer over a boss fight (not under a cutscene, the lament or the victory statement)
    if (state === 'boss' && !film) epicStep(t, P, bar, inBar, ls, sd, M);
    // melody: soft in the lull, horns as the fight builds, trumpets over horns at its peak (the hero's theme sooner)
    for (const L of M.lead){ if (ls !== L[0]) continue;
      const f = nf(L[1]), d = sd * L[2];
      if (state === 'boss' && !film && EP.phase >= 3 && I > 0.55) soon(() => choir(t, f, d * 0.95, 0.01 + EP.lv * 0.005, 'ah', 0.05));   // phase III: sopranos on the tune
      if (I < 0.32) INSTR[M.calm || pal.calm](t, f, d, 0.05);
      else if (V && I > 0.55) BIG[V.big](t, f, d);
      else if (I > 0.82 || (heroic && I > 0.5)){ horn(t, f / 2, d * 0.94, 0.03); trumpet(t, f, d * 0.88, 0.02); }
      else if (I > 0.55 || heroic) horn(t, f / 2, d * 0.94, 0.026);
    }
  }
  function loop(){ if (!AC() || !started) return;
    sweep(AC().currentTime);
    if (nextTime < AC().currentTime) nextTime = AC().currentTime + 0.05;   // fell behind (tab throttled): resync, no catch-up burst
    // look 0.25 s ahead: a heavy frame (the title screen's temple on a slower machine) can hold the main thread past a
    // shorter window, and every step missed that way was a note dropped, the theme turning thin and quiet
    while (nextTime < AC().currentTime + 0.25){
      if (restUntil && nextTime >= restUntil){ restUntil = 0; step = 0; }   // the rest after a stinger is over: from the top
      if (step % 16 === 0) barTop();
      if (!restUntil) scheduleStep(nextTime);
      nextTime += stepDur(); step++;
      intensity += (target - intensity) * 0.03;   // smooth swell between states
      dangerLv += ((liveCue() && drive.danger ? 1 : 0) - dangerLv) * 0.1;
      EP.surge *= 0.975;   // a swell dies away over a couple of bars
      const et = state === 'boss' && !film ? Math.min(1, TIER[Math.min(3, EP.phase || 1)] + EP.surge * 0.35) : 0;
      EP.lv += (et - EP.lv) * (et > EP.lv ? 0.06 : 0.02);
    }
  }

  const M = {
    init(){ if (started || !AC() || !AE.ready) return;
      bus = AC().createGain(); bus.gain.value = 0.0001;
      comp = AC().createDynamicsCompressor(); compFor(0, 0);
      post = AC().createGain(); post.gain.value = postLevel();
      // a soft ceiling after the post lift: clean below -6 dBFS, rounding anything louder smoothly into -1 dBFS, so the
      // lifted title theme's rare spikes (a timpani hit, a brass stab) never reach the master limiter hot enough to clip
      // (a shaper reads its input over -1..1, so the signal goes in at a quarter and the curve spans -4..4)
      const into = AC().createGain(), ceil = AC().createWaveShaper(); into.gain.value = 0.25; ceil.curve = SOFT_CEIL; ceil.oversample = '2x';
      shelf = AC().createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = 120; shelf.gain.value = shelfDb();
      bus.connect(shelf); shelf.connect(comp); comp.connect(post); post.connect(into); into.connect(ceil); ceil.connect(AE.bus.music);
      delay = AC().createDelay(); delay.delayTime.value = 0.27; const fb = AC().createGain(); fb.gain.value = 0.33; const wet = AC().createGain(); wet.gain.value = 0.25;
      delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
      started = true; nextTime = AC().currentTime + 0.08; step = 0;
      // start AT the state's intensity, not from silence: the swell from 0 took the menu's soft theme ~2.5 s to play
      // its first note (nothing is scheduled under 0.04, and the pads only enter on a downbeat) and ~20 s to reach
      // its level. A quick fade in, so the first bar is heard right away.
      this.updateState(); intensity = target;
      bus.gain.setTargetAtTime(level(), AC().currentTime, 0.12);
      timer = setInterval(loop, 25);
    },
    setPalette(name){ const w = PALETTES[name] ? name : 'refuge'; if (w === want) return;
      const lifted = want === 'menu'; want = w;
      if (bus && lifted !== (w === 'menu')) setLevel(lifted ? 0.12 : 0.6); },   // a world with no palette of its own marches to the refuge's
    // a story-mission objective steering the score (see CUES); null when the mission ends
    setCue(name, d){
      cueName = name ? (CUES[name] ? name : 'battle') : null; cue = cueName && CUES[cueName];
      drive.urgency = (d && d.urgency) || 0; drive.danger = !!(d && d.danger); drive.focus = !!(d && d.focus);
    },
    setState(s){ if (s === state) return; prevState = state; state = s;
      if (s === 'boss' && prevState !== 'boss') this.bossSting();
      else if (s === 'victory') this.victorySting();
      else if (s === 'dead') this.deathSting();
      // the fight's loop stops under the stinger; its own theme (the full statement, the lament) comes in after it
      if (bus) setLevel(0.6);
      if (REST[s] && AC()){ restUntil = AC().currentTime + REST[s]; intensity = Math.min(intensity, 0.3); }
      else restUntil = 0;
    },

    /* ---------- cutscenes (game/cutscene.js) ----------
       sceneStart: the fight's drums and ostinato cut away on the next downbeat, the film bed comes in under the letterbox.
       sceneLine(tone, who): a line comes up ('foe': that villain's theme takes the bed on the next downbeat; 'hero' or
       'ally': the hero's) and the score steps back under it; null: no line up. sceneTitle: a title card's hit.
       sceneDraw(dur): a duel's last beat, a riser and a timpani roll into the first clash. sceneEnd(fight): the scene is
       over; a duel's or a boss's lands the fight on a downbeat with a hit, any other eases back into the score. */
    sceneStart(){ film = { foe: null, talk: null };
      if (bus) setLevel(0.4);
      if (!this.ok()) return;
      intensity = Math.min(intensity, FILM + 0.06); step = Math.ceil(step / 16) * 16; restUntil = 0;
      swell(AC().currentTime, 0.035, 0.5); },
    sceneLine(tone, who){ if (!film) return;
      if (tone === 'foe'){ film.talk = 'foe'; film.foe = villainOf(who); }
      else if (tone) film.talk = 'hero';
      const d = tone ? FILM_DIP : 1;
      if (d !== dip){ dip = d; if (bus) setLevel(0.25); } },
    sceneTitle(foe){ if (!this.ok()) return; const t = AC().currentTime;
      timpani(t, nf(12), 0.22); crash(t, 0.05);
      if (foe){ for (const c of [0, 7]) lowBrass(t, nf(c + 12), 1.8, 0.03); choir(t, nf(24), 2.2, 0.02); }
      else { [12, 19, 24, 28, 31].forEach((n, i) => pluck(t + i * 0.06, nf(n + 12), 1.2, 0.03)); for (const n of [12, 19, 24]) strings(t, nf(n), 2.6, 0.05, 2000); } },
    sceneDraw(dur){ if (!this.ok()) return; const t = AC().currentTime; dur = Math.max(0.8, dur || 1.5);
      riser(t, dur, 0.06); swell(t, 0.07, dur); timpRoll(t + dur * 0.45, nf(12), dur * 0.55, 0.16); },
    sceneEnd(fight){ if (!film) return; film = null;
      dip = 1; if (bus) setLevel(0.2);
      if (!fight || !this.ok() || G.mode !== 'play') return;
      intensity = Math.max(intensity, 0.7); step = Math.ceil(step / 16) * 16;
      if (bossUp() && state !== 'boss') return;   // a boss steps in: its own sting lands the fight (setState)
      const t = AC().currentTime;
      crash(t, 0.12); timpani(t, nf(12), 0.4); taiko(t, 0.4);
      for (const c of [0, 7, 12]) lowBrass(t, nf(c + 12), 1.2, 0.03); },
    sceneOn(){ return !!film; },
    setEnabled(on){ enabled = on; try { localStorage.setItem('sw_music', on ? '1' : '0'); } catch(e){}
      if (bus) setLevel(0.3); },
    toggle(){ this.setEnabled(!enabled); return enabled; },
    isOn(){ return enabled; },
    ok(){ return !!(AC() && bus && enabled); },

    /* ---------- stings ---------- */
    bossSting(){ if (!this.ok()) return; const t = AC().currentTime;
      timpRoll(t, nf(12), 0.5, 0.2); swell(t, 0.12, 0.5); crash(t + 0.5, 0.12);
      for (const c of [0, 7, 12]) lowBrass(t + 0.5, nf(c + 12), 1.6, 0.045);
      voice(t + 0.5, nf(-12), 2.0, { type: 'sine', gain: 0.14, attack: 0.02, filter: 300 });
      metal(t + 0.5, 0.05, nf(12)); },
    // a horn call at the start of a wave: root up to the fifth over a timpani hit
    waveSting(){ if (!this.ok()) return; const t = AC().currentTime;
      horn(t, nf(24), 0.3, 0.05); horn(t + 0.26, nf(31), 0.9, 0.055); trumpet(t + 0.26, nf(43), 0.7, 0.018);
      timpani(t + 0.26, nf(12), 0.3); taiko(t + 0.26, 0.35); },
    // an area cleared: a harp glissando up a major chord, the strings ring out under it
    clearSting(){ if (!this.ok()) return; const t = AC().currentTime;
      [12, 16, 19, 24, 28, 31, 36].forEach((n, i) => pluck(t + i * 0.05, nf(n + 12), 1.2, 0.04));
      for (const n of [12, 16, 19]) strings(t, nf(n), 2.4, 0.07, 2400);
      horn(t + 0.3, nf(31), 1.6, 0.03); },
    // a mission objective done: a brass fanfare up the major chord, timpani and a cymbal
    objectiveSting(){ if (!this.ok()) return; const t = AC().currentTime;
      [[24, 0, 0.18], [28, 0.16, 0.18], [31, 0.32, 0.18], [36, 0.48, 1.4]].forEach(([n, d, l]) => { trumpet(t + d, nf(n + 12), l, 0.03); horn(t + d, nf(n), l, 0.035); });
      timpRoll(t, nf(12), 0.46, 0.14); timpani(t + 0.48, nf(12), 0.35); crash(t + 0.48, 0.1);
      for (const n of [12, 16, 19, 24]) strings(t + 0.48, nf(n), 2.4, 0.06, 2600); },
    // a new power unlocked: a short bright trumpet fanfare
    unlockSting(){ if (!this.ok()) return; const t = AC().currentTime;
      [[24, 0], [28, 0.12], [31, 0.24]].forEach(([n, d]) => trumpet(t + d, nf(n + 12), d === 0.24 ? 0.9 : 0.16, 0.03));
      horn(t + 0.24, nf(24), 0.9, 0.03); swell(t, 0.05, 0.24); },
    // victory: the hero's theme opening as a fanfare, landing on a big major chord
    victorySting(){ if (!this.ok()) return; const t = AC().currentTime, head = THEMES[heroKey].lead.slice(0, 4), sd = 0.09;
      for (const [s, n, l] of head){ trumpet(t + s * sd, nf(n + 12), l * sd * 0.95, 0.03); horn(t + s * sd, nf(n), l * sd * 0.95, 0.035); }
      const end = (head[3][0] + head[3][2]) * sd;
      for (const n of [12, 16, 19, 24]){ horn(t + end, nf(n + 12), 2.2, 0.03); strings(t + end, nf(n), 3, 0.07, 2800); }
      trumpet(t + end, nf(36), 2, 0.025);
      timpRoll(t + end - 0.4, nf(12), 0.4, 0.15); timpani(t + end, nf(12), 0.4); crash(t + end, 0.14);
      voice(t + end, nf(0), 2.4, { type: 'sine', gain: 0.1, attack: 0.05, filter: 600 }); },
    deathSting(){ if (!AC() || !bus || !enabled) return; const t = AC().currentTime;
      voice(t, nf(0), 2.3, { type: 'sine', gain: 0.13, attack: 0.04, filter: 300 });
      strings(t, nf(12), 2.6, 0.08, 1200); strings(t, nf(15), 2.6, 0.06, 1200);
      strings(t + 0.6, nf(13), 2.0, 0.05, 1000);
      choir(t, nf(24), 2.6, 0.03); timpani(t, nf(12), 0.25); },

    debug(){ return { state, target, epic: { lv: +EP.lv.toFixed(2), phase: EP.phase, surge: +EP.surge.toFixed(2) }, intensity: +intensity.toFixed(3), palette: palName, section, cue: cueName, villain, film: film && { ...film }, dip, resting: !!restUntil, drive: { ...drive },
      danger: +dangerLv.toFixed(2), bpm: Math.round(pal.bpm * bpmMul), hero: heroKey, started, enabled, step,
      ctxState: AC() ? AC().state : 'none', ctxTime: AC() ? +AC().currentTime.toFixed(2) : 0 }; },
    updateState(){ if (!started) return;
      let s;
      if (G.mode === 'victory') s = 'victory';
      else if (G.mode === 'dead') s = 'dead';
      else if (G.mode !== 'play') s = 'menu';
      else if (bossUp()) s = 'boss';
      else { let warb = false, host = 0; for (const e of enemies){ if (e.dead || e.converted) continue; host++; if (e.warbringer) warb = true; }
        s = warb ? 'boss' : host >= 7 ? 'heavy' : host > 0 ? 'combat' : 'lull'; }
      if (film && s !== 'victory' && s !== 'dead'){ target = FILM; return; }   // a cutscene holds the fight's state (a boss's sting waits for the fight)
      this.setState(s);
      let t = s === 'menu' && want === 'menu' ? TITLE_I : BASE[s];
      const C = liveCue();
      if (C){
        t = Math.max(t, C.floor + drive.urgency * 0.3 + (drive.focus ? 0.05 : 0) + (drive.danger ? 0.15 : 0));
        if (C.ceil) t = Math.min(t, C.ceil);
      }
      target = Math.min(1, t);
      watchBoss();
    },

    /* ---------- the epic layer's swells (see the top) ----------
       bossBeat(dur): the boss is driven to a knee for `dur` seconds: the fight's loop stops, a choir and the brass climb
       under a riser and a timpani roll into his rise. bossPhase(p): he rises in phase p (or the Herald turns): a tutti
       hit lands a fresh downbeat and the layer surges. bossFinish(k): he falls: the score stops under a held major
       chord, the choir and the brass ringing out (k scales it; a Warbringer's is smaller). */
    bossBeat(dur){ if (!this.ok()) return; const t = AC().currentTime; dur = Math.max(1, dur || 1.8);
      restUntil = t + dur + 0.8; EP.surge = Math.max(EP.surge, 0.5);
      for (const c of [12, 19, 24]) soon(() => choir(t, nf(c), dur + 0.15, 0.02, 'oo', dur * 0.9));
      choir(t, nf(25), dur + 0.15, 0.008, 'oo', dur);   // a semitone rubbing on the top: the dread of it
      brassSwell(t, nf(12), dur, 0.032); brassSwell(t, nf(19), dur, 0.022);
      riser(t, dur, 0.05); swell(t, 0.06, dur); timpRoll(t + dur * 0.35, nf(12), dur * 0.65, 0.12);
      voice(t, nf(-12), dur + 0.3, { type: 'sine', gain: 0.08, attack: dur * 0.6, filter: 260 }); },
    bossPhase(p){ if (p && p <= EP.phase) return; if (p) EP.phase = p;
      EP.surge = 1;
      if (!this.ok()) return;
      // land it on a fresh downbeat: the phrase starts again from the top under the hit
      restUntil = 0; step = Math.ceil(step / 16) * 16;
      if (nextTime < AC().currentTime + 0.02) nextTime = AC().currentTime + 0.02;
      intensity = Math.max(intensity, 0.9); entered = true;
      tutti(nextTime, p >= 3 ? 1.15 : 1, true);
      if (p >= 3) for (const c of [31, 36]) choir(nextTime, nf(c), 2.6, 0.012, 'ah', 0.06); },
    bossFinish(k){ const w = EP.who; EP.done = w; EP.surge = 0;
      if (!this.ok()) return; k = k || 1; const t = AC().currentTime + 0.03;
      if (!REST[state]) restUntil = t + 2.6 * k + 0.6;   // the loop stops under the chord (a victory's own rest takes over)
      boom(t, 0.6 * k); taiko(t, 0.55 * k); crash(t, 0.16 * k); timpRoll(t, nf(12), 0.5, 0.14 * k); timpani(t + 0.5, nf(12), 0.45 * k);
      for (const c of [0, 7, 12]) lowBrass(t, nf(c + 12), 2.4 * k, 0.04 * k);
      for (const c of [12, 16, 19, 24, 28]) soon(() => choir(t, nf(c + 12), 3.6 * k, 0.018 * k, 'ah', 0.08));
      for (const c of [12, 19]) strings(t + 0.5, nf(c + 12), 3.4 * k, 0.05 * k, 2600);
      trumpet(t + 0.5, nf(36), 2.2 * k, 0.022 * k); horn(t + 0.5, nf(24), 2.4 * k, 0.03 * k);
      voice(t, nf(0), 3 * k, { type: 'sine', gain: 0.12 * k, attack: 0.03, filter: 320 }); },
  };
  return M;
})();
