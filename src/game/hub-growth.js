// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A HOME THAT GROWS WITH YOUR GROUP (data/hub-growth.js has the words and the plan). What's restored in each hero's hub,
// the trophies it keeps and the friends it remembers, all read from that hero's own profile (game/profile.js):
//   · RESTORED wings come straight from what the profile already counts (side missions won, Act IV chapters cleared, raids
//     won), so nothing new is saved for them and a player from before this keeps everything they earned.
//   · TROPHIES and FRIENDS are kept on the profile (p.trophies, p.friends): a boss down in any real fight (every mode but
//     training, the sandbox and the hub) is a trophy; a raid won, an Act IV chapter cleared, a side mission won or a
//     boss downed with other players in the party adds their names to the wall.
//   · CO-OP: the party stands in the HOST's hub (game/hub.js hubIdFor), so it shows the host's growth: each player's
//     profile card (net/partner.js, every few seconds) carries a small copy of it (growthCard). Each guest's own browser
//     counts the same win into their own profile, so helping a friend grows your own hub too.
//   · Each hub builder (world/arenas/tython.js, covert-hub.js, clone-citadel.js) asks `hubGrowth()` what to build;
//     world/arenas/growth-kit.js builds the ruins, the dark and the trophy hall, streaming its pieces in a few a frame.

import { G } from '../state.js';
import { GROWTH, GROWTH_IDS, TROPHIES, TROPHY_IDS, DEEDS_HALL, FRIENDS_MAX, FRIENDS_SHOWN, NEEDS_TEXT } from '../data/hub-growth.js';
import { HUBS, hubOf } from '../data/hub.js';
import { RAIDS } from '../data/raids.js';
import { profileOf, saveProfile, onDeed, setCardExtra } from './profile.js';
import { net, connected } from '../net/session.js';
import { partnerCards } from '../net/partner.js';
import { cleanName } from '../net/names.js';

const HEROES = ['jedi', 'mando', 'trooper'];
const GATE_CH = ['gate-wake', 'gate-jedi', 'gate-mando', 'gate-trooper', 'gate-heart'];
const get = (k) => { try { return localStorage.getItem(k); } catch(e){ return null; } };
const day = () => Math.floor(Date.now() / 86400000);
// a real fight: what the profile counts (game/profile.js learning)
const live = () => G.mode === 'play' && !G.training && !G.sandbox && !G.hub;

/* ---------- what a hero's hub has restored ---------- */
export function gateCleared(hero){ const c = profileOf(hero).cleared || {}; return GATE_CH.filter(id => c[id]).length; }
export const gateWon = (hero) => !!(profileOf(hero).cleared || {})['gate-heart'] || get('sw_camp_gate_' + hero) === '1';
export function needMet(n, hero){
  const p = profileOf(hero);
  if (n.sides) return Object.keys(p.sides || {}).length >= n.sides;
  if (n.gate) return gateCleared(hero) >= n.gate;
  if (n.gateWon) return gateWon(hero);
  if (n.raids) return (p.raids || 0) >= n.raids;
  return true;
}
// how far toward it: { have, need } (the ledger's bar)
export function needProgress(n, hero){
  const p = profileOf(hero);
  if (n.sides) return { have: Math.min(n.sides, Object.keys(p.sides || {}).length), need: n.sides };
  if (n.gate) return { have: Math.min(n.gate, gateCleared(hero)), need: n.gate };
  if (n.gateWon) return { have: gateWon(hero) ? 1 : 0, need: 1 };
  if (n.raids) return { have: Math.min(n.raids, p.raids || 0), need: n.raids };
  return { have: 1, need: 1 };
}
export const growthList = (hub) => GROWTH[hub] || [];
export const restoredOf = (hero) => growthList(hubOf(hero)).filter(R => needMet(R.need, hero)).map(R => R.id);

/* ---------- trophies ---------- */
// a profile from before trophies: the bosses this hero has already beaten stand in the hall, with no names on them
function seedTrophies(hero, p){
  if (p.trophies) return p.trophies;
  const t = {}, own = { jedi: 'vexis', mando: 'magistrate', trooper: 'marshal' }[hero];
  if (get('sw_camp_' + hero) === '1' || p.won > 0) t[own] = { n: 1, d: 0, w: [] };
  if (gateWon(hero)) t.kharel = { n: 1, d: 0, w: [] };
  p.trophies = t; saveProfile();
  return t;
}
export const trophiesOf = (hero = G.hero) => seedTrophies(hero, profileOf(hero));
// who else is in the fight right now (their names as the room knows them)
function mates(){
  if (!connected()) return [];
  return partnerCards().map(c => cleanName(c.name)).filter(Boolean).slice(0, 3);
}
// a boss down (boss/finale.js, boss/boss.js, enemies/damage.js and net/foes.js for the Warbringer): its trophy, the first
// time, with whoever stood there; again, its count. True the first time
export function noteTrophy(id){
  if (!live() || !TROPHIES[id]) return false;
  const t = trophiesOf(G.hero), who = mates(), first = !t[id];
  if (first) t[id] = { n: 1, d: day(), w: who };
  else t[id].n = (t[id].n || 0) + 1;
  noteFriends(who);
  saveProfile();
  return first;
}
/* ---------- friends ---------- */
// p.friends: { NAME: { n (deeds together), d (the last day) } }, the most recent FRIENDS_MAX kept
function noteFriends(who){
  if (!who.length) return;
  const p = profileOf(G.hero), f = p.friends ||= {}, d = day();
  for (const name of who){ const e = f[name] ||= { n: 0, d }; e.n++; e.d = d; }
  const keys = Object.keys(f);
  if (keys.length > FRIENDS_MAX) keys.sort((a, b) => f[b].d - f[a].d || f[b].n - f[a].n).slice(FRIENDS_MAX).forEach(k => delete f[k]);
}
export function friendsOf(hero = G.hero){
  const f = profileOf(hero).friends || {};
  return Object.keys(f).sort((a, b) => f[b].n - f[a].n || f[b].d - f[a].d).map(name => ({ name, n: f[name].n }));
}
// game/profile.js calls this as a raid, an Act IV chapter or a side mission is won: the names of whoever helped
onDeed(() => { if (live()) noteFriends(mates()); });

/* ---------- raid banners: one for each raid day this hero has beaten (the profile keeps the last fourteen) ---------- */
export function raidDaysOf(hero = G.hero){
  const log = profileOf(hero).raidLog || {}, out = [];
  for (const id in log) if (RAIDS[id]) for (const d of log[id].days || []) out.push({ id, day: d });
  return out.sort((a, b) => b.day - a.day);
}

/* ---------- the card: a small copy for the other players (net/partner.js, with each profile card) ---------- */
export function growthCard(hero){
  return {
    o: restoredOf(hero),
    t: Object.keys(trophiesOf(hero)).filter(id => TROPHIES[id]),
    b: raidDaysOf(hero).slice(0, 8).map(r => [r.id, r.day]),
    f: friendsOf(hero).slice(0, FRIENDS_SHOWN).map(x => [x.name, x.n]),
  };
}
export function cleanGrowth(c){
  if (!c || typeof c !== 'object') return null;
  const arr = (v) => Array.isArray(v) ? v : [];
  return {
    o: arr(c.o).filter(id => GROWTH_IDS.includes(id)),
    t: arr(c.t).filter(id => TROPHY_IDS.includes(id)),
    b: arr(c.b).filter(x => Array.isArray(x) && RAIDS[x[0]] && (x[1] | 0) > 0).slice(0, 8).map(x => [x[0], x[1] | 0]),
    f: arr(c.f).filter(x => Array.isArray(x) && cleanName(x[0])).slice(0, FRIENDS_SHOWN).map(x => [cleanName(x[0]), Math.max(1, Math.min(9999, x[1] | 0))]),
  };
}
setCardExtra(growthCard, cleanGrowth);

/* ---------- the hub you're standing in: whose growth it shows ---------- */
// { hub, restored: Set, trophies: { id: { w } }, banners: [{ id, day }], friends: [{ name, n }], host }
let built = '';   // the key of what the wing in memory was built from (a guest rebuilds if the host's changes)
export function hubGrowth(hubId = G.hubId){
  const hostCard = net.role === 'guest' && connected() ? (partnerCards().find(c => c.slot === 0) || {}).card : null;
  const g = hostCard && hostCard.g && hostCard.h && hubOf(hostCard.h) === hubId ? hostCard.g : null;
  let st;
  if (g) st = { hub: hubId, restored: new Set(g.o), trophies: Object.fromEntries(g.t.map(id => [id, { w: [] }])), banners: g.b.map(([id, d]) => ({ id, day: d })), friends: g.f.map(([name, n]) => ({ name, n })), host: true };
  else {
    // your own (or, before the host is heard, the hub's own hero if it's one of yours: it's what you'd see on your own)
    const hero = hubOf(G.hero) === hubId ? G.hero : HEROES.find(h => hubOf(h) === hubId) || G.hero;
    const c = growthCard(hero);
    st = { hub: hubId, restored: new Set(c.o), trophies: trophiesOf(hero), banners: raidDaysOf(hero).slice(0, 8), friends: friendsOf(hero).slice(0, FRIENDS_SHOWN), host: false };
  }
  return st;
}
const keyOf = (st) => [...st.restored].sort().join() + '|' + Object.keys(st.trophies).sort().join() + '|' + st.banners.length + '|' + st.friends.map(f => f.name + f.n).join();
// a wing builder: what to build, remembered so a guest can tell when the host's hub has grown under them
export function buildGrowth(hubId){ const st = hubGrowth(hubId); built = keyOf(st); return st; }
// (once for each new state: a wing that isn't built from it, the ship's say, never asks again)
let tried = '';
export function growthStale(){
  if (!G.hub || net.role !== 'guest' || !connected()) return false;
  const k = keyOf(hubGrowth());
  if (k === built || k === tried) return false;
  tried = k; return true;
}
// is restoration `id` done in the hub being built (a builder's quick question)
export const isRestored = (st, id) => !st || st.restored.has(id);
// the restoration a wing waits on, if it is still waiting (its ruins and its dark)
export const wingWaiting = (st, hub, wing) => growthList(hub).find(R => R.wing === wing && !st.restored.has(R.id)) || null;

/* ---------- the homecoming news (game/hub-news.js asks first): a wing newly restored, or a new trophy ---------- */
const NKEY = (h) => 'sw_hubgrow_' + h;
function told(h){
  let n = null; try { n = JSON.parse(get(NKEY(h))); } catch(e){}
  if (n && typeof n === 'object') return n;
  // (the first time: what a player already has is known, nothing to walk them to)
  n = {}; for (const id of restoredOf(h)) n['g:' + id] = 1; for (const id in trophiesOf(h)) n['t:' + id] = 1;
  saveTold(h, n); return n;
}
function saveTold(h, n){ try { localStorage.setItem(NKEY(h), JSON.stringify(n)); } catch(e){} }
export function primeGrowth(){ if (hubOf(G.hero) === G.hubId) told(G.hero); }
export function takeGrowthNews(){
  const h = G.hero, hub = G.hubId;
  if (hubOf(h) !== hub || !HUBS[hub]) return null;
  const n = told(h);
  for (const R of growthList(hub)){
    if (n['g:' + R.id] || !needMet(R.need, h)) continue;
    n['g:' + R.id] = 1; saveTold(h, n);
    const W = HUBS[hub].wings[R.wing]; if (!W) continue;
    const s = W.stations.find(s => s.act !== 'travel') || W.stations[0];
    return { wing: R.wing, station: s && s.id, say: R.say, step: 'RESTORED · ' + R.name };
  }
  const D = DEEDS_HALL[hub];
  for (const id in trophiesOf(h)){
    if (n['t:' + id]) continue;
    n['t:' + id] = 1; saveTold(h, n);
    const W = D && HUBS[hub].wings[D.wing], s = W && W.stations.find(s => s.act === 'deeds');
    if (s) return { wing: D.wing, station: s.id, say: TROPHIES[id].what + ' stands in ' + (D.kicker.toLowerCase()) + ' now. Go and see it.', step: 'NEW · A TROPHY' };
  }
  return null;
}
export function forgetGrowthNews(){ for (const h of HEROES) try { localStorage.removeItem(NKEY(h)); } catch(e){} }

/* ---------- the ledger (ui/hub-ui.js, the deeds station's panel) ---------- */
export function ledger(st = hubGrowth()){
  const hub = st.hub;
  return {
    hall: DEEDS_HALL[hub],
    rows: growthList(hub).map(R => ({ ...R, done: st.restored.has(R.id), needText: NEEDS_TEXT(R.need), wingName: (HUBS[hub].wings[R.wing] || {}).name || '',
      prog: st.host ? null : needProgress(R.need, hubOf(G.hero) === hub ? G.hero : HEROES.find(h => hubOf(h) === hub)) })),
    trophies: TROPHY_IDS.map(id => ({ id, ...TROPHIES[id], won: !!st.trophies[id], who: (st.trophies[id] && st.trophies[id].w) || [] })),
    banners: st.banners, friends: st.friends, host: st.host,
  };
}
