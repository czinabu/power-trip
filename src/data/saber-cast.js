// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SABER CAST: how each lightsaber wielder the hero meets looks (enemies/saberist.js builds them). Edit freely.
//
// Every saber NPC is built on the Sith acolyte's body and fights by its type's numbers; this file only dresses it.
//   · NAMED CHARACTERS (CAST, by the name on their duel banner): their own face, hair, build and clothes, the same in
//     the duel, its entrance and escape scenes, the chase and on a co-op partner's screen. MISSION_CAST gives a name a
//     different look in one mission (two different Wardens).
//   · THE RANK AND FILE (ACOLYTES): a Sith acolyte in a wave gets one of these faces, picked by its number (the same
//     on both co-op screens), so no two in a crowd look alike.
//
// FRIEND OR FOE AT A GLANCE (SIDES): the Jedi wear the Order's undyed cream, tan and brown, bare-faced, hoods down, and
// keep their form's blade colour. The Empire's blades wear black and charcoal with blood-red trim, gold Sith eyes,
// masks and raised hoods, and burn red.
//
// A look:
//   side     'jedi' | 'sith' | 'inq' (an Inquisitor: armour over the robes) | 'echo' (a vision from the Sith gate)
//   build    'm' | 'f' — shoulders, chest, waist and height. `w` widens or narrows the frame on top (1 = the usual)
//   height   × the figure's height on top of the build's
//   face     skin, hair (colour), style (bald, buzz, crop, part, long, ponytail, bun, topknot, braid), beard (stubble,
//            goatee, full), beardC (its colour, else the hair's), eyes (the iris), lip, marks (face tattoos: their colour), markStyle
//            ('bars' | 'diamonds' | 'lines'), scar, horns (a horn crown, its colour), void (a face of shadow), sith
//            (gold Sith eyes, lit: they flare as it winds up), eyeC (their colour)
//   mask     'half' (a rebreather over the mouth and jaw) | 'helm' (the full Inquisitor helm)
//   hood     true: the hood is up (else it lies on the shoulders, if the look has a cloak)
//   cloak    true: a long cloak from the shoulders (a hood comes with it)
//   armour   'inq' (Inquisitor plates and pauldrons) | 'general' (a Jedi general's breastplate and one pauldron)
//   colors   over the side's palette: tunic (the main layer), tabard, under (trousers, gloves), cloak, belt, trim
//   blade    the blade's colour (else its form's, else the type's red)

const RED = 0xff2a36;

// each side's clothes; a look's own `colors` go on top
export const SIDES = {
  jedi: { tunic: 0xcdb791, tabard: 0x8a6440, under: 0x5a4330, cloak: 0x5a3d26, belt: 0x3a2616, trim: 0x6e4a2a, glove: 0x4a3424 },
  sith: { tunic: 0x18161b, tabard: 0x0d0c0f, under: 0x0e0d10, cloak: 0x130d10, belt: 0x18120f, trim: 0x8e1a20, glove: 0x0e0d10, blade: RED },
  inq:  { tunic: 0x141417, tabard: 0x24242a, under: 0x0d0d10, cloak: 0x100c10, belt: 0x18120f, trim: 0xa01a22, glove: 0x0c0c0f, blade: RED },
  echo: { tunic: 0x241c38, tabard: 0x161026, under: 0x0e0a18, cloak: 0x150f26, belt: 0x120c1c, trim: 0x8a5aff, glove: 0x0c0814, blade: 0xb24bff },
};

// ILSA VENN: the hero's oldest friend; under the Inquisitor's mask from the night the temple falls
const ILSA_FACE = { skin: 0xdaa888, hair: 0x6a2c16, style: 'ponytail', lip: 0xa8645a, eyes: 0x3e6a44 };

export const CAST = {
  // ---- the Jedi ----
  'ILSA VENN':   { side: 'jedi', build: 'f', face: ILSA_FACE, colors: { trim: 0x3a5a8a } },
  'THE WALL':    { side: 'jedi', build: 'm', w: 1.1, face: { skin: 0x74503a, hair: 0x6e6862, style: 'bald', beard: 'full' },
                   cloak: true, colors: { cloak: 0x4a3422, tabard: 0x6e4e30 } },                      // Tarn Odo
  'SERA QUILL':  { side: 'jedi', build: 'f', w: 0.95, face: { skin: 0x9a7350, hair: 0x140e0a, style: 'braid', marks: 0x24365e, markStyle: 'diamonds', lip: 0x7a4a3c },
                   colors: { tunic: 0xa49c8c, tabard: 0x5a5448, under: 0x3a3832, trim: 0x2e8a62 } },      // straight out of a prison cell
  'THE KNIGHT':  { side: 'jedi', build: 'f', w: 1.02, height: 1.02, face: { skin: 0xc49a7c, hair: 0x8a8478, style: 'bun', scar: true, lip: 0x9a6458, eyes: 0x4a6a80 },
                   armour: 'general', cloak: true, colors: { cloak: 0x6a5642, trim: 0xb8962e } },        // General Rhenna Kast, in Hoth gear
  // the ARC trooper's Hoth chapter: a Jedi fighting beside the squad (a squadmate whose def names this look: data/allies.js)
  'MASTER IRO':  { side: 'jedi', build: 'm', w: 1.02, face: { skin: 0xb07a56, hair: 0x2a2018, style: 'topknot', beard: 'goatee', eyes: 0x5a3a20 },
                   cloak: true, colors: { cloak: 0x5a4632, trim: 0x2e8a52 }, blade: 0x3aff8c },
  // ---- the Empire's blades ----
  'THE INQUISITOR':   { side: 'inq', build: 'f', face: { ...ILSA_FACE, sith: true }, mask: 'half', armour: 'inq', cloak: true },   // Ilsa, masked
  'THE SEVENTH BLADE': { side: 'inq', build: 'f', face: ILSA_FACE, armour: 'inq', cloak: true },     // Ilsa again, the mask gone
  'THE WARDEN':  { side: 'inq', build: 'm', w: 1.06, face: { skin: 0xb88a6a, hair: 0x6a6660, style: 'buzz', beard: 'stubble', scar: true, sith: true }, armour: 'inq' },
  'THE GRAND INQUISITOR': { side: 'inq', build: 'm', w: 1.04, height: 1.04, face: { skin: 0xa8a49e, hair: 0x101010, style: 'bald', sith: true },
                   mask: 'helm', armour: 'inq', cloak: true, colors: { trim: 0xc01c24 } },
  'THE ECHO':    { side: 'echo', build: 'm', face: { skin: 0x0c0a12, hair: 0x0c0a12, style: 'bald', void: true, sith: true, eyeC: 0xc49aff }, cloak: true, hood: true },
};
// the Jedi's sparring blade, and the masters' (Ataru's acrobat), share the names other stories give them
CAST['THE ACROBAT'] = CAST['SERA QUILL'];

// a name with a different look in one mission (mission id: name: look)
export const MISSION_CAST = {
  // the Warden at the Citadel gate on Exegol is a different hunter from the pens' jailer
  strike: { 'THE WARDEN': { side: 'sith', build: 'm', w: 1.04, face: { skin: 0xa0503c, hair: 0x140e0a, style: 'bald', horns: 0xd8c8a8, marks: 0x0e0a0a, markStyle: 'lines', sith: true },
                            armour: 'inq', cloak: true, hood: true } },
};

// the rank and file: Sith acolytes in the waves, picked by the foe's number. All of them Sith-eyed, on the Sith side
export const ACOLYTES = [
  { build: 'm', face: { skin: 0x9c7a62, hair: 0x2a2018, style: 'crop', beard: 'stubble' } },
  { build: 'f', face: { skin: 0xc49a7c, hair: 0x140e0a, style: 'bun', lip: 0x9a5a50 }, hood: true },
  { build: 'm', w: 1.06, face: { skin: 0x4a3226, hair: 0x0e0a08, style: 'bald', beard: 'goatee' } },
  { build: 'f', face: { skin: 0x6e4a36, hair: 0x140e0a, style: 'long', lip: 0x6a3a30 } },
  { build: 'm', face: { skin: 0xb06a52, hair: 0x140e0a, style: 'bald', horns: 0xd0c0a0, marks: 0x1a0c0c, markStyle: 'lines' }, hood: true },
  { build: 'f', face: { skin: 0xe0b898, hair: 0xd8d4cc, style: 'ponytail', lip: 0xa8645a, scar: true } },
  { build: 'm', face: { skin: 0xb88a6a, hair: 0x5a4026, style: 'part', beard: 'full' }, hood: true },
  { build: 'f', w: 0.95, face: { skin: 0x8a5a40, hair: 0x2a2018, style: 'buzz', marks: 0x2a0e12, markStyle: 'bars' } },
].map(a => ({ side: 'sith', cloak: true, ...a, face: { sith: true, ...a.face } }));

// the look for a duel foe or a cutscene figure (spec: { foe, name } and the mission's id), or null to keep its type's
export function castLook(name, mid){
  if (!name) return null;
  return (mid && MISSION_CAST[mid] && MISSION_CAST[mid][name]) || CAST[name] || null;
}
// the look's id: what a co-op guest is sent and the bake is cached by ('name' or 'mid:name')
export function castId(name, mid){
  if (!name) return '';
  if (mid && MISSION_CAST[mid] && MISSION_CAST[mid][name]) return mid + ':' + name;
  return CAST[name] ? name : '';
}
export function lookById(id){
  if (!id) return null;
  const i = id.indexOf(':');
  return i > 0 ? castLook(id.slice(i + 1), id.slice(0, i)) : CAST[id] || null;
}
// every named look's id (engine/prewarm.js bakes them all before play)
export const CAST_IDS = [...Object.keys(CAST), ...Object.entries(MISSION_CAST).flatMap(([m, o]) => Object.keys(o).map(n => m + ':' + n))];
// the side's palette with the look's own colours over it, and its blade
export function lookColors(L){ return { ...SIDES[L.side] || SIDES.sith, ...L.colors }; }
// the blade it burns: its own, else its side's (red for the Empire), else the Order's blue
export const lookBlade = L => L.blade ?? (SIDES[L.side] || {}).blade ?? 0x4a86ff;
// a form master's blade (game/mission.js, a cutscene figure, a co-op puppet): a Jedi keeps the form's colour, an enemy
// burns its own (an enemy master's blade still reads as an enemy's)
export const masterBlade = (L, formBlade) => L ? (L.side === 'jedi' && formBlade != null ? formBlade : lookBlade(L)) : formBlade;
