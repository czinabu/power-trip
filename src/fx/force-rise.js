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

// THE ARMORER'S FORGE (game/armorer.js): the new piece struck onto the beskar. Ember sparks off the anvil-bright plate, a
// white-hot flash at the chest and a ring of heat over the ground
const EMBER = 0xff7a2e, HOT = 0xffe2b8;
export function forgePulse(){
  const p = playerPos(), chest = V3(p.x, p.y + 1.2, p.z);
  inkSprite({ pos: chest, shape: 'star', points: 6, sharp: 0.2, color: HOT, size: [0.25, 1.8], life: 0.3, steps: 3, coreW: 0.5 });
  groundRing(p, EMBER, 5, 0.7, 0.85);
  sparks(chest, EMBER, 30, 8, { up: 2.2, life: 0.9, grav: -9, stretch: 3, size: 0.3 });
  sparks(chest, HOT, 12, 5, { up: 1.2, life: 0.5, grav: -6, stretch: 2, size: 0.26 });
  flashLight(EMBER, 2.6, 8, chest, 0.55);
}
// THE PROMOTION (game/promotion.js): the squad snaps to. A gold flash at the chest and two clean rings: the company's colours
const GOLD = 0xf0a52a, ARMOUR = 0xeef1f2;
export function promotePulse(){
  const p = playerPos(), chest = V3(p.x, p.y + 1.2, p.z);
  inkSprite({ pos: chest, shape: 'disc', color: ARMOUR, size: [0.3, 1.4], ease: 2, life: 0.28, op: 0.75, coreW: 0.6 });
  groundRing(p, GOLD, 6, 0.75, 0.9);
  groundRing(p, ARMOUR, 9, 1.1, 0.5, { delay: 0.15, inner: 0.93 });
  sparks(V3(p.x, p.y + 0.4, p.z), GOLD, 16, 5, { up: 1.6, life: 0.8, grav: -2, stretch: 2, size: 0.3 });
  flashLight(GOLD, 2, 8, chest, 0.5);
}
