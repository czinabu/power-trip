// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE FINAL BOSS LAYER — a final boss fought on a duellist's body. He is a foe in `enemies` like the named duellists (the
// saber cast's look, the duel system's guards, feints, strings and saber locks: enemies/duel.js), and this file lays a
// finale over him: the boss bar at the top of the screen, three phases with a staged beat between them, signature moves
// the duel AI hands the body to (state 'sig'), the anti-cheese rules on what can hurt him, and the defeat on his knees.
// The boss himself (his numbers, his look, his moves) is a definition: data/bosses.js VEXIS, boss/vexis.js.
//
// A move: { id, from (the first phase it is used in), can(e, C) → may it start now, start(e, C, M), update(e, C, M, dt)
// → true when it's over, end(e, C, M, cut) (cut: it was broken off) }. C is this frame's context (the hero he is on,
// where they stand, the distance), M the move's own state. While a move runs the duel AI leaves the body alone: the move
// poses it, moves it and decides what its blows do.
//
// Co-op: the host runs all of it. A guest sees the host's foe as a puppet (net/foes.js); the bar, the banners and the
// moves' effects come over as 'fin' messages (net/foefire.js hooks.fin), drawn here by finaleNet.
//
// A RAID BOSS (data/raids.js) carries a SUNDER BAR (def.sunder: the Warbringer's posture bar, given to a boss): each
// hero's own job fills it (a bolt turned back into him, a blow from behind or above, the trooper's fire: boss/roles.js),
// and a full bar breaks him open. Gunfire PINS him: his moves come slower while it keeps up. A raid's own day of
// modifiers is laid over a copy of his numbers as he spawns (opts.raid: data/raids.js tuneBoss).

import * as THREE from 'three';
import { G, shared, enemies, player, bolts, rings } from '../state.js';
import { V3, clamp, rand } from '../utils.js';
import { scene } from '../engine/renderer.js';
import { foeProfile, FORM_SWITCH } from '../data/foe-forms.js';
import { diffHpMul } from '../data/difficulty.js';
import { heroScale, DUO } from '../data/coop.js';
import { duoHp, duoHit, duoPick, duoWheel, duoHeard, updateDuo, strikerOf } from './duo.js';
import { spawnEnemy } from '../enemies/spawn.js';
import { setFoeForm } from '../enemies/foeform.js';
import { initDuel } from '../enemies/duel.js';
import { heroFor } from '../enemies/targets.js';
import { hideIndicators } from '../enemies/cleanup.js';
import { heroesHere, players } from '../player/players.js';
import { playerPos } from '../player/helpers.js';
import { burst } from '../fx/particles.js';
import { floater, screenFlash } from '../fx/floaters.js';
import { spawnGroundShock } from '../fx/vfx.js';
import { showBanner } from '../ui/banners.js';
import { S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { setMood, MOOD } from '../world/atmosphere.js';
import { storyBeat } from '../game/story.js';
import { gainXp } from '../game/progression.js';
import { victory } from '../game/summary.js';
import { bossDown } from '../game/autosave.js';
import { meetBoss } from '../game/codex.js';
import { hooks } from '../net/run.js';
import { hurtPlayer } from '../player/damage.js';
import { killCam } from '../engine/killcam.js';
import { staggerEnemy } from '../enemies/damage.js';
import { tuneBoss, MODS } from '../data/raids.js';
import { ROLE, roleTags } from './roles.js';

// the final bosses by id (boss/vexis.js registers his). Kept on the function itself, so a boss's file can register
// whichever order the modules load in
export function registerFinale(def, moves, look){ (registerFinale.defs || (registerFinale.defs = {}))[def.id] = { def, moves, look }; }
const REG = () => registerFinale.defs || {};

const ROMAN = ['', 'I', 'II', 'III'];
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

/* ---------------- spawn ---------------- */
// opts.mission: a story mission's duel spawned him (game/mission.js): his defeat ends that objective, not the run
export function spawnFinale(id, at, opts = {}){
  const D = REG()[id];
  if (!D) return null;
  const heroes = heroesHere();
  const def = opts.raid ? tuneBoss(D.def, opts.raid.mods, {}, heroes) : D.def;   // (a raid's copy: the day's modifiers on it)
  // a duellist wears his look from the saber cast; any other body is dressed in his own model (def.dress)
  spawnEnemy(def.type, V3(at.x, 0, at.z), def.dress ? { dress: def.dress, keep: true } : { look: def.look, keep: true });
  const e = enemies[enemies.length - 1];
  e.champion = true; e.noFloor = true; e.look = def.look;   // (his look names him to a co-op guest: net/foes.js)
  e.fin = { id, def, D, mission: !!opts.mission, raid: opts.raid || null, phase: 1, sig: null, sigT: def.sigGap[0] * 0.6, lastSig: -9, cds: {}, used: {}, blockT: 0, crowdT: 0, over: false, bucket: 0, tags: 0 };
  if (def.sunder) e.fin.sd = { v: 0, max: Math.round(def.sunder.bar * heroScale(def.sunder.coop, heroes)), supp: 0, idle: 0, openUntil: 0, pinned: false, sent: 0, said: {} };
  shared.reviveMul = def.reviveMul || null;   // (the trooper's quicker revives in his fight: game/revive.js)
  e.t = { ...e.t, ...(def.over || {}), dmg: e.t.dmg * def.dmg, score: 40, boss: true };   // (a copy: never mutate the shared type)
  e.hp = e.maxHp = Math.round(def.hp * diffHpMul() * duoHp(heroes) * (def.raidHp || 1));   // (a party: more of him, boss/duo.js)
  e.fin.party = heroes; e.pick = duoPick;   // (a party: he goes after whoever hurts him most, boss/duo.js)
  e.spd = e.t.speed * def.speed;
  e.group.scale.multiplyScalar(def.scale);
  e.dmgRule = finaleDamage;   // what can hurt him, and how much (enemies/damage.js)
  setPhaseDuel(e, 1);
  e.hpFloor = Math.ceil(e.maxHp * def.phaseAt[0]);   // a burst can't skip a phase: the blow that crosses it stops there
  shared.finale = e;
  meetBoss(def.codex || 'sith');
  showHud(e);
  if (D.look.spawn) D.look.spawn(e);
  burst(V3(at.x, 1.4, at.z), 0x8a1a2a, 30, 9, 6, 1.1);
  spawnGroundShock(V3(at.x, 0.1, at.z), 0xb3121e, 6, 0.7, 0.9);
  G.shake = Math.max(G.shake, 0.8);
  S.roar(e.group.position); MUSIC.waveSting();
  showBanner(def.name, def.intro || '', 4, { kicker: 'FINAL BOSS' });
  if (hooks.fin) hooks.fin({ k: 'up', id, n: e.nid, rm: opts.raid ? opts.raid.mods : undefined });
  return e;
}
// his duel profile for a phase: his form at his rank, with the phase's own numbers on top (data/bosses.js `duel`)
function setPhaseDuel(e, phase){
  const def = e.fin.def;
  if (!def.duel){ e.spd = e.t.speed * def.speed * (def.pace[phase - 1] || 1); return; }   // (a body with no duel profile: his moves are the fight)
  if (phase === 1) setFoeForm(e, def.form, def.rank, FORM_SWITCH.boss[def.codex || 'sith'] || null);
  initDuel(e, { ...foeProfile(e.ff || def.form, def.rank), deflect: 1, ...def.duel[phase - 1] });
  e.spd = e.t.speed * def.speed * (def.pace[phase - 1] || 1) * (e.fin.sd && e.fin.sd.pinned ? def.sunder.pace : 1);
}

/* ---------------- what hurts him (enemies/damage.js calls it for every blow) ----------------
   No single blow takes more than a share of his bar (more while he is open), later phases shrug off a little of
   everything, and while a beat or his defeat plays nothing lands at all */
function finaleDamage(e, dmg, tick, opts, knockDir){
  const F = e.fin, def = F.def;
  if (F.over || (F.sig && F.sig.id === 'beat')) return null;   // (null: the blow doesn't land at all)
  if (!(dmg > 0)) return dmg;
  if (F.sd){ F.tags = opts && opts.rt != null ? opts.rt : roleTags(e, opts); if (!tick) rolePin(e, F, F.tags); }   // (what kind of blow it was: boss/roles.js; a guest's comes with its own)
  dmg *= (def.phaseResist[F.phase - 1] ?? 1) * (def.armour ?? 1);
  // his own rules first (the Magistrate's shield, his cracks): what's left of the blow, or null if none of it lands
  if (F.D.look.damage){ dmg = F.D.look.damage(e, dmg, tick, opts, knockDir); if (dmg === null) return null; }
  // a party (boss/duo.js): whose blow it was moves his threat, the one he isn't on lands it harder, and two from either side
  // catch him between them
  const duo = duoHit(e, F, strikerOf(opts), dmg, tick, F.sd ? G.gt >= F.sd.openUntil : !(F.sig && (UNBROKEN[F.sig.id] || e.hyper)));
  dmg *= duo.mul;
  if (duo.pincer) pincer(e, F);
  const at = () => V3(e.group.position.x, e.group.position.y + 3.2, e.group.position.z);
  if (!tick){
    const open = e.state === 'stagger' || G.gt < (e.openUntil || 0) || (F.sig && F.sig.open) || !!(F.D.look.open && F.D.look.open(e));
    const cap = e.maxHp * (open ? def.hitCapOpen : def.hitCap);
    if (dmg > cap){ dmg = cap; if (!open) floater(at(), 'HE HOLDS', '#cc99ff'); }
  }
  // the burst budget: what's gone into him lately drains away over burstWin seconds; nothing past the budget lands
  if (def.burstCap){
    const room = e.maxHp * def.burstCap * (F.sd && G.gt < F.sd.openUntil ? def.sunder.burstMul : 1) - F.bucket;   // (the vessel broken open: more of it lands)
    if (room <= 0){ if (!tick) floater(at(), 'RESISTED', '#cc99ff'); return null; }
    dmg = Math.min(dmg, room);
    F.bucket += dmg;
  }
  if (F.sd && !tick) roleGain(e, F, F.tags);
  return dmg;
}

/* ---------------- THE SUNDER BAR (a raid boss: def.sunder) ----------------
   Each hero's job fills it: a bolt turned back into him, a blow from behind him or from above, the trooper's fire, a
   little from the squad. Full, it BREAKS him: a stagger, then his guard stays down and more of every blow lands. Gunfire
   also PINS him (supp): pinned, his moves come slower and his feet drag. */
const ROLE_SAY = { deflect: ['CRACKED', '#ff9a8a'], flank: ['FLANKED', '#ffd24a'], pin: ['PINNED', '#ffc560'] };
function roleSay(e, F, k){
  const sd = F.sd; if (G.gt < (sd.said[k] || 0)) return;
  sd.said[k] = G.gt + 1.6;
  floater(V3(e.group.position.x, e.group.position.y + 3.6 * e.group.scale.y, e.group.position.z), ROLE_SAY[k][0], ROLE_SAY[k][1]);
}
function rolePin(e, F, t){
  if (!(t & ROLE.shot)) return;
  const sd = F.sd, c = F.def.sunder;
  sd.supp = Math.min(c.pinMax, sd.supp + (t & ROLE.trooper ? c.pin : c.pinOther));
}
function roleGain(e, F, t){
  const sd = F.sd, c = F.def.sunder, g = c.gain;
  if (F.over || G.gt < sd.openUntil) return;
  let add = 0;
  if (t & ROLE.deflect){ add += g.deflect; roleSay(e, F, 'deflect'); }
  else if (t & (ROLE.behind | ROLE.air)){ add += t & ROLE.shot ? g.flankShot : g.flank; roleSay(e, F, 'flank'); }
  if (t & ROLE.trooper) add += g.pin * (sd.pinned ? 1.5 : 1);
  if (t & ROLE.squad) add += g.squad;
  if (add > 0){ sd.v = Math.min(sd.max, sd.v + add); sd.idle = 0; }
}
// the moves the break waits out: his phase beat, his defeat, a ward he kneels behind
const UNBROKEN = { beat: 1, defeat: 1, ward: 1 };
function updateSunder(e, F, dt){
  const sd = F.sd, c = F.def.sunder;
  sd.supp = Math.max(0, sd.supp - c.pinDecay * dt);
  const pin = sd.pinned ? sd.supp > 0.55 : sd.supp >= 1;
  if (pin !== sd.pinned){
    sd.pinned = pin;
    e.spd *= pin ? c.pace : 1 / c.pace;
    if (pin) roleSay(e, F, 'pin');
  }
  if ((sd.idle += dt) > c.idle) sd.v = Math.max(0, sd.v - c.drain * dt);
  if (sd.v >= sd.max && !F.over && !(F.sig && UNBROKEN[F.sig.id])) breakVessel(e, F);
  setSunderHud(sd.v / sd.max, sd.pinned, G.gt < sd.openUntil);
  if ((sd.sent -= dt) <= 0 && hooks.fin){ sd.sent = 0.25; hooks.fin({ k: 'sd', n: e.nid, v: Math.round(sd.v / sd.max * 100) / 100, p: sd.pinned ? 1 : 0, o: G.gt < sd.openUntil ? 1 : 0 }); }
}
function breakVessel(e, F){
  const sd = F.sd, c = F.def.sunder, g = e.group;
  if (F.sig) endSig(e, true);
  e.hyper = false;
  sd.v = 0; sd.idle = 0; sd.openUntil = G.gt + c.open; F.bucket = 0;
  staggerEnemy(e, 0, 0, 'BROKEN OPEN');
  e.st = Math.min(2.2, c.open); e.openUntil = sd.openUntil;
  F.lastSig = G.gt; F.sigT = Math.max(F.sigT, c.open * 0.8);
  burst(V3(g.position.x, 1.8 * g.scale.y, g.position.z), 0xe8d8ff, 40, 12, 6, 1.1);
  spawnGroundShock(V3(g.position.x, 0.1, g.position.z), 0xb46bff, 5, 0.5, 0.8);
  screenFlash('radial-gradient(ellipse at center, rgba(232,216,255,.2), transparent 60%)', 0.5, 0.5);
  G.shake = Math.max(G.shake, 0.9); G.hitstop = Math.max(G.hitstop, 0.12);
  showBanner(c.broke || 'BROKEN OPEN', c.brokeSub || 'He is wide open. Everyone on him.', 2.4, { kicker: F.def.name });
  S.stun(g.position);
  if (hooks.fin) hooks.fin({ k: 'sb', n: e.nid });
}

/* A TEAM-UP on a raid boss (game/teamup.js): its payoff goes into the sunder bar, a share of the bar, rather than his
   health (which only takes a capped share). Not while he is already broken open. */
export function teamupSunder(e, share){
  const F = e && e.fin;
  if (!F || !F.sd || F.over || G.gt < F.sd.openUntil) return;
  F.sd.v = Math.min(F.sd.max, F.sd.v + F.sd.max * share); F.sd.idle = 0;
  roleSay(e, F, 'flank');
}

/* ---------------- THE PINCER (a party: boss/duo.js) ----------------
   Two heroes struck him from either side within a breath: he's caught between them. He staggers open, or a raid boss's
   sunder bar takes a big share instead. (Not while a move that can't be broken, his phase beat or a ward has him, nor
   while a raid boss is already broken open: then it doesn't count, finaleDamage.) */
function pincer(e, F){
  if (F.sd){ F.sd.v = Math.min(F.sd.max, F.sd.v + F.sd.max * DUO.pincer.sunder); F.sd.idle = 0; }
  else {
    if (F.sig) endSig(e, true);
    staggerEnemy(e, 0, 0, 'CAUGHT BETWEEN');
    e.st = Math.max(e.st || 0, DUO.pincer.open * 0.8); e.openUntil = G.gt + DUO.pincer.open;
  }
  pincerFx(e, F.def);
  if (hooks.fin) hooks.fin({ k: 'pc', n: e.nid });
}
function pincerFx(e, def){
  const g = e && e.group;
  if (g){ burst(V3(g.position.x, 1.8 * g.scale.y, g.position.z), 0xffd24a, 26, 10, 5, 1); spawnGroundShock(V3(g.position.x, 0.1, g.position.z), 0xffd24a, 3.5, 0.4, 0.7); S.stun(g.position); }
  G.shake = Math.max(G.shake, 0.6); G.hitstop = Math.max(G.hitstop, 0.08);
  showBanner('CAUGHT BETWEEN', def && def.sunder ? 'Both sides at once: the vessel buckles.' : 'Both sides at once: he\'s open. Hit him!', 1.8, { kicker: def ? def.name : '' });
}

/* ---------------- the boss bar ---------------- */
function hudEls(){
  const wrap = document.getElementById('bosswrap');
  if (!wrap) return null;
  let ph = document.getElementById('bossphase');
  if (!ph){
    ph = document.createElement('div'); ph.id = 'bossphase'; wrap.appendChild(ph);
    const bg = document.getElementById('bossbarbg');
    for (const k of [0.66, 0.33]){ const n = document.createElement('div'); n.className = 'bossnotch'; n.style.left = (k * 100) + '%'; bg.appendChild(n); }
  }
  let sd = document.getElementById('bosssunder');
  if (!sd){
    sd = document.createElement('div'); sd.id = 'bosssunder';
    sd.innerHTML = '<span class="sd-k"></span><div class="sd-bg"><i></i></div><span class="sd-pin">PINNED</span>';
    wrap.appendChild(sd);
  }
  let mods = document.getElementById('bossmods');
  if (!mods){ mods = document.createElement('div'); mods.id = 'bossmods'; wrap.appendChild(mods); }
  return { wrap, name: document.getElementById('bossname'), bar: document.getElementById('bossbar'), ph, sd, mods };
}
// the sunder bar under his (a raid boss's: def.sunder), and the day's modifiers under that (a raid's)
function showSunder(def, mods){
  const H = hudEls(); if (!H) return;
  H.sd.style.display = def && def.sunder ? '' : 'none';
  if (def && def.sunder) H.sd.querySelector('.sd-k').textContent = def.sunder.name || 'SUNDER';
  H.mods.innerHTML = (mods || []).map(m => MODS[m] ? '<span style="--mc:' + MODS[m].col + '">' + MODS[m].name + '</span>' : '').join('');
  H.mods.style.display = mods && mods.length ? '' : 'none';
}
function setSunderHud(k, pinned, open){
  const H = hudEls(); if (!H) return;
  H.sd.querySelector('i').style.width = (open ? 100 : Math.max(0, Math.min(1, k)) * 100) + '%';
  H.sd.classList.toggle('pinned', !!pinned); H.sd.classList.toggle('open', !!open);
}
function showHud(e){
  const H = hudEls(); if (!H) return;
  const R = e.fin || REG()[e.finId];
  if (!R) return;
  const def = R.def;
  H.name.textContent = def.title;
  H.wrap.style.display = 'block'; H.wrap.classList.add('finale');
  setHudPhase(e.fin ? e.fin.phase : 1, def);
  showSunder(def, e.fin ? e.fin.raid && e.fin.raid.mods : guestNet.mods);
}
function setHudPhase(p, def){
  const H = hudEls(); if (!H) return;
  H.ph.textContent = 'PHASE ' + ROMAN[p] + ' · ' + (def.phases ? def.phases[p - 1] : '');
  H.wrap.dataset.phase = p;
}
function hideHud(){
  const H = hudEls(); if (!H) return;
  H.wrap.style.display = 'none'; H.wrap.classList.remove('finale');
  showSunder(null, null);
}
function updateHud(e){
  const H = hudEls(); if (!H) return;
  if (H.wrap.style.display !== 'block') showHud(e);
  H.bar.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
}

/* ---------------- every frame (host and solo), after the foes' AI ---------------- */
const C = { hero: null, pp: null, dist: 0, tx: 0, tz: 1, remote: false, phase: 1 };
export function updateFinale(dt){
  const e = shared.finale;
  if (!e) return;
  if (e.net){ updateGuestFinale(e, dt); return; }
  if (!enemies.includes(e)){ teardown(); return; }   // cleared off the floor (the sandbox, a restart)
  const F = e.fin, def = F.def;
  updateHud(e);
  if (F.D.look.frame) F.D.look.frame(e, dt);
  if (def.burstCap) F.bucket = Math.max(0, F.bucket - e.maxHp * def.burstCap / def.burstWin * dt);
  if (F.sd && !e.dead) updateSunder(e, F, dt);
  updateDuo(e, F, dt);   // a party: his threat fades, and a hero joining or leaving rescales him (boss/duo.js)
  const slow = F.sd && F.sd.pinned ? def.sunder.slow : 1;   // (pinned: his moves come slower)
  // he can't be floored, flung or carried off by a power: whatever tried it, he's back on his feet (a move that can't be
  // broken carries on through it; any other move is cut, as a stagger cuts it)
  if (!e.dead && (e.state === 'knockdown' || e.state === 'ragdoll' || e.state === 'grasped' || e.state === 'getup')){
    e.vel.set(0, 0, 0); e.group.rotation.x = 0; e.group.rotation.z = 0;
    if (F.sig && e.hyper) e.state = 'sig';
    else { e.state = 'recover'; e.st = 0.3; }
    floater(V3(e.group.position.x, e.group.position.y + 3.2, e.group.position.z), 'HE STANDS FIRM', '#cc99ff');
  }
  if (F.sig && e.hyper && e.state === 'stagger') e.state = 'sig';   // (a move that can't be broken: e.hyper)
  if (e.dead && !F.over){ teardown(); return; }   // (something put him down outside the rules: just let him go)
  const g = e.group, { dist } = aim(e, heroFor(e), F);
  // phase III's dark: the lights come down over a couple of seconds and stay down
  if (F.phase >= 3 && !F.over && def.mood){ MOOD.k = Math.min(1, MOOD.k + dt * 0.5); }
  else if (F.over && MOOD.k > 0) MOOD.k = Math.max(0, MOOD.k - dt * 0.35);   // he's beaten: the light comes back
  // a move running: it owns the body until it says it's over, or something knocked him out of it
  if (F.sig){
    const M = F.sig;
    if (e.state !== 'sig'){ endSig(e, true); }
    else {
      M.t += dt;
      if (M.mv.update(e, C, M, dt)) endSig(e, false);
    }
  }
  if (F.over) return;
  // the turn of the fight: the blow that took him past a threshold drives him to a knee, and he rises in the next phase
  if (!F.sig && F.phase < 3 && e.hp <= Math.ceil(e.maxHp * def.phaseAt[F.phase - 1]) + 1e-6) { startSig(e, BEAT); return; }
  if (F.phase >= 3 && e.hp <= 1 + 1e-6 && !F.over){ if (F.sig) endSig(e, true); startSig(e, DEFEAT); return; }
  // what he's watching for: a hero holding a block in his face, a hero crowding him
  const near = dist < 4.6 && C.hero.local;
  F.blockT = near && player.blockHeld && !(player.parryT > 0) ? F.blockT + dt : Math.max(0, F.blockT - dt * 2);
  F.crowdT = players.some(p => p.here && !p.down && Math.hypot(p.pos.x - g.position.x, p.pos.z - g.position.z) < (def.moves.repulse ? def.moves.repulse.crowd : 3)) ? F.crowdT + dt : Math.max(0, F.crowdT - dt);
  for (const k in F.cds) F.cds[k] -= dt * (F.phase >= 3 ? 1.25 : 1) * slow;
  if (F.sig) return;
  F.sigT -= dt * slow;
  // he only reaches for a move between exchanges: never out of a swing, a lock, a stagger or the floor
  const free = (e.state === 'chase' || e.state === 'recover') && !e.dead && !e.converted && !(e.stunT > 0) && !(e.dodgeT > 0);   // (stunT: a duellist's; a body without a duel has none)
  if (!free || e.dummy || G.gt - F.lastSig < def.sigMin) return;   // (a sandbox dummy stands and takes it: no moves)
  let mv = pickMove(e, F);
  // a party (boss/duo.js): sometimes he turns his move on the hero he wasn't on (then it's weighed again, against them)
  if (mv && !mv.urgent && duoWheel(e, F)){ aim(e, e.hero, F); if (!mv.can(e, C, F)) mv = pickMove(e, F); }
  if (mv) startSig(e, mv);
}
// this frame's context for his moves: the hero he's on, where they stand, which way and how far
function aim(e, hero, F){
  const pp = hero.pos, g = e.group;
  let tx = pp.x - g.position.x, tz = pp.z - g.position.z;
  const dist = Math.hypot(tx, tz) || 0.001; tx /= dist; tz /= dist;
  return Object.assign(C, { hero, pp, dist, tx, tz, remote: !hero.local, phase: F.phase });
}
function pickMove(e, F){
  const moves = F.D.moves, ready = [];
  for (const id in moves){
    const mv = moves[id], cfg = F.def.moves[id] || {};
    if ((cfg.from || 1) > F.phase || (cfg.to && cfg.to < F.phase) || (F.cds[id] || 0) > 0 || (mv.once && F.used[id])) continue;
    if (!mv.can(e, C, F)) continue;
    if (mv.urgent) return mv;   // the answers to what you're doing (a held block, a crowd, his last stand) go first
    ready.push(mv);
  }
  if (F.sigT > 0 || !ready.length) return null;
  return ready[(Math.random() * ready.length) | 0];
}
function startSig(e, mv){
  const F = e.fin;
  if (e.token) e.token = null;
  e.state = 'sig'; e.st = 99; e.plan = null; e.counterQueued = false;
  e.cutDrop = 0; e.cutTwist = null; e.flourishT = 0;
  const M = F.sig = { id: mv.id, mv, t: 0, open: false };
  mv.start(e, C, M);
}
function endSig(e, cut){
  const F = e.fin, M = F.sig;
  if (!M) return;
  F.sig = null;
  if (M.mv.end) M.mv.end(e, C, M, cut);
  e.legMode = null; e.upperMode = null; e.hyper = false; e.ward = null; e.kneel = 0;
  e.group.visible = true;
  if (e.state === 'sig'){ e.state = 'recover'; e.st = 0.35; }
  const cfg = F.def.moves[M.id];
  if (cfg && cfg.cd) F.cds[M.id] = cfg.cd;
  F.lastSig = G.gt;
  F.sigT = F.def.sigGap[F.phase - 1] * rand(0.8, 1.25);
  e.group.rotation.x = 0; e.group.rotation.z = 0;
}

/* ---------------- THE PHASE BEAT ----------------
   He's driven to a knee, the world slows, and nothing lands on him while it plays. He rises in the next phase with a
   repulse that throws everyone back off him (dodge it), the banner names what's coming, and the story has its say. */
const BEAT = {
  id: 'beat',
  start(e, C, M){
    const B = e.fin.def.beat;
    e.ward = 0; e.legMode = 'off'; e.upperMode = 'off';
    M.next = e.fin.phase + 1; M.rose = false;
    G.slowmo = B.slowmo; G.slowmoT = Math.max(G.slowmoT, B.slowT);
    G.shake = Math.max(G.shake, 0.9); G.hitstop = Math.max(G.hitstop, 0.12);
    screenFlash('radial-gradient(ellipse at center, rgba(255,60,60,.16), transparent 55%)', 0.5, 0.4);
    burst(V3(e.group.position.x, 1.6 * e.group.scale.y, e.group.position.z), 0xff3a4a, 24, 9, 5);
    S.stun(e.group.position);
    for (const b of bolts) if (!b.friendly && b.src === e) b.life = 0;
    e.fin.D.look.beatStart && e.fin.D.look.beatStart(e, M);
    MUSIC.bossBeat(B.kneel + B.rise * 0.5 + 0.3);   // the score drops out under a rising choir (audio/music.js epic layer)
  },
  update(e, C, M, dt){
    const B = e.fin.def.beat, t = M.t, g = e.group;
    // down onto a knee, a breath, then up
    const down = ss(0, 0.35, t) * (1 - ss(B.kneel, B.kneel + B.rise * 0.6, t));
    e.kneel = down;
    g.rotation.x = 0.22 * down;
    turnTo(e, C, dt, 3);
    const u = g.userData;
    if (u.weaponArm){ u.weaponArm.rotation.x += (-0.2 * down + (-2.4) * ss(B.kneel, B.kneel + B.rise, t) * (1 - down) - u.weaponArm.rotation.x) * Math.min(1, dt * 8); }
    e.fin.D.look.beatPose && e.fin.D.look.beatPose(e, M, t);
    if (!M.rose && t >= B.kneel + B.rise * 0.5){
      M.rose = true;
      e.legMode = null; e.upperMode = null;
      const F = e.fin;
      F.phase = M.next;
      setPhaseDuel(e, F.phase);
      e.hpFloor = F.phase < 3 ? Math.ceil(e.maxHp * F.def.phaseAt[F.phase - 1]) : 1;
      setHudPhase(F.phase, F.def);
      if (F.phase >= 3 && F.def.mood) setMood(F.def.mood);
      if (F.D.look.phase) F.D.look.phase(e, F.phase, false);   // what changes on him (the Magistrate's shield goes, his armour cracks)
      repulseRing(e, B.ring.r, B.ring.dmg, B.push);
      const words = F.def.phaseLines && F.def.phaseLines[F.phase - 1];
      showBanner('PHASE ' + ROMAN[F.phase], words || '', 3, { kicker: F.def.name });
      storyBeat('phase' + F.phase);
      S.roar(g.position); MUSIC.bossPhase(F.phase);   // a tutti hit lands his new phase on a fresh downbeat
      if (hooks.fin) hooks.fin({ k: 'phase', n: e.nid, p: F.phase });
      F.cds = {}; F.sigT = 0.8;
    }
    return t >= B.kneel + B.rise;
  },
};
// a ring of force off him along the floor: it throws back and hurts whoever it catches on the ground (dodge or jump it)
export function repulseRing(e, r, dmg, knock){
  const g = e.group, at = V3(g.position.x, 0.1, g.position.z);
  spawnGroundShock(at, 0xff2a2a, r, 0.45, 0.95);
  spawnGroundShock(at, 0xffffff, r * 0.7, 0.3, 0.7);
  burst(V3(at.x, 1.2, at.z), 0xff4a5a, 26, 12, 5, 0.9);
  G.shake = Math.max(G.shake, 0.8); S.slam(at);
  for (const p of players){
    if (!p.here || p.down) continue;
    const dx = p.pos.x - at.x, dz = p.pos.z - at.z, d = Math.hypot(dx, dz);
    if (d > r) continue;
    if (p.local){
      if (player.dashT > 0 || p.pos.y > 1.1){ floater(playerPos(), 'EVADED', '#bfe8ff'); continue; }
      hurtHero(e, p, dmg, null, { unblockable: true });
      const l = d || 1; player.vel.x += dx / l * knock; player.vel.z += dz / l * knock;
    } else if (hooks.hurt) hooks.hurt(e, dmg, g.position, 'zap', true);
  }
}

/* ---------------- THE DEFEAT ----------------
   He's done: on his knees, the blade dies in his hand, the world slows. The field clears, then the story (the
   campaign's choice and epilogue), the win screen, or (the sandbox) the floor back. */
const DEFEAT = {
  id: 'defeat',
  start(e, C, M){
    const F = e.fin, D = F.def.defeat;
    F.over = true;
    e.ward = 0; e.hpFloor = 0; e.legMode = 'off'; e.upperMode = 'off';
    if (G.stats) G.stats.bossKilled = true;
    bossDown();   // the game saves (game/autosave.js)
    gainXp(D.xp);
    G.slowmo = D.slowmo; G.slowmoT = Math.max(G.slowmoT, D.slowT);
    G.shake = 1.2; G.hitstop = Math.max(G.hitstop, 0.16);
    screenFlash('radial-gradient(ellipse at center, rgba(255,240,220,.2), transparent 60%)', 0.6, 0.6);
    // the fight is over: his reinforcements, the shockwaves and the lingering shots go
    G.spawnQueue.length = 0;
    for (const o of enemies){ if (o !== e && !o.dead){ o.dead = true; o.state = 'fade'; o.st = 0.6; hideIndicators(o); } }
    for (const r of rings) scene.remove(r.mesh); rings.length = 0;
    for (let i = bolts.length - 1; i >= 0; i--){ if (!bolts[i].friendly){ scene.remove(bolts[i].mesh); bolts.splice(i, 1); } }
    killCam('boss', e);   // his fall, side-on and slowed (engine/killcam.js): the field is clear by now
    showBanner(F.def.fallLine || (F.def.name + ' FALLS'), '', 3.2);
    S.roar(e.group.position); S.boom(e.group.position, 2); MUSIC.bossFinish();
    F.D.look.defeatStart && F.D.look.defeatStart(e, M);
    if (hooks.fin) hooks.fin({ k: 'down', n: e.nid });
  },
  update(e, C, M, dt){
    const D = e.fin.def.defeat, t = M.t, g = e.group;
    e.kneel = ss(0, 0.5, t);
    g.rotation.x = 0.1 * ss(0, 0.3, t) + 0.26 * ss(0.6, 1.6, t);
    g.rotation.z = 0.05 * Math.sin(t * 5) * (1 - ss(0.5, 1.5, t));
    e.fin.D.look.defeatPose && e.fin.D.look.defeatPose(e, M, t);
    if (t >= D.kneel && !M.done){
      M.done = true;
      e.dead = true; e.state = 'fade'; e.st = 3.2; e.hp = 0; hideIndicators(e);   // (he stays on his knees, then sinks away: enemies/ai.js fade)
      hideHud();
      if (e.fin.mission) return false;   // (a mission's duel: the objective sees him gone, and the mission goes on from there)
      if (hooks.bossDead) hooks.bossDead();   // co-op: the guest's fight ends too
      if (G.sandbox) showBanner('', 'BOSS DEFEATED', 1.6);   // the training floor: no win screen, the floor back
      else victory();
    }
    return false;   // (it never hands the body back: he's done)
  },
};

/* ---------------- shared helpers for the moves ---------------- */
// turn the body toward the hero at a capped rate (rad/s)
export function turnTo(e, C, dt, rate = 8){
  const g = e.group, want = Math.atan2(C.tx, C.tz), d = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
  g.rotation.y += clamp(d, -rate * dt, rate * dt);
}
// a blow from him on a hero: this browser's own hero takes it through hurtPlayer (block, parry, dodge as ever), a
// partner's goes to their browser (net/foefire.js). Returns what happened ('hit', 'blocked', 'parried', ... or 'sent')
export function hurtHero(e, p, dmg, from, opts = {}){
  if (!p.local){ if (hooks.hurt) hooks.hurt(e, dmg, from || e.group.position, opts.melee ? 'bossmelee' : 'zap', !!opts.unblockable); return 'sent'; }
  return hurtPlayer(dmg, from, false, !!opts.melee, false, { by: e, ...opts });
}
// the boss as this browser shows him: the host's foe, or on a guest the puppet of it
export const finaleNow = () => shared.finale;
// a co-op guest's or a reset's end of the fight: the bar and the dark go
function teardown(){
  const e = shared.finale;
  if (e && e.fin && e.fin.sig && !e.fin.over && e.fin.sig.mv.end) e.fin.sig.mv.end(e, C, e.fin.sig, true);
  shared.finale = null; shared.reviveMul = null;
  hideHud();
  if (MOOD.k > 0) setMood(null);
  for (const id in REG()) REG()[id].look.teardown && REG()[id].look.teardown();
}
export function dropFinale(){ teardown(); }
// tests and the duel bot (tools/): start one of his moves now, in a given phase (window.GAME.finaleMove)
export function finaleMove(id, phase){
  const e = shared.finale;
  if (!e || !e.fin || e.dead || e.fin.over) return false;
  const F = e.fin;
  if (phase && phase !== F.phase){ F.phase = phase; setPhaseDuel(e, phase); e.hpFloor = phase < 3 ? Math.ceil(e.maxHp * F.def.phaseAt[phase - 1]) : 1; setHudPhase(phase, F.def); if (phase >= 3 && F.def.mood) setMood(F.def.mood); if (F.D.look.phase) F.D.look.phase(e, phase, false); }
  if (!id){ if (F.sig) endSig(e, true); return true; }   // (none: whatever he's doing ends)
  const mv = id === 'beat' ? BEAT : id === 'defeat' ? (e.hp = 1, DEFEAT) : F.D.moves[id];
  if (!mv) return false;
  if (F.sig) endSig(e, true);
  startSig(e, mv);
  return true;
}
// a Force Push from this browser's hero (player/jedi/force.js): a move with an answer to it (his lightning, his choke)
// takes it. True when it did
export function finalePush(pp, f){
  const e = shared.finale;
  if (!e || !e.fin || e.dead || !e.fin.sig || !e.fin.sig.mv.onPush) return false;
  return !!e.fin.sig.mv.onPush(e, e.fin.sig, pp, f);
}

/* ---------------- co-op: the guest's side ---------------- */
// the host's messages: the boss is up (his puppet's number), a phase turned, a move's effect, his defeat
export function finaleNet(m){
  if (m.k === 'up'){ guestNet.n = m.n; guestNet.id = m.id; guestNet.phase = 1; guestNet.mods = m.rm || null; return; }
  const D = REG()[guestNet.id];
  if (m.k === 'sd'){ setSunderHud(m.v, m.p, m.o); return; }   // the sunder bar (a raid boss)
  if (m.k === 'ag'){ duoHeard(puppetOfNid(m.n), m.s); return; }   // a party: who he's on now (boss/duo.js)
  if (m.k === 'pc'){ pincerFx(puppetOfNid(m.n), D && D.def); return; }   // ...and two of them caught him between them
  if (m.k === 'sb'){ if (D) showBanner((D.def.sunder && D.def.sunder.broke) || 'BROKEN OPEN', (D.def.sunder && D.def.sunder.brokeSub) || '', 2.4, { kicker: D.def.name }); return; }
  if (m.k === 'phase'){
    guestNet.phase = m.p; MUSIC.bossPhase(m.p);
    if (D){ setHudPhase(m.p, D.def); showBanner('PHASE ' + ROMAN[m.p], (D.def.phaseLines && D.def.phaseLines[m.p - 1]) || '', 3, { kicker: D.def.name }); if (m.p >= 3 && D.def.mood) setMood(D.def.mood);
      const pe = puppetOfNid(guestNet.n); if (D.look.phase && pe) D.look.phase(pe, m.p, true); }
    return;
  }
  if (m.k === 'down'){ bossDown(); MUSIC.bossFinish(); if (D) showBanner(D.def.fallLine || (D.def.name + ' FALLS'), '', 3.2); teardown(); return; }   // (his puppet kneels and fades with the snapshot)
  if (D && D.look.netFx) D.look.netFx(m, puppetOfNid(m.n));
}
const guestNet = { n: null, id: null, phase: 1, mods: null };
const puppetOfNid = (n) => enemies.find(e => e.nid === n) || null;
// a guest: the puppet of the host's boss is the finale here too (its bar, the dark of phase III)
export function adoptFinalePuppet(e){
  if (shared.finale === e) return;
  shared.finale = e; e.finId = guestNet.id || Object.keys(REG()).find(id => REG()[id].def.look === e.look) || null;
  if (e.finId){ const def = REG()[e.finId].def; e.finPhase = guestNet.phase; showHud(e); setHudPhase(guestNet.phase || 1, def);
    e.roles = !!def.sunder; shared.reviveMul = def.reviveMul || null; }   // (a raid boss: this screen's blows carry their role tags, boss/roles.js)
}
function updateGuestFinale(e, dt){
  if (!enemies.includes(e) || e.dead){ teardown(); return; }
  const H = hudEls();
  if (H){ if (H.wrap.style.display !== 'block') showHud(e); H.bar.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%'; }
  if (guestNet.phase >= 3 && MOOD.k < 1) MOOD.k = Math.min(1, MOOD.k + dt * 0.5);
  const D = e.finId && REG()[e.finId];
  if (D && D.look.guestFrame) D.look.guestFrame(e, dt);
}
// does this look belong to a final boss? (net/foes.js: a puppet built in it is the guest's finale)
export const finaleLook = (look) => !!look && Object.values(REG()).some(D => D.def.look === look);
// ...and the model he's dressed in, if it isn't his body's own (net/foes.js builds the puppet in it)
export const finaleDress = (look) => { const D = look && Object.values(REG()).find(D => D.def.look === look); return D && D.def.dress || null; };
