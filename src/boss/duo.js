// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ONE BOSS, TWO (OR MORE) HEROES — what changes about a final boss (boss/finale.js) when a party fights him, so both
// players have a job in the fight instead of one tanking while the other waits. None of it runs solo.
//   THREAT     every blow adds to that hero's threat; he goes after whoever is hurting him most (with some loyalty, and
//              never for too long: after a while on one hero he wheels on the other anyway)
//   BLINDSIDE  a blow from the hero he isn't on lands harder: the one he's ignoring is the one who should be hitting
//   PINCER     two heroes striking him from opposite sides within a breath of each other catch him between them: he
//              staggers open (a raid boss: a big chunk of his sunder bar)
//   WHEEL      as he reaches for a signature move he sometimes turns it on the hero he wasn't on
//   PARTY HP   his health grows with each hero, and a hero joining or leaving mid-fight rescales him on the spot
// The numbers: data/coop.js DUO. The host decides all of it; a guest hears who he's on and the pincer (finaleNet).

import { G } from '../state.js';
import { V3 } from '../utils.js';
import { DUO, heroScale } from '../data/coop.js';
import { players, localPlayer, huntable, heroesHere } from '../player/players.js';
import { floater } from '../fx/floaters.js';
import { hooks, striker } from '../net/run.js';
import { net } from '../net/session.js';
import { nameOf } from '../net/names.js';

// the party's heroes he can go after right now (on their feet, in this fight, not in a menu)
const party = () => players.filter(huntable);
export const duoOn = () => party().length >= 2;
// his health for a party of n (each extra hero adds DUO.hp of it again)
export const duoHp = (n) => heroScale(DUO.hp, n);

function state(F){ return F.duo || (F.duo = { th: new Map(), on: null, since: G.gt, last: new Map(), pcUntil: 0, saidBs: 0 }); }
// the seat of a hero, as every screen numbers them (the host is 0)
const seatOf = (p) => p.local ? (net.slot || 0) : (p.slot ?? 0);
// what this screen calls the hero in a seat
const callName = (seat) => seat === (net.slot || 0) ? 'YOU' : nameOf(seat);
const headAt = (e) => V3(e.group.position.x, e.group.position.y + 3.9 * e.group.scale.y, e.group.position.z);

// whose blow is landing on him: a guest's (the host sets striker.p while it applies them), a squadmate's (nobody's), or
// this browser's own hero's
export const strikerOf = (opts) => opts && opts.ally ? null : (striker.p || localPlayer);

/* a blow landed on him (host or solo; enemies/damage.js → finaleDamage): the hero's threat goes up, and the pincer is
   checked. Returns { mul, pincer }: what the blow is multiplied by (the blindside), and whether it closed a pincer */
// (canPin: the pincer can take now: nothing he's in the middle of rides it out)
export function duoHit(e, F, p, dmg, tick, canPin){
  const out = { mul: 1, pincer: false };
  if (!p || F.over || !duoOn()) return out;
  const d = state(F);
  d.th.set(p, (d.th.get(p) || 0) + dmg);
  if (e.hero && e.hero !== p && players.includes(e.hero) && huntable(e.hero)){
    out.mul = DUO.blindside;
    if (!tick && G.gt >= d.saidBs){ d.saidBs = G.gt + 2.5; if (p.local) floater(headAt(e), 'BLINDSIDE', '#ffd24a'); }
  }
  if (tick) return out;   // (a burn's ticks are threat, not a strike from a side)
  const g = e.group.position, ang = Math.atan2(p.pos.x - g.x, p.pos.z - g.z);
  d.last.set(p, { t: G.gt, ang });
  if (G.gt < d.pcUntil || !canPin) return out;
  for (const [q, l] of d.last){
    if (q === p || !huntable(q) || G.gt - l.t > DUO.pincer.win || Math.cos(ang - l.ang) > DUO.pincer.cos) continue;
    d.pcUntil = G.gt + DUO.pincer.cd; d.last.clear();
    out.pincer = true;
    break;
  }
  return out;
}

/* who he goes after (enemies/targets.js heroFor asks first: e.pick). null: the usual pick (solo, or nobody has hurt him
   yet), which goes by distance */
const COMMITTED = { windup: 1, strike: 1, lungewind: 1, lunge: 1, lock: 1, sig: 1, stagger: 1 };
export function duoPick(e){
  const F = e.fin;
  if (!F || F.over || !duoOn()) return null;
  const d = state(F), heroes = party();
  if (!d.on && e.hero && heroes.includes(e.hero)){ d.on = e.hero; d.since = G.gt; }   // (who the usual pick put him on)
  const cur = d.on && heroes.includes(d.on) ? d.on : null;
  if (cur && (COMMITTED[e.state] || G.gt - d.since < DUO.threat.min)) return cur;
  let best = null, bt = 0;
  for (const p of heroes){ const t = (d.th.get(p) || 0) * (p === cur ? DUO.threat.keep : 1); if (t > bt){ bt = t; best = p; } }
  if (!best) return cur;   // (nobody has hurt him: the usual pick, by distance)
  // too long on one hero: he wheels on the other, whatever the threat says
  if (best === cur && G.gt - d.since > DUO.threat.max){ const o = otherThan(F, cur, heroes); if (o){ turnOn(e, F, d, o, true); return o; } }
  if (best !== d.on) turnOn(e, F, d, best);
  return best;
}
// the hero he'd wheel on instead of p: whoever of the others has hurt him most lately (any of them, if nobody has)
function otherThan(F, p, heroes = party()){
  const d = state(F);
  let o = null, ot = -1;
  for (const q of heroes){ if (q === p) continue; const t = (d.th.get(q) || 0) + Math.random() * 1e-3; if (t > ot){ ot = t; o = q; } }
  return o;
}
function turnOn(e, F, d, p, wheel){
  const was = d.on;
  if (wheel && was) d.th.set(p, Math.max(d.th.get(p) || 0, d.th.get(was) || 0));   // (wheeled on: he means it, for a while)
  d.on = p; d.since = G.gt; e.hero = p; e.heroCheck = G.gt + 99;
  if (!was) return;   // (his first pick: nothing to call)
  // he turned: the threat of the one he left starts over a little lower, so the two trade him back and forth
  d.th.set(was, (d.th.get(was) || 0) * 0.5);
  sayTurn(e, seatOf(p));
  if (hooks.fin) hooks.fin({ k: 'ag', n: e.nid, s: seatOf(p) });
}
function sayTurn(e, seat){
  const you = seat === (net.slot || 0);
  floater(headAt(e), you ? 'HE TURNS ON YOU' : 'HE TURNS ON ' + callName(seat), you ? '#ff6a6a' : '#ffd9a0');
}
// a guest's screen: the host says who he's on now
export function duoHeard(e, seat){ if (e) sayTurn(e, seat); }

/* as he reaches for a signature move (boss/finale.js pickMove): sometimes he turns it on the hero he wasn't on. True when
   he did (the move's context is worked out again) */
export function duoWheel(e, F){
  if (!duoOn() || Math.random() >= DUO.wheel) return false;
  const d = state(F), cur = e.hero, o = otherThan(F, cur);
  if (!o) return false;
  turnOn(e, F, d, o, true);
  return true;
}

/* every frame on the host: the threat fades, and a party that grew or shrank mid-fight rescales his health (keeping the
   share he has left) and, a raid boss's, his sunder bar */
export function updateDuo(e, F, dt){
  const d = F.duo;
  if (d){ const k = Math.pow(0.5, dt / DUO.threat.half); for (const [p, t] of d.th) d.th.set(p, t * k); }
  if (F.over || e.dead) return;
  const n = heroesHere();
  if (F.party == null){ F.party = n; return; }
  if (n === F.party) return;
  const k = duoHp(n) / duoHp(F.party);
  F.party = n;
  e.maxHp = Math.max(1, Math.round(e.maxHp * k)); e.hp = Math.max(1, e.hp * k);
  if (e.hpFloor > 1 && F.phase < 3) e.hpFloor = Math.ceil(e.maxHp * F.def.phaseAt[F.phase - 1]);
  if (F.sd){ const c = F.def.sunder, max = Math.round(c.bar * heroScale(c.coop, n)); F.sd.v *= max / F.sd.max; F.sd.max = max; }
  if (d){ for (const p of [...d.th.keys()]) if (!players.includes(p)) d.th.delete(p); if (d.on && !players.includes(d.on)) d.on = null; }
}
