// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ARMORY: the Mando's guns, his counterpart of the Jedi's Forms page (ui/forms-ui.js), built from the same
// look. Two slots (1 SIDEARM, 2 PRIMARY; data/mando.js) and a card per gun with what it's good and bad at
// (ARMORY_CODEX). Guns the hero hasn't been handed yet stand as locked chips. It opens three ways:
//   · BEFORE THE FIGHT — BEGIN on a mission (Mando) opens it in the menu's #forms panel: pick the two guns to carry
//   · ARMORY on the pause screen — read only, for the run in progress (the sandbox changes its guns in its panel, B)
//   · A NEW GUN in a run, for a slot that's already full (game/armory.js grantGun) — the fight freezes and the hero
//     picks which of the two to carry, like the Jedi's meditation. Its own #armory panel, over the fight.

import { G, shared, isTrooper } from '../state.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { MANDO_WEAPONS, ARMORY_CODEX, KIT_SLOTS, KIT_LABEL, cleanKit, kitOf, bestKit, signatureWeapon, weaponOwned } from '../data/mando.js';
import { setKit, setArmoryPickHook } from '../game/armory.js';
import { autosave } from '../game/autosave.js';
import { refreshSandboxScope, storyReached } from '../game/sandbox-unlocks.js';
import { coopRun } from '../net/run.js';
import { TROOPER_ARMORY } from '../data/trooper.js';
import { movePart, masteryPart, gunRankNow } from './gun-moves-ui.js';
import { GUN_ORDER, GUN_MOVES, GUN_RANKS } from '../data/gun-moves.js';
import { svgIcon } from './icons.js';
import { tabRow, pips, rankTrack, LOCK_IC, revealDetail } from './mastery-kit.js';
import { gunId } from '../player/gun-moves.js';
import { forceToastHolds } from './force-toast.js';

const menuPanel = document.getElementById('forms');
const runPanel = document.getElementById('armory');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
export const ARMORY_ORDER = ['single', 'dual', 'carbine', 'repeater'];
const HUE = { single: 0xffb84a, dual: 0xffd24a, carbine: 0x8fe8ff, repeater: 0xff8a4a, disruptor: 0x7fe0ff };
const slotName = (W) => W.slot ? KIT_LABEL[W.slot] : 'SIGNATURE · 3';

let ctx = null;   // { mode: 'prefight' | 'codex' | 'pick', panel, edit, known, kit, focus, note, fresh, onGo }

/* ---------- what the page shows ---------- */
// the guns the story has handed out so far, across every run (the same set the sandbox and the missions offer)
const storyGuns = () => { refreshSandboxScope(); return ARMORY_ORDER.filter(id => id === 'single' || storyReached(id)); };
function savedKit(known){
  let kit = null;
  try { kit = JSON.parse(localStorage.getItem('sw_mission_kit')); } catch(e){}
  return cleanKit(kit || bestKit(id => known.includes(id)), id => known.includes(id));
}

/* ---------- render: laid out like the profile and the Jedi's forms page (ui/mastery-kit.js) ----------
   On the left what you carry, on the right a tile per gun with ONE gun's detail beside them, cut into ABOUT · MOVE ·
   MASTERY. styles/heroes/mastery.css paints it as beskar plate (the Mando) or an orders readout (the trooper). */
const gunName = (id) => MANDO_WEAPONS[id].name;
const GUN_IC = { single: 'scope', dual: 'bolts', carbine: 'burst', repeater: 'impact', disruptor: 'comet', burst: 'bolts', auto: 'impact', marksman: 'scope', pistols: 'bolt' };
const gunIc = (id, big) => '<span class="mx-pic' + (big ? ' big' : '') + '">' + svgIcon(GUN_IC[id] || 'bolt', 'mx-pic-ic') + '</span>';
const heroOf = () => ctx.trooper ? 'trooper' : 'mando';
let entering = false;   // the panel's entrance plays on opening, not on every tap
const stars = (id) => { const r = gunRankNow(id); return pips(r) + '<span>' + (r ? GUN_RANKS.title[r] : 'UNRANKED') + '</span>'; };

function slotPlate(n, label, id, col){
  return '<div class="mx-slotw"><div class="mx-slot' + (id ? '' : ' empty') + '"' + (id ? ' style="--c:' + hex(col) + '"' : '') + '><kbd>' + n + '</kbd>' +
    (id ? gunIc(id) : '') + '<div class="mx-sn"><span>' + esc(label) + '</span><b>' + (id ? esc(ctx.trooper ? TROOPER_ARMORY[id].name : gunName(id)) : id === null ? LOCK_IC : 'AT THE FORGE') + '</b></div></div></div>';
}
function loadoutCard(){
  let rows;
  if (ctx.trooper){
    const rifle = G.mode !== 'menu' && gunId() !== 'pistols' && ctx.known.includes(gunId()) ? gunId() : 'burst';
    rows = slotPlate(1, 'RIFLE', rifle, TROOPER_ARMORY[rifle].col) + slotPlate(2, 'SIDEARMS', ctx.known.includes('pistols') ? 'pistols' : null, TROOPER_ARMORY.pistols.col);
  } else {
    const sig = signatureWeapon();
    rows = KIT_SLOTS.map((s, i) => slotPlate(i + 1, KIT_LABEL[s], ctx.kit[s] || null, HUE[ctx.kit[s]] || 0)).join('') +
      (ctx.mode !== 'prefight' && weaponOwned(sig) ? slotPlate(3, 'SIGNATURE', sig, HUE[sig] || 0x7fe0ff) : '');   // (shown once it's forged: never named before)
  }
  return '<div class="mx-card mx-three"><div class="mx-k">' + (ctx.trooper ? 'YOUR GUNS' : 'YOUR LOADOUT') + '<em>' + (ctx.edit ? 'pick a gun for its slot' : 'the numbers switch in the fight') + '</em></div><div class="mx-slots">' + rows + '</div>' +
    (ctx.note ? '<p class="mx-note">' + esc(ctx.note) + '</p>' : '') + '</div>';
}
// how many guns you have, never how many there are (that would give the story away)
function countCard(){
  const n = ctx.known.length;
  return '<div class="mx-card mx-lv"><div class="mx-k">' + (ctx.trooper ? 'THE ARMORY' : 'THE COVERT\'S RACK') + '</div><div class="mx-big"><b>' + n + '</b><span>' + (n === 1 ? 'gun' : 'guns') + ' found</span></div>' +
    '<p>Each has one move only it does, and ranks earned by using it.</p></div>';
}
function tile(id){
  const T = ctx.trooper ? TROOPER_ARMORY[id] : null, W = T ? null : MANDO_WEAPONS[id], C = T ? T : (ARMORY_CODEX[id] || {});
  const carried = T ? G.mode !== 'menu' && gunId() === id : W.slot ? ctx.kit[W.slot] === id : signatureWeapon() === id;
  const badge = carried ? (T ? 'IN HAND' : 'CARRIED') : id === ctx.fresh ? 'NEW' : '';
  return '<div class="mx-tile gun' + (id === ctx.focus ? ' sel' : '') + (carried ? ' in' : '') + (id === ctx.fresh ? ' fresh' : '') + '" data-gun="' + id + '" style="--c:' + hex(T ? T.col : HUE[id]) + '">' +
    '<div class="mx-tt"><span>' + esc(T ? T.slot : slotName(W)) + '</span>' + (badge ? '<em class="mx-badge">' + badge + '</em>' : '') + '</div>' + gunIc(id) +
    '<b>' + esc(T ? T.name : W.name) + '</b><div class="mx-tf">' + esc(C.tag || '') + '</div><div class="mx-tr">' + stars(id) + '</div></div>';
}
// the guns still to find stand as one sealed tile: not named, not counted, no slot
const sealedTiles = (locked) => locked.length ? '<div class="mx-tile gun sealed" title="Guns still to find"><div class="mx-tt"><span>STILL TO FIND</span></div><b>' + LOCK_IC + '</b><div class="mx-tf">THE STORY HANDS YOU MORE</div></div>' : '';
function detail(){
  const id = ctx.focus;
  if (!id || !ctx.known.includes(id)) return '<div class="mx-detail empty">Pick a gun to see what it is good and bad at.</div>';
  const T = ctx.trooper ? TROOPER_ARMORY[id] : null, W = T ? null : MANDO_WEAPONS[id], C = T ? T : (ARMORY_CODEX[id] || {});
  const parts = [['about', 'ABOUT']].concat(GUN_MOVES[id] ? [['move', 'MOVE'], ['mastery', 'MASTERY']] : []);
  const on = parts.some(([k]) => k === ctx.dtab) ? ctx.dtab : 'about';
  const about = (C.lore ? '<p class="mx-lore">' + esc(C.lore) + '</p>' : '') +
    ((C.pros || C.cons) ? '<ul class="mx-pc">' + (C.pros || []).map(t => '<li class="up">' + esc(t) + '</li>').join('') + (C.cons || []).map(t => '<li class="dn">' + esc(t) + '</li>').join('') + '</ul>' : '');
  return '<div class="mx-detail" style="--c:' + hex(T ? T.col : HUE[id]) + '"><div class="mx-dh">' + gunIc(id, true) + '<div class="mx-dn"><div class="mx-k">' + esc(T ? T.slot : slotName(W)) + ' · ' + esc(C.tag || '') + '</div>' +
    '<b>' + esc(T ? T.name : W.name) + '</b>' + (C.best ? '<em>Best against ' + esc(C.best.charAt(0).toLowerCase() + C.best.slice(1)) + '</em>' : '') + '</div></div>' +
    tabRow(parts, on, 'dtab', 'mx-dtabs') + '<div class="mx-dbody">' + (on === 'move' ? movePart(id) : on === 'mastery' ? masteryPart(id, rankTrack) : about) + '</div></div>';
}
function render(){
  const all = ctx.trooper ? GUN_ORDER.trooper : ARMORY_ORDER.concat(ctx.mode === 'codex' ? ['disruptor'] : []);
  const shown = ctx.trooper ? ctx.known : all.filter(id => ctx.known.includes(id) && (id !== 'disruptor' || ctx.mode === 'codex'));
  const title = ctx.mode === 'prefight' ? 'BEFORE THE FIGHT' : ctx.mode === 'pick' ? 'A NEW GUN' : 'THE ARMORY';
  const head = ctx.trooper ? shown.length + (shown.length === 1 ? ' gun' : ' guns') + ' · a signature move and mastery each' : ctx.known.length + (ctx.known.length === 1 ? ' gun' : ' guns') + ' in the armory';
  const actions = ctx.mode === 'prefight' ? '<div class="mx-actions"><div class="btn" data-x="1">BACK</div><div class="btn primary go" data-go="1">FIGHT</div></div>'
    : ctx.mode === 'pick' ? '<div class="mx-actions"><div class="btn primary go" data-go="1">CARRY THESE</div></div>' : '';
  const locked = (ctx.trooper ? GUN_ORDER.trooper : ARMORY_ORDER).filter(id => !ctx.known.includes(id));
  ctx.panel.dataset.hero = heroOf();
  ctx.panel.innerHTML = '<div class="howto-panel mx' + (entering ? ' enter' : '') + (ctx.mode === 'codex' ? '' : ' pre') + '" data-hero="' + heroOf() + '">' +
    '<div class="howto-head"><div class="howto-title">' + title + '</div><div class="rm-sub">' + head + '</div>' + (ctx.mode === 'pick' ? '' : '<div class="howto-x" data-x="1">✕</div>') + '</div>' +
    '<div class="mx-body"><div class="mx-left">' + loadoutCard() + (ctx.mode === 'codex' ? countCard() : '') + '</div>' +
    '<div class="mx-right"><div class="mx-split"><div class="mx-grid">' + shown.map(tile).join('') + sealedTiles(locked) + '</div>' + detail() + '</div></div></div>' + actions + '</div>';
}
const trooperOwned = (id) => !TROOPER_ARMORY[id].unlock || !!(G.unlocked && G.unlocked[TROOPER_ARMORY[id].unlock]);

function show(el){ ctx.dtab = 'about'; entering = true; render(); entering = false; el.classList.add('open'); }

/* ---------- picking: a gun goes into its own slot ---------- */
function pick(id){
  ctx.focus = id;
  if (ctx.edit && MANDO_WEAPONS[id] && MANDO_WEAPONS[id].slot) ctx.kit = { ...ctx.kit, [MANDO_WEAPONS[id].slot]: id };
  render();
}

/* ---------- open / close ---------- */
export const armoryOpen = () => menuPanel.classList.contains('open') && !!ctx && ctx.panel === menuPanel;
export const armoryPickUp = () => runPanel.classList.contains('open');
// a found gun's pick still to show, or up now (a chapter's next scene waits for it: game/flow.js, net/waits.js)
export const armoryPending = () => pendingGuns.length > 0 || armoryPickUp();
// BEGIN on a mission: pick the two guns before the fight; `go` starts it. Nothing to choose (one gun each) goes straight in.
export function openArmoryPrefight(go){
  const known = storyGuns();
  ctx = { mode: 'prefight', panel: menuPanel, edit: true, known, kit: savedKit(known), onGo: go,
    note: 'Choose your sidearm (1) and primary (2) for this mission. Click a gun to carry it in its slot.' };
  ctx.focus = ctx.kit.primary || ctx.kit.sidearm;
  if (known.length <= 1){ fightNow(); return; }
  show(menuPanel);
}
export function openArmoryCodex(){
  if (isTrooper()){
    const known = GUN_ORDER.trooper.filter(trooperOwned);
    ctx = { mode: 'codex', trooper: true, panel: menuPanel, edit: false, known, kit: {},
      note: 'Each gun has one move only it does, and ranks I to III earned by using it.' };
    ctx.focus = G.mode !== 'menu' && known.includes(gunId()) ? gunId() : known[0];
    show(menuPanel);
    return;
  }
  const known = [...ARMORY_ORDER, 'disruptor'].filter(id => weaponOwned(id));
  ctx = { mode: 'codex', panel: menuPanel, edit: false, known, kit: { ...kitOf() },
    note: G.sandbox ? 'Change your guns in the sandbox panel (B).' : G.training || G.mission ? '' : 'Each time the run hands you a gun for a full slot, you choose which to carry.' };
  ctx.focus = ctx.kit.primary || ctx.kit.sidearm;
  show(menuPanel);
}
function closeMenu(){ menuPanel.classList.remove('open'); ctx = null; }
function fightNow(){
  const kit = cleanKit(ctx.kit, id => ctx.known.includes(id));
  try { localStorage.setItem('sw_mission_kit', JSON.stringify(kit)); } catch(e){}
  G.missionKit = kit;   // game/mission.js hands it over as the mission starts (game/armory.js missionKit)
  const go = ctx.onGo; closeMenu(); go();
}

/* ---------- a new gun in a run ---------- */
const pending = [], pendingGuns = pending;
setArmoryPickHook((id) => { if (!pending.includes(id)) pending.push(id); });
// game/flow.js, every frame of play: open once nothing else holds the screen
export function tickArmory(){
  if (!pending.length || armoryPickUp() || G.mode !== 'play' || coopRun.holdPopups || G.paused || G.skillSelect || G.cardUp || G.cutscene || performance.now() < (shared.unlockHold || 0) || forceToastHolds()) return;   // (and after the Armorer's beat: ui/force-toast.js)   // (a chapter's close: after its CHAPTER COMPLETE beat, game/flow.js checkUnlocks)
  const id = pending.shift();
  const known = ARMORY_ORDER.filter(w => weaponOwned(w));
  ctx = { mode: 'pick', panel: runPanel, edit: true, known, kit: { ...kitOf() }, fresh: id, focus: id,
    note: 'You found the ' + MANDO_WEAPONS[id].name + '. You carry one ' + KIT_LABEL[MANDO_WEAPONS[id].slot].toLowerCase() + ': keep yours, or take the new one. The other stays in the armory, and you can choose again whenever you find another gun.' };
  show(runPanel);
  G.skillSelect = true; G.cardUp = true;   // freeze the fight while the cursor is free (as the Jedi's meditation does)
  document.exitPointerLock();
  MUSIC.unlockSting(); S.reward(1);
}
export function clearArmory(){ pending.length = 0; if (armoryPickUp()) closeRun(true); }
function closeRun(quiet){
  runPanel.classList.remove('open');
  if (ctx && ctx.panel === runPanel) ctx = null;
  G.cardUp = false;
  if (!document.getElementById('skilltree').style.display.includes('flex')) G.skillSelect = false;
  if (quiet) return;
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}
function carry(){
  setKit(ctx.kit);
  autosave('armory', { notAtClose: true });
  closeRun();
  if (pending.length) tickArmory();
}

/* ---------- input ---------- */
function onClick(e){
  e.stopImmediatePropagation(); audioInit();   // the page must never launch or resume the game behind it
  if (!ctx || ctx.panel !== e.currentTarget) return;
  const t = e.target;
  if (ctx.mode !== 'pick' && (t === ctx.panel || t.closest('[data-x]'))){ closeMenu(); return; }
  if (t.closest('[data-go]')){ if (ctx.mode === 'pick') carry(); else fightNow(); return; }
  const dt = t.closest('[data-dtab]');
  if (dt){ ctx.dtab = dt.dataset.dtab; render(); return; }   // the detail's ABOUT | MOVE | MASTERY (kept as you go from gun to gun)
  const g = t.closest('[data-gun]');
  if (g){ pick(g.dataset.gun); if (!ctx.edit) revealDetail(ctx.panel); }
}
// the menu panel is shared with the Forms page: only handle clicks while the armory is what it shows
menuPanel.addEventListener('click', (e) => { if (ctx && ctx.panel === menuPanel) onClick(e); }, true);
runPanel.addEventListener('click', onClick);
document.addEventListener('keydown', (e) => {
  if (armoryPickUp() && e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); carry(); return; }
  if (!armoryOpen()) return;
  if (e.key === 'Escape'){ e.stopPropagation(); closeMenu(); }
  else if (e.key === 'Enter' && ctx.mode === 'prefight'){ e.preventDefault(); e.stopPropagation(); fightNow(); }
}, true);
