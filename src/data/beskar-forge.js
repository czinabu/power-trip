// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE BESKAR FORGE, as data: the Mandalorian's version of the Jedi's saber workbench (data/saber-parts.js). Edit the
// words and numbers freely. ui/kitbench.js shows the forge, player/model/mando.js builds the pieces, game/saber-bench.js
// fits the forged sidegrade to the run, game/profile.js hands pieces out.
//
// PIECES ARE EARNED, AND KEPT, as the workbench's parts are: `earn` reads the Mando's persistent profile (the same asks
// as data/saber-parts.js), so a piece outlives every run and NEW GAME.
//
// ONE FORGED SIDEGRADE, THE SAME GUARDRAIL AS A KYBER CRYSTAL: `fx` changes player.up ([field, op, value], put on and
// taken off cleanly by game/saber-bench.js), one gain at or under ATTUNE_CAP, paid for by at least two thirds of its
// size. The signet, the vambraces and the chest kit are looks only.
//
// No imports but the leaf data/saber-parts.js: data/customize.js and the model read this while the modules load.
import { ATTUNE_CAP } from './saber-parts.js';
export { ATTUNE_CAP };

// THE FORGED SIDEGRADE: what the Armorer works into the beskar
export const FORGED = [
  { id: 'unforged', name: 'As found', att: 'UNFORGED', ds: 'The armour as you came by it. No sidegrade.', fx: [] },
  { id: 'tempered', name: 'Tempered', earn: { chapter: 'refuge' }, att: 'TEMPERED BESKAR', col: 0x9aa7b5,
    ds: 'Take 6% less damage · −5% move speed', fx: [['dr', '+', 0.06], ['move', '*', 0.95]] },
  { id: 'feathered', name: 'Feathered', earn: { chapter: 'trial-acrobat' }, att: 'FEATHERED PLATE', col: 0xbfe6ff,
    ds: '+6% move speed · take 5% more damage', fx: [['move', '*', 1.06], ['dr', '+', -0.05]] },
  { id: 'vented', name: 'Vented pack', earn: { waves: 10 }, att: 'VENTED JETPACK', col: 0x59c6ff,
    ds: 'The jetpack burns 12% less fuel · −6% blaster damage', fx: [['fuelEff', '*', 0.88], ['dmg', '*', 0.94]] },
  { id: 'honed', name: 'Honed', earn: { duels: 6 }, att: 'HONED KIT', col: 0xff7a3d,
    ds: '+7% damage · gadgets cost 8% more', fx: [['dmg', '*', 1.07], ['abilityCostMul', '*', 1.08]] },
  { id: 'clan', name: 'Clan-forged', earn: { won: 1 }, att: 'CLAN-FORGED', col: 0xc9a24a,
    ds: 'Gadgets cost 10% less · blasters cool 8% slower', fx: [['abilityCostMul', '*', 0.9], ['coolMul', '*', 0.92]] },
];

/* ---------- the looks ---------- */
// THE SIGNET: the clan's mark, painted on the left pauldron in the accent colour (or the helmet, for the jaig eyes)
export const SIGNETS = [
  { id: 'none',      name: 'None',      line: 'No clan, or none you show.' },
  { id: 'mudhorn',   name: 'Mudhorn',   earn: { chapter: 'siege' }, line: 'The horned beast. A clan of two.' },
  { id: 'mythosaur', name: 'Mythosaur', earn: { chapter: 'trial-first' }, line: 'The great skull, the oldest sign of Mandalore.' },
  { id: 'owl',       name: 'Nite owl',  earn: { missions: 2 }, line: 'Wings spread. A warrior\'s house.' },
  { id: 'jaig',      name: 'Jaig eyes', earn: { duels: 3 }, line: 'The marks round the visor, given for courage.' },
];
// VAMBRACES: what's on the forearms
export const VAMBRACES = [
  { id: 'standard', name: 'Standard', line: 'A gauntlet plate on each forearm.' },
  { id: 'whistler', name: 'Whistling birds', earn: { chapter: 'lothal' }, line: 'A rack of tiny tubes on the left forearm.' },
  { id: 'flame',    name: 'Flame projector', earn: { arcade: 1 }, line: 'A nozzle under the right wrist, its tank along the arm.' },
  { id: 'plated',   name: 'Heavy plate', earn: { chapter: 'hoth' }, line: 'Thick overlapping plates from wrist to elbow.' },
];
// CHEST KIT: over the cuirass
export const CHEST_KIT = [
  { id: 'none',      name: 'Bare plate', line: 'Just the cuirass.' },
  { id: 'bandolier', name: 'Bandolier', earn: { waves: 5 }, line: 'A strap across the chest, heavy with power cells.' },
  { id: 'gorget',    name: 'Beskar gorget', earn: { chapter: 'mustafar' }, line: 'A forged collar over the throat.' },
  { id: 'sash',      name: 'Hunter\'s sash', earn: { arcade: 3 }, line: 'A cloth sash from shoulder to hip, in the cape colour.' },
];

// THE FORGE's rows, in order (each a row of data/customize.js's mando list, with `bench: true`)
export const FORGE = [
  { id: 'forged', label: 'FORGED', kind: 'part', side: 'self', parts: FORGED, set: () => ({}),
    sub: 'What the Armorer works into the beskar. Trades one small edge for another.' },
  { id: 'signet', label: 'SIGNET', kind: 'part', parts: SIGNETS, set: (p) => ({ parts: { signet: p.id } }), sub: 'Your clan\'s mark, in the accent colour.' },
  { id: 'vambrace', label: 'VAMBRACES', kind: 'part', parts: VAMBRACES, set: (p) => ({ parts: { vambrace: p.id } }), sub: 'The forearm armour.' },
  { id: 'chest', label: 'CHEST KIT', kind: 'part', parts: CHEST_KIT, set: (p) => ({ parts: { chest: p.id } }), sub: 'Worn over the cuirass.' },
];
export const SELF_ROW = 'forged';
