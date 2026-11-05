// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GUNNERS' BENCH SETS (ui/kitbench.js is their panel): the rooms the hero stands in while the trooper's ARMORY
// LOCKER or the Mando's BESKAR FORGE is open, in place of the customizer's painted sky and turntable (ui/showcase.js
// swaps them in, and the hero on the stand is the same figure, wearing each pick as it is made). The Jedi's saber
// workbench has its own (ui/bench-stage.js).
//
// THE ARMORY: a Kamino armory bay. White locker banks with the legion stripe, two stood open on a rifle and a helmet,
// a weapons rack, a storm hammering the long window, strip lights in the ceiling, and the trooper on a fitting pad
// whose scan ring runs up and down him.
// THE FORGE: the Armorer's cave. A coal hearth under its hood throwing embers, the anvil with a bar of beskar still
// glowing on it, clan banners on the rock, a shelf of ingots, and the Mando on a riveted iron plate with a hot groove.
//
// Built the first time a bench opens. No imports but three: ui/showcase.js mounts it into its own scene.

import * as THREE from 'three';

const std = (c, r = 0.7, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const glow = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
const box = (parent, w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
const cyl = (parent, rt, rb, h, mat, x, y, z, seg = 24) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); parent.add(m); return m; };
function canvasTex(w, h, draw, rep){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function rng(seed){ return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

/* ================= THE ARMORY (the trooper) ================= */
function buildArmory(PAD){
  const room = new THREE.Group(), pad = new THREE.Group(), anim = {};
  const white = std(0xd9dde0, 0.5, 0.15), seam = std(0x9aa3ab, 0.6, 0.3), dark = std(0x23282e, 0.6, 0.5);
  const blue = std(0x2f6fc0, 0.5, 0.2), steel = std(0x7c8690, 0.35, 0.8);
  room.add(new THREE.HemisphereLight(0xcfe4ff, 0x30363c, 0.2));
  const cool = new THREE.PointLight(0x9cc8ff, 5, 12, 1.4); cool.position.set(-2.5, 3, -1); room.add(cool);
  const win = new THREE.PointLight(0x3a7bd6, 7, 10, 1.4); win.position.set(2.6, 2, -2.4); room.add(win);
  // the floor: pale deck plates, a blue safety line round the pad
  const deck = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#b9bfc4'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#8c949b'; x.lineWidth = 4;
    for (let i = 0; i <= 4; i++){ x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 128); x.lineTo(w, i * 128); x.stroke(); }
    x.fillStyle = '#9aa2a9'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (const [a, b] of [[12, 12], [116, 12], [12, 116], [116, 116]]){ x.beginPath(); x.arc(i * 128 + a, j * 128 + b, 4, 0, 6.3); x.fill(); }
  }, [6, 5]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), new THREE.MeshStandardMaterial({ map: deck, roughness: 0.55, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-1, 0, 2); room.add(floor);
  const line = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.63, 64), new THREE.MeshBasicMaterial({ color: 0x2f7fd6 }));
  line.rotation.x = -Math.PI / 2; line.position.y = 0.004; room.add(line);
  for (let i = 0; i < 12; i++){   // hazard dashes inside the line
    const a = i / 12 * Math.PI * 2, d = box(room, 0.06, 0.004, 0.22, glow(0x5aa8ff, 0.8), Math.cos(a) * 1.42, 0.004, Math.sin(a) * 1.42); d.rotation.y = -a;
  }
  // the back wall: panels with rounded seams, a stencil band
  box(room, 18, 6, 0.2, white, -1, 3, -3.8);
  for (let i = 0; i < 9; i++) box(room, 0.05, 6, 0.05, seam, -8.5 + i * 2, 3, -3.68);
  box(room, 18, 0.06, 0.05, seam, -1, 3.05, -3.68);
  box(room, 18, 0.22, 0.06, blue, -1, 2.78, -3.66);
  const sign = canvasTex(1024, 128, (x, w, h) => {
    x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h);
    x.fillStyle = '#2a3440'; x.font = '700 92px "Barlow Condensed", "Arial Narrow", sans-serif'; x.textBaseline = 'middle';
    x.textAlign = 'right'; x.fillText('ARMORY BAY 7', w - 10, h / 2);
    x.fillStyle = '#2f6fc0'; x.font = '600 46px "Barlow Condensed", "Arial Narrow", sans-serif'; x.fillText('ISSUE · REFIT · REQUISITION', w - 520, h / 2 + 6);
  });
  const signM = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.75), new THREE.MeshBasicMaterial({ map: sign, transparent: true }));
  signM.position.set(-1.6, 3.4, -3.64); room.add(signM);
  // the locker bank
  const num = (n) => canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#e3e6e8'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2f6fc0'; x.fillRect(0, 0, w, 22);
    x.fillStyle = '#3a4450'; x.font = '700 54px "Barlow Condensed", "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.fillText(String(n).padStart(2, '0'), w / 2, 86);
  });
  const LOCK_W = 0.78, LOCK_H = 2.5, LZ = -3.35;
  for (let i = 0; i < 8; i++){
    const x = -6.6 + i * (LOCK_W + 0.06), open = i === 3 || i === 5;
    box(room, LOCK_W, LOCK_H, 0.62, seam, x, LOCK_H / 2, LZ);   // the carcass
    box(room, LOCK_W - 0.06, LOCK_H - 0.06, 0.02, dark, x, LOCK_H / 2, LZ + 0.3);   // its dark inside
    const hinge = new THREE.Group(); hinge.position.set(x - LOCK_W / 2 + 0.02, 0, LZ + 0.32); room.add(hinge);
    const door = box(hinge, LOCK_W - 0.04, LOCK_H - 0.08, 0.04, white, LOCK_W / 2 - 0.02, LOCK_H / 2, 0);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshStandardMaterial({ map: num(i + 11), roughness: 0.6 }));
    plate.position.set(0, 0.62, 0.025); door.add(plate);
    for (let v = 0; v < 4; v++) box(door, 0.5, 0.025, 0.01, seam, 0, -0.5 - v * 0.08, 0.025);   // the vents
    box(door, 0.04, 0.3, 0.04, steel, LOCK_W / 2 - 0.12, 0.1, 0.04);
    if (open){
      hinge.rotation.y = -1.9;
      box(room, LOCK_W - 0.1, 0.03, 0.5, steel, x, 1.7, LZ);   // a shelf
      // a DC-15 stood upright and a spare helmet on the shelf
      const rifle = new THREE.Group(); rifle.position.set(x + (i === 3 ? 0.12 : -0.1), 0.75, LZ + 0.05); rifle.rotation.z = 0.06; room.add(rifle);
      box(rifle, 0.07, 1.1, 0.12, dark, 0, 0, 0); box(rifle, 0.04, 0.4, 0.04, steel, 0, 0.72, 0); box(rifle, 0.1, 0.22, 0.16, dark, 0, -0.45, 0.04);
      const hel = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), white); hel.scale.set(1, 1.1, 1.05); hel.position.set(x, 1.9, LZ + 0.04); room.add(hel);
      box(room, 0.2, 0.05, 0.03, dark, x, 1.92, LZ + 0.2); box(room, 0.05, 0.14, 0.03, dark, x, 1.85, LZ + 0.2);   // the T visor
      if (i === 5){ box(room, 0.16, 0.035, 0.03, blue, x, 2.0, LZ + 0.19); }
    }
  }
  // the long window to the right: the storm outside, rain streaks running down it
  const rainTex = canvasTex(256, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a2038'); g.addColorStop(1, '#1d4a78');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 160; i++){ x.strokeStyle = `rgba(190,225,255,${0.12 + r() * 0.3})`; x.lineWidth = 1 + r(); const sx = r() * w, sy = r() * h, l = 20 + r() * 60; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx - 4, sy + l); x.stroke(); }
  });
  rainTex.wrapS = rainTex.wrapT = THREE.RepeatWrapping;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.3), new THREE.MeshBasicMaterial({ map: rainTex }));
  glass.position.set(2.4, 1.85, -3.68); room.add(glass); anim.rain = rainTex;
  for (const dx of [-1.7, -0.57, 0.57, 1.7]) box(room, 0.08, 2.4, 0.08, seam, 2.4 + dx, 1.85, -3.62);
  box(room, 3.6, 0.1, 0.12, seam, 2.4, 0.66, -3.6); box(room, 3.6, 0.1, 0.12, seam, 2.4, 3.04, -3.6);
  anim.flash = new THREE.PointLight(0xbfe0ff, 0, 9, 1.2); anim.flash.position.set(2.4, 2, -3); room.add(anim.flash);
  // the weapons rack on the left: four rifles in their clamps
  const rack = new THREE.Group(); rack.position.set(-3.8, 0, -1.6); rack.rotation.y = 0.55; room.add(rack);
  box(rack, 1.9, 0.12, 0.5, seam, 0, 0.06, 0); box(rack, 1.9, 0.06, 0.1, steel, 0, 1.45, -0.18);
  for (const sx of [-0.9, 0.9]) box(rack, 0.08, 1.6, 0.4, seam, sx, 0.8, 0);
  for (let k = 0; k < 4; k++){
    const g = new THREE.Group(); g.position.set(-0.6 + k * 0.4, 0.8, 0); g.rotation.z = 0.04; rack.add(g);
    box(g, 0.07, 1.25, 0.12, dark, 0, 0, 0); box(g, 0.035, 0.32, 0.035, steel, 0, 0.78, 0); box(g, 0.1, 0.24, 0.18, k % 2 ? dark : blue, 0, -0.5, 0.05);
  }
  // a fitting bench with two helmets, near left
  box(room, 1.4, 0.06, 0.55, steel, -2.4, 0.62, 0.9); for (const sx of [-0.6, 0.6]) box(room, 0.06, 0.62, 0.5, seam, -2.4 + sx, 0.31, 0.9);
  for (const [hx, b] of [[-2.75, false], [-2.15, true]]){
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), white); h.scale.set(1, 1.1, 1.05); h.position.set(hx, 0.83, 0.9); room.add(h);
    box(room, 0.22, 0.05, 0.03, dark, hx, 0.85, 1.07); box(room, 0.05, 0.15, 0.03, dark, hx, 0.78, 1.07);
    if (b) box(room, 0.05, 0.22, 0.2, blue, hx, 0.96, 0.9);
  }
  // the ceiling's strip lights
  for (let i = 0; i < 4; i++) box(room, 2.6, 0.06, 0.18, glow(0xe8f4ff, 2.2), -5.5 + i * 3, 3.95, -1.8 + (i % 2) * 0.4);
  box(room, 18, 0.2, 8, std(0xaab2b8, 0.6, 0.2), -1, 4.1, 0);
  // THE FITTING PAD: a white dais, a blue ring, the scan ring running up and down him
  const padM = std(0xe2e5e8, 0.45, 0.25);
  cyl(pad, 1.0, 1.1, PAD, padM, 0, PAD / 2, 0, 48);
  cyl(pad, 1.18, 1.22, 0.06, seam, 0, 0.03, 0, 48);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.024, 8, 96), glow(0x5aa8ff, 2.4)); ring.rotation.x = Math.PI / 2; ring.position.y = PAD; pad.add(ring);
  for (let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; const s = box(pad, 0.24, 0.01, 0.07, glow(0x5aa8ff, 1.4), Math.cos(a) * 0.72, PAD + 0.004, Math.sin(a) * 0.72); s.rotation.y = -a; }
  const scan = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 6, 64), new THREE.MeshBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  scan.rotation.x = Math.PI / 2; pad.add(scan); anim.scan = scan;
  const sheet = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scan.add(sheet);   // (in the ring's own plane)
  return {
    room, pad, bg: new THREE.Color(0x9aa6b0), spot: 0.55,
    step(dt, t){
      anim.rain.offset.y += dt * 0.35;
      const k = (Math.sin(t * 0.9) * 0.5 + 0.5); anim.scan.position.y = PAD + 0.1 + k * 2.1; anim.scan.material.opacity = 0.35 + 0.45 * Math.sin(k * Math.PI);
      // lightning now and then, through the window
      const f = (t % 7.3) < 0.12 || ((t + 0.25) % 7.3) < 0.06 ? 1 : 0;
      anim.flash.intensity += (f * 14 - anim.flash.intensity) * Math.min(1, dt * (f ? 40 : 6));
    },
  };
}

/* ================= THE FORGE (the Mando) ================= */
function buildForge(PAD){
  const room = new THREE.Group(), pad = new THREE.Group(), anim = {};
  const iron = std(0x2c2a2a, 0.55, 0.7), stone = std(0x3a332e, 0.95, 0.05), beskar = std(0xb4bcc6, 0.28, 0.95), wood = std(0x4a3222, 0.85, 0.05);
  room.add(new THREE.HemisphereLight(0x8a5a40, 0x120806, 0.45));
  // the rock round the cave: a curved wall of mottled stone
  const rock = canvasTex(1024, 512, (x, w, h) => {
    x.fillStyle = '#2a211c'; x.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 900; i++){ const s = 6 + r() * 40, l = 18 + r() * 34; x.fillStyle = `rgb(${l + 14},${l + 4},${l - 2})`; x.globalAlpha = 0.25 + r() * 0.3; x.beginPath(); x.ellipse(r() * w, r() * h, s, s * (0.4 + r() * 0.6), r() * 3, 0, 6.3); x.fill(); }
    x.globalAlpha = 0.5; x.strokeStyle = '#120c09'; x.lineWidth = 2;
    for (let i = 0; i < 40; i++){ let px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 5; k++){ px += (r() - 0.5) * 60; py += r() * 40; x.lineTo(px, py); } x.stroke(); }
    x.globalAlpha = 1;
  }, [3, 1]);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 7, 40, 1, true, Math.PI * 0.55, Math.PI * 0.9), new THREE.MeshStandardMaterial({ map: rock, roughness: 0.95, side: THREE.BackSide }));
  wall.position.set(-1, 3.2, 2.6); room.add(wall);
  box(room, 18, 0.3, 12, std(0x150f0c, 1, 0), -1, 5.6, 1);   // the cave roof, lost in the dark
  // the floor: flagstones
  const flags = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#1b1512'; x.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let j = 0; j < 6; j++){ let px = -r() * 60; while (px < w){ const fw = 60 + r() * 70, l = 40 + r() * 22; x.fillStyle = `rgb(${l + 8},${l},${l - 6})`; x.fillRect(px + 3, j * 86 + 3, fw - 6, 80); px += fw; } }
  }, [5, 4]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), new THREE.MeshStandardMaterial({ map: flags, roughness: 0.9, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-1, 0, 2); room.add(floor);
  // THE HEARTH: a stone base, a bed of coals, the hood and its flue
  const H = new THREE.Group(); H.position.set(-2.2, 0, -3.1); H.rotation.y = 0.2; room.add(H);
  box(H, 2.0, 1.0, 1.3, stone, 0, 0.5, 0);
  box(H, 1.6, 0.12, 0.95, std(0x1a1210, 1, 0), 0, 1.0, 0);
  anim.coals = new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false });
  const coals = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.06, 0.8), anim.coals); coals.position.set(0, 1.08, 0); H.add(coals);
  const r = rng(13);
  for (let i = 0; i < 26; i++){ const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + r() * 0.05), i % 3 ? anim.coals : std(0x221410, 0.9, 0)); c.position.set((r() - 0.5) * 1.35, 1.12 + r() * 0.04, (r() - 0.5) * 0.7); H.add(c); }
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.25, 1.1, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide }));
  hood.rotation.y = Math.PI / 4; hood.position.set(0, 2.25, 0); H.add(hood);
  cyl(H, 0.3, 0.3, 3, iron, 0, 4.2, 0, 12);
  anim.fire = new THREE.PointLight(0xff7a2a, 16, 9, 1.4); anim.fire.position.set(-2.0, 1.6, -2.5); room.add(anim.fire);
  // the embers rising off the coals
  const N = 70, pos = new Float32Array(N * 3), life = new Float32Array(N);
  const seed = (i) => { pos[i * 3] = -2.2 + (r() - 0.5) * 1.2; pos[i * 3 + 1] = 1.15; pos[i * 3 + 2] = -3.1 + (r() - 0.5) * 0.6; life[i] = r(); };
  for (let i = 0; i < N; i++){ seed(i); pos[i * 3 + 1] += r() * 2.5; }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(2.5), size: 0.05, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  embers.frustumCulled = false; room.add(embers);
  anim.embers = { pos, life, seed, geo: eg, N };
  // THE ANVIL, a bar of beskar still glowing on its face, the hammer by it, a quench trough
  const A = new THREE.Group(); A.position.set(-1.85, 0, 1.0); A.rotation.y = 0.5; room.add(A);
  box(A, 0.7, 0.55, 0.7, wood, 0, 0.275, 0);   // the stump
  box(A, 0.5, 0.12, 0.38, iron, 0, 0.61, 0); box(A, 0.26, 0.25, 0.22, iron, 0, 0.8, 0);
  box(A, 0.86, 0.16, 0.32, iron, 0.02, 1.0, 0);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 12), iron); horn.rotation.z = Math.PI / 2; horn.position.set(0.68, 1.0, 0); horn.scale.z = 0.8; A.add(horn);
  anim.bar = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a2a).multiplyScalar(2), toneMapped: false });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.09), anim.bar); bar.position.set(-0.05, 1.1, 0.02); bar.rotation.y = 0.2; A.add(bar);
  const ham = new THREE.Group(); ham.position.set(-0.2, 1.1, -0.12); ham.rotation.set(0, -0.4, 0.08); A.add(ham);
  cyl(ham, 0.025, 0.025, 0.55, wood, 0, 0.02, 0, 8).rotation.z = Math.PI / 2; box(ham, 0.1, 0.1, 0.2, iron, -0.27, 0.02, 0);
  const T = new THREE.Group(); T.position.set(-3.0, 0, 0.3); T.rotation.y = 0.9; room.add(T);
  box(T, 1.0, 0.4, 0.5, stone, 0, 0.2, 0); box(T, 0.9, 0.02, 0.4, new THREE.MeshStandardMaterial({ color: 0x0e1418, roughness: 0.1, metalness: 0.6 }), 0, 0.39, 0);
  // the clan banners hung on the rock
  const banner = canvasTex(256, 640, (x, w, h) => {
    x.fillStyle = '#5a1414'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#3a0c0c'; for (let i = 0; i < 20; i++) x.fillRect(0, i * 32, w, 2);
    x.strokeStyle = '#c9a24a'; x.lineWidth = 6; x.strokeRect(14, 14, w - 28, h - 28);
    // a horned skull of the clan's own drawing
    x.fillStyle = '#c9a24a'; const cx = w / 2, cy = 250;
    x.beginPath(); x.moveTo(cx - 60, cy - 30); x.quadraticCurveTo(cx - 120, cy - 90, cx - 96, cy - 160); x.quadraticCurveTo(cx - 90, cy - 100, cx - 40, cy - 60); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(cx + 60, cy - 30); x.quadraticCurveTo(cx + 120, cy - 90, cx + 96, cy - 160); x.quadraticCurveTo(cx + 90, cy - 100, cx + 40, cy - 60); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(cx - 64, cy - 50); x.lineTo(cx + 64, cy - 50); x.lineTo(cx + 46, cy + 60); x.lineTo(cx, cy + 110); x.lineTo(cx - 46, cy + 60); x.closePath(); x.fill();
    x.fillStyle = '#5a1414'; x.beginPath(); x.ellipse(cx - 26, cy, 14, 22, 0.3, 0, 6.3); x.ellipse(cx + 26, cy, 14, 22, -0.3, 0, 6.3); x.fill();
    x.fillRect(cx - 4, cy + 30, 8, 60);
    x.fillStyle = '#c9a24a'; for (let i = 0; i < 3; i++) x.fillRect(cx - 50, 430 + i * 40, 100, 10);
    x.beginPath(); x.moveTo(14, h - 14); x.lineTo(w / 2, h - 80); x.lineTo(w - 14, h - 14); x.fillStyle = '#2a0808'; x.fill();
  });
  const banMat = new THREE.MeshStandardMaterial({ map: banner, roughness: 0.9, side: THREE.DoubleSide });
  for (const [bx, bz, ry] of [[-4.4, -3.6, 0.35], [1.95, -3.95, -0.2]]){
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.75, 1, 6), banMat); b.position.set(bx, 2.55, bz); b.rotation.y = ry; room.add(b);
    const p = cyl(room, 0.03, 0.03, 1.35, iron, bx, 3.95, bz + 0.02, 8); p.rotation.set(0, ry, Math.PI / 2);
  }
  // the shelf of beskar ingots and the tools on the wall
  const S = new THREE.Group(); S.position.set(0.3, 0, -4.15); S.rotation.y = -0.05; room.add(S);
  box(S, 2.4, 0.08, 0.5, wood, 0, 1.3, 0); box(S, 2.4, 0.08, 0.5, wood, 0, 0.55, 0);
  for (const sx of [-1.15, 1.15]) box(S, 0.08, 1.4, 0.5, wood, sx, 0.7, 0);
  for (let k = 0; k < 7; k++) box(S, 0.34, 0.12, 0.2, beskar, -0.9 + k * 0.3, 1.4 + (k % 2) * 0.12, (k % 3 - 1) * 0.08);
  for (let k = 0; k < 5; k++) box(S, 0.34, 0.12, 0.2, beskar, -0.6 + k * 0.3, 0.65, 0);
  for (let k = 0; k < 4; k++){   // tongs and hammers hung above
    const h = new THREE.Group(); h.position.set(-1.0 + k * 0.6, 2.4, 0.05); S.add(h);
    box(h, 0.03, 0.7, 0.03, iron, 0, 0, 0); box(h, k % 2 ? 0.16 : 0.08, 0.1, 0.08, iron, 0, -0.38, 0);
  }
  // an empty helmet on a post: the work still to do
  cyl(room, 0.04, 0.05, 1.3, iron, 1.9, 0.65, -0.9, 8);
  const hel = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), beskar); hel.scale.set(1, 1.15, 1.05); hel.position.set(1.9, 1.45, -0.9); room.add(hel); hel.rotation.y = -0.6;
  box(room, 0.26, 0.05, 0.03, std(0x0a0a0a, 0.3, 0.2), 1.9 - 0.1, 1.47, -0.9 + 0.17).rotation.y = -0.6;
  // THE PLATE he stands on: riveted iron, a hot groove round it
  cyl(pad, 1.0, 1.1, PAD, iron, 0, PAD / 2, 0, 10);
  cyl(pad, 1.24, 1.3, 0.06, stone, 0, 0.03, 0, 10);
  anim.groove = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a1a).multiplyScalar(1.8), toneMapped: false });
  const groove = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.018, 6, 10), anim.groove); groove.rotation.x = Math.PI / 2; groove.position.y = PAD + 0.002; pad.add(groove);
  for (let i = 0; i < 10; i++){ const a = (i + 0.5) / 10 * Math.PI * 2; const rv = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), beskar); rv.position.set(Math.cos(a) * 0.95, PAD, Math.sin(a) * 0.95); pad.add(rv); }
  return {
    room, pad, bg: new THREE.Color(0x0a0605), spot: 0.85,
    step(dt, t){
      const fl = 0.8 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3 + 1) * 0.1 + Math.sin(t * 23) * 0.04;
      anim.fire.intensity = 16 * fl;
      anim.coals.color.setHex(0xff4a12).multiplyScalar(1.1 + fl * 0.6);
      anim.bar.color.setHex(0xff8a2a).multiplyScalar(1.6 + Math.sin(t * 1.3) * 0.25);
      anim.groove.color.setHex(0xff6a1a).multiplyScalar(1.4 + Math.sin(t * 0.8) * 0.3);
      const E = anim.embers;
      for (let i = 0; i < E.N; i++){
        E.life[i] += dt * 0.4;
        E.pos[i * 3 + 1] += dt * (0.5 + (i % 5) * 0.12);
        E.pos[i * 3] += Math.sin(t * 2 + i) * dt * 0.15;
        if (E.life[i] > 1 || E.pos[i * 3 + 1] > 4) E.seed(i);
      }
      E.geo.attributes.position.needsUpdate = true;
    },
  };
}

const BUILD = { trooper: buildArmory, mando: buildForge };
const sets = {};
// the set for a gunner (built once): { room, pad, bg, spot (the stand's spotlight, scaled), step(dt, t) }. `room` stands still in the scene, `pad` goes under
// the figure and turns with it
export function kitSet(hero, PAD){
  if (!BUILD[hero]) return null;
  if (!sets[hero]){ sets[hero] = BUILD[hero](PAD); sets[hero].room.visible = sets[hero].pad.visible = false; }
  return sets[hero];
}
export const kitSets = () => Object.values(sets);
