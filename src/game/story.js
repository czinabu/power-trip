// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE STORY AS IT HAPPENS: the voice in your ear during a chapter (the comms strip), and the story's beats, named so
// anything else can hang off them (a cutscene, a sting).
//
// A BEAT is a moment in a chapter: 'chapter' (its card closed, the fight starts) · 'wave' (info.n, counted from 0 within
// the chapter) · 'boss' · 'clear' · 'inquisitor' (the refuge duel's foe steps in) · 'escape' (it breaks off) · 'epilogue'.
// storyBeat plays the chapter's lines for the beat (data/campaign.js `lines`), then tells whoever listens (onStory).

import { G, enemies, shared } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { storyVoice, forHero } from '../data/campaign.js';
import { hooks } from '../net/run.js';
import { chapterAt } from './campaign.js';

const box = document.getElementById('comms');
const who = box.querySelector('.cm-who'), say = box.querySelector('.cm-say'), tutor = document.getElementById('tutor');
const queue = [];
let cur = null, left = 0;

// a line is a string (the hero's voice: the Battlemaster, the Armorer) or { who, say } (anyone else)
const speaker = (l) => typeof l === 'string' ? storyVoice(undefined, G.chapter >= 0 ? chapterAt(G.chapter) : null) : l.who;   // (the story's voice: data/campaign.js)
const words = (l) => typeof l === 'string' ? l : l.say;
const holdFor = (text) => 2.4 + text.length * 0.05;

/* QUIET STRETCHES — a longer line (story, not a callout) waits while the fight is on top of you: three or more foes
   within reach of the hero (a boss counts as three). It plays as soon as the field eases off (an escort leg, the walk
   after a hold, a chase's standoff), or after HOLD_MAX seconds whatever happens, so nothing is lost. Lines queued to cut
   in (a duel foe stepping in, a breach, an objective's hand-off: opts.now) never wait: they're about what's in front of you. */
export const QUIET = { long: 70, near: 12, foes: 3, holdMax: 30 };
export function fightHot(){
  const p = playerPos();
  let n = 0;
  if (shared.boss && shared.boss.hp > 0 && shared.boss.group && Math.hypot(shared.boss.group.position.x - p.x, shared.boss.group.position.z - p.z) < QUIET.near * 1.5) n += 3;
  for (const e of enemies){
    if (n >= QUIET.foes) break;
    if (e.dead || e.converted || !e.group) continue;
    if (Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z) < QUIET.near) n++;
  }
  return n >= QUIET.foes;
}
const waits = (l) => !l.urgent && l.say.length > QUIET.long && (l.held || 0) < QUIET.holdMax;
// queue lines on the strip. Co-op: the host's lines go over to the guest too (its own beats stay quiet: game/flow.js
// doesn't run there), so both screens hear the same thing
// opts.now: cut in, dropping whatever's queued · opts.front: cut in ahead of the queue, which plays on after it (an
// objective's hand-off: a story line still waiting for a lull isn't lost to it) · opts.remote: this screen only
export function comms(lines, opts = {}){
  if (!lines) return;
  lines = Array.isArray(lines) ? lines : [lines];
  if (!lines.length) return;
  const list = lines.map(l => ({ who: speaker(l), say: words(l), rival: typeof l === 'object' && !!l.rival, urgent: !!(opts.now || opts.front), talk: !!opts.talk }));
  enqueue(list, !!opts.now, !!opts.front);
  if (hooks.comms && !opts.remote) hooks.comms(list, !!opts.now, !!opts.front);
}
function enqueue(list, now, front){
  if (now || front){ cur = null; left = 0; }
  if (now) queue.length = 0;
  if (front) queue.unshift(...list); else queue.push(...list);
}
// from the host, already worked out (net/foefire.js)
export function remoteComms(list, now, front){ enqueue(list, now, front); }
export function clearComms(){ queue.length = 0; cur = null; left = 0; box.classList.remove('on'); }

// runs on the sim's time (held while paused or on the upgrade screen: main.js)
export function updateComms(dt){
  if (G.mode !== 'play'){ if (cur || queue.length) clearComms(); return; }
  if (cur && (left -= dt) > 0){ if ((placeT -= dt) <= 0) place(); return; }
  if (cur){ cur = null; box.classList.remove('on'); left = 0.35; return; }   // a breath between lines
  if (left > 0){ left -= dt; return; }
  if (!queue.length) return;
  if (waits(queue[0]) && fightHot()){ queue[0].held = (queue[0].held || 0) + dt; return; }   // a story line: wait for a lull (QUIET)
  cur = queue.shift();
  who.textContent = cur.who; say.textContent = cur.say;
  box.classList.toggle('rival', cur.rival);
  place();
  box.classList.add('on');
  left = holdFor(cur.say);
}
// a mission's briefing panel low on the screen: sit just above it rather than on top of it (checked again while a line is
// up: the panel can come up under a line already on screen, as an objective begins under its hand-off line)
let placeT = 0;
function place(){
  placeT = 0.25;
  const r = tutor.classList.contains('on') && tutor.getBoundingClientRect();
  box.style.bottom = r && r.bottom > innerHeight * 0.5 ? (innerHeight - r.top + 10) + 'px' : '';
}
export const commsBusy = () => !!cur || queue.length > 0;
export const commsShowing = () => !!cur;
export const commsTalking = () => !!(cur && cur.talk);   // the line up is a walk-up line (game/talk.js)

/* ---------- beats ---------- */
const CUT_IN = new Set(['duel', 'escape', 'boss', 'breach']);   // these speak over whatever's still queued: they're about what's in front of you
const listeners = {};
export function onStory(beat, fn){ (listeners[beat] = listeners[beat] || []).push(fn); }
export function storyBeat(beat, info = {}){
  if (G.chapter < 0) return;
  const c = chapterAt(G.chapter);
  if (!c) return;
  info = { ...info, chapter: c.id, pos: G.chapter, hero: G.hero };
  if (!G.coopGuest && !info.quiet) comms(linesFor(c, beat, info), { now: CUT_IN.has(beat) });
  for (const fn of listeners[beat] || []) fn(info);
}
// a chapter's lines for a beat: `lines.wave` is one entry per wave of the chapter, the rest one entry per beat
function linesFor(c, beat, info){
  const L = c.lines && c.lines[beat];
  if (!L) return null;
  return forHero(beat === 'wave' ? L[info.n] : beat === 'breach' ? L[info.door] : L, G.hero) || null;   // (a breach's lines: one entry per door)
}
