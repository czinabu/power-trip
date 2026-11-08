// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SLIM: a hero model merged down to a few dozen draws (the temple's people, the open zone's quest givers, co-op partners).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* SLIM a figure down to what the temple draws: the Mandalorian's and the trooper's outfits and the guns that every hero
   model carries hidden go entirely, and the rigid pieces riding each joint are merged, one mesh per material (and one
   outline), instead of a mesh each. What the face and the saber move stays as it is. A hero model is well over a hundred
   draws; this brings one down to a few dozen. */
/* A CO-OP PARTNER (partner: the hero they play) keeps their gear (it switches with what they hold: net/pose.js) and their
   shadows; the outfits of the heroes they don't play go, and their own outfit is merged with the rest. They are rebuilt
   when they switch hero (net/partner.js). Three partners in full were some 400 extra draws a frame. */
export function slim(target, { partner = null } = {}){
  const T = target;
  const own = partner === 'mando' ? T.mandoParts : partner === 'trooper' ? T.trooperParts : null;
  for (const m of [...(T.mandoParts || []), ...(T.trooperParts || [])]) if (!own || !own.includes(m)) m.removeFromParent();
  if (partner && partner !== 'jedi'){ for (const m of T.headBare || []) m.removeFromParent(); if (T.rig.skirt) T.rig.skirt.removeFromParent(); }
  if (!partner) for (const w of [T.pistols && T.pistols.L, T.pistols && T.pistols.R, T.rifleMesh, T.darksaberMesh]) if (w) w.removeFromParent();
  // keep whatever the figure's own code reaches for (the eyelids, the jaw, the hands, the saber): every Object3D the
  // target names, and everything under them
  const keep = new Set();
  const mark = (o) => o.traverse(c => keep.add(c));
  const look = (v, depth) => {
    if (!v || typeof v !== 'object' || depth > 2) return;
    if (v.isObject3D){ if (v !== T.group && v !== T.vis) mark(v); return; }
    for (const x of Array.isArray(v) ? v : Object.values(v)) look(x, depth + 1);
  };
  const fixed = partner ? ['mandoParts', 'trooperParts', 'saberPivot'] : [];   // (a partner's outfit is set for good; the shoulder is a joint)
  for (const [k, v] of Object.entries(T)) if (k !== 'rig' && k !== 'group' && k !== 'vis' && k !== 'headBare' && k !== 'cloth' && !fixed.includes(k)) look(v, 0);
  for (const C of T.cloth || []) if (C.mesh) mark(C.mesh);
  const hullOf = (m) => m.children.length === 1 && m.children[0].isMesh && m.children[0].material.side === THREE.BackSide ? m.children[0] : null;
  const joints = [];
  T.vis.traverse(o => { if (!o.isMesh) joints.push(o); });
  for (const J of joints){
    const buckets = new Map();
    for (const c of J.children){
      if (!c.isMesh || c.isSkinnedMesh || !c.visible || keep.has(c) || c.morphTargetInfluences) continue;
      if (c.children.length && !hullOf(c)) continue;
      const key = c.material.uuid + '|' + Object.keys(c.geometry.attributes).sort().join(',') + '|' + c.castShadow;
      (buckets.get(key) || buckets.set(key, []).get(key)).push(c);
    }
    for (const list of buckets.values()){
      if (list.length < 2) continue;
      const geos = [], hulls = new Map();
      for (const c of list){
        c.updateMatrix();
        const g = c.geometry.clone().applyMatrix4(c.matrix); geos.push(g.index ? g.toNonIndexed() : g);
        const h = hullOf(c);
        if (h){ h.updateMatrix(); const hg = h.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(c.matrix, h.matrix));
          const hk = h.material.uuid; (hulls.get(hk) || hulls.set(hk, { mat: h.material, g: [] }).get(hk)).g.push(hg.index ? hg.toNonIndexed() : hg); }
      }
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const M = new THREE.Mesh(merged, list[0].material); M.castShadow = list[0].castShadow; J.add(M);
      for (const { mat, g } of hulls.values()){ const hg = mergeGeometries(g, false); if (hg){ const H = new THREE.Mesh(hg, mat); H.castShadow = false; J.add(H); } }
      for (const c of list) c.removeFromParent();
    }
  }
  if (!partner) T.group.traverse(o => { if (o.isMesh) o.castShadow = false; });   // (no shadows of their own: the temple's light falls on the floor alone)
}
