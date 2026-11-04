// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BOSS_CFG (Darth Vexis) and BOSS_MANDO tuning.


/* BOSS GAIT — the bosses move on the troopers' legs (enemies/gait.js) and the hero's ground handling (data/movement.js),
   but they are heavy: they gather speed and brake slower, turn slower while walking up, take the stride with less bob and
   lean, and every footfall at a stride thuds the ground. They PACE (the captured walk) until phase III, then run. */
export const BOSS_GAIT = {
  accel: 12, brake: 26,   // m/s² (the hero's: 22 / 46)
  turn: 5,                // rad/s while walking up (the hero's roaming turn: 10); his attacks still aim as before
  pivotAngle: 2.4, pivotTime: 0.3, pivotMinSpeed: 4,   // a hard reversal at speed plants the feet for a long beat
  bob: 0.6, lean: 0.55,   // the stride's hip bob and the lean into acceleration, as a share of a trooper's
  thudRange: 16, thud: 0.16, dust: 0xb09a7a,   // footfalls within this range (m) of the hero shake the camera
};

/* BOSS — DARTH VEXIS. Edit phases, damage, timing windows here. */
export const BOSS_CFG = {
  name: 'DARTH VEXIS — HERALD OF THE VOID',
  hp: 1800,                    // sized for a late-run build: posture breaks and reflects open him up, so the bar has to last
  speed: [4.6, 5.6, 7.0],      // per phase
  phaseAt: [1.0, 0.66, 0.33],  // hp fraction thresholds for phases 1/2/3
  armor: 0.42,                 // damage multiplier when NOT stunned/vulnerable (chip damage now matters)
  phaseResist: [1.0, 0.85, 0.7],   // EXTRA damage taken per phase — late phases shrug off high-tier tools (no trivializing)
  // ANTI-CHEESE: no single blow can exceed this fraction of max HP (rewards a set-up burst over one-shot ults);
  // and after an ability-stagger he RESISTS the next for `staggerImmune`s so you can't stun-lock him with abilities.
  hitCapBase: 0.10, hitCapVuln: 0.18, staggerImmune: 3.4,
  // longer, clearer wind-ups → his combo is reliably PARRYABLE; a parry throws the duel wide open
  // POSTURE: parrying an early swing only deflects it (the chain continues after `deflectGap` × windup); parrying
  // the LAST swing breaks him open for `breakTime`. Letting a chain finish leaves a shorter `whiffTime` opening.
  // vulnTime is the base length of an ability stagger (bossStagger).
  // CLASH: a cut of yours that meets one of his early blows throws him back a step; the chain resumes after
  // `clashGap` × windup (a clash never breaks his posture: parry for that).
  combo: { swings: 3, windup: 0.62, dmg: 14, range: 4.4, vulnTime: 2.0, deflectGap: 0.85, clashGap: 1.0, breakTime: 2.2, whiffTime: 1.2 },
  retreat: { dist: 8, time: 0.4 },   // up close with lightning ready, he slides back out of reach before casting
  lightning: { dur: 2.4, durP3: 3.6, tick: 0.28, tickDmg: 6, catchTime: 0.95,
               reflectStun: 2.5, reflectDmg: 130, cd: 6.5 },   // reflecting his storm is a huge payoff (damage × phaseResist)
  pulse: { dmg: 18, growSpeed: 16, maxR: 17, cd: 6.0, rings: [1, 2, 3] },  // phase 2+ NOVA: more concentric waves late — dash/jump each
  blink: { cd: 7, range: 13, dist: 3.0 },                 // ANTI-KITE: dark-blink onto a kiting player, then strike
  summon: { grunt: 3, blaster: 2 },                      // phase 3 entry
};

/* HIS CUTS — the bosses swing real cuts too (boss/boss.js bossCutPose), not one chop over and over: each blow of a chain
   is a different one of these, never the same line twice running, and the chain's last blow is always `last`.
   Keys are [pivot.x (the shoulder: − tips the arm forward, + back), pivot.z, hand.z (the blade's angle across the
   front: 0 straight up, + toward his left, − his right, ±π down)]. wind is the tell he coils to; the blade comes
   through `mid` as the blow lands (`release` of the wind-up before it: the cut's start) and on to `end` over `follow` s.
   line is where it arrives on you (data/duel.js GUARD_LINE): your guard goes to meet it there. step: how far he
   drives in with it (m). */
export const BOSS_CUTS = {
  rest: [0, 0, -0.6],
  release: 0.2, follow: 0.2,
  cuts: {
    diagR:    { line: 'R', wind: [0.35, 0, -1.25], mid: [-1.45, 0, -0.35], end: [-0.5, 0, 2.3], twist: [0.4, -0.35] },
    diagL:    { line: 'L', wind: [0.3, 0, 1.35],   mid: [-1.45, 0, 0.35],  end: [-0.5, 0, -2.2], twist: [-0.3, 0.35] },
    flatR:    { line: 'R', wind: [-1.2, 0, -1.7],  mid: [-1.5, 0, 0],      end: [-1.25, 0, 1.7], twist: [0.45, -0.4] },
    riseL:    { line: 'L', wind: [-0.25, 0, -2.6], mid: [-1.4, 0, -0.2],   end: [0.25, 0, 1.25], twist: [0.3, -0.3] },
    overhead: { line: 'H', wind: [0.95, 0, 0.1],   mid: [-1.35, 0, 0.05],  end: [-2.2, 0, 0.1],  twist: [0.15, -0.1], step: 0.4 },
  },
  order: ['diagR', 'flatR', 'diagL', 'riseL'],
  last: 'overhead',
};

/* THE IRON MAGISTRATE — the MANDO's boss (chosen when you fight as the Mandalorian). A beskar warlord built to
   counter the hunter: heavy ARMOR shrugs off chip fire (reward precision/braced shots & rockets), and instead of
   Force lightning he unloads a sustained BLASTER BARRAGE you must BRACE, break line-of-sight on, or darksaber-deflect.
   Tougher than Vexis so the Mando's range/armor kit actually gets tested. Reuses the boss state machine via boss.kind. */
export const BOSS_MANDO = {
  name: 'THE IRON MAGISTRATE — WARLORD OF THE OUTER RIM',
  hp: 2100, armor: 0.52,
  phaseResist: [1.0, 0.84, 0.68],   // later phases resist explosives / the Darksaber / heavy ordnance
  hitCapBase: 0.10, hitCapVuln: 0.18, staggerImmune: 3.4,   // same anti-burst / anti-stunlock guard as Vexis
  combo: { swings: 3, windup: 0.62, dmg: 14, range: 4.4, vulnTime: 2.0 },   // his melee opening (shared by the stagger DR)
  barrage: { fireGap: 0.15, dmg: 12, boltSpeed: 34, spread: 1.1 },   // sustained stream during the "lightning" slot
  volley: { cd: 7, rounds: 4, gap: 0.17, dmg: 17, boltSpeed: 30, lead: 0.28 },   // a quick AIMED burst that leads your strafe
  pulse: { rings: [1, 2, 3] },     // his jetpack ground-pound gains extra shock rings late
  blink: { cd: 8, range: 11 },     // ANTI-KITE: a jet CHARGE straight at a kiting hunter
};

/* ============================================================
   DARTH VEXIS — the Jedi's final boss, fought on a duellist's body (boss/finale.js, boss/vexis.js)
   ============================================================
   He is a named duellist like the Grand Inquisitor (the Sith acolyte's body, the saber cast's look 'DARTH VEXIS', the
   duel system's guards, feints, strings and saber locks) with a final boss's fight laid over it: three phases that look
   and play differently, and signature moves that each have one clear answer, shown in the shared tell colours
   (fx/tells.js: parry = white and red, dodge = red, area = amber).
     I   THE DUELLIST   a Juyo master: strings, feints, locks. A held block is broken by his GUARD BREAKER, and a hero who
                        backs off gets his saber thrown after them
     II  THE FORCE      + lightning you catch on your guard and throw back (parry a surge, or Push), the choke, the repulse
     III UNLIMITED POWER the lights die; + blink chains, the lightning storm, and one last stand at the end
   Every number below is his; the duel profile keys are data/duel.js's. */
export const VEXIS = {
  id: 'vexis', codex: 'sith',
  name: 'DARTH VEXIS', title: 'DARTH VEXIS — HERALD OF THE VOID', look: 'DARTH VEXIS',
  intro: 'Herald of the Void',
  phases: ['THE DUELLIST', 'THE FORCE', 'UNLIMITED POWER'],   // the boss bar's name for each phase
  phaseLines: ['', 'Enough swordplay.', 'The dark answers me.'],   // the banner as each phase begins
  fallLine: 'DARTH VEXIS FALLS',
  type: 'acolyte',                 // the body and the duelling AI he fights on (data/enemies.js)
  hp: 1300, dmg: 1.3, scale: 1.24, speed: 1.05,   // hp (before difficulty and co-op), × the acolyte's damage, size, pace
  form: 'juyo', rank: 'master',    // his form (data/foe-forms.js BOSS_FORM.sith) and its repertoire (FORM_SWITCH.boss.sith)
  phaseAt: [0.66, 0.33],           // hp fractions where phase II and phase III begin
  // the duel profile per phase, laid over the Juyo master's own (data/foe-forms.js foeProfile)
  duel: [
    { posture: 240, feint: 0.36, delay: 0.32, chain: 3, counter: 0.7, thrust: 0.2, parry: 0.7, finisher: 0.85, stam: 220 },
    { posture: 220, feint: 0.4,  delay: 0.34, chain: 3, counter: 0.74, thrust: 0.22, parry: 0.72, finisher: 0.9, stam: 220 },
    { posture: 200, feint: 0.42, delay: 0.36, chain: 4, counter: 0.8, thrust: 0.24, parry: 0.75, finisher: 0.95, stam: 240 },
  ],
  pace: [1, 1.06, 1.16],           // × his speed per phase
  // ANTI-CHEESE — no blow takes more than this share of his bar (more when he's staggered open); later phases shrug off
  // a little of everything; a Force power that would floor a foe only rocks him
  hitCap: 0.07, hitCapOpen: 0.13, phaseResist: [1, 0.9, 0.8],
  // and however the blows come (a finisher's whole string, a chain of openings), no more than this share of his bar goes
  // in any burstWin seconds: an opening is worth a good chunk, never a phase
  burstCap: 0.16, burstWin: 1.6,
  // between moves: how long he duels before he reaches for a signature (s), and how soon one can follow another
  sigGap: [5.5, 4.2, 3.2], sigMin: 2.2,
  // THE PHASE BEAT — the blow that crosses a threshold drives him to a knee; he rises in the next phase with a repulse
  beat: { kneel: 1.3, rise: 0.9, slowmo: 0.35, slowT: 0.7, ring: { r: 9, dmg: 14 }, push: 11 },
  // THE DEFEAT — on his knees, the blade dies; then the story (or the floor back, in the sandbox)
  defeat: { kneel: 3.2, slowmo: 0.3, slowT: 1.2, xp: 1400 },
  moves: {
    // I+ GUARD BREAKER: you've held a block in his face too long. A Force palm that shatters a held guard (the parry tell)
    guardBreak: { from: 1, held: 1.4, range: 4.2, windup: 0.6, dmg: 16, knock: 12, cd: 7 },
    // I+ SABER THROW: you've backed off. The blade spins out at you and back to his hand; he has no guard while it flies
    throw: { from: 1, minDist: 8.5, maxDist: 24, windup: 0.55, speed: 24, reach: 1.3, dmg: 20, turn: 0.9, cd: 10, open: 1.4 },
    // II+ FORCE LIGHTNING: catch it on a raised guard facing him. Held, it drives you back and drains stamina; PARRY one of
    // its surges (the white flash) or Force PUSH into it, and it goes back into him
    lightning: { from: 2, minDist: 4.5, maxDist: 18, windup: 0.5, dur: 3.0, durP3: 3.8, tick: 0.25, dmg: 6, caughtDmg: 1.2,
                 stam: 26, shove: 2.6, surge: [0.9, 1.2], surgeTell: 0.32, reflectDmg: 120, stun: 2.6, cd: 11 },
    // II+ FORCE CHOKE: the marked ring under you closes; be out of it (dash) when it does, or PUSH him to break it
    choke: { from: 2, minDist: 3.5, maxDist: 13, windup: 0.95, r: 2.2, hold: 1.2, tick: 0.2, dmg: 4, throwDmg: 10, throwKnock: 14, cd: 14 },
    // II+ REPULSE: crowd him and he blasts the ground clear (dodge it)
    repulse: { from: 2, crowd: 3.4, after: 2.2, windup: 0.55, r: 8, dmg: 16, knock: 10, cd: 9 },
    // III BLINK CHAIN: he goes to smoke and comes out beside you, again and again; each cut is parryable
    blink: { from: 3, count: 3, gap: 0.62, tell: 0.36, dist: 2.6, dmg: 18, cd: 12 },
    // III LIGHTNING STORM: from the middle of the floor, bolts fall on marked spots spreading out from him; move off them
    storm: { from: 3, dur: 5.5, every: 0.18, r: 1.8, tell: 0.75, dmg: 18, spread: [3, 16], cd: 17 },
    // III LAST STAND (once, at this share of his bar): a charged lunge the length of the floor; dodge it and he is wide open
    lastStand: { at: 0.12, windup: 1.4, speed: 30, dmg: 34, open: 3.4 },
  },
  // his Force lightning's look (boss/vexis.js): violet-white, three strands from his fingers
  lightningColor: 0xb46bff, lightningCore: 0xf2e6ff, caughtColor: 0x9fe0ff,
  // the arena in phase III (world/atmosphere.js setMood): the lights go down, the fog turns to blood
  mood: { fill: 0.5, sun: 0.35, rim: 1.5, sky: 0.35, fog: 0x2a0710, blade: 1.35, near: 0.7, far: 0.75 },
};
