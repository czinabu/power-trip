// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CHARACTER CUSTOMIZER: from the main menu, CUSTOMIZE swaps the menu column for the hero's options (data/customize.js).
// Each pick restyles the figure on the showcase turntable at once; DONE saves the picks and rebuilds the player, so
// the next run plays in the new look. Picks are saved per hero in localStorage (player/mesh.js).
// LOCKED options (data/customize.js `unlock`, game/wardrobe.js) show dimmed with a lock and the chapter that unlocks them;
// a hero wears the row's first open option until one is picked, so new gear goes on by itself as the campaign hands it out.

import { G, player } from '../state.js';
import { CUSTOMIZE, wornOption, wornPicks, swatchOf } from '../data/customize.js';
import { STANCES } from '../data/stances.js';
import { chapterOrder, forHero } from '../data/campaign.js';
import { optionOpen, heroName, wardrobeHooks } from '../game/wardrobe.js';
import { svgIcon } from './icons.js';
import { S } from '../audio/sfx.js';
import { loadPicks, savePicks, rebuildPlayerModel } from '../player/mesh.js';
import { setHero, dressHeroParts } from '../player/hero.js';
import { syncMandoChips } from '../game/flow.js';
import { bladeColor, heldGrip } from '../player/helpers.js';
import { applySaberGrip } from '../player/model/weapons.js';
import { restyleShowcase, focusShowcase, spinShowcase } from './showcase.js';
import { overlay, setOverlayState, heroPicked } from './menus.js';
import { audioInit } from '../audio/sfx.js';
import { earnText } from '../data/saber-parts.js';
import { openKitBench, closeKitBench, kitBenchOpen } from './kitbench.js';
import { pageTabs, pageTabClick } from './page-tabs.js';
import { armorerHooks } from '../game/armorer.js';
import { packHooks } from '../game/pack.js';

const rowsEl = document.getElementById('czrows');
let picks = loadPicks();
const wornKey = (p) => JSON.stringify(wornPicks(p));
let saved = wornKey(picks);   // what the player model is built from (the picks as worn: game/wardrobe.js)

const hex = c => '#' + c.toString(16).padStart(6, '0');
const ROMAN = ['I', 'II', 'III'];
// the bench rows (`bench`: the saber's, the trooper's locker's, the Mando's forge's) live on their own screens
// (ui/workbench.js, ui/kitbench.js), not here
const rowsShown = (hero) => CUSTOMIZE[hero].filter(r => !r.bench);
// where an option is earned or unlocks, in words
function optWhere(hero, o){ return o.earn ? earnText(o.earn, (id) => chapterTitle(hero, id)) : 'unlocks in ' + unlockWhere(hero, o.unlock); }
function chapterTitle(hero, id){ const c = chapterOrder(null, hero).find(ch => ch.id === id); return c ? forHero(c.title, hero) : id.toUpperCase(); }
// where an option unlocks, in words: 'ACT I · THE KILL HOUSE', or 'BEAT THE CAMPAIGN'
function unlockWhere(hero, id){
  if (id === 'won') return 'BEAT THE CAMPAIGN';
  const c = chapterOrder(null, hero).find(ch => ch.id === id);
  return c ? 'ACT ' + ROMAN[c.act] + ' · ' + forHero(c.title, hero) : 'THE CAMPAIGN';
}
const hintEl = document.getElementById('czlock');
// a row's options as shown: the ones open from the start first, then by the chapter that unlocks them, the campaign's
// end last (the data's own order still decides what a hero wears by default: data/customize.js)
function shownOrder(hero, row){
  const list = chapterOrder(null, hero).map(c => c.id);
  const at = (o) => o.earn ? 0 : !o.unlock ? -1 : o.unlock === 'won' ? 1e3 : (list.indexOf(o.unlock) + 1 || 999);   // (the bench keeps its own order)
  return row.options.map((o, i) => [o, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map(([o]) => o);
}

function render(){
  const hero = G.hero, mine = picks[hero] || {};
  syncHeroNames();
  const tabs = document.getElementById('czhero');
  for (const t of tabs.querySelectorAll('span')) t.classList.toggle('on', t.dataset.h === hero);
  document.getElementById('czpage').innerHTML = pageTabs(hero, 'look');   // APPEARANCE | the hero's bench (ui/page-tabs.js)
  let open = 0, all = 0;
  rowsEl.innerHTML = rowsShown(hero).map(row => {
    const cur = wornOption(hero, row, mine);
    const opts = shownOrder(hero, row).map(o => {
      const shut = !optionOpen(hero, row, o); all++; if (!shut) open++;
      const cls = (o === cur ? ' sel' : '') + (shut ? ' locked' : '');
      const tip = shut ? o.name + ' · ' + optWhere(hero, o) : o.name;
      return row.kind === 'color'
        ? `<span class="cz-sw${cls}" data-row="${row.id}" data-opt="${o.id}" title="${tip}" style="--c:${hex(swatchOf(o))}">${shut ? svgIcon('lock', 'lk') : ''}</span>`
        : `<span class="cz-chip${cls}" data-row="${row.id}" data-opt="${o.id}" title="${tip}">${shut ? svgIcon('lock', 'lk') : ''}${o.name}</span>`;
    }).join('');
    return `<div class="cz-row"><div class="sec-label">${row.label}<span class="cz-val">${cur.name}</span></div>`
      + `<div class="cz-opts ${row.kind}">${opts}</div></div>`;
  }).join('');
  if (hintEl) hintEl.innerHTML = open < all
    ? svgIcon('lock', 'lk') + ' <b>' + open + ' / ' + all + '</b> unlocked · the campaign hands out the rest, chapter by chapter'
    : '<b>Everything unlocked</b>';
}
// a locked option: say where it opens, instead of wearing it
function denied(row, o){
  S.uiDeny();
  if (hintEl) hintEl.innerHTML = svgIcon('lock', 'lk') + ' <b>' + o.name.toUpperCase() + '</b> · ' + optWhere(G.hero, o);
}

function pick(rowId, optId){
  const hero = G.hero, row = CUSTOMIZE[hero].find(r => r.id === rowId), o = row && row.options.find(x => x.id === optId);
  if (!o) return;
  if (!optionOpen(hero, row, o)) return denied(row, o);
  picks = { ...picks, [hero]: { ...(picks[hero] || {}), [rowId]: optId } };
  restyleShowcase(picks);
  render();
}

function randomize(){
  const hero = G.hero, mine = { ...(picks[hero] || {}) };
  for (const row of rowsShown(hero)){   // (the looks only: randomizing leaves the saber you built)
    const open = row.options.filter(o => optionOpen(hero, row, o));   // (only what is unlocked)
    mine[row.id] = open[Math.floor(Math.random() * open.length)].id;
  }
  picks = { ...picks, [hero]: mine };
  restyleShowcase(picks);
  render();
}

function reset(){   // (the looks only: resetting leaves the saber you built)
  const keep = {};
  for (const row of CUSTOMIZE[G.hero]) if (row.bench && picks[G.hero] && picks[G.hero][row.id] != null) keep[row.id] = picks[G.hero][row.id];
  picks = { ...picks, [G.hero]: keep };
  restyleShowcase(picks);
  render();
}

export function openCustomizer(){
  overlay.classList.add('customizing');
  document.getElementById('ovsub').textContent = 'CUSTOMIZE YOUR LEGEND';
  focusShowcase(true);
  render();
}

export function closeCustomizer(){
  if (!overlay.classList.contains('customizing')) return;
  overlay.classList.remove('customizing');
  focusShowcase(false);
  savePicks(picks);   // saved BEFORE the menu comes back: the menu reloads the saved picks (refreshWornLook), and saving
                      // after it wrote the old picks back over the new ones, so DONE kept nothing
  if (wornKey(picks) !== saved) dressPlayer();
  setOverlayState('menu');   // restores the headline
  document.dispatchEvent(new CustomEvent('customizer-closed'));   // (opened from the temple's forge: back to it, ui/hub-ui.js)
}
// a loaded save brings its own look (ui/saves-ui.js): pick it up and dress the player in it
export function reloadLook(){
  picks = loadPicks();
  restyleShowcase(picks);
  syncHeroNames();
  if (wornKey(picks) !== saved) dressPlayer();
}
// the campaign unlocked something the hero now wears (a row's first option, the trooper's ARC kit): dress the player in
// it. game/campaign.js calls this as the next chapter starts, so the new gear is on when the hero walks in
export function refreshWornLook(){
  if (!czReady) return false;   // (the menu can ask while the modules are still loading)
  if (overlay.classList.contains('customizing')) return false;   // mid-edit: the unsaved picks are the ones that count
  picks = loadPicks();
  syncHeroNames();
  if (wornKey(picks) === saved) return false;
  dressPlayer();
  restyleShowcase(picks);
  return true;
}
armorerHooks.refit = refreshWornLook;   // the Armorer's new piece goes on at once (game/armorer.js)
// the jetpack goes on (or comes off) the player's back as the run earns it (game/pack.js): rebuild on the picks as they are
export function refitPack(){
  if (!czReady || overlay.classList.contains('customizing')) return;   // (mid-edit: the rebuild on leaving the customizer fits it)
  picks = loadPicks();
  dressPlayer();
  if (G.mode === 'play' && G.hero === 'mando') syncMandoChips();   // (and the JETPACK chip with it)
}
packHooks.refit = refitPack;
// the trooper goes by TROOPER until his promotion, then ARC TROOPER (game/wardrobe.js): every place the menu names him
export function syncHeroNames(){
  const n = heroName('trooper');
  for (const el of document.querySelectorAll('.cz-tabs span[data-h="trooper"], #hero-trooper .hn')) el.textContent = n;
}
function dressPlayer(){
  saved = wornKey(picks);
  // the player wears the new look from the next run: rebuild it, then put back what the old model carried
  rebuildPlayerModel(picks);
  applySaberGrip(player, heldGrip(), G.mode !== 'play');
  const st = STANCES[G.stance];
  if (st){ player.blade.glow.material.color.setHex(bladeColor(st)); player.blade.light.color.setHex(bladeColor(st)); }
  if (G.mode === 'play') dressHeroParts();   // mid-run (refreshWornLook): the outfit only, the kit in hand stays as it is
  else setHero(G.hero);
}

syncHeroNames();
var czReady = true;   // (a var, hoisted: refreshWornLook can be called before this module has run)
wardrobeHooks.refresh = refreshWornLook;

/* ---------- input ---------- */
document.getElementById('cztoggle').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openCustomizer(); });
document.getElementById('customizer').addEventListener('click', (e) => {
  e.stopPropagation();   // picking an option must never launch the game
  const opt = e.target.closest('[data-opt]');
  if (opt) return pick(opt.dataset.row, opt.dataset.opt);
  if (pageTabClick(e)) return;   // the bench's tab: 'hero-page' below
  const ht = e.target.closest('[data-h]');
  if (ht && ht.dataset.h !== G.hero){ setHero(ht.dataset.h); heroPicked(); render(); return; }   // (the title screen's pick follows: its saved run too)
  if (e.target.closest('#czrandom')) randomize();
  else if (e.target.closest('#czreset')) reset();
  else if (e.target.closest('#czdone')) closeCustomizer();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCustomizer(); });
// APPEARANCE | LOCKER / FORGE (ui/page-tabs.js; the Jedi has no tabs, the saber is the workbench's alone): a tab, or the pad's LB / RB, turns between the customizer and the hero's bench.
// Each is still its own screen: the one shown closes (saving what was picked on it) and the other opens on the saved picks.
// (At the temple's forge the closing screen's event is looked at a moment later, with the other open: ui/hub-ui.js)
document.addEventListener('hero-page', (e) => {
  const to = e.detail;
  if (to === 'bench' && overlay.classList.contains('customizing')){
    closeCustomizer();
    openKitBench(G.hero);   // (the trooper's locker or the Mando's forge: ui/kitbench.js)
  } else if (to === 'look' && kitBenchOpen()){
    closeKitBench();
    picks = loadPicks();   // what the bench just fitted (the saber, the kit) comes along, so DONE here can't undo it
    restyleShowcase(picks);
    openCustomizer();
  } else return;
  S.uiClick();
});

// drag on the stage to turn the hero on the stand
let dragX = null;
overlay.addEventListener('pointerdown', (e) => {
  if (!overlay.classList.contains('customizing') || e.target !== overlay) return;
  dragX = e.clientX;
  overlay.setPointerCapture(e.pointerId);
});
overlay.addEventListener('pointermove', (e) => {
  if (dragX === null) return;
  spinShowcase((e.clientX - dragX) * 0.01);
  dragX = e.clientX;
});
for (const ev of ['pointerup', 'pointercancel']) overlay.addEventListener(ev, () => { dragX = null; });
