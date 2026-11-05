// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HIDDEN TEMPLE ON TYTHON, the hub: walk its wings (data/hub.js), tap F at a station to open it (ui/hub-ui.js), walk
// through a great door and the wing beyond loads in its place. No foes, no waves, no run: it is where every run starts
// and where it comes back to.
//
// CO-OP: the temple is the party's lobby. Everyone in the room can be in it, each in whichever wing they like (you see
// the others in the wing you share: player/players.js worldKey). When the HOST launches a mode, every guest standing in
// the temple follows them into it (net/foes.js tells the guests the host's run is on); when the host comes back to the
// temple, the guests who came along come back with them ('hubcall').

import { shared, G, player } from '../state.js';
import { CFG } from '../data/config.js';
import { HUB, HUB_WINGS, doorSide, SIDE_OUT } from '../data/hub.js';
import { startLevel } from './flow.js';
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
import { setHubInteract, INTERACT_KEY } from './interact.js';

let arrivedAt = 0, near = null, shownKey = '', moving = false, followT = 0;
const prompt = () => document.getElementById('hubp');
export const hubWing = () => HUB_WINGS[G.hubWing] || HUB_WINGS.hall;

/* into the temple: `wing` (the hall by default), arriving through the door from `from` when walking between wings */
export function startHub(wing, from){
  const was = G.hub;
  G.partyRun = false;   // (a guest back in the temple: the next run it follows sets it again)
  G.hubWing = HUB_WINGS[wing] ? wing : HUB.start;
  const W = hubWing();
  startLevel(0, { level: W.level, hub: true });
  G.waveTotal = 0;
  let [x, z, yaw] = W.spawn;
  const side = from && doorSide(G.hubWing, from);
  if (side){
    const [ox, oz] = SIDE_OUT[side], H = shared.arenaHalf;
    x = ox * (H - 6); z = oz * (H - 6); yaw = Math.atan2(-ox, -oz);
  }
  // a co-op party spreads out side by side, each in their seat
  const seat = net.status === 'connected' ? net.slot : 0;
  if (seat){ const rx = -Math.cos(yaw), rz = Math.sin(yaw), o = (seat % 2 ? 1 : -1) * Math.ceil(seat / 2) * 2.6; x += rx * o; z += rz * o; }
  const s = findClearSpawn(x, z, CFG.player.radius + 0.8);
  playerPos().set(s.x, 0, s.z); G.yaw = player.faceYaw = yaw; G.pitch = 0.08;
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
  arrivedAt = performance.now(); moving = false; near = null; shownKey = '';
  // the host coming back into the temple from a run calls the party back with them
  if (!was && net.role === 'host' && connected()) send({ t: 'hubcall' });
}

/* walk through a door (or take the fast travel) to another wing: it loads behind the loading screen, in place of this one */
export async function goWing(to, viaDoor){
  if (!G.hub || moving || !HUB_WINGS[to]) return;
  moving = true;
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
  if (!G.hub || G.mode !== 'play' || G.paused || G.skillSelect || G.cutscene) return null;
  const p = playerPos(), f = fwd();
  let best = null, bd = Infinity;
  for (const s of hubWing().stations){
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
  if (!G.hub || G.mode !== 'play'){ if (el && shownKey){ el.classList.remove('on'); shownKey = ''; } return; }
  for (const a of shared.hubAnim || []) a.fn(a.obj, G.gt, a.base);
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
  // co-op: the host has set off on a run, and this guest is in the temple: follow them in
  if (followT > 0 && (followT -= dt) <= 0){ followT = 0; if (followHost && coopRun.on && net.role === 'guest') followHost(); }
}

/* ---------------- the party ---------------- */
let followHost = null, backToTemple = null;
export function setPartyHooks(follow, back){ followHost = follow; backToTemple = back; }   // ui/menus.js
export const runLabel = () => !coopRun.on ? '' : coopRun.k === 'm' ? (coopRun.mid.startsWith('arcade:') ? 'AN ARCADE MISSION' : missionTitle(coopRun.mid)) : coopRun.k === 'c' ? 'THE CAMPAIGN' : 'SURVIVAL';
onRunChange((c) => {
  if (!(net.role === 'guest' && G.hub && G.mode === 'play' && c.on) || followT > 0) return;
  showBanner('THE PARTY IS LEAVING', 'The host is taking everyone to ' + runLabel(), 2.2);
  followT = 2.0;
});
on('hubcall', () => {
  if (net.role !== 'guest' || G.hub || !G.partyRun || !backToTemple) return;   // (only the guests who went along with the host)
  if (G.mode === 'play') showBanner('', 'THE HOST IS HEADING BACK TO THE TEMPLE', 1.8);
  setTimeout(() => { if (!G.hub && G.partyRun && net.status === 'connected') backToTemple(true); }, G.mode === 'play' ? 1800 : 300);
});
