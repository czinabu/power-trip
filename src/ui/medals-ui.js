// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MISSION MEDALS, shown (data/medals.js, game/medals.js): the three pips on a Missions page card, the three goals in its
// panel, the medals row on the results screen, and a corner note when a campaign chapter's mission wins some.

import { G } from '../state.js';
import { MEDALS, MEDAL_BIT, MEDAL_NAME, bonusOf, bonusLine, parTime, mmss } from '../data/medals.js';
import { upToast } from '../game/upgrades.js';

// three small pips (won: lit in its colour), for a card
export const medalPips = (bits) => '<span class="mmedals" title="Medals: ' + MEDALS.filter(k => bits & MEDAL_BIT[k]).length + ' of 3">' +
  MEDALS.map(k => '<i class="' + k + ((bits & MEDAL_BIT[k]) ? ' on' : '') + '"></i>').join('') + '</span>';

// the Missions page panel: the three goals for this hero, ticked where won, with the best time
export function medalGoalsHtml(def, rec, hero = G.hero){
  if (!def) return '';
  const par = parTime(def, hero), b = bonusOf(def, hero), m = (rec && rec.m) || 0;
  const row = (k, what) => '<div class="mpi-medal ' + k + ((m & MEDAL_BIT[k]) ? ' on' : '') + '"><b><i></i>' + MEDAL_NAME[k] + '</b><span>' + what + '</span></div>';
  return '<div class="mpi-medals">' + row('clear', 'Win the mission') + row('par', 'Win it in ' + mmss(par) + ' or less') + row('bonus', bonusLine(b, hero)) +
    (rec && rec.t ? '<div class="mpi-best">BEST TIME <b>' + mmss(rec.t) + '</b></div>' : '') + '</div>';
}

// the results screen: each medal, won or missed, and how close (r: game/medals.js medalsResult, with `fresh` and `best`)
export function medalResultsHtml(r){
  if (!r) return '';
  const fresh = new Set(r.fresh || []);
  const cell = (k, detail) => '<div class="rs-medal ' + k + (r.got[k] ? ' on' : '') + '"><i></i><b>' + MEDAL_NAME[k] + '</b><span>' + detail + '</span>' +
    (fresh.has(k) ? '<em>NEW</em>' : '') + '</div>';
  const parLine = mmss(r.time) + ' / ' + mmss(r.par) + (r.got.par ? '' : ' · ' + mmss(r.time - r.par) + ' over');
  return '<div class="rs-medals">' + cell('clear', 'Mission won') + cell('par', parLine) + cell('bonus', bonusLine(r.bonus, r.hero) + (r.got.bonus ? '' : ' · missed')) + '</div>' +
    (r.keep ? '' : '<div class="rs-medal-note">A challenge keeps no medals: each one is dealt once.</div>');
}

// a campaign chapter's mission won: a note in the corner (the chapter's card says the rest)
export function showMedals(r, fresh, chapter){
  if (!r || !fresh || !fresh.length) return;
  upToast('MEDAL' + (fresh.length > 1 ? 'S' : '') + ' · ' + fresh.map(k => MEDAL_NAME[k]).join(' · '),
    (chapter ? 'Won in the campaign. ' : '') + 'See every mission\'s medals on the MISSIONS page.', 'mast');
}
