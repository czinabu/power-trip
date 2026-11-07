// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The sandbox panel (B in the sandbox): call in any foe, switch powers on and off, clear the floor, god mode.
// One page, so everything tweaked mid-fight is in view at once: FOES on the left (the spawn grid, elite / dummies / break
// guards, the duellists' form and rank), YOU on the right (forms, the Force level and mastery, powers or gear, restore,
// god mode), and the floor along the bottom (the arena, the squad, the readout). The battle simulator's setup, replay and
// saved setups sit behind their own button. Q / E (LB / RB on a pad) jump between the sections (and the pad's ring with them).
// Before the campaign is beaten, what the story hasn't reached yet shows dimmed and locked (game/sandbox-unlocks.js).
// It holds the game still while it's open and frees the cursor, the same way the upgrade screen does.

import { FORCE_MAX, FORM_RANKS } from '../data/force-level.js';
import { storyForceLevel } from '../game/sandbox-unlocks.js';
import { setStanceHud } from '../player/jedi/stance.js';
import { RANKS, RANK_ORDER } from '../data/foe-forms.js';
import { formName } from '../enemies/foeform.js';
import { renderer } from '../engine/renderer.js';
import { showBanner } from './banners.js';
import { G, shared, isGunner, heroKey } from '../state.js';
import { SANDBOX_FOES, SANDBOX_COUNTS, SANDBOX_KIT, SANDBOX_MAPS } from '../data/sandbox.js';
import { addSquadmate, dismissSquadmate, squadSize } from '../allies/squad.js';
import { SQUAD } from '../data/allies.js';
import { readoutOn, setReadoutOn, restartReadout } from '../game/readout.js';
import { SB, sandboxSpawn, sandboxClear, sandboxHeal, setSandboxDummy, setSandboxKit, sandboxKitAll, kitAvailable, setSandboxMap, cycleSandboxSlot } from '../game/sandbox.js';
import { FORMS, LOADOUT_SLOTS } from '../data/forms.js';
import { foeOffered, mapOffered, kitOffered, sandboxIsFull, sandboxProgress } from '../game/sandbox-unlocks.js';
import { battleArmed, replayBattle, savedSetups, saveSetup, loadSetup, BS } from '../game/battlesim.js';
import { openBattleSetup } from './battlesim-ui.js';
import { BATTLE_SIM } from '../data/battlesim.js';

const panel = document.getElementById('sandbox');
const $ = (id) => document.getElementById(id);
const isOpen = () => panel.classList.contains('open');

export function openSandboxPanel(){
  if (!G.sandbox || G.mode !== 'play' || G.paused || G.skillSelect) return;
  G.sbMenu = true;        // the camera cuts away like the pause screen
  sec = -1;               // Q / E start from the top again
  G.skillSelect = true;   // freezes the sim and keeps the pause screen away while the cursor is free (see ui/menus.js)
  render();
  panel.classList.add('open');
  document.exitPointerLock();
}
export function closeSandboxPanel(relock = true){
  if (!isOpen()) return;
  showBsim(false);
  panel.classList.remove('open');
  G.sbMenu = false;
  G.skillSelect = false;
  if (relock && !shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}

// Q / E jump between the sections, in reading order (a section that's hidden for this hero is skipped)
const box = panel.querySelector('.sb-panel');
const bsimUp = () => box.classList.contains('bsim');
function showBsim(on){ box.classList.toggle('bsim', on); }
let sec = -1;
function jump(d){
  if (bsimUp()) return;
  const list = [...panel.querySelectorAll('[data-sbsec]')].filter(el => el.offsetParent !== null);
  if (!list.length) return;
  sec = sec < 0 ? (d > 0 ? 0 : list.length - 1) : (Math.min(sec, list.length - 1) + d + list.length) % list.length;
  const el = list[sec];
  el.scrollIntoView({ block: 'start' });
  for (const o of list) o.classList.remove('flash');
  void el.offsetWidth; el.classList.add('flash');
  // the pad's ring goes to the section's first pick (engine/gamepad.js)
  const first = el.querySelector('.sb-chip:not(.locked), .sb-seg span:not(.locked), .btn, .setpill');
  if (first) document.dispatchEvent(new CustomEvent('pad-focus', { detail: first }));
}

const SB_FORMS = ['shiicho', 'makashi', 'soresu', 'ataru', 'djemso', 'shien', 'niman', 'juyo', 'jarkai'];   // (a magnaguard always fights with its staff)
function pill(id, on){ const el = $(id); el.classList.toggle('on', on); el.querySelector('.setval').textContent = on ? 'ON' : 'OFF'; }
const LATER = 'Later in the campaign';
const HIDDEN = '? ? ?';   // anything the story hasn't reached yet shows no name, so the menu spoils nothing
function render(){
  const full = sandboxIsFull(), prog = sandboxProgress();
  $('sbstory').style.display = full ? 'none' : '';
  $('sbstory').textContent = 'THE STORY SO FAR · ' + prog.n + ' OF ' + prog.of + ' CHAPTERS · beat the campaign to open everything';
  $('sbmap').innerHTML = SANDBOX_MAPS.map(m => { const ok = mapOffered(m.id);
    return `<span data-map="${m.id}" class="${m.id === SB.map ? 'on' : ''}${ok ? '' : ' locked'}"${ok ? '' : ` title="${LATER}"`}>${!ok ? HIDDEN : typeof m.nm === 'object' ? heroKey(m.nm) : m.nm}</span>`; }).join('');
  $('sbcount').innerHTML = SANDBOX_COUNTS.map(n => `<span data-n="${n}" class="${n === SB.count ? 'on' : ''}">×${n}</span>`).join('');
  $('sbreplay').classList.toggle('off', !battleArmed());
  const mapNm = (id) => { const m = SANDBOX_MAPS.find(o => o.id === id); return m ? (typeof m.nm === 'object' ? heroKey(m.nm) : m.nm) : ''; };
  $('sbsaves').innerHTML = savedSetups().map((v, i) => {
    const f = v ? v.units.filter(u => u.k === 'foe').length : 0, a = v ? v.units.filter(u => u.k === 'ally').length : 0;
    const t = v ? `<b>${i + 1}</b> · ${mapNm(v.map)} · ${f}F ${a}A` : `<b>${i + 1}</b> · EMPTY`;
    return `<div class="sb-save"><div class="sv-t" title="${v ? f + ' foes, ' + a + ' squadmates' : 'Nothing saved here'}">${t}</div><div class="sv-b">` +
      `<div class="btn${BS.plan.length ? '' : ' off'}" data-save="${i}">SAVE</div><div class="btn${v && mapOffered(v.map) ? '' : ' off'}" data-load="${i}">LOAD</div></div></div>`;
  }).join('');
  // the duellists' form and rank (enemies/foeform.js reads G.sbFoeForm / G.sbFoeRank; AUTO: as a run would pick)
  $('sbfform').innerHTML = [null, ...SB_FORMS].map(f => `<span data-fform="${f || ''}" class="${(G.sbFoeForm || null) === f ? 'on' : ''}">${f ? formName(f) : 'AUTO'}</span>`).join('');
  $('sbfrank').innerHTML = [null, ...RANK_ORDER].map(r => `<span data-frank="${r || ''}" class="${(G.sbFoeRank || null) === r ? 'on' : ''}">${r ? RANKS[r].no + ' ' + RANKS[r].name : 'AUTO'}</span>`).join('');
  pill('sbelite', SB.elite); pill('sbdummy', SB.dummy); pill('sbbreak', !!G.sbBreak); pill('sbgod', !!G.sandboxGod); pill('sbreadout', readoutOn());
  $('sbsquadn').textContent = squadSize() + ' / ' + SQUAD.max;
  $('sbfoes').innerHTML = SANDBOX_FOES.map(f => {
    const ok = foeOffered(f.id), nm = !ok ? HIDDEN : typeof f.nm === 'object' ? heroKey(f.nm) : f.nm;   // a foe not met yet keeps its name
    return `<div class="sb-chip${f.special ? ' special' : ''}${ok ? '' : ' locked'}" data-foe="${f.id}"${ok ? '' : ` title="${LATER}"`}>${nm}<span class="k">${!ok ? 'LATER' : f.id === 'boss' ? 'BOSS' : f.raid ? 'RAID' : f.special ? 'MID-BOSS' : ''}</span></div>`;
  }).join('');
  const jedi = !isGunner();
  $('sbformssec').style.display = jedi ? '' : 'none';
  $('sbyouhd').textContent = jedi ? '· FORMS & POWERS' : '· GEAR';
  // THE FORCE (data/force-level.js): STORY is where the campaign has reached; a number overrides it
  $('sbforce').style.display = jedi ? '' : 'none';
  if (jedi){
    $('sbflv').innerHTML = [null, ...Array.from({ length: FORCE_MAX }, (_, i) => i + 1)].map(n => `<span data-flv="${n || ''}" class="${(G.sbForceLevel || null) === n ? 'on' : ''}">${n ? n : 'STORY · ' + storyForceLevel()}</span>`).join('');
    $('sbfmr').innerHTML = [null, 0, 1, 2, 3].map(r => `<span data-fmr="${r == null ? '' : r}" class="${(G.sbFormRank ?? null) === r ? 'on' : ''}">${r == null ? 'STORY' : r ? FORM_RANKS.names[r] : 'NONE'}</span>`).join('');
  }
  $('sbkitlbl').firstChild.textContent = jedi ? 'POWERS ' : 'GEAR ';
  if (jedi) $('sbforms').innerHTML = Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
    const id = G.loadout[i], f = id && FORMS[id];
    return `<div class="sb-chip${f ? ' on' : ''}" data-slot="${i}">${f ? (f.no ? 'FORM ' + f.no + ' · ' : '') + f.name : 'EMPTY'}<span class="k">${i + 1}</span></div>`;
  }).join('');
  $('sbkit').innerHTML = (heroKey(SANDBOX_KIT) || []).map(r => {
    if (!kitOffered(r)) return `<div class="sb-chip locked" title="${LATER}">${HIDDEN}<span class="k">LATER</span></div>`;   // a power not earned yet keeps its name
    const nm = typeof r.nm === 'function' ? r.nm() : r.nm;
    const can = kitAvailable(r);
    return `<div class="sb-chip${r.has() ? ' on' : ''}${can ? '' : ' off-needs'}" data-kit="${r.id}" title="${can ? '' : 'Needs ' + r.needs}">${nm}<span class="k">${r.key}</span></div>`;
  }).join('');
}

panel.addEventListener('click', (e) => {
  e.stopPropagation();   // nothing in here may reach the overlay's launch/resume handler
  const t = e.target;
  if (t.closest('#sbbsim')){ showBsim(true); return; }
  if (t.closest('#sbbsimx') || t.id === 'sbbsimpop'){ showBsim(false); return; }
  const slot = t.closest('[data-slot]');
  if (slot){ cycleSandboxSlot(+slot.dataset.slot); render(); return; }
  const n = t.closest('[data-n]'), foe = t.closest('[data-foe]'), kit = t.closest('[data-kit]'), map = t.closest('[data-map]');
  if (t.closest('.locked, .off')) return;   // not reached in the story yet (or nothing to do)
  const sv = t.closest('[data-save]'), ld = t.closest('[data-load]');
  if (sv){ if (saveSetup(+sv.dataset.save)) showBanner('', 'SETUP SAVED TO SLOT ' + (+sv.dataset.save + 1), 1.2); render(); return; }
  if (ld){ if (loadSetup(+ld.dataset.load)){ showBsim(false); openBattleSetup(); } return; }
  if (t.closest('#sbbattle')){ showBsim(false); openBattleSetup(); return; }
  if (t.closest('#sbreplay')){ closeSandboxPanel(); replayBattle(); return; }
  if (map){ if (map.dataset.map !== SB.map){ setSandboxMap(map.dataset.map); render(); } return; }
  if (n){ SB.count = +n.dataset.n; render(); return; }
  const ff = t.closest('[data-fform]'), fr = t.closest('[data-frank]');
  if (ff){ G.sbFoeForm = ff.dataset.fform || null; render(); return; }
  if (fr){ G.sbFoeRank = fr.dataset.frank || null; render(); return; }
  const fl = t.closest('[data-flv]'), fm = t.closest('[data-fmr]');
  if (fl){ G.sbForceLevel = +fl.dataset.flv || null; saveForcePicks(); setStanceHud(); render(); return; }
  if (fm){ G.sbFormRank = fm.dataset.fmr === '' ? null : +fm.dataset.fmr; saveForcePicks(); setStanceHud(); render(); return; }
  if (foe){ sandboxSpawn(foe.dataset.foe); foe.classList.remove('pop'); void foe.offsetWidth; foe.classList.add('pop'); return; }
  if (kit){ const on = kit.classList.contains('on'); setSandboxKit(kit.dataset.kit, !on); render(); return; }
  if (t.closest('#sbelite')){ SB.elite = !SB.elite; render(); return; }
  if (t.closest('#sbdummy')){ setSandboxDummy(!SB.dummy); render(); return; }
  if (t.closest('#sbbreak')){ G.sbBreak = !G.sbBreak; render(); return; }   // (player/jedi/combat.js: every cut breaks a guard, to try the finishers)
  if (t.closest('#sbgod')){ G.sandboxGod = !G.sandboxGod; render(); return; }
  if (t.closest('#sbreadout')){ setReadoutOn(!readoutOn()); render(); return; }
  if (t.closest('#sbroreset')){ restartReadout(); return; }
  if (t.closest('#sbsquadadd')){ addSquadmate(); render(); return; }
  if (t.closest('#sbsquaddrop')){ dismissSquadmate(); render(); return; }
  if (t.closest('#sbclear')){ sandboxClear(); BS.live = false; return; }   // (a set-up battle swept away isn't a win)
  if (t.closest('#sbheal')){ sandboxHeal(); return; }
  if (t.closest('#sball')){ sandboxKitAll(true); render(); return; }
  if (t.closest('#sbnone')){ sandboxKitAll(false); render(); return; }
  if (t.closest('#sbdone, #sbclose') || t === panel) closeSandboxPanel();
});
// B opens and closes it; Esc (B on a pad) closes the battle simulator's box first, then the panel
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'b'){ if (isOpen()) closeSandboxPanel(); else openSandboxPanel(); }
  else if ((k === 'q' || k === 'e') && isOpen()) jump(k === 'e' ? 1 : -1);
  else if (k === 'escape' && isOpen()){ e.preventDefault(); if (bsimUp()) showBsim(false); else closeSandboxPanel(); }
});
// LB / RB on a pad (engine/gamepad.js)
document.addEventListener('sb-tab', (e) => { if (isOpen()) jump(e.detail); });

// the sandbox's FORCE picks are kept between visits (read back as the sandbox opens: game/sandbox.js)
function saveForcePicks(){ try { localStorage.setItem('sw_sandbox_force', JSON.stringify({ lv: G.sbForceLevel || null, rank: G.sbFormRank ?? null })); } catch(e){} }
