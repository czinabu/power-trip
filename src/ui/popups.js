// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ONE POP-UP AT A TIME. A player can only take in one thing at once, so every small pop-up in play (the corner notes:
// a skill point, a power mastered, a rank or a piece earned, a first-sighting foe tip; the codex note) goes through
// this one queue, which shows them one after another in their own spot, never two together, and never under a
// centre banner or the Force Level's rise.
//
// The order, most urgent first:
//   1. a centre banner (ui/banners.js: an objective, a twist, a boss, a warning) shows at once; a note up under it goes
//   2. 'info': a foe tip (what this new foe does) comes up as soon as the slot is free, even mid-fight
//   3. 'reward': a skill point, a mastery, an unlock, the codex note waits for a lull (out of combat, nobody talking), up to
//      POPUPS.maxWait s, and repeats merge into one (three codex entries are one "3 new entries")
// The Force Level's rise (ui/force-toast.js) waits for the slot too, and holds the queue while it is up.
//
// Every mode: the queue runs on a timer, not the play loop, so the sandbox, training, survival, the hub, missions and each
// co-op screen (for its own notes) all keep the rule.

import { G } from '../state.js';

export const POPUPS = { gap: 0.6, maxWait: 20, bannerHold: 5, recut: 2, tick: 100 };   // s between one note and the next · s a reward waits for a lull at most · s a banner holds the queue at most · a note cut by a banner sooner than this (s) shows again after it · ms per check

const Q = [];
let cur = null, freeAt = 0;
// what holds the queue: a centre banner up (ui/banners.js), the Force Level's rise up (ui/force-toast.js), a screen over
// play (a card, the pause menu, a cutscene, the upgrade page); and what a reward waits for: a lull (no fight, no talk)
// (when the banner last came up: ui/banners.js sets it; the lull is set by ui/force-toast.js, which has the fight and the talk to hand)
export const bannerAt = { t: -1e9 };
const shown = (id) => { const el = document.getElementById(id); return !!el && el.style.opacity !== '' && +el.style.opacity > 0.05; };
export const popupHooks = {
  bannerUp: () => shown('banner') && performance.now() - bannerAt.t < POPUPS.bannerHold * 1000,   // (a banner that stays up, a hold's count, stops holding after a while)
  riseUp: () => { const el = document.getElementById('forcetoast'); return !!el && el.classList.contains('on'); },
  screen: () => G.mode !== 'play' || G.paused || G.cardUp || !!G.cutscene || G.skillSelect,
  lull: () => true,
};

export const popupUp = () => !!cur;
// a note waiting to show (for the Force Level's rise: it lets a waiting reward go first only if it is already up)
export const popupsWaiting = () => Q.length;

// push(item): { kind: 'info'|'reward', key, show() -> hide(), dur (s), merge(older, newer) -> merged item }
export function pushPopup(item){
  item.t = performance.now();
  if (item.key){
    const same = Q.find(q => q.key === item.key);
    if (same){ const m = item.merge ? item.merge(same, item) : item; Object.assign(same, m, { t: same.t }); return; }
  }
  Q.push(item);
  tick();
}

// a centre banner came up: the note under it goes (the banner is the one thing to read now)
// (a note cut in its first moments goes back to the front of the queue, so a skill point is never missed for a banner)
export function popupYield(){
  if (!cur) return;
  const now = performance.now();
  cur.hide();
  if (now - cur.at < POPUPS.recut * 1000 && !Q.some(q => q.key && q.key === cur.item.key)) Q.unshift(cur.item);
  cur = null; freeAt = now + POPUPS.gap * 1000;
}

function pick(now){
  // info first (it is about the fight in hand), then the oldest reward that has its lull (or has waited long enough)
  const info = Q.findIndex(q => q.kind === 'info');
  if (info >= 0) return info;
  return Q.findIndex(q => popupHooks.lull() || now - q.t > POPUPS.maxWait * 1000);
}

function tick(){
  const now = performance.now();
  if (cur && now >= cur.end){ cur.hide(); cur = null; freeAt = now + POPUPS.gap * 1000; }
  if (cur || !Q.length || now < freeAt) return;
  if (popupHooks.bannerUp() || popupHooks.riseUp() || popupHooks.screen()) return;
  const i = pick(now);
  if (i < 0) return;
  const it = Q.splice(i, 1)[0];
  const hide = it.show() || (() => {});
  cur = { hide, item: it, at: now, end: now + (it.dur || 4) * 1000 };
}
setInterval(tick, POPUPS.tick);

// leaving play for the menu: nothing waiting carries into the next run
export function clearPopups(){ Q.length = 0; if (cur){ cur.hide(); cur = null; } }
setInterval(() => { if (G.mode === 'menu' && (Q.length || cur)) clearPopups(); }, 500);
