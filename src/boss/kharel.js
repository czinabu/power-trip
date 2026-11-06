// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DARTH KHAREL — the gate's guardian, Act IV's last fight, laid on the final boss layer (boss/finale.js). His numbers
// are data/boss-kharel.js KHAREL. He fights in the old Sith way, so the duelling moves are Darth Vexis's own, lent
// (boss/vexis.js VEXIS_MOVES: the guard breaker, the throw, lightning, the choke, the repulse, blinks, the storm, the
// last stand), and one move is his alone:
//   THE WARDS (II, III)  he kneels on the dais behind a ward (nothing lands on him) and three wards light round the floor,
//                        each a styled lock (game/locks.js): a Force seal a Jedi holds twice as fast, a high lock worked
//                        from above, and the line the squad can hold on its own. Every hero can break every ward. All
//                        three broken in time: the ward shatters and he's thrown open. Too slow: the NOVA, a ring
//                        across the floor (dodge or jump it), and the fight goes on.
// Co-op: the host runs the wards; a guest's screen draws them from the 'kw' messages (net/foefire.js hooks.fin).

import { G, shared } from '../state.js';
import { V3, clamp } from '../utils.js';
import { KHAREL } from '../data/boss-kharel.js';
import { registerFinale, turnTo, repulseRing } from './finale.js';
import { VEXIS_MOVES, VEXIS_LOOK } from './vexis.js';
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

const MV = KHAREL.moves;
const ROMAN = ['', 'I', 'II', 'III'];
const net = (k, e, extra) => { if (hooks.fin) hooks.fin({ k, n: e.nid, ...extra }); };
const mmss = (t) => { const s = Math.max(0, Math.ceil(t)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------------- the wards on the floor (both screens draw them: the host's run them) ---------------- */
const W = { list: [], shell: null };
function phaseLabel(text){ const el = document.getElementById('bossphase'); if (el) el.textContent = text; }
// where the wards go: the arena's own spots (world/arenas/sith-gate.js), else a ring round him, one per style
function wardSpots(e){
  if (shared.gateWards && shared.gateWards.length) return shared.gateWards.map(w => ({ ...w }));
  const g = e.group.position, n = MV.ward.styles.length;
  return MV.ward.styles.map((style, i) => {
    const a = i / n * Math.PI * 2 + Math.PI / 2;
    return { style, at: [g.x + Math.cos(a) * MV.ward.ring, g.z + Math.sin(a) * MV.ward.ring] };
  });
}
function raiseWards(spots){
  dropWards();
  W.list = spots.map(w => {
    const m = makeBeacon(w.at[0], w.at[1], w.y || 0, LOCK.color[w.style] || 0xb46bff, MV.ward.r / 0.9);
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
  can: (e, C, F) => F.phase >= MV.ward.from && (F.phase > wardPhase || !((F.cds.ward || 0) > 0)) && !F.over,
  start(e, C, M){
    const c = MV.ward, F = e.fin;
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
    const c = MV.ward, t = M.t;
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

/* ---------------- his look: Vexis's old Sith lightning, plus the wards on a guest's screen ---------------- */
const look = {
  ...VEXIS_LOOK,
  frame(e, dt){ VEXIS_LOOK.frame(e, dt); },
  teardown(){ VEXIS_LOOK.teardown(); dropWards(); if (W.shell){ removeMarker(W.shell); W.shell = null; } wardPhase = 0; },
  netFx(m, e){
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
  },
};

registerFinale(KHAREL, { ...VEXIS_MOVES, ward }, look);
