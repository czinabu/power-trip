// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CALM AFTER A CHAPTER'S LAST FIGHT: a quiet beat between the loud one that closed a chapter (a duel, a hold, a
// stretch of waves) and the next chapter card. The field is cleared and the score drops away; a marker comes up at the
// rally point (the story's voice waits there if they stayed on set: game/onset.js) and a short exchange plays over the
// comms while you walk to it (data/calm.js), in brisk lines that don't keep you waiting. Reaching it closes the chapter at
// once, whatever is still to be said (the rest is dropped, and the Chapter complete card goes with it): the upgrade screen,
// then the next card (game/flow.js 'chapterdone'). It closes on its own
// after CALM_CFG.max seconds, wherever you are. Nobody can fall during it (player/damage.js): the chapter is already won.
//
// Every story's campaign (Jedi, Mandalorian, ARC trooper), solo and co-op: the host runs it and its snapshots carry the
// rally point to the guests (net/foes.js), who see the same marker; whoever reaches it first closes it for everyone, and
// a guest's upgrade screen waits for it to end (game/campaign.js). A lone mission, survival, training and the sandbox have
// no next chapter to wait for: they end as they always have.
//
// THE WAY ON. A chapter with a `doorway` (data/campaign-*.js) leads straight into the next one: its rally point is where
// the next chapter starts, and reaching it fades the screen to black and closes the chapter, so the next one comes up out
// of the dark right there (world/doorway.js lifts it). Its `at` says where:
//   'next'     the next chapter's start (its mission's `start`, or a wave chapter's spawn): two chapters on one map
//   [x, z]     a spot on this map (a door out of it: the next chapter is on another map)
//   (none)     the temple's great doors (world/arenas/temple.js): reaching them opens them, and walking through them
//              is what fades (the Jedi's siege into the archive)

import { G, shared, enemies, keys } from '../state.js';
import { setPhase } from './run-state.js';
import { interactReady } from './interact.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { playerPos } from '../player/helpers.js';
import { makeBeacon, removeMarker, pulseMarker, heroIn } from './objectives.js';
import { comms, dropComms, clearComms } from './story.js';
import { stageHolds, finishCard } from '../ui/hud-stage.js';
import { onSetFigures, meetAt } from './onset.js';
import { CALM, CALM_CFG } from '../data/calm.js';
import { LEVELS } from '../data/levels.js';
import { chapterOrder, storyHero, storyVoice } from '../data/campaign.js';
import { MISSIONS } from '../data/missions.js';
import { findClearSpawn, groundAt, segBlockedBySolids } from '../world/collision.js';
import { removeEnemy } from '../enemies/cleanup.js';
import { burst } from '../fx/particles.js';
import { MUSIC } from '../audio/music.js';
import { net, on, send, connected } from '../net/session.js';
import { templeDoors, doorState, doorFront, doorThrough, openDoors, goThrough, liftFade } from '../world/doorway.js';
import * as THREE from 'three';

const COLOR = 0x9fe0ff;
const CALM_TAG = 'calm';   // the exchange's lines on the comms strip (game/story.js comms opts.tag): brisk, and dropped when it ends
const say = (lines, front) => comms(lines, { brisk: true, tag: CALM_TAG, front });
// the calm running now. host: { t, at: {x, z}, mark, said, label, who }; a guest's copy is shown, not run (A.guest)
const A = { on: false, t: 0, at: null, mark: null, said: false, label: '', who: '', reached: false, guest: false, sent: false, then: null, wait: 0, seen: false, door: null, doorSt: 0, doorT: 0 };
export const calmOn = () => A.on;

const chapterNow = () => G.chapter >= 0 ? chapterOrder(G.actTwo)[G.chapter] : null;
// the chapter's own exchange, or one from the pool for how it ended; false: no calm for it
function exchangeFor(c){
  const book = CALM[storyHero()] || CALM.jedi, own = book.chapters && book.chapters[c.id];
  if (own === false) return false;
  if (own) return own;
  const def = c.kind === 'mission' && MISSIONS[c.mission], last = def && def.objectives[def.objectives.length - 1];
  const kind = def ? (last && CALM_CFG.after.includes(last.kind) ? last.kind : null) : 'hold';   // (a wave chapter was a hold)
  if (!kind) return false;
  const pool = book[kind] || book.hold;
  return pool && pool.length ? pool[G.chapter % pool.length] : [];
}

// the rally point: where the voice stands, if they stayed on set and are a walk away; otherwise open ground a walk off
function rallySpot(){
  const pp = playerPos(), cast = onSetFigures()[0];
  if (A.door){ const f = wayOn(A.door); return { x: f.x, z: f.z, who: cast && meetAt(f.x + 4.5, f.z - 0.5) ? cast.name : '' }; }   // (the voice meets you beside it, out of the way)
  if (cast){
    const d = Math.hypot(cast.pos.x - pp.x, cast.pos.z - pp.z);
    if (d >= CALM_CFG.near){ const k = Math.max(0, (d - 1.6) / d); return { x: pp.x + (cast.pos.x - pp.x) * k, z: pp.z + (cast.pos.z - pp.z) * k, who: cast.name }; }
  }
  const [hx, hz] = [shared.arenaHalf - 3, (shared.arenaHalfZ || shared.arenaHalf) - 3];
  let best = null, bs = -Infinity;
  for (let k = 0; k < 16; k++){
    const a = G.yaw + Math.PI + (k / 16) * Math.PI * 2;   // (from behind the hero round: back the way they came, first)
    for (const d of [CALM_CFG.far[1], (CALM_CFG.far[0] + CALM_CFG.far[1]) / 2, CALM_CFG.far[0], CALM_CFG.far[0] * 0.6]){
      const c = findClearSpawn(pp.x + Math.sin(a) * d, pp.z + Math.cos(a) * d, 1.2);
      if (Math.abs(c.x) > hx || Math.abs(c.z) > hz || segBlockedBySolids(pp.x, pp.z, c.x, c.z)) continue;
      const dd = Math.hypot(c.x - pp.x, c.z - pp.z), up = Math.abs(groundAt(c.x, c.z, pp.y + 2) - pp.y);
      const score = Math.min(dd, CALM_CFG.far[1]) - up * 6 - k * 0.15;
      if (score > bs){ bs = score; best = c; }
      break;
    }
  }
  const c = best || findClearSpawn(pp.x - Math.sin(G.yaw) * CALM_CFG.far[0], pp.z - Math.cos(G.yaw) * CALM_CFG.far[0], 1.2);
  const met = cast && meetAt(c.x, c.z);   // (the voice was too close to walk to: they go on ahead and meet you there, unseen)
  return { x: c.x, z: c.z, who: met ? cast.name : '' };
}
// where a chapter's `doorway` leads (THE WAY ON above)
function wayOn(d){
  if (Array.isArray(d.at)) return findClearSpawn(d.at[0], d.at[1], 1.0);
  if (d.at === 'next'){
    const n = chapterOrder(G.actTwo)[G.chapter + 1], m = n && n.kind === 'mission' && MISSIONS[n.mission];
    if (m && m.start) return findClearSpawn(m.start[0], m.start[1], 1.0);
    const L = n && n.kind === 'waves' && { ...LEVELS[n.level], ...n.arena };
    if (L) return findClearSpawn(0, L.arena / 2 * 0.5, 1.0);   // (where a wave chapter puts the hero: game/flow.js startLevel)
  }
  return doorFront() || playerPos();
}
const twoStep = (d) => !d.at;   // the temple doors: open them, then walk through
function showMark(x, z){
  if (A.mark) removeMarker(A.mark);
  A.mark = makeBeacon(x, z, groundAt(x, z, 3), COLOR, 1.4);
}
function dropMark(){ if (A.mark){ removeMarker(A.mark); A.mark = null; } }

// game/campaign.js (a mission chapter cleared) and game/flow.js (a wave chapter's last wave): start the calm if the
// chapter earns one. True when it did (the caller then waits for it: shared.levelPhase 'aftermath')
export function startCalm(){
  const c = chapterNow();
  if (!c || G.mode !== 'play' || G.coopGuest || A.on) return false;
  const lines = exchangeFor(c);
  if (lines === false) return false;
  // the field goes quiet: whatever is left of the fight is swept away
  for (const e of enemies){ if (!e.dead && e.group) burst(new THREE.Vector3(e.group.position.x, 1.2, e.group.position.z), 0xffd28a, 10, 4, 3, 0.8); removeEnemy(e); }
  enemies.length = 0; G.spawnQueue.length = 0;
  const door = c.doorway && (c.doorway.at || templeDoors()) ? c.doorway : null;   // (the way on: THE WAY ON above)
  Object.assign(A, { on: true, guest: false, t: 0, skipT: 0, at: null, said: false, reached: false, lines, door, label: (door && door.label) || (CALM[storyHero()] || CALM.jedi).label || 'REGROUP', who: '' });
  G.calm = true;
  setPhase('aftermath', 0);
  MUSIC.setCue('calm');
  return true;
}
// ends it. quiet: a new chapter, the menu, a retry (nothing follows); otherwise the chapter closes (game/flow.js)
export function endCalm(quiet){
  if (!A.on && !A.mark) return;
  const host = A.on && !A.guest;
  A.on = false; A.at = null; G.calm = false;
  dropMark();
  dropComms(CALM_TAG);   // (the hero walked out, or the chapter's gone: the exchange's lines still to come aren't waited for)
  if (quiet || !host) return;
  clearComms(); finishCard();   // walked out: nothing left on the strip or the card keeps the upgrade screen waiting
  setPhase('chapterdone', 0.6);   // (then the upgrade screen)
}

// HOLD F TO MOVE ON: whoever doesn't want the walk can hold F (the pad's Y) and the chapter closes as if they'd reached the
// marker: the screen goes dark through a doorway, or the upgrade screen comes up. Not while F has a prompt to answer
const SKIP_HOLD = 1.0;
const skipWord = () => pad.active ? padKeys('HOLD F') + ' TO MOVE ON' : 'HOLD F TO MOVE ON';
function skipHeld(dt){
  if (keys.f && !interactReady()) A.skipT = (A.skipT || 0) + dt; else A.skipT = 0;
  return A.skipT >= SKIP_HOLD;
}
function skipNow(){
  A.skipT = 0;
  if (A.door){ dropMark(); goThrough(() => endCalm(false)); return; }   // (straight into the dark, where the next chapter comes up)
  endCalm(false);
}
// for the HUD (ui/hud.js): the line while it runs, and where the waypoint points
export function calmHud(){
  if (!A.on) return null;
  const d = A.door, st = d ? (A.guest ? A.doorSt || 0 : doorState()) : 0;
  let status = !A.at ? 'TAKE A BREATH' : d ? (st ? d.through || 'WALK THROUGH THE DOORS' : d.to || 'WALK TO THE MARKER') : A.reached ? 'REGROUPED' : 'NO RUSH · WALK TO THE MARKER';
  if (A.at && !A.guest && st < 2) status += A.skipT > 0 ? ' · MOVING ON ' + '▮'.repeat(Math.ceil(A.skipT / SKIP_HOLD * 5)).padEnd(5, '▯') : ' · ' + skipWord();
  return { title: A.who ? A.label + ' · ' + A.who : A.label, status };
}
export const calmTarget = () => A.on && A.at ? A.at : null;

// once a frame of play (main.js)
export function updateAftermath(dt){
  if (G.mode === 'menu' || G.chapter < 0){ if (A.on || A.mark) endCalm(true); A.then = null; if (G.mode === 'menu') liftFade(); return; }
  if (A.guest || G.coopGuest){ updateGuest(dt); return; }
  if (!A.on || dt <= 0) return;
  A.t += dt;
  if (!A.at && A.t >= CALM_CFG.markAt){
    const r = rallySpot();
    A.at = { x: r.x, z: r.z }; A.who = r.who;
    showMark(r.x, r.z);
    const voice = storyVoice(undefined, chapterNow());
    if (A.lines.length) say(A.lines.map(([who, line]) => ({ who: who || voice, say: line })));
    A.said = true;
  }
  if (A.mark) pulseMarker(A.mark, dt, G.gt);
  if (!A.at) return;
  if (skipHeld(dt) && (!A.door || doorState() < 2)){ skipNow(); return; }
  A.reached = A.reached || heroIn(A.at.x, A.at.z, CALM_CFG.reach);   // (either hero, in co-op)
  if (A.door){ updateDoor(); return; }
  if ((A.reached && A.t >= CALM_CFG.min) || A.t >= CALM_CFG.max) endCalm(false);   // (the exchange doesn't hold the way out)
}
// a doorway calm: at the doors they open and the marker moves just past them; through them the screen goes dark and
// the chapter closes. Past the calm's time limit the doors open on their own, and a while after that it closes anyway
function updateDoor(){
  const st = doorState(), due = (A.reached && A.t >= CALM_CFG.min) || A.t >= CALM_CFG.max;
  if (!twoStep(A.door)){   // a spot: there, the screen goes dark
    if (st === 0 && due){ dropMark(); goThrough(() => endCalm(false)); }
    return;
  }
  if (st === 0 && due){
    openDoors();
    const t = doorThrough();
    A.at = { x: t.x, z: t.z }; A.reached = false; A.doorT = A.t;
    showMark(t.x, t.z);
    if (A.door.open) say(A.door.open.map(([who, line]) => ({ who: who || storyVoice(undefined, chapterNow()), say: line })), true);
  } else if (st === 1 && (A.reached || A.t - A.doorT >= CALM_CFG.max)){
    dropMark();
    goThrough(() => endCalm(false));
  }
}

/* ---------- co-op ---------- */
// net/foes.js: what the host's snapshot carries ([x, z] of the rally point while a calm is up)
export function calmSnap(){
  if (!(A.on && !A.guest && A.at)) return undefined;
  const at = [Math.round(A.at.x * 10) / 10, Math.round(A.at.z * 10) / 10];
  return A.door ? [...at, doorState()] : at;   // (a doorway calm: whether the doors are open, or the host has gone through)
}
// a guest: the host's snapshot. Shows the marker while the host's calm is up; takes it down when it ends
export function calmSync(af){
  if (af){
    A.seen = true;
    const c = chapterNow(), door = af.length > 2 && c && c.doorway ? c.doorway : null;
    if (!A.on || !A.at || A.at.x !== af[0] || A.at.z !== af[1]){ Object.assign(A, { on: true, guest: true, at: { x: af[0], z: af[1] }, who: '', reached: false, sent: false, door, label: (door && door.label) || (CALM[storyHero()] || CALM.jedi).label || 'REGROUP' }); showMark(af[0], af[1]); G.calm = true; }
    if (door){   // the host's doors: open with them, and go dark with them
      A.doorSt = af[2];
      if (af[2] >= 1 && twoStep(door)) openDoors();
      if (af[2] >= 2){ goThrough(); dropMark(); }
    }
  } else if (A.on && A.guest){ A.on = false; A.at = null; G.calm = false; dropMark(); dropComms(CALM_TAG); finishCard(); }
}
// game/campaign.js: a guest's chapter cleared. What follows (its upgrade screen) waits for the host's calm, if one comes
export function guestCalm(then){ A.then = then; A.wait = 2.0; A.seen = false; }
function updateGuest(dt){
  if (A.mark) pulseMarker(A.mark, dt, G.gt);
  if (A.on && A.at && !A.sent){
    const p = playerPos();
    if (Math.hypot(p.x - A.at.x, p.z - A.at.z) < CALM_CFG.reach){ A.reached = true; A.sent = true; if (connected()) send({ t: 'afr' }); }
  }
  if (A.then && !A.on && !stageHolds() && (A.seen || (A.wait -= dt) <= 0)){ const f = A.then; A.then = null; f(); }   // (no calm came, or it ended)
  if (!G.coopGuest && A.guest){ A.on = false; A.at = null; G.calm = false; dropMark(); A.guest = false; }   // (left the host's run)
}
// the host: a guest reached the rally point (it counts as there once the exchange has had its say)
on('afr', () => { if (net.role === 'host' && A.on && !A.guest) A.reached = true; });
