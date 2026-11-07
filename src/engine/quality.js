// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Graphics quality presets (cycle with P).

import { renderer, composer, bloomPass, aoPass, setMSAA, sun } from './renderer.js';

/* ============================================================
   GRAPHICS QUALITY — an escape valve for weaker machines. Cycle with 'P'
   (saved to localStorage). We only touch render-state levers that DON'T force
   shader recompiles: pixel ratio (the biggest lever), shadow-map resolution,
   antialiasing (multisampling the composer's buffers), the ambient-occlusion and
   bloom passes, and the CSS film grain. Shadows stay ON at every tier. On top of the tier, the frame-rate governor (below)
   scales the resolution to hold the screen's refresh rate.
   ============================================================ */
const QUALITY_LEVELS = ['low', 'medium', 'high'];
const QUALITY = {
  low:    { pixelRatio: 1,    shadowMap: 512,  msaa: 0, ao: false, bloom: false, grain: false },
  medium: { pixelRatio: 1.5,  shadowMap: 1024, msaa: 4, ao: false, bloom: true,  grain: false },
  high:   { pixelRatio: 2,    shadowMap: 2048, msaa: 4, ao: true,  bloom: true,  grain: false },
};
const readKey = (k) => { try { return localStorage.getItem(k); } catch(e){ return null; } };
// a tier picked with P (jpt_quality) always wins; otherwise start on HIGH, or wherever the auto governor last settled
let manualQuality = QUALITY_LEVELS.includes(readKey('jpt_quality'));
let qualityIdx = QUALITY_LEVELS.indexOf(readKey(manualQuality ? 'jpt_quality' : 'jpt_quality_auto'));
/* where a first visit starts: HIGH, or MEDIUM on a phone or tablet (a touch screen's GPU drawing HIGH's ambient occlusion
   at twice the pixels is what the governor below would step down from anyway, after the first stuttering seconds of
   play). P, or the pause menu's GRAPHICS, still puts it on HIGH */
const touchFirst = () => { try { return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch(e){ return false; } };
const defaultIdx = () => touchFirst() ? 1 : 2;
if (qualityIdx < 0) qualityIdx = defaultIdx();   // default HIGH (MEDIUM on a touch device)
/* RESOLUTION SCALE — a share of the tier's pixel ratio (1 = the tier's full resolution). AUTO (the RESOLUTION setting)
   lets the frame-rate governor below move it in steps to hold the screen's refresh rate; FULL keeps it at 1. The last
   scale is remembered (jpt_rscale) so the next visit starts where this one settled, not at a stutter */
const RES_STEPS = [1, 0.9, 0.8, 0.7, 0.6];
let autoRes = readKey('jpt_autores') !== '0';
let resStep = Math.max(0, RES_STEPS.indexOf(+readKey('jpt_rscale')));
let resScale = RES_STEPS[resStep];
function applyQuality(){
  const q = QUALITY[QUALITY_LEVELS[qualityIdx]];
  const pr = Math.max(0.5, Math.min(devicePixelRatio, q.pixelRatio) * (autoRes ? resScale : 1));
  renderer.setPixelRatio(pr);
  // the composer keeps a pixel ratio of its own (read once, when it was made): without this every tier, and the
  // resolution scale, still drew the scene, the AO and the bloom at the full screen resolution, only the canvas shrank
  composer.setPixelRatio(pr);
  if (sun.shadow.mapSize.width !== q.shadowMap){
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }   // rebuild at the new size
  }
  bloomPass.enabled = q.bloom;
  aoPass.enabled = q.ao;
  setMSAA(q.msaa);
  const grain = document.getElementById('grain');
  if (grain) grain.style.display = q.grain ? '' : 'none';
  renderer.setSize(innerWidth, innerHeight);   // pixel-ratio change needs a resize to take hold
  composer.setSize(innerWidth, innerHeight);
  const gv = document.getElementById('gfxval');   // keep the pause-menu selector label in sync
  if (gv) gv.textContent = QUALITY_LEVELS[qualityIdx].toUpperCase();
}
/* the tier in use right now ('low' | 'medium' | 'high'): for builders that scale how much they scatter (world/grass.js) */
export const qualityLevel = () => QUALITY_LEVELS[qualityIdx];
export function cycleQuality(){
  qualityIdx = (qualityIdx + 1) % QUALITY_LEVELS.length;
  manualQuality = true;   // the player has taken the wheel: the auto governor stands down
  try { localStorage.setItem('jpt_quality', QUALITY_LEVELS[qualityIdx]); } catch(e){}
  applyQuality();
  showQualityToast();
}
/* Settings · RESET TO DEFAULTS: forget the picked tier and the governor's, start again on the default tier (the governor may still step down) */
export function resetQuality(){
  manualQuality = false; qualityIdx = defaultIdx(); resStep = 0; resScale = 1;
  try { for (const k of ['jpt_quality', 'jpt_quality_auto', 'jpt_rscale']) localStorage.removeItem(k); } catch(e){}
  applyQuality();
  setFrameCap(0); setAutoRes(true); setFpsCounter(false);
}
function showQualityToast(msg){
  let t = document.getElementById('qtoast');
  if (!t){
    t = document.createElement('div'); t.id = 'qtoast';
    t.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:40;' +
      'padding:8px 20px;border-radius:10px;background:rgba(7,17,31,.85);border:1px solid rgba(108,168,214,.4);' +
      'color:#bfe8ff;font:600 12px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:3px;' +
      'backdrop-filter:saturate(1.1) blur(6px);transition:opacity .3s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg || 'GRAPHICS: ' + QUALITY_LEVELS[qualityIdx].toUpperCase() + '  ·  P';
  t.style.opacity = '1';
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, msg ? 3500 : 1400);
}
/* ============================================================
   FRAME RATE — the screen's refresh rate (sensed), the FRAME RATE cap, the resolution governor and the FPS counter.
   Works the same in every mode: it only reads how fast frames come and moves render-state levers.
   ============================================================ */
/* REFRESH RATE — the browser calls the loop once per screen refresh, so the gap between calls, when a frame has nothing
   to do, is the screen's refresh (60, 120, 144 Hz...). A busy frame can't tell: a game that only makes every other
   refresh on a 144 Hz screen looks just like a 72 Hz one. So the first frames after the page loads (on the loading
   screen) do nothing at all and are timed, and the rate is snapped to the common ones and remembered (jpt_hz) for the
   next visit. After that every frame still adds to it (the menus are quick, so a higher rate shows there), and it only
   ever goes up */
const HZ = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 170, 180, 200, 240, 280, 300, 360];
const snapHz = (hz) => { const s = HZ.reduce((a, b) => Math.abs(b - hz) < Math.abs(a - hz) ? b : a); return Math.abs(s - hz) / s > 0.07 ? Math.round(hz) : s; };
let displayHz = +readKey('jpt_hz') || 0, lastRaf = 0, probeLeft = 60, probeEnd = 0;
const rafGaps = [], probeGaps = [];
function noteHz(hz){
  if (hz <= displayHz) return;
  displayHz = Math.min(hz, 500);
  try { localStorage.setItem('jpt_hz', String(displayHz)); } catch(e){}
}
/* true while the boot probe holds the loop back */
function senseRefresh(now){
  const gap = now - lastRaf; lastRaf = now;
  const ok = !document.hidden && gap > 0 && gap < 50;
  if (probeLeft > 0){
    probeLeft--;
    if (!probeEnd) probeEnd = now + 400;   // never more than this: a slow machine's boot mustn't wait on it
    if (ok) probeGaps.push(gap);
    if (probeGaps.length >= 16 || probeLeft === 0 || now > probeEnd){
      probeLeft = 0;
      if (probeGaps.length >= 6){ probeGaps.sort((a, b) => a - b); const hz = snapHz(1000 / probeGaps[probeGaps.length >> 1]); displayHz = 0; noteHz(hz); }
      probeGaps.length = 0;
    }
    return probeLeft > 0;
  }
  if (!ok) return false;
  rafGaps.push(gap);
  if (rafGaps.length < 90) return false;
  rafGaps.sort((a, b) => a - b);
  noteHz(snapHz(1000 / rafGaps[Math.floor(rafGaps.length * 0.25)]));
  rafGaps.length = 0;
  return false;
}
/* the rate the governor holds: the screen's refresh, or the FRAME RATE cap when that's lower */
const targetFps = () => Math.min(displayHz || 60, frameCap || Infinity);

/* FRAME RATE cap (Settings): 0 = MATCH SCREEN (a frame on every refresh), or at most 144 / 120 / 60 / 30 a second, which
   saves power and heat on a laptop. Frames past the cap are skipped whole (no update, no draw) */
export const FRAME_CAPS = [0, 144, 120, 60, 30];
let frameCap = FRAME_CAPS.includes(+readKey('jpt_fpscap')) ? +readKey('jpt_fpscap') : 0;
let lastDrawn = 0;
export const frameCapNow = () => frameCap;
export function setFrameCap(v){
  frameCap = FRAME_CAPS.includes(v) ? v : 0;
  try { localStorage.setItem('jpt_fpscap', String(frameCap)); } catch(e){}
  resetGovernor(performance.now());
  const el = document.getElementById('fpscapval'); if (el) el.textContent = frameCap ? frameCap + ' FPS' : 'MATCH SCREEN';
}
/* RESOLUTION (Settings): AUTO lets the governor move the resolution scale, FULL keeps the tier's full resolution */
export const autoResNow = () => autoRes;
export function setAutoRes(on){
  autoRes = !!on;
  try { localStorage.setItem('jpt_autores', autoRes ? '1' : '0'); } catch(e){}
  if (!autoRes) setResStep(0, performance.now());
  resetGovernor(performance.now());
  const el = document.getElementById('resval'); if (el) el.textContent = autoRes ? 'AUTO' : 'FULL';
}

/* FPS COUNTER (Settings): frames drawn a second, the screen's rate, and the resolution scale when it's below full */
let fpsOn = readKey('jpt_fpscounter') === '1', fpsEl = null, fpsT = 0, fpsN = 0;
export const fpsCounterNow = () => fpsOn;
export function setFpsCounter(on){
  fpsOn = !!on;
  try { localStorage.setItem('jpt_fpscounter', fpsOn ? '1' : '0'); } catch(e){}
  if (!fpsOn && fpsEl) fpsEl.style.display = 'none';
  fpsT = 0; fpsN = 0;
  const el = document.getElementById('fpsval'); if (el) el.textContent = fpsOn ? 'ON' : 'OFF';
}
function countFrame(now){
  if (!fpsOn) return;
  if (!fpsEl){
    fpsEl = document.createElement('div'); fpsEl.id = 'fpscounter';
    fpsEl.style.cssText = 'position:fixed;top:6px;right:8px;z-index:60;padding:3px 8px;border-radius:6px;background:rgba(7,17,31,.6);' +
      'color:#bfe8ff;font:600 11px/1.2 ui-monospace,Consolas,monospace;letter-spacing:1px;pointer-events:none;white-space:nowrap';
    document.body.appendChild(fpsEl);
  }
  fpsEl.style.display = '';
  if (!fpsT){ fpsT = now; fpsN = 0; return; }
  fpsN++;
  if (now - fpsT < 500) return;
  const fps = Math.round(fpsN * 1000 / (now - fpsT));
  fpsT = now; fpsN = 0;
  fpsEl.textContent = fps + ' FPS' + (displayHz ? '  ·  ' + displayHz + ' HZ' : '') + (resScale < 1 ? '  ·  RES ' + Math.round(resScale * 100) + '%' : '');
}

/* the main loop's first call each frame: senses the refresh rate, holds a frame back when it would beat the FRAME RATE
   cap (false: skip this frame whole), and puts in a resolution change the governor asked for last frame. (A resize
   clears the canvas, so it's made before the frame's draw, never after it: no black flash.) */
let pendingApply = false, frameT0 = 0;
export function frameStart(){
  const now = frameT0 = performance.now();
  if (senseRefresh(now)) return false;   // the boot probe: a few empty frames on the loading screen, timed
  if (frameCap && !document.hidden){
    const iv = 1000 / frameCap, since = now - lastDrawn;
    if (since < iv - 2) return false;
    lastDrawn = since > iv * 3 ? now : now - (since % iv);
  }
  if (pendingApply){ pendingApply = false; applyQuality(); }
  countFrame(now);
  return true;
}

/* GOVERNOR — holds the screen's refresh rate (or the cap) by moving the resolution scale in steps, and as a last resort
   steps the GRAPHICS tier down. Counts only real play frames, in one-second windows: the first seconds after a load or a
   mode switch are shader compiles, a hidden tab or a pause isn't the GPU's fault.
   - two windows short of the target (under 92%): one step down in resolution (unless the game's own script already takes
     the whole frame). If the next window isn't quicker, one more step (with vsync a frame a little too slow waits a whole
     refresh, so one step may not show); still no quicker and the frame isn't waiting on pixels (the CPU is the limit:
     many foes, many draws), so the steps are taken back and it isn't tried again for a while (30 s, doubling)
   - four windows on target: one step back up. If that drops it short again, it's taken back and tried later (8 s, doubling)
   - five windows under 40 fps with the resolution already as low as it goes (or not the limit): one GRAPHICS tier down,
     never back up and never once a tier was picked by hand; remembered (jpt_quality_auto) for the next visit */
const WINDOW_MS = 1000, GRACE_MS = 4000, SLOW_FPS = 40, SETTLE_MS = 600;
let winStart = 0, winFrames = 0, lastFrame = 0, graceUntil = performance.now() + GRACE_MS;
let lowWins = 0, okWins = 0, slowWins = 0, probe = 0, probeFps = 0, winJs = 0;
let downLockUntil = 0, downLockMs = 30000, upLockUntil = 0, upLockMs = 8000;
function resetGovernor(now){
  winStart = 0; winFrames = 0; lowWins = okWins = slowWins = 0; probe = 0;
  downLockUntil = upLockUntil = 0; downLockMs = 30000; upLockMs = 8000; graceUntil = Math.max(graceUntil, now + SETTLE_MS);
}
function setResStep(i, now){
  i = Math.max(0, Math.min(RES_STEPS.length - 1, i));
  if (i === resStep) return;
  resStep = i; resScale = RES_STEPS[i];
  try { localStorage.setItem('jpt_rscale', String(resScale)); } catch(e){}
  pendingApply = true;
  graceUntil = Math.max(graceUntil, now + SETTLE_MS);   // the window after a resize would count its reallocation hitch
  winStart = 0; winFrames = 0;
}
export const resolutionInfo = () => ({ scale: resScale, step: resStep, auto: autoRes, displayHz, target: targetFps(), cap: frameCap,
  pixelRatio: renderer.getPixelRatio(), downLocked: performance.now() < downLockUntil });
export function qualityGovernor(playing){
  const now = performance.now(), gap = now - lastFrame; lastFrame = now;
  if (document.hidden || !playing || gap > 250){   // paused, menus, tab switch, a hitch
    winStart = 0; winFrames = 0; winJs = 0; probe = 0; if (!playing) graceUntil = Math.max(graceUntil, now + 1500); return;
  }
  if (now < graceUntil) return;
  if (!winStart){ winStart = now; winFrames = 0; return; }
  winFrames++; winJs += now - frameT0;
  if (now - winStart < WINDOW_MS) return;
  const fps = winFrames * 1000 / (now - winStart), target = targetFps(), jsMs = winJs / winFrames;
  winStart = 0; winFrames = 0; winJs = 0;
  const lastStep = RES_STEPS.length - 1;
  // the window right after a step: did it help?
  if (probe < 0){
    if (fps >= probeFps * 1.06){ probe = 0; return; }   // it helped: keep it
    // with vsync a frame that's a little too slow waits a whole refresh, so one step may not show yet: try one more
    if (probe === -1 && resStep < lastStep){ probe = -2; setResStep(resStep + 1, now); return; }
    setResStep(resStep - (probe === -2 ? 2 : 1), now); downLockUntil = now + downLockMs; downLockMs = Math.min(downLockMs * 2, 300000);
    probe = 0;
    return;
  }
  if (probe > 0){
    probe = 0;
    if (fps < target * 0.92){ setResStep(resStep + 1, now); upLockUntil = now + upLockMs; upLockMs = Math.min(upLockMs * 2, 120000); }
    return;
  }
  if (autoRes){
    const r = fps / target;
    if (r < 0.92){
      okWins = 0; lowWins++;
      // (not when the game's own script already takes the whole frame: fewer pixels won't make that any quicker)
      if (lowWins >= 2 && resStep < lastStep && now >= downLockUntil && jsMs < 900 / target){ lowWins = 0; probe = -1; probeFps = fps; setResStep(resStep + 1, now); return; }
    } else if (r >= 0.97){
      lowWins = 0; okWins++;
      if (okWins >= 4 && resStep > 0 && now >= upLockUntil){ okWins = 0; probe = 1; setResStep(resStep - 1, now); return; }
    } else { lowWins = 0; okWins = 0; }
  }
  // last resort: a whole tier down
  slowWins = fps < SLOW_FPS ? slowWins + 1 : 0;
  if (slowWins < 5 || manualQuality || qualityIdx === 0) return;
  if (autoRes && resStep < lastStep && now >= downLockUntil) return;   // resolution can still give
  slowWins = 0; qualityIdx--; graceUntil = now + GRACE_MS;
  try { localStorage.setItem('jpt_quality_auto', QUALITY_LEVELS[qualityIdx]); } catch(e){}
  pendingApply = true;
  showQualityToast('GRAPHICS LOWERED TO ' + QUALITY_LEVELS[qualityIdx].toUpperCase() + ' FOR SMOOTHER PLAY  ·  P TO CHANGE');
}
applyQuality();   // honor the saved preset on load
setFrameCap(frameCap); setAutoRes(autoRes); setFpsCounter(fpsOn);   // (and the Settings labels)
