// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// WALK-UP LINES: what the people on your side say when you walk up to them in a lull and tap H (game/talk.js). Optional
// story, never needed: nobody repeats themselves until they've said everything they have (then they go round again).
//
// By the name over their head: squadmates (data/allies.js rosters), a chapter's guest fighters, the escort you walk
// across the field (data/missions.js `escort`). A list is the same whoever plays; { jedi, mando, trooper } gives each
// hero their own (heroKey falls back to the Jedi's). People being got out (a hold's evacuees) go by their `kind`.
// `MISSION_TALK` lays lines for one mission over these, by mission id then name, and `CHAPTER_TALK` for one chapter of a
// story, by story then chapter id. Keep each line short: one breath.

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
  // ---------- the story's voice, staying on set after a chapter's opening (data/cast.js `stays`, game/onset.js) ----------
  'MASTER VAEL': ['I am not going anywhere. Go on. I will be here when it is quiet again.', 'Your guard drops on the left when you are tired. You are tired.',
                  'I taught forty padawans in that temple. I remember every one of their stances. Yours is the worst. Also the bravest.',
                  'Do not look back at me in the middle of a fight. I can look after myself. I was doing it before you were born.'],
  'THE ARMORER': ['I will be here. The forge fire does not go out because the covert is burning.', 'Your left pauldron is loose. I will fix it after. Fight around it.',
                  'Every piece of beskar you wear was something else once. So were you.', 'Go. If they come this way, they will find I am not only a smith.'],
  'THE CAPTAIN': ['I have your back, brother. Same as every fight since Geonosis.', 'Keep your head down and your rifle up. The rest is details.',
                  'Eight years I told myself we were finished with this. We were not. Neither are they.',
                  'Do not wait for an order. You stopped needing those a long time ago.'],
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

// a chapter's own lines, laid over TALK and MISSION_TALK by name: by story (jedi, mando, trooper), then chapter id
export const CHAPTER_TALK = {
  jedi: {
    'last-lesson': { 'MASTER VAEL': ['Ilsa fights to win. You fight not to lose. One of those wins the spar, and it is not yours yet.', 'Training blades sting. Real ones do not give you time to notice.'] },
    siege: { 'MASTER VAEL': ['Keep your eyes on the doors, not on the gate. Whoever opened it is not coming back through it.', 'Ilsa was the best of you. That is what frightens me.'] },
    mustafar: { 'MASTER VAEL': ['The children first. Then the academy. Then whatever is left of my temper.', 'They were taught to hate us here. Do not prove the lesson right.'] },
  },
  mando: {
    siege: { 'THE ARMORER': ['Get to the pad. I will hold this end of the street.', 'Rook is safe. For now. Ossik owes us for that, and he knows it.'] },
    archive: { 'THE ARMORER': ['The foundlings are below. The upper yard is all that stands between them and the cables.', 'Rook will forgive me for the blaster. Eventually.'] },
    refuge: { 'THE ARMORER': ['The ship lifts when the jammers are down. Not before.', 'He wanted to help. They always want to help. That is how we lose them.'] },
    'trial-first': { 'THE ARMORER': ['Kael is right to challenge. It is the custom. Win anyway.', 'He left because of me. He came back because of the foundlings. That is enough.'] },
    'trial-acrobat': { 'THE ARMORER': ['Skye flies better than she fights. Keep her on the ground and it is your fight.'] },
    'trial-knight': { 'THE ARMORER': ['Brakka is the oldest of us still wearing the full set. Show him respect. Then put him down.'] },
    spearhead: { 'THE ARMORER': ['The iron road. My father helped lay it, before the Magistrate took it.', 'Every clan that scattered is here today. Look at them. Then look ahead.'] },
  },
  trooper: {
    order: { 'THE CAPTAIN': ['The General first. The rest of the company will have to forgive us.', 'If they ask, it was my call. It was. Remember that.'] },
    siege: { 'THE CAPTAIN': ['Not on the manifest means not friendly. Eyes on that transport.', 'Eight years on these docks. I almost liked the quiet.'] },
    archive: { 'THE CAPTAIN': ['Three doors. One squad. Brisk on the other side of one of them.', 'Fast, loud and together. Same as Kamino.'] },
    refuge: { 'THE CAPTAIN': ['Whatever the files say, we read them together.', 'This ship put the chips in our heads. I want to see how.'] },
    'trial-first': { 'THE CAPTAIN': ['Brisk is complaining. That means he is warming up.', 'One squad. I mean it.'] },
    lothal: { 'THE CAPTAIN': ['We grew up down here. Mind the third level, it floods first.', 'The Marshal\'s men do not know these halls. We do.'] },
    hoth: { 'THE CAPTAIN': ['Kast\'s clones hold that trench like it is the last one on the planet. Maybe it is.'] },
    spearhead: { 'THE CAPTAIN': ['The whole company, brother. Look at them. Nobody ordered them here.'] },
    exegol: { 'THE CAPTAIN': ['I will be right here when you come down. Make sure you come down.'] },
  },
};

// one mission's own lines, laid over TALK by name (mission id, then name)
export const MISSION_TALK = {
  breakout: { 'RX-4': ['Query: is a breakout illegal if the prison is? Answer: irrelevant, we are already doing it.'] },
};
