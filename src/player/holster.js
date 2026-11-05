// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Holstering (4): the Jedi clips his saber to his belt and fights with the Force alone; the Mando holsters his weapon and fights with his fists and gadgets.
// Ignite / retract (5): the blade goes out (player.unlit), the hilt goes to the belt (player.stowed), and the hero stands at ease and
// walks or runs about like anyone would (anim/ease.js relaxed). Any fight move lights it again (wakeBlade).

import { G, shared, player, isGunner, isMando, isTrooper } from '../state.js';
import { sfx, S } from '../audio/sfx.js';
import { floater } from '../fx/floaters.js';
import { extendBlade } from '../fx/trail.js';
import { startFlourish, flourishing, reachK } from './anim/ease.js';
import { startHandoff } from './anim/handoff.js';
import { inCombat } from './mobility.js';
import { showBanner } from '../ui/banners.js';
import { weaponUnlocked, MANDO_WEAPONS } from '../data/mando.js';
import { playerPos } from './helpers.js';
import { cancelSwing } from './jedi/combat.js';
import { switchWeapon } from './mando/weapons.js';
import { SABER_LIGHT } from './model/weapons.js';
import { glow } from '../engine/renderer.js';
import * as THREE from 'three';

/* Where each stowed weapon hangs: a rig socket (model/rig.js) and its position + rotation there. The hilts clip on
   upright at the left hip; the blasters drop barrel-down into the thigh holsters; the rifle rides the pack. */
const STOW = {
  saber:     { socket: 'belt', pos: [0, -0.04, 0],      rot: [0.25, 0, 0.18] },
  darksaber: { socket: 'belt', pos: [0, -0.04, 0],      rot: [0.25, 0, 0.18] },
  pistolR:   { socket: 'hipR', pos: [0.02, -0.1, 0.02], rot: [Math.PI / 2, 0, 0] },
  pistolL:   { socket: 'hipL', pos: [-0.02, -0.1, 0.02], rot: [Math.PI / 2, 0, 0] },
  rifle:     { socket: 'back', pos: [-0.24, -0.42, -0.3], rot: [-Math.PI / 2, 0, -0.32, 'ZXY'] },   // slung up the pack's left side, muzzle over the shoulder
};

/* move `mesh` into its stowed spot (key in STOW), or back into the hand it was mounted in (key null) */
function place(mesh, key){
  if (!mesh) return;
  const u = mesh.userData;
  if (!u.hand) u.hand = mesh.parent;   // the hand socket it was mounted on (model/weapons.js mountWeapon)
  const from = mesh.parent, pos = _hp.copy(mesh.position), quat = _hq.copy(mesh.quaternion);
  if (key){
    const at = STOW[key], sock = player.rig.sockets[at.socket];
    if (mesh.parent !== sock){ sock.add(mesh); mesh.position.set(...at.pos); mesh.rotation.set(...at.rot); }
  } else if (mesh.parent !== u.hand){
    u.hand.add(mesh);
    mesh.position.set(0, -0.04, 0);   // the grip (GRIP_Y in model/weapons.js)
    mesh.rotation.order = 'XYZ';   // (a stowed spot may have set its own)
    if (u.restQ) mesh.quaternion.copy(u.restQ);
  }
  // the hand taking a hilt off the belt or clipping it on (the reach): it slides between them rather than jumping (anim/handoff.js)
  if (player.reach && from && mesh.parent !== from) startHandoff(mesh, from, pos, quat);
}
const _hp = new THREE.Vector3(), _hq = new THREE.Quaternion();

// is the current hero fighting without the weapon in hand?
export function holstered(){ return isMando() ? player.weapon === 'fists' : !!player.holstered; }

/* hang every weapon where the current state says: the Jedi saber in hand or on the belt (blade out or off), the
   Mando's last-drawn weapon in hand or stowed. Visibility (which weapon is the Mando's) is syncWeaponMesh's job. */
export function syncHolster(){
  if (!player.rig || !player.rig.sockets) return;
  const jediAway = !isGunner() && !!player.holstered, dark = !isGunner() && (jediAway || !!player.unlit);   // (unlit: the hilt in hand, the blade out)
  place(player.saberHand, jediAway || (!isGunner() && player.stowed) ? 'saber' : null);   // (stowed: put out with 5 and clipped on)
  const B = player.blade;
  if (B){ B.blade.visible = B.glow.visible = !dark; B.light.intensity = dark ? 0 : SABER_LIGHT * glow.light; }   // dimmed to 0 rather than hidden: no shader recompiles
  const away = isMando() && player.weapon === 'fists', w = player.drawnWeapon;
  if (player.pistols){
    place(player.pistols.R, away && (w === 'single' || w === 'dual') ? 'pistolR' : null);
    place(player.pistols.L, away && w === 'dual' ? 'pistolL' : null);
  }
  place(player.rifleMesh, away && MANDO_WEAPONS[w] && MANDO_WEAPONS[w].twoHand ? 'rifle' : null);   // any long gun rides the pack
  place(player.darksaberMesh, (away && w === 'darksaber') || (isGunner() && player.stowed && player.weapon === 'darksaber') ? 'darksaber' : null);
  if (player.darkBlades) for (const b of player.darkBlades) b.visible = !away && !(player.unlit && player.weapon === 'darksaber');
}

/* ---------- IGNITE / RETRACT (5, or LB + D-pad left) ----------
   The blade goes out and the hilt stays in hand: no guard, no hum, the hero at ease (anim/ease.js), walking and running
   like anyone. It works on the Jedi's saber in every form (the saber staff's two blades go out together), and on the
   Mando's Darksaber when it's the weapon in hand. Holstered (4), the Jedi draws and lights it in one go. */
// the blade's sound by what's in hand: the form's hum (the staff lights both ends), or the Darksaber
const bladeKind = () => isGunner() ? 'dark' : G.stance === 'staff' ? 'staff' : G.stance;
// is there a hilt in hand with its blade out?
export const bladeUnlit = () => !!player.unlit && (isGunner() ? isMando() && player.weapon === 'darksaber' : !player.holstered);

/* THE BELT — put out, the hilt doesn't stay in the hand: once the blade is in and the spin has settled, the hand takes it
   across to the belt and clips it on (player.stowed), and the arms hang free. 5 again reaches down, draws it and lights
   it. The reach is player.reach ({ dir, t }: -1 putting it on, +1 taking it off), posed by anim/ease.js; at its middle
   the hilt changes hands. A fight move doesn't wait for any of it: the hilt is in the hand and lit at once. */
export const REACH = { dur: 0.42, swap: 0.5 };   // the reach (s) and where through it the hilt is on the belt or back in the hand
function startReach(dir){ player.reach = { dir, t: 0, swapped: false }; }

function setUnlit(on, flourish = true){   // (flourish: the hilt spin; a fight move lighting it skips it, the cut needs the hand)
  if (!!player.unlit === on) return;
  player.unlit = on;
  if (on){
    if (player.atkT > 0) cancelSwing();
    player.blockHeld = false; player.parryT = 0; player.deflectAnim = null; player.firing = false;
    extendBlade(-1, () => { if (player.unlit){ syncHolster(); player.stowPend = true; } });   // it sucks back into the hilt, then it's gone, then the belt
    startFlourish(-1);   // the hilt turned over in the fingers as it goes
    S.retract(bladeKind(), null, true);
  } else {
    player._reachHold = reachK();   // (the hand rises from wherever the reach had it, not from the thigh: anim/ease.js)
    player.reach = null; player.stowPend = false; player.stowed = false; player.manualDraw = false;   // (a fight move: straight into the hand)
    syncHolster();
    extendBlade(1);   // the blade runs up out of the emitter
    if (flourish) startFlourish(1);   // ...as the hilt spins up in the hand
    S.ignite(bladeKind(), null, true);
  }
}

// the key: lit goes out, out lights, and a holstered Jedi draws and lights it
export function toggleBlade(){
  if (G.mode !== 'play' || isTrooper()) return;   // (the trooper carries no blade)
  if (isGunner()){
    if (player.weapon !== 'darksaber' || shared.darkProj){
      if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), player.up.darksaber || weaponUnlocked('darksaber') ? 'DARKSABER NOT IN HAND' : 'NO BLADE', '#c9a6ff'); }
      return;
    }
    if (player.unlit) lightFromBelt(); else setUnlit(true);
    return;
  }
  if (shared.saberProj){
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO BLADE', '#bfe8ff'); }
    return;
  }
  if (player.holstered){ toggleHolster(); return; }   // off the belt and lit in one go
  if (player.unlit){ lightFromBelt(); return; }
  setUnlit(true);
}
// 5 with the blade put out: reach down for the hilt (still on its way to the belt: it's in the hand, so light it now)
function lightFromBelt(){
  if (player.reach) return;   // (mid-reach: let it finish)
  if (!player.stowed){ setUnlit(false); return; }
  startReach(1);
}
// the reach and the belt, each frame (updateBladeAuto)
function stepReach(dt){
  if (player.stowPend && !player.reach){
    if (!bladeUnlit()){ player.stowPend = false; return; }
    if (!flourishing() && player.grounded && !player.dashT) { player.stowPend = false; startReach(-1); }
  }
  const R = player.reach; if (!R) return;
  R.t += dt;
  const k = R.t / REACH.dur;
  if (!R.swapped && k >= REACH.swap){
    R.swapped = true;
    if (!bladeUnlit()){ player.reach = null; return; }
    player.stowed = R.dir < 0; syncHolster();
    sfx(R.dir < 0 ? 900 : 700, 0.04, 'square', 0.025, R.dir < 0 ? 600 : 1000);   // the clip snapping shut / letting go
    // off the belt and in the hand: light it there and then, spin and all, and the arm carries it up from the hip
    // into the guard in one go (rather than dropping to the thigh first and rising after)
    if (R.dir > 0){ setUnlit(false); return; }
  }
  if (k >= 1) player.reach = null;
}

/* a fight move with the blade out lights it first (attack, block, a Force power, a kick, being hit): returns true if it
   just lit, so the move carries on with the blade coming up */
export function wakeBlade(){
  if (!bladeUnlit()) return false;
  setUnlit(false, false);
  return true;
}
// a weapon change, a holster, a fresh run: the blade state starts over lit (no sound: whatever changed makes its own)
export function clearUnlit(){
  player.reach = null; player.stowPend = false; player.manualDraw = false;
  if (!player.unlit && !player.stowed) return;
  player.unlit = false; player.stowed = false;
  extendBlade(0);
  syncHolster();
}

/* EVERY START (game/flow.js startLevel: a chapter, a lone mission, survival, the sandbox, a retry): the blade out and the
   hilt on the belt, no sound. Foes closing in light it (updateBladeAuto), so a start that's already a fight (a boss
   checkpoint, waves on top of you) has it lit on the first frame; 5 or any fight move lights it sooner. A holstered Jedi
   stays holstered, and the Mando's guns stay in hand (only the Darksaber has a blade to put out). */
export function startAtEase(){
  AUTO.fight = false; AUTO.quiet = 0; AUTO.calmDone = false;   // (a fight close by at the start counts as one arriving)
  clearUnlit();
  if (!canDraw()) return;
  player.unlit = true; player.stowed = true;
  extendBlade(0);
  syncHolster();
}

// AT EASE at once (a training lesson's start: game/tutorial.js): the Jedi's blade out, the hilt on the belt, no sound
export function atEase(){
  if (isGunner()) return;
  player.holstered = false; player.unlit = true; player.stowed = true; player.reach = null; player.stowPend = false;
  player.palmT = 0; player.palm = null; player.palmQueued = false; player.palmHold = null; player.manualDraw = false;
  extendBlade(0);
  syncHolster();
}

/* ---------- A DUEL'S ENTRANCE (game/cutscene.js) ----------
   Before a fight with a saber wielder, the hero waits through the scene with the hilt on the belt and the blade out (the
   Jedi's saber in any form, the staff, both Jar'Kai hilts, or the Mando's Darksaber when it's the weapon in hand). The
   foe draws and lights its own at the scene's end (game/duel-draw.js); lighting yours is up to you: 5 draws it, spin and
   all, and so does any fight move (wakeBlade). Until then the blade doesn't light itself as the fight closes in
   (player.manualDraw). A co-op partner sees it all through the pose sync. */
const canDraw = () => !isTrooper() && (isGunner() ? isMando() && player.weapon === 'darksaber' && !shared.darkProj : !player.holstered && !shared.saberProj);
// the hilt straight onto the belt, the blade out, no sound (the scene opens on it already there): false if there's no blade to put away
export function stowForScene(){
  if (!canDraw()) return false;
  if (player.atkT > 0) cancelSwing();
  player.unlit = true; player.stowed = true; player.reach = null; player.stowPend = false;
  player.manualDraw = true;
  extendBlade(0);
  syncHolster();
  return true;
}
// the scene is over: the hilt stays on the belt for you to draw (quiet: play is over, put it back in the hand)
export function endSceneDraw(quiet){
  if (quiet){ player.manualDraw = false; clearUnlit(); return; }
  if (!bladeUnlit()) player.manualDraw = false;
  else showIgniteHint();
}

/* ---------- EVERY OTHER SCENE (game/cutscene.js) ----------
   No hero stands through a cutscene with the blade lit: when a scene starts, the hilt goes straight onto the belt with
   the blade out (no sound, no flourish: the scene opens on it already there), for the Jedi's saber in every form (the
   staff, both Jar'Kai hilts) and the Mando's Darksaber when it's the weapon in hand. When the scene ends the blade goes
   back the way play needs it: lit before with a fight still on, the hand reaches down for it and lights it, spin and
   all; otherwise it stays on the belt and lights itself when foes close in, like at every start (startAtEase). (A scene that truly needs it lit asks for that, and the hero holds the fight's stance through it rather
   than standing at ease: cutscene.js `lit`, anim/ease.js atEase.) */
// returns what the blade was doing (for sceneRestore), or null if there was no blade in hand to put away
export function sceneStow(){
  if (!canDraw()) return null;   // (the trooper, a gun in hand, a holstered Jedi, a blade in flight)
  const was = { unlit: !!player.unlit };
  if (player.atkT > 0) cancelSwing();
  player.unlit = true; player.stowed = true; player.reach = null; player.stowPend = false;
  extendBlade(0);
  syncHolster();
  return was;
}
// is there a blade lit in hand right now (a scene that needs it lit keeps it: cutscene.js `lit`)
export const bladeLit = () => canDraw() && !player.unlit;
// the scene is over (quiet: play is over too, so the next fight starts lit as ever)
export function sceneRestore(was, quiet){
  if (!was) return;
  if (quiet){ clearUnlit(); return; }
  if (was.unlit || !bladeUnlit()) return;   // (it was put out before the scene: it stays on the belt for 5)
  // lit before: a fight still on draws it again as play picks up (the reach, the draw, the snap-hiss); no fight about,
  // it stays on the belt and lights itself when foes close in (updateBladeAuto)
  if (inCombat()) lightFromBelt();
}

// a reminder over the hero as the fight starts: the key that lights it
function showIgniteHint(){
  floater(playerPos(), igniteKey() + ' · IGNITE', isGunner() ? '#c9a6ff' : '#bfe8ff');
}
// the ignite key as the HUD's own chip shows it (the Jedi's #ab-lit, the Mando's Darksaber #ab-dlit), so the reminder
// follows the binding wherever it moves; a pad's is LB + D-pad left
function igniteKey(){
  if (document.body.classList.contains('pad')) return 'LB + ◀';
  const chip = document.querySelector((isGunner() ? '#ab-dlit' : '#ab-lit') + ' .key');
  return (chip && chip.textContent.trim()) || '5';
}

export function toggleHolster(){
  if (G.mode !== 'play' || isTrooper()) return;   // (the trooper keeps its guns in hand: no holster yet)
  if (isGunner()){
    if (shared.darkProj) return;   // the darksaber is out on the grappling line: catch it first
    if (player.weapon === 'fists') switchWeapon(weaponUnlocked(player.drawnWeapon) ? player.drawnWeapon : 'single');
    else {
      if (player.atkT > 0) cancelSwing();   // a darksaber swing in flight
      player.drawnWeapon = player.weapon;
      player.firing = false;
      switchWeapon('fists');
    }
    return;
  }
  if (shared.saberProj){   // the blade is still in flight: catch it first
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO BLADE', '#bfe8ff'); }
    return;
  }
  if (player.atkT > 0) cancelSwing();
  const wasUnlit = !!player.unlit && !player.holstered;   // (the blade's already out: the hilt just clicks onto the belt)
  player.unlit = false; player.stowed = false; player.reach = null; player.stowPend = false;
  player.holstered = !player.holstered;
  player.deflectAnim = null; player.palmT = 0; player.palm = null; player.palmQueued = false; player.palmHold = null; player.pullStrikeT = 0;
  syncHolster();
  if (player.holstered){
    showBanner('', 'SABER HOLSTERED · THE FORCE ALONE', 1.0);
    if (!wasUnlit) S.retract(bladeKind()); sfx(900, 0.05, 'square', 0.03, 600);   // the blade sucks back into the hilt, the hilt clicks onto the belt
  } else {
    showBanner('', 'SABER DRAWN', 0.8);
    extendBlade(1);   // snap-hiss: the blade runs up out of the emitter
    startFlourish(1);   // the hilt spun up off the belt
    S.ignite(bladeKind(), null, true);
  }
}

/* ON ITS OWN — the blade looks after itself between fights:
   · the calm after a chapter (game/aftermath.js G.calm) with no foe about for `calm` seconds: it goes out, with the
     flourish, and the hero walks the rally point at ease (once per calm: light it again and it stays lit)
   · put out (by 5 or by the calm), foes coming close (player/mobility.js inCombat turning on) light it, flourish and all
     (except after a duel's entrance, where the foe lit its own and yours is left for you to draw: player.manualDraw)
   Only in play, never in a cutscene, and never while it's in flight or on the belt. */
export const BLADE_AUTO = { calm: 2.5 };
const AUTO = { quiet: 0, calmDone: false, fight: false };
export function updateBladeAuto(dt){
  const fight = G.mode === 'play' && inCombat();
  const arrived = fight && !AUTO.fight;   // a fight just came to you
  AUTO.fight = fight;
  if (!G.calm) AUTO.calmDone = false;
  if (G.mode !== 'play' || G.cutscene || isTrooper() || player.downed) { AUTO.quiet = 0; return; }
  stepReach(dt);
  if (arrived && bladeUnlit() && !player.manualDraw){ setUnlit(false); return; }   // (not after a duel's entrance: that one's yours to light)
  AUTO.quiet = fight ? 0 : AUTO.quiet + dt;
  const lit = !player.unlit && (isGunner() ? isMando() && player.weapon === 'darksaber' && !shared.darkProj : !player.holstered && !shared.saberProj);
  if (G.calm && !AUTO.calmDone && lit && AUTO.quiet >= BLADE_AUTO.calm && player.atkT <= 0 && !player.blockHeld){
    AUTO.calmDone = true;
    setUnlit(true);
  }
}
