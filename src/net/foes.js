// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The shared Survival fight, co-op phase 2. The HOST's browser owns the foes: it spawns them, runs their AI and the waves,
// and sends where every foe is about 20 times a second (a snapshot). The GUEST's browser draws them as puppets (`e.net`)
// that follow the snapshot and run no AI. What the guest does to a foe is sent back as a hit, which the host applies with
// its own damageEnemy. Foes hurting the guest, their shots and tells are net/foefire.js. Not here yet: shared XP.

import { pickingSeats } from './waits.js';
import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { shared, G, enemies, player } from '../state.js';
import { clearDowned } from '../game/revive.js';
import { killHero } from '../player/damage.js';
import { nameOf } from './names.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { NET } from '../data/coop.js';
import { V3, clamp } from '../utils.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { foeType } from '../enemies/look.js';
import { dressElite } from '../enemies/elites.js';
import { damageEnemy } from '../enemies/damage.js';
import { MERC, tellGuestStruck } from '../game/alignment.js';
import { finaleLook, finaleDress, adoptFinalePuppet, spawnFinale } from '../boss/finale.js';
import { removeEnemy } from '../enemies/cleanup.js';
import { severLimbs, applyCuts, champCuts } from '../enemies/scars.js';
import { defeatLife } from '../enemies/defeat.js';
import { makeBossBar } from '../enemies/spawn.js';
import { updateLegs } from '../enemies/gait.js';
import { updateUpper } from '../enemies/upper.js';
import { burst } from '../fx/particles.js';
import { ENDLESS_ARENAS, rotateEndlessArena, endlessWaveCleared } from '../game/survival.js';
import { checkUnlocks, startLevel, coopCampaignWave, coopCampaignCleared } from '../game/flow.js';
import { beginWave } from '../game/readout.js';
import { showBanner } from '../ui/banners.js';
import { MUSIC } from '../audio/music.js';
import { playerPos } from '../player/helpers.js';
import { missionSnap, coopMissionSync, endMission, takeOverMission, startCoopMission } from '../game/mission.js';
import { followChapter, chapters } from '../game/campaign.js';
import { chapterMutators } from '../data/ngplus.js';
import { damageBoss, bossStagger, bossStun, makeBossPuppet, dropBossPuppet } from '../boss/boss.js';
import { net, on, send, sendTo, connected } from './session.js';
import { calmSnap, calmSync } from '../game/aftermath.js';
import { coopRun, hitQueue, striker } from './run.js';
import { partnerMate } from './partner.js';
import { STANCES } from '../data/stances.js';
import { masterBlade } from '../data/saber-cast.js';
import { duelRec, updatePuppetDuel, netProfile, updateSaberLock, LOCK } from '../enemies/duel.js';
import { meetFoe, meetWarbringer } from '../game/codex.js';
import { duelWon } from '../enemies/guardcue.js';
import { bossDown } from '../game/autosave.js';

const DEAD = 1, WALKING = 2, WARBRINGER = 4;
let sentAt = 0, hitsAt = 0, hostSent = false, runListeners = [];
const byNid = new Map();   // the guest's puppets, by the host's number for each foe

// what shared run this browser is hosting: 'e' Survival, 'c' the campaign (its chapters, waves or missions), 'm' a story mission, '' none (training, the sandbox)
export const runKind = () => G.zone ? 'z' : G.endless ? 'e' : G.chapter >= 0 ? 'c' : G.mission ? 'm' : (!G.training && !G.sandbox && !G.hub) ? 'c' : '';
export const coopLive = () => !!G.coopGuest || (hostSent && connected());
export const puppetOf = (nid) => nid === 'B' ? shared.boss : byNid.get(nid) || null;
export function onRunChange(fn){ runListeners.push(fn); }
const runChanged = () => { for (const fn of runListeners) fn(coopRun); };

const r2 = (n) => Math.round(n * 100) / 100;

/* ---------------- host: send the foes ---------------- */
function snapshot(){
  const list = [];
  for (const e of enemies){
    const g = e.group, u = g.userData;
    list.push([e.nid, e.type, r2(g.position.x), r2(g.position.y), r2(g.position.z), r2(g.rotation.x), r2(g.rotation.y), r2(g.rotation.z),
      r2(g.scale.x), Math.round(e.hp), Math.round(e.maxHp), e.state,
      (e.dead ? DEAD : 0) | (e.walking ? WALKING : 0) | (e.warbringer ? WARBRINGER : 0), e.elite || '',
      u.weaponArm ? r2(u.weaponArm.rotation.x) : 0, u.staff ? r2(u.staff.rotation.z) : 0,
      u.bodyMat ? u.bodyMat.emissive.getHex() : 0, u.bodyMat ? r2(u.bodyMat.emissiveIntensity) : 0,
      u.weaponArm ? r2(u.weaponArm.rotation.z) : 0, u.staff ? r2(u.staff.rotation.x) : 0,   // (the weapon's other axis: which line a guard or block covers)
      e.form || '',   // a form master's form: its blade colour (game/mission.js)
      u.weaponArm ? r2(u.weaponArm.rotation.y) : 0, r2(e.cutDrop || 0), e.cutTwist != null ? r2(e.cutTwist) : null, e.cut || 0,
      duelRec(e), e.look || '', e.ff ? e.ff + '|' + e.rank : '']);   // (27: a duellist's form and rank, enemies/foeform.js)   // (26: a saber wielder's look, data/saber-cast.js: the host's duel foe in its own face)   // a duellist's cut: a low sweep's yaw, the hips' drop, the chest's turn (enemies/duel.js); the limbs a saber has taken off (enemies/scars.js); a duellist's guard, posture and breath (duel.js duelRec)
  }
  const bs = shared.boss, bu = bs && bs.group.userData;
  const boss = bs && !bs.net ? [r2(bs.group.position.x), r2(bs.group.position.y), r2(bs.group.position.z), r2(bs.group.rotation.y), r2(bs.group.rotation.x),
    Math.round(bs.hp), Math.round(bs.maxHp), bs.state, bs.phase, bs.kind, bs.enraged ? 1 : 0, bu.hand ? r2(bu.hand.rotation.z) : 0, bu.eyes ? r2(bu.eyes.scale.y) : 1,
    bu.bodyMat ? bu.bodyMat.emissive.getHex() : 0, bu.bodyMat ? r2(bu.bodyMat.emissiveIntensity) : 0,
    bs.hero && !bs.hero.local ? [r2(bs.hero.pos.x), r2(bs.hero.pos.z)] : [r2(playerPos().x), r2(playerPos().z)],
    bu.pivot ? r2(bu.pivot.rotation.x) : 0, bu.pivot ? r2(bu.pivot.rotation.z) : 0] : null;   // (his shoulder: the cut he's swinging, boss/boss.js bossCut)
  return { t: 'e', run: 1, boss, k: runKind(), ms: G.mission && !G.zone ? missionSnap() : undefined, zn: G.zone || undefined, lv: G.levelIdx, ch: G.chapter, a2: G.actTwo, sh: G.chapter >= 0 ? (G.storyHero || G.hero) : undefined, st: G.chapter >= 0 ? G.story : undefined, ng: G.chapter >= 0 && G.ngPlus > 0 ? G.ngPlus : undefined, wf: G.waveFrom, ar: G.arenaRot, as: shared.arenaScale || 1, w: G.endless ? G.endlessWave : G.wave, wt: G.waveTotal, ph: shared.levelPhase, af: calmSnap(), mut: G.mut, list };
}

function hostTick(){
  const running = net.role === 'host' && connected() && !!runKind() && G.mode === 'play' && !G.coopGuest;
  if (!running){
    if (hostSent && connected()){ send({ t: 'e', run: 0, lost: G.mode === 'dead' ? 1 : 0 }); }   // (lost: the host fell with nobody left standing)
    hostSent = false;
    return;
  }
  const now = performance.now();
  if (now - sentAt < NET.sendMs) return;
  sentAt = now; hostSent = true;
  send(snapshot());
}

// the guest's blows, applied here exactly as if this browser's hero had struck them
on('hits', (m) => {
  if (net.role !== 'host') return;
  let felled = false;
  for (const [id, dmg, kx, kz, kpow, fin, tick, shove, blade, shield, slide, roles, cut] of m.h || []){
    if (id === 'B'){ if (shared.boss && !shared.boss.net) damageBoss(dmg, !!tick); continue; }   // the boss
    const e = enemies.find(o => o.nid === id);
    if (!e || e.dead) continue;
    MERC.guest = true; MERC.struck = false; striker.p = partnerMate(m.from);   // (a yielded foe struck down here is that guest's deed, not this hero's: game/alignment.js)
    const pinned = e.suppT > G.gt;   // (the guest's KILL CONFIRMED asks: game/creed.js)
    try { damageEnemy(e, dmg, kx || kz ? V3(kx, 0, kz) : null, kpow, !!fin, !!tick, shove || shield || slide || e.fin ? { shove: shove || undefined, bodyShield: !!shield, slide: slide === -1 ? true : slide > 0 ? slide : undefined, rt: roles || 0 } : undefined); }   // (rt: a raid boss's role tags from the guest's screen, boss/roles.js)   // (shield: a bolt the guest's held body caught; slide: their Force shove, which skids what it can't floor)
    finally { MERC.guest = false; striker.p = null; }
    if (MERC.struck){ MERC.struck = false; tellGuestStruck(m.from); }
    if (e.dead) sendTo(m.from, { t: 'kb', p: pinned ? 1 : 0, x: +e.group.position.x.toFixed(1), z: +e.group.position.z.toFixed(1) });   // the killing blow was theirs: their kill cards pay out there
    if (!e.dead) continue;
    felled = true;
    // the guest's killing cut takes the parts it went through on their screen (picked there off their blade: enemies/scars.js
    // pickCuts); the snapshot shows them to everyone. (An older guest sends no pick: the cut is rolled here.)
    if (blade && cut != null){ const mask = champCuts(e, cut | 0); if (mask && (!(e.champion || e.warbringer) || Math.random() < 0.5)) applyCuts(e, mask, V3(kx, 0, kz)); }
    else if (blade) severLimbs(e, V3(kx, 0, kz), fin ? 0.8 : 0.4, false);
  }
  if (felled) sentAt = 0;   // a foe the guest felled: the next snapshot goes now, so they see it fall without waiting a beat
});

// a control effect from the guest's powers (floored, thrown, staggered, frozen), put on the real foe
on('ctl', (m) => {
  if (net.role !== 'host') return;
  const e = enemies.find(o => o.nid === m.n);
  if (!e || e.dead || e.converted || e.state === 'spawn' || e.state === 'fade') return;
  if (!CTL[m.s] || (e.t.heavy && m.s !== 'recover' && m.s !== 'stagger')) return;
  e.state = m.s; e.st = m.st; e.heldAt = performance.now();
  if (m.v) e.vel.set(m.v[0], m.v[1], m.v[2]);
});

// a Force power or a parry on the guest's side opens the real boss up
on('bctl', (m) => {
  if (net.role !== 'host' || !shared.boss || shared.boss.net) return;
  if (m.k === 'stagger') bossStagger(); else if (m.k === 'stun') bossStun();
});
// where the guest is holding a foe in its Force grasp
on('gp', (m) => {
  if (net.role !== 'host') return;
  const e = enemies.find(o => o.nid === m.n);
  if (!e || e.dead || !HELD[e.state]) return;
  e.group.position.set(m.p[0], m.p[1], m.p[2]); e.group.rotation.set(m.r[0], m.r[1], m.r[2]);
  e.vel.set(0, 0, 0); e.heldAt = performance.now(); e.clinched = !!m.c;
});

/* ---------------- guest: puppets ---------------- */
function makePuppet(rec){
  const [nid, type, , , , , , , sc, hp, maxHp, state, flags, elite] = rec;
  const t = ENEMY_TYPES[type];
  if (!t) return null;
  const dress = finaleDress(rec[26]);   // a final boss in his own model (the Iron Magistrate: boss/finale.js)
  const g = buildEnemyMesh(dress ? { ...foeType(type), ...dress } : foeType(type), { seed: typeof nid === 'number' ? nid : undefined, look: rec[26] || undefined });   // the host's marking and face (enemies/spawn.js), a duel foe's look
  g.scale.setScalar(sc);
  if (elite) dressElite(g, elite);
  if (rec[20] && STANCES[rec[20]] && g.userData.bladeGlow) g.userData.bladeGlow.material.color.setHex(masterBlade(g.userData.look, STANCES[rec[20]].blade));   // a form master's blade
  const e = { net: true, nid, type, t, group: g, hp, maxHp, state, st: 0, vel: V3(0, 0, 0), flash: 0, hitCd: 0, dead: false,
    netState: state, converted: false, convT: 0, struck: false, stumble: 0, burn: 0, flinch: 0, spd: t.speed, elite: elite || null, shieldHp: 0, shieldBroken: false,
    aimLine: null, want: { pos: V3(rec[2], rec[3], rec[4]), rx: rec[5], ry: rec[6], rz: rec[7] },
    born: state === 'spawn' ? G.gt : -1e9 };   // a foe just arriving (not one already fighting when we joined): ui/threats.js marks it
  g.position.set(rec[2], rec[3], rec[4]);
  if (flags & WARBRINGER){
    e.warbringer = e.champion = true;
    g.userData.bodyMat.color.lerp(new THREE.Color(0xff2a2a), 0.4);   // the crimson cast
    makeBossBar(e);
  }
  scene.add(g);
  enemies.push(e);
  meetFoe(type, g); if (flags & WARBRINGER) meetWarbringer();   // the guest's codex too (game/codex.js)
  if (finaleLook(rec[26])){ e.look = rec[26]; e.champion = true; adoptFinalePuppet(e); }   // the host's final boss: his bar and his phases here too (boss/finale.js)
  return e;
}

function applyRec(e, rec){
  const [, , x, y, z, rx, ry, rz, sc, hp, maxHp, state, flags, , wA, sZ, em, ei, wZ, sX, , wY, drop, twist, cut, duel] = rec;
  e.group.scale.setScalar(sc);
  sendCtl(e);   // a control state put on it here since the last frame goes out before the snapshot overwrites it
  e.hp = hp; e.maxHp = maxHp; e.walking = !!(flags & WALKING);
  if (!e.held && LOCK.foe !== e){   // a foe this player has in the Force grasp, or blade to blade in a saber lock, is theirs to place and pose until they let go
    e.want.pos.set(x, y, z); e.want.rx = rx; e.want.ry = ry; e.want.rz = rz;
    e.state = e.netState = state;
  }
  const dying = !!(flags & DEAD);
  if (dying && !e.dead){ burst(e.group.position, 0x888888, 6, 4, 3); duelWon(e); if (e.warbringer && !e.look) bossDown(); }   // (the host's Warbringer down: this guest saves too, game/autosave.js; a finale boss's own 'down' does: boss/finale.js)   // (a duellist down: enemies/guardcue.js)
  e.dead = dying;
  const u = e.group.userData;
  if (u.weaponArm){ u.weaponArm.rotation.x = wA; if (wZ != null) u.weaponArm.rotation.z = wZ; u.weaponArm.rotation.y = wY || 0; }
  if (cut){   // limbs the host's saber (or the partner's) took: lift them off here too (this player's own cut flies off the way their blade went)
    const h = e.cutHint && G.gt - e.cutHint.t < 3 ? e.cutHint : null;
    applyCuts(e, cut, h && h.dir, h && h.n);
  }
  e.cutDrop = drop || 0; e.cutTwist = twist ?? null;
  e.ng = duel || null;   // its guard as the host holds it: the crescent, the posture bar, and whether it turns this player's cuts (duel.js)
  netProfile(e);         // ...and its profile, as e.dp: bolt deflection, the saber lock, the forms' bonuses against duellists
  if (rec[27]){ const [f, r] = rec[27].split('|'); e.ff = f; e.rank = r; }   // its form and rank: the counter edge and the tag (enemies/foeform.js)
  if (u.staff){ u.staff.rotation.z = sZ; if (sX != null) u.staff.rotation.x = sX; }
  if (u.bodyMat){ e.netEm = em; e.netEi = ei; if (!(e.flash > 0)){ u.bodyMat.emissive.setHex(em); u.bodyMat.emissiveIntensity = ei; } }   // (a blow this player just landed flashes it over the host's glow: updatePuppets)
}

function dropPuppets(){
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].net){ removeEnemy(enemies[i]); enemies.splice(i, 1); }
  byNid.clear();
}

/* HOST HANDOFF (net/session.js takeOver): the host left and this guest has the room now. The old host's foes were only
   puppets here, so the fight it was in starts over on this browser: the same Survival or campaign wave, the boss, or the
   mission's objective. The others rejoin the room and, back in, fight this browser's foes (the 'e' handler above). */
export function takeOver(){
  if (!G.coopGuest) return;
  const boss = shared.levelPhase === 'bossfight' || !!(shared.finale && shared.finale.net);
  G.coopGuest = false; G.coopWasGuest = false;
  dropPuppets(); dropBossPuppet();
  if (shared.finale && shared.finale.net) shared.finale = null;
  if (G.mode !== 'play') return;
  showBanner('', 'THE HOST LEFT · YOU HAVE THE ROOM NOW', 2.6);
  if (G.mission){ if (!takeOverMission()) endMission(); return; }
  if (G.endless){
    if (shared.levelPhase !== 'fighting') return;
    // the wave again: startEndlessWave counts it up and turns the arena on its first wave, so step both back
    const n = G.endlessWave;
    if (n > 1 && (n - 1) % 5 === 0) G.arenaRot = (G.arenaRot - 1 + ENDLESS_ARENAS.length) % ENDLESS_ARENAS.length;
    G.endlessWave--; G.waveTotal--;
    shared.levelPhase = 'between'; shared.phaseT = 1.5;
    return;
  }
  if (boss){
    shared.levelPhase = 'bossfight';
    const half = shared.arenaHalfZ || 30, sh = G.storyHero || G.hero;
    if (!shared.finale) spawnFinale(sh === 'trooper' ? 'marshal' : sh === 'mando' ? 'magistrate' : 'vexis', { x: 0, z: -half + 6 });
  } else if (shared.levelPhase === 'fighting'){ shared.levelPhase = 'between'; shared.phaseT = 1.5; }   // the same wave again (game/flow.js startWave)
}

function endGuest(dropped){
  if (!G.coopGuest) return;
  G.coopGuest = false;   // the run carries on here by itself: this browser's own waves take over
  dropPuppets(); dropBossPuppet();
  if (G.mode === 'play'){ if (G.mission) endMission(); showBanner('', dropped ? 'CONNECTION LOST · RECONNECTING…' : 'THE HOST LEFT THE FIGHT', 2.4); }
  // reconnecting (or the room changing hands, net/session.js): the host's foes went with the link, which isn't a wave
  // won. Hold in a lull while the rejoin runs (it puts this browser back in the fight); only if it never does, this
  // browser's own waves take the same wave on again
  if (dropped && !G.mission && shared.levelPhase === 'fighting'){
    shared.levelPhase = 'between'; shared.phaseT = 30;
    if (G.endless){ G.endlessWave--; G.waveTotal--; if (G.endlessWave > 0 && G.endlessWave % 5 === 0) G.arenaRot = (G.arenaRot - 1 + ENDLESS_ARENAS.length) % ENDLESS_ARENAS.length; }
  }
}

on('e', (m) => {
  if (net.role !== 'guest') return;
  if (!m.run){
    // the host fell with nobody left standing (game/revive.js OUT): a guest lying out (or down) here falls with the run
    if (m.lost && G.coopGuest && G.mode === 'play' && player.downed){ clearDowned(); killHero(); }
    const was = coopRun.on; coopRun.on = false;
    if (was) runChanged();
    G.coopWasGuest = false;   // the host's run is over: nothing to go back to
    endGuest();
    return;
  }
  const ch = m.ch ?? -1;
  const changed = !coopRun.on || coopRun.w !== m.w || coopRun.ar !== m.ar || coopRun.k !== m.k || coopRun.lv !== m.lv || coopRun.ch !== ch || coopRun.mid !== (m.ms ? m.ms.id : m.zn ? 'zone:' + m.zn : '');
  Object.assign(coopRun, { on: true, k: m.k || 'e', mid: m.ms ? m.ms.id : m.zn ? 'zone:' + m.zn : '', lv: m.lv || 0, ch, a2: m.a2 || null, sh: m.sh || null, ng: m.ng | 0, wf: m.wf || 0, ar: m.ar, as: m.as || 1, w: m.w, wt: m.wt, ph: m.ph, mut: m.mut });
  if (changed) runChanged();
  // this guest fell out of the shared fight without the host's run ending (died and retried, restarted): it was playing its
  // own foes and waves. Back in: its own foes go, and the host's take their place
  if (!G.coopGuest && G.coopWasGuest && G.mode === 'play' && (m.k === 'z' ? G.zone === m.zn : m.k === 'e' ? G.endless : m.k === 'c' ? !G.endless && !G.mission && !G.training && !G.sandbox && !G.hub : false)){
    for (const e of enemies) removeEnemy(e);
    enemies.length = 0; byNid.clear(); G.spawnQueue.length = 0;
    G.coopGuest = true;
    if (m.ph) shared.levelPhase = m.ph;   // (held in a lull while it was away, endGuest: the host's phase again)
    showBanner('', 'BACK IN THE HOST\'S FIGHT', 2.0);
  }
  // ...or out of a shared mission (a dropped link ends this browser's copy of it, endGuest): the host's mission (or mission
  // chapter) again, shown its objectives as on joining. A host handoff (takeOver above) brings everyone back in this way too
  else if (!G.coopGuest && G.coopWasGuest && G.mode === 'play' && G.mission && !G.endless && !G.training && !G.sandbox
    && ((m.k === 'm' && m.ms && G.missionId === m.ms.id) || (m.k === 'c' && ch >= 0 && G.chapter === ch))){
    for (const e of enemies) removeEnemy(e);
    enemies.length = 0; byNid.clear(); G.spawnQueue.length = 0;
    if (m.k === 'm') startCoopMission(m.ms.id); else { G.storyHero = m.sh || null; G.ngPlus = m.ng | 0; followChapter(ch, m.a2); }
    G.coopGuest = true;
    showBanner('', 'BACK IN THE HOST\'S FIGHT', 2.0);
  }
  if (!G.coopGuest || G.mode === 'menu') return;
  if (m.st) G.story = m.st;   // the host's story choices (game/choices.js): the guest's words follow them
  calmSync(m.af);   // the calm after a chapter (game/aftermath.js): the host's rally point

  if (m.k === 'z'){   // an open zone (game/zone.js): the same streets, each hero roaming them, and the host's patrols
    if (G.zone !== m.zn){ endGuest(); return; }
    G.waveTotal = m.wt;
  } else if (m.k === 'm'){   // a story mission: the host runs its objectives, this browser is shown them
    if (!G.mission || !m.ms || G.missionId !== m.ms.id){ endGuest(); return; }
    coopMissionSync(m.ms);
  } else if (m.k === 'c'){   // the campaign: the host's chapter (a stretch of a level's waves, or a mission), or its level and wave
    if (G.endless || (G.mission && G.chapter < 0)){ endGuest(); return; }
    if (ch >= 0){
      if (G.chapter !== ch){ dropPuppets(); G.storyHero = m.sh || null; G.ngPlus = m.ng | 0; followChapter(ch, m.a2); }   // (the host's story: its chapters, maps and words; its NEW GAME+ tier and so its mutators)
      else if ((m.ng | 0) !== (G.ngPlus | 0)){ G.ngPlus = m.ng | 0; G.ngMuts = chapterMutators((chapters()[ch] || {}).id, G.ngPlus); }   // (joined mid-chapter before the tier was heard)
    } else if (G.levelIdx !== m.lv || G.chapter >= 0){ dropPuppets(); startLevel(m.lv, { resume: true }); G.coopGuest = true; showBanner('', 'THE HOST MOVES ON', 1.6); }
    if (G.mission){ if (m.ms) coopMissionSync(m.ms); }   // a mission chapter: shown the host's objectives
    else if (m.ph === 'fighting' && (shared.levelPhase !== 'fighting' || G.wave !== m.w)) coopCampaignWave(m.w, m.wt);
    else if (m.ph === 'between' && shared.levelPhase === 'fighting') coopCampaignCleared();
    else if (m.ph === 'bossfight' && shared.levelPhase !== 'bossfight'){ shared.levelPhase = 'bossfight'; showBanner('', 'THE HOST FACES THE BOSS', 2.4); }
  } else {
  if (G.mission){ endGuest(); return; }
  // the host's arena and wave: follow them
  if (G.arenaRot !== m.ar){
    dropPuppets();
    G.arenaRot = m.ar; rotateEndlessArena(ENDLESS_ARENAS[m.ar]);
  }
  G.mut = m.mut;
  if (G.endlessWave !== m.w){
    G.endlessWave = m.w; G.waveTotal = m.wt;
    shared.levelPhase = 'fighting'; G.waveHits = 0; G.waveDmg = 0;
    beginWave('WAVE ' + m.w);
    checkUnlocks(1600);
    showBanner('', 'WAVE ' + m.w, 1.6);
    MUSIC.waveSting();
  } else if (m.ph === 'between' && shared.levelPhase === 'fighting'){
    endlessWaveCleared();   // pays this browser's own clear bonus and opens its own upgrade screen
  }
  }

  // the boss
  if (m.boss){
    const r = m.boss;
    let b = shared.boss;
    if (!b || !b.net) b = makeBossPuppet(r[9], r[5], r[6]);
    b.want.pos.set(r[0], r[1], r[2]); b.want.ry = r[3]; b.want.rx = r[4];
    b.hp = r[5]; b.maxHp = r[6]; b.state = r[7]; b.phase = r[8]; b.enraged = !!r[10]; b.hand = r[11]; b.eyes = r[12]; b.em = r[13]; b.ei = r[14]; b.tp = r[15]; b.piv = r[16] != null ? [r[16], r[17]] : null;
  } else if (shared.boss && shared.boss.net) dropBossPuppet();

  // the foes
  const seen = new Set();
  for (const rec of m.list){
    seen.add(rec[0]);
    let e = byNid.get(rec[0]);
    if (!e){ e = makePuppet(rec); if (!e) continue; byNid.set(rec[0], e); }
    applyRec(e, rec);
  }
  for (const [nid, e] of byNid){
    if (seen.has(nid)) continue;
    const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
    removeEnemy(e); byNid.delete(nid);
  }
});

const CTL = { knockdown: 1, ragdoll: 1, stagger: 1, recover: 1, stasis: 1, grasped: 1, lock: 1 };   // the states a guest's powers (or a saber lock) put a foe in
const HELD = { grasped: 1, lock: 1 };   // ...and the ones where the guest places the body itself
const NO_FEET = { ragdoll: 1, knockdown: 1, getup: 1, fade: 1, spawn: 1, grasped: 1, yield: 1, spared: 1 };   // the states the legs don't stand in (enemies/ai.js)
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// a Force power or a blow here put the puppet into a control state (floored, thrown, stunned, frozen): tell the host,
// which applies it to the real foe. The next snapshot then carries the result back.
function sendCtl(e){
  // held in this player's grasp or bound in their saber lock: they move the body (player/jedi/grasp.js, enemies/duel.js),
  // and the host is told where it is
  if (HELD[e.state] && !HELD[e.netState]) e.held = true;
  if (e.held){
    if (!HELD[e.state]) e.held = false;
    else if (connected() && performance.now() - (e.heldSent || 0) >= NET.sendMs){
      e.heldSent = performance.now();
      const gp = e.group.position, gr = e.group.rotation;
      send({ t: 'gp', n: e.nid, p: [r2(gp.x), r2(gp.y), r2(gp.z)], r: [r2(gr.x), r2(gr.y), r2(gr.z)], c: e.clinched ? 1 : 0 });   // c: a Mando's hand, not the Force (no glow)
    }
  }
  if (e.state === e.netState) return;
  if (CTL[e.state] && !e.dead && connected()) send({ t: 'ctl', n: e.nid, s: e.state, st: r2(e.st || 0), v: [r2(e.vel.x), r2(e.vel.y), r2(e.vel.z)] });
  e.netState = e.state;
}
/* the guest's stand-in for updateEnemies: follow the snapshot, and walk the legs on the motion that results */
export function updatePuppets(dt){
  if (LOCK.foe && LOCK.foe.net) updateSaberLock(dt);   // a bind with one of the host's duellists runs here, as ai.js runs it for its own
  for (const e of enemies){
    if (!e.net) continue;
    sendCtl(e);   // a power or a blow here put it in a control state: the host applies it to the real foe
    const g = e.group, w = e.want;
    if (e.hrA){ g.rotation.x -= e.hrA.x; g.rotation.z -= e.hrA.z; g.rotation.y -= e.hrA.y; e.hrA = null; }   // last frame's hit reaction off, before following the host
    blowFeel(e, g, dt);
    // the marksman's beam and the lancer's line fade when the host stops sending them
    if (e.aimLine && performance.now() - (e.aimAt || 0) > 200) e.aimLine.visible = false;
    if (e.lungeLine && e.lungeLine.visible && performance.now() - (e.lungeAt || 0) > 200){
      e.lungeLine.material.opacity = Math.max(0, e.lungeLine.material.opacity - dt * 3);
      if (e.lungeLine.material.opacity <= 0) e.lungeLine.visible = false;
    }
    if (e.held){ updateLegs(e, g, dt, e.state === 'lock' ? 'ground' : 'off'); continue; }   // the grasp (or the bind) moves it
    g.position.x = damp(g.position.x, w.pos.x, 20, dt);
    g.position.y = damp(g.position.y, w.pos.y, 20, dt);
    g.position.z = damp(g.position.z, w.pos.z, 20, dt);
    g.rotation.x += angDiff(g.rotation.x, w.rx) * (1 - Math.exp(-20 * dt));   // the short way round (an Ataru master's backflip wraps)
    g.rotation.z = damp(g.rotation.z, w.rz, 20, dt);
    g.rotation.y += angDiff(g.rotation.y, w.ry) * (1 - Math.exp(-20 * dt));
    if (g.userData.eliteRing) g.userData.eliteRing.rotation.z += dt * 2.5;
    if (e.hpBar){
      e.hpBar.visible = !e.dead && e.state !== 'fade';
      if (e.hpBar.visible){
        e.hpBar.position.set(g.position.x, g.position.y + 2.7 * g.scale.x, g.position.z);
        e.hpBar.quaternion.copy(camera.quaternion);
        const frac = clamp(e.hp / (e.maxHp || e.hp), 0, 1);
        e.hpBarFill.scale.x = Math.max(0.001, frac);
        e.hpBarFill.position.x = -(1 - frac) * 1.13;
        e.hpBarFill.material.color.setHex(frac > 0.5 ? 0xff3b3b : frac > 0.22 ? 0xff8a2a : 0xffd24a);
      }
    }
    updateLegs(e, g, dt, e.dead || NO_FEET[e.state] ? 'off' : (e.t.fly || e.state === 'leap') ? 'air' : e.walking ? 'walk' : 'ground');
    updateUpper(e, g, dt, null, e.dead || NO_FEET[e.state] ? 'off' : 'on');   // breath, glances, the wind-up twist (enemies/upper.js)
    defeatLife(e, g, dt);   // a felled foe: its knees, a droid's throes, the dropped blaster (enemies/defeat.js)
    updatePuppetDuel(e, dt);
    reactSpring(e, g, dt);   // ...and this frame's on again, over the pose
  }
}

/* A blow this player lands on a puppet plays here at once (enemies/damage.js netBlow): the body flashes, as the host's
   own foes do (ai.js), and rocks with the blow on the same spring, laid over the pose the host sends */
function blowFeel(e, g, dt){
  const m = g.userData.bodyMat;
  if (!(e.flash > 0) || !m) return;
  e.flash -= dt;
  if (e.flash > 0){ m.emissive.setHex(0x66aaff); m.emissiveIntensity = 2; }
  else if (e.netEm != null){ m.emissive.setHex(e.netEm); m.emissiveIntensity = e.netEi; }
}
const NO_REACT = { ragdoll: 1, knockdown: 1, getup: 1, fade: 1, spawn: 1, lock: 1, lunge: 1, grasped: 1, yield: 1, spared: 1 };   // (as ai.js: states that own the whole body)
function reactSpring(e, g, dt){
  const r = e.hr;
  if (!r) return;
  if (e.dead || e.held || NO_REACT[e.state]){ r.x = r.z = r.y = r.vx = r.vz = r.vy = 0; return; }
  if (!(r.x || r.z || r.y || r.vx || r.vz || r.vy)) return;
  const K = 320, C = 16, h = Math.min(dt, 1 / 30);
  r.vx += (-K * r.x - C * r.vx) * h; r.x = clamp(r.x + r.vx * h, -0.6, 0.6);
  r.vz += (-K * r.z - C * r.vz) * h; r.z = clamp(r.z + r.vz * h, -0.5, 0.5);
  r.vy += (-K * r.y - C * r.vy) * h; r.y = clamp(r.y + r.vy * h, -0.5, 0.5);
  if (Math.abs(r.x) + Math.abs(r.z) + Math.abs(r.y) + Math.abs(r.vx) + Math.abs(r.vz) + Math.abs(r.vy) < 1e-3){ r.x = r.z = r.y = r.vx = r.vz = r.vy = 0; return; }
  g.rotation.x += r.x; g.rotation.z += r.z; g.rotation.y += r.y; e.hrA = { x: r.x, z: r.z, y: r.y };
}

/* ---------------- both: once a frame ---------------- */
let waitShown = false, fightEndAt = -1e9;
const POPUP_BEAT = 0.6;   // s of quiet after a fight before its pop-ups come up
export function updateFoes(){
  hostTick();
  coopRun.live = coopLive();
  if (coopRun.live && (G.paused || G.skillSelect)) player.awayAt = performance.now();   // in a menu in a shared fight: safe till a moment after (player/damage.js)
  // the screens that pop up by themselves (a learned form, a new ability's card, a found gun, the Force Level's rise) wait
  // for the fight to be over, alone and in co-op: they come up in the lull after it, before the next scene (game/flow.js).
  // The training grounds, the sandbox, an open zone and the hub keep foes or dummies about, and show theirs as they come
  const fight = (coopRun.live || !(G.training || G.sandbox || G.zone || G.hub)) && (enemies.some(e => !e.dead && !e.converted) || G.spawnQueue.length > 0 ||
    !!(shared.boss && !shared.boss.dead) || !!(shared.finale && !shared.finale.dead));
  // (and a short beat after the last foe falls: a card on the very frame of the last kill reads as mid-fight)
  const now = performance.now();
  if (fight) fightEndAt = now;
  coopRun.holdPopups = fight || now - fightEndAt < POPUP_BEAT * 1000;
  if (net.role === 'host'){
    // a grasp whose holder went quiet (left, froze) lets go
    for (const e of enemies){
      if (!HELD[e.state]){ e.heldAt = null; e.clinched = false; continue; }   // (this host's own grasps and locks carry no stamp: they are never let go here)
      if (e.heldAt != null && !e.dead && performance.now() - e.heldAt > 1500){ e.state = e.state === 'lock' ? 'recover' : 'knockdown'; e.st = 0.5; e.heldAt = null; }
    }
    const waiting = coopRun.live && coopRun.guestPicking && shared.levelPhase === 'between' && !G.skillSelect;
    const picking = pickingSeats();
    if (waiting && !waitShown) showBanner('', picking.length === 1 ? 'WAITING FOR ' + nameOf(picking[0]) + ' TO PICK UPGRADES' : 'WAITING FOR ' + picking.length + ' PLAYERS TO PICK UPGRADES', 2.4);
    waitShown = waiting;
  }
  if (net.role === 'guest' && connected() && hitQueue.length){
    // a blow (a cut, a bolt, a kick) goes the frame it lands, so the host applies it, and its answer comes back, a beat
    // sooner; a flame's or a held power's ticks are pooled and go about 20 times a second
    const now = performance.now();
    if (now - hitsAt >= NET.sendMs || hitQueue.some(h => !h[6])){ hitsAt = now; send({ t: 'hits', h: hitQueue.splice(0) }); }
  } else if (!connected()) hitQueue.length = 0;
}

// which guests still have their upgrade screen or pop-ups to get through: net/waits.js
on('takeover', () => takeOver());   // the host left and this guest has the room now (net/session.js)
on('status', (n) => {
  if (n.status === 'connected') return;
  // reconnecting: still in the host's run as far as this browser knows, so its next snapshot puts this one back in the fight
  const dropped = n.status === 'reconnecting';
  coopRun.on = false; coopRun.guestPicking = false; coopRun.live = false; if (!dropped) G.coopWasGuest = false; runChanged();
  if (G.coopGuest) endGuest(dropped);
  hostSent = false;
});
