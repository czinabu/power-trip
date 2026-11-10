// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GROWING HUB'S PIECES (data/hub-growth.js, game/hub-growth.js): whatever hub builds a wing (world/arenas/tython.js,
// covert-hub.js, clone-citadel.js) calls growWing() once its wing is up, before its stations' rings and signs:
//   · a wing still waiting to be RESTORED goes dark (everything in it that glows burns low) and gets its rubble: heaps,
//     fallen drums, a scaffold, stacked crates. Each is solid, or a low step you can climb (the collision audit,
//     tools/collision-audit.js, checks them like any prop).
//   · the hub's TROPHY HALL (DEEDS_HALL) gets its plinths, a trophy on each one won, a banner for every raid day won and
//     the wall of friends. These STREAM IN: their collision goes in at once, and their meshes are built and inked a few a
//     frame after the wing is up (GROWTH_STREAM, fewer on a phone's low tier), the way an open zone builds its chunks
//     (world/zone-stream.js), so a phone loading the wing never builds the lot in one frame.

import * as THREE from 'three';
import { shared, solids } from '../../state.js';
import { arenaKit } from './kit.js';
import { PI, std, glowM, holoM, live, anim } from './hub-kit.js';
import { bakeArena } from '../ink.js';
import { qualityLevel } from '../../engine/quality.js';
import { TROPHIES, TROPHY_IDS, DEEDS_HALL, GROWTH_STREAM } from '../../data/hub-growth.js';
import { MODS, raidMods } from '../../data/raids.js';
import { wingWaiting } from '../../game/hub-growth.js';

/* a wing's growth: its dark and its ruins while it waits, the trophy hall if it's this one. o: { stone, stoneD, crate, trim,
   glow (the hub's lit colour), cloth (its banners' colour), ink, plate, edge (the friends' wall in the hub's look) } */
export function growWing(K, hub, wing, st, o = {}){
  const R = st && wingWaiting(st, hub, wing);
  if (R){
    if (R.dark != null) dimWing(R.dark);
    for (const r of R.ruins || []) ruin(K, r, o);
  }
  const D = DEEDS_HALL[hub];
  if (D && D.wing === wing) deedsHall(hub, st, o);
}

/* ---------- the dark: every glow in the wing so far burns at `k` ----------
   (each mesh gets a dimmed copy of its material: a material can be shared with other wings through a cache, and the
   copy keeps the dark in this wing alone) */
function dimWing(k){
  const copies = new Map();
  const dim = (mat) => {
    if (!mat || mat.userData.water || mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return null;   // (a shader of its own stays as it is)
    if (mat.map && mat.transparent) return null;   // (a sign keeps its words)
    if (copies.has(mat)) return copies.get(mat);
    let c = null;
    if (mat.isPointsMaterial){ c = mat.clone(); c.opacity *= k; }
    else if (mat.isMeshBasicMaterial && mat.map){ c = mat.clone(); c.color.multiplyScalar(Math.max(k * 0.6, 0.08)); }   // (the archives' lit shelves of cards)
    else if (mat.isMeshBasicMaterial && mat.blending === THREE.AdditiveBlending){ c = mat.clone(); c.opacity *= k; }
    else if (mat.isMeshBasicMaterial && mat.toneMapped === false){ c = mat.clone(); c.color.multiplyScalar(Math.max(k * 0.6, 0.06)); }
    else if (mat.isMeshStandardMaterial && mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.05){ c = mat.clone(); c.emissiveIntensity *= k; }
    copies.set(mat, c);
    return c;
  };
  shared.arenaGroup.traverse(m => {
    if (!m.material || Array.isArray(m.material)) return;
    const c = dim(m.material); if (c) m.material = c;
  });
}

/* ---------- ruins ---------- */
function ruin(K, r, o){
  const s = r.s || 1, stone = std(o.stone ?? 0xb0a794, 0.95), stoneD = std(o.stoneD ?? 0x8a8270, 0.95);
  switch (r.k){
    case 'rubble': {   // a heap of broken blocks on a low mound you can climb
      const hx = 1.5 * s, hz = 1.2 * s, h = 0.55 * s;
      K.box(r.x, r.z, hx, hz, h, stoneD, { climbable: true });
      const R = seededAt(r.x, r.z);
      for (let i = 0; i < 7; i++){
        const w = (0.5 + R() * 0.5) * s, d = (0.4 + R() * 0.4) * s, t = (0.22 + R() * 0.2) * s;
        const px = r.x + (R() - 0.5) * (hx * 2 - w), pz = r.z + (R() - 0.5) * (hz * 2 - d);
        K.deco(new THREE.BoxGeometry(w, t, d), i % 3 ? stone : stoneD, px, h + t * 0.3, pz, (R() - 0.5) * 0.5, R() * PI, (R() - 0.5) * 0.5);
      }
      break;
    }
    case 'drum': {   // a fallen column: two drums on their sides, a broken capital beside them
      const along = Math.abs(Math.sin(r.ry || 0)) < 0.7;
      K.rubble(r.x, r.z, 3.4 * s, 0.85 * s, stone, along);
      const ox = along ? 0 : 2.3 * s, oz = along ? 2.3 * s : 0;
      K.rubble(r.x + ox, r.z + oz, 1.6 * s, 0.7 * s, stoneD, !along);
      break;
    }
    case 'scaffold': {   // poles round a statue under repair, two decks of planks you can stand on, a dust sheet
      const a = 3.0 * s, wood = std(o.wood ?? 0x7a5230, 0.85), cloth = std(0xc8bca4, 0.95);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.column(r.x + sx * a, r.z + sz * a, 0.14, 9.2 * s, wood, { wallKick: false, seg: 6, taper: 1 });
      for (const y of [4.2 * s, 8.4 * s]) for (const [cx, cz, hx, hz] of [[0, -a, a, 0.45], [0, a, a, 0.45], [-a, 0, 0.45, a], [a, 0, 0.45, a]]){
        K.deco(new THREE.BoxGeometry(hx * 2 + 0.3, 0.14, hz * 2 + 0.3), wood, r.x + cx, y, r.z + cz);
        K.slab(r.x + cx, r.z + cz, hx + 0.15, hz + 0.15, y - 0.08, y + 0.07);
      }
      const sheet = K.deco(new THREE.PlaneGeometry(a * 2, 5.5 * s), cloth, r.x, 5.6 * s, r.z - a - 0.05);
      sheet.material.side = THREE.DoubleSide; sheet.userData.passThrough = true;
      break;
    }
    case 'crates': {   // a stack of crates and a toppled one, climbable from the bottom
      const c = std(o.crate ?? 0x5a4a3a, 0.85), band = std(o.trim ?? 0x8a7a60, 0.5, 0.4);
      K.box(r.x, r.z, 1.1 * s, 1.1 * s, 1.1 * s, c, { climbable: true });
      K.box(r.x + 0.2 * s, r.z + 0.1 * s, 0.85 * s, 0.85 * s, 1.0 * s, c, { y: 1.1 * s });
      K.deco(new THREE.BoxGeometry(2.24 * s, 0.1, 2.24 * s), band, r.x, 0.7 * s, r.z);
      K.box(r.x + 2.3 * s, r.z - 0.4 * s, 0.9 * s, 0.7 * s, 0.9 * s, c, { climbable: true });
      break;
    }
  }
}
// a small seeded random from a spot (ruins look the same on every screen and every load)
function seededAt(x, z){ let a = (Math.round(x * 73) * 9301 + Math.round(z * 37) * 49297 + 233280) >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

/* ---------- the trophy hall ---------- */
// what's still to build, a piece at a time (stepGrowthStream): { root (the arena it belongs to), jobs: [fn] }
let stream = null;
function deedsHall(hub, st, o){
  const D = DEEDS_HALL[hub], jobs = [];
  // the plinths' collision now (nothing walks through one that hasn't drawn yet), their meshes later
  D.plinths.forEach(([x, z]) => solids.push({ x, z, hx: 0.95, hz: 0.95, h: 1.3, box: true }));
  TROPHY_IDS.forEach((id, i) => { const p = D.plinths[i]; if (p) jobs.push((K) => plinth(K, p, id, st && st.trophies[id], o)); });
  // a banner for each raid day won, in that day's modifiers' colours
  const days = (st && st.banners || []).slice(0, D.banners.max);
  days.forEach((b, i) => jobs.push((K) => raidBanner(K, D.banners, i, b, o)));
  jobs.push(() => friendsWall(D, st, o));
  stream = { root: shared.arenaGroup, jobs };
  if (shared.auditBuild) stepGrowthStream(1e9);   // (the collision audit: everything at once, as it stands)
}
/* a few pieces a frame, each into a group of its own that's inked by itself (world/ink.js bakeArena, as a zone's chunk is) */
export function stepGrowthStream(max){
  if (!stream) return;
  if (stream.root !== shared.arenaGroup){ stream = null; return; }   // (the wing was cleared away)
  let n = max ?? (GROWTH_STREAM[qualityLevel()] ?? 1);
  while (n-- > 0 && stream.jobs.length){
    const job = stream.jobs.shift(), g = new THREE.Group(), root = shared.arenaGroup;
    shared.arenaGroup = g;
    let K; try { K = arenaKit(); job(K); } finally { shared.arenaGroup = root; }
    root.add(g);
    if (!shared.auditBuild) bakeArena(g, 0.045);
  }
  if (!stream.jobs.length) stream = null;
}
export const growthStreaming = () => !!stream && stream.jobs.length;

/* a PLINTH: a stepped stone block, a lit ring round its top, its name on a plate, and the trophy on it if it's been won
   (else a faint outline of what's still out there) */
function plinth(K, [x, z, ry], id, won, o){
  const T = TROPHIES[id], stone = std(o.stone ?? 0xd6cfbe, 0.9), stoneD = std(o.stoneD ?? 0xa89f8c, 0.9), trim = std(o.trim ?? 0xd8b860, 0.45, 0.55);
  K.box(x, z, 0.95, 0.95, 0.35, stoneD, { solid: false });
  K.box(x, z, 0.75, 0.75, 1.3, stone, { solid: false });
  K.deco(new THREE.BoxGeometry(1.7, 0.12, 1.7), trim, x, 1.3, z);
  live(K.deco(new THREE.RingGeometry(0.62, 0.7, 32), glowM(won ? T.col : 0x6a6a6a, won ? 0.8 : 0.35), x, 1.37, z, -PI / 2));
  const fx = Math.sin(ry), fz = Math.cos(ry);
  K.sign(won ? T.name : '? ? ?', x + fx * 0.77, 0.82, z + fz * 0.77, ry, { w: 1.4, size: 52, ink: o.ink, edge: o.edge, plate: o.plate });
  const g = new THREE.Group(); g.position.set(x, 1.36, z); g.rotation.y = ry; shared.arenaGroup.add(g);
  if (won) trophy(g, T, o);
  else { const ghost = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), holoM(0x9aa4ae, 0.18)); ghost.position.y = 0.6; g.add(ghost); live(ghost); spin(ghost, 0.5); }
}
const spin = (m, r) => anim(m, (obj, t, b) => { obj.rotation.y = t * r; obj.position.y = b.y + Math.sin(t * 1.2) * 0.05; });
/* each trophy, a small model of what it was taken from */
function trophy(g, T, o){
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  const dark = std(0x24262a, 0.5, 0.6), metal = std(0xa8adb4, 0.35, 0.8);
  switch (T.look){
    case 'blade': {   // his hilt on a cushion, the blade snapped short and still faintly lit
      add(new THREE.BoxGeometry(0.9, 0.12, 0.5), std(0x4a1a1e, 0.95), 0, 0.06, 0);
      add(new THREE.CylinderGeometry(0.05, 0.055, 0.42, 10), dark, 0, 0.18, 0, 0, 0, PI / 2 - 0.15);
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), metal, -0.2, 0.15, 0, 0, 0, PI / 2 - 0.15);
      const blade = add(new THREE.CylinderGeometry(0.022, 0.03, 0.34, 8), glowM(T.col, 0.85), 0.36, 0.23, 0, 0, 0, PI / 2 - 0.15);
      live(blade); anim(blade, (m, t) => { m.material.opacity = 0.55 + Math.sin(t * 9) * 0.12 + (Math.sin(t * 2.3) > 0.85 ? 0.25 : 0); });
      break;
    }
    case 'helm': case 'horns': {   // a helm on a stand: a domed bucket, its visor, a crest (the Magistrate's) or two horns
      const c = std(T.look === 'helm' ? 0xc9a040 : 0x3a2c26, 0.4, 0.7);
      add(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8), dark, 0, 0.15, 0);
      add(new THREE.SphereGeometry(0.3, 14, 10, 0, PI * 2, 0, PI * 0.6), c, 0, 0.62, 0);
      add(new THREE.CylinderGeometry(0.29, 0.27, 0.32, 14), c, 0, 0.46, 0);
      add(new THREE.BoxGeometry(0.36, 0.07, 0.05), new THREE.MeshBasicMaterial({ color: T.look === 'helm' ? 0x111111 : 0xff5a1a }), 0, 0.56, 0.28);
      add(new THREE.BoxGeometry(0.07, 0.18, 0.05), new THREE.MeshBasicMaterial({ color: 0x111111 }), 0, 0.46, 0.28);
      if (T.look === 'helm') add(new THREE.BoxGeometry(0.06, 0.16, 0.56), c, 0, 0.86, 0);
      else for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.07, 0.5, 8), std(0xd8ccb0, 0.6), s * 0.3, 0.82, 0, 0, 0, -s * 0.7);
      break;
    }
    case 'bucket': {   // a clone officer's helmet, gold on its brow and crest
      const w = std(0xeef0f2, 0.45, 0.1), gold = std(T.col, 0.4, 0.6);
      add(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8), dark, 0, 0.15, 0);
      add(new THREE.SphereGeometry(0.27, 14, 10), w, 0, 0.56, 0).scale.set(1, 1.08, 1.05);
      add(new THREE.BoxGeometry(0.5, 0.12, 0.44), w, 0, 0.36, -0.01);
      add(new THREE.BoxGeometry(0.38, 0.07, 0.04), new THREE.MeshBasicMaterial({ color: 0x101418 }), 0, 0.6, 0.27);
      add(new THREE.BoxGeometry(0.08, 0.2, 0.04), new THREE.MeshBasicMaterial({ color: 0x101418 }), 0, 0.48, 0.28);
      add(new THREE.BoxGeometry(0.06, 0.06, 0.5), gold, 0, 0.82, 0);
      add(new THREE.BoxGeometry(0.44, 0.04, 0.04), gold, 0, 0.7, 0.24);
      break;
    }
    case 'shard': {   // a jagged shard of the vessel's beskar, a violet seam burning down it, turning slowly
      const sh = new THREE.Group(); sh.position.y = 0.62; g.add(sh);
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), std(0x2a2830, 0.3, 0.9)); m.scale.set(0.7, 1.4, 0.45); m.castShadow = true; sh.add(m);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.7, 0.32), glowM(T.col, 0.9)); seam.rotation.z = 0.2; sh.add(seam);
      sh.traverse(live); spin(sh, 0.35);
      break;
    }
  }
}
/* a RAID BANNER: one for each raid day won, hung along a wall, striped in that day's modifiers' colours */
function raidBanner(K, B, i, b, o){
  const n = Math.max(1, B.max - 1), x = B.a[0] + (B.b[0] - B.a[0]) * (i / n), z = B.a[1] + (B.b[1] - B.a[1]) * (i / n);
  const mods = raidMods(b.id, b.day), c1 = parseInt((MODS[mods[0]] || {}).col?.slice(1) || 'b46bff', 16), c2 = parseInt((MODS[mods[1]] || {}).col?.slice(1) || 'ffd27a', 16);
  K.banner(x, B.y, z, B.ry, 2.4, 7, o.cloth ?? 0x2a1c34, c2, c1);
}
/* THE WALL OF FRIENDS: a carved panel, its title, and the names of whoever stood with this hero, most deeds first */
function friendsWall(D, st, o){
  const [x, y, z, ry, w] = D.wall, h = w * 0.62, list = (st && st.friends) || [];
  const W = 1024, H = Math.round(W * 0.62), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), ink = o.ink || '#ffe2a0', edge = o.edge || 'rgba(255,214,130,.85)';
  c.fillStyle = o.plate || 'rgba(14,20,30,.9)'; c.fillRect(0, 0, W, H);
  c.strokeStyle = edge; c.lineWidth = 8; c.strokeRect(14, 14, W - 28, H - 28); c.lineWidth = 2; c.strokeRect(30, 30, W - 60, H - 60);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink;
  if ('letterSpacing' in c) c.letterSpacing = '6px';
  c.font = '700 54px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  c.fillText(D.friendsTitle, W / 2, 86);
  c.fillRect(W / 2 - 180, 128, 360, 3);
  if (!list.length){
    c.globalAlpha = 0.65; c.font = '500 36px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
    c.fillText('No names yet.', W / 2, H / 2 + 10);
    c.font = '500 28px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
    c.fillText('Win a raid, an Act IV chapter or a side mission with friends,', W / 2, H / 2 + 60);
    c.fillText('and their names are carved here.', W / 2, H / 2 + 96);
    c.globalAlpha = 1;
  } else {
    const cols = list.length > 6 ? 2 : 1, rows = Math.ceil(list.length / cols), top = 180, rowH = Math.min(62, (H - top - 50) / rows);
    list.forEach((f, i) => {
      const col = Math.floor(i / rows), row = i % rows, cx = cols === 1 ? W / 2 : W * (0.28 + col * 0.44), cy = top + row * rowH + rowH / 2;
      c.font = '700 ' + Math.round(rowH * 0.62) + 'px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
      c.fillText(f.name, cx, cy);
      c.globalAlpha = 0.6; c.font = '500 ' + Math.round(rowH * 0.36) + 'px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
      c.fillText('× ' + f.n, cx + (cols === 1 ? 220 : 170), cy + 2); c.globalAlpha = 1;
    });
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = ry; live(m);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.6, 0.3), std(o.stoneD ?? 0x8a8270, 0.9));
  back.position.set(x - Math.sin(ry) * 0.17, y, z - Math.cos(ry) * 0.17); back.rotation.y = ry; back.userData.passThrough = true;
  shared.arenaGroup.add(back, m);
}
