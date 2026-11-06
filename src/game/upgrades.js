// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LEARN BY DOING: what a run earns in the fight itself, without stopping it.
//  · MASTERY — every power you own ranks up from using it in a fight (data/mastery.js `uses`). No XP, no screen: a
//    small note in the corner names what changed.
//  · SKILL POINTS — the story pays one for every XP_PER_POINT XP (kills, clears, parries and the rest all count);
//    survival pays one per wave cleared. A point is only noted mid-fight; it is spent on the upgrade page
//    (ui/store-ui.js), which opens once at a chapter's close (every SURVIVAL_EVERY waves in survival).

import { S } from '../audio/sfx.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { G, shared, enemies, isGunner, bossUp } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { masterySet, masteryRank } from '../data/mastery.js';
import { FORM_MASTERY, FORM_RANKS, formRank, noteBestRank, forceShare } from '../data/force-level.js';
import { STANCES } from '../data/stances.js';
import { noteFormRank, notePowerRank } from './profile.js';

export const SURVIVAL_EVERY = 3;     // survival: the upgrade page opens every 3rd wave cleared
const RANK_NUM = ['', 'I', 'II', 'III'];

// the training grounds and the sandbox hand powers out; every real fight (campaign, survival, missions, co-op) teaches
const learning = () => G.mode === 'play' && !G.training && !G.sandbox && !G.hub;
// a cast only teaches when there is something to use it on
function inFight(){
  if (bossUp()) return true;
  for (const e of enemies) if (!e.dead && !e.converted) return true;
  return false;
}

/* ---------------- corner notes ---------------- */
let toastWrap = null;
export function upToast(head, line, kind){
  if (!toastWrap) toastWrap = document.getElementById('uptoasts');
  if (!toastWrap) return;
  const t = document.createElement('div');
  t.className = 'uptoast ' + (kind || '');
  t.innerHTML = '<b></b><span></span>';
  t.firstChild.textContent = head; t.lastChild.textContent = line || '';
  toastWrap.appendChild(t);
  while (toastWrap.children.length > 3) toastWrap.firstChild.remove();
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4800);
}

// first-sighting foe tips: one corner note at a time, queued so a mixed wave never stacks them, and kept to a sentence
const foeQ = [];
let foeBusy = false;
function nextFoeTip(){
  const n = foeQ.shift();
  if (!n){ foeBusy = false; return; }
  foeBusy = true;
  upToast(n[0], n[1], 'foe');
  setTimeout(nextFoeTip, 5000);
}
export function foeTipToast(head, line){
  const short = (line || '').split(/(?<=[.!?]) /)[0];
  foeQ.push([head, short]);
  if (!foeBusy) nextFoeTip();
}

/* ---------------- mastery by use ---------------- */
const masteryOf = (id) => masterySet().find(m => m.id === id);
// rank II also waits for its `r2` wave, so an early power still can't be maxed in the first level
const rankOpen = (m, rank) => rank < 1 || m.r2 == null || (G.waveTotal || 0) >= m.r2;
export function masteryUses(id){ return (G.masteryUse && G.masteryUse[id]) || 0; }
// how far the next rank is: { need, have, open } (need is the total uses that rank asks for), or null when maxed
export function masteryNext(m){
  const r = masteryRank(m.id);
  if (r >= m.ranks.length) return null;
  return { rank: r, need: m.uses[r], have: Math.min(masteryUses(m.id), m.uses[r]), open: rankOpen(m, r) };
}
function rankUp(m){
  const r = masteryRank(m.id);
  if (!G.mastery) G.mastery = {};
  G.mastery[m.id] = r + 1;
  const pp = playerPos();
  floater(pp, m.nm + ' ' + RANK_NUM[r + 1], '#ffd24a');
  burst(pp.clone().setY(1.6), 0xffd24a, 12, 5, 4);
  S.reward(r + 1 >= m.ranks.length ? 2 : 1);
  upToast(m.nm + ' MASTERED ' + RANK_NUM[r + 1], m.ranks[r].ds, 'mast');
  notePowerRank();   // (rank XP for your profile: game/profile.js)
  if (powerRankHook) powerRankHook(m.id, r + 1);   // (a rank can open something: Force Pull's rank I, the Grasp, player/jedi/grasp.js)
}
let powerRankHook = null;
export const onPowerRank = (fn) => { powerRankHook = fn; };
function settle(m){
  const n = masteryNext(m);
  if (n && n.open && masteryUses(m.id) >= n.need){ rankUp(m); settle(m); }
}
// a power was used (player/jedi/force.js, player/mando/gadgets.js …). id is its mastery id (data/mastery.js)
export function trainAbility(id){
  if (!learning() || !inFight()) return;
  trainForm('cast');   // (Niman's signature: a power cast in the fight)
  const m = masteryOf(id);
  if (!m || !m.owned() || !masteryNext(m)) return;
  if (!G.masteryUse) G.masteryUse = {};
  G.masteryUse[id] = masteryUses(id) + 1;
  settle(m);
}
// a held power (the flamethrower) teaches by the second it spends on foes
let heldT = {};
export function trainHeld(id, dt){
  heldT[id] = (heldT[id] || 0) + dt;
  if (heldT[id] >= 1){ heldT[id] -= 1; trainAbility(id); }
}
// a rank II that was earned before its wave opened lands as soon as it does (called at each wave clear)
export function settleMastery(){
  for (const m of masterySet()) if (m.owned()) settle(m);
  if (!isGunner() && G.formUse) for (const id in G.formUse) settleForm(id);
}

/* ---------------- form mastery by use (data/force-level.js) ---------------- */
// what a moment of the fight is worth to the form in hand: a cut that lands 1, a kill 2 more, a block, parry or deflect 1;
// the form's signature (FORM_MASTERY sig) 2 more on top. kind: hit | kill | parries | blocks | deflects | cast
const SIG = {
  finisher: (k, c) => !!c.finisher,
  blade:    (k, c) => !!c.blade,
  guard:    (k) => k === 'parries' || k === 'blocks' || k === 'deflects',
  deflect:  (k) => k === 'deflects',
  air:      (k, c) => !!(c.air || c.backLine),
  heavy:    (k, c) => !!(c.heavy || c.finisher),
  cast:     (k) => k === 'cast',
};
export function trainForm(kind, ctx = {}){
  if (isGunner() || !learning() || !inFight()) return;
  const id = G.stance, m = FORM_MASTERY[id];
  if (!m || kind === 'dodges') return;
  const r = formRank(id);
  if (r >= 3) return;
  const sig = SIG[m.sig] && SIG[m.sig](kind, ctx);
  if (kind === 'cast' && !sig) return;   // a cast only counts for the form that is built on it
  const pts = (kind === 'kill' ? 3 : 1) + (sig ? 2 : 0);
  G.formUse = G.formUse || {}; G.formSince = G.formSince || {};
  if (G.formSince[id] == null) G.formSince[id] = G.waveTotal || 0;   // practice starts the first time it is used
  G.formUse[id] = (G.formUse[id] || 0) + pts;
  settleForm(id);
}
// a rank lands once its practice is in and its stages have passed (also checked at each wave clear: settleMastery)
function settleForm(id){
  const r = formRank(id), m = FORM_MASTERY[id];
  if (!m || r >= 3) return;
  if ((G.formUse && G.formUse[id] || 0) < FORM_RANKS.need[r]) return;
  if ((G.waveTotal || 0) < (G.formSince[id] || 0) + FORM_RANKS.gap * (r + 1)) return;
  G.formRank = G.formRank || {};
  G.formRank[id] = r + 1;
  noteBestRank(id, r + 1);
  const nm = STANCES[id].name.split(' —')[0], pp = playerPos();
  floater(pp, nm + ' ' + FORM_RANKS.names[r + 1], '#ffd24a');
  burst(pp.clone().setY(1.6), 0xffd24a, 14, 5, 4);
  S.reward(r + 1 >= 3 ? 2 : 1);
  upToast(nm + ' · ' + FORM_RANKS.names[r + 1], m.lines.slice(0, 2).join(' · ') + ' · Force share ' + Math.round(forceShare(id) * 100) + '%', 'mast');
  formRankHook && formRankHook();
  noteFormRank();   // (rank XP for your profile: game/profile.js)
}
let formRankHook = null;   // the stance strip redraws its stars (player/jedi/stance.js)
export const onFormRank = (fn) => { formRankHook = fn; };

/* ---------------- skill points ---------------- */
// the story campaign: every XP_PER_POINT XP earned is a skill point, the one thing its upgrade page spends (powers
// come with the chapters, data/store.js). Survival (and the old level-by-level run) pays a point per wave cleared
// instead and keeps XP as a currency of its own (abilities and survival powers).
export const XP_PER_POINT = 500;
export const storyRun = () => G.chapter >= 0 && !G.training && !G.sandbox;
export function xpTowardPoint(){ return (G.xpEarned || 0) - (G.xpPoints || 0) * XP_PER_POINT; }
// progression.js gainXp, after every payout
export function xpPointCheck(){
  if (!storyRun() || G.mode !== 'play') return;
  const due = Math.floor((G.xpEarned || 0) / XP_PER_POINT);
  if (G.xpPoints == null) G.xpPoints = due;   // (a run saved before XP paid in points: start counting from here)
  if (due <= G.xpPoints) return;
  G.skillPoints = (G.skillPoints || 0) + (due - G.xpPoints);
  G.xpPoints = due;
  const sp = G.skillPoints;
  upToast(sp > 1 ? sp + ' SKILL POINTS READY' : 'SKILL POINT READY', 'Spend ' + (sp > 1 ? 'them' : 'it') + ' when the chapter ends', 'sp');
}
// one wave cleared: outside the story it pays a point (survival also owes a boon pick); everywhere it settles mastery
export function earnWavePoint(){
  if (!storyRun()) G.skillPoints = (G.skillPoints || 0) + 1;
  if (G.endless) G.boonsOwed = (G.boonsOwed || 0) + 1;
  settleMastery();
  return G.skillPoints;
}
// survival, between the pages: say what the clear earned
export function noteWavePoint(){
  if (storyRun()) return;
  const sp = G.skillPoints || 0;
  upToast(sp > 1 ? sp + ' SKILL POINTS READY' : 'SKILL POINT READY', !G.endless ? 'Spend ' + (sp > 1 ? 'them' : 'it') + ' when the area is cleared'
    : 'Spend ' + (sp > 1 ? 'them' : 'it') + ' after wave ' + (Math.ceil(((G.endlessWave || 0) + 1) / SURVIVAL_EVERY) * SURVIVAL_EVERY), 'sp');
}
// a fresh run
export function resetUpgrades(){ G.masteryUse = {}; G.xpPoints = 0; G.boonsOwed = 0; G.profClosed = {}; heldT = {}; }
