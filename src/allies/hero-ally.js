// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HERO-CLASS SQUADMATES: a Jedi, a Mandalorian or an ARC trooper on your side (data/hero-allies.js). The squad
// (allies/squad.js) runs one as it runs any squadmate: where it goes, who it fights, cover, orders, going down and
// getting up, co-op. This is what makes it a hero: its body is a stand-in (player/stand-in.js), the hero's own model
// posed by the hero's own animation, and it moves the way a hero does:
//   · the JEDI cuts in strings of its form (each cut the keyframed swing yours would be, the third its finisher), raises
//     its guard when a blow is coming, catches bolts on the blade (the catch yours makes), throws the rank and file back
//     with a Force push, and covers ground with its form's evade flip
//   · the MANDALORIAN draws and fires its blasters (the gunslinger's draw and kick), and hops on its jetpack to cover
//     ground; it rolls out of the way of a hit now and then
//   · the ARC TROOPER shoulders the DC-15 to fire, and rolls out of the way of a hit
// Its hits are the squad's (half XP, no streak: enemies/damage.js opts.ally), never yours.
//
// CO-OP: the host's screen runs it; each move goes over the wire as one small action (heroAct, in the squad's snapshot),
// and the guest's puppet plays the same move on its own stand-in.

import * as THREE from 'three';
import { G, enemies } from '../state.js';
import { rand, clamp, V3 } from '../utils.js';
import { burst } from '../fx/particles.js';
import { sfx } from '../audio/sfx.js';
import { makeStandIn, poseStandIn, asStandIn, dropStandIn } from '../player/stand-in.js';
import { launchFlip, flipStyle } from '../player/anim/agility.js';
import { deflectAnim } from '../player/jedi/combat.js';
import { SWING_PATTERNS, STANCES } from '../data/stances.js';
import { CAST } from '../data/cast.js';
import { HERO_MOVES, HERO_LOOKS } from '../data/hero-allies.js';

const PATS = Object.keys(SWING_PATTERNS);
const ACT = { cut: 1, deflect: 2, flip: 3, push: 4, hop: 5, roll: 6, hurt: 7 };

/* the body: a stand-in dressed as the def says (its cutscene figure's look, if it has one) */
export function buildHeroAlly(def){
  const look = def.cast && CAST[def.cast] ? CAST[def.cast].look : typeof def.look === 'string' ? HERO_LOOKS[def.look] : HERO_LOOKS[def.name] || def.heroLook;
  const S = makeStandIn(def.hero, look || {}, { stance: def.stance, weapon: def.weapon, blade: def.blade, scale: def.heroScale });
  const g = S.group;
  g.userData.bodyMat = { emissive: new THREE.Color(), emissiveIntensity: 0 };   // (the squad's hit flash has nothing to tint)
  g.userData.heroAlly = true;
  return S;
}

/* fit a squadmate with it: a.hb is everything the hero side keeps. onStrike: what a cut does as it lands (the host's
   squad: allyCut; a puppet: nothing) */
export function attachHeroAlly(a, S, onStrike){
  const T = (r) => G.gt + rand(r[0], r[1]);
  const M = HERO_MOVES[S.hero] || {};
  a.hb = { S, hero: S.hero, air: 0, vy: 0, step: 0, lastCut: -9, str: 0, blockT: 0, fireT: 0,
           flipAt: M.flip ? T(M.flip.every) : 0, pushAt: M.push ? T(M.push.every) : 0, hopAt: M.hop ? T(M.hop.every) : 0, rollAt: 0,
           act: [0, 0, 0], seen: 0 };
  S.state.npc.strike = (sw) => { if (onStrike) onStrike(sw); };
  S.state.faceYaw = a.group.rotation.y;
  return a.hb;
}
export const dropHeroAlly = (a) => { if (a && a.hb){ dropStandIn(a.hb.S); a.hb = null; } };

// a move, noted for the wire (co-op: the guest's puppet plays it too)
function note(H, code, arg = 0){ H.act = [(H.act[0] + 1) % 1000, code, arg]; }

/* ---------- THE MOVES ---------- */
// the JEDI's cut: the next in the string if the last was recent, else a fresh string. step 2 is the form's finisher
export function heroCut(a, step = null, pat = null){
  const H = a.hb, S = H.S, P = S.state, M = HERO_MOVES.jedi;
  if (step == null){
    const on = G.gt - H.lastCut < M.chain && H.step < 2;
    H.step = on ? H.step + 1 : 0;
    if (!on) H.str = Math.floor(Math.random() * M.strings.length);
    step = H.step;
    pat = M.strings[H.str][step];
  }
  H.lastCut = G.gt;
  const st = STANCES[S.g.stance] || STANCES.niman;
  const dir = pat === 'neutral' ? 'neutral' : pat;
  const dur = (step === 2 ? 0.52 : 0.4) / (st.speed || 1);
  P.atkT = dur; P.deflectAnim = null; P.blockHeld = false;
  P.swing = { t: 0, applied: false, step, dur, pat: SWING_PATTERNS[dir === 'neutral' ? 'forward' : dir] || SWING_PATTERNS.right, dir, h: null, back: false };
  note(H, ACT.cut, step * 100 + Math.max(0, PATS.indexOf(pat === 'neutral' ? 'forward' : pat)) + (pat === 'neutral' ? 50 : 0));
}
// a bolt or a blow met the Jedi's blade: the catch your hero makes (jedi/combat.js deflectAnim) toward where it came from
export function heroDeflect(a, from){
  const H = a.hb;
  if (!H || H.hero !== 'jedi' || !from) return;
  asStandIn(H.S, () => deflectAnim(from));
  note(H, ACT.deflect, Math.round(Math.atan2(from.x - a.group.position.x, from.z - a.group.position.z) * 100));
}
// a hit landed: the body reels from where it came, and a gunner may roll out of the way of the next
export function heroHurt(a, from, canRoll = true){
  const H = a.hb;
  if (!H) return;
  const P = H.S.state, p = a.group.position;
  P.flinchT = P.flinchMax = HERO_MOVES.flinch;
  P.flinchDir = from ? V3(p.x - from.x, 0, p.z - from.z).normalize() : null;
  const R = HERO_MOVES[H.hero] && HERO_MOVES[H.hero].roll;
  if (R && canRoll && G.gt > H.rollAt && H.air <= 0 && Math.random() < R.chance){
    H.rollAt = G.gt + rand(R.every[0], R.every[1]);
    const side = Math.random() < 0.5 ? -1 : 1;
    heroRoll(a, side);
    const fy = a.group.rotation.y;
    a.mv.x += Math.cos(fy) * side * -R.push; a.mv.z += -Math.sin(fy) * side * -R.push;   // (sideways, off the line of fire)
  } else note(H, ACT.hurt);
}
function heroRoll(a, side){
  const H = a.hb, R = HERO_MOVES[H.hero].roll;
  asStandIn(H.S, () => launchFlip({ ...flipStyle('roll', 'side'), t: 0, dur: R.dur, side }, 'side'));
  note(H, ACT.roll, side);
}
function heroFlip(a){
  const H = a.hb, F = HERO_MOVES.jedi.flip;
  asStandIn(H.S, () => launchFlip({ ...flipStyle('evade', 'fwd'), t: 0, dur: F.dur, side: 1 }, 'fwd'));
  H.vy = F.vy; H.S.state.grounded = false;
  note(H, ACT.flip);
}
function heroHop(a){
  const H = a.hb, J = HERO_MOVES.mando.hop, P = H.S.state;
  H.vy = J.vy; H.hang = J.hang; P.grounded = false; P.jetActive = true; P.hovering = true;
  burst(a.group.position.clone().setY(a.group.position.y + 0.3), 0xffa040, 8, 5, 2, 0.5);
  sfx(90, 0.35, 'sawtooth', 0.03, 160);
  note(H, ACT.hop);
}
// the Jedi's FORCE PUSH: the palm thrown out, and the rank and file in front go flying (the squad's hit: half XP)
function heroPush(a, hit){
  const H = a.hb, P = H.S.state, Pu = HERO_MOVES.jedi.push;
  P.castT = P.castMax = Pu.cast; P.castKind = 'push'; P.lead = 'L';
  const g = a.group, p = g.position;
  burst(V3(p.x + Math.sin(g.rotation.y) * 1.2, p.y + 1.3, p.z + Math.cos(g.rotation.y) * 1.2), 0xbfe8ff, 14, 9, 3, 0.6);
  sfx(70, 0.3, 'triangle', 0.06, 220);
  if (hit) hit();
  note(H, ACT.push);
}

/* the rank and file in front of it, within r */
function inFront(a, r, cone, fodder){
  const g = a.group, p = g.position, fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y), out = [];
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || (fodder && !fodder(e))) continue;
    const dx = e.group.position.x - p.x, dz = e.group.position.z - p.z, d = Math.hypot(dx, dz);
    if (d < r && (d < 0.5 || (dx * fx + dz * fz) / d > cone)) out.push(e);
  }
  return out;
}

/* ---------- EVERY FRAME (the host's squad: allies/squad.js updateAlly) ----------
   c: { e (its foe), face (where it means to look), moving, down, still (dazed, turned: no moves of its own),
        fodder (who the squad may fight), push (what a push does to those it throws) } */
export function stepHeroAlly(a, dt, c){
  const H = a.hb, S = H.S, P = S.state, g = a.group;
  if (!c.down && !c.still){
    if (H.hero === 'jedi') jediMoves(a, dt, c);
    else gunnerMoves(a, dt, c);
  }
  pose(a, dt, c);
}
function jediMoves(a, dt, c){
  const H = a.hb, P = H.S.state, M = HERO_MOVES.jedi;
  // the GUARD: up while a foe close by winds up a blow, and a moment after
  if (P.atkT <= 0){
    const threat = enemies.some(e => !e.dead && (e.state === 'windup' || e.state === 'leapwind') && e.group.position.distanceTo(a.group.position) < M.block.reach);
    if (threat) H.blockT = M.block.hold;
  }
  H.blockT -= dt;
  P.blockHeld = H.blockT > 0 && P.atkT <= 0 && !P.flip;
  // the PUSH
  if (G.gt > H.pushAt && P.atkT <= 0 && !P.flip && H.air <= 0){
    const near = inFront(a, M.push.range, M.push.cone, c.fodder);
    if (near.length >= M.push.min){
      H.pushAt = G.gt + rand(M.push.every[0], M.push.every[1]);
      heroPush(a, () => c.push && c.push(near, M.push));
    } else H.pushAt = G.gt + 0.5;
  }
  // the FLIP, covering ground
  const sp = Math.hypot(a.mv.x, a.mv.z);
  if (G.gt > H.flipAt && sp > M.flip.speed && H.air <= 0 && P.atkT <= 0 && !P.flip && !P.blockHeld){
    H.flipAt = G.gt + rand(M.flip.every[0], M.flip.every[1]);
    heroFlip(a);
  }
}
function gunnerMoves(a, dt, c){
  const H = a.hb, P = H.S.state, M = HERO_MOVES[H.hero];
  // the guns up while it fights (and a moment after each shot); lowered on the move with nothing to shoot
  H.fireT -= dt;
  P.firing = H.fireT > 0;
  P.aiming = c.e ? 1 : 0;
  P.recoil = Math.max(0, (P.recoil || 0) - dt * 8);
  // the Mando's HOP
  const sp = Math.hypot(a.mv.x, a.mv.z);
  if (M.hop && G.gt > H.hopAt && sp > M.hop.speed && H.air <= 0 && !P.flip){
    H.hopAt = G.gt + rand(M.hop.every[0], M.hop.every[1]);
    heroHop(a);
  }
}
// a shot left its gun (allies/squad.js shoot): the kick, and the guns held up a moment
export function heroShot(a){
  const H = a.hb;
  if (!H) return;
  const P = H.S.state;
  H.fireT = (HERO_MOVES[H.hero] && HERO_MOVES[H.hero].fireHold) || 0.35;
  P.firing = true; P.recoil = 1; P.firePistol = -(P.firePistol || 1);
}
// where its shot leaves: the muzzle of whatever gun is in its hand
const _m = new THREE.Vector3();
export function heroMuzzle(a, out){
  const P = a.hb.S.state, gun = P.weapon && P.rifleMesh && P.rifleMesh.visible ? P.rifleMesh : P.pistols && (P.firePistol < 0 && P.pistols.L.visible ? P.pistols.L : P.pistols.R);
  if (!gun) return null;
  gun.getWorldPosition(_m);
  const fy = a.group.rotation.y;
  return out.set(_m.x + Math.sin(fy) * 0.35, _m.y + 0.04, _m.z + Math.cos(fy) * 0.35);
}

/* the body, posed: the squad's movement handed to the stand-in as the hero's own (its velocity, where its eyes are),
   the flip or hop carried through the air, then the hero's animation run on it */
function pose(a, dt, c){
  const H = a.hb, S = H.S, P = S.state, g = a.group, p = g.position, sc = g.scale.y || 1;
  P.talking = !!g.userData.talk;   // (a story guest's line in a cutscene: the jaw works)
  if (c.down){ P.moveVel.set(0, 0, 0); P.blockHeld = false; P.firing = false; P.aiming = 0; }
  else P.moveVel.set(a.mv.x, 0, a.mv.z);
  P.vel.set(0, 0, 0);
  // in the air: a flip's or a hop's arc over the ground the squad keeps it on
  if (H.vy > 0 || H.air > 0){
    if (H.hang > 0 && H.vy <= 0){ H.hang -= dt; H.vy = 0; }
    else H.vy -= HERO_MOVES.gravity * dt;
    H.air = Math.max(0, H.air + H.vy * dt);
    if (H.air <= 0 && H.vy <= 0){ H.vy = 0; H.hang = 0; P.grounded = true; P.jetActive = false; P.hovering = false; P.landDip = 0.3; }
    else P.grounded = false;
  }
  p.y += H.air; H.applied = H.air;
  P.vy = H.vy;
  // where it looks: its foe's chest, else where the squad turns it
  const e = c.e;
  if (e){ const q = e.group.position; P.npc.aim.set(q.x, q.y + 1.25 * (e.group.scale.y || 1), q.z); S.g.yaw = Math.atan2(q.x - p.x, q.z - p.z); }
  else { S.g.yaw = c.face; P.npc.aim.set(p.x + Math.sin(c.face) * 20, p.y + 1.3 * sc, p.z + Math.cos(c.face) * 20); }
  P.aimPitch = e ? clamp(Math.atan2(P.npc.aim.y - (p.y + 1.4 * sc), Math.hypot(P.npc.aim.x - p.x, P.npc.aim.z - p.z)), -0.6, 0.6) : 0;
  if (P.flinchT > 0) P.flinchT -= dt;
  if (P.castT > 0) P.castT -= dt;
  const moving = !c.down && Math.hypot(a.mv.x, a.mv.z) > 0.6;
  poseStandIn(S, dt, moving);
  if (c.down) g.rotation.y = P.faceYaw;
}

/* ---------- CO-OP: the guest's puppet ----------
   a.want, a.wantYaw (where the host has it) are already eased in by the squad; act: the host's last move */
export function stepHeroPuppet(a, dt, act, down){
  const H = a.hb, g = a.group;
  // its pace, measured from how far it went
  const lp = H.lp || (H.lp = g.position.clone());
  a.mv.x = (g.position.x - lp.x) / Math.max(dt, 1e-3); a.mv.z = (g.position.z - lp.z) / Math.max(dt, 1e-3);
  lp.copy(g.position);
  if (act && act[0] !== H.seen){
    H.seen = act[0];
    const code = act[1], arg = act[2];
    if (code === ACT.cut){ const fin = arg % 100 >= 50, step = Math.floor(arg / 100), pi = (arg % 100) - (fin ? 50 : 0); heroCut(a, step, fin ? 'neutral' : PATS[pi] || 'right'); }
    else if (code === ACT.deflect){ const p = g.position, an = arg / 100; heroDeflect(a, V3(p.x + Math.sin(an) * 5, p.y + 1.4, p.z + Math.cos(an) * 5)); }
    else if (code === ACT.flip) heroFlip(a);
    else if (code === ACT.push) heroPush(a, null);
    else if (code === ACT.hop) heroHop(a);
    else if (code === ACT.roll) heroRoll(a, arg || 1);
    else if (code === ACT.hurt) heroHurt(a, null, false);
  }
  if (a.kick){ heroShot(a); a.kick = 0; }
  const baseY = g.position.y;
  pose(a, dt, { e: a.target && !a.target.dead ? a.target : null, face: a.wantYaw, down });
  g.position.y = baseY;   // (the host's height already has the arc in it)
}
