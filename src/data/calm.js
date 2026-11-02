// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CALM AFTER A CHAPTER'S LAST FIGHT (game/aftermath.js). Edit freely.
//
// A loud beat lands harder after a quiet one. When a chapter ends on a duel or a hold (a mission whose last objective is
// one, or a stretch of a level's waves), the next chapter card doesn't slam straight in: the field is quiet, the music
// drops, a marker comes up at the rally point (where the story's voice is waiting, if they stayed on set: game/onset.js)
// and a short exchange plays over the comms while you walk there. Reach it once the exchange has been said and the
// chapter closes as before (the upgrade screen, then the next card). About 20 to 40 seconds, and never more than `max`.
//
// Lines are [who, say]: who null is the story's voice (whoever speaks for the chapter: data/campaign.js storyVoice), 'YOU'
// is the hero. By story (the campaign's storyHero: jedi, mando, trooper):
//   duel / hold   exchanges for a chapter that ended on a duel or a hold (a wave chapter counts as a hold), one picked by
//                 the chapter's place in the story so a run doesn't hear the same one twice in a row
//   chapters      a chapter's own exchange, by chapter id (wins over the pools); `false` skips the calm for that chapter
//   label         the HUD's line while it runs

export const CALM_CFG = {
  after: ['duel', 'hold'],   // the last objective kinds that earn a calm (a wave chapter always does)
  markAt: 2.4,               // s: the marker and the exchange come up once the CHAPTER COMPLETE banner has been read
  far: [24, 34],             // m: how far from the hero the rally point is, when nobody is waiting on set to mark it
  near: 10,                  // m: someone on set nearer than this is too close to walk to: they meet you at a new spot
  reach: 3.2,                // m: how close counts as there
  min: 7,                    // s: the earliest it can close, even standing on the marker (the exchange gets a word in)
  talkMax: 26,               // s: past this, reaching the marker closes it even with the exchange still going
  max: 40,                   // s: it closes on its own, wherever you are
};

export const CALM = {
  jedi: {
    label: 'REGROUP',
    duel: [
      [[null, 'Breathe. Let your hands stop shaking before you holster that blade. Then come to me.']],
      [[null, 'It is done. Walk, do not run. Running is for when something is chasing you.'], ['YOU', 'Nothing is chasing me.'], [null, 'Then walk.']],
      [[null, 'You won that one. Carry it lightly. The next one will not care how this one went.']],
      [[null, 'Good. Come back to me. Let the Force settle before we move on.']],
    ],
    hold: [
      [[null, 'The line held. Take the walk back slowly; you have earned that much.']],
      [[null, 'Quiet now. Listen to it. It does not happen often, and it never lasts.'], ['YOU', 'Where to?'], [null, 'To me. Then onward.']],
      [[null, 'That is the last of them. Regroup at the beacon, and drink something.']],
    ],
    chapters: {
      'last-lesson': [['MASTER VAEL', 'Good. Now sit with it a moment. Winning is the easy half; carrying it is the rest.'], ['ILSA VENN', 'Enjoy it. Next time I will not go easy.'], ['MASTER VAEL', 'Ilsa. Walk with us.']],
      siege: [['MASTER VAEL', 'Walk with me. The archive will still be burning in a minute, and I need you steady when we get there.']],
      mustafar: [['MASTER VAEL', 'The children are aboard. Walk, do not run. They are watching how you carry yourself.'], ['YOU', 'They are watching you, Master.'], ['MASTER VAEL', 'Then we both walk.']],
      exegol: false,
    },
  },
  mando: {
    label: 'REGROUP',
    duel: [
      [[null, 'It is done. Check your plates and your charges as you walk. Then come to the forge fire.']],
      [[null, 'You put them down. Now let your breathing come back.'], ['YOU', 'It has.'], [null, 'It has not. I can hear it from here.']],
      [[null, 'Good. Walk back to me. We do not leave anyone on the field, including you.']],
    ],
    hold: [
      [[null, 'They are broken. Walk the line back to me and count who is still standing.']],
      [[null, 'Quiet. The clan will remember that you held here. Regroup.'], ['YOU', 'This is the Way.'], [null, 'This is the Way.']],
      [[null, 'That is the last of them. Come back. Reload while you walk.']],
    ],
    chapters: {
      archive: [['THE ARMORER', 'Reload as you walk. The hangar is through the lower yard, and the droid will not wait long.']],
      'trial-first': [['THE ARMORER', 'Kael will follow you now. That was the point of the fight, not the fall.'], ['YOU', 'He hits hard.'], ['THE ARMORER', 'So do you. Walk it off.']],
      'trial-acrobat': [['THE ARMORER', 'Skye will not say it, so I will. She was glad it was you who put her down.']],
      'trial-knight': [['THE ARMORER', 'Brakka has not lost a fight in twelve years. He will be in a foul mood for a day, and loyal for the rest of his life.']],
      spearhead: [['THE ARMORER', 'The road is open. Walk to me, and let the others catch up. We go through that gate together.']],
      exegol: false,
    },
  },
  trooper: {
    label: 'RALLY POINT',
    duel: [
      [[null, 'Target down. Weapons cool, brother. Rally on me.']],
      [[null, 'That is how it is done. Walk it back to me, check your packs.'], ['YOU', 'Packs are fine.'], [null, 'Check them anyway.']],
      [[null, 'Good work. Stand down for a minute. That is an order, and the only kind I still give.']],
    ],
    hold: [
      [[null, 'Line held. Count heads on your way back to me.'], ['SGT. VANT', 'All here, Captain. Brisk is talking, so he is alive.']],
      [[null, 'They are done. Rally point, brother. Walk, do not run; nobody is shooting.']],
      [[null, 'That is the last wave. Breathe, then come to me.']],
    ],
    chapters: {
      siege: [['THE CAPTAIN', 'Reload, then rally on me. We are going after Brisk, and I want everyone breathing when we get there.']],
      archive: [['THE CAPTAIN', 'He is out. Walk him back to the gunship slowly. He will want to tell you the whole thing.'], ['BRISK', 'Every word of it.']],
      refuge: [['THE CAPTAIN', 'Read it again on the way back if you need to. It will still say the same thing.']],
      'trial-first': [['THE CAPTAIN', 'That is a squad. Rally on me, all of you.'], ['BRISK', 'Thirty-one and good at it.'], ['THE CAPTAIN', 'Do not push it.']],
      lothal: [['THE CAPTAIN', 'File is aboard. Walk to the gunship, brother. The rain is not going anywhere, and neither are we.']],
      spearhead: [['THE CAPTAIN', 'The lift is open. Walk to me. I want one minute with my brothers before you go up.']],
      exegol: false,
    },
  },
};
