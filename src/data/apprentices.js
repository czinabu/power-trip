// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// APPRENTICES: someone who grows up beside you, one per hero (allies/apprentice.js runs them). Edit the words and numbers
// freely.
//
//   THE JEDI takes a PADAWAN: TAVI, the child from the Ledger you walked out of the pens on Tessaril (the side mission
//     A NAME IN THE LEDGER, data/side-quests.js). Tavi starts with a training saber, learns the powers and the form your
//     run is using (a run's Force Tree picks: G.unlocked, the branches you trained, G.stance), earns a saber of their own,
//     and that blade leans the way you lean (data/alignment.js).
//   THE MANDO takes in a FOUNDLING: RIN, one of the covert's children you got off the dead ship at the refuge. Rin starts
//     as a SPOTTER (no shots: marks the foe nearest you, and that foe takes more from your weapons), then carries a
//     carbine, then fights as a warrior of the clan.
//   THE TROOPER promotes one SQUADMATE to SECOND (one of the fire team: data/allies.js roster; always called in first).
//     The second hits harder and takes more, and when you go down they take the squad: everyone fights harder and you bleed out slower while they
//     hold, and the second gets you up quicker.
//
// THE RULES (allies/apprentice.js):
//   · SOLO ONLY. In co-op the apprentice stays home (the temple, the covert, the citadel), and the trooper's second fights
//     as an ordinary squadmate. In the hub they stand at their post (POST below): walk up and tap F.
//   · A SLOT, NOT AN EXTRA. They fight in one of the squad's four places (data/allies.js SQUAD.max): a mission that calls
//     a squad of three brings two plus the apprentice. Every fighting mode brings them (story chapters, missions, side
//     missions, challenges, raids, survival, the open zones, the sandbox); training and a story's prologue don't.
//   · THEY GROW WITH YOU. They earn `share` of every rank XP you earn while they fought beside you (data/profile.js
//     RANK_XP), plus `kill` for each foe they finish (`elite` for a duellist, a brute...). A stage asks for `xp`, and no
//     stage runs ahead of your own rank: `cap[rank]` is the highest stage that rank allows (the trooper's long ladder
//     has its own). Practice (training, the sandbox) pays nothing.

export const APPRENTICE_XP = { share: 0.25, kill: 1, elite: 3 };

// a stage: nm (what they are now), xp (their total to reach it), line (the card when they reach it), look: the model and
// size they fight in, and role: their numbers (data/allies.js SQUAD.roles shape)
export const APPRENTICES = {
  jedi: {
    name: 'TAVI', title: 'PADAWAN', kicker: 'YOUR PADAWAN', post: 'temple',
    // how they come to you: the side mission that brings Tavi home
    meet: { side: 'side:ledger-child' }, meetLock: 'Win A NAME IN THE LEDGER (Calls for Aid)',
    take: 'TAKE TAVI AS YOUR PADAWAN', takeLine: 'Tavi fights beside you in solo play, in one of your squad\'s places, and learns what you learn',
    blurb: 'Tavi, eight years old and the last name on the Ledger, followed you home from Tessaril.',
    cap: [1, 2, 3, 3],   // by your Order rank: Padawan, Knight, Master, Grand Master
    stages: [
      { nm: 'YOUNGLING', xp: 0, line: 'Tavi trains with a practice blade. It stings. It doesn\'t cut much.',
        look: { scale: 0.84, look: 'TAVI 0' },
        role: { hp: 120, speed: 7.0, dmg: 12, range: 11, reach: 2.0, every: [0.95, 1.25], windup: 0.24, leash: 12, melee: true, deflect: 0.25 } },
      { nm: 'PADAWAN', xp: 60, line: 'Tavi wears the braid now, and starts to use the powers you use: push, pull, a thrown blade, a healing touch.',
        look: { scale: 0.94, look: 'TAVI 1' },
        role: { hp: 160, speed: 7.2, dmg: 18, range: 12, reach: 2.1, every: [0.9, 1.15], windup: 0.23, leash: 14, melee: true, deflect: 0.35 }, powers: 1 },
      { nm: 'PADAWAN · OWN SABER', xp: 220, line: 'Tavi built a lightsaber in the forge. Its colour leans the way you lean.',
        look: { scale: 1.04, look: 'TAVI 2', own: true },
        role: { hp: 190, speed: 7.3, dmg: 24, range: 13, reach: 2.2, every: [0.85, 1.1], windup: 0.22, leash: 15, melee: true, deflect: 0.45 }, powers: 2 },
      { nm: 'KNIGHT', xp: 500, line: 'Tavi passed their trials. A Knight of what is left of the Order, and still at your side.',
        look: { scale: 1.14, look: 'TAVI 3', own: true },
        role: { hp: 220, speed: 7.4, dmg: 30, range: 13, reach: 2.3, every: [0.8, 1.05], windup: 0.22, leash: 16, melee: true, deflect: 0.55 }, powers: 9 },
    ],
    model: 'acolyte', weapon: 'saber', color: 0xd2c4a2, cloth: 0x6b4f37,
    // the blade: the practice blade until they build their own, then by your lean (game/profile.js leanOf)
    blade: { training: 0xffe6a0, light: 0x3aff8c, mid: 0x4a86ff, dark: 0xff5a2a },
    // THE POWERS (stage `powers` of them, picked from what your run has: the first that's open, in this order). `need`: a
    // run unlock (G.unlocked) or a Force Tree card (player.skills), any of them. cd: seconds between, before the
    // CONTROL branch's cut
    powerList: [
      { id: 'push', need: ['push'], cd: 8, nm: 'PUSH' },
      { id: 'pull', need: ['pull'], cd: 10, nm: 'PULL' },
      { id: 'throw', need: ['throw'], cd: 9, nm: 'SABER THROW' },
      { id: 'mend', need: ['mend', 'vamp'], cd: 18, nm: 'MEND' },
      { id: 'repulse', need: ['repulse', 'slam'], cd: 14, nm: 'REPULSE' },
    ],
    // THE TREE: each point the run has trained on a Force Tree branch (data/profile.js BRANCH) gives this
    tree: { combat: { dmg: 0.05 }, sense: { deflect: 0.03, hp: 0.04 }, control: { cd: 0.06 } },
    // THE FORM: the form you hold (G.stance) shapes how they fight: by its tag (data/forms.js)
    forms: { FAST: { every: 0.82 }, FLURRY: { every: 0.8 }, STRONG: { dmg: 1.2, every: 1.08 }, FURY: { dmg: 1.18 },
             DEFENCE: { deflect: 0.15 }, REDIRECT: { deflect: 0.12 }, DUELS: { dmg: 1.1 }, CROWDS: { reach: 0.4 },
             SWEEPS: { reach: 0.5 }, BALANCED: { dmg: 1.05, every: 0.95 }, CONTROL: { deflect: 0.08, dmg: 1.06 } },
  },
  mando: {
    name: 'RIN', title: 'FOUNDLING', kicker: 'YOUR FOUNDLING', post: 'covert',
    meet: { chapter: 'refuge' }, meetLock: 'Clear the refuge in the campaign',
    take: 'TAKE RIN IN', takeLine: 'Rin comes along in solo play, in one of your squad\'s places, and grows from spotter to fighter',
    blurb: 'Rin, one of the ten foundlings you got off the dead ship. Rin stayed in line. Rin wants a helmet more than anything.',
    cap: [1, 2, 3, 3],   // by your clan rank: Foundling, Verd, Alor, Mand'alor
    stages: [
      { nm: 'SPOTTER', xp: 0, line: 'Rin carries a carbine they aren\'t allowed to fire yet, and calls out the foe nearest you. Hit the marked one: it takes more.',
        look: { scale: 0.7, color: 0x8a8f96 },
        role: { hp: 90, speed: 6.6, dmg: 0, range: 26, every: [9, 9], spread: 0, burst: 1, burstGap: 0, boltSpeed: 30, noFire: true }, spot: { every: 6, for: 5, mul: 1.2 } },
      { nm: 'SPOTTER · CARBINE', xp: 60, line: 'The Armorer says Rin can fire the carbine now. Rin still calls the targets.',
        look: { scale: 0.8, color: 0x7c8a96 },
        role: { hp: 110, speed: 6.4, dmg: 5, range: 18, every: [1.4, 2.0], spread: 0.05, burst: 1, burstGap: 0, boltSpeed: 30 }, spot: { every: 8, for: 5, mul: 1.2 } },
      { nm: 'FIGHTER', xp: 220, line: 'Rin wears a real helmet now. Not a bucket with eye holes. A real one.',
        look: { scale: 0.9, color: 0x6a8aa0 },
        role: { hp: 130, speed: 6.2, dmg: 9, range: 20, every: [1.4, 2.1], spread: 0.04, burst: 1, burstGap: 0, boltSpeed: 32 }, spot: { every: 8, for: 6, mul: 1.22 } },
      { nm: 'WARRIOR OF THE CLAN', xp: 500, line: 'Rin is verd now: a warrior of the clan, in beskar of their own. This is the Way.',
        look: { scale: 1.0, color: 0x9aa4b0 },
        role: { hp: 150, speed: 6.2, dmg: 12, range: 22, every: [1.3, 1.9], spread: 0.035, burst: 1, burstGap: 0, boltSpeed: 34 }, spot: { every: 7, for: 6, mul: 1.25 } },
    ],
    model: 'mandalorian', eye: 0xffa040, cloth: 0x2e5a6a,
  },
  trooper: {
    name: null, title: 'SECOND', kicker: 'YOUR SECOND', post: 'kamino',
    meet: { rank: 1 }, meetLock: 'Make Sergeant (the Jedha line, in the campaign)',
    take: 'PROMOTE', takeLine: 'Your second hits harder, takes more, and holds the squad together when you are down. Solo play only',
    blurb: 'Pick one of the fire team to be your second: the one who takes the squad when you are down.',
    cap: [0, 1, 2, 2, 3, 3, 3],   // by your service rank: Trooper, Sergeant, Lieutenant, Captain, Commander, ARC, Marshal
    // who can be picked (data/allies.js SQUAD.roster.trooper, by name)
    // (not PATCH: the medic comes with the FIELD MEDIC pick, data/trooper-progression.js)
    pick: ['SGT. VANT', 'BRISK', 'HAMMER', 'TALLY'],
    stages: [
      { nm: 'CORPORAL', xp: 0, line: 'Your second wears a corporal\'s stripe. The squad already listens.',
        lead: { hp: 1.2, dmg: 1.15, rally: 1.2, bleed: 0.35, revive: 1.3 } },
      { nm: 'SERGEANT', xp: 60, line: 'Your second makes sergeant. When you drop, the squad doesn\'t.',
        lead: { hp: 1.3, dmg: 1.25, rally: 1.3, bleed: 0.5, revive: 1.5 } },
      { nm: 'SERGEANT MAJOR', xp: 220, line: 'Sergeant major. They could run this squad without you. They\'d rather not.',
        lead: { hp: 1.4, dmg: 1.35, rally: 1.4, bleed: 0.65, revive: 1.7 } },
      { nm: 'LIEUTENANT', xp: 500, line: 'A lieutenant\'s bars. Your second chance in every fight, and an extra one each wave.',
        lead: { hp: 1.5, dmg: 1.45, rally: 1.5, bleed: 0.8, revive: 2.0, revives: 1 } },
    ],
  },
};

// where each hub keeps its apprentice (data/hub.js adds the station): the wing, the spot, and which way they face
export const APPRENTICE_POST = {
  temple: { wing: 'training', x: 12, z: -14, face: [-6, -18] },
  covert: { wing: 'pit', x: 12, z: -14, face: [-4, -22] },
  kamino: { wing: 'range', x: 12, z: -14, face: [-6, -18] },
};

// WHAT THEY SAY when you walk up (game/talk.js, data/talk.js): by stage, and once they lean (the Padawan) by your lean
export const APPRENTICE_TALK = {
  jedi: [
    ['Master Vael says I hold the practice blade like a broom. I think brooms are underrated.', 'Is it true the Ledger had my name in it before I could walk?',
     'I counted the steps from my cell to the gate. Forty one. I don\'t count them any more.'],
    ['I pushed a stormtrooper today. On purpose. He fell over. Sorry. Not sorry.', 'My braid is uneven. Ilsa\'s was uneven too, they say. I don\'t know who Ilsa is.',
     'You hold your form like it\'s easy. Teach me the hard part.'],
    ['My blade hums a little lower than yours. I like it that way.', 'I built it in the forge. It took four tries. Don\'t tell anyone about the first three.',
     'When you fight, I watch your feet. Everyone else watches the blade.'],
    ['Knight Tavi. It doesn\'t sound real yet.', 'I\'ll go where you go. That was the deal from the first day.', 'Someday there will be a child in a cell, and I\'ll be the one who walks in.'],
  ],
  jediLean: {
    light: ['Every one we spare is one more who might come home. You taught me that.', 'My blade went green. Master Vael smiled. He doesn\'t smile.'],
    dark: ['You\'re angry all the time now. I can feel it. Am I supposed to be angry too?', 'My blade burns orange. It hums louder when you\'re near.'],
  },
  mando: [
    ['I can see six of them. Seven. I\'m not allowed to shoot any of them.', 'The Armorer says spotters win fights. I think shooters win fights.', 'Rook used to call targets. I\'m better. Don\'t tell Rook.'],
    ['I hit one! Well. Near one. Near is a start.', 'The carbine kicks. I kick back.', 'I still call them. Look where I point.'],
    ['It\'s a real helmet. I sleep in it.', 'You fight like the old stories. I\'m going to fight like you.', 'Left side is mine. I always cover the left. Tev taught me.'],
    ['This is the Way.', 'Verd. A warrior of the clan. Took me long enough.', 'One day I\'ll find a foundling of my own. I\'ll be the one who comes back for them.'],
  ],
  trooper: [
    ['A stripe. On me. Brisk is going to be unbearable.', 'You go down, I take the squad. Just don\'t go down, Captain.'],
    ['Sergeant. Vant says welcome to the headaches.', 'When you drop, they look at me now. I don\'t let them see I\'m scared.'],
    ['Sergeant major. Never thought I\'d outrank the coffee.', 'I\'ve got the squad. I\'ve always got the squad.'],
    ['Lieutenant. Same job, nicer bars.', 'If it comes to it, I get them out. You taught me that. Don\'t make me use it.'],
  ],
};
