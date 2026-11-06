// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE OPEN ZONE'S PEOPLE (data/zone-jedha.js QUESTS): somebody in the streets who needs a hand, and somebody caught in a
// moment that tests which way you lean. Walk up to one and tap F.
//
//   · A QUEST: they say what they need on the comms strip, and it begins (one at a time). Its steps are on the HUD and
//     the compass points the way: walk somewhere, tap F at a few things (lamps to light, a box to carry), beat the foes
//     waiting somewhere, then back to whoever asked. Done, it counts as a side mission won (game/profile.js noteSideWon:
//     rank XP, the workbench's side-mission parts), and its light-or-dark choice is asked, once (game/alignment.js).
//   · A MOMENT: no steps, only the choice, asked there and then.
//   Your profile keeps what you've done (game/profile.js noteZone 'quests'), so a giver thanks you on a later visit.
//
// CO-OP: the party shares one quest at a time and the host keeps it: a guest's F at a giver or a lamp is sent to the
// host, the host's quest (its step, what's been taken) is sent to every guest, and every hero's walking counts for a
// `go`. The host sends the foes (game/zone-fights.js). When it's done, each screen counts it on its own profile and asks
// its own choice (its own meter). A moment is each player's own.

import * as THREE from 'three';
import { G, shared, enemies, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { heroFigure, stepFigure } from './cast.js';
import { slim } from '../world/arenas/tython-folk.js';
import { settleCloth } from '../player/model/cloth.js';
import { groundAt } from '../world/collision.js';
import { navNearestOpen } from '../enemies/nav.js';
import { onInteract, INTERACT_KEY } from './interact.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { comms } from './story.js';
import { askChoice } from './campaign.js';
import { sideChoice, sideChoiceDue } from './alignment.js';
import { noteSideWon, noteZone, zoneMemo } from './profile.js';
import { sendQuestFoes } from './zone-fights.js';
import { partnerStand } from '../net/partner.js';
import { net, on, send, connected } from '../net/session.js';
import { showBanner } from '../ui/banners.js';
import { floater } from '../fx/floaters.js';
import { burst } from '../fx/particles.js';
import { S, sfx } from '../audio/sfx.js';
import { V3 } from '../utils.js';
import { qualityLevel } from '../engine/quality.js';

export const QUEST_TUNE = {
  talk: 2.8,      // m: close enough to a giver to talk
  reach: 2.4,     // m: close enough to a thing to take it
  wake: 34,       // m: a `clear` step's foes are there once a hero comes this close
  show: { low: 36, medium: 48, high: 56 },   // m: a giver further than this isn't drawn (by quality: phones draw fewer)
  live: { low: 16, medium: 26, high: 30 },   // m: ...and further than this stands still (its face, cloth and breath rest)
};
const Q = { key: null, Z: null, life: null, level: null, people: [], things: [], act: null, near: null, shownKey: '', syncT: 0 };
let el = null;
const prompt = () => el || (el = document.getElementById('zoneqp'));
const sideId = (id) => 'zone:' + Q.key + ':' + id;
const questOf = (id) => Q.life && Q.life.quests.find(q => q.id === id);
const done = (id) => !!(Q.key && (zoneMemo(Q.key).quests || {})[id]);
const host = () => net.role !== 'guest' || !connected();   // (solo, or the host: this screen keeps the quest)
export const zoneQuest = () => Q.act ? { id: Q.act.id, i: Q.act.i, got: Q.act.got.slice() } : null;   // (tests)
export const zoneGivers = () => Q.people.map(p => ({ id: p.q.id, x: p.x, z: p.z, done: done(p.q.id) }));   // (tests)

/* into a zone (game/zone.js startZone): its people stand where they stand; they're built as a hero first comes near */
export function startZoneQuests(key, Z){
  dropAll();
  Q.key = key; Q.Z = Z; Q.life = Z.life || null; Q.level = shared.arenaLevel; Q.act = null; Q.near = null; Q.shownKey = '';
  if (!Q.life) return;
  hookUp();
  const out = { x: 0, z: 0 };
  for (const q of Q.life.quests){
    const [x, z] = q.giver.at;
    if (!navNearestOpen(x, z, 0, 6, out)){ out.x = x; out.z = z; }
    Q.people.push({ q, x: out.x, z: out.z, F: null, talkT: 0 });
  }
}
function dropAll(){
  for (const p of Q.people) if (p.F && p.F.g.parent) p.F.g.parent.remove(p.F.g);
  for (const t of Q.things) if (t.g.parent) t.g.parent.remove(t.g);
  Q.people = []; Q.things = []; Q.act = null;
}
export function stopZoneQuests(){ dropAll(); Q.Z = null; Q.life = null; const e = prompt(); if (e) e.classList.remove('on'); Q.shownKey = ''; }

/* ---------------- the people ---------------- */
function build(p){
  const target = heroFigure({ kind: 'hero', as: 'jedi', look: { jedi: p.q.giver.look } });
  slim(target);
  const F = { g: target.group, target, kind: 'hero', own: true, scale: 1, walk: null, talk: false, look: null, t: Math.random() * 10, gest: 0, turn: 0 };
  F.g.position.set(p.x, groundAt(p.x, p.z, 3), p.z); F.g.rotation.y = p.q.giver.face || 0;
  shared.arenaGroup.add(F.g);
  stepFigure(F, 0); target.vis.updateWorldMatrix(true, true); settleCloth(target, 1);
  p.F = F;
}

/* ---------------- the things a step asks for: a lamp to light, a box to carry ---------------- */
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c });
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.95 });
function thing(step, at, k){
  const lamp = /LAMP/.test(step.name), g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, lamp ? 1.1 : 0.7, 8), stoneMat);
  base.position.y = lamp ? 0.55 : 0.35; g.add(base);
  const orb = new THREE.Mesh(lamp ? new THREE.SphereGeometry(0.2, 10, 8) : new THREE.OctahedronGeometry(0.24), glowMat(lamp ? 0x6a5a44 : 0x8ad8ff));
  orb.position.y = lamp ? 1.28 : 0.98; g.add(orb);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 8, 1, true), new THREE.MeshBasicMaterial({ color: lamp ? 0xffc070 : 0x8ad8ff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = 3.5; g.add(beam);
  const out = { x: 0, z: 0 };
  if (!navNearestOpen(at[0], at[1], 0, 5, out)){ out.x = at[0]; out.z = at[1]; }
  g.position.set(out.x, groundAt(out.x, out.z, 2), out.z);
  shared.arenaGroup.add(g);
  return { k, x: out.x, z: out.z, g, orb, beam, lamp, taken: false };
}
function showThings(){
  for (const t of Q.things) if (t.g.parent) t.g.parent.remove(t.g);
  Q.things = [];
  const a = Q.act, s = a && questOf(a.id).steps[a.i];
  if (!s || s.kind !== 'take') return;
  s.at.forEach((at, k) => { const t = thing(s, at, k); Q.things.push(t); if (a.got.includes(k)) mark(t, s); });
}
function mark(t, s){
  t.taken = true; t.beam.visible = false;
  if (t.lamp) t.orb.material.color.setHex(0xffd890);   // lit, and it stays lit
  else t.g.visible = false;
}

/* ---------------- a quest's run ---------------- */
function begin(q){
  Q.act = { id: q.id, i: 0, got: [], foes: null };
  heard(q);
  enter();
  tell();
}
// what the giver says as it begins (each screen its own)
function heard(q){
  comms({ who: q.giver.name, say: q.ask }, { remote: true });
  showBanner(q.title, (q.steps[0] || {}).task || '', 2.6, { kicker: 'SIDE QUEST · ' + q.kicker });
  const p = Q.people.find(p => p.q === q); if (p) p.talkT = 4;
  S.reward && S.reward(1);
}
function enter(){ Q.act.foes = null; showThings(); }
function next(){
  const a = Q.act, q = questOf(a.id);
  a.i++; a.got = [];
  if (a.i >= q.steps.length) return finish(q);
  enter();
  const s = q.steps[a.i];
  showBanner('', s.task, 2.0);
  sfx(660, 0.25, 'sine', 0.03, 990);
  tell();
}
function finish(q){
  Q.act = null; showThings();
  if (host() && connected()) send({ t: 'zqd', id: q.id });
  tell();
  complete(q);
}
// done, on this screen: counted on this hero's profile, thanked, and its choice asked (once)
function complete(q){
  noteZone(Q.key, 'quests', q.id);
  noteSideWon(sideId(q.id));
  const p = Q.people.find(p => p.q === q); if (p) p.talkT = 4;
  comms({ who: q.giver.name, say: q.done }, { remote: true });
  showBanner('SIDE QUEST COMPLETE', q.title + (q.reward ? ' · ' + q.reward : ''), 2.8);
  const at = playerPos(); floater(V3(at.x, at.y + 2.2, at.z), '+RANK XP', '#ffd24a');
  S.reward && S.reward(1);
  if (q.choice && sideChoiceDue(sideId(q.id), q.choice)) setTimeout(() => ask(q), 2200);
}
function ask(q){
  if (!G.zone || G.mode !== 'play') return;
  askChoice({ kicker: 'SIDE QUEST · A CHOICE', title: q.choice.title, lines: q.choice.lines, who: q.giver.name, options: q.choice.options, hint: 'Light or dark: it moves your own meter. It is asked once.' },
    (k) => { sideChoice(sideId(q.id), q.choice, k); const o = q.choice.options.find(o => o.key === k); if (o) showBanner('', o.line, 3.2); }, true);
}
// a moment: the choice, there and then
function moment(q){
  const p = Q.people.find(p => p.q === q); if (p) p.talkT = 3;
  askChoice({ kicker: q.kicker, title: q.choice.title, lines: [q.ask, ...q.choice.lines], who: q.giver.name, options: q.choice.options, hint: 'Light or dark: it moves your own meter. It is asked once.' },
    (k) => {
      sideChoice(sideId(q.id), q.choice, k); noteZone(Q.key, 'quests', q.id);
      const o = q.choice.options.find(o => o.key === k); if (o) showBanner('', o.line, 3.2);
    }, true);
}

/* ---------------- F ---------------- */
// what F does here now: { kind: 'giver' | 'thing', p | t }
function pick(){
  if (G.paused || G.skillSelect || G.cutscene || player.downed || !Q.life) return null;
  const me = playerPos();
  for (const t of Q.things) if (!t.taken && Math.hypot(t.x - me.x, t.z - me.z) < QUEST_TUNE.reach) return { kind: 'thing', t };
  let best = null, bd = QUEST_TUNE.talk;
  for (const p of Q.people){ const d = Math.hypot(p.x - me.x, p.z - me.z); if (d < bd){ bd = d; best = p; } }
  return best ? { kind: 'giver', p: best } : null;
}
function words(n){
  if (n.kind === 'thing'){ const s = questOf(Q.act.id).steps[Q.act.i]; return s.verb || 'TAKE IT'; }
  const q = n.p.q;
  if (q.moment) return done(q.id) ? 'TALK' : 'A MOMENT · ' + q.title;
  if (Q.act && Q.act.id === q.id) return questOf(q.id).steps[Q.act.i].kind === 'back' ? 'TELL THEM IT\'S DONE' : 'TALK';
  if (Q.act) return 'TALK';
  return done(q.id) ? 'TALK' : 'SIDE QUEST · ' + q.title;
}
// a tap on this screen: the host's acts on it, a guest's asks the host
function tap(n){
  if (n.kind === 'thing'){ if (host()) took(n.t.k); else send({ t: 'zqf', id: Q.act.id, i: Q.act.i, k: n.t.k }); return; }
  const q = n.p.q;
  if (q.moment){
    if (!done(q.id) && sideChoiceDue(sideId(q.id), q.choice)) return moment(q);
    return chat(n.p, q.ask);
  }
  if (Q.act && Q.act.id === q.id){
    if (questOf(q.id).steps[Q.act.i].kind !== 'back') return chat(n.p, (questOf(q.id).steps[Q.act.i] || {}).task + '.');
    if (host()) next(); else send({ t: 'zqf', id: q.id, i: Q.act.i, k: -1 });
    return;
  }
  if (Q.act) return chat(n.p, 'Come back when you are free, traveller. Somebody else needs you first.');
  if (done(q.id) && host()) return chat(n.p, q.done);
  if (host()) begin(q); else send({ t: 'zqf', id: q.id, i: -1, k: -1 });
}
function chat(p, line){ p.talkT = 3; comms({ who: p.q.giver.name, say: line }, { remote: true, front: true }); }
function took(k){
  const a = Q.act, s = a && questOf(a.id).steps[a.i];
  if (!s || s.kind !== 'take' || a.got.includes(k) || k < 0 || k >= s.at.length) return;
  a.got.push(k);
  const t = Q.things.find(t => t.k === k);
  if (t){ mark(t, s); burst(V3(t.x, t.g.position.y + 1.2, t.z), t.lamp ? 0xffd890 : 0x8ad8ff, 18, 3, 3, 0.7); }
  S.reward && S.reward(1);
  if (a.got.length >= s.at.length) next();
  else { showBanner('', s.task + ' · ' + a.got.length + ' / ' + s.at.length, 1.4); tell(); }
}

let hooked = false;
function hookUp(){
  if (hooked) return; hooked = true;
  onInteract(() => { if (!G.zone || !Q.near) return false; tap(Q.near); return true; }, () => !!G.zone && !!Q.near);
}

/* ---------------- co-op ---------------- */
// the host's quest, to every guest (on a change, and now and then for one who just came in)
function tell(){ if (net.role === 'host' && connected()) send({ t: 'zq', a: Q.act ? { id: Q.act.id, i: Q.act.i, got: Q.act.got } : null }); }
on('zq', (m) => {
  if (net.role !== 'guest' || !G.zone || !Q.life) return;
  const a = m.a, was = Q.act;
  if (!a){ if (was){ Q.act = null; showThings(); } return; }
  const q = questOf(a.id); if (!q) return;
  if (!was || was.id !== a.id){ Q.act = { id: a.id, i: a.i, got: [...a.got], foes: null }; heard(q); showThings(); return; }
  if (was.i !== a.i){ was.i = a.i; was.got = [...a.got]; showThings(); showBanner('', (q.steps[a.i] || {}).task || '', 2.0); return; }
  if (a.got.length !== was.got.length){ was.got = [...a.got]; const s = q.steps[a.i]; for (const t of Q.things) if (was.got.includes(t.k) && !t.taken) mark(t, s); }
});
on('zqd', (m) => { if (net.role !== 'guest' || !G.zone || !Q.life) return; const q = questOf(m.id); Q.act = null; showThings(); if (q) complete(q); });
on('zqf', (m) => {   // a guest's tap, at the host
  if (net.role !== 'host' || !G.zone || !Q.life) return;
  const q = questOf(m.id); if (!q || q.moment) return;
  if (m.i < 0){ if (!Q.act) begin(q); return; }
  if (!Q.act || Q.act.id !== m.id || Q.act.i !== m.i) return;
  const s = q.steps[m.i];
  if (s.kind === 'back' && m.k < 0) next();
  else if (s.kind === 'take') took(m.k);
});

/* ---------------- once a frame (game/zone.js updateZone) ---------------- */
export function updateZoneQuests(dt){
  const e = prompt();
  if (!G.zone || G.mode !== 'play' || !Q.life || shared.arenaLevel !== Q.level){ if (e && Q.shownKey){ e.classList.remove('on'); Q.shownKey = ''; } return; }
  const me = playerPos();
  // the people: built as a hero first comes near (one a frame), drawn only near, and turned to the hero who's close
  let built = false;
  const q = qualityLevel(), far = QUEST_TUNE.show[q] || QUEST_TUNE.show.medium, live = QUEST_TUNE.live[q] || QUEST_TUNE.live.medium;
  for (const p of Q.people){
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (!p.F){ if (!built && d < far + 8){ build(p); built = true; } else continue; }
    const F = p.F, show = d < far;
    F.g.visible = show;
    if (!show || dt <= 0) continue;
    p.talkT = Math.max(0, p.talkT - dt); F.talk = p.talkT > 0;
    F.look = d < 9 ? { x: me.x, z: me.z } : null;
    if (d < live) stepFigure(F, dt);
  }
  for (const t of Q.things) if (!t.taken) t.orb.rotation.y += dt * 1.6;
  if (host() && Q.act && dt > 0) stepQuest(dt);
  if (host() && net.role === 'host' && connected() && (Q.syncT -= dt) <= 0){ Q.syncT = 2.5; tell(); }
  // the prompt
  Q.near = pick();
  const words_ = Q.near ? words(Q.near) : '', key = Q.near ? words_ + (pad.active ? ':pad' : '') : '';
  if (e && key !== Q.shownKey){
    Q.shownKey = key;
    if (Q.near) e.innerHTML = '<kbd>' + (pad.active ? padKeys(INTERACT_KEY) : INTERACT_KEY) + '</kbd><span>' + words_ + '</span>';
    e.classList.toggle('on', !!Q.near);
  }
}
// the host's (or a solo hero's) quest moves on: a place reached, the foes beaten
function stepQuest(){
  const a = Q.act, q = questOf(a.id), s = q.steps[a.i];
  const H = [playerPos(), ...(net.role === 'host' && connected() ? partnerStand().map(P => P.pos) : [])];
  const near = (at, r) => H.some(h => Math.hypot(h.x - at[0], h.z - at[1]) < r);
  if (s.kind === 'go'){ if (near(s.at, s.r || 6)) next(); return; }
  if (s.kind === 'clear'){
    if (!a.foes){ if (near(s.at, QUEST_TUNE.wake)) a.foes = sendQuestFoes(a.id, s.foes, s.at); return; }
    if (!enemies.some(e => e.zq === a.id && !e.dead)) next();
  }
}

/* the HUD's line and the compass's marks (ui/hud.js, game/zone.js zoneMarks) */
export function zoneQuestHud(){
  const a = Q.act, q = a && questOf(a.id);
  if (!q) return null;
  const s = q.steps[a.i], n = s.kind === 'take' ? ' · ' + a.got.length + ' / ' + s.at.length : s.kind === 'clear' && a.foes ? ' · ' + enemies.filter(e => e.zq === a.id && !e.dead).length + ' LEFT' : '';
  return { kicker: 'SIDE QUEST · ' + q.kicker, title: q.title, status: s.task.toUpperCase() + n + ' · STEP ' + (a.i + 1) + ' / ' + q.steps.length };
}
export function zoneQuestMarks(){
  const out = [];
  if (!Q.life) return out;
  const a = Q.act, q = a && questOf(a.id), s = q && q.steps[a.i];
  if (s){
    if (s.kind === 'back'){ const p = Q.people.find(p => p.q === q); if (p) out.push({ x: p.x, z: p.z, kind: 'obj' }); }
    else if (s.kind === 'take'){ for (const t of Q.things) if (!t.taken) out.push({ x: t.x, z: t.z, kind: 'obj' }); }
    else out.push({ x: s.at[0], z: s.at[1], kind: 'obj' });
  }
  for (const p of Q.people) if (!done(p.q.id) && (!a || a.id !== p.q.id)) out.push({ x: p.x, z: p.z, kind: 'spot', label: p.q.giver.name });
  return out;
}
