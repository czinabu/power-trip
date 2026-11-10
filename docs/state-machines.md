# State machines

Where the game keeps "what is going on right now", which of those are written down as real state machines, and
which are still plain flags. Read this before adding a mode, a screen, a phase or a flag that means "we are in X".

## The rule

- **A screen or a level phase is only ever set through `setScreen` / `setPhase`** (`src/game/run-state.js`). Never
  assign `G.mode` or `shared.levelPhase` directly. Reading them is fine, anywhere.
- A new state or a new move goes in the table first (`SCREENS`, `PHASES`), with its one-line `doc`.
- A move the table doesn't know is still made (nothing blocks play), warns once in the console, and lands in
  `GAME.run.illegal`. The main smoke test (`npm run smoke`) fails on any.

## Looking at it live

In the browser console, or from a smoke test's `page.evaluate`:

| Call | Gives |
| --- | --- |
| `GAME.run.now()` | `{ screen, kind, phase, phaseT, holds, chapter, guest, origin, pick, resumable }` |
| `GAME.run.trace` | the last 60 moves of both machines, each with why, game time and run kind |
| `GAME.run.illegal` | the moves no table allows |
| `GAME.run.holds()` | which overlays hold the sim right now |
| `GAME.run.SCREENS`, `PHASES`, `KINDS`, `HOLDS` | the tables, with their docs |

## Explicit machines (`src/game/run-state.js`)

### Screen: `G.mode`

```
menu ──launch──▶ play ──hero fell──▶ dead ──retry──▶ play
  ▲                │                   │
  │                ├──run won──▶ victory ──play again──▶ play
  └──quit / hub────┴───────────────────┴──────────────▶ menu
```

Going to the hub from a run passes through `menu` and launches again (`ui/menus.js goTemple`).

### Level phase: `shared.levelPhase` (clock: `shared.phaseT`)

```
            ┌────────────────────────────┐
            ▼                            │ wave cleared
(enter) ─▶ between ──phaseT runs out──▶ fighting ──last wave, boss due──▶ bossfight
                                         │  │                               │
                     old level run ◀─────┘  └──chapter's last wave──┐       │
                           │                                        ▼       ▼
                           ▼                               aftermath ─▶ chapterdone
                        travel ◀──────────upgrade page────────────────────┘
                           │
                           ▼
                         idle ──(enter: the next chapter or level)
```

`hub`, `zone`, `training`, `mission` and `sandbox` are one-phase modes: they run their own steps, and leave only when
the next level starts. A mission that is a campaign chapter closes like one (`mission → aftermath | chapterdone`).

Two kinds of move skip the table on purpose, and say so in the trace:

- `enter`: a level starts (`startLevel`), a boss checkpoint is retried, or a save puts a closed chapter back.
- `sync`: a co-op guest takes the host's phase, or a host leaving hands this browser the fight.

### Run kind: derived, not stored

`runKind()` names the mode being played from the flags, first match wins:
`hub → zone → training → mission → sandbox → survival → campaign`. The flags are **not** exclusive (a campaign
chapter can be a mission; a zone flies a mission's kit), which is why the order matters. `homePhase()` is the phase a
level of that kind starts in.

A kind can be marked `earns: false` (today: `training`). `runEarns()` is false there, and every progression hook checks
it: run XP, profile rank XP, form/power/gun mastery, the best form and gun ranks, duel wins, best scores. A new hook that
pays out progression should check `runEarns()` too, so practice never counts. The training's own lesson ticks still count.

Co-op has its own one-letter kind for the wire (`net/foes.js runKind`: `z e c m`), which answers a different
question ("is this a run a guest can follow?"). Keep the two apart.

### Holds: listed, still flags

`HOLDS` names every overlay that stops or owns the fight (`paused`, `skillSelect`, `cutscene`, `cardUp`, `sbMenu`,
`sbPlan`, `calm`) and who owns it. They are still booleans on `G`.

### Launch: what BEGIN starts (`ui/menus.js LAUNCH`)

One row per `G.modeSel` (`temple`, `zone`, `campaign`, `gate`, `mission`, `endless`, `training`, `sandbox`), each with
`locked()` (BEGIN falls back to the campaign), `start()` and, where a co-op guest starts differently, `join()`. A new
mode is a new row. RETRY (after a fall) and RESTART pick by the run's kind and are still chains, next to it.

### Run origin: derived (`runOrigin()`)

`menu | hub | party`, read off `G.fromHub` and `G.partyRun` (`ORIGINS` in `run-state.js`). It decides whether a run's
pause and end screens offer RETURN TO the hub. `goHome()` clears it, so anything that uses `goHome()` as a reset on
the way into another run must put it back (RETURN TO STORY from training does).

## Already explicit elsewhere

- **Enemy AI**: `e.state` strings (`chase`, `think`, `windup`, `recover`…), `enemies/ai.js`, documented in
  `docs/enemy-ai.md`.
- **Bosses**: `boss.state` (`boss/boss.js`), and the duellist bosses on the same AI (`boss/finale.js`).
- **Missions**: an objective index and per-objective kinds (`game/mission.js missionState()`), data in
  `data/missions.js`.
- **Training**: step list (`game/tutorial.js`, `data/tutorial.js`).
- **Cutscenes**: shot list with a cursor (`game/cutscene.js`).

## Still implicit (the audit)

Ordered by how much trouble they can cause. None of these were changed.

| # | Machine | Lives in | Why it is fragile |
| --- | --- | --- | --- |
| 1 | **Retry and restart** | `ui/menus.js` `beginPlay` (dead branch) and `restartRun` | Two more chains over the run-kind flags, in different orders. The launch itself is a table now. |
| 2 | **The run waiting on the menu** | `G.resumeRun`, written in 12 places over 5 files, plus `parked` and `latestRun` in `game/saves.js` | `resumeRun()` uses the run up as it begins, and every way back to the menu must put one back (`followHero`). A route that forgets leaves no CONTINUE. |
| 3 | **Where a run came from, and the way home** | `G.fromHub`, `G.partyRun`, `G.hubArrive`, `G.hubWing`, `G.modeSel === 'temple'` | The RETURN TO button is `state !== 'menu' && G.fromHub && !G.hub`. `goHome` clears `fromHub`; `leaveHub`, `followHostRun` set it. Now named by `runOrigin()`, still two flags. |
| 4 | **Co-op role in a run** | `net.role`, `net.status`, `G.coopGuest` (11 writes, 6 files), `G.coopWasGuest` (9), `G.coopJoin` (8) | Three booleans encode solo / joining / following / fell out of the host's fight / host. The "back in the host's fight" check re-derives the run kind by hand. |
| 5 | **Overlays** | `G.paused` (21 writes), `G.skillSelect` (29 writes, 14 files), `G.cardUp` (10), `G.sbMenu`, `G.sbPlan`, plus `setOverlayState` and the menu step in `ui/menus.js` | Many screens each flip the same flags; closing one can unfreeze under another. `HOLDS` lists them now, nothing owns them yet. |
| 6 | **Campaign position** | `G.chapter`, `G.chapterClosed`, `G.checkpoint`, `G.actTwo`, `G.storyHero`, `G.ngPlus`, `G.ngNext` | The save's `closed` flag and `G.chapterClosed` say the same thing in two places. |
| 7 | **What is unlocked in this run** | `G.unlocked`, `G.waveTotal`, story progress, per-mode gates (`game/sandbox-unlocks.js`, `game/zone-gate.js`, `game/locks.js`) | Each mode decides its own kit from a different source. |
| 8 | **Hub welcome and news** | `W` in `game/hub-welcome.js` (`wait`, `newsWait`, `newsDone`, `tour`) | `welcomeArrive` runs on every wing load, so "arrived at the hub" and "walked through a door" are the same event. |

### How the reported bugs map onto these

Leads only: none of these were reproduced or fixed here.

- *A campaign that can't be resumed* → #2. Look for a way back to the menu that doesn't end in `followHero()`, and
  for a start that sets `G.resumeRun = null` without a save behind it.
- *Mission runs with no route back to the temple* → #3. One cause found and fixed: RETURN TO STORY from the training
  grounds went through `goHome()`, which cleared `G.fromHub`, so a campaign started at a hub lost its way back after a
  training detour. Other causes may remain.
- *Side missions granting locked abilities* → #7.
- *A screen popping up on scene changes in the Mando hub* → #8.

### Suggested order for the next passes

1. **Retry and restart** (#1) as rows on the run kinds, beside `LAUNCH`.
2. **Run origin** (#3) as one stored value set by the launcher, in place of the two flags.
3. **The waiting run** (#2) behind `takeRun()` / `offerRun()` in `game/saves.js`, so no caller touches `G.resumeRun`.
4. **Co-op role** (#4) as `coopRole(): 'solo' | 'host' | 'joining' | 'guest' | 'dropped'`.
5. **Overlays** (#5) as a stack, so closing one screen can't unfreeze another.
