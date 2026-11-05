// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* NIMAN — THE FLOW CAST: saber, Force and feet as one. A Force power thrown in the middle of a roll or a Force dash
   costs less, leaves the move running, and gives back the dash charge it spent, so a Niman duellist can dash, push,
   and dash again. (stances.js niman `flowCast`: the share of the cost it pays) */

import { G, player, isGunner } from '../../state.js';
import { stance, playerPos } from '../helpers.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { V3 } from '../../utils.js';
import { refundCharge } from '../mobility.js';
import { tutEvent } from '../../game/tutor-bus.js';

// mid-move right now (the roll or the dash still carrying you)?
export const flowCasting = () => !isGunner() && !!stance().flowCast && (player.dashT > 0 || player.rollT > 0);
// × on a power's Force cost
export const flowCastMul = () => flowCasting() ? stance().flowCast : 1;
// a power went off (jedi/force.js castGesture): the flourish, and the charge back once a move
export function noteFlowCast(){
  if (!flowCasting()) return false;
  const pp = playerPos();
  if (player.flowCastAt !== player.dashStartT){
    player.flowCastAt = player.dashStartT;
    if (player.dashSpent){ refundCharge(); player.dashSpent = false; }
    floater(pp, 'FLOW CAST', '#3aff8c');
    tutEvent('flowCast');
  }
  burst(V3(pp.x, pp.y + 1.1, pp.z), 0x3aff8c, 6, 3, 1.5, 0.6);
  return true;
}
