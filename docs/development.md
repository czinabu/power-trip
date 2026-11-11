# Development guide

How the code fits together, and where to make the most common kinds of change. The project layout and the commands to
run, build and test are in the [README](../README.md); house rules for contributors are in [CLAUDE.md](../CLAUDE.md).

## How the code fits together

**One page, many modules.** `index.html` holds the HUD and menu markup; `src/main.js` imports every module in load
order and runs the main loop. `npm run build` inlines everything into one self-contained `dist/index.html`.

**Shared state.** Objects like `G`, `player`, `CFG` and the entity arrays are exported and mutated in place from any
file. A few values get *reassigned* during play (`boss`, `saberProj`, `levelPhase`, `phaseT`, `arenaGroup`,
`arenaHalf`, the audio context, …). ES module imports are read-only, so those live on the `shared` object in
`src/state.js` and are used as `shared.boss`, `shared.levelPhase`, and so on. A new variable that other files need to
reassign belongs there too. (It's called `shared` because `state` is already a local name in the music code.)

**Screens and level phases.** Never assign `G.mode` or `shared.levelPhase` directly: use `setScreen` / `setPhase` from
`src/game/run-state.js`, adding a new state or move to its tables first. See [state-machines.md](state-machines.md).

**Load order.** Module top-level code runs once at startup in the order `src/main.js` imports it. Keep new top-level
code to declarations where possible and do setup in functions.

**Data first.** Tuning and content live in `src/data/` (heroes, forms, enemies, levels, missions, campaigns, cutscene
words, upgrades, looks, co-op tuning…). Balance changes usually only touch that folder; run `npm run balance:check`
after big ones.

**Live tweaking.** `window.GAME` in the browser console exposes the config tables and most game functions.

## Where to make common changes

**An ability.** Its function goes under the hero's kit (`src/player/jedi/`, `mando/` or `trooper/`), with a HUD slot
(`#ab-*` in `index.html`), a keybind (`src/engine/input.js`, and the pad layout in `src/data/controls-pad.js`), a
Controls row (`src/ui/controls.js`), an unlock entry (`src/data/store.js`) and a cooldown row (`src/ui/hud.js`). Ability
code reads its tuning through `abil(id)`, so a mastery rank is a multiplier or bonus on a field of its config entry
(`src/data/mastery.js`). Check it works in every mode: story, missions, arcade, survival, sandbox, training and co-op.

**A hero's look.** The CUSTOMIZE screen (`src/ui/customizer.js`) offers the rows and options in
`src/data/customize.js`; each option is a partial look. Everything a look can change lives in
`src/player/model/appearance.js` as plain data. New outfit pieces are a function under a slot in `jedi.js` /
`mando.js`: `k.add()` hangs a rigid piece on one joint, `k.skin()` lays one continuous skinned surface over a run of
joints (`skin.js`), and `k.cloth()` hangs simulated cloth from a joint (`cloth.js`). New weapons are an entry in
`weapons.js` (its `grip` decides how it's held). Preview them in `/tools/model-lab.html` under `npm run dev`
(`?look=hooded` for a sample alternate look, `?style=shard|forged` for the other render styles).

**Sounds.** Every sound is synthesized. One-shots are recipes in the `S` bank in `src/audio/sfx.js`; continuous
sounds (saber hums, jetpack, flamethrower, ambience) live in `src/audio/director.js`; each world's score is a palette
in `src/audio/music.js`. Audition them in `/tools/sound-lab.html`.

**Progression.** Prices and unlocks are in `src/data/store.js`, `mastery.js` and `skills.js`, with each hero's
upgrade tree and ranks in the `src/data/` files named for them (`force-level.js`, `trooper-progression.js`,
`profile.js`…). Check prices against what a campaign pays out in `/tools/progression-lab.html`.

**Movement and combat feel.** Grounded movement and parkour (air control, landings, mantle and vault, ledge hang,
wall-run, sprint and slide, turning), the gait and standing footwork are tuned in `src/data/movement.js`; the code is
`src/player/parkour.js` and `locomotion.js`. The run and jump are shaped by motion capture (`src/data/mocap.js`, made
by `tools/mocap/convert.mjs`; `?mocap=0` turns it off; see [animation-guidelines.md](animation-guidelines.md)). Parry
and block windows, swing arcs, lunges, hit flinch, dodges, clashes and lock-on are in `CFG.player`
(`src/data/config.js`); lock-on is `src/player/lockon.js`. How sword-armed foes duel back (guards, posture, feints,
strings, counters, saber locks) is tuned in `src/data/duel.js` and coded in `src/enemies/duel.js`
(see [enemy-ai.md](enemy-ai.md)).

**Missions.** Missions are data in `src/data/missions.js` (hold, sabotage, capture, escort, pursuit and duel
objectives), built from reusable objective pieces in `src/game/objectives.js`. An arena can be long instead of square
(`arenaZ` in its level); bounds, pathing, shadows and the sky follow it. Map rules are in
[level-design.md](level-design.md) and [world-guidelines.md](world-guidelines.md).

**Training.** Each hero's lessons are data in `src/data/tutorial.js`: the teacher's line, the keys, what counts as done
and what to set up. A lesson counts moves the game reports through `src/game/tutor-bus.js` (`tutEvent('parry')` and so
on), so a new kind of lesson needs one `tutEvent` call where that move succeeds.

**The roadmap.** One file per entry in `src/data/roadmap/`; read its README first. `npm run build` fails on overlaps.

## Online co-op

Up to four browsers (or the desktop app) connect directly over WebRTC through the free PeerJS broker, using a 5-letter
room code (`src/net/session.js`).

- **Players list.** `src/player/players.js` holds every hero in the fight: `players[0]` is always this browser's hero
  (`player`), and each partner is one more entry. Code that needs "a hero" rather than "my hero" goes through it.
- **The partner's pose.** Each browser sends its hero's finished pose about 20 times a second (`src/net/pose.js`):
  every rig joint, the weapon and its glows. The partner's puppet eases between poses, so animation code never needs
  to know about a second hero.
- **Shared fights.** The host runs the enemies; guests show them as puppets and send their blows to the host
  (`src/net/foes.js`, `run.js`, `squad.js`). Each foe picks which hero to go after (`src/enemies/targets.js`), and
  attack turns are per hero. Co-op tuning lives in `src/data/coop.js`; the revive rules in `src/game/revive.js` work
  the same for squadmates and partners.
- `?peerhost=host&peerport=9000` in the page URL uses your own PeerServer (`npx peerjs --port 9000`) instead of the
  cloud broker.
- `api/turn.js` is a Vercel function that hands out Cloudflare TURN relay credentials for strict networks. Set
  `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` on the Vercel project to turn it on; without them the game uses STUN only.
  The desktop app asks the live site (`POWER_TRIP_WEB_URL`) for the same credentials.
- The `smoke:coop*` suites in `package.json` cover connecting, shared runs, the campaign, missions, bosses, raids,
  open zones, duels, and three- and four-player rooms (including a host leaving).
