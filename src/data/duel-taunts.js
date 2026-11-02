// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MID-DUEL STORY TURNS, as data. game/mission.js reads this.
//
// TAUNTS: the one line a duel foe says when it hits its rage threshold (the mission's `rage`), shown in the banner under its
// name while the camera punches in on it. Looked up by mission id first (for a foe met in more than one mission), then by
// the foe's name (one-off foes, the trials), then by the enemy type it's built from. Each is a string or { jedi, mando,
// trooper } (a missing trooper line falls back to the mando one, like every other hero line).
// SCARRED: the line instead, when it's a rematch and it still carries a wound you gave it (SCARS below).
//
// SCARS: the foes that break off and come back. Beat one down to its `escape` and it leaves carrying a wound; the next
// time you meet it (by name) it starts that much weaker, wears the wound where you can see it, and its rage line knows
// it. Each escape you force is one more scar (up to `max`). key → { names: the duel names it goes by, cut: max hp taken
// off per scar, max, fx: 'smoke' | 'sparks' (what trails off the wound), where: { mission id: the place, for the line } }.

export const TAUNTS = {
  // the foes met more than once (by mission id)
  refuge:   { jedi: 'You fight like the ones I buried here.', mando: 'Your armour won\'t save the little ones, hunter.' },
  vault:    { jedi: 'I read every name in that vault. Yours is next.', mando: 'Mud and metal. I\'ll take the helmet as a trophy.' },
  gallows:  { jedi: 'I have broken bigger than you on this yard.', mando: 'Keep swinging. I like it when they tire.' },
  strike:   { jedi: 'The Warden does not lose prisoners. Or Jedi.', mando: 'Iron holds, Mandalorian. Iron always holds.' },
  pens:     { jedi: 'Every child here is a debt. You are paying it.', mando: 'You want them back? Bleed for them.' },
  order66:  'Execute it, brother. Make it easy on yourself.',
  warcamp:  'You still flinch left, brother. Twenty years and you still flinch left.',
  hunt:     'Faster. I taught you better than this.',
  broadcast: 'Hear that? The order is singing. Fight louder.',

  // one-off foes and the trials (by name)
  'VX-7':               { jedi: 'TARGET RESISTING. LETHAL FORCE AUTHORISED.', mando: 'BESKAR DETECTED. ADJUSTING. YOU WILL STILL FAIL.' },
  'THE OVERSEER':       { jedi: 'These children will forget your face by morning.', mando: 'I break foundlings. I\'ll break you.' },
  'THE HOUNDMASTER':    { jedi: 'My hounds caught your scent an hour ago, Jedi.', mando: 'Every hound I own wants a bite of that beskar.' },
  'THE IRON WARDEN':    'Iron holds. You do not.',
  'THE AVALANCHE':      { jedi: 'The mountain is coming down, Jedi. On you.', mando: 'The whole slope is coming, and you\'re in its path.' },
  'THE SALVAGE MASTER': { jedi: 'Your saber will fetch a good price. Hold still.', mando: 'Beskar plates. I\'ll strip them off you myself.' },
  'THE OUTRIDER':       { jedi: 'Run, Jedi. I\'ll ride you down.', mando: 'Your jetpack won\'t outrun my lance.' },
  'THE SHIELD CAPTAIN': { jedi: 'Push harder. My wall does not break.', mando: 'Shoot it all you like. The shield holds.' },
  'SERA QUILL':         'Faster. You are thinking. Stop thinking.',
  'ILSA VENN':          'There it is. Your guard is down again.',
  'THE ECHO':           'Every swing you make, I made first.',
  'THE GRAND INQUISITOR': { jedi: 'I wrote the Ledger. I will write your name last.', mando: 'Jedi, Mandalorian. Every name burns the same.' },
  'THE FORGEMASTER':    { jedi: 'This forge has eaten better than you.', mando: 'I made the steel that kills you.' },
  'CAPTAIN VORN':       'The Marshal said you would fold. Fold, deserter.',
  'THE MARSHAL\'S RECORD': 'RECORD CT-0451. TARGET LAGGING. INCREASE PACE.',
  'THE WALL':           'Tired already? The door is still shut.',
  'THE CHALLENGER':     'Now you fight like a Mandalorian.',
  'THE ACROBAT':        'Up here. Always up here. Keep up.',
  'THE JET ACE':        'Your fuel is low. Mine isn\'t.',
  'THE KNIGHT':         'Better. Now do not let me back in.',
  'THE CLAN CHAMPION':  'Good. Now show me the rest of it.',

  // any duel foe without its own line (by enemy type)
  acolyte: { jedi: 'Your Master would be ashamed.', mando: 'You can\'t shoot what you can\'t catch.' },
  duelist: 'Enough playing. Now I fight.',
  brute:   'Stop running and hit me.',
  lancer:  'You\'re open. You\'ve been open all along.',
  phalanx: 'Break on it. They all break on it.',
  officer: 'Squad, stand down. This one\'s mine.',
};

// the rematch, still wearing what you did to it last time
export const SCARRED = {
  inquisitor: { jedi: 'This scar was a gift. Let me give one back.', mando: 'You marked me, hunter. I\'ve been waiting to return it.' },
  vx7:        'DAMAGE LOGGED. GRUDGE LOGGED. ENGAGING.',
  marshal:    'You keep cutting me, brother, and I keep coming back. Doesn\'t that tell you anything?',
};

export const SCARS = {
  inquisitor: { names: ['THE INQUISITOR', 'THE SEVENTH BLADE'], cut: 0.12, max: 2, fx: 'smoke',
                where: { refuge: 'the refuge', vault: 'the archive' } },
  vx7:        { names: ['VX-7'], cut: 0.12, max: 1, fx: 'sparks', where: { covert: 'the covert' } },
  marshal:    { names: ['THE MARSHAL'], cut: 0.1, max: 3, fx: 'smoke',
                where: { order66: 'the firebase', warcamp: 'his war camp', hunt: 'the canyon' } },
};
export const scarOf = (name) => Object.keys(SCARS).find(k => SCARS[k].names.includes(name)) || null;
