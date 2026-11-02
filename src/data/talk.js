// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// WALK-UP LINES: what the people on your side say when you walk up to them in a lull and tap H (game/talk.js). Optional
// story, never needed: nobody repeats themselves until they've said everything they have (then they go round again).
//
// By the name over their head: squadmates (data/allies.js rosters), a chapter's guest fighters, the escort you walk
// across the field (data/missions.js `escort`). A list is the same whoever plays; { jedi, mando, trooper } gives each
// hero their own (heroKey falls back to the Jedi's). People being got out (a hold's evacuees) go by their `kind`.
// `MISSION` lays lines for one mission over these, by mission id then name. Keep each line short: one breath.

export const TALK = {
  // ---------- the clones ----------
  'SGT. VANT': {
    jedi: ['Never thought I\'d follow a Jedi again. Don\'t make me regret it.', 'Rifles are cool, squad\'s up. We go when you go.',
           'Quiet like this, on Kamino they\'d call it a drill. Out here it means they\'re regrouping.'],
    trooper: ['Count your charge packs, Captain. Brisk never does, so I count his too.', 'Eight years of farming, and my hands still know this rifle. Funny.',
              'If this goes bad, you get the General out. Not me. Her.', 'Brisk talks when he\'s scared. You\'ve noticed he never stops.'],
  },
  BRISK: {
    jedi: ['A Jedi. Real one. Wait till I tell... nobody. I\'ll tell nobody.', 'You do the glowing sword, we do the shooting. Fair split.'],
    trooper: ['I\'m fine. Ask me again and I\'ll still be fine. I\'m very fine.', 'Vant says I talk when I\'m scared. I talk all the time. Draw your own conclusions.',
              'If we live, I\'m buying the ration bars. The good ones. With the fruit.', 'CT-7714. They knew it. Somebody kept the old lists, Captain.'],
  },
  HAMMER: {
    jedi: ['Heavy cannon\'s warm. Point me at something.', 'I held a line for eight years. This one\'s shorter.'],
    trooper: ['Eight years holding the General\'s line. I\'m owed a better war. This\'ll do.', 'Leave the big ones to me. Everything else, to you.',
              'Kast never once asked us to die for her. That\'s why we would.'],
  },
  PATCH: ['Hold still. Well, don\'t hold still, they\'re shooting. Move carefully.', 'You\'re bleeding. Less than the last lot. Progress.',
          'Every one of you comes home. That\'s the job. That\'s the only job.'],
  TALLY: ['I count six on the far ridge. Make that five. Make that whatever you want, Captain.', 'Wind\'s from the left. They never account for the wind.',
          'Sightlines are good from here. I\'ll call them before they call you.'],
  // ---------- the clan ----------
  KORA: ['The covert taught me to shoot before it taught me to read. Both have been useful.', 'Stay close. The Armorer would melt me down if I lost you.',
         'This is the Way. Also, there are a lot of them. Both things are true.'],
  TEV: ['My first helmet still fits. The Armorer says that is a compliment.', 'You fight like the old stories. Loud.', 'I will cover the left. I always cover the left.'],
  BRUN: ['Heavy repeater, heavy beskar, heavy heart. Point me at them.', 'They came to our home. Now we come to theirs.'],
  ARLA: ['I lost count of them two fights ago. I did not lose count of us.', 'When this is done, I am sleeping for a week. In armour. On a rock.'],
  // ---------- guests and escorts ----------
  'THE MANDALORIAN': ['Same wrecks, same cores, different reasons. For now we want the same thing.', 'You Jedi talk to your swords?',
                      'I have a clan to feed. You have whatever it is Jedi have. Let\'s both get out of here.'],
  'MASTER IRO': ['A clone who refused the order. I did not think I would live to meet one.', 'Keep your rifle on the left flank. I will keep the bolts off your right.',
                 'The Force is quiet in this cold. That is not the same as gone.'],
  'RX-4': ['Statement: cell codes intact. Query: why are they shooting at the cell codes?', 'Observation: you are more effective than my previous owner. He was a toaster.',
           'Walking resumes when the shooting stops. This is not cowardice. This is arithmetic.'],
  SCRAP: ['Codes are safe. Scrap is mostly safe. Scrap would like to be entirely safe.', 'You hit them, they fall down. Scrap likes this plan.',
          'Scrap was a cargo droid once. Scrap misses cargo. Cargo does not shoot.'],
  'GENERAL KAST': ['I can walk. Slowly. Don\'t carry me, they\'ll shoot us both.', 'Three of you refused. Three, out of a whole company. Remember that.',
                   'When we get out of this jungle, I owe you more than I can pay.'],
  // ---------- the people you're getting out ----------
  youngling: ['Master said to be brave. I\'m being brave. I\'m just being brave quietly.', 'Is it true you can lift a starship? Can you lift that one?',
              'We counted. Everyone from the east dorm is here. Except the turtle.'],
  foundling: ['The Armorer said we don\'t take off our helmets. I\'m not scared. My helmet is.', 'Are you the one from the stories? You look taller in the stories.',
              'We stayed in line, like you said. Even Rin. Especially Rin.'],
  archivist: ['Twenty years cataloguing those halls. I never once thought I would run from them.', 'The scrolls can burn. We remember what was in them.',
              'Go on. We know the way out. We drew the map.'],
  prisoner: ['Nine months in that block. I stopped counting the days. I started counting the guards.', 'Whoever you are, thank you. Now get us out before they count us again.',
             'They took my name and gave me a number. I\'m taking my name back.'],
};

// one mission's own lines, laid over TALK by name (mission id, then name)
export const MISSION_TALK = {
  breakout: { 'RX-4': ['Query: is a breakout illegal if the prison is? Answer: irrelevant, we are already doing it.'] },
};
