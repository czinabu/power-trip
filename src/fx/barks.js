// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BARKS: the short lines someone shouts mid-fight (a squadmate's "MOVING UP!", an officer calling a volley), shown as a
// small speech tag that rides above the speaker's head and follows them as they move, instead of a damage-style number
// that floats off where it was said. One tag per speaker (a new line replaces their last), a few on screen at most (the
// oldest gives way), pinned inside the screen's edges, hidden while a cutscene or a menu is up.
//
// Who calls: allies/squad.js (squadmates answering an order, a medic on the way), enemies/tactics.js (an officer's order).
// main.js steps them every frame (updateBarks), after the camera has moved.

import * as THREE from 'three';
import { camera } from '../engine/renderer.js';

export const BARK = { max: 3, base: 1.5, perChar: 0.035, fade: 0.3, lift: 0.55, edge: 18 };
const pool = [];   // { el, who, say, obj, t, hold, at }
const P = new THREE.Vector3(), placed = [];
let layer = null;

function make(){
  if (!layer){
    layer = document.createElement('div'); layer.id = 'barks';
    (document.getElementById('hud') || document.body).appendChild(layer);
  }
  const el = document.createElement('div');
  el.className = 'bark';
  el.innerHTML = '<span class="bk-who"></span><span class="bk-say"></span>';
  layer.appendChild(el);
  return { el, who: el.firstChild, say: el.lastChild, obj: null, t: 0, hold: 0, at: 0 };
}
// obj: the speaker's THREE.Object3D (its group: the tag follows it) · text: the line · opts.color: the speaker's colour
// (the tag's edge and name) · opts.who: a name to show over the line · opts.y: the head's height above the group's origin
export function bark(obj, text, opts = {}){
  if (!obj || !text) return;
  let b = pool.find(p => p.obj === obj && p.t < p.hold + BARK.fade) || pool.find(p => p.t >= p.hold + BARK.fade);
  if (!b && pool.length < BARK.max) pool.push(b = make());
  if (!b) b = pool.reduce((o, p) => p.at < o.at ? p : o);   // (the oldest line gives way)
  b.obj = obj; b.t = 0; b.at = performance.now();
  b.y = opts.y ?? 2.2 * (obj.scale ? obj.scale.y : 1);
  b.hold = BARK.base + String(text).length * BARK.perChar;
  b.who.textContent = opts.who || ''; b.who.style.display = opts.who ? '' : 'none';
  b.say.textContent = text;
  b.el.style.setProperty('--bk', opts.color || '#bfe8ff');
}
export const barksUp = () => pool.filter(p => p.obj && p.t < p.hold + BARK.fade).map(p => p.say.textContent);
export function clearBarks(){ for (const b of pool){ b.obj = null; b.el.style.opacity = '0'; } }
// dt: 0 holds every tag where it is (a pause) · show: false hides them (a cutscene, a menu) without losing their time
export function updateBarks(dt, show){
  if (!pool.length) return;
  if (layer) layer.style.display = show ? '' : 'none';
  if (!show) return;
  camera.updateMatrixWorld();
  const W = innerWidth, H = innerHeight, E = BARK.edge;
  placed.length = 0;
  for (const b of pool.slice().sort((p, q) => p.at - q.at)){   // (the older line keeps its spot; a newer one stacks over it)
    if (!b.obj) continue;
    b.t += dt;
    const left = b.hold + BARK.fade - b.t;
    if (left <= 0 || !b.obj.parent){ b.obj = null; b.el.style.opacity = '0'; continue; }   // (said, or the speaker is gone)
    b.obj.getWorldPosition(P); P.y += b.y + BARK.lift;
    P.project(camera);
    if (P.z > 1){ b.el.style.opacity = '0'; continue; }   // (behind the lens)
    const w = b.el.offsetWidth, h = b.el.offsetHeight;
    const x = Math.min(W - E - w / 2, Math.max(E + w / 2, (P.x * 0.5 + 0.5) * W)) - w / 2;
    let y = Math.min(H - E, Math.max(E + h, (-P.y * 0.5 + 0.5) * H)) - h;
    // two speakers side by side: the tags stack instead of printing over each other
    for (let k = 0; k < placed.length; k++){
      const o = placed[k];
      if (x < o.x + o.w && x + w > o.x && y < o.y + o.h + 4 && y + h + 4 > o.y){ y = o.y - h - 6; k = -1; }
    }
    placed.push({ x, y, w, h });
    b.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    b.el.style.opacity = String(Math.min(1, left / BARK.fade, b.t / 0.12));
  }
}
