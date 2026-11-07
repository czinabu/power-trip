// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WAYSTONE PANEL in an open zone (game/zone.js): tap F at a waystone and it opens over the streets, holding the game
// still and freeing the cursor the way a hub station's panel does (ui/hub-ui.js, whose look it shares). It lists every
// waystone in the zone: the touched ones travel there, the rest say where to find them. The gate's stone also takes you
// home (the shuttle on the pad beside it).

import { G, shared } from '../state.js';
import { optHTML, headHTML } from './hub-cards.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { zoneDef, travelTo, setZonePanel, setZoneFade } from '../game/zone.js';
import { zoneMemo } from '../game/profile.js';
import { goTemple } from './menus.js';
import { loadInto } from './loading.js';
import { HUBS } from '../data/hub.js';
import { hubIdFor } from '../game/hub.js';
import { net } from '../net/session.js';

const panel = document.getElementById('zonepanel');
const isOpen = () => !!panel && panel.classList.contains('open');
const B = (t, d, go) => ({ t, d, go });
const esc = (t) => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let at = null;

function render(){
  const Z = zoneDef(); if (!Z || !at) return;
  const memo = zoneMemo(G.zone), dist = (id) => (Z.districts.find(d => d.id === id) || {}).name || '';
  const list = [];
  if (at.gate){
    const home = (HUBS[G.hubId] || HUBS[hubIdFor()] || HUBS.temple).home;
    const guest = net.role === 'guest' && net.status === 'connected';
    list.push(B('RETURN TO ' + home, guest ? 'Take the shuttle home. The rest of the party stays in the city.' : 'Take the shuttle on the pad home. You can come back any time.', () => goTemple()));
  }
  for (const w of Z.waystones){
    if (w.id === at.id) continue;
    const known = !!memo.stones[w.id];
    list.push(B(w.name, known ? dist(w.district) : 'NOT YET TOUCHED · somewhere in ' + dist(w.district).toLowerCase(), known ? () => travelTo(w.id) : null));
  }
  const n = Z.waystones.filter(w => memo.stones[w.id]).length;
  panel.innerHTML = '<div class="hb-box hb-a-waystone">' + headHTML(esc(Z.name), esc(at.name), 'Walk up to a waystone to touch it, then travel between the ones you have touched. You have touched ' + n + ' of ' + Z.waystones.length + '.') +
    '<div class="hb-list' + (list.length > 4 ? ' many' : '') + '">' + list.map((b, i) => optHTML({ ...b, t: esc(b.t), d: esc(b.d) }, i, { ic: at.gate && !i ? 'ship' : b.go ? 'compass' : 'lock', main: at.gate && !i })).join('') + '</div>' +
    '<div class="btn hb-x" data-x="1">CLOSE</div></div>';
  panel._list = list;
}

function open(w){
  if (!panel || !G.zone || G.mode !== 'play' || G.paused || G.skillSelect) return false;
  at = w;
  G.skillSelect = true; G.sbMenu = true;   // holds the streets still and keeps the pause screen away while the cursor is free
  render(); panel.classList.add('open');
  if (document.pointerLockElement) document.exitPointerLock();
  return true;
}
export function closeZonePanel(relock = true){
  if (!isOpen()) return;
  panel.classList.remove('open');
  G.skillSelect = false; G.sbMenu = false; at = null;
  if (relock && !shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
}
export const zonePanelOpen = isOpen;
setZonePanel(open);
// a waystone's travel (and waking after a fall) lands behind the loading screen: the streets there are built under it
setZoneFade((go) => {
  G.paused = true;
  let done = false;
  loadInto(() => { done = true; go(); }).finally(() => {
    if (!done) go();   // (the screen was already on its way: land anyway)
    if (G.zone && G.mode === 'play') G.paused = false;
  });
});

if (panel){
  panel.addEventListener('click', (e) => {
    e.stopPropagation(); audioInit();
    if (e.target === panel || e.target.closest('[data-x]')){ closeZonePanel(); return; }
    const o = e.target.closest('.hb-o'); if (!o) return;
    const b = panel._list[+o.dataset.i];
    if (!b || !b.go){ S.uiDeny && S.uiDeny(); return; }
    closeZonePanel(true);   // (while the click still counts as a gesture: the lock comes back with it)
    b.go();
  });
  document.addEventListener('keydown', (e) => { if (isOpen() && (e.key === 'Escape' || e.key === 'Tab')){ e.preventDefault(); closeZonePanel(); } }, true);
}
