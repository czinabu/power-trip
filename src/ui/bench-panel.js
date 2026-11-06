// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE BENCH PANELS' SHARED LAYOUT: the Jedi's saber workbench (ui/workbench.js) and the gunners' locker and forge
// (ui/kitbench.js) each show one slot at a time instead of one long scroll of every tray. Down the left is the RAIL, a
// button per slot (the crystal, the emitter… or the power pack, the paint…) with what is fitted there and how many of its
// parts you hold; beside it the open slot's parts you've earned, as a grid; the parts still to earn fold into one line
// under them (how many are left, and the nearest to unlocking), which opens to show them all. On a phone the rail turns
// into a row of chips across the top. Each bench draws its own tiles in its own style; this file draws the frame.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nn = (i) => String(i + 1).padStart(2, '0');

// slots: [{ id, label, fitted (the name), have, all }]; on: the open slot's id
export function slotRail(slots, on){
  return `<nav class="bp-rail">${slots.map((s, i) => `<div class="bp-slot${s.id === on ? ' on' : ''}" data-slot="${s.id}">`
    + `<i>${nn(i)}</i><b>${esc(s.label)}</b><em>${s.have}/${s.all}</em><span>${esc(s.fitted)}</span></div>`).join('')}</nav>`;
}
// the nearest part to unlocking among the shut ones: [{ name, where, frac (0..1 of the way there) }] → one of them
export function nearest(shut){
  let best = null;
  for (const s of shut) if (!best || s.frac > best.frac) best = s;
  return best;
}
// the fold under the earned parts: "N TO EARN · NEXT: Rose — BEAT 6 DUELLISTS · 2/6", and, opened, the shut tiles
export function lockFold(shut, tiles, open, note){
  if (!shut.length) return '';
  const nx = nearest(shut);
  return `<div class="bp-fold${open ? ' open' : ''}">`
    + `<div class="bp-fold-h" data-bpfold><i class="bp-lk"></i><b>${shut.length} TO EARN</b>`
    + `<span>NEXT · <u>${esc(nx.name)}</u> ${esc(nx.where)}</span><em>${open ? 'HIDE' : 'SHOW'}</em></div>`
    + (open ? `<div class="bp-shut">${tiles}</div>${note ? `<p class="bp-note">${esc(note)}</p>` : ''}` : '')
    + '</div>';
}
// the open slot: its line, the earned parts' grid and the fold
export function slotBody(sub, openTiles, foldHtml){
  return `<section class="bp-body">${sub ? `<p class="bp-sub">${esc(sub)}</p>` : ''}<div class="bp-grid">${openTiles}</div>${foldHtml}</section>`;
}
// the scroll of the parts pane, kept across a redraw (a pick made far down a long slot)
export const keepScroll = (root) => { const p = root.querySelector('.bp-parts'); return p ? p.scrollTop : 0; };
export const putScroll = (root, y) => { const p = root.querySelector('.bp-parts'); if (p && y) p.scrollTop = y; };
