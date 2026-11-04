// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FORMS: the seven lightsaber forms as the progression sees them (lore order, prerequisites, variants), and the
// three-slot form LOADOUT that keys 1 / 2 / 3 and the mouse wheel switch between.

/* THE SEVEN FORMS — lore order and lineage (Wookieepedia, canon and Legends). Each form was made to cover an earlier
   one's gap, which gives the unlock tree:
     I Shii-Cho is where every initiate starts · II Makashi (blade duels) and III Soresu (blaster defence) grew from it ·
     IV Ataru builds on Makashi's offence · V grew out of Soresu and splits into Shien (reverse grip, bolts sent home)
     and Djem So (block then riposte) · VI Niman synthesises I–V (needs `anyOf` forms first) · VII is for masters of
     several forms and forks for good into Juyo or Vaapad.
   no       the form's numeral                     name / tag   HUD chip text (name over a one-word role)
   needs    forms that must be known first          anyOf        how many earlier forms must be known (Niman, VII)
   variant  Form V / VII: the variants share a numeral; `fork` = picking one locks the other for the run
   grip     the form's own saber grip. Shien is the reverse-grip form; the other forms are forward-grip forms in canon and
            hold a regular grip. Only Niman, the form that borrows from every other, has none: it takes the hero's grip
            preference (Settings / G), so its reverse guard is the Starkiller-style one
   ready    has a stance in data/stances.js and can be slotted. The rest are planned (roadmap: Seven forms) and stay out
            of every loadout until their stance lands.
   staff    not one of the seven: the SABER STAFF, a double-bladed hilt held in both hands (the Jedi Temple Guard's
            weapon, Maul's). It has no numeral (`kind` stands in for "FORM n" on the cards), shows the long hilt and its
            second blade (player/model/weapons.js setSaberStaff) and swings its own two-ended set (data/poses.js). Until
            the hero has it, the forms pages name it only as ??? (ui/forms-ui.js lockedChip).
   dual     not one of the seven either: JAR'KAI, a saber in each hand (Ahsoka, Ventress, Revan, Starkiller). No numeral
            (`kind` stands in), a second saber in the off hand (player/model/weapons.js setSaberDual), and every cut is
            two beats: the lead blade, then the off hand's follow-up the same way, a beat behind (anim/saber.js, jedi/bladehit.js).
            It has no grip of its own: like Niman it takes the hero's grip preference (Settings / G), so both blades
            run forward (Revan, Ventress) or reverse (Ahsoka). Shown as ??? until it's in hand, like the staff. */
export const FORMS = {
  shiicho: { no: 'I',   name: 'SHII-CHO', tag: 'CROWDS',   needs: [], ready: true, grip: 'regular' },
  makashi: { no: 'II',  name: 'MAKASHI',  tag: 'DUELS',    needs: ['shiicho'], ready: true, grip: 'regular' },
  soresu:  { no: 'III', name: 'SORESU',   tag: 'DEFENCE',  needs: ['shiicho'], ready: true, grip: 'regular' },
  ataru:   { no: 'IV',  name: 'ATARU',    tag: 'FAST',     needs: ['makashi'], ready: true, grip: 'regular' },
  djemso:  { no: 'V',   name: 'DJEM SO',  tag: 'STRONG',   needs: ['soresu'], variant: 'v', ready: true, grip: 'regular' },
  shien:   { no: 'V',   name: 'SHIEN',    tag: 'REDIRECT', needs: ['soresu'], variant: 'v', ready: true, grip: 'reverse' },
  niman:   { no: 'VI',  name: 'NIMAN',    tag: 'BALANCED', needs: [], anyOf: 4, ready: true },
  juyo:    { no: 'VII', name: 'JUYO',     tag: 'FURY',     needs: [], anyOf: 5, variant: 'vii', fork: true, ready: true, grip: 'regular' },
  vaapad:  { no: 'VII', name: 'VAAPAD',   tag: 'CONTROL',  needs: [], anyOf: 5, variant: 'vii', fork: true, ready: true, grip: 'regular' },
  staff:   { no: null,  name: 'SABER STAFF', tag: 'SWEEPS', kind: 'DOUBLE BLADE', needs: [], ready: true, grip: 'regular', staff: true },
  jarkai:  { no: null,  name: "JAR'KAI",   tag: 'FLURRY', kind: 'DUAL BLADES', needs: [], ready: true, dual: true },
};
// the line a card heads a form with: "FORM VI", or the saber staff's "DOUBLE BLADE"; and the one a locked chip shows
// (the staff stays a mystery until it's in hand: ???)
export const formTitle = (id) => FORMS[id] ? (FORMS[id].no ? 'FORM ' + FORMS[id].no : FORMS[id].kind || FORMS[id].name) : '';
export const isStaff = (id) => !!(FORMS[id] && FORMS[id].staff);
export const isDual = (id) => !!(FORMS[id] && FORMS[id].dual);
// a form that is a weapon of its own rather than one of the seven: the forms pages keep it a mystery (???) until it's known
export const isSecret = (id) => isStaff(id) || isDual(id);

/* THE LOADOUT — three slots on 1 / 2 / 3 (and the wheel). A slot holds a form id or null (an empty slot is skipped).
   DEFAULT_LOADOUT is the training grounds' and the missions' fallback; a campaign or survival run starts on RUN_LOADOUT,
   with Form I alone, and grows as the run teaches more (game/meditation.js). */
export const LOADOUT_SLOTS = 3;
export const DEFAULT_LOADOUT = ['ataru', 'niman', 'djemso'];
export const STARTING_FORMS = ['shiicho'];   // Form I, which every Jedi learns first
export const RUN_LOADOUT = ['shiicho', null, null];

/* THE PATH — where a run learns each form (the auto-unlocks in data/store.js are built from this), in story order.
   chapter  the campaign chapter whose clear teaches it (data/campaign.js): the trials are the masters who teach
   alt      the chapter that teaches it instead in a story that never plays `chapter` (a chapter only the Jedi's own story
            has, data/campaign.js `story`): a Jedi in a co-op partner's Mando or trooper story still learns it
   level / wave   the same point for a run that plays the levels straight through (no chapters)
   stage    survival and the missions: the run's depth (waveTotal)
   The story hands out one form a chapter at most, spread over all three acts, in the order the lineage above has them:
     ACT I    Shii-Cho from the start (the last lesson in the dojo) · Makashi from Vael after the Inquisitor finds
              you in the archive, so you meet Ilsa at the refuge with a duellist's form · Soresu from Tarn, the Wall
     ACT II   Ataru from Sera, the Acrobat · Djem So from Kast, the Knight · Shien from a Jedi captain's holocron in the
              Jakku wreck (the hull snipers are what it is for) · Niman on Mustafar, once Vael is taken: the forms come
              together in you
     ACT III  Form VII after the chase, only one of its two roads · the saber staff, a Temple Guard's, back in the
              temple on Jedha · Jar'Kai at Vael's chains
   Form V's two variants share a slot (G swaps them) once both are known. Form VII is a fork: the run offers both and
   the hero keeps one. */
export const FORM_PATH = [
  { form: 'makashi', chapter: 'archive',       level: 0, wave: 3, stage: 2 },   // Vael: a duellist's form, for Ilsa
  { form: 'soresu',  chapter: 'trial-first',   level: 1, wave: 0, stage: 3 },   // the Wall
  { form: 'ataru',   chapter: 'trial-acrobat', hothFirst: 'hoth', level: 1, wave: 1, stage: 5 },   // the Acrobat (Hoth first: the enclave's holocron, so Ataru answers the Knight's Djem So)
  { form: 'djemso',  chapter: 'trial-knight',  level: 1, wave: 2, stage: 6 },   // the Knight: Form V's strong road
  { form: 'shien',   chapter: 'jakku',         level: 1, wave: 2, stage: 7 },   // …and its other one, from a holocron in the salvage
  { form: 'niman',   chapter: 'mustafar',      level: 1, wave: 3, stage: 8 },   // Form VI: the forms brought together
  { form: 'juyo',    chapter: 'chase',         level: 2, wave: 0, stage: 9 },   // Form VII, offered after the chase
  { form: 'vaapad',  chapter: 'chase',         level: 2, wave: 0, stage: 9 },
  { form: 'staff',   chapter: 'return', alt: 'spearhead', level: 2, wave: 1, stage: 10 },   // a Temple Guard's saber staff, home on Jedha
  { form: 'jarkai',  chapter: 'chains', alt: 'spearhead', level: 2, wave: 2, stage: 11 },  // Jar'Kai: the second saber, won in Act III (alt: a Jedi guest in a Mando or trooper story, which skips the chains)
];
// the run's Form VII choice locks the other for good: G.formFork holds the one kept
export const forkClosed = (id, kept) => !!(FORMS[id] && FORMS[id].fork && kept && kept !== id);

// saves and settings from before the forms had their own ids called them by weight
const LEGACY_FORM = { fast: 'ataru', medium: 'niman', strong: 'djemso' };
export const migrateForm = (id) => LEGACY_FORM[id] || id;

// a loadout as stored or handed in → exactly LOADOUT_SLOTS entries, each a ready form or null, no form twice, and one
// variant of a numeral at most (Djem So or Shien in the Form V slot: G swaps between them)
export function cleanLoadout(list){
  const out = [], seen = new Set();
  for (let i = 0; i < LOADOUT_SLOTS; i++){
    const id = migrateForm(list && list[i]);
    const ok = !!(id && FORMS[id] && FORMS[id].ready && !seen.has(id) && !(FORMS[id].variant && seen.has('#' + FORMS[id].variant)));
    if (ok){ seen.add(id); if (FORMS[id].variant) seen.add('#' + FORMS[id].variant); }
    out.push(ok ? id : null);
  }
  return out;
}

/* JAR'KAI'S GRIPS: G cycles the two hands through these [main hand, off hand] pairs — both forward (Maul, Starkiller in
   The Force Unleashed II), the main saber forward with the off one reversed (Ahsoka), both reversed (Ahsoka, Starkiller).
   Remembered apart from the Niman grip preference. */
export const DUAL_GRIPS = [['regular', 'regular'], ['regular', 'reverse'], ['reverse', 'reverse']];
let dualGrip = 0;
try { dualGrip = (+localStorage.getItem('sw_dualgrip') || 0) % DUAL_GRIPS.length; } catch(e){}
export const dualGripIndex = () => dualGrip;
export function setDualGrip(i){
  dualGrip = ((i | 0) % DUAL_GRIPS.length + DUAL_GRIPS.length) % DUAL_GRIPS.length;
  try { localStorage.setItem('sw_dualgrip', String(dualGrip)); } catch(e){}
}
// the off hand's grip in a dual form ('regular' outside one)
export const offGrip = (id) => isDual(id) ? DUAL_GRIPS[dualGrip][1] : 'regular';
// the grip the saber is held in right now: the form's own, else the hero's preference (Niman only: Settings / G);
// a dual form takes its main hand's from DUAL_GRIPS
export const formGrip = (id, pref) => (FORMS[id] && FORMS[id].grip) || (isDual(id) ? DUAL_GRIPS[dualGrip][0] : pref === 'reverse' ? 'reverse' : 'regular');
// the other variant of the same numeral that the hero knows (Djem So ⇄ Shien), or null
export const otherVariant = (id, known) => {
  const v = FORMS[id] && !FORMS[id].fork && FORMS[id].variant;
  return v ? Object.keys(FORMS).find(o => o !== id && FORMS[o].variant === v && FORMS[o].ready && known(o)) || null : null;
};

/* THE FORMS CODEX — what each form is, in the lore and in the fight: the Forms page (ui/forms-ui.js) shows a form
   once the hero has learned it. `who` names a famous user, `best` the fights it is made for. Keep the numbers here in
   step with data/stances.js. Its counter family (what it beats, what beats it) is drawn from data/foe-forms.js
   FORM_FAMILY by ui/forms-ui.js, so it is not repeated here. Keep it short: three strengths and two or three weaknesses,
   and leave the finisher to data/finishers.js (the page shows it in its own block). */
export const FORM_CODEX = {
  shiicho: { who: 'Kit Fisto', lore: 'The first form every initiate learns: wide, simple sweeps made to hold off many foes at once.',
    best: 'Crowds of troopers',
    pros: ['Wide sweeps that catch several foes, and carry on through a blocking one', 'W and a cut in rhythm: the Sarlacc Advance spins you through a crowd', 'Its finisher also knocks the blaster out of a trooper\'s hands'],
    cons: ['Duellists read its broad cuts and turn 10% more of them', 'Deflected bolts go back loosely'] },
  makashi: { who: 'Count Dooku', lore: 'The duellist\'s form: one hand, side-on, precise and economical, made to beat another blade.',
    best: 'Duellists, acolytes and anything with a blade',
    pros: ['+40% damage against blade users', 'Reads feints: duellists feint and hold strikes half as often', 'Hard to guard-break'],
    cons: ['A narrow arc that crowds slip past', 'Weak against blasters: deflects fly wild and cost 50% more stamina'] },
  soresu: { who: 'Obi-Wan Kenobi', lore: 'The wall: tight, economical blocks that send blaster fire home and outlast the attacker.',
    best: 'Heavy blaster fire and long fights',
    pros: ['A held guard sends bolts back home', 'The cheapest guard: barely a scratch gets through, and every blow it blocks tires the attacker', 'The widest parry window'],
    cons: ['The lowest damage of any form', 'Slower on its feet'] },
  ataru: { who: 'Yoda, Qui-Gon Jinn', lore: 'The acrobat\'s form: leaps, flips and speed, the whole body behind every strike.',
    best: 'Officers, snipers, grenadiers and jet troopers',
    pros: ['+60% damage against the back line, and cuts in the air land 35% harder', 'Dash into a cut for the Hawk-Bat Swoop', 'Keeps moving while it swings, and casts Force powers fast'],
    cons: ['Weak against armour', 'Deflected bolts spray'] },
  djemso: { who: 'Anakin Skywalker', lore: 'Form V, the strong form: power blows that answer every attack with a harder one.',
    best: 'Brutes, armour and bosses',
    pros: ['Breaks guards fast and shreds armour', 'Take a blow on the guard, then strike back with a Fluid Riposte', 'Force powers hit 35% bigger'],
    cons: ['Slow, stamina-hungry swings in a narrow arc that crowds punish', 'Force powers cost 30% more'] },
  shien: { who: 'Ahsoka Tano', lore: 'Form V\'s other road: a reverse grip built to send blaster fire straight back at the shooter.',
    best: 'Blaster troopers and turrets',
    pros: ['Every deflect flies home and hits 50% harder', 'Cuts harder than Djem So on anything without armour, with a wider arc'],
    cons: ['Less raw power against armour than Djem So', 'Only one Form V fits in a loadout (G swaps them)'] },
  niman: { who: 'Jedi diplomats, the Jedi of Geonosis', lore: 'Form VI, the balanced form: a little of every other form, with saber and Force as one.',
    best: 'Anything: the all-rounder',
    pros: ['Swings and Force powers cost less, and clean parries give Force back', 'A power cast mid-string keeps the string going, and defence powers come back twice as fast', 'The only form that can switch to a reverse grip (G)'],
    cons: ['Master of none: no standout edge against any foe'] },
  juyo: { who: 'Darth Vader', lore: 'Form VII, the ferocious form: bursts of savage cuts driven by the Force and by fury.',
    best: 'Taking a fight to its end, fast',
    pros: ['Every hit builds fury, up to +35% damage', 'Fast, savage strings'],
    cons: ['Every swing burns Force as well as stamina', 'Blows land 25% harder on you', 'Choosing it closes Vaapad for the run'] },
  vaapad: { who: 'Mace Windu', lore: 'Form VII as Mace Windu made it: the attacker\'s own fury, turned back on them.',
    best: 'Fast duellists who keep attacking you',
    pros: ['Blocks and parries build fury, up to +40% damage', 'A parry finds the Shatterpoint: your next cut on that foe lands double and floors it'],
    cons: ['Blows land 10% harder on you', 'Weak when nobody attacks you', 'Choosing it closes Juyo for the run'] },
  staff: { who: 'The Jedi Temple Guard, Darth Maul', lore: 'Not a form but a weapon: one long hilt, a blade at each end, kept spinning in both hands. The Temple Guards carried it gold-bladed to hold a door against many; Maul made it a whirlwind. Every cut is two.',
    best: 'Crowds closing in from every side',
    pros: ['Two blades: every cut sweeps the front and the back at once', 'Roll or dash into a cut for the Pole Vault: you land feet first on the foe and floor it', 'Wheels the staff into a catch on a volley of bolts'],
    cons: ['A long hilt: blocking costs 25% more stamina, and Force casts come 20% slower', 'Less bite per cut than a single blade'] },
  jarkai: { who: 'Ahsoka Tano, Asajj Ventress, Darth Revan, Starkiller', lore: 'Not a form but a way of fighting: a saber in each hand. Ventress and Revan held both blades forward, Ahsoka both reversed. The second blade is always coming, from the other side, before the first one is done.',
    best: 'Heavy hitters: Djem So, Juyo and the saber staff',
    pros: ['Every cut is two: the off-hand blade follows the same way, a beat behind', 'Gets inside a heavy wind-up, and crossed blades block for 15% less stamina', 'G cycles the grips: both forward, mixed, both reversed'],
    cons: ['A tight guard turns both beats: Soresu and Shii-Cho shut it down', 'A narrow arc that crowds punish, and little against armour', 'Deflected bolts scatter and cost 20% more, and Force powers cost 20% more'] },
};
