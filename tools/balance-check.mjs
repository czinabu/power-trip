// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BALANCE CHECK — the persistent progression's guardrails, checked from the data (no build, no browser):
//   node tools/balance-check.mjs        (exits 1 when a rule is broken, and says which)
//
//   1. SIDEGRADES (data/saber-parts.js crystals, data/beskar-forge.js forged beskar, data/trooper-locker.js power packs):
//      ONE gain at or under ATTUNE_CAP, paid for by costs at least two thirds of its size.
//   2. THE PATHS (data/alignment.js): light and dark come in mirrored pairs, the same count, tier and ranks on each side.
//   3. NEVER A BIGGER NUMBER (data/profile.js's Force Tree and rank cards, data/alignment.js's path cards): no field a card
//      raises goes past what the run's own cards of the same tier give of that field (data/skills.js, the trooper's
//      data/trooper-progression.js), so a ranked hero's run is different, never stronger.
// It also prints each card's per-rank numbers next to its tier's own, to read by eye.
import { readFileSync } from 'node:fs';
globalThis.localStorage ??= { getItem: () => null, setItem(){}, removeItem(){} };   // (state.js reads the device's settings)

const { CRYSTALS, ATTUNE_CAP } = await import('../src/data/saber-parts.js');
const { FORGED } = await import('../src/data/beskar-forge.js');
const { POWER_PACKS } = await import('../src/data/trooper-locker.js');
const { JEDI_TREE, RANK_SKILLS } = await import('../src/data/profile.js');
const { PATH_TREE } = await import('../src/data/alignment.js');
const { player } = await import('../src/state.js');

const bad = [];
const fail = (msg) => bad.push(msg);

/* ---- 1. the sidegrades ---- */
// fields where a smaller number is the better one (a cooldown, a cost, heat, fuel burned)
const LOWER = new Set(['dashCdMult', 'blockStam', 'heatMul', 'abilityCostMul', 'fuelEff', 'reviveMul', 'squadDr']);
// fields that are an amount added (Force a parry, health a kill, max vitality), not a multiplier
const ADDED = new Set(['parry', 'dr', 'hpMax', 'maxStam', 'lifesteal', 'parryForce', 'killForce', 'guardForce', 'parryHeal', 'killHeal', 'guardHeal',
                       'squadKillHeal', 'pinKillCp', 'terror', 'braceDR', 'aim']);
// one entry's size, as the share it moves things (a parry window counts against its own cap, scaled onto the multiplier's)
function size([k, op, v]){
  if (op === '*') return { good: LOWER.has(k) ? v < 1 : v > 1, n: Math.abs(v - 1) };
  if (k === 'parry') return { good: v > 0, n: Math.abs(v) / ATTUNE_CAP.parry * ATTUNE_CAP.mul };
  return { good: v > 0, n: Math.abs(v) };   // dr: an added share
}
for (const [row, parts] of [['crystal', CRYSTALS], ['forged', FORGED], ['pack', POWER_PACKS]]){
  for (const p of parts){
    if (!p.fx || !p.fx.length) continue;
    const s = p.fx.map(size), gains = s.filter(x => x.good), costs = s.filter(x => !x.good);
    const gain = gains.reduce((a, x) => a + x.n, 0), cost = costs.reduce((a, x) => a + x.n, 0);
    if (gains.length !== 1) fail(`${row} ${p.id}: ${gains.length} gains (one only)`);
    if (gain > ATTUNE_CAP.mul + 1e-9) fail(`${row} ${p.id}: gain ${(gain * 100).toFixed(1)}% is over the cap (${ATTUNE_CAP.mul * 100}%)`);
    if (cost < gain * 2 / 3 - 1e-9) fail(`${row} ${p.id}: cost ${(cost * 100).toFixed(1)}% is under two thirds of its gain (${(gain * 100).toFixed(1)}%)`);
  }
}

/* ---- 2. the paths ---- */
for (const [hero, cards] of Object.entries(PATH_TREE)){
  for (const t of [1, 2, 3]){
    const L = cards.filter(c => c.tier === t && c.align === 'light'), D = cards.filter(c => c.tier === t && c.align === 'dark');
    if (L.length !== D.length) fail(`${hero} path tier ${t}: ${L.length} light card(s), ${D.length} dark`);
    L.forEach((c, i) => { if (D[i] && D[i].max !== c.max) fail(`${hero} path tier ${t}: ${c.id} has ${c.max} ranks, ${D[i].id} ${D[i].max}`); });
  }
}

/* ---- 3. never a bigger number ---- */
// the run's own cards come from their source (data/skills.js pulls in the renderer): each one-line card's tier and apply()
function runCards(file){
  const src = readFileSync(new URL('../src/data/' + file, import.meta.url), 'utf8'), out = [];
  for (const m of src.matchAll(/\{ ?id: ?'(\w+)',[^\n]*?tier: ?(\d),[\s\S]*?apply\(\)\{([^\n]*)\} \},/g)){
    out.push({ id: m[1], tier: +m[2], body: m[3] });
  }
  return out;
}
const fresh = () => ({ dmg: 1, forceRegen: 1, move: 1, knock: 1, parry: 0, lifesteal: 0, hpMax: 0, dashCdMult: 1, stamRegen: 1, maxStam: 0,
  atkSpeed: 1, dr: 0, blockStam: 1, riposte: 1, parryForce: 0, fireRate: 1, fuelEff: 1, flameDmg: 1, flameRange: 1, rocketDmg: 1, rocketR: 1,
  braceDR: 0, aim: 0, abilityCostMul: 1 });
// what one rank of a card does: { field: how far it moves it, as a share (positive = better) }
function effect(run){
  const up = fresh(), before = { ...up };
  const P = { up, hp: 0, stam: 0, force: 0, jet: 0, jetMax: 0 };
  const saved = player.up; player.up = up;
  try { run(P); } finally { player.up = saved; }
  const out = {};
  for (const k in up){
    const b = up[k], a = before[k] ?? (ADDED.has(k) ? 0 : 1);
    if (typeof b !== 'number' || a === b) continue;
    out[k] = ADDED.has(k) || a === 0 ? b - a : LOWER.has(k) ? (a - b) / a : (b - a) / a;   // (an added amount as itself; a multiplier as a share, better > 0)
  }
  return out;
}
const runEffect = (c) => effect((P) => new Function('player', 'maxHp', 'CFG', 'G', c.body)(P, () => 100, { player: { maxForce: 100 } }, { unlocked: {} }));
const cardEffect = (c) => effect(() => c.apply());
const pct = (n, k) => k && ADDED.has(k) && !/^(dr|braceDR|parry|aim)$/.test(k) ? '+' + n : k === 'parry' ? '+' + n.toFixed(2) + 's' : (n * 100).toFixed(0) + '%';
const HEROES = {
  jedi: { run: runCards('skills.js').filter(c => ['vit', 'edge', 'flow', 'swift', 'focus', 'endure', 'jugg', 'vamp', 'bulw', 'rip', 'unstop', 'storm', 'ascend'].includes(c.id)),
          extra: [...JEDI_TREE, ...PATH_TREE.jedi] },
  mando: { run: runCards('skills.js').filter(c => ['plating', 'trigger', 'thrust', 'fleet', 'optics', 'grit', 'gam', 'ord', 'incend', 'creed', 'super', 'arsenal', 'marshal'].includes(c.id)),
           extra: [...RANK_SKILLS.mando, ...PATH_TREE.mando] },
  trooper: { run: runCards('trooper-progression.js').filter(c => c.tier <= 3), extra: [...RANK_SKILLS.trooper, ...PATH_TREE.trooper] },
};
for (const [hero, H] of Object.entries(HEROES)){
  console.log(`\n${hero.toUpperCase()}`);
  for (const t of [1, 2, 3]){
    const best = {};
    const runs = H.run.filter(c => c.tier === t);
    for (const c of runs) for (const [k, n] of Object.entries(runEffect(c))) best[k] = Math.max(best[k] ?? -Infinity, n);
    console.log(`  tier ${t}  run's best: ` + Object.entries(best).map(([k, n]) => k + ' ' + pct(n, k)).join(', '));
    for (const c of H.extra.filter(c => c.tier === t)){
      const e = cardEffect(c);
      console.log(`    ${(c.align ? c.align + ' ' : 'rank ') + c.id}`.padEnd(24) + Object.entries(e).map(([k, n]) => k + ' ' + pct(n, k)).join(', '));
      for (const [k, n] of Object.entries(e)) if (best[k] != null && n > best[k] + 1e-9)
        fail(`${hero} ${c.id} (tier ${t}): ${k} ${pct(n, k)} a rank, past the run's own best at that tier (${pct(best[k], k)})`);
    }
  }
}

if (bad.length){ console.error('\nBALANCE CHECK FAILED:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('\nbalance check: every sidegrade, path pair and tree card is inside its guardrail');
