# Gunner sims (trooper and Mandalorian)

Scripted fights on the built game for the two gunners, through the real combat code and as fast as the CPU allows.
Both share one in-page bot (`tools/trooper-sim/bot.js`) and one browser finder (`tools/sim-browser.mjs`: `$CHROMIUM`,
Playwright's own browser, or `/opt/pw-browsers/chromium`, so no setting is needed).

```sh
npm run build
npm run sim:trooper -- line --reps 4 --workers 3 --squad both    # line, boss, duel, forks, all
npm run sim:mando -- all --reps 3 --workers 3 --guns single,repeater --bots stand,move   # line, rush, boss, all
```

Trooper: `--squad on` (default), `off` or `both` (every fight twice on the same seeds, the squadless ones tagged
`:alone`). The table's `squad dmg` is the share of the damage on the foes his squad dealt.

Mandalorian: each gun (`single`, `dual`, `carbine`, `repeater`, `disruptor`) against a firing line, a melee rush and the
Iron Magistrate, late-run foes and a late-run hero. Bots: `stand` (planted, braced) and `move` (strafes, backs off a
rush, dives out of a red tell or a blow about to land). Not modelled: the jetpack, gadgets, melee and the Darksaber.

A fight that ends early (an error, or the game leaving play) is flagged under the table instead of counting as a
quick 0 s fight.
