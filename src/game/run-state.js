// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The run's state machines, written down: the SCREEN (G.mode), the run's KIND (which mode is being played) and the
// level's PHASE (shared.levelPhase). The map of all of them, and of the ones not yet moved here: docs/state-machines.md
//
// The values still live where they always did (G.mode, the G.<mode> flags, shared.levelPhase), so every reader works
// as before. What changes is the WRITING: a screen or a phase is set through setScreen / setPhase, which check the move
// against the tables below. A move the tables don't know is still made (nothing here blocks play): it is logged once
// to the console and kept in the trace, so a missing route or a state reached the wrong way shows up by name.
//
// In the browser console (and the smoke tests): GAME.run.now() says where the game is, GAME.run.trace is the last moves,
// GAME.run.illegal the ones no table allows.

import { shared, G } from '../state.js';

/* ============================================================
   THE SCREEN (G.mode): which of the four top states the game is in
   ============================================================ */
export const SCREENS = {
  menu:    { doc: 'the title screen and its pages, over the menu stage', to: ['play'] },
  play:    { doc: 'a run, a hub or a zone is up (paused or not: see holds())', to: ['dead', 'victory', 'menu'] },
  dead:    { doc: 'the hero fell: the death screen, RETRY or the menu', to: ['play', 'menu'] },
  victory: { doc: 'the run is won: the results screen, PLAY AGAIN or the way home', to: ['play', 'menu'] },
};

/* ============================================================
   THE KIND OF RUN: one name for the G.<mode> flags, which are not exclusive (a campaign chapter can be a mission, a
   zone flies a mission's kit). First match wins, in this order. '' on the menu
   ============================================================ */
export const KINDS = {
  hub:      { doc: 'a hero\'s hub (game/hub.js): no foes, no waves, no run', home: 'hub' },
  zone:     { doc: 'an open zone (game/zone.js): roaming fights, a waystone on a fall', home: 'zone' },
  training: { doc: 'the training grounds (game/tutorial.js): its own steps. Practice only: it earns nothing (earns: false)', home: 'training', earns: false },
  mission:  { doc: 'a story mission, a contract, a raid, or a campaign chapter that is one (game/mission.js)', home: 'mission' },
  sandbox:  { doc: 'the sandbox, its battle setup and its duel ring (game/sandbox.js)', home: 'sandbox' },
  survival: { doc: 'survival (game/survival.js): endless waves, G.endless', home: 'between' },
  campaign: { doc: 'a campaign chapter of waves (game/campaign.js), or the old level run (G.chapter < 0)', home: 'between' },
};
export function runKind(){
  if (G.mode === 'menu') return '';
  return G.hub ? 'hub' : G.zone ? 'zone' : G.training ? 'training' : G.mission ? 'mission' : G.sandbox ? 'sandbox' : G.endless ? 'survival' : 'campaign';
}
// DOES THIS RUN EARN? false in a kind marked `earns: false` (the training grounds): no run XP, no profile rank XP, no form,
// power or gun mastery, no best ranks or scores, no duel wins. Every progression hook checks it (a backstop: most of them
// also keep their own older mode checks). The training's own record (lessons passed) is not progression and still counts
export const runEarns = () => { const k = runKind(); return !k || KINDS[k].earns !== false; };
// the phase a level of this kind starts in (game/flow.js startLevel). Read off the flags, not G.mode: a level is also
// built while the menu is up (the sweep on the way out of a run)
export const homePhase = () => KINDS[G.hub ? 'hub' : G.zone ? 'zone' : G.training ? 'training' : G.mission ? 'mission' : G.sandbox ? 'sandbox' : 'campaign'].home;

/* ============================================================
   THE LEVEL'S PHASE (shared.levelPhase, with shared.phaseT its clock): what the wave flow is doing
   ============================================================ */
export const PHASES = {
  idle:        { doc: 'nothing running: before the first level, and in the dark between two', to: [] },
  between:     { doc: 'the lull before a wave: phaseT counts down to it (and waits on upgrade picks)', to: ['fighting'] },
  fighting:    { doc: 'a wave is on: it ends when the last hostile falls',
                 to: ['between', 'bossfight', 'chapterdone', 'aftermath', 'travel'] },
  bossfight:   { doc: 'the boss is due or on the field: he drives his own flow', to: ['chapterdone', 'aftermath'] },
  aftermath:   { doc: 'the calm after a chapter\'s last fight (game/aftermath.js): nobody falls', to: ['chapterdone'] },
  chapterdone: { doc: 'a chapter is won: its last lines and cards, then the upgrade page', to: ['travel'] },
  travel:      { doc: 'the upgrade page is closing: the road on to the next chapter or level', to: ['idle'] },
  // the modes that run their own steps instead of waves: each stays in its one phase until the next level starts
  hub:         { doc: 'a hub is up (kind hub)', to: [] },
  zone:        { doc: 'an open zone is up (kind zone)', to: [] },
  training:    { doc: 'the training grounds are up (kind training)', to: [] },
  mission:     { doc: 'a mission runs its objectives (game/mission.js); as a campaign chapter it closes like one',
                 to: ['chapterdone', 'aftermath'] },
  sandbox:     { doc: 'the sandbox is up (kind sandbox)', to: [] },
};

/* ============================================================
   THE TRACE: the last moves of both machines, and the ones no table allows
   ============================================================ */
const TRACE_MAX = 60;
export const trace = [], illegal = [];
const warned = new Set();
function note(machine, from, to, why, ok){
  const row = { machine, from, to, why: why || '', gt: +(G.gt || 0).toFixed(2), kind: runKind() };
  trace.push(row); if (trace.length > TRACE_MAX) trace.shift();
  if (ok) return;
  illegal.push(row); if (illegal.length > TRACE_MAX) illegal.shift();
  const key = machine + ':' + from + '>' + to;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn('[run-state] ' + machine + ' ' + from + ' → ' + to + (why ? ' (' + why + ')' : '') + ' is not in the table (src/game/run-state.js). The move was made; add it to the table if it is meant, or fix the caller.');
}
function move(machine, table, from, to, why, free){
  if (!table[to]){ note(machine, from, to, why || 'unknown state', false); return; }
  if (from === to) return;   // (set again: no move)
  note(machine, from, to, why, free || !table[from] || table[from].to.includes(to));
}

/* Sets the screen. `why` is a word for the trace ('launch', 'retry', 'quit'…). */
export function setScreen(next, why){
  move('screen', SCREENS, G.mode, next, why, false);
  G.mode = next;
}

/* Sets the level's phase, and its clock when `t` is given.
   opts.enter: a level is starting (or a save is putting a run back): any phase may come before it.
   opts.sync:  a co-op guest takes the host's phase, or a host change hands this browser the fight: any phase may too. */
export function setPhase(next, t, opts){
  const why = opts && (opts.why || (opts.enter ? 'enter' : opts.sync ? 'sync' : ''));
  move('phase', PHASES, shared.levelPhase, next, why, !!(opts && (opts.enter || opts.sync)));
  shared.levelPhase = next;
  if (t !== undefined) shared.phaseT = t;
}

/* ============================================================
   WHAT HOLDS THE SIM: the overlays that stop or own the fight. These are still plain flags (each has one owner, named
   here); this is the one place that lists them, for the console, the smoke tests and anyone asking "why is it frozen?"
   ============================================================ */
export const HOLDS = {
  paused:      'the pause screen, or any menu over play (ui/menus.js): the whole sim is frozen',
  skillSelect: 'the upgrade page is open (ui/store-ui.js): frozen, as paused',
  cutscene:    'a cutscene has the lens and the input (game/cutscene.js)',
  cardUp:      'a chapter card is up (game/campaign.js)',
  sbMenu:      'the sandbox panel is open (game/sandbox.js)',
  sbPlan:      'the sandbox battle setup is up (game/battlesim.js)',
  calm:        'the calm after a chapter (game/aftermath.js): play goes on, nobody falls',
};
export const holds = () => Object.keys(HOLDS).filter(k => G[k]);

/* ============================================================
   WHERE THE RUN WAS STARTED FROM, which decides the way home on its pause and end screens (ui/menus.js). Still two
   flags: G.fromHub (set leaving a hub for a run or a menu page, cleared by MAIN MENU) and G.partyRun (a co-op guest went
   along with the host out of a hub: the host coming home calls it back, game/hub.js)
   ============================================================ */
export const ORIGINS = {
  menu:  'started from the title screen: its screens offer MAIN MENU',
  hub:   'started from a hub station or its ship: its screens offer RETURN TO the hub, and a won run goes home by itself',
  party: 'followed the host out of a hub in co-op: as hub, and the host going home brings this guest along',
};
export const runOrigin = () => G.fromHub ? (G.partyRun ? 'party' : 'hub') : 'menu';

// where the game is, in one object
export const now = () => ({ screen: G.mode, kind: runKind(), phase: shared.levelPhase, phaseT: +(shared.phaseT || 0).toFixed(2),
  holds: holds(), chapter: G.chapter, guest: !!G.coopGuest, origin: runOrigin(), pick: G.modeSel, resumable: !!G.resumeRun });
