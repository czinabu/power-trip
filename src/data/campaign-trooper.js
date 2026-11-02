// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARC TROOPER'S OWN STORY: NO MORE ORDERS (testing, behind ?trooper; edit the words freely). What a campaign begun
// with the trooper plays, laid over the shared chapter slots the way the Mando's and the Jedi's are (data/campaign.js
// storyChapter): each entry below is keyed by a chapter id and replaces that chapter's fields in the trooper's story.
// Ids and positions stay the same, so saves, rewards, the sandbox's gates and co-op carry on as they were. The fields
// are data/campaign-mando.js's (title, world, mission, arena, kind, steps, talk, brief, lines, opening), plus `foeLook`
// on a wave chapter (the uniform its foes wear, data/allies.js). Words are plain: whoever plays the trooper's story, a
// Jedi or Mando guest included, hears this one.
// The outline (the plan, the settings, the ending's hook): the "ARC trooper story: No More Orders" doc.
//
// THE STORY. On the night of the order three clones refused it: you, SGT. VANT and BRISK got GENERAL RHENNA KAST out of
// a jungle firebase while your company turned on you. Your batch-brother THE MARSHAL kept his chip, and let you go.
// Eight years later the three of you are deserters working the VORRAN YARDS under THE CAPTAIN, the old clone who keeps
// the band together (the voice). Then the purge companies find you. Act I takes you from the yards through the garrison
// that took Brisk to the HALCYON, the medical frigate that fitted your chips, where the files say your chip never
// failed: somebody switched it off. Act II goes back to where you were made and to Kast; Act III to the relay spire,
// where the Marshal means to give the order again, and where you learn the order was never only the Empire's.
//
// Built: the prologue, Act I (the yards, the garrison, the frigate, the Captain's drill), Act II (Kamino, Kast's line on
// Hoth, the chip foundry, the Marshal's war camp) and Act III (the hunt up the canyon, the assault on the relay spire,
// the broadcast and the Marshal), with one choice at the end (TROOPER_CHOICES) and an epilogue for each answer.

import { PURGE } from './allies.js';

export const TROOPER_VOICE = 'THE CAPTAIN';
const CAPT = TROOPER_VOICE, VANT = 'SGT. VANT', BRISK = 'BRISK', MARSHAL = 'THE MARSHAL', KAST = 'GENERAL KAST', YOU = 'YOU';
const say = (who, line) => ({ who, say: line });
const rival = (who, line) => ({ who, say: line, rival: true });

export const TROOPER_ACTS = [
  { title: 'THE DESERTERS',
    open: 'Eight years on the Vorran yards, brother. Eight years of nobody looking twice. Tonight somebody looked.' },
  { title: 'WHERE WE WERE MADE',
    open: 'Someone switched our chips off, the night before the order. Someone switched the Marshal\'s on. The answers are out there, and so is the General who walked out of that jungle with us.' },
  { title: 'NO MORE ORDERS',
    open: 'The Marshal is getting ready to send something. Every clone with a chip still in his head will hear it. We end this before he does.' },
];
// Act II's pick: Kamino (the Lothal pair's slots) or Hoth first
export const TROOPER_ACT_TWO = {
  lothal: 'Go back to Kamino for the Marshal\'s batch file',
  hoth: 'Find General Kast in the trenches on Hoth',
};
export const TROOPER_ACT_TWO_LABEL = { lothal: 'KAMINO FIRST' };

// per chapter id: the trooper's story laid over that slot
export const TROOPER_CHAPTERS = {
  // ---------------- PROLOGUE: THE NIGHT OF THE ORDER (the trooper's own chapter: data/campaign.js, `story: 'trooper'`) ----------------
  order: {
    brief: ['A firebase on the edge of the war, and a General we would have followed anywhere.',
            'At midnight the order came, and the company turned its rifles on the General. Vant, Brisk and you did not.'],
    lines: {
      duel: [rival(MARSHAL, 'You heard the order, brother. Same as I did. Step aside.')],
      escape: ['Let him go. Get the General aboard.'],
      clear: ['The ship lifts over the canopy with the General and the three of you aboard.',
              'Eight years of hiding start tonight. So does the band.'],
    } },

  // ---------------- ACT I: THE DESERTERS ----------------
  siege: {
    title: 'DOCK SHIFT', world: 'THE VORRAN YARDS',
    arena: { layout: 'shipyard', arena: 64 }, foeLook: PURGE,
    talk: { where: 'THE VORRAN YARDS, END OF SHIFT',
      lines: [[BRISK, 'Eight years hauling cargo for a foreman who cannot count. I miss the war.'],
              [VANT, 'You do not miss the war. You miss being shot at by people who were not your foreman.'],
              [CAPT, 'Quiet, both of you. Imperial transport on final approach. It is not on the manifest.']] },
    brief: ['Eight years on the Vorran yards, armour in a locker, faces nobody looks at twice. Tonight a transport set down that is not on any manifest.',
            'Purge troopers. They are here for us. Get your armour on and hold the yard.'],
    opening: { lines: [[CAPT, 'Black armour coming off the ramp. Same make as ours, brother. Same factory.'],
                       [BRISK, 'Then they know how we fight. Good. So do we.']] },
    lines: {
      wave: [
        ['They are fanning out through the containers. Keep them off the freighter.', say(VANT, 'Brisk, stay on my side of the hull!')],
        [rival(MARSHAL, 'Eight years on a dock. Is this what you refused the order for, brother?'), 'That voice. The Marshal. Do not answer him. Hold the yard.'],
      ],
      clear: ['The yard is ours, for a moment.', say(VANT, 'Captain, Brisk is gone. They dragged him onto a speeder, toward the garrison block.'),
              'Then that is where we are going.',
              'And brother: you ran that yard like a sergeant. Wear the green.'],   // (a promotion: game/wardrobe.js PROMOTIONS)
    } },
  archive: {
    title: 'THE KILL HOUSE', world: 'THE GARRISON BLOCK, VORRAN',
    kind: 'mission', mission: 'killhouse', arena: null, steps: 2,   // (it stands for the shared slot's two waves)
    talk: { where: 'BEHIND THE GARRISON WALL, IN THE RAIN',
      lines: [[VANT, 'Three rooms, a door each, all of them locked from the inside. I did kill houses on Kamino. This is a kill house.'],
              [YOU, 'Then we do it the way they taught us.'],
              [CAPT, 'Fast, loud and together. Bring him home.']] },
    brief: ['They took Brisk into the garrison block at the edge of the yards. Three rooms, a door each, and every door locked.',
            'Stack up, blow the door, clear the room. Then the next one.'],
    opening: { lines: [[CAPT, 'Towers on the yard, troopers on the door. Clear the front first.']] },
    lines: {
      breach: [
        ['Guard room. Four of them, and they did not hear us coming.'],
        [say(VANT, 'Hall\'s full of them. Watch the officer.')],
        [say(BRISK, 'About time! Is that Vant? Tell Vant he owes me a ration bar.')],
      ],
      clear: ['Brisk is out, and he talked the whole way to the gunship.',
              say(BRISK, 'They knew my number, Captain. CT-7714. Nobody on Vorran knew that.')],
    } },
  refuge: {
    title: 'WHAT THE CHIP SAYS', world: 'THE HALCYON, ADRIFT',
    mission: 'chipfiles',
    talk: { where: 'ABOARD THE GUNSHIP',
      lines: [[BRISK, 'How did they find us? Eight years and nobody looked twice.'],
              [CAPT, 'Our numbers. Someone pulled our chip records. There is only one place left that still keeps them.'],
              [VANT, 'The Halcyon. The ship that put the chips in.']] },
    brief: ['The HALCYON fitted every chip in our batch, and her records core still remembers each one. Somebody read ours.',
            'Get her power back up, pull the files, and find out what they know.'],
    opening: { lines: [[CAPT, 'A dead ship. Lights low, rifles up.'], [BRISK, 'I hate dead ships.']] },
    lines: {
      duel: [rival('CAPTAIN VORN', 'The Marshal said you would come here. He said you always come back for the paperwork.')],
      clear: ['The files are ours, and they say what I was afraid they would.',
              'Your chip did not fail, brother. Someone switched it off, the night before the order. Someone who wanted a few of us to say no.',
              'You got us through a dead ship without losing anyone. That is a lieutenant\'s work. Wear the blue.'],   // (a promotion)
    } },
  'trial-first': {
    title: 'BROTHERS IN ARMS', world: 'THE HALCYON, AFTER',
    mission: 'drill',
    talk: { where: 'THE HALCYON\'S EMPTY DECKS',
      lines: [[CAPT, 'Before we go after anyone, I want to see this squad work. Not three soldiers. One squad.'],
              [BRISK, 'Training droids? Captain, I am thirty-one years old.'],
              [CAPT, 'Then you will be thirty-one and good at it.']] },
    brief: ['The Captain has set the old training droids up on the decks, stun settings on.',
            'Take every post with your squad, not in front of it.'],
    lines: {
      // the first promotion (game/wardrobe.js PROMOTIONS): a captain's helmet and pauldron (game/look-unlocks.js)
      clear: ['That is a squad. And you led it, brother.',
              'As of tonight you are a captain, same as me. My spare helmet and pauldron are in the locker. Paint them how you like.',
              'One more thing in those files. The officer who switched our chips off signed it: General Rhenna Kast. She knew, brother. She always knew.'],
    } },

  // ---------------- ACT II: WHERE WE WERE MADE ----------------
  // Kamino (the Lothal pair's slots) and Hoth (Kast's line, the shared meeting point with the Jedi's story), in the
  // order the player picks; then the chip foundry and the Marshal's war camp.
  lothal: {
    title: 'THE DROWNED CITY', world: 'KAMINO, TIPOCA CITY\'S LOWER LEVELS',
    mission: 'drowned',
    brief: ['Somebody switched the Marshal\'s chip on. Kamino kept a file on every batch it grew, and ours is down in the lower levels.',
            'The city has been drowning since the Empire stopped buying clones. Get the file before the sea does.'],
    talk: { where: 'THE GUNSHIP, OVER THE KAMINO SEA',
      lines: [[BRISK, 'I never thought I would come back here. I used to dream about the rain.'],
              [VANT, 'You used to complain about the rain.'],
              [CAPT, 'Both of you, eyes up. The Marshal\'s men landed an hour ago.']] },
    lines: {
      chapter: ['The pods are empty. Every one of them. Stay sharp, the Marshal\'s men are in the archive.'],
      clear: ['The gunship climbs out of the storm with the file aboard.', 'Somebody switched his chip on by hand. Somebody with the code.'],
    } },
  'trial-acrobat': {
    title: 'THE OLD KILL HOUSE', world: 'KAMINO, THE TRAINING LEVEL',
    mission: 'oldkillhouse',
    brief: ['Before we go, the Captain wants one more run on the course where you and the Marshal learned to fight.',
            'The droids are running his old records. Learn how he fights, before you have to.'],
    lines: {
      clear: ['Two seconds under his best time.', 'He was always first in line, brother. That is why they switched his chip on first.'],
    } },
  hoth: {
    title: 'THE GENERAL\'S LINE', world: 'HOTH, AN ENCLAVE UNDER THE ICE',
    brief: ['General Kast is on Hoth, holding a trench line while transports carry hidden children off the ice. She is the one who switched our chips off.',
            'Hold the line beside her clones first. Then ask her why.'],
    // the Jedi on the right flank fights beside the band (a melee squadmate: data/allies.js SQUAD.roles.jedi)
    guests: [{ name: 'MASTER IRO', role: 'jedi', model: 'acolyte', look: 'MASTER IRO', weapon: 'saber', color: 0xb8a888, eye: 0x4ad06a, cloth: 0x6a4a2e }],
    talk: { where: 'HOTH, THE COMMAND TRENCH',
      lines: [[KAST, 'I would know that armour anywhere. Eight years, trooper.'],
              [YOU, 'You switched our chips off, General. The night before the order.'],
              [KAST, 'I did. Hold the forward trench with me, and I will tell you why. There is a Jedi on the line with us, Master Iro. Do not shoot him.']] },
    lines: {
      chapter: [say(KAST, 'Clones on the left, rebels on the right. You take the middle, trooper. Just like old times.')],
      duel: [say(KAST, 'Their siege trooper. I have the left. Take it.')],
      clear: ['The line held, and every transport cleared the shield.', say(KAST, 'The hangar, when the last ship is loading. I will answer you there, but you will have to earn it.')],
    } },
  'trial-knight': {
    title: 'THE GENERAL', world: 'HOTH, THE ENCLAVE\'S HANGAR',
    brief: ['Kast wants to know whether eight years taught you to think for yourself, or only to follow someone new.',
            'She fights the way she taught you to. Do not hold back. She will know.'],
    talk: { where: 'HOTH, THE ENCLAVE\'S HANGAR',
      lines: [[KAST, 'I found the chip code in a Separatist lab. I could switch off three chips before they caught me. I chose the three of you.'],
              [YOU, 'Why us?'],
              [KAST, 'Because you three asked questions. Show me you still do.']] },
    lines: {
      clear: ['Kast lowers her blade, and laughs.', say(KAST, 'Someone else had the code, trooper. He used it the other way. Find out who switched the Marshal on, and you will find out who wants the order given again.'),
              say(KAST, 'The Republic is gone, but I still hold a commission, and I am giving you one. Commander. Wear the yellow.'),   // (a promotion)
              'Hammer joins the squad. He held Kast\'s line for eight years. He says he is owed a better war.'],
    } },
  jakku: {
    title: 'THE CHIP FOUNDRY', world: 'THE FOUNDRY UNDER A DEAD VOLCANO',
    mission: 'chipworks',
    brief: ['The order list names a foundry in a dead volcano\'s shadow. The Empire said it stopped making chips when it stopped making clones.',
            'Go and see what it makes now.'],
    lines: {
      chapter: ['Those are chips on the line. New ones. They never stopped, brother.'],
      clear: ['The foundry burns, and its last shipment went to the Marshal.', 'He is not making soldiers. He is making a signal.'],
    } },
  mustafar: {
    title: 'THE MARSHAL\'S GARRISON', world: 'THE MARSHAL\'S WAR CAMP',
    mission: 'warcamp', steps: 4,   // (it stands for the shared slot's four waves)
    brief: ['The shipment went to the Marshal\'s war camp, on a plateau at the edge of nowhere. His whole company is there.',
            'Take his gate, hold it, and get to his command post. Whatever he is planning, it is written down up there.'],
    lines: {
      chapter: ['His company is forming up. Our old company, brother, painted black.'],
      duel: [rival(MARSHAL, 'You were always a step behind me, brother. Today too.')],
      // the second promotion (game/wardrobe.js PROMOTIONS): ARC, in the Captain's old ARC kit (game/look-unlocks.js)
      clear: ['He has the Captain.',
              say(VANT, 'He kept his old ARC kit in the gunship. He said it was yours the day you held a line without him. You just did. You are ARC now, brother.'),
              'His orders name a relay spire. He means to give the order again, to every clone with a chip still in his head.',
              'Tally pulled a marksman scope out of his armoury and fitted it to your DC-15. You will want it in the canyons.'],
    } },

  // ---------------- ACT III: NO MORE ORDERS ----------------
  chase: {
    title: 'THE HUNT', world: 'THE RED CANYONS OF KESH',
    mission: 'hunt',
    brief: ['The Marshal\'s gunship put down in the canyons of Kesh to refuel, and he is not in a hurry. He wants to be followed.',
            'So follow him. Every camp he leaves, we take. At the top, he turns around.'],
    talk: { where: 'THE GUNSHIP, OVER THE CANYONS',
      lines: [[VANT, 'He is leaving a trail a cadet could follow.'],
              [BRISK, 'Then it is a trap.'],
              [YOU, 'It is an invitation. He wants me to see something. Squad, on me.']] },
    lines: {
      duel: [rival(MARSHAL, 'Not yet, brother. You have not seen the spire.')],
      clear: ['The Captain is free, bruised and furious.', say(CAPT, 'He talked the whole time, brother. About the spire, and about a voice under it.')],
    } },
  spearhead: {
    title: 'THE LAST ASSAULT', world: 'THE RELAY SPIRE, THE OUTER DEFENCES',
    mission: 'lastassault',
    brief: ['Every brother we pulled out of a cell, a pod or a trench is on the beach below the spire. Kast is with them, and the Jedi she brought.',
            'Take the guns. Open the door. Then it is you and him.'],
    talk: { where: 'THE BEACH BELOW THE SPIRE',
      lines: [[KAST, 'You asked me once why I chose the three of you. This is why.'],
              [CAPT, 'The company is yours, brother. For today.'],
              [YOU, 'Not mine. Ours. Nobody here is following an order.']] },
    lines: {
      clear: ['The lift door is open. Every brother you have is behind you.'],
    } },
  exegol: {
    title: 'THE BROADCAST', world: 'THE RELAY SPIRE, IN THE STORM',
    kind: 'mission', mission: 'broadcast', arena: null, steps: 4,   // (it stands for the shared slot's four waves and its boss)
    brief: ['The spire is counting down. When it reaches zero, every clone with a chip in his head hears the order again.',
            'Hold it. Cut it. Then the Marshal.'],
    talk: { where: 'THE SPIRE\'S LIFT, GOING UP',
      lines: [[CAPT, 'Whatever he says to you up there, remember who you chose to be.'],
              [YOU, 'I remember.']] },
    lines: {
      duel: [rival(MARSHAL, 'Listen to it, brother. Can you hear it? It has been calling since before Kamino.')],
      clear: ['The spire is dark.'],
    } },
};

// the win screen's line under VICTORY (game/summary.js)
export const TROOPER_VICTORY = 'THE ORDER WAS NEVER GIVEN';

// THE CHOICE (game/choices.js): what becomes of the Marshal, asked after his fall
export const TROOPER_CHOICES = [
  { id: 'marshal', after: 'end', default: 'home', title: 'THE MARSHAL',
    who: CAPT,
    lines: ['He is down. His chip is still in his head, and it is still listening.',
            'Patch can take it out. He might wake up as the brother we lost, or as nobody at all. Or we end it here, and the voice under the spire loses its loudest friend.'],
    options: [
      { key: 'home', label: 'BRING HIM HOME', line: 'Patch takes the chip out. Whoever wakes up is coming with us.' },
      { key: 'ended', label: 'END IT', line: 'The Marshal falls at the foot of the spire, and the order dies with him.' } ] },
];

// the ending, with the door left open for the three heroes' last fight (the Jedi's and the Mando's stories point the same way)
export const TROOPER_EPILOGUE = {
  title: { by: 'marshal', home: 'BROTHERS', ended: 'NO MORE ORDERS' },
  world: 'THE VORRAN YARDS, ONE YEAR LATER',
  lines: [{ by: 'marshal',
            home: 'The Marshal woke up three days after Patch took the chip out. He did not remember the last eight years, and he cried when he saw you. He works the docks with us now. Some nights he still hears it.',
            ended: 'We buried the Marshal on Kamino, in the rain, where we were made. Brisk said the words. Nobody else could.' },
          'The band has its own ship now, and nobody on it takes an order they did not choose.',
          'Kast came to the yards last week. She says the signal under the spire was older than the chips, and older than the Republic, and that it was not finished.',
          'A Jedi heard the same signal on Jedha. A Mandalorian heard it out past the Rim. Something is coming, brother. When it does, nobody gives us the order. We choose.'],
};
