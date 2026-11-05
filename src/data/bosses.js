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

/* ============================================================
   THE IRON MAGISTRATE — the Mandalorian's final boss, fought
   on the final boss layer (boss/finale.js, boss/magistrate.js)
   ============================================================
   A beskar warlord on a purge lancer's body (its legs, its spear work), in his own armour (enemies/mesh.js magistrate).
   Built to be beaten with a gun as much as a blade: every move has an answer a blaster, a dash or a flank can give, in
   the shared tell colours (fx/tells.js: parry = white and red, dodge = red, area = amber).
     I   THE WALL       a round beskar shield turns fire from the front: flank him, or make him attack and punish the
                        opening. His SPEAR CHARGE runs the length of a marked line and leaves him stuck if it misses;
                        crowd him and the SHIELD BASH throws you off
     II  FIRE FROM ABOVE the shield is gone; he takes to the air: a ROCKET BARRAGE onto marked ground and a GROUND POUND
                        where he lands, a FLAMETHROWER sweep up close, and a JET LEAP onto you if you run
     III CRACKED BESKAR his armour splits: every big move ends with the cracks VENTING (a weak point: hit him then),
                        HOMING ROCKETS that follow you and lock late, and one last JET CHARGE across the floor */
export const MAGISTRATE = {
  id: 'magistrate', codex: 'mando',
  name: 'THE IRON MAGISTRATE', title: 'THE IRON MAGISTRATE — WARLORD OF THE RIM', look: 'THE IRON MAGISTRATE',
  intro: 'Warlord of the Outer Rim',
  phases: ['THE WALL', 'FIRE FROM ABOVE', 'CRACKED BESKAR'],
  phaseLines: ['', 'Enough. Burn.', 'You cracked it. It changes nothing.'],
  fallLine: 'THE MAGISTRATE FALLS',
  type: 'lancer',                  // the body he fights on (data/enemies.js): its legs, its spear swings
  // his own model over it (enemies/mesh.js magistrate): dark beskar, gold trim, a molten eye, the trophy war-skirt
  dress: { model: 'magistrate', weapon: 'spear', color: 0x464a52, eye: 0xff7a1a, cloth: 0x2a2420, trim: 0xc9a040, rag: 0x4a1c18 },
  over: { heavy: true, lancer: false, range: 3.6, windup: 0.62, recover: 0.85 },   // a heavy: no yank, no lift; his own charge, not the lancer's lunge
  hp: 2300, dmg: 1.3, scale: 1.42, speed: 0.78,   // hp (before difficulty and co-op), × the lancer's damage, size, pace
  pace: [1, 1.12, 1.2],
  phaseAt: [0.66, 0.33],
  // ANTI-CHEESE: beskar takes a little off everything; no blow takes more than this share of his bar (more while he's
  // open); no more than burstCap of it goes in any burstWin seconds; later phases shrug off a little more
  armour: 0.62, hitCap: 0.06, hitCapOpen: 0.12, phaseResist: [1, 0.9, 0.82], burstCap: 0.15, burstWin: 1.6,
  // THE SHIELD (phase I): from the front (a 110° arc) it turns all but this share of a blow while he's on guard. A
  // blow from the side or behind lands in full, and so does one while he's attacking
  shield: { arc: 0.35, through: 0.12, tick: 0.45 },
  // THE CRACKS (phase III): after his big moves the armour vents for `vent` s, and a blow then lands × `mul`
  vent: 2.4, ventMul: 1.6,
  sigGap: [4.6, 3.6, 3.0], sigMin: 2.0,
  // his reinforcements as each phase begins (not in the sandbox): the Iron Guard
  guard: [null, { blaster: 2, grunt: 1 }, { blaster: 1, flyer: 2 }],
  beat: { kneel: 1.3, rise: 0.9, slowmo: 0.35, slowT: 0.7, ring: { r: 9, dmg: 14 }, push: 11 },
  defeat: { kneel: 3.4, slowmo: 0.3, slowT: 1.2, xp: 1400 },
  moves: {
    // I SPEAR CHARGE: he lowers the shield, marks a line at you and drives down it; parry the point (it staggers
    // him) or step off the line as it locks. A miss buries the spear in the floor: he's stuck and open
    charge: { from: 1, minDist: 4.2, maxDist: 24, tell: 1.0, lockAt: 0.72, speed: 24, over: 5, hitR: 1.5, dmg: 30, knock: 12, stuck: 2.0, cd: 7 },
    // I SHIELD BASH: crowd him and he slams the shield into you (dodge it); it throws you off him
    bash: { from: 1, crowd: 3.4, after: 1.0, windup: 0.5, reach: 3.6, dmg: 18, knock: 15, cd: 6 },
    // II ROCKET BARRAGE: up on the jetpack, rockets onto marked ground round you (amber); he comes down with a pound
    barrage: { from: 2, minDist: 0, maxDist: 30, rise: 0.8, alt: 5.5, rockets: 10, every: 0.24, tell: 0.85, r: 2.4, dmg: 20,
               spread: 4.5, onHero: 3, fall: 0.5, pound: { r: 6.5, dmg: 18, knock: 11 }, open: 1.4, cd: 13 },
    // II FLAMETHROWER: he plants and sweeps fire across you from the left vambrace (a red cone: get out of it, or behind
    // him); his back is open while he burns
    flame: { from: 2, maxDist: 9, windup: 0.6, dur: 2.4, range: 9, arc: 0.42, sweep: 1.1, tick: 0.12, dmg: 5, cd: 10 },
    // II JET LEAP: run from him and he jets onto you: an amber ring where he'll land, a pound when he does
    leap: { from: 2, minDist: 15, rise: 0.5, alt: 6, fly: 0.8, tell: 0.9, pound: { r: 5.5, dmg: 22, knock: 12 }, open: 1.0, cd: 9 },
    // III HOMING ROCKETS: a volley up out of the pods; each one's mark follows you, then locks (dodge as it locks)
    homing: { from: 3, minDist: 3, maxDist: 34, rockets: 5, gap: 0.4, rise: 0.7, follow: 1.3, lock: 0.5, r: 2.2, dmg: 22, cd: 12 },
    // III LAST CHARGE (once, at this share of his bar): he rises, burns across the floor at you (dodge it), crashes
    // and kneels in the wreck of his own armour, wide open
    lastCharge: { at: 0.14, windup: 1.4, alt: 1.4, speed: 30, dmg: 34, knock: 16, open: 3.6 },
  },
  rocketColor: 0xffa23a, flameColor: 0xff7a1a,
  // the arena in phase III: smoke and furnace light
  mood: { fill: 0.62, sun: 0.5, rim: 1.3, sky: 0.5, fog: 0x2a1408, blade: 1.1, near: 0.8, far: 0.85 },
};

/* ============================================================
   THE MARSHAL — the ARC trooper's final boss (boss/marshal.js on boss/finale.js)
   ============================================================
   His batch-brother, the commander who gave the order, on a purge officer's body (its pistol work, its cover and its
   standoff), in his own model (enemies/mesh.js commander): helmet off, two sidearms, a shock baton across his back and
   the signal rig. The trooper's fight: cover, the squad and the dash all have answers, in the shared tell colours
   (fx/tells.js: parry = white and red, dodge = red, area = amber).
     I   THE GUNFIGHTER  he moves cover to cover with two pistols. SUPPRESSING FIRE (a marked lane of bolts: break line
                         of sight or step off it), DETONATORS onto amber marks, a COMBAT ROLL away when you crowd him,
                         and he CALLS IN the purge troopers
     II  THE SIGNAL      he sends the order: a violet SIGNAL PULSE out across the floor (jump or dash it) that TURNS a
                         squadmate it passes against you till you get to them; his purge FLIGHT of jet troopers; still the guns
     III BROTHER TO BROTHER he drops the guns and draws the baton: fast and close. A BATON FLURRY whose last blow is the
                         parry, a SHOULDER CHARGE down a marked line, and one LAST STAND slam */
export const MARSHAL_BOSS = {
  id: 'marshal', codex: 'trooper',
  name: 'THE MARSHAL', title: 'THE MARSHAL — YOUR BATCH-BROTHER', look: 'THE MARSHAL',
  intro: 'Your batch-brother · the last order',
  phases: ['THE GUNFIGHTER', 'THE SIGNAL', 'BROTHER TO BROTHER'],
  phaseLines: ['', 'Hear it, brother? It was always in there.', 'No more orders. Just us.'],
  fallLine: 'THE MARSHAL FALLS',
  type: 'officer',                 // the body he fights on (data/enemies.js): a pistol, cover, a standoff
  // his own model over it (enemies/mesh.js commander): black-and-gold purge plate, helmet off, a scarred clone face
  dress: { model: 'commander', weapon: 'commander', color: 0x24262c, eye: 0xff3a2a, cloth: 0xc9a040, trim: 0xc9a040, rag: 0x5a3a12,
           bare: 'marshal', face: { scar: true, beard: 'stubble' } },
  over: { officer: false, range: 20, standoff: 12, windup: 0.5, recover: 0.75, boltSpeed: 34 },   // (no ORDERS of a line officer: his own moves are the calls)
  hp: 2100, dmg: 1.8, scale: 1.3, speed: 1.0,   // hp (before difficulty and co-op), × the officer's damage, size, pace
  pace: [1, 1.05, 1.3],
  phaseAt: [0.66, 0.33],
  armour: 0.7, hitCap: 0.06, hitCapOpen: 0.12, phaseResist: [1, 0.9, 0.82], burstCap: 0.15, burstWin: 1.6,
  sigGap: [3.8, 3.4, 2.6], sigMin: 1.8,
  // phase III's body: the guns are gone, he closes in with the baton (a fast melee foe on the same legs)
  melee: { range: 2.8, windup: 0.42, recover: 0.5, swing: 0.15, dmgMul: 1.9 },
  beat: { kneel: 1.3, rise: 0.9, slowmo: 0.35, slowT: 0.7, ring: { r: 8, dmg: 12 }, push: 10 },
  defeat: { kneel: 3.6, slowmo: 0.3, slowT: 1.2, xp: 1400 },
  moves: {
    // I+ SUPPRESSING FIRE: both pistols down a lane at you (a red lane on the floor as he plants): get behind cover,
    // or off the lane; it sweeps after you, slowly
    suppress: { from: 1, to: 2, minDist: 5, maxDist: 30, windup: 0.7, dur: 2.2, every: 0.09, dmg: 7, spread: 0.045, track: 1.4, lane: 22, cd: 7 },
    // I+ DETONATORS: two (three in phase II) lobbed onto amber marks round you
    grenade: { from: 1, to: 2, minDist: 6, maxDist: 26, windup: 0.5, n: [2, 3], gap: 0.3, spread: 3.2, r: 3.4, fuse: 1.1, dmg: 24, cd: 9 },
    // I+ COMBAT ROLL: crowd him and he's gone, rolling away to a new angle (and a shot as he comes up)
    roll: { from: 1, to: 2, crowd: 5.5, after: 0.8, dist: 6.5, dur: 0.5, cd: 4 },
    // I+ CALL IN: "purge squad, on me" (not in the sandbox)
    callIn: { from: 1, to: 2, windup: 0.9, troops: [{ blaster: 2, grunt: 1 }, { blaster: 1, grenadier: 1, grunt: 1 }], cd: 26 },
    // II SIGNAL PULSE: a violet ring out across the floor from him (jump or dash it): it TURNS the squadmates it
    // passes (they shoot at you, weakly, till you get to them) and hurts a hero it catches on the ground
    signal: { from: 2, to: 2, windup: 1.2, spd: 12, len: 30, w: 1.2, dmg: 14, turn: 5, reach: 1.8, grace: 0.8, turnDmg: 4, turnEvery: 1.1, cd: 11 },
    // II JET TROOPERS: he calls his purge flight down on you (not in the sandbox)
    flight: { from: 2, to: 2, windup: 0.8, n: 2, cd: 22 },
    // III BATON FLURRY: three quick blows, the last a heavy one (parry it: he's thrown open)
    flurry: { from: 3, maxDist: 6, hits: [{ t: 0.42, dmg: 14 }, { t: 0.36, dmg: 14 }, { t: 0.62, dmg: 24, parry: true }], step: 1.3, reach: 3.0, open: 1.6, cd: 4.5 },
    // III SHOULDER CHARGE: a line at you, then he drives down it: parry him off it, or step off it as it locks; a miss
    // leaves him stumbling, open
    tackle: { from: 3, minDist: 3.5, maxDist: 20, tell: 0.85, lockAt: 0.7, speed: 20, over: 3, hitR: 1.4, dmg: 24, knock: 13, stumble: 1.4, cd: 7 },
    // III LAST STAND (once, at this share of his bar): up, and the baton down into the floor: an amber ring of charge
    // out from him (get out of it), and he's on his knees, open
    lastStand: { at: 0.14, windup: 1.2, r: 6.5, dmg: 30, knock: 14, open: 3.6 },
  },
  boltColor: 0xff3a2a, signalColor: 0xb06aff, batonColor: 0x7ad8ff,
  // phase III: the spire's light, cold and violet
  mood: { fill: 0.64, sun: 0.5, rim: 1.25, sky: 0.5, fog: 0x1e1430, blade: 1.1, near: 0.8, far: 0.85 },
};
