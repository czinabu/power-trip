// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE SECRETS' PROPS (game/secrets.js places them, data/secrets.js says where they go): a holocron on a worn plinth, a
// crystal cave (a ring of boulders round a glowing cluster of kyber) and a meditation spot (a lit circle, a mat and a few
// stones that float). Each is its own small group, live (never baked), with no light of its own: everything glows by its
// material, so placing one never changes the scene's light count (which would recompile every shader mid-mission).
// Each returns { g, anim(t), solids: [...] } where solids are the cave's boulders, for world/collision.js.

import * as THREE from 'three';

const glow = (col, o = 0.9) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const stone = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.92, metalness: 0.04, flatShading: true });
const live = (g) => { g.traverse(o => { o.userData.noBake = true; }); return g; };

// a holocron on its own (the codex's turntable shows this one too): a cube in a metal frame, set on its corner, lit inside
export function holocronCube(col = 0x7fd8ff, size = 0.34){
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.BoxGeometry(size * 0.7, size * 0.7, size * 0.7), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.85 }));
  const shell = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.35, metalness: 0.8, transparent: true, opacity: 0.35 }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)), new THREE.LineBasicMaterial({ color: 0xd8c890 }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(size * 1.1, 14, 10), glow(col, 0.16));
  for (const m of [core, shell, edges, halo]) g.add(m);
  g.rotation.set(Math.PI / 4, 0, Math.atan(Math.SQRT1_2));   // stood on a corner
  const out = new THREE.Group(); out.add(g);
  out.userData.spin = g;
  return out;
}

export function holocronProp(col){
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.9, 7), stone(0x6a6458));
  plinth.position.y = 0.45; g.add(plinth);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.1, 7), stone(0x8a8070));
  cap.position.y = 0.94; g.add(cap);
  const cube = holocronCube(col);
  cube.position.y = 1.35; g.add(cube);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24).rotateX(-Math.PI / 2), glow(col, 0.14));
  pool.position.y = 0.03; g.add(pool);
  return { g: live(g), solids: [], anim(t){ cube.userData.spin.rotation.y = t * 0.9; cube.position.y = 1.35 + Math.sin(t * 1.7) * 0.06; } };
}

// the cave: six boulders in a horseshoe (open toward `face`, radians), the kyber in the middle
export function caveProp(col, face = 0){
  const g = new THREE.Group(), solids = [];
  const rockMat = stone(0x4a4450), rockMat2 = stone(0x5a5260);
  const R = 2.5;
  for (let i = 0; i < 7; i++){
    const a = face + Math.PI * (0.32 + i * 0.226);   // 0.32π .. 1.68π round the back, the mouth at `face`
    const r = 0.95 + (i % 3) * 0.18, h = (i === 0 || i === 6 ? 1.0 : 1.6 + ((i * 7) % 5) * 0.28);   // (the two by the mouth stay low)
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), i % 2 ? rockMat : rockMat2);
    m.scale.set(1, h / (r * 1.6), 1);
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    m.position.set(x, h * 0.42, z); m.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    g.add(m);
    solids.push({ x, z, r: r * 0.92, h: h * 0.85 });
  }
  // an overhanging slab across the back two, to read as a hollow under the rocks
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 2.0), rockMat);
  roof.position.set(-Math.sin(face) * 1.4, 2.2, -Math.cos(face) * 1.4); roof.rotation.y = face; roof.rotation.z = 0.12;
  g.add(roof);
  const cluster = new THREE.Group();
  const cm = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 7; i++){
    const s = i ? 0.55 + (i % 3) * 0.2 : 1.05, k = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), cm);   // (the middle one tallest)
    k.scale.set(1, s * 3.6, 1);
    const a = i * 2.4;
    k.position.set(Math.cos(a) * 0.42 * (i ? 1 : 0), s * 0.6, Math.sin(a) * 0.42 * (i ? 1 : 0));
    k.rotation.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
    cluster.add(k);
  }
  g.add(cluster);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24).rotateX(-Math.PI / 2), glow(col, 0.2));
  pool.position.y = 0.03; g.add(pool);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), glow(col, 0.1));
  halo.position.y = 0.6; g.add(halo);
  return { g: live(g), solids, cluster, anim(t){ cm.emissiveIntensity = 1.3 + Math.sin(t * 2.2) * 0.35; halo.scale.setScalar(1 + Math.sin(t * 1.4) * 0.08); } };
}

// the meditation spot: a lit ring on the ground, a mat in the middle, four stones that float round it
export function meditateProp(col){
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.55, 40).rotateX(-Math.PI / 2), glow(col, 0.55));
  ring.position.y = 0.04; g.add(ring);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1.35, 40).rotateX(-Math.PI / 2), glow(col, 0.08));
  inner.position.y = 0.035; g.add(inner);
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.08, 18), new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.95 }));
  mat.position.y = 0.04; g.add(mat);
  const stones = [];
  for (let i = 0; i < 4; i++){
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (i % 2) * 0.06, 0), stone(0x8a8478));
    g.add(s); stones.push(s);
  }
  // a pale column of light: you see it from across the map only once you are looking for it
  const col_ = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.1, 7, 18, 1, true), glow(col, 0.035));
  col_.position.y = 3.5; g.add(col_);
  const out = { g: live(g), solids: [], ring, fill: 0,
    anim(t){
      stones.forEach((s, i) => { const a = t * 0.5 + i * Math.PI / 2; s.position.set(Math.cos(a) * 1.9, 0.9 + Math.sin(t * 1.3 + i) * 0.18 + out.fill * 0.8, Math.sin(a) * 1.9); s.rotation.y = t + i; });
      ring.material.opacity = 0.4 + Math.sin(t * 1.8) * 0.12 + out.fill * 0.5;
    } };
  return out;
}
