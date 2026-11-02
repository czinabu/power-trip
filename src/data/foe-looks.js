// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FOE LOOKS: the visual variants of each enemy model, so a squad of one type isn't a row of clones.

/* Every enemy MODEL (enemies/mesh.js) has a fixed POOL of looks, and each spawn wears one of them, picked by its number
   (the same on both co-op screens). A look is only skin deep: hit ranges, health, speed and AI are the type's own, so
   gameplay never changes. The pool is fixed and small so every look is baked before a fight (engine/prewarm.js).

   A look: {
     v      the unit's markings (0 plain · 1 a sergeant's pauldron · 2 veteran cheek flashes and chest bars · 3 a comms rig)
     dv     a droid's kit (B1: 1 a commander's antenna and paint · 2 a salvaged, mismatched arm; magnaguard: 1 a torn
            cloak · 2 no cowl, a painted skull)
     fem    a woman's build: narrower shoulders and waist, a contoured cuirass, a touch shorter
     bare   helmet OFF (clipped to the belt) and a face: skin, hair, style, beard (enemies/detail.js face)
     hat    on a bare head: 'goggles' pushed up on the brow, or a cloth 'band'
     cap    the officer's peaked cap (false: bare-headed, hair combed back)
   }

   Per model below: n, the pool size; fem, the share of women; bare, the share with the helmet off (only where it fits
   the troops: purge troopers, lancers and jet troopers keep their helmets on); carry, the helmet hung on the belt;
   hats, what a bare head may wear. Clones (the squad, the turned company) all wear one face, and keep theirs. */
export const FOE_LOOKS = {
  storm:     { n: 10, fem: 0.4, bare: 0.3, carry: 'storm' },                          // blaster trooper
  purge:     { n: 8,  fem: 0.4 },                                                     // grunt
  heavy:     { n: 8,  fem: 0.25, bare: 0.25, carry: 'heavy', rough: true },          // brute
  jet:       { n: 8,  fem: 0.4 },                                                     // flyer
  riot:      { n: 8,  fem: 0.4, bare: 0.25, carry: 'riot' },                          // phalanx
  scout:     { n: 8,  fem: 0.4, bare: 0.25, carry: 'scout', hats: ['goggles'] },      // sniper
  grenadier: { n: 10, fem: 0.4, bare: 0.3, carry: 'storm', hats: ['goggles', 'band', null] },
  lancer:    { n: 8,  fem: 0.4 },
  officer:   { n: 10, fem: 0.45, face: true, cap: 0.7 },                              // always a face
  b1:        { n: 3,  droid: true },                                                  // bomber
  magna:     { n: 3,  droid: true },                                                  // duelist
};

// skin tones, light to dark, and hair colours (black, browns, auburn, blond, grey)
export const SKINS = [0xe2bea0, 0xcfa282, 0xb88a6a, 0x9c7a62, 0x82604a, 0x6e4a36, 0x553828, 0x3e2a20];
export const HAIRS = [0x120c08, 0x2a2018, 0x4a3220, 0x6a4a2c, 0x7a3a1e, 0xa88a5a, 0x7c7a76];
const MEN = ['crop', 'buzz', 'part', 'bald', 'crop', 'buzz'];
const WOMEN = ['bun', 'ponytail', 'braid', 'crop', 'bun', 'part'];
const BEARDS = [null, 'stubble', null, 'goatee', null, 'full'];
const CAPPED = { bun: 'bun', ponytail: 'bun', braid: 'bun', long: 'bun' };   // long hair pinned up under an officer's cap

// a fixed little generator, so the pool is the same on every run and every screen
const gen = seed => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; };
// spread k of n slots evenly (so "40% women" is 4 of 10, never 0 or 10 by chance)
const spread = (n, k, off = 0) => { const s = new Set(); for (let i = 0; i < k; i++) s.add((Math.floor((i + 0.5) * n / k) + off) % n); return s; };

const _pools = {};
export function lookPool(model){
  if (_pools[model] !== undefined) return _pools[model];
  const P = FOE_LOOKS[model];
  if (!P) return (_pools[model] = null);
  if (P.droid) return (_pools[model] = Array.from({ length: P.n }, (_, dv) => ({ v: 0, dv })));
  const r = gen([...model].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
  const n = P.n, women = spread(n, Math.round(n * P.fem)), bare = P.face ? null : spread(n, Math.round(n * (P.bare || 0)), 1);
  const capped = P.face ? spread(n, Math.round(n * P.cap), 2) : null;
  const pool = [];
  let mark = 0, fi = 0, mi = 0;
  for (let i = 0; i < n; i++){
    const fem = women.has(i), L = { v: 0, fem };
    const faced = P.face || bare.has(i);
    if (!faced) L.v = [0, 1, 0, 2, 3][mark++ % 5];   // helmeted: the markings, plain most often
    if (faced){
      const skin = SKINS[(i * 3 + Math.floor(r() * 3)) % SKINS.length];
      const old = P.rough && r() < 0.4;
      let hair = HAIRS[Math.floor(r() * (HAIRS.length - 1))];
      if (old) hair = HAIRS[HAIRS.length - 1];
      let style = fem ? WOMEN[fi++ % WOMEN.length] : MEN[mi++ % MEN.length];
      const beard = !fem ? (P.rough ? ['full', 'stubble', 'goatee'][i % 3] : BEARDS[(i + Math.floor(r() * 2)) % BEARDS.length]) : null;
      if (P.face){ L.cap = capped.has(i); if (L.cap && CAPPED[style]) style = CAPPED[style]; }
      else L.bare = true;
      L.face = { skin, hair, style, fem, ...(beard ? { beard } : {}), ...(P.rough && i % 2 ? { scar: true } : {}) };
      if (P.hats && !P.face) L.hat = P.hats[Math.floor(r() * P.hats.length)] || null;
    }
    pool.push(L);
  }
  return (_pools[model] = pool);
}

// a short, stable key for a look (it names the bake: enemies/kit.js caches one model per look)
export function lookKey(L){
  if (!L) return '';
  const F = L.face;
  return ':v' + (L.v || 0) + (L.dv ? 'd' + L.dv : '') + (L.fem ? 'f' : '') + (L.bare ? 'b' : '') + (L.cap === false ? 'n' : '') + (L.hat ? ':' + L.hat : '')
    + (F ? ':' + [F.skin.toString(16), F.hair.toString(16), F.style, F.beard || '', F.scar ? 's' : ''].join('.') : '');
}
