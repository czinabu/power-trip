// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE APPRENTICE: someone who grows up beside the hero (data/apprentices.js has who, the stages and the numbers). The
// Jedi's Padawan (Tavi) and the Mando's foundling (Rin) are squadmates of their own (allies/squad.js addSquadmate, with
// their own role and look); the trooper's second is one of the fire team, promoted. Kept on the hero's profile
// (game/profile.js apprenticeOf), so they outlive every run.
//
//   · planApprentice (game/flow.js startLevel): does the apprentice come along this level? Solo, a fighting mode, taken
//     and not left home. If so the squad keeps a place for them (allies/squad.js holdSquadSlot) and they join on the
//     level's first frame, beside the hero wherever the mode put them.
//   · updateApprentice (main.js, every frame): the Padawan's powers, the foundling's spotting, the second taking the squad
//     while the hero is down; growth; and in the hub, the apprentice standing at their post (data/apprentices.js POST),
//     a station: walk up and tap F (ui/hub-ui.js 'apprentice').

import { scene } from '../engine/renderer.js';
import { G, player, enemies, bossUp, shared } from '../state.js';
import { V3, rand } from '../utils.js';
import { playerPos, maxHp } from '../player/helpers.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { bark } from '../fx/barks.js';
import { sfx } from '../audio/sfx.js';
import { makeFriendTag, addFriendRing } from '../fx/friend.js';
import { buildEnemyMesh } from '../enemies/mesh.js';
import { updateLegs } from '../enemies/gait.js';
import { updateUpper } from '../enemies/upper.js';
import { damageEnemy } from '../enemies/damage.js';
import { bodyRadius } from '../enemies/bodyshape.js';
import { segBlockedBySolids } from '../world/collision.js';
import { allies, addSquadmate, removeSquadmate, holdSquadSlot, setSquadRally, setExtraRevives, setFirstPick, isFodder } from './squad.js';
import { SQUAD, REVIVE } from '../data/allies.js';
import { APPRENTICES, APPRENTICE_XP, APPRENTICE_POST, APPRENTICE_TALK } from '../data/apprentices.js';
import { FORMS } from '../data/forms.js';
import { TREES, JEDI_TREE } from '../data/profile.js';
import { HUBS, hubOf } from '../data/hub.js';
import { chapterOrder } from '../data/campaign.js';
import { profileOf, apprenticeOf, saveProfile, rankIndex, sideWon, leanOf, onRankGain } from '../game/profile.js';
import { upToast } from '../game/upgrades.js';
import { net, connected } from '../net/session.js';

const HEROES = ['jedi', 'mando', 'trooper'];
// this level's apprentice: due (coming, not yet here), ally (the squadmate), second (the trooper's, found in the squad),
// fought (they stood beside you this level: your rank XP pays them a share), the spotter's mark and the powers' clock
const A = { due: false, ally: null, second: null, secondDue: false, fought: false, spot: null, spotT: 2, spotTag: null, powT: 3,
            saidDown: false, dirty: false, saveT: 0, checkT: 0, fig: null, figKey: '' };

export const apprenticeDef = (hero = G.hero) => APPRENTICES[hero] || null;
const coop = () => net.status === 'connected' || connected() || !!G.coopGuest;
const practice = () => !!(G.training || G.sandbox);

/* ---------------- who they are, and how far they've come ---------------- */
// have they come to you yet? (the side mission won, the chapter cleared, the rank reached). Remembered once true
export function apprenticeMet(hero = G.hero){
  const D = apprenticeDef(hero), st = apprenticeOf(hero);
  if (!D) return false;
  if (st.met) return true;
  const m = D.meet, p = profileOf(hero);
  const ok = (m.side && sideWon(m.side, hero)) || (m.chapter && p.cleared && p.cleared[m.chapter]) || (m.rank != null && rankIndex(hero) >= m.rank);
  if (ok){ st.met = 1; saveProfile(); }
  return !!ok;
}
export const apprenticeTaken = (hero = G.hero) => !!apprenticeOf(hero).taken && apprenticeMet(hero);
// the name over their head ('TAVI', 'RIN', or the trooper's pick)
export function apprenticeName(hero = G.hero){
  const D = apprenticeDef(hero);
  return D ? D.name || apprenticeOf(hero).who || null : null;
}
// the highest stage your own rank allows
export function stageCap(hero = G.hero){ const c = apprenticeDef(hero).cap; return c[Math.min(rankIndex(hero), c.length - 1)]; }
// the stage their XP has earned, held to what your rank allows
export function stageEarned(hero = G.hero){
  const D = apprenticeDef(hero), st = apprenticeOf(hero);
  let s = 0;
  while (s + 1 < D.stages.length && st.xp >= D.stages[s + 1].xp) s++;
  return Math.max(0, Math.min(s, stageCap(hero)));
}
export const apprenticeStage = (hero = G.hero) => apprenticeDef(hero).stages[Math.min(apprenticeOf(hero).stage || 0, apprenticeDef(hero).stages.length - 1)];
// what holds the next stage back: { xp, need, rank } (rank: true when it's your rank that waits, not their XP), or null at the top
export function nextStageNeeds(hero = G.hero){
  const D = apprenticeDef(hero), st = apprenticeOf(hero), n = (st.stage || 0) + 1;
  if (n >= D.stages.length) return null;
  return { nm: D.stages[n].nm, xp: st.xp, need: D.stages[n].xp, rank: st.xp >= D.stages[n].xp && stageCap(hero) < n };
}

// take them on (the trooper names who): they come along from the next fight on
export function takeApprentice(hero = G.hero, who = null){
  const D = apprenticeDef(hero), st = apprenticeOf(hero);
  if (!D || !apprenticeMet(hero)) return false;
  if (hero === 'trooper'){
    if (!D.pick.includes(who)) return false;
    if (st.who && st.who !== who){ st.xp = 0; st.stage = 0; }   // (a new second starts at the first stripe)
    st.who = who;
  }
  st.taken = 1; st.home = 0;
  saveProfile();
  return true;
}
// leave them at the hub (they don't come along) or bring them again
export function setApprenticeHome(home, hero = G.hero){ const st = apprenticeOf(hero); st.home = home ? 1 : 0; saveProfile(); }

// what the Padawan has picked up from your run: the powers it can use and the form it fights in (the panel lists them)
function jediPowers(stage){
  const D = APPRENTICES.jedi, n = stage.powers || 0;
  if (!n) return [];
  const has = (k) => !!((G.unlocked && G.unlocked[k]) || (player.skills && player.skills[k]));
  return D.powerList.filter(p => p.need.some(has)).slice(0, n);
}
const TREE_BRANCH = (id) => TREES.jedi.of[id] || (JEDI_TREE.find(n => n.id === id) || {}).branch || null;
function treePoints(){
  const out = { combat: 0, sense: 0, control: 0 };
  for (const id in player.skills || {}){ const b = TREE_BRANCH(id); if (b in out) out[b] += player.skills[id] || 0; }
  return out;
}
export function apprenticeLearned(hero = G.hero){
  if (hero !== 'jedi') return [];
  const out = jediPowers(apprenticeStage('jedi')).map(p => p.nm);
  const f = FORMS[G.stance];
  if (f && APPRENTICES.jedi.forms[f.tag]) out.push(f.name);
  return out;
}

// the look and numbers they fight in at this stage
function bladeOf(hero){
  const D = APPRENTICES.jedi, stg = apprenticeStage(hero);
  if (!stg.look.own) return D.blade.training;
  const lean = leanOf(hero);
  return lean === 'light' ? D.blade.light : lean === 'dark' ? D.blade.dark : D.blade.mid;
}
function defFor(hero){
  const D = apprenticeDef(hero), stg = apprenticeStage(hero);
  if (hero === 'jedi') return { name: D.name, role: 'jedi', model: D.model, weapon: D.weapon, look: stg.look.look, color: D.color, eye: bladeOf(hero), cloth: D.cloth, scale: stg.look.scale, apprentice: true };
  if (hero === 'mando') return { name: D.name, role: 'rifle', model: D.model, color: stg.look.color, eye: D.eye, cloth: D.cloth, scale: stg.look.scale, apprentice: true };
  return null;
}
function roleFor(hero){
  const stg = apprenticeStage(hero), base = hero === 'jedi' ? SQUAD.roles.jedi : SQUAD.roles.rifle;
  const r = { ...base, ...stg.role };
  if (hero === 'jedi'){
    const D = APPRENTICES.jedi, pts = treePoints(), T = D.tree;
    r.dmg *= 1 + pts.combat * T.combat.dmg;
    r.deflect = Math.min(0.8, r.deflect + pts.sense * T.sense.deflect);
    r.hp = Math.round(r.hp * (1 + pts.sense * T.sense.hp));
    const f = FORMS[G.stance], F = f && D.forms[f.tag];
    if (F){
      if (F.dmg) r.dmg *= F.dmg;
      if (F.every) r.every = r.every.map(v => v * F.every);
      if (F.deflect) r.deflect = Math.min(0.8, r.deflect + F.deflect);
      if (F.reach) r.reach += F.reach;
    }
  }
  return r;
}

/* ---------------- does the apprentice come along? ---------------- */
function prologue(){
  if (!(G.chapter >= 0)) return false;
  const c = chapterOrder(G.actTwo)[G.chapter];
  return !!(c && c.prologue);
}
function comes(opts){
  const hero = G.hero;
  if (!HEROES.includes(hero) || coop() || (opts && (opts.hub || opts.coopGuest)) || G.hub || G.training) return false;
  if (!apprenticeTaken(hero) || apprenticeOf(hero).home) return false;
  if (hero === 'trooper' && !apprenticeOf(hero).who) return false;
  return !prologue();
}
// a level is starting (game/flow.js startLevel, after the old squad is cleared)
export function planApprentice(opts){
  A.ally = null; A.second = null; A.fought = false; A.saidDown = false;
  A.spot = null; A.spotT = 2; A.powT = 3;
  if (A.spotTag) A.spotTag.visible = false;
  setSquadRally(1); setExtraRevives(0);
  const go = comes(opts);
  const hero = G.hero;
  if (go && apprenticeOf(hero).stage !== stageEarned(hero)) settleStage(hero, false);
  A.due = go && hero !== 'trooper';
  A.secondDue = go && hero === 'trooper';
  holdSquadSlot(A.due);
  setFirstPick(A.secondDue ? apprenticeOf(hero).who : null);
  if (A.secondDue){ const L = apprenticeStage(hero).lead; setExtraRevives(L.revives || 0); }
}

function join(){
  A.due = false;
  if (!comes() || G.mode !== 'play') { holdSquadSlot(false); return; }
  const hero = G.hero, def = defFor(hero);
  if (!def) return;
  const a = addSquadmate(null, { def, roleObj: roleFor(hero), cap: 99 });
  if (!a) return;
  dress(a, hero);
  A.ally = a; A.fought = true;
  burst(V3(a.group.position.x, 1.2, a.group.position.z), hero === 'jedi' ? 0x9ad0ff : 0xffa040, 10, 5, 3, 0.7);
}
// what marks an apprentice in the squad panel and lets their kills grow them
function dress(a, hero){
  a.apprentice = true;
  tintBlade(a.group, a.t.eye);
  a.badge = hero === 'jedi' ? '✦' : hero === 'mando' ? '◆' : '▲';
  a.onKill = (e) => grow(e && (e.elite || e.t && e.t.heavy || e.champion) ? APPRENTICE_XP.elite : APPRENTICE_XP.kill);
}
// the Padawan's blade burns their own colour, not the look's (enemies/mesh.js sets a named look's blade as it builds)
function tintBlade(g, c){ const b = g && g.userData.bladeGlow; if (b && c != null && apprenticeDef() && G.hero === 'jedi') b.material.color.setHex(c); }
// the trooper's second: one of the fire team, found in the squad and promoted
function promote(a){
  const L = apprenticeStage('trooper').lead;
  a.lead = L; dress(a, 'trooper');
  a.maxHp = Math.round(a.role.hp * L.hp); a.hp = Math.max(a.hp, a.maxHp);
  a.dmgMul = L.dmg;
  A.second = a; A.fought = true;
}

/* ---------------- growing up ---------------- */
function grow(n){
  if (!(n > 0) || practice() || coop()) return;
  const hero = G.hero;
  if (!apprenticeTaken(hero)) return;
  apprenticeOf(hero).xp += n;
  A.dirty = true;
  if (stageEarned(hero) > (apprenticeOf(hero).stage || 0)) settleStage(hero, true);
}
// your rank XP, earned with them beside you this level: their share
onRankGain((n, hero) => { if (hero === G.hero && A.fought) grow(n * APPRENTICE_XP.share); });
// their stage caught up with what they've earned (XP, or your rank rising): the card, and the new look in the field
function settleStage(hero, live){
  const st = apprenticeOf(hero), now = stageEarned(hero);
  if (now === (st.stage || 0)) return;
  const up = now > (st.stage || 0);
  st.stage = now; saveProfile(); A.dirty = false;
  if (!up) return;
  const stg = apprenticeStage(hero), name = apprenticeName(hero);
  if (G.mode === 'play') upToast(name + ' · ' + stg.nm, stg.line, 'mast');
  if (!live) return;
  // in the field: they step up there and then (a new look and new numbers)
  if (A.ally && allies.includes(A.ally)){
    const was = A.ally, p = was.group.position, at = { x: p.x, z: p.z }, hp = was.hp / was.maxHp;
    removeSquadmate(was);
    const a = addSquadmate(at, { def: defFor(hero), roleObj: roleFor(hero), cap: 99 });
    if (a){ dress(a, hero); a.hp = Math.max(1, Math.round(a.maxHp * Math.max(hp, 0.5))); A.ally = a; burst(V3(at.x, 1.4, at.z), 0xfff0b0, 18, 7, 4, 0.9); }
    else A.ally = null;
  }
  if (A.second && allies.includes(A.second)) promote(A.second);
  if (hero === 'trooper' && A.secondDue) setExtraRevives(apprenticeStage(hero).lead.revives || 0);
}

/* ---------------- in the fight ---------------- */
const standing = (a) => a && a.state !== 'down' && allies.includes(a);
function fodderNear(p, r, test){
  const out = [];
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || !isFodder(e)) continue;
    const dx = e.group.position.x - p.x, dz = e.group.position.z - p.z, d = Math.hypot(dx, dz);
    if (d - bodyRadius(e) > r || (test && !test(e, dx, dz, d))) continue;
    out.push({ e, dx, dz, d });
  }
  return out;
}
const clear = (p, e) => !segBlockedBySolids(p.x, p.z, e.group.position.x, e.group.position.z);
// THE PADAWAN'S POWERS: the run's own, a few of them by stage (data/apprentices.js powerList)
function usePower(a, pw, scale){
  const g = a.group, p = g.position, sc = a.t.scale, fy = g.rotation.y, fx = Math.sin(fy), fz = Math.cos(fy);
  const blade = a.t.eye, opts = { ally: true, by: a };
  const say = (t) => { if (Math.random() < 0.35) bark(g, t, { who: a.name, color: '#bfe8ff' }); };
  if (pw.id === 'push'){
    const hit = fodderNear(p, 6, (e, dx, dz, d) => d < 0.4 || (dx * fx + dz * fz) / d > 0.35);
    if (!hit.length) return false;
    for (const h of hit) damageEnemy(h.e, 6 * scale, V3(h.dx / (h.d || 1), 0, h.dz / (h.d || 1)), 18, false, false, opts);
    for (let i = 1; i <= 4; i++) burst(V3(p.x + fx * i * 1.2, 1.2 * sc, p.z + fz * i * 1.2), 0x9ad0ff, 4, 4, 2, 0.5);
    sfx(140, 0.25, 'sine', 0.05, 60); say('PUSH!');
    return true;
  }
  if (pw.id === 'pull'){
    const c = fodderNear(p, 16, (e, dx, dz, d) => d > 7 && clear(p, e)).sort((x, y) => y.d - x.d)[0];
    if (!c) return false;
    damageEnemy(c.e, 4 * scale, V3(-c.dx / c.d, 0, -c.dz / c.d), 18, false, false, opts);
    burst(V3(c.e.group.position.x, 1.3, c.e.group.position.z), 0x9ad0ff, 8, 5, 3, 0.6);
    sfx(90, 0.3, 'sine', 0.05, 220); say('COME HERE!');
    return true;
  }
  if (pw.id === 'throw'){
    const c = fodderNear(p, 15, (e, dx, dz, d) => d > 5 && clear(p, e)).sort((x, y) => x.d - y.d)[0];
    if (!c) return false;
    damageEnemy(c.e, a.role.dmg * 1.2 * scale, V3(c.dx / c.d, 0, c.dz / c.d), 8, false, false, opts);
    for (let i = 1; i <= 6; i++){ const k = i / 6; burst(V3(p.x + c.dx * k, 1.3 * sc, p.z + c.dz * k), blade, 2, 3, 1.5, 0.4); }
    sfx(420, 0.18, 'sawtooth', 0.03, 180); say('CATCH!');
    return true;
  }
  if (pw.id === 'mend'){
    const pp = playerPos(), heroNear = !player.downed && player.hp > 0 && player.hp < maxHp() * 0.7 && Math.hypot(pp.x - p.x, pp.z - p.z) < 6 && (apprenticeOf('jedi').stage || 0) >= 2;
    if (a.hp > a.maxHp * 0.5 && !heroNear) return false;
    a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.4);
    burst(V3(p.x, 1.3 * sc, p.z), 0x7bffae, 10, 4, 2, 0.8);
    if (heroNear){ player.hp = Math.min(maxHp(), player.hp + 12); burst(V3(pp.x, 1.3, pp.z), 0x7bffae, 6, 3, 1.5, 0.6); }
    sfx(660, 0.3, 'sine', 0.03, 880);
    return true;
  }
  if (pw.id === 'repulse'){
    const hit = fodderNear(p, 4.5);
    if (hit.length < 3) return false;
    for (const h of hit) damageEnemy(h.e, 10 * scale, V3(h.dx / (h.d || 1), 0, h.dz / (h.d || 1)), 20, false, false, opts);
    for (let i = 0; i < 12; i++){ const t = i / 12 * Math.PI * 2; burst(V3(p.x + Math.sin(t) * 3, 0.8, p.z + Math.cos(t) * 3), 0x9ad0ff, 2, 3, 1.5, 0.5); }
    sfx(70, 0.4, 'sine', 0.06, 40); say('GET BACK!');
    return true;
  }
  return false;
}
function padawan(a, dt){
  if ((A.powT -= dt) > 0) return;
  const stg = apprenticeStage('jedi'), pws = jediPowers(stg);
  if (!pws.length || a.cutT > 0 || !enemies.some(e => !e.dead)){ A.powT = 1; return; }
  const cdMul = Math.max(0.5, 1 - treePoints().control * APPRENTICES.jedi.tree.control.cd);
  const scale = (SQUAD.dmg[G.diff] || 1) * (player.up.squadDmg || 1);
  const order = pws.slice().sort(() => Math.random() - 0.5);
  for (const pw of order) if (usePower(a, pw, scale)){ A.powT = pw.cd * cdMul * rand(0.85, 1.15); A.used = (A.used || 0) + 1; return; }
  A.powT = 0.6;
}
// THE FOUNDLING'S EYE: every few seconds, the foe nearest you that they can see (never the boss) is called out, and your
// blows on it land harder while the mark lasts (enemies/damage.js spotT)
function spotter(a, dt){
  const S = apprenticeStage('mando').spot;
  if (A.spot && (A.spot.dead || !(A.spot.spotT > G.gt))) A.spot = null;
  if (!A.spotTag){ A.spotTag = makeFriendTag(1.2); A.spotTag.material.color.setHex(0xffa040); scene.add(A.spotTag); }
  const m = A.spot;
  A.spotTag.visible = !!m;
  if (m){ const q = m.group.position, s = m.group.scale.x || 1; A.spotTag.position.set(q.x, q.y + 2.7 * s, q.z); A.spotTag.rotation.y += dt * 5; }
  if ((A.spotT -= dt) > 0) return;
  A.spotT = 0.7;
  const p = a.group.position, pp = playerPos(), boss = bossUp();
  let best = null, bd = 1e9;
  for (const e of enemies){
    if (e.dead || e.converted || e.state === 'spawn' || e === boss || e === shared.boss || e.warbringer) continue;
    const q = e.group.position, d = Math.hypot(q.x - pp.x, q.z - pp.z);
    if (d > 32 || d >= bd || Math.hypot(q.x - p.x, q.z - p.z) > 34 || !clear(p, e)) continue;
    bd = d; best = e;
  }
  if (!best) return;
  best.spotT = G.gt + S.for; best.spotMul = S.mul;
  A.spot = best; A.spotT = S.every;
  const q = best.group.position;
  floater(V3(q.x, q.y + 2.3 * (best.group.scale.x || 1), q.z), 'SPOTTED', '#ffb060');
  if (Math.random() < 0.4) bark(a.group, ['THAT ONE!', 'THERE! HIT THAT ONE!', 'MARKED!', 'LEFT! NO, YOUR LEFT!'][(Math.random() * 4) | 0], { who: a.name, color: '#ffd09a' });
}
// THE SECOND TAKES THE SQUAD: while you're down they fight harder, you bleed out slower, and the second gets you up sooner
function second(a, dt){
  const L = a.lead, down = player.downed;
  if (!down || !standing(a)){ setSquadRally(1); A.saidDown = false; return; }
  setSquadRally(L.rally);
  if (!A.saidDown){ A.saidDown = true; bark(a.group, 'I HAVE THE SQUAD! COVER THE CAPTAIN!', { who: a.name, color: '#bfe8ff' }); }
  if (down.out) return;
  const pp = playerPos(), q = a.group.position, near = Math.hypot(q.x - pp.x, q.z - pp.z) < REVIVE.radius;
  if (near) down.prog += dt * (L.revive - 1);
  else down.bleed = Math.min(REVIVE.hero.bleed, down.bleed + dt * L.bleed);
}

/* ---------------- THE HUB: the apprentice at their post ---------------- */
function postHere(){
  if (!G.hub || G.mode !== 'play' || hubOf(G.hero) !== G.hubId) return null;
  const P = APPRENTICE_POST[G.hubId];
  return P && P.wing === G.hubWing && apprenticeMet(G.hero) ? P : null;
}
function figDef(hero){
  if (hero !== 'trooper') return defFor(hero);
  const who = apprenticeOf(hero).who || APPRENTICES.trooper.pick[0];
  return SQUAD.roster.trooper.find(d => d.name === who) || SQUAD.roster.trooper[0];
}
function dropFig(){ if (A.fig){ scene.remove(A.fig.group); A.fig = null; } A.figKey = ''; }
function updateFig(dt){
  const P = postHere(), hero = G.hero;
  const key = P ? [G.hubId, G.hubWing, hero, apprenticeOf(hero).stage, apprenticeOf(hero).who, bladeKey(hero), shared.arenaHalf].join(':') : '';
  if (key !== A.figKey || (A.fig && !A.fig.group.parent)){
    dropFig();
    if (!P) return;
    const d = figDef(hero);
    const t = { model: d.model, color: d.color, eye: d.eye, cloth: d.cloth, scale: d.scale || 1, ranged: hero !== 'jedi', weapon: d.weapon, look: d.look };
    const g = buildEnemyMesh(t);
    g.position.set(P.x, 0, P.z); g.rotation.y = Math.atan2(P.face[0] - P.x, P.face[1] - P.z);
    if (hero === 'jedi') tintBlade(g, t.eye);
    scene.add(g); addFriendRing(g);
    A.fig = { group: g, t }; A.figKey = key;
  }
  if (A.fig){ const g = A.fig.group; updateLegs(A.fig, g, dt, 'ground'); updateUpper(A.fig, g, dt, null); }
}
const bladeKey = (hero) => hero === 'jedi' ? bladeOf(hero) : 0;
// the hub's station for the apprentice (ui/hub-ui.js opens it): one per hub, at the post, shown once they've come to you
const STATION = { id: 'apprentice', act: 'apprentice', r: 3.4,
  get x(){ return (APPRENTICE_POST[G.hubId] || {}).x || 0; }, get z(){ return (APPRENTICE_POST[G.hubId] || {}).z || 0; },
  get name(){ return apprenticeName() || 'YOUR SECOND'; },
  when: () => hubOf(G.hero) === G.hubId && apprenticeMet(G.hero) };
for (const [hub, P] of Object.entries(APPRENTICE_POST)){ const W = HUBS[hub] && HUBS[hub].wings[P.wing]; if (W && !W.stations.includes(STATION)) W.stations.push(STATION); }

/* ---------------- what they say (game/talk.js) ---------------- */
export function apprenticeLines(name){
  const hero = G.hero;
  if (!name || name !== apprenticeName(hero) || !apprenticeTaken(hero)) return [];
  const all = APPRENTICE_TALK[hero] || [], st = apprenticeOf(hero).stage || 0;
  const lean = hero === 'jedi' && st >= 2 ? (APPRENTICE_TALK.jediLean || {})[leanOf(hero)] || [] : [];
  return [...lean, ...(all[Math.min(st, all.length - 1)] || [])];
}

/* ---------------- every frame (main.js) ---------------- */
export function updateApprentice(dt){
  updateFig(dt);
  if (A.dirty && (A.saveT -= dt) <= 0){ A.saveT = 3; A.dirty = false; saveProfile(); }
  if (G.mode !== 'play') return;
  // their stage caught up with their XP or your rank (in the hub too: the post's panel shows it)
  if ((A.checkT -= dt) <= 0){ A.checkT = 2; if (HEROES.includes(G.hero) && apprenticeTaken(G.hero) && stageEarned(G.hero) !== (apprenticeOf(G.hero).stage || 0)) settleStage(G.hero, !G.hub); }
  if (G.hub) return;
  if (A.due && !G.paused) join();
  if (A.ally && !allies.includes(A.ally)) A.ally = null;
  if (A.secondDue && (!A.second || !allies.includes(A.second))){
    A.second = null;
    const who = apprenticeOf('trooper').who, a = allies.find(o => !o.net && o.def && o.def.name === who && !o.apprentice);
    if (a) promote(a);
  }
  if (G.paused) return;
  if (A.ally && standing(A.ally) && !A.ally.net){
    if (G.hero === 'jedi') padawan(A.ally, dt);
    else if (G.hero === 'mando') spotter(A.ally, dt);
  } else if (A.spotTag && A.spotTag.visible){ A.spotTag.visible = false; A.spot = null; }
  if (A.second) second(A.second, dt);
}
// tools and tests
export const apprenticeNow = () => ({ ally: A.ally, second: A.second, due: A.due, fought: A.fought, fig: A.fig && A.fig.group, spot: A.spot, powers: A.used || 0 });
