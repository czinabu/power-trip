// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// EVERY HERO'S BENCH, in one place: the Jedi's SABER WORKBENCH (data/saber-parts.js), the trooper's ARMORY LOCKER
// (data/trooper-locker.js) and the Mando's BESKAR FORGE (data/beskar-forge.js). Each is a list of rows of earned parts,
// and each has ONE row whose part is a capped sidegrade on the hero's own numbers (SIDE_ROW; game/saber-bench.js fits it).
// game/profile.js hands out every hero's parts from here; ui/kitbench.js and ui/workbench.js show them.
// Leaf data only: data/customize.js and the model read this while the modules load.
import { BENCH } from './saber-parts.js';
import { LOCKER } from './trooper-locker.js';
import { FORGE } from './beskar-forge.js';

export const BENCHES = { jedi: BENCH, trooper: LOCKER, mando: FORGE };
export const benchOf = (hero) => BENCHES[hero] || BENCH;
// the row whose part changes the hero's numbers (its parts each carry `fx`)
export const SIDE_ROW = { jedi: 'saber', trooper: 'pack', mando: 'forged' };
export const sideParts = (hero) => (benchOf(hero).find(r => r.id === SIDE_ROW[hero]) || { parts: [] }).parts;
// every earnable part of a hero's bench, as [row id, part] (game/profile.js announces each once)
export const earnableOf = (hero) => benchOf(hero).flatMap(r => r.parts.filter(p => p.earn).map(p => [r.id, p]));
// what each bench is called, on its screen, on the menu button and on the card that hands a part over
export const BENCH_NAME = { jedi: 'SABER WORKBENCH', trooper: 'ARMORY LOCKER', mando: 'BESKAR FORGE' };
export const BENCH_BUTTON = { jedi: 'SABER', trooper: 'LOCKER', mando: 'FORGE' };
export const BENCH_KICKER = { jedi: 'FOR YOUR SABER', trooper: 'FOR YOUR LOCKER', mando: 'FROM THE FORGE' };
