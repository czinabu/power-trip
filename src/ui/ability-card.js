// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ABILITY CARD: a small screen for each ability the run hands over (data/store.js JEDI_AUTO / MANDO_AUTO): its name and
// key, what it does, and a short looping clip of it in the game (data/ability-cards.js). It waits for whatever is in front
// of it (a chapter card, a cutscene, the upgrade screen, a meditation, the pause menu, and the Force Level's rise that
// brought it: ui/force-toast.js), freezes the fight while it is up the way those do, and closes on CONTINUE, Enter or Space.
//
// A CHOICE is the same card twice, side by side: a free pair of the store's (data/store.js `fork`, a chapter's pick in the
// story; the Mando's and the trooper's signature everywhere) offered by ui/store-ui.js openSkillTree. Each half is a power
// with its clip, its key and what it does; CHOOSE takes it and closes the other for the run. Nothing else closes it.

import { G, shared, isGunner } from '../state.js';
import { coopRun } from '../net/run.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { ABILITY_CARDS } from '../data/ability-cards.js';
import { forceToastHolds, fadeForceToast } from './force-toast.js';
import { storySpeaking, commsShowing } from '../game/story.js';
import { loadingNow } from './loading.js';
import { doorFading } from '../world/doorway.js';

const el = document.getElementById('abilitycard');
const pending = [];   // unlocks learned and not yet shown
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
// (an unlock can carry its own card: the Force Level's, game/flow.js forceLevelCard)
const cardOf = (u) => u.card || ABILITY_CARDS[u.key];
export const hasAbilityCard = (u) => !!cardOf(u);
export const abilityCardUp = () => el.classList.contains('open');

// any card still to show, or up now (a chapter's next scene waits for them: game/flow.js, net/waits.js)
export const abilityCardsPending = () => pending.length > 0 || abilityCardUp();
export const abilityChoicePending = () => pending.some(u => u.choice) || !!(shown && shown.choice);

export function queueAbilityCards(list){
  for (const u of list) if (cardOf(u) && !pending.includes(u)){
    pending.push(u);
    const c = cardOf(u).clip; if (c) new Image().src = c;   // start fetching its clip now, so it plays the moment the card opens
  }
}
// a choice of two (ui/store-ui.js): `pair` the two store nodes, `take(n)` hands the chosen one over, `still(n)` whether a
// half can still be had. A choice is queued when the upgrade page opens but shows only after it closes, so a pick made on
// the page in between (Vampiric Blade locks Force Mend) is checked again the moment the pop-up comes up (ripe below).
export function queueAbilityChoice(pair, take, still){
  if (pending.some(u => u.choice && u.choice[0] === pair[0])) return;
  pending.push({ choice: pair, take, still });
  for (const n of pair){ const c = cardOf({ key: n.id }); if (c && c.clip) new Image().src = c.clip; }
}
// game/flow.js, every frame of play: open once nothing else holds the screen
let talkAt = 0;   // when a choice began to wait on a line of dialogue alone
export function tickAbilityCards(){
  if (!pending.length || abilityCardUp() || G.mode !== 'play' || coopRun.holdPopups || G.paused || G.skillSelect || G.cardUp || G.cutscene || loadingNow() || doorFading() || performance.now() < (shared.unlockHold || 0)){ talkAt = 0; return; }   // (a chapter's close: after its CHAPTER COMPLETE beat, game/flow.js checkUnlocks)
  // never over a line of dialogue; but a choice holds the road on (game/flow.js), so a long talk lets it through after a while
  if (storySpeaking() || commsShowing()){ const now = performance.now(); talkAt = talkAt || now; if (!pending[0].choice || now - talkAt < 12000) return; }
  talkAt = 0;
  if (forceToastHolds()) return;   // the Force Level's rise comes up first, in play, with its pulse: then the power it brought
  fadeForceToast();
  const u = ripe(pending.shift());
  if (!u) return;
  if (u.choice) openChoice(u); else open(u);
}
// a choice as it stands now: both halves still open → the pop-up; one locked out since it was queued → the other is simply
// handed over with its own card (the run already closed the alternative); neither → nothing to show
function ripe(u){
  if (!u.choice || !u.still) return u;
  const left = u.choice.filter(n => { try { return u.still(n); } catch(e){ return true; } });
  if (left.length === 2) return u;
  if (left.length === 0) return null;
  try { u.take(left[0]); } catch(e){ console.error(e); }
  return cardOf({ key: left[0].id }) ? { key: left[0].id } : null;
}
// a new run, a load or the main menu: forget anything still waiting
export function clearAbilityCards(){ pending.length = 0; if (abilityCardUp()) close(true); }

function open(u){
  const C = cardOf(u), name = u.name || C.name, hud = u.hud != null ? u.hud : C.hud;
  el.innerHTML = '<div class="ac-inner hero-' + (isGunner() ? 'mando' : 'jedi') + '">' +
    (C.clip ? '<div class="ac-clip"><img src="' + C.clip + '" alt="" onerror="this.parentNode.remove()"></div>' : '') +   // (a card with no clip yet, or the page opened without its files: its words alone)
    '<div class="ac-body"><div class="cc-act">' + esc(C.kicker || 'ABILITY UNLOCKED') + '</div><h2 class="ac-title">' + esc(name) + '</h2>' +
    (hud ? '<div class="ac-key">' + esc(hud) + '</div>' : '') +
    C.lines.map(t => '<p>' + esc(t) + '</p>').join('') +
    (C.rows && C.rows.length ? '<ul class="ac-rows">' + C.rows.map(r => '<li>' + esc(r[0]) + '<span>' + esc(r[1]) + '</span></li>').join('') + '</ul>' : '') +
    '<div class="cc-btns"><div class="btn primary go" data-next="1">CONTINUE</div></div></div></div>';
  up(u);
}
function up(u){
  el.classList.add('open');
  shown = u;
  G.skillSelect = true; G.cardUp = true;   // freeze the fight and keep the pause screen away while the cursor is free
  document.exitPointerLock();
  MUSIC.unlockSting(); S.reward(1);
}
// the two halves of a choice: each a power's card (its clip, name, key and words) with its own CHOOSE
function openChoice(u){
  const half = (n, i) => {
    const C = cardOf({ key: n.id }) || { lines: [n.ds.replace(/<[^>]+>/g, '')] }, name = C.name || n.nm, hud = C.hud;
    return '<div class="acp-half" data-i="' + i + '">' +
      (C.clip ? '<div class="ac-clip"><img src="' + C.clip + '" alt="" onerror="this.parentNode.remove()"></div>' : '') +
      '<div class="ac-body"><h2 class="ac-title">' + esc(name) + '</h2>' + (hud ? '<div class="ac-key">' + esc(hud) + '</div>' : '') +
      C.lines.map(t => '<p>' + esc(t) + '</p>').join('') +
      '<div class="cc-btns"><div class="btn primary go" data-pick="' + i + '">CHOOSE</div></div></div></div>';
  };
  const kind = isGunner() ? (u.choice.some(n => n.tier >= 4) ? 'YOUR SIGNATURE' : 'NEW GEAR') : 'A NEW POWER';
  el.innerHTML = '<div class="ac-inner ac-pick hero-' + (isGunner() ? 'mando' : 'jedi') + '">' +
    '<div class="acp-head"><div class="cc-act">CHOOSE ONE</div><h2 class="ac-title">' + kind + '</h2>' +
    '<div class="acp-sub">Take one. The other closes for the rest of this run.</div></div>' +
    '<div class="acp-pair">' + half(u.choice[0], 0) + '<div class="acp-or">OR</div>' + half(u.choice[1], 1) + '</div></div>';
  hot = -1;
  up(u);
}
let shown = null, hot = -1;   // the card on screen · the half of a choice the keys have picked out
function pick(i){
  const u = shown; if (!u || !u.choice || !u.choice[i]) return;
  try { u.take(u.choice[i]); } catch(e){ console.error(e); }
  close();
}
function light(i){
  hot = i;
  for (const h of el.querySelectorAll('.acp-half')) h.classList.toggle('hot', +h.dataset.i === i);
}
function close(quiet){
  el.classList.remove('open');
  shown = null; hot = -1;
  G.cardUp = false;
  if (!document.getElementById('skilltree').style.display.includes('flex')) G.skillSelect = false;
  if (quiet) return;
  if (pending.length) return;
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}

el.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (!abilityCardUp()) return;
  const p = e.target.closest('[data-pick]');
  if (p) return void pick(+p.dataset.pick);
  if (e.target.closest('[data-next]')) close();
});

document.addEventListener('keydown', (e) => {
  if (!abilityCardUp()) return;
  const k = e.key.toLowerCase();
  if (shown && shown.choice){   // a choice never goes on a stray key (Space moves the talk on): arrows (or A / D) pick a half out, Enter takes it
    if (k === 'arrowleft' || k === 'a' || k === '1') light(0);
    else if (k === 'arrowright' || k === 'd' || k === '2') light(1);
    else if (k === 'enter' && hot >= 0) pick(hot);
    else if (k !== 'enter' && k !== ' ') return;
    e.preventDefault(); e.stopPropagation(); return;
  }
  if (k !== 'enter' && k !== ' ') return;
  e.preventDefault(); e.stopPropagation(); close();
}, true);

// the store hands over an ability (a pick, or a chapter's gift): its card waits for the store page to close
export const storeAbilityCard = (n) => queueAbilityCards([{ key: n.id }]);
