// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HOW TO DO IT: the inputs for each form's saber finisher and its signature move, for the Forms page (ui/forms-ui.js).
// Each is a short run of steps: [keys, what it is]. Keys are said the keyboard's way (as data/tutorial.js says them) and
// shown as key chips that turn into the pad's buttons when a controller is in hand (engine/gamepad.js padKeys).
// A step's keys: tokens split on spaces; HOLD / TAP stay words, '+' joins keys pressed together.

// every form's finisher is struck the same way: break the guard, then attack while the gold hilt shows over the foe
export const FINISHER_HOW = [['E E', 'break its guard'], ['LMB', 'at the hilt']];

// each form's signature (the move its STRENGTHS line names: data/forms.js FORM_CODEX pros)
export const SIGNATURE_MOVES = {
  shiicho: { name: 'SARLACC ADVANCE', how: [['LMB', ''], ['W + LMB', 'in rhythm']] },
  makashi: { name: 'RIPOSTE DISARM',  how: [['TAP RMB', 'parry'], ['LMB', 'at once']] },
  soresu:  { name: 'BOLTS SENT HOME', how: [['HOLD RMB', 'facing the fire']] },
  ataru:   { name: 'HAWK-BAT SWOOP',  how: [['SHIFT', ''], ['LMB', 'out of the dash']] },
  djemso:  { name: 'FORWARD STOMP',   how: [['HOLD RMB', 'take a blow'], ['W + LMB', '']] },
  shien:   { name: 'SPIN ADVANCE',    how: [['W + SHIFT', 'roll in at the fire']] },
  niman:   { name: 'FLOW CAST',       how: [['SHIFT', ''], ['F', 'or any power, mid-roll']] },
  juyo:    { name: 'ONSLAUGHT',       how: [['LMB', ''], ['W + LMB', 'in rhythm']] },
  vaapad:  { name: 'SHATTERPOINT',    how: [['TAP RMB', 'parry'], ['LMB', 'at the glint']] },
  staff:   { name: 'POLE VAULT',      how: [['SHIFT', ''], ['LMB', 'out of the roll']] },
  jarkai:  { name: 'SCISSOR SLIDE',   how: [['W', ''], ['CTRL', ''], ['LMB', 'mid-slide']] },
};
