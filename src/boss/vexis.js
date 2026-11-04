// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DARTH VEXIS — the Jedi's final boss: his signature moves and his look, laid on the final boss layer (boss/finale.js).
// His numbers are data/bosses.js VEXIS. Every move has one clear answer, shown in the shared tell colours (fx/tells.js):
//   GUARD BREAKER (I)  you held a block in his face: a Force palm through the guard. Parry tell: parry it or dodge.
//   SABER THROW   (I)  you backed off: the blade spins out at you and home. Block or parry it; he's unguarded meanwhile.
//   LIGHTNING     (II) catch it on your guard facing him (it drains stamina and drives you back); parry a surge (the
//                      parry tell) or Force Push into it, and it goes back into him. Or run across it: it turns slowly.
//   CHOKE         (II) the dodge ring under you: be out of it when it closes, or Push him to break the hold.
//   REPULSE       (II) crowd him and the floor blasts clear: dodge or jump it.
//   BLINK CHAIN   (III) smoke, then beside you, again and again: every cut parryable, and a parry ends the chain.
//   STORM         (III) amber rings spreading out from him, each a falling bolt: keep moving.
//   LAST STAND    (III, once) far across the floor, a charge the length of it (dodge tell); dodge it and he's wide open.

import * as THREE from 'three';
import { G, player } from '../state.js';
import { V3, clamp, rand } from '../utils.js';
import { scene } from '../engine/renderer.js';
import { VEXIS } from '../data/bosses.js';
import { registerFinale, turnTo, hurtHero, repulseRing } from './finale.js';
import { staggerEnemy, damageEnemy } from '../enemies/damage.js';
import { tellFx } from '../fx/tells.js';
import { burst } from '../fx/particles.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { spawnGroundShock, spawnHitSpark } from '../fx/vfx.js';
import { playerPos, fwd } from '../player/helpers.js';
import { hurtPlayer } from '../player/damage.js';
import { S } from '../audio/sfx.js';
import { hooks } from '../net/run.js';

const MV = VEXIS.moves;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const damp = (a, b, dt, r) => a + (b - a) * (1 - Math.exp(-r * dt));
const flatD = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const net = (k, e, extra) => { if (hooks.fin) hooks.fin({ k, n: e.nid, ...extra }); };

/* ---------------- the body: arms posed over the AI's (this runs after it, every frame of a move) ---------------- */
// the free (left) arm out at the hero, palm open; k 0 → at rest, 1 → fully out. lift raises it over the head
function offArmOut(e, k, lift = 0, dt = 1 / 60){
  const u = e.group.userData, a = u.offArm;
  if (!a) return;
  a.rotation.x = damp(a.rotation.x, -1.45 * k - lift * 1.3, dt, 14);
  a.rotation.z = damp(a.rotation.z, -0.12 * k - lift * 0.25, dt, 14);
  if (u.elbowOff) u.elbowOff.rotation.x = damp(u.elbowOff.rotation.x, 0, dt, 14);
}
function swordArm(e, x, dt, r = 12){
  const u = e.group.userData;
  if (u.weaponArm) u.weaponArm.rotation.x = damp(u.weaponArm.rotation.x, x, dt, r);
}
// where his free hand is in the world (a little past the end of the arm)
const _h = new THREE.Vector3();
function handAt(e, out = _h){
  const u = e.group.userData, a = u.offArm;
  if (!a){ const g = e.group; return out.set(g.position.x, 1.7 * g.scale.y, g.position.z); }
  a.updateWorldMatrix(true, false);
  return a.localToWorld(out.set(0, -0.72, 0.04));
}
function saberTip(e, out){
  const s = e.group.userData.saber;
  if (!s) return handAt(e, out);
  s.updateWorldMatrix(true, false);
  return s.localToWorld(out.set(0, -0.9, 0));
}

/* ---------------- lightning: jagged strands of thin light, re-drawn every frame ---------------- */
const UP = new THREE.Vector3(0, 1, 0), BOX = new THREE.BoxGeometry(1, 1, 1);
const SEG = 10;
function makeArc(strands, color, core){
  const root = new THREE.Group();
  const mk = (c, w, op) => { const s = []; const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < SEG; i++){ const b = new THREE.Mesh(BOX, m); b.userData.w = w; root.add(b); s.push(b); } return { s, m }; };
  root.userData.strands = [];
  for (let i = 0; i < strands; i++) root.userData.strands.push(mk(color, 0.12, 0.75));
  root.userData.strands.push(mk(core, 0.05, 1));
  root.visible = false; root.frustumCulled = false;
  scene.add(root);
  return root;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Vector3(), _s = new THREE.Vector3();
function drawArc(arc, from, to, jitter, width = 1){
  arc.visible = true;
  _d.subVectors(to, from);
  const len = _d.length() || 0.01;
  _n.set(-_d.z, 0, _d.x).normalize(); if (_n.lengthSq() < 0.5) _n.set(1, 0, 0);
  _m.crossVectors(_d, _n).normalize();
  for (const st of arc.userData.strands){
    _p.copy(from);
    for (let i = 0; i < SEG; i++){
      const k = (i + 1) / SEG, env = Math.sin(Math.PI * k) * jitter * (i === SEG - 1 ? 0 : 1);
      _q.copy(from).addScaledVector(_d, k).addScaledVector(_n, rand(-1, 1) * env).addScaledVector(_m, rand(-1, 1) * env);
      const b = st.s[i];
      _s.subVectors(_q, _p);
      const l = _s.length() || 0.001;
      b.position.copy(_p).addScaledVector(_s, 0.5);
      b.quaternion.setFromUnitVectors(UP, _s.multiplyScalar(1 / l));
      b.scale.set(b.userData.w * width, l, b.userData.w * width);
      _p.copy(_q);
    }
  }
  return len;
}
function arcColor(arc, c){ arc.userData.strands[0].m.color.setHex(c); for (let i = 1; i < arc.userData.strands.length - 1; i++) arc.userData.strands[i].m.color.setHex(c); }
function dropArc(arc){ if (!arc) return; scene.remove(arc); for (const st of arc.userData.strands) st.m.dispose(); }

// short-lived bolts (the storm's strikes, a reflected arc's last crack): drawn a few frames, then gone
const flashes = [];
function flash(from, to, color, life = 0.16, jitter = 0.9, width = 1.6){
  const a = makeArc(2, color, VEXIS.lightningCore);
  flashes.push({ a, from: from.clone(), to: to.clone(), life, max: life, jitter, width });
}
function tickFlashes(dt){
  for (let i = flashes.length - 1; i >= 0; i--){
    const f = flashes[i];
    f.life -= dt;
    if (f.life <= 0){ dropArc(f.a); flashes.splice(i, 1); continue; }
    drawArc(f.a, f.from, f.to, f.jitter, f.width * (0.5 + f.life / f.max));
  }
}

/* ---------------- I: GUARD BREAKER ---------------- */
const guardBreak = {
  id: 'guardBreak', urgent: true,
  can: (e, C, F) => C.hero.local && F.blockT > MV.guardBreak.held && C.dist < MV.guardBreak.range + 1,
  start(e, C, M){
    const g = e.group;
    tellFx('parry', g.position, 2.4);
    floater(V3(g.position.x, g.position.y + 3.3, g.position.z), 'GUARD BREAKER', '#ffffff');
    S.windup(g.position, true);
    e.hyper = true;   // (nothing knocks him out of the palm: parry it or get away from it)
  },
  update(e, C, M, dt){
    const c = MV.guardBreak, g = e.group, t = M.t;
    if (t < c.windup){
      turnTo(e, C, dt, 6);
      offArmOut(e, -0.35, 0, dt); swordArm(e, 0.4, dt);
      g.rotation.x = -0.1 * ss(0, c.windup, t);
      if (Math.random() < 0.5){ handAt(e, _b); burst(_b, 0xff3a3a, 1, 2, 1, 0.5); }
      return false;
    }
    if (!M.hit){
      M.hit = true; e.hyper = false;
      g.rotation.x = 0.12;
      g.position.x += C.tx * 1.1; g.position.z += C.tz * 1.1;   // the step into the palm
      handAt(e, _b);
      spawnGroundShock(V3(_b.x, 0.1, _b.z), 0xff3a3a, 2.6, 0.3, 0.8);
      burst(_b, 0xff6a6a, 14, 9, 3, 0.8); S.push(g.position);
      if (C.dist < c.range + 1.1){
        const r = hurtHero(e, C.hero, c.dmg, g.position, { melee: true, unblockable: true, line: 'H', noClash: true });
        if (r === 'parried'){ staggerEnemy(e, -C.tx, -C.tz, 'GUARD BREAKER TURNED'); e.st = 1.6; return true; }
        if (r === 'hit' || r === 'downed'){
          player.vel.x += C.tx * c.knock; player.vel.z += C.tz * c.knock;
          player.stam = Math.max(0, player.stam - 45);
          floater(playerPos(), 'GUARD SHATTERED', '#ff6a3a');
          G.shake = Math.max(G.shake, 0.6);
        }
      } else M.open = true;   // (it found nothing: a beat to punish him in)
    }
    offArmOut(e, 1, 0, dt);
    if (t > c.windup + 0.25) g.rotation.x = damp(g.rotation.x, 0, dt, 8);
    return t > c.windup + 0.65;
  },
};

/* ---------------- I: SABER THROW ---------------- */
let thrown = null;   // the spinning blade in flight (one at a time: he has one saber)
function dropThrown(e){
  if (!thrown) return;
  scene.remove(thrown.spin);
  thrown = null;
  const u = e && e.group.userData;
  if (u && u.saber) u.saber.visible = true;
}
const saberThrow = {
  id: 'throw',
  can: (e, C) => C.dist > MV.throw.minDist && C.dist < MV.throw.maxDist && !!e.group.userData.saber,
  start(e, C, M){ S.windup(e.group.position, false); M.phase = 0; },
  update(e, C, M, dt){
    const c = MV.throw, g = e.group, u = g.userData, t = M.t;
    turnTo(e, C, dt, 5);
    if (M.phase === 0){
      swordArm(e, -2.7 * ss(0, c.windup, t), dt, 16);   // drawn back over the shoulder
      if (t < c.windup) return false;
      // let go: a copy of his blade spins out along the line to the hero; his own hand is empty
      M.phase = 1; M.open = true;
      const spin = new THREE.Group(), blade = u.saber.clone(true);
      blade.rotation.set(Math.PI / 2, 0, 0); blade.position.set(0, 0, 0.45);
      spin.add(blade); spin.scale.setScalar(g.scale.x);
      handAt(e, _b); spin.position.set(_b.x, Math.max(1.3, _b.y), _b.z);
      scene.add(spin);
      u.saber.visible = false;
      thrown = { spin, dx: C.tx, dz: C.tz, out: true, go: 0, max: C.dist + 3, hit: false };
      S.whoosh(g.position, true);
      net('throw', e, { x: spin.position.x, z: spin.position.z });
      return false;
    }
    if (M.phase === 1){
      swordArm(e, -0.4, dt);
      const T = thrown;
      if (!T) return true;
      const sp = T.spin.position;
      T.spin.rotation.y += dt * 22;
      if (Math.random() < 0.3) S.swing('fast', sp);
      if (T.out){
        // it bends a little toward where the hero went
        const hx = C.pp.x - sp.x, hz = C.pp.z - sp.z, hl = Math.hypot(hx, hz) || 1;
        const cross = T.dx * (hz / hl) - T.dz * (hx / hl), turn = clamp(cross, -1, 1) * c.turn * dt;
        const cs = Math.cos(turn), sn = Math.sin(turn), nx = T.dx * cs - T.dz * sn, nz = T.dx * sn + T.dz * cs;
        T.dx = nx; T.dz = nz;
        sp.x += T.dx * c.speed * dt; sp.z += T.dz * c.speed * dt; T.go += c.speed * dt;
        if (T.go >= T.max) T.out = false;
      } else {
        handAt(e, _b);
        const bx = _b.x - sp.x, bz = _b.z - sp.z, bl = Math.hypot(bx, bz);
        if (bl < 0.9){ dropThrown(e); M.phase = 2; M.back = t; S.saberHit(_b, 0.6); return false; }
        const v = c.speed * 1.1 * dt;
        sp.x += bx / bl * v; sp.z += bz / bl * v;
      }
      // it cuts the hero it passes through (block it, parry it, or be out of its way)
      if (!T.hit && flatD(sp, C.pp) < c.reach + 0.3){
        T.hit = true;
        const r = hurtHero(e, C.hero, c.dmg, sp.clone(), { melee: true, line: 'H', noClash: true });
        if (r === 'parried' || r === 'blocked' || r === 'clashed'){
          T.out = false;
          spawnHitSpark(sp, 0xff3a3a, 1);
          if (r === 'parried'){ e.openUntil = G.gt + c.open + 0.6; floater(V3(g.position.x, g.position.y + 3.2, g.position.z), 'DISARMED', '#ffe27a'); }
        }
      }
      if (!T.out && T.hit === true) T.hit = 'back';   // (it can catch you once more on the way home)
      else if (T.hit === 'back' && !T.out && flatD(sp, C.pp) < c.reach * 0.7){ T.hit = 'done'; hurtHero(e, C.hero, c.dmg * 0.6, sp.clone(), { melee: true, line: 'H', noClash: true }); }
      return M.t > 6;   // (a lost blade comes home regardless)
    }
    M.open = false;
    swordArm(e, 0, dt);
    return t - M.back > 0.35;
  },
  end(e){ dropThrown(e); },
};

/* ---------------- II: FORCE LIGHTNING ---------------- */
let bolt = null;   // the arc from his fingers
function reflect(e, M, how){
  const c = MV.lightning, g = e.group;
  M.reflected = true;
  handAt(e, _b);
  flash(playerPos().clone().setY(1.4), _b.clone(), VEXIS.caughtColor, 0.35, 0.6, 2.4);
  floater(playerPos(), how === 'push' ? 'PUSHED BACK!' : 'REFLECTED!', '#ffd24a');
  screenFlash('radial-gradient(ellipse at center, rgba(160,220,255,.22), transparent 55%)', 0.5, 0.3);
  G.hitstop = Math.max(G.hitstop, 0.1); G.slowmo = Math.min(G.slowmo, 0.5); G.slowmoT = Math.max(G.slowmoT, 0.3);
  e.hyper = false;
  e.openUntil = G.gt + c.stun;
  damageEnemy(e, c.reflectDmg, V3(-Math.sin(g.rotation.y), 0, -Math.cos(g.rotation.y)), 0, false, false, { launch: false });
  staggerEnemy(e, -Math.sin(g.rotation.y), -Math.cos(g.rotation.y), 'OVERLOADED');
  e.st = c.stun;
  burst(V3(g.position.x, 1.8 * g.scale.y, g.position.z), VEXIS.caughtColor, 30, 10, 5, 1);
  S.zap(g.position); S.stun(g.position);
}
const lightning = {
  id: 'lightning',
  can: (e, C) => C.dist > MV.lightning.minDist && C.dist < MV.lightning.maxDist,
  start(e, C, M){
    const c = MV.lightning;
    M.dur = C.phase >= 3 ? c.durP3 : c.dur;
    M.tick = 0; M.surge = c.windup + rand(...c.surge); M.told = false;
    M.ax = C.tx; M.az = C.tz;   // where the arc points: it swings after the hero, but slowly
    if (!bolt) bolt = makeArc(3, VEXIS.lightningColor, VEXIS.lightningCore);
    floater(V3(e.group.position.x, e.group.position.y + 3.3, e.group.position.z), 'FORCE LIGHTNING', '#cc99ff');
    S.arc(e.group.position);
    net('zapOn', e);
  },
  update(e, C, M, dt){
    const c = MV.lightning, g = e.group, t = M.t;
    turnTo(e, C, dt, 2.2);
    offArmOut(e, ss(0, c.windup, t), 0, dt); swordArm(e, 0.3, dt);
    handAt(e, _b);
    if (t < c.windup){ if (Math.random() < 0.6) burst(_b, VEXIS.lightningColor, 2, 4, 2, 0.5); return false; }
    if (M.reflected) return true;
    // the arc swings after the hero at a capped rate: run across it and it loses you
    const want = Math.atan2(C.tx, C.tz), have = Math.atan2(M.ax, M.az);
    const d = Math.atan2(Math.sin(want - have), Math.cos(want - have)), na = have + clamp(d, -1.5 * dt, 1.5 * dt);
    M.ax = Math.sin(na); M.az = Math.cos(na);
    const onHero = Math.abs(Math.atan2(Math.sin(want - na), Math.cos(want - na))) < 0.22 && C.dist < c.maxDist + 2 && !C.hero.down;
    const local = C.hero.local;
    // caught: a raised guard, square to him, with stamina in it
    const facing = local && (() => { const f = fwd(); return f.x * -C.tx + f.z * -C.tz > 0.25; })();
    const caught = onHero && local && player.blockHeld && player.stam > 0 && facing;
    // the end of the arc: on the hero (on their blade, if they caught it), else out into the floor where it points
    if (onHero) _a.set(C.pp.x - C.tx * (caught ? 0.7 : 0), C.pp.y + (caught ? 1.5 : 1.2), C.pp.z - C.tz * (caught ? 0.7 : 0));
    else _a.set(_b.x + M.ax * Math.min(C.dist, c.maxDist), 0.3, _b.z + M.az * Math.min(C.dist, c.maxDist));
    const surgeIn = M.surge - t, surging = surgeIn < 0 && surgeIn > -0.18;
    arcColor(bolt, caught ? VEXIS.caughtColor : VEXIS.lightningColor);
    drawArc(bolt, _b, _a, surging ? 0.75 : 0.45, surging ? 2.2 : 1);
    if (caught && Math.random() < 0.5) burst(_a, VEXIS.caughtColor, 2, 5, 2, 0.5);
    // the SURGE: a white flash first (the parry tell), then the arc doubles. Parried as it lands, it goes back into him
    if (!M.told && surgeIn < c.surgeTell){ M.told = true; tellFx('parry', onHero ? C.pp : g.position, 1.6, 0.3); }
    if (surgeIn <= 0 && !M.surged){
      M.surged = true;
      if (onHero && local && player.parryT > 0 && facing){ player.parryT = 0; reflect(e, M, 'parry'); return false; }
      if (onHero){
        if (!local){ if (hooks.hurt) hooks.hurt(e, c.dmg * 2.5, g.position, 'zap', false); }
        else if (caught){ player.stam = Math.max(0, player.stam - c.stam * 0.9); player.vel.x += C.tx * c.shove * 3; player.vel.z += C.tz * c.shove * 3; hurtPlayer(c.caughtDmg * 4, null, true, false, true, { by: e }); floater(playerPos(), 'SURGE', '#cc99ff'); }
        else hurtHero(e, C.hero, c.dmg * 2.5, g.position, { blast: true, unblockable: true });
      }
      S.zap(_a); G.shake = Math.max(G.shake, 0.35);
    }
    if (M.surged && surgeIn < -0.18){ M.surge = t + rand(...c.surge); M.told = false; M.surged = false; }
    // the steady fry between surges
    if ((M.tick -= dt) <= 0){
      M.tick = c.tick;
      if (onHero){
        if (!local){ if (hooks.hurt) hooks.hurt(e, c.dmg, g.position, 'zap', false); }
        else if (caught){
          player.stam = Math.max(0, player.stam - c.stam * c.tick);
          player.vel.x += C.tx * c.shove; player.vel.z += C.tz * c.shove;
          hurtPlayer(c.caughtDmg, null, true, false, true, { by: e });
        } else hurtHero(e, C.hero, c.dmg, g.position, { blast: true, unblockable: true });
        S.zap(_a);
      }
    }
    if (t > c.windup + M.dur){ M.open = true; }   // spent: his arm drops, a moment to hit him
    return t > c.windup + M.dur + 0.55;
  },
  // a Force Push into the arc throws it back at him (player/jedi/force.js)
  onPush(e, M, pp, f){
    if (M.reflected || M.t < MV.lightning.windup) return false;
    const g = e.group, dx = g.position.x - pp.x, dz = g.position.z - pp.z, d = Math.hypot(dx, dz) || 1;
    if (d > MV.lightning.maxDist + 2 || (dx * f.x + dz * f.z) / d < 0.5) return false;
    reflect(e, M, 'push');
    return true;
  },
  end(e){ if (bolt) bolt.visible = false; net('zapOff', e); },
};

/* ---------------- II: FORCE CHOKE ---------------- */
const choke = {
  id: 'choke',
  can: (e, C) => C.dist > MV.choke.minDist && C.dist < MV.choke.maxDist && !C.hero.down,
  start(e, C, M){
    M.at = V3(C.pp.x, 0, C.pp.z);
    tellFx('dodge', M.at, MV.choke.r, MV.choke.windup);
    floater(V3(e.group.position.x, e.group.position.y + 3.3, e.group.position.z), 'FORCE CHOKE', '#ff6a6a');
    M.held = false;
  },
  update(e, C, M, dt){
    const c = MV.choke, g = e.group, t = M.t;
    turnTo(e, C, dt, 4);
    offArmOut(e, ss(0, 0.4, t), 0.15, dt);
    const u = g.userData;
    if (t < c.windup) return false;
    if (!M.closed){
      M.closed = true;
      const inside = flatD(C.pp, M.at) < c.r + 0.2 && !C.hero.down;
      if (!inside || (C.hero.local && player.dashT > 0)){ if (C.hero.local) floater(playerPos(), 'EVADED', '#bfe8ff'); M.open = true; M.missT = t; return false; }
      if (!C.hero.local){ if (hooks.hurt) hooks.hurt(e, c.dmg * c.hold / c.tick + c.throwDmg, g.position, 'zap', true); M.missT = t; return false; }
      M.held = true; M.hx = C.pp.x; M.hz = C.pp.z; M.tick = 0;
      S.stun(C.pp);
    }
    if (M.missT != null) return t - M.missT > 0.7;
    // held off the floor, choking: Push him to break it (player/jedi/force.js onPush)
    const ht = t - c.windup;
    playerPos().set(M.hx, 0.9 * ss(0, 0.3, ht), M.hz);
    player.vel.set(0, 0, 0); if (player.moveVel) player.moveVel.set(0, 0, 0);
    if (u.offArm) u.offArm.rotation.x -= 0.25 * ss(0, 0.3, ht);   // the fist closes and lifts
    if ((M.tick -= dt) <= 0){ M.tick = c.tick; hurtPlayer(c.dmg, null, true, false, false, { by: e }); burst(V3(M.hx, 2.1, M.hz), 0xff4a5a, 3, 3, 2, 0.5); }
    if (ht >= c.hold){
      // flung aside
      hurtPlayer(c.throwDmg, g.position, true, false, false, { by: e, unblockable: true });
      player.vel.x += C.tx * c.throwKnock; player.vel.z += C.tz * c.throwKnock; player.vel.y = 5;
      G.shake = Math.max(G.shake, 0.5); S.slam(C.pp);
      M.held = false; M.missT = t;
    }
    return false;
  },
  onPush(e, M, pp, f){
    if (!M.held) return false;
    M.held = false; M.missT = M.t;
    e.hyper = false;
    floater(pp, 'BROKE FREE', '#7fd4ff');
    staggerEnemy(e, f.x, f.z, 'HOLD BROKEN'); e.st = 1.6;
    return true;
  },
};

/* ---------------- II: REPULSE ---------------- */
const repulse = {
  id: 'repulse', urgent: true,
  can: (e, C, F) => F.crowdT > MV.repulse.after,
  start(e, C, M){ tellFx('dodge', e.group.position, MV.repulse.r * 0.5, MV.repulse.windup); e.hyper = true; },
  update(e, C, M, dt){
    const c = MV.repulse, t = M.t;
    e.kneel = 0.45 * ss(0, c.windup, t) * (1 - ss(c.windup, c.windup + 0.2, t));
    e.legMode = t < c.windup + 0.15 ? 'off' : null;
    offArmOut(e, 0.4, 0.4 * ss(0, c.windup, t), dt);
    if (t >= c.windup && !M.done){ M.done = true; e.hyper = false; repulseRing(e, c.r, c.dmg, c.knock); }
    return t > c.windup + 0.45;
  },
};

/* ---------------- III: BLINK CHAIN ---------------- */
function vanish(e, on){
  const g = e.group;
  burst(V3(g.position.x, 1.4 * g.scale.y, g.position.z), 0x1a0a10, 26, 6, 4, 1.4);
  burst(V3(g.position.x, 1.4 * g.scale.y, g.position.z), 0xb3121e, 10, 8, 3, 0.8);
  g.visible = !on; e.ward = on ? 0 : null;
  S.whoosh(g.position, true);
}
const blink = {
  id: 'blink',
  can: (e, C) => C.dist < 16 && !C.hero.down,
  start(e, C, M){ M.n = 0; M.next = 0.2; M.stage = 'out'; e.hyper = true; floater(V3(e.group.position.x, e.group.position.y + 3.3, e.group.position.z), 'BLINK', '#ff6a6a'); },
  update(e, C, M, dt){
    const c = MV.blink, g = e.group, t = M.t;
    if (M.stage === 'out' && t >= M.next){
      vanish(e, true);
      // where he'll come out: beside or behind the hero, never the same side twice
      const side = M.n % 2 ? 1 : -1, back = Math.random() < 0.4;
      const ang = Math.atan2(-C.tx, -C.tz) + (back ? Math.PI : side * rand(1.1, 1.7));
      M.at = V3(C.pp.x + Math.sin(ang) * c.dist, 0, C.pp.z + Math.cos(ang) * c.dist);
      tellFx('parry', M.at, 1.4, c.tell);
      M.stage = 'tell'; M.next = t + c.tell;
      return false;
    }
    if (M.stage === 'tell' && t >= M.next){
      g.position.set(M.at.x, 0, M.at.z);
      g.rotation.y = Math.atan2(C.pp.x - M.at.x, C.pp.z - M.at.z);
      vanish(e, false);
      swordArm(e, -2.2, 1); M.stage = 'cut'; M.next = t + 0.12;
      return false;
    }
    if (M.stage === 'cut'){
      swordArm(e, 1.0, dt, 30);
      if (t < M.next) return false;
      M.n++;
      S.swing('juyo', g.position);
      if (flatD(g.position, C.pp) < c.dist + 1){
        const r = hurtHero(e, C.hero, c.dmg, g.position, { melee: true, line: M.n % 2 ? 'L' : 'R' });
        if (r === 'parried'){ e.hyper = false; staggerEnemy(e, -Math.sin(g.rotation.y), -Math.cos(g.rotation.y), 'CHAIN BROKEN'); e.st = 1.6; return true; }
      }
      M.stage = M.n >= c.count ? 'done' : 'out'; M.next = t + c.gap;
      return false;
    }
    if (M.stage === 'done'){ M.open = true; swordArm(e, 0, dt); return t > M.next; }
    return false;
  },
  end(e){ e.group.visible = true; e.ward = null; },
};

/* ---------------- III: THE STORM ---------------- */
const storm = {
  id: 'storm',
  can: (e, C) => C.dist < 22,
  start(e, C, M){
    M.marks = []; M.next = 0.5; M.n = 0; e.hyper = true;
    showStormBanner(e);
    S.arc(e.group.position);
  },
  update(e, C, M, dt){
    const c = MV.storm, g = e.group, t = M.t;
    const lift = ss(0, 0.5, t) * (1 - ss(c.dur, c.dur + 0.5, t));
    e.flipY = 1.1 * lift; e.legMode = lift > 0.05 ? 'air' : null;
    offArmOut(e, 1, 0.9 * lift, dt); swordArm(e, -2.6 * lift, dt);
    turnTo(e, C, dt, 2);
    // the marks spread outward from him over the storm; every third one is on the hero
    if (t >= M.next && t < c.dur){
      M.next = t + c.every; M.n++;
      const k = clamp(t / c.dur, 0, 1), r = c.spread[0] + (c.spread[1] - c.spread[0]) * k;
      let x, z;
      if (M.n % 3 === 0){ x = C.pp.x; z = C.pp.z; }
      else { const a = rand(0, Math.PI * 2), rr = rand(r * 0.6, r); x = g.position.x + Math.sin(a) * rr; z = g.position.z + Math.cos(a) * rr; }
      const at = V3(x, 0, z);
      if (M.n % 3 === 0) tellFx('area', at, c.r, c.tell);
      else spawnGroundShock(V3(x, 0.1, z), 0xffae2a, c.r, c.tell, 0.7);
      M.marks.push({ at, t: t + c.tell });
    }
    for (let i = M.marks.length - 1; i >= 0; i--){
      const m = M.marks[i];
      if (t < m.t) continue;
      M.marks.splice(i, 1);
      flash(V3(m.at.x + rand(-1, 1), 16, m.at.z + rand(-1, 1)), V3(m.at.x, 0.05, m.at.z), VEXIS.lightningColor, 0.18, 1.1, 1.2);
      spawnGroundShock(V3(m.at.x, 0.1, m.at.z), 0xffffff, c.r * 0.9, 0.25, 0.9);
      burst(V3(m.at.x, 0.4, m.at.z), VEXIS.lightningColor, 8, 7, 4, 0.7);
      S.zap(m.at);
      for (const p of [C.hero]){
        if (p.down || flatD(p.pos, m.at) > c.r) continue;
        if (p.local && player.dashT > 0) continue;
        hurtHero(e, p, c.dmg, m.at, { blast: true, unblockable: true });
      }
      net('strike', e, { x: m.at.x, z: m.at.z });
    }
    if (t > c.dur) M.open = true;
    return t > c.dur + 0.9;
  },
  end(e){ e.flipY = 0; },
};
function showStormBanner(e){ floater(V3(e.group.position.x, e.group.position.y + 3.6, e.group.position.z), 'THE STORM', '#ffae2a'); }

/* ---------------- III: THE LAST STAND (once) ---------------- */
const lastStand = {
  id: 'lastStand', urgent: true, once: true,
  can: (e, C, F) => F.phase >= 3 && e.hp / e.maxHp <= MV.lastStand.at && !C.hero.down,
  start(e, C, M, F){
    e.fin.used.lastStand = true; e.hyper = true;
    vanish(e, true);
    // out on the far side of the floor from the hero
    const g = e.group, d = 11;
    M.from = V3(C.pp.x - C.tx * d, 0, C.pp.z - C.tz * d);
    M.stage = 'wind';
    floater(playerPos(), 'LAST STAND', '#ff2a2a');
  },
  update(e, C, M, dt){
    const c = MV.lastStand, g = e.group, t = M.t;
    if (M.stage === 'wind'){
      if (t > 0.35 && !g.visible){
        g.position.set(M.from.x, 0, M.from.z); vanish(e, false);
        G.slowmo = 0.6; G.slowmoT = Math.max(G.slowmoT, 0.5);
        S.roar(g.position);
      }
      if (g.visible){
        turnTo(e, C, dt, 10);
        e.kneel = 0.5 * ss(0.35, 0.8, t); e.legMode = 'off';
        swordArm(e, 1.1, dt);
        if (Math.random() < 0.7) burst(saberTip(e, _b), 0xff2a2a, 2, 4, 2, 0.6);
      }
      if (t >= c.windup - 0.45 && !M.told){ M.told = true; tellFx('dodge', g.position, 3.2, 0.45); }
      if (t >= c.windup){
        M.stage = 'run'; e.kneel = 0; e.legMode = null;
        M.dx = C.tx; M.dz = C.tz; M.go = 0; M.max = C.dist + 3; M.hit = false;
      }
      return false;
    }
    if (M.stage === 'run'){
      const v = c.speed * dt;
      g.position.x += M.dx * v; g.position.z += M.dz * v; M.go += v;
      swordArm(e, -1.4, dt, 20);
      if (Math.random() < 0.8) burst(V3(g.position.x, 1.2, g.position.z), 0xff2a2a, 2, 3, 1, 0.8);
      if (!M.hit && flatD(g.position, C.pp) < 1.8){ M.hit = true; hurtHero(e, C.hero, c.dmg, g.position, { melee: true, unblockable: true, noClash: true }); }
      if (M.go >= M.max){ M.stage = 'spent'; M.at = t; e.hyper = false; e.openUntil = G.gt + c.open; S.slam(g.position); spawnGroundShock(V3(g.position.x, 0.1, g.position.z), 0xff2a2a, 3, 0.4, 0.8); }
      return false;
    }
    // spent: down on one knee, blade low, wide open
    M.open = true;
    e.kneel = 0.6 * (1 - ss(c.open - 0.4, c.open, t - M.at)); e.legMode = 'off';
    swordArm(e, 0.5, dt);
    return t - M.at > c.open;
  },
};

/* ---------------- his look over the layer's beats ---------------- */
const look = {
  // a phase beat: the breath catches, the blade flickers
  beatStart(e){ burst(saberTip(e, _b), 0xff2a36, 14, 6, 3, 0.7); },
  beatPose(e, M, t){ const u = e.group.userData; if (u.bladeGlow) u.bladeGlow.material.opacity = 0.35 + 0.3 * Math.abs(Math.sin(t * 23)); },
  // the defeat: the blade gutters out in his hand
  defeatStart(e){ S.retract('dark', e.group.position, true); dropThrown(e); if (bolt) bolt.visible = false; },
  defeatPose(e, M, t){
    const u = e.group.userData, k = 1 - ss(0.2, 0.9, t);
    if (u.saber) for (const ch of u.saber.children) if (ch.material && ch.material.blending === THREE.AdditiveBlending || ch === u.bladeGlow) ch.scale.y = Math.max(0.01, k);
    if (u.bladeGlow) u.bladeGlow.scale.y = Math.max(0.01, k);
    swordArm(e, 0.2, 1 / 60, 4); offArmOut(e, 0, 0, 1 / 60);
  },
  frame(e, dt){ tickFlashes(dt); },
  teardown(){ dropThrown(null); if (bolt){ dropArc(bolt); bolt = null; } for (const f of flashes) dropArc(f.a); flashes.length = 0; },
  // co-op guest: the host's move effects
  netFx(m, e){
    if (m.k === 'strike'){ flash(V3(m.x, 16, m.z), V3(m.x, 0.05, m.z), VEXIS.lightningColor, 0.18, 1.1, 2); spawnGroundShock(V3(m.x, 0.1, m.z), 0xffffff, MV.storm.r, 0.25, 0.9); S.zap(V3(m.x, 0, m.z)); }
    else if (m.k === 'zapOn' && e) guest.zap = e;
    else if (m.k === 'zapOff') { guest.zap = null; if (bolt) bolt.visible = false; }
  },
  guestFrame(e, dt){
    tickFlashes(dt);
    if (guest.zap === e && !e.dead){
      if (!bolt) bolt = makeArc(3, VEXIS.lightningColor, VEXIS.lightningCore);
      handAt(e, _b);
      const g = e.group;
      _a.set(_b.x + Math.sin(g.rotation.y) * 7, 1.2, _b.z + Math.cos(g.rotation.y) * 7);
      drawArc(bolt, _b, _a, 0.45, 1);
    }
  },
};
const guest = { zap: null };

registerFinale(VEXIS, { guardBreak, throw: saberThrow, lightning, choke, repulse, blink, storm, lastStand }, look);
