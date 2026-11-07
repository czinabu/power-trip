// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DARTH KHAREL — the gate's guardian, Act IV's last fight, laid on the final boss layer (boss/finale.js). His numbers
// are data/boss-kharel.js KHAREL. He fights in the old Sith way, so the duelling moves are Darth Vexis's own, lent
// (boss/vexis.js VEXIS_MOVES: the guard breaker, the throw, lightning, the choke, the repulse, blinks, the storm, the
// last stand), and one move is his alone:
//   THE DARK VOLLEY (I+) the deflector's job: he plants and pours crimson bolts at each hero in turn. Turned back off a
//                        blade (or a Mando's gauntlet), each one that strikes him cracks the vessel (the sunder bar)
//   THE WARDED ADVANCE (II+) the flanker's job: a ward across his front as he walks at you, turning every blow and shot
//                        from in front of him. From behind him or from above, it lands. A slam off the ward clears his front
//   THE WARDS (II, III)  he kneels on the dais behind a ward (nothing lands on him) and three wards light round the floor,
//                        each a styled lock (game/locks.js): a Force seal a Jedi holds twice as fast, a high lock worked
//                        from above, and the line the squad can hold on its own. Every hero can break every ward. All
//                        three broken in time: the ward shatters and he's thrown open. Too slow: the NOVA, a ring
//                        across the floor (dodge or jump it), and the fight goes on.
// The sunder bar, the pin and the trooper's quick revives are the final boss layer's (boss/finale.js def.sunder).
// Co-op: the host runs the wards; a guest's screen draws them from the 'kw' messages (net/foefire.js hooks.fin), and
// the advance's ward from 'kb'. The volley's bolts go over as any foe's do (enemies/bolts.js hooks.bolt).
// A raid (data/raids.js) tunes a copy of his numbers: every move reads them off the boss it runs on (mv), never KHAREL.

import * as THREE from 'three';
import { G, shared, player } from '../state.js';
import { V3, clamp } from '../utils.js';
import { scene } from '../engine/renderer.js';
import { players, huntable } from '../player/players.js';
import { fireBolt } from '../enemies/bolts.js';
import { ROLE } from './roles.js';
import { KHAREL } from '../data/boss-kharel.js';
import { registerFinale, turnTo, repulseRing, hurtHero } from './finale.js';
import { VEXIS_MOVES, VEXIS_LOOK, offArmOut, swordArm, handAt } from './vexis.js';
import { makeBeacon, setMarkerColor, pulseMarker, removeMarker } from '../game/objectives.js';
import { LOCK, lockRate } from '../game/locks.js';
import { queueSpawn } from '../game/flow.js';
import { burst } from '../fx/particles.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { tellFx } from '../fx/tells.js';
import { showBanner } from '../ui/banners.js';
import { S } from '../audio/sfx.js';
import { hooks } from '../net/run.js';

const mv = (e) => (e && e.fin ? e.fin.def : KHAREL).moves;   // (his numbers as this fight has them: a raid's tuned copy)
const ROMAN = ['', 'I', 'II', 'III'];
const net = (k, e, extra) => { if (hooks.fin) hooks.fin({ k, n: e.nid, ...extra }); };
const mmss = (t) => { const s = Math.max(0, Math.ceil(t)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------------- the wards on the floor (both screens draw them: the host's run them) ---------------- */
const W = { list: [], shell: null };
function phaseLabel(text){ const el = document.getElementById('bossphase'); if (el) el.textContent = text; }
// where the wards go: the arena's own spots (world/arenas/sith-gate.js), else a ring round him, one per style
function wardSpots(e){
  if (shared.gateWards && shared.gateWards.length) return shared.gateWards.map(w => ({ ...w }));
  const c = mv(e).ward, g = e.group.position, n = c.styles.length;
  return c.styles.map((style, i) => {
    const a = i / n * Math.PI * 2 + Math.PI / 2;
    return { style, at: [g.x + Math.cos(a) * c.ring, g.z + Math.sin(a) * c.ring] };
  });
}
function raiseWards(spots){
  dropWards();
  W.list = spots.map(w => {
    const m = makeBeacon(w.at[0], w.at[1], w.y || 0, LOCK.color[w.style] || 0xb46bff, KHAREL.moves.ward.r / 0.9);
    burst(V3(w.at[0], 1 + (w.y || 0), w.at[1]), LOCK.color[w.style] || 0xb46bff, 18, 7, 4, 0.9);
    return { ...w, m, prog: 0, done: false };
  });
}
function dropWards(){ for (const w of W.list) removeMarker(w.m); W.list = []; }
function breakWard(w){
  w.done = true;
  setMarkerColor(w.m, 0x7bffae); w.m.userData.beam.visible = false;
  burst(V3(w.at[0], 1.2 + (w.y || 0), w.at[1]), 0x7bffae, 20, 7, 4, 0.9); S.reward(1);
  floater(V3(w.at[0], 2 + (w.y || 0), w.at[1]), LOCK.name[w.style] + ' BROKEN', '#7bffae');
}
// the ward round him while he kneels: a violet shell
function shell(e, on){
  if (on && !W.shell){
    W.shell = makeBeacon(e.group.position.x, e.group.position.z, 0, 0xb46bff, 2.6);
    W.shell.userData.beam.scale.set(4.2, 0.34, 4.2); W.shell.userData.beam.position.y = 2.4;
  } else if (!on && W.shell){ removeMarker(W.shell); W.shell = null; }
}

/* ---------------- II+: THE WARDS ---------------- */
let wardPhase = 0;   // the last phase he warded in: one ward as each phase from II begins (then every `cd`)
const ward = {
  id: 'ward', urgent: true,
  can: (e, C, F) => F.phase >= mv(e).ward.from && (F.phase > wardPhase || !((F.cds.ward || 0) > 0)) && !F.over,
  start(e, C, M){
    const c = mv(e).ward, F = e.fin;
    wardPhase = F.phase;
    e.hyper = true; e.ward = 0;   // nothing knocks him out of it, and nothing lands (enemies/damage.js)
    M.left = c.time; M.stage = 'hold';
    raiseWards(wardSpots(e));
    shell(e, true);
    burst(V3(e.group.position.x, 1.6, e.group.position.z), 0xb46bff, 30, 10, 5, 1.1);
    spawnGroundShock(V3(e.group.position.x, 0.1, e.group.position.z), 0xb46bff, 5, 0.6, 0.9);
    showBanner('THE WARDS', 'Break all three before the ward bursts. A Jedi holds the seal, the high lock is worked from above, the squad holds the line.', 4, { kicker: KHAREL.name });
    S.roar(e.group.position);
    if (!G.sandbox){ const adds = c.adds[F.phase - 1]; if (adds) for (const t in adds) for (let i = 0; i < adds[t]; i++) queueSpawn(t); }
    net('kwOn', e, { w: W.list.map(w => [w.style, w.at[0], w.at[1], w.y || 0]) });
  },
  update(e, C, M, dt){
    const c = mv(e).ward, t = M.t;
    e.kneel = 0.55 * clamp(t / 0.5, 0, 1); e.legMode = 'off';
    turnTo(e, C, dt, 1.5);
    if (W.shell) W.shell.position.set(e.group.position.x, 0, e.group.position.z);
    if (M.stage === 'hold'){
      M.left -= dt;
      for (const w of W.list){
        if (w.done) continue;
        pulseMarker(w.m, dt, G.gt);
        const pace = lockRate(w.at[0], w.at[1], c.r, w.style, w.y || 0);
        if (pace > 0){ w.prog += dt * pace; if (Math.random() < dt * 6) burst(V3(w.at[0], 0.6 + (w.y || 0), w.at[1]), LOCK.color[w.style], 2, 3, 2, 0.5); }
        if (w.prog >= c.work) breakWard(w);
      }
      const left = W.list.filter(w => !w.done).length;
      phaseLabel('THE WARDS · ' + left + ' LEFT · ' + mmss(M.left));
      if ((M.sent = (M.sent || 0) - dt) <= 0){ M.sent = 0.25; net('kwTick', e, { d: W.list.map(w => w.done ? 1 : Math.round(w.prog / c.work * 100) / 100), l: M.left }); }
      if (M.left < 3 && !M.told){ M.told = true; tellFx('dodge', e.group.position, c.nova.r * 0.5, 3); }
      if (!left){   // every ward broken: the shell shatters and he's thrown open
        M.stage = 'open'; M.at = t; M.open = true; e.ward = null; e.hyper = false;
        e.openUntil = G.gt + c.open;
        shell(e, false); dropWards();
        screenFlash('radial-gradient(ellipse at center, rgba(180,107,255,.22), transparent 60%)', 0.5, 0.5);
        burst(V3(e.group.position.x, 1.6, e.group.position.z), 0xe8d8ff, 34, 12, 6, 1.0);
        G.shake = Math.max(G.shake, 0.8); G.hitstop = Math.max(G.hitstop, 0.1);
        showBanner('THE WARDS BREAK', 'He is open. Hit him now.', 2.6, { kicker: KHAREL.name });
        S.stun(e.group.position);
        net('kwOff', e, { ok: 1 });
        return false;
      }
      if (M.left <= 0){   // too slow: the nova
        M.stage = 'nova'; M.at = t; e.ward = null; shell(e, false); dropWards();
        repulseRing(e, c.nova.r, c.nova.dmg, c.nova.knock);
        showBanner('THE NOVA', 'The ward burst. He wards again before long.', 2.2, { kicker: KHAREL.name });
        net('kwOff', e, { ok: 0 });
        return false;
      }
      return false;
    }
    if (M.stage === 'open'){ e.kneel = 0.6; return t - M.at > c.open; }
    return t - M.at > 0.8;   // (the nova's follow-through)
  },
  end(e, C, M){
    e.ward = null; e.kneel = 0; shell(e, false); dropWards();
    if (e.fin) phaseLabel('PHASE ' + ROMAN[e.fin.phase] + ' · ' + KHAREL.phases[e.fin.phase - 1]);
    if (M.stage === 'hold') net('kwOff', e, { ok: 0 });
  },
};

/* ---------------- I+: THE DARK VOLLEY (the deflector's job) ----------------
   He plants, raises his free hand and pours crimson bolts from it at each hero in turn (the nearest first). Nothing
   breaks him out of it, and he isn't guarding: every bolt turned back off a blade strikes home and cracks the vessel.
   A gunner gets behind cover, dodges, or flanks him while his hand is busy. */
const _hand = new THREE.Vector3(), _aim = new THREE.Vector3();
const volley = {
  id: 'volley',
  can: (e, C) => C.dist > mv(e).volley.near,
  start(e, C, M){
    const c = mv(e).volley;
    e.hyper = true;
    M.next = c.wind; M.k = 0;
    M.order = players.filter(huntable).sort((a, b) => Math.hypot(a.pos.x - e.group.position.x, a.pos.z - e.group.position.z) - Math.hypot(b.pos.x - e.group.position.x, b.pos.z - e.group.position.z));
    floater(V3(e.group.position.x, e.group.position.y + 3.5 * e.group.scale.y, e.group.position.z), 'DARK VOLLEY · TURN IT BACK', '#ff8a7a');
    tellFx('parry', e.group.position, 2.2, c.wind);
    burst(V3(e.group.position.x, 2.2, e.group.position.z), 0xff2a36, 16, 6, 3, 0.8);
    S.roar(e.group.position);
  },
  update(e, C, M, dt){
    const c = mv(e).volley, t = M.t;
    e.legMode = 'off';
    // he turns after whoever the volley is on now
    const live = M.order.filter(huntable), h = live.length ? live[M.k % live.length] : C.hero;
    const hx = h.pos.x - e.group.position.x, hz = h.pos.z - e.group.position.z, hd = Math.hypot(hx, hz) || 1;
    turnTo(e, { tx: hx / hd, tz: hz / hd }, dt, 4);
    offArmOut(e, Math.min(1, t / Math.max(0.1, c.wind)), 0.15, dt); swordArm(e, 0.4, dt);
    handAt(e, _hand);
    if (t < c.wind){ if (Math.random() < 0.7) burst(_hand, 0xff2a36, 2, 3, 2, 0.5); return false; }
    if (t >= c.wind + c.dur) return true;
    if (t >= M.next){
      M.next += c.every;
      // at the chest, led a little and scattered a little: a hero who keeps moving is harder to find
      _aim.set(h.pos.x + (h.vel ? h.vel.x * 0.12 : 0) + (Math.random() - 0.5) * 0.8, (h.pos.y || 0) + 1.2 + (Math.random() - 0.5) * 0.4, h.pos.z + (h.vel ? h.vel.z * 0.12 : 0) + (Math.random() - 0.5) * 0.8).sub(_hand).normalize();
      fireBolt(_hand.clone(), _aim, c.speed, c.dmg * e.fin.def.dmg, false, false, e);
      M.k++;
    }
    return false;
  },
  end(e){ offArmOut(e, 0, 0, 1); },
};

/* ---------------- II+: THE WARDED ADVANCE (the flanker's job) ----------------
   A ward across his front as he walks at the nearest hero. Whatever comes at him from in front is turned (blades, bolts,
   powers); from behind him or from above it lands, and cracks the vessel. A slam off the ward throws back whoever is in
   front of him (dodge or jump it). Every hero can flank: the Mando simply flies over the top. */
const SHELL_GEO = new THREE.SphereGeometry(1, 20, 10, -Math.PI / 2, Math.PI, 0, Math.PI / 2);
let front = null;
function frontWard(e, on){
  if (on && !front){
    front = new THREE.Mesh(SHELL_GEO, new THREE.MeshBasicMaterial({ color: 0xb46bff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    front.renderOrder = 3; scene.add(front);
  } else if (!on && front){ scene.remove(front); front.material.dispose(); front = null; }
  if (front && e) placeFront(e, 0);
}
function placeFront(e, t){
  const g = e.group, s = g.scale.y;
  front.position.set(g.position.x + Math.sin(g.rotation.y) * 0.5 * s, 0, g.position.z + Math.cos(g.rotation.y) * 0.5 * s);
  front.rotation.y = g.rotation.y;
  front.scale.set(2.1 * s, 3.2 * s, 1.4 * s);
  front.material.opacity = 0.18 + 0.06 * Math.sin(t * 7);
}
const bulwark = {
  id: 'bulwark',
  can: (e, C) => C.dist < 14,
  start(e, C, M){
    e.hyper = true; M.slam = mv(e).bulwark.slam.every;
    frontWard(e, true);
    floater(V3(e.group.position.x, e.group.position.y + 3.5 * e.group.scale.y, e.group.position.z), 'WARDED · GET BEHIND OR ABOVE HIM', '#cc99ff');
    showBanner('THE WARDED ADVANCE', 'Nothing gets through his front. Get behind him, or come down on him from above.', 3, { kicker: KHAREL.name });
    S.roar(e.group.position);
    net('kbOn', e);
  },
  update(e, C, M, dt){
    const c = mv(e).bulwark, g = e.group, t = M.t;
    if (t >= c.dur) return true;
    turnTo(e, C, dt, 1.6);
    swordArm(e, -0.6, dt); offArmOut(e, 0.8, 0.05, dt);
    if (C.dist > 2.2){ const v = c.step * dt; g.position.x += Math.sin(g.rotation.y) * v; g.position.z += Math.cos(g.rotation.y) * v; }
    if (front) placeFront(e, t);
    if ((M.slam -= dt) <= 0.45 && !M.told){ M.told = true; tellFx('dodge', V3(g.position.x + Math.sin(g.rotation.y) * 2, 0, g.position.z + Math.cos(g.rotation.y) * 2), c.slam.r * 0.6, 0.45); }
    if (M.slam <= 0){
      M.slam = c.slam.every; M.told = false;
      // the slam: a ring off the ward, only in front of him
      const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
      spawnGroundShock(V3(g.position.x + fx * 1.6, 0.1, g.position.z + fz * 1.6), 0xb46bff, c.slam.r, 0.4, 0.85);
      G.shake = Math.max(G.shake, 0.5); S.slam(g.position);
      for (const p of players){
        if (!p.here || p.down) continue;
        const dx = p.pos.x - g.position.x, dz = p.pos.z - g.position.z, d = Math.hypot(dx, dz) || 1;
        if (d > c.slam.r || (dx * fx + dz * fz) / d < c.arc || p.pos.y > 1.1) continue;
        hurtHero(e, p, c.slam.dmg * e.fin.def.dmg, g.position, { unblockable: true });
        if (p.local){ player.vel.x += dx / d * c.slam.knock; player.vel.z += dz / d * c.slam.knock; }
      }
    }
    return false;
  },
  end(e){ frontWard(null, false); net('kbOff', e); },
};
// the ward's rule on what lands (boss/finale.js asks it for every blow, with what kind of blow it was: boss/roles.js)
function wardedFront(e, dmg, tick){
  const F = e.fin;
  if (!F.sig || F.sig.id !== 'bulwark') return dmg;
  if (F.tags & (ROLE.behind | ROLE.air)) return dmg;
  if (!tick && G.gt > (F.turnedSaid || 0)){ F.turnedSaid = G.gt + 0.8; floater(V3(e.group.position.x, e.group.position.y + 2.8 * e.group.scale.y, e.group.position.z), 'WARDED', '#cc99ff'); S.deflect(e.group.position); }
  return null;
}

/* ---------------- his look: Vexis's old Sith lightning, plus the wards on a guest's screen ---------------- */
const look = {
  ...VEXIS_LOOK,
  damage: wardedFront,
  frame(e, dt){ VEXIS_LOOK.frame(e, dt); },
  teardown(){ VEXIS_LOOK.teardown(); dropWards(); if (W.shell){ removeMarker(W.shell); W.shell = null; } wardPhase = 0; frontWard(null, false); },
  netFx(m, e){
    if (m.k === 'kbOn'){ frontWard(e, true); showBanner('THE WARDED ADVANCE', 'Nothing gets through his front. Get behind him, or come down on him from above.', 3, { kicker: KHAREL.name }); return; }
    if (m.k === 'kbOff'){ frontWard(null, false); return; }
    if (m.k === 'kwOn'){ raiseWards((m.w || []).map(([style, x, z, y]) => ({ style, at: [x, z], y }))); if (e) shell(e, true);
      showBanner('THE WARDS', 'Break all three before the ward bursts. A Jedi holds the seal, the high lock is worked from above, the squad holds the line.', 4, { kicker: KHAREL.name }); return; }
    if (m.k === 'kwTick'){ (m.d || []).forEach((d, i) => { const w = W.list[i]; if (w && d >= 1 && !w.done) breakWard(w); });
      phaseLabel('THE WARDS · ' + W.list.filter(w => !w.done).length + ' LEFT · ' + mmss(m.l)); return; }
    if (m.k === 'kwOff'){ dropWards(); shell(null, false);
      showBanner(m.ok ? 'THE WARDS BREAK' : 'THE NOVA', m.ok ? 'He is open. Hit him now.' : 'The ward burst.', 2.4, { kicker: KHAREL.name }); return; }
    VEXIS_LOOK.netFx(m, e);
  },
  guestFrame(e, dt){
    VEXIS_LOOK.guestFrame(e, dt);
    for (const w of W.list) if (!w.done) pulseMarker(w.m, dt, G.gt);
    if (W.shell && e) W.shell.position.set(e.group.position.x, 0, e.group.position.z);
    if (front && e) placeFront(e, G.gt);
  },
};

registerFinale(KHAREL, { ...VEXIS_MOVES, ward, volley, bulwark }, look);
