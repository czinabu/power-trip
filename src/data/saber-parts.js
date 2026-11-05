// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SABER WORKBENCH, as data: the Jedi's kyber crystals, hilts, emitters and pommels, where each one is earned, and what a
// crystal's ATTUNEMENT does. Edit the words and numbers freely. ui/customizer.js shows the bench (the customizer's SABER
// tab), player/model/hilt.js builds the parts, game/saber-bench.js attunes the run, game/profile.js hands parts out.
//
// PARTS ARE EARNED, AND KEPT. `earn` reads the hero's persistent profile (game/profile.js, not a save slot), so a part
// outlives every run and NEW GAME. One ask per part:
//   { chapter: '<id>' }  that chapter of the Jedi's campaign cleared (the trials: trial-first / -acrobat / -knight)
//   { won: 1 }           the campaign beaten
//   { duels: n }         n guarding duellists beaten, in any mode that's a real fight
//   { missions: n }      n different story missions won from the Missions page (side content)
//   { arcade: n }        n arcade contracts won
//   { waves: n }         n survival waves cleared
//   { revives: n }       n squadmates got up by your own hand (the trooper's squad)
//   { squadWaves: n }    n survival waves cleared with the whole squad still standing
// No `earn`: a starter part, on the bench from the first day. A part that is earned is announced once: a card at a
// chapter's close, a corner note anywhere else.
//
// ATTUNEMENT, THE GUARDRAIL: every crystal but the form's own gives ONE small sidegrade and pays for it elsewhere, never a
// straight gain. `fx` lists the changes to player.up as [field, op, value] (op '*' multiplies, '+' adds), so the bench can
// take one crystal's attunement off and put another's on cleanly. Keep each gain at or under ATTUNE_CAP and its cost at
// least two thirds of the gain's size, so no crystal is a must-have in a duel, a boss or on Brutal. Hilts, emitters and
// pommels are looks only: what you build is how the saber reads, never how hard it hits.
//
// No imports on purpose: data/customize.js, game/wardrobe.js and the model all read this while the modules load.

export const ATTUNE_CAP = { mul: 0.12, parry: 0.02 };   // the most any one crystal's gain may be (a ×1.12, or +0.02s)

// the LIGHTSABER row's options (data/customize.js `saber`): ids are the saved picks', so a renamed crystal keeps its owners
export const CRYSTALS = [
  { id: 'form', name: 'Form colour', att: 'UNATTUNED', ds: 'The blade burns your form\'s own colour. No sidegrade.', fx: [] },
  { id: 'white', name: 'Purified', col: 0xf0f4ff, earn: { chapter: 'trial-first' }, att: 'STILL HAND',
    ds: '+0.02s parry window · −5% damage', fx: [['parry', '+', 0.02], ['dmg', '*', 0.95]] },
  { id: 'cyan', name: 'Teal', col: 0x2affe0, earn: { chapter: 'trial-acrobat' }, att: 'QUICKSILVER',
    ds: '−12% dash cooldown · blocks cost 8% more stamina', fx: [['dashCdMult', '*', 0.88], ['blockStam', '*', 1.08]] },
  { id: 'yellow', name: 'Yellow', col: 0xffd23a, earn: { chapter: 'trial-knight' }, att: 'SENTINEL\'S CALM',
    ds: '+10% Force regen · −5% attack speed', fx: [['forceRegen', '*', 1.1], ['atkSpeed', '*', 0.95]] },
  { id: 'orange', name: 'Orange', col: 0xff8a2a, earn: { chapter: 'spearhead' }, att: 'EMBER',
    ds: '+6% attack speed · −8% Force regen', fx: [['atkSpeed', '*', 1.06], ['forceRegen', '*', 0.92]] },
  { id: 'rose', name: 'Rose', col: 0xff4fb8, earn: { duels: 6 }, att: 'HEARTFIRE',
    ds: '+12% riposte damage · −6% Force regen', fx: [['riposte', '*', 1.12], ['forceRegen', '*', 0.94]] },
  { id: 'frost', name: 'Frost', col: 0xbfe6ff, earn: { waves: 20 }, att: 'STILLFROST',
    ds: '+10% stamina regen · −4% move speed', fx: [['stamRegen', '*', 1.1], ['move', '*', 0.96]] },
  { id: 'red', name: 'Bled red', col: 0xff3a30, earn: { won: 1 }, att: 'BLED',
    ds: '+7% damage · −0.02s parry window', fx: [['dmg', '*', 1.07], ['parry', '+', -0.02]] },
];

// HILTS: the grip, the part the hand closes on (player/model/hilt.js BODIES draws each)
export const HILTS = [
  { id: 'apprentice', name: 'Apprentice', line: 'Built in the Refuge from salvage: plain steel, a leather wrap.' },
  { id: 'guardian', name: 'Guardian', earn: { chapter: 'trial-first' }, line: 'Black and ribbed, heavy in the hand. The Wall\'s own pattern.' },
  { id: 'sentinel', name: 'Sentinel', earn: { chapter: 'trial-acrobat' }, line: 'Slim, with long brass inlays. Made to turn in the fingers.' },
  { id: 'duelist', name: 'Duellist', earn: { duels: 3 }, line: 'A waisted grip in bronze, scored for a sure hold.' },
  { id: 'temple', name: 'Temple', earn: { missions: 2 }, line: 'Ivory and gold, as the Temple\'s Guards carried them.' },
  { id: 'exile', name: 'Exile', earn: { won: 1 }, line: 'Dark bronze bound in cloth. Carried a long way from home.' },
];
// EMITTERS: the head the blade leaves from
export const EMITTERS = [
  { id: 'plain', name: 'Collar', line: 'A plain flared collar.' },
  { id: 'shroud', name: 'Shroud', earn: { duels: 1 }, line: 'A half-shroud on the blade side, to catch a bind.' },
  { id: 'crown', name: 'Crown', earn: { chapter: 'trial-knight' }, line: 'Four prongs round the blade. A Knight\'s emitter.' },
  { id: 'bell', name: 'Bell', earn: { arcade: 2 }, line: 'A wide bell mouth: the blade blooms out of it.' },
  { id: 'vented', name: 'Vented', earn: { waves: 10 }, line: 'Slotted for heat, from long nights on the line.' },
];
// POMMELS: the end below the hand
export const POMMELS = [
  { id: 'cap', name: 'Cap', line: 'A rounded end cap.' },
  { id: 'ring', name: 'Ring', earn: { missions: 1 }, line: 'A loop for a belt clip.' },
  { id: 'flanged', name: 'Flanged', earn: { arcade: 1 }, line: 'Four fins, to stop a hand sliding off.' },
  { id: 'weighted', name: 'Weighted', earn: { chapter: 'hoth' }, line: 'A heavy ball to balance the blade.' },
  { id: 'spike', name: 'Spike', earn: { duels: 10 }, line: 'A tapered point. A duellist\'s threat.' },
];
// the bench's rows, in order (each a row of data/customize.js's jedi list, with `bench: true`)
export const BENCH = [
  { id: 'saber', label: 'KYBER CRYSTAL', parts: CRYSTALS },
  { id: 'hilt', label: 'HILT', parts: HILTS },
  { id: 'emitter', label: 'EMITTER', parts: EMITTERS },
  { id: 'pommel', label: 'POMMEL', parts: POMMELS },
];
export const crystalOf = (id) => CRYSTALS.find(c => c.id === id) || CRYSTALS[0];

/* ---------- earning: read from a hero's profile record (game/profile.js blank()) ---------- */
// how far the profile is along an ask: { have, need }
export function earnProgress(p, earn){
  if (!earn) return { have: 1, need: 1 };
  p = p || {};
  if (earn.chapter) return { have: p.cleared && p.cleared[earn.chapter] ? 1 : 0, need: 1 };
  if (earn.won) return { have: Math.min(1, p.won || 0), need: 1 };
  if (earn.missions) return { have: Object.keys(p.missions || {}).length, need: earn.missions };
  for (const k of ['duels', 'arcade', 'waves', 'revives', 'squadWaves']) if (earn[k]) return { have: p[k] || 0, need: earn[k] };
  return { have: 0, need: 1 };
}
export const partEarned = (p, earn) => { const e = earnProgress(p, earn); return e.have >= e.need; };
// where a part is earned, in words (the bench's locked tip and the profile): chapterName names a chapter id
export function earnText(earn, chapterName = (id) => id.toUpperCase()){
  if (!earn) return 'ON THE BENCH FROM THE START';
  if (earn.chapter) return 'CLEAR ' + chapterName(earn.chapter);
  if (earn.won) return 'BEAT THE CAMPAIGN';
  const n = earn.duels || earn.missions || earn.arcade || earn.waves || earn.revives || earn.squadWaves, s = n === 1 ? '' : 'S';
  if (earn.revives) return 'GET ' + n + ' SQUADMATE' + s + ' BACK UP';
  if (earn.squadWaves) return 'CLEAR ' + n + ' SURVIVAL WAVE' + s + ' WITH THE SQUAD STANDING';
  if (earn.duels) return 'BEAT ' + n + ' DUELLIST' + s;
  if (earn.missions) return 'WIN ' + n + ' STORY MISSION' + s;
  if (earn.arcade) return 'WIN ' + n + ' ARCADE CONTRACT' + s;
  return 'CLEAR ' + n + ' SURVIVAL WAVE' + s;
}
// every earnable part, as [row id, part] (game/profile.js announces each once)
export const EARNABLE = BENCH.flatMap(r => r.parts.filter(p => p.earn).map(p => [r.id, p]));
