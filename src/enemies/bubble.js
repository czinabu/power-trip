// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE DUEL BUBBLE (data/duel-bubble.js): which hero is in a 1v1 right now, and with whom. One entry per hero, so in
// co-op each hero has their own duel; enemies/ai.js and enemies/director.js read it to give the duel room.

import { G, enemies, bossUp } from '../state.js';
import { players, huntable } from '../player/players.js';
import { BUBBLE } from '../data/duel-bubble.js';

const duels = new Map();   // hero → { foe, relaxed }
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const heroKind = (p) => p.local ? G.hero : (p.hero || 'jedi');

function alive(f){
  if (!f || !f.group) return false;
  if (f === bossUp()) return true;
  return !f.dead && !f.converted && f.hp > 0 && f.state !== 'spawn' && enemies.includes(f);
}
// the foe a hero has squared up with: a boss or a champion near them, or (a Jedi) the duellist taking its turn on them
function pick(p){
  const pp = p.pos;
  let best = null, bd = BUBBLE.start;
  const b = bossUp();
  if (b && b.group){ const d = flat(b.group.position, pp); if (d < bd){ bd = d; best = b; } }
  const forms = !!BUBBLE.duellists[heroKind(p)];
  for (const e of enemies){
    if (e.dead || e.converted || e.dummy || e.state === 'spawn' || !e.group) continue;
    if (!(e.champion || (forms && e.ff && e.token))) continue;
    if (e.hero && e.hero !== p) continue;   // (co-op: one that's on the other hero isn't this one's duel)
    const d = flat(e.group.position, pp);
    if (d < bd){ bd = d; best = e; }
  }
  return best;
}

// once a frame, before the AI runs
export function updateBubble(){
  for (const p of duels.keys()) if (!players.includes(p)) duels.delete(p);
  for (const p of players){
    let d = duels.get(p);
    if (!d) duels.set(p, d = { foe: null, relaxed: false });
    if (!huntable(p) || !p.pos){ d.foe = null; continue; }
    // once on it holds until the foe falls or the hero walks well off from it
    if (!(alive(d.foe) && flat(d.foe.group.position, p.pos) < BUBBLE.start + BUBBLE.stop)) d.foe = pick(p);
    d.relaxed = false;
    if (!d.foe) continue;
    // a partner who comes in on it makes it a 2v1: the bubble lifts while they're there
    const fp = d.foe.group.position;
    for (const o of players) if (o !== p && huntable(o) && o.pos && flat(o.pos, fp) < BUBBLE.partner){ d.relaxed = true; break; }
  }
}

// the duel this hero is in (with the bubble up), or null
export function duelOf(p){
  const d = p && duels.get(p);
  return d && d.foe && !d.relaxed ? d : null;
}
// the foe in the first live duel (the squad's ring for a hero whose squad doesn't ring every boss: allies/squad.js)
export function anyDuelFoe(){
  for (const p of players){ const d = duelOf(p); if (d) return d.foe; }
  return null;
}
// is this foe held off by a duel bubble? the rank and file around a duel, never the duellists themselves
export const heldBy = (e, hero) => (e.ff || e.champion || e.converted || e.dummy || e.warbringer) ? null : duelOf(hero);

// a bolt at a duelling hero mostly goes wide: shift the aim point (x,z) off to one side of the shot, past the guard
export function wideAim(from, at, out){
  out.x = at.x; out.y = at.y; out.z = at.z;
  if (Math.random() >= BUBBLE.miss) return out;
  const dx = at.x - from.x, dz = at.z - from.z, l = Math.hypot(dx, dz) || 1;
  const k = (Math.random() < 0.5 ? -1 : 1) * (BUBBLE.wide[0] + Math.random() * (BUBBLE.wide[1] - BUBBLE.wide[0]));
  out.x += -dz / l * k; out.z += dx / l * k;
  return out;
}
