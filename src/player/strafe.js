// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// STRAFE: squared to the crosshair while you move (player/animation.js faces you, locomotion.js drops the sprint).
// Settings · STRAFE picks how ALT drives it, for every hero in every mode:
//   TOGGLE (the default): a press of ALT turns it on, the next turns it off. On a pad, LB is also the layer button,
//          so holding LB strafes while it is held (as it always has), and a quick tap of LB on its own toggles it.
//   HOLD:  strafe only while ALT (LB) is held down.
import { G, keys, player } from '../state.js';
import { showBanner } from '../ui/banners.js';

export const strafing = () => G.strafeMode === 'hold' ? !!keys['alt'] : !!(player.strafeLatch || player.padStrafe);

export function toggleStrafe(){
  if (G.strafeMode === 'hold') return;
  player.strafeLatch = !player.strafeLatch;
  showBanner('', player.strafeLatch ? 'STRAFE ON' : 'STRAFE OFF', 0.6);
}

export function setStrafeMode(m){
  G.strafeMode = m === 'hold' ? 'hold' : 'toggle';
  player.strafeLatch = false;
  try { localStorage.setItem('sw_strafemode', G.strafeMode); } catch(e){}
  const v = document.getElementById('strafeval'); if (v) v.textContent = G.strafeMode.toUpperCase();
}
