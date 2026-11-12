// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CFG: player and ability tuning. Edit here to retune the game.


/* ============================================================
   CONFIG — EDIT THESE TO TUNE THE GAME
   ============================================================ */

export const CFG = {
  player: {
    maxHp: 100, maxForce: 100, forceRegen: 13, hpRegen: 2, hpRegenDelay: 6,   // Force regens a touch slower → abilities are deliberate, not spammed
    speed: 6.4, accel: 34, jumpVel: 10.2, gravity: 27, airJumps: 1,  
    radius: 0.55,                    // collision radius vs solid pillars/crates
    maxStam: 130, stamRegen: 30, stamDelay: 0.5,   // stamina system for swings/blocks — bigger pool, faster refill, but a delay still punishes mindless mashing
    /* STAMINA RAMP — deeper in a run, the pool refills later and slower: delay → `delayTo` s and regen → `regenTo`/s, linearly,
       reaching them at campaign cumulative wave `campaignWave` (Exegol) or survival wave `survivalWave`. Padawan, training,
       sandbox and missions stay at the base values above. */
    stamRamp: { delayTo: 0.8, regenTo: 26, campaignWave: 8, survivalWave: 10 },
    blockStamCost: 12, blockMoveCost: 0,
    parryWindow: 0.16,               // a TIMED window — opens the instant you click RMB
    parryWhiffLock: 0.42,            // a window that catches nothing leaves the guard unable to parry for this long (no spamming RMB)
    blockChip: 0.22,                 // fraction of a BLOCKED melee blow that still gets through the guard (a parry takes none)
    guardBreak: { stagger: 0.7, window: 1.3 },   // a heavy MELEE blow on an empty guard: reel this long, and for `window` s nothing guards, so the next hit lands in full
    blockHeavy: 20,                  // blows at least this strong cost proportionally more stamina to block
    riposteTime: 0.9,                // the counter must follow the parry promptly
    comboDamage: [30, 30, 56],      // damage per combo step (3rd is finisher) — toned down for a stiffer challenge
    comboRange: 5.0,                 // lunge targeting range
    lungeMax: 2.4,                   // the farthest a cut's lunge closes on a foe — close the rest of the gap yourself
    hitRadius: 3.2,                  // swing damage radius
    // SABER SHOVE — the furthest a blade throws a foe: a cut that floors or kills one sends it off at no more than this
    // (m/s, across the ground) and lifts it `lift` m/s, so a heavy blow staggers and drops it a few metres away instead of
    // batting it across the arena. How hard a cut lands (knock) still decides whether it floors, and a brute's floor too;
    // Force powers and explosions keep their full throw.
    saberShove: { max: 8, lift: [2.5, 4] },
    // JEDI FRONT KICK (E) — a STAGGER, not a launch: the knock value is a marker (enemies/damage.js reads it, so a co-op
    // guest's kick staggers the host's foe too); `step` m is the short shove back, `stun` s the reel.
    kickStagger: { knock: 12, step: 0.7, stun: 0.9 },
    // swing ARCS as cosines off your facing: a cut hits ~140° in front, a strafe sweep ~160°, the finisher ~190°
    swingArc: { cut: 0.34, sweep: 0.17, finisher: -0.1 },
    // HIT REACTIONS — a blow that lands staggers you: the swing is knocked loose and your feet slow
    flinch: { light: 0.2, heavy: 0.42, heavyDmg: 20, ranged: 0.1, move: 0.25, knock: 4.5, immune: 0.6 },
    // PERFECT DODGE — a blow that lands within the PARRY window (parryWindow + form/skill/difficulty bonuses, + `bonus`) of the
    // dash/roll/dive starting slows time and arms a counter; later in the i-frames it's an ordinary dodge
    perfectDodge: { bonus: 0.02, slowmo: 0.3, slowT: 0.5, refund: 1, cd: 1.0 },
    // BLADE CLASH — your cut meets a foe's strike mid-arc: neither lands, both recoil
    clash: { from: 0.15, to: 0.75, knock: 9, push: 5, stam: 6 },
    // SOFT LOCK-ON (middle mouse) — the camera keeps one foe framed
    lockOn: { range: 22, keep: 28, cone: 0.55, yawPull: 7, pitch: 0.2, pitchPull: 2.5, pitchFree: 0.45 },
  },
  // HOLSTERED (4) — the Jedi clips the saber to his belt and fights with the Force alone; the Mando holsters his
  // weapon and fights with his fists and gadgets. Force / gadget power refills faster while holstered (`regen`), and the
  // Jedi's Force powers hit harder (`power`).
  // The Jedi's LMB becomes a Force-imbued strike string (jedi/palm.js): a jab, a cross, then a finisher the movement
  // keys pick (`finish`). Per strike: damage, reach (m), cone half-angle, knockback, stamina, and the time the strike
  // takes (contact lands at `contact` of it). `kind` is the animation; `launch` throws a light foe up off its feet.
  holster: {
    regen: 1.5,
    power: 1.2,   // the Jedi's Force powers hit this much harder (damage and knockback) with the saber holstered
    strike: [
      { kind: 'jab',   dmg: 14, range: 4,   angle: 0.42, knock: 6,  stamina: 7,  dur: 0.26, contact: 0.38 },
      { kind: 'cross', dmg: 18, range: 4.5, angle: 0.42, knock: 8,  stamina: 8,  dur: 0.3,  contact: 0.4 },
      { kind: 'hook',  dmg: 20, range: 3.8, angle: 0.95, knock: 10, stamina: 9,  dur: 0.32, contact: 0.42, lunge: 4 },   // a looping blow round the guard: the third hit of the string, wider than the jab and cross
    ],
    finish: {
      neutral: { kind: 'burst',    dmg: 30, range: 6,   angle: 0.75, knock: 15, stamina: 14, dur: 0.46, contact: 0.45, burst: true },   // both palms: a cone that turns bolts
      forward: { kind: 'lunge',    dmg: 36, range: 5.5, angle: 0.4,  knock: 22, stamina: 15, dur: 0.44, contact: 0.5,  lunge: 11 },    // a driving palm that closes the gap
      side:    { kind: 'backhand', dmg: 24, range: 4.5, angle: 1.35, knock: 14, stamina: 13, dur: 0.42, contact: 0.45, sweep: true },  // a wide sweep across the front rank
      back:    { kind: 'upper',    dmg: 26, range: 3.5, angle: 0.6,  knock: 6,  stamina: 14, dur: 0.44, contact: 0.42, launch: 11 },   // a rising palm: light foes go up
    },
    comboGap: 0.7,   // seconds after a strike in which the next press carries on the string
    // HOLD LMB: gather the Force in both palms and let it go on release. Below `min` it's a plain strike; damage, reach,
    // knockback and guard damage grow to full at `full` seconds; `max` lets it go on its own. A full charge staggers
    // elites and stuns a boss, and like the burst it turns blaster fire back on the shooters.
    charge: { min: 0.28, full: 1.0, max: 2.5, stamina: 16, dmg: [26, 64], range: [5, 9], angle: 0.5, knock: [16, 32], posture: [30, 80] },
    // E mid-string: a spinning Force kick that clears the ring round you; E in the air: a Force stomp straight down
    spin:  { dmg: 20, reach: 2.8, knock: 20, recover: 0.5, stamina: 10 },
    stomp: { dmg: 24, radius: 4, knock: 18, fall: 26, stamina: 10 },
    // E + S on the ground, out of the string: a low sweep that cuts the legs from under everyone in a half-ring and
    // can't be guarded. It floors the light (the heavy only stagger), which opens them for a takedown
    sweep: { dmg: 14, reach: 3.4, arc: 1.9, knock: 6, recover: 0.6, stamina: 11, contact: 0.45, down: 1.1 },
    // LMB at a foe that is reeling or floored: a Force TAKEDOWN. Reeling: the foe is hauled in by the collar and thrown
    // to the ground; floored: a palm driven down through it. `maxFrac` is a share of a normal foe's life on top of `dmg`
    takedown: { range: 3.6, dmg: 40, maxFrac: 0.35, stamina: 12, dur: 0.62, contact: 0.5, floorDur: 0.5, floorContact: 0.46 },
    // WARD (RMB): a blow turned on the Force costs more breath than a blade's guard would (`stamMul`), but a TAPPED
    // ward that meets a blow in time is a Force parry: the attacker reels, and your next strike is a free COUNTER that
    // staggers everyone it finds
    ward: { stamMul: 1.35 },
    counter: { kind: 'counter', dmg: 38, range: 5, angle: 0.55, knock: 20, stamina: 0, dur: 0.4, contact: 0.4, lunge: 9, counter: true },
    // STRIKE INTO POWER: Push or Pull within `window` s of a landed unarmed blow flows out of it. The PALM PUSH costs
    // `costMul` of a Push and hits foes within `near` m for `dmg` more and harder; the pull-in yanks them onto the next
    // strike, thrown on its own `strikeAt` s later
    flow: { window: 0.7, costMul: 0.6, near: 6, dmg: 22, knockMul: 1.35, strikeAt: 0.3 },
    refund: { hit: 2.5, finisher: 5, max: 10 },   // Force back per foe struck (a finisher or charge pays more), capped per blow
  },
  abilities: {
    // BASIC powers — cheap, available from the start
    push:   { cost: 20, cd: 1.4,  range: 15, angle: 1.15, dmg: 2,  knock: 12 },   // pure UTILITY — a hard interrupting SHOVE, near-zero damage. cd 0.9→1.4: it also reflects every bolt in the cone, so it was a near-constant shield from wave 1
    // a push too light to floor a foe (rank 0, or the far edge of the cone) still SHOVES it: it skids back `perKnock` m per
    // point of knock (12 at point-blank: ~2 m) and reels `stun` s, without leaving its feet. Brutes skid `heavy` of that,
    // champions and final bosses `champ` (and never reel). enemies/damage.js shoveSlide, run in enemies/ai.js
    shove:  { perKnock: 0.14, heavy: 0.4, champ: 0.3, stun: 0.4, decay: 7 },
    dash:   { speed: 30, time: 0.34 },  // dash grants i-frames + a flip · its Force cost, charges and roll live in data/mobility.js
    pull:   { cost: 30, cd: 3.0,  range: 18, angle: 1.2, near: 2.2 },   // it hauls them in exactly as hard as a Push at the same rank shoves them away (player/jedi/force.js pullKnock), never closer than `near` m
    // ADVANCED powers — expensive, earned as the legend grows. The mightiest eat most of the bar.
    throw:  { cost: 38, cd: 5.0,  range: 16, dmg: 22, speed: 24 },
    slam:   { cost: 64, cd: 5.5,  radius: 10, dmg: 7, knock: 21,      // JUMP ATTACK — the wave is an AOE knockdown for breathing room…
              strike: 30, core: 2.6,                                  // …the blade itself hits hard on whoever you land on
              bigWave: 0, bigScale: 1.6 },                            // bigWave (mastery rank II): a double-jump dive lands a bigScale-wider wave
    // FORCE GRASP — hold the Pull key: after `hold` seconds the foe in your aim locks into your grasp. DARK LORD'S GRIP
    // (store) holds up to `multi` at once, picked in a wider `multiAngle` cone; each extra body adds multiCost to cost and drain
    grasp:  { pullRank: 1, hold: 0.35, multi: 3, multiAngle: 0.75, multiCost: 0.5, cost: 26, drain: 18, maxT: 5, dist: 4.2, range: 16, angle: 0.5,
              throwSpeed: 30, throwDmg: 18, yankDmg: 4, bumpDmg: 8, bumpKnock: 20, bumpSpeed: 4.5,
              shieldMul: 1.25, shieldMin: 9, shieldPad: 0.3 },   // HUMAN SHIELD (enemies/bolts.js): what a hostile bolt that meets a held body does to it, and how far past its hitbox a limp body still catches one
    // the late ULTIMATES are deliberately TAXING — big Force cost + long cooldown so they're a deliberate beat, never spam
    judge:  { cost: 72, cd: 12.0, range: 14, angle: 0.9, targets: 4, time: 1.3, tick: 0.12, dmg: 7 },  // chain lightning channel
    repulse:{ cost: 82, cd: 11.0, radius: 13, dmg: 30, knock: 18 },   // FORCE REPULSE — a 360° concussive blast
    // FORCE BARRIER — the kit's lone DEFENSIVE power: a brief bubble that soaks damage and auto-deflects bolts.
    // `cd` starts when the bubble DROPS (see forceBarrier), so a cast comes back every cd + dur = 11s, as before.
    barrier:{ cost: 35, cd: 8.0, dur: 3.0, dr: 0.7, radius: 2.4, knockR: 6.5, castKnock: 20, expireKnock: 11 },
    // FORCE MEND — pour the Force into your own wounds: a big restorative pulse. Steep cost + long cd (no spamming).
    mend:   { cost: 55, cd: 16.0, heal: 0.30 },   // heal = fraction of MAX vitality (a strong relief, not a full reset — pressure persists). shared by Bacta Stim
  },
  convertDmgMult: 3,   // damage dealt by Force-converted allies (legacy enemy-state machinery)
  bossReflectWindow: 5.0,  // orb must be within this distance when you PUSH (precise timing)
  killStreakTimeout: 4.0,
  // CAMERA — follow-cam feel (see src/engine/camera.js)
  camera: {
    // LENS — a big-budget third-person framing: the hero fills about a third of the frame height, the lens rides at
    // shoulder height just off the right shoulder, and a moderate FOV keeps the backdrop large (a wide FOV shrinks
    // everything past the hero, which is what made the arenas read small)
    fov: 64,                  // vertical degrees at rest, JA's 64° (cg_fov 80 at 4:3): tight enough that the skyline looms; the FOV setting overrides it
    pivotY: 1.9,              // the lens orbits a point this high over the hero's feet (just over head height)
    minLensY: 1.3,            // looking up swings the lens down, but never lower than this over the hero's feet
    // JEDI — a port of Jedi Academy's third-person camera (OpenJK code/cgame/cg_view.cpp, CG_OffsetThirdPersonView) at
    // its shipped defaults. JA's player stands 64 units tall; ours ~2.7 m, so 1 unit = 0.042 m. The rig: aim at a point
    // just over the hero's eye, sit `range` back from it along the line of sight, and let the aim point and the lens each
    // chase their ideal spot on their own damping, which is what gives JA its soft swing when you turn
    ja: {
      eye: 2.5,               // focus: the hero's eye (JA: origin + viewheight, 60 of 64 units up)
      vertOffset: 0.67,       // cg_thirdPersonVertOffset (16 in JA = 0.67 m, matched exactly): the aim point rides over the head, so the hero sits low in the frame and the
                              // crosshair (traced from his eye, player/aim.js heroCrosshair) floats just above him at rest. Raised from 0.4 (Caleb's
                              // call) so a foe straight ahead shows over the Jedi's head instead of behind it...
      range: 3.8,             // cg_thirdPersonRange 80 is 3.4 m: ...the lens sits this far behind it, along the line of sight
      targetDamp: 0.5,        // cg_thirdPersonTargetDamp: share of the gap the aim point closes every 50 ms
      cameraDamp: 0.3,        // cg_thirdPersonCameraDamp: the same for the lens; JA stiffens it toward 1 as the view
                              // tips toward straight up/down ((pitch / 115°)²) and on fast turns (over 1° per ms)
      horz: 0,                // cg_thirdPersonHorzOffset 0, as in JA: square behind the hero; only moving (the lag) puts him off to a side
      duel: 0.7,              // ON TOP OF JA: squared up with one foe (the lock-on target, the boss, a lone duellist close in;
                              // engine/camera.js duelFoe), the lens and its aim point slide this share of `duelSide` sideways
                              // together, so the foe's wind-up shows beside the hero instead of behind his back (0 = JA's square-on)
      frame: 0.2,             // ON TOP OF JA: share of the crowd / calm / lock-on framing added to the range (JA's never
                              // moves); a boss still gets its full pull-back
    },
    lookAhead: 5,             // the lens aims this far past the hero...
    lookUp: 0.15,             // ...and this high over the pivot (the gunners' rig): on the line from the raised lens (mandoLensUp) to a
                              // foe's head 10-20 m out, so a headshot there needs next to no tilt and the lens stays up over the helmet
    topDownFrom: 0.45,        // past this pitch (radians, looking down) the aim point starts drawing in toward the hero...
    topDownAhead: 0.5,        // ...losing up to this share of the look-ahead at the steepest pitch...
    topDownDrop: 0.5,         // ...and sinking this far, so a hero seen from overhead sits in frame, not off the bottom edge
    calmDist: 0.6,            // between waves / nothing nearby: ease back a touch so an empty arena never feels cramped
    crowdRadius: 10,          // enemies inside this range count toward the crowd pull-back
    crowdPull: 0.4,           // extra distance per nearby enemy...
    crowdMax: 2.6,            // ...capped here, so a brawl always fits on screen
    // MANDO — Helldivers 2's rig: a closer boom held well off the right shoulder, so the hero stands left of centre with the
    // crosshair clear past them, and it tucks in tighter still while aiming
    mandoDist: 4.5,           // resting follow distance (aiming / flight scale it)
    mandoLensUp: 1.1,         // the lens rides this much over the pivot: over the helmet (the heroes' heads ride ~2.2-2.4 m up), so with the
                              // crosshair on a foe's head the hero's own helmet sits just UNDER it, out of the shot's way (Caleb's
                              // reference shot). No higher: a high lens looks down on the arena like a tabletop
    mandoShoulder: 0.95,      // MANDO lens offset off the shoulder (never centred, see camera.js)...
    mandoShoulderAim: 1.25,   // ...wider while aiming / bracing, so the reticle is always clear of the helmet...
    mandoShoulderFly: 1.05,   // ...and in the air
    mandoShoulderAds: 0.85,   // ...and tucked back in DOWN THE SIGHTS: the lens is closer and the view narrower there, so this keeps the
                              // hero at the same spot on screen, bigger, with the reticle still clear of the helmet...
    mandoShoulderScope: 1.35, // ...but wide through a SCOPE: at that magnification the hero would fill half the view, so he slides out to its edge
    shoulderSwap: 0.18,       // SHOULDER SWAP: seconds for the lens to cross to the other shoulder (eased in and out)
    shoulderMagRate: 10,      // how quickly the offset widens / tucks as you aim, fly or land (per second)
    leadRate: 7,              // SMOOTHING (per second, engine/camera.js): the look-ahead into your motion eases to a dash or a stop...
    rollRate: 9,              // ...the bank into a strafe eases in and out...
    stiffRate: 12,            // ...the Jedi rig's stiffening on a fast turn...
    boomIn: 12,               // ...a lens nearing a prop it would end up inside closes in at this rate...
    boomOut: 3.5,             // ...and lets back out at this rate once clear (a prop it's already inside still pulls it in at once)...
    boomSoft: 1.2,            // ...reading this far (m) past the lens, so the closing in starts before it gets there
    boomMin: 2.2,             // ...but the read-ahead alone never brings it closer than this (m)
    boomLead: 0.2,            // ...and reads where the lens will be this many seconds on, for an orbit swinging it into a prop's side
    dipRate: 30,              // a landing's view dip drops in at this rate rather than in one frame
    adsDist: 0.74,            // AIM DOWN SIGHTS (bracing a blaster / a scope): the follow distance scales by this...
    adsZoom: 14,              // ...the view narrows by the gun's `adsZoom` degrees (this for a gun that doesn't say)...
    scopeFov: 26,             // ...a scope looks through the gun's `scopeFov` (this for one that doesn't say)...
    adsIn: 13, adsOut: 9,     // ...the zoom closes in this fast and opens back out this fast (per second)...
    adsSensCurve: 0.8,        // ...and the look speed scales with the zoom (1 = exactly with it, 0 = not at all)
    duelPull: 0.18,           // LOCK-ON: per metre to the locked foe, the lens backs off so both duelists stay framed...
    duelMax: 1.6,             // ...up to this much
    focusSide: 1.55,          // LOCK-ON (player/lockon.js): the side-on slide is this much wider while a lock holds...
    focusBack: 1.2,           // ...and the lens sits this much further back (m), so both fighters and both blades show
    duelSide: 1.5,            // DUEL SIDE-ON (engine/camera.js; the Jedi slides `ja.duel` of it): with one foe squared up straight ahead, the lens slides this far sideways...
    duelSideTurn: 0.35,       // ...and the aim point this share of it, so the view turns back toward the pair
    duelSideLat: 1.6,         // fully on while the foe is within this of the view's centre line (sideways, metres), easing off by here
    duelSideFar: 11,          // and while it is nearer than this (easing in over the last 4 m)
    crowdLift: 0.5,           // and the lens rises up to this much so the pack reads over the hero's shoulders
    bossDist: 2.4,            // boss fights sit further back...
    bossNear: 3.4,            // ...and further still (up to this) while the boss is right on top of you
    shake: 0.19,              // screen-shake strength at 100% on the SHAKE slider (trauma² — small hits stay subtle, big ones land hard)
    shakeRoll: 0.02,          // max roll (radians) at full trauma
    hitKick: 0.28,            // the lens is knocked away from whatever hit you
    impactFov: 3.5,           // FOV punch-in on heavy hitstop / slow-mo beats
    sway: 0.035,              // idle handheld drift (0 to disable)
    wallRise: [0.9, 1.8, 2.8],// WALL AT YOUR BACK: heights the boom tries rising by before it settles for pulling in tight
  },
};
