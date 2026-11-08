// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// WHAT LIVES IN THE RUINS OF THE SITH GATE (data/zones.js has the ruins themselves): the Hollow Choir's patrols, the
// people of General Kast's camp who need a hand, the moments that test which way you lean, and the secrets hidden in the
// dead city. The fields are data/zone-jedha.js's (THREAT, QUESTS, MOMENTS, SECRETS: its header has the format), and the
// same game code runs them: game/zone-fights.js, game/zone-quests.js, game/secrets.js. Edit the words freely.
//
// Act IV's endgame: the Choir hits harder than Jedha's patrols ever did (tiers 4 to 7), and every patrol wears its robes
// (CHOIR_LOOK, the look data/missions-gate.js gives Act IV's foes).

// a giver's look (the hero model's parts and colours, as data/temple-folk.js has them): robe, tunic, skin, hair, and any parts
const robe = (robe, tunic, skin, hair, parts = {}) => ({ parts: { robe: 'outer', hair: 'short', ...parts }, palette: { skin, hair, robe, tabard: robe, tunic } });
// Kast's people: Republic olive and grey, no robe
const kast = (tunic, skin, hair, parts = {}) => robe(0x4a5040, tunic, skin, hair, { robe: 'none', ...parts });

// THE HOLLOW CHOIR: black robes over old armour, violet eyes (data/missions-gate.js CHOIR, kept in step by hand)
const CHOIR_TROOP = { model: 'storm', color: 0x26222c, eye: 0xb46bff, cloth: 0x3a1a3a };
export const CHOIR_LOOK = { blaster: CHOIR_TROOP, grenadier: CHOIR_TROOP, sniper: CHOIR_TROOP, officer: { ...CHOIR_TROOP, model: 'officer', cloth: 0x6a3a8a } };

export const RUINS_LIFE = {
  threat: {
    threshold: { tier: 0 },
    avenue:   { tier: 4, n: 4, foes: ['grunt', 'blaster', 'duelist', 'blaster'], rest: 45 },
    barrows:  { tier: 4, n: 4, foes: ['grunt', 'brute', 'blaster', 'grunt'], rest: 45 },
    mere:     { tier: 5, n: 4, foes: ['blaster', 'bomber', 'grunt', 'sniper'], rest: 45 },
    cloister: { tier: 5, n: 4, foes: ['duelist', 'blaster', 'officer', 'grunt'], rest: 42 },
    masks:    { tier: 5, n: 5, foes: ['acolyte', 'grunt', 'blaster', 'grunt', 'sniper'], rest: 42 },
    scar:     { tier: 6, n: 5, foes: ['brute', 'duelist', 'blaster', 'bomber', 'grunt'], rest: 40 },
    tomb:     { tier: 6, n: 5, foes: ['acolyte', 'duelist', 'blaster', 'grunt', 'lancer'], rest: 40 },
    bastion:  { tier: 7, n: 5, foes: ['blaster', 'officer', 'grenadier', 'phalanx', 'lancer'], rest: 35 },
  },
  cap: { low: 6, medium: 8, high: 9 },   // roaming foes standing at once, at most (a quest's foes come on top)

  quests: [
    { id: 'patrol', title: 'KAST\'S LOST PATROL', kicker: 'THE BARROW FIELD',
      giver: { name: 'A REPUBLIC SERGEANT', at: [-22, 75], face: -1.2, look: kast(0x8a8c7a, 0x8a5a3e, 0x1a120c, { beard: 'stubble' }) },
      ask: 'I sent four of mine into the barrows at first light. Their beacons are still pinging, but nobody answers. Bring the beacons back, and whoever is sitting on them, deal with it.',
      done: 'All four beacons. And the Choir that took them won\'t take anyone else. I\'ll write to their families tonight. Thank you.',
      steps: [
        { kind: 'take', at: [[-100, 58], [-62, 100], [-98, 97]], name: 'PATROL BEACON', verb: 'RECOVER THE BEACON', task: 'Recover the patrol\'s beacons in the barrows' },
        { kind: 'clear', at: [-80, 84], foes: ['grunt', 'blaster', 'duelist', 'blaster'], task: 'The Choir was waiting by the mounds. Beat them' },
        { kind: 'back', task: 'Back to the sergeant in Kast\'s camp' },
      ],
      reward: 'Rank XP · counts as a side mission' },
    { id: 'hymn', title: 'THE HYMN STONES', kicker: 'THE CHOIR\'S CLOISTER',
      giver: { name: 'A CHOIR DESERTER', at: [-50, -11], face: -1.6, look: robe(0x2a2230, 0x5a3a6a, 0xc8a080, 0x1a1418, { head: 'hood' }) },
      ask: 'Three stones in the cloister still sing his name. I can hear them from here, even now. Break them. Please. I will not go back in there while they sing.',
      done: 'Quiet. For the first time in years, it is quiet in my head. Whatever you did with the last of it, thank you.',
      steps: [
        { kind: 'clear', at: [-84, 12], foes: ['duelist', 'blaster', 'officer', 'blaster'], task: 'Clear the choristers out of the cloister court' },
        { kind: 'take', at: [[-108, -18], [-80, 17], [-62, -32]], name: 'HYMN STONE', verb: 'SILENCE THE STONE', task: 'Silence the three hymn stones' },
        { kind: 'back', task: 'Back to the deserter on the Choir\'s Road' },
      ],
      choice: { title: 'THE LAST HYMN', lines: ['Under the last stone, a crystal recording: the whole hymn, every word the Choir sang to call Kharel back.', 'Kast\'s archivists would give a great deal to hear it. So would whoever comes after the Choir.'],
        options: [ { key: 'break', side: 'light', label: 'BREAK IT', line: 'It cracks in your hand. Nobody sings that hymn again.' },
                   { key: 'keep', side: 'dark', label: 'KEEP THE HYMN', line: 'You pocket it. Some nights you catch yourself humming it.' } ] },
      reward: 'Rank XP · counts as a side mission' },
    { id: 'cells', title: 'THE BASTION\'S CELLS', kicker: 'THE CHOIR\'S BASTION',
      giver: { name: 'A KAST SCOUT', at: [46, -28], face: -1.6, look: kast(0x6a6e64, 0xcfa282, 0x4a3220, { hair: 'long' }) },
      ask: 'The Choir is holding prisoners in the bastion: pilgrims from Jedha, taken through the gate before we sealed the stair. The cells lock from the yard. Get them open.',
      done: 'Eleven pilgrims, all walking. They\'re on their way to the gate now. I owe you, and so does Jedha.',
      steps: [
        { kind: 'go', at: [70, 0], r: 7, task: 'Get into the bastion yard' },
        { kind: 'clear', at: [96, -6], foes: ['blaster', 'officer', 'grenadier', 'phalanx'], task: 'Beat the warden\'s guard in the yard' },
        { kind: 'take', at: [[100, -9.5], [66, 13]], name: 'CELL LOCK', verb: 'OPEN THE CELLS', task: 'Open both cell blocks' },
        { kind: 'back', task: 'Back to the scout outside the bastion' },
      ],
      choice: { title: 'THE WARDEN', lines: ['The Choir\'s warden kneels in the yard with her mask off: an old woman, Jedha-born, a pilgrim herself once.', 'She says the hymn found her in her sleep, the way it found all of them. The pilgrims she locked up are watching you.'],
        options: [ { key: 'spare', side: 'light', label: 'LET HER GO', line: 'You send her to the gate with the rest. Kast can decide what she is owed.' },
                   { key: 'end', side: 'dark', label: 'NO MERCY FOR THE CHOIR', line: 'The pilgrims do not look back as they leave the yard.' } ] },
      reward: 'Rank XP · counts as a side mission' },
    { id: 'shard', title: 'THE BLEEDING SHARD', kicker: 'THE BLEEDING SCAR',
      giver: { name: 'KAST\'S ARCHIVIST', at: [-10, -55], face: 3.1, look: robe(0x6a6458, 0xd8d0c0, 0xe2bea0, 0x8a8478, { hair: 'topknot' }) },
      ask: 'The Choir dug for crystal in the scar, and what they found had been lying beside his tomb for a thousand years. It turned red down there. Bring me the heart of it before they do.',
      done: 'There it is. Still warm. It sat in the dark beside him all that time, listening. What happens to it now is up to you.',
      steps: [
        { kind: 'go', at: [-84, -98], r: 8, task: 'Go to the quarry mouth in the scar' },
        { kind: 'clear', at: [-84, -100], foes: ['acolyte', 'brute', 'grunt', 'grunt'], task: 'The Choir\'s diggers got there first. Beat them' },
        { kind: 'take', at: [[-84, -106]], name: 'BLEEDING SHARD', verb: 'TAKE THE SHARD', task: 'Take the red crystal' },
        { kind: 'back', task: 'Back to the archivist on the tomb steps' },
      ],
      choice: { title: 'THE BLEEDING SHARD', lines: ['A kyber crystal the size of a fist, bled red by a thousand years of his hate. It hums against your palm.', 'Held long enough, a crystal can heal. Or it can stay exactly as angry as it is.'],
        options: [ { key: 'heal', side: 'light', label: 'HEAL IT', line: 'You hold it all night. By dawn it has gone quiet, and white.' },
                   { key: 'red', side: 'dark', label: 'KEEP IT RED', line: 'You pocket it as it is. It is warm all the way back to the gate.' } ] },
      reward: 'Rank XP · counts as a side mission' },
    // MOMENTS: no steps, only a choice
    { id: 'idol', title: 'THE STATUE\'S EYES', kicker: 'THE AVENUE OF THE UNBURIED', moment: true,
      giver: { name: 'A REPUBLIC TROOPER', at: [22, 30], face: 0.8, look: kast(0x8a8c7a, 0xb88a6a, 0x2a1a10, { beard: 'stubble' }) },
      ask: 'Solid gold under the soot. Nobody\'s going to miss one statue\'s eyes. Want half?',
      choice: { title: 'THE STATUE\'S EYES', lines: ['One of Kast\'s troopers is prising the gold eyes out of a statue of Kharel.', 'The statue is humming, very softly. He doesn\'t seem to hear it.'],
        options: [ { key: 'leave', side: 'light', label: 'LEAVE THEM BE', line: 'You send him back to camp. Some things are better left buried, gold and all.' },
                   { key: 'split', side: 'dark', label: 'TAKE YOUR HALF', line: 'One eye each. Yours is cold in your pocket, and it keeps looking.' } ] } },
    { id: 'mask', title: 'THE UNMASKED', kicker: 'THE FIELD OF MASKS', moment: true,
      giver: { name: 'A YOUNG CHORISTER', at: [58, -70], face: 2.4, look: robe(0x2a2230, 0x4a3a52, 0xe2bea0, 0x6a4a2c, { hair: 'short' }) },
      ask: 'Please. I took the mask off. I don\'t hear him any more. Don\'t leave me here with them.',
      choice: { title: 'THE UNMASKED', lines: ['A Choir initiate, barely grown, hiding among the masks of the dead. The patrols will find him by nightfall.', 'He says he never hurt anyone. He might even be telling the truth.'],
        options: [ { key: 'out', side: 'light', label: 'GET HIM OUT', line: 'You walk him to the gate. Kast\'s people take him through to Jedha, and home.' },
                   { key: 'leave', side: 'dark', label: 'LEAVE HIM TO THE DEAD', line: 'You walk on. Behind you, very quietly, he starts to hum.' } ] } },
  ],

  secrets: [
    { id: 'holo-barrow', kind: 'holocron', at: [-104, 104], page: 'holo-warden' },
    { id: 'holo-cloister', kind: 'holocron', at: [-108, 28], page: 'holo-hymnal' },
    { id: 'holo-tomb', kind: 'holocron', at: [-22, -104], page: 'holo-burial' },
    { id: 'cave-scar', kind: 'cave', at: [-96, -102] },
    { id: 'cave-mere', kind: 'cave', at: [100, 92] },
    { id: 'cave-quarry', kind: 'cave', at: [-104, -62] },
    { id: 'med-tomb', kind: 'meditate', at: [0, -79] },
    { id: 'med-masks', kind: 'meditate', at: [84, -86] },
    { id: 'med-camp', kind: 'meditate', at: [-17, 98] },
  ],
};
