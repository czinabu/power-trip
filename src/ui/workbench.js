// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SABER WORKBENCH: its own screen, opened from SABER on the main menu (or the customizer's link). The saber lies in
// pieces on a lamp-lit bench (ui/bench-stage.js); this is the panel beside it: a tray for each slot (the kyber crystal,
// the emitter, the grip, the pommel) holding the parts you've earned, the fitted crystal's ATTUNEMENT read out as its
// gain and its cost, and TEST IGNITION, which slides the pieces home and lights the blade. Parts and their sources are
// data/saber-parts.js; what you've earned is your profile's (game/profile.js); the build is saved with the customizer's
// picks (player/mesh.js sw_look), so it is the saber you carry in every mode and the one a co-op partner sees.

import { G } from '../state.js';
import { audioInit, S } from '../audio/sfx.js';
import { CUSTOMIZE, wornOption, swatchOf } from '../data/customize.js';
import { BENCH, crystalOf, earnProgress, earnText } from '../data/saber-parts.js';
import { optionOpen, refreshWorn } from '../game/wardrobe.js';
import { profileOf, partsOwned, partsTotal, runLive } from '../game/profile.js';
import { chapterOrder, forHero } from '../data/campaign.js';
import { loadPicks, savePicks } from '../player/mesh.js';
import { openBench, setBenchSaber, igniteBench, spinBench } from './bench-stage.js';

const panel = document.getElementById('workbench');
const btn = document.getElementById('wbBtn');
const ROWS = CUSTOMIZE.jedi.filter(r => r.bench);
// the trays, in the order a saber is put together, and what each is called on the bench
const TRAYS = [['saber', 'KYBER CRYSTAL', 'The heart of the blade. It sets the colour and attunes the saber.'], ['emitter', 'EMITTER', 'Where the blade leaves the hilt.'],
               ['hilt', 'GRIP', 'The body of the hilt, where your hand closes.'], ['pommel', 'POMMEL', 'The end below the hand.']];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chapterName = (id) => { const c = chapterOrder(null, 'jedi').find(x => x.id === id); return c ? forHero(c.title, 'jedi') : id.toUpperCase(); };
let picks = {}, lit = false;

const row = (id) => ROWS.find(r => r.id === id);
const fitted = (id) => wornOption('jedi', row(id), picks.jedi || {});
function partLine(rowId, o){
  if (rowId === 'saber') return crystalOf(o.id).att;
  const b = BENCH.find(r => r.id === rowId), p = b && b.parts.find(x => x.id === o.id);
  return p ? p.line : '';
}
function tray([id, label, sub], n){
  const R = row(id), cur = fitted(id), prof = profileOf('jedi');
  const tiles = R.options.map(o => {
    const shut = !optionOpen('jedi', R, o), e = o.earn && earnProgress(prof, o.earn);
    const where = shut ? earnText(o.earn, chapterName) + (e && e.need > 1 ? ' · ' + Math.min(e.have, e.need) + '/' + e.need : '') : partLine(id, o);
    const sw = id === 'saber' ? `<i class="wb-sw" style="--c:${hex(swatchOf(o))}"></i>` : '';
    return `<div class="wb-part${o === cur ? ' on' : ''}${shut ? ' shut' : ''}" data-row="${id}" data-opt="${o.id}">`
      + `<b>${sw}${esc(o.name)}</b><em>${o === cur ? 'FITTED' : shut ? 'LOCKED' : ''}</em><span>${esc(where)}</span></div>`;
  }).join('');
  return `<section class="wb-tray"><header><i>${String(n + 1).padStart(2, '0')}</i><h3>${label}</h3></header><p>${sub}</p><div class="wb-parts">${tiles}</div></section>`;
}
function readout(){
  const c = crystalOf(fitted('saber').id), [gain, cost] = c.ds.split(' · ');
  return `<div class="wb-att"><div class="wb-att-h"><b>ATTUNEMENT</b><span>${esc(c.att)}</span></div>`
    + (c.fx.length ? `<div class="wb-fx"><i>GAIN</i>${esc(gain)}</div><div class="wb-fx cost"><i>COST</i>${esc(cost)}</div>` : `<div class="wb-fx"><i>—</i>${esc(c.ds)}</div>`)
    + `<p>A crystal trades one small edge for another. The grip, emitter and pommel change how the saber looks, not how it fights.</p></div>`;
}
function render(){
  const live = runLive();
  panel.innerHTML = `<div class="wb-panel">
    <div class="wb-head"><h2>SABER WORKBENCH</h2><div class="wb-x" id="wbclose">CLOSE</div></div>
    <div class="wb-count"><span>PARTS</span><b>${partsOwned()} / ${partsTotal()}</b></div>
    <p class="wb-note">More parts come from duels, the masters' trials, story missions, arcade contracts and survival waves.</p>
    ${live ? '<p class="wb-live">A run is on: the saber is built between runs. Look over it here, and fit new parts from the main menu.</p>' : ''}
    <div class="wb-trays${live ? ' wb-locked' : ''}">${TRAYS.map(tray).join('')}</div>
    ${readout()}
    <div class="wb-actions"><div class="wb-btn" id="wbtest">${lit ? 'TAKE APART' : 'TEST IGNITION'}</div><div class="wb-btn main" id="wbdone">DONE</div></div>
    <div class="wb-hint">Drag the bench to turn the hilt. Esc to finish.</div>
  </div>`;
}

export function openWorkbench(){
  audioInit();
  picks = loadPicks(); lit = false;
  setBenchSaber(picks);
  igniteBench(false);
  openBench(true);
  document.body.classList.add('wb-open');
  panel.classList.add('open');
  render();
}
export function closeWorkbench(){
  if (!panel.classList.contains('open')) return;
  panel.classList.remove('open');
  document.body.classList.remove('wb-open');
  openBench(false);
  if (!runLive()){ savePicks(picks); refreshWorn(); }   // the hero carries the new saber from the next run (ui/customizer.js)
}
export const workbenchOpen = () => panel.classList.contains('open');

function fit(rowId, optId){
  const R = row(rowId), o = R && R.options.find(x => x.id === optId);
  if (!o || runLive()) return;
  if (!optionOpen('jedi', R, o)){ S.uiDeny(); return; }
  if (fitted(rowId) === o) return;
  picks = { ...picks, jedi: { ...(picks.jedi || {}), [rowId]: optId } };
  S.uiClick();
  setBenchSaber(picks);
  if (lit){ lit = false; igniteBench(false); }
  render();
}

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // never launches the game
  const t = e.target, tile = t.closest('[data-opt]');
  if (tile) return fit(tile.dataset.row, tile.dataset.opt);
  if (t.closest('#wbclose') || t.closest('#wbdone')) return closeWorkbench();
  if (t.closest('#wbtest')){
    lit = igniteBench();
    const kind = G.stance === 'staff' ? 'niman' : G.stance;
    if (lit) setTimeout(() => { if (lit && workbenchOpen()) S.ignite(kind, null, true); }, 260); else S.retract(kind, null, true);
    render();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && workbenchOpen()) closeWorkbench(); });
if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); openWorkbench(); });
// drag on the bench (anywhere off the panel) to turn the hilt on its long axis
let dragX = null;
panel.addEventListener('pointerdown', (e) => { if (e.target === panel){ dragX = e.clientX; panel.setPointerCapture(e.pointerId); } });
panel.addEventListener('pointermove', (e) => { if (dragX !== null){ spinBench((e.clientX - dragX) * 0.012); dragX = e.clientX; } });
for (const ev of ['pointerup', 'pointercancel']) panel.addEventListener(ev, () => { dragX = null; });
