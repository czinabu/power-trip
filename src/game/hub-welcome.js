// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WELCOME (data/hub-welcome.js): the first time this save file walks into a hub, the hub's guide says hello on a card
// (ui/hub-ui.js draws it, over the hub like a station's panel) that lists where everything is. SHOW ME AROUND then walks
// the hero to a few stations under a beacon, the guide's line on the voice panel (game/objectives.js), and ends at the
// station that starts a first run. I KNOW THE WAY (or closing the card) leaves it be. Either way it is seen, once per hub
// per save file (sw_hubwelcome_<hub>: a file's own key, engine/save-files.js), and any map or waystone shows it again.
//
// It never holds anyone up: a returning file never sees it, the tour is only a beacon and a line (walk off anywhere, fast
// travel, open any station), and launching any mode ends it. CO-OP: each screen has its own welcome, read from its own file
// for the hub it is standing in (a guest in the host's hub sees that hub's), and nothing of it goes over the wire; a guest
// pulled into the host's run leaves it the same way.

import { G, shared } from '../state.js';
import { HUBS, doorSide, SIDE_OUT, hubOf } from '../data/hub.js';
import { WELCOME, WELCOME_TUNE as TUNE } from '../data/hub-welcome.js';
import { showPanel, hidePanel, makeBeacon, removeMarker, pulseMarker } from './objectives.js';
import { playerPos } from '../player/helpers.js';
import { groundAt } from '../world/collision.js';
import { net, connected } from '../net/session.js';
import { S } from '../audio/sfx.js';
import { onRunStart } from './flow.js';

const key = (hub) => 'sw_hubwelcome_' + hub;
export function welcomeSeen(hub){ try { return localStorage.getItem(key(hub)) === '1'; } catch(e){ return true; } }   // (no storage: never nag)
function markSeen(hub){ try { localStorage.setItem(key(hub), '1'); } catch(e){} }

const SIDE_NAME = { n: 'NORTH', s: 'SOUTH', e: 'EAST', w: 'WEST' };
const W = { wait: 0, hub: null, tour: false, i: 0, beacon: null, at: '', panel: '', doneT: 0, last: false };
const guest = () => net.role === 'guest' && connected();
const hubNow = () => HUBS[G.hubId] || HUBS.temple;
const dataNow = () => WELCOME[G.hubId] || null;
const stationOf = (wing, id) => { const w = hubNow().wings[wing]; return w && w.stations.find(s => s.id === id); };

let openCard = null;
export function setWelcomeOpener(fn){ openCard = fn; }   // ui/hub-ui.js

/* ---------- the card ---------- */
// what the card shows for the hub you're in (ui/hub-ui.js): its guide's hello, a row per place, and how to see it again
export function welcomeCard(){
  const D = dataNow(), Hb = hubNow(); if (!D) return null;
  const start = Hb.wings[Hb.start], inStart = G.hubWing === Hb.start;
  const home = hubOf(G.hero) === G.hubId, pick = (v) => v && typeof v === 'object' ? (home ? v.home : v.away) : v;
  const rows = D.places.map(([label, wing, id, d, gd]) => {
    const Wg = Hb.wings[wing], s = Wg && Wg.stations.find(t => t.id === id); if (!s) return null;
    const side = doorSide(Hb.wings, Hb.start, wing);
    const where = wing === G.hubWing ? Wg.short + ' · RIGHT HERE' : inStart && side ? Wg.short + ' · ' + SIDE_NAME[side] + ' DOOR' : Wg.short;
    return { label: pick(label), name: s.name, where, d: guest() && gd ? gd : pick(d) };
  }).filter(Boolean);
  const travel = [...new Set(Object.values(Hb.wings).flatMap(w => w.stations.filter(s => s.act === 'travel').map(s => s.name)))];
  return {
    kicker: welcomeSeen(G.hubId) ? Hb.place : 'FIRST TIME IN ' + Hb.home,
    title: Hb.name, guide: D.guide, hello: (!home && D.away || D.hello) + (guest() && D.guest ? ' ' + D.guest : ''),
    rows, again: 'See this again at any ' + travel.join(' or ') + '.', first: !welcomeSeen(G.hubId), start: start.short,
  };
}
// the card's buttons (and closing it) answer it: from then on this hub's welcome is seen
export function answerWelcome(tour){
  markSeen(G.hubId);
  if (tour) startTour(); else if (W.tour) endTour();
}
// any map or waystone: SHOW ME AROUND (ui/hub-ui.js)
export function replayWelcome(){ W.wait = 0; return openCard ? openCard() : false; }

/* ---------- arriving ---------- */
// game/hub.js startHub, every time a wing loads: a fresh hub this file hasn't been welcomed to puts the card on its way;
// a tour under way picks up in the wing it walked into
export function welcomeArrive(){
  dropBeacon(); W.at = ''; W.panel = '';
  if (W.tour && W.hub !== G.hubId) endTour();
  if (!W.tour && !welcomeSeen(G.hubId) && WELCOME[G.hubId]) W.wait = TUNE.delay;
  W.hub = G.hubId;
}
// any mode starting (game/flow.js startLevel, not the hub): the first run is under way, so the tour has done its job
onRunStart(() => { W.wait = 0; if (W.tour) endTour(); });

/* ---------- the tour ---------- */
function startTour(){
  const D = dataNow(); if (!D) return;
  W.tour = true; W.hub = G.hubId; W.i = 0; W.doneT = 0; W.last = false; W.at = ''; W.panel = '';
  // (a stop you're already standing at counts at once: the next frame moves past it)
  S.uiClick();
}
function endTour(){
  W.tour = false; W.last = false; W.doneT = 0;
  dropBeacon(); W.at = '';
  if (W.panel){ hidePanel(); W.panel = ''; }
}
function dropBeacon(){ if (W.beacon){ removeMarker(W.beacon); W.beacon = null; } }
function beaconAt(tag, x, z, r){
  if (W.at === tag && W.beacon) return;
  dropBeacon(); W.at = tag;
  W.beacon = makeBeacon(x, z, groundAt(x, z, 2.5), TUNE.beacon, r);
  // (brighter than a mission's: the temple's halls are pale, and this one has to read from across them)
  const { beam, ring } = W.beacon.userData;
  beam.material.opacity = TUNE.beamAlpha; beam.scale.set(r > 2 ? 2.2 : 1.2, 1.6, r > 2 ? 2.2 : 1.2); beam.position.y = 11;
  ring.material.depthTest = false; ring.renderOrder = 3;
}
// the way to a wing from this one: its own door, or else the door back toward the hub's start
function doorToward(wing){
  const Hb = hubNow();
  const side = doorSide(Hb.wings, G.hubWing, wing) || doorSide(Hb.wings, G.hubWing, Hb.start);
  return side ? { side, to: Hb.wings[hubNow().wings[G.hubWing].doors[side]] } : null;
}
function say(who, line, keys, task, opts){
  const k = [who, line, keys, task, opts.step, !!opts.done].join('|');
  if (k === W.panel) return;
  W.panel = k; showPanel(who, line, keys, task, opts);
}

/* once a frame (game/hub.js updateHub) */
export function updateWelcome(dt){
  const live = G.hub && G.mode === 'play';
  // a page over the hub (the codex, the holocron), the pause screen, the menu: the line steps aside, and comes back after
  if (!live || G.paused){ if (W.panel){ hidePanel(); W.panel = ''; } return; }
  if (W.wait > 0 && !G.skillSelect && !G.cutscene && !G.cardUp && (W.wait -= dt) <= 0){
    W.wait = 0;
    if (!welcomeSeen(G.hubId) && !(openCard && openCard())) W.wait = 0.5;   // (something else was up: try again shortly)
  }
  if (!W.tour) return;
  const D = dataNow(); if (!D){ endTour(); return; }
  if (W.beacon){
    pulseMarker(W.beacon, dt, G.gt);
    // the column fades as the hero walks into it (the camera inside it would wash the screen gold), the ring stays
    const b = W.beacon, p = playerPos(), d = Math.hypot(p.x - b.position.x, p.z - b.position.z);
    b.userData.beam.material.opacity = TUNE.beamAlpha * Math.min(1, Math.max(0, (d - 3) / 9));
  }
  const n = D.tour.length, stop = D.tour[W.i], step = 'FIRST STEPS · ' + (W.i + 1) + ' / ' + n;
  const s = stationOf(stop.wing, stop.station);
  if (!s){ if (++W.i >= n) endTour(); return; }
  if (G.hubWing !== stop.wing){
    const way = doorToward(stop.wing); if (!way){ endTour(); return; }
    const [ox, oz] = SIDE_OUT[way.side], H = shared.arenaHalf - 3;
    beaconAt('door:' + way.side, ox * H, oz * H, TUNE.doorRing);
    say(D.guide, stop.say, '', 'Go through the ' + SIDE_NAME[way.side] + ' DOOR to ' + way.to.name, { step });
    return;
  }
  beaconAt('st:' + s.id, s.x, s.z, (s.r || 3.2) >= 6 ? TUNE.bigRing : TUNE.stationRing);   // (a big table: the ring goes round it)
  const p = playerPos(), d = Math.hypot(p.x - s.x, p.z - s.z), reached = d < Math.min(s.r || 3.2, 6) + 0.4;
  const lastStop = W.i === n - 1;
  if (!W.last){
    if (reached){
      if (lastStop){ W.last = true; W.doneT = TUNE.doneHold; S.reward(); }
      else { W.i++; S.uiClick(); return; }
    } else { say(D.guide, stop.say, '', 'Walk up to the ' + s.name, { step }); return; }
  }
  // the last stop: the first run is a tap away. It stays up a while (or until the station's panel opens), then lets go
  say(D.guide, guest() && stop.guestLast ? stop.guestLast : stop.last || stop.say, 'F', 'Tap at the ' + s.name + ' to start', { step: 'FIRST STEPS · DONE', done: true });
  if (G.skillSelect || (W.doneT -= dt) <= 0) endTour();
}

// for the smoke tests and screenshots (window.GAME.hub.welcome)
export const welcomeState = () => ({ wait: W.wait, tour: W.tour, i: W.i, last: W.last, seen: welcomeSeen(G.hubId), beacon: !!W.beacon,
  target: W.beacon ? { x: W.beacon.position.x, z: W.beacon.position.z } : null });
export const welcomeStops = () => ((dataNow() || {}).tour || []).map(t => { const s = stationOf(t.wing, t.station) || {}; return { wing: t.wing, id: t.station, x: s.x, z: s.z }; });
export function forgetWelcome(){ for (const h in HUBS) try { localStorage.removeItem(key(h)); } catch(e){} }
