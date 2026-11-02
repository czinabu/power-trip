// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CODEX'S UNLOCKS: an entry opens the first time its foe shows up (data/codex.js), in any mode.

import { CODEX_BY_ID, BOSS_ENTRY, namedEntry, allyEntry } from '../data/codex.js';

/* Kept in localStorage under sw_codex ({ id: 1 met, not looked at yet · 2 met and read }). It is a PROGRESS key
   (game/saves.js), so each save slot carries its own codex, loading a slot brings that one back and NEW GAME clears it.
   The parsed copy is cached and re-read only when the stored string changes (a slot loaded, a new game). */
const KEY = 'sw_codex';
let raw, met = {};
function load(){
  let r = null;
  try { r = localStorage.getItem(KEY); } catch(e){}
  if (r !== raw){ raw = r; try { met = JSON.parse(r) || {}; } catch(e){ met = {}; } }
  return met;
}
function store(){ raw = JSON.stringify(met); try { localStorage.setItem(KEY, raw); } catch(e){} }

export const codexHooks = { met: null };   // ui/codex-ui.js: the corner note and the button's NEW count
export const codexMet = (id) => !!load()[id];
export const codexFresh = (id) => load()[id] === 1;
export const codexCount = () => Object.keys(load()).filter(id => CODEX_BY_ID[id]).length;
export const codexNewCount = () => Object.entries(load()).filter(([id, v]) => v === 1 && CODEX_BY_ID[id]).length;

export function codexMeet(id){
  if (!id || !CODEX_BY_ID[id] || load()[id]) return;
  met[id] = 1; store();
  if (codexHooks.met) codexHooks.met(id);
}
// read: the NEW mark comes off
export function codexRead(id){
  if (load()[id] === 1){ met[id] = 2; store(); }
}

// a foe of a type stepped in (enemies/spawn.js, a co-op guest's puppet: net/foes.js). A Jedi in an acolyte's body (a
// trial master, a sparring partner) is a duel foe, not a Sith acolyte
export function meetFoe(type, g){
  const L = g && g.userData && g.userData.look;
  if (L && L.side === 'jedi') return;
  codexMeet(type);
}
// a named duel foe (game/mission.js spawnInquisitor, a guest's duel intro: game/cutscene.js)
export function meetNamed(name, foe, mid){
  const e = name && namedEntry(name, foe, mid);
  if (e) codexMeet(e.id);
}
export const meetBoss = (kind) => codexMeet(BOSS_ENTRY[kind]);
export const meetWarbringer = () => codexMeet('warbringer');
// someone on your side: a squadmate called in (allies/squad.js) or a figure in a story scene (game/cast.js)
export function meetAlly(name){
  const e = allyEntry(name);
  if (e) codexMeet(e.id);
}
