// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE PATHS' CARDS, in play: what a light or dark card (data/alignment.js PATH_TREE) adds that a stat alone can't. The
// cards set player.up; this reads it where it counts:
//   · a blow turned aside (game/readout.js noteDefense: a block, a deflect, a parry or a catch): THE OATH's gadget
//     power and THE BESKAR HOLDS' health, at most once a CREED.guardGap (a brace soaks every bolt of a volley)
//   · a kill (enemies/damage.js): every hero's per-kill cards (lifesteal, FEED ON FEAR, UNLIMITED POWER, NO LOOSE
//     ENDS, TROPHY HUNTER), KILL CONFIRMED's command points for a pinned foe, TERROR's pins round the body
//   · the squad's kill: BROTHER'S KEEPER's health
//   · a bolt landing: NO QUARTER on a wounded foe, NO PRISONERS on a pinned one (enemies/bolts.js)
// CO-OP: the host owns the foes, so a guest's killing blow lands on the host's screen. The host keeps none of its own
// kill cards for it and tells that guest (net/foes.js 'kb'), and the guest's own cards pay out on the guest's screen.

import { G, player, enemies, isTrooper } from '../state.js';
import { clamp } from '../utils.js';
import { maxHp } from '../player/helpers.js';
import { CFG } from '../data/config.js';
import { CREED } from '../data/alignment.js';
import { pinFoe } from '../enemies/coverfight.js';
import { commandPoints, cpMax } from '../player/trooper/command.js';
import { on, net } from '../net/session.js';

const heal = (n) => { if (n) player.hp = clamp(player.hp + n, 0, maxHp()); };
const power = (n) => { if (n) player.force = clamp(player.force + n, 0, CFG.player.maxForce); };

// a blow turned aside: `kind` is game/readout.js's (dodges don't count: nothing was turned aside)
export function creedGuard(kind){
  if (kind === 'dodges' || G.mode !== 'play') return;
  const U = player.up;
  if (!U.guardForce && !U.guardHeal) return;
  if (G.gt - (player.creedGuardT ?? -9) < CREED.guardGap) return;
  player.creedGuardT = G.gt;
  power(U.guardForce); heal(U.guardHeal);
}

// this hero's own kill (pinned: the foe was pinned as it fell; at: where it fell)
export function killPerks(pinned, at){
  const U = player.up;
  heal(U.lifesteal);   // skill: lifesteal (Vampiric Blade, Hunter's Creed)
  heal(U.killHeal);    // UNLIMITED POWER, TROPHY HUNTER
  power(U.killForce);  // FEED ON FEAR, NO LOOSE ENDS
  if (pinned && U.pinKillCp && isTrooper() && G.mode === 'play') player.cp = Math.min(cpMax(), commandPoints() + U.pinKillCp);   // KILL CONFIRMED
  if (U.terror && at){   // TERROR: everyone near the body keeps their head down
    const r2 = CREED.terror * CREED.terror;
    for (const e of enemies){
      if (e.dead || e.converted) continue;
      const g = e.group.position, dx = g.x - at.x, dz = g.z - at.z;
      if (dx * dx + dz * dz < r2) pinFoe(e);
    }
  }
}
// the squad's kill (the shared squad's, for a co-op guest too: net/foefire.js 'sqk')
export function squadKillPerks(){ heal(player.up.squadKillHeal); }

// what a landed bolt of this hero's is worth on this foe
export function creedHitMul(e){
  const U = player.up;
  let k = 1;
  if (U.woundedDmg && e.maxHp && e.hp < e.maxHp * CREED.wounded) k *= U.woundedDmg;   // NO QUARTER
  if (U.pinnedDmg && e.suppT > G.gt) k *= U.pinnedDmg;                                 // NO PRISONERS
  return k;
}

// co-op: the host says this guest's blow was the kill
on('kb', (m) => { if (net.role === 'guest' && G.mode === 'play') killPerks(!!m.p, m.x != null ? { x: m.x, z: m.z } : null); });
