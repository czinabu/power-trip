// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FURY — Form VII's edge (Juyo, Vaapad). Juyo feeds it with every cut that lands; Vaapad with every blow it turns on
// its guard. Fury makes each cut land harder (STANCES furyDmg at full) and drains away when the pressure stops.
// Switching to a form without fury empties it.

import { G, player, isGunner } from '../../state.js';
import { stance, maxStam, playerPos } from '../helpers.js';
import { floater } from '../../fx/floaters.js';

const HOLD = 2.0, DRAIN = 0.2;   // seconds fury holds after the last feed, then the share lost per second

const furyForm = () => !isGunner() && stance() && stance().furyDmg;
// which Form VII is active ('juyo' | 'vaapad'), else null: the HUD's fury bar shows only then
export const furyKind = () => furyForm() ? stance().form : null;
export function addFury(amt){
  if (!furyForm() || !(amt > 0)) return;
  const was = player.fury || 0;
  player.fury = Math.min(1, was + amt); player.furyAt = G.gt;
  if (was < 1 && player.fury >= 1) floater(playerPos(), 'FURY', '#ff5a3a');
}
// × on saber damage
export const furyMul = () => furyForm() ? 1 + (player.fury || 0) * (stance().furyDmg - 1) : 1;
// × on the strain a cut puts on a guard: the stance's own (postureMul), and Juyo's fury bears down on it (furyPosture at full)
export const formPostureMul = () => (stance().postureMul || 1) * (furyForm() && stance().furyPosture ? 1 + (player.fury || 0) * stance().furyPosture : 1);
// JUYO's breath: a cut that lands while the fury is up hands back a share of the swing's stamina (furyBreath at full fury)
export function furyBreath(){
  const st = stance();
  if (!furyForm() || !st.furyBreath || !(player.fury > 0)) return;
  player.stam = Math.min(maxStam(), player.stam + st.stamina * st.furyBreath * player.fury);
}
export function updateFury(dt){
  if (!player.fury) return;
  if (!furyForm()){ player.fury = 0; return; }
  if (G.gt - (player.furyAt || 0) > HOLD) player.fury = Math.max(0, player.fury - DRAIN * dt);
}
