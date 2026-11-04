// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FORM BALANCE — prints each lightsaber form's raw numbers from data/stances.js: damage a second (dmg × speed), the same
// on armour (× heavyDmg), stamina a second, damage per stamina and the swing's arc. Run: node tools/form-balance.mjs
// (Each form's own edge, such as Makashi's +40% on blades or Juyo's fury, comes on top: see the BALANCE note there.)
import { readFileSync } from 'fs';

const src = readFileSync(new URL('../src/data/stances.js', import.meta.url), 'utf8');
const re = /^\s{2}(\w+):\s*\{ name: '[^']+'[\s\S]*?dmg: ([\d.]+), heavyDmg: ([\d.]+), speed: ([\d.]+), knock: [\d.]+, stamina: (\d+)[\s\S]*?radiusMult: ([\d.]+)([\s\S]*?)syn:/gm;
// FORM MASTERY (data/force-level.js FORM_MASTERY): the same numbers with a form at Master, in the last two columns
const fl = readFileSync(new URL('../src/data/force-level.js', import.meta.url), 'utf8');
const master = {};
for (const [, id, body] of fl.matchAll(/^\s{2}(\w+):\s*\{ sig:[\s\S]*?master: \{([^}]*)\}/gm))
  master[id] = Object.fromEntries([...body.matchAll(/(\w+): ([\d.]+)/g)].map(([, k, v]) => [k, +v]));
console.log('form       dps  armour  stam/s  dmg/stam  arc   M:dps  M:armour');
// (Jar'Kai's off-hand follow-up adds offDmg of the lead cut, on the same foe: counted in)
for (const [, id, d0, h, s, st, r, rest] of src.matchAll(re)){
  const off = /offDmg: ([\d.]+)/.exec(rest), d = d0 * (1 + (off ? +off[1] : 0));
  const M = master[id] || {}, md = (M.dmg || +d0) * (1 + (M.offDmg != null ? M.offDmg : off ? +off[1] : 0)), mh = M.heavyDmg || +h;
  console.log(id.padEnd(9), (d * s).toFixed(2).padStart(5), (h * d * s).toFixed(2).padStart(7), (st * s).toFixed(1).padStart(7),
              (d / st).toFixed(3).padStart(9), r.padStart(5), (md * s).toFixed(2).padStart(7), (mh * md * s).toFixed(2).padStart(9));
}
