// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// INFILTRATE: the stealth objective (data/infiltrate.js has the numbers and the words; an objective of kind 'infiltrate'
// in data/missions.js lays out the ground). Guards walk their beats (enemies/patrol.js), cameras sweep, searchlights rake
// the floor, each with a cone of sight drawn on the ground. Reach and work every mark; being seen fills the ALARM meter,
// and a full one turns every guard on you and calls more in. It never fails the mission.
//
//   { kind: 'infiltrate', title, say, task,
//     marks: [{ at: [x, z], name? }]   the spots to reach and work (any order) · time: seconds on each · r: how close
//     markName / markDone               what one is called ('SEAL') and its floater when done ('BROKEN')
//     guards: [{ type, path: [[x, z]…], pause?, spd? } | { type, at: [x, z], face, sweep?, period? }]   a beat, or a post
//     cams: [{ at: [x, z], y, yaw, sweep, period, ph? }]       a camera on a pole, its head swinging yaw ± sweep
//     lights: [{ from: [x, y, z], c: [x, z], a: [ax, az], period, ph }]   searchlights (game/twists/searchlight.js's sweep)
//     alarm: { group, at: [[x, z]…], line, trickle: { every, cap, group } }   who comes when it goes up, and after
//     quiet: [banner, sub] when it's done without being seen }
//
// HOST runs it all (KIND below, from game/mission.js). A CO-OP GUEST draws the same cones from the host's foes and its
// clock (snap / guestFrame below: the meter and whether the alarm is up ride in every snapshot, so a hero who joins late
// sees it as it is), and its hero's F goes to the host (net/foefire.js 'snk') to be done there.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { G, player, enemies, heroKey } from '../state.js';
import { V3 } from '../utils.js';
import { playerPos } from '../player/helpers.js';
import { players, targetable } from '../player/players.js';
import { damageEnemy } from '../enemies/damage.js';
import { unaware } from '../enemies/patrol.js';
import { squadHoldBack, allies } from '../allies/squad.js';
import { showBanner, bannerTap } from '../ui/banners.js';
import { floater } from '../fx/floaters.js';
import { burst } from '../fx/particles.js';
import { sfx, S } from '../audio/sfx.js';
import { hooks } from '../net/run.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { onInteract, INTERACT_KEY } from './interact.js';
import { medalNote } from './medals.js';
import { setObjectiveHud, pulseMarker, setMarkerColor } from './objectives.js';
import { INFIL, INFIL_TEXT } from '../data/infiltrate.js';

const CALM = 0xd8e4f0, WARY = 0xffb040, RED = 0xff3a2a, GREEN = 0x7bffae;
const r2 = (n) => Math.round(n * 100) / 100;

// what game/mission.js lends it: spawning, the markers, sight lines, the mission's harder-from-now flag
let K = null;
export function setInfiltrateKit(kit){ K = kit; }

// the live objective, on this screen: I.s is the host's state (M.s) or the guest's own copy
const I = { on: false, o: null, s: null, guest: false, props: [], cones: new Map(), cams: [], lights: [], smokes: new Map(),
            act: null, cd: 0, el: null, shown: '', t: 0, net: null, synced: false, wasAlarm: false, coneT: 0 };

/* ---------------- meshes ---------------- */
const glow = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending,
  depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
function own(m){ m.userData.noBake = true; m.frustumCulled = false; scene.add(m); I.props.push(m); return m; }
// a sight cone flat on the floor: a fan of RAYS edges from its apex, each ray's length set as walls cut it short
const RAYS = 14;
function coneMesh(){
  const geo = new THREE.BufferGeometry(), pos = new Float32Array((RAYS + 2) * 3), idx = [];
  for (let k = 1; k <= RAYS; k++) idx.push(0, k, k + 1);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  const m = own(new THREE.Mesh(geo, glow(CALM, 0.26)));
  m.renderOrder = 3; m.position.y = 0.06;
  return m;
}
// lay a cone at (x, z) facing yaw: each ray as far as it sees from height `eye` (the same test the guards use)
function layCone(m, x, z, yaw, range, fov, eye, clip){
  const p = m.geometry.attributes.position.array;
  p[0] = x; p[1] = 0; p[2] = z;
  for (let k = 0; k <= RAYS; k++){
    const a = yaw - fov + 2 * fov * k / RAYS, dx = Math.sin(a), dz = Math.cos(a);
    let d = range;
    if (clip && sightCut(x, eye, z, x + dx * range, z + dz * range)){
      let lo = 0, hi = range;
      for (let it = 0; it < 5; it++){ const mid = (lo + hi) / 2; if (sightCut(x, eye, z, x + dx * mid, z + dz * mid)) hi = mid; else lo = mid; }
      d = lo;
    }
    const j = (k + 1) * 3; p[j] = x + dx * d; p[j + 1] = 0; p[j + 2] = z + dz * d;
  }
  m.geometry.attributes.position.needsUpdate = true;
  m.geometry.computeBoundingSphere();
}
const sightCut = (ax, ay, az, bx, bz) => !!(K && K.sightBlocked(ax, ay, az, bx, INFIL.body, bz)) || smokeCut(ax, az, bx, bz);
function camMesh(c){
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, c.y, 6), new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.6, metalness: 0.6 }));
  pole.position.y = c.y / 2;
  const head = new THREE.Group(); head.position.y = c.y;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.5, metalness: 0.7 }));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }));
  lens.position.z = 0.26;
  head.add(box, lens); g.add(pole, head);
  g.position.set(c.at[0], 0, c.at[1]);
  g.userData.head = head; g.userData.lens = lens;
  return own(g);
}
function smokeMesh(){
  const m = own(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, transparent: true, opacity: 0.55, roughness: 1, depthWrite: false })));
  m.renderOrder = 2; return m;
}
function lightMeshes(){
  const disc = own(new THREE.Mesh(new THREE.CircleGeometry(1, 32), glow(0xfff0c0, 0.28))); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.07;
  return { disc };
}

/* ---------------- who's where, and who sees whom ---------------- */
const heroesOut = () => players.filter(h => h.local ? player.hp > 0 && !player.downed : targetable(h));
// where a camera is looking now, and where a searchlight's spot is (t: the objective's clock, the same on every screen)
const camYaw = (c, t) => (c.yaw || 0) + Math.sin(t * Math.PI * 2 / (c.period || 8) + (c.ph || 0)) * (c.sweep ?? 0.8);
function spotAt(b, t){
  const w = Math.PI * 2 / (b.period || 12), u = t * w + (b.ph || 0);
  return [b.c[0] + b.a[0] * Math.sin(u), b.c[1] + b.a[1] * Math.sin(2 * u + 0.6)];
}
// smoke: a line through one, or a hero inside one, can't be seen
function smokeCut(ax, az, bx, bz){
  for (const sm of smokesNow()){
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((sm.x - ax) * dx + (sm.z - az) * dz) / l2));
    if (Math.hypot(ax + dx * u - sm.x, az + dz * u - sm.z) < sm.r) return true;
  }
  return false;
}
const smokesNow = () => I.guest ? (I.net && I.net.sm ? I.net.sm.map(w => ({ x: w[0], z: w[1], r: INFIL.smoke.r * Math.min(1, w[2] / 1.5) })) : [])
  : I.s && I.s.smokes ? I.s.smokes.map(sm => ({ x: sm.x, z: sm.z, r: INFIL.smoke.r * Math.min(1, sm.t / 1.5) })) : [];
// can an eye at (x, eye, z) facing yaw see hero position p within range and fov? 0 when not, else how close (0..1]
function sees(x, eye, z, yaw, range, fov, p){
  const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
  if (d > range) return 0;
  const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw));
  if (Math.abs(off) > fov && d > 1.2) return 0;   // (right up against him he notices whichever way he faces)
  if (K && K.sightBlocked(x, eye, z, p.x, (p.y || 0) + INFIL.body, p.z)) return 0;
  if (smokeCut(x, z, p.x, p.z)) return 0;
  return 1 - d / range * 0.85;
}

/* ---------------- the objective, on the host ---------------- */
function spawnGuard(gd){
  const P = gd.path, at = P ? P[0] : gd.at;
  const e = K.fieldSpawn(gd.type || 'blaster', at[0], at[1]);
  if (!e) return null;
  e.state = 'chase'; e.st = 0; e.group.position.y = 0;
  const g = e.group;
  if (P && P.length > 1) g.rotation.y = Math.atan2(P[1][0] - P[0][0], P[1][1] - P[0][1]);
  else if (gd.face != null) g.rotation.y = gd.face;
  e.patrol = { pts: P ? P.map(p => [p[0], p[1]]) : [[g.position.x, g.position.z]], k: P && P.length > 1 ? 1 : 0, dir: 1, wait: 0,
               pause: gd.pause ?? INFIL.pause, spd: gd.spd ?? INFIL.walk, face: gd.face ?? null, sweep: gd.sweep, period: gd.period, look: null, alert: false };
  return e;
}
function alertGuard(e){ if (e && e.patrol && !e.patrol.alert){ e.patrol.alert = true; e.patrol.look = null; e.state = 'chase'; } }
function begin(o, s){
  I.on = true; I.o = o; I.s = s; I.guest = false; I.t = 0; I.synced = true; I.wasAlarm = false;
  const col = K.color();
  s.marks = (o.marks || []).map(mk => {
    const m = K.beacon(mk.at[0], mk.at[1], col, (o.r ?? INFIL.r) / 0.9);
    return { x: mk.at[0], z: mk.at[1], prog: 0, done: false, m, name: mk.name };
  });
  s.guards = (o.guards || []).map(spawnGuard).filter(Boolean);
  s.alarm = 0; s.alarmed = false; s.seen = false; s.smokes = []; s.smokeLeft = INFIL.smoke.n; s.t = 0; s.trickT = 0; s.nSmoke = 0;
  buildFixed(o);
  if (allies.length) squadHoldBack(true);   // the squad waits while you go in (allies/squad.js)
  teach();
}
// the cameras and lights (both screens build their own from the objective)
function buildFixed(o){
  I.cams = (o.cams || []).map(c => ({ c, g: camMesh(c), cone: coneMesh() }));
  I.lights = (o.lights || []).map(b => ({ b, ...lightMeshes() }));
}
function teach(){
  const tap = bannerTap.fn; bannerTap.fn = null;   // (each screen teaches its own hero's way: not mirrored to the guest)
  try { showBanner('', INFIL_TEXT.teach[G.hero] || INFIL_TEXT.teach.jedi, 5.5); } finally { bannerTap.fn = tap; }
}
function raiseAlarm(o, s){
  if (s.alarmed) return;
  s.alarmed = true; s.alarm = 1; s.seen = true; medalNote('seen');
  for (const e of s.guards) alertGuard(e);
  const al = o.alarm || {}, grp = al.group || INFIL.alarmGroup, at = al.at || [];
  let k = 0;
  for (const t in grp) for (let n = 0; n < grp[t]; n++){
    const p = at.length ? at[k++ % at.length] : null;
    const e = p ? K.fieldSpawn(t, p[0] + (Math.random() - 0.5) * 1.2, p[1] + (Math.random() - 0.5) * 1.2) : K.edgeSpawn(t);
    if (e) e.state = 'chase';
  }
  K.setAlarmed();   // the rest of the mission sends more (game/mission.js queueGroup)
  if (allies.length) squadHoldBack(false);   // no use hiding now: the squad comes up
  showBanner(INFIL_TEXT.alarm, al.line ? heroKey(al.line) || al.line : INFIL_TEXT.alarmSub, 2.6, { kicker: 'SEEN' });
  siren();
}
function siren(){ sfx(880, 0.45, 'square', 0.05, 620); sfx(620, 0.45, 'square', 0.04, 880); setTimeout(() => sfx(880, 0.45, 'square', 0.04, 620), 480); }

function update(o, s, dt){
  s.t += dt; I.t = s.t;
  for (const sm of s.smokes) sm.t -= dt;
  s.smokes = s.smokes.filter(sm => sm.t > 0);
  // a guard hurt but still up shouts: he turns on you, and the meter jumps
  for (const e of s.guards){
    if (e.dead || !e.patrol || e.patrol.alert) continue;
    if (e.hp < e.maxHp - 0.01){ alertGuard(e); if (!s.alarmed){ s.alarm = Math.min(1, s.alarm + INFIL.hurt); } }
  }
  // who sees whom
  let fill = 0;
  const hs = heroesOut();
  for (const e of s.guards) e.seeing = 0;
  if (!s.alarmed){
    for (const h of hs){
      const p = h.pos;
      for (const e of s.guards){
        if (!unaware(e)) continue;
        const g = e.group.position, w = sees(g.x, INFIL.eye, g.z, e.group.rotation.y, INFIL.range, INFIL.fov, p);
        if (w > 0){ e.seeing = 1; fill = Math.max(fill, w); e.patrol.look = { x: p.x, z: p.z, t: INFIL.look }; }
      }
      for (const c of o.cams || []){
        const w = sees(c.at[0], c.y || 3, c.at[1], camYaw(c, s.t), INFIL.camRange, INFIL.camFov, p);
        if (w > 0) fill = Math.max(fill, w);
      }
      for (const b of o.lights || []){
        const [x, z] = spotAt(b, s.t);
        if (Math.hypot(p.x - x, p.z - z) < (b.r ?? 3.4) && !smokeCut(x, z, x, z)) fill = Math.max(fill, 1);
      }
    }
    if (fill > 0) s.alarm = Math.min(1, s.alarm + dt / INFIL.fill * (1 + (INFIL.closeMul - 1) * fill));
    else s.alarm = Math.max(0, s.alarm - INFIL.drain * dt);
    if (s.alarm >= INFIL.spot && !s.seen){
      s.seen = true; medalNote('seen');
      showBanner(INFIL_TEXT.spotted, INFIL_TEXT.spottedSub, 1.8);
      sfx(660, 0.25, 'square', 0.04, 990);
    }
    if (s.alarm >= 1) raiseAlarm(o, s);
  } else {
    // after the alarm: they keep coming, a few at a time
    const tr = o.alarm && o.alarm.trickle;
    if (tr && (s.trickT -= dt) <= 0){ s.trickT = tr.every; if (K.hostiles() < tr.cap) K.queue(tr.group); }
  }
  s.fill = fill;
  // the marks: stand on one to work it; it slips back slowly while nobody's on it
  const r = o.r ?? INFIL.r, time = o.time ?? INFIL.time;
  let done = 0, part = 0;
  for (const mk of s.marks){
    if (mk.done){ done++; continue; }
    const on = hs.some(h => Math.hypot(h.pos.x - mk.x, h.pos.z - mk.z) < r);
    mk.prog = on ? mk.prog + dt : Math.max(0, mk.prog - dt * 0.3);
    if (on && Math.floor(mk.prog * 4) !== Math.floor((mk.prog - dt) * 4)) sfx(520 + mk.prog * 90, 0.03, 'square', 0.015, 600);
    pulseMarker(mk.m, dt, G.gt); mk.m.userData.beam.visible = !on;
    part = Math.max(part, mk.prog / time);
    if (mk.prog >= time){
      mk.done = true; done++;
      setMarkerColor(mk.m, GREEN); mk.m.userData.beam.visible = false; mk.m.userData.done = true;
      burst(V3(mk.x, 1.0, mk.z), GREEN, 12, 5, 3, 0.7); S.reward(1);
      floater(V3(mk.x, 1.8, mk.z), (mk.name || o.markName || 'MARK') + ' ' + (o.markDone || 'DONE'), '#7bffae');
    }
  }
  const n = s.marks.length || 1;
  const state = s.alarmed ? INFIL_TEXT.alarm : s.alarm > 0.02 ? (s.seen ? INFIL_TEXT.seen : INFIL_TEXT.searching) + ' · ' + Math.round(s.alarm * 100) + '%' : s.seen ? INFIL_TEXT.seen : INFIL_TEXT.unseen;
  setObjectiveHud({ kicker: K.kick(), title: o.title, frac: (done + Math.min(0.99, part)) / n,
    status: state + ' · ' + done + ' / ' + n + ' ' + (o.markName ? o.markName + (n > 1 ? 'S' : '') : 'DONE'), warn: s.alarmed || s.alarm > 0.02 });
  drawFrame(dt, s.t, s.guards.filter(e => !e.dead && enemies.includes(e)).map(e => ({ e, aware: !unaware(e), seeing: e.seeing })), s.alarmed, s.alarm);
  if (done >= n){
    if (!s.seen){ const q = o.quiet || [INFIL_TEXT.quiet, INFIL_TEXT.quietSub]; showBanner(q[0], q[1] || '', 2.2); }
    return true;
  }
  return false;
}

/* ---------------- what both screens draw ---------------- */
// guards: [{ e, aware, seeing }] · the cones go red with the alarm up and then fade out (they've stopped looking: they're hunting)
function drawFrame(dt, t, guards, alarmed, meter){
  I.coneT -= dt;
  const tick = I.coneT <= 0; if (tick) I.coneT = 0.1;   // (the cameras' cones, cut by the walls, ten times a second)
  const seen = new Set();
  for (const { e, aware, seeing } of guards){
    seen.add(e);
    let c = I.cones.get(e);
    if (!c){ c = { m: coneMesh(), x: 1e9, z: 0, y: 0 }; I.cones.set(e, c); }
    const g = e.group.position, yaw = e.group.rotation.y;
    c.m.visible = !aware && !alarmed;
    if (!c.m.visible) continue;
    // laid again (cut by the walls) when he has moved or turned, at most twenty times a second
    c.t = (c.t || 0) - dt;
    if (c.t <= 0 && (Math.hypot(g.x - c.x, g.z - c.z) > 0.1 || Math.abs(yaw - c.y) > 0.03)){ c.t = 0.05; layCone(c.m, g.x, g.z, yaw, INFIL.range, INFIL.fov, INFIL.eye, true); c.x = g.x; c.z = g.z; c.y = yaw; }
    c.m.material.color.setHex(seeing ? WARY : CALM);
    c.m.material.opacity = seeing ? 0.42 : 0.26;
  }
  for (const [e, c] of I.cones) if (!seen.has(e)){ scene.remove(c.m); c.m.geometry.dispose(); c.m.material.dispose(); I.props = I.props.filter(p => p !== c.m); I.cones.delete(e); }
  for (const C of I.cams){
    const yaw = camYaw(C.c, t);
    C.g.userData.head.rotation.y = yaw;
    C.cone.visible = !alarmed;
    C.g.userData.lens.material.color.setHex(alarmed ? RED : meter > 0.02 ? WARY : 0xff6050);
    if (C.cone.visible){ if (tick) layCone(C.cone, C.c.at[0], C.c.at[1], yaw, INFIL.camRange, INFIL.camFov, C.c.y || 3, true); C.cone.material.color.setHex(meter > 0.02 ? WARY : CALM); }
  }
  for (const L of I.lights){
    const [x, z] = spotAt(L.b, t), r = L.b.r ?? 3.4;
    L.disc.position.set(x, 0.07, z); L.disc.scale.setScalar(r);
    L.disc.material.color.setHex(alarmed ? RED : 0xfff0c0);
  }
  // smoke
  const live = new Set();
  for (const sm of smokesNow()){
    const key = Math.round(sm.x * 10) + ',' + Math.round(sm.z * 10);
    live.add(key);
    let m = I.smokes.get(key);
    if (!m){ m = smokeMesh(); I.smokes.set(key, m); burst(V3(sm.x, 0.8, sm.z), 0xc8ccd4, 18, 4, 3, 1.2); }
    m.position.set(sm.x, sm.r * 0.45, sm.z); m.scale.set(sm.r, sm.r * 0.7, sm.r);
  }
  for (const [k, m] of I.smokes) if (!live.has(k)){ scene.remove(m); I.props = I.props.filter(p => p !== m); I.smokes.delete(k); }
}

/* ---------------- each hero's way: F ---------------- */
const nidGuards = () => I.guest ? (I.net && I.net.g ? I.net.g.filter(w => !w[1]).map(w => K.puppet(w[0])).filter(e => e && !e.dead) : [])
  : I.s && I.s.guards ? I.s.guards.filter(e => unaware(e) && enemies.includes(e)) : [];
function pickAct(){
  if (!I.on || G.mode !== 'play' || G.paused || player.downed || (I.s && I.s.alarmed) || (I.guest && I.net && I.net.al)) return null;
  const p = playerPos(), hero = G.hero;
  if (hero === 'trooper'){
    const left = I.guest ? (I.net ? I.net.sl : 0) : I.s.smokeLeft;
    return left > 0 && I.cd <= 0 ? { a: 's', x: p.x, z: p.z, left } : null;
  }
  const gs = nidGuards();
  if (hero === 'mando'){
    const T = INFIL.takedown;
    let best = null, bd = T.reach;
    for (const e of gs){
      const g = e.group.position, d = Math.hypot(p.x - g.x, p.z - g.z);
      if (d > bd) continue;
      const off = Math.atan2(Math.sin(Math.atan2(p.x - g.x, p.z - g.z) - e.group.rotation.y), Math.cos(Math.atan2(p.x - g.x, p.z - g.z) - e.group.rotation.y));
      if (Math.abs(off) < T.behind) continue;   // he'd see you coming
      best = e; bd = d;
    }
    return best ? { a: 't', e: best } : null;
  }
  // the Jedi: the guard nearest the middle of the view, in reach and in sight, not already looking at something
  const D = INFIL.distract;
  if (player.force < D.force || I.cd > 0) return null;
  let best = null, bs = 0.55;
  for (const e of gs){
    const g = e.group.position, d = Math.hypot(p.x - g.x, p.z - g.z);
    if (d > D.reach || d < 1.5) continue;
    const off = Math.abs(Math.atan2(Math.sin(Math.atan2(g.x - p.x, g.z - p.z) - G.yaw), Math.cos(Math.atan2(g.x - p.x, g.z - p.z) - G.yaw)));
    if (off > bs || (K && K.sightBlocked(p.x, 1.5, p.z, g.x, 1.2, g.z))) continue;
    best = e; bs = off;
  }
  return best ? { a: 'd', e: best } : null;
}
function doAct(act){
  if (!act) return false;
  if (act.a === 'd'){ player.force = Math.max(0, player.force - INFIL.distract.force); I.cd = INFIL.distract.cd; }
  if (act.a === 's') I.cd = INFIL.smoke.cd;
  const p = playerPos();
  if (I.guest){
    if (hooks.sneak) hooks.sneak({ a: act.a, n: act.e ? act.e.nid : null, x: r2(p.x), z: r2(p.z) });
    feel(act, p);
    return true;
  }
  sneakAct(act.a, act.e, p.x, p.z);
  return true;
}
// a co-op guest's F, done on the host
export function sneakFromGuest(m){
  if (!I.on || I.guest || !m) return;
  const e = m.n != null ? I.s.guards.find(g => g.nid === m.n) : null;
  if (m.a !== 's' && !unaware(e)) return;
  sneakAct(m.a, e, m.x, m.z, true);
}
function sneakAct(a, e, hx, hz, remote){
  const s = I.s;
  if (a === 's'){
    if (s.smokeLeft <= 0){ if (!remote) showBanner('', INFIL_TEXT.noSmoke, 0.9); return; }
    s.smokeLeft--; s.smokes.push({ x: hx, z: hz, t: INFIL.smoke.time });
    if (!remote) feel({ a }, { x: hx, z: hz });
    return;
  }
  if (!unaware(e)) return;
  const g = e.group.position;
  if (a === 'd'){
    // something behind him, away from you: he turns to look at it
    const dx = g.x - hx, dz = g.z - hz, d = Math.hypot(dx, dz) || 1, lx = g.x + dx / d * 4.5, lz = g.z + dz / d * 4.5;
    e.patrol.look = { x: lx, z: lz, t: INFIL.distract.time };
    burst(V3(lx, 0.6, lz), 0x9ad8ff, 10, 3, 2, 0.6);
    floater(V3(g.x, 2.3, g.z), '?', '#ffd27a');
    if (!remote) feel({ a }, { x: hx, z: hz });
    return;
  }
  if (a === 't'){
    const dx = g.x - hx, dz = g.z - hz, d = Math.hypot(dx, dz) || 1;
    if (d > INFIL.takedown.reach + 1) return;
    e.patrol.quiet = true;
    damageEnemy(e, 1e5, V3(dx / d, 0, dz / d), 1.5);
    floater(V3(g.x, 2.1, g.z), INFIL_TEXT.down, '#c8d2dc');
    sfx(160, 0.12, 'triangle', 0.05, 90);
    if (!remote) feel({ a }, { x: hx, z: hz });
  }
}
// this screen's own feel of it
function feel(act, p){
  if (act.a === 'd'){ sfx(420, 0.18, 'sine', 0.03, 760); }
  else if (act.a === 's'){ sfx(240, 0.4, 'sawtooth', 0.02, 120); burst(V3(p.x, 0.5, p.z), 0xd0d4dc, 14, 4, 2, 0.9); }
  else if (act.a === 't'){ sfx(140, 0.1, 'triangle', 0.05, 80); }
}
onInteract(() => { const a = I.act || pickAct(); if (!a) return false; I.act = null; return doAct(a); }, () => !!I.act);
function updatePrompt(dt){
  if (I.cd > 0) I.cd -= dt;
  I.act = pickAct();
  const el = I.el || (I.el = document.getElementById('sneakp'));
  if (!el) return;
  const words = I.act ? INFIL_TEXT.verb[G.hero] + (I.act.a === 's' ? ' · ' + I.act.left : '') : '';
  const key = words + (pad.active ? 'p' : 'k');
  if (key === I.shown) return;
  I.shown = key;
  if (words) el.innerHTML = '<kbd>' + (pad.active ? padKeys(INTERACT_KEY) : INTERACT_KEY) + '</kbd><span>' + words + '</span>';
  el.classList.toggle('on', !!words);
}

/* ---------------- the kind, as game/mission.js runs it ---------------- */
export const INFILTRATE = {
  cue: 'infiltrate',
  music: (o, s) => ({ urgency: s.alarmed ? 1 : s.alarm || 0, danger: !!s.alarmed, focus: !s.alarmed }),
  begin,
  update(o, s, dt){ const done = update(o, s, dt); updatePrompt(dt); return done; },
};
export function infiltrateFrac(o, s){
  if (!s || !s.marks) return 0;
  return s.marks.filter(m => m.done).length / Math.max(1, s.marks.length);
}
// the objective's over (done, a retry, the mission left): its cones, cameras and smoke go, and the squad comes up
export function endInfiltrate(){
  if (!I.on && !I.props.length) return;
  for (const m of I.props){ scene.remove(m); m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  I.props = []; I.cones.clear(); I.cams = []; I.lights = []; I.smokes.clear();
  if (!I.guest && I.on && allies.length) squadHoldBack(false);
  Object.assign(I, { on: false, o: null, s: null, guest: false, act: null, net: null, synced: false, wasAlarm: false, shown: '' });
  const el = I.el || document.getElementById('sneakp'); if (el) el.classList.remove('on');
}

/* ---------------- co-op ---------------- */
// host: what a guest needs to draw it, every snapshot (the meter and the alarm are state here, never only a banner)
export function infiltrateSnap(){
  const s = I.on && !I.guest ? I.s : null;
  if (!s || !s.guards) return undefined;
  return { t: r2(s.t), a: r2(s.alarm), al: s.alarmed ? 1 : 0, sn: s.seen ? 1 : 0, sl: s.smokeLeft,
           g: s.guards.filter(e => !e.dead && enemies.includes(e)).map(e => [e.nid, unaware(e) ? 0 : 1, e.seeing ? 1 : 0]),
           sm: s.smokes.map(sm => [r2(sm.x), r2(sm.z), r2(sm.t)]) };
}
// guest: the objective began on the host
export function infiltrateGuestBegin(o){
  endInfiltrate();
  I.on = true; I.o = o; I.s = null; I.guest = true; I.t = 0; I.synced = false; I.wasAlarm = false;
  buildFixed(o);
  teach();
}
// guest, every frame: the host's state as of its last snapshot (ms.inf)
export function infiltrateGuestFrame(inf, dt){
  if (!I.on || !I.guest) return;
  I.net = inf || I.net;
  const w = I.net;
  if (!w){ updatePrompt(dt); return; }
  I.t = Math.abs(w.t - I.t) > 0.5 ? w.t : I.t + dt;   // (its own clock, held to the host's)
  // a hero who joins with the alarm already up sees it up, without hearing it go off
  if (!I.synced){ I.synced = true; I.wasAlarm = !!w.al; }
  else if (w.al && !I.wasAlarm){ I.wasAlarm = true; siren(); }
  const guards = (w.g || []).map(r => ({ e: K.puppet(r[0]), aware: !!r[1], seeing: !!r[2] })).filter(x => x.e && !x.e.dead);
  drawFrame(dt, I.t, guards, !!w.al, w.a || 0);
  updatePrompt(dt);
}
export const infiltrateOn = () => I.on;
// dev console / smoke test: what's live
export function infiltrateInfo(){
  const s = I.s;
  return { on: I.on, guest: I.guest, cones: [...I.cones.values()].filter(c => c.m.visible).length, cams: I.cams.length, lights: I.lights.length,
    act: I.act && I.act.a, cd: I.cd, smokesDrawn: I.smokes.size,
    alarm: s ? s.alarm : I.net ? I.net.a : 0, alarmed: s ? s.alarmed : !!(I.net && I.net.al), seen: s ? s.seen : !!(I.net && I.net.sn),
    smokeLeft: s ? s.smokeLeft : I.net ? I.net.sl : 0, smokes: s ? s.smokes.length : I.net && I.net.sm ? I.net.sm.length : 0,
    marks: s ? s.marks.map(m => ({ x: m.x, z: m.z, done: m.done })) : [],
    guards: s ? s.guards.map(e => ({ nid: e.nid, x: e.group.position.x, z: e.group.position.z, yaw: e.group.rotation.y, dead: e.dead, unaware: unaware(e), look: !!(e.patrol && e.patrol.look) })) : [] };
}
