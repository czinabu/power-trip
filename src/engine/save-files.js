// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SAVE FILES: up to three separate players' worth of progress on one device (a sibling's run, a fresh start beside the old one).
// Imported FIRST by main.js, before any module has read localStorage, so it can give every file its own space under the
// same key names: the rest of the game keeps calling localStorage.getItem('sw_profile') and gets the ACTIVE file's.
//
//   · FILE 1 is the plain, unprefixed keys: everything a player had before save files lands in file 1 untouched.
//   · FILES 2 AND 3 keep the same keys behind a prefix, 'sw_f2:sw_profile', which only this module ever sees.
//   · SETTINGS (volume, sensitivity, FOV, graphics, grips, comfort toggles…) belong to the device, not a file: GLOBAL
//     below. Anything else the game saves under sw_ is the file's, so a new progress key follows the file by default.
//
// Switching files reloads the page (every module reads its store once, on load): ui/files-ui.js.

export const FILES = 3;
const META = 'sw_files';   // { active, files: { 1: { at, hero, ranks }, 2: null… } } (global, raw)
const GLOBAL = /^sw_(vol|musvol|sfxvol|music|sens|adssens|padsens|padinv|fov|fov_v|shake|sway|sway_v|flash|strafemode|swingmirror|sabergrip|saberassist|dualgrip|cutaim|guardrings|readout|aimhint|fullscreen|skywar|finSlow|finCam|killCam|mp_folds|fm_numbers|coop_last|files)$/;
const PRE = /^sw_f(\d):/;
const prefix = (n) => n === 1 ? '' : 'sw_f' + n + ':';
// is this key a save file's? (only the game's own sw_ keys; graphics' jpt_ keys and anything else stay as they are)
export const fileScoped = (k) => typeof k === 'string' && k.startsWith('sw_') && !GLOBAL.test(k) && !PRE.test(k);

let ls = null;
try { ls = window.localStorage; } catch(e){}
const P = typeof Storage !== 'undefined' ? Storage.prototype : null;
const raw = P && ls ? {
  get: P.getItem, set: P.setItem, del: P.removeItem, key: P.key,
  len: Object.getOwnPropertyDescriptor(P, 'length').get,
} : null;
const rGet = (k) => { try { return raw.get.call(ls, k); } catch(e){ return null; } };
const rSet = (k, v) => { try { raw.set.call(ls, k, v); return true; } catch(e){ return false; } };
const rDel = (k) => { try { raw.del.call(ls, k); } catch(e){} };
function rKeys(){ const out = []; try { const n = raw.len.call(ls); for (let i = 0; i < n; i++) out.push(raw.key.call(ls, i)); } catch(e){} return out; }

function readMeta(){
  let m = null; try { m = JSON.parse(rGet(META)); } catch(e){}
  if (!m || typeof m !== 'object' || typeof m.files !== 'object') m = { active: 1, files: {} };
  if (!(m.active >= 1 && m.active <= FILES)) m.active = 1;
  if (m.files[1] === undefined) m.files[1] = { at: Date.now() };   // (file 1 is there from the start: it holds whatever was saved before)
  if (!m.files[m.active]) m.files[m.active] = { at: Date.now() };
  return m;
}
const writeMeta = (m) => rSet(META, JSON.stringify(m));
let meta = raw ? readMeta() : { active: 1, files: { 1: {} } };
export const activeFile = () => meta.active;

/* THE NAMESPACE: the active file's keys read and write under its prefix, and walking localStorage (key(i), length) sees the
   device's settings plus the active file's keys by their plain names, never another file's. */
if (raw && meta.active !== 1){
  const pre = prefix(meta.active);
  const map = (k) => { k = String(k); return fileScoped(k) ? pre + k : k; };
  const view = () => rKeys().map(k => k.startsWith(pre) ? k.slice(pre.length) : (fileScoped(k) || PRE.test(k)) ? null : k).filter(k => k != null);
  P.getItem = function(k){ return this === ls ? raw.get.call(this, map(k)) : raw.get.call(this, k); };
  P.setItem = function(k, v){ return this === ls ? raw.set.call(this, map(k), v) : raw.set.call(this, k, v); };
  P.removeItem = function(k){ return this === ls ? raw.del.call(this, map(k)) : raw.del.call(this, k); };
  P.key = function(i){ return this === ls ? (view()[i] ?? null) : raw.key.call(this, i); };
  Object.defineProperty(P, 'length', { configurable: true, get(){ return this === ls ? view().length : raw.len.call(this); } });
} else if (raw){
  // file 1: its keys are the plain ones, but a walk still mustn't see files 2 and 3's
  const view = () => rKeys().filter(k => !PRE.test(k));
  P.key = function(i){ return this === ls ? (view()[i] ?? null) : raw.key.call(this, i); };
  Object.defineProperty(P, 'length', { configurable: true, get(){ return this === ls ? view().length : raw.len.call(this); } });
}

/* ---------- the files ---------- */
// read a key as file n has it (for the files panel's cards: another file's rank)
export const fileGet = (n, k) => rGet(prefix(n) + k);
const keysOf = (n) => rKeys().filter(k => n === 1 ? fileScoped(k) : k.startsWith(prefix(n)));
export function fileInfo(n){ return meta.files[n] || null; }
export const fileExists = (n) => !!meta.files[n] || (n === 1 && keysOf(1).length > 0);
// the active file's card: what the title line and the panel show for it (written as the menu shows, so other files can
// show it without loading)
export function noteActive(info){ meta.files[meta.active] = { ...(meta.files[meta.active] || {}), ...info, at: Date.now() }; writeMeta(meta); }
// make file n the one played (an empty one starts fresh); the caller reloads
export function useFile(n){
  if (!(n >= 1 && n <= FILES)) return false;
  meta.active = n;
  if (!meta.files[n]) meta.files[n] = { at: Date.now(), fresh: true };
  return writeMeta(meta);
}
// delete file n's progress for good (never the one being played)
export function deleteFile(n){
  if (n === meta.active || !(n >= 1 && n <= FILES)) return false;
  for (const k of keysOf(n)) rDel(k);
  meta.files[n] = null;
  return writeMeta(meta);
}
