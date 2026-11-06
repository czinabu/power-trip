// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// NEW GAME / SAVE GAME / LOAD GAME: the buttons on the main menu (campaign tile) and pause screen, and the save-slot panel (game/saves.js).

import { G } from '../state.js';
import { heroName } from '../game/wardrobe.js';   // (the trooper's rank, as that slot has it)
import { SLOTS, AUTO, readSlot, writeSlot, deleteSlot, loadSlotProgress, clearProgress, slotSummary, latestRun, clearParked } from '../game/saves.js';
import { setHero } from '../player/hero.js';
import { audioInit, S } from '../audio/sfx.js';
import { sandboxUnlocked } from '../game/sandbox.js';
import { reloadLook } from './customizer.js';
import { overlay, goHome, refreshMenu, setModeSel, setMission, setDiff, beginFromMenu, survivalUnlocked, showMenuStep } from './menus.js';
import { openMissionPage } from './missions-ui.js';
import { ngNextTier } from '../game/profile.js';
import { tierName, NG_TIERS, NG_WORDS } from '../data/ngplus.js';

const panel = document.getElementById('saves');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let mode = 'load';    // 'save' (from pause) or 'load'
let armed = null;     // the one button waiting on a second click to confirm: 'save1', 'load2', 'del0'…
let flash = null;     // the slot just saved to, ticked for a moment

const when = (t) => { const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
const midRun = () => G.mode === 'play' || G.mode === 'dead';   // loading from here leaves the run

function render(){
  document.getElementById('savestitle').textContent = mode === 'save' ? 'SAVE GAME' : 'LOAD GAME';
  document.getElementById('savessub').textContent = mode === 'save' ? 'Pick a slot to save to' : 'Pick a save to load';
  let html = '';
  for (const i of [AUTO, ...Array.from({ length: SLOTS }, (_, k) => k)]){
    const d = readSlot(i);
    if (i === AUTO && !d) continue;
    if (i === AUTO && mode === 'save') continue;   // the autosave is written by the game, not by hand
    const title = (i === AUTO ? 'AUTOSAVE · ' : '') + (d ? heroName(d.hero, d.progress || {}) + ' · ' + esc(d.where || 'MAIN MENU') : 'EMPTY SLOT');
    const desc = d ? esc(slotSummary(d)) + ' · ' + when(d.at) : mode === 'save' ? 'Save here' : 'Nothing saved yet';
    let btn = '';
    if (mode === 'save'){
      const a = armed === 'save' + i;
      btn = flash === i ? '<div class="btn" data-act="none">SAVED ✓</div>'
          : `<div class="btn${a ? ' warn' : ''}" data-act="save" data-i="${i}">${a ? 'OVERWRITE?' : 'SAVE'}</div>`;
    } else if (d){
      const a = armed === 'load' + i;
      btn = `<div class="btn${a ? ' warn' : ''}" data-act="load" data-i="${i}">${a ? 'LEAVE RUN & LOAD' : 'LOAD'}</div>`;
    }
    const del = d ? `<div class="sv-del${armed === 'del' + i ? ' warn' : ''}" data-act="del" data-i="${i}" title="Delete this save">${armed === 'del' + i ? 'DELETE?' : '✕'}</div>` : '';
    html += `<div class="sv-slot${d ? '' : ' empty'}"><div class="sv-n">${i === AUTO ? 'A' : i + 1}</div>
      <div class="sv-info"><div class="sv-t">${title}</div><div class="sv-d">${desc}</div></div>${btn}${del}</div>`;
  }
  html += '<p class="sv-note">' + (mode === 'save'
    ? 'A save keeps your wins, unlocks, bests and look. Saved mid-campaign, it also keeps your upgrades, and loading it starts that level again.'
    : 'Loading puts you on the main menu with that save\'s progress. A campaign saved mid-run picks up at the start of its level.') + '</p>';
  document.getElementById('svlist').innerHTML = html;
}

export function openSaves(m){
  mode = m; armed = null; flash = null;
  panel.classList.add('open');
  render();
}
function closeSaves(){ panel.classList.remove('open'); armed = null; }

function save(i){
  if (readSlot(i) && armed !== 'save' + i){ armed = 'save' + i; return render(); }
  armed = null;
  if (!writeSlot(i)){ S.uiDeny(); return render(); }
  flash = i; render();
  S.reward(1);
  setTimeout(() => { if (flash === i){ flash = null; if (panel.classList.contains('open')) render(); } }, 1400);
}

function load(i){
  const d = readSlot(i); if (!d) return;
  if (midRun() && armed !== 'load' + i){ armed = 'load' + i; return render(); }   // leaving a live run asks first
  closeSaves();
  if (G.mode !== 'menu') goHome();
  loadSlotProgress(d);
  setHero(d.hero === 'mando' || d.hero === 'trooper' ? d.hero : 'jedi');   // (a trooper save without ?trooper loads as the Mando: player/hero.js)
  if (d.diff) setDiff(d.diff);
  if (d.missionId) setMission(d.missionId);
  G.resumeRun = d.run ? { ...d.run, hero: G.hero } : null;
  clearParked(); try { localStorage.removeItem('sw_newgame_at'); } catch(e){}   // (the loaded progress is the one the menu follows now: game/saves.js latestRun)
  reloadLook();
  refreshMenu();   // the locks follow the loaded wins before the mode is picked again
  let m = d.run ? 'campaign' : (d.modeSel || 'campaign');
  if ((m === 'endless' && !survivalUnlocked()) || (m === 'sandbox' && !sandboxUnlocked())) m = 'campaign';
  setModeSel(m);
  if (m === 'mission') openMissionPage(); else showMenuStep('hero');   // straight to where the save's BEGIN / CONTINUE is
  if (!G.resumeRun) document.getElementById('ovsub').textContent = (i === AUTO ? 'AUTOSAVE' : 'SAVE ' + (i + 1)) + ' LOADED';
}

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // using the save panel must never launch or resume the game
  if (e.target === panel || e.target.id === 'savesclose') return closeSaves();
  const b = e.target.closest('[data-act]');
  if (!b){ if (armed){ armed = null; render(); } return; }
  const i = b.dataset.i === AUTO ? AUTO : +b.dataset.i;
  if (b.dataset.act === 'save') save(i);
  else if (b.dataset.act === 'load') load(i);
  else if (b.dataset.act === 'del'){
    if (armed !== 'del' + i){ armed = 'del' + i; return render(); }
    armed = null; deleteSlot(i); render();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) closeSaves(); });

for (const id of ['saveBtn', 'campSaveBtn']) document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openSaves('save'); });
for (const id of ['loadBtn', 'campLoadBtn']) document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openSaves('load'); });

// NEW GAME — a clean start: wins, unlocks, bests and training ticks reset (the look and the save slots stay), then the
// campaign begins as it does for a first-time player (offering the training grounds first)
for (const id of ['newBtn', 'campNewBtn']) document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); audioInit(); overlay.classList.add('newconfirming'); });
document.getElementById('newNo').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('newconfirming'); });
document.getElementById('newYes').addEventListener('click', (e) => {
  e.stopPropagation();
  overlay.classList.remove('newconfirming');
  clearProgress();
  reloadLook();   // (back to the basics the wardrobe opens with: game/wardrobe.js)
  G.resumeRun = null;
  setModeSel('campaign');
  refreshMenu();
  beginFromMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('newconfirming')) overlay.classList.remove('newconfirming'); });

// NEW GAME+ (data/ngplus.js): this hero's campaign again from chapter 1, at the next tier it hasn't beaten, with everything
// the profile keeps. Nothing is wiped (the wins, the looks and the save slots stay), so it asks once on the button itself:
// the first click arms it and says what it does, the second begins
const ngBtn = document.getElementById('campNgBtn');
let ngArmed = false;
export function refreshNgButton(){
  const t = G.modeSel === 'campaign' && !G.coopJoin ? ngNextTier(G.hero) : 0;
  ngBtn.style.display = t ? '' : 'none';
  if (!t){ ngArmed = false; return; }
  ngBtn.classList.toggle('armed', ngArmed);
  ngBtn.innerHTML = ngArmed ? 'BEGIN ' + tierName(t) + '<span class="ng-sub">' + NG_WORDS.confirm(t) + '</span>'
    : tierName(t) + '<span class="ng-sub">Replay the story keeping your rank, parts and looks · tougher foes, ' + NG_TIERS[t].muts + ' mutator' + (NG_TIERS[t].muts === 1 ? '' : 's') + ' a chapter</span>';
}
ngBtn.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  const t = ngNextTier(G.hero); if (!t) return;
  if (!ngArmed){ ngArmed = true; refreshNgButton(); return; }
  ngArmed = false;
  G.resumeRun = null; G.ngNext = t;   // (game/campaign.js startCampaign takes it)
  setModeSel('campaign');
  refreshMenu();
  beginFromMenu();
});
document.addEventListener('click', (e) => { if (ngArmed && e.target !== ngBtn && !ngBtn.contains(e.target)){ ngArmed = false; refreshNgButton(); } }, true);
document.addEventListener('campaignmark', () => { ngArmed = false; refreshNgButton(); });   // (ui/menus.js: the mode or the hero changed)
refreshNgButton();

// ON LAUNCH: the newest saved campaign run waits with its hero picked, but the game still opens on the home screen's mode
// list; clicking CAMPAIGN then lands on CONTINUE CAMPAIGN
export function continueOnLaunch(){
  const run = latestRun(); if (!run) return;
  setHero(run.hero === 'mando' || run.hero === 'trooper' ? run.hero : 'jedi');
  G.resumeRun = { ...run, hero: G.hero };
  setModeSel('campaign');
  refreshMenu();
}
