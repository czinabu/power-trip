// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARMORY LOCKER, as data: the clone trooper's version of the Jedi's saber workbench (data/saber-parts.js). Edit the
// words and numbers freely. ui/kitbench.js shows the locker, player/model/trooper.js and model/weapons.js (dc15) build the
// parts, game/saber-bench.js fits the power pack to the run, allies/squad.js fits the specialist, game/profile.js hands
// parts out.
//
// PARTS ARE EARNED, AND KEPT, exactly as the workbench's are: `earn` reads the trooper's persistent profile (one ask per
// part, the same asks as data/saber-parts.js: chapter / won / duels / missions / arcade / waves), so a part outlives every
// run and NEW GAME. An option with `unlock` instead is one of the campaign's chapter looks (data/customize.js), kept here
// because it belongs in the locker. No `earn` and no `unlock`: in the locker from the first day.
//
// TWO SIDEGRADES, THE SAME GUARDRAIL AS A KYBER CRYSTAL. The POWER PACK changes the trooper's own numbers (`fx` on
// player.up as [field, op, value], put on and taken off cleanly by game/saber-bench.js): one gain at or under ATTUNE_CAP,
// paid for elsewhere by at least two thirds of its size. The SPECIALIST changes one squadmate (SGT. VANT, the first on
// the roster) into one of the squad's own specialist roles (data/allies.js SQUAD.roles): what the role is good at is the
// gain, what it gives up (a medic's light bolts, a heavy's loose bursts, a marksman's slow shots) is the cost.
// Everything else is looks only: how the trooper reads, never how hard he hits.
//
// No imports but the leaf data/saber-parts.js: data/customize.js and the model read this while the modules load.
import { ATTUNE_CAP } from './saber-parts.js';
export { ATTUNE_CAP };

// THE POWER PACK slotted into the DC-15 (and the DC-17s' cells): the sidegrade the trooper carries into every mode
export const POWER_PACKS = [
  { id: 'standard', name: 'Standard issue', att: 'STANDARD ISSUE', ds: 'The pack every clone is handed on Kamino. No sidegrade.', fx: [] },
  { id: 'cryo', name: 'Cryo-pack', earn: { chapter: 'archive' }, att: 'CRYO-PACK', col: 0x8fe8ff,
    ds: 'Guns cool 12% faster · −8% shot damage', fx: [['coolMul', '*', 1.12], ['dmg', '*', 0.92]] },
  { id: 'overcharge', name: 'Overcharged', earn: { chapter: 'hoth' }, att: 'OVERCHARGED CELL', col: 0xffb84a,
    ds: '+7% shot damage · +10% heat a shot', fx: [['dmg', '*', 1.07], ['heatMul', '*', 1.1]] },
  { id: 'cycler', name: 'Rapid cycler', earn: { waves: 10 }, att: 'RAPID CYCLER', col: 0xb8ff6a,
    ds: '+6% fire rate · +8% heat a shot', fx: [['fireRate', '*', 1.06], ['heatMul', '*', 1.08]] },
  { id: 'reserve', name: 'Reserve cell', earn: { missions: 2 }, att: 'RESERVE CELL', col: 0xd08aff,
    ds: '+10% field energy regen · guns cool 8% slower', fx: [['forceRegen', '*', 1.1], ['coolMul', '*', 0.92]] },
];

// THE SPECIALIST: SGT. VANT's kit. `role` is a data/allies.js SQUAD.roles key, `pins` makes his bolts pin (as HAMMER's
// rotary does), `tag` is his mark in the squad panel
export const SPECIALISTS = [
  { id: 'rifle', name: 'Rifleman', att: 'RIFLEMAN', ds: 'Sgt. Vant carries his DC-15 like the rest of the squad. No sidegrade.' },
  { id: 'medic', name: 'Medic', earn: { chapter: 'refuge' }, role: 'medic', tag: '✚', att: 'FIELD MEDIC',
    ds: 'Vant patches you and the squad near him · his bolts hit a third lighter' },
  { id: 'heavy', name: 'Heavy', earn: { chapter: 'lothal' }, role: 'heavy', pins: true, tag: '▮', att: 'HEAVY GUNNER',
    ds: 'Vant carries a rotary that pins what it hits · loose bursts, each bolt lighter' },
  { id: 'marksman', name: 'Marksman', earn: { arcade: 2 }, role: 'scout', tag: '⌖', att: 'MARKSMAN',
    ds: 'Vant picks off the far line with a long rifle · slow shots, and he takes hits worse' },
];
export const specialistOf = (id) => SPECIALISTS.find(s => s.id === id) || SPECIALISTS[0];

/* ---------- the looks ---------- */
// ARMOUR PAINT: the plates' colour. The first four are the campaign's (their `unlock`s as they were on the customizer's
// PLATES row: the row id stays 'plate', so saved picks carry over); the rest are earned
export const PAINTS = [
  { id: 'white',  name: 'White',   set: { palette: { plate: 0xe8e8e3 } } },
  { id: 'ivory',  name: 'Ivory',   set: { palette: { plate: 0xd8d0b8 } }, unlock: 'lothal' },
  { id: 'grey',   name: 'Grey',    set: { palette: { plate: 0xa8adb2 } }, unlock: 'jakku' },
  { id: 'shadow', name: 'Shadow',  set: { palette: { plate: 0x34373c, grey: 0x16171a } }, unlock: 'spearhead' },
  { id: 'desert', name: 'Desert',  set: { palette: { plate: 0xcbb48a } }, earn: { arcade: 1 }, line: 'Sand-washed for the dune worlds.' },
  { id: 'jungle', name: 'Jungle',  set: { palette: { plate: 0x7d8462 } }, earn: { waves: 5 }, line: 'Swamp-green, for the long nights on the line.' },
  { id: 'guard',  name: 'Guard red', set: { palette: { plate: 0x9a302b } }, earn: { won: 1 }, line: 'The capital\'s own colour. Worn by the few who came home.' },
];
// COMPANY MARKINGS: painted in the legion colour (the customizer's LEGION row), over whatever plates he wears
export const MARKINGS = [
  { id: 'none',    name: 'Plain',      line: 'Clean plates. Nothing to say who you are.' },
  { id: 'stripes', name: 'Stripes',    earn: { chapter: 'siege' }, line: 'A stripe over the bucket and down each arm.' },
  { id: 'tally',   name: 'Kill tally', earn: { duels: 3 }, line: 'Hash marks on the chest plate, one for every duellist dropped.' },
  { id: 'sigil',   name: 'Company sigil', earn: { chapter: 'trial-knight' }, line: 'The company\'s winged crest on the chest.' },
];
// HELMET GEAR: what's clipped to the bucket
export const HELMET_GEAR = [
  { id: 'none',    name: 'As issued',  line: 'Just the bucket.' },
  { id: 'macro',   name: 'Macrobinoculars', earn: { missions: 1 }, line: 'A scope visor on a hinge, swung down over the T.' },
  { id: 'visor',   name: 'Sun visor',  earn: { chapter: 'jakku' }, line: 'A wide brim over the visor, against the glare.' },
  { id: 'antenna', name: 'Comms antenna', earn: { waves: 15 }, line: 'A long whip antenna for the company net.' },
];
// THE DC-15's STOCK and FINISH (model/weapons.js dc15). The barrel and scope are the rifle's MODULES (data/trooper.js
// RIFLE_MODS), swapped in the fight with 1: the locker never changes those
export const STOCKS = [
  { id: 'skeletal', name: 'Skeletal', line: 'The open frame stock every DC-15 ships with.' },
  { id: 'full',     name: 'Full stock', earn: { chapter: 'trial-first' }, line: 'A solid stock with a rubber butt pad.' },
  { id: 'folded',   name: 'Folded',   earn: { arcade: 1 }, line: 'The stock folded down the side: short and quick to bring up.' },
];
export const FINISHES = [
  { id: 'black',  name: 'Gunmetal',  line: 'Factory black.' },
  { id: 'legion', name: 'Legion bands', earn: { missions: 3 }, line: 'Bands in the legion colour round the shroud and the stock.' },
  { id: 'desert', name: 'Desert wrap', earn: { waves: 20 }, line: 'Tan wrap over the body and the shroud.' },
  { id: 'snow',   name: 'Snow wrap',   earn: { chapter: 'hoth' }, line: 'White panels, for the ice fields.' },
];

// THE LOCKER's rows, in order (each becomes a row of data/customize.js's trooper list, with `bench: true`). `set(part)`
// is what the part changes on the look (appearance.js); a sidegrade row changes nothing there
export const LOCKER = [
  { id: 'pack', label: 'POWER PACK', kind: 'part', side: 'self', parts: POWER_PACKS, set: () => ({}),
    sub: 'Slots into the DC-15 and the DC-17s. Trades one small edge for another.' },
  { id: 'specialist', label: 'SQUAD SPECIALIST', kind: 'part', side: 'squad', parts: SPECIALISTS, set: () => ({}),
    sub: 'Sgt. Vant\'s kit. He fights as that specialist in every mode that brings the squad.' },
  { id: 'plate', label: 'ARMOUR PAINT', kind: 'color', parts: PAINTS, set: (p) => p.set, sub: 'The colour of the plates.' },
  { id: 'marking', label: 'COMPANY MARKINGS', kind: 'part', parts: MARKINGS, set: (p) => ({ parts: { marking: p.id } }), sub: 'Painted in your legion colour.' },
  { id: 'hgear', label: 'HELMET GEAR', kind: 'part', parts: HELMET_GEAR, set: (p) => ({ parts: { hgear: p.id } }), sub: 'Clipped to the bucket.' },
  { id: 'stock', label: 'DC-15 STOCK', kind: 'part', parts: STOCKS, set: (p) => ({ rifle: { stock: p.id } }), sub: 'The rifle\'s stock. Its barrel and scope are its modules, swapped in the fight.' },
  { id: 'finish', label: 'DC-15 FINISH', kind: 'part', parts: FINISHES, set: (p) => ({ rifle: { finish: p.id } }), sub: 'How the rifle is painted.' },
];
// the locker's sidegrade row for the trooper's own numbers
export const SELF_ROW = 'pack';
