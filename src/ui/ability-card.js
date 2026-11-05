// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ABILITY CARD: a small screen for each ability the run hands over (data/store.js JEDI_AUTO / MANDO_AUTO): its name and
// key, what it does, and a short looping clip of it in the game (data/ability-cards.js). It waits for whatever is in front
// of it (a chapter card, a cutscene, the upgrade screen, a meditation, the pause menu), freezes the fight while it is up the
// way those do, and closes on CONTINUE, Enter or Space.

import { G, shared, isGunner } from '../state.js';
import { coopRun } from '../net/run.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { ABILITY_CARDS } from '../data/ability-cards.js';
import { growLine, formChip, FIRST_LINE, celebrate } from './force-toast.js';
import { storySpeaking, commsShowing } from '../game/story.js';

const el = document.getElementById('abilitycard');
const pending = [];   // unlocks learned and not yet shown
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
// (an unlock can carry its own card: the Force Level's, game/flow.js forceLevelCard)
const cardOf = (u) => u.card || ABILITY_CARDS[u.key];
export const hasAbilityCard = (u) => !!cardOf(u);
export const abilityCardUp = () => el.classList.contains('open');

export function queueAbilityCards(list){
  for (const u of list) if (cardOf(u) && !pending.includes(u)){
    pending.push(u);
    const c = cardOf(u).clip; if (c) new Image().src = c;   // start fetching its clip now, so it plays the moment the card opens
  }
}
// game/flow.js, every frame of play: open once nothing else holds the screen
export function tickAbilityCards(){
  if (!pending.length || abilityCardUp() || G.mode !== 'play' || coopRun.holdPopups || G.paused || G.skillSelect || G.cardUp || G.cutscene || performance.now() < (shared.unlockHold || 0) || storySpeaking() || commsShowing()) return;   // (a chapter's close: after its CHAPTER COMPLETE beat, game/flow.js checkUnlocks; never over a line of dialogue)
  open(pending.shift());
}
// a new run, a load or the main menu: forget anything still waiting
export function clearAbilityCards(){ pending.length = 0; if (abilityCardUp()) close(true); }

function open(u){
  const C = cardOf(u), name = u.name || C.name, hud = u.hud != null ? u.hud : C.hud;
  el.innerHTML = '<div class="ac-inner hero-' + (isGunner() ? 'mando' : 'jedi') + '">' +
    (C.clip ? '<div class="ac-clip"><img src="' + C.clip + '" alt="" onerror="this.parentNode.remove()"></div>' : '') +   // (a card with no clip yet, or the page opened without its files: its words alone)
    '<div class="ac-body">' + (u.forceUp ? forceStrip(u.forceUp) : '') + '<div class="cc-act">' + esc(C.kicker || 'ABILITY UNLOCKED') + '</div><h2 class="ac-title">' + esc(name) + '</h2>' +
    (hud ? '<div class="ac-key">' + esc(hud) + '</div>' : '') +
    C.lines.map(t => '<p>' + esc(t) + '</p>').join('') +
    (C.rows && C.rows.length ? '<ul class="ac-rows">' + C.rows.map(r => '<li>' + esc(r[0]) + '<span>' + esc(r[1]) + '</span></li>').join('') + '</ul>' : '') +
    '<div class="cc-btns"><div class="btn primary go" data-next="1">CONTINUE</div></div></div></div>';
  el.classList.add('open');
  shown = u;
  G.skillSelect = true; G.cardUp = true;   // freeze the fight and keep the pause screen away while the cursor is free
  document.exitPointerLock();
  MUSIC.unlockSting(); S.reward(1);
}
// the Force Level this power's chapter brought (game/flow.js checkUnlocks): a strip across the top of its card
const forceStrip = (r) => '<div class="ac-force"><div class="acf-h"><span>' + (r.max ? 'THE FORCE AT ITS FULLEST' : 'THE FORCE GROWS') + '</span><b>FORCE LEVEL ' + r.lv + '</b></div>' +
  '<div class="acf-l">' + esc(growLine(r)) + formChip(r) + '</div>' + (r.first ? '<div class="acf-x">' + esc(FIRST_LINE) + '</div>' : '') + '</div>';
let shown = null;
function close(quiet){
  el.classList.remove('open');
  const was = shown; shown = null;
  if (!quiet && was && was.forceUp) celebrate(was.forceUp);   // back in play: the rise's Force pulse round the hero (ui/force-toast.js)
  G.cardUp = false;
  if (!document.getElementById('skilltree').style.display.includes('flex')) G.skillSelect = false;
  if (quiet) return;
  if (pending.length) return;
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}

el.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (abilityCardUp() && e.target.closest('[data-next]')) close();
});
document.addEventListener('keydown', (e) => {
  if (!abilityCardUp() || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault(); e.stopPropagation(); close();
}, true);

// the store hands over an ability (a pick, or a chapter's gift): its card waits for the store page to close
export const storeAbilityCard = (n) => queueAbilityCards([{ key: n.id }]);
