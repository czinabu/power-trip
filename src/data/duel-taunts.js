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
  refuge:   { jedi: ['You fight like the ones I buried here.', 'The younglings are watching you lose.', 'Your Order ended. You just haven\'t noticed.'],
              mando: ['Your armour won\'t save the little ones, hunter.', 'Pretty metal. It dents.', 'The children board, you fall. That\'s the trade.'] },
  vault:    { jedi: ['I read every name in that vault. Yours is next.', 'Burn with your archive, Jedi.', 'The Ledger already told me how you die.'],
              mando: ['Mud and metal. I\'ll take the helmet as a trophy.', 'You came into the fire for scrolls? Fool.', 'Smoke hides me. Nothing hides you.'] },
  gallows:  { jedi: ['I have broken bigger than you on this yard.', 'The rope is waiting, Jedi.', 'Every prisoner here begged. You\'ll beg too.'],
              mando: ['Keep swinging. I like it when they tire.', 'That beskar will make a fine anchor for the noose.', 'You\'re slowing, hunter.'] },
  strike:   { jedi: ['The Warden does not lose prisoners. Or Jedi.', 'Your squad dies the moment you do.', 'This blockhouse has held for years. Tonight too.'],
              mando: ['Iron holds, Mandalorian. Iron always holds.', 'Your squad is thinning. Look.', 'You hit like a recruit.'] },
  pens:     { jedi: ['Every child here is a debt. You are paying it.', 'Their cells stay locked while I breathe.', 'You will make a fine addition to my list.'],
              mando: ['You want them back? Bleed for them.', 'They\'re mine, bounty or no bounty.', 'You\'ll fit in a pen, too.'] },
  order66:  ['Execute it, brother. Make it easy on yourself.', 'Same tank, same training. I\'m just better.', 'The General dies tonight. You can watch or join her.'],
  warcamp:  ['You still flinch left, brother. Twenty years and you still flinch left.', 'Read my orders? Read this.', 'Every brother out there would follow me. Not you.'],
  hunt:     ['Faster. I taught you better than this.', 'You\'re breathing hard, brother. Altitude or fear?', 'The Captain held out longer than you will.'],
  broadcast: ['Hear that? The order is singing. Fight louder.', 'It\'s in your chip too, brother. Listen.', 'One more minute and every brother hears it.'],

  // one-off foes and the trials (by name)
  'VX-7':               { jedi: ['TARGET RESISTING. LETHAL FORCE AUTHORISED.', 'JEDI SIGNATURE CONFIRMED. BOUNTY DOUBLED.', 'BLADE PATTERN LOGGED. COUNTERING.'],
                          mando: ['BESKAR DETECTED. ADJUSTING. YOU WILL STILL FAIL.', 'FOUNDLING TRACKER ACTIVE. YOU ARE IN THE WAY.', 'MANDALORIAN. PRIORITY TARGET.'] },
  'THE OVERSEER':       { jedi: ['These children will forget your face by morning.', 'The forge needs fuel. You\'ll do.', 'I taught them to fear. Watch.'],
                          mando: ['I break foundlings. I\'ll break you.', 'Your Creed melts like the rest.', 'Down, Mandalorian. On your knees.'] },
  'THE HOUNDMASTER':    { jedi: ['My hounds caught your scent an hour ago, Jedi.', 'Run. They love it when you run.', 'Every pack needs a kill.'],
                          mando: ['Every hound I own wants a bite of that beskar.', 'The pack\'s hungry, hunter.', 'Your jetpack smells like dinner.'] },
  'THE IRON WARDEN':    ['Iron holds. You do not.', 'Every blow you land, I take. And I keep coming.', 'This gate has never opened for anyone.'],
  'THE AVALANCHE':      { jedi: ['The mountain is coming down, Jedi. On you.', 'Ice under you, rock above. Choose.', 'I am the slope. Climb me.'],
                          mando: ['The whole slope is coming, and you\'re in its path.', 'Fly all you like. The snow follows.', 'Beskar doesn\'t stop an avalanche.'] },
  'THE SALVAGE MASTER': { jedi: ['Your saber will fetch a good price. Hold still.', 'I strip wrecks. You\'re a wreck.', 'Kyber sells by the gram.'],
                          mando: ['Beskar plates. I\'ll strip them off you myself.', 'You\'re worth more in pieces.', 'Every graveyard needs a new hull.'] },
  'THE OUTRIDER':       { jedi: ['Run, Jedi. I\'ll ride you down.', 'Open ground, no walls. Mine.', 'I\'ve lanced faster than you.'],
                          mando: ['Your jetpack won\'t outrun my lance.', 'Land, hunter. Let\'s finish it.', 'The grass hides nothing from me.'] },
  'THE SHIELD CAPTAIN': { jedi: ['Push harder. My wall does not break.', 'Behind this shield, I am the army.', 'Every swing tires you, not me.'],
                          mando: ['Shoot it all you like. The shield holds.', 'Rockets? I\'ve eaten worse.', 'Come around it. I dare you.'] },
  'SERA QUILL':         ['Faster. You are thinking. Stop thinking.', 'Again. Your feet are lying to you.', 'Good. Now do it without hesitating.'],
  'ILSA VENN':          ['There it is. Your guard is down again.', 'You still lead with your shoulder.', 'I am not going easy. Neither should you.'],
  'THE ECHO':           ['Every swing you make, I made first.', 'You are fighting your own shadow.', 'I am what you were going to become.'],
  'THE GRAND INQUISITOR': { jedi: ['I wrote the Ledger. I will write your name last.', 'Every Jedi I killed fought like this.', 'Your Master knelt. So will you.'],
                            mando: ['Jedi, Mandalorian. Every name burns the same.', 'Your clan is a line in my book.', 'I hunted your kind before I hunted theirs.'] },
  'THE FORGEMASTER':    { jedi: ['This forge has eaten better than you.', 'I shaped the blades that killed your Order.', 'Heat, hammer, ash. That\'s you.'],
                          mando: ['I made the steel that kills you.', 'Beskar melts too. Slowly.', 'Into the furnace, Mandalorian.'] },
  'CAPTAIN VORN':       ['The Marshal said you would fold. Fold, deserter.', 'No chip, no orders, no future.', 'You\'re a fault in the line, deserter.'],
  'THE MARSHAL\'S RECORD': ['RECORD CT-0451. TARGET LAGGING. INCREASE PACE.', 'RECORD CT-0451. SCORE DEFICIT. ADAPT.', 'RECORD CT-0451. YOU ARE NOT FIRST IN BATCH.'],
  'THE WALL':           ['Tired already? The door is still shut.', 'Patience is a blade too.', 'I have stood here longer than you have lived.'],
  'THE CHALLENGER':     ['Now you fight like a Mandalorian.', 'Good. The old custom wants blood.', 'Don\'t stop now.'],
  'THE ACROBAT':        ['Up here. Always up here. Keep up.', 'You\'re stuck to the ground. Let go.', 'Watch my feet, not my blade.'],
  'THE JET ACE':        ['Your fuel is low. Mine isn\'t.', 'Higher. Come on, higher.', 'You fly like a cargo hauler.'],
  'THE KNIGHT':         ['Better. Now do not let me back in.', 'You learned that out there? Show me more.', 'Do not rest on one good strike.'],
  'THE CLAN CHAMPION':  ['Good. Now show me the rest of it.', 'Beskar to beskar. Don\'t give an inch.', 'The clan is watching. Earn it.'],

  // any duel foe without its own line (by enemy type)
  acolyte: { jedi: ['Your Master would be ashamed.', 'Your form is a children\'s drill.', 'I was trained to kill your kind.'],
             mando: ['You can\'t shoot what you can\'t catch.', 'Bolts bend around me, hunter.', 'Your armour has seams.'] },
  duelist: ['Enough playing. Now I fight.', 'You\'ve had your warm-up.', 'Now the real duel.'],
  brute:   ['Stop running and hit me.', 'I don\'t tire. You do.', 'Stand still.'],
  lancer:  ['You\'re open. You\'ve been open all along.', 'My reach, my rules.', 'One clean line. That\'s all I need.'],
  phalanx: ['Break on it. They all break on it.', 'The shield doesn\'t care how brave you are.', 'Hold the line. Mine.'],
  officer: ['Squad, stand down. This one\'s mine.', 'I don\'t need a squad for you.', 'Rank has its privileges.'],
};

// the rematch, still wearing what you did to it last time
export const SCARRED = {
  inquisitor: { jedi: ['This scar was a gift. Let me give one back.', 'I still feel your blade. Feel mine.', 'You cut the mask. Now I cut you.'],
                mando: ['You marked me, hunter. I\'ve been waiting to return it.', 'The wound itches. You\'ll scratch it.', 'I healed. You won\'t.'] },
  vx7:        ['DAMAGE LOGGED. GRUDGE LOGGED. ENGAGING.', 'PLATING BREACH CAUSE: YOU. CORRECTING.', 'REPAIRS INCOMPLETE. VENGEANCE PRIORITISED.'],
  marshal:    ['You keep cutting me, brother, and I keep coming back. Doesn\'t that tell you anything?', 'Another scar, another lesson. You never learn yours.', 'I carry every wound you gave me. I\'ll give them back.'],
};

// a line from a taunt entry: a hero's own lines first (heroText), then one of them in turn, so a retry hears the next
// line rather than the same one again. Missing → null
const turn = {};
export function pickLine(v, heroText, key){
  const t = Array.isArray(v) ? v : heroText(v);   // (a bare list is every hero's)
  if (!Array.isArray(t)) return t || null;
  if (!t.length) return null;
  const k = turn[key] = ((turn[key] ?? -1) + 1) % t.length;
  return t[k];
}

export const SCARS = {
  inquisitor: { names: ['THE INQUISITOR', 'THE SEVENTH BLADE'], cut: 0.12, max: 2, fx: 'smoke',
                where: { refuge: 'the refuge', vault: 'the archive' } },
  vx7:        { names: ['VX-7'], cut: 0.12, max: 1, fx: 'sparks', where: { covert: 'the covert' } },
  marshal:    { names: ['THE MARSHAL'], cut: 0.1, max: 3, fx: 'smoke',
                where: { order66: 'the firebase', warcamp: 'his war camp', hunt: 'the canyon' } },
};
export const scarOf = (name) => Object.keys(SCARS).find(k => SCARS[k].names.includes(name)) || null;
