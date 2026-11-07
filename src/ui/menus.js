// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Main menu: hero, mode and difficulty pickers (the mission list has its own page: ui/missions-ui.js), pause, restart, return to menu and fullscreen.

import { heroName, refreshWorn } from '../game/wardrobe.js';
import { renderer } from '../engine/renderer.js';
import { cycleQuality, resetQuality, FRAME_CAPS, frameCapNow, setFrameCap, autoResNow, setAutoRes, fpsCounterNow, setFpsCounter } from '../engine/quality.js';
import { audioInit, setMasterVol, setMusicVol, setSfxVol, S } from '../audio/sfx.js';
import { AE } from '../audio/engine.js';
import { shared, G, player, isGunner, isTrooper } from '../state.js';
import { applySaberGrip } from '../player/model/weapons.js';
import { setHero } from '../player/hero.js';
import { setStrafeMode } from '../player/strafe.js';
import './settings-tips.js';   // the "i" explainers on every setting
import { startLevel, retryLevel, retryIsBoss, startCoopCampaign } from '../game/flow.js';
import { coopRun } from '../net/run.js';
import { startEndless } from '../game/survival.js';
import { startTutorial, retryTutorial, skipStep, setTrainingExit, setStoryReturn, trainingDone, openLessonBoard, trainOnForm } from '../game/tutorial.js';
import { setTrainHook } from '../game/meditation.js';
import { startMission, startCoopMission, retryMission, missionTitle } from '../game/mission.js';
import { isArcadeId, randomArcadeId } from '../data/arcade.js';
import { isRaidId, parseRaidId, raidIdFor, today } from '../data/raids.js';
import { isSideId } from '../data/side-quests.js';
import { startSandbox, sandboxUnlocked } from '../game/sandbox.js';
import { battleArmed, leaveSetup } from '../game/battlesim.js';
import { sandboxFull, sandboxProgress } from '../game/sandbox-unlocks.js';
import { closeSandboxPanel } from './sandbox-ui.js';
import { missionOpen, setMission, refreshMissionMark, refreshTile, openMissionPage, closeMissionPage } from './missions-ui.js';
export { setMission };   // (ui/saves-ui.js picks a loaded save's mission through the menu)
import { closeProgress } from './store-ui.js';
import { DIFFS } from '../data/difficulty.js';
import { renderControls, toggleControlsDetail, setControlsDevice } from './controls.js';
import { svgIcon } from './icons.js';
import { enterFullscreenIfWanted, escapeIsOurs } from './fullscreen.js';
import { CFG } from '../data/config.js';
import { LEVELS } from '../data/levels.js';
import { buildArena } from '../world/arena.js';
import { findClearSpawn } from '../world/collision.js';
import { playerPos, heldGrip } from '../player/helpers.js';
import { canResume, resumeRun, resumeLabel, resumeProgress, captureRun, followHero, latestRun } from '../game/saves.js';
import { startGate, gateOpen, gateBeaten } from '../game/gate.js';
import { storyHero } from '../data/campaign.js';
import { autosave } from '../game/autosave.js';
import { startCampaign, joinCampaign, closeCard, chapterLabel, restartChapter } from '../game/campaign.js';
import { pad } from '../engine/gamepad.js';
import { openPrefight } from './forms-ui.js';
import { startZone } from '../game/zone.js';
import { ZONE_PREFIX } from '../data/zones.js';
import { loadInto, dipInto, loadingNow } from './loading.js';
import { openArmoryPrefight } from './armory-ui.js';
import { GUARD_RINGS } from '../data/guard-rings.js';
import { SABER_ASSIST } from '../data/saber-assist.js';
import { startHub, setPartyHooks, curHub, hubIdFor, keepHubSpot, forgetHubSpot } from '../game/hub.js';
import { HUBS } from '../data/hub.js';
// the temple's station panel (ui/hub-ui.js registers its closer: it imports this file, so this one can't import it)
let closeHubPanel = () => {};
export function setHubPanelCloser(fn){ closeHubPanel = fn; }

/* ============================================================
   INPUT
   ============================================================ */
export const overlay = document.getElementById('overlay');

/* OVERLAY STATE — one screen, four faces: 'menu' (first run), 'pause', 'dead', 'victory'. Each sets the headline,
   the primary button's label and which blocks show (hero/mode setup only where picking makes sense). */
let _ovState = 'menu';
let _deadAt = 0;   // when the fallen screen came up (its R to retry waits a moment)
export const isMenuState = () => _ovState === 'menu';
/* THE RESULTS SCREEN'S CHANGE PANEL — the victory screen leads with the results and the next run's actions; the mode,
   hero and difficulty pickers fold away behind one line (NEXT: CHALLENGE · ONE ON ONE · JEDI · KNIGHT   CHANGE) and open
   as the title screen's own two steps. _endPick is what was just played, so PLAY AGAIN stays PLAY AGAIN until the
   pick really changes (then the button names what it begins). */
let _endPick = null;
const pickKey = () => G.modeSel + '|' + (G.modeSel === 'mission' ? G.missionId : '');
const pickChanged = () => _endPick !== null && pickKey() !== _endPick;
export const isPickingState = () => _ovState === 'menu' || (_ovState === 'victory' && overlay.classList.contains('vpicking'));
// the menu and the results screen both follow a new pick: the headline / button and the NEXT line
export function refreshPicks(){ if (_ovState === 'menu' || _ovState === 'victory') setOverlayState(_ovState); }
function setPicking(on){
  overlay.classList.toggle('vpicking', on);
  document.getElementById('vchange').textContent = on ? 'DONE' : 'CHANGE';
  if (on){ closeMissionPage(); showMenuStep('mode'); document.getElementById('nextrun').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  else { closeMissionPage(); overlay.scrollTop = 0; }
  refreshNextRun();
}
export const DIFF_NAME = { padawan: 'GENTLE', knight: 'STANDARD', master: 'BRUTAL' };
function refreshNextRun(){
  const el = document.getElementById('nrWhat'); if (!el) return;
  const mode = G.modeSel === 'mission' ? (isArcadeId(G.missionId) ? 'CHALLENGE · ' : isSideId(G.missionId) ? 'SIDE MISSION · ' : isRaidId(G.missionId) ? 'RAID · ' : 'MISSION · ') + missionTitle(G.missionId) : STEP_NAME[G.modeSel] || 'CAMPAIGN';
  el.textContent = [mode, heroName(G.hero), DIFF_NAME[G.diff] || 'STANDARD'].join(' · ');
}
// the title screen's BEGIN label for the picked mode (its second step and the Missions page)
// the hub's name wherever the menus say it: the mode tile, the way back from a run, the co-op join button
function hubWords(){
  const next = nextHub(), back = G.fromHub && G.hubId ? HUBS[G.hubId] || next : next;
  const tile = document.getElementById('mode-temple');
  tile.querySelector('.mt').textContent = next.name; tile.querySelector('.md').textContent = next.tile;
  document.getElementById('templeBtn').textContent = 'RETURN TO ' + back.home;
  document.getElementById('stepTemple').textContent = '‹ ' + back.home.replace(/^THE /, '');
  document.getElementById('coopjointemple').textContent = 'JOIN THEM IN ' + next.home;
  if (_step === 'hero' && G.modeSel === 'temple') document.getElementById('stepMode').textContent = next.name;
}
// the hub the temple tile goes into: the picked hero's (or, for a co-op guest, the host's: game/hub.js hubIdFor)
const nextHub = () => HUBS[hubIdFor()];
const beginLabel = () => G.modeSel === 'temple' ? 'ENTER ' + nextHub().home : G.modeSel === 'endless' ? 'BEGIN SURVIVAL' : G.modeSel === 'training' ? 'BEGIN TRAINING' : G.modeSel === 'mission' ? 'BEGIN MISSION' : G.modeSel === 'sandbox' ? 'ENTER THE SANDBOX' : G.modeSel === 'campaign' && canResume() ? 'CONTINUE CAMPAIGN' : G.modeSel === 'gate' ? (gateRun() ? 'CONTINUE ACT IV' : 'BEGIN ACT IV') : 'BEGIN CAMPAIGN';
// ACT IV's own saved run for the picked hero (kept apart from the stories': game/saves.js latestRun)
const gateRun = () => latestRun(G.hero, 'gate');
/* THE TITLE SCREEN'S TWO STEPS — 'mode' (pick a mode: CAMPAIGN, MISSIONS, CO-OP...) and then 'hero' (the hero, the
   difficulty and BEGIN for that mode). MISSIONS opens its own page and CO-OP its panel straight from the first step. */
let _step = 'mode';
export const menuStep = () => _step;
const STEP_NAME = { campaign: 'CAMPAIGN', gate: 'ACT IV · THE SITH GATE', endless: 'SURVIVAL', training: 'TRAINING', sandbox: 'SANDBOX', mission: 'MISSION', temple: 'THE HIDDEN TEMPLE', zone: 'OPEN ZONE' };
export function showMenuStep(step, group = null){
  _step = step === 'hero' ? 'hero' : 'mode';
  openGroup(_step === 'mode' ? group : null);
  overlay.classList.toggle('step-mode', _step === 'mode');
  overlay.classList.toggle('step-hero', _step === 'hero');
  document.getElementById('stepMode').textContent = STEP_NAME[G.modeSel] || 'CAMPAIGN';
  if (_ovState === 'menu'){ setOverlayState('menu'); overlay.scrollTop = 0; }   // the headline and BEGIN follow the step
  else refreshPicks();   // (the results screen's CHANGE panel stays where it is)
}
/* THE MODE GROUPS — the first step is the temple on top and four entries under it (the temple steps aside while a group is open): STORY (campaign, missions),
   QUICK PLAY (challenges, the Missions page's board of random contracts; survival), FREEPLAY (sandbox, training)
   and ONLINE (the co-op tile, which opens its panel). The first three swap their short list in for the four (and the temple); ‹ BACK, Esc or the pad's B closes it again. The hero step's ‹ MODES comes back
   to the list its mode was picked from. */
let _group = null;
const GROUPS = ['story', 'arcade', 'freeplay'];
const GROUP_OF = { campaign: 'story', gate: 'story', mission: 'story', endless: 'arcade', sandbox: 'freeplay', training: 'freeplay' };
const groupOf = (m) => m === 'mission' && isArcadeId(G.missionId) ? 'arcade' : GROUP_OF[m];
export const menuGroup = () => _group;
function openGroup(g){
  const was = _group;
  _group = GROUPS.includes(g) ? g : null;
  overlay.classList.toggle('mgrp', !!_group);
  for (const k of GROUPS) overlay.classList.toggle('grp-' + k, _group === k);
  // the hub tile steps aside while a list is open (styles/menus.css), so the pad's ring is put where the eye goes:
  // on the list's picked (or first) entry when it opens, back on the group's tile when it closes
  if (_step !== 'mode' || was === _group) return;
  const to = _group ? document.querySelector('#sub-' + _group + ' .modeopt.sel') || document.querySelector('#sub-' + _group + ' .modeopt')
    : was && document.getElementById('grp-' + was);
  if (to) document.dispatchEvent(new CustomEvent('pad-focus', { detail: to }));
}
function refreshGroups(){
  const arc = G.modeSel === 'mission' && isArcadeId(G.missionId);
  for (const k of GROUPS) document.getElementById('grp-' + k).classList.toggle('sel', groupOf(G.modeSel) === k);
  document.getElementById('mode-arcade').classList.toggle('sel', arc);
  document.getElementById('mode-mission').classList.toggle('sel', G.modeSel === 'mission' && !arc);
  // STORY carries where the campaign stands, so a saved run reads from the top level
  const md = document.getElementById('grpStoryMd');
  if (md) md.textContent = canResume() ? 'Continue · ' + resumeProgress() + ' · ' + resumeLabel().replace(/^CHAPTER \d+ · /, '') : 'Campaign and missions';
}
for (const k of GROUPS) document.getElementById('grp-' + k).addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openGroup(k); });
for (const b of document.querySelectorAll('.msub-back')) b.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openGroup(null); });
// Esc (the pad's B) closes an open group first. Capture phase, registered ahead of the CHANGE panel's own Esc below
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !_group || _step !== 'mode' || !isPickingState() || overlay.style.display === 'none' || panelOpen()) return;
  if (/\b(customizing|mpage|confirming|newconfirming|exitconfirming|asktrain)\b/.test(overlay.className)) return;
  e.stopImmediatePropagation(); openGroup(null);
}, true);
/* the quiet row's buttons (settings, controls, codex, profile, roadmap) wear an icon beside their name on the title
   screen (styles/menus.css); the pause screen keeps just the words */
const BTN_ICON = { formsBtn: 'sabers', settoggle: 'gear', ctltoggle: 'pad', cxtoggle: 'book', pfBtn: 'user', wbBtn: 'wrench', rmtoggle: 'map' };
function setBtnLabel(el, text){ const l = el.querySelector('.bl'); if (l) l.textContent = text; else el.textContent = text; }
for (const id in BTN_ICON){
  const el = document.getElementById(id); if (!el) continue;
  const l = document.createElement('span'); l.className = 'bl';
  for (const n of [...el.childNodes]) if (n.nodeType === 3){ l.textContent += n.textContent; n.remove(); }
  el.insertAdjacentHTML('afterbegin', svgIcon(BTN_ICON[id], 'bi'));
  el.querySelector('.bi').after(l);
  el.classList.add('icbtn');
}
export function setOverlayState(state){
  if (state === 'victory' && _endPick === null) _endPick = pickKey();   // a fresh results screen: what was just played
  if (state !== 'victory'){ _endPick = null; overlay.classList.remove('vpicking'); }
  _ovState = state;
  hubWords(); refreshGroups(); refreshContinue(state);
  overlay.classList.remove('st-menu', 'st-pause', 'st-dead', 'st-victory', 'confirming', 'newconfirming', 'exitconfirming');
  overlay.classList.add('st-' + state);
  document.body.classList.toggle('in-menu', state === 'menu');
  document.getElementById('banner').style.opacity = '0';   // the overlay carries the message; don't let a banner ghost through it
  overlay.classList.remove('asktrain');
  if (state === 'menu') refreshWorn();   // back on the menu: dressed in whatever the campaign has unlocked since (ui/customizer.js)
  if (state !== 'pause') document.getElementById('ovctx').textContent = '';
  document.getElementById('restartBtn').style.display = state === 'menu' || G.hub ? 'none' : 'inline-flex';
  document.getElementById('templeBtn').style.display = state !== 'menu' && G.fromHub && !G.hub ? 'inline-flex' : 'none';   // a run started from the temple goes back to it
  document.getElementById('stepTemple').style.display = state === 'menu' && G.fromHub ? '' : 'none';
  document.getElementById('restartBtn').textContent = G.chapter >= 0 && state !== 'victory' ? '↻ RESTART CHAPTER' : state === 'pause' ? '↻ RESTART' : G.training ? '↻ RESTART TRAINING' : G.mission && G.chapter < 0 ? (isArcadeId(G.missionId) && state === 'victory' ? '↻ PLAY IT AGAIN' : '↻ RESTART MISSION') : '↻ RESTART RUN';
  document.getElementById('skipBtn').style.display = state === 'pause' && G.training ? 'inline-flex' : 'none';
  document.getElementById('lessonsBtn').style.display = state === 'pause' && G.training ? 'inline-flex' : 'none';
  document.getElementById('pzTrain').style.display = state === 'pause' && G.training ? '' : 'none';   // the pause screen's TRAINING label
  document.getElementById('formsBtn').style.display = '';   // (on the menu styles/menus.css hides it for any hero but the Jedi, as the hero changes)
  setBtnLabel(document.getElementById('formsBtn'), state === 'menu' ? 'MASTERY' : G.hero === 'mando' || G.hero === 'trooper' ? 'ARMORY' : 'FORMS & MASTERY');   // the Jedi's forms page with the Force and mastery (ui/forms-ui.js), the gunners' guns, their moves and mastery (ui/armory-ui.js)
  const go = document.getElementById('goText'), sub = document.getElementById('ovsub');
  const firstStep = _step === 'mode' && !overlay.classList.contains('mpage');   // (the Missions page opens from the first step and names its mission)
  if (state === 'menu' && G.modeSel === 'campaign' && canResume()){   // a loaded save picks the campaign up where it was
    go.textContent = 'CONTINUE CAMPAIGN'; sub.textContent = firstStep ? 'CHOOSE YOUR LEGEND' : resumeLabel();
  } else if (state === 'menu' && firstStep){
    go.textContent = 'BEGIN'; sub.textContent = 'CHOOSE YOUR LEGEND';
  } else if (state === 'menu'){
    go.textContent = beginLabel();
    sub.textContent = G.modeSel === 'temple' ? nextHub().place + ' · GATHER YOUR PARTY' : G.modeSel === 'endless' ? 'HOW LONG CAN YOU HOLD?' : G.modeSel === 'training' ? 'LEARN THE CONTROLS AND POWERS' : G.modeSel === 'mission' ? (missionOpen(G.missionId) ? missionTitle(G.missionId) : 'LOCKED MISSION') : G.modeSel === 'sandbox' ? (sandboxFull() ? 'ANY FOE, ANY POWER' : 'THE STORY SO FAR') : G.modeSel === 'gate' ? 'ANY HEROES, ONE GATE' : 'CHOOSE YOUR LEGEND';
  } else if (state === 'pause'){
    go.textContent = 'RESUME'; sub.textContent = 'PAUSED';
    const where = G.hub ? curHub().name + ' · ' + ((shared.arenaLevel && shared.arenaLevel.name.split('—')[1]) || '').trim() : G.chapter >= 0 ? (storyHero() === 'gate' ? 'ACT IV · ' : 'CAMPAIGN · ') + chapterLabel() : G.training ? 'TRAINING' : G.sandbox ? 'SANDBOX' : G.mission ? (isArcadeId(G.missionId) ? 'CHALLENGE · ' : isRaidId(G.missionId) ? 'RAID · ' : '') + missionTitle(G.missionId) : G.endless ? 'SURVIVAL' : 'CAMPAIGN';
    document.getElementById('ovctx').textContent = where + ' · ' + heroName(G.hero);
  } else if (state === 'dead'){
    go.textContent = G.endless ? 'NEW SURVIVAL RUN' : G.mission ? 'RETRY THIS OBJECTIVE' : G.sandbox ? (battleArmed() ? 'REPLAY THE BATTLE' : 'BACK TO THE SANDBOX') : retryIsBoss() ? 'RETRY THE BOSS' : G.chapter >= 0 ? 'RETRY THIS CHAPTER' : 'RETRY THIS LEVEL';
    sub.textContent = pad.active ? '' : 'PRESS R TO RETRY';   // (the run summary's own title carries the moment; R is the quick way back: below)
    _deadAt = performance.now();
  } else if (state === 'victory'){
    go.textContent = pickChanged() ? beginLabel()   // a new pick from CHANGE: name what it begins
      : G.mission && G.chapter < 0 && isArcadeId(G.missionId) && !G.coopWasGuest ? 'NEXT RANDOM MISSION' : 'PLAY AGAIN';   // the arcade deals another (beginPlay)
    document.getElementById('nextrun').style.display = G.coopWasGuest ? 'none' : '';   // (a co-op guest follows the host's pick)
    refreshNextRun();
  }
  queueFit();
}

/* FIT THE MENU — the title screen's column always fits the window without scrolling: when the window is too short for
   it (a laptop screen, the Missions page, the customizer's rows), the whole column is scaled down to fit. Other
   screens scroll as before. */
let _fitQueued = false;
function queueFit(){ if (!_fitQueued){ _fitQueued = true; requestAnimationFrame(fitMenu); } }
function fitMenu(){
  _fitQueued = false;
  const inner = overlay.querySelector('.ov-inner');
  inner.style.zoom = '';
  if (_ovState !== 'menu') return;
  const z = Math.min(1, (window.innerHeight - 10) / inner.offsetHeight);
  if (z < 0.995) inner.style.zoom = Math.max(0.55, z).toFixed(3);
}
window.addEventListener('resize', queueFit);
new MutationObserver(queueFit).observe(overlay, { attributes: true, attributeFilter: ['class'] });   // customizing on and off

/* CONTINUE — the title screen's first tile, when this save file has somewhere to go back to: one click puts you where you
   left off. What was last played from the title (the campaign, Act IV or the hub; a run started from the hub counts as
   the hub, since that is where it comes back to) is kept per save file. It skips the Forms page and the training offer:
   the run's own loadout is already saved, as RESUME and a retry do. */
const LAST_PLAY = 'sw_last_play';
function noteLastPlay(){
  const m = G.fromHub || G.modeSel === 'temple' ? 'temple' : G.modeSel === 'campaign' || G.modeSel === 'gate' ? G.modeSel : null;
  if (m) try { localStorage.setItem(LAST_PLAY, m); } catch(e){}
}
function continueTarget(){
  let last = null; try { last = localStorage.getItem(LAST_PLAY); } catch(e){}
  if (last === 'gate' && gateOpen() && gateRun()) return 'gate';
  if (last === 'temple') return 'temple';
  if (canResume()) return 'campaign';
  return null;
}
function refreshContinue(state = _ovState){
  const el = document.getElementById('mode-continue'); if (!el) return;
  const to = state === 'menu' && G.mode === 'menu' && !G.coopJoin ? continueTarget() : null;
  el.hidden = !to;
  if (!to) return;
  document.getElementById('contMd').textContent = to === 'temple' ? 'Back to ' + nextHub().name + ' · ' + heroName(G.hero)
    : to === 'gate' ? 'Act IV · ' + resumeProgressOf(gateRun())
    : (resumeProgress() + ' · ' + resumeLabel().replace(/^CHAPTER \d+ · /, '') + ' · ' + heroName(G.hero)).split(' · ').filter((w, i, a) => w !== a[i - 1]).join(' · ');   // ('PROLOGUE · PROLOGUE' said once)
}
document.getElementById('mode-continue').addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  const to = continueTarget(); if (!to) return refreshContinue();
  if (to === 'campaign') pickUpSavedRun();
  if (!setModeSel(to)) return;
  G.missionKit = null;
  launch();
});
document.addEventListener('campaignmark', () => refreshContinue());   // (the hero or the saved run changed)
function beginPlay(){
  overlay.style.display = 'none';
  document.getElementById('banner').style.opacity = '0';
  // leaving the end screen → re-arm the summary for the next run
  if (G.stats){ G.stats._ended = false; G.stats.summary = null; }
  document.getElementById('runsummary').style.display = 'none';
  const repick = pickChanged();   // (read before the results screen lets go of what was played)
  _endPick = null; overlay.classList.remove('vpicking');
  document.body.classList.remove('in-menu');
  setHowTo(false); setSettings(false);
  if (G.modeSel === 'mission' && !G.coopJoin && !missionOpen(G.missionId)) G.modeSel = 'campaign';   // a locked mission never launches
  if ((G.modeSel === 'endless' && !survivalUnlocked() && !G.coopJoin) || (G.modeSel === 'sandbox' && !sandboxUnlocked()) || (G.modeSel === 'gate' && !gateOpen() && !G.coopJoin)) G.modeSel = 'campaign';   // safety — never launch a locked mode
  if (G.mode === 'victory' && !repick && G.modeSel === 'mission' && isArcadeId(G.missionId) && !G.coopJoin && !G.coopWasGuest) setMission(randomArcadeId());   // ARCADE: a won contract's PLAY AGAIN is the next random one
  if (G.modeSel === 'mission' && isRaidId(G.missionId) && !G.coopJoin && !G.coopWasGuest){ const r = parseRaidId(G.missionId); if (r && r.day !== today()) setMission(raidIdFor(r.raid)); }   // a RAID played again is today's rotation
  // a new run (or a retry) builds its level behind the loading screen (ui/loading.js): the screen paints first, then the
  // build, which holds the page for a moment. The sim stays held until it's in; backing out to the menu meanwhile skips it
  const from = G.mode, stillWanted = () => G.mode === from && overlay.style.display !== 'flex';
  if (G.mode === 'menu' || G.mode === 'victory'){
    G.paused = true;
    if (G.mode === 'menu' && !G.coopJoin) noteLastPlay();
    loadInto(() => {
      G.mode = 'play'; G.slowmo = 1;
      if (G.modeSel === 'temple'){ startHub(G.hubWing); G.paused = false; return; }   // the hub: the hero's own (game/hub.js)
      G.hub = false; forgetHubSpot();   // (a run: coming back from it is a fresh arrival, not the spot left for it)
      if (G.modeSel === 'zone'){ startZone(G.zoneSel, { guest: G.coopJoin }); G.paused = false; return; }   // an open zone (game/zone.js), alone or after the host
      if (G.coopJoin && G.modeSel === 'mission') startCoopMission(G.missionId);
      else if (G.coopJoin && G.modeSel === 'campaign'){ if (coopRun.ch >= 0){ G.storyHero = coopRun.sh || null; G.ngPlus = coopRun.ng | 0; joinCampaign(coopRun.ch, coopRun.a2, coopRun.w, coopRun.wt); } else startCoopCampaign(coopRun.lv, coopRun.w, coopRun.wt); }
      else if (G.modeSel === 'endless') startEndless(); else if (G.modeSel === 'training') startTutorial(); else if (G.modeSel === 'mission') startMission(G.missionId); else if (G.modeSel === 'sandbox') startSandbox(); else if (G.modeSel === 'gate') beginGate(); else if (canResume() && G.ngNext == null) resumeRun(); else startCampaign();   // (NEW GAME+ armed: a fresh run at its tier, game/campaign.js)
      G.paused = false;   // unfreeze the sim on entering play
    }, stillWanted);
  } else if (G.mode === 'dead'){
    G.paused = true;
    // the same map again: a quick dip to black, not the loading screen (ui/loading.js dipInto)
    dipInto(() => {
      G.mode = 'play'; G.slowmo = 1;
      if (G.zone) startZone(G.zone); else if (G.endless) startEndless(); else if (G.training) retryTutorial(); else if (G.mission) retryMission(); else if (G.sandbox) startSandbox({ replay: true }); else retryLevel();   // survival retry = a fresh survival run
      G.paused = false;
    }, stillWanted);
  } else {
    if (G.mode === 'play') overlay.style.display = 'none';  // resume from pause
    G.paused = false;   // unfreeze the sim on (re)entering play
  }
}
// hero picker — select only (don't ignite); the player clicks elsewhere / GO to launch
document.getElementById('hero-jedi').addEventListener('click', (e) => { e.stopPropagation(); setHero('jedi'); heroPicked(); });
document.getElementById('hero-mando').addEventListener('click', (e) => { e.stopPropagation(); setHero('mando'); heroPicked(); });
document.getElementById('hero-trooper').addEventListener('click', (e) => { e.stopPropagation(); setHero('trooper'); heroPicked(); });
// a hero picked on the title screen brings back that hero's own saved run (game/saves.js followHero), so the campaign
// tile and CONTINUE CAMPAIGN follow the pick
export function heroPicked(){
  if (G.mode === 'menu' && !G.coopJoin){ followHero(); refreshCampaignMark(); refreshPicks(); }
  refreshMissionMark(); refreshNextRun();
}
// mode picker — campaign vs survival
// SURVIVAL is LOCKED until the campaign has been cleared as BOTH heroes (any difficulty).
export function survivalUnlocked(){ try { return localStorage.getItem('sw_camp_jedi') === '1' && localStorage.getItem('sw_camp_mando') === '1'; } catch(e){ return false; } }
export function refreshSurvivalLock(){
  const el = document.getElementById('mode-endless'); if (!el) return;
  const un = survivalUnlocked(), md = el.querySelector('.md');
  el.classList.toggle('locked', !un);
  if (md){
    if (un){ md.textContent = 'Endless waves, one high score'; el.title = ''; }
    else { const j = localStorage.getItem('sw_camp_jedi') === '1', m = localStorage.getItem('sw_camp_mando') === '1';
      // what's left to do, not a row of red crosses: a LOCKED tag and the one line that opens it
      md.innerHTML = lockTag() + (j && !m ? 'Now beat the campaign as the Mando' : m && !j ? 'Now beat the campaign as the Jedi' : 'Beat the campaign as Jedi and Mando');
      el.title = 'Survival unlocks once you have beaten the campaign with both heroes'; }
  }
}
const lockTag = () => '<span class="lockt">' + svgIcon('lock', 'lk') + 'LOCKED</span>';
// SANDBOX is LOCKED until Act I of the campaign has been cleared with either hero, then offers the story so far, and
// everything once the campaign is beaten (game/sandbox-unlocks.js)
export function refreshSandboxLock(){
  const el = document.getElementById('mode-sandbox'); if (!el) return;
  const un = sandboxUnlocked(), full = un && sandboxFull(), md = el.querySelector('.md');
  el.classList.toggle('locked', !un);
  if (md) md.innerHTML = full ? 'Any foe, any power' : un ? 'The story so far · ' + sandboxProgress().n + '/' + sandboxProgress().of : lockTag() + 'Clear Act I of the campaign';
  el.title = full ? '' : un ? 'The foes, powers and forms you have met in the campaign. Beat it to open everything'
                            : 'The sandbox unlocks once you have cleared Act I of the campaign with either hero';
}
// ACT IV: its saved run for this hero, else a new one (the story's run waiting on the menu is put back after: followHero)
function beginGate(){
  const run = gateRun();
  if (!run) return void startGate();
  G.resumeRun = run; resumeRun();
}
// ACT IV · THE SITH GATE is LOCKED until any one hero's campaign is beaten (game/gate.js)
export function refreshGateLock(){
  const el = document.getElementById('mode-gate'); if (!el) return;
  const un = gateOpen(), md = el.querySelector('.md'), run = un && gateRun();
  el.classList.toggle('locked', !un);
  if (md) md.innerHTML = !un ? lockTag() + 'Beat any hero\'s campaign' : run ? 'Continue · ' + resumeProgressOf(run) : 'Any 1 to 4 heroes, five chapters' + (gateBeaten() ? ' · <span class="ok">✓</span> beaten' : '');
  el.title = un ? 'The shared campaign after the three stories, for any mix of heroes' : 'Act IV opens once you have beaten the campaign with any hero';
}
const resumeProgressOf = (run) => { const was = G.resumeRun; G.resumeRun = run; try { return resumeProgress() + ' · ' + resumeLabel().replace(/^CHAPTER \d+ · /, ''); } finally { G.resumeRun = was; } };
export function setModeSel(m){
  if ((m === 'endless' && !survivalUnlocked()) || (m === 'sandbox' && !sandboxUnlocked()) || (m === 'gate' && !gateOpen())){   // can't pick a locked mode
    S.uiDeny();
    const el = document.getElementById('mode-' + m); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    return false;
  }
  G.modeSel = m;
  for (const k of ['campaign', 'gate', 'mission', 'endless', 'training', 'sandbox', 'temple']) document.getElementById('mode-' + k).classList.toggle('sel', m === k);
  document.getElementById('setup').classList.toggle('camp', m === 'campaign');
  refreshTile(); refreshGroups();
  document.dispatchEvent(new Event('campaignmark'));   // (the NEW GAME+ button follows the mode: ui/saves-ui.js)
  document.getElementById('stepMode').textContent = m === 'temple' ? nextHub().name : STEP_NAME[m] || 'CAMPAIGN';
  refreshPicks();   // headline + button follow the mode
  return true;
}
// a mode tile picks the mode and moves on to the hero step (a locked one shakes and stays put)
for (const m of ['campaign', 'gate', 'endless', 'training', 'sandbox', 'temple'])
  document.getElementById('mode-' + m).addEventListener('click', (e) => { e.stopPropagation(); audioInit(); if (m === 'campaign') pickUpSavedRun(); if (setModeSel(m)) showMenuStep('hero'); });
// CAMPAIGN on the title screen opens on CONTINUE CAMPAIGN whenever the picked hero has a saved run: a run played from the
// menu is used up as it starts (game/saves.js resumeRun), so back on the menu that hero's newest save is put back first
function pickUpSavedRun(){
  if (G.mode !== 'menu' || G.coopJoin) return;
  followHero();
  refreshCampaignMark(); refreshMissionMark(); refreshNextRun();
}
document.getElementById('mode-mission').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('mission'); openMissionPage(false); refreshGroups(); });   // its own page: ui/missions-ui.js
// ARCADE: the same page with only the board of random contracts
document.getElementById('mode-arcade').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setModeSel('mission'); openMissionPage(true); refreshGroups(); });
// back to the modes: the ‹ MODES button, Esc, or the pad's B (engine/gamepad.js). Runs in the capture phase so it sees the
// screen before Esc closes the customizer or a panel on top of it (then that Esc is theirs, not a step back)
document.getElementById('vchange').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setPicking(!overlay.classList.contains('vpicking')); });
document.getElementById('stepBack').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); showMenuStep('mode', groupOf(G.modeSel)); });
window.addEventListener('keydown', (e) => {
  const picking = _ovState === 'victory' && overlay.classList.contains('vpicking');
  // the results screen's CHANGE panel on its first step: Esc (the pad's B) folds it away again, back to the results
  if (e.key === 'Escape' && picking && _step === 'mode' && overlay.style.display !== 'none' && !panelOpen() && !/\bmpage\b/.test(overlay.className)){ setPicking(false); return; }
  if (e.key !== 'Escape' || _step !== 'hero' || (_ovState !== 'menu' && !picking) || overlay.style.display === 'none' || panelOpen()) return;
  if (/\b(customizing|mpage)\b/.test(overlay.className) || (G.mode !== 'menu' && !picking)) return;
  showMenuStep('mode', groupOf(G.modeSel));
}, true);
// the hero step names what the picked hero does, under the three name plates
{ const bio = document.getElementById('herobio'), cards = document.getElementById('heroselect');
  const fill = () => { const sel = cards.querySelector('.herocard.sel .hd'); bio.innerHTML = sel ? sel.innerHTML : ''; };
  new MutationObserver(fill).observe(cards, { subtree: true, attributes: true, attributeFilter: ['class'] });
  fill(); }
// CO-OP is a tile but not a mode: it opens the room panel (ui/coop-ui.js)
// MISSIONS: the mode tile opens the Missions page (ui/missions-ui.js); the picked mission is remembered
{ let id; try { id = localStorage.getItem('sw_mission'); } catch(e){} setMission(id || G.missionId); }
refreshSurvivalLock(); refreshSandboxLock(); refreshGateLock(); refreshCampaignMark();
// CAMPAIGN shows how far this hero's saved run is, else the shape of the story
function refreshCampaignMark(){
  const md = document.querySelector('#mode-campaign .md'); if (!md) return;
  const done = localStorage.getItem('sw_camp_' + G.hero) === '1';
  md.innerHTML = canResume() ? resumeProgress() + ' · ' + resumeLabel().replace(/^CHAPTER \d+ · /, '')
               : '13 chapters, three acts' + (done ? ' · <span class="ok">✓</span> beaten' : '');
  refreshGroups();
  document.dispatchEvent(new Event('campaignmark'));   // (the NEW GAME+ button follows the hero: ui/saves-ui.js)
}
// TRAINING marks which heroes have finished it
function refreshTrainingMark(){
  const md = document.querySelector('#mode-training .md'); if (!md) return;
  const j = trainingDone('jedi'), m = trainingDone('mando');
  md.innerHTML = (j || m) ? 'Jedi ' + (j ? '<span class="ok">✓</span>' : '–') + ' · Mando ' + (m ? '<span class="ok">✓</span>' : '–')
                          : 'Learn the controls and powers';
}
refreshTrainingMark();
// FIRST CAMPAIGN — once, a hero who hasn't trained (or beaten the campaign) is offered the training grounds first
function shouldOfferTraining(){
  if (_ovState !== 'menu' || G.modeSel !== 'campaign' || trainingDone(G.hero) || canResume()) return false;
  try { return localStorage.getItem('sw_asktrain') !== '1' && localStorage.getItem('sw_camp_' + G.hero) !== '1'; } catch(e){ return false; }
}
export function setDiff(d){
  G.diff = d; try { localStorage.setItem('sw_diff', d); } catch(e){}
  for (const k in DIFFS) document.getElementById('diff-' + k).classList.toggle('sel', k === d);
  refreshNextRun();
}
for (const k in DIFFS) document.getElementById('diff-' + k).addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setDiff(k); });
setDiff(localStorage.getItem('sw_diff') || 'knight');
// SWING HANDEDNESS — some players find the directional cut more natural mirrored (strafe-L sweeps right, strafe-R
// sweeps left); a pure preference toggle, not a balance change. Persists like difficulty/graphics.
function setSwingMirror(on){
  G.swingMirror = on; try { localStorage.setItem('sw_swingmirror', on ? '1' : '0'); } catch(e){}
  const sv = document.getElementById('swingval'); if (sv) sv.textContent = on ? 'MIRRORED' : 'NORMAL';
}
setSwingMirror(localStorage.getItem('sw_swingmirror') === '1');
document.getElementById('swingctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setSwingMirror(!G.swingMirror); });
// AIM HINT — the Jedi's crosshair turns red when it is on a foe (ui/hud.js); on by default, off for a challenge
function setAimHint(on){
  G.aimHint = on; try { localStorage.setItem('sw_aimhint', on ? '1' : '0'); } catch(e){}
  const v = document.getElementById('aimhintval'); if (v) v.textContent = on ? 'ON' : 'OFF';
}
{ let v; try { v = localStorage.getItem('sw_aimhint'); } catch(e){} setAimHint(v !== '0'); }
document.getElementById('aimhintctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setAimHint(!G.aimHint); });
// GUARD RINGS — a duellist's guard crescent: fading as you learn to read the blade, always, or off (enemies/guardcue.js)
function setGuardRings(m){
  G.guardRings = GUARD_RINGS.modes.includes(m) ? m : 'fading';
  try { localStorage.setItem('sw_guardrings', G.guardRings); } catch(e){}
  const v = document.getElementById('guardringval'); if (v) v.textContent = G.guardRings.toUpperCase();
}
{ let v; try { v = localStorage.getItem('sw_guardrings'); } catch(e){} setGuardRings(v); }
document.getElementById('guardringctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); const M = GUARD_RINGS.modes; setGuardRings(M[(M.indexOf(G.guardRings) + 1) % M.length]); });
// STRAFE — ALT toggles strafe on and off (the default), or strafes only while held (player/strafe.js)
setStrafeMode(localStorage.getItem('sw_strafemode') || 'toggle');
document.getElementById('strafectl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setStrafeMode(G.strafeMode === 'hold' ? 'toggle' : 'hold'); });
// CUT AIM — the keys pick the cut's angle (the default), or a mouse flick just before the press does (player/jedi/cutaim.js).
// (sw_cutaim, not the old sw_cutmouse: that one was saved as MOUSE on every load while mouse was the default.)
function setCutMouse(on){
  G.cutMouse = on; try { localStorage.setItem('sw_cutaim', on ? 'mouse' : 'keys'); } catch(e){}
  const v = document.getElementById('cutaimval'); if (v) v.textContent = on ? 'MOUSE' : 'KEYS';
}
setCutMouse(localStorage.getItem('sw_cutaim') === 'mouse');
document.getElementById('cutaimctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setCutMouse(!G.cutMouse); });
// SABER ASSIST — the per-cut aim assist: LOW (the default), NORMAL or OFF (data/saber-assist.js, player/jedi/saberassist.js)
function setSaberAssist(m){
  G.saberAssist = SABER_ASSIST.modes.includes(m) ? m : 'low';
  try { localStorage.setItem('sw_saberassist', G.saberAssist); } catch(e){}
  const v = document.getElementById('assistval'); if (v) v.textContent = G.saberAssist.toUpperCase();
}
{ let v; try { v = localStorage.getItem('sw_saberassist'); } catch(e){} setSaberAssist(v); }
document.getElementById('assistctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); const M = SABER_ASSIST.modes; setSaberAssist(M[(M.indexOf(G.saberAssist) + 1) % M.length]); });
// SABER GRIP — regular or reverse grip for Niman (and the Mando); a look preference, swings hit the same either way.
// The other forms hold their own grip (data/forms.js): Shien reverse, the rest forward
export function setSaberGrip(grip){
  G.saberGrip = grip === 'reverse' ? 'reverse' : 'regular';
  try { localStorage.setItem('sw_sabergrip', G.saberGrip); } catch(e){}
  applySaberGrip(player, heldGrip(), G.mode !== 'play');
  const gv = document.getElementById('gripval'); if (gv) gv.textContent = G.saberGrip.toUpperCase();
}
setSaberGrip(localStorage.getItem('sw_sabergrip') || 'regular');
document.getElementById('gripctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setSaberGrip(G.saberGrip === 'reverse' ? 'regular' : 'reverse'); });
// SETTINGS sliders — mouse sensitivity + master volume. stopPropagation on both click & pointerdown so dragging
// the thumb never bubbles into the overlay's click-to-resume/launch handler.
function setMouseSens(v){
  G.mouseSens = Math.max(0.4, Math.min(2.2, v));
  try { localStorage.setItem('sw_sens', G.mouseSens); } catch(e){}
  const sv = document.getElementById('sensval'); if (sv) sv.textContent = G.mouseSens.toFixed(2) + '×';
  const sl = document.getElementById('senssl'); if (sl && +sl.value !== G.mouseSens) sl.value = G.mouseSens;
}
setMouseSens(parseFloat(localStorage.getItem('sw_sens')) || 1);
// SCOPE SENSITIVITY — mouse look while the disruptor is scoped in (engine/input.js), a share of the normal one
function setAdsSens(v){
  G.adsSens = Math.max(0.1, Math.min(1, isNaN(v) ? 0.4 : v));
  try { localStorage.setItem('sw_adssens', G.adsSens); } catch(e){}
  const sv = document.getElementById('adsval'); if (sv) sv.textContent = Math.round(G.adsSens * 100) + '%';
  const sl = document.getElementById('adssl'); if (sl && +sl.value !== G.adsSens) sl.value = G.adsSens;
}
{ let v; try { v = parseFloat(localStorage.getItem('sw_adssens')); } catch(e){} setAdsSens(v); }
// CONTROLLER — right-stick look speed and up/down invert (engine/gamepad.js)
function setPadSens(v){
  G.padSens = Math.max(0.4, Math.min(2.2, isNaN(v) ? 1 : v));
  try { localStorage.setItem('sw_padsens', G.padSens); } catch(e){}
  const sv = document.getElementById('padval'); if (sv) sv.textContent = G.padSens.toFixed(2) + '×';
  const sl = document.getElementById('padsl'); if (sl && +sl.value !== G.padSens) sl.value = G.padSens;
}
{ let v; try { v = parseFloat(localStorage.getItem('sw_padsens')); } catch(e){} setPadSens(v); }
function setPadInvert(on){
  G.padInvert = on;
  try { localStorage.setItem('sw_padinv', on ? '1' : '0'); } catch(e){}
  const sv = document.getElementById('padinvval'); if (sv) sv.textContent = on ? 'ON' : 'OFF';
}
{ let v; try { v = localStorage.getItem('sw_padinv'); } catch(e){} setPadInvert(v === '1'); }
document.getElementById('padinvctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setPadInvert(!G.padInvert); });
// CONTROLLER AIM ASSIST for the blasters (player/aim-assist.js): on by default
function setPadAssist(on){
  G.padAssist = on;
  try { localStorage.setItem('sw_padassist', on ? '1' : '0'); } catch(e){}
  const sv = document.getElementById('padassistval'); if (sv) sv.textContent = on ? 'ON' : 'OFF';
}
{ let v; try { v = localStorage.getItem('sw_padassist'); } catch(e){} setPadAssist(v !== '0'); }
document.getElementById('padassistctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setPadAssist(!G.padAssist); });
{ const sl = document.getElementById('padsl');
  sl.addEventListener('pointerdown', (e) => e.stopPropagation());
  sl.addEventListener('click', (e) => e.stopPropagation());
  sl.addEventListener('input', (e) => setPadSens(parseFloat(e.target.value))); }
// SABER FINISHERS — the killing blow's slow-motion dip and the camera's push in (player/jedi/finisher.js, engine/camera.js)
function setFinToggle(key, on){
  G[key] = on;
  try { localStorage.setItem('sw_' + key, on ? '1' : '0'); } catch(e){}
  const sv = document.getElementById(key.toLowerCase() + 'val'); if (sv) sv.textContent = on ? 'ON' : 'OFF';
}
// (and THE KILL CAM: a big kill's cinematic shot, engine/killcam.js)
for (const [key, id] of [['finSlow', 'finslowctl'], ['finCam', 'fincamctl'], ['killCam', 'killcamctl']]){
  let v; try { v = localStorage.getItem('sw_' + key); } catch(e){}
  setFinToggle(key, v !== '0');
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setFinToggle(key, !G[key]); });
}
// COMPASS — the strip along the top of the HUD (ui/compass.js)
function setCompass(on){
  G.compass = on; try { localStorage.setItem('sw_compass', on ? '1' : '0'); } catch(e){}
  const sv = document.getElementById('compassval'); if (sv) sv.textContent = on ? 'ON' : 'OFF';
}
{ let v; try { v = localStorage.getItem('sw_compass'); } catch(e){} setCompass(v !== '0'); }
document.getElementById('compassctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setCompass(!G.compass); });
// MINIMAP — the corner map in an open zone (ui/zone-map.js); the full map on M is there either way
function setMinimap(on){
  G.minimap = on; try { localStorage.setItem('sw_minimap', on ? '1' : '0'); } catch(e){}
  const sv = document.getElementById('minimapval'); if (sv) sv.textContent = on ? 'ON' : 'OFF';
}
{ let v; try { v = localStorage.getItem('sw_minimap'); } catch(e){} setMinimap(v !== '0'); }
document.getElementById('minimapctl').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setMinimap(!G.minimap); });
// SKY BATTLE — how much of the trailer layer over the war beyond the walls plays (world/skywar.js)
const SKYWAR = ['auto', 'full', 'light', 'off'];
function setSkywar(v){
  G.skywar = SKYWAR.includes(v) ? v : 'auto';
  try { localStorage.setItem('sw_skywar', G.skywar); } catch(e){}
  const sv = document.getElementById('skywarval'); if (sv) sv.textContent = G.skywar.toUpperCase();
}
{ let v; try { v = localStorage.getItem('sw_skywar'); } catch(e){} setSkywar(v); }
document.getElementById('skywarctl')?.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); setSkywar(SKYWAR[(SKYWAR.indexOf(G.skywar) + 1) % SKYWAR.length]); });
// SCREEN SHAKE — scales every camera shake, roll and hit kick (0 turns them off)
function setShakeScale(v){
  G.shakeScale = Math.max(0, Math.min(1.5, isNaN(v) ? 1 : v));
  try { localStorage.setItem('sw_shake', G.shakeScale); } catch(e){}
  const sv = document.getElementById('shakeval'); if (sv) sv.textContent = G.shakeScale ? Math.round(G.shakeScale * 100) + '%' : 'OFF';
  const sl = document.getElementById('shakesl'); if (sl && +sl.value !== G.shakeScale) sl.value = G.shakeScale;
}
{ let v; try { v = parseFloat(localStorage.getItem('sw_shake')); } catch(e){} setShakeScale(isNaN(v) ? 1 : v); }
// CAMERA SWAY — how much the Jedi's camera trails him as he moves (engine/camera.js): 100% is Jedi Academy's lag
function setCamSway(v){
  G.camSway = Math.max(0, Math.min(1.5, isNaN(v) ? 0.8 : v));
  try { localStorage.setItem('sw_sway', G.camSway); } catch(e){}
  const sv = document.getElementById('swayval'); if (sv) sv.textContent = G.camSway ? Math.round(G.camSway * 100) + '%' : 'OFF';
  const sl = document.getElementById('swaysl'); if (sl && +sl.value !== G.camSway) sl.value = G.camSway;
}
// (once: a sway saved before 80% was settled as the default goes back to it, so every player starts there)
{ let v; try { if (localStorage.getItem('sw_sway_v') !== '2'){ localStorage.removeItem('sw_sway'); localStorage.setItem('sw_sway_v', '2'); }
    v = parseFloat(localStorage.getItem('sw_sway')); } catch(e){} setCamSway(isNaN(v) ? 0.8 : v); }
{ const sl = document.getElementById('swaysl');
  if (sl){ sl.addEventListener('pointerdown', (e) => e.stopPropagation()); sl.addEventListener('click', (e) => e.stopPropagation());
    sl.addEventListener('input', (e) => setCamSway(parseFloat(e.target.value))); } }
// SCREEN FLASHES — scales every full-screen flash (fx/floaters.js screenFlash); 0 turns them off
function setFlashScale(v){
  G.flashScale = Math.max(0, Math.min(1.5, isNaN(v) ? 1 : v));
  try { localStorage.setItem('sw_flash', G.flashScale); } catch(e){}
  const sv = document.getElementById('flashval'); if (sv) sv.textContent = G.flashScale ? Math.round(G.flashScale * 100) + '%' : 'OFF';
  const sl = document.getElementById('flashsl'); if (sl && +sl.value !== G.flashScale) sl.value = G.flashScale;
}
{ let v; try { v = parseFloat(localStorage.getItem('sw_flash')); } catch(e){} setFlashScale(isNaN(v) ? 1 : v); }
{ const sl = document.getElementById('flashsl');
  sl.addEventListener('pointerdown', (e) => e.stopPropagation());
  sl.addEventListener('click', (e) => e.stopPropagation());
  sl.addEventListener('input', (e) => setFlashScale(parseFloat(e.target.value))); }
// FIELD OF VIEW — the resting vertical FOV the camera eases toward (dash kicks and disruptor zoom still ride on top)
function setFov(v){
  G.fov = Math.round(Math.max(50, Math.min(90, isNaN(v) ? CFG.camera.fov : v)));
  try { localStorage.setItem('sw_fov', G.fov); } catch(e){}
  const sv = document.getElementById('fovval'); if (sv) sv.textContent = G.fov + '°';
  const sl = document.getElementById('fovsl'); if (sl && +sl.value !== G.fov) sl.value = G.fov;
}
// (sw_fov_v: the default moved to 72, then to 64 with the scale pass; a setting saved before then was most likely the
// old default, so it resets once)
{ let v; try { v = parseFloat(localStorage.getItem('sw_fov')); if (localStorage.getItem('sw_fov_v') !== '3'){ v = NaN; localStorage.setItem('sw_fov_v', '3'); } } catch(e){}
  setFov(isNaN(v) ? CFG.camera.fov : v); }
setMasterVol(shared.masterVol);   // sync the sliders/labels to the values already loaded from localStorage
setMusicVol(AE.vol.music); setSfxVol(AE.vol.sfx);
const senssl = document.getElementById('senssl'), volsl = document.getElementById('volsl');
senssl.addEventListener('pointerdown', (e) => e.stopPropagation());
senssl.addEventListener('click', (e) => e.stopPropagation());
senssl.addEventListener('input', (e) => setMouseSens(parseFloat(e.target.value)));
{ const adssl = document.getElementById('adssl');
  adssl.addEventListener('pointerdown', (e) => e.stopPropagation()); adssl.addEventListener('click', (e) => e.stopPropagation());
  adssl.addEventListener('input', (e) => setAdsSens(parseFloat(e.target.value))); }
volsl.addEventListener('pointerdown', (e) => e.stopPropagation());
volsl.addEventListener('click', (e) => e.stopPropagation());
volsl.addEventListener('input', (e) => { audioInit(); setMasterVol(parseFloat(e.target.value)); });
{ const sl = document.getElementById('shakesl');
  sl.addEventListener('pointerdown', (e) => e.stopPropagation());
  sl.addEventListener('click', (e) => e.stopPropagation());
  sl.addEventListener('input', (e) => setShakeScale(parseFloat(e.target.value))); }
// FOV PREVIEW — while the slider is held (or nudged with the arrow keys) the settings fade away and the live
// in-game view shows through, so you can see the new width as you pick it
{ const sl = document.getElementById('fovsl');
  let held = false, idle = 0;
  const preview = (on) => {
    // from the title screen before any run there's no arena yet: raise the first one so there's a view to judge
    if (on && G.mode === 'menu' && !shared.arenaGroup.children.length){
      buildArena(LEVELS[0]);
      const spot = findClearSpawn(0, shared.arenaHalf * 0.5, CFG.player.radius + 1.0); playerPos().set(spot.x, 0, spot.z);
    }
    G.fovPreview = on; document.body.classList.toggle('fovpreview', on);
  };
  const release = () => { if (!held) return; held = false; preview(false); };
  sl.addEventListener('pointerdown', (e) => { e.stopPropagation(); held = true; clearTimeout(idle); preview(true); });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  sl.addEventListener('click', (e) => e.stopPropagation());
  sl.addEventListener('input', (e) => {
    setFov(parseFloat(e.target.value));
    if (!held){ preview(true); clearTimeout(idle); idle = setTimeout(() => preview(false), 900); }   // keyboard nudges
  }); }
for (const [id, set] of [['mussl', setMusicVol], ['fxsl', setSfxVol]]){
  const sl = document.getElementById(id); if (!sl) continue;
  sl.addEventListener('pointerdown', (e) => e.stopPropagation());
  sl.addEventListener('click', (e) => e.stopPropagation());
  sl.addEventListener('input', (e) => { audioInit(); set(parseFloat(e.target.value)); });
  sl.addEventListener('change', () => S.uiClick());   // a blip at the new level when you let go
}
document.addEventListener('pointerdown', audioInit);   // first gesture anywhere lights up the audio ctx + menu score (autoplay policy)
document.addEventListener('keydown', audioInit);       // a key press counts as that gesture too, so keyboard players hear the menu
// a click or key press during the loading screen (before these listeners existed) still counts: the page already has
// the player's activation, so the audio can start now and the menu theme plays as soon as the menu is up
if (navigator.userActivation && navigator.userActivation.hasBeenActive) audioInit();
// CONTROLS — a panel over the menu; opens on the current hero, with tabs to read the other one's controls
const howto = document.getElementById('howto');
function setHowTo(open){
  howto.classList.toggle('open', open);
  if (open){ setControlsDevice(pad.active || pad.connected ? 'pad' : 'kb'); renderControls(G.hero); }
}
document.getElementById('ctltoggle').addEventListener('click', (e) => { e.stopPropagation(); setHowTo(true); });
document.getElementById('howtoclose').addEventListener('click', (e) => { e.stopPropagation(); setHowTo(false); });
howto.addEventListener('click', (e) => {
  e.stopPropagation();   // reading the help must never launch or resume the game
  const tab = e.target.closest('[data-h]'), dev = e.target.closest('[data-dev]');
  if (tab) renderControls(tab.dataset.h);
  else if (dev){ setControlsDevice(dev.dataset.dev); renderControls(document.querySelector('#howtohero .on').dataset.h); }
  else if (e.target.id === 'howtomore') toggleControlsDetail(document.querySelector('#howtohero .on').dataset.h);
  else if (e.target === howto) setHowTo(false);   // click the backdrop to close
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && howto.classList.contains('open')) setHowTo(false); });
// SETTINGS — every option lives in this panel so the main menu and pause screen stay clean; it opens from either
const settings = document.getElementById('settings');
function setSettings(open){ settings.classList.toggle('open', open); if (!open) setResetConfirm(false); }
document.getElementById('settoggle').addEventListener('click', (e) => { e.stopPropagation(); setSettings(true); });
document.getElementById('setclose').addEventListener('click', (e) => { e.stopPropagation(); setSettings(false); });
settings.addEventListener('click', (e) => {
  e.stopPropagation();   // changing a setting must never launch or resume the game
  if (e.target === settings) setSettings(false);   // click the backdrop to close
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && settings.classList.contains('open')) setSettings(false); });
// RESET TO DEFAULTS — every option in the panel back to its stock value, after a confirm. Settings only: saves,
// progress, mastery, difficulty and the look/loadout choices are never touched. Fullscreen is the browser's, so it stays.
const resetBox = document.getElementById('setreset');
const setResetConfirm = (on) => resetBox.classList.toggle('confirming', on);
function resetSettings(){
  setMasterVol(1); setMusicVol(0.8); setSfxVol(1);
  setMouseSens(1); setAdsSens(0.4); setPadSens(1); setPadInvert(false); setPadAssist(true);
  setShakeScale(1); setFlashScale(1); setCamSway(0.8); setFov(CFG.camera.fov);
  setFinToggle('finSlow', true); setFinToggle('finCam', true); setFinToggle('killCam', true); setSkywar('auto'); setCompass(true); setMinimap(true);
  setStrafeMode('toggle'); setCutMouse(false); setSaberAssist('low'); setGuardRings('fading');
  setAimHint(true); setSwingMirror(false); setSaberGrip('regular');
  resetQuality();
}
document.getElementById('setresetbtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); S.uiClick(); setResetConfirm(true); });
document.getElementById('setresetno').addEventListener('click', (e) => { e.stopPropagation(); setResetConfirm(false); });
document.getElementById('setresetyes').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); resetSettings(); setResetConfirm(false); S.uiClick(); });
showMenuStep('mode');

// UI SOUND — a soft tick when the pointer lands on something you can pick, a firmer blip when you pick it
const UI_PICK = '.herocard, .modeopt, .btn, .setpill, .card, .howto-hero span, .howto-x, .cz-open, .cz-sw, .cz-chip, .cz-tabs span';
let _hoverEl = null;
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest(UI_PICK);
  if (el === _hoverEl) return;
  _hoverEl = el;
  if (el && !el.classList.contains('cant') && !el.classList.contains('locked')) S.uiHover();
});
document.addEventListener('click', (e) => {
  const el = e.target.closest(UI_PICK); if (!el) return;
  if (el.classList.contains('cant') || el.classList.contains('locked')) S.uiDeny();   // can't take it
  else S.uiClick();
}, true);
overlay.addEventListener('click', (e) => {
  // only the primary button launches/resumes — a click on empty backdrop, a label, a card or a setting must not
  if (!e.target.closest('#goText')) return;
  if (overlay.classList.contains('customizing')) return;   // the stage turns the hero while customizing (ui/customizer.js)
  if (overlay.classList.contains('newconfirming')) return;
  beginFromMenu();
});
// BEGIN from the title screen: a hero who hasn't trained is offered the training grounds first
export function beginFromMenu(){
  if (shouldOfferTraining()){
    try { localStorage.setItem('sw_asktrain', '1'); } catch(err){}
    overlay.classList.add('asktrain');
    return;
  }
  launchFromMenu();
}
// a Jedi starting a mode from the title screen sees the forms page first (ui/forms-ui.js): what each form does, and the
// three to carry; its FIGHT launches. A Mando starting a mission sees the armory: the sidearm and primary to carry
// (ui/armory-ui.js). RESUME, a retry and PLAY AGAIN go straight back in
function launchFromMenu(){
  if (G.modeSel === 'temple'){ launch(); return; }   // the temple: no fight to get ready for
  if (G.mode === 'menu' && !isGunner() && !G.coopJoin) openPrefight(launch);
  else if (G.mode === 'menu' && G.hero === 'mando' && G.modeSel === 'mission' && !G.coopJoin) openArmoryPrefight(launch);
  else { if (G.mode === 'menu') G.missionKit = null; launch(); }
}
document.getElementById('trainYes').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('asktrain'); setModeSel('training'); launchFromMenu(); });
document.getElementById('trainNo').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('asktrain'); launchFromMenu(); });
// co-op guest: start a run that follows the host's (net/foes.js): Survival (startEndless sees G.coopJoin) or the campaign's level
export function launchCoopRun(){
  G.coopJoin = true; G.missionForms = null; G.missionKit = null; G.modeSel = coopRun.k === 'm' ? 'mission' : coopRun.k === 'c' ? 'campaign' : coopRun.k === 'z' ? 'zone' : 'endless';
  if (coopRun.k === 'm') G.missionId = coopRun.mid;
  if (coopRun.k === 'z') G.zoneSel = coopRun.mid.slice(ZONE_PREFIX.length);
  setOverlayState('menu');
  launch();
}
// take the pointer lock and start (or resume) play; where the lock never works, play unlocked
function launch(){
  audioInit();
  // a card or the upgrade page came up under the pause screen (in co-op the host can move the run on while this player is
  // paused): it owns the cursor, so there's no lock to take. Just lift the pause screen and hand it the click; asking for
  // the lock here would be let go at once (pointerlockchange) and leave RESUME asking for another click forever
  if (G.mode === 'play' && G.skillSelect && overlay.style.display === 'flex'){ beginPlay(); return; }
  if (pad.active){ shared.lockFallback = true; beginPlay(); return; }   // a pad press can't take the pointer lock: play unlocked (engine/gamepad.js)
  requestLock();
  enterFullscreenIfWanted();   // after the lock request: entering fullscreen uses up the click's user gesture
  setTimeout(() => {
    if (document.pointerLockElement === renderer.domElement) return;
    if (shared.lockWorked){
      // the lock works here but this request was refused — usually the browser's ~1s cooldown after Esc. Stay on the
      // overlay and ask for another click rather than dropping into the unlocked fallback with a loose cursor.
      document.getElementById('ovsub').textContent = 'CLICK AGAIN TO LOCK THE CURSOR';
      return;
    }
    shared.lockFallback = true;   // pointer lock never worked on this page (e.g. an embedded preview) — play unlocked
    beginPlay();
  }, 350);
}
// POINTER LOCK — newer browsers return a promise that rejects on refusal; swallow it (the overlay handles the outcome)
function requestLock(){
  try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){}
}
// a refused lock while a fight is running (restart / R / closing the upgrade screen too soon after Esc) would leave the
// game live with a free cursor and dead mouse-look — pause instead, so one click on RESUME takes the lock again
document.addEventListener('pointerlockerror', () => {
  if (document.pointerLockElement || shared.lockFallback || G.skillSelect || G.mode !== 'play' || overlay.style.display === 'flex') return;
  overlay.style.display = 'flex';
  G.paused = true;
  setOverlayState('pause');
  if (shared.lockWorked) document.getElementById('ovsub').textContent = 'CLICK RESUME TO LOCK THE CURSOR';
});
// PAUSE KEYS — Tab pauses and resumes in every browser (Esc exits fullscreen where it isn't locked). Enter resumes from the pause screen in every browser. Where Esc is locked to the game (fullscreen in
// Chrome / Edge, see fullscreen.js) a quick Esc pauses and resumes too, so closing the pause screen with Esc no longer
// drops you out of fullscreen. Runs in the capture phase so it sees the screen before Esc closes a panel on top of it.
export const panelOpen = () => howto.classList.contains('open') || settings.classList.contains('open') || document.getElementById('saves').classList.contains('open') || overlay.classList.contains('newconfirming') || overlay.classList.contains('exitconfirming') ||
  document.getElementById('roadmap').classList.contains('open') || document.getElementById('codex').classList.contains('open') || document.getElementById('forms').classList.contains('open') || document.getElementById('coop').classList.contains('open') || overlay.classList.contains('confirming') || overlay.classList.contains('asktrain');
window.addEventListener('keydown', (e) => {
  if (e.repeat || (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== 'Tab')) return;
  const tab = e.key === 'Tab', esc = e.key === 'Escape' || tab;   // Tab pauses exactly as a quick Esc does
  if (e.key === 'Escape' && !escapeIsOurs()) return;   // the browser owns Esc here (pointer lock / fullscreen exit)
  if (tab && (panelOpen() || document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) return;
  if (esc) e.preventDefault();
  const shown = overlay.style.display === 'flex';
  if (shown && _ovState === 'pause' && G.mode === 'play' && !panelOpen()){ e.preventDefault(); launch(); return; }
  if (esc && !shown && G.mode === 'play' && !G.skillSelect){
    if (document.pointerLockElement) document.exitPointerLock();   // pointerlockchange shows the pause screen
    else if (shared.lockFallback){ overlay.style.display = 'flex'; G.paused = true; setOverlayState('pause'); }
  }
}, true);
// R (or Enter) on the fallen screen retries at once, as its button does. Not in the first moment it's up, so a key still
// held from the fight (a gunner's reload) doesn't retry by accident
window.addEventListener('keydown', (e) => {
  if (e.repeat || (e.key !== 'r' && e.key !== 'R' && e.key !== 'Enter') || G.mode !== 'dead' || _ovState !== 'dead' || overlay.style.display !== 'flex') return;
  if (panelOpen() || /\b(confirming|exitconfirming)\b/.test(overlay.className) || performance.now() - _deadAt < 600) return;
  if (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  e.preventDefault(); audioInit(); launch();
});
// ENTER on the title screen presses its primary button (CONTINUE CAMPAIGN when a run is saved, else BEGIN), as the pad's A
// does with the focus ring on it. Runs last (bubble phase), after the Forms page, armory and text boxes have had theirs.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.repeat || e.defaultPrevented || G.mode !== 'menu' || _ovState !== 'menu' || overlay.style.display === 'none') return;
  if (panelOpen() || /\b(customizing|newconfirming|confirming|asktrain)\b/.test(overlay.className)) return;
  if (document.activeElement && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(document.activeElement.tagName)) return;
  const cont = document.getElementById('mode-continue');
  if (cont && cont.offsetParent && _step === 'mode' && !_group){ e.preventDefault(); cont.click(); return; }   // the modes step: CONTINUE, when it's there
  const go = document.getElementById('goText'); if (!go || !go.offsetParent) return;   // (only where the button shows: not on the modes step)
  e.preventDefault(); audioInit(); beginFromMenu();
});
// in the unlocked fallback, keep offering the real lock: a click on the game takes it if the browser now allows it
renderer.domElement.addEventListener('mousedown', () => { if (shared.lockFallback && G.mode === 'play') requestLock(); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (G.skillSelect && !locked) return;   // skill tree owns the cursor — don't show the pause overlay
  if (locked && G.cardUp){ document.exitPointerLock(); return; }   // a card or the lesson board is up: a lock that lands late (the click's request) is let go so the cursor stays free
  if (locked){
    shared.lockFallback = false;
    shared.lockWorked = true;
    // the lock landing while a hub wing loads (the waystone click's request): the load unpauses when it's in, not this
    if (loadingNow() && G.mode === 'play' && G.hub){ overlay.style.display = 'none'; return; }
    beginPlay();
  } else if (!shared.lockFallback){
    overlay.style.display = 'flex';
    if (G.mode === 'play'){
      G.paused = true;   // ESC released the cursor — freeze the game behind the overlay
      setOverlayState('pause');
    }
    else if (G.mode === 'dead' || G.mode === 'victory') setOverlayState(G.mode);
    else setOverlayState('menu');
  }
});
// RESTART — the mode again from its start; in the campaign that is this chapter's start (a won campaign's starts it over)
function restartRun(toTraining, after){
  const won = G.mode === 'victory';
  overlay.style.display = 'none';
  _endPick = null; overlay.classList.remove('vpicking');
  document.getElementById('restartBtn').style.display = 'none';
  document.getElementById('banner').style.opacity = '0';
  document.getElementById('skilltree').style.display = 'none';
  G.skillSelect = false; G.sbMenu = false;
  G.mode = 'play'; G.slowmo = 1; G.paused = false;
  document.body.classList.remove('in-menu'); setHowTo(false); setSettings(false);
  closeCard(true);
  // the fresh level builds behind the loading screen (ui/loading.js), the old one held still under it
  G.paused = true;
  loadInto(() => {
    G.paused = false;
    if (toTraining) startTutorial(); else if (G.zone) startZone(G.zone); else if (G.chapter >= 0 && !won) restartChapter(); else if (G.chapter >= 0){ if (storyHero() === 'gate') startGate(); else startCampaign(); } else if (G.endless) startEndless(); else if (G.training) startTutorial(); else if (G.mission) startMission(G.missionId); else if (G.sandbox) startSandbox({ replay: true }); else startCampaign();   // a survival run restarts as survival, not the campaign
    if (after) after();
  });
  if (!shared.lockFallback) requestLock();
}
document.getElementById('restartBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); restartRun(); });
// the stance unlock screen's TRAIN button (game/meditation.js): the campaign run is kept for CONTINUE CAMPAIGN, and the
// training opens on the lesson for the form just learned; leaving training lands back on the menu with the run waiting
// a chapter card opening under the pause screen (the host moved a co-op run on): the scene changed, so the pause screen
// goes and the card is in front (a panel open on it, settings or the like, is left alone: RESUME then reaches the card)
// (an event, not a hook: game/campaign.js and this file load in a loop, and a hook set from here could be reset as it loads)
window.addEventListener('chapcard-open', () => { if (G.mode === 'play' && overlay.style.display === 'flex' && _ovState === 'pause' && !panelOpen()) beginPlay(); });
setTrainHook((formId) => {
  G.resumeRun = captureRun();   // (saved at the chapter's close: the trial stays won, game/saves.js resumeRun)
  trainOnForm(formId);
  setModeSel('training');
  restartRun(true, () => autosave('training from the story'));   // the autosave keeps the run as it left, so a reload doesn't replay the trial
});
// the lesson board's RETURN TO STORY (game/tutorial.js): straight back into the waiting run, as CONTINUE CAMPAIGN would
setStoryReturn({
  waiting: () => canResume(),
  go: () => { setModeSel('campaign'); goHome(); launch(); },
});
// MAIN MENU — abandon the run and go back to the title screen. From pause it asks first (a run is easy to lose
// by accident); from the fallen/victory screens the run is already over, so it goes straight there.
export function goHome(){
  overlay.classList.remove('hubpage'); hubPage = null;
  overlay.classList.remove('confirming');
  closeMissionPage();   // MAIN MENU is the menu itself, not the Missions page a mission was started from
  closeSandboxPanel(false); closeHubPanel(false);
  leaveSetup(false);   // the sandbox's battle setup, if it's up (game/battlesim.js)
  closeCard(true);
  keepHubSpot();   // (from the hub: ENTER it again and you're back where you stood, game/hub.js)
  document.getElementById('skilltree').style.display = 'none';
  G.skillSelect = false; G.sbMenu = false;
  if (G.stats){ G.stats._ended = false; G.stats.summary = null; }
  document.getElementById('runsummary').style.display = 'none';
  startLevel(0, { sweep: true });   // sweep the battlefield and reset the hero + kit, exactly as a fresh campaign would (no checkpoint: nothing is being played)
  G.mode = 'menu'; G.coopWasGuest = false; G.paused = false; G.slowmo = 1; G.slowmoT = 0; G.hitstop = 0; G.fromHub = false;
  G.ngPlus = 0; G.ngNext = null;   // (a NEW GAME+ run is over: CONTINUE brings its tier back from the save, game/saves.js restoreRun)
  overlay.style.display = 'flex';
  if (!G.coopJoin) followHero();   // the run just played was used up as it began: this hero's newest save waits again for CONTINUE CAMPAIGN
  showMenuStep('mode');   // the title screen opens on its first step
  refreshMenu();
  overlay.scrollTop = 0;
}
// the title screen's locks, ticks and headline, after anything that changes progress (a run ending, a loaded save, NEW GAME)
export function refreshMenu(){
  refreshSurvivalLock(); refreshSandboxLock(); refreshGateLock(); refreshCampaignMark(); refreshTrainingMark(); refreshMissionMark();
  setOverlayState('menu');
}
// finishing the training grounds hands you back to the menu, with the campaign picked
setTrainingExit(() => {
  if (document.pointerLockElement) document.exitPointerLock();
  setModeSel('campaign');
  goHome();
  showMenuStep('hero');   // the campaign picked and ready to begin
});
document.getElementById('skipBtn').addEventListener('click', () => skipStep());
// LESSON BOARD: back into the fight's frame, then the board over it (game/tutorial.js)
document.getElementById('lessonsBtn').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); document.getElementById('goText').click(); openLessonBoard(); });
document.getElementById('homeBtn').addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (_ovState === 'pause' && !G.hub){ templeAsk = false; overlay.classList.add('confirming'); } else goHome();
});
document.getElementById('homeYes').addEventListener('click', (e) => { e.stopPropagation(); if (templeAsk){ overlay.classList.remove('confirming'); goTemple(); } else goHome(); });
document.getElementById('homeNo').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('confirming'); });
// RETURN TO THE TEMPLE: a run started from the temple goes back to it (from pause it asks first, as MAIN MENU does)
let templeAsk = false;
document.getElementById('templeBtn').addEventListener('click', (e) => {
  e.stopPropagation(); audioInit();
  if (_ovState === 'pause'){ templeAsk = true; overlay.classList.add('confirming'); } else goTemple();
});
document.getElementById('stepTemple').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); goTemple(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('confirming')) overlay.classList.remove('confirming'); });
document.querySelectorAll('.fsctl').forEach((el) => el.addEventListener('click', audioInit));   // fullscreen.js does the toggling
document.getElementById('continueBtn').addEventListener('click', (e) => { e.stopPropagation(); closeProgress(); });
// GRAPHICS selector on the overlay — cycle quality without resuming/launching (stop the click bubbling to the overlay)
document.getElementById('gfxctl').addEventListener('click', (e) => { e.stopPropagation(); cycleQuality(); });
// FRAME RATE (cap), RESOLUTION (auto scaling) and FPS COUNTER: engine/quality.js keeps them and their labels
document.getElementById('fpscapctl').addEventListener('click', (e) => { e.stopPropagation(); setFrameCap(FRAME_CAPS[(FRAME_CAPS.indexOf(frameCapNow()) + 1) % FRAME_CAPS.length]); });
document.getElementById('resctl').addEventListener('click', (e) => { e.stopPropagation(); setAutoRes(!autoResNow()); });
document.getElementById('fpsctl').addEventListener('click', (e) => { e.stopPropagation(); setFpsCounter(!fpsCounterNow()); });

/* ============================================================
   THE HIDDEN TEMPLE (game/hub.js): its stations launch modes, open pages, and runs come back to it
   ============================================================ */
// start play now, whether or not this moment counts as a click: with the lock already held (or none to be had) it goes
// straight in; otherwise it asks for the lock and, if that's refused, plays unlocked (a click on the game takes it later)
export function launchNow(){
  audioInit();
  if (document.pointerLockElement === renderer.domElement || pad.active || shared.lockFallback){ beginPlay(); return; }
  requestLock();
  setTimeout(() => { if (document.pointerLockElement === renderer.domElement || G.mode !== 'menu') return; shared.lockFallback = true; beginPlay(); }, 350);
}
// leave the temple for the title screen (a station that opens a menu page, or launches a mode through it). The temple's
// build stays where it is until the next mode replaces it; the menu draws its own stage, not the arena
function leaveHub(){
  keepHubSpot();   // (closing the page and walking back in: the spot you left, game/hub.js)
  closeHubPanel(false);
  G.fromHub = true; G.hub = false; G.mode = 'menu'; G.paused = false; G.skillSelect = false; G.sbMenu = false;
  G.ngPlus = 0;   // (the temple is between runs: a campaign from here is a first run unless NEW GAME+ arms one)
  overlay.style.display = 'flex';
  if (!G.coopJoin) followHero();
  refreshMenu();
}
export function hubToMenu(step = 'hero'){ leaveHub(); showMenuStep(step); }
// a station's mode, straight in: the forms page (or the armory) first where the title screen would show it
export function hubLaunch(mode, mid){
  if (mode === 'mission' && mid) setMission(mid);
  leaveHub();
  if (!setModeSel(mode)){ showMenuStep('mode'); return false; }
  showMenuStep('hero');
  if (mode === 'campaign') pickUpSavedRun();
  beginFromMenu();
  return true;
}
// an open zone (game/zone.js): straight in from a hub's station, no forms page or armory first (it hands out the kit your
// rank carries, and you leave by its shuttle)
export function hubLaunchZone(key = 'jedha'){
  G.zoneSel = key;
  leaveHub();
  G.modeSel = 'zone';
  showMenuStep('hero');
  launchNow();
}
// a page that lives on the pause screen (the codex, the profile, the forms): over the temple, paused under it; closing
// it with a click goes straight back to the temple
let hubPage = null;
export function hubOpenPanel(open, isOpen){
  closeHubPanel(false);
  hubPage = isOpen;
  G.paused = true; overlay.style.display = 'flex'; setOverlayState('pause');
  overlay.classList.add('hubpage');   // (just the page over the temple: the pause screen under it stays out of sight, styles/hub.css)
  if (document.pointerLockElement) document.exitPointerLock();
  open();
}
// (capture phase, looked at just after: a page's own close button stops its click going any further. The click is still a
// gesture a moment later, so the lock comes back with it; Esc closing the page isn't one, so that plays unlocked until
// the next click on the game)
const hubPageClosed = (gesture) => setTimeout(() => {
  if (!hubPage || hubPage() || !G.hub || G.mode !== 'play') return;
  hubPage = null; overlay.classList.remove('hubpage');
  if (gesture) launch(); else launchNow();
}, 0);
document.addEventListener('click', () => hubPageClosed(true), true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hubPageClosed(false); }, true);
// back to the temple from wherever this run is (its end screens, pause, the menu): `auto` when nobody clicked (a co-op
// guest called back by the host)
export function goTemple(auto){
  overlay.classList.remove('confirming', 'hubpage'); hubPage = null;
  closeMissionPage(); closeSandboxPanel(false); closeHubPanel(false); leaveSetup(false); closeCard(true);
  document.getElementById('skilltree').style.display = 'none';
  G.skillSelect = false; G.sbMenu = false;
  if (G.stats){ G.stats._ended = false; G.stats.summary = null; }
  document.getElementById('runsummary').style.display = 'none';
  G.mode = 'menu'; G.paused = false; G.slowmo = 1; G.slowmoT = 0; G.hitstop = 0; G.coopJoin = false;
  setModeSel('temple'); setOverlayState('menu');
  if (auto) launchNow(); else launch();
}
// a co-op guest in the temple follows the host into the run they just started
function followHostRun(){
  closeHubPanel(false);
  G.fromHub = true; G.partyRun = true; G.hub = false;
  G.coopJoin = true; G.missionForms = null; G.missionKit = null; G.modeSel = coopRun.k === 'm' ? 'mission' : coopRun.k === 'c' ? 'campaign' : coopRun.k === 'z' ? 'zone' : 'endless';
  if (coopRun.k === 'm') G.missionId = coopRun.mid;
  if (coopRun.k === 'z') G.zoneSel = coopRun.mid.slice(ZONE_PREFIX.length);
  G.mode = 'menu'; setOverlayState('menu');
  launchNow();
}
export function joinHostRun(){ followHostRun(); }   // (the council table's JOIN, ui/hub-ui.js)
setPartyHooks(followHostRun, goTemple);
