// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE MASTERY PAGES' PARTS: what the Jedi's FORMS & MASTERY (ui/forms-ui.js) and the gunners' ARMORY (ui/armory-ui.js)
// share. Both pages are laid out like the profile (ui/profile-ui.js): who you are on the left, a grid of tiles on the
// right with ONE thing's detail beside it, and that detail cut into short tabs so only one part reads at a time.
// styles/heroes/mastery.css paints them in the look of the hero the page is for (data-hero on the panel).

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// a row of tabs: [[id, label, count?]]; `attr` is the data- attribute the page listens for
export const tabRow = (list, on, attr, cls = '') => '<div class="mx-tabs ' + cls + '" role="tablist">' + list.map(([id, label, n]) =>
  '<span data-' + attr + '="' + id + '" role="tab" aria-selected="' + (id === on) + '"' + (id === on ? ' class="on"' : '') + '>' + label +
  (n != null ? '<i>' + n + '</i>' : '') + '</span>').join('') + '</div>';

// rank pips: `r` of `n` lit
export const pips = (r, n = 3, cls = '') => '<span class="mx-pips' + (cls ? ' ' + cls : '') + '" aria-label="' + r + ' of ' + n + '">' +
  Array.from({ length: n }, (_, i) => '<i' + (i < r ? ' class="on"' : '') + '></i>').join('') + '</span>';

/* a RANK TRACK, like the profile's: a stop for each rank on an inked line, the line filled to the rank held and on
   towards the next by the practice done (`frac`, 0..1, or null when this view keeps none). names[0] is the start. */
export function rankTrack(names, at, frac){
  const n = names.length - 1, fill = Math.min(n, at + (at < n && frac ? frac : 0)) / n * 100;
  return '<div class="mx-track"><div class="mx-tline"><i style="width:' + fill.toFixed(1) + '%"></i></div>' +
    names.map((nm, i) => '<div class="mx-stop' + (i < at ? ' done' : '') + (i === at ? ' on' : '') + '" style="left:' + (i / n * 100) + '%"><i></i><span>' + esc(nm || 'START') + '</span></div>').join('') + '</div>';
}

// one labelled stat on a detail: a big number and what it is
export const stat = (v, k, cls = '') => '<div class="mx-stat' + (cls ? ' ' + cls : '') + '"><b>' + v + '</b><span>' + esc(k) + '</span></div>';

// the lock drawn on a sealed tile
export const LOCK_IC = '<svg class="mx-lock" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

// on a phone the detail sits under the tiles: after a tap that only shows a thing, bring its detail into view
export function revealDetail(root){
  if (!matchMedia('(max-width:760px)').matches) return;
  const d = root.querySelector('.mx-detail'); if (d) d.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
