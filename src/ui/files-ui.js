// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SAVE FILES on the title screen (engine/save-files.js keeps them apart): the hero card under the title names the file
// being played, the hero and their rank in it (JEDI · KNIGHT, rank 2 of 4); clicking it opens the files panel, with a card per
// file to switch to, start fresh in, or delete. Switching happens in place, so every mode (campaign, missions, survival,
// sandbox, training, the temple, co-op) reads that file's ranks, cards, crafting, choices and wins from then on.

import { G } from '../state.js';
import { FILES, activeFile, fileExists, fileInfo, fileGet, noteActive, switchFile, deleteFile } from '../engine/save-files.js';
import { profileOf, rankNeeds } from '../game/profile.js';
import { chapterOrder, forHero } from '../data/campaign.js';
import { heroName } from '../game/wardrobe.js';
import { TRACKS } from '../data/profile.js';
import { connected } from '../net/session.js';
import { clearParked } from '../game/saves.js';
import { continueOnLaunch } from './saves-ui.js';
import { goHome, setDiff, setMission } from './menus.js';
import { reloadLook } from './customizer.js';
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

/* ---------- the hero card under the title ---------- */
const num = (n) => Number(n || 0).toLocaleString('en-US');
const chapterName = (id, h) => { const c = chapterOrder(null, h).find(x => x.id === id) || chapterOrder(null, 'jedi').find(x => x.id === id); return c ? forHero(c.title, h) : id.toUpperCase(); };
// how far to the next rank: its name, a 0..1 fill (as the profile page's rank track: each of its asks counts the same) and
// the first ask still open, in words ('340 / 1,500 RANK XP', '2 / 3 TRIALS', 'Clear THE PENS', 'Beat the campaign')
function nextRank(hero, p, R, r){
  const next = R[r + 1];
  if (!next) return { k: 'TOP RANK', f: 1, v: 'Every rank earned' };
  const nx = rankNeeds(hero, p, r + 1);
  const f = nx.length ? nx.reduce((a, x) => a + (x.ok ? 1 : x.need ? Math.min(1, x.have / x.need) : 0), 0) / nx.length : 0;
  const open = nx.find(x => !x.ok) || nx[0];
  const v = !open ? '' : open.what === 'xp' ? num(Math.min(open.have, open.need)) + ' / ' + num(open.need) + ' ' + (TRACKS[hero] || TRACKS.jedi).unit
    : open.what === 'trials' ? open.have + ' / ' + open.need + ' TRIALS' : open.what === 'chapter' ? 'Clear ' + chapterName(open.id, hero) : 'Beat the campaign';
  return { k: 'NEXT · ' + next.nm, f, v };
}
let shown = '';
function refreshLine(){
  if (!line) return;
  const hero = HEROES.includes(G.hero) ? G.hero : 'jedi';
  const p = profileOf(hero), R = (TRACKS[hero] || TRACKS.jedi).ranks, r = Math.min(p.rank | 0, R.length - 1);
  const name = heroName(hero), rank = R[r].nm, nx = nextRank(hero, p, R, r), key = [activeFile(), name, rank, r, nx.k, nx.f, nx.v].join('|');
  if (key === shown) return;
  shown = key;
  const q = (c) => line.querySelector(c);
  q('.fl-file').textContent = 'SAVE FILE ' + activeFile();
  q('.fl-t').textContent = name;
  q('.fl-rank').textContent = rank === name ? '' : rank;   // (the trooper's first rank is TROOPER: said once)
  q('.fl-r').title = 'Rank ' + (r + 1) + ' of ' + R.length;
  q('.fl-nk').textContent = nx.k; q('.fl-nv').textContent = nx.v;
  q('.fl-bar i').style.width = Math.round(nx.f * 100) + '%';
  const pic = document.querySelector('#hero-' + hero + ' .hi');   // the hero's own emblem from its card on the hero step
  const emb = pic && pic.cloneNode(true); if (emb) emb.removeAttribute('class');
  q('.fl-emb').replaceChildren(...(emb ? [emb] : []));
  line.title = 'Save file ' + activeFile() + ': switch save file or start a new one';
  noteActive({ hero });
}
// it follows the hero picked and every return to the menu (the overlay's state, the body's hero classes)
if (line){
  const mo = new MutationObserver(() => { if (document.body.classList.contains('in-menu')) refreshLine(); });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  refreshLine();
  line.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); openFiles(); });
}

/* ---------- switching ---------- */
/* in place, with no reload (so fullscreen, the music and the loaded game all stay): the loading screen fades in over the
   menu, the active file changes under it (engine/save-files.js), the menu picks up that file's hero, run, difficulty,
   mission, look and locks, and the screen fades back out on the new file */
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let switching = false;
async function switchTo(n){
  if (switching) return; switching = true;
  closeFiles();
  const b = document.getElementById('boot');
  if (b){
    b.querySelector('.bt-blade').style.setProperty('--p', '1');
    b.querySelector('.bt-status').textContent = 'Opening save file ' + n;
    b.classList.add('again', 'out'); b.hidden = false;
    void b.offsetWidth;   // (in at opacity 0, so the fade runs)
    b.classList.remove('out');
    await wait(380); await frame();
  }
  try {
    if (switchFile(n)){
      G.resumeRun = null; clearParked();
      let d, m; try { d = localStorage.getItem('sw_diff'); m = localStorage.getItem('sw_mission'); } catch(e){}
      setDiff(d || 'knight'); setMission(m || 'refuge');
      continueOnLaunch();   // this file's newest campaign run waits on CONTINUE CAMPAIGN, its hero picked
      goHome();             // the menu as after a run: hero and kit rebuilt from this file, locks and ticks refreshed
      reloadLook();         // and dressed in this file's look
      shown = ''; refreshLine();
    } else S.uiDeny();
  } catch(e){ console.error(e); }
  if (b){
    await frame(); await frame(); await frame();   // the menu drawn on the new file before the screen lifts
    b.classList.add('out');
    setTimeout(() => { b.hidden = true; }, 600);
  }
  switching = false;
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
    : 'Each save file keeps its own ranks, ability cards, crafting, story choices, wins and saves. Settings are shared.') + '</p>';
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
    if (connected()){ S.uiDeny(); return render(); }
    switchTo(n);
  } else if (b.dataset.act === 'del'){
    if (armed !== n){ armed = n; return render(); }
    armed = null; deleteFile(n); render();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) closeFiles(); });
