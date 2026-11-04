// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Holstering (4): the Jedi clips his saber to his belt and fights with the Force alone; the Mando holsters his weapon and fights with his fists and gadgets.
// Ignite / retract (5): the blade goes out with the hilt still in hand (player.unlit), and the hero stands at ease and
// walks or runs about like anyone would (anim/ease.js relaxed). Any fight move lights it again (wakeBlade).

import { G, shared, player, isGunner, isMando, isTrooper } from '../state.js';
import { sfx, S } from '../audio/sfx.js';
import { floater } from '../fx/floaters.js';
import { extendBlade } from '../fx/trail.js';
import { showBanner } from '../ui/banners.js';
import { weaponUnlocked, MANDO_WEAPONS } from '../data/mando.js';
import { playerPos } from './helpers.js';
import { cancelSwing } from './jedi/combat.js';
import { switchWeapon } from './mando/weapons.js';
import { SABER_LIGHT } from './model/weapons.js';
import { glow } from '../engine/renderer.js';

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
  if (key){
    const at = STOW[key], sock = player.rig.sockets[at.socket];
    if (mesh.parent !== sock){ sock.add(mesh); mesh.position.set(...at.pos); mesh.rotation.set(...at.rot); }
  } else if (mesh.parent !== u.hand){
    u.hand.add(mesh);
    mesh.position.set(0, -0.04, 0);   // the grip (GRIP_Y in model/weapons.js)
    mesh.rotation.order = 'XYZ';   // (a stowed spot may have set its own)
    if (u.restQ) mesh.quaternion.copy(u.restQ);
  }
}

// is the current hero fighting without the weapon in hand?
export function holstered(){ return isMando() ? player.weapon === 'fists' : !!player.holstered; }

/* hang every weapon where the current state says: the Jedi saber in hand or on the belt (blade out or off), the
   Mando's last-drawn weapon in hand or stowed. Visibility (which weapon is the Mando's) is syncWeaponMesh's job. */
export function syncHolster(){
  if (!player.rig || !player.rig.sockets) return;
  const jediAway = !isGunner() && !!player.holstered, dark = !isGunner() && (jediAway || !!player.unlit);   // (unlit: the hilt in hand, the blade out)
  place(player.saberHand, jediAway ? 'saber' : null);
  const B = player.blade;
  if (B){ B.blade.visible = B.glow.visible = !dark; B.light.intensity = dark ? 0 : SABER_LIGHT * glow.light; }   // dimmed to 0 rather than hidden: no shader recompiles
  const away = isMando() && player.weapon === 'fists', w = player.drawnWeapon;
  if (player.pistols){
    place(player.pistols.R, away && (w === 'single' || w === 'dual') ? 'pistolR' : null);
    place(player.pistols.L, away && w === 'dual' ? 'pistolL' : null);
  }
  place(player.rifleMesh, away && MANDO_WEAPONS[w] && MANDO_WEAPONS[w].twoHand ? 'rifle' : null);   // any long gun rides the pack
  place(player.darksaberMesh, away && w === 'darksaber' ? 'darksaber' : null);
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

function setUnlit(on){
  if (!!player.unlit === on) return;
  player.unlit = on;
  if (on){
    if (player.atkT > 0) cancelSwing();
    player.blockHeld = false; player.parryT = 0; player.deflectAnim = null; player.firing = false;
    extendBlade(-1, () => { if (player.unlit) syncHolster(); });   // it sucks back into the hilt, then it's gone
    S.retract(bladeKind(), null, true);
  } else {
    syncHolster();
    extendBlade(1);   // the blade runs up out of the emitter
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
    setUnlit(!player.unlit);
    return;
  }
  if (shared.saberProj){
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO BLADE', '#bfe8ff'); }
    return;
  }
  if (player.holstered){ toggleHolster(); return; }   // off the belt and lit in one go
  setUnlit(!player.unlit);
}

/* a fight move with the blade out lights it first (attack, block, a Force power, a kick, being hit): returns true if it
   just lit, so the move carries on with the blade coming up */
export function wakeBlade(){
  if (!bladeUnlit()) return false;
  setUnlit(false);
  return true;
}
// a weapon change, a holster, a fresh run: the blade state starts over lit (no sound: whatever changed makes its own)
export function clearUnlit(){
  if (!player.unlit) return;
  player.unlit = false;
  extendBlade(0);
  syncHolster();
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
  player.unlit = false;
  player.holstered = !player.holstered;
  player.deflectAnim = null; player.palmT = 0; player.palm = null; player.palmQueued = false; player.palmHold = null; player.pullStrikeT = 0;
  syncHolster();
  if (player.holstered){
    showBanner('', 'SABER HOLSTERED · THE FORCE ALONE', 1.0);
    if (!wasUnlit) S.retract(bladeKind()); sfx(900, 0.05, 'square', 0.03, 600);   // the blade sucks back into the hilt, the hilt clicks onto the belt
  } else {
    showBanner('', 'SABER DRAWN', 0.8);
    extendBlade(1);   // snap-hiss: the blade runs up out of the emitter
    S.ignite(bladeKind(), null, true);
  }
}
