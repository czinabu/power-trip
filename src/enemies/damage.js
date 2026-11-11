// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// damageEnemy(), flinch/stagger, targeting helpers, wind-up telegraphs.

import { S } from '../audio/sfx.js';
import { V3, rand, clamp, TMP, dampToward } from '../utils.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { shared, G, enemies, player, isGunner } from '../state.js';
import { fwd, playerPos, stance, maxHp } from '../player/helpers.js';
import { volatileBlast } from './elites.js';
import { bomberExplode, flyerBlowUp } from './specials.js';
import { FOCUS, addFocus } from '../player/jedi/focus.js';
import { spawnHitSpark, spawnGroundShock } from '../fx/vfx.js';
import { sparks } from '../fx/ink.js';
import { DEFEAT } from '../data/defeats.js';
import { addStreak } from '../player/damage.js';
import { gainXp, killBonus } from '../game/progression.js';
import { ENGAGE } from '../data/enemies.js';
import { DUEL } from '../data/duel.js';
import { CFG } from '../data/config.js';
import { dropToken } from './director.js';
import { tutEvent } from '../game/tutor-bus.js';
import { officerDown } from './tactics.js';
import { hideIndicators } from './cleanup.js';
import { duelWon } from './guardcue.js';
import { bossDown } from '../game/autosave.js';
import { SQUAD } from '../data/allies.js';
import { TROOPER } from '../data/trooper.js';
import { gainCP } from '../player/trooper/command.js';
import { queueHit, hooks, coopRun } from '../net/run.js';
import { teamCheck } from '../game/teamstrike.js';
import { foeBeaten, foeFell, MERC } from '../game/alignment.js';
import { killPerks, squadKillPerks } from '../game/creed.js';
import { MERCY } from '../data/alignment.js';
import { killCam, killCamOn } from '../engine/killcam.js';
import { addFlow, flowKill } from '../player/gunner-flow.js';
import { mutOn } from '../data/ngplus.js';
import { roleTags, takesRoles } from '../boss/roles.js';
import { pickCuts } from './scars.js';
import { noteTrophy } from '../game/hub-growth.js';   // (the Warbringer down: a trophy for the hub's hall)
import { SIM_WATCH } from '../game/sim-watch.js';

/* opts.launch === false: a blow with no rocket behind it (the Mandalorian's fists, knee and blade). It never floors or
   throws a live foe (the caller staggers or shoves it), and a foe it kills crumples where it stands instead of flying. */
/* opts.shove: a blade's blow (data/config.js player.saberShove): whatever it floors or kills goes no faster than this
   across the ground, and only a little up: a heavy stagger and a short shove, not a launch. */
/* opts.slide: a Force shove (Force Push and Pull, the saber lock's Force shove). Whatever it is too light to floor (or can
   never be floored: champions, final bosses) it still SKIDS across the ground and reels (shoveSlide, below) instead of
   standing put. A number is the most ground it may cover, skidding or thrown (a Pull stops short of the hero). */
const SLIDE_THROW = 0.45;   // about the ground a floored foe covers per point of knock (its throw, bounce and settle)
const slideCap = (v, opts) => opts && typeof opts.slide === 'number' ? Math.min(v, opts.slide / SLIDE_THROW) : v;
/* opts.ally: a squadmate's bolt (allies/squad.js). It lands as plain damage: no opening bonus, no hitstop or shake, and a
   kill it makes pays SQUAD.killXp of the XP and feeds no streak, Focus, lifesteal or boon (data/allies.js). */
// how fast a floored or killed foe leaves across the ground: a blade's shove is capped (opts.shove), anything else is not
const shoveCap = (v, opts) => opts && opts.shove ? Math.min(v, opts.shove) : v;
/* SPARED (game/alignment.js): a foe that yielded, let go. It leaves the fight beaten, as a kill would, and pays the
   same bounty, so mercy never costs a run anything: it bows out instead of falling */

/* THE FOE'S OWN FREEZE — solo, a hitstop freezes the whole fight, the foe you struck with it. In a shared co-op fight the
   world runs on real time whatever one hero's hitstop does (main.js), so the foe you hit kept walking through your
   freeze and blows felt light. There, the struck foe holds for the freeze instead (ai.js and net/foes.js read freezeT),
   so the blow lands on a body that stops for it, as it does solo. */
export function foeFreeze(e, s){ if (coopRun.live && e && s > 0) e.freezeT = Math.max(e.freezeT || 0, s); }

export function spareEnemy(e){
  if (e.dead || e.net) return false;
  e.dead = true; e.spared = true; e.yielding = false; e.state = 'spared'; e.st = MERCY.bow;
  e.vel.set(0, 0, 0);
  hideIndicators(e);
  tutEvent('kill', e);
  if (e.dp) duelWon(e);
  if (!e.converted){
    const xp = e.t.score * 4 * killBonus() * (e.elite ? 1.6 : 1);
    gainXp(xp); if (hooks.xp) hooks.xp(xp);
    if (G.stats) G.stats.kills++;
    gainCP(e.elite || e.champion ? 'elite' : 'kill');
  }
  addFocus(FOCUS.gainKill);
  return true;
}
/* A CO-OP GUEST'S BLOW on one of the host's foes (a puppet here, net/foes.js). The host applies the damage and sends the
   result back a round trip later; this screen plays the blow the moment it lands, as damageEnemy would for a foe of its
   own: the flash, the body rocking with it, the sparks, the number, the thump, the micro-freeze, and on a blow that will
   kill, the kill's beat. A killing saber cut picks the parts it goes through here, off this player's own blade, and the
   host takes those same parts if the blow kills it there (enemies/scars.js pickCuts), so the cut lands where it was aimed. */
const NET_KILL_HOLD = 0.6;   // seconds a puppet this player has just killed is taken as dead for the kill's beat (the host's word follows)
function netBlow(e, dmg, knockDir, knockPow, isFinisher, tick, opts){
  if (opts && opts.ally) return;
  const p = e.group.position, kill = !tick && dmg > 0 && e.hp > 0 && dmg >= e.hp && !(e.netKillT > G.gt - NET_KILL_HOLD);
  let cut;
  if (opts && opts.blade && !tick && dmg > 0 && knockDir){
    const f = knockDir.clone().setY(0); if (f.lengthSq() > 1e-6) f.normalize();
    const P = pickCuts(e, f, isFinisher ? 0.8 : 0.45, opts.at ? opts : undefined);
    cut = P ? P.mask : 0;
    if (P) e.cutHint = { dir: P.dir, n: P.n, t: G.gt };   // which way the pieces go when the host's word arrives (net/foes.js)
  }
  queueHit(e, dmg, knockDir, knockPow, isFinisher, tick, opts && opts.shove, opts && opts.blade, opts && opts.bodyShield, opts && opts.slide, takesRoles(e) && !tick ? roleTags(e, opts) : 0, cut);   // (a raid boss: what kind of blow it was, seen from here: boss/roles.js)
  if (kill){ flowKill(e, knockDir); e.netKillT = G.gt; }   // (a blow that will kill it feeds the guest's own flow meter: player/gunner-flow.js)
  if (tick){   // a flame or a held power: embers and pooled numbers, no freeze
    e.burn = (e.burn || 0) + dmg;
    if (e.burn >= 9){ floater(V3(p.x, p.y + 1.6, p.z), Math.round(e.burn), '#ff9a3a'); e.burn = 0; }
    if (Math.random() < 0.5) burst(V3(p.x + rand(-0.3, 0.3), p.y + rand(0.9, 1.9), p.z + rand(-0.3, 0.3)), Math.random() < 0.5 ? 0xff7a1a : 0xffd24a, 1, 2, 3, 0.6);
    return;
  }
  if (!(dmg > 0)) return;
  const cp = opts && opts.at ? opts.at.clone() : V3(p.x, p.y + 1.45, p.z);   // where the blade met it (bladehit.js), else the torso
  const col = isGunner() ? 0xffb84a : stance().blade, power = clamp(dmg / 38, 0.45, 1.7);
  e.flash = Math.max(e.flash || 0, 0.16);
  burst(V3(p.x, p.y + 1.4, p.z), 0x66ccff, 4, 5, 4);
  if (knockDir){
    const kd = knockDir.clone().setY(0); if (kd.lengthSq() > 1e-6) kd.normalize();
    if (!kill) hitReact(e, kd, 0.18 + power * 0.22, opts && opts.fold, opts);
    sparks(cp, 0xffffff, Math.round(2 + power * 1.5), 7 + power * 3, { dir: kd, cone: 0.8, life: 0.18, size: 0.36 });
    sparks(cp, col, Math.round(2 + power * 1.5), 6 + power * 3, { dir: kd, cone: 1, life: 0.2, size: 0.36 });
  }
  spawnHitSpark(cp, col, power);
  if (kill){
    G.hitstop = Math.max(G.hitstop, isFinisher ? 0.1 : 0.05); G.shake = Math.max(G.shake, 0.38); foeFreeze(e, isFinisher ? 0.1 : 0.05);
    S.kill(cp, !!e.t.heavy); S.killSting(!!e.t.heavy);
    burst(V3(p.x, p.y + 1.2, p.z), 0xffaa44, 12, 8, 5);
    spawnHitSpark(cp, 0xffcc55, power * 1.3);
  } else {
    G.hitstop = Math.max(G.hitstop, 0.02 + power * 0.028); G.shake = Math.max(G.shake, 0.12 + power * 0.13); foeFreeze(e, 0.02 + power * 0.028);
  }
  if (!(opts && opts.slide)) floater(p, Math.round(Math.min(dmg, Math.max(e.hp, 1))), kill ? '#ffd24a' : '#bfe8ff');
  S.impact(cp, power);
}
export function damageEnemy(e, dmg, knockDir, knockPow, isFinisher, tick, opts){
  if (e.dead) return;
  if (e.net){ netBlow(e, dmg, knockDir, knockPow, isFinisher, tick, opts); return; }   // a foe the host owns (co-op): the host applies it, here only the feel
  if (e.ward != null){ if (!e.ward && dmg > 0) return; dmg *= e.ward; }   // warded by a mission twist: untouchable (0), or taking less (game/twists/)
  if (e.dmgRule){ const r = e.dmgRule(e, dmg, tick, opts, knockDir); if (r === null) return; dmg = r; }   // a final boss's own rules on what lands (boss/finale.js)
  const byAlly = !!(opts && opts.ally);
  if (e.scanT > G.gt && dmg > 0) dmg *= e.scanMul || 1;   // marked by the ARC trooper's recon scan (player/trooper/abilities.js)
  if (e.spotT > G.gt && dmg > 0 && !byAlly) dmg *= e.spotMul || 1;   // called out by the Mando's foundling (allies/apprentice.js): your blows land harder
  // the ARC trooper's SUPPRESS order (allies/squad.js): a squad bolt that lands in the zone PINS its foe (enemies/ai.js)
  const sup = G.suppress;
  // (and the trooper's heavy, HAMMER, pins whatever its rotary hits: data/allies.js `pins`)
  if (byAlly && dmg > 0 && ((opts && opts.pin) || (sup && sup.until > G.gt && Math.hypot(e.group.position.x - sup.x, e.group.position.z - sup.z) < sup.r + 2))){
    if (!(e.suppT > G.gt)) floater(V3(e.group.position.x, e.group.position.y + 2.2, e.group.position.z), 'PINNED', '#ffd35a');
    e.suppT = G.gt + TROOPER.command.suppress.pin;
  }
  const guest = MERC.guest;   // a co-op guest's blow, applied here for them (net/foes.js): its feel and this hero's boons are theirs, not this hero's
  if (dmg > 0 && !byAlly && !guest){
    player.lastStrikeT = G.gt;   // a blow landed keeps you in the fight (player/mobility.js)
    if (!tick){ G.squadFocus = e; G.squadFocusT = G.gt; }   // the squad prefers the trooper you're fighting
  }
  if (e.state === 'stasis') dmg *= 1.5;   // frozen targets shatter harder
  if (e.state === 'stagger') dmg *= 1.5;  // a parried, stumbling foe is wide open
  // an OPENING: caught recovering from its own swing, a well placed blow lands harder (data/duel.js DUEL.open)
  // (not a bolt burning a body held up as a shield: held in the grasp, it is recovering from nothing)
  else if (!tick && !byAlly && knockDir && dmg > 0 && !e.converted && !(opts && opts.bodyShield) && G.gt < (e.openUntil || 0)){
    dmg *= DUEL.open.dmg;
    if (e.openShown !== e.openUntil){ e.openShown = e.openUntil; floater(V3(e.group.position.x, e.group.position.y + 1.9, e.group.position.z), 'OPENING', '#ffe27a'); }
  }
  // TEAM STRIKE (online co-op): a blow on a foe another hero struck a moment ago lands harder (game/teamstrike.js)
  if (!tick && !byAlly && knockDir && dmg > 0 && !e.converted) dmg *= teamCheck(e, guest ? 'g' + (MERC.from ?? '') : 'me');
  // SENTINEL frontal deflector — chip damage from the front mostly bounces; FLANK it, or break the guard with a
  // finisher / Djem-So heavy / a RIPOSTE. The shield shatters once depleted, leaving it open & staggered.
  // (a body held up as a HUMAN SHIELD takes its own side's fire on the back and flank, limp: no deflector, enemies/bolts.js)
  if (e.t.shield && !e.shieldBroken && knockDir && !tick && dmg > 0 && !(opts && opts.bodyShield)){
    const ang = e.group.rotation.y, efx = Math.sin(ang), efz = Math.cos(ang);
    // (where the blow came from: this hero, or for a guest's blow, back along its own way)
    const dpx = guest ? -knockDir.x : playerPos().x - e.group.position.x, dpz = guest ? -knockDir.z : playerPos().z - e.group.position.z;
    const dl = Math.hypot(dpx, dpz) || 1;
    if ((efx*dpx + efz*dpz)/dl > 0.3){   // attacker is in the shield's frontal arc
      const guardBreak = !!isFinisher || (!guest && ((!isGunner() && G.stance === 'djemso') || !!(player.swing && player.swing.riposte)));
      e.shieldHp -= dmg * (guardBreak ? 2.4 : 1.0);
      const sp = V3(e.group.position.x + efx*0.55, 1.45, e.group.position.z + efz*0.55);
      spawnHitSpark(sp, e.t.eye, 0.8);
      if (!isGunner() || player.darkT > 0 || shared.saberProj) S.saberHit(sp, 1); else S.shieldHit(sp);   // a saber on it: the clash
      if (e.shieldHp <= 0){
        e.shieldBroken = true;
        if (e.group.userData.shield) e.group.userData.shield.visible = false;
        floater(e.group.position, 'GUARD BROKEN', '#ffd24a');
        burst(sp, e.t.eye, 16, 9, 6); G.shake = Math.max(G.shake, 0.35);
        staggerEnemy(e, -efx, -efz);     // shattering the guard staggers it wide open
        dmg *= guardBreak ? 0.7 : 0.35;  // the breaking blow still bleeds some through
      } else {
        dmg *= guardBreak ? 0.5 : 0.12;  // chip mostly deflects off the front
        if (!guardBreak) floater(e.group.position, 'BLOCKED', '#8fbfe0');
      }
    }
  }
  // EXECUTIONER boon — a hit that would leave a normal foe under 22% finishes it outright (not bosses/champions)
  if (player.boon && player.boon.exec && !byAlly && !guest && !tick && knockDir && dmg > 0 && !e.warbringer && !e.champion && e.maxHp && (e.hp - dmg) > 0 && (e.hp - dmg) < e.maxHp*0.22){
    dmg = e.hp; floater(V3(e.group.position.x, e.group.position.y+1.7, e.group.position.z), 'EXECUTE', '#ff7a7a');
  }
  // a JET TROOPER caught by a big blast (see blastKnock in data/enemies.js) doesn't get knocked about: its pack goes up
  const blownUp = e.t.fly && e.t.blastKnock && knockDir && !tick && knockPow >= e.t.blastKnock && !(opts && opts.launch === false);
  if (blownUp) dmg = Math.max(dmg, e.hp);
  if (SIM_WATCH.hit && dmg > 0) SIM_WATCH.hit(e, Math.min(dmg, Math.max(0, e.hp)), opts);   // (the sims: who did the work, game/sim-watch.js)
  e.hp -= dmg;
  e.flash = Math.max(e.flash, tick ? 0.06 : 0.16);
  const p = e.group.position;
  const cp = opts && opts.at ? opts.at.clone() : V3(p.x, p.y + 1.45, p.z);   // where the blade met it (bladehit.js), else the torso
  const col = (isGunner()) ? 0xffb84a : stance().blade;
  const power = clamp(dmg / 38, 0.45, 1.7);
  const meaty = !!knockDir && !tick;                         // saber/blaster/rocket land with weight; DoT ticks stay light
  if (tick){
    // FLAMETHROWER / damage-over-time: NO hitstop / sfx / floater spam — just embers + pooled numbers
    e.burn = (e.burn || 0) + dmg;
    if (e.burn >= 9){ floater(V3(p.x, p.y+1.6, p.z), Math.round(e.burn), '#ff9a3a'); e.burn = 0; }
    if (Math.random() < 0.5) burst(V3(p.x + rand(-0.3,0.3), p.y + rand(0.9,1.9), p.z + rand(-0.3,0.3)), Math.random()<0.5?0xff7a1a:0xffd24a, 1, 2, 3, 0.6);
  } else {
    burst(V3(p.x, p.y+1.4, p.z), 0x66ccff, 4, 5, 4);
    if (meaty){
      // a spray of sparks off the hit + a bright impact flash & ring — every connect reads as a real hit
      const kd = knockDir.clone().setY(0).normalize();
      if (e.hp > 0) hitReact(e, kd, 0.18 + power * 0.22, opts && opts.fold, opts);   // the body rocks with the blow
      sparks(cp, 0xffffff, Math.round(2 + power*1.5), 7 + power*3, { dir: kd, cone: 0.8, life: 0.18, size: 0.36 });
      sparks(cp, col, Math.round(2 + power*1.5), 6 + power*3, { dir: kd, cone: 1, life: 0.2, size: 0.36 });
      spawnHitSpark(cp, col, power);
      if (e.hp > 0 && !byAlly && !guest){   // (a guest's blow freezes and shakes their screen, not this one: netBlow)
        G.hitstop = Math.max(G.hitstop, 0.02 + power*0.028);   // a micro-freeze on impact — the core of "punch"
        foeFreeze(e, 0.02 + power*0.028);   // (co-op: the struck foe holds for it too)
        G.shake   = Math.max(G.shake,   0.12 + power*0.13);
      }
    }
    if (dmg > 0 || !(opts && opts.slide)){   // (a Force Pull's haul does no damage: no number, no thump)
      floater(p, Math.round(dmg), byAlly ? '#8ea2b4' : e.hp <= 0 ? '#ffd24a' : '#bfe8ff');
      S.impact(cp, power);
    }   // voiced by what landed it: saber burn, blaster pop, or a thump
  }
  if (e.sparring && e.hp < 1){ e.hp = 1; tutEvent('sparDown', e); }   // TRAINING: a sparring partner takes the blow but never falls (beating it down still counts)
  if (e.hpFloor && e.hp < e.hpFloor) e.hp = e.hpFloor;   // MISSIONS: a fleeing quarry breaks away at this, it doesn't fall
  if (e.hp > 0 && dmg > 0 && !tick) foeBeaten(e);   // LIGHT AND DARK: a beaten duellist yields, its blade thrown down (game/alignment.js)
  if (e.hp <= 0){
    e.dead = true; e.state = 'ragdoll'; e.st = 0;
    hideIndicators(e);   // bars, laser sight, lunge line: gone with the life, not a frame later (cleanup.js)
    foeFell(e, byAlly);   // struck down while it had yielded: the dark (game/alignment.js)
    tutEvent('kill', e);
    if (e.dp) duelWon(e);   // a duellist down: its guard ring fades a little more as you learn the blade (enemies/guardcue.js)
    if (e.warbringer && !e.converted){ bossDown(); noteTrophy('warbringer'); }   // the Warbringer down: the game saves (game/autosave.js)
    if (blownUp) flyerBlowUp(e);
    if (e.t.bomber && !e._blew) bomberExplode(e);   // a SABOTEUR killed before its fuse still goes off — don't kill it point-blank
    if (e.t.officer) officerDown(e);   // an OFFICER down: the squad around it falters (tactics.js)
    const d = knockDir ? knockDir.clone().setY(0) : fwd();
    if (opts && opts.launch === false){   // folds up and drops: a step back with the blow, then onto its back
      e.crumple = true;
      e.vel.copy(d.multiplyScalar(Math.min(knockPow || 0, 8) * 0.35));
      e.vel.y = 1.5;
    } else {
      // a blade's killing cut throws the body along the blade's way as well as off the hero, and a sideways sweep
      // spins it as it goes (data/defeats.js thrown; a cut that takes a part off plays its own fall: enemies/defeat.js)
      const sw = opts && opts.blade && opts.cut;
      if (sw && d.lengthSq() > 1e-6){
        const T = DEFEAT.thrown, l = Math.hypot(sw.x, sw.z), dl = d.length();
        if (l > 1e-4){
          const side = (sw.x * -d.z + sw.z * d.x) / (l * dl);   // the sweep across the blow: + to the blow's left
          d.multiplyScalar(1 / dl).addScaledVector(V3(sw.x / l, 0, sw.z / l), T.sweep).normalize();
          e.fallYaw = side * T.spin;
        }
      }
      e.vel.copy(d.multiplyScalar(slideCap(shoveCap((knockPow||14) * (e.t.heavy ? 0.5 : 1), opts), opts)));
      e.vel.y = (opts && opts.shove ? rand(...CFG.player.saberShove.lift) : rand(5, 9)) * (e.t.heavy ? 0.6 : 1);
    }
    if (byAlly){
      // the squad's kill: a share of the bounty, none of the hero's rewards
      if (opts.by && opts.by.onKill) opts.by.onKill(e);   // an apprentice's kill grows them (allies/apprentice.js)
      if (!e.converted){ gainXp(e.t.score * 4 * SQUAD.killXp); if (G.stats) G.stats.squadKills = (G.stats.squadKills || 0) + 1; gainCP('squadKill'); addFlow('squadKill'); squadKillPerks(); if (hooks.sqk) hooks.sqk(); }   // (co-op: the shared squad's kill feeds the guest's BATTLE RHYTHM too)
      S.kill(cp, !!e.t.heavy);
      burst(V3(p.x, p.y+1.2, p.z), 0xffaa44, 8, 6, 4);
      return;
    }
    if (!guest){ G.hitstop = Math.max(G.hitstop, isFinisher ? 0.1 : 0.05); G.shake = Math.max(G.shake, 0.38); foeFreeze(e, isFinisher ? 0.1 : 0.05); }
    addStreak(e.t.score);
    if (!e.converted){
      const xp = e.t.score * 4 * killBonus() * (e.elite ? 1.6 : 1);
      gainXp(xp); if (hooks.xp) hooks.xp(xp);   // co-op: the partner earns the kill too
      if (G.stats) G.stats.kills++;
      gainCP(e.elite || e.t.heavy || e.champion || e.warbringer ? 'elite' : 'kill');   // the ARC trooper's COMMAND POINTS
    }   // small per-kill bounty, ×1–3 on a kill streak, elites pay more
    if (e.elite === 'volatile' && !e.converted){ if (e.group.userData.eliteRing) e.group.userData.eliteRing.visible = false; volatileBlast(p.clone(), e); }
    else if (mutOn('volatile') && !e.converted) volatileBlast(p.clone(), e);   // VOLATILE mutator: every corpse erupts
    S.kill(cp, !!e.t.heavy); if (!guest) S.killSting(!!e.t.heavy);
    if (!MERC.guest) killPerks(e.suppT > G.gt, p);   // the per-kill cards: lifesteal, the paths' (game/creed.js; a co-op guest's kill pays on their screen: net/foes.js)
    if (player.boon && !guest){   // (this hero's boons pay on this hero's kills)
      if (player.boon.blood) player.hp = clamp(player.hp + maxHp()*0.04, 0, maxHp());                          // BLOODTHIRST boon
      if (player.boon.momentum){ player.momentumStacks = Math.min(5, (player.momentumStacks||0)+1); player.momentumT = 5; }  // MOMENTUM boon
    }
    addFocus(FOCUS.gainKill);   // FORCE FOCUS — a felled foe feeds the flow
    burst(V3(p.x, p.y+1.2, p.z), 0xffaa44, 12, 8, 5);
    spawnHitSpark(cp, 0xffcc55, power*1.3);
    if (!e.converted && !shared.boss){
      let hostiles = 0;
      for (const o of enemies) if (!o.dead && !o.converted) hostiles++;
      // the last of the fight down: THE KILL CAM (engine/killcam.js), or with it off (or no room for it) the old slow-mo dip
      // (a co-op guest's kill, applied here for them, never moves this hero's lens)
      if (hostiles === 0 && G.spawnQueue.length === 0 && !guest && !killCam('last', e) && !killCamOn()){ G.slowmo = 0.3; G.slowmoT = 0.5; }
    }
    if (!e.converted) flowKill(e, knockDir);   // the gunners' flow meters (player/gunner-flow.js): after the last-foe beat, so it keeps its shot
  } else if (opts && opts.launch === false){
    // no launch: the caller decides how it reels (a flinch, a shove, a stagger)
  } else if (opts && opts.slide && knockDir && !tick && (e.noFloor || knockPow <= (e.t.heavy ? 26 : 16))){
    shoveSlide(e, knockDir, knockPow, typeof opts.slide === 'number' ? opts.slide : Infinity);   // a Force shove under the knockdown bar: a skid on its feet, not a launch
  } else if (knockDir && knockPow > 16 && !e.t.heavy && !e.noFloor){
    // a LIVE knockdown — controlled tip-back, stops acting, then gets up (NOT the free-spin death ragdoll).
    // A JET TROOPER drops out of the air too, and the crash breaks its jetpack (ai.js knockdown).
    e.state = 'knockdown'; e.st = 0.7;
    e.vel.copy(knockDir.clone().multiplyScalar(slideCap(shoveCap(knockPow, opts), opts)));
    e.vel.y = opts && opts.shove ? rand(...CFG.player.saberShove.lift) : rand(4, 7);
  } else if (knockDir && e.t.heavy && !e.noFloor){
    if (knockPow > 26){   // only truly heavy blows (Strong stance, Slam, Repulse) floor a brute
      e.state = 'knockdown'; e.st = 0.95;   // brutes stay down a touch longer
      e.vel.copy(knockDir.clone().multiplyScalar(slideCap(shoveCap(knockPow * 0.5, opts), opts)));
      e.vel.y = opts && opts.shove ? 3 : 4.5;
    } else {
      nudgeFoe(e, knockDir, 0.8);  // otherwise brutes only stagger (rocked back a step)
      // ...and a light blow does NOT break a brute's wind-up or swing: parry it, floor it, or get clear
      if (e.state !== 'windup' && e.state !== 'strike'){ e.state = 'recover'; e.st = 0.5; }
    }
  }
  // the Jedi's front kick (config kickStagger): a short step back and a stagger, never a launch (its knock sits under the knockdown bar)
  if (knockDir && knockPow === CFG.player.kickStagger.knock && !e.dead && !tick && !byAlly && !(opts && opts.slide)){
    const K = CFG.player.kickStagger;
    nudgeFoe(e, knockDir.clone().setY(0).normalize(), K.step * (e.t.heavy ? 0.4 : 1));
    staggerEnemy(e, knockDir.x, knockDir.z, 'STAGGERED');
    e.st = K.stun * (e.t.staff ? 1.3 : e.t.heavy ? 1.2 : 1);
  }
  // ECHO STRIKE boon — the blow rings out a second time for 40% (only if the first didn't kill; guarded vs recursion)
  if (player.boon && player.boon.echo && !byAlly && !guest && !tick && knockDir && !e.dead && !e._echoing && dmg > 0){
    e._echoing = true; damageEnemy(e, dmg*0.4, knockDir, 0, false, false); e._echoing = false;
  }
}

/* A KNOCKED STEP — the short shove a blow gives a foe that stays on its feet (a bolt's flinch, a kick, a brute rocked
   back). The ground is the same as it always was, but the body covers it over a few frames (enemies/ai.js runs
   e.nudge, fast off the blow and easing to a stop, with pillars and the arena's edge still in the way) instead of
   jumping there in one. A foe the host owns (co-op) is placed by the host's word, so it steps at once as before. */
export function nudgeFoe(e, dir, dist){
  if (!e || !dir || !(dist > 0)) return;
  if (e.net){ e.group.position.addScaledVector(dir, dist); return; }
  const n = e.nudge || (e.nudge = { x: 0, z: 0 });
  n.x += dir.x * dist; n.z += dir.z * dist;
}

/* SHOVE SLIDE — a Force shove too light to floor the foe (data/config.js abilities.shove): it skids back along `dir`,
   `knock` × perKnock metres (less for a brute, far less for a champion or final boss), easing to a stop over a few
   tenths (enemies/ai.js runs e.skid, so pillars and the arena's edge still stop it), and reels for `stun` s. A brute
   mid-swing keeps swinging; a champion or final boss never reels, and a move that can't be broken (e.hyper) isn't moved. */
export function shoveSlide(e, dir, knock, most = Infinity){
  if (!e || e.dead || e.converted || e.hyper || !dir) return;
  if (e.state === 'lock' || e.state === 'grasped' || e.state === 'stasis' || e.state === 'spawn' || e.state === 'yield') return;
  const C = CFG.abilities.shove, tough = !!(e.champion || e.warbringer || e.noFloor);
  const d = dir.clone().setY(0); if (d.lengthSq() < 1e-6) return; d.normalize();
  const dist = Math.min(most, Math.max(0, knock) * C.perKnock * (tough ? C.champ : e.t.heavy ? C.heavy : 1));
  if (dist < 0.05) return;
  e.skid = d.multiplyScalar(dist * C.decay);   // a decaying velocity: v0 / decay is the ground it covers
  if (!tough){
    const swinging = e.state === 'windup' || e.state === 'strike';
    if (!(e.t.heavy && swinging) && e.state !== 'stagger' && e.state !== 'knockdown' && e.state !== 'getup'){
      if (swinging){ e.volley = false; if (e.aimLine) e.aimLine.visible = false; easeWeaponHome(e.group, 0.016); if (e.group.userData.bodyMat) e.group.userData.bodyMat.emissiveIntensity = 0; }
      if (e.state !== 'recover' || e.st < C.stun){ e.state = 'recover'; e.st = C.stun; }
    }
  }
  const p = e.group.position;
  burst(V3(p.x, p.y + 0.15, p.z), 0x9a9080, 5, 2.5, 1.5, 0.5);   // dust kicked up at the feet as it goes
}

/* HIT REACTION — the body takes the blow: it rocks away from where the hit came from (back from the front, sideways from
   the flank, twisting off a side hit) and springs back with a little overshoot. Laid ON TOP of whatever the foe is
   doing (ai.js runs the spring), so a swinging foe visibly eats the hit too. fold > 0 doubles it over instead (a knee
   to the gut). amt ~0.3 a jab, ~0.6 a heavy blow. */
export function hitReact(e, dir, amt, fold = 0, at){
  if (!e || e.dead || !dir) return;
  const g = e.group, fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
  const l = Math.hypot(dir.x, dir.z) || 1, dx = dir.x / l, dz = dir.z / l;
  const hf = dx*fx + dz*fz, hr = dx*(-fz) + dz*fx;
  const k = amt * (e.t.heavy ? 0.4 : 1) * 24;
  const r = e.hr || (e.hr = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0 });
  if (at && at.cut && at.zone != null && !fold){ zoneReact(e, r, k, hf, hr, at); return; }
  r.vx += (fold ? fold : hf) * k; r.vz += hr * k * 0.9; r.vy += -hr * k * 0.5;
}
/* WHERE A CUT LANDS (at: player/jedi/bladehit.js — zone 0 legs · 1 torso · 2 head, cut = the tip's travel): the body
   answers that blow, not a generic shove. The flat of the cut twists it the way the blade went; a cut at the head snaps
   the head and shoulders back off it; a cut at the legs buckles the knees and pitches it toward the cut side; a
   falling cut folds the shoulders down, a rising one rocks it up and back. */
const ZONE = { head: { back: 1.25, twist: 0.5, roll: 0.7 }, torso: { back: 0.8, twist: 1.0, roll: 0.9 }, legs: { back: 0.35, twist: 0.4, roll: 1.3, buckle: 0.4 } };
function zoneReact(e, r, k, hf, hr, at){
  const g = e.group, fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
  const c = at.cut, cl = Math.hypot(c.x, c.y, c.z) || 1;
  const side = (c.x * (-fz) + c.z * fx) / cl, vert = c.y / cl;   // the cut's sweep across the foe (+ toward its right), and up / down
  const Z = at.zone === 2 ? ZONE.head : at.zone === 0 ? ZONE.legs : ZONE.torso;
  r.vx += (hf * Z.back + (at.zone === 2 ? -0.35 : 0) + Math.max(0, -vert) * 0.45 - Math.max(0, vert) * 0.35) * k;
  r.vz += (hr * 0.5 + side * Z.roll) * k * 0.9;
  r.vy += -side * Z.twist * k * 0.6;
  if (Z.buckle && !e.t.heavy) e.buckle = Math.max(e.buckle || 0, Z.buckle);   // the knees give (enemies/gait.js)
  if (at.zone === 2){ e.headSnap = 1; e.headSide = side; }                    // the head whips off the cut (enemies/upper.js)
}
// a ranged hit makes a foe physically REACT — recoil back, flinch, maybe drop a wind-up
export function flinchEnemy(e, dir, push){
  if (!e || e.dead || e.converted) return;
  const heavy = !!e.t.heavy;
  e.flinch = Math.max(e.flinch || 0, heavy ? 0.08 : 0.15);
  const d = dir.clone().setY(0); if (d.lengthSq() > 0.0001){ d.normalize(); e.flinchDir = d; nudgeFoe(e, d, push * (heavy ? 0.22 : 1)); }
  // hammering a lightly-armored foe mid-wind-up can stagger the swing right out of them
  if (!heavy && (e.state === 'windup' || e.state === 'strike' || e.state === 'order' || e.state === 'lungewind') && Math.random() < 0.5){ e.state = 'recover'; e.st = 0.3; e.volley = false; easeWeaponHome(e.group, 0.016); }
}
// a clean saber hit knocks a light foe out of its wind-up, so striking first wins the exchange instead of trading.
// POISE: each foe yields at most once per ENGAGE.poise seconds, so poking buys time but can't stun-lock a crowd.
// Brutes never flinch; staff duelists and an intact sentinel guard only yield to a heavy blow (finisher, Djem So,
// darksaber) since they are built to be parried or flanked. A foe that isn't swinging just loses a beat (hit-stun).
export function interruptEnemy(e, dir, heavyBlow){
  if (e.dead || e.converted || e.t.heavy || e.t.bomber || e.warbringer) return false;
  // not swinging yet: a short HIT-STUN instead, so a connecting blade checks a light foe's advance for a beat
  if (e.state === 'chase' && !e.t.fly){
    e.stunT = ENGAGE.hitStun; e.flinch = Math.max(e.flinch || 0, 0.15);
    if (dir){ const d = dir.clone().setY(0); if (d.lengthSq() > 0.0001) e.flinchDir = d.normalize(); }
    return false;
  }
  if (!(e.state === 'windup' || e.state === 'order' || e.state === 'lungewind' || (e.state === 'strike' && !e.struck))) return false;   // an officer's call and a lancer's tell can be cut off too
  if ((e.t.staff || (e.dp && e.dp.lock) || (e.t.shield && !e.shieldBroken)) && !heavyBlow) return false;
  if (G.gt < (e.poiseT || 0)) return false;
  e.poiseT = G.gt + ENGAGE.poise;
  e.state = 'recover'; e.st = 0.5; e.flinch = 0.15;
  e.group.userData.bodyMat.emissiveIntensity = 0;
  if (e.aimLine) e.aimLine.visible = false;
  easeWeaponHome(e.group, 0.016);
  if (dir){ const d = dir.clone().setY(0); if (d.lengthSq() > 0.0001){ e.flinchDir = d.normalize(); nudgeFoe(e, d, 0.35); } }
  if (e.token) dropToken(e, true);
  floater(V3(e.group.position.x, e.group.position.y + 1.2, e.group.position.z), 'INTERRUPT', '#9fe6ff');
  S.clash(V3(e.group.position.x, 1.5, e.group.position.z), false);
  return true;
}

export function nearestEnemyInCone(range, cosLimit, rear){
  let best = null, bestD = range;
  const f = fwd(), pp = playerPos();
  if (rear) f.negate();   // scan the hemisphere BEHIND the player instead
  const consider = (pos, obj) => {
    TMP.subVectors(pos, pp); TMP.y = 0;
    const d = TMP.length();
    if (d > bestD || d < 0.01) return;
    TMP.normalize();
    if (TMP.dot(f) < cosLimit) return;
    bestD = d; best = obj;
  };
  for (const e of enemies) if (!e.dead && !e.converted && e.state !== 'spawn') consider(e.group.position, e);
  if (shared.boss && shared.boss.hp > 0) consider(shared.boss.group.position, shared.boss);
  return best;
}

export function hostileTargetFor(e){
  // converted units pick the nearest non-converted living enemy, else the boss
  let best = null, bd = 1e9;
  for (const o of enemies){
    if (o === e || o.dead || o.converted) continue;
    const d = o.group.position.distanceTo(e.group.position);
    if (d < bd){ bd = d; best = o; }
  }
  if (best) return { pos: best.group.position, enemy: best, boss: false };
  if (shared.boss && shared.boss.hp > 0) return { pos: shared.boss.group.position, enemy: null, boss: true };
  return null;
}

// ease a melee foe's weapon back to its ready carry between strikes
export function easeWeaponHome(g, dt){
  if (g.userData.staff){
    g.userData.staff.rotation.z = dampToward(g.userData.staff.rotation.z, 0.5, dt, 8);
    g.userData.staff.rotation.x = dampToward(g.userData.staff.rotation.x, 0.3, dt, 8);
  } else if (g.userData.weaponArm){
    g.userData.weaponArm.rotation.x = dampToward(g.userData.weaponArm.rotation.x, -0.35, dt, 8);
    g.userData.weaponArm.rotation.z = dampToward(g.userData.weaponArm.rotation.z, 0, dt, 8);
  }
}
// the instant a melee foe commits to a swing — a loud, visible tell so the player can ready a parry
export function telegraphWindup(e){
  if (e.t.ranged || e.converted) return;
  const g = e.group, heavy = !!e.t.heavy;
  const top = V3(g.position.x, heavy ? 3.0 : 2.2, g.position.z);
  burst(top, heavy ? 0xff5522 : e.t.eye, heavy ? 7 : 5, 4, 3, 0.8);
  // a warning ring flares at the foe's feet — reads even in a crowd
  spawnGroundShock(g.position, heavy ? 0xff5522 : e.t.eye, heavy ? 3.2 : 2.2, 0.4, heavy ? 0.6 : 0.45);
  S.windup(top, heavy);
}

// the Sith Lord telegraphs his combo — a roaring charge so the player can ready a parry
export function bossTelegraph(g, tx, tz){
  burst(V3(g.position.x + tx*0.5, 3.0, g.position.z + tz*0.5), 0xff2a40, 10, 5, 4, 0.9);
  spawnGroundShock(g.position, 0xff2a40, 4.2, 0.5, 0.65);
  S.roar(g.position);
}

// a parried foe stumbles: knocked off balance, weapon flung wide, open to a free hit
export function staggerEnemy(e, awayX, awayZ, label){
  if (e.hyper) return;   // mid-move that can't be broken (a final boss's: boss/finale.js)
  const g = e.group;
  e.state = 'stagger';
  e.st = e.t.staff ? 1.5 : (e.t.heavy ? 1.25 : 1.3);   // brutes recover slower; staff foes longest
  e.stumble = 0.28;
  e.flash = 0.12;
  const cp = V3(g.position.x, 1.6, g.position.z);
  burst(cp, 0xffd24a, 14, 7, 4);
  spawnHitSpark(cp, 0xffd24a, 1.3);
  G.hitstop = Math.max(G.hitstop, 0.08);
  G.shake = Math.max(G.shake, 0.4);
  floater(g.position, label || (e.t.heavy ? 'STAGGERED!' : 'PARRIED!'), '#ffe27a', 'key');
  S.parry(cp);
}
