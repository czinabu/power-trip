// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// XP, skill and store helpers, survival power-up purchases.

import { S } from '../audio/sfx.js';
import { V3, clamp } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { G, player, isGunner, isTrooper } from '../state.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { TIER_REQ, TIER_NAME, SKILLS, TIER_NAME_MANDO, MANDO_SKILLS, TIER_CHAPTER } from '../data/skills.js';
import { MANDO_STORE, JEDI_STORE } from '../data/store.js';
import { forceReady } from '../data/force-level.js';
import { TROOPER_STORE, TROOPER_SKILLS } from '../data/trooper-progression.js';
import { renderProgress } from '../ui/store-ui.js';
import { MASTERY_XP } from '../data/difficulty.js';
import { MANDO } from '../data/mando.js';
import { endWave } from './readout.js';
import { xpPointCheck } from './upgrades.js';
import { chapterClosed } from './flow.js';
import { profileOpens } from './profile.js';
import { packChanged } from './pack.js';
import { ngScale } from '../data/ngplus.js';

export function skillSet(){ return isTrooper() ? TROOPER_SKILLS : isGunner() ? MANDO_SKILLS : SKILLS; }
const TIER_NAME_TROOPER = TIER_NAME;   // (one set of tier names for every hero, clear of the ranks)
export function tierName(t){ return (isTrooper() ? TIER_NAME_TROOPER : isGunner() ? TIER_NAME_MANDO : TIER_NAME)[t]; }
export function skillRank(id){ return (player.skills && player.skills[id]) || 0; }
function skillReq(s){ return s.req != null ? s.req : TIER_REQ[s.tier]; }
function tierUnlocked(tier){ return G.skillSpent >= TIER_REQ[tier]; }
// the campaign also holds a tier back until its chapter has closed (data/skills.js TIER_CHAPTER)
export function tierStoryOpen(tier){ return G.chapter < 0 || !TIER_CHAPTER[tier] || chapterClosed(TIER_CHAPTER[tier]); }
// (a Force Tree card or a rank's card also waits for your profile to have it: game/profile.js)
export function skillEligible(s){ return G.skillSpent >= skillReq(s) && tierStoryOpen(s.tier) && skillRank(s.id) < s.max && (!s.avail || s.avail()) && profileOpens(s); }

/* ============================================================
   XP & PROGRESSION STORE — earn XP in combat, spend it between waves
   ============================================================ */
export function gainXp(n){
  if (G.endless){ if (G.mut === 'windfall') n *= 2; else if (G.mut === 'frenzy') n *= 1.5; }   // mutator XP bonuses
  n *= ngScale('xp');   // a NEW GAME+ chapter levels the run faster (data/ngplus.js)
  n = Math.round(n);
  if (n <= 0 || G.duel) return;   // (nothing is earned in a duel: game/duel-mode.js)
  G.xp = (G.xp || 0) + n;
  G.xpEarned = (G.xpEarned || 0) + n;
  const el = document.getElementById('xpval'); if (el) el.textContent = G.xp;
  xpPointCheck();   // the story turns XP into skill points (game/upgrades.js)
}
// kill-streak XP multiplier — 1× cold, ramping to 3× on a hot streak (rewards aggressive play)
export function killBonus(){ return 1 + clamp((G.streak || 0) * 0.12, 0, 2); }
// MASTERY XP — a parry, perfect dodge, clash, catch or riposte pays a small bounty on the spot (×1–3 on a streak)
export function masteryXp(kind){
  if (G.training || !MASTERY_XP[kind]) return;
  gainXp(MASTERY_XP[kind] * killBonus());
}
// WAVE CLEAR — the wave's XP, plus a bonus share of it when the wave was fought cleanly (no hit taken, or little)
export function payWaveClear(clearXp){
  endWave();   // the combat readout closes this wave's numbers
  gainXp(clearXp);
  const flawless = !(G.waveHits > 0), clean = !flawless && (G.waveDmg || 0) < maxHp() * MASTERY_XP.cleanHp;
  if (G.training || !(flawless || clean)) return;
  const bonus = Math.round(clearXp * (flawless ? MASTERY_XP.flawless : MASTERY_XP.clean));
  gainXp(bonus);
  if (G.stats) G.stats[flawless ? 'flawless' : 'cleanWaves']++;
  const pp = playerPos();
  floater(V3(pp.x, 2.4, pp.z), (flawless ? 'FLAWLESS' : 'CLEAN') + ' WAVE  +' + bonus + ' XP', flawless ? '#ffd24a' : '#8fe0ff');
}
// abilities open by TIER, gated by how deep into the run you are (waveTotal) — so power arrives in waves
export const STORE_TIER_STAGE = { 1: 0, 2: 1, 3: 3, 4: 6, 5: 8 };   // waveTotal each tier opens — earlier = snappier pacing
function storeTierOpen(tier){ return (G.waveTotal || 0) >= (STORE_TIER_STAGE[tier] || 0); }

// JETPACK PROGRESSION — starts WEAK & short (very limiting early); boosters add real lift & a bigger tank
// THE JETPACK'S TIER: 0 is no pack at all (the Mando before the Armorer forges it at the close of Act I: an empty tank,
// so nothing that burns fuel lights), 1 the pack she forges, 2 and 3 its boosters (data/store.js MANDO_AUTO)
export function applyJetTier(){
  const t = Math.min(3, player.up.jetTier || 0);
  player.up.jetPow = [0, 0.82, 1.12, 1.35][t];          // climb power & lift
  player.jetMax   = [0, 100, 130, 160][t];              // fuel tank
  player.up.jetHoverMul = [1, 1.0, 0.8, 0.6][t];       // HOVER fuel burn — efficient once upgraded
  player.jet = Math.min(player.jetMax, Math.max(player.jet, player.jetMax * 0.6));
  packChanged();   // the pack goes on (or comes off) the model to match (game/pack.js)
}
// POWER CELLS — the guns hold more energy (heat) and recover it faster, a tier at a time (data/mando.js cells)
export function applyCellTier(){
  const t = player.up.cellTier || 0, C = MANDO.cells;
  player.up.heatCap = C.cap[t] || 1;
  player.up.heatCool = C.cool[t] || 1;
}

// helper: does a fork sibling already own the slot? (buying one weapon locks the other)
function forkTaken(node, set){ return !!node.fork && set.some(n => n !== node && n.fork === node.fork && n.owned()); }
export function storeSet(){ return isTrooper() ? TROOPER_STORE : isGunner() ? MANDO_STORE : JEDI_STORE; }
// the story campaign opens a node at its `chapter`'s close (data/store.js); everywhere else at its own `stage`
// (cumulative waves) if set, else by its tier's stage, so each fork lands at a precise wave.
export function storeStageOpen(n){
  if (!forceReady(n.force)) return false;   // a Jedi power waits for the Force Level it needs (data/force-level.js)
  if (n.chapter && G.chapter >= 0) return chapterClosed(n.chapter);
  const s = (n.stage != null) ? n.stage : (STORE_TIER_STAGE[n.tier] || 0); return (G.waveTotal || 0) >= s;
}
// what a node costs: nothing in the story, where the chapters hand the powers out (data/store.js); XP in survival
export function storeCost(n){ return n.chapter && G.chapter >= 0 ? 0 : n.cost; }
// the story's chapter close: hand over the single powers it brings (a fork stays a pick on the page). Returns them.
export function grantStoryPowers(){
  if (!(G.chapter >= 0)) return [];
  const got = [];
  for (const n of storeSet()) if (!n.fork && !n.pick && storeAvail(n)){ n.buy(); got.push(n); }
  return got;
}
export function storeAvail(n){ return !n.owned() && storeStageOpen(n) && (!n.avail || n.avail()) && !forkTaken(n, storeSet()); }
// is any ability still to come this run (not owned, not locked out by a fork pick)? — even if its wave hasn't arrived yet
export function storeRemaining(){ const set = storeSet(); return set.some(n => !n.owned() && (!n.avail || n.avail()) && !forkTaken(n, set)); }
export const RANK_NUM = ['', 'I', 'II', 'III'];
// the cheapest thing XP can still buy (an ability) — drives the bottom XP meter. { nm, cost }
export function nextStoreGoal(){
  let best = null;
  for (const n of storeSet()){
    if (storeCost(n) <= 0 || !storeAvail(n)) continue;
    if (!best || n.cost < best.cost) best = { nm: n.nm, cost: n.cost };
  }
  return best;
}
export function powerLv(id){ return (G.powerLv && G.powerLv[id]) || 0; }
export function powerCost(p){ return (p.base || 180) + powerLv(p.id) * (p.step || 90); }   // each power keeps its OWN rising price & level
export function buyPower(p){
  const cost = powerCost(p);
  if (!G.skillSelect || (G.xp||0) < cost || (p.avail && !p.avail())) return;
  if (!G.powerLv) G.powerLv = {};
  G.xp -= cost; G.powerLv[p.id] = powerLv(p.id) + 1; p.apply();
  floater(playerPos(), p.nm + ' ×' + G.powerLv[p.id] + '!', '#ffd24a'); burst(playerPos().clone().setY(1.6), 0xffd24a, 12, 6, 5);
  S.reward(1); document.getElementById('xpval').textContent = G.xp; renderProgress();
}
