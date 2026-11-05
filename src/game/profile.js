// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// YOUR HERO'S PROFILE (data/profile.js has the ladders, the XP table and the Force Tree): one persistent record per hero on
// this device, in localStorage sw_profile. It is not in a save slot (game/saves.js PROGRESS doesn't match it) and NEW GAME
// leaves it, so a rank outlives every run. Everything the game already counts feeds it through the small note* hooks below
// (a chapter's close, a mission won, a mastery rank, a duel, a survival wave), from every mode that is a real fight, and in
// co-op each browser feeds its own player's profile.
//
// CO-OP AND THE HUB: profileCard() is the small public face of a profile (hero, rank, tree, deck) that net/partner.js sends with
// each hello, so every player sees the others' ranks; the Tython hub will read the same card for everyone standing in it.

import { G } from '../state.js';
import { TRACKS, RANK_XP, TRIALS, JEDI_TREE, RANK_SKILLS, RANK_CARD, BRANCHES, BRANCH, DECK_QUOTA } from '../data/profile.js';
import { ALIGN } from '../data/alignment.js';
import { partEarned } from '../data/saber-parts.js';
import { benchOf, earnableOf, BENCH_NAME, BENCH_BUTTON, BENCH_KICKER } from '../data/hero-benches.js';

const KEY = 'sw_profile';
const HEROES = ['jedi', 'mando', 'trooper'];
let store = null;
const learning = () => G.mode === 'play' && !G.training && !G.sandbox && !G.hub;

function load(){
  if (store) return store;
  try { store = JSON.parse(localStorage.getItem(KEY)); } catch(e){ store = null; }
  if (!store || store.v !== 1 || typeof store.heroes !== 'object') store = { v: 1, heroes: {} };
  return store;
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(load())); } catch(e){} }
const blank = () => ({ xp: 0, rank: 0, cleared: {}, missions: {}, won: 0, duels: 0, waves: 0, forms: 0, powers: 0, arcade: 0, revives: 0, squadWaves: 0,
                       picks: [], path: null, forks: {}, deck: null, fresh: false, parts: null, sides: {}, secrets: {},
                       align: 0, alignPeak: { light: 0, dark: 0 }, sidePicks: {}, mercy: { spared: 0, struck: 0 } });

/* A HERO SEEN FOR THE FIRST TIME: a player from before profiles keeps what they did. Their cleared chapters, campaign
   wins and mission wins (the live progress and every save slot's) are counted once, as first clears, with no ceremony. */
function seed(hero){
  const p = blank(), sources = [];
  try { const live = {}; for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); live[k] = localStorage.getItem(k); } sources.push(live); } catch(e){}
  for (const i of ['auto', 0, 1, 2]){ try { const d = JSON.parse(localStorage.getItem('sw_save_' + i)); if (d && d.progress) sources.push(d.progress); } catch(e){} }
  const list = (v) => { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch(e){ return []; } };
  for (const src of sources){
    for (const id of [...list(src['sw_camp_ch_' + hero]), ...list(src['sw_camp_looks_' + hero])]) p.cleared[id] = 1;
    if (src['sw_camp_' + hero] === '1') p.won = 1;
    for (const k in src){ const m = /^sw_mission_(.+)_(jedi|mando|trooper)$/.exec(k); if (m && m[2] === hero && src[k] === '1') p.missions[m[1]] = 1; }
  }
  for (const id in p.cleared) p.xp += TRIALS.includes(id) ? RANK_XP.trial : RANK_XP.chapter;
  p.xp += Object.keys(p.missions).length * RANK_XP.mission + (p.won ? RANK_XP.won : 0);
  p.rank = rankFor(hero, p);
  return p;
}
export function profileOf(hero = G.hero){
  const s = load();
  if (!HEROES.includes(hero)) hero = 'jedi';
  if (!s.heroes[hero]){ s.heroes[hero] = seed(hero); save(); }
  const p = s.heroes[hero];
  if (!Array.isArray(p.parts)){ p.parts = earnedParts(hero, p); save(); }   // (what a profile from before its bench has earned comes with no fanfare)
  return p;
}

/* ---------- ranks ---------- */
export const track = (hero = G.hero) => TRACKS[hero] || TRACKS.jedi;
export const trialsPassed = (p) => TRIALS.filter(id => p.cleared[id]).length;
// does the profile meet this rank's asks? (each one listed for the profile page: { what, ok, have, need })
export function rankNeeds(hero, p, r){
  const R = track(hero).ranks[r], out = [];
  if (!R) return out;
  if (R.xp) out.push({ what: 'xp', ok: p.xp >= R.xp, have: p.xp, need: R.xp });
  if (R.trials) out.push({ what: 'trials', ok: trialsPassed(p) >= TRIALS.length, have: trialsPassed(p), need: TRIALS.length });
  if (R.chapter) out.push({ what: 'chapter', id: R.chapter, ok: !!p.cleared[R.chapter] });
  if (R.won) out.push({ what: 'won', ok: p.won > 0 });
  return out;
}
const meets = (hero, p, r) => rankNeeds(hero, p, r).every(n => n.ok);
// the highest rank whose asks are all met, climbing in order (a rank is never skipped)
function rankFor(hero, p){
  const n = track(hero).ranks.length;
  let r = 0;
  while (r + 1 < n && meets(hero, p, r + 1)) r++;
  return r;
}
export const rankIndex = (hero = G.hero) => profileOf(hero).rank;
export const rankName = (hero = G.hero) => track(hero).ranks[rankIndex(hero)].nm;
const rankIdx = (hero, id) => track(hero).ranks.findIndex(R => R.id === id);
export const hasRank = (hero, id) => rankIndex(hero) >= rankIdx(hero, id) && rankIdx(hero, id) >= 0;

// what promotes: every rank reached since the last look, each with its card. Rank-ups at a chapter's close show as cards
// with what it hands over (game/flow.js checkUnlocks takes them); anywhere else a corner note says so (promoteHook).
let promoteHook = null;
export const onPromote = (fn) => { promoteHook = fn; };
const heldCards = [];
// atClose: a chapter's close, where a rank-up is a card among what the chapter hands over; anywhere else, a corner note
function settle(hero, atClose){
  const p = profileOf(hero), was = p.rank, now = rankFor(hero, p);
  settleParts(hero, p, atClose);
  if (now <= was){ save(); return; }
  p.rank = now; p.fresh = true;
  save();
  for (let r = was + 1; r <= now; r++){
    const c = atClose && rankCard(hero, r);
    if (c) heldCards.push(c);
    else if (!(atClose && track(hero).ranks[r].chapter) && promoteHook) promoteHook(hero, r);   // (a story promotion has the campaign's own card)
  }
}
// a rank's card (ui/ability-card.js shows an unlock's own `card`). The trooper's story ranks already have the campaign's
// promotion cards (data/ability-cards.js promote-*), so only his post-game rank gets one here.
function rankCard(hero, r){
  const R = track(hero).ranks[r], book = RANK_CARD[hero], lines = book && book.lines[R.id];
  if (!lines) return null;
  const rows = [];
  const ins = insightAt(hero, r) - insightAt(hero, r - 1);
  if (ins > 0) rows.push(['FORCE TREE', '+' + ins + ' INSIGHT']);
  for (const s of RANK_SKILLS[hero] || []) if (s.rank === R.id) rows.push(['NEW TRAINING CARD', s.nm]);
  const tier = TIER_OF_RANK[hero] && TIER_OF_RANK[hero][R.id];
  if (tier) rows.push(['FORCE TREE', 'TIER ' + ['', 'I', 'II', 'III'][tier] + ' NODES OPEN']);
  return { key: 'rank-' + R.id, hud: '', card: { kicker: book.kicker, name: R.nm, lines: [...lines, 'Your rank stays with you in every mode, run and co-op game. Open PROFILE to see it.'], rows } };
}
export const takeRankCards = () => heldCards.splice(0);

/* ---------- BENCH PARTS (the saber workbench, the armory locker, the beskar forge: data/hero-benches.js): earned once,
   kept, announced once ---------- */
const partKey = (row, part) => row + ':' + part.id;
const earnedParts = (hero, p) => earnableOf(hero).filter(([row, part]) => partEarned(p, part.earn)).map(([row, part]) => partKey(row, part));
export const partsOwned = (hero = 'jedi') => benchOf(hero).reduce((n, r) => n + r.parts.filter(x => !x.earn || partEarned(profileOf(hero), x.earn)).length, 0);
export const partsTotal = (hero = 'jedi') => benchOf(hero).reduce((n, r) => n + r.parts.length, 0);
let partHook = null;
export const onPart = (fn) => { partHook = fn; };
// what a part is called on its card: a crystal is a KYBER CRYSTAL, anything else its row's name
const partWhat = (hero, row) => row === 'saber' ? 'KYBER CRYSTAL' : benchOf(hero).find(r => r.id === row).label;
const partLine = (row, part) => part.att ? part.att + ': ' + part.ds : part.line;
// a part just earned: a card at a chapter's close (with what the chapter hands over), a corner note anywhere else
function settleParts(hero, p, atClose){
  const have = new Set(p.parts || []);
  for (const [row, part] of earnableOf(hero)){
    const k = partKey(row, part);
    if (have.has(k) || !partEarned(p, part.earn)) continue;
    have.add(k); p.fresh = true;
    const what = partWhat(hero, row), line = partLine(row, part);
    if (atClose) heldCards.push({ key: 'part-' + hero + '-' + k, hud: '', card: { kicker: BENCH_KICKER[hero], name: part.name.toUpperCase() + (hero === 'jedi' ? ' ' : ' · ') + what,
      lines: [line, 'Fit it at the ' + BENCH_NAME[hero] + ' between runs: ' + BENCH_BUTTON[hero] + ' on the main menu. It stays yours in every mode, run and co-op game.'],
      rows: [['NEW ' + what, part.name.toUpperCase()]] } });
    else if (partHook) partHook(what, part, line, hero);
  }
  p.parts = [...have];
}

/* ---------- rank XP: the hooks ---------- */
function gain(n, hero = G.hero){
  if (!(n > 0)) return;
  profileOf(hero).xp += Math.round(n);
}
// a chapter of this run has just closed (game/flow.js checkUnlocks, closing): host or co-op guest alike
export function noteChapterCleared(id){
  if (!id || !learning()) return;
  const p = profileOf();
  const first = !p.cleared[id];
  p.cleared[id] = (p.cleared[id] || 0) + 1;
  gain(first ? (TRIALS.includes(id) ? RANK_XP.trial : RANK_XP.chapter) : RANK_XP.replay);
  settle(G.hero, true);
}
// a story mission won from the Missions page (not a campaign chapter: that's its close), or an arcade contract
export function noteMissionWon(id, arcade){
  if (!learning()) return;
  const p = profileOf();
  if (arcade){ p.arcade++; gain(RANK_XP.arcade); }
  else { const first = !p.missions[id]; p.missions[id] = (p.missions[id] || 0) + 1; gain(first ? RANK_XP.mission : RANK_XP.missionAgain); }
  settle(G.hero);
}
// a side mission from the temple won (data/side-quests.js): more rank XP the first time
export function noteSideWon(id){
  if (!learning()) return;
  const p = profileOf();
  p.sides ||= {};
  const first = !p.sides[id];
  p.sides[id] = (p.sides[id] || 0) + 1;
  gain(first ? RANK_XP.side : RANK_XP.sideAgain);
  settle(G.hero);
}
export const sidesWon = (hero = G.hero) => Object.keys(profileOf(hero).sides || {}).length;
export const sideWon = (id, hero = G.hero) => !!(profileOf(hero).sides || {})[id];
// a secret on a story map (data/secrets.js) found: its rank XP once, and true the first time
export const secretFound = (id, hero = G.hero) => !!(profileOf(hero).secrets || {})[id];
export function noteSecret(id, kind){
  if (!learning()) return false;
  const p = profileOf();
  p.secrets ||= {};
  if (p.secrets[id]) return false;
  p.secrets[id] = 1;
  gain(RANK_XP[kind] || 0);
  settle(G.hero);
  return true;
}
export function noteCampaignWon(){
  const p = profileOf();
  gain(p.won ? RANK_XP.wonAgain : RANK_XP.won);
  p.won++;
  settle(G.hero);
}
// mid-fight: a mastery rank, a duel, a survival wave (no card: a corner note if it promotes)
function counted(field, xp){
  if (!learning()) return;
  const p = profileOf();
  p[field] = (p[field] || 0) + 1;
  gain(xp);
  settle(G.hero);
}
export const noteFormRank = () => counted('forms', RANK_XP.form);
export const notePowerRank = () => counted('powers', RANK_XP.power);
export const noteDuelWon = () => counted('duels', RANK_XP.duel);
export const noteSurvivalWave = () => counted('waves', RANK_XP.wave);
// the trooper's squad play (the ARMORY LOCKER's asks, data/trooper-locker.js): a squadmate got up by your own hand, a
// survival wave cleared with nobody in the squad down. No XP of their own: they only count towards locker parts
function tally(field){
  if (!learning()) return;
  const p = profileOf();
  p[field] = (p[field] || 0) + 1;
  settle(G.hero);
}
export const noteSquadRevive = () => tally('revives');
export const noteSquadWave = () => tally('squadWaves');
// the side of a fork the run took (ui/store-ui.js buyStore; Form VII's at its meditation), shown on the Force Tree
export function noteFork(fork, id){
  if (G.hero !== 'jedi' || !fork || !id) return;
  const p = profileOf('jedi');
  if (p.forks[fork] === id) return;
  p.forks[fork] = id; save();
}

/* ---------- the Force Tree (the Jedi) ---------- */
// a tree tier's nodes wait for a rank: FOUNDATION for Padawan, DISCIPLINE for Knight, CAPSTONE for Master
const RANK_OF_TIER = { 1: 'padawan', 2: 'knight', 3: 'master' };
const TIER_OF_RANK = { jedi: { knight: 2, master: 3 } };
export const tierRank = (tier) => RANK_OF_TIER[tier];
function insightAt(hero, r){
  const ins = track(hero).insight;
  if (!ins || r < 0) return 0;
  return ins.slice(0, r + 1).reduce((a, b) => a + b, 0);
}
export const insightTotal = (hero = 'jedi') => insightAt(hero, rankIndex(hero));
export const insightLeft = (hero = 'jedi') => insightTotal(hero) - profileOf(hero).picks.length;
export const nodeLearned = (id) => profileOf('jedi').picks.includes(id);
export function nodeState(n){
  if (nodeLearned(n.prof)) return 'learned';
  if (!hasRank('jedi', RANK_OF_TIER[n.tier])) return 'rank';
  return insightLeft('jedi') > 0 ? 'open' : 'insight';
}
export function learnNode(id){
  const n = JEDI_TREE.find(x => x.prof === id);
  if (!n || runLive() || nodeState(n) !== 'open') return false;
  profileOf('jedi').picks.push(id); save();
  return true;
}
// the tree's picks back to Insight, free: a rank opens choices, so changing your mind costs nothing
export function resetTree(){ if (runLive()) return; const p = profileOf('jedi'); p.picks = []; if (p.deck) p.deck = p.deck.filter(id => !JEDI_TREE.some(n => n.id === id)); save(); }
// your PATH: the branch the upgrade page always deals one card from, when it has one to deal (ui/store-ui.js rollFreeCards)
export const treePath = () => profileOf('jedi').path || null;
export function setPath(id){ if (runLive()) return; const p = profileOf('jedi'); p.path = BRANCHES.some(b => b.id === id) && p.path !== id ? id : null; save(); }

// may the run's upgrade page deal this card? A tree node once learned; a Mando or trooper rank card once its rank is held
export function owns(hero, s){
  if (s.align) return hero === 'jedi' && alignOpen(s);
  if (s.prof) return hero === 'jedi' && nodeLearned(s.prof);
  if (s.rank) return hasRank(hero, s.rank);
  return true;
}
export const profileOpens = (s) => owns(G.hero, s);

/* ---------- YOUR DECK: chosen between runs, dealt from in the run (ui/store-ui.js rollFreeCards) ----------
   null is no deck: the page deals from every card you own. The page passes the hero's card set in (data/skills.js,
   data/trooper-progression.js), so this file stays clear of the run's own modules. */
// a run is on: the deck, the tree and the path are set between runs (the menu, the results, and later the Tython hub)
export const runLive = () => G.mode === 'play';
export const deckOf = (hero = G.hero) => profileOf(hero).deck || null;
export const inDeck = (s, hero = G.hero) => { const d = deckOf(hero); return !d || d.includes(s.id); };
export const deckCount = (hero, set, tier) => { const d = deckOf(hero) || []; return set.filter(s => s.tier === tier && d.includes(s.id)).length; };
export function toggleDeck(hero, set, id){
  const p = profileOf(hero), s = set.find(x => x.id === id);
  if (runLive() || !p.deck || !s || !owns(hero, s)) return false;
  if (p.deck.includes(id)) p.deck = p.deck.filter(x => x !== id);
  else if (deckCount(hero, set, s.tier) < DECK_QUOTA[s.tier]) p.deck.push(id);
  else return false;
  save(); return true;
}
// a first deck to start from: per tier, your path's cards, then the tree's and the ranks' own, then the rest in order
export function suggestDeck(hero, set){
  const path = hero === 'jedi' && treePath(), d = [];
  const score = (s) => (path && (s.branch || BRANCH[s.id]) === path ? 0 : 2) + (s.prof || s.rank ? 0 : 1);
  for (const t of [1, 2, 3]){
    const mine = set.map((s, i) => ({ s, i })).filter(x => x.s.tier === t && owns(hero, x.s)).sort((a, b) => score(a.s) - score(b.s) || a.i - b.i);
    d.push(...mine.slice(0, DECK_QUOTA[t]).map(x => x.s.id));
  }
  return d;
}
export function setDeck(hero, ids){
  if (runLive()) return false;
  profileOf(hero).deck = Array.isArray(ids) ? [...ids] : null; save(); return true;
}
// owning less than you chose (a tree reset, a profile reset): the deck keeps only what's still yours
export function pruneDeck(hero, set){
  const p = profileOf(hero);
  if (!p.deck) return;
  const keep = p.deck.filter(id => { const s = set.find(x => x.id === id); return s && owns(hero, s); });
  if (keep.length !== p.deck.length){ p.deck = keep; save(); }
}

/* ---------- LIGHT AND DARK: the meter (data/alignment.js; game/alignment.js feeds it) ---------- */
// -100 (the dark) to +100 (the light). Real fights only: training and the sandbox are practice
const aligning = () => !G.training && !G.sandbox;
export const alignOf = (hero = G.hero) => profileOf(hero).align || 0;
// which way the hero leans: 'light', 'dark', or null (balanced)
export function leanOf(hero = G.hero, a = alignOf(hero)){ return a >= ALIGN.lean ? 'light' : a <= -ALIGN.lean ? 'dark' : null; }
export function alignStage(hero = G.hero, a = alignOf(hero)){
  return a >= ALIGN.deep ? 'deepLight' : a >= ALIGN.lean ? 'light' : a <= -ALIGN.deep ? 'deepDark' : a <= -ALIGN.lean ? 'dark' : 'mid';
}
// a path's card (data/alignment.js ALIGN_TREE) is open while you lean its way and hold its tier's rank
export function alignOpen(n){ return leanOf('jedi') === n.align && hasRank('jedi', RANK_OF_TIER[n.tier]); }
// move the meter by n (+ light, - dark); what it actually moved. `force` moves it even in practice (tests)
let alignHook = null;
export const onAlign = (fn) => { alignHook = fn; };
export function shiftAlign(n, hero = G.hero, why = '', force = false){
  if (!n || (!force && !aligning()) || !HEROES.includes(hero)) return 0;
  const p = profileOf(hero), was = p.align || 0, before = leanOf(hero, was);
  p.align = Math.max(-ALIGN.max, Math.min(ALIGN.max, was + n));
  p.alignPeak ||= { light: 0, dark: 0 };
  p.alignPeak.light = Math.max(p.alignPeak.light || 0, p.align);
  p.alignPeak.dark = Math.max(p.alignPeak.dark || 0, -p.align);
  settle(hero);   // (a path's crystal: game/profile.js settleParts)
  const moved = p.align - was, now = leanOf(hero, p.align);
  if (now !== before){ p.fresh = true; save(); }
  if (moved && alignHook) alignHook(hero, moved, now !== before ? now || 'mid' : null, why);
  return moved;
}
// a side mission's choice, once per profile: true the first time it is made
export const sidePicked = (id, hero = G.hero) => (profileOf(hero).sidePicks || {})[id] || null;
export function noteSidePick(id, key, hero = G.hero){
  const p = profileOf(hero);
  p.sidePicks ||= {};
  if (p.sidePicks[id]) return false;
  p.sidePicks[id] = key; save();
  return true;
}
export function noteMercy(kind, hero = G.hero){ const p = profileOf(hero); p.mercy ||= { spared: 0, struck: 0 }; p.mercy[kind] = (p.mercy[kind] || 0) + 1; save(); }

/* ---------- the page and co-op ---------- */
export function seenFresh(hero = G.hero){ const p = profileOf(hero); if (p.fresh){ p.fresh = false; save(); } }
export const anyFresh = () => HEROES.some(h => load().heroes[h] && load().heroes[h].fresh);
// the public face of a profile, sent to the other players (net/partner.js) and read by the hub: small and stable
export function profileCard(hero = G.hero){
  const p = profileOf(hero);
  return { h: hero, r: p.rank, n: track(hero).ranks[p.rank].nm, t: hero === 'jedi' ? [...p.picks] : [], d: p.deck ? [...p.deck] : null, a: Math.round(p.align || 0) };
}
// a card heard from another player: kept to what it should hold
export function cleanCard(c){
  if (!c || typeof c !== 'object' || !HEROES.includes(c.h)) return null;
  const ranks = track(c.h).ranks, r = Math.max(0, Math.min(ranks.length - 1, c.r | 0));
  return { h: c.h, r, n: ranks[r].nm, t: Array.isArray(c.t) ? c.t.filter(id => JEDI_TREE.some(n => n.prof === id)).slice(0, 8) : [],
           d: Array.isArray(c.d) ? c.d.filter(id => typeof id === 'string' && /^[a-z0-9_]{1,24}$/.test(id)).slice(0, 12) : null,
           a: Math.max(-ALIGN.max, Math.min(ALIGN.max, Math.round(Number(c.a) || 0))) };
}
// the profile page's RESET: this hero starts over at the first rank (the save slots and their wins are untouched)
export function resetProfile(hero){ const s = load(); s.heroes[hero] = blank(); save(); }
// tools and tests
export const profileStore = () => load();
export function reloadProfile(){ store = null; return load(); }
