// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AUTOSAVE: at each chapter / level checkpoint, each chapter's close, every boss beaten, a won mission, contract or raid, a
// lesson or trial passed and a form learned, the game writes the AUTO save slot (game/saves.js) and blinks a small SAVING
// note. Same in every mode and in co-op (a guest keeps its progress, not the host's run).

import { writeSlot, AUTO } from './saves.js';
import { G } from '../state.js';

const note = document.getElementById('autosave');
let pending = null, timer = 0, hideT = 0;

// reason names the trigger for whoever reads the call site; opts.finished drops the saved run (the campaign was won)
// (a beat late, so the level or chapter that is starting has finished setting itself up; opts.wait: a longer beat, ms).
// Saves that land close together (a checkpoint and an unlock, a boss and the mission he ends) write once, a beat after
// the last of them, so the slot always ends up with the newest of what they saw.
// opts.notAtClose: skip it while a chapter has just been won (a form or gun it hands over, shown at its close): that
// close already saves the run (saveAtClose below), and the next chapter's own checkpoint saves it all a moment later
export function autosave(reason, opts = {}){
  if (opts.notAtClose && G.chapter >= 0 && G.chapterClosed === G.chapter) return;
  const due = performance.now() + (opts.wait || 300);
  pending = pending ? { finished: pending.finished || !!opts.finished, due: Math.max(pending.due, due) } : { finished: !!opts.finished, due };
  clearTimeout(timer);
  timer = setTimeout(flush, Math.max(0, pending.due - performance.now()));
}
function flush(){ const p = pending; pending = null; if (p) write(p); }
// A BOSS DOWN (the Herald, a finale boss, a raid's, the Warbringer: boss/boss.js, boss/finale.js, enemies/damage.js, and a
// co-op guest's screen as the host's boss falls: net/foefire.js). Away from the campaign it saves at once, once the fall has
// played. A campaign's boss is saved as its chapter closes (saveAtClose below, moments later): saved mid-chapter, the
// save would load back in front of him. The last boss's win is kept as he falls (game/summary.js recordWin).
export function bossDown(){
  if (G.mode !== 'play' || G.sandbox || G.training || G.hub || G.chapter >= 0) return;
  autosave('boss', { wait: 2000 });
}
// a campaign chapter has just been won (game/campaign.js, game/flow.js): the run is saved at its close, so a reload picks it
// up from there (its upgrade page, then the next chapter: game/saves.js resumeRun), with the boss behind it
export function saveAtClose(){ autosave('chapter close', { wait: 600 }); }
function write(opts){
  const ok = writeSlot(AUTO, { auto: true, finished: !!opts.finished });
  if (!note) return;
  note.textContent = ok ? 'AUTOSAVED' : 'SAVE FAILED';
  note.classList.toggle('bad', !ok);
  note.classList.add('on');
  clearTimeout(hideT);
  hideT = setTimeout(() => note.classList.remove('on'), 1800);
}
