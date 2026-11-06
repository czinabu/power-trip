// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SAVE FILES on the title screen (engine/save-files.js keeps them apart): one small line under the title names the file
// being played and the hero's rank in it ("SAVE FILE 1 · JEDI KNIGHT"); clicking it opens the files panel, with a card per
// file to switch to, start fresh in, or delete. Switching reloads the game on the picked file, so every mode (campaign,
// missions, survival, sandbox, training, the temple, co-op) reads that file's ranks, cards, crafting, choices and wins.

import { G, shared } from '../state.js';
import { FILES, activeFile, fileExists, fileInfo, fileGet, noteActive, useFile, deleteFile } from '../engine/save-files.js';
import { profileOf } from '../game/profile.js';
import { TRACKS } from '../data/profile.js';
import { connected } from '../net/session.js';
import { audioInit, S } from '../audio/sfx.js';

const line = document.getElementById('fileline');
const panel = document.getElementById('files');
const HEROES = ['jedi', 'mando', 'trooper'];
const WHO = { jedi: 'JEDI', mando: 'MANDO', trooper: 'CLONE' };
let armed = null;   // the delete waiting on its second click

// 'JEDI KNIGHT', 'MANDO VERD', 'CLONE SERGEANT' for a rank index
const rankLabel = (hero, r) => { const R = (TRACKS[hero] || TRACKS.jedi).ranks; return WHO[hero] + ' ' + (R[Math.min(r | 0, R.length - 1)] || R[0]).nm; };
// the heroes a file has played, ranked: from its live profile (the active file) or the one it saved (another)
function ranksOf(n){
  let heroes = null;
  if (n === activeFile()){ heroes = {}; for (const h of HEROES){ try { const s = JSON.parse(localStorage.getItem('sw_profile')); if (s && s.heroes && s.heroes[h]) heroes[h] = s.heroes[h]; } catch(e){} } }
  else { try { const s = JSON.parse(fileGet(n, 'sw_profile')); heroes = s && s.heroes; } catch(e){} }
  return HEROES.filter(h => heroes && heroes[h] && (heroes[h].xp > 0 || heroes[h].rank > 0)).map(h => rankLabel(h, heroes[h].rank));
}
const when = (t) => { const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };

/* ---------- the line under the title ---------- */
let shown = '';
function refreshLine(){
  if (!line) return;
  const hero = HEROES.includes(G.hero) ? G.hero : 'jedi';
  const text = 'SAVE FILE ' + activeFile() + ' · ' + rankLabel(hero, profileOf(hero).rank);
  if (text !== shown){ shown = text; line.querySelector('.fl-t').textContent = text; noteActive({ hero }); }
}
// it follows the hero picked and every return to the menu (the overlay's state, the body's hero classes)
if (line){
  const mo = new MutationObserver(() => { if (document.body.classList.contains('in-menu')) refreshLine(); });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  refreshLine();
  line.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openFiles(); });
}

/* ---------- switching ---------- */
/* the game reloads on the new file, so the switch hands over through the loading screen: it fades in over the menu (the
   sound fading with it), the page reloads under it, and the new page opens on that same screen already up (index.html's
   boot script reads sw_file_switch), so there is never a black or half-drawn frame between the two */
function switchTo(n){
  closeFiles();
  const b = document.getElementById('boot');
  try { sessionStorage.setItem('sw_file_switch', String(n)); } catch(e){}
  try { const A = shared.AC; if (A && shared.masterGain) shared.masterGain.gain.setTargetAtTime(0, A.currentTime, 0.08); } catch(e){}
  if (!b){ location.reload(); return; }
  b.querySelector('.bt-blade').style.setProperty('--p', '0');
  b.querySelector('.bt-status').textContent = 'Opening save file ' + n;
  b.classList.add('again', 'out'); b.hidden = false;
  void b.offsetWidth;   // (in at opacity 0, so the fade below runs)
  b.classList.remove('out');
  setTimeout(() => location.reload(), 600);
}

/* ---------- the panel ---------- */
function render(){
  const busy = connected();
  let html = '';
  for (let n = 1; n <= FILES; n++){
    const live = n === activeFile(), has = live || fileExists(n), info = fileInfo(n) || {};
    const ranks = has ? ranksOf(n) : [];
    const title = has ? 'SAVE FILE ' + n : 'EMPTY';
    const desc = !has ? 'Start a new save file here' : (ranks.join(' · ') || 'Fresh start') + (live ? ' · Playing now' : info.at ? ' · ' + when(info.at) : '');
    let btn;
    if (live) btn = '<div class="fl-tag">PLAYING</div>';
    else if (busy) btn = '';
    else btn = `<div class="btn" data-act="use" data-n="${n}">${has ? 'PLAY' : 'NEW FILE'}</div>`;
    const del = has && !live ? `<div class="sv-del${armed === n ? ' warn' : ''}" data-act="del" data-n="${n}" title="Delete this save file">${armed === n ? 'DELETE?' : '✕'}</div>` : '';
    html += `<div class="sv-slot${has ? '' : ' empty'}${live ? ' live' : ''}"><div class="sv-n">${n}</div>
      <div class="sv-info"><div class="sv-t">${title}</div><div class="sv-d">${desc}</div></div>${btn}${del}</div>`;
  }
  html += '<p class="sv-note">' + (busy
    ? 'Leave the co-op room to switch save files.'
    : 'Each save file keeps its own ranks, ability cards, crafting, story choices, wins and saves. Settings are shared. Switching reloads the game.') + '</p>';
  document.getElementById('fllist').innerHTML = html;
}
export function openFiles(){ armed = null; panel.classList.add('open'); render(); }
function closeFiles(){ panel.classList.remove('open'); armed = null; }

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // the panel must never launch the game
  if (e.target === panel || e.target.id === 'filesclose') return closeFiles();
  const b = e.target.closest('[data-act]');
  if (!b){ if (armed){ armed = null; render(); } return; }
  const n = +b.dataset.n;
  if (b.dataset.act === 'use'){
    if (connected() || !useFile(n)){ S.uiDeny(); return render(); }
    switchTo(n);
  } else if (b.dataset.act === 'del'){
    if (armed !== n){ armed = n; return render(); }
    armed = null; deleteFile(n); render();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) closeFiles(); });
