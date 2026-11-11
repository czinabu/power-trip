// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* QUIET CUES: what a ROUTINE callout does once its word has gone quiet (data/callouts.js, fx/floaters.js).
   'blade': the hero's own move (a momentum strike, a perfect string, a flow link). A glint runs off the blade in the
            word's colour and a soft chime rings: the saber says it.
   'spark': something the foe did (slipped the cut, turned it aside). A small star where the word would have been. */

import * as THREE from 'three';
import { sfx } from '../audio/sfx.js';
import { G, player } from '../state.js';
import { inkSprite, sparks } from './ink.js';
import { onQuietWord } from './floaters.js';
import { bladeSegment } from '../player/jedi/bladehit.js';

export const CUE = {
  gap: 0.12,                         // s between two cues of one kind (a flurry is one glint, not five)
  chime: [1320, 1980, 0.07, 0.028],  // the blade's chime: from Hz, to Hz, s, volume
};
const _b = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3();
const _last = { blade: -9, spark: -9 };
const hexOf = (css) => { const n = parseInt(String(css || '').replace('#', ''), 16); return Number.isFinite(n) ? n : 0xffffff; };

function bladeGlint(pos, color){
  if (bladeSegment(_b, _t)){
    _d.subVectors(_t, _b).normalize();
    _p.lerpVectors(_b, _t, 0.82);
    inkSprite({ pos: _p, shape: 'star', points: 4, sharp: 0.1, color, size: [0.16, 0.6], life: 0.14, fadeAt: 0.4, steps: 2, coreW: 0.4, spin: 3 });
    sparks(_p, color, 3, 5, { dir: _d, cone: 0.5, life: 0.2, size: 0.3, grav: 4 });
  } else {   // no blade in hand: the glint is at the chest
    _p.set(pos.x, (player.group.position.y || 0) + 1.3, pos.z);
    inkSprite({ pos: _p, shape: 'star', points: 4, sharp: 0.1, color, size: [0.14, 0.5], life: 0.14, fadeAt: 0.4, steps: 2, coreW: 0.4, spin: 3 });
  }
  sfx(CUE.chime[0], CUE.chime[2], 'sine', CUE.chime[3], CUE.chime[1]);
}
function foeSpark(pos, color){
  _p.set(pos.x, pos.y + 0.6, pos.z);
  inkSprite({ pos: _p, shape: 'star', points: 4, sharp: 0.12, color, size: [0.12, 0.42], life: 0.12, fadeAt: 0.4, steps: 2, coreW: 0.4, spin: 2 });
}

onQuietWord((cue, pos, css) => {
  if (!(cue in _last) || G.gt - _last[cue] < CUE.gap) return;
  _last[cue] = G.gt;
  try { (cue === 'blade' ? bladeGlint : foeSpark)(pos, hexOf(css)); } catch(e){ console.error('quiet cue', e); }   // (never let a glint break the blow that called it)
});
