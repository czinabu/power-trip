// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* ============================================================
   ACT IV · THE SITH GATE: the shared campaign after the three stories (game/gate.js runs it on game/campaign.js)
   ============================================================
   It opens once any one hero's campaign is beaten, and any mix of one to four heroes plays it together. Three threads,
   one name:
     · the Jedi's gate under Jedha: the temple was built on a grave, to keep a door shut
     · the Mando's Magistrate: his beskar was paid for in warships by THE BUYER, who forged a body out of it (THE VESSEL)
     · the trooper's chip files: the order that switched the chips was signed by THE CANTOR
   Darth Vexis, the Iron Magistrate and the Marshal's order all served the same dead lord without knowing it: DARTH
   KHAREL, THE UNBURIED, a thousand years in the dark and coming back through the gate. His cult is THE HOLLOW CHOIR.

   Five chapters: one together, one that is each hero's payoff (the whole party plays it, and the hero it belongs to is
   told so), then the last one together. The missions are data/missions-gate.js; every objective has a way through for
   every hero (game/locks.js). The finale reads each player's own lean and the endings they reached before. */

export const GATE_VOICE = 'GENERAL KAST';
const KAST = GATE_VOICE, VAEL = 'MASTER VAEL', ARMORER = 'THE ARMORER', CAPT = 'THE CAPTAIN', CANTOR = 'THE CANTOR', KHAREL = 'DARTH KHAREL', YOU = 'YOU';
const rival = (who, say) => ({ who, say, rival: true });
const say = (who, line) => ({ who, say: line });
// a chapter's words for each hero, with the payoff hero's own line first
const mine = (hero, own, rest) => ({ jedi: hero === 'jedi' ? own : rest, mando: hero === 'mando' ? own : rest, trooper: hero === 'trooper' ? own : rest });
const all = (v) => ({ jedi: v, mando: v, trooper: v });

// the act, as campaign.js reads acts (index 3: ACT IV)
export const GATE_ACT = { title: 'THE SITH GATE',
  open: 'Three stories ended in three places. Something was listening to all of them.' };

export const GATE_CHAPTERS = [
  { id: 'gate-wake', act: 3, kind: 'mission', mission: 'gate-wake', world: 'JEDHA, THE TEMPLE AT NIGHT', recap: true,
    title: 'THE GATE WAKES',
    brief: all(['Three stories ended in three places. Something was listening to all of them.',
                'The old seals under the Jedha temple are failing. Hold them, every one of you your own way.']),
    talk: { where: 'JEDHA, THE TEMPLE STEPS',
      lines: [[KAST, 'I brought everyone I trust, and a few I do not. Whatever is under that dais has been talking to all three of your enemies.'],
              [YOU, 'Vexis, the Magistrate, the Marshal.'], [KAST, 'All of them. None of them knew it.']] },
    opening: { lines: [[KAST, 'Three seals round the dais. Each one was built to be held a different way.'], [KAST, 'Pick one each. Go.']] },
    lines: {
      duel: all([rival(CANTOR, 'You broke his three servants. He thanks you. He did not need them any more.')]),
      escape: all(['It went down the stair, into the gate. Let it go. We follow it on our own terms.']),
      clear: all(['The gate is open, and the Cantor went through it.', 'Three roads lead to it. One for each of you. We walk all three together.']),
    } },
  { id: 'gate-jedi', act: 3, kind: 'mission', mission: 'gate-vault', world: 'EXEGOL, UNDER THE THRONE', voice: VAEL, payoff: 'jedi',
    title: 'WHAT VEXIS HEARD',
    brief: mine('jedi',
      ['This one is yours, Knight. Vexis did not fall on his own. Something was whispering to him under the throne, long before he ever met me.',
       'Silence the stones, and hear the last of it.'],
      ['The Jedi\'s road. Vexis heard a voice under the throne of Exegol before he ever turned.',
       'Silence the stones with them, and find out whose voice it was.']),
    lines: {
      chapter: all([{ by: 'vexis', vael: say('DARTH VEXIS', 'From my cell I could still hear it. I told Oren. He did not believe me. Believe me now.'),
                      else: 'He is gone, and the whispers are still here. They were never his.' }]),
      duel: all([rival('THE ECHO OF VEXIS', 'I am what he heard. Every word he spoke against you, he heard from me first.')]),
      clear: all(['The echo is gone, and it left a name: Darth Kharel, the Unburied.',
                  'The temple on Jedha was built on his grave, to keep the door shut. We forgot why.']),
    } },
  { id: 'gate-mando', act: 3, kind: 'mission', mission: 'gate-yard', world: 'A YARD PAST THE RIM', voice: ARMORER, payoff: 'mando',
    title: 'THE BUYER',
    brief: mine('mando',
      ['This one is yours. The Magistrate\'s beskar went somewhere when we broke him. It came here, to a buyer who paid in warships.',
       'Take the yard, break the moulds and find out what they were making.'],
      ['The Mandalorian\'s road. The Magistrate sold the clans\' beskar to a buyer past the Rim.',
       'Take the yard with them, and find out what the beskar was for.']),
    lines: {
      chapter: all(['They are pouring beskar into a mould shaped like a man. A very tall man.']),
      duel: all([rival('THE BUYER', 'The Magistrate thought he was selling armour. He was selling a body.')]),
      clear: all(['A vessel. They forged a body out of the clans\' beskar, one a blade will not cut easily.', 'It left this yard a month ago, for Jedha.']),
    } },
  { id: 'gate-trooper', act: 3, kind: 'mission', mission: 'gate-order', world: 'KAMINO, THE SEALED ARCHIVE', voice: CAPT, payoff: 'trooper',
    title: 'WHO GAVE THE ORDER',
    brief: mine('trooper',
      ['This one is yours, brother. The chip order was paid for by someone. The contract is in the sealed archive under Tipoca.',
       'Pull it, hold the pad, and meet whoever signed it.'],
      ['The trooper\'s road. The order that switched the chips was bought and signed. The contract is on Kamino.',
       'Pull it with them, and meet whoever signed it.']),
    lines: {
      chapter: all([{ by: 'marshal', home: say('THE MARSHAL', 'I remember the voice now, brother. It was not the Empire\'s. Let me help you find it.'),
                      else: 'The Marshal is buried in this rain. Let us find out who he was really listening to.' }]),
      duel: all([rival(CANTOR, 'I signed it with his name. Every chip was built to hear him say one word.')]),
      clear: all(['The signal under the spire was his voice. Every chip was built to hear it.', 'Three roads, one name: Kharel. Back to the gate.']),
    } },
  { id: 'gate-heart', act: 3, kind: 'mission', mission: 'gate-heart', world: 'THE HEART OF THE GATE',
    title: 'THE UNBURIED',
    brief: all(['The vessel is chained to the ring, and Kharel is coming back into it.',
                'Break the chains, hold the ring, and put him back in the dark. Together.']),
    talk: { where: 'THE GATE, THE LONG STAIR DOWN',
      lines: [[KAST, 'Every one of you finished a war to get here. This is the one under all of them.'],
              [YOU, 'And after?'], [KAST, 'After, we decide what to do with a door.']] },
    lines: {
      duel: all([rival(KHAREL, 'A thousand years in the dark. Three servants, and you broke them all. Kneel, and hold my doors for me.')]),
      clear: all(['The vessel breaks. Kharel goes back into the dark.']),
    } },
];

// THE LAST CHOICE: the gate itself. Each player is asked; the host's decides the story, each player's moves their own meter
export const GATE_CHOICES = [
  { id: 'gate', after: 'end', default: 'sealed', title: 'THE GATE', who: KAST,
    lines: ['Kharel is back in the dark. The gate is still open, and everything he knew is on the other side of it.',
            'We can seal it for good: every stone, every word, buried with him. Or we keep it open, guarded, and learn what he knew before someone worse comes looking.'],
    options: [
      { key: 'sealed', side: 'light', label: 'SEAL THE GATE', line: 'Bury the door and everything behind it. Nobody learns what he knew.' },
      { key: 'kept', side: 'dark', label: 'KEEP IT OPEN', line: 'Guard it, and study it. What he knew might win the next war.' } ] },
];

// the recap card on the first chapter: each story, with the ending this player reached and its last line, or its first line
// if they never played it
export const GATE_RECAP = {
  title: 'THREE STORIES',
  line: 'Before the gate: what happened, and what you chose.',
  stories: {
    jedi: { name: 'THE JEDI', world: 'JEDHA TO EXEGOL',
      lines: ['A Knight of the Jedha temple held its steps the night the Empire came, then gathered the scattered masters.',
              'On Exegol they met Darth Vexis, Master Vael\'s first apprentice, on a throne someone else had built.'] },
    mando: { name: 'THE MANDALORIAN', world: 'THE BROKEN COVERT',
      lines: ['A Mandalorian of the covert under the old temple brought the scattered clan home, one fighter at a time.',
              'The Iron Magistrate fell on Exegol, and the beskar he stole went back into the forge. Most of it.'] },
    trooper: { name: 'THE ARC TROOPER', world: 'THE VORRAN YARDS',
      lines: ['An ARC trooper who refused the order eight years ago was found by it again on the Vorran yards.',
              'The trail led to the Marshal, his own batch-brother, and to a signal under the spire that was older than the chips.'] },
  },
  yours: 'YOUR ENDING',
  unplayed: 'NOT YET PLAYED',
};

// the ending, per screen (game/gate.js): the gate, then this player's own hero by their lean, then what they chose before
export const GATE_EPILOGUE = {
  title: { sealed: 'THE GATE IS SHUT', kept: 'THE OPEN DOOR' },
  world: 'JEDHA, ONE YEAR LATER',
  gate: { sealed: 'The gate is sealed. Kast had the stair filled with stone from the temple\'s own walls, and nobody alive knows the words that opened it.',
          kept: 'The gate is open, and guarded. Kast keeps a watch on it day and night, and the archivists who study it do not sleep well.' },
  hero: {
    jedi: { light: 'The Knight teaches the younglings that the dark is patient, and that the light has to be too.',
            dark: 'The Knight still hears a whisper under the temple some nights, and has stopped telling anyone.',
            mid: 'The Knight walks the temple at night, listening. It is quiet. For now.' },
    mando: { light: 'The Mandalorian melted the last of the vessel\'s beskar down for the foundlings\' first armour.',
             dark: 'The Mandalorian kept a piece of the vessel\'s beskar. It is cold to the touch, and it hums.',
             mid: 'The Mandalorian took the vessel\'s beskar back to the forge. The Armorer has not decided what it becomes.' },
    trooper: { light: 'The trooper\'s squad has its own ship and its own name, and every one of them chose it.',
               dark: 'The trooper keeps the chip contract in a locker. Somebody, someday, will want to know who else signed it.',
               mid: 'The trooper\'s squad flies for whoever pays fair now, and nobody gives them an order they did not choose.' },
  },
  // what this player chose in the stories they finished (their own saves of each ending: game/gate.js)
  before: {
    jedi: { 'spared-vael': 'Vexis heard the news in his cell, and asked Vael to thank you.', 'spared-ended': 'Ilsa lit a candle for Vexis at the sealed stair.',
            'struck-vael': 'Vexis heard the news in his cell, and said nothing at all.', 'struck-ended': 'The seventh blade still hangs on the temple wall.' },
    mando: 'The clan you brought home stood the watch at the stair.',
    trooper: { home: 'The Marshal stood on the stair with the squad. He does not hear the voice any more.', ended: 'The squad carved the Marshal\'s name on the stair.' },
  },
  together: 'You did not do it alone. Nobody ever does.',
  alone: 'You went down the stair alone, and came back up.',
  raid: 'Something else on the other side of that gate heard Kharel fall. It is not finished either.',
};

// the calm after each chapter (game/aftermath.js): the chapter's voice, or Kast's
export const GATE_CALM = {
  label: 'REGROUP',
  duel: [[[null, 'It is done. Walk back to me, all of you. Count heads.']]],
  hold: [[[null, 'Quiet. Hold that, for a minute. Then on.']]],
  chapters: {
    'gate-wake': [[KAST, 'Walk back to me. Three roads, and I want every one of you on all three.'], [YOU, 'Together?'], [KAST, 'Together.']],
    'gate-jedi': [[VAEL, 'Walk with me a moment. I taught him, and I never heard what he heard. I should have listened harder.']],
    'gate-mando': [[ARMORER, 'Come back to the fire. The beskar will go home. The thing they made from it will not.']],
    'gate-trooper': [[CAPT, 'Rally on me, brothers. All of you. That contract had our names on it before we were born.']],
    'gate-heart': false,
  },
};
