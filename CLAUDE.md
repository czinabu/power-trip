# Notes for contributors (human or Claude)

- **Roadmap:** never edit a shared list. Add a new file `src/data/roadmap/<YYYY-MM-DD>-<slug>.js`
  (format in `src/data/roadmap/README.md`). Only big features or changes actually worth mentioning get an
  entry, as a short main-point summary without fine specifics. Small fixes, tweaks, polish and tuning get none.
  One file per entry keeps parallel PRs from conflicting.
- **Other shared append-only lists:** avoid appending to the same spot in a shared file from many PRs;
  prefer a new file per addition where practical.
- **Screens and level phases:** never assign `G.mode` or `shared.levelPhase`. Use `setScreen` / `setPhase` from
  `src/game/run-state.js`, and add a new state or move to its tables first (map and debugging: `docs/state-machines.md`).
