// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// WHO THE RUN IS WAITING ON. Each guest tells the host what it still has to get through before the run can move on (pick:
// its upgrade page, or the pop-ups a fight left it: a new power's card, a learned form, a found gun), and the host tells
// every guest the whole list whenever it changes (wfp), its own state in it. The next wave waits for the guests' upgrade
// pages, and the next chapter for everyone's pages and pop-ups (game/flow.js); the waiting card on the dark between two
// chapters names who it's waiting for (ui/waiting.js).
//
// A state is one letter: 'u' the upgrade page (or a choose-one pick) · 'p' pop-ups still to see · 'c' something else on
// screen first (a card; the host: the chapter's close before its upgrade page opens).

import { G, shared } from '../state.js';
import { net, on, send, connected } from './session.js';
import { coopRun } from './run.js';
import { abilityChoicePending, abilityCardsPending } from '../ui/ability-card.js';
import { meditationPending } from '../game/meditation.js';
import { armoryPending } from '../ui/armory-ui.js';

// this screen's own pop-ups: still to show, or up now
export const ownPopups = () => abilityCardsPending() || meditationPending() || armoryPending();
const treeUp = () => (document.getElementById('skilltree').style.display || '').includes('flex');

// what this screen's hero still has to do before the run moves on ('' nothing)
export function ownState(){
  if (treeUp() || abilityChoicePending()) return 'u';
  if (ownPopups()) return 'p';
  if (G.skillSelect || G.cardUp) return 'c';
  return '';
}

const picking = new Map();   // host: guest seat -> its state
let heard = [];              // guest: [[seat, state]] as the host last sent it
let sentKey = null, pickSent = '';

// host: the guests that still have something open (the next wave waits for them: game/flow.js)
export const pickingSeats = () => [...picking.keys()];
const sync = () => { coopRun.guestPicking = picking.size > 0; };

// [[seat, state]] for everyone the run is waiting on now, this screen's own included. The host counts itself busy through
// the chapter's close (the doorway's fade, its last word) until its upgrade page is behind it
export function busySeats(){
  const own = ownState() || (net.role === 'host' && (shared.levelPhase === 'chapterdone' || shared.levelPhase === 'aftermath') ? 'c' : '');
  const list = net.role === 'host' ? [...picking] : heard.filter(([k]) => k !== net.slot);
  return own ? [[net.slot, own], ...list] : list;
}

// once a frame (main.js): a guest's own state to the host, the host's list to every guest
export function updateWaits(){
  if (net.role === 'guest' && connected()){
    const st = G.coopGuest ? ownState() : '';
    if (st !== pickSent){ pickSent = st; send({ t: 'pick', o: st ? 1 : 0, k: st }); }
  } else pickSent = '';
  if (net.role !== 'host' || !connected()){ sentKey = null; return; }
  const w = busySeats(), key = w.map(x => x.join(':')).join(',');
  if (key === sentKey) return;
  sentKey = key;
  send({ t: 'wfp', w });
}

const STATES = new Set(['u', 'p', 'c']);
on('pick', (m) => {
  if (net.role !== 'host' || m.from == null) return;
  if (m.o) picking.set(m.from, STATES.has(m.k) ? m.k : 'u'); else picking.delete(m.from);   // (an older guest sends no state: its upgrade page)
  sync();
});
on('wfp', (m) => {
  if (net.role !== 'guest' || !Array.isArray(m.w)) return;
  heard = m.w.filter(x => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= 0 && x[0] <= 3 && STATES.has(x[1])).slice(0, 4);
});
on('closed', (slot) => { if (slot < 0) picking.clear(); else picking.delete(slot); sync(); });
on('open', () => { sentKey = null; pickSent = ''; });   // a (re)joined guest tells its new host again, and hears the list again
on('status', (n) => { if (n.status !== 'connected'){ picking.clear(); sync(); heard = []; sentKey = null; } });
