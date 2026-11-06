// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WARDROBE AT A CHAPTER'S CLOSE: the customizer options a chapter unlocks (data/customize.js `unlock`) are handed
// out as it closes, with the powers it hands over (game/flow.js checkUnlocks), and announced there: one banner naming
// the new looks, and for the trooper's promotion to ARC its own card (data/ability-cards.js promotion). The new gear
// goes on as the next chapter starts (game/campaign.js startChapter, ui/customizer.js refreshWornLook).

import { G } from '../state.js';
import { CUSTOMIZE } from '../data/customize.js';
import { optionOpen, recordLooks, PROMOTIONS, trooperFork } from './wardrobe.js';

const cap = (t) => t.charAt(0) + t.slice(1).toLowerCase();
const openSet = (hero) => {
  const s = new Set();
  for (const row of CUSTOMIZE[hero] || []) for (const o of row.options) if (optionOpen(hero, row, o)) s.add(row.id + ':' + o.id);
  return s;
};
// what to announce for chapter `id` closing, as checkUnlocks' announce entries ({ key, name, sub, kicker })
export function chapterLooks(id){
  const hero = G.hero;
  if (!id || !CUSTOMIZE[hero]) return [];
  const before = openSet(hero);
  if (!recordLooks(hero, id)) return [];   // (already handed out: a retry, a co-op rejoin)
  const fresh = [];
  for (const row of CUSTOMIZE[hero]) for (const o of row.options) if (!before.has(row.id + ':' + o.id) && optionOpen(hero, row, o)) fresh.push({ row, o });
  const out = [];
  let rest = fresh;
  if (hero === 'trooper' && PROMOTIONS[id]){
    // (at the signature chapter a Commando gets the Katarn plate's card, not the ARC's)
    const rank = PROMOTIONS[id] === 'arc' && trooperFork() === 'commando' ? 'commando' : PROMOTIONS[id];
    out.push({ key: 'promote-' + rank, hud: '' });   // its own card (ui/ability-card.js, data/ability-cards.js)
    rest = fresh.filter(f => f.o.unlock !== id || f.row.kind === 'color');   // (the kit is on the card; its colours are news)
  }
  if (rest.length) out.push(looksEntry(rest));
  return out;
}
// the one banner naming a chapter's new looks (it keeps the list, so a look shown some other way can be taken off it)
function looksEntry(rest){
  const names = rest.map(({ row, o }) => row.kind === 'color' ? o.name + ' ' + row.label.toLowerCase() : cap(row.label) + ': ' + o.name);
  const shown = names.slice(0, 3).join(' · ') + (names.length > 3 ? ' · +' + (names.length - 3) + ' more' : '');
  return { key: 'looks', name: rest.length === 1 ? 'NEW LOOK' : rest.length + ' NEW LOOKS', sub: shown + ' · in CUSTOMIZE', hud: '', kicker: 'CUSTOMIZER', fresh: rest };
}
// chapterLooks' entries less the looks in `skip` ('row:option': the Armorer's piece, game/armorer.js, has its own beat)
export function looksLess(list, skip){
  if (!skip || !skip.length) return list;
  return list.flatMap(u => {
    if (u.key !== 'looks' || !u.fresh) return [u];
    const rest = u.fresh.filter(({ row, o }) => !skip.includes(row.id + ':' + o.id));
    return rest.length ? [looksEntry(rest)] : [];
  });
}
