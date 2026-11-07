// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WAITING SCREEN between two chapters. Walking a chapter's way on fades the screen to black (world/doorway.js), and it
// stays dark until the next chapter's arena is built. In co-op that can be a while: the run moves on only once every
// hero has closed their upgrade page (game/flow.js holdForPicks), so whoever finished first used to sit on a black screen.
// Now the dark carries a card in this hero's own look (styles/heroes/waiting.css): who the run is waiting for, each
// player's state, and the chapter that comes next. Alone it's the short beat before the next chapter, with its name.
// Only on the dark itself: the upgrade page, a pop-up (a new power, a learned form, a found gun), a briefing, a cutscene,
// the pause screen or the loader sit over it.

import { G } from '../state.js';
import { doorDark } from '../world/doorway.js';
import { loadingNow } from './loading.js';
import { abilityCardUp } from './ability-card.js';
import { chapterAt, chapterTitle } from '../game/campaign.js';
import { actTwoAt } from '../data/campaign.js';
import { net, connected } from '../net/session.js';
import { nameOf, savedName, seatsHeard } from '../net/names.js';
import { partnerHero } from '../net/partner.js';
import { busySeats } from '../net/waits.js';
import { seatCss } from './coop-marks.js';
import { svgIcon } from './icons.js';

const SHOW_AFTER = 0.35;   // s of dark before the card comes up (the upgrade page usually opens in that beat: no flash between)
const HERO_TAG = { jedi: 'JEDI', mando: 'MANDALORIAN', trooper: 'ARC TROOPER' };
const HERO_IC = { jedi: 'blade', mando: 'helm', trooper: 'scope' };
const STATE_WORDS = { u: 'CHOOSING UPGRADES', p: 'NEW POWERS', c: 'FINISHING UP' };   // (net/waits.js)

let el = null, held = 0, shownKey = '';
function box(){
  if (el) return el;
  el = document.createElement('div');
  el.id = 'waitscreen';
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  return el;
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const seatName = (k) => k === net.slot ? (savedName() || nameOf(k)).toUpperCase() : nameOf(k);
const seatHero = (k) => k === net.slot ? G.hero : partnerHero(k);

// the chapter the run walks into next (not named while Act II's pick is still to come)
function nextName(){
  const pos = G.chapter + 1;
  if (pos === actTwoAt() && !G.actTwo) return '';
  const c = chapterAt(pos);
  return c ? chapterTitle(c) : '';
}

// what the card says now: { key, html }
function content(){
  const coop = connected() && net.status === 'connected';
  const busy = new Map(coop ? busySeats() : []), others = [...busy.keys()].filter(k => k !== net.slot);
  const title = !coop ? 'ONWARD' : others.length === 1 ? 'WAITING FOR ' + seatName(others[0]) : others.length ? 'WAITING FOR ' + others.length + ' PLAYERS' : 'MOVING ON';
  const line = !coop ? 'The next chapter is on its way.' : others.length ? 'The next chapter starts once everyone has picked their upgrades and seen their new powers.' : 'Everyone is ready. The next chapter is on its way.';
  const next = nextName();
  const seats = coop ? [...new Set([net.slot, 0, ...seatsHeard()])].filter(k => Number.isInteger(k)).sort() : [];
  const rows = seats.map(k => {
    const st = busy.get(k), b = !!st, h = seatHero(k);
    return '<li class="' + (b ? 'busy' : 'ok') + '" style="--seat:' + seatCss(k) + '">' +
      '<i class="ws-ic">' + svgIcon(HERO_IC[h] || 'user') + '</i>' +
      '<span class="ws-who"><b>' + esc(seatName(k)) + '</b><small>' + (h ? HERO_TAG[h] || '' : '') + (k === 0 ? ' · HOST' : '') + (k === net.slot ? ' · YOU' : '') + '</small></span>' +
      '<span class="ws-st">' + (b ? '<i class="ws-dots"><i></i><i></i><i></i></i>' + (STATE_WORDS[st] || STATE_WORDS.c) : svgIcon('check') + 'READY') + '</span></li>';
  }).join('');
  const key = [G.hero, title, line, next, rows].join('|');
  return { key, html: '<div class="ws-card hero-' + esc(G.hero) + '">' +
    '<div class="ws-k">BETWEEN CHAPTERS</div>' +
    '<h2 class="ws-t">' + esc(title) + '</h2>' +
    '<div class="ws-rule"><i></i></div>' +
    '<p class="ws-l">' + esc(line) + '</p>' +
    (rows ? '<ul class="ws-list">' + rows + '</ul>' : '') +
    (next ? '<div class="ws-next"><span>NEXT</span>' + esc(next) + '</div>' : '') +
    '<div class="ws-bar"><i></i></div>' +
    '</div>' };
}

// once a frame (main.js), on real time: the sim may be held while this screen waits
export function updateWaiting(rawDt){
  const dark = G.mode === 'play' && G.chapter >= 0 && doorDark();
  const covered = G.cardUp || G.skillSelect || G.cutscene || G.paused || loadingNow() || abilityCardUp();
  held = dark && !covered ? held + rawDt : 0;
  const on = held >= SHOW_AFTER;
  if (!on){
    if (el && el.classList.contains('on')){ el.classList.remove('on'); shownKey = ''; }
    return;
  }
  const b = box(), c = content();
  if (c.key !== shownKey){ shownKey = c.key; b.innerHTML = c.html; }
  if (!b.classList.contains('on')) b.classList.add('on');
}
export const waitingUp = () => !!el && el.classList.contains('on');
