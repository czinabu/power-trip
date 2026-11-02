// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CHARACTER SEE-THROUGH — a squadmate, a foe, a boss or a co-op partner standing between the lens and the hero (or
// right up against the lens) turns see-through, whole and in its own shape, the way props do (world/camblock.js).
// Props bake an id into their vertices; characters are live groups that share materials across a crowd, so a unit
// that starts blocking gets its OWN clone of each material with a screen-door dither (no transparency sorting), and
// gets its real materials back once it eases solid again. Anything the game changes on the real materials while the
// clone shows (a hit flash, an elite tint, a windup glow) is copied across every frame, so nothing is lost or stale.

import * as THREE from 'three';
import { shared, G, enemies } from '../state.js';
import { allies } from '../allies/squad.js';
import { partnerPuppet } from '../net/partner.js';

export const CHAR_SEE = {
  amt: 0.68,      // share of a fully faded character's pixels dropped (props use 0.55: a body is smaller, so a little more)
  radius: 0.6,    // a body's reach round its centre line, metres (a boss: bossRadius)
  bossRadius: 1.3,
  height: 2.0,    // a body's height (a boss: bossHeight)
  bossHeight: 3.4,
  spare: 0.9,     // a body this close to the hero along the sight line (or past them) never fades: it is beside them, not in the way
  nearLens: 1.4,  // a body this close to the lens fades whatever the line
  easeIn: 9, easeOut: 5,
};

const live = new Map();   // group → { see: uniform {value}, pairs: [[mesh, real, clone]], v }
// A unit's clones are kept once made (not disposed when it eases solid): disposing the last material on a program
// deletes that program, so the next unit to step in the way compiled it again, a hitch every time. Kept per group (a
// WeakMap, so a cleared unit's clones go with it), the next fade reuses them and costs nothing.
const kept = new WeakMap();   // group → Map(real material → clone)

/* a dithered clone of one material, its fade driven by the unit's own uniform */
function seeClone(src, uni){
  const m = src.clone();
  const prev = src.onBeforeCompile, key = src.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(src, sh, r);
    sh.uniforms.uCharSee = uni;
    sh.fragmentShader = 'uniform float uCharSee;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  if (uCharSee > 0.0 && uCharSee > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;`);
  };
  m.customProgramCacheKey = () => key + '|charsee';
  return m;
}

function swapIn(group){
  let cache = kept.get(group);
  if (!cache){ cache = { see: { value: 0 }, clones: new Map() }; kept.set(group, cache); }
  const see = cache.see, pairs = [];
  see.value = 0;
  group.traverse(o => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    if (o.material.depthTest === false) return;   // overlays drawn over everything (health and guard bars) stay crisp
    const real = o.material;
    let clone = cache.clones.get(real);
    if (!clone){ clone = seeClone(real, see); cache.clones.set(real, clone); }
    else copyLook(real, clone);   // the real one may have changed (a tint, a flash) since this clone last showed
    o.material = clone;
    pairs.push([o, real, clone, snap(real)]);
  });
  const rec = { see, pairs, v: 0 };
  live.set(group, rec);
  return rec;
}

function swapOut(group, rec){
  for (const p of rec.pairs){
    const [o, real, clone, last] = p;
    if (!same(snap(clone), last)) copyLook(clone, real);   // something wrote through the mesh while it was faded: keep it
    if (o.material === clone) o.material = real;
  }
  live.delete(group);
}

/* The game writes to these materials two ways: through a reference it kept to the real one (hit flashes, elite tints,
   windup glows) or through mesh.material, which is the clone while it shows (guard arcs, tells, a pulsing core). So
   each frame, whichever side changed since the last look is copied to the other. */
const snap = m => [m.color ? m.color.getHex() : 0, m.emissive ? m.emissive.getHex() : 0, m.emissiveIntensity || 0, m.opacity, m.visible];
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4];
function copyLook(from, to){
  if (from.color && to.color) to.color.copy(from.color);
  if (from.emissive && to.emissive) to.emissive.copy(from.emissive);
  if (from.emissiveIntensity != null) to.emissiveIntensity = from.emissiveIntensity;
  to.opacity = from.opacity; to.visible = from.visible;
}
function mirror(rec){
  for (const p of rec.pairs){
    const real = p[1], clone = p[2], r = snap(real);
    if (!same(r, p[3])){ copyLook(real, clone); p[3] = r; }
    else { const c = snap(clone); if (!same(c, p[3])){ copyLook(clone, real); p[3] = c; } }
  }
}

const _h = new THREE.Vector3();
/* how much this body is in the way: 1 when it cuts the sight line from the lens to the hero's chest, else 0 */
function blocking(cam, hx, hy, hz, len, pos, r, hgt){
  const cx = pos.x, cz = pos.z;
  if (Math.hypot(cx - cam.x, pos.y + hgt * 0.5 - cam.y, cz - cam.z) < CHAR_SEE.nearLens) return 1;
  // along the line (in the ground plane), then how far off it, and whether the line passes at the body's height
  const dx = hx - cam.x, dz = hz - cam.z, flat = Math.hypot(dx, dz) || 1e-4;
  const t = ((cx - cam.x) * dx + (cz - cam.z) * dz) / (flat * flat);
  if (t <= 0 || t * len > len - CHAR_SEE.spare) return 0;
  const px = cam.x + dx * t, pz = cam.z + dz * t;
  if (Math.hypot(cx - px, cz - pz) > r) return 0;
  const ly = cam.y + (hy - cam.y) * t;
  return ly > pos.y - 0.2 && ly < pos.y + hgt ? 1 : 0;
}

const seen = new Set();
function want(group, target, dt){
  if (!group) return;
  seen.add(group);
  let rec = live.get(group);
  if (!rec){ if (target === 0) return; rec = swapIn(group); }
  const k = Math.min(1, dt * (target > rec.v ? CHAR_SEE.easeIn : CHAR_SEE.easeOut));
  rec.v += (target - rec.v) * k;
  if (target === 0 && rec.v < 0.02){ swapOut(group, rec); return; }
  rec.see.value = rec.v * CHAR_SEE.amt;
  mirror(rec);
}

/* per frame, after the camera has settled: cam = the lens, (px, py, pz) the hero's feet. Off (a cutscene, a pause, the
   menus) everything eases back to solid */
export function updateCharFade(cam, px, py, pz, dt, on = true){
  seen.clear();
  const hx = px, hy = py + 1.1, hz = pz;
  const len = Math.hypot(hx - cam.x, hy - cam.y, hz - cam.z);
  const test = (g, r, h) => on && g && g.visible && g.parent ? blocking(cam, hx, hy, hz, len, g.position, r, h) : 0;
  for (const e of enemies) if (e.group) want(e.group, test(e.group, CHAR_SEE.radius * (e.group.scale.x || 1), CHAR_SEE.height * (e.group.scale.y || 1)), dt);
  for (const a of allies) if (a.group) want(a.group, test(a.group, CHAR_SEE.radius, CHAR_SEE.height), dt);
  const b = shared.boss;
  if (b && b.group) want(b.group, test(b.group, CHAR_SEE.bossRadius, CHAR_SEE.bossHeight), dt);
  for (let s = 0; s < 4; s++){ const P = partnerPuppet(s); if (P && P.group) want(P.group, test(P.group, CHAR_SEE.radius, CHAR_SEE.height), dt); }
  // a body that left the fight (killed and cleared, sent back, a new run) gets its real materials back at once
  for (const [g, rec] of live) if (!seen.has(g)) swapOut(g, rec);
}

/* the shader warm-up (engine/prewarm.js): a specimen wears its see-through clones for good, so their program is built
   with the rest before a fight, not the first time a squadmate or a foe steps in front of the lens */
export function seeThroughSpecimen(group){
  group.traverse(o => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || o.material.depthTest === false) return;
    o.material = seeClone(o.material, { value: 0.5 });
  });
  return group;
}

export const charFadeState = () => [...live.values()].map(r => +r.v.toFixed(2));
