// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// updateHud(): per-frame HUD refresh.

import { zoneDef, zoneDistrict, stonesTouched } from '../game/zone.js';
import { zoneQuestHud } from '../game/zone-quests.js';
import { HUBS } from '../data/hub.js';
import { fragCharges, fragMax, rifleMods } from '../player/trooper/kit.js';
const MOD_TAG = { burst: 'BURST', auto: 'AUTO', marksman: 'SCOPE' };
import { TROOPER } from '../data/trooper.js';
import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { LEVELS } from '../data/levels.js';
import { clamp } from '../utils.js';
import { shared, G, enemies, player, isGunner, isTrooper, isMando, hasPack, bossUp } from '../state.js';
import { MANDO, MANDO_WEAPONS, weaponUnlocked, kitOf, signatureWeapon, BESKAR_GUARD } from '../data/mando.js';
import { abil } from '../data/mastery.js';
import { maxHp, maxStam } from '../player/helpers.js';
import { FOCUS, focusTier } from '../player/jedi/focus.js';
import { flowDef, flowTier, flowKeyLabel } from '../player/gunner-flow.js';
import { furyKind } from '../player/jedi/fury.js';
import { mandoWeapon, shotSpread } from '../player/mando/weapons.js';
import { gunId, moveOf } from '../player/gun-moves.js';
import { MUTATORS } from '../data/mutators.js';
import { mutatorById, ROMAN as NG_ROMAN } from '../data/ngplus.js';
// a NEW GAME+ chapter's (or a veteran side mission's) mutators, as the survival wave's tag (data/ngplus.js)
const ngMutsHtml = () => !G.ngMuts.length ? '' : (G.chapter >= 0 && G.ngPlus > 0 ? '<span class="wi-mut" style="color:var(--gold)">NG+ ' + NG_ROMAN[G.ngPlus] + '</span> ' : '') +
  G.ngMuts.map(id => { const m = mutatorById(id); return m ? '<span class="wi-mut" style="color:' + m.col + '">' + m.name + '</span>' : ''; }).join(' ');
const ngTag = () => G.ngMuts.length ? '<span class="wi-h">' + ngMutsHtml() + '</span>' : '';
import { nextStoreGoal } from '../game/progression.js';
import { storyRun, xpTowardPoint, XP_PER_POINT } from '../game/upgrades.js';
import { updateBoonStrip } from '../game/boons.js';
import { renderThreats } from './threats.js';
import { readoutLiveHtml } from './readout-ui.js';
import { readoutOn } from '../game/readout.js';
import { svgIcon, SLOT_ICON } from './icons.js';
import { trainingProgress, trainingChecklist } from '../game/tutorial.js';
import { camera } from '../engine/renderer.js';
import { playerPos } from '../player/helpers.js';
import { missionChecklist, objectiveTarget } from '../game/mission.js';
import { chapterLabel } from '../game/campaign.js';
import { objectiveHud } from '../game/objectives.js';
import { calmHud, calmTarget } from '../game/aftermath.js';
import { objectiveKey } from './objective-view.js';
import { renderCompass } from './compass.js';
import { MOBILITY, MANDO_MOBILITY } from '../data/mobility.js';
import { maxCharges, inCombat, formMob } from '../player/mobility.js';
import { pickCut } from '../player/jedi/cutaim.js';
import { guardDial } from '../player/jedi/guardline.js';
import { aimPoint, lastAim, dynamicCrosshair } from '../player/aim.js';
import { floorCost, baseCost } from '../data/force-level.js';
let gaugeFullAt = -9;   // when the crosshair-side gauge last stood below full (it hides once it's been full a moment)

// give every power slot its icon once (key badge top-left, icon centre, name below)
for (const id in SLOT_ICON){ const el = document.getElementById(id); if (el) el.querySelector('.key').insertAdjacentHTML('afterend', svgIcon(SLOT_ICON[id])); }

/* THE JEDI'S CROSSHAIR, Jedi Academy style (player/aim.js heroCrosshair): cast from the hero along the view, drawn where
   it lands on screen, so it sits on the foe, the floor or the wall your aim really meets and rides along with the hero
   through a roll or a flip. Locked on, it sits on the locked foe. Returns its screen offset from the centre (as a CSS
   transform) and whether it is on a foe. */
const _sp = new THREE.Vector3();
let _jx = { tf: 'none', foe: false };
function jediReticle(){
  if (!dynamicCrosshair() || G.mode !== 'play'){ _jx = { tf: 'none', foe: false }; return _jx; }
  const pt = aimPoint();
  const foe = !!lastAim.target;
  _sp.copy(pt).project(camera);
  let x = 0, y = 0;
  if (_sp.z < 1){   // (behind the lens: leave it centred)
    x = Math.max(-0.45, Math.min(0.45, _sp.x * 0.5)) * innerWidth;
    y = Math.max(-0.45, Math.min(0.45, -_sp.y * 0.5)) * innerHeight;
  }
  _jx = { tf: 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)', foe, x, y };
  return _jx;
}
export const jediReticleAt = () => _jx;

// write text/HTML only when it changed — the HUD refreshes every frame
function setText(el, v){ if (el._t !== v){ el._t = v; el.textContent = v; } }
function setHtml(el, v){ if (el._h !== v){ el._h = v; el.innerHTML = v; } }
const $ = (id) => document.getElementById(id);

const FIGHT_LINGER = 2.5;   // s of quiet before the checklist opens out again
let fightT = -99;
const GUARD_DIAL_DEG = { H: 0, L: 90, Lo: 180, R: -90 };   // where the guard dial's arc sits for each line (R: its right, your left)
let guardDeg = 0;
// top-right objectives checklist (training lessons, mission objectives): a window of up to 7 rows around the current one
const CHECKLIST_SETTLE = 8;   // s an objective stays up before its list folds down to it
function renderChecklist(c){
  const el = $('objlist');
  // while the checklist is up it is the one home for the objective: the top-left run line would only repeat it
  document.body.classList.toggle('has-checklist', !!c);
  if (!c){ el.classList.remove('on'); document.body.classList.remove('hx-settled'); return; }
  const nowKey = c.items.findIndex(i => i.now) + '/' + c.items.filter(i => i.done).length;
  if (el._now !== nowKey){ el._now = nowKey; el._nowAt = G.gt; el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); }   // the objective changed: flash the list
  // SETTLED (styles/heroes/tracker.css): once an objective has been up a while the list folds to the objective in hand,
  // as it does in a fight, so the corner isn't a wall of text for the whole mission. A new objective opens it again
  document.body.classList.toggle('hx-settled', G.gt - (el._nowAt ?? G.gt) > CHECKLIST_SETTLE);
  const cur = Math.max(0, c.items.findIndex(i => i.now)), n = c.items.length;
  const from = Math.max(0, Math.min(cur - 2, n - 7)), rows = c.items.slice(from, from + 7);
  el.classList.add('on');
  setHtml(el, (c.kicker ? '<div class="ol-k">' + c.kicker + '</div>' : '') + (G.ngMuts.length && !G.training ? '<div class="ol-mut">' + ngMutsHtml() + '</div>' : '') + '<div class="ol-h">' + c.title + '</div>' + rows.map(i =>
    '<div class="ol-i' + (i.done ? ' done' : i.now ? ' now' : '') + '"><b>' + (i.done ? '✓' : i.now ? '▶' : '○') + '</b><span>' + i.text + '</span></div>' +
      (i.sub && i.sub.length ? '<div class="ol-s' + (i.warn ? ' warn' : '') + '">' + i.sub.join('<br>') + (i.frac != null ? '<span class="ol-b"><i style="width:' + (clamp(i.frac, 0, 1) * 100).toFixed(1) + '%"></i></span>' : '') + '</div>' : '')).join('') +
    (n > 7 ? '<div class="ol-n">' + c.items.filter(i => i.done).length + ' / ' + n + ' DONE</div>' : '') +
    '<div class="ol-hold">HOLD ' + objectiveKey() + ' · FULL OBJECTIVE</div>');   // (ui/objective-view.js)
}

// WAYPOINT: a gold diamond over the live objective's spot, pinned to the screen edge when it is off-screen or behind
const _wp = new THREE.Vector3();
function renderWaypoint(on){
  const el = $('waypoint'); if (!el) return;
  const t = on ? (calmTarget() || objectiveTarget()) : null, pp = t && playerPos();   // (the calm after a chapter: its rally point)
  const d = t ? Math.hypot(t.x - pp.x, t.z - pp.z) : 0;
  if (!t || d < 7){ el.classList.remove('on'); return; }
  _wp.set(t.x, 3.2, t.z).project(camera);
  let x = _wp.x, y = _wp.y;
  if (_wp.z > 1){ x = -x; y = -y; }   // behind the camera: flip so it points the way to turn
  const off = _wp.z > 1 || Math.abs(x) > 0.92 || Math.abs(y) > 0.85;
  if (off){ const k = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85) || 1; x /= k; y /= k; if (_wp.z > 1) y = Math.min(y, -0.85); }
  el.style.left = ((x + 1) / 2 * 100).toFixed(2) + '%';
  el.style.top = ((1 - y) / 2 * 100).toFixed(2) + '%';
  el.classList.toggle('edge', off);
  setText(el.querySelector('.wp-d'), Math.round(d) + ' m');
  el.classList.add('on');
}

/* ABILITY COOLDOWNS — the slot shades over and counts down while a power recharges. The full length is learned from
   the moment the timer jumps up (so stance / upgrade cooldown multipliers are reflected without duplicating them). */
const _cdPrev = {}, _cdMax = {};
function cdSlot(id, key, cost, base){
  const el = $(id); if (!el || el.style.display === 'none') return;
  const left = player.cds[key] || 0, prev = _cdPrev[key] || 0;
  if (left > prev + 0.05) _cdMax[key] = left;
  _cdPrev[key] = left;
  const frac = left > 0 && _cdMax[key] ? clamp(left / _cdMax[key], 0, 1) : 0;
  el.style.setProperty('--cd', frac.toFixed(3));
  if (!el._cdt) el._cdt = el.querySelector('.cdt');
  if (el._cdt) setText(el._cdt, left >= 1 ? String(Math.ceil(left)) : '');
  if (prev > 0 && left <= 0 && (_cdMax[key] || 0) >= 2){ el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); }   // just came off cooldown
  el.classList.toggle('cool', left > 0);
  if (cost != null) el.classList.toggle('nofp', left <= 0 && player.force < (base ? floorCost(cost * (player.up.abilityCostMul || 1), base) : cost * (player.up.abilityCostMul || 1)));   // the price the cast actually charges (a Jedi power: never under the cost floor)
}

// MANDO weapon slots: 1 the sidearm · 2 the primary (the loadout: data/mando.js) · 3 the signature weapon (Disruptor or
// Darksaber, whichever you took) · 4 holstered
function renderWeaponSlots(){
  const sig = signatureWeapon(), kit = kitOf();
  const slots = isTrooper() ? [['1', 'rifle', ''], ['2', 'pistols', ''], ...(G.unlocked.launcher ? [['3', 'launcher', '']] : [])]   // (the trooper: DC-15, twin DC-17s, the Commando's launcher)
    : [['1', kit.sidearm, 'SIDEARM'], ['2', kit.primary, 'PRIMARY'], ['3', sig, ''], ['4', 'fists', '']];
  const mods = isTrooper() ? rifleMods() : [];   // the DC-15's modules the run has handed over (player/trooper/kit.js)
  let key = player.weapon + sig + (player.rifleMod || '') + mods.length;
  for (const [, w] of slots) key += (w || '-') + (w && weaponUnlocked(w) ? '1' : '0');
  const wrap = $('wslots'); if (wrap._k === key) return;
  wrap._k = key;
  // only what you carry: an empty or still-locked slot is noise from the first minute (the key still says which number it is)
  wrap.innerHTML = slots.filter(([, w]) => w && weaponUnlocked(w)).map(([k, w]) => {
    let nm = w === 'fists' ? 'HOLSTER' : MANDO_WEAPONS[w].short || MANDO_WEAPONS[w].name;
    // the DC-15 names its fitted module, with a pip for each one it carries (1 again swaps): BURST · AUTO · SCOPE
    if (w === 'rifle' && mods.length > 1){
      const cur = player.rifleMod || 'burst';
      nm += ' <span class="wmod">' + MOD_TAG[cur] + '</span><span class="wpips">' + mods.map(m => '<i class="' + (m === cur ? 'on' : '') + '"></i>').join('') + '</span>';
    }
    return '<span class="wslot' + (player.weapon === w ? ' on' : '') + '"><span class="kc">' + k + '</span>' + nm + '</span>';
  }).join('');
}

export function updateHud(){
  const mh = maxHp();
  $('hpbar').style.width = (player.hp / mh * 100) + '%';
  setText($('hpval'), Math.max(0, Math.ceil(player.hp)) + ' / ' + Math.round(mh));
  $('hpmeter').classList.toggle('low', player.hp > 0 && player.hp / mh < 0.3);
  $('fpbar').style.width = (player.force / CFG.player.maxForce * 100) + '%';
  setText($('fpval'), String(Math.max(0, Math.floor(player.force))));
  updateBoonStrip();   // active-boon strip (no-op unless the set changed)
  renderThreats();     // directional damage arc + off-screen danger markers
  // HIT MARKER — pop an X at the crosshair when a shot lands (white hit · gold headshot · red kill)
  { const hm = document.getElementById('hitmark'), t = player.hitMarkT || 0;
    if (isGunner() && t > 0){
      hm.style.opacity = Math.min(1, t * 1.5);
      hm.style.color = player.hitMarkKind === 'kill' ? '#ff4a4a' : player.hitMarkKind === 'head' ? '#ffd24a' : '#ffffff';
      hm.style.transform = 'translate(-50%,-50%) scale(' + (1 + t*0.4 + (player.hitMarkKind === 'kill' ? 0.25 : 0)).toFixed(2) + ')';
    } else hm.style.opacity = '0'; }
  // FORCE FOCUS meter — Jedi only (hidden for the Mando by CSS)
  if (!isGunner()){
    const fcw = $('fcwrap'), t = focusTier();
    $('fcbar').style.width = (player.focus || 0) + '%';
    setText($('fclabel'), t > 0 ? ('FOCUS · ' + FOCUS.names[t]) : 'FOCUS');
    fcw.classList.toggle('t3', t >= 3);
  }
  // THE GUNNERS' FLOW METERS — HUNTER'S EYE (the Mando) and BATTLE RHYTHM (the trooper): player/gunner-flow.js
  { const D = flowDef(), gm = $('gfmeter');
    gm.classList.toggle('on', !!D);
    if (D){
      const t = flowTier(), mando = isMando();
      gm.classList.toggle('tr', !mando); gm.classList.toggle('t3', t >= 3);
      $('gfbar').style.width = (player.flowSig ? 0 : (player.flow || 0)) + '%';
      setText($('gflabel'), (mando ? 'HUNTER\'S EYE' : 'BATTLE RHYTHM') + (t > 0 && t < 3 ? ' · ' + D.names[t] : ''));
      setText($('gfval'), t >= 3 ? D.names[3] + ' · ' + flowKeyLabel() : '');
    } }
  // FORM VII FURY meter — only while Juyo (FURY) or Vaapad (CONTROL) is the active form; glows when full
  { const fk = furyKind(), fm = $('fymeter');
    fm.classList.toggle('on', !!fk);
    if (fk){
      const f = player.fury || 0, full = f >= 0.999;
      fm.classList.toggle('vaapad', fk === 'vaapad'); fm.classList.toggle('full', full);
      $('fybar').style.width = (f * 100) + '%';
      setText($('fylabel'), fk === 'juyo' ? 'FURY' : 'CONTROL');
      setText($('fyval'), full ? 'FULL' : '');
    } }
  const jx = jediReticle();   // where the Jedi's crosshair sits this frame (its gauges ride along with it)
  // JET FUEL now reads on the JETPACK itself (diegetic LED gauge); JEDI stamina lives by the crosshair — bar unused
  document.getElementById('smwrap').style.display = 'none';
  // Crosshair-side gauge — sits right beside the reticle/crosshair so your swing fuel reads without glancing away.
  //  JEDI: violet SABER STAMINA.  MANDO: energy/HEAT (blasters, blue) or stamina (DARKSABER, violet). The Mando
  //  version tracks the free-aim reticle drift; the Jedi's follows his crosshair, wherever it lands (jediReticle).
  { const em = document.getElementById('energymeter'), ef = document.getElementById('energyfill');
    const showE = G.mode === 'play' && (G.hero === 'jedi' || isGunner());
    em.style.display = showE ? 'block' : 'none';
    if (showE){
      const saber = G.hero === 'jedi' || mandoWeapon().melee;   // saber forms → stamina gauge; blasters → heat gauge
      if (saber){
        ef.style.height = (player.stam / maxStam() * 100) + '%';
        em.classList.add('saberbar');
        em.classList.toggle('over', player.exhausted);   // guard broken → flashes red
      } else {
        // the trooper's twin DC-17s read as two bars, one a pistol (left bar the left gun): mando/weapons.js coolTwin
        const twin = mandoWeapon().fire === 'twin', ef2 = document.getElementById('energyfill2');
        em.classList.toggle('twin', twin);
        ef.style.height = ((1 - (twin ? (player.hR || 0) : player.heat)) * 100) + '%';
        if (twin){ ef2.style.height = ((1 - (player.hL || 0)) * 100) + '%'; ef.classList.toggle('hot', !!player.oR); ef2.classList.toggle('hot', !!player.oL); }
        else ef.classList.remove('hot');
        em.classList.remove('saberbar');
        em.classList.toggle('over', player.overheat);
      }
      // out of the way while it's full: it fades in as soon as it drains and out a moment after it fills back up
      const lvl = saber ? player.stam / maxStam() : 1 - Math.max(player.heat || 0, player.hR || 0, player.hL || 0);
      if (lvl < 0.995 || em.classList.contains('over')) gaugeFullAt = G.gt;
      em.classList.toggle('full', G.gt - gaugeFullAt > 0.7);
      em.style.transform = !dynamicCrosshair() ? 'translate(' + player.aimOff.x.toFixed(1) + 'px,' + player.aimOff.y.toFixed(1) + 'px)' : jx.tf;
    } }
  // bottom XP meter — fills toward the next skill point in the story (game/upgrades.js), else the next affordable ability
  { const goal = nextStoreGoal(), xm = document.getElementById('xpmeter');
    const showX = G.mode === 'play';
    xm.style.display = showX ? 'block' : 'none';
    if (showX && storyRun()){
      const have = xpTowardPoint();
      $('xpmeterfill').style.width = (clamp(have / XP_PER_POINT, 0, 1) * 100) + '%';
      xm.classList.remove('ready');
      setHtml($('xpmetertxt'), '<span class="nx">NEXT</span> TRAINING POINT <span class="nx">· ' + have + ' / ' + XP_PER_POINT + ' XP</span>');
    } else if (showX){
      if (goal){ const frac = clamp((G.xp || 0) / goal.cost, 0, 1);
        $('xpmeterfill').style.width = (frac*100) + '%';
        xm.classList.toggle('ready', frac >= 1);
        setHtml($('xpmetertxt'), frac >= 1 ? 'READY TO UNLOCK · ' + goal.nm
          : '<span class="nx">NEXT</span> ' + goal.nm + ' <span class="nx">· ' + (G.xp||0) + ' / ' + goal.cost + ' XP</span>');
      } else { $('xpmeterfill').style.width = '100%'; xm.classList.remove('ready');
        setText($('xpmetertxt'), 'XP ' + (G.xp || 0)); } } }
  const L = LEVELS[G.levelIdx];
  let alive = 0;
  for (const e of enemies) if (!e.dead && !e.converted) alive++;
  const total = alive + G.spawnQueue.filter(s => !s.barrier).length;
  // run progress: where you are · which wave · what's left
  const hostiles = total > 0 ? '<span class="wi-h">' + total + ' HOSTILE' + (total === 1 ? '' : 'S') + ' REMAIN</span>' : '';
  document.body.classList.toggle('training', !!G.training);
  document.body.classList.toggle('mission-play', !!G.mission);
  document.body.classList.toggle('sandbox', !!G.sandbox);
  document.body.classList.toggle('hub', !!G.hub);
  const calm = G.mode === 'play' && calmHud();   // the calm after a chapter's last fight (game/aftermath.js): its line, in any chapter
  if (calm){
    setHtml($('waveinfo'), '<span class="wi-l">' + chapterLabel() + ' · COMPLETE</span><span class="wi-w">' + calm.title + '</span><span class="wi-h">' + calm.status + '</span>');
  } else if (G.training){
    const tp = trainingProgress();
    setHtml($('waveinfo'), '<span class="wi-l">TRAINING · ' + tp.place + '</span><span class="wi-w">' + tp.name + '</span>' +
      (tp.total ? '<span class="wi-h">STEP ' + tp.lesson + ' / ' + tp.total + '</span><span class="wi-bar"><i style="width:' + ((tp.lesson - 1) / tp.total * 100).toFixed(1) + '%"></i></span>' : ''));
  } else if (G.zone && zoneDef()){   // an open zone (game/zone.js): where in it you are, and the waystones you've touched
    const Z = zoneDef(), d = zoneDistrict(), q = zoneQuestHud();   // (a side quest under way: its step instead, game/zone-quests.js)
    if (q) setHtml($('waveinfo'), '<span class="wi-l">' + q.kicker + '</span><span class="wi-w">' + q.title + '</span><span class="wi-h">' + q.status + '</span>');
    else setHtml($('waveinfo'), '<span class="wi-l">OPEN ZONE · ' + Z.place + '</span><span class="wi-w">' + (d ? d.name : Z.name) + '</span>' +
      '<span class="wi-h">WAYSTONES ' + stonesTouched().length + ' / ' + Z.waystones.length + ' · F AT A WAYSTONE TO TRAVEL</span>');
  } else if (G.mission){
    const o = objectiveHud();
    if (o) setHtml($('waveinfo'), '<span class="wi-l">' + o.kicker + '</span><span class="wi-w">' + o.title + '</span>' +
      '<span class="wi-h' + (o.warn ? ' warn' : '') + '">' + o.status + '</span>' +
      (o.frac != null ? '<span class="wi-bar"><i style="width:' + (clamp(o.frac, 0, 1) * 100).toFixed(1) + '%"></i></span>' : '') + ngTag());
  } else if (G.hub){
    const wing = ((shared.arenaLevel && shared.arenaLevel.name.split('—')[1]) || '').trim();
    const Hb = HUBS[G.hubId] || HUBS.temple;   // (data/hub.js: the temple, the citadel…)
    setHtml($('waveinfo'), '<span class="wi-l">' + Hb.name + ' · ' + Hb.place + '</span><span class="wi-w">' + wing + '</span><span class="wi-h">F AT A STATION · WALK THROUGH A DOOR TO ANOTHER ' + Hb.room + '</span>');
  } else if (G.sandbox){
    const room = ((shared.arenaLevel && shared.arenaLevel.name.split('—')[1]) || (isGunner() ? 'THE THRONE ROOM' : 'THE TRAINING ROOM')).trim();   // the room, or the battle map picked
    setHtml($('waveinfo'), '<span class="wi-l">SANDBOX · ' + room + '</span><span class="wi-w">PRESS B FOR FOES &amp; POWERS</span>' + hostiles +
      (G.sandboxGod ? '<span class="wi-h">GOD MODE</span>' : ''));
  } else if (G.endless){
    const mut = G.mut ? MUTATORS.find(m => m.id === G.mut) : null;
    setHtml($('waveinfo'), '<span class="wi-l">SURVIVAL</span><span class="wi-w">WAVE ' + G.endlessWave + '</span>' + hostiles +
      (mut ? '<span class="wi-h"><span class="wi-mut" style="color:' + mut.col + '">' + mut.name + '</span></span>' : ''));
  } else {
    const place = (L.name.split('—')[1] || L.name).trim();
    const from = G.waveFrom || 0, end = G.waveEnd ?? L.waves.length;   // a campaign chapter counts its own stretch of the waves
    const wave = bossUp() ? 'BOSS FIGHT'
                             : 'WAVE ' + Math.min(G.wave - from + 1, end - from) + ' / ' + (end - from);
    setHtml($('waveinfo'), '<span class="wi-l">' + (G.chapter >= 0 ? chapterLabel() : 'LEVEL ' + (G.levelIdx + 1) + ' · ' + place) + '</span><span class="wi-w">' + wave + '</span>' +
      (bossUp() ? '' : hostiles) + ngTag());
  }
  { const ro = $('readout'), on = !!G.sandbox && G.mode === 'play' && readoutOn(); ro.style.display = on ? 'block' : 'none'; if (on) setHtml(ro, readoutLiveHtml()); }
  renderWaypoint(G.mode === 'play' && !G.sandbox && !G.training && (!!G.mission || !!calm));
  renderCompass();   // the strip along the top: N / E / S / W and the marks (ui/compass.js)
  { const c = G.mode === 'play' && !G.sandbox ? (calm ? { kicker: chapterLabel() + ' · COMPLETE', title: calm.title, items: [{ text: calm.status, now: true }] }   // (the calm after a chapter)
                                                : G.training ? trainingChecklist() : G.mission ? missionChecklist() : null) : null;
    if (c && G.training && !c.kicker) c.kicker = 'TRAINING · ' + trainingProgress().place;   // (the run line it stands in for)
    renderChecklist(c); }
  // QUIET IN A FIGHT (styles/heroes/tracker.css): while fighting, the checklist keeps only the objective in hand; it opens
  // out again a moment after the fight goes quiet, or while HOLD O is up (it is the full view)
  { const fight = G.mode === 'play' && inCombat();
    if (fight) fightT = G.gt; document.body.classList.toggle('hx-fight', G.mode === 'play' && G.gt - fightT < FIGHT_LINGER); }
  // THE CUT DIAL (player/jedi/cutaim.js): the angle the next cut comes from (hidden for a keyed cut: the thrust, the
  // back strike). Its height is where the crosshair sits on the foe, so the crosshair itself shows that
  { const on = G.mode === 'play' && !player.unlit && (isGunner() ? player.weapon === 'darksaber' : !player.holstered);   // (unlit: the blade put out with 5)
    const cd = $('cutdial');
    if (cd){
      cd.style.transform = dynamicCrosshair() ? jx.tf : '';
      // THE GUARD DIAL (player/jedi/guardline.js): with the guard up against a duellist the same keys and flicks place
      // the guard, so the dial shows that instead: an arc on the side it covers (gold: placed by hand; dim: still turning)
      const gd = on ? guardDial() : null, gl = $('guarddial');
      const nx = on && !gd && player.atkT <= 0 ? pickCut(0, false) : null, ang = nx && nx.pat.ang;
      cd.style.display = ang != null ? '' : 'none';
      if (ang != null){ cd.firstChild.style.transform = 'rotate(' + (90 - ang).toFixed(0) + 'deg)'; cd.classList.toggle('live', !!nx.flick); }
      if (gl){
        gl.style.display = gd ? '' : 'none';
        if (gd){
          gl.style.transform = cd.style.transform;
          const want = GUARD_DIAL_DEG[gd.line];
          guardDeg += ((want - guardDeg) % 360 + 540) % 360 - 180;   // (the short way round)
          gl.firstChild.style.transform = 'rotate(' + guardDeg + 'deg)';
          gl.classList.toggle('placed', gd.placed); gl.classList.toggle('turning', gd.turning); gl.classList.toggle('hit', gd.flash > 0.35);
        }
      }
    } }
  if (!isGunner()){   // holstered (4): LMB is a Force strike and RMB a ward instead of saber and block
    setText($('ab-atk').querySelector('.an'), player.holstered ? 'FORCE STRIKE' : 'SABER');
    setText($('ab-block').querySelector('.an'), player.holstered ? 'WARD' : 'BLOCK');
    setText($('ab-lit').querySelector('.an'), player.holstered ? 'DRAW + IGNITE' : player.unlit ? 'IGNITE' : 'RETRACT');   // Z or 5 (player/holster.js toggleBlade)
    $('ab-lit').classList.toggle('off', !!player.unlit || !!player.holstered);
  } else {   // the Mando's 5 works on the Darksaber in hand
    const dl = $('ab-dlit'), on = isMando() && player.weapon === 'darksaber';
    if (dl.style.display !== (on ? '' : 'none')) dl.style.display = on ? '' : 'none';
    if (on){ setText(dl.querySelector('.an'), player.unlit ? 'IGNITE' : 'RETRACT'); dl.classList.toggle('off', !!player.unlit); }
  }
  // the crosshair turns red on a foe: that's who a cut or a power aimed now would land on (jediReticle). The Mando
  // draws it too while the Darksaber is out, in place of the blaster reticle
  { const dyn = dynamicCrosshair(), xh = $('xh');
    document.body.classList.toggle('dynxh', isGunner() && dyn);
    if (xh && dyn){ xh.style.transform = jx.tf; xh.classList.toggle('on', G.mode === 'play' && jx.foe && G.aimHint !== false); } }   // (Settings · AIM HINT)
  if (isGunner()){
    // weapon + ammo readout
    const W = mandoWeapon();
    renderWeaponSlots();
    setText($('wpnLabel'), W.short || W.name);
    const ammoEl = document.getElementById('ammoLabel');
    ammoEl.textContent = W.melee ? '— —' : (W.fire === 'rifle' && !player.zoom) ? 'SPEAR' : (player.overheat ? 'OVERHEAT' : Math.round((1 - player.heat) * 100) + '%');
    document.getElementById('ab-blaster').classList.toggle('reloading', player.overheat);
    document.getElementById('ab-blaster').classList.toggle('nofp', !W.melee && player.overheat);
    document.getElementById('ab-reload').classList.toggle('cool', player.overheat || player.ventT > 0);
    document.getElementById('ab-reload').classList.toggle('nofp', !W.melee && player.heat <= 0.02);
    // RMB chip tells you what bracing DOES on this weapon: SINGLE (and his fists) raises the beskar GUARD; DUAL is an
    // offensive brace; the Darksaber GUARDS; the Disruptor SCOPES. Flag the guard when it's out of stamina to hold.
    const braceEl = document.getElementById('ab-brace');
    if (braceEl){
      // (the Mando's tap of RMB is the BESKAR PARRY on every gun and on his fists, so the chip says so on all of them;
      // the Darksaber parries like a lightsaber and the trooper has none)
      const hold = W.fire === 'fists' || W.melee ? 'GUARD' : W.scope ? 'SCOPE' : player.weapon === 'single' ? 'GUARD' : 'BRACE';
      const taps = isMando() && player.weapon !== 'darksaber';
      setText(braceEl.querySelector('.an'), taps ? 'PARRY · ' + hold : hold);
      braceEl.classList.toggle('live', taps && player.beskarT > 0);   // the parry's window is open
      braceEl.classList.toggle('nofp', (player.weapon === 'single' || player.weapon === 'fists') && player.blockHeld && player.stam <= 0);
      braceEl.classList.toggle('cool', player.beskarLockT > 0);   // a whiffed beskar parry: no new window for a beat
    }
    guardCueHud();
    // E chip: behind the raised guard, E cuts with the vibroblade instead of punching
    const meleeEl = document.getElementById('ab-melee');
    if (meleeEl) setText(meleeEl.querySelector('.an'), player.guardUp ? 'BLADE' : 'PUNCH');
    // cooldown / fuel-gated abilities
    const cdab = [['ab-rocket','rocket',abil('rocket').cost],['ab-deto','deto',abil('deto').cost],
                  ['ab-birds','birds',abil('birds').cost],['ab-grapple','grapple',abil('grapple').cost],
                  ['ab-missile','missile',abil('jetmissile').cost],['ab-bacta','bacta',abil('bacta').cost],
                  ['ab-dthrow','darkThrow',MANDO.darkThrow.cost]];
    for (const [id, key, cost] of cdab) cdSlot(id, key, cost);
    if (isTrooper()){   // the ARC trooper's powers (player/trooper/abilities.js) and its frag charges
      for (const id of ['scan', 'bshield', 'ion', 'breach', 'artillery', 'strafe']) cdSlot('ab-' + id, id, abil(id).cost);
      const fr = $('ab-frag');
      if (fr){
        const n = fragCharges(), max = fragMax();
        if (!fr._chg){ fr.insertAdjacentHTML('beforeend', '<span class="chg"></span>'); fr._chg = fr.querySelector('.chg'); }
        setHtml(fr._chg, '<i class="on"></i>'.repeat(n) + '<i></i>'.repeat(Math.max(0, max - n)));
        fr.style.setProperty('--cd', n < 1 ? (1 - (player.fragT || 0) / TROOPER.frag.recharge).toFixed(3) : '0');
        fr.classList.toggle('cool', n < 1);
      }
    }
    document.getElementById('ab-flame').classList.toggle('nofp', player.force < 5);
    document.getElementById('ab-flame').classList.toggle('cool', !!player.flaming);
    document.getElementById('ab-jet').classList.toggle('nofp', player.jet < 12);    // jet FUEL low
    document.getElementById('ab-jet').classList.toggle('cool', !!player.jetActive);
    mandoShiftSlot();
    if (isTrooper()){   // the trooper's hint chips say what its keys do
      const sb = $('ab-boost');   // (no jet charges and no cooldown on a sprint: it's held SHIFT)
      setText(sb.querySelector('.an'), 'SPRINT'); sb.classList.remove('cool'); if (sb._chg) setHtml(sb._chg, '');
      if (meleeEl) setText(meleeEl.querySelector('.an'), 'BASH');
      if (braceEl) setText(braceEl.querySelector('.an'), mandoWeapon().scope ? 'SCOPE' : 'AIM');   // the marksman module raises a scope
    }
    document.getElementById('ab-mslam').classList.toggle('nofp', player.grounded || player.jet < abil('mslam').cost);   // air-only, jet fuel
    // DYNAMIC CROSSHAIR — line gap / colour / ring react to the situation
    const rt = document.getElementById('reticle');
    if (rt){
      const W = mandoWeapon(), adsAim = (player.blockHeld || player.zoom) && !W.melee;   // bracing/scoping a blaster → ADS star
      // THE GAP IS THE CONE: the shot's real spread right now (player/mando/weapons.js shotSpread: the gun, bracing,
      // speed, the jetpack, suppression), turned into pixels through the lens's current FOV, so the lines sit where
      // the outermost bolt can land (and close in as the ADS zoom does). The recoil kick opens it for a beat.
      let spr = W.melee ? 0 : shotSpread(W);
      if (gunId() === 'repeater' && player.planted) spr *= moveOf('repeater').cone;   // PLANT (player/gun-moves.js)
      const pxPerRad = innerHeight / 2 / Math.tan(camera.fov * Math.PI / 360);
      const gap = clamp(Math.tan(spr) * pxPerRad + player.recoilKick * 10, 3, 90);   // (never inside the dot, so the cross reads)
      let col = '120,210,255', ringOp = 0.24, dotOp = 0.9;
      if (player.blockHeld){ col = '158,176,191'; }                // bracing → beskar-steel
      if (hasPack() && player.jet < 18){ col = '255,120,70'; }     // low jet fuel → amber-red warning (no pack yet: no fuel to warn of)
      if (player.lockOn){ col = '255,207,74'; ringOp = 0.6; dotOp = 1; }   // target under the reticle → gold
      rt.style.setProperty('--gap', gap.toFixed(1) + 'px');
      rt.style.setProperty('--col', col);
      rt.style.setProperty('--ringScale', (player.zoom ? 0.66 : 1).toFixed(2));
      rt.style.setProperty('--ringOp', ringOp.toFixed(2));
      rt.style.setProperty('--dotOp', dotOp.toFixed(2));
      rt.style.transform = 'translate(' + player.aimOff.x.toFixed(1) + 'px,' + player.aimOff.y.toFixed(1) + 'px)';   // free-aim drift
      rt.classList.toggle('reload', player.overheat);
      rt.classList.toggle('lock', !!player.lockOn);
      rt.classList.toggle('ads', adsAim);   // collapse into the tight 4-point STAR while aiming/bracing
      rt.classList.toggle('blocked', !!player.muzzleBlocked);   // cover in front of the barrel the lens sees over (mando/weapons.js muzzleBlocked)
    }
    return;
  }
  document.getElementById('ab-block').classList.toggle('nofp', player.stam < CFG.player.blockStamCost);
  const jediSlots = [['ab-push','push',abil('push').cost],['ab-slam','slam',abil('jslam').cost],
                ['ab-throw','throw',abil('throw').cost],
                ['ab-pull','pull',abil('pull').cost],['ab-judge','judge',abil('judge').cost],
                ['ab-repulse','repulse',abil('repulse').cost],['ab-barrier','barrier',abil('barrier').cost],
                ['ab-mend','mend',abil('mend').cost]];
  for (const [id, key, cost] of jediSlots) cdSlot(id, key, cost, baseCost(key));
  dashSlot();
}

/* MANDO SHIFT: what it does right now (DIVE on the ground, AIR DODGE in the air), with
   pips for the air-dodge jet charges. */
/* THE GUARD CUE — the Mando's answer to "am I covered?", drawn round the reticle (styles/hud.css #guardcue) from what
   mando/weapons.js already knows: player.guardCue (1 the vambrace is up · 2 RMB is held on the pistol but a shot has
   lowered it), the stamina behind it, a hit just taken on it, and the parry tap's window and lockout (any gun). */
function guardCueHud(){
  const gc = document.getElementById('guardcue');
  if (!gc) return;
  const live = G.mode === 'play' && isMando() && player.weapon !== 'darksaber';
  const cue = live ? player.guardCue || 0 : 0, dry = player.stam <= 0;
  const cl = gc.classList;
  cl.toggle('up', cue === 1 && !dry);
  cl.toggle('down', cue === 2 || (cue === 1 && dry));
  cl.toggle('low', cue > 0 && player.stam < maxStam() * BESKAR_GUARD.low);
  cl.toggle('hit', cue === 1 && (player.guardJolt || 0) > 0.35);
  const tap = live && player.beskarT > 0, caught = live && !tap && player.beskarHit && player.beskarPose > 0;
  cl.toggle('tap', tap);
  cl.toggle('caught', caught);
  cl.toggle('lock', live && !tap && !caught && cue !== 1 && player.beskarLockT > 0);   // (behind a raised guard the brackets already say he is covered)
  const tf = 'translate(' + player.aimOff.x.toFixed(1) + 'px,' + player.aimOff.y.toFixed(1) + 'px)';
  if (gc._tf !== tf){ gc._tf = tf; gc.style.transform = tf; }
}
function mandoShiftSlot(){
  const el = $('ab-boost'); if (!el) return;
  const A = MANDO_MOBILITY.airDodge, n = player.jetCharges ?? A.charges, fight = inCombat(), air = !player.grounded;
  if (!el._chg){ el.insertAdjacentHTML('beforeend', '<span class="chg"></span>'); el._chg = el.querySelector('.chg'); }
  if (!hasPack()){   // on his feet (no pack yet: game/pack.js): SHIFT is the dive alone, no jet charges to show
    setHtml(el._chg, ''); el.classList.toggle('cool', air || player.cds.roll > 0); setText(el.querySelector('.an'), 'DIVE');
    return;
  }
  setHtml(el._chg, '<i class="on"></i>'.repeat(n) + '<i></i>'.repeat(Math.max(0, A.charges - n)));
  const fl = player.flip, diving = !!fl && fl.kind === 'dive' && !fl.landT;   // in a dive's air SHIFT is the jet dive
  const cool = diving ? (!!fl.jet || player.jet < MANDO_MOBILITY.dive.jet.fuel)
             : air ? (player.jet < A.fuel || (fight && n < 1)) : player.cds.roll > 0;
  el.classList.toggle('cool', cool);
  setText(el.querySelector('.an'), diving ? 'JET DIVE' : air ? 'AIR DODGE' : 'DIVE');
}

/* DASH: pips for the Force dash charges, the shade showing the next one refilling. Out of a fight the dash is free:
   the slot reads ready whatever the charges say. */
function dashSlot(){
  const el = $('ab-dash'); if (!el || el.style.display === 'none') return;
  const max = maxCharges(), n = player.dashCharges ?? max, fight = inCombat();
  if (!el._chg){ el.insertAdjacentHTML('beforeend', '<span class="chg"></span>'); el._chg = el.querySelector('.chg'); }
  setHtml(el._chg, '<i class="on"></i>'.repeat(n) + '<i></i>'.repeat(Math.max(0, max - n)));
  const empty = fight && n < 1;
  el.style.setProperty('--cd', empty ? (1 - (player.dashRecharge || 0)).toFixed(3) : '0');
  el.classList.toggle('cool', empty);
  el.classList.toggle('nofp', fight && !empty && player.force < MOBILITY.dash.cost * (formMob().dashCost ?? 1));
  setText(el.querySelector('.an'), fight ? 'ROLL' : 'DASH');
}
