// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AN OPEN ZONE, in play (data/zones.js has the zones, world/zone-stream.js builds them in chunks): roam it as any hero,
// with your profile's kit, for as long as you like. Reached from a station in every hero's hub, left by the shuttle at
// its gate (or the pause screen's RETURN TO …), and in co-op the whole party roams it together.
//
//   · THE KIT: a zone plays like a mission from the Missions page (G.mission is set alongside G.zone, so the forms, guns
//     and powers a mission hands out up front are handed out here too), and how much of it you carry follows your rank:
//     a Padawan / Verd / Trooper carries less than a Master / Alor / Commander.
//   · WAYSTONES: walking up to one touches it (your profile keeps it: game/profile.js noteZone); tap F at any one to travel
//     to another you've touched. The gate's also takes you home.
//   · DISTRICTS: walking into one names it in a banner; the first time, it counts as seen on your profile.
//   · ITS LIFE: patrols in every district but the gate's (game/zone-fights.js), people who need a hand and moments that
//     test which way you lean (game/zone-quests.js), and secrets set by hand in its corners (game/secrets.js).
//   · A FALL is never the end: the hero wakes at the nearest waystone they have touched, whole (player/damage.js onHeroFall).
//   · CO-OP: the host owns the foes, as in every mode (net/foes.js). Everyone lands at the gate, each in their own seat;
//     every screen streams the streets round its own camera, and the host's also round every guest (so a guest's fight
//     stands in streets the host has built). Waystones, falls and districts are each player's own.

import { G, shared, player } from '../state.js';
import { CFG } from '../data/config.js';
import { ZONES, ZONE_PREFIX, ZONE_TUNE as T, districtAt } from '../data/zones.js';
import { startLevel, checkUnlocks } from './flow.js';
import { playerPos, maxHp, maxStam } from '../player/helpers.js';
import { findClearSpawn } from '../world/collision.js';
import { updateZoneStream, zoneStreamExtra } from '../world/zone-stream.js';
import { showBanner } from '../ui/banners.js';
import { onInteract, INTERACT_KEY } from './interact.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { rankIndex, noteZone, zoneMemo } from './profile.js';
import { net, connected } from '../net/session.js';
import { partnerStand } from '../net/partner.js';
import { coopLive } from '../net/foes.js';
import { onHeroFall } from '../player/damage.js';
import { clearDowned } from './revive.js';
import { regroupSquad, refill } from '../allies/squad.js';
import { S, sfx } from '../audio/sfx.js';
import { floater } from '../fx/floaters.js';
import { burst } from '../fx/particles.js';
import { V3 } from '../utils.js';
import { MUSIC } from '../audio/music.js';
import { startZoneFights, updateZoneFights, zoneTier } from './zone-fights.js';
import { startZoneQuests, updateZoneQuests, zoneQuestMarks } from './zone-quests.js';

// what a zone hands out up front, by your rank (the stage a mission's `kit` names: data/missions.js), and how tough its foes
const KIT_BY_RANK = [5, 7, 9, 9, 9];
const ZN = { key: null, Z: null, district: null, named: null, distT: 0, near: null, shownKey: '', arrived: 0 };
let el = null;
const prompt = () => el || (el = document.getElementById('zonep'));

export const zoneDef = () => ZN.Z;
export const inZone = () => !!G.zone && G.mode === 'play';
export const zoneDistrict = () => ZN.district;

// the F key at a waystone, and a fall: hooked on the first visit (not as this module loads, which may be before
// game/interact.js and player/damage.js have: they import each other round a circle)
let hooked = false;
function hookUp(){
  if (hooked) return; hooked = true;
  onInteract(() => {
    if (!inZone() || !ZN.near || G.zoneFallT > 0) return false;
    S.uiHover && S.uiHover();
    if (openPanel) openPanel(ZN.near);
    return true;
  }, () => inZone() && !!ZN.near && !(G.zoneFallT > 0));
  onHeroFall(() => {
    if (!G.zone || G.mode !== 'play') return false;
    if (G.zoneFallT > 0) return true;
    G.zoneFallT = T.respawn;
    player.hp = 1; clearDowned();
    G.slowmo = 0.35; G.slowmoT = 0.9;
    showBanner(G.hero === 'jedi' ? 'THE FORCE CARRIES YOU' : 'YOU WAKE UP LATER', 'Back at the nearest waystone you have touched.', T.respawn, { kicker: 'FALLEN' });
    return true;
  });
}

/* into a zone: `key` (data/zones.js ZONES). opts.guest: following the host's (co-op), opts.at: a waystone id to land at */
export function startZone(key = 'jedha', opts = {}){
  const Z = ZONES[key]; if (!Z) return false;
  hookUp();
  ZN.key = key; ZN.Z = Z; ZN.district = null; ZN.named = null; ZN.distT = 0; ZN.near = null; ZN.shownKey = '';
  startLevel(0, { level: Z.level, mission: true, zone: key });
  G.waveTotal = KIT_BY_RANK[Math.min(KIT_BY_RANK.length - 1, rankIndex())]; checkUnlocks();   // the kit, by rank
  G.waveTotal = 2;   // ...and foes as tough as an early wave (each district sets its own when its fights begin)
  noteZone(key, 'stones', Z.waystones.find(w => w.gate).id);   // the gate's stone is yours from the first visit
  const at = opts.at && Z.waystones.find(w => w.id === opts.at);
  land(at ? [at.x, at.z + 3, Math.PI] : Z.spawn);
  ZN.arrived = performance.now();
  if (opts.guest){ G.coopGuest = true; G.coopWasGuest = true; G.coopJoin = false; }
  startZoneFights(Z); startZoneQuests(key, Z);   // its patrols and its people (game/zone-fights.js, game/zone-quests.js)
  MUSIC.setCue && MUSIC.setCue(null);
  return true;
}
// put the hero down at [x, z, yaw], spread out from the rest of the party in co-op
function land([x, z, yaw]){
  const seat = net.status === 'connected' ? net.slot : 0;
  if (seat){ const rx = -Math.cos(yaw), rz = Math.sin(yaw), o = (seat % 2 ? 1 : -1) * Math.ceil(seat / 2) * 2.6; x += rx * o; z += rz * o; }
  const s = findClearSpawn(x, z, CFG.player.radius + 0.8);
  playerPos().set(s.x, 0, s.z); G.yaw = player.faceYaw = yaw; G.pitch = 0.08;
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0;
  updateZoneStream(true, s.x, s.z);   // the streets round the new spot, before the next frame
  regroupSquad();   // (the trooper's clones come along: allies/squad.js)
}

/* ---------------- waystones ---------------- */
export const stonesTouched = () => ZN.Z ? ZN.Z.waystones.filter(w => zoneMemo(ZN.key).stones[w.id]) : [];
// travel to a waystone you've touched (ui/zone-ui.js): behind a short fade, the streets there built before it lifts
let fade = null;
export function setZoneFade(fn){ fade = fn; }
export function travelTo(id){
  const w = ZN.Z && ZN.Z.waystones.find(s => s.id === id);
  if (!w || !zoneMemo(ZN.key).stones[id]) return false;
  const go = () => { land([w.x, w.z + 3, Math.PI]); showBanner(w.name, ZN.Z.name, 1.8, { kicker: 'WAYSTONE' }); };
  if (fade) fade(go); else go();
  return true;
}
function nearestStone(p){
  let best = null, bd = Infinity;
  for (const w of stonesTouched()){ const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < bd){ bd = d; best = w; } }
  return best || ZN.Z.waystones.find(w => w.gate);
}
let openPanel = null;
export function setZonePanel(fn){ openPanel = fn; }   // ui/zone-ui.js
/* ---------------- a fall ---------------- */
function wake(){
  const w = nearestStone(playerPos());
  const go = () => {
    land([w.x, w.z + 3, Math.PI]);
    player.hp = maxHp(); player.force = CFG.player.maxForce; player.stam = maxStam();
    player.reviveGuardT = G.gt + 2.5;
    refill();   // (the second chances a squad or a partner gives: game/revive.js)
    showBanner(w.name, 'You come round by the waystone.', 2.0, { kicker: 'WAYSTONE' });
  };
  if (fade) fade(go); else go();
}

/* once a frame (main.js) */
export function updateZone(dt){
  const e = prompt();
  if (!G.zone || G.mode !== 'play' || !ZN.Z){ if (e && ZN.shownKey){ e.classList.remove('on'); ZN.shownKey = ''; } return; }
  // the streets: round this camera, and on the host round every guest too
  zoneStreamExtra(net.role === 'host' && connected() ? partnerStand().map(P => ({ x: P.pos.x, z: P.pos.z })) : null);
  updateZoneStream(false);
  if (G.zoneFallT > 0 && (G.zoneFallT -= dt) <= 0){ G.zoneFallT = 0; wake(); }
  const held = G.paused || G.skillSelect || G.cutscene;
  updateZoneQuests(held ? 0 : dt);
  if (held && coopLive() && !G.cutscene) updateZoneFights(dt);   // (a shared zone runs on behind this screen's card or pause: the party is still out there)
  if (held) return;
  const p = playerPos();
  if (!G.coopGuest) G.waveTotal = zoneTier(p.x, p.z);   // the foes' tricks follow where the fight is (a guest is sent the host's)
  updateZoneFights(dt);
  // a district walked into names itself in a banner (held a moment, so a border walked along doesn't flicker); the HUD
  // names the one you're in at once
  const d = districtAt(ZN.Z, p.x, p.z);
  ZN.distT = Math.max(0, ZN.distT - dt);
  if (d) ZN.district = d;
  if (d && d.id !== ZN.named && ZN.distT <= 0 && performance.now() - ZN.arrived > 2600){
    ZN.named = d.id; ZN.distT = T.districtHold;
    const first = noteZone(ZN.key, 'seen', d.id);
    showBanner(d.name, first ? d.line : '', first ? 3.4 : 1.8, { kicker: d.kicker });
  }
  // waystones: walk up to touch one, F at it to travel
  ZN.near = null;
  for (const w of ZN.Z.waystones){
    const dd = Math.hypot(w.x - p.x, w.z - p.z);
    if (dd < 5 && noteZone(ZN.key, 'stones', w.id)){
      S.reward && S.reward(1);
      burst(V3(w.x, 2.3, w.z), 0x8ad8ff, 24, 4, 4, 0.8);
      floater(V3(w.x, 3, w.z), 'WAYSTONE', '#8ad8ff');
      showBanner(w.name, 'Waystone touched. Travel here from any other.', 2.2, { kicker: 'WAYSTONE' });
    }
    if (dd < T.reach && !(G.zoneFallT > 0)) ZN.near = w;
  }
  const key = ZN.near ? ZN.near.id + (pad.active ? ':pad' : '') : '';
  if (e && key !== ZN.shownKey){
    ZN.shownKey = key;
    if (ZN.near) e.innerHTML = '<kbd>' + (pad.active ? padKeys(INTERACT_KEY) : INTERACT_KEY) + '</kbd><span>' + (ZN.near.gate ? 'WAYSTONE · THE WAY HOME' : 'WAYSTONE') + '</span>';
    e.classList.toggle('on', !!ZN.near);
  }
}

/* the compass's marks (ui/compass.js): every waystone, the touched ones bright, and the district landmarks */
export function zoneMarks(){
  if (!G.zone || !ZN.Z) return [];
  const memo = zoneMemo(ZN.key);
  return [...ZN.Z.waystones.map(w => ({ x: w.x, z: w.z, kind: memo.stones[w.id] ? 'spot' : 'part', label: w.name })), ...zoneQuestMarks()];
}
export const zoneLabel = (key) => (ZONES[key] || ZONES.jedha).name;
export { ZONE_PREFIX };
