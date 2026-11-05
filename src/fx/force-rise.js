// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE FORCE PULSE: what the Force Level's rise looks like round the hero (ui/force-toast.js). A bright star at the chest,
// two rings of Force running out over the ground (the second in the form's blade colour), motes lifting off the hero and
// a soft blue light. Drawn in Ink like the powers, and on the sim's clock (it holds under the pause like every VFX).

import { V3 } from '../utils.js';
import { playerPos } from '../player/helpers.js';
import { inkSprite, sparks, groundRing } from './ink.js';
import { flashLight } from './lights.js';

const BLUE = 0x6cc8ff, PALE = 0xdff3ff;
export function forcePulse(blade){
  const p = playerPos(), chest = V3(p.x, p.y + 1.15, p.z);
  inkSprite({ pos: chest, shape: 'star', points: 8, sharp: 0.32, color: BLUE, size: [0.3, 2.4], life: 0.4, steps: 3, coreW: 0.42 });
  inkSprite({ pos: chest, shape: 'disc', color: PALE, size: [0.4, 1.6], ease: 2, life: 0.3, op: 0.7, coreW: 0.6 });
  groundRing(p, BLUE, 6.5, 0.85, 0.95);
  groundRing(p, PALE, 4, 0.6, 0.8, { delay: 0.1 });
  groundRing(p, blade || BLUE, 10, 1.3, 0.55, { delay: 0.22, inner: 0.93 });
  sparks(V3(p.x, p.y + 0.3, p.z), PALE, 24, 6, { up: 1.4, life: 1.0, grav: -1.5, stretch: 2.2, size: 0.34 });
  sparks(chest, BLUE, 14, 9, { up: 0.2, life: 0.5, grav: 0, stretch: 4, size: 0.4 });
  flashLight(BLUE, 2.4, 9, chest, 0.7);
}
