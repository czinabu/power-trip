// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FOE FORMS at runtime: which form and rank a saber NPC fights in (data/foe-forms.js), the counter edge between its form
// and the hero's, and the tag over its head that shows both (▲ your form counters it · ▼ its form counters yours).

import * as THREE from 'three';
import { FAMILIES, FORM_FAMILY, FOE_FORM_NAMES, MATCHUP, RANKS, RANK_ORDER, FOE_FORMS, NAMED_FORMS, BOSS_FORM, formEdge, foeProfile } from '../data/foe-forms.js';
import { STANCES } from '../data/stances.js';
import { G, isGunner } from '../state.js';
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
  const form = pickForm(def), rank = e.elite ? rankUp(def.rank) : def.rank;
  return { form, rank, profile: foeProfile(form, rank) };
}
// a named duellist (game/mission.js spawnInquisitor): the mission's own form wins, else its name's, else its type's
export function namedForm(o, type){
  const N = NAMED_FORMS[o.name] || {}, def = FOE_FORMS[type] || {};
  const form = o.form || N.form || def.form || 'niman';
  const rank = o.rank || N.rank || (o.form ? 'master' : 'knight');
  return { form, rank, profile: foeProfile(form, rank) };
}
export function setFoeForm(e, form, rank){ e.ff = form; e.rank = rank; }
export function bossForm(b){ const B = BOSS_FORM[b.kind]; if (B) setFoeForm(b, B.form, B.rank); }

// your edge on this foe: +1 your form counters its form, −1 its form counters yours, 0 even (the Mando: always even)
export const edgeOn = (e) => (e && e.ff && !isGunner()) ? formEdge(G.stance, e.ff) : 0;
export const matchup = (e) => { const k = edgeOn(e); return k > 0 ? MATCHUP.win : k < 0 ? MATCHUP.lose : MATCHUP.even; };
// × your saber's damage on it
export const edgeMul = (e) => matchup(e).dmg;
// the chance its sealed guard holds against your cut (its rank's seal, less when your form counters it)
export const sealOf = (e) => ((e.dp && e.dp.seal != null) ? e.dp.seal : (RANKS[e.rank] && RANKS[e.rank].seal) ?? 1) * matchup(e).seal;

export const formName = (f) => (STANCES[f] && STANCES[f].name.split(' —')[0]) || (FOE_FORM_NAMES[f] && FOE_FORM_NAMES[f].name) || (f || '').toUpperCase();

/* ---------------- the tag over its head ---------------- */
const W = 320, H = 72;
function draw(tag, e, k){
  const c = tag.userData.canvas, x = c.getContext('2d');
  const fam = FAMILIES[FORM_FAMILY[e.ff]], R = RANKS[e.rank];
  const edge = k > 0 ? '#5dff8a' : k < 0 ? '#ff5a4a' : 'rgba(220,226,236,0.55)';
  x.clearRect(0, 0, W, H);
  x.fillStyle = 'rgba(10,12,18,0.72)';
  x.beginPath(); x.roundRect(4, 8, W - 8, H - 16, 12); x.fill();
  x.lineWidth = k ? 4 : 2; x.strokeStyle = edge; x.stroke();
  x.textBaseline = 'middle';
  // the edge: ▲ you counter it · ▼ it counters you
  x.fillStyle = edge; x.font = '700 30px "Barlow Condensed","Arial Narrow",sans-serif'; x.textAlign = 'left';
  x.fillText(k > 0 ? '▲' : k < 0 ? '▼' : '•', 16, H / 2 + 1);
  x.fillStyle = '#f1ece0'; x.font = '700 30px "Barlow Condensed","Arial Narrow",sans-serif';
  const name = formName(e.ff) + (R ? '  ' + R.no : '');
  x.fillText(name, 46, H / 2 + 1);
  if (fam){
    x.font = '600 20px "Barlow Condensed","Arial Narrow",sans-serif'; x.textAlign = 'right'; x.fillStyle = fam.color;
    x.fillText(fam.name, W - 18, H / 2 + 1);
  }
  tag.material.map.needsUpdate = true;
}
function makeTag(e){
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  s.scale.set(2.1, 2.1 * H / W, 1); s.renderOrder = 999;
  s.userData.canvas = c;
  e.group.add(s); e.formTag = s;
  return s;
}
/* show (or hide) a foe's form tag; `y` is how high over its feet (in its own scale). The first time the hero meets a
   foe with a form, a tip explains the triangle; switching into the counter form calls it out. */
export function updateFormTag(e, show, y = 2.85){
  if (!e.ff) return;
  if (!show){ if (e.formTag) e.formTag.visible = false; return; }
  const t = e.formTag || makeTag(e), k = edgeOn(e), key = e.ff + e.rank + k;
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
    if (!G.training) foeTipToast('FORMS COUNTER FORMS', 'POWER breaks GUARD · GUARD outlasts SPEED · SPEED outpaces POWER. ▲ over a duellist: your form counters it. ▼: switch (1 / 2 / 3).');
  }
}
export function hideFormTag(e){ if (e.formTag) e.formTag.visible = false; }
