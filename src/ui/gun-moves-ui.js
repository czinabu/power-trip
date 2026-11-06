// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A gun's SIGNATURE MOVE and MASTERY on the armory page (ui/armory-ui.js): what the move does, HOW TO DO IT in key chips
// (the forms page's look: ui/forms-ui.js howLine, turned into the pad's buttons by engine/gamepad.js relabelHud), its
// rank, the practice to the next one, and what each rank brings (data/gun-moves.js).

import { G, isTrooper } from '../state.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { GUN_MOVES, GUN_RANKS } from '../data/gun-moves.js';
import { gunRank, gunProgress, bestGunRanks, rankLine } from '../player/gun-moves.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hero = () => isTrooper() ? 'trooper' : 'mando';
const keyChip = (k) => /^(HOLD|TAP)$/.test(k) ? '<i>' + k.toLowerCase() + '</i>' : k === '+' || k === '/' ? '<span>' + k + '</span>'
  : '<kbd data-kb="' + esc(k) + '">' + esc(pad.active ? padKeys(k, hero()) : k) + '</kbd>';
export const howLine = (how, label) => '<div class="fm-how">' + (label ? '<b>' + esc(label) + '</b>' : '') +
  how.map(([keys, what], i) => '<span class="fm-step">' + (i ? '<span class="then">then</span>' : '') + (keys ? keys.split(' ').map(keyChip).join('') : '') + (what ? '<em>' + esc(what) + '</em>' : '') + '</span>').join('') + '</div>';

// the move and its mastery for gun `id`. On the main menu (no run in play) the best rank of any run is shown.
export function moveBlock(id){
  const M = GUN_MOVES[id];
  if (!M) return '';
  const live = G.mode !== 'menu';
  const r = live ? gunRank(id) : (bestGunRanks()[id] || 0);
  const p = live && !G.sandbox && !G.training && !G.mission ? gunProgress(id) : null;
  const where = r >= 3 ? 'Mastered.'
    : !live ? 'Ranks are earned with the gun in the campaign and survival.'
    : !p ? 'Ranks are earned with the gun in the campaign and survival. Here it fights at its best rank.'
    : p[0] + ' / ' + p[1] + ' practice' + (p[3] ? ' · ' + Math.min(p[2], p[3]) + ' / ' + p[3] + ' ' + M.name.toLowerCase() : '') + ' to ' + GUN_RANKS.title[r + 1] + '.';
  const bar = p ? '<div class="fm-bar big"><i style="width:' + Math.round(Math.min(1, p[0] / p[1]) * 100) + '%"></i></div>' : '';
  const stars = [1, 2, 3].map(n => '<span class="' + (n <= r ? 'on' : '') + '">' + (n <= r ? '★' : '☆') + '</span>').join('');
  return '<div class="fm-sub">SIGNATURE · ' + esc(M.name) + '</div><div class="fm-fin">' + esc(M.ds) + '</div>' + howLine(M.how, 'HOW') +
    '<div class="fm-sub fm-mast">MASTERY <span class="fm-stars">' + stars + '</span> ' + esc(r ? GUN_RANKS.title[r] : 'UNRANKED') + '</div>' + bar +
    '<div class="fm-fin">' + esc(where) + ' Hits, kills and its signature move count.</div>' +
    '<div class="fm-rkl' + (r >= 3 ? ' on' : '') + '"><span>RANKS</span>' + [1, 2, 3].map(n => (n <= r ? '✓ ' : '') + GUN_RANKS.names[n] + ': ' + esc(rankLine(id, n))).join(' · ') + '</div>';
}
// the rank as a tile's small line ('★★☆')
export const tileRank = (id) => {
  const r = G.mode !== 'menu' ? gunRank(id) : (bestGunRanks()[id] || 0);
  return '<div class="fm-best">' + esc(GUN_MOVES[id] ? GUN_MOVES[id].name : '') + ' · ' + (r ? '★'.repeat(r) + '☆'.repeat(3 - r) : '☆☆☆') + '</div>';
};
