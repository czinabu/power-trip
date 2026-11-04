// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CUTSCENES: short in-engine scenes in the campaign and the missions (their words: data/cutscenes.js). A scene is a run of
// shots: the lens eases from one spot to another around the hero, a spot on the field or an actor (a stand-in figure that
// walks on, or a foe already there), with a line of dialogue or a title under a letterbox. The fight holds still while one
// plays (in co-op, the host's foes hold for both heroes), the hero idles. A tap of Space (or Enter, or a pad's A) moves on
// to the next line; holding it (or a pad's MENU) skips the whole scene. In co-op a skip is a vote: the scene ends once
// everyone watching it has asked to skip (skipping below).
//
// Who calls what: game/campaign.js plays a chapter's opening when its card closes, game/mission.js a duel's entrance
// before its foe steps in, game/flow.js the boss's arrival on Exegol. Anything else plays a SCENES entry by id.

import * as THREE from 'three';
import { camera, scene } from '../engine/renderer.js';
import { G, shared, player, isGunner, bolts } from '../state.js';
import { VOICE, storyHero } from '../data/campaign.js';
import { MANDO_BOSS, MANDO_CAST } from '../data/campaign-mando.js';
import { JEDI_BOSS, JEDI_DUELS, JEDI_CAST } from '../data/campaign-jedi.js';
import { storyWords } from './choices.js';
import { playerPos, stance, fwd, rightV } from '../player/helpers.js';
import { animatePlayer } from '../player/animation.js';
import { stowForScene, endSceneDraw, sceneStow, sceneRestore, bladeLit } from '../player/holster.js';
import { syncOffSaber } from '../player/model/weapons.js';
import { stowFoe, drawFoe, stepFoe, endFoe } from './duel-draw.js';
import { namedForm } from '../enemies/foeform.js';
import { BOSS_FORM } from '../data/foe-forms.js';
import { cameraClearance, sightClear, updatePropFade } from '../world/camblock.js';
import { findClearSpawn, groundAt, segBlockedBySolids } from '../world/collision.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { foeType } from '../enemies/look.js';
import { castId, masterBlade } from '../data/saber-cast.js';
import { updateLegs } from '../enemies/gait.js';
import { updateUpper } from '../enemies/upper.js';
import { resetCameraRig, updateCamera } from '../engine/camera.js';
import { net, on, send, connected } from '../net/session.js';
import { nameOf } from '../net/names.js';
import { coopRun } from '../net/run.js';
import { allies } from '../allies/squad.js';
import { CUT, OPENINGS, DUELS, BOSS, SCENES } from '../data/cutscenes.js';
import { BOSS_CFG, BOSS_MANDO } from '../data/bosses.js';
import { missionState } from './mission.js';
import { makeFigure, stepFigure, dropFigure, castOf } from './cast.js';
import { keepCast } from './onset.js';
import { STAGE } from '../data/cutscene-stage.js';
import { chapterOrder, storyVoice } from '../data/campaign.js';
import { meetNamed } from './codex.js';
import { TAUNTS } from '../data/duel-taunts.js';
import { settleHero, prepScene, blockScene, unblockScene, matesAround, sizeOf, roomFor } from './blocking.js';

const hero = () => isGunner() ? 'mando' : 'jedi';
const pick = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v[hero()] : v;
const ease = (t) => t * t * (3 - 2 * t);
const yawTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);

/* ---------- the frame: letterbox, title, subtitle, skip hint ---------- */
const el = document.createElement('div');
el.id = 'cutscene';
el.innerHTML = '<div class="cs-bar top"></div><div class="cs-bar bot"></div>' +
  '<div class="cs-title"><div class="cs-k"></div><div class="cs-h"></div><div class="cs-p"></div></div>' +
  '<div class="cs-line"><div class="cs-who"></div><div class="cs-say"></div></div><div class="cs-mark"><i></i></div>' +
  '<div class="cs-where"></div><div class="cs-goal"><div class="cs-gk">OBJECTIVE</div><div class="cs-gh"></div></div>' +
  '<div class="cs-skip"><svg class="cs-ring" viewBox="0 0 20 20"><circle class="bg" cx="10" cy="10" r="8"/>' +
  '<circle class="fg" cx="10" cy="10" r="8"/></svg><span class="cs-sk"></span><div class="cs-vote"></div></div>';
document.body.appendChild(el);
el.style.setProperty('--bars', (CUT.bars * 100) + 'vh');
const $ = (c) => el.querySelector(c);

/* ---------- the scene playing now ---------- */
const C = { on: false, key: '', shots: [], i: 0, t: 0, actors: [], kept: [], keepYaw: 0, heroYaw: 0, mark: null, onDone: null, fade: 0, ending: false, shown: null };
export const sceneOn = () => C.on;
// scenes already seen on this visit: a retry after a death doesn't replay them (cleared when a chapter or mission starts afresh)
const seen = new Set();
export function resetScenes(){ seen.clear(); }

// how long a line holds: long enough to read
const lineTime = (line) => line ? Math.max(CUT.minLine, String(line[1]).length / CUT.readRate + 1.0) : 0;

/* ---------- actors: a stand-in figure (built from a foe type), or something already on the field ---------- */
// things already on the field a scene can frame by name: each returns its group (looked up when a scene starts, never at load)
const binders = {
  boss: () => shared.boss && shared.boss.group,
  quarry: () => { const M = missionState(); return M.quarry && M.quarry.g; },   // the chase's quarry, where it stands
};
export function bindActor(name, fn){ binders[name] = fn; }
function makeActor(def, x, z, yaw){
  // (in the mission's uniform: enemies/look.js) (a saber wielder in its own face and clothes: data/saber-cast.js)
  const base = foeType(ENEMY_TYPES[def.foe] ? def.foe : 'duelist');
  const g = buildEnemyMesh(def.dress ? { ...base, ...def.dress } : base, { look: castId(def.name, def.mid) });   // (dress: a named foe's own model)
  const look = g.userData.look;
  g.scale.multiplyScalar(def.scale || 1);
  if (def.tint != null && g.userData.bodyMat && !look && !def.dress) g.userData.bodyMat.color.lerp(new THREE.Color(def.tint), 0.5);
  if (def.blade != null && g.userData.bladeGlow) g.userData.bladeGlow.material.color.setHex(masterBlade(look, def.blade));   // a form master's blade (game/mission.js)
  g.position.set(x, groundAt(x, z, 3.2), z); g.rotation.y = yaw;
  scene.add(g);
  return { g, own: true, scale: def.scale || 1, name: def.name || '', walk: null };
}
function boundActor(name){
  const g = binders[name] && binders[name]();
  return g ? { g, own: false, scale: g.scale.x || 1, name: '', walk: null, bind: name } : null;
}
// the actor walks from where it stands to (x, z) over `t` seconds, then turns to the hero
function walkTo(a, x, z, t){ a.walk = { x0: a.g.position.x, z0: a.g.position.z, x1: x, z1: z, t, k: 0 }; }
function updateActor(a, dt){
  if (!a.g) return;   // (gone from the set)
  stepFoe(a, dt);   // a duellist drawing at the scene's end (game/duel-draw.js)
  if (a.kind){ stepFigure(a, dt); return; }   // one of the story's cast (game/cast.js)
  if (!a.own){ const g = a.bind && binders[a.bind] && binders[a.bind](); if (g) a.g = g; }   // (a foe on the field keeps its pose, and only turns to you)
  const g = a.g, pp = playerPos();
  if (!a.own){ const want = yawTo(g.position.x, g.position.z, pp.x, pp.z); g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * Math.min(1, dt * 4); return; }
  if (a.walk){
    const w = a.walk;
    w.k = Math.min(1, w.k + dt / w.t);
    const k = w.k < 1 ? w.k : 1;
    g.position.x = w.x0 + (w.x1 - w.x0) * k; g.position.z = w.z0 + (w.z1 - w.z0) * k;
    if (w.k < 1) g.rotation.y = yawTo(w.x0, w.z0, w.x1, w.z1);
    else a.walk = null;
  } else {
    const want = yawTo(g.position.x, g.position.z, pp.x, pp.z);
    g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * Math.min(1, dt * 4);
  }
  g.position.y += (groundAt(g.position.x, g.position.z, g.position.y + 0.6) - g.position.y) * Math.min(1, dt * 12);   // up and down steps
  updateLegs(a, g, dt, 'ground');
  updateUpper(a, g, dt, pp);
}
function dropActors(){
  player.talking = false;
  for (const a of C.actors) if (a.g) a.g.userData.talk = false;
  // whoever stays on set (data/cast.js `stays`: the story's voice, there in person) is handed to game/onset.js, which keeps
  // them on the field behind the hero; the rest go
  const stay = [...C.kept, ...C.actors.filter(a => a.stays && a.g)];
  for (const a of C.actors){ if (a.stays) continue; if (a.kind) dropFigure(a); else if (a.own) scene.remove(a.g); }
  C.actors = []; C.kept = [];
  if (stay.length) keepCast(stay, C.keepYaw, !!C.one);   // (a scene without cuts leaves them where they stand: no pop)
}
// the cast leaves the set (the objective's look out over the field doesn't want them in it): a cut hides it (anyone who
// stays is only hidden: they are back, behind the hero, when the scene hands back)
function dropCast(){
  C.actors = C.actors.map(a => {
    if (!a.kind) return a;
    if (a.stays){ a.g.visible = false; a.talk = false; C.kept.push(a); } else dropFigure(a);
    return { g: null, gone: true };
  });
}

/* ---------- anchors: what a shot's lens circles. Each gives a spot and the way it faces ---------- */
const P = new THREE.Vector3(), L = new THREE.Vector3();
// eye level (world height) of the hero or an actor: off its head joint, so a close frames the face whatever its size
const EV = new THREE.Vector3();
function eyeOf(a){
  if (a === 'hero'){ if (player.rig && player.rig.head){ player.rig.head.getWorldPosition(EV); return EV.y + 0.18; } return playerPos().y + 2.1; }
  const head = a.kind === 'hero' ? a.target.rig.head : a.g && a.g.userData.head;
  if (head){ head.getWorldPosition(EV); return EV.y + (a.kind === 'hero' ? 0.18 : 0.12) * (a.scale || 1); }
  return a.g.position.y + 1.72 * (a.scale || 1);
}
function anchor(on){
  if (on === 'hero'){ const p = playerPos(); return { x: p.x, y: p.y, z: p.z, yaw: C.heroYaw, eye: eyeOf('hero') }; }
  if (on === 'mark') return { x: C.mark.x, y: 0, z: C.mark.z, yaw: C.mark.yaw };
  if (on === 'pair'){   // the hero and the one they talk to, side by side: the middle of them, facing across the line between them
    const p = playerPos(), b = C.actors[C.pair || 0];
    if (!b || !b.g) return anchor('hero');
    const q = b.g.position;
    return { x: (p.x + q.x) / 2, y: Math.min(p.y, q.y), z: (p.z + q.z) / 2, yaw: yawTo(p.x, p.z, q.x, q.z) + Math.PI / 2, eye: (eyeOf('hero') + eyeOf(b)) / 2 };
  }
  const a = C.actors[on === 'actor' ? 0 : on] || C.actors[0];
  if (!a || !a.g) return anchor('hero');
  const g = a.g.position, p = playerPos();
  return { x: g.x, y: g.y, z: g.z, yaw: yawTo(g.x, g.z, p.x, p.z), scale: a.scale, get eye(){ return eyeOf(a); } };
}
// where a shot looks: { on, h } a height over an anchor, or { on, ahead, h } a point that far along the anchor's facing
function lookPoint(look, out){
  const a = anchor(look.on), s = look.on === 'hero' || look.on === 'mark' || look.on === 'pair' ? 1 : (a.scale || 1);
  const f = look.ahead || 0;
  return out.set(a.x + Math.sin(a.yaw) * f, look.eye ? a.eye + look.h : a.y + look.h * s, a.z + Math.cos(a.yaw) * f);   // (look.eye: h is over or under eye level)
}

/* ---------- building shots ---------- */
// can a lens stand at (x, y, z) and see the point (ax, ay, az)? 0 (no) to 1 (a clear view): inside the arena's walls,
// out of every prop, and nothing solid between
const HALF = () => [shared.arenaHalf - 0.6, (shared.arenaHalfZ || shared.arenaHalf) - 0.6];
function lensView(ax, ay, az, x, y, z){
  const [hx, hz] = HALF();
  if (Math.abs(x) > hx || Math.abs(z) > hz) return 0;
  const k = Math.min(sightClear(ax, ay, az, x, y, z), cameraClearance(ax, ay, az, x, y, z) >= 0.999 ? 1 : 0);
  return k < 0.98 ? k : rayClear(ax, ay, az, x, y, z);
}
// ...and nothing else drawn in the way either: a canyon wall, a building or a ship's hull isn't a prop (a ray through the
// scene; the hero, the cast and anything see-through don't count)
const ray = new THREE.Raycaster(), RA = new THREE.Vector3(), RD = new THREE.Vector3();
let raySkip = null;   // (a scene without cuts counts the rest of the cast, and squadmates, as in the way: oneClear)
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function rayClear(ax, ay, az, x, y, z){
  RA.set(ax, ay, az); RD.set(x - ax, y - ay, z - az);
  const len = RD.length() + 0.4;   // (a little past the lens: it can't sit inside a wall either)
  if (len < 0.5) return 1;
  ray.set(RA, RD.normalize()); ray.near = 0.3; ray.far = len;
  const skip = raySkip || new Set([player.group, ...C.actors.map(a => a.g), ...(C.building || [])].filter(Boolean));
  for (const h of ray.intersectObjects(scene.children, true)){
    const o = h.object, m = o.material;
    if (!(o.isMesh) || !m || [].concat(m).some(mm => mm.transparent || mm.depthWrite === false) || !shown(o)) continue;
    let mine = false; for (let q = o; q; q = q.parent) if (skip.has(q)){ mine = true; break; }
    if (mine) continue;
    return Math.max(0, (h.distance - 0.3) / len);
  }
  return 1;
}
// shot(on, from, to, t, look, extra): from/to are [angle off the anchor's facing (0: in front, PI: behind), distance, height]
const shot = (on, from, to, t, look, extra = {}) => ({ on, from, to, t, look, ...extra });
// the hero speaks or listens: a close three-quarter, alternating sides line by line
function heroLines(lines, side = 1){
  return lines.map((ln, k) => {
    const s = (k % 2 ? -1 : 1) * side;
    // (framed off the hero's eyes, not a fixed height: a hero standing at ease would put the head under the letterbox)
    return shot('hero', [0.6 * s, 3.4, -0.12], [0.42 * s, 2.9, -0.08], lineTime(ln), { on: 'hero', h: -0.22, eye: true }, { line: ln, mirror: true, eye: true });
  });
}
function actorLines(lines, who){
  return lines.map((ln, k) => {
    const s = k % 2 ? -1 : 1;
    return shot('actor', [0.5 * s, 3.6, 1.15], [0.36 * s, 3.0, 1.4], lineTime(ln), { on: 'actor', h: 1.6 }, { line: [ln[0] || who, ln[1]], mirror: true });
  });
}
// a look over the hero's shoulder at the actor (the hero turned to face it)
const overShoulder = (t) => shot('hero', [Math.PI + 0.42, 4.4, 2.1], [Math.PI + 0.3, 3.9, 2.0], t, { on: 'actor', h: 1.4 }, { mirror: true });
// the last shot settles behind the hero, close to where the play camera sits, so the hand back is a short cut
const settle = (look) => shot('hero', [Math.PI, 5.6, 2.7], [Math.PI, 4.8, 2.4], 1.1, look || { on: 'hero', ahead: 8, h: 1.2 });
// a duel's last beat: the foe from in front and off to one side, far enough back to see its hand go to the belt, the
// blade come up out of the hilt and its guard come up (game/duel-draw.js)
// (h: the height it looks at, d: how far back, for a bigger figure: the warlord)
const drawShot = (h = 1.2, d = 1) => shot('actor', [0.85, 5.0 * d, 0.95 * d], [0.62, 4.4 * d, 0.85 * d], DRAW_BEAT, { on: 'actor', h }, { fov: 44, mirror: true, kind: 'draw', draw: true });
const DRAW_BEAT = 2.0;   // (s) the reach, the snap-hiss and the guard coming up, with a moment held in it
// the opening's wide look: high behind the hero, over what they face
// (in a narrow place, like the chase's alleys, it comes in closer and swings round until no wall stands in the way)
function wide(t, title){
  const pp = playerPos(), Y = G.yaw, W0 = Math.max(14, Math.min(30, shared.arenaHalf * 0.55));
  const clear = (a, d, h) => lensView(pp.x, pp.y + 1.4, pp.z, pp.x + Math.sin(Y + a) * d, pp.y + h, pp.z + Math.cos(Y + a) * d);
  let best = null, bestK = -1;
  search: for (const W of [W0, W0 * 0.7, W0 * 0.5, W0 * 0.35]) for (const a of [0.7, -0.7, 0.35, -0.35, 0, 1.1, -1.1]){
    const H = W * 0.5, k = Math.min(clear(Math.PI + a, W, H), clear(Math.PI + a * 0.5, W * 0.85, H * 0.8));
    if (k > bestK){ bestK = k; best = [a, W, H]; }
    if (k > 0.98) break search;
  }
  const [a, W, H] = best;
  return shot('hero', [Math.PI + a, W, H], [Math.PI + a * 0.5, W * 0.85, H * 0.8], t, { on: 'hero', ahead: Math.min(10, W * 0.5), h: 0 }, { title });
}

/* ---------- starting and ending ---------- */
// opts: key (seen once a visit) · shots · actors · mark {x, z} · face [x, z] (the hero turns to it) · onDone · share (sent to a co-op partner)
// the sim stands still but the gait reads player.moveVel/vel: a hero caught mid-run would keep striding in place, so stop them dead
function stillHero(){
  player.moveVel.set(0, 0, 0); player.vel.set(0, 0, 0);
  player.backRun = false;
}
// ...and whatever they were in the middle of (a swing, a slash, a punch, a push) is let go, so they stand at ease in the
// scene rather than held mid-stroke with the blade's trail hanging off it; blaster fire still in the air (held, like the
// foes who fired it) is kept out of the shots until play resumes
function calmHero(){
  player.atkT = 0; player.swing = null; player.queuedAtk = false;
  if (player.darkT > 0){ player.darkT = 0; player.darkApplied = false; if (player.darkLight) player.darkLight.intensity = 0; }
  player.meleeT = 0; player.meleeQueued = false;
  player.castT = 0; player.kickT = 0; player.stabT = 0; player.flinchT = 0; player.pivotT = 0; player.recoilKick = 0;
  if (player.palmT > 0){ player.palmT = 0; player.palm = null; player.palmQueued = false; }
  player.flaming = false; if (player.flameLight) player.flameLight.intensity = 0;
}
const showBolts = (on) => { for (const b of bolts) if (b.mesh) b.mesh.visible = on; };
// can a scene start now (none up, in play, not seen this visit)? A caller asks before it builds anyone for the set
const canStart = (key) => !C.on && G.mode === 'play' && !(key && seen.has(key));
// a scene that won't play: the figures built for it leave the field (a stand-in left behind would stand there for good,
// beside the real foe: the duel foe's double after a retry, which keeps the duel's intro marked as seen)
function discard(actors){ for (const a of actors || []){ if (a.kind) dropFigure(a); else if (a.own && a.g) scene.remove(a.g); } }
/* ---------- room to talk: nobody stands on top of the hero when a scene starts ----------
   A scene that starts as a fight ends (a duel foe breaking off, a cornered quarry) finds the hero wherever the fight left
   them, often a step from the one who is about to speak: the two bodies overlap in every close and the over-the-shoulder
   lens sits inside the hero. So before the first shot, the speaker steps back to talking distance (game/blocking.js
   roomFor: more for someone bigger, by how big they really stand) if it is a stand-in built for the scene, or, when it
   can't (a wall behind it, or it is something already on the field: the boss, the quarry), the hero does. Everyone else
   (co-op partners, the squad, foes in the way) is put on their marks after that (blocking.js blockScene). */
// a clear spot `d` from (x, z) along `yaw` (or a little either side of it) on level ground with nothing in between: null if none
function roomSpot(x, z, y, yaw, d){
  for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) for (const k of [1, 1.2]){
    const a = yaw + da, c = findClearSpawn(x + Math.sin(a) * d * k, z + Math.cos(a) * d * k, 0.6);
    if (Math.hypot(c.x - x, c.z - z) < d * 0.92 || segBlockedBySolids(x, z, c.x, c.z)) continue;
    if (Math.abs(groundAt(c.x, c.z, y + 1.5) - y) > 0.45 || sightClear(x, y + 1.5, z, c.x, y + 1.5, c.z) < 0.95) continue;
    return c;
  }
  return null;
}
function makeRoom(actors){
  for (const a of actors || []){
    if (!a || !a.g || (a.kind && !a.bound)) continue;   // (the story's cast is set apart already: castSpots)
    const pp = playerPos(), q = a.g.position, need = roomFor(sizeOf(a)), d = Math.hypot(q.x - pp.x, q.z - pp.z);
    if (d >= need) continue;
    const away = d > 0.05 ? yawTo(pp.x, pp.z, q.x, q.z) : G.yaw;   // hero → actor
    let c = a.own && !a.kind && roomSpot(pp.x, pp.z, pp.y, away, need);
    if (c){ q.set(c.x, groundAt(c.x, c.z, pp.y + 1.5), c.z); a.g.rotation.y = yawTo(c.x, c.z, pp.x, pp.z); continue; }
    c = roomSpot(q.x, q.z, pp.y, away + Math.PI, need);   // it can't move: the hero steps back from it instead
    if (c){ pp.x = c.x; pp.z = c.z; pp.y = Math.max(pp.y, groundAt(c.x, c.z, pp.y + 1.5)); }
  }
}
function start(opts){
  if (!canStart(opts.key)){ discard(opts.actors); if (!C.on) unblockScene(); return false; }
  if (opts.key) seen.add(opts.key);
  settleHero();   // (on their feet, out of whatever move the fight left them in: game/blocking.js)
  makeRoom(opts.actors);
  const pp = playerPos();
  if (opts.face === 'actor'){ const g = opts.actors[0].g.position; opts.face = [g.x, g.z]; }   // (where it stands now: makeRoom)
  // everyone else onto their marks round the hero and the speaker (co-op partners, the squad, foes in the way)
  const a0 = opts.actors && opts.actors[0], at = Array.isArray(opts.face) ? { x: opts.face[0], z: opts.face[1] } : a0 && a0.g ? a0.g.position : opts.mark ? { x: opts.mark[0] ?? opts.mark.x, z: opts.mark[1] ?? opts.mark.z } : null;
  const marks = blockScene(at, (opts.actors || []).map(a => a && a.g), opts.stage || null, !!opts.share);
  if (opts.face){ G.yaw = yawTo(pp.x, pp.z, opts.face[0], opts.face[1]); G.pitch = 0.1; }
  Object.assign(C, { on: true, key: opts.key || '', shots: opts.shots, i: 0, t: 0, actors: opts.actors || [], kept: [], keepYaw: opts.keepYaw ?? G.yaw, heroYaw: G.yaw,
                     mark: opts.mark || null, onDone: opts.onDone || null, fade: 0, ending: false, shown: null, pair: 0, one: opts.one || null, at: performance.now() });
  if (C.one) oneBegin();   // (from where the play camera is now, before anything turns the hero)
  if (C.mark && C.mark.yaw == null) C.mark.yaw = yawTo(C.mark.x, C.mark.z, pp.x, pp.z);
  G.cutscene = true;
  // THE BLADE IN A SCENE: never lit. Every scene opens with the hero's hilt on the belt and the blade out, and play gets
  // back whatever it had when the scene ends (player/holster.js sceneStow / sceneRestore). A duel's entrance: both
  // duellists wait with their hilts on the belt; the foe draws at its last beat (the shot marked `draw`), the hero starts
  // the fight with it still there, to light with 5 (player/holster.js stowForScene). The one way to keep it lit is a
  // scene that asks (opts.lit), and then the hero holds the fight's stance through it, not the at-ease stand
  C.draw = !!opts.draw; C.blade = null; G.sceneLit = false;
  if (C.draw){ stowForScene(); for (const a of C.actors) if (a.drawForm !== undefined) stowFoe(a, a.drawForm); }
  else if (opts.lit) G.sceneLit = bladeLit();
  else C.blade = sceneStow();
  player.firing = false; player.trigHeld = false; player.blockHeld = false;
  stillHero(); calmHero(); showBolts(false);
  document.body.classList.add('cutscene');
  el.classList.add('on'); el.classList.toggle('mando', isGunner()); el.classList.toggle('one', !!C.one);
  el.style.setProperty('--bars', C.one ? '0vh' : (CUT.bars * 100) + 'vh');   // (no letterbox on a scene without cuts)
  skipHint();
  holdSkip(false, true);
  voted = false; lastTally = null; showVote(null);
  if (net.role === 'host' && connected()) tally();   // (a guest may already be asking to skip what they're watching)
  if (opts.share && net.role === 'host' && connected()) send({ t: 'csp', s: opts.share, st: marks });   // (st: where the host stands and the speaker is: each guest's mark beside it)
  if (net.role === 'guest' && connected()) send({ t: 'cso', o: 1 });
  showShot();
  return true;
}
function finish(skipped){
  if (!C.on) return;
  const done = C.onDone;
  if (C.draw){ for (const a of C.actors) endFoe(a); endSceneDraw(G.mode !== 'play'); C.draw = false; }   // (the hero's hilt stays on the belt for 5)
  dropActors();
  unblockScene();
  if (C.blade){ sceneRestore(C.blade, G.mode !== 'play'); C.blade = null; }   // (lit before with a fight on: drawn and lit again as play resumes)
  G.sceneLit = false;
  C.on = false; C.onDone = null; C.one = null;
  G.cutscene = false;
  showBolts(true);
  document.body.classList.remove('cutscene');
  el.classList.remove('on', 'fade');
  setLine(null); setTitle(null); setWhere(null); setGoal(null);
  C.talker = null; $('.cs-mark').classList.remove('on');
  resetCameraRig();
  if (net.role === 'guest' && connected()) send({ t: 'cso', o: 0 });
  if (skipped && connected() && net.role === 'host') send({ t: 'csk', k: C.key });
  voted = false; lastTally = null; showVote(null);
  if (net.role === 'host'){ votes.delete(0); tally(); }   // (the host's own scene is over: it no longer has a say)
  if (done) done();
}
// a skip press: alone it ends the scene; in co-op it is this player's vote (skipping below)
export function skipScene(){
  if (!C.on) return;
  if (!connected()) return void finish(true);
  if (voted) return;
  voted = true;
  if (net.role === 'host'){ votes.add(0); tally(); }
  else send({ t: 'csv' });
  if (C.on) showVote(lastTally);
}
const padUsed = () => document.body.classList.contains('pad');
const skipHint = () => { $('.cs-sk').innerHTML = padUsed() ? '<b>A</b> next · hold <b>A</b> to skip' : '<b>SPACE</b> next · hold to skip'; };

/* ---------- the subtitle and the title ---------- */
// tone: whose colour the name wears: 'hero' (the hero's own accent), 'ally' (a friend's gold) or 'foe' (red)
function setLine(ln, comms = false, tone = 'hero'){
  const box = $('.cs-line');
  if (!ln){ box.classList.remove('on'); return; }
  box.classList.toggle('comms', comms);   // a voice in the hero's ear, not someone on set
  box.classList.toggle('ally', tone === 'ally'); box.classList.toggle('foe', tone === 'foe');
  $('.cs-who').textContent = ln[0] || '';
  $('.cs-say').textContent = ln[1] || '';
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
}
function setTitle(t){
  const box = $('.cs-title');
  if (!t){ box.classList.remove('on'); return; }
  $('.cs-k').textContent = t.k || ''; $('.cs-h').textContent = t.h || ''; $('.cs-p').textContent = t.p || '';
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
}
// the place under a scene, and the objective at its end
function setWhere(t){
  const box = $('.cs-where');
  if (!t){ box.classList.remove('on'); return; }
  box.textContent = t; box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
}
function setGoal(t){
  const box = $('.cs-goal');
  if (!t){ box.classList.remove('on'); return; }
  $('.cs-gh').textContent = t; box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
}
// the hero speaks a line of its own (not a voice in its ear, nor one of the story's cast)
const heroLine = (ln) => !!(ln && ln[0] && !Object.values(VOICE).includes(ln[0]) && !JEDI_CAST.includes(ln[0]) && !MANDO_CAST.has(ln[0]) && !castOf(ln[0]) && ln[0] !== storyVoice());
// whose side a speaker is on, by name: one of the story's cast (data/cast.js `foe`), a duel foe or the boss (a stand-in
// built from a foe type, or a foe already on the field), or anyone else who talks (a friend: the voice in the ear too)
const foeNamed = (name) => { const c = castOf(name); return c ? !!c.foe : !!TAUNTS[name]; };
function toneOf(ln, who){
  if (who === 'hero') return 'hero';
  if (who) return who.kind ? (castOf(who.name) && castOf(who.name).foe ? 'foe' : 'ally') : who.bind === 'boss' || who.bind === 'quarry' || who.own ? 'foe' : 'ally';
  if (!ln || !ln[0]) return 'hero';
  return foeNamed(ln[0]) ? 'foe' : heroLine(ln) && !castOf(ln[0]) ? 'hero' : 'ally';
}
function showShot(){
  const s = C.shots[C.i];
  // who says this shot's line: an actor on set, the hero, or nobody we can see (a voice in the ear)
  const spk = s.speaker != null ? s.speaker : (s.line && s.on === 'actor' ? 0 : -1);
  const heroTalks = !!(s.line && (s.heroSpeaks || (s.on === 'hero' && heroLine(s.line))));
  C.talker = !s.line || s.comms ? null : spk >= 0 && C.actors[spk] && C.actors[spk].g ? C.actors[spk] : heroTalks ? 'hero' : null;
  if (s.line !== C.shown){ setLine(s.line || null, !!s.comms, toneOf(s.line, C.talker)); C.shown = s.line; }
  if (s.title) setTitle(s.title); else if (C.i > 0 && C.shots[C.i - 1].title) setTitle(null);
  if (s.where !== undefined) setWhere(s.where);
  if (s.goal){ setGoal(s.goal); setLine(null); C.shown = null; C.talker = null; setWhere(null); }
  if (s.dropCast) dropCast();
  if (s.draw && C.draw && !s.drawn){ s.drawn = true; for (const a of C.actors) drawFoe(a); }   // the foe reaches for its belt (the hero's is left for the player: 5)
  if (s.pair != null) C.pair = s.pair;
  // the hero turns to someone else on set (the one watching from across the field, after the talk)
  if (s.faceYaw != null) G.yaw = C.heroYaw = s.faceYaw;
  if (s.faceActor != null){ const a = C.actors[s.faceActor], p = playerPos(); if (a && a.g){ G.yaw = C.heroYaw = yawTo(p.x, p.z, a.g.position.x, a.g.position.z); } }
  if (s.walk){ const a = C.actors[0]; if (a && a.own) (a.kind ? Object.assign(a, { walk: { x0: a.g.position.x, z0: a.g.position.z, x1: s.walk[0], z1: s.walk[1], t: s.walk[2], k: 0 } }) : walkTo(a, s.walk[0], s.walk[1], s.walk[2])); }
  // who talks: the speaker works its jaw (or nods under its helmet, or talks with its hands) while its line is up
  // (enemies/upper.js talking, game/cast.js). Everyone else on set turns to the speaker; the speaker turns to the hero.
  const speaker = s.speaker != null ? s.speaker : (s.line && s.on === 'actor' ? 0 : -1);
  const pp = playerPos();
  C.actors.forEach((a, i) => {
    if (!a.g) return;
    const talk = !!(s.line && i === speaker);
    if (a.kind){ a.talk = talk; const b = !talk && speaker >= 0 && C.actors[speaker] && C.actors[speaker].g; a.look = b ? b.position : pp; }
    else a.g.userData.talk = talk;
  });
  // the hero speaks a line of its own: the Jedi's jaw works (player/model/life.js express)
  player.talking = heroTalks;
  const mk = $('.cs-mark'), tone = C.talker ? toneOf(s.line, C.talker) : '';
  mk.classList.toggle('ally', tone === 'ally'); mk.classList.toggle('foe', tone === 'foe');
  if (C.one){ if (s.kind === 'goal') oneExit(); return; }   // (a scene without cuts frames its own way: oneLens)
  pickSide(s);
}
// what's on screen now, for the shot tools (tools/shots/cutscene.mjs)
export const shotInfo = () => { if (!C.on) return ''; const s = C.shots[C.i], A = anchor(s.on);
  const f = (v) => v ? v.x.toFixed(1) + ',' + v.y.toFixed(1) + ',' + v.z.toFixed(1) : '-';
  return C.i + ':' + (s.kind || '') + ':' + (s.line ? s.line[0] : '') + ' lens ' + f(camera.position) + ' hero ' + f(playerPos()) + ' cast ' + C.actors.map(a => (a.name || '?') + '@' + f(a.g && a.g.position)).join(' '); };

// where shot s puts the lens at ease k, on side `side` (+1, or -1 mirrored across the anchor's facing)
const onActor = (on) => on === 'actor' || typeof on === 'number';
function lensAt(s, k, side, out){
  const A = anchor(s.on), sc = onActor(s.on) ? Math.max(1, A.scale || 1) : 1;
  const ang = s.kind === 'two' ? (s.from[0] + (s.to[0] - s.from[0]) * k) + (side < 0 ? Math.PI : 0)   // (a two-shot's other side is across the pair)
                                : (s.from[0] + (s.to[0] - s.from[0]) * k) * side, d = s.from[1] + (s.to[1] - s.from[1]) * k, h = s.from[2] + (s.to[2] - s.from[2]) * k;
  if (s.eye) return out.set(A.x + Math.sin(A.yaw + ang) * d, A.eye + h, A.z + Math.cos(A.yaw + ang) * d);   // (an eye-level shot: heights from the eyes, not scaled)
  return out.set(A.x + Math.sin(A.yaw + ang) * d * sc, A.y + h * sc, A.z + Math.cos(A.yaw + ang) * d * sc);
}
// a close shot takes whichever side of its subject has the clearer view (a crate between lens and face mirrors it)
const Q = new THREE.Vector3();
// how many of the others on set stand between the lens (at shot s, side) and the two it frames
function crowded(s, side){
  lensAt(s, 0.5, side, Q);
  const p = playerPos(), b = C.actors[C.pair || 0], ends = [p, b && b.g && b.g.position].filter(Boolean);
  let n = atLens(Q);   // (a partner or a squadmate where the lens would stand)
  for (const o of [...C.actors.filter(a => a.g && a !== b).map(a => a.g.position), ...matesAround()]){
    for (const e of ends){
      const dx = e.x - Q.x, dz = e.z - Q.z, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((o.x - Q.x) * dx + (o.z - Q.z) * dz) / L2));
      if (t > 0.05 && t < 0.95 && Math.hypot(Q.x + dx * t - o.x, Q.z + dz * t - o.z) < 0.65) n++;
    }
  }
  return n;
}
function pickSide(s){
  s.side = 1;
  if (s.kind === 'two'){
    // a two-shot from whichever side of the pair nobody else on set stands in front of, with a clear view of both faces
    // (a wall or a hull behind swings it round, or in closer)
    const b = C.actors[C.pair || 0], p = playerPos();
    if (!s.base) s.base = [s.from.slice(), s.to.slice()];
    const [f0, t0] = s.base, ey = eyeOf('hero'), eb = b && b.g ? eyeOf(b) : ey;
    const view = (side) => { let v = 1; for (const k of [0, 1]){ lensAt(s, k, side, Q);
      v = Math.min(v, lensView(p.x, ey - 0.1, p.z, Q.x, Q.y, Q.z), b && b.g ? lensView(b.g.position.x, eb - 0.1, b.g.position.z, Q.x, Q.y, Q.z) : 1); } return v; };
    let best = null, bestK = -9;
    search: for (const m of [1, 0.78, 0.6]) for (const da of [0, 0.35, -0.35]) for (const side of [1, -1]){
      s.from = [f0[0] + da, f0[1] * m, f0[2]]; s.to = [t0[0] + da, t0[1] * m, t0[2]];
      const k = view(side) - crowded(s, side) * 0.5;
      if (k > bestK){ bestK = k; best = [s.from, s.to, side]; }
      if (k > 0.98) break search;
    }
    [s.from, s.to, s.side] = best;
    return;
  }
  if (s.single){
    // a single on someone in a scene on set: from beside the one listening, wherever round them has a clear view of the
    // face (a crate or a wall there swings it wider, or in closer)
    lookPoint(s.look, L);
    const sd = Math.sign(s.from[0]) || 1, h0 = s.from[2], h1 = s.to[2], d0 = s.from[1];
    const view = (k) => { lensAt(s, k, 1, Q); return lensView(L.x, L.y, L.z, Q.x, Q.y, Q.z) - 0.5 * (atLens(Q) + inWay(Q.x, Q.z, L, null)); };
    let best = null, bestK = -1;
    search: for (const d of [d0, d0 * 0.86, d0 * 0.72]) for (const a of [0.58, 0.8, 0.4, 1.05]) for (const side of [sd, -sd]){
      s.from = [a * side, d, h0]; s.to = [a * 0.82 * side, d * 0.87, h1];
      const k = Math.min(view(0), view(1));
      if (k > bestK){ bestK = k; best = [s.from, s.to]; }
      if (k > 0.98) break search;
    }
    [s.from, s.to] = best;
    return;
  }
  if (!s.mirror) return;
  lookPoint(s.look, L);
  const A = anchor(s.look.on);   // (the face, and the body under it)
  // (a partner on their mark or a squadmate between the lens and the face counts against that side too: people aren't props)
  const view = (side) => { let v = 0; for (const k of [0, 1]){ lensAt(s, k, side, Q); v += sightClear(L.x, L.y, L.z, Q.x, Q.y, Q.z) + sightClear(A.x, A.y + 0.6, A.z, Q.x, Q.y, Q.z) - 0.8 * (inWay(Q.x, Q.z, L, null) + atLens(Q)); } return v; };
  if (view(-1) > view(1) + 0.05) s.side = -1;
}

/* ---------- every frame (real time: the sim is frozen) ---------- */
let lastAt = 0;
export function updateCutscene(){
  // on the wall clock (a slow machine's capped frame time would stretch the scene out)
  const now = performance.now(), dt = Math.min(0.25, Math.max(0, (now - lastAt) / 1000));
  lastAt = now;
  if (!C.on) return;
  if (G.mode !== 'play'){ finish(false); return; }
  if (G.paused){ holdSkip(false, true); return; }   // the pause screen's own cuts take the lens until it closes
  stepHold(dt);
  if (!C.on) return;
  const s = C.shots[C.i];
  C.t += dt;
  if (C.t >= s.t){
    if (C.i + 1 >= C.shots.length){ finish(false); return; }
    C.i++; C.t = 0; showShot();
    return void updateCutscene();
  }
  for (const a of C.actors) updateActor(a, dt);
  // the hero idles (and turns to whatever the scene faced them toward) while the sim stands still
  const pp = playerPos();
  stillHero();   // (nothing else may push the hero's velocity back up while the scene plays)
  if (dt > 0) animatePlayer(dt, pp, stance(), fwd(), rightV(), false);
  if (C.draw || C.blade) syncOffSaber(player, !isGunner());   // (Jar'Kai's second hilt off the belt with the first: the sim that keeps it in step stands still)
  if (C.one){ oneLens(s, dt, now); placeMark(); return; }
  // the lens: eased from `from` to `to` around the shot's anchor, kept out of props like the play camera
  const k = ease(Math.min(1, C.t / s.t)), A = anchor(s.on), sc = onActor(s.on) ? Math.max(1, A.scale || 1) : 1;
  lensAt(s, k, s.side || 1, P);
  lookPoint(s.look, L);
  const oy = s.eye ? A.eye - 0.3 : A.y + 1.3 * sc, cl = cameraClearance(A.x, oy, A.z, P.x, P.y, P.z);
  if (cl < 1) P.set(A.x + (P.x - A.x) * cl, oy + (P.y - oy) * cl, A.z + (P.z - A.z) * cl);
  if (P.y < 0.35) P.y = 0.35;
  // a camera operator's hands: the lens breathes a little (more on a close-up, none on a locked-off shot)
  const hand = s.still ? 0 : (s.fov && s.fov < 45 ? 0.022 : 0.012), T = now / 1000;
  P.x += Math.sin(T * 0.83) * hand; P.y += Math.sin(T * 1.13 + 1) * hand * 0.7; P.z += Math.sin(T * 0.71 + 2) * hand;
  L.x += Math.sin(T * 0.57 + 3) * hand * 0.6; L.y += Math.sin(T * 0.91 + 4) * hand * 0.5;
  camera.position.copy(P);
  camera.lookAt(L);
  updatePropFade(P, L.x, L.y - 1, L.z, dt);   // a prop still between the lens and the subject turns see-through (world/camblock.js)
  const fov = s.fov || 50;
  if (Math.abs(camera.fov - fov) > 0.02){ camera.fov = fov; camera.updateProjectionMatrix(); }
  // fade in from black at the start, out at the very end
  const total = C.shots.length - 1, last = C.i === total && s.t - C.t < CUT.fadeOut;
  el.classList.toggle('fade', last);
  placeMark();
}
// who speaks, in the shot: a small mark over their head (hidden when they are out of the frame, or their head is up
// against its top edge: a close-up already says who it is)
const MK = new THREE.Vector3();
function headOf(who, out){
  const head = who === 'hero' ? player.rig && player.rig.head : who.kind === 'hero' ? who.target.rig.head : who.g.userData.head;
  if (head){ head.getWorldPosition(out); out.y += 0.42 * (who === 'hero' ? 1 : who.scale || 1); return out; }
  const p = who === 'hero' ? playerPos() : who.g.position;
  return out.set(p.x, p.y + 2.1 * (who === 'hero' ? 1 : who.scale || 1), p.z);
}
function placeMark(){
  const mk = $('.cs-mark'), who = C.talker;
  if (!who || (who !== 'hero' && (!who.g || !who.g.parent || !who.g.visible))){ mk.classList.remove('on'); return; }
  camera.updateMatrixWorld();
  headOf(who, MK).project(camera);
  const W = innerWidth, H = innerHeight, x = (MK.x * 0.5 + 0.5) * W, y = (-MK.y * 0.5 + 0.5) * H;
  const top = H * (C.one ? 0 : CUT.bars) + 26;
  const inFrame = MK.z < 1 && x > W * 0.04 && x < W * 0.96 && y > top && y < H * 0.8;
  mk.classList.toggle('on', inFrame);
  if (inFrame) mk.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
}

/* ---------- a scene without cuts (data/cutscene-stage.js `oneshot`) ---------- */
// God of War's way: the scene never cuts away. The lens leaves the play camera from wherever it is, drifts round to whoever
// speaks, rises behind the hero for the objective, and settles back exactly where the play camera wants to be, with no
// letterbox, so the fight picks up in the same shot. The lens rides an orbit round the pair (the hero and the one they
// talk to), so a swing from one face to the other arcs round them instead of through them; every move is critically
// damped (it eases off and eases in, never snaps).
// castOff: how far round from the way the hero faced the cast stands (radians: off to one side, out of the play camera's
// view once the hero turns back to the field). drift/back: seconds for the opening drift and the settle back.
// lag: how long the lens takes to catch up with each new framing (seconds; more is lazier)
const ONE = { castOff: 1.25, drift: 3.0, back: 2.0, lag: 0.85, backLag: 0.5, walk: 1.5 };
const DIR = new THREE.Vector3(), TP = new THREE.Vector3(), TL = new THREE.Vector3();
function smooth(o, k, to, st, dt){   // Unity's SmoothDamp on o[k] (its velocity in o[k + 'v'])
  const w = 2 / st, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const c = o[k] - to, tmp = ((o[k + 'v'] || 0) + w * c) * dt;
  o[k + 'v'] = ((o[k + 'v'] || 0) - w * tmp) * e;
  o[k] = to + (c + tmp) * e;
}
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function oneBegin(){
  const O = C.one, pp = playerPos(), b = C.actors[0], q = b && b.g ? b.g.position : null;
  O.px = q ? (pp.x + q.x) / 2 : pp.x; O.pz = q ? (pp.z + q.z) / 2 : pp.z; O.py = q ? Math.min(pp.y, q.y) : pp.y;
  O.Y = q ? yawTo(pp.x, pp.z, q.x, q.z) : G.yaw;
  const cp = camera.position;
  O.a = Math.atan2(cp.x - O.px, cp.z - O.pz); O.d = Math.max(1, Math.hypot(cp.x - O.px, cp.z - O.pz)); O.h = cp.y - O.py;
  camera.getWorldDirection(DIR);
  const r = Math.hypot(cp.x - O.px, cp.y - O.py - 1.5, cp.z - O.pz);
  O.lx = cp.x + DIR.x * r; O.ly = cp.y + DIR.y * r; O.lz = cp.z + DIR.z * r; O.fov = camera.fov;
}
// where the play camera will sit once the scene hands back: run its rig for a moment, read it, put the lens back
const probe = { P: new THREE.Vector3(), L: new THREE.Vector3(), fov: 60 };
function playCamera(){
  const pos = camera.position.clone(), quat = camera.quaternion.clone(), fov = camera.fov;
  G.cutscene = false; resetCameraRig();
  updateCamera(1);   // (a whole second: every lag in the rig settles on its resting spot)
  G.cutscene = true;
  probe.P.copy(camera.position); camera.getWorldDirection(DIR); probe.L.copy(camera.position).addScaledVector(DIR, 10); probe.fov = camera.fov;
  camera.position.copy(pos); camera.quaternion.copy(quat); camera.fov = fov; camera.updateProjectionMatrix();
  resetCameraRig();
  return probe;
}
// what a beat frames: the lens as [angle round the pair, distance, height] and the point it looks at
function oneTarget(s, out){
  const O = C.one, pp = playerPos(), b = C.actors[0], sd = O.sd;
  const eh = eyeOf('hero'), eb = b && b.g ? eyeOf(b) : eh, mid = (eh + eb) / 2;
  // a point k of the way from the pair's middle to someone's face (0: between them; 1: on the face)
  // (who: 'hero', or one of the cast on set)
  const at = (who, k) => { const f = who === 'hero' ? null : who && who.g ? who : b, q = f ? f.g.position : pp, y = f ? eyeOf(f) : eh;
    return TL.set(O.px + (q.x - O.px) * k, mid + (y - mid) * k, O.pz + (q.z - O.pz) * k); };
  const orbit = (a, d, h, L, fov, face = null) => { out.a = a; out.d = d; out.h = h; out.L = L; out.fov = fov; out.face = face; return out; };
  const fromWorld = (P, L, fov) => orbit(Math.atan2(P.x - O.px, P.z - O.pz), Math.hypot(P.x - O.px, P.z - O.pz), P.y - O.py, L, fov);
  if (s.kind === 'back'){ const pc = playCamera(); out.P = pc.P; return fromWorld(pc.P, pc.L, pc.fov); }
  out.P = null;
  if (s.kind === 'goal'){   // up behind the hero (on the side away from the cast), over what they face
    const a = O.goalYaw + Math.PI - 0.45 * sd;
    TP.set(pp.x + Math.sin(a) * 6.2, pp.y + 3.2, pp.z + Math.cos(a) * 6.2);
    TL.set(pp.x + Math.sin(O.goalYaw) * 12, pp.y + 1.0, pp.z + Math.cos(O.goalYaw) * 12);
    return fromWorld(TP, TL, 50);
  }
  if (!b || !b.g) return orbit(O.goalYaw + Math.PI + 0.5 * sd, 4.2, eh - O.py + 0.4, at('hero', 1), 46);   // (nobody on set)
  if (s.kind === 'drift') return orbit(O.Y + sd * 2.1, 5.6, mid - O.py + 1.0, at('hero', 0.15), 48);
  const speaker = s.speaker != null ? s.speaker : (s.line && s.on === 'actor' ? 0 : -1);
  // a line holds while the lens creeps in a little (a still lens reads as a cut you didn't notice)
  const creep = 1 - 0.08 * Math.min(1, C.t / s.t);
  const sp = speaker >= 0 && C.actors[speaker];
  if (sp && sp.g){   // over the hero's shoulder, on whoever speaks (in a group, turned toward that one)
    const Ys = yawTo(pp.x, pp.z, sp.g.position.x, sp.g.position.z);
    return orbit(Ys + sd * 2.3, 4.9 * creep, eh - O.py + 0.15, at(sp, 0.6), 44, sp);   // (aimed between them: the hero's head stays in frame)
  }
  if (s.line) return orbit(O.Y + sd * 0.9, 4.4 * creep, eh - O.py + 0.08, at('hero', 0.65), 44);   // round past them to the hero's face
  return orbit(O.Y + sd * 1.75, 4.8, mid - O.py + 0.3, at('hero', 0), 46);   // the pair
}
// which way round from a beat's angle has nothing standing between the lens and the face it frames (a squadmate, or
// another of the cast): tried once a beat, so the lens commits to it instead of hunting frame to frame
function oneClear(s, tg, face){
  if (s.oneDa != null) return s.oneDa;
  const O = C.one, sd = O.sd;
  raySkip = new Set([player.group, face && face.g].filter(Boolean));
  let best = 0, bestK = -1;
  for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9].map(v => v * sd)){
    const a = tg.a + da, x = O.px + Math.sin(a) * tg.d, y = O.py + tg.h, z = O.pz + Math.cos(a) * tg.d;
    const k = lensView(tg.L.x, tg.L.y, tg.L.z, x, y, z) - 0.5 * inWay(x, z, tg.L, face);
    if (k > bestK + 0.02){ bestK = k; best = da; }
    if (k > 0.97) break;
  }
  raySkip = null;
  return (s.oneDa = best);
}
// how many figures (squadmates, the rest of the cast) stand on the line from the lens at (x, z) to the point L it looks at
// (people aren't props: the see-through fade and the ray miss them)
function inWay(x, z, L, face){
  const dx = L.x - x, dz = L.z - z, L2 = dx * dx + dz * dz || 1;
  let n = 0;
  const test = (g) => { if (!g || !g.visible) return; const o = g.position, t = ((o.x - x) * dx + (o.z - z) * dz) / L2;
    if (t > 0.04 && t < 0.92 && Math.hypot(x + dx * t - o.x, z + dz * t - o.z) < 0.6) n++; };
  for (const a of allies) test(a.group);
  for (const a of C.actors) if (a !== face) test(a.g);
  for (const q of matesAround()) test({ position: q, visible: true });   // (a co-op partner on their mark)
  return n;
}
// how many partners or squadmates stand right where a lens would be (it would sit inside them, or their blade)
function atLens(Q){
  let n = 0;
  for (const q of matesAround()) if (Math.hypot(q.x - Q.x, q.z - Q.z) < 1.3) n++;
  for (const a of allies) if (a.group && a.group.visible && !C.actors.some(b => b.g === a.group) && Math.hypot(a.group.position.x - Q.x, a.group.position.z - Q.z) < 1.0) n++;
  return n;
}
const OT = {};
function oneLens(s, dt, now){
  const O = C.one, tg = oneTarget(s, OT), back = s.kind === 'back', st = back ? ONE.backLag : ONE.lag;
  if (!back && s.kind !== 'goal') tg.a += oneClear(s, tg, tg.face);
  smooth(O, 'a', O.a + wrapA(tg.a - O.a), st, dt); smooth(O, 'd', tg.d, st, dt); smooth(O, 'h', tg.h, st, dt);
  smooth(O, 'lx', tg.L.x, st, dt); smooth(O, 'ly', tg.L.y, st, dt); smooth(O, 'lz', tg.L.z, st, dt); smooth(O, 'fov', tg.fov, st, dt);
  P.set(O.px + Math.sin(O.a) * O.d, O.py + O.h, O.pz + Math.cos(O.a) * O.d);
  L.set(O.lx, O.ly, O.lz);
  // kept out of props, like the play camera (pulled in toward the hero's head)
  const pp = playerPos(), oy = eyeOf('hero') - 0.2, cl = cameraClearance(pp.x, oy, pp.z, P.x, P.y, P.z);
  if (cl < 1) P.set(pp.x + (P.x - pp.x) * cl, oy + (P.y - oy) * cl, pp.z + (P.z - pp.z) * cl);
  if (P.y < 0.35) P.y = 0.35;
  // the last stretch of the settle lands exactly on the play camera, so the hand back has no seam at all
  let w = 0, fov = O.fov;
  if (back && tg.P){
    w = Math.min(1, Math.max(0, (C.t - (s.t - 1.1)) / 1.0)); w = w * w * (3 - 2 * w);
    P.lerp(tg.P, w); L.lerp(tg.L, w); fov += (tg.fov - fov) * w;
  }
  const hand = 0.014 * (1 - w), T = now / 1000;   // (an operator's hands: none by the time it is the play camera again)
  P.x += Math.sin(T * 0.83) * hand; P.y += Math.sin(T * 1.13 + 1) * hand * 0.7; P.z += Math.sin(T * 0.71 + 2) * hand;
  camera.position.copy(P);
  camera.lookAt(L);
  updatePropFade(P, L.x, L.y - 1, L.z, dt);
  if (Math.abs(camera.fov - fov) > 0.02){ camera.fov = fov; camera.updateProjectionMatrix(); }
  el.classList.remove('fade');
}
// the objective: whoever is on set heads off to their own side (and a little back), out of the shot before it hands back
function oneExit(){
  const O = C.one;
  for (const a of C.actors){
    if (!a.g || !a.own || a.bound || a.holo || a.walk || a.stays) continue;   // (whoever stays on set stays at the hero's side: game/onset.js)
    const p = a.g.position;
    for (const da of [0, 0.4, -0.4, 0.8, -0.8]){
      const yaw = O.goalYaw + O.sd * 1.95 + da * O.sd, c = findClearSpawn(p.x + Math.sin(yaw) * 12, p.z + Math.cos(yaw) * 12, 0.6);
      if (segBlockedBySolids(p.x, p.z, c.x, c.z) && da !== -0.8) continue;
      const dist = Math.hypot(c.x - p.x, c.z - p.z);
      if (dist > 1) a.walk = { x0: p.x, z0: p.z, x1: c.x, z1: c.z, t: dist / ONE.walk, k: 0 };
      break;
    }
  }
}

/* ============================================================
   THE SCENES
   ============================================================ */
// where a watcher stands: ahead of the hero, in plain sight of them (nearer, or off to a side, until nothing is between)
function watchSpot(pp){
  const far = Math.min(16, shared.arenaHalf * 0.6);
  for (const d of [far, far * 0.75, far * 0.55]) for (const a of [0, 0.35, -0.35, 0.7, -0.7]){
    const yaw = G.yaw + a, c = findClearSpawn(pp.x + Math.sin(yaw) * d, pp.z + Math.cos(yaw) * d, 1.2);
    if (!segBlockedBySolids(pp.x, pp.z, c.x, c.z) && groundAt(c.x, c.z, 3.2) < 0.3 && sightClear(pp.x, pp.y + 1.5, pp.z, c.x, 1.0, c.z) > 0.97) return { ...c, yaw };
  }
  const c = findClearSpawn(pp.x + Math.sin(G.yaw) * far, pp.z + Math.cos(G.yaw) * far, 1.2);
  return { ...c, yaw: G.yaw };
}

/* ---------- a scene on set: the story's people standing there with the hero (data/cast.js, data/cutscene-stage.js) ---------- */
// where the cast stands: in front of the hero, spread across their view, on open ground in plain sight
function castSpots(n, pp, off = 0){
  const fan = n === 1 ? [0] : n === 2 ? [-0.42, 0.42] : [-0.62, 0, 0.62], d0 = n === 1 ? 2.7 : 2.9, spots = [];
  // (co-op partners and the squad stand where they are: the cast takes the ground round them, not a spot on top of one)
  const others = [...matesAround(), ...allies.filter(a => a.group && a.state !== 'down').map(a => a.group.position)];
  for (const a0 of fan){
    let pick = null;
    for (const d of [d0, d0 * 1.2, d0 * 0.85, d0 * 1.45]) for (const da of [0, 0.22, -0.22, 0.45, -0.45]){
      if (pick) break;
      const yaw = G.yaw + off + a0 + da, c = findClearSpawn(pp.x + Math.sin(yaw) * d, pp.z + Math.cos(yaw) * d, 0.6);
      if (Math.hypot(c.x - pp.x, c.z - pp.z) < 1.8 || spots.some(q => Math.hypot(q.x - c.x, q.z - c.z) < 1.1)) continue;
      if (others.some(q => Math.hypot(q.x - c.x, q.z - c.z) < 1.3)) continue;   // (not on a partner, nor a squadmate)
      if (segBlockedBySolids(pp.x, pp.z, c.x, c.z) || Math.abs(groundAt(c.x, c.z, pp.y + 1.5) - pp.y) > 0.45) continue;
      if (sightClear(pp.x, pp.y + 1.5, pp.z, c.x, pp.y + 1.5, c.z) < 0.95) continue;
      pick = c;
    }
    if (!pick){ const yaw = G.yaw + off + a0; pick = findClearSpawn(pp.x + Math.sin(yaw) * d0, pp.z + Math.cos(yaw) * d0, 0.6); spots.miss = (spots.miss || 0) + 1; }
    spots.push(pick);
  }
  return spots;
}
// how each speaker in the lines is staged: 'hero' (the hero's own line), a figure on set ('on' / 'holo'), or 'off' (comms)
function castPlan(lines, stage, inTalk, skip){
  const voice = storyVoice(), plan = new Map();
  for (const [who] of lines){
    if (!who || plan.has(who)) continue;
    if (who === 'YOU' || heroLine([who])) plan.set(who, 'hero');
    else if (who === skip || !castOf(who) || (stage.off || []).includes(who)) plan.set(who, 'off');
    else if ((stage.holo || []).includes(who)) plan.set(who, 'holo');
    // the story's voice is in the hero's ear, unless the scene before the fight has them there in person
    else if (who === voice && !inTalk.has(who) && !(stage.on || []).includes(who)) plan.set(who, 'off');
    else plan.set(who, 'on');
  }
  let n = 0;
  for (const [who, how] of plan) if ((how === 'on' || how === 'holo') && ++n > 3) plan.set(who, 'off');   // three on set at most
  return plan;
}
// a close on a figure, from beside the hero (side: which side), and its reverse, on the hero from beside the figure. (Not
// over the shoulder: the hero's guard puts an arm in the frame, and a wall behind them pushes the lens into their back.)
const overHero = (i, ln, side, t) => shot(i, [0.58 * side, 2.7, 0.04], [0.47 * side, 2.35, 0.02], t, { on: i, h: -0.12, eye: true }, { line: ln, speaker: i, fov: 38, kind: 'close', single: true, eye: true });
const onHero = (ln, side, t, speaks) => shot('hero', [-0.6 * side, 2.75, -0.04], [-0.5 * side, 2.4, -0.06], t, { on: 'hero', h: -0.14, eye: true }, { line: ln, heroSpeaks: speaks, fov: 38, kind: 'reverse', single: true, eye: true });
// the two of them side by side, from across the line between them
const twoShot = (i, ln, t, extra = {}) => shot('pair', [-0.15, 6.2, -0.1], [0.12, 5.4, -0.2], t, { on: 'pair', h: -0.45, eye: true }, { eye: true, mirror: true, line: ln, speaker: ln ? i : -1, pair: i, fov: 42, kind: 'two', ...extra });
// the lines, shot by shot: on set, each speaker gets its close (now and then the pair, for air); the hero's lines play on
// the hero; anyone off set is a voice in the hero's ear, on the hero listening
function setShots(lines, plan, who2i, sideOf, where){
  const shots = [], main = who2i.size ? who2i.values().next().value : 0;
  lines.forEach((ln, k) => {
    const how = plan.get(ln[0]) || 'off', t = lineTime(ln), first = k === 0 && where !== undefined;
    let sh;
    if (how === 'on' || how === 'holo'){
      const i = who2i.get(ln[0]);
      sh = (k === 0 || k % 4 === 3) ? twoShot(i, ln, t + (k === 0 ? 0.6 : 0)) : overHero(i, ln, sideOf(i), t);
    } else if (k === 0 && who2i.size){ sh = twoShot(main, ln, t + 0.6, { speaker: -1, heroSpeaks: how === 'hero', comms: how !== 'hero' }); }
    else if (how === 'hero') sh = who2i.size ? onHero(ln, sideOf(main), t, true) : heroLines([ln])[0];
    else { sh = who2i.size ? onHero(ln, sideOf(main), t, false) : heroLines([ln])[0]; sh.comms = true; sh.kind = 'comms'; }
    if (first) sh.where = where;
    shots.push(sh);
  });
  return shots;
}
// the end of a chapter's opening: the lens rises behind the hero and looks out over the field, and the objective comes up
// (from wherever behind the hero has a clear line: a shop wall or a crate stack behind them swings the lens round, or in)
// where the goal shot's lens comes down to: never under the head of a hero standing at ease, or a close one crops it
const goalLow = (d) => Math.max(2.45, d * 0.36);
function goalShot(goal, yaw){
  const pp = playerPos();
  const clear = (a, d, h) => lensView(pp.x, pp.y + 1.5, pp.z, pp.x + Math.sin(yaw + a) * d, pp.y + h, pp.z + Math.cos(yaw + a) * d);
  let best = null, bestK = -1;
  search: for (const d of [7.2, 5.6, 4.4]) for (const a of [0.55, -0.55, 0.3, -0.3, 0.85, -0.85, 0]){
    const k = Math.min(clear(Math.PI + a, d, d * 0.5), clear(Math.PI + a * 0.25, d * 0.74, goalLow(d)), clear(Math.PI + a * 0.6, d * 0.87, (d * 0.5 + goalLow(d)) / 2));
    if (k > bestK){ bestK = k; best = [a, d]; }
    if (k > 0.98) break search;
  }
  const [a, d] = best;
  return shot('hero', [Math.PI + a, d, d * 0.5], [Math.PI + a * 0.25, d * 0.74, goalLow(d)], Math.max(3.6, goal.length / CUT.readRate + 1.6),
    { on: 'hero', ahead: 12, h: 1.0 }, { goal, dropCast: true, kind: 'goal', faceYaw: yaw });
}

// the chapter the run is on, as its story tells it (its talk, its opening, its stage)
function chapterNow(id){
  const c = G.chapter >= 0 && chapterOrder(G.actTwo)[G.chapter];
  return c && c.id === id ? c : null;
}

// a chapter's opening (game/campaign.js, when its card closes): the place and the chapter's title, then the scene before
// the fight played on set (the chapter's `talk`: the people in it stand there with the hero, or call in as holograms),
// the chapter's own opening lines, and last the objective, over the field. Sets G.talkStaged to the chapter's id when its
// talk played here (the card's own retelling of it then stays quiet: game/campaign.js).
// own: a story's own opening for the chapter (its `opening`: plain lines, whoever is playing)
const everyHero = (v) => ({ jedi: v, mando: v });
export function playOpening(id, title, own){
  if (!C.on) G.talkStaged = null;   // (set again below if this chapter's talk plays here)
  const c = chapterNow(id);
  // (the shared openings are the Jedi's and the Mando's words: a story of the trooper's own doesn't borrow them, bar its prologue's)
  const o = own ? { ...everyHero(own.lines), rival: own.rival && { ...everyHero(own.rival), line: own.rival.line }, quarry: own.quarry }
                : (c && c.story === 'trooper' && !OPENINGS[id]?.trooper && id !== 'order') ? null : OPENINGS[id];
  const stage = (c && STAGE[c.story || ''] && STAGE[c.story][id]) || {};
  const talk = c && c.talk && Array.isArray(c.talk.lines) ? c.talk.lines.filter(l => Array.isArray(l) && l[1]) : [];
  if ((!o && !talk.length && !stage.goal) || C.on || G.mode !== 'play' || seen.has('open:' + id)) return false;
  prepScene(null);   // (the hero on their feet, and off a partner they stand on top of, before the cast is placed round them)
  let lines = ((o && pick(o)) || []).slice();
  const shots = [wide(3.4, title)], actors = [], later = [];
  const pp = playerPos();
  let face = null, quarryName = null;
  // someone already in the chapter's way: the chase's quarry up ahead, or a rival watching from across the field. Their
  // shots come after the talk (the hero turns to them then); they are actor 0, the cast after them
  if (o && o.quarry){
    const q = boundActor('quarry');
    if (q){
      actors.push(q);
      const g = q.g.position; face = [g.x, g.z];
      quarryName = lines[0] && lines[0][0];
      const ov = overShoulder(2.2); ov.faceActor = 0;
      later.push(ov, ...actorLines(lines.slice(0, 1)));
      lines = lines.slice(1);
    }
  } else if (o && o.rival){   // it walks into view, says its piece, and stays to watch
    const r = pick(o.rival), spot = watchSpot(pp), side = { x: Math.cos(spot.yaw), z: -Math.sin(spot.yaw) };
    face = [spot.x, spot.z];
    const a = makeActor(r, spot.x - side.x * 3.2, spot.z - side.z * 3.2, 0);
    actors.push(a);
    const ov = overShoulder(2.6); ov.walk = [spot.x, spot.z, 2.4]; ov.faceActor = 0;
    later.push(ov, ...actorLines([pick(o.rival.line)], r.name));
  }
  // the scene on set: the talk, then the opening's own lines, with whoever is in them standing there (the opening's lines
  // after the one watching has had its say)
  const all = [...talk, ...lines], inTalk = new Set(talk.map(l => l[0]));
  const plan = castPlan(all, stage, inTalk, quarryName);
  const cast = [...plan].filter(([, how]) => how === 'on' || how === 'holo').map(([who, how]) => ({ who, holo: how === 'holo' }));
  const who2i = new Map();
  let castFace = null;
  // a scene without cuts (data/cutscene-stage.js `oneshot`; for now only where nobody is already on the field): the cast
  // stands off to one side, so the hero turns to them to talk and back to the field for the objective
  let one = stage.oneshot && !actors.length ? { sd: 1, goalYaw: G.yaw } : null;
  if (cast.length){
    let spots = castSpots(cast.length, pp, one ? ONE.castOff : 0);
    if (one && spots.miss){ const alt = castSpots(cast.length, pp, -ONE.castOff); if ((alt.miss || 0) < spots.miss){ spots = alt; one.sd = -1; } }
    const base = actors.length;
    cast.forEach((m, k) => {
      const sp = spots[k], F = makeFigure(m.who, sp.x, sp.z, yawTo(sp.x, sp.z, pp.x, pp.z), { holo: m.holo });
      if (!F){ plan.set(m.who, 'off'); return; }
      F.stays = !m.holo && F.own && !!castOf(m.who).stays && stage.stay !== false;   // (they stay on the field after: game/onset.js)
      F.look = pp;
      who2i.set(m.who, actors.length);
      actors.push(F);
    });
    if (who2i.size){ const g = actors[base].g.position; castFace = [g.x, g.z]; }
  }
  // the hero faces whoever they talk to first; which side of them a close is shot from: the side the figure stands on
  const first = castFace || face;
  const heroYaw = first ? yawTo(pp.x, pp.z, first[0], first[1]) : G.yaw;
  const sideOf = (i) => { const a = actors[i]; if (!a || !a.g) return 1; const r = Math.sin(yawTo(pp.x, pp.z, a.g.position.x, a.g.position.z) - heroYaw); return r >= 0 ? -1 : 1; };
  const where = talk.length ? (stage.where !== undefined ? stage.where : (c.talk.where || null)) : undefined;
  shots.push(...setShots(talk, plan, who2i, sideOf, where), ...later, ...setShots(lines, plan, who2i, sideOf));
  if (later.length && castFace && lines.length){ const k = shots.length - lines.length; shots[k].faceActor = who2i.values().next().value; }   // (back to the cast for the rest)
  const endYaw = face ? yawTo(pp.x, pp.z, face[0], face[1]) : heroYaw;
  // ...but only when it is the hero and the people talking: squadmates crowding round would keep stepping in front of the
  // faces of an unbroken shot, so with a squad about it plays with its cuts (a squadmate who is one of the cast is fine)
  if (one){ const own = new Set(actors.map(a => a.g)); if (allies.some(a => a.group && !own.has(a.group) && Math.hypot(a.group.position.x - pp.x, a.group.position.z - pp.z) < 10)) one = null; }
  C.building = actors.map(a => a.g);   // (the cast on set doesn't block the objective's view: rayClear)
  if (one){
    // no wide shot and no cut to the objective: the title comes up as the lens drifts off the play camera, the objective
    // as it rises behind the hero, and last it settles back where the play camera sits (oneLens)
    const beat = (t, extra) => shot('hero', [0, 1, 1], [0, 1, 1], t, { on: 'hero', h: 1 }, extra);
    shots[0] = beat(ONE.drift, { title, kind: 'drift' });
    shots.push(beat(stage.goal ? Math.max(3.6, stage.goal.length / CUT.readRate + 1.6) : 1.8, { goal: stage.goal || undefined, kind: 'goal', faceYaw: one.goalYaw }),
               beat(ONE.back, { kind: 'back' }));
  } else shots.push(stage.goal ? goalShot(stage.goal, endYaw) : settle());
  C.building = null;
  const ok = start({ key: 'open:' + id, shots, actors, face: first, one, keepYaw: endYaw });   // (if it can't, start drops the cast it was given)
  if (ok && talk.length) G.talkStaged = id;
  return ok;
}

// a mission duel's entrance (game/mission.js, before its foe steps in). spec: { mid, foe, name, kicker, tint, scale,
// at: [x, z], line, quarry } as the host's hero sees the foe. Returns false when no scene plays (seen, or one is up).
// stage: on a guest, the host's marks for this scene (game/blocking.js)
export function playDuelIntro(spec, share = true, stage = null){
  if (!canStart('duel:' + spec.mid)) return false;   // (a retry: seen already, so no stand-in is built for it)
  prepScene(stage);   // (the hero on their feet, a guest on its mark beside the host, before anyone is placed round them)
  const jedi = G.chapter >= 0 && storyHero() === 'jedi' && JEDI_DUELS[spec.mid];   // (the Jedi's story has its own words for some)
  const lines = ((jedi && storyWords(jedi)) || (DUELS[spec.mid] && pick(DUELS[spec.mid])) || (spec.line ? [[null, spec.line]] : [])).slice();
  const actors = [];
  let at = spec.at;
  if (spec.quarry){
    const q = boundActor('quarry');
    if (!q) return false;
    q.scale = spec.scale || 1; actors.push(q); at = [q.g.position.x, q.g.position.z];
  } else {
    const pp = playerPos();
    // it walks up to its mark, where the real foe steps in after: a hero left standing on that mark by the fight before
    // steps back off it to talking distance (more from a bigger foe: game/blocking.js roomFor), so the two don't end up
    // inside each other
    const a = makeActor(spec, at[0], at[1], 0), need = roomFor(sizeOf(a));
    if (Math.hypot(at[0] - pp.x, at[1] - pp.z) < need){
      const c = roomSpot(at[0], at[1], pp.y, Math.hypot(at[0] - pp.x, at[1] - pp.z) > 0.05 ? yawTo(at[0], at[1], pp.x, pp.z) : G.yaw + Math.PI, need);
      if (c){ pp.x = c.x; pp.z = c.z; pp.y = Math.max(pp.y, groundAt(c.x, c.z, pp.y + 1.5)); }
    }
    const away = Math.atan2(at[0] - pp.x, at[1] - pp.z);
    const from = findClearSpawn(at[0] + Math.sin(away) * 5, at[1] + Math.cos(away) * 5, 1.0);
    a.g.position.set(from.x, groundAt(from.x, from.z, 3.2), from.z); a.g.rotation.y = away + Math.PI;
    actors.push(a);
  }
  const ov = overShoulder(spec.quarry ? 1.8 : 1.3);
  if (!spec.quarry) ov.walk = [at[0], at[1], 2.4];
  // it comes on: low and in front of it, the lens backing off as it walks up (the quarry is already standing: none)
  const track = !spec.quarry && shot('actor', [0.75, 4.6, 0.45], [0.45, 3.5, 0.75], 1.3, { on: 'actor', h: 1.45 }, { fov: 44, mirror: true, kind: 'walk' });
  const foeLines = [], rest = [];
  for (const ln of lines) (ln[0] ? rest : foeLines).push(ln);
  const close = actorLines(foeLines.length ? foeLines : [[spec.name, '']], spec.name);
  close[0].title = { k: spec.kicker || 'DUEL', h: spec.name };
  if (!foeLines.length){ close[0].line = null; close[0].t = 2.2; }
  // the hero squares up to it: a beat on their face, low, before the fight (unless they have a line of their own)
  const ready = rest.length ? [] : [shot('hero', [0.5, 2.9, 0.0], [0.38, 2.5, -0.05], 1.2, { on: 'hero', h: -0.12, eye: true }, { eye: true, fov: 40, mirror: true, kind: 'ready' })];
  // a saber wielder: both start with the hilt on the belt, and it draws at the end (game/duel-draw.js)
  const foe = actors[0], blade = !!(foe && foe.g && foe.g.userData.saber && (spec.quarry || (ENEMY_TYPES[spec.foe] || {}).weapon === 'saber'));
  if (blade) foe.drawForm = namedForm({ name: spec.name, form: spec.form }, spec.foe || 'acolyte').form;
  const shots = [ov, ...(track ? [track] : []), ...close, ...heroLines(rest), ...ready, ...(blade ? [drawShot()] : []), settle({ on: 'actor', h: 1.2 })];
  return start({ key: 'duel:' + spec.mid, shots, actors, face: at, draw: blade, share: share ? { k: 'duel', spec } : null, stage });
}

// the campaign's last boss arrives (game/flow.js): framed low and wide, his line, the voice's answer
export function playBossIntro(share = true, stage = null){
  const b = canStart('boss:' + G.chapter) && boundActor('boss');
  if (!b) return false;
  prepScene(stage);
  b.scale = 1.4;
  const own = G.chapter >= 0 && { mando: MANDO_BOSS, jedi: storyWords(JEDI_BOSS) }[storyHero()];
  const lines = (own || pick(BOSS)).slice(),   // (a story's own: data/campaign-mando.js, data/campaign-jedi.js)
        [name, epithet] = (isGunner() ? BOSS_MANDO.name : BOSS_CFG.name).split(' — ');
  const first = shot('actor', [0.6, 5, 0.9], [0.4, 4.4, 1.3], lineTime(lines[0]), { on: 'actor', h: 2.2 },
                     { line: lines[0], title: { k: 'EXEGOL', h: name, p: epithet || '' }, mirror: true });
  const g = b.g.position;
  // Darth Vexis's blade is out while he talks, and lights at the end (the Iron Magistrate's war-spear has no hilt to draw)
  const blade = !isGunner() && !!b.g.userData.hand;
  if (blade) b.drawForm = (BOSS_FORM.sith || {}).form;
  const shots = [overShoulder(1.8), first, ...heroLines(lines.slice(1)), ...(blade ? [drawShot(1.75, 1.35)] : []), settle({ on: 'actor', h: 1.8 })];
  return start({ key: 'boss:' + G.chapter, shots, actors: [b], face: [g.x, g.z], draw: blade, share: share ? { k: 'boss' } : null, stage });
}

// any other scene by id (data/cutscenes.js SCENES): opts.mark [x, z] for a 'mark' scene, opts.onDone, opts.key (once a visit)
export function playScene(id, opts = {}){
  const d = SCENES[id];
  if (!d || !canStart(opts.key)) return false;
  prepScene(opts.stage || null);   // (the hero on their feet, a guest on its mark beside the host)
  const lines = (opts.lines || pick(d) || []).slice(), actors = [];   // (opts.lines: a story's own words for the scene)
  let shots;
  if (d.shots === 'mark' && opts.mark){
    const [mx, mz] = opts.mark;
    if (d.actor){ const r = pick(d.actor), pp = playerPos(); actors.push(makeActor(r, mx, mz, yawTo(mx, mz, pp.x, pp.z))); }
    shots = actors.length ? [overShoulder(1.6), ...actorLines(lines.slice(0, 1)), ...heroLines(lines.slice(1)), settle()]
                          : [shot('mark', [0.6, 6, 2.2], [0.4, 5, 2.0], 2.4, { on: 'mark', h: 1.0 }), ...heroLines(lines), settle()];
  } else shots = [...heroLines(lines), settle()];
  return start({ key: opts.key, shots, actors, face: actors.length ? 'actor' : opts.mark, mark: opts.mark ? { x: opts.mark[0], z: opts.mark[1] } : null,
                 onDone: opts.onDone, share: opts.share === false ? null : { k: 'scene', id, mark: opts.mark || null }, stage: opts.stage || null });
}

/* ---------- skipping ---------- */
// One key does both: a TAP of Space (or Enter, or a pad's A) moves on to the next line; HOLDING it for SKIP_HOLD seconds
// (the ring fills) skips the whole scene. A pad's MENU skips at once. A press let go after TAP_MAX seconds was the start
// of a hold that changed its mind: it does nothing. Space and A are jump too, so taps in the scene's first FIRST_GUARD
// seconds don't count (mashing jump as a fight ends shouldn't eat the first line), and a press that began before the
// scene did is never read. Esc doesn't skip: it pauses, and the scene waits under the pause screen.
// In co-op a tap only moves this player's own copy of the scene on; the hold is the skip vote (skipping below).
const SKIP_HOLD = 0.7, TAP_MAX = 0.3, FIRST_GUARD = 0.35, RING = 2 * Math.PI * 8;
const hold = { on: false, at: 0, t: 0 };   // t: the ring's fill (0..1), which drains back when the key is let go early
// (both timed on the wall clock, not by frames: a slow frame can't stretch a hold or turn a tap into one)
const since = (at) => (performance.now() - at) / 1000;
// on: the key (or A) is down. quiet: let go without counting it as a tap (a pause, a new scene)
export function holdSkip(on, quiet){
  if (!C.on){ hold.on = false; hold.t = 0; return; }
  if (on && !hold.on){ hold.at = performance.now(); hold.t = 0; }
  if (!on && hold.on && !quiet){
    const held = since(hold.at);
    if (held >= SKIP_HOLD){ hold.on = false; hold.t = 0; el.classList.remove('holding'); skipScene(); return; }   // (held long enough between two frames)
    if (held < TAP_MAX && since(C.at) >= FIRST_GUARD) nextLine();
  }
  hold.on = !!on;
  if (!hold.on) el.classList.remove('holding');
}
function stepHold(dt){
  if (!hold.on){ hold.t = Math.max(0, hold.t - dt * 3 / SKIP_HOLD); }
  else {
    const held = since(hold.at);
    hold.t = Math.min(1, held / SKIP_HOLD);
    if (held >= TAP_MAX * 0.5) el.classList.add('holding');   // (a tap never flashes the ring)
    if (held >= SKIP_HOLD){ hold.on = false; hold.t = 0; el.classList.remove('holding'); skipScene(); return; }
  }
  $('.cs-ring .fg').style.strokeDashoffset = (RING * (1 - hold.t)).toFixed(2);
}
// a tap: on to the next beat (the next shot with a different line, a title or the objective). The shots in between still
// play their cues (who stands where, who the hero faces, the cast leaving), just without their time on screen.
// Past the last beat the scene ends as if it had played out (not a skip: in co-op nobody else's copy is cut short).
export function nextLine(){
  if (!C.on) return;
  const cur = C.shots[C.i];
  let j = C.i + 1;
  while (j < C.shots.length && cur.line && C.shots[j].line === cur.line && !C.shots[j].title && !C.shots[j].goal) j++;
  if (j >= C.shots.length){ finish(false); return; }
  while (C.i < j){ C.i++; C.t = 0; showShot(); }
}
window.addEventListener('keydown', (e) => {
  if (!C.on || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault(); e.stopPropagation();
  if (e.repeat) return;
  holdSkip(true);
}, true);
window.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') holdSkip(false); }, true);   // (the key's own release still reaches the game)

/* ---------- co-op: the host's scenes play for the guest too; either side's skip ends both; foes hold while either watches ---------- */
on('csp', (m) => {
  if (net.role !== 'guest' || !m.s || C.on || G.cardUp || G.mode !== 'play') return;
  const s = m.s;
  // (st: where the host's hero stands and the speaker is, after the host gave them room: this guest takes its mark beside
  // the host, and a foe breaking off stands where the host's copy of it does: game/blocking.js)
  const st = m.st && Array.isArray(m.st.lead) && Array.isArray(m.st.at) ? m.st : null;
  if (s.k === 'duel'){ playDuelIntro(s.spec, false, st); meetNamed(s.spec.name, s.spec.foe, s.spec.mid); }   // (the guest's codex: game/codex.js)
  else if (s.k === 'boss') setTimeout(() => playBossIntro(false, st), 120);   // (the boss's puppet lands with the host's next snapshot)
  else if (s.k === 'scene') playScene(s.id, { mark: st && s.mark && SCENES[s.id] && SCENES[s.id].actor ? st.at : s.mark, share: false, stage: st });
});
on('csk', (m) => { if (C.on && (!m.k || m.k === C.key)) finish(false); });
const watching = new Set();   // the guests whose cutscene is playing
on('cso', (m) => {
  if (net.role !== 'host') return;
  if (m.o) watching.add(m.from); else { watching.delete(m.from); votes.delete(m.from); }
  coopRun.guestScene = watching.size > 0;
  tally();
});
on('closed', (slot) => {
  if (slot < 0){ watching.clear(); votes.clear(); } else { watching.delete(slot); votes.delete(slot); }
  coopRun.guestScene = watching.size > 0;
  if (net.role === 'host') tally();
});
on('status', (n) => {
  if (n.status === 'connected') return;
  watching.clear(); votes.clear(); coopRun.guestScene = false;
  voted = false; lastTally = null; showVote(null);   // alone again: the next press just skips
});

/* ---------- co-op: SKIP VOTES — a scene ends only when every player watching it has pressed skip ----------
   The host keeps the count: its own vote (seat 0) while its scene plays, and each watching guest's (csv). Whenever it
   changes, every player is told who has voted (csvs), so the others see "<NAME> WANTS TO SKIP" and can agree. When
   the last one votes, the host ends the scene for everybody (csk with no key: whatever each of them is watching). */
let voted = false, lastTally = null;   // this player's vote · the last count heard
const votes = new Set();               // host: the seats that pressed skip
const voters = () => { const v = new Set(watching); if (C.on) v.add(0); return v; };
function tally(){
  if (net.role !== 'host') return;
  const v = voters();
  for (const s of [...votes]) if (!v.has(s)) votes.delete(s);
  if (!v.size){ votes.clear(); lastTally = null; return; }
  if (votes.size && votes.size >= v.size){   // everyone watching wants out
    votes.clear(); lastTally = null;
    send({ t: 'csk' });
    if (C.on) finish(false);
    return;
  }
  lastTally = { who: [...votes], of: v.size };
  if (connected()) send({ t: 'csvs', who: lastTally.who, of: lastTally.of });
  if (C.on) showVote(lastTally);
}
on('csv', (m) => { if (net.role !== 'host' || m.from == null) return; if (!watching.has(m.from) && !C.on) return; votes.add(m.from); tally(); });
on('csvs', (m) => {
  if (net.role !== 'guest' || !Array.isArray(m.who)) return;
  lastTally = { who: m.who.filter(s => Number.isInteger(s)).slice(0, 4), of: Math.max(1, Math.min(4, m.of | 0)) };
  if (C.on) showVote(lastTally);
});
// the line under the skip hint: who has asked to skip, and what this player can do about it
function showVote(t){
  const box = $('.cs-vote');
  const others = t ? t.who.filter(s => s !== net.slot) : [];
  if (!C.on || (!voted && !others.length)){ box.classList.remove('on'); el.classList.remove('voted'); box.textContent = ''; if (C.on) skipHint(); return; }
  const n = (voted ? 1 : 0) + others.length, of = Math.max(n, t ? t.of : 2);
  let html;
  if (voted) html = 'WAITING FOR ' + (of - n === 1 && of === 2 ? 'YOUR PARTNER' : (of - n) + ' MORE') + ' · <span>' + n + ' / ' + of + '</span>';
  else html = (others.length === 1 ? esc(nameOf(others[0])) + ' WANTS' : others.length + ' PLAYERS WANT') + ' TO SKIP · <span>' + n + ' / ' + of + '</span>';
  box.innerHTML = html;
  box.classList.add('on');
  el.classList.toggle('voted', voted);
  $('.cs-sk').innerHTML = voted ? 'skip asked' : padUsed() ? 'hold <b>A</b> to agree' : 'hold <b>SPACE</b> to agree';
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
