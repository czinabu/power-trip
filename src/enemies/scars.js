// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Saber damage that stays. A blade that lands burns a cut into the armour where it crossed (glowing at first, then
// cooling to a black char that the unit wears for the rest of the fight), and a killing cut can take a foe's limbs
// off (whatever the blade went through: severLimbs below). Called from the hero's blades: the Jedi saber (player/jedi/combat.js, aerial.js) and the
// Mandalorian's darksaber (player/mando/darksaber.js). Visual only: nothing here touches health or the AI.
//
// A cut is drawn by the unit's own armour material (enemies/kit.js wearArmor, up to SCARS of them). It is stored in
// the body's REST pose, pinned to the bone under it (chest, head, a thigh, a shin...), so it rides the plate it landed
// on however the body then bends.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { rand, clamp } from '../utils.js';
import { SCARS } from './kit.js';
import { toRest, restJoints, boneAt, markHit, scarClock, updatePlates, clearPlates } from './marks.js';
export { markHit, scarClock };
import { bladePointNear } from '../player/jedi/clash.js';
import { bladeSegment } from '../player/jedi/bladehit.js';
import { sparks } from '../fx/ink.js';
import { cutDefeat } from './defeat.js';
import { DEFEAT } from '../data/defeats.js';
import { groundAt } from '../world/collision.js';
import { burst } from '../fx/particles.js';
import { enemies } from '../state.js';
import { chestPos, bodyRadius } from './bodyshape.js';


const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Vector3();
const _c = new THREE.Vector3(), _b = new THREE.Vector3(), _w = new THREE.Vector3(), _dir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const _s = new THREE.Vector3(), _qq = new THREE.Quaternion(), _dir2 = new THREE.Vector3();

/* burn a cut where the hero's blade crossed `group`'s body. f: the blow's direction (the hero's facing); dirKey: the
   cut's line ('left' / 'right' sweep across, else a diagonal); heavy: a finisher or a heavy form, more upright.
   hit: where the blade really met the body and which way its tip was going (player/jedi/bladehit.js sw.hitAt), when
   the swing traced it; without it the cut is placed from the blade's line and the swing */
export function scarBody(group, f, dirKey, heavy, hit){
  const u = group.userData, sm = u.bodySkin, W = u.bodyMat && u.bodyMat.userData.wear;
  if (!sm || !W) return;
  group.updateMatrixWorld(true);
  const H = group.scale.x * (u.vis ? u.vis.scale.y : 1) * (u.legScale || 1), gp = group.position;
  // the height: where your blade passes the body (else somewhere on the torso), on the plate facing the blow
  _c.set(gp.x, gp.y + 1.4 * H, gp.z);
  let y = gp.y + rand(1.05, 1.65) * H;
  if (bladePointNear(_c, _b)) y = clamp(_b.y, gp.y + 0.45 * H, gp.y + 1.85 * H);
  const side = rand(-0.09, 0.09) * H;
  _w.set(gp.x - f.x * 0.2 * H + f.z * side, y, gp.z - f.z * 0.2 * H - f.x * side);
  // the line of the cut: a sweep goes across, a plain cut runs on a slant, a heavy blow comes down near upright
  _dir.set(f.z, 0, -f.x);
  if (heavy) _dir.multiplyScalar(0.35).addScaledVector(UP, Math.random() < 0.5 ? 1 : -1);
  else if (dirKey !== 'left' && dirKey !== 'right') _dir.addScaledVector(UP, rand(0.6, 1.1) * (Math.random() < 0.5 ? 1 : -1));
  else _dir.addScaledVector(UP, rand(-0.25, 0.25));
  // the traced contact wins: the very spot, and the tip's own line across the plate (flattened onto the body's face)
  if (hit && hit.at){
    _w.copy(hit.at);
    if (hit.cut && hit.cut.lengthSq() > 1e-6){ _b.copy(hit.cut).addScaledVector(f, -hit.cut.dot(f)); if (_b.lengthSq() > 1e-6) _dir.copy(_b); }
  }
  _dir.normalize();
  const bi = boneAt(sm, _w);
  const rp = toRest(sm, bi, _w, _p);
  if (rp.y < 0.25 * (u.legScale || 1)) return;   // (the boots: below where a sword arm's own rest pose lives, see kit.js)
  const rd = toRest(sm, bi, _dir, _q, true);
  const k = (W.scarNext || 0) % SCARS; W.scarNext = k + 1;
  W.uScar.value[k].set(rp.x, rp.y, rp.z, scarClock());
  W.uScarDir.value[k].set(rd.x, rd.y, rd.z, rand(0.15, 0.22) * (u.legScale || 1) * (heavy ? 1.2 : 1));
}

/* a blast at `pos` scorches every foe in reach on the side facing it, and the nearer ones lose a plate */
const _bp = new THREE.Vector3(), _bd = new THREE.Vector3();
export function blastMarks(pos, radius){
  for (const e of enemies){
    if (!e.group || e.converted) continue;
    chestPos(e, _bp); _bd.subVectors(_bp, pos); _bd.y = 0;
    const d = _bd.length();
    if (d > radius * 1.15) continue;
    if (d > 1e-3) _bd.divideScalar(d); else _bd.set(1, 0, 0);
    _bp.addScaledVector(_bd, -bodyRadius(e) * 0.8);   // the near side of the body
    markHit(e.group, _bp, _bd, 'scorch', { size: 1.6 });
    if (d < radius * 0.75) markHit(e.group, _bp.addScaledVector(new THREE.Vector3(0, 1, 0), rand(-0.3, 0.2) * e.group.scale.x), _bd, 'tear', { heavy: true });
  }
}

/* ---------- severed limbs ----------
   A killing saber cut takes off WHAT THE BLADE WENT THROUGH. The swing traces where the blade met the body and which way
   it was travelling (player/jedi/bladehit.js sw.hitAt): that, with the blade's own line, is the plane the blade sliced
   along. Every part the plane crosses near the contact is a candidate, and the nearest one comes off: a level sweep at the
   chest takes the body in two at the waist, a low one takes a leg (both, on a heavy blow), a high one the head, and a cut
   that meets an arm takes it at the shoulder or the forearm at the elbow, whichever the plane crosses.

   A part that comes off is the unit's own geometry: the joint it hangs from shrinks to nothing on the body, and a
   PIECE flies off in its place, built from the same baked meshes and materials (skinned to a fresh copy of the bones
   below the cut, with every bone above it shrunk into the wound). The wound glows on both faces, tilted the way the
   blade went through, then cools to char while it smokes (a droid's sparks). */
const pieces = [];   // { o, v, spin, t, rest, floor, kind }
const burns = [];    // { cap, t, droid } — a cut face still hot: it glows, then smokes (or sparks) a moment

/* The parts a unit can lose, one bit each (e.cut is the mask; the host sends it in every snapshot so a co-op guest sees the
   same cuts). key: the joint in userData; fore: the elbow of that arm (its first bone). r: how thick it is (for a blade
   that only grazes), mid: its middle along the bone, from the joint (the piece spins about it), cap: the wound's size */
const LIMBS = [
  { bit: 1,     key: 'weaponArm', kind: 'arm' }, { bit: 2, key: 'offArm', kind: 'arm' }, { bit: 4, key: 'offArmR', kind: 'arm' },
  { bit: 4096,  key: 'arm:L', kind: 'arm' },     { bit: 8192, key: 'arm:R', kind: 'arm' },   // (a rifleman's arms: enemies/mesh.js reachArm)
  { bit: 256,   fore: 'weaponArm', kind: 'fore' }, { bit: 512, fore: 'offArm', kind: 'fore' }, { bit: 1024, fore: 'offArmR', kind: 'fore' },
  { bit: 16384, fore: 'arm:L', kind: 'fore' },   { bit: 32768, fore: 'arm:R', kind: 'fore' },
  { bit: 8,     key: 'head', kind: 'head' },
  { bit: 2048,  key: 'chest', kind: 'waist' },
  { bit: 16,    key: 'thighL', kind: 'leg', foot: 'shinL' }, { bit: 32, key: 'thighR', kind: 'leg', foot: 'shinR' },
  { bit: 64,    key: 'shinL', kind: 'shin', foot: 'footL' },  { bit: 128, key: 'shinR', kind: 'shin', foot: 'footR' },
];
// per kind: thickness, the far end (bone space, when no child bone marks it), the piece's middle, the wound's radius
const PART = {
  arm:   { r: 0.085, end: [0, -0.41, 0], mid: -0.38, cap: 0.08,  floor: 0.08 },
  fore:  { r: 0.075, end: [0, -0.4, 0],  mid: -0.2,  cap: 0.068, floor: 0.07 },
  head:  { r: 0.17,  end: [0, 0.32, 0],  mid: 0.16,  cap: 0.075, floor: 0.17, from: -0.14 },
  waist: { r: 0.25,  end: [0, 0.66, 0],  mid: 0.42,  cap: 0.2,   floor: 0.2, aspect: 0.62 },
  leg:   { r: 0.12,  end: [0, -0.48, 0], mid: -0.45, cap: 0.11,  floor: 0.11 },
  shin:  { r: 0.095, end: [0, -0.45, 0], mid: -0.22, cap: 0.088, floor: 0.09 },
  rifle: { mid: 0, floor: 0.05 },
};
const DROID = { magna: 1, b1: 1 };   // models built of metal: their wounds spark, not smoke

const elbowOf = a => a && a.children.find(c => !c.isMesh && c.name && !c.userData.cap) || null;
const jointOf = (u, L) => L.key ? u[L.key] || null : elbowOf(u[L.fore]);
// a joint already off the body (it, or one it hangs from, was cut)
function gone(o){ for (; o; o = o.parent) if (o.userData.cut) return true; return false; }

/* ---- the wound: a charred face with a molten rim over it, glowing hot and cooling ---- */
let _burnTex = null;
function burnTex(){
  if (_burnTex) return _burnTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,120,40,0.55)'); gr.addColorStop(0.5, 'rgba(255,140,50,0.75)');
  gr.addColorStop(0.78, 'rgba(255,232,170,1)'); gr.addColorStop(0.9, 'rgba(255,150,50,0.85)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  _burnTex = new THREE.CanvasTexture(c); _burnTex.colorSpace = THREE.SRGBColorSpace;
  return _burnTex;
}
const DISC = new THREE.CircleGeometry(1, 14);
const CHAR = new THREE.MeshBasicMaterial({ color: 0x1a0d08, side: THREE.DoubleSide });
// a wound on `parent` at `pos` (its space), facing world direction `nw`, radius r (aspect: flattened, the waist)
function woundAt(parent, pos, nw, r, aspect, droid){
  const w = new THREE.Group(); w.userData.cap = true; w.userData.noAO = true;
  const ch = new THREE.Mesh(DISC, CHAR); ch.userData.noAO = true; w.add(ch);
  const hot = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({ map: burnTex(), color: droid ? 0xffd0a0 : 0xffffff, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  hot.position.z = 0.012; hot.scale.setScalar(1.05); hot.userData.noAO = true; w.add(hot);
  w.position.copy(pos); w.scale.set(r, r * (aspect || 1), r);
  parent.add(w);
  // face it along nw, in parent space
  parent.updateWorldMatrix(true, false);
  parent.matrixWorld.decompose(_c, _qq, _s);
  _q.copy(nw).applyQuaternion(_qq.invert()).normalize();
  w.quaternion.setFromUnitVectors(_ZF, _q);
  burns.push({ cap: w, hot, t: 0, droid, puff: rand(0, 0.1) });
  return w;
}
const _ZF = new THREE.Vector3(0, 0, 1);

/* ---- a piece: the part below joint R, as a free body of its own (the same meshes, its own bones) ---- */
const _m4 = new THREE.Matrix4();
function makePiece(e, R, kind){
  const root = e.group, P = PART[kind];
  root.updateMatrixWorld(true);
  const piece = new THREE.Group(), inner = new THREE.Group();
  R.matrixWorld.decompose(piece.position, piece.quaternion, piece.scale);
  // pivot about its middle, not the joint
  _p.set(0, P.mid, 0).multiply(piece.scale).applyQuaternion(piece.quaternion);
  piece.position.add(_p); inner.position.set(0, -P.mid, 0);
  piece.add(inner);
  const zero = new THREE.Group(); zero.scale.setScalar(1e-4); inner.add(zero);   // the bones above the cut, folded into the wound
  const map = new Map([[R, inner]]);
  const copy = (src, dst) => {
    for (const c of src.children){
      if (c.userData.cap || c.isSkinnedMesh) continue;
      if (c.isMesh){
        const m = new THREE.Mesh(c.geometry, c.material);
        m.position.copy(c.position); m.quaternion.copy(c.quaternion); m.scale.copy(c.scale);
        m.castShadow = c.castShadow; m.visible = c.visible; m.renderOrder = c.renderOrder;
        dst.add(m);
        if (c.children.length) copy(c, m);
      } else if (c.isGroup || c.type === 'Object3D' || c.isBone){
        const g = new THREE.Group();
        g.position.copy(c.position); g.quaternion.copy(c.quaternion); g.scale.copy(c.scale); g.visible = c.visible; g.name = c.name;
        dst.add(g); map.set(c, g);
        copy(c, g);
      }
    }
  };
  copy(R, inner);
  // every skinned mesh of the unit with skin below the cut (the body's plates, an arm's sleeve) is drawn again on the
  // piece's bones; whatever of it lies above the cut folds into the wound
  root.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible) return;
    const bones = o.skeleton.bones;
    if (!bones.some(b => map.has(b))) return;
    const sm = new THREE.SkinnedMesh(o.geometry, o.material);
    sm.bind(new THREE.Skeleton(bones.map(b => map.get(b) || zero), o.skeleton.boneInverses), o.bindMatrix);
    sm.castShadow = o.castShadow; sm.frustumCulled = false;
    inner.add(sm);
  });
  scene.add(piece);
  return piece;
}
// a piece flies: v its launch, spin its tumble
function launch(piece, kind, v, spin){
  pieces.push({ o: piece, v, spin, t: 0, rest: false, floor: PART[kind].floor * piece.scale.x, kind });
}

/* take part L off unit `e` along the cut plane (n: its normal; dir: where the blow was going). Returns false when it
   isn't there to take */
function cutPart(e, L, n, dir){
  const u = e.group.userData, R = jointOf(u, L), P = PART[L.kind];
  if (!R || gone(R)) return false;
  const droid = !!DROID[u.model];
  e.group.updateMatrixWorld(true);
  // the bone's line, joint → child, and the wound's face: the cut plane, turned toward the piece side (a cut that ran
  // along the limb faces down the bone instead), never so tilted it pokes out of the limb
  R.getWorldPosition(_a);
  _b.set(...P.end); R.localToWorld(_b);
  _ax.subVectors(_b, _a).normalize();
  _nw.copy(n || _ax);
  if (_nw.dot(_ax) < 0) _nw.negate();
  if (_nw.dot(_ax) < 0.35) _nw.copy(_ax); else _nw.lerp(_ax, 0.3).normalize();
  const piece = makePiece(e, R, L.kind);
  // the wound on the stump (on the body, facing out toward where the piece was) and on the piece (facing back)
  const host = R.parent;
  woundAt(host, R.position, _nw, P.cap, P.aspect, droid);
  woundAt(piece.children[0], _zero, _nw.clone().negate(), P.cap, P.aspect, droid);
  R.userData.cut = true; R.scale.setScalar(1e-4);
  // it goes the way the blade went, up and off the body, tumbling (the body in two goes slower and turns over)
  const big = L.kind === 'waist';
  const v = new THREE.Vector3(dir.x, 0, dir.z).normalize().multiplyScalar(big ? rand(1.6, 2.6) : rand(2.5, 4.5));
  v.y = big ? rand(2.6, 3.6) : L.kind === 'head' ? rand(4.5, 6) : rand(3.5, 5.5);
  const spin = big ? new THREE.Vector3(rand(-3.5, 3.5), rand(-1.5, 1.5), rand(-2.5, 2.5)) : new THREE.Vector3(rand(-9, 9), rand(-6, 6), rand(-9, 9));
  launch(piece, L.kind, v, spin);
  if (droid) sparks(piece.position, 0xbfe4ff, 7, 7, { dir: _nw, cone: 1.1, life: 0.3, size: 0.34 });
  burst(piece.position, 0xffa040, big ? 16 : 10, 6, 4, 0.5);
  return true;
}
const _a = new THREE.Vector3(), _ax = new THREE.Vector3(), _nw = new THREE.Vector3(), _zero = new THREE.Vector3();

/* the parts the cut could have gone through, each as a line in the world (joint → its far end) */
function partsFor(e){
  const u = e.group.userData, out = [];
  e.group.updateMatrixWorld(true);
  const sc = e.group.scale.x * (u.vis ? u.vis.scale.y : 1);
  for (const L of LIMBS){
    const R = jointOf(u, L);
    if (!R || gone(R)) continue;
    const P = PART[L.kind], a = new THREE.Vector3(0, P.from || 0, 0), b = new THREE.Vector3();
    R.localToWorld(a);
    const far = L.foot ? u[L.foot] : L.kind === 'arm' ? elbowOf(R) : null;
    if (far) far.getWorldPosition(b); else { b.set(...P.end); R.localToWorld(b); }
    out.push({ L, a, b, r: P.r * sc });
  }
  return out;
}
const _seg = new THREE.Vector3();
function distSeg(p, a, b){
  _seg.subVectors(b, a);
  const l2 = _seg.lengthSq() || 1, t = clamp(_p.subVectors(p, a).dot(_seg) / l2, 0, 1);
  return _q.copy(a).addScaledVector(_seg, t).distanceTo(p);
}

/* where and how the blade went through: the contact point, the cut plane's normal and the blow's way. From the swing's
   trace when it has one; else from the hero's blade where it is now (a darksaber sweep, a falling cut, a finisher), with
   `travel` the way that blow moves (null: straight in) */
function traceOf(e, f, hit){
  const g = e.group, H = g.scale.x * (g.userData.vis ? g.userData.vis.scale.y : 1);
  if (hit && hit.at && hit.cut && hit.blade){
    const n = new THREE.Vector3().crossVectors(hit.blade, hit.cut);
    if (n.lengthSq() > 1e-8) return { p: hit.at.clone(), n: n.normalize(), dir: hit.cut.clone() };
  }
  if (hit === false) return null;   // (nothing to trace: the co-op partner's blow)
  _c.set(g.position.x, g.position.y + 1.3 * H, g.position.z);
  if (!bladePointNear(_c, _b) || _b.distanceTo(_c) > 1.4 * H || !bladeSegment(_bb, _bt)) return null;
  const travel = hit && hit.travel ? hit.travel : f;
  const n = new THREE.Vector3().crossVectors(_bt.sub(_bb), travel);
  if (n.lengthSq() < 1e-8) return null;
  return { p: (hit && hit.at) ? hit.at.clone() : _b.clone(), n: n.normalize(), dir: travel.clone() };
}
const _bb = new THREE.Vector3(), _bt = new THREE.Vector3();

/* which parts the cut takes: every part the plane crosses near the contact (the torso only on a near-level cut: the
   body in two), nearest first; when it crosses none, the part the blade touched, if it touched one */
function choose(e, T, champ){
  const g = e.group, H = g.scale.x, reach = 0.95 * H, out = [];
  for (const C of partsFor(e)){
    const k = C.L.kind;
    if (champ && (k === 'head' || k === 'waist')) continue;
    if (k === 'waist' && Math.abs(T.n.y) < 0.62) continue;
    const da = T.n.dot(_p.subVectors(C.a, T.p)), db = T.n.dot(_p.subVectors(C.b, T.p));
    let d;
    if (da * db <= 0 && da !== db){
      const s = da / (da - db);
      d = _q.copy(C.a).lerp(C.b, s).distanceTo(T.p);
      if (d > reach) continue;
    } else {
      if (k === 'waist') continue;   // (a glancing touch never halves anyone)
      d = distSeg(T.p, C.a, C.b) - C.r;
      if (d > 0.1 * H) continue;
      d += 0.5 * H;   // a touch ranks behind a clean pass through
    }
    out.push({ L: C.L, d });
  }
  return out.sort((x, y) => x.d - y.d);
}

// the old way, for a blow there is nothing to trace for: any part is fair, the legs and arms likelier than the head
function anyPart(e, champ){
  const out = [];
  for (const C of partsFor(e)){
    const k = C.L.kind;
    if (k === 'waist' || champ && k === 'head') continue;
    out.push({ L: C.L, d: Math.random() * (k === 'head' ? 1.6 : k === 'fore' ? 1.2 : 1) });
  }
  return out.sort((x, y) => x.d - y.d);
}

/* A killing saber cut (never a guarded one: those turn aside before they reach here) may take off what it went through.
   chance: the odds it does; a heavy blow (chance ≥ 0.7) may take a second part on the same line (both legs on a low
   sweep). hit: the swing's trace (player/jedi/bladehit.js), or { travel } for a blow without one (the hero's blade is
   read where it is), or false for a blow there is nothing to trace for (the co-op partner's). Returns the mask taken.
   A boss is never cut (they aren't in the enemy list); a champion loses one part at most, and keeps its head. */
export function severLimbs(e, f, chance, hit){
  if (e.net || e.fin || !e.group || !e.group.userData) return 0;
  const champ = !!(e.champion || e.warbringer);
  if (Math.random() >= (champ ? chance * 0.5 : chance)) return 0;
  const T = traceOf(e, f, hit);
  const list = T ? choose(e, T, champ) : anyPart(e, champ);
  if (!list.length) return 0;
  let mask = list[0].L.bit;
  // the heavy blow carries on through: a second part on the same line (not one the first takes with it)
  if (!champ && chance >= 0.7 && list.length > 1 && Math.random() < chance - 0.25){
    const first = jointOf(e.group.userData, list[0].L);
    for (let i = 1; i < list.length; i++){
      const R = jointOf(e.group.userData, list[i].L);
      let under = false; for (let o = R; o; o = o.parent) if (o === first) under = true;
      let over = false; for (let o = first; o; o = o.parent) if (o === R) over = true;
      if (!under && !over){ mask |= list[i].L.bit; break; }
    }
  }
  // the pieces go off the way the blade was going, and away from the hero
  const dir = T ? _dir2.copy(T.dir).setY(0).normalize().multiplyScalar(0.8).add(f) : f;
  applyCuts(e, mask, dir, T && T.n);
  return mask;
}

/* put the cuts in `mask` on `e` (the ones it doesn't wear yet). The guest calls this from the host's snapshot.
   dir: the way the blow went (else away from where it faces); n: the cut plane (else straight across the bone) */
export function applyCuts(e, mask, dir, n){
  const fresh = mask & ~(e.cut || 0);
  if (!fresh) return;
  e.cut = (e.cut || 0) | fresh;
  if (!dir) dir = _dir.set(-Math.sin(e.group.rotation.y), 0, -Math.cos(e.group.rotation.y));
  const kinds = [];
  for (const L of LIMBS) if (fresh & L.bit && cutPart(e, L, n, dir)) kinds.push([L.kind, sideOf(e, L)]);
  if (kinds.length) cutDefeat(e, kinds, dir);   // the body answers what it lost (enemies/defeat.js)
}
// which side of the body a part hangs on: -1 its left, +1 its right, 0 the middle
function sideOf(e, L){
  const R = jointOf(e.group.userData, L);
  if (!R || L.kind === 'head' || L.kind === 'waist') return 0;
  R.getWorldPosition(_p); _p.sub(e.group.position);
  const y = e.group.rotation.y, x = _p.x * Math.cos(y) - _p.z * Math.sin(y);
  return x < 0 ? -1 : 1;
}

/* a felled trooper lets go of its blaster: it drops from the hands and clatters down (enemies/defeat.js) */
export function dropRifle(e, dir){
  const u = e.group.userData, R = u.rifle;
  if (!R || gone(R)) return;
  const piece = makePiece(e, R, 'rifle');
  R.userData.cut = true; R.scale.setScalar(1e-4);
  const v = new THREE.Vector3(dir ? dir.x : 0, 0, dir ? dir.z : 0).multiplyScalar(rand(...DEFEAT.drop.push));
  v.y = rand(...DEFEAT.drop.lift);
  launch(piece, 'rifle', v, new THREE.Vector3(rand(-4, 4), rand(-5, 5), rand(-4, 4)));
}

const HOLD = 7, SINK = 1.2;   // seconds a piece lies there, then how long it takes to sink away
const COOL = 2.6, SMOKE = 1.8;   // how long a wound glows, and smokes
export function updateSevered(dt){
  updatePlates(dt);   // the torn-off plates (enemies/marks.js)
  for (let i = pieces.length - 1; i >= 0; i--){
    const P = pieces[i], o = P.o;
    P.t += dt;
    if (!P.rest){
      P.v.y -= 22 * dt;
      o.position.addScaledVector(P.v, dt);
      o.rotation.x += P.spin.x * dt; o.rotation.y += P.spin.y * dt; o.rotation.z += P.spin.z * dt;
      const floor = groundAt(o.position.x, o.position.z, o.position.y + 0.5) + P.floor;
      if (o.position.y <= floor && P.v.y < 0){
        o.position.y = floor;
        if (Math.abs(P.v.y) > 3){ P.v.y *= -0.3; P.v.x *= 0.5; P.v.z *= 0.5; P.spin.multiplyScalar(0.4); if (P.kind === 'rifle') burst(o.position, 0x9a9a9a, 2, 2, 1.5, 0.4); }   // one bounce
        else {
          P.rest = true;
          if (P.kind === 'rifle'){ o.rotation.x = 0; o.rotation.z = Math.PI / 2 * Math.sign(o.rotation.z || 1); }   // on its side
          else if (P.kind !== 'head'){ o.rotation.x = Math.PI / 2 * Math.sign(o.rotation.x || 1); o.rotation.z = 0; }   // lies flat
        }
      }
    }
    if (P.t > HOLD) o.position.y -= dt * 0.5 / SINK;
    if (P.t > HOLD + SINK){ dropPiece(P); pieces.splice(i, 1); }
  }
  // the wounds: hot, then cooling to char, smoking (a droid's sparking) as they go
  for (let i = burns.length - 1; i >= 0; i--){
    const B = burns[i];
    B.t += dt;
    const k = B.t / COOL;
    B.hot.material.opacity = Math.max(0, 1 - k * k);
    if (B.t < SMOKE && B.cap.parent && (B.puff -= dt) <= 0){
      B.puff = B.droid ? rand(0.05, 0.14) : rand(0.09, 0.16);
      B.cap.getWorldPosition(_w);
      if (B.droid){ if (Math.random() < 0.6) sparks(_w, Math.random() < 0.5 ? 0xbfe4ff : 0xffd080, 2, 4, { cone: 1.6, life: 0.22, size: 0.28 }); }
      else burst(_w, Math.random() < 0.3 ? 0xff8a3a : 0x5a5652, 1, 0.4, 1.6, rand(0.35, 0.6));
    }
    if (B.t > COOL || !B.cap.parent){ B.hot.visible = false; B.hot.material.dispose(); burns.splice(i, 1); }
  }
}
function dropPiece(P){
  P.o.traverse(m => { if (m.isSkinnedMesh) m.skeleton.dispose(); });
  if (P.o.parent) P.o.parent.remove(P.o);
}
/* a new arena: clear them all */
export function clearSevered(){
  for (const P of pieces) dropPiece(P); pieces.length = 0;
  for (const B of burns) B.hot.material.dispose(); burns.length = 0;
  clearPlates();
}
