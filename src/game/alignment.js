// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIGHT AND DARK, in play (the words and numbers: data/alignment.js; the meter itself lives on the profile: game/profile.js
// shiftAlign). This file is what moves it and what shows it:
//   · MERCY: a beaten duellist YIELDS (enemies/damage.js calls foeBeaten): it throws its blade down, kneels and stays there
//     a few seconds (the 'yield' state, enemies/ai.js). Tap F beside it to SPARE it (it bows out of the fight, beaten:
//     enemies/damage.js spareEnemy), or strike it down while it kneels (foeFell). Either moves the meter, a little,
//     capped per visit. Every hero, every mode with duellists in it; the meter only moves in real fights.
//   · CHOICES: the story's choices and the side missions' (alignChoice, sideChoice), from game/campaign.js and
//     game/mission.js.
//   · THE CAST: what people say once you lean (alignLines, read by game/talk.js).
//   · THE LOOK: the Jedi's eyes and skin take the side you lean to (gold and sallow, or clear), on your hero and on a
//     co-op partner's (their profile card carries their meter).
//   · CO-OP: the host owns the foes, so a guest's spare goes to the host and the host tells that guest how its mercy
//     landed; each player's own meter is their own. The host's story choice is the story's; when the host is asked, the
//     guests are asked too (askGuests), and their pick moves only their own meter.

import * as THREE from 'three';
import { G, shared, enemies, player } from '../state.js';
import { playerPos } from '../player/helpers.js';
import { MERCY, CHOICE_WEIGHT, SIDE_WEIGHT, ALIGN, ALIGN_TALK, ALIGN_WORDS } from '../data/alignment.js';
import { shiftAlign, leanOf, alignOf, noteMercy, profileOf, onAlign, noteSidePick, sidePicked } from './profile.js';
import { onInteract, INTERACT_KEY } from './interact.js';
import { pad, padKeys } from '../engine/gamepad.js';
import { floater } from '../fx/floaters.js';
import { burst } from '../fx/particles.js';
import { scene } from '../engine/renderer.js';
import { S } from '../audio/sfx.js';
import { showBanner } from '../ui/banners.js';
import { upToast } from './upgrades.js';
import { net, on, send, sendTo, connected } from '../net/session.js';
import { spareEnemy } from '../enemies/damage.js';
import { dropToken } from '../enemies/director.js';
import { partnerCards, partnerPuppet } from '../net/partner.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const weapon = (e) => { const u = e.group && e.group.userData; return u ? u.saber || u.staff || null : null; };

/* ---------------- MERCY ---------------- */
// set by net/foes.js while it applies a co-op guest's blows on the host: a kill then is the guest's, not the host's
export const MERC = { guest: false };
const visit = { key: null, moved: 0 };
const props = [];   // the blades thrown down: { e, prop, node }

// a blow left this foe beaten (enemies/damage.js): a duellist yields, once, if it holds a blade it can throw down
export function foeBeaten(e){
  if (e.yielded || e.dead || e.net || !e.dp || e.converted || e.sparring || e.hpFloor || e.dmgRule || e.fin || e.warbringer || e.disarm) return;
  if (!e.maxHp || e.hp >= e.maxHp * MERCY.yieldAt || G.training || G.hub) return;
  const w = weapon(e);
  if (!w || !w.visible) return;
  e.yielded = true; e.yielding = true;
  e.state = 'yield'; e.st = MERCY.yieldTime; e.kneel = 0;
  e.exch = null; e.rallyT = 0; e.counterQueued = false; e.plan = null; e.windup = null;
  if (e.token) dropToken(e, true);
  // the blade, thrown down at its feet (a copy lies there; the one in the hand is hidden until it takes it back)
  w.updateWorldMatrix(true, true);
  const prop = w.clone(true), g = e.group;
  w.getWorldPosition(prop.position); w.getWorldScale(prop.scale);
  const yaw = g.rotation.y + (Math.random() - 0.5) * 0.8;
  prop.position.set(g.position.x + Math.sin(yaw) * 0.9, g.position.y + 0.06, g.position.z + Math.cos(yaw) * 0.9);
  prop.rotation.set(Math.PI / 2, 0, yaw + Math.PI / 2);
  scene.add(prop); w.visible = false;
  props.push({ e, prop, node: w });
  floater(V(g.position.x, g.position.y + 2.1, g.position.z), 'YIELDS', '#cfe6ff');
  S.clash && S.clash(prop.position, false);
  // the first time ever, say what it means
  const p = profileOf();
  if (!p.mercyTold && !G.coopGuest){ p.mercyTold = 1; showBanner('IT YIELDS', 'Tap ' + INTERACT_KEY + ' beside it to spare it, or strike it down. Light or dark: your choice.', 3.4, { kicker: 'MERCY' }); }
}
// a foe fell (enemies/damage.js): struck down while it knelt is a dark deed (a squadmate's shot is nobody's)
export function foeFell(e, byAlly){
  if (!e.yielding) return;
  e.yielding = false;
  if (byAlly || e.net) return;
  if (MERC.guest){ MERC.struck = true; return; }   // (net/foes.js tells the guest who did it)
  mercyDeed('strike', e.group.position);
}
// one deed's worth on this hero's meter, capped per visit to a fight
function mercyDeed(kind, at){
  if (visit.key !== shared.arenaLevel){ visit.key = shared.arenaLevel; visit.moved = 0; }
  const want = MERCY[kind], room = MERCY.cap - Math.abs(visit.moved), n = Math.sign(want) * Math.min(Math.abs(want), Math.max(0, room));
  const moved = n ? shiftAlign(n, G.hero, 'mercy') : 0;
  visit.moved += moved;
  noteMercy(kind === 'spare' ? 'spared' : 'struck');
  const W = ALIGN_WORDS[G.hero] || ALIGN_WORDS.jedi;
  if (at) floater(V(at.x, (at.y || 0) + 2.2, at.z), kind === 'spare' ? 'SPARED' + (moved ? ' · ' + W.light : '') : 'STRUCK DOWN' + (moved ? ' · ' + W.dark : ''), kind === 'spare' ? '#9fd8ff' : '#ff6a5a');
}

// the kneeling foe nearest you, in reach (a guest's puppets carry the host's 'yield' state)
function nearYield(){
  if (G.mode !== 'play' || G.paused || G.cutscene || player.downed) return null;
  const p = playerPos();
  let best = null, bd = MERCY.reach;
  for (const e of enemies){
    if (e.dead || e.state !== 'yield') continue;
    const d = Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z);
    if (d < bd){ bd = d; best = e; }
  }
  return best;
}
let near = null, el = null, shown = '';
onInteract(() => {
  const e = near;
  if (!e || e.dead || e.state !== 'yield') return false;
  if (e.net){   // a co-op guest: the host owns it
    if (net.role === 'guest' && connected()) send({ t: 'spare', n: e.nid });
    e.state = 'spared';   // (until the host's next word: it bows out there and here)
    return true;
  }
  const at = e.group.position.clone();
  if (spareEnemy(e)){ mercyDeed('spare', at); S.reward && S.reward(0); }
  return true;
}, () => !!near);

// a guest spared one of the host's foes: let it go here, and tell that guest it was their mercy
on('spare', (m) => {
  if (net.role !== 'host') return;
  const e = enemies.find(o => o.nid === m.n);
  if (!e || e.dead || e.state !== 'yield') return;
  if (spareEnemy(e)){ floater(V(e.group.position.x, e.group.position.y + 2.2, e.group.position.z), 'SPARED', '#9fd8ff'); sendTo(m.from, { t: 'mercy', k: 'spare' }); }
});
// the host says how this guest's deed landed: their own meter moves
on('mercy', (m) => {
  if (net.role !== 'guest' || (m.k !== 'spare' && m.k !== 'strike')) return;
  mercyDeed(m.k, playerPos());
});
export const tellGuestStruck = (slot) => sendTo(slot, { t: 'mercy', k: 'strike' });

/* ---------------- CHOICES ---------------- */
// the story's choice, made on this screen (the host's decides the story; every player's moves their own meter)
export function alignChoice(id, key, hero = G.hero){
  const w = CHOICE_WEIGHT[id] && CHOICE_WEIGHT[id][key];
  return w ? shiftAlign(w, hero, 'choice') : 0;
}
// a side mission's choice (data/side-quests.js `choice`): once per profile, each side's worth SIDE_WEIGHT
export function sideChoice(id, ch, key, hero = G.hero){
  const o = ch && ch.options.find(x => x.key === key);
  if (!o || !noteSidePick(id, key, hero)) return 0;
  return shiftAlign(o.side === 'light' ? SIDE_WEIGHT : o.side === 'dark' ? -SIDE_WEIGHT : 0, hero, 'side');
}
export const sideChoiceDue = (id, ch, hero = G.hero) => !!(ch && ch.options && ch.options.length && !sidePicked(id, hero));

// co-op: the host is asked a story choice, so every guest is asked it too (their own card, their own meter)
let ownChoice = null, pendingAsk = null;
export const setOwnChoice = (fn) => { ownChoice = fn; };
export function askGuests(id){ if (net.role === 'host' && connected()) send({ t: 'ask', id }); }
on('ask', (m) => { if (net.role === 'guest' && G.coopGuest && typeof m.id === 'string') pendingAsk = m.id; });

/* ---------------- THE CAST ---------------- */
// the lines someone has for a hero who leans one way (game/talk.js puts them first)
export function alignLines(name, hero = G.hero){
  const by = ALIGN_TALK[name], lean = leanOf(hero);
  return by && lean && by[lean] ? by[lean] : [];
}

/* ---------------- THE LOOK ---------------- */
const GOLD = new THREE.Color(0xe8a818), CLEAR = new THREE.Color(0xa8d8ff), SALLOW = new THREE.Color(0xb4aeb8), WARM = new THREE.Color(0xf0c8a0);
// how far the look has turned: -2 deep dark, -1 dark, 0, 1 light, 2 deep light
export const lookStage = (a) => a <= -ALIGN.deep ? -2 : a <= -ALIGN.lean ? -1 : a >= ALIGN.deep ? 2 : a >= ALIGN.lean ? 1 : 0;
export function tintModel(root, a){
  if (!root) return;
  const st = lookStage(a);
  if (root.userData.alStage === st) return;
  root.userData.alStage = st;
  const seen = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)){
      const k = m && m.userData && m.userData.ink && m.userData.ink.key;
      if ((k !== 'eyes' && k !== 'skin') || seen.has(m) || !m.color) continue;
      seen.add(m);
      const B = m.userData.alBase || (m.userData.alBase = { c: m.color.clone(), e: m.emissive ? m.emissive.clone() : null, ei: m.emissiveIntensity || 0 });
      m.color.copy(B.c);
      if (m.emissive && B.e){ m.emissive.copy(B.e); m.emissiveIntensity = B.ei; }
      if (k === 'eyes'){
        if (st < 0) m.color.lerp(GOLD, st === -2 ? 0.9 : 0.5);
        if (st > 0) m.color.lerp(CLEAR, st === 2 ? 0.55 : 0.3);
        if (Math.abs(st) === 2 && m.emissive){ m.emissive.copy(st < 0 ? GOLD : CLEAR); m.emissiveIntensity = st < 0 ? 0.85 : 0.3; }
      } else {
        if (st < 0) m.color.lerp(SALLOW, st === -2 ? 0.32 : 0.12);   // the dark side drains the colour from the face
        if (st === 2) m.color.lerp(WARM, 0.06);
      }
      m.needsUpdate = true;
    }
  });
}

/* ---------------- once a frame (main.js) ---------------- */
let lookT = 0;
export function updateAlignment(dt){
  // the blades thrown down: taken back when it gets up, left lying when it falls, gone with the body
  for (let i = props.length - 1; i >= 0; i--){
    const P = props[i], e = P.e;
    if (!e.dead && e.state !== 'yield'){ e.yielding = false; scene.remove(P.prop); P.node.visible = true; props.splice(i, 1); burst(e.group.position.clone().setY(1.2), 0x9cc4ff, 6, 2, 1); continue; }
    if (!enemies.includes(e)){ scene.remove(P.prop); props.splice(i, 1); }
  }
  // a guest's puppets: kneeling while the host's foe yields (net/foes.js reads e.kneel), blade down
  for (const e of enemies){
    if (!e.net) continue;
    const k = e.state === 'yield' || e.state === 'spared';
    if (k){ e.kneel = Math.min(1, (e.kneel || 0) + dt * 3); e.yk = true; const w = weapon(e); if (w) w.visible = false; }
    else if (e.yk){ e.yk = false; e.kneel = 0; const w = weapon(e); if (w) w.visible = true; }
  }
  // the SPARE prompt
  near = nearYield();
  if (!el) el = document.getElementById('mercyp');
  const key = near ? 'y' + (pad.active ? 'p' : '') : '';
  if (el && key !== shown){
    shown = key;
    if (near) el.innerHTML = '<kbd>' + (pad.active ? padKeys(INTERACT_KEY) : INTERACT_KEY) + '</kbd><span>SPARE</span><em>or strike it down</em>';
    el.classList.toggle('on', !!near);
  }
  // a guest asked the host's story choice: their own card, once the screen is free
  if (pendingAsk && ownChoice && G.mode === 'play' && !G.cutscene && !G.skillSelect && !G.cardUp){ const id = pendingAsk; if (ownChoice(id) !== false) pendingAsk = null; }   // (false: not yet, game/campaign.js choiceClear)
  // the look, a few times a second: your hero and every partner you can see
  if ((lookT -= dt) > 0) return;
  lookT = 0.4;
  tintModel(player.vis, alignOf('jedi'));
  for (const c of partnerCards()){ if (c.card && c.card.h === 'jedi'){ const P = partnerPuppet(c.slot); if (P) tintModel(P.group, c.card.a || 0); } }
}

// a lean that changes, mid-run: a corner note (the profile page has the rest)
onAlign((hero, moved, lean) => {
  if (!lean || G.mode !== 'play') return;
  const W = ALIGN_WORDS[hero] || ALIGN_WORDS.jedi;
  const head = lean === 'mid' ? 'BACK FROM THE EDGE' : 'YOU LEAN TO THE ' + (lean === 'light' ? W.light : W.dark);
  const line = hero === 'jedi' ? (lean === 'mid' ? 'Balanced again: the paths\' cards wait for a lean' : 'The ' + lean + ' path\'s cards open on your Force Tree · see PROFILE') : 'Your ' + W.title.toLowerCase().replace(/^the /, '') + ' has noticed · see PROFILE';
  upToast(head, line, 'mast');
});
