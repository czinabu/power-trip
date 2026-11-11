// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Entry point: imports every module in the original load order, then runs the main loop (tick) and exposes window.GAME.

import './engine/fastmath.js';     // first of all: a fast Math.hypot (engine/fastmath.js)
import './engine/save-files.js';   // before anything reads localStorage: the active save file's keys (engine/save-files.js)
import './ui/boot.js';   // first: the loading screen hears that the game's code is in (ui/boot.js)
{ const bv = document.getElementById('buildver'); if (bv && typeof __BUILD_LABEL__ !== 'undefined') bv.textContent = __BUILD_LABEL__; }   // build label on the main menu (vite.config.js)
import { BLADE_U } from './fx/blade-glow.js';
import { switchWeapon, beskarPress } from './player/mando/weapons.js';
import { setKit, grantGun } from './game/armory.js';
import { heroAim, aimFrom, crosshairPoint, inAim, bossInAim, lastAim } from './player/aim.js';
import { CFG } from './data/config.js';
import { STANCES } from './data/stances.js';
import { ENEMY_TYPES } from './data/enemies.js';
import { LEVELS } from './data/levels.js';
import { BOSS_CFG, BOSS_MANDO } from './data/bosses.js';
import { camera, composer, renderer, scene, drawFrame } from './engine/renderer.js';
import { cycleQuality, qualityGovernor, frameStart, resolutionInfo } from './engine/quality.js';
import { audioInit } from './audio/sfx.js';
import { MUSIC } from './audio/music.js';
import { updateAudio } from './audio/director.js';
import './utils.js';
import { updateParticles } from './fx/particles.js';
import './fx/floaters.js';
import {
  shared, G, rockets, enemies, bolts, rings, pillars, solids, hazardZones, keys, player
} from './state.js';
import { MANDO, MANDO_WEAPONS } from './data/mando.js';
import './fx/lights.js';
import './engine/prewarm.js';
import './player/mesh.js';
import { setHero } from './player/hero.js';
import { updateTrail, trailInfo, TRAIL_TUNE } from './fx/trail.js';
import { stance } from './player/helpers.js';
import { switchStance } from './player/jedi/stance.js';
import { updateJudgeFX } from './player/jedi/judgement-fx.js';
import './enemies/mesh.js';
import { enemyHpScale, ELITES, eliteChance } from './enemies/elites.js';
import { bomberExplode } from './enemies/specials.js';
import { spawnEnemy } from './enemies/spawn.js';
import { damageEnemy } from './enemies/damage.js';
import { updateEnemies } from './enemies/ai.js';
import { updateBolts, updateOrbs, fireBolt } from './enemies/bolts.js';
import { updateGrenades, grenades, pushGrenades } from './enemies/grenades.js';
import { RAMP, TROOP_MELEE, TROOP_FIRE, PINCER, ORDERS, GRENADE, LUNGE } from './data/tactics.js';
import { tacticsRamp } from './enemies/tactics.js';
import './boss/light.js';
import { updateVents, updateBarrels, hazardContains, updateHazardZones } from './world/hazards.js';
import { spawnBoss, damageBoss, bossStagger, updateBoss, updateRings } from './boss/boss.js';
import { updateFinale, finaleMove, spawnFinale } from './boss/finale.js';
import { FOCUS, focusTier, focusDmgMul, focusRegenMul, addFocus, updateFocus } from './player/jedi/focus.js';
import { tryAttack, applySwingDamage } from './player/jedi/combat.js';
import { cutHeight } from './player/jedi/cutaim.js';
import {
  castGesture, saberThrow, forcePush, forceSlam, updateSaberThrow, forceRepulse, forceBarrier, forceMend
} from './player/jedi/force.js';
import { updateVFX } from './fx/vfx.js';
import './player/movement.js';
import './world/collision.js';
import { updateRockets, updateBirds, updateDetos, updateGrapple } from './player/mando/gadgets.js';
import { mandoWeapon, spawnBlasterBolt, hitMarker } from './player/mando/weapons.js';
import './player/mando/darksaber.js';
import { hurtPlayer } from './player/damage.js';
import { updatePlayer } from './player/update.js';
import './world/arena.js';
import './world/textures.js';
import { updateAmbient } from './fx/ambient.js';
import { updateScorch } from './fx/scorch.js';
import { updateSevered, scarBody, severLimbs } from './enemies/scars.js';
import './world/arenas/temple.js';
import './world/arenas/foundry.js';
import './world/arenas/plains.js';
import { queueSpawn, startLevel, checkUnlocks, startWave, updateFlow } from './game/flow.js';
import { startTutorial, updateTutorial, skipStep, trainingProgress, lessonList, openLessonBoard } from './game/tutorial.js';
import { startCampaign, campaignWon, startChapter, nextChapter, chapters } from './game/campaign.js';
import { startMission, updateMission, skipObjective, missionState } from './game/mission.js';
import { twistState } from './game/twists.js';
import { startSandbox, updateSandbox, sandboxSpawn, sandboxClear, setSandboxKit, sandboxKitAll } from './game/sandbox.js';
import {
  enemyDmgScale, genEndlessWave, spawnChampion, startEndless, startEndlessWave
} from './game/survival.js';
import { MUTATORS } from './data/mutators.js';
import { SKILLS } from './data/skills.js';
import { nextStoreGoal, buyPower } from './game/progression.js';
import { trainAbility, masteryNext, earnWavePoint } from './game/upgrades.js';
import { abil, MASTERY_JEDI, MASTERY_MANDO } from './data/mastery.js';
import { ENDLESS_POWERS } from './data/store.js';
import { openSkillTree } from './ui/store-ui.js';
import { BOONS, BOON_BY_ID } from './data/boons.js';
import { rollBoons, pickBoon } from './game/boons.js';
import { endRun } from './game/summary.js';
import './ui/banners.js';
import './ui/threats.js';
import { updateHud } from './ui/hud.js';
import { objectiveInfo, holdObjectiveView, renderObjectiveView } from './ui/objective-view.js';
import { setOverlayState, hubLaunch } from './ui/menus.js';
import './ui/roadmap.js';   // the ROADMAP panel (its button on the main menu)
import './ui/codex-ui.js';   // the CODEX page: everyone met (its button on the main menu and pause)
import './ui/forms-ui.js';   // the FORMS page: before the fight (BEGIN) and on the pause screen
import { showcaseActive, renderShowcase, leaveShowcase } from './ui/showcase.js';
import { bootFrame } from './ui/boot.js';
import './ui/customizer.js';
import './data/difficulty.js';
import './engine/input.js';
import './engine/gamepad.js';
import { updateCamera } from './engine/camera.js';
import { KC, killCam } from './engine/killcam.js';
import { updateCharFade, charFadeState, CHAR_SEE } from './world/charfade.js';
import { updateCutscene } from './game/cutscene.js';
import { updateBarks } from './fx/barks.js';
import { SEE } from './world/ink.js';
import { NAV, buildNav, updateNav, navSteer, navDist, navRoute } from './enemies/nav.js';
import { foeType } from './enemies/look.js';
import { DUEL, DUEL_PROFILES, MANDO_MELEE } from './data/duel.js';
import { LOCK, startLock, endLock, duelDefend, eliteRamp, lockPush, baitGuards } from './enemies/duel.js';
import { guardMeets, guardState } from './player/jedi/guardline.js';
import { pvpOn } from './game/pvp-rules.js';
import { foeBlade, bossBlade, contactPoint } from './player/jedi/clash.js';
import { bladeSegment } from './player/jedi/bladehit.js';
import { updateCoop, partnerShown, partnerInfo, partnerMate } from './net/partner.js';
import { updateApprentice } from './allies/apprentice.js';
import { allies, updateSquad, updateSquadHud, spawnSquad, addSquadmate, squadOrder, hurtAlly, giveOrder, squadOrderName, squadFormation, grenadeLeft, duelRingOn, squadStance, setSquadStance, engageCode } from './allies/squad.js';
import { updateWheel, wheelOpen } from './allies/wheel.js';
import { downed } from './game/revive.js';
import { updateComms, clearComms, commsBusy, storyBeat, comms } from './game/story.js';
import { updateHudStage } from './ui/hud-stage.js';
import { updateGlance } from './game/glance.js';
import { updateTalk } from './game/talk.js';
import { updateHub, startHub, goWing, curHub } from './game/hub.js';
import { updateZone, startZone, travelTo, zoneDistrict, stonesTouched } from './game/zone.js';
import { zoneQuest, zoneGivers, zoneQuestMarks } from './game/zone-quests.js';
import { zonePatrols } from './game/zone-fights.js';
import { zoneStreamInfo, buildAllChunks, updateZoneStream, zoneStream } from './world/zone-stream.js';
import { welcomeState, welcomeStops, forgetWelcome, replayWelcome, replayTour } from './game/hub-welcome.js';
import { newsNoted, forgetNews } from './game/hub-news.js';   // the guide's news on coming home, for tests
import { updateSecrets, secretsPlaced } from './game/secrets.js';
import { updateAlignment } from './game/alignment.js';
import './ui/hub-ui.js';
import './ui/zone-ui.js';   // the waystone panel in an open zone
import { updateZoneMap, openZoneMap, closeZoneMap, zoneMapInfo } from './ui/zone-map.js';   // an open zone's minimap and full map (M)
import { HUBS, ALL_WINGS } from './data/hub.js';
import { updateOnSet, onSetFigures } from './game/onset.js';
import { updateAftermath, calmOn, calmTarget } from './game/aftermath.js';
import { updateDoorway, doorState, goThrough, doorDark } from './world/doorway.js';
import { CALM_CFG } from './data/calm.js';
import './ui/coop-ui.js';
import './ui/profile-ui.js';
import * as PROFILE from './game/profile.js';
import * as MEDALS from './game/medals.js';
import * as MEDAL_DATA from './data/medals.js';
import { MISSIONS as MISSION_LIST } from './data/missions.js';
import { SIDE_QUESTS as SIDE_ALL, SIDE_PREFIX as SIDE_PFX } from './data/side-quests.js';
import { missionById as defById, randomArcadeId } from './data/arcade.js';
import * as GROWTH from './game/hub-growth.js';
import { growthStreaming } from './world/arenas/growth-kit.js';
import * as NGPLUS from './data/ngplus.js';   // NEW GAME+ (window.GAME.NGPLUS, for the tests)
import * as ALIGNMENT from './game/alignment.js';
import { updateFoes, updatePuppets, coopLive } from './net/foes.js';
import { updateWaits } from './net/waits.js';
import { updateWaiting, waitingUp } from './ui/waiting.js';
import { voteState } from './game/group-choice.js';
import './net/foefire.js';
import { pvpTestBlow, guardAgo as pvpGuardAgo, pvpIncoming, pvpInfo } from './net/pvp.js';   // duel mode's blows between players
import { updateDuel, duelInfo, startPractice, challenge as duelChallenge, answer as duelAnswer, rematch as duelRematch, leaveDuel, toBalcony, honours as duelHonours } from './game/duel-mode.js';
import { updateDuelUi, openChallenge } from './ui/duel-ui.js';
import { updateSquadNet } from './net/squad.js';
import { updatePings, pingHere, pingInfo } from './net/ping.js';
import { updateTeamups, updateTeamupFlight, updateTeamupFx, teamupInfo, teamupPress, resetTeamups } from './game/teamup.js';
import { TEAMUP, TEAMUPS } from './data/teamups.js';
import { dropLink as coopDrop, net as coopNet } from './net/session.js';
import { hooks as coopHooks, coopRun } from './net/run.js';
import { continueOnLaunch } from './ui/saves-ui.js';
import './ui/exit-game.js';   // EXIT GAME on the title and pause screens, in the desktop app only
import './ui/files-ui.js';   // the title screen's save file line and the files panel   // NEW GAME / SAVE GAME / LOAD GAME and the save-slot panel

setHero(G.hero);   // initialise control text + crosshair for the default hero
continueOnLaunch();   // a saved campaign run: the title screen opens on CONTINUE CAMPAIGN, as its hero

/* ============================================================
   MAIN LOOP
   ============================================================ */
/* the frame's time step comes from the browser's frame timestamp (when this frame will be shown, on the display's beat),
   not from a clock read when the script happens to start: that read wobbles by a millisecond or two with whatever ran
   before it, and every move in the game, the camera's most of all, stuttered with the wobble */
let lastFrameT = -1;
function tick(ts){
  requestAnimationFrame(tick);
  if (!frameStart()) return;   // the FRAME RATE cap holds this one back (engine/quality.js)
  solidsChanged();   // the collision queries read the solids afresh once a frame (world/collision.js)
  const frameT = typeof ts === 'number' ? ts : performance.now();
  const rawDt = lastFrameT < 0 ? 0 : Math.max(0, Math.min((frameT - lastFrameT) / 1000, 0.05));
  lastFrameT = frameT;
  let dt = rawDt;
  updateWheel();   // the squad's command wheel: opens on a held H and slows the world while it's up (allies/wheel.js)
  if (G.slowmoT > 0){
    G.slowmoT -= rawDt;
    if (G.slowmoT <= 0 && (!shared.boss || shared.boss.state !== 'dying')) G.slowmo = 1;
  }
  if (G.hitstop > 0){ G.hitstop -= dt; dt *= 0.08; }
  dt *= G.slowmo;
  // overlay up: freeze the simulation entirely (still renders). In a shared fight the OTHER hero is still playing, so only
  // this hero stops (and feels their own hitstop and slow motion): the foes, their shots and the waves run on real time
  const frozen = G.paused || G.skillSelect || G.cutscene, live = coopLive();
  // a cutscene (either hero's, in co-op) holds the whole fight: foes, shots and waves stand still until it ends
  const wdt = G.cutscene || coopRun.guestScene ? 0 : live ? rawDt : frozen ? 0 : dt;
  if (frozen) dt = 0;
  if ((!frozen || live) && (G.mode === 'play' || G.mode === 'dead')){
    G.gt += wdt;
    if (G.mode === 'play'){
      updateTeamups(dt);       // team-up moves: the prompt, the two presses, the move as it plays (game/teamup.js)
      updatePlayer(dt);
      updateTeamupFlight(dt);  // ...and a team-up's scripted flight, over the hero's own movement (the jetpack drop)
      updateFlow(wdt);
      updateMission(dt);
      updateDoorway(dt);     // the temple doors swinging open, and the walk through them (world/doorway.js)
      updateAftermath(dt);   // the calm after a chapter's last fight: a walk back to the rally point (game/aftermath.js)
      updateGlance(dt);   // an objective's hand-off turns the view to the next one, for a moment (game/glance.js)
      updateSandbox(dt);
      updateSquad(dt);   // the hero's squad, and anyone downed waiting to be got up (allies/squad.js, game/revive.js)
      updateApprentice(dt);   // the Padawan's powers, the foundling's eye, the trooper's second; and in the hub, at their post (allies/apprentice.js)
    }
    if (G.coopGuest) updatePuppets(wdt); else updateEnemies(wdt);   // co-op guest: the host's foes, followed rather than thought for (net/foes.js)
    updateBolts(wdt);
    updateGrenades(wdt);
    updateOrbs(dt);
    updateBoss(live && shared.boss && shared.boss.state === 'dying' ? wdt : dt);   // co-op: a felled boss finishes dying even while this hero picks upgrades, so the partner's fight ends
    updateFinale(wdt);   // a final boss on a duellist's body: his phases, his moves, his bar (boss/finale.js)
    updateRings(dt);
    updateVents(dt);
    updateBarrels(dt);
    updateHazardZones(dt);
    updateSaberThrow(dt);
    updateRockets(dt);
    updateBirds(dt); updateDetos(dt); updateGrapple(dt);
    if (G.streakT > 0){
      G.streakT -= dt;
      if (G.streakT <= 0){ G.streak = 0; document.getElementById('streak').style.opacity = '0'; }
    }
    updateHud();
  }
  updateSquadHud();
  renderObjectiveView();   // HOLD O (a pad: LB + D-pad right): the objective, its step and the progress (ui/objective-view.js)
  updateComms(G.paused || G.skillSelect || G.cutscene ? 0 : rawDt);   // the voice in your ear during a campaign chapter (game/story.js)
  updateHudStage(G.paused || G.skillSelect || G.cutscene ? 0 : rawDt, G.mode === 'play');   // the words on the lower middle keep one column and take turns (ui/hud-stage.js)
  updateTalk(G.paused || G.skillSelect || G.cutscene ? 0 : rawDt);    // walk-up lines from the people on your side, in a lull (game/talk.js)
  updateAlignment(G.paused || G.skillSelect || G.cutscene ? 0 : rawDt);   // light and dark: the SPARE prompt, the blades thrown down, the look (game/alignment.js)
  updateSecrets(G.paused || G.skillSelect || G.cutscene ? 0 : rawDt);   // the story maps' hidden holocrons, caves and meditation spots (game/secrets.js)
  updateHub(G.paused || G.skillSelect ? 0 : rawDt);   // the hidden temple: its stations, its doors, its turning holograms (game/hub.js)
  updateZone(G.paused || G.skillSelect ? (coopLive() ? rawDt : 0) : rawDt);   // an open zone: its streets streamed in and out, its waystones and districts (game/zone.js) (in a shared zone the host's patrols run on behind a card)
  updateZoneMap(rawDt);   // ...and its minimap and full map (ui/zone-map.js)
  updateOnSet(G.paused || G.skillSelect || G.cutscene ? 0 : rawDt);   // the story's voice, staying on the field after a chapter's opening (game/onset.js)
  updateTutorial(G.paused || G.skillSelect || G.cutscene ? 0 : dt);   // the training lessons, and the unlock drills in a real run
  updateFoes();
  updateWaits();          // who a shared run is waiting on between chapters (net/waits.js)
  updateWaiting(rawDt);   // and the card on the dark that names them (ui/waiting.js)
  updateSquadNet();   // online co-op: the host's squad, sent to the guest and commanded from both screens (net/squad.js)
  updateCoop(rawDt);     // online co-op: send my pose, pose the partner's hero (net/partner.js)
  updateDuel();          // duel mode: the match, its referee's clock, the ring (game/duel-mode.js)
  updateDuelUi();        // ...its prompt, cards and score bar (ui/duel-ui.js)
  updatePings();         // pings: yours and the other players' (net/ping.js)
  if (G.mode !== 'play') updateTeamups(0);   // (out of the fight: a team-up still playing is dropped, its prompt put away)
  // the fight's leftover flourishes (a blade's trail, sparks, a push's rings, a severed limb) play out on real time under a
  // cutscene: frozen, they'd hang in its shots as a still of the last action beat
  const fxDt = G.cutscene && !G.paused && !G.skillSelect ? rawDt : dt;
  updateJudgeFX();
  updateAmbient(G.paused ? 0 : rawDt);
  updateScorch(dt);
  updateSevered(fxDt);
  updateParticles(fxDt);
  updateTeamupFx(fxDt);   // a team-up's tracers (game/teamup.js)
  updateVFX(fxDt);
  updateCutscene();   // a cutscene's lens, actors and words (game/cutscene.js); the play camera stands down while one is on
  updateCamera(dt);
  updateBarks(G.paused || G.skillSelect ? 0 : rawDt, G.mode === 'play' && !G.cutscene && !G.paused && !G.skillSelect && !showcaseActive());   // mid-fight lines over the speakers' heads (fx/barks.js)
  // squadmates, foes, a boss or a partner standing between the lens and the hero turn see-through (world/charfade.js)
  { const pp = player.group.position; updateCharFade(camera.position, pp.x, pp.y, pp.z, rawDt, G.mode === 'play' && !G.cutscene && !G.paused && !G.sbPlan && !G.sbMenu); }
  MUSIC.updateState();   // adaptive score follows the fight (menu → combat → boss surge → victory/death)
  updateAudio(rawDt);    // saber hum, jetpack, flamethrower, ambience, muffle
  // the blades' streaks last of all, off every blade where it is now (posed, cut-scened, framed), so a streak never
  // lags the blade the eye sees (fx/trail.js)
  updateTrail(fxDt);
  // the title screen draws its own stage (painted backdrop + the hero on a turntable) instead of the arena
  if (showcaseActive()) renderShowcase(rawDt); else { leaveShowcase(); drawFrame(); }
  bootFrame();   // the loading screen lifts once the first frames are drawn (ui/boot.js)
  qualityGovernor(!showcaseActive() && !G.paused && !G.skillSelect && !G.cutscene && G.mode === 'play');
}
tick();

/* expose configs + API for live tweaking and future edits (dev console) */
window.GAME = { run: RUN_STATE, PROFILE, MEDALS, MEDAL_DATA, arcadeId: () => randomArcadeId(),
  missionDefs: () => ({ ...MISSION_LIST, ...Object.fromEntries(SIDE_ALL.map(q => [SIDE_PFX + q.slug, defById(SIDE_PFX + q.slug)])) }),
  NGPLUS, ALIGNMENT, shared, coopRun, coopHooks, partnerShown, partnerInfo, partnerMate, teamup: { info: teamupInfo, press: teamupPress, reset: resetTeamups, TEAMUP, TEAMUPS }, CFG, ENEMY_TYPES, LEVELS, BOSS_CFG, BOSS_MANDO, STANCES, SKILLS, MANDO, MANDO_WEAPONS, G, enemies, player, pillars, solids, rockets, bolts,
  startLevel, startWave, spawnEnemy, startTutorial, startMission, skipObjective, startSandbox, sandboxSpawn, sandboxClear, setSandboxKit, sandboxKitAll, missionState, twistState, skipStep, trainingProgress, lessonList, openLessonBoard, spawnBoss, queueSpawn, checkUnlocks, switchStance, setHero,
  openSkillTree, damageEnemy, damageBoss, updateHud, nextStoreGoal, enemyHpScale, eliteChance, ELITES, cycleQuality, forceBarrier, forceMend, updatePlayer, updateEnemies, updateBolts, fireBolt, endRun, updateFlow, startEndless, startEndlessWave, genEndlessWave, MUTATORS, ENDLESS_POWERS, buyPower, keys, camera, SEE, charFadeState, CHAR_SEE,
  tryAttack, castGesture, saberThrow, forcePush, forceSlam, forceRepulse, stance, applySwingDamage, spawnChampion, startWave, bomberExplode, MUSIC, audioInit,
  spawnBoss, updateBoss, bossStagger, BOSS_CFG, BOSS_MANDO, rings, finaleMove, spawnFinale,
  BOONS, BOON_BY_ID, rollBoons, pickBoon, hurtPlayer, abil, MASTERY_JEDI, MASTERY_MANDO, trainAbility, masteryNext, earnWavePoint,
  FOCUS, focusTier, focusDmgMul, focusRegenMul, addFocus, updateFocus, enemyDmgScale, applySwingDamage,
  hitMarker, spawnBlasterBolt, mandoWeapon, updateBolts, updateHud,
  hazardZones, updateHazardZones, hazardContains, setOverlayState, nav: { NAV, buildNav, updateNav, navSteer, navDist },
  duel: { DUEL, DUEL_PROFILES, MANDO_MELEE, LOCK, startLock, endLock, duelDefend, eliteRamp, foeBlade, bossBlade, contactPoint, bladeSegment, lockPush },
  scars: { scarBody, severLimbs },
  tactics: { RAMP, TROOP_MELEE, TROOP_FIRE, PINCER, ORDERS, GRENADE, LUNGE, tacticsRamp, grenades, pushGrenades },
  squad: { allies, spawnSquad, addSquadmate, squadOrder, hurtAlly, giveOrder, squadOrderName, squadFormation, grenadeLeft, wheelOpen, downed, duelRingOn, squadStance, setSquadStance, engageCode },
  aim: { heroAim, aimFrom, crosshairPoint, inAim, bossInAim, lastAim },
  zoneMap: { open: openZoneMap, close: closeZoneMap, info: zoneMapInfo },
  zone: { startZone, travelTo, zoneDistrict, stonesTouched, zoneStreamInfo, buildAllChunks, updateZoneStream, zoneStream, zoneQuest, zoneGivers, zonePatrols, zoneQuestMarks },
  get boss(){ return shared.boss; }, get finale(){ return shared.finale; }, get saberProj(){ return shared.saberProj; }, get darkProj(){ return shared.darkProj; } };

/* the battle maps (data/battlemaps.js): what's built and what it costs, for the console and tools/smoke/maps.mjs */
import { arenaInfo } from './world/arena.js';
import { ENDLESS_ARENAS } from './game/survival.js';
import { BATTLE_MAPS } from './data/battlemaps.js';
import { setSandboxMap } from './game/sandbox.js';
Object.assign(window.GAME, { cutHeight, pingHere, pingInfo, coopDrop, coopNet, arena: arenaInfo, ENDLESS_ARENAS, BATTLE_MAPS, setSandboxMap, gfx: { renderer, composer, scene, resolution: resolutionInfo }, killcam: { KC, killCam } });
import * as APPRENTICE from './allies/apprentice.js';
Object.assign(window.GAME, { growth: { ...GROWTH, streaming: growthStreaming } });   // the hub that grows with your group (game/hub-growth.js), for tests
import { SIM_WATCH } from './game/sim-watch.js';
Object.assign(window.GAME, { simWatch: SIM_WATCH });   // the combat sims' listeners (tools/duel-sim, trooper-sim, mando-sim)
Object.assign(window.GAME, { APPRENTICE });   // the Padawan, the foundling, the trooper's second (allies/apprentice.js), for tests
Object.assign(window.GAME, { bladeLook: BLADE_U });   // the lightsaber glow's live tuning (fx/blade-glow.js), for tests
Object.assign(window.GAME.duel, { info: duelInfo, practice: startPractice, challenge: duelChallenge, answer: duelAnswer, rematch: duelRematch, leave: leaveDuel, balcony: toBalcony, honours: duelHonours, open: openChallenge, testBlow: pvpTestBlow, guardAgo: pvpGuardAgo, incoming: pvpIncoming, pvp: pvpInfo });   // duel mode (game/duel-mode.js), for tests
Object.assign(window.GAME, { startCampaign, startChapter, nextChapter, chapters, campaignWon });
Object.assign(window.GAME, { gate: { start: startGate, open: gateOpen, veteranKit, finale: () => shared.finale } });   // ACT IV (game/gate.js), for tests
import { BS as battleSim, placeAt as battlePlace, enterSetup as battleEnter, startBattle, replayBattle, saveSetup as battleSave, loadSetup as battleLoad, clearSetup as battleClear } from './game/battlesim.js';
import { openBattleSetup } from './ui/battlesim-ui.js';
Object.assign(window.GAME, { battle: { BS: battleSim, open: openBattleSetup, enter: battleEnter, place: battlePlace, start: startBattle, replay: replayBattle, save: battleSave, load: battleLoad, clear: battleClear } });   // the sandbox's battle simulator (game/battlesim.js), for tests
Object.assign(window.GAME, { switchWeapon, setKit, grantGun, beskarPress });   // the Mando's loadout and beskar parry (game/armory.js, mando/weapons.js), for tests   // the campaign's chapters (game/campaign.js), for tests
import { queueMeditation } from './game/meditation.js';
import { queueAbilityCards, abilityCardUp } from './ui/ability-card.js';
Object.assign(window.GAME, { meditation: { queue: queueMeditation }, abilityCards: { queue: queueAbilityCards, up: abilityCardUp } });   // a form learned in a run: the unlock card and the loadout (game/meditation.js), for tests
Object.assign(window.GAME, { onSet: onSetFigures, calm: { on: calmOn, target: calmTarget, cfg: CALM_CFG } });   // the story's voice on set (game/onset.js) and the calm after a chapter (game/aftermath.js), for tests
Object.assign(window.GAME, { popups: { push: pushPopup, up: popupUp, waiting: popupsWaiting, toast: upToast, banner: showBanner, cfg: POPUPS } });   // one pop-up at a time (ui/popups.js), for tests
Object.assign(window.GAME, { clearComms, commsBusy, storyBeat, comms, doorState, calmOn, calmTarget, goThrough, doorDark, waitingUp, voteState });   // the story's voice lines (game/story.js), for tests
import { playScene, playOpening, playDuelIntro, playBossIntro, skipScene, sceneOn, shotInfo } from './game/cutscene.js';
Object.assign(window.GAME, { cutscene: { playScene, playOpening, playDuelIntro, playBossIntro, skipScene, sceneOn, shotInfo } });   // the cutscenes (game/cutscene.js), for tests
Object.assign(window.GAME, { objectiveInfo, holdObjectiveView });
Object.assign(window.GAME, { trails: { info: trailInfo, tune: TRAIL_TUNE } });   // every blade's streak (fx/trail.js), for tests and tuning   // HOLD O: the objective view (ui/objective-view.js), for tests

/* the battle past the edge (world/warfront.js), for tests and the art capture: what it's running, and a step to run it on */
import { warfrontInfo, updateWarfront } from './world/warfront.js';
Object.assign(window.GAME, { warfront: { info: warfrontInfo, step: updateWarfront } });
import { skywarInfo, skywarCue, updateSkywar, skywarState } from './world/skywar.js';
Object.assign(window.GAME, { skywar: { info: skywarInfo, cue: skywarCue, step: updateSkywar, state: skywarState } });

/* the form loadout (data/forms.js): the seven forms and what sits on 1 / 2 / 3 */
import { FORMS } from './data/forms.js';
import { setLoadout } from './player/jedi/stance.js';
Object.assign(window.GAME, { FORMS, setLoadout });

/* every map's level, for the art capture tool (tools/shots/maps.mjs): build any arena in place and frame it */
import { buildArena } from './world/arena.js';
import { findClearSpawn, edgeSpawn, solidsChanged } from './world/collision.js';
import { TRAINING_LEVELS } from './data/tutorial.js';
import { SANDBOX_LEVELS } from './data/sandbox.js';
import { MISSIONS } from './data/missions.js';
import { startGate, gateOpen, veteranKit } from './game/gate.js';
const byLayout = id => Object.values(MISSIONS).find(m => m.level && m.level.layout === id).level;
Object.assign(window.GAME, { MISSIONS });   // dev console / tests: the story missions as data
Object.assign(window.GAME, { buildArena, findClearSpawn, edgeSpawn, mapLevels: () => ({
  temple: LEVELS[0], foundry: LEVELS[1], plains: LEVELS[2],
  archive: { ...LEVELS[0], layout: 'archive', arena: 60 }, sith: { ...LEVELS[2], layout: 'sith', arena: 64 },
  hall: TRAINING_LEVELS.jedi, forge: TRAINING_LEVELS.mando, dojo: SANDBOX_LEVELS.jedi, throne: SANDBOX_LEVELS.mando,
  refuge: MISSIONS.refuge.level, pursuit: MISSIONS.pursuit.level, prison: byLayout('prison'), pens: MISSIONS.pens.level, jedhaNight: MISSIONS['jedha-night'].level,
  hangar: byLayout('hangar'), approach: MISSIONS['strike-exegol'].level,
  outpost: { ...LEVELS[0], layout: 'outpost', arena: 60 }, covert: MISSIONS.covert.level,   // (the Mando's story: data/campaign-mando.js)
  jungle: MISSIONS.order66.level, shipyard: { ...LEVELS[0], layout: 'shipyard', arena: 84 }, garrison: MISSIONS.killhouse.level, frigate: MISSIONS.chipfiles.level,   // (the ARC trooper's story: data/campaign-trooper.js)
  kamino: MISSIONS.drowned.level, chipworks: MISSIONS.chipworks.level, warcamp: MISSIONS.warcamp.level, canyon: MISSIONS.hunt.level, relay: MISSIONS.broadcast.level,
  barge: MISSIONS.gallows.level, holdfast: MISSIONS.holdfast.level, citadel: { ...LEVELS[2], layout: 'citadel', arena: 64 },
  meltworks: MISSIONS.meltworks.level, ironroad: MISSIONS['iron-road'].level, sithGate: MISSIONS['gate-heart'].level,
  ...Object.fromEntries(ALL_WINGS.map(({ W }) => [W.level.layout, W.level])),   // every hub's wings: the temple's, the citadel's… (data/hub.js)
  grassland: BATTLE_MAPS.grassland.level, icefront: BATTLE_MAPS.icefront.level, graveyard: BATTLE_MAPS.graveyard.level,
}) });
import { arcadeContract, arcadeBoard, missionById } from './data/arcade.js';
Object.assign(window.GAME, { arcade: { arcadeContract, arcadeBoard, missionById }, secrets: { placed: secretsPlaced } });   // the arcade's dealt contracts (data/arcade.js), for tests
Object.assign(window.GAME, { navRoute, foeType });   // (tests: can a spot be walked to, and how a foe type is dressed here: tools/smoke/zone-ruins.mjs)
import * as forceLevelData from './data/force-level.js';
import { trainForm } from './game/upgrades.js';
Object.assign(window.GAME, { force: { ...forceLevelData, trainForm } });   // the Jedi's Force Level, form shares and form mastery (data/force-level.js), for tests
import { duelOf as bubbleDuelOf } from './enemies/bubble.js';
import { BUBBLE as BUBBLE_CFG } from './data/duel-bubble.js';
import { localPlayer as bubbleHero } from './player/players.js';
Object.assign(window.GAME, { bubble: { cfg: BUBBLE_CFG, duelOf: bubbleDuelOf, get on(){ return !!bubbleDuelOf(bubbleHero); } } });   // the duel bubble (enemies/bubble.js), for tests
/* the ARC trooper's cover fight (player/trooper/cover.js, enemies/coverfight.js), for tests and tools/trooper-sim */
import * as TROOPER_COVER from './player/trooper/cover.js';
import * as COVER_FIGHT from './enemies/coverfight.js';
import { TROOPER_STORE, TROOPER_SKILLS } from './data/trooper-progression.js';
import { clearSquad } from './allies/squad.js';
Object.assign(window.GAME, { cover: TROOPER_COVER, coverFight: COVER_FIGHT, trooperProg: { TROOPER_STORE, TROOPER_SKILLS } });
window.GAME.squad.clearSquad = clearSquad;
window.GAME.guard = { guardMeets, guardState, baitGuards, pvpOn };   // the soft directional block and the feint (player/jedi/guardline.js, enemies/duel.js)
Object.assign(window.GAME, { hub: { startHub, goWing, hubs: HUBS, get wings(){ return curHub().wings; }, get id(){ return GAME.G.hubId; }, welcome: { get state(){ return welcomeState(); }, get stops(){ return welcomeStops(); }, get target(){ return welcomeState().target; }, forget: forgetWelcome, open: replayWelcome, tour: replayTour }, news: { get noted(){ return newsNoted(); }, forget: forgetNews }, launch: hubLaunch } });   // the hubs (game/hub.js), for tests and shots: wings are the current hub's
// the post-game (data/ngplus.js, game/profile.js): what the NEW GAME+ smoke suite (tools/smoke/ngplus.mjs) reads
import { CUSTOMIZE as CUSTOMIZE_ROWS } from './data/customize.js';
import { optionOpen as lookOpen } from './game/wardrobe.js';
import { captureRun as captureCampaignRun } from './game/saves.js';
import { SIDE_QUESTS as SIDE_LIST } from './data/side-quests.js';
import { pushPopup, popupUp, popupsWaiting, POPUPS } from './ui/popups.js';   // one pop-up at a time
import { showBanner } from './ui/banners.js';
import { upToast } from './game/upgrades.js';
Object.assign(window.GAME, { CUSTOMIZE: CUSTOMIZE_ROWS, optionOpen: lookOpen, captureRun: captureCampaignRun, SIDE_QUESTS: SIDE_LIST });
import * as GUN_MOVES_RT from './player/gun-moves.js';
import { GUN_MOVES as GUN_MOVES_DATA } from './data/gun-moves.js';
import { crosshairRay as XRAY } from './player/aim.js';
Object.assign(window.GAME, { gunMoves: { ...GUN_MOVES_RT, DATA: GUN_MOVES_DATA, ray: XRAY } });   // the guns' signature moves and mastery (player/gun-moves.js), for tests
import * as CREED_RT from './game/creed.js';
import { MANDO_SKILLS } from './data/skills.js';
import { PATH_TREE, PATH_WORDS } from './data/alignment.js';
Object.assign(window.GAME, { creed: { ...CREED_RT, MANDO_SKILLS, TROOPER_SKILLS, PATH_TREE, PATH_WORDS } });   // the gunners' light and dark cards (game/creed.js), for tests
import * as RAIDS_RT from './data/raids.js';
import * as RUN_STATE from './game/run-state.js';
import './fx/cues.js';   // what a quiet callout does instead of its word (data/callouts.js)
import { wordUp, wordStats, clearWords, floater as sayWord, callout as sayBig } from './fx/floaters.js';
import { CALL as CALLOUTS, rankOf as calloutRank } from './data/callouts.js';
Object.assign(window.GAME, { raids: RAIDS_RT });   // the raids (data/raids.js): what the raid smoke suite (tools/smoke/raid.mjs) reads
Object.assign(window.GAME, { words: { up: wordUp, stats: wordStats, clear: clearWords, say: sayWord, big: sayBig, rank: calloutRank, cfg: CALLOUTS } });   // one word at a time (fx/floaters.js, data/callouts.js), for tests
