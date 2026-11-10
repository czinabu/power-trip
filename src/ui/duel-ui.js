// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL MODE on screen (game/duel-mode.js runs the match): the walk-up prompt (F · CHALLENGE), the cards (the challenge
// with its rule picker, the one the challenged player answers, the score card with REMATCH, the trophy hall's DUEL
// HONOURS), and the score bar over the fight that fighters and spectators both see, with each side's link.
// Cards use the hub panel's look (styles/hub.css .hb-box) and take tap, click or a pad (anything with a pointer cursor).

import { G, shared } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { onInteract, INTERACT_KEY } from '../game/interact.js';
import { DUEL_MODE } from '../data/duel-mode.js';
import { S } from '../audio/sfx.js';
import { net } from '../net/session.js';
import { nameOf } from '../net/names.js';
import { challengeable, challenge, answer, rematch, leaveDuel, duelState, setDuelUi, honours, incomingChallenge, RULES } from '../game/duel-mode.js';
import { pvpLinkMs, pvpIncoming } from '../net/pvp.js';

const D = DUEL_MODE;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const el = (id, tag = 'div', cls = '') => { let e = document.getElementById(id); if (!e){ e = document.createElement(tag); e.id = id; if (cls) e.className = cls; document.body.appendChild(e); } return e; };
const panel = el('duelpanel'), hud = el('duelhud'), prompt = el('duelp'), cue = el('duelcue');
cue.innerHTML = '<i class="dc-R"></i><i class="dc-L"></i><i class="dc-H"></i><i class="dc-Lo"></i><i class="dc-T"></i>';
const linkCls = (ms) => ms > D.lag.poor ? 'poor' : ms > D.lag.poor * 0.6 ? 'fair' : 'good';
const linkWord = (ms) => ms > D.lag.poor ? 'POOR LINK' : ms > D.lag.poor * 0.6 ? 'FAIR LINK' : 'GOOD LINK';

/* ---------------- the cards ---------------- */
let kind = null, data = null, pick = D.defaultRule;
function open(k, d){
  kind = k; data = d;
  render();
  if (!panel.classList.contains('open')){
    panel.classList.add('open');
    G.skillSelect = true; G.sbMenu = true;   // holds this screen still and frees the cursor while it's up (as the hub's panels do)
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
function close(relock = true){
  if (!panel.classList.contains('open')) return;
  panel.classList.remove('open'); kind = null; data = null;
  G.skillSelect = false; G.sbMenu = false;
  if (relock && G.mode === 'play' && !shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}
setDuelUi(open, close);
export const duelCardOpen = () => panel.classList.contains('open');
export const duelCardKind = () => kind;

const btn = (label, sub, act, extra = '') => '<div class="hb-o dl-o ' + extra + '" data-a="' + act + '"><b>' + esc(label) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
function render(){
  let h = '';
  if (kind === 'challenge'){
    const link = data.link;
    h = head('DUEL', 'CHALLENGE ' + data.name, 'Best of 3 rounds. Both fighters are levelled: same base numbers, push and pull only. Your forms and your saber stay yours.') +
      '<div class="dl-rules">' + Object.entries(RULES).map(([id, R]) => btn(R.name, R.line, 'rule:' + id, id === pick ? 'on' : '')).join('') + '</div>' +
      linkLine(link) +
      '<div class="dl-row">' + btn('SEND CHALLENGE', '', 'send', 'go') + btn('CANCEL', '', 'x') + '</div>';
  } else if (kind === 'incoming'){
    const R = RULES[data.rule];
    h = head('A CHALLENGE', data.name + ' CHALLENGES YOU', R.name + ': ' + R.line + '. Best of 3 rounds, both fighters levelled.') + linkLine(data.link) +
      '<div class="dl-row">' + btn('ACCEPT', '', 'yes', 'go') + btn('DECLINE', '', 'no') + '</div>';
  } else if (kind === 'over'){
    const v = data, won = v.champ === v.me;
    const rec = v.record ? 'Against ' + v.them + ': ' + v.record.w + ' won · ' + v.record.l + ' lost' : '';
    const waiting = v.pvp && v.meReady ? 'Waiting for ' + v.them + '…' : v.pvp && v.ready.length ? v.them + ' wants a rematch' : '';
    h = head(RULES[v.rule].name, won ? 'VICTORY' : 'DEFEAT', '') +
      '<div class="dl-score"><span>' + esc(v.names[0]) + '</span><b>' + v.rounds[0] + ' – ' + v.rounds[1] + '</b><span>' + esc(v.names[1]) + '</span></div>' +
      (rec ? '<div class="hb-d">' + esc(rec) + '</div>' : '') +
      (waiting ? '<div class="hb-party">' + esc(waiting) + '</div>' : '') +
      '<div class="dl-row">' + btn(v.meReady ? 'READY' : 'REMATCH', '', v.meReady ? 'noop' : 'again', 'go' + (v.meReady ? ' wait' : '')) + btn('LEAVE THE RING', '', 'leave') + '</div>';
  } else if (kind === 'honours'){
    const rows = Object.entries(honours()).sort((a, b) => (b[1].w - a[1].w) || (b[1].at || 0) - (a[1].at || 0));
    h = head('THE TROPHY HALL', 'DUEL HONOURS', 'Every duel you have fought against a friend, by their name.') +
      '<div class="dl-hon">' + (rows.length ? rows.map(([n, r]) => '<div class="dl-hr"><b>' + esc(n) + '</b><span>' + r.w + ' WON</span><span>' + r.l + ' LOST</span></div>').join('')
        : '<div class="hb-d">No duels yet. Challenge a friend in the training wing.</div>') + '</div>' +
      '<div class="dl-row">' + btn('CLOSE', '', 'x') + '</div>';
  }
  panel.innerHTML = '<div class="hb-box dl-box dl-' + kind + '">' + h + '</div>';
}
const head = (k, t, d) => '<div class="hb-k">' + esc(k) + '</div><div class="hb-t">' + esc(t) + '</div>' + (d ? '<div class="hb-d">' + esc(d) + '</div>' : '');
const linkLine = (ms) => '<div class="dl-link ' + linkCls(ms) + '">' + linkWord(ms) + ' · ' + Math.round(ms) + ' MS' +
  (ms > D.lag.poor ? '<i>The parry window widens a little for both of you on this link.</i>' : '') + '</div>';

panel.addEventListener('click', (e) => {
  e.stopPropagation();
  const o = e.target.closest('[data-a]');
  if (!o){ if (e.target === panel && (kind === 'honours' || kind === 'challenge')) close(); return; }
  const a = o.dataset.a;
  S.uiHover && S.uiHover();
  if (a.startsWith('rule:')){ pick = a.slice(5); render(); return; }
  if (a === 'send'){ const d = data; close(); challenge(d.slot, pick); return; }
  if (a === 'x'){ close(); return; }
  if (a === 'yes'){ close(); answer(true); return; }
  if (a === 'no'){ close(); answer(false); return; }
  if (a === 'again'){ rematch(); return; }
  if (a === 'leave'){ close(); leaveDuel(); return; }
});
document.addEventListener('keydown', (e) => {
  if (!duelCardOpen() || (e.key !== 'Escape' && e.key !== 'Tab')) return;
  e.preventDefault(); e.stopPropagation();
  if (kind === 'incoming'){ close(); answer(false); } else if (kind === 'over'){ close(); leaveDuel(); } else close();
}, true);

// from the DUEL RING station (ui/hub-ui.js), or walking up to someone
export function openChallenge(slot, name){ open('challenge', { slot, name, link: pvpLinkMs() * 2 }); }   // (before the answer: this screen's side of it, both ways)
export function openHonours(){ open('honours', {}); }

/* ---------------- the walk-up prompt: F · CHALLENGE ---------------- */
let near = null, shown = '';
onInteract(() => {
  if (!near || duelCardOpen()) return false;
  openChallenge(near.slot, near.name);
  return true;
}, () => !!near && !duelCardOpen());

/* ---------------- the score bar ---------------- */
let hudKey = '';
export function updateDuelUi(){
  // THE INCOMING CUE: the other fighter's cut announced the instant it started (net/pvp.js 'dsw'), shown on the side it
  // comes in on and brightening as it nears, so the link's delay doesn't also cost you the read
  const cutIn = pvpIncoming();
  const line = cutIn && cutIn.t > -0.15 ? cutIn.line : '';
  if (cue.dataset.line !== line){ cue.dataset.line = line; cue.className = line ? 'on l-' + line : ''; }
  if (line) cue.style.setProperty('--near', Math.max(0, Math.min(1, 1 - cutIn.t / 0.35)).toFixed(2));
  // the prompt
  near = null;
  if (G.mode === 'play' && !G.paused && !G.skillSelect){ for (const c of challengeable()) if (c.near && (!near || c.d < near.d)) near = c; }
  const key = near ? near.slot + ':' + near.name + (pad.active ? ':pad' : '') : '';
  if (key !== shown){
    shown = key;
    if (near) prompt.innerHTML = '<kbd>' + (pad.active ? padKeys(INTERACT_KEY) : INTERACT_KEY) + '</kbd><span>CHALLENGE ' + esc(near.name) + '</span>';
    prompt.classList.toggle('on', !!near);
  }
  // an incoming challenge that arrived while a card or menu was up gets its card once it's clear
  const inc = incomingChallenge();
  if (inc && !duelCardOpen() && G.mode === 'play' && !G.paused) open('incoming', inc);
  // the bar
  const M = duelState();
  const show = !!M && M.ph && M.ph !== 'wait' && M.ph !== 'gone' && G.mode === 'play' && Array.isArray(M.hits);
  hud.classList.toggle('on', show);
  if (!show){ hudKey = ''; return; }
  const R = RULES[M.rule] || RULES.hits, names = [nm(M, 0), nm(M, 1)];
  const side = (i) => {
    const pips = M.rule === 'hits' ? '<span class="dl-pips">' + Array.from({ length: R.hits }, (_, k) => '<i class="' + (k < M.hits[i] ? 'on' : '') + '"></i>').join('') + '</span>'
      : M.rule === 'health' ? '<span class="dl-bar"><i style="width:' + Math.round(Math.max(0, Math.min(1, M.hp[i])) * 100) + '%"></i></span>'
      : '<span class="dl-n">' + M.hits[i] + '</span>';
    const rounds = '<span class="dl-rd">' + Array.from({ length: D.toWin }, (_, k) => '<i class="' + (k < M.rounds[i] ? 'on' : '') + '"></i>').join('') + '</span>';
    return '<div class="dl-side s' + i + (M.me === i ? ' me' : '') + '"><b>' + esc(names[i]) + '</b>' + pips + rounds + '</div>';
  };
  const mid = M.rule === 'timed' ? (M.sudden ? 'SUDDEN DEATH' : fmt(M.clock)) : 'ROUND ' + M.round;
  const link = M.pvp ? '<div class="dl-ms ' + linkCls(M.lk || 0) + '">' + (M.me < 0 ? 'WATCHING · ' : '') + Math.round(M.lk || 0) + ' MS</div>' : '<div class="dl-ms good">PRACTICE</div>';
  const html = side(0) + '<div class="dl-mid"><b>' + mid + '</b>' + link + '</div>' + side(1);
  if (html !== hudKey){ hudKey = html; hud.innerHTML = html; }
}
const fmt = (s) => { s = Math.max(0, Math.ceil(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const nm = (M, i) => { const k = i === 0 ? M.a : M.b; return k === 'me' ? 'YOU' : k === 'mirror' ? 'THE MIRROR' : k === net.slot ? 'YOU' : nameOf(k); };
