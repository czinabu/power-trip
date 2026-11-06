// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The hub's STATION PANEL (the temple's, the citadel's…) (game/hub.js): tap F at a station and its panel opens over the temple, holding the game still
// and freeing the cursor the way the sandbox panel does. Each station lists what it does: the Temple Map and the waystones
// travel to any wing (and show who is where in co-op), the Council Table launches the modes, the Training Wing's stations
// the training grounds, the sandbox and survival, the Archives the codex, your profile and the mission records, the Saber
// Forge the saber workbench and the customizer.

import { G, shared, isGunner } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { setStationOpener, goWing, hubWing, curHub, runLabel } from '../game/hub.js';
import { hubLaunch, hubLaunchZone, hubToMenu, hubOpenPanel, survivalUnlocked, joinHostRun, goTemple, setHubPanelCloser, overlay } from './menus.js';
import { sandboxUnlocked } from '../game/sandbox.js';
import { canResume } from '../game/saves.js';
import { gateOpen } from '../game/gate.js';
import { randomArcadeId } from '../data/arcade.js';
import { openMissionPage } from './missions-ui.js';
import { openCustomizer } from './customizer.js';
import { openWorkbench, workbenchOpen } from './workbench.js';
import { openKitBench, kitBenchOpen } from './kitbench.js';
import { setCodex, codexOpen } from './codex-ui.js';
import { setProfile, profileOpen } from './profile-ui.js';
import { openCodex as openForms, formsOpen } from './forms-ui.js';
import { net, on, send } from '../net/session.js';
import { showBanner } from './banners.js';
import { coopRun } from '../net/run.js';
import { partnerWorlds } from '../net/partner.js';
import { savedName } from '../net/names.js';
import { SIDE_QUESTS, SIDE_PREFIX } from '../data/side-quests.js';
import { ZONES } from '../data/zones.js';
import { sideWon, sideLock, ngNextTier } from '../game/profile.js';
import { tierName, NG_TIERS } from '../data/ngplus.js';
import { mapHTML } from './hub-map.js';
import { pad } from '../engine/gamepad.js';
import { playerPos } from '../player/helpers.js';
import { welcomeCard, answerWelcome, replayWelcome, replayTour, welcomeStation, setWelcomeOpener } from '../game/hub-welcome.js';

const panel = document.getElementById('hubpanel');
const isOpen = () => panel.classList.contains('open');
let station = null, forging = false;
// the forge's workbench and customizer: DONE goes straight back to the forge
// (looked at a moment later: the customizer's own SABER WORKBENCH link closes it to open the bench, still at the forge)
const backToForge = () => setTimeout(() => {
  if (!forging || workbenchOpen() || kitBenchOpen() || overlay.classList.contains('customizing')) return;   // (or turned to another tab of it: ui/page-tabs.js)
  forging = false; if (G.fromHub && G.mode === 'menu') goTemple();
}, 0);
document.addEventListener('customizer-closed', backToForge);
document.addEventListener('workbench-closed', backToForge);
document.addEventListener('kitbench-closed', backToForge);

const guest = () => net.role === 'guest' && net.status === 'connected';
const party = () => net.status === 'connected';
// a button: [label, line under it, what it does, locked reason]
const B = (t, d, go, lock) => ({ t, d, go, lock });

// the open zones (data/zones.js): a button for each, from the mode tables and the maps
// NEW GAME+ (data/ngplus.js), once this hero has beaten the campaign: the story again at the next tier, the profile kept
const ngButton = () => { const t = ngNextTier(); return t ? [B(tierName(t), 'The story again with your rank, parts and looks · tougher foes, ' + NG_TIERS[t].muts + ' mutator' + (NG_TIERS[t].muts === 1 ? '' : 's') + ' a chapter',
  () => askParty(tierName(t), () => { G.resumeRun = null; G.ngNext = t; hubLaunch('campaign'); }))] : []; };
// ACT IV · THE SITH GATE (game/gate.js): the shared campaign after the three, for the whole party
const gateButton = () => B('ACT IV · THE SITH GATE', 'The shared campaign after the three stories, for any mix of heroes', () => askParty('ACT IV', () => hubLaunch('gate')), gateOpen() ? null : 'Beat any hero\'s campaign');
const zoneButtons = () => Object.entries(ZONES).map(([k, Z]) => B('OPEN ZONE · ' + Z.place, Z.blurb, () => askParty(Z.name, () => hubLaunchZone(k))));

function options(s){
  const G_ = G;
  switch (s.act){
    case 'travel': { const Hb = curHub(); return Hb.order.map(id => {
      const W = Hb.wings[id], here = id === G_.hubWing;
      const who = partnerWorlds().filter(p => p.world === 'hub:' + G_.hubId + ':' + id).map(p => p.name);
      return B(W.name, (here ? 'YOU ARE HERE' : W.blurb) + (who.length ? ' · ' + who.join(', ') : ''), here ? null : () => goWing(id));
    }).concat(guest() ? [] : zoneButtons(), [
      B('SHOW ME AROUND', 'A short walk past the stations, ending where your first mission starts', () => replayTour()),
      B('WHAT\'S WHERE', 'Every station in ' + Hb.home.toLowerCase() + ', and which door it is behind', () => replayWelcome()),
    ]); }
    case 'council': {
      if (guest()){
        const list = [];
        if (coopRun.on) list.push(B('JOIN THE PARTY', 'The host is on ' + runLabel() + '. Go in after them.', () => joinHostRun()));
        list.push(B('THE HOST CHOOSES', 'In a party the host picks the mission at this table, and everyone in ' + curHub().home.toLowerCase() + ' goes with them.', null));
        return list;
      }
      const sv = survivalUnlocked();
      return [
        B(canResume() ? 'CONTINUE THE CAMPAIGN' : 'THE CAMPAIGN', canResume() ? 'Pick your story up where you left it' : '13 chapters, three acts', () => askParty('THE CAMPAIGN', () => hubLaunch('campaign'))),
        gateButton(),
        ...ngButton(),
        B('STORY MISSIONS', 'Choose one from the mission list', () => { hubToMenu('mode'); hubToMissions(); }),
        B('CHALLENGE', 'A random mission, dealt fresh', () => askParty('A CHALLENGE', () => hubLaunch('mission', randomArcadeId()))),
        B('SURVIVAL', 'Endless waves, one high score', () => askParty('SURVIVAL', () => hubLaunch('endless')), sv ? null : 'Beat the campaign as Jedi and Mando'),
        ...zoneButtons(),
        B('EVERY MODE', 'The full list on the title screen', () => hubToMenu('mode')),
      ];
    }
    case 'quests': {
      // the side missions (data/side-quests.js): each waits for a rank, and a won one keeps its tick
      return SIDE_QUESTS.map(q => {
        const id = SIDE_PREFIX + q.slug, won = sideWon(id), need = sideLock(q), lock = !need ? null : need.startsWith('REACH ') ? 'Reach ' + need.slice(6) : 'Beat the campaign';
        const d = q.blurb.charAt(0).toUpperCase() + q.blurb.slice(1) + '. ' + q.place + ' · ' + (won ? 'DONE · ' : '') + q.reward;
        return B(q.title + (won ? '  ✓' : ''), lock ? q.place : d, guest() ? null : () => hubLaunch('mission', id), lock);
      }).concat(guest() ? [B('THE HOST CHOOSES', 'In a party the host picks the side mission, and everyone in the temple goes with them.', null)] : []);
    }
    // the covert's hangar (data/hub-covert.js): the ship takes you out on the hunt, the bounty board deals a job
    case 'ship': case 'bounties': {
      if (guest()) return options({ act: 'council' });
      if (s.act === 'bounties') return [
        B('TAKE A BOUNTY', 'A random job off the board, dealt fresh', () => hubLaunch('mission', randomArcadeId())),
        B('STORY MISSIONS', 'Choose one from the mission list', () => { hubToMenu('mode'); hubToMissions(); }),
      ];
      return [
        B(canResume() ? 'CONTINUE THE HUNT' : 'THE CAMPAIGN', canResume() ? 'Pick your story up where you left it' : '13 chapters, three acts', () => hubLaunch('campaign')),
        gateButton(),
        ...ngButton(),
        B('CHALLENGE', 'A random mission, dealt fresh', () => hubLaunch('mission', randomArcadeId())),
        B('SURVIVAL', 'Endless waves, one high score', () => hubLaunch('endless'), survivalUnlocked() ? null : 'Beat the campaign as Jedi and Mando'),
        ...zoneButtons(),
      ];
    }
    case 'training': return [B('TRAINING GROUNDS', 'Learn the controls and powers, lesson by lesson', () => hubLaunch('training'))];
    case 'sparring': return [B('THE SANDBOX', 'Call in any foe you have met, switch any power on or off', () => hubLaunch('sandbox'), sandboxUnlocked() ? null : 'Clear Act I of the campaign')];
    case 'proving': return [B('SURVIVAL', 'Endless waves, one high score', () => askParty('SURVIVAL', () => hubLaunch('endless')), survivalUnlocked() ? null : 'Beat the campaign as Jedi and Mando')];
    case 'codex': return [B('THE CODEX', 'Everyone you have met, foe or friend', () => hubOpenPanel(() => setCodex(true), codexOpen))];
    case 'profile': return [B('YOUR HOLOCRON', 'Your rank, the Force Tree and your deck', () => hubOpenPanel(() => setProfile(true), profileOpen))];
    case 'records': return [B('MISSION RECORDS', 'Every story mission, and what you have cleared', () => { hubToMenu('mode'); hubToMissions(); })];
    case 'forge': {
      const list = [];
      if (!isGunner()) list.push(B('SABER WORKBENCH', 'Build your lightsaber: its kyber crystal, emitter, grip and pommel', () => { hubToMenu('hero'); forging = true; openWorkbench(); }));
      else if (G.hero === 'trooper') list.push(B('ARMORY LOCKER', 'Your gear: the DC-15, the power pack, paint, markings, helmet gear and your squad\'s specialist', () => { hubToMenu('hero'); forging = true; openKitBench('trooper'); }));
      else list.push(B('BESKAR FORGE', 'Your armour: the forged sidegrade, your signet, vambraces and chest kit', () => { hubToMenu('hero'); forging = true; openKitBench('mando'); }));
      list.push(B('CUSTOMIZE YOUR HERO', 'Your look: face, robes and armour', () => { hubToMenu('hero'); forging = true; openCustomizer(); }));
      if (!isGunner()) list.push(B('FORMS & MASTERY', 'What every lightsaber form does, and how far you have mastered each', () => hubOpenPanel(openForms, formsOpen)));
      return list;
    }
  }
  return [];
}
function hubToMissions(){ G.modeSel = 'mission'; document.getElementById('mode-mission').click(); }

function render(){
  if (ready) return renderReady();
  if (station.act === 'welcome') return renderWelcome();
  if (station.act === 'travel') return renderMap();
  const W = hubWing(), list = options(station);
  const partyLine = party() ? '<div class="hb-party">' + (net.role === 'host' ? 'YOU ARE THE HOST · your party follows what you launch here' : 'IN A PARTY · ' + (savedName() || 'YOU')) + '</div>' : '';
  panel.innerHTML = '<div class="hb-box"><div class="hb-k">' + W.name + '</div><div class="hb-t">' + station.name + '</div>' +
    '<div class="hb-d">' + (station.act === 'travel' ? curHub().travel : station.act === 'quests' ? 'Side missions: calls for help from across the galaxy, answered on the story\'s own worlds. More open up as your rank rises.' : W.blurb) + '</div>' + partyLine +
    '<div class="hb-list">' + list.map((b, i) => '<div class="hb-o' + (b.go ? '' : ' off') + (b.lock ? ' locked' : '') + '" data-i="' + i + '"><b>' + b.t + '</b><span>' + (b.lock ? 'LOCKED · ' + b.lock : b.d) + '</span></div>').join('') + '</div>' +
    '<div class="btn hb-x" data-x="1">CLOSE</div></div>';
  panel._list = list;
}

function open(s){
  if (!G.hub || G.mode !== 'play' || G.paused || G.skillSelect) return false;
  station = s;
  welcomeStation(s);   // (the welcome tour's stop reached, or the hero off on their own: game/hub-welcome.js)
  G.skillSelect = true; G.sbMenu = true;   // holds the temple still and keeps the pause screen away while the cursor is free
  render(); panel.classList.add('open');
  if (document.pointerLockElement) document.exitPointerLock();
  return true;
}
export function closeHubPanel(relock = true){
  if (!isOpen()) return;
  if (ready && ready.host) endReady(false);   // (the host closing the ready check calls it off)
  if (ready && !ready.host && !ready.answered) answer(false);
  panel.classList.remove('open');
  G.skillSelect = false; G.sbMenu = false; station = null;
  if (relock && !shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}
export const hubPanelOpen = isOpen;

/* ---------------- THE MAP (ui/hub-map.js) ----------------
   The Temple Map, the waystones and every other hub's map stations: the hub drawn from above, YOU where you stand, and
   every other wing a button that takes you there. Beside it (under it on a tall screen) a line on the wing your pointer
   or the controller's ring is on, then SHOW ME AROUND and WHAT'S WHERE. */
function renderMap(){
  const Hb = curHub(), W = hubWing(), here = G.hubWing, list = options(station), p = playerPos();
  const who = (id) => partnerWorlds().filter(q => q.world === 'hub:' + G.hubId + ':' + id).map(q => q.name);
  const wingIdx = (id) => Hb.order.indexOf(id);
  const extra = list.slice(Hb.order.length);
  const partyLine = party() ? '<div class="hb-party">' + (net.role === 'host' ? 'YOU ARE THE HOST · your party follows what you launch here' : 'IN A PARTY · ' + (savedName() || 'YOU')) + '</div>' : '';
  panel.innerHTML = '<div class="hb-box hm-box hm-t-' + G.hubId + '"><div class="hm-head"><div class="hb-k">' + W.name + '</div><div class="hb-t">' + station.name + '</div>' +
    '<div class="hb-d">' + Hb.travel + '</div>' + partyLine + '</div>' +
    '<div class="hm-body">' + mapHTML(Hb, G.hubId, here, { x: p.x, z: p.z, yaw: G.yaw, half: shared.arenaHalf }, who, wingIdx) +
    '<div class="hm-side"><div class="hm-info"></div>' +
    '<div class="hb-list">' + extra.map((b, i) => '<div class="hb-o" data-i="' + (Hb.order.length + i) + '"><b>' + b.t + '</b><span>' + b.d + '</span></div>').join('') + '</div>' +
    '<div class="btn hb-x" data-x="1">CLOSE</div></div></div></div>';
  panel._list = list;
  showWing(null);
}
// the line beside the map: the wing under the pointer or the ring, or the one you're in
function showWing(id){
  const el = panel.querySelector('.hm-info'); if (!el) return;
  const Hb = curHub(), here = G.hubWing, w = Hb.wings[id] ? id : here, Wg = Hb.wings[w];
  const who = partnerWorlds().filter(q => q.world === 'hub:' + G.hubId + ':' + w).map(q => q.name);
  const go = w === here ? 'YOU ARE HERE' : (pad.active ? 'SELECT' : matchMedia('(hover: none)').matches ? 'TAP' : 'CLICK') + ' TO TRAVEL';
  el.innerHTML = '<em>' + go + '</em><b>' + Wg.name + '</b><span>' + Wg.blurb + '</span>' + (who.length ? '<i>' + who.join(', ') + '</i>' : '') +
    '<u>' + Wg.stations.filter(s => s.act !== 'travel').map(s => s.name).join(' · ') + '</u>';
  panel.querySelectorAll('.hm-wing').forEach(t => t.classList.toggle('on', t.dataset.w === id));
}
panel.addEventListener('mouseover', (e) => { const t = e.target.closest && e.target.closest('.hm-wing'); if (t) showWing(t.dataset.w); });
panel.addEventListener('mouseleave', () => { if (station && station.act === 'travel' && !panel.querySelector('.hm-wing.padfocus')) showWing(null); });
// the controller's ring (engine/gamepad.js sets .padfocus): the line follows it onto a wing
new MutationObserver((ms) => {
  if (!station || station.act !== 'travel') return;
  for (const m of ms) if (m.target.classList && m.target.classList.contains('hm-wing') && m.target.classList.contains('padfocus')){ showWing(m.target.dataset.w); return; }
}).observe(panel, { subtree: true, attributes: true, attributeFilter: ['class'] });

/* ---------------- THE WELCOME (game/hub-welcome.js) ----------------
   WHAT'S WHERE at any map or waystone: the guide's hello, a row for each place worth knowing and where it is, and SHOW
   ME AROUND (the walk to a few stations, ending at the first mission). The first visit itself puts up nothing like this:
   the guide speaks on the side panel and the walk just starts. */
function renderWelcome(){
  const C = welcomeCard(); if (!C){ panel.innerHTML = ''; panel._list = []; return; }
  const list = [
    B('SHOW ME AROUND', 'A short walk past the stations, ending where your first mission starts', () => answerWelcome(true)),
    B('CLOSE', 'Back to ' + C.start.toLowerCase(), () => answerWelcome(false)),
  ];
  const esc = (t) => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  panel.innerHTML = '<div class="hb-box hw-box"><div class="hb-k">' + esc(C.kicker) + '</div><div class="hb-t">' + esc(C.title) + '</div>' +
    '<div class="hw-say"><span>' + esc(C.hello) + '</span><b>' + esc(C.guide) + '</b></div>' +
    '<div class="hw-rows">' + C.rows.map(r => '<div class="hw-row"><div class="hw-l">' + esc(r.label) + '</div><div class="hw-n">' + esc(r.name) + '<em>' + esc(r.where) + '</em></div><div class="hw-d">' + esc(r.d) + '</div></div>').join('') + '</div>' +
    '<div class="hb-list hw-go">' + list.map((b, i) => '<div class="hb-o' + (i ? '' : ' hw-main') + '" data-i="' + i + '"><b>' + b.t + '</b><span>' + b.d + '</span></div>').join('') + '</div>' +
    '<div class="hw-again">' + esc(C.again) + '</div></div>';
  panel._list = list;
}
setWelcomeOpener(() => open({ name: 'WELCOME', act: 'welcome' }));
setStationOpener(open);
setHubPanelCloser(closeHubPanel);

panel.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (e.target === panel || e.target.closest('[data-x]')){ closeHubPanel(); return; }
  const o = e.target.closest('.hb-o,.hm-wing[data-i]'); if (!o) return;
  const b = panel._list[+o.dataset.i];
  if (!b || !b.go){ return; }
  if (b.lock){ S.uiDeny(); o.classList.remove('shake'); void o.offsetWidth; o.classList.add('shake'); return; }
  if (ready){ b.go(); return; }   // (the ready card's buttons keep it up, or close it themselves)
  closeHubPanel(false);
  b.go();
  // a wing to travel to (or any pick that leaves you in the hub): take the lock back while the click still counts.
  // goWing pauses the game for the loading screen straight away, so G.paused can't rule this out; what rules it out is
  // a pick that left the hub, or opened another panel or a page over it (the codex, the holocron)
  if (G.hub && G.mode === 'play' && !isOpen() && overlay.style.display !== 'flex' && !G.skillSelect && !G.cardUp && !shared.lockFallback && !document.pointerLockElement){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
});
document.addEventListener('keydown', (e) => { if (isOpen() && (e.key === 'Escape' || e.key === 'Tab')){ e.preventDefault(); closeHubPanel(); } }, true);

/* ---------------- THE READY CHECK ----------------
   In a party, a mode the host picks at a station (the campaign, an arcade mission, survival) doesn't set off at once:
   every guest in the temple is asked first, on a card over wherever they stand, READY or NOT YET. The run starts the
   moment they're all ready; until then the host's card lists who is and isn't, with GO NOW to start anyway and CLOSE to
   call it off. A guest who is on the title screen, or in a run, isn't asked (they join from the co-op panel, as ever). */
let ready = null;   // host: { host, id, label, go, ans: Map(slot → true/false) } · guest: { id, label, answered }
const templeGuests = () => partnerWorlds().filter(p => p.world && p.world.startsWith('hub:'));
function askParty(label, go){
  if (net.role !== 'host' || !party() || !templeGuests().length){ go(); return; }
  ready = { host: true, id: Date.now() % 1e9, label, go, ans: new Map() };
  send({ t: 'hubready', id: ready.id, label });
  S.uiHover();
  // (the station's panel closed as the pick was clicked: this card takes its place)
  if (!open({ name: 'READY CHECK', act: 'ready' })) endReady(false);
}
function renderReady(){
  const R = ready, list = [];
  let line;
  if (R.host){
    const gs = templeGuests();
    line = 'Starting ' + R.label + ' as soon as everyone in the temple is ready.';
    for (const p of gs){ const a = R.ans.get(p.slot); list.push(B(p.name, a === true ? 'READY' : a === false ? 'NOT YET' : 'Deciding…', null)); }
    list.push(B('GO NOW', 'Start without waiting: everyone in the temple comes along', () => endReady(true)));
  } else {
    line = R.answered ? 'Waiting for the host to start.' : 'The host wants to start ' + R.label + '. Everyone in the temple goes in together.';
    if (!R.answered){
      list.push(B('READY', 'Go in with the party when the host starts', () => answer(true)));
      list.push(B('NOT YET', 'Tell the host you need a moment', () => answer(false)));
    }
  }
  panel.innerHTML = '<div class="hb-box"><div class="hb-k">THE PARTY</div><div class="hb-t">READY CHECK</div><div class="hb-d">' + line + '</div>' +
    '<div class="hb-list">' + list.map((b, i) => '<div class="hb-o' + (b.go ? '' : ' off') + (b.d === 'READY' ? ' ready' : '') + '" data-i="' + i + '"><b>' + b.t + '</b><span>' + b.d + '</span></div>').join('') + '</div>' +
    '<div class="btn hb-x" data-x="1">' + (R.host ? 'CALL IT OFF' : 'CLOSE') + '</div></div>';
  panel._list = list;
}
// host: it's on (everyone ready, or GO NOW), or called off
function endReady(go){
  const R = ready; if (!R || !R.host) return;
  ready = null;
  send({ t: 'hubready-end', id: R.id, go });
  if (go){ if (isOpen()) closeHubPanel(false); R.go(); }
}
on('hubready-ans', (m) => {
  const R = ready; if (!R || !R.host || m.id !== R.id) return;
  R.ans.set(m.from, !!m.ok);
  if (!m.ok){ S.uiDeny(); showBanner('', (templeGuests().find(p => p.slot === m.from) || { name: 'A GUEST' }).name + ' ISN\'T READY YET', 1.6); }
  if (templeGuests().every(p => R.ans.get(p.slot) === true)){ endReady(true); return; }
  if (isOpen()) renderReady();
});
// guest: asked, answering, and told how it ended
function answer(ok){
  const R = ready; if (!R || R.host || R.answered) return;
  R.answered = true;
  send({ t: 'hubready-ans', id: R.id, ok });
  if (ok){ S.uiHover(); if (isOpen()) renderReady(); }
  else { ready = null; if (isOpen()) closeHubPanel(); }
}
on('hubready', (m) => {
  if (net.role !== 'guest' || !G.hub || G.mode !== 'play') return;
  if (isOpen()) closeHubPanel(false);
  ready = { host: false, id: m.id, label: m.label, answered: false };
  S.uiHover();
  // (over whatever they're doing: a paused guest sees it when they come back)
  const show = () => { if (!ready || ready.host || ready.id !== m.id || isOpen()) return; if (!open({ name: 'READY CHECK', act: 'ready' })) setTimeout(show, 400); };
  show();
});
on('hubready-end', (m) => {
  if (net.role !== 'guest' || !ready || ready.host || ready.id !== m.id) return;
  ready = null;
  if (isOpen()) closeHubPanel(!m.go);
  if (!m.go) showBanner('', 'THE HOST CALLED IT OFF', 1.4);
});
export const readyCheck = () => ready && { host: ready.host, label: ready.label, answered: !!ready.answered };
