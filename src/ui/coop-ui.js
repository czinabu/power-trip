// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The ONLINE CO-OP panel (main menu and pause): host a room or join one by its code or invite link, and the connection
// readout on the HUD. A player who arrives by an INVITE LINK (net/invite.js) is joined at once and taken straight to the
// host: into their hub (its halls or their ship) or their run, as soon as the host is somewhere to go.

import { ZONES, ZONE_PREFIX } from '../data/zones.js';
import { audioInit } from '../audio/sfx.js';
import { net, on, host, join, leave, cleanCode, lastRoom, setLocked, isLocked } from '../net/session.js';
import { inviteLink, appLink, parseInvite, takePageInvite, deviceOf, myDevice, INVITE_MIN } from '../net/invite.js';
import { HUBS } from '../data/hub.js';
import { SHIP_WING } from '../data/hero-ships.js';
import { pad } from '../engine/gamepad.js';
import { savedName, saveName, typingName, nameOf, seatsHeard } from '../net/names.js';
import { SEAT_COLORS } from './coop-marks.js';
import { coopRun } from '../net/run.js';
import { onRunChange } from '../net/foes.js';
import { launchCoopRun } from './menus.js';
import { G } from '../state.js';
import { missionTitle } from '../game/mission.js';
import { profileCard } from '../game/profile.js';
import { partnerCards, partnerWorlds } from '../net/partner.js';
import { goTemple } from './menus.js';

const panel = document.getElementById('coop');
const statusEl = document.getElementById('coopstatus');
const codeIn = document.getElementById('coopcode');
const leaveBtn = document.getElementById('coopleave');
const pingEl = document.getElementById('netping');
const nameIn = document.getElementById('coopname');
const rosterEl = document.getElementById('cooproster');
const runBtn = document.getElementById('coopjoinrun');
const templeBtn = document.getElementById('coopjointemple');
const inviteRow = document.getElementById('coopinvite');
const copyBtn = document.getElementById('coopcopy');
const lockBtn = document.getElementById('cooplock');
const copiedEl = document.getElementById('coopcopied');
const appA = document.getElementById('coopapp');
// the host is in their hub (game/hub.js): a guest on the menu can go in after them. hostWhere: 'hub:<hub>:<wing>'
const hostWhere = () => { const h = partnerWorlds().find(p => p.slot === 0); return h ? h.world : ''; };
const hostInTemple = () => hostWhere().startsWith('hub:');
// the way in, named for where they are: the temple, the citadel or the covert, or aboard their ship
function hubWord(){
  const [, id, wing] = hostWhere().split(':');
  if (wing === SHIP_WING) return 'ABOARD THEIR SHIP';
  return (id === 'temple' ? 'IN ' : 'AT ') + ((HUBS[id] && HUBS[id].home) || 'THE TEMPLE');
}
const hubWords = () => hubWord().toLowerCase();

const setOpen = (open) => { panel.classList.toggle('open', open); if (open){ render(); markHero(); } };
// YOUR HERO: the title screen picks the hero on its second step, so the co-op panel (opened from the first) has its own
// tabs; they click the menu's hero cards, so the stand and every mark follow as they do there
const heroTabs = document.querySelectorAll('#coopheroes span');
const markHero = () => { for (const t of heroTabs) t.classList.toggle('on', t.dataset.h === G.hero); };
for (const t of heroTabs) t.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit(); const card = document.getElementById('hero-' + t.dataset.h); if (card) card.click(); markHero();
});
for (const id of ['coopBtn', 'mode-coop']) document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setOpen(true); });
document.getElementById('coopclose').addEventListener('click', (e) => { e.stopPropagation(); setOpen(false); });
panel.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === panel) setOpen(false); });   // never launches or resumes the game
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false); });

// your display name: kept in this browser, filtered as you type, sent to the others when you connect
nameIn.value = savedName();
nameIn.addEventListener('input', () => { nameIn.value = typingName(nameIn.value); saveName(nameIn.value); });
nameIn.addEventListener('blur', () => { nameIn.value = saveName(nameIn.value); });
nameIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') nameIn.blur(); });
nameIn.addEventListener('click', (e) => e.stopPropagation());

document.getElementById('coophost').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); host(); });
document.getElementById('coopjoin').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); const inv = parseInvite(codeIn.value); if (inv) arrive(inv); else join(codeIn.value); });
leaveBtn.addEventListener('click', (e) => { e.stopPropagation(); leave(false); });
runBtn.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); follow = null; setOpen(false); launchCoopRun(); });
templeBtn.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); follow = null; setOpen(false); goTemple(); });
// the code box takes a whole invite link too (pasted from a chat): that joins at once, as opening the link would
codeIn.addEventListener('input', () => {
  const inv = /join=/i.test(codeIn.value) && parseInvite(codeIn.value);
  if (inv){ codeIn.value = inv.code; arrive(inv); return; }
  codeIn.value = cleanCode(codeIn.value);
});
codeIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') join(codeIn.value); });

/* ---------------- the host's invite link and lock ---------------- */
let lastLink = '';   // (the last link made: the co-op invite smoke test reads it)
export const lastInvite = () => lastLink;
copyBtn.addEventListener('click', async (e) => {
  e.stopPropagation(); audioInit();
  if (net.role !== 'host') return;
  const link = inviteLink(net.code, savedName());
  lastLink = link;
  let said = 'Link copied. It works for ' + INVITE_MIN + ' minutes, on a phone, a PC or the Windows app.';
  try {
    // a phone: its share sheet (a chat app, a text); anywhere else the clipboard
    if (myDevice() === 'PHONE' && navigator.share){ await navigator.share({ title: 'Power Trip co-op', text: 'Join my Power Trip game', url: link }); said = 'Invite sent. It works for ' + INVITE_MIN + ' minutes.'; }
    else await Promise.race([navigator.clipboard.writeText(link), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 1500))]);
  } catch(err){
    if (err && err.name === 'AbortError') return;   // (the share sheet, closed)
    said = 'Copy this link: ' + link;
  }
  copiedEl.textContent = said;
});
lockBtn.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  setLocked(!isLocked());
  copiedEl.textContent = isLocked() ? 'Locked: nobody new can join, but anyone who drops out can get back in.' : 'Unlocked: your code and invite links work again.';
});

/* ---------------- arriving by an invite link ---------------- */
// follow: this guest came by an invite and goes straight to the host once connected ({ from: the host's name })
let follow = null;
export function arrive(inv){
  if (!inv) return;
  setOpen(true);
  codeIn.value = inv.code;
  if (inv.stale){ follow = null; leave(false, 'That invite link has expired. Ask the host for a new one.'); return; }
  if (net.status === 'connected' && net.code === inv.code) return;   // already in that room
  follow = { from: inv.from };
  appA.href = appLink('?join=' + inv.code + (inv.inv ? '&inv=' + inv.inv : ''));
  join(inv.code, false, inv.inv);
}
// may the game go in without a click? (pointer lock wants one on a PC; a pad, a phone or a fresh click doesn't)
const mayGo = () => pad.active || myDevice() === 'PHONE' || !!(navigator.userActivation && navigator.userActivation.isActive);
// connected by an invite, on the menu: once the host is in their hub or a run, go after them
function followHost(){
  if (!follow || net.status !== 'connected' || net.role !== 'guest' || G.mode !== 'menu' || G.coopGuest) return;
  const btn = coopRun.on ? runBtn : hostInTemple() ? templeBtn : null;
  if (!btn) return;
  if (mayGo()){ follow = null; btn.click(); }
  else btn.classList.add('pulse');   // one click to go in (the browser's pointer lock needs it)
}
setInterval(() => { if (panel.classList.contains('open') && net.role === 'guest' && net.status === 'connected' && G.mode === 'menu'){ render(); followHost(); } }, 700);

codeIn.addEventListener('click', (e) => e.stopPropagation());

const zoneLabel = (k) => (ZONES[k] || ZONES.jedha).name.toLowerCase();   // (an open zone: data/zones.js)
const runName = () => coopRun.k === 'z' ? zoneLabel(coopRun.mid.slice(ZONE_PREFIX.length)) : coopRun.k === 'm' ? (coopRun.mid.startsWith('arcade:') ? 'the challenge ' : 'the mission ') + missionTitle(coopRun.mid) : coopRun.k === 'c' ? (coopRun.ch >= 0 ? 'chapter ' + (coopRun.ch + 1) : 'level ' + (coopRun.lv + 1)) + ' of the campaign' : 'a Survival run';
const waveText = () => coopRun.k === 'm' || coopRun.k === 'z' || coopRun.mid ? '' : ', wave ' + (coopRun.k === 'c' ? coopRun.w - (coopRun.wf || 0) + 1 : coopRun.w);
// who is in the room: everyone's picked name (or PLAYER n) in their seat colour
function renderRoster(){
  const live = net.status === 'connected';
  rosterEl.style.display = live ? 'flex' : 'none';
  rosterEl.textContent = '';
  if (!live) return;
  const seats = [...new Set([net.slot, 0, ...seatsHeard()])].sort();
  for (const k of seats){
    const el = document.createElement('span');
    el.style.borderColor = '#' + SEAT_COLORS[k].toString(16).padStart(6, '0');
    el.textContent = k === net.slot ? (savedName() || nameOf(k)).toUpperCase() : nameOf(k);
    // their rank, from the profile card each player sends (game/profile.js)
    const card = k === net.slot ? profileCard() : ((partnerCards().find(c => c.slot === k) || {}).card);
    if (card){ const r = document.createElement('em'); r.textContent = card.n; el.appendChild(r); }
    const dv = k === net.slot ? myDevice() : deviceOf(k);   // PC, PHONE or APP: a mixed party at a glance
    if (dv){ const d = document.createElement('b'); d.textContent = dv; el.appendChild(d); }
    if (k === 0){ const h = document.createElement('i'); h.textContent = 'HOST'; el.appendChild(h); }
    if (k === net.slot){ const h = document.createElement('i'); h.textContent = 'YOU'; el.appendChild(h); }
    rosterEl.appendChild(el);
  }
}
function render(){
  const s = net.status;
  nameIn.disabled = s === 'connected' || s === 'reconnecting';   // the name goes out with your hello: pick it before you connect
  renderRoster();
  statusEl.className = s === 'connected' ? 'ok' : s === 'failed' ? 'bad' : '';
  if (s === 'hosting') statusEl.innerHTML = 'Room code<span class="code">' + net.code + '</span>' + (isLocked() ? 'Locked: nobody new can join.' : 'Send your friends the invite link, or read them the code (up to 3).');
  else if (s === 'joining') statusEl.textContent = follow && follow.from ? 'Joining ' + follow.from.toUpperCase() + '\'s game…' : 'Joining room ' + net.code + '…';
  else if (s === 'connected'){
    const guest = net.role === 'guest';
    const msg = !coopRun.on ? (guest ? (hostInTemple() ? 'Connected. The host is ' + hubWords() + (follow ? ': in you go.' : ': go in and meet them there.') : follow ? 'Connected. You\'ll go straight to the host when they enter their hub or start a run.' : 'Connected. Waiting for the host to start a run, then you can join it here.') : 'Connected. Enter your hub and your friends can meet you there, or start a campaign, a story mission or a Survival run and they can join it. Training and the sandbox you each play on your own.')
      : guest ? (G.coopGuest ? 'Fighting alongside the host' + waveText() + '.' : G.mode === 'menu' ? 'The host is on ' + runName() + waveText() + '.' : 'The host is in a run. Go back to the main menu to join it.')
      : 'Your friends can join your run from this panel.';
    // the host keeps the code in view while there is room: one more friend can still come in
    if (!guest && net.guests < 3) statusEl.innerHTML = '<span class="players">' + (net.guests + 1) + ' of 4 players' + (isLocked() ? ' · LOCKED' : '') + '</span> Room code<span class="code">' + net.code + '</span>' + msg;
    else if (!guest) statusEl.innerHTML = '<span class="players">4 of 4 players</span>' + msg;
    else statusEl.textContent = msg;
  }
  else if (s === 'reconnecting') statusEl.textContent = 'Connection lost. Getting back into room ' + net.code + '…';
  else if (s === 'failed') statusEl.textContent = net.error;
  else statusEl.textContent = '';
  leaveBtn.style.display = s === 'idle' ? 'none' : 'inline-flex';
  runBtn.style.display = s === 'connected' && net.role === 'guest' && coopRun.on && !G.coopGuest && G.mode === 'menu' ? 'inline-flex' : 'none';
  templeBtn.style.display = s === 'connected' && net.role === 'guest' && !coopRun.on && G.mode === 'menu' && hostInTemple() ? 'inline-flex' : 'none';
  if (templeBtn.style.display !== 'none') templeBtn.textContent = 'JOIN THEM ' + hubWord();
  if (runBtn.style.display === 'none') runBtn.classList.remove('pulse');
  if (templeBtn.style.display === 'none') templeBtn.classList.remove('pulse');
  // the host's invite link and lock, while the room is theirs and has a seat left (or is locked, to unlock it)
  const hosting = net.role === 'host' && (s === 'hosting' || s === 'connected');
  inviteRow.classList.toggle('on', hosting && (net.guests < 3 || isLocked()));
  copyBtn.style.display = isLocked() ? 'none' : '';
  lockBtn.textContent = isLocked() ? 'UNLOCK ROOM' : 'LOCK ROOM';
  lockBtn.classList.toggle('on', isLocked());
  if (!hosting) copiedEl.textContent = '';
  // an invite opened in a browser on Windows: the Windows app can take it instead
  appA.classList.toggle('on', !!follow && (s === 'joining' || s === 'failed') && !window.powerTripDesktop && /Windows/.test(navigator.userAgent));
  if (s === 'failed' || s === 'idle') follow = s === 'failed' ? follow : null;
  const live = s === 'connected';
  pingEl.classList.toggle('on', live || s === 'reconnecting');
  if (live) pingEl.textContent = 'ONLINE · ' + (net.ping ? net.ping + ' MS' : '…');
  else if (s === 'reconnecting') pingEl.textContent = 'RECONNECTING…';
  if ((s === 'idle' || s === 'failed') && !codeIn.value) codeIn.value = lastRoom();   // the last room joined, ready to rejoin
}
on('status', render);
on('status', () => setTimeout(followHost, 0));
onRunChange(() => setTimeout(followHost, 0));
// the invite this page was opened with (a link from a chat), and one the Windows app is handed while it runs (desktop/preload.cjs)
const pageInvite = takePageInvite();
if (pageInvite) setTimeout(() => arrive(pageInvite), 0);
try { if (window.powerTripDesktop && window.powerTripDesktop.onInvite) window.powerTripDesktop.onInvite((link) => arrive(parseInvite(link))); } catch(e){}
on('ping', render);
on('closed', render);
on('hello', () => setTimeout(render, 0));   // after net/partner.js has noted the name
onRunChange(render);
