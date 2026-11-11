// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PROFILE PAGE, picture first. On the left, always: the rank, the rank track (every rank as a stop on one line; tap
// one to see what it asks and opens), that rank's asks as bars and pips, and the light-and-dark meter. On the right, a tab
// at a time: OVERVIEW (a tile each for the tree, the two paths, the saber or kit, NEW GAME+ and the record), the hero's
// TREE (every card a run can train, by branch and tier, with one card's detail over it), and the PATHS (the meter big, the
// two sides as two chains of three). At a chapter's close the same panel IS the upgrade page (openRunTree): the tree,
// with Training points to spend on it. The panel wears the shown hero's look (styles/heroes/profile.css); on a phone the left column folds to a strip. Opens from PROFILE on the main menu, the hub and the
// pause screen, in every mode. game/profile.js keeps it all; data/profile.js and data/alignment.js have the words.

import { G } from '../state.js';
import { audioInit } from '../audio/sfx.js';
import {
  profileOf, track, rankNeeds, trialsPassed,
  seenFresh, anyFresh, onPromote, resetProfile, tierRank, onPart, partsOwned, partsTotal,
  owns, runLive, alignOf, alignStage, leanOf, alignOpen,
  ngBest, ngNextTier, hasRank, cardsSeen, seeCards,
  medalTotal } from '../game/profile.js';
import { tierName, MAX_TIER } from '../data/ngplus.js';
import { ALIGN, ALIGN_WORDS, ALIGN_RANK, PATH_TREE, PATH_WORDS } from '../data/alignment.js';
import { TRIALS, RANK_SKILLS, TREES, branchOf } from '../data/profile.js';
import { SKILLS, MANDO_SKILLS, TIER_NAME, TIER_REQ, TIER_CHAPTER } from '../data/skills.js';
import { skillRank, tierStoryOpen } from '../game/progression.js';
import { TROOPER_SKILLS } from '../data/trooper-progression.js';
import { chapterOrder, forHero } from '../data/campaign.js';
import { icon } from './icons.js';
import { upToast } from '../game/upgrades.js';
import { EARNABLE, crystalOf, earnProgress, earnText } from '../data/saber-parts.js';
import { benchOf, earnableOf, SIDE_ROW, BENCH_NAME } from '../data/hero-benches.js';
import { CUSTOMIZE, wornOption } from '../data/customize.js';
import { loadPicks } from '../player/mesh.js';

const panel = document.getElementById('profile');
const btn = document.getElementById('pfBtn');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HERO_NAME = { jedi: 'JEDI', mando: 'MANDALORIAN', trooper: 'ARC TROOPER' };
let hero = 'jedi', armed = false, view = 'home';   // view: the right column's OVERVIEW, TREE or PATHS
const sel = {};   // per hero: the path card whose detail shows (PATHS)
const rankAt = {};   // per hero: the rank stop tapped on the rank track (none: the box shows the next rank)
const SET_OF = { jedi: SKILLS, mando: MANDO_SKILLS, trooper: TROOPER_SKILLS };
// the trooper's story ranks open looks, not cards (game/wardrobe.js PROMOTIONS, data/ability-cards.js promote-*)
const LOOK_OF_RANK = { trooper: { sergeant: 'Sergeant green marks', lieutenant: 'Lieutenant blue marks', captain: 'Captain helmet and pauldron',
  commander: 'Commander yellow marks', arc: 'ARC kit and the ARC TROOPER name' } };

// a chapter's title as this hero's story tells it
function chapterName(id, h){
  const c = chapterOrder(null, h).find(x => x.id === id) || chapterOrder(null, 'jedi').find(x => x.id === id);
  return c ? forHero(c.title, h) : id.toUpperCase();
}
const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
// a card's effects, one per line ('A · B' in the data), so each reads on its own
const dsHtml = (ds) => { const parts = String(ds).split(' · '); return parts.length < 2 ? '<p>' + ds + '</p>' : '<ul class="pf-ds">' + parts.map(x => '<li>' + x + '</li>').join('') + '</ul>'; };

// NEW: an owned card you haven't looked at since it opened; a card's RANK PIPS: how many times a run can stack it
const isNew = (h, s) => { const seen = cardsSeen(h); return !!seen && owns(h, s) && !seen.includes(s.id); };
const NEW_TAG = '<em class="pf-new">NEW</em>';
const rankPips = (s) => s.max > 1 ? '<span class="pf-rp" title="Up to ' + s.max + ' ranks in a run">' + '<i></i>'.repeat(s.max) + '</span>' : '';

/* ---------- the LEFT COLUMN: who you are, at a glance. The rank track, the next rank's progress, the meter ---------- */
const pct = (f) => Math.round(Math.max(0, Math.min(1, f)) * 100) + '%';
// one thing the next rank asks, drawn: a bar for XP, pips for the trials, a box for a chapter or the campaign
function needLine(n, h){
  const ok = n.ok ? ' ok' : '';
  if (n.what === 'xp') return '<li class="pf-need' + ok + '"><span>' + esc(track(h).unit) + '</span><div class="pf-mbar"><i style="width:' + pct(n.have / Math.max(1, n.need)) + '"></i></div><b>' + num(Math.min(n.have, n.need)) + ' / ' + num(n.need) + '</b></li>';
  if (n.what === 'trials') return '<li class="pf-need' + ok + '"><span>TRIALS</span><div class="pf-pips">' +
    TRIALS.map(id => '<i class="' + (profileOf(h).cleared[id] ? 'on' : '') + '" title="' + esc(chapterName(id, h)) + '"></i>').join('') + '</div><b>' + n.have + ' / ' + n.need + '</b></li>';
  if (n.what === 'chapter') return '<li class="pf-need' + ok + '"><span>' + (n.ok ? '✓' : '○') + '</span><em>Clear ' + esc(chapterName(n.id, h)) + '</em></li>';
  if (n.what === 'won') return '<li class="pf-need' + ok + '"><span>' + (n.ok ? '✓' : '○') + '</span><em>Beat the campaign</em></li>';
  return '';
}
// what a rank opens on the tree (a tier of the Jedi's Force Tree cards, a Mando's or trooper's rank card), as chips
const JEDI_TIER_AT = { knight: 2, master: 3 };
function opens(h, ri){
  const T = track(h), R = T.ranks[ri], out = [];
  if (h === 'jedi' && JEDI_TIER_AT[R.id]) out.push(TIER_NAME[JEDI_TIER_AT[R.id]].charAt(0) + TIER_NAME[JEDI_TIER_AT[R.id]].slice(1).toLowerCase() + ' Force Tree cards');
  for (const s of RANK_SKILLS[h] || []) if (s.rank === R.id) out.push(s.nm + ' card');
  const look = LOOK_OF_RANK[h] && LOOK_OF_RANK[h][R.id];
  if (look) out.push(look);
  for (const [, nm] of R.gives || []) out.push(nm.charAt(0) + nm.slice(1).toLowerCase());   // the top rank's legendary parts and looks
  return out;
}
const chips = (list) => list.length ? '<div class="pf-chips">' + list.map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' : '';
// THE RANK TRACK: every rank as a stop on one line, lit up to where you stand, the line filling toward the next
function journey(h){
  const T = track(h), p = profileOf(h), n = T.ranks.length, next = T.ranks[p.rank + 1];
  const nx = next ? rankNeeds(h, p, p.rank + 1) : [];
  const frac = !next ? 0 : nx.length ? nx.reduce((a, x) => a + (x.ok ? 1 : x.need ? Math.min(1, x.have / x.need) : 0), 0) / nx.length : 0;
  const fill = n > 1 ? (p.rank + frac) / (n - 1) : 1;
  return '<div class="pf-journey" style="--n:' + n + '"><div class="pf-jline"><i style="width:' + pct(fill) + '"></i></div>' +
    T.ranks.map((x, i) => '<button type="button" class="pf-stop ' + (i < p.rank ? 'done' : i === p.rank ? 'on' : '') + (i === pickedRank(h) ? ' pick' : '') + '" data-rank="' + i + '" style="left:' + pct(n > 1 ? i / (n - 1) : 0) + '" aria-label="' + esc(x.nm) + '"><i></i></button>').join('') + '</div>' +
    '<div class="pf-jends' + (n > 4 ? ' many' : '') + '"><span>' + esc(T.ranks[0].nm) + '</span><em>tap a rank</em><span>' + esc(T.ranks[n - 1].nm) + '</span></div>';
}
// the rank the box under the track shows: the one tapped, else the next (or the top one, held)
function pickedRank(h){
  const T = track(h), p = profileOf(h), r = rankAt[h];
  return r != null && r < T.ranks.length ? r : Math.min(p.rank + 1, T.ranks.length - 1);
}
// THE RANK BOX: one rank, drawn. Ahead: what it asks, as bars and pips, and what it opens. Held: its line and what it opened
function rankBox(h){
  const T = track(h), p = profileOf(h), i = pickedRank(h), R = T.ranks[i];
  const tapped = rankAt[h] != null, op = opens(h, i);
  if (i > p.rank){
    const nx = rankNeeds(h, p, i);
    return '<div class="pf-next' + (tapped ? ' picked' : '') + '"><h4>' + (i === p.rank + 1 ? 'NEXT' : 'LATER') + ' · ' + esc(R.nm) + '</h4>' +
      '<ul>' + nx.map(n => needLine(n, h)).join('') + '</ul>' + (op.length ? '<span class="pf-op">IT OPENS</span>' + chips(op) : '') + '</div>';
  }
  return '<div class="pf-next held' + (tapped ? ' picked' : '') + '"><h4>' + (i === p.rank ? (i === T.ranks.length - 1 ? 'TOP RANK' : 'YOUR RANK') : 'EARNED') + ' · ' + esc(R.nm) + '</h4>' +
    '<p class="pf-rline">' + esc(R.line) + '</p>' + (op.length ? '<span class="pf-op">IT OPENED</span>' + chips(op) : '') + '</div>';
}
// THE METER, drawn: dark on the left, light on the right, the two zones past the lean mark where a side's cards unlock
function meter(h, big = false){
  const W = ALIGN_WORDS[h] || ALIGN_WORDS.jedi, a = alignOf(h), lean = leanOf(h);
  const mark = (v) => ((v + ALIGN.max) / (2 * ALIGN.max) * 100).toFixed(1) + '%';
  const now = lean ? Math.abs(Math.round(a)) + ' ' + W[lean] : 'BALANCED';
  return '<div class="pf-align al-' + (lean || 'mid') + (big ? ' big' : '') + '">' +
    '<div class="pf-al-h"><span class="pf-al-t">' + esc(W.title) + '</span><em>' + esc(now) + '</em></div>' +
    '<div class="pf-al-bar"><span class="zone dk" style="width:' + mark(-ALIGN.lean) + '"></span><span class="zone lt" style="left:' + mark(ALIGN.lean) + '"></span>' +
    '<i class="lean" style="left:' + mark(-ALIGN.lean) + '"></i><i class="lean" style="left:' + mark(ALIGN.lean) + '"></i><b style="left:' + mark(a) + '"></b></div>' +
    '<div class="pf-al-ends"><span class="dk">' + esc(W.dark) + '</span>' + (big ? '<span class="mid">cards unlock past ' + ALIGN.lean + ' on either side</span>' : '') + '<span class="lt">' + esc(W.light) + '</span></div>' +
    (big ? '' : '<p class="pf-al-line">' + esc(W.line[alignStage(h)]) + '</p>') + '</div>';
}
function leftCol(h){
  const T = track(h), p = profileOf(h), R = T.ranks[p.rank];
  return `<div class="pf-col pf-left">
    <div class="pf-who"><div class="pf-kick">${esc(T.name)} · ${esc(HERO_NAME[h])}</div>
    <div class="pf-rank">${esc(R.nm)}</div>
    <div class="pf-xp"><b>${num(p.xp)}</b> ${esc(T.unit)}</div></div>
    ${journey(h)}
    ${rankBox(h)}
    ${meter(h)}
    <p class="pf-how">${esc(T.unit)} comes from story chapters, missions, challenges, duels and survival.</p>
  </div>`;
}

/* ---------- OVERVIEW: one tile per thing you own, each a picture first and a button to its page ---------- */
const tile = (cls, title, body, go, goLabel) => '<div class="pf-tile ' + cls + '"><h4>' + title + '</h4>' + body + (go ? '<span class="btn pf-go" data-view="' + go + '">' + goLabel + ' ›</span>' : '') + '</div>';
// a ring that fills to have / need
const ring = (have, need, inner) => '<div class="pf-ring" style="--f:' + (need ? Math.min(1, have / need) : 0) + '"><span>' + inner + '</span></div>';
function homeCol(h){
  const p = profileOf(h), set = SET_OF[h];
  // the tree: how many of its cards are open to train, as a ring
  const own = set.filter(s => owns(h, s)).length, fresh = set.filter(s => isNew(h, s)).length;
  const treeT = tile('pf-t-deck', esc(TREES[h].nm) + (fresh ? ' <em class="pf-new">' + fresh + ' NEW</em>' : ''),
    '<div class="pf-row">' + ring(own, set.length, own + '/' + set.length) + '<div><p class="pf-big"><b>' + own + '</b> cards open</p><p class="pf-note">Spend Training points on them at each chapter\'s close.</p></div></div>', 'tree', 'OPEN TREE');
  // the path: which way you lean, and how many of that side's cards are open
  const W = ALIGN_WORDS[h] || ALIGN_WORDS.jedi, lean = leanOf(h), tree = PATH_TREE[h];
  const openN = (side) => tree.filter(n => n.align === side && alignOpen(n)).length;
  const sideT = tile('pf-t-side', esc(W.light) + ' &amp; ' + esc(W.dark),
    '<div class="pf-sidecount"><div class="dk"><b>' + openN('dark') + '</b>/3<span>' + esc(W.dark) + '</span></div><div class="lt"><b>' + openN('light') + '</b>/3<span>' + esc(W.light) + '</span></div></div>' +
    '<p class="pf-note">' + (lean ? 'You lean ' + esc(W[lean]) + '.' : 'Balanced: lean past ' + ALIGN.lean + ' to unlock a side.') + '</p>', 'sides', 'SEE PATHS');
  return `<div class="pf-col pf-right">
    ${viewTabs(h)}
    <div class="pf-mob">${rankAt[h] != null ? '' : rankBox(h)}${meter(h)}</div>
    <div class="pf-tiles">${treeT}${sideT}${gearTile(h)}${ngTile(h)}${recTile(p, h)}</div>
  </div>`;
}
// YOUR SABER / YOUR KIT: what's fitted, the parts as a ring, the nearest next one (the benches have the rest)
function gearTile(h){
  const mine = (loadPicks()[h]) || {}, at = (id) => wornOption(h, CUSTOMIZE[h].find(r => r.id === id), mine);
  let col, title, sub;
  if (h === 'jedi'){
    const c = crystalOf(at('saber').id);
    col = c.col; title = at('hilt').name.toUpperCase() + ' HILT'; sub = c.name;
  } else {
    const side = benchOf(h).find(r => r.id === SIDE_ROW[h]), part = side.parts.find(p => p.id === at(side.id).id) || side.parts[0];
    col = part.col; title = side.label; sub = part.att;
  }
  const next = (h === 'jedi' ? EARNABLE : earnableOf(h)).map(([row, part]) => ({ part, e: earnProgress(profileOf(h), part.earn) }))
    .filter(x => x.e.have < x.e.need).sort((a, b) => (b.e.have / b.e.need) - (a.e.have / a.e.need))[0];
  const c = col != null ? '#' + col.toString(16).padStart(6, '0') : 'var(--accent)';
  return tile('pf-t-gear', h === 'jedi' ? 'YOUR SABER' : 'YOUR KIT',
    '<div class="pf-row">' + ring(partsOwned(h), partsTotal(h), partsOwned(h) + '/' + partsTotal(h)) +
    '<div class="pf-sb"><i style="--c:' + c + '"></i><div><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div></div></div>' +
    (next ? '<p class="pf-note">Next part: <b>' + esc(next.part.name) + '</b>' + (next.e.need > 1 ? '<span class="pf-mbar"><i style="width:' + pct(next.e.have / next.e.need) + '"></i></span>' : '') + '<span class="pf-sub">' + esc(earnText(next.part.earn, (id) => chapterName(id, h))) + '</span></p>' : '<p class="pf-note">Every part is yours.</p>'));
}
// NEW GAME+ (data/ngplus.js), once the campaign is beaten: the tiers as pips, the next one named
function ngTile(h){
  const p = profileOf(h); if (!(p.won > 0)) return '';
  const best = ngBest(h), t = ngNextTier(h);
  const pips = Array.from({ length: MAX_TIER }, (_, i) => '<i class="' + (i < best ? 'on' : '') + '" title="' + esc(tierName(i + 1)) + '"></i>').join('');
  return tile('pf-t-ng', 'NEW GAME+', '<div class="pf-pips big">' + pips + '</div><p class="pf-note">' + (best >= MAX_TIER ? 'Every tier is beaten.' : 'Next: <b class="pf-hl">' + esc(tierName(t)) + '</b>, from CAMPAIGN.') + '</p>');
}
// the RECORD: what's been earned, as big numbers (zeros are hidden; a new hero gets one line instead)
function recTile(p, h){
  const rec = [['CHAPTERS', Object.keys(p.cleared).length], ['TRIALS', trialsPassed(p) + ' / 3'], ['MISSIONS', Object.keys(p.missions).length],
               ['CAMPAIGN WINS', p.won], ['DUELS WON', p.duels], h === 'jedi' ? ['FORM RANKS', p.forms] : ['MASTERY RANKS', p.powers],
               ['SIDE MISSIONS', Object.keys(p.sides || {}).length], ['MEDALS', medalTotal(h)], ['SECRETS', Object.keys(p.secrets || {}).length],
               ['SPARED', (p.mercy || {}).spared || 0], ['STRUCK DOWN', (p.mercy || {}).struck || 0],
               ...((p.ng && p.ng.runs) ? [['NEW GAME+ WINS', p.ng.runs]] : [])];
  const got = rec.filter(r => !/^0(\b| \/)/.test(String(r[1])));
  return tile('pf-t-rec', 'RECORD', got.length ? '<div class="pf-rec">' + got.map(r => '<div><b>' + r[1] + '</b><span>' + r[0] + '</span></div>').join('') + '</div>'
    : '<p class="pf-note">Clear a chapter or win a mission to start your record.</p>');
}

/* ---------- THE TREE, every hero's: each card the run can train, on its branch, by tier (data/profile.js TREES). THE
   ROOT at the top, a line to each branch's plate, and down each branch its cards in tier rows: FOUNDATION, DISCIPLINE,
   CAPSTONE. The light and dark cards are the far branch, THE PATH. Between runs it shows what's open for good (your rank,
   your lean) and what's locked and why. At a chapter's close (openRunTree, from ui/store-ui.js) it IS the upgrade page:
   tap a card, then TRAIN · 1 POINT ranks it for this run, and its line lights up. One card's detail sits over the tree. */
let runMode = null;   // the chapter-close page's hooks: { train(s), skillSet, points(), next() }, while it is open
const inRun = (h) => !!runMode && h === G.hero;
const branchesOf = (h) => {
  const W = ALIGN_WORDS[h] || ALIGN_WORDS.jedi;
  return [...TREES[h].branches, { id: 'path', nm: 'THE PATH', line: W.light + ' or ' + W.dark }];
};
const tierWord = (t) => TIER_NAME[t];
// why a tier waits in this run: its chapter (the story), or more points spent first
function tierGate(t){
  if (!tierStoryOpen(t)) return tierWord(t) + ' opens in Act ' + (TIER_CHAPTER[t] === 'mustafar' ? 'III' : 'II');
  const more = TIER_REQ[t] - (G.skillSpent || 0);
  return more > 0 ? tierWord(t) + ' opens after ' + more + ' more trained' : '';
}
// one card's state on the tree. In a run: 'max' (trained to the top), 'open' (trainable now), 'nopts' (open, no points),
// 'gate' (its tier waits), 'out' (a rival pick closed it), 'lock' (not yours yet). Between runs: 'have' or 'lock'.
function nodeOf(h, s){
  const mine = owns(h, s);
  if (!inRun(h)) return { st: mine ? 'have' : 'lock', r: 0, tag: mine ? (isNew(h, s) ? 'NEW' : 'OPEN') : shortLock(h, s) };
  const r = skillRank(s.id);
  if (r >= s.max) return { st: 'max', r, tag: 'TRAINED' };
  if (!mine) return { st: 'lock', r, tag: shortLock(h, s) };
  if (s.avail && !s.avail()) return { st: 'out', r, tag: s.availTag || 'CLOSED' };   // (availTag: why it waits, e.g. no jetpack yet)
  const gate = tierGate(s.tier);
  if (gate) return { st: 'gate', r, tag: 'LATER', why: gate };
  return runMode.points() > 0 ? { st: 'open', r, tag: r ? 'RANK ' + (r + 1) : 'TRAIN' } : { st: 'nopts', r, tag: r ? 'RANK ' + r : 'NO POINTS' };
}
function shortLock(h, s){
  if (s.align) return leanOf(h) === s.align ? 'AT ' + rankNm(h, ALIGN_RANK[h][s.tier]) : 'LEAN ' + sideWord(h, s.align);
  if (s.rank) return 'AT ' + rankNm(h, s.rank);
  if (s.prof) return 'AT ' + rankNm(h, tierRank(s.tier));
  return 'LOCKED';
}
const rankNm = (h, id) => ((track(h).ranks.find(r => r.id === id) || {}).nm || 'A HIGHER RANK');
const pipsOf = (s, r) => s.max > 1 ? '<span class="pf-tp">' + Array.from({ length: s.max }, (_, i) => '<i class="' + (i < r ? 'on' : '') + '"></i>').join('') + '</span>' : '';
function treeDetail(h, s){
  if (!s) return '<aside class="pf-detail pf-tdet"><p class="pf-note">Tap a card on the tree.</p></aside>';
  const N = nodeOf(h, s), B = branchesOf(h).find(b => b.id === branchOf(h, s));
  let act;
  if (inRun(h)){
    act = N.st === 'max' ? '<p class="pf-got">✓ FULLY TRAINED</p>'
      : N.st === 'open' ? '<span class="btn pf-add pf-learn" data-train="' + s.id + '">TRAIN · 1 POINT' + (s.max > 1 ? ' · RANK ' + (N.r + 1) + ' OF ' + s.max : '') + '</span>'
      : N.st === 'nopts' ? '<p class="pf-lock">No Training points left. ' + esc(runMode.next()) + '</p>'
      : N.st === 'gate' ? '<p class="pf-lock">' + LOCK + esc(N.why) + '.</p>'
      : N.st === 'out' ? '<p class="pf-lock">' + LOCK + 'Closed this run: you took the other side of this choice.</p>'
      : lockSteps(h, s);
  } else act = N.st === 'have' ? '<p class="pf-got">✓ OPEN: train it in a run with Training points</p>' : lockSteps(h, s);
  return '<aside class="pf-detail pf-tdet' + (s.align ? ' al-' + s.align : '') + (N.st === 'lock' ? ' shut' : '') + '"><div class="pf-dh"><span class="pf-orb">' + icon(s.ico) + '</span><div><b>' + esc(s.nm) + '</b><span>' +
    tierWord(s.tier) + ' · ' + esc(B ? B.nm : '') + (s.max > 1 ? ' · UP TO ' + s.max + ' RANKS' : '') + '</span>' + (inRun(h) ? pipsOf(s, N.r) : '') + '</div></div>' +
    '<div class="pf-dbody">' + dsHtml(s.ds) + (s.fl ? '<p class="pf-fl">' + esc(s.fl) + '</p>' : '') + '</div><div class="pf-dact">' + act + '</div></aside>';
}
function lockSteps(h, s){
  if (s.align) return unlockSteps(h, s);
  return '<p class="pf-lock">' + LOCK + esc(lockWhy(h, s)) + '</p>';
}
// where everything sits. Wide: the branches side by side under THE ROOT. Narrow (a phone): each branch its own block,
// stacked, full width. x in % of the tree's width, y in px; the links are one SVG stretched over it
// keep (a phone, at a chapter's close): only these cards, in rows of three under their plate, so what you can train is all there is
function treeLayout(h, narrow, keep = null, fit = TREE_MIN){
  const B = branchesOf(h), set = SET_OF[h], pos = [], heads = [];
  const of = (b, t) => {
    const list = set.filter(s => branchOf(h, s) === b && s.tier === t);
    return b === 'path' ? [...list.filter(s => s.align === 'dark'), ...list.filter(s => s.align === 'light')] : list;
  };
  let H;
  // a branch is as wide as its busiest tier (two slots at least), and each card gets one slot's width for its name
  const slots = (b) => Math.max(2, ...[1, 2, 3].map(t => of(b.id, t).length));
  if (!narrow){
    const total = B.reduce((n, b) => n + slots(b), 0), rows = wideRows(fit);
    let x0 = 0;
    B.forEach((b) => {
      const w = 100 * slots(b) / total, sw = w / slots(b);
      heads.push({ b, x: x0 + w / 2, y: rows.head, w, x0 });
      for (const t of [1, 2, 3]){ const L = of(b.id, t); L.forEach((s, k) => pos.push({ s, b: b.id, t, x: x0 + sw * (k + .5 + (slots(b) - L.length) / 2), y: rows[t], sw })); }
      x0 += w;
    });
    H = fit;
  } else if (keep){
    let y0 = 0;
    B.forEach((b) => {
      const list = [1, 2, 3].flatMap(t => of(b.id, t)).filter(keep);
      heads.push({ b, x: 50, y: y0 + 26, w: 100, none: !list.length });
      for (let i = 0; i < list.length; i += 3){
        const L = list.slice(i, i + 3), t = i / 3 + 1;
        L.forEach((s, k) => pos.push({ s, b: b.id, t, x: 100 * (k + 1) / (L.length + 1), y: y0 + 26 + 90 * t, sw: 100 / 3 }));
      }
      y0 += 26 + (list.length ? 90 * Math.ceil(list.length / 3) + 50 : 46);
    });
    H = y0 - 14;
  } else {
    let y0 = 0;
    B.forEach((b) => {
      heads.push({ b, x: 50, y: y0 + 26, w: 100 });
      for (const t of [1, 2, 3]){ const L = of(b.id, t); L.forEach((s, k) => pos.push({ s, b: b.id, t, x: 100 * (k + 1) / (L.length + 1), y: y0 + 26 + 90 * t, sw: 100 / 3 })); }
      y0 += 26 + 90 * 3 + 50;
    });
    H = y0 - 14;
  }
  // each card hangs from the nearest card on its branch's row above, or from the branch's plate
  for (const p of pos){
    const above = pos.filter(q => q.b === p.b && q.t < p.t), tt = Math.max(0, ...above.map(q => q.t));
    const row = above.filter(q => q.t === tt);
    p.from = row.length ? row.reduce((a, q) => Math.abs(q.x - p.x) < Math.abs(a.x - p.x) ? q : a) : heads.find(x => x.b.id === p.b);
  }
  return { B, pos, heads, H };
}
// the wide tree, top to bottom: THE ROOT, the branch plates (hh tall), then FOUNDATION, DISCIPLINE and CAPSTONE sharing
// what's left. It is at least TREE_MIN tall and grows to fill its column (fitTree), so the rows spread out on a tall screen.
// A card's orb sits a little above its share's middle, its name and pips hanging below it.
// A short tree (the Profile's own TREE tab, under its tabs and detail) keeps the same room under the root and wears
// slimmer plates instead.
const TREE_MIN = 400, ROOT_Y = 30;
function wideRows(H){
  const short = H < 470, ht = short ? 90 : 96, hh = short ? 50 : 56, top = ht + hh + 6, slot = (H - top - 6) / 3;
  return { head: ht + hh / 2, hh, top, 1: top + slot * .5 - 19, 2: top + slot * 1.5 - 19, 3: top + slot * 2.5 - 19 };
}
let treeH = TREE_MIN;   // the wide tree's height, as fitTree last measured it
const narrowNow = () => window.matchMedia('(max-width:760px)').matches;
let lastNarrow = null;
function treeCol(h){
  const narrow = narrowNow(), run = inRun(h);
  // a phone at a chapter's close lists only what you can train (or have trained), unless SHOW ALL is on
  const trim = run && narrow && !showAll, live = (s) => { const N = nodeOf(h, s); return N.r > 0 || N.st === 'open' || N.st === 'nopts'; };
  const L = treeLayout(h, narrow, trim ? live : null, treeH), R = wideRows(L.H);
  lastNarrow = narrow;
  const info = new Map(L.pos.map(p => [p.s, nodeOf(h, p.s)]));
  const pick = (L.pos.find(p => p.s.id === treeSel[h]) || L.pos.find(p => info.get(p.s).st === 'open') || L.pos.find(p => info.get(p.s).st === 'have') || L.pos[0] || {}).s;
  const lineOf = (N) => run ? (N.r > 0 ? 'lit' : N.st === 'open' ? 'ready' : 'dim') : N.st === 'have' ? 'lit' : 'dim';
  const links = [];
  const link = (x1, y1, x2, y2, st) => {
    const d = 'M' + x1 * 10 + ' ' + y1 + ' C' + x1 * 10 + ' ' + (y1 + y2) / 2 + ' ' + x2 * 10 + ' ' + (y1 + y2) / 2 + ' ' + x2 * 10 + ' ' + y2;
    links.push('<path class="pf-lu ' + st + '" d="' + d + '"/><path class="pf-ln ' + st + '" d="' + d + '"/>');
  };
  const stOf = (b) => { const ns = L.pos.filter(p => p.b === b).map(p => lineOf(info.get(p.s))); return ns.includes('lit') ? 'lit' : ns.includes('ready') ? 'ready' : 'dim'; };
  // the root's lines leave from under its orb and land on each plate's top; a branch's lines leave from under its plate
  if (!narrow) for (const hd of L.heads) link(50, ROOT_Y + 26, hd.x, hd.y - R.hh / 2, stOf(hd.b.id));
  for (const p of L.pos){
    const f = p.from, fy = f.s ? f.y : f.y + (narrow ? 26 : R.hh / 2);
    link(f.x, fy, p.x, p.y, lineOf(info.get(p.s)));
  }
  const nodes = L.pos.map(p => {
    const s = p.s, N = info.get(s);
    return '<span class="pf-tnode t-' + N.st + (N.r > 0 ? ' ranked' : '') + (s.align ? ' al-' + s.align : '') + (pick === s ? ' sel' : '') + '" data-node="' + s.id + '" style="left:' + p.x + '%;top:' + p.y + 'px;width:calc(' + p.sw + '% - 4px)" role="button" tabindex="0" aria-label="' + esc(s.nm) + ', ' + N.tag + '">' +
      '<span class="pf-orb">' + icon(s.ico) + (N.st === 'lock' ? '<i class="pf-lk">' + LOCK + '</i>' : N.st === 'max' ? '<i class="pf-in">✓</i>' : '') + '</span>' +
      '<span class="pf-tl"><b>' + esc(s.nm) + '</b>' + (run && s.max > 1 && (N.r > 0 || ['open', 'nopts', 'max'].includes(N.st)) ? pipsOf(s, N.r) : '<em>' + N.tag + '</em>') + '</span></span>';
  }).join('');
  const heads = L.heads.map(hd => '<div class="pf-fhead' + (hd.b.id === 'path' ? ' pf-fpath' : '') + '" style="left:' + hd.x + '%;top:' + hd.y + 'px;width:calc(' + hd.w + '% - 12px)' + (narrow ? '' : ';height:' + R.hh + 'px') + '"><b>' + esc(hd.b.nm) + '</b><span class="pf-bl">' + esc(hd.none ? 'Nothing to train here yet' : hd.b.line) + '</span></div>').join('');
  // wide: each tier's name down the left edge, a faint band under each branch (its column, from its plate down), a rule between tiers
  const ranks = narrow ? '' : L.heads.map(hd => '<span class="pf-fband' + (hd.b.id === 'path' ? ' path' : '') + '" style="left:calc(' + hd.x0 + '% + 6px);width:calc(' + hd.w + '% - 12px);top:' + R.head + 'px"></span>').join('') +
    [2, 3].map(t => '<span class="pf-frule" style="top:' + Math.round(R.top + (L.H - R.top - 6) / 3 * (t - 1)) + 'px"></span>').join('') +
    [1, 2, 3].map(t => '<span class="pf-ftier" style="top:' + (R[t] + 19) + 'px">' + tierWord(t) + '</span>').join('');
  const root = narrow ? '' : '<div class="pf-froot' + (run ? ' lit' : '') + '" style="left:50%;top:' + ROOT_Y + 'px"><span class="pf-orb">' + icon('❂') + '</span><span class="pf-tl"><em>' + esc(TREES[h].nm) + '</em></span></div>';
  const note = 'Every card you can train in a run. Your rank and your lean open more of them for good. In a run, Training points rank them up at each chapter\'s close.';
  return `<div class="pf-col pf-right${narrow ? '' : ' pf-treecol'}">
    ${run ? '' : '<div class="pf-fth">' + viewTabs(h) + '<p class="pf-note pf-tnote">' + note + '</p></div>'}
    ${treeDetail(h, pick)}
    <div class="pf-ftree${narrow ? ' narrow' : L.H < 470 ? ' short' : ''}${run ? ' pf-runtree' : ''}"${narrow ? ' style="height:' + L.H + 'px"' : ''}>${ranks}<svg class="pf-flinks" viewBox="0 0 1000 ${L.H}" preserveAspectRatio="none" aria-hidden="true">${links.join('')}</svg>${root}${heads}${nodes}</div>
    ${run && narrow ? '<span class="btn pf-showall" data-showall="1">' + (showAll ? 'SHOW ONLY WHAT I CAN TRAIN' : 'SHOW ALL CARDS') + '</span>' : ''}
  </div>`;
}
const treeSel = {};   // per hero: the tree card whose detail shows
let showAll = false;   // a phone at a chapter's close: every card on the tree, not only the trainable ones

/* ---------- PATHS: the two sides drawn as two chains of three, the meter over them, one card's detail beside ---------- */
// what moves each hero's meter, in a line
const HOW_LEAN = {
  jedi: 'Story choices, and sparing or striking down beaten foes, move this meter.',
  mando: 'Story choices, and sparing or finishing beaten foes, move this meter.',
  trooper: 'Story choices, and sparing or finishing beaten foes, move this meter.',
};
const sideWord = (h, side) => (ALIGN_WORDS[h] || ALIGN_WORDS.jedi)[side];
// what a locked path card still needs, as two ticks: lean its way, and the rank
function unlockSteps(h, n){
  const W = ALIGN_WORDS[h] || ALIGN_WORDS.jedi, a = Math.round(alignOf(h)), lean = leanOf(h);
  const R = track(h).ranks.find(r => r.id === ALIGN_RANK[h][n.tier]);
  const now = lean ? Math.abs(a) + ' ' + W[lean] : 'balanced';
  const leanOk = lean === n.align, rankOk = R ? hasRank(h, R.id) : true;
  const li = (ok, t) => '<li class="' + (ok ? 'ok' : '') + '"><i>' + (ok ? '✓' : '○') + '</i>' + t + '</li>';
  return '<ul class="pf-unlock"><span>TO UNLOCK</span>' + li(leanOk, 'Lean ' + esc(W[n.align]) + ' past ' + ALIGN.lean + ' <em>(you: ' + esc(now) + ')</em>') +
    (R ? li(rankOk, 'Reach ' + esc(R.nm) + (rankOk ? '' : ' <em>(you: ' + esc(track(h).ranks[profileOf(h).rank].nm) + ')</em>')) : '') + '</ul>';
}
function sidesCol(h){
  const lean = leanOf(h), tree = PATH_TREE[h];
  const pick = selOf(h, [...tree.filter(n => n.align === (lean || 'dark')), ...tree.filter(n => n.align !== (lean || 'dark'))]);
  // dark on the left and light on the right, as the meter reads
  const cols = ['dark', 'light'].map(side => {
    const P = PATH_WORDS[h].find(x => x.id === side);
    const nodes = tree.filter(n => n.align === side).sort((x, y) => x.tier - y.tier).map(n => {
      const open = alignOpen(n), R = track(h).ranks.find(r => r.id === ALIGN_RANK[h][n.tier]);
      return '<div class="pf-pnode ' + (open ? 'open' : 'shut') + (pick === n ? ' sel' : '') + '" data-card="' + n.id + '"><span class="pf-orb">' + icon(n.ico) + (open ? '' : '<i class="pf-lk">' + LOCK + '</i>') + '</span>' +
        '<div><b>' + esc(n.nm) + (isNew(h, n) ? ' ' + NEW_TAG : '') + '</b><span>' + (open ? 'UNLOCKED' : 'TIER ' + n.tier + (R ? ' · ' + esc(R.nm) : '')) + '</span></div></div>';
    }).join('');
    return '<div class="pf-pside al-' + side + (lean === side ? ' path' : '') + '"><div class="pf-bh"><b>' + esc(P.nm) + '</b>' + (lean === side ? '<em class="pf-got">YOU LEAN HERE</em>' : '') + '</div>' +
      '<p class="pf-bl">' + esc(P.line) + '</p><div class="pf-chain">' + nodes + '</div></div>';
  }).join('');
  return `<div class="pf-col pf-right">
    ${viewTabs(h)}
    ${meter(h, true)}
    <p class="pf-note pf-sides-note">${esc(HOW_LEAN[h] || HOW_LEAN.jedi)} Both sides are equally strong: they just play differently.</p>
    <div class="pf-split"><div class="pf-sides">${cols}</div>${detail(h, pick)}</div>
  </div>`;
}

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
function viewTabs(h){
  const W = ALIGN_WORDS[h] || ALIGN_WORDS.jedi;
  const tabs = [['home', 'OVERVIEW'], ['tree', TREES[h].nm], ['sides', W.light + ' & ' + W.dark]];
  return '<div class="cz-tabs pf-vtabs">' + tabs.map(v => '<span data-view="' + v[0] + '"' + (view === v[0] ? ' class="on"' : '') + '>' + esc(v[1]) + '</span>').join('') + '</div>';
}
function lockWhy(h, s){
  if (s.align){
    const R = track(h).ranks.find(r => r.id === ALIGN_RANK[h][s.tier]);
    return leanOf(h) === s.align ? 'UNLOCKS AT ' + (R ? R.nm : 'A HIGHER RANK') : 'LEAN ' + sideWord(h, s.align) + ' TO UNLOCK';
  }
  if (s.prof) return 'UNLOCKS AT ' + rankNm(h, tierRank(s.tier));
  const R = track(h).ranks.find(r => r.id === s.rank);
  return 'UNLOCKS AT ' + (R ? R.nm : 'A HIGHER RANK');
}
// the path card whose detail shows: the one picked, if it's in this list, or the list's first
function selOf(h, list){ return list.find(s => s.id === sel[h]) || list[0] || null; }
// ONE PATH CARD, in full: what it does, its line, and what unlocks it
function detail(h, s){
  if (!s) return '<aside class="pf-detail"><p class="pf-note">Nothing here yet.</p></aside>';
  const mine = owns(h, s);
  const act = mine ? '<p class="pf-got">✓ OPEN: train it in a run with Training points</p>' : unlockSteps(h, s);
  const side = s.align ? '<span class="pf-tier-k al-' + s.align + '">' + esc(sideWord(h, s.align)) + '</span>' : '';
  return '<aside class="pf-detail' + (s.align ? ' al-' + s.align : '') + (mine ? '' : ' shut') + '"><div class="pf-dh"><span class="pf-orb">' + icon(s.ico) + '</span><div><b>' + esc(s.nm) + '</b><span>' + TIER_NAME[s.tier] + (s.max > 1 ? ' · UP TO ' + s.max + ' RANKS' : '') + '</span></div>' + side + '</div>' +
    dsHtml(s.ds) + (s.fl ? '<p class="pf-fl">' + esc(s.fl) + '</p>' : '') + '<div class="pf-dact">' + act + '</div></aside>';
}

let pendingSeen = null;   // [hero, card ids]: what CARDS or PATHS showed, seen once you leave it
function flushSeen(){ if (pendingSeen){ seeCards(...pendingSeen); pendingSeen = null; } }
let entering = false;   // the panel's entrance plays on opening, not on every redraw
function render(){
  if (runMode) return renderRun();
  const right = view === 'tree' ? treeCol(hero) : view === 'sides' ? sidesCol(hero) : homeCol(hero);
  panel.dataset.hero = hero;   // the panel wears the shown hero's look (styles/heroes/tokens.css), whoever is being played
  panel.innerHTML = `<div class="howto-panel pf-panel hero-${hero}${entering ? ' enter' : ''}">
    <div class="howto-head"><div class="howto-title">PROFILE</div><div class="rm-sub">Your rank and cards, shared by every mode</div><div class="howto-x" id="pfclose">✕</div></div>
    <div class="cz-tabs pf-tabs">${Object.keys(HERO_NAME).map(h => '<span data-h="' + h + '"' + (h === hero ? ' class="on"' : '') + '>' + HERO_NAME[h] + '</span>').join('')}</div>
    <div class="pf-body${runLive() ? ' pf-live' : ''}">${leftCol(hero)}${right}</div>
    <div class="pf-foot"><span class="btn pf-wipe${armed ? ' armed' : ''}" data-reset="profile">${armed ? 'CLICK AGAIN TO RESET ' + HERO_NAME[hero] : 'RESET THIS PROFILE'}</span></div>
  </div>`;
  seenFresh(hero);
  // the cards on screen in the TREE or PATHS count as seen once you leave the view (their NEW stays while you look);
  // a profile's first look sees all it owns
  const owned = SET_OF[hero].filter(s => owns(hero, s)).map(s => s.id);
  if (!cardsSeen(hero)) seeCards(hero, owned);
  else if (view === 'tree' || view === 'sides') pendingSeen = [hero, view === 'sides' ? PATH_TREE[hero].filter(n => owns(hero, n)).map(n => n.id) : owned];
  refreshButton();
  watchTree();
}
// the wide tree grows to fill its column (CSS: flex, at least TREE_MIN tall); once drawn, its real height is measured and,
// if it isn't what the rows were laid out for, it is drawn again to fit. A resize does the same.
const treeRO = typeof ResizeObserver === 'function' ? new ResizeObserver(() => requestAnimationFrame(fitTree)) : null;
function fitTree(){
  const el = panel.querySelector('.pf-ftree:not(.narrow)');
  if (!el || !panel.classList.contains('open')) return;
  const h = Math.max(TREE_MIN, Math.round(el.clientHeight));
  if (Math.abs(h - treeH) > 3){ treeH = h; render(); }
}
function watchTree(){
  if (!treeRO) return;
  treeRO.disconnect();
  const el = panel.querySelector('.pf-ftree:not(.narrow)');
  if (el) treeRO.observe(el);
}

/* ---------- THE CHAPTER'S CLOSE: the upgrade page (ui/store-ui.js openSkillTree) is this panel. It moves into the page
   and shows the hero's tree to train; the page's own head (where you are, XP, Training points) runs across the top, and its
   other sections (survival's boons and powers, the story's new powers, mastery) and CONTINUE sit in the left column. The
   page keeps filling them in itself; closing it puts everything back. ---------- */
const home = { parent: panel.parentNode, next: panel.nextSibling };
let runParts = null;
function runPartsOf(st){
  return runParts ||= { head: st.querySelector('.st-head'), side: ['#boonsec', '#abilsec', '#powsec', '#mastsec', '#skillgoals'].map(q => st.querySelector(q)), foot: st.querySelector('.st-foot') };
}
// hooks: { train(s) (rank a card up, false if it can't), points() (Training points to spend), next() (how the next one comes, in words) }
export function openRunTree(hooks){
  const st = document.getElementById('skilltree');
  flushSeen();
  runMode = hooks; hero = HERO_NAME[G.hero] ? G.hero : 'jedi'; treeSel[hero] = null; showAll = false;
  runPartsOf(st);
  st.classList.add('pfrun');
  if (panel.parentNode !== st) st.appendChild(panel);
  panel.classList.add('open', 'pf-inrun');
  entering = true; render(); entering = false;
}
export function refreshRunTree(){ if (runMode) render(); }
export function closeRunTree(){
  const st = document.getElementById('skilltree');
  runMode = null;
  if (panel.parentNode !== st) return;
  const P = runParts, scroll = st.querySelector('.st-scroll');
  scroll.append(P.head, ...P.side);   // (the page's order: head, boons, new powers, survival powers, mastery, goals)
  st.appendChild(P.foot);
  st.classList.remove('pfrun');
  panel.classList.remove('open', 'pf-inrun');
  home.parent.insertBefore(panel, home.next);
}
export const runTreeOpen = () => !!runMode;
function renderRun(){
  const P = runParts, keep = [...panel.querySelectorAll('.pf-col')].map(c => c.scrollTop);   // (a tap redraws: the columns stay where they were scrolled)
  panel.dataset.hero = hero;
  panel.innerHTML = `<div class="howto-panel pf-panel pf-run hero-${hero}${entering ? ' enter' : ''}">
    <div class="pf-runhead"></div>
    <div class="pf-body"><div class="pf-col pf-left pf-runside"></div>${treeCol(hero)}</div>
    <div class="pf-foot pf-runfoot"></div>
  </div>`;
  panel.querySelector('.pf-runhead').append(P.head);
  panel.querySelector('.pf-runside').append(...P.side);
  panel.querySelector('.pf-runfoot').append(P.foot);
  panel.querySelectorAll('.pf-col').forEach((c, i) => { c.scrollTop = keep[i] || 0; });
  watchTree();
}

export function setProfile(open){
  flushSeen();
  if (runMode && G.skillSelect) return;   // (the upgrade page is up: it closes with CONTINUE)
  if (open){ closeRunTree(); hero = ['jedi', 'mando', 'trooper'].includes(G.hero) ? G.hero : 'jedi'; armed = false; entering = true; render(); entering = false; }
  panel.classList.toggle('open', open);
}
export const profileOpen = () => panel.classList.contains('open') && !runMode;

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // never launches or resumes the game
  audioInit();
  const t = e.target;
  const tr = t.closest('[data-train]'), nd = !tr && t.closest('[data-node]');
  if (tr && runMode){ const s = SET_OF[hero].find(x => x.id === tr.dataset.train); if (s && runMode.train(s)) treeSel[hero] = s.id; return render(); }
  if (nd){ treeSel[hero] = nd.dataset.node; return render(); }
  if (t.closest('[data-showall]')){ showAll = !showAll; return render(); }
  if (runMode) return;   // (the upgrade page: its own cards and CONTINUE take their own clicks)
  const vt = t.closest('[data-view]'), cd = t.closest('[data-card]'), rk = t.closest('[data-rank]');
  if (vt){ if (vt.dataset.view !== view) flushSeen(); view = vt.dataset.view; return render(); }
  if (cd){ sel[hero] = cd.dataset.card; return render(); }
  if (rk){ const i = +rk.dataset.rank; rankAt[hero] = rankAt[hero] === i ? null : i; return render(); }
  const tab = t.closest('[data-h]'), reset = t.closest('[data-reset]');
  if (t.closest('#pfclose') || t === panel) return setProfile(false);
  if (tab){ flushSeen(); hero = tab.dataset.h; armed = false; render(); }
  else if (reset && reset.dataset.reset === 'profile'){ if (armed){ resetProfile(hero); armed = false; } else armed = true; render(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && profileOpen()) setProfile(false); });
// a tree node is a focusable button: Enter or Space picks it, as a tap does
panel.addEventListener('keydown', (e) => { const nd = (e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.pf-tnode'); if (nd){ e.preventDefault(); nd.click(); } });
btn.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setProfile(true); });
// the tree lays out differently on a phone: a turn or a resize across the line redraws it
window.addEventListener('resize', () => { if (panel.classList.contains('open') && (runMode || view === 'tree') && lastNarrow !== null && narrowNow() !== lastNarrow) render(); });

/* ---------- the PROFILE button's NEW, and a rank earned away from a chapter's close ---------- */
function refreshButton(){ btn.classList.toggle('fresh', anyFresh()); }
onPromote((h, r) => {
  refreshButton();
  if (G.mode !== 'play') return;
  const R = track(h).ranks[r];
  upToast('RANK EARNED · ' + R.nm, 'New cards open on your ' + TREES[h].nm + ' · train them when a chapter ends', 'mast');
});
// a saber part earned mid-fight (game/profile.js settleParts; at a chapter's close it is a card instead)
onPart((what, part, line, hero = 'jedi') => {
  refreshButton();
  if (G.mode !== 'play') return;
  const kind = { jedi: 'SABER PART', trooper: 'LOCKER PART', mando: 'FORGED PIECE' }[hero] || 'NEW PART';
  upToast(kind + ' · ' + part.name.toUpperCase() + (hero === 'jedi' ? ' ' : ' · ') + what, line + ' · fit it at the ' + BENCH_NAME[hero].toLowerCase() + ' between runs', 'mast');
});
new MutationObserver(refreshButton).observe(document.getElementById('overlay'), { attributes: true, attributeFilter: ['class', 'style'] });
refreshButton();
