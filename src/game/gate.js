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
  G.actTwo = null; G.storyHero = 'gate';
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
export function gateRecapHtml(){
  const R = GATE_RECAP;
  return '<div class="cc-recap"><div class="cc-k">' + esc(R.title) + '</div><p class="cc-rl">' + esc(R.line) + '</p><div class="cc-rs">' +
    STORIES.map(s => {
      const st = R.stories[s], won = storyBeaten(s);
      return '<div class="cc-r' + (won ? ' won' : '') + '"><b>' + esc(st.name) + '</b><i>' + esc(st.world) + '</i>' +
        (won ? '<span class="cc-end">' + esc(R.yours) + ' · ' + esc(endingTitle(s)) + '</span>' : '<span class="cc-end un">' + esc(R.unplayed) + '</span>') +
        '<p>' + esc(st.lines[won ? 1 : 0]) + '</p>' + '</div>';
    }).join('') + '</div></div>';
}

/* ---------- the epilogue, this screen's own ---------- */
function epilogue(){
  const E = GATE_EPILOGUE, gate = answer('gate') || 'sealed', e = endings();
  const lean = leanOf(G.hero) || 'mid', hero = heroKey(E.hero, G.hero);
  const before = [];
  if (e.jedi) before.push(E.before.jedi[(e.jedi.ilsa || 'spared') + '-' + (e.jedi.vexis || 'ended')]);
  if (e.mando) before.push(E.before.mando);
  if (e.trooper) before.push(E.before.trooper[e.trooper.marshal || 'home']);
  const party = players.length > 1;
  return { title: E.title[gate], world: E.world,
    lines: [E.gate[gate], hero[lean] || hero.mid, ...before.filter(Boolean).slice(0, 2), party ? E.together : E.alone, E.raid] };
}
setGateEpilogue(epilogue);
