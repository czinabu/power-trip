// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SECRETS ON THE STORY MAPS: hidden holocrons, crystal caves and meditation spots, tucked into the quiet corners of the maps
// the stories, missions, arcade and side missions play on. game/secrets.js places and runs them, ui/codex-ui.js shows the
// holocrons' pages. Edit the words freely.
//
// WHAT EACH ONE GIVES (once per hero: your profile keeps what you found, game/profile.js, so a find outlives every run)
//   holocron   a page in the codex's HOLOCRONS tab, and rank XP. Four found open the Holocron pommel on the workbench
//   cave       a kyber shard and rank XP. Three harvested open the Amethyst crystal (the Mando and the trooper take the XP)
//   meditate   sit still in the circle for a few seconds with no foe near: rank XP the first time, and every time after it
//              restores your health and Force (once per visit to the map)
//
// WHERE: each map (a level's `layout`) lists the kinds hidden on it. A spot is not set by hand: as the map loads,
// game/secrets.js walks it out from where you start and picks reachable, out-of-the-way corners well apart (next to a
// wall or a rock, far from the start), so the secrets stay hidden on every map, and a map's layout can change without
// stranding one inside a wall. `holocron` names the page it opens (HOLOCRONS below).

export const SECRET_KINDS = {
  holocron: { name: 'HOLOCRON', verb: 'TAKE THE HOLOCRON', col: 0x7fd8ff, found: 'HOLOCRON FOUND' },
  cave: { name: 'CRYSTAL CAVE', verb: 'HARVEST THE CRYSTAL', col: 0xb88aff, found: 'KYBER SHARD' },
  meditate: { name: 'MEDITATION SPOT', verb: 'MEDITATE', col: 0xffe2a0, found: 'AT PEACE' },
};
export const SECRET_TUNE = {
  reach: 2.4,        // m: close enough to use it
  sense: 16,         // m: close enough to hear it hum (a soft chime the first time you come this close)
  sit: 3.2,          // s: a meditation's length
  calm: 12,          // m: no foe this close to sit
  spread: 0.42,      // two secrets on a map stand at least this share of the map's width apart
  fromStart: 0.45,   // ...and this share of it from where you start
};

// the maps, by layout: the kinds hidden on each. A holocron's value is the page it opens
export const SECRET_MAPS = {
  refuge:     { holocron: 'holo-refuge', meditate: true },
  outpost:    { cave: true, meditate: true },
  covert:     { holocron: 'holo-covert', cave: true },
  archive:    { holocron: 'holo-archive', meditate: true },
  temple:     { cave: true, meditate: true },
  foundry:    { holocron: 'holo-foundry', cave: true },
  barge:      { meditate: true },
  holdfast:   { holocron: 'holo-holdfast', cave: true, meditate: true },
  grassland:  { holocron: 'holo-grassland', cave: true, meditate: true },
  pursuit:    { cave: true, meditate: true },
  icefront:   { holocron: 'holo-icefront', cave: true },
  graveyard:  { holocron: 'holo-graveyard', cave: true, meditate: true },
  pens:       { holocron: 'holo-pens', meditate: true },
  dojo:       { meditate: true },
  jedhaNight: { holocron: 'holo-jedha', cave: true, meditate: true },
  sith:       { holocron: 'holo-exegol' },
  jungle:     { holocron: 'holo-jungle', cave: true, meditate: true },
  garrison:   { meditate: true },
  frigate:    { cave: true },
  kamino:     { holocron: 'holo-kamino', meditate: true },
  chipworks:  { cave: true },
  warcamp:    { meditate: true },
  canyon:     { cave: true, meditate: true },
  relay:      { meditate: true },
  prison:     { cave: true },
  hangar:     { meditate: true },
  approach:   { cave: true },
  meltworks:  { cave: true, meditate: true },
  ironroad:   { meditate: true },
};

// THE HOLOCRONS' PAGES (the codex's HOLOCRONS tab): who left it, and what it says. `lines` are the recording's own words
export const HOLOCRONS = [
  { id: 'holo-refuge', name: 'THE KEEPER\'S RECORD', kicker: 'THE HIDDEN REFUGE',
    lore: 'Left by whoever kept the refuge before Vael: a list of every ship that ever slipped out of it.',
    lines: ['Forty-one ships, and none of them came back for us. That is how it should be.', 'If you are hearing this, the refuge was found. Do not try to save the stones.'] },
  { id: 'holo-covert', name: 'A FOUNDLING\'S HOLOCRON', kicker: 'THE COVERT',
    lore: 'A Jedi holocron the covert kept in its forge for thirty years, and never opened.',
    lines: ['The child you took in has the Force. Teach it the Way and it will still find us.', 'We were never so different. We both raised other people\'s children.'] },
  { id: 'holo-archive', name: 'THE ARCHIVIST\'S HOLOCRON', kicker: 'THE BURNING ARCHIVE',
    lore: 'An archivist\'s private notes, hidden away from the Ledger\'s vault.',
    lines: ['The Ledger is a list of children. Never forget that it is also a list of targets.', 'Burn it if you must. The names are written somewhere it cannot burn.'] },
  { id: 'holo-foundry', name: 'THE FORGE MASTER\'S HOLOCRON', kicker: 'THE FOUNDRIES',
    lore: 'A Jedi smith\'s record of every hilt they built for a Padawan.',
    lines: ['A hilt is not a weapon. It is a promise, made in metal, that you will be careful.', 'Build it to fit your hand, not your enemy.'] },
  { id: 'holo-holdfast', name: 'THE WARDEN\'S HOLOCRON', kicker: 'THE OLD HOLDFAST',
    lore: 'From the forest shrine the holdfast was built round, long before the Mandalorians came.',
    lines: ['The trees here remember a war older than the Republic. Listen to them.', 'A fort is only a wall. What it keeps is what matters.'] },
  { id: 'holo-grassland', name: 'A GENERAL\'S HOLOCRON', kicker: 'THE GRASS SEA OF LOTHAL',
    lore: 'A Jedi general\'s battle log, dropped in the grass and never picked up.',
    lines: ['We won the field and lost the company. I do not know how to call that a victory.', 'Every clone under me had a name. I made them tell me.'] },
  { id: 'holo-icefront', name: 'THE ENCLAVE\'S HOLOCRON', kicker: 'THE ICE FRONT ON HOTH',
    lore: 'Sealed in the trenches by the enclave under the ice, to be found by the right hands.',
    lines: ['Forty children, and the cold keeps them hidden better than any Jedi could.', 'If the line falls, take them deeper. Never up.'] },
  { id: 'holo-graveyard', name: 'THE SALVAGER\'S HOLOCRON', kicker: 'THE STARSHIP GRAVEYARD OF JAKKU',
    lore: 'Pulled from a wreck in the sand: an old Jedi cruiser\'s last log.',
    lines: ['The ship is dying. The crystals in her engines are singing. I never knew they could.', 'Someone will dig this up. Be kinder than we were.'] },
  { id: 'holo-pens', name: 'THE PRISONER\'S HOLOCRON', kicker: 'THE PENS ON TESSARIL',
    lore: 'Smuggled into a cell and hidden in the wall by a Jedi the Inquisitors never broke.',
    lines: ['They took my saber. They did not take the forms. I practise them in the dark.', 'To the children in the next cells: I can hear you. You are not alone.'] },
  { id: 'holo-jedha', name: 'THE GATEKEEPER\'S HOLOCRON', kicker: 'THE BURNED TEMPLE ON JEDHA',
    lore: 'Left beside the seals by the Jedi who set them, centuries ago.',
    lines: ['What is under this temple does not sleep. It waits.', 'If the seals break, do not go through alone. Nobody who did came back the same.'] },
  { id: 'holo-exegol', name: 'A SITH HOLOCRON', kicker: 'THE CITADEL ON EXEGOL',
    lore: 'A red, cold thing that whispers. It was never meant for you to hear.',
    lines: ['Peace is a lie. There is only the next fight, and the one after.', 'You hesitate. That is why you will lose.'] },
  { id: 'holo-jungle', name: 'THE NIGHT\'S HOLOCRON', kicker: 'THE NIGHT OF THE ORDER',
    lore: 'Recorded in the jungle on the night the order came, by a Master who saw it coming.',
    lines: ['My troopers are turning their rifles on me, and they are crying. Remember that it was not them.', 'Run, Padawan. Live. That is the last thing I will teach you.'] },
  { id: 'holo-kamino', name: 'THE DROWNED HOLOCRON', kicker: 'TIPOCA CITY ON KAMINO',
    lore: 'A Jedi\'s notes on the clone army, from the war\'s first year.',
    lines: ['They are kind, and brave, and they were grown to die. I cannot make the Council hear me.', 'There is something in their heads. I could not find out what.'] },
];
