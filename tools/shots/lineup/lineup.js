// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BODY LINEUP (testing only): the heroes, every foe type, the bosses, a squadmate and the civilians, built by the game's
// own model code and lit by its own renderer, standing in rows on a plain floor. ?row=heroes|foes|bosses|allies|civ
// &side=1 turns them side on. tools/shots/bodies.mjs shoots each row.
import * as THREE from 'three';
// the game's modules look up its page (HUD, menus) as they load: lay the game's own markup in first, out of sight
{ const html = await (await fetch('/index.html')).text(), doc = new DOMParser().parseFromString(html, 'text/html');
  for (const n of [...doc.body.children]) if (n.tagName !== 'SCRIPT'){ n.style && (n.style.visibility = 'hidden'); document.body.appendChild(document.importNode(n, true)); }
  for (const l of doc.querySelectorAll('link[rel=stylesheet], style')) document.head.appendChild(document.importNode(l, true)); }
// the whole game loads (its modules expect their load order: src/main.js), but its loop never runs: the page draws its
// own scene through the game's renderer and post passes, lit by the game's own lights
window.requestAnimationFrame = () => 0;
await import('../../../src/main.js');
const RND = await import('../../../src/engine/renderer.js');
const { renderer, camera, composer, renderPass, aoPass, hemi, sun, rim } = RND;
const scene = new THREE.Scene();
for (const l of [hemi, sun, rim]) if (l){ scene.add(l); if (l.target) scene.add(l.target); }
renderPass.scene = scene; if (aoPass) aoPass.scene = scene;
const { buildHeroModel } = await import('../../../src/player/model/index.js');
const { buildEnemyMesh } = await import('../../../src/enemies/mesh.js');
const { buildBoss } = await import('../../../src/boss/mesh.js');
const { buildCivilian, CIV_LOOKS } = await import('../../../src/enemies/civilian.js');
const { ENEMY_TYPES } = await import('../../../src/data/enemies.js');
const q = new URLSearchParams(location.search);
const row = q.get('row') || 'heroes', side = q.get('side') === '1';
scene.background = new THREE.Color(0x2a2f38);
scene.fog = null;
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const items = [];
const put = (g, label) => { scene.add(g); items.push({ g, label }); };
const hero = which => {
  const target = { cloth: [] }, vis = buildHeroModel(target, {});
  const g = new THREE.Group(); g.add(vis);
  const show = (list, on) => { for (const m of list || []) m.visible = on; };
  show(target.mandoParts, which === 'mando'); show(target.trooperParts, which === 'trooper'); show(target.headBare, which === 'jedi');
  if (target.rig.skirt) target.rig.skirt.visible = which === 'jedi';
  for (const k of ['saberHand', 'darksaberMesh']) if (target[k]) target[k].visible = false;
  if (target.pistols) { target.pistols.L.visible = target.pistols.R.visible = false; }
  vis.traverse(o => { if (o.userData && o.userData.weapon) o.visible = false; });
  return g;
};

if (row === 'heroes') for (const h of ['jedi', 'mando', 'trooper']) put(hero(h), h);
if (row === 'foes') for (const [k, t] of Object.entries(ENEMY_TYPES)) { try { put(buildEnemyMesh(t, { seed: 3, wear: 0.1 }), k); } catch (e) { console.log('foe ' + k + ': ' + e.message); } }
if (row === 'bosses') for (const k of ['sith', 'mando']) { try { const b = buildBoss(k); put(b.group || b, k); } catch (e) { console.log('boss ' + k + ': ' + e.message); } }
if (row === 'allies'){
  put(buildEnemyMesh({ model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2a5aa8, scale: 1, ranged: true }, { variant: 0, wear: 0.05, seed: 7 }), 'clone');
  put(buildEnemyMesh({ model: 'clone', color: 0xe4e7ea, eye: 0x5ab8ff, cloth: 0x2a5aa8, scale: 1, ranged: true }, { variant: 4, wear: 0.05, seed: 7 }), 'clone (bare)');
  try { put(buildEnemyMesh({ model: 'mandalorian', color: 0x6a7a8a, eye: 0x9fe0ff, scale: 1, ranged: true }, { seed: 7, wear: 0.1 }), 'mandalorian'); } catch (e) { console.log('mandalorian: ' + e.message); }
}
if (row === 'civ') for (const kind of Object.keys(CIV_LOOKS)) { try { put(buildCivilian(kind, 1), kind); } catch (e) { console.log('civ ' + kind + ': ' + e.message); } }

const gap = row === 'bosses' ? 3.2 : row === 'heroes' ? 1.3 : 1.5;
items.forEach(({ g }, i) => { g.position.set((i - (items.length - 1) / 2) * gap, 0, 0); g.rotation.y = side ? Math.PI / 2 : 0; });
scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
const half = (items.length - 1) / 2 * gap + 0.7;
const aspect = innerWidth / innerHeight;
camera.fov = 30; camera.aspect = aspect; camera.updateProjectionMatrix();
const H = row === 'bosses' ? 4.4 : 3.0, t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
const dist = Math.max(half / (t * aspect), (H / 2) / t) * 1.05;
camera.position.set(0, H * 0.5, dist); camera.lookAt(0, H * 0.47, 0);
// labels under each body
const labels = document.createElement('div'); labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:600 13px system-ui;color:#cfd6e2;letter-spacing:.08em';
document.body.appendChild(labels);
renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
composer.render();
for (const { g, label } of items){
  const p = g.position.clone(); p.y = -0.15; p.project(camera);
  const d = document.createElement('div'); d.textContent = label.toUpperCase();
  d.style.cssText = `position:absolute;left:${(p.x * 0.5 + 0.5) * innerWidth}px;top:${(-p.y * 0.5 + 0.5) * innerHeight}px;transform:translateX(-50%)`;
  labels.appendChild(d);
}
window.__ready = true;
