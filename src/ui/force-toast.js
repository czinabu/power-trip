// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE FORCE LEVEL'S RISE (game/flow.js checkUnlocks): a reward beat in play. Nothing stops: FORCE LEVEL N comes up across
// the middle of the screen (which powers grew, how much of it the form in hand channels) the moment a Force pulse runs out
// round the hero (fx/force-rise.js) and a swell plays (audio/force.js forceRise); the LV badge and its new pip light up.
// It fades by itself. A level that also hands over a power (`lead`) is followed by that power's own card
// (ui/ability-card.js waits on forceToastHolds): the rise first, felt in the world, then the power.
//
// It never comes up under a screen (a card, a cutscene, the upgrade page, the pause menu, a loading screen, the fade into
// the next chapter). A chapter's rise (`lead`) comes up the moment the cutscene hands the hero back, over the walk-off
// talk; a lone rise (survival) waits for a lull: no line of dialogue (game/story.js), no foe up or still to come, the hero
// out of combat (player/mobility.js).
// The first rise of a run says once, in a line, what the Force Level is; later ones list only what grew.
//
// Every mode that climbs the level: the story (solo, and each co-op screen for its own hero: coopRun.holdPopups holds it
// through a shared fight), survival. The training grounds, the sandbox and a lone mission set the level up front: no beat.

import { G, shared, enemies, bossUp } from '../state.js';
import { coopRun } from '../net/run.js';
import { storySpeaking, commsShowing } from '../game/story.js';
import { inCombat } from '../player/mobility.js';
import { S } from '../audio/sfx.js';
import { forcePulse } from '../fx/force-rise.js';
import { loadingNow } from './loading.js';
import { doorState } from '../world/doorway.js';

export const FORCE_TOAST = { calm: 0.9, calmLead: 0.35, hold: 5.2, fade: 0.6, lead: 2.6 };   // s of quiet before it comes up (one that leads: s after the cutscene) · s it stays · s it fades over · s before the power it brought opens its card

let el = null, wait = null, calmT = 0, hideT = 0, goneT = 0, leadT = 0;
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const hex = (c) => '#' + ('000000' + (c >>> 0).toString(16)).slice(-6);
// 'Push, Strikes and Jump & Dash'
const list = (a) => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
export const growLine = (r) => r.grew.length ? list(r.grew) + (r.grew.length > 1 ? ' grow' : ' grows') + ' stronger' : 'Your powers grow stronger';
export const FIRST_LINE = 'Your Force Level climbs with the story: the powers you hold hit harder and cost less.';
// the form chip: its blade colour, and how much of the level it channels
export const formChip = (r) => r.form ? '<span class="ft-form" style="--c:' + hex(r.blade) + '"><i></i>' + esc(r.form) + ' channels <b>' + r.share + '%</b></span>' : '';

// a rise is waiting: two before the first is shown fold into one (the higher level, and everything either grew)
export function queueForceToast(r){
  if (wait) r = { ...r, first: r.first || wait.first, lead: r.lead || wait.lead, grew: [...new Set([...wait.grew, ...r.grew])] };
  wait = r;
}
export function clearForceToast(){ wait = null; calmT = 0; leadT = 0; hide(true); }
export const forceToastUp = () => !!(el && el.classList.contains('on'));
// ui/ability-card.js: a power's card holds while the rise that brought it is still to come, or has only just come up
export const forceToastHolds = () => !!(wait && wait.lead) || (forceToastUp() && performance.now() < leadT);
// a card opened over it: it goes
export const fadeForceToast = () => { leadT = 0; hide(); };

// the hero is on screen and in hand: no screen over it, no cutscene, no loading screen or fade to the next chapter
const inPlay = () => G.mode === 'play' && !G.paused && !G.skillSelect && !G.cardUp && !G.cutscene && !coopRun.holdPopups &&
  !loadingNow() && doorState() < 2 && performance.now() >= (shared.unlockHold || 0);
// a rise that leads (a chapter's close) comes up the moment the cutscene hands the hero back, over the walk-off talk;
// a lone one waits for the talk and the fight to be done
const lull = () => inPlay() && (wait.lead ||
  (!storySpeaking() && !commsShowing() && !G.spawnQueue.length && !bossUp() && !enemies.some(e => !e.dead && !e.converted) && !inCombat()));

// game/flow.js, every frame of play
let lastT = 0;
export function tickForceToast(){
  const now = performance.now(), dt = Math.min(0.25, (now - (lastT || now)) / 1000); lastT = now;   // (real time: a slow frame doesn't stretch the wait)
  if ((G.mode !== 'play' || loadingNow() || doorState() >= 2) && forceToastUp()) hide(true);   // (the menu, a death screen, a loading screen or the fade into the next chapter: it goes)
  if (hideT && now > hideT) hide();
  if (goneT && now > goneT){ goneT = 0; if (el) el.classList.remove('on', 'out'); }
  if (!wait) return;
  calmT = lull() ? calmT + dt : 0;   // it has to stay quiet for a moment: not the instant a line or a foe is done
  if (calmT < (wait.lead ? FORCE_TOAST.calmLead : FORCE_TOAST.calm)) return;
  const r = wait; wait = null; calmT = 0;
  show(r);
}

function show(r){
  if (!el){
    el = document.createElement('div'); el.id = 'forcetoast';
    document.body.appendChild(el);   // (not in the HUD: a talk on the set hides that, and the rise still shows)
  }
  el.innerHTML = '<div class="ft-glow"></div><div class="ft-rays"></div>' +
    '<div class="ft-k">' + (r.max ? 'THE FORCE AT ITS FULLEST' : 'THE FORCE GROWS') + '</div>' +
    '<div class="ft-t">FORCE LEVEL <b>' + r.lv + '</b></div><div class="ft-rule"></div>' +
    '<div class="ft-l">' + esc(growLine(r)) + '</div>' +
    formChip(r) +
    (r.first ? '<div class="ft-x">' + esc(FIRST_LINE) + '</div>' : '');
  el.classList.remove('on', 'out'); void el.offsetWidth;   // (restart its animation)
  el.classList.add('on');
  hideT = performance.now() + FORCE_TOAST.hold * 1000 + (r.first ? 1800 : 0); goneT = 0;
  leadT = r.lead ? performance.now() + FORCE_TOAST.lead * 1000 + (r.first ? 1200 : 0) : 0;
  celebrate(r);
}
function hide(now){
  hideT = 0;
  if (!el || !el.classList.contains('on')) return;
  if (now){ el.classList.remove('on', 'out'); return; }
  el.classList.add('out');
  goneT = performance.now() + FORCE_TOAST.fade * 1000;
}

// the pulse, the swell and the meter's badge: the rise felt, as the note comes up
function celebrate(r){
  try { forcePulse(r.blade); } catch(e){}
  S.forceRise();
  const m = document.getElementById('fpmeter');
  const pip = document.getElementById('fplvpips'), mine = pip && pip.children[r.lv - 1];
  if (m){ m.classList.remove('lvup'); void m.offsetWidth; m.classList.add('lvup'); }
  if (mine) mine.classList.add('new');
  setTimeout(() => { if (m) m.classList.remove('lvup'); if (mine) mine.classList.remove('new'); }, 2400);
}
