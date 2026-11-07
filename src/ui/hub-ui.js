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
import { RAIDS, MODS, raidMods, raidIdFor, today, nextRotationIn, raidsOpen } from '../data/raids.js';
import { benchOf } from '../data/hero-benches.js';
import { earnProgress } from '../data/saber-parts.js';
import { profileOf, raidsWon, raidWonOn } from '../game/profile.js';
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
import { zoneLock } from '../game/zone-gate.js';
import { sideWon, sideLock, ngNextTier } from '../game/profile.js';
import { tierName, NG_TIERS } from '../data/ngplus.js';
import { mapHTML, mapLayout } from './hub-map.js';
import { optHTML, listHTML, headHTML } from './hub-cards.js';
import { svgIcon } from './icons.js';
import { guidePortrait } from './hub-portrait.js';
import { pad } from '../engine/gamepad.js';
import { playerPos } from '../player/helpers.js';
import { welcomeCard, answerWelcome, guideTo, replayWelcome, replayTour, welcomeStation, setWelcomeOpener } from '../game/hub-welcome.js';
import { SHIP_WING, shipOf } from '../data/hero-ships.js';
import { galaxyPanel, galaxyPick } from './galaxy-ui.js';

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

// (each option is a card in the hero's look: ui/hub-cards.js)
// the open zones (data/zones.js): a button for each, from the mode tables and the maps
// NEW GAME+ (data/ngplus.js), once this hero has beaten the campaign: the story again at the next tier, the profile kept
const ngButton = () => { const t = ngNextTier(); return t ? [B(tierName(t), 'The story again with your rank, parts and looks · tougher foes, ' + NG_TIERS[t].muts + ' mutator' + (NG_TIERS[t].muts === 1 ? '' : 's') + ' a chapter',
  () => askParty(tierName(t), () => { G.resumeRun = null; G.ngNext = t; hubLaunch('campaign'); }))] : []; };
// ACT IV · THE SITH GATE (game/gate.js): the shared campaign after the three, for the whole party
const gateButton = () => B('ACT IV · THE SITH GATE', 'The shared campaign after the three stories, for any mix of heroes', () => askParty('ACT IV', () => hubLaunch('gate')), gateOpen() ? null : 'Beat any hero\'s campaign');
// THE RAID TABLE (data/raids.js): the raid page, at the temple's own table in the council chamber, and a button for it
// on every hub's mission table (a trooper or a Mando host takes the party to their own hub)
const raidButton = () => B('THE RAID · DARTH KHAREL', 'Act IV\'s last fight for a full party, with the day\'s modifiers and rare parts', () => setTimeout(() => open({ id: 'raid', name: 'THE RAID TABLE', act: 'raid' }), 0), raidsOpen() ? null : 'Beat Act IV');
// (each waits for the chapter that opens it, for the hero in hand: game/zone-gate.js)
// THE SHIP (data/hero-ships.js): board it from the hub's pad or hangar, first on the station that flies to Jedha
const boardButton = () => { const sh = shipOf(G.hubId); return B(sh.board, sh.boardLine + (party() ? ' · your party can board too' : ''), () => goWing(SHIP_WING)); };
const zoneButtons = () => Object.entries(ZONES).map(([k, Z]) => B('OPEN ZONE · ' + Z.place, Z.blurb, () => askParty(Z.name, () => hubLaunchZone(k)), zoneLock(k)));

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
        raidButton(),
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
      if (guest()) return s.act === 'ship' ? [boardButton(), ...options({ act: 'council' })] : options({ act: 'council' });
      if (s.act === 'bounties') return [
        B('TAKE A BOUNTY', 'A random job off the board, dealt fresh', () => hubLaunch('mission', randomArcadeId())),
        B('STORY MISSIONS', 'Choose one from the mission list', () => { hubToMenu('mode'); hubToMissions(); }),
      ];
      return [
        boardButton(),
        B(canResume() ? 'CONTINUE THE HUNT' : 'THE CAMPAIGN', canResume() ? 'Pick your story up where you left it' : '13 chapters, three acts', () => hubLaunch('campaign')),
        ...zoneButtons().map(b => ({ ...b, t: b.t.replace('OPEN ZONE · ', 'FLY TO ') })),   // (the covert's ship is its way to Jedha)
        gateButton(),
        raidButton(),
        ...ngButton(),
        B('CHALLENGE', 'A random mission, dealt fresh', () => hubLaunch('mission', randomArcadeId())),
        B('SURVIVAL', 'Endless waves, one high score', () => hubLaunch('endless'), survivalUnlocked() ? null : 'Beat the campaign as Jedi and Mando'),
      ];
    }
    // a ship to an open zone (the temple's landing platform, the citadel's gunship; the covert's own ship lists it too)
    case 'shuttle': {
      if (guest()) return [boardButton(), ...options({ act: 'council' })];
      return [boardButton(), ...zoneButtons().map(b => ({ ...b, t: b.t.replace('OPEN ZONE · ', 'FLY TO ') }))];
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
  if (station.act === 'raid') return renderRaid();
  if (station.act === 'travel') return renderMap();
  if (station.act === 'galaxy') return renderGalaxy();
  const W = hubWing(), list = options(station);
  const partyLine = party() ? '<div class="hb-party">' + (net.role === 'host' ? 'YOU ARE THE HOST · your party follows what you launch here' : 'IN A PARTY · ' + (savedName() || 'YOU')) + '</div>' : '';
  panel.innerHTML = '<div class="hb-box hb-a-' + station.act + '">' + headHTML(W.name, station.name,
      station.act === 'travel' ? curHub().travel : station.act === 'quests' ? 'Side missions: calls for help from across the galaxy, answered on the story\'s own worlds. More open up as your rank rises.' : W.blurb, partyLine) +
    listHTML(list, station.act) +
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
    '<div class="hb-list">' + extra.map((b, i) => optHTML(b, Hb.order.length + i)).join('') + '</div>' +
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

/* ---------------- THE GALAXY MAP (ui/galaxy-ui.js, data/hero-ships.js) ----------------
   On board each hero's ship: every world on a drawn map, what can be played on the one picked, and the voyages (the
   campaign, Act IV, NEW GAME+, a challenge, survival). In a party it's the lobby: who is aboard, CALL THE PARTY ABOARD
   for the host, and the usual ready check on whatever the host launches; a guest sees the same map, and JOIN. */
function renderGalaxy(again = false){
  const r = galaxyPanel({ B, guest: guest(), party: party(), askParty, gateButton, raidButton, ngButton, zoneButtons,
    rerender: () => { if (isOpen() && station && station.act === 'galaxy') renderGalaxy(true); },
    joinButton: () => coopRun.on ? B('JOIN THE PARTY', 'The host is on ' + runLabel() + '. Go in after them.', () => joinHostRun()) : null,
    everyMode: () => B('EVERY MODE', 'The full list on the title screen', () => hubToMenu('mode')),
    survival: () => B('SURVIVAL', 'Endless waves, one high score', () => askParty('SURVIVAL', () => hubLaunch('endless')), survivalUnlocked() ? null : 'Beat the campaign as Jedi and Mando'),
    campaign: () => B(canResume() ? 'CONTINUE THE CAMPAIGN' : 'THE CAMPAIGN', canResume() ? 'Pick your story up where you left it' : '13 chapters, three acts', () => askParty('THE CAMPAIGN', () => hubLaunch('campaign'))),
    challenge: () => B('CHALLENGE', 'A random mission, dealt fresh', () => askParty('A CHALLENGE', () => hubLaunch('mission', randomArcadeId()))),
    side: (id) => hubLaunch('mission', id), mission: (id) => hubLaunch('mission', id), zone: (k) => hubLaunchZone(k),
    disembark: () => goWing(shipOf(G.hubId).exit) });
  panel.innerHTML = r.html;
  panel._list = r.list;
  if (again){ const box = panel.querySelector('.hb-box'); if (box) box.classList.add('gx-again'); }   // (a world picked: the card stays put, no second rise)
}
export { galaxyPick };

/* ---------------- THE RAID TABLE (data/raids.js) ----------------
   The raid, its day of modifiers (and when the next deal comes), each hero's job in it with yours marked, who comes along
   (the squad steps in for a party of one or two), the rare parts it hands your hero and how far you are toward each, and
   BEGIN. In a party only the host begins it, with the usual ready check; a guest sees the same page. Drawn in the hero's
   own look (styles/heroes/raid.css, the --hx-* tokens). */
const HERO_TAG = { jedi: 'JEDI', mando: 'MANDALORIAN', trooper: 'ARC TROOPER' };
const escH = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function untilNext(){ const m = Math.ceil(nextRotationIn() / 60000), h = Math.floor(m / 60); return h ? h + 'h ' + (m % 60) + 'm' : m + 'm'; }
function renderRaid(){
  const R = RAIDS.kharel, day = today(), mods = raidMods(R.id, day), open_ = raidsOpen(), hero = G.hero;
  const heroes = party() ? 1 + templeGuests().length : 1, mates = R.allies[Math.min(4, heroes) - 1] || 0;
  const won = raidsWon(hero), todayDone = raidWonOn(R.id, day, hero), prof = profileOf(hero);
  const parts = benchOf(hero).flatMap(r => r.parts.filter(p => p.earn && p.earn.raids).map(p => ({ p, row: r.label, e: earnProgress(prof, p.earn) })));
  const list = [];
  if (guest()){
    if (coopRun.on) list.push(B('JOIN THE PARTY', 'The host is on ' + runLabel() + '. Go in after them.', () => joinHostRun()));
    list.push(B('THE HOST BEGINS IT', 'In a party the host starts the raid, and everyone in ' + curHub().home.toLowerCase() + ' goes in together.', null));
  } else list.push(B('BEGIN THE RAID', heroes > 1 ? heroes + ' heroes · the party goes in together' : 'Alone, with ' + mates + ' of the squad beside you', () => askParty('THE RAID', () => hubLaunch('mission', raidIdFor(R.id, day))), open_ ? null : 'Beat Act IV to open the raid table'));
  const role = (h) => { const r = R.roles[h]; return '<div class="rd-role rd-' + h + (h === hero ? ' you' : '') + '"><i>' + HERO_TAG[h] + (h === hero ? ' · YOU' : '') + '</i><b>' + r.job + '</b><span>' + escH(r.line) + '</span></div>'; };
  const part = (x) => { const got = x.e.have >= x.e.need;
    return '<div class="rd-part' + (got ? ' got' : '') + '"><i>' + escH(x.row) + '</i><b>' + escH(x.p.name) + '</b><span>' + (got ? 'YOURS' : 'WIN ' + x.e.need + ' RAID' + (x.e.need === 1 ? '' : 'S') + ' · ' + Math.min(x.e.have, x.e.need) + '/' + x.e.need) + '</span>' +
      (got ? '' : '<u><s style="width:' + Math.round(Math.min(1, x.e.have / x.e.need) * 100) + '%"></s></u>') + '</div>'; };
  panel.innerHTML = '<div class="hb-box rd-box hero-' + hero + '">' +
    '<div class="rd-head"><div class="hb-k">' + hubWing().name + ' · THE RAID TABLE</div><div class="rd-t">' + R.name + '</div>' +
      '<div class="rd-w">' + R.title + ' · ' + R.place + '</div></div>' +
    '<p class="rd-blurb">' + escH(R.blurb) + (open_ ? '' : ' <b>Beat Act IV, as any hero, to open it.</b>') + '</p>' +
    '<div class="rd-sec"><span>Today\'s modifiers</span><em>New in ' + untilNext() + (todayDone ? ' · beaten today ✓' : '') + '</em></div>' +
    '<div class="rd-mods">' + mods.map(m => '<div class="rd-mod" style="--mc:' + MODS[m].col + '"><b>' + MODS[m].name + '</b><span>' + escH(MODS[m].line) + '</span></div>').join('') + '</div>' +
    '<div class="rd-sec"><span>Every hero a job</span><em>Any hero can do any of them</em></div>' +
    '<div class="rd-roles">' + ['jedi', 'mando', 'trooper'].map(role).join('') + '</div>' +
    '<div class="rd-sec"><span>Rare parts · ' + HERO_TAG[hero] + '</span><em>' + won + ' raid' + (won === 1 ? '' : 's') + ' won</em></div>' +
    '<div class="rd-parts">' + parts.map(part).join('') + '</div>' +
    '<div class="rd-party">' + (heroes > 1 ? heroes + ' heroes in the party' + (mates ? ', and ' + mates + ' of the squad' : '') + '. He grows with the party.' : 'Alone: ' + mates + ' of the squad come with you, to hold the line and get you up.') + '</div>' +
    '<div class="hb-list rd-go">' + list.map((b, i) => '<div class="hb-o' + (b.go ? '' : ' off') + (b.lock ? ' locked' : '') + (i === 0 && b.go ? ' rd-main' : '') + '" data-i="' + i + '"><b>' + b.t + '</b><span>' + (b.lock ? 'LOCKED · ' + b.lock : b.d) + '</span></div>').join('') + '</div>' +
    '<div class="btn hb-x" data-x="1">CLOSE</div></div>';
  panel._list = list;
}

/* ---------------- THE WELCOME (game/hub-welcome.js) ----------------
   WHAT'S WHERE at any map or waystone: the guide's hello, a row for each place worth knowing and where it is, and SHOW
   ME AROUND (the walk to a few stations, ending at the first mission). The first visit itself puts up nothing like this:
   the guide speaks on the side panel and the walk just starts. */
// the card stays short: the guide's first line (the rest is said on arrival), and a tile per place: what it's for, its name
// and where (its longer line is the tile's tooltip)
const firstLine = (t) => (String(t).match(/^.*?[.!?](?=\s|$)/) || [t])[0];
const PLACE_ICON = [[/SIDE/, 'call'], [/SHIP/, 'ship'], [/MISSIONS|HUNT/, 'saga'], [/JEDHA/, 'city'], [/TRAINING/, 'target'], [/SABER|ARMOUR|KIT|GEAR/, 'forge'],
  [/RECORDS/, 'holo'], [/AROUND/, 'map'], [/BOUNT/, 'dice']];
const placeIcon = (label) => (PLACE_ICON.find(([re]) => re.test(label)) || [])[1] || 'spark';
function renderWelcome(){
  const C = welcomeCard(); if (!C){ panel.innerHTML = ''; panel._list = []; return; }
  const Hb = curHub(), L = mapLayout(Hb), p = playerPos();
  const list = [
    B('SHOW ME AROUND', 'A short walk, to your first mission', () => answerWelcome(true)),
    B('CLOSE', '', () => answerWelcome(false)),
    ...C.rows.map(r => B(r.label, r.d, () => guideTo(r.wing, r.id, r.d))),
  ];
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // the plan of the hub (ui/hub-map.js), numbers only: YOU where you stand, and a pin at each spot with the number of
  // every place there (the ship's two options share one). A pin steps aside, right, left, below, above, then further,
  // rather than sit on another or on YOU (a pin is about 7% of the plan wide)
  const pct = (wing, x, z) => { const [cx, cz] = L.at[wing] || [0, 0]; return { x: (cx + x - L.x0) / L.w * 100, y: (cz + z - L.z0) / L.h * 100 }; };
  const you = pct(G.hubWing, p.x * (L.half(G.hubWing) / (shared.arenaHalf || L.half(G.hubWing))), p.z * (L.half(G.hubWing) / (shared.arenaHalf || L.half(G.hubWing))));
  const spots = [];
  C.rows.forEach((r, i) => { const q = spots.find(s => s.wing === r.wing && Math.hypot(s.mx - r.x, s.mz - r.z) < 6); if (q) q.ps.push(i); else spots.push({ wing: r.wing, mx: r.x, mz: r.z, ps: [i] }); });
  const P = 7, ry = L.w / L.h, placed = [{ ...you, w: 1.6 }, { x: you.x, y: you.y - 5.5 * ry, w: 2.4 }];   // (the arrow, and its tag over it)
  for (const s of spots){
    const o = pct(s.wing, s.mx, s.mz), w = s.ps.length > 1 ? 1.6 : 1;
    const hit = (x, y) => placed.some(q => Math.abs(q.x - x) < P * (q.w + w) / 2 && Math.abs(q.y - y) < P * ry);
    let n = 0, x = o.x, y = o.y;
    while (hit(x, y) && n < 24){ n++; const k = Math.ceil(n / 4), d = n % 4; x = o.x + (d === 1 ? k : d === 2 ? -k : 0) * P; y = o.y + (d === 3 ? k : d === 0 ? -k : 0) * P * ry; }
    s.x = x; s.y = y; placed.push({ x, y, w });
  }
  const pin = (s) => '<i class="hw-pin' + (s.ps.length > 1 ? ' two' : '') + '" data-p="' + s.ps[0] + '" data-ps=" ' + s.ps.join(' ') + ' " style="left:' + s.x.toFixed(2) + '%;top:' + s.y.toFixed(2) + '%"><b>' + s.ps.map(i => i + 1).join('·') + '</b></i>';
  const plan = mapHTML(Hb, G.hubId, G.hubWing, { x: p.x, z: p.z, yaw: G.yaw, half: shared.arenaHalf }, () => [], () => -1)
    .replace(/<\/div>$/, spots.map(pin).join('') + '<i class="hw-you" style="left:' + you.x.toFixed(2) + '%;top:' + you.y.toFixed(2) + '%"><b>YOU</b></i></div>');
  const face = guidePortrait(C.guide);
  const tile = (r, i) => '<div class="hw-row" data-i="' + (i + 2) + '" data-p="' + i + '"><i class="hw-no">' + (i + 1) + '</i><i class="hb-ic">' + svgIcon(placeIcon(r.label)) + '</i>' +
    '<div class="hw-n">' + esc(r.label) + '<em>' + esc(r.name) + ' · ' + esc(r.where.replace(/^.* · RIGHT HERE$/, 'RIGHT HERE')) + '</em></div><em class="hb-tag go"></em></div>';
  panel.innerHTML = '<div class="hb-box hw-box"><div class="hb-k">' + esc(C.kicker) + '</div><div class="hb-t">' + esc(C.title) + '</div>' +
    '<div class="hw-say' + (face ? ' face' : '') + '">' + (face ? '<img class="hw-face" alt="" src="' + face + '">' : '') + '<div><span>' + esc(firstLine(C.hello)) + '</span><b>' + esc(C.guide) + '</b></div></div>' +
    '<div class="hw-body"><div class="hw-plan">' + plan + '<div class="hw-info">Pick a place and a light leads you there.</div></div>' +
    '<div class="hw-rows">' + C.rows.map(tile).join('') + '</div></div>' +
    '<div class="hb-list hw-go">' + list.slice(0, 2).map((b, i) => optHTML(b, i, { main: !i, cls: i ? '' : 'hw-main', ic: i ? 'door' : 'compass' })).join('') + '</div></div>';
  panel._list = list;
}
// the welcome's tiles and pins light together, and the line under the plan says what the place is for
function welcomePoint(i){
  if (!station || station.act !== 'welcome') return;
  for (const el of panel.querySelectorAll('.hw-row')) el.classList.toggle('on', el.dataset.p === String(i));
  for (const el of panel.querySelectorAll('.hw-pin')) el.classList.toggle('on', i != null && el.dataset.ps.includes(' ' + i + ' '));
  const info = panel.querySelector('.hw-info'), b = i == null ? null : panel._list[+i + 2];
  if (info) info.textContent = b ? b.d : 'Pick a place and a light leads you there.';
}
panel.addEventListener('mouseover', (e) => { const t = e.target.closest && e.target.closest('.hw-row,.hw-pin'); if (t || station && station.act === 'welcome') welcomePoint(t ? t.dataset.p : null); });
new MutationObserver((ms) => { for (const m of ms) if (m.target.classList && m.target.classList.contains('hw-row') && m.target.classList.contains('padfocus')){ welcomePoint(m.target.dataset.p); return; } })
  .observe(panel, { subtree: true, attributes: true, attributeFilter: ['class'] });
setWelcomeOpener(() => open({ name: 'WELCOME', act: 'welcome' }));
setStationOpener(open);
setHubPanelCloser(closeHubPanel);

panel.addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (e.target === panel || e.target.closest('[data-x]')){ closeHubPanel(); return; }
  const o = e.target.closest('.hb-o,.hm-wing[data-i],.hw-row[data-i],.hw-pin,.gx-w[data-i]'); if (!o) return;
  const b = panel._list[o.dataset.i != null ? +o.dataset.i : +o.dataset.p + 2];   // (a welcome pin: the place it marks)
  if (!b || !b.go){ return; }
  if (b.lock){ S.uiDeny(); o.classList.remove('shake'); void o.offsetWidth; o.classList.add('shake'); return; }
  if (ready || b.stay){ b.go(); return; }   // (the ready card's buttons keep it up, or close it themselves; a galaxy world picked just shows it)
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
  panel.innerHTML = '<div class="hb-box hb-a-ready">' + headHTML('THE PARTY', 'READY CHECK', line) +
    '<div class="hb-list">' + list.map((b, i) => optHTML(b, i, { cls: b.d === 'READY' ? 'ready' : '', main: b.go && (b.t === 'READY' || b.t === 'GO NOW'), ic: b.go ? (b.t === 'NOT YET' ? 'door' : 'check') : 'party' })).join('') + '</div>' +
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
