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

/* a gun's move and mastery for gun `id`, cut into the armory's detail tabs (ui/armory-ui.js): MOVE (what it does and HOW) and MASTERY (the rank
   track, the practice to the next rank, what each rank brings). On the main menu (no run in play) the best rank of any
   run is shown. */
const rankNow = (id) => G.mode !== 'menu' ? gunRank(id) : (bestGunRanks()[id] || 0);
export function movePart(id){
  const M = GUN_MOVES[id]; if (!M) return '';
  return '<div class="mx-move"><div class="mx-k">SIGNATURE MOVE</div><b>' + esc(M.name) + '</b><p>' + esc(M.ds) + '</p>' + howLine(M.how) + '</div>';
}
export function masteryPart(id, track){
  const M = GUN_MOVES[id]; if (!M) return '';
  const live = G.mode !== 'menu', r = rankNow(id);
  const p = live && !G.sandbox && !G.training && !G.mission ? gunProgress(id) : null;
  const where = r >= 3 ? 'Mastered.'
    : !live ? 'Ranks are earned with the gun in the campaign and survival.'
    : !p ? 'Ranks are earned with the gun in the campaign and survival. Here it fights at its best rank.'
    : p[0] + ' / ' + p[1] + ' practice' + (p[3] ? ' · ' + Math.min(p[2], p[3]) + ' / ' + p[3] + ' ' + M.name.toLowerCase() : '') + ' to ' + GUN_RANKS.title[r + 1] + '.';
  return track(['UNRANKED', 'RANK I', 'RANK II', 'MASTER'], r, p ? Math.min(1, p[0] / p[1]) : 0) + '<p class="mx-where">' + esc(where) + '</p>' +
    (r < 3 ? '<div class="mx-k">PRACTISE WITH</div><p class="mx-p">Hits, kills and its ' + esc(M.name.toLowerCase()) + '</p>' : '') +
    '<div class="mx-k">RANKS</div><ul class="mx-ranks">' + [1, 2, 3].map(n => '<li class="' + (n <= r ? 'got' : '') + '"><span>' + GUN_RANKS.names[n] + '</span>' + esc(rankLine(id, n)) + '</li>').join('') + '</ul>';
}
export const gunRankNow = rankNow;
