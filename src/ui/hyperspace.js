// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE JUMP: what the helm (ui/galaxy-ui.js helmPanel) plays before a run it launches on another world. The screen fills
// with star lines streaking out from the middle, the world's name over them, and a flash, then the run's own loading
// screen takes over. DOM and CSS only (styles/heroes/galaxy.css .hyp-*), about a second, so it costs a phone nothing.
// A run on the world the ship is already at skips it.

import { S } from '../audio/sfx.js';

const MS = 1050;
let busy = false;
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function hyperjump(world, then){
  if (busy){ then(); return; }
  busy = true;
  const el = document.createElement('div');
  el.className = 'hyp';
  el.style.setProperty('--gc', world.col || '#9fd0ff');
  let lines = '';
  for (let i = 0; i < 64; i++){
    const a = (i * 137.5) % 360, d = (i * 0.023) % 0.5, len = 18 + (i * 7) % 26;
    lines += '<i style="--a:' + a.toFixed(1) + 'deg;--d:' + d.toFixed(3) + 's;--l:' + len + 'vmax"></i>';
  }
  el.innerHTML = '<div class="hyp-lines">' + lines + '</div><div class="hyp-to"><span>JUMPING TO</span><b>' + esc(world.name) + '</b></div><div class="hyp-flash"></div>';
  document.body.appendChild(el);
  try { S.dash(); setTimeout(() => S.jump(), 380); setTimeout(() => S.dash(), 760); } catch(e){}
  setTimeout(() => {
    busy = false;
    try { then(); } finally { setTimeout(() => el.remove(), 250); }
  }, MS);
}
export const jumping = () => busy;
