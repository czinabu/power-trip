// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARMORY LOCKER (the trooper) and THE BESKAR FORGE (the Mando): the gunners' version of the Jedi's SABER WORKBENCH
// (ui/workbench.js), opened from the main menu's bench button (LOCKER / FORGE, where the Jedi's says SABER), the
// customizer's link, or a hub's forge station (ui/hub-ui.js). The hero stands on the showcase turntable (ui/showcase.js)
// wearing every pick as it's made, in the bench's own room (ui/kit-stage.js: a Kamino armory bay, the Armorer's cave)
// instead of the customizer's sky; this is the panel beside it: a rail of the hero's bench slots
// (data/trooper-locker.js, data/beskar-forge.js) and the open slot's parts, earned ones first (ui/bench-panel.js), and the sidegrades read out as gain and cost.
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
import { pageTabs, pageTabClick } from './page-tabs.js';
import { slotRail, slotBody, lockFold, keepScroll, putScroll } from './bench-panel.js';
import { restyleShowcase, focusShowcase, spinShowcase, showcaseRifle, showcaseKit } from './showcase.js';

const overlay = document.getElementById('overlay');
const panel = document.createElement('div');
panel.id = 'kitbench';
overlay.appendChild(panel);

// each bench's own words: the trooper signs his kit out of a Republic armory; the Mando's is worked at the Armorer's anvil
const WORDS = {
  trooper: {
    kicker: 'KAMINO · ARMORY BAY 7', count: 'GEAR ISSUED', fitted: 'ISSUED', locked: 'REQUISITION', loadout: 'FIELD LOADOUT',
    gain: 'BOOST', cost: 'DRAW', done: 'SIGN OUT KIT', hint: 'Drag to turn on the fitting pad · Esc to sign out',
    note: 'More gear is issued for the campaign\'s chapters, story missions, challenges, survival waves, duellists beaten and squadmates brought home.',
    side: 'The power pack and the specialist each trade one small edge for another. Paint, markings, helmet gear, the backpack and the rifle\'s stock and finish are how you look, not how you fight.',
  },
  mando: {
    kicker: 'THE COVERT · THE ARMORER\'S ANVIL', count: 'PIECES FORGED', fitted: 'WORN', locked: 'NOT YET EARNED', loadout: 'THE ARMORER\'S WORK',
    gain: 'GIVES', cost: 'TAKES', done: 'TAKE UP THE ARMOUR', hint: 'Drag to turn in the firelight · Esc to leave the forge',
    note: 'More pieces are earned in the campaign\'s chapters, story missions, challenges, survival waves and duellists beaten.',
    side: 'Forged beskar trades one small edge for another. The signet, helmet mod, jetpack, vambraces and chest kit are how you look, not how you fight.',
  },
};
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let hero = 'trooper', picks = {}, showShut = false;
const slot = { trooper: null, mando: null };   // each bench's open slot, and whether the parts still to earn are shown

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
// a part's tile: fitted, earned, or still to earn (with how, and how far along)
function tile(R, o, cur){
  const W = WORDS[hero], shut = !optionOpen(hero, R, o), p = partOf(R.id, o.id) || {};
  const where = shut ? whereLocked(o) : R.side ? (p.fx && p.fx.length || p.role ? p.ds : 'No sidegrade') : (p.line || '');
  const col = R.kind === 'color' ? swatchOf(o) : p.col;
  const sw = col != null ? `<i class="kb-sw" style="--c:${hex(col)}"></i>` : '';
  const tag = o === cur ? W.fitted : shut ? W.locked : '', e = o.earn && earnProgress(profileOf(hero), o.earn);
  return { shut, where, name: o.name, frac: e && e.need ? Math.min(e.have, e.need) / e.need : 0,
    html: `<div class="kb-tag${o === cur ? ' on' : ''}${shut ? ' shut' : ''}" data-row="${R.id}" data-opt="${o.id}">`
      + `<b>${sw}${esc(o.name)}</b>${tag ? `<em>${tag}</em>` : ''}<span>${esc(where)}</span></div>` };
}
// the open slot: the parts earned as a grid, the rest folded under them (ui/bench-panel.js)
function tray(R){
  const b = benchRow(R.id), cur = fitted(R.id), all = R.options.map(o => tile(R, o, cur));
  const open = all.filter(t => !t.shut), shut = all.filter(t => t.shut);
  return slotBody(b.sub || '', open.map(t => t.html).join(''), lockFold(shut, shut.map(t => t.html).join(''), showShut, WORDS[hero].note));
}
const slots = () => rowsOf().map(R => ({ id: R.id, label: R.label, fitted: fitted(R.id).name, have: R.options.filter(o => optionOpen(hero, R, o)).length, all: R.options.length }));
// the sidegrades fitted, as gain and cost
function readout(){
  const W = WORDS[hero], sides = rowsOf().filter(r => r.side).map(R => ({ R, p: partOf(R.id, fitted(R.id).id) }));
  const one = ({ R, p }) => {
    const [gain, cost] = String(p.ds).split(' · ');
    const has = p.fx ? p.fx.length : !!p.role;
    return `<div class="kb-slot"><div class="kb-slot-h"><span>${esc(R.label)}</span><b>${esc(p.att)}</b></div>`
      + (has ? `<div class="kb-fx up"><i>${W.gain}</i>${esc(gain)}</div><div class="kb-fx down"><i>${W.cost}</i>${esc(cost || '')}</div>` : `<div class="kb-fx none">${esc(p.ds)}</div>`)
      + '</div>';
  };
  return `<div class="kb-load"><h4>${W.loadout}</h4>${sides.map(one).join('')}<p>${W.side}</p></div>`;
}
// keep: hold the parts pane's scroll across the redraw (a pick made far down a slot), not jump back to the top
function render(keep = false){
  const was = keep ? keepScroll(panel) : 0;
  const W = WORDS[hero], live = runLive(), have = partsOwned(hero), all = partsTotal(hero);
  if (!rowsOf().some(R => R.id === slot[hero])) slot[hero] = rowsOf()[0].id;
  panel.className = 'kb-' + hero;
  panel.innerHTML = `<div class="kb-panel bp">
    ${pageTabs(hero, 'bench')}
    <div class="kb-head"><div><small>${W.kicker}</small><h2>${BENCH_NAME[hero]}</h2></div><div class="kb-x" id="kbclose">CLOSE</div></div>
    <div class="kb-meter"><span>${W.count}</span><div class="kb-bar"><i style="width:${all ? Math.round(have / all * 100) : 0}%"></i></div><b>${have} / ${all}</b></div>
    ${live ? '<p class="kb-live">A run is on: your kit is changed between runs. Look it over here, and fit new parts from the main menu.</p>' : ''}
    <div class="bp-split">${slotRail(slots(), slot[hero])}<div class="bp-parts${live ? ' kb-locked' : ''}">${tray(row(slot[hero]))}</div></div>
    <div class="bp-foot">${readout()}<div class="kb-foot"><div class="kb-btn" id="kbdone">${W.done}</div><div class="kb-hint">${W.hint}</div></div></div>
  </div>`;
  putScroll(panel, was);
}

// open the hero's bench (the trooper's locker or the Mando's forge). The Jedi's is the saber workbench (ui/workbench.js)
export function openKitBench(h = G.hero){
  if (h !== 'trooper' && h !== 'mando') return false;
  audioInit();
  hero = h; picks = loadPicks();
  overlay.classList.add('kitbench');
  focusShowcase(true);
  showcaseRifle(h === 'trooper');   // (the DC-15 in hand, so its stock and finish show)
  showcaseKit(h);                   // the armory bay or the Armorer's cave round him (ui/kit-stage.js)
  restyleShowcase(picks);
  render();
  return true;
}
export function closeKitBench(){
  if (!overlay.classList.contains('kitbench')) return;
  overlay.classList.remove('kitbench');
  focusShowcase(false);
  showcaseRifle(false);
  showcaseKit(null);
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
  render(true);   // (a pick keeps the panel where it was scrolled to)
}

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // never launches the game
  const t = e.target, tile = t.closest('[data-opt]');
  if (tile) return fit(tile.dataset.row, tile.dataset.opt);
  const sl = t.closest('[data-slot]');
  if (sl){ if (sl.dataset.slot !== slot[hero]){ slot[hero] = sl.dataset.slot; S.uiClick(); render(); } return; }   // another slot (ui/bench-panel.js)
  if (t.closest('[data-bpfold]')){ showShut = !showShut; S.uiClick(); render(true); return; }   // the parts still to earn: shown or folded
  if (pageTabClick(e)) return;   // APPEARANCE: back to the customizer (ui/customizer.js)
  if (t.closest('#kbclose') || t.closest('#kbdone')) return closeKitBench();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && kitBenchOpen()) closeKitBench(); });
// drag anywhere off the panel to turn the hero on the stand
let dragX = null;
panel.addEventListener('pointerdown', (e) => { if (e.target === panel){ dragX = e.clientX; panel.setPointerCapture(e.pointerId); } });
panel.addEventListener('pointermove', (e) => { if (dragX !== null){ spinShowcase((e.clientX - dragX) * 0.01); dragX = e.clientX; } });
for (const ev of ['pointerup', 'pointercancel']) panel.addEventListener(ev, () => { dragX = null; });
