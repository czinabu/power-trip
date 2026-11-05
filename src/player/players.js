// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// PLAYERS — every hero in the fight. players[0] is always this browser's own hero (the `player` object in state.js);
// in online co-op each partner is one more entry, a puppet posed from their browser's state (net/partner.js).
// Built as a list, not "me and a partner", so the same code takes 2 to 4 players later.
//
// An entry: { id, local, name, pos (Vector3, the feet), vel (Vector3), down (downed or dead: no target),
//             here (in this same arena and fighting: something enemies can go after), trooper, cover (the ARC trooper's) }

import { G, player, isTrooper } from '../state.js';
import { coopRun } from '../net/run.js';
import { coverInfo } from './trooper/cover.js';

const me = {
  id: 'local', local: true, name: 'YOU',
  get pos(){ return player.group.position; },
  get vel(){ return player.vel; },
  get down(){ return !!player.downed; },
  get here(){ return true; },   // the AI always has this hero to fall back on
  get away(){ return coopRun.live && (G.paused || G.skillSelect); },   // co-op: in a menu (paused, picking upgrades): foes leave them be
  get trooper(){ return isTrooper(); },   // the ARC trooper: foes fight him the cover fight (enemies/coverfight.js)
  get cover(){ return coverInfo(); },     // ...and the cover he is in: { nx, nz, low, top, hidden } or null (trooper/cover.js)
};
export const players = [me];
export const localPlayer = me;

export function addPlayer(p){ if (!players.includes(p)) players.push(p); return p; }
export function removePlayer(p){ const i = players.indexOf(p); if (i > 0) players.splice(i, 1); }

// how many heroes are in this fight: this one, plus each partner in the same arena and mode (1 solo, so scaling by it
// changes nothing there). Bosses, champions and revives read it when they start (data/coop.js SCALE)
export const heroesHere = () => Math.max(1, players.filter(p => p.here).length);

// heroes an enemy may pick right now: in this arena and on their feet
export const targetable = (p) => !!p && p.here && !p.down;
// heroes a foe (or a boss) may go after: targetable, and not in a menu in a shared fight (paused: safe, but out of the fight)
export const huntable = (p) => targetable(p) && !p.away;

/* which arena and mode this browser is in, so a partner only counts as being in the same fight when theirs matches */
export function worldKey(){
  const mode = G.hub ? 'hub:' + G.hubWing : G.sandbox ? 'sandbox' : G.training ? 'training' : G.mission ? 'mission:' + G.missionId
    : G.endless ? 'survival:' + G.arenaRot : 'campaign:' + G.levelIdx;
  return mode;
}
