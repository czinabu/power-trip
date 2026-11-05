// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CHARACTER CUSTOMIZER options: one list of rows per hero, shown top to bottom in the customizer panel.
// Each row offers named options; an option's `set` is a partial look for that hero (appearance.js): parts, palette
// and/or build. The player's choice is saved as { row id: option id }, so renaming a colour value here restyles every
// saved hero, and an option that is removed simply falls back to the row's first one.
//   kind 'color' draws round swatches (`sw` is the swatch colour, or the first palette colour when left out)
//   kind 'part'  draws named chips
// Add an option: append it to a row. Add an outfit piece: write the variant in jedi.js / mando.js, then name it here.
// `earn: {...}` (the workbench's saber parts, data/saber-parts.js) keeps it locked until the hero's PROFILE has earned it:
// kept across every run and NEW GAME, unlike a chapter `unlock`.
// `unlock: '<chapter id>'` (data/campaign.js) keeps an option locked until that chapter of the hero's own campaign is
// cleared, and it is announced at that chapter's close; `unlock: 'won'` until the hero's campaign is beaten. An option
// with no `unlock` is open from the start (the body: skin, hair, face, eyes, build; and each row's basics). A row's
// first OPEN option is what a hero wears when nothing open is picked, so a row's first option, once earned, goes on by
// itself (the trooper's ARC kit at his promotion, the Mando's cape and pauldrons). game/wardrobe.js keeps the ledger.

import { mergeLook } from '../player/model/appearance.js';
import { optionOpen, trooperFork } from '../game/wardrobe.js';
import { BENCH } from './saber-parts.js';
import { LOCKER } from './trooper-locker.js';
import { FORGE } from './beskar-forge.js';

const pal = (palette) => ({ palette });
// the workbench's parts as customizer rows: a crystal sets the blade colour, a part its piece of the hilt (look.jedi.hilt)
const PIECE = { hilt: 'body', emitter: 'emitter', pommel: 'pommel' };
function benchRows(){
  return BENCH.map(r => ({ id: r.id, label: r.label, kind: r.id === 'saber' ? 'color' : 'part', bench: true,
    options: r.parts.map(p => ({ id: p.id, name: p.name, ...(p.earn ? { earn: p.earn } : {}),
      ...(r.id === 'saber' ? (p.col == null ? { sw: 0x35c8ff, set: { saber: null } } : { set: { saber: p.col } }) : { set: { hilt: { [PIECE[r.id]]: p.id } } }) })) }));
}
// the trooper's ARMORY LOCKER and the Mando's BESKAR FORGE (data/trooper-locker.js, data/beskar-forge.js) as customizer
// rows: each part's `set` is what it changes on the look (a sidegrade row's parts change nothing there)
function kitRows(bench){
  return bench.map(r => ({ id: r.id, label: r.label, kind: r.kind, bench: true, ...(r.side ? { side: r.side } : {}),
    options: r.parts.map(p => ({ id: p.id, name: p.name, ...(p.earn ? { earn: p.earn } : {}), ...(p.unlock ? { unlock: p.unlock } : {}), set: r.set(p) || {} })) }));
}
const parts = (p) => ({ parts: p });

export const CUSTOMIZE = {
  jedi: [
    { id: 'skin', label: 'SKIN TONE', kind: 'color', options: [
      { id: 'umber',    name: 'Umber',     set: pal({ skin: 0x5c3826 }) },
      { id: 'ebony',    name: 'Ebony',     set: pal({ skin: 0x3f261a }) },
      { id: 'bronze',   name: 'Bronze',    set: pal({ skin: 0x8a5536 }) },
      { id: 'tan',      name: 'Tan',       set: pal({ skin: 0xa86b45 }) },
      { id: 'olive',    name: 'Olive',     set: pal({ skin: 0xc58c64 }) },
      { id: 'sand',     name: 'Sand',      set: pal({ skin: 0xe0ac86 }) },
      { id: 'pale',     name: 'Pale',      set: pal({ skin: 0xf1c9a5 }) },
      { id: 'mirialan', name: 'Mirialan',  set: pal({ skin: 0x8aa66a }) },
      { id: 'pantoran', name: 'Pantoran',  set: pal({ skin: 0x6f9fc8 }) },
      { id: 'zabrak',   name: 'Zabrak',    set: pal({ skin: 0xa8442e }) },
    ] },
    { id: 'hair', label: 'HAIRSTYLE', kind: 'part', options: [
      { id: 'bald',    name: 'Bald',     set: parts({ hair: 'bald' }) },
      { id: 'buzz',    name: 'Buzzed',   set: parts({ hair: 'buzz' }) },
      { id: 'short',   name: 'Short',    set: parts({ hair: 'short' }) },
      { id: 'topknot', name: 'Topknot',  set: parts({ hair: 'topknot' }) },
      { id: 'long',    name: 'Long',     set: parts({ hair: 'long' }) },
      { id: 'braid',   name: 'Padawan',  set: parts({ hair: 'braid' }) },
    ] },
    { id: 'beard', label: 'FACIAL HAIR', kind: 'part', options: [
      { id: 'none',      name: 'Clean',     set: parts({ beard: 'none' }) },
      { id: 'stubble',   name: 'Stubble',   set: parts({ beard: 'stubble' }) },
      { id: 'moustache', name: 'Moustache', set: parts({ beard: 'moustache' }) },
      { id: 'goatee',    name: 'Goatee',    set: parts({ beard: 'goatee' }) },
      { id: 'full',      name: 'Full beard', set: parts({ beard: 'full' }) },
    ] },
    { id: 'hairColor', label: 'HAIR COLOUR', kind: 'color', options: [
      { id: 'black',  name: 'Black',  set: pal({ hair: 0x140e0a }) },
      { id: 'brown',  name: 'Brown',  set: pal({ hair: 0x3a2414 }) },
      { id: 'auburn', name: 'Auburn', set: pal({ hair: 0x6a2c16 }) },
      { id: 'blond',  name: 'Blond',  set: pal({ hair: 0xb89656 }) },
      { id: 'grey',   name: 'Grey',   set: pal({ hair: 0x85817c }) },
      { id: 'white',  name: 'White',  set: pal({ hair: 0xd8d4cc }) },
    ] },
    { id: 'eyes', label: 'EYES', kind: 'color', options: [
      { id: 'brown', name: 'Brown', set: pal({ eyes: 0x2a1a10 }) },
      { id: 'hazel', name: 'Hazel', set: pal({ eyes: 0x5a4220 }) },
      { id: 'green', name: 'Green', set: pal({ eyes: 0x2f5a34 }) },
      { id: 'blue',  name: 'Blue',  set: pal({ eyes: 0x2c5a8a }) },
      { id: 'grey',  name: 'Grey',  set: pal({ eyes: 0x5e6670 }) },
      { id: 'sith',  name: 'Sith gold', set: pal({ eyes: 0xd8a020 }), unlock: 'won' },
    ] },
    { id: 'hood', label: 'HOOD', kind: 'part', options: [
      { id: 'down', name: 'Down', set: parts({ head: 'bald' }) },
      { id: 'up',   name: 'Up',   set: parts({ head: 'hood' }), unlock: 'archive' },
    ] },
    // the long outer robe over the tunic (player/model/jedi.js outerRobe): its hood up or down follows the HOOD row
    { id: 'outerRobe', label: 'OUTER ROBE', kind: 'part', options: [
      { id: 'off', name: 'Off', set: parts({ robe: 'none' }) },
      { id: 'on',  name: 'On',  set: parts({ robe: 'outer' }) },
    ] },
    // robe + the tabard panels over it, as one pair so they always go together
    { id: 'robe', label: 'ROBES', kind: 'color', options: [
      { id: 'earth',   name: 'Earth brown', set: pal({ robe: 0x3b2a1e, tabard: 0x6b4f37 }) },
      { id: 'umbra',   name: 'Umbra black', set: pal({ robe: 0x17161b, tabard: 0x2c2a31 }), unlock: 'jakku' },
      { id: 'ash',     name: 'Ash grey',    set: pal({ robe: 0x4a4b50, tabard: 0x6b6c72 }), unlock: 'siege' },
      { id: 'sand',    name: 'Desert sand', set: pal({ robe: 0x8c7656, tabard: 0xb39d78 }), unlock: 'refuge' },
      { id: 'temple',  name: 'Temple blue', set: pal({ robe: 0x1e2a4a, tabard: 0x34466e }), unlock: 'trial-first' },
      { id: 'forest',  name: 'Forest',      set: pal({ robe: 0x24331f, tabard: 0x3e5236 }), unlock: 'lothal' },
      { id: 'crimson', name: 'Crimson',     set: pal({ robe: 0x4a1414, tabard: 0x6e2424 }), unlock: 'mustafar' },
    ] },
    { id: 'tunic', label: 'TUNIC', kind: 'color', options: [
      { id: 'tan',   name: 'Tan',      set: pal({ tunic: 0x9c7d58 }) },
      { id: 'cream', name: 'Cream',    set: pal({ tunic: 0xd2c4a2 }) },
      { id: 'white', name: 'White',    set: pal({ tunic: 0xe6e2d8 }), unlock: 'siege' },
      { id: 'brown', name: 'Brown',    set: pal({ tunic: 0x7a5c3e }), unlock: 'refuge' },
      { id: 'grey',  name: 'Grey',     set: pal({ tunic: 0x6e6a66 }), unlock: 'hoth' },
      { id: 'black', name: 'Black',    set: pal({ tunic: 0x2e2a28 }), unlock: 'chase' },
    ] },
    // THE SABER WORKBENCH's rows (data/saber-parts.js): the kyber crystal (the blade's colour: the form's own, blue / green /
    // violet so the colour tells the stance, or a crystal in a hue no form uses), the hilt, the emitter and the pommel.
    // `bench` rows show on the customizer's SABER tab, not its LOOKS; their parts are earned (`earn`, game/wardrobe.js)
    ...benchRows(),
    { id: 'build', label: 'BUILD', kind: 'part', options: [
      { id: 'standard', name: 'Standard', set: { build: { bulk: 1, shoulders: 1 } } },
      { id: 'lean',     name: 'Lean',     set: { build: { bulk: 0.9, shoulders: 0.94 } } },
      { id: 'broad',    name: 'Broad',    set: { build: { bulk: 1.1, shoulders: 1.07 } } },
    ] },
    // how worn the hero starts each fight: dust, scuffs and chipped paint (player/model/wear.js); hits add soot as it goes
    { id: 'wear', label: 'BATTLE WEAR', kind: 'part', options: [
      { id: 'fresh',  name: 'Fresh',       set: { wear: 0 } },
      { id: 'field',  name: 'Field',       set: { wear: 0.4 }, unlock: 'archive' },
      { id: 'worn',   name: 'Battle-worn', set: { wear: 0.9 }, unlock: 'hoth' },
    ] },
  ],

  mando: [
    { id: 'helmet', label: 'HELMET', kind: 'part', options: [
      { id: 'clean',  name: 'Classic', set: parts({ helmet: 'clean' }) },
      { id: 'tvisor', name: 'Hunter',  set: parts({ helmet: 'tvisor' }), unlock: 'trial-first' },
      { id: 'crest',  name: 'Crested', set: parts({ helmet: 'crest' }), unlock: 'mustafar' },
    ] },
    { id: 'shoulders', label: 'SHOULDERS', kind: 'part', options: [
      { id: 'pauldrons', name: 'Pauldrons', set: parts({ arms: 'pauldrons' }), unlock: 'refuge' },
      { id: 'heavy',     name: 'Heavy',     set: parts({ arms: 'heavy' }), unlock: 'trial-knight' },
      { id: 'bare',      name: 'Scout',     set: parts({ arms: 'bare' }) },
    ] },
    { id: 'cape', label: 'CAPE', kind: 'part', options: [
      { id: 'half', name: 'Half',  set: parts({ cape: 'half' }), unlock: 'siege' },
      { id: 'full', name: 'Full',  set: parts({ cape: 'full' }), unlock: 'hoth' },
      { id: 'none', name: 'None',  set: parts({ cape: 'none' }) },
    ] },
    // main plates + the darker secondary plates, as one scheme
    { id: 'armor', label: 'ARMOUR', kind: 'color', options: [
      { id: 'beskar',  name: 'Beskar',      set: pal({ beskar: 0x9aa7b5, beskar2: 0x667381 }) },
      { id: 'gunmetal',name: 'Gunmetal',    set: pal({ beskar: 0x5c636c, beskar2: 0x3b4048 }), unlock: 'archive' },
      { id: 'fett',    name: 'Hunter green',set: pal({ beskar: 0x5f6e45, beskar2: 0x7e4428 }), unlock: 'trial-acrobat' },
      { id: 'watch',   name: 'Death Watch', set: pal({ beskar: 0x3e5f8a, beskar2: 0xaab4c0 }), unlock: 'mustafar' },
      { id: 'clan',    name: 'Clan red',    set: pal({ beskar: 0x8a2a26, beskar2: 0x4a4f58 }), unlock: 'jakku' },
      { id: 'gold',    name: 'Gold',        set: pal({ beskar: 0xc9a24a, beskar2: 0x76664a }), unlock: 'won' },
      { id: 'white',   name: 'Ivory',       set: pal({ beskar: 0xd6dbe0, beskar2: 0x8a929b }), unlock: 'hoth' },
      { id: 'shadow',  name: 'Shadow',      set: pal({ beskar: 0x2c2f35, beskar2: 0x1b1d21 }), unlock: 'chase' },
    ] },
    { id: 'accent', label: 'ACCENT', kind: 'color', options: [
      { id: 'rust',   name: 'Rust',   set: pal({ accent: 0xb84327 }) },
      { id: 'blue',   name: 'Blue',   set: pal({ accent: 0x2f6b8a }), unlock: 'siege' },
      { id: 'gold',   name: 'Gold',   set: pal({ accent: 0xc9a24a }), unlock: 'lothal' },
      { id: 'green',  name: 'Green',  set: pal({ accent: 0x4f7a3a }), unlock: 'lothal' },
      { id: 'violet', name: 'Violet', set: pal({ accent: 0x6a3a8a }), unlock: 'mustafar' },
      { id: 'white',  name: 'White',  set: pal({ accent: 0xd8dde2 }), unlock: 'trial-knight' },
      { id: 'black',  name: 'Black',  set: pal({ accent: 0x1f2126 }), unlock: 'chase' },
    ] },
    { id: 'suit', label: 'FLIGHT SUIT', kind: 'color', options: [
      { id: 'charcoal', name: 'Charcoal', set: pal({ suit: 0x2e343d }) },
      { id: 'brown',    name: 'Brown',    set: pal({ suit: 0x4a3a2a }) },
      { id: 'olive',    name: 'Olive',    set: pal({ suit: 0x3c4230 }), unlock: 'archive' },
      { id: 'navy',     name: 'Navy',     set: pal({ suit: 0x222b40 }), unlock: 'lothal' },
      { id: 'black',    name: 'Black',    set: pal({ suit: 0x16171a }), unlock: 'jakku' },
    ] },
    { id: 'cloth', label: 'CAPE COLOUR', kind: 'color', options: [
      { id: 'sand',  name: 'Sand',     set: pal({ cloth: 0x7b6b52 }) },
      { id: 'black', name: 'Black',    set: pal({ cloth: 0x1e1d20 }), unlock: 'refuge' },
      { id: 'red',   name: 'Red',      set: pal({ cloth: 0x6a1d1a }), unlock: 'trial-acrobat' },
      { id: 'grey',  name: 'Grey',     set: pal({ cloth: 0x5a5a5e }), unlock: 'hoth' },
      { id: 'blue',  name: 'Blue',     set: pal({ cloth: 0x27385a }), unlock: 'mustafar' },
    ] },
    // THE BESKAR FORGE's rows (data/beskar-forge.js): the forged sidegrade, the signet, the vambraces and the chest kit.
    // `bench` rows show on the forge's own screen (ui/kitbench.js), not the customizer's LOOKS; their pieces are earned
    ...kitRows(FORGE),
    { id: 'build', label: 'BUILD', kind: 'part', options: [
      { id: 'standard', name: 'Standard', set: { build: { bulk: 1, shoulders: 1 } } },
      { id: 'lean',     name: 'Lean',     set: { build: { bulk: 0.92, shoulders: 0.95 } } },
      { id: 'heavy',    name: 'Heavy',    set: { build: { bulk: 1.12, shoulders: 1.08 } } },
    ] },
    // how worn the hero starts each fight: dust, scuffs and chipped paint (player/model/wear.js); hits add soot as it goes
    { id: 'wear', label: 'BATTLE WEAR', kind: 'part', options: [
      { id: 'fresh',  name: 'Fresh',       set: { wear: 0 } },
      { id: 'field',  name: 'Field',       set: { wear: 0.4 }, unlock: 'trial-first' },
      { id: 'worn',   name: 'Battle-worn', set: { wear: 0.9 }, unlock: 'jakku' },
    ] },
  ],
  // the clone trooper (player/model/trooper.js): the gear, the legion and its colours, the kama. He starts a plain
  // trooper in Phase II plates, earns a captain's helmet and pauldron at his first promotion and the ARC kit at his second
  // (game/wardrobe.js PROMOTIONS)
  trooper: [
    // `fork`: open once the trooper has taken that signature path (game/wardrobe.js); `forkPick`: what the row wears,
    // when nothing is picked, after the latest path taken (the Commando's Katarn kit, no kama)
    { id: 'helmet', label: 'HELMET', kind: 'part', forkPick: { commando: 'commando' }, options: [
      { id: 'arc',     name: 'ARC',      set: parts({ helmet: 'arc' }), unlock: 'mustafar' },
      { id: 'commando', name: 'Commando', set: parts({ helmet: 'commando' }), unlock: 'mustafar', fork: 'commando' },
      { id: 'captain', name: 'Captain',  set: parts({ helmet: 'captain' }), unlock: 'trial-first' },
      { id: 'phase2',  name: 'Trooper',  set: parts({ helmet: 'phase2' }) },
    ] },
    { id: 'shoulders', label: 'SHOULDERS', kind: 'part', forkPick: { commando: 'commando' }, options: [
      { id: 'arc',     name: 'ARC pauldron', set: parts({ arms: 'arc' }), unlock: 'mustafar' },
      { id: 'commando', name: 'Commando plates', set: parts({ arms: 'commando' }), unlock: 'mustafar', fork: 'commando' },
      { id: 'captain', name: 'Captain',      set: parts({ arms: 'captain' }), unlock: 'trial-first' },
      { id: 'phase2',  name: 'Bare',         set: parts({ arms: 'phase2' }) },
    ] },
    // the ARC's black collar yoke and pouches, and the legion paint on the legs: on, or plain Phase II plates
    { id: 'gear', label: 'GEAR', kind: 'part', forkPick: { commando: 'commando' }, options: [
      { id: 'arc',    name: 'ARC',     set: parts({ torso: 'arc', legs: 'arc' }), unlock: 'mustafar' },
      { id: 'commando', name: 'Katarn plate', set: parts({ torso: 'commando', legs: 'commando' }), unlock: 'mustafar', fork: 'commando' },
      { id: 'phase2', name: 'Phase II', set: parts({ torso: 'phase2', legs: 'phase2' }) },
    ] },
    { id: 'kama', label: 'KAMA', kind: 'part', forkPick: { commando: 'none' }, options: [
      { id: 'long', name: 'Kama', set: parts({ kama: 'long' }), unlock: 'mustafar' },
      { id: 'none', name: 'None', set: parts({ kama: 'none' }) },
    ] },
    // the legion's colour: the pauldron, the visor paint, the knees and the bands. A plain trooper's are grey; each rank
    // he earns brings its own (the Legends ranks: green sergeant, blue lieutenant, red captain, yellow commander), listed
    // highest first so the newest rank's colour goes on by itself unless one is picked (game/wardrobe.js PROMOTIONS)
    { id: 'legion', label: 'LEGION', kind: 'color', options: [
      { id: 'yellow', name: 'Commander yellow', set: pal({ mark: 0xd6b23a }), unlock: 'trial-knight' },
      { id: 'red',    name: 'Captain red',      set: pal({ mark: 0xb0302a }), unlock: 'trial-first' },
      { id: 'blue',   name: 'Lieutenant blue',  set: pal({ mark: 0x2f7fd6 }), unlock: 'refuge' },
      { id: 'green',  name: 'Sergeant green',   set: pal({ mark: 0x4a7a3a }), unlock: 'siege' },
      { id: 'grey',   name: 'Trooper grey',     set: pal({ mark: 0x8a949e }) },
      { id: 'orange', name: 'Gold-orange',      set: pal({ mark: 0xd8822a }), unlock: 'archive' },
      { id: 'violet', name: 'Violet',           set: pal({ mark: 0x6a4a9a }), unlock: 'jakku' },
      { id: 'black',  name: 'Black',            set: pal({ mark: 0x1f2126 }), unlock: 'chase' },
    ] },
    { id: 'cloth', label: 'KAMA COLOUR', kind: 'color', options: [
      { id: 'black', name: 'Black', set: pal({ cloth: 0x141518 }) },
      { id: 'blue',  name: 'Blue',  set: pal({ cloth: 0x22406a }), unlock: 'mustafar' },
      { id: 'red',   name: 'Red',   set: pal({ cloth: 0x6a1d1a }), unlock: 'spearhead' },
      { id: 'khaki', name: 'Khaki', set: pal({ cloth: 0x7b6b52 }), unlock: 'chase' },
      { id: 'grey',  name: 'Grey',  set: pal({ cloth: 0x4a4c50 }), unlock: 'won' },
    ] },
    // THE ARMORY LOCKER's rows (data/trooper-locker.js): the power pack and the squad specialist (the two sidegrades),
    // the armour paint (the plates' colour: it was the PLATES row here, same id), the company markings, the helmet gear and
    // the DC-15's stock and finish. `bench` rows show on the locker's own screen (ui/kitbench.js); their parts are earned
    ...kitRows(LOCKER),
    { id: 'build', label: 'BUILD', kind: 'part', options: [
      { id: 'standard', name: 'Standard', set: { build: { bulk: 1, shoulders: 1 } } },
      { id: 'lean',     name: 'Lean',     set: { build: { bulk: 0.92, shoulders: 0.95 } } },
      { id: 'heavy',    name: 'Heavy',    set: { build: { bulk: 1.12, shoulders: 1.08 } } },
    ] },
    { id: 'wear', label: 'BATTLE WEAR', kind: 'part', options: [
      { id: 'fresh',  name: 'Fresh',       set: { wear: 0 } },
      { id: 'field',  name: 'Field',       set: { wear: 0.4 }, unlock: 'siege' },
      { id: 'worn',   name: 'Battle-worn', set: { wear: 0.9 }, unlock: 'hoth' },
    ] },
  ],
};

// the option a row has picked (its first one when nothing, or an unknown id, was saved)
export function pickedOption(row, picks = {}){
  return row.options.find(o => o.id === picks[row.id]) || row.options[0];
}

// picks { jedi: { rowId: optionId }, mando: {...} } → a look (appearance.js) holding just what the options set
export function lookFromPicks(picks = {}){
  const look = {};
  for (const hero in CUSTOMIZE){
    let h = {};
    for (const row of CUSTOMIZE[hero]) h = mergeLook(h, pickedOption(row, picks[hero]).set);
    look[hero] = h;
  }
  return look;
}

// the option a hero WEARS for a row: the one picked if it is open (game/wardrobe.js), else the row's first open one
export function wornOption(hero, row, picks = {}){
  const fp = row.forkPick && picks[row.id] == null && row.forkPick[trooperFork()];
  const pref = fp && row.options.find(x => x.id === fp);
  if (pref && optionOpen(hero, row, pref)) return pref;
  const o = pickedOption(row, picks);
  return optionOpen(hero, row, o) ? o : (row.options.find(x => optionOpen(hero, row, x)) || row.options[0]);
}
// picks → the picks actually worn: every row of every hero, a locked pick swapped for the row's first open option.
// What dresses the player, the showcase and what a co-op partner is sent (they build it as it comes)
export function wornPicks(picks = {}){
  const out = {};
  for (const hero in CUSTOMIZE){
    out[hero] = {};
    for (const row of CUSTOMIZE[hero]) out[hero][row.id] = wornOption(hero, row, picks[hero]).id;
  }
  return out;
}

// the swatch colour for a colour option
export const swatchOf = o => o.sw ?? o.set.saber ?? Object.values(o.set.palette || {})[0];
