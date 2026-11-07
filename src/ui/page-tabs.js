// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// APPEARANCE | LOCKER / FORGE: the tab row across the top of the customizer (ui/customizer.js) and the gunners' bench
// (ui/kitbench.js). They stay separate screens, each with its own stage, but read as two pages of one: the second tab is the
// hero's own bench (LOCKER for the trooper, FORGE for the Mando: data/hero-benches.js). A click on a tab, or the pad's
// LB / RB (engine/gamepad.js), sends 'hero-page' with the page wanted; ui/customizer.js does the switch.
// The Jedi gets no tabs: the saber is built only at the SABER WORKBENCH (the temple's forge, or the menu's SABER button:
// ui/workbench.js), so the customizer is the Jedi's look alone and the workbench stands on its own.
import { BENCH_BUTTON } from '../data/hero-benches.js';

// the heroes whose bench is a page of the customizer (the Jedi's saber workbench is not)
const TABBED = new Set(['trooper', 'mando']);

export function pageTabs(hero, on){
  if (!TABBED.has(hero)) return '';
  // the bumper that turns to it, as the pad names it (L1 / R1 on a PlayStation pad: body.pad-ps, engine/gamepad.js)
  const key = (pg) => pg === 'look' ? '<kbd class="padonly pg-xb">LB</kbd><kbd class="padonly pg-ps">L1</kbd>' : '<kbd class="padonly pg-xb">RB</kbd><kbd class="padonly pg-ps">R1</kbd>';
  const t = (pg, name) => `<span data-pg="${pg}"${pg === on ? ' class="on"' : ''}>${key(pg)}${name}</span>`;
  return `<div class="pg-tabs">${t('look', 'APPEARANCE')}${t('bench', BENCH_BUTTON[hero])}</div>`;
}
// a click on a tab inside `root`: ask for that page (true when it was a tab)
export function pageTabClick(e){
  const t = e.target.closest('.pg-tabs [data-pg]');
  if (!t) return false;
  if (!t.classList.contains('on')) document.dispatchEvent(new CustomEvent('hero-page', { detail: t.dataset.pg }));
  return true;
}
