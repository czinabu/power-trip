// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GUNS' SIGNATURE MOVES AND MASTERY (data/gun-moves.js): one move per gun, done with its own buttons, and ranks I to
// III earned by using it. The gun code (player/mando/weapons.js) asks this module how each shot goes out (shotMove), and
// the bolt code (enemies/bolts.js) tells it what each bolt struck (gunHitDmg before the damage, gunHitAfter after).
// Every move's damage goes through damageEnemy, so in co-op a guest's moves land on the host's foes like any shot, and
// a pin is sent over to the host (enemies/coverfight.js frighten, net/foefire.js fpin).

import * as THREE from 'three';
import { G, player, enemies, isMando, isTrooper } from '../state.js';
import { scene } from '../engine/renderer.js';
import { GUN_MOVES, GUN_RANKS } from '../data/gun-moves.js';
import { HEADSHOT_MULT } from '../data/mando.js';
import { floater } from '../fx/floaters.js';
import { sfx } from '../audio/sfx.js';
import { inkSprite } from '../fx/ink.js';
import { V3 } from '../utils.js';
import { playerPos } from './helpers.js';
import { damageEnemy } from '../enemies/damage.js';
import { pinFoe, shakeFoe } from '../enemies/coverfight.js';
import { upToast } from '../game/upgrades.js';
import { tutEvent } from '../game/tutor-bus.js';
import { onFileSwitch } from '../engine/save-files.js';
import { inCover } from './trooper/cover.js';

/* ---------------- which gun, and its numbers at its rank ---------------- */
// the gun in hand as data/gun-moves.js names it (the DC-15 by its module), or null for anything without a move
export function gunId(){
  const w = player.weapon === 'rifle' ? (player.rifleMod || 'burst') : player.weapon;
  return GUN_MOVES[w] ? w : null;
}
// a move's tuning at the rank its gun has: MASTER (rank III) takes its `m` values
const cache = {};
export function moveOf(id){
  const M = GUN_MOVES[id];
  if (!M) return null;
  if (gunRank(id) < 3) return M;
  return cache[id] || (cache[id] = { ...M, ...M.m });
}

/* ---------------- mastery: ranks by use ---------------- */
const BEST_KEY = () => 'sw_gunrank_' + (isTrooper() ? 'trooper' : 'mando');
let best = null, bestFor = '';
onFileSwitch(() => { best = null; });
export function bestGunRanks(){
  const k = BEST_KEY();
  if (best && bestFor === k) return best;
  bestFor = k;
  try { best = JSON.parse(localStorage.getItem(k)) || {}; } catch(e){ best = {}; }
  return best;
}
function noteBest(id, r){
  const b = bestGunRanks(); if ((b[id] || 0) >= r) return;
  b[id] = r; try { localStorage.setItem(BEST_KEY(), JSON.stringify(b)); } catch(e){}
}
// the sandbox, the training grounds and a mission fight at the best rank the gun has reached in any run (a mission
// hands its kit over already practised, as it does the Jedi's forms); a campaign or survival run earns its own
export function gunRank(id){
  if (!GUN_MOVES[id]) return 0;
  const run = (G.gunRank && G.gunRank[id]) || 0;
  if (G.sandbox || G.training || G.mission) return Math.max(run, bestGunRanks()[id] || 0);
  return run;
}
export const gunDmgMul = (id = gunId()) => id && gunRank(id) >= 1 ? GUN_RANKS.dmg : 1;
export const gunHeatMul = (id = gunId()) => (id && gunRank(id) >= 2 ? GUN_RANKS.heat : 1) * (player.planted && id === 'repeater' ? moveOf('repeater').heat : 1);
// [points, points wanted, moves, moves wanted] toward the next rank (null at MASTER)
export function gunProgress(id, run = G){
  const r = run === G ? gunRank(id) : ((run.gunRank || {})[id] || 0);
  if (r >= 3) return null;
  return [(run.gunUse || {})[id] || 0, GUN_RANKS.need[r], (run.gunMoves || {})[id] || 0, GUN_RANKS.moves[r]];
}
const learning = () => G.mode === 'play' && !G.training && !G.sandbox && !G.hub && !G.mission;
// what a moment with the gun is worth: 'hit' | 'kill' | 'move'
export function trainGun(kind, id = gunId()){
  if (!id || !GUN_MOVES[id] || !learning()) return;
  const r = gunRank(id);
  if (r >= 3) return;
  G.gunUse = G.gunUse || {}; G.gunMoves = G.gunMoves || {};
  G.gunUse[id] = (G.gunUse[id] || 0) + (GUN_RANKS.pts[kind] || 0);
  if (kind === 'move') G.gunMoves[id] = (G.gunMoves[id] || 0) + 1;
  if (G.gunUse[id] < GUN_RANKS.need[r] || (G.gunMoves[id] || 0) < GUN_RANKS.moves[r]) return;
  G.gunRank = G.gunRank || {};
  G.gunRank[id] = r + 1;
  noteBest(id, r + 1);
  const M = GUN_MOVES[id], nm = gunName(id), pp = playerPos();
  floater(pp, nm + ' ' + GUN_RANKS.title[r + 1], '#ffd24a');
  sfx(880, 0.1, 'triangle', 0.05, 1320); sfx(1320, 0.14, 'triangle', 0.04, 1760);
  upToast(nm + ' · ' + GUN_RANKS.title[r + 1], rankLine(id, r + 1), 'mast');
}
const NAMES = { single: 'BLASTER PISTOL', dual: 'DUAL BLASTERS', carbine: 'PULSE CARBINE', repeater: 'HEAVY REPEATER', disruptor: 'DISRUPTOR',
  burst: 'DC-15 BURST', auto: 'DC-15 AUTO BARREL', marksman: 'DC-15 MARKSMAN', pistols: 'TWIN DC-17s' };
export const gunName = (id) => NAMES[id] || id;
// what each rank brings, in words
export function rankLine(id, r){
  if (r === 1) return '+' + Math.round((GUN_RANKS.dmg - 1) * 100) + '% damage';
  if (r === 2) return '−' + Math.round((1 - GUN_RANKS.heat) * 100) + '% heat a shot';
  return GUN_MOVES[id].name + ': ' + GUN_MOVES[id].master;
}
export function resetGunMoves(){
  player.quickT = 0; player.planted = false; player.dCharge = 0; player.burstRec = null; player.sweep = null;
  player.breath = 0; player.breathLeft = 0; player.breathOut = 0; player.kataAt = -9; player.coverAt = -9;
  for (const e of tagged) clearTag(e);
  tagged.length = 0;
}

/* ---------------- how a shot goes out ---------------- */
// called by fireBlaster / fireRifle for each bolt: returns { dmg, spread, tag } — `dmg` multiplies the shot, `spread`
// (if set) replaces the cone, `tag` is copied onto the bolt for gunHitDmg / gunHitAfter to read
const OUT = { dmg: 1, spread: null, tag: null };
export function shotMove(W, braced){
  OUT.dmg = gunDmgMul(); OUT.spread = null; OUT.tag = null;
  const id = gunId(), M = id && moveOf(id);
  if (!M) return OUT;
  const tag = OUT.tag = { gun: id };
  if (id === 'single' && isMando() && G.gt < (player.quickT || 0)){   // QUICKDRAW
    player.quickT = 0; tag.quick = true;
  } else if (id === 'dual' && isMando() && kataNow(M)){                 // GUN KATA
    OUT.dmg *= M.dmg; OUT.spread = W.braceSpread; tag.kata = true;
    if (player.kataAt !== player.dashStartT){ player.kataAt = player.dashStartT; floater(playerPos(), 'GUN KATA', '#ffd24a'); sfx(1500, 0.06, 'square', 0.03, 1900); trainGun('move', id); tutEvent('gunKata'); }
  } else if (id === 'repeater' && player.planted){                     // PLANT
    OUT.spread = (braced ? W.braceSpread : W.hipSpread) * M.cone; tag.pierce = M.pierce; tag.flinch = M.flinch;
  } else if (id === 'auto' && player.firing){                          // SWEEP
    tag.sweep = true;
    if (!player.sweep) player.sweep = { set: new Set() };
  } else if (id === 'marksman' && player.breathLeft > 0){              // STEADY BREATH
    OUT.dmg *= M.dmg; tag.breath = true; tag.pierce = M.pierce;
    exhale(M, false);
  } else if (id === 'pistols' && coveringNow(M)){                      // COVERING FIRE
    tag.covering = true;
    if (G.gt - (player.coverAt || -9) > 1.2){ floater(playerPos(), 'COVERING FIRE', '#9fd4ff'); }
    player.coverAt = G.gt;
  }
  if ((id === 'carbine' || id === 'burst') && player.burstRec) tag.burst = player.burstRec.id;   // TAG BURST / TRIPLE TAP
  return OUT;
}
// a burst starts (the carbine, the DC-15's stock burst): its bolts are tracked together
export function gunBurstStart(W){
  const id = gunId();
  if (id !== 'carbine' && id !== 'burst'){ player.burstRec = null; return; }
  player.burstRec = { id: (player.burstRec ? player.burstRec.id : 0) + 1, foe: null, n: 0, heads: 0, ok: true, gun: id, W };
}
// a dive or an air dodge has him in the air right now (GUN KATA's window)
function kataNow(M){
  return (player.dodgeKind === 'dive' || player.dodgeKind === 'airdodge') && G.gt - (player.dashStartT ?? -9) < M.after;
}
// sliding, straight out of a sprint, or on the move between cover (COVERING FIRE)
function coveringNow(M){
  if (!isTrooper()) return false;
  if (player.slideT > 0 || G.gt - (player.sprintT ?? -9) < 0.7) return true;   // (the trooper's sprint and slide: player/trooper/sprint.js)
  if (player.dodgeKind === 'dive' && G.gt - (player.rollAt ?? -9) < 0.7) return true;   // (his dive off a hop: the Mando's dive, player/movement.js)
  if (inCover()) return false;
  const left = player.flowCoverLeft, sp = Math.hypot(player.moveVel.x, player.moveVel.z);
  return !!left && G.gt - left.t < M.move && sp > 2.5;
}

/* ---------------- what a bolt struck ---------------- */
// before the damage: the move's change to it. `dmg` already has the headshot multiplier when it's a head.
export function gunHitDmg(b, e, isHead, dmg){
  if (!b.gun) return dmg;
  const M = moveOf(b.gun);
  if (b.quick){
    dmg *= isHead ? M.head : HEADSHOT_MULT;
    const p = e.group.position;
    floater(V3(p.x, p.y + 2.3, p.z), 'QUICKDRAW', '#ffd24a');
    sfx(2100, 0.07, 'square', 0.04, 900);
    trainGun('move', b.gun); tutEvent('quickdraw');
  }
  return dmg;
}
// after the damage: tracking and the moves that follow on from a hit
export function gunHitAfter(b, e, isHead){
  if (!b.gun) return;
  trainGun(e.dead ? 'kill' : 'hit', b.gun);
  const M = moveOf(b.gun);
  if (b.burst){
    const R = player.burstRec;
    if (R && R.id === b.burst && R.ok){
      if (!R.foe) R.foe = e; else if (R.foe !== e) R.ok = false;
      R.n++; if (isHead) R.heads++;
      if (R.ok && R.n >= (R.W.burst || 3)) burstDone(R, M);
    }
  }
  if (b.sweep && player.sweep && !player.sweep.set.has(e)){
    const S = player.sweep; S.set.add(e);
    if (S.set.size >= M.from && !e.dead){ pinFoe(e); floatAt(e, 'SWEPT', '#9fd4ff'); }
    if (S.set.size === 3){
      floater(playerPos(), 'SWEEP', '#9fd4ff'); sfx(700, 0.08, 'square', 0.04, 1100);
      if (M.cool) player.heat = Math.max(0, player.heat - M.cool);
      trainGun('move', b.gun); tutEvent('sweep');
    }
  }
  if (b.covering && !e.dead){
    pinFoe(e);
    if (G.gt - (player.coverHitAt || -9) > 1.2){ player.coverHitAt = G.gt; trainGun('move', b.gun); tutEvent('coveringFire'); }
  }
  if (b.breath){ floatAt(e, isHead ? 'CLEAN SHOT' : 'STEADY', '#bfe8ff'); trainGun('move', b.gun); tutEvent('steadyBreath'); }
}
function burstDone(R, M){
  const e = R.foe; R.ok = false;
  if (R.gun === 'carbine'){ tagFoe(e, M); trainGun('move', 'carbine'); tutEvent('tagBurst'); return; }
  // TRIPLE TAP: the burst's heat back, and a bonus hit for each bolt that took the head
  const W = R.W, heat = W.heat * (W.burst || 3) * M.refund * (player.up.heatMul || 1);
  player.heat = Math.max(0, player.heat - heat);
  if (R.heads && !e.dead) damageEnemy(e, W.dmg * (player.up.dmg || 1) * M.bonus * R.heads, null, 0);
  floatAt(e, R.heads ? 'TRIPLE TAP +' + R.heads : 'TRIPLE TAP', '#9fe6ff');
  sfx(1200, 0.06, 'square', 0.04, 1700); sfx(1700, 0.05, 'triangle', 0.03, 2200);
  trainGun('move', 'burst'); tutEvent('tripleTap');
}
const floatAt = (e, t, c) => { const p = e.group.position; floater(V3(p.x, p.y + 2.4 * ((e.t && e.t.scale) || 1), p.z), t, c); };

/* ---------------- TAG BURST: a tagged foe draws the gadgets ---------------- */
const tagged = [];
const tagGeo = new THREE.TorusGeometry(0.22, 0.045, 6, 18);
function tagFoe(e, M){
  if (e.dead) return;
  e.tagT = G.gt + M.time; e.tagMul = M.mul;
  if (!e.tagMesh){
    const m = new THREE.Mesh(tagGeo, new THREE.MeshBasicMaterial({ color: 0xffb84a, toneMapped: false, depthTest: false, transparent: true }));
    m.renderOrder = 998; scene.add(m); e.tagMesh = m; tagged.push(e);
  }
  floatAt(e, 'TAGGED', '#ffb84a');
  sfx(1600, 0.05, 'square', 0.04, 2400); sfx(2400, 0.06, 'square', 0.03, 2400);
  const p = e.group.position;
  inkSprite({ pos: V3(p.x, p.y + 1.4, p.z), shape: 'ring', inner: 0.8, color: 0xffb84a, size: [0.4, 1.6], life: 0.3, fadeAt: 0.3, coreW: 0.3, inkW: 0.2 });
}
function clearTag(e){ if (e.tagMesh){ scene.remove(e.tagMesh); e.tagMesh.material.dispose(); e.tagMesh = null; } e.tagT = 0; }
export const isTagged = (e) => !!e && !e.dead && e.tagT > G.gt;
export const tagMul = (e) => isTagged(e) ? (e.tagMul || 1) : 1;
// the tagged foe a gadget should go for: the one nearest `from` (within `range`, if given)
export function tagTarget(from, range = Infinity){
  let bestE = null, bd = range;
  for (const e of tagged){ if (!isTagged(e)) continue; const d = e.group.position.distanceTo(from); if (d < bd){ bd = d; bestE = e; } }
  return bestE;
}

/* ---------------- each frame ---------------- */
export function updateGunMoves(dt, W){
  // tags: the ring hangs over the head, turning; gone when it runs out
  for (let i = tagged.length - 1; i >= 0; i--){
    const e = tagged[i];
    if (!isTagged(e) || !e.group.parent){ clearTag(e); tagged.splice(i, 1); continue; }
    const p = e.group.position, left = e.tagT - G.gt;
    e.tagMesh.position.set(p.x, p.y + 2.55 * ((e.t && e.t.scale) || 1) + Math.sin(G.gt * 4) * 0.05, p.z);
    e.tagMesh.rotation.x = Math.PI / 2; e.tagMesh.rotation.z += dt * 3;
    e.tagMesh.material.opacity = left < 1.5 ? (Math.sin(G.gt * 18) > 0 ? 1 : 0.3) : 1;
  }
  const id = gunId();
  if (!player.firing) player.sweep = null;   // a SWEEP is one unbroken hold
  if (id !== 'repeater' || !isMando()) player.planted = false;
  if (id !== 'disruptor') player.dCharge = 0;
  if (id === 'marksman' && isTrooper()) updateBreath(dt, moveOf(id));
  else { player.breath = 0; player.breathLeft = 0; player.breathOut = Math.max(0, (player.breathOut || 0) - dt); }
  if (id === 'repeater' && isMando()) updatePlant(moveOf(id), W);
}
// QUICKDRAW opens as the pistol comes out (mando/weapons.js switchWeapon)
export function gunDrawn(name){
  if (name === 'single' && isMando()) player.quickT = G.gt + moveOf('single').window;
}

/* PLANT — braced (RMB) on the ground with the barrels at full spin: he plants his feet */
function updatePlant(M, W){
  const can = G.mode === 'play' && player.blockHeld && player.grounded && !player.overheat && !player.flaming && player.ventT <= 0;
  const was = player.planted;
  player.planted = can && (was || player.spin >= M.spin);
  if (player.planted){
    player.spin = 1;
    player.gunSlow = 0;   // (player/locomotion.js: he can't walk)
    if (!was){
      floater(playerPos(), 'PLANTED', '#ff8a4a'); sfx(90, 0.18, 'square', 0.06, 55); sfx(160, 0.1, 'sawtooth', 0.04, 80);
      G.shake = Math.max(G.shake, 0.15); trainGun('move', 'repeater'); tutEvent('plant');
    }
  }
}

/* STEADY BREATH — scoped and still, he holds his breath (data/gun-moves.js marksman) */
function updateBreath(dt, M){
  if (player.breathOut > 0){ player.breathOut -= dt; player.breath = 0; return; }
  const still = Math.hypot(player.moveVel.x + player.vel.x, player.moveVel.z + player.vel.z) < 1.2 && player.grounded;
  if (!player.zoom || !still || G.mode !== 'play'){
    if (player.breathLeft > 0) exhale(M, false);
    player.breath = 0; return;
  }
  if (player.breathLeft > 0){
    player.breathLeft -= dt;
    if (player.breathLeft <= 0) exhale(M, true);
    return;
  }
  player.breath = (player.breath || 0) + dt;
  if (player.breath >= M.settle){
    player.breathLeft = M.hold; player.breath = 0;
    floater(playerPos(), 'BREATH HELD', '#bfe8ff'); sfx(320, 0.3, 'sine', 0.025, 220);
  }
}
function exhale(M, ranOut){
  player.breathLeft = 0; player.breath = 0;
  player.breathOut = M.after * (ranOut ? 1.5 : 1);
  player.breathShake = ranOut ? 2.4 : 1.6;
  if (ranOut){ floater(playerPos(), 'OUT OF BREATH', '#9fb8d0'); sfx(200, 0.25, 'sine', 0.03, 140); }
}
// the reticle's sway × this (mando/weapons.js updateMandoCombat): dead still while the breath holds, shakier after
export function gunSwayMul(){
  if (player.breathLeft > 0) return 0;
  if (player.breathOut > 0) return player.breathShake || 1.6;
  return 1;
}

/* OVERCHARGE — the disruptor in the scope: hold LMB to charge, let go to fire (mando/weapons.js fireRifle) */
export function overchargeStart(){ player.dCharge = 0.0001; }
// each frame while charging: returns 'fire' (with player.dChargeFull set) when the shot should go, else null
export function overchargeTick(dt){
  if (!(player.dCharge > 0)) return null;
  const M = moveOf('disruptor');
  if (player.weapon !== 'disruptor' || !player.zoom || G.mode !== 'play'){ player.dCharge = 0; return null; }
  if (player.trigHeld){
    const was = player.dCharge;
    player.dCharge += dt;
    if (was < M.charge && player.dCharge >= M.charge){ floater(playerPos(), 'OVERCHARGED', '#7fe0ff'); sfx(1800, 0.12, 'sine', 0.05, 2600); }
    else if (player.dCharge > M.tap && player.dCharge < M.charge && Math.random() < dt * 14) sfx(500 + 1300 * player.dCharge / M.charge, 0.04, 'sine', 0.02, 700 + 1500 * player.dCharge / M.charge);
    return null;
  }
  player.dChargeFull = player.dCharge >= M.charge;
  player.dCharge = 0;
  return 'fire';
}
export const overchargeShare = () => player.dCharge > 0 ? Math.min(1, player.dCharge / moveOf('disruptor').charge) : 0;
// the overcharged shot's change: damage × and how many foes it pierces
export function overchargeShot(){
  if (!player.dChargeFull) return null;
  player.dChargeFull = false;
  const M = moveOf('disruptor');
  trainGun('move', 'disruptor'); tutEvent('overcharge');
  return { dmg: M.dmg, pierce: M.pierce - 1 };
}
// COVERING FIRE's shake: every foe within `near` of the shot's line keeps its head down
export function coveringShake(from, to){
  const M = moveOf('pistols');
  const dx = to.x - from.x, dz = to.z - from.z, L2 = dx * dx + dz * dz || 1;
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    const p = e.group.position, t = Math.max(0, Math.min(1, ((p.x - from.x) * dx + (p.z - from.z) * dz) / L2));
    const qx = from.x + dx * t - p.x, qz = from.z + dz * t - p.z;
    if (qx * qx + qz * qz < M.near * M.near) shakeFoe(e, M.shake);
  }
}
