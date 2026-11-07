// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CLONE ARC TROOPER's own kit: the input map, the frag grenade and the rifle bash. SHIFT is his sprint
// (player/trooper/sprint.js, read by locomotion.js): the dive is the Mando's.
// Its guns (the DC-15 burst rifle and the twin DC-17s) fire through the Mando's gun code (mando/weapons.js), since both
// are gunners; the tuning is data/trooper.js.

import { G, shared, enemies, player } from '../../state.js';
import { TROOPER, TROOPER_WEAPON_ORDER, RIFLE_MODS, RIFLE_MOD_ORDER } from '../../data/trooper.js';
import { MANDO_WEAPONS } from '../../data/mando.js';
import { V3, clamp, TMP } from '../../utils.js';
import { sfx, S } from '../../audio/sfx.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { spawnHitSpark } from '../../fx/vfx.js';
import { palmPoints } from '../../fx/palms.js';
import { fwd, playerPos } from '../helpers.js';
import { mandoWeapon, mandoAimPoint, mandoAimRay, switchWeapon, fireTrigger, startReload, syncWeaponMesh } from '../mando/weapons.js';
import { trySlide } from '../parkour.js';
import { throwGrenade } from '../../enemies/grenades.js';
import { damageEnemy, flinchEnemy } from '../../enemies/damage.js';
import { bodyRadius } from '../../enemies/bodyshape.js';
import { isGuarding, guardImpact } from '../../enemies/duel.js';
import { DUEL } from '../../data/duel.js';
import { damageBoss } from '../../boss/boss.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { trooperPowerKey, updateTrooperPowers, resetTrooperPowers } from './abilities.js';
import { battlefieldCall, updateCalls, resetCalls } from '../../allies/calls.js';
import { resetCommand } from './command.js';
import { coverKey, coverTrigger, settleIntoCover, coverAhead, slideIntoCover, updateHeroSupp, resetCover, inCover } from './cover.js';

/* ---------- INPUT (engine/input.js hands the trooper's presses here) ---------- */
// LMB: the rifle's burst (or its module: held for the auto barrel), or the next pistol. RMB: aim (the steady stance): a
// tighter cone, a steadier reticle; with the marksman scope fitted it raises the scope.
export function trooperMouseDown(button){
  if (button === 0){
    player.trigHeld = true; player.coverShotAt = G.gt;
    if (mandoWeapon().fire === 'auto') player.firing = true;
    if (!coverTrigger()) fireTrigger();   // ducked in cover: he comes up first, and the shot goes as he clears it (cover.js)
  }
  if (button === 2 && !(player.gbT > 0)){ player.blockHeld = true; if (mandoWeapon().scope) player.zoom = true; }
}
export function trooperKey(k, repeat){
  if (G.mode !== 'play') return;   // (SHIFT is held for the sprint: locomotion.js reads it)
  if (k === 'c' && !repeat && !coverKey()) trySlideToCover();   // COVER beside cover (cover.js); else a SLIDE out of a run, firing as you go
  if (k === 'g' && !repeat) fragGrenade();
  if (k === 'e' && !repeat) rifleBash();
  if (k === 'r' && !repeat) startReload();   // overheated: the active vent (mando/weapons.js activeVent)
  if (k === '1' && !repeat){ if (player.weapon === 'rifle') swapModule(); else switchWeapon('rifle'); }   // 1 again: the rifle's next module
  if (k === '2') switchWeapon('pistols');
  if (k === '3' && G.unlocked.launcher) switchWeapon('launcher');
  if (k === 't' && !repeat) battlefieldCall();   // BATTLEFIELD CALLS: reinforce or a supply drop, for COMMAND POINTS (allies/calls.js)
  trooperPowerKey(k, repeat);   // the powers: player/trooper/abilities.js
}
// the mouse wheel: the other gun
export function trooperCycle(dir){
  const order = TROOPER_WEAPON_ORDER.filter(w => w !== 'launcher' || G.unlocked.launcher);
  const i = order.indexOf(player.weapon), n = order.length;
  switchWeapon(order[((i < 0 ? 0 : i) + dir + n) % n]);
}

/* ---------- THE MODULAR DC-15 (1 again, the rifle in hand) — the next module the run has handed over ---------- */
export const rifleMods = () => RIFLE_MOD_ORDER.filter(k => !RIFLE_MODS[k].unlock || G.unlocked[RIFLE_MODS[k].unlock]);
export function swapModule(){
  const list = rifleMods();
  if (list.length < 2){
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO MODULES YET', '#9fb8d0'); }
    return;
  }
  const i = list.indexOf(player.rifleMod || 'burst'), next = list[(i + 1) % list.length];
  player.rifleMod = next;
  syncWeaponMesh();   // the module's parts on the gun (model/weapons.js setRifleMod)
  const W = mandoWeapon();
  player.burstLeft = 0; player.burstQ = false; player.spin = 0;
  player.fireCd = Math.max(player.fireCd, 0.3);   // the module clicks home
  player.firing = player.trigHeld && W.fire === 'auto';
  player.zoom = player.blockHeld && !!W.scope;
  floater(playerPos(), RIFLE_MODS[next].label, '#bfe8ff');
  sfx(620, 0.05, 'square', 0.05, 380); sfx(260, 0.07, 'triangle', 0.05, 140);
  tutEvent('module');
}

/* ---------- THE SLIDE (C at a run or a sprint, nothing beside him) — and the way into the next cover ---------- */
function trySlideToCover(){
  trySlide();
  if (player.slideT > 0) player.toCover = { kind: 'slide', at: G.gt };
}
// through the skid: a cover face coming up ahead turns it into the SLIDE INTO COVER (cover.js), easing out right on the
// face; spent with cover in reach, it settles in
function updateToCover(){
  const q = player.toCover;
  if (!q) return;
  const C = TROOPER.cover, age = G.gt - q.at;
  if (age > 2 || inCover()){ player.toCover = null; return; }
  const sp = Math.hypot(player.moveVel.x, player.moveVel.z);
  if (player.slideT > 0 && player.grounded && sp > 2.5){
    const g = coverAhead(playerPos(), V3(player.moveVel.x / sp, 0, player.moveVel.z / sp), Math.min(C.slideAhead, sp * 0.5));
    if (g){ player.toCover = null; slideIntoCover(g, sp); return; }
  }
  const done = !(player.slideT > 0) || sp < 2.5;
  if (done && player.grounded){ settleIntoCover(C.slideReach); player.toCover = null; }
}


/* ---------- FRAG GRENADE (G) — charges that refill one at a time, lobbed onto the crosshair ---------- */
export function fragCharges(){
  const F = TROOPER.frag;
  if (player.fragCharges == null){ player.fragCharges = fragMax(); player.fragT = 0; }
  return player.fragCharges;
}
export function updateTrooperKit(dt){
  const F = TROOPER.frag;
  if (fragCharges() < fragMax()){
    player.fragT += dt * (player.up.fragRate || 1);   // (fragRate: the armory locker's FRAG CHARGER pack)
    if (player.fragT >= F.recharge){ player.fragT = 0; player.fragCharges++; }
  } else player.fragT = 0;
  if (player.bashCd > 0) player.bashCd -= dt;
  updateToCover();
  updateHeroSupp(dt);   // suppression on him, and the cover chip (cover.js)
  updateTrooperPowers(dt);
  updateCalls(dt);
}
export const fragMax = () => TROOPER.frag.charges + (player.up.fragExtra || 0);   // FRAG POUCH (data/trooper-progression.js) adds one
export function resetTrooperKit(){ if (!rifleMods().includes(player.rifleMod)){ player.rifleMod = 'burst'; syncWeaponMesh(); } player.fragCharges = fragMax(); player.fragT = 0; player.bashCd = 0; resetCover(); player.toCover = null; resetTrooperPowers(); resetCalls(); resetCommand(); }
function fragTarget(F, from){
  const aim = mandoAimPoint(), ray = mandoAimRay();
  const o = ray.origin, d = ray.direction;
  let to;
  if (player.lockOn) to = V3(aim.x, 0, aim.z);
  else if (d.y < -1e-3) to = V3(o.x + d.x * -o.y / d.y, 0, o.z + d.z * -o.y / d.y);
  else to = V3(from.x + d.x * 1e3, 0, from.z + d.z * 1e3);
  const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz) || 1;
  const k = clamp(dist, F.minRange, F.reach) / dist;
  to.x = from.x + dx * k; to.z = from.z + dz * k;
  return to;
}
export function fragGrenade(){
  const F = TROOPER.frag;
  if (fragCharges() <= 0){
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO GRENADES · ' + Math.ceil(F.recharge - player.fragT) + 'S', '#ff9a66'); }
    return;
  }
  player.fragCharges--; player.aiming = 0.6;
  const from = palmPoints(['L'])[0], to = fragTarget(F, from);
  throwGrenade({ t: { blastR: F.radius, fuse: F.fuse, dmg: 0 } }, from, to, true);   // friendly: it hurts foes, never you or the squad
  S.jump(); floater(playerPos(), 'FRAG OUT', '#9fd4ff');
  tutEvent('grenade');
}

/* ---------- RIFLE BASH (E) — a short shove with the stock: a stagger, not a combo ---------- */
export function rifleBash(){
  const A = TROOPER.bash;
  if (player.bashCd > 0 || player.flip || player.hang || player.flinchT > 0) return;
  player.bashCd = A.cd; player.aiming = 0.4; player.recoil = 0.6; player.recoilKick = 0.6;
  const f = fwd(), pp = playerPos(), cosLim = Math.cos(A.arc);
  player.vel.addScaledVector(f, 5);
  let hit = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > 2.2) continue;
    TMP.y = 0;
    if (TMP.length() - bodyRadius(e) > A.range) continue;
    const kd = TMP.lengthSq() < 0.001 ? f.clone() : TMP.clone().normalize();
    if (TMP.lengthSq() > 0.001 && kd.dot(f) < cosLim) continue;
    if (isGuarding(e)) guardImpact(e, DUEL.posture.kick);   // like a kick: the answer to a guard
    damageEnemy(e, A.dmg * player.up.dmg, kd, A.knock); flinchEnemy(e, kd, 0.6);
    if (!e.dead && !e.t.heavy){ e.state = 'stagger'; e.st = A.stun; }
    hit++;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < A.range + 1.2) damageBoss(A.dmg * 0.5);
  const ip = V3(pp.x + f.x * 1.2, pp.y + 1.3, pp.z + f.z * 1.2);
  if (hit){
    tutEvent('kick');
    G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.3);
    spawnHitSpark(ip, 0xcfe0ec, 1.0); burst(ip, 0xbfe8ff, 6, 7, 4, 0.8); S.punch(ip, 1.1);
  } else { burst(ip, 0xcfe0ec, 3, 5, 3); sfx(240, 0.06, 'triangle', 0.04, 160); }
}

// the trooper's starting guns: the rifle in hand
export function trooperStartKit(){
  resetTrooperKit();
  if (!MANDO_WEAPONS[player.weapon] || !MANDO_WEAPONS[player.weapon].trooper){ player.weapon = null; switchWeapon('rifle'); }
}
