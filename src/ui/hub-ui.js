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
import { openKitBench, kitBenchOpen } from './kitbench.js';
import { setCodex, codexOpen } from './codex-ui.js';
import { setProfile, profileOpen } from './profile-ui.js';
import { openCodex as openForms, formsOpen } from './forms-ui.js';
import { net } from '../net/session.js';
import { coopRun } from '../net/run.js';
import { partnerWorlds } from '../net/partner.js';
import { savedName } from '../net/names.js';

const panel = document.getElementById('hubpanel');
const isOpen = () => panel.classList.contains('open');
let station = null, forging = false;
// the forge's workbench and customizer: DONE goes straight back to the forge
// (looked at a moment later: the customizer's own SABER WORKBENCH link closes it to open the bench, still at the forge)
const backToForge = () => setTimeout(() => {
  if (!forging || workbenchOpen() || kitBenchOpen()) return;
  forging = false; if (G.fromHub && G.mode === 'menu') goTemple();
}, 0);
document.addEventListener('customizer-closed', backToForge);
document.addEventListener('workbench-closed', backToForge);
document.addEventListener('kitbench-closed', backToForge);

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
        B(canResume() ? 'CONTINUE THE CAMPAIGN' : 'THE CAMPAIGN', canResume() ? 'Pick your story up where you left it' : '13 chapters, three acts', () => hubLaunch('campaign')),
        B('STORY MISSIONS', 'Choose one from the mission list', () => { hubToMenu('mode'); hubToMissions(); }),
        B('ARCADE', 'A random mission, dealt fresh', () => hubLaunch('mission', randomArcadeId())),
        B('SURVIVAL', 'Endless waves, one high score', () => hubLaunch('endless'), sv ? null : 'Beat the campaign as Jedi and Mando'),
        B('EVERY MODE', 'The full list on the title screen', () => hubToMenu('mode')),
      ];
    }
    case 'training': return [B('TRAINING GROUNDS', 'Learn the controls and powers, lesson by lesson', () => hubLaunch('training'))];
    case 'sparring': return [B('THE SANDBOX', 'Call in any foe you have met, switch any power on or off', () => hubLaunch('sandbox'), sandboxUnlocked() ? null : 'Clear Act I of the campaign')];
    case 'proving': return [B('SURVIVAL', 'Endless waves, one high score', () => hubLaunch('endless'), survivalUnlocked() ? null : 'Beat the campaign as Jedi and Mando')];
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
  const W = hubWing(), list = options(station);
  const partyLine = party() ? '<div class="hb-party">' + (net.role === 'host' ? 'YOU ARE THE HOST · your party follows what you launch here' : 'IN A PARTY · ' + (savedName() || 'YOU')) + '</div>' : '';
  panel.innerHTML = '<div class="hb-box"><div class="hb-k">' + W.name + '</div><div class="hb-t">' + station.name + '</div>' +
    '<div class="hb-d">' + (station.act === 'travel' ? 'Travel to any wing of the temple.' : W.blurb) + '</div>' + partyLine +
    '<div class="hb-list">' + list.map((b, i) => '<div class="hb-o' + (b.go ? '' : ' off') + (b.lock ? ' locked' : '') + '" data-i="' + i + '"><b>' + b.t + '</b><span>' + (b.lock ? 'LOCKED · ' + b.lock : b.d) + '</span></div>').join('') + '</div>' +
    '<div class="btn hb-x" data-x="1">CLOSE</div></div>';
  panel._list = list;
}

function open(s){
  if (!G.hub || G.mode !== 'play' || G.paused || G.skillSelect) return;
  station = s;
  G.skillSelect = true; G.sbMenu = true;   // holds the temple still and keeps the pause screen away while the cursor is free
  render(); panel.classList.add('open');
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeHubPanel(relock = true){
  if (!isOpen()) return;
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
  closeHubPanel(false);
  b.go();
  if (G.hub && G.mode === 'play' && !G.paused && !shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }   // (a wing to travel to: the lock back while the click still counts)
});
document.addEventListener('keydown', (e) => { if (isOpen() && (e.key === 'Escape' || e.key === 'Tab')){ e.preventDefault(); closeHubPanel(); } }, true);
