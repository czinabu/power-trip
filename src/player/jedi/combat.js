// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Saber swings, parry, swing damage, and the Force kick.

import { trainForm } from '../../game/upgrades.js';
import { CFG } from '../../data/config.js';
import { stamDelay } from '../stamina.js';
import { SWING_PATTERNS, backLineMul, swordMul } from '../../data/stances.js';
import { edgeMul } from '../../enemies/foeform.js';
import { SWING_SPINS, SWING_SPINS_GRIP, DEFLECT_SPINS } from '../../data/poses.js';
import { sfx, S } from '../../audio/sfx.js';
import { V3, rand, clamp, TMP } from '../../utils.js';
import { burst } from '../../fx/particles.js';
import { floater, screenFlash } from '../../fx/floaters.js';
import { shared, G, enemies, barrels, keys, player, isGunner } from '../../state.js';
import { fwd, rightV, playerPos, stance, heldGrip } from '../helpers.js';
import { damageEnemy, flinchEnemy, nearestEnemyInCone, staggerEnemy, interruptEnemy } from '../../enemies/damage.js';
import { damageBoss } from '../../boss/boss.js';
import { FOCUS, focusTier, focusDmgMul, addFocus, freeRiposte } from './focus.js';
import { spawnHitSpark, spawnGroundShock } from '../../fx/vfx.js';
import { inkSprite, sparks, clashFlash, clashSparks } from '../../fx/ink.js';
import { scorchGround } from '../../fx/scorch.js';
import { DUEL, PERFECT as DUEL_PERFECT } from '../../data/duel.js';
import { cutLine, duelDefend, isGuarding, guardImpact, rallyParry, baitGuards, canBait, skilled, perfectStrike } from '../../enemies/duel.js';
import { FEINT } from '../../data/duel-guard.js';
import { bodyRadius } from './bladehit.js';
import { bounceOff, contactPoint } from './clash.js';
import { inReach } from '../../enemies/bodyshape.js';
import { palmPoints } from '../../fx/palms.js';
import { scarBody, severLimbs } from '../../enemies/scars.js';
import { tutEvent } from '../../game/tutor-bus.js';
import { launchFlip, flipStyle } from '../anim/agility.js';
import { masteryXp } from '../../game/progression.js';
import { momentumStrike } from '../parkour.js';
import { MOVE } from '../../data/movement.js';
import { pickCut } from './cutaim.js';
import { CUT_ANGLE } from '../../data/stances.js';
import { disarmBlade } from '../../enemies/disarm.js';
import { OVERFLIP } from './overflip.js';
import { lineCatch, ripostePattern } from './guardline.js';
import { addFury, furyMul, furyBreath } from './fury.js';
import { tryFinisher, finisherStrike, endFinisher, finishType } from './finisher.js';
import { PERFECT } from '../../data/finishers.js';
import { addPosture } from '../../enemies/duel.js';
import { assistTarget, comboRange } from './saberassist.js';
import { armWeight, cutMul, holding } from './weight.js';
import { weightOf } from '../../data/swing-weight.js';
import { duelHooks } from '../../game/duel-hooks.js';

/* COMBO RHYTHM — fractions of a swing. A press before `open` is too early (and costs this link its flow); a single
   press from `open` on links in rhythm, and the next cut leaves at `at` (just after the follow-through). A press up to
   `late` s after a swing that wasn't rushed has ended still links in rhythm: the beat has a far side as well as a near
   one, so "cut again as the first one ends" works whether you are a touch early or a touch late.
   spinHold: a rhythm link whose button has been down this long (s) by the time it leaves is being drawn into a heavy;
   anything shorter is a click, and gets the form's spin (the Sarlacc Advance and the rest: pickSpin). */
export const FLOW = { open: 0.4, at: 0.8, late: 0.2, spinHold: 0.14 };

export function tryAttack(flow = false){
  // the blade is MID-FLIGHT (thrown) — no saber strikes until it returns to your hand. Force powers still work.
  if (shared.saberProj){
    if (G.gt - (player.lastWinded || -9) > 0.5){ player.lastWinded = G.gt; floater(playerPos(), 'NO BLADE', '#bfe8ff'); sfx(220, 0.06, 'sine', 0.04, 160); }
    return;
  }
  if (G.mode !== 'play' || player.blockHeld || player.judgeT > 0 || player.mendT > 0 || player.mantle || player.hang) return;
  // a press while the blade is held up for a moment (the tail of a roll, a finisher's recovery, reeling from a blow) isn't
  // thrown away: it waits, and the cut leaves as the hold ends if that is soon (player/update.js, data/movement.js MOVE.buffer)
  if (player.swingLock > 0 || player.flinchT > 0){ player.atkBuf = G.gt; return; }
  if (player.fin) return;   // a SABER FINISHER plays out on its own (jedi/finisher.js): nothing queues behind it
  // input buffering, but ONLY in the back half of the current swing — early mashing is ignored so
  // the combo flows on rhythm instead of spraying three swings off one frantic burst of clicks.
  // A press in the back half queues the next cut. If that was the ONLY press this swing (no early click), the
  // link is IN RHYTHM: the next cut flows straight out of this one's follow-through (animation.js launches it at
  // FLOW.at) instead of waiting out the recovery. Mashing still chains, just without the flow.
  if (player.atkT > 0){
    const sw = player.swing;
    if (!sw || sw.recoil) return;   // thrown back off a blade: nothing chains out of it
    if (sw.t > sw.dur * FLOW.open) player.queuedAtk = true;
    else sw.rushed = true;
    return;
  }
  // a foe reeling with its guard broken, in reach in front of you: this attack is the form's FINISHER (jedi/finisher.js)
  if (tryFinisher()) return;
  // a press just after a clean swing ended is still on the beat (FLOW.late; player/animation.js marks the swing's end)
  if (!flow && !isGunner() && G.gt - (player.flowEnd ?? -9) < FLOW.late) flow = true;
  player.flowEnd = -9;
  const st = stance();
  const step = (G.gt - player.lastAtkEnd < 0.9 * (st.comboGap || 1)) ? (player.comboStep + 1) % 3 : 0;
  // both the Jedi saber and the Mando DARKSABER spend stamina per swing (medium-high for the heavy darksaber)
  if (!isGunner() || player.weapon === 'darksaber'){
    let cost = (player.riposteT > 0 && freeRiposte()) ? 0 : st.stamina * (step === 2 ? 1.4 : 1);   // UNLEASHED: the riposte is free
    // JUYO burns Force with every swing; with too little Force left the swing takes it out of the body instead (×2 stamina)
    // ATARU'S EXHAUSTION (lore): each cut in an unbroken run costs more than the last, so it wins in bursts or not at all
    const SR = !isGunner() && st.strain, run = SR && G.gt - (player.lastAtkEnd ?? -9) < SR.gap ? (player.strainRun || 0) + 1 : 0;
    if (SR) cost *= 1 + SR.per * Math.min(run, SR.max);
    const fs = !isGunner() && st.forceSwing && cost > 0 ? st.forceSwing : 0;
    if (fs && player.force < fs) cost *= 2;
    if (player.stam < cost){
      if (G.gt - player.lastWinded > 0.6){ player.lastWinded = G.gt; floater(playerPos(), 'WINDED', '#ffaa66'); }
      return;
    }
    player.stam -= cost;
    player.stamDelay = stamDelay();
    if (SR) player.strainRun = run;
    if (fs && player.force >= fs) player.force -= fs;
  }
  player.comboStep = step;
  // PERFECT STRING (data/finishers.js PERFECT): both links into the third cut struck in rhythm (single presses in the back
  // half of the swing, never a mash) make its finisher the perfect version
  player.flowRun = step === 0 ? 0 : flow ? (player.flowRun || 0) + 1 : 0;
  const perfect = step === 2 && player.flowRun >= 2 && !(player.riposteT > 0);
  const PF = perfect ? (PERFECT.forms[isGunner() ? 'darksaber' : st.form] || {}) : null;
  // a cut out of a SLIDE ends the skid in a low sweep (parkour.js); any cut struck out of a parkour move carries its momentum
  if (player.slideT > 0){ player.slideT = 0; if (!isGunner()) player.flip = null; }
  const mom = momentumStrike();
  // slightly longer arcs read as deliberate sword strokes rather than a twitchy flurry
  // JUYO's fury quickens the blade as well as sharpening it (STANCES.juyo furySpeed: at full fury, cuts take that much less time)
  const quick = !isGunner() && st.furySpeed ? 1 - st.furySpeed * (player.fury || 0) : 1;
  const dur = (step === 2 ? 0.52 : 0.4) / (st.speed * (player.up.atkSpeed || 1)) * (PF && PF.dur || 1) * quick;
  player.atkT = dur;
  // Jedi Academy style: the movement key picks the cut's direction, where you aim picks its height (cutaim.js)
  const cut = pickCut(step);
  const dirKey = cut.dir;
  let pat = cut.pat;
  // RIPOSTE — the strike that follows a parry is a DECISIVE committed forward counter (overrides the chosen cut),
  // not just a normal swing that happens to hit harder. It reads as a clear, distinct answer.
  const ripNow = player.riposteT > 0;
  // (after a duellist's parried strike it cuts back in on the line that strike left open: jedi/guardline.js)
  const ripPat = ripNow && player.ripLine ? ripostePattern(player.ripLine) : null;
  if (ripNow) pat = ripPat || SWING_PATTERNS.forward;
  // BACK STRIKE — attacking while retreating (S) whirls the blade behind you to punish
  // anything closing on your back, knocking it away. No aim-assist turn: you stay facing forward.
  const backStrike = dirKey === 'back' && !ripNow;
  // the riposte is spent on THIS cut (it lands on whatever the blade meets first; see applySwingDamage)
  const cancelRip = ripNow && !!player.cancelRiposte;
  const fluid = ripNow && !!player.fluidRip;   // Djem So's Fluid Riposte (off a block): lands 1.5×, not a parry's 2×
  // DJEM SO — THE FORWARD STOMP: a riposte with W held stamps in behind the blow; no re-parry turns it, it breaks the guard
  const stomp = ripNow && !isGunner() && !!st.stompRiposte && !!keys['w'];
  if (ripNow){ player.riposteT = 0; player.cancelRiposte = false; player.ripLine = null; player.fluidRip = false; }
  // FLOW (data/stances.js CUT_ANGLE.flow): an angle cut that starts where the last one finished flows straight on, quicker
  const FL = CUT_ANGLE.flow, last = player.lastCut, ang = !ripNow && pat.ang != null ? pat.ang : null;
  const flowCut = ang != null && !!last && G.gt - last.at < FL.gap && Math.abs((((ang - last.ang - 180) % 360) + 540) % 360 - 180) < FL.within;
  player.lastCut = ang != null ? { ang, at: G.gt } : null;
  const cutDur = flowCut ? dur * FL.speed : dur;
  player.atkT = cutDur;
  player.swing = { t: 0, at: G.gt, applied: false, step, dur: cutDur, flowCut, pat, dir: dirKey, h: cut.h, flick: !!cut.flick, back: backStrike, riposte: ripNow, ripLine: !!ripPat, cancelRip, fluid, stomp, flow, mom, perfect, pf: PF, air: !player.grounded };   // (air: data/poses.js SWING_STYLE hands)
  player.deflectAnim = null;   // a cut takes the blade over from any catch in progress
  if (G.duel && duelHooks.swingStart) duelHooks.swingStart(player.swing);   // DUEL MODE: the other fighter hears of it now (net/pvp.js)
  player.feintUntil = 0;   // (the opening a feint made is spent on this cut: LMB behind the guard is the saber throw again)
  // (Juyo's forward rhythm link is the Onslaught's zig-zag, not a spin)
  const zigNow = !isGunner() && !!st.zigzag && dirKey === 'forward' && flow && !ripNow && !mom && player.grounded;
  const spin = zigNow ? null : pickSpin(st.form, step, cut.flick ? 'neutral' : dirKey, {   // (an aimed flick cut stays square: no strafe spin)
    ripNow, backStrike, mom, flow, st, held: holding() && G.gt - (player.atkPressAt ?? G.gt) >= FLOW.spinHold });
  if (spin){
    player.stam -= spin.stam * st.stamina; player._spinT = G.gt; player.swing.spin = spin; player.swing.dur *= spin.dur; player.atkT = player.swing.dur;
    if (spin.label){ floater(playerPos(), spin.label, '#9cc4ff', 'move'); tutEvent('sarlacc'); } }
  // LIGHT OR HEAVY (jedi/weight.js): a tap is a light cut, a hold draws back into a heavy. A riposte, a momentum strike,
  // a spin or a cut in the air keeps its own weight.
  armWeight(player.swing, !ripNow && !mom && !spin && player.grounded);
  // cinematic lunge toward nearest target in view — STRONG's finisher lunges harder; a RIPOSTE drives in hardest
  let lunge = ripNow ? 2.0 : ((step === 2 && st.finisherLunge) ? st.finisherLunge : st.lunge) * (pat.lunge || 1) * (PF && PF.lunge || 1);
  // HAWK-BAT SWOOP (Ataru): a cut out of a Force dash springs off the ground and drives in twice as far
  // POLE VAULT (the saber staff): a cut out of a roll or a Force dash plants the far end and vaults in, the body pitched
  // over the staff, and lands feet first on the foe: it is floored (applySwingDamage) and the cut follows it down
  if (mom === 'polevault'){
    lunge *= 2.2; player.vy = Math.max(player.vy, 5.2); player.grounded = false;
    launchFlip({ ...flipStyle('double'), t: 0, dur: 0.42, side: 1 }, 'fwd');
    floater(playerPos(), 'POLE VAULT', '#ffd23a');
    tutEvent('polevault');
  }
  if (stomp){
    lunge *= 1.3;
    stompShock(st.stompRiposte);
    floater(playerPos(), 'FORWARD STOMP', '#c9a0ff');
    tutEvent('stomp');
  }
  if (mom === 'slide' && !isGunner() && st.scissor){   // JAR'KAI — THE SCISSOR SLIDE: both blades cross low out of the skid
    player.swing.scissor = true;
    floater(playerPos(), 'SCISSOR SLIDE', '#ffb84a');
    tutEvent('scissor');
  }
  if (mom === 'overflip'){   // ATARU: the cut straight out of the FLIP OVER, into the back it landed behind (jedi/overflip.js)
    floater(playerPos(), 'STRIKE TO THE BACK', '#7fe0ff');
  }
  if (mom === 'swoop'){
    lunge *= 2; player.vy = Math.max(player.vy, 4.5); player.grounded = false;
    floater(playerPos(), 'HAWK-BAT SWOOP', '#7fe0ff');
    tutEvent('swoop');
  }
  // SABER ASSIST (jedi/saberassist.js, Settings): the foe nearest the crosshair is the one this cut is for. The body
  // turns a little toward it (animation.js poseBody) and the lunge closes on it. Off, or nobody near the crosshair: the
  // lunge takes the nearest foe ahead, as it always did. A back strike never turns.
  const aimed = backStrike ? null : assistTarget(comboRange(st));
  if (aimed) player.swing.assist = aimed;
  const tgt = backStrike ? nearestEnemyInCone(CFG.player.comboRange, -0.35, true)
                         : aimed || nearestEnemyInCone(comboRange(st), 0.6);
  // VAAPAD — THE SHATTERPOINT STRIKE: a cut at the foe whose attack it turned is one decisive lunge into the flaw it found,
  // the world slowing round it (the hit itself lands ×2 and floors it: applySwingDamage)
  if (tgt && !backStrike && !isGunner() && st.shatter && tgt.shatterUntil > G.gt && !ripNow){
    lunge *= 1.6; player.swing.shatterCut = true;
    G.slowmo = Math.min(G.slowmo, 0.45); G.slowmoT = Math.max(G.slowmoT, 0.22);
    screenFlash('radial-gradient(ellipse at center, rgba(208,139,255,.18), rgba(120,40,200,.06) 35%, transparent 55%)', 0.45, 0.2);
    const tp = tgt.group.position;
    burst(V3(tp.x, 1.5, tp.z), 0xd08bff, 10, 4, 2, 0.8);
    sfx(1900, 0.12, 'sine', 0.03, 600);
  }
  if (tgt && !backStrike){
    TMP.subVectors(tgt.group.position, playerPos()); TMP.y = 0;
    const d = TMP.length();
    TMP.normalize();
    // The lunge only closes a short gap toward a foe you're already facing; anything farther you have to walk into
    // range first (footwork is part of the fight). A form with a STRIKE distance (data/stances.js reach) lunges from
    // `from` m and stops `strike` m off the foe, where its blade lands; the rest close part of the gap past 2.2 m.
    const R = st.reach || {}, lungeMax = R.lungeMax ?? CFG.player.lungeMax;
    if (R.strike != null){
      const k = lunge / (st.lunge || 1);   // this cut's own push (a riposte, a finisher, the swoop) on top of the form's
      if (d > R.from) stepIntoCut(TMP, Math.min(d - R.strike, lungeMax * k) * GROUND_DRAG);
    } else if (d > 2.2) stepIntoCut(TMP, lunge * Math.min(d - 1.8, lungeMax) / 0.18);
  } else if (backStrike){
    stepIntoCut(fwd(), -4.5 * lunge);   // shove off the back foot, away from the threat
  } else {
    stepIntoCut(fwd(), 7 * (mom === 'polevault' ? lunge / 2.2 : lunge));   // step into the strike (a vault with no foe ahead to land on is a plain step)
  }
  if (spin) spinTravel(spin, dirKey);
  else if (onslaught(st, dirKey, flow, ripNow, mom)){}   // JUYO: a forward link in rhythm breaks off the line, zig then zag
  else if (ang != null && !backStrike) cutFootwork(ang);
  // the blade's whoosh, voiced by form (a held cut keeps it back: it sounds when the charge resolves, jedi/weight.js)
  if (!player.swing.charging) S.swing(isGunner() ? 'dark' : G.stance);
  if (flow && !isGunner()) sfx(1250, 0.06, 'sine', 0.022, 1900);   // a faint ring: the link landed in rhythm
  if (perfect){ sfx(1660, 0.1, 'sine', 0.03, 2400); sfx(990, 0.14, 'sine', 0.025, 1500); }   // ...and a brighter one: the string was perfect
}
/* SPINS (data/poses.js SWING_SPINS) — which flourish, if any, this cut carries. Jedi only, on the ground, and never on a
   finisher (it has its own spin), a riposte, a back strike or a momentum strike. It must be a rhythm (flow) link, off
   cooldown, with the stamina to pay its surcharge. */
function pickSpin(form, step, dirKey, o){
  if (isGunner() || !player.grounded || player.flip || step === 2 || o.ripNow || o.backStrike || o.mom || o.held) return null;   // (a held press is drawing a heavy: no spin)
  const GS = SWING_SPINS_GRIP[heldGrip()], S = GS && GS[form] ? { ...SWING_SPINS[form], ...GS[form] } : SWING_SPINS[form];   // (a grip's own take)
  if (!S || !o.flow) return null;
  const sp = (step === 1 && S.mid) || ((dirKey === 'left' || dirKey === 'right') ? S.move : dirKey === 'forward' ? S.fwd : null);
  if (!sp || G.gt - (player._spinT || -9) < sp.cd || player.stam < sp.stam * o.st.stamina) return null;
  return sp;
}
// a spinning cut drives further: the lunge is scaled up, and a cut with no step of its own (nothing to close on) still
// travels `reach` metres — forward, or to the side a strafe cut sweeps toward
function spinTravel(spin, dirKey){
  const sw = player.swing, f = fwd();
  if (sw.travel){
    sw.travel.x *= spin.travel; sw.travel.z *= spin.travel;
    const m = Math.hypot(sw.travel.x, sw.travel.z);
    if (m < spin.reach && m > 1e-3){ const k = spin.reach / m; sw.travel.x *= k; sw.travel.z *= k; }
  }
  if (!sw.travel || Math.hypot(sw.travel.x, sw.travel.z) < 1e-3){
    const side = dirKey === 'right' ? 1 : dirKey === 'left' ? -1 : 0;
    const dx = side ? -f.z * side : f.x, dz = side ? f.x * side : f.z;
    sw.travel = { x: dx * spin.reach, z: dz * spin.reach, done: 0 };
  }
}
// The cut's travel. On the ground it is ROOT MOTION: the same distance the old shove carried (impulse ÷ the ground
// drag in locomotion.js), but laid along the swing so the body drives through the strike with the lead foot
// (locomotion.js moves it, anim/footing.js steps the feet). In the air it stays a shove.
const GROUND_DRAG = 9;
/* JUYO — THE ONSLAUGHT: W struck in rhythm, on the ground, drives the cut in on a slant, zig then zag, so the next one
   comes from somewhere new. The fuller the fury, the further each break and the quicker the cut. (STANCES.juyo zigzag) */
function onslaught(st, dirKey, flow, ripNow, mom){
  const Z = !isGunner() && st.zigzag, sw = player.swing;
  if (!Z || dirKey !== 'forward' || !flow || ripNow || mom || !player.grounded || !sw) return false;
  const fury = player.fury || 0, side = player.zig = -(player.zig || 1), f = fwd(), r = rightV();
  const reach = Z.reach * (1 + Z.furyReach * fury);
  sw.travel = { x: (f.x * Z.fwd + r.x * side) * reach, z: (f.z * Z.fwd + r.z * side) * reach, done: 0 };
  sw.dur *= 1 - Z.fast * fury; player.atkT = sw.dur;
  sw.zig = side;
  const pp = playerPos();
  burst(V3(pp.x, 0.2, pp.z), 0xff3a3a, 5, 3, 1.2, 0.7);
  if (fury > 0.5) floater(pp, 'ONSLAUGHT', '#ff5a3a');
  tutEvent('onslaught', { fury });
  return true;
}
// the Forward Stomp's foot comes down: a shock round it that shoves back and rocks the foes close by (not the one it answers)
function stompShock(r){
  const pp = playerPos();
  spawnGroundShock(V3(pp.x + fwd().x * 0.6, 0.05, pp.z + fwd().z * 0.6), 0xc9a0ff, r, 0.4, 0.7);
  G.shake = Math.max(G.shake, 0.55);
  S.slam();
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    const dx = e.group.position.x - pp.x, dz = e.group.position.z - pp.z, d = Math.hypot(dx, dz);
    if (d > r || d < 0.01 || e.t.heavy) continue;
    flinchEnemy(e, V3(dx / d, 0, dz / d), 0.8);
  }
}
const MOM_LABEL = { slide: 'SLIDE CUT', wallrun: 'WALL STRIKE', vault: 'VAULT STRIKE', climb: 'LEDGE STRIKE', roll: 'ROLL STRIKE' };
/* FOOTWORK (CUT_ANGLE.foot) — on top of the step into the cut, the feet go the cut's own way: a flat cut steps the way
   the blade sweeps, an overhead drives in under it, a rising cut comes up off the back foot */
function cutFootwork(ang){
  const F = CUT_ANGLE.foot, sw = player.swing;
  if (!player.grounded || !sw) return;
  const a = ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), f = fwd(), r = rightV();
  const side = -c * F.side * Math.abs(c), on = s > 0 ? F.over * s : F.rise * -s;
  const t = sw.travel || (sw.travel = { x: 0, z: 0, done: 0 });
  t.x += r.x * side + f.x * on; t.z += r.z * side + f.z * on;
}
function stepIntoCut(dir, impulse){
  if (player.grounded && player.swing){
    player.swing.travel = { x: dir.x * impulse / GROUND_DRAG, z: dir.z * impulse / GROUND_DRAG, done: 0 };
  } else player.vel.addScaledVector(dir, impulse);
}
// Bail out of a saber swing at ANY point — into a guard/parry, a Force power, or a dash. The unspent cut is
// forfeit (that's the price of going defensive/Force mid-stroke). PARTIAL cost: an EARLY feint (first ~30%) is
// free & snappy; bailing LATE (committed, past 60%) bleeds stamina. Always leaves a blue Force-ripple + whoosh.
// `feint`: the guard (RMB) broke it off (engine/input.js): early enough, at a duellist that reads blades, it's a FEINT
// (data/duel-guard.js FEINT): its guard bites on the line you faked (enemies/duel.js baitGuards)
export function cancelSwing(feint){
  if (player.atkT <= 0 && player.darkT <= 0) return false;
  const k = player.swing ? clamp(player.swing.t / player.swing.dur, 0, 1) : 0.5;   // how far into the swing
  const sw = player.swing;
  let bit = false;
  if (feint && sw && !isGunner() && !sw.riposte && !sw.recoil && !sw.back && !player.fin){
    // early enough: inside the first part of the swing, or (a quick cut) the first moments after the press, and the
    // blade hasn't met anything yet
    const early = (k <= FEINT.by || G.gt - (sw.at ?? -9) <= FEINT.grace) && !(sw.cutSet && sw.cutSet.size) && !(sw.duel && sw.duel.size);
    if (early && player.stam >= FEINT.stam && baitGuards(cutLine(sw))){
      bit = true;
      player.stam -= FEINT.stam; player.stamDelay = stamDelay();
      floater(playerPos(), 'FEINT', '#ffd27a', 'move');   // (your own: the foe's BAITED / NOT FOOLED is the word)
      // the opening: LMB cuts from behind the guard while it lasts (engine/input.js), and the faked cut doesn't count
      // toward the string, so the real one is the same cut of the string again (never pushed on into the finisher)
      player.feintUntil = G.gt + FEINT.bait;
      player.comboStep = sw.step === 2 ? 2 : (sw.step + 2) % 3;
    } else if ((G.training || G.sandbox) && canBait()){   // practising: say why nothing happened
      const why = !early ? 'TOO LATE TO FEINT' : player.stam < FEINT.stam ? 'NO BREATH TO FEINT' : '';
      if (why) floater(playerPos(), why, '#c8d4e0');
    }
  }
  player.atkT = 0;
  player.swing = null;
  player.queuedAtk = false;
  endFinisher();   // bailing out of a finisher lets the foe go
  player.lastAtkEnd = G.gt;
  player.cancelT = G.gt;   // timestamp — a parry landed just after this counts as a CANCEL-RIPOSTE (extra payoff)
  if (player.darkT > 0){ player.darkT = 0; player.darkApplied = false; }   // also checks the darksaber ability slash
  if (k > 0.6 && !stance().castFlow){ player.stam = Math.max(0, player.stam - 14); player.stamDelay = stamDelay(); }   // late cancels cost stamina (Niman flows on: free)
  // a small SABER-COLOURED spark at the hilt + a reversed-swish whoosh — reads as a CHECKED stroke, not a Force push
  // (no forward-travelling ring here on purpose: that looked like a push and was confusing the saber-throw input)
  const pp = playerPos();
  burst(V3(pp.x + fwd().x*0.4, 1.5, pp.z + fwd().z*0.4), stance().blade, 8, 5, 4, 0.7);
  sfx(640, 0.08, 'sine', 0.045, 1600); sfx(300, 0.06, 'triangle', 0.04, 900);
  return bit ? 'feint' : true;
}
/* A cut's damage. `only` (from anim: the blade's sweep, player/jedi/bladehit.js) lists exactly what the blade passed
   through this frame, and only those are struck. An empty list is the swing's once-per-cut pass at the strike point
   (the arc flash) with nothing hit. With no list at all (no blade in hand) it falls back to
   striking everything in the swing's arc and radius. */
// a blade's blow: where it met the foe (bladehit.js), and the cap on how far it throws it (data/config.js saberShove)
export const bladeOpts = (at) => Object.assign({ shove: CFG.player.saberShove.max, blade: true }, at);
const FINISHER_FLOOR = 27;   // over the 26 a blow needs to floor a brute (enemies/damage.js)
export function applySwingDamage(step, only){
  const st = stance();
  const sw0 = player.swing;
  const fxPass = !only || only.length === 0;
  const isDark = isGunner() && player.weapon === 'darksaber';
  // a FINISHER beat strikes the foe it is finishing itself, once, at the strike point (jedi/finisher.js)
  const finFoe = sw0 && sw0.fin ? sw0.fin.e : null;
  if (sw0 && sw0.finBeat && fxPass) finisherStrike(sw0);
  let dmg = CFG.player.comboDamage[step] * st.dmg * player.up.dmg * focusDmgMul() * furyMul();   // FORCE FOCUS ramps saber damage; Form VII's FURY too
  const finisher = step === 2;
  let knock = (finisher ? 15 : 6) * st.knock * player.up.knock;
  dmg *= cutMul(sw0, 'dmg'); knock *= cutMul(sw0, 'knock');   // a light or a heavy cut (jedi/weight.js)
  if (finisher && st.finisherKnock) knock = Math.max(knock, FINISHER_FLOOR);   // DJEM SO: the finisher floors what it hits, a brute too (a short shove: config saberShove)
  // a ringing BESKAR CLANG on every heavy darksaber blow (the finisher, or any hit while a foe is in range)
  const beskarClang = () => S.clash(V3(playerPos().x + fwd().x*1.4, 1.4, playerPos().z + fwd().z*1.4), false);
  // DARKSABER — MAUL-STYLE OVERHEAD: the 3rd combo hit is a big downward smash (extra knockback + weight, but no
  // Force shockwave: the blade is beskar and a Mandalorian's, so the blow only lands on what it actually hits)
  if (isDark && finisher){
    knock *= 1.8;
    const pp0 = playerPos();
    G.shake = Math.max(G.shake, 1.1); G.hitstop = Math.max(G.hitstop, 0.13);
    burst(V3(pp0.x + fwd().x*1.6, 0.6, pp0.z + fwd().z*1.6), 0xc9a6ff, 16, 9, 5, 1.0);
    S.slam(); beskarClang();
  }
  const riposte = !!(sw0 && sw0.riposte) && !(only && only.length === 0);
  // a riposte into a duellist still in the EXCHANGE gets turned (enemies/duel.js rallyParry): no riposte flash for it
  const rallied = riposte && only && only.some(o => o.exch && o.rallyT > G.gt);
  if (riposte){   // parry reward: the answer lands twice as hard (more with Riposte Master)
    const cancelRip = !!sw0.cancelRip;   // parried straight out of a swing-cancel → a CRUSHING answer
    dmg *= 2 * (player.up.riposte || 1) * (cancelRip ? 1.6 : 1) * (sw0.fluid ? 0.75 : 1);
    knock *= cancelRip ? 1.8 : 1;
  }
  // a PERFECT STRING's finisher lands harder (data/finishers.js PERFECT)
  const perfect = finisher && !!(sw0 && sw0.perfect);
  if (perfect){ dmg *= PERFECT.dmg; knock *= PERFECT.knock; }
  if (riposte && !sw0.ripFx && !rallied){
    sw0.ripFx = true;   // the flash and the sting play once, on the first thing the riposte meets
    masteryXp('riposte');
    tutEvent('riposte');
    const cancelRip = !!sw0.cancelRip;
    const rp = playerPos();
    floater(rp, cancelRip ? 'COUNTER-RIPOSTE!' : 'RIPOSTE!', '#ffd24a');
    G.hitstop = Math.max(G.hitstop, cancelRip ? 0.2 : 0.16);
    G.shake = Math.max(G.shake, cancelRip ? 1.0 : 0.8);
    G.slowmo = Math.min(G.slowmo, 0.3); G.slowmoT = Math.max(G.slowmoT, 0.14);
    const rfp = V3(rp.x + fwd().x, 1.6, rp.z + fwd().z);
    clashFlash(rfp, 0xffd24a, true);
    clashSparks(rfp, 0xffe27a, 6, { dir: fwd(), cone: 0.7 });
    screenFlash('radial-gradient(ellipse at center, rgba(255,255,255,.2), rgba(255,210,90,.05) 35%, transparent 50%)', 0.5, 0.22);
    S.riposte(); sfx(140, 0.22, 'sawtooth', 0.14, 50);
  }
  // MOMENTUM — a cut out of a vault, climb, slide, wall-run or landing roll lands harder (data/movement.js MOVE.flow)
  const mom = sw0 && sw0.mom;
  if (mom){ dmg *= MOVE.flow.strikeDmg; knock *= MOVE.flow.strikeKnock; }
  if (mom === 'polevault') knock = Math.max(knock, FINISHER_FLOOR);   // POLE VAULT: the feet land on it and floor it
  if (mom === 'overflip') dmg *= OVERFLIP.dmg;   // ATARU's FLIP OVER: the cut into the back lands harder, and no guard turns it (below)
  if (st.airCutDmg && !player.grounded) dmg *= st.airCutDmg;   // ATARU: a cut struck off the ground lands harder
  // FAST cleaves wide through crowds; STRONG is a narrow, focused blow. FAST's finisher fans ~10% wider still.
  const radius = (finisher ? CFG.player.hitRadius + 1 : CFG.player.hitRadius) * (st.radiusMult || 1)
                 * (finisher && st.finisherArc ? st.finisherArc : 1) * (sw0 && sw0.scissor ? 1.25 : 1) * (riposte && st.riposteSweep ? st.riposteSweep : 1);   // (SHIEN's riposte wheels round: wider)
  if (sw0 && sw0.scissor) dmg *= st.scissor;
  const back = !!(player.swing && player.swing.back);
  const f = fwd(); if (back) f.negate();   // back strike cleaves & knocks toward your rear
  const pp = playerPos();
  let hits = 0, turned = 0;
  const line = cutLine(player.swing);   // the line this cut comes in on — a duellist's guard covers one (enemies/duel.js)
  // the ARC: a cut covers what's in front of you, a strafe sweep a little wider, the finisher wider still (data/config.js)
  const A = CFG.player.swingArc, sdir = player.swing && player.swing.dir;
  const scissor = !!(sw0 && sw0.scissor);   // JAR'KAI's Scissor Slide: the two blades cross at the knees, as wide as a finisher
  const arcCos = finisher || scissor || (riposte && st.riposteSweep) ? A.finisher : (sdir === 'left' || sdir === 'right' || back) ? A.sweep : A.cut;
  const reachUp = radius * 0.85;   // VERTICAL reach — a swing from the air can't hit foes far below you
  const reachDown = player.grounded ? reachUp : radius * 1.4;   // ...but a cut struck mid-leap still reaches the ground at your feet (Ataru's lesson)
  const tryHit = (pos, fn, obj) => {
    if (only){ if (only.includes(obj) && fn() !== false) hits++; return; }   // the blade decided: it touched this
    TMP.subVectors(pos, pp);
    if (TMP.y > reachUp || -TMP.y > reachDown) return;   // must be at roughly your height (aim at them, don't sweep the ground from above)
    TMP.y = 0;
    const d = TMP.length();
    if (obj && obj !== shared.boss && obj.group && obj.t){ if (!inReach(obj, pp, radius, d > 0.3 ? f : null, arcCos)) return; }   // a foe: any of its body
    else {
      if (d > radius) return;
      if (d > 0.3 && TMP.normalize().dot(f) < arcCos) return;   // only what's in front of the blade's arc
    }
    if (fn() !== false) hits++;
  };
  let foesHit = 0, blocker = null, blockAt = null;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || e === finFoe) continue;
    tryHit(e.group.position, () => {
      // SANDBOX · BREAK GUARDS: any cut that reaches a finishable foe breaks its guard outright, to practise finishers
      if (G.sandbox && G.sbBreak && !finFoe && finishType(e) && e.state !== 'stagger' && !e.net){
        staggerEnemy(e, f.x, f.z, 'GUARD BROKEN'); e.st += 0.3; return false;
      }
      // a duellist's guard may turn it (a riposte, the answer to a parry, always lands)
      // (a guard the blade already met on the way in has had its say: player/jedi/clash.js)
      if (riposte && !sw0.stomp && rallyParry(e, sw0, sw0 && sw0.hitAt && sw0.hitAt.get(e) && sw0.hitAt.get(e).at)){
        turned++; if (!blocker){ blocker = e; blockAt = sw0.hitAt && sw0.hitAt.get(e) && sw0.hitAt.get(e).at; } return false;
      }
      // (a SKILLED BLADE meets even a riposte: its guard gets there late, at a heavy cost to it. data/duel.js PERFECT)
      if ((!riposte || skilled(e)) && !back && mom !== 'overflip'){
        const pre = sw0 && sw0.duel && sw0.duel.get(e);
        const at = pre === undefined && only && only.length ? contactPoint(e) : undefined;
        const dres = pre !== undefined ? pre : duelDefend(e, line, riposte ? 'riposte' : finisher ? 'finisher' : 'cut', G.stance === 'djemso' || isDark, at);
        if (dres === 'block' || dres === 'dodge'){
          if (dres === 'block' && perfect) addPosture(e, DUEL.posture.finisher * (PERFECT.posture - 1), f.x, f.z);   // a perfect finisher strains the guard that turns it
          // DJEM SO — THE SUNDERING OVERHEAD: a heavy overhead (W, held) caught on a guard still caves in most of it
          if (dres === 'block' && st.sunder && sw0 && sw0.heavy && sw0.dir === 'forward' && e.dp && !e.dp.brace) addPosture(e, e.dp.posture * st.sunder, f.x, f.z);
          // DJEM SO — THE FORWARD STOMP on a skilled blade: the guard that turns it loses half of itself (data/duel.js PERFECT.lock)
          if (dres === 'block' && riposte && sw0.stomp && e.dp && !e.net) addPosture(e, e.dp.posture * DUEL_PERFECT.lock, f.x, f.z);
          turned++; if (dres === 'block' && !blocker){ blocker = e; blockAt = at; } return false;
        }
      }
      // VAAPAD — SHATTERPOINT: the foe whose attack you parried takes the next cut ×2, and it floors it
      const shat = !!(st.shatter && e.shatterUntil > G.gt);
      if (shat){
        e.shatterUntil = 0; floater(e.group.position, 'SHATTERPOINT', '#d08bff'); G.hitstop = Math.max(G.hitstop, 0.16); tutEvent('shatter');
        // the flaw gives: a violet crack of light out of the foe, a ring along the floor
        const sp = e.group.position;
        clashFlash(V3(sp.x, 1.4, sp.z), 0xd08bff, true);
        clashSparks(V3(sp.x, 1.4, sp.z), 0xe6c2ff, 8, { dir: f, cone: 0.9 });
        spawnGroundShock(V3(sp.x, 0.05, sp.z), 0xb04dff, 2.2, 0.35, 0.6);
        G.shake = Math.max(G.shake, 0.7);
      }
      // a blade that lands on a SKILLED BLADE got past its guard: the PERFECT STRIKE (enemies/duel.js)
      damageEnemy(e, perfectStrike(e, dmg * (e.t.heavy ? st.heavyDmg : 1) * backLineMul(st, e) * swordMul(st, e) * edgeMul(e) * (shat ? st.shatter : 1), f.x, f.z), f.clone(), knock, finisher, false, bladeOpts(sw0 && sw0.hitAt && sw0.hitAt.get(e)));   // (where the blade met it: bladehit.js; the shove's cap)
      foesHit++;
      trainForm(e.dead ? 'kill' : 'hit', { finisher, air: !player.grounded, backLine: backLineMul(st, e) > 1, heavy: !!e.t.heavy, blade: swordMul(st, e) > 1 });   // FORM MASTERY (game/upgrades.js)
      addFury(st.furyHit);   // JUYO (and a little VAAPAD): every cut that lands feeds the fury
      furyBreath();          // JUYO's payoff: the fuller the fury, the more breath a landed cut gives back
      if (shat && !e.dead) staggerEnemy(e, f.x, f.z);
      // the blade leaves its mark: a burnt cut where it crossed, and a killing blow may take the sword arm (enemies/scars.js)
      scarBody(e.group, f, sw0 && sw0.dir, finisher || G.stance === 'djemso' || isDark, sw0 && sw0.hitAt && sw0.hitAt.get(e));
      if (e.dead) severLimbs(e, f, finisher ? 0.8 : G.stance === 'djemso' || isDark ? 0.55 : 0.35, sw0 && sw0.hitAt && sw0.hitAt.get(e));
      if (!riposte && !e.dead) interruptEnemy(e, f, finisher || st.form === 'djemso' || isDark);   // striking first beats a wind-up
      if (mom === 'slide' && !riposte && !e.dead) staggerEnemy(e, f.x, f.z);   // a SLIDE CUT sweeps the legs out
      if (riposte && !e.dead) staggerEnemy(e, f.x, f.z, sw0.stomp && e.dp ? 'GUARD BROKEN' : undefined);   // a RIPOSTE floors what it answers — a true counter, wide open after
      if (riposte && sw0.stomp && e.dp && !e.dead){ e.posture = 0; e.st += 0.3; }   // (the Forward Stomp breaks the guard: it stays open a touch longer)
      // MAKASHI — BIND AND DISARM: the riposte off a bound blade takes it out of the duellist's hand (enemies/disarm.js)
      if (riposte && st.bind && !e.dead && disarmBlade(e, f.x, f.z, st.bind)) tutEvent('disarm');
      if (mom === 'overflip' && !e.dead && !sw0.overHit){ sw0.overHit = true; tutEvent('flipStrike'); }
      // DISARMING SLASH (Shii-Cho) — the finisher knocks a blaster trooper's gun out of its hands for a while (enemies/ai.js)
      if (finisher && st.disarm && e.t.ranged && !e.dead && !e.converted && !(e.disarmUntil > G.gt)){
        e.disarmUntil = G.gt + st.disarm; floater(e.group.position, 'DISARMED', '#9cc4ff');
      }
      // BESKAR EDGE — a heavy darksaber hit can DISARM/stagger a staff-wielding duelist
      if (isDark && (finisher || e.t.staff) && e.t.staff && !e.dead && Math.random() < (finisher ? 0.5 : 0.18)){
        staggerEnemy(e, f.x, f.z); floater(e.group.position, 'DISARMED', '#c9a6ff');
      }
    }, e);
  }
  if (finisher && foesHit) tutEvent('finisher');
  if (foesHit && sw0 && sw0.dir !== 'neutral') tutEvent('cutHit', { dir: sw0.dir });   // which key picked the cut that landed (the training's cut lesson)
  if (foesHit && sw0 && sw0.h && !finisher && !riposte) tutEvent('cutHeight', { h: sw0.h });   // and how high you aimed it (the aim lesson)
  if (shared.boss && shared.boss.hp > 0 && shared.boss !== finFoe) tryHit(shared.boss.group.position, () => { scarBody(shared.boss.group, f, sw0 && sw0.dir, finisher || isDark); return damageBoss(dmg * st.heavyDmg * edgeMul(shared.boss)); }, shared.boss);   // (× the form counter: enemies/foeform.js)
  for (let i = barrels.length-1; i >= 0; i--){
    const b = barrels[i];
    tryHit(b.mesh.position, () => { if (b.fuse < 0) b.fuse = 0.1; }, b);
  }
  // DUEL MODE: the blade reached the other fighter; their own screen judges it (net/pvp.js)
  if (G.duel && only && duelHooks.swingHit) for (const o of only) if (o && o.duelBody){ duelHooks.swingHit(o, { dmg, knock, finisher, line, riposte, heavy: !!(sw0 && sw0.heavy), at: sw0 && sw0.hitAt && sw0.hitAt.get(o) }); }
  // the blade bounced off a guard and found nothing else: it jars the arm, costs breath and breaks the string
  // (a guard that turned it stops the blade where they met and throws it back: player/jedi/clash.js)
  if (turned && !hits && !(sw0 && sw0.finBeat)) bounceOff(blocker, blockAt);   // (a finisher's beat rides through: jedi/finisher.js)
  if (hits > 0){
    if (sw0 && sw0.heavy && !sw0.heavyFx){   // a HEAVY lands with weight: a beat of hitstop and a harder jolt
      sw0.heavyFx = true;
      const HW = weightOf(isGunner() ? 'darksaber' : st.form, 'heavy');
      G.hitstop = Math.max(G.hitstop, HW.hitstop); G.shake = Math.max(G.shake, HW.shake);
      sfx(150, 0.14, 'triangle', 0.05, 70);
      if (foesHit) tutEvent('heavyHit');
    }
    if (mom && !sw0.momFx){ sw0.momFx = true; floater(playerPos(), MOM_LABEL[mom] || 'MOMENTUM', '#9fe0c8'); }
    G.shake = Math.max(G.shake, finisher ? 0.5 : 0.2);
    addFocus(finisher ? FOCUS.gainFin : FOCUS.gainHit);   // FORCE FOCUS — clean bladework builds the flow
    if (perfect && !sw0.pfFx){
      sw0.pfFx = true;
      addFocus(FOCUS.gainFin * PERFECT.focus);
      floater(V3(playerPos().x, playerPos().y + 0.3, playerPos().z), 'PERFECT STRING', '#fff2b0');
      G.hitstop = Math.max(G.hitstop, 0.08);
      tutEvent('perfectString');
    }
    // UNLEASHED (max focus): every cut releases a Force shockwave that cleaves & knocks the surrounding crowd
    if (!isGunner() && focusTier() >= 3){
      const pp1 = playerPos(), wp = V3(pp1.x + f.x*1.4, 0.6, pp1.z + f.z*1.4);
      spawnGroundShock(V3(wp.x, 0.1, wp.z), 0xffe27a, 4.2, 0.3, 0.45);
      burst(V3(wp.x, 1.2, wp.z), 0xffe27a, 8, 8, 4, 0.8);
      for (const e of enemies){ if (e.dead || e.converted) continue; const dd = e.group.position.clone().sub(pp1).setY(0); if (inReach(e, pp1, 4.6)) damageEnemy(e, dmg*0.3, dd.clone().normalize(), 10); }
    }
    if (riposte) player.force = clamp(player.force + 10 + (player.up.parryForce || 0), 0, CFG.player.maxForce);   // a landed counter feeds the Force
    if (isDark && !finisher) beskarClang();   // every darksaber strike rings on beskar
    // STRONG stance & DARKSABER & finishers land with real weight — a brief hitstop + heavy thud (general feedback)
    const heavy = G.stance === 'djemso' || isDark || finisher;
    if (heavy){
      G.hitstop = Math.max(G.hitstop, (G.stance === 'djemso' || isDark ? 0.06 : 0.04) + (finisher ? 0.03 : 0));
      if (!riposte) S.heavy();
    }
    // the STRONG finisher is a BONE-CRUNCHING blow — a long hitstop freeze, a big camera quake, a brief
    // slow-mo beat, a fat arc flash AND a violent eruption of sparks/debris so the weight really lands
    if (G.stance === 'djemso' && finisher && !(sw0 && sw0.heavyFx)){
      if (sw0) sw0.heavyFx = true;
      G.hitstop = Math.max(G.hitstop, 0.22);
      G.shake = Math.max(G.shake, 1.7);
      G.slowmo = Math.min(G.slowmo, 0.42); G.slowmoT = Math.max(G.slowmoT, 0.14);
      const pp0 = playerPos(), ip = V3(pp0.x + fwd().x*1.6, 1.2, pp0.z + fwd().z*1.6);
      spawnGroundShock(V3(ip.x, 0.1, ip.z), st.blade, 5.5, 0.34, 0.6);
      spawnGroundShock(V3(ip.x, 0.1, ip.z), 0xffffff, 8, 0.5, 0.3);
      scorchGround(ip, 2.4);   // the blade bites the floor
      inkSprite({ pos: ip, shape: 'star', points: 10, sharp: 0.14, color: st.blade, size: [1.6, 4.6], life: 0.2, steps: 2, coreW: 0.38 });   // the cel shockburst
      sparks(ip, st.blade, 18, 16, { life: 0.4, size: 0.6 }); sparks(ip, 0xffffff, 8, 18, { life: 0.3 });
      burst(ip, 0x9a9a9a, 8, 9, 6, 1.1);   // chips of stone
      spawnHitSpark(ip, 0xffffff, 2.0);
      screenFlash('radial-gradient(ellipse at center, rgba(180,90,255,.4), transparent 62%)', 0.7, 0.3);
      S.slam(ip); S.clash(ip, true);
    }
  }
}

/* JAR'KAI'S FOLLOW-UP (jedi/bladehit.js sweepOffBlade): the off hand's blade strikes what it passed through, on the
   SAME line as the lead cut, a beat behind it (both blades travel the same way: anim/saber.js dualSwing), so a guard
   that caught the lead cut has to hold for the second. Damage and posture
   only: `offDmg` of the lead cut, no fury, Focus, Force or boon effects (those fire once a swing, on the lead cut), so
   two blades are one cut's budget. It still beats a wind-up, which is the form's whole point. It doesn't count toward a
   duellist's read of a mash (its rhythm), or Jar'Kai would be parried for swinging at all. */
export function applyOffBladeHit(only){
  const st = stance(), sw0 = player.swing;
  if (!sw0 || !only || !only.length || !st.offDmg) return;
  const step = sw0.step || 0, finisher = step === 2;
  const dmg = CFG.player.comboDamage[step] * st.dmg * player.up.dmg * focusDmgMul() * furyMul() * st.offDmg * cutMul(sw0, 'dmg');
  const knock = (finisher ? 10 : 4) * st.knock * player.up.knock * cutMul(sw0, 'knock');
  const f = fwd(), line = cutLine(sw0) || 'H';
  const finFoe = sw0.fin ? sw0.fin.e : null;
  let hits = 0, turned = 0, blocker = null;
  for (const e of only){
    if (e === shared.boss){
      if (e.hp > 0 && e !== finFoe){ scarBody(e.group, f, 'neutral', false); damageBoss(dmg * st.heavyDmg * edgeMul(e)); hits++; }
      continue;
    }
    if (e.dead || e.converted || e === finFoe) continue;
    if ((!sw0.riposte || skilled(e)) && !sw0.back){
      const n = e.rhyN, a = e.rhyAt;
      const at = sw0.offAt && sw0.offAt.get(e);
      const dres = duelDefend(e, line, sw0.riposte ? 'riposte' : finisher ? 'finisher' : 'cut', false, at && at.at);
      if (e.rhyN !== undefined){ e.rhyN = n; e.rhyAt = a; }   // (not part of a mash: see above)
      if (dres === 'block' || dres === 'dodge'){ turned++; if (!blocker) blocker = e; continue; }
    }
    const at = sw0.offAt && sw0.offAt.get(e);
    damageEnemy(e, perfectStrike(e, dmg * (e.t.heavy ? st.heavyDmg : 1) * edgeMul(e), f.x, f.z), f.clone(), knock, false, false, bladeOpts(at));
    scarBody(e.group, f, sw0.dir === 'left' ? 'right' : sw0.dir === 'right' ? 'left' : sw0.dir, false, at);
    if (e.dead) severLimbs(e, f, 0.35, at);
    else interruptEnemy(e, f, false);   // the second blade gets inside the wind-up
    hits++;
  }
  if (hits){ G.shake = Math.max(G.shake, 0.15); tutEvent('offBlade'); }
  if (turned && !hits) S.clash(V3(playerPos().x + f.x * 1.2, 1.4, playerPos().z + f.z * 1.2), false);
}

// JEDI FRONT KICK (E) — the Jedi's hands are full of saber, so the free melee is a leg: a snapping Force-assisted
// front kick that STAGGERS the front rank (a step back and a reel, no launch) to make room. Always available, NO Force cost, light damage — a pure
// space-maker (the Mando's gauntlet-punch counterpart). The short recovery (kickT) keeps it from being mashed.
const JEDI_KICK = { reach: 1.75, arc: 0.62, dmg: 10, knock: CFG.player.kickStagger.knock, recover: 0.4 };   // a stagger, not a launch (config kickStagger)
export function forceKick(){
  if (G.mode !== 'play' || isGunner() || player.kickT > 0 || player.judgeT > 0 || player.mendT > 0 || player.flip || player.slamming || player.hang || player.flinchT > 0) return;
  const A = JEDI_KICK;
  player.kickT = player.kickMax = A.recover; player.kickKind = 'front';
  const f = fwd(), pp = playerPos();
  player.vel.addScaledVector(f, 4);   // drive into the kick for weight
  const cosLim = Math.cos(A.arc);
  let hit = 0;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn') continue;
    TMP.subVectors(e.group.position, pp);
    if (Math.abs(TMP.y) > 2.2) continue;
    TMP.y = 0;
    if (TMP.length() - bodyRadius(e) > A.reach + 4 / 9) continue;   // the boot has to reach the body (+ the step into it)
    const kd = TMP.lengthSq() < 0.001 ? f.clone() : TMP.clone().normalize();
    if (TMP.lengthSq() > 0.001 && kd.dot(f) < cosLim) continue;
    if (isGuarding(e)) guardImpact(e, DUEL.posture.kick);   // a kick is the answer to a guard: it cracks posture wide
    damageEnemy(e, A.dmg, kd, A.knock); flinchEnemy(e, kd, 0.6); hit++;
  }
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group.position.distanceTo(pp) < A.reach + 1.2) damageBoss(A.dmg * 0.5);
  const ip = V3(pp.x + f.x*1.3, 1.0, pp.z + f.z*1.3);
  if (hit){
    tutEvent('kick');
    G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.3);
    burst(ip, 0xbfe8ff, 7, 8, 4, 0.8); spawnHitSpark(ip, 0xcfe0ec, 1.0);
  } else burst(ip, 0xcfe0ec, 3, 5, 3);
  S.jump(); if (hit) S.punch(ip, 1.2);
}

/* DEFLECT ANIMATION — start a blade catch toward something arriving at `from` (a bolt, or a blocked blow). The
   catch itself (which cover, which side) is picked in anim/saber.js. A swing already in flight keeps the blade. */
export function deflectAnim(from, line, contact){
  if (!isGunner() && player.holstered && from && !(player.palmT > 0)){   // no blade to catch it on: a palm flicks out to meet the blow (animation.js forceHands)
    const c = catchState(from);
    player.wardHit = { t: 0, dur: 0.3, side: c.side, h: c.h };
    const hands = palmPoints([c.side > 0 ? 'R' : 'L']);
    if (hands[0]) sparks(hands[0], stance().blade, 4, 6, { dir: V3(0, 0, 0), cone: 3, life: 0.16, grav: 0, size: 0.4 });
    return;
  }
  if (isGunner() || player.atkT > 0 || !from) return;
  const cur = player.deflectAnim;
  if (cur && cur.spin && cur.t < cur.dur) return;   // a spin already sweeping the blade round covers the next bolt too
  // a duellist's blow on the line the guard was already waiting on (jedi/guardline.js): that catch flicks it away
  if (cur && cur.hold && line && cur.line === line && cur.pose){ cur.hold = false; cur.dur = 0.3; cur.t = contact ? 0 : 0.09; if (contact){ cur.contact = contact.clone(); cur.refit = true; } return; }
  player.deflectAnim = catchState(from);
  if (contact) player.deflectAnim.contact = contact.clone();   // world point where the foe's blade is: the saber is fitted to it (anim/saber.js)
  const c = line && lineCatch(line);   // a duellist's strike is caught where its line comes in, not just toward its body
  if (c){ player.deflectAnim.side = c.side; player.deflectAnim.h = c.h; }
  if (!contact) deflectSpin(player.deflectAnim);   // (a twirl would wheel the blade off the one it is meeting)
}
const catchState = (from) => {
  const pp = playerPos(), fy = player.faceYaw;
  const dx = from.x - pp.x, dz = from.z - pp.z, d = Math.hypot(dx, dz) || 1;
  return {
    t: 0, dur: 0.3, pose: null,
    side: (dx * -Math.cos(fy) + dz * Math.sin(fy)) / d,   // + = the weapon (right) side
    h: from.y - (pp.y + 1.4),                              // against the chest
  };
};
/* ANTICIPATED TWIRL (Niman, data/poses.js DEFLECT_SPINS.anticipate) — called by enemies/bolts.js as a bolt comes into
   range, `eta` seconds before the catch. If the catch is certain (a parry window that will still be open, or a held
   guard) it sometimes starts the blade's twirl now, timed so the bolt lands on the blade as it passes the bottom of
   the wheel (anim/saber.js deflectPose). */
export function anticipateDeflect(from, eta){
  const S = DEFLECT_SPINS[stance().form];
  if (!S || !S.anticipate || isGunner() || player.atkT > 0 || player.deflectAnim || !player.grounded || player.flip) return;
  if (eta < 0.04 || G.gt - (player._dflSpinT || -9) < S.cd || Math.random() > S.anticipate) return;
  if (!(player.parryT >= eta || (player.blockHeld && player.stam > 0))) return;
  const d = catchState(from);
  player._dflSpinT = G.gt;
  player._dflFlip = Math.abs(d.side) > 0.2 ? (d.side > 0 ? 1 : -1) : -(player._dflFlip || -1);
  d.spin = { turns: 0, twirl: S.twirl, side: player._dflFlip };
  d.lead = eta; d.dur = eta + S.dur;
  player.deflectAnim = d;
}
/* A catch can become a spin (data/poses.js DEFLECT_SPINS): on the move, or the second bolt of a volley. Jedi, grounded. */
function deflectSpin(d){
  const S = DEFLECT_SPINS[stance().form], recent = player._dflHits || (player._dflHits = []);
  while (recent.length && G.gt - recent[0] > 1.5) recent.shift();
  recent.push(G.gt);
  if (!S || !player.grounded || player.flip || G.gt - (player._dflSpinT || -9) < S.cd) return;
  const moving = Math.hypot(player.moveVel.x, player.moveVel.z) > 2;
  const volley = recent.length >= 2 && G.gt - recent[recent.length - 2] < S.volley;
  if (!moving && !volley) return;
  player._dflSpinT = G.gt;
  if (Math.abs(d.side) > 0.2) player._dflFlip = d.side > 0 ? 1 : -1;
  else player._dflFlip = -(player._dflFlip || -1);
  d.spin = { turns: S.turns, twirl: S.twirl, side: player._dflFlip };
  d.dur = S.dur;
  if (S.step && moving){   // a short step on in the direction of travel: the spin covers ground
    TMP.set(player.moveVel.x, 0, player.moveVel.z).normalize();
    player.vel.addScaledVector(TMP, S.step * 4);
  }
}
