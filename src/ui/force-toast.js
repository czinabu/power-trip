// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE FORCE LEVEL'S RISE (game/flow.js checkUnlocks): a reward beat that keeps out of the way. Nothing stops: a note comes
// up over the Force meter (the level, which powers grew, how much of it the form in hand channels), the LV badge and its
// new pip light up, a Force pulse runs out round the hero (fx/force-rise.js) and a swell plays (audio/force.js
// forceRise). It fades by itself. A level that hands over a power with its own card rides on that card instead (a strip
// across its top: ui/ability-card.js), and the pulse plays as that card closes.
//
// It waits for a lull: never over a line of dialogue (game/story.js), never mid-fight (no foe up or still to come, the
// hero out of combat: player/mobility.js), never under a screen (a card, a cutscene, the upgrade page, the pause menu).
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

export const FORCE_TOAST = { calm: 0.9, hold: 5.2, fade: 0.6 };   // s of quiet before it comes up · s it stays · s it fades over

let el = null, wait = null, calmT = 0, hideT = 0, goneT = 0;
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
  if (wait) r = { ...r, first: r.first || wait.first, grew: [...new Set([...wait.grew, ...r.grew])] };
  wait = r;
}
export function clearForceToast(){ wait = null; calmT = 0; hide(true); }
export const forceToastUp = () => !!(el && el.classList.contains('on'));

const lull = () => G.mode === 'play' && !G.paused && !G.skillSelect && !G.cardUp && !G.cutscene && !coopRun.holdPopups &&
  performance.now() >= (shared.unlockHold || 0) && !storySpeaking() && !commsShowing() &&
  !G.spawnQueue.length && !bossUp() && !enemies.some(e => !e.dead && !e.converted) && !inCombat();

// game/flow.js, every frame of play
let lastT = 0;
export function tickForceToast(){
  const now = performance.now(), dt = Math.min(0.25, (now - (lastT || now)) / 1000); lastT = now;   // (real time: a slow frame doesn't stretch the wait)
  if (G.mode !== 'play' && forceToastUp()) hide(true);   // (the menu, a death screen: it goes with the run)
  if (hideT && now > hideT) hide();
  if (goneT && now > goneT){ goneT = 0; if (el) el.classList.remove('on', 'out'); }
  if (!wait) return;
  calmT = lull() ? calmT + dt : 0;   // it has to stay quiet for a moment: not the instant a line or a foe is done
  if (calmT < FORCE_TOAST.calm) return;
  const r = wait; wait = null; calmT = 0;
  show(r);
}

function show(r){
  if (!el){
    el = document.createElement('div'); el.id = 'forcetoast';
    (document.getElementById('status') || document.body).appendChild(el);
  }
  el.innerHTML = '<div class="ft-glow"></div>' +
    '<div class="ft-k">' + (r.max ? 'THE FORCE AT ITS FULLEST' : 'THE FORCE GROWS') + '</div>' +
    '<div class="ft-t">FORCE LEVEL <b>' + r.lv + '</b></div>' +
    '<div class="ft-l">' + esc(growLine(r)) + '</div>' +
    (r.first ? '<div class="ft-x">' + esc(FIRST_LINE) + '</div>' : '') +
    formChip(r);
  el.classList.remove('on', 'out'); void el.offsetWidth;   // (restart its animation)
  el.classList.add('on');
  hideT = performance.now() + FORCE_TOAST.hold * 1000 + (r.first ? 1800 : 0); goneT = 0;
  celebrate(r);
}
function hide(now){
  hideT = 0;
  if (!el || !el.classList.contains('on')) return;
  if (now){ el.classList.remove('on', 'out'); return; }
  el.classList.add('out');
  goneT = performance.now() + FORCE_TOAST.fade * 1000;
}

// the pulse, the swell and the meter's badge: the rise felt, whether it came as this note or on a power's card
export function celebrate(r){
  try { forcePulse(r.blade); } catch(e){}
  S.forceRise();
  const m = document.getElementById('fpmeter');
  const pip = document.getElementById('fplvpips'), mine = pip && pip.children[r.lv - 1];
  if (m){ m.classList.remove('lvup'); void m.offsetWidth; m.classList.add('lvup'); }
  if (mine) mine.classList.add('new');
  setTimeout(() => { if (m) m.classList.remove('lvup'); if (mine) mine.classList.remove('new'); }, 2400);
}
