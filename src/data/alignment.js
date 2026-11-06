// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIGHT AND DARK, as data (game/alignment.js keeps the meter, ui/profile-ui.js shows it). Edit the words and numbers freely.
//
// Each hero's profile (game/profile.js) holds one ALIGNMENT, from -100 (all the way to the dark) to +100 (all the way to
// the light), starting at 0. What moves it:
//   CHOICES   the story's choices (data/campaign-jedi.js JEDI_CHOICES, data/campaign-trooper.js TROOPER_CHOICES), each
//             time a run makes one, and the side missions' own choices (data/side-quests.js `choice`), the first time
//             only. In co-op each player's own pick moves their own meter; the host's pick decides the story.
//   MERCY     how you fight. A beaten duellist YIELDS (it throws its blade down and backs off), and so is any foe a
//             form has disarmed: tap F beside it to SPARE it (it leaves the fight, and counts as beaten), or strike it
//             down while it's helpless. Each visit to a fight moves the meter at most `cap` this way.
// Only real fights move it: training and the sandbox are practice (the same rule as rank XP).
//
// THE GUARDRAIL: light and dark are two STYLES, never two power levels. The two paths' cards (ALIGN_TREE) come in
// mirrored pairs with the same budget at every tier, and each is one more card on the run's upgrade page at the same
// one skill point (data/profile.js), so leaning either way opens breadth, never bigger numbers.

import { player } from '../state.js';

export const ALIGN = {
  max: 100,
  lean: 30,     // past this either way, you LEAN: the path's cards open, the cast notices, the eyes start to show it
  deep: 60,     // past this, you are DEEP in it: the look shows it fully
  crystal: 50,  // the path's own kyber crystal (data/saber-parts.js) is earned the first time you reach this
};

// what each story choice is worth, by choice id then answer (+ light, - dark)
export const CHOICE_WEIGHT = {
  ledger: { saved: 8, burned: -8 },       // carry out the children's only hope, or burn it so nobody can use it
  ilsa: { spared: 25, struck: -25 },
  vexis: { vael: 25, ended: -20 },
  marshal: { home: 20, ended: -15 },      // (the trooper's)
  gate: { sealed: 20, kept: -20 },        // (Act IV's: seal the Sith gate, or keep it open)
};
// a side mission's choice: its `light` answer and its `dark` answer
export const SIDE_WEIGHT = 12;

export const MERCY = {
  spare: 3, strike: -3,   // per foe
  cap: 15,                // the most one visit to a fight moves the meter, either way
  reach: 3.2,             // m: how close to stand to spare one
  yieldAt: 0.2,           // a duellist yields when a blow leaves it under this share of its health (once)
  yieldTime: 6,           // s it stays on its knees, unarmed, before it calls its blade back and fights on
  bow: 1.3,               // s a spared foe takes to bow out of the fight
};

// how the meter reads on each hero's profile: the ends' names, and a line for where you stand
export const ALIGN_WORDS = {
  jedi: { title: 'THE FORCE', light: 'LIGHT', dark: 'DARK', line: {
    deepLight: 'The light is in everything you do. The temple feels calmer when you walk in.',
    light: 'You lean to the light. Mercy comes easily to you.',
    mid: 'Balanced on the edge. Every choice from here pulls one way or the other.',
    dark: 'You lean to the dark. It is quick, and it answers when you call.',
    deepDark: 'The dark side is in your eyes now. Everyone can see it.' } },
  mando: { title: 'THE CREED', light: 'HONOUR', dark: 'RUTHLESS', line: {
    deepLight: 'Every clan on the road tells the same story: you keep your word, and you spare those who yield.',
    light: 'You fight with honour. The covert notices.',
    mid: 'The Way says nothing about mercy. So far, neither do you.',
    dark: 'You finish what you start, and you leave nobody behind to come after you.',
    deepDark: 'Even the hunters are scared of you now.' } },
  trooper: { title: 'THE SQUAD', light: 'MERCY', dark: 'RUTHLESS', line: {
    deepLight: 'You take prisoners, you bring people home, and the squad would follow you anywhere for it.',
    light: 'You are not the soldier they made you to be. The squad is glad.',
    mid: 'Orders or conscience? You have not decided yet.',
    dark: 'Clean, fast, no prisoners. The way Kamino taught you.',
    deepDark: 'The squad has stopped asking what you will do. They already know.' } },
};

/* THE TWO PATHS — the Jedi's light and dark cards, in mirrored pairs (same tier, same budget, a different way to fight).
   A card is open while you LEAN its way and hold its tier's rank (FOUNDATION for Padawan, DISCIPLINE for Knight,
   CAPSTONE for Master, as the Force Tree's own); it needs no Insight. Swing the other way and it closes again (your deck
   lets go of it), and the other side's opens. In a run it is a card like any other, for the usual one skill point.
   `costOf` cuts one Force power's cost (player/jedi/force.js); the cost floor still holds every power to half its base. */
const cut = (ids, k) => { player.up.costOf = { ...(player.up.costOf || {}) }; for (const id of ids) player.up.costOf[id] = (player.up.costOf[id] || 1) * k; };
export const LIGHT_POWERS = ['barrier', 'mend', 'repulse'];
export const DARK_POWERS = ['pull', 'grasp', 'judge'];
export const ALIGN_TREE = [
  // ---- FOUNDATION: Force from defence, or from the kill ----
  { id: 'serene', align: 'light', branch: 'light', ico: '✧', nm: 'SERENE GUARD', tier: 1, max: 2, ds: 'A parry restores +5 Force · +10% stamina regen',
    fl: 'Peace is a shield. It is also a well.', apply(){ player.up.parryForce += 5; player.up.stamRegen *= 1.1; } },
  { id: 'fear', align: 'dark', branch: 'dark', ico: '✹', nm: 'FEED ON FEAR', tier: 1, max: 2, ds: 'A kill restores +5 Force · +10% stamina regen',
    fl: 'Their fear is power. Drink it.', apply(){ player.up.killForce = (player.up.killForce || 0) + 5; player.up.stamRegen *= 1.1; } },
  // ---- DISCIPLINE: the path's own powers come cheaper ----
  { id: 'shelter', align: 'light', branch: 'light', ico: '⛨', nm: 'SHELTER', tier: 2, max: 2, ds: 'Barrier, Mend and Repulse cost 15% less · take 5% less damage',
    fl: 'Stand between them and harm. That is all a Jedi is.', apply(){ cut(LIGHT_POWERS, 0.85); player.up.dr = 1 - (1 - (player.up.dr || 0)) * 0.95; } },
  { id: 'wrath', align: 'dark', branch: 'dark', ico: '⚡', nm: 'WRATH', tier: 2, max: 2, ds: 'Pull, the Grip and Judgement cost 15% less · +5% saber damage',
    fl: 'Let the anger in. Then let it out, all at once.', apply(){ cut(DARK_POWERS, 0.85); player.up.dmg *= 1.05; } },
  // ---- CAPSTONE: mended by the parry, or by the kill ----
  { id: 'endures', align: 'light', branch: 'light', ico: '☀', nm: 'THE LIGHT ENDURES', tier: 3, max: 1, ds: 'A parry heals 4 vitality · +20% Force regen',
    fl: 'You cannot cut down what will not stop standing.', apply(){ player.up.parryHeal = (player.up.parryHeal || 0) + 4; player.up.forceRegen *= 1.2; } },
  { id: 'unlimited', align: 'dark', branch: 'dark', ico: '☄', nm: 'UNLIMITED POWER', tier: 3, max: 1, ds: 'A kill heals 4 vitality · +20% Force regen',
    fl: 'Every one who falls makes you more.', apply(){ player.up.killHeal = (player.up.killHeal || 0) + 4; player.up.forceRegen *= 1.2; } },
];
export const ALIGN_PATHS = [
  { id: 'light', nm: 'THE LIGHT', line: 'Defence, shelter and mercy. Force from the parry; Barrier, Mend and Repulse come cheaper.' },
  { id: 'dark', nm: 'THE DARK', line: 'Aggression and fear. Force from the kill; Pull, the Grip and Judgement come cheaper.' },
];

// what the people around you say once you lean (game/talk.js lays these over data/talk.js, by name then `light` / `dark`)
export const ALIGN_TALK = {
  'MASTER VAEL': {
    light: ['You let that one go. I saw. Do not let anyone tell you it was weakness.', 'You fight like someone who wants to come home afterwards. Good.'],
    dark: ['You are quicker than you were. I do not like what is making you quicker.', 'I have seen that look before. On Vexis, the year before he left.'] },
  'GENERAL KAST': {
    light: ['My clones trust you. That is not something I can order them to do.'],
    dark: ['You get results. I just hope you can still tell the difference between them and us.'] },
  'TARN ODO': {
    light: ['The younglings ask about you. You are the Jedi in the stories now.'],
    dark: ['The younglings go quiet when you walk past. I tell them you are tired.'] },
  'ILSA VENN': {
    light: ['You still believe in all of it. I almost envy you.'],
    dark: ['Careful. I know where that road goes. I walked it.'] },
  'THE MANDALORIAN': {
    light: ['You Jedi are softer than the stories. I have decided I like it.'],
    dark: ['You fight like a hunter, not a Jedi. I will keep my eye on you.'] },
  youngling: {
    light: ['Master says you spare people. Can you teach me to do that?'],
    dark: ['Your eyes look funny. Are you sick?'] },
  archivist: {
    light: ['The records will say you were kind. I am writing them.'],
    dark: ['I have read about Jedi like you. The stories do not end well.'] },
  'THE ARMORER': {
    light: ['You let them yield. There is honour in that, and the clan remembers honour.'],
    dark: ['You leave nobody standing. The Way does not forbid it. It does not ask it either.'] },
  'THE CAPTAIN': {
    light: ['You bring them in alive. That is the difference between us and the ones who made us.'],
    dark: ['No prisoners again. I am not saying you are wrong. I am saying I am counting.'] },
  'SGT. VANT': {
    light: ['You could have dropped him. You didn\'t. That\'s why we follow you.'],
    dark: ['Remind me never to surrender to you.'] },
  BRISK: {
    light: ['You let that one walk! I\'d have... no, I wouldn\'t. Nice.'],
    dark: ['Okay, I\'m not saying anything. I\'m saying nothing. Very loudly.'] },
  KORA: {
    light: ['The foundlings talk about the warrior who spares the beaten. They mean you.'],
    dark: ['The foundlings are scared of you. Mostly in a good way.'] },
};
