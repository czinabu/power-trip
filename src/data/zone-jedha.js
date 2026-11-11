// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// WHAT LIVES IN THE OLD CITY OF JEDHA (data/zones.js has the city itself): its patrols, the people who ask for help, the
// moments that test which way you lean, and the secrets hidden in its corners. game/zone-fights.js sends the patrols,
// game/zone-quests.js runs the asks and the moments, game/secrets.js places the secrets. Edit the words freely.
//
// THREAT, by district: { tier (how tough its foes are: a wave's worth, 0 = no patrols), n (a patrol's size), foes (the
//   types it's drawn from, in turn), rest (s before another comes once one is beaten) }
// QUESTS: { id, title, kicker, giver: { name, at: [x, z], face, look }, ask (what they say), done (their thanks), steps,
//   choice (optional, asked once the last step is done: light or dark, data/alignment.js), reward (a short line) }.
//   Each one done counts as a side mission won (game/profile.js noteSideWon), once per hero. One runs at a time.
//   A step is one of
//     go     { at, r, task }               walk there
//     take   { at: [[x, z]…], name, task } tap F at each (a lamp to light, a box to carry): every one of them
//     clear  { at, foes, task }            the foes are there as you come near: beat every one
//     back   { task }                      go back to whoever asked
//     chase  { route: [[x, z]…], gates: [{ at, style, w }…], quarry: { name, foe }, gateLine, task }   run them down
//            (game/zone-chase.js): each gate shuts behind them, a styled lock (seal, sky, line); the next step, if a
//            `clear`, is fought where they're caught
//   A MOMENT is a quest with no steps: walk up, tap F, and its choice is asked there and then (once per hero).
// SECRETS: the holocrons, crystal caves and meditation spots, set by hand (a map without `spots` has its found for it):
//   { id, kind, at: [x, z], page (a holocron's page: data/secrets.js HOLOCRONS) }. Each stands on the nearest open ground.

// a giver's look (the hero model's parts and colours, as data/temple-folk.js has them): robe, tunic, skin, hair, and any parts
const robe = (robe, tunic, skin, hair, parts = {}) => ({ parts: { robe: 'outer', hair: 'short', ...parts }, palette: { skin, hair, robe, tabard: robe, tunic } });

export const JEDHA_LIFE = {
  threat: {
    gate:     { tier: 0 },
    square:   { tier: 1, n: 3, foes: ['grunt', 'blaster', 'grunt'], rest: 50 },
    bazaar:   { tier: 1, n: 3, foes: ['blaster', 'grunt', 'officer'], rest: 50 },
    silent:   { tier: 2, n: 4, foes: ['grunt', 'blaster', 'brute', 'grunt'], rest: 45 },
    cistern:  { tier: 2, n: 4, foes: ['blaster', 'grunt', 'bomber', 'blaster'], rest: 45 },
    temple:   { tier: 3, n: 4, foes: ['duelist', 'grunt', 'blaster', 'grunt'], rest: 45 },
    workings: { tier: 3, n: 5, foes: ['brute', 'grunt', 'blaster', 'bomber', 'grunt'], rest: 40 },
    shrines:  { tier: 3, n: 4, foes: ['duelist', 'blaster', 'grunt', 'sniper'], rest: 45 },
    garrison: { tier: 4, n: 5, foes: ['blaster', 'officer', 'grenadier', 'phalanx', 'blaster'], rest: 35 },
  },
  cap: { low: 6, medium: 8, high: 9 },   // roaming foes standing at once, at most (a quest's foes come on top)

  quests: [
    { id: 'lamps', title: 'THE SILENT LAMPS', kicker: 'THE SILENT QUARTER',
      giver: { name: 'AN OLD PILGRIM', at: [-73, 72], face: 0.6, look: robe(0x8c7656, 0xd8c8a8, 0xb88a6a, 0xd8d4cc, { head: 'hood', beard: 'full' }) },
      ask: 'Every pilgrim who never went home has a lamp in this quarter. Nobody has lit them since the occupation came. Light them for me, would you? My knees are not what they were.',
      done: 'You see them? All lit. They will burn for a week. Thank you, traveller.',
      steps: [
        { kind: 'take', at: [[-100, 58], [-58, 102], [-98, 104]], name: 'PILGRIM LAMP', verb: 'LIGHT THE LAMP', task: 'Light the pilgrims\' lamps' },
        { kind: 'clear', at: [-80, 88], foes: ['grunt', 'blaster', 'grunt', 'blaster'], task: 'Scavengers came to see who lit them. Drive them off' },
        { kind: 'back', task: 'Back to the old pilgrim by the fountain' },
      ],
      reward: 'Rank XP · counts as a side mission' },
    { id: 'strongbox', title: 'THE TRADER\'S STRONGBOX', kicker: 'THE LOWER BAZAAR',
      giver: { name: 'A SPICE TRADER', at: [-64, -4], face: -1.4, look: robe(0x6a3a2a, 0xc9a070, 0x82604a, 0x120c08, { hair: 'long' }) },
      ask: 'A patrol came through at dawn and took my strongbox for "inspection". They are still at the old well, counting what is not theirs. Get it back and I will not forget it.',
      done: 'Every coin of it. You have a friend in the bazaar now.',
      steps: [
        { kind: 'clear', at: [-98, 16], foes: ['blaster', 'grunt', 'officer', 'grunt'], task: 'Take the strongbox back from the patrol' },
        { kind: 'take', at: [[-98, 16]], name: 'STRONGBOX', verb: 'PICK UP THE STRONGBOX', task: 'Pick up the strongbox' },
        { kind: 'back', task: 'Back to the spice trader' },
      ],
      choice: { title: 'WHAT\'S IN THE BOX', lines: ['Under the coins, wrapped in cloth: kyber shards, a dozen of them, prised out of the temple\'s walls.', 'She sells them to whoever pays. Some of the buyers wear white armour.'],
        options: [ { key: 'temple', side: 'light', label: 'THE SHARDS GO BACK', line: 'You keep the shards and leave them on the temple steps. She keeps the coins, and a lesson.' },
                   { key: 'sell', side: 'dark', label: 'NOT YOUR BUSINESS', line: 'You hand it all back. What she sells, and to whom, is her affair.' } ] },
      reward: 'Rank XP · counts as a side mission' },
    { id: 'deserter', title: 'THE DESERTER\'S CODES', kicker: 'THE GARRISON',
      giver: { name: 'A DESERTER', at: [46, -28], face: -1.6, look: robe(0x5a5f66, 0xc8ccd2, 0xcfa282, 0x4a3220, { robe: 'none', beard: 'stubble' }) },
      ask: 'I walked out of that compound with nothing but this uniform. The transit codes are still in the command block. With them, a dozen families get off this rock tonight. I cannot go back in. You can.',
      done: 'That is all of them. The shuttle leaves at dusk. I owe you more than I can say.',
      steps: [
        { kind: 'go', at: [70, 0], r: 7, task: 'Get into the garrison yard' },
        { kind: 'clear', at: [96, -6], foes: ['blaster', 'officer', 'blaster', 'grenadier'], task: 'Clear the guard on the command block' },
        { kind: 'take', at: [[100, -9.5]], name: 'TRANSIT CODES', verb: 'TAKE THE CODES', task: 'Take the transit codes from the command block' },
        { kind: 'back', task: 'Back to the deserter in the alley' },
      ],
      choice: { title: 'HIS OLD SERGEANT', lines: ['The deserter\'s old sergeant was on the command block. He is pinned under a fallen crate, alive, and he has seen your face.', 'If he talks, the patrols will be waiting at the shuttle.'],
        options: [ { key: 'spare', side: 'light', label: 'LEAVE HIM BREATHING', line: 'You free him and send him off without his rifle. The families take their chances.' },
                   { key: 'silence', side: 'dark', label: 'MAKE SURE HE DOESN\'T TALK', line: 'Nobody will be waiting at the shuttle.' } ] },
      reward: 'Rank XP · counts as a side mission' },
    { id: 'kyberheart', title: 'WHAT SLEEPS IN THE WORKINGS', kicker: 'THE KYBER WORKINGS',
      giver: { name: 'A TEMPLE ACOLYTE', at: [-10, -55], face: 3.1, look: robe(0xd8c8a8, 0xe6e2d8, 0xe2bea0, 0x2a2018, { hair: 'topknot' }) },
      ask: 'Something woke in the old catacombs last night. The miners ran. Whatever is down there glows, and the Empire\'s diggers will be there by morning. Please, reach it first.',
      done: 'The heart of the workings. It was here before the city, and now it has a choice to make. So do you.',
      steps: [
        { kind: 'go', at: [-84, -98], r: 8, task: 'Go to the catacomb mouth in the workings' },
        { kind: 'clear', at: [-84, -100], foes: ['duelist', 'brute', 'grunt', 'grunt'], task: 'The diggers got there first. Beat them' },
        { kind: 'take', at: [[-84, -106]], name: 'KYBER HEART', verb: 'TAKE THE KYBER HEART', task: 'Take the glowing crystal' },
        { kind: 'back', task: 'Back to the acolyte on the temple steps' },
      ],
      choice: { title: 'THE KYBER HEART', lines: ['A crystal the size of a fist, warm, singing faintly. The acolyte would seal it in the temple.', 'Held in your hand, it makes the Force feel very close. And very loud.'],
        options: [ { key: 'seal', side: 'light', label: 'SEAL IT IN THE TEMPLE', line: 'It goes under the dome with the others, where it can sleep again.' },
                   { key: 'keep', side: 'dark', label: 'KEEP ITS POWER', line: 'You pocket it. The song follows you all the way to the shuttle.' } ] },
      reward: 'Rank XP · counts as a side mission' },
    // A CHASE: the courier bolts from the gate, down the Pilgrim Way, across the square and west into the bazaar, then
    // south through the back lanes, shutting a gate behind him in each district
    { id: 'courier', title: 'THE COURIER', kicker: 'THE PILGRIM GATE',
      giver: { name: 'A GATE WARDEN', at: [12, 74], face: -1.6, look: robe(0x5a4a3a, 0xb8a888, 0xa87c5e, 0x2a2018, { beard: 'stubble' }) },
      ask: 'That man in the grey coat is carrying the names of every family hiding a Jedi in this city. He is running them to the garrison. Stop him before he gets there!',
      done: 'The names are ash. Nobody knocks on those doors tonight. Thank you.',
      steps: [
        { kind: 'chase', task: 'Run down the courier',
          route: [[4, 66], [0, 52], [0, 26], [-24, 0], [-40, 0], [-40, -40], [-8, -40], [0, -50]],
          gates: [ { at: [-33, 0], style: 'seal', w: 13 }, { at: [-40, -22], style: 'sky', w: 7 }, { at: [-22, -40], style: 'line', w: 7 } ],
          quarry: { name: 'THE COURIER', foe: 'officer' },
          gateLine: { seal: 'A blast door, sealed behind him. A Jedi tears it open twice as fast.',
                      sky: 'Crates piled across the lane. Work the winch on top: fly, jump or climb.',
                      line: 'A checkpoint\'s shield gate. The trooper and his squad hold it open fastest.' } },
        { kind: 'clear', at: [0, -50], foes: ['officer', 'blaster', 'grunt', 'blaster'], task: 'He called his escort. Beat them and take the names' },
        { kind: 'back', task: 'Back to the gate warden' },
      ],
      reward: 'Rank XP · counts as a side mission' },
    // MOMENTS: no steps, only a choice
    { id: 'informer', title: 'THE INFORMER', kicker: 'THE PILLAR SQUARE', moment: true,
      giver: { name: 'AN INFORMER', at: [22, 30], face: 2.2, look: robe(0x3a3a3a, 0x6a6a6a, 0xb88a6a, 0x120c08, { head: 'hood' }) },
      ask: 'Please. They say I sold pilgrims to the patrols. I had children to feed. They will kill me.',
      choice: { title: 'THE INFORMER', lines: ['A crowd of pilgrims has the man backed against a pillar. Some of them have stones.', 'He did sell them. Two families never came home.'],
        options: [ { key: 'stop', side: 'light', label: 'STOP THE CROWD', line: 'You stand between them. He leaves the city tonight, and does not come back.' },
                   { key: 'step', side: 'dark', label: 'STEP ASIDE', line: 'You walk on. Behind you the square goes quiet.' } ] } },
    { id: 'looter', title: 'THE LOOTER', kicker: 'THE DROWNED CISTERN', moment: true,
      giver: { name: 'A LOOTER', at: [56, 66], face: -2.4, look: robe(0x4a3a2a, 0x8c7656, 0x9c7a62, 0x6a4a2c) },
      ask: 'It is just a stone in a wall, friend. Nobody prays here any more.',
      choice: { title: 'THE SHRINE STONE', lines: ['He is prising a kyber shard out of a pilgrim\'s shrine by the water stair.', 'It would fetch a month\'s food in the bazaar. Or it could stay where somebody left it.'],
        options: [ { key: 'stop', side: 'light', label: 'PUT IT BACK', line: 'He grumbles and goes. The shard stays where its pilgrim left it.' },
                   { key: 'take', side: 'dark', label: 'TAKE IT FROM HIM', line: 'A better use for it than his. You pocket it and send him off.' } ] } },
  ],

  secrets: [
    { id: 'holo-gate', kind: 'holocron', at: [-100, 100], page: 'holo-pilgrim' },
    { id: 'holo-guild', kind: 'holocron', at: [108, 28], page: 'holo-guildhall' },
    { id: 'holo-court', kind: 'holocron', at: [-22, -104], page: 'holo-firstlight' },
    { id: 'cave-mouth', kind: 'cave', at: [-96, -102] },
    { id: 'cave-stair', kind: 'cave', at: [100, 92] },
    { id: 'cave-quarry', kind: 'cave', at: [-104, -62] },
    { id: 'med-temple', kind: 'meditate', at: [0, -79] },
    { id: 'med-stones', kind: 'meditate', at: [84, -86] },
    { id: 'med-well', kind: 'meditate', at: [-16, 98] },
  ],
};
