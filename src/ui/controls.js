// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CONTROLS: the per-hero controls reference, as data, rendered into the menu's help panel.

/* Each group is a list of rows: [keys, action, note?]. Keys are split on spaces; '/' and '+' stay as separators.
   Keep this in step with engine/input.js when binds change. */
const CONTROLS = {
  jedi: [
    { title: 'MOVE', rows: [
      ['W A S D', 'Move'],
      ['MOUSE', 'Look'],
      ['SPACE', 'Jump', 'Tap again in the air to double-jump'],
      ['HOLD SPACE', 'Force leap and glide', 'Spends Force'],
      ['SHIFT', 'Roll / dash', 'In a fight, SHIFT on the ground is a quick roll any way you press: it costs some stamina (each form spends its own share), with a moment of invulnerability · tap it again mid-roll (or press it in the air) to Force dash, which spends a charge (the pips on the slot) and some Force · out of a fight it just dashes, free · roll or dash just as a blow lands for a perfect dodge'],
      ['Q', 'Run / walk', 'Switches between run (the default; forward sprints) and walk; the sprint turns wide, and in a fight it burns stamina (it gives out before your guard does), the walk is a brisk, menacing pace, fights included'],
      ['ALT', 'Strafe', 'Keeps you facing the crosshair while you move: sidestep, backpedal and circle a foe without turning your back · no sprint while strafing · Settings · STRAFE: TOGGLE (the default) turns it on with one press and off with the next, HOLD strafes only while ALT is held'],
      ['L-CTRL', 'Force slide', 'Out of a sprint: a long skid forward that ducks blaster fire and bowls troops over · attack out of it to sweep', 1],
    ]},
    { title: 'PARKOUR', rows: [
      ['SPACE', 'Vault / climb', 'Press it right in front of low cover while running at it to vault over in one move; jump at a ledge to pull up'],
      ['A / D', 'Ledge hang', 'Catch a high lip to hang; A/D shimmy, W or SPACE climbs, S drops', 1],
      ['W', 'Wall-run', 'Jump or flip at a tall wall at any angle and run along it; SPACE kicks off it. Jump at it square and SPACE backflips off it instead', 1],
      ['FLOW', 'Parkour pays', 'Every vault, climb, slide, wall-run and roll refunds Force; chain different moves for more, and the cut right after one hits harder', 1],
      ['SHIFT', 'Landing roll', 'Just before a hard landing, or you stagger', 1],
    ]},
    { title: 'FIGHT', rows: [
      ['LMB', 'Saber combo', 'TAP: a quick light cut · HOLD: the blade draws back into a slower, harder heavy cut that cracks guards (costs more stamina) · The key you hold picks the cut, and the needle through the crosshair shows the next one: A / D sweep sideways, W chops overhead (a thrust aimed low), W or S with A / D cut diagonally down or up, S whirls behind you, nothing held walks your form\'s string of cuts · Where the crosshair sits on a foe picks how high the cut goes: head or shoulders high, chest middle, legs low; it turns red on a foe (Settings · AIM HINT turns the red off) · A cut that starts where the last one finished flows on quicker · Every third cut is a finisher · Settings · CUT AIM: MOUSE lets a flick of the mouse just before you click aim the cut at any angle round the clock · Settings · SABER ASSIST (LOW by default, NORMAL, OFF): a foe near the crosshair turns your body a little toward it for that cut and the lunge goes for it; it never holds a lock or moves the view'],
      ['LMB ON A BROKEN GUARD', 'Saber finisher', 'A foe reeling with its guard broken shows a gold hilt over it: attack while it is up, square in front of you, and your form plays its finisher. Most foes die to it; a master duellist, a champion or a boss is floored and badly hurt. You still take half damage while it plays, and RMB, a dash or a Force power bails out of it'],
      ['FLOW', 'Perfect string', 'Land both links into the third cut in rhythm (one press each, late in the swing, no mashing) and the third cut is the perfect finisher: bigger, harder, more Focus', 1],
      ['HOLD RMB', 'Block', 'Soaks most of a blow; heavy hits drain stamina'],
      ['TAP RMB', 'Parry and deflect', 'Time it as a blow or bolt lands; a missed parry can\'t be retried for a moment'],
      ['E', 'Kick', 'Shoves a foe back and cracks a duellist\'s guard'],
      ['IN THE AIR', 'A leap is a commitment', 'Mid-fight you steer less, can\'t hold a guard, and a blow that lands hits harder and drops you', 1],
      ['W + AIR + LMB', 'Aerial cut', 'Leaping forward: a short lunge and a cut at the foe ahead · costs Force, 3s cooldown · a standing jump just swings', 1],
      ['LMB', 'Saber lock', 'Blades bound: mash to drive through · E kicks out · F shoves', 1],
      ['T', 'Lock on', 'Keeps one foe framed; press again to release', 1],
      ['1 / 2 / 3', 'Saber form', 'The three forms in your loadout, or the mouse wheel'],
      ['G', 'Switch grip', 'In Niman, regular or reverse (swings hit the same either way) · in Djem So or Shien (Form V) it swaps to the other one if you know it · Shien always holds a reverse grip, every other form a forward one', 1, ['niman', 'djemso', 'shien']],
      ['4', 'Holster saber', 'Fight with the Force alone, both hands free: RMB wards, Force powers hit 20% harder, Force refills faster and every blow you land gives a little back · 4 again draws', 1],
      ['Z / 5', 'Ignite / retract saber', 'Z (or 5) puts the blade out and clips the hilt to your belt: you stand at ease and walk or run like anyone, no guard and no hum · Z or 5 lights it again, and so does any attack, block, Force power or kick, or a blow landing on you (too late to guard that one) · holstered, Z or 5 draws and lights it in one go · in the calm after a chapter it goes out on its own, and foes closing in light it'],
      ['HOLSTERED LMB', 'Force-imbued strikes', 'Jab, cross, hook, then a finisher the key you hold picks: nothing a two-palm burst that turns bolts, W a driving lunge palm, A / D a wide backhand sweep, S a rising palm that throws light foes up · HOLD LMB to gather a charged palm and let go to fire it: a full charge breaks guards, staggers elites and bosses and turns grenades back · at a foe reeling or floored, a Force Takedown finishes it · right after a tapped-ward parry, a Force Counter that staggers', 1],
      ['HOLSTERED E', 'Force kicks', 'Mid-string: a spin kick that clears the ring round you · S + E: a low sweep nothing can guard, that floors light foes for a takedown · in the air: a Force stomp straight down · otherwise the front kick', 1],
      ['HOLSTERED F / C', 'Strike into power', 'Push or Pull right after a blow lands flows out of it for less Force: Push becomes a Palm Push that hits the nearest hard, Pull drags them onto your next strike', 1],
      ['MMB / H', 'Squad orders', 'With a squad · TAP: on a trooper, the squad attacks it · on open ground, they move there · tap again to bring them back on you · HOLD: the command wheel (the world slows): on me, hold here, move there, attack target, take cover, grenade, spread / stack, get them up · point and let go · 1-4 while it is open orders one squadmate · stand by a downed squadmate to get them up · while one stands, a killing blow downs you instead and they come to get you up', 1],
      ['J', 'Squad stance', 'FREE ENGAGE (the default): in a fight the squad leaves your side for cover and flanking angles on the foes, then regroups on you once it is clear · FOLLOW ME: they hold the formation and fight from beside you · also on the command wheel (ENGAGE / FOLLOW), so on a pad: hold VIEW', 1],
      ['F', 'Interact', 'In a lull, walk up to someone on your side and face them (a squadmate, the one you escort, the people you are getting out): when TALK comes up under the crosshair, TAP for a line from them · optional, nothing waits on it · in the temple, opens the station you are at · beside a beaten foe on its knees, SPARE comes up: tap to let it go (light), or strike it down (dark) · F only interacts while a prompt is up: anywhere else it is your Push'],
      ['N', 'Ping', 'Co-op: marks the spot or the foe under your crosshair for the other players, in your colour, with an arrow on their screens when it is out of view · ping it again (the same foe or spot) to take it down · works solo too'],
      ['M', 'Map', 'In an open zone: the full map, with the districts you have found, every waystone, side quests and your party · pick a waystone you have touched to travel there (not mid-fight) · on the big story maps and in your hub: the whole map, with the objectives (or the stations and ways out), your squad and party · click the map to set a waypoint · the minimap in the corner turns with you (Settings · MINIMAP) · anywhere else M turns the music on and off'],
      ['HOLD O', 'Objective', 'What to do now, which step it is (objective 2 of 5, wave 3 of 4, step 4 of 9) and how far through you are, while held · works in every mode, the fight carries on underneath'],
      ['RMB + SPACE', 'Evasive leap', 'Jump while blocking to vault clear · in a fight it spends a dash charge and is only safe at its start', 1],
    ]},
    { title: 'FORCE POWERS', rows: [
      ['F', 'Push', 'From the start · with a prompt up (TALK, a temple station), F interacts instead'],
      ['C', 'Pull · hold to Grasp', 'Unlocks after wave 2 · hold to Grasp once Pull is rank I · grasped: F throws, C yanks in, Z drops'],
      ['V', 'Barrier', 'Earned with XP · or Saber Throw (RMB + LMB)'],
      ['X', 'Jump attack', 'Leaps if you\'re on the ground, winds up, then drives the blade down · Earned with XP · or Mend, a self-heal'],
      ['R', 'Judgement', 'Earned with XP · or Repulse'],
    ]},
  ],
  mando: [
    { title: 'MOVE', rows: [
      ['W A S D', 'Move'],
      ['MOUSE', 'Aim'],
      ['SPACE', 'Hop', 'Run and hop at low cover to vault it; hop at a ledge to climb'],
      ['HOLD SPACE', 'Jetpack thrust', 'Hover and climb; burns fuel'],
      ['SHIFT', 'Combat dive', 'On the ground SHIFT dives you flat any way you press, Max Payne style, on your legs alone (no jet fuel), then you get back up: free, invulnerable through the throw, and the gun stays on target · turn the crosshair mid-dive and the lay-out rolls with it (dive left, look left, land on your back) · dive just as a blow lands for a perfect dodge'],
      ['SHIFT x2', 'Jet dive / rocket boost', 'SHIFT again while the dive is in the air lights the pack and throws it much farther (hold it to fly on) · just after a dive lands, the full rocket boost · both spend jet fuel', 1],
      ['SHIFT (air)', 'Air dodge', 'A straight thruster kick any way you press, invulnerable for a moment, and it stops your fall · spends a jet charge (the pips on the slot) and a little fuel', 1],
      ['HOLD SHIFT', 'Boost in the air', 'Keep SHIFT held after the dodge: he lays out the way you fly, Max Payne style, guns up on the crosshair · look down to dive', 1],
      ['HOLD RMB (air)', 'Hover', 'Hold your height and strafe; let go of the keys to stop dead', 1],
      ['K / MOUSE 4', 'Swap shoulder', 'The camera to your other shoulder · either mouse side button works too (only this changes it: running one way never does)'],
      ['ALT', 'Strafe', 'Stay square to the crosshair while you move; running away from it no longer turns your back · Settings · STRAFE: TOGGLE (the default) turns it on with one press and off with the next, HOLD strafes only while ALT is held'],
      ['C', 'Slide', 'Feet first, out of any run, aiming too · carries far, steers a little, ducks blaster fire and keeps your aim steady · jump out of it for a long hop', 1],
      ['FLOW', 'Parkour pays', 'Vaults, climbs and slides refuel the jetpack; shots right after one hit harder'],
    ]},
    { title: 'FIGHT', rows: [
      ['LMB', 'Fire', 'Headshots deal far more damage'],
      ['R', 'Vent heat', 'Cool down before you overheat'],
      ['TAP RMB', 'Beskar parry', 'Just as a bolt reaches you: the vambrace ricochets it back at the shooter, harder · any gun but the Darksaber, in the air too · mistimed, it locks out for a moment'],
      ['HOLD RMB', 'Brace / shield / scope', 'Depends on the weapon in hand · scoped look speed is the SCOPE SENS setting'],
      ['LMB (disruptor)', 'Spear stab', 'Unscoped, the disruptor is an electric spear: a quick thrust that lunges in and stuns · click again to keep jabbing', 1],
      ['E', 'Close quarters', 'Jab, cross, knee, vibroblade, each one stepping you in to arm\'s length · tap E as a blow lands to catch it on the vambrace'],
      ['HOLD E', 'Clinch', 'Keep E held through a blow and take the foe by the collar · E: beskar headbutt (the third floors it) · LMB: throw it the way you face, bowling over whoever it hits · brutes and guarding duellists can\'t be held', 1],
      ['W + E', 'Jet charge', 'Burn in and shoulder-check a foe a few strides ahead', 1],
      ['SPACE + E', 'Dive kick', 'In the air: drop boot-first onto a foe below', 1],
      ['RMB + E', 'Shield and blade', 'Single blaster: vibroblade cuts and a shield bash with the shield kept up · costs stamina', 1],
      ['E', 'Takedown', 'On a staggered or floored foe: the vibroblade, up under the plate or driven down from one knee', 1],
      ['1 / 2 / 3', 'Switch weapon', '1 your sidearm, 2 your primary, 3 the Disruptor or Darksaber · or the mouse wheel · choose the sidearm and primary in the ARMORY'],
      ['HOLD LMB', 'Darksaber heavy cut', 'Darksaber in hand: tap for a quicker light cut, hold to draw back a slower, harder heavy one that cracks guards', 1],
      ['LMB ON A BROKEN GUARD', 'Darksaber finisher', 'Darksaber in hand, a foe reeling with its guard broken shows a gold hilt over it: attack and the darksaber finishes it (E is still the vibroblade takedown)', 1],
      ['5', 'Ignite / retract Darksaber', 'Darksaber in hand: put the blade out and clip it to the belt, then walk at ease · 5, a swing or a guard lights it again', 1],
      ['RMB + LMB', 'Darksaber throw', 'Darksaber in hand: hurl it, and the grappling line reels it back through anything in its path', 1],
      ['MMB / H', 'Squad orders', 'With a squad · TAP: on a trooper, the squad attacks it · on open ground, they move there · tap again to bring them back on you · HOLD: the command wheel (the world slows): on me, hold here, move there, attack target, take cover, grenade, spread / stack, get them up · point and let go · 1-4 while it is open orders one squadmate · stand by a downed squadmate to get them up · while one stands, a killing blow downs you instead and they come to get you up', 1],
      ['J', 'Squad stance', 'FREE ENGAGE (the default): in a fight the squad leaves your side for cover and flanking angles on the foes, then regroups on you once it is clear · FOLLOW ME: they hold the formation and fight from beside you · also on the command wheel (ENGAGE / FOLLOW), so on a pad: hold VIEW', 1],
      ['F', 'Interact', 'In a lull, walk up to someone on your side and face them (a squadmate, the one you escort, the people you are getting out): when TALK comes up under the crosshair, TAP for a line from them · optional, nothing waits on it · in the temple, opens the station you are at · beside a beaten foe on its knees, SPARE comes up: tap to let it go (light), or strike it down (dark) · F only interacts while a prompt is up: anywhere else it is the flamethrower'],
      ['N', 'Ping', 'Co-op: marks the spot or the foe under your crosshair for the other players, in your colour, with an arrow on their screens when it is out of view · ping it again (the same foe or spot) to take it down · works solo too'],
      ['M', 'Map', 'In an open zone: the full map, with the districts you have found, every waystone, side quests and your party · pick a waystone you have touched to travel there (not mid-fight) · on the big story maps and in your hub: the whole map, with the objectives (or the stations and ways out), your squad and party · click the map to set a waypoint · the minimap in the corner turns with you (Settings · MINIMAP) · anywhere else M turns the music on and off'],
      ['HOLD O', 'Objective', 'What to do now, which step it is (objective 2 of 5, wave 3 of 4, step 4 of 9) and how far through you are, while held · works in every mode, the fight carries on underneath'],
      ['4', 'Holster', 'Take a fighting stance with fists and gadgets: LMB / E swing hook, hook, uppercut, haymaker, hold RMB for the gauntlet shield (LMB behind it cuts shield and blade), and gadget power refills faster · 4 or 1 / 2 / 3 draws', 1],
    ]},
    { title: 'GADGETS', rows: [
      ['T', 'Dead Eye', 'With HUNTER\'S EYE full (the amber bar over vitality): time slows, up to three heads near the reticle are tagged and he puts a bolt through each · Fills with headshots, beskar ricochets, kills in the air and takedowns; a hit you take knocks it back · STEADY: a tighter cone · ON THE HUNT: the jetpack refuels faster · full: DEAD EYE'],
      ['F', 'Flamethrower', 'Unlocks after wave 2 · with a prompt up (TALK, a temple station), F interacts instead'],
      ['Q', 'Wrist rocket', 'From the start'],
      ['X', 'Grappling hook', 'Earned with XP · or Jetpack Slam'],
      ['V', 'Whistling Birds', 'Earned with XP · or the Thermal Detonator, thrown onto the crosshair: aim lower to drop it close, higher to send it far'],
      ['G', 'Bacta stim', 'Earned with XP · a self-heal'],
      ['Z', 'Jetpack missile', 'The final upgrade'],
    ]},
  ],
  // the clone ARC trooper (player/trooper/kit.js)
  trooper: [
    { title: 'MOVE', rows: [
      ['W A S D', 'Move'],
      ['MOUSE', 'Aim'],
      ['SPACE', 'Jump', 'A short, heavy hop: no jetpack, no wall-runs · run and jump at low cover to vault it; jump at a ledge to climb · in low cover, SPACE vaults it'],
      ['C', 'Take cover', 'Beside a crate, wall or pillar: your back to it, and it soaks what comes from in front (not from the side: watch for flankers) · A / D slides along it · C again, walk away or walk off its end to leave · at a run or a sprint with cover ahead, C slides you into it · with nothing near, C is the slide (feet first, firing as you go)'],
      ['HOLD RMB (in cover)', 'Lean out', 'Rise over low cover or step out round the edge of tall cover to aim · let go to duck back · LMB alone pops up for the shot · ducked, fire that tears past you stops suppressing you'],
      ['SPACE x2', 'Combat dive', 'SPACE again off the hop: a dive flat out the way you press (or back), invulnerable through the throw, firing as you go'],
      ['HOLD SHIFT', 'Sprint', 'Forward, both pistols up by the shoulders · aim or fire and you drop back to a run (a shot straight out of a sprint is covering fire) · C at a sprint slides you into the cover ahead'],
      ['K / MOUSE 4', 'Swap shoulder', 'The camera to your other shoulder · either mouse side button works too (only this changes it: running one way never does)'],
      ['ALT', 'Strafe', 'Stay square to the crosshair while you move · Settings · STRAFE: TOGGLE (the default) turns it on with one press and off with the next, HOLD strafes only while ALT is held'],
    ]},
    { title: 'FIGHT', rows: [
      ['LMB', 'Fire', 'DC-15: a three-bolt burst · twin DC-17s: semi-auto, each click fires the other pistol, so click fast · headshots hit far harder'],
      ['HOLD RMB', 'Aim', 'Up to the eye: a tight cone and a steady reticle, with either gun'],
      ['R', 'Vent', 'Overheated: press R in the beat (a moment after the overheat) for a perfect vent that clears the gun at once · too early or late and it jams · not overheated: a plain vent'],
      ['1 / 2', 'Switch gun', 'DC-15 rifle or the twin DC-17s · or the mouse wheel'],
      ['1 (again)', 'Rifle module', 'With the DC-15 in hand: swap its module · BURST · AUTO BARREL (hold LMB) · MARKSMAN SCOPE (one heavy shot, RMB raises the scope) · the run hands them over'],
      ['G', 'Frag grenade', 'Thrown onto the crosshair · two charges that refill one at a time'],
      ['E', 'Rifle bash', 'A shove with the stock: staggers whoever is right in front and cracks a duellist\'s guard'],
      ['Q', 'Recon scan', 'A pulse that marks every foe nearby: marked foes take more damage from you and the squad', 1],
      ['V', 'Bubble shield', 'A dome where you stand that stops enemy bolts (fork I, against Field Medic)', 1],
      ['F', 'Ion grenade / breach charge', 'Ion: stuns and drops shields · Breach: a forward blast that launches (fork II: one or the other) · with a prompt up (TALK, a temple station), F interacts instead', 1],
      ['Z', 'Artillery barrage', 'The Commander: shells walk down round the crosshair', 1],
      ['3', 'AT launcher', 'The Commando: a heavy rocket off the rifle', 1],
      ['X', 'Gunship strafing run', 'A gunship lays a line of blasts from you toward the crosshair', 1],
      ['MMB / H', 'Squad orders', 'TAP: on a trooper, the squad attacks it · on open ground, they move there · tap again to bring them back on you · HOLD: the command wheel (the world slows) · ATTACK, GRENADE and SUPPRESS cost COMMAND POINTS, earned by your kills and the squad\'s · SUPPRESS pins the foes round the crosshair: they crawl and slow their shots · ATTACK sends two round the target\'s sides to FLANK it: they hit it harder from there'],
      ['J', 'Squad stance', 'FREE ENGAGE (the default): in a fight the squad leaves your side for cover and flanking angles on the foes, then regroups on you once it is clear · FOLLOW ME: they hold the formation and fight from beside you · also on the command wheel (ENGAGE / FOLLOW), so on a pad: hold VIEW', 1],
      ['F', 'Interact', 'In a lull, walk up to someone on your side and face them (a squadmate, the one you escort, the people you are getting out): when TALK comes up under the crosshair, TAP for a line from them · optional, nothing waits on it · in the temple, opens the station you are at · beside a beaten foe on its knees, SPARE comes up: tap to let it go (light), or strike it down (dark) · F only interacts while a prompt is up: anywhere else it is your grenade or charge'],
      ['Y', 'Coordinated Fire', 'With BATTLE RHYTHM full (the blue bar over vitality): mark the foe at the reticle and every squadmate in reach puts a heavy bolt into it on your call · Fills with perfect vents, pinning foes, flanking shots, the squad\'s kills and dashing cover to cover under fire; a hit in the open breaks it, in cover far less · STEADY: suppression shakes your aim half as much · IN STEP: command points come in faster · full: COORDINATED FIRE'],
      ['T', 'Battlefield call', 'For COMMAND POINTS · a squadmate down: REINFORCE gets everyone up now · otherwise a SUPPLY DROP lands beside you: grenades, coolant and a patch-up', 1],
      ['N', 'Ping', 'Co-op: marks the spot or the foe under your crosshair for the other players · ping it again to take it down'],
      ['M', 'Map', 'In an open zone: the full map, with the districts you have found, every waystone, side quests and your party · pick a waystone you have touched to travel there (not mid-fight) · on the big story maps and in your hub: the whole map, with the objectives (or the stations and ways out), your squad and party · click the map to set a waypoint · the minimap in the corner turns with you (Settings · MINIMAP) · anywhere else M turns the music on and off'],
      ['HOLD O', 'Objective', 'What to do now, which step it is (objective 2 of 5, wave 3 of 4, step 4 of 9) and how far through you are, while held · works in every mode, the fight carries on underneath'],
    ]},
  ],
};
const TIPS = {
  jedi: [
    '<b>Pause</b> with TAB (or ESC); TAB or ENTER resumes. TAB keeps you in fullscreen, where ESC may drop you out.',
    '<b>Stamina</b> is the violet gauge beside your crosshair. Swings and blocks spend it; run dry and your guard breaks.',
    '<b>Force</b> (bottom-left bar) powers your abilities and refills over time.',
    '<b>Focus</b> builds with clean hits and parries and boosts your damage. Taking a hit breaks it.',
    '<b>Forms:</b> a campaign run starts on Shii-Cho, the first form every Jedi learns, and the masters you meet teach you the others. Each time you learn one you meditate and choose the three you carry on 1 / 2 / 3; you can re-pick them from the pause screen\'s Forms page at the start of each chapter (in survival, between waves), until the fighting starts. Each form you learn also opens its own lesson in Training.',
    { forms: ['makashi', 'soresu'], t: '<b>Sandbox forms:</b> Shii-Cho sweeps crowds, its finisher disarms blaster troopers, and W with a cut in rhythm is the <b>Sarlacc Advance</b>; Makashi beats other blades, and a parry then a quick riposte <b>disarms</b> a duellist, but bolts cost it; Soresu holds its guard and sends bolts home. Pick yours in the sandbox panel (B).' },
    'A swing turns blaster bolts back down the line they came from. A timed parry (tap RMB) always sends a bolt straight back.',
    { forms: ['shien'], t: '<b>Shien</b> sends deflected bolts home to the shooter harder, and a roll in toward the fire is the <b>Spin Advance</b>, sending every bolt home; in Djem So, G swaps to Shien.' },
    { forms: ['ataru'], t: '<b>Ataru</b> cuts harder in the air, keeps its timed parry up there, a cut out of a Force dash is the <b>Hawk-Bat Swoop</b>, and guard up with W and SPACE by a foe <b>flips over</b> it to cut into its back. It sprays the bolts it deflects.' },
    { forms: ['staff'], t: '<b>The saber staff:</b> a cut out of a roll or a Force dash is the <b>Pole Vault</b>, landing feet first on the foe and flooring it.' },
    { forms: ['niman'], t: '<b>Niman:</b> a Force power cast mid-roll or mid-dash is a <b>Flow Cast</b>: cheaper, quicker, and the dash comes back.' },
    { forms: ['jarkai'], t: '<b>Jar\'Kai:</b> cut out of a slide for the <b>Scissor Slide</b>, both blades crossing at the knees. Switching between it and the saber staff splits the staff in two, or joins the two.' },
    { forms: ['djemso'], t: '<b>Djem So</b> answers a blow taken on the held guard with a <b>Fluid Riposte</b> (hold W for the <b>Forward Stomp</b>, which breaks the guard), and its held heavy cuts are hyper-armoured.' },
    { forms: ['juyo'], t: '<b>Form VII:</b> Juyo burns Force with each swing and every hit feeds its fury, which quickens its cuts, and W in rhythm is the <b>Onslaught</b>, zig-zagging in; Vaapad feeds on blocks and parries, and a parry finds the attacker\'s Shatterpoint (your next cut on it lands double). Both take more damage the fuller their fury, and a loadout holds only one.' },
    'Any swing can be cancelled into a block, a Force power or a dash.',
    'Getting hit knocks your swing loose. Cut into a foe\'s strike mid-swing and the blades clash: nobody is hurt and you both reel. Bosses clash too.',
    '<b>Duellists</b> (Magnaguards, Sith acolytes) hold a guard, and you can read it from their weapon: held on your left, on your right, level over the head, or pointing down across the legs is the line it covers. A ring beside them shows the line too while you learn and fades as you win duels (Settings: GUARD RINGS). A blade that swells and flickers hot has read your cut. They read your cut as you wind up and swing their weapon onto its line to meet it. A cut that meets a guard that holds stops dead on the blade and bounces back. Cut in on the open side (aim the angle with a flick, high or low too), kick to break it, and don\'t throw the same angle twice: they read it.',
    'Swings only hit what\'s in front of you and plant your feet, so step into range before you cut. Parry, don\'t just block: a block lets some of the blow through. Hold your guard against a duellist and your blade moves to meet its strike on the line it\'s coming in on (it follows a feint too); parry it and your riposte cuts back on the side it left open. A skilled duellist may turn that riposte and come straight back at you: keep parrying and the exchange speeds up until someone slips or the blades lock. A lock binds high, low or (out of a long exchange) body to body, and each ends its own way.',
    'Your powers <b>master themselves</b> as you use them, and the story hands you new ones. Every 500 <b>XP</b> earns a <b>training point</b>: spend them on training when a chapter ends.',
  ],
  mando: [
    '<b>Pause</b> with TAB (or ESC); TAB or ENTER resumes. TAB keeps you in fullscreen, where ESC may drop you out.',
    '<b>Heat</b> is the gauge beside your reticle. Fill it and you overheat; press <b>R</b> to vent early.',
    '<b>Jet fuel</b> shows on the lights of your jetpack. The reticle turns orange when it runs low.',
    '<b>Gadget power</b> (bottom-left bar) fuels flame, rockets and other gadgets.',
    'The reticle turns <b>gold</b> when a target is under it.',
    '<b>Hunter\'s Eye</b> (the amber bar over vitality) fills with headshots, ricochets, kills on the wing and takedowns. Full, <b>T</b> is <b>Dead Eye</b>: time slows and you drop up to three heads.',
    'Every gun has a <b>signature move</b> of its own: the pistol\'s quickdraw, the dual blasters\' gun kata, the carbine\'s tag burst, the repeater\'s plant and the disruptor\'s overcharge. Each gun earns <b>ranks I to III</b> by use. The <b>ARMORY</b> on the pause screen shows how.',
    'Tap <b>RMB</b> just as a bolt reaches you for a <b>beskar parry</b>: it ricochets straight back at the shooter. It works with any gun.',
    'You carry two guns: a <b>sidearm</b> on 1 and a <b>primary</b> on 2. When a run hands you a gun for a full slot, you choose which to carry.',
    'Hold RMB with the single blaster to raise a shield that deflects bolts. Firing drops it; it comes back half a second after you stop. Press E behind it to cut with the vibroblade and bash with the shield, which keeps it up but spends stamina.',
    '<b>Sith acolytes</b> bat blaster fire back. Close in: punch through their guard, charge them with W + E, catch their cuts with E and finish them with a takedown.',
    'Your gadgets <b>master themselves</b> as you use them, and the story hands you new gear. Every 500 <b>XP</b> earns a <b>training point</b>: spend them on weapon upgrades when a chapter ends.',
  ],  trooper: [
    '<b>The trooper\'s powers</b> come with the campaign: the scan first, then a choice at each trial, and Commander or Commando at Mustafar.',
    '<b>Pause</b> with TAB (or ESC); TAB or ENTER resumes.',
    '<b>Heat</b> is the gauge beside your reticle. Overheat, and R pressed in the beat clears it at once.',
    'Your squad of clones holds ground while you lead: tap the <b>middle mouse button</b> (or H) on a foe to focus it, hold it for every order.',
    '<b>Specialists:</b> Hammer\'s rotary pins whatever it hits, Patch the medic (with Field Medic) patches you and gets the downed up, and Tally the scout picks off the far line.',
    '<b>Battle Rhythm</b> (the blue bar over vitality) fills with perfect vents, pins, flanks, the squad\'s kills and dashes from cover to cover. Full, <b>Y</b> is <b>Coordinated Fire</b>: your squad puts one volley into the foe you mark.',
    'Every gun has a <b>signature move</b>: the DC-15 burst\'s triple tap, the auto barrel\'s sweep, the marksman\'s steady breath and the DC-17s\' covering fire. Each earns <b>ranks I to III</b> by use. The <b>ARMORY</b> on the pause screen shows how.',
    '<b>Command points</b> (the gold bar over your squad) come from kills. Spend them on the orders that matter and on <b>T</b>: reinforcements or a supply drop.',
  ],
};

import { heroName } from '../game/wardrobe.js';
import { TELLS, tellCss } from '../fx/tells.js';
import { formOffered, refreshSandboxScope, storyReached } from '../game/sandbox-unlocks.js';
import { PAD_GLYPHS, PAD_MENU, padLayout } from '../data/gamepad.js';
import { PAD_CONTROLS } from '../data/controls-pad.js';
import { pad, padKey } from '../engine/gamepad.js';
import { isGunner } from '../state.js';

let showAll = false, device = 'kb';
export function toggleControlsDetail(hero){ showAll = !showAll; renderControls(hero); }
export function setControlsDevice(d){ device = d; }

/* the controller page: the keyboard page's panels (data/controls-pad.js), every {key} looked up in the pad binds
   (data/gamepad.js) so it says the button that really sends it, in this pad's glyphs */
const bindsFor = (hero) => padLayout(hero);   // each hero's own pad layout (the ARC trooper's: data/gamepad.js)
function padTok(k, hero){
  const gl = PAD_GLYPHS[pad.family];
  if (gl[k]) return gl[k];                    // {LS} {RS} {MENU}: a stick or button by name
  if (k === 'b') return gl.VIEW;              // the sandbox panel (the VIEW button's sandbox key)
  return padKey(k, bindsFor(hero)).replace('+', ' + ');
}
const padText = (s, hero) => s && s.replace(/\{([^}]+)\}/g, (_, k) => padTok(k, hero));
function padGroups(hero){
  const gl = PAD_GLYPHS[pad.family];
  const groups = (PAD_CONTROLS[hero] || PAD_CONTROLS.jedi).map(g => ({ title: g.title,
    rows: g.rows.map(([keys, action, note, adv, forms]) => [padText(keys, hero), padText(action, hero), padText(note, hero), adv, forms]) }));
  // the menus: under SHOW ALL MOVES
  groups.push({ title: 'MENUS', adv: 1, rows: PAD_MENU.map(([k, a, n]) => [k.split(' / ').map(x => gl[x] || x).join(' / '), a, n, 1]) });
  return groups;
}
// the tips name keyboard keys; on the controller page they name the buttons (the pause tip has its own)
function padTip(t, hero){
  const gl = PAD_GLYPHS[pad.family];
  if (t.startsWith('<b>Pause</b>')) return '<b>Pause</b> with ' + gl.MENU + '; ' + gl.MENU + ' (or ' + gl.B + ') resumes.';
  return t.replace(/\b(RMB|LMB|W \+ E|[ERHTGB123])\b/g, (m) => m === 'W + E' ? padTok('w', hero) + ' + ' + padTok('e', hero) : padTok(m.toLowerCase(), hero));
}
function keycaps(keys){
  return keys.split(' ').map(k => (k === '/' || k === '+') ? '<span>' + k + '</span>' : '<kbd>' + k + '</kbd>').join('');
}
/* a row's detail note opens in a floating card beside its column (hover, keyboard focus or a tap), never inline,
   so a long note can't stretch the column and push the other rows off the panel. The note reads as short points:
   split on ' · ' (but not 'Settings · X', which names a setting) and at sentence ends */
const notePoints = (n) => n.split(/(?<!Settings) · |(?<=[.!?])\s+(?=[A-Z])/).map(x => x.trim()).filter(Boolean);
let tip = null, hoverRow = null, focusRow = null;
function placeTip(){
  const row = hoverRow || focusRow, note = row && row.querySelector('.ca small');
  if (!note || !row.offsetParent){ if (tip) tip.classList.remove('on'); return; }
  if (tip.dataset.for !== note.innerHTML){
    const pts = notePoints(note.innerHTML);
    tip.innerHTML = '<b>' + row.querySelector('.ca').firstChild.textContent + '</b>' +
      (pts.length > 1 ? '<ul>' + pts.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '<p>' + pts[0] + '</p>');
    tip.dataset.for = note.innerHTML;
  }
  tip.classList.add('on');
  const col = row.closest('.cg').getBoundingClientRect(), r = row.getBoundingClientRect();
  const W = innerWidth, H = innerHeight, gap = 10, tw = Math.min(380, W - 2 * gap);
  tip.style.width = tw + 'px';
  const th = tip.offsetHeight;
  let x, y;
  if (W - col.right - gap >= tw + gap) x = col.right + gap;          // beside the column: right if it fits,
  else if (col.left - gap >= tw + gap) x = col.left - gap - tw;     // else left,
  else { x = Math.min(Math.max(gap, r.left), W - tw - gap); y = r.bottom + 4; if (y + th > H - gap) y = r.top - th - 4; }   // else under the row
  if (y === undefined) y = r.top - 6;
  tip.style.left = Math.round(x) + 'px';
  tip.style.top = Math.round(Math.max(gap, Math.min(y, H - th - gap))) + 'px';
}
function wireTip(el){
  if (tip) return;
  tip = document.createElement('div'); tip.id = 'ctltip'; tip.setAttribute('role', 'tooltip');
  (document.getElementById('howto') || document.body).appendChild(tip);   // inside the overlay: closing it hides the card too
  const rowOf = (t) => { const r = t && t.closest && t.closest('.cr'); return r && r.querySelector('.ca small') ? r : null; };
  el.addEventListener('pointerover', (e) => { hoverRow = rowOf(e.target); placeTip(); });
  el.addEventListener('pointerleave', () => { hoverRow = null; placeTip(); });
  el.addEventListener('focusin', (e) => { focusRow = rowOf(e.target); placeTip(); });
  el.addEventListener('focusout', () => { focusRow = null; placeTip(); });
  document.addEventListener('scroll', () => { if (tip.classList.contains('on')) placeTip(); }, true);
  addEventListener('resize', () => { if (tip.classList.contains('on')) placeTip(); });
}
/* the rows for a power or gadget the story hands out (data/store.js ids and auto-unlock keys, by the row's action):
   hidden until the story has reached it, so the page doesn't name what's still to come. A fork's two halves arrive
   together, so a row may name the other half. */
const POWER_ROWS = {
  'Pull · hold to Grasp': ['pull'], 'Barrier': ['barrier', 'throw'], 'Jump attack': ['jslam', 'mend'], 'Judgement': ['judge', 'repulse'],
  'Flamethrower': ['flame'], 'Grappling hook': ['grapple', 'mslam'], 'Whistling Birds': ['birds', 'deto'], 'Bacta stim': ['bacta'], 'Jetpack missile': ['jetmissile'],
  'Spear stab': ['disruptor'], 'Darksaber heavy cut': ['darksaber'], 'Darksaber finisher': ['darksaber'], 'Ignite / retract Darksaber': ['darksaber'], 'Darksaber throw': ['darksaber'],
};
export function renderControls(hero){
  const el = document.getElementById('ctl'); if (!el) return;
  wireTip(el); hoverRow = focusRow = null; placeTip();
  const groups = device === 'pad' ? padGroups(hero) : CONTROLS[hero] || CONTROLS.jedi;
  // no spoilers: a row or tip about a form shows once the story has taught it (a row's 5th entry: any of these forms;
  // a tip's `forms`: all of them)
  // (a power's or gadget's row the same way: POWER_ROWS, once the story has handed it out anywhere)
  refreshSandboxScope();
  const knows = (ids, any) => !ids || (any ? ids.some(formOffered) : ids.every(formOffered));
  const reached = (action) => !POWER_ROWS[action] || POWER_ROWS[action].some(id => storyReached(id, hero));
  const tips = (TIPS[hero] || TIPS.jedi).filter(t => typeof t === 'string' || knows(t.forms)).map(t => typeof t === 'string' ? t : t.t)
    .map(t => device === 'pad' ? padTip(t, hero) : t);
  let html = '';
  for (const g of groups){
    html += '<div class="cg' + (g.adv ? ' adv' : '') + '"><h4>' + g.title + '</h4>';
    for (const [keys, action, note, adv, forms] of g.rows) if (knows(forms, true) && reached(action))
      html += '<div class="cr' + (adv ? ' adv' : '') + '" tabindex="0"><div class="ck">' + keycaps(keys) + '</div><div class="ca">' + action + (note ? '<small>' + note + '</small>' : '') + '</div></div>';
    html += '</div>';
  }
  html += '<div class="cg wide adv"><h4>GOOD TO KNOW</h4><ul class="tips">' + tips.map(t => '<li>' + t + '</li>').join('') + '</ul></div>';
  html += '<div class="cg wide"><h4>ATTACK TELLS</h4><ul class="tells">' + Object.keys(TELLS).map(k =>
    '<li><i style="background:' + tellCss(k) + '"></i><b>' + TELLS[k].name + '</b><span>' + TELLS[k].note + '</span></li>').join('') + '</ul></div>';
  el.innerHTML = html;
  el.classList.toggle('all', showAll);
  el.classList.toggle('padview', device === 'pad');
  const more = document.getElementById('howtomore');
  if (more) more.textContent = showAll ? 'SHOW LESS' : 'SHOW ALL MOVES';
  const tabs = document.getElementById('howtohero');
  if (tabs){
    tabs.innerHTML = '<span data-h="jedi" class="' + (hero === 'jedi' ? 'on' : '') + '">JEDI</span>' +
                     '<span data-h="mando" class="' + (hero === 'mando' ? 'on' : '') + '">MANDALORIAN</span>' +
                     '<span data-h="trooper" class="' + (hero === 'trooper' ? 'on' : '') + '">' + heroName('trooper') + '</span>';
    const devs = document.getElementById('howtodev');
    if (devs) devs.innerHTML = '<span data-dev="kb" class="' + (device === 'kb' ? 'on' : '') + '">KEYBOARD</span>' +
                               '<span data-dev="pad" class="' + (device === 'pad' ? 'on' : '') + '">CONTROLLER</span>';
  }
}
