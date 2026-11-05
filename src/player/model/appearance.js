// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The LOOK: everything a character creator would change, as plain data.
//   style    — render style (styles.js): 'ink' is the game's look; 'shard' and 'forged' stay for comparison
//   parts    — one variant name per outfit slot (jedi.js / mando.js list what each slot offers)
//   palette  — colour per material name (hex); anything left out uses the default below
//   build    — proportions: bulk (limb thickness), shoulders (chest width), head (head size). Joint positions never
//              change, so animations and hitboxes stay identical whatever the build.
//   hilt     — the Jedi's saber, as the workbench built it: { body, emitter, pommel } (model/hilt.js)
//   rifle    — the trooper's DC-15, as the armory locker built it: { stock, finish } (model/weapons.js dc15)
//   seams    — the Mando's glowing armour lines (VFX can pulse these later)
// Looks are merged over DEFAULT_LOOK, so a saved look only needs what differs.

export const DEFAULT_LOOK = {
  style: 'ink',
  jedi: {
    parts: { legs: 'boots', waist: 'panels', torso: 'tunic', head: 'bald', robe: 'none', hair: 'bald', beard: 'none', arms: 'sleeves' },
    palette: {
      robe: 0x3b2a1e, tunic: 0x9c7d58, tabard: 0x6b4f37, leather: 0x23170f,
      skin: 0x5c3826, hair: 0x140e0a, eyes: 0x2a1a10, boot: 0x1a120c, trim: 0xb08a4a,
    },
    build: { bulk: 1, shoulders: 1, head: 1 },
    hilt: { body: 'apprentice', emitter: 'plain', pommel: 'cap' },   // the saber the workbench builds (model/hilt.js, data/saber-parts.js)
  },
  mando: {
    parts: { legs: 'armored', torso: 'cuirass', arms: 'pauldrons', helmet: 'tvisor', cape: 'half', jetpack: 'standard',
             signet: 'none', vambrace: 'standard', chest: 'none', helmod: 'none' },   // (the last four, and the jetpack: the BESKAR FORGE, data/beskar-forge.js)
    palette: {
      beskar: 0x9aa7b5, beskar2: 0x667381, suit: 0x2e343d, accent: 0xb84327,
      visor: 0x07090c, cloth: 0x7b6b52, strap: 0x3a2e22,
    },
    build: { bulk: 1, shoulders: 1, head: 1 },
    seams: true,
  },
  // the clone ARC trooper: Phase II plastoid with ARC gear, in the 501st's blue (model/trooper.js)
  trooper: {
    parts: { legs: 'arc', torso: 'arc', arms: 'arc', helmet: 'arc', kama: 'long', marking: 'none', hgear: 'none', backpack: 'standard' },   // (the last three: the ARMORY LOCKER)
    palette: { plate: 0xe8e8e3, grey: 0x26282c, mark: 0x2f7fd6, suit: 0x17191d, visor: 0x07090c, cloth: 0x141518, strap: 0x1d1f23 },
    build: { bulk: 1, shoulders: 1, head: 1 },
    rifle: { stock: 'skeletal', finish: 'black' },   // the DC-15 the locker builds (model/weapons.js dc15, data/trooper-locker.js)
  },
};

// sample looks: proof that the slots, palette and build all swap cleanly (the model lab can show them)
export const SAMPLE_LOOKS = {
  bearded: {
    jedi: { parts: { hair: 'long', beard: 'full' }, palette: { skin: 0xe0ac86, hair: 0x6a2c16, eyes: 0x2c5a8a } },
  },
  goatee: {
    jedi: { parts: { hair: 'topknot', beard: 'goatee' }, palette: { skin: 0xa86b45, hair: 0x140e0a } },
  },
  hooded: {
    jedi: { parts: { head: 'hood', robe: 'outer', hair: 'short', waist: 'long' }, palette: { robe: 0x2a2724, tunic: 0xc9b48f, skin: 0xc58c64 }, build: { bulk: 0.92, shoulders: 0.95 } },
    mando: { parts: { arms: 'bare', cape: 'full' }, palette: { beskar: 0x8b5a3c, beskar2: 0x4f3a2c, accent: 0x2f6b8a, cloth: 0x4a4038 }, build: { bulk: 1.12, shoulders: 1.08 } },
  },
};

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
export function mergeLook(base, over){
  const out = { ...base };
  for (const k in over) out[k] = isObj(base[k]) && isObj(over[k]) ? mergeLook(base[k], over[k]) : over[k];
  return out;
}
export const resolveLook = (look = {}) => mergeLook(DEFAULT_LOOK, look);
