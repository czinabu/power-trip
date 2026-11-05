// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The temple's STATION PANEL (game/hub.js): tap F at a station and its panel opens over the temple, holding the game still
// and freeing the cursor the way the sandbox panel does. Each station lists what it does: the Temple Map and the waystones
// travel to any wing (and show who is where in co-op), the Council Table launches the modes, the Training Wing's stations
// the training grounds, the sandbox and survival, the Archives the codex, your profile and the mission records, the Saber
// Forge the saber workbench and the customizer.

import { G, shared, isGunner } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { HUB_WINGS, HUB_ORDER } from '../data/hub.js';
import { setStationOpener, goWing, hubWing, runLabel } from '../game/hub.js';
import { hubLaunch, hubToMenu, hubOpenPanel, survivalUnlocked, joinHostRun, goTemple, setHubPanelCloser } from './menus.js';
import { sandboxUnlocked } from '../game/sandbox.js';
import { canResume } from '../game/saves.js';
import { randomArcadeId } from '../data/arcade.js';
import { openMissionPage } from './missions-ui.js';
import { openCustomizer } from './customizer.js';
import { openWorkbench, workbenchOpen } from './workbench.js';
import { setCodex, codexOpen } from './codex-ui.js';
import { setProfile, profileOpen } from './profile-ui.js';
import { openCodex as openForms, formsOpen } from './forms-ui.js';
import { net, on, send } from '../net/session.js';
import { showBanner } from './banners.js';
import { coopRun } from '../net/run.js';
import { partnerWorlds } from '../net/partner.js';
import { savedName } from '../net/names.js';

const panel = document.getElementById('hubpanel');
const isOpen = () => panel.classList.contains('open');
let station = null, forging = false;
// the forge's workbench and customizer: DONE goes straight back to the forge
// (looked at a moment later: the customizer's own SABER WORKBENCH link closes it to open the bench, still at the forge)
const backToForge = () => setTimeout(() => {
  if (!forging || workbenchOpen()) return;
  forging = false; if (G.fromHub && G.mode === 'menu') goTemple();
}, 0);
document.addEventListener('customizer-closed', backToForge);
document.addEventListener('workbench-closed', backToForge);

const guest = () => net.role === 'guest' && net.status === 'connected';
const party = () => net.status === 'connected';
// a button: [label, line under it, what it does, locked reason]
const B = (t, d, go, lock) => ({ t, d, go, lock });

function options(s){
  const G_ = G;
  switch (s.act){
    case 'travel': return HUB_ORDER.map(id => {
      const W = HUB_WINGS[id], here = id === G_.hubWing;
      const who = partnerWorlds().filter(p => p.world === 'hub:' + id).map(p => p.name);
      return B(W.name, (here ? 'YOU ARE HERE' : W.blurb) + (who.length ? ' · ' + who.join(', ') : ''), here ? null : () => goWing(id));
    });
    case 'council': {
      if (guest()){
        const list = [];
        if (coopRun.on) list.push(B('JOIN THE PARTY', 'The host is on ' + runLabel() + '. Go in after them.', () => joinHostRun()));
        list.push(B('THE HOST CHOOSES', 'In a party the host picks the mission at this table, and everyone in the temple goes with them.', null));
        return list;
      }
      const sv = survivalUnlocked();
      return [
        B(canResume() ? 'CONTINUE THE CAMPAIGN' : 'THE CAMPAIGN', canResume() ? 'Pick your story up where you left it' : '13 chapters, three acts', () => askParty('THE CAMPAIGN', () => hubLaunch('campaign'))),
        B('STORY MISSIONS', 'Choose one from the mission list', () => { hubToMenu('mode'); hubToMissions(); }),
        B('ARCADE', 'A random mission, dealt fresh', () => askParty('AN ARCADE MISSION', () => hubLaunch('mission', randomArcadeId()))),
        B('SURVIVAL', 'Endless waves, one high score', () => askParty('SURVIVAL', () => hubLaunch('endless')), sv ? null : 'Beat the campaign as Jedi and Mando'),
        B('EVERY MODE', 'The full list on the title screen', () => hubToMenu('mode')),
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
  const W = hubWing(), list = options(station);
  const partyLine = party() ? '<div class="hb-party">' + (net.role === 'host' ? 'YOU ARE THE HOST · your party follows what you launch here' : 'IN A PARTY · ' + (savedName() || 'YOU')) + '</div>' : '';
  panel.innerHTML = '<div class="hb-box"><div class="hb-k">' + W.name + '</div><div class="hb-t">' + station.name + '</div>' +
    '<div class="hb-d">' + (station.act === 'travel' ? 'Travel to any wing of the temple.' : W.blurb) + '</div>' + partyLine +
    '<div class="hb-list">' + list.map((b, i) => '<div class="hb-o' + (b.go ? '' : ' off') + (b.lock ? ' locked' : '') + '" data-i="' + i + '"><b>' + b.t + '</b><span>' + (b.lock ? 'LOCKED · ' + b.lock : b.d) + '</span></div>').join('') + '</div>' +
    '<div class="btn hb-x" data-x="1">CLOSE</div></div>';
  panel._list = list;
}

function open(s){
  if (!G.hub || G.mode !== 'play' || G.paused || G.skillSelect) return false;
  station = s;
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
setStationOpener(open);
setHubPanelCloser(closeHubPanel);

panel.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (e.target === panel || e.target.closest('[data-x]')){ closeHubPanel(); return; }
  const o = e.target.closest('.hb-o'); if (!o) return;
  const b = panel._list[+o.dataset.i];
  if (!b || !b.go){ return; }
  if (b.lock){ S.uiDeny(); o.classList.remove('shake'); void o.offsetWidth; o.classList.add('shake'); return; }
  if (ready){ b.go(); return; }   // (the ready card's buttons keep it up, or close it themselves)
  closeHubPanel(false);
  b.go();
  if (G.hub && G.mode === 'play' && !G.paused && !isOpen() && !shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }   // (a wing to travel to: the lock back while the click still counts)
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
