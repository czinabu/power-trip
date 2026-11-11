// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Floating combat text and the full-screen flash.

import { camera } from '../engine/renderer.js';
import { rand, TMP } from '../utils.js';
import { G, isGunner } from '../state.js';
import { CALL, TIER, rankOf } from '../data/callouts.js';

/* ---------- floating damage text ---------- */
// Damage numbers come from a fixed POOL of recycled divs (built once, lazily) rather
// than create+remove per hit — no DOM churn during heavy combat. 48 is far more than
// can be read at once, and the ring buffer just restarts the oldest when it wraps.
const FLOATER_MAX = 48;
const _floaters = [];
let _flHead = 0;
function initFloaters(){
  const hud = document.getElementById('hud');
  for (let i = 0; i < FLOATER_MAX; i++){
    const d = document.createElement('div');
    d.className = 'fl'; d.style.opacity = '0';
    hud.appendChild(d);
    _floaters.push(d);
  }
}
/* ---------- one word at a time (data/callouts.js) ----------
   Every WORD is ranked, and one shows at a time: a higher rank replaces the word that is up, the same rank takes over
   once it has been read, a lower one waits briefly or is dropped. ROUTINE words are handed to the cue (fx/cues.js: a
   glint on the blade, a chime) once they have been shown CALL.teach times. Numbers go straight through. */
let _cur = null;    // the word that is up: { el, tier, t0, end } (ms, performance.now)
let _next = null;   // the one word waiting its turn: { pos, text, color, big, r, at }
let _nextTimer = 0;
let _cue = null;
const _taught = new Map();
const _stats = { shown: 0, replaced: 0, waited: 0, dropped: 0, quiet: 0 };
/* fx/cues.js registers what a quiet ROUTINE word does instead: fn(cue, worldPos, cssColor) */
export function onQuietWord(fn){ _cue = fn; }
export const wordUp = () => _cur && performance.now() < _cur.end ? _cur.el.textContent : '';
export const wordStats = () => ({ ..._stats, up: wordUp(), waiting: _next ? _next.text : '' });
export function clearWords(){ if (_cur){ _cur.el.style.transition = 'none'; _cur.el.style.opacity = '0'; } _cur = _next = null; clearTimeout(_nextTimer); _taught.clear(); }

const isNumber = (t) => typeof t === 'number' || /^[+\-−]?\d+$/.test(t);
function tierFor(r){ return isGunner() && r.tier < TIER.NOTICE ? TIER.NOTICE : r.tier; }   // (ROUTINE and MINOR only quiet the Jedi)

function say(worldPos, text, color, big, kind){
  const r = rankOf(text, kind), tier = tierFor(r), now = performance.now();
  if (tier === TIER.ROUTINE && !G.training && (_taught.get(text) || 0) >= CALL.teach){
    _stats.quiet++; if (_cue && r.cue) _cue(r.cue, worldPos, color);
    return;
  }
  if (_cur && now < _cur.end){
    const over = tier > _cur.tier || (tier === _cur.tier && tier >= CALL.waits && now - _cur.t0 >= CALL.minRead * 1000);
    if (!over){
      if (tier >= CALL.waits){   // it waits its turn (one waits at a time: the higher rank, then the newer)
        if (!_next || tier >= _next.tier){ _next = { pos: TMP.clone().copy(worldPos), text, color, big, tier, at: now }; _stats.waited++; }
        else _stats.dropped++;
        clearTimeout(_nextTimer);
        _nextTimer = setTimeout(sayNext, Math.max(16, (_next.tier === _cur.tier ? _cur.t0 + CALL.minRead * 1000 : _cur.end) - now));
      } else { _stats.dropped++; if (_cue && r.cue) _cue(r.cue, worldPos, color); }
      return;
    }
    cut();   // the new word has the floor
  }
  if (tier === TIER.ROUTINE) _taught.set(text, (_taught.get(text) || 0) + 1);
  const el = big ? showBig(worldPos, text, color) : showWord(worldPos, text, color);
  if (el){ _cur = { el, tier, t0: now, end: now + (big ? CALL.big : CALL.word) * 1000 }; _stats.shown++; }
}
// (the running fade's target is already 0, so only dropping the transition takes the old word off at once)
function cut(){ _cur.el.style.transition = 'none'; _cur.el.style.opacity = '0'; _stats.replaced++; }
function sayNext(){
  const n = _next, now = performance.now();
  if (!n) return;
  if (now - n.at > CALL.stale * 1000){ _next = null; _stats.dropped++; return; }
  if (_cur && now < _cur.end && n.tier < _cur.tier){ _nextTimer = setTimeout(sayNext, _cur.end - now + 4); return; }   // (a timer can fire a hair early, or something bigger took the floor: wait it out)
  _next = null;
  if (_cur && now < _cur.end) cut();
  const el = n.big ? showBig(n.pos, n.text, n.color) : showWord(n.pos, n.text, n.color);
  if (el){ _cur = { el, tier: n.tier, t0: now, end: now + (n.big ? CALL.big : CALL.word) * 1000 }; _stats.shown++; }
}

function take(){
  if (!_floaters.length) initFloaters();
  let d = _floaters[_flHead]; _flHead = (_flHead + 1) % FLOATER_MAX;
  if (_cur && d === _cur.el && performance.now() < _cur.end){ d = _floaters[_flHead]; _flHead = (_flHead + 1) % FLOATER_MAX; }   // (a burst of numbers never recycles the word that is up)
  return d;
}

/* floater(pos, text, color[, kind]): a number rises and fades as ever; a word goes through the ranking above.
   `kind` (optional) is the call site's own rank for a label built from data: see data/callouts.js KINDS */
export function floater(worldPos, text, color, kind){
  if (!isNumber(text)) return say(worldPos, String(text), color, false, kind);
  TMP.copy(worldPos); TMP.y += 2.2;
  TMP.project(camera);
  if (TMP.z > 1) return;
  const d = take();
  // snap back to the start pose WITHOUT animating, then let the CSS transition carry it up
  d.style.transition = 'none'; d.className = 'fl';
  d.textContent = text;
  d.style.color = color || '#fff';
  d.style.left = ((TMP.x*0.5+0.5)*innerWidth + rand(-14,14)) + 'px';
  d.style.top  = ((-TMP.y*0.5+0.5)*innerHeight) + 'px';
  d.style.transform = 'translate(-50%,-50%)';
  d.style.opacity = '1';
  void d.offsetWidth;   // force reflow so the reset lands before the rise animates
  requestAnimationFrame(()=>{
    d.style.transition = 'all .7s ease-out';
    d.style.transform = 'translate(-50%,-180%)';
    d.style.opacity = '0';
  });
}
// a small word: it is the only one up, so it is held bright long enough to read, then fades as it rises
function showWord(worldPos, text, color){
  TMP.copy(worldPos); TMP.y += 2.2;
  TMP.project(camera);
  if (TMP.z > 1) return null;
  const d = take();
  d.style.transition = 'none'; d.className = 'fl word';
  d.textContent = text;
  d.style.color = color || '#fff';
  d.style.left = (Math.min(0.94, Math.max(0.06, TMP.x*0.5+0.5)) * innerWidth) + 'px';
  d.style.top  = (Math.min(0.9, Math.max(0.08, -TMP.y*0.5+0.5)) * innerHeight) + 'px';
  d.style.transform = 'translate(-50%,-50%)';
  d.style.opacity = '1';
  void d.offsetWidth;
  requestAnimationFrame(()=>{
    if (d.textContent !== text) return;
    d.style.transition = 'transform ' + CALL.word + 's ease-out, opacity ' + (CALL.word - CALL.wordHold) + 's ease-in ' + CALL.wordHold + 's';
    d.style.transform = 'translate(-50%,-150%)';
    d.style.opacity = '0';
  });
  return d;
}

/* A CALLOUT: the result of an exchange (CLEAN BLOCK, WRONG SIDE, PARRY, BLOCKED), where the eye already is: at
   `worldPos` itself (between the two blades), big and bright, popping in over-size, held a beat, then gone.
   It is ranked like every other word (data/callouts.js) */
export function callout(worldPos, text, color, kind){ say(worldPos, String(text), color, true, kind); }
function showBig(worldPos, text, color){
  TMP.copy(worldPos).project(camera);
  if (TMP.z > 1) return null;
  const d = take();
  d.style.transition = 'none'; d.className = 'fl call';
  d.textContent = text;
  d.style.color = color || '#fff';
  d.style.left = (Math.min(0.9, Math.max(0.1, TMP.x*0.5+0.5)) * innerWidth) + 'px';
  d.style.top  = (Math.min(0.85, Math.max(0.12, -TMP.y*0.5+0.5)) * innerHeight) + 'px';
  d.style.transform = 'translate(-50%,-50%) scale(1.5)';
  d.style.opacity = '1';
  void d.offsetWidth;
  requestAnimationFrame(()=>{
    if (d.textContent !== text) return;
    d.style.transition = 'transform .12s ease-out, opacity .3s ease-in .45s';
    d.style.transform = 'translate(-50%,-70%) scale(1)';
    d.style.opacity = '0';
  });
  return d;
}

/* ---------- full-screen clash flash (parries, ripostes, big beats) ---------- */
let _flashEl = null;
/* Flash safety: full-screen flashes are the one effect that can wear on a player in a long fight, so they are limited
   centrally (every caller goes through here). More than three in a second are dimmed to a faint tint, a player who has
   asked their system for reduced motion gets them at half strength, and none ever peaks above 0.9. */
const _flashLog = [];
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; } })();
export function screenFlash(bg, peak, dur){
  const now = performance.now();
  while (_flashLog.length && now - _flashLog[0] > 1000) _flashLog.shift();
  if (_flashLog.length >= 3) peak *= 0.35;
  _flashLog.push(now);
  peak = Math.min(peak * G.flashScale, 0.9) * (REDUCED ? 0.5 : 1);   // × the FLASHES setting
  if (peak <= 0.01) return;
  _flashEl = _flashEl || document.getElementById('flash');
  _flashEl.style.transition = 'none';
  _flashEl.style.background = bg;
  _flashEl.style.opacity = String(peak);
  requestAnimationFrame(() => {
    _flashEl.style.transition = 'opacity ' + (dur || 0.3) + 's ease-out';
    _flashEl.style.opacity = '0';
  });
}
