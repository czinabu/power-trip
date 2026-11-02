// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL SIM REPORT — turns tools/duel-sim/sim.mjs output (JSON lines) into tables: each hero form by rank (win rate, time
// to kill, damage taken, stamina a second), the same split by the counter edge, and the foe forms ranked.
//   node tools/duel-sim/report.mjs results.jsonl [more.jsonl …] [--md]
import { readFileSync } from 'fs';

const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const MD = process.argv.includes('--md');
const rows = files.flatMap(f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const FAMILY = { shiicho: 'speed', ataru: 'speed', juyo: 'speed', staff: 'speed', makashi: 'guard', soresu: 'guard', vaapad: 'guard', djemso: 'power', shien: 'power', niman: null };
const BEATS = { power: 'guard', guard: 'speed', speed: 'power' };
const edge = (a, b) => { const fa = FAMILY[a], fb = FAMILY[b]; if (!fa || !fb || fa === fb) return 0; return BEATS[fa] === fb ? 1 : BEATS[fb] === fa ? -1 : 0; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

function agg(rs){
  const win = rs.filter(r => r.end === 'win');
  return { n: rs.length, win: win.length / rs.length, ttk: mean(win.map(r => r.t)), dmg: mean(rs.map(r => r.dmg)),
           stam: mean(rs.map(r => r.stam / Math.max(1, r.t))), par: mean(rs.map(r => r.parryTry ? r.parries / r.parryTry : 0)) };
}
const fmt = (a) => [(a.win * 100).toFixed(0) + '%', a.ttk.toFixed(1) + 's', a.dmg.toFixed(0), a.stam.toFixed(0)];
function table(title, head, body){
  if (MD){
    console.log(`\n### ${title}\n`);
    console.log('| ' + head.join(' | ') + ' |'); console.log('|' + head.map(() => '---').join('|') + '|');
    for (const b of body) console.log('| ' + b.join(' | ') + ' |');
  } else {
    console.log('\n' + title); console.log(head.map(h => String(h).padEnd(17)).join(''));
    for (const b of body) console.log(b.map(c => String(c).padEnd(17)).join(''));
  }
}
const groups = (rs, key) => { const m = new Map(); for (const r of rs){ const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };

for (const [skill, rs0] of groups(rows, r => (r.skill || 'good') + ' / ' + r.tag)){
  const rs = rs0.filter(r => r.end !== 'error');
  if (rs0[0].tag === 'matrix'){
    const ranks = [...new Set(rs.map(r => r.rank))];
    const forms = [...new Set(rs.map(r => r.form))];
    // hero form × rank: win · ttk · dmg taken
    table(`${skill}: hero form by rank (win · time to kill · damage taken)`, ['form', ...ranks, 'stam/s'],
      forms.map(f => [f, ...ranks.map(k => { const a = agg(rs.filter(r => r.form === f && r.rank === k)); return `${(a.win*100).toFixed(0)}% ${a.ttk.toFixed(1)}s ${a.dmg.toFixed(0)}`; }),
                      agg(rs.filter(r => r.form === f)).stam.toFixed(0)]));
    // foe form overall
    table(`${skill}: foe form (all hero forms, by rank: win · ttk · dmg)`, ['foe', ...ranks],
      forms.map(f => [f, ...ranks.map(k => { const a = agg(rs.filter(r => r.foe === f && r.rank === k)); return `${(a.win*100).toFixed(0)}% ${a.ttk.toFixed(1)}s ${a.dmg.toFixed(0)}`; })]));
    // the counter edge
    table(`${skill}: counter edge (▲ you counter it · even · ▼ it counters you)`, ['rank', '▲', 'even', '▼'],
      ranks.map(k => [k, ...[1, 0, -1].map(d => { const a = agg(rs.filter(r => r.rank === k && edge(r.form, r.foe) === d)); return `${(a.win*100).toFixed(0)}% ${a.ttk.toFixed(1)}s ${a.dmg.toFixed(0)}`; })]));
  } else {
    const keys = [...groups(rs, r => r.form + ' vs ' + r.foe + (r.adaptive != null ? (r.adaptive ? ' (answers)' : ' (stays)') : '')).entries()];
    table(`${skill}`, ['fight', 'win', 'ttk', 'dmg', 'stam/s', 'kills', 'switches'],
      keys.map(([k, v]) => [k, ...fmt(agg(v)), mean(v.map(r => r.kills / r.of)).toFixed(2), mean(v.map(r => r.foeSwitch)).toFixed(1) + '/' + mean(v.map(r => r.switches)).toFixed(1)]));
  }
}
