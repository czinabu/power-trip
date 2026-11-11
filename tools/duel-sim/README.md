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
`one` (`--form ataru --foe djemso --rank knight`), `bosses` (Darth Vexis, survival's warbringer and the Jedi story's
champions as their missions scale them: `tools/duel-sim/bosses.mjs`; narrow with `--foes vexis,warden`; `--adaptive`
answers a counter by switching form; `--mission` fights them as the Missions list does, a fresh hero against foes at
the first wave's depth, instead of that deep into a campaign run). Each champion carries its mission's duel profile and
its rage (the profile it sharpens to at that share of health). Skills: `good`, `average`, or a JSON object of bot keys.

What it does not model: Force powers, kicks, deliberate bolt blocking and crowd positioning. Five duels a cell is noisy;
read rows and columns, not single cells. About 2 fights a second on 4 workers.

Dodging: the bot rolls through a red DODGE tell (a choke ring, a repulse, Vexis's Last Stand charge as it arrives), and
against a final boss it parries or rolls his white PARRY-OR-DODGE moves (the guard breaker, the blink cuts). It sees the
tells through `GAME.simWatch` (`src/game/sim-watch.js`). Bot keys `dodge`, `dodgeLead`, `dodgeReact`; the report's
`rolled tells` column is rolls / red tells seen. A final boss's damage is split by his move in each line's `src`.

Upgrades: `--upgrades none|early|mid|full|auto` lays a run's skill cards on the hero first (`KITS` in `sim.mjs`: about 3,
6 and 12 points' worth). `auto` picks by the fight's depth, so a story duel is met with the cards a run has by then. The
default is `none`, the forms' own numbers.

Against Vexis the bot also catches his lightning on the guard (`catch`) and jumps his nova rings (`jump`); against the
warbringer it parries off the tell it flares as the hold lets go. Bot keys `heavy` (share of cuts held into heavies)
and `turtle` (hold the guard, cut only into openings) try other play styles.

```sh
node tools/duel-sim/clip.mjs --foe vexis --form ataru --seed 5 --from 2 --secs 6 --out vexis.gif   # film a fight (ffmpeg)
```
`clip.mjs` runs the same scripted fight with the renderer on and shoots a frame every few game frames, so the GIF plays
at real speed. `--page` films another build (a before / after pair), `--caption` writes along the bottom.
