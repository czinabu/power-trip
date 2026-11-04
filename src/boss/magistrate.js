// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE IRON MAGISTRATE — the Mandalorian's final boss: his signature moves and his look, on
// the final boss layer (boss/finale.js). His numbers are data/bosses.js MAGISTRATE. A gun hero's fight first: every move
// has an answer a blaster, a dash or a flank can give, in the shared tell colours (fx/tells.js):
//   THE SHIELD     (I)   fire from the front glances off it while he's on guard. Flank him, or make him attack.
//   SPEAR CHARGE   (I+)  a parry-tell line on the floor at you, then he drives down it: step off it as it locks, or
//                        catch the point (the vambrace catch, a parry). A miss buries the spear: he's stuck and open.
//   SHIELD BASH    (I)   crowd him and the shield slams out (dodge): it throws you off him.
//   ROCKET BARRAGE (II+) up on the jetpack: rockets onto amber marks round you, then a ground pound where he lands.
//   FLAMETHROWER   (II+) a red cone of fire swept across you: get out of it, or round behind him, where his fuel
//                        tank burns open while he's at it.
//   JET LEAP       (II+) run from him and he comes down on you: an amber ring where he lands.
//   THE CRACKS     (III) every big move ends with his split armour venting: hit him then (a weak point).
//   HOMING ROCKETS (III) each mark follows you, then locks red: move as it locks.
//   LAST CHARGE    (III, once) a burn across the floor at you (dodge it); he crashes and kneels, wide open.

import * as THREE from 'three';
import { G, player } from '../state.js';
import { V3, clamp, rand } from '../utils.js';
import { scene } from '../engine/renderer.js';
import { MAGISTRATE } from '../data/bosses.js';
import { registerFinale, turnTo, hurtHero } from './finale.js';
import { staggerEnemy } from '../enemies/damage.js';
import { paintLungeLine, dropLungeLine } from '../enemies/tactics.js';
import { tellFx, TELLS } from '../fx/tells.js';
import { burst } from '../fx/particles.js';
import { sparks } from '../fx/ink.js';
import { floater } from '../fx/floaters.js';
import { spawnGroundShock, spawnHitSpark } from '../fx/vfx.js';
import { playerPos } from '../player/helpers.js';
import { players } from '../player/players.js';
import { queueSpawn } from '../game/flow.js';
import { S } from '../audio/sfx.js';
import { hooks } from '../net/run.js';

const DEF = MAGISTRATE, MV = DEF.moves;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const damp = (a, b, dt, r) => a + (b - a) * (1 - Math.exp(-r * dt));
const flatD = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const net = (k, e, extra) => { if (hooks.fin) hooks.fin({ k, n: e.nid, ...extra }); };
const r2 = (v) => Math.round(v * 100) / 100;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const worldOf = (o, out) => { o.updateWorldMatrix(true, false); return o.getWorldPosition(out); };
const above = (e, h) => V3(e.group.position.x, e.group.position.y + h * e.group.scale.y, e.group.position.z);

/* ---------------- the body ---------------- */
// the spear arm (the AI's weapon arm): -0.35 carried, toward 0 levelled, more negative driven out
function spearArm(e, x, dt, r = 12){ const a = e.group.userData.weaponArm; if (a) a.rotation.x = damp(a.rotation.x, x, dt, r); }
// the left arm off its built pose (it holds the shield in phase I): lift raises it at the hero, to aim the flame
function leftArm(e, lift, dt, r = 10){
  const u = e.group.userData, a = u.offArm;
  if (!a) return;
  if (!u.offBase) u.offBase = a.rotation.clone();
  a.rotation.x = damp(a.rotation.x, u.offBase.x - lift * 1.2, dt, r);
  a.rotation.z = damp(a.rotation.z, u.offBase.z + lift * 0.25, dt, r);
}
// the jetpack's flames: k 0 (off) → 1 (full burn)
function jets(e, k, dt = 1 / 60){
  const u = e.group.userData;
  if (!u.thrusters) return;
  for (const th of u.thrusters){
    const o = damp(th.material.opacity, k * (0.75 + Math.random() * 0.25), dt, 18);
    th.material.opacity = o; th.scale.set(1, 0.6 + o * 1.6, 1); th.visible = o > 0.02;
  }
  if (k > 0.3 && Math.random() < k * 0.9){ const g = e.group; burst(V3(g.position.x + rand(-0.3, 0.3), g.position.y + 0.4, g.position.z + rand(-0.3, 0.3)), Math.random() < 0.5 ? 0xffa23a : 0x6a6a6a, 1, 3, -1.5, 0.8); }
}
// the cracks in his armour: 0 dark, 0.4 smouldering (phase III), 1 venting
function cracks(e, k){
  const u = e.group.userData;
  if (!u.cracks) return;
  for (const c of u.cracks){ c.material.opacity = k * (0.75 + Math.random() * 0.25); c.visible = k > 0.01; }
}
function edge(e, k){ const u = e.group.userData; if (u.spearEdge) for (const s of u.spearEdge) s.material.opacity = 0.25 + k * 0.7; }

/* ---------------- what hurts him: the shield, the cracks, his back while he burns ---------------- */
const mag = (e) => e.mag || (e.mag = { shield: true, ventUntil: 0, farT: 0, blockT: -9, weakT: -9, jet: 0 });
// is he on guard behind the shield? (phase I, and not mid-attack: a swing, a charge, a bash opens it)
function guarding(e){
  const M = mag(e), F = e.fin;
  if (!M.shield || F.phase > 1) return false;
  if (F.sig) return !F.sig.atk;
  return !(e.state === 'windup' || e.state === 'strike' || e.state === 'stagger' || G.gt < (e.openUntil || 0));
}
// which way a blow comes from, as a unit vector from him toward its source (the knock's opposite, else the hero)
function fromDir(e, knockDir){
  const g = e.group;
  if (knockDir && (knockDir.x || knockDir.z)){ const l = Math.hypot(knockDir.x, knockDir.z); return [-knockDir.x / l, -knockDir.z / l]; }
  const pp = playerPos(), dx = pp.x - g.position.x, dz = pp.z - g.position.z, l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}
function damageRule(e, dmg, tick, opts, knockDir){
  const M = mag(e), g = e.group, F = e.fin;
  const [fx, fz] = fromDir(e, knockDir), facing = Math.sin(g.rotation.y) * fx + Math.cos(g.rotation.y) * fz;
  if (guarding(e) && facing > DEF.shield.arc){
    if (tick) return dmg * DEF.shield.tick;
    const sp = V3(g.position.x + Math.sin(g.rotation.y) * 0.9 * g.scale.x, g.position.y + 1.4 * g.scale.y, g.position.z + Math.cos(g.rotation.y) * 0.9 * g.scale.x);
    spawnHitSpark(sp, 0xffd27a, 0.7); S.shieldHit(sp);
    if (G.gt - M.blockT > 0.7){ M.blockT = G.gt; floater(above(e, 2.6), 'SHIELD', '#8fbfe0'); }
    return dmg * DEF.shield.through;
  }
  // his fuel tank, while the flamethrower burns: a blow from behind lands harder
  if (F.sig && F.sig.back && facing < -0.3) dmg *= 1.5;
  if (G.gt < M.ventUntil){
    dmg *= DEF.ventMul;
    if (!tick && G.gt - M.weakT > 0.6){ M.weakT = G.gt; floater(above(e, 2.3), 'WEAK POINT', '#ffb24a'); }
  }
  return dmg;
}
// phase III: his big moves end with the armour venting (a weak point, and the open hit cap)
function vent(e, long = 1){
  if (e.fin.phase < 3) return;
  mag(e).ventUntil = G.gt + DEF.vent * long;
  const g = e.group;
  burst(above(e, 1.6), 0xff6a1a, 16, 6, 3, 0.8); burst(above(e, 1.8), 0x4a4a4a, 10, 3, 3, 1.2);
  floater(above(e, 3.0), 'ARMOUR VENTING', '#ffb24a');
  S.boom(g.position, 0.4);
  net('vent', e, { l: long });
}

/* ---------------- a blast on the floor: whoever's in it on the ground takes it (dodge or jump it) ---------------- */
function areaHit(e, at, r, dmg, knock = 0){
  for (const p of players){
    if (!p.here || p.down) continue;
    const dx = p.pos.x - at.x, dz = p.pos.z - at.z, d = Math.hypot(dx, dz);
    if (d > r) continue;
    if (p.local){
      if (player.dashT > 0 || p.pos.y > 1.3){ floater(playerPos(), 'EVADED', '#bfe8ff'); continue; }
      const res = hurtHero(e, p, dmg, null, { blast: true, unblockable: true });
      if (knock && res === 'hit'){ const l = d || 1; player.vel.x += dx / l * knock; player.vel.z += dz / l * knock; }
    } else if (hooks.hurt) hooks.hurt(e, dmg, at, 'zap', true);
  }
}
function boom(at, r, big = 1){
  spawnGroundShock(V3(at.x, 0.1, at.z), DEF.rocketColor, r, 0.4, 0.95);
  spawnGroundShock(V3(at.x, 0.1, at.z), 0xffffff, r * 0.55, 0.25, 0.7);
  burst(V3(at.x, 0.6, at.z), 0xff8a2a, 14 * big, 9, 6, 0.9);
  burst(V3(at.x, 0.8, at.z), 0x3a3a3a, 8 * big, 4, 4, 1.4);
  S.boom(V3(at.x, 0.5, at.z), 0.55 * big);
  G.shake = Math.max(G.shake, 0.22 * big);
}

/* ---------------- rockets in flight (drawn the same on both co-op screens; the host's land with a blow) ---------------- */
const ROCKET = new THREE.CylinderGeometry(0.07, 0.09, 0.55, 6).rotateX(Math.PI / 2);
const FLAME = new THREE.ConeGeometry(0.12, 0.5, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.45);
let rocketMat = null, rocketFire = null;
const rockets = [];
function launch(from, to, dur, arc, land, tag){
  if (!rocketMat){
    rocketMat = new THREE.MeshStandardMaterial({ color: 0x5a5e66, metalness: 0.7, roughness: 0.4 });
    rocketFire = new THREE.MeshBasicMaterial({ color: DEF.rocketColor, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  }
  const m = new THREE.Mesh(ROCKET, rocketMat), f = new THREE.Mesh(FLAME, rocketFire);
  m.add(f); m.position.copy(from); scene.add(m);
  const R = { m, a: from.clone(), b: to.clone(), t: 0, dur, arc, land, tag, prev: from.clone() };
  rockets.push(R);
  S.rocket(from);
  return R;
}
function tickRockets(dt){
  for (let i = rockets.length - 1; i >= 0; i--){
    const R = rockets[i];
    R.t += dt;
    const k = Math.min(1, R.t / R.dur);
    if (R.track) R.track(R, dt);   // (a homing rocket's mark moves, and so does where it comes down)
    R.prev.copy(R.m.position);
    R.m.position.lerpVectors(R.a, R.b, k);
    R.m.position.y += R.arc * 4 * k * (1 - k);
    _c.subVectors(R.m.position, R.prev);
    if (_c.lengthSq() > 1e-6) R.m.lookAt(_c.add(R.m.position));
    if (Math.random() < 0.7) burst(R.prev, 0x7a7a7a, 1, 1, 0.5, 0.7);
    if (k >= 1){
      scene.remove(R.m); rockets.splice(i, 1);
      if (R.land) R.land(R.b);
    }
  }
}
function dropRockets(){ for (const R of rockets) scene.remove(R.m); rockets.length = 0; }

/* ---------------- I: SPEAR CHARGE ---------------- */
const charge = {
  id: 'charge',
  can: (e, C) => C.dist < MV.charge.maxDist && !C.hero.down,
  start(e, C, M){
    const g = e.group;
    // crowded: a jet hop backwards first, to give the charge its run
    M.back = C.dist < MV.charge.minDist ? MV.charge.minDist + 3 - C.dist : 0;
    M.stage = 'tell'; M.dx = C.tx; M.dz = C.tz; M.len = C.dist + MV.charge.over; M.atk = true;
    e.hyper = true;
    tellFx('parry', g.position, 2.8);
    floater(above(e, 2.8), 'SPEAR CHARGE', '#ffffff');
    S.windup(g.position, true);
  },
  update(e, C, M, dt){
    const c = MV.charge, g = e.group, u = g.userData, t = M.t;
    if (M.stage === 'tell'){
      const k = t / c.tell;
      if (M.back > 0 && t < 0.4){ const v = M.back / 0.4 * dt; g.position.x -= C.tx * v; g.position.z -= C.tz * v; jets(e, 0.9, dt); if (Math.random() < 0.6) burst(above(e, 0.2), 0xb09a7a, 2, 3, 1, 0.8); }
      else if (M.back > 0 && !M.hopped){ M.hopped = true; jets(e, 0); }
      if (k < c.lockAt){ M.dx = C.tx; M.dz = C.tz; M.len = C.dist + c.over; }
      else if (!M.locked){ M.locked = true; S.windup(g.position, false); }
      g.rotation.y = Math.atan2(M.dx, M.dz);
      g.rotation.x = -0.26 * ss(0, 0.4, k);   // back onto the rear foot
      spearArm(e, -0.15, dt); edge(e, k);
      u.bodyMat.emissive.setHex(TELLS.parry.accent); u.bodyMat.emissiveIntensity = 0.3 + k * 1.4;
      paintLungeLine(e, g.position.x, g.position.z, g.rotation.y, M.len, !!M.locked, k);
      if (hooks.lunge) hooks.lunge(e, g.position, g.rotation.y, M.len, !!M.locked, k);
      if (t < c.tell) return false;
      M.stage = 'run'; M.go = 0; M.hit = false; u.bodyMat.emissiveIntensity = 0;
      S.whoosh(g.position, true); jets(e, 0.7);
      return false;
    }
    if (M.stage === 'run'){
      const v = c.speed * dt, ox = g.position.x, oz = g.position.z;
      g.position.x += M.dx * v; g.position.z += M.dz * v; M.go += v;
      g.rotation.x = damp(g.rotation.x, 0.28, dt, 16);
      spearArm(e, -0.6, dt, 22); jets(e, 0.8, dt);
      if (Math.random() < 0.8) burst(above(e, 0.3), 0xb09a7a, 2, 3, 1, 0.8);
      // the point sweeps the path it ran this frame: whoever's on it takes the spear (parry it, or be off the line)
      const pp = C.pp;
      if (!M.hit && Math.abs(pp.y - g.position.y) < 2){
        const sx = g.position.x - ox, sz = g.position.z - oz, sl = sx * sx + sz * sz || 1;
        const k = clamp(((pp.x - ox) * sx + (pp.z - oz) * sz) / sl, 0, 1);
        if (Math.hypot(pp.x - (ox + sx * k), pp.z - (oz + sz * k)) < c.hitR){
          M.hit = true;
          const r = hurtHero(e, C.hero, c.dmg, g.position.clone(), { melee: true, unblockable: true, line: 'H', noClash: true });
          if (r === 'parried' || r === 'clashed'){
            dropLungeLine(e); e.hyper = false;
            staggerEnemy(e, -M.dx, -M.dz, 'SPEAR TURNED'); e.st = 1.8; e.openUntil = G.gt + 1.8;
            return true;
          }
          if (r === 'hit'){ player.vel.x += M.dx * c.knock; player.vel.z += M.dz * c.knock; G.shake = Math.max(G.shake, 0.5); }
        }
      }
      const moved = Math.hypot(g.position.x - ox, g.position.z - oz);
      if (M.go < M.len && !(M.go > 2 && moved < v * 0.3)) return false;   // (run out, or run into something)
      dropLungeLine(e); jets(e, 0);
      if (M.hit){ M.stage = 'done'; M.at = t; return false; }
      // a miss: the spear goes into the floor and stays there a while
      M.stage = 'stuck'; M.at = t; M.open = true; e.hyper = false;
      const tip = g.userData.spearTip ? worldOf(g.userData.spearTip, _a) : above(e, 0.2);
      spawnGroundShock(V3(tip.x, 0.1, tip.z), 0xffd27a, 2.2, 0.3, 0.8);
      sparks(V3(tip.x, 0.2, tip.z), 0xffd27a, 10, 8, { up: 1 });
      S.slam(g.position);
      floater(above(e, 2.6), 'STUCK — OPEN', '#ffe27a');
      return false;
    }
    if (M.stage === 'stuck'){
      g.rotation.x = damp(g.rotation.x, 0.34, dt, 10); spearArm(e, 0.45, dt, 10); edge(e, 0);
      e.kneel = 0.3; e.legMode = 'off';
      if (Math.random() < 0.3 && g.userData.spearTip){ worldOf(g.userData.spearTip, _a); sparks(_a, 0xffb24a, 1, 3, { up: 1 }); }
      if (t - M.at < c.stuck) return false;
      e.kneel = 0; e.legMode = null; M.open = false;
      vent(e);
      return true;
    }
    g.rotation.x = damp(g.rotation.x, 0, dt, 8); spearArm(e, -0.35, dt);
    return t - M.at > 0.5;
  },
  end(e){ dropLungeLine(e); e.group.userData.bodyMat.emissiveIntensity = 0; edge(e, 0); jets(e, 0); e.kneel = 0; },
};

/* ---------------- I: SHIELD BASH ---------------- */
const bash = {
  id: 'bash', urgent: true,
  can: (e, C, F) => mag(e).shield && F.phase === 1 && F.crowdT > MV.bash.after && C.dist < MV.bash.reach + 1,
  start(e, C, M){ tellFx('dodge', e.group.position, 2.6, MV.bash.windup); e.hyper = true; M.atk = true; S.windup(e.group.position, true); },
  update(e, C, M, dt){
    const c = MV.bash, g = e.group, sh = g.userData.shield, t = M.t;
    turnTo(e, C, dt, t < c.windup ? 8 : 0);
    if (sh){ if (!M.z0) M.z0 = sh.position.z; sh.position.z = M.z0 - 0.16 * ss(0, c.windup, t) + 0.38 * ss(c.windup, c.windup + 0.08, t) * (1 - ss(c.windup + 0.25, c.windup + 0.5, t)); }
    g.rotation.x = -0.1 * ss(0, c.windup, t) + 0.2 * ss(c.windup, c.windup + 0.08, t) * (1 - ss(c.windup + 0.3, c.windup + 0.6, t));
    if (t >= c.windup && !M.done){
      M.done = true; e.hyper = false;
      g.position.x += C.tx * 0.8; g.position.z += C.tz * 0.8;
      burst(above(e, 1.3), 0xffd27a, 10, 7, 2, 0.7); S.slam(g.position); G.shake = Math.max(G.shake, 0.4);
      if (C.dist < c.reach + 0.8 && C.hero.local){
        if (player.dashT > 0) floater(playerPos(), 'EVADED', '#bfe8ff');
        else {
          const r = hurtHero(e, C.hero, c.dmg, g.position, { melee: true, unblockable: true, noClash: true });
          if (r === 'hit'){ player.vel.x += C.tx * c.knock; player.vel.z += C.tz * c.knock; player.vel.y = Math.max(player.vel.y, 4); }
        }
      } else if (C.dist < c.reach + 0.8) hurtHero(e, C.hero, c.dmg, g.position, { melee: true, unblockable: true });
      else M.open = true;   // (it found nothing: a beat to punish him in)
    }
    return t > c.windup + 0.6;
  },
  end(e, C, M){ const sh = e.group.userData.shield; if (sh && M.z0) sh.position.z = M.z0; },
};

/* ---------------- flight, shared by the barrage, the leap and the last charge ---------------- */
// up on the jetpack: the body's lift (e.flipY: the AI stands him that far off the ground) and the legs trailing
function lift(e, y, dt, r = 5){ e.flipY = damp(e.flipY || 0, y, dt, r); e.legMode = e.flipY > 0.3 ? 'air' : null; }
function pound(e, c){
  const g = e.group;
  e.flipY = 0; e.legMode = null; jets(e, 0);
  boom(g.position, c.r, 1.4);
  spawnGroundShock(V3(g.position.x, 0.1, g.position.z), 0xffae2a, c.r, 0.5, 1);
  S.slam(g.position); G.shake = Math.max(G.shake, 0.7);
  areaHit(e, g.position, c.r, c.dmg, c.knock);
  net('pound', e, { x: r2(g.position.x), z: r2(g.position.z), r: c.r });
}

/* ---------------- II: ROCKET BARRAGE ---------------- */
const barrage = {
  id: 'barrage',
  can: (e, C) => C.dist > MV.barrage.minDist && C.dist < MV.barrage.maxDist && !C.hero.down,
  start(e, C, M){
    M.stage = 'rise'; M.n = 0; M.next = 0; e.hyper = true;
    floater(above(e, 2.8), 'ROCKET BARRAGE', '#ffae2a');
    S.whoosh(e.group.position, true); S.rocket(e.group.position);
  },
  update(e, C, M, dt){
    const c = MV.barrage, g = e.group, u = g.userData, t = M.t;
    turnTo(e, C, dt, 4);
    if (M.stage !== 'fall') { lift(e, c.alt, dt, 3.5); jets(e, 1, dt); }
    leftArm(e, 0, dt); spearArm(e, -0.5, dt);
    if (M.stage === 'rise'){ if (t >= c.rise){ M.stage = 'fire'; M.next = t; } return false; }
    if (M.stage === 'fire'){
      if (t >= M.next && M.n < c.rockets){
        M.next = t + c.every; M.n++;
        // every few, one on the hero (led a little where they're running); the rest scattered round them
        let x = C.pp.x, z = C.pp.z;
        if (M.n % c.onHero === 1 || c.onHero === 1){ if (C.hero.local){ x += player.vel.x * 0.35; z += player.vel.z * 0.35; } }
        else { const a = rand(0, Math.PI * 2), rr = rand(1.2, c.spread); x += Math.sin(a) * rr; z += Math.cos(a) * rr; }
        const to = V3(x, 0, z);
        if (M.n % c.onHero === 1) tellFx('area', to, c.r, c.tell); else spawnGroundShock(V3(x, 0.1, z), 0xffae2a, c.r, c.tell, 0.7);
        const pod = u.pods && u.pods[M.n % u.pods.length];
        const from = pod ? worldOf(pod, _a).clone() : above(e, 2.6);
        launch(from, to, c.tell, 3, (at) => { boom(at, c.r); areaHit(e, at, c.r, c.dmg, 5); });
        net('rk', e, { a: [r2(from.x), r2(from.y), r2(from.z)], b: [r2(x), r2(z)], d: c.tell, h: 3, r: c.r });
      }
      if (M.n >= c.rockets && t > M.next + c.tell * 0.6){
        // down onto the floor near the hero, with a pound: the ring marks where
        M.stage = 'fall'; M.at = t;
        const l = Math.max(2.5, C.dist * 0.55);
        M.land = V3(g.position.x + C.tx * Math.min(l, C.dist - 2.2), 0, g.position.z + C.tz * Math.min(l, C.dist - 2.2));
        M.from = V3(g.position.x, 0, g.position.z); M.y0 = e.flipY;
        tellFx('area', M.land, c.pound.r, c.fall);
      }
      return false;
    }
    if (M.stage === 'fall'){
      const k = ss(0, c.fall, t - M.at);
      g.position.x = M.from.x + (M.land.x - M.from.x) * k; g.position.z = M.from.z + (M.land.z - M.from.z) * k;
      e.flipY = M.y0 * (1 - k * k); e.legMode = 'air'; jets(e, 0.4, dt);
      if (k < 1) return false;
      pound(e, c.pound); M.stage = 'open'; M.at = t; M.open = true; vent(e);
      return false;
    }
    e.kneel = 0.35 * (1 - ss(0, c.open, t - M.at)); e.legMode = 'off';
    return t - M.at > c.open;
  },
  end(e){ e.flipY = 0; e.legMode = null; e.kneel = 0; jets(e, 0); },
};

/* ---------------- II: FLAMETHROWER ---------------- */
// the fire: a cone of flickering light out of the vambrace, plus embers along it (one at a time: he has one projector)
let fire = null, fan = null;
function makeFire(){
  if (fire) return;
  const c = MV.flame;
  const mat = new THREE.MeshBasicMaterial({ color: DEF.flameColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  fire = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(c.arc) * c.range * 0.8, c.range, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, c.range / 2), mat);   // (tip at the nozzle, opening out along +z)
  fire.frustumCulled = false; scene.add(fire);
  // the danger on the floor: a red fan the cone will burn (the dodge tell's colour)
  fan = new THREE.Mesh(new THREE.CircleGeometry(c.range, 18, -Math.PI / 2 - c.arc, c.arc * 2).rotateX(-Math.PI / 2),   // (centred on +z)
    new THREE.MeshBasicMaterial({ color: TELLS.dodge.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  fan.renderOrder = 4; scene.add(fan);
}
function drawFire(e, yaw, k, warn, dt){
  makeFire();
  const u = e.group.userData, tip = u.flameTip ? worldOf(u.flameTip, _a) : above(e, 1.3);
  fire.position.copy(tip); fire.position.y = Math.max(0.9, tip.y - 0.2);
  fire.rotation.set(0.12, yaw, 0);
  fire.material.opacity = k * (0.16 + Math.random() * 0.12);
  fire.scale.set(0.8 + Math.random() * 0.3, 0.8 + Math.random() * 0.3, k);
  fire.visible = k > 0.01;
  fan.position.set(e.group.position.x, 0.07, e.group.position.z);
  fan.rotation.y = yaw;
  fan.material.opacity = warn;
  fan.visible = warn > 0.01;
  if (k > 0.3){
    _b.set(Math.sin(yaw), -0.05, Math.cos(yaw));
    sparks(tip, Math.random() < 0.5 ? 0xffd24a : 0xff6a1a, 3, MV.flame.range * 1.6, { dir: _b, cone: 0.22, life: 0.5, size: 0.7, grav: -2 });
    if (Math.random() < 0.4) burst(V3(tip.x + _b.x * 4, 0.8, tip.z + _b.z * 4), 0x3a3a3a, 1, 2, 2, 1.2);
  }
}
function hideFire(){ if (fire){ fire.visible = false; fan.visible = false; } }
const flame = {
  id: 'flame',
  can: (e, C) => C.dist < MV.flame.maxDist && !C.hero.down,
  start(e, C, M){
    M.yaw0 = Math.atan2(C.tx, C.tz); M.tick = 0; M.atk = true; e.hyper = true;
    floater(above(e, 2.8), 'FLAMETHROWER', '#ff6a3a');
    S.windup(e.group.position, true);
    tellFx('dodge', e.group.position, 2.2, MV.flame.windup);
    net('flameOn', e);
  },
  update(e, C, M, dt){
    const c = MV.flame, g = e.group, t = M.t;
    leftArm(e, 1, dt);
    if (t < c.windup){
      turnTo(e, C, dt, 6); M.yaw0 = g.rotation.y;
      drawFire(e, g.rotation.y, 0, 0.35 * (t / c.windup), dt);
      return false;
    }
    // the sweep: across the hero and back
    const s = t - c.windup, yaw = M.yaw0 + Math.sin(s / c.dur * Math.PI * 2) * c.sweep * 0.5;
    g.rotation.y = yaw; M.back = true;
    drawFire(e, yaw, ss(0, 0.2, s) * (1 - ss(c.dur - 0.2, c.dur, s)), 0.3, dt);
    if (Math.random() < 0.25) S.dash();
    M.tick -= dt;
    if (M.tick <= 0){
      M.tick = c.tick;
      const tip = g.userData.flameTip ? worldOf(g.userData.flameTip, _a) : above(e, 1.3);
      for (const p of players){
        if (!p.here || p.down) continue;
        const dx = p.pos.x - tip.x, dz = p.pos.z - tip.z, d = Math.hypot(dx, dz);
        if (d > c.range || d < 0.01) continue;
        const ang = Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw));
        if (Math.abs(ang) > c.arc + 0.12) continue;
        if (p.local){ if (!(player.dashT > 0)) hurtHero(e, p, c.dmg, tip.clone(), {}); }
        else if (hooks.hurt) hooks.hurt(e, c.dmg, tip, 'zap', false);
      }
    }
    if (s < c.dur) return false;
    M.back = false; hideFire(); net('flameOff', e);
    vent(e);
    return true;
  },
  end(e, C, M){ hideFire(); net('flameOff', e); },
};

/* ---------------- II: JET LEAP (run from him and he comes down on you) ---------------- */
const leap = {
  id: 'leap', urgent: true,
  can: (e, C) => mag(e).farT > 1.6 && !C.hero.down,
  start(e, C, M){
    M.stage = 'rise'; e.hyper = true; mag(e).farT = 0;
    S.whoosh(e.group.position, true); S.rocket(e.group.position);
    floater(above(e, 2.8), 'JET LEAP', '#ffae2a');
  },
  update(e, C, M, dt){
    const c = MV.leap, g = e.group, t = M.t;
    turnTo(e, C, dt, 6); jets(e, 1, dt); spearArm(e, -1.1, dt);
    if (M.stage === 'rise'){
      lift(e, c.alt, dt, 6);
      if (t < c.rise) return false;
      // where he'll come down: on the hero, led a little where they're running
      let x = C.pp.x, z = C.pp.z;
      if (C.hero.local){ x += player.vel.x * 0.4; z += player.vel.z * 0.4; }
      M.land = V3(x, 0, z); M.from = V3(g.position.x, 0, g.position.z); M.y0 = e.flipY; M.at = t; M.stage = 'fly';
      tellFx('area', M.land, c.pound.r, c.fly);
      return false;
    }
    if (M.stage === 'fly'){
      const k = clamp((t - M.at) / c.fly, 0, 1);
      g.position.x = M.from.x + (M.land.x - M.from.x) * k; g.position.z = M.from.z + (M.land.z - M.from.z) * k;
      e.flipY = M.y0 * (1 - k) + 2.5 * 4 * k * (1 - k); e.legMode = 'air';
      if (k < 1) return false;
      pound(e, c.pound); spearArm(e, 0.3, 1); M.stage = 'open'; M.at = t; M.open = true; vent(e);
      return false;
    }
    e.kneel = 0.4 * (1 - ss(0, c.open, t - M.at)); e.legMode = 'off';
    return t - M.at > c.open;
  },
  end(e){ e.flipY = 0; e.legMode = null; e.kneel = 0; jets(e, 0); },
};

/* ---------------- III: HOMING ROCKETS ---------------- */
// a homing rocket's mark on the floor: amber while it follows the hero, red once it locks
const markGeo = new THREE.RingGeometry(0.82, 1, 28).rotateX(-Math.PI / 2);
const marks = [];
function makeMark(r){
  const m = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: TELLS.area.color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.scale.setScalar(r); m.renderOrder = 4; scene.add(m); marks.push(m);
  return m;
}
function dropMark(m){ scene.remove(m); m.material.dispose(); const i = marks.indexOf(m); if (i >= 0) marks.splice(i, 1); }
const homing = {
  id: 'homing',
  can: (e, C) => C.dist > MV.homing.minDist && C.dist < MV.homing.maxDist && !C.hero.down,
  start(e, C, M){ M.n = 0; M.next = 0.35; M.live = 0; e.hyper = true; floater(above(e, 2.8), 'HOMING ROCKETS', '#ffae2a'); S.windup(e.group.position, true); },
  update(e, C, M, dt){
    const c = MV.homing, g = e.group, u = g.userData, t = M.t;
    turnTo(e, C, dt, 4); spearArm(e, -0.2, dt); jets(e, 0.25, dt);
    g.rotation.x = damp(g.rotation.x, -0.12, dt, 6);   // braced, leaning back as the pods fire
    if (t >= M.next && M.n < c.rockets){
      M.next = t + c.gap; M.n++; M.live++;
      const pod = u.pods && u.pods[M.n % u.pods.length], from = pod ? worldOf(pod, _a).clone() : above(e, 2.6);
      const hero = C.hero, mark = makeMark(c.r);
      const at = V3(hero.pos.x + rand(-2, 2), 0, hero.pos.z + rand(-2, 2));
      mark.position.set(at.x, 0.08, at.z);
      const R = launch(from, at, c.rise + c.follow + c.lock, 14, (p) => {
        dropMark(mark); M.live--;
        boom(p, c.r, 1.1); areaHit(e, p, c.r, c.dmg, 7);
        net('boom', e, { x: r2(p.x), z: r2(p.z), r: c.r });
      });
      // its mark slides after the hero (a little slower than a run), then locks: the rocket comes down on the lock
      R.track = (R, rdt) => {
        if (R.t < c.rise + c.follow){
          const hp = hero.pos, dx = hp.x - R.b.x, dz = hp.z - R.b.z, d = Math.hypot(dx, dz), v = Math.min(d, 7.5 * rdt);
          if (d > 0.01){ R.b.x += dx / d * v; R.b.z += dz / d * v; }
          mark.position.set(R.b.x, 0.08, R.b.z);
          mark.material.opacity = 0.5 + 0.3 * Math.sin(R.t * 12);
        } else if (!R.locked){
          R.locked = true; mark.material.color.setHex(TELLS.dodge.color); mark.material.opacity = 1;
          tellFx('dodge', R.b, c.r, c.lock);
        }
      };
      net('rk', e, { a: [r2(from.x), r2(from.y), r2(from.z)], b: [r2(at.x), r2(at.z)], d: c.rise + c.follow + c.lock, h: 14, r: 0 });
    }
    if (M.n >= c.rockets && M.live <= 0 && !M.done){ M.done = true; M.at = t; M.open = true; vent(e); }
    return !!M.done && t - M.at > 0.8;
  },
  end(e){ e.group.rotation.x = 0; jets(e, 0); },
};

/* ---------------- III: THE LAST CHARGE (once) ---------------- */
const lastCharge = {
  id: 'lastCharge', urgent: true, once: true,
  can: (e, C, F) => F.phase >= 3 && e.hp / e.maxHp <= MV.lastCharge.at && !C.hero.down,
  start(e, C, M){
    e.fin.used.lastCharge = true; e.hyper = true; M.stage = 'wind';
    floater(playerPos(), 'LAST CHARGE', '#ff2a2a');
    S.roar(e.group.position);
    G.slowmo = 0.6; G.slowmoT = Math.max(G.slowmoT, 0.5);
  },
  update(e, C, M, dt){
    const c = MV.lastCharge, g = e.group, t = M.t;
    if (M.stage === 'wind'){
      turnTo(e, C, dt, 8); lift(e, c.alt, dt, 4); jets(e, 0.5 + 0.5 * (t / c.windup), dt);
      spearArm(e, -0.15, dt); edge(e, t / c.windup); cracks(e, 0.6 + 0.4 * Math.random());
      if (t >= c.windup - 0.45 && !M.told){ M.told = true; tellFx('dodge', g.position, 3.2, 0.45); }
      if (t < c.windup) return false;
      M.stage = 'run'; M.dx = C.tx; M.dz = C.tz; M.go = 0; M.max = C.dist + 4; M.hit = false;
      S.whoosh(g.position, true); S.rocket(g.position);
      return false;
    }
    if (M.stage === 'run'){
      const v = c.speed * dt, ox = g.position.x, oz = g.position.z;
      g.position.x += M.dx * v; g.position.z += M.dz * v; M.go += v;
      g.rotation.x = damp(g.rotation.x, 0.45, dt, 12); spearArm(e, -0.6, dt, 20); jets(e, 1, dt);
      if (Math.random() < 0.9) burst(above(e, 0.6), 0xffa23a, 2, 3, 1, 0.9);
      if (!M.hit && flatD(g.position, C.pp) < 2){
        M.hit = true;
        const r = hurtHero(e, C.hero, c.dmg, g.position.clone(), { melee: true, unblockable: true, noClash: true });
        if (r === 'hit' && C.hero.local){ player.vel.x += M.dx * c.knock; player.vel.z += M.dz * c.knock; player.vel.y = Math.max(player.vel.y, 5); }
      }
      const moved = Math.hypot(g.position.x - ox, g.position.z - oz);
      if (M.go < M.max && !(M.go > 2 && moved < v * 0.3)) return false;
      // the crash: down in the wreck of his own armour, wide open
      M.stage = 'spent'; M.at = t; e.hyper = false; e.flipY = 0; jets(e, 0); edge(e, 0);
      boom(g.position, 3.5, 1.6); S.slam(g.position);
      e.openUntil = G.gt + c.open;
      vent(e, c.open / DEF.vent);
      floater(above(e, 2.6), 'DOWN — OPEN', '#ffe27a');
      return false;
    }
    M.open = true;
    e.kneel = 0.7 * (1 - ss(c.open - 0.5, c.open, t - M.at)); e.legMode = 'off';
    g.rotation.x = damp(g.rotation.x, 0.3 * (1 - ss(c.open - 0.5, c.open, t - M.at)), dt, 6);
    spearArm(e, 0.5, dt);
    return t - M.at > c.open;
  },
  end(e){ e.flipY = 0; e.legMode = null; e.kneel = 0; jets(e, 0); },
};

/* ---------------- what changes on him as the phases turn ---------------- */
let shieldProp = null;   // the shield he threw down, lying on the floor
function castShield(e){
  const g = e.group, u = g.userData;
  mag(e).shield = false;
  if (!u.shield || !u.shield.visible) return;
  u.shield.visible = false;
  if (shieldProp) scene.remove(shieldProp);
  const s = u.shield.clone(true);
  s.scale.setScalar(g.scale.x);
  s.position.set(g.position.x - Math.cos(g.rotation.y) * 2.2, 0.12, g.position.z + Math.sin(g.rotation.y) * 2.2);
  s.rotation.set(-Math.PI / 2 + 0.08, 0, rand(0, Math.PI));
  scene.add(s); shieldProp = s;
  sparks(V3(s.position.x, 0.4, s.position.z), 0xffd27a, 12, 7, { up: 1 });
  S.shieldHit(s.position); S.slam(s.position);
}
function callGuard(phase){
  const list = DEF.guard[phase - 1];
  if (!list || G.sandbox) return;   // (the training floor: you call your own foes)
  for (const tn in list) for (let i = 0; i < list[tn]; i++) queueSpawn(tn);
}

/* ---------------- his look over the layer's beats ---------------- */
const guest = { phase: 1, vent: 0, flame: null };
const look = {
  spawn(e){ mag(e); e.flipY = 0; },
  damage: damageRule,
  open: (e) => G.gt < mag(e).ventUntil,
  phase(e, p, onGuest){
    if (onGuest){ guest.phase = p; if (p >= 2){ const u = e.group.userData; if (u.shield && u.shield.visible){ mag(e); castShield(e); } } return; }
    if (p >= 2) castShield(e);
    if (p >= 3){ burst(above(e, 1.6), 0xff6a1a, 24, 8, 4, 0.8); floater(above(e, 3.2), 'HIS ARMOUR CRACKS', '#ffb24a'); }
    callGuard(p);
  },
  beatStart(e){ const g = e.group; sparks(above(e, 1.6), 0xffd27a, 14, 8, { up: 1 }); burst(V3(g.position.x, 0.4, g.position.z), 0x4a4a4a, 12, 4, 2, 1.3); hideFire(); jets(e, 0); },
  beatPose(e, M, t){ jets(e, 0); edge(e, 0.5 + 0.5 * Math.sin(t * 20)); },
  defeatStart(e){ hideFire(); dropRockets(); for (const m of marks.slice()) dropMark(m); S.slam(e.group.position); burst(above(e, 1.5), 0xff6a1a, 30, 8, 5, 0.9); },
  defeatPose(e, M, t){ cracks(e, Math.max(0, 1 - t / 2.5) * (0.6 + 0.4 * Math.random())); edge(e, 0); jets(e, 0); spearArm(e, 0.6, 1 / 60, 4); },
  frame(e, dt){
    tickRockets(dt);
    const M = mag(e), F = e.fin;
    // how long the hero has kept well away from him (the jet leap answers it)
    M.farT = !F.sig && F.phase >= 2 && Math.hypot(playerPos().x - e.group.position.x, playerPos().z - e.group.position.z) > MV.leap.minDist ? M.farT + dt : Math.max(0, M.farT - dt * 2);
    if (!F.over) cracks(e, F.phase < 3 ? 0 : G.gt < M.ventUntil ? 1 : 0.3);
    if (F.phase >= 3 && G.gt < M.ventUntil && Math.random() < 0.35) burst(above(e, rand(1.2, 1.9)), Math.random() < 0.6 ? 0xff6a1a : 0x4a4a4a, 1, 2, 2, 0.8);
    if (!F.sig) { jets(e, 0, dt); if (e.flipY) e.flipY = damp(e.flipY, 0, dt, 8); }
  },
  teardown(){ dropRockets(); hideFire(); for (const m of marks.slice()) dropMark(m); if (shieldProp){ scene.remove(shieldProp); shieldProp = null; } guest.phase = 1; guest.vent = 0; guest.flame = null; },
  // co-op guest: the host's move effects
  netFx(m, e){
    if (m.k === 'rk') launch(V3(m.a[0], m.a[1], m.a[2]), V3(m.b[0], 0, m.b[1]), m.d, m.h, m.r ? (at) => boom(at, m.r) : null);
    else if (m.k === 'boom') boom(V3(m.x, 0, m.z), m.r, 1.1);
    else if (m.k === 'pound'){ boom(V3(m.x, 0, m.z), m.r, 1.4); spawnGroundShock(V3(m.x, 0.1, m.z), 0xffae2a, m.r, 0.5, 1); }
    else if (m.k === 'vent'){ guest.vent = G.gt + DEF.vent * (m.l || 1); if (e) burst(above(e, 1.6), 0xff6a1a, 16, 6, 3, 0.8); }
    else if (m.k === 'flameOn') guest.flame = e;
    else if (m.k === 'flameOff'){ guest.flame = null; hideFire(); }
  },
  guestFrame(e, dt){
    tickRockets(dt);
    cracks(e, guest.phase < 3 ? 0 : G.gt < guest.vent ? 1 : 0.3);
    jets(e, e.group.position.y > 0.4 ? 1 : 0, dt);
    if (guest.flame === e && !e.dead){ leftArm(e, 1, dt); drawFire(e, e.group.rotation.y, 1, 0.3, dt); }
  },
};

registerFinale(MAGISTRATE, { charge, bash, barrage, flame, leap, homing, lastCharge }, look);
