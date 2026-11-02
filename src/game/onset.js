// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CAST STAYS ON SET: the story's voice in person (Master Vael, the Armorer, the Captain: data/cast.js `stays`) doesn't
// vanish when a chapter's opening hands back to play. They hang back a few steps behind the hero, out of the fight's way,
// keep breathing and turning to watch you, and talk with their hands while their line is on the comms strip. Walk up to
// one in a lull and tap H for a line (game/talk.js; the words are data/talk.js). The calm after a chapter's last fight
// (game/aftermath.js) sends you back to them.
//
// They belong to the chapter: a new chapter, the main menu or a story that isn't on its chapters takes them off the
// field. A death and retry of the same chapter (its opening doesn't replay) puts them back behind the hero.
// Every mode with a chapter opening: each story's campaign, solo and co-op (each screen's own: they are scenery, and
// never cross the network).

import * as THREE from 'three';
import { G, shared } from '../state.js';
import { camera } from '../engine/renderer.js';
import { playerPos } from '../player/helpers.js';
import { makeFigure, stepFigure, dropFigure } from './cast.js';
import { findClearSpawn, groundAt, segBlockedBySolids } from '../world/collision.js';
import { sightClear } from '../world/camblock.js';
import { commsShowing, commsSpeaker } from './story.js';

export const STAY = { back: 5.2, spread: 1.7, far: 60 };   // m behind the hero · m between them · past this they stand still (no cloth, no idle)

const S = { ch: -1, names: [], figs: [], yaw: 0, want: false };
const yawTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);

// where the cast hangs back: behind the hero (yaw: the way the hero faces the field), side by side, on open ground the
// hero can see, level with them
function spots(n, yaw){
  const pp = playerPos(), out = [], [hx, hz] = [shared.arenaHalf - 1.5, (shared.arenaHalfZ || shared.arenaHalf) - 1.5];
  for (let k = 0; k < n; k++){
    const off = (k - (n - 1) / 2) * STAY.spread;
    let pick = null;
    // (off to one side of straight behind: the play camera sits right behind the hero, and they'd stand in its view)
    for (const d of [STAY.back, STAY.back * 1.3, STAY.back * 0.75]) for (const a of [1.0, -1.0, 0.75, -0.75, 1.35, -1.35, 1.7, -1.7]){
      if (pick) break;
      const ya = yaw + Math.PI + a, sx = Math.cos(yaw) * off, sz = -Math.sin(yaw) * off;
      const c = findClearSpawn(pp.x + Math.sin(ya) * d + sx, pp.z + Math.cos(ya) * d + sz, 0.7);
      if (Math.abs(c.x) > hx || Math.abs(c.z) > hz) continue;
      if (Math.hypot(c.x - pp.x, c.z - pp.z) < 1.8 || out.some(q => Math.hypot(q.x - c.x, q.z - c.z) < 1.1)) continue;
      if (segBlockedBySolids(pp.x, pp.z, c.x, c.z) || Math.abs(groundAt(c.x, c.z, pp.y + 1.5) - pp.y) > 0.5) continue;
      if (sightClear(pp.x, pp.y + 1.5, pp.z, c.x, pp.y + 1.5, c.z) < 0.95) continue;
      pick = c;
    }
    out.push(pick || findClearSpawn(pp.x - Math.sin(yaw) * STAY.back, pp.z - Math.cos(yaw) * STAY.back, 0.7));
  }
  return out;
}
function place(F, at){
  F.walk = null; F.talk = false;
  F.g.position.set(at.x, groundAt(at.x, at.z, playerPos().y + 1.5), at.z);
  const pp = playerPos();
  F.g.rotation.y = yawTo(at.x, at.z, pp.x, pp.z);
  F.g.visible = true;
  F.look = pp;
}

// game/cutscene.js, as a chapter's opening hands back: these figures stay (yaw: the way the hero faces the field)
export function keepCast(figs, yaw){
  if (G.chapter < 0 || G.mode !== 'play'){ for (const F of figs) dropFigure(F); return; }
  clearFigs();
  S.ch = G.chapter; S.yaw = yaw; S.names = figs.map(F => F.name); S.figs = figs; S.want = false;
  const at = spots(figs.length, yaw);
  figs.forEach((F, k) => place(F, at[k]));
}
function clearFigs(){ for (const F of S.figs) dropFigure(F); S.figs = []; }
// game/campaign.js, as a chapter starts: off the field. A retry of the same chapter brings them back (its opening has
// played this visit and won't again); any other chapter forgets them
export function resetSet(pos, retry){
  clearFigs();
  if (!(retry && pos === S.ch)){ S.names = []; S.ch = -1; }
  S.want = S.names.length > 0;
}
// the main menu, a new run, another mode
export function clearSet(){ clearFigs(); S.names = []; S.ch = -1; S.want = false; }

// once a frame (main.js)
export function updateOnSet(dt){
  if (G.mode === 'menu' || G.chapter < 0 || (S.ch >= 0 && G.chapter !== S.ch)){ if (S.figs.length || S.names.length) clearSet(); return; }
  // back after a retry: once the hero is on the field again, with nothing in front of the screen
  if (S.want && G.mode === 'play' && !G.cutscene && !G.cardUp && !G.paused){
    S.want = false;
    const at = spots(S.names.length, G.yaw), pp = playerPos();
    S.figs = S.names.map((n, k) => { const F = makeFigure(n, at[k].x, at[k].z, yawTo(at[k].x, at[k].z, pp.x, pp.z)); if (F) F.look = pp; return F; }).filter(Boolean);
  }
  if (!S.figs.length || dt <= 0) return;
  const pp = playerPos(), who = commsShowing() ? commsSpeaker() : null;
  // (a figure nobody can see doesn't spend the frame: its idle, face and cloth wait until it's back in view, then catch up
  // in one short step. A slow machine shouldn't pay for scenery behind the camera)
  for (const F of S.figs){
    F.idle = (F.idle || 0) + dt;
    if (Math.hypot(F.g.position.x - pp.x, F.g.position.z - pp.z) > STAY.far) continue;
    _v.set(F.g.position.x, F.g.position.y + 1.2, F.g.position.z).project(camera);
    if (!(_v.z < 1 && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.3)) continue;
    F.look = pp;
    F.talk = who === F.name;   // their own line on the strip (a walk-up line, or the voice's word): they say it with their hands
    stepFigure(F, Math.min(F.idle, 0.1));
    F.idle = 0;
  }
}

// the calm after the chapter (game/aftermath.js) puts the rally point somewhere else: whoever is out of the lens's view
// goes on ahead and waits there (anyone in view stays put: nobody pops)
const _v = new THREE.Vector3();
export function meetAt(x, z){
  const pp = playerPos();
  let moved = 0;
  S.figs.forEach((F, k) => {
    _v.set(F.g.position.x, F.g.position.y + 1.2, F.g.position.z).project(camera);
    if (_v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1) return;   // (on screen)
    const a = yawTo(x, z, pp.x, pp.z) + (k - (S.figs.length - 1) / 2) * 0.5, c = findClearSpawn(x + Math.sin(a) * 1.6, z + Math.cos(a) * 1.6, 0.7);
    place(F, c);
    moved++;
  });
  return moved > 0;
}
export const onSetGroups = () => S.figs.map(F => F.g);   // (world/charfade.js: one between the lens and the hero turns see-through)
// for walk-up lines (game/talk.js) and the calm after a chapter (game/aftermath.js): { key, name, pos, h }
export function onSetFigures(){
  return S.figs.filter(F => F.g.visible !== false).map(F => ({ key: 'set:' + F.name, name: F.name, pos: F.g.position, h: 2.3 * (F.scale || 1) }));
}
