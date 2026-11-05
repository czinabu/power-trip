// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PROFILE PAGE: each hero's rank, what the next one asks for, the record that earned it and (the Jedi) the FORCE TREE,
// where Insight from each rank learns the tree's own cards and a PATH picks the branch the upgrade page always deals from,
// and YOUR DECK: the cards the run's upgrade page deals from, chosen here between runs (the run earns the points to spend).
// Opens from PROFILE on the main menu and the pause screen, in every mode. The Mando and the trooper have a lighter page:
// the ladder and the cards each rank opens. game/profile.js keeps it all; data/profile.js has the words.

import { G } from '../state.js';
import { audioInit, S } from '../audio/sfx.js';
import {
  profileOf, track, rankNeeds, trialsPassed, insightLeft, insightTotal, nodeState, learnNode, resetTree, treePath, setPath,
  seenFresh, anyFresh, onPromote, resetProfile, tierRank, onPart, partsOwned, partsTotal,
  owns, runLive, deckOf, deckCount, toggleDeck, suggestDeck, setDeck, pruneDeck, alignOf, alignStage, leanOf, alignOpen,
} from '../game/profile.js';
import { ALIGN, ALIGN_WORDS, ALIGN_TREE, ALIGN_PATHS } from '../data/alignment.js';
import { TRIALS, JEDI_TREE, RANK_SKILLS, BRANCHES, BRANCH, FORK_BRANCH, DECK_QUOTA, DECK_SIZE } from '../data/profile.js';
import { SKILLS, MANDO_SKILLS, TIER_NAME } from '../data/skills.js';
import { TROOPER_SKILLS } from '../data/trooper-progression.js';
import { JEDI_STORE } from '../data/store.js';
import { FORMS } from '../data/forms.js';
import { chapterOrder, forHero } from '../data/campaign.js';
import { icon } from './icons.js';
import { upToast } from '../game/upgrades.js';
import { EARNABLE, crystalOf, earnProgress, earnText } from '../data/saber-parts.js';
import { benchOf, earnableOf, SIDE_ROW, BENCH_NAME, BENCH_BUTTON } from '../data/hero-benches.js';
import { CUSTOMIZE, wornOption } from '../data/customize.js';
import { loadPicks } from '../player/mesh.js';

const panel = document.getElementById('profile');
const btn = document.getElementById('pfBtn');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HERO_NAME = { jedi: 'JEDI', mando: 'MANDALORIAN', trooper: 'ARC TROOPER' };
let hero = 'jedi', armed = false, view = 'deck';   // view: the right column's DECK, or the TREE (the Jedi) / the RANK CARDS
const SET_OF = { jedi: SKILLS, mando: MANDO_SKILLS, trooper: TROOPER_SKILLS };

// a chapter's title as this hero's story tells it
function chapterName(id, h){
  const c = chapterOrder(null, h).find(x => x.id === id) || chapterOrder(null, 'jedi').find(x => x.id === id);
  return c ? forHero(c.title, h) : id.toUpperCase();
}
const num = (n) => Number(n || 0).toLocaleString('en-US');

/* ---------- the left column: rank, the next rank's asks, the ladder, the record ---------- */
function needLine(n, h){
  const tick = '<i class="pf-tick' + (n.ok ? ' ok' : '') + '">' + (n.ok ? '✓' : '') + '</i>';
  if (n.what === 'xp') return '<li>' + tick + num(Math.min(n.have, n.need)) + ' / ' + num(n.need) + ' ' + track(h).unit + '</li>';
  if (n.what === 'trials') return '<li>' + tick + 'The three trials · ' + n.have + ' / ' + n.need +
    '<span class="pf-sub">' + TRIALS.map(id => (profileOf(h).cleared[id] ? '✓ ' : '') + esc(chapterName(id, h))).join(' · ') + '</span></li>';
  if (n.what === 'chapter') return '<li>' + tick + 'Clear ' + esc(chapterName(n.id, h)) + '</li>';
  if (n.what === 'won') return '<li>' + tick + 'Beat the campaign</li>';
  return '';
}
function leftCol(h){
  const T = track(h), p = profileOf(h), R = T.ranks[p.rank], next = T.ranks[p.rank + 1];
  const nx = next ? rankNeeds(h, p, p.rank + 1) : [];
  const xpN = nx.find(n => n.what === 'xp'), prevXp = R.xp || 0;
  const frac = !next ? 1 : xpN ? Math.max(0, Math.min(1, (p.xp - prevXp) / Math.max(1, xpN.need - prevXp))) : nx.every(n => n.ok) ? 1 : 0;
  const ladder = T.ranks.map((x, i) => '<li class="' + (i < p.rank ? 'done' : i === p.rank ? 'on' : '') + '"><b>' + esc(x.nm) + '</b><span>' + esc(x.line) + '</span></li>').join('');
  const cleared = Object.keys(p.cleared).length;
  const rec = [['CHAPTERS CLEARED', cleared], ['TRIALS PASSED', trialsPassed(p) + ' / 3'], ['MISSIONS WON', Object.keys(p.missions).length],
               ['CAMPAIGN WINS', p.won], ['DUELS WON', p.duels], h === 'jedi' ? ['FORM RANKS', p.forms] : ['MASTERY RANKS', p.powers],
               ['SIDE MISSIONS', Object.keys(p.sides || {}).length], ['SECRETS FOUND', Object.keys(p.secrets || {}).length]];
  return `<div class="pf-col pf-left">
    <div class="pf-kick">${esc(T.name)} · ${esc(HERO_NAME[h])}</div>
    <div class="pf-rank">${esc(R.nm)}</div>
    <div class="pf-xp"><b>${num(p.xp)}</b> ${esc(T.unit)}</div>
    <div class="pf-bar"><i style="width:${Math.round(frac * 100)}%"></i></div>
    ${next ? `<div class="pf-next"><h4>NEXT · ${esc(next.nm)}</h4><ul>${nx.map(n => needLine(n, h)).join('')}</ul></div>` : '<div class="pf-next"><h4>THE TOP OF THE LADDER</h4><p class="pf-note">Every rank is yours.</p></div>'}
    <div class="pf-sec"><h4>THE LADDER</h4><ol class="pf-ladder">${ladder}</ol></div>
    ${alignSec(h)}
    ${h === 'jedi' ? saberSec() : kitSec(h)}
    <div class="pf-sec"><h4>RECORD</h4><div class="pf-rec">${rec.map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('')}</div></div>
    <div class="pf-sec pf-how"><h4>EARNING ${esc(T.unit)}</h4><p>Chapters cleared (trials count double), story missions, side missions and arcade contracts won, secrets found on the story maps, ${h === 'jedi' ? 'form and power' : 'gear'} mastery ranks, duels won and survival waves. Training and the sandbox are practice: they never count.</p></div>
  </div>`;
}

/* ---------- LIGHT AND DARK: where the meter stands (data/alignment.js, game/alignment.js) ---------- */
function alignSec(h){
  const W = ALIGN_WORDS[h] || ALIGN_WORDS.jedi, a = alignOf(h), p = profileOf(h), m = p.mercy || {}, lean = leanOf(h);
  const at = Math.round((a + ALIGN.max) / (2 * ALIGN.max) * 100), mark = (v) => Math.round((v + ALIGN.max) / (2 * ALIGN.max) * 100);
  const now = lean ? (lean === 'light' ? W.light : W.dark) + ' · ' + Math.abs(Math.round(a)) : 'BALANCED' + (a ? ' · ' + (a > 0 ? W.light : W.dark).toLowerCase() + ' ' + Math.abs(Math.round(a)) : '');
  return `<div class="pf-sec pf-align al-${lean || 'mid'}"><h4>${esc(W.title)}<em>${esc(now)}</em></h4>
    <div class="pf-al"><span class="dk">${esc(W.dark)}</span><div class="pf-al-bar"><i class="lean" style="left:${mark(-ALIGN.lean)}%"></i><i class="lean" style="left:${mark(ALIGN.lean)}%"></i><b style="left:${at}%"></b></div><span class="lt">${esc(W.light)}</span></div>
    <p class="pf-note">${esc(W.line[alignStage(h)])}</p>
    <p class="pf-note pf-al-how">Moved by the story's choices, the side missions' choices, and the beaten foes you spare (F beside one on its knees) or strike down · ${num(m.spared || 0)} spared · ${num(m.struck || 0)} struck down${h === 'jedi' ? ' · lean past ' + ALIGN.lean + ' to open that path\'s cards on the FORCE TREE' : ''}</p>
  </div>`;
}

/* ---------- YOUR SABER: what the workbench has fitted, and how many parts are earned (data/saber-parts.js) ---------- */
function saberSec(){
  const mine = (loadPicks().jedi) || {}, at = (id) => wornOption('jedi', CUSTOMIZE.jedi.find(r => r.id === id), mine);
  const c = crystalOf(at('saber').id), col = c.col != null ? '#' + c.col.toString(16).padStart(6, '0') : 'var(--accent)';
  const next = EARNABLE.map(([row, part]) => ({ part, e: earnProgress(profileOf('jedi'), part.earn) })).filter(x => x.e.have < x.e.need)
    .sort((a, b) => (b.e.have / b.e.need) - (a.e.have / a.e.need))[0];
  return `<div class="pf-sec pf-saber"><h4>YOUR SABER<em>${partsOwned('jedi')} / ${partsTotal('jedi')} PARTS</em></h4>
    <div class="pf-sb"><i style="--c:${col}"></i><div><b>${esc(at('hilt').name.toUpperCase())} HILT</b><span>${esc(at('emitter').name)} emitter · ${esc(at('pommel').name)} pommel</span></div></div>
    <div class="pf-sb-att"><b>${esc(c.name.toUpperCase())} · ${esc(c.att)}</b><span>${esc(c.ds)}</span></div>
    ${next ? `<p class="pf-note">Next part: <b>${esc(next.part.name)}</b> · ${esc(earnText(next.part.earn, (id) => chapterName(id, 'jedi')))}${next.e.need > 1 ? ' (' + next.e.have + ' / ' + next.e.need + ')' : ''}</p>` : '<p class="pf-note">Every part is yours.</p>'}
    <p class="pf-note">Build it at the SABER WORKBENCH: SABER on the main menu.</p>
  </div>`;
}

/* ---------- YOUR KIT: the trooper's ARMORY LOCKER, the Mando's BESKAR FORGE (data/hero-benches.js): what is fitted ---------- */
function kitSec(h){
  const mine = (loadPicks()[h]) || {}, at = (id) => wornOption(h, CUSTOMIZE[h].find(r => r.id === id), mine);
  const side = benchOf(h).find(r => r.id === SIDE_ROW[h]), part = side.parts.find(p => p.id === at(side.id).id) || side.parts[0];
  const looks = benchOf(h).filter(r => !r.side).map(r => esc(at(r.id).name)).join(' · ');
  const spec = h === 'trooper' && benchOf(h).find(r => r.id === 'specialist');
  const sp = spec && (spec.parts.find(p => p.id === at('specialist').id) || spec.parts[0]);
  const next = earnableOf(h).map(([row, p]) => ({ part: p, e: earnProgress(profileOf(h), p.earn) })).filter(x => x.e.have < x.e.need)
    .sort((a, b) => (b.e.have / b.e.need) - (a.e.have / a.e.need))[0];
  const col = part.col != null ? '#' + part.col.toString(16).padStart(6, '0') : 'var(--accent)';
  return `<div class="pf-sec pf-saber"><h4>YOUR KIT<em>${partsOwned(h)} / ${partsTotal(h)} PARTS</em></h4>
    <div class="pf-sb"><i style="--c:${col}"></i><div><b>${esc(side.label)}</b><span>${looks}</span></div></div>
    <div class="pf-sb-att"><b>${esc(part.att)}</b><span>${esc(part.ds)}</span></div>
    ${sp ? `<div class="pf-sb-att"><b>SPECIALIST · ${esc(sp.att)}</b><span>${esc(sp.ds)}</span></div>` : ''}
    ${next ? `<p class="pf-note">Next part: <b>${esc(next.part.name)}</b> · ${esc(earnText(next.part.earn, (id) => chapterName(id, h)))}${next.e.need > 1 ? ' (' + next.e.have + ' / ' + next.e.need + ')' : ''}</p>` : '<p class="pf-note">Every part is yours.</p>'}
    <p class="pf-note">Fit it at the ${BENCH_NAME[h]}: ${BENCH_BUTTON[h]} on the main menu.</p>
  </div>`;
}

/* ---------- the right column: the Force Tree (the Jedi), or the rank cards (the Mando, the trooper) ---------- */
function treeCol(){
  const path = treePath(), left = insightLeft(), forks = profileOf('jedi').forks;
  const forkLine = (f) => {
    const took = forks[f.fork], nm = (id) => id ? ((JEDI_STORE.find(n => n.id === id) || {}).nm || (FORMS[id] ? FORMS[id].name : id)) : '';
    return '<div class="pf-fork"><span>CHOOSE ONE IN A RUN</span><b>' + esc(f.nm) + '</b>' + (took ? '<em>Last run: ' + esc(nm(took)) + '</em>' : '') + '</div>';
  };
  const cols = BRANCHES.map(B => {
    const tiers = [1, 2, 3].map(t => {
      const core = SKILLS.filter(s => !s.prof && BRANCH[s.id] === B.id && s.tier === t);
      const own = JEDI_TREE.filter(n => n.branch === B.id && n.tier === t);
      const fk = FORK_BRANCH.filter(f => f.branch === B.id && f.tier === t);
      if (!core.length && !own.length && !fk.length) return '';
      return '<div class="pf-tier"><div class="pf-tn">' + TIER_NAME[t] + '</div>' +
        core.map(s => '<div class="pf-core" title="' + esc(s.ds.replace(/&amp;/g, '&')) + '"><span class="pf-ic">' + icon(s.ico) + '</span>' + esc(s.nm) + '</div>').join('') +
        own.map(n => {
          const st = nodeState(n);
          const act = st === 'learned' ? '<em class="pf-got">LEARNED</em>' : st === 'open' ? '<span class="btn pf-learn" data-learn="' + n.prof + '">LEARN · 1 INSIGHT</span>'
            : st === 'rank' ? '<em class="pf-lock">NEEDS ' + esc(track('jedi').ranks.find(r => r.id === tierRank(t)).nm) + '</em>' : '<em class="pf-lock">NO INSIGHT LEFT</em>';
          return '<div class="pf-node ' + st + '"><div class="pf-nh"><span class="pf-ic">' + icon(n.ico) + '</span><b>' + esc(n.nm) + '</b></div><p>' + n.ds + '</p>' + act + '</div>';
        }).join('') + fk.map(forkLine).join('') + '</div>';
    }).join('');
    return '<div class="pf-branch' + (path === B.id ? ' path' : '') + '"><div class="pf-bh"><b>' + B.nm + '</b><span class="btn pf-path" data-path="' + B.id + '">' + (path === B.id ? '★ YOUR PATH' : 'SET AS PATH') + '</span></div>' +
      '<p class="pf-bl">' + esc(B.line) + '</p>' + tiers + '</div>';
  }).join('');
  return `<div class="pf-col pf-right">
    ${viewTabs('jedi')}
    <div class="pf-th"><h3>FORCE TREE</h3><span class="pf-ins"><b>${left}</b> INSIGHT LEFT · ${insightTotal()} FROM YOUR RANKS</span><span class="btn pf-reset" data-reset="tree">RESET TREE</span></div>
    <p class="pf-note${runLive() ? ' pf-live-note' : ''}">${runLive() ? 'A run is on. Your tree, path and deck are set between runs: finish or leave this one to change them.' : 'A learned card joins the cards you can put in YOUR DECK, at its tier, for the same one skill point: more to choose from, never a bigger number. Your PATH\'s branch always has a card in the hand. Free to change between runs.'}</p>
    <div class="pf-tree">${cols}</div>
    ${pathsSec()}
  </div>`;
}
// THE TWO PATHS: the light and the dark cards, open while you lean their way (no Insight: data/alignment.js ALIGN_TREE)
function pathsSec(){
  const lean = leanOf('jedi');
  const cols = ALIGN_PATHS.map(P => '<div class="pf-branch al-' + P.id + (lean === P.id ? ' path' : '') + '"><div class="pf-bh"><b>' + esc(P.nm) + '</b>' + (lean === P.id ? '<em class="pf-got">YOU LEAN THIS WAY</em>' : '') + '</div><p class="pf-bl">' + esc(P.line) + '</p>' +
    ALIGN_TREE.filter(n => n.align === P.id).map(n => {
      const open = alignOpen(n), rk = track('jedi').ranks.find(r => r.id === tierRank(n.tier));
      const tag = open ? '<em class="pf-got">OPEN · ADD IT TO YOUR DECK</em>' : lean !== P.id ? '<em class="pf-lock">LEAN TO ' + esc(P.nm) + ' (' + ALIGN.lean + ')</em>' : '<em class="pf-lock">NEEDS ' + esc(rk ? rk.nm : '') + '</em>';
      return '<div class="pf-node ' + (open ? 'learned' : 'rank') + '"><div class="pf-nh"><span class="pf-ic">' + icon(n.ico) + '</span><b>' + esc(n.nm) + '</b><span class="pf-tier-k">' + TIER_NAME[n.tier] + '</span></div><p>' + n.ds + '</p>' + tag + '</div>';
    }).join('') + '</div>').join('');
  return `<div class="pf-th pf-paths-h"><h3>THE TWO PATHS</h3><span class="pf-ins">MIRRORED PAIRS · THE SAME BUDGET, A DIFFERENT WAY TO FIGHT</span></div>
    <p class="pf-note">Lean to the light or the dark and that path's cards open for your deck, at your rank's tiers, for the same one skill point as the rest. Swing back and they close again.</p>
    <div class="pf-tree pf-paths">${cols}</div>`;
}
function cardsCol(h){
  const T = track(h), list = RANK_SKILLS[h] || [];
  return `<div class="pf-col pf-right">
    ${viewTabs(h)}
    <div class="pf-th"><h3>RANK CARDS</h3></div>
    <p class="pf-note">Each rank adds one card you can put in YOUR DECK at its tier, for the same one skill point as the rest: more to choose from, never a bigger number.</p>
    <div class="pf-cards">${list.map(s => {
      const ri = T.ranks.findIndex(r => r.id === s.rank), have = profileOf(h).rank >= ri;
      return '<div class="pf-node ' + (have ? 'learned' : 'rank') + '"><div class="pf-nh"><span class="pf-ic">' + icon(s.ico) + '</span><b>' + esc(s.nm) + '</b><span class="pf-tier-k">' + TIER_NAME[s.tier] + '</span></div><p>' + s.ds + '</p>' +
        (have ? '<em class="pf-got">UNLOCKED · ADD IT TO YOUR DECK</em>' : '<em class="pf-lock">AT ' + esc(T.ranks[ri].nm) + '</em>') + '</div>';
    }).join('')}</div>
  </div>`;
}

/* ---------- YOUR DECK: the cards the run's upgrade page deals from, chosen here between runs ---------- */
function viewTabs(h){
  const other = h === 'jedi' ? 'FORCE TREE' : 'RANK CARDS';
  return '<div class="cz-tabs pf-vtabs">' + [['deck', 'YOUR DECK'], ['more', other]].map(v => '<span data-view="' + v[0] + '"' + (view === v[0] ? ' class="on"' : '') + '>' + v[1] + '</span>').join('') + '</div>';
}
function lockWhy(h, s){
  if (s.align) return leanOf('jedi') === s.align ? 'NEEDS ' + track('jedi').ranks.find(r => r.id === tierRank(s.tier)).nm : 'LEAN TO THE ' + s.align.toUpperCase();
  if (s.prof) return 'LEARN IT ON THE FORCE TREE';
  const R = track(h).ranks.find(r => r.id === s.rank);
  return 'AT ' + (R ? R.nm : 'A HIGHER RANK');
}
function deckCol(h){
  const set = SET_OF[h];
  pruneDeck(h, set);
  const deck = deckOf(h), live = runLive(), n = deck ? deck.length : 0;
  const acts = live ? '' : deck
    ? '<span class="btn" data-deckact="suggest">SUGGEST A DECK</span><span class="btn pf-reset" data-deckact="all">USE EVERY CARD</span>'
    : '<span class="btn pf-build" data-deckact="suggest">BUILD A DECK</span>';
  const note = live ? 'A run is on. Your deck, ' + (h === 'jedi' ? 'tree and path are' : 'and what it holds, is') + ' set between runs: finish or leave this one to change ' + (h === 'jedi' ? 'them' : 'it') + '.'
    : deck ? 'The upgrade page deals its three cards from these, for the same one skill point as ever. If the deck runs dry in a run (every card trained to the top), the rest of your cards fill in. Click a card to add it or take it out.'
    : 'No deck yet: the upgrade page deals from every card you own. Build one to choose what your runs are made of.';
  const cols = [1, 2, 3].map(t => {
    const cards = set.filter(s => s.tier === t), k = deck ? deckCount(h, set, t) : 0, full = k >= DECK_QUOTA[t];
    return '<div class="pf-branch pf-dtier"><div class="pf-bh"><b>' + TIER_NAME[t] + '</b>' + (deck ? '<span class="pf-ins"><b>' + k + '</b> / ' + DECK_QUOTA[t] + '</span>' : '') + '</div>' +
      cards.map(s => {
        const mine = owns(h, s), inD = deck && deck.includes(s.id);
        const st = !mine ? 'rank' : !deck ? 'all' : inD ? 'learned' : full ? 'insight' : 'open';
        const tag = !mine ? '<em class="pf-lock">' + esc(lockWhy(h, s)) + '</em>' : !deck ? '<em class="pf-lock">DEALT</em>' : inD ? '<em class="pf-got">IN YOUR DECK</em>' : full ? '<em class="pf-lock">TIER FULL</em>' : '';
        const kind = s.align ? ' · ' + s.align.toUpperCase() : s.prof ? ' · YOUR TREE' : s.rank ? ' · RANK' : '';
        const click = mine && deck && !live && (inD || !full) ? ' data-deck="' + s.id + '"' : '';
        return '<div class="pf-node pf-dcard ' + st + (click ? ' pick' : '') + '"' + click + '><div class="pf-nh"><span class="pf-ic">' + icon(s.ico) + '</span><b>' + esc(s.nm) + '</b>' + (kind ? '<span class="pf-tier-k">' + kind.slice(3) + '</span>' : '') + '</div><p>' + s.ds + '</p>' + tag + '</div>';
      }).join('') + '</div>';
  }).join('');
  return `<div class="pf-col pf-right">
    ${viewTabs(h)}
    <div class="pf-th"><h3>YOUR DECK</h3>${deck ? `<span class="pf-ins"><b>${n}</b> / ${DECK_SIZE} CARDS</span>` : ''}${acts}</div>
    <p class="pf-note${live ? ' pf-live-note' : ''}">${note}</p>
    <div class="pf-tree">${cols}</div>
  </div>`;
}

function render(){
  panel.innerHTML = `<div class="howto-panel pf-panel">
    <div class="howto-head"><div class="howto-title">PROFILE</div><div class="rm-sub">Kept on this device, in every mode and save slot</div><div class="howto-x" id="pfclose">✕</div></div>
    <div class="cz-tabs pf-tabs">${Object.keys(HERO_NAME).map(h => '<span data-h="' + h + '"' + (h === hero ? ' class="on"' : '') + '>' + HERO_NAME[h] + '</span>').join('')}</div>
    <div class="pf-body${runLive() ? ' pf-live' : ''}">${leftCol(hero)}${view === 'deck' ? deckCol(hero) : hero === 'jedi' ? treeCol() : cardsCol(hero)}</div>
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
  if (dk){ if (toggleDeck(hero, SET_OF[hero], dk.dataset.deck)) S.reward(1); return render(); }
  if (da){ setDeck(hero, da.dataset.deckact === 'all' ? null : suggestDeck(hero, SET_OF[hero])); return render(); }
  const tab = t.closest('[data-h]'), learn = t.closest('[data-learn]'), path = t.closest('[data-path]'), reset = t.closest('[data-reset]');
  if (t.closest('#pfclose') || t === panel) return setProfile(false);
  if (tab){ hero = tab.dataset.h; armed = false; render(); }
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
