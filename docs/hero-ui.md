# Hero UI

The UI wears the look of the hero being played. The full proposal, with mockups, is the "Hero UI Direction" doc
in the project files (`hero-ui/hero-ui-direction.html`).

## How it works

- `player/hero.js` sets `data-hero="jedi|mando|trooper"` on `<body>` whenever the hero changes, in every mode and on
  each co-op screen for its own hero. Cards built for one hero (the chapter card) also carry `.hero-<id>`.
- `styles/heroes/tokens.css` fills the `--hx-*` tokens per hero (and a neutral "house" set on `:root`).
  Components read only these tokens, so a new surface works for every hero.
- `styles/heroes/ink.css` holds the rules every hero shares. Area files: `tracker.css` (objectives, HOLD O, the run
  line), `briefing.css` (chapter card, lesson board), `screens.css` (pause, results), `profile.css` (the profile page,
  which wears the look of the hero tab it shows), `mastery.css` (the Jedi's FORMS & MASTERY and the gunners' ARMORY,
  laid out like the profile: who you are on the left, a grid of tiles, one thing's detail beside it in short tabs; the
  parts they share are in `ui/mastery-kit.js`), `meditation.css` (the Jedi's meditation after learning a form, in
  the same holocron parts), `menus.css` (settings, controls, load / save, save files, co-op, codex,
  roadmap, the sandbox panel and battle setup, the confirms, and the title screen).
- Menus: inside a menu the old tokens (`--ink`, `--accent`, `--edge`, ...) point at the hero's `--hx-*` ones, so the
  older rules recolour on their own; `menus.css` then paints only (no sizes or layout), so phones and the pad ring keep
  working. A new panel joins by adding its id to the selector lists there. The title screen wears the hero on the stand
  (the last one picked); the POWER TRIP logo and the boot screen keep the house look.

## The looks

| Hero | Materials | Display face | Accent |
| --- | --- | --- | --- |
| Jedi | holocron page: night blue, gold double hairline, diamond studs | Cinzel | gold; saber blue for what is live |
| Mandalorian | beskar plate: brushed charcoal, chamfered corners, ember top strip | Georgia, wide-spaced caps | ember orange |
| Trooper | orders readout: matte black, hazard stripe; story lines on the tan field file | IBM Plex Mono | hazard amber |

## Shared rules

1. **Ink the edges.** Panels, bars and buttons get the models' outline colour (`--hx-ink`, 2px). Flat fills or one
   hard highlight band. No backdrop blur, no glossy gradients.
2. **Snap, don't float.** Short stepped animations (`steps()`), then hold.
3. **Shout once per screen.** One display face for titles; reading text stays Barlow.
4. **Shared meaning colours.** Health, danger, ally, enemy and the objective marker are the same for every hero.
5. **No left rails, no pills.** Each hero has its own frame and button shape.
6. **Readable first.** 4.5:1 for reading text, nothing under 12px in the HUD at 720p, the controller focus ring in
   the hero's colour (`.padfocus`).
7. **Keep the fight visible.** The centre stays clear. In a fight (`body.hx-fight`, `ui/hud.js`) the objective
   tracker keeps only the objective in hand. No hero frame is bigger than the piece it replaced.
8. **One pop-up at a time.** Every corner note goes through `ui/popups.js`: one on screen at a time, a banner cuts
   in first, foe tips next, rewards (skill points, masteries, unlocks, codex) wait for a lull and repeats merge.
   New pop-ups should use `pushPopup` (or `upToast`), never put their own element up directly.

## Phases

0. Tokens, `data-hero`, the ink rules, the pop-up queue. **Done.**
1. Chapter card, objective tracker, HOLD O, pause, results. **Done.**
2. The live HUD: vitals and meters, the ability and stance/loadout cluster (bottom right), banners, captions,
   compass, squad panel, co-op chips, and the vitals' fight fade.
3. Menus: profile **done**; settings, controls, saves, save files, co-op, codex, roadmap, sandbox, battle setup,
   confirms and the title screen in each hero's look **done** (settings, controls, saves and the roadmap follow the
   hero too, not the house look). Still to do: the forms and mastery pages, the hub and zone panels, ability cards,
   the store; the forge, workbench and hub maps onto the shared tokens.
