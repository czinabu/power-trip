// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STAND-INS: heroes the game plays itself. A stand-in is a whole hero, built the way yours is (player/model) and posed by
// the very code that poses yours (player/animation.js): the forms' guards and cuts, the catches, the flips and rolls, the
// gait, the gunslinger's draw, the Mando's flight, the cloth and the face. Nothing of it is copied: a stand-in keeps a
// player state of its own (state.js freshPlayerState), and for the moment it is posed that state is swapped in for yours
// (asStandIn), with the few pieces of the game's state the pose reads (which hero, which form, which way the eyes look)
// and each pose module's own memory (anim/saber.js, anim/guns.js, anim/ease.js, animation.js). Yours is put back before
// anything else runs, whatever happens in between.
//
// Who drives one says what it does by setting the same fields your keys and mouse set (moveVel, atkT and swing, blockHeld,
// deflectAnim, flip, castT, firing, aiming...): allies/hero-ally.js is the squad's. The blade's and the guns' hits are its
// driver's to land (S.npc.strike, S.npc.aim), never the hero's: nothing it does is counted as yours.
//
// This is the first step toward heroes the game plays in full (the same powers, through the same code): the swap here is
// the seam that work widens, from the pose to the moves themselves.

import * as THREE from 'three';
import { G, player, keys, freshPlayerState } from '../state.js';
import { buildHeroModel } from './model/index.js';
import { slim } from './model/slim.js';
import { lookOf, disposeTree } from './mesh.js';
import { mergeLook } from './model/appearance.js';
import { animatePlayer, animMemo } from './animation.js';
import { saberPose, saberMemo } from './anim/saber.js';
import { gunMemo } from './anim/guns.js';
import { easeMemo } from './anim/ease.js';
import { clearHeldBlades } from './anim/bladeclear.js';
import { syncOffSaber, applySaberGrip, setSaberStaff, setSaberDual } from './model/weapons.js';
import { STANCES } from '../data/stances.js';
import { isStaff, isDual } from '../data/forms.js';
import { dressHeroParts } from './hero.js';
import { stance, fwd, rightV, heldGrip, bladeColor } from './helpers.js';

// the game's own state the pose reads, swapped with the stand-in's for the moment it is posed
const G_KEYS = ['hero', 'stance', 'yaw', 'pitch', 'saberGrip'];
const _keys = {};

/* the saberPose's live values (anim/saber.js), as a stand-in's own: vectors copied, the rest as they are */
function poseCopy(from, to){
  for (const k in from){
    const v = from[k];
    if (v && v.isVector3){ if (!to[k] || !to[k].isVector3) to[k] = v.clone(); else to[k].copy(v); }
    else to[k] = v;
  }
  return to;
}
const _pose = {};

/* swap every field of the stand-in's state with yours (both ways: a field either side has picked up while posed goes too) */
function swapState(S){
  const P = S.state;
  for (const k of new Set([...Object.keys(player), ...Object.keys(P)])){ const v = player[k]; player[k] = P[k]; P[k] = v; }
  for (const k of G_KEYS){ const v = G[k]; G[k] = S.g[k]; S.g[k] = v; }
}

let inside = null;
export const standInNow = () => inside;   // the stand-in being posed right now, if any (nothing else should run then)

/* run fn with the stand-in swapped in for the hero you play. Yours comes back however fn ends */
export function asStandIn(S, fn){
  if (inside) return fn();   // (already inside: one level only)
  inside = S;
  swapState(S);
  for (const k in keys){ _keys[k] = keys[k]; delete keys[k]; }   // (no key of yours is held for it)
  poseCopy(saberPose, _pose); poseCopy(S.pose, saberPose);
  const memo = { saber: saberMemo(S.memo.saber), gun: gunMemo(S.memo.gun), ease: easeMemo(S.memo.ease), anim: animMemo(S.memo.anim) };
  try { return fn(); }
  finally {
    S.memo = { saber: saberMemo(memo.saber), gun: gunMemo(memo.gun), ease: easeMemo(memo.ease), anim: animMemo(memo.anim) };
    poseCopy(saberPose, S.pose); poseCopy(_pose, saberPose);
    for (const k in keys) delete keys[k];
    for (const k in _keys){ keys[k] = _keys[k]; delete _keys[k]; }
    swapState(S);
    inside = null;
  }
}

// the base a stand-in's look is laid over: the story cast's (game/cast.js), field-worn
const BASE = { jedi: { wear: 'field' }, mando: { helmet: 'tvisor', wear: 'field' }, trooper: { wear: 'field', legion: 'blue' } };

/* A NEW STAND-IN. hero 'jedi' | 'mando' | 'trooper'; look: a partial look (player/model/appearance.js, the customizer's
   options, as data/cast.js writes them), so a stand-in dresses the way a player's hero can; opts.stance (the Jedi's form, data/stances.js id), opts.weapon (a
   gunner's: data/mando.js MANDO_WEAPONS id), opts.scale. Returns { state, group, ... }: add `group` to the scene. */
export function makeStandIn(hero, look = {}, opts = {}){
  const P = freshPlayerState();
  P.group.add(buildHeroModel(P, mergeLook(lookOf(BASE), look || {})));
  // no figure brings a light of its own (the saber's, the Darksaber's): one more light in the scene recompiles every material
  const lights = []; P.group.traverse(o => { if (o.isLight) lights.push(o); });
  for (const l of lights) l.removeFromParent();
  P.npc = { aim: new THREE.Vector3(), strike: () => {}, ...(opts.npc || {}) };
  P.weapon = opts.weapon || (hero === 'trooper' ? 'rifle' : 'single');
  P.drawnWeapon = P.weapon;
  P.group.rotation.order = 'YXZ';
  if (opts.scale) P.group.scale.setScalar(opts.scale);
  const S = { hero, state: P, group: P.group, g: { hero, stance: opts.stance || 'niman', yaw: 0, pitch: 0, saberGrip: 'regular' }, pose: { live: false }, memo: {}, dead: false };
  poseCopy(saberPose, S.pose); S.pose.live = false;   // (its first pose seeds itself from the arm: anim/saber.js seed)
  asStandIn(S, () => { dressHeroParts(hero); });   // this hero's outfit and weapon showing (player/hero.js)
  S.blade = opts.blade ?? null;   // its own crystal's colour (else the form's, or the look's)
  fitBlade(S);
  slim(P, { partner: hero });   // the outfit merged, the other heroes' gone: far fewer draws (player/model/slim.js)
  return S;
}

/* the Jedi's saber for its form, as switching to it fits yours (jedi/stance.js switchStance): the staff's long hilt,
   Jar'Kai's second saber, the grip (Shien's reverse) and the blade's colour */
function fitBlade(S){
  if (S.hero !== 'jedi') return;
  asStandIn(S, () => {
    const id = G.stance;
    setSaberStaff(player, isStaff(id), false); setSaberDual(player, isDual(id), false);
    applySaberGrip(player, heldGrip(), true);
    const c = S.blade ?? bladeColor(STANCES[id] || STANCES.niman);
    if (player.blade) player.blade.glow.material.color.setHex(c);
    if (player.offSaber && player.offSaber.glow) player.offSaber.glow.material.color.setHex(c);
  });
}

/* pose it for this frame. S.state carries what its driver set; yaw is where its eyes are (its aim), moving whether
   its legs are carrying it */
export function poseStandIn(S, dt, moving){
  if (S.dead || !(dt > 0)) return;
  asStandIn(S, () => {
    const st = stance(), pp = player.group.position;
    animatePlayer(dt, pp, st, fwd(), rightV(), moving);
    syncOffSaber(player, G.hero === 'jedi');   // Jar'Kai's second saber keeps in step with the first
    clearHeldBlades(player.rig);
  });
}

/* change what it holds: a Jedi's form, a gunner's weapon (the outfit and the weapon on show follow) */
export function setStandInKit(S, { stance, weapon } = {}){
  if (stance){ S.g.stance = stance; fitBlade(S); }
  if (weapon){ S.state.weapon = weapon; S.state.drawnWeapon = weapon; asStandIn(S, () => dressHeroParts(S.hero)); }
}

export function dropStandIn(S){
  if (!S || S.dead) return;
  S.dead = true;
  S.group.removeFromParent();
  disposeTree(S.group);
}
