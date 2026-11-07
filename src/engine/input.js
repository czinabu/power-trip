// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Mouse and keyboard handlers.

import { aimLookScale, swapShoulder } from './camera.js';
import { finParry } from '../player/jedi/finisher.js';
import { CFG } from '../data/config.js';
import { renderer } from './renderer.js';
import { cycleQuality } from './quality.js';
import { audioInit, sfx } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { V3, clamp } from '../utils.js';
import { floater } from '../fx/floaters.js';
import { shared, G, keys, player, isGunner, isTrooper } from '../state.js';
import { keyWeapon, carriedOrder } from '../data/mando.js';
import { fwd, rightV, playerPos, stance, heldGrip } from '../player/helpers.js';
import { switchSlot, cycleSlot, swapVariant } from '../player/jedi/stance.js';
import { FORMS, isDual, DUAL_GRIPS, dualGripIndex, setDualGrip } from '../data/forms.js';
import { tryAttack, cancelSwing, forceKick } from '../player/jedi/combat.js';
import {
  forcePush, saberThrow, forcePull, forceRepulse, forceBarrier, forceMend, forceJudgement, forceSlam
} from '../player/jedi/force.js';
import { airCut } from '../player/jedi/aerial.js';
import { atkPress, atkRelease } from '../player/jedi/weight.js';
import { forceDash, doJump } from '../player/movement.js';
import { trySlide } from '../player/parkour.js';
import { pullPress, pullRelease, graspThrow, graspDrop } from '../player/jedi/grasp.js';
import { toggleLock } from '../player/lockon.js';
import { toggleStrafe } from '../player/strafe.js';
import {
  bactaStim, mandoRocket, mandoJetMissile, whistlingBirds, thermalDetonator, grappleHook, jetSlam
} from '../player/mando/gadgets.js';
import { mandoShift } from '../player/mando/mobility.js';
import { darksaberThrow } from '../player/mando/darksaber.js';
import { mandoMelee, clinchThrow } from '../player/mando/melee.js';
import { lockPress, lockKick, lockPush } from '../enemies/duel.js';
import { mandoWeapon, switchWeapon, startReload, fireTrigger, mandoFlame, beskarPress } from '../player/mando/weapons.js';
import { startLevel, retryLevel } from '../game/flow.js';
import { startMission, retryMission } from '../game/mission.js';
import { showBanner } from '../ui/banners.js';
import { overlay, setSaberGrip } from '../ui/menus.js';
import { startSwitch } from '../player/anim/saber.js';
import { applySaberGrip } from '../player/model/weapons.js';
import { tutEvent } from '../game/tutor-bus.js';
import { diffWindow } from '../data/difficulty.js';
import { toggleHolster, toggleBlade, wakeBlade } from '../player/holster.js';
import { strikePress, strikeRelease, holsteredKick } from '../player/jedi/palm.js';
import { wheelKeyDown, wheelKeyUp, wheelLook, wheelPickMate, wheelCancel, wheelOpen } from '../allies/wheel.js';
import { giveOrder } from '../allies/squad.js';
import { interactTap } from '../game/interact.js';
let fInteract = false;   // this F press went to a prompt (see the keydown below)
import { pingHere } from '../net/ping.js';
import { noteFlick } from '../player/jedi/cutaim.js';
import { trooperMouseDown, trooperKey, trooperCycle } from '../player/trooper/kit.js';
import { flowSignature } from '../player/gunner-flow.js';

const inputActive = () => !G.cutscene && !G.cardUp && !G.sbPlan && (document.pointerLockElement === renderer.domElement || (shared.lockFallback && G.mode === 'play'));   // (a cutscene takes no fight input)
document.addEventListener('mousemove', (e) => {
  if (!inputActive()) return;
  if (wheelLook(e.movementX, e.movementY)) return;   // the squad's command wheel is up: the mouse points at an order (allies/wheel.js)
  // down the sights the look slows with the zoom, and in a scope to the SCOPE SENS setting too (engine/camera.js aimLookScale)
  const sens = G.mouseSens * aimLookScale();
  G.yaw -= e.movementX * 0.0023 * sens;
  // allow looking well UP (was capped at -0.15, so you couldn't aim high on the ground) as well as down
  G.pitch = clamp(G.pitch + e.movementY * 0.0021 * sens, -0.62, 1.2);
  noteFlick(e.movementX, e.movementY);   // a flick just before a cut aims it (player/jedi/cutaim.js)
});
document.addEventListener('mousedown', (e) => {
  if (!inputActive()) return;
  if (player.downed) return;   // down: nothing to fight with until you're back up (game/revive.js)
  if (e.button === 1){ e.preventDefault(); wheelKeyDown(); return; }   // middle mouse: SQUAD ORDERS, as H (tap: the smart order · hold: the wheel)
  if (e.button === 3 || e.button === 4){ e.preventDefault(); swapShoulder(); return; }   // a mouse side button: SHOULDER SWAP, as K (engine/camera.js)
  if (wheelOpen()){ if (e.button === 2) wheelCancel(); else if (e.button === 0) wheelKeyUp(); return; }   // the command wheel: click gives the order, right click puts it away
  if (player.saberLock){ if (e.button === 0) lockPress(); return; }   // blades bound: LMB drives (enemies/duel.js)
  if (e.button === 0 && G.gt < (player.lockGrace || 0)) return;   // the bind just broke: the tail of the mash is swallowed, not a stray cut
  if (e.button === 2 && (player.judgeT > 0 || player.flaming || player.mendT > 0)) return;   // mid-channel (lightning / flame / mend): no bracing
  if ((e.button === 0 || e.button === 2) && G.mode === 'play') wakeBlade();
  if (e.button === 0) atkPress();   // how long LMB is held weighs the cut: tap light, hold heavy (player/jedi/weight.js)   // the blade put out (5): a swing or a guard lights it first (player/holster.js)
  if (isTrooper()){ trooperMouseDown(e.button); return; }   // the clone trooper: rifle bursts and aim, or one pistol per button (player/trooper/kit.js)
  if (isGunner()){
    if (e.button === 0 && player.clinch){ clinchThrow(); return; }   // a foe held by the collar: LMB throws it (mando/melee.js)
    if (e.button === 0){
      // LMB while guarding with the Darksaber hurls it; the grappling line reels it back (player/mando/darksaber.js)
      if (player.weapon === 'darksaber' && player.blockHeld){ darksaberThrow(); return; }
      const W = mandoWeapon();
      player.trigHeld = true;                        // single: a held trigger keeps the shield down
      if (W.fire === 'auto') player.firing = true;   // dual: hold to spray
      else fireTrigger();                            // single (semi) & disruptor (bolt-action): one shot per click
    }
    if (e.button === 2){
      beskarPress();   // a fresh press opens the BESKAR PARRY window (any gun but the Darksaber: mando/weapons.js)
      if (mandoWeapon().scope) player.zoom = true;  // disruptor: raise the scope (only then is it a rifle)
      else if (player.weapon === 'darksaber'){
        if (player.gbT > 0) return;   // guard broken: nothing guards for a beat
        if (shared.darkProj) return;   // the blade is out on the line: nothing in hand to guard with
        // DARKSABER guards & PARRIES like a lightsaber — RMB interrupts a swing at any point into the guard
        cancelSwing();
        player.blockHeld = true; player.blockT = 0;
        if (!(player.parryLockT > 0)) player.parryOpen = player.parryT = CFG.player.parryWindow + (stance().parryBonus || 0) + (player.up.parry || 0) + diffWindow();
      } else if (!(player.gbT > 0)) player.blockHeld = true;   // beskar brace — pure damage soak, no parry
    }
    return;
  }
  // LMB while guarding (RMB held) hurls the saber; otherwise it's a normal swing (holstered: a Force strike)
  if (e.button === 0){
    if (player.holstered) strikePress();   // tap: the strike string · hold: a charged palm, let go on release (jedi/palm.js)
    else if (player.blockHeld && G.unlocked.throw) saberThrow();
    else if (!airCut()) tryAttack();   // in the air with the blade out: the AERIAL CUT, a dash at the foe ahead (jedi/aerial.js)
  }
  if (e.button === 2 && G.mode === 'play'){
    if (player.exhausted || player.gbT > 0){   // guard broken — can't defend until stamina recovers
      if (G.gt - player.lastWinded > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'GUARD BROKEN', '#ff6a3a'); sfx(120, 0.12, 'square', 0.06, 70); }
    } else {
      const cancelled = cancelSwing();   // RMB interrupts a swing at any point — feint straight into the guard
      if (cancelled) tutEvent('cancel');
      // HOLD = block (absorb only). Each fresh CLICK opens a brief, timed DEFLECT/PARRY window —
      // land it on an incoming bolt or a melee strike to send it back / stagger the attacker.
      player.blockHeld = true;
      player.blockT = 0;
      let pwin = CFG.player.parryWindow + (stance().parryBonus || 0) + player.up.parry + diffWindow() + finParry();   // (+ Vaapad's Shatterpoint finisher: jedi/finisher.js)
      if (cancelled){
        // STANCE-SPECIFIC CANCEL FEEL
        if (G.stance === 'ataru'){
          // ATARU — a quick repositioning step in the way you're moving (or hop back if still)
          const d = V3(0,0,0);
          if (keys['w']) d.add(fwd()); if (keys['s']) d.sub(fwd());
          if (keys['d']) d.add(rightV()); if (keys['a']) d.sub(rightV());
          if (d.lengthSq() < 0.01) d.copy(fwd()).multiplyScalar(-1);
          d.normalize(); player.vel.addScaledVector(d, 13);
        } else if (G.stance === 'makashi'){
          player.vel.addScaledVector(fwd(), -8);   // MAKASHI — the fencer's retreat: a quick step back off the line
          pwin += 0.04;
        } else if (G.stance === 'soresu'){
          pwin += 0.08;                 // SORESU — straight back behind the blade, the guard already up
        } else if (G.stance === 'niman'){
          pwin += 0.06;                 // NIMAN — a clean cancel leaves a wider parry window after
        } else if (G.stance === 'djemso'){
          pwin += 0.1;                  // DJEM SO — committed cancel: the biggest parry window…
          player.cancelDR = 0.4;        // …soak damage through the heavy recovery…
          player.swingLock = 0.2;       // …but you're slow to swing again
        }
      }
      // a parry that just whiffed leaves the guard un-timed for a moment: this click only blocks
      if (player.parryLockT > 0) sfx(260, 0.05, 'triangle', 0.025, 200);
      else { player.parryT = pwin; player.parryOpen = pwin; }   // (parryOpen: the whole window, for the form counter's narrower one: player/damage.js)
    }
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0){ atkRelease(); player.firing = false; player.trigHeld = false; if (player.palmHold) strikeRelease(); }
  if (e.button === 2){ player.blockHeld = false; player.zoom = false; }
  if (e.button === 1) wheelKeyUp();   // middle mouse let go: the order (allies/wheel.js)
  if (e.button === 3 || e.button === 4) e.preventDefault();   // (a side button is the browser's Back: never leave the game on a swap)
});
document.addEventListener('wheel', (e) => {
  if (!inputActive()) return;
  e.preventDefault();
  if (isTrooper()){ trooperCycle(e.deltaY > 0 ? 1 : -1); return; }
  if (isGunner()){   // cycle to the next UNLOCKED loadout
    const dir = e.deltaY > 0 ? 1 : -1, order = carriedOrder();   // the guns carried: sidearm, primary, signature
    if (order.length){ const i = order.indexOf(player.weapon); switchWeapon(order[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + order.length) % order.length]); }
    return;
  }
  cycleSlot(e.deltaY > 0 ? 1 : -1);   // the next earned form along the loadout
}, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;   // typing in a text box (the co-op room code) is not play
  const k = e.key.toLowerCase();
  // Ctrl is the Jedi's slide: in play, keep Ctrl+S / D / F and the like from reaching the browser (Ctrl+W and Ctrl+T can
  // only be held back fullscreen, by the keyboard lock in ui/fullscreen.js)
  if (e.ctrlKey && G.mode === 'play' && !G.paused && k !== 'control') e.preventDefault();
  if (G.cutscene && G.mode === 'play' && k !== 'p' && k !== 'm') return;   // a cutscene: only its skip keys (game/cutscene.js), quality and music
  if (player.downed && G.mode === 'play' && k !== 'p' && k !== 'm' && k !== 'escape') return;   // down: wait for your squad
  if (wheelOpen()){   // the squad's command wheel is up: 1-4 pick a squadmate, Esc puts it away; you can still move, but nothing else fires
    if (k.length === 1 && '1234'.includes(k)){ wheelPickMate(+k - 1); return; }
    if (k === 'escape'){ wheelCancel(); return; }
    if (k !== 'tab'){ if (k.length === 1 && 'wasd'.includes(k)) keys[k] = true; return; }
  }
  // F is INTERACT whenever a prompt is up (a temple station, someone to talk to: game/interact.js), for every hero; held
  // after that, nothing else fires until it's let go (no Force Push or flamethrower off the same press)
  if (k === 'f'){
    if (fInteract) return;
    if (!e.repeat && interactTap()){ fInteract = true; return; }
  }
  keys[k] = true;
  if (k === 'alt'){
    e.preventDefault();   // ALT is STRAFE (player/strafe.js): keep the browser from grabbing it for its menu bar
    if (e.isTrusted && !e.repeat && G.mode === 'play' && !G.paused && !G.skillSelect) toggleStrafe();   // TOGGLE mode: each press flips it (a pad's LB toggles on a tap: engine/gamepad.js)
  }
  if (k === 'p' && !e.repeat){ cycleQuality(); return; }   // graphics quality — works anywhere
  if (k === 'm' && !e.repeat && shared.mapKey && shared.mapKey()) return;   // in an open zone M is the map (ui/zone-map.js)
  if (k === 'm' && !e.isTrusted) return;   // (a controller's LB + A sends M for the map: never the music)
  if (k === 'm' && !e.repeat){ audioInit(); const on = MUSIC.toggle(); showBanner('', '♪ MUSIC ' + (on ? 'ON' : 'OFF'), 1.0); return; }   // music on/off (persists)
  if (k === ' ' && !e.repeat) doJump();
  if (k === '4' && !e.repeat) toggleHolster();   // HOLSTER: the Jedi fights with the Force alone, the Mando with fists and gadgets (player/holster.js)
  if (k === '5' && !e.repeat) toggleBlade();     // IGNITE / RETRACT: the blade out and the hilt clipped on the belt, at ease (any fight move lights it again)
  if (k === 'n' && !e.repeat) pingHere();   // PING: mark the spot or foe under the crosshair for the other players (net/ping.js)
  if (k === 'h' && !e.repeat) wheelKeyDown();   // SQUAD ORDERS: tap for the smart order, hold for the command wheel (allies/wheel.js)
  if (k === 'k' && !e.repeat) swapShoulder();   // SHOULDER SWAP, the gunners' lens to the other shoulder (engine/camera.js)
  if (k === 'j' && !e.repeat && G.mode === 'play' && !G.paused && !G.hub) giveOrder('stance');   // the squad's stance: FREE ENGAGE ⇄ FOLLOW ME (allies/squad.js; on a pad, the wheel)
  if (isGunner() && flowSignature(k, e.repeat)) return;   // T (the Mando's DEAD EYE) · Y (the trooper's COORDINATED FIRE): player/gunner-flow.js
  if (isTrooper()) trooperKey(k, e.repeat);   // the clone trooper's keys (player/trooper/kit.js)
  else if (isGunner()){
    if (k === 'shift' && !e.repeat) mandoShift();        // combat roll / rocket boost / air dodge (mando/mobility.js); held in the air it boosts
    if (G.mode === 'play'){
      if (k === 'f') mandoFlame();
      if (k === 'q') mandoRocket();
      // ADAPTIVE FORK KEYS — each either/or pair shares ONE bind (you only ever own one of the pair).
      if (k === 'x'){ if (G.unlocked.slam) jetSlam(); else if (G.unlocked.grapple) grappleHook(); }                 // MID: jetpack SLAM or GRAPPLE
      if (k === 'v'){ if (G.unlocked.birds) whistlingBirds(); else if (G.unlocked.deto) thermalDetonator(); }       // LATE: BIRDS or DETONATOR
      if (k === 'z') mandoJetMissile();
      if (k === 'c' && !e.repeat) trySlide();   // SLIDE out of a run (parkour.js)
      if (k === 'e' && !e.repeat) mandoMelee();   // close quarters: string, catch, charge, dive kick, takedown (melee.js)
      if (k === 'g' && !e.repeat) bactaStim();        // bacta stim self-heal (store unlock) — G sits right beside F, in reach of WASD
      if (k === 'r' && !e.repeat) startReload();
      // 1 = the SIDEARM, 2 = the PRIMARY (the loadout: data/mando.js), 3 = the SIGNATURE WEAPON — Disruptor OR Darksaber
      // (you own exactly one after the wave-8 fork). From holstered, each draws that weapon.
      if (k === '1' || k === '2' || k === '3'){
        const w = keyWeapon(k);
        if (w) switchWeapon(w);
        else if (!e.repeat){ floater(playerPos(), 'NO ' + (k === '2' ? 'PRIMARY' : 'WEAPON'), '#ff9a66'); sfx(120, 0.1, 'square', 0.05, 70); }
      }
    }
  } else {
    // SHIFT dashes any way you're pressing (or rolls out of a hard landing). Sprinting has its own key: Q toggles it
    // between run (the default) and walk (locomotion.js runs it). Z out of a sprint slides; ALT strafes.
    if (k === 'shift' && !e.repeat) forceDash();
    if (!e.repeat && G.mode === 'play' && k.length === 1 && 'fcevxr'.includes(k)) wakeBlade();   // a Force power or a kick lights a blade put out with 5
    if (k === 'q' && !e.repeat && G.mode === 'play'){
      player.sprintOn = !player.sprintOn;
      showBanner('', player.sprintOn ? 'RUN' : 'WALK', 0.6);
    }
    if (k === 'z' && !e.repeat && !graspDrop()) toggleBlade();   // IGNITE / RETRACT (as 5); holding a foe in the Force, Z drops them
    if (k === 'control' && !e.repeat) trySlide();   // the FORCE SLIDE out of a sprint (parkour.js), on Left Ctrl
    if (k === 't' && !e.repeat) toggleLock();          // soft lock-on
    if (k === 'f'){ if (!(player.saberLock && lockPush()) && !graspThrow()) forcePush(); }   // in a saber lock: a point-blank shove that breaks it
    if (k === 'c' && !e.repeat) pullPress();   // tap = Force Pull on release; hold = Force GRASP (grasp.js)
    if (k === 'e' && !e.repeat){ if (player.saberLock) lockKick(); else if (!(player.holstered && holsteredKick())) forceKick(); }   // holstered: mid-string a spin kick, in the air a stomp   // FRONT KICK — always-available melee, shares 'E' with the Mando's punch
    if (k === 'v') forceBarrier();     // Force Barrier — the defensive bubble (its fork-sibling SABER THROW is RMB+LMB)
    // ADAPTIVE FORK KEYS — each either/or pair shares ONE bind (you only ever own one of the pair).
    if (k === 'x' && !e.repeat && G.mode === 'play'){ if (G.unlocked.slam) forceSlam(); else if (G.unlocked.mend) forceMend(); }   // UTIL: JUMP ATTACK or MEND
    if (k === 'r' && G.mode === 'play'){ if (G.unlocked.judge) forceJudgement(); else if (G.unlocked.repulse) forceRepulse(); }   // ULT: JUDGEMENT or REPULSE ('R' still restarts when dead/victory below)
    if (k === 'g' && !e.repeat && G.mode === 'play'){   // GRIP — in a Form V slot G swaps Djem So ⇄ Shien (the reverse-grip variant); in Niman it flips
      // between a regular and a reverse (Starkiller-style) grip; every other form holds its own forward grip (data/forms.js)
      const own = !isGunner() && FORMS[G.stance] && FORMS[G.stance].grip;
      if (swapVariant()){ /* swapped: the new form brings its own grip and guard */ }
      else if (!isGunner() && isDual(G.stance)){   // Jar'Kai: both forward → off reversed → both reversed
        setDualGrip(dualGripIndex() + 1);
        applySaberGrip(player, heldGrip());
        startSwitch();
        const [m, o] = DUAL_GRIPS[dualGripIndex()];
        showBanner('', m === o ? (m === 'reverse' ? 'BOTH SABERS REVERSED' : 'BOTH SABERS FORWARD') : 'MIXED GRIP', 0.9);
        sfx(520, 0.06, 'triangle', 0.04, 760);
      }
      else if (own){ showBanner('', FORMS[G.stance].name + ' HOLDS A ' + (own === 'reverse' ? 'REVERSE' : 'FORWARD') + ' GRIP', 1.0); sfx(200, 0.06, 'triangle', 0.03, 160); }
      else {
        setSaberGrip(G.saberGrip === 'reverse' ? 'regular' : 'reverse');
        startSwitch();   // the saber turns straight into the new grip's guard
        showBanner('', G.saberGrip === 'reverse' ? 'REVERSE GRIP' : 'REGULAR GRIP', 0.8);
        sfx(520, 0.06, 'triangle', 0.04, 760);
      }
    }
    if (k === '1') switchSlot(0);   // the form loadout (data/forms.js): whatever sits in each slot
    if (k === '2') switchSlot(1);
    if (k === '3') switchSlot(2);
  }
  if (k === 'r' && (G.mode === 'dead' || G.mode === 'victory')){
    const again = G.mode === 'victory';
    G.mode = 'play'; G.slowmo = 1;
    overlay.style.display = 'none';
    document.getElementById('banner').style.opacity = '0';
    if (G.mission){ if (again) startMission(G.missionId); else retryMission(); }
    else if (again) startLevel(0); else retryLevel();
    try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){}
  }
});
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; if (e.key.toLowerCase() === 'f') fInteract = false; if (e.key.toLowerCase() === 'h') wheelKeyUp(); if (e.key.toLowerCase() === 'c' && !isGunner()) pullRelease(); if (e.key === 'Alt') e.preventDefault(); });
// A held key whose keyup never arrives (ALT-TAB, ALT+click, a browser menu, focus lost) would stay down forever: strafe stuck
// on, and no sprint or slide. Losing focus releases everything; any key event that says ALT is up releases ALT.
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; fInteract = false; atkRelease(); });
// (only for real input: the pad's own key events never say ALT, and LB held + a face button must keep the strafe)
document.addEventListener('keydown', (e) => { if (e.isTrusted && !e.altKey && keys['alt']) keys['alt'] = false; }, true);
document.addEventListener('mousedown', (e) => { if (e.isTrusted && !e.altKey && keys['alt']) keys['alt'] = false; }, true);
