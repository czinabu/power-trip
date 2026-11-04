// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE BLOCKING: where everyone stands, and how, the moment play cuts to a cutscene (game/cutscene.js calls these as a
// scene starts). A scene can start anywhere a fight leaves the field: a duel foe breaking off a step from the blade, a
// cornered quarry, a boss landing on top of the hero, a partner and the squad crowded round. Each scene has a centre (the
// one who speaks, or the spot it looks at) and the hero who leads it; everyone else is put on a mark round those two:
//
//   the hero       settled first: back on their feet on the ground (out of a jump, a flip, a slide, a wall-run, a
//                  ledge, a finisher or a saber lock), then stood at talking distance from the speaker (cutscene.js
//                  makeRoom: the speaker steps back to it, or the hero does when the speaker can't move)
//   the speaker    at BLOCK.talk from the hero, more for someone bigger (a 1.3 m-tall-for-scale Inquisitor, a boss),
//                  measured off how big they really stand on the field, not the stand-in's own size setting
//   co-op partners on the marks beside the lead hero (MATES: one each side, a step back, the fourth behind), facing the
//                  speaker. The host's hero leads every shared scene (a duel's entrance, the boss, a foe breaking off);
//                  the host sends where it stands and where the speaker is, each guest's own screen puts its hero on its
//                  mark, and every screen shows the partners already standing on theirs (net/partner.js holdPartner),
//                  so nobody slides into place in the first shot and everyone is where the others see them when play
//                  resumes. A chapter's opening plays on each screen for its own hero: there a guest standing on top of
//                  a partner only steps aside, and the cast stands clear of every partner (cutscene.js castSpots)
//   the squad      a squadmate in the way (inside someone's space, or between the lead hero and the speaker) falls in
//                  behind the heroes, facing the speaker; one already clear of the set stays where it is
//   foes on the field  held where the fight left them (the fight resumes from there), but one standing inside a
//                  hero's or the speaker's space is eased out of it
//
// Every mode with cutscenes (the three stories' campaigns, missions, arcade, and co-op in each). The squad and the foes
// are the host's to move (a guest sees them where the host's snapshots put them).

import { G, shared, player, enemies } from '../state.js';
import { net, connected } from '../net/session.js';
import { playerPos } from '../player/helpers.js';
import { findClearSpawn, groundAt, segBlockedBySolids } from '../world/collision.js';
import { sightClear } from '../world/camblock.js';
import { allies } from '../allies/squad.js';
import { partnerStand, holdPartner, releasePartners } from '../net/partner.js';
import { endFinisher } from '../player/jedi/finisher.js';
import { endLock } from '../enemies/duel.js';

export const BLOCK = {
  talk: 3.1,        // m between the hero and the one they talk to, both of a man's height
  perSize: 2.6,     // m more for each 1.0 the speaker stands taller than that (an Inquisitor at 1.31: ~3.9 m)
  space: 1.6,       // m: inside this of a hero or the speaker, anyone else is in their space
  lane: 0.9,        // m: this near the line from the lead hero to the speaker, a squadmate blocks the talk
  // the partners' marks off the lead hero: [m to the side (+ right of the way they face), m back]; seats 1, 2, 3
  mates: [[1.9, 0.7], [-1.9, 0.7], [0.9, 2.1]],
  squadBack: 3.3,   // m behind the lead hero the squad falls in
  squadSpread: 0.55, // rad between squadmates on that arc
};

const yawTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// how big a figure stands on the field (the mesh's own scale: a foe type's base size times the stand-in's)
export const sizeOf = (a) => Math.max(a && a.scale || 1, a && a.g && a.g.scale ? a.g.scale.x || 1 : 1);
// how far from the hero someone that big stands to talk
export const roomFor = (size) => BLOCK.talk + Math.max(0, (size || 1) - 1) * BLOCK.perSize;

/* ---------- the hero: on their feet ---------- */
// whatever the body was busy with that would leave it hanging in the air, lying along a slide or folded mid-flip in
// the scene's stand is let go, and the hero is put on the ground under them
export function settleHero(){
  if (player.fin) endFinisher();
  if (player.saberLock) endLock();
  player.flip = null; player.wallRun = null; player.hang = null; player.mantle = null;
  player.slideT = 0; player.dashT = 0; player.dive = null; player.slamming = false; player.slamWind = 0;
  player.jetActive = false; player.boosting = false;
  if (player.grappleActive){ player.grappleActive = null; if (shared._grappleLine) shared._grappleLine.visible = false; }
  if (player.vis) player.vis.rotation.set(0, 0, 0);   // (a flip's roll, a wall-run's lean)
  const pp = playerPos(), gy = groundAt(pp.x, pp.z, pp.y + 0.6);
  if (pp.y > gy + 0.02 || pp.y < gy - 0.3 || !player.grounded){ pp.y = gy; player.vy = 0; player.grounded = true; }
}

/* ---------- marks ---------- */
// a spot near (x, z) a body can stand on: clear of props, level with `y`, nothing solid between it and `from`
function standAt(x, z, y, from){
  for (const r of [0, 0.5, 0.9]) for (const a of [0, 1.6, -1.6, 3.14]){
    const c = findClearSpawn(x + Math.sin(a) * r, z + Math.cos(a) * r, 0.55);
    const [hx, hz] = [shared.arenaHalf - 1.2, (shared.arenaHalfZ || shared.arenaHalf) - 1.2];
    if (Math.abs(c.x) > hx || Math.abs(c.z) > hz) continue;
    if (Math.abs(groundAt(c.x, c.z, y + 1.5) - y) > 0.5) continue;
    if (from && (segBlockedBySolids(from.x, from.z, c.x, c.z) || sightClear(from.x, y + 1.5, from.z, c.x, y + 1.5, c.z) < 0.9)) continue;
    return { x: c.x, z: c.z, y: groundAt(c.x, c.z, y + 1.5) };
  }
  return null;
}
// seat `seat`'s mark (1 to 3: the guests) beside the lead hero at `lead`, all of them facing `at` (the speaker). The same
// on every screen: worked out from the same two points on the same map
export function mateMark(seat, lead, at){
  const o = BLOCK.mates[(seat - 1) % BLOCK.mates.length], f = yawTo(lead.x, lead.z, at.x, at.z);
  const rx = Math.cos(f), rz = -Math.sin(f);   // (the lead's right, facing the speaker)
  const fx = Math.sin(f), fz = Math.cos(f);
  const y = lead.y || 0;
  const c = standAt(lead.x + rx * o[0] - fx * o[1], lead.z + rz * o[0] - fz * o[1], y, lead)
         || standAt(lead.x - rx * o[0] - fx * o[1], lead.z - rz * o[0] - fz * o[1], y, lead)
         || standAt(lead.x - fx * (o[1] + 1.4), lead.z - fz * (o[1] + 1.4), y, lead);
  if (!c) return null;
  return { x: c.x, y: c.y, z: c.z, yaw: yawTo(c.x, c.z, at.x, at.z) };
}
// this browser's hero onto a mark (a guest's seat in a shared scene)
function putHero(m){
  const pp = playerPos();
  pp.set(m.x, m.y, m.z);
  player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; player.grounded = true;
  G.yaw = m.yaw;
}

/* ---------- the scene's set ---------- */
// lead: the lead hero's feet { x, y, z } · at: the speaker or the spot looked at { x, z } (null: a scene on the hero alone)
// actors: the groups on set (the speaker, the cast: never moved here) · stage: a shared scene's marks from the host
// ({ lead: [x, y, z], at: [x, z] }, on a guest), or null. Returns what to send the guests: { lead, at } or null
// Before a scene builds its shots (game/cutscene.js, each play* as it begins): the hero settled, and on a guest, put on
// its mark in the host's scene (stage: { lead: [x, y, z], at: [x, z] } from the host), or, in a scene of this screen's
// own (a chapter's opening), stepped aside off a partner it stands on top of
let prepped = false;
export function prepScene(stage){
  settleHero();
  prepped = true;
  if (!connected() || net.role !== 'guest') return;
  if (stage && Array.isArray(stage.lead) && Array.isArray(stage.at)){
    const lead = { x: +stage.lead[0], y: +stage.lead[1] || 0, z: +stage.lead[2] }, at = { x: +stage.at[0], z: +stage.at[1] };
    const m = mateMark(net.slot || 1, lead, at);
    if (m) putHero(m);
    holdPartner(0, lead.x, lead.y, lead.z, yawTo(lead.x, lead.z, at.x, at.z));
    for (const p of partnerStand()) if (p.slot !== 0){ const k = mateMark(p.slot, lead, at); if (k) holdPartner(p.slot, k.x, k.y, k.z, k.yaw); }
    return;
  }
  const pp = playerPos();
  for (const p of partnerStand()){
    if (flat(p.pos, pp) >= BLOCK.space) continue;
    const away = flat(p.pos, pp) > 0.05 ? yawTo(p.pos.x, p.pos.z, pp.x, pp.z) : G.yaw + Math.PI / 2;
    const c = standAt(p.pos.x + Math.sin(away) * BLOCK.space * 1.25, p.pos.z + Math.cos(away) * BLOCK.space * 1.25, pp.y, p.pos);
    if (c){ pp.x = c.x; pp.z = c.z; pp.y = c.y; }
    break;
  }
}
// As the scene starts, once the hero and the speaker have their room (cutscene.js makeRoom): at: the speaker or the spot
// looked at { x, z } (null: a scene on the hero alone) · actors: the groups on set (never moved here) · stage: as above ·
// isShared: the host plays it for the guests too. Returns what to send the guests with it ({ lead, at }), or null
export function blockScene(at, actors, stage, isShared){
  if (!prepped) prepScene(stage);
  prepped = false;
  const on = new Set((actors || []).filter(Boolean)), coop = connected();
  let lead = playerPos();
  if (coop && net.role === 'guest' && stage && Array.isArray(stage.lead)) lead = { x: +stage.lead[0], y: +stage.lead[1] || 0, z: +stage.lead[2] };
  // the host leads a shared scene: every partner here is shown on their mark straight away (their own screens put them there)
  if (coop && net.role === 'host' && isShared && at) for (const p of partnerStand()){ const k = mateMark(p.slot, lead, at); if (k) holdPartner(p.slot, k.x, k.y, k.z, k.yaw); }
  if (!coop || net.role !== 'guest'){ blockSquad(lead, at, on); blockFoes(lead, at, on); }
  return coop && net.role === 'host' && isShared && at ? { lead: [+lead.x.toFixed(2), +(lead.y || 0).toFixed(2), +lead.z.toFixed(2)], at: [+at.x.toFixed(2), +at.z.toFixed(2)] } : null;
}
export function unblockScene(){ prepped = false; releasePartners(); }

// everyone the scene puts on a mark, as points (the lead hero, the partners on theirs, the speaker)
function people(lead, at){
  const out = [playerPos(), lead];
  for (const p of partnerStand()) out.push(p.pos);
  if (at) out.push(at);
  return out;
}
// how far (x, z) is off the line from a to b, between them (Infinity: not between)
function offLine(x, z, a, b){
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  if (L2 < 0.01) return Infinity;
  const t = ((x - a.x) * dx + (z - a.z) * dz) / L2;
  if (t <= 0.08 || t >= 0.92) return Infinity;
  return Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
}
// squadmates in the way fall in behind the heroes, on an arc facing the speaker
function blockSquad(lead, at, on){
  const who = people(lead, at), face = at ? yawTo(lead.x, lead.z, at.x, at.z) : G.yaw, taken = [];
  let k = 0;
  for (const a of allies){
    if (!a.group || a.net || on.has(a.group) || a.state === 'down') continue;
    const p = a.group.position;
    const crowd = who.some(q => q !== p && flat(q, p) < BLOCK.space) || (at && (offLine(p.x, p.z, lead, at) < BLOCK.lane || flat(p, at) < roomFor(1) * 0.8));
    if (!crowd){ taken.push(p); continue; }
    let spot = null;
    for (let tries = 0; tries < 6 && !spot; tries++, k++){
      const n = Math.ceil(k / 2) * (k % 2 ? 1 : -1), yaw = face + Math.PI + n * BLOCK.squadSpread;
      const c = standAt(lead.x + Math.sin(yaw) * BLOCK.squadBack, lead.z + Math.cos(yaw) * BLOCK.squadBack, lead.y || 0, lead);
      if (c && !taken.some(q => flat(q, c) < 1.1) && !who.some(q => flat(q, c) < BLOCK.space)) spot = c;
    }
    if (!spot) continue;
    k++;
    p.set(spot.x, spot.y, spot.z);
    a.group.rotation.y = at ? yawTo(spot.x, spot.z, at.x, at.z) : face;
    if (a.mv){ a.mv.x = a.mv.z = 0; } a.legs = null; a.rt = null;
    taken.push(p);
  }
}
// a foe standing inside a hero's or the speaker's space is eased out of it (straight away from them)
function blockFoes(lead, at, on){
  const who = people(lead, at);
  for (const e of enemies){
    if (!e || e.dead || !e.group || on.has(e.group)) continue;
    const p = e.group.position;
    for (const q of who){
      const d = flat(p, q);
      if (d >= BLOCK.space) continue;
      const away = d > 0.05 ? yawTo(q.x, q.z, p.x, p.z) : Math.random() * Math.PI * 2;
      const c = standAt(q.x + Math.sin(away) * BLOCK.space * 1.4, q.z + Math.cos(away) * BLOCK.space * 1.4, p.y, null);
      if (c && !who.some(o => flat(o, c) < BLOCK.space)){ p.x = c.x; p.z = c.z; p.y = c.y; if (e.vel) e.vel.set(0, 0, 0); }
      break;
    }
  }
}
// where the partners stand on this screen (for the cast's spots and the lens: cutscene.js)
export const matesAround = () => partnerStand().map(p => p.pos);
