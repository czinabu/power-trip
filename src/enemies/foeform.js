// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FOE FORMS at runtime: which form and rank a saber NPC fights in (data/foe-forms.js), the counter edge between its form
// and the hero's, and the tag over its head that shows both (▲ your form counters it · ▼ its form counters yours).

import * as THREE from 'three';
import { FAMILIES, FORM_FAMILY, FOE_FORM_NAMES, MATCHUP, RANKS, RANK_ORDER, FOE_FORMS, NAMED_FORMS, BOSS_FORM, FORM_SWITCH, CAMPAIGN_RANK_CAP, MASTER_CAP, formEdge, foeProfile } from '../data/foe-forms.js';
import { STANCES } from '../data/stances.js';
import { G, isGunner, enemies } from '../state.js';
import { floater } from '../fx/floaters.js';
import { foeTipToast } from '../game/upgrades.js';
import { V3 } from '../utils.js';

const depth = () => G.endless ? (G.endlessWave || 0) : (G.waveTotal || 0);
const rankUp = (r) => RANK_ORDER[Math.min(RANK_ORDER.length - 1, RANK_ORDER.indexOf(r) + 1)] || r;

// the form a foe type fights in this deep into the run (a pool's tier by depth; the sandbox draws from the deepest)
function pickForm(def){
  if (def.form) return def.form;
  const P = def.pool, d = G.sandbox ? Infinity : depth();
  let tier = P[0];
  for (const t of P) if (d >= t.from) tier = t;
  return tier.forms[(Math.random() * tier.forms.length) | 0];
}
/* a fresh foe of a type that duels with a saber or staff: its form, its rank, and the profile they make (null: not
   one of them, it keeps its type's own profile). An elite fights a rank up. */
export function foeFormFor(e){
  const def = FOE_FORMS[e.type];
  if (!def) return null;
  const d = G.sandbox ? 0 : depth();
  let base = def.rank;
  for (const r of def.ranks || []) if (d >= r.from) base = r.rank;
  const form = (G.sandbox && !def.form && G.sbFoeForm) || pickForm(def);
  const cap = campaignCap();
  if (cap && RANK_ORDER.indexOf(base) > RANK_ORDER.indexOf(cap)) base = cap;   // the campaign's curve (data/foe-forms.js CAMPAIGN_RANK_CAP)
  let rank = (G.sandbox && G.sbFoeRank) || (e.elite ? rankUp(base) : base);   // (the sandbox's picks: ui/sandbox-ui.js)
  if (rank === 'master' && !(G.sandbox && G.sbFoeRank) && mastersOut() >= MASTER_CAP) rank = 'knight';   // one rank-and-file master at a time
  const tier = def.pool ? def.pool.filter(t => (G.sandbox ? Infinity : depth()) >= t.from).pop() : null;
  return { form, rank, profile: foeProfile(form, rank), repertoire: rank === 'master' && tier ? tier.forms.slice() : null };
}
// the campaign's rank ceiling for the rank and file right now (null: none): its wave levels and its mission chapters
function campaignCap(){
  if (G.sandbox || G.endless || (G.mission && !(G.chapter >= 0))) return null;
  return CAMPAIGN_RANK_CAP[Math.min(CAMPAIGN_RANK_CAP.length - 1, G.levelIdx || 0)] || null;
}
// rank-and-file masters standing now (a named champion doesn't count)
const mastersOut = () => enemies.reduce((n, o) => n + (!o.dead && !o.champion && o.rank === 'master' ? 1 : 0), 0);
// a named duellist (game/mission.js spawnInquisitor): the mission's own form wins, else its name's, else its type's
export function namedForm(o, type){
  const N = NAMED_FORMS[o.name] || {}, def = FOE_FORMS[type] || {};
  const form = o.form || N.form || def.form || 'niman';
  const rank = o.rank || N.rank || (o.form ? 'master' : 'knight');
  return { form, rank, profile: foeProfile(form, rank), repertoire: FORM_SWITCH.named[o.name] || null };
}
export function setFoeForm(e, form, rank, repertoire = null){ e.ff = form; e.rank = rank; e.ffRep = repertoire; e.ffPressT = 0; e.ffSwitchAt = -99; }
export function bossForm(b){ const B = BOSS_FORM[b.kind]; if (B) setFoeForm(b, B.form, B.rank, FORM_SWITCH.boss[b.kind] || null); }

/* A MASTER CHANGES FORM (data/foe-forms.js FORM_SWITCH): held in a form that counters its own long enough, it moves to
   one of its repertoire's that counters yours. Its profile changes with it: each number scales by how the new form's
   differs from the old (so a mission's own tuning and a rage stay on top), the form's own keys come and go. Host only:
   the change goes out in the snapshot. */
export function updateFormSwitch(e, dt){
  if (!e.ffRep || e.net || e.dead || isGunner()) return;
  e.ffPressT = edgeOn(e) > 0 ? (e.ffPressT || 0) + dt : 0;
  if (e.ffPressT < FORM_SWITCH.after || G.gt - e.ffSwitchAt < FORM_SWITCH.cd) return;
  const opts = e.ffRep.filter(f => f !== e.ff && formEdge(f, G.stance) > 0);
  if (!opts.length){ e.ffPressT = 0; return; }
  const nf = opts[(Math.random() * opts.length) | 0];
  if (e.dp){
    const a = foeProfile(e.ff, e.rank), b = foeProfile(nf, e.rank);
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])){
      if (!(k in b)){ delete e.dp[k]; continue; }
      if (typeof b[k] === 'number' && typeof a[k] === 'number' && a[k] && typeof e.dp[k] === 'number') e.dp[k] = e.dp[k] * b[k] / a[k];
      else e.dp[k] = b[k];
    }
    e.flourishNext = G.gt;   // it resets its stance with a twirl (enemies/duel.js flourish)
    e.strI = null;           // and starts its new form's string
  }
  e.ff = nf; e.ffPressT = 0; e.ffSwitchAt = G.gt;
  const p = e.group.position;
  floater(V3(p.x, p.y + 2.6 * e.group.scale.y, p.z), 'CHANGES STANCE', '#ffb35a');   // (the badge shows to what)
}

// your edge on this foe: +1 your form counters its form, −1 its form counters yours, 0 even (the Mando: always even)
export const edgeOn = (e) => (e && e.ff && !isGunner()) ? formEdge(G.stance, e.ff) : 0;
/* can the hero answer this form right now: a form in the loadout (1 / 2 / 3) that counters it? The wrong form only
   costs you when you had the right one to hand: a hero with only Shii-Cho is never punished for not switching */
export const canCounter = (ff) => (G.loadout || []).some(id => id && formEdge(id, ff) > 0);
export const matchup = (e) => { const k = edgeOn(e); return k > 0 ? MATCHUP.win : k < 0 && canCounter(e.ff) ? MATCHUP.lose : MATCHUP.even; };
// × your saber's damage on it
export const edgeMul = (e) => matchup(e).dmg;
// the chance its sealed guard holds against your cut (its rank's seal, less when your form counters it)
export const sealOf = (e) => ((e.dp && e.dp.seal != null) ? e.dp.seal : (RANKS[e.rank] && RANKS[e.rank].seal) ?? 1) * matchup(e).seal;

export const formName = (f) => (STANCES[f] && STANCES[f].name.split(' —')[0]) || (FOE_FORM_NAMES[f] && FOE_FORM_NAMES[f].name) || (f || '').toUpperCase();

/* THE GUARD CRESCENT'S COLOUR (enemies/duel.js): its form's family (FAMILIES: POWER orange, GUARD blue, SPEED green), so
   a guard reads before the tag does; Niman, the Mandalorian's foes and anything formless keep the pale crescent. When it
   has read your cut it runs white-hot and pulses. */
const ARC_PALE = new THREE.Color(0xfff0c8), ARC_HOT = new THREE.Color(0xffffff), ARC = new THREE.Color(), FAM_COL = {};
export function arcColor(e, read){
  const f = FORM_FAMILY[e && e.ff];
  const base = f ? (FAM_COL[f] || (FAM_COL[f] = new THREE.Color(FAMILIES[f].color))) : ARC_PALE;
  if (!read) return ARC.copy(base);
  return ARC.copy(base).lerp(ARC_HOT, 0.45 + 0.35 * Math.sin(G.gt * 18));
}

/* ---------------- the badge over its head ----------------
   No words: one icon for its form's FAMILY in the family's colour (SPEED a double chevron, POWER a burst, GUARD a
   shield; Niman, outside the triangle, a plain ring), its RANK as pips underneath (I to IV), and the counter edge as
   the badge's rim: green with a ▲ when your form counters it, red with a ▼ when its form counters yours. */
const W = 128, H = 128;
export function familyIcon(x, fam, cx, cy, r, color){
  x.save(); x.translate(cx, cy); x.fillStyle = color; x.strokeStyle = color; x.lineJoin = 'round'; x.lineCap = 'round';
  if (fam === 'speed'){   // two forward chevrons
    x.lineWidth = r * 0.28;
    for (const dx of [-0.38, 0.22]){ x.beginPath(); x.moveTo((dx - 0.22) * r, -0.55 * r); x.lineTo((dx + 0.25) * r, 0); x.lineTo((dx - 0.22) * r, 0.55 * r); x.stroke(); }
  } else if (fam === 'power'){   // an eight-point impact burst
    x.beginPath();
    for (let i = 0; i < 16; i++){ const a = -Math.PI / 2 + i * Math.PI / 8, rr = (i % 2 ? 0.36 : 0.78) * r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    x.closePath(); x.fill();
  } else if (fam === 'guard'){   // a shield
    x.beginPath(); x.moveTo(0, -0.72 * r); x.lineTo(0.6 * r, -0.48 * r); x.lineTo(0.56 * r, 0.08 * r);
    x.quadraticCurveTo(0.42 * r, 0.52 * r, 0, 0.78 * r); x.quadraticCurveTo(-0.42 * r, 0.52 * r, -0.56 * r, 0.08 * r);
    x.lineTo(-0.6 * r, -0.48 * r); x.closePath(); x.fill();
  } else {   // balanced: a ring
    x.lineWidth = r * 0.22; x.beginPath(); x.arc(0, 0, 0.5 * r, 0, Math.PI * 2); x.stroke();
  }
  x.restore();
}
function draw(tag, e, k){
  const c = tag.userData.canvas, x = c.getContext('2d');
  const famId = FORM_FAMILY[e.ff], fam = FAMILIES[famId], R = RANKS[e.rank];
  const rim = k > 0 ? '#5dff8a' : k < 0 ? '#ff5a4a' : 'rgba(220,226,236,0.35)';
  x.clearRect(0, 0, W, H);
  const cx = W / 2, cy = 52, r = 38;
  x.fillStyle = 'rgba(10,12,18,0.7)'; x.beginPath(); x.arc(cx, cy, r + 4, 0, Math.PI * 2); x.fill();
  x.lineWidth = k ? 6 : 3; x.strokeStyle = rim; x.beginPath(); x.arc(cx, cy, r + 2, 0, Math.PI * 2); x.stroke();
  familyIcon(x, famId, cx, cy, r * 0.78, fam ? fam.color : '#cfd6e0');
  // the edge mark on the rim: ▲ you counter it, ▼ it counters you
  if (k){
    const ty = k > 0 ? cy - r - 2 : cy - r - 2;
    x.fillStyle = rim; x.beginPath();
    if (k > 0){ x.moveTo(cx, ty - 10); x.lineTo(cx + 10, ty + 6); x.lineTo(cx - 10, ty + 6); }
    else { x.moveTo(cx, ty + 8); x.lineTo(cx + 10, ty - 8); x.lineTo(cx - 10, ty - 8); }
    x.closePath(); x.fill();
  }
  // rank pips
  const n = R ? RANK_ORDER.indexOf(e.rank) + 1 : 0, gap = 15;
  for (let i = 0; i < n; i++){
    const px = cx + (i - (n - 1) / 2) * gap, py = cy + r + 16;
    x.fillStyle = 'rgba(10,12,18,0.7)'; x.beginPath(); x.arc(px, py, 6.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#f1ece0'; x.beginPath(); x.arc(px, py, 4.2, 0, Math.PI * 2); x.fill();
  }
  tag.material.map.needsUpdate = true;
}
function makeTag(e){
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  s.scale.set(0.7, 0.7 * H / W, 1); s.renderOrder = 999;
  s.userData.canvas = c;
  s.raycast = () => {};   // a label, not a body: the camera's see-through, aim and hit rays pass straight through it
  e.group.add(s); e.formTag = s;
  return s;
}
/* show (or hide) a foe's form tag; `y` is how high over its feet (in its own scale). The first time the hero meets a
   foe with a form, a tip explains the triangle; switching into the counter form calls it out. */
export function updateFormTag(e, show, y = 2.35){
  if (!e.ff) return;
  if (!show){ if (e.formTag) e.formTag.visible = false; return; }
  const t = e.formTag || makeTag(e), k0 = edgeOn(e), k = k0 < 0 && !canCounter(e.ff) ? 0 : k0, key = e.ff + e.rank + k;
  t.visible = true;
  t.position.set(0, y, 0);
  if (t.userData.key !== key){
    const was = t.userData.edge;
    t.userData.key = key; t.userData.edge = k;
    draw(t, e, k);
    if (was != null && k > 0 && was <= 0){ const p = e.group.position; floater(V3(p.x, p.y + y * e.group.scale.y + 0.3, p.z), 'COUNTER FORM', '#5dff8a'); }
  }
  if (!isGunner() && !(G.seenTypes && G.seenTypes.__forms) && G.mode === 'play'){
    if (!G.seenTypes) G.seenTypes = {};
    G.seenTypes.__forms = true;
    if (!G.training) foeTipToast('FORMS COUNTER FORMS', 'The badge over a duellist is its form: chevrons SPEED, a burst POWER, a shield GUARD (pips: its rank). POWER breaks GUARD, GUARD outlasts SPEED, SPEED outpaces POWER. A green ▲ rim: your form counters it. Red ▼: switch (1 / 2 / 3).');
  }
}
export function hideFormTag(e){ if (e.formTag) e.formTag.visible = false; }
