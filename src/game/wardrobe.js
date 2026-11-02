// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WARDROBE: which customizer options (data/customize.js) the player has earned. A new player starts on the basics,
// and an option with `unlock: '<chapter id>'` opens once that chapter of THIS hero's campaign has been cleared
// (`unlock: 'won'`: once the hero's campaign is beaten). Beating the campaign with a hero opens all of its options.
// The look is one look in every mode: the sandbox, missions, arcade, survival, training and co-op all wear what is open.
//
// What counts as cleared, per hero, all localStorage and all carried by the save slots and wiped by NEW GAME
// (game/saves.js: every sw_camp_ key):
//   sw_camp_ch_<hero>     the chapters the run has moved past (game/sandbox-unlocks.js recordChapters)
//   sw_camp_looks_<hero>  the chapters whose looks were handed out at their close (game/look-unlocks.js)
//   sw_camp_<hero>        '1' once the campaign is beaten (game/summary.js)
// Players from before the wardrobe keep what they were wearing: on the first load their customizer picks are written
// down once (sw_look_kept, kept on this device and through NEW GAME) and stay open for good.
//
// No imports on purpose: player/mesh.js dresses the hero while the modules are still loading.

const DEV_ALL = (() => { try { return new URLSearchParams(location.search).get('looks') === 'all'; } catch(e){ return false; } })();   // ?looks=all: everything open, for testing
const KEPT = 'sw_look_kept';
// the trooper's promotion to ARC: the end of Act I's last chapter (BROTHERS IN ARMS), where his skill tree's ARC tier opens too
export const PROMOTION = 'trial-first';

const local = (k) => { try { return localStorage.getItem(k); } catch(e){ return null; } };
// src: a save slot's progress ({ key: value }) to read instead of the live one (ui/saves-ui.js names a slot's hero by it)
const getter = (src) => src ? (k) => (src[k] != null ? src[k] : null) : local;
function list(get, k){
  try { const v = JSON.parse(get(k)); return Array.isArray(v) ? v : []; } catch(e){ return []; }
}
export function campaignBeaten(hero, src){ return getter(src)('sw_camp_' + hero) === '1'; }
// has this hero cleared chapter `id` (or, for 'won', beaten the campaign)?
export function chapterEarned(hero, id, src){
  if (DEV_ALL || campaignBeaten(hero, src)) return true;
  if (id === 'won') return false;
  const get = getter(src);
  return list(get, 'sw_camp_ch_' + hero).includes(id) || list(get, 'sw_camp_looks_' + hero).includes(id);
}
// the picks a player had before the wardrobe: { hero: { rowId: optionId } }, written down once
let kept = null;
function keptPicks(){
  if (kept) return kept;
  try {
    kept = JSON.parse(localStorage.getItem(KEPT));
    if (!kept || typeof kept !== 'object'){
      kept = JSON.parse(localStorage.getItem('sw_look')) || {};
      localStorage.setItem(KEPT, JSON.stringify(kept));
    }
  } catch(e){ kept = kept && typeof kept === 'object' ? kept : {}; }
  return kept;
}
// can the player wear this option of this row, as this hero?
export function optionOpen(hero, row, opt){
  if (!opt.unlock || chapterEarned(hero, opt.unlock)) return true;
  const k = keptPicks()[hero];
  return !!(k && k[row.id] === opt.id);
}
// the chapter's looks are handed out (its close): true when it wasn't already
export function recordLooks(hero, id){
  const k = 'sw_camp_looks_' + hero, have = list(local, k);
  if (have.includes(id)) return false;
  try { localStorage.setItem(k, JSON.stringify([...have, id])); } catch(e){}
  return true;
}
// the trooper goes by TROOPER until the Captain makes him an ARC (src: a save slot's progress)
export const trooperPromoted = (src) => chapterEarned('trooper', PROMOTION, src);
// ui/customizer.js fills this in: dress the player in what is newly open (called by the menu and as a chapter starts,
// through here so neither has to import the customizer)
export const wardrobeHooks = { refresh: null };
export const refreshWorn = () => wardrobeHooks.refresh ? wardrobeHooks.refresh() : false;
export const heroName = (hero, src) => hero === 'trooper' ? (trooperPromoted(src) ? 'ARC TROOPER' : 'TROOPER') : hero === 'mando' ? 'MANDALORIAN' : 'JEDI';
