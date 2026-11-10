// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// NEWS AT HOME (data/hub-news.js): what has newly opened for this hero since they last stood in their own hub, so the
// guide can walk them to it (game/hub-welcome.js shows it, the way it shows a place picked on the WHAT'S WHERE card).
// Each piece is taught once: the first time it's true, it's news; after that it's remembered (sw_hubnews_<hero>, a save
// file's own key: engine/save-files.js). A save that already had things open before this existed starts with them all
// remembered (nobody is walked to a forge they've used for weeks); a brand new hero starts with nothing.

import { G } from '../state.js';
import { NEWS } from '../data/hub-news.js';
import { HUBS, hubOf } from '../data/hub.js';
import { zoneOpen } from './zone-gate.js';
import { sandboxUnlocked } from './sandbox-unlocks.js';
import { gateOpen } from './gate.js';
import { rankIndex, profileOf } from './profile.js';
import { benchOf } from '../data/hero-benches.js';
import { partEarned } from '../data/saber-parts.js';
import { apprenticeMet } from '../allies/apprentice.js';
import { takeGrowthNews, primeGrowth } from './hub-growth.js';

const get = (k) => { try { return localStorage.getItem(k); } catch(e){ return null; } };
// what makes each piece of news true, for a hero
export const NEW = {
  zone: (h) => zoneOpen('jedha', h),
  apprentice: (h) => apprenticeMet(h),
  gate: () => gateOpen(),
  sandbox: () => sandboxUnlocked(),
  survival: () => get('sw_camp_jedi') === '1' && get('sw_camp_mando') === '1',
  rank: (h) => rankIndex(h) > 0,
  part: (h) => { const p = profileOf(h); return benchOf(h).some(r => r.parts.some(x => x.earn && partEarned(p, x.earn))); },
};
const truth = (id, h) => { try { return !!(NEW[id] && NEW[id](h)); } catch(e){ return false; } };

const key = (h) => 'sw_hubnews_' + h;
function noted(h, fresh){
  let n = null; try { n = JSON.parse(get(key(h))); } catch(e){}
  if (n && typeof n === 'object') return n;
  // (first time this file is asked: a hero who has played before keeps what they already have as known)
  n = {};
  if (!fresh) for (const N of NEWS) if (truth(N.id, h)) n[N.id] = 1;
  save(h, n);
  return n;
}
function save(h, n){ try { localStorage.setItem(key(h), JSON.stringify(n)); } catch(e){} }

// the station a piece of news leads to in this hub: { wing, id } (the first with one of its acts, wings in the map's order)
function stationFor(N, hub){
  const Hb = HUBS[hub]; if (!Hb) return null;
  for (const w of Hb.order){
    const s = (Hb.wings[w].stations || []).find(s => N.act.includes(s.act) && (!s.when || s.when()));
    if (s) return { wing: w, id: s.id };
  }
  return null;
}

// every arrival in a hub (game/hub-welcome.js): makes sure this hero's list exists, so a brand new hero's first run counts
export function primeNews(fresh){ if (hubOf(G.hero) === G.hubId){ noted(G.hero, fresh); primeGrowth(); } }   // (only at home: a guest's first look at a partner's hub says nothing of their own story)
/* home from a run (game/hub-welcome.js): the one piece of news to tell, marked told, or null
   (primeNews has made the list by now) */
export function takeNews(){
  const h = G.hero, hub = G.hubId;
  if (hubOf(h) !== hub) return null;   // (a hero visiting another's hub: its guide isn't theirs to brief)
  const n = noted(h, false);
  // first, the hub growing: a wing restored, a trophy in the hall (game/hub-growth.js: it remembers what it has told)
  const grew = takeGrowthNews(); if (grew) return grew;
  for (const N of NEWS){
    if (n[N.id] || !truth(N.id, h)) continue;
    const at = stationFor(N, hub), say = N.say[hub];
    n[N.id] = 1; save(h, n);
    if (at && say) return { wing: at.wing, station: at.id, say, step: N.step };
  }
  return null;
}
// for tests (window.GAME.hub.news)
export const newsNoted = (h = G.hero) => { try { return JSON.parse(get(key(h))) || {}; } catch(e){ return {}; } };
export function forgetNews(){ for (const h of ['jedi', 'mando', 'trooper']) try { localStorage.removeItem(key(h)); } catch(e){} }
