// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE MARSHAL — the ARC trooper's final boss: his signature moves and his look, on the final boss layer
// (boss/finale.js). His numbers are data/bosses.js MARSHAL_BOSS. A trooper's fight: cover, the squad, the dash and the
// parry all have answers, in the shared tell colours (fx/tells.js):
//   SUPPRESSING FIRE (I-II) a red lane on the floor at you, then both pistols down it: break line of sight, or get
//                           off the lane (it follows you, slowly). Cover stops the bolts.
//   DETONATORS       (I-II) lobbed onto amber marks round you: move.
//   COMBAT ROLL      (I-II) crowd him and he rolls away to a new angle, and snaps a shot off as he comes up.
//   CALL IN          (I-II) "purge squad, on me": his troopers (and in phase II, his jet troopers) come in.
//   SIGNAL PULSE     (II)    the order goes out: a violet ring across the floor (jump or dash it). A squadmate it passes
//                           is TURNED and fires on you till you get to them and shake them out of it.
//   BATON FLURRY     (III)   the guns are down: three quick blows, the last a heavy one. Parry it and he's thrown open.
//   SHOULDER CHARGE  (III)   a line at you, then he drives down it: parry him off it, or step off it as it locks. A
//                           miss leaves him stumbling.
//   LAST STAND       (III, once) up, and the baton down into the floor: an amber ring of charge out from him.

import * as THREE from 'three';
import { G, player } from '../state.js';
import { V3, clamp, rand } from '../utils.js';
import { scene } from '../engine/renderer.js';
import { MARSHAL_BOSS } from '../data/bosses.js';
import { registerFinale, turnTo, hurtHero } from './finale.js';
import { staggerEnemy } from '../enemies/damage.js';
import { paintLungeLine, dropLungeLine } from '../enemies/tactics.js';
import { fireBolt } from '../enemies/bolts.js';
import { throwGrenade } from '../enemies/grenades.js';
import { tellFx, TELLS } from '../fx/tells.js';
import { burst } from '../fx/particles.js';
import { sparks } from '../fx/ink.js';
import { floater } from '../fx/floaters.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { playerPos } from '../player/helpers.js';
import { players } from '../player/players.js';
import { allies } from '../allies/squad.js';
import { queueSpawn } from '../game/flow.js';
import { S } from '../audio/sfx.js';
import { hooks } from '../net/run.js';

const DEF = MARSHAL_BOSS, MV = DEF.moves;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const damp = (a, b, dt, r) => a + (b - a) * (1 - Math.exp(-r * dt));
const flatD = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const net = (k, e, extra) => { if (hooks.fin) hooks.fin({ k, n: e.nid, ...extra }); };
const r2 = (v) => Math.round(v * 100) / 100;
const _a = new THREE.Vector3();
const worldOf = (o, out) => { o.updateWorldMatrix(true, false); return o.getWorldPosition(out); };
const above = (e, h) => V3(e.group.position.x, e.group.position.y + h * e.group.scale.y, e.group.position.z);
const additive = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

/* ---------------- the body ---------------- */
const mar = (e) => e.mar || (e.mar = { guns: true, closeT: 0, sig: 0 });
// the right arm (the AI's weapon arm): -0.35 carried, about -1.45 levelled at you, raised overhead past -2.4
function rightArm(e, x, dt, r = 12){ const a = e.group.userData.weaponArm; if (a) a.rotation.x = damp(a.rotation.x, x, dt, r); }
// the left arm off its built pose: lift 1 levels the second pistol (or the wrist emitter) at you
function leftArm(e, lift, dt, r = 10){
  const u = e.group.userData, a = u.offArm;
  if (!a) return;
  if (!u.offBase) u.offBase = a.rotation.clone();
  a.rotation.x = damp(a.rotation.x, u.offBase.x - lift * 1.15, dt, r);
  a.rotation.z = damp(a.rotation.z, u.offBase.z - lift * 0.12, dt, r);
}
// the signal rig's violet: 0.2 idle, up to 1 as he sends the order
function signalGlow(e, k){ const u = e.group.userData; if (u.signal) for (const s of u.signal) s.material.opacity = 0.2 + 0.8 * k * (0.8 + 0.2 * Math.random()); }
function batonGlow(e, k){ const u = e.group.userData; if (u.batonGlow) for (const s of u.batonGlow) s.material.opacity = 0.35 + 0.65 * k * (0.75 + 0.25 * Math.random()); }
// what he holds: the two pistols (phases I and II), or the baton (III; it rides his back till then)
function holding(e, guns){
  const u = e.group.userData;
  if (u.pistolR) u.pistolR.visible = guns;
  if (u.pistolL) u.pistolL.visible = guns;
  if (u.batonR) u.batonR.visible = !guns;
  if (u.batonBack) u.batonBack.visible = guns;
}
const muzzle = (e, right) => { const m = e.group.userData[right ? 'muzzleR' : 'muzzleL']; return m ? worldOf(m, _a).clone() : above(e, 1.5); };

/* ---------------- what hurts him: nothing lands mid-roll ---------------- */
function damageRule(e, dmg, tick){
  const F = e.fin;
  if (F.sig && F.sig.rolling){ if (!tick && G.gt - (mar(e).evT || 0) > 0.5){ mar(e).evT = G.gt; floater(above(e, 2.4), 'ROLLED', '#bfe8ff'); } return null; }
  return dmg;
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

/* ---------------- the lane his suppressing fire walks down (a red strip on the floor) ---------------- */
let lane = null;
function showLane(e, yaw, len, k){
  if (!lane){
    lane = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), additive(TELLS.dodge.color, 0));
    lane.renderOrder = 4; scene.add(lane);
  }
  const g = e.group;
  lane.position.set(g.position.x, 0.07, g.position.z); lane.rotation.y = yaw; lane.scale.set(1, 1, len);
  lane.material.opacity = k; lane.visible = k > 0.01;
}
function hideLane(){ if (lane) lane.visible = false; }

/* ---------------- I-II: SUPPRESSING FIRE ---------------- */
const suppress = {
  id: 'suppress',
  can: (e, C) => mar(e).guns && C.dist > MV.suppress.minDist && C.dist < MV.suppress.maxDist && !C.hero.down,
  start(e, C, M){
    M.yaw = Math.atan2(C.tx, C.tz); M.next = 0; M.n = 0; e.hyper = true;
    floater(above(e, 2.6), 'SUPPRESSING FIRE', '#ff6a5a');
    S.windup(e.group.position, true);
    net('lane', e, { on: 1 });
  },
  update(e, C, M, dt){
    const c = MV.suppress, g = e.group, t = M.t;
    // the lane follows the hero, slowly: he leads them a little at the start, then only drags after them
    const want = Math.atan2(C.tx, C.tz), d = Math.atan2(Math.sin(want - M.yaw), Math.cos(want - M.yaw));
    M.yaw += clamp(d, -c.track * dt, c.track * dt) * (t < c.windup ? 3 : 1);
    g.rotation.y = M.yaw;
    rightArm(e, -1.45, dt); leftArm(e, 1, dt);
    g.rotation.x = damp(g.rotation.x, -0.06, dt, 8);   // braced
    if (t < c.windup){ showLane(e, M.yaw, c.lane, 0.12 + 0.3 * (t / c.windup)); if (t + dt >= c.windup * 0.7 && !M.told){ M.told = true; tellFx('dodge', g.position, 1.6, 0.3); } return false; }
    const s = t - c.windup;
    showLane(e, M.yaw, c.lane, 0.22 + 0.08 * Math.sin(t * 30));
    if (s >= M.next){
      M.next = s + c.every; M.n++;
      const right = M.n % 2 === 0, from = muzzle(e, right);
      const dir = V3(Math.sin(M.yaw) + rand(-c.spread, c.spread), 0, Math.cos(M.yaw) + rand(-c.spread, c.spread));
      const aimY = C.pp.y + 1.1; dir.y = (aimY - from.y) / Math.max(2, C.dist);
      fireBolt(from, dir, DEF.over.boltSpeed, c.dmg, false, M.n % 3 !== 0, e);
      burst(from, DEF.boltColor, 2, 3, 0.5, 0.25);
      g.rotation.z = (right ? -1 : 1) * 0.03;   // the recoil, hand to hand
    }
    if (s < c.dur) return false;
    hideLane(); net('lane', e, { on: 0 });
    M.open = true; g.rotation.z = 0;
    return s > c.dur + 0.5;
  },
  end(e){ hideLane(); net('lane', e, { on: 0 }); e.group.rotation.z = 0; },
};

/* ---------------- I-II: DETONATORS ---------------- */
const grenade = {
  id: 'grenade',
  can: (e, C) => mar(e).guns && C.dist > MV.grenade.minDist && C.dist < MV.grenade.maxDist && !C.hero.down,
  start(e, C, M){ M.n = 0; M.count = MV.grenade.n[Math.min(MV.grenade.n.length, e.fin.phase) - 1]; M.next = MV.grenade.windup; floater(above(e, 2.6), 'DETONATORS', '#ffae2a'); },
  update(e, C, M, dt){
    const c = MV.grenade, t = M.t;
    turnTo(e, C, dt, 6);
    // the left arm cocks back, then throws, once for each
    const ph = t < c.windup ? t / c.windup : ((t - c.windup) % c.gap) / c.gap;
    leftArm(e, t < c.windup ? -0.6 * ph : 1.2 * Math.sin(ph * Math.PI), dt, 18); rightArm(e, -0.6, dt);
    if (t >= M.next && M.n < M.count){
      M.next = t + c.gap; M.n++;
      let x = C.pp.x, z = C.pp.z;
      if (M.n === 1){ if (C.hero.local){ x += player.vel.x * 0.5; z += player.vel.z * 0.5; } }
      else { const a = rand(0, Math.PI * 2), r = rand(1.6, c.spread); x += Math.sin(a) * r; z += Math.cos(a) * r; }
      const thrower = Object.create(e);
      thrower.t = { ...e.t, blastR: c.r, fuse: c.fuse, dmg: c.dmg };
      throwGrenade(thrower, above(e, 2.0), V3(x, 0, z), false);
      S.whoosh(e.group.position, false);
    }
    return M.n >= M.count && t > M.next + 0.2;
  },
};

/* ---------------- I-II: COMBAT ROLL (crowd him and he's gone) ---------------- */
const roll = {
  id: 'roll', urgent: true,
  can: (e, C) => mar(e).guns && mar(e).closeT > MV.roll.after && !C.hero.down,
  start(e, C, M){
    const c = MV.roll, g = e.group, side = Math.random() < 0.5 ? -1 : 1;
    // off to one side and back from the hero, round the side that's open
    let dx = -C.tx * 0.6 + C.tz * side * 0.8, dz = -C.tz * 0.6 - C.tx * side * 0.8;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    M.dx = dx; M.dz = dz; M.v = c.dist / c.dur; M.rolling = true; M.side = side; e.hyper = true;
    mar(e).closeT = 0;
    g.rotation.y = Math.atan2(dx, dz);
    S.dash(); burst(above(e, 0.3), 0xb09a7a, 8, 4, 1, 0.8);
  },
  update(e, C, M, dt){
    const c = MV.roll, g = e.group, t = M.t;
    if (M.rolling){
      const k = clamp(t / c.dur, 0, 1);
      g.position.x += M.dx * M.v * dt; g.position.z += M.dz * M.v * dt;
      e.kneel = 0.6 * Math.sin(k * Math.PI); e.legMode = 'off';
      g.rotation.x = Math.sin(k * Math.PI) * 0.5;
      if (Math.random() < 0.5) burst(above(e, 0.1), 0xb09a7a, 1, 2, 0.5, 0.6);
      if (k < 1) return false;
      M.rolling = false; M.at = t; e.kneel = 0; e.legMode = null; g.rotation.x = 0; e.hyper = false;
      return false;
    }
    // up on one knee, a snap shot from each pistol
    turnTo(e, C, dt, 14); rightArm(e, -1.45, dt, 20); leftArm(e, 1, dt, 20);
    const s = t - M.at;
    if (s > 0.18 && !M.shot1){ M.shot1 = true; const f = muzzle(e, true); fireBolt(f, V3(C.pp.x - f.x, C.pp.y + 1.1 - f.y, C.pp.z - f.z), DEF.over.boltSpeed, MV.suppress.dmg * 1.6, false, false, e); }
    if (s > 0.32 && !M.shot2){ M.shot2 = true; const f = muzzle(e, false); fireBolt(f, V3(C.pp.x - f.x, C.pp.y + 1.1 - f.y, C.pp.z - f.z), DEF.over.boltSpeed, MV.suppress.dmg * 1.6, false, false, e); }
    return s > 0.5;
  },
  end(e){ e.kneel = 0; e.legMode = null; e.group.rotation.x = 0; },
};

/* ---------------- I-II: CALL IN (his troopers; not on the training floor) ---------------- */
const callIn = {
  id: 'callIn',
  can: (e, C, F) => !G.sandbox && !C.hero.down,
  start(e, C, M){ floater(above(e, 2.7), e.fin.phase >= 2 ? 'ALL UNITS, ON ME' : 'PURGE SQUAD, ON ME', '#ffd27a'); S.windup(e.group.position, false); },
  update(e, C, M, dt){
    const c = MV.callIn, t = M.t;
    turnTo(e, C, dt, 4);
    leftArm(e, 0.7, dt); rightArm(e, -0.6, dt);
    const u = e.group.userData; if (u.head) u.head.rotation.x = damp(u.head.rotation.x, -0.25, dt, 6);   // a hand to the comm, head down
    signalGlow(e, ss(0, c.windup, t) * 0.6);
    if (t >= c.windup && !M.done){
      M.done = true;
      const list = c.troops[Math.min(c.troops.length, e.fin.phase) - 1];
      for (const tn in list) for (let i = 0; i < list[tn]; i++) queueSpawn(tn);
    }
    return t > c.windup + 0.3;
  },
  end(e){ const u = e.group.userData; if (u.head) u.head.rotation.x = 0; },
};
const flight = {
  id: 'flight',
  can: (e, C, F) => !G.sandbox && !C.hero.down,
  start(e, C, M){ floater(above(e, 2.7), 'PURGE FLIGHT, IN', '#ffd27a'); S.windup(e.group.position, false); },
  update(e, C, M, dt){
    const c = MV.flight, t = M.t;
    turnTo(e, C, dt, 4); leftArm(e, 0.8, dt); signalGlow(e, ss(0, c.windup, t) * 0.7);
    if (t >= c.windup && !M.done){ M.done = true; for (let i = 0; i < c.n; i++) queueSpawn('flyer'); }
    return t > c.windup + 0.3;
  },
};

/* ---------------- II: THE SIGNAL PULSE ---------------- */
// the ring going out (drawn the same on both co-op screens; the host's catches who it passes)
const ringGeo = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
const pulses = [];
function sendPulse(at, c, host, e){
  const m = new THREE.Mesh(ringGeo, additive(DEF.signalColor, 0.85));
  m.position.set(at.x, 0.12, at.z); m.renderOrder = 4; scene.add(m);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 48, 1, true).translate(0, 0.7, 0), additive(DEF.signalColor, 0.22));
  wall.position.copy(m.position); scene.add(wall);
  pulses.push({ m, wall, at: at.clone(), t: 0, c, host, e, got: new Set(), hit: new Set() });
}
function tickPulses(dt){
  for (let i = pulses.length - 1; i >= 0; i--){
    const P = pulses[i], c = P.c;
    P.t += dt;
    const r = 1.5 + P.t * c.spd, fade = 1 - ss(c.len * 0.7, c.len, r);
    P.m.scale.set(r, 1, r); P.m.material.opacity = 0.85 * fade;
    P.wall.scale.set(r, 1, r); P.wall.material.opacity = 0.22 * fade;
    if (P.host){
      for (const p of players){
        if (!p.here || p.down || P.hit.has(p)) continue;
        const d = Math.hypot(p.pos.x - P.at.x, p.pos.z - P.at.z);
        if (Math.abs(d - r) > c.w) continue;
        P.hit.add(p);
        if (p.local){
          if (player.dashT > 0 || p.pos.y > 1.2){ floater(playerPos(), 'EVADED', '#bfe8ff'); continue; }
          hurtHero(P.e, p, c.dmg, null, { unblockable: true, blast: true });
          floater(playerPos(), 'THE SIGNAL', '#d0a0ff');
        } else if (hooks.hurt) hooks.hurt(P.e, c.dmg, P.at, 'zap', true);
      }
      for (const a of allies){
        if (a.net || a.state === 'down' || P.got.has(a)) continue;
        const p = a.group.position, d = Math.hypot(p.x - P.at.x, p.z - P.at.z);
        if (Math.abs(d - r) > c.w) continue;
        P.got.add(a);
        a.turnT = G.gt + c.turn; a.turn = { dmg: c.turnDmg, every: c.turnEvery }; a.turnFire = 0.8;
        burst(V3(p.x, 1.6, p.z), DEF.signalColor, 10, 3, 2, 0.6);
        floater(V3(p.x, 2.6, p.z), 'TURNED · GET TO THEM', '#d0a0ff');
      }
    }
    if (r > c.len){ scene.remove(P.m, P.wall); P.m.material.dispose(); P.wall.material.dispose(); pulses.splice(i, 1); }
  }
}
function dropPulses(){ for (const P of pulses){ scene.remove(P.m, P.wall); } pulses.length = 0; }
// a turned squadmate: a violet halo over them; get to them (the host's hero, or a co-op partner on the host) and they snap out
const halos = new Map();
function tickTurned(){
  for (const a of allies){
    const on = a.turnT > G.gt && a.state !== 'down';
    let h = halos.get(a);
    if (on && !h){ h = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 20).rotateX(-Math.PI / 2), additive(DEF.signalColor, 0.9)); scene.add(h); halos.set(a, h); }
    if (!h) continue;
    h.visible = on;
    if (!on) continue;
    const p = a.group.position;
    h.position.set(p.x, 2.55 * (a.t.scale || 1), p.z); h.rotation.y = G.gt * 3; h.scale.setScalar(1 + 0.12 * Math.sin(G.gt * 8));
    for (const pl of players){
      if (!pl.here || pl.down) continue;
      if (a.turnT - G.gt < MV.signal.turn - MV.signal.grace && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < MV.signal.reach){ a.turnT = 0; h.visible = false; floater(V3(p.x, 2.4, p.z), 'SNAPPED OUT', '#7bffae'); S.reward && S.reward(0); break; }
    }
  }
}
function dropTurned(){ for (const [a, h] of halos){ scene.remove(h); a.turnT = 0; } halos.clear(); }
const signal = {
  id: 'signal',
  can: (e, C) => !C.hero.down,
  start(e, C, M){ floater(above(e, 2.8), 'THE SIGNAL', '#d0a0ff'); S.windup(e.group.position, true); e.hyper = true; },
  update(e, C, M, dt){
    const c = MV.signal, g = e.group, t = M.t;
    turnTo(e, C, dt, 3);
    // the wrist emitter up and out, the rig building to violet; the hum climbs
    leftArm(e, 1.25, dt, 6); rightArm(e, -0.5, dt);
    signalGlow(e, ss(0, c.windup, t));
    g.rotation.x = damp(g.rotation.x, -0.12 * ss(0, c.windup, t), dt, 6);
    if (Math.random() < 0.5 * ss(0, c.windup, t)) burst(above(e, 1.6), DEF.signalColor, 1, 2, 1.5, 0.6);
    if (t + dt >= c.windup - 0.35 && !M.told){ M.told = true; tellFx('dodge', g.position, 2.6, 0.35); }
    if (t < c.windup) return false;
    if (!M.sent){
      M.sent = true; M.open = true;
      const at = V3(g.position.x, 0, g.position.z);
      sendPulse(at, c, true, e);
      net('pulse', e, { x: r2(at.x), z: r2(at.z) });
      spawnGroundShock(V3(at.x, 0.1, at.z), DEF.signalColor, 3, 0.4, 0.9);
      S.zap(g.position); S.boom(g.position, 0.5); G.shake = Math.max(G.shake, 0.35);
    }
    signalGlow(e, 1 - ss(c.windup, c.windup + 0.8, t));
    return t > c.windup + 0.9;
  },
  end(e){ signalGlow(e, 0); e.group.rotation.x = 0; },
};

/* ---------------- III: BATON FLURRY ---------------- */
const flurry = {
  id: 'flurry',
  can: (e, C) => !mar(e).guns && C.dist < MV.flurry.maxDist && !C.hero.down,
  start(e, C, M){ M.i = 0; M.at = 0; M.hyper = true; e.hyper = true; floater(above(e, 2.6), 'BATON FLURRY', '#7ad8ff'); },
  update(e, C, M, dt){
    const c = MV.flurry, g = e.group, t = M.t;
    if (M.i >= c.hits.length){
      // the follow-through: a beat to punish him in
      M.open = true; rightArm(e, 0.2, dt, 6); batonGlow(e, 0.2);
      return t - M.at > c.open * 0.5;
    }
    const H = c.hits[M.i], s = t - M.at, k = s / H.t;
    turnTo(e, C, dt, 10);
    // each: the baton up and back (the arm past overhead), then down through the hero
    rightArm(e, k < 0.75 ? -2.5 * ss(0, 0.75, k) - 0.3 : 0.4, dt, k < 0.75 ? 14 : 30);
    g.rotation.y += (M.i % 2 ? 1 : -1) * 0.4 * dt * (k < 0.75 ? 1 : -4);   // a twist into the blow
    batonGlow(e, k);
    if (!M.told){ M.told = true; tellFx(H.parry ? 'parry' : 'area', g.position, H.parry ? 2.6 : 1.4, H.t * 0.7); if (H.parry) S.windup(g.position, true); }
    if (k < 1) return false;
    // the blow: a step into it, and whoever's in reach takes it
    g.position.x += C.tx * c.step; g.position.z += C.tz * c.step;
    if (g.userData.batonTip){ const tip = worldOf(g.userData.batonTip, _a); sparks(tip, DEF.batonColor, 8, 6, { up: 0.5 }); }
    S.zap(g.position); S.whoosh(g.position, H.parry);
    if (C.dist < c.reach + c.step){
      const r = hurtHero(e, C.hero, H.dmg, g.position.clone(), { melee: true, line: H.parry ? 'H' : (M.i % 2 ? 'L' : 'R') });
      if (H.parry && (r === 'parried' || r === 'clashed')){
        e.hyper = false;
        staggerEnemy(e, -C.tx, -C.tz, 'BATON TURNED'); e.st = c.open; e.openUntil = G.gt + c.open;
        return true;
      }
    }
    M.i++; M.at = t; M.told = false;
    return false;
  },
  end(e){ batonGlow(e, 0.2); },
};

/* ---------------- III: SHOULDER CHARGE ---------------- */
const tackle = {
  id: 'tackle',
  can: (e, C) => !mar(e).guns && C.dist > MV.tackle.minDist && C.dist < MV.tackle.maxDist && !C.hero.down,
  start(e, C, M){
    M.stage = 'tell'; M.dx = C.tx; M.dz = C.tz; M.len = C.dist + MV.tackle.over; e.hyper = true;
    tellFx('dodge', e.group.position, 2.4, MV.tackle.tell);
    floater(above(e, 2.6), 'SHOULDER CHARGE', '#ff6a5a');
    S.windup(e.group.position, true);
  },
  update(e, C, M, dt){
    const c = MV.tackle, g = e.group, t = M.t;
    if (M.stage === 'tell'){
      const k = t / c.tell;
      if (k < c.lockAt){ M.dx = C.tx; M.dz = C.tz; M.len = C.dist + c.over; }
      g.rotation.y = Math.atan2(M.dx, M.dz);
      g.rotation.x = damp(g.rotation.x, 0.25 * ss(0, 0.5, k), dt, 10);   // low, shoulder first
      e.kneel = 0.25 * ss(0, 0.5, k);
      paintLungeLine(e, g.position.x, g.position.z, g.rotation.y, M.len, k >= c.lockAt, k);
      if (hooks.lunge) hooks.lunge(e, g.position, g.rotation.y, M.len, k >= c.lockAt, k);
      if (t < c.tell) return false;
      M.stage = 'run'; M.go = 0; M.hit = false; e.kneel = 0;
      S.whoosh(g.position, true);
      return false;
    }
    if (M.stage === 'run'){
      const v = c.speed * dt, ox = g.position.x, oz = g.position.z;
      g.position.x += M.dx * v; g.position.z += M.dz * v; M.go += v;
      g.rotation.x = damp(g.rotation.x, 0.35, dt, 14);
      if (Math.random() < 0.7) burst(above(e, 0.2), 0xb09a7a, 1, 3, 1, 0.7);
      const pp = C.pp;
      if (!M.hit && Math.abs(pp.y - g.position.y) < 2){
        const sx = g.position.x - ox, sz = g.position.z - oz, sl = sx * sx + sz * sz || 1;
        const k = clamp(((pp.x - ox) * sx + (pp.z - oz) * sz) / sl, 0, 1);
        if (Math.hypot(pp.x - (ox + sx * k), pp.z - (oz + sz * k)) < c.hitR){
          M.hit = true;
          const r = hurtHero(e, C.hero, c.dmg, g.position.clone(), { melee: true, unblockable: true, line: 'H', noClash: true });
          if (r === 'parried' || r === 'clashed'){   // turned off the line: he goes down past you, open
            dropLungeLine(e); e.hyper = false;
            staggerEnemy(e, -M.dx, -M.dz, 'CHARGE TURNED'); e.st = 1.6; e.openUntil = G.gt + 1.6;
            return true;
          }
          if (r === 'hit' && C.hero.local){ player.vel.x += M.dx * c.knock; player.vel.z += M.dz * c.knock; player.vel.y = Math.max(player.vel.y, 4); G.shake = Math.max(G.shake, 0.5); }
        }
      }
      const moved = Math.hypot(g.position.x - ox, g.position.z - oz);
      if (M.go < M.len && !(M.go > 2 && moved < v * 0.3)) return false;
      dropLungeLine(e);
      if (M.hit){ M.stage = 'done'; M.at = t; return false; }
      // a miss: he stumbles out of it, open
      M.stage = 'stumble'; M.at = t; M.open = true; e.hyper = false;
      floater(above(e, 2.5), 'STUMBLED — OPEN', '#ffe27a'); S.slam(g.position);
      return false;
    }
    if (M.stage === 'stumble'){
      const s = t - M.at;
      e.kneel = 0.45 * (1 - ss(c.stumble - 0.4, c.stumble, s)); e.legMode = 'off';
      g.rotation.x = damp(g.rotation.x, 0.3 * (1 - ss(c.stumble - 0.4, c.stumble, s)), dt, 8);
      return s > c.stumble;
    }
    g.rotation.x = damp(g.rotation.x, 0, dt, 8);
    return t - M.at > 0.45;
  },
  end(e){ dropLungeLine(e); e.kneel = 0; e.legMode = null; e.group.rotation.x = 0; },
};

/* ---------------- III: THE LAST STAND (once) ---------------- */
const lastStand = {
  id: 'lastStand', urgent: true, once: true,
  can: (e, C, F) => F.phase >= 3 && e.hp / e.maxHp <= MV.lastStand.at && !C.hero.down,
  start(e, C, M){
    e.fin.used.lastStand = true; e.hyper = true; M.stage = 'wind';
    floater(playerPos(), 'LAST STAND', '#ffae2a');
    S.roar(e.group.position);
    G.slowmo = 0.6; G.slowmoT = Math.max(G.slowmoT, 0.5);
    tellFx('area', e.group.position, MV.lastStand.r, MV.lastStand.windup);
  },
  update(e, C, M, dt){
    const c = MV.lastStand, g = e.group, t = M.t;
    if (M.stage === 'wind'){
      const k = t / c.windup;
      turnTo(e, C, dt, 4);
      rightArm(e, -2.7 * ss(0, 0.6, k), dt, 10); batonGlow(e, 0.5 + 0.5 * k);
      e.flipY = 1.2 * Math.sin(ss(0.55, 1, k) * Math.PI);   // up off the floor at the end of it
      if (Math.random() < k) sparks(above(e, 2.6), DEF.batonColor, 1, 4, { up: 1 });
      if (k < 1) return false;
      // the slam: the baton into the floor, the charge out round him
      M.stage = 'down'; M.at = t; e.flipY = 0; e.hyper = false;
      rightArm(e, 0.5, 1);
      const at = V3(g.position.x, 0, g.position.z);
      spawnGroundShock(V3(at.x, 0.1, at.z), DEF.batonColor, c.r, 0.5, 1);
      spawnGroundShock(V3(at.x, 0.1, at.z), 0xffffff, c.r * 0.6, 0.3, 0.8);
      sparks(V3(at.x, 0.3, at.z), DEF.batonColor, 24, 12, { up: 1 });
      S.slam(at); S.zap(at); S.boom(at, 0.8); G.shake = Math.max(G.shake, 0.8);
      areaHit(e, at, c.r, c.dmg, c.knock);
      net('slam', e, { x: r2(at.x), z: r2(at.z), r: c.r });
      e.openUntil = G.gt + c.open;
      floater(above(e, 2.6), 'SPENT — OPEN', '#ffe27a');
      return false;
    }
    const s = t - M.at;
    M.open = true;
    e.kneel = 0.7 * (1 - ss(c.open - 0.5, c.open, s)); e.legMode = 'off';
    g.rotation.x = damp(g.rotation.x, 0.3 * (1 - ss(c.open - 0.5, c.open, s)), dt, 6);
    batonGlow(e, 0.15);
    return s > c.open;
  },
  end(e){ e.flipY = 0; e.kneel = 0; e.legMode = null; e.group.rotation.x = 0; },
};

/* ---------------- what changes on him as the phases turn ---------------- */
// phase III: the guns go down on the floor; the baton comes off his back, and his body fights close (a melee foe)
const dropped = [];
function dropGuns(e, onGuest){
  const g = e.group, u = g.userData;
  mar(e).guns = false;
  if (u.pistolR && u.pistolR.visible){
    for (const [i, slot] of [u.pistolR, u.pistolL].entries()){
      if (!slot) continue;
      const p = slot.clone(true);
      p.scale.setScalar(g.scale.x * 1.1);
      const a = g.rotation.y + (i ? 1.2 : -1.2);
      p.position.set(g.position.x + Math.sin(a) * 1.4, 0.08, g.position.z + Math.cos(a) * 1.4);
      p.rotation.set(Math.PI / 2, 0, rand(0, Math.PI * 2));
      scene.add(p); dropped.push(p);
    }
  }
  holding(e, false);
  if (onGuest) return;
  const m = DEF.melee;
  Object.assign(e.t, { ranged: false, range: m.range, windup: m.windup, recover: m.recover, swing: m.swing, standoff: 0, dmg: e.t.dmg * m.dmgMul });
}
const look = {
  spawn(e){ mar(e); holding(e, true); signalGlow(e, 0); batonGlow(e, 0.2); },
  damage: damageRule,
  phase(e, p, onGuest){
    if (p >= 2){ signalGlow(e, 0.6); burst(above(e, 1.6), DEF.signalColor, 16, 5, 3, 0.8); }
    if (p >= 3){
      dropGuns(e, onGuest);
      sparks(above(e, 1.4), DEF.batonColor, 14, 8, { up: 1 }); S.zap(e.group.position);
      if (!onGuest) floater(above(e, 3.0), 'HE DROPS THE GUNS', '#7ad8ff');
    }
  },
  beatStart(e){ hideLane(); signalGlow(e, 0); },
  beatPose(e, M, t){ signalGlow(e, 0.5 + 0.5 * Math.sin(t * 14)); },
  defeatStart(e){ hideLane(); dropPulses(); dropTurned(); S.slam(e.group.position); },
  defeatPose(e, M, t){ signalGlow(e, Math.max(0, 0.6 - t * 0.3)); batonGlow(e, Math.max(0, 0.6 - t * 0.3)); rightArm(e, 0.5, 1 / 60, 4); },
  frame(e, dt){
    tickPulses(dt); tickTurned();
    const M = mar(e), F = e.fin;
    // how long the hero has crowded him (the roll answers it)
    const pp = playerPos(), close = Math.hypot(pp.x - e.group.position.x, pp.z - e.group.position.z) < MV.roll.crowd;
    M.closeT = !F.sig && M.guns && close ? M.closeT + dt : Math.max(0, M.closeT - dt * 2);
    if (!F.sig && !F.over){ signalGlow(e, F.phase >= 2 ? 0.35 : 0); if (!M.guns) batonGlow(e, 0.45); }
  },
  teardown(){ hideLane(); dropPulses(); dropTurned(); for (const p of dropped) scene.remove(p); dropped.length = 0; guest.lane = null; },
  // co-op guest: the host's move effects
  netFx(m, e){
    if (m.k === 'pulse') sendPulse(V3(m.x, 0, m.z), MV.signal, false, e);
    else if (m.k === 'lane') guest.lane = m.on ? e : null;
    else if (m.k === 'slam'){ spawnGroundShock(V3(m.x, 0.1, m.z), DEF.batonColor, m.r, 0.5, 1); sparks(V3(m.x, 0.3, m.z), DEF.batonColor, 24, 12, { up: 1 }); S.slam(V3(m.x, 0, m.z)); }
    if (m.k !== 'lane' && guest.lane == null) hideLane();
  },
  guestFrame(e, dt){
    tickPulses(dt);
    if (guest.lane === e && !e.dead) showLane(e, e.group.rotation.y, MV.suppress.lane, 0.22 + 0.08 * Math.sin(G.gt * 30)); else hideLane();
  },
};
const guest = { lane: null };

registerFinale(MARSHAL_BOSS, { suppress, grenade, roll, callIn, flight, signal, flurry, tackle, lastStand }, look);
