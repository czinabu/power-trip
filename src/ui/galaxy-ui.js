// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GALAXY MAP and THE HELM, on board each hero's ship (data/hero-ships.js; ui/hub-ui.js opens them at the ship's
// GALAXY MAP and its HELM / COCKPIT). The two split the work (game/ship-nav.js):
//
// THE GALAXY MAP is the chart, and PLOTS A COURSE. Every world a node, the hyperspace lanes between them, your ship's
// marker on the world it's at, and a course line to the one plotted. Beside it, the picked world: its line, how much of
// your story there is done, everything that can be played there for the hero in hand (its story missions, its side
// missions, the open zone, the raid), each locked with what opens it, and PLOT A COURSE. Picking any of them plots the
// course too. It launches nothing. Under it, the story across the galaxy and, in a party, who is aboard.
//
// THE HELM flies it. The route (where the ship is → the course), what can be played on the world at the end of it, and
// the VOYAGES that aren't tied to one world (the campaign first, Act IV, NEW GAME+, a challenge, survival). A run on the
// course's world jumps there first (ui/hyperspace.js) and leaves the ship parked there. With no course, it launches
// what's on the world the ship is already at.
//
// CO-OP: the ship is the lobby. The host's launches go through the hub's ready check (askParty), the host can call every
// guest aboard, and a guest sees the host's course on both, with JOIN THE PARTY (and THE HOST CHOOSES) in place of the
// launches.
//
// Drawn in the hero's own look (styles/heroes/galaxy.css, the --hx-* tokens). Everything is DOM and one small SVG: no 3D,
// no textures, so it opens at once on a phone.

import { G } from '../state.js';
import { GALAXY, LANES, shipOf } from '../data/hero-ships.js';
import { shipAt, shipCourse, plotCourse, clearCourse, arriveAt, shareNav, armRaidJump } from '../game/ship-nav.js';
import { nextChapter } from '../game/saves.js';
import { hyperjump } from './hyperspace.js';
import { MISSIONS } from '../data/missions.js';
import { missionForHero } from '../data/mission-groups.js';
import { SIDE_QUESTS, SIDE_PREFIX } from '../data/side-quests.js';
import { ZONES } from '../data/zones.js';
import { RAIDS, raidsOpen } from '../data/raids.js';
import { missionOpen } from './missions-ui.js';
import { missionDone, missionTitle } from '../game/mission.js';
import { sideWon } from '../game/profile.js';
import { zoneLock, sideLockLine } from '../game/zone-gate.js';
import { missionChapterNo } from '../game/sandbox-unlocks.js';
import { optHTML } from './hub-cards.js';
import { savedName } from '../net/names.js';
import { net } from '../net/session.js';
import { shipAboard, callAboard } from '../game/hub.js';
import { svgIcon } from './icons.js';
import { S } from '../audio/sfx.js';

let picked = null;   // the world picked on the map (by default the course, or the one the ship is at)
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

/* what can be played on a world, for the hero in hand: [{ kind, b }] (b a panel option). `play(label, run)` makes each
   one's click: the helm launches it (the jump first, if it's another world), the map plots a course to the world */
function worldEntries(w, ctx, play){
  const hero = G.hero, out = [], guest = ctx.guest;
  const go = (label, run) => guest ? null : play(label, run);
  for (const k of zonesOf(w)){
    const Z = ZONES[k];
    out.push({ kind: 'zone', b: ctx.B('OPEN ZONE · ' + Z.place, Z.blurb, go(Z.name, () => ctx.zone(k)), zoneLock(k)) });
  }
  if (w.raid && RAIDS[w.raid]){ const r = ctx.raidButton(); out.push({ kind: 'raid', b: play.plots && !guest ? { ...r, go: play() } : r }); }   // (the helm opens the raid table)
  for (const id of missionsOn(w, hero)){
    const m = MISSIONS[id], open = missionOpen(id), won = missionDone(id, hero), title = missionTitle(id, hero);
    const ch = !open && missionChapterNo ? missionChapterNo(id) : null;
    out.push({ kind: 'mission', b: ctx.B(title + (won && open ? '  ✓' : ''), open ? cap(m.blurb || '') : 'Its chapter in the campaign opens it',
      go(title, () => ctx.mission(id)), open ? null : (ch ? 'Clear ' + String(ch).toLowerCase().replace(/^c/, 'C') : 'Clear it in the campaign')) });
  }
  for (const q of sidesOn(w)){
    const id = SIDE_PREFIX + q.slug, won = sideWon(id), lock = sideLockLine(q);
    out.push({ kind: 'side', b: ctx.B('SIDE · ' + q.title + (won ? '  ✓' : ''), lock ? q.place : cap(q.blurb) + ' · ' + q.reward, go(q.title, () => ctx.side(id)), lock) });
  }
  if (play.plots) for (const e of out) if (e.b.go) e.b.stay = true;   // (the map: a pick plots the course, and the map stays up)
  return out;
}
// your story on a world: [done, all] of the story missions there for the hero in hand
function storyOn(w){ const ids = missionsOn(w, G.hero); return [ids.filter(id => missionDone(id, G.hero)).length, ids.length]; }
const helmName = (hubId) => (shipOf(hubId).wing.stations.find(s => s.id === 'helm') || { name: 'THE HELM' }).name;
const helmWord = (hubId) => helmName(hubId).toLowerCase();
const worldCard = (W, tags) => '<div class="gx-card" style="--gc:' + W.col + '"><i class="gx-big"></i><div><div class="gx-n">' + esc(W.name) + '</div><div class="gx-tags">' +
  tags.filter(Boolean).map(t => '<em' + (t.cls ? ' class="' + t.cls + '"' : '') + '>' + esc(t.t || t) + '</em>').join('') + '</div><p>' + esc(W.line) + '</p></div></div>';
const storyTag = (W) => { const [d, n] = storyOn(W); return n ? { t: d + ' OF ' + n + ' STORY DONE', cls: d === n ? 'done' : '' } : null; };
function crewHTML(ctx, list, add){
  if (!ctx.party) return '';
  const aboard = shipAboard().map(p => p.name), you = savedName() || 'YOU';
  const all = [you + (net.role === 'host' ? ' (HOST)' : ''), ...aboard];
  let crew = '<div class="gx-crew"><span>ABOARD · ' + all.map(esc).join(' · ') + '</span>';
  if (net.role === 'host'){
    const ci = add({ t: 'CALL THE PARTY ABOARD', d: 'Everyone walking the hub is brought aboard', go: () => { if (callAboard()) { shareNav(); S.uiHover(); } }, stay: true });
    crew += optHTML(list[ci], ci, { cls: 'gx-call', ic: 'party' });
  }
  return crew + '</div>';
}

/* THE GALAXY MAP: { html, list } (ui/hub-ui.js puts it up and runs the clicks; an option with `stay` keeps the panel up) */
export function galaxyPanel(ctx){
  const hubId = G.hubId, ship = shipOf(hubId), at = shipAt(hubId), course = shipCourse(hubId);
  if (!ctx.again) shareNav();   // (a guest aboard sees the host's course)
  if (!picked || !GALAXY.some(w => w.id === picked)) picked = (course || at).id;
  const W = GALAXY.find(w => w.id === picked) || at;
  const list = [];
  const add = (b) => { list.push(b); return list.length - 1; };
  const counts = (w) => ({ ms: missionsOn(w, G.hero).length, ss: sidesOn(w).length, z: zonesOf(w).length > 0, r: !!(w.raid && RAIDS[w.raid]) });
  let lanes = '';
  const byId = Object.fromEntries(GALAXY.map(w => [w.id, w]));
  for (const [a, b] of LANES) if (byId[a] && byId[b]) lanes += '<line x1="' + byId[a].x + '" y1="' + byId[a].y + '" x2="' + byId[b].x + '" y2="' + byId[b].y + '"/>';
  // the course: from the ship's world to the one plotted
  const line = course ? '<line class="gx-course" x1="' + at.x + '" y1="' + at.y + '" x2="' + course.x + '" y2="' + course.y + '"/>' : '';
  let nodes = '';
  for (const w of GALAXY){
    const c = counts(w), here = w.id === at.id, sel = w.id === W.id, aim = course && w.id === course.id, empty = !c.ms && !c.ss && !c.z && !c.r && !here;
    const i = add({ t: w.name, d: w.line, go: () => { picked = w.id; S.uiHover(); ctx.rerender(); }, stay: true });
    const pips = (c.ms ? '<i class="gx-p m" title="Story missions">' + c.ms + '</i>' : '') + (c.ss ? '<i class="gx-p s" title="Side missions">' + c.ss + '</i>' : '') +
      (c.z ? '<i class="gx-p z" title="Open zone">' + svgIcon('city') + '</i>' : '') + (c.r ? '<i class="gx-p r" title="Raid">' + svgIcon('skull') + '</i>' : '');
    nodes += '<div class="gx-w' + (sel ? ' sel' : '') + (here ? ' here' : '') + (aim ? ' aim' : '') + (empty ? ' empty' : '') + (w.wreck ? ' wreck' : '') + (w.ring ? ' ring' : '') + (w.deep ? ' deep' : '') +
      (w.x > 74 ? ' lt' : '') + '" data-i="' + i + '" data-w="' + w.id + '" style="left:' + w.x + '%;top:' + w.y + '%;--gc:' + w.col + ';--gs:' + (w.size || 1) + '">' +
      '<i class="gx-orb"></i><b>' + esc(w.name) + '</b>' + (pips ? '<span class="gx-ps">' + pips + '</span>' : '') + '</div>';
  }
  const shipMark = '<i class="gx-ship" style="left:' + at.x + '%;top:' + at.y + '%" title="' + esc(ship.name) + '">' + svgIcon('ship') + '</i>';
  // PLOT A COURSE (the host, or alone): the map's one job
  const helm = helmWord(hubId), isAt = W.id === at.id, isAim = course && W.id === course.id;
  const plot = (id) => () => { if (plotCourse(id)) S.uiHover(); ctx.rerender(); };
  const plotB = ctx.guest ? ctx.B('THE HOST PLOTS THE COURSE', course ? 'Plotted for ' + course.name + '. They fly it from ' + helm + '.' : 'They pick where the ship goes, from here and ' + helm + '.', null)
    : isAt && course ? { ...ctx.B('YOUR SHIP IS HERE', 'Pick here to clear the course to ' + course.name, () => { clearCourse(); S.uiHover(); ctx.rerender(); }), stay: true }
    : isAt ? ctx.B('TAKE ' + helmName(hubId), 'Your ship is here. Launch what\'s here, or plot a course to another world first', () => ctx.openHelm())
    : isAim ? ctx.B('TAKE ' + helmName(hubId), 'Course plotted for ' + W.name + '. Fly it from ' + helm, () => ctx.openHelm())
    : { ...ctx.B('PLOT A COURSE · ' + W.name, 'Then take ' + helm + ' to make the jump', plot(W.id)), stay: true };
  const pi = add(plotB);
  // the picked world's card, and what's there (picking one plots the course)
  const plays = () => plot(W.id);
  plays.plots = true;
  const entries = worldEntries(W, ctx, plays);
  const first = list.length;
  for (const e of entries) add(e.b);
  const tags = [W.region, isAt ? 'YOUR SHIP IS HERE' : isAim ? 'COURSE PLOTTED' : 'ONE JUMP', storyTag(W)];
  const listHtml = entries.length ? entries.map((e, k) => optHTML(e.b, first + k, { cls: 'gx-' + e.kind })).join('')
    : '<div class="gx-none">Nothing to play here for ' + ({ jedi: 'a Jedi', mando: 'a Mandalorian', trooper: 'an ARC trooper' }[G.hero] || 'your hero') + ' yet.</div>';
  // the story across the galaxy: how much of it is done, and on how many worlds
  let done = 0, all = 0, worlds = 0;
  for (const w of GALAXY){ const [d, n] = storyOn(w); done += d; all += n; if (n && d === n) worlds++; }
  const story = '<div class="gx-story">YOUR STORY · <b>' + done + ' OF ' + all + '</b> MISSIONS DONE · <b>' + worlds + '</b> WORLD' + (worlds === 1 ? '' : 'S') + ' CLEARED' +
    (course ? ' · COURSE PLOTTED FOR <b>' + esc(course.name) + '</b>' : '') + '</div>';
  const crew = crewHTML(ctx, list, add);
  const html = '<div class="hb-box gx-box hero-' + G.hero + '">' +
    '<div class="gx-head"><div class="hb-k">' + esc(ship.name) + ' · ' + esc(ship.kind) + '</div><div class="gx-t">THE GALAXY MAP</div>' +
      '<div class="gx-sub">' + (ctx.guest ? 'You\'re aboard the host\'s ship. They plot the course and fly it.' : 'Pick a world and plot a course, then take ' + helm + ' to make the jump.') + '</div></div>' +
    '<div class="gx-body">' +
      '<div class="gx-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g class="gx-lanes">' + lanes + '</g>' + line + '</svg>' + nodes + shipMark + '</div>' +
      '<div class="gx-side">' + worldCard(W, tags) + '<div class="hb-list gx-plot">' + optHTML(plotB, pi, { main: !!plotB.go, ic: plotB.stay ? 'compass' : 'ship', cls: isAim ? 'gx-set' : '' }) + '</div>' +
        '<div class="hb-list gx-list">' + listHtml + '</div></div>' +
    '</div>' + story + crew +
    '<div class="btn hb-x" data-x="1">CLOSE</div></div>';
  return { html, list };
}

/* NEXT IN YOUR STORY, first of the helm's voyages: the chapter the campaign plays next (the saved run's, or the story's
   first), named, with the world it's on. The ship jumps there, then the campaign picks up. Falls back to the plain
   campaign button when no chapter can be named */
function storyButton(ctx, fly){
  const N = nextChapter(); if (!N) return ctx.campaign();
  const mid = N.c.mission, wid = mid && worldOfMission().get(mid), W = GALAXY.find(w => w.id === wid);
  const title = String(N.c.title || '').toUpperCase();
  return { ...ctx.B('NEXT IN YOUR STORY · ' + title, cap(N.no.toLowerCase()) + (W ? ' · on ' + W.name : '') + (N.resume ? ' · your run picks up here' : ' · the story from its start'),
    () => ctx.askParty('THE CAMPAIGN', () => fly(W, ctx.launchCampaign))), story: true };
}

/* THE HELM: { html, list }, the same way. Flies the course, launches, and holds the voyages */
export function helmPanel(ctx){
  const hubId = G.hubId, ship = shipOf(hubId), at = shipAt(hubId), course = shipCourse(hubId), T = course || at;
  if (!ctx.again) shareNav();
  const list = [];
  const add = (b) => { list.push(b); return list.length - 1; };
  // a run on another world: the jump, the ship parked there, then the run (on the world it's at: just the run)
  const fly = (w, run) => { if (!w || w.id === at.id){ run(); return; } arriveAt(w.id, hubId); hyperjump(w, run); };
  const play = (label, run) => () => ctx.askParty(label, () => fly(course, run));
  const entries = worldEntries(T, ctx, play);
  // (the raid opens its own page first: BEGIN there makes the jump, ui/hub-ui.js)
  if (course && !ctx.guest) for (const e of entries) if (e.kind === 'raid' && e.b.go){ const open = e.b.go; e.b.go = () => { armRaidJump(course); open(); }; }
  const first = list.length;
  for (const e of entries) add(e.b);
  const listHtml = entries.length ? entries.map((e, k) => optHTML(e.b, first + k, { main: k === entries.findIndex(x => x.b.go && !x.b.lock), cls: 'gx-' + e.kind })).join('')
    : '<div class="gx-none">Nothing to play on ' + esc(T.name) + ' for ' + ({ jedi: 'a Jedi', mando: 'a Mandalorian', trooper: 'an ARC trooper' }[G.hero] || 'your hero') + ' yet. Plot another course at the galaxy map.</div>';
  // the VOYAGES: what isn't tied to one world, and the map to plot another course
  const voy = [];
  if (ctx.guest){
    const j = ctx.joinButton(); if (j) voy.push(j);
    voy.push(ctx.B('THE HOST CHOOSES', 'In a party the host flies the ship, and everyone aboard goes with them.', null));
  } else {
    voy.push(...ctx.foldLater([storyButton(ctx, fly), ctx.gateButton(), ...ctx.ngButton(), ctx.challenge(), ctx.survival(), ctx.everyMode()]));
    if (course) voy.push({ ...ctx.B('CLEAR THE COURSE', 'Stay over ' + at.name + ' and launch what\'s here', () => { clearCourse(); S.uiHover(); ctx.rerender(); }), stay: true });
  }
  voy.push(ctx.B('THE GALAXY MAP', course ? 'Plot a different course' : 'Plot a course to another world', () => ctx.openMap()));
  const v0 = list.length;
  for (const b of voy) add(b);
  const orb = (w, k) => '<div class="hl-w" style="--gc:' + w.col + '"><i></i><div><em>' + k + '</em><b>' + esc(w.name) + '</b></div></div>';
  const route = '<div class="hl-route' + (course ? '' : ' none') + '">' + orb(at, 'IN ORBIT OVER') + (course ? '<span class="hl-arrow"></span>' + orb(course, 'COURSE PLOTTED FOR') :
    '<div class="hl-hint">' + (ctx.guest ? 'The host hasn\'t plotted a course.' : 'No course plotted. Launch what\'s here, or plot a course at the galaxy map.') + '</div>') + '</div>';
  const sub = ctx.guest ? 'You\'re aboard the host\'s ship. They fly it.' : course ? 'Pick what to do on ' + course.name + ' and the ship makes the jump.' : 'What\'s here, the campaign, and every voyage that isn\'t tied to one world.';
  const html = '<div class="hb-box gx-box hl-box hero-' + G.hero + '">' +
    '<div class="gx-head"><div class="hb-k">' + esc(ship.name) + ' · ' + esc(ship.kind) + '</div><div class="gx-t">' + esc(helmName(hubId)) + '</div>' +
      '<div class="gx-sub">' + esc(sub) + '</div></div>' + route +
    '<div class="hl-body">' +
      '<div class="gx-side">' + worldCard(T, [T.region, course ? 'ONE JUMP' : 'YOU ARE HERE', storyTag(T)]) + '<div class="hb-list gx-list">' + listHtml + '</div></div>' +
      '<div class="gx-side"><div class="gx-sec">VOYAGES</div><div class="hb-list gx-voy">' + voy.map((b, k) => optHTML(b, v0 + k, { main: !ctx.guest && k === 0, cls: b.story ? 'hl-story' : '', ic: b.t === 'THE GALAXY MAP' ? 'map' : b.story ? 'saga' : undefined })).join('') + '</div></div>' +
    '</div>' +
    '<div class="btn hb-x" data-x="1">CLOSE</div></div>';
  return { html, list };
}
// (the smoke tests: pick a world by id, as a click on it would)
export function galaxyPick(id){ if (GALAXY.some(w => w.id === id)) picked = id; return picked; }
export const galaxyPicked = () => picked;
