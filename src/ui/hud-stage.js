// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HUD STAGE: the words on the lower middle of the screen, kept in one column and taking turns.
//
// Three boxes share that spot, bottom up: the XP line (#xpmeter), the mission card (#tutor.drill: an objective's task, or
// the Chapter / Mission complete card) and the voice in your ear (#comms). Before this they each had their own fixed spot
// and their own clock, so the end of a chapter could put a voice line, the closing card, the form hint and the XP line on
// screen at once. The rules now:
//
//  · ONE COLUMN: each box sits a set gap above the one under it, and the card also rises clear of the vitals, the squad
//    list and the action bar when the screen is too narrow for them to sit side by side (measured each beat, so it holds
//    for every hero's action bar and every screen size, not guessed per width)
//  · ONE VOICE AT A TIME: a closing card is the chapter's last words. It waits for a line already on the strip to finish,
//    then the strip holds its next line until the card has been read (a line that cuts in still does: game/story.js asks
//    stageHolds), and the upgrade screen waits for it too (game/flow.js, game/aftermath.js). An objective's line that comes
//    while the strip is talking joins the strip instead of sitting in the card under it (game/mission.js say)
//  · QUIET SIDES: while a closing card is up the form hint by the action bar stays down (body.stage-card, styles/hud.css)
//
// Every mode runs it: the mission card only appears in missions and campaign chapters, the strip in any of them, and with
// neither up the column simply leaves the boxes on their own spots.

export const STAGE = {
  gap: 12,            // px between boxes in the column
  waitMax: 4,         // s: the longest a closing card waits for a line already on the strip
  read: [5, 8],       // s: how long a closing card stays up (by how much it says: base + perChar, held to this range)
  base: 2.4, perChar: 0.035,
  every: 0.1,         // s: how often the column is measured (and at once whenever a card goes up)
  cardTop: 0.42,      // the card never rises past this share of the screen's height, however tall the side boxes are
};

const $ = (id) => document.getElementById(id);
let els = null;
const boxes = () => els || (els = { xp: $('xpmeter'), tutor: $('tutor'), comms: $('comms'), sides: ['status', 'actionbar', 'squadhud'].map($).filter(Boolean) });

/* ---------- the closing card's turn ---------- */
let card = null;   // { show, hide, hold, wait, up }
export const readFor = (text) => Math.min(STAGE.read[1], Math.max(STAGE.read[0], STAGE.base + String(text || '').length * STAGE.perChar));
// show: puts the card up (called once its turn comes) · hide: takes it down once read · text: what it says (its read time)
export function stageCard(show, hide, text){
  dropCard();
  card = { show, hide, hold: readFor(text), wait: 0, up: false };
}
// someone else took the card down or put another up (game/objectives.js): its turn is over
export function dropCard(){
  if (!card) return;
  card = null;
  document.body.classList.remove('stage-card');
}
// a closing card is waiting or up: the strip and the upgrade screen hold for it
export const stageHolds = () => !!card;

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
    } else if ((card.hold -= dt) <= 0){ const c = card; dropCard(); c.hide(); }
  }
  if ((measureT -= Math.max(dt, 1 / 60)) <= 0){ measureT = STAGE.every; layout(); }
}

/* ---------- the column ---------- */
function setBottom(el, px){
  const v = px == null ? '' : Math.round(px) + 'px';
  if (el.style.bottom !== v) el.style.bottom = v;
}
export function layout(){
  const { xp, tutor, comms, sides } = boxes(), H = innerHeight, W = innerWidth, gap = STAGE.gap;
  let floor = 0;   // px up from the screen's foot that the column has used so far
  const xr = xp.getBoundingClientRect();
  if (xr.height) floor = H - xr.top;
  if (tutor.classList.contains('drill')){
    const w = tutor.offsetWidth, l = (W - w) / 2, r = l + w;
    let f = floor;
    for (const s of sides){
      const b = s.getBoundingClientRect();
      if (b.height && b.left < r + gap && b.right > l - gap) f = Math.max(f, H - b.top);   // it would sit on top of them: rise clear
    }
    const at = Math.min(f + gap, H * STAGE.cardTop - tutor.offsetHeight);
    setBottom(tutor, Math.max(at, floor + gap));
    if (tutor.classList.contains('on')) floor = Math.max(at, floor + gap) + tutor.offsetHeight;
  } else setBottom(tutor, null);
  // the strip keeps its own spot (styles/hud.css) unless something in the column reaches it
  const own = H * (W <= 620 ? 0.26 : 0.21);
  setBottom(comms, floor + gap > own ? floor + gap : null);
}
