// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TEMPLE'S PEOPLE: the Jedi, the younglings and the archivists who live in the hidden temple on Tython (the hub's
// wings, world/arenas/tython.js). They only walk their rounds and go through their drills: nobody to talk to or fight,
// and nothing solid (you walk through them). Where each one is comes from the game clock alone (G.gt, through
// shared.hubAnim), not from anything they remember, so every screen in a co-op party sees them in the same places.
// Each figure is folded into one mesh (its colours carried on the vertices) and one outline, plus a saber where it holds
// one, so a wing full of them stays cheap to draw.

import * as THREE from 'three';
import { shared } from '../../state.js';
import { toon, inkify } from '../ink.js';
import { makeEvacuee } from './refuge.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;
const ROBES = [0xd8c8a0, 0xc8b48e, 0xb8a080], CLOAKS = [0x5a3a22, 0x6a4a2e, 0x4a3424, 0x3a2e28], SKIN = [0xe8c0a0, 0xb07a58, 0x7a5038, 0xd8a888, 0x8ab070];
const BLADES = [0x5ad2ff, 0x7aff6a, 0xffd25a];

function liveAll(g){ g.traverse(o => { o.userData.noBake = true; o.userData.passThrough = true; }); g.userData.noBake = true; return g; }
function anim(obj, fn){ (shared.hubAnim ||= []).push({ obj, fn, base: obj.position.clone() }); return obj; }

/* a grown JEDI: a pale tunic under a dark cloak, the hood down or up */
function jedi(seed, hood = seed % 3 === 0){
  const g = new THREE.Group();
  const add = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, toon(color)); m.position.set(x, y, z); m.castShadow = true; inkify(m, 0.025); g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.22, 0.28, 0.95, 10), ROBES[seed % 3], 0, 1.05, 0);
  add(new THREE.ConeGeometry(0.42, 1.45, 12, 1, true), CLOAKS[seed % 4], 0, 0.78, -0.04);
  add(new THREE.SphereGeometry(0.17, 12, 10), SKIN[seed % 5], 0, 1.7, 0);
  if (hood) add(new THREE.SphereGeometry(0.22, 12, 10, 0, PI * 2, 0, PI * 0.62), CLOAKS[seed % 4], 0, 1.71, -0.03);
  g.userData.hand = [0.28, 1.05, 0.14];
  return g;
}
function youngling(seed){ const g = makeEvacuee('youngling', seed); g.userData.hand = [0.24, 0.5, 0.12]; return g; }
function archivist(seed){ const g = makeEvacuee('archivist', seed); g.userData.hand = [0.26, 1.0, 0.14]; return g; }

/* a TRAINING SABER in the figure's hand, on a pivot the drill swings */
function saber(g, color, len = 0.75){
  const [hx, hy, hz] = g.userData.hand, piv = new THREE.Group(); piv.position.set(hx, hy, hz); g.add(piv);
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  blade.position.y = 0.08 + len / 2; piv.add(blade);
  piv.rotation.x = 0.6;
  return piv;
}

/* fold a figure's body parts into one mesh: each part's colour onto its vertices, one shared cel material, one outline */
let bodyM = null;
function fold(g){
  const parts = g.children.filter(c => c.isMesh);
  if (parts.length < 2) return g;
  const geos = parts.map(m => {
    m.updateMatrix();
    const q = m.geometry.clone();
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    q.applyMatrix4(m.matrix);
    const c = m.material.color || new THREE.Color(0xffffff), n = q.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++){ col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    q.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return q.index ? q.toNonIndexed() : q;
  });
  if (!bodyM){ bodyM = toon(0xffffff).clone(); bodyM.vertexColors = true; }
  const body = new THREE.Mesh(mergeGeometries(geos, false), bodyM);
  for (const q of geos) q.dispose();
  for (const m of parts) g.remove(m);
  body.castShadow = true; inkify(body, 0.025);
  g.add(body);
  return g;
}
function place(g, x, y, z, ry){ g.position.set(x, y, z); g.rotation.y = ry; shared.arenaGroup.add(liveAll(fold(g))); return g; }
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

/* someone walking a closed loop of points at `speed` m/s, `lead` metres along it (so a file of them walks one behind
   another); y lifts the whole path (a dais) */
function walk(g, pts, speed, lead = 0, y = 0){
  const seg = [];
  let L = 0;
  for (let i = 0; i < pts.length; i++){ const a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push([a, b, d, L]); L += d; }
  place(g, pts[0][0], y, pts[0][1], 0);
  anim(g, (o, t) => {
    let d = ((t * speed + lead) % L + L) % L;
    const s = seg.find(q => d >= q[3] && d < q[3] + q[2]) || seg[0], k = (d - s[3]) / (s[2] || 1);
    const dx = s[1][0] - s[0][0], dz = s[1][1] - s[0][1];
    o.position.set(s[0][0] + dx * k, y + Math.abs(Math.sin(d * 3.2)) * 0.05, s[0][1] + dz * k);
    o.rotation.y = Math.atan2(dx, dz);
  });
  return g;
}
/* someone standing (talking, watching, keeping watch): a slow sway, now and then a turn of the head-and-shoulders */
function stand(g, x, y, z, ry, seed = 0){
  place(g, x, y, z, ry);
  anim(g, (o, t) => { o.rotation.y = ry + Math.sin(t * 0.5 + seed) * 0.12; o.rotation.z = Math.sin(t * 0.9 + seed * 2) * 0.02; });
  return g;
}
/* a drill: the saber swings through a guard, a cut and back, everyone on the master's count */
function drill(piv, rate = 1.6, phase = 0){
  anim(piv, (o, t) => { const k = t * rate + phase; o.rotation.x = 0.5 + Math.sin(k) * 0.9; o.rotation.z = -0.4 + Math.cos(k) * 0.5; });
}

export function templeFolk(wing){
  let n = 0;
  const S = () => ++n * 7 + 3;
  if (wing === 'hall'){
    // a master leading a file of younglings up and down the processional, and two knights walking the other way round
    const loop = [[-14, -36], [14, -36], [14, 36], [-14, 36]];
    walk(jedi(S(), true), loop, 1.2, 0);
    for (let i = 1; i <= 4; i++) walk(youngling(S()), loop, 1.2, -1.4 * i);
    const back = [...loop].reverse();
    walk(jedi(S()), back, 1.3, 40); walk(jedi(S(), false), back, 1.3, 41.3);
    // two knights by the west colossus, talking; a master by the pool watching the map
    stand(jedi(S()), -27, 0, 6, face(-27, 6, -25.8, 7.4), 1); stand(jedi(S(), true), -25.8, 0, 7.4, face(-25.8, 7.4, -27, 6), 2);
    stand(jedi(S(), true), 9.5, 0.4, -9.5, face(9.5, -9.5, 0, 0), 3);
  } else if (wing === 'council'){
    // two masters at the table, over the galaxy, and one walking round it, deep in thought
    stand(jedi(S(), true), -4.6, 0.45, -3.6, face(-4.6, -3.6, 0, 0), 1);
    stand(jedi(S()), 4.6, 0.45, -3.6, face(4.6, -3.6, 0, 0), 2);
    const ring = []; for (let i = 0; i < 16; i++){ const a = -i / 16 * PI * 2; ring.push([Math.cos(a) * 7.2, Math.sin(a) * 7.2]); }
    walk(jedi(S(), true), ring, 0.6, 0, 0.45);
  } else if (wing === 'training'){
    // a class on the training grounds' mat: a row of younglings drilling a form on their master's count
    const [gx, gz] = [-6, -18];
    const m = stand(jedi(S(), false), gx, 0, gz - 5.2, 0, 1);
    drill(saber(m, 0x7aff6a, 0.9), 1.6, 0);
    for (let i = 0; i < 5; i++){
      const y = youngling(S()), x = gx - 4 + i * 2;
      place(y, x, 0, gz - 2.4, PI);
      drill(saber(y, BLADES[i % 3]), 1.6, 0.35);
    }
    // two younglings sparring on the proving ground, either side of its ring
    const [px, pz] = [-6, 18];
    for (const s of [-1, 1]){
      const y = youngling(S()); place(y, px + s * 2.6, 0, pz, face(px + s * 2.6, pz, px, pz));
      drill(saber(y, BLADES[(s + 1) / 2 * 2]), 2.4, s > 0 ? PI : 0);
    }
    // one at the sparring hall, turning blasts from the remotes; a knight watching from the side
    { const y = youngling(S()); place(y, 14, 0, 3.2, PI); drill(saber(y, 0x5ad2ff), 3.1, 0);
      anim(y, (o, t) => { o.rotation.y = PI + Math.sin(t * 0.8) * 0.7; }); }
    stand(jedi(S()), 20.5, 0, 6.5, face(20.5, 6.5, 14, 3), 4);
  } else if (wing === 'archives'){
    // archivists walking the reading floor round the desk, and one at the desk
    const loop = [[-18, -6.4], [18, -6.4], [18, 6.4], [-18, 6.4]];
    walk(archivist(S()), loop, 0.8, 0); walk(archivist(S()), loop, 0.8, 37);
    stand(archivist(S()), 0, 0.35, -3.3, 0, 2);
    stand(jedi(S(), true), -14, 0, 11.25, PI / 2, 3);   // (reading down an aisle)
  } else if (wing === 'forge'){
    // a Jedi kneeling in meditation at the edge of the circle, facing the heart crystal
    const k = jedi(S(), true); place(k, -4.2, 0.35, 9.2, face(-4.2, 9.2, 0, 6)); k.scale.set(1, 0.62, 1);
    anim(k, (o, t) => { o.position.y = 0.35 + Math.sin(t * 0.7) * 0.01; });
  }
}
