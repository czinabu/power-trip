// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE FORMS PAGE: every lightsaber form the hero has learned, what it is in the lore and what it is good and bad at
// (data/forms.js FORM_CODEX). Forms not learned yet show as locked. It opens two ways:
//   · BEFORE THE FIGHT — BEGIN on the main menu (Jedi) opens it first. A mission or the sandbox lets the player choose the
//     three forms to carry; a campaign or survival run shows the three it has (they change only when the run learns a
//     form: game/meditation.js), and the training grounds the three they start on. FIGHT starts the mode.
// Neither names a form the hero hasn't learned: the forms still to come stand as one sealed card.
//   · FORMS on the pause screen — the same page, read only, for the run in progress.

import { G } from '../state.js';
import { FORMS, FORM_CODEX, LOADOUT_SLOTS, DEFAULT_LOADOUT, RUN_LOADOUT, STARTING_FORMS, cleanLoadout, forkClosed, formTitle } from '../data/forms.js';
import { STANCES, stanceUnlocked } from '../data/stances.js';
import { FAMILIES, FORM_FAMILY, MATCHUP } from '../data/foe-forms.js';
import { formOffered, refreshSandboxScope } from '../game/sandbox-unlocks.js';
import { canResume, oldNimanRun } from '../game/saves.js';
import { trainingLoadout } from '../game/tutorial.js';
import { audioInit } from '../audio/sfx.js';
import { openArmoryCodex } from './armory-ui.js';

const panel = document.getElementById('forms');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
const ORDER = Object.keys(FORMS).filter(id => FORMS[id].ready);

const LOCK = '<svg class="fm-lock-ic" viewBox="0 0 16 16" width="14" height="14" role="img" aria-label="Locked: unlocks with your next form"><title>Unlocks with your next form</title><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
// the lore behind a small "i" (hover, focus or click), like the notes on Controls
const loreInfo = (C) => (C.lore || C.who) ? '<span class="fm-i" tabindex="0" role="button" aria-label="Lore">i</span><div class="fm-lorepop">' + esc(C.lore || '') + (C.who ? ' <i>' + esc(C.who) + '</i>' : '') + '</div>' : '';
// locked forms: Form V and VII have two variants each, so a chip reads V-a / V-b without naming either. The saber staff
// has no numeral and gives nothing away until it's in hand: ???
const lockedNo = (id) => { const same = ORDER.filter(x => FORMS[x].no === FORMS[id].no); return FORMS[id].no + (same.length > 1 ? '-' + 'ab'[same.indexOf(id)] : ''); };
const lockedName = (id) => FORMS[id].no ? 'FORM ' + lockedNo(id) : '? ? ?';
const lockedChip = (id) => {
  const closed = FORMS[id].fork && ctx.closed && ctx.closed !== id;
  return '<div class="fm-chip" title="' + (closed ? 'Closed for this run: you chose ' + esc(FORMS[ctx.closed].name) : 'Not learned yet') + '"><span>' + lockedName(id) + '</span>' + (closed ? esc(FORMS[id].name) : LOCK) + '</div>';
};
const lockedRow = () => { const l = ORDER.filter(id => !ctx.known.includes(id)); return l.length ? '<div class="fm-sec">NOT LEARNED YET</div><div class="fm-chips">' + l.map(lockedChip).join('') + '</div>' : ''; };

/* THE COUNTER — each form's family in the POWER / GUARD / SPEED triangle (data/foe-forms.js): what it beats and what
   beats it, against a duellist's form. Forms not learned yet aren't named ("a form still to learn"). The numbers under
   it come straight from MATCHUP, so they stay true when it's tuned. */
const famOf = (fam) => ORDER.filter(id => FORM_FAMILY[id] === fam);
const pct = (m) => Math.round(Math.abs(m - 1) * 100) + '%';
function famList(fam){
  const all = famOf(fam), known = all.filter(id => ctx.known.includes(id)).map(id => FORMS[id].name.charAt(0) + FORMS[id].name.slice(1).toLowerCase().replace(/(\s|-)(\w)/g, (m, a, b) => a + b.toUpperCase()));
  const hidden = all.length - known.length;
  return known.concat(hidden ? [hidden === 1 ? 'a form still to learn' : hidden + ' forms still to learn'] : []).join(', ');
}
function famTag(id){
  const f = FAMILIES[FORM_FAMILY[id]];
  return '<span class="fm-fam" style="--fc:' + (f ? f.color : 'var(--ink-dim)') + '">' + (f ? f.name : 'NEUTRAL') + '</span>';
}
function counterNote(){
  const W = MATCHUP.win, L = MATCHUP.lose;
  return '<div class="fm-ctr-note"><div>▲ You counter it: +' + pct(W.dmg) + ' damage, its guard turns ' + pct(W.block) + ' fewer cuts, its blows land ' + pct(W.hurt) + ' softer.</div>' +
    '<div>▼ It counters you: −' + pct(L.dmg) + ' damage, its blows land ' + pct(L.hurt) + ' harder (only while one of your three could counter it).</div></div>';
}
function counterBlock(id){
  const fam = FORM_FAMILY[id], F = FAMILIES[fam];
  const rows = F
    ? '<li class="up"><i>▲</i>Beats <em style="--fc:' + FAMILIES[F.beats].color + '">' + FAMILIES[F.beats].name + '</em> duellists: ' + esc(famList(F.beats)) + '</li>' +
      (() => { const by = Object.keys(FAMILIES).find(k => FAMILIES[k].beats === fam); return '<li class="dn"><i>▼</i>Beaten by <em style="--fc:' + FAMILIES[by].color + '">' + FAMILIES[by].name + '</em> duellists: ' + esc(famList(by)) + '</li>'; })()
    : '<li class="eq"><i>•</i>Outside the triangle: no duellist\'s form counters it, and it counters none</li>';
  return '<div class="fm-sub">COUNTERS · ' + famTag(id) + '</div><ul class="fm-ctr">' + rows + '</ul>' +
    (F ? counterNote() : '');
}

const EDIT_HINT = ' Pick a slot, then a form for it. ✕ empties a slot.';
let ctx = null;   // { prefight, edit, known: Set, loadout, slot, focus, note, closed: Set, onGo }

/* ---------- what the page shows ---------- */
// the forms the story has taught the hero, across every run (the same set the sandbox offers)
const storyForms = () => { refreshSandboxScope(); return ORDER.filter(formOffered); };
// a lone mission's default: the three most advanced forms the story has taught
const bestOf = (ids) => cleanLoadout(ids.slice().reverse());
// a slot saved as '' was emptied on purpose (the ✕ on a slot): it stays empty. A null (a saved pick from before a
// form was learned) takes the most advanced learned form not yet in, so FIGHT is ready with three when three are known
function savedPick(key, fallback, known){
  let list = fallback;
  try { const v = JSON.parse(localStorage.getItem(key)); if (Array.isArray(v)) list = v; } catch(e){}
  const cleared = Array.from({ length: LOADOUT_SLOTS }, (_, i) => list[i] === '');
  list = cleanLoadout(list).map(id => id && known.includes(id) ? id : null);
  if (!list.some(Boolean)){ list[0] = STARTING_FORMS[0]; cleared[0] = false; }
  const open = () => list.findIndex((id, i) => !id && !cleared[i]);
  for (const id of known.slice().reverse()){
    const at = open(); if (at < 0) break;
    if (list.includes(id)) continue;
    const next = list.slice(); next[at] = id;
    const clean = cleanLoadout(next); if (clean.includes(id)) list = clean;   // (one Form V, one Form VII)
  }
  return { loadout: list, cleared };
}

function prefightContext(){
  const story = storyForms(), m = G.modeSel;
  if (m === 'mission') return { edit: true, known: story, ...savedPick('sw_mission_forms', bestOf(story), story), key: 'sw_mission_forms',
    note: 'Choose the three forms you carry into this mission. 1 / 2 / 3 switch between them in the fight.' };
  if (m === 'sandbox') return { edit: true, known: story, ...savedPick('sw_sandbox_forms', DEFAULT_LOADOUT, story), key: 'sw_sandbox_forms',
    note: 'Choose the three forms you start with. You can change them any time in the sandbox panel (B).' };
  if (m === 'training') return { edit: false, known: story, loadout: trainingLoadout(),
    note: 'Training starts with the basics in Shii-Cho. Each form you learn in the story opens its own lesson here, picked between lessons.' };
  if (m === 'campaign' && canResume()){
    const run = G.resumeRun, su = run.stanceUnlocked || {};
    const known = ORDER.filter(id => (STARTING_FORMS.includes(id) || su[id] || (id === 'niman' && oldNimanRun(run))) && !forkClosed(id, run.formFork));
    const loadout = cleanLoadout(run.loadout || RUN_LOADOUT).map(id => id && (!run.chapterId || known.includes(id)) ? id : null);   // (as the run loads: game/saves.js restoreRun)
    if (!loadout.some(Boolean)) loadout[0] = STARTING_FORMS[0];
    return { edit: false, known, loadout, closed: run.formFork,
      note: 'Your saved run carries these three. They change each time you learn a new form.' };
  }
  return { edit: false, known: story, loadout: RUN_LOADOUT.slice(),
    note: 'A run starts with Shii-Cho, the first form every Jedi learns, and learns the others in order as it goes. Each time you learn one, you meditate and choose the three you carry.' };
}
function pauseContext(){
  const known = ORDER.filter(id => stanceUnlocked(id) && !forkClosed(id, G.formFork));
  return { edit: false, known, loadout: G.loadout.slice(), closed: G.formFork,
    note: G.sandbox ? 'Change the three in the sandbox panel (B).' : G.training || G.mission ? '' : 'Your three change each time you learn a new form.' };
}

/* ---------- render ---------- */
function slotRow(){
  const filled = ctx.loadout.filter(Boolean).length;
  return '<div class="fm-slots">' + Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
    const id = ctx.loadout[i];
    // ✕ empties a slot (a sibling, not inside the slot, so the controller's ring can land on it); the last form stays
    const x = ctx.edit && id && filled > 1 ? '<div class="fm-clear" data-clear="' + i + '" title="Empty this slot" aria-label="Empty slot ' + (i + 1) + '">✕</div>' : '';
    return '<div class="fm-slotw"><div class="fm-slot' + (ctx.edit ? ' edit' : '') + (ctx.edit && i === ctx.slot ? ' sel' : '') + (id ? '' : ' empty') + (x ? ' has-x' : '') + '" data-slot="' + i + '"' +
      (id ? ' style="--c:' + hex(STANCES[id].blade) + '"' : '') + '><span class="n">' + (i + 1) + '</span>' + (id ? esc(FORMS[id].name) : (ctx.known.length > filled ? 'EMPTY' : LOCK)) + '</div>' + x + '</div>';
  }).join('') + '</div>';
}
// both pages show small tiles and one form's detail beside them
function tile(id){
  const F = FORMS[id], C = FORM_CODEX[id] || {}, slotted = ctx.loadout.indexOf(id);
  return '<div class="fm-tile' + (ctx.edit ? ' pick' : '') + (slotted >= 0 ? ' in' : '') + (id === ctx.focus ? ' sel' : '') + '" data-form="' + id + '" style="--c:' + hex(STANCES[id].blade) + '">' +
    '<div class="fm-no"><span class="fm-t">' + formTitle(id) + ' · ' + famTag(id) + '</span>' + (slotted >= 0 ? '<span class="fm-in">SLOT ' + (slotted + 1) + '</span>' : '') + '</div>' +
    '<b>' + esc(F.name) + '</b>' + (C.best ? '<div class="fm-best">' + esc(C.best) + '</div>' : '') + '</div>';
}
function detail(){
  const id = ctx.focus;
  if (!id || !ctx.known.includes(id)) return '<div class="fm-detail empty">Select a form to see what it is good and bad at.</div>';
  const F = FORMS[id], C = FORM_CODEX[id] || {};
  return '<div class="fm-detail" style="--c:' + hex(STANCES[id].blade) + '"><div class="fm-no">' + formTitle(id) + ' · ' + esc(F.tag) + loreInfo(C) + '</div><b>' + esc(F.name) + '</b>' +
    (C.best ? '<div class="fm-best">BEST AGAINST · ' + esc(C.best) + '</div>' : '') +
    '<ul class="fm-pros">' + (C.pros || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    '<ul class="fm-cons">' + (C.cons || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' + counterBlock(id) + '</div>';
}
function render(){
  const n = ctx.known.length, head = n + (n === 1 ? ' form' : ' forms') + ' learned';
  // both pages share one layout: small tiles, and one form's whole story beside them (the pause page opens on the form in hand)
  panel.innerHTML = '<div class="howto-panel fm-compact">' +
    '<div class="howto-head"><div class="howto-title">' + (ctx.prefight ? 'BEFORE THE FIGHT' : 'LIGHTSABER FORMS') + '</div>' +
    '<div class="rm-sub">' + head + '</div><div class="howto-x" data-x="1">✕</div></div>' +
    '<div class="fm-sec">YOUR THREE</div>' + slotRow() +
    (ctx.note ? '<div class="fm-note">' + esc(ctx.note) + (ctx.edit ? EDIT_HINT : '') + '</div>' : '') +
    '<div class="fm-sec">THE FORMS</div><div class="fm-body"><div class="fm-tiles">' + ORDER.filter(id => ctx.known.includes(id)).map(tile).join('') + '</div>' + detail() + '</div>' + lockedRow() +
    (ctx.prefight ? '<div class="fm-actions"><div class="btn" data-x="1">BACK</div><div class="btn primary go" data-go="1">FIGHT</div></div>' : '') + '</div>';
}

/* ---------- picking (the same rules as the meditation: one Form V, one Form VII) ---------- */
// the next slot to fill: the first one left empty that wasn't emptied on purpose, else the one after this
const nextSlot = (from) => { const at = ctx.loadout.findIndex((id, i) => !id && !ctx.cleared[i]); return at >= 0 ? at : (from + 1) % LOADOUT_SLOTS; };
function pick(id){
  const d = ctx.loadout, at = d.indexOf(id);
  ctx.focus = id;
  if (at === ctx.slot){ clearSlot(at); return; }   // the form already in the picked slot: picking it again empties the slot
  if (at >= 0){ d[at] = d[ctx.slot]; if (!d[at]) ctx.cleared[at] = true; }   // a form already slotted swaps places with what was there
  d[ctx.slot] = id; ctx.cleared[ctx.slot] = false;
  ctx.loadout = cleanLoadout(d.map((x, i) => i === ctx.slot ? x : (x && FORMS[x].variant && FORMS[x].variant === FORMS[id].variant && x !== id ? null : x)));
  ctx.slot = nextSlot(ctx.slot);
  render();
}
// empty a slot on purpose (it stays empty next time, and the fight skips it); the last form left can't go
function clearSlot(i){
  if (!ctx.loadout[i] || ctx.loadout.filter(Boolean).length <= 1) return;
  ctx.loadout[i] = null; ctx.cleared[i] = true; ctx.slot = i;
  render();
}

/* ---------- open / close ---------- */
export const formsOpen = () => panel.classList.contains('open');
// BEGIN: the page before the fight; `go` starts the mode
export function openPrefight(go){
  ctx = { prefight: true, slot: 0, onGo: go, cleared: [], ...prefightContext() };
  if (ctx.edit) ctx.slot = nextSlot(LOADOUT_SLOTS - 1);
  ctx.focus = ctx.loadout.find(Boolean) || null;
  // nothing to choose or learn about: training (its lessons pick the form between lessons) or a single learned form
  // and nothing to choose at all: a campaign or survival run carries the three it has (they change as it learns forms,
  // and FORMS on the pause screen shows them), so the page would only be one more screen between BEGIN and the fight
  if (G.modeSel === 'training' || ctx.known.length <= 1 || !ctx.edit){ fight(); return; }
  render(); panel.classList.add('open');
}
export function openCodex(){
  ctx = { prefight: false, slot: 0, ...pauseContext() };
  ctx.focus = ctx.known.includes(G.stance) ? G.stance : ctx.loadout.find(Boolean) || ctx.known[0] || null;
  render(); panel.classList.add('open');
}
function close(){ panel.classList.remove('open'); ctx = null; }
function fight(){
  if (ctx.edit){
    if (!ctx.loadout.some(Boolean)){ ctx.loadout[0] = STARTING_FORMS[0]; ctx.cleared[0] = false; }
    try { localStorage.setItem(ctx.key, JSON.stringify(ctx.loadout.map((id, i) => id || (ctx.cleared[i] ? '' : null)))); } catch(e){}
  }
  G.missionForms = G.modeSel === 'mission' ? ctx.loadout.slice() : null;   // game/flow.js slots them as the mission starts
  const go = ctx.onGo; close(); go();
}

panel.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();   // the page must never launch or resume the game behind it
  if (!ctx) return;
  const t = e.target;
  if (t === panel || t.closest('[data-x]')){ close(); return; }
  if (t.closest('[data-go]')){ fight(); return; }
  const i = t.closest('.fm-i');
  if (i){ i.classList.toggle('on'); return; }   // the lore note: never picks the form behind it
  const s = t.closest('[data-slot]'), f = t.closest('[data-form]');
  if (!ctx.edit){   // show-only: a tile just shows its detail
    if (f){ ctx.focus = f.dataset.form; render(); }
    return;
  }
  const c = t.closest('[data-clear]');
  if (c){ clearSlot(+c.dataset.clear); return; }
  if (s){ ctx.slot = +s.dataset.slot; ctx.focus = ctx.loadout[ctx.slot] || ctx.focus; render(); return; }
  if (f) pick(f.dataset.form);
});
document.addEventListener('keydown', (e) => {
  if (!formsOpen()) return;
  if (e.key === 'Escape'){ close(); }
  else if (e.key === 'Enter' && ctx && ctx.prefight){ e.preventDefault(); e.stopPropagation(); fight(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && ctx && ctx.edit){ e.preventDefault(); clearSlot(ctx.slot); }   // empty the picked slot
  else if (/^[1-3]$/.test(e.key) && ctx && ctx.edit && +e.key <= LOADOUT_SLOTS){ ctx.slot = +e.key - 1; ctx.focus = ctx.loadout[ctx.slot] || ctx.focus; render(); }   // pick a slot
}, true);
document.getElementById('formsBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); if (G.hero === 'mando') openArmoryCodex(); else openCodex(); });
