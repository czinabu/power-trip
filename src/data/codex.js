// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CODEX: one entry for every foe the hero can meet (ui/codex-ui.js shows them, game/codex.js unlocks them).

import { PURGE, DRILL, MARSHAL, SQUAD } from './allies.js';
import { FAMILIES, FORM_FAMILY, NAMED_FORMS, FOE_FORMS, BOSS_FORM } from './foe-forms.js';

/* Every entry is short on purpose: a lore line, what it carries, two things to watch for and two ways to beat it.
   Counters name actions (PARRY, KICK, PUSH, DASH, BRACE), never keys, so they read the same on a keyboard, a pad or a phone.

   An entry:
     id      its key in the save (game/codex.js)
     tab     'troops' | 'duelists' | 'bosses'
     name, kicker (the line under the name), threat (1–5 pips), lore
     weapons, watch, beat
   TROOPS are the enemy types (data/enemies.js ENEMY_TYPES, by the same id). Their looks in the preview are the type's
   pool (data/foe-looks.js), the uniforms a story dresses it in (data/allies.js) and the elite traits.
   DUELISTS are the named foes a duel objective sends (data/missions.js `name`): `foe` is the type it fights as, and it
   takes that type's weapons / watch / beat unless it has its own (a form master fights in its form). `mids` tells
   apart two foes with one name (THE WARDEN), `dress` is the uniform its mission puts it in, tint / scale as the mission
   has them (a cast look in data/saber-cast.js wears its own colours).
   BOSSES: the Warbringer and the two finales. */
export const CODEX_TABS = [
  { id: 'troops', name: 'TROOPS' },
  { id: 'duelists', name: 'DUELISTS' },
  { id: 'bosses', name: 'BOSSES' },
  { id: 'allies', name: 'ALLIES' },
];

const TROOPS = [
  { id: 'grunt', name: 'PURGE TROOPER', kicker: 'RANK AND FILE', threat: 1,
    lore: 'The Empire\'s hunters in black. There are always more of them.',
    weapons: ['Vibro-sword'],
    watch: ['Comes in crowds, but only two swing at once', 'Picks up a feint or two as a run goes on'],
    beat: ['A clean cut or two drops it', 'Keep moving: never fight from the middle of the pack'] },
  { id: 'blaster', name: 'BLASTER TROOPER', kicker: 'RANK AND FILE · RANGED', threat: 1,
    lore: 'Armour, a rifle and orders. The squad fires in turns.',
    weapons: ['E-11 blaster rifle'],
    watch: ['Sidesteps between shots', 'Two fire at once, three late in a run'],
    beat: ['Deflect its bolts back, or brace and fire', 'Close the gap and cut it down'] },
  { id: 'officer', name: 'IMPERIAL OFFICER', kicker: 'SQUAD LEADER', threat: 2,
    lore: 'Hangs back with a sidearm and runs the squad around it.',
    weapons: ['Blaster pistol'],
    watch: ['VOLLEY: every blaster near it fires at once', 'FLANK: the next attackers come from your sides'],
    beat: ['Hit it while its arm is raised to cut the order off', 'Drop it first: its troops falter'] },
  { id: 'flyer', name: 'JET TROOPER', kicker: 'SKIRMISHER · AIRBORNE', threat: 2,
    lore: 'Hovers above the fight at your height and rains bolts down.',
    weapons: ['Blaster rifle', 'Jetpack'],
    watch: ['Stays out of blade reach', 'Climbs with you: no hiding above it'],
    beat: ['PULL, PUSH or slam it down: the crash wrecks its jetpack', 'A rocket or a Repulse blows it out of the sky'] },
  { id: 'bomber', name: 'SABOTEUR', kicker: 'KAMIKAZE DROID', threat: 2,
    lore: 'A fast droid with a charge in its chest and no plan B.',
    weapons: ['Self-destruct charge'],
    watch: ['Rushes in, then lights a loud, blinking fuse', 'Blows up when it dies, too'],
    beat: ['Kill it at range, or PUSH it away', 'DASH clear once the fuse starts'] },
  { id: 'sniper', name: 'MARKSMAN', kicker: 'BACK LINE · SNIPER', threat: 3,
    lore: 'Holds the back line with a long rifle and a patient eye.',
    weapons: ['DLT-19x long rifle'],
    watch: ['A laser sight tracks you while it charges', 'One shot, fast and hard'],
    beat: ['Break line of sight behind cover', 'DASH as it fires, or close in and spoil the shot'] },
  { id: 'grenadier', name: 'GRENADIER', kicker: 'ARTILLERY', threat: 2,
    lore: 'Lobs thermal detonators over whatever cover you pick.',
    weapons: ['Thermal detonators'],
    watch: ['A ring marks the landing spot and fills as the fuse burns', 'Cover will not save you'],
    beat: ['Step out of the ring before it fills', 'As a Jedi, PUSH a live one back at the squad'] },
  { id: 'lancer', name: 'PURGE LANCER', kicker: 'GAP-CLOSER', threat: 3,
    lore: 'An electro-pike and one long, straight lunge.',
    weapons: ['Electro-pike'],
    watch: ['Plants its feet and marks a line at you', 'A held block will not stop the point'],
    beat: ['Step or DASH off the line as it locks', 'PARRY the point: a miss leaves it wide open'] },
  { id: 'phalanx', name: 'SENTINEL', kicker: 'SHIELD TROOPER', threat: 3,
    lore: 'A riot shield and a short blade. It anchors the line.',
    weapons: ['Riot shield', 'Vibro-sword'],
    watch: ['The shield eats everything from the front', 'Slow, sturdy, hard to shift'],
    beat: ['Flank it', 'Break the shield with a finisher, a heavy or a riposte'] },
  { id: 'duelist', name: 'MAGNAGUARD', kicker: 'DROID DUELIST', threat: 3,
    lore: 'An old war droid with a spinning electrostaff.',
    weapons: ['Electrostaff'],
    watch: ['Its weapon sits on the side it guards (the ring shows it while you learn)', 'Mash and it parries you'],
    beat: ['Cut in on the open side', 'KICK twice to break its guard, then strike', 'Its staff is a SPEED form: a GUARD form (Soresu, Shii-Cho, Shien) counters it'] },
  { id: 'brute', name: 'BRUTE', kicker: 'HEAVY', threat: 3,
    lore: 'A wall of muscle and plate behind a vibro-maul.',
    weapons: ['Vibro-maul'],
    watch: ['Light hits will not stagger it', 'Slow, wide swings that land hard'],
    beat: ['PARRY the swing', 'Floor it with a heavy blow'] },
  { id: 'acolyte', name: 'SITH ACOLYTE', kicker: 'SABER DUELIST', threat: 4,
    lore: 'Trained in the dark side\'s blade. No two wear the same face.',
    weapons: ['Lightsaber'],
    watch: ['Feints, strings cuts and binds blades in a lock', 'Bats blaster fire back at you', 'Fights in one of the forms (the tag over its head): Shii-Cho early, any form later'],
    beat: ['Read its guard and cut the open line', 'Space your cuts: mashing gets parried', 'Switch to the form that counters its own: the tag shows ▲ when you have it'] },
].map(e => ({ ...e, tab: 'troops', kind: 'type' }));

/* the form counter (data/foe-forms.js): which family of forms beats a duellist's form, as a codex line */
const FAMILY_FORMS = { power: 'Djem So, Juyo, Vaapad', guard: 'Soresu, Shii-Cho, Shien', speed: 'Makashi, Ataru, Jar\'Kai, the saber staff' };
function counterLine(form){
  const fam = FORM_FAMILY[form];
  if (!fam) return null;
  const by = Object.keys(FAMILIES).find(k => FAMILIES[k].beats === fam);
  return `Its form is ${FAMILIES[fam].name}: a ${FAMILIES[by].name} form counters it (${FAMILY_FORMS[by]})`;
}
// how a form master fights (data/foe-forms.js FORM_STYLE)
const FORM = {
  soresu: { watch: ['Turns nearly every cut and sends every bolt home', 'Each cut it blocks costs you stamina'],
            beat: ['Do not trade into its guard: wait for an opening', 'Break the guard, then punish hard'] },
  ataru:  { watch: ['Flips clear of your cuts', 'Comes back in long, quick strings'],
            beat: ['PARRY the string as it lands', 'Its guard is light: press it when it lands a flip'] },
  djemso: { watch: ['Meets a blow on its guard and answers harder', 'Drives a saber lock hard'],
            beat: ['Space your cuts; never mash into its guard', 'Win the lock, or KICK your way out of it'] },
};
const SABER = ['Lightsaber'];

const DUELISTS = [
  // ---- the Jedi's hunters ----
  { id: 'inquisitor', name: 'THE INQUISITOR', foe: 'acolyte', kicker: 'INQUISITOR', threat: 4,
    lore: 'A masked hunter of the Order, always one step ahead.' },
  { id: 'seventh-blade', name: 'THE SEVENTH BLADE', foe: 'acolyte', kicker: 'INQUISITOR · THE LONG CHASE', threat: 4,
    lore: 'It runs, you give chase, and then it turns and fights.' },
  { id: 'warden-pens', name: 'THE WARDEN', foe: 'acolyte', form: 'djemso', kicker: 'JAILER OF THE PENS', threat: 4,
    lore: 'One great pauldron, a chain, and a list of prisoners.' },
  { id: 'warden-gate', name: 'THE WARDEN', foe: 'acolyte', mids: ['strike'], kicker: 'GATE WARDEN · EXEGOL', threat: 5,
    lore: 'A horned hunter who holds the Citadel gate.' },
  { id: 'echo', name: 'THE ECHO', foe: 'acolyte', form: 'djemso', kicker: 'THE GATE · JEDHA', threat: 4,
    lore: 'A vision out of the Sith gate, with a face of shadow.' },
  { id: 'grand-inquisitor', name: 'THE GRAND INQUISITOR', foe: 'acolyte', form: 'djemso', kicker: 'THE CITADEL', threat: 5,
    lore: 'Keeper of the Ledger: every Jedi taken, by name.' },
  // ---- the field's champions ----
  { id: 'overseer', name: 'THE OVERSEER', foe: 'brute', tint: 0xff7a1e, scale: 1.35, kicker: 'THE EMBER ACADEMY', threat: 4,
    lore: 'Runs the academy floor with a heavy hand.' },
  { id: 'warden-gallows', name: 'THE WARDEN', foe: 'brute', mids: ['gallows'], tint: 0x5a6a7a, scale: 1.3, kicker: 'THE GALLOWS', threat: 4,
    lore: 'Keeps the gallows, and the keys.' },
  { id: 'forgemaster', name: 'THE FORGEMASTER', foe: 'brute', tint: 0xff7a1e, scale: 1.35, kicker: 'THE MUSTAFAR FORGE', threat: 4,
    lore: 'Works the forge, and anyone who gets in the way.' },
  { id: 'avalanche', name: 'THE AVALANCHE', foe: 'brute', tint: 0xc8d4e0, scale: 1.3, kicker: 'THE TRENCH LINE', threat: 4,
    lore: 'Comes down the trench line just like the name says.' },
  { id: 'houndmaster', name: 'THE HOUNDMASTER', foe: 'lancer', tint: 0x6a5a3a, scale: 1.12, kicker: 'THE MAGISTRATE\'S HUNTER', threat: 4,
    lore: 'Hunts for the Magistrate, pike first.' },
  { id: 'outrider', name: 'THE OUTRIDER', foe: 'lancer', tint: 0x6a7a3a, scale: 1.15, kicker: 'THE EXTRACTION', threat: 4,
    lore: 'Rides the grassland\'s edge, running down anyone who flees.' },
  { id: 'shield-captain', name: 'THE SHIELD CAPTAIN', foe: 'phalanx', tint: 0x5a6472, scale: 1.22, kicker: 'THE LOTHAL BREAKOUT', threat: 4,
    lore: 'Holds the last door of the prison behind a wall of shield.' },
  { id: 'salvage-master', name: 'THE SALVAGE MASTER', foe: 'duelist', tint: 0x9a6a3a, scale: 1.09, kicker: 'SALVAGE RIGHTS', threat: 4,
    lore: 'Claims every wreck in the graveyard, and fights for them.' },
  { id: 'vx7', name: 'VX-7', foe: 'duelist', tint: 0x4a5a6a, scale: 1.06, kicker: 'BOUNTY · ASSASSIN DROID', threat: 4,
    lore: 'An assassin droid sent to count the foundlings.' },
  { id: 'iron-warden', name: 'THE IRON WARDEN', foe: 'duelist', tint: 0x4a4a52, scale: 1.1, kicker: 'GATE WARDEN · EXEGOL', threat: 5,
    lore: 'Holds the Citadel gate against hunters in beskar.' },
  // ---- the ARC trooper's story ----
  { id: 'marshal', name: 'THE MARSHAL', foe: 'officer', dress: MARSHAL, scale: 1.12, kicker: 'COMMANDER · YOUR BATCH', threat: 5,
    lore: 'A clone commander in black and gold who followed the order.' },
  { id: 'vorn', name: 'CAPTAIN VORN', foe: 'officer', uniform: PURGE.officer, tint: 0x8a1a1a, scale: 1.1, kicker: 'PURGE CAPTAIN', threat: 4,
    lore: 'The Marshal\'s own purge captain, hunting deserters.' },
  { id: 'marshal-record', name: 'THE MARSHAL\'S RECORD', foe: 'officer', uniform: DRILL.officer, tint: 0xb0a070, scale: 1.08, kicker: 'A TRAINING DROID', threat: 3,
    lore: 'An old drill droid running the Marshal\'s file. First in batch.' },
  // ---- the trials and the sparring ring ----
  { id: 'ilsa', name: 'ILSA VENN', foe: 'acolyte', form: 'djemso', kicker: 'SPARRING · THE LAST LESSON', threat: 2, weapons: SABER,
    lore: 'Your oldest friend. Pulls no punches in the ring.' },
  { id: 'sera', name: 'SERA QUILL', foe: 'acolyte', form: 'ataru', kicker: 'TRIAL', threat: 4, weapons: SABER,
    lore: 'Straight out of a prison cell, and still too fast for you.' },
  { id: 'wall', name: 'THE WALL', foe: 'acolyte', form: 'soresu', kicker: 'TRIAL · SORESU MASTER', threat: 4, weapons: SABER,
    lore: 'Barely strikes. Never breaks.' },
  { id: 'acrobat', name: 'THE ACROBAT', foe: 'acolyte', form: 'ataru', kicker: 'TRIAL · ATARU MASTER', threat: 4, weapons: SABER,
    lore: 'Fights in the air as much as on the ground.' },
  { id: 'knight', name: 'THE KNIGHT', foe: 'acolyte', form: 'djemso', kicker: 'TRIAL · DJEM SO MASTER', threat: 5, weapons: SABER,
    lore: 'A general who answers every blow, harder.' },
  { id: 'challenger', name: 'THE CHALLENGER', foe: 'duelist', tint: 0x7a5a3a, kicker: 'THE CHALLENGE', threat: 4,
    lore: 'Fights by the old custom: one on one.' },
  { id: 'jet-ace', name: 'THE JET ACE', foe: 'lancer', tint: 0xd2a03a, kicker: 'THE JET ACE', threat: 4,
    lore: 'Wants to see how your armour moves.' },
  { id: 'clan-champion', name: 'THE CLAN CHAMPION', foe: 'duelist', tint: 0x6a7a8a, kicker: 'THE CLAN CHAMPION', threat: 5,
    lore: 'Beskar to beskar, for the clan\'s honour.' },
].map(e => {
  const base = TROOPS.find(t => t.id === e.foe), F = e.form && FORM[e.form];
  const ff = e.form || (NAMED_FORMS[e.name] && NAMED_FORMS[e.name].form) || (FOE_FORMS[e.foe] && FOE_FORMS[e.foe].form), c = counterLine(ff);
  const beat = (F || base).beat;
  return { weapons: base.weapons, watch: (F || base).watch, ...e, beat: c ? [...beat, c] : beat, tab: 'duelists', kind: 'named' };
});

const BOSSES = [
  { id: 'warbringer', kind: 'warbringer', name: 'WARBRINGER', kicker: 'MID-BOSS', threat: 4,
    lore: 'A brute raised into a champion: crimson, crowned and huge.',
    weapons: ['Vibro-maul'],
    watch: ['A tall leap that quakes the ground where you stood', 'Never blocks, and takes a beating'],
    beat: ['DASH or jump the slam', 'PARRIES and heavy blows fill its posture bar: full, it breaks open'] },
  { id: 'vexis', kind: 'boss', boss: 'sith', name: 'DARTH VEXIS', kicker: 'HERALD OF THE VOID', threat: 5,
    lore: 'The Sith lord waiting at the end of the Jedi\'s road.',
    weapons: ['Lightsaber', 'Force lightning', 'Force choke'],
    watch: ['A Juyo master: feints, strings and saber locks. Three phases, each darker than the last',
            'Hold a block in his face and his GUARD BREAKER goes through it; back off and his saber comes after you',
            'Phase II: lightning, the choke and a repulse if you crowd him. Phase III: blink chains, the storm, a last stand'],
    beat: ['PARRY the Guard Breaker (the white and red flash) and he reels', 'Catch the lightning on your guard, then PARRY a surge or PUSH it back into him',
           'Dash out of the choke\'s red ring, or PUSH to break it. Dodge his last charge and he is wide open', counterLine(BOSS_FORM.sith.form)] },
  { id: 'magistrate', kind: 'boss', boss: 'mando', name: 'THE IRON MAGISTRATE', kicker: 'WARLORD OF THE OUTER RIM', threat: 5,
    lore: 'A beskar warlord built to beat a hunter at the hunter\'s game.',
    weapons: ['Blaster barrage', 'Jetpack', 'Beskar armour'],
    watch: ['Heavy armour shrugs off chip fire', 'Aimed volleys lead your strafe; he jet-charges if you kite'],
    beat: ['BRACE the barrage, or break line of sight', 'Braced shots, rockets and the Darksaber get through'] },
].map(e => ({ ...e, tab: 'bosses' }));

/* ALLIES: everyone on your side the hero meets. `squad` names a squadmate (data/allies.js SQUAD.roster: the def it is
   drawn from, by name, from the first roster that has it), `cast` a figure from the story's scenes (data/cast.js CAST).
   Squadmates carry their kit and two lines each on what they do and how to use them; the story's people just a line. */
const ROLE = {
  rifle: { weapons: ['Blaster rifle'], field: ['Wears the rank and file down with steady fire', 'Draws some of the troopers off you'] },
  heavy: { weapons: ['Rotary blaster'], field: ['Fires in bursts of three', 'Tougher than the rest of the squad'] },
  medic: { weapons: ['Blaster rifle', 'Medkit'], field: ['Patches up you and the squad close by', 'Runs to get a downed squadmate up'] },
  scout: { weapons: ['Long rifle'], field: ['Picks off the far line first', 'Hits hard, fires slowly'] },
  jedi:  { weapons: ['Lightsaber'], field: ['Cuts down the rank and file around you', 'Turns most of the bolts that reach it'] },
};
const SQUAD_TIPS = ['Order them from the command wheel: on me, move there, attack', 'Down is not dead: stand by them to get them up'];
const ALLY_LIST = [
  // ---- the squad ----
  { squad: 'SGT. VANT', kicker: 'SQUAD · SERGEANT', lore: 'Refused the order with you, and never looked back.' },
  { squad: 'BRISK', kicker: 'SQUAD', lore: 'The third clone who refused the order that night.' },
  { squad: 'HAMMER', kicker: 'SQUAD · HEAVY GUNNER', lore: 'Big, loud, and fond of the rotary.' },
  { squad: 'TALLY', kicker: 'SQUAD · SCOUT', lore: 'Counts every shot, and makes them count.' },
  { squad: 'PATCH', kicker: 'SQUAD · FIELD MEDIC', lore: 'Keeps the band breathing, one patch at a time.' },
  { squad: 'KORA', kicker: 'CLAN HUNTER', lore: 'A hunter of the clan, quick on the trigger.' },
  { squad: 'TEV', kicker: 'CLAN HUNTER', lore: 'A hunter of the clan who rarely says a word.' },
  { squad: 'BRUN', kicker: 'CLAN HUNTER · HEAVY', lore: 'The clan\'s heavy gun, slow to anger.' },
  { squad: 'ARLA', kicker: 'CLAN HUNTER', lore: 'A hunter of the clan with an eye for the high ground.' },
  { squad: 'MASTER IRO', role: 'jedi', guest: { model: 'acolyte', look: 'MASTER IRO', weapon: 'saber', color: 0xb8a888, eye: 0x4ad06a, cloth: 0x6a4a2e, scale: 1.2 },
    kicker: 'JEDI · HOTH', lore: 'A Jedi who stands with the squad in the snow.' },
  // ---- the Jedi's story ----
  { cast: 'MASTER VAEL', kicker: 'YOUR MASTER', lore: 'Your teacher, and the voice in your ear.' },
  { cast: 'TARN ODO', kicker: 'THE WALL', lore: 'A Soresu master who outlasted the Purge.' },
  { cast: 'SERA QUILL', kicker: 'THE ACROBAT', lore: 'An Ataru master, found in a cell and still quick.' },
  { cast: 'GENERAL KAST', kicker: 'THE KNIGHT', lore: 'Rhenna Kast, a Jedi general who never stopped fighting.' },
  { cast: 'CAPTAIN DACE', kicker: 'CAPTAIN', lore: 'A captain who throws in with the Jedi.' },
  { cast: 'THE MANDALORIAN', kicker: 'HUNTER', lore: 'A hunter in beskar, on your side for once.' },
  // ---- the Mandalorian's story ----
  { cast: 'THE ARMORER', kicker: 'THE COVERT', lore: 'Keeps the covert\'s forge, and the covert.' },
  { cast: 'ROOK', kicker: 'FOUNDLING', lore: 'Nine years old. Talks too much. Wants a helmet.' },
  { cast: 'OSSIK VANE', kicker: 'GUILD BROKER · SALT HOLLOW', lore: 'Has handed you jobs for ten years.' },
  { cast: 'KAEL VARR', kicker: 'THE CLAN', lore: 'Twenty years gone from the covert, and back to lead the hunt.' },
  { cast: 'SKYE', kicker: 'THE CLAN · PILOT', lore: 'Flew the covert\'s patrols for six years.' },
  { cast: 'BRAKKA', kicker: 'THE CLAN', lore: 'Trained you, and put the first dent in that helmet.' },
  // ---- the ARC trooper's story ----
  { cast: 'THE CAPTAIN', kicker: 'THE VORRAN YARDS', lore: 'The old clone who keeps the band together.' },
];
const slug = (n) => 'ally-' + n.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const squadDef = (name) => { for (const k of ['trooper', 'jedi', 'mando']){ const d = SQUAD.roster[k].find(d => d.name === name); if (d) return d; } return null; };
const ALLIES = ALLY_LIST.map(a => {
  const name = a.squad || a.cast;
  const def = a.squad && (squadDef(name) || { name, role: a.role, ...a.guest });
  const R = def && ROLE[def.role];
  return { id: slug(name), name, tab: 'allies', kind: a.squad ? 'squad' : 'cast', ally: true, def, kicker: a.kicker, lore: a.lore,
    weapons: R ? R.weapons : null, field: R ? R.field : null, tips: a.squad ? SQUAD_TIPS : null };
});

export const CODEX = [...TROOPS, ...DUELISTS, ...BOSSES, ...ALLIES];
export const CODEX_BY_ID = Object.fromEntries(CODEX.map(e => [e.id, e]));
export const BOSS_ENTRY = { sith: 'vexis', mando: 'magistrate' };

// the elite traits (data/enemies.js ELITES) as the preview's looks name them
export const ELITE_NOTES = { swift: 'faster', vital: 'tougher', volatile: 'explodes when it dies' };

// the ally entry for a squadmate or a story figure, by name
export const allyEntry = (name) => (name && ALLIES.find(a => a.name === name)) || null;
// the named entry a duel's foe is: by its name, then the type it fights as, then the mission (two foes share a name)
export function namedEntry(name, foe, mid){
  let c = DUELISTS.filter(e => e.name === name);
  if (foe && c.some(e => e.foe === foe)) c = c.filter(e => e.foe === foe);
  if (c.length < 2) return c[0] || null;
  return c.find(e => e.mids && e.mids.includes(mid)) || c.find(e => !e.mids) || c[0];
}
