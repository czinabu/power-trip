// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ROADMAP CHECK: runs before every build (npm's prebuild, so locally, in CI and on Vercel) and fails it when the
// roadmap overlaps itself. Rules (see src/data/roadmap/README.md):
//   1. every entry has a title, a known status and at least one item
//   2. no two entries share a title, in any column
//   3. IN PROGRESS and PLANNED never mention the same feature twice: no two of their titles share a topic word
//      (Jar'Kai in both columns, co-op in both...). Merge them into one entry, or retire the one that's done
//   4. an IN PROGRESS / PLANNED entry has no "Done:" lines: once a feature ships, it moves to SHIPPED (or is
//      folded into a shipped summary) and the planned entry is deleted
//   node tools/roadmap-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/roadmap');
const STATUSES = ['done', 'now', 'next', 'later'];
const ACTIVE = ['now', 'next', 'later'];
// words too generic to mark a topic
const STOP = new Set(('a an and the of on in to for with your you its it is by at from as or not no ' +
  'round two three one more new pass part fully together fight get gets real really own every all better ' +
  'first next last up out style mode modes').split(' '));

const norm = (s) => String(s).toLowerCase().replace(/['’]/g, '').replace(/co-op/g, 'coop');
const words = (s) => new Set(norm(s).split(/[^a-z0-9]+/)
  .filter((w) => w && !STOP.has(w))
  .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)));

const entries = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'index.js').sort()) {
  const e = (await import(pathToFileURL(path.join(dir, f)).href)).default;
  entries.push({ f, e });
}

const problems = [];
for (const { f, e } of entries) {
  if (!e || typeof e !== 'object' || !e.title) { problems.push(`${f}: no title`); continue; }
  if (!STATUSES.includes(e.status)) problems.push(`${f}: status "${e.status}" is not one of ${STATUSES.join(', ')}`);
  if (!Array.isArray(e.items) || !e.items.length) problems.push(`${f}: needs at least one item`);
  if (ACTIVE.includes(e.status) && (e.items || []).some((t) => /^\s*done\b/i.test(t)))
    problems.push(`${f}: "${e.title}" is ${e.status} but has "Done:" lines; move what shipped to SHIPPED and delete or trim this entry`);
}

const ok = entries.filter(({ e }) => e && e.title);
for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
  const a = ok[i], b = ok[j];
  if (norm(a.e.title).replace(/[^a-z0-9]/g, '') === norm(b.e.title).replace(/[^a-z0-9]/g, '')) {
    problems.push(`${a.f} and ${b.f}: both are titled "${a.e.title}"`);
    continue;
  }
  if (!ACTIVE.includes(a.e.status) || !ACTIVE.includes(b.e.status)) continue;
  const wb = words(b.e.title);
  const shared = [...words(a.e.title)].filter((w) => wb.has(w));
  if (shared.length)
    problems.push(`${a.f} ("${a.e.title}", ${a.e.status}) and ${b.f} ("${b.e.title}", ${b.e.status}) overlap on "${shared.join('", "')}"; keep one entry per feature`);
}

if (problems.length) {
  console.error(`Roadmap check failed (${problems.length}):`);
  for (const p of problems) console.error('  - ' + p);
  console.error('See src/data/roadmap/README.md.');
  process.exit(1);
}
const count = (s) => ok.filter(({ e }) => e.status === s).length;
console.log(`roadmap ok: ${count('done')} shipped, ${count('now')} in progress, ${count('next') + count('later')} planned`);
