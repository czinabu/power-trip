// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// End of run: run summary and victory.

import { autosave } from './autosave.js';
import { setScreen, runEarns } from './run-state.js';
import { clamp } from '../utils.js';
import { G, player } from '../state.js';
import { BOON_BY_ID } from '../data/boons.js';
import { showBanner } from '../ui/banners.js';
import { icon } from '../ui/icons.js';
import { overlay, survivalUnlocked, refreshSurvivalLock, refreshGateLock, setOverlayState } from '../ui/menus.js';
import { closeReadout } from './readout.js';
import { readoutSummaryHtml } from '../ui/readout-ui.js';
import { campaignWon } from './campaign.js';
import { storyHero, epilogueText } from '../data/campaign.js';
import { noteEnding, gateOpen, GATE_WIN } from './gate.js';
import { TROOPER_VICTORY } from '../data/campaign-trooper.js';
import { isArcadeId } from '../data/arcade.js';
import { noteCampaignWon, ngNextTier } from './profile.js';
import { tierName, NG_WORDS } from '../data/ngplus.js';
import { medalResultsHtml } from '../ui/medals-ui.js';

/* ---------- END-OF-RUN SUMMARY + SCORE ---------- */
export function endRun(won, medals = null){   // medals: a mission's (game/medals.js medalsResult), for the results screen
  const st = G.stats; if (!st || st._ended) return;   // compute once per end (cleared on re-entering play)
  st._ended = true;
  closeReadout();
  const elapsed = medals ? medals.time : Math.max(0, G.gt - (st.startGt || 0));   // (a mission's medals clock runs through its retries: the time shown is the one its par is held to)
  const endless = !!G.endless;
  const waves = endless ? (G.endlessWave || 0) : clamp((G.waveTotal || 0) + 1, 0, 99);
  const acc = st.shotsFired > 0 ? st.shotsHit / st.shotsFired : -1;
  const score = Math.max(0, Math.round(
    st.kills * 12 + waves * (endless ? 200 : 120) + st.bestStreak * 20 + (st.parries + st.deflects) * 15 +
    (st.bossKilled ? 1500 : 0) + (acc > 0 ? acc * 400 : 0) - st.dmgTaken * 0.35));
  const mission = !!G.mission && G.chapter < 0;   // (a campaign chapter that is a mission still counts as the campaign)
  const key = endless ? 'sw_best_endless' : mission ? (isArcadeId(G.missionId) ? 'sw_best_arcade' : 'sw_best_mission') : 'sw_best_score';   // survival, missions and the arcade keep their OWN bests
  let best = 0; try { best = parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch(e){}
  const newBest = score > best && runEarns();   // (a fall in training sets no best: game/run-state.js)
  if (newBest){ try { localStorage.setItem(key, String(score)); } catch(e){} best = score; }
  st.summary = { won, elapsed, waves, acc, score, best, newBest, endless, mission, medals };
  renderRunSummary();
}
function renderRunSummary(){
  const st = G.stats, s = st && st.summary, el = document.getElementById('runsummary');
  if (!s || !el) return;
  const mm = Math.floor(s.elapsed / 60), ss = Math.round(s.elapsed % 60);
  const timeStr = mm + ':' + (ss < 10 ? '0' : '') + ss;
  const stat = (label, val) => '<div class="rs-stat"><div class="rs-v">' + val + '</div><div class="rs-l">' + label + '</div></div>';
  let grid = stat('TIME', timeStr) + (s.mission ? '' : stat(s.endless ? 'WAVE REACHED' : 'WAVES', s.waves)) + stat('KILLS', st.kills) +
             stat('BEST STREAK', '×' + st.bestStreak) + stat('DEFENSE', st.parries + st.deflects);
  if (s.acc >= 0) grid += stat('ACCURACY', Math.round(s.acc * 100) + '%');
  grid += stat('DMG TAKEN', Math.round(st.dmgTaken));
  const title = s.endless ? 'SURVIVAL ENDED' : s.mission ? (s.won ? 'MISSION COMPLETE' : 'MISSION FAILED') : (s.won ? 'VICTORY' : 'YOU HAVE FALLEN');
  let boonHtml = '';
  if (player.boons && Object.keys(player.boons).length){
    let items = '';
    for (const id in player.boons){ const b = BOON_BY_ID[id]; if (!b) continue;
      items += '<span class="' + b.r + '">' + icon(b.ico) + b.nm + (player.boons[id] > 1 ? ' ×' + player.boons[id] : '') + '</span>';
    }
    boonHtml = '<div class="rs-boons"><div class="rs-bl">YOUR BUILD</div>' + items + '</div>';
  }
  el.innerHTML =
    '<div class="rs-title">' + title + '</div>' +
    '<div class="rs-score">SCORE <b>' + s.score.toLocaleString() + '</b>' +
      (s.newBest ? '<span class="rs-best new">★ NEW BEST</span>' : '<span class="rs-best">BEST ' + s.best.toLocaleString() + '</span>') + '</div>' +
    (s.medals ? medalResultsHtml(s.medals) : '') +
    '<div class="rs-grid">' + grid + '</div>' +
    boonHtml + readoutSummaryHtml();
  el.style.display = 'block';
}

// THE WIN, KEPT: this hero's campaign clear is recorded (and the autosave written) the moment the last boss falls, before
// the epilogue plays, so closing the game during the epilogue or on the win screen never loses it. Once per run (G.stats
// is the run's own); the win screen reads what was open before it from here. The ending it closed on waits for the
// epilogue (a story's last choice is asked there: game/campaign.js campaignWon), and is saved again with it.
function recordWin(){
  const st = G.stats || {};
  if (st._win) return st._win;
  const rec = st._win = { hadBoth: survivalUnlocked(), ngBefore: ngNextTier(G.hero), ngRun: G.ngPlus || 0, hadGate: gateOpen(), gate: storyHero() === 'gate' };
  // record this hero's CAMPAIGN clear — SURVIVAL unlocks once BOTH heroes have finished the campaign
  if (rec.gate){ try { localStorage.setItem('sw_camp_gate_' + G.hero, '1'); } catch(e){} }   // ACT IV (game/gate.js): its own mark, not a story's
  else {
    try { localStorage.setItem('sw_camp_' + G.hero, '1'); } catch(e){}
    noteCampaignWon();   // your profile: the post-game rank asks for this (game/profile.js)
  }
  autosave('campaign won', { finished: true });
  return rec;
}
export function victory(afterEpilogue){
  if (!afterEpilogue && G.chapter >= 0 && G.mode === 'play'){ recordWin(); campaignWon(() => victory(true)); return; }   // the campaign's end: kept at once, then its epilogue
  const rec = recordWin(), { hadBoth, ngBefore, ngRun, hadGate, gate } = rec;
  if (!gate && !rec.ended){
    rec.ended = true;
    noteEnding(storyHero(), G.story, epilogueText('title'));   // what this story ended on, for Act IV's recap and epilogue
    autosave('ending', { finished: true });
  }
  endRun(true);
  setScreen('victory', 'run won');
  G.slowmo = 1; G.slowmoT = 0;   // the fight is won — drop out of slow motion
  const newlyUnlocked = !hadBoth && survivalUnlocked(), gateNew = !hadGate && gateOpen();
  refreshSurvivalLock(); refreshGateLock();
  showBanner('YOU WIN', 'Balance restored. The legend grows.', 999);
  setTimeout(()=>{
    if (G.mode !== 'victory') return;
    document.exitPointerLock();
    // always raise the win screen (not just in the embedded fallback)
    overlay.style.display = 'flex';
    setOverlayState('victory');
    // NEW GAME+ (data/ngplus.js): the first win opens it, each tier beaten the next (Act IV is no tier of it)
    const ngNow = ngNextTier(G.hero), ngLine = gate ? '' : ngRun > 0 ? '★ ' + tierName(ngRun) + ' BEATEN · ' + NG_WORDS.won(ngRun).toUpperCase() + ' ★' : ngNow && !ngBefore ? '★ ' + tierName(ngNow) + ' UNLOCKED ★' : '';
    document.getElementById('ovsub').textContent = newlyUnlocked ? '★ SURVIVAL MODE UNLOCKED ★' : gateNew ? '★ ACT IV · THE SITH GATE UNLOCKED ★' : gate ? GATE_WIN : ngLine || (storyHero() === 'trooper' ? TROOPER_VICTORY : 'THE HERALD OF THE VOID IS NO MORE');
  }, 1400);
}
