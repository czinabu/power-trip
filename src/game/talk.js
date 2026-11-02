// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// WALK-UP LINES: optional story in the lulls. Walk up to someone on your side (a squadmate, a chapter's guest fighter, the
// escort, the people a hold is getting out, the story's voice hanging back after a chapter's opening: game/onset.js)
// while nothing is on top of you, and a prompt comes up over them: tap H (the squad-orders key; VIEW on a pad) and they
// say a line, over the comms strip, under their own name. The words are
// data/talk.js. Nobody has to be talked to: the mission never waits on it.
//
// Every mode with someone on your side: a mission's escort and evacuees, the squad in a run, survival, the sandbox's battle
// setup, co-op (each screen's own talk is its own: it doesn't go over to the partner).

import { G, player, heroKey } from '../state.js';
import { playerPos, fwd } from '../player/helpers.js';
import { allies } from '../allies/squad.js';
import { TALK, MISSION_TALK, CHAPTER_TALK } from '../data/talk.js';
import { onSetFigures } from './onset.js';
import { chapterOrder, storyHero } from '../data/campaign.js';
import { comms, fightHot, commsTalking, commsShowing } from './story.js';
import { missionFigures, missionId } from './mission.js';
import { hostilesIn } from './objectives.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { S } from '../audio/sfx.js';

export const TALKCFG = { reach: 3.0, facing: 0.7, calm: 9, again: 1.2 };   // m · how squarely you face them (cos) · no foe this close · s between lines

const prompt = document.getElementById('talkp');
const said = new Map();   // name → how many of its lines it has said (this visit; the count wraps)
let near = null, gap = 0, shownKey = '', visit = null;

// a speaker's name for the strip: one of a group speaks for them ('PRISONERS' → 'A PRISONER')
const one = (name) => {
  const n = String(name).replace(/CHILDREN$/, 'CHILD').replace(/S$/, '');
  return (/^[AEIOU]/.test(n) ? 'AN ' : 'A ') + n;
};
// the chapter's own lines for someone (data/talk.js CHAPTER_TALK, by story then chapter id)
function chapterLines(name){
  const c = G.chapter >= 0 && chapterOrder(G.actTwo)[G.chapter], all = c && CHAPTER_TALK[storyHero()];
  return (all && all[c.id] && all[c.id][name]) || null;
}
function linesFor(f){
  const mid = missionId(), own = mid && MISSION_TALK[mid] && MISSION_TALK[mid][f.name];
  const base = f.kind ? TALK[f.kind] : TALK[f.name];
  const pick = (v) => !v ? [] : Array.isArray(v) ? v : (heroKey(v) || v.jedi || v.trooper || v.mando || []);
  return [...pick(chapterLines(f.name)), ...pick(own), ...pick(base)];
}

// everyone who could be talked to right now
function figures(){
  const out = [];
  for (const a of allies){
    const name = a.name || (a.def && a.def.name);
    if (!name || a.state === 'down' || !a.group) continue;
    out.push({ key: 'ally:' + name, name, pos: a.group.position, h: 2.3 * ((a.t && a.t.scale) || 1) });
  }
  for (const f of missionFigures()) out.push(f);
  for (const f of onSetFigures()) out.push(f);   // the story's voice, staying on after the chapter's opening (game/onset.js)
  return out.filter(f => linesFor(f).length);
}

function pickNear(){
  if (G.mode !== 'play' || G.cutscene || G.paused || player.downed || player.saberLock) return null;
  const p = playerPos(), f = fwd();
  if (hostilesIn(p.x, p.z, TALKCFG.calm) || fightHot()) return null;   // a lull only
  let best = null, bs = -Infinity;
  for (const c of figures()){
    const dx = c.pos.x - p.x, dz = c.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d > TALKCFG.reach) continue;
    const face = d < 0.8 ? 1 : (dx * f.x + dz * f.z) / d;   // (the view's heading: whoever you're looking toward)
    if (face < TALKCFG.facing) continue;
    const score = face * 2 - d;
    if (score > bs){ bs = score; best = c; }
  }
  return best;
}

// once a frame (main.js)
export function updateTalk(dt){
  if (gap > 0) gap -= dt;
  const v = G.mode === 'menu' ? null : (missionId() || 'run') + ':' + G.chapter;   // a new mission or chapter: everyone has things to say again
  if (v !== visit){ visit = v; said.clear(); }
  near = pickNear();
  const key = near ? near.key + (pad.active ? ':pad' : '') : '';
  if (key !== shownKey){
    shownKey = key;
    if (near){
      const k = pad.active ? padKeys('H') : 'H';
      prompt.innerHTML = '<kbd>' + k + '</kbd><span>TALK</span><b></b>';
      prompt.querySelector('b').textContent = near.kind ? one(near.name) : near.name;
    }
    prompt.classList.toggle('on', !!near);
  }
  prompt.classList.toggle('up', !!near && commsShowing());   // a line on the strip: the prompt moves over the crosshair, out of its way
}
export const talkReady = () => !!near;

// H was tapped (allies/wheel.js): talk to whoever the prompt is over, instead of a squad order. True when it did
export function talkTap(){
  if (!near || gap > 0) return !!near;
  const lines = linesFor(near), id = near.kind ? 'kind:' + near.kind : near.name;
  const n = said.get(id) || 0;
  said.set(id, n + 1);
  const who = near.kind ? one(near.name) : near.name;
  // (this screen only: it's your conversation) · tapping again over a walk-up line moves on to the next; over the story's
  // own lines it waits its turn
  comms({ who, say: lines[n % lines.length] }, { remote: true, talk: true, front: commsTalking() });
  gap = TALKCFG.again;
  S.uiHover();
  return true;
}
