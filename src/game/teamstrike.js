// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TEAM STRIKE (online co-op): two heroes working one foe. When a hero's blow lands on a foe another hero struck just
// before it (within TEAM.window), it is a TEAM STRIKE: it lands harder and every screen in the fight marks it, a gold
// burst, a freeze and a short dip into slow motion, so trading blows with your partner on the same foe pays. Any pair of
// heroes and powers counts: a cut after a partner's Push, a shot into a foe your partner just parried, a Force Pull
// into a partner's saber. Solo nothing here runs. The host decides (it applies every hero's blows, enemies/damage.js)
// and tells the guests (net/foefire.js, 'ts').

import { G } from '../state.js';
import { V3 } from '../utils.js';
import { S } from '../audio/sfx.js';
import { burst } from '../fx/particles.js';
import { floater } from '../fx/floaters.js';
import { coopRun, hooks } from '../net/run.js';

export const TEAM = {
  window: 1.1,   // s: a blow from another hero within this of the last one on the same foe makes it a team strike
  dmg: 1.6,      // × the blow's damage
  cd: 2.4,       // s before the same foe can be team-struck again (so two heroes trading cuts don't make every one count)
  hitstop: 0.09, slowmo: 0.45, slowT: 0.25, shake: 0.5,
};

// the host, on every blow it applies (enemies/damage.js): who struck (this hero 'me', a guest by its slot). Returns the
// damage multiplier for this blow.
export function teamCheck(e, who){
  if (!coopRun.live || !e) return 1;
  const now = G.gt;
  let mul = 1;
  if (e.lastBy != null && e.lastBy !== who && now - e.lastByT < TEAM.window && now >= (e.teamCd || 0)){
    mul = TEAM.dmg; e.teamCd = now + TEAM.cd;
    const p = e.group.position;
    teamFx(p.x, p.y, p.z);
    if (hooks.ts) hooks.ts(p.x, p.y, p.z);   // every guest's screen marks it too
    if (G.stats) G.stats.teamStrikes = (G.stats.teamStrikes || 0) + 1;
  }
  e.lastBy = who; e.lastByT = now;
  return mul;
}

// the mark, on this screen
export function teamFx(x, y, z){
  floater(V3(x, y + 2.2, z), 'TEAM STRIKE', '#ffd24a');
  burst(V3(x, y + 1.4, z), 0xffd24a, 16, 9, 6);
  burst(V3(x, y + 1.4, z), 0xffffff, 8, 7, 5);
  G.hitstop = Math.max(G.hitstop, TEAM.hitstop); G.shake = Math.max(G.shake, TEAM.shake);
  G.slowmo = Math.min(G.slowmo, TEAM.slowmo); G.slowmoT = Math.max(G.slowmoT, TEAM.slowT);
  S.riposte(); S.killSting(true);
}
