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
// size. The signet, the helmet mod, the jetpack, the vambraces and the chest kit are looks only.
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
    ds: 'The jetpack burns 12% less fuel · −8% blaster damage', fx: [['fuelEff', '*', 0.88], ['dmg', '*', 0.92]] },
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
  // the RAID's RARE signets (`rare`, data/raids.js): looks only
  { id: 'brokenward', name: 'Broken ward', earn: { raids: 1 }, rare: true, line: 'A ring split clean through. The ward you flew over, and the one you broke.' },
  { id: 'gatefall', name: 'Gatefall', earn: { raids: 5 }, rare: true, line: 'A falling star through a ring of stone. The clans will ask where you got it.' },
  // the post-game's LEGENDARY pieces (`legend`): looks only, like the rest
  // the mission medals' (data/medals.js)
  { id: 'honourstar', name: 'Honour star', earn: { medals: 20 }, line: 'A five-pointed star. The Armorer strikes it for one who finishes the job clean.' },
  { id: 'sunburst', name: 'Victor\'s sun', earn: { medals: 60 }, line: 'An eight-rayed sun. Only a hunter with a medal for every job wears it.' },
  { id: 'mandalore', name: 'Mand\'alor\'s sigil', earn: { top: 'Mand\'alor' }, legend: true, line: 'The crowned skull of Mandalore. Only the one the clans follow wears it.' },
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
  { id: 'mantle',    name: 'War mantle', earn: { ng: 3 }, legend: true, line: 'A heavy beskar mantle over both shoulders, its edge in the accent colour. Earned on the third road.' },
];

// JETPACK: the standard pack, or the standard pack with more forged onto it
export const JETPACKS = [
  { id: 'standard', name: 'Standard', line: 'Slim and close to the back: twin tanks, small nozzles and the missile mount.' },
  { id: 'boba',     name: 'Boba-style', line: 'Bigger and boxier: fat domed tanks, wide nozzles and an antenna.' },
  { id: 'winged',   name: 'Winged',   earn: { chapter: 'trial-acrobat' }, line: 'Swept beskar wings out past the tanks.' },
  { id: 'heavy',    name: 'Reserve tanks', earn: { waves: 15 }, line: 'Two reserve canisters slung outboard.' },
];
// HELMET MOD: a piece on top of whichever helmet the customizer picked
export const HELMET_MODS = [
  { id: 'none',  name: 'None',  line: 'The bucket as it is.' },
  { id: 'fins',  name: 'Swept fins', earn: { chapter: 'jakku' }, line: 'Two fins rising off the back of the dome.' },
  { id: 'plume', name: 'Plume', earn: { missions: 3 }, line: 'A crest of cloth from brow to nape, in the cape colour.' },
  { id: 'horns', name: 'Horns', earn: { duels: 10 }, line: 'Two horns swept up and back.' },
  { id: 'crown', name: 'Crown crest', earn: { ng: 1 }, legend: true, line: 'A ring of short beskar blades round the dome. Forged on the second road.' },
];

// THE FORGE's rows, in order (each a row of data/customize.js's mando list, with `bench: true`)
export const FORGE = [
  { id: 'forged', label: 'FORGED', kind: 'part', side: 'self', parts: FORGED, set: () => ({}),
    sub: 'What the Armorer works into the beskar. Trades one small edge for another.' },
  { id: 'signet', label: 'SIGNET', kind: 'part', parts: SIGNETS, set: (p) => ({ parts: { signet: p.id } }), sub: 'Your clan\'s mark, in the accent colour.' },
  { id: 'helmod', label: 'HELMET MOD', kind: 'part', parts: HELMET_MODS, set: (p) => ({ parts: { helmod: p.id } }), sub: 'On top of the helmet you picked in the customizer.' },
  { id: 'jetpack', label: 'JETPACK', kind: 'part', parts: JETPACKS, set: (p) => ({ parts: { jetpack: p.id } }), sub: 'How your pack is built. It flies the same.' },
  { id: 'vambrace', label: 'VAMBRACES', kind: 'part', parts: VAMBRACES, set: (p) => ({ parts: { vambrace: p.id } }), sub: 'The forearm armour.' },
  { id: 'chest', label: 'CHEST KIT', kind: 'part', parts: CHEST_KIT, set: (p) => ({ parts: { chest: p.id } }), sub: 'Worn over the cuirass.' },
];
export const SELF_ROW = 'forged';

// THE ARMORER FORGES (game/armorer.js): the beskar you can see grow. At the close of each of these chapters of the Mando's
// story the Armorer strikes one piece onto the armour and he wears it at once (unless he has picked something else for
// that slot: then it waits in the forge or the customizer). Each is a [row, option] of data/customize.js's mando list,
// opened at that chapter (`unlock`) or earned there (`earn: { chapter }`). `line` is the Armorer's, on the beat.
export const ARMORER_FORGES = {
  siege:          { row: 'signet',    opt: 'mudhorn',  line: 'Your clan is two now. It goes on the pauldron.' },
  refuge:         { row: 'shoulders', opt: 'pauldrons', line: 'You held. Now your shoulders will.' },
  'trial-acrobat':{ row: 'jetpack',   opt: 'winged',   line: 'Beskar wings, for a foundling who would rather fly.' },
  'trial-knight': { row: 'shoulders', opt: 'heavy',    line: 'The heavy plate. You have earned the weight.' },
  lothal:         { row: 'vambrace',  opt: 'whistler', line: 'Whistling birds. Use them sparingly.' },
  hoth:           { row: 'vambrace',  opt: 'plated',   line: 'Heavier on the arm. Your guard will thank you.' },
  jakku:          { row: 'helmod',    opt: 'fins',     line: 'Fins, swept back. They will know you from the ridge.' },
  mustafar:       { row: 'chest',     opt: 'gorget',   line: 'A gorget, from the melt you walked out of. This is the Way.' },
};
