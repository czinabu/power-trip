# Duel sim

Scripted saber duels on the built game, end to end through the real combat code. The game's clock is taken over so
fights run as fast as the CPU allows, `Math.random` is seeded per fight, and a bot plays the Jedi (`bot.js`).

```sh
npm run build
node tools/duel-sim/sim.mjs matrix --reps 5 --workers 4 --skill average --out /tmp/m.jsonl
node tools/duel-sim/report.mjs /tmp/m.jsonl          # add --md for markdown tables
```

Plans: `matrix` (every hero form × every foe form × ranks I–IV; narrow with `--ranks`, `--forms`, `--foes`),
`adapt` (masters that switch form), `crowd` (acolyte, trooper and magnaguard packs), `early` (wave acolytes 1–8),
`one` (`--form ataru --foe djemso --rank knight`). Skills: `good`, `average`, or a JSON object of bot keys.

What it does not model: Force powers, kicks, dashes, deliberate bolt blocking, crowd positioning and upgrades. Five
duels a cell is noisy; read rows and columns, not single cells. About 2 fights a second on 4 workers.
