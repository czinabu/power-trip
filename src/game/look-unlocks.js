// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WARDROBE AT A CHAPTER'S CLOSE: the customizer options a chapter unlocks (data/customize.js `unlock`) are handed
// out as it closes, with the powers it hands over (game/flow.js checkUnlocks), and announced there: one banner naming
// the new looks, and for the trooper's promotion to ARC its own card (data/ability-cards.js promotion). The new gear
// goes on as the next chapter starts (game/campaign.js startChapter, ui/customizer.js refreshWornLook).

import { G } from '../state.js';
import { CUSTOMIZE } from '../data/customize.js';
import { optionOpen, recordLooks, PROMOTIONS } from './wardrobe.js';

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
    out.push({ key: 'promote-' + PROMOTIONS[id], hud: '' });   // its own card (ui/ability-card.js, data/ability-cards.js)
    rest = fresh.filter(f => f.o.unlock !== id || f.row.kind === 'color');   // (the kit is on the card; its colours are news)
  }
  if (rest.length){
    const names = rest.map(({ row, o }) => row.kind === 'color' ? o.name + ' ' + row.label.toLowerCase() : cap(row.label) + ': ' + o.name);
    const shown = names.slice(0, 3).join(' · ') + (names.length > 3 ? ' · +' + (names.length - 3) + ' more' : '');
    out.push({ key: 'looks', name: rest.length === 1 ? 'NEW LOOK' : rest.length + ' NEW LOOKS', sub: shown + ' · in CUSTOMIZE', hud: '', kicker: 'CUSTOMIZER' });
  }
  return out;
}
