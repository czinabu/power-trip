// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SAVE SLOTS: three local slots, each a snapshot of the player's progress, plus the campaign run when saved mid-campaign.

import { HUBS } from '../data/hub.js';
import { attune } from './saber-bench.js';
import { clearKept } from './wardrobe.js';
import { G, player } from '../state.js';
import { LEVELS } from '../data/levels.js';
import { missionById, isArcadeId } from '../data/arcade.js';
import { switchStance } from '../player/jedi/stance.js';
import { resumeChapter, resumeAtClose, chapterLabel } from './campaign.js';
import { chapterOrder, chapterNo, forHero, CHAPTER_OF_LEVEL } from '../data/campaign.js';
import { DEFAULT_LOADOUT, STARTING_FORMS, cleanLoadout, migrateForm } from '../data/forms.js';
import { clearMeditation } from './meditation.js';
import { MANDO_WEAPONS, RUN_KIT, cleanKit } from '../data/mando.js';

/* PROGRESS lives in localStorage keys spread across the game (campaign/mission/training wins, bests, the customizer's
   look, the sandbox's picks). A slot copies those keys, so loading one puts every mode's locks and ticks back exactly.
   Settings (volume, sensitivity, FOV, graphics, fullscreen) are the player's, not the save's, and stay as they are. */
export const SLOTS = 3;
export const AUTO = 'auto';   // the autosave's own slot (game/autosave.js): shown beside the three, loadable but never saved to by hand
const slotKey = (i) => 'sw_save_' + i;
const PROGRESS = /^sw_(camp_|scar_|trained_|lesson_|best_|sandbox_|arcade_won_|mission_.+_(jedi|mando)$)|^sw_(asktrain|look|codex)$/;
// what NEW GAME clears: everything above but the hero's look and the sandbox's map/kit picks
const FRESH_KEEP = /^sw_(look|sandbox_)/;

function progressKeys(){
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (PROGRESS.test(k)) out.push(k); } } catch(e){}
  return out;
}
const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));

/* THE CAMPAIGN RUN — the build carried from chapter to chapter. A loaded run restarts the saved chapter from its
   checkpoint (the same way a retry after a death does), with every upgrade, boon and unlock it had. */
export function inCampaignRun(){ return G.mode === 'play' && (G.chapter >= 0 || (!G.endless && !G.training && !G.mission && !G.sandbox && !G.hub)); }
function snapshotRun(){
  return {
    idx: G.levelIdx, chapter: G.chapter, tale: G.chapter >= 0 && G.storyHero === 'gate' ? 'gate' : undefined, /* (a run of Act IV: game/gate.js) */ chapterId: G.chapter >= 0 ? (chapterOrder(G.actTwo)[G.chapter] || {}).id : null, actTwo: G.actTwo, story: clone(G.story) || {}, checkpoint: clone(G.checkpoint), stance: G.stance, loadout: [...G.loadout], mandoKit: { ...(G.mandoKit || RUN_KIT) }, weapon: player.weapon, rifleMod: player.rifleMod || 'burst',
    unlocked: clone(G.unlocked), stanceUnlocked: clone(G.stanceUnlocked), formFork: G.formFork || null, mandoChoiceShown: G.mandoChoiceShown,
    xp: G.xp, xpEarned: G.xpEarned, skillPoints: G.skillPoints, skillSpent: G.skillSpent,
    powerLv: clone(G.powerLv), mastery: clone(G.mastery), masteryUse: clone(G.masteryUse),
    forceLevel: G.forceLevel, formRank: clone(G.formRank), formUse: clone(G.formUse), formSince: clone(G.formSince), xpPoints: G.xpPoints, seenTypes: clone(G.seenTypes),
    up: clone(player.up), phoenixReady: !!player.phoenixReady, boon: clone(player.boon), boons: clone(player.boons), skills: clone(player.skills),
    stats: G.stats ? { ...clone({ ...G.stats, summary: null }), elapsed: G.gt - (G.stats.startGt || 0) } : null,
    // saved as its chapter closes (the unlock screen's TRAIN, game/meditation.js): the trial is won, so the run picks up at
    // that close (its upgrade page, then the next chapter) instead of fighting it again; waveTotal already counts it
    closed: G.chapter >= 0 && G.chapterClosed === G.chapter, waveTotal: G.waveTotal,
    ng: G.ngPlus || 0,   // NEW GAME+'s tier (data/ngplus.js): 0 on a first run
  };
}
// the run as it stands, shaped like a loaded save's (G.resumeRun): the menu's CONTINUE CAMPAIGN picks it up
export const captureRun = () => ({ ...snapshotRun(), hero: G.hero });
// put a saved build back (called right before its chapter starts again, game/campaign.js resumeChapter; the saber form goes
// back after it, with switchStance)
export function restoreRun(run){
  G.levelIdx = run.idx; G.checkpoint = clone(run.checkpoint) || { idx: run.idx, waveTotal: -1, boss: false };
  G.waveTotal = G.checkpoint.waveTotal;
  player.weapon = run.weapon || (run.hero === 'trooper' ? 'rifle' : 'single');
  player.rifleMod = run.rifleMod || 'burst';   // the DC-15's fitted module (data/trooper.js RIFLE_MODS)
  G.unlocked = clone(run.unlocked) || {}; G.stanceUnlocked = migrateUnlocked(run.stanceUnlocked);
  if (oldNimanRun(run)) G.stanceUnlocked.niman = true;   // a run saved when every hero started on Niman keeps it
  G.loadout = cleanLoadout(run.loadout || DEFAULT_LOADOUT); G.mandoChoiceShown = !!run.mandoChoiceShown;
  // a chapter run only ever slots forms it has learned. A Jedi story begun before the prologue fix was handed a lone mission's
  // three (Ataru, Niman, Djem So) on its first chapter: those go, so the run is back on just what it has learned
  if (run.chapterId && run.hero === 'jedi'){
    G.loadout = G.loadout.map(id => id && knownIn(G.stanceUnlocked, id) ? id : null);
    if (!G.loadout.some(Boolean)) G.loadout[0] = STARTING_FORMS[0];
  }
  // the Mando's guns: a save from before the loadouts carried both pistols, so it keeps whichever was in hand (the run
  // hands out the primaries again as it goes on: game/flow.js checkUnlocks)
  G.mandoKit = cleanKit(run.mandoKit || { sidearm: run.weapon === 'dual' ? 'dual' : 'single', primary: null });
  { const W = MANDO_WEAPONS[player.weapon]; if (W && W.slot && G.mandoKit[W.slot] !== player.weapon) player.weapon = G.mandoKit.sidearm; }
  G.story = clone(run.story) || {};   // the story's choices so far (game/choices.js)
  G.ngPlus = run.ng || 0; G.ngNext = null;   // NEW GAME+'s tier (data/ngplus.js; a save from before it: a first run)
  G.formFork = run.formFork || null; clearMeditation();   // (forms the saved chapter has passed are taught again as it starts)
  G.xp = run.xp || 0; G.xpEarned = run.xpEarned || 0; G.skillPoints = run.skillPoints || 0; G.skillSpent = run.skillSpent || 0;
  G.powerLv = clone(run.powerLv) || {}; G.mastery = clone(run.mastery) || {}; G.seenTypes = clone(run.seenTypes) || {};
  G.masteryUse = clone(run.masteryUse) || {};
  G.forceLevel = run.forceLevel || 1; G.formRank = clone(run.formRank) || {}; G.formUse = clone(run.formUse) || {}; G.formSince = clone(run.formSince) || {};   // (an older save: level 1, recomputed by checkUnlocks on load)
  G.xpPoints = run.xpPoints;   // (undefined on an older save: game/upgrades.js starts counting from its XP)
  G.boonOffer = null; G.boonPicked = false;
  Object.assign(player.up, clone(run.up));
  attune();   // (a save from another crystal takes that one off and puts the fitted one on: game/saber-bench.js)
  player.boon = clone(run.boon) || {}; player.boons = clone(run.boons) || {}; player.skills = clone(run.skills) || {};
  player.momentumStacks = 0; player.momentumT = 0; player.phoenixReady = !!run.phoenixReady;
  player.focus = 0; player.focusHitT = 0; player._focusTier = 0;
  if (run.stats){ const { elapsed, ...st } = run.stats; G.stats = { ...st, startGt: G.gt - (elapsed || 0), summary: null }; }
}

// a save from before the chapters had ids (and before Shii-Cho was the only starting form) that carried Niman
export const oldNimanRun = (run) => !run.chapterId && ((run.loadout || []).includes('niman') || run.stance === 'niman');
const knownIn = (su, id) => STARTING_FORMS.includes(id) || !!(su && su[id]);
// the form a loaded run goes back to: the one it was in, if it has learned it, else the first it carries
function runStance(run){
  const id = migrateForm(run.stance) || STARTING_FORMS[0];
  return G.loadout.includes(id) || knownIn(G.stanceUnlocked, id) ? id : (G.loadout.find(Boolean) || STARTING_FORMS[0]);
}

// earned forms, keyed by form id (saves from before the forms had ids keyed them fast / strong)
function migrateUnlocked(su){
  const out = {};
  for (const k in su || {}) if (su[k]) out[migrateForm(k)] = true;
  return out;
}

// where a saved run's chapter is now: by its id (chapters a story adds later shift the positions), else by its place.
// A save from before the Jedi's own chapters (the prologue, Return to Jedha) counted only the shared ones.
function runPos(run, hero = run.hero){
  if (!(run.chapter != null && run.chapter >= 0)) return CHAPTER_OF_LEVEL[run.idx] || 0;
  const list = chapterOrder(run.actTwo, run.tale || hero);
  let i = -1;
  if (run.chapterId) i = list.findIndex(c => c.id === run.chapterId);
  else if (hero === 'jedi'){ const old = list.filter(c => !c.story)[run.chapter]; i = old ? list.indexOf(old) : -1; }
  return i >= 0 ? i : run.chapter;
}
// the chapter a saved run plays next: its own, or the one after it when it was saved at its close
function nextPos(run, hero = run.hero){
  const pos = runPos(run, hero);
  return run.closed && chapterOrder(run.actTwo, run.tale || hero)[pos + 1] ? pos + 1 : pos;
}
// a loaded save's run waits on the menu (G.resumeRun) until BEGIN picks it up, as long as the same hero is picked
export function canResume(){ return !!(G.resumeRun && G.resumeRun.hero === G.hero); }   // (a declaration: menus.js can call it while modules are still loading)
export const resumeLabel = () => savedChapter(G.resumeRun, G.hero);
// 'ACT II · CH 6' for the saved run the menu would continue (the campaign tile)
export function resumeProgress(){
  const run = G.resumeRun; if (!run) return '';
  const pos = nextPos(run), list = chapterOrder(run.actTwo, run.tale || run.hero), c = list[pos];
  return c ? (run.ng > 0 ? 'NG+ ' + ['', 'I', 'II', 'III'][run.ng] + ' · ' : '') + 'ACT ' + ['I', 'II', 'III', 'IV'][c.act] + ' · ' + chapterNo(pos, list).replace('CHAPTER', 'CH') : '';
}
// THE RUN WAITING ON THE MENU, per hero: on launch the newest saved campaign run (any slot, the autosave included) is put
// back on the menu, with its hero picked, so CONTINUE CAMPAIGN is the title screen's default; switching hero there swaps in
// that hero's own newest run (a run set aside by the switch comes back when its hero is picked again). Saves from before
// the last NEW GAME are left for LOAD GAME (the slots are kept, but a fresh start shouldn't offer their runs).
const NEWGAME_AT = 'sw_newgame_at';
const parked = {};
// tale: Act IV's runs ('gate') are kept apart from the stories' (the STORY tiles each continue their own)
export function latestRun(hero, tale = null){
  let since = 0; try { since = +localStorage.getItem(NEWGAME_AT) || 0; } catch(e){}
  let best = null;
  for (const i of [AUTO, ...Array.from({ length: SLOTS }, (_, k) => k)]){
    const d = readSlot(i);
    if (!d || !d.run || (d.at || 0) < since || (hero && d.hero !== hero) || (d.run.tale || null) !== tale) continue;
    if (!best || (d.at || 0) > (best.at || 0)) best = d;
  }
  return best ? { ...clone(best.run), hero: best.hero } : null;
}
export function followHero(){
  if (canResume()) return;
  if (G.resumeRun) parked[G.resumeRun.hero] = G.resumeRun;
  G.resumeRun = parked[G.hero] || latestRun(G.hero);
  delete parked[G.hero];
}
export function clearParked(){ for (const k in parked) delete parked[k]; }
export const hasSaves = () => { for (const i of [0, 1, 2, AUTO]) if (readSlot(i)) return true; return false; };
export function resumeRun(){
  const run = G.resumeRun; G.resumeRun = null;
  if (run.chapter != null && run.chapter >= 0){
    const was = run.chapter; run.chapter = runPos(run);
    if (run.checkpoint && run.checkpoint.ch === was) run.checkpoint.ch = run.chapter;   // (its checkpoint is that chapter's)
  }
  restoreRun(run);
  if (run.closed && run.chapter >= 0){ if (run.waveTotal != null) G.waveTotal = run.waveTotal; resumeAtClose(run); }   // the trial is behind it: on from its close
  else resumeChapter(run);   // (a save from before the chapters picks up on the chapter that opens its level)
  switchStance(runStance(run), true);
}
// 'CHAPTER 3 · THE LAST EVACUATION' for a saved run, without starting it
function savedChapter(run, hero){
  const pos = nextPos(run, hero), list = chapterOrder(run.actTwo, run.tale || hero), c = list[pos];
  return c ? chapterNo(pos, list) + ' · ' + forHero(c.title, hero) : 'LEVEL ' + (run.idx + 1) + ' · ' + placeOf(LEVELS[run.idx]);
}

/* ---------- slots ---------- */
export function readSlot(i){
  try { const d = JSON.parse(localStorage.getItem(slotKey(i))); return d && d.v === 1 ? d : null; } catch(e){ return null; }
}
// opts.auto: the autosave. A co-op guest's run is the host's, so only its progress is kept; away from a campaign run (training,
// a mission, survival…) the slot keeps the campaign run it already had, unless opts.finished (the campaign was won) lets it go
export function writeSlot(i, opts = {}){
  const progress = {};
  try { for (const k of progressKeys()) progress[k] = localStorage.getItem(k); } catch(e){}
  let run, where = whereNow(), hero = G.hero;
  if (inCampaignRun()) run = G.coopGuest ? null : snapshotRun();
  else if ((G.mode === 'menu' || G.training) && canResume()) run = G.resumeRun;   // (training from the story: the run left waiting)
  else run = null;
  if (opts.auto && !run && !opts.finished){ const prev = readSlot(i); if (prev && prev.run){ run = prev.run; where = prev.where; hero = prev.hero; } }
  const data = { v: 1, at: Date.now(), hero, diff: G.diff, modeSel: G.modeSel, missionId: G.missionId, progress, where, run };
  if (opts.auto) data.auto = true;
  try { localStorage.setItem(slotKey(i), JSON.stringify(data)); return true; } catch(e){ return false; }
}
export function deleteSlot(i){ try { localStorage.removeItem(slotKey(i)); } catch(e){} }
// swap the live progress for a slot's (the menu then refreshes its locks, picks and look: ui/saves-ui.js)
export function loadSlotProgress(data){
  try {
    for (const k of progressKeys()) localStorage.removeItem(k);
    for (const k in data.progress) if (PROGRESS.test(k)) localStorage.setItem(k, data.progress[k]);
  } catch(e){}
}
// NEW GAME: wipe the wins, bests and training ticks (the look and the saved slots stay)
export function clearProgress(){
  try { for (const k of progressKeys()) if (!FRESH_KEEP.test(k)) localStorage.removeItem(k); } catch(e){}
  try { localStorage.setItem(NEWGAME_AT, String(Date.now())); } catch(e){}
  clearParked();
  clearKept();   // (and the customizer back to its basics: game/wardrobe.js)
}

/* ---------- labels ---------- */
const placeOf = (L) => (L && L.name.split('—').map(t => t.trim())[1]) || '';
// where the player is right now, in a few words for the slot card
function whereNow(){
  if (inCampaignRun()) return 'CAMPAIGN · ' + (G.chapter >= 0 && G.ngPlus > 0 ? 'NG+ ' + ['', 'I', 'II', 'III'][G.ngPlus] + ' · ' : '') + (G.chapter >= 0 ? chapterLabel() : 'LEVEL ' + (G.levelIdx + 1) + ' · ' + placeOf(LEVELS[G.levelIdx]));
  if ((G.mode === 'menu' || G.training) && canResume()) return 'CAMPAIGN · ' + savedChapter(G.resumeRun, G.resumeRun.hero);
  if (G.mode === 'play' && G.mission) return (isArcadeId(G.missionId) ? 'CHALLENGE · ' : 'MISSION · ') + forHero((missionById(G.missionId) || {}).title || '', G.hero);
  if (G.mode === 'play' && G.endless) return 'SURVIVAL';
  if (G.mode === 'play' && G.training) return 'TRAINING';
  if (G.mode === 'play' && G.sandbox) return 'SANDBOX';
  if (G.mode === 'play' && G.hub) return (HUBS[G.hubId] || HUBS.temple).name;
  return 'MAIN MENU';
}
// what the slot holds: wins across the campaign, missions and training
export function slotSummary(data){
  const p = data.progress || {}, on = (k) => p[k] === '1';
  const camp = ['jedi', 'mando'].filter(h => on('sw_camp_' + h)).length;
  const msn = Object.keys(p).filter(k => /^sw_mission_.+_(jedi|mando)$/.test(k) && p[k] === '1').length;
  const parts = [];
  if (camp) parts.push('Campaign won ×' + camp);
  if (msn) parts.push(msn + ' mission win' + (msn === 1 ? '' : 's'));
  if (on('sw_trained_jedi') || on('sw_trained_mando')) parts.push('trained');
  return parts.join(' · ') || (data.run ? 'First campaign under way' : 'Fresh start');
}
