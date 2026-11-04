// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MEDITATION: the pause after the hero learns a form (data/forms.js FORM_PATH, granted by game/flow.js checkUnlocks).
// The screen names what was learned and lets the hero choose which three forms sit on 1 / 2 / 3. The three can also
// change at the start of each chapter, and in survival between waves (the FORMS WINDOW below: the pause screen's
// Forms page lets you re-pick until the next fight is on), so a run can prepare for the duel ahead. When the run reaches Form VII, the screen first asks which of
// Juyo or Vaapad the hero keeps; the other is closed for the rest of the run (G.formFork).
// It waits for whatever is in front of it (a chapter card, a cutscene, the upgrade screen, the pause menu) and freezes the fight
// while it is up, the same way those do.

import { autosave } from './autosave.js';
import { G, shared, isGunner } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { FORMS, FORM_CODEX, LOADOUT_SLOTS, STARTING_FORMS, cleanLoadout, forkClosed, formTitle } from '../data/forms.js';
import { STANCES, stanceUnlocked } from '../data/stances.js';
import { setLoadout, setStanceHud } from '../player/jedi/stance.js';
import { previewStance } from '../ui/showcase.js';
import { coopLive } from '../net/foes.js';
import { chapterOrder, storyVoice, storyHero } from '../data/campaign.js';
import { JEDI_FORK_LINE } from '../data/campaign-jedi.js';
import { storyWords } from './choices.js';
import { upToast } from './upgrades.js';
import { inCombat } from '../player/mobility.js';
import { MOBILITY } from '../data/mobility.js';

const el = document.getElementById('meditate');
const pending = [];   // form ids learned and not yet shown
let draft = null, slot = 0, phase = null, learnedNow = [];   // the loadout being chosen, the slot the next pick fills, 'fork' | 'unlock' | 'slots', what this sitting learned
let cards = [];   // the forms whose unlock screen is still to show, the one on screen first
let trainHook = () => {};
export function setTrainHook(fn){ trainHook = fn; }   // ui/menus.js: leave the run for the training lesson on a form

// a run that stops to meditate: the campaign and survival (not the training grounds, a lone mission or the sandbox)
export const formsTaught = () => !isGunner() && !G.training && !G.sandbox && !(G.mission && G.chapter < 0);
export const meditationUp = () => el.classList.contains('open');

// the forms the hero knows, in lore order
const known = () => Object.keys(FORMS).filter(id => FORMS[id].ready && stanceUnlocked(id) && !forkClosed(id, G.formFork));
// a lone mission: the three most advanced forms its kit teaches
export const autoLoadout = () => cleanLoadout(known().reverse());

export function queueMeditation(ids){
  if (!formsTaught()) return;
  for (const id of ids) if (!pending.includes(id)) pending.push(id);
}
// game/flow.js, every frame of play: open once nothing else holds the screen
export function tickMeditation(){
  if (!pending.length || meditationUp() || G.mode !== 'play' || G.paused || G.skillSelect || G.cardUp || G.cutscene || performance.now() < (shared.unlockHold || 0)) return;   // (a chapter's close: after its CHAPTER COMPLETE beat, game/flow.js checkUnlocks)
  open();
}
// a new run, a load or the main menu: forget anything still waiting
export function clearMeditation(){ pending.length = 0; windowAt = null; if (meditationUp()) close(true); }

/* ---------- the FORMS WINDOW: re-pick the three before the next fight ---------- */
// It opens as a chapter starts (game/flow.js startLevel) and as a survival wave is cleared (game/survival.js), and
// closes once the next fight is on (a foe in reach or a blow traded, past the last fight's linger). While it is open,
// the pause screen's Forms page (ui/forms-ui.js) edits the three.
let windowAt = null, windowNoted = false;
export function openFormsWindow(){ if (!formsTaught()) return; windowAt = G.gt; windowNoted = false; }
export const formsWindowOpen = () => windowAt != null && formsTaught() && known().length > 1;
// game/flow.js, every frame: close it when the fight starts, and say once that it is open (when there's a choice to make)
export function tickFormsWindow(){
  if (windowAt == null || G.paused || G.mode !== 'play') return;
  if (G.gt - windowAt > MOBILITY.combat.linger && inCombat()){ windowAt = null; return; }
  if (!windowNoted && !G.cardUp && !G.cutscene && !G.skillSelect && !meditationUp()){
    windowNoted = true;
    if (formsWindowOpen() && known().length > LOADOUT_SLOTS) upToast('CHOOSE YOUR FORMS', 'Pause and open FORMS to change your three before the fight', 'mast');
  }
}
// the Forms page's pick, as the page closes
export function repickForms(list){
  if (!formsWindowOpen()) return;
  const next = cleanLoadout(list);
  if (!next.some(Boolean)) next[0] = STARTING_FORMS[0];
  if (next.every((id, i) => id === G.loadout[i])) return;
  setLoadout(next); setStanceHud();
  autosave('form', { notAtClose: true });
}

const esc = (t) => String(t).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
const formLine = (id) => esc(STANCES[id].syn);

function open(){
  const learned = pending.splice(0);
  const fork = learned.filter(id => FORMS[id].fork);
  if (fork.length && !G.formFork){ phase = 'fork'; learnedNow = learned.filter(id => !FORMS[id].fork); renderFork(fork); }
  else startCards(learned.filter(id => !FORMS[id].fork));
  el.classList.add('open');
  G.skillSelect = true; G.cardUp = true;   // freeze the fight and keep the pause screen away while the cursor is free
  document.exitPointerLock();
  MUSIC.unlockSting(); S.reward(1);
}
function close(quiet){
  el.classList.remove('open', 'unlock'); previewStance(null);
  G.cardUp = false;
  if (!document.getElementById('skilltree').style.display.includes('flex')) G.skillSelect = false;
  if (quiet) return;
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}

/* ---------- Form VII: keep one ---------- */
// who offers it: the campaign story's voice for the chapter (General Kast, by the chase, in the Jedi's), and the Jedi's
// story has a word on it about what was just done to Ilsa (data/campaign-jedi.js JEDI_FORK_LINE)
function forkVoice(){ const c = G.chapter >= 0 && chapterOrder(G.actTwo)[G.chapter]; return c ? storyVoice(undefined, c) : 'MASTER VAEL'; }
const forkLine = () => G.chapter >= 0 && storyHero() === 'jedi' ? storyWords(JEDI_FORK_LINE) : null;
function renderFork(ids){
  el.innerHTML = '<div class="cc-inner hero-jedi"><div class="cc-act">FORM VII</div>' +
    '<h1 class="cc-title">THE SEVENTH FORM</h1>' +
    '<div class="cc-voice"><div class="cc-who">' + forkVoice() + '</div><p>Few Jedi ever reach the seventh form, and none walk both of its roads. Juyo lets the fury in. Vaapad takes it from the one who attacks you. Choose, and the other road closes for good.</p>' +
    (forkLine() ? '<p>' + forkLine() + '</p>' : '') + '</div>' +
    '<div class="cc-pick">' + ids.map(id => '<div class="cc-opt" data-fork="' + id + '" style="--c:' + hex(STANCES[id].blade) + '"><b>' + FORMS[id].name + '</b><span>' + formLine(id) + '</span></div>').join('') + '</div>' +
    '<div class="cc-hint">The choice holds for the rest of this run</div></div>';
}

/* ---------- the unlock screen: each form learned, what it is good and bad at, the hero performing it ---------- */
// training for a form leaves the run: only a campaign can pick up where it left off (the run is kept for CONTINUE CAMPAIGN)
const canTrain = () => G.chapter >= 0 && !G.endless && !coopLive();
function startCards(ids){
  learnedNow = ids; cards = ids.slice();
  if (!cards.length){ phase = 'slots'; renderSlots([]); return; }
  renderUnlock();
}
function renderUnlock(){
  const id = cards[0], F = FORMS[id], C = FORM_CODEX[id] || {};
  phase = 'unlock';
  el.classList.add('unlock');
  const train = canTrain();
  el.innerHTML = '<div class="cc-inner hero-jedi" style="--c:' + hex(STANCES[id].blade) + '"><div class="cc-act">STANCE UNLOCKED' +
      (learnedNow.length > 1 ? '<span class="su-count">' + (learnedNow.length - cards.length + 1) + ' / ' + learnedNow.length + '</span>' : '') + '</div>' +
    '<h1 class="cc-title">' + esc(F.name) + '</h1>' +
    '<div class="cc-world">' + formTitle(id) + ' · ' + esc(F.tag) + '</div>' +
    '<p class="su-lore">' + esc(C.lore || '') + (C.who ? ' <i>' + esc(C.who) + '</i>' : '') + '</p>' +
    (C.best ? '<div class="su-best">BEST AGAINST · ' + esc(C.best) + '</div>' : '') +
    '<div class="su-cols"><div class="good"><h4>GOOD AT</h4><ul>' + (C.pros || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>' +
    '<div class="bad"><h4>BAD AT</h4><ul>' + (C.cons || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div></div>' +
    '<div class="cc-btns">' + (train ? '<div class="btn" data-train="' + id + '">TRAIN IN ' + esc(F.name.toUpperCase()) + '</div>' : '') +
      '<div class="btn primary go" data-next="1">CONTINUE</div></div>' +
    '<div class="su-note">' + (train ? 'Training saves your run: CONTINUE CAMPAIGN picks it up where you left off.' : 'Its lesson is waiting in Training, from the main menu.') + '</div></div>';
  previewStance(id);
}
function nextCard(){
  cards.shift();
  if (cards.length) return void renderUnlock();
  el.classList.remove('unlock'); previewStance(null);
  phase = 'slots'; renderSlots(learnedNow);
}

/* ---------- the loadout ---------- */
function renderSlots(learned = learnedNow){
  learnedNow = learned;
  if (!draft){
    draft = G.loadout.slice();
    for (const id of learned) if (draft.includes(null) && !draft.includes(id)) draft = cleanLoadout(draft.map((d, i) => i === draft.indexOf(null) ? id : d));   // a new form takes an empty slot to start with
    slot = Math.max(0, draft.indexOf(null));
  }
  const k = known();
  const head = learned.length
    ? '<div class="cc-act">FORM LEARNED</div><h1 class="cc-title">' + learned.map(id => esc(FORMS[id].name)).join(' · ') + '</h1>' +
      '<div class="cc-world">' + learned.map(id => formTitle(id) + ' · ' + formLine(id)).join('<br>') + '</div>'
    : '<div class="cc-act">MEDITATION</div><h1 class="cc-title">YOUR FORMS</h1>';
  el.innerHTML = '<div class="cc-inner hero-jedi">' + head +
    '<div class="cc-voice"><div class="cc-who">MEDITATION</div><p>Choose the three forms you carry into the fight. You can change them again ' + (G.endless ? 'between waves' : 'at the start of each chapter') + ', from the pause screen\'s Forms page.</p></div>' +
    '<div class="md-slots">' + Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
      const id = draft[i], x = id && draft.filter(Boolean).length > 1;   // ✕ empties a slot (the last form stays)
      return '<div class="md-slotw"><div class="md-slot' + (i === slot ? ' sel' : '') + (id ? '' : ' empty') + (x ? ' has-x' : '') + '" data-slot="' + i + '"' + (id ? ' style="--c:' + hex(STANCES[id].blade) + '"' : '') + '>' +
        '<span class="n">' + (i + 1) + '</span>' + (id ? esc(FORMS[id].name) : 'EMPTY') + '</div>' +
        (x ? '<div class="fm-clear" data-clear="' + i + '" title="Empty this slot" aria-label="Empty slot ' + (i + 1) + '">✕</div>' : '') + '</div>';
    }).join('') + '</div>' +
    '<div class="md-forms">' + k.map(id => '<div class="md-form' + (draft.includes(id) ? ' in' : '') + (learned.includes(id) ? ' new' : '') + '" data-form="' + id + '" style="--c:' + hex(STANCES[id].blade) + '">' +
      '<b>' + esc(FORMS[id].name) + '</b><i>' + formTitle(id) + ' · ' + esc(FORMS[id].tag) + '</i></div>').join('') + '</div>' +
    '<div class="cc-btns"><div class="btn primary go" data-go="1">RISE</div></div>' +
    '<div class="cc-hint">Pick a slot, then a form for it · ✕ leaves a slot empty · Enter to rise</div></div>';
}
// put a form in the selected slot (one already slotted swaps places with it, and Form V / VII keep to one variant)
function pick(id){
  const at = draft.indexOf(id);
  if (at === slot){ clearSlot(at); return; }   // the form already in the picked slot: picking it again empties the slot
  if (at >= 0) draft[at] = draft[slot];   // a form already slotted swaps places with what was there
  draft[slot] = id;
  draft = cleanLoadout(draft.map((d, i) => i === slot ? d : (d && FORMS[d].variant && FORMS[d].variant === FORMS[id].variant && d !== id ? null : d)));
  slot = draft.indexOf(null) >= 0 ? draft.indexOf(null) : (slot + 1) % LOADOUT_SLOTS;
  renderSlots();
}
// empty a slot (the fight skips it); the last form left can't go
function clearSlot(i){
  if (!draft[i] || draft.filter(Boolean).length <= 1) return;
  draft[i] = null; slot = i;
  renderSlots();
}
function rise(){
  if (!draft) return;
  if (!draft.some(Boolean)) draft[0] = STARTING_FORMS[0];
  setLoadout(draft); draft = null; phase = null; learnedNow = [];
  autosave('form', { notAtClose: true });
  setStanceHud();
  close();
  if (pending.length) tickMeditation();
}

el.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (!meditationUp()) return;
  const t = e.target, f = t.closest('[data-fork]'), s = t.closest('[data-slot]'), m = t.closest('[data-form]');
  if (f){
    G.formFork = f.dataset.fork;
    (G.stanceUnlocked = G.stanceUnlocked || {})[G.formFork] = true;
    startCards([...learnedNow, G.formFork]); S.reward(1); autosave('form fork', { notAtClose: true }); return;
  }
  if (t.closest('[data-next]')){ if (phase === 'unlock') nextCard(); return; }
  const tr = t.closest('[data-train]');
  if (tr){ if (phase === 'unlock') train(tr.dataset.train); return; }
  const c = t.closest('[data-clear]');
  if (c){ if (phase === 'slots') clearSlot(+c.dataset.clear); return; }
  if (s){ slot = +s.dataset.slot; renderSlots(); return; }
  if (m){ pick(m.dataset.form); return; }
  if (t.closest('[data-go]')) rise();
});
// TRAIN: slot the form like a RISE would, keep the run for CONTINUE CAMPAIGN, and go to that form's lesson (ui/menus.js)
function train(id){
  if (!draft) renderSlots(learnedNow);
  const learned = learnedNow.slice();
  draft = draft || G.loadout.slice();
  for (const f of learned) if (!draft.includes(f) && draft.includes(null)) draft = cleanLoadout(draft.map((d, i) => i === draft.indexOf(null) ? f : d));
  setLoadout(draft); draft = null; phase = null; learnedNow = []; cards = [];
  setStanceHud();
  close(true);
  trainHook(id);
}
document.addEventListener('keydown', (e) => {
  if (!meditationUp() || e.key !== 'Enter') return;
  if (phase === 'unlock'){ e.preventDefault(); nextCard(); }
  else if (phase === 'slots'){ e.preventDefault(); rise(); }
});
