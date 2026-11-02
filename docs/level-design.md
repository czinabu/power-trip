# Level design guide

What expert level designers agree makes a good combat space, how Power Trip's maps measure up against it, and the
checklist a new map should pass. The layout rules that are about the art (palettes, backdrops, scale) live in
`docs/world-guidelines.md`; this file is about play.

## Sources

- Dan Taylor, *Ten Principles for Good Level Design* (GDC 2013): fun to navigate; driven by the mechanics; aimed at a
  feeling; shows rather than tells; gives goals, not instructions; keeps teaching; surprises; lets the player pick
  their difficulty (risk and reward); efficient, two-way, modular spaces; immersion and agency.
- *Anatomy of a Combat Zone* (Game Developer): every fight needs a **kill zone** paired with **defensive cover**;
  cover spaced for the player's sprint and jump; **flanking routes**; several **lanes** for different play styles;
  **height**; reinforcements arriving from **alternate positions** and as a **noticeable event**; risk-reward pickups
  inside the kill zone; layouts that make sense in the fiction.
- *The Level Design Book*, "Cover": low cover (waist high) keeps the player aware of the fight, knee height is not
  cover; less cover is usually better; open space suits bosses and set pieces; standardised, evenly spaced boxes look
  artificial, so vary them.

## What that means here

Everyone is about 1.5× life size, so the book's metrics scale by 1.5: waist-high cover is 1.5 to 1.9 m (still under
the 1.93 single-jump vault), knee height is about 0.75 m.

| Principle | In Power Trip |
|---|---|
| Kill zone + cover | The open ring between the cover pods and the edge is where foes arrive; the pods face it. Keep an exposed band there. |
| Lanes and flanks | At least two routes from the arrival ring to the hero's side of every big piece of cover; nothing a brute (radius ~1.1) can't fit through. |
| Height | Every arena has a climb (the overwatch gantry, a ruin, a hull) that the Mando reaches by jetpack and the Jedi by chained jumps. It is a vantage point, never a safe spot: snipers and flyers reach it. |
| No safe pockets | No floor a hero can reach that no grounded foe can (`map-audit` marks them cyan). |
| Reinforcements | Each surge comes in from one side, a new side each time, with the odd flanker, and never on top of a hero (the spawn director, below). An off-screen surge gets a pale arrow at the screen edge. |
| Risk and reward | Fuel drums sit where foes bunch up on their way in, not by the hero's spawn; hazards punish camping (the Jedha summit brazier), never walking through. |
| Corners | A square arena's corners lie past the round edge ring. Give each one a **bastion** (`kit.js`): two climbable steps behind a 1.6 wall and a wall-kick column, a raised fall-back spot that is still a corner. |
| Readability | A landmark to orient by (the brazier, the smelter, the altar); a spawn that faces the fight; one look per arena's hazards, always with the amber warning. |
| Open space for duels | Boss floors, trials and the sandbox rooms stay open on purpose. |

## The spawn director (world/collision.js `edgeSpawn`)

Every wave in the campaign, survival, a mission's edge arrivals and co-op goes through it.

- **Never on top of a hero.** A foe arrives at least 9 m, or half the arena, from every hero in the fight (co-op
  partners included). Only if the whole ring is blocked is that let go.
- **A front per surge.** A wave already arrives in surges (game/flow.js deals it in pulses). The first spawn after a
  1.5 s quiet spell picks the surge's side: well away from the heroes, and at least ~70° round from the last side, so
  each surge makes the player turn to face it. A quarter of a surge comes in on a flank, square to the front.
- **Battle maps** (any arena over 100 m) keep their ring round the hero (28 to 40 m out), but every front lies on the
  enemy's half of the field (south), so a wave rolls in from the Imperial lines and never out of the allies' backs.
- **Arrival markers** (ui/threats.js): a foe that arrived in the last 2.6 s off-screen shows a pale arrow at the edge
  of the screen, one per direction. Danger markers (a sniper's aim, a bomber, the boss) stay red and orange.

## Checking a map

`npm run build && node tools/shots/map-audit.mjs [outDir] [map,map,...]` draws a top-down plan of every map
(north, the spawn side, up) and writes `audit.json`:

- floor shaded by **exposure**: green within 3 m of cover, gold 3 to 8 m, red over 8 m;
- solids by role: grey steps, tan low cover (under 1.5), gold vaultable cover (1.5 to 1.93), white hard cover with its
  height, blue columns, dashed overhead slabs; red hazard outlines; the green dot is the hero's spawn; the dashed
  rings are the enemy edge ring;
- **cyan**: floor no grounded foe can reach (a safe pocket); **magenta**: open floor a brute can't get to.

The numbers: `exposedPct` (floor over 8 m from cover), `shelteredPct` (within 3 m), `meanCoverDist`, `heights` (the
distinct standable heights: more than three or four layers means real verticality), `pocketCells`, `chokeCells`,
`spawnCoverDist` (how far the spawn is from the nearest cover).

### Audit, 31 Oct 2026 (before → after the layout pass)

| Map | Exposed | Sheltered | Pockets | Notes |
|---|---|---|---|---|
| temple (Jedha, survival) | 35% → 11% | 28% → 40% | 0 | Symmetric, readable, landmark brazier. Corners were dead floor 18 m from cover: now a bastion in each. |
| foundry (Mustafar, survival) | 44% → 19% | 19% → 27% | 0 | Safe cardinals, dangerous diagonals. Corner bastions added. |
| plains (Exegol, survival) | 55% → 33% | 12% → 22% | 1 | The duelling ground stays open; the 20 m of bare floor round it now has a middle ring of cover, the altar lane is split, and the corners have bastions. |
| sith (Throne of Exegol) | 33% | 20% | 0 | The spawn looks straight down an open lane to the altar (a shooting gallery). |
| archive (Burning Archive) | 20% | 33% | 0 | Good: burning shelves flare along their faces, punishing hiding there too long. |
| hall / forge (training) | 16% / 1% | 29% / 55% | 0 | Fine for courses. |
| dojo / throne (sandbox rooms) | 100% / 61% | 0 / 12% | 0 | Open middles on purpose. The Mando's room now has planters at the three cover heights (west wall) and a jump/jetpack climb (east wall). |
| hangar (trial, sandbox) | 28% | 25% | 0 | Spawns in the open centre lane (fine for a duel). |
| refuge, prison | 15%, 17% | 31%, 34% | 0 | Good. |
| pens (Tessaril) | 9% | 46% | 20 | A sealed pocket inside the rock spine (about x 18, z 3). |
| outpost, covert (Mando) | 8%, 6% | 39%, 44% | 1, 0 | Dense; fine. |
| grassland / icefront / graveyard | 36–47% | 17–20% | 0 | Good fronts. Ridges, barricades, scrap and debris raised from 1.2–1.5 to 1.55 m so they stop a bolt (still vaultable). |

**Cover heights.** Enemy bolts fly at about 1.4–1.5 m, so cover under that doesn't stop a shot that is fired; the
standard heights are now a step (0.5–0.75, walk up), waist cover (1.55–1.7: stops a bolt, still vaulted under the
1.93 apex) and hard cover (2.4 and up). Before the pass: The AI already treats any
non-step solid as blocking its line of fire (it repositions instead of shooting into a wall), so low cover works as
cover in practice; new cover should still be 1.5 m or more where it's meant to stop fire.

## Checklist for a new map

1. A kill zone where foes arrive, and cover facing it; less cover rather than more.
2. Two or more lanes past every large piece of cover; every gap at least brute-wide.
3. One climb to a vantage point that snipers and flyers can still reach.
4. `map-audit`: no cyan pockets; no magenta unless meant; the spawn within reach of cover and facing the fight.
5. A landmark to orient by, and the spawn looking toward it.
6. Hazards with the amber warning, placed to punish camping or reward luring, never on the only route.
7. Fuel drums where foes bunch up, not by the spawn.
8. It works in every mode that can load it (campaign, survival, missions, sandbox, co-op).

## Protect missions (holds with people to get out: game/lanes.js)

A hold with evacuees (the refuge's younglings, the archivists, the pens' children, the barge's prisoners) is only fair
if the player can stand in the zone and still protect the line. Every hold now follows these rules, checked by
`npm run smoke:holds`:

- **Lanes away from the walk.** Each hold's waves come in by two or three approach lanes (`lanes` or `from` in
  data/missions.js), spread at least ~45° apart round the zone. No lane mouth is within 13 m of any point of the
  evacuees' path, from the shelter door to the hatch; if a mission's arcs have none that far, the whole ring is
  searched instead, so bad data can't put a wave on top of the line. No mission spawn of any kind (a trickle, an
  ambush, a twist's group) lands within 11 m of anyone being protected or 8 m of a hero.
- **The zone stands between the lanes and the line.** Lay the path so it runs through or beside the zone and put the
  lanes on the far side of the zone from it. Then the troops have to come through the player to reach the line.
- **Out of sight.** Lanes behind tall cover (as seen from the zone) are preferred, so troops step out from behind a
  stack or a wall instead of popping in in the open.
- **Telegraphed.** A wave's lane lights up red for 3.2 s before it steps out: a ring at the mouth, chevrons running
  to the zone and a red arrow at the screen edge when the lane is behind the camera. Between waves the lanes stay
  faintly marked, so the routes are learnable.
- **The zone covers the line.** A hero within 3.2 m of someone in the line counts as holding the zone (half speed if a
  foe stands in the zone), so leaving the circle to guard them never costs the hold.

The audit as it stands (2026-11-02, `npm run smoke:holds`): nearest lane mouth to the walk / nearest arrival to the line.

| Hold | Lanes (out of sight) | Lane → walk | Arrival → line |
|---|---|---|---|
| The Last Evacuation, hold the ramp | 3 (0) | 22.5 m | 31.7 m |
| The Last Ship, hold the ramp | 2 (2) | 22.4 m | 33.2 m |
| The Burning Archive, get the archivists out | 2 (2) | 15.3 m | 25.6 m (was under 1 m) |
| The Ember Academy, get the children out | 2 (2) | 21.8 m | 43.2 m |
| The Gallows, get them aboard | 2 (2) | 23.9 m | 34.5 m |
| The Lothal Breakout, hold the gate | 3 (3) | 24.6 m | 36.4 m |
| The Pens on Tessaril, hold the gate | 2 (1) | 18.6 m | 18.5 m |
| Vael's Chains, get the children out | 3 (3) | 22.9 m | 22.3 m (was under 2 m) |
