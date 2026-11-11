// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// buildPlayer(): the procedural player model (see ./model for the rig, outfits and gear).

import * as THREE from 'three';
import { CFG } from '../data/config.js';
import { scene } from '../engine/renderer.js';
import { player } from '../state.js';
import { buildHeroModel } from './model/index.js';
import { SAMPLE_LOOKS, mergeLook } from './model/appearance.js';
import { lookFromPicks, wornPicks } from '../data/customize.js';
import { packPicks } from '../game/pack.js';

/* the hero look: the player's customizer picks (saved in localStorage), with dev overrides on top:
   ?style=shard|ink|forged  ?look=<a SAMPLE_LOOKS name> */
const params = new URLSearchParams(location.search);
const DEV_LOOK = { ...(SAMPLE_LOOKS[params.get('look')] || {}), ...(params.get('style') ? { style: params.get('style') } : {}) };
const PICKS_KEY = 'sw_look';
export function loadPicks(){
  try { const p = JSON.parse(localStorage.getItem(PICKS_KEY)); return p && typeof p === 'object' ? p : {}; } catch(e){ return {}; }
}
export function savePicks(picks){ try { localStorage.setItem(PICKS_KEY, JSON.stringify(picks)); } catch(e){} }
// (`packless`: the Mando hasn't earned his jetpack yet, so his back is bare: game/pack.js)
export const lookOf = (picks) => mergeLook(lookFromPicks(picks), picks && picks.packless ? mergeLook(DEV_LOOK, { mando: { packless: true } }) : DEV_LOOK);
// the picks the hero wears: what is picked, less what the campaign hasn't unlocked yet (data/customize.js wornPicks)
export const wornLook = (picks = loadPicks()) => lookOf(wornPicks(picks));
// ...and on the player himself, the jetpack only once the run has earned it (game/pack.js; the customizer's figure wears it always)
const playerLook = (picks = loadPicks()) => lookOf(packPicks(wornPicks(picks)));

function buildPlayer(){
  const g = player.group;
  g.add(buildHeroModel(player, playerLook()));   // everything visual lives in player.vis so flips/leans don't move the root

  scene.add(g);
}
buildPlayer();

/* restyle the player to new customizer picks (from the menu, between runs): swap the model under player.group for a
   fresh build and drop the pieces the animation adds to the old rig on demand, so they grow back on the new one */
export function rebuildPlayerModel(picks){
  const g = player.group, old = player.vis;
  g.remove(old);
  disposeTree(old);
  for (const k of ['wristBlade']){ if (player[k]){ player[k].removeFromParent(); disposeTree(player[k]); } player[k] = null; }
  player._footing = null; player._legIK = null;
  g.add(buildHeroModel(player, playerLook(picks)));
}

export function disposeTree(root){
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) m.dispose();
  });
}
