// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HUD STAGE: the boxes of words that share the screen, kept in their places and taking turns.
//
//  · PLACES: the voice in your ear (#comms) sits low in the middle, over the XP line (#xpmeter). The mission card (#tutor.drill:
//    a power's "try it now", the Chapter / Mission complete card) sits in the top-right column, under the objectives list
//    (#objlist) or the sandbox readout (#readout), out of the way of the hero and the fight. An objective's own task isn't a
//    card at all: it is on the objectives list already (game/mission.js say). Measured each beat, so the card follows the
//    list as it grows and shrinks, on every screen size
//  · ONE VOICE AT A TIME: a closing card is the chapter's last words. It waits for a line already on the strip to finish,
//    then the strip holds its next line until the card has been read (a line that cuts in still does: game/story.js asks
//    stageHolds; the calm's brisk exchange only waits for it to be up a moment: game/aftermath.js), and the upgrade screen waits
//    for it too, unless the hero has already walked out (finishCard) (game/flow.js, game/aftermath.js). A power's drill waits for the
//    strip to go quiet (game/tutorial.js)
//  · QUIET SIDES: while a closing card is up the form hint by the action bar stays down (body.stage-card, styles/hud.css)
//
// Every mode runs it: the mission card only appears in missions, campaign chapters and a run's power drills, the strip in any
// of them, and with neither up the boxes simply keep their own spots.

export const STAGE = {
  gap: 12,            // px between boxes
  waitMax: 4,         // s: the longest a closing card waits for a line already on the strip
  read: [4, 6.5],     // s: how long a closing card stays up (by how much it says: base + perChar, held to this range)
  base: 2, perChar: 0.03,
  briskAfter: 1.5,    // s: a brisk line (the calm's exchange: game/story.js) waits for the card this long once it's up, not its whole read
  every: 0.1,         // s: how often the boxes are measured (and at once whenever a card goes up)
  cardLow: 0.55,      // the card's top never goes lower than this share of the screen's height, however long the list above it
};

const $ = (id) => document.getElementById(id);
let els = null;
const boxes = () => els || (els = { xp: $('xpmeter'), tutor: $('tutor'), comms: $('comms'), above: ['objlist', 'readout', 'minimap'].map($).filter(Boolean) });

/* ---------- the closing card's turn ---------- */
let card = null;   // { show, hide, hold, wait, up }
export const readFor = (text) => Math.min(STAGE.read[1], Math.max(STAGE.read[0], STAGE.base + String(text || '').length * STAGE.perChar));
// show: puts the card up (called once its turn comes) · hide: takes it down once read · text: what it says (its read time)
export function stageCard(show, hide, text){
  dropCard();
  card = { show, hide, hold: readFor(text), wait: 0, up: false, upT: 0 };
}
// the hero has walked out (the calm's way on reached: game/aftermath.js): the card has had its turn, take it down now
export function finishCard(){ if (card){ const c = card; dropCard(); if (c.up) c.hide(); } }
// someone else took the card down or put another up (game/objectives.js): its turn is over
export function dropCard(){
  if (!card) return;
  card = null;
  document.body.classList.remove('stage-card');
}
// a closing card is waiting or up: the strip and the upgrade screen hold for it
export const stageHolds = () => !!card;
// the same for a brisk line: only until the card has been up a moment (STAGE.briskAfter)
export const stageHoldsBrisk = () => !!card && !(card.up && card.upT >= STAGE.briskAfter);

/* ---------- once a frame (main.js): dt is the sim's time (held while paused or on the upgrade screen) ---------- */
let measureT = 0;
export function updateHudStage(dt, playing){
  if (card && !playing){ const c = card; dropCard(); c.hide(); }   // (the menu, a victory screen: nothing waits behind them)
  if (card){
    if (!card.up){
      if (!boxes().comms.classList.contains('on') || (card.wait += dt) >= STAGE.waitMax){
        card.up = true; card.show();
        document.body.classList.add('stage-card');
        measureT = 0;
      }
    } else if ((card.upT += dt, card.hold -= dt) <= 0){ const c = card; dropCard(); c.hide(); }
  }
  if ((measureT -= Math.max(dt, 1 / 60)) <= 0){ measureT = STAGE.every; layout(); }
}

/* ---------- the places ---------- */
function setPx(el, prop, px){
  const v = px == null ? '' : Math.round(px) + 'px';
  if (el.style[prop] !== v) el.style[prop] = v;
}
export function layout(){
  const { xp, tutor, comms, above } = boxes(), H = innerHeight, W = innerWidth, gap = STAGE.gap;
  // the card: under whatever the top-right column already shows
  if (tutor.classList.contains('drill')){
    let top = 0, w = 0;
    for (const a of above){ const b = a.getBoundingClientRect(); if (b.height && getComputedStyle(a).opacity !== '0'){ top = Math.max(top, b.bottom); w = Math.max(w, b.width); } }
    setPx(tutor, 'top', Math.min(top ? top + gap : 44, H * STAGE.cardLow));
    setPx(tutor, 'width', w || null);   // as wide as the list it hangs under
  } else { setPx(tutor, 'top', null); setPx(tutor, 'width', null); }
  // the strip keeps its own spot (styles/hud.css) unless the XP line would reach it (a very short screen)
  const xr = xp.getBoundingClientRect(), floor = xr.height ? H - xr.top : 0, own = H * (W <= 620 ? 0.26 : 0.21);
  setPx(comms, 'bottom', floor + gap > own ? floor + gap : null);
}
