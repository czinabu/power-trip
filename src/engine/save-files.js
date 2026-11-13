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
// Switching files happens in place (switchFile): modules that keep a copy of saved progress drop it (onFileSwitch).

export const FILES = 3;
const META = 'sw_files';   // { active, files: { 1: { at, hero, ranks }, 2: null… } } (global, raw)
const GLOBAL = /^sw_(vol|musvol|sfxvol|music|sens|adssens|padsens|padinv|fov|fov_v|shake|sway|sway_v|flash|strafemode|swingmirror|sabergrip|saberassist|dualgrip|cutaim|guardrings|duelcues|readout|aimhint|fullscreen|skywar|finSlow|finCam|killCam|mp_folds|fm_numbers|coop_last|files)$/;
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
/* ASK THE BROWSER TO KEEP THIS SITE'S STORAGE: a phone short on space clears a site's data, saves and all, unless the site
   is marked persistent (Chrome grants it quietly to a site that is played). Not on Firefox, which asks the player with a
   prompt; it doesn't clear storage under pressure the same way */
try {
  const st = navigator.storage;
  if (st && st.persist && st.persisted && !/Firefox\//.test(navigator.userAgent)) st.persisted().then(p => p || st.persist()).catch(() => {});
} catch(e){}
// the desktop app writes storage to disk lazily: after a save, ask it to write now, so a crash or a pulled plug right after
// keeps it (desktop/preload.cjs; nothing on the website, where the browser does this itself)
export function flushToDisk(){ try { window.powerTripDesktop?.flush?.(); } catch(e){} }

/* THE NAMESPACE: the active file's keys read and write under its prefix, and walking localStorage (key(i), length) sees the
   device's settings plus the active file's keys by their plain names, never another file's. The prefix follows the
   active file, so a switch (switchFile below) takes effect on the very next read, with no reload. */
let pre = prefix(meta.active);
if (raw){
  const map = (k) => { k = String(k); return pre && fileScoped(k) ? pre + k : k; };
  /* the active file's key list, built once and kept until something is added or removed (here, or by another tab: the
     raw length moves). Rebuilt on every key(i), a walk of localStorage was O(n²): with a few hundred keys, a save on a
     phone took a good part of a second */
  let viewKeys = null, viewPre = null, viewLen = -1;
  const dirty = () => { viewKeys = null; };
  const view = () => {
    const n = raw.len.call(ls);
    if (viewKeys && viewPre === pre && viewLen === n) return viewKeys;
    viewPre = pre; viewLen = n;
    return viewKeys = rKeys().map(k => pre && k.startsWith(pre) ? k.slice(pre.length) : (PRE.test(k) || (pre && fileScoped(k))) ? null : k).filter(k => k != null);
  };
  P.getItem = function(k){ return this === ls ? raw.get.call(this, map(k)) : raw.get.call(this, k); };
  P.setItem = function(k, v){ if (this !== ls) return raw.set.call(this, k, v); dirty(); return raw.set.call(this, map(k), v); };
  P.removeItem = function(k){ if (this !== ls) return raw.del.call(this, k); dirty(); return raw.del.call(this, map(k)); };
  P.key = function(i){ return this === ls ? (view()[i] ?? null) : raw.key.call(this, i); };
  Object.defineProperty(P, 'length', { configurable: true, get(){ return this === ls ? view().length : raw.len.call(this); } });
}

/* MODULES THAT KEEP A COPY of something a file saved (a parsed store, a count read once on load) register here how to
   drop it, so it is read again from the new file after a switch. Most of the game reads localStorage live and needs none. */
const hooks = [];
export const onFileSwitch = (fn) => { hooks.push(fn); };

/* ---------- the files ---------- */
// read a key as file n has it (for the files panel's cards: another file's rank)
export const fileGet = (n, k) => rGet(prefix(n) + k);
const keysOf = (n) => rKeys().filter(k => n === 1 ? fileScoped(k) : k.startsWith(prefix(n)));
export function fileInfo(n){ return meta.files[n] || null; }
export const fileExists = (n) => !!meta.files[n] || (n === 1 && keysOf(1).length > 0);
// the active file's card: what the title line and the panel show for it (written as the menu shows, so other files can
// show it without loading)
export function noteActive(info){ meta.files[meta.active] = { ...(meta.files[meta.active] || {}), ...info, at: Date.now() }; writeMeta(meta); }
// make file n the one played (an empty one starts fresh), at once: storage reads now come from it, and every module's
// copy of the old file's is dropped (the menu then refreshes itself: ui/files-ui.js)
export function switchFile(n){
  if (!(n >= 1 && n <= FILES) || n === meta.active) return false;
  meta.active = n;
  if (!meta.files[n]) meta.files[n] = { at: Date.now(), fresh: true };
  if (!writeMeta(meta)) return false;
  pre = prefix(n);
  for (const fn of hooks){ try { fn(n); } catch(e){ console.warn('save file switch:', e); } }
  return true;
}
// delete file n's progress for good (never the one being played)
export function deleteFile(n){
  if (n === meta.active || !(n >= 1 && n <= FILES)) return false;
  for (const k of keysOf(n)) rDel(k);
  meta.files[n] = null;
  return writeMeta(meta);
}
