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
import { FINISHER_HOW, SIGNATURE_MOVES } from '../data/form-moves.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { FORMS, FORM_CODEX, LOADOUT_SLOTS, DEFAULT_LOADOUT, RUN_LOADOUT, STARTING_FORMS, cleanLoadout, forkClosed, formTitle } from '../data/forms.js';
import { STANCES, stanceUnlocked } from '../data/stances.js';
import { FAMILIES, FORM_FAMILY, MATCHUP, LORE_EDGES, LORE_EDGE } from '../data/foe-forms.js';
import { formOffered, refreshSandboxScope, storyReached } from '../game/sandbox-unlocks.js';
import { canResume, oldNimanRun, resumeLabel } from '../game/saves.js';
import { trainingLoadout } from '../game/tutorial.js';
import { audioInit } from '../audio/sfx.js';
import { openArmoryCodex } from './armory-ui.js';
import { famIcon, svgIcon } from './icons.js';
import { tabRow, pips, rankTrack, stat, LOCK_IC, revealDetail } from './mastery-kit.js';
import { formsWindowOpen, repickForms } from '../game/meditation.js';

const panel = document.getElementById('forms');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
const ORDER = Object.keys(FORMS).filter(id => FORMS[id].ready);

// the lore behind a small "i" (hover, focus or click), like the notes on Controls
const loreInfo = (C) => (C.lore || C.who) ? '<span class="fm-i" tabindex="0" role="button" aria-label="Lore">i</span><div class="fm-lorepop">' + esc(C.lore || '') + (C.who ? ' <i>' + esc(C.who) + '</i>' : '') + '</div>' : '';

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
  return '<span class="mx-fam" style="--fc:' + (f ? f.color : 'var(--hx-soft)') + '">' + famIcon(id, 12, 'mx-fam-ic') + (f ? f.name : 'NEUTRAL') + '</span>';
}
// what a counter is worth, in numbers: shown on hover over the Beats / Beaten by lines, so the page stays short
const counterWin = () => { const W = MATCHUP.win; return 'You counter it: +' + pct(W.dmg) + ' damage, its guard turns ' + pct(W.block) + ' fewer cuts, its blows land ' + pct(W.hurt) + ' softer and wear your block ' + pct(W.guard) + ' less'; };
const counterLose = () => { const L = MATCHUP.lose; return 'It counters you: −' + pct(L.dmg) + ' damage, its blows land ' + pct(L.hurt) + ' harder, crush your block ' + pct(L.guard) + ' faster and leave a ' + pct(L.window) + ' narrower parry window (only while one of your three could counter it)'; };
// a form's display name in sentence case ('Djem So', "Jar'Kai")
const niceName = (id) => FORMS[id].name.charAt(0) + FORMS[id].name.slice(1).toLowerCase().replace(/(\s|-|')(\w)/g, (m, a, b) => a + b.toUpperCase());
const named = (id) => ctx.known.includes(id) ? niceName(id) : 'a form still to learn';
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const loreTitle = () => 'A lore edge: ' + Math.round(LORE_EDGE * 100) + '% of a full counter';
// the lore edges (data/foe-forms.js LORE_EDGES) this form gives or takes, as ▲ / ▼ lines
function loreRows(id){
  const out = [];
  for (const L of LORE_EDGES){
    const gives = L.a === id || (L.a === 'family' && FORM_FAMILY[id]);
    // (the why names the other form, so it stays back until that form is learned)
    const why = (other) => other === 'family' || ctx.known.includes(other) ? ': ' + esc(L.why) : '';
    if (gives && L.b !== id) out.push('<li class="up" title="' + esc(loreTitle()) + '"><i>△</i>A slight edge on ' + esc(named(L.b)) + why(L.b) + '</li>');
    if (L.b === id) out.push('<li class="dn" title="' + esc(loreTitle()) + '"><i>▽</i>' + (L.a === 'family' ? 'Every form in the triangle has a slight edge on it' : esc(cap(named(L.a))) + ' has a slight edge on it') + why(L.a) + '</li>');
  }
  return out.join('');
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
    grasp: !!(G.unlocked && G.unlocked.pull) && (masteryRank('pull') >= GRASP_RANK || !!G.sandbox),   // (as player/jedi/grasp.js graspOpen)
    why: G.sandbox ? 'Sandbox: set the level, the ranks and your three in its panel (B)' : G.training ? 'Level and ranks as far as the story has reached' : '' };
}
function savedView(run){
  const fr = run.formRank || {}, fu = run.formUse || {}, un = run.unlocked || {}, pm = run.mastery || {};
  return { lv: Math.max(1, Math.min(FORCE_MAX, run.forceLevel || 1)), rank: (id) => fr[id] || 0, pts: (id) => fu[id] || 0, waits: () => false,
    has: (k) => !!un[k], powerRank: (id) => pm[id] || 0, grasp: !!un.pull && (pm.pull || 0) >= GRASP_RANK, why: 'Saved run · ' + resumeLabel() };
}
function storyView(){
  const b = bestRanks();
  return { lv: storyForceLevel(), rank: (id) => b[id] || 0, pts: null, waits: () => false, has: null, powerRank: () => 0, grasp: storyReached('pull'),
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
// a power the hero hasn't met yet (not in this run's kit, and the story hasn't handed it out anywhere) isn't named: it
// stands as a sealed card, like the forms still to learn. The Force strikes and Push come with the saber.
const SEEN = { pull: 'pull', grasp: 'pull', throw: 'throw', barrier: 'barrier', jslam: 'jslam', mend: 'mend', judge: 'judge', repulse: 'repulse' };
// a power is shown once the story has handed it out (in this run, or any) and the Force Level has reached it: one
// still locked behind a level is never named, it waits in the sealed tile with the powers not met yet
// The Grasp is Pull's rank I: until it opens it isn't named, on its tile or in Pull's ranks.
const GRASP_RANK = CFG.abilities.grasp.pullRank;
const powerKnown = (id) => id === 'grasp' ? !!ctx.view.grasp && ctx.view.lv >= POWER_GROWTH.grasp.arrive : (!SEEN[id] || !!(ctx.view.has && ctx.view.has(OWNED[id])) || storyReached(SEEN[id])) && ctx.view.lv >= POWER_GROWTH[id].arrive;

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

/* ---------- render: laid out like the profile (ui/mastery-kit.js) ----------
   On the left, who you are: the Force Level, your three, the counter groups. On the right, a grid of tiles (the forms,
   or on the mastery pages THE FORCE's powers) with ONE thing's detail beside it, that detail cut into short tabs
   (FIGHT · MOVES · MASTERY) so only one part reads at a time. styles/heroes/mastery.css paints it as a holocron page. */
const ROMAN = ['', 'I', 'II', 'III'];
const RANK_STOPS = ['UNRANKED', 'ADEPT', 'EXPERT', 'MASTER'];
const bladeOf = (id) => hex(STANCES[id].blade);
const rankOf = (id) => ctx.view ? ctx.view.rank(id) : formRank(id);
const fracOf = (id) => { const p = ctx.view && rankProgress(id); return p ? Math.min(1, p[0] / p[1]) : 0; };
const FAM_REP = { power: 'djemso', guard: 'soresu', speed: 'ataru' };   // (famIcon draws by form)
const famBadge = (f) => '<span class="mx-fam" style="--fc:' + FAMILIES[f].color + '">' + famIcon(FAM_REP[f], 12, 'mx-fam-ic') + FAMILIES[f].name + '</span>';
let entering = false;   // the panel's entrance plays on opening, not on every tap

/* the left column */
function levelCard(){
  const v = ctx.view;
  return '<div class="mx-card mx-lv"><div class="mx-k">FORCE LEVEL</div><div class="mx-big"><b>' + v.lv + '</b><span>/ ' + FORCE_MAX + '</span></div>' +
    pips(v.lv, FORCE_MAX, 'lv') + '<p>Your powers hit harder and cost less as it rises with the story.</p></div>';
}
function threeCard(){
  if (!ctx.loadout) return '';
  const filled = ctx.loadout.filter(Boolean).length;
  const rows = Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
    const id = ctx.loadout[i];
    // ✕ empties a slot (a sibling, not inside the slot, so the controller's ring can land on it); the last form stays
    const x = ctx.edit && id && filled > 1 ? '<span class="mx-clear" data-clear="' + i + '" title="Empty this slot" aria-label="Empty slot ' + (i + 1) + '">✕</span>' : '';
    return '<div class="mx-slotw"><div class="mx-slot' + (ctx.edit ? ' edit' : '') + (ctx.edit && i === ctx.slot ? ' sel' : '') + (id ? '' : ' empty') + '" data-slot="' + i + '"' +
      (id ? ' style="--c:' + bladeOf(id) + '"' : '') + '><kbd>' + (i + 1) + '</kbd>' +
      (id ? '<i class="mx-blade"></i><b>' + esc(FORMS[id].name) + '</b>' + famIcon(id, 12, 'mx-fam-ic') : '<b>' + (ctx.known.length > filled ? 'EMPTY' : LOCK_IC) + '</b>') + '</div>' + x + '</div>';
  }).join('');
  // YOUR THREE leads the page: first on the left (and on a phone), in the hero's accent frame (styles/heroes/mastery.css .mx-three)
  return '<div class="mx-card mx-three"><div class="mx-k">YOUR THREE<em>' + (ctx.edit ? 'pick a slot, then a form' : '1 · 2 · 3 switch in the fight') + '</em></div><div class="mx-slots">' + rows + '</div>' +
    (ctx.note ? '<p class="mx-note">' + esc(ctx.note) + '</p>' : '') + '</div>';
}
function groupsCard(){
  return '<div class="mx-card mx-groups"><div class="mx-k">THE GROUPS</div><ul>' +
    Object.keys(FAMILIES).map(k => '<li>' + famBadge(k) + '<i>beats</i>' + famBadge(FAMILIES[k].beats) + '</li>').join('') +
    '<li><span class="mx-fam" style="--fc:var(--hx-soft)">' + famIcon('niman', 12, 'mx-fam-ic') + 'NEUTRAL</span><i>outside it</i></li></ul></div>';
}

/* the forms: a tile each, and the forms still to learn sealed (never named: data/forms.js) */
function formTile(id){
  const slotted = (ctx.loadout || []).indexOf(id), r = rankOf(id), m = FORM_MASTERY[id];
  return '<div class="mx-tile' + (id === ctx.focus ? ' sel' : '') + (slotted >= 0 ? ' in' : '') + '" data-form="' + id + '" style="--c:' + bladeOf(id) + '">' +
    '<i class="mx-blade"></i><div class="mx-tt"><span>' + formTitle(id) + '</span>' +
    (slotted >= 0 ? '<kbd class="mx-slotb" title="Slot ' + (slotted + 1) + ' of your three: ' + (slotted + 1) + ' switches to it in the fight">' + (slotted + 1) + '</kbd>' : '') + '</div>' +
    '<b>' + esc(FORMS[id].name) + '</b><div class="mx-tf">' + famTag(id) + '</div>' +
    (m ? '<div class="mx-tr">' + pips(r) + '<span>' + RANK_STOPS[r] + '</span></div>' + (ctx.view && r < 3 && rankProgress(id) ? '<div class="mx-bar"><i style="width:' + Math.round(fracOf(id) * 100) + '%"></i></div>' : '') : '') + '</div>';
}
// the forms still to learn are never named or counted (which numerals, variants or weapons are left would give the
// story away): they stand as one sealed tile. A fork's other side, closed this run, is shown, since the player chose it.
function sealedTiles(locked){
  const closed = locked.filter(id => FORMS[id].fork && ctx.closed && ctx.closed !== id), rest = locked.length - closed.length;
  return closed.map(id => '<div class="mx-tile sealed" title="Closed for this run: you chose ' + esc(FORMS[ctx.closed].name) + '"><div class="mx-tt"><span>' + formTitle(id) + '</span></div>' +
    '<b>' + esc(FORMS[id].name) + '</b><div class="mx-tf">CLOSED THIS RUN</div></div>').join('') +
    (rest ? '<div class="mx-tile sealed" title="Forms still to learn"><div class="mx-tt"><span>STILL TO LEARN</span></div><b>' + LOCK_IC + '</b><div class="mx-tf">THE STORY TEACHES THE REST</div></div>' : '');
}
// FIGHT: what it beats and what beats it (the numbers on hover, or under SHOW NUMBERS), its lore edges, then its strengths and weaknesses
function fightPart(id){
  const fam = FORM_FAMILY[id], F = FAMILIES[fam], C = FORM_CODEX[id] || {};
  const plate = (cls, k, f, tip) => '<div class="mx-ctr ' + cls + '" title="' + esc(tip) + '"><span>' + k + '</span>' + famBadge(f) + '<em>' + esc(famList(f)) + '</em>' +
    (showNums ? '<small>' + esc(tip) + '</small>' : '') + '</div>';
  const by = F && Object.keys(FAMILIES).find(k => FAMILIES[k].beats === fam);
  const ctr = F ? plate('up', 'BEATS', F.beats, counterWin()) + plate('dn', 'BEATEN BY', by, counterLose())
    : '<div class="mx-ctr eq"><span>NEUTRAL</span><em>No group counters it, and it counters none</em></div>';
  const lore = loreRows(id);
  return '<div class="mx-ctrs">' + ctr + '</div>' + (lore ? '<ul class="mx-edges">' + lore + '</ul>' : '') +
    '<ul class="mx-pc">' + (C.pros || []).map(t => '<li class="up">' + esc(t) + '</li>').join('') + (C.cons || []).map(t => '<li class="dn">' + esc(t) + '</li>').join('') + '</ul>';
}
/* MOVES — HOW TO DO IT (data/form-moves.js): one line of key chips, each step's keys then what it is ('[E][E] break its
   guard, then [LMB] at the hilt'). Each chip keeps its key in data-kb, so it turns into the pad's button the moment a
   controller takes over (engine/gamepad.js relabelHud), and back. */
const keyChip = (k) => /^(HOLD|TAP)$/.test(k) ? '<i>' + k.toLowerCase() + '</i>' : k === '+' ? '<span>+</span>'
  : '<kbd data-kb="' + esc(k) + '">' + esc(pad.active ? padKeys(k, 'jedi') : k) + '</kbd>';
const howLine = (how) => '<div class="fm-how">' +
  how.map(([keys, what], i) => '<span class="fm-step">' + (i ? '<span class="then">then</span>' : '') + keys.split(' ').map(keyChip).join('') + (what ? '<em>' + esc(what) + '</em>' : '') + '</span>').join('') + '</div>';
function movesPart(id){
  const S = SIGNATURE_MOVES[id], D = FINISHERS[id];
  return (S ? '<div class="mx-move"><div class="mx-k">SIGNATURE MOVE</div><b>' + esc(S.name) + '</b>' + howLine(S.how) + '</div>' : '') +
    (D ? '<div class="mx-move"><div class="mx-k">SABER FINISHER</div><b>' + esc(D.name) + '</b><p>' + esc(D.line) + '</p>' + howLine(FINISHER_HOW) + '</div>' : '');
}
// MASTERY in this form (data/force-level.js): the rank track, the practice to the next rank, what each rank brings
function masteryPart(id){
  const m = FORM_MASTERY[id]; if (!m) return '';
  const r = rankOf(id), next = r < 3 ? FORM_RANKS.names[r + 1] : '', p = ctx.view && rankProgress(id);
  const share = ctx.view ? shareOf(id) : shareAt(id, r);
  const where = !next ? 'Mastered: every strength at its fullest.'
    : p ? (p[0] >= p[1] ? 'Practice done: ' + next + ' lands at the next wave cleared.' : p[0] + ' / ' + p[1] + ' practice to ' + next + '.')
    : 'Ranks are earned in the campaign, survival and missions.';
  return rankTrack(RANK_STOPS, r, fracOf(id)) + '<p class="mx-where">' + esc(where) + '</p>' +
    (next ? '<div class="mx-k">PRACTISE WITH</div><p class="mx-p">' + esc(cap(m.practice)) + '</p>' : '') +
    '<div class="mx-k">' + (r >= 3 ? 'MASTERED' : 'EACH RANK') + '</div><ul class="mx-ranks' + (r >= 3 ? ' on' : '') + '">' + m.lines.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    (showNums ? '<p class="mx-fine">Each rank moves these a third of the way to Master and adds ' + pctOf(FORM_RANK_SHARE) + ' to its Force share: ' + pctOf(share) + ' now.</p>' : '');
}
function formDetail(){
  const id = ctx.focus;
  if (!id || !ctx.known.includes(id)) return '<div class="mx-detail empty">Pick a form to see what it is good and bad at.</div>';
  const C = FORM_CODEX[id] || {}, parts = [['fight', 'FIGHT'], ['moves', 'MOVES']].concat(FORM_MASTERY[id] ? [['mastery', 'MASTERY']] : []);
  const on = parts.some(([k]) => k === ctx.dtab) ? ctx.dtab : 'fight';
  return '<div class="mx-detail" style="--c:' + bladeOf(id) + '"><div class="mx-dh"><i class="mx-blade big"></i><div class="mx-dn"><div class="mx-k">' + formTitle(id) + ' · ' + famTag(id) + '</div>' +
    '<b>' + esc(FORMS[id].name) + '</b>' + (C.best ? '<em>Best against ' + esc(C.best.charAt(0).toLowerCase() + C.best.slice(1)) + '</em>' : '') + '</div>' + loreInfo(C) + '</div>' +
    tabRow(parts, on, 'dtab', 'mx-dtabs') + '<div class="mx-dbody">' + (on === 'moves' ? movesPart(id) : on === 'mastery' ? masteryPart(id) : fightPart(id)) + '</div></div>';
}

/* THE FORCE — every Force power: the level it opens at, how much stronger and cheaper the level makes it in the form
   picked (data/force-level.js growthGain / costMulFor, the same numbers the powers fight with), and its own mastery rank
   (data/mastery.js). Grasp rides on Pull, the Force strikes come with the saber. A power the hero hasn't met yet (not in
   this run's kit, and the story hasn't handed it out anywhere) isn't named: it stands sealed, like the forms. */
const POWER_IC = { push: 'push', palm: 'impact', pull: 'pull', grasp: 'hook', throw: 'cycle', barrier: 'shield', jslam: 'slam', mend: 'cross', judge: 'bolt', repulse: 'nova', move: 'dash' };
const POWERS = () => Object.keys(POWER_GROWTH).concat('move');
const formShare = () => { const id = ctx.focus && ctx.known.includes(ctx.focus) ? ctx.focus : STARTING_FORMS[0]; return [id, shareAt(id, ctx.view.rank(id))]; };
function powerOf(id){
  const v = ctx.view, [, share] = formShare();
  if (id === 'move'){
    const cut = Math.round((1 - costMulFor(Math.max(0, v.lv - MOVE_ARRIVE.jump) * share)) * 100);
    return { nm: 'FORCE JUMP & DASH', arrive: 1, known: true, open: true, held: true, gain: '', cost: null, cut, r: 0, m: null };
  }
  const g = POWER_GROWTH[id], open = v.lv >= g.arrive, held = id === 'grasp' ? !!v.grasp : !v.has || !OWNED[id] || v.has(OWNED[id]);
  const steps = Math.max(0, v.lv - g.arrive) * share, m = POWER_MASTERY[id] || null;
  return { nm: g.nm, arrive: g.arrive, known: powerKnown(id), open, held, gain: open && held ? growthGain(id, v.lv, share) : '', cost: powerCost(id, steps),
    cut: Math.round((1 - costMulFor(steps)) * 100), r: m ? v.powerRank(id) : 0, m };
}
// a rank's line as the page shows it (data/mastery.js keeps a little HTML in them), the Grasp kept unnamed until it opens
const rankDs = (id, ds) => { const t = ds.replace(/&amp;/g, '&'); return id === 'pull' && !ctx.view.grasp ? t.replace(/Unlocks FORCE GRASP \(hold C\)/, 'Unlocks a new power').replace(/wider grasp/, 'wider cone') : t; };
const powerState = (P) => !P.open ? 'Opens at Force Level ' + P.arrive : !P.held ? 'Not in your kit' : 'Ready';
function powerTile(id){
  const P = powerOf(id);
  const live = P.open && P.held;
  return '<div class="mx-tile pw' + (live ? ' live' : ' off') + (id === ctx.power ? ' sel' : '') + '" data-power="' + id + '"><div class="mx-tt"><span>LV ' + P.arrive + '</span>' +
    (P.r ? '<em class="mx-pm" title="Power mastery rank ' + ROMAN[P.r] + '">' + ROMAN[P.r] + '</em>' : '') + '</div>' +
    '<span class="mx-pic">' + svgIcon(POWER_IC[id], 'mx-pic-ic') + '</span><b>' + esc(P.nm) + '</b><div class="mx-tf">' + (live ? '<span class="mx-ok">READY</span>' : !P.open ? LOCK_IC + ' LV ' + P.arrive : 'NOT IN YOUR KIT') + '</div></div>';
}
function powerDetail(){
  const id = ctx.power, P = powerOf(id), [fid, share] = formShare();
  const live = P.open && P.held;
  const cutStat = stat((P.cut ? '−' + P.cut : '0') + '%', 'Force cost, from your level');
  const stats = !live ? '' : '<div class="mx-stats">' + (id === 'move' ? cutStat
    : stat(P.gain ? esc(P.gain.split(' ')[0]) : 'BASE', P.gain ? P.gain.split(' ').slice(1).join(' ') + ', from your level' : 'strength, until the next level') +
      (P.cost != null ? stat(P.cost, 'Force a cast') + (showNums ? cutStat : '') : '')) + '</div>';   // (the Force strikes cost stamina, not Force)
  const m = P.m;
  return '<div class="mx-detail pw"><div class="mx-dh"><span class="mx-pic big">' + svgIcon(POWER_IC[id], 'mx-pic-ic') + '</span><div class="mx-dn"><div class="mx-k">OPENS AT FORCE LEVEL ' + P.arrive + '</div>' +
    '<b>' + esc(P.nm) + '</b><em class="' + (live ? 'ok' : '') + '">' + powerState(P) + '</em></div></div><div class="mx-dbody">' + stats +
    (live ? '<p class="mx-share">In <b style="--c:' + bladeOf(fid) + '">' + esc(FORMS[fid].name) + '</b> your powers draw on <em>' + pctOf(share) + '</em> of your Force Level. Pick another form to compare.</p>' : '') +
    (m ? '<div class="mx-k">POWER MASTERY</div>' + rankTrack(['BASE'].concat(m.ranks.map((_, i) => 'RANK ' + ROMAN[i + 1])), P.r, 0) +
      '<ul class="mx-ranks">' + m.ranks.map((k, i) => '<li class="' + (i < P.r ? 'got' : '') + '"><span>' + ROMAN[i + 1] + '</span>' + esc(rankDs(id, k.ds)) + '</li>').join('') + '</ul>' +
      '<p class="mx-fine">Power mastery is earned on the upgrade screen with points and uses.</p>' : '') +
    (id === 'move' ? '<p class="mx-where">Force Jump, Dash and the double jump: no strength to grow, but ' + (P.cut ? 'they cost ' + P.cut + '% less Force from your Force Level.' : 'each Force Level makes them a little cheaper.') + '</p>' : '') + '</div></div>';
}

function render(){
  const n = ctx.known.length, head = n + (n === 1 ? ' form' : ' forms') + ' learned';
  const tab = ctx.view ? ctx.tab : 'forms';
  if (ctx.view) refreshSandboxScope();   // (what the story has handed out: a power not met yet stays sealed)
  const locked = ORDER.filter(id => !ctx.known.includes(id));
  // the powers not met yet: one sealed tile, never named, counted or dated (as the forms still to learn)
  const unmet = tab === 'force' && POWERS().some(id => !powerOf(id).known);
  if (tab === 'force' && !powerOf(ctx.power).known) ctx.power = 'push';
  const grid = tab === 'force' ? POWERS().filter(id => powerOf(id).known).map(powerTile).join('') +
      (unmet ? '<div class="mx-tile pw sealed" title="Powers still to learn"><div class="mx-tt"><span>STILL TO LEARN</span></div><b>' + LOCK_IC + '</b><div class="mx-tf">THE STORY HANDS YOU MORE</div></div>' : '') : ORDER.filter(id => ctx.known.includes(id)).map(formTile).join('') + sealedTiles(locked);
  const tabs = ctx.view ? tabRow([['forms', 'THE FORMS', n], ['force', 'THE FORCE', 'LV ' + ctx.view.lv]], tab, 'tab') : '';
  panel.dataset.hero = 'jedi';
  panel.innerHTML = '<div class="howto-panel mx' + (entering ? ' enter' : '') + (ctx.prefight ? ' pre' : '') + '" data-hero="jedi">' +
    '<div class="howto-head"><div class="howto-title">' + (ctx.prefight ? 'BEFORE THE FIGHT' : 'FORMS &amp; MASTERY') + '</div>' +
    '<div class="rm-sub">' + head + (ctx.view && ctx.view.why ? ' · ' + esc(ctx.view.why) : '') + '</div>' +
    (ctx.view ? '<div class="mx-numt' + (showNums ? ' on' : '') + '" data-nums="1" role="switch" aria-checked="' + showNums + '" title="Show the Force share, the counter and cost numbers, and the rank maths"><i></i>NUMBERS</div>' : '') +
    '<div class="howto-x" data-x="1">✕</div></div>' +
    '<div class="mx-body"><div class="mx-left">' + threeCard() + (ctx.view ? levelCard() : '') + groupsCard() + '</div>' +
    '<div class="mx-right">' + tabs + '<div class="mx-split"><div class="mx-grid' + (tab === 'force' ? ' pws' : '') + '">' + grid + '</div>' + (tab === 'force' ? powerDetail() : formDetail()) + '</div></div></div>' +
    (ctx.prefight ? '<div class="mx-actions"><div class="btn" data-x="1">BACK</div><div class="btn primary go" data-go="1">FIGHT</div></div>' : '') + '</div>';
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
  ctx = { prefight: true, slot: 0, onGo: go, cleared: [], tab: 'forms', dtab: 'fight', power: 'push', ...prefightContext() };
  if (ctx.edit) ctx.slot = nextSlot(LOADOUT_SLOTS - 1);
  ctx.focus = ctx.loadout.find(Boolean) || null;
  // nothing to choose or learn about: training (its lessons pick the form between lessons) or a single learned form
  // and nothing to choose at all: a campaign or survival run carries the three it has (they change as it learns forms,
  // and FORMS on the pause screen shows them), so the page would only be one more screen between BEGIN and the fight
  if (G.modeSel === 'training' || ctx.known.length <= 1 || !ctx.edit){ fight(); return; }
  show();
}
export function openCodex(){
  ctx = { prefight: false, slot: 0, ...(G.mode === 'menu' ? menuContext() : pauseContext()) };
  if (ctx.edit) ctx.slot = nextSlot(LOADOUT_SLOTS - 1);
  const hand = ctx.stance || (G.mode === 'menu' ? null : G.stance);
  ctx.focus = ctx.known.includes(hand) ? hand : (ctx.loadout || []).find(Boolean) || ctx.known[0] || null;
  ctx.tab = 'forms'; ctx.dtab = 'fight'; ctx.power = 'push';
  show();
}
function show(){ entering = true; render(); entering = false; panel.classList.add('open'); }
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
  const tb = t.closest('[data-tab]'), dt = t.closest('[data-dtab]'), pw = t.closest('[data-power]');
  if (tb){ ctx.tab = tb.dataset.tab; render(); return; }   // THE FORMS | THE FORCE
  if (dt){ ctx.dtab = dt.dataset.dtab; render(); return; }   // the detail's FIGHT | MOVES | MASTERY (kept as you go from form to form)
  if (pw){ ctx.power = pw.dataset.power; render(); revealDetail(panel); return; }
  const s = t.closest('[data-slot]'), f = t.closest('[data-form]');
  if (!ctx.edit){   // show-only: a tile just shows its detail
    if (f){ ctx.focus = f.dataset.form; render(); revealDetail(panel); }
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
document.getElementById('formsBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); if (G.hero === 'mando' || G.hero === 'trooper') openArmoryCodex(); else openCodex(); });
