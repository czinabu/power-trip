// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE MISSIONS PAGE: picking MISSIONS on the main menu swaps the menu column for this page (like the customizer),
// so the menu itself keeps only the hero, the mode, the difficulty and BEGIN. The page shelves every story mission by
// story and act for the hero picked (data/mission-groups.js): a card each with its place, threat and a tick once this
// hero has won it, and the picked one spelled out under the list. BEGIN MISSION plays it; BACK (Esc, or B on a pad)
// goes back to the menu with the mission still picked, so BEGIN there plays it too.
// Keys: the arrows move between the open missions, Enter begins. A pad's focus ring walks the cards like any button.
// ARCADE (data/arcade.js) heads the page: a board of random contracts with no story, open to every hero from the start.
// SHUFFLE deals a new board; SURPRISE ME begins a random one straight away.
// ARCADE and each act fold under a header (arrow + progress): the act the player is on (and the picked mission's) opens,
// the rest stay shut, and a fold set by hand is remembered.

import { G } from '../state.js';
import { missionDone, missionTitle } from '../game/mission.js';
import { missionUnlocked, missionChapterNo } from '../game/sandbox-unlocks.js';
import { MISSIONS } from '../data/missions.js';
import { missionShelves, missionRank, missionShelf, missionForHero, STORIES } from '../data/mission-groups.js';
import { audioInit } from '../audio/sfx.js';
import { missionById, isArcadeId, arcadeBoard, newSeed, randomArcadeId, kindName, TWISTS, arcadeWins } from '../data/arcade.js';
import { overlay, setOverlayState, isMenuState, beginFromMenu, panelOpen } from './menus.js';

const listEl = document.getElementById('mplist'), infoEl = document.getElementById('mpinfo');
const HEROES = () => ['jedi', 'mando', 'trooper'];
const HERO_NAME = { jedi: 'Jedi', mando: 'Mando', trooper: 'ARC' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export const placeOf = (m) => m.level.name.replace(/^(MISSION|TRIAL)\s*—\s*/, '');
// a campaign trial joins the list once any hero has reached it in the campaign (won it there)
const trialSeen = (id) => !MISSIONS[id] || !MISSIONS[id].trial || HEROES().some(h => missionDone(id, h));
// a mission stays locked and unspoiled until the campaign has cleared it (game/sandbox-unlocks.js)
export const missionOpen = (id) => isArcadeId(id) ? !!missionById(id) : !!MISSIONS[id] && trialSeen(id) && missionUnlocked(id);   // the arcade is always open
const shown = (id) => isArcadeId(id) ? !!missionById(id) : MISSIONS[id] && missionForHero(MISSIONS[id], G.hero) && trialSeen(id);
export const missionPageOpen = () => overlay.classList.contains('mpage');

export function setMission(id){
  if (!shown(id)) id = Object.keys(MISSIONS).find(shown) || 'refuge';
  G.missionId = id; try { localStorage.setItem('sw_mission', id); } catch(e){}
  for (const el of listEl.querySelectorAll('.msn')) el.classList.toggle('sel', el.dataset.mission === id);
  refreshInfo();
  refreshTile();
  if (isMenuState()) setOverlayState('menu');   // the headline names the mission
}

/* ---------- the ARCADE board ---------- */
// the board's seed stays put (a reload shows the same six) until SHUFFLE deals another
let boardSeed = 0;
try { boardSeed = parseInt(localStorage.getItem('sw_arcade_board') || '0', 10) || 0; } catch(e){}
if (!boardSeed) shuffleBoard(true);
function shuffleBoard(quiet){
  boardSeed = newSeed();
  try { localStorage.setItem('sw_arcade_board', String(boardSeed)); } catch(e){}
  if (!quiet){ const first = arcadeBoard(boardSeed)[0]; if (first) setMission(first.id); render(); }   // (the new board's first card, picked)
}
// a random contract (not necessarily one on the board), picked and begun
function surprise(){ setMission(randomArcadeId()); beginFromMenu(); }
const kindTags = (c) => [...new Set(c.kinds)].map(k => '<span class="msn-tag">' + kindName(k) + '</span>').join('');
const twistTag = (c) => c.twist ? '<span class="msn-tag tw">' + TWISTS[c.twist].name + '</span>' : '';
function arcCard(c){
  return `<div class="msn arc brk${c.id === G.missionId ? ' sel' : ''}" id="msn-${c.id.replace(':', '-')}" data-mission="${c.id}">
    <span class="mt"><span class="mtn">${c.title}</span>${twistTag(c)}</span>
    <span class="mw">${c.place}</span><span class="mk">${kindTags(c)}</span>${pips(c.threat)}
  </div>`;
}
function arcadeShelf(){
  const board = arcadeBoard(boardSeed), picked = isArcadeId(G.missionId) && !board.some(c => c.id === G.missionId) ? missionById(G.missionId) : null;
  const won = arcadeWins(G.hero);
  return fold('arcade', isArcadeId(G.missionId), 'mp-arcade', `ARCADE<span class="mp-sub">random missions, no story</span>`, won ? won + ' won' : '',
    `<div class="mp-arcbtns"><div class="btn" data-arc="shuffle">⟳ SHUFFLE</div><div class="btn" data-arc="surprise">⚄ SURPRISE ME</div></div>
    <div class="mp-grid">${(picked ? [picked, ...board.slice(0, -1)] : board).map(arcCard).join('')}</div>`);
}

/* ---------- folding sections ---------- */
// ARCADE and every act fold under a header with an arrow and its progress (6/7). Until the player folds one by hand, the
// campaign act they're on and the picked mission's section open and the rest stay shut; a hand-set fold is
// remembered (per hero for the acts, since each hero's acts are their own)
let folds = {};
try { folds = JSON.parse(localStorage.getItem('sw_mp_folds') || '{}') || {}; } catch(e){ folds = {}; }
const foldKey = (k) => k === 'arcade' ? k : G.hero + ':' + k;
const isOpen = (k, dflt) => { const v = folds[foldKey(k)]; return v === undefined ? !!dflt : !!v; };
function fold(key, dflt, cls, title, count, body, extra = ''){
  const open = isOpen(key, dflt);
  return `<div class="mp-sec ${cls}${open ? ' open' : ''}${extra}" data-fold="${key}">
    <div class="mp-fold" role="button" aria-expanded="${open}"><i class="mp-arrow"></i><span class="mp-ft">${title}</span><span class="mp-n">${count}</span></div>
    <div class="mp-body">${body}</div></div>`;
}
function toggleFold(sec){
  const open = !sec.classList.contains('open');
  sec.classList.toggle('open', open); sec.querySelector('.mp-fold').setAttribute('aria-expanded', open);
  folds[foldKey(sec.dataset.fold)] = open;
  try { localStorage.setItem('sw_mp_folds', JSON.stringify(folds)); } catch(e){}
}
/* ---------- the page ---------- */
const pips = (n) => '<span class="mthreat" title="Threat ' + n + ' of 5">' + [1, 2, 3, 4, 5].map(i => '<i' + (i <= n ? ' class="on"' : '') + '></i>').join('') + '</span>';
function card(m){
  const open = missionOpen(m.id), won = missionDone(m.id, G.hero), ch = missionChapterNo(m.id);
  const tags = open ? (m.squad ? '<span class="msn-tag">SQUAD</span>' : '') + (m.trial ? '<span class="msn-tag">TRIAL</span>' : '') : '';
  return `<div class="msn brk${open ? '' : ' locked'}${won && open ? ' won' : ''}${m.id === G.missionId ? ' sel' : ''}" id="msn-${m.id}" data-mission="${m.id}">
    <span class="mt"><span class="mtn">${open ? missionTitle(m.id) : '???'}</span>${tags}<span class="won">${open ? (won ? '✓' : '') : '🔒'}</span></span>
    <span class="mw">${open ? placeOf(m) : (ch ? 'COMPLETE ' + ch + ' TO UNLOCK' : 'LOCKED')}</span>${open ? pips(missionRank(m, G.hero)) : ''}
  </div>`;
}
function render(){
  for (const t of document.querySelectorAll('#mpheroes span')){
    t.style.display = HEROES().includes(t.dataset.h) ? '' : 'none';
    t.classList.toggle('on', t.dataset.h === G.hero);
  }
  const shelves = missionShelves(G.hero);
  listEl.innerHTML = arcadeShelf() + shelves.map((s, si) => {
    const acts = s.groups.map((g, ai) => {
      const ms = g.missions.filter(m => trialSeen(m.id));
      const open = ms.filter(m => missionOpen(m.id)), won = open.filter(m => missionDone(m.id, G.hero)).length;
      return { g, ai, ms, open: open.length, won };
    }).filter(a => a.ms.length);
    if (!acts.length) return '';
    // the act the player is on: the first with an open mission still to win, else the last one they can play
    const cur = acts.find(a => a.won < a.open) || [...acts].reverse().find(a => a.open) || acts[0];
    const groups = acts.map(a => {
      const shut = !a.open, done = !shut && a.won === a.ms.length;
      const count = shut ? '🔒 ' + a.ms.length : (done ? '✓ ' : '') + a.won + '/' + a.ms.length;
      const dflt = (si === 0 && a === cur) || a.ms.some(m => m.id === G.missionId);   // the main story's current act, and the picked mission's
      return fold(s.id + ':' + a.ai, dflt, 'mp-act', a.g.title || s.title, count,
        `<div class="mp-grid">${a.ms.map(card).join('')}</div>`, (shut ? ' shut' : '') + (done ? ' done' : ''));
    }).join('');
    const head = acts.length > 1 || acts[0].g.title ? `<div class="sec-label mp-storyh">${s.title}</div>` : '';   // (a one-shelf story's fold says it already)
    return `<div class="mp-story${head ? '' : ' solo'}">${head}${groups}</div>`;
  }).join('');
  if (!shown(G.missionId)) setMission(G.missionId); else refreshInfo();
}
function refreshInfo(){
  if (isArcadeId(G.missionId)) return arcadeInfo(missionById(G.missionId));
  const m = MISSIONS[G.missionId]; if (!m || !infoEl) return;
  if (!missionOpen(m.id)){
    const ch = missionChapterNo(m.id);
    infoEl.innerHTML = `<div class="mpi-t">LOCKED MISSION</div><div class="mpi-b">Clear ${ch ? ch.toLowerCase().replace(/^c/, 'C') : 'its chapter'} in the campaign to unlock this mission.</div>`;
    return;
  }
  const s = missionShelf(m, G.hero), story = STORIES.find(x => x.id === s.story);
  const where = placeOf(m) + (story ? ' · ACT ' + ROMAN[s.act] : '') + (missionChapterNo(m.id) && s.story === 'campaign' ? ' · ' + missionChapterNo(m.id) : '');
  const marks = HEROES().map(h => HERO_NAME[h] + ' ' + (missionDone(m.id, h) ? '<span class="ok">✓</span>' : '<span class="no">–</span>')).join(' &nbsp;');
  const n = m.objectives.length;
  infoEl.innerHTML = `<div class="mpi-t">${missionTitle(m.id)}${m.squad ? '<span class="msn-tag">SQUAD</span>' : ''}${m.trial ? '<span class="msn-tag">TRIAL</span>' : ''}</div>
    <div class="mpi-w">${where}</div>
    <div class="mpi-b">${m.blurb.charAt(0).toUpperCase() + m.blurb.slice(1)}.</div>
    <div class="mpi-meta"><span>THREAT ${pips(missionRank(m, G.hero))}</span><span>${n} OBJECTIVE${n === 1 ? '' : 'S'}</span><span>ON ${String(G.diff || 'knight').toUpperCase()}</span><span class="mpi-won">${marks}</span></div>`;
}
function arcadeInfo(c){
  if (!c || !infoEl) return;
  const steps = c.objectives.map(o => { const t = typeof o.title === 'object' ? (o.title[G.hero] || o.title.mando || o.title.jedi) : o.title; return kindName(o.kind) + ': ' + t.toLowerCase().replace(/(^|\s)\S/g, ch => ch.toUpperCase()); });
  infoEl.innerHTML = `<div class="mpi-t">${c.title}<span class="msn-tag">ARCADE</span>${twistTag(c)}</div>
    <div class="mpi-w">${c.place}</div>
    <div class="mpi-b">${steps.join(' &nbsp;›&nbsp; ')}.${c.twist ? ' <b>' + TWISTS[c.twist].name + ':</b> ' + TWISTS[c.twist].line : ''}</div>
    <div class="mpi-meta"><span>THREAT ${pips(c.threat)}</span><span>${c.objectives.length} OBJECTIVE${c.objectives.length === 1 ? '' : 'S'}</span><span>ON ${String(G.diff || 'knight').toUpperCase()}</span><span class="mpi-won">No story · any hero</span></div>`;
}
// the menu's MISSIONS tile: how many this hero has won, or the one picked
export function refreshTile(){
  const md = document.querySelector('#mode-mission .md'); if (!md) return;
  const ids = Object.keys(MISSIONS).filter(shown), won = ids.filter(id => missionDone(id, G.hero)).length;
  md.innerHTML = G.modeSel === 'mission' && missionOpen(G.missionId)
    ? 'Picked: ' + (isArcadeId(G.missionId) ? 'Arcade · ' : '') + missionTitle(G.missionId).toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()) + ' · <span class="ok">change</span>'
    : 'Story missions and a random arcade' + (won ? ' · ' + won + '/' + ids.length + ' <span class="ok">✓</span>' : '');
}
// every tick and lock after progress changes, or the hero does
export function refreshMissionMark(){ render(); refreshTile(); }

export function openMissionPage(){
  overlay.classList.add('mpage');
  if (isMenuState()) setOverlayState('menu');   // BEGIN MISSION and the mission's name, not the first step's headline
  render();
  overlay.scrollTop = 0;
  const sel = listEl.querySelector('.msn.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
export function closeMissionPage(){
  if (!missionPageOpen()) return;
  overlay.classList.remove('mpage');
  if (isMenuState()) setOverlayState('menu');
  refreshTile();
}

listEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-arc]');
  if (b){ e.stopPropagation(); audioInit(); if (b.dataset.arc === 'shuffle') shuffleBoard(); else surprise(); return; }
  const f = e.target.closest('.mp-fold');
  if (f){ e.stopPropagation(); audioInit(); toggleFold(f.parentElement); return; }
  const c = e.target.closest('.msn'); if (!c) return;
  e.stopPropagation(); audioInit(); setMission(c.dataset.mission);
});
listEl.addEventListener('dblclick', (e) => {
  const c = e.target.closest('.msn'); if (!c) return;
  e.stopPropagation(); setMission(c.dataset.mission); if (missionOpen(c.dataset.mission)) beginFromMenu();
});
document.getElementById('mpBack').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); closeMissionPage(); });
// the page's hero tabs pick the hero exactly as the menu's cards do (the stand and every mark follow)
for (const t of document.querySelectorAll('#mpheroes span')) t.addEventListener('click', (e) => {
  e.stopPropagation(); const card = document.getElementById('hero-' + t.dataset.h); if (card) card.click();
});
// keys: Esc goes back; the arrows move between the open missions (nearest card that way); Enter begins
document.addEventListener('keydown', (e) => {
  if (!missionPageOpen() || !isMenuState() || overlay.style.display === 'none') return;
  if (panelOpen() || /\b(customizing|asktrain)\b/.test(overlay.className) || document.getElementById('armory')?.classList.contains('open')) return;
  if (e.key === 'Escape'){ closeMissionPage(); return; }
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (dir){
    e.preventDefault();
    const cards = [...listEl.querySelectorAll('.mp-sec.open .msn:not(.locked)')], cur = listEl.querySelector('.msn.sel');
    if (!cur){ if (cards[0]) setMission(cards[0].dataset.mission); return; }
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const c of cards){
      if (c === cur) continue;
      const b = c.getBoundingClientRect(), dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
      const main = dx * dir[0] + dy * dir[1], side = Math.abs(dir[0] ? dy : dx);
      if (main <= 4) continue;
      const s = main + side * 2.4; if (s < bs){ bs = s; best = c; }
    }
    if (best){ setMission(best.dataset.mission); best.scrollIntoView({ block: 'nearest' }); }
  } else if (e.key === 'Enter' && !e.repeat && missionOpen(G.missionId)){
    e.preventDefault(); e.stopImmediatePropagation(); document.getElementById('goText').click();
  }
});
