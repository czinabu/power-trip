// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARMORY LOCKER (the trooper) and THE BESKAR FORGE (the Mando): the gunners' version of the Jedi's SABER WORKBENCH
// (ui/workbench.js), opened from the main menu's bench button (LOCKER / FORGE, where the Jedi's says SABER), the
// customizer's link, or a hub's forge station (ui/hub-ui.js). The hero stands on the showcase turntable (ui/showcase.js)
// wearing every pick as it's made; this is the panel beside it: a tray for each row of the hero's bench
// (data/trooper-locker.js, data/beskar-forge.js) holding the parts earned, and the sidegrades read out as gain and cost.
// What you've earned is your profile's (game/profile.js); the build is saved with the customizer's picks (player/mesh.js
// sw_look), so it is what you wear and carry in every mode and what a co-op partner sees.

import { G } from '../state.js';
import { audioInit, S } from '../audio/sfx.js';
import { CUSTOMIZE, wornOption, swatchOf } from '../data/customize.js';
import { benchOf, BENCH_NAME } from '../data/hero-benches.js';
import { earnProgress, earnText } from '../data/saber-parts.js';
import { optionOpen, refreshWorn } from '../game/wardrobe.js';
import { profileOf, partsOwned, partsTotal, runLive } from '../game/profile.js';
import { chapterOrder, forHero } from '../data/campaign.js';
import { loadPicks, savePicks } from '../player/mesh.js';
import { restyleShowcase, focusShowcase, spinShowcase } from './showcase.js';

const overlay = document.getElementById('overlay');
const panel = document.createElement('div');
panel.id = 'kitbench';
overlay.appendChild(panel);

const NOTE = {
  trooper: 'More gear comes from the campaign\'s chapters, story missions, arcade contracts, survival waves and duellists beaten.',
  mando: 'More pieces come from the campaign\'s chapters, story missions, arcade contracts, survival waves and duellists beaten.',
};
const SIDE_NOTE = {
  trooper: 'The power pack and the specialist each trade one small edge for another. The paint, markings, helmet gear and the rifle\'s stock and finish change how you look, not how you fight.',
  mando: 'Forged beskar trades one small edge for another. The signet, vambraces and chest kit change how you look, not how you fight.',
};
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let hero = 'trooper', picks = {};

const rowsOf = () => CUSTOMIZE[hero].filter(r => r.bench);
const row = (id) => CUSTOMIZE[hero].find(r => r.id === id);
const benchRow = (id) => benchOf(hero).find(r => r.id === id);
const fitted = (id) => wornOption(hero, row(id), picks[hero] || {});
const partOf = (rowId, optId) => { const b = benchRow(rowId); return b && b.parts.find(p => p.id === optId); };
const chapterName = (id) => { const c = chapterOrder(null, hero).find(x => x.id === id); return c ? forHero(c.title, hero) : id.toUpperCase(); };
const ROMAN = ['I', 'II', 'III'];
function whereLocked(o){
  if (o.earn){ const e = earnProgress(profileOf(hero), o.earn); return earnText(o.earn, chapterName) + (e.need > 1 ? ' · ' + Math.min(e.have, e.need) + '/' + e.need : ''); }
  if (o.unlock === 'won') return 'BEAT THE CAMPAIGN';
  const c = chapterOrder(null, hero).find(ch => ch.id === o.unlock);
  return c ? 'ACT ' + ROMAN[c.act] + ' · ' + forHero(c.title, hero) : 'THE CAMPAIGN';
}
function tray(R, n){
  const b = benchRow(R.id), cur = fitted(R.id);
  const tiles = R.options.map(o => {
    const shut = !optionOpen(hero, R, o), p = partOf(R.id, o.id) || {};
    const where = shut ? whereLocked(o) : R.side ? (p.fx && p.fx.length || p.role ? p.ds : 'No sidegrade') : (p.line || '');
    const col = R.kind === 'color' ? swatchOf(o) : p.col;
    const sw = col != null ? `<i class="wb-sw" style="--c:${hex(col)}"></i>` : '';
    return `<div class="wb-part${o === cur ? ' on' : ''}${shut ? ' shut' : ''}" data-row="${R.id}" data-opt="${o.id}">`
      + `<b>${sw}${esc(o.name)}</b><em>${o === cur ? 'FITTED' : shut ? 'LOCKED' : ''}</em><span>${esc(where)}</span></div>`;
  }).join('');
  return `<section class="wb-tray${R.side ? ' kb-side' : ''}"><header><i>${String(n + 1).padStart(2, '0')}</i><h3>${esc(R.label)}</h3></header><p>${esc(b.sub || '')}</p><div class="wb-parts">${tiles}</div></section>`;
}
// the sidegrades fitted, as gain and cost
function readout(){
  const sides = rowsOf().filter(r => r.side).map(R => ({ R, p: partOf(R.id, fitted(R.id).id) }));
  const one = ({ R, p }) => {
    const [gain, cost] = String(p.ds).split(' · ');
    const has = p.fx ? p.fx.length : !!p.role;
    return `<div class="wb-att-h"><b>${esc(R.label)}</b><span>${esc(p.att)}</span></div>`
      + (has ? `<div class="wb-fx"><i>GAIN</i>${esc(gain)}</div><div class="wb-fx cost"><i>COST</i>${esc(cost || '')}</div>` : `<div class="wb-fx"><i>—</i>${esc(p.ds)}</div>`);
  };
  return `<div class="wb-att">${sides.map(one).join('<div class="kb-gap"></div>')}<p>${SIDE_NOTE[hero]}</p></div>`;
}
function render(){
  const live = runLive();
  panel.innerHTML = `<div class="wb-panel kb-panel">
    <div class="wb-head"><h2>${BENCH_NAME[hero]}</h2><div class="wb-x" id="kbclose">CLOSE</div></div>
    <div class="wb-count"><span>PARTS</span><b>${partsOwned(hero)} / ${partsTotal(hero)}</b></div>
    <p class="wb-note">${NOTE[hero]}</p>
    ${live ? '<p class="wb-live">A run is on: your kit is changed between runs. Look it over here, and fit new parts from the main menu.</p>' : ''}
    ${readout()}
    <div class="wb-trays${live ? ' wb-locked' : ''}">${rowsOf().map(tray).join('')}</div>
    <div class="wb-actions"><div class="wb-btn main" id="kbdone">DONE</div></div>
    <div class="wb-hint">Drag the stand to turn your hero. Esc to finish.</div>
  </div>`;
}

// open the hero's bench (the trooper's locker or the Mando's forge). The Jedi's is the saber workbench (ui/workbench.js)
export function openKitBench(h = G.hero){
  if (h !== 'trooper' && h !== 'mando') return false;
  audioInit();
  hero = h; picks = loadPicks();
  overlay.classList.add('kitbench');
  focusShowcase(true);
  restyleShowcase(picks);
  render();
  return true;
}
export function closeKitBench(){
  if (!overlay.classList.contains('kitbench')) return;
  overlay.classList.remove('kitbench');
  focusShowcase(false);
  if (!runLive()){ savePicks(picks); refreshWorn(); }   // the hero wears and carries the new kit from the next run
  restyleShowcase(loadPicks());
  document.dispatchEvent(new CustomEvent('kitbench-closed'));   // (opened from a hub's forge: back to it, ui/hub-ui.js)
}
export const kitBenchOpen = () => overlay.classList.contains('kitbench');

function fit(rowId, optId){
  const R = row(rowId), o = R && R.options.find(x => x.id === optId);
  if (!o || runLive()) return;
  if (!optionOpen(hero, R, o)){ S.uiDeny(); return; }
  if (fitted(rowId) === o) return;
  picks = { ...picks, [hero]: { ...(picks[hero] || {}), [rowId]: optId } };
  S.uiClick();
  restyleShowcase(picks);
  render();
}

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // never launches the game
  const t = e.target, tile = t.closest('[data-opt]');
  if (tile) return fit(tile.dataset.row, tile.dataset.opt);
  if (t.closest('#kbclose') || t.closest('#kbdone')) return closeKitBench();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && kitBenchOpen()) closeKitBench(); });
// drag anywhere off the panel to turn the hero on the stand
let dragX = null;
panel.addEventListener('pointerdown', (e) => { if (e.target === panel){ dragX = e.clientX; panel.setPointerCapture(e.pointerId); } });
panel.addEventListener('pointermove', (e) => { if (dragX !== null){ spinShowcase((e.clientX - dragX) * 0.01); dragX = e.clientX; } });
for (const ev of ['pointerup', 'pointercancel']) panel.addEventListener(ev, () => { dragX = null; });
