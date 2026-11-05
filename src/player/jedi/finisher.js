// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SABER FINISHERS: a broken guard turns the next attack into the form's finishing move (data/finishers.js). The
// finisher is a run of the form's own cuts played back to back (anim/saber.js poses each one from finBeat), the foe held
// in its stagger until the last blow. It never locks the foe to the hero, so it works the same in co-op and in a crowd.
// Also the cue that shows when one is on: a saber hilt over the foe the next attack would finish.

import * as THREE from 'three';
import { CFG } from '../../data/config.js';
import { FINISHER, FINISHERS, EDGES } from '../../data/finishers.js';
import { FORM_OF } from '../../data/poses.js';
import { SWING_PATTERNS } from '../../data/stances.js';
import { DUEL } from '../../data/duel.js';
import { scene } from '../../engine/renderer.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, clamp } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { spawnHitSpark, spawnGroundShock } from '../../fx/vfx.js';
import { sparks, clashFlash, clashSparks } from '../../fx/ink.js';
import { shared, G, enemies, player, isGunner } from '../../state.js';
import { fwd, playerPos, stance, maxStam } from '../helpers.js';
import { damageEnemy, staggerEnemy, hitReact, flinchEnemy } from '../../enemies/damage.js';
import { damageBoss } from '../../boss/boss.js';
import { bodyRadius } from '../../enemies/bodyshape.js';
import { scarBody, severLimbs } from '../../enemies/scars.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { hooks } from '../../net/run.js';
import { addFocus, FOCUS } from './focus.js';
import { addFury } from './fury.js';
import { throwOffSaber } from './offthrow.js';
import { addPosture } from '../../enemies/duel.js';
import { killCam } from '../../engine/killcam.js';

const FIN = FINISHER;
const isDark = () => isGunner() && player.weapon === 'darksaber';
// the hero can finish with a blade in hand: the Jedi's saber, or the Mando's darksaber
const bladeHero = () => !isGunner() || player.weapon === 'darksaber';
export const finisherForm = () => isDark() ? 'darksaber' : (FORM_OF[G.stance] || 'niman');
export const finisherDef = (form = finisherForm()) => FINISHERS[form] || FINISHERS.niman;

/* WHO CAN BE FINISHED: a blade foe with a posture bar (or the brute), reeling right now, not already being finished */
export const finishType = (e) => !!(e && e.t && !e.t.ranged && !e.t.fly && (FIN.types[e.type] || e.warbringer || e.champion || e.t.staff || e.t.weapon === 'saber'));
export const canFinish = (e) => !!(e && !e.dead && !e.converted && e.state === 'stagger' && finishType(e) && !(e.finUntil > G.gt));
// the tough ones survive it (data/finishers.js FINISHER.survive)
const toughFoe = (e) => !!(e === shared.boss || e.rank === 'master' || e.champion || e.warbringer);
const bossOpen = (b) => !!(b && b.hp > 0 && (b.state === 'vulnerable' || b.state === 'stunned'));

/* the foe the next attack would finish: reeling, in reach (past its body) and square in front of you; the nearest */
export function finishTarget(){
  if (!bladeHero() || G.mode !== 'play' || shared.saberProj || shared.offProj) return null;
  const pp = playerPos(), f = fwd();
  let best = null, bd = 1e9;
  const look = (e, extra) => {
    const dx = e.group.position.x - pp.x, dz = e.group.position.z - pp.z, dy = e.group.position.y - pp.y;
    if (Math.abs(dy) > 1.8) return;
    const d = Math.hypot(dx, dz), gap = d - extra;
    if (gap > FIN.reach || (d > 0.4 && (dx * f.x + dz * f.z) / d < FIN.cone)) return;
    if (gap < bd){ bd = gap; best = e; }
  };
  for (const e of enemies) if (canFinish(e)) look(e, bodyRadius(e));
  if (bossOpen(shared.boss) && !(shared.boss.finUntil > G.gt)) look(shared.boss, 1.0);
  return best;
}

// keep the foe reeling until the finisher is through (on a co-op guest, the host is asked to: net/foefire.js hooks.hold)
function hold(e, t){
  e.finUntil = G.gt + t;
  if (e === shared.boss){ if (!e.net) e.st = Math.max(e.st || 0, t); return; }
  if (e.net){ if (hooks.hold) hooks.hold(e, t); return; }
  e.state = 'stagger'; e.st = Math.max(e.st || 0, t); e.stumble = 0;
}

/* a duellist of high rank may slip the window before the blade arrives (data/finishers.js FINISHER.escape) */
function slipChance(e){
  if (e.net || e === shared.boss) return 0;   // (the host's foes decide their own fate)
  const E = FIN.escape;
  return Math.max(e.champion ? E.champion : 0, E[e.rank] || 0);
}
function slip(e){
  const g = e.group, pp = playerPos();
  const dx = g.position.x - pp.x, dz = g.position.z - pp.z, l = Math.hypot(dx, dz) || 1;
  g.position.x += dx / l * 1.6; g.position.z += dz / l * 1.6;
  e.state = 'recover'; e.st = 0.35; g.rotation.x = 0;
  e.finUntil = G.gt + 1.2;   // (no second try off the same break)
  floater(V3(g.position.x, g.position.y + 2, g.position.z), 'SLIPPED FREE', '#ffb36a');
  burst(V3(g.position.x, 0.4, g.position.z), 0xbfb6a8, 6, 4, 3);
  sfx(520, 0.08, 'triangle', 0.05, 260);
}

/* START — called by tryAttack (jedi/combat.js) before a plain cut. Returns true when the attack became a finisher. */
export function tryFinisher(){
  if (player.fin) return true;
  const e = finishTarget();
  if (!e) return false;
  if (Math.random() < slipChance(e)){ slip(e); return false; }
  const form = finisherForm(), D = finisherDef(form);
  const total = D.beats.reduce((s, b) => s + b.dur, 0);
  player.fin = { e, form, def: D, i: 0, tough: toughFoe(e), total, at: G.gt };
  hold(e, total + FIN.hold);
  // the string is spent: the next attack after it starts a fresh one; a riposte waiting is folded into it
  player.comboStep = 2; player.queuedAtk = false; player.riposteT = 0; player.flowRun = 0;
  const pp = playerPos();
  floater(V3(pp.x, pp.y + 0.4, pp.z), D.name, '#ffd98a');
  G.hitstop = Math.max(G.hitstop, 0.05);
  sfx(880, 0.12, 'sine', 0.04, 1500); sfx(220, 0.18, 'triangle', 0.05, 120);
  startBeat(0);
  return true;
}

// one beat: a saber cut struck from the form's keyframes (anim/saber.js swingPose reads finBeat)
function startBeat(i){
  const F = player.fin, b = F.def.beats[i], last = i === F.def.beats.length - 1;
  F.i = i;
  const pat = SWING_PATTERNS[b.pat] || SWING_PATTERNS.forward;
  player.atkT = b.dur;
  player.swing = { t: 0, applied: false, step: last ? 2 : 1, dur: b.dur, flowCut: false, pat, dir: 'neutral', h: pat.h || null,
                   flick: false, back: false, riposte: false, ripLine: false, cancelRip: false, fluid: false, flow: true, mom: null,
                   finBeat: b, fin: F, finLast: last };
  player.deflectAnim = null;
  // the beat's travel: toward the foe (root motion on the ground), or right past it and out behind
  const e = F.e, pp = playerPos();
  let dx = fwd().x, dz = fwd().z, d = 0;
  if (e && !e.dead){
    const ex = e.group.position.x - pp.x, ez = e.group.position.z - pp.z;
    d = Math.hypot(ex, ez);
    if (d > 0.2){ dx = ex / d; dz = ez / d; }
  }
  const reach = e && e !== shared.boss && !e.dead ? bodyRadius(e) : 1;
  // (the first beat closes whatever gap the stagger opened, so the blade meets the body at arm's length)
  const m = b.travel === 'past' ? d + reach + 1.2 : (b.travel || 0) + (i === 0 ? Math.max(0, d - reach - 1.0) : 0);
  if (m > 0.01){
    if (player.grounded) player.swing.travel = { x: dx * m, z: dz * m, done: 0 };
    else player.vel.set(dx * m * 4, player.vel.y, dz * m * 4);
  }
  S.swing(isGunner() ? 'dark' : G.stance);
}

/* the beat's swing has run out (player/animation.js): the next beat, or the end. Returns true while it goes on. */
export function finisherNext(){
  const F = player.fin;
  if (!F) return false;
  if (F.i + 1 < F.def.beats.length){ startBeat(F.i + 1); return true; }
  endFinisher();
  return false;
}
export function endFinisher(){
  const F = player.fin;
  if (!F) return;
  player.fin = null;
  // a boss isn't floored by it: he stays open for the rest of the window, so it's one finisher per opening (else a
  // posture break was three finishers back to back, half his bar)
  if (F.e === shared.boss) F.e.finUntil = G.gt + Math.max(FIN.hold, (F.e.st || 0) + 0.1);
  else if (F.e) F.e.finUntil = Math.min(F.e.finUntil || 0, G.gt + FIN.hold);
  player.lastAtkEnd = G.gt;
}

/* THE BLOW — at each beat's strike point (jedi/combat.js applySwingDamage, once per beat): what it does to the foe being
   finished, and the beat's edge. The foe is struck here, not by the blade's sweep, so the finisher always lands where
   it was aimed; everything else the blade passes through is cut as usual. */
export function finisherStrike(sw){
  const F = sw.fin, b = sw.finBeat, last = !!sw.finLast, e = F && F.e;
  if (!F || sw.finStruck) return;
  sw.finStruck = true;
  const st = stance(), pp = playerPos();
  let landed = false;
  if (e && !(e === shared.boss ? e.hp <= 0 : e.dead)){
    const gp = e.group.position, dx = gp.x - pp.x, dz = gp.z - pp.z, d = Math.hypot(dx, dz) || 1;
    const reach = e === shared.boss ? 1.5 : bodyRadius(e);
    if (d - reach < FIN.reach + 2.2){   // (it can't have got away, it's held, but never cut across the room)
      landed = true;
      const f = V3(dx / d, 0, dz / d);
      const maxHp = e.maxHp || e.hp || 100;
      const share = b.share || 0, duel = b.edge === 'duel' ? EDGES.duel.mul : 1;
      if (e === shared.boss){
        damageBoss(maxHp * FIN.survive * share * duel);
        scarBody(e.group, f, 'neutral', true);
      } else {
        const tough = F.tough;
        // a foe reeling takes ×1.5 already (enemies/damage.js): the shares are set against that
        const dmg = tough ? maxHp * FIN.survive * share * duel / 1.5 : last ? maxHp * 4 : maxHp * FIN.minor;
        if (last){
          damageEnemy(e, dmg, f.clone(), tough ? 30 : 22, true, false, { shove: CFG.player.saberShove.max, blade: true });
          if (e.dead) severLimbs(e, f, 1);
        } else {
          damageEnemy(e, dmg, null, 0, false, false);
          hitReact(e, f, 0.55);
          if (!e.dead) hold(e, F.total - (G.gt - F.at) + FIN.hold);
        }
        if (b.fx === 'kneel' && !e.t.heavy && !e.dead) e.buckle = 0.4;   // the blow drives its knees down (enemies/gait.js)
        scarBody(e.group, f, sw.dir, true);
      }
      beatFx(e, f, b, last, st);
    }
  }
  edge(b, sw, e, st);
  if (last && landed){
    tutEvent('saberFinisher', e);
    if (G.stats) G.stats.finishers = (G.stats.finishers || 0) + 1;
    addFocus(FOCUS.gainFin * 2);
    // a duellist, a champion or the Warbringer cut down: THE KILL CAM, if nobody else is close (engine/killcam.js)
    if (e !== shared.boss && e.dead && (e.dp || F.tough)) killCam('duel', e);
  }
}

function beatFx(e, f, b, last, st){
  const gp = e.group.position, ip = V3(gp.x - f.x * 0.4, gp.y + (last ? 1.2 : 1.4), gp.z - f.z * 0.4);
  const col = isDark() ? 0xc9a6ff : (st.blade || 0x9fd8ff);
  if (b.fx === 'bind'){
    clashSparks(ip, 0xffe27a, 7, { dir: f, cone: 0.9 }); clashFlash(ip, 0xffd24a, false); S.clash(ip, false);
  }
  if (b.fx === 'palm'){
    burst(ip, 0x9fd8ff, 12, 8, 4, 0.8); spawnGroundShock(V3(gp.x, 0.1, gp.z), 0x9fd8ff, 2.4, 0.25, 0.35);
    if (!e.net && e !== shared.boss){ e.group.position.x += f.x * 0.7; e.group.position.z += f.z * 0.7; }
    S.punch(ip, 1.1); sfx(320, 0.14, 'sine', 0.06, 120);
  }
  spawnHitSpark(ip, last ? 0xffffff : col, last ? 1.9 : 1.1);
  sparks(ip, col, last ? 16 : 8, last ? 16 : 10, { life: 0.35, size: 0.5 });
  if (!last){
    G.hitstop = Math.max(G.hitstop, 0.06); G.shake = Math.max(G.shake, 0.35);
    S.heavy();
    return;
  }
  // the killing blow: a held breath, the camera in close, a white flash
  G.hitstop = Math.max(G.hitstop, 0.15); G.shake = Math.max(G.shake, 1.0);
  if (G.finSlow !== false){ G.slowmo = Math.min(G.slowmo, FIN.slowmo.k); G.slowmoT = Math.max(G.slowmoT, FIN.slowmo.t); }
  clashFlash(ip, 0xffffff, true);
  inkBurst(ip, col);
  screenFlash('radial-gradient(ellipse at center, rgba(255,240,200,.28), transparent 60%)', 0.6, 0.25);
  S.heavy(); S.slam(ip);
}
function inkBurst(ip, col){ burst(ip, col, 14, 10, 5, 1.0); burst(ip, 0xffffff, 6, 12, 4, 0.6); }

/* EDGES (data/finishers.js EDGES): what a beat does besides its blow */
function edge(b, sw, target, st){
  const k = b.edge;
  if (!k) return;
  const pp = playerPos(), f = fwd();
  if (k === 'sweep' || k === 'both'){
    const E = EDGES[k], dmg = CFG.player.comboDamage[2] * st.dmg * (player.up.dmg || 1) * E.dmg;
    for (const o of enemies){
      if (o === target || o.dead || o.converted || o.state === 'spawn') continue;
      const dx = o.group.position.x - pp.x, dz = o.group.position.z - pp.z, d = Math.hypot(dx, dz);
      if (d - bodyRadius(o) > E.r || Math.abs(o.group.position.y - pp.y) > 1.8) continue;
      const dir = d > 0.2 ? V3(dx / d, 0, dz / d) : f.clone();
      damageEnemy(o, dmg, dir, 15, true, false, { shove: CFG.player.saberShove.max, blade: true });
      scarBody(o.group, dir, 'right', true);
      if (o.dead) severLimbs(o, dir, 0.6, { travel: V3(dir.z, 0, -dir.x) });
    }
    spawnGroundShock(V3(pp.x, 0.1, pp.z), st.blade || 0x9fd8ff, E.r + 0.6, 0.3, 0.4);
  } else if (k === 'shock'){
    const E = EDGES.shock, at = target && target.group ? target.group.position : pp;
    for (const o of enemies){
      if (o === target || o.dead || o.converted || o.state === 'spawn') continue;
      const dx = o.group.position.x - at.x, dz = o.group.position.z - at.z, d = Math.hypot(dx, dz) || 1;
      if (d - bodyRadius(o) > E.r) continue;
      const dir = V3(dx / d, 0, dz / d);
      if (o.t.heavy){ flinchEnemy(o, dir, 0.6); continue; }
      if (!o.net){ o.group.position.addScaledVector(dir, E.push * 0.4); staggerEnemy(o, dir.x, dir.z, 'STAGGERED'); }
      else damageEnemy(o, 1, dir, 18);   // (a co-op guest: a shove the host applies)
    }
    spawnGroundShock(V3(at.x, 0.1, at.z), st.blade || 0x9fd8ff, E.r + 1.5, 0.34, 0.6);
    spawnGroundShock(V3(at.x, 0.1, at.z), 0xffffff, E.r + 3, 0.5, 0.3);
    G.shake = Math.max(G.shake, 1.5);
  } else if (k === 'guard'){
    player.cancelDR = Math.max(player.cancelDR || 0, EDGES.guard.soak);
  } else if (k === 'stam'){
    player.stam = Math.min(maxStam(), player.stam + EDGES.stam.n);
  } else if (k === 'force'){
    player.force = clamp(player.force + EDGES.force.n, 0, CFG.player.maxForce);
  } else if (k === 'fury'){
    addFury(EDGES.fury.n);
  } else if (k === 'parry'){
    player.finParryT = G.gt + EDGES.parry.t;
    floater(playerPos(), 'SHATTERPOINT · PARRY WIDE', '#d08bff');
  } else if (k === 'throw'){
    // JAR'KAI: the off-hand saber thrown on to the nearest other foe in reach, and back (jedi/offthrow.js)
    const E = EDGES.throw;
    let o = null, bd = E.r;
    for (const c of enemies){
      if (c === target || c.dead || c.converted || c.state === 'spawn') continue;
      const d = Math.hypot(c.group.position.x - pp.x, c.group.position.z - pp.z) - bodyRadius(c);
      if (d < bd && Math.abs(c.group.position.y - pp.y) < 2.5){ bd = d; o = c; }
    }
    if (o){
      const dx = o.group.position.x - pp.x, dz = o.group.position.z - pp.z, d = Math.hypot(dx, dz) || 1, dir = V3(dx / d, 0, dz / d);
      throwOffSaber(o, E.dur, () => {
        if (o.dead) return;
        damageEnemy(o, CFG.player.comboDamage[2] * st.dmg * (player.up.dmg || 1) * E.dmg, dir, 10, false, false, { shove: CFG.player.saberShove.max, blade: true });
        if (!o.dead && o.dp && !o.net){
          const amt = o.dp.posture * E.posture, room = o.dp.posture - (o.posture || 0) - 1;
          addPosture(o, toughFoe(o) ? Math.max(0, Math.min(amt, room)) : amt, dir.x, dir.z);
        }
      });
    }
  } else if (k === 'clang'){
    const ip = V3(pp.x + f.x * 1.4, 1.4, pp.z + f.z * 1.4);
    S.clash(ip, true); spawnGroundShock(V3(ip.x, 0.1, ip.z), 0xc9a6ff, 2.6, 0.3, 0.4);
  }
}
// Vaapad's Shatterpoint: seconds added to a parry window for a while after it (engine/input.js)
export const finParry = () => player.finParryT > G.gt ? EDGES.parry.bonus : 0;

/* THE CUE — a saber hilt over the foe the next attack would finish, pulsing gold while the window is open */
let cue = null;
function makeCue(){
  const W = 128, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.translate(W / 2, H / 2); x.rotate(-Math.PI / 4);
  // the glow
  const g = x.createRadialGradient(0, 0, 4, 0, 0, 58); g.addColorStop(0, 'rgba(255,220,120,0.55)'); g.addColorStop(1, 'rgba(255,200,80,0)');
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 58, 0, Math.PI * 2); x.fill();
  // the blade, then the hilt with its emitter and grip
  x.lineCap = 'round';
  x.strokeStyle = 'rgba(255,236,170,0.95)'; x.lineWidth = 9; x.beginPath(); x.moveTo(0, -6); x.lineTo(0, -52); x.stroke();
  x.strokeStyle = '#ffffff'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(0, -8); x.lineTo(0, -50); x.stroke();
  x.fillStyle = '#1a1712'; x.fillRect(-8, -8, 16, 50);
  x.fillStyle = '#ffd24a'; x.fillRect(-6.5, -6, 13, 46);
  x.fillStyle = '#1a1712'; for (let i = 0; i < 4; i++) x.fillRect(-6.5, 8 + i * 7, 13, 2.5);
  x.fillRect(-9, -10, 18, 5);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  s.renderOrder = 1000; s.visible = false;
  s.raycast = () => {};   // a label, not a body: aim and hit rays pass through it
  scene.add(s);
  return s;
}
export function updateFinisherCue(){
  if (player.fin && player.atkT <= 0) endFinisher();   // (a swing cut short by anything else ends the finisher too)
  const t = !player.fin && G.mode === 'play' && !G.paused ? finishTarget() : null;
  if (!t){ if (cue) cue.visible = false; return; }
  if (!cue) cue = makeCue();
  const gp = t.group.position, sc = (t.group.scale && t.group.scale.y) || 1, top = t === shared.boss ? 3.6 : 2.95 * sc;
  cue.position.set(gp.x, gp.y + top, gp.z);
  const p = 0.5 + 0.5 * Math.sin(G.gt * 12);
  cue.scale.setScalar(0.75 + 0.1 * p);
  cue.material.opacity = 0.75 + 0.25 * p;
  cue.visible = true;
}
