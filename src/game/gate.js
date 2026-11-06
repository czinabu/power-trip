// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ACT IV · THE SITH GATE, in play (its words: data/campaign-gate.js; its missions: data/missions-gate.js). A campaign run
// like the three stories (game/campaign.js plays its chapters, co-op guests join it the same way, saves keep it), told as
// the story 'gate' (G.storyHero). What's its own:
//   · it opens once any one hero's campaign is beaten (gateOpen), on any hero
//   · a VETERAN'S KIT: the heroes who play it have finished a story, so every power, form and gun the three stories hand
//     out is in hand from its first chapter (game/flow.js chapterClosed counts every story chapter as behind them), with
//     a stock of skill points to spend at the first close
//   · the RECAP on its first card: each of the three stories, with the ending this player reached in it, or two lines
//   · the EPILOGUE, per screen: the gate (the host's choice), this player's hero by their own lean, what they chose in the
//     stories they finished, and whether they did it alone

import { G, heroKey } from '../state.js';
import { startChapter } from './campaign.js';
import { checkUnlocks } from './flow.js';
import { grantStoryPowers } from './progression.js';
import { resetStory, answer } from './choices.js';
import { autosave } from './autosave.js';
import { leanOf } from './profile.js';
import { setLoadout, setStanceHud } from '../player/jedi/stance.js';
import { autoLoadout } from './meditation.js';
import { setKit } from './armory.js';
import { bestKit } from '../data/mando.js';
import { players } from '../player/players.js';
import { chapterOrder, setGateEpilogue } from '../data/campaign.js';
import { GATE_RECAP, GATE_EPILOGUE } from '../data/campaign-gate.js';
import { JEDI_ENDINGS } from '../data/campaign-jedi.js';
import { TROOPER_EPILOGUE } from '../data/campaign-trooper.js';
import { MANDO_EPILOGUE } from '../data/campaign-mando.js';

const STORIES = ['jedi', 'mando', 'trooper'];
const get = (k) => { try { return localStorage.getItem(k); } catch(e){ return null; } };
// a story's campaign is beaten on this profile (game/summary.js victory marks it per hero; the stories are the heroes')
export const storyBeaten = (s) => get('sw_camp_' + s) === '1';
export const gateOpen = () => STORIES.some(storyBeaten);
export const GATE_WIN = 'THE UNBURIED IS BACK IN THE DARK';
export const gateBeaten = () => STORIES.some(h => get('sw_camp_gate_' + h) === '1');

/* ---------- the endings this player reached (saved as each story is won: noteEnding, from game/summary.js) ---------- */
const ENDS = 'sw_camp_ends';   // (an sw_camp_ key: the save slots keep it)
export function endings(){ try { const v = JSON.parse(get(ENDS)); return v && typeof v === 'object' ? v : {}; } catch(e){ return {}; } }
// a story's campaign won: what it ended on (its choices and its epilogue's title), for Act IV's recap and epilogue
export function noteEnding(story, choices, title){
  if (!STORIES.includes(story)) return;
  const all = endings(); all[story] = { ...(choices || {}), title: title || '' };
  try { localStorage.setItem(ENDS, JSON.stringify(all)); } catch(e){}
}
// the choices this player made before, as the gate's lines read them ({ by: 'vexis' }, { by: 'marshal' }): carried into the run
function earlierChoices(){
  const out = {}, e = endings();
  for (const s of STORIES) if (e[s]) for (const k in e[s]) if (k !== 'title') out[k] = e[s][k];
  return out;
}

/* ---------- starting it ---------- */
// how deep into a run the last chapter of a story is (foes, store tiers and the gun path follow it: G.waveTotal)
const runDepth = () => chapterOrder(null, 'jedi').reduce((n, c) => n + (c.kind === 'waves' ? c.waves[1] - c.waves[0] : c.steps ?? 1), 0);
export const VETERAN = { points: 10 };
export function startGate(){
  G.actTwo = null; G.storyHero = 'gate'; G.ngPlus = 0; G.ngNext = null;   // (no NEW GAME+ tier: data/ngplus.js)
  resetStory(); G.story = earlierChoices();   // (the host's earlier endings: the words that remember them)
  G.levelIdx = 0; G.waveTotal = -1;
  G.kitQuiet = true;
  try { startChapter(0, { fresh: true }); veteranKit(true); } finally { G.kitQuiet = false; }
  autosave('chapter');
}
// every story's kit at once, without the fanfare. fresh: a new run's (the skill points too); a co-op guest joining takes
// the kit alone (game/campaign.js joinCampaign)
export function veteranKit(fresh){
  const was = G.kitQuiet; G.kitQuiet = true;
  try {
    G.levelIdx = 2; G.wave = 4;   // (the Jedi's level gates count a story's last level as reached)
    G.waveTotal = Math.max(G.waveTotal || 0, runDepth());
    if (G.checkpoint) G.checkpoint.waveTotal = G.waveTotal;
    checkUnlocks();
    grantStoryPowers();
    if (G.hero === 'jedi'){ setLoadout(autoLoadout()); setStanceHud(); }
    if (G.hero === 'mando') setKit(bestKit());
    if (fresh){ G.skillPoints = (G.skillPoints || 0) + VETERAN.points; G.gateKitDue = true; }   // (spent on the upgrade page as the first fight starts: game/campaign.js showCard)
  } finally { G.kitQuiet = was; }
}

/* ---------- the recap, on the first chapter's card ---------- */
const esc = (t) => String(t).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
// the ending a story finished on, by this player's own save of it
function endingTitle(s){
  const e = endings()[s] || {};
  if (e.title) return e.title;
  if (s === 'jedi') return (JEDI_ENDINGS[(e.ilsa || 'spared') + '-' + (e.vexis || 'ended')] || {}).title || '';
  if (s === 'trooper') return (e.marshal === 'ended' ? TROOPER_EPILOGUE.title.ended : TROOPER_EPILOGUE.title.home) || '';
  return MANDO_EPILOGUE.title || '';
}
// each story laid out as its own hero's keepsake: the Jedi's a holocron page, the Mando's a beskar plate stamped at the
// forge, the trooper's a field file (styles/gate.css). A story this player hasn't played lies face down, its first line only
const GLYPH = {
  jedi: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 37 20 20 37 3 20Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M20 10 30 20 20 30 10 20Z" fill="currentColor" opacity=".28"/><circle cx="20" cy="20" r="3" fill="currentColor"/></svg>',
  mando: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 6h24v12c0 9-5 15-12 17C13 33 8 27 8 18Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 16h16v3h-6v10h-4V19h-6Z" fill="currentColor"/></svg>',
  trooper: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 12 20 4l14 8v4L20 8 6 16Z M6 22l14-8 14 8v4l-14-8-14 8Z M6 32l14-8 14 8v4l-14-8-14 8Z" fill="currentColor"/></svg>',
  gate: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="20" cy="20" r="9" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 3"/><circle cx="20" cy="20" r="2.4" fill="currentColor"/></svg>',
  party: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="11" cy="20" r="4" fill="currentColor"/><circle cx="20" cy="20" r="4" fill="currentColor"/><circle cx="29" cy="20" r="4" fill="currentColor"/></svg>',
  raid: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 20c5-8 11-11 16-11s11 3 16 11c-5 8-11 11-16 11S9 28 4 20Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M20 13v14" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>',
};
const FILE_NO = { jedi: 'HOLOCRON · ARCHIVE OF JEDHA', mando: 'FORGED AT THE COVERT', trooper: 'FILE 7567 · ARC // VORRAN' };
export function gateRecapHtml(){
  const R = GATE_RECAP;
  return '<div class="gx-recap"><div class="gx-rk"><span>' + esc(R.title) + '</span><em>' + esc(R.line) + '</em></div><div class="gx-relics">' +
    STORIES.map((s, k) => {
      const st = R.stories[s], won = storyBeaten(s);
      return '<article class="gx-relic gx-' + s + (won ? ' won' : ' unplayed') + '" style="--i:' + k + '">' +
        '<header><i class="gx-g">' + GLYPH[s] + '</i><div><b>' + esc(st.name) + '</b><small>' + esc(won ? FILE_NO[s] : st.world) + '</small></div></header>' +
        (won ? '<div class="gx-end"><span>' + esc(R.yours) + '</span><strong>' + esc(endingTitle(s)) + '</strong></div>'
             : '<div class="gx-stamp">' + esc(R.unplayed) + '</div>') +
        '<p>' + esc(st.lines[won ? 1 : 0]) + '</p>' +
        (s === 'trooper' && won ? '<div class="gx-redact" aria-hidden="true"><i></i><i></i></div>' : '') +
        '</article>';
    }).join('') + '</div></div>';
}

/* ---------- the epilogue, this screen's own ---------- */
function epilogue(){
  const E = GATE_EPILOGUE, gate = answer('gate') || 'sealed', e = endings();
  const lean = leanOf(G.hero) || 'mid', hero = heroKey(E.hero, G.hero);
  const before = [];
  if (e.jedi) before.push({ k: 'jedi', t: E.before.jedi[(e.jedi.ilsa || 'spared') + '-' + (e.jedi.vexis || 'ended')] });
  if (e.mando) before.push({ k: 'mando', t: E.before.mando });
  if (e.trooper) before.push({ k: 'trooper', t: E.before.trooper[e.trooper.marshal || 'home'] });
  const party = players.length > 1;
  const parts = [{ k: 'gate', t: E.gate[gate] }, { k: G.hero, t: hero[lean] || hero.mid, own: true },
    ...before.filter(b => b.t && b.k !== G.hero).slice(0, 2), ...before.filter(b => b.t && b.k === G.hero).slice(0, 1),
    { k: 'party', t: party ? E.together : E.alone }];
  return { title: E.title[gate], world: E.world, gate, lean, parts, raid: E.raid, lines: [...parts.map(p => p.t), E.raid] };
}
setGateEpilogue(epilogue);
// THE EPILOGUE CARD: words carved into the gate's own stone, each line marked with whose it is (the gate, your hero, the
// stories you finished, the party), the stone shut or split with light by the choice, and its glow by your own lean
export function gateEpilogueHtml(choiceLabel){
  const E = epilogue(), mine = (k) => k === G.hero;
  return '<div class="gx-epi gx-' + E.gate + ' gx-lean-' + E.lean + ' hero-' + G.hero + '">' +
    '<div class="gx-ring" aria-hidden="true"><i></i><i></i><i></i></div>' +
    '<div class="gx-kick">ACT IV · EPILOGUE</div>' +
    '<h1 class="gx-title">' + esc(E.title) + '</h1>' +
    '<div class="gx-world">' + esc(E.world) + (choiceLabel ? '<span>' + esc(choiceLabel) + '</span>' : '') + '</div>' +
    '<div class="gx-tablet">' + E.parts.map(p => '<p class="gx-l gx-k-' + p.k + (p.own || mine(p.k) ? ' own' : '') + '"><i class="gx-g">' + (GLYPH[p.k] || GLYPH.gate) + '</i><span>' + esc(p.t) + '</span></p>').join('') +
      '<div class="gx-sign">GENERAL KAST</div></div>' +
    '<p class="gx-raid"><i class="gx-g">' + GLYPH.raid + '</i><span>' + esc(E.raid) + '</span></p>' +
    '<div class="cc-btns"><div class="btn primary go gx-go" data-go="1">CONTINUE</div></div>' +
    '<div class="cc-hint">Enter or click to continue</div></div>';
}
