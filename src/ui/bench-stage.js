// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WORKBENCH'S SET (ui/workbench.js is its panel): a lamp-lit workshop table at night, a cutting mat ruled in a
// schematic grid, tool racks and parts trays, and the Jedi's saber laid out on it in pieces: pommel, grip, the kyber
// crystal floating in its focusing ring, the emitter. The pieces drift apart and slowly turn so every side of the hilt
// shows; TEST IGNITION slides them home and lights the blade down the table. It is its own scene, drawn through the
// game's own post (bloom and all) while the workbench is open (ui/showcase.js renderShowcase hands it the frame).

import * as THREE from 'three';
import { composer, renderPass, scene, camera, bloomPass, standPost, hemi } from '../engine/renderer.js';
import { inkRim } from '../player/model/styles.js';
import { buildSaberModel } from '../player/model/index.js';
import { wornLook } from '../player/mesh.js';
import { STANCES } from '../data/stances.js';
import { G } from '../state.js';

const set = new THREE.Scene();
set.background = new THREE.Color(0x050608);
set.fog = new THREE.Fog(0x050608, 9, 20);
const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 60);
const SCALE = 3.3;               // the saber on the table, ×3.3 its carried size so the hilt fills the shot
const SABER_AT = new THREE.Vector3(0.3, 0.28, 0.15);   // the grip's centre over the mat

/* ---------- the room ---------- */
const std = (c, r = 0.7, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const box = (w, h, d, mat, x, y, z, parent = set) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
set.add(new THREE.HemisphereLight(0x8ea4c8, 0x140c06, 0.6));
const lamp2 = new THREE.PointLight(0xffb070, 6, 9, 1.5); lamp2.position.set(-3.2, 2.6, -1.4); set.add(lamp2);   // a second, dimmer lamp over the tool rack
// the lamp over the bench: a warm cone of light on the mat
const lamp = new THREE.SpotLight(0xffd7a0, 14, 16, 0.75, 0.7, 1.2); lamp.position.set(0.4, 5.2, 1.2); lamp.target.position.set(0.3, 0, 0); set.add(lamp, lamp.target);
const fill = new THREE.DirectionalLight(0x6f8fc0, 0.6); fill.position.set(-4, 3, 5); set.add(fill);
const rim = new THREE.DirectionalLight(0xffb060, 0.9); rim.position.set(3, 2, -4); set.add(rim);
const kyberLight = new THREE.PointLight(0x35c8ff, 1, 2.2); set.add(kyberLight);   // the crystal's own glow on the mat
// the table: a heavy dark-metal top with a brass lip, on thick legs
const metal = std(0x22262c, 0.45, 0.7), brass = std(0x6e5232, 0.45, 0.8), dark = std(0x121418, 0.8, 0.3);
box(8.4, 0.34, 4.2, metal, 0, -0.17, 0);
box(8.5, 0.06, 0.08, brass, 0, -0.03, 2.1); box(8.5, 0.06, 0.08, brass, 0, -0.03, -2.1);
for (const x of [-3.8, 3.8]) for (const z of [-1.8, 1.8]) box(0.36, 3, 0.36, dark, x, -1.84, z);
// the cutting mat: a schematic grid, rulers along its edges and the outline of a hilt in the corner
function matTexture(){
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#0d2a2c'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i <= 64; i++){ x.strokeStyle = i % 8 ? 'rgba(120,220,210,.12)' : 'rgba(140,240,230,.32)'; x.lineWidth = i % 8 ? 1 : 2; x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 512); x.stroke(); }
  for (let j = 0; j <= 32; j++){ x.strokeStyle = j % 8 ? 'rgba(120,220,210,.12)' : 'rgba(140,240,230,.32)'; x.lineWidth = j % 8 ? 1 : 2; x.beginPath(); x.moveTo(0, j * 16); x.lineTo(1024, j * 16); x.stroke(); }
  x.strokeStyle = 'rgba(255,200,120,.5)'; x.lineWidth = 2;
  for (let i = 0; i < 128; i++){ const h = i % 8 ? 6 : 14; x.beginPath(); x.moveTo(i * 8, 0); x.lineTo(i * 8, h); x.stroke(); x.beginPath(); x.moveTo(i * 8, 512); x.lineTo(i * 8, 512 - h); x.stroke(); }
  x.strokeStyle = 'rgba(140,240,230,.4)'; x.lineWidth = 2; x.setLineDash([8, 6]);
  x.beginPath(); x.arc(860, 120, 70, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(860, 120, 40, 0, Math.PI * 2); x.stroke();
  x.setLineDash([]); x.strokeRect(80, 380, 300, 40); x.strokeRect(380, 386, 40, 28);
  x.fillStyle = 'rgba(140,240,230,.5)'; x.font = '600 18px monospace';
  x.fillText('KYBER FOCUS  Ø 12', 790, 220); x.fillText('HILT  280 · EMITTER  BELOW', 80, 450);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const mat = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.1), new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.92, metalness: 0 }));
mat.rotation.x = -Math.PI / 2; mat.position.set(0.2, 0.002, 0.15); set.add(mat);
// the wall behind: dark panels, a tool rack with its tools, a shelf of parts bins
box(12, 6, 0.2, std(0x0d0f13, 0.9, 0.1), 0, 2, -2.6);
for (let i = 0; i < 4; i++) box(2.6, 2.6, 0.06, std(0x15181e, 0.8, 0.3), -4.2 + i * 2.8, 1.9, -2.47);
box(4.2, 0.08, 0.3, brass, -1.6, 1.9, -2.35);
for (let i = 0; i < 9; i++){
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9 - (i % 3) * 0.18, 8), i % 2 ? std(0x8a929c, 0.3, 0.9) : std(0x2c3036, 0.5, 0.7));
  t.position.set(-3.4 + i * 0.42, 1.45 - (i % 3) * 0.09, -2.32); set.add(t);
  box(0.09, 0.12, 0.09, i % 3 ? dark : std(0xb84327, 0.5, 0.3), t.position.x, t.position.y - t.geometry.parameters.height / 2, -2.32);
}
box(3, 0.06, 0.6, metal, 2.4, 1.2, -2.25);
for (let i = 0; i < 4; i++) box(0.62, 0.34, 0.5, std([0x3a2e22, 0x23303a, 0x2e2a24, 0x2a2f26][i], 0.8, 0.2), 1.25 + i * 0.75, 1.4, -2.2);
// on the bench: a parts tray, a vice, a coil of wire, a spare crystal in a case, a holo-lamp disc
const tray = new THREE.Group(); tray.position.set(-2.6, 0, 1.1); tray.rotation.y = 0.25; set.add(tray);
box(1.3, 0.08, 0.8, std(0x2a2f36, 0.5, 0.6), 0, 0.04, 0, tray);
for (const [x, z] of [[-0.62, 0], [0.62, 0]]) box(0.04, 0.16, 0.8, std(0x2a2f36, 0.5, 0.6), x, 0.1, z, tray);
for (const [x, z] of [[0, -0.38], [0, 0.38]]) box(1.3, 0.16, 0.04, std(0x2a2f36, 0.5, 0.6), x, 0.1, z, tray);
for (let i = 0; i < 7; i++) box(0.08 + (i % 3) * 0.04, 0.05, 0.08, i % 2 ? brass : std(0x8a929c, 0.3, 0.9), -0.45 + i * 0.15, 0.1, (i % 2 ? 0.15 : -0.15), tray);
const vice = new THREE.Group(); vice.position.set(2.9, 0, -0.9); vice.rotation.y = -0.4; set.add(vice);
box(0.5, 0.3, 0.6, std(0x3c4652, 0.4, 0.7), 0, 0.15, 0, vice); box(0.5, 0.36, 0.12, std(0x3c4652, 0.4, 0.7), 0, 0.42, 0.25, vice); box(0.5, 0.36, 0.12, std(0x3c4652, 0.4, 0.7), 0, 0.42, -0.25, vice);
const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), std(0x8a929c, 0.3, 0.9)); screw.rotation.x = Math.PI / 2; screw.position.set(0, 0.36, 0.6); vice.add(screw);
const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 24), std(0xb06a2a, 0.4, 0.8)); coil.rotation.x = -Math.PI / 2; coil.position.set(-2.9, 0.04, -1.1); set.add(coil);
const holo = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.08, 24), std(0x1a1d22, 0.4, 0.7)); holo.position.set(-1.6, 0.04, -1.5); set.add(holo);
const holoGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 24), new THREE.MeshBasicMaterial({ color: 0x5ce1ff })); holoGlow.position.set(-1.6, 0.085, -1.5); set.add(holoGlow);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.7, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ce1ff, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
beam.position.set(-1.6, 0.44, -1.5); set.add(beam);
const spare = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshBasicMaterial({ color: 0x5ce1ff })); spare.scale.y = 1.8; spare.position.set(-1.6, 0.5, -1.5); set.add(spare);

/* ---------- the saber, in pieces ---------- */
const bench = { open: false, saber: null, crystal: null, ring: null, apart: 1, lit: 0, ignite: false, spin: 0, drag: 0, t: 0 };
const kyberMat = new THREE.MeshBasicMaterial({ color: 0x35c8ff });
const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), kyberMat); crystal.scale.y = 1.9;
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 20), std(0x9aa4b0, 0.3, 0.9)); ring.rotation.x = Math.PI / 2;
// the cradle under the grip: two brass V-blocks
for (const dx of [-0.42, 0.2]){   // (under the grip, either side of the hand)
  const v = new THREE.Group(); v.position.set(SABER_AT.x + dx, 0, SABER_AT.z); set.add(v);
  box(0.24, 0.07, 0.34, brass, 0, 0.035, 0, v);
  for (const s of [-1, 1]){ const w = box(0.2, 0.05, 0.16, brass, 0, 0.12, s * 0.09, v); w.rotation.x = s * 0.6; }
}
function colorOf(look){ return look.jedi.saber != null ? look.jedi.saber : ((STANCES[G.stance] || {}).blade ?? 0x35c8ff); }
// (re)build the saber from these picks, laid along the table with the emitter towards the right
// (the old saber's materials go one rebuild later, not at once: disposed right away, their shader programs were left
// with no users and deleted, and the new saber, the same materials rebuilt, compiled them all again: a hitch per pick)
let oldMats = [];
export function setBenchSaber(picks){
  if (bench.saber){
    crystal.removeFromParent(); ring.removeFromParent(); bench.saber.group.removeFromParent();
    for (const m of oldMats) m.dispose();
    oldMats = [];
    bench.saber.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) oldMats.push(...[].concat(o.material)); });
  }
  const look = wornLook(picks), w = buildSaberModel(look), col = colorOf(look);
  w.light.parent.remove(w.light);
  w.group.scale.setScalar(SCALE);
  w.group.rotation.z = -Math.PI / 2;   // the blade's axis (+y) along +x
  w.group.position.copy(SABER_AT);
  w.bladeRoot.add(crystal, ring);
  w.glow.material.color.setHex(col); kyberMat.color.setHex(col); kyberLight.color.setHex(col);
  w.staff.hilt.visible = false;
  bench.saber = w;
  set.add(w.group);
  pose(0);
}
export const igniteBench = (on) => { bench.ignite = on == null ? !bench.ignite : !!on; return bench.ignite; };
export const spinBench = (rad) => { bench.drag += rad; };
export function openBench(on){ bench.open = !!on; if (!on){ bench.ignite = false; bench.lit = 0; bench.apart = 1; } }
export const benchOpen = () => bench.open;

// lay the pieces out: apart 1 is the exploded view, 0 assembled; lit 0…1 runs the blade out
const ease = (k) => k * k * (3 - 2 * k);
function pose(dt){
  const w = bench.saber; if (!w) return;
  const P = w.bladeRoot.userData.pieces, a = ease(bench.apart), l = ease(bench.lit);
  if (P){ P.emitter.position.y = 0.14 * a; P.pommel.position.y = -0.09 * a; P.body.position.y = 0; }
  crystal.position.y = 0.125; crystal.visible = a > 0.08;
  crystal.rotation.y = bench.t * 1.4;
  crystal.position.x = 0; crystal.scale.setScalar(0.8 + a * 0.6); crystal.scale.y *= 1.9;
  ring.position.y = crystal.position.y; ring.visible = a > 0.3; ring.scale.setScalar(Math.max(0.01, a));
  w.blade.visible = w.glow.visible = l > 0.01;
  const s = Math.max(0.02, l);
  w.blade.scale.y = s; w.blade.position.y = 0.17 + 0.78 * s;
  w.glow.scale.y = s; w.glow.position.y = 0.15 + 0.8 * s;
  // the saber turns slowly on its long axis (and with a drag), rising a touch off the cradle while it is apart
  w.bladeRoot.rotation.set(0, bench.t * 0.35 + bench.drag, 0);
  w.group.position.y = SABER_AT.y + a * 0.12 + Math.sin(bench.t * 1.1) * 0.01 * a;
  crystal.getWorldPosition(kyberLight.position);
  kyberLight.intensity = 0.35 + a * 0.5 + l * 2.5;
}

/* ---------- drawing it ---------- */
const look = new THREE.Vector3(0.4, 0.1, -0.25);
export function renderBench(dt, bloomAt){
  bench.t += dt;
  bench.apart += ((bench.ignite ? 0 : 1) - bench.apart) * Math.min(1, dt * 5);
  const wantLit = bench.ignite && bench.apart < 0.06 ? 1 : 0;
  bench.lit += Math.sign(wantLit - bench.lit) * Math.min(Math.abs(wantLit - bench.lit), dt * (wantLit ? 3.2 : 5));
  pose(dt);
  holoGlow.material.color.setHex(kyberMat.color.getHex()); beam.material.color.copy(holoGlow.material.color); spare.material.color.copy(holoGlow.material.color);
  // the camera: above the bench's near edge, a slow drift; on a narrow screen it pulls back to keep the whole hilt
  const narrow = innerWidth / innerHeight < 1.3, t = bench.t;
  cam.aspect = innerWidth / innerHeight;
  // (the panel sits on the left: the bench is framed in the room right of it, and pulled back when that room is tight)
  const pn = !narrow && document.querySelector('#workbench .wb-panel'), edge = pn ? pn.getBoundingClientRect().right / innerWidth : 0.265;
  const sideOff = narrow ? 0 : -edge * 0.62, back = narrow ? 1 : Math.max(1, 0.6 / (1 - edge));
  cam.setViewOffset(innerWidth, innerHeight, sideOff * innerWidth, narrow ? 0.26 * innerHeight : 0, innerWidth, innerHeight);
  cam.position.set(0.45 + Math.sin(t * 0.17) * 0.3, narrow ? 6.4 : 3.5 * back, narrow ? 6.4 : 5 * back);
  cam.lookAt(look);
  cam.updateProjectionMatrix();
  renderPass.scene = set; renderPass.camera = cam;
  const th = bloomPass.threshold, st = bloomPass.strength; bloomPass.threshold = bloomAt; bloomPass.strength = 0.9;
  standPost(true);
  const rimWas = inkRim.value, sky = hemi.color.getHex();
  inkRim.value = 0.6; hemi.color.setHex(0x8a909c);
  composer.render();
  inkRim.value = rimWas; hemi.color.setHex(sky);
  standPost(false);
  bloomPass.threshold = th; bloomPass.strength = st;
  renderPass.scene = scene; renderPass.camera = camera;
}
