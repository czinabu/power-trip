// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WELCOME (data/hub-welcome.js): the first time this save file walks into a hub, nothing comes up over it. Once the
// wing's name has faded, the hub's guide says hello on a small panel to the side (game/objectives.js's voice panel, kept
// out of the way by styles/hub.css #tutor.hw-tour), and a beacon lights the first stop of a short walk past the stations
// that ends where a first run starts. Follow it or don't: opening any other station, or launching any mode, ends it. It
// comes once per hub per save file (sw_hubwelcome_<hub>: a file's own key, engine/save-files.js). Any map or waystone has
// SHOW ME AROUND (the walk again) and WHAT'S WHERE (a card listing every place: ui/hub-ui.js draws it).
//
// CO-OP: each screen has its own welcome, read from its own file for the hub it is standing in (a guest in the host's hub
// gets that hub's, with the party's lines), and nothing of it goes over the wire; a guest pulled into the host's run
// leaves it the same way.

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
const W = { only: null, wait: 0, hub: null, tour: false, i: 0, beacon: null, at: '', panel: '', doneT: 0, last: false, greetT: 0, lineT: 0 };
const tutorEl = () => document.getElementById('tutor');
const guest = () => net.role === 'guest' && connected();
const hubNow = () => HUBS[G.hubId] || HUBS.temple;
const dataNow = () => WELCOME[G.hubId] || null;
const stopsNow = (D) => W.only ? [W.only] : D.tour;   // (the tour's stops, or the one place picked on the card: guideTo)
const stationOf = (wing, id) => { const w = hubNow().wings[wing]; return w && w.stations.find(s => s.id === id); };

let openCard = null;
export function setWelcomeOpener(fn){ openCard = fn; }   // ui/hub-ui.js

const greeting = (D) => (hubOf(G.hero) !== G.hubId && D.away || D.hello) + (guest() && D.guest ? ' ' + D.guest : '');

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
    return { label: pick(label), name: s.name, where, d: guest() && gd ? gd : pick(d), wing, id, x: s.x, z: s.z };
  }).filter(Boolean);
  const travel = [...new Set(Object.values(Hb.wings).flatMap(w => w.stations.filter(s => s.act === 'travel').map(s => s.name)))];
  return {
    kicker: 'WHAT\'S WHERE · ' + Hb.place,
    title: Hb.name, guide: D.guide, hello: greeting(D),
    rows, again: 'See this again at any ' + travel.join(' or ') + '.', start: start.short,
  };
}
// the card's SHOW ME AROUND (ui/hub-ui.js)
export function answerWelcome(tour){ if (tour) startTour(); }
// a place picked on the card: a beacon leads there, the way the tour does, for that one stop
export function guideTo(wing, id, d){
  const s = stationOf(wing, id); if (!s) return;
  W.wait = 0; markSeen(G.hubId); startTour(false, { wing, station: id, say: d, last: d, guide: true });
}
// any map or waystone: WHAT'S WHERE opens the card, SHOW ME AROUND walks the tour again (ui/hub-ui.js)
export function replayWelcome(){ W.wait = 0; return openCard ? openCard() : false; }
export function replayTour(){ W.wait = 0; startTour(); }
// a station's panel opening (ui/hub-ui.js): the stop the tour is on counts as reached; any other means the hero is off
// exploring on their own, and the tour bows out
export function welcomeStation(s){
  if (!W.tour || !s || s.act === 'welcome' || s.act === 'ready') return;
  const D = dataNow(), tour = D && stopsNow(D), stop = tour && tour[W.i];
  if (stop && stop.wing === G.hubWing && stop.station === s.id){ if (W.i < tour.length - 1){ W.i++; W.greetT = 0; S.uiClick(); } else endTour(); }
  else endTour();
}

/* ---------- arriving ---------- */
// game/hub.js startHub, every time a wing loads: a fresh hub this file hasn't been welcomed to puts the greeting on its way;
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
function startTour(greet, only = null){
  const D = dataNow(); if (!D) return;
  W.only = only; W.tour = true; W.hub = G.hubId; W.i = 0; W.doneT = 0; W.last = false; W.at = ''; W.panel = '';
  W.greetT = greet ? TUNE.greet : 0;
  // (a stop you're already standing at counts at once: the next frame moves past it)
  S.uiClick();
}
function endTour(){
  W.tour = false; W.only = null; W.last = false; W.doneT = 0; W.greetT = 0;
  dropBeacon(); W.at = '';
  if (W.panel) hideLine();
}
// the panel is the training's and the missions' too: hand it back as it was
function hideLine(){
  hidePanel(); W.panel = '';
  // (once it has faded out where it was: a mode's own panel shown meanwhile has already taken the place back)
  const t = tutorEl(); if (t) setTimeout(() => { if (!W.panel) t.classList.remove('hw-tour', 'hw-quiet'); }, 320);
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
  W.panel = k;
  const t = tutorEl(); if (t){ t.classList.add('hw-tour'); t.classList.remove('hw-quiet'); }   // (on before it shows: it fades in where it stays)
  showPanel(who, line, keys, task, opts);
  W.lineT = TUNE.lineHold;   // (the guide's words fold away after a while: the task line stays)
}

/* once a frame (game/hub.js updateHub) */
export function updateWelcome(dt){
  const live = G.hub && G.mode === 'play';
  // a page over the hub (the codex, the holocron), the pause screen, the menu: the line steps aside, and comes back after
  if (!live || G.paused){ if (W.panel) hideLine(); return; }
  if (W.wait > 0 && !G.skillSelect && !G.cutscene && !G.cardUp && (W.wait -= dt) <= 0){
    W.wait = 0;
    if (!welcomeSeen(G.hubId)){ markSeen(G.hubId); startTour(true); }   // (once: from here it's the hero's to follow or not)
  }
  if (!W.tour) return;
  if (W.lineT > 0 && (W.lineT -= dt) <= 0){ const t = tutorEl(); if (t) t.classList.add('hw-quiet'); }
  const D = dataNow(); if (!D){ endTour(); return; }
  if (W.beacon){
    pulseMarker(W.beacon, dt, G.gt);
    // the column fades as the hero walks into it (the camera inside it would wash the screen gold), the ring stays
    const b = W.beacon, p = playerPos(), d = Math.hypot(p.x - b.position.x, p.z - b.position.z);
    b.userData.beam.material.opacity = TUNE.beamAlpha * Math.min(1, Math.max(0, (d - 3) / 9));
  }
  const tour = stopsNow(D), n = tour.length, stop = tour[W.i];
  const s = stationOf(stop.wing, stop.station);
  const step = stop.guide ? 'THIS WAY · ' + (s ? s.name : '') : 'FIRST STEPS · ' + (W.i + 1) + ' / ' + n;
  if (!s){ if (++W.i >= n) endTour(); return; }
  if (G.hubWing !== stop.wing){
    const way = doorToward(stop.wing); if (!way){ endTour(); return; }
    const [ox, oz] = SIDE_OUT[way.side], H = shared.arenaHalf - 3;
    beaconAt('door:' + way.side, ox * H, oz * H, TUNE.doorRing);
    say(D.guide, stop.say, '', 'Go through the ' + SIDE_NAME[way.side] + ' DOOR to ' + way.to.name, { step });   // (the greeting is in the start wing, where the tour begins)
    return;
  }
  beaconAt('st:' + s.id, s.x, s.z, (s.r || 3.2) >= 6 ? TUNE.bigRing : TUNE.stationRing);   // (a big table: the ring goes round it)
  const p = playerPos(), d = Math.hypot(p.x - s.x, p.z - s.z), reached = d < Math.min(s.r || 3.2, 6) + 0.4;
  const lastStop = W.i === n - 1;
  if (!W.last){
    if (reached){
      if (lastStop){ W.last = true; W.doneT = TUNE.doneHold; S.reward(); }
      else { W.i++; W.greetT = 0; S.uiClick(); return; }
    } else {
      // the greeting first: the guide's hello, over the first stop's beacon
      if (W.greetT > 0){ W.greetT -= dt; say(D.guide, greeting(D), '', 'Follow the light to the ' + s.name + ', or explore on your own', { step: 'WELCOME TO ' + hubNow().home }); }
      else say(D.guide, stop.say, '', 'Walk up to the ' + s.name, { step });
      return;
    }
  }
  // the last stop: the first run is a tap away. It stays up a while (or until the station's panel opens), then lets go
  say(D.guide, guest() && stop.guestLast ? stop.guestLast : stop.last || stop.say, 'F', (stop.guide ? 'Tap at the ' + s.name : 'Tap at the ' + s.name + ' to start'), { step: stop.guide ? 'YOU ARE THERE' : 'FIRST STEPS · DONE', done: true });
  if (G.skillSelect || (W.doneT -= dt) <= 0) endTour();
}

// for the smoke tests and screenshots (window.GAME.hub.welcome)
export const welcomeState = () => ({ wait: W.wait, tour: W.tour, i: W.i, last: W.last, greet: W.greetT > 0, seen: welcomeSeen(G.hubId), beacon: !!W.beacon,
  target: W.beacon ? { x: W.beacon.position.x, z: W.beacon.position.z } : null });
export const welcomeStops = () => ((dataNow() || {}).tour || []).map(t => { const s = stationOf(t.wing, t.station) || {}; return { wing: t.wing, id: t.station, x: s.x, z: s.z }; });
export function forgetWelcome(){ for (const h in HUBS) try { localStorage.removeItem(key(h)); } catch(e){} }
