// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// YOUR HERO'S PROFILE, as data (game/profile.js keeps it, ui/profile-ui.js shows it). Edit the words and numbers freely.
//
// Each hero has one persistent profile on this device: it is not part of a save slot and NEW GAME leaves it, so who you
// became outlives any one run. It holds a RANK on the hero's own ladder, the RANK XP that climbs it, and (the Jedi) the
// FORCE TREE picks made with Insight.
//
// THE GUARDRAIL: a rank opens BREADTH, never raw numbers. What it unlocks is more choice on the run's own upgrade page
// (extra skill cards at the same one-point price as the rest, so a run is never stronger for having them, only
// different) and, later, looks and parts. Force Level, the cost floor and the skill-point budget still cap every number,
// so every mode stays tuned around a fresh run, and a ranked hero and a fresh one stand level in co-op.
//
//   TRACKS   each hero's ladder. A rank asks for `xp` (total rank XP) and, optionally, `trials` (all three trial chapters
//            cleared, in any run), `won` (the hero's campaign beaten) or `chapter` (that chapter cleared: the trooper's
//            promotions, which the campaign already hands out, game/wardrobe.js PROMOTIONS). `insight` (the Jedi) is how
//            many Force Tree picks each rank brings.
//   RANK_XP  what each thing the game already counts is worth. Only real fights pay: training and the sandbox never do.
//   JEDI_TREE the Force Tree's own nodes, by branch and tier (the run's PADAWAN / KNIGHT / MASTER tiers, data/skills.js).
//            A node is learned once with Insight and from then on is one more card the run's upgrade page can deal. A tier's
//            nodes wait for the rank of the same name.
//   BRANCH   where each of the run's own skill cards (data/skills.js SKILLS) sits on the tree, and FORK_BRANCH the store's
//            fork picks (data/store.js), shown on the tree with the side you took last.
//   RANK_SKILLS the Mando's and the trooper's lighter track: each rank simply opens its card, no tree to fill in.

import { player } from '../state.js';

export const TRIALS = ['trial-first', 'trial-acrobat', 'trial-knight'];

export const RANK_XP = {
  chapter: 100,       // a chapter cleared the first time (per hero)
  trial: 200,         // ...a trial chapter, the first time
  replay: 25,         // any chapter cleared again (a new run, a co-op run through it)
  mission: 80,        // a story mission won from the Missions page, the first time
  missionAgain: 25,
  arcade: 40,         // an arcade contract won
  won: 500,           // the hero's campaign beaten, the first time
  wonAgain: 150,
  form: 40,           // a form mastery rank earned (ADEPT, EXPERT, MASTER)
  power: 20,          // a power mastery rank earned
  duel: 15,           // a guarding duellist beaten
  wave: 10,           // a survival wave cleared
};

export const TRACKS = {
  jedi: {
    name: 'THE ORDER', unit: 'RANK XP',
    ranks: [
      { id: 'padawan', nm: 'PADAWAN', line: 'Vael\'s student. Every Jedi starts here.' },
      { id: 'knight', nm: 'KNIGHT', xp: 100, line: 'Vael\'s Knight. Clear your first chapter.' },
      { id: 'master', nm: 'MASTER', xp: 1500, trials: true, line: 'Pass the three masters\' trials: the Wall, the Acrobat and the Knight.' },
      { id: 'grandmaster', nm: 'GRAND MASTER', xp: 5000, won: true, line: 'Lead what is left of the Order. Beat the campaign, then keep going.' },
    ],
    insight: [1, 1, 1, 1],
  },
  mando: {
    name: 'THE CLAN', unit: 'CLAN STANDING',
    ranks: [
      { id: 'foundling', nm: 'FOUNDLING', line: 'Taken in by the covert. The Way starts here.' },
      { id: 'verd', nm: 'VERD', xp: 100, line: 'A warrior of the clan. Clear your first chapter.' },
      { id: 'alor', nm: 'ALOR', xp: 1500, trials: true, line: 'Beat the clan\'s three champions and lead them.' },
      { id: 'mandalor', nm: 'MAND\'ALOR', xp: 5000, won: true, line: 'The clans follow you. Beat the campaign, then keep going.' },
    ],
  },
  trooper: {
    name: 'THE GRAND ARMY', unit: 'SERVICE XP',
    ranks: [
      { id: 'trooper', nm: 'TROOPER', line: 'Fresh off Kamino. Every clone starts here.' },
      { id: 'sergeant', nm: 'SERGEANT', chapter: 'siege', line: 'Earned on the Jedha line.' },
      { id: 'lieutenant', nm: 'LIEUTENANT', chapter: 'refuge', line: 'Earned getting everyone off a dead ship.' },
      { id: 'captain', nm: 'CAPTAIN', chapter: 'trial-first', line: 'The Captain\'s own commission.' },
      { id: 'commander', nm: 'COMMANDER', chapter: 'trial-knight', line: 'General Kast\'s commission, on Hoth.' },
      { id: 'arc', nm: 'ARC COMMANDER', chapter: 'mustafar', line: 'An ARC, in the Captain\'s old kit.' },
      { id: 'marshal', nm: 'MARSHAL COMMANDER', xp: 5000, won: true, line: 'Command of what is left of the legion. Beat the campaign, then keep going.' },
    ],
  },
};

/* ---- THE FORCE TREE: three branches over the run's three tiers ---- */
export const BRANCHES = [
  { id: 'control', nm: 'CONTROL', line: 'The Force itself: deeper wells, cheaper powers.' },
  { id: 'sense', nm: 'SENSE', line: 'Reading the fight: parries, footwork, breath.' },
  { id: 'combat', nm: 'COMBAT', line: 'The blade: harder, faster, longer.' },
];
// the run's own skill cards (data/skills.js SKILLS), on the branch they belong to
export const BRANCH = {
  flow: 'control', rip: 'control', ascend: 'control',
  swift: 'sense', focus: 'sense', endure: 'sense', bulw: 'sense',
  vit: 'combat', edge: 'combat', jugg: 'combat', vamp: 'combat', storm: 'combat', unstop: 'combat',
};
// the store's forks (data/store.js `fork`; f7 is Form VII's, game/meditation.js), shown on their branch with your last pick
export const FORK_BRANCH = [
  { fork: 'j_arm', branch: 'combat', tier: 1, nm: 'SABER THROW or FORCE BARRIER', ids: ['throw', 'barrier'] },
  { fork: 'j_util', branch: 'sense', tier: 2, nm: 'JUMP ATTACK or FORCE MEND', ids: ['jslam', 'mend'] },
  { fork: 'j_ult', branch: 'control', tier: 3, nm: 'JUDGEMENT or REPULSE', ids: ['judge', 'repulse'] },
  { fork: 'f7', branch: 'combat', tier: 3, nm: 'JUYO or VAAPAD', ids: ['juyo', 'vaapad'] },
];


// each one is a card in the run's own shape (data/skills.js), with `prof` (its tree id) and `branch`. Budgets match the
// run's cards of the same tier (one point each): a sidegrade that leans another way, never a bigger number.
export const JEDI_TREE = [
  // ---- CONTROL ----
  { id: 'still', prof: 'still', branch: 'control', ico: '✦', nm: 'STILL WATERS', tier: 1, max: 3, ds: '+12% Force regen · +10% stamina regen',
    fl: 'A calm pool holds the deepest reflection.', apply(){ player.up.forceRegen *= 1.12; player.up.stamRegen *= 1.1; } },
  { id: 'reach', prof: 'reach', branch: 'control', ico: '⟳', nm: 'FORCE REACH', tier: 2, max: 2, ds: 'Force powers cost 8% less',
    fl: 'Ask less of the Force, and it gives more.', apply(){ player.up.abilityCostMul *= 0.92; } },
  { id: 'oneness', prof: 'oneness', branch: 'control', ico: '✺', nm: 'ONE WITH THE FORCE', tier: 3, max: 1, ds: '+40% Force regen · Force powers cost 15% less',
    fl: 'There is no you and the Force. There is only the Force.', apply(){ player.up.forceRegen *= 1.4; player.up.abilityCostMul *= 0.85; } },
  // ---- SENSE ----
  { id: 'foresight', prof: 'foresight', branch: 'sense', ico: '◈', nm: 'FORESIGHT', tier: 1, max: 2, ds: '+0.03s parry window · −10% dash cooldown',
    fl: 'See the blow before the arm that throws it.', apply(){ player.up.parry += 0.03; player.up.dashCdMult *= 0.9; } },
  { id: 'prescience', prof: 'prescience', branch: 'sense', ico: '❂', nm: 'PRESCIENCE', tier: 3, max: 1, ds: '+0.06s parry window · +25% stamina regen · −20% dash cooldown',
    fl: 'The fight has already happened. You are only remembering it.', apply(){ player.up.parry += 0.06; player.up.stamRegen *= 1.25; player.up.dashCdMult *= 0.8; } },
  // ---- COMBAT ----
  { id: 'flurry', prof: 'flurry', branch: 'combat', ico: '⚔', nm: 'FLURRY', tier: 2, max: 2, ds: '+10% attack speed · +5% saber damage',
    fl: 'Three cuts where they braced for one.', apply(){ player.up.atkSpeed *= 1.1; player.up.dmg *= 1.05; } },
];

// the Mando's and the trooper's lighter track: each rank opens one more card on the run's upgrade page
export const RANK_SKILLS = {
  mando: [
    { id: 'rangefinder', rank: 'verd', ico: '⌖', nm: 'RANGEFINDER', tier: 1, max: 2, ds: '+8% blaster damage · +6% move speed',
      fl: 'Know the distance before you close it.', apply(){ player.up.dmg *= 1.08; player.up.move *= 1.06; } },
    { id: 'tribe', rank: 'alor', ico: '⛊', nm: 'THE TRIBE PROVIDES', tier: 2, max: 2, ds: 'Gadgets cost 10% less · jetpack burns 10% less fuel',
      fl: 'What the clan forges, the clan shares.', apply(){ player.up.abilityCostMul *= 0.9; player.up.fuelEff = (player.up.fuelEff || 1) * 0.9; } },
    { id: 'theway', rank: 'mandalor', ico: '❂', nm: 'THIS IS THE WAY', tier: 3, max: 1, ds: 'Take 10% less damage · +15% weapon damage · +6% move speed',
      fl: 'This is the Way.', apply(){ player.up.dr = 1 - (1 - (player.up.dr || 0)) * 0.9; player.up.dmg *= 1.15; player.up.move *= 1.06; } },
  ],
  trooper: [
    { id: 'discipline', rank: 'captain', ico: '⁌', nm: 'FIRE DISCIPLINE', tier: 1, max: 2, ds: '−15% heat per shot · +5% blaster damage',
      fl: 'Three-round bursts. Every round counts.', apply(){ player.up.heatMul = (player.up.heatMul || 1) * 0.85; player.up.dmg *= 1.05; } },
    { id: 'tactics', rank: 'commander', ico: '⛨', nm: 'SQUAD TACTICS', tier: 2, max: 2, ds: 'Your squad hits 15% harder · you take 5% less',
      fl: 'Flank, suppress, push. They know the drill.', apply(){ player.up.squadDmg = (player.up.squadDmg || 1) * 1.15; player.up.dr = 1 - (1 - (player.up.dr || 0)) * 0.95; } },
    { id: 'doctrine', rank: 'arc', ico: '✸', nm: 'ARC DOCTRINE', tier: 3, max: 1, ds: '+20% ability energy regen · +25% grenade and charge damage · take 8% less',
      fl: 'Advanced Recon Commando. Every word of it.', apply(){ player.up.forceRegen *= 1.2; player.up.ordnance = (player.up.ordnance || 1) * 1.25; player.up.dr = 1 - (1 - (player.up.dr || 0)) * 0.92; } },
  ],
};

// YOUR DECK (the profile page, between runs): the cards the run's upgrade page deals from, chosen per hero from every card
// you own. Ten in all, so many from each tier. A deck that runs dry mid-run (every card in it trained to the top, or
// waiting on a tier) is topped up from the rest, so a hand is never short. No deck set: it deals from everything.
export const DECK_QUOTA = { 1: 4, 2: 3, 3: 3 };
export const DECK_SIZE = DECK_QUOTA[1] + DECK_QUOTA[2] + DECK_QUOTA[3];

// how each rank-up reads on its card at a chapter's close (kicker, then the lines)
export const RANK_CARD = {
  jedi: { kicker: 'RAISED IN THE ORDER', lines: {
    knight: ['Vael has stopped calling you his student. You are a Knight of the Order.'],
    master: ['Three masters have tested you, and three have stepped aside. The Council would have named you Master. There is no Council, so Vael does.'],
    grandmaster: ['What is left of the Order looks to you now. Grand Master.'] } },
  mando: { kicker: 'THE CLAN STANDS WITH YOU', lines: {
    verd: ['The Armorer marks your plates. You are verd now: a warrior of the clan.'],
    alor: ['Kael, Skye and Brakka have each faced you, and each of them follows you now. Alor: you lead the clan.'],
    mandalor: ['Every clan on the road to Exegol knows your helmet. Mand\'alor.'] } },
  trooper: { kicker: 'SERVICE RECORD', lines: {
    marshal: ['What is left of the legion answers to you. Marshal Commander.'] } },
};
