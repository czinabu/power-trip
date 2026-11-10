// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Shared run state: G (run/session state), the player object, entity arrays, held keys, and `shared` for values that get reassigned.

import * as THREE from 'three';
import { CFG } from './data/config.js';
import { V3 } from './utils.js';

/* Values that get REASSIGNED during play live here (ES module imports are read-only),
   so every file reads and writes them as shared.<name>. */
export const shared = {
  AC: null,
  masterGain: null,
  // MASTER VOLUME — a single gain node every sound (sfx/hum/music) routes through, so one slider controls all of it.
  masterVol: (() => { const v = parseFloat(localStorage.getItem('sw_vol')); return isNaN(v) ? 1 : Math.max(0, Math.min(1, v)); })(),
  boss: null,
  finale: null,     // a final boss fought on a duellist's body (boss/finale.js): Darth Vexis. It is also in `enemies`
  saberProj: null,
  offProj: null,    // Jar'Kai's off-hand saber thrown on its own (player/jedi/force.js): the right one fights on meanwhile
  darkProj: null,   // the Mando's thrown Darksaber, in flight or being reeled back (player/mando/darksaber.js)
  bossLight: null,
  _barrierMesh: null,
  _grappleLine: null,
  arenaGroup: new THREE.Group(),
  arenaHalf: 20,
  arenaHalfZ: 20,   // half the depth (north–south): the same as arenaHalf except on a long arena (L.arenaZ, the pursuit route)
  arenaLevel: null, // the level definition the arena was built from
  arenaBig: false,  // a battle map (world/arena.js BIG_ARENA): spawns, pathing, light and the sky dome follow the hero
  arenaLayout: 'temple',   // which authored layout is up (temple | foundry | plains) — picks the ambience, reverb and music palette
  ambient: null,   // drifting embers / ash / dust
  templeBrazier: null,
  refugeShip: null,   // the story mission's transport (world/arenas/refuge.js), animated by game/mission.js
  levelPhase: 'idle',   // the level's phase: written only through setPhase (game/run-state.js PHASES has every value and move)
  phaseT: 0,
  lockFallback: false,   // pointer lock unavailable (e.g. embedded preview) — play with plain mouse-move look
  lockWorked: false,     // pointer lock has succeeded at least once, so a refusal is transient (Esc cooldown), not unsupported
};

/* ============================================================
   GAME STATE
   ============================================================ */
export const G = {
  mode: 'menu',          // the screen: menu | play | dead | victory, written only through setScreen (game/run-state.js SCREENS)
  paused: false,         // true while the pause/ESC overlay is up — freezes the whole sim
  cutscene: false,       // a cutscene is playing (game/cutscene.js): the fight holds, the lens and the input are the scene's
  duel: null,            // a duel is on (game/duel-mode.js): { rule, pvp, widen }; levels both fighters and keeps the ring
  skillSelect: false, skillPoints: 0, skillSpent: 0,   // between-wave skill-tree pause
  saberGrip: 'regular',   // player preference: 'regular' or 'reverse' lightsaber grip (visual only)
  formFork: null,        // this run's Form VII: 'juyo' or 'vaapad' once chosen (game/meditation.js)
  missionForms: null,    // the three forms chosen before a mission (ui/forms-ui.js)
  strafeMode: 'toggle',  // player preference: ALT strafe is a 'toggle' (press on, press off) or a 'hold' (player/strafe.js)
  guardRings: 'fading', // player preference: a duellist's guard ring, 'fading' | 'always' | 'off' (enemies/guardcue.js)
  aimHint: true,        // player preference: the Jedi's crosshair turns red on a foe (ui/hud.js); off for a challenge
  swingMirror: false,   // player preference: flips which way strafe-L/R directional cuts sweep
  saberAssist: 'low',   // player preference: the per-cut saber aim assist, 'low' | 'normal' | 'off' (data/saber-assist.js)
  cutMouse: false,       // player preference: a mouse flick just before a cut picks its angle (off by default: the keys do)
  mouseSens: 1,          // player preference: mouse look sensitivity multiplier
  adsSens: 0.4,          // player preference: share of it while the disruptor is scoped in
  padSens: 1,            // player preference: gamepad right-stick look speed multiplier (engine/gamepad.js)
  padInvert: false,      // player preference: gamepad look up/down inverted
  padAssist: true,       // player preference: controller aim assist for the blasters (player/aim-assist.js)
  flashScale: 1,         // player preference: full-screen flash brightness (0 = off, 1.5 = extra)
  camSway: 0.8,          // player preference: how much the Jedi's camera trails him as he moves (1 = Jedi Academy's, 0 = none)
  skywar: 'auto',   // player preference: how much of the sky battle over a battle world plays (Settings · SKY BATTLE, world/skywar.js)
  finSlow: true, finCam: true,   // player preference: a saber finisher's slow-motion beat and its camera push (Settings · FINISHERS)
  killCam: true,         // player preference: THE KILL CAM, a big kill's short cinematic shot and slow motion (engine/killcam.js)
  rumble: 1,             // player preference: controller rumble strength (0 = off, 1.5 = extra; engine/rumble.js)
  shakeScale: 1,         // player preference: screen shake strength (0 = off, 1.5 = extra)
  fov: 60,               // player preference: resting vertical FOV in degrees (the FOV slider, 50-90)
  sbMenu: false,         // the sandbox B panel is open (same cinematic cuts as the pause screen)
  sbPlan: false,         // the sandbox's battle setup is up: the sim holds still under an overhead view (game/battlesim.js)
  fovPreview: false,     // the FOV slider is being adjusted: settings fade away to show the live in-game view
  levelIdx: 0, wave: 0, waveTotal: -1,   // waveTotal = cumulative waves started (drives Mando ability unlocks)
  waveFrom: 0, waveEnd: null,            // the stretch of the level's waves being played (a campaign chapter's, game/flow.js)
  chapter: -1, actTwo: null, cardUp: false,   // the campaign's chapter (-1: not in one), Act II's pick, the chapter card is up (game/campaign.js)
  yaw: 0, pitch: 0.08,
  hitstop: 0, shake: 0, slowmo: 1, slowmoT: 0,
  gt: 0,
  streak: 0, streakT: 0,
  spawnQueue: [],
  unlocked: {},
  stance: 'niman', stanceCd: 0,
  loadout: ['ataru', 'niman', 'djemso'],   // the forms on 1 / 2 / 3 (data/forms.js DEFAULT_LOADOUT)
  mandoKit: null,        // the Mando's guns on 1 / 2: { sidearm, primary } (data/mando.js KIT_SLOTS); null = RUN_KIT
  hero: 'jedi',          // 'jedi' (saber/Force), 'mando' (jetpack/blasters) or 'trooper' (clone ARC trooper) — chosen on the menu
  // SURVIVAL / ENDLESS mode
  modeSel: 'campaign',   // menu pick: 'campaign' | 'endless' | 'training' | 'mission' | 'sandbox' | 'temple' | 'zone' (an open zone: game/zone.js)
  story: {},             // the campaign story's choices so far, { choice id: answer } (game/choices.js), saved with the run
  storyHero: null,      // whose story a campaign run tells (data/campaign.js storyHero): null is the hero's own; a co-op guest takes the host's
  missionId: 'refuge',   // which story mission (data/missions.js) the menu's MISSIONS list has picked
  endless: false,        // true while a survival run is active
  training: false,       // true while the tutorial runs (game/tutorial.js)
  mission: false,        // true while a story mission runs (game/mission.js)
  sandbox: false,        // true while the sandbox runs (game/sandbox.js)
  hub: false,            // true while the hidden temple on Tython, the hub, is up (game/hub.js)
  hubId: 'temple',       // ...which hub (data/hub.js HUBS: one per hero)
  hubWing: 'hall',       // ...which of its wings (data/hub.js)
  fromHub: false,        // this run was started from the temple: its end screens offer the way back (ui/menus.js)
  zone: null,            // the open zone being roamed (data/zones.js ZONES key, 'jedha'), or null (game/zone.js)
  zoneSel: 'jedha',      // ...the one a hub station or a party is taking you to
  zoneFallT: 0,          // s left before a hero fallen in a zone wakes at a waystone (game/zone.js)
  sandboxGod: false,     // the sandbox's god mode: the hero can't fall
  calm: false,           // the calm after a chapter's last fight (game/aftermath.js): the chapter is won, nobody falls
  forceElite: false,     // set while the sandbox spawns its ELITE foes
  endlessWave: 0,        // current survival wave (1-based)
  mut: null,             // active wave mutator id (or null)
  ngPlus: 0,             // NEW GAME+ tier of the campaign run (0: a first run; game/ngplus.js)
  ngNext: null,          // ...the tier the next BEGIN starts at, armed by the NEW GAME+ button (null: as it was)
  ngMuts: [],            // the NG+ chapter's (or a veteran side mission's) mutators, stacked on top of G.mut
  arenaRot: 0,           // which authored arena the survival run is currently on
  resumeRun: null,       // a loaded save's campaign run, waiting on the menu's CONTINUE CAMPAIGN (game/saves.js)
};
/* THE HEROES. The Jedi fights with a blade; the Mandalorian and the clone trooper are GUNNERS: a floating reticle,
   blaster bolts, heat, aimed fire. Code that is about guns asks isGunner(); code that is the Mando's own kit (the
   jetpack, the darksaber, the flamethrower, the E boxing kit) asks isMando(). heroKey() picks a hero's entry from per-hero data
   ({ jedi, mando, trooper }), falling back to the Mando's for a trooper entry not written yet. */
export const isMando = (h = G.hero) => h === 'mando';
export const isTrooper = (h = G.hero) => h === 'trooper';
export const isGunner = (h = G.hero) => h === 'mando' || h === 'trooper';
// THE JETPACK is earned: the Armorer forges it at the close of Act I (data/store.js MANDO_AUTO 'jet1'). Until then the
// Mando fights on his feet (jet tier 0: no pack on his back, no fuel, no flight). ownsPack: this run holds it, whatever
// the hero; hasPack: the hero in play is a Mando wearing it
export const ownsPack = () => ((player.up && player.up.jetTier) || 0) >= 1;
export const hasPack = (h = G.hero) => h === 'mando' && ownsPack();
export const heroKey = (obj, h = G.hero) => obj ? (obj[h] !== undefined ? obj[h] : h === 'trooper' ? obj.mando : obj.jedi) : obj;

export let rockets = [], birds = [], detos = [], grapples = [];   // mando projectiles / hooks
export const enemies = [], bolts = [], orbs = [], barrels = [], vents = [], rings = [], vfx = [], pillars = [], solids = [], hazardZones = [];

export const keys = {};

/* ============================================================
   PLAYER
   ============================================================ */
/* the player's state, fresh. One is `player`, the hero you play; player/stand-in.js makes more for the heroes the game
   plays itself (a hero-class squadmate), and runs the hero's own animation on them by swapping one in for a moment */
const makePlayer = () => ({
  group: new THREE.Group(),
  vis: null,                     // visual rig — flips/leans without moving the logic root
  hp: CFG.player.maxHp, force: CFG.player.maxForce,
  vy: 0, grounded: true, airLeft: CFG.player.airJumps,
  vel: V3(0,0,0),               // impulse velocity (lunge/dash)
  moveVel: V3(0,0,0),           // input velocity with momentum
  faceYaw: 0, flip: null, queuedAtk: false,
  atkT: 0, comboStep: 0, lastAtkEnd: -9, swing: null,
  dashT: 0, lastHurt: -9,
  dashCharges: null, dashRecharge: 0, dodgeKind: null,   // Force dash charges (player/mobility.js); null = full
  stam: CFG.player.maxStam, stamDelay: 0, lastWinded: -9, exhausted: false, gbT: 0, heartT: 0,
  blockHeld: false, blockT: 0, parryT: 0, riposteT: 0,
  beskarT: 0, beskarLockT: 0, beskarPose: 0, beskarHit: false, spin: 0, burstLeft: 0, burstT: 0,   // the Mando's beskar parry (data/mando.js BESKAR_PARRY) · the repeater's spin-up · a carbine burst in flight
  castT: 0, castMax: 0.3, castKind: '', swingFlip: false,   // force-cast hand gesture + neutral swing alternator
  holstered: false, wardHit: null, lead: 'L', palmT: 0, palmMax: 0, palmStep: 0, palm: null, palmQueued: false, lastPalmEnd: -9, palmHold: null, lastPalmHit: -9, pullStrikeT: 0, stomp: false, kickKind: '',   // Jedi saber on the belt + the Force strike string (jedi/palm.js)
  // skill-tree upgrade multipliers/bonuses (reset each new campaign)
  up: { dmg: 1, forceRegen: 1, move: 1, knock: 1, parry: 0, lifesteal: 0, hpMax: 0, dashCdMult: 1, stamRegen: 1, maxStam: 0,
        atkSpeed: 1, dr: 0, blockStam: 1, riposte: 1, parryForce: 0,
        fireRate: 1, fuelEff: 1, flameDmg: 1, flameRange: 1, rocketDmg: 1, rocketR: 1, braceDR: 0, aim: 0, darksaber: false, abilityCostMul: 1 },
  skills: {},   // id → rank taken in the skill tree
  judgeT: 0, judgeTick: 0, judgeTargets: [],
  barrierT: 0, mendT: 0, mendMax: 0.7,
  cancelT: -9, cancelDR: 0, swingLock: 0,   // swing-cancel system: riposte-window timestamp, brief DR, re-swing lockout
  runPhase: 0,
  cds: { roll:0, push:0, slam:0, throw:0, dash:0, pull:0, judge:0, repulse:0, barrier:0, mend:0, rocket:0, flame:0, dark:0, birds:0, deto:0, grapple:0, missile:0, bacta:0, darkThrow:0, throwOff:0, airCut:0, airDodge:0, slide:0, scan:0, bshield:0, ion:0, breach:0, artillery:0, strafe:0 },
  saberPivot: null, saberHand: null, blade: null, rig: null,
  // mando
  fireCd: 0, firePistol: 1, firing: false, trigHeld: false, guardDropT: 0, jetActive: false, mandoParts: null, pistols: null, lockOn: false,
  darkT: 0, darkApplied: false, darksaberMesh: null, darkLight: null,
  weapon: 'single', drawnWeapon: 'single', heat: 0, overheat: false, ventT: 0, heatDelay: 0, grappleActive: null,
  zoom: false, aiming: 0, recoilKick: 0,
  jet: 100, jetMax: 100, stabT: 0,   // dedicated jetpack FUEL (separate from ability Force); disruptor stab timer
  aimOff: { x: 0, y: 0 },            // screen-space crosshair drift (free-aim like BF2 / Helldivers)
});
export const player = makePlayer();
export const freshPlayerState = makePlayer;

/* THE BOSS ON THE FIELD, whichever kind he is: the old state-machine boss (shared.boss: the Iron Magistrate) or a final
   boss fought on a duellist's body (shared.finale: Darth Vexis, boss/finale.js). Anything that asks "is the boss fight
   on, and where is he?" asks this; what can hurt or target him goes by the kind (shared.boss's own damageBoss, or the
   foe in `enemies` like any other). */
export const bossUp = () => (shared.boss && shared.boss.hp > 0 ? shared.boss : null) || (shared.finale && !shared.finale.dead && shared.finale.hp > 0 ? shared.finale : null);
