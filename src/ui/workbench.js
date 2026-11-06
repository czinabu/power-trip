// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SABER WORKBENCH: its own screen, opened from SABER on the main menu (or the customizer's link). (The trooper's and
// the Mando's benches are ui/kitbench.js: the same button opens theirs.) The saber lies in
// pieces on a lamp-lit bench (ui/bench-stage.js); this is the panel beside it: a rail of the slots (the kyber crystal,
// the emitter, the grip, the pommel) and the open slot's parts, earned ones first (ui/bench-panel.js), the fitted crystal's ATTUNEMENT read out as its
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
import { openKitBench } from './kitbench.js';
import { pageTabs, pageTabClick } from './page-tabs.js';
import { slotRail, slotBody, lockFold, keepScroll, putScroll } from './bench-panel.js';

const panel = document.getElementById('workbench');
const btn = document.getElementById('wbBtn');
const ROWS = CUSTOMIZE.jedi.filter(r => r.bench);
// the trays, in the order a saber is put together, and what each is called on the bench
const TRAYS = [['saber', 'KYBER CRYSTAL', 'The heart of the blade. It sets the colour and attunes the saber.'], ['emitter', 'EMITTER', 'Where the blade leaves the hilt.'],
               ['hilt', 'GRIP', 'The body of the hilt, where your hand closes.'], ['pommel', 'POMMEL', 'The end below the hand.']];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chapterName = (id) => { const c = chapterOrder(null, 'jedi').find(x => x.id === id); return c ? forHero(c.title, 'jedi') : id.toUpperCase(); };
let picks = {}, lit = false, slot = 'saber', showShut = false;   // (the open slot, and whether the parts still to earn are shown)

const row = (id) => ROWS.find(r => r.id === id);
const fitted = (id) => wornOption('jedi', row(id), picks.jedi || {});
function partLine(rowId, o){
  if (rowId === 'saber') return crystalOf(o.id).att;
  const b = BENCH.find(r => r.id === rowId), p = b && b.parts.find(x => x.id === o.id);
  return p ? p.line : '';
}
// a part's tile: fitted, earned or still to earn (with how, and how far along)
function tile(id, R, o, cur, prof){
  const shut = !optionOpen('jedi', R, o), e = o.earn && earnProgress(prof, o.earn);
  const where = shut ? earnText(o.earn, chapterName) + (e && e.need > 1 ? ' · ' + Math.min(e.have, e.need) + '/' + e.need : '') : partLine(id, o);
  const sw = id === 'saber' ? `<i class="wb-sw" style="--c:${hex(swatchOf(o))}"></i>` : '';
  return { shut, where, frac: e && e.need ? Math.min(e.have, e.need) / e.need : 0, name: o.name,
    html: `<div class="wb-part${o === cur ? ' on' : ''}${shut ? ' shut' : ''}" data-row="${id}" data-opt="${o.id}">`
      + `<b>${sw}${esc(o.name)}</b><em>${o === cur ? 'FITTED' : shut ? 'LOCKED' : ''}</em><span>${esc(where)}</span></div>` };
}
// the open slot: the parts earned as a grid, the rest folded under them (ui/bench-panel.js)
function tray(id){
  const [, , sub] = TRAYS.find(t => t[0] === id), R = row(id), cur = fitted(id), prof = profileOf('jedi');
  const all = R.options.map(o => tile(id, R, o, cur, prof)), open = all.filter(t => !t.shut), shut = all.filter(t => t.shut);
  return slotBody(sub, open.map(t => t.html).join(''),
    lockFold(shut, shut.map(t => t.html).join(''), showShut, 'More parts come from duels, the masters\' trials, story missions, challenges and survival waves.'));
}
const slots = () => TRAYS.map(([id, label]) => { const R = row(id); return { id, label, fitted: fitted(id).name, have: R.options.filter(o => optionOpen('jedi', R, o)).length, all: R.options.length }; });
function readout(){
  const c = crystalOf(fitted('saber').id), [gain, cost] = c.ds.split(' · ');
  return `<div class="wb-att"><div class="wb-att-h"><b>ATTUNEMENT</b><span>${esc(c.att)}</span></div>`
    + (c.fx.length ? `<div class="wb-fx"><i>GAIN</i>${esc(gain)}</div><div class="wb-fx cost"><i>COST</i>${esc(cost)}</div>` : `<div class="wb-fx"><i>—</i>${esc(c.ds)}</div>`)
    + `<p>A crystal trades one small edge for another. The grip, emitter and pommel change how the saber looks, not how it fights.</p></div>`;
}
// keep: hold the parts pane's scroll across the redraw (a pick made far down a slot), not jump back to the top
function render(keep = false){
  const was = keep ? keepScroll(panel) : 0;
  const live = runLive();
  panel.innerHTML = `<div class="wb-panel bp">
    ${pageTabs('jedi', 'bench')}
    <div class="wb-head"><h2>SABER WORKBENCH</h2><div class="wb-x" id="wbclose">CLOSE</div></div>
    <div class="wb-count"><span>PARTS</span><b>${partsOwned()} / ${partsTotal()}</b></div>
    ${live ? '<p class="wb-live">A run is on: the saber is built between runs. Look over it here, and fit new parts from the main menu.</p>' : ''}
    <div class="bp-split">${slotRail(slots(), slot)}<div class="bp-parts${live ? ' wb-locked' : ''}">${tray(slot)}</div></div>
    <div class="bp-foot">${readout()}
      <div class="wb-actions"><div class="wb-btn" id="wbtest">${lit ? 'TAKE APART' : 'TEST IGNITION'}</div><div class="wb-btn main" id="wbdone">DONE</div></div>
      <div class="wb-hint">Drag the bench to turn the hilt. Esc to finish.</div></div>
  </div>`;
  putScroll(panel, was);
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
  document.dispatchEvent(new CustomEvent('workbench-closed'));   // (the temple's forge goes back to the forge: ui/hub-ui.js)
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
  render(true);   // (a pick keeps the panel where it was scrolled to)
}

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // never launches the game
  const t = e.target, tile = t.closest('[data-opt]');
  if (tile) return fit(tile.dataset.row, tile.dataset.opt);
  const sl = t.closest('[data-slot]');
  if (sl){ if (sl.dataset.slot !== slot){ slot = sl.dataset.slot; S.uiClick(); render(); } return; }   // another slot (ui/bench-panel.js)
  if (t.closest('[data-bpfold]')){ showShut = !showShut; S.uiClick(); render(true); return; }   // the parts still to earn: shown or folded
  if (pageTabClick(e)) return;   // APPEARANCE: back to the customizer (ui/customizer.js)
  if (t.closest('#wbclose') || t.closest('#wbdone')) return closeWorkbench();
  if (t.closest('#wbtest')){
    lit = igniteBench();
    const kind = G.stance === 'staff' ? 'niman' : G.stance;
    if (lit) setTimeout(() => { if (lit && workbenchOpen()) S.ignite(kind, null, true); }, 260); else S.retract(kind, null, true);
    render(true);   // (and so does the ignition)
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && workbenchOpen()) closeWorkbench(); });
// the menu's bench button: the Jedi's saber workbench, the trooper's armory locker or the Mando's beskar forge (ui/kitbench.js)
if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); if (!openKitBench(G.hero)) openWorkbench(); });
// drag on the bench (anywhere off the panel) to turn the hilt on its long axis
let dragX = null;
panel.addEventListener('pointerdown', (e) => { if (e.target === panel){ dragX = e.clientX; panel.setPointerCapture(e.pointerId); } });
panel.addEventListener('pointermove', (e) => { if (dragX !== null){ spinBench((e.clientX - dragX) * 0.012); dragX = e.clientX; } });
for (const ev of ['pointerup', 'pointercancel']) panel.addEventListener(ev, () => { dragX = null; });
