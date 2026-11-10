// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HUB: walk its wings (data/hub.js), tap F at a station to open it (ui/hub-ui.js), walk through a great door and the
// wing beyond loads in its place. No foes, no waves, no run: it is where every run starts and where it comes back to.
// Each hero has a hub of their own (data/hub.js HERO_HUB): the Jedi the hidden temple on Tython, the ARC trooper the
// clone citadel on Kamino. G.hubId is the one you're in, G.hubWing the wing of it.
//
// CO-OP: the hub is the party's lobby, and it is the HOST's hero's hub for everyone (hubIdFor). Everyone in the room can be in it, each in whichever wing they like (you see
// the others in the wing you share: player/players.js worldKey). When the HOST launches a mode, every guest standing in
// the temple follows them into it (net/foes.js tells the guests the host's run is on); when the host comes back to the
// temple, the guests who came along come back with them ('hubcall').

import { shared, G, player } from '../state.js';
import { CFG } from '../data/config.js';
import { ZONES, ZONE_PREFIX } from '../data/zones.js';
import { HUB, HUBS, hubOf, doorSide, SIDE_OUT } from '../data/hub.js';
import { startLevel } from './flow.js';
import { carryStoryKit } from './carry.js';
import { playerPos, fwd } from '../player/helpers.js';
import { findClearSpawn } from '../world/collision.js';
import { loadInto } from '../ui/loading.js';
import { showBanner } from '../ui/banners.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { net, on, send, connected } from '../net/session.js';
import { coopRun } from '../net/run.js';
import { onRunChange } from '../net/foes.js';
import { missionTitle } from './mission.js';
import { S } from '../audio/sfx.js';
import { hostHero } from '../net/partner.js';
import { setHubInteract, INTERACT_KEY } from './interact.js';
import { stepTempleFolk } from '../world/arenas/tython-folk.js';
import { welcomeArrive, updateWelcome } from './hub-welcome.js';
import { SHIP_WING, shipOf } from '../data/hero-ships.js';
import { partnerWorlds } from '../net/partner.js';

let arrivedAt = 0, near = null, shownKey = '', moving = false, followT = 0;
const prompt = () => document.getElementById('hubp');
// the hub to be in: your own hero's, or in a party the host's (a guest who hasn't heard the host's hero yet uses their own)
export const hubIdFor = () => hubOf(net.role === 'guest' && connected() ? hostHero() || G.hero : G.hero);
export const curHub = () => HUBS[G.hubId] || HUBS.temple;
export const hubWing = () => { const H = curHub(); return H.wings[G.hubWing] || H.wings[H.start]; };

// THE SPOT YOU LEFT: a station page that goes by way of the title screen (the forge's benches, the customizer, the mission
// list, EVERY MODE, MAIN MENU) lets the hub go while it's up. Coming back from it with no run played in between puts you
// back exactly where you stood, facing the way you faced, not at the wing's door: only a place you pick (a wing on the
// map, a door, the ship, a run) moves you. ui/menus.js keeps the spot as the hub is left and forgets it when a run begins.
let kept = null;
export function keepHubSpot(){
  if (!G.hub || G.mode !== 'play') return;
  const p = playerPos();
  kept = { hubId: G.hubId, wing: G.hubWing, x: p.x, y: p.y, z: p.z, yaw: G.yaw, face: player.faceYaw, pitch: G.pitch };
}
export function forgetHubSpot(){ kept = null; }

/* into the hub: `wing` (its start by default), arriving through the door from `from` when walking between wings */
export function startHub(wing, from){
  const was = G.hub;
  G.partyRun = false;   // (a guest back in the temple: the next run it follows sets it again)
  const hubId = hubIdFor();
  if (hubId !== G.hubId){ from = null; if (net.role === 'guest' && connected() && hostAboard()) wing = SHIP_WING; }   // (a different hub from the last: no door back to arrive through; a guest joining a host aboard their ship boards it too)
  G.hubId = hubId;
  const Hb = curHub();
  G.hubWing = Hb.wings[wing] ? wing : Hb.start;
  const W = hubWing();
  const back = !from && kept && kept.hubId === hubId && kept.wing === G.hubWing ? kept : null;   // (back from a menu: the spot you left)
  kept = null;
  startLevel(0, { level: W.level, hub: true });
  carryStoryKit();   // the forms, powers and guns this hero's story has earned, in hand here too (game/carry.js)
  G.waveTotal = 0;
  let [x, z, yaw] = W.spawn;
  const side = from && doorSide(Hb.wings, G.hubWing, from);
  const outAt = from === SHIP_WING && !side && shipOf(hubId).exit === G.hubWing && shipOf(hubId).outAt;   // (down the ship's ramp: at the foot of it)
  if (outAt) [x, z, yaw] = outAt;
  else if (side){
    const [ox, oz] = SIDE_OUT[side], H = shared.arenaHalf;
    x = ox * (H - HUB.arrive); z = oz * (H - HUB.arrive); yaw = Math.atan2(-ox, -oz);
  }
  if (back){ playerPos().set(back.x, back.y, back.z); G.yaw = back.yaw; player.faceYaw = back.face; G.pitch = back.pitch; }
  else {
    // a co-op party spreads out side by side, each in their seat
    const seat = net.status === 'connected' ? net.slot : 0;
    if (seat){ const rx = -Math.cos(yaw), rz = Math.sin(yaw), o = (seat % 2 ? 1 : -1) * Math.ceil(seat / 2) * 2.6; x += rx * o; z += rz * o; }
    const s = findClearSpawn(x, z, CFG.player.radius + 0.8);
    playerPos().set(s.x, 0, s.z); G.yaw = player.faceYaw = yaw; G.pitch = 0.08;
  }
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
  arrivedAt = performance.now(); moving = false; near = null; shownKey = '';
  // the host coming back into the temple from a run calls the party back with them
  if (!was && net.role === 'host' && connected()) send({ t: 'hubcall' });
  welcomeArrive();   // a first visit to this hub: its welcome card is on its way; a tour under way picks up here (game/hub-welcome.js)
}

/* walk through a door (or take the fast travel) to another wing: it loads behind the loading screen, in place of this one */
export async function goWing(to, viaDoor){
  if (!G.hub || moving || !HUBS[hubIdFor()].wings[to]) return;
  moving = true; kept = null;   // (a place picked: its own arrival, never a spot left before)
  const from = viaDoor ? G.hubWing : null;
  G.paused = true;
  let built = false;
  try { await loadInto(() => { built = true; startHub(to, from); }); }
  finally {
    if (G.hub) G.paused = false;
    // (the loading screen was still lifting off the last wing, so it didn't build: go again in a moment)
    if (!built){ moving = false; setTimeout(() => goWing(to, viaDoor), 250); }
  }
}

/* the station you're standing at, if any (nearest, within its reach, roughly in front of you) */
function pickNear(){
  if (!G.hub || G.mode !== 'play' || G.paused || G.skillSelect || G.cutscene || G.duel) return null;   // (a duel in the ring: no station prompts under the fighters)
  const p = playerPos(), f = fwd();
  let best = null, bd = Infinity;
  for (const s of hubWing().stations){
    if (s.when && !s.when()) continue;   // (a station that waits for something: the apprentice's post, allies/apprentice.js)
    const dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz);
    if (d > (s.r || 3.2)) continue;
    const face = d < 1.2 ? 1 : (dx * f.x + dz * f.z) / d;
    if (face < -0.2) continue;
    if (d < bd){ bd = d; best = s; }
  }
  return best;
}

let openStation = null;
export function setStationOpener(fn){ openStation = fn; }   // ui/hub-ui.js
// F was tapped (game/interact.js): open the station you're at. True when it did
export function hubTap(){
  if (!G.hub || !near || !openStation) return false;
  S.uiHover(); openStation(near); return true;
}
export const hubStationNear = () => near;
setHubInteract(hubTap, () => near);

/* once a frame (main.js) */
export function updateHub(dt){
  const el = prompt();
  updateWelcome(dt);   // (game/hub-welcome.js: it tidies itself away out of the hub, so it runs first)
  if (!G.hub || G.mode !== 'play'){ if (el && shownKey){ el.classList.remove('on'); shownKey = ''; } return; }
  for (const a of shared.hubAnim || []) a.fn(a.obj, G.gt, a.base);
  stepTempleFolk(dt);   // the temple's people going about their day (world/arenas/tython-folk.js)
  near = pickNear();
  const key = near ? near.id + (pad.active ? ':pad' : '') : '';
  if (el && key !== shownKey){
    shownKey = key;
    if (near) el.innerHTML = '<kbd>' + (pad.active ? padKeys(INTERACT_KEY) : INTERACT_KEY) + '</kbd><span>' + near.name + '</span>';
    el.classList.toggle('on', !!near);
  }
  if (moving || G.paused || G.skillSelect || performance.now() - arrivedAt < 800) return;
  // the DOORS: walk into one, through it to the wing beyond
  const p = playerPos(), H = shared.arenaHalf, W = hubWing();
  for (const side in W.doors){
    const [ox, oz] = SIDE_OUT[side], out = p.x * ox + p.z * oz, along = ox ? p.z : p.x;
    if (out > H - 1 - HUB.doorReach && Math.abs(along) < HUB.doorHalf && p.y < 3){ goWing(W.doors[side], true); return; }
  }
  // co-op: the host's hero calls a different hub home (they swapped hero, or this guest arrived before hearing who they
  // play): over to the host's hub, at its start
  if (net.role === 'guest' && connected() && hubIdFor() !== G.hubId){ goWing(hostAboard() ? SHIP_WING : HUBS[hubIdFor()].start); return; }
  // co-op: the host has set off on a run, and this guest is in the hub: follow them in
  if (followT > 0 && (followT -= dt) <= 0){ followT = 0; if (followHost && coopRun.on && net.role === 'guest') followHost(); }
}

/* ---------------- the party ---------------- */
// THE SHIP AS THE LOBBY (data/hero-ships.js): the host aboard their ship (a guest arriving then lands aboard too), and the
// host calling the party aboard from the galaxy map: every guest walking the hub is taken to the ship
const hostAboard = () => { const h = partnerWorlds().find(p => p.slot === 0); return !!h && h.world === 'hub:' + hubIdFor() + ':' + SHIP_WING; };
export const shipAboard = () => partnerWorlds().filter(p => p.world === 'hub:' + G.hubId + ':' + SHIP_WING);
export function callAboard(){
  if (net.role !== 'host' || !connected()) return false;
  send({ t: 'shipcall' });
  return true;
}
on('shipcall', () => {
  if (net.role !== 'guest' || !G.hub || G.mode !== 'play' || G.hubWing === SHIP_WING) return;
  showBanner('ALL ABOARD', 'The host is calling the party aboard ' + shipOf(hubIdFor()).name.replace(/^THE /, 'the '), 1.8);
  setTimeout(() => { if (G.hub && G.hubWing !== SHIP_WING && net.status === 'connected') goWing(SHIP_WING); }, 1200);
});
let followHost = null, backToTemple = null;
export function setPartyHooks(follow, back){ followHost = follow; backToTemple = back; }   // ui/menus.js
export const runLabel = () => !coopRun.on ? '' : coopRun.k === 'z' ? (ZONES[coopRun.mid.slice(ZONE_PREFIX.length)] || ZONES.jedha).name : coopRun.k === 'm' ? (coopRun.mid.startsWith('arcade:') ? 'A CHALLENGE' : coopRun.mid.startsWith('raid:') ? 'THE RAID · ' + missionTitle(coopRun.mid) : missionTitle(coopRun.mid)) : coopRun.k === 'c' ? 'THE CAMPAIGN' : 'SURVIVAL';
onRunChange((c) => {
  if (!(net.role === 'guest' && G.hub && G.mode === 'play' && c.on) || followT > 0) return;
  showBanner('THE PARTY IS LEAVING', 'The host is taking everyone to ' + runLabel(), 2.2);
  followT = 2.0;
});
on('hubcall', () => {
  if (net.role !== 'guest' || G.hub || !G.partyRun || !backToTemple) return;   // (only the guests who went along with the host)
  if (G.mode === 'play') showBanner('', 'THE HOST IS HEADING BACK TO ' + HUBS[hubIdFor()].home, 1.8);
  setTimeout(() => { if (!G.hub && G.partyRun && net.status === 'connected') backToTemple(true); }, G.mode === 'play' ? 1800 : 300);
});
