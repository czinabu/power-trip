// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// OBJECTIVE VIEW: HOLD O (a pad: hold LB + D-pad right) for a card in the middle of the screen that says what you are
// doing right now, which step it is (OBJECTIVE 3 OF 5, WAVE 2 / 4, STEP 4 / 9) and how far through the whole thing you
// are. Let go and it is gone. The fight carries on underneath: it is a glance, not a pause.
//
// Every mode answers it: a story mission, a campaign chapter (missions and wave chapters both), an arcade contract, the
// training grounds, survival, the sandbox (and its battle simulator), and a co-op guest reading the host's mission.
// ui/hud.js calls renderObjectiveView() each frame; objectiveInfo() is what it shows (and what the tests read).

import { G, shared, enemies } from '../state.js';
import { clamp } from '../utils.js';
import { LEVELS } from '../data/levels.js';
import { MUTATORS } from '../data/mutators.js';
import { heroKey } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { missionState, missionChecklist, objectiveTarget } from '../game/mission.js';
import { objectiveHud } from '../game/objectives.js';
import { trainingProgress, trainingChecklist } from '../game/tutorial.js';
import { chapterLabel, chapters } from '../game/campaign.js';
import { chapterNo } from '../data/campaign.js';
import { pad, padKey } from '../engine/gamepad.js';
import { PAD_GLYPHS, padLayout } from '../data/gamepad.js';

export const OBJ_KEY = 'o';   // data/gamepad.js binds LB + D-pad right to it

/* ---------- the hold ---------- */
let held = false;
const typing = (e) => e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range';
document.addEventListener('keydown', (e) => { if (e.key && e.key.toLowerCase() === OBJ_KEY && !typing(e)) held = true; });
document.addEventListener('keyup', (e) => { if (e.key && e.key.toLowerCase() === OBJ_KEY) held = false; });
window.addEventListener('blur', () => { held = false; });
export const objectiveViewHeld = () => held;
export function holdObjectiveView(on){ held = !!on; }   // (tests)
// the key to say on screen: O, or the pad's LB + →
export const objectiveKey = () => pad.active ? padKey(OBJ_KEY, padLayout(G.hero)).replace('+', ' + ') : 'O';

/* ---------- what it says ---------- */
const said = (v) => v && typeof v === 'object' ? heroKey(v) : v;
function hostilesLeft(){
  let n = 0;
  for (const e of enemies) if (!e.dead && !e.converted) n++;
  return n + G.spawnQueue.filter(s => !s.barrier).length;
}
// the story run around it: 'CHAPTER 4 OF 15' (a prologue counts as a chapter here: it is a step of the run)
function storyStep(){
  if (!(G.chapter >= 0)) return null;
  const list = chapters();
  return { label: chapterNo(G.chapter) || 'CHAPTER', n: G.chapter + 1, of: list.length };
}

// { kicker, title, task, step, status, warn, frac (this step, or null), overall (0..1), items, story, far }
export function objectiveInfo(){
  if (G.mode !== 'play') return null;
  if (G.training){
    const tp = trainingProgress(), c = trainingChecklist();
    const now = c && c.items.find(i => i.now);
    return { kicker: 'TRAINING · ' + tp.place, title: tp.name, task: now ? now.text : (tp.total ? 'Step done: the next one is coming up' : 'Pick a lesson from the board'),
             step: tp.total ? 'STEP ' + tp.lesson + ' OF ' + tp.total : '', overall: tp.total ? clamp((tp.lesson - 1) / tp.total, 0, 1) : null,
             items: c ? c.items : null };
  }
  if (G.mission){
    const M = missionState();
    if (!M.on || !M.def) return null;
    const n = M.def.objectives.length, i = Math.max(0, M.i), live = objectiveHud(), list = missionChecklist();
    const cur = list && list.items[i], o = M.o || M.def.objectives[i] || {};
    const frac = live && live.frac != null ? clamp(live.frac, 0, 1) : null;
    const done = M.won ? n : i;
    const t = objectiveTarget(), pp = t && playerPos();
    return { kicker: M.kick || 'MISSION', title: M.won ? 'MISSION COMPLETE' : (cur ? cur.text : said(o.title) || 'STAND READY'),
             task: M.won ? '' : said(o.task) || '', step: M.won ? 'ALL ' + n + ' OBJECTIVES DONE' : 'OBJECTIVE ' + (i + 1) + ' OF ' + n,
             status: M.won ? '' : (live && live.status) || '', warn: !!(live && live.warn), frac: M.won ? null : frac,
             overall: clamp((done + (M.won ? 0 : frac || 0)) / n, 0, 1), items: list ? list.items : null, story: storyStep(),
             far: t ? Math.round(Math.hypot(t.x - pp.x, t.z - pp.z)) : null };
  }
  if (G.sandbox){
    const room = ((shared.arenaLevel && shared.arenaLevel.name.split('—')[1]) || 'THE TRAINING ROOM').trim();
    const left = hostilesLeft();
    return { kicker: 'SANDBOX · ' + room, title: 'FREE PLAY', task: 'No objective here: try powers and foes at your own pace. ' + (pad.active ? PAD_GLYPHS[pad.family].VIEW : 'B') + ' opens foes and powers.',
             step: '', status: left ? left + ' HOSTILE' + (left === 1 ? '' : 'S') + ' ON THE FIELD' : '', overall: null };
  }
  const left = hostilesLeft();
  const remain = left ? left + ' HOSTILE' + (left === 1 ? '' : 'S') + ' REMAIN' : 'NEXT WAVE INCOMING';
  if (G.endless){
    const mut = G.mut ? MUTATORS.find(m => m.id === G.mut) : null;
    return { kicker: 'SURVIVAL', title: 'SURVIVE', task: 'Hold out as long as you can: every wave hits harder than the last.' + (mut ? ' This run: ' + mut.name + '.' : ''),
             step: G.endlessWave ? 'WAVE ' + G.endlessWave : 'FIRST WAVE', status: remain, overall: null };
  }
  // a wave chapter of the story, or a classic level
  const L = LEVELS[G.levelIdx] || { name: '', waves: [] };
  const from = G.waveFrom || 0, end = G.waveEnd ?? L.waves.length, count = Math.max(1, end - from);
  const kicker = G.chapter >= 0 ? chapterLabel() : 'LEVEL ' + (G.levelIdx + 1) + ' · ' + (L.name.split('—')[1] || L.name).trim();
  if (shared.boss){
    const b = shared.boss, hp = b.maxHp ? clamp(b.hp / b.maxHp, 0, 1) : null;
    const who = ((document.getElementById('bossname') || {}).textContent || '').trim();
    return { kicker, title: 'DEFEAT ' + (who ? who.toUpperCase() : 'THE BOSS'), task: 'Every wave is down. Bring the boss down to finish it.', step: 'BOSS FIGHT',
             status: hp != null ? Math.ceil(hp * 100) + '% OF THEIR STRENGTH LEFT' : '', frac: hp != null ? 1 - hp : null,
             overall: clamp((count + (hp != null ? 1 - hp : 0)) / (count + 1), 0, 1), story: storyStep() };
  }
  const w = clamp(G.wave - from + 1, 1, count);
  return { kicker, title: 'HOLD OUT FOR ' + count + ' WAVE' + (count === 1 ? '' : 'S'), task: 'Clear every wave to win the ' + (G.chapter >= 0 ? 'chapter' : 'level') + '.',
           step: 'WAVE ' + w + ' OF ' + count, status: remain, overall: clamp((w - 1) / count, 0, 1), story: storyStep() };
}

/* ---------- the card ---------- */
const el = document.createElement('div');
el.id = 'objview';
document.body.appendChild(el);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bar = (f, cls = '') => '<span class="ov-bar' + cls + '"><i style="width:' + (clamp(f, 0, 1) * 100).toFixed(1) + '%"></i></span>';
let last = '';
export function renderObjectiveView(){
  const on = held && G.mode === 'play' && !G.cutscene && !G.paused && !G.cardUp;
  const info = on ? objectiveInfo() : null;
  el.classList.toggle('on', !!info);
  document.body.classList.toggle('objview', !!info);
  if (!info) return;
  const rows = info.items && info.items.length > 1 ? '<div class="ov-list">' + info.items.map(i =>
    '<div class="ov-i' + (i.done ? ' done' : i.now ? ' now' : '') + '"><b>' + (i.done ? '✓' : i.now ? '▶' : '○') + '</b><span>' + esc(i.text) + '</span></div>').join('') + '</div>' : '';
  const html = '<div class="ov-k">' + esc(info.kicker) + '</div>' +
    (info.step ? '<div class="ov-step">' + esc(info.step) + '</div>' : '') +
    '<div class="ov-h">' + esc(info.title) + '</div>' +
    (info.task ? '<div class="ov-t">' + esc(info.task) + '</div>' : '') +
    (info.status || info.frac != null ? '<div class="ov-s' + (info.warn ? ' warn' : '') + '">' + esc(info.status) + (info.far != null && info.far >= 7 ? ' <em>· ' + info.far + ' M AWAY</em>' : '') +
      (info.frac != null ? bar(info.frac) : '') + '</div>' : (info.far != null && info.far >= 7 ? '<div class="ov-s"><em>' + info.far + ' M AWAY</em></div>' : '')) +
    rows +
    (info.overall != null ? '<div class="ov-p"><span>PROGRESS</span>' + bar(info.overall, ' all') + '<span>' + Math.round(info.overall * 100) + '%</span></div>' : '') +
    (info.story ? '<div class="ov-story">STORY · ' + esc(info.story.label) + ' · ' + info.story.n + ' OF ' + info.story.of + '</div>' : '');
  if (html !== last){ last = html; el.innerHTML = html; }
}
