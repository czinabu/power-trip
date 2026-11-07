// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// GROUP CHOICES (co-op story choices, the way a party decides in an MMO's conversations): when the story asks a choice
// (game/choices.js: save the Ledger or burn it, spare Ilsa or strike her down, warn the batch…), every player gets the same
// card at the same time and picks on their own screen. Nobody sees what the others picked until everyone has: the card
// shows only who has chosen and who is still choosing. Once all picks are in, every screen shows every pick. If they all
// agree that's the story; if not, every player rolls 1-100 and the highest roll's pick wins (a tie rolls again).
// The winning pick is the story everyone plays on (G.story, saved by the host); each player's own pick still moves their
// own light and dark (game/alignment.js alignChoice, done by game/campaign.js the moment they click).
//
// The host runs the count: each guest sends its pick ('gpick'), the host tells everyone who has chosen ('gvs') and, once
// the last pick is in, the picks, the rolls and the winner ('gwin'). A player who leaves mid-vote is dropped from it. A
// guest whose host drops keeps its own pick. The host can go on without a guest that hasn't answered after a while (it
// may be stuck on another screen), so a run never hangs on a card.

import { G } from '../state.js';
import { answered, answer } from './choices.js';
import { net, on, send, sendTo, connected, guestSlots } from '../net/session.js';
import { nameOf, savedName } from '../net/names.js';
import { partnerHero } from '../net/partner.js';
import { busySeats } from '../net/waits.js';
import { seatCss } from '../ui/coop-marks.js';
import { svgIcon } from '../ui/icons.js';

const SKIP_AFTER = 30;   // s after the host's own pick before it may go on without a guest that hasn't answered
const AUTO_GO = 12;      // s the result stays up before the card moves on by itself (CONTINUE skips it)
const HERO_TAG = { jedi: 'JEDI', mando: 'MANDALORIAN', trooper: 'ARC TROOPER' };
const HERO_IC = { jedi: 'blade', mando: 'helm', trooper: 'scope' };
const BUSY_WORDS = { u: 'ON UPGRADES', p: 'NEW POWERS', c: 'FINISHING UP' };   // (net/waits.js)

// a choice is a group's when this screen is in a live co-op campaign
export const groupVote = () => connected() && net.status === 'connected' && (net.role === 'host' || !!G.coopGuest);

let V = null;               // this screen's vote: { id, ch, mine, paint, done, picked: Set, res, t0, timers }
const early = new Map();    // host: id -> Map(seat -> key), picks that arrived before this screen asked the choice
const decided = new Map();  // id -> { res, at }: a count just made, for a card that opens after it (a guest the host went on without)
const FRESH = 120000;       // ms a count is kept for that (a choice asked again later, a new run or New Game+, is a new vote)
const recent = (id) => { const d = decided.get(id); return d && performance.now() - d.at < FRESH ? d.res : null; };
const keep = (res) => decided.set(res.id, { res, at: performance.now() });

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const seatName = (k) => k === net.slot ? (savedName() || nameOf(k)).toUpperCase() : nameOf(k);
const seatHero = (k) => k === net.slot ? G.hero : partnerHero(k);
const optOf = (ch, key) => ch.options.find(o => o.key === key);
const valid = (ch, key) => typeof key === 'string' && !!optOf(ch, key);

// host: every seat in the room now
const seats = () => [0, ...guestSlots()];

/* ---------------- this screen's pick ---------------- */
// called once this player has clicked their pick on the choice card (game/campaign.js showChoice). paint(html, go) redraws the
// card; done(winner) runs once the result has been seen
export function castVote(ch, key, paint, done){
  clearVote();
  V = { id: ch.id, ch, mine: key, paint, done, votes: new Map(), picked: new Set([net.slot]), res: null, t0: performance.now(), timers: [] };
  if (net.role === 'host'){
    const pre = early.get(ch.id); early.delete(ch.id);
    if (pre) for (const [s, k] of pre) if (valid(ch, k)) V.votes.set(s, k);
    V.votes.set(0, key);
    V.timers.push(setTimeout(() => { if (V && !V.res) draw(); }, SKIP_AFTER * 1000 + 50));
    count();
  } else {
    send({ t: 'gpick', id: ch.id, k: key });
    const r = recent(ch.id);
    if (r) return void reveal(r);
  }
  draw();
}
// the host is asked a choice: guests' early picks for it are kept from here (nothing to do until the host picks)
export function openVote(id){ if (net.role !== 'host') return; decided.delete(id); if (!early.has(id)) early.set(id, new Map()); }

function clearVote(){ if (V) for (const t of V.timers) clearTimeout(t); V = null; }

/* ---------------- the host's count ---------------- */
function count(force = false){
  if (!V || V.res || net.role !== 'host') return;
  const now = seats();
  for (const s of [...V.votes.keys()]) if (!now.includes(s)) V.votes.delete(s);   // (gone: dropped from the vote)
  V.picked = new Set(V.votes.keys());
  const all = now.every(s => V.votes.has(s));
  if (!all && !force){ send({ t: 'gvs', id: V.id, s: now.map(s => [s, V.votes.has(s) ? 1 : 0]) }); draw(); return; }
  const picks = [...V.votes].sort((a, b) => a[0] - b[0]);
  const keys = new Set(picks.map(p => p[1]));
  let win = picks[0][1], rolls = null;
  if (keys.size > 1){
    rolls = new Map();
    let pool = picks.map(p => p[0]);
    for (let n = 0; n < 8 && pool.length > 1; n++){   // every player rolls; a tie at the top rolls again between them
      for (const s of pool) rolls.set(s, 1 + Math.floor(Math.random() * 100));
      const top = Math.max(...pool.map(s => rolls.get(s)));
      pool = pool.filter(s => rolls.get(s) === top);
    }
    win = V.votes.get(pool[0]);
  }
  const res = { id: V.id, k: win, picks: picks.map(([s, k]) => [s, k, rolls ? rolls.get(s) : 0]) };
  send({ t: 'gwin', ...res });
  reveal(res);
}

on('gpick', (m) => {
  if (net.role !== 'host' || m.from == null || typeof m.id !== 'string') return;
  if (!(V && V.id === m.id) && recent(m.id)) return void sendTo(m.from, { t: 'gwin', ...recent(m.id) });   // (counted already: tell them how it went)
  if (V && V.id === m.id){
    if (!V.res && valid(V.ch, m.k)){ V.votes.set(m.from, m.k); count(); }
    return;
  }
  if (answered(m.id)) return void sendTo(m.from, { t: 'gwin', id: m.id, k: answer(m.id), picks: [[0, answer(m.id), 0], [m.from, m.k, 0]] });   // (this run settled it already)
  if (typeof m.k === 'string') (early.get(m.id) || early.set(m.id, new Map()).get(m.id)).set(m.from, m.k);   // (checked when the host picks)
});
on('closed', (slot) => {
  if (net.role === 'host'){ if (V && !V.res) count(); return; }
  if (V && !V.res) reveal({ id: V.id, k: V.mine, picks: [[net.slot, V.mine, 0]], alone: true });   // the host is gone: this pick stands
});
// a guest that came in mid-vote is asked too, and waited for
on('open', (slot) => { if (net.role !== 'host' || !V || V.res) return; if (slot > 0) sendTo(slot, { t: 'ask', id: V.id }); count(); });

/* ---------------- a guest hears the count ---------------- */
on('ask', (m) => { if (net.role === 'guest' && typeof m.id === 'string') decided.delete(m.id); });   // (asked again: a new vote)
on('gvs', (m) => {
  if (net.role !== 'guest' || !V || V.res || m.id !== V.id || !Array.isArray(m.s)) return;
  V.picked = new Set(m.s.filter(x => Array.isArray(x) && x[1]).map(x => x[0]).filter(Number.isInteger));
  V.picked.add(net.slot);
  V.room = m.s.map(x => Array.isArray(x) ? x[0] : null).filter(s => Number.isInteger(s) && s >= 0 && s <= 3);
  draw();
});
on('gwin', (m) => {
  if (net.role !== 'guest' || typeof m.id !== 'string' || typeof m.k !== 'string' || !Array.isArray(m.picks)) return;
  const res = { id: m.id, k: m.k, picks: m.picks.filter(p => Array.isArray(p) && Number.isInteger(p[0]) && p[0] >= 0 && p[0] <= 3).slice(0, 4).map(p => [p[0], String(p[1] || ''), Number(p[2]) || 0]) };
  keep(res);
  if (V && V.id === m.id && !V.res) reveal(res);
});

/* ---------------- the card ---------------- */
// who is in the vote, as this screen knows it
function room(){
  if (net.role === 'host') return seats();
  return V.room && V.room.length ? V.room : [...new Set([0, net.slot])];
}
function row(s, right, cls){
  const h = seatHero(s);
  return '<li class="' + cls + '" style="--seat:' + seatCss(s) + '">' +
    '<i class="gv-ic">' + svgIcon(HERO_IC[h] || 'user') + '</i>' +
    '<span class="gv-who"><b>' + esc(seatName(s)) + '</b><small>' + (h ? HERO_TAG[h] || '' : '') + (s === 0 ? ' · HOST' : '') + (s === net.slot ? ' · YOU' : '') + '</small></span>' +
    '<span class="gv-st">' + right + '</span></li>';
}
const dots = '<i class="gv-dots"><i></i><i></i><i></i></i>';

// waiting on the others: who has chosen, who hasn't (never what they chose)
function draw(){
  if (!V || V.res) return;
  const busy = new Map(busySeats());
  const list = [...room()].sort((a, b) => a - b);
  const left = list.filter(s => !V.picked.has(s));
  const rows = list.map(s => V.picked.has(s) ? row(s, svgIcon('check') + 'CHOSEN', 'ok') : row(s, dots + (busy.get(s) && busy.get(s) !== 'c' ? BUSY_WORDS[busy.get(s)] : 'CHOOSING'), 'busy')).join('');
  const mine = optOf(V.ch, V.mine);
  const skip = net.role === 'host' && left.length && performance.now() - V.t0 > SKIP_AFTER * 1000;
  V.paint('<div class="cc-inner cc-choice cc-vote hero-' + esc(G.hero) + '">' +
    '<div class="cc-act">A GROUP CHOICE</div><h1 class="cc-title">' + esc(V.ch.title) + '</h1>' +
    '<div class="gv-mine">YOUR PICK<b>' + esc(mine ? mine.label : '') + '</b></div>' +
    '<p class="gv-line">' + (left.length === 1 ? 'Waiting for ' + esc(seatName(left[0])) + ' to choose.' : left.length ? 'Waiting for ' + left.length + ' players to choose.' : 'Everyone has chosen.') +
    ' Picks stay hidden until everyone is in. If you differ, everyone rolls and the highest roll decides the story.</p>' +
    '<ul class="gv-list">' + rows + '</ul>' +
    (skip ? '<div class="cc-btns"><div class="btn" data-go="skip">GO ON WITHOUT THEM</div></div>' : '') +
    '</div>', (k) => { if (k === 'skip' && V && !V.res && net.role === 'host') count(true); });
}

// everyone's picks, the rolls, and the story it comes to
function reveal(res){
  if (!V || V.res) return;
  V.res = res;
  if (net.role === 'host') keep(res);
  const win = optOf(V.ch, res.k);
  const rolled = res.picks.some(p => p[2] > 0);
  const top = rolled ? Math.max(...res.picks.map(p => p[2])) : 0;
  const rows = res.picks.map(([s, k, r]) => {
    const o = optOf(V.ch, k), won = k === res.k && (!rolled || r === top);
    return row(s, '<em class="gv-pick' + (o && o.side ? ' al-' + o.side : '') + '">' + esc(o ? o.label : '?') + '</em>' + (rolled ? '<span class="gv-roll">' + r + '</span>' : ''), won ? 'won' : 'ok');
  }).join('');
  const same = res.picks.length > 1 && res.picks.every(p => p[1] === res.k);
  const kicker = res.alone ? 'THE HOST HAS GONE · YOUR PICK STANDS' : same ? 'EVERYONE AGREED' : rolled ? 'THE ROLL DECIDES' : 'THE GROUP CHOSE';
  const yours = V.mine !== res.k && !res.alone ? '<p class="gv-note">Your own pick still counts for your own path.</p>' : '';
  let gone = false;
  const go = () => { if (gone || !V || V.res !== res) return; gone = true; const done = V.done; clearVote(); done(res.k); };
  V.paint('<div class="cc-inner cc-choice cc-vote hero-' + esc(G.hero) + '">' +
    '<div class="cc-act">' + esc(kicker) + '</div><h1 class="cc-title">' + esc(V.ch.title) + '</h1>' +
    '<ul class="gv-list gv-res">' + rows + '</ul>' +
    '<div class="gv-win' + (win && win.side ? ' al-' + win.side : '') + '"><small>THE STORY GOES ON</small><b>' + esc(win ? win.label : '') + '</b><span>' + esc(win ? win.line : '') + '</span></div>' +
    yours +
    '<div class="cc-btns"><div class="btn primary go" data-go="1">CONTINUE</div></div>' +
    '<div class="cc-hint">Enter or click to continue</div></div>', go);
  V.timers.push(setTimeout(go, AUTO_GO * 1000));
}

// test hooks (tools/smoke): the vote on this screen now
export const voteState = () => V ? { id: V.id, mine: V.mine, picked: [...V.picked], res: V.res } : null;
