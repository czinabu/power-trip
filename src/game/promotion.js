// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TROOPER'S PROMOTIONS, felt: each rank the story gives him (game/wardrobe.js PROMOTIONS) is a short ceremony as the
// chapter's cutscene hands him back (ui/force-toast.js, kind 'promote', the way the Jedi's Force Level rises): the rank,
// its insignia, and the order it brings for the fight (data/trooper-progression.js TROOPER_AUTO `promo`: his command
// points go further). The kit a rank brings (the captain's helmet, the ARC kit) still has its own card after it.
// Every trooper screen does this for its own hero (game/flow.js checkUnlocks, at a chapter's close, host or co-op guest).
// Outside the story the orders come with the run's stages, as a banner (no ceremony: there's no rank to give).

const RANKS = {
  sergeant:   { nm: 'SERGEANT',    bars: 1, line: 'Your marks go sergeant green. The squad is yours to lead.' },
  lieutenant: { nm: 'LIEUTENANT',  bars: 2, line: 'Your marks go lieutenant blue.' },
  captain:    { nm: 'CAPTAIN',     bars: 3, line: 'The Captain\'s spare helmet and pauldron are yours.' },
  commander:  { nm: 'COMMANDER',   bars: 4, line: 'General Kast\'s commission. Your marks go commander yellow.' },
  arc:        { nm: 'ARC TROOPER', bars: 5, line: 'The Captain\'s old ARC kit is yours.' },
  commando:   { nm: 'CLONE COMMANDO', bars: 5, line: 'The Katarn plate is yours.' },
};
// the kit cards that still follow the ceremony (data/ability-cards.js): the ranks that hand over armour
export const KIT_CARD = { captain: true, arc: true, commando: true };

// the ceremony for `rank`, with the order (`perk`, a TROOPER_AUTO entry) it brought, if any
export function promotionBeat(rank, perk){
  const R = RANKS[rank];
  if (!R) return null;
  return { kind: 'promote', lead: true, rank: R.nm, bars: R.bars, line: R.line, perk: perk ? perk.name : '', sub: perk ? perk.sub : '' };
}
