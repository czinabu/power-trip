# Roadmap entries

The main menu's ROADMAP panel is built from the files in this folder: **one file per entry**.

**To add or change a roadmap item, add a NEW file here. Do not edit a shared list.** Parallel PRs
that each add their own file never conflict. (They used to all append to one `roadmap.js`, and nearly
every PR hit a merge conflict.)

## What gets an entry

Keep the roadmap high-level. **Only big features or changes actually worth mentioning get an entry**,
written as a short main-point summary (two to four plain lines, no fine specifics like key bindings,
numbers or per-mode lists). Small fixes, tweaks, polish and tuning get **no** entry. If a change
improves something already on the SHIPPED list, it usually needs no entry at all.

The SHIPPED column was condensed on 2026-11-03 into the `2026-11-03-shipped-*` summaries (one per
area: heroes, forms, combat, co-op...). Don't add an entry for more work in one of those areas
unless it is a genuinely new headline feature.

## New entry

Create `src/data/roadmap/<YYYY-MM-DD>-<short-slug>.js`:

```js
export default {
  title: 'Short title',
  status: 'done',            // 'done' | 'now' | 'next' | 'later'
  date: '2026-10-31',        // today; newest date shows first
  items: [
    'One short main point per line, revealed when the title is clicked',
    'Two to four lines; leave the details to the game itself',
  ],
};
```

To move an existing item (say `next` -> `done`), edit only that item's own file.
`index.js` gathers every `*.js` here and sorts by `date`, newest first. Files named `legacy-*` are the
entries migrated from the old single file (ordered by `seq`).

## Old branch still editing `src/data/roadmap.js`?

A merge will show a modify/delete conflict on it. Turn its new entries into files and drop it:

```sh
git show MERGE_HEAD:src/data/roadmap.js > /tmp/old-roadmap.mjs   # or <your-branch>:src/data/roadmap.js
node tools/roadmap-migrate.mjs /tmp/old-roadmap.mjs
git rm src/data/roadmap.js
```
