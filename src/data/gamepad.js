// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// GAMEPAD: the controller layout, as data. engine/gamepad.js reads it; Controls renders it (ui/controls.js).

/* Every bind turns a pad button into the keyboard key (or mouse button) the game already answers to, so a pad press
   runs exactly the code the key does, in every mode. Change a key in engine/input.js and the matching bind here moves
   with it.
     key:   a KeyboardEvent key, lower case (' ' is SPACE)
     mouse: 0 = LMB, 2 = RMB
   'base' is the plain layout; 'lb' is what a face button / bumper / D-pad does while LB is held (LB itself is
   strafe: held, the layer and the strafe go together; a lone tap toggles strafe, player/strafe.js). Anything not in 'lb' falls through to 'base'.
   SLOTS: D-pad left / up / right are the three loadout slots (keys 1 / 2 / 3: the Jedi's forms, the Mando's weapons).
   A form loadout or a fourth slot only has to change the key here.
   A bind's `sandbox` / `zone` key stands in for its own in the sandbox / an open zone (LB + VIEW: the zone's map).
   The ARC trooper has its own layout (the Mandalorian's shape with its kit on it): padLayout picks. */

// standard mapping (https://w3c.github.io/gamepad/#remapping) button index → name
export const PAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT'];

// tuning: stick dead zones and look speed (radians per second at full tilt, before the STICK SENS setting)
export const PAD_TUNE = {
  moveDead: 0.2,     // left stick: below this, no movement
  moveKey: 0.38,     // left stick: past this on an axis, that movement key counts as held (dash, flips and slides read the keys)
  lookDead: 0.14,    // right stick
  lookCurve: 1.8,    // response curve: small tilts aim finely, full tilt turns fast
  yawRate: 3.6,
  pitchRate: 2.3,
  trigger: 0.45,     // LT / RT past this are pressed
  navRepeat: [0.38, 0.12],   // menus: first repeat, then every… (seconds) while a direction is held
};
/* CONTROLLER AIM ASSIST for the blasters (player/aim-assist.js). Angles are radians off the foe's body edge, through
   the crosshair. */
export const AIM_ASSIST = {
  far: 45,          // metres: no help past this
  slowAng: 0.03,    // the look slows inside this…
  slow: 0.6,        // …to this share of its speed (hip)
  adsSlow: 0.5,     // …and this down the sights or the scope
  pullAng: 0.075,   // the view leans toward a foe inside this, only while a stick is moving…
  pull: 2.6,        // …at this rate (per second, at the zone's centre, fading to nothing at its edge)
  adsPull: 1.35,    // …this much harder braced (never through a scope)
};

const SLOTS = {
  LEFT:  { key: '1', label: 'Slot 1' },
  UP:    { key: '2', label: 'Slot 2' },
  RIGHT: { key: '3', label: 'Slot 3' },
};

export const PAD_BINDS = {
  jedi: {
    base: {
      A:  { key: ' ', label: 'Jump', note: 'Again in the air to double-jump · hold to Force leap and glide' },
      B:  { key: 'shift', label: 'Roll / dash', note: 'Any way you push the stick · again mid-roll or in the air to Force dash' },
      Y:  { key: 'f', label: 'Force Push', note: 'Holding a foe in a Grasp, throws them · with a prompt up (TALK, a temple station), interacts instead' },
      X:  { key: 'c', label: 'Force Pull · hold to Grasp', note: 'Unlocks after wave 2 · beside Push, so grab-then-throw is one roll of the thumb' },
      RB: { key: 'e', label: 'Kick', note: 'Cracks a duellist\'s guard · in a saber lock, kicks out · holstered: mid-string a spin kick, in the air a stomp' },
      RT: { mouse: 0, label: 'Saber combo', note: 'Tap: a light cut · hold: the blade draws back into a heavy cut · the left stick picks the cut, as W A S D do · in a saber lock, mash it · holstered: Force strikes, the stick picks the finisher, hold to charge a palm' },
      LT: { mouse: 2, label: 'Block · tap to parry', note: 'Hold LT and pull RT to throw the saber' },
      LB: { key: 'alt', label: 'Strafe', note: 'Hold: face the crosshair while you move and open the LB powers · tap: strafe on / off (Settings · STRAFE)' },
      L3: { key: 'control', label: 'Force slide', note: 'Out of a run' },
      R3: { key: 't', label: 'Lock on', note: 'Again to release' },
      ...SLOTS,
      DOWN: { key: '4', label: 'Holster saber' },
      VIEW: { key: 'h', label: 'Squad orders', note: 'Tap for the smart order · hold for the command wheel: the right stick picks, the D-pad picks one squadmate, let go to give it · in the sandbox, opens the sandbox panel (LB + VIEW gives orders there)', sandbox: 'b' },
    },
    lb: {
      Y:  { key: 'r', label: 'Judgement / Repulse', note: 'Whichever you earned' },
      X:  { key: 'x', label: 'Jump attack / Mend', note: 'Whichever you earned' },
      RB: { key: 'v', label: 'Barrier' },
      L3: { key: 'q', label: 'Run / walk' },
      DOWN: { key: 'g', label: 'Switch grip', note: 'Regular or reverse' },
      LEFT: { key: 'z', label: 'Ignite / retract saber', note: 'Blade out, hilt to the belt: walk or run at ease · any attack, block, power or blow lights it again' },
      UP: { key: 'n', label: 'Ping', note: 'Marks the spot or foe under the crosshair for your co-op partners · again on it to take it down' },
      RIGHT: { key: 'o', label: 'Objective (hold)', note: 'The objective, which step it is and how far through you are, while held' },
      VIEW: { key: 'h', label: 'Squad orders · in an open zone, the map', note: 'In an open zone LB + VIEW opens the full map (M on the keyboard), with fast travel to the waystones you have touched', zone: 'm' },
    },
  },
  mando: {
    base: {
      A:  { key: ' ', label: 'Hop · hold for jetpack', note: 'Burns fuel' },
      B:  { key: 'shift', label: 'Combat dive', note: 'Again mid-dive for a jet dive · in the air an air dodge, hold to boost' },
      X:  { key: 'r', label: 'Vent heat' },
      Y:  { key: 'f', label: 'Flamethrower (hold)', note: 'Unlocks after wave 2 · with a prompt up (TALK, a temple station), interacts instead' },
      RB: { key: 'q', label: 'Wrist rocket' },
      RT: { mouse: 0, label: 'Fire', note: 'Headshots deal far more · Darksaber in hand: tap a light cut, hold a heavy one' },
      LT: { mouse: 2, label: 'Brace / shield / scope', note: 'Tap LT as a bolt arrives: a beskar parry sends it back · Darksaber in hand: hold LT and pull RT to throw it · in the air, hover' },
      LB: { key: 'alt', label: 'Strafe', note: 'Hold: stay square to the crosshair and open the LB gadgets · tap: strafe on / off (Settings · STRAFE)' },
      L3: { key: 'c', label: 'Slide', note: 'Out of any run' },
      R3: { key: 'e', label: 'Close quarters', note: 'Forward + R3 jet charges, in the air a dive kick, on a floored foe a takedown · hold R3 through a blow to grab: R3 headbutts, RT throws' },
      ...SLOTS,
      DOWN: { key: '4', label: 'Holster' },
      VIEW: { key: 'h', label: 'Squad orders', note: 'Tap for the smart order · hold for the command wheel: the right stick picks, the D-pad picks one squadmate, let go to give it · in the sandbox, opens the sandbox panel (LB + VIEW gives orders there)', sandbox: 'b' },
    },
    lb: {
      Y:  { key: 'v', label: 'Whistling Birds / Detonator', note: 'Whichever you earned' },
      X:  { key: 'x', label: 'Grapple / Jetpack Slam', note: 'Whichever you earned' },
      RB: { key: 'z', label: 'Jetpack missile' },
      DOWN: { key: 'g', label: 'Bacta stim' },
      R3: { key: 't', label: 'Dead Eye', note: 'With HUNTER\'S EYE full: slow time, tag up to three heads near the reticle and drop them' },
      L3: { key: 'k', label: 'Swap shoulder', note: 'The camera to your other shoulder' },
      LEFT: { key: '5', label: 'Ignite / retract Darksaber', note: 'With the Darksaber in hand · any swing or guard lights it again' },
      UP: { key: 'n', label: 'Ping', note: 'Marks the spot or foe under the crosshair for your co-op partners · again on it to take it down' },
      RIGHT: { key: 'o', label: 'Objective (hold)', note: 'The objective, which step it is and how far through you are, while held' },
      VIEW: { key: 'h', label: 'Squad orders · in an open zone, the map', note: 'In an open zone LB + VIEW opens the full map (M on the keyboard), with fast travel to the waystones you have touched', zone: 'm' },
    },
  },
  // the clone ARC trooper (player/trooper/kit.js): the Mandalorian's shape, so a gunner's hands carry over, with its own
  // kit on it. D-pad down (the Mando's holster) is the frag grenade: the trooper never holsters.
  trooper: {
    base: {
      A:  { key: ' ', label: 'Jump', note: 'A short hop: run and jump at low cover to vault it · in low cover, vaults it · again off the hop: the combat dive · no jetpack' },
      B:  { key: 'shift', label: 'Sprint', note: 'Hold it and push forward · L3 at a sprint slides you into the cover ahead' },
      X:  { key: 'r', label: 'Vent', note: 'Overheated: press it in the beat for a perfect vent · too early or late and it jams' },
      Y:  { key: 'f', label: 'Ion grenade / breach charge', note: 'Whichever you earned · with a prompt up (TALK, a temple station), interacts instead' },
      RB: { key: 'q', label: 'Recon scan', note: 'Marks every foe nearby' },
      RT: { mouse: 0, label: 'Fire', note: 'DC-15: a burst (the auto barrel: hold) · twin DC-17s: each pull fires the other pistol' },
      LT: { mouse: 2, label: 'Aim', note: 'A tight cone and a steady reticle · the marksman scope raises the scope' },
      LB: { key: 'alt', label: 'Strafe', note: 'Hold: stay square to the crosshair and open the LB powers · tap: strafe on / off (Settings · STRAFE)' },
      L3: { key: 'c', label: 'Take cover', note: 'Beside cover: back to it (the stick slides along it, LT leans out to aim, again to leave) · at a run or a sprint with cover ahead: a slide into it · with none near: the slide' },
      R3: { key: 'e', label: 'Rifle bash', note: 'Staggers whoever is in front and cracks a duellist\'s guard' },
      LEFT:  { key: '1', label: 'DC-15 rifle', note: 'Again with the rifle in hand: its next module' },
      UP:    { key: '2', label: 'Twin DC-17s' },
      RIGHT: { key: '3', label: 'AT launcher', note: 'The Commando' },
      DOWN: { key: 'g', label: 'Frag grenade' },
      VIEW: { key: 'h', label: 'Squad orders', note: 'Tap for the smart order · hold for the command wheel: the right stick picks, the D-pad picks one squadmate, let go to give it · in the sandbox, opens the sandbox panel (LB + VIEW gives orders there)', sandbox: 'b' },
    },
    lb: {
      Y:  { key: 'v', label: 'Bubble shield' },
      X:  { key: 'x', label: 'Gunship strafing run' },
      RB: { key: 'z', label: 'Artillery barrage', note: 'The Commander' },
      R3: { key: 't', label: 'Battlefield call', note: 'For command points: reinforce, or a supply drop' },
      L3: { key: 'y', label: 'Coordinated Fire', note: 'With BATTLE RHYTHM full: mark the foe at the reticle, and the squad puts one volley into it' },
      LEFT: { key: 'k', label: 'Swap shoulder', note: 'The camera to your other shoulder · leaning out of cover picks the side on its own' },
      UP: { key: 'n', label: 'Ping', note: 'Marks the spot or foe under the crosshair for your co-op partners · again on it to take it down' },
      RIGHT: { key: 'o', label: 'Objective (hold)', note: 'The objective, which step it is and how far through you are, while held' },
      VIEW: { key: 'h', label: 'Squad orders · in an open zone, the map', note: 'In an open zone LB + VIEW opens the full map (M on the keyboard), with fast travel to the waystones you have touched', zone: 'm' },
    },
  },
};
// which layout a hero plays on
export const padLayout = (hero) => hero === 'trooper' ? 'trooper' : hero === 'mando' ? 'mando' : 'jedi';

// glyphs per pad family: the layout names buttons the Xbox way; a PlayStation pad shows its own shapes
export const PAD_GLYPHS = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', VIEW: 'VIEW', MENU: 'MENU', L3: 'L3', R3: 'R3',
          UP: 'D↑', DOWN: 'D↓', LEFT: 'D←', RIGHT: 'D→', LS: 'LS', RS: 'RS' },
  ps:   { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', VIEW: 'CREATE', MENU: 'OPTIONS', L3: 'L3', R3: 'R3',
          UP: 'D↑', DOWN: 'D↓', LEFT: 'D←', RIGHT: 'D→', LS: 'LS', RS: 'RS' },
};
export const padFamily = (id) => /054c|playstation|dualsense|dualshock|wireless controller/i.test(id || '') ? 'ps' : 'xbox';

// the menu controls, for Controls
export const PAD_MENU = [
  ['LS / D-PAD', 'Move between options', 'Left / right also slides a setting'],
  ['A', 'Select'],
  ['B', 'Back', 'On the pause screen, resumes'],
  ['MENU', 'Pause / resume', 'On the title screen, begins'],
  ['RS', 'Scroll a long panel'],
];
