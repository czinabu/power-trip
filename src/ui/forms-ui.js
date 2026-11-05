// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE FORMS PAGE: every lightsaber form the hero has learned, what it is in the lore and what it is good and bad at
// (data/forms.js FORM_CODEX). Forms not learned yet show as locked. It opens two ways:
//   · BEFORE THE FIGHT — BEGIN on the main menu (Jedi) opens it first. A mission or the sandbox lets the player choose the
//     three forms to carry; a campaign or survival run shows the three it has (they change only when the run learns a
//     form: game/meditation.js), and the training grounds the three they start on. FIGHT starts the mode.
// Neither names a form the hero hasn't learned: the forms still to come stand as one sealed card.
//   · FORMS & MASTERY on the pause screen — the same page, read only, for the run in progress, and MASTERY on the main
//     menu — read only, for the saved campaign run (or, with none, the best the story has reached). Both add THE FORCE on
//     top (the Force Level, and what each power gets from it in the form picked below) and each form's mastery on its tile.

import { FORM_MASTERY, FORM_RANKS, FORM_RANK_SHARE, FORCE_MAX, POWER_GROWTH, MOVE_ARRIVE, formRank, forceLevel, shareAt, bestRanks, growthGain, costMulFor } from '../data/force-level.js';
import { CFG } from '../data/config.js';
import { MASTERY_JEDI, masteryRank } from '../data/mastery.js';
import { storyForceLevel } from '../game/sandbox-unlocks.js';
import { G } from '../state.js';
import { FINISHERS } from '../data/finishers.js';
import { FORMS, FORM_CODEX, LOADOUT_SLOTS, DEFAULT_LOADOUT, RUN_LOADOUT, STARTING_FORMS, cleanLoadout, forkClosed, formTitle } from '../data/forms.js';
import { STANCES, stanceUnlocked } from '../data/stances.js';
import { FAMILIES, FORM_FAMILY, MATCHUP, LORE_EDGES, LORE_EDGE } from '../data/foe-forms.js';
import { formOffered, refreshSandboxScope } from '../game/sandbox-unlocks.js';
import { canResume, oldNimanRun, resumeLabel } from '../game/saves.js';
import { trainingLoadout } from '../game/tutorial.js';
import { audioInit } from '../audio/sfx.js';
import { openArmoryCodex } from './armory-ui.js';
import { famIcon } from './icons.js';
import { formsWindowOpen, repickForms } from '../game/meditation.js';

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
  const all = famOf(fam), known = all.filter(id => ctx.known.includes(id)).map(id => FORMS[id].name.charAt(0) + FORMS[id].name.slice(1).toLowerCase().replace(/(\s|-|')(\w)/g, (m, a, b) => a + b.toUpperCase()));
  const hidden = all.length - known.length;
  return known.concat(hidden ? [hidden === 1 ? 'a form still to learn' : hidden + ' forms still to learn'] : []).join(', ');
}
function famTag(id){
  const f = FAMILIES[FORM_FAMILY[id]];
  return '<span class="fm-fam" style="--fc:' + (f ? f.color : 'var(--ink-dim)') + '">' + famIcon(id, 11, 'fm-fam-ic') + (f ? f.name : 'NEUTRAL') + '</span>';
}
// what a counter is worth, in numbers: shown on hover over the Beats / Beaten by lines, so the page stays short
const counterWin = () => { const W = MATCHUP.win; return 'You counter it: +' + pct(W.dmg) + ' damage, its guard turns ' + pct(W.block) + ' fewer cuts, its blows land ' + pct(W.hurt) + ' softer and wear your block ' + pct(W.guard) + ' less'; };
const counterLose = () => { const L = MATCHUP.lose; return 'It counters you: −' + pct(L.dmg) + ' damage, its blows land ' + pct(L.hurt) + ' harder, crush your block ' + pct(L.guard) + ' faster and leave a ' + pct(L.window) + ' narrower parry window (only while one of your three could counter it)'; };
// a form's display name in sentence case ('Djem So', "Jar'Kai")
const niceName = (id) => FORMS[id].name.charAt(0) + FORMS[id].name.slice(1).toLowerCase().replace(/(\s|-|')(\w)/g, (m, a, b) => a + b.toUpperCase());
const named = (id) => ctx.known.includes(id) ? niceName(id) : 'a form still to learn';
const loreTitle = () => 'A lore edge: ' + Math.round(LORE_EDGE * 100) + '% of a full counter';
// the lore edges (data/foe-forms.js LORE_EDGES) this form gives or takes, as ▲ / ▼ lines
function loreRows(id){
  const out = [];
  for (const L of LORE_EDGES){
    const gives = L.a === id || (L.a === 'family' && FORM_FAMILY[id]);
    if (gives && L.b !== id) out.push('<li class="up" title="' + esc(loreTitle()) + '"><i>△</i>A slight edge on ' + esc(named(L.b)) + ': ' + esc(L.why) + '</li>');
    if (L.b === id) out.push('<li class="dn" title="' + esc(loreTitle()) + '"><i>▽</i>' + (L.a === 'family' ? 'Every form in the triangle has a slight edge on it' : esc(named(L.a)) + ' has a slight edge on it') + ': ' + esc(L.why) + '</li>');
  }
  return out.join('');
}
function counterBlock(id){
  const fam = FORM_FAMILY[id], F = FAMILIES[fam];
  const rows = (F
    ? '<li class="up" title="' + esc(counterWin()) + '"><i>▲</i>Beats <em style="--fc:' + FAMILIES[F.beats].color + '">' + FAMILIES[F.beats].name + '</em> duellists: ' + esc(famList(F.beats)) + '</li>' +
      (() => { const by = Object.keys(FAMILIES).find(k => FAMILIES[k].beats === fam); return '<li class="dn" title="' + esc(counterLose()) + '"><i>▼</i>Beaten by <em style="--fc:' + FAMILIES[by].color + '">' + FAMILIES[by].name + '</em> duellists: ' + esc(famList(by)) + '</li>'; })()
    : '<li class="eq"><i>•</i>Neutral: no group counters it, and it counters none</li>') + loreRows(id);
  return '<div class="fm-sub">COUNTERS · ' + famTag(id) + (F ? '<span class="fm-hint">hover for the numbers</span>' : '') + '</div><ul class="fm-ctr">' + rows + '</ul>';
}

/* ---------- MASTERY: what the page reads its Force Level and ranks from (ctx.view) ----------
   The pause page reads the run in play (data/force-level.js forceLevel / formRank, so the sandbox's sliders and the
   training's best ranks come through as they fight). The main menu reads the saved campaign run if there is one, else
   the best the story has reached: the Force Level the training grounds and the sandbox fight at, and each form's best
   rank from any run. `pts` is the practice a form has towards its next rank (null: this view keeps none). */
function liveView(){
  const practise = G.mode === 'play' && !G.training && !G.sandbox;   // (as game/upgrades.js trainForm: only a real fight teaches)
  return { lv: forceLevel(), rank: formRank, pts: practise ? (id) => (G.formUse && G.formUse[id]) || 0 : null,
    waits: (id) => G.formSince && G.formSince[id] != null && (G.waveTotal || 0) < G.formSince[id] + FORM_RANKS.gap * (formRank(id) + 1),
    has: (k) => !!(G.unlocked && G.unlocked[k]), powerRank: masteryRank,
    why: G.sandbox ? 'Sandbox: set the level, the ranks and your three in its panel (B)' : G.training ? 'Level and ranks as far as the story has reached' : '' };
}
function savedView(run){
  const fr = run.formRank || {}, fu = run.formUse || {}, un = run.unlocked || {}, pm = run.mastery || {};
  return { lv: Math.max(1, Math.min(FORCE_MAX, run.forceLevel || 1)), rank: (id) => fr[id] || 0, pts: (id) => fu[id] || 0, waits: () => false,
    has: (k) => !!un[k], powerRank: (id) => pm[id] || 0, why: 'Saved run · ' + resumeLabel() };
}
function storyView(){
  const b = bestRanks();
  return { lv: storyForceLevel(), rank: (id) => b[id] || 0, pts: null, waits: () => false, has: null, powerRank: () => 0,
    why: 'As far as the story has reached · best ranks from any run' };
}
const shareOf = (id) => shareAt(id, ctx.view.rank(id));
const pctOf = (x) => Math.round(x * 100) + '%';
// a rank's practice: [points into this rank, points this rank asks for] (FORM_RANKS.need holds running totals)
function rankProgress(id){
  const r = ctx.view.rank(id); if (r >= 3 || !ctx.view.pts) return null;
  const from = r ? FORM_RANKS.need[r - 1] : 0, to = FORM_RANKS.need[r];
  return [Math.max(0, Math.min(to - from, ctx.view.pts(id) - from)), to - from];
}
const ROMAN = ['', 'I', 'II', 'III'];
const pips = (r, n = 3) => '<span class="fm-pips">' + Array.from({ length: n }, (_, i) => '<i' + (i < r ? ' class="on"' : '') + '></i>').join('') + '</span>';
// on each tile: its rank, the bar to the next one, and its Force share
// the rank line, the same on a tile and in the detail: the rank earned (gold) on the left, the next rank and how far
// along it is on the right ('NEXT: EXPERT · 48%'; a form not ranked yet reads 'NEXT: ADEPT · 0%'), MASTER once it's done
function rankLine(id){
  const r = ctx.view ? ctx.view.rank(id) : formRank(id), p = ctx.view && rankProgress(id);
  const next = r < 3 ? FORM_RANKS.names[r + 1] : '', at = p ? Math.round(p[0] / p[1] * 100) : 0;
  return pips(r) + (r ? '<span class="fm-rk">' + FORM_RANKS.names[r] + '</span>' : '') +
    (next ? '<span class="fm-nx"' + (p ? ' title="' + p[0] + ' / ' + p[1] + ' practice to ' + next + '"' : '') + '><span class="fm-nx-k">NEXT:</span> ' + next + ' · ' + at + '%</span>' : '');
}
const rankBar = (id, big) => { const p = ctx.view && rankProgress(id); return p ? '<div class="fm-bar' + (big ? ' big' : '') + '"><i style="width:' + Math.round(p[0] / p[1] * 100) + '%"></i></div>' : ''; };
// on each tile: its rank, the bar to the next one, and its Force share
function tileMastery(id){
  if (!ctx.view || !FORM_MASTERY[id]) return '';
  return '<div class="fm-tm"><div class="fm-mast">' + rankLine(id) + '</div>' + rankBar(id) +
    '<div class="fm-sh">FORCE SHARE <em>' + pctOf(shareOf(id)) + '</em></div></div>';
}

/* THE FORCE — the Force Level, and every Force power: the level it opens at, how much stronger and cheaper the level makes
   it in the form picked below (data/force-level.js growthGain / costMulFor, the same numbers the powers fight with), and
   its own mastery rank (data/mastery.js). Grasp rides on Pull, the Force strikes come with the saber. */
const OWNED = { push: 'push', palm: null, pull: 'pull', grasp: 'pull', throw: 'throw', barrier: 'barrier', jslam: 'slam', mend: 'mend', judge: 'judge', repulse: 'repulse' };
const BASE = { push: 'push', pull: 'pull', grasp: 'grasp', throw: 'throw', barrier: 'barrier', jslam: 'slam', mend: 'mend', judge: 'judge', repulse: 'repulse' };
const POWER_MASTERY = Object.fromEntries(MASTERY_JEDI.map(m => [m.id, m]));
function powerCost(id, steps){
  const a = BASE[id] && CFG.abilities[BASE[id]]; if (!a || typeof a.cost !== 'number') return null;
  let c = a.cost; const m = POWER_MASTERY[id], r = m ? ctx.view.powerRank(id) : 0;
  for (let i = 0; i < r; i++) if (m.ranks[i].mul && m.ranks[i].mul.cost) c *= m.ranks[i].mul.cost;
  return Math.round(c * costMulFor(steps));
}
function powerRow(id, share){
  const g = POWER_GROWTH[id], v = ctx.view, lv = v.lv;
  const open = lv >= g.arrive, held = !v.has || !OWNED[id] || v.has(OWNED[id]);
  const steps = Math.max(0, lv - g.arrive) * share, cut = Math.round((1 - costMulFor(steps)) * 100);
  const r = POWER_MASTERY[id] ? v.powerRank(id) : 0;
  let line, tip = g.nm.charAt(0) + g.nm.slice(1).toLowerCase() + ': opens at Force Level ' + g.arrive;
  if (!open) line = '<span class="fm-pw-lock">' + LOCK + ' Opens at Force Level ' + g.arrive + '</span>';
  else if (!held) line = '<span class="fm-pw-off">Not in your kit</span>';
  else {
    const gain = growthGain(id, lv, share), cost = powerCost(id, steps);
    line = '<span class="fm-pw-ok">Ready</span><span class="fm-pw-up">' + (gain || 'At its base') + '</span>' +
      (cost != null ? '<span class="fm-pw-cost">' + cost + ' Force' + (cut ? ' · <s>' + cut + '% off</s>' : '') + '</span>' : '');   // (the Force strikes cost stamina, not Force)
    tip += '. ' + (gain ? gain + ' from your Force Level' : 'At its base strength: your Force Level adds to it from the next level') +
      (cost != null ? '. Costs ' + cost + ' Force a cast' + (cut ? ', ' + cut + '% less than at its base' : '') : '') + (r ? '. Power mastery rank ' + ROMAN[r] : '') + '.';
  }
  return '<div class="fm-pw' + (open && held ? '' : ' off') + '" title="' + esc(tip) + '"><div class="fm-pw-h"><b>' + esc(g.nm) + '</b>' + (r ? '<span class="fm-pw-m" title="Power mastery rank ' + ROMAN[r] + '">' + ROMAN[r] + '</span>' : '') +
    '<span class="fm-pw-lv">LV ' + g.arrive + '</span></div><div class="fm-pw-l">' + line + '</div></div>';
}
function forceSection(){
  const v = ctx.view, id = ctx.focus && ctx.known.includes(ctx.focus) ? ctx.focus : null;
  const share = id ? shareOf(id) : shareAt(STARTING_FORMS[0], v.rank(STARTING_FORMS[0]));
  const fname = esc(FORMS[id || STARTING_FORMS[0]].name);
  const moveCut = Math.round((1 - costMulFor(Math.max(0, v.lv - MOVE_ARRIVE.jump) * share)) * 100);
  const pw = Object.keys(POWER_GROWTH).map(k => powerRow(k, share)).join('') +
    '<div class="fm-pw" title="Force Jump, Dash and the double jump: no strength to grow, but ' + (moveCut ? 'they cost ' + moveCut + '% less Force, from your Force Level.' : 'each Force Level makes them a little cheaper.') + '"><div class="fm-pw-h"><b>FORCE JUMP &amp; DASH</b><span class="fm-pw-lv">LV 1</span></div><div class="fm-pw-l"><span class="fm-pw-ok">Ready</span><span class="fm-pw-up">Cost only</span>' +
    (moveCut ? '<span class="fm-pw-cost">Force · <s>' + moveCut + '% off</s></span>' : '') + '</div></div>';
  return '<div class="fm-sec">THE FORCE</div><div class="fm-force"><div class="fm-lv"><div class="fm-lv-k">FORCE LEVEL</div><div class="fm-lv-n">' + v.lv + '<span>/ ' + FORCE_MAX + '</span></div>' +
    pips(v.lv, FORCE_MAX) + '<div class="fm-lv-plain">Rises as the story goes on. Each level makes your powers hit harder and cost less Force.</div>' +
    '<div class="fm-lv-in" title="The Force Level rises with the story: the higher it is, the harder your powers hit and the less Force they cost. Pick a form below to compare.">In <b style="--c:' + hex(STANCES[id || STARTING_FORMS[0]].blade) + '">' + fname + '</b> your powers draw on <em>' + pctOf(share) + '</em> of it</div>' +
    '<div class="fm-key"><div><span class="fm-pw-up">+%</span> stronger, from your Force Level</div><div><span class="fm-pw-cost">Force</span> each cast, <s>% off</s> from the level</div><div><span class="fm-pw-m">I</span> power mastery · <span class="fm-pw-lv">LV</span> the level it opens at</div></div></div>' +
    '<div class="fm-pws">' + pw + '</div></div>';
}
const EDIT_HINT = ' Pick a slot, then a form for it. ✕ empties a slot.';
/* SHOW NUMBERS on the mastery pages: off by default, so the page reads as forms, ranks and powers. On, it adds the Force
   share, each power's gain and cost and the key to them, and the rank maths (styles/menus.css .fm-nums). Remembered. */
const NUMS_KEY = 'sw_fm_numbers';
let showNums = false;
try { showNums = localStorage.getItem(NUMS_KEY) === '1'; } catch(e){}
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
      note: 'Your saved run carries these three. They change when you learn a form, and at the start of each chapter.' };
  }
  return { edit: false, known: story, loadout: RUN_LOADOUT.slice(),
    note: 'A run starts with Shii-Cho, the first form every Jedi learns, and learns the others in order as it goes. Each time you learn one, you meditate and choose the three you carry, and each chapter starts with a chance to re-pick them.' };
}
function pauseContext(){
  const known = ORDER.filter(id => stanceUnlocked(id) && !forkClosed(id, G.formFork));
  // a run's FORMS WINDOW (game/meditation.js): at a chapter's start, or between survival waves, the three can be re-picked
  if (G.mode === 'play' && formsWindowOpen()) return { edit: true, repick: true, known, loadout: G.loadout.slice(), cleared: [], closed: G.formFork, view: liveView(),
    note: G.endless ? 'Between waves: choose the three you carry into the next one. They lock in when it starts.' : 'Before the fight: choose the three you carry into this chapter. They lock in when the fighting starts.' };
  return { edit: false, known, loadout: G.loadout.slice(), closed: G.formFork, view: liveView(),
    note: G.sandbox ? '' : G.training || G.mission && G.chapter < 0 ? '' : G.endless ? 'Your three change when you learn a form, and between waves.' : 'Your three change when you learn a form, and at the start of each chapter.' };
}

// MASTERY on the main menu: the saved campaign run (its forms, its three, its ranks), else what the story has taught
function menuContext(){
  const run = G.resumeRun && G.resumeRun.hero === 'jedi' ? G.resumeRun : null;
  if (run){
    const su = run.stanceUnlocked || {};
    const known = ORDER.filter(id => (STARTING_FORMS.includes(id) || su[id] || (id === 'niman' && oldNimanRun(run))) && !forkClosed(id, run.formFork));
    const loadout = cleanLoadout(run.loadout || RUN_LOADOUT).map(id => id && known.includes(id) ? id : null);
    if (!loadout.some(Boolean)) loadout[0] = STARTING_FORMS[0];
    return { edit: false, known, loadout, closed: run.formFork, view: savedView(run), stance: run.stance };
  }
  return { edit: false, known: storyForms(), loadout: null, view: storyView() };
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
  const F = FORMS[id], C = FORM_CODEX[id] || {}, slotted = (ctx.loadout || []).indexOf(id);
  return '<div class="fm-tile' + (ctx.edit ? ' pick' : '') + (slotted >= 0 ? ' in' : '') + (id === ctx.focus ? ' sel' : '') + '" data-form="' + id + '" style="--c:' + hex(STANCES[id].blade) + '">' +
    // the title gives way before the group does ('DOUBLE BL… · SPEED'), and the slot it's in sits beside the name, so
    // neither crowds the other off the tile (the slot as a boxed number, like the form switcher on the HUD)
    '<div class="fm-no"><span class="fm-t">' + formTitle(id) + ' ·</span>' + famTag(id) + '</div>' +
    '<div class="fm-nm"><b>' + esc(F.name) + '</b>' + (slotted >= 0 ? '<span class="fm-slotb" title="Slot ' + (slotted + 1) + ' of your three: ' + (slotted + 1) + ' switches to it in the fight" aria-label="Slot ' + (slotted + 1) + '">' + (slotted + 1) + '</span>' : '') + '</div>' +
    (C.best ? '<div class="fm-best" title="' + esc(C.best) + '">' + esc(C.best) + '</div>' : '') + tileMastery(id) + '</div>';
}
/* THE GROUPS — on the mastery pages, the cell a part-filled last row leaves empty holds the key to the group icons: the
   counter triangle (data/foe-forms.js FAMILIES) and the two forms outside it */
const FAM_REP = { power: 'djemso', guard: 'soresu', speed: 'ataru' };   // (famIcon draws by form)
function legendTile(){
  const tag = (k) => '<span class="fm-fam" style="--fc:' + FAMILIES[k].color + '">' + famIcon(FAM_REP[k], 10, 'fm-fam-ic') + FAMILIES[k].name + '</span>';
  return '<div class="fm-tile fm-legend"><div class="fm-no"><span class="fm-t">THE GROUPS</span></div><ul>' +
    Object.keys(FAMILIES).map(k => '<li>' + tag(k) + '<span>beats</span>' + tag(FAMILIES[k].beats) + '</li>').join('') +
    '<li><span class="fm-fam" style="--fc:var(--ink-dim)">' + famIcon('niman', 10, 'fm-fam-ic') + 'NEUTRAL</span><span>outside it</span></li></ul></div>';
}
// its SABER FINISHER (data/finishers.js): what the next attack on a foe with its guard broken does
// MASTERY in this form (data/force-level.js): its rank, the practice to the next one and what it brings, and its Force share
function forceBlock(id){
  const m = FORM_MASTERY[id]; if (!m) return '';
  const v = ctx.view, r = v ? v.rank(id) : formRank(id), next = r < 3 ? FORM_RANKS.names[r + 1] : '', p = v && rankProgress(id);
  const share = v ? shareOf(id) : shareAt(id, r);
  const where = !next ? 'Mastered: every strength at its fullest.'
    : p ? (p[0] >= p[1] ? 'Practice done: ' + next + ' lands at the next wave cleared.' : p[0] + ' / ' + p[1] + ' practice to ' + next + '.')
    : 'Ranks are earned in the campaign, survival and missions.';
  return '<div class="fm-sub fm-mast">MASTERY ' + rankLine(id) + '</div>' + (next ? rankBar(id, true) : '') +
    '<div class="fm-fin">' + esc(where) + (next ? ' Practise it with ' + esc(m.practice) + '.' : '') + '</div>' +
    '<div class="fm-rkl' + (r >= 3 ? ' on' : '') + '"><span>' + (r >= 3 ? 'MASTERED' : 'EACH RANK') + '</span>' + m.lines.map(esc).join(' · ') + '</div>' +
    '<div class="fm-fin dim">Each rank moves these a third of the way to Master and adds ' + pctOf(FORM_RANK_SHARE) + ' to its Force share: ' + pctOf(share) + ' now.</div>';
}
const finisherBlock = (id) => { const D = FINISHERS[id]; return D ? '<div class="fm-sub">FINISHER · ' + esc(D.name) + '</div><div class="fm-fin">' + esc(D.line) + '</div>' : ''; };
function detail(){
  const id = ctx.focus;
  if (!id || !ctx.known.includes(id)) return '<div class="fm-detail empty">Select a form to see what it is good and bad at.</div>';
  const F = FORMS[id], C = FORM_CODEX[id] || {};
  return '<div class="fm-detail" style="--c:' + hex(STANCES[id].blade) + '"><div class="fm-no">' + formTitle(id) + ' · ' + famTag(id) + loreInfo(C) + '</div><b>' + esc(F.name) + '</b>' +
    (C.best ? '<div class="fm-best">BEST AGAINST · ' + esc(C.best) + '</div>' : '') +
    // what it's for first (its best fights, its counters), then how it fights, its finisher, and its mastery
    counterBlock(id) +
    '<div class="fm-sub">STRENGTHS &amp; WEAKNESSES</div>' +
    '<ul class="fm-pros">' + (C.pros || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    '<ul class="fm-cons">' + (C.cons || []).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' + finisherBlock(id) + forceBlock(id) + '</div>';
}
function render(){
  const n = ctx.known.length, head = n + (n === 1 ? ' form' : ' forms') + ' learned';
  const few = !!ctx.view && n <= 4;   // (the mastery pages: a few forms take short tiles, with the forms still to learn under them)
  // both pages share one layout: small tiles, and one form's whole story beside them (the pause page opens on the form in hand)
  panel.innerHTML = '<div class="howto-panel fm-compact' + (ctx.view ? ' fm-mastery' + (showNums ? ' fm-nums' : '') : '') + '">' +
    '<div class="howto-head"><div class="howto-title">' + (ctx.prefight ? 'BEFORE THE FIGHT' : 'FORMS &amp; MASTERY') + '</div>' +
    '<div class="rm-sub">' + head + (ctx.view && ctx.view.why ? ' · ' + esc(ctx.view.why) : '') + '</div>' +
    (ctx.view ? '<div class="fm-numt' + (showNums ? ' on' : '') + '" data-nums="1" role="switch" aria-checked="' + showNums + '" title="Show the Force share, each power\'s gain and cost, and the rank maths"><i></i>SHOW NUMBERS</div>' : '') +
    '<div class="howto-x" data-x="1">✕</div></div>' +
    (ctx.view ? forceSection() : '') +
    // YOUR THREE is where the picker swaps forms; the read-only pages show the three as SLOT tags on the tiles instead
    (ctx.edit ? '<div class="fm-sec">YOUR THREE</div>' + slotRow() + (ctx.note ? '<div class="fm-note">' + esc(ctx.note) + EDIT_HINT + '</div>' : '') : '') +
    (!ctx.edit && !ctx.view && ctx.note ? '<div class="fm-note">' + esc(ctx.note) + '</div>' : '') +
    '<div class="fm-sec">THE FORMS' + (!ctx.edit && ctx.view && ctx.note ? '<span class="fm-hint">' + esc(ctx.note) + '</span>' : '') + '</div>' +
    '<div class="fm-body' + (few ? ' few' : '') + '"><div class="fm-col"><div class="fm-tiles' + (ctx.view ? (n > 6 ? ' c3' : ' c2') : '') + '">' + ORDER.filter(id => ctx.known.includes(id)).map(tile).join('') +
    (ctx.view && !few && n % (n > 6 ? 3 : 2) ? legendTile() : '') + '</div>' + (few ? lockedRow() : '') + '</div>' + detail() + '</div>' + (few ? '' : lockedRow()) +
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
  ctx = { prefight: false, slot: 0, ...(G.mode === 'menu' ? menuContext() : pauseContext()) };
  if (ctx.edit) ctx.slot = nextSlot(LOADOUT_SLOTS - 1);
  const hand = ctx.stance || (G.mode === 'menu' ? null : G.stance);
  ctx.focus = ctx.known.includes(hand) ? hand : (ctx.loadout || []).find(Boolean) || ctx.known[0] || null;
  render(); panel.classList.add('open');
}
function close(){ if (ctx && ctx.repick) repickForms(ctx.loadout); panel.classList.remove('open'); ctx = null; }   // (a run's re-pick takes effect as the page closes)
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
  if (t.closest('[data-nums]')){ showNums = !showNums; try { localStorage.setItem(NUMS_KEY, showNums ? '1' : '0'); } catch(e){} render(); return; }
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
