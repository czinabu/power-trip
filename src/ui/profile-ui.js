// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PROFILE PAGE, kept simple: an OVERVIEW on the left (rank, progress, what the next rank asks and opens, your deck,
// the record; the full ladder behind VIEW ALL RANKS) and CARDS on the right: every card the hero has, by tier, the deck's
// picks lit and locked ones (rank cards, the tree's) dimmed. The Jedi alone has a second tab, the FORCE TREE, where Insight
// from each rank learns the tree's cards and a PATH picks the branch the upgrade page always deals from. The saber and the
// kit live at their benches (workbench, forge, locker), not here. Opens from PROFILE on the main menu, the hub and the pause
// screen, in every mode. game/profile.js keeps it all; data/profile.js has the words.

import { G } from '../state.js';
import { audioInit, S } from '../audio/sfx.js';
import {
  profileOf, track, rankNeeds, trialsPassed, insightLeft, insightTotal, nodeState, learnNode, resetTree, treePath, setPath,
  seenFresh, anyFresh, onPromote, resetProfile, tierRank, onPart, partsOwned, partsTotal,
  owns, runLive, deckOf, deckCount, toggleDeck, suggestDeck, setDeck, pruneDeck,
} from '../game/profile.js';
import { TRIALS, JEDI_TREE, RANK_SKILLS, BRANCHES, BRANCH, FORK_BRANCH, DECK_QUOTA, DECK_SIZE } from '../data/profile.js';
import { SKILLS, MANDO_SKILLS, TIER_NAME } from '../data/skills.js';
import { TROOPER_SKILLS } from '../data/trooper-progression.js';
import { JEDI_STORE } from '../data/store.js';
import { FORMS } from '../data/forms.js';
import { chapterOrder, forHero } from '../data/campaign.js';
import { icon } from './icons.js';
import { upToast } from '../game/upgrades.js';
import { BENCH_NAME } from '../data/hero-benches.js';

const panel = document.getElementById('profile');
const btn = document.getElementById('pfBtn');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HERO_NAME = { jedi: 'JEDI', mando: 'MANDALORIAN', trooper: 'ARC TROOPER' };
let hero = 'jedi', armed = false, view = 'deck', ladderOpen = false, filter = null, shut = {};   // view: the right column's CARDS, or the Jedi's FORCE TREE
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

/* ---------- the left column, the OVERVIEW: rank, progress, what the next rank asks and opens, your deck, the record ---------- */
function needLine(n, h){
  const tick = '<i class="pf-tick' + (n.ok ? ' ok' : '') + '">' + (n.ok ? '✓' : '') + '</i>';
  if (n.what === 'xp') return '<li>' + tick + num(Math.min(n.have, n.need)) + ' / ' + num(n.need) + ' ' + track(h).unit + '</li>';
  if (n.what === 'trials') return '<li>' + tick + 'The three trials · ' + n.have + ' / ' + n.need +
    '<span class="pf-sub">' + TRIALS.map(id => (profileOf(h).cleared[id] ? '✓ ' : '') + esc(chapterName(id, h))).join(' · ') + '</span></li>';
  if (n.what === 'chapter') return '<li>' + tick + 'Clear ' + esc(chapterName(n.id, h)) + '</li>';
  if (n.what === 'won') return '<li>' + tick + 'Beat the campaign</li>';
  return '';
}
// what a rank opens: a card for the deck (the Mando, the trooper) or Insight for the Force Tree (the Jedi)
function opens(h, ri){
  const T = track(h), R = T.ranks[ri], out = [];
  const ins = T.insight ? (T.insight[ri] || 0) : 0;
  if (ins > 0) out.push('+' + ins + ' Insight');
  for (const s of RANK_SKILLS[h] || []) if (s.rank === R.id) out.push(esc(s.nm) + ' card');
  const look = LOOK_OF_RANK[h] && LOOK_OF_RANK[h][R.id];
  if (look) out.push(esc(look));
  return out.join(' · ');
}
function leftCol(h){
  const T = track(h), p = profileOf(h), R = T.ranks[p.rank], next = T.ranks[p.rank + 1];
  const nx = next ? rankNeeds(h, p, p.rank + 1) : [];
  const xpN = nx.find(n => n.what === 'xp'), prevXp = R.xp || 0;
  const frac = !next ? 1 : xpN ? Math.max(0, Math.min(1, (p.xp - prevXp) / Math.max(1, xpN.need - prevXp))) : nx.every(n => n.ok) ? 1 : 0;
  const ladder = T.ranks.map((x, i) => '<li class="' + (i < p.rank ? 'done' : i === p.rank ? 'on' : '') + '"><b>' + esc(x.nm) + '</b><span>' + esc(x.line) + '</span></li>').join('');
  const unlock = next && opens(h, p.rank + 1);
  const deck = deckOf(h), live = runLive();
  const deckBox = deck
    ? '<p class="pf-note"><b class="pf-hl">' + deck.length + ' / ' + DECK_SIZE + '</b> cards picked. Runs deal from these.</p>' + (view === 'deck' ? '' : '<span class="btn" data-view="deck">EDIT DECK</span>')
    : '<p class="pf-note">Not built yet, so runs deal from every card you own.</p>' + (live ? '' : '<span class="btn pf-build" data-deckact="suggest">BUILD A DECK</span>');
  const rec = [['CHAPTERS', Object.keys(p.cleared).length], ['TRIALS', trialsPassed(p) + ' / 3'], ['MISSIONS', Object.keys(p.missions).length],
               ['CAMPAIGN WINS', p.won], ['DUELS WON', p.duels], h === 'jedi' ? ['FORM RANKS', p.forms] : ['MASTERY RANKS', p.powers],
               ['SIDE MISSIONS', Object.keys(p.sides || {}).length], ['SECRETS', Object.keys(p.secrets || {}).length],
               [h === 'jedi' ? 'SABER PARTS' : 'KIT PARTS', partsOwned(h) + ' / ' + partsTotal(h)]];
  return `<div class="pf-col pf-left">
    <div class="pf-kick">${esc(T.name)} · ${esc(HERO_NAME[h])}</div>
    <div class="pf-rank">${esc(R.nm)}</div>
    <div class="pf-xp"><b>${num(p.xp)}</b> ${esc(T.unit)}</div>
    <div class="pf-bar"><i style="width:${Math.round(frac * 100)}%"></i></div>
    ${next ? `<div class="pf-next"><h4>NEXT RANK · ${esc(next.nm)}</h4><ul>${nx.map(n => needLine(n, h)).join('')}</ul>${unlock ? `<p class="pf-opens">Unlocks: <b>${unlock}</b></p>` : ''}</div>` : '<div class="pf-next"><h4>TOP RANK</h4><p class="pf-note">Every rank is yours.</p></div>'}
    <span class="pf-link" data-ladder>${ladderOpen ? '▾ HIDE RANKS' : '▸ VIEW ALL RANKS'}</span>
    ${ladderOpen ? `<ol class="pf-ladder">${ladder}</ol>` : ''}
    <div class="pf-sec pf-deckbox"><h4>YOUR DECK</h4>${deckBox}</div>
    ${recBox(rec)}
    <p class="pf-note pf-how">Earn ${esc(T.unit)} from story chapters, missions, challenges, duels and survival. Training and sandbox don't count.</p>
  </div>`;
}

// the RECORD shows what's been earned: zeros are hidden, and a new hero gets one line instead of a grid of them
function recBox(rec){
  const got = rec.filter(r => !/^0(\b| \/)/.test(String(r[1])));
  const any = got.some(r => !/PARTS$/.test(r[0]));
  return '<div class="pf-sec"><h4>RECORD</h4>' + (got.length ? '<div class="pf-rec">' + got.map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div>' : '') +
    (any ? '' : '<p class="pf-note">Clear a chapter or win a mission to start your record.</p>') + '</div>';
}

/* ---------- the right column, the Jedi's second tab: the Force Tree ---------- */
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
      return '<div class="pf-node ' + st + '"><div class="pf-nh"><span class="pf-ic">' + icon(n.ico) + '</span><b>' + esc(n.nm) + '</b><span class="pf-tier-k">' + TIER_NAME[n.tier] + '</span></div><p>' + n.ds + '</p>' + act + '</div>';
    }).join('');
    const forkNote = fk.length ? '<div class="pf-fork"><span>IN A RUN YOU ALSO PICK</span>' + fk.map(f => '<b>' + esc(f.nm) + (forks[f.fork] ? ' <em>(last: ' + esc(nm(forks[f.fork])) + ')</em>' : '') + '</b>').join('') + '</div>' : '';
    return '<div class="pf-branch' + (path === B.id ? ' path' : '') + '"><div class="pf-bh"><b>' + B.nm + '</b><span class="btn pf-path" data-path="' + B.id + '">' + (path === B.id ? '★ YOUR PATH' : 'SET AS PATH') + '</span></div>' +
      '<p class="pf-bl">' + esc(B.line) + '</p>' + nodes + forkNote + '</div>';
  }).join('');
  return `<div class="pf-col pf-right">
    ${viewTabs('jedi')}
    <div class="pf-th"><h3>FORCE TREE</h3><span class="pf-ins"><b>${left}</b> INSIGHT TO SPEND</span><span class="btn pf-reset" data-reset="tree">RESET TREE</span></div>
    <p class="pf-note${runLive() ? ' pf-live-note' : ''}">${runLive() ? 'A run is on. Change your tree and path between runs.' : 'Each rank gives Insight. Spend it to learn a card for your deck. Your path\'s branch always has a card on offer in runs.'}</p>
    <div class="pf-tree">${cols}</div>
  </div>`;
}

/* ---------- the right column, CARDS: every card this hero has, by tier; the deck's picks lit, locked ones dimmed ---------- */
function viewTabs(h){
  if (h !== 'jedi') return '';   // the Mando and the trooper have the one view
  return '<div class="cz-tabs pf-vtabs">' + [['deck', 'CARDS'], ['tree', 'FORCE TREE']].map(v => '<span data-view="' + v[0] + '"' + (view === v[0] ? ' class="on"' : '') + '>' + v[1] + '</span>').join('') + '</div>';
}
function lockWhy(h, s){
  if (s.prof) return 'LEARN ON THE FORCE TREE';
  const R = track(h).ranks.find(r => r.id === s.rank);
  return 'UNLOCKS AT ' + (R ? R.nm : 'A HIGHER RANK');
}
// the CARDS view's filter: MY DECK (once there is one), ALL CARDS (the ones you own) or LOCKED (when each opens)
function filterOf(h){
  const deck = deckOf(h);
  if (filter === 'deck' && !deck) return 'all';
  return filter || (deck ? 'deck' : 'all');
}
function deckCol(h){
  const set = SET_OF[h];
  pruneDeck(h, set);
  const deck = deckOf(h), live = runLive(), n = deck ? deck.length : 0, f = filterOf(h);
  const locked = set.filter(s => !owns(h, s)).length;
  const chips = [deck && ['deck', 'MY DECK', n], ['all', 'ALL CARDS', set.length - locked], locked && ['locked', 'LOCKED', locked]].filter(Boolean);
  const bar = '<div class="pf-filter">' + chips.map(c => '<span data-filter="' + c[0] + '"' + (f === c[0] ? ' class="on"' : '') + '>' + c[1] + '<i>' + c[2] + '</i></span>').join('') + '</div>';
  const acts = live || !deck ? '' : '<span class="btn" data-deckact="suggest">AUTO-PICK</span><span class="btn pf-reset" data-deckact="all">USE ALL CARDS</span>';
  const note = live ? 'A run is on. Change your deck between runs.'
    : f === 'locked' ? 'Cards you haven\'t earned yet, and what opens each one.'
    : f === 'deck' ? 'Runs deal from these. Pick ALL CARDS to swap some in.'
    : deck ? 'Click a card to add it to your deck or take it out.'
    : 'Every card your runs can offer. BUILD A DECK to pick the ones you want.';
  const cols = [1, 2, 3].map(t => {
    const all = set.filter(s => s.tier === t), k = deck ? deckCount(h, set, t) : 0, full = k >= DECK_QUOTA[t];
    const cards = all.filter(s => f === 'locked' ? !owns(h, s) : f === 'deck' ? deck.includes(s.id) : owns(h, s));
    const hidden = f === 'all' ? all.filter(s => !owns(h, s)).length : 0;
    const body = cards.map(s => {
      const mine = owns(h, s), inD = deck && deck.includes(s.id);
      const st = !mine ? 'rank' : !deck ? 'all' : inD ? 'learned' : full ? 'insight' : 'open';
      const tag = !mine ? '<em class="pf-lock">' + esc(lockWhy(h, s)) + '</em>' : inD ? '<em class="pf-got">✓ IN YOUR DECK</em>' : deck && full ? '<em class="pf-lock">TIER FULL</em>' : '';
      const click = mine && deck && !live && (inD || !full) ? ' data-deck="' + s.id + '"' : '';
      return '<div class="pf-node pf-dcard ' + st + (click ? ' pick' : '') + '"' + click + '><div class="pf-nh"><span class="pf-ic">' + icon(s.ico) + '</span><b>' + esc(s.nm) + '</b></div><p>' + s.ds + '</p>' + tag + '</div>';
    }).join('')
      + (f === 'deck' ? Array.from({ length: Math.max(0, DECK_QUOTA[t] - k) }, () => '<div class="pf-slot" data-filter="all">+ EMPTY SLOT</div>').join('') : '')
      + (!cards.length && f !== 'deck' ? '<p class="pf-empty">' + (f === 'locked' ? 'Nothing locked here.' : 'Nothing yet.') + '</p>' : '')
      + (hidden ? '<div class="pf-more" data-filter="locked">+ ' + hidden + ' LOCKED</div>' : '');
    const head = '<div class="pf-bh" data-shut="' + t + '"><b>' + TIER_NAME[t] + '</b>' + (deck ? '<span class="pf-ins"><b>' + k + '</b> / ' + DECK_QUOTA[t] + ' SLOTS</span>' : '<span class="pf-ins">' + cards.length + '</span>') + '<i class="pf-caret">▾</i></div>';
    return '<div class="pf-branch pf-dtier' + (shut[t] ? ' shut' : '') + '">' + head + '<div class="pf-tbody">' + body + '</div></div>';
  }).join('');
  return `<div class="pf-col pf-right">
    ${viewTabs(h)}
    <div class="pf-th"><h3>CARDS</h3>${bar}${acts}</div>
    <p class="pf-note${live ? ' pf-live-note' : ''}">${note}</p>
    <div class="pf-tree">${cols}</div>
  </div>`;
}

function render(){
  panel.innerHTML = `<div class="howto-panel pf-panel">
    <div class="howto-head"><div class="howto-title">PROFILE</div><div class="rm-sub">Your rank and cards, shared by every mode</div><div class="howto-x" id="pfclose">✕</div></div>
    <div class="cz-tabs pf-tabs">${Object.keys(HERO_NAME).map(h => '<span data-h="' + h + '"' + (h === hero ? ' class="on"' : '') + '>' + HERO_NAME[h] + '</span>').join('')}</div>
    <div class="pf-body${runLive() ? ' pf-live' : ''}">${leftCol(hero)}${view === 'tree' && hero === 'jedi' ? treeCol() : deckCol(hero)}</div>
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
  if (t.closest('[data-ladder]')){ ladderOpen = !ladderOpen; return render(); }
  const fl = t.closest('[data-filter]'), sh = t.closest('[data-shut]');
  if (fl){ filter = fl.dataset.filter; view = 'deck'; return render(); }
  if (sh){ shut[sh.dataset.shut] = !shut[sh.dataset.shut]; return render(); }
  if (dk){ if (toggleDeck(hero, SET_OF[hero], dk.dataset.deck)) S.reward(1); return render(); }
  if (da){ setDeck(hero, da.dataset.deckact === 'all' ? null : suggestDeck(hero, SET_OF[hero])); filter = null; view = 'deck'; return render(); }
  const tab = t.closest('[data-h]'), learn = t.closest('[data-learn]'), path = t.closest('[data-path]'), reset = t.closest('[data-reset]');
  if (t.closest('#pfclose') || t === panel) return setProfile(false);
  if (tab){ hero = tab.dataset.h; armed = false; filter = null; if (hero !== 'jedi') view = 'deck'; render(); }
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
