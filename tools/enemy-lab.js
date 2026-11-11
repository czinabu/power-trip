// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Enemy lab (dev only: `npm run dev`, then open /tools/enemy-lab.html).
// Lines up every enemy type (or both bosses) under the game's own lights, so enemy model changes can be judged
// without playing. URL params: ?set=troops|bosses|squad  &pose=idle|windup|guardL|guardR|guardH|guardLo|blockL|blockR|blockH|blockLo|windL|windR|windH|windT (a duellist's guards, blocks and wind-ups)  &elite=swift|vital|volatile  &view=front|back  &z=<camera distance>
// &orbit=1 (slow turntable). &seed=N the look.
// ?set=looks&type=blaster (or several, comma-separated, or all; &per=N caps each; &faces=1 only faces) lines up a
// type's pool of looks (data/foe-looks.js). &variant=0..4 (4: bare-headed) &face=0..4 force a marking and a face; &talk=1 has them talk;
// &cam=x,y,z,lookY places the lens for a close-up. &cut=diagR|all plays a duellist's cut on a loop (data/duel.js FOE_CUTS; all: every cut in
// turn, named in the corner); &at=0..2 freezes it there instead (0→1 the wind-up, 1→2 the strike). The stats corner shows draw calls per frame.
// ?set=forms: an acolyte in each form (and the magnaguard's staff) in its form's guard (data/foe-stances.js): &line=R|L|H|Lo, &block=1,
// &old=1 (the shared guard from before), &forms=a,b picks some, &yaw=<radians> turns them (1.3: side on).

import * as THREE from 'three';
import { scene, camera, composer, renderer } from '../src/engine/renderer.js';
import { ENEMY_TYPES } from '../src/data/enemies.js';
import { buildEnemyMesh } from '../src/enemies/mesh.js';
import { lookPool } from '../src/data/foe-looks.js';
import { buildBoss } from '../src/boss/mesh.js';
import { VEXIS, MAGISTRATE, MARSHAL_BOSS } from '../src/data/bosses.js';
import { updateUpper } from '../src/enemies/upper.js';
import { markHit } from '../src/enemies/marks.js';
import { ELITES } from '../src/data/enemies.js';
import { SQUAD, PURGE, MARSHAL } from '../src/data/allies.js';
import { DETAIL } from '../src/player/model/shapes.js';
import { surfaceDetail } from '../src/player/model/styles.js';
import { solveHolds } from '../src/enemies/holds.js';
import { GUARD_POSE, BLOCK_POSE, WIND, FOE_CUTS } from '../src/data/duel.js';
import { CAST_IDS, ACOLYTES } from '../src/data/saber-cast.js';
import { STANCES } from '../src/data/stances.js';
import { guardArm, updateStance, stanceArms } from '../src/enemies/foestance.js';
import { FOE_STANCE } from '../src/data/foe-stances.js';

const q = new URLSearchParams(location.search);
{ const d = new URLSearchParams(location.search); if (d.has('rings')) DETAIL.rings = +d.get('rings'); if (d.has('round')) DETAIL.round = +d.get('round'); if (d.has('detail')) surfaceDetail.value = +d.get('detail'); }   // detail dial (player/model/shapes.js DETAIL)
const SET = q.get('set') || 'troops';
const POSE = q.get('pose') || 'idle';
const ELITE = q.get('elite') || '';
const VIEW = q.get('view') || 'front';

scene.background = new THREE.Color(0x0d1016);
scene.fog = new THREE.Fog(0x0d1016, 18, 40);
const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 48), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// the windup pose is the one players read most: weapons hauled back (values from ai.js at coil = 1)
function pose(g, heavy){
  const u = g.userData;
  // a duellist's guard (the line it covers) and its wind-ups (the line it will strike from), as enemies/duel.js holds them
  const duel = /^(guard|block|wind)(Lo|[LRHT])$/.exec(POSE);
  if (duel){
    const P = duel[1] === 'guard' ? GUARD_POSE : duel[1] === 'block' ? BLOCK_POSE : WIND, s = duel[2];
    if (u.staff && P.staff[s]){ u.staff.rotation.z = P.staff[s][0]; u.staff.rotation.x = P.staff[s][1]; }
    else if (u.weaponArm && P.sword[s]){ u.weaponArm.rotation.x = P.sword[s][0]; u.weaponArm.rotation.z = P.sword[s][1]; }
    return;
  }
  if (POSE !== 'windup') return;
  if (u.weaponArm){ u.weaponArm.rotation.x = -0.35 - (heavy ? 2.7 : 2.1); u.weaponArm.rotation.z = heavy ? 0.9 : 0.6; }
  if (u.staff){ u.staff.rotation.z = 0.5 - 2.9; u.staff.rotation.x = 1.2; }
  if (u.bodyMat){ u.bodyMat.emissive.setHex(0xff2a18); u.bodyMat.emissiveIntensity = 0.25; }
  if (u.hand) u.hand.rotation.z = -3.3;
}

const figs = [];
if (SET === 'bosses'){
  // Darth Vexis: a duellist's body in his own look (data/bosses.js VEXIS); &old=1 shows the state-machine model he replaced
  if (q.get('old') !== '1'){
    const g = buildEnemyMesh(ENEMY_TYPES[VEXIS.type], { look: VEXIS.look });
    g.scale.multiplyScalar(VEXIS.scale);
    figs.push({ g, label: 'Darth Vexis', w: 3.4 });
  }
  // the Iron Magistrate: a lancer's body in his own model (data/bosses.js MAGISTRATE)
  if (q.get('old') !== '1'){
    const g = buildEnemyMesh({ ...ENEMY_TYPES[MAGISTRATE.type], ...MAGISTRATE.dress });
    g.scale.multiplyScalar(MAGISTRATE.scale);
    if (q.get('cracks') === '1') for (const c of g.userData.cracks || []){ c.material.opacity = 0.9; c.visible = true; }
    if (q.get('jets') === '1') for (const c of g.userData.thrusters || []){ c.material.opacity = 0.9; c.visible = true; c.scale.set(1, 2, 1); }
    figs.push({ g, label: 'Iron Magistrate', w: 4.0 });
  }
  // the Marshal: an officer's body in his own model (data/bosses.js MARSHAL_BOSS); &baton=1 shows his phase III hands
  if (q.get('old') !== '1'){
    const g = buildEnemyMesh({ ...ENEMY_TYPES[MARSHAL_BOSS.type], ...MARSHAL_BOSS.dress });
    g.scale.multiplyScalar(MARSHAL_BOSS.scale);
    const u = g.userData, baton = q.get('baton') === '1';
    if (u.batonR) u.batonR.visible = baton;
    if (u.batonBack) u.batonBack.visible = !baton;
    for (const k of ['pistolR', 'pistolL']) if (u[k]) u[k].visible = !baton;
    if (q.get('signal') === '1') for (const s of u.signal || []) s.material.opacity = 1;
    figs.push({ g, label: 'The Marshal', w: 3.4 });
  }
  for (const kind of q.get('old') === '1' ? ['sith', 'mando'] : []){
    const g = buildBoss(kind);
    if (POSE !== 'windup' && g.userData.hand) g.userData.hand.rotation.z = -0.6;
    pose(g, true);
    figs.push({ g, label: kind === 'sith' ? 'Darth Vexis' : 'Iron Magistrate', w: 4.2 });
  }
} else if (SET === 'squad'){
  // the squadmates (allies/squad.js): two of each side's troopers, on the same trooper kit
  for (const side of ['jedi', 'mando']) for (const m of SQUAD.roster[side].slice(0, 2)){
    const t = { scale: 1, ...m };
    const g = buildEnemyMesh(t);
    figs.push({ g, label: m.name, w: 2.1 });
  }
} else if (SET === 'rival'){
  // the trooper story's rival: the Marshal (data/allies.js MARSHAL), beside the purge clone officer he used to be drawn as
  for (const [label, dress] of [['purge officer (old)', PURGE.officer], ['THE MARSHAL', MARSHAL]]){
    const g = buildEnemyMesh({ ...ENEMY_TYPES.officer, ...dress, scale: 1.12 });
    figs.push({ g, label, w: 2.2 });
  }
} else if (SET === 'looks'){
  // every look in one type's pool (data/foe-looks.js), or &type=all: the first few of every type's
  const TYPE = q.get('type') || 'blaster', per = +q.get('per') || 0;
  for (const [name, t] of Object.entries(ENEMY_TYPES)){
    if (TYPE !== 'all' && !TYPE.split(',').includes(name)) continue;
    const pool = lookPool(t.model) || [null];
    pool.slice(0, per || pool.length).forEach((L, i) => {
      if (q.get('faces') && !(L && L.face)) return;   // &faces=1: only the looks with a face
      const g = buildEnemyMesh(t, L ? { lookIndex: i } : {});
      if (t.fly) g.position.y = 0.6;
      pose(g, !!t.heavy);
      const tag = L ? (L.fem ? 'F' : 'M') + (L.bare || L.face ? ' face' : '') + (L.v ? ' m' + L.v : '') + (L.dv ? ' kit' + L.dv : '') : '';
      figs.push({ g, label: (TYPE === 'all' || TYPE.includes(',') ? name + ' ' : '') + tag, w: 0.85 + t.scale * 0.7 });
    });
  }
} else if (SET === 'forms'){
  /* ?set=forms: an acolyte in each form (and the magnaguard's staff) in its own stance (data/foe-stances.js), guarding the
     &line=R|L|H|Lo (default R; &block=1 its block). &old=1: the shared guard every form held before. &live=1 has them breathe */
  const LINE = q.get('line') || 'R', BLK = q.get('block') === '1', OLD = q.get('old') === '1';
  const FORMS = (q.get('forms') || 'shiicho,makashi,soresu,ataru,djemso,shien,juyo,staff').split(',');
  /* &tune={"shien2":{"base":"shien","wrist":{"L":[0.9,-1.4]}}} tries a stance out without editing the data: a new name
     (or an existing one) built on `base`, its per-line keys merged line by line. Put the new name in &forms */
  if (q.get('tune')) for (const [k, v] of Object.entries(JSON.parse(q.get('tune')))){
    const b = FOE_STANCE[v.base || k] || {}, o = { ...b };
    for (const [kk, vv] of Object.entries(v)) if (kk !== 'base') o[kk] = vv && typeof vv === 'object' && !Array.isArray(vv) ? { ...(b[kk] || {}), ...vv } : vv;
    FOE_STANCE[k] = o;
  }
  for (const ff of FORMS){
    const staff = ff === 'staff', t = staff ? ENEMY_TYPES.duelist : ENEMY_TYPES.acolyte;
    const g = buildEnemyMesh(t, { face: FORMS.indexOf(ff) % 5 });
    if (!staff && g.userData.bladeGlow && STANCES[ff]) g.userData.bladeGlow.material.color.setHex(STANCES[ff].blade);
    const e = { group: g, t, type: staff ? 'duelist' : 'acolyte', ff: OLD ? null : ff, state: 'chase', guard: LINE, st: 0 };
    figs.push({ g, label: (STANCES[ff] ? STANCES[ff].name.split(' —')[0] : FOE_STANCE[ff] && ff !== 'staff' ? ff : 'STAFF') + (OLD ? ' (before)' : ''), w: 1.7, e, line: LINE, blk: BLK });
  }
} else if (SET === 'saber'){
  /* the saber cast (data/saber-cast.js): every named look, then the rank-and-file acolytes. &nolook=1 builds them the
     way they were before the cast, a tinted acolyte each (the before shot); &who=a,b picks some by id; &acolytes=0 hides those */
  const OLD = { 'ILSA VENN': [0x4a7ad2, 1, 'djemso'], 'THE WALL': [0x3a7ad2, 1.12, 'soresu'], 'SERA QUILL': [0x3ad28a, 1, 'ataru'], 'THE ACROBAT': [0x3ad28a, 1, 'ataru'],
    'THE KNIGHT': [0xd2b23a, 1.15, 'djemso'], 'THE INQUISITOR': [0xa01a22, 1.18], 'THE SEVENTH BLADE': [0xa01a22, 1.15], 'THE WARDEN': [0x8a2a30, 1.12, 'djemso'],
    'THE GRAND INQUISITOR': [0x8a1a22, 1.22, 'djemso'], 'THE ECHO': [0x6a4ad2, 1.1, 'djemso'], 'strike:THE WARDEN': [0x8a2a1a, 1.2] };
  const WHO = q.get('who') ? q.get('who').split(',') : CAST_IDS.filter(id => id !== 'THE ACROBAT');
  const NO = q.get('nolook') === '1';
  for (const id of WHO){
    const [tint, sc, form] = OLD[id] || [0xa01a22, 1];
    const g = buildEnemyMesh(ENEMY_TYPES.acolyte, NO ? {} : { look: id });
    if (NO) g.userData.bodyMat.color.lerp(new THREE.Color(tint), 0.5);
    if (form && g.userData.bladeGlow && (NO || !g.userData.look || g.userData.look.side === 'jedi')) g.userData.bladeGlow.material.color.setHex(STANCES[form].blade);
    g.scale.multiplyScalar(sc);
    if (q.get('talk')) g.userData.talk = true;
    pose(g, false);
    figs.push({ g, label: (id.includes(':') ? id.split(':')[0] + ' · ' : '') + id.replace(/^[^:]*:/, '').replace('THE ', ''), w: 1.6 });
  }
  if (q.get('acolytes') !== '0') ACOLYTES.forEach((_, i) => {
    const g = buildEnemyMesh(ENEMY_TYPES.acolyte, NO ? {} : { face: i });
    pose(g, false);
    figs.push({ g, label: 'acolyte ' + (i + 1), w: 1.4 });
  });
} else {
  const ONLY = q.get('only');   // &only=grunt,brute — a subset, for close-ups
  for (const [name, t] of Object.entries(ENEMY_TYPES)){
    if (ONLY && !ONLY.split(',').includes(name)) continue;
    {
      const g = buildEnemyMesh(t, { variant: q.get('variant') != null ? +q.get('variant') : undefined, face: q.get('face') != null ? +q.get('face') : undefined,
        seed: q.get('seed') != null ? +q.get('seed') : undefined });
      if (q.get('talk')) g.userData.talk = true;
      if (ELITE && ELITES[ELITE]){
        const m = ELITES[ELITE];
        g.scale.multiplyScalar(m.scale);
        g.userData.bodyMat.color.lerp(new THREE.Color(m.tint), 0.5);
      }
      if (t.fly) g.position.y = 0.6;
      pose(g, !!t.heavy);
      figs.push({ g, label: name, w: 1.15 + t.scale * 0.95 });
    }
  }
}
const total = figs.reduce((s, f) => s + f.w, 0);
let x = -total / 2;
for (const f of figs){
  f.g.position.x = x + f.w / 2; x += f.w;
  f.g.rotation.y = q.get('yaw') != null ? +q.get('yaw') : VIEW === 'back' ? Math.PI + 0.4 : -0.4;   // &yaw=<radians>: turn them (1.57: side on)
  scene.add(f.g);
}

camera.fov = 30;
if (SET === 'bosses'){ camera.position.set(0, 3.0, 12.5); camera.lookAt(0, 2.4, 0); }
else { const z = +q.get('z') || Math.max(5, total * 0.95), cy = q.get('cy') != null ? +q.get('cy') : 1.45; camera.position.set(0, cy - 0.05 + z * 0.08, z); camera.lookAt(0, cy, 0); }   // &cy=<height>: what the camera looks at (a close-up on a head)
if (q.get('cam')){ const [cx, cy, cz, ly] = q.get('cam').split(',').map(Number); camera.position.set(cx, cy, cz); camera.lookAt(cx, ly ?? cy, 0); }   // &cam=x,y,z,lookY: a close-up
camera.updateProjectionMatrix();
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55); fill.position.set(-4, 5, 12); scene.add(fill);

const cap = document.getElementById('cap');
cap.innerHTML = figs.map(f => `<span>${f.label}</span>`).join('');
const labels = [...cap.children];
function placeLabels(){
  const v = new THREE.Vector3();
  figs.forEach((f, i) => {
    v.set(f.g.position.x, 0, 0).project(camera);
    labels[i].style.cssText = `position:fixed;left:${(v.x * 0.5 + 0.5) * innerWidth}px;transform:translateX(-50%);bottom:18px`;
  });
}
const btn = (on, label, params) => `<button class="${on ? 'on' : ''}" onclick="location.search='${new URLSearchParams({ set: SET, pose: POSE, elite: ELITE, view: VIEW, ...params })}'">${label}</button>`;
document.getElementById('bar').innerHTML =
  btn(SET === 'troops', 'Troops', { set: 'troops' }) + btn(SET === 'bosses', 'Bosses', { set: 'bosses' }) + btn(SET === 'squad', 'Squad', { set: 'squad' }) + btn(SET === 'saber', 'Saber cast', { set: 'saber' })
  + btn(SET === 'looks', 'Looks', { set: 'looks', type: q.get('type') || 'blaster' }) + btn(SET === 'rival', 'Rival', { set: 'rival' })
  + btn(POSE === 'idle', 'Idle', { pose: 'idle' }) + btn(POSE === 'windup', 'Windup', { pose: 'windup' })
  + ['', ...Object.keys(ELITES)].map(n => btn(n === ELITE, n || 'no elite', { elite: n })).join('')
  + btn(false, VIEW === 'back' ? 'Front view' : 'Back view', { view: VIEW === 'back' ? 'front' : 'back' });

/* CUTS — the wind-up from the carry to the cut's `from`, then the strike through to `to`, with the chest's turn, the
   lean, the hips' drop and the spin's yaw, the way enemies/duel.js windupPose / strikePose play it */
const CUT = q.get('cut'), AT = q.get('at');
const CUT_IDS = CUT === 'all' ? Object.keys(FOE_CUTS) : CUT && FOE_CUTS[CUT] ? [CUT] : [];
const STAFF_END = { L: [-1.6, 0.9], R: [1.7, 0.9], H: [0.9, 0.9], T: [-1.5, -0.3], Lo: [-1.2, -1.0] };
const lerp = (a, b, k) => a + (b - a) * k;
function poseCut(f, id, ph){
  const c = FOE_CUTS[id], u = f.g.userData;
  const wk = Math.min(1, ph), k = Math.max(0, ph - 1), chop = k * k, coil = Math.sqrt(wk);
  const strike = ph > 1, ka = c.yaw ? Math.min(1, chop * 4) : chop;
  if (u.staff){
    const fr = c.staff ? c.staff.from : WIND.staff[c.line] || WIND.staff.H, to = c.staff ? c.staff.to : STAFF_END[c.line];
    const p = strike ? fr.map((v, i) => lerp(v, to[i], ka)) : [lerp(0.5, fr[0], coil), lerp(0.3, fr[1], coil)];
    u.staff.rotation.z = p[0]; u.staff.rotation.x = p[1];
  } else if (u.weaponArm){
    const w0 = [-0.35, 0, 0], fr = c.from, to = c.to;
    const p = [0, 1, 2].map(i => strike ? lerp(fr[i] || 0, to[i] || 0, ka) : lerp(w0[i], fr[i] || 0, coil));
    u.weaponArm.rotation.set(p[0], p[2], p[1]);
  }
  f.g.rotation.x = strike ? lerp(c.lean[0], c.lean[1], chop) : c.lean[0] * coil;
  if (u.chest) u.chest.rotation.y = strike ? lerp(c.twist[0], c.twist[1], chop) : c.twist[0] * coil;
  const yaw = c.yaw ? (strike ? lerp(c.yaw[0], c.yaw[1], chop) : c.yaw[0] * coil) : 0;
  f.g.rotation.y = f.yaw0 + yaw;
  const drop = (c.drop || 0) * (strike ? (c.line === 'Lo' ? 1 - 0.3 * chop : c.slam ? chop : 1 - chop) : c.slam ? 0 : coil);
  if (u.vis) u.vis.position.y = -drop;
  const glow = c.fin ? 0xffa020 : c.line === 'T' ? 0xfff0e0 : 0xff2a18;
  if (u.bodyMat){ u.bodyMat.emissive.setHex(glow); u.bodyMat.emissiveIntensity = strike ? (1 - k) * 0.5 : coil * 0.45; }
}
// one loop of a cut (s): wind-up, held at the top, the strike, then back to the carry
const LOOP = { wind: 0.5, hold: 0.12, strike: 0.3, rest: 0.55 };
const loopLen = c => LOOP.wind * (c.wind || 1) + LOOP.hold + LOOP.strike * (c.swing || 1) + LOOP.rest;
const cutTag = document.createElement('div');
cutTag.style.cssText = 'position:fixed;left:12px;bottom:46px;font:600 15px/1.2 system-ui;letter-spacing:.12em;color:#ffe6b0;text-transform:uppercase';
document.body.appendChild(cutTag);
for (const f of figs) f.yaw0 = f.g.rotation.y;
function playCuts(ms){
  if (!CUT_IDS.length) return;
  let id, ph;
  if (AT != null){ id = CUT_IDS[0]; ph = +AT; }
  else {
    let t = (ms / 1000) % CUT_IDS.reduce((s2, i) => s2 + loopLen(FOE_CUTS[i]), 0);
    for (const i of CUT_IDS){ const L = loopLen(FOE_CUTS[i]); if (t < L){ id = i; break; } t -= L; }
    const c = FOE_CUTS[id], W = LOOP.wind * (c.wind || 1), Sk = LOOP.strike * (c.swing || 1);
    ph = t < W ? t / W : t < W + LOOP.hold ? 1 : t < W + LOOP.hold + Sk ? 1 + (t - W - LOOP.hold) / Sk : 2;
    window.LAB.cutNow = { id, ph };
  }
  for (const f of figs) poseCut(f, id, ph);
  cutTag.textContent = id + (FOE_CUTS[id].fin ? ' · finisher' : '') + ' · line ' + FOE_CUTS[id].line;
}

// &hits=1: every kind of hit mark on each figure (enemies/scars.js markHit): scorches on the chest, a dent and a torn
// plate on the belly and shoulder, a cracked helm
if (q.get('hits')) setTimeout(() => {
  for (const f of figs){
    const g = f.g, s = g.scale.x, fr = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
    const at = (x, y, z) => new THREE.Vector3(x, y * s, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y).add(g.position).addScaledVector(fr, z * s);
    const back = fr.clone().negate();
    markHit(g, at(-0.08, 1.62, 0.2), back, 'scorch');
    markHit(g, at(0.12, 1.5, 0.2), back, 'scorch');
    markHit(g, at(0.06, 1.25, 0.15), back, 'dent', { heavy: true });
    markHit(g, at(-0.3, 1.76, 0.1), back, 'tear', { heavy: true });
    markHit(g, at(0.05, 2.18, 0.16), back, 'crack');
  }
}, 300);
// a form's guard, settled at once (the game eases into it: enemies/duel.js guardPose, enemies/foestance.js)
function formPose(f, dt){
  const e = f.e, u = f.g.userData, P = f.blk ? BLOCK_POSE : GUARD_POSE;
  const p = guardArm(e, P, f.line, f.blk);
  if (u.staff){ u.staff.rotation.z = p[0]; u.staff.rotation.x = p[1]; }
  else if (u.weaponArm){ u.weaponArm.rotation.x = p[0]; u.weaponArm.rotation.z = p[1]; }
  for (let i = 0; i < 10; i++) updateStance(e, 0.1, true, f.line);
  if (u.chest) u.chest.rotation.set((e.stanceLean || 0) + 0.04, e.stanceTwist || 0, 0);
  if (u.head) u.head.rotation.y = -(e.stanceTwist || 0) * 0.6;
  // the hips sink into its crouch, the knees bend so the feet stay planted (the game's gait IK does this: enemies/gait.js)
  const d = e.stanceDrop || 0, a = Math.acos(Math.max(-1, 1 - d / 0.9));
  if (u.vis) u.vis.position.y = -d;
  for (const [th, sh, ft] of [[u.thighL, u.shinL, u.footL], [u.thighR, u.shinR, u.footR]]) if (th){ th.rotation.x = -a; sh.rotation.x = 2 * a; ft.rotation.x = -a; }
  if (u.elbowOff) for (let i = 0; i < 10; i++) stanceArms(e, u, 0.1);
}
const stats = document.getElementById('stats');
const orbit = q.get('orbit') === '1';
renderer.info.autoReset = false;
const LIVE = q.get('live') === '1';   // &live=1: run the upper-body life (stance, breath, blinks, talking, belt gear)
let lastT = 0;
renderer.setAnimationLoop(t => {
  const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0; lastT = t;
  if (LIVE && dt > 0) for (const f of figs){ f.o = f.o || f.e || { state: 'idle' }; updateUpper(f.o, f.g, dt, null); }
  for (const f of figs) if (f.e) formPose(f, f.e.ff ? 0.5 : 0);
  if (orbit) for (const f of figs) f.g.rotation.y = f.yaw0 = t * 0.0004;
  playCuts(window.LAB && window.LAB.clock != null ? window.LAB.clock : t);
  for (const f of figs) if (f.g.userData.holds) solveHolds(f.g.userData);   // hands on a staff follow it (the game runs this in enemies/upper.js)
  placeLabels();
  renderer.info.reset();
  composer.render();
  stats.textContent = `${renderer.info.render.calls} draw calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris`;
});
window.LAB = { figs, scene, camera, renderer };
