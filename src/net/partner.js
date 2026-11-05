// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The partners in online co-op (one per other player, up to three): a hero model each, dressed in their own customizer picks, standing where their browser
// says they are and posed exactly as their screen draws them (net/pose.js). It joins the players list
// (player/players.js) as a hero the enemies can pick, while both of you are in the same arena. Each browser still runs
// its own enemies for now: fighting the same ones together is co-op phase 2.

import * as THREE from 'three';
import { scene, camera } from '../engine/renderer.js';
import { G, player, enemies } from '../state.js';
import { NET } from '../data/coop.js';
import { buildHeroModel } from '../player/model/index.js';
import { stepCloth } from '../player/model/cloth.js';
import { blink } from '../player/model/life.js';
import { footDust } from '../fx/footdust.js';
import { lookOf, loadPicks, disposeTree } from '../player/mesh.js';
import { wornPicks } from '../data/customize.js';
import { playerPos } from '../player/helpers.js';
import { heroAim } from '../player/aim.js';
import { addPlayer, removePlayer, worldKey } from '../player/players.js';
import { addHeroReviver, addReviverSource, addTeamStanding, heroDownState, marker } from '../game/revive.js';
import { showBanner } from '../ui/banners.js';
import { makeChip, placeChip, hideChip } from '../ui/coop-marks.js';
import { S } from '../audio/sfx.js';
import { refill } from '../allies/squad.js';
import { readPose, makePoseTrack, pushPose, stepPose } from './pose.js';
import { on, send, sendEvery, connected, net } from './session.js';
import { savedName, hasName, setName, forgetName, forgetAll, nameOf } from './names.js';
import { fxOut, makePartnerFx, updatePartnerFx } from './partner-fx.js';
import { profileCard, cleanCard } from '../game/profile.js';

const partners = new Map();   // slot -> that player's puppet, pose track and entry in the players list
const keyOf = (picks) => JSON.stringify(picks || {});
let sent = 0;

function partnerOf(slot){
  let P = partners.get(slot);
  if (P) return P;
  const puppet = { group: new THREE.Group() };
  P = { slot, puppet, track: makePoseTrack(), fx: makePartnerFx(), built: false, picksKey: '', hero: 'jedi', playing: false, world: '', tag: null,
        want: { pos: new THREE.Vector3(), yaw: 0, ap: 0 } };
  /* this partner in the players list: `pos` is where the puppet stands on this screen, so what enemies chase is what
     you see them chase */
  P.mate = { id: 'partner' + slot, slot, local: false, name: nameOf(slot), pos: puppet.group.position, vel: new THREE.Vector3(), down: false, here: false, away: false };
  addHeroReviver(() => standing(P));
  addReviverSource(() => standing(P) ? { kind: 'partner', pos: puppet.group.position, hitAt: null } : null);
  partners.set(slot, P);
  return P;
}

function build(P, picks, heroName){
  const { puppet } = P;
  if (puppet.vis){ puppet.group.remove(puppet.vis); disposeTree(puppet.vis); }
  puppet.group.add(buildHeroModel(puppet, lookOf(picks)));
  P.picksKey = keyOf(picks);
  P.track.to = P.track.from = null;   // a fresh rig: the next pose snaps on
  dress(P, heroName);
  if (!P.built){ scene.add(puppet.group); P.built = true; }
}

/* show only the parts of the chosen hero (the same switch player/hero.js makes for the local player); which weapon is
   out, and where, comes with every pose */
function dress(P, heroName){
  const { puppet } = P;
  P.hero = heroName === 'mando' || heroName === 'trooper' ? heroName : 'jedi';
  P.mate.hero = P.hero;   // (which hero they play: the duel bubble reads it, enemies/bubble.js)
  const mando = P.hero === 'mando', trooper = P.hero === 'trooper', gunner = mando || trooper;
  for (const m of puppet.mandoParts) m.visible = mando;
  for (const m of puppet.trooperParts || []) m.visible = trooper;   // (the ARC trooper's armour: player/model/trooper.js)
  for (const m of puppet.headBare) m.visible = !gunner;
  puppet.rig.skirt.visible = !gunner;
  puppet.saberHand.visible = !gunner;
}

// their picked name, else "PARTNER" with one other player, "PLAYER 3" and so on with more (net/names.js)
const who = (P) => hasName(P.slot) || partners.size > 1 ? nameOf(P.slot) : 'PARTNER';
const label = (P) => who(P) + (P.mate.card ? ' · ' + P.mate.card.n : '');   // and their rank (game/profile.js)
function nameTag(P){
  if (P.tag) return P.tag;
  P.tag = document.createElement('div');
  P.tag.className = 'partnertag'; P.tag.textContent = label(P);
  document.getElementById('hud').appendChild(P.tag);
  return P.tag;
}

// a standing partner can get you up when you go down, and earns you a second chance each wave (game/revive.js)
const standing = (P) => P.mate.here && !P.mate.down;
const anyStanding = () => { for (const P of partners.values()) if (standing(P)) return true; return false; };
addTeamStanding(() => G.mode === 'play' && anyStanding());   // a fallen hero stays OUT, not finished, while a teammate is up (game/revive.js)
let reviveWave = -1;
function coopRevives(){
  const up = anyStanding();
  G.coopRevive = up && G.mode === 'play';   // keeps the revive channel running when the squad isn't
  if (!up || G.mode !== 'play') return;
  const key = G.endless ? G.endlessWave : G.levelIdx * 100 + G.wave;
  if (G.reviveLeft == null || key !== reviveWave){ reviveWave = key; refill(); }
}

on('hello', (m) => { setName(m.from || 0, m.name); const P = partnerOf(m.from || 0); P.mate.name = nameOf(P.slot); hearCard(P, m.rk); build(P, m.picks, m.hero); addPlayer(P.mate); });
// each player's PROFILE CARD (game/profile.js profileCard: hero, rank, Force Tree), with their hello and now and then after:
// shown on their name tag, and kept on their entry for whatever reads the room (the hub, partnerCards)
function hearCard(P, c){ if (c !== undefined) P.mate.card = cleanCard(c); }
// where each partner is (their worldKey: 'hub:hall', 'survival:0'...), for the temple's map (ui/hub-ui.js) and the co-op panel
export const partnerWorlds = () => [...partners.values()].filter(P => P.built && P.playing).map(P => ({ slot: P.slot, name: who(P), world: P.world }));
export const partnerCards = () => [...partners.values()].map(P => ({ slot: P.slot, name: nameOf(P.slot), card: P.mate.card || null }));
on('s', (m) => {
  const P = partnerOf(m.from || 0), { want, mate, puppet, track } = P;
  if (m.name !== undefined){ setName(P.slot, m.name); mate.name = nameOf(P.slot); }
  hearCard(P, m.rk);
  if (!P.built) build(P, m.picks, m.hero);
  if (m.picks && keyOf(m.picks) !== P.picksKey) build(P, m.picks, m.hero);
  if (m.hero !== P.hero) dress(P, m.hero);
  addPlayer(mate);
  if (!P.playing) puppet.group.position.set(m.x, m.y, m.z);   // first sight, or back from the menu: snap
  // (held on a cutscene mark: what they send from before they got there doesn't drag them back across the set)
  const held = P.hold && performance.now() < P.hold.until && Math.hypot(m.x - P.hold.x, m.z - P.hold.z) > 0.6;
  if (P.hold && !held) P.hold = null;
  if (!held){ want.pos.set(m.x, m.y, m.z); want.yaw = m.yaw; }
  want.ap = +m.ap || 0;
  mate.vel.set(m.vx || 0, 0, m.vz || 0);
  mate.down = !!m.down;
  mate.away = !!m.pz;
  P.dn = m.dn || null;   // down and waiting to be got up: [progress %, seconds left, someone is at it]
  P.playing = !!m.play; P.world = m.w || '';
  if (m.pose) pushPose(track, puppet, m.pose, performance.now());
  P.fx.cur = m.fx || null; P.fx.curAt = performance.now();
});
// a player came in: say hello to them (the host's hello reaches every guest, and each guest's reaches the host and, through it, the rest)
on('open', () => { sent = 0; send({ t: 'hello', hero: G.hero, picks: wornPicks(loadPicks()), name: savedName(), rk: profileCard() }); });
function leaves(slot){
  const P = partners.get(slot);
  if (!P) return;
  dropPartner(P); removePlayer(P.mate); forgetName(slot);
}
on('closed', (slot) => { if (slot < 0) for (const k of [...partners.keys()]) leaves(k); else leaves(slot); });
on('bye', (m) => leaves(m.slot));   // another guest left (the host tells the rest)

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function updateCoop(dt){
  if (connected()){
    sendEvery(NET.sendMs, () => {
      const p = playerPos();
      const m = { t: 's', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +player.group.rotation.y.toFixed(3),
        vx: +(player.moveVel.x + player.vel.x).toFixed(2), vz: +(player.moveVel.z + player.vel.z).toFixed(2),
        hero: G.hero, play: G.mode === 'play', down: !!player.downed || G.mode === 'dead', w: worldKey(),
        pz: G.paused || G.skillSelect ? 1 : 0,   // in a menu: foes leave them be (player/players.js huntable), and their tag says so
        ap: +heroAim().dir.y.toFixed(3),   // the aim's pitch (sine, + up): where their powers point up or down (player/aim.js)
        pose: player.rig ? readPose(player) : null, fx: fxOut() };
      const dn = heroDownState();   // down: how far along getting this hero up is, and how long they have (game/revive.js)
      if (dn) m.dn = [Math.round(dn.prog * 100), dn.out ? -1 : +dn.left.toFixed(1), dn.by ? 1 : 0];   // (-1: OUT, no clock)
      if (sent++ % NET.picksEvery === 0){ m.picks = wornPicks(loadPicks()); m.name = savedName(); m.rk = profileCard(); }   // (the picks as worn: the partner builds them as they come)
      return m;
    });
  }
  coopRevives();
  for (const P of partners.values()) stepPartner(P, dt);
}

/* the partner's footfalls, read off their posed ankles (their gait runs on their own screen): a foot that was moving
   and now stands still near the floor has just come down */
const _ank = new THREE.Vector3();
function partnerSteps(P, dt){
  const R = P.puppet.rig, g = P.puppet.group;
  if (!R || !(dt > 0)) return;
  const F = P.feet || (P.feet = { prev: [new THREE.Vector3(), new THREE.Vector3()], v: [0, 0], init: false, gp: g.position.clone() });
  const speed = Math.hypot(g.position.x - F.gp.x, g.position.z - F.gp.z) / dt; F.gp.copy(g.position);
  [R.legL, R.legR].forEach((L, i) => {
    L.ank.getWorldPosition(_ank);
    const v = F.init ? _ank.distanceTo(F.prev[i]) / dt : 0;
    if (F.init && F.v[i] > 2 && v < 0.8 && _ank.y < g.position.y + 0.25) footDust(_ank.clone().setY(g.position.y), speed);
    F.v[i] = v; F.prev[i].copy(_ank);
  });
  F.init = true;
}

function stepPartner(P, dt){
  const { puppet, mate, want, track } = P;
  const here = worldKey(), hubbed = here.startsWith('hub:') || P.world.startsWith('hub:');
  const show = P.built && connected() && P.playing && G.mode !== 'menu' && (!hubbed || P.world === here);   // (in the temple: only the ones in the same wing)
  puppet.group.visible = show;
  mate.here = show && G.mode === 'play' && P.world === worldKey();
  if (P.tag) P.tag.style.display = show ? 'block' : 'none';
  updatePartnerFx(P.fx, dt, puppet.group, show, puppet);
  downMarks(P, show);
  if (!show) return;
  const g = puppet.group;
  g.position.x = damp(g.position.x, want.pos.x, 14, dt);
  g.position.y = damp(g.position.y, want.pos.y, 14, dt);
  g.position.z = damp(g.position.z, want.pos.z, 14, dt);
  g.rotation.y += angDiff(g.rotation.y, want.yaw) * (1 - Math.exp(-14 * dt));
  stepPose(track, puppet, performance.now());
  stepCloth(puppet, dt, g.position.y + 0.02);   // their robe and cape swing here too, after the pose
  blink(puppet, dt);   // and they blink (model/life.js); their hands keep the grip they were built with
  partnerSteps(P, dt);   // and their feet kick up dust at a run (fx/footdust.js)
  // the name tag follows the head on screen
  const t = nameTag(P);
  if (P.chip && P.chip.style.display !== 'none'){ t.style.display = 'none'; return; }   // down: the chip says it instead
  t.textContent = mate.down ? who(P) + ' IS OUT' : mate.away ? who(P) + ' · PAUSED' : label(P);
  const v = new THREE.Vector3(g.position.x, g.position.y + 2.6, g.position.z).project(camera);
  if (v.z > 1){ t.style.display = 'none'; return; }
  t.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
  t.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
}

/* A PARTNER DOWN — the moment they drop, a banner and a sound; while they wait to be got up, the revive ring under them
   fills as someone gets them up, and a chip over them (pinned to the screen edge with an arrow when they're off-screen
   or behind you) says how long they have left and how far it is to them */
function downMarks(P, show){
  const { mate, puppet } = P, g = puppet.group;
  const waiting = show && mate.here && mate.down && !!P.dn;
  if (waiting && !P.wasDown && G.mode === 'play'){
    showBanner('', who(P) + ' IS DOWN · GET THEM UP', 2.4);
    S.reward(0);
  }
  P.wasDown = waiting;
  if (!waiting){
    if (P.ring) P.ring.visible = false;
    hideChip(P.chip);
    return;
  }
  const [prog, left, by] = P.dn;
  if (!P.ring) P.ring = marker(0xff5a4a);
  P.ring.visible = true;
  P.ring.position.set(g.position.x, Math.max(0.05, g.position.y + 0.05), g.position.z);
  P.ring.userData.fill.scale.setScalar(Math.max(0.001, prog / 100));
  P.ring.children[0].material.opacity = 0.55 + Math.sin(G.gt * 6) * 0.3;
  if (!P.chip) P.chip = makeChip('down');
  const pp = playerPos(), d = Math.hypot(g.position.x - pp.x, g.position.z - pp.z);
  _head.set(g.position.x, g.position.y + 2.2, g.position.z);
  const out = !(left >= 0);   // OUT (game/revive.js): no clock, they rise once the fight is over
  placeChip(P.chip, _head, by ? who(P) + ' · GETTING UP ' + prog + '%' : out ? who(P) + ' IS OUT · GET THEM UP' : who(P) + ' DOWN · ' + left.toFixed(0) + 'S', d);
  P.chip.classList.toggle('urgent', !by && !out && left < 5);
}
const _head = new THREE.Vector3();

// for the co-op smoke test: is a partner on screen, posed from the network, and something enemies can go after?
const first = () => partners.values().next().value;
export const partnerShown = () => [...partners.values()].some(P => P.puppet.group.visible);
const infoOf = (P) => ({ slot: P.slot, shown: P.puppet.group.visible, here: P.mate.here, posed: !!P.track.to, hero: P.hero, down: P.mate.down, away: P.mate.away,
  dn: P.dn, ring: !!(P.ring && P.ring.visible), chip: !!(P.chip && P.chip.style.display !== 'none'),
  armR: P.puppet.rig ? P.puppet.rig.armR.sh.quaternion.toArray().map(n => +n.toFixed(3)) : null,
  hunters: enemies.filter(e => !e.dead && e.hero === P.mate).length,
  lit: P.puppet._litBits ?? null });   // their saber (1) and Darksaber (2) lit, as their pose says (net/pose.js)
export const partnerInfo = () => {
  const P = first();
  return { ...(P ? infoOf(P) : { shown: false, here: false, posed: false, hero: 'jedi', armR: null, hunters: 0 }), all: [...partners.values()].map(infoOf) };
};
// the partner's puppet (net/foefire.js draws their powers from it)
export const partnerPuppet = (slot) => { const P = partners.get(slot || 0); return P ? P.puppet : null; };
// the aim of a partner: the unit direction their powers point, pitch included (a thrown saber, the flame, lightning)
export function partnerAim(out = new THREE.Vector3(), slot = 0){
  const P = partners.get(slot), w = P ? P.want : { ap: 0, yaw: 0 };
  const y = Math.max(-1, Math.min(1, w.ap)), h = Math.sqrt(1 - y * y);
  return out.set(Math.sin(w.yaw) * h, y, Math.cos(w.yaw) * h);
}
// the hero object of a partner by seat (who a foe is going after)
export const partnerMate = (slot) => { const P = partners.get(slot); return P ? P.mate : null; };
// for the squad (allies/squad.js via net/squad.js): where a partner stands and faces, and whether they're down, or null.
// Told a seat, that player; else a downed partner first, then any who is here
export function partnerSpot(slot){
  const spot = (P) => P && P.mate.here ? { pos: P.puppet.group.position, yaw: P.want.yaw, down: P.mate.down } : null;
  if (slot) return spot(partners.get(slot));
  let any = null;
  for (const P of partners.values()){ const s = spot(P); if (s && s.down) return s; if (s && !any) any = s; }
  return any;
}
/* A CUTSCENE'S MARKS (game/blocking.js): a partner shown standing on their mark the moment a scene starts, before their
   own screen has put them there and said so (a second or so at most), so nobody slides into place in the first shot */
export function holdPartner(slot, x, y, z, yaw){
  const P = partners.get(slot);
  if (!P || !P.mate.here || P.mate.down) return;
  P.hold = { x, z, until: performance.now() + 2500 };
  P.want.pos.set(x, y, z); P.want.yaw = yaw;
  P.puppet.group.position.set(x, y, z); P.puppet.group.rotation.y = yaw;
}
export function releasePartners(){ for (const P of partners.values()) P.hold = null; }
// the partners standing in this fight on this screen: { slot, pos } (down ones stay where they fell)
export const partnerStand = () => [...partners.values()].filter(P => P.mate.here && !P.mate.down).map(P => ({ slot: P.slot, pos: P.puppet.group.position }));
export function dropPartner(P){ P.puppet.group.visible = false; P.playing = false; P.mate.here = false; P.dn = null; if (P.tag) P.tag.style.display = 'none'; downMarks(P, false); }
on('status', (n) => { if (n.status !== 'connected'){ for (const P of partners.values()){ dropPartner(P); removePlayer(P.mate); } forgetAll(); } });
