// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE STORY'S CAST, as figures in the cutscenes (game/cast.js builds them, game/cutscene.js stages them). Edit freely.
//
// Each name is the speaker's name as the story's lines write it ('MASTER VAEL', 'THE ARMORER'…). A figure is one of
//   hero   a hero-model figure (player/model): `as` 'jedi' (robes and a face: Jedi, and anyone in plain clothes) or
//          'mando' (beskar), dressed by `look` (a partial look: player/model/appearance.js, the customizer's options)
//   foe    a trooper-model figure (enemies/mesh.js MODELS): `t` { model, color, eye, cloth } and `variant` (4: bare-headed)
//   boss   the campaign boss's own model (boss/mesh.js): `kind` 'sith' or 'mando'
// `scale` sizes it (a child is about 0.62), `saber` hangs a hilt at its belt (a Jedi), `bound` looks for a squadmate
// already on the field by that name first (the trooper's band, the Mandalorian on Jakku) instead of building a stand-in.
// Names the lines use that aren't here (the hero's 'YOU', a stranger) stay off screen: their lines play over comms.

const jedi = (look, o = {}) => ({ kind: 'hero', as: 'jedi', look: { jedi: look }, saber: true, ...o });
const mando = (look, o = {}) => ({ kind: 'hero', as: 'mando', look: { mando: look }, ...o });
const civ = (look, o = {}) => ({ kind: 'hero', as: 'jedi', look: { jedi: look }, ...o });   // plain clothes: the robe, no hilt
const clone = (cloth, o = {}) => ({ kind: 'foe', t: { model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth }, ...o });

export const CAST = {
  // ---------------- the Jedi's story ----------------
  'MASTER VAEL': jedi({ parts: { hair: 'long', beard: 'full' }, palette: { skin: 0xc58c64, hair: 0xd8d4cc, robe: 0x3b2a1e, tabard: 0x6b4f37, tunic: 0xd2c4a2 }, build: { bulk: 0.95 } }),
  'ILSA VENN': jedi({ parts: { hair: 'braid' }, palette: { skin: 0xe0ac86, hair: 0x6a2c16, eyes: 0x2f5a34, robe: 0x17161b, tabard: 0x2c2a31, tunic: 0x6e6a66 }, build: { bulk: 0.9, shoulders: 0.94 } }),
  'TARN ODO': jedi({ parts: { hair: 'bald', beard: 'stubble' }, palette: { skin: 0x3f261a, robe: 0x24331f, tabard: 0x3e5236, tunic: 0x9c7d58 }, build: { bulk: 1.12, shoulders: 1.08 } }, { scale: 1.06 }),
  'SERA QUILL': jedi({ parts: { hair: 'topknot' }, palette: { skin: 0x8aa66a, hair: 0x140e0a, robe: 0x8c7656, tabard: 0xb39d78, tunic: 0xe6e2d8 }, build: { bulk: 0.9, shoulders: 0.94 } }),
  'GENERAL KAST': jedi({ parts: { hair: 'short' }, palette: { skin: 0x8a5536, hair: 0x85817c, robe: 0x4a4b50, tabard: 0x6b6c72, tunic: 0x2e2a28 } }),
  'CAPTAIN DACE': jedi({ parts: { hair: 'short', beard: 'moustache' }, palette: { skin: 0xf1c9a5, hair: 0xb89656, robe: 0x1e2a4a, tabard: 0x34466e } }),
  'THE MANDALORIAN': mando({ parts: { helmet: 'clean', cape: 'full' }, palette: { beskar: 0x8c8f94, beskar2: 0x4a4f58, cloth: 0x3a3a3a, accent: 0x1f2126 } }, { bound: true }),
  'THE INQUISITOR': { kind: 'foe', t: { model: 'acolyte', color: 0x2a1418, eye: 0xff3a2a, cloth: 0x5a0e14 }, scale: 1.18 },
  'DARTH VEXIS': { kind: 'boss', boss: 'sith' },

  // ---------------- the Mandalorian's story ----------------
  'THE ARMORER': mando({ parts: { helmet: 'crest', arms: 'heavy', cape: 'full' }, palette: { beskar: 0xc9a24a, beskar2: 0x76664a, suit: 0x4a3a2a, cloth: 0x6a1d1a, accent: 0x1f2126 } }),
  'KAEL VARR': mando({ parts: { helmet: 'tvisor', cape: 'half' }, palette: { beskar: 0x5f6e45, beskar2: 0x7e4428, suit: 0x3c4230, cloth: 0x7b6b52 } }),
  'SKYE': mando({ parts: { helmet: 'clean', arms: 'bare', cape: 'none' }, palette: { beskar: 0x3e5f8a, beskar2: 0xaab4c0, suit: 0x222b40, accent: 0xd8dde2 }, build: { bulk: 0.92, shoulders: 0.95 } }),
  'BRAKKA': mando({ parts: { helmet: 'crest', arms: 'heavy', cape: 'half' }, palette: { beskar: 0x8a2a26, beskar2: 0x4a4f58, suit: 0x16171a, cloth: 0x1e1d20 }, build: { bulk: 1.12, shoulders: 1.08 } }, { scale: 1.06 }),
  'ROOK': civ({ parts: { hair: 'short', waist: 'panels' }, palette: { skin: 0xa86b45, hair: 0x3a2414, robe: 0x7b6b52, tabard: 0x8c7656, tunic: 0x9c7d58 }, build: { head: 1.12 } }, { scale: 0.62 }),
  'OSSIK VANE': civ({ parts: { hair: 'short', beard: 'goatee' }, palette: { skin: 0xc58c64, hair: 0x85817c, robe: 0x4a3a2a, tabard: 0x7a5c3e, tunic: 0x6e6a66 }, build: { bulk: 1.08 } }),
  'VX-7': { kind: 'foe', t: { model: 'magna', color: 0x4a5a6a, eye: 0xff4a2a, cloth: 0x2a2e34 }, scale: 1.12 },
  'THE IRON MAGISTRATE': { kind: 'boss', boss: 'mando' },

  // ---------------- the ARC trooper's story ----------------
  'THE CAPTAIN': clone(0x7a6a3a, { variant: 4 }),
  'SGT. VANT': clone(0x2f7fd6, { bound: true }),
  'BRISK': clone(0x2f7fd6, { bound: true, variant: 4 }),
  'HAMMER': clone(0x2f7fd6, { bound: true, scale: 1.06 }),
  'THE MARSHAL': { kind: 'foe', t: { model: 'clone', color: 0xdcdcd6, eye: 0xff3a2a, cloth: 0x9a7a2a }, scale: 1.12 },
  'CAPTAIN VORN': { kind: 'foe', t: { model: 'clone', color: 0x2c2e34, eye: 0xff2a2a, cloth: 0x8a1a1a }, variant: 4 },
};
