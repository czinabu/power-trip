// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PROFILE PAGE: each hero's rank, what the next one asks for, the record that earned it and (the Jedi) the FORCE TREE,
// where Insight from each rank learns the tree's own cards and a PATH picks the branch the upgrade page always deals from.
// Opens from PROFILE on the main menu and the pause screen, in every mode. The Mando and the trooper have a lighter page:
// the ladder and the cards each rank opens. game/profile.js keeps it all; data/profile.js has the words.

import { G } from '../state.js';
import { audioInit, S } from '../audio/sfx.js';
import {
  profileOf, track, rankNeeds, trialsPassed, insightLeft, insightTotal, nodeState, learnNode, resetTree, treePath, setPath,
  seenFresh, anyFresh, onPromote, resetProfile, tierRank,
} from '../game/profile.js';
import { TRIALS, JEDI_TREE, RANK_SKILLS, BRANCHES, BRANCH, FORK_BRANCH } from '../data/profile.js';
import { SKILLS, TIER_NAME } from '../data/skills.js';
import { JEDI_STORE } from '../data/store.js';
import { FORMS } from '../data/forms.js';
import { chapterOrder, forHero } from '../data/campaign.js';
import { icon } from './icons.js';
import { upToast } from '../game/upgrades.js';

const panel = document.getElementById('profile');
const btn = document.getElementById('pfBtn');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HERO_NAME = { jedi: 'JEDI', mando: 'MANDALORIAN', trooper: 'ARC TROOPER' };
let hero = 'jedi', armed = false;

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
               ['CAMPAIGN WINS', p.won], ['DUELS WON', p.duels], h === 'jedi' ? ['FORM RANKS', p.forms] : ['MASTERY RANKS', p.powers]];
  return `<div class="pf-col pf-left">
    <div class="pf-kick">${esc(T.name)} · ${esc(HERO_NAME[h])}</div>
    <div class="pf-rank">${esc(R.nm)}</div>
    <div class="pf-xp"><b>${num(p.xp)}</b> ${esc(T.unit)}</div>
    <div class="pf-bar"><i style="width:${Math.round(frac * 100)}%"></i></div>
    ${next ? `<div class="pf-next"><h4>NEXT · ${esc(next.nm)}</h4><ul>${nx.map(n => needLine(n, h)).join('')}</ul></div>` : '<div class="pf-next"><h4>THE TOP OF THE LADDER</h4><p class="pf-note">Every rank is yours.</p></div>'}
    <div class="pf-sec"><h4>THE LADDER</h4><ol class="pf-ladder">${ladder}</ol></div>
    <div class="pf-sec"><h4>RECORD</h4><div class="pf-rec">${rec.map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('')}</div></div>
    <div class="pf-sec pf-how"><h4>EARNING ${esc(T.unit)}</h4><p>Chapters cleared (trials count double), story missions and arcade contracts won, ${h === 'jedi' ? 'form and power' : 'gear'} mastery ranks, duels won and survival waves. Training and the sandbox are practice: they never count.</p></div>
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
    <div class="pf-th"><h3>FORCE TREE</h3><span class="pf-ins"><b>${left}</b> INSIGHT LEFT · ${insightTotal()} FROM YOUR RANKS</span><span class="btn pf-reset" data-reset="tree">RESET TREE</span></div>
    <p class="pf-note">A learned card joins the run's upgrade page at its tier, beside the rest, for the same one skill point: more to choose from, never a bigger number. Your PATH's branch always has a card in the hand. Free to change between runs.</p>
    <div class="pf-tree">${cols}</div>
  </div>`;
}
function cardsCol(h){
  const T = track(h), list = RANK_SKILLS[h] || [];
  return `<div class="pf-col pf-right">
    <div class="pf-th"><h3>RANK CARDS</h3></div>
    <p class="pf-note">Each rank adds one card to the run's upgrade page at its tier, for the same one skill point as the rest: more to choose from, never a bigger number.</p>
    <div class="pf-cards">${list.map(s => {
      const ri = T.ranks.findIndex(r => r.id === s.rank), have = profileOf(h).rank >= ri;
      return '<div class="pf-node ' + (have ? 'learned' : 'rank') + '"><div class="pf-nh"><span class="pf-ic">' + icon(s.ico) + '</span><b>' + esc(s.nm) + '</b><span class="pf-tier-k">' + TIER_NAME[s.tier] + '</span></div><p>' + s.ds + '</p>' +
        (have ? '<em class="pf-got">IN YOUR RUNS</em>' : '<em class="pf-lock">AT ' + esc(T.ranks[ri].nm) + '</em>') + '</div>';
    }).join('')}</div>
  </div>`;
}

function render(){
  panel.innerHTML = `<div class="howto-panel pf-panel">
    <div class="howto-head"><div class="howto-title">PROFILE</div><div class="rm-sub">Kept on this device, in every mode and save slot</div><div class="howto-x" id="pfclose">✕</div></div>
    <div class="cz-tabs pf-tabs">${Object.keys(HERO_NAME).map(h => '<span data-h="' + h + '"' + (h === hero ? ' class="on"' : '') + '>' + HERO_NAME[h] + '</span>').join('')}</div>
    <div class="pf-body">${leftCol(hero)}${hero === 'jedi' ? treeCol() : cardsCol(hero)}</div>
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
  upToast('RANK EARNED · ' + R.nm, (h === 'jedi' ? 'New Insight for the Force Tree' : 'A new card for your runs') + ' · see PROFILE', 'mast');
});
new MutationObserver(refreshButton).observe(document.getElementById('overlay'), { attributes: true, attributeFilter: ['class', 'style'] });
refreshButton();
