// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GALAXY MAP, on board each hero's ship (data/hero-ships.js; ui/hub-ui.js opens it at the ship's GALAXY MAP and its
// helm). A drawn chart of the galaxy: every world a node, the hyperspace lanes between them, your ship's marker on the
// world it's orbiting and a course line to the one you pick. Beside it, the picked world: its line, and everything that
// can be played there for the hero in hand (its story missions, its side missions, the open zone, the raid), each locked
// with what opens it, just as the Missions page and the calls for aid do. Under it the VOYAGES (the campaign, Act IV,
// NEW GAME+, a challenge, survival) and, in a party, who is aboard.
//
// CO-OP: it's the lobby. The host's launches go through the hub's ready check (askParty), the host can call every guest
// aboard, and a guest sees the same map with JOIN THE PARTY (and THE HOST CHOOSES) in place of the launches.
//
// Drawn in the hero's own look (styles/heroes/galaxy.css, the --hx-* tokens). Everything is DOM and one small SVG: no 3D,
// no textures, so it opens at once on a phone.

import { G } from '../state.js';
import { GALAXY, LANES, homeWorld, shipOf } from '../data/hero-ships.js';
import { MISSIONS } from '../data/missions.js';
import { missionForHero } from '../data/mission-groups.js';
import { SIDE_QUESTS, SIDE_PREFIX } from '../data/side-quests.js';
import { ZONES } from '../data/zones.js';
import { RAIDS, raidsOpen } from '../data/raids.js';
import { missionOpen } from './missions-ui.js';
import { missionDone, missionTitle } from '../game/mission.js';
import { sideWon, sideLock } from '../game/profile.js';
import { zoneLock } from '../game/zone-gate.js';
import { missionChapterNo } from '../game/sandbox-unlocks.js';
import { optHTML } from './hub-cards.js';
import { savedName } from '../net/names.js';
import { net } from '../net/session.js';
import { shipAboard, callAboard } from '../game/hub.js';
import { svgIcon } from './icons.js';
import { S } from '../audio/sfx.js';

let picked = null;   // the world picked on the map (by default the one the ship is orbiting)
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// every story mission the map should show, and which world holds it (any no world lists goes to DEEP SPACE)
let placed = null;
function worldOfMission(){
  if (placed) return placed;
  placed = new Map();
  for (const w of GALAXY) for (const id of w.missions) placed.set(id, w.id);
  const deep = GALAXY.find(w => w.deep);
  for (const id of Object.keys(MISSIONS)) if (!placed.has(id) && deep) placed.set(id, deep.id);
  return placed;
}
const missionsOn = (w, hero) => [...worldOfMission()].filter(([id, wid]) => wid === w.id && MISSIONS[id] && missionForHero(MISSIONS[id], hero) && (!MISSIONS[id].trial || missionDone(id, hero) || missionOpen(id))).map(([id]) => id);
const sidesOn = (w) => SIDE_QUESTS.filter(q => (w.sides || []).includes(q.slug));

// a world's open zones (data/hero-ships.js `zones`, or an older single `zone`)
const zonesOf = (w) => (w.zones || (w.zone ? [w.zone] : [])).filter(k => ZONES[k]);

/* what can be played on a world, for the hero in hand: [{ kind, b }] (b a panel option) */
function worldEntries(w, ctx){
  const hero = G.hero, out = [], guest = ctx.guest;
  for (const k of zonesOf(w)){
    const Z = ZONES[k];
    out.push({ kind: 'zone', b: ctx.B('OPEN ZONE · ' + Z.place, Z.blurb, guest ? null : () => ctx.askParty(Z.name, () => ctx.zone(k)), zoneLock(k)) });
  }
  if (w.raid && RAIDS[w.raid]) out.push({ kind: 'raid', b: ctx.raidButton() });
  for (const id of missionsOn(w, hero)){
    const m = MISSIONS[id], open = missionOpen(id), won = missionDone(id, hero), title = missionTitle(id, hero);
    const ch = !open && missionChapterNo ? missionChapterNo(id) : null;
    out.push({ kind: 'mission', b: ctx.B(title + (won && open ? '  ✓' : ''), open ? cap(m.blurb || '') : 'Its chapter in the campaign opens it',
      guest ? null : () => ctx.askParty(title, () => ctx.mission(id)), open ? null : (ch ? 'Clear ' + String(ch).toLowerCase().replace(/^c/, 'C') : 'Clear it in the campaign')) });
  }
  for (const q of sidesOn(w)){
    const id = SIDE_PREFIX + q.slug, won = sideWon(id), need = sideLock(q), lock = !need ? null : need.startsWith('REACH ') ? 'Reach ' + need.slice(6) : 'Beat the campaign';
    out.push({ kind: 'side', b: ctx.B('SIDE · ' + q.title + (won ? '  ✓' : ''), lock ? q.place : cap(q.blurb) + ' · ' + q.reward, guest ? null : () => ctx.askParty(q.title, () => ctx.side(id)), lock) });
  }
  return out;
}

/* the panel: { html, list } (ui/hub-ui.js puts it up and runs the clicks; an option with `stay` keeps the panel up) */
export function galaxyPanel(ctx){
  const hubId = G.hubId, ship = shipOf(hubId), home = homeWorld(hubId);
  if (!picked || !GALAXY.some(w => w.id === picked)) picked = home.id;
  const W = GALAXY.find(w => w.id === picked) || home;
  const list = [];
  const add = (b) => { list.push(b); return list.length - 1; };
  // the worlds: each a button that picks it (the panel stays up)
  const counts = (w) => {
    const ms = missionsOn(w, G.hero).length, ss = sidesOn(w).length;
    return { ms, ss, z: zonesOf(w).length > 0, r: !!(w.raid && RAIDS[w.raid]) };
  };
  let lanes = '';
  const at = Object.fromEntries(GALAXY.map(w => [w.id, w]));
  for (const [a, b] of LANES) if (at[a] && at[b]) lanes += '<line x1="' + at[a].x + '" y1="' + at[a].y + '" x2="' + at[b].x + '" y2="' + at[b].y + '"/>';
  // the course: from the ship's world to the one picked
  const course = W.id !== home.id ? '<line class="gx-course" x1="' + home.x + '" y1="' + home.y + '" x2="' + W.x + '" y2="' + W.y + '"/>' : '';
  let nodes = '';
  for (const w of GALAXY){
    const c = counts(w), here = w.id === home.id, sel = w.id === W.id, empty = !c.ms && !c.ss && !c.z && !c.r && !here;
    const i = add({ t: w.name, d: w.line, go: () => { picked = w.id; S.uiHover(); ctx.rerender(); }, stay: true });
    const pips = (c.ms ? '<i class="gx-p m" title="Story missions">' + c.ms + '</i>' : '') + (c.ss ? '<i class="gx-p s" title="Side missions">' + c.ss + '</i>' : '') +
      (c.z ? '<i class="gx-p z" title="Open zone">' + svgIcon('city') + '</i>' : '') + (c.r ? '<i class="gx-p r" title="Raid">' + svgIcon('skull') + '</i>' : '');
    nodes += '<div class="gx-w' + (sel ? ' sel' : '') + (here ? ' here' : '') + (empty ? ' empty' : '') + (w.wreck ? ' wreck' : '') + (w.ring ? ' ring' : '') + (w.deep ? ' deep' : '') +
      (w.x > 74 ? ' lt' : '') + '" data-i="' + i + '" data-w="' + w.id + '" style="left:' + w.x + '%;top:' + w.y + '%;--gc:' + w.col + ';--gs:' + (w.size || 1) + '">' +
      '<i class="gx-orb"></i><b>' + esc(w.name) + '</b>' + (pips ? '<span class="gx-ps">' + pips + '</span>' : '') + '</div>';
  }
  const shipMark = '<i class="gx-ship" style="left:' + home.x + '%;top:' + home.y + '%" title="' + esc(ship.name) + '">' + svgIcon('ship') + '</i>';
  // the picked world's card, and what can be played there
  const entries = worldEntries(W, ctx);
  if (W.id === home.id) entries.unshift({ kind: 'home', b: ctx.B('DISEMBARK', 'Walk down the ramp into ' + esc(homeHub(hubId)), () => ctx.disembark()) });
  const first = list.length;
  for (const e of entries) add(e.b);
  const tags = [W.region, W.id === home.id ? 'YOUR SHIP IS HERE' : 'ONE JUMP'].filter(Boolean).map(t => '<em>' + esc(t) + '</em>').join('');
  const worldCard = '<div class="gx-card" style="--gc:' + W.col + '"><i class="gx-big"></i><div><div class="gx-n">' + esc(W.name) + '</div><div class="gx-tags">' + tags + '</div><p>' + esc(W.line) + '</p></div></div>';
  const listHtml = entries.length ? entries.map((e, k) => optHTML(e.b, first + k, { main: k === entries.findIndex(x => x.b.go && !x.b.lock), cls: 'gx-' + e.kind })).join('')
    : '<div class="gx-none">Nothing to play here for ' + ({ jedi: 'a Jedi', mando: 'a Mandalorian', trooper: 'an ARC trooper' }[G.hero] || 'your hero') + ' yet.</div>';
  // the VOYAGES: what isn't tied to one world
  const voy = [];
  if (ctx.guest){
    const j = ctx.joinButton(); if (j) voy.push(j);
    voy.push(ctx.B('THE HOST CHOOSES', 'In a party the host picks where the ship goes, and everyone aboard goes with them.', null));
  } else {
    voy.push(...ctx.foldLater([ctx.campaign(), ctx.gateButton(), ...ctx.ngButton(), ctx.challenge(), ctx.survival(), ctx.everyMode()]));
  }
  const v0 = list.length;
  for (const b of voy) add(b);
  // the crew: who's aboard, and the host's call
  let crew = '';
  if (ctx.party){
    const aboard = shipAboard().map(p => p.name), you = savedName() || 'YOU';
    const all = [you + (net.role === 'host' ? ' (HOST)' : ''), ...aboard];
    crew = '<div class="gx-crew"><span>ABOARD · ' + all.map(esc).join(' · ') + '</span>';
    if (net.role === 'host'){
      const ci = add({ t: 'CALL THE PARTY ABOARD', d: 'Everyone walking the hub is brought aboard', go: () => { if (callAboard()) { S.uiHover(); } }, stay: true });
      crew += optHTML(list[ci], ci, { cls: 'gx-call', ic: 'party' });
    }
    crew += '</div>';
  }
  const html = '<div class="hb-box gx-box hero-' + G.hero + '">' +
    '<div class="gx-head"><div class="hb-k">' + esc(ship.name) + ' · ' + esc(ship.kind) + '</div><div class="gx-t">THE GALAXY MAP</div>' +
      '<div class="gx-sub">' + (ctx.guest ? 'You\'re aboard the host\'s ship. They pick where it goes.' : 'Pick a world, then what to do there. Every world is one jump away.') + '</div></div>' +
    '<div class="gx-body">' +
      '<div class="gx-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g class="gx-lanes">' + lanes + '</g>' + course + '</svg>' + nodes + shipMark + '</div>' +
      '<div class="gx-side">' + worldCard + '<div class="hb-list gx-list">' + listHtml + '</div></div>' +
    '</div>' +
    '<div class="gx-sec">VOYAGES</div><div class="hb-list gx-voy">' + voy.map((b, k) => optHTML(b, v0 + k, { main: !ctx.guest && k === 0 })).join('') + '</div>' +
    crew +
    '<div class="btn hb-x" data-x="1">CLOSE</div></div>';
  return { html, list };
}
const homeHub = (hubId) => ({ temple: 'the temple', kamino: 'the citadel', covert: 'the covert' }[hubId] || 'the hub');
// (the smoke tests: pick a world by id, as a click on it would)
export function galaxyPick(id){ if (GALAXY.some(w => w.id === id)) picked = id; return picked; }
export const galaxyPicked = () => picked;
