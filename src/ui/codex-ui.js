// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CODEX PAGE: everyone the hero has met, foe or friend (data/codex.js), with a turning model of each, its looks, and a
// few short lines on how it fights. Opens from CODEX on the main menu and the pause screen; entries not met yet stand
// as dark silhouettes. A small note in the corner says when a new entry opens mid-fight (game/codex.js codexHooks).

import { pushPopup } from './popups.js';
import * as THREE from 'three';
import { CODEX, CODEX_TABS, CODEX_BY_ID, ELITE_NOTES } from '../data/codex.js';
import { codexMet, codexFresh, codexRead, codexCount, codexNewCount, codexHooks } from '../game/codex.js';
import { ENEMY_TYPES, ELITES } from '../data/enemies.js';
import { lookPool } from '../data/foe-looks.js';
import { TURNED, PURGE, DRILL } from '../data/allies.js';
import { ACOLYTES, castId, lookById, masterBlade } from '../data/saber-cast.js';
import { STANCES } from '../data/stances.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { dressElite } from '../enemies/elites.js';
import { updateUpper } from '../enemies/upper.js';
import { buildBoss } from '../boss/mesh.js';
import { castPreview } from '../game/cast.js';
import { svgIcon } from './icons.js';
import { G } from '../state.js';
import { holocronCube } from '../world/secret-props.js';
import { syncHolocronPages } from '../game/secrets.js';

const panel = document.getElementById('codex');
const btn = document.getElementById('cxtoggle');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let tab = 'troops', sel = null, look = 0, built = false;

/* ---------- the looks: every way the entry's model can turn up ---------- */
const UNIFORMS = [['TURNED CLONE', TURNED], ['PURGE CLONE', PURGE], ['TRAINING DROID', DRILL]];
const DROID_KIT = { b1: ['', 'COMMANDER', 'SALVAGED ARM', 'SECURITY', 'UNIT PAINT'], magna: ['', 'TORN CLOAK', 'PAINTED SKULL', 'SASH OF RANK', 'TORN AND BARE'] };
function lookName(model, L){
  if (L.dv) return DROID_KIT[model] ? DROID_KIT[model][L.dv] : 'STANDARD';
  if (model === 'officer') return L.cap ? 'CAPPED' : 'BARE-HEADED';
  if (L.bare) return 'HELMET OFF';
  return ['STANDARD', 'SERGEANT', 'VETERAN', 'COMMS RIG'][L.v || 0] || 'STANDARD';
}
const _looks = {};
function looksOf(E){
  if (_looks[E.id]) return _looks[E.id];
  const out = [];
  if (E.kind === 'type'){
    const t = ENEMY_TYPES[E.id], pool = lookPool(t.model);
    if (pool) pool.forEach((L, i) => out.push({ name: lookName(t.model, L), o: { lookIndex: i } }));
    else if (t.model === 'acolyte') ACOLYTES.forEach((_, i) => out.push({ name: 'ACOLYTE', o: { face: i } }));
    else out.push({ name: 'STANDARD', o: { seed: 1 } });
    for (const [name, U] of UNIFORMS) if (U[E.id]) out.push({ name, dress: U[E.id], o: { seed: 3 } });
    for (const id in ELITES) out.push({ name: 'ELITE · ' + ELITES[id].label, note: ELITE_NOTES[id], elite: id, o: { ...out[0].o } });
  } else out.push({ name: '', o: {} });
  return (_looks[E.id] = out);
}

/* ---------- building a model (cached: each look is built once, then kept for the next visit) ---------- */
const _models = new Map();
function buildModel(E, k){
  const key = E.id + '#' + k;
  if (_models.has(key)) return _models.get(key);
  const L = looksOf(E)[k] || looksOf(E)[0];
  let g = null;
  if (E.kind === 'type'){
    g = buildEnemyMesh(L.dress ? { ...ENEMY_TYPES[E.id], ...L.dress } : ENEMY_TYPES[E.id], { ...L.o, wear: 0 });
    if (L.elite){ g.scale.multiplyScalar(ELITES[L.elite].scale); dressElite(g, L.elite); }
  } else if (E.kind === 'named'){
    const t = ENEMY_TYPES[E.foe], id = castId(E.name, E.mids && E.mids[0]), cast = lookById(id);
    g = buildEnemyMesh({ ...t, ...(E.uniform || {}), ...(E.dress || {}) }, { look: id || undefined, seed: 7, wear: 0 });
    if (E.scale) g.scale.multiplyScalar(E.scale);
    if (!cast && !E.dress && E.tint != null) g.userData.bodyMat.color.lerp(new THREE.Color(E.tint), 0.5);
    if (E.form && g.userData.bladeGlow) g.userData.bladeGlow.material.color.setHex(masterBlade(g.userData.look, STANCES[E.form].blade));
  } else if (E.kind === 'warbringer'){
    g = buildEnemyMesh(ENEMY_TYPES.brute, { seed: 4, wear: 0.1 });
    g.scale.multiplyScalar(1.55);
    g.userData.bodyMat.color.lerp(new THREE.Color(0xff2a2a), 0.4);   // as game/survival.js spawnChampion dresses it
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2020, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 }));
    crest.position.set(0, 2.55, 0); g.add(crest);
  } else if (E.kind === 'boss') g = castPreview(E.boss === 'sith' ? 'DARTH VEXIS' : E.boss === 'trooper' ? 'THE MARSHAL AT THE SPIRE' : 'THE IRON MAGISTRATE') || buildBoss(E.boss);   // (each is a foe's body in his own armour: data/cast.js)
  else if (E.kind === 'squad'){
    const d = E.def;
    g = buildEnemyMesh({ model: d.model, color: d.color, eye: d.eye, cloth: d.cloth, scale: d.scale || 1, ranged: d.role !== 'jedi', weapon: d.weapon, look: d.look }, { seed: 5, wear: 0.15 });
    if (d.look && g.userData.bladeGlow) g.userData.bladeGlow.material.color.setHex(0x3aff8c);
  } else if (E.kind === 'cast') g = castPreview(E.name);
  else if (E.kind === 'holocron'){ g = holocronCube(0x7fd8ff, 0.7); g.position.y = 1.1; }   // (the one the story maps hide: world/secret-props.js)
  if (!g) g = new THREE.Group();
  const holder = new THREE.Group();
  holder.add(g);
  const m = { holder, g, F: {}, ...measure(holder) };
  _models.set(key, m);
  return m;
}

/* how much room the model takes, measured from its meshes as it stands (skinned parts in their posed shape, not their
   bind pose): its top and foot, and how far it reaches out from the turntable's axis at any turn, so the camera can frame
   every entry head to toe however tall, wide or long it is */
const _box = new THREE.Box3(), _ob = new THREE.Box3(), _v = new THREE.Vector3();
const chainVisible = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function measure(holder){
  holder.updateMatrixWorld(true);
  _box.makeEmpty();
  let r = 0;
  holder.traverse(o => {
    if (!o.isMesh || !chainVisible(o) || !o.geometry || !o.geometry.attributes.position) return;
    let b;
    if (o.isSkinnedMesh){ o.skeleton.update(); o.computeBoundingBox(); b = o.boundingBox; }
    else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b = o.geometry.boundingBox; }
    if (!b || b.isEmpty()) return;
    _ob.copy(b).applyMatrix4(o.matrixWorld);
    _box.union(_ob);
    for (let i = 0; i < 4; i++){ _v.set(i & 1 ? _ob.max.x : _ob.min.x, 0, i & 2 ? _ob.max.z : _ob.min.z); r = Math.max(r, Math.hypot(_v.x, _v.z)); }
  });
  if (_box.isEmpty()) return { top: 2, foot: 0, r: 0.5 };
  return { top: _box.max.y, foot: Math.min(0, _box.min.y), r };
}

/* ---------- the stage: its own small renderer, drawing only while the page is open ---------- */
let R = null, stage, cam, cur = null, spin = 0.5, drag = null, last = 0, dark = false;
const SIL = new THREE.MeshBasicMaterial({ color: 0x142235 });
function initStage(canvas){
  R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  R.setPixelRatio(Math.min(devicePixelRatio, 2));
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.95;
  stage = new THREE.Scene();
  stage.add(new THREE.HemisphereLight(0xb8d4ff, 0x2a2018, 0.8));
  const key = new THREE.DirectionalLight(0xfff2e0, 1.8); key.position.set(3, 6, 5); stage.add(key);
  const rim = new THREE.DirectionalLight(0x5aa8ff, 1.6); rim.position.set(-4, 3, -5); stage.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5cc6ff, transparent: true, opacity: 0.12, depthWrite: false }));
  stage.add(floor);
  cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, s: spin }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag) spin = drag.s + (e.clientX - drag.x) * 0.012; });
  const up = () => { drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
}
function show(E, k, locked){
  if (cur) stage.remove(cur.holder);
  cur = buildModel(E, k);
  stage.add(cur.holder);
  dark = locked;
  fit();
}
/* frame it head to toe: the band from the floor to its top, plus headroom (a share of its height, and room below for the
   look picker), fits the view's height, and its reach out from the turntable's axis fits the view's width at any turn.
   A long weapon held out (a lance, a pike) may sweep past the edge as it turns rather than shrink the figure to a speck */
const TAN = Math.tan(THREE.MathUtils.degToRad(28 / 2));
function fit(){
  if (!cur) return;
  const { top, foot, r } = cur, tall = top - foot;
  const lo = foot - 0.2 - tall * 0.08, hi = top + 0.15 + tall * 0.08;   // the foot sits clear of the look picker
  const mid = (lo + hi) / 2, half = Math.max((hi - lo) / 2, 1.3);
  const reach = Math.min(r, tall * 0.36 + 0.25);
  const d = Math.max(half / TAN, (reach * 1.06 + 0.1) / (TAN * cam.aspect)) + reach * 0.5;   // the near side stands closer than the axis
  cam.position.set(0, mid + d * 0.04, d); cam.lookAt(0, mid, 0);
}
function frame(now){
  if (!panel.classList.contains('open')) return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
  const c = R.domElement, w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * R.getPixelRatio()) || c.height !== Math.round(h * R.getPixelRatio())){ R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); fit(); }
  if (!drag) spin += dt * 0.45;
  if (cur){
    cur.holder.rotation.y = spin;
    if (!dark && cur.g.userData.chest) updateUpper(cur.F, cur.g, dt, null);   // it breathes, and a staff stays in both hands
  }
  stage.overrideMaterial = dark ? SIL : null;
  R.render(stage, cam);
}

/* ---------- the page ---------- */
const pips = (n) => '<span class="cx-pips" aria-label="Threat ' + n + ' of 5">' + [1, 2, 3, 4, 5].map(i => '<i' + (i <= n ? ' class="on"' : '') + '></i>').join('') + '</span>';
const list = (title, rows) => rows && rows.length ? '<div class="cx-sec"><h4>' + title + '</h4><ul>' + rows.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul></div>' : '';
function build(){
  built = true;
  panel.innerHTML = `<div class="howto-panel cx-panel">
    <div class="howto-head"><div class="howto-title">CODEX</div><div class="rm-sub" id="cxcount"></div><div class="howto-x" id="cxclose">✕</div></div>
    <div class="cz-tabs cx-tabs" id="cxtabs">${CODEX_TABS.map(t => `<span data-tab="${t.id}">${t.name}<b class="cx-dot"></b></span>`).join('')}</div>
    <div class="cx-body">
      <div class="cx-list" id="cxlist"></div>
      <div class="cx-view">
        <div class="cx-stage"><canvas id="cxcanvas"></canvas>
          <div class="cx-look" id="cxlook"><span class="cx-arrow" data-step="-1" aria-label="Previous look">‹</span><span class="cx-lk" id="cxlk"></span><span class="cx-arrow" data-step="1" aria-label="Next look">›</span></div>
        </div>
        <div class="cx-info" id="cxinfo"></div>
      </div>
    </div>
  </div>`;
  initStage(document.getElementById('cxcanvas'));
  document.getElementById('cxclose').addEventListener('click', (e) => { e.stopPropagation(); setCodex(false); });
}
function renderList(){
  const rows = CODEX.filter(e => e.tab === tab);
  document.getElementById('cxlist').innerHTML = rows.map(e => {
    const m = codexMet(e.id);
    return `<div class="cx-item${m ? '' : ' locked'}${e.id === sel ? ' on' : ''}" data-id="${e.id}">${m ? esc(e.name) : svgIcon('lock', 'lk') + '? ? ?'}${m && codexFresh(e.id) ? '<b class="cx-new">NEW</b>' : ''}</div>`;
  }).join('');
  for (const s of document.querySelectorAll('#cxtabs span')){
    s.classList.toggle('on', s.dataset.tab === tab);
    s.querySelector('.cx-dot').classList.toggle('on', CODEX.some(e => e.tab === s.dataset.tab && codexFresh(e.id)));
  }
  const n = CODEX.filter(e => e.tab === tab && codexMet(e.id)).length;
  document.getElementById('cxcount').textContent = n + ' / ' + rows.length + (tab === 'holocrons' ? ' found · ' : ' met · ') + codexCount() + ' / ' + CODEX.length + ' in all';
}
function renderEntry(){
  const E = CODEX_BY_ID[sel], met = codexMet(sel), L = looksOf(E), info = document.getElementById('cxinfo');
  look = Math.min(look, L.length - 1);
  show(E, met ? look : 0, !met);
  const lk = document.getElementById('cxlook');
  lk.style.visibility = met && L.length > 1 ? 'visible' : 'hidden';
  document.getElementById('cxlk').innerHTML = esc(L[look].name || '') + ' <i>' + (look + 1) + ' / ' + L.length + '</i>' + (L[look].note ? '<em>' + esc(L[look].note) + '</em>' : '');
  if (!met){
    info.innerHTML = E.holocron ? `<div class="cx-name dim">? ? ?</div><div class="cx-lore">Not found yet. Holocrons hide in the quiet corners of the story maps: walk off the path and listen for the hum.</div>`
      : `<div class="cx-name dim">? ? ?</div><div class="cx-lore">${E.ally ? 'Not met yet.' : 'Not encountered yet.'} Keep playing to fill this page.</div>`;
    return;
  }
  info.innerHTML = `<div class="cx-kick">${esc(E.kicker || '')}</div><div class="cx-name">${esc(E.name)}</div>
    ${E.threat ? '<div class="cx-threat">THREAT ' + pips(E.threat) + '</div>' : ''}
    <div class="cx-lore">${esc(E.lore)}</div>
    ${E.weapons ? '<div class="cx-sec"><h4>' + (E.ally ? 'CARRIES' : 'WEAPONS') + '</h4><div class="cx-chips">' + E.weapons.map(w => '<span>' + esc(w) + '</span>').join('') + '</div></div>' : ''}
    <div class="cx-cols">${list('WATCH FOR', E.watch)}${list('HOW TO BEAT IT', E.beat)}${list('IN THE FIELD', E.field)}${list('WORKING WITH THEM', E.tips)}${list('THE RECORDING', E.lines)}</div>`;
  if (codexFresh(sel)){ codexRead(sel); renderList(); refreshButton(); }
}
function pick(id){
  sel = id; look = 0;
  renderList(); renderEntry();
}
function setTab(id){
  tab = id;
  const rows = CODEX.filter(e => e.tab === tab);
  pick((rows.find(e => codexFresh(e.id)) || rows.find(e => codexMet(e.id)) || rows[0]).id);
}

export function setCodex(open){
  if (open) syncHolocronPages();   // (the holocrons your heroes found, in this save slot's codex too)
  if (open && !built) build();
  panel.classList.toggle('open', open);
  if (!open) return;
  // open on a new entry if there is one, else where it was left
  const fresh = CODEX.find(e => codexFresh(e.id));
  if (fresh){ tab = fresh.tab; pick(fresh.id); } else if (sel) pick(sel); else setTab(tab);
  last = performance.now();
  requestAnimationFrame(frame);
}
export const codexOpen = () => panel.classList.contains('open');

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // reading the codex must never launch or resume the game
  const t = e.target.closest('[data-tab]'), it = e.target.closest('.cx-item'), ar = e.target.closest('.cx-arrow');
  if (t) setTab(t.dataset.tab);
  else if (it) pick(it.dataset.id);
  else if (ar){ const n = looksOf(CODEX_BY_ID[sel]).length; look = (look + +ar.dataset.step + n) % n; renderEntry(); }
  else if (e.target === panel) setCodex(false);   // the backdrop closes it
});
document.addEventListener('keydown', (e) => {
  if (!codexOpen()) return;
  if (e.key === 'Escape') setCodex(false);
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && sel && codexMet(sel)){   // (a pad's D-pad moves the focus ring instead: engine/gamepad.js)
    const n = looksOf(CODEX_BY_ID[sel]).length; look = (look + (e.key === 'ArrowRight' ? 1 : -1) + n) % n; renderEntry();
  }
});
btn.addEventListener('click', (e) => { e.stopPropagation(); setCodex(true); });

/* ---------- the CODEX button's count, and the note in the corner when an entry opens ---------- */
function refreshButton(){
  const n = codexNewCount();
  btn.querySelector('.cx-badge').textContent = n ? n : '';
}
const note = document.createElement('div');
note.id = 'cxnote';
document.body.appendChild(note);
let noteT = 0;
// the note goes through the pop-up queue (ui/popups.js): one at a time, in a lull, and a wave of firsts is one note
codexHooks.met = (id) => {
  refreshButton();
  if (G.mode !== 'play') return;
  pushPopup({ kind: 'reward', key: 'codex', dur: 3.2, names: [CODEX_BY_ID[id].name],
    merge: (a, b) => ({ names: [...a.names, ...b.names] }),
    show(){
      const n = this.names;
      note.innerHTML = '<b>CODEX</b> ' + (n.length === 1 ? esc(n[0]) + ' added' : n.length + ' new entries');
      note.classList.add('on'); clearTimeout(noteT);
      return () => note.classList.remove('on');
    } });
};
// the count follows the save: a slot loaded or a new game shows its own codex
new MutationObserver(refreshButton).observe(document.getElementById('overlay'), { attributes: true, attributeFilter: ['class', 'style'] });
refreshButton();
