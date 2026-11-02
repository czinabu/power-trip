// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TWISTS' KIT: what every mission twist (game/twists.js, one kind per file in this folder) is built from. The live
// twist's state (TW), the props it stands on the field, the meshes for its telegraphs, and its EVENTS: a shell that lands
// where its ring was drawn, a ring that races out across the floor, a boulder down a lane. The host makes events; a co-op
// guest is sent them in the mission's snapshot (twistSnap / twistSync) and plays the same ones, so both screens see the
// same shell land on the same spot, and each hero takes its own hits. Foes only take theirs on the host.

import * as THREE from 'three';
import { scene } from '../../engine/renderer.js';
import { G, player, enemies, heroKey } from '../../state.js';
import { V3, clamp } from '../../utils.js';
import { playerPos } from '../../player/helpers.js';
import { hurtPlayer } from '../../player/damage.js';
import { damageEnemy } from '../../enemies/damage.js';
import { blastAllies } from '../../allies/squad.js';
import { explosion, groundRing, sparks } from '../../fx/ink.js';
import { burst } from '../../fx/particles.js';
import { S, sfx } from '../../audio/sfx.js';
import { players, targetable } from '../../player/players.js';
import { diffDmgMul } from '../../data/difficulty.js';

// the live twist. s: the kind's own state (fresh each time one begins) · ev: its live events
export const TW = { tw: null, o: null, t: 0, k: 0, fade: false, guest: false, lights: [], props: [], said: false, spot: 0, s: {}, ev: [], evId: 0, seen: new Set() };
export const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export const line = (tw) => tw.line ? heroKey(tw.line) : '';
// the twist's own words for something (a per-hero { jedi, mando, trooper } or a plain string), with a fallback
export const words = (v, fb = '') => v == null ? fb : typeof v === 'object' ? (heroKey(v) ?? fb) : v;

/* ---------- props: whatever a twist stands on the field goes with it ---------- */
export function prop(m){ scene.add(m); TW.props.push(m); return m; }
export function unprop(m){
  if (!m) return;
  scene.remove(m);
  const i = TW.props.indexOf(m); if (i >= 0) TW.props.splice(i, 1);
  dispose(m);
}
export function dispose(m){ m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }

/* ---------- telegraph meshes: flat, glowing, drawn over the floor ---------- */
const glow = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending,
  depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
const flat = (m, y = 0.08) => { m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 3; m.userData.noBake = true; m.frustumCulled = false; return m; };
// a ring of radius 1 (scale it), its band `w` of that radius thick
export const ringMesh = (color, w = 0.12, op = 0.9) => flat(new THREE.Mesh(new THREE.RingGeometry(1 - w, 1, 56), glow(color, op)));
export const discMesh = (color, op = 0.25) => flat(new THREE.Mesh(new THREE.CircleGeometry(1, 40), glow(color, op)), 0.07);
// a flat strip 1 × 1 (scale x across it, y along it once laid with layLane)
export const laneMesh = (color, op = 0.25) => flat(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glow(color, op)), 0.07);
export function layLane(m, x0, z0, x1, z1, w){
  m.position.set((x0 + x1) / 2, m.position.y, (z0 + z1) / 2);
  m.rotation.set(-Math.PI / 2, 0, Math.atan2(x1 - x0, z1 - z0));
  m.scale.set(w, Math.hypot(x1 - x0, z1 - z0), 1);
}
// a thin glowing line in the air (a laser sight, a searchlight's cone edge), stretched between two points with layBeam
const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export const beamMesh = (color, r = 0.05, op = 0.8, r2 = r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, 1, 8, 1, true), glow(color, op)); m.userData.noBake = true; m.frustumCulled = false; m.renderOrder = 4; return m; };
export function layBeam(m, a, b){
  _d.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = _d.length() || 1e-3;
  m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
  m.scale.set(1, len, 1);
}

/* ---------- who's where ---------- */
// every hero in this fight that can be got at (this one, and a co-op partner): what a host aims at
export function heroes(){ const out = []; for (const h of players) if (h.local ? player.hp > 0 && !player.downed : targetable(h)) out.push(h); return out; }
// a hero to aim at (the nearest to a point, or one at random)
export function pickHero(x, z){
  const hs = heroes();
  if (!hs.length) return players[0];
  if (x == null) return hs[Math.floor(Math.random() * hs.length)];
  return hs.reduce((b, h) => Math.hypot(h.pos.x - x, h.pos.z - z) < Math.hypot(b.pos.x - x, b.pos.z - z) ? h : b);
}
// this screen's own hero inside a circle (and low enough to be caught by something on the floor)
export function meIn(x, z, r, high = 3){ const p = playerPos(); return player.hp > 0 && !player.downed && p.y < high && Math.hypot(p.x - x, p.z - z) < r; }
// a hit on this screen's hero from something that isn't a blade or a bolt (a shell, a wall of water): no block turns it,
// but a dodge through it still does (hurtPlayer)
export function hurtMe(dmg, x, z, opts = {}){
  if (G.mode !== 'play') return 'none';
  return hurtPlayer(dmg * diffDmgMul(), V3(x, 0.5, z), !!opts.silent, false, false, { unblockable: true, blast: true });
}
// shove this screen's hero (m/s, away from (x, z) unless dir is given)
export function shoveMe(pow, x, z, up = 3, dir){
  const p = playerPos(), dx = dir ? dir[0] : p.x - x, dz = dir ? dir[1] : p.z - z, l = Math.hypot(dx, dz) || 1;
  player.vel.x += dx / l * pow; player.vel.z += dz / l * pow; player.vel.y = Math.max(player.vel.y, up);
}
// the foes in a circle (host only: a guest's foes are the host's)
export function foesIn(x, z, r, fn){
  if (TW.guest) return 0;
  let n = 0;
  for (const e of enemies){
    if (e.dead || e.converted) continue;
    const p = e.group.position;
    if (Math.hypot(p.x - x, p.z - z) < r){ n++; if (fn) fn(e, p); }
  }
  return n;
}
export function hurtFoe(e, dmg, x, z, pow = 8){
  const p = e.group.position, d = V3(p.x - x, 0, p.z - z);
  if (d.lengthSq() < 1e-4) d.set(0, 0, 1);
  damageEnemy(e, dmg, d.normalize(), pow, false, false, { launch: pow > 0 });
}

/* ---------- events ---------- */
// type: { start(e), update(e, dt) → false when done, end(e) }. e.p is what was sent (numbers and short arrays: the wire)
const EV = {};
export function defineEvent(type, def){ EV[type] = def; }
// the host makes one (a guest's arrive with the host's snapshot)
export function ev(type, p){
  if (TW.guest || !TW.tw) return null;
  return addEv(++TW.evId, type, p, 0);
}
function addEv(id, type, p, age){
  const e = { id, type, p, age, meshes: [] };
  TW.seen.add(id);
  if (EV[type].start) EV[type].start(e);
  TW.ev.push(e);
  return e;
}
export function updateEvents(dt){
  for (let i = TW.ev.length - 1; i >= 0; i--){
    const e = TW.ev[i];
    e.age += dt;
    if (EV[e.type].update(e, dt) === false){ endEv(e); TW.ev.splice(i, 1); }
  }
}
function endEv(e){ if (EV[e.type].end) EV[e.type].end(e); for (const m of e.meshes) unprop(m); e.meshes = []; }
export function clearEvents(){ for (const e of TW.ev) endEv(e); TW.ev = []; TW.seen = new Set(); }
// the wire: what's live (a guest that joins late, or missed a snapshot, still gets each one while it's up)
export const eventsSnap = () => TW.ev.map(e => [e.id, e.type, e.p, Math.round(e.age * 100) / 100]);
export function eventsSync(list){
  if (!list) return;
  for (const [id, type, p, age] of list){
    if (TW.seen.has(id) || !EV[type]) continue;
    if (EV[type].late && age > EV[type].late(p)) { TW.seen.add(id); continue; }   // (too late to show it landing)
    addEv(id, type, p, age);
  }
}
const mesh = (e, m) => { e.meshes.push(prop(m)); return m; };

/* BLAST — a shell (or a gun's round, or a strafing run's bolt) on a spot: a ring drawn where it will land, filling as
   its fuse burns, then the hit. p: { x, z, r, fuse, dmg (a hero's hp), foe (a foe's), col, big, from: [x, y, z] (a round
   fired from there: a tracer), ally: 1 (it's ours: it spares the squad) } */
defineEvent('blast', {
  late: (p) => p.fuse - 0.15,
  start(e){
    const p = e.p, col = p.col ?? 0xff4a2a;
    e.ring = mesh(e, ringMesh(col, 0.1, 0.85)); e.ring.position.x = p.x; e.ring.position.z = p.z; e.ring.scale.setScalar(p.r);
    e.disc = mesh(e, discMesh(col, 0.22)); e.disc.position.x = p.x; e.disc.position.z = p.z; e.disc.scale.setScalar(0.01);
  },
  update(e){
    const p = e.p;
    if (!e.hit){
      const k = clamp(e.age / p.fuse, 0, 1);
      e.disc.scale.setScalar(Math.max(0.01, p.r * k));
      e.ring.material.opacity = 0.5 + 0.45 * Math.abs(Math.sin(e.age * (6 + k * 18)));
      if (e.age < p.fuse) return true;
      e.hit = true;
      for (const m of e.meshes) unprop(m);
      e.meshes = [];
      const at = V3(p.x, 0.3, p.z);
      explosion(at, p.r * 0.8, !!p.big);
      S.boom(at, p.big ? 1.2 : 0.8);
      const pp = playerPos(), d = Math.hypot(pp.x - p.x, pp.z - p.z);
      G.shake = Math.max(G.shake, clamp(1 - d / 26, 0, 1) * (p.big ? 0.9 : 0.6));
      if (p.from){ e.tracer = mesh(e, beamMesh(p.col ?? 0xffc46a, 0.08, 0.9)); layBeam(e.tracer, { x: p.from[0], y: p.from[1], z: p.from[2] }, at); }
      if (p.dmg && meIn(p.x, p.z, p.r)){ hurtMe(p.dmg, p.x, p.z); shoveMe(7, p.x, p.z, 4); }
      if (p.foe) foesIn(p.x, p.z, p.r, (f) => hurtFoe(f, p.foe, p.x, p.z, 9));
      if (!TW.guest && !p.ally) blastAllies(at, p.r, (p.dmg || 0) * 0.6);
      return true;
    }
    if (e.tracer){ e.tracer.material.opacity *= 0.7; return e.age < p.fuse + 0.25; }
    return false;
  },
});

/* RING — a shockwave racing out across the floor from (x, z): it catches anyone on the ground as it passes (a jump clears
   it, and so does standing up off the floor). p: { x, z, r0 (where it starts), spd (m/s), len (how far it runs), w (half
   its width), dmg, foe, col } */
defineEvent('ring', {
  late: (p) => (p.len - (p.r0 || 0)) / p.spd - 0.3,
  start(e){
    const p = e.p, col = p.col ?? 0xb06aff;
    e.ring = mesh(e, ringMesh(col, 0.05, 0.95)); e.ring.position.set(p.x, 0.14, p.z);
    e.glow = mesh(e, ringMesh(col, 0.16, 0.28)); e.glow.position.set(p.x, 0.12, p.z);
    e.foes = new Set();
  },
  update(e){
    const p = e.p, r = Math.max(0.2, (p.r0 || 0) + e.age * p.spd);
    if (r > p.len) return false;
    // the band stays about the same width as it grows
    e.ring.scale.setScalar(r); e.glow.scale.setScalar(r + p.w * 0.5);
    const fade = 1 - smooth((r - p.len * 0.8) / (p.len * 0.2));
    e.ring.material.opacity = 0.95 * fade; e.glow.material.opacity = 0.28 * fade;
    if (Math.random() < 0.6){ const a = Math.random() * Math.PI * 2; burst(V3(p.x + Math.cos(a) * r, 0.2, p.z + Math.sin(a) * r), p.col ?? 0xb06aff, 1, 2, 2, 0.5); }
    const pp = playerPos(), d = Math.hypot(pp.x - p.x, pp.z - p.z);
    if (p.dmg && !e.me && Math.abs(d - r) < p.w && player.grounded && pp.y < 0.35 && player.hp > 0 && !player.downed){
      e.me = true;
      if (hurtMe(p.dmg, p.x, p.z) !== 'none') shoveMe(9, p.x, p.z, 5);
    }
    if (p.foe) foesIn(p.x, p.z, r + p.w, (f, fp) => {
      if (e.foes.has(f) || fp.y > 0.4 || Math.hypot(fp.x - p.x, fp.z - p.z) < r - p.w) return;
      e.foes.add(f); hurtFoe(f, p.foe, p.x, p.z, 7);
    });
    return true;
  },
});

/* ROLL — something heavy coming down a lane (a boulder, a loose crate): the lane lights for `fuse` seconds, then it runs
   from (x, z) along (dx, dz) at spd for len metres, flattening what it meets. p: { x, z, dx, dz, spd, len, r, fuse, dmg,
   foe, kind: 'rock' | 'crate', col } */
const ROCK_GEO = () => new THREE.DodecahedronGeometry(1, 0);
defineEvent('roll', {
  late: (p) => p.fuse + p.len / p.spd - 0.5,
  start(e){
    const p = e.p, l = Math.hypot(p.dx, p.dz) || 1;
    e.ux = p.dx / l; e.uz = p.dz / l;
    e.lane = mesh(e, laneMesh(p.col ?? 0xff5a2a, 0.18));
    layLane(e.lane, p.x, p.z, p.x + e.ux * p.len, p.z + e.uz * p.len, p.r * 2.2);
    const body = p.kind === 'crate'
      ? new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x6a5a44, roughness: 0.8, metalness: 0.2 }))
      : new THREE.Mesh(ROCK_GEO(), new THREE.MeshStandardMaterial({ color: p.tint ?? 0x8a5838, roughness: 0.95, flatShading: true }));
    body.castShadow = true;
    e.body = mesh(e, body);
    e.body.scale.setScalar(p.kind === 'crate' ? p.r / 0.8 : p.r);
    e.body.position.set(p.x, p.r, p.z); e.body.visible = false;
    e.foes = new Set();
  },
  update(e, dt){
    const p = e.p;
    if (e.age < p.fuse){
      e.lane.material.opacity = 0.12 + 0.16 * Math.abs(Math.sin(e.age * 9));
      if (Math.random() < dt * 14) burst(V3(p.x + (Math.random() - 0.5) * 3, 0.4, p.z + (Math.random() - 0.5) * 3), 0xa08060, 2, 3, 3, 0.8);
      return true;
    }
    const run = (e.age - p.fuse) * p.spd;
    if (run > p.len) return false;
    const x = p.x + e.ux * run, z = p.z + e.uz * run;
    e.body.visible = true;
    e.body.position.set(x, p.r * (p.kind === 'crate' ? 0.8 : 0.92) + (p.kind === 'crate' ? 0 : Math.abs(Math.sin(run * 0.9)) * 0.25), z);
    if (p.kind === 'crate') e.body.rotation.y = Math.atan2(e.ux, e.uz);
    else { e.body.rotation.x += dt * p.spd / p.r * e.uz; e.body.rotation.z -= dt * p.spd / p.r * e.ux; }
    e.lane.material.opacity *= 0.96;
    if (Math.random() < dt * 20) burst(V3(x, 0.3, z), p.kind === 'crate' ? 0x9ab4c8 : 0xb08a60, 2, 3, 2, 0.8);
    if ((e.thud = (e.thud || 0) - dt) <= 0){ e.thud = 0.28; sfx(70 + Math.random() * 30, 0.12, 'triangle', 0.05, 40); }
    const pp = playerPos();
    if (!e.me && Math.hypot(pp.x - x, pp.z - z) < p.r + 0.55 && pp.y < p.r * 1.6 && player.hp > 0 && !player.downed){
      e.me = true;
      // knocked out of its way, to whichever side you were on
      const side = (pp.x - x) * e.uz - (pp.z - z) * e.ux >= 0 ? 1 : -1;
      if (hurtMe(p.dmg, x, z) !== 'none') shoveMe(10, 0, 0, 5, [e.uz * side + e.ux * 0.6, -e.ux * side + e.uz * 0.6]);
    }
    if (p.foe) foesIn(x, z, p.r + 0.7, (f) => { if (!e.foes.has(f)){ e.foes.add(f); hurtFoe(f, p.foe, x - e.ux, z - e.uz, 14); } });
    return true;
  },
});

/* a burst of sparks and dust where something lands (kinds' own effects use it) */
export function puffAt(x, z, color, n = 8){ burst(V3(x, 0.4, z), color, n, 5, 3, 0.8); }
export function warnRing(x, z, color, r){ groundRing(V3(x, 0, z), color, r, 0.5, 0.9); }
export function streak(x, y, z, dir, color, n = 3){ sparks(V3(x, y, z), color, n, 14, { dir, cone: 0.15, life: 0.35, grav: 0, stretch: 8, size: 0.3 }); }
