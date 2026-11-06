// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PROFILE PAGE, picture first. On the left, always: the rank, the rank track (every rank as a stop on one line), the
// next rank's asks as bars and pips, and the light-and-dark meter. On the right, a tab at a time: OVERVIEW (a tile each
// for the deck, the two paths, the Jedi's tree, the saber or kit, NEW GAME+ and the record), CARDS (every card as an icon
// tile by tier, with one card's detail beside them: what it does and what to do with it), the Jedi's FORCE TREE, and the
// PATHS (the meter big, the two sides as two chains of three). Opens from PROFILE on the main menu, the hub and the
// pause screen, in every mode. game/profile.js keeps it all; data/profile.js and data/alignment.js have the words.

import { G } from '../state.js';
import { audioInit, S } from '../audio/sfx.js';
import {
  profileOf, track, rankNeeds, trialsPassed, insightLeft, insightTotal, nodeState, nodeLearned, learnNode, resetTree, treePath, setPath,
  seenFresh, anyFresh, onPromote, resetProfile, tierRank, onPart, partsOwned, partsTotal,
  owns, runLive, deckOf, deckCount, toggleDeck, suggestDeck, setDeck, pruneDeck, alignOf, alignStage, leanOf, alignOpen,
  ngBest, ngNextTier, hasRank,
} from '../game/profile.js';
import { tierName, MAX_TIER } from '../data/ngplus.js';
import { ALIGN, ALIGN_WORDS, ALIGN_RANK, PATH_TREE, PATH_WORDS } from '../data/alignment.js';
import { TRIALS, JEDI_TREE, RANK_SKILLS, BRANCHES, BRANCH, FORK_BRANCH, DECK_QUOTA, DECK_SIZE } from '../data/profile.js';
import { SKILLS, MANDO_SKILLS, TIER_NAME } from '../data/skills.js';
import { TROOPER_SKILLS } from '../data/trooper-progression.js';
import { JEDI_STORE } from '../data/store.js';
import { FORMS } from '../data/forms.js';
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
let hero = 'jedi', armed = false, view = 'home', filter = null;   // view: the right column's OVERVIEW, CARDS, the Jedi's FORCE TREE or PATHS
const sel = {}, kept = {};   // per hero: the card whose detail shows (CARDS and PATHS), and one just added or taken out
const SET_OF = { jedi: SKILLS, mando: MANDO_SKILLS, trooper: TROOPER_SKILLS };
// the trooper's story ranks open looks, not cards (game/wardrobe.js PROMOTIONS, data/ability-cards.js promote-*)
const LOOK_OF_RANK = { trooper: { sergeant: 'Sergeant green marks', lieutenant: 'Lieutenant blue marks', captain: 'Captain helmet and pauldron',
  commander: 'Commander yellow marks', arc: 'ARC kit and the ARC TROOPER name' } };

// a chapter's title as this hero's story tells it
function chapterName(id, h){
  const c = chapterOrder(null, h).find(x => x.id === id) || chapterOrder(null, 'jedi').find(x => x.id === id);
  return c ? forHero(c.title, h) : id.toUpperCase();
}
const num = (n) => Number(n || 0).toLocaleString('en-US');
// a card's effects, one per line ('A · B' in the data), so each reads on its own
const dsHtml = (ds) => { const parts = String(ds).split(' · '); return parts.length < 2 ? '<p>' + ds + '</p>' : '<ul class="pf-ds">' + parts.map(x => '<li>' + x + '</li>').join('') + '</ul>'; };

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
// what a rank opens: a card for the deck (the Mando, the trooper) or Insight for the Force Tree (the Jedi), as chips
function opens(h, ri){
  const T = track(h), R = T.ranks[ri], out = [];
  const ins = T.insight ? (T.insight[ri] || 0) : 0;
  if (ins > 0) out.push('+' + ins + ' Insight');
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
    T.ranks.map((x, i) => '<div class="pf-stop ' + (i < p.rank ? 'done' : i === p.rank ? 'on' : '') + '" style="left:' + pct(n > 1 ? i / (n - 1) : 0) + '" title="' + esc(x.nm + ': ' + x.line) + '"><i></i></div>').join('') + '</div>' +
    '<div class="pf-jends"><span>' + esc(T.ranks[0].nm) + '</span><span>' + esc(T.ranks[n - 1].nm) + '</span></div>';
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
  const T = track(h), p = profileOf(h), R = T.ranks[p.rank], next = T.ranks[p.rank + 1];
  const nx = next ? rankNeeds(h, p, p.rank + 1) : [];
  const nextBox = next
    ? '<div class="pf-next"><h4>NEXT · ' + esc(next.nm) + '</h4><ul>' + nx.map(n => needLine(n, h)).join('') + '</ul>' + chips(opens(h, p.rank + 1)) + '</div>'
    : '<div class="pf-next top"><h4>TOP RANK</h4>' + chips(opens(h, p.rank)) + '</div>';
  return `<div class="pf-col pf-left">
    <div class="pf-kick">${esc(T.name)} · ${esc(HERO_NAME[h])}</div>
    <div class="pf-rank">${esc(R.nm)}</div>
    <div class="pf-xp"><b>${num(p.xp)}</b> ${esc(T.unit)}</div>
    ${journey(h)}
    ${nextBox}
    ${meter(h)}
    <p class="pf-how">${esc(T.unit)} comes from story chapters, missions, challenges, duels and survival.</p>
  </div>`;
}

/* ---------- OVERVIEW: one tile per thing you own, each a picture first and a button to its page ---------- */
const tile = (cls, title, body, go, goLabel) => '<div class="pf-tile ' + cls + '"><h4>' + title + '</h4>' + body + (go ? '<span class="btn pf-go" data-view="' + go + '">' + goLabel + ' ›</span>' : '') + '</div>';
// a ring that fills to have / need
const ring = (have, need, inner) => '<div class="pf-ring" style="--f:' + (need ? Math.min(1, have / need) : 0) + '"><span>' + inner + '</span></div>';
function homeCol(h){
  const p = profileOf(h), set = SET_OF[h], deck = deckOf(h), live = runLive();
  // the deck: its ten slots by tier, filled as they're picked
  const slots = [1, 2, 3].map(t => { const k = deck ? deckCount(h, set, t) : 0; return '<div class="pf-dslots"><span>' + TIER_NAME[t] + '</span><div>' + Array.from({ length: DECK_QUOTA[t] }, (_, i) => '<i class="' + (i < k ? 'on' : '') + '"></i>').join('') + '</div></div>'; }).join('');
  const own = set.filter(s => owns(h, s)).length;
  const deckT = tile('pf-t-deck', 'YOUR DECK', (deck ? '<p class="pf-big"><b>' + deck.length + '</b> / ' + DECK_SIZE + ' picked</p>' : '<p class="pf-big"><b>' + own + '</b> cards unlocked</p><p class="pf-note">No deck yet: runs deal from all of them.</p>') + (deck ? slots : ''),
    'deck', deck ? 'EDIT DECK' : live ? 'SEE CARDS' : 'BUILD A DECK');
  // the path: which way you lean, and how many of that side's cards are open
  const W = ALIGN_WORDS[h] || ALIGN_WORDS.jedi, lean = leanOf(h), tree = PATH_TREE[h];
  const openN = (side) => tree.filter(n => n.align === side && alignOpen(n)).length;
  const sideT = tile('pf-t-side', esc(W.light) + ' &amp; ' + esc(W.dark),
    '<div class="pf-sidecount"><div class="dk"><b>' + openN('dark') + '</b>/3<span>' + esc(W.dark) + '</span></div><div class="lt"><b>' + openN('light') + '</b>/3<span>' + esc(W.light) + '</span></div></div>' +
    '<p class="pf-note">' + (lean ? 'You lean ' + esc(W[lean]) + '.' : 'Balanced: lean past ' + ALIGN.lean + ' to unlock a side.') + '</p>', 'sides', 'SEE PATHS');
  // the Jedi's tree: Insight to spend, cards learned
  const treeT = h === 'jedi' ? tile('pf-t-tree', 'FORCE TREE', '<div class="pf-row">' + ring(JEDI_TREE.filter(n => nodeLearned(n.prof)).length, JEDI_TREE.length, JEDI_TREE.filter(n => nodeLearned(n.prof)).length + '/' + JEDI_TREE.length) +
    '<div><p class="pf-big"><b>' + insightLeft() + '</b> Insight to spend</p><p class="pf-note">' + (treePath() ? 'Path: ' + esc((BRANCHES.find(b => b.id === treePath()) || {}).nm || '') : 'No path picked yet') + '</p></div></div>', 'tree', 'OPEN TREE') : '';
  return `<div class="pf-col pf-right">
    ${viewTabs(h)}
    <div class="pf-tiles">${deckT}${sideT}${treeT}${gearTile(h)}${ngTile(h)}${recTile(p, h)}</div>
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
               ['SIDE MISSIONS', Object.keys(p.sides || {}).length], ['SECRETS', Object.keys(p.secrets || {}).length],
               ['SPARED', (p.mercy || {}).spared || 0], ['STRUCK DOWN', (p.mercy || {}).struck || 0],
               ...((p.ng && p.ng.runs) ? [['NEW GAME+ WINS', p.ng.runs]] : [])];
  const got = rec.filter(r => !/^0(\b| \/)/.test(String(r[1])));
  return tile('pf-t-rec', 'RECORD', got.length ? '<div class="pf-rec">' + got.map(r => '<div><b>' + r[1] + '</b><span>' + r[0] + '</span></div>').join('') + '</div>'
    : '<p class="pf-note">Clear a chapter or win a mission to start your record.</p>');
}

/* ---------- the Jedi's FORCE TREE ---------- */
// each branch: its line, the cards Insight can learn (with their tier), and one footnote for the in-run either/or picks.
// The branch's everyday cards are in CARDS, so the tree no longer lists them.
function treeCol(){
  const path = treePath(), left = insightLeft(), forks = profileOf('jedi').forks;
  const nm = (id) => id ? ((JEDI_STORE.find(n => n.id === id) || {}).nm || (FORMS[id] ? FORMS[id].name : id)) : '';
  const cols = BRANCHES.map(B => {
    const own = JEDI_TREE.filter(n => n.branch === B.id).sort((x, y) => x.tier - y.tier);
    const fk = FORK_BRANCH.filter(f => f.branch === B.id).sort((x, y) => x.tier - y.tier);
    const nodes = own.map(n => {
      const st = nodeState(n);
      const act = st === 'learned' ? '<em class="pf-got">✓ LEARNED</em>' : st === 'open' ? '<span class="btn pf-learn" data-learn="' + n.prof + '">LEARN · 1 INSIGHT</span>'
        : st === 'rank' ? '<em class="pf-lock">UNLOCKS AT ' + esc(track('jedi').ranks.find(r => r.id === tierRank(n.tier)).nm) + '</em>' : '<em class="pf-lock">NO INSIGHT LEFT</em>';
      return '<div class="pf-node ' + st + '"><div class="pf-nh"><span class="pf-ic">' + icon(n.ico) + '</span><b>' + esc(n.nm) + '</b><span class="pf-tier-k">' + TIER_NAME[n.tier] + '</span></div>' + dsHtml(n.ds) + act + '</div>';
    }).join('');
    const forkNote = fk.length ? '<div class="pf-fork"><span>IN A RUN YOU ALSO PICK</span>' + fk.map(f => '<b>' + esc(f.nm) + (forks[f.fork] ? ' <em>(last: ' + esc(nm(forks[f.fork])) + ')</em>' : '') + '</b>').join('') + '</div>' : '';
    return '<div class="pf-branch' + (path === B.id ? ' path' : '') + '"><div class="pf-bh"><b>' + B.nm + '</b><span class="btn pf-path" data-path="' + B.id + '">' + (path === B.id ? '★ YOUR PATH' : 'SET AS PATH') + '</span></div>' +
      '<p class="pf-bl">' + esc(B.line) + '</p>' + nodes + forkNote + '</div>';
  }).join('');
  return `<div class="pf-col pf-right">
    ${viewTabs('jedi')}
    <div class="pf-th"><h3>FORCE TREE</h3><span class="pf-ins"><b>${left}</b> INSIGHT TO SPEND</span><span class="btn pf-reset" data-reset="tree">RESET TREE</span></div>
    <p class="pf-note${runLive() ? ' pf-live-note' : ''}">${runLive() ? 'A run is on. Change your tree and path between runs.' : 'Each rank gives Insight. Spend it to learn a card. Your path\'s branch always has a card on offer in runs.'}</p>
    <div class="pf-tree">${cols}</div>
  </div>`;
}

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
        '<div><b>' + esc(n.nm) + '</b><span>' + (open ? 'UNLOCKED' : 'TIER ' + n.tier + (R ? ' · ' + esc(R.nm) : '')) + '</span></div></div>';
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

/* ---------- CARDS: every card as an icon tile by tier, one card's detail beside them ---------- */
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
function viewTabs(h){
  const W = ALIGN_WORDS[h] || ALIGN_WORDS.jedi;
  const tabs = [['home', 'OVERVIEW'], ['deck', 'CARDS'], ...(h === 'jedi' ? [['tree', 'FORCE TREE']] : []), ['sides', W.light + ' & ' + W.dark]];
  return '<div class="cz-tabs pf-vtabs">' + tabs.map(v => '<span data-view="' + v[0] + '"' + (view === v[0] ? ' class="on"' : '') + '>' + esc(v[1]) + '</span>').join('') + '</div>';
}
function lockWhy(h, s){
  if (s.align){
    const R = track(h).ranks.find(r => r.id === ALIGN_RANK[h][s.tier]);
    return leanOf(h) === s.align ? 'UNLOCKS AT ' + (R ? R.nm : 'A HIGHER RANK') : 'LEAN ' + sideWord(h, s.align) + ' TO UNLOCK';
  }
  if (s.prof) return 'LEARN IT ON THE FORCE TREE';
  const R = track(h).ranks.find(r => r.id === s.rank);
  return 'UNLOCKS AT ' + (R ? R.nm : 'A HIGHER RANK');
}
// the CARDS view's filter: MY DECK (once there is one), ALL CARDS (the ones you own) or LOCKED (when each opens)
function filterOf(h){
  const deck = deckOf(h);
  if (filter === 'deck' && !deck) return 'all';
  return filter || (deck ? 'deck' : 'all');
}
// the card whose detail shows: the one picked, if it's in this list, or the list's first
// (a card just taken out of the deck keeps the detail, though MY DECK no longer lists it: so it can go straight back in)
function selOf(h, list){ return list.find(s => s.id === sel[h]) || (kept[h] === sel[h] && SET_OF[h].find(s => s.id === sel[h])) || list[0] || null; }
// ONE CARD, in full: what it does, its line, and what you can do with it (add, take out, or what unlocks it)
function detail(h, s){
  if (!s) return '<aside class="pf-detail"><p class="pf-note">Nothing here yet.</p></aside>';
  const set = SET_OF[h], mine = owns(h, s), deck = deckOf(h), live = runLive(), inD = deck && deck.includes(s.id);
  const full = deck && deckCount(h, set, s.tier) >= DECK_QUOTA[s.tier];
  const act = !mine ? (s.align ? unlockSteps(h, s) : '<p class="pf-lock">' + LOCK + esc(lockWhy(h, s)) + '</p>')
    : live ? (inD ? '<p class="pf-got">✓ IN YOUR DECK</p>' : '<p class="pf-note">A run is on. Change your deck between runs.</p>')
    : !deck ? '<p class="pf-note">Unlocked: runs can deal it. BUILD A DECK to choose which ones.</p>'
    : inD ? '<p class="pf-got">✓ IN YOUR DECK</p><span class="btn" data-deck="' + s.id + '">TAKE OUT</span>'
    : full ? '<p class="pf-lock">This tier\'s ' + DECK_QUOTA[s.tier] + ' slots are full. Take one out first.</p>'
    : '<span class="btn pf-add" data-deck="' + s.id + '">ADD TO DECK</span>';
  const side = s.align ? '<span class="pf-tier-k al-' + s.align + '">' + esc(sideWord(h, s.align)) + '</span>' : '';
  return '<aside class="pf-detail' + (s.align ? ' al-' + s.align : '') + (mine ? '' : ' shut') + '"><div class="pf-dh"><span class="pf-orb">' + icon(s.ico) + '</span><div><b>' + esc(s.nm) + '</b><span>' + TIER_NAME[s.tier] + (s.max > 1 ? ' · UP TO ' + s.max + ' RANKS' : '') + '</span></div>' + side + '</div>' +
    dsHtml(s.ds) + (s.fl ? '<p class="pf-fl">' + esc(s.fl) + '</p>' : '') + '<div class="pf-dact">' + act + '</div></aside>';
}
function deckCol(h){
  const set = SET_OF[h];
  pruneDeck(h, set);
  const deck = deckOf(h), live = runLive(), n = deck ? deck.length : 0, f = filterOf(h);
  const locked = set.filter(s => !owns(h, s)).length;
  const chipsF = [deck && ['deck', 'MY DECK', n], ['all', 'UNLOCKED', set.length - locked], locked && ['locked', 'LOCKED', locked]].filter(Boolean);
  const bar = '<div class="pf-filter">' + chipsF.map(c => '<span data-filter="' + c[0] + '"' + (f === c[0] ? ' class="on"' : '') + '>' + c[1] + '<i>' + c[2] + '</i></span>').join('') + '</div>';
  const acts = live ? '' : deck ? '<span class="btn" data-deckact="suggest">AUTO-PICK</span><span class="btn pf-reset" data-deckact="all">USE ALL CARDS</span>' : '<span class="btn pf-build" data-deckact="suggest">BUILD A DECK</span>';
  const lists = [1, 2, 3].map(t => set.filter(s => s.tier === t && (f === 'locked' ? !owns(h, s) : f === 'deck' ? deck.includes(s.id) : owns(h, s))));
  const pick = selOf(h, lists.flat());
  const rows = [1, 2, 3].map(t => {
    const cards = lists[t - 1], k = deck ? deckCount(h, set, t) : 0;
    const meterT = deck ? '<span class="pf-dslots"><div>' + Array.from({ length: DECK_QUOTA[t] }, (_, i) => '<i class="' + (i < k ? 'on' : '') + '"></i>').join('') + '</div></span>' : '<span class="pf-ins">' + cards.length + '</span>';
    const tiles = cards.map(s => {
      const mine = owns(h, s), inD = deck && deck.includes(s.id);
      return '<div class="pf-dcard ' + (mine ? 'own' : 'shut') + (inD ? ' indeck' : '') + (s.align ? ' al-' + s.align : '') + (pick === s ? ' sel' : '') + '" data-card="' + s.id + '" title="' + esc(s.nm) + '">' +
        '<span class="pf-orb">' + icon(s.ico) + (mine ? '' : '<i class="pf-lk">' + LOCK + '</i>') + (inD ? '<i class="pf-in">✓</i>' : '') + '</span><b>' + esc(s.nm) + '</b>' +
        (s.align ? '<span class="pf-tier-k al-' + s.align + '">' + esc(sideWord(h, s.align)) + '</span>' : '') + '</div>';
    }).join('') + (f === 'deck' ? Array.from({ length: Math.max(0, DECK_QUOTA[t] - k) }, () => '<div class="pf-slot" data-filter="all">+</div>').join('') : '');
    return '<div class="pf-trow"><div class="pf-trh"><b>' + TIER_NAME[t] + '</b>' + meterT + '</div><div class="pf-grid">' + (tiles || '<p class="pf-empty">' + (f === 'locked' ? 'Nothing locked here.' : 'Nothing yet.') + '</p>') + '</div></div>';
  }).join('');
  return `<div class="pf-col pf-right">
    ${viewTabs(h)}
    <div class="pf-th">${bar}${acts}</div>
    <div class="pf-split"><div class="pf-rows">${rows}</div>${detail(h, pick)}</div>
  </div>`;
}

function render(){
  const right = view === 'tree' && hero === 'jedi' ? treeCol() : view === 'deck' ? deckCol(hero) : view === 'sides' ? sidesCol(hero) : homeCol(hero);
  panel.innerHTML = `<div class="howto-panel pf-panel">
    <div class="howto-head"><div class="howto-title">PROFILE</div><div class="rm-sub">Your rank and cards, shared by every mode</div><div class="howto-x" id="pfclose">✕</div></div>
    <div class="cz-tabs pf-tabs">${Object.keys(HERO_NAME).map(h => '<span data-h="' + h + '"' + (h === hero ? ' class="on"' : '') + '>' + HERO_NAME[h] + '</span>').join('')}</div>
    <div class="pf-body${runLive() ? ' pf-live' : ''}">${leftCol(hero)}${right}</div>
    <div class="pf-foot"><span class="btn pf-wipe${armed ? ' armed' : ''}" data-reset="profile">${armed ? 'CLICK AGAIN TO RESET ' + HERO_NAME[hero] : 'RESET THIS PROFILE'}</span></div>
  </div>`;
  seenFresh(hero);
  refreshButton();
}

export function setProfile(open){
  if (open){ hero = ['jedi', 'mando', 'trooper'].includes(G.hero) ? G.hero : 'jedi'; armed = false; render(); }
  panel.classList.toggle('open', open);
}
export const profileOpen = () => panel.classList.contains('open');

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // never launches or resumes the game
  audioInit();
  const t = e.target;
  const vt = t.closest('[data-view]'), dk = t.closest('[data-deck]'), da = t.closest('[data-deckact]');
  if (vt){ view = vt.dataset.view; return render(); }
  const fl = t.closest('[data-filter]'), cd = !dk && t.closest('[data-card]');
  if (fl){ filter = fl.dataset.filter; view = 'deck'; return render(); }
  if (cd){ sel[hero] = cd.dataset.card; kept[hero] = null; return render(); }
  if (dk){ if (toggleDeck(hero, SET_OF[hero], dk.dataset.deck)) S.reward(1); sel[hero] = kept[hero] = dk.dataset.deck; return render(); }
  if (da){ setDeck(hero, da.dataset.deckact === 'all' ? null : suggestDeck(hero, SET_OF[hero])); filter = null; view = 'deck'; return render(); }
  const tab = t.closest('[data-h]'), learn = t.closest('[data-learn]'), path = t.closest('[data-path]'), reset = t.closest('[data-reset]');
  if (t.closest('#pfclose') || t === panel) return setProfile(false);
  if (tab){ hero = tab.dataset.h; armed = false; filter = null; if (hero !== 'jedi' && view === 'tree') view = 'home'; render(); }
  else if (learn){ if (learnNode(learn.dataset.learn)) S.reward(1); render(); }
  else if (path){ setPath(path.dataset.path); render(); }
  else if (reset && reset.dataset.reset === 'tree'){ resetTree(); render(); }
  else if (reset && reset.dataset.reset === 'profile'){ if (armed){ resetProfile(hero); armed = false; } else armed = true; render(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && profileOpen()) setProfile(false); });
btn.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setProfile(true); });

/* ---------- the PROFILE button's NEW, and a rank earned away from a chapter's close ---------- */
function refreshButton(){ btn.classList.toggle('fresh', anyFresh()); }
onPromote((h, r) => {
  refreshButton();
  if (G.mode !== 'play') return;
  const R = track(h).ranks[r];
  upToast('RANK EARNED · ' + R.nm, (h === 'jedi' ? 'New Insight for the Force Tree' : deckOf(h) ? 'A new card for your deck' : 'A new card for your runs') + ' · see PROFILE between runs', 'mast');
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
